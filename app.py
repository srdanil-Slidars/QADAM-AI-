"""Qadam AI competition prototype with browser-scoped profiles."""
import json
import os
import secrets
from datetime import date
from pathlib import Path
from flask import Flask, g, jsonify, render_template, request
from qadam.db import db, initialize as initialize_db
from qadam.accounts import configure_accounts, public_user
from qadam.llm import respond, info as ai_info, AIUnavailable
from qadam.llm_actions import actions, list_pending

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 65536
app.config['DATABASE'] = os.environ.get('QADAM_DATABASE', str(Path(__file__).with_name('qadam.sqlite3')))

configure_accounts(app)

def initialize():
    with app.app_context():
        initialize_db()

@app.before_request
def identify_browser():
    if not request.path.startswith('/api/'):
        return
    if g.user is not None:
        g.profile_id = g.user['profile_id']
        return
    token = request.cookies.get('qadam_browser', '')
    with db() as c:
        existing = c.execute('SELECT p.id FROM browser_profiles p LEFT JOIN users u ON u.profile_id=p.id WHERE p.id=? AND u.id IS NULL', (token,)).fetchone() if len(token) == 64 else None
        if existing:
            g.profile_id = existing['id']
            return
        g.profile_id = secrets.token_hex(32)
        g.new_profile = True
        defaults = {'name':'','university':'','group':'','theme':'light'}
        c.execute('INSERT INTO browser_profiles VALUES (?, ?)', (g.profile_id, json.dumps(defaults)))
        c.executemany('INSERT INTO browser_tasks (profile_id,title,category) VALUES (?,?,?)', [
            (g.profile_id,'Составить план на учебную неделю','Учёба'),
            (g.profile_id,'Познакомиться с одним одногруппником','Общение'),
            (g.profile_id,'Выделить 20 минут на отдых','Самочувствие')])

@app.after_request
def protect_browser_data(response):
    if request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'private, no-store'
        if getattr(g, 'new_profile', False):
            response.set_cookie('qadam_browser', g.profile_id, max_age=365*24*60*60,
                                httponly=True, secure=request.is_secure or app.config['SESSION_COOKIE_SECURE'], samesite='Lax')
    return response

@app.get('/')
def index():
    return render_template('index.html')

@app.get('/api/state')
def state():
    with db() as c:
        result = {'settings':json.loads(c.execute('SELECT data FROM browser_profiles WHERE id=?', (g.profile_id,)).fetchone()[0]), 'today':date.today().isoformat(), 'user':public_user(g.user)}
        fields = {'checkins':'id,day,mood,stress,note', 'tasks':'id,title,category,done',
                  'messages':'id,role,text', 'support':'id,day,text'}
        for table, columns in fields.items():
            result[table] = [dict(row) for row in c.execute(f'SELECT {columns} FROM browser_{table} WHERE profile_id=? ORDER BY id', (g.profile_id,))]
    from qadam.campus import membership_info
    result['membership'] = membership_info()
    result['ai']=ai_info()
    result['ai_actions']=list_pending(g.profile_id)
    return jsonify(result)

@app.post('/api/settings')
def settings():
    data = request.get_json(silent=True) or {}
    with db() as c:
        current = json.loads(c.execute('SELECT data FROM browser_profiles WHERE id=?', (g.profile_id,)).fetchone()[0])
        for key in ('name','university','group','theme','faculty','specialty','course','phone','email'):
            if key in data and isinstance(data[key], str):
                current[key] = data[key].strip()[:100]
        if type(data.get('ai_cloud_consent')) is bool:current['ai_cloud_consent']=data['ai_cloud_consent']
        if current['theme'] not in ('light','dark'): current['theme']='light'
        c.execute('UPDATE browser_profiles SET data=? WHERE id=?', (json.dumps(current, ensure_ascii=False),g.profile_id))
    return jsonify(ok=True)

@app.post('/api/checkins')
def checkin():
    data=request.get_json(silent=True) or {}
    try:
        mood,stress=int(data['mood']),int(data['stress'])
        if not 1 <= mood <= 5 or not 1 <= stress <= 5: raise ValueError()
    except (KeyError,ValueError,TypeError): return jsonify(error='Выберите настроение и стресс от 1 до 5.'),400
    with db() as c:
        c.execute('INSERT INTO browser_checkins (profile_id,day,mood,stress,note) VALUES (?,?,?,?,?) ON CONFLICT(profile_id,day) DO UPDATE SET mood=excluded.mood,stress=excluded.stress,note=excluded.note', (g.profile_id,date.today().isoformat(),mood,stress,str(data.get('note',''))[:2000]))
    return jsonify(ok=True)

@app.post('/api/tasks')
def add_task():
    data=request.get_json(silent=True) or {}
    title=str(data.get('title','')).strip()
    if not title or len(title)>200: return jsonify(error='Введите задачу до 200 символов.'),400
    with db() as c: c.execute('INSERT INTO browser_tasks (profile_id,title,category) VALUES (?,?,?)',(g.profile_id,title,'Моя задача'))
    return jsonify(ok=True)

@app.patch('/api/tasks/<int:task_id>')
def toggle_task(task_id):
    with db() as c:
        cursor=c.execute('UPDATE browser_tasks SET done=1-done WHERE id=? AND profile_id=?',(task_id,g.profile_id))
    return (jsonify(ok=True),200) if cursor.rowcount else (jsonify(error='Задача не найдена'),404)

@app.post('/api/chat')
def chat():
    text=str((request.get_json(silent=True) or {}).get('text','')).strip()
    if not text or len(text)>2000: return jsonify(error='Сообщение должно содержать от 1 до 2000 символов.'),400
    try:
        result=respond(text,g.profile_id,g.user)
    except AIUnavailable as error:
        return jsonify(error=str(error)),503
    except (OSError,ValueError,KeyError):
        app.logger.exception('Integrated assistant could not load its model or knowledge')
        return jsonify(error='Помощник временно недоступен. Попробуй позже.'),503
    reply=result['reply']
    if result.get('sources'):
        reply+='\n\nОснова ответа: '+', '.join(item['title'] for item in result['sources'])
        result['reply']=reply
    with db() as c: c.executemany('INSERT INTO browser_messages (profile_id,role,text) VALUES (?,?,?)',[(g.profile_id,'user',text),(g.profile_id,'assistant',reply)])
    return jsonify(result)

@app.post('/api/support')
def support():
    data=request.get_json(silent=True) or {}
    if data.get('consent') is not True: return jsonify(error='Подтвердите сохранение обращения.'),400
    text=str(data.get('text','')).strip()
    if not text or len(text)>2000: return jsonify(error='Опишите обращение: до 2000 символов.'),400
    with db() as c: c.execute('INSERT INTO browser_support (profile_id,day,text) VALUES (?,?,?)',(g.profile_id,date.today().isoformat(),text))
    return jsonify(ok=True)

from qadam.campus import campus
app.register_blueprint(campus)
app.register_blueprint(actions)

initialize()
if __name__ == '__main__':
    from qadam.local_runtime import run_with_model
    run_with_model(app)
