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


if __name__ == '__main__':
    unittest.main()
