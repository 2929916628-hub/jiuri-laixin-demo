/* 我的（parts/mine）：只操作 .screen 里的元素，跟总入口打交道只用 JRLX */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- 部分内部换页：home 是 tab 首页（显示底栏），其余是子页面（隐藏底栏） ---------- */
  function show(name) {
    $$('.page').forEach(p => p.classList.toggle('on', p.dataset.page === name));
    JRLX.tabbar(name === 'home');
    JRLX.sound('tap');
  }
  $$('[data-goto]').forEach(b => b.addEventListener('click', () => show(b.dataset.goto)));

  /* ---------- 只提示、不真做的行（演示版占位） ---------- */
  $$('[data-toast]').forEach(b => b.addEventListener('click', () => {
    JRLX.sound('tap');
    JRLX.toast(b.dataset.toast);
  }));

  /* ---------- 开关：点击切换 + JRLX.save 存档；整行都可点 ---------- */
  function bindSwitch(id, key, def, onChange) {
    const el = $('#' + id);
    const render = v => { el.classList.toggle('on', v); el.setAttribute('aria-checked', String(v)); };
    render(JRLX.load(key, def));
    const fire = () => {
      if (el.classList.contains('dis')) return;
      const v = !el.classList.contains('on');
      render(v); JRLX.save(key, v); JRLX.sound('tick');
      if (onChange) onChange(v);
    };
    el.addEventListener('click', fire);
    const row = el.closest('.row');
    if (row) row.addEventListener('click', e => { if (e.target !== el && !el.contains(e.target)) fire(); });
  }

  // 账号与安全：记住登录信息
  bindSwitch('swRemember', 'remember_login', true);

  // 通知设置：主开关关闭时，两个子开关禁用
  function syncNotifSub(mainOn) {
    ['swNotifFloat', 'swNotifDevice'].forEach(sid => {
      const s = $('#' + sid);
      s.classList.toggle('dis', !mainOn);
      s.setAttribute('aria-disabled', String(!mainOn));
    });
  }
  bindSwitch('swNotifMain', 'notif_main', true, syncNotifSub);
  bindSwitch('swNotifFloat', 'notif_float', true);
  bindSwitch('swNotifDevice', 'notif_device', true);
  syncNotifSub(JRLX.load('notif_main', true));

  // 界面与显示：深色模式只记录偏好（演示版无深色设计稿）；横屏开关只存档
  bindSwitch('swDark', 'dark_mode', false, () => JRLX.toast('已记录偏好，演示版暂不切换'));
  bindSwitch('swLandscape', 'landscape_mode', false);

  // 字体大小：标准 → 大 → 特大 循环（只记录，不改绝对定位布局）
  const SIZES = ['标准', '大', '特大'];
  let fontSize = JRLX.load('font_size', '标准');
  $('#fontVal').textContent = fontSize;
  $('#btnFont').addEventListener('click', () => {
    fontSize = SIZES[(SIZES.indexOf(fontSize) + 1) % SIZES.length];
    JRLX.save('font_size', fontSize);
    $('#fontVal').textContent = fontSize;
    JRLX.sound('tap');
  });

  /* ---------- 系统权限：点击行翻转授权状态（模拟），已开启 / 未开启 ---------- */
  $$('[data-perm]').forEach(row => {
    const st = row.querySelector('.perm-st');
    const read = () => JRLX.load(row.dataset.perm, row.dataset.def === '1');
    const render = v => { st.textContent = v ? '已开启' : '未开启'; st.classList.toggle('off', !v); };
    render(read());
    row.addEventListener('click', () => {
      const v = !read();
      JRLX.save(row.dataset.perm, v);
      render(v);
      JRLX.sound('tick');
      JRLX.toast((v ? '已开启' : '已关闭') + row.dataset.name + '权限（演示）');
    });
  });

  /* ---------- 协议文档页：用户协议 / 隐私政策共用 ---------- */
  const DOCS = {
    '用户协议': [
      '欢迎使用「旧日来信」。本应用用于保存与分享你和记忆中的人之间的信件与故事。',
      '你创建的空间、信件和上传的素材仅保存在本机，演示版不会上传到任何服务器。',
      '请遵守法律法规，不要利用本应用侵害他人的合法权益。',
      '本协议为课程演示占位文本，正式条款以发布版为准。',
    ],
    '隐私政策': [
      '「旧日来信」尊重并保护你的隐私。',
      '你的姓名、关系、时期等信息仅用于生成属于你的记忆空间；照片与信件保存在本机，演示版不收集、不上传。',
      '系统权限（照片、相机、麦克风等）仅在你主动使用对应功能时请求，可随时在系统设置中关闭。',
      '本政策为课程演示占位文本，正式条款以发布版为准。',
    ],
  };
  $$('[data-doc]').forEach(b => b.addEventListener('click', () => {
    const t = b.dataset.doc;
    $('#docTitle').textContent = t;
    $('#docBody').innerHTML = DOCS[t].map(x => '<p>' + x + '</p>').join('');
    show('doc');
  }));

  /* ---------- 注销账号：底部确认层 ---------- */
  const mask = $('#quitMask'), sheet = $('#quitSheet');
  const closeQuit = () => { mask.classList.remove('on'); sheet.classList.remove('on'); };
  $('#btnQuit').addEventListener('click', () => { mask.classList.add('on'); sheet.classList.add('on'); JRLX.sound('tap'); });
  $('#quitCancel').addEventListener('click', () => { closeQuit(); JRLX.sound('tap'); });
  mask.addEventListener('click', closeQuit);
  $('#quitConfirm').addEventListener('click', () => { closeQuit(); JRLX.toast('账号已注销（演示）'); });

  /* ---------- 寄信人：「我的」是使用者自己的主页，不读 state.person（那是信里的 TA）；昵称和简介走本部分存档 ---------- */
  $('#pName').textContent = JRLX.load('nickname', '小满');
  $('#pBio').textContent = JRLX.load('bio', '这个人还没写简介');

  // 每次切回这个部分，回到首页
  JRLX.onEnter(() => { closeQuit(); show('home'); });
})();
