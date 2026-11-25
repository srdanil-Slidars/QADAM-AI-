"""Integrated assistant: neural routing, retrieval and strictly scoped actions."""
import re
from .db import db
from .neural import classify

KNOWLEDGE={
 'study':{'title':'Планирование учебной нагрузки','text':'Давай разложим нагрузку на шаги. Выпиши ближайшие сроки, выбери одно срочное задание и определи первый посильный этап. Оставь место для перерыва. Если сроки пересекаются, уточни приоритеты у преподавателя или куратора. Какое задание нужно сделать первым?'},
 'social':{'title':'Общение в новой группе','text':'Можно начать с небольшого контакта: спросить одногруппника о задании или предложить подготовиться вместе. Выбери мероприятие или клуб по интересам. Знакомство не обязано происходить быстро. Какой способ начать разговор тебе комфортнее?'},
 'wellbeing':{'title':'Забота о себе в период адаптации','text':'Попробуй назвать, что сейчас больше всего отнимает силы, и выбрать одну небольшую задачу на сегодня. Запланируй перерыв. Если трудности сохраняются или мешают повседневной жизни, обсуди их с психологом. Я не ставлю диагнозы. Что сейчас беспокоит сильнее всего?'},
 'support':{'title':'Обращение за поддержкой','text':'В разделе «Поддержка» можно подготовить обращение. После входа и присоединения к группе по коду куратора его можно отправить в кабинет куратора. Текст увидят только участники обращения. Личная переписка со мной куратору не передаётся.'},
 'general':{'title':'Возможности Qadam AI','text':'Я помогаю с учебным планом, общением и поиском поддержки. Могу показать твои задачи или добавить задачу по команде «Добавь в план: ...». Напиши, что сейчас нужно: разобраться с нагрузкой, обсудить состояние или найти помощь человека.'}
}

def words(text):
    return {w[:6] for w in re.findall(r'[а-яёa-z]+',text.lower()) if len(w)>3 and w not in ('когда','можно','нужно','пожалуйста','какой','какие','сегодня')}

def respond(text,profile_id,user):
    lower=text.lower().replace('ё','е')
    if any(part in lower for part in ('суицид','убить себя','самоубий','навредить себе','покончить с собой')):
        return {'reply':'Спасибо, что рассказал об этом. Если есть непосредственная опасность, обратись в местную экстренную службу или ближайшее отделение неотложной помощи. По возможности свяжись с человеком, которому доверяешь, и попроси его побыть рядом. Специалисты не отслеживают этот чат. Помощник не может заменить экстренную помощь.','topic':'safety','sources':[]}
    added=re.match(r'^(?:пожалуйста[, ]+)?(?:добавь|запиши|создай)(?: мне)?(?: задачу| в план| шаг)?\s*[:\-]?\s+(.+)$',text,re.I)
    if added:
        title=added.group(1).strip()[:200]
        with db() as c:c.execute('INSERT INTO browser_tasks(profile_id,title,category) VALUES (?,?,?)',(profile_id,title,'Из разговора с AI'))
        return {'reply':f'Добавил в твой план: «{title}». Задача уже доступна в разделе «План».','topic':'action','sources':[]}
    if re.search(r'мо[йи] план|мои задачи|сколько задач|покажи.{0,10}задач',lower):
        with db() as c:tasks=c.execute('SELECT title FROM browser_tasks WHERE profile_id=? AND done=0 ORDER BY id LIMIT 8',(profile_id,)).fetchall()
        reply='Ближайшие незавершённые задачи:\n'+'\n'.join(f'{i+1}. {row[0]}' for i,row in enumerate(tasks)) if tasks else 'В твоём плане сейчас нет незавершённых задач. Могу добавить следующую: напиши «Добавь в план: ...».'
        return {'reply':reply,'topic':'plan','sources':[]}
    complete=re.match(r'^(?:заверши|выполни|отметь выполненной) задачу\s*[:\-]?\s+(.+)$',text,re.I)
    if complete:
        title=complete.group(1).strip()
        with db() as c:
            rows=c.execute('SELECT id,title FROM browser_tasks WHERE profile_id=? AND done=0',(profile_id,)).fetchall()
            matched=[r for r in rows if r['title'].casefold()==title.casefold()]
            if len(matched)==1:
                c.execute('UPDATE browser_tasks SET done=1 WHERE id=? AND profile_id=?',(matched[0]['id'],profile_id))
                return {'reply':f'Отметил выполненной задачу «{matched[0]["title"]}».','topic':'action','sources':[]}
        return {'reply':'Не нашёл одну незавершённую задачу с таким названием. Напиши «Покажи мои задачи» и скопируй точное название.','topic':'plan','sources':[]}
    if user:
        with db() as c:
            membership=c.execute('SELECT group_id FROM memberships WHERE student_id=?',(user['id'],)).fetchone()
            resources=c.execute('SELECT id,title,body FROM campus_resources WHERE group_id=?',(membership['group_id'],)).fetchall() if membership else []
        query=words(text)
        ranked=sorted(((len(query & words(r['title']+' '+r['body'])),r) for r in resources),key=lambda pair:pair[0],reverse=True)
        if ranked and ranked[0][0]>=2:
            resource=ranked[0][1]
            return {'reply':f'В материале твоего университета «{resource["title"]}» указано:\n\n{resource["body"]}',
                    'topic':'university','sources':[{'id':resource['id'],'title':resource['title']}]}
    result=classify(text)
    topic=result['topic']
    if result['score']<.55:
        return {'reply':'Хочу лучше понять запрос. Речь об учебной нагрузке, общении, самочувствии или обращении к куратору? Могу также показать твой план.','topic':'clarification','sources':[]}
    item=KNOWLEDGE[topic]
    reply=item['text']
    with db() as c:
        if topic=='study':
            task=c.execute('SELECT title FROM browser_tasks WHERE profile_id=? AND done=0 ORDER BY id LIMIT 1',(profile_id,)).fetchone()
            if task:reply+='\n\nВ твоём плане сейчас есть задача: «'+task['title']+'». Можем начать с неё.'
        elif topic=='wellbeing':
            latest=c.execute('SELECT day,mood,stress FROM browser_checkins WHERE profile_id=? ORDER BY day DESC LIMIT 1',(profile_id,)).fetchone()
            if latest:reply+=f'\n\nПоследняя твоя отметка ({latest["day"]}): настроение {latest["mood"]}/5, стресс {latest["stress"]}/5. Это самооценка, а не диагноз.'
    return {'reply':reply,'topic':topic,'sources':[{'id':topic,'title':item['title']}],
            'model':'Qadam TopicNet: встроенная нейросетевая классификация'}
