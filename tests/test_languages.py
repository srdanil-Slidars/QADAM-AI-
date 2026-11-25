from unittest.mock import patch
from urllib.error import HTTPError
from tests.common import DatabaseTestCase
from app import app
from qadam.llm import generate, AIUnavailable, info


class LanguageTests(DatabaseTestCase):
    def test_language_is_stored_and_invalid_language_is_ignored(self):
        self.client.post('/api/settings',json={'language':'kk'})
        self.assertEqual(self.client.get('/api/state').json['settings']['language'],'kk')
        self.client.post('/api/settings',json={'language':'invalid'})
        self.assertEqual(self.client.get('/api/state').json['settings']['language'],'kk')

    def test_chat_receives_selected_language_and_preserves_json_protocol(self):
        app.config['AI_PROVIDER']='local'
        with patch('qadam.llm.generate',return_value={'reply':'Hello','actions':[]}) as model:
            self.assertEqual(self.client.post('/api/chat',json={'text':'Hi','language':'en'}).status_code,200)
            self.assertIn('OUTPUT LANGUAGE: English',model.call_args.args[0][0]['content'])
            self.client.post('/api/settings',json={'language':'kk'})
            self.client.post('/api/chat',json={'text':'Сәлем'})
            self.assertIn('OUTPUT LANGUAGE: Kazakh',model.call_args.args[0][0]['content'])

    def test_missing_configuration_is_not_reported_as_local_qwen(self):
        cfg={'provider':'gemini','key':'','model':'test'}
        with app.app_context(),patch('qadam.llm.config',return_value=cfg):
            self.assertFalse(info()['configured'])
            self.assertIsNone(info()['model'])
        app.config['AI_PROVIDER']='unconfigured'
        result=self.client.post('/api/chat',json={'text':'Привет'})
        self.assertEqual(result.status_code,503)
        self.assertNotIn('run_local.py',result.json['error'])

    def test_provider_errors_do_not_leak_keys_and_explain_quota(self):
        cfg={'provider':'gemini','key':'DO_NOT_LEAK','model':'test','url':'https://example.invalid'}
        with patch('qadam.llm.urlopen',side_effect=HTTPError(cfg['url'],429,'secret-provider-response',{},None)):
            with self.assertRaises(AIUnavailable) as caught:generate([],cfg)
        self.assertIn('Лимит',str(caught.exception))
        self.assertNotIn('DO_NOT_LEAK',str(caught.exception))
        self.assertNotIn('secret-provider-response',str(caught.exception))
