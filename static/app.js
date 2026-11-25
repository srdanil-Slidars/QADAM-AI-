'use strict';

let state = null;
let page = 'home';
let chosenMood = 0;
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const titles = {home:'Главная',dashboard:'Мой день',plan:'Мой план',chat:'AI-помощник',progress:'Мой прогресс',library:'Материалы',support:'Поддержка',settings:'Профиль',curator:'Кабинет куратора'};
const iconPaths = {
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon:'<path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z"/>',
  heart:'<path d="M20.8 4.8a5.3 5.3 0 0 0-7.5 0L12 6.1l-1.3-1.3a5.3 5.3 0 0 0-7.5 7.5L12 21l8.8-8.7a5.3 5.3 0 0 0 0-7.5Z"/>',
  book:'<path d="M12 5v15M3 4c3-1 6-1 9 1 3-2 6-2 9-1v15c-3-1-6-1-9 1-3-2-6-2-9-1Z"/>',
  spark:'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/>',
  check:'<path d="m5 12 4 4 10-10"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  people:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m3 10v-3a6 6 0 0 0-2-4"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>'
};
const icon = (name, className='') => `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.spark}</svg>`;
const articles = [
  {title:'Учёба без лишней спешки',category:'Учёба',time:'3 минуты',icon:'book',intro:'Как превратить большое задание в несколько понятных шагов.',body:'Начни со списка ближайших дедлайнов. Выбери одно задание и сформулируй первый конкретный шаг: например, прочитать условие или составить план ответа. Выдели небольшой промежуток времени, затем сделай перерыв.\n\nОставляй запас времени и место для отдыха. Если сроки пересекаются, уточни требования у преподавателя или обсуди нагрузку с куратором.\n\nПопробуй сейчас: добавь в личный план один небольшой шаг, который выполнишь сегодня.'},
  {title:'Найти своих в университете',category:'Общение',time:'2 минуты',icon:'people',intro:'Небольшие действия, с которых начинается знакомство.',body:'Для знакомства не обязательно быть самым общительным человеком в группе. Можно начать с простого вопроса о расписании или предложить вместе подготовиться к занятию.\n\nВыбирай занятия по интересам: студенческий клуб, волонтёрство, спорт или совместный проект. Регулярные встречи помогают узнавать людей постепенно.\n\nПопробуй сейчас: выбери один комфортный способ начать разговор.'},
  {title:'Оставить место для отдыха',category:'Самочувствие',time:'3 минуты',icon:'sun',intro:'Почему в личном плане нужны не только дедлайны.',body:'Адаптация требует времени и сил. Полезно замечать собственную нагрузку и оставлять в расписании свободное время. Можно ненадолго отложить экран, прогуляться или заняться приятным делом.\n\nКороткие отметки состояния помогают вспомнить, какие дни были легче или труднее. Они не являются диагнозом.\n\nЕсли трудности сохраняются или мешают повседневной жизни, обратись к квалифицированному специалисту. Этот материал — общий пример для прототипа; перед пилотом содержание пройдёт экспертную проверку.'}
];

async function api(url, method='GET', data) {
  const response = await fetch(`/api/${url}`, {method, headers:{'Content-Type':'application/json'}, ...(method !== 'GET' ? {body:JSON.stringify(data ?? {})} : {})});
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Не удалось выполнить действие');
  return result;
}
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4500);
}
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('qadam-theme', theme); } catch (_) {}
  const toggle = $('#themeToggle');
  toggle.innerHTML = icon(theme === 'dark' ? 'sun' : 'moon');
  toggle.title = toggle.ariaLabel = theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему';
  toggle.setAttribute('aria-pressed', String(theme === 'dark'));
}
async function refresh() {
  state = await api('state');
  const [requests, campus] = await Promise.all([state.user ? api('requests') : Promise.resolve({requests:[]}), state.user?.role==='curator' ? api('curator') : Promise.resolve(null)]);
  state.requests=requests.requests;state.campus=campus;
  $('#curatorNav').hidden=state.user?.role!=='curator';
  applyTheme(state.settings.theme);
  render();
}
function heading(title, subtitle, eyebrow='Твоё пространство') {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1 tabindex="-1">${title}</h1><p>${subtitle}</p></div><span class="heading-meta">${new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}</span></div>`;
}
function tasksHTML(limit) {
  const tasks = limit ? [...state.tasks.filter(t=>!t.done), ...state.tasks.filter(t=>t.done)].slice(0,limit) : state.tasks;
  return tasks.map(t => `<label class="task ${t.done?'done':''}"><input class="task-check" type="checkbox" data-task="${t.id}" ${t.done?'checked':''} aria-label="${t.done?'Вернуть в план':'Выполнить'}: ${esc(t.title)}"><span class="task-body"><span class="task-title">${esc(t.title)}</span><span class="task-tag">${esc(t.category)}</span></span></label>`).join('') || '<div class="empty">Твой план пока пуст. Добавь один небольшой шаг.</div>';
}
function progressHTML() {
  const done = state.tasks.filter(t=>t.done).length;
  const percent = state.tasks.length ? Math.round(done/state.tasks.length*100) : 0;
  return `<div class="progress-caption"><span>Выполнено ${done} из ${state.tasks.length}</span><span>${percent}%</span></div><div class="progress-track" role="progressbar" aria-label="Выполнение плана" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent}%"></span></div>`;
}

