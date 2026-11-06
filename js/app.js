/* 旧日来信 · 01.1 记忆空间 交互 Demo
   画面坐标全部按 402 × 874 设计稿（Figma「01.1 交互原型｜可点击 Demo」）。 */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const W = 402, H = 874;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const FIG = 'assets/fig/';

  const device = $('#device'), screen = $('#screen');
  let S = 1;

  /* ================= 内联的矢量数据 =================
     直接双击 index.html（file://）时，浏览器会拦截外部 SVG 做的 CSS 蒙版和 fetch，
     纸盘、横线纸会整块不显示、手绘圈读不到 —— 所以这几样直接写在这里。 */
  const svgUrl = s => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
  // 横线纸：底部圆角 + 顶部四孔（Figma「纸张蒙版 · 顶部4孔」）
  const PAPER_D = 'M402 676C402 710.242 374.242 738 340 738H62C27.7583 738 0 710.242 0 676V0H402V676ZM43.4727 18.4102C31.3266 18.4102 21.4805 28.2563 21.4805 40.4023C21.4805 52.5484 31.3266 62.3945 43.4727 62.3945C55.6186 62.3944 65.4648 52.5483 65.4648 40.4023C65.4648 28.2564 55.6186 18.4103 43.4727 18.4102ZM123.292 16.3701C111.146 16.3703 101.3 26.2164 101.3 38.3623C101.3 50.5082 111.146 60.3543 123.292 60.3545C135.438 60.3545 145.285 50.5084 145.285 38.3623C145.285 26.2163 135.438 16.3701 123.292 16.3701ZM234.792 16.3701C222.646 16.3703 212.8 26.2164 212.8 38.3623C212.8 50.5082 222.646 60.3543 234.792 60.3545C246.938 60.3545 256.785 50.5084 256.785 38.3623C256.785 26.2163 246.938 16.3701 234.792 16.3701ZM353.393 16.3701C341.247 16.3701 331.4 26.2163 331.4 38.3623C331.4 50.5084 341.247 60.3545 353.393 60.3545C365.538 60.3543 375.385 50.5083 375.385 38.3623C375.385 26.2164 365.538 16.3703 353.393 16.3701Z';
  // 手绘圈（Figma「Vector 673」，5px 描边）
  const HAND_D = 'M31.8495 15.77C26.9789 16.4618 20.9204 19.2499 17.3042 22.1639C13.6883 25.0775 11.5986 29.9554 8.91521 34.6198C6.3875 39.0137 5.07188 43.9312 4.01673 50.7863C2.66333 59.5792 4.35914 66.7676 5.63441 70.017C10.9984 83.6841 25.77 94.4956 31.5944 96.5884C36.5487 98.3687 43.687 98.2271 51.3771 98.8071C66.5018 99.9479 71.1913 97.7659 75.8557 96.833C80.5697 95.8902 86.0895 93.3496 91.2291 90.3203C98.7352 85.8962 105.432 76.355 109.17 70.5306C112.122 65.9327 111.511 55.6708 110.236 48.5153C109.297 43.246 107.333 39.0816 104.999 34.7701C102.511 30.1749 98.9472 26.5034 94.7579 22.0766C90.0996 17.1541 84.5102 14.3864 80.6634 11.5877C75.9313 8.14505 68.6896 5.30216 53.9592 2.5C13.4574 3.88358 10.4316 5.51875 8.10814 6.09876C6.93766 6.44815 5.78465 6.90934 2.50032 7.38451';
  // 纸盘：半径 300 的圆 + 每 15° 一个孔
  const ring = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
  let DISC_D = ring(300, 300, 300);
  for (let a = 0; a < 360; a += 15) DISC_D += ring(300 + 262 * Math.sin(a * Math.PI / 180), 300 - 262 * Math.cos(a * Math.PI / 180), 15);
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--paper-mask', svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="402" height="738" viewBox="0 0 402 738"><path fill-rule="evenodd" d="${PAPER_D}"/></svg>`));
  rootStyle.setProperty('--disc-mask', svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><path fill-rule="evenodd" d="${DISC_D}"/></svg>`));
  const IS_FILE = location.protocol === 'file:';

  /* ================= 缩放适配 ================= */
  function isMobile() { return matchMedia('(max-width: 760px), (max-height: 560px)').matches; }
  function fit() {
    const vw = innerWidth, vh = innerHeight, mobile = isMobile();
    // 手机上打字时键盘会把可视高度压矮：这时不重新缩放（否则整个画面会缩小），键盘收起后再算
    if (mobile && document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) && S > 0 && fit.done) return;
    // 真手机在房间里：跟着手机实际的方向走，横过来就用横屏画面（电脑上由 enterRoom / turnDevice 转）
    if (mobile) device.classList.toggle('land', !!document.querySelector('#v-room.on') && vw > vh);
    const land = device.classList.contains('land');
    const w = land ? H : W, h = land ? W : H;
    S = mobile ? Math.min(vw / w, vh / h) : Math.min((vh - 56) / h, (vw - 480) / w, 1.15);
    document.documentElement.style.setProperty('--s', S);
    fit.done = true;
  }
  addEventListener('focusout', () => setTimeout(fit, 250)); // 键盘收起
  addEventListener('resize', fit);
  fit();
  const toLocal = e => { const r = screen.getBoundingClientRect(); return { x: (e.clientX - r.left) / S, y: (e.clientY - r.top) / S }; };

  /* ================= 声音（WebAudio 现场合成，无音频文件） ================= */
  const Sound = {
    ctx: null, on: true, noiseBuf: null, rustleNode: null, rustleGain: null,
    init() {
      if (this.ctx) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        const len = this.ctx.sampleRate * 1.5, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.random());
        this.noiseBuf = buf;
      } catch (e) { this.ctx = null; }
    },
    burst({ freq = 2400, q = 0.8, dur = 0.12, gain = 0.25, type = 'bandpass', delay = 0 } = {}) {
      if (!this.on || !this.ctx) return;
      const c = this.ctx, t = c.currentTime + delay;
      const src = c.createBufferSource(); src.buffer = this.noiseBuf;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(c.destination); src.start(t, Math.random()); src.stop(t + dur + 0.05);
    },
    rustleStart() {
      if (!this.on || !this.ctx || this.rustleNode) return;
      const c = this.ctx;
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.6;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      const g = c.createGain(); g.gain.value = 0;
      src.connect(f).connect(hp).connect(g).connect(c.destination); src.start();
      this.rustleNode = src; this.rustleGain = g; this.rustleFilter = f;
    },
    rustle(speed) { // speed：px/ms
      if (!this.rustleGain) return;
      const t = this.ctx.currentTime, v = clamp(Math.abs(speed) * 0.22, 0, 0.32);
      this.rustleGain.gain.setTargetAtTime(v * (0.75 + Math.random() * 0.5), t, 0.03);
      this.rustleFilter.frequency.setTargetAtTime(2400 + Math.random() * 1800, t, 0.05);
    },
    rustleStop() {
      if (!this.rustleNode) return;
      const n = this.rustleNode, g = this.rustleGain, t = this.ctx.currentTime;
      g.gain.setTargetAtTime(0, t, 0.06); n.stop(t + 0.3);
      this.rustleNode = this.rustleGain = null;
    },
    tap() { this.burst({ freq: 1800, q: 1.2, dur: 0.05, gain: 0.12 }); },
    flip() { this.burst({ freq: 1600, q: 0.5, dur: 0.22, gain: 0.16 }); this.burst({ freq: 3000, q: 0.7, dur: 0.12, gain: 0.08, delay: 0.12 }); },
    tick() { this.burst({ freq: 2600, q: 2, dur: 0.035, gain: 0.07 }); },
    crack() { this.burst({ freq: 900, q: 1.5, dur: 0.08, gain: 0.4, type: 'lowpass' }); this.burst({ freq: 2200, q: 3, dur: 0.06, gain: 0.25, delay: 0.03 }); },
    unfold() { [0, .09, .2, .34].forEach((d, i) => this.burst({ freq: 2000 + i * 500, q: 0.6, dur: 0.14, gain: 0.12, delay: d })); },
  };
  addEventListener('pointerdown', () => { Sound.init(); if (Sound.ctx && Sound.ctx.state === 'suspended') Sound.ctx.resume(); }, { passive: true });

  /* ================= 小工具：弹簧动画 ================= */
  function spring(from, to, { k = 170, c = 20, v = 0, onUpdate, onDone, eps = 0.0008 } = {}) {
    let x = from, vel = v, last = performance.now(), id;
    const step = now => {
      const dt = Math.min(0.032, (now - last) / 1000); last = now;
      const a = -k * (x - to) - c * vel; vel += a * dt; x += vel * dt;
      if (Math.abs(x - to) < eps && Math.abs(vel) < eps * 10) { onUpdate(to); onDone && onDone(); return; }
      onUpdate(x); id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return { stop: () => cancelAnimationFrame(id) };
  }
  function tween(dur, onUpdate, ease = t => 1 - Math.pow(1 - t, 3)) {
    return new Promise(res => {
      const t0 = performance.now();
      const step = now => { const t = clamp((now - t0) / dur, 0, 1); onUpdate(ease(t)); t < 1 ? requestAnimationFrame(step) : res(); };
      requestAnimationFrame(step);
    });
  }
  const toastEl = $('#toast'); let toastT;
  function toast(msg, ms = 1800) { toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), ms); }

  /* ================= 图标（与 Figma 组件「底栏图标」「返回图标」同源） ================= */
  const INK = '#1B0D00', MUS = '#C89A3E', SAGE = '#8FA37E', TER = '#B5654A';
  const st = (w = 2.6) => `fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
  const blk = (d, c) => `<path d="${d}" fill="${c}" transform="translate(2.5 2.5)"/>`;
  const head = `<path d="M32 17 C37 16.9 41 20.9 41 26 C41 31 37 35 32 35 C27 35.1 23 31.1 23 26 C23 21 27 17.1 32 17 Z" ${st()}/><path d="M20 47 Q21.5 38 32 38 Q42.5 38 44 47" ${st()}/>`;
  // 底栏图标拆成可动的部件：未选中 = 关着，选中 = 打开（动画写在 CSS 的 .tab.active 规则里）
  const TAB_SVG = {
    // 信封：封口以 y=21 为折线向上翻；信纸藏在口袋里（clipPath 只露出口袋 V 线以上），选中时升起
    space: `<svg class="ic ic-space" viewBox="0 0 64 64">
      <defs><clipPath id="envPocket"><path d="M0 0H64V21H54L32 37L10 21H0Z"/></clipPath></defs>
      <path class="e-flapblk" d="M10 21 L32 38 L54 21 Z" fill="${MUS}" transform="translate(2.5 2.5)"/>
      <path d="M10 21 L32 37 L54 21 L54 51 L10 51 Z" fill="${MUS}" transform="translate(2.5 2.5)"/>
      <g clip-path="url(#envPocket)"><g class="e-letter">
        <path d="M17.5 36 L17.8 9.5 L46.2 9.2 L46.5 36 Z" fill="#FFFDF8" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
        <path d="M23 16.2 L38 16" ${st()}/><path d="M23 22.4 L33 22.3" ${st()}/>
      </g></g>
      <path d="M12 21 L52 20.8 Q54 20.8 54 22.8 L54.2 49 Q54.2 51 52.2 51 L12 51.2 Q10 51.2 10 49.2 L9.8 23 Q9.8 21 12 21 Z" ${st()}/>
      <path d="M10.5 22 L32 37 L53.5 22" ${st()}/>
      <g class="e-flap">
        <path d="M10.5 21.2 L31.6 38 Q32 38.3 32.4 38 L53.5 21" ${st()}/>
        <circle class="e-wax" cx="32" cy="35.4" r="3" fill="#FFFDF8" stroke="${INK}" stroke-width="2.2"/>
      </g>
    </svg>`,
    // 纪念册：封面向书脊（x=18）合拢收起，摊开的两页从书脊 x=32 向两边展开，书签带最后落下
    create: `<svg class="ic ic-create" viewBox="0 0 64 64">
      <g class="a-closed">
        ${blk('M26.5 22 L45 22.3 L44.8 31 L26.3 30.8 Z', MUS)}${blk('M40.5 54 L40.5 60 L43.2 57.8 L46 60 L46 54 Z', TER)}
        <path d="M14 10 L50 10.5 Q52 10.5 52 12.5 L52.3 51.8 Q52.3 53.8 50.3 53.8 L14 54 Q11 54 11 51 L11 13 Q11 10 14 10 Z" ${st()}/>
        <path d="M18 10.3 L18 53.9" ${st()}/><path d="M26.5 22 L45 22.3 L44.8 31 L26.3 30.8 Z" ${st()}/><path d="M40.5 54 L40.5 60 L43.2 57.8 L46 60 L46 54" ${st()}/>
      </g>
      <g class="a-open">
        ${blk('M15 24 L26 25 L25.5 36 L14.5 35 Z', MUS)}
        <path d="M32 18 Q22 13 9 15.5 L9 50 Q22 48 32 53" ${st()}/><path d="M32 18 Q42 13 55 15.5 L55 50 Q42 48 32 53" ${st()}/><path d="M32 18 L32 53" ${st()}/>
        <path d="M15 24 L26 25 L25.5 36 L14.5 35 Z" ${st()}/>
        <g class="a-rib">${blk('M44 15 L44 30 L47.5 27 L51 30 L51 15.2 Z', TER)}<path d="M44 15 L44 30 L47.5 27 L51 30 L51 15.2" ${st()}/></g>
      </g>
    </svg>`,
    // 头像邮票：右下角卷起（盖一块底栏纸色 + 折起的三角），选中时展平；人像眨眼睁开、笑
    mine: `<svg class="ic ic-mine" viewBox="0 0 64 64">
      ${blk('M15.5 12.5 L48.5 12.2 L48.8 51.5 L15.2 51.8 Z', SAGE)}
      <rect x="9.5" y="6.5" width="45" height="51" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-dasharray="0.1 5.2"/>
      <path d="M15.5 12.5 L48.5 12.2 L48.8 51.5 L15.2 51.8 Z" ${st()}/>
      ${head}
      <g class="m-shut"><path d="M26.6 25.6 Q28.6 27.4 30.6 25.6 M33.4 25.6 Q35.4 27.4 37.4 25.6" ${st(2)}/></g>
      <g class="m-open"><circle cx="28.6" cy="25.4" r="1.5" fill="${INK}"/><circle cx="35.4" cy="25.4" r="1.5" fill="${INK}"/><path d="M29 29.6 Q32 32 35 29.6" ${st(2)}/></g>
      <g class="m-curl">
        <path d="M58 40.4 L58 61 L38 61 Z" fill="#F4F4F4"/>
        <path d="M54.5 44 L41.5 57.5 L41 44.5 Z" fill="#FFFDF8" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
      </g>
    </svg>`,
  };
  const BACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M17 6.4 C23 6.3 27.9 11.1 27.8 17.2 C27.7 23.2 23 28.1 17 28 C10.9 28.1 6.1 23.3 6.2 17.2 C6.3 11.2 11 6.5 17 6.4 Z" fill="${MUS}"/><path d="M19.6 6.8 Q15.2 11.1 11 15.5 Q10.5 16 11 16.5 Q15.2 20.9 19.8 25.2" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const BACK_URL = `url("data:image/svg+xml,${encodeURIComponent(BACK_SVG)}")`;
  const CHEV = `<svg viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 5.5 L15.5 12 L9.5 18.5"/></svg>`;

  // 粗糙边主按钮（手撕纸胶带感），取 #F6B840
  function roughButtonBg(w = 370, h = 48) {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pts = [];
    for (let x = 6; x <= w - 6; x += 9) pts.push([x, 2 + rnd() * 3]);
    for (let y = 4; y <= h - 4; y += 4) pts.push([w - 1 - rnd() * 6, y]);
    for (let x = w - 6; x >= 6; x -= 9) pts.push([x, h - 2 - rnd() * 3]);
    for (let y = h - 4; y >= 4; y -= 4) pts.push([1 + rnd() * 6, y]);
    const d = 'M' + pts.map(p => p.map(v => v.toFixed(1)).join(' ')).join(' L') + ' Z';
    return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' preserveAspectRatio='none'><path d='${d}' fill='#F6B840'/></svg>`)}")`;
  }
  const BUILD_BG = roughButtonBg();

  /* ================= 底栏 ================= */
  const tabbar = $('#tabbar');
  $$('.ti', tabbar).forEach(el => { el.innerHTML = TAB_SVG[el.dataset.icon]; });
  // 手绘圈：每个 tab 一份，沿原笔顺「一笔画出来」（pathLength=1 + stroke-dashoffset）
  const circles = {};
  $('#tabCircle').remove();
  [['space', -4.5], ['create', 129], ['mine', 262.5]].forEach(([k, dx]) => { // 圈的中心对准每格中心（67.5 / 201 / 334.5）
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'hc'); s.setAttribute('viewBox', '-3 -3 119.793 107.629'); s.style.left = (15.1 - 3 + dx) + 'px';
    s.innerHTML = `<path d="${HAND_D}" pathLength="1" fill="none" stroke="#1B0D00" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
    tabbar.insertBefore(s, $('.tab', tabbar)); circles[k] = s;
  });
  let currentTab = 'space';
  function setTab(tab, animate = true) {
    currentTab = tab;
    tabbar.classList.toggle('instant', !animate);
    $$('.tab', tabbar).forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    Object.entries(circles).forEach(([k, s]) => s.classList.toggle('on', k === tab));
    if (!animate) requestAnimationFrame(() => requestAnimationFrame(() => tabbar.classList.remove('instant')));
  }
  $$('.tab', tabbar).forEach(b => b.addEventListener('click', () => {
    const t = b.dataset.tab; Sound.tap();
    if (t === 'space') go(state.hasLetters ? 'letters' : 'box', 'fade');
    else go(t, 'fade');
  }));

  /* ================= 视图切换 ================= */
  const views = Object.fromEntries($$('.view').map(v => [v.dataset.view, v]));
  const TABBED = { box: 'space', letters: 'space', create: 'create', mine: 'mine' };
  const state = { view: 'launch', hasLetters: true, kind: 'self', twin: false, busy: false };
  let z = 10;

  const OVER = new Set(['box', 'form']);
  async function go(name, how = 'fade') {
    if (state.busy || name === state.view) return;
    const from = views[state.view], to = views[name];
    state.busy = true;
    // 已经有信时，「为谁创建」纸箱和表单都浮在信件页上：信件页留在底下虚化，它们不铺自己的箱子背景
    const overLetters = OVER.has(name) && state.hasLetters;
    if (overLetters) {
      to.classList.add('over'); views.letters.classList.add('behind');
      if (!views.letters.classList.contains('on')) { views.letters.style.zIndex = ++z; views.letters.classList.add('on'); }
    }
    const leavingOver = from.classList.contains('over') && !overLetters; // 回到信件页（或别处）：信封变回清楚
    if (leavingOver) views.letters.classList.remove('behind');
    to.style.zIndex = ++z;
    to.classList.add('on');
    // 从启动页、定制、我的进到空间：信封从上往下一封封落进来（从纸箱 / 表单 / 房间回来不落）
    if (name === 'letters' && !OVER.has(state.view) && state.view !== 'room') dropLetters();
    const tabbed = TABBED[name];
    if (tabbed) { tabbar.classList.add('on'); setTab(tabbed, !(TABBED[state.view] && currentTab === tabbed)); tabbar.style.zIndex = z + 1; tabbar.style.transform = ''; }
    if (how === 'fade') await to.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' }).finished;
    else if (how === 'up') await to.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)' }).finished;
    else if (how === 'down') { from.style.zIndex = ++z; await from.animate([{ transform: 'none' }, { transform: 'translateY(100%)' }], { duration: 380, easing: 'cubic-bezier(.5,0,.75,0)' }).finished; }
    else if (how === 'sheet') { // 表单：纸从屏幕下面弹上来（冲过头一点再落稳），背后的纱罩淡入
      const rise = [{ transform: 'translateY(780px)' }, { transform: 'translateY(-14px)', offset: 0.72 }, { transform: 'translateY(3px)', offset: 0.88 }, { transform: 'none' }];
      const opt = { duration: 640, easing: 'cubic-bezier(.22,.7,.3,1)' };
      to.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
      await Promise.all([$('.sheet', to).animate(rise, opt).finished, $('.tape', to).animate(rise, { ...opt, delay: 30 }).finished]);
    }
    else if (how === 'sheetdown') { // 收表单：纸往下滑走，纱罩淡出，露出底下的纸箱
      from.style.zIndex = ++z;
      const fall = [{ transform: 'none' }, { transform: 'translateY(800px)' }], opt = { duration: 380, easing: 'cubic-bezier(.5,0,.75,0)' };
      await Promise.all([$('.sheet', from).animate(fall, opt).finished, $('.tape', from).animate(fall, opt).finished,
        from.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: 'ease-in' }).finished]);
    }
    if (!tabbed) tabbar.classList.remove('on');
    if (from !== views.letters || !overLetters) from.classList.remove('on');
    if (from !== to && from.classList.contains('over') && from !== views.letters) from.classList.remove('over');
    if (name === 'box') renderPull(); // 底栏按纸盘拉出的程度让开，不压在纸盘上
    if (leavingOver && name !== 'letters') views.letters.classList.remove('on');
    state.view = name; state.busy = false;
    $('#boxBack').classList.toggle('on', name === 'box' && state.hasLetters);
    if (name === 'letters') resetNewSpace();
    onEnter[name] && onEnter[name]();
  }
  const onEnter = {};

  /* ================= 01 启动页 ================= */
  const DECO = [ // 取自 Figma 屏幕 4001:4361（容器 left/top/w/h，图片 w/h/旋转）
    ['env', -47, 366, 177.251, 161.575, 'env_papa', 146.489, 100.313, -31.11],
    ['env', -35.01, 481.15, 161.229, 124.965, 'env_xiaofang', 142.579, 91.658, 14.76],
    ['env', -92, 141, 161.229, 124.965, 'env_xiaofang', 142.579, 91.658, 14.76],
    ['env', -28.74, 578.64, 175.865, 141.186, 'env_waipo', 152.763, 98.205, -18.29],
    ['env', 59.06, 696.73, 180.922, 158.055, 'env_waipo', 152.763, 98.205, -27.76],
    ['env', -31, 507, 163.596, 143.054, 'env_aming', 138.11, 88.785, 27.87],
    ['env', 276, 775, 177.413, 129.612, 'env_aming', 162.542, 104.491, 9.39],
    ['env', 17.3, 765.9, 196.456, 163.691, 'env_kid', 168.039, 108.025, -22.29],
    ['env', -24.12, 640.84, 183.561, 134.274, 'env_kid', 168.039, 108.025, -9.5],
    ['env', -60, 213, 183.561, 134.274, 'env_kid', 168.039, 108.025, -9.5],
    ['env', 4, 621, 262.322, 203.321, 'env_xiaofang', 231.977, 149.128, 14.76],
    ['tape', -14.41, 49.96, 151.234, 74.277, 'tape_blue', 146.964, 36.018, 15.63],
  ];
  const FRONT = [
    ['big', -60, 723, 265.588, 237.413, 'env_front_big', 220, 152, 27.96],
    ['big', 47, 621, 427.166, 377.196, 'env_front_big', 358.449, 235.273, -28.33],
    ['tape', 276, 628, 100.27, 61.891, 'tape_blue', 99, 24, 23.79],
    ['big', -117, 279, 202.427, 191.399, 'env_front_big', 166.628, 115.094, 36.3],
  ];
  function placeDeco(root, list) {
    list.forEach(([kind, l, t, w, h, img, iw, ih, rot], i) => {
      const d = document.createElement('div'); d.className = 'deco ' + (kind === 'env' ? 'env' : kind);
      Object.assign(d.style, { left: l + 'px', top: t + 'px', width: w + 'px', height: h + 'px' });
      d.dataset.depth = kind === 'big' ? 1.4 : kind === 'tape' ? 1.1 : 0.6 + (i % 4) * 0.12;
      d.innerHTML = `<img src="${FIG}${img}.png" alt="" style="width:${iw}px;height:${ih}px;transform:rotate(${rot}deg)">`;
      root.appendChild(d);
    });
  }
  placeDeco($('#launchDeco'), DECO); placeDeco($('#launchFront'), FRONT);
  // 视差：手指/鼠标移动或手机倾斜时，散落的信封轻轻漂
  const decos = $$('.deco');
  let par = { x: 0, y: 0 };
  function applyParallax() { decos.forEach(d => { const k = +d.dataset.depth; d.style.transform = `translate(${par.x * k * 6}px, ${par.y * k * 6}px)`; }); }
  screen.addEventListener('pointermove', e => { if (state.view !== 'launch') return; const p = toLocal(e); par = { x: (p.x / W - 0.5) * 2, y: (p.y / H - 0.5) * 2 }; applyParallax(); });
  addEventListener('deviceorientation', e => { if (state.view !== 'launch' || e.gamma == null) return; par = { x: clamp(e.gamma / 25, -1, 1), y: clamp((e.beta - 40) / 25, -1, 1) }; applyParallax(); });

  $('#appIcon').addEventListener('click', async () => {
    if (state.busy) return; Sound.tap();
    // 图标放大成整屏，像 App 被打开
    const z0 = document.createElement('div'); z0.className = 'zoomer';
    Object.assign(z0.style, { left: '153px', top: '150px', width: '105px', height: '106px' });
    screen.appendChild(z0);
    await z0.animate([{ left: '153px', top: '150px', width: '105px', height: '106px', borderRadius: '21px' }, { left: '0px', top: '0px', width: W + 'px', height: H + 'px', borderRadius: '0px' }], { duration: 460, easing: 'cubic-bezier(.3,.8,.2,1)', fill: 'forwards' }).finished;
    resetBox();
    await go('letters', 'fade');
    z0.remove();
  });

  /* ================= 02 空纸箱：按住上拖，把纸盘扯出来 ================= */
  const box = views.box, discWrap = $('#discWrap'), disc = $('#disc'), divider = $('#discDivider');
  const ask = $('#ask'), arrow = $('#pullArrow'), hint = $('#pullHint'), zone = $('#pullZone');
  const opts = { self: $('.opt[data-opt="self"]'), ta: $('.opt[data-opt="ta"]') };
  const RANGE = 330;
  let q = 0, qAnim = null, rot = 0, rotAnim = null;

  function renderPull() {
    const u = 1 - clamp(q, 0, 1.2);
    const over = Math.max(0, q - 1);
    // 未扯出时纸盘压在箱底、斜着；越往上越摆正，边缘像被抽出时向后翘
    discWrap.style.transform = `translate3d(${u * -26}px, ${u * (RANGE + 20) - over * 40}px, 0) perspective(1400px) rotateX(${u * 9}deg) rotate(${u * -5}deg) scale(${1 + over * 0.04})`;
    const lift = clamp(q, 0, 1);
    discWrap.style.filter = `drop-shadow(0 ${-3 - lift * 9}px ${8 + lift * 16}px rgba(42,23,8,${0.18 + lift * 0.22}))`;
    tabbar.style.transform = `translateY(${clamp(q * 2.4, 0, 1) * 160}px)`; // 底栏先让开，纸盘才看得见
    $('#v-box .corner-mark').style.opacity = String(smooth(0.5, 1, q));
    arrow.style.opacity = hint.style.opacity = String(clamp(1 - lift * 2.4, 0, 1) * 0.9);
    arrow.style.translate = `0 ${-lift * 70}px`;
    ask.style.opacity = String(smooth(0.35, 0.95, q));
    ask.style.transform = `translateY(${(1 - lift) * 26}px)`;
    $('#v-box .box-shade').style.background = `rgba(27,13,0,${lift * 0.08})`;
    $('#discLabels').style.opacity = String(smooth(0.55, 1, q));
  }
  function renderDial() {
    disc.style.transform = `rotate(${rot}deg)`;
    divider.style.opacity = String(clamp(1 - Math.abs(rot) / 22, 0, 1));
    [['self', -38], ['ta', 38]].forEach(([k, base]) => {
      const a = base + rot, rad = a * Math.PI / 180, R = 178;
      const x = 300 + R * Math.sin(rad), y = 300 - R * Math.cos(rad);
      const centered = Math.abs(a) < 6;
      const sc = 1 + 0.16 * clamp(1 - Math.abs(a) / 38, 0, 1) * clamp(Math.abs(rot) / 38, 0, 1);
      const el = opts[k];
      el.style.transform = `translate(${x}px, ${y - 12}px) scale(${sc})`;
      el.style.opacity = String(clamp(1 - (Math.abs(a) - 40) / 24, 0, 1));
      el.classList.toggle('centered', centered);
      el.style.pointerEvents = Math.abs(a) > 70 ? 'none' : 'auto';
    });
  }
  function resetBox() {
    q = 0; rot = 0; box.classList.remove('open'); renderPull(); renderDial();
  }
  // 已经有信时，纸箱是从信件页「新建空间」进来的：关掉纸盘 = 回信件页，不停在空纸箱
  async function backToLetters(how = 'fade') {
    if (state.busy || state.view !== 'box') return;
    Sound.tap();
    await go('letters', how);
    resetBox();
  }
  $('#boxBack').addEventListener('click', e => { e.stopPropagation(); backToLetters('fade'); });
  function settlePull(target, v = 0) {
    qAnim && qAnim.stop();
    const wasOpen = box.classList.contains('open');
    qAnim = spring(q, target, { k: target ? 150 : 200, c: target ? 15 : 24, v, onUpdate: x => { q = x; renderPull(); },
      onDone: () => { box.classList.toggle('open', target === 1); if (target === 1 && !wasOpen) Sound.unfold(); } });
    if (target === 0 && wasOpen) { rotAnim && rotAnim.stop(); rotAnim = spring(rot, 0, { onUpdate: x => { rot = x; renderDial(); } }); }
  }

  // 拖拽：上半区负责「扯出 / 塞回」
  let pd = null;
  zone.addEventListener('pointerdown', e => {
    if (state.view !== 'box') return;
    zone.setPointerCapture(e.pointerId);
    qAnim && qAnim.stop();
    pd = { y0: toLocal(e).y, q0: q, t: performance.now(), y: toLocal(e).y, v: 0, moved: false };
    Sound.rustleStart();
  });
  zone.addEventListener('pointermove', e => {
    if (!pd) return;
    const y = toLocal(e).y, now = performance.now(), dt = Math.max(1, now - pd.t);
    const vy = (y - pd.y) / dt; pd.v = pd.v * 0.6 + vy * 0.4; pd.y = y; pd.t = now;
    if (Math.abs(y - pd.y0) > 10) pd.moved = true; // 手指点下去会抖几像素，不算拖
    let nq = pd.q0 + (pd.y0 - y) / RANGE;
    if (nq > 1) nq = 1 + (nq - 1) * 0.28; // 拉过头有阻力
    if (nq < 0) nq = nq * 0.25;
    q = nq; renderPull(); Sound.rustle(vy);
  });
  const endPull = () => {
    if (!pd) return;
    Sound.rustleStop();
    const open = box.classList.contains('open');
    // 从信件页进来：点空白处，或把纸盘往下塞回去 → 箱子滑下去，回到信件页
    if (open && state.hasLetters && (!pd.moved || q < 0.72 || pd.v > 0.5)) { pd = null; backToLetters('down'); return; }
    let target;
    if (!pd.moved) target = open ? 1 : 1; // 点一下也能扯出来
    else if (!open) target = (q > 0.4 || pd.v < -0.5) ? 1 : 0;
    else target = (q < 0.72 || pd.v > 0.5) ? 0 : 1;
    // 纸盘还在弹起的动画里就往下拖（这时还没算「打开」）：有信时同样回信件页，不停在空纸箱
    if (target === 0 && state.hasLetters) { pd = null; backToLetters('down'); return; }
    settlePull(target, -pd.v * 1000 / RANGE);
    pd = null;
  };
  zone.addEventListener('pointerup', endPull); zone.addEventListener('pointercancel', endPull);

  // 转盘：左右拖动纸盘，吸附到 自己 / 默认 / 他人
  const SNAPS = [38, 0, -38];
  let dd = null;
  discWrap.addEventListener('pointerdown', e => {
    if (!box.classList.contains('open')) return;
    discWrap.setPointerCapture(e.pointerId);
    rotAnim && rotAnim.stop();
    const p = toLocal(e);
    dd = { x0: p.x, r0: rot, x: p.x, t: performance.now(), v: 0, moved: false, target: e.target.closest('.opt') };
  });
  discWrap.addEventListener('pointermove', e => {
    if (!dd) return;
    const p = toLocal(e), now = performance.now(), dt = Math.max(1, now - dd.t);
    dd.v = dd.v * 0.6 + ((p.x - dd.x) / dt) * 0.4; dd.x = p.x; dd.t = now;
    if (Math.abs(p.x - dd.x0) > 5) { if (!dd.moved) Sound.rustleStart(); dd.moved = true; }
    if (!dd.moved) return;
    let r = dd.r0 + (p.x - dd.x0) * 0.2;
    if (r > 44) r = 44 + (r - 44) * 0.3; if (r < -44) r = -44 + (r + 44) * 0.3;
    const prev = rot; rot = r; renderDial(); Sound.rustle((rot - prev) * 0.8);
  });
  const endDial = e => {
    if (!dd) return;
    Sound.rustleStop();
    if (!dd.moved) { // 点击：有选项居中时点中间进入，点两侧转过去；默认态点哪半边转哪边
      const x = toLocal(e).x;
      const centered = Math.abs(rot - 38) < 4 ? 'self' : Math.abs(rot + 38) < 4 ? 'ta' : null;
      if (dd.target) {
        const k = dd.target.dataset.opt;
        if (k === centered) choose(k); else snapRot(k === 'self' ? 38 : -38);
      } else if (centered && x > 110 && x < 292) choose(centered);
      else if (x < 201) snapRot(centered === 'ta' ? 0 : 38);
      else snapRot(centered === 'self' ? 0 : -38);
      dd = null; return;
    }
    const proj = rot + dd.v * 0.2 * 60;
    const target = SNAPS.reduce((b, s) => Math.abs(s - proj) < Math.abs(b - proj) ? s : b, SNAPS[0]);
    snapRot(target, dd.v * 0.2 * 1000);
    dd = null;
  };
  discWrap.addEventListener('pointerup', endDial); discWrap.addEventListener('pointercancel', endDial);
  function snapRot(target, v = 0) {
    rotAnim && rotAnim.stop();
    if (target !== rot) Sound.tick();
    rotAnim = spring(rot, target, { k: 160, c: 17, v, onUpdate: x => { rot = x; renderDial(); } });
  }
  resetBox();

  /* ================= 表单 ================= */
  const body = $('#sheetBody'), sheet = $('#sheet');
  const LINE = k => 43 + 35.2 * k;          // 纸张坐标里第 k 条横线
  const nodes = new Map();                   // key → 元素（切换数字分身时复用，保留已填内容）
  const data = { self: {}, ta: {} };

  function spec(kind, twin) {
    const S0 = [['back'], ['title', 1, kind === 'self' ? '为自己创建记忆空间' : '为TA创建记忆空间']];
    if (kind === 'self') return S0.concat([
      ['label', 2, '你的名字', 'l-name'], ['input', 3, 'name', '写下你的名字'],
      ['label', 4, '你想纪念时期的多媒体材料', 'l-media'], ['card', 5, 'media', '上传材料', '支持任何格式的材料，上传后将为您整理'],
      ['label', 9, '这段记忆的时期', 'l-period'], ['input', 10, 'period', '比如：二〇〇三年夏天'],
      ['label', 11, '你对于这段记忆的评价', 'l-review'], ['input', 12, 'review', '一句话就好'],
      ['label', 13, '空间场景', 'l-scene'], ['scenes', 14, 118, 96], ['build'],
    ]);
    const TA = [
      ['label', 2, 'TA的名字', 'l-name'], ['input', 3, 'name', '比如：外婆'],
      ['label', 4, '与TA相关的多媒体材料', 'l-media'], ['card', 5, 'media', '上传材料', '支持任何格式的材料，上传后将为您整理'],
      ['label', 9, '这段记忆的时期', 'l-period'], ['input', 10, 'period', '比如：二〇〇三年夏天'],
      ['toggle', 11],
    ];
    if (!twin) return S0.concat(TA, [['label', 12, '空间场景', 'l-scene'], ['scenes', 13, 133, 109], ['build']]);
    // 打开数字分身：原有字段不动，在开关下面展开要补的几项，场景和按钮往下挪（纸里可以上下滚）
    return S0.concat(TA, [
      ['label', 12, 'TA的性别', 'l-gender'], ['chips', 13],
      ['label', 14, 'TA是你的', 'l-rel', 16, 175], ['input', 15, 'relation', '比如：初中同桌', 16, 175],
      ['label', 14, 'TA的生日', 'l-bday', 211, 175], ['date', 15, 211, 175],
      ['label', 16, '上传聊天记录', 'l-chat'], ['card', 17, 'chat', '上传材料', '您可以选择图片或录屏的形式进行上传'],
      ['label', 21, 'TA在你心中的印象', 'l-imp'], ['input', 22, 'impression', '比如：嘴硬心软，爱哼老歌'],
      ['label', 23, '空间场景', 'l-scene'], ['scenes', 24, 133, 109], ['build'],
    ]);
  }

  function mk(key, cls, html = '', tag = 'div') {
    let el = nodes.get(key);
    if (el) { el.classList.remove('leave'); return { el, fresh: false }; }
    el = document.createElement(tag); el.className = 'fx ' + cls; el.innerHTML = html; el.dataset.key = key;
    nodes.set(key, el); body.appendChild(el); return { el, fresh: true };
  }
  // 横线画在可滚动的内容层里，跟着字一起滚（原来横线在纸张贴图上，内容一滚就对不上线）
  const lines = document.createElement('div'); lines.className = 'f-lines'; body.prepend(lines);

  /* 空间场景：三张预览卡横向循环滑动，中间那张大，两边小；左右拖或点两边那张切换 */
  const SCENES = [
    { id: 'bedroom', name: '我的卧室', sub: '2009 · 那个夏天', img: 'scene_bedroom.jpg' },
    { id: 'classroom', name: '教室', sub: '靠窗那排', img: 'scene_classroom.jpg' },
    { id: 'playground', name: '小区游乐场', sub: '大象滑梯', img: 'scene_playground.jpg' },
  ];
  function sceneDial(wrap, bigH, smallH) {
    const N = SCENES.length, STEP = 150, BIG_W = 178, SMALL_W = 92;
    const cards = SCENES.map(s => {
      const c = document.createElement('div'); c.className = 'sc-card';
      c.innerHTML = `<img src="${FIG}${s.img}" alt="" draggable="false"><div class="sc-cap"><b>${s.name}</b><small>${s.sub}</small></div>`;
      wrap.appendChild(c); return c;
    });
    let pos = Math.max(0, SCENES.findIndex(s => s.id === (data[state.kind] || {}).scene)), anim = null, drag = null;
    const wrapOff = i => ((((i - pos) % N) + N * 1.5) % N) - N / 2; // 每张卡离中间几格，循环到 [-1.5, 1.5)
    function render() {
      cards.forEach((c, i) => {
        const off = wrapOff(i), a = clamp(Math.abs(off), 0, 1);
        const w = lerp(BIG_W, SMALL_W, a), h = lerp(bigH, smallH, a);
        Object.assign(c.style, { width: w + 'px', height: h + 'px', left: (201 + off * STEP - w / 2) + 'px', top: ((bigH - h) / 2) + 'px',
          opacity: 1 - smooth(1.15, 1.45, Math.abs(off)), zIndex: String(10 - Math.round(Math.abs(off) * 3)) });
        c.style.setProperty('--a', a.toFixed(3));
        c.classList.toggle('center', Math.abs(off) < 0.5);
      });
      const sel = ((Math.round(pos) % N) + N) % N;
      if (data[state.kind]) data[state.kind].scene = SCENES[sel].id;
    }
    function snap(target, v = 0) {
      anim && anim.stop();
      if (Math.round(target) !== Math.round(pos)) Sound.tick();
      anim = spring(pos, target, { k: 170, c: 20, v, onUpdate: x => { pos = x; render(); } });
    }
    wrap.addEventListener('pointerdown', e => {
      wrap.setPointerCapture(e.pointerId); anim && anim.stop();
      const x = toLocal(e).x; drag = { x0: x, x, p0: pos, t: performance.now(), v: 0, moved: false, card: e.target.closest('.sc-card') };
    });
    wrap.addEventListener('pointermove', e => {
      if (!drag) return;
      const x = toLocal(e).x, now = performance.now(), dt = Math.max(1, now - drag.t);
      drag.v = drag.v * 0.6 + (-(x - drag.x) / STEP / dt) * 0.4; drag.x = x; drag.t = now;
      if (Math.abs(x - drag.x0) > 6) drag.moved = true;
      if (drag.moved) { pos = drag.p0 - (x - drag.x0) / STEP; render(); }
    });
    const end = () => {
      if (!drag) return;
      if (!drag.moved) { // 点两边那张：转过去；点中间那张：轻轻弹一下
        const off = drag.card ? wrapOff(cards.indexOf(drag.card)) : 0;
        if (Math.abs(off) > 0.5) snap(Math.round(pos + off));
        else if (drag.card) { Sound.tap(); drag.card.animate([{ transform: 'scale(1)' }, { transform: 'scale(.96)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' }); }
      } else snap(Math.round(pos + drag.v * 180), drag.v * 1000);
      drag = null;
    };
    wrap.addEventListener('pointerup', end); wrap.addEventListener('pointercancel', end);
    render();
  }

  function layout(kind, twin, animate) {
    const want = new Set(); const entering = [];
    let sceneBottom = 0;
    const d = data[kind];
    for (const row of spec(kind, twin)) {
      const [type] = row; let r;
      if (type === 'back') {
        r = mk('back', 'back-btn f-back', '', 'button'); r.el.style.top = (LINE(1) + 2) + 'px'; r.el.style.backgroundImage = BACK_URL; r.el.setAttribute('aria-label', '返回');
        if (r.fresh) r.el.addEventListener('click', closeForm);
      } else if (type === 'title') {
        r = mk('title', 'f-title'); r.el.textContent = state.editing ? '编辑记忆空间' : row[2]; r.el.style.top = (LINE(row[1]) + 5) + 'px';
      } else if (type === 'label') {
        r = mk(row[3], 'f-label'); r.el.textContent = row[2]; r.el.style.top = (LINE(row[1] + 1) - 26) + 'px';
        r.el.style.left = (row[4] ?? 16) + 'px';
        r.el.style.width = row[5] ? row[5] + 'px' : '';
      } else if (type === 'input') {
        const k = row[2]; r = mk('in-' + k, 'f-box', `<input type="text" maxlength="24" autocomplete="off" placeholder="${row[3]}" />`);
        r.el.style.top = LINE(row[1]) + 'px';
        r.el.style.left = (row[4] ?? 16) + 'px';
        r.el.style.width = (row[5] ?? 370) + 'px';
        const inp = $('input', r.el);
        inp.placeholder = row[3];
        if (document.activeElement !== inp) inp.value = d[k] || '';
        if (r.fresh) inp.addEventListener('input', () => { data[state.kind][k] = inp.value.trim(); });
      } else if (type === 'date') {
        r = mk('date', 'f-box f-date', `<span>请选择</span><input type="date" /><i>${CHEV}</i>`); r.el.style.top = LINE(row[1]) + 'px';
        r.el.style.left = (row[2] ?? 16) + 'px';
        r.el.style.width = (row[3] ?? 370) + 'px';
        const inp = $('input', r.el), sp = $('span', r.el);
        const showDate = v => {
          if (!v) {
            sp.textContent = '请选择';
            sp.classList.remove('filled');
            return;
          }
          const [y, m, dd] = v.split('-');
          sp.textContent = `${y}年${+m}月${+dd}日`;
          sp.classList.add('filled');
        };
        if (document.activeElement !== inp) inp.value = d.bday || '';
        showDate(d.bday);
        if (r.fresh) inp.addEventListener('change', () => {
          const v = inp.value;
          if (!v) return;
          showDate(v);
          d.bday = v;
        });
      } else if (type === 'card') {
        const k = row[2];
        r = mk('card-' + k, 'f-card', `<div class="thumbs"></div><div class="pill"></div><div class="pt">${row[3]}</div><div class="ps">${row[4]}</div>`);
        r.el.style.top = LINE(row[1]) + 'px'; r.el.style.height = (35.2 * 4) + 'px';
        if (r.fresh) { r.el.addEventListener('click', () => pickFiles(r.el, k)); if ((d[k] || []).length) renderThumbs(r.el, d[k], false); }
      } else if (type === 'toggle') {
        r = mk('tog-l', 'f-label'); r.el.textContent = '数字分身'; r.el.style.top = (LINE(row[1] + 1) - 26) + 'px'; want.add('tog-l'); if (r.fresh) entering.push(r.el);
        r = mk('tog', 'f-toggle', '', 'button'); r.el.style.top = ((LINE(row[1]) + LINE(row[1] + 1)) / 2 - 12) + 'px'; r.el.setAttribute('aria-label', '数字分身'); r.el.classList.toggle('on', twin);
        if (r.fresh) r.el.addEventListener('click', () => {
          Sound.tick(); state.twin = !state.twin; layout('ta', state.twin, true);
          // 展开后把新出来的几项滚进视野；收起时滚回开关附近
          body.scrollTo({ top: state.twin ? LINE(10) - 40 : Math.min(body.scrollTop, LINE(6)), behavior: 'smooth' });
        });
      } else if (type === 'chips') {
        for (const [ck, cls, txt] of [['chip-m', 'f-chip m', '男'], ['chip-f', 'f-chip f', '女']]) {
          const c = mk(ck, cls, txt, 'button');
          c.el.style.top = LINE(row[1]) + 'px';
          c.el.classList.toggle('sel', d.gender === txt);
          c.el.classList.toggle('dim', !!d.gender && d.gender !== txt);
          want.add(ck);
          if (c.fresh) {
            entering.push(c.el);
            c.el.addEventListener('click', () => {
              Sound.tap();
              d.gender = txt;
              ['chip-m', 'chip-f'].forEach(x => {
                const n = nodes.get(x);
                n.classList.toggle('sel', n === c.el);
                n.classList.toggle('dim', n !== c.el);
              });
            });
          }
        }
        continue;
      } else if (type === 'scenes') {
        const top = LINE(row[1]);
        r = mk('scenes', 'f-scenes'); r.el.style.top = top + 'px'; r.el.style.height = row[2] + 'px';
        if (r.fresh) sceneDial(r.el, row[2], row[3]);
        sceneBottom = top + row[2];
      } else if (type === 'build') {
        r = mk('build', 'f-build', '构建记忆空间', 'button'); r.el.textContent = state.editing ? '保存修改' : '构建记忆空间'; r.el.style.top = Math.max(668, sceneBottom + 30) + 'px'; r.el.style.backgroundImage = BUILD_BG;
        if (r.fresh) r.el.addEventListener('click', buildSpace);
        lines.style.height = (Math.max(668, sceneBottom + 30) + 70) + 'px'; // 横线铺到按钮下面，也撑出可滚动的高度
      }
      const key = r.el.dataset.key; want.add(key); if (r.fresh) entering.push(r.el);
    }
    // 不再需要的：淡出后移除
    for (const [key, el] of nodes) if (!want.has(key)) { if (animate) { el.classList.add('leave'); setTimeout(() => { if (el.classList.contains('leave')) { el.remove(); nodes.delete(key); } }, 220); } else { el.remove(); nodes.delete(key); } }
    // 新出现的：一块块浮现（错开 55ms，淡入 + 上移 8px + 去模糊）
    if (animate) entering.forEach((el, i) => { el.classList.add('enter'); setTimeout(() => el.classList.add('in'), 140 + i * 55); setTimeout(() => el.classList.remove('enter', 'in'), 700 + i * 55); });
  }

  // edit：要编辑的那封信（已创建的空间），表单按原来的内容填好；不带就是新建
  function openForm(kind, edit = null) {
    state.kind = kind; state.editing = edit; state.twin = !!(edit && edit.twin && kind === 'ta');
    for (const el of nodes.values()) el.remove(); nodes.clear();
    data[kind] = edit ? { ...(edit.form || {}), scene: edit.scene, media: [...(edit.parts?.media || [])], chat: [...(edit.parts?.chat || [])] } : {};
    layout(kind, state.twin, false);
    body.scrollTop = 0;
    $('#v-form .tape').style.left = kind === 'self' ? '118px' : '137px';
    go('form', 'sheet');
  }
  async function closeForm() { if (state.busy) return; Sound.tap(); await go(state.editing ? 'letters' : 'box', 'sheetdown'); }
  // 信封背面「编辑材料」：用和创建时同一张表单改这个空间
  function editLetter(i) {
    const l = letters[i]; if (!l || !l.kind || state.busy) return;
    Sound.flip(); unflip(); openForm(l.kind, l);
  }
  // 点纸上方的空白处也能返回
  // （只认手指真点的；上传时代码会「点」藏起来的文件选择框，那一下不算）
  views.form.addEventListener('click', e => { if (state.view === 'form' && e.isTrusted && !e.target.closest('.sheet, input')) closeForm(); });
  function choose(k) { Sound.flip(); openForm(k === 'self' ? 'self' : 'ta'); }

  const fileMulti = $('#fileMulti'), fileOne = $('#fileOne');
  let fileTarget = null;
  const uploads = new WeakMap(); // File → Promise<服务端引用>
  function pickFiles(card, key) { fileTarget = { card, key }; fileMulti.value = ''; fileMulti.click(); }
  fileMulti.addEventListener('change', () => {
    const files = [...fileMulti.files]; if (!files.length || !fileTarget) return;
    const { card, key } = fileTarget;
    const list = (data[state.kind][key] = (data[state.kind][key] || []).concat(files));
    // 选好就开始往本地服务传，构建时直接拿引用存进空间
    if (JRLXStore.ok) files.forEach(f => uploads.set(f, JRLXStore.upload(f).catch(e => { console.warn('[存档] 上传失败', e); return null; })));
    renderThumbs(card, list, true);
  });
  function renderThumbs(card, list, sound) {
    const thumbs = $('.thumbs', card);
    thumbs.innerHTML = '';
    list.slice(-5).forEach((f, i) => {
      const fig = document.createElement('figure'); const url = f instanceof Blob ? URL.createObjectURL(f) : f.url;
      const m = f.type.startsWith('video') ? Object.assign(document.createElement('video'), { src: url, muted: true }) : Object.assign(document.createElement('img'), { src: url, alt: '' });
      const ready = () => setTimeout(() => m.classList.add('ready'), 60 + i * 70);
      m.addEventListener('load', ready); m.addEventListener('loadeddata', ready);
      fig.appendChild(m); thumbs.appendChild(fig);
      fig.animate([{ opacity: 0, transform: `translateY(10px) rotate(${i % 2 ? 4 : -5}deg)` }, { opacity: 1 }], { duration: 380, delay: i * 70, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    });
    $('.pt', card).textContent = `已放进 ${list.length} 份材料`;
    $('.ps', card).textContent = '点这里继续添加';
    if (sound) Sound.unfold();
  }
  function pickScene(el) { fileTarget = el; fileOne.value = ''; fileOne.click(); }
  fileOne.addEventListener('change', () => {
    const f = fileOne.files[0]; if (!f || !(fileTarget instanceof HTMLElement)) return;
    fileTarget.style.backgroundImage = `url("${URL.createObjectURL(f)}")`; fileTarget.classList.add('filled');
    fileTarget.animate([{ filter: 'blur(8px)', transform: 'scale(1.04)' }, { filter: 'none', transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.2,.8,.2,1)' });
  });

  async function buildSpace() {
    if (state.busy) return;
    Sound.tap();
    const d = data[state.kind];
    const nameInput = nodes.get('in-name');
    if (!(d.name || '').trim()) {
      state.busy = true;
      const input = nameInput && $('input', nameInput);
      if (input) {
        input.focus({ preventScroll: true });
        input.animate([
          { transform: 'translateX(0)' },
          { transform: 'translateX(-6px)' },
          { transform: 'translateX(5px)' },
          { transform: 'translateX(-3px)' },
          { transform: 'translateX(0)' },
        ], { duration: 320, easing: 'ease-out' });
      }
      toast(state.kind === 'self' ? '先写下你的名字' : '先写下 TA 的名字');
      setTimeout(() => { state.busy = false; }, 340);
      return;
    }
    state.busy = true;
    // 为 TA 创建且开了数字分身：先读聊天录屏、听出 TA 的口气（js/twin-build.js），再装信封
    const editing = state.editing;
    const chatChanged = (d.chat || []).some(f => f instanceof Blob);
    let twin = editing && state.kind === 'ta' && state.twin && !chatChanged ? editing.twin || null : null;
    if (!twin && state.kind === 'ta' && state.twin && window.JRLXTwinBuild) {
      // 编辑时已存的聊天记录是服务端引用，先取回成 File 再读
      const asFile = f => f instanceof Blob ? f : fetch(f.url).then(r => r.blob()).then(b => new File([b], f.name || 'file', { type: f.type || b.type })).catch(() => null);
      try { twin = await JRLXTwinBuild.run(views.form, { files: (await Promise.all((d.chat || []).map(asFile))).filter(Boolean), name: d.name, relation: d.relation, sound: Sound }); }
      catch (e) { console.warn('[twin] 构建失败', e); toast('数字分身没建成，先只装信封'); }
    }
    const L = state.kind === 'self'
      ? { to: '给 ' + (d.name ? '小时候的' + d.name : '曾经的自己'), addr: (d.period || '那年') + ' · 写给那时候', from: '寄自 · 今天', subj: d.review || '你后来过得还好', stamp: MUS, fresh: true }
      : { to: '给 ' + (d.name || 'TA'), addr: [d.relation, d.period].filter(Boolean).join(' · ') || '记忆里的那个人', from: '寄自 · 今天', subj: d.impression || '想对你说的话', stamp: TER, fresh: true };
    L.media = [...(d.media || []), ...(d.chat || [])];
    if (twin) {
      L.twin = twin;
      // 用的是示例人设时，信封也写给示例人物，免得和房间手机里的人对不上
      if (twin.source === 'preset') Object.assign(L, { to: '给 ' + twin.name, addr: twin.relation + ' · 二〇〇九年夏', subj: '拍不清楚的月亮' });
    }
    const key = [L.to, L.addr, L.subj].join('|');
    const duplicate = letters.some(x => x !== editing && [x.to, x.addr, x.subj].join('|') === key);
    if (duplicate) {
      toast('这个记忆空间已经存在');
      state.busy = false;
      return;
    }
    const extra = { kind: state.kind, scene: d.scene || 'bedroom', form: { name: d.name || '', period: d.period || '', relation: d.relation || '', gender: d.gender || '', bday: d.bday || '', impression: d.impression || '', review: d.review || '' } };
    Object.assign(L, extra, { parts: { media: [...(d.media || [])], chat: [...(d.chat || [])] } });
    if (editing) { // 改好的内容写回原来那封信，位置不变
      delete L.fresh; delete editing.twin;
      Object.assign(editing, L);
      buildWheel(); renderWheel();
      saveSpace(editing, extra);
      state.busy = false;
      await go('letters', 'sheetdown');
      toast('改好了，这个空间已经更新');
      return;
    }
    const seal = document.createElement('div'); seal.className = 'seal';
    seal.innerHTML = `<div class="mini"><div class="body"></div><div class="flap"></div><img class="stamp" src="${FIG}wax.svg" alt=""></div><p>正在把这段记忆装进信封…</p>`;
    views.form.appendChild(seal);
    requestAnimationFrame(() => seal.classList.add('on'));
    setTimeout(() => Sound.unfold(), 350); setTimeout(() => Sound.crack(), 820);
    await sleep(1500);
    addLetter(L);
    saveSpace(L, extra);
    state.hasLetters = true;
    state.busy = false;
    await go('letters', 'fade');
    seal.remove();
  }

  /* ================= 存档：新建的空间存进本地服务，打开 Demo 时恢复（后台 admin.html 可删可恢复） ================= */
  const LETTER_KEYS = ['to', 'addr', 'from', 'subj', 'stamp', 'twin'];
  async function saveSpace(L, extra) {
    if (!JRLXStore.ok || FILM) return; // 拍片模式不往存档里写（否则每录一遍就多一封一样的信）
    try {
      const ref = f => f instanceof Blob ? uploads.get(f) || null : f; // 等还没传完的文件；已存的本来就是引用
      const refs = (await Promise.all((L.media || []).map(ref))).filter(Boolean);
      const chatIds = (await Promise.all((L.parts?.chat || []).map(ref))).filter(Boolean).map(r => r.id);
      const space = { ...Object.fromEntries(LETTER_KEYS.map(k => [k, L[k] ?? null])), media: refs, chatIds, ...extra };
      const saved = L.id ? await JRLXStore.update(L.id, space) : await JRLXStore.save(space);
      L.id = saved.id;
    } catch (e) { console.warn('[存档] 保存失败', e); toast('这个空间没存到电脑上（预览服务没开？）'); }
  }
  // 打开时把存过的空间放回信件堆（最新的放在中间那封）
  async function restoreSpaces() {
    if (!JRLXStore.ok || FILM) return; // 拍片模式不放回测试存档
    let list;
    try { list = (await JRLXStore.list()).spaces || []; } catch (e) { return; }
    const keep = letters.filter(l => !l.id);
    const mine = list.filter(s => !s.deleted).sort((a, b) => a.createdAt - b.createdAt)
      .map(s => {
        const media = s.media || [], chat = new Set(s.chatIds || []);
        return { ...Object.fromEntries(LETTER_KEYS.map(k => [k, s[k] ?? undefined])), id: s.id, media,
          kind: s.kind || (s.twin ? 'ta' : 'self'), scene: s.scene, form: s.form || {},
          parts: { media: media.filter(m => !chat.has(m.id)), chat: media.filter(m => chat.has(m.id)) } };
      });
    if (!mine.length && keep.length === letters.length) return;
    const at = Math.min(3, keep.length);
    letters.splice(0, letters.length, ...keep.slice(0, at), ...mine.reverse(), ...keep.slice(at));
    unflip(); buildWheel(); p = at; renderWheel();
  }

  /* ================= 信件滚轮 ================= */
  const LETTERS = [
    { to: '给 外婆', addr: '老房子 · 一九九八年春', from: '寄自 · 一九九八', subj: '关于院子里的花', stamp: SAGE },
    { to: '给 阿杰', addr: '篮球场 · 二〇〇〇年夏', from: '寄自 · 二〇〇〇', subj: '那年夏天的风扇', stamp: MUS },
    { to: '给 小时候的自己', addr: '课桌抽屉 · 二〇〇一年', from: '寄自 · 二〇〇一', subj: '等你长大了再拆', stamp: TER },
    { to: '给 妈妈', addr: '老房子 · 二〇〇三年夏', from: '寄自 · 一九九九', subj: '四年以后', stamp: SAGE },
    { to: '给 小满', addr: '楼下小卖部 · 二〇〇一年', from: '寄自 · 一九九九', subj: '搬家以后', stamp: MUS },
    { to: '给 爸爸', addr: '单位宿舍 · 二〇〇二年冬', from: '寄自 · 二〇〇二', subj: '谢谢你，认真地', stamp: TER },
    { to: '给 阿明', addr: '学校后门 · 二〇〇四年', from: '寄自 · 二〇〇四', subj: '借你的那盘磁带', stamp: SAGE },
    { to: '给 小芳', addr: '三年二班 · 二〇〇二年', from: '寄自 · 二〇〇二', subj: '三八线', stamp: MUS },
    { to: '给 外公', addr: '巷子口 · 一九九七年', from: '寄自 · 一九九七', subj: '收音机里的戏', stamp: TER },
    { to: '给 表姐', addr: '外婆家阁楼 · 一九九九年', from: '寄自 · 一九九九', subj: '那本没还的书', stamp: SAGE },
    { to: '给 同桌', addr: '靠窗那排 · 二〇〇三年', from: '寄自 · 二〇〇三', subj: '毕业那天没说的', stamp: MUS },
    { to: '给 小时候的我', addr: '老房子 · 一九九六年', from: '寄自 · 一九九六', subj: '别怕打针', stamp: TER },
  ];
  const wheel = $('#wheel');
  // 拍片模式（shared/film.js）：不出现指向未来的那封
  const FILM = document.documentElement.classList.contains('film');
  if (FILM) LETTERS[2] = { to: '给 高三的教室', addr: '三楼最后一排 · 二〇一一年', from: '寄自 · 二〇一一', subj: '黑板右下角的倒计时', stamp: TER };
  const letters = LETTERS.map(l => ({ ...l }));
  let items = [];
  let p = 3, pAnim = null, mode = 0, modeTarget = 0, flippedIdx = -1;

  const STAMP_ICON = `<img src="${FIG}stamp_plant.svg" alt="">`;
  function letterHTML(l) {
    const zip = [...'528000'].map(c => `<i>${c}</i>`).join('');
    return `
      <div class="tilt is-front">
        <div class="tf"><div class="t-zip">${'<i></i>'.repeat(6)}</div><div class="t-name">${l.to}</div><div class="t-stamp" style="background:${l.stamp}"></div></div>
        <div class="tb"><div class="t-line"></div><div class="t-sub">${l.subj}</div></div>
      </div>
      <div class="flat"><div class="card">
        <div class="face front">
          <div class="emboss"></div><div class="zip">${zip}</div>
          <div class="stamp"><div class="sf" style="background:${l.stamp}"></div>${STAMP_ICON}<em>8分</em></div>
          <img class="postmark" src="${FIG}postmark.svg" alt="">
          <div class="to">${l.to}</div><div class="addr">${l.addr}</div><div class="rule"></div><div class="from">${l.from}</div>
        </div>
        <div class="face back">
          <img class="folds" src="${FIG}env_side_folds.svg" alt="">
          <div class="inner"><p>见字如面。<br>${l.subj}……</p></div>
          <div class="flapw"><img src="${FIG}env_flap.svg" alt=""></div>
          <button type="button" class="wax" aria-label="拆开火漆"><img class="w1" src="${FIG}wax.svg" alt=""><img class="w2" src="${FIG}wax_inner.svg" alt=""><b>信</b></button>
          <div class="subj">${l.subj}</div>
          ${l.kind ? '<button type="button" class="edit-mat" aria-label="编辑材料">编辑材料</button>' : ''}
          <div class="wax-hint">${l.twin ? `轻点火漆 · ${l.twin.name}的分身在房间的手机里` : '轻点火漆，拆开这封信'}</div>
        </div>
      </div></div>`;
  }
  function buildWheel() {
    wheel.innerHTML = '';
    items = letters.map((l, i) => {
      const el = document.createElement('div'); el.className = 'item'; el.dataset.i = i; el.innerHTML = letterHTML(l);
      wheel.appendChild(el);
      return { el, tilt: $('.tilt', el), flat: $('.flat', el), card: $('.card', el), drop: 0 };
    });
    $('#lettersCount').textContent = `来信 · ${letters.length} 封`;
  }
  // 摆正模式的关键帧：取自 Figma 信件 ①（d = 与中间那封的距离）
  const KD = [-4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
  const KY = [64, 120, 176, 232, 298, 534, 592, 650, 708, 766];
  const KH = [54, 54, 54, 54, 216, 54, 54, 54, 54, 54];
  const KO = [0, .55, .85, 1, 1, 1, .9, .75, .5, 0];
  function key(arr, d) {
    if (d <= KD[0]) return arr === KY ? KY[0] - (KD[0] - d) * 56 : arr[0];
    if (d >= KD[KD.length - 1]) return arr === KY ? KY[KY.length - 1] + (d - KD[KD.length - 1]) * 58 : arr[arr.length - 1];
    const i = Math.floor(d) - KD[0], t = d - Math.floor(d);
    return lerp(arr[i], arr[i + 1], t);
  }
  function renderWheel() {
    const m = mode;
    items.forEach((it, i) => {
      const d = i - p;
      let y = lerp(key(KY, d), 403 + d * 57, m);
      const h = lerp(key(KH, d), 54, m);
      const yB = 403 + d * 57, oB = clamp((yB - 70) / 60, 0, 1) * clamp((790 - yB) / 60, 0, 1);
      const o = lerp(key(KO, d), oB, m);
      if (it.drop) y -= it.drop * 520;
      const f = clamp((h - 54) / 162, 0, 1);
      it.el.style.top = y + 'px'; it.el.style.height = h + 'px';
      it.el.style.opacity = String(o); it.el.style.zIndex = String(100 - Math.round(Math.abs(d) * 10));
      it.el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
      const flatO = smooth(0.22, 0.62, f), tiltO = 1 - smooth(0.12, 0.5, f);
      it.flat.style.opacity = String(flatO);
      it.flat.style.visibility = flatO < 0.01 ? 'hidden' : 'visible';
      const ang = Math.acos(clamp(h / 216, 0.25, 1)) * 180 / Math.PI * (d < 0 ? -1 : 1);
      it.flat.style.transform = `perspective(800px) rotateX(${ang}deg)`;
      it.tilt.style.opacity = String(tiltO);
      it.tilt.classList.toggle('is-front', d <= 0.001); it.tilt.classList.toggle('is-back', d > 0.001);
    });
  }
  function scrollTo(target, v = 0) {
    pAnim && pAnim.stop();
    target = clamp(Math.round(target), 0, items.length - 1);
    let lastI = Math.round(p);
    pAnim = spring(p, target, { k: 120, c: 19, v, onUpdate: x => { p = x; const r = Math.round(p); if (r !== lastI) { lastI = r; Sound.tick(); } renderWheel(); } });
  }
  // 信封入场：看得见的那几封从屏幕上方依次落下，略微冲过头再弹回；中间那封落稳时轻轻一响
  function dropLetters() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    unflip();
    const center = Math.round(p);
    items.filter(it => it.el.style.visibility !== 'hidden').sort((a, b) => parseFloat(a.el.style.top) - parseFloat(b.el.style.top))
      .forEach((it, k) => {
        // 只落一小段（不从屏幕外砸下来，免得半透明的信封互相穿过、看着像重影）；透明度渐到它自己该有的值，不先满再跳
        const o = it.el.style.opacity || '1';
        const a = it.el.animate([
          { transform: `translateY(-120px) rotate(${k % 2 ? 2 : -2}deg)`, opacity: 0 },
          { opacity: o, offset: 0.45 },
          { transform: 'translateY(8px) rotate(0deg)', opacity: o, offset: 0.72 },
          { transform: 'translateY(-2px)', opacity: o, offset: 0.88 },
          { transform: 'none', opacity: o },
        ], { duration: 600, delay: 60 + k * 55, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'backwards' });
        if (+it.el.dataset.i === center) a.finished.then(() => Sound.tap()).catch(() => {});
      });
  }
  function unflip() { if (flippedIdx >= 0) { items[flippedIdx] && items[flippedIdx].card.classList.remove('flipped'); flippedIdx = -1; } }
  function addLetter(l) {
    const at = clamp(Math.round(p), 0, letters.length);
    letters.splice(at, 0, l);
    buildWheel(); unflip();
    p = at; mode = 0; modeTarget = 0; setStraighten(true);
    const it = items[at]; it.drop = 1; it.el.classList.add('fresh');
    renderWheel();
    setTimeout(() => {
      spring(1, 0, { k: 140, c: 13, onUpdate: x => { it.drop = x; renderWheel(); }, onDone: () => { Sound.tap(); } });
      toast('新的记忆空间已经放进纸箱');
    }, 380);
  }

  let wd = null;
  wheel.addEventListener('pointerdown', e => {
    wheel.setPointerCapture(e.pointerId);
    pAnim && pAnim.stop();
    const pt = toLocal(e);
    wd = { y0: pt.y, p0: p, y: pt.y, t: performance.now(), v: 0, moved: false, target: e.target };
  });
  wheel.addEventListener('pointermove', e => {
    if (!wd) return;
    const pt = toLocal(e), now = performance.now(), dt = Math.max(1, now - wd.t);
    wd.v = wd.v * 0.6 + ((pt.y - wd.y) / dt) * 0.4; wd.y = pt.y; wd.t = now;
    if (Math.abs(pt.y - wd.y0) > 6) { if (!wd.moved) unflip(); wd.moved = true; }
    if (!wd.moved) return;
    let np = wd.p0 - (pt.y - wd.y0) / 64;
    const max = items.length - 1;
    if (np < 0) np = np * 0.3; if (np > max) np = max + (np - max) * 0.3;
    const r0 = Math.round(p); p = np; if (Math.round(p) !== r0) Sound.tick();
    renderWheel();
  });
  const endWheel = () => {
    if (!wd) return;
    const w = wd; wd = null;
    if (!w.moved) return tapWheel(w.target);
    const vItems = -w.v * 1000 / 64; // 封/秒
    scrollTo(p + vItems * 0.28, vItems);
  };
  wheel.addEventListener('pointerup', endWheel); wheel.addEventListener('pointercancel', () => { wd = null; scrollTo(p); });
  wheel.addEventListener('wheel', e => { e.preventDefault(); unflip(); scrollTo(Math.round(p) + Math.sign(e.deltaY)); }, { passive: false });

  function tapWheel(target) {
    const itEl = target.closest && target.closest('.item'); if (!itEl) return;
    const i = +itEl.dataset.i, center = Math.round(p);
    if (i !== center || mode > 0.5) { unflip(); if (mode > 0.5) { setStraighten(true); } scrollTo(i); return; }
    const it = items[i];
    if (flippedIdx === i && target.closest('.wax')) return openLetter(i);
    if (flippedIdx === i && target.closest('.edit-mat')) return editLetter(i);
    Sound.flip();
    if (flippedIdx === i) { it.card.classList.remove('flipped'); flippedIdx = -1; }
    else { unflip(); it.card.classList.add('flipped'); flippedIdx = i; }
  }

  const straightenBtn = $('#straighten');
  function setStraighten(on) {
    straightenBtn.setAttribute('aria-pressed', String(on));
    modeTarget = on ? 0 : 1;
    unflip();
    tween(460, t => { mode = lerp(mode, modeTarget, t); renderWheel(); }, t => t);
  }
  straightenBtn.addEventListener('click', e => { e.stopPropagation(); Sound.tick(); setStraighten(straightenBtn.getAttribute('aria-pressed') !== 'true'); });

  /* ================= 信件页再添加一个空间 ================= */
  const addSpace = $('#addSpace');
  const addEnvelope = $('.as-envelope', addSpace);
  const addTab = $('.as-tab', addSpace);
  const ADD_RANGE = 132;
  let addDrag = null, addOpen = false;

  function renderNewSpace(p = 0) {
    const lift = clamp(p, 0, 1.12);
    const tabOut = smooth(.02, .24, p);
    const envIn = smooth(.04, .72, p);
    addSpace.style.transform = `translateX(-50%) translateY(${-lift * 32}px)`;
    addTab.style.opacity = String(1 - tabOut);
    addTab.style.transform = `translateY(${tabOut * 28}px) rotate(${-tabOut * 2}deg) scale(${1 - tabOut * .08})`;
    addEnvelope.style.opacity = String(envIn);
    addEnvelope.style.transform = `translateX(-50%) translateY(${(1 - envIn) * 22}px) scale(${.68 + envIn * .32}, ${.3 + envIn * .7})`;
  }
  function resetNewSpace() {
    addSpace.classList.remove('dragging');
    addSpace.style.opacity = '';
    renderNewSpace(0);
    addDrag = null;
    addOpen = false;
  }
  function openNewSpace() {
    if (addOpen || state.busy) return;
    addOpen = true;
    Sound.unfold();
    resetBox();
    go('box', 'up').then(() => setTimeout(() => {
      if (state.view === 'box') settlePull(1, -.6);
    }, 30));
  }
  addSpace.addEventListener('pointerdown', e => {
    if (state.view !== 'letters' || state.busy) return;
    e.preventDefault();
    addSpace.setPointerCapture(e.pointerId);
    addSpace.classList.add('dragging');
    const y = toLocal(e).y;
    addDrag = { y0: y, y, p: 0, t: performance.now(), v: 0, moved: false };
    Sound.rustleStart();
  });
  addSpace.addEventListener('pointermove', e => {
    if (!addDrag) return;
    const y = toLocal(e).y, now = performance.now(), dt = Math.max(1, now - addDrag.t);
    const vy = (y - addDrag.y) / dt;
    addDrag.v = addDrag.v * .6 + vy * .4;
    addDrag.y = y; addDrag.t = now;
    let p = (addDrag.y0 - y) / ADD_RANGE;
    if (p < 0) p *= .22;
    if (p > 1) p = 1 + (p - 1) * .16;
    addDrag.p = p;
    if (p > .025) addDrag.moved = true;
    renderNewSpace(p);
    Sound.rustle(vy);
  });
  const endNewSpace = async () => {
    if (!addDrag) return;
    const d = addDrag; addDrag = null;
    addSpace.classList.remove('dragging');
    Sound.rustleStop();
    const from = addSpace.style.transform || 'translateX(-50%)';
    if (!d.moved || d.p > .38 || d.v < -.55) {
      await addSpace.animate([
        { transform: from, opacity: 1 },
        { transform: 'translateX(-50%) translateY(-156px) rotate(-2deg) scale(1.04)', opacity: 0 },
      ], { duration: d.moved ? 230 : 340, easing: 'cubic-bezier(.22,.75,.2,1)' }).finished.catch(() => {});
      openNewSpace();
    } else {
      addSpace.animate([
        { transform: from },
        { transform: 'translateX(-50%) translateY(9px) rotate(.4deg)' },
        { transform: 'translateX(-50%)' },
      ], { duration: 430, easing: 'cubic-bezier(.18,.82,.24,1)' }).finished.catch(() => {});
      renderNewSpace(0);
    }
  };
  addSpace.addEventListener('pointerup', endNewSpace);
  addSpace.addEventListener('pointercancel', () => {
    if (!addDrag) return;
    addDrag = null;
    addSpace.classList.remove('dragging');
    Sound.rustleStop();
    renderNewSpace(0);
  });
  addSpace.addEventListener('click', e => { if (e.detail === 0) openNewSpace(); });
  resetNewSpace();

  /* ================= 拆信 → 进入那间屋子 ================= */
  const roomFrame = $('#roomFrame'), roomPh = $('#roomPh'), rotateHint = $('#rotateHint'), veil = $('#veil');
  $('#roomBack').style.backgroundImage = BACK_URL;
  let openedIdx = -1;
  async function openLetter(i) {
    if (state.busy) return;
    state.busy = true; openedIdx = i;
    const it = items[i];
    it.el.classList.add('opening');
    Sound.crack(); setTimeout(() => Sound.unfold(), 260);
    await sleep(900);
    // 信封推近，暖白铺满
    it.el.animate([{ transform: 'none' }, { transform: 'translateY(-60px) scale(2.4)' }], { duration: 650, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' });
    await veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 150, easing: 'ease-in', fill: 'forwards' }).finished;
    state.busy = false;
    await enterRoom();
  }
  async function enterRoom() {
    // 电脑上：手机「横过来」
    if (!isMobile()) {
      await device.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-90deg)' }], { duration: 520, easing: 'cubic-bezier(.4,0,.2,1)' }).finished;
      device.classList.add('land'); fit();
    } else if (innerHeight > innerWidth) { rotateHint.classList.add('on'); setTimeout(() => rotateHint.classList.remove('on'), 3200); }
    views.room.style.zIndex = ++z; views.room.classList.add('on'); tabbar.classList.remove('on');
    if (isMobile()) fit(); // 真手机：已经横着拿的话，一进来就是横屏画面
    views[state.view].classList.remove('on'); state.view = 'room';
    roomPh.classList.remove('clear', 'gone'); roomFrame.classList.remove('ready');
    veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, easing: 'ease-out', fill: 'forwards' });
    requestAnimationFrame(() => roomPh.classList.add('clear')); // 模糊 → 清晰
    if (IS_FILE) { setTimeout(() => toast('能转的全景房间要用「启动预览.cmd」打开', 3200), 900); return; }
    if (!roomFrame.src) roomFrame.src = 'room/index.html?v=20261024b';
    else { setTimeout(onRoomReady, 500); sendRoomInfo(); }
  }
  function onRoomReady() { roomFrame.classList.add('ready'); setTimeout(() => roomPh.classList.add('gone'), 700); }
  // 告诉房间：这封信写给谁（手机 QQ 里的联系人），以及表单里上传过的照片 / 视频（电脑里放映）
  let mediaUrls = [];
  function sendRoomInfo() {
    const l = letters[openedIdx] || {};
    mediaUrls.forEach(u => { if (u.url.startsWith('blob:')) URL.revokeObjectURL(u.url); });
    // 刚上传的是 File；从存档恢复的是服务端引用 { url, type, name }
    mediaUrls = (l.media || []).map(f => f instanceof Blob ? { url: URL.createObjectURL(f), type: f.type, name: f.name, lastModified: f.lastModified } : { url: f.url, type: f.type, name: f.name });
    const person = l.twin ? l.twin.name : (l.to || '').replace(/^给\s*/, '');
    try { roomFrame.contentWindow.postMessage({ type: 'jrlx-room', person, media: mediaUrls, twin: l.twin || null }, location.origin); } catch (e) {}
  }
  roomFrame.addEventListener('load', () => { sendRoomInfo(); setTimeout(onRoomReady, 300); });
  addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'jrlx-device') return;
    if (e.data.leave) { leaveRoom(); return; } // 房间里点了门：回到信件页
    $('#roomBack').style.visibility = e.data.open ? 'hidden' : 'visible';
    // 房间里拿起手机：电脑上把整台 Demo 手机从横屏转回竖屏，放下再转回横屏（真手机上转不了，就不动）
    if (e.data.open && e.data.portrait) turnDevice(false);
    else if (!e.data.open && phoneUpright) turnDevice(true);
  });
  let phoneUpright = false, turning = Promise.resolve();
  function turnDevice(land) {
    if (isMobile() || state.view !== 'room' || device.classList.contains('land') === land) return;
    phoneUpright = !land;
    turning = turning.then(async () => {
      if (land) {
        await device.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-90deg)' }], { duration: 520, easing: 'cubic-bezier(.4,0,.2,1)' }).finished;
        device.classList.add('land'); fit();
      } else {
        device.classList.remove('land'); fit();
        await device.animate([{ transform: 'rotate(-90deg)' }, { transform: 'rotate(0)' }], { duration: 520, easing: 'cubic-bezier(.4,0,.2,1)' }).finished;
      }
    });
  }
  roomFrame.addEventListener('error', () => toast('房间没加载出来：请用「启动预览.cmd」打开'));
  $('#roomBack').addEventListener('click', leaveRoom);
  async function leaveRoom() {
    if (state.busy) return; state.busy = true; Sound.tap();
    try { roomFrame.contentWindow.postMessage({ type: 'jrlx-room', action: 'leave' }, location.origin); } catch (e) {} // 唱片机别还在放
    await veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, fill: 'forwards' }).finished;
    if (device.classList.contains('land') && !isMobile()) { // 电脑上：外框转回竖屏
      device.classList.remove('land'); fit();
      device.animate([{ transform: 'rotate(-90deg)' }, { transform: 'rotate(0)' }], { duration: 520, easing: 'cubic-bezier(.4,0,.2,1)' });
    }
    views.room.classList.remove('on');
    if (isMobile()) fit(); // 真手机：离开房间就回竖屏画面
    // 信封复原
    // 信封复原：每一封都复原，不只认 openedIdx（慢网下存档的空间可能在房间里才加载完、信封堆重建过，序号会对不上，拆开那封就一直放大着）
    items.forEach(it => { it.el.getAnimations().forEach(a => a.cancel()); it.el.classList.remove('opening'); });
    unflip();
    views.letters.style.zIndex = ++z; views.letters.classList.add('on'); state.view = 'letters';
    tabbar.classList.add('on'); tabbar.style.zIndex = z + 1; setTab('space', false);
    renderWheel();
    await veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' }).finished;
    state.busy = false;
  }

  /* ================= 组员的部分（parts/*，接口见 shared/bridge.js 和 协作约定.md） ================= */
  const PART_VIEW = { custom: 'create', mine: 'mine' };   // 部分名 → 本页视图名
  const partFrames = Object.fromEntries($$('.part-frame').map(f => [f.dataset.part, f]));
  const fileUrls = new WeakMap();                         // 同一个 File 只建一次 blob 地址，各部分共用
  const blobUrl = f => { if (!fileUrls.has(f)) fileUrls.set(f, URL.createObjectURL(f)); return fileUrls.get(f); };
  function sharedState() {
    const d = data[state.kind] || {}, opened = letters[openedIdx];
    const files = [...(d.media || []), ...(d.chat || [])];
    return {
      person: {
        kind: state.kind === 'self' ? 'self' : 'ta',
        name: d.name || (opened ? opened.to.replace(/^给\s*/, '') : '外婆'),
        relation: d.relation || '', period: d.period || '', gender: d.gender || '', birthday: d.bday || '',
        impression: d.impression || d.review || '',
      },
      letters: letters.map(l => ({ to: l.to, addr: l.addr, subj: l.subj })),
      media: files.map(f => ({ url: blobUrl(f), type: f.type, name: f.name })),
    };
  }
  const toPart = (name, action) => {
    const f = partFrames[name];
    try { f.contentWindow.postMessage({ type: 'jrlx-shell', action, state: sharedState() }, location.origin); } catch (e) {}
  };
  // 首屏的图下完：放开其余页面的图，再过一会儿在后台先把定制 / 我的加载好，点进去不用再等
  function warmUp() {
    document.documentElement.classList.add('warm');
    if (IS_FILE) { $$('.soon-hint').forEach(h => { h.textContent = '要用「启动预览.cmd」打开才看得到'; h.style.animation = 'none'; }); return; }
    setTimeout(() => Object.keys(PART_VIEW).forEach(name => { const f = partFrames[name]; if (!f.src) f.src = `parts/${name}/index.html`; }), 2500);
  }
  if (document.readyState === 'complete') warmUp(); else addEventListener('load', warmUp, { once: true });
  setTimeout(() => document.documentElement.classList.add('warm'), 20000); // 网太慢、首屏迟迟下不完时也别一直憋着
  Object.entries(PART_VIEW).forEach(([name, view]) => {
    onEnter[view] = () => {
      if (IS_FILE) return;
      const f = partFrames[name];
      if (!f.src) f.src = `parts/${name}/index.html`; else toPart(name, 'enter');
    };
  });
  addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'jrlx-part') return;
    const { part, action } = e.data, f = partFrames[part];
    if (!f || e.source !== f.contentWindow) return;
    const here = state.view === PART_VIEW[part];
    if (action === 'ready') { toPart(part, 'init'); f.classList.add('ready'); }
    else if (action === 'tabbar' && here) tabbar.classList.toggle('on', e.data.show);
    else if (action === 'toast') toast(e.data.msg);
    else if (action === 'sound' && typeof Sound[e.data.name] === 'function' && /^(tap|flip|tick|crack|unfold)$/.test(e.data.name)) { Sound.init(); Sound[e.data.name](); }
    else if (action === 'go' && here) {
      const to = e.data.to;
      if (to === 'restart') restart();
      else if (to === 'space') go(state.hasLetters ? 'letters' : 'box', 'fade');
      else if (to === 'letters') { state.hasLetters = true; go('letters', 'fade'); }
      else if (PART_VIEW[to]) go(PART_VIEW[to], 'fade');
    }
  });

  /* ================= 演示控制 ================= */
  function restart() {
    if (state.view === 'room') { views.room.classList.remove('on'); device.classList.remove('land'); fit(); }
    Object.values(views).forEach(v => v.classList.remove('on', 'over', 'behind'));
    veil.getAnimations().forEach(a => a.cancel());
    letters.splice(0, letters.length, ...LETTERS.map(l => ({ ...l }))); buildWheel(); p = 3; mode = 0; setStraighten(true); renderWheel();
    restoreSpaces(); // 存过的空间还在（要清掉去后台 admin.html）
    state.view = 'launch'; state.hasLetters = true; state.busy = false;
    $('#boxBack').classList.remove('on');
    views.launch.classList.add('on'); views.launch.style.zIndex = ++z; tabbar.classList.remove('on'); resetBox();
  }
  $$('.guide [data-act]').forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.act;
    if (a === 'restart') restart();
    else if (a === 'letters') { if (state.view === 'room') leaveRoom(); else { state.hasLetters = true; go('letters', 'fade'); } }
    else if (a === 'sound') { Sound.on = !Sound.on; b.setAttribute('aria-pressed', String(Sound.on)); b.textContent = Sound.on ? '声音 开' : '声音 关'; }
  }));
  // 手机扫码：本地预览从 /__lan 取局域网/穿透地址；线上静态版直接用当前公开网址生成二维码。
  async function setupQr(tries = 0) {
    if (IS_FILE || typeof qrcode !== 'function') return;
    let info = { ips: [], port: location.port, public: {} };
    const online = JRLXStore.static && /^https?:$/.test(location.protocol);
    if (!online) {
      try { info = await (await fetch('/__lan', { cache: 'no-store' })).json(); } catch (e) {}
    }
    const pub = info.public || {};
    if (pub.state === 'starting' && tries < 20) setTimeout(() => setupQr(tries + 1), 3000);   // 穿透还在连，连上后换成公网码
    const opts = (info.ips || []).map(a => ({ key: a.ip, label: `${a.via} ${a.ip}`, via: a.via, url: `http://${a.ip}:${info.port}${location.pathname}` }));
    if (pub.url) opts.unshift({ key: 'public', label: '公网', via: '公网', url: pub.url });
    if (online) opts.unshift({ key: 'online', label: '在线', via: '在线', url: location.href });
    if (!opts.length) return;
    const box = $('#guideQr'), ipsEl = $('#qrIps');
    const show = a => {
      const qr = qrcode(0, 'M'); qr.addData(a.url); qr.make();
      $('#qrImg').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      $('#qrVia').textContent = a.via === '在线' ? '长期网址 · 手机用流量或任何 WiFi 都能打开' : a.via === '公网' ? '手机用流量或任何 WiFi 都能扫（电脑要开着）' : a.via === '电脑热点' ? '手机连上这台电脑的热点后扫' : '手机和电脑连同一个 WiFi 后扫';
      $('#qrUrl').textContent = a.url.replace(/^https?:\/\//, '').replace(/\?k=.*$/, '');
      $$('button', ipsEl).forEach(b => b.classList.toggle('on', b.dataset.key === a.key));
      $('#guideNote').textContent = a.via === '在线' ? '这是长期在线地址，发送链接或用相机扫码都能打开。' : a.via === '公网' ? '用手机相机或浏览器扫。链接里带着口令，只发给信得过的人。' : '用手机相机或浏览器扫，别用微信扫（微信会拦截局域网地址）。';
    };
    ipsEl.innerHTML = opts.length > 1 ? opts.map(a => `<button type="button" data-key="${a.key}">${a.label}</button>`).join('') : '';
    $$('button', ipsEl).forEach(b => b.addEventListener('click', () => show(opts.find(a => a.key === b.dataset.key))));
    show(opts[0]);
    box.hidden = false;
  }
  setupQr();

  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (state.view === 'room') leaveRoom(); else if (state.view === 'form') closeForm(); else if (state.view === 'box' && state.hasLetters) backToLetters('down'); else if (state.view === 'box' && box.classList.contains('open')) settlePull(0);
  });

  buildWheel(); renderWheel();
  restoreSpaces();
  views.launch.classList.add('on');
})();
