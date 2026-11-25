const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load() {
  const root={nodeType:1,querySelectorAll:()=>[],closest:()=>false,hasAttribute:()=>false};
  const context=vm.createContext({NodeFilter:{SHOW_TEXT:4},document:{body:root,documentElement:{},createTreeWalker:()=>({nextNode:()=>false}),getElementById:()=>null}});
  vm.runInContext(fs.readFileSync('static/i18n.js','utf8')+'\nthis.i18n=QadamI18n;',context);
  return context.i18n;
}

test('Russian is the default; both translations include dynamic counters',()=>{
  const i=load();
  assert.equal(i.language,'ru');
  assert.equal(i.t('Мой день'),'Мой день');
  i.set('en',false);
  assert.equal(i.t('Мой день'),'My day');
  assert.equal(i.t('Выполнено 2 из 7'),'Completed 2 of 7');
  assert.equal(i.t('Учёба · 3 минуты'),'Studies · 3 min read');
  i.set('kk',false);
  assert.equal(i.t('Создать аккаунт'),'Аккаунт ашу');
  assert.equal(i.t('Студенты (12)'),'Студенттер (12)');
  i.set('ru',false);
  assert.equal(i.t('Выполнено 2 из 7'),'Выполнено 2 из 7');
});

test('unsupported locales and arbitrary content are preserved',()=>{
  const i=load();i.set('en',false);i.set('invalid',false);
  assert.equal(i.language,'en');
  assert.equal(i.t('Мой собственный текст студента'),'Мой собственный текст студента');
  assert.equal(i.t('  Главная  '),'  Home  ');
});

test('DOM localization skips user content and can restore Russian without replacing forms',()=>{
  const i=load();
  const parent={closest:()=>false};
  const own={nodeValue:'Главная',parentElement:parent};
  const user={nodeValue:'Главная',parentElement:{closest:()=>true}};
  const code=fs.readFileSync('static/i18n.js','utf8');
  const root={nodeType:1,querySelectorAll:()=>[],hasAttribute:()=>false,closest:()=>false};
  const context=vm.createContext({NodeFilter:{SHOW_TEXT:4},document:{body:root,documentElement:{},getElementById:()=>null,createTreeWalker:()=>{let n=0;return {currentNode:null,nextNode(){this.currentNode=[own,user][n++];return !!this.currentNode;}};}}});
  vm.runInContext(code+"\nQadamI18n.set('en',false);",context);
  assert.equal(own.nodeValue,'Home');assert.equal(user.nodeValue,'Главная');
  vm.runInContext("QadamI18n.set('ru',false);",context);
  assert.equal(own.nodeValue,'Главная');
});

test('real page templates render tasks and do not claim that an unconfigured AI is Qwen',()=>{
  const root={nodeType:1,querySelectorAll:()=>[],closest:()=>false,hasAttribute:()=>false};
  const context=vm.createContext({NodeFilter:{SHOW_TEXT:4},document:{body:root,documentElement:{},getElementById:()=>null,createTreeWalker:()=>({nextNode:()=>false})}});
  vm.runInContext(fs.readFileSync('static/i18n.js','utf8'),context);
  const source=fs.readFileSync('static/app.js','utf8');
  vm.runInContext(source.slice(0,source.indexOf("document.addEventListener('click'")),context);
  vm.runInContext(`state={tasks:[{id:1,title:'Главная',category:'Моя задача',done:0}],messages:[],ai:{configured:false},settings:{}};`,context);
  const tasks=vm.runInContext('tasksHTML()',context);
  assert.match(tasks,/task-title[^>]+data-no-i18n>Главная/);
  const chat=vm.runInContext('chat()',context);
  assert.match(chat,/AI-помощник ещё не подключён/);
  assert.doesNotMatch(chat,/Локальная языковая модель Qwen3/);
});
