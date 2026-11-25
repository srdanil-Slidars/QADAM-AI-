'use strict';
// Explicit product copy only. User messages, names and university materials are never translated.
const QadamI18n = (() => {
  const languages = ['ru','kk','en'];
  let saved = null;
  try { saved = localStorage.getItem('qadam-language'); } catch (_) {}
  let language = languages.includes(saved) ? saved : 'ru';
  const catalogue = new Map();
  const patterns = [];
  const originals = new WeakMap();
  const attributes = new WeakMap();
  function add(ru, kk, en) {
    const item = {ru,kk,en};
    catalogue.set(ru,item);
    if (/\{\d+\}/.test(ru)) {
      const keys=[];
      const source=ru.split(/(\{\d+\})/).map(s=>/^\{\d+\}$/.test(s) ? (keys.push(s),'(.+?)') : s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('');
      patterns.push({re:new RegExp('^'+source+'$'),keys,item});
    }
  }
  function t(value) {
    const raw=String(value ?? '');
    const key=raw.trim().replace(/\s+/g,' ');
    if (language==='ru') return raw;
    let result=catalogue.get(key)?.[language];
    if (result===undefined) for (const p of patterns) {
      const match=key.match(p.re);
      if (match) {result=p.item[language];p.keys.forEach((k,i)=>result=result.replaceAll(k,t(match[i+1])));break;}
    }
    return result===undefined ? raw : raw.slice(0,raw.indexOf(raw.trimStart()))+result+(raw.match(/\s*$/)?.[0] || '');
  }
  const skip='script,style,textarea,[data-no-i18n],.bubble,.user-content';
  function localize(root=document.body) {
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node=walker.currentNode;
      if (node.parentElement.closest(skip)) continue;
      let record=originals.get(node);
      if (!record || record.last!==node.nodeValue) record={source:node.nodeValue};
      record.last=t(record.source);node.nodeValue=record.last;originals.set(node,record);
    }
    const elements=[...(root.nodeType===1?[root]:[]),...root.querySelectorAll('[placeholder],[aria-label],[title],[data-prompt]')];
    for (const el of elements) {
      if (el.closest(skip)) continue;
      const records=attributes.get(el) || {};
      for (const attr of ['placeholder','aria-label','title','data-prompt']) {
        if (!el.hasAttribute(attr)) continue;
        let record=records[attr];
        if (!record || record.last!==el.getAttribute(attr)) record={source:el.getAttribute(attr)};
        record.last=t(record.source);el.setAttribute(attr,record.last);records[attr]=record;
      }
      attributes.set(el,records);
    }
    document.documentElement.lang=language;
    for (const el of root.querySelectorAll('[data-local-date]')) el.textContent=new Date(el.dataset.localDate+'T12:00:00').toLocaleDateString({ru:'ru-RU',kk:'kk-KZ',en:'en-GB'}[language],{day:'numeric',month:'long',year:'numeric'});
    for (const el of root.querySelectorAll('[data-local-timestamp]')) el.textContent=new Date(el.dataset.localTimestamp).toLocaleString({ru:'ru-RU',kk:'kk-KZ',en:'en-GB'}[language],{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
    const selector=document.getElementById('languageSelect');
    if (selector) selector.value=language;
  }
  function set(next, persist=true) {
    if (!languages.includes(next)) return;
    language=next;
    if (persist) {saved=next;try {localStorage.setItem('qadam-language',next);} catch (_) {}}
    localize();
  }
  return {add,t,localize,set,get language(){return language;},get hasPreference(){return languages.includes(saved);},get locale(){return {ru:'ru-RU',kk:'kk-KZ',en:'en-GB'}[language];}};
})();
const t = value => QadamI18n.t(value);

// Russian | Kazakh | English. Dynamic values use numbered placeholders.
for (const row of `
Главная|Басты бет|Home
Мой день|Менің күнім|My day
План|Жоспар|Plan
Мой план|Менің жоспарым|My plan
AI-помощник|AI көмекші|AI assistant
Ещё|Тағы|More
Мой прогресс|Менің жетістігім|My progress
Материалы|Материалдар|Resources
Поддержка|Қолдау|Support
Профиль|Профиль|Profile
Кабинет куратора|Куратор кабинеті|Curator workspace
Перейти к содержимому|Мазмұнға өту|Skip to content
Qadam AI — главная|Qadam AI — басты бет|Qadam AI — home
Основная навигация|Негізгі мәзір|Main navigation
Язык интерфейса|Интерфейс тілі|Interface language
Включить тёмную тему|Қараңғы тақырыпты қосу|Switch to dark theme
Включить светлую тему|Жарық тақырыпты қосу|Switch to light theme
Тёмная тема|Қараңғы тақырып|Dark theme
Открыть профиль|Профильді ашу|Open profile
Мой профиль|Менің профилім|My profile
Открыть меню|Мәзірді ашу|Open menu
Закрыть меню|Мәзірді жабу|Close menu
Готовим твоё пространство…|Жеке кеңістігің дайындалып жатыр…|Preparing your space…
Поддержка на твоём пути|Жолыңдағы қолдау|Support along your way
Помощь и поддержка|Көмек пен қолдау|Help and support
Твоё пространство|Сенің кеңістігің|Your space
Пространство первокурсника|Бірінші курс студентінің кеңістігі|A space for first-year students
В новом ритме.|Жаңа ырғақта.|A new rhythm.
В своём темпе.|Өз қарқыныңмен.|At your own pace.
Университет начинается с перемен.|Университет өзгерістерден басталады.|University starts with change.
Разберись с учёбой, прислушайся к себе|Оқуыңды реттеп, өзіңді тыңда|Find your study rhythm, listen to yourself
и найди свой следующий шаг.|және келесі қадамыңды тап.|and find your next step.
В своё пространство|Жеке кеңістікке өту|Enter your space
Как это работает|Қалай жұмыс істейді|How it works
Qadam — шаг вперёд|Qadam — алға қадам|Qadam — a step forward
Новая среда.|Жаңа орта.|A new environment.
Чуть больше опоры.|Сәл көбірек қолдау.|A little more support.
Если нужна помощь человека, её можно попросить.|Адамның көмегі қажет болса, оны сұрауға болады.|You can ask for human support when you need it.
Необязательно разбираться во всём сразу. Qadam помогает собрать задачи, заметить своё состояние и понять, к кому обратиться за поддержкой.|Бәрін бірден түсіну міндетті емес. Qadam тапсырмаларды жинақтауға, көңіл күйіңді байқауға және кімнен қолдау сұрауға болатынын білуге көмектеседі.|You don't have to figure everything out at once. Qadam helps you organise tasks, notice how you feel and find someone to turn to.
Разобраться с нагрузкой|Оқу жүктемесін реттеу|Manage your workload
Собери учебные задачи в одном плане. Начни с посильного шага и отмечай то, что уже получилось.|Оқу тапсырмаларын бір жоспарға жина. Қолыңнан келетін қадамнан бастап, жетістігіңді белгілеп отыр.|Keep your study tasks in one plan. Start with a manageable step and track what you've completed.
Замечать своё состояние|Өз жағдайыңды байқау|Notice how you feel
Короткая отметка настроения и стресса поможет сохранить впечатления о дне и увидеть изменения со временем.|Көңіл күй мен күйзелісті қысқаша белгілеу күннің әсерін сақтап, уақыт өте өзгерістерді байқауға көмектеседі.|A quick mood and stress check-in helps you remember your day and see changes over time.
Найти поддержку|Қолдау табу|Find support
Сформулируй вопрос с помощником и подготовь обращение к куратору или психологу, если нужна помощь человека.|Адамның көмегі қажет болса, көмекшімен бірге сұрағыңды нақтылап, кураторға не психологқа өтініш дайында.|Work with the assistant to put your question into words and prepare a message to a curator or psychologist when you need human support.
Можно начать с одного вопроса|Бір сұрақтан бастауға болады|You can start with one question
Как ты чувствуешь себя сегодня?|Бүгін өзіңді қалай сезінесің?|How are you feeling today?
Уделить минуту себе|Өзіңе бір минут бөл|Take a minute for yourself
Твой день, твой темп|Сенің күнің, сенің қарқының|Your day, your pace
Здесь только то, что поможет сделать следующий шаг.|Мұнда келесі қадамға көмектесетін нәрселер ғана бар.|Just what you need to take your next step.
Пауза перед новым шагом|Жаңа қадам алдындағы үзіліс|A pause before your next step
Как проходит твой день?|Күнің қалай өтіп жатыр?|How is your day going?
Удели себе минуту. Отметь состояние, чтобы лучше понимать свой ритм.|Өзіңе бір минут бөл. Өз қарқыныңды түсіну үшін жағдайыңды белгіле.|Take a minute for yourself. Check in to understand your rhythm better.
Отметить состояние|Жағдайымды белгілеу|Check in
Краткий обзор|Қысқаша шолу|At a glance
Последнее настроение|Соңғы көңіл күй|Latest mood
Завершённые шаги|Аяқталған қадамдар|Completed steps
Дни с отметкой|Белгі қойылған күндер|Check-in days
в твоей истории|сенің тарихыңда|in your history
Ближайшие шаги|Алдағы қадамдар|Next steps
Весь план|Толық жоспар|View full plan
По одному делу за раз.|Бір уақытта бір іс.|One thing at a time.
Разберёмся вместе|Бірге талқылайық|Let's work through it together
Учебная нагрузка, новые знакомства или сложный день. Можно начать с того, что сейчас волнует больше всего.|Оқу жүктемесі, жаңа таныстықтар немесе қиын күн. Қазір ең көп алаңдататын нәрседен бастауға болады.|Study pressure, new people or a difficult day. Start with whatever is on your mind.
Начать разговор|Әңгіме бастау|Start a conversation
Ты не обязан справляться со всем в одиночку.|Бәрін жалғыз еңсеруге міндетті емессің.|You don't have to handle everything alone.
Иногда лучший следующий шаг — поговорить с человеком.|Кейде ең жақсы келесі қадам — адаммен сөйлесу.|Sometimes the best next step is to talk to someone.
Обратиться за поддержкой|Қолдау сұрау|Ask for support
Меньше в голове.|Ойыңда аз жүк.|Less on your mind.
Больше ясности.|Көбірек айқындық.|More clarity.
Запиши задачи и выбери, с чего начнёшь сегодня.|Тапсырмаларды жазып, бүгін неден бастайтыныңды таңда.|Write down your tasks and choose where to start today.
Твои задачи|Сенің тапсырмаларың|Your tasks
Добавить шаг|Қадам қосу|Add a step
Например, подготовить план доклада|Мысалы, баяндама жоспарын дайындау|For example, outline a presentation
Новая задача|Жаңа тапсырма|New task
Твой план пока пуст. Добавь один небольшой шаг.|Жоспарың әзірге бос. Бір шағын қадам қос.|Your plan is empty. Add one small step.
Выполнение плана|Жоспардың орындалуы|Plan progress
Вернуть в план|Жоспарға қайтару|Mark incomplete
Выполнить|Орындау|Mark complete
Учёба|Оқу|Studies
Общение|Қарым-қатынас|Social life
Самочувствие|Жағдайым|Wellbeing
Моя задача|Менің тапсырмам|My task
Составить план на учебную неделю|Оқу аптасына жоспар құру|Plan the study week
Познакомиться с одним одногруппником|Бір топтасыңмен танысу|Get to know one classmate
Выделить 20 минут на отдых|Демалысқа 20 минут бөлу|Set aside 20 minutes to rest
Из разговора с AI|AI әңгімесінен|From your AI conversation
Что у тебя на уме?|Не ойлап жүрсің?|What's on your mind?
Здесь можно спокойно сформулировать то, что волнует.|Мұнда алаңдататын ойларыңды асықпай жеткізе аласың.|Take your time to put what's bothering you into words.
AI-помощник ещё не подключён на сервере. Администратору нужно настроить AI-провайдера. Остальные разделы работают.|Серверде AI көмекші әлі қосылмаған. Әкімші AI провайдерін баптауы керек. Басқа бөлімдер жұмыс істейді.|The AI assistant is not connected on this server yet. The administrator needs to configure an AI provider. Other sections are available.
Облачная языковая модель Google ведёт диалог с учётом последних сообщений. Может ошибаться. Специалисты не отслеживают чат.|Google бұлттық тіл моделі соңғы хабарламаларды ескеріп жауап береді. Қателесуі мүмкін. Мамандар чатты бақыламайды.|Google's cloud language model uses recent messages for context. It can make mistakes. Specialists do not monitor this chat.
Локальная языковая модель Qwen3 ведёт диалог с учётом последних сообщений. Может ошибаться. Специалисты не отслеживают чат.|Жергілікті Qwen3 тіл моделі соңғы хабарламаларды ескеріп жауап береді. Қателесуі мүмкін. Мамандар чатты бақыламайды.|The local Qwen3 language model uses recent messages for context. It can make mistakes. Specialists do not monitor this chat.
Разрешаю передачу сообщений, последних реплик, задач и доступных материалов Google для ответа. Можно отозвать здесь.|Жауап алу үшін хабарламаларды, соңғы репликаларды, тапсырмалар мен қолжетімді материалдарды Google-ға беруге келісемін. Келісімді осы жерден қайтарып алуға болады.|I allow my messages, recent conversation, tasks and available materials to be sent to Google for a response. I can withdraw this permission here.
Переписка с помощником|Көмекшімен хат алмасу|Conversation with the assistant
Можно начать с малого|Кішкентай қадамнан бастауға болады|Start small
Расскажи о ситуации или выбери тему ниже.|Жағдайыңды айтып бер немесе төменнен тақырып таңда.|Tell me about your situation or choose a topic below.
Сформулируем следующий шаг вместе.|Келесі қадамды бірге анықтайық.|Let's find your next step together.
Предложение — ожидает твоего подтверждения|Ұсыныс — растауыңды күтуде|Proposal — awaiting your confirmation
Подтвердить|Растау|Confirm
Отменить|Бас тарту|Cancel
Добавить в план|Жоспарға қосу|Add to plan
Завершить задачу|Тапсырманы аяқтау|Complete task
Сохранить черновик|Жобаны сақтау|Save draft
Отправить куратору|Кураторға жіберу|Send to curator
Отправить ответ|Жауап жіберу|Send reply
Изменить статус|Күйін өзгерту|Change status
Учебная нагрузка|Оқу жүктемесі|Study workload
Моё состояние|Менің жағдайым|How I feel
Общение в группе|Топтағы қарым-қатынас|Getting along with my group
Помоги составить учебный план|Оқу жоспарын құруға көмектес|Help me make a study plan
Мне тяжело справляться со стрессом|Күйзеліспен күресу маған қиын|I'm finding it hard to manage stress
Мне сложно общаться с группой|Топпен араласу маған қиын|I'm finding it hard to connect with my group
Расскажи, что тебя волнует…|Сені не алаңдататынын айт…|Tell me what's on your mind…
Сообщение помощнику|Көмекшіге хабарлама|Message to the assistant
Отправить|Жіберу|Send
Думаю…|Ойланып жатырмын…|Thinking…
Enter — отправить, Shift + Enter — новая строка. Чат не является экстренной помощью.|Enter — жіберу, Shift + Enter — жаңа жол. Чат шұғыл көмек қызметі емес.|Enter to send, Shift + Enter for a new line. This chat is not an emergency service.
Изменения, которые|Байқауға тұрарлық|Changes
стоит замечать|өзгерістер|worth noticing
Без сравнений с другими. Только твой опыт и твой ритм.|Басқалармен салыстырусыз. Тек өз тәжірибең мен қарқының.|No comparisons with others. Just your experience and your pace.
Новая отметка|Жаңа белгі|New check-in
Последние 7 записей, оценка от 1 до 5|Соңғы 7 жазба, баға 1-ден 5-ке дейін|Last 7 check-ins, rated from 1 to 5
Настроение|Көңіл күй|Mood
Стресс|Күйзеліс|Stress
История начинается с первой отметки.|Тарих алғашқы белгіден басталады.|Your history starts with your first check-in.
Как ты сегодня?|Бүгін қалайсың?|How are you today?
Отметки отражают твою самооценку и не являются психологической диагностикой.|Белгілер өз бағаңды көрсетеді және психологиялық диагностика болып саналмайды.|Check-ins reflect your own assessment and are not a psychological diagnosis.
Маленькие победы|Шағын жеңістер|Small wins
завершённых шагов в твоём плане|жоспарыңдағы аяқталған қадамдар|completed steps in your plan
Твои записи|Сенің жазбаларың|Your check-ins
Без заметки|Жазбасыз|No note
Здесь появятся твои отметки и заметки о дне.|Мұнда күн туралы белгілерің мен жазбаларың пайда болады.|Your check-ins and notes about your day will appear here.
Чуть больше ясности|Көбірек айқындық|A little more clarity
Короткие материалы об учёбе, общении и заботе о себе.|Оқу, қарым-қатынас және өзіңе қамқорлық туралы қысқаша материалдар.|Short reads on studying, social life and looking after yourself.
Библиотека|Кітапхана|Library
Демонстрационные материалы. Перед пилотом содержание пройдёт экспертную проверку.|Көрсетілім материалдары. Пилоттық іске қосу алдында мазмұнды мамандар тексереді.|Demonstration materials. The content will undergo expert review before the pilot.
Читать материал|Материалды оқу|Read article
Учёба без лишней спешки|Асықпай оқу|Study without the rush
Как превратить большое задание в несколько понятных шагов.|Үлкен тапсырманы бірнеше түсінікті қадамға бөлу жолдары.|How to turn a large assignment into manageable steps.
Найти своих в университете|Университетте өз ортаңды табу|Find your people at university
Небольшие действия, с которых начинается знакомство.|Таныстық басталатын шағын әрекеттер.|Small steps to start getting to know people.
Оставить место для отдыха|Демалысқа уақыт қалдыру|Make room for rest
Почему в личном плане нужны не только дедлайны.|Жеке жоспарда неге тек мерзімдер ғана болмауы керек.|Why your plan needs more than deadlines.
Ты не один|Сен жалғыз емессің|You're not alone
Помощь человека — тоже часть твоего пути.|Адамның көмегі де сенің жолыңның бір бөлігі.|Human support is part of your journey too.
Сформулировать обращение|Өтінішті тұжырымдау|Prepare a message
Напиши, с чем нужна помощь. Пока это черновик: он сохранится в твоём профиле и никому не отправится.|Қандай көмек қажет екенін жаз. Бұл әзірге жоба: профиліңде сақталады және ешкімге жіберілмейді.|Write down what you need help with. This is a draft: it stays in your profile and is not sent to anyone.
Что ты хочешь обсудить?|Нені талқылағың келеді?|What would you like to discuss?
Например, хочу обсудить учебную нагрузку с куратором|Мысалы, куратормен оқу жүктемесін талқылағым келеді|For example, I'd like to discuss my workload with my curator
Я согласен сохранить текст обращения в профиле этого браузера.|Өтініш мәтінін осы браузердегі профильде сақтауға келісемін.|I agree to save this draft in this browser's profile.
К кому обратиться|Кімге жүгінуге болады|Who can help
Контакты специалистов добавит университет перед запуском.|Іске қосу алдында университет мамандардың байланыстарын қосады.|Your university will add specialist contacts before launch.
Куратор|Куратор|Curator
Психолог|Психолог|Psychologist
Учебные вопросы, правила университета и организация поддержки.|Оқу мәселелері, университет ережелері және қолдауды ұйымдастыру.|Study questions, university rules and arranging support.
Обсуждение эмоциональных трудностей с квалифицированным специалистом.|Эмоциялық қиындықтарды білікті маманмен талқылау.|Discussing emotional difficulties with a qualified professional.
Если есть непосредственная угроза жизни или безопасности, обратись в местную экстренную службу. Не ожидай ответа от прототипа.|Өмірге не қауіпсіздікке тікелей қауіп төнсе, жергілікті шұғыл көмек қызметіне хабарлас. Прототиптің жауабын күтпе.|If there is an immediate threat to life or safety, contact your local emergency service. Do not wait for a reply from this prototype.
Сохранённые черновики|Сақталған жобалар|Saved drafts
Здесь появятся подготовленные обращения.|Мұнда дайындалған өтініштер пайда болады.|Your draft messages will appear here.
ФИО|Аты-жөні|Full name
Как к тебе обращаться|Саған қалай жүгінуге болады|What should we call you?
Университет|Университет|University
Название университета|Университет атауы|University name
Факультет / институт|Факультет / институт|Faculty / institute
Информационные технологии|Ақпараттық технологиялар|Information technology
Специальность|Мамандық|Degree programme
Программная инженерия|Бағдарламалық инженерия|Software engineering
Группа|Топ|Group
Курс|Курс|Year of study
Телефон|Телефон|Phone
Электронная почта|Электрондық пошта|Email
Контакты необязательны. Профиль привязан к твоему аккаунту.|Байланыс деректері міндетті емес. Профиль аккаунтыңа байланысты.|Contact details are optional. Your profile is linked to your account.
Пока профиль привязан к браузеру. Создай аккаунт, чтобы сохранить доступ к данным.|Әзірге профиль браузерге байланысты. Деректерге қолжетімділікті сақтау үшін аккаунт аш.|Your profile is currently linked to this browser. Create an account to keep access to your data.
Сохранить профиль|Профильді сақтау|Save profile
Расскажи немного о себе и своём университете.|Өзің және университетің туралы аздап айтып бер.|Tell us a little about yourself and your university.
Данные привязаны к аккаунту и доступны после входа с другого устройства.|Деректер аккаунтқа байланысты және басқа құрылғыдан кіргенде қолжетімді.|Your data is linked to your account and available when you sign in on another device.
Пока данные привязаны к браузеру. Аккаунт сохранит к ним доступ после очистки cookie.|Әзірге деректер браузерге байланысты. Аккаунт cookie тазаланғаннан кейін де оларға қолжетімділікті сақтайды.|Your data is currently linked to this browser. An account keeps access after you clear cookies.
Сохрани своё пространство|Өз кеңістігіңді сақта|Keep your space
С аккаунтом данные доступны после входа с другого устройства.|Аккаунт арқылы басқа құрылғыдан кіргенде деректерің қолжетімді болады.|With an account, you can access your data from another device.
Создать аккаунт|Аккаунт ашу|Create account
Войти|Кіру|Sign in
Студент|Студент|Student
Выйти из аккаунта|Аккаунттан шығу|Sign out
Личное пространство|Жеке кеңістік|Personal space
С возвращением|Қайта оралуыңмен|Welcome back
Имя / ФИО|Есім / аты-жөні|Name / full name
Роль|Рөл|Role
Название группы|Топ атауы|Group name
Например, ПИ-101|Мысалы, ПИ-101|For example, CS-101
Пароль|Құпиясөз|Password
От 10 символов|Кемінде 10 таңба|At least 10 characters
Запомни пароль: восстановление по почте пока не подключено.|Құпиясөзіңді есте сақта: пошта арқылы қалпына келтіру әзірге қосылмаған.|Remember your password: email password recovery is not available yet.
Введи почту и пароль своего аккаунта.|Аккаунтыңның поштасы мен құпиясөзін енгіз.|Enter your account email and password.
Уже есть аккаунт? Войти|Аккаунтың бар ма? Кіру|Already have an account? Sign in
Нет аккаунта? Создать|Аккаунтың жоқ па? Ашу|No account yet? Create one
Закрыть вход|Кіру терезесін жабу|Close sign-in window
Закрыть профиль|Профильді жабу|Close profile
Закрыть опрос|Сауалнаманы жабу|Close check-in
Твой профиль|Сенің профилің|Your profile
Небольшая пауза для себя|Өзіңе арналған шағын үзіліс|A small pause for yourself
Отметь, как чувствуешь себя сейчас. Здесь нет правильных ответов.|Қазір өзіңді қалай сезінетініңді белгіле. Мұнда дұрыс не бұрыс жауап жоқ.|Check in with how you feel right now. There are no right answers.
Очень плохо|Өте нашар|Very low
Плохо|Нашар|Low
Нейтрально|Бірқалыпты|Neutral
Хорошо|Жақсы|Good
Отлично|Керемет|Great
Тяжело|Қиын|Struggling
Не очень|Онша емес|Not great
Ровно|Бірқалыпты|Okay
Без отметки|Белгі жоқ|No check-in
Уровень стресса|Күйзеліс деңгейі|Stress level
Спокойно|Тыныш|Calm
Сильное напряжение|Қатты ширығу|High tension
Что повлияло на твой день?|Күніңе не әсер етті?|What affected your day?
Необязательно|Міндетті емес|Optional
Можно написать пару слов|Бірнеше сөз жазуға болады|A few words are enough
Повторная отметка обновит запись за сегодня. Она привязана к профилю этого браузера.|Қайта белгілеу бүгінгі жазбаны жаңартады. Ол осы браузердің профиліне байланысты.|Checking in again updates today's entry. It is linked to this browser's profile.
Сохранить отметку|Белгіні сақтау|Save check-in
Новое|Жаңа|New
В работе|Қаралуда|In progress
Закрыто|Жабылды|Closed
Решено|Шешілді|Resolved
Твоё обращение|Сенің өтінішің|Your request
Ответ|Жауап|Reply
Напиши ответ|Жауап жаз|Write a reply
Статус обращения|Өтініш күйі|Request status
Обращений пока нет.|Әзірге өтініштер жоқ.|No requests yet.
После входа можно присоединиться к группе и отправлять обращения куратору.|Кіргеннен кейін топқа қосылып, кураторға өтініш жібере аласың.|Sign in to join a group and send requests to your curator.
Обращения студентов|Студенттердің өтініштері|Student requests
Отвечай на запросы и отмечай их статус.|Өтініштерге жауап беріп, күйін белгіле.|Reply to requests and update their status.
Поддержка рядом|Қолдау жаныңда|Support is close by
Сначала присоединись к группе по коду своего куратора.|Алдымен кураторыңның коды арқылы топқа қосыл.|First, join your group using your curator's code.
Присоединиться к группе|Топқа қосылу|Join a group
Показывать куратору последнюю оценку настроения и стресса. Заметки и AI-переписка остаются личными.|Кураторға көңіл күй мен күйзелістің соңғы бағасын көрсету. Жазбалар мен AI хат алмасуы жеке қалады.|Share your latest mood and stress ratings with your curator. Notes and AI conversations stay private.
Выйти из группы|Топтан шығу|Leave group
Код от куратора|Куратор берген код|Curator's invite code
Разрешаю показать моё имя куратору этой группы.|Атымды осы топтың кураторына көрсетуге келісемін.|I allow my name to be shared with this group's curator.
Также показывать последние оценки настроения и стресса, без личных заметок.|Жеке жазбаларсыз көңіл күй мен күйзелістің соңғы бағаларын да көрсету.|Also share my latest mood and stress ratings, without personal notes.
Присоединиться|Қосылу|Join
Написать куратору|Кураторға жазу|Message your curator
Что нужно обсудить?|Нені талқылау керек?|What do you need to discuss?
Разрешаю отправить этот текст куратору моей группы.|Осы мәтінді тобымның кураторына жіберуге келісемін.|I allow this text to be sent to my group's curator.
Отправить обращение|Өтініш жіберу|Send request
Форма отправки появится после присоединения к группе.|Жіберу формасы топқа қосылғаннан кейін пайда болады.|The message form will appear after you join a group.
Кабинет куратора не является экстренной службой. При непосредственной угрозе жизни обратись в местную экстренную службу.|Куратор кабинеті шұғыл көмек қызметі емес. Өмірге тікелей қауіп төнсе, жергілікті шұғыл көмек қызметіне хабарлас.|The curator workspace is not an emergency service. If life is in immediate danger, contact your local emergency service.
Твои обращения|Сенің өтініштерің|Your requests
Для доступа нужен аккаунт куратора.|Кіру үшін куратор аккаунты қажет.|A curator account is required.
На связи со студентами|Студенттермен байланыста|Connected with your students
Группа, материалы университета и обращения в одном месте.|Топ, университет материалдары мен өтініштер бір жерде.|Your group, university resources and requests in one place.
Передай студентам код приглашения. Они сами выбирают, какие данные показывать.|Студенттерге шақыру кодын бер. Олар қандай деректерді көрсетуді өздері таңдайды.|Share the invite code with your students. They choose which data to share.
Код группы|Топ коды|Group code
Сменить код|Кодты өзгерту|Rotate code
Студент ещё не оставил отметку|Студент әлі белгі қалдырмаған|The student hasn't checked in yet
Оценки состояния скрыты студентом|Студент жағдай бағаларын жасырған|The student has kept their ratings private
Студенты появятся после вступления по коду.|Студенттер код арқылы қосылғаннан кейін пайда болады.|Students will appear after joining with the code.
AI-переписка, личные заметки и контакты студентов здесь не отображаются.|Студенттердің AI хат алмасуы, жеке жазбалары мен байланыстары мұнда көрсетілмейді.|Students' AI conversations, personal notes and contact details are not shown here.
Настройка группы|Топты баптау|Group settings
Сохранить|Сақтау|Save
Обращения|Өтініштер|Requests
Обновить|Жаңарту|Refresh
База знаний университета|Университеттің білім қоры|University knowledge base
Добавь правила, контакты психолога или адаптационные материалы. Помощник сможет находить их в ответ на вопросы студентов твоей группы.|Ережелерді, психолог байланыстарын немесе бейімделу материалдарын қос. Көмекші топ студенттерінің сұрақтарына жауап бергенде оларды пайдалана алады.|Add rules, psychologist contacts or adaptation resources. The assistant can use them when answering your group's questions.
Заголовок|Тақырып|Title
Проверенный текст|Тексерілген мәтін|Verified content
Публикуй актуальные материалы и контакты с разрешения университета. Не добавляй личные данные студентов.|Университеттің рұқсатымен өзекті материалдар мен байланыстарды жарияла. Студенттердің жеке деректерін қоспа.|Publish current materials and contacts with your university's permission. Do not include students' personal data.
Добавить материал|Материал қосу|Add resource
Сохранено|Сақталды|Saved
Ответ отправлен|Жауап жіберілді|Reply sent
Профиль сохранён|Профиль сақталды|Profile saved
Новый шаг добавлен|Жаңа қадам қосылды|New step added
Черновик сохранён. Он не отправлен.|Жоба сақталды. Ол жіберілген жоқ.|Draft saved. It has not been sent.
Ты вышел из аккаунта|Аккаунттан шықтың|You have signed out
Ты вышел из группы|Топтан шықтың|You have left the group
Создан новый код приглашения|Жаңа шақыру коды жасалды|New invite code created
Обращения обновлены|Өтініштер жаңартылды|Requests refreshed
Настройка доступа сохранена|Қолжетімділік баптауы сақталды|Sharing preference saved
Статус обновлён|Күйі жаңартылды|Status updated
Выбери настроение|Көңіл күйіңді таңда|Choose your mood
Отметка сохранена. Спасибо, что уделил себе время.|Белгі сақталды. Өзіңе уақыт бөлгеніңе рақмет.|Check-in saved. Thank you for taking time for yourself.
Аккаунт создан|Аккаунт ашылды|Account created
Ты вошёл в аккаунт|Аккаунтқа кірдің|You have signed in
Не удалось загрузить пространство|Кеңістікті жүктеу мүмкін болмады|Couldn't load your space
Проверь подключение к Flask и попробуй обновить страницу.|Қосылымды тексеріп, бетті жаңартып көр.|Check your connection and try refreshing the page.
Попробовать снова|Қайталап көру|Try again
Не удалось выполнить действие|Әрекетті орындау мүмкін болмады|Couldn't complete the action
Укажи корректную почту.|Дұрыс пошта мекенжайын көрсет.|Enter a valid email address.
Пароль должен содержать от 10 до 128 символов.|Құпиясөз 10–128 таңбадан тұруы керек.|The password must contain 10–128 characters.
Укажи имя и выбери роль.|Есіміңді көрсетіп, рөлді таңда.|Enter your name and choose a role.
Аккаунт с этой почтой уже существует.|Бұл поштаға тіркелген аккаунт бар.|An account with this email already exists.
Неверная почта или пароль.|Пошта не құпиясөз қате.|Incorrect email or password.
Слишком много попыток. Повтори через 15 минут.|Тым көп әрекет. 15 минуттан кейін қайтала.|Too many attempts. Try again in 15 minutes.
Сначала выйди из текущего аккаунта.|Алдымен ағымдағы аккаунттан шық.|Sign out of the current account first.
Сначала войди в аккаунт.|Алдымен аккаунтқа кір.|Sign in first.
Этот раздел недоступен для твоей роли.|Бұл бөлім сенің рөліңе қолжетімсіз.|This section is not available for your role.
Перед облачным диалогом нужно подтвердить передачу переписки Google в интерфейсе чата.|Бұлттық диалог алдында чатта хат алмасуды Google-ға беруге келісу керек.|Before using cloud chat, allow your conversation to be sent to Google using the checkbox in the chat.
Не удалось получить ответ языковой модели. Проверь запуск локального AI или настройки облачного подключения.|Тіл моделінен жауап алу мүмкін болмады. Жергілікті AI іске қосылғанын немесе бұлттық қосылым баптауларын тексер.|Couldn't get a response from the language model. Check the local AI server or cloud connection settings.
AI-провайдер отклонил ключ. Администратору нужно проверить подключение.|AI провайдері кілтті қабылдамады. Әкімші қосылымды тексеруі керек.|The AI provider rejected the key. The administrator needs to check the connection.
AI-провайдер запретил доступ. Проверь ключ, разрешения и доступность сервиса в регионе аккаунта.|AI провайдері қолжетімділікке тыйым салды. Кілтті, рұқсаттарды және аккаунт аймағындағы қызметтің қолжетімділігін тексер.|The AI provider denied access. Check the key, permissions and service availability in the account's region.
Выбранная AI-модель недоступна. Администратору нужно изменить модель в настройках подключения.|Таңдалған AI моделі қолжетімсіз. Әкімші қосылым баптауларында модельді өзгертуі керек.|The selected AI model is unavailable. The administrator needs to change the model in the connection settings.
Лимит AI-провайдера исчерпан. Попробуй позже или проверь квоту аккаунта.|AI провайдерінің лимиті аяқталды. Кейінірек қайтала немесе аккаунт квотасын тексер.|The AI provider's limit has been reached. Try later or check the account quota.
AI-провайдер отклонил запрос. Администратору нужно проверить настройки подключения.|AI провайдері сұрауды қабылдамады. Әкімші қосылым баптауларын тексеруі керек.|The AI provider rejected the request. The administrator needs to check the connection settings.
Введите задачу до 200 символов.|Тапсырманы 200 таңбадан асырмай енгіз.|Enter a task of up to 200 characters.
Выберите настроение и стресс от 1 до 5.|Көңіл күй мен күйзелісті 1–5 аралығында таңда.|Choose mood and stress ratings from 1 to 5.
Группа изменилась. Создай новое предложение для текущего куратора.|Топ өзгерді. Қазіргі кураторға жаңа ұсыныс жаса.|Your group has changed. Create a new proposal for your current curator.
Группа с таким кодом не найдена.|Бұл кодпен топ табылмады.|No group was found with this code.
Действие не найдено.|Әрекет табылмады.|Action not found.
Действие отменено или устарело. Попроси помощника предложить его заново.|Әрекет тоқтатылған немесе ескірген. Көмекшіден оны қайта ұсынуды сұра.|This action was cancelled or has expired. Ask the assistant to propose it again.
Для отправки нужен вход студента и вступление в группу.|Жіберу үшін студент болып кіріп, топқа қосылу қажет.|Sign in as a student and join a group before sending.
Задача не найдена|Тапсырма табылмады|Task not found
Задача не найдена в твоём плане.|Тапсырма жоспарыңнан табылмады.|The task was not found in your plan.
Менять статус может только куратор обращения.|Өтініш күйін тек оның кураторы өзгерте алады.|Only the request's curator can change its status.
Недопустимое действие помощника.|Көмекшінің әрекеті жарамсыз.|Invalid assistant action.
Недопустимое название задачи.|Тапсырма атауы жарамсыз.|Invalid task title.
Недопустимый источник запроса.|Сұрау көзі жарамсыз.|Invalid request origin.
Недопустимый статус.|Күйі жарамсыз.|Invalid status.
Недопустимый текст действия.|Әрекет мәтіні жарамсыз.|Invalid action text.
Нужны заголовок до 120 и текст до 4000 символов.|Тақырып 120, мәтін 4000 таңбадан аспауы керек.|A title of up to 120 characters and content of up to 4000 characters are required.
Обращение не найдено.|Өтініш табылмады.|Request not found.
Обращение недоступно.|Өтініш қолжетімсіз.|This request is unavailable.
Ожидается объект JSON.|JSON нысаны қажет.|A JSON object is required.
Ожидаются данные JSON.|JSON деректері қажет.|JSON data is required.
Опиши ситуацию и подтверди отправку куратору.|Жағдайды сипаттап, кураторға жіберуді раста.|Describe the situation and confirm sending it to your curator.
Опишите обращение: до 2000 символов.|Өтінішті 2000 таңбадан асырмай сипатта.|Describe your request in up to 2000 characters.
Ответ должен содержать от 1 до 2000 символов.|Жауап 1–2000 таңбадан тұруы керек.|The reply must contain 1–2000 characters.
Подтверди передачу имени куратору при вступлении в группу.|Топқа қосылғанда атыңды кураторға беруге келісетініңді раста.|Confirm sharing your name with the curator when joining the group.
Подтвердите сохранение обращения.|Өтінішті сақтауды раста.|Confirm saving the draft.
Помощник временно недоступен. Попробуй позже.|Көмекші уақытша қолжетімсіз. Кейінірек қайтала.|The assistant is temporarily unavailable. Try again later.
После смены аккаунта нужно создать новое действие.|Аккаунт ауысқаннан кейін жаңа әрекет жасау қажет.|Create a new action after switching accounts.
Сначала присоединись к группе по коду куратора.|Алдымен куратор коды арқылы топқа қосыл.|First join a group using your curator's code.
Сообщение должно содержать от 1 до 2000 символов.|Хабарлама 1–2000 таңбадан тұруы керек.|The message must contain 1–2000 characters.
Укажи университет и название группы.|Университет пен топ атауын көрсет.|Enter the university and group name.
Выполнено {0} из {1}|{1} тапсырманың {0} орындалды|Completed {0} of {1}
из {0} задач|{0} тапсырманың ішінен|of {0} tasks
{0} осталось|{0} қалды|{0} remaining
Задача №{0}|№{0} тапсырма|Task #{0}
Обращение №{0} · {1}|№{0} өтініш · {1}|Request #{0} · {1}
Студенты ({0})|Студенттер ({0})|Students ({0})
Настроение {0}/5 · Стресс {1}/5|Көңіл күй {0}/5 · Күйзеліс {1}/5|Mood {0}/5 · Stress {1}/5
Настроение {0} из 5|Көңіл күй {0}, 5-тен|Mood {0} out of 5
Стресс {0} из 5|Күйзеліс {0}, 5-тен|Stress {0} out of 5
Настроение {0}/5|Көңіл күй {0}/5|Mood {0}/5
Стресс {0}/5|Күйзеліс {0}/5|Stress {0}/5
Черновик · {0}|Жоба · {0}|Draft · {0}
Черновик ·|Жоба ·|Draft ·
Отметка|Белгі|Check-in
: настроение {0}/5, стресс {1}/5|: көңіл күй {0}/5, күйзеліс {1}/5|: mood {0}/5, stress {1}/5
Отметка {0}: настроение {1}/5, стресс {2}/5|{0} белгісі: көңіл күй {1}/5, күйзеліс {2}/5|Check-in {0}: mood {1}/5, stress {2}/5
{0} · 3 минуты|{0} · 3 минут|{0} · 3 min read
{0} · 2 минуты|{0} · 2 минут|{0} · 2 min read
3 минуты|3 минут|3 min read
2 минуты|2 минут|2 min read
Начни со списка ближайших дедлайнов. Выбери одно задание и сформулируй первый конкретный шаг: например, прочитать условие или составить план ответа. Выдели небольшой промежуток времени, затем сделай перерыв.|Алдымен алдағы мерзімдердің тізімін жаса. Бір тапсырманы таңдап, алғашқы нақты қадамды белгіле: мысалы, шартын оқу не жауап жоспарын құру. Аз уақыт бөліп, кейін үзіліс жаса.|Start by listing upcoming deadlines. Choose one assignment and define the first concrete step, such as reading the instructions or outlining your answer. Set aside a short period, then take a break.
Оставляй запас времени и место для отдыха. Если сроки пересекаются, уточни требования у преподавателя или обсуди нагрузку с куратором.|Қосымша уақыт пен демалысқа орын қалдыр. Мерзімдер қабаттасса, оқытушыдан талаптарды нақтыла немесе куратормен жүктемені талқыла.|Allow extra time and room for rest. If deadlines overlap, clarify the requirements with your teacher or discuss your workload with your curator.
Попробуй сейчас: добавь в личный план один небольшой шаг, который выполнишь сегодня.|Қазір байқап көр: бүгін орындайтын бір шағын қадамды жеке жоспарыңа қос.|Try it now: add one small step you can complete today to your plan.
Для знакомства не обязательно быть самым общительным человеком в группе. Можно начать с простого вопроса о расписании или предложить вместе подготовиться к занятию.|Танысу үшін топтағы ең ашық адам болу міндетті емес. Сабақ кестесі туралы қарапайым сұрақтан бастауға не сабаққа бірге дайындалуды ұсынуға болады.|You don't have to be the most outgoing person in your group to make friends. Start with a simple question about the timetable or suggest preparing for a class together.
Выбирай занятия по интересам: студенческий клуб, волонтёрство, спорт или совместный проект. Регулярные встречи помогают узнавать людей постепенно.|Қызығушылығыңа сай іс таңда: студенттік клуб, еріктілік, спорт не ортақ жоба. Тұрақты кездесулер адамдарды біртіндеп тануға көмектеседі.|Choose activities that interest you: a student club, volunteering, sport or a shared project. Regular meetings help you get to know people gradually.
Попробуй сейчас: выбери один комфортный способ начать разговор.|Қазір байқап көр: әңгіме бастаудың өзіңе ыңғайлы бір жолын таңда.|Try it now: choose one comfortable way to start a conversation.
Адаптация требует времени и сил. Полезно замечать собственную нагрузку и оставлять в расписании свободное время. Можно ненадолго отложить экран, прогуляться или заняться приятным делом.|Бейімделуге уақыт пен күш қажет. Жүктемеңді байқап, кестеңде бос уақыт қалдырған пайдалы. Экранды біраз уақытқа қойып, серуендеуге не ұнайтын іспен айналысуға болады.|Adapting takes time and energy. Notice your workload and leave some free time in your schedule. Step away from your screen, take a walk or do something you enjoy.
Короткие отметки состояния помогают вспомнить, какие дни были легче или труднее. Они не являются диагнозом.|Қысқаша белгілер қай күндер жеңіл не қиын болғанын еске түсіруге көмектеседі. Олар диагноз емес.|Quick check-ins help you remember which days felt easier or harder. They are not a diagnosis.
Если трудности сохраняются или мешают повседневной жизни, обратись к квалифицированному специалисту. Этот материал — общий пример для прототипа; перед пилотом содержание пройдёт экспертную проверку.|Қиындықтар ұзаққа созылса не күнделікті өмірге кедергі келтірсе, білікті маманға жүгін. Бұл материал — прототипке арналған жалпы мысал; пилот алдында мазмұнды мамандар тексереді.|If difficulties persist or affect your daily life, speak to a qualified professional. This is a general example for the prototype; the content will undergo expert review before the pilot.
`.trim().split('\n')) {
  const parts=row.split('|');
  if (parts.length!==3) throw Error('Invalid translation row: '+row);
  QadamI18n.add(...parts);
}
