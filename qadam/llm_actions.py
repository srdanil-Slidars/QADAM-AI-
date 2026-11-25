"""Capability boundary: validated proposals, explicit confirmation, atomic execution."""
import json
import secrets
import time
from flask import Blueprint, g, jsonify, request
from .db import db

actions=Blueprint('llm_actions',__name__,url_prefix='/api/ai/actions')
KINDS={'add_task','complete_task','save_draft','send_request','reply_request','set_request_status'}
FIELDS={'add_task':{'title'},'complete_task':{'task_id'},'save_draft':{'text'},'send_request':{'text'},'reply_request':{'request_id','text'},'set_request_status':{'request_id','status'}}
LABELS={'add_task':'Добавить в план','complete_task':'Завершить задачу','save_draft':'Сохранить черновик','send_request':'Отправить куратору','reply_request':'Отправить ответ','set_request_status':'Изменить статус'}

def validate(c,kind,args,profile_id,user):
    if not isinstance(kind,str) or kind not in KINDS or not isinstance(args,dict) or set(args)!=FIELDS[kind]:
        raise ValueError('Недопустимое действие помощника.')
    if 'text' in args and (not isinstance(args['text'],str) or not 1<=len(args['text'].strip())<=2000):
        raise ValueError('Недопустимый текст действия.')
    if kind=='add_task' and (not isinstance(args['title'],str) or not 1<=len(args['title'].strip())<=200):
        raise ValueError('Недопустимое название задачи.')
    if kind=='complete_task':
        if type(args['task_id']) is not int or not c.execute('SELECT 1 FROM browser_tasks WHERE id=? AND profile_id=?',(args['task_id'],profile_id)).fetchone():
            raise ValueError('Задача не найдена в твоём плане.')
    if kind=='send_request':
        if user is None or user['role']!='student' or not c.execute('SELECT 1 FROM memberships WHERE student_id=?',(user['id'],)).fetchone():
            raise ValueError('Для отправки нужен вход студента и вступление в группу.')
    if kind in ('reply_request','set_request_status'):
        if user is None or type(args['request_id']) is not int:
            raise ValueError('Обращение недоступно.')
        row=c.execute('SELECT 1 FROM requests WHERE id=? AND (student_id=? OR curator_id=?)',(args['request_id'],user['id'],user['id'])).fetchone()
        if not row:raise ValueError('Обращение недоступно.')
        if kind=='set_request_status' and (user['role']!='curator' or args['status'] not in ('new','in_progress','resolved')):
            raise ValueError('Менять статус может только куратор обращения.')

def propose(proposals,profile_id,user):
    pending=[]
    with db() as c:
        for proposal in proposals[:3]:
            if not isinstance(proposal,dict):continue
            kind,args=proposal.get('kind'),proposal.get('arguments')
            try:validate(c,kind,args,profile_id,user)
            except ValueError:continue
            args=dict(args)
            if kind=='send_request':
                args['_recipient_group']=c.execute('SELECT group_id FROM memberships WHERE student_id=?',(user['id'],)).fetchone()[0]
            action_id=secrets.token_hex(16)
            c.execute('INSERT INTO ai_actions(id,profile_id,user_id,kind,arguments,expires_at) VALUES (?,?,?,?,?,?)',
                      (action_id,profile_id,user['id'] if user else None,kind,json.dumps(args,ensure_ascii=False),time.time()+900))
            pending.append({'id':action_id,'kind':kind,'label':LABELS[kind],'arguments':{k:v for k,v in args.items() if not k.startswith('_')},'status':'pending'})
    return pending

def list_pending(profile_id):
    with db() as c:
        rows=c.execute("SELECT id,kind,arguments,status FROM ai_actions WHERE profile_id=? AND status='pending' AND expires_at>? ORDER BY rowid DESC LIMIT 6",(profile_id,time.time())).fetchall()
    return [{'id':r['id'],'kind':r['kind'],'label':LABELS[r['kind']],'arguments':{k:v for k,v in json.loads(r['arguments']).items() if not k.startswith('_')},'status':r['status']} for r in rows]

@actions.post('/<action_id>/confirm')
def confirm(action_id):
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        row=c.execute('SELECT * FROM ai_actions WHERE id=? AND profile_id=?',(action_id,g.profile_id)).fetchone()
        if not row:return jsonify(error='Действие не найдено.'),404
        if row['status']=='executed':return jsonify(ok=True,already_executed=True)
        if row['status']!='pending' or row['expires_at']<time.time():return jsonify(error='Действие отменено или устарело. Попроси помощника предложить его заново.'),409
        if row['user_id']!=(g.user['id'] if g.user else None):return jsonify(error='После смены аккаунта нужно создать новое действие.'),403
        kind,args=row['kind'],json.loads(row['arguments'])
        expected_group=args.pop('_recipient_group',None)
        try:validate(c,kind,args,g.profile_id,g.user)
        except ValueError as e:return jsonify(error=str(e)),403
        if kind=='send_request':
            actual_group=c.execute('SELECT group_id FROM memberships WHERE student_id=?',(g.user['id'],)).fetchone()[0]
            if actual_group!=expected_group:return jsonify(error='Группа изменилась. Создай новое предложение для текущего куратора.'),409
        if kind=='add_task':c.execute('INSERT INTO browser_tasks(profile_id,title,category) VALUES (?,?,?)',(g.profile_id,args['title'],'Из разговора с AI'))
        elif kind=='complete_task':c.execute('UPDATE browser_tasks SET done=1 WHERE id=? AND profile_id=?',(args['task_id'],g.profile_id))
        elif kind=='save_draft':c.execute('INSERT INTO browser_support(profile_id,day,text) VALUES (?,date(\'now\'),?)',(g.profile_id,args['text']))
        elif kind=='send_request':
            group=c.execute('SELECT cg.* FROM memberships m JOIN campus_groups cg ON cg.id=m.group_id WHERE m.student_id=?',(g.user['id'],)).fetchone()
            c.execute('INSERT INTO requests(student_id,curator_id,group_id,text) VALUES (?,?,?,?)',(g.user['id'],group['curator_id'],group['id'],args['text']))
        elif kind=='reply_request':c.execute('INSERT INTO request_replies(request_id,author_id,text) VALUES (?,?,?)',(args['request_id'],g.user['id'],args['text']))
        elif kind=='set_request_status':c.execute('UPDATE requests SET status=? WHERE id=? AND curator_id=?',(args['status'],args['request_id'],g.user['id']))
        c.execute("UPDATE ai_actions SET status='executed' WHERE id=?",(action_id,))
        c.execute('INSERT INTO ai_audit(profile_id,action_id,kind) VALUES (?,?,?)',(g.profile_id,action_id,kind))
        c.execute('INSERT INTO browser_messages(profile_id,role,text) VALUES (?,?,?)',(g.profile_id,'assistant','Подтверждённое действие выполнено: '+LABELS[kind]+'.'))
    return jsonify(ok=True)

@actions.post('/<action_id>/cancel')
def cancel(action_id):
    with db() as c:c.execute("UPDATE ai_actions SET status='cancelled' WHERE id=? AND profile_id=? AND status='pending'",(action_id,g.profile_id))
    return jsonify(ok=True)
