"""Local accounts. Passwords are hashed, roles never come from profile edits."""
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import time
from functools import wraps
from flask import Blueprint, g, jsonify, request, session
from werkzeug.security import generate_password_hash, check_password_hash
from .db import db

accounts = Blueprint('accounts', __name__, url_prefix='/api/auth')

def public_user(user):
    return {k:user[k] for k in ('id','email','role')} if user is not None else None

def require_user(role=None):
    def decorator(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            if g.user is None:
                return jsonify(error='Сначала войди в аккаунт.'),401
            if role and g.user['role'] != role:
                return jsonify(error='Этот раздел недоступен для твоей роли.'),403
            return fn(*args, **kwargs)
        return wrapped
    return decorator

def configure_accounts(app):
    key = os.environ.get('QADAM_SECRET_KEY')
    if not key:
        folder = Path(app.root_path) / 'instance'
        folder.mkdir(exist_ok=True)
        filename = folder / 'session.key'
        try:
            with filename.open('x') as f:
                f.write(secrets.token_hex(32))
            filename.chmod(0o600)
        except FileExistsError:
            pass
        key = filename.read_text().strip()
    app.secret_key = key
    app.config.update(SESSION_COOKIE_NAME='qadam_session',SESSION_COOKIE_HTTPONLY=True,
                      SESSION_COOKIE_SAMESITE='Lax',SESSION_COOKIE_SECURE=os.environ.get('QADAM_COOKIE_SECURE')=='1')
    @app.before_request
    def load_user():
        g.user = None
        if not request.path.startswith('/api/'):
            return
        if request.method not in ('GET','HEAD','OPTIONS'):
            origin = request.headers.get('Origin')
            if origin and origin.rstrip('/') != request.host_url.rstrip('/'):
                return jsonify(error='Недопустимый источник запроса.'),403
            if not request.is_json:
                return jsonify(error='Ожидаются данные JSON.'),415
            if request.content_length and not isinstance(request.get_json(silent=True), dict):
                return jsonify(error='Ожидается объект JSON.'),400
        user_id = session.get('user_id')
        if user_id:
            with db() as c:
                g.user = c.execute('SELECT id,email,role,profile_id FROM users WHERE id=?',(user_id,)).fetchone()
            if g.user is None:
                session.clear()
    app.register_blueprint(accounts)

@accounts.post('/register')
def register():
    if g.user is not None:
        return jsonify(error='Сначала выйди из текущего аккаунта.'),409
    data = request.get_json()
    email = str(data.get('email','')).strip().lower()
    password = str(data.get('password',''))
    role = data.get('role','student')
    name = str(data.get('name','')).strip()[:100]
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email) or len(email)>254:
        return jsonify(error='Укажи корректную почту.'),400
    if not 10<=len(password)<=128:
        return jsonify(error='Пароль должен содержать от 10 до 128 символов.'),400
    if role not in ('student','curator') or not name:
        return jsonify(error='Укажи имя и выбери роль.'),400
    with db() as c:
        if c.execute('SELECT 1 FROM users WHERE email=?',(email,)).fetchone():
            return jsonify(error='Аккаунт с этой почтой уже существует.'),409
        c.execute('INSERT INTO users(email,password_hash,role,profile_id) VALUES (?,?,?,?)',
                  (email,generate_password_hash(password),role,g.profile_id))
        user_id=c.execute('SELECT last_insert_rowid()').fetchone()[0]
        profile=json.loads(c.execute('SELECT data FROM browser_profiles WHERE id=?',(g.profile_id,)).fetchone()[0])
        profile.update(name=name,email=email)
        if role=='curator':
            profile.update(university=str(data.get('university','Мой университет'))[:100],group=str(data.get('group','Моя группа'))[:100])
        c.execute('UPDATE browser_profiles SET data=? WHERE id=?',(json.dumps(profile,ensure_ascii=False),g.profile_id))
        if role=='curator':
            c.execute('INSERT INTO campus_groups(curator_id,name,university,invite_code) VALUES (?,?,?,?)',
                      (user_id,str(data.get('group','Моя группа'))[:100],str(data.get('university','Мой университет'))[:100],secrets.token_hex(5).upper()))
    session.clear()
    session['user_id']=user_id
    return jsonify(ok=True),201

@accounts.post('/login')
def login():
    data=request.get_json()
    email=str(data.get('email','')).strip().lower()
    password=str(data.get('password',''))
    if len(password)>128 or len(email)>254:
        return jsonify(error='Неверная почта или пароль.'),401
    key=hashlib.sha256((str(request.remote_addr)+'|'+email).encode()).hexdigest()
    now=time.time()
    with db() as c:
        attempt=c.execute('SELECT * FROM login_attempts WHERE key=?',(key,)).fetchone()
        if attempt and attempt['reset_at']>now and attempt['attempts']>=8:
            return jsonify(error='Слишком много попыток. Повтори через 15 минут.'),429
        user=c.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
        if not user or not check_password_hash(user['password_hash'],password):
            count=attempt['attempts']+1 if attempt and attempt['reset_at']>now else 1
            reset=attempt['reset_at'] if attempt and attempt['reset_at']>now else now+900
            c.execute('INSERT INTO login_attempts VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET attempts=excluded.attempts,reset_at=excluded.reset_at',(key,count,reset))
            return jsonify(error='Неверная почта или пароль.'),401
        c.execute('DELETE FROM login_attempts WHERE key=?',(key,))
    session.clear()
    session['user_id']=user['id']
    return jsonify(ok=True)

@accounts.post('/logout')
def logout():
    session.clear()
    response=jsonify(ok=True)
    response.delete_cookie('qadam_browser')
    g.new_profile=False
    return response
