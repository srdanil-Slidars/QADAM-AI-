import json
from tests.common import DatabaseTestCase
from app import app
from qadam.db import db


class WorkflowTests(DatabaseTestCase):
    def register(self,client,email,role='student'):
        response=client.post('/api/auth/register',json={'email':email,'password':'Test-password-2026','name':'Тестовый пользователь','role':role,'group':'Тестовая группа','university':'Тестовый вуз'})
        self.assertEqual(response.status_code,201,response.json)

    def test_account_login_restores_data_and_logout_does_not_leak(self):
        self.client.post('/api/tasks',json={'title':'Личная задача аккаунта'})
        old_cookie=self.client.get_cookie('qadam_browser').value
        self.register(self.client,'student@example.com')
        other=app.test_client()
        self.assertEqual(other.post('/api/auth/login',json={'email':'student@example.com','password':'Test-password-2026'}).status_code,200)
        self.assertEqual(other.get('/api/state').json['tasks'][-1]['title'],'Личная задача аккаунта')
        other.post('/api/auth/logout',json={})
        self.assertIsNone(other.get('/api/state').json['user'])
        self.assertEqual(len(other.get('/api/state').json['tasks']),3)
        thief=app.test_client();thief.set_cookie('qadam_browser',old_cookie)
        self.assertEqual(thief.get('/api/state').json['settings']['name'],'')
        with app.app_context(),db() as c:
            hashed=c.execute('SELECT password_hash FROM users').fetchone()[0]
            self.assertNotIn('Test-password-2026',hashed)

    def test_curator_access_consent_requests_and_other_campus_isolation(self):
        curator=app.test_client();stranger=app.test_client()
        self.register(curator,'curator@example.com','curator')
        self.register(stranger,'other-curator@example.com','curator')
        self.register(self.client,'student@example.com')
        self.assertEqual(self.client.get('/api/curator').status_code,403)
        code=curator.get('/api/curator').json['group']['invite_code']
        self.assertEqual(self.client.post('/api/membership',json={'code':code}).status_code,400)
        self.client.post('/api/membership',json={'code':code,'consent':True,'share_checkins':False})
        self.client.post('/api/checkins',json={'mood':2,'stress':4,'note':'Личная заметка, скрытая от куратора'})
        self.client.post('/api/chat',json={'text':'Моя личная переписка'})
        view=curator.get('/api/curator').json
        self.assertEqual(len(view['students']),1)
        self.assertNotIn('checkin',view['students'][0])
        self.client.patch('/api/membership',json={'share_checkins':True})
        view=curator.get('/api/curator').json
        self.assertEqual(view['students'][0]['checkin']['mood'],2)
        serialized=json.dumps(view,ensure_ascii=False)
        for private in ('Личная заметка','Моя личная переписка','profile_id','password_hash'):
            self.assertNotIn(private,serialized)
        self.assertEqual(stranger.get('/api/curator').json['students'],[])
        self.assertEqual(self.client.post('/api/requests',json={'text':'Помогите с учебным планом','consent':True}).status_code,201)
        req=curator.get('/api/requests').json['requests'][0]
        self.assertEqual(stranger.get('/api/requests').json['requests'],[])
        self.assertEqual(stranger.post(f"/api/requests/{req['id']}/reply",json={'text':'Чужой ответ'}).status_code,404)
        self.assertEqual(curator.post(f"/api/requests/{req['id']}/reply",json={'text':'Обсудим план завтра'}).status_code,200)
        self.assertEqual(curator.patch(f"/api/requests/{req['id']}",json={'status':'in_progress'}).status_code,200)
        visible=self.client.get('/api/requests').json['requests'][0]
        self.assertEqual(visible['status'],'in_progress')
        self.assertEqual(visible['replies'][0]['text'],'Обсудим план завтра')
        self.assertEqual(self.client.patch(f"/api/requests/{req['id']}",json={'status':'resolved'}).status_code,403)
        self.client.patch('/api/membership',json={'share_checkins':False})
        self.assertNotIn('checkin',curator.get('/api/curator').json['students'][0])
        self.client.delete('/api/membership',json={})
        self.assertEqual(curator.get('/api/curator').json['students'],[])

    def test_ai_actions_and_university_sources_are_scoped(self):
        curator=app.test_client();self.register(curator,'curator@example.com','curator')
        self.register(self.client,'student@example.com')
        code=curator.get('/api/curator').json['group']['invite_code']
        self.client.post('/api/membership',json={'code':code,'consent':True})
        curator.post('/api/curator/resources',json={'title':'Контакты психолога','body':'Психолог принимает по вторникам в кабинете 104. Запись у куратора.'})
        reply=self.client.post('/api/chat',json={'text':'Какие контакты психолога?'}).json
        self.assertIn('104',reply['reply'])
        self.assertEqual(reply['topic'],'university')
        outsider=app.test_client()
        self.assertNotIn('104',outsider.post('/api/chat',json={'text':'Какие контакты психолога?'}).json['reply'])
        self.client.post('/api/chat',json={'text':'Добавь в план: Прочитать главу учебника'})
        own=self.client.get('/api/state').json
        self.assertEqual(own['tasks'][-1]['title'],'Прочитать главу учебника')
        self.assertEqual(len(outsider.get('/api/state').json['tasks']),3)
        self.client.post('/api/chat',json={'text':'Заверши задачу: Прочитать главу учебника'})
        self.assertEqual(self.client.get('/api/state').json['tasks'][-1]['done'],1)
        before=len(own['tasks'])
        safe=self.client.post('/api/chat',json={'text':'Добавь в план: навредить себе'}).json
        self.assertEqual(safe['topic'],'safety')
        self.assertEqual(len(self.client.get('/api/state').json['tasks']),before)

    def test_cross_origin_and_role_escalation_are_rejected(self):
        self.assertEqual(self.client.post('/api/settings',json={'name':'test'},headers={'Origin':'https://evil.example'}).status_code,403)
        self.assertEqual(self.client.post('/api/auth/register',json={'email':'bad@example.com','password':'Test-password-2026','name':'Test','role':'admin'}).status_code,400)
        self.register(self.client,'student@example.com')
        self.client.post('/api/settings',json={'role':'curator'})
        self.assertEqual(self.client.get('/api/state').json['user']['role'],'student')
        self.assertEqual(self.client.post('/api/curator/resources',json={'title':'x','body':'y'}).status_code,403)
