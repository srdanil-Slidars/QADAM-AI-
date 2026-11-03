import tempfile
import unittest
from pathlib import Path
from app import app, initialize


class AppTests(unittest.TestCase):
    def setUp(self):
        temp_root = Path(__file__).resolve().parents[1] / 'tmp'
        temp_root.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=temp_root)
        app.config.update(TESTING=True, DATABASE=str(Path(self.temp.name) / 'test.sqlite3'))
        initialize()
        self.client = app.test_client()

    def tearDown(self):
        self.temp.cleanup()

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
        self.client.patch(f"/api/tasks/{task['id']}")
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
        self.assertEqual(self.client.patch('/api/tasks/99999').status_code,404)

    def test_chat_and_support_are_explicitly_local(self):
        response=self.client.post('/api/chat',json={'text':'Не успеваю выполнять задания'})
        self.assertIn('шаги',response.json['reply'])
        self.assertEqual(len(self.client.get('/api/state').json['messages']),2)
        self.assertEqual(self.client.post('/api/support',json={'text':'Нужна помощь'}).status_code,400)
        self.client.post('/api/support',json={'text':'Нужна помощь','consent':True})
        self.assertEqual(len(self.client.get('/api/state').json['support']),1)
        self.assertEqual(self.client.get('/').status_code,200)


if __name__ == '__main__':
    unittest.main()