function home() {
  return `<div class="home-wrap">
    <section class="landing-hero" aria-labelledby="welcomeTitle">
      <img class="hero-image" src="/static/assets/qadam-hero.png" alt="" fetchpriority="high" width="1672" height="941">
      <div class="landing-copy"><div class="eyebrow"><span></span>Пространство первокурсника</div>
        <h1 id="welcomeTitle" tabindex="-1">В новом ритме.<br><em>В своём темпе.</em></h1>
        <p class="landing-description">Университет начинается с перемен.<br>Разберись с учёбой, прислушайся к себе<br>и найди свой следующий шаг.</p>
        <div class="hero-actions"><a class="primary light" href="#dashboard">В своё пространство</a><button class="quiet-link" type="button" data-about>Как это работает</button></div>
      </div><div class="hero-caption"><span>Qadam — шаг вперёд</span></div>
    </section>
    <section id="about" class="about-section" aria-labelledby="aboutTitle">
      <div class="about-heading"><h2 id="aboutTitle">Новая среда.<br>Чуть больше опоры.</h2><p>Необязательно разбираться во всём сразу. Qadam помогает собрать задачи, заметить своё состояние и понять, к кому обратиться за поддержкой.</p></div>
      <div class="feature-columns">
        <div class="feature-item">${icon('book')}<h3>Разобраться с нагрузкой</h3><p>Собери учебные задачи в одном плане. Начни с посильного шага и отмечай то, что уже получилось.</p></div>
        <div class="feature-item">${icon('heart')}<h3>Замечать своё состояние</h3><p>Короткая отметка настроения и стресса поможет сохранить впечатления о дне и увидеть изменения со временем.</p></div>
        <div class="feature-item">${icon('people')}<h3>Найти поддержку</h3><p>Сформулируй вопрос с помощником и подготовь обращение к куратору или психологу, если нужна помощь человека.</p></div>
      </div>
    </section>
    <section class="start-note"><div><h2>Можно начать с одного вопроса</h2><p>Как ты чувствуешь себя сегодня?</p></div><button class="primary" type="button" data-checkin>Уделить минуту себе</button></section>
  </div>`;
}
function dashboard() {
  const last = state.checkins.at(-1);
  const done = state.tasks.filter(t=>t.done).length;
  const mood = last ? ['', 'Тяжело','Не очень','Ровно','Хорошо','Отлично'][last.mood] : 'Без отметки';
  return heading('Твой день, твой темп','Здесь только то, что поможет сделать следующий шаг.') + `
    <section class="day-hero"><div><div class="eyebrow">Пауза перед новым шагом</div><h2>Как проходит твой день?</h2><p>Удели себе минуту. Отметь состояние, чтобы лучше понимать свой ритм.</p></div><button class="primary light" data-checkin>Отметить состояние</button></section>
    <section class="stats-band" aria-label="Краткий обзор"><div class="stat">${icon('heart')}<div><div class="stat-label">Последнее настроение</div><div class="stat-value">${mood}</div></div></div><div class="stat">${icon('check')}<div><div class="stat-label">Завершённые шаги</div><div class="stat-value">${done}<small>из ${state.tasks.length} задач</small></div></div></div><div class="stat">${icon('clock')}<div><div class="stat-label">Дни с отметкой</div><div class="stat-value">${state.checkins.length}<small>в твоей истории</small></div></div></div></section>
    <div class="grid"><section class="panel"><div class="panel-title"><h2>Ближайшие шаги</h2><a class="text-link" href="#plan">Весь план</a></div><p class="panel-subtitle">По одному делу за раз.</p>${tasksHTML(3)}${progressHTML()}</section>
    <section class="panel companion-panel">${icon('spark','companion-icon')}<h2>Разберёмся вместе</h2><p>Учебная нагрузка, новые знакомства или сложный день. Можно начать с того, что сейчас волнует больше всего.</p><a class="text-link" href="#chat">Начать разговор</a></section></div>
    <div class="inline-note"><p>Иногда лучший следующий шаг — поговорить с человеком.</p><a class="text-link" href="#support">Найти поддержку</a></div>`;
}
function plan() {
  return heading('Меньше в голове.<br>Больше ясности.','Запиши задачи и выбери, с чего начнёшь сегодня.','Мой план') + `<section class="panel"><div class="panel-title"><h2>Твои задачи</h2><span class="status">${state.tasks.filter(t=>!t.done).length} осталось</span></div><form id="taskForm" class="add-form"><input name="title" required maxlength="200" placeholder="Например, подготовить план доклада" aria-label="Новая задача"><button class="primary" type="submit">Добавить шаг</button></form>${tasksHTML()}${progressHTML()}</section>`;
}
function chat() {
  return heading('Что у тебя на уме?','Здесь можно спокойно сформулировать то, что волнует.','AI-помощник') + `<div class="chat-layout"><div class="chat-notice">${icon('info')}<span>${state.ai?.cloud ? "Облачная языковая модель Google" : "Локальная языковая модель Qwen3"} ведёт диалог с учётом последних сообщений. Может ошибаться. Специалисты не отслеживают чат.</span></div>
    ${state.ai?.cloud ? `<label class="consent"><input type="checkbox" id="cloudConsent" ${state.settings.ai_cloud_consent ? "checked" : ""}> Разрешаю передачу сообщений, последних реплик, задач и доступных материалов Google для ответа. Можно отозвать здесь.</label>` : ""}<div id="messages" class="messages" role="log" aria-label="Переписка с помощником">${state.messages.length ? state.messages.map(m=>`<div class="message ${m.role === 'user'?'user':'assistant'}">${m.role==='assistant'?icon('spark','assistant-icon'):''}<div class="bubble">${esc(m.text)}</div></div>`).join('') : `<div class="empty chat-empty">${icon('spark')}<h2>Можно начать с малого</h2><p>Расскажи о ситуации или выбери тему ниже.<br>Сформулируем следующий шаг вместе.</p></div>`}</div>
    ${(state.ai_actions || []).map(a=>`<section class="panel ai-action"><h3>${esc(a.label)}</h3><p>Предложение — ожидает твоего подтверждения</p><pre>${esc(a.arguments.title || a.arguments.text || (a.arguments.task_id ? 'Задача №'+a.arguments.task_id : 'Обращение №'+a.arguments.request_id+' · '+({new:'Новое',in_progress:'В работе',resolved:'Решено'}[a.arguments.status] || '')))}</pre><button class="primary" data-ai-confirm="${esc(a.id)}">Подтвердить</button> <button class="text-button" data-ai-cancel="${esc(a.id)}">Отменить</button></section>`).join("")}<div class="chips"><button data-prompt="Помоги составить учебный план">Учебная нагрузка</button><button data-prompt="Мне тяжело справляться со стрессом">Моё состояние</button><button data-prompt="Мне сложно общаться с группой">Общение в группе</button></div>
    <form id="chatForm" class="chat-input"><textarea name="text" required maxlength="2000" placeholder="Расскажи, что тебя волнует…" aria-label="Сообщение помощнику"></textarea><button class="primary" type="submit">Отправить</button></form><p class="fine">Enter — отправить, Shift + Enter — новая строка. Чат не является экстренной помощью.</p></div>`;
}
function progress() {
  const recent = state.checkins.slice(-7);
  return heading('Изменения, которые<br>стоит замечать','Без сравнений с другими. Только твой опыт и твой ритм.','Мой прогресс') + `<div class="grid"><section class="panel"><div class="panel-title"><h2>Моё состояние</h2><button class="text-button" data-checkin>Новая отметка</button></div><p class="panel-subtitle">Последние 7 записей, оценка от 1 до 5</p>
    ${recent.length ? `<div class="chart">${recent.map(c=>`<div class="chart-col"><div class="bars"><div class="bar" style="height:${c.mood*26}px" role="img" aria-label="Настроение ${c.mood} из 5" title="Настроение ${c.mood}/5"></div><div class="bar stress" style="height:${c.stress*26}px" role="img" aria-label="Стресс ${c.stress} из 5" title="Стресс ${c.stress}/5"></div></div><span>${esc(c.day.slice(5).split('-').reverse().join('.'))}</span></div>`).join('')}</div><div class="legend"><span><i></i>Настроение</span><span><i class="stress"></i>Стресс</span></div>` : '<div class="empty">История начинается с первой отметки.<br>Как ты сегодня?</div>'}<p class="fine">Отметки отражают твою самооценку и не являются психологической диагностикой.</p></section>
    <section class="panel"><h2>Маленькие победы</h2><div class="metric-big">${state.tasks.filter(t=>t.done).length}</div><p class="muted">завершённых шагов в твоём плане</p>${progressHTML()}</section></div>
    <section class="panel section-spaced"><h2>Твои записи</h2>${[...state.checkins].reverse().map(c=>`<article class="entry"><strong>${formatDay(c.day)}</strong><small>Настроение ${c.mood}/5 · Стресс ${c.stress}/5</small><p>${esc(c.note || 'Без заметки')}</p></article>`).join('') || '<p class="muted">Здесь появятся твои отметки и заметки о дне.</p>'}</section>`;
}
function library() {
  return heading('Чуть больше ясности','Короткие материалы об учёбе, общении и заботе о себе.','Библиотека') + `<div class="chat-notice">${icon('info')}<span>Демонстрационные материалы. Перед пилотом содержание пройдёт экспертную проверку.</span></div><div class="library-grid">${articles.map((a,i)=>`<article class="panel article-card">${icon(a.icon)}<div class="eyebrow">${a.category} · ${a.time}</div><h2>${a.title}</h2><p>${a.intro}</p><button class="text-button" data-article="${i}" aria-expanded="false" aria-controls="articleContent">Читать материал</button></article>`).join('')}</div><section id="articleContent"></section>`;
}
function draftSupport() {
  return heading('Ты не один','Помощь человека — тоже часть твоего пути.','Поддержка') + `<div class="grid"><section class="panel support-panel">${icon('heart')}<h2>Сформулировать обращение</h2><p class="muted">Напиши, с чем нужна помощь. Пока это черновик: он сохранится в твоём профиле и никому не отправится.</p><form id="supportForm"><label for="supportText">Что ты хочешь обсудить?</label><textarea id="supportText" required maxlength="2000" placeholder="Например, хочу обсудить учебную нагрузку с куратором"></textarea><label class="consent"><input type="checkbox" required name="consent"><span>Я согласен сохранить текст обращения в профиле этого браузера.</span></label><button class="primary" type="submit">Сохранить черновик</button></form></section>
    <section class="panel"><h2>К кому обратиться</h2><p class="muted">Контакты специалистов добавит университет перед запуском.</p><div class="entry"><h3>Куратор</h3><p class="muted">Учебные вопросы, правила университета и организация поддержки.</p></div><div class="entry"><h3>Психолог</h3><p class="muted">Обсуждение эмоциональных трудностей с квалифицированным специалистом.</p></div><p class="fine">Если есть непосредственная угроза жизни или безопасности, обратись в местную экстренную службу. Не ожидай ответа от прототипа.</p></section></div>
    <section class="panel section-spaced"><h2>Сохранённые черновики</h2>${[...state.support].reverse().map(s=>`<article class="entry"><small>Черновик · ${formatDay(s.day)}</small><p>${esc(s.text)}</p></article>`).join('') || '<p class="muted">Здесь появятся подготовленные обращения.</p>'}</section>`;
}
function profileForm(id) {
  const fields = [['name','ФИО','text','Как к тебе обращаться'],['university','Университет','text','Название университета'],['faculty','Факультет / институт','text','Информационные технологии'],['specialty','Специальность','text','Программная инженерия'],['group','Группа','text','ПИ-101'],['course','Курс','number','1'],['phone','Телефон','tel','+7 …'],['email','Электронная почта','email','student@example.com']];
  return `<form id="${id}" class="profile-form"><div class="profile-fields">${fields.map(([key,label,type,placeholder])=>`<div class="profile-field ${key==='name'||key==='university'?'wide':''}"><label for="${id}-${key}">${label}</label><input id="${id}-${key}" name="${key}" type="${type}" ${key==='name'?'required':''} ${type==='number'?'min="1" max="8" step="1"':'maxlength="100"'} autocomplete="${({name:'name',phone:'tel',email:'email'})[key]||'off'}" placeholder="${placeholder}" value="${esc(state.settings[key] || '')}"></div>`).join('')}</div><p class="fine">${state.user ? 'Контакты необязательны. Профиль привязан к твоему аккаунту.' : 'Пока профиль привязан к браузеру. Создай аккаунт, чтобы сохранить доступ к данным.'}</p><button class="primary full" type="submit">Сохранить профиль</button></form>`;
}
function settings() {
  return heading('Твоё пространство','Расскажи немного о себе и своём университете.','Профиль') + `<section class="panel settings-form">${accountPanel()}${profileForm('settingsForm')}<p class="fine settings-footnote">${state.user?'Данные привязаны к аккаунту и доступны после входа с другого устройства.':'Пока данные привязаны к браузеру. Аккаунт сохранит к ним доступ после очистки cookie.'}</p></section>`;
}
function accountPanel() {
  if (!state.user) return `<section class="account-note"><h3>Сохрани своё пространство</h3><p>С аккаунтом данные доступны после входа с другого устройства.</p><div class="account-actions"><button class="primary" data-auth="register" type="button">Создать аккаунт</button><button class="text-button" data-auth="login" type="button">Войти</button></div></section>`;
  return `<section class="account-note"><strong>${esc(state.user.email)}</strong><p>${state.user.role==='curator'?'Куратор':'Студент'}</p><div class="account-actions">${state.user.role==='curator'?'<a class="text-link" href="#curator" data-profile-nav>Кабинет куратора</a>':''}<button class="text-button" type="button" data-logout>Выйти из аккаунта</button></div></section>`;
}
function openAuth(mode) {
  const register=mode==='register';
  $('#profileDialog').close();
  if ($('#authDialog').open) $('#authDialog').close();
  $('#authFields').innerHTML=`<div class="eyebrow">Личное пространство</div><h2 id="authTitle">${register?'Создать аккаунт':'С возвращением'}</h2><form id="authForm">
    ${register?'<label for="accountName">Имя / ФИО</label><input id="accountName" name="name" required maxlength="100" autocomplete="name"><label for="accountRole">Роль</label><select id="accountRole" name="role"><option value="student">Студент</option><option value="curator">Куратор</option></select><div id="curatorRegistration" hidden><label for="campusName">Университет</label><input id="campusName" name="university" maxlength="100"><label for="campusGroup">Название группы</label><input id="campusGroup" name="group" maxlength="100" placeholder="Например, ПИ-101"></div>':''}
    <label for="accountEmail">Электронная почта</label><input id="accountEmail" name="email" type="email" required maxlength="254" autocomplete="username">
    <label for="accountPassword">Пароль ${register?'<span class="optional">От 10 символов</span>':''}</label><input id="accountPassword" name="password" type="password" required ${register?'minlength="10"':''} maxlength="128" autocomplete="${register?'new-password':'current-password'}">
    <p class="fine">${register?'Запомни пароль: восстановление по почте пока не подключено.':'Введи почту и пароль своего аккаунта.'}</p><button class="primary full" type="submit">${register?'Создать аккаунт':'Войти'}</button><button class="text-button" type="button" data-auth="${register?'login':'register'}">${register?'Уже есть аккаунт? Войти':'Нет аккаунта? Создать'}</button></form>`;
  if (register) {
    $('#accountName').value=state.settings.name||'';
    $('#accountRole').onchange=()=>$('#curatorRegistration').hidden=$('#accountRole').value!=='curator';
  }
  const form=$('#authForm');
  form.onsubmit=event=>{event.preventDefault();submitForm(form,async()=>{
    await api(`auth/${register?'register':'login'}`,'POST',Object.fromEntries(new FormData(form)));
    $('#authDialog').close();await refresh();location.hash=state.user.role==='curator'?'curator':'dashboard';toast(register?'Аккаунт создан':'Ты вошёл в аккаунт');
  });};
  $('#authDialog').showModal();
}
const requestStatuses={new:'Новое',in_progress:'В работе',resolved:'Закрыто'};
function requestsHTML() {
  return state.requests.length?state.requests.map(r=>`<article class="request-card"><div class="panel-title"><h3>${state.user.role==='curator'?esc(r.student_name):'Твоё обращение'}</h3><span class="status">${requestStatuses[r.status]}</span></div><small>${formatTimestamp(r.created_at)}</small><p>${esc(r.text)}</p>${r.replies.map(reply=>`<div class="request-reply"><strong>${reply.role==='curator'?'Куратор':'Студент'}</strong><p>${esc(reply.text)}</p></div>`).join('')}<form data-reply="${r.id}" class="reply-form"><label for="reply-${r.id}">Ответ</label><textarea id="reply-${r.id}" name="text" required maxlength="2000" placeholder="Напиши ответ"></textarea><button class="primary" type="submit">Отправить ответ</button></form>${state.user.role==='curator'?`<label for="status-${r.id}">Статус обращения</label><select id="status-${r.id}" data-request-status="${r.id}">${Object.entries(requestStatuses).map(([k,v])=>`<option value="${k}" ${r.status===k?'selected':''}>${v}</option>`).join('')}</select>`:''}</article>`).join(''):'<p class="muted">Обращений пока нет.</p>';
}
function support() {
  if (!state.user) return draftSupport()+`<section class="panel section-spaced">${accountPanel()}<p class="fine">После входа можно присоединиться к группе и отправлять обращения куратору.</p></section>`;
  if (state.user.role==='curator') return heading('Обращения студентов','Отвечай на запросы и отмечай их статус.','Поддержка')+`<section class="panel">${requestsHTML()}</section>`;
  const member=state.membership;
  return heading('Поддержка рядом','Сначала присоединись к группе по коду своего куратора.','Поддержка')+`<div class="grid"><section class="panel"><h2>${member?esc(member.name):'Присоединиться к группе'}</h2>${member?`<p class="muted">${esc(member.university)}</p><label class="consent"><input id="shareCheckins" type="checkbox" ${member.share_checkins?'checked':''}><span>Показывать куратору последнюю оценку настроения и стресса. Заметки и AI-переписка остаются личными.</span></label><button class="text-button" data-leave-group type="button">Выйти из группы</button>`:`<form id="joinGroupForm"><label for="inviteCode">Код от куратора</label><input id="inviteCode" name="code" required maxlength="30" autocomplete="off"><label class="consent"><input name="consent" type="checkbox" required><span>Разрешаю показать моё имя куратору этой группы.</span></label><label class="consent"><input name="share" type="checkbox"><span>Также показывать последние оценки настроения и стресса, без личных заметок.</span></label><button class="primary" type="submit">Присоединиться</button></form>`}</section>
  <section class="panel"><h2>Написать куратору</h2>${member?`<form id="sendRequestForm"><label for="requestText">Что нужно обсудить?</label><textarea id="requestText" name="text" required maxlength="2000"></textarea><label class="consent"><input name="consent" type="checkbox" required><span>Разрешаю отправить этот текст куратору моей группы.</span></label><button class="primary" type="submit">Отправить обращение</button></form>`:'<p class="muted">Форма отправки появится после присоединения к группе.</p>'}<p class="fine">Кабинет куратора не является экстренной службой. При непосредственной угрозе жизни обратись в местную экстренную службу.</p></section></div><section class="panel section-spaced"><h2>Твои обращения</h2>${requestsHTML()}</section>`;
}
function curator() {
  if (state.user?.role!=='curator') return heading('Кабинет куратора','Для доступа нужен аккаунт куратора.')+`<section class="panel">${accountPanel()}</section>`;
  const campus=state.campus,group=campus.group;
  return heading('На связи со студентами','Группа, материалы университета и обращения в одном месте.','Кабинет куратора')+`<section class="day-hero"><div><div class="eyebrow">${esc(group.university)}</div><h2>${esc(group.name)}</h2><p>Передай студентам код приглашения. Они сами выбирают, какие данные показывать.</p></div><div class="invite-code"><small>Код группы</small><strong>${esc(group.invite_code)}</strong><button class="text-button" type="button" data-new-invite>Сменить код</button></div></section>
  <div class="grid section-spaced"><section class="panel"><h2>Студенты (${campus.students.length})</h2>${campus.students.map(s=>`<article class="entry"><h3>${esc(s.name)}</h3><p class="muted">${esc(s.group)}</p><small>${s.share_checkins?(s.checkin?`Отметка ${formatDay(s.checkin.day)}: настроение ${s.checkin.mood}/5, стресс ${s.checkin.stress}/5`:'Студент ещё не оставил отметку'):'Оценки состояния скрыты студентом'}</small></article>`).join('')||'<p class="muted">Студенты появятся после вступления по коду.</p>'}<p class="fine">AI-переписка, личные заметки и контакты студентов здесь не отображаются.</p></section><section class="panel"><h2>Настройка группы</h2><form id="campusForm"><label for="groupUniversity">Университет</label><input id="groupUniversity" name="university" required maxlength="100" value="${esc(group.university)}"><label for="groupName">Название группы</label><input id="groupName" name="name" required maxlength="100" value="${esc(group.name)}"><button class="primary" type="submit">Сохранить</button></form></section></div>
  <section class="panel section-spaced"><div class="panel-title"><h2>Обращения</h2><button type="button" class="text-button" data-refresh-campus>Обновить</button></div>${requestsHTML()}</section><section class="panel section-spaced"><h2>База знаний университета</h2><p class="muted">Добавь правила, контакты психолога или адаптационные материалы. Помощник сможет находить их в ответ на вопросы студентов твоей группы.</p><form id="resourceForm"><label for="resourceTitle">Заголовок</label><input id="resourceTitle" name="title" required maxlength="120"><label for="resourceBody">Проверенный текст</label><textarea id="resourceBody" name="body" required maxlength="4000"></textarea><p class="fine">Публикуй актуальные материалы и контакты с разрешения университета. Не добавляй личные данные студентов.</p><button class="primary" type="submit">Добавить материал</button></form>${campus.resources.map(r=>`<article class="entry"><h3>${esc(r.title)}</h3><p>${esc(r.body)}</p></article>`).join('')}</section>`;
}
function bindCampusForms() {
  const bind=(selector,url,method,read)=>{const form=$(selector);if(form)form.onsubmit=e=>{e.preventDefault();submitForm(form,async()=>{await api(url,method,read(form));await refresh();toast('Сохранено');});};};
  bind('#joinGroupForm','membership','POST',f=>({code:f.elements.code.value,consent:f.elements.consent.checked,share_checkins:f.elements.share.checked}));
  bind('#sendRequestForm','requests','POST',f=>({text:f.elements.text.value,consent:f.elements.consent.checked}));
  bind('#campusForm','curator/group','POST',f=>Object.fromEntries(new FormData(f)));
  bind('#resourceForm','curator/resources','POST',f=>Object.fromEntries(new FormData(f)));
  document.querySelectorAll('[data-reply]').forEach(form=>{form.onsubmit=e=>{e.preventDefault();submitForm(form,async()=>{await api(`requests/${form.dataset.reply}/reply`,'POST',{text:form.elements.text.value});await refresh();toast('Ответ отправлен');});};});
}
function formatTimestamp(value) {
  return new Date(value.replace(' ','T')+'Z').toLocaleString('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
}
function formatDay(day) {
  return new Date(`${day}T12:00:00`).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
}
function closeMenus() {
  $('#mainNav').classList.remove('open');
  $('#mobileMenu').setAttribute('aria-expanded','false');
  $('#mobileMenu').ariaLabel = 'Открыть меню';
  $('#moreNav').open = false;
}
function render() {
  if (!state) return;
  document.title = `${titles[page]} — Qadam AI`;
  document.body.dataset.page = page;
  document.querySelectorAll('nav [data-page]').forEach(link => {
    const active = link.dataset.page === page;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
  });
  $('#moreNav').classList.toggle('active',['progress','library','support','curator'].includes(page));
  const views = {home,dashboard,plan,chat,progress,library,support,settings,curator};
  $('#content').innerHTML = page==='home' ? home() : `<div class="app-wrap">${views[page]()}</div>`;
  if (page==='chat') $('#messages').scrollTop = $('#messages').scrollHeight;
  bindForms();
}
async function navigate() {
  const next = location.hash.slice(1);
  if (next==='content') return;
  const target = Object.hasOwn(titles,next) ? next : 'home';
  if (target===page && $('#content h1')) { closeMenus(); return; }
  page = target;
  closeMenus();
  render();
  if (state.user && ['curator','support'].includes(page)) {
    try {await refresh();} catch(error) {toast(error.message);}
  }
  window.scrollTo({top:0,behavior:'instant'});
  $('#content h1')?.focus({preventScroll:true});
}
async function submitForm(form, action) {
  const button = form.querySelector('button[type="submit"]');
  form.querySelector('.form-error')?.remove();
  if (button.disabled) return;
  button.disabled = true;
  try { await action(); } catch (error) { const note=document.createElement('p');note.className='form-error';note.setAttribute('role','alert');note.textContent=error.message;form.append(note);toast(error.message); }
  finally { if (button.isConnected) button.disabled=false; }
}
function bindProfileForm(id) {
  const form = document.getElementById(id);
  form.onsubmit = event => {
    event.preventDefault();
    submitForm(form,async()=>{
      await api('settings','POST',Object.fromEntries(new FormData(form)));
      if (id==='profileModalForm') $('#profileDialog').close();
      await refresh();toast('Профиль сохранён');
    });
  };
}
function bindForms() {
  const task = $('#taskForm');
  if (task) task.onsubmit = event => {
    event.preventDefault();
    submitForm(task,async()=>{await api('tasks','POST',{title:task.elements.namedItem('title').value});await refresh();toast('Новый шаг добавлен');$('#taskForm input').focus();});
  };
  const chatForm = $('#chatForm');
  if (chatForm) {
    chatForm.onsubmit = event => {
      event.preventDefault();
      const text = chatForm.elements.namedItem('text').value.trim();
      if (!text) return;
      submitForm(chatForm,async()=>{const send=chatForm.querySelector('button');send.textContent='Думаю…';try {await api('chat','POST',{text});await refresh();$('#chatForm textarea').focus();}finally {send.textContent='Отправить';}});
    };
    chatForm.elements.namedItem('text').onkeydown = event => {
      if (event.key==='Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        if (!chatForm.querySelector('button').disabled) chatForm.requestSubmit();
      }
    };
  }
  if ($('#settingsForm')) bindProfileForm('settingsForm');
  bindCampusForms();
  const supportForm = $('#supportForm');
  if (supportForm) supportForm.onsubmit = event => {
    event.preventDefault();
    submitForm(supportForm,async()=>{await api('support','POST',{text:$('#supportText').value,consent:supportForm.elements.namedItem('consent').checked});await refresh();toast('Черновик сохранён. Он не отправлен.');});
  };
}
function openCheckin() {
  chosenMood=0;
  const today = state.today || new Date().toLocaleDateString('sv-SE');
  const previous=state.checkins.find(c=>c.day===today);
  chosenMood=previous?.mood || 0;
  document.querySelectorAll('[data-mood]').forEach(b=>{const selected=Number(b.dataset.mood)===chosenMood;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
  $('#checkinNote').value=previous?.note || '';
  $('#stress').value=previous?.stress || 3;
  $('#stressValue').value=$('#stress').value;
  $('#checkinDialog').showModal();
}
document.addEventListener('click',async event=>{
  if (event.target.closest('[data-profile-nav]')) $('#profileDialog').close();
  const pageLink = event.target.closest('a[data-page], a.brand, a.footer-brand');
  if (pageLink && pageLink.hash === location.hash) closeMenus();
  if (!event.target.closest('.site-header')) closeMenus();
  const button = event.target.closest('button');
  if (!button) {
    if (!event.target.closest('#moreNav')) $('#moreNav').open=false;
    return;
  }
  try {
    if (button.dataset.aiConfirm || button.dataset.aiCancel) {button.disabled=true;try {await api(`ai/actions/${button.dataset.aiConfirm || button.dataset.aiCancel}/${button.dataset.aiConfirm ? 'confirm' : 'cancel'}`,'POST',{});await refresh();}finally {button.disabled=false;}}
    if (button.dataset.auth) openAuth(button.dataset.auth);
    if (button.hasAttribute('data-logout')) {await api('auth/logout','POST',{});$('#profileDialog').close();await refresh();location.hash='home';toast('Ты вышел из аккаунта');}
    if (button.hasAttribute('data-leave-group')) {await api('membership','DELETE',{});await refresh();toast('Ты вышел из группы');}
    if (button.hasAttribute('data-new-invite')) {await api('curator/invite','POST',{});await refresh();toast('Создан новый код приглашения');}
    if (button.hasAttribute('data-refresh-campus')) {await refresh();toast('Обращения обновлены');}
    if (button.hasAttribute('data-checkin')) openCheckin();
    if (button.hasAttribute('data-about')) $('#about').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    if (button.dataset.close) document.getElementById(button.dataset.close).close();
    if (button.dataset.mood) {
      chosenMood=Number(button.dataset.mood);
      document.querySelectorAll('[data-mood]').forEach(b=>{const selected=b===button;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
    }
    if (button.dataset.prompt) { $('#chatForm textarea').value=button.dataset.prompt;$('#chatForm textarea').focus(); }
    if (button.dataset.article !== undefined) {
      const article = articles[Number(button.dataset.article)];
      document.querySelectorAll('[data-article]').forEach(b=>b.setAttribute('aria-expanded',String(b===button)));
      $('#articleContent').innerHTML=`<article class="panel article-text"><div class="eyebrow">${article.category}</div><h2 tabindex="-1">${article.title}</h2>${article.body.split('\n\n').map(p=>`<p>${esc(p)}</p>`).join('')}</article>`;
      $('#articleContent h2').focus({preventScroll:true});
      $('#articleContent').scrollIntoView({behavior:'smooth',block:'start'});
    }
  } catch (error) { toast(error.message); }
});
document.addEventListener('change',async event=>{
  if (event.target.id==='cloudConsent') {try {await api('settings','POST',{ai_cloud_consent:event.target.checked});await refresh();}catch(error){event.target.checked=!event.target.checked;toast(error.message);}return;}
  if (event.target.id==='shareCheckins') {
    const control=event.target;control.disabled=true;
    try {await api('membership','PATCH',{share_checkins:control.checked});await refresh();toast('Настройка доступа сохранена');}
    catch(error){control.checked=!control.checked;control.disabled=false;toast(error.message);}
    return;
  }
  if (event.target.dataset.requestStatus) {
    const control=event.target;control.disabled=true;
    try {await api(`requests/${control.dataset.requestStatus}`,'PATCH',{status:control.value});await refresh();toast('Статус обновлён');}
    catch(error){control.disabled=false;toast(error.message);}
    return;
  }
  const checkbox=event.target.closest('[data-task]');
  if (!checkbox) return;
  checkbox.disabled=true;
  try {await api(`tasks/${checkbox.dataset.task}`,'PATCH');await refresh();}
  catch (error) {checkbox.checked=!checkbox.checked;checkbox.disabled=false;toast(error.message);}
});
$('#checkinForm').onsubmit=event=>{
  event.preventDefault();
  if (!chosenMood) {toast('Выбери настроение');$('[data-mood="1"]').focus();return;}
  submitForm($('#checkinForm'),async()=>{await api('checkins','POST',{mood:chosenMood,stress:Number($('#stress').value),note:$('#checkinNote').value});$('#checkinDialog').close();await refresh();toast('Отметка сохранена. Спасибо, что уделил себе время.');});
};
$('#stress').oninput=event=>$('#stressValue').value=event.target.value;
$('#themeToggle').onclick=async()=>{
  const toggle=$('#themeToggle');
  if (!state || toggle.disabled) return;
  toggle.disabled=true;
  const previous=state.settings.theme;
  const theme=previous==='dark'?'light':'dark';
  applyTheme(theme);
  try {await api('settings','POST',{theme});state.settings.theme=theme;}
  catch(error){applyTheme(previous);toast(error.message);}
  finally{toggle.disabled=false;}
};
$('#mobileMenu').onclick=()=>{
  const open=$('#mainNav').classList.toggle('open');
  $('#mobileMenu').setAttribute('aria-expanded',String(open));
  $('#mobileMenu').ariaLabel=open?'Закрыть меню':'Открыть меню';
};
$('#profileButton').onclick=()=>{
  if (!state) return;
  $('#profileFields').innerHTML=accountPanel()+profileForm('profileModalForm');
  bindProfileForm('profileModalForm');$('#profileDialog').showModal();
};
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click',event=>{
  if (event.target!==dialog) return;
  const r=dialog.getBoundingClientRect();
  if (event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) dialog.close();
});
document.addEventListener('keydown',event=>{if(event.key==='Escape') closeMenus();});
window.addEventListener('hashchange',navigate);
page=Object.hasOwn(titles,location.hash.slice(1))?location.hash.slice(1):'home';
applyTheme(document.documentElement.dataset.theme);
refresh().catch(()=>{
  $('#content').innerHTML='<div class="app-wrap"><section class="panel error-panel"><h1>Не удалось загрузить пространство</h1><p class="muted">Проверь подключение к Flask и попробуй обновить страницу.</p><button class="primary" id="retryLoad">Попробовать снова</button></section></div>';
  $('#retryLoad').onclick=()=>location.reload();
});
