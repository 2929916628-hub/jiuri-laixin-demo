/* 本部分自己的逻辑：只操作 .screen 里面的元素，跟总入口打交道只用 JRLX */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // 部分内部换页：home 是 tab 首页（显示底栏），其余是子页面（隐藏底栏）
  function show(name) {
    $$('.page').forEach(p => p.classList.toggle('on', p.dataset.page === name));
    JRLX.tabbar(name === 'home');
    JRLX.sound('tap');
  }
  $$('[data-goto]').forEach(b => b.addEventListener('click', () => show(b.dataset.goto)));
  $$('[data-jump]').forEach(b => b.addEventListener('click', () => JRLX.go(b.dataset.jump)));

  let count = JRLX.load('count', 0);
  $('#plus').addEventListener('click', () => {
    count++; JRLX.save('count', count); $('#count').textContent = count;
    if (count % 5 === 0) JRLX.toast('已经点了 ' + count + ' 次');
  });

  // 共享数据到了再填内容（独立预览时是假数据）
  JRLX.ready(state => {
    $('#who').textContent = state.person.name;
    $('#count').textContent = count;
  });
  // 每次切回这个部分，回到首页
  JRLX.onEnter(() => show('home'));
})();
