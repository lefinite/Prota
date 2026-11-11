import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from server import deployment_retention as retention


class RetentionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.config = {'projectId': 'project', 'orgId': 'team', 'staticDomain': 'share.example.com'}
        self.rows = [self.row('current', 100), self.row('previous', 90), self.row('previous2', 80),
                     self.row('old', 70), self.row('branch', 60), self.row('linked', 50),
                     self.row('preview', 40, target='preview'), self.row('building', 30, state='BUILDING'),
                     self.row('failed', 20, state='ERROR'), self.row('canceled', 10, state='CANCELED')]
        self.aliases = [{'alias': 'share.example.com', 'deploymentId': 'current'},
                        {'alias': 'branch.example.com', 'deploymentId': 'branch'}]
        self.deleted = []
        self.requests = []
        (self.root / 'data').mkdir()
        (self.root / 'data/share-management.json').write_text(json.dumps({'link': {'url': 'https://linked.vercel.app/page.html'}}))

    def row(self, identifier, created, state='READY', target='production'):
        return {'uid': identifier, 'created': created, 'state': state, 'target': target,
                'url': identifier + '.vercel.app'}

    def api(self, path, token, team, method='GET', timeout=30):
        self.assertEqual((token, team), ('token', 'team'))
        self.requests.append((path, method))
        if method == 'DELETE':
            self.deleted.append(path.rsplit('/', 1)[1])
            return {}
        if path == '/v9/projects/project':
            return {'id': 'project', 'accountId': 'team', 'targets': {'production': {'id': 'current'}}}
        if path.startswith('/v4/aliases?'):
            return {'aliases': self.aliases}
        if path.startswith('/v6/deployments?'):
            if '&until=' not in path:
                return {'deployments': self.rows[:5], 'pagination': {'next': 60}}
            return {'deployments': self.rows[5:], 'pagination': {'next': None}}
        if path.startswith('/v13/deployments/'):
            identifier = path.rsplit('/', 1)[1].removesuffix('.vercel.app')
            row = next(r for r in self.rows if r['uid'] == identifier)
            return {'id': identifier, 'createdAt': row['created'], 'projectId': 'project',
                    'target': row['target'], 'readyState': row['state'],
                    'alias': ['share.example.com']}  # Historical assignments must not block cleanup.
        raise AssertionError(path)

    def run_cleanup(self, api=None, verify=None, url='https://current.vercel.app'):
        with patch('server.deployer.read_vercel_auth', return_value=('token', None)), \
                patch('server.deployer.vercel_api', side_effect=api or self.api), \
                patch.object(retention, '_verify_share', side_effect=verify):
            return retention.cleanup_after_publish(self.config, url, self.root)

    def test_retains_three_successes_aliases_references_and_nonterminal_builds_across_pages(self):
        self.assertEqual(self.run_cleanup(), ['old', 'failed', 'canceled'])
        self.assertEqual(self.deleted, ['old', 'failed', 'canceled'])
        self.assertTrue(any('&until=60' in path for path, _ in self.requests))

    def test_verification_failure_never_deletes(self):
        with self.assertRaises(ValueError):
            self.run_cleanup(verify=ValueError('unreachable'))
        self.assertEqual(self.deleted, [])

    def test_cli_json_output_resolves_authoritative_production_target(self):
        self.assertEqual(self.run_cleanup(url='}'), ['old', 'failed', 'canceled'])

    def test_newer_builds_are_not_cleaned_and_failed_publication_never_cleans(self):
        self.rows.insert(0, self.row('newer', 110))
        self.assertEqual(self.run_cleanup(), ['old', 'failed', 'canceled'])
        self.deleted.clear()
        next(r for r in self.rows if r['uid'] == 'current')['state'] = 'ERROR'
        with self.assertRaises(ValueError):
            self.run_cleanup()
        self.assertEqual(self.deleted, [])

    def test_missing_share_domain_and_alias_pagination_failure_abort_cleanup(self):
        self.aliases = self.aliases[1:]
        with self.assertRaises(ValueError):
            self.run_cleanup()
        self.assertEqual(self.deleted, [])

    def test_aliases_are_fully_paginated_before_deleting(self):
        def paginated(path, *args, **kwargs):
            result = self.api(path, *args, **kwargs)
            if path.startswith('/v4/aliases?'):
                if '&until=' not in path:
                    return {'aliases': [self.aliases[0]], 'pagination': {'next': 1}}
                return {'aliases': self.aliases[1:]}
            return result
        self.assertEqual(self.run_cleanup(api=paginated), ['old', 'failed', 'canceled'])

    def test_superseded_publication_or_team_mismatch_never_deletes(self):
        for field, value in [('targets', {'production': {'id': 'new'}}), ('accountId', 'another-team')]:
            def changed(path, *args, **kwargs):
                result = self.api(path, *args, **kwargs)
                if path == '/v9/projects/project':
                    result[field] = value
                return result
            with self.assertRaises(ValueError):
                self.run_cleanup(api=changed)
        self.assertEqual(self.deleted, [])

    def test_production_change_during_cleanup_stops_before_next_delete(self):
        def changed(path, *args, **kwargs):
            result = self.api(path, *args, **kwargs)
            if path == '/v9/projects/project' and self.deleted:
                result['targets']['production']['id'] = 'new'
            return result
        with self.assertRaises(ValueError):
            self.run_cleanup(api=changed)
        self.assertEqual(self.deleted, ['old'])

    def test_new_alias_is_protected_and_unrelated_project_detail_is_skipped(self):
        alias_reads = 0
        def changed(path, *args, **kwargs):
            nonlocal alias_reads
            result = self.api(path, *args, **kwargs)
            if path.startswith('/v4/aliases?'):
                alias_reads += 1
                if alias_reads > 1:
                    result['aliases'] = self.aliases + [{'alias': 'new.example.com', 'deploymentId': 'old'}]
            if path == '/v13/deployments/failed':
                result['projectId'] = 'other'
            return result
        self.assertEqual(self.run_cleanup(api=changed), ['canceled'])

    def test_incomplete_inventory_or_failed_delete_stops_without_continuing(self):
        def broken_page(path, *args, **kwargs):
            if '&until=' in path:
                raise OSError('offline')
            return self.api(path, *args, **kwargs)
        with self.assertRaises(OSError):
            self.run_cleanup(api=broken_page)
        self.assertEqual(self.deleted, [])

        def failed_delete(path, *args, **kwargs):
            if kwargs.get('method') == 'DELETE':
                raise OSError('uncertain response')
            return self.api(path, *args, **kwargs)
        with self.assertRaises(OSError):
            self.run_cleanup(api=failed_delete)
        self.assertEqual(self.deleted, [])

    def test_malformed_share_registry_aborts_cleanup(self):
        (self.root / 'data/share-management.json').write_text('{')
        with self.assertRaises(ValueError):
            self.run_cleanup()
        self.assertEqual(self.deleted, [])

    def test_scheduled_failure_is_contained_and_does_not_expose_error_details(self):
        class ImmediateThread:
            def __init__(self, target, **kwargs):
                self.target = target
            def start(self):
                self.target()
        with patch.object(retention.threading, 'Thread', ImmediateThread), \
                patch.object(retention, 'cleanup_after_publish', side_effect=ValueError('secret fixture')), \
                self.assertLogs(retention.logger, level='WARNING') as logs:
            retention.schedule_cleanup(self.config, 'https://current.vercel.app', self.root)
        self.assertNotIn('secret fixture', str(logs.output))

    def test_probe_requires_expected_password_status_and_gateway_headers(self):
        snapshot = self.root / 'data/published-static'
        (snapshot / 'shares').mkdir(parents=True)
        (snapshot / 'shares/a-static.html').write_text('share')
        (snapshot / '.share-access.json').write_text(json.dumps({'a-static.html': {'expiresAt': None, 'passwordHash': 'hash'}}))
        from unittest.mock import MagicMock
        response = MagicMock()
        response.__enter__.return_value = response
        response.status = 401
        response.headers = {'Content-Type': 'text/html', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store'}
        with patch.object(retention.urllib.request, 'build_opener') as opener:
            opener.return_value.open.return_value = response
            retention._verify_share('share.example.com', self.root)
            response.status = 503
            with self.assertRaises(ValueError):
                retention._verify_share('share.example.com', self.root)


if __name__ == '__main__':
    unittest.main()
