import json
import sqlite3
from contextlib import closing
import unittest
from app import app, initialize
from tests.common import DatabaseTestCase


class AppTests(DatabaseTestCase):
    def test_daily_checkin_updates_instead_of_duplicates(self):
        self.assertEqual(self.client.post('/api/checkins', json={'mood':0,'stress':3}).status_code,400)
        for mood in (3,5):
            self.assertEqual(self.client.post('/api/checkins',json={'mood':mood,'stress':2,'note':'Тест'}).status_code,200)
        rows=self.client.get('/api/state').json['checkins']
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['mood'],5)

    def test_task_and_settings_persist(self):
        self.client.post('/api/tasks',json={'title':'Подготовить доклад'})
        task=self.client.get('/api/state').json['tasks'][-1]
        self.client.patch(f"/api/tasks/{task['id']}",json={})
        self.client.post('/api/settings',json={'name':'Данил','theme':'dark','faculty':'Информатика','phone':'+7 000 000 00 00','course':'1','specialty':'Программирование','email':'demo@example.com'})
        state=self.client.get('/api/state').json
        self.assertEqual(state['tasks'][-1]['done'],1)
        self.assertEqual(state['settings']['theme'],'dark')
        self.assertEqual(state['settings']['name'],'Данил')
        self.assertEqual(state['settings']['faculty'],'Информатика')
        self.assertEqual(state['settings']['phone'],'+7 000 000 00 00')
        self.assertEqual(state['settings']['specialty'],'Программирование')
        self.assertEqual(state['settings']['course'],'1')
        self.assertEqual(state['settings']['email'],'demo@example.com')
        self.assertEqual(self.client.patch('/api/tasks/99999',json={}).status_code,404)

    def test_chat_and_support_are_explicitly_local(self):
        response=self.client.post('/api/chat',json={'text':'Не успеваю выполнять задания'})
        self.assertIn('шаги',response.json['reply'])
        self.assertEqual(len(self.client.get('/api/state').json['messages']),2)
        self.assertEqual(self.client.post('/api/support',json={'text':'Нужна помощь'}).status_code,400)
        self.client.post('/api/support',json={'text':'Нужна помощь','consent':True})
        self.assertEqual(len(self.client.get('/api/state').json['support']),1)
        self.assertEqual(self.client.get('/').status_code,200)

    def test_browsers_cannot_read_or_change_each_others_records(self):
        other = app.test_client()
        self.client.post('/api/settings',json={'name':'Тестовый студент','phone':'+7 000'})
        self.client.post('/api/checkins',json={'mood':2,'stress':4,'note':'Личная заметка'})
        self.client.post('/api/chat',json={'text':'Моё сообщение'})
        self.client.post('/api/support',json={'text':'Мой черновик','consent':True})
        self.client.post('/api/tasks',json={'title':'Личная задача'})
        own = self.client.get('/api/state').json
        response = other.get('/api/state',base_url='https://localhost')
        separate = response.json
        self.assertEqual(separate['settings']['name'],'')
        self.assertNotIn('phone',separate['settings'])
        for key in ('checkins','messages','support'):
            self.assertEqual(separate[key],[])
        self.assertEqual(len(separate['tasks']),3)
        self.assertEqual(other.patch(f"/api/tasks/{own['tasks'][-1]['id']}",base_url='https://localhost',json={}).status_code,404)
        self.assertEqual(self.client.get('/api/state').json['tasks'][-1]['done'],0)
        other.post('/api/checkins',json={'mood':5,'stress':1},base_url='https://localhost')
        self.assertEqual(self.client.get('/api/state').json['checkins'][0]['mood'],2)
        self.assertEqual(other.get('/api/state',base_url='https://localhost').json['checkins'][0]['mood'],5)
        self.assertIn('no-store',response.headers['Cache-Control'])
        cookie=response.headers['Set-Cookie']
        for flag in ('HttpOnly','Secure','SameSite=Lax'):
            self.assertIn(flag,cookie)

    def test_existing_shared_profile_is_preserved_but_never_served(self):
        with closing(sqlite3.connect(app.config['DATABASE'])) as c, c:
            c.execute('CREATE TABLE settings (id INTEGER PRIMARY KEY, data TEXT)')
            c.execute('INSERT INTO settings VALUES (1,?)',(json.dumps({'name':'Старый общий профиль'}),))
        initialize()
        self.assertEqual(self.client.get('/api/state').json['settings']['name'],'')
        with closing(sqlite3.connect(app.config['DATABASE'])) as c, c:
            self.assertEqual(json.loads(c.execute('SELECT data FROM settings').fetchone()[0])['name'],'Старый общий профиль')

    def test_profile_survives_reinitialization_and_invalid_cookie_is_replaced(self):
        self.client.post('/api/settings',json={'name':'Мой профиль'})
        initialize()
        self.assertEqual(self.client.get('/api/state').json['settings']['name'],'Мой профиль')
        other=app.test_client()
        other.set_cookie('qadam_browser','0'*64)
        response=other.get('/api/state')
        self.assertEqual(response.json['settings']['name'],'')
        self.assertIn('Set-Cookie',response.headers)


if __name__ == '__main__':
    unittest.main()
