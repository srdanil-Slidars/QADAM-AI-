"""Qadam AI local, single-user competition prototype."""
import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import date
from pathlib import Path
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
app.config['DATABASE'] = os.environ.get('QADAM_DATABASE', str(Path(__file__).with_name('qadam.sqlite3')))

@contextmanager
def db():
    connection = sqlite3.connect(app.config['DATABASE'])
    connection.row_factory = sqlite3.Row
    try:
        with connection:
            yield connection
    finally:
        connection.close()

def initialize():
    with db() as c:
        c.executescript('''CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS checkins (id INTEGER PRIMARY KEY, day TEXT NOT NULL UNIQUE, mood INTEGER, stress INTEGER, note TEXT);
        CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY, title TEXT NOT NULL, category TEXT, done INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, role TEXT, text TEXT);
        CREATE TABLE IF NOT EXISTS support (id INTEGER PRIMARY KEY, day TEXT, text TEXT);''')
        if not c.execute('SELECT 1 FROM settings').fetchone():
            c.execute('INSERT INTO settings VALUES (1, ?)', (json.dumps({'name':'Студент','university':'Мой университет','group':'Первый курс','theme':'light'}, ensure_ascii=False),))
            c.executemany('INSERT INTO tasks (title, category) VALUES (?, ?)', [('Составить план на учебную неделю','Учёба'),('Познакомиться с одним одногруппником','Общение'),('Выделить 20 минут на отдых','Самочувствие')])

@app.get('/')
def index():
    return render_template('index.html')

@app.get('/api/state')
def state():
    with db() as c:
        result = {'settings':json.loads(c.execute('SELECT data FROM settings WHERE id=1').fetchone()[0])}
        for table in ('checkins','tasks','messages','support'):
            result[table] = [dict(row) for row in c.execute(f'SELECT * FROM {table} ORDER BY id')]
    return jsonify(result)

@app.post('/api/settings')
def settings():
    data = request.get_json(silent=True) or {}
    with db() as c:
        current = json.loads(c.execute('SELECT data FROM settings WHERE id=1').fetchone()[0])
        for key in ('name','university','group','theme','faculty','specialty','course','phone','email'):
            if key in data and isinstance(data[key], str):
                current[key] = data[key].strip()[:100]
        if current['theme'] not in ('light','dark'): current['theme']='light'
        c.execute('UPDATE settings SET data=? WHERE id=1', (json.dumps(current, ensure_ascii=False),))
    return jsonify(ok=True)

@app.post('/api/checkins')
def checkin():
    data=request.get_json(silent=True) or {}
    try:
        mood,stress=int(data['mood']),int(data['stress'])
        if not 1 <= mood <= 5 or not 1 <= stress <= 5: raise ValueError()
    except (KeyError,ValueError,TypeError): return jsonify(error='Выберите настроение и стресс от 1 до 5.'),400
    with db() as c:
        c.execute('INSERT INTO checkins (day,mood,stress,note) VALUES (?,?,?,?) ON CONFLICT(day) DO UPDATE SET mood=excluded.mood,stress=excluded.stress,note=excluded.note', (date.today().isoformat(),mood,stress,str(data.get('note',''))[:2000]))
    return jsonify(ok=True)

@app.post('/api/tasks')
def add_task():
    data=request.get_json(silent=True) or {}
    title=str(data.get('title','')).strip()
    if not title or len(title)>200: return jsonify(error='Введите задачу до 200 символов.'),400
    with db() as c: c.execute('INSERT INTO tasks (title,category) VALUES (?,?)',(title,'Моя задача'))
    return jsonify(ok=True)

@app.patch('/api/tasks/<int:task_id>')
def toggle_task(task_id):
    with db() as c:
        cursor=c.execute('UPDATE tasks SET done=1-done WHERE id=?',(task_id,))
    return (jsonify(ok=True),200) if cursor.rowcount else (jsonify(error='Задача не найдена'),404)

def demo_reply(text):
    t=text.lower()
    if any(word in t for word in ('суицид','убить себя','самоубий','навредить себе')):
        return 'Спасибо, что рассказал об этом. Сейчас важнее всего твоя безопасность. Если есть непосредственная опасность, обратись в местную экстренную службу или ближайшее отделение неотложной помощи. По возможности свяжись с человеком, которому доверяешь, и попроси его побыть рядом. Этот демонстрационный чат не отслеживается специалистами. Ты можешь также открыть раздел «Поддержка».'
    if any(word in t for word in ('стресс','устал','тревог','тяжело','пережива')):
        return 'Похоже, сейчас на тебя многое навалилось. Попробуй выбрать одну небольшую задачу, которую реально выполнить сегодня, и запланировать перерыв. Что сейчас беспокоит больше всего: учёба, общение или что-то другое? Если трудности сохраняются, стоит обсудить их с психологом или куратором.'
    if any(word in t for word in ('друг','одинок','общен','групп','познаком')):
        return 'Начать общение бывает непросто. Небольшой шаг на сегодня: спросить одногруппника о ближайшем задании или предложить вместе подготовиться к паре. Не обязательно сразу знакомиться со всеми. Какой формат общения тебе комфортнее?'
    if any(word in t for word in ('учеб','учёб','дедлайн','задан','экзамен','план','успева')):
        return 'Давай разложим нагрузку на шаги: выпиши ближайшие сроки, выбери самое срочное задание и выдели на первый этап 25 минут. Добавь этот шаг в «Мой план». Какие задания и сроки у тебя сейчас?'
    return 'Давай начнём с того, что сейчас важнее всего для тебя: учебная нагрузка, самочувствие или общение? Опиши конкретную ситуацию. В этом прототипе я отвечаю по демонстрационным сценариям; обученная нейросеть пока не подключена.'

@app.post('/api/chat')
def chat():
    text=str((request.get_json(silent=True) or {}).get('text','')).strip()
    if not text or len(text)>2000: return jsonify(error='Сообщение должно содержать от 1 до 2000 символов.'),400
    reply=demo_reply(text)
    with db() as c: c.executemany('INSERT INTO messages (role,text) VALUES (?,?)',[('user',text),('assistant',reply)])
    return jsonify(reply=reply)

@app.post('/api/support')
def support():
    data=request.get_json(silent=True) or {}
    if data.get('consent') is not True: return jsonify(error='Подтвердите сохранение обращения.'),400
    text=str(data.get('text','')).strip()
    if not text or len(text)>2000: return jsonify(error='Опишите обращение: до 2000 символов.'),400
    with db() as c: c.execute('INSERT INTO support (day,text) VALUES (?,?)',(date.today().isoformat(),text))
    return jsonify(ok=True)

initialize()
if __name__ == '__main__':
    app.run(host='127.0.0.1',port=5000,debug=False)
