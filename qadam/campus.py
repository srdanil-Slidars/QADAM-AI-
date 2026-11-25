"""Student-to-curator workflow with explicit data sharing."""
import json
import secrets
from flask import Blueprint, g, jsonify, request
from .accounts import require_user
from .db import db

campus=Blueprint('campus',__name__,url_prefix='/api')

def membership_info():
    if g.user is None:
        return None
    with db() as c:
        if g.user['role']=='curator':
            row=c.execute('SELECT id,name,university,invite_code FROM campus_groups WHERE curator_id=?',(g.user['id'],)).fetchone()
        else:
            row=c.execute('SELECT cg.id,cg.name,cg.university,m.share_checkins FROM memberships m JOIN campus_groups cg ON cg.id=m.group_id WHERE m.student_id=?',(g.user['id'],)).fetchone()
    return dict(row) if row else None

@campus.post('/membership')
@require_user('student')
def join_group():
    data=request.get_json()
    code=str(data.get('code','')).strip().upper()
    if data.get('consent') is not True:
        return jsonify(error='Подтверди передачу имени куратору при вступлении в группу.'),400
    with db() as c:
        group=c.execute('SELECT * FROM campus_groups WHERE invite_code=?',(code,)).fetchone()
        if not group:
            return jsonify(error='Группа с таким кодом не найдена.'),404
        c.execute('INSERT INTO memberships VALUES (?,?,?) ON CONFLICT(student_id) DO UPDATE SET group_id=excluded.group_id,share_checkins=excluded.share_checkins',
                  (g.user['id'],group['id'],int(data.get('share_checkins') is True)))
    return jsonify(ok=True)

@campus.delete('/membership')
@require_user('student')
def leave_group():
    with db() as c:
        c.execute('DELETE FROM memberships WHERE student_id=?',(g.user['id'],))
    return jsonify(ok=True)

@campus.patch('/membership')
@require_user('student')
def sharing():
    with db() as c:
        c.execute('UPDATE memberships SET share_checkins=? WHERE student_id=?',
                  (int(request.get_json().get('share_checkins') is True),g.user['id']))
    return jsonify(ok=True)

@campus.get('/curator')
@require_user('curator')
def curator_state():
    with db() as c:
        group=c.execute('SELECT * FROM campus_groups WHERE curator_id=?',(g.user['id'],)).fetchone()
        students=[]
        for row in c.execute('SELECT u.id,u.profile_id,p.data,m.share_checkins FROM users u JOIN memberships m ON m.student_id=u.id JOIN browser_profiles p ON p.id=u.profile_id WHERE m.group_id=?',(group['id'],)).fetchall():
            profile=json.loads(row['data'])
            student={'id':row['id'],'name':profile.get('name') or 'Студент','group':profile.get('group',''),'share_checkins':bool(row['share_checkins'])}
            # Never expose private note text, conversation, contacts or bearer tokens.
            if row['share_checkins']:
                latest=c.execute('SELECT day,mood,stress FROM browser_checkins WHERE profile_id=? ORDER BY day DESC LIMIT 1',(row['profile_id'],)).fetchone()
                student['checkin']=dict(latest) if latest else None
            students.append(student)
        resources=[dict(r) for r in c.execute('SELECT id,title,body FROM campus_resources WHERE group_id=? ORDER BY id',(group['id'],))]
    return jsonify(group=dict(group),students=students,resources=resources)

@campus.post('/curator/group')
@require_user('curator')
def update_group():
    data=request.get_json()
    name=str(data.get('name','')).strip()[:100]
    university=str(data.get('university','')).strip()[:100]
    if not name or not university:
        return jsonify(error='Укажи университет и название группы.'),400
    with db() as c:
        c.execute('UPDATE campus_groups SET name=?,university=? WHERE curator_id=?',(name,university,g.user['id']))
    return jsonify(ok=True)

@campus.post('/curator/invite')
@require_user('curator')
def rotate_invite():
    with db() as c:
        c.execute('UPDATE campus_groups SET invite_code=? WHERE curator_id=?',(secrets.token_hex(5).upper(),g.user['id']))
    return jsonify(ok=True)

@campus.post('/curator/resources')
@require_user('curator')
def add_resource():
    data=request.get_json()
    title=str(data.get('title','')).strip()
    body=str(data.get('body','')).strip()
    if not title or len(title)>120 or not body or len(body)>4000:
        return jsonify(error='Нужны заголовок до 120 и текст до 4000 символов.'),400
    with db() as c:
        group=c.execute('SELECT id FROM campus_groups WHERE curator_id=?',(g.user['id'],)).fetchone()
        c.execute('INSERT INTO campus_resources(group_id,title,body) VALUES (?,?,?)',(group['id'],title,body))
    return jsonify(ok=True)

def request_access(c,request_id):
    row=c.execute('SELECT * FROM requests WHERE id=? AND (student_id=? OR curator_id=?)',(request_id,g.user['id'],g.user['id'])).fetchone()
    return row

@campus.get('/requests')
@require_user()
def get_requests():
    with db() as c:
        rows=c.execute('SELECT r.*, p.data AS student_profile FROM requests r JOIN users u ON u.id=r.student_id JOIN browser_profiles p ON p.id=u.profile_id WHERE r.student_id=? OR r.curator_id=? ORDER BY r.id DESC',(g.user['id'],g.user['id'])).fetchall()
        records=[]
        for row in rows:
            item=dict(row)
            item['student_name']=json.loads(item.pop('student_profile')).get('name') or 'Студент'
            item['replies']=[dict(r) for r in c.execute('SELECT rr.id,rr.text,rr.created_at,u.role FROM request_replies rr JOIN users u ON u.id=rr.author_id WHERE request_id=? ORDER BY rr.id',(row['id'],))]
            records.append(item)
    return jsonify(requests=records)

@campus.post('/requests')
@require_user('student')
def send_request():
    data=request.get_json()
    text=str(data.get('text','')).strip()
    if data.get('consent') is not True or not text or len(text)>2000:
        return jsonify(error='Опиши ситуацию и подтверди отправку куратору.'),400
    with db() as c:
        group=c.execute('SELECT cg.* FROM memberships m JOIN campus_groups cg ON cg.id=m.group_id WHERE m.student_id=?',(g.user['id'],)).fetchone()
        if not group:
            return jsonify(error='Сначала присоединись к группе по коду куратора.'),400
        c.execute('INSERT INTO requests(student_id,curator_id,group_id,text) VALUES (?,?,?,?)',(g.user['id'],group['curator_id'],group['id'],text))
    return jsonify(ok=True),201

@campus.post('/requests/<int:request_id>/reply')
@require_user()
def reply_to_request(request_id):
    text=str(request.get_json().get('text','')).strip()
    if not text or len(text)>2000:
        return jsonify(error='Ответ должен содержать от 1 до 2000 символов.'),400
    with db() as c:
        row=request_access(c,request_id)
        if not row:
            return jsonify(error='Обращение не найдено.'),404
        c.execute('INSERT INTO request_replies(request_id,author_id,text) VALUES (?,?,?)',(request_id,g.user['id'],text))
    return jsonify(ok=True)

@campus.patch('/requests/<int:request_id>')
@require_user('curator')
def request_status(request_id):
    status=request.get_json().get('status')
    if status not in ('new','in_progress','resolved'):
        return jsonify(error='Недопустимый статус.'),400
    with db() as c:
        row=c.execute('UPDATE requests SET status=? WHERE id=? AND curator_id=?',(status,request_id,g.user['id']))
    return (jsonify(ok=True),200) if row.rowcount else (jsonify(error='Обращение не найдено.'),404)
