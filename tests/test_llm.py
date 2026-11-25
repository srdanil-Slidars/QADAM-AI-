from unittest.mock import patch
from tests.common import DatabaseTestCase
from app import app
from qadam.db import db
from qadam.llm import AIUnavailable


class LLMTests(DatabaseTestCase):
    def setUp(self):
        super().setUp()
        app.config['AI_PROVIDER']='local'

    def test_proposal_requires_owner_confirmation_and_executes_once(self):
        with patch('qadam.llm.generate',return_value={'reply':'Предлагаю добавить задачу.', 'actions':[{'kind':'add_task','arguments':{'title':'Два тезиса'}}]}):
            before=self.client.get('/api/state').json
            result=self.client.post('/api/chat',json={'text':'Добавь два тезиса'}).json
        action=result['actions'][0]['id']
        self.assertEqual(len(self.client.get('/api/state').json['tasks']),len(before['tasks']))
        other=app.test_client()
        self.assertEqual(other.post(f'/api/ai/actions/{action}/confirm',json={}).status_code,404)
        for _ in range(2):self.assertEqual(self.client.post(f'/api/ai/actions/{action}/confirm',json={}).status_code,200)
        self.assertEqual(len(self.client.get('/api/state').json['tasks']),len(before['tasks'])+1)
        with app.app_context(),db() as c:self.assertEqual(c.execute('SELECT count(*) FROM ai_audit').fetchone()[0],1)

    def test_history_is_scoped_and_invalid_actions_are_discarded(self):
        stranger=app.test_client();stranger.post('/api/tasks',json={'title':'SECRET_OTHER_ACCOUNT'})
        with patch('qadam.llm.generate',return_value={'reply':'Привет, Артём','actions':[]}) as model:
            self.client.post('/api/chat',json={'text':'Я Артём'})
            model.return_value={'reply':'Помню','actions':[{'kind':[],'arguments':{}},{'kind':'run_sql','arguments':{'sql':'DELETE'}}]}
            response=self.client.post('/api/chat',json={'text':'Как меня зовут?'})
            self.assertEqual(response.json['actions'],[])
            prompt=str(model.call_args.args[0])
            self.assertIn('Я Артём',prompt)
            self.assertNotIn('SECRET_OTHER_ACCOUNT',prompt)

    def test_provider_failure_is_explicit_and_does_not_fake_a_reply(self):
        with patch('qadam.llm.generate',side_effect=AIUnavailable('Model offline')):
            self.assertEqual(self.client.post('/api/chat',json={'text':'Привет'}).status_code,503)
        self.assertEqual(self.client.get('/api/state').json['messages'],[])

    def test_cloud_needs_consent_before_network_request(self):
        cfg={'provider':'gemini','key':'test-only','model':'test','url':'https://example.invalid'}
        with patch('qadam.llm.config',return_value=cfg),patch('qadam.llm.generate') as model:
            self.assertEqual(self.client.post('/api/chat',json={'text':'Привет'}).status_code,503)
            model.assert_not_called()

    def test_cancelled_proposal_cannot_execute(self):
        with patch('qadam.llm.generate',return_value={'reply':'Предложение', 'actions':[{'kind':'save_draft','arguments':{'text':'Вопрос куратору'}}]}):
            action=self.client.post('/api/chat',json={'text':'Подготовь черновик'}).json['actions'][0]['id']
        self.client.post(f'/api/ai/actions/{action}/cancel',json={})
        self.assertEqual(self.client.post(f'/api/ai/actions/{action}/confirm',json={}).status_code,409)

    def test_message_is_not_sent_without_confirmation_and_cannot_change_recipient(self):
        from tests.test_accounts_campus_ai import WorkflowTests
        curator=app.test_client();other=app.test_client()
        WorkflowTests.register(self,curator,'curator@example.test','curator')
        WorkflowTests.register(self,other,'other@example.test','curator')
        WorkflowTests.register(self,self.client,'student@example.test')
        first=curator.get('/api/curator').json['group']['invite_code']
        second=other.get('/api/curator').json['group']['invite_code']
        self.client.post('/api/membership',json={'code':first,'consent':True})
        with patch('qadam.llm.generate',return_value={'reply':'Проверь текст', 'actions':[{'kind':'send_request','arguments':{'text':'Нужна консультация по расписанию'}}]}):
            action=self.client.post('/api/chat',json={'text':'Подготовь обращение куратору'}).json['actions'][0]['id']
        with app.app_context(),db() as c:self.assertEqual(c.execute('SELECT count(*) FROM requests').fetchone()[0],0)
        self.client.delete('/api/membership',json={})
        self.client.post('/api/membership',json={'code':second,'consent':True})
        self.assertEqual(self.client.post(f'/api/ai/actions/{action}/confirm',json={}).status_code,409)
        with app.app_context(),db() as c:self.assertEqual(c.execute('SELECT count(*) FROM requests').fetchone()[0],0)
