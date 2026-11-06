/* 旧日来信 · bridge.js —— 各部分和总入口之间唯一的连接方式（只由总负责人维护）
   用法：<script src="../../shared/bridge.js"></script> 放在自己 js 前面，然后用全局 JRLX。

   JRLX.part            当前部分名（取自路径 parts/<名字>/）
   JRLX.embedded        true = 在总入口里运行；false = 自己单独打开预览
   JRLX.ready(cb)       拿到共享数据后执行 cb(state)；页面初始化都写在这里面
   JRLX.state           共享数据（只读），字段见 协作约定.md 第 4 节
   JRLX.onEnter(cb)     每次用户切到这个部分时调用（比如从别的 tab 切回来）
   JRLX.go(to)          跳到别的部分：'space' | 'letters' | 'custom' | 'mine' | 'restart'
   JRLX.tabbar(show)    显示 / 隐藏底栏（进全屏子页面时隐藏，返回 tab 首页时显示）
   JRLX.toast(msg)      底部轻提示
   JRLX.sound(name)     音效：'tap' | 'flip' | 'tick' | 'crack' | 'unfold'
   JRLX.save(key, v) / JRLX.load(key, fallback)   本部分自己的存档（localStorage，自动加前缀） */
(() => {
  'use strict';

  const m = location.pathname.match(/\/parts\/([^/]+)\//);
  const part = m ? decodeURIComponent(m[1]) : 'unknown';
  const embedded = window.parent !== window;

  // 独立预览时用的假数据，字段和总入口传来的一模一样
  const MOCK = {
    person: { kind: 'ta', name: '外婆', relation: '外婆', period: '一九九八年春', impression: '院子里的花' },
    letters: [
      { to: '给 外婆', addr: '老房子 · 一九九八年春', subj: '关于院子里的花' },
      { to: '给 阿杰', addr: '篮球场 · 二〇〇〇年夏', subj: '那年夏天的风扇' },
      { to: '给 妈妈', addr: '老房子 · 二〇〇三年夏', subj: '四年以后' },
    ],
    media: [],
  };

  let state = null;
  const readyCbs = [], enterCbs = [];
  const send = (action, data) => { if (embedded) parent.postMessage({ type: 'jrlx-part', part, action, ...data }, location.origin); };
  const setState = s => {
    state = Object.freeze({ person: { ...MOCK.person, ...(s.person || {}) }, letters: s.letters || MOCK.letters, media: s.media || [] });
    readyCbs.splice(0).forEach(cb => cb(state));
  };

  addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'jrlx-shell') return;
    if (e.data.action === 'init') setState(e.data.state || {});
    if (e.data.action === 'enter') { if (e.data.state) setState(e.data.state); enterCbs.forEach(cb => cb(state)); }
  });

  // ---------- 独立预览：套手机外框、画底栏占位、跳转只提示不真跳 ----------
  let soloTabbar = null, soloLog = null, logT = 0;
  function soloLogMsg(msg) {
    if (!soloLog) return console.log('[JRLX]', msg);
    soloLog.textContent = msg; soloLog.classList.add('on');
    clearTimeout(logT); logT = setTimeout(() => soloLog.classList.remove('on'), 2000);
  }
  if (!embedded) {
    document.documentElement.classList.add('jrlx-solo');
    addEventListener('DOMContentLoaded', () => {
      const screen = document.querySelector('.screen');
      if (!screen) { console.warn('[JRLX] 页面里没有 <main class="screen">，请按模板写'); }
      else {
        const fit = () => { const s = Math.min((innerWidth - 40) / 402, (innerHeight - 40) / 874, 1); screen.style.transform = `scale(${s})`; };
        fit(); addEventListener('resize', fit);
        soloTabbar = document.createElement('div'); soloTabbar.className = 'jrlx-solo-tabbar';
        soloTabbar.textContent = '底栏区域（合并后由总入口显示，别在这里放内容）';
        screen.appendChild(soloTabbar);
      }
      soloLog = document.createElement('div'); soloLog.className = 'jrlx-solo-log'; document.body.appendChild(soloLog);
      setState(MOCK);
    });
  }

  const TARGETS = ['space', 'letters', 'custom', 'mine', 'restart'];
  window.JRLX = {
    part, embedded,
    get state() { return state; },
    ready(cb) { state ? cb(state) : readyCbs.push(cb); },
    onEnter(cb) { enterCbs.push(cb); },
    go(to) {
      if (!TARGETS.includes(to)) return console.warn('[JRLX] go() 只能跳到：' + TARGETS.join(' / '));
      embedded ? send('go', { to }) : soloLogMsg('（独立预览）这里会跳到：' + to);
    },
    tabbar(show = true) {
      embedded ? send('tabbar', { show: !!show }) : soloTabbar && (soloTabbar.style.display = show ? '' : 'none');
    },
    toast(msg) { embedded ? send('toast', { msg: String(msg) }) : soloLogMsg(msg); },
    sound(name) { embedded ? send('sound', { name }) : 0; },
    save(key, v) { try { localStorage.setItem(`jrlx.${part}.${key}`, JSON.stringify(v)); } catch (e) {} },
    load(key, fallback = null) { try { const v = localStorage.getItem(`jrlx.${part}.${key}`); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
  };

  if (embedded) addEventListener('DOMContentLoaded', () => send('ready', {}));
})();
