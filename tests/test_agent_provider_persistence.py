import os
import stat
import tempfile
import unittest
from unittest.mock import patch

from server import bridge


class AgentProviderPersistenceTest(unittest.TestCase):
    def test_plan_migration_preserves_reasoning_and_other_permissions(self):
        source = {'providers': [{'id': 'test', 'sdkOptions': {'planMode': True, 'permissionMode': 'plan', 'reasoningEffort': 'high'}}]}
        result = bridge.normalize_agent_provider_config(source)
        self.assertEqual(result['providers'][0]['sdkOptions'], {'permissionMode': 'default', 'reasoningEffort': 'high'})
        self.assertTrue(source['providers'][0]['sdkOptions']['planMode'])
        source['providers'][0]['sdkOptions']['permissionMode'] = 'acceptEdits'
        self.assertEqual(bridge.normalize_agent_provider_config(source)['providers'][0]['sdkOptions']['permissionMode'], 'acceptEdits')

    def test_enabled_models_preserve_subset_empty_and_legacy(self):
        result = bridge.normalize_agent_provider_config({'providers': [
            {'id': 'direct', 'model': 'one', 'models': ['one', 'two', 'three'], 'enabledModels': ['one', 'two', 'two']},
            {'id': 'empty', 'enabledModels': []},
            {'id': 'legacy', 'model': 'one'},
            {'id': 'integration:magpie', 'enabledModels': ['group/a'], 'apiKey': 'discard'}
        ]})['providers']
        self.assertEqual(result[0]['enabledModels'], ['one', 'two'])
        self.assertEqual(result[1]['enabledModels'], [])
        self.assertNotIn('enabledModels', result[2])
        self.assertEqual(result[3]['enabledModels'], ['group/a'])
        self.assertEqual(result[3]['apiKey'], '')

    def test_default_permission_mode_is_independent_and_validated(self):
        payload = {'providers': [{'id': 'direct', 'sdkOptions': {'permissionMode': 'default'}}], 'defaultPermissionMode': 'acceptEdits'}
        result = bridge.normalize_agent_provider_config(payload)
        self.assertEqual(result['defaultPermissionMode'], 'acceptEdits')
        self.assertEqual(result['providers'][0]['sdkOptions']['permissionMode'], 'default')
        payload['defaultPermissionMode'] = 'invalid'
        self.assertIsNone(bridge.normalize_agent_provider_config(payload)['defaultPermissionMode'])

    def test_round_trip_preserves_provider_and_active_selection(self):
        payload = {
            'providers': [{
                'id': 'custom:test',
                'label': 'Test Provider',
                'presetId': None,
                'apiType': 'openai-completions',
                'model': 'test-model',
                'baseURL': 'https://example.com/v1',
                'apiKey': 'secret',
                'sdkOptions': {'maxTurns': 12},
                'models': ['test-model'],
                'endpointCandidates': ['https://example.com/v1'],
                'createdAt': 1,
                'updatedAt': 2
            }],
            'activeProviderId': 'custom:test',
            'selectedProviderId': 'custom:test'
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            config_path = os.path.join(temp_dir, 'agent-provider-config.json')
            with patch.object(bridge, 'get_agent_provider_config_path', return_value=config_path):
                saved = bridge.save_agent_provider_config(payload)
                loaded = bridge.load_agent_provider_config()

            self.assertEqual(loaded, saved)
            self.assertEqual(loaded['providers'][0]['model'], 'test-model')
            self.assertEqual(loaded['activeProviderId'], 'custom:test')
            self.assertEqual(stat.S_IMODE(os.stat(config_path).st_mode), 0o600)

    def test_invalid_selection_falls_back_to_first_provider(self):
        normalized = bridge.normalize_agent_provider_config({
            'providers': [{'id': 'custom:first'}],
            'activeProviderId': 'missing',
            'selectedProviderId': 'missing'
        })

        self.assertEqual(normalized['activeProviderId'], 'custom:first')
        self.assertEqual(normalized['selectedProviderId'], 'custom:first')

    def test_same_preset_keeps_multiple_model_instances(self):
        normalized = bridge.normalize_agent_provider_config({
            'providers': [
                {
                    'id': 'custom:zhipu-fast',
                    'label': '智谱 GLM Coding Plan',
                    'presetId': 'zhipu-anthropic',
                    'model': 'glm-5-turbo'
                },
                {
                    'id': 'custom:zhipu-quality',
                    'label': '智谱 GLM Coding Plan',
                    'presetId': 'zhipu-anthropic',
                    'model': 'glm-5.1'
                }
            ],
            'activeProviderId': 'custom:zhipu-quality',
            'selectedProviderId': 'custom:zhipu-fast'
        })

        self.assertEqual(len(normalized['providers']), 2)
        self.assertEqual(
            [provider['model'] for provider in normalized['providers']],
            ['glm-5-turbo', 'glm-5.1']
        )
        self.assertEqual(normalized['activeProviderId'], 'custom:zhipu-quality')
        self.assertEqual(normalized['selectedProviderId'], 'custom:zhipu-fast')

    def test_rejects_non_array_providers(self):
        with self.assertRaises(ValueError):
            bridge.normalize_agent_provider_config({'providers': {}})


class MagpiePersistenceTests(unittest.TestCase):
    def test_magpie_is_singleton_and_credential_free(self):
        from server.bridge import normalize_agent_provider_config
        result = normalize_agent_provider_config({'providers': [
            {'id': 'integration:magpie', 'model': 'bad', 'apiKey': 'bad', 'baseURL': 'https://bad.example'},
            {'id': 'duplicate', 'adapter': 'magpie', 'apiKey': 'bad'}
        ], 'activeProviderId': 'integration:magpie'})
        self.assertEqual(len(result['providers']), 1)
        self.assertEqual(result['providers'][0]['apiKey'], '')
        self.assertEqual(result['providers'][0]['model'], '')
        self.assertEqual(result['providers'][0]['adapter'], 'magpie')

    def test_capabilities_explicit_whitelist(self):
        from server.bridge import normalize_agent_provider_config
        result = normalize_agent_provider_config({'providers': [{'id': 'custom', 'modelCapabilities': {
            'input': ['text', 'image', 'other'], 'reasoning': True, 'contextWindow': 128000, 'maxTokens': 1024,
            'efforts': ['high', 'fake'], 'apiKey': 'no', 'baseURL': 'https://bad.example'
        }}]})['providers'][0]['modelCapabilities']
        self.assertEqual(result['input'], ['text', 'image'])
        self.assertEqual(result['contextWindow'], 128000)
        self.assertEqual(result['efforts'], ['high'])
        self.assertNotIn('apiKey', result)
        self.assertNotIn('baseURL', result)


if __name__ == '__main__':
    unittest.main()
