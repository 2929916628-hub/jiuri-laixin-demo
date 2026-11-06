/* 旧日来信 · 记忆空间交互原型 v2
   360° 真场景 + 点物件看旧事。

   设计依据（见 ../AI_CONTEXT.md）：
   · 房间是壳，不是主角 —— 进来先看见一处「还在发生」的东西，不是一张清单
   · 一次只掉一个碎片；看到一半就断，是材料本身的样子
   · 每条内容带证据等级 A/B/C/D，宁可说「记录里没有」
   · 回忆有结尾：每个碎片都要有一个收束动作
   · 不做搜索、相册首页、文件夹、完成度、统计、打卡
*/

import { PanoViewer, uvToAngles, RAD } from './pano.js?v=20261024b';
import { openComputer, openQQ, warmMemories, players, registerAudioContext } from './devices.js?v=20261024b';

const DEG = RAD;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/* ------------------------------------------------------------------ 内容 */

const SPACE = {
  title: '旧日来信',
  sub: '2009 · 那个夏天',
  person: '阿哲',
};

const HOTSPOTS = [
  {
    id: 'crt',
    u: 0.4435,
    v: 0.566,
    name: '那台电脑',
    whisper: '屏幕还亮着',
    first: true,
    moment: {
      when: '2009 · 07 · 夜里',
      title: '屏幕还亮着',
      level: 'A',
      source: '原始聊天记录 · QQ',
      body: {
        type: 'chat',
        lines: [
          { t: '21:47', who: '他', side: 'them', text: '你睡了吗' },
          { t: '21:47', who: '我', side: 'me', text: '没' },
          { t: '21:49', who: '他', side: 'them', text: '我给你看个东西' },
          { t: '21:49', who: '他', side: 'them', text: '[图片]', kind: 'img' },
          { t: '21:52', who: '我', side: 'me', text: '什么啊，黑乎乎的' },
          { t: '21:53', who: '他', side: 'them', text: '月亮。我趴在窗台上拍的' },
          { t: '21:53', who: '他', side: 'them', text: '拍不清楚，你就当它是' },
        ],
      },
      half: '后面还有一句。记录到这里断了。',
      senses: [
        ['声音', '键盘'],
        ['气味', '蚊香'],
        ['触感', '桌面有点黏'],
      ],
      action: '往后靠一点',
      after: '屏幕还亮着。你没有再看它。',
      side: '这段记录是从你的电脑里导出的，只有你这一侧。他说过什么、删过什么，没有留下来。',
      onAction: () => {
        app.dim = 0.9;
      },
    },
  },
  {
    id: 'phone',
    u: 0.484,
    v: 0.664,
    name: '那部手机',
    whisper: '有一条没看完的消息',
    moment: {
      when: '2009 · 08 · 睡前',
      title: '耳机线绕了三圈',
      level: 'B',
      source: '你后来补充过',
      body: {
        type: 'notes',
        paras: [
          '左耳还是没有声音。你把音量按到最大，说这样两边就一样响了。',
          '歌名你记得，歌词忘了。',
        ],
      },
      half: '歌单里第七首。文件已经损坏。',
      senses: [
        ['声音', '电流底噪'],
        ['触感', '线皮磨白了'],
        ['气味', '塑料'],
      ],
      action: '把耳机拔掉',
      after: '拔掉以后，屋里只剩下风扇。',
    },
  },
  {
    // 唱片机：不弹卡片，点一下随机放一首那年的歌，再点一下停（见 toggleRecord）
    id: 'record',
    u: 0.531,
    v: 0.597,
    name: '唱片机',
    whisper: '放一首那年的歌',
  },
  {
    id: 'drawer',
    u: 0.638,
    v: 0.648,
    name: '床头柜',
    whisper: '抽屉里有东西',
    moment: {
      when: '2009 · 08 · 深夜',
      title: '抽屉最里面',
      level: 'B',
      source: '你说你见过这封信',
      body: {
        type: 'letter',
        lines: ['阿哲：', '那天在天台，我其实听见了。', '但是我装作没听见。'],
      },
      half: '信纸的右半边被撕掉了。',
      senses: [
        ['触感', '纸的毛边'],
        ['气味', '抽屉的木头味'],
      ],
      action: '把信放回去',
      after: '抽屉合上，发出一声很轻的响。',
    },
  },
  {
    id: 'fan',
    u: 0.775,
    v: 0.6005,
    name: '落地风扇',
    whisper: '风是热的',
    moment: {
      when: '2009 · 07 · 下午',
      title: '那年夏天的风',
      level: 'A',
      source: '原录像里的环境声',
      body: {
        type: 'sound',
        note: '按下播放，是那段录像里的声音。',
        paras: ['风扇转了一整个下午，声音盖过了电视。', '你记住的不是画面，是风。'],
      },
      half: '这段声音是从一段 11 秒的录像里抠出来的。',
      senses: [
        ['声音', '扇叶'],
        ['气味', '晒过的凉席'],
        ['触感', '风是热的'],
      ],
      action: '关掉风扇',
      after: '声音停下来以后，蝉声才听见。',
      onAction: () => audio.fan(0, 1.4),
    },
  },
  {
    id: 'mirror',
    u: 0.0214,
    v: 0.54,
    name: '衣柜镜子',
    whisper: '门框上有刻度',
    moment: {
      when: '1998 — 2003',
      title: '门框上的刻度',
      level: 'A',
      source: '照片里能看到',
      body: {
        type: 'ladder',
        rows: [
          { year: '1998', cm: 95 },
          { year: '2000', cm: 121 },
          { year: '2003', cm: 148 },
        ],
        paras: ['最上面那道是别人画的。你一直说不是。'],
      },
      half: '2005 年以后，没有新的刻度了。',
      senses: [],
      action: '退后一步',
      after: '镜子里的房间，比你以为的小。',
      onAction: () => {
        view.targetFov = 80 * DEG;
      },
    },
  },
  {
    id: 'guitar',
    u: 0.6756,
    v: 0.6317,
    name: '木吉他',
    whisper: '只学会一个和弦',
    moment: {
      when: '2009 · 夏末',
      title: '只学会一个和弦',
      level: 'C',
      source: '从照片里的手势推的',
      body: {
        type: 'notes',
        paras: [
          '你会的是 Em。整个夏天，你把同一段弹了几百遍。',
          '邻居敲过两次墙。',
        ],
      },
      half: '那首歌的后半段，没有人听你弹过。',
      senses: [
        ['声音', '弦的余音'],
        ['触感', '指腹的硬皮'],
      ],
      action: '按住弦',
      after: '弦停下来的声音，比弹的时候长。',
    },
  },
  {
    id: 'lamp',
    u: 0.798,
    v: 0.215,
    name: '吊灯',
    whisper: '去拉一下灯绳',
    switch: true,
    moment: {
      when: '不是记忆',
      title: '吊灯',
      level: null,
      source: '',
      body: { type: 'switch' },
      half: '',
      senses: [],
      action: '拉一下灯绳',
      after: '',
    },
  },
  {
    id: 'door',
    u: 0.857,
    v: 0.52,
    name: '门',
    whisper: '该走了',
    exit: true,
    moment: {
      when: '离开',
      title: '门上的「福」',
      level: null,
      source: '',
      body: {
        type: 'notes',
        paras: ['边角翘起来了，用透明胶粘过一次。', '门后面是走廊，走廊尽头是厨房。'],
      },
      half: '',
      senses: [],
      action: '关灯，出去',
      after: '',
    },
  },
];

const LEVELS = {
  A: ['真实出现', '原话、原图、原文件，能翻到出处。'],
  B: ['你确认过', '你补充过，但原始材料里没有。'],
  C: ['推测', '从照片、语气、旁人的话里推出来的。'],
  D: ['模型生成', '为了让空间完整而补的，不是你要的那件事。'],
};

/* ------------------------------------------------------------------ 存档 */

const STORE_KEY = 'jrlx.v2';
const store = {
  data: { opened: {}, notes: {}, light: 'dusk', visits: 0 },
  load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) Object.assign(this.data, JSON.parse(raw));
    } catch (e) {
      /* 无痕模式也能用，只是不记 */
    }
  },
  save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.data));
    } catch (e) {}
  },
};

/* ------------------------------------------------------------------ 声音 */

class RoomTone {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.fanLevel = 1;
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // 房间底噪
    this.room = this._noise('brown');
    const roomLp = ctx.createBiquadFilter();
    roomLp.type = 'lowpass';
    roomLp.frequency.value = 240;
    const roomGain = ctx.createGain();
    roomGain.gain.value = 0.13;
    this.room.connect(roomLp).connect(roomGain).connect(this.master);
    this.room.start();

    // 风扇：带通噪声 + 一点点电机低鸣
    this.fanBus = ctx.createGain();
    this.fanBus.gain.value = 0.0;
    this.fanBus.connect(this.master);

    const fanNoise = this._noise('white');
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 420;
    bp.Q.value = 0.6;
    const fanGain = ctx.createGain();
    fanGain.gain.value = 0.085;
    fanNoise.connect(bp).connect(fanGain).connect(this.fanBus);
    fanNoise.start();

    const hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 98;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.02;
    hum.connect(humGain).connect(this.fanBus);
    hum.start();

    // 蝉：窄带噪声 + 慢速起伏
    this.cicadaBus = ctx.createGain();
    this.cicadaBus.gain.value = 0.0;
    this.cicadaBus.connect(this.master);
    const cicNoise = this._noise('white');
    const cicBp = ctx.createBiquadFilter();
    cicBp.type = 'bandpass';
    cicBp.frequency.value = 4600;
    cicBp.Q.value = 12;
    const cicGain = ctx.createGain();
    cicGain.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.23;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.035;
    lfo.connect(lfoGain).connect(cicGain.gain);
    cicNoise.connect(cicBp).connect(cicGain).connect(this.cicadaBus);
    cicNoise.start();
    lfo.start();

    return ctx;
  }

  _noise(kind) {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      } else {
        d[i] = w;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  }

  async enable(on) {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') await ctx.resume();
    this.on = on;
    const now = ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.linearRampToValueAtTime(on ? 0.9 : 0.0, now + 1.2);
    this.cicadaBus.gain.setTargetAtTime(on ? 0.55 : 0, now + 0.2, 1.5);
    this.fanBus.gain.setTargetAtTime(on ? this.fanLevel : 0, now, 0.8);
  }

  fan(level, seconds = 1.2) {
    if (!this.ctx) return;
    this.fanLevel = level;
    const now = this.ctx.currentTime;
    this.fanBus.gain.cancelScheduledValues(now);
    this.fanBus.gain.linearRampToValueAtTime(level, now + seconds);
  }

  /* 翻开一张纸的声音：一小段带通噪声，衰减很快 */
  paper() {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    if (!this.burst) {
      const len = Math.round(ctx.sampleRate * 0.25);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const env = Math.pow(1 - i / len, 6);
        d[i] = (Math.random() * 2 - 1) * env;
      }
      this.burst = buf;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.burst;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = 0.20;
    src.connect(bp).connect(g).connect(this.master);
    src.start(now);
  }
}

const audio = new RoomTone();

/* ------------------------------------------------------------------ 元素 */

const el = {
  canvas: document.getElementById('pano'),
  spots: document.getElementById('spots'),
  card: document.getElementById('card'),
  gate: document.getElementById('gate'),
  enter: document.getElementById('enter'),
  hint: document.getElementById('hint'),
  legend: document.getElementById('legend'),
  end: document.getElementById('end'),
  endText: document.getElementById('endText'),
  endBtn: document.getElementById('endBtn'),
  btnSound: document.getElementById('btnSound'),
  btnLegend: document.getElementById('btnLegend'),
  btnExit: document.getElementById('btnExit'),
  btnGuide: document.getElementById('btnGuide'),
  whisper: document.getElementById('whisper'),
  spaceName: document.getElementById('spaceName'),
};

/* ------------------------------------------------------------------ 状态 */

const view = {
  yaw: 106 * DEG,
  pitch: -9 * DEG,
  fov: 68 * DEG,
  targetYaw: 106 * DEG,
  targetPitch: -9 * DEG,
  targetFov: 68 * DEG,
  ease: 0.12,
};

const app = {
  phase: 'gate',
  mode: 'dusk',
  mix: 0,
  mixTarget: 0,
  openId: null,
  savedView: null,
  hovered: null,
  firstOpened: false,
  dim: 1,
  dimTarget: 1,
  fovEase: 0.09,
  dragging: false,
  moved: 0,
  lastPointer: null,
  velYaw: 0,
  velPitch: 0,
  lastFrame: performance.now(),
};

let viewer;
const spots = new Map();

/* ------------------------------------------------------------------ 初始化 */

async function init() {
  store.load();
  app.mode = store.data.light === 'night' ? 'night' : 'dusk';
  app.mix = app.mode === 'night' ? 1 : 0;
  app.mixTarget = app.mix;

  viewer = new PanoViewer(el.canvas);
  viewer.set({ yaw: view.yaw, pitch: view.pitch, fov: view.fov, mix: app.mix });

  const jobs = [viewer.load('A', 'assets/pano_dusk.jpg')];
  jobs.push(
    viewer.load('B', 'assets/pano_night.jpg').catch((e) => {
      console.warn('夜景还没渲好：', e.message);
      return null;
    })
  );
  await Promise.all(jobs);

  buildSpots();
  bindEvents();
  requestAnimationFrame(tick);

  document.body.classList.add('ready');

  // 调试用：?skip=1 直接进屋；?yaw=106&pitch=-9&fov=68 定住视角
  const q = new URLSearchParams(location.search);
  // 不要「推门进去」那一页：加载好就直接在屋里（单独调试想看封面时加 ?gate）
  enterRoom(); // 没有「推门进去」那一页了：加载好就直接在屋里
  // 没有按钮点一下来解锁声音了：交给 devices.js 在第一次点屏幕（手指抬起）时一起恢复
  registerAudioContext(audio.ctx);
  if (q.has('yaw')) view.targetYaw = view.yaw = parseFloat(q.get('yaw')) * DEG;
  if (q.has('pitch')) view.targetPitch = view.pitch = parseFloat(q.get('pitch')) * DEG;
  if (q.has('fov')) view.targetFov = view.fov = parseFloat(q.get('fov')) * DEG;
  if (q.has('skip')) {
    setTimeout(() => {
      enterRoom();
      if (q.has('yaw')) view.targetYaw = view.yaw;
      if (q.has('pitch')) view.targetPitch = view.pitch;
      if (q.has('open')) {
        const id = q.get('open');
        setTimeout(() => openMoment(id), 700);
      }
    }, 30);
  }
  if (q.get('mode') === 'night') toggleLight();

  // 调试入口：控制台里 __scene.pos('crt') / __scene.look(20, -10) / __scene.open('crt')
  window.__scene = {
    hotspots: HOTSPOTS,
    state: app,
    view,
    pos(id) {
      const hs = HOTSPOTS.find((h) => h.id === id);
      if (!hs) return null;
      const p = viewer.project(hs.az, hs.elev);
      return { x: p.x, y: p.y, angle: p.angle, depth: p.depth };
    },
    look(yaw, pitch, fov) {
      view.yaw = view.targetYaw = yaw * DEG;
      view.pitch = view.targetPitch = pitch * DEG;
      if (fov) view.fov = view.targetFov = fov * DEG;
    },
    open(id) {
      openMoment(id);
    },
    close() {
      closeMoment();
    },
    info() {
      return { ...view, phase: app.phase, mode: app.mode, zoomDeg: view.fov / DEG };
    },
  };
}

function buildSpots() {
  for (const hs of HOTSPOTS) {
    const a = uvToAngles(hs.u, hs.v);
    hs.az = a.az;
    hs.elev = a.elev;

    const node = document.createElement('div');
    node.className = 'spot' + (hs.first ? ' is-first' : '') + (hs.switch ? ' is-switch' : '');
    node.dataset.id = hs.id; // 说明浮字按物件分方向摆，挨得近的几样不叠在一起
    node.setAttribute('aria-hidden', 'true');
    node.innerHTML = `
      <span class="spot-glow"></span>
      <span class="spot-ring"></span>
      <span class="spot-label">
        <b>${hs.name}</b>
        <i>${hs.whisper || ''}</i>
        ${GUIDE[hs.id] ? `<em>${GUIDE[hs.id]}</em>` : ''}
      </span>`;
    el.spots.appendChild(node);
    spots.set(hs.id, node);
  }
}

/* ------------------------------------------------------------------ 循环 */

function tick(now) {
  const dt = Math.min(0.05, (now - app.lastFrame) / 1000);
  app.lastFrame = now;

  // 相机缓动
  view.yaw += (view.targetYaw - view.yaw) * Math.min(1, view.ease);
  view.pitch += (view.targetPitch - view.pitch) * Math.min(1, view.ease);
  view.fov += (view.targetFov - view.fov) * Math.min(1, app.fovEase);

  // 惯性
  if (!app.dragging) {
    if (Math.abs(app.velYaw) > 0.00002 || Math.abs(app.velPitch) > 0.00002) {
      view.targetYaw += app.velYaw;
      view.targetPitch = clamp(view.targetPitch + app.velPitch, -55 * DEG, 55 * DEG);
      app.velYaw *= 0.92;
      app.velPitch *= 0.92;
    }
  }

  // 开灯 / 关灯
  if (Math.abs(app.mix - app.mixTarget) > 0.002) {
    app.mix += (app.mixTarget - app.mix) * Math.min(1, dt * 3.2);
  } else {
    app.mix = app.mixTarget;
  }

  if (Math.abs(app.dim - app.dimTarget) > 0.001) {
    app.dim += (app.dimTarget - app.dim) * Math.min(1, dt * 2.4);
  }

  viewer.set({
    // 静止时极轻的呼吸，像有人还坐在椅子上
    yaw: view.yaw + (app.phase === 'roam' && !app.dragging ? Math.sin(now / 4200) * 0.006 : 0),
    pitch: view.pitch + (app.phase === 'roam' && !app.dragging ? Math.sin(now / 5300 + 1.2) * 0.004 : 0),
    fov: view.fov,
    mix: app.mix,
    // 夜里的渲染本身压得比较暗，这里把整体亮度提回来一点
    exposure: (1.0 + app.mix * 0.35) * app.dim,
  });
  viewer.render(dt);

  updateSpots();
  requestAnimationFrame(tick);
}

function updateSpots() {
  const W = el.canvas.clientWidth;
  const H = el.canvas.clientHeight;
  for (const hs of HOTSPOTS) {
    const node = spots.get(hs.id);
    if (!node) continue;
    const p = viewer.project(hs.az, hs.elev);
    const visible = p.depth > 0.15 && p.angle < 62;
    node.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
    node.style.opacity = visible ? String(clamp(1 - (p.angle - 38) / 24, 0, 1)) : '0';
    node.style.pointerEvents = 'none';
    node.classList.toggle('is-near', p.angle < 12);
    node.classList.toggle('is-hover', app.hovered === hs.id);
    node.style.zIndex = String(1000 - Math.round(p.angle * 10));
    if (p.x < -80 || p.x > W + 80 || p.y < -80 || p.y > H + 80) node.style.opacity = '0';
  }
}

/* ------------------------------------------------------------------ 交互 */

function bindEvents() {

  el.canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  el.canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const next = clamp(view.targetFov + e.deltaY * 0.0006, 38 * DEG, 86 * DEG);
      view.targetFov = next;
    },
    { passive: false }
  );

  // 双指缩放
  let pinch = null;
  el.canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      pinch = { d: dist(e.touches[0], e.touches[1]), fov: view.targetFov };
    }
  });
  el.canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinch) {
      const d = dist(e.touches[0], e.touches[1]);
      view.targetFov = clamp((pinch.fov * pinch.d) / Math.max(1, d), 38 * DEG, 86 * DEG);
      e.preventDefault();
    }
  }, { passive: false });
  el.canvas.addEventListener('touchend', () => { pinch = null; });

  window.addEventListener('keydown', (e) => {
    if (app.phase === 'device') return; // 电脑 / 手机打开时，按键交给设备自己处理
    if (e.key === 'Escape') closeMoment();
    if (e.key === 'Escape' && !el.legend.hidden) el.legend.hidden = true;
    if (el.card && el.card.contains(document.activeElement) && e.target.tagName === 'INPUT') return;
    const step = 6 * DEG;
    if (e.key === 'ArrowLeft') view.targetYaw += step;
    if (e.key === 'ArrowRight') view.targetYaw -= step;
    if (e.key === 'ArrowUp') view.targetPitch = clamp(view.targetPitch + step, -55 * DEG, 55 * DEG);
    if (e.key === 'ArrowDown') view.targetPitch = clamp(view.targetPitch - step, -55 * DEG, 55 * DEG);
  });

  el.btnSound.addEventListener('click', () => {
    const next = !audio.on;
    audio.enable(next);
    el.btnSound.setAttribute('aria-pressed', String(next));
    el.btnSound.textContent = next ? '声音 开' : '声音 关';
  });

  el.btnGuide.addEventListener('click', () => (document.body.classList.contains('guiding') ? hideGuide() : showGuide(true)));

  el.btnLegend.addEventListener('click', () => {
    el.legend.hidden = !el.legend.hidden;
  });
  el.legend.addEventListener('click', (e) => {
    if (e.target === el.legend) el.legend.hidden = true;
  });

  el.btnExit?.addEventListener('click', () => {
    if (app.phase === 'roam') openMoment('door');
  });
}

function dist(a, b) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function onDown(e) {
  if (app.phase !== 'roam') return;
  el.hint.classList.remove('show');
  app.dragging = true;
  app.moved = 0;
  app.lastPointer = { x: e.clientX, y: e.clientY };
  app.velYaw = 0;
  app.velPitch = 0;
  el.canvas.setPointerCapture?.(e.pointerId);
  el.canvas.classList.add('is-dragging');
}

function onMove(e) {
  if (app.phase !== 'roam') return;

  if (app.dragging && app.lastPointer) {
    const dx = e.clientX - app.lastPointer.x;
    const dy = e.clientY - app.lastPointer.y;
    app.lastPointer = { x: e.clientX, y: e.clientY };
    app.moved += Math.abs(dx) + Math.abs(dy);

    const k = (view.fov / el.canvas.clientHeight) * 1.05;
    const dYaw = dx * k;
    const dPitch = dy * k;
    view.targetYaw += dYaw;
    view.targetPitch = clamp(view.targetPitch + dPitch, -55 * DEG, 55 * DEG);
    app.velYaw = dYaw * 0.55;
    app.velPitch = dPitch * 0.55;
    app.hovered = null;
    return;
  }

  // 悬停检测
  const hit = hitTest(e.clientX, e.clientY);
  if (hit !== app.hovered) {
    app.hovered = hit;
    el.canvas.classList.toggle('is-pointing', Boolean(hit));
  }
}

function onUp(e) {
  if (!app.dragging) return;
  app.dragging = false;
  el.canvas.classList.remove('is-dragging');
  if (app.moved < 8) {
    const hit = hitTest(e.clientX, e.clientY);
    if (hit) openMoment(hit);
  }
}

function hitTest(clientX, clientY) {
  const rect = el.canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  let best = null;
  let bestD = 50;
  for (const hs of HOTSPOTS) {
    if (app.phase !== 'roam') break;
    const p = viewer.project(hs.az, hs.elev);
    if (p.depth <= 0.15) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) {
      best = hs.id;
      bestD = d;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ 进门 */

function enterRoom() {
  if (app.phase !== 'gate') return;
  app.phase = 'roam';
  store.data.visits = (store.data.visits || 0) + 1;
  store.save();

  // 像坐下来一样，慢慢把视野收回来
  view.fov = view.targetFov = 92 * DEG;
  app.fovEase = 0.014;
  document.body.classList.add('in-room');

  audio.enable(true);
  el.btnSound.setAttribute('aria-pressed', 'true');
  el.btnSound.textContent = '声音 开';

  setTimeout(() => { view.targetFov = 68 * DEG; }, 120);
  setTimeout(() => { app.fovEase = 0.09; }, 4000);

  setTimeout(() => {
    el.hint.classList.add('show');
    showGuide(); // 只在第一次进来时出现；之后点右上角「说明」再看
    if (!document.body.classList.contains('guiding')) showFirstWhisper();
  }, 1000);

  setTimeout(() => { if (!document.body.classList.contains('guiding')) el.hint.classList.remove('show'); }, 6500);
}

function showFirstWhisper() {
  const hs = HOTSPOTS.find((h) => h.id === 'crt');
  if (!hs) return;
  if (store.data.opened[hs.id]) return;
  el.whisper.textContent = '屏幕还亮着。';
  el.whisper.classList.add('show');
  setTimeout(() => el.whisper.classList.remove('show'), 7000);
}

/* ------------------------------------------------------------------ 唱片机 */

// 点一下：唱针落下，随机放一首（放完接着随机下一首）；再点一下：停
const SONGS = [
  { src: 'assets/songs/song_ni_hai_yao_wo_zen_yang.mp3', title: '你还要我怎样', artist: '薛之谦' },
  { src: 'assets/songs/song_si_yi_yang_de_tong.mp3', title: '죽을 만큼 아파서（死一样的痛）', artist: 'MC몽 · Mellow' },
];
const record = { audio: null, last: -1, raf: 0 };
function recordFade(a, to, ms, done) {
  cancelAnimationFrame(record.raf);
  const v0 = a.volume, t0 = performance.now();
  const f = (t) => { const k = clamp((t - t0) / ms, 0, 1); a.volume = v0 + (to - v0) * k; if (k < 1) record.raf = requestAnimationFrame(f); else if (done) done(); };
  record.raf = requestAnimationFrame(f);
}
function playSong() {
  let i = Math.floor(Math.random() * SONGS.length);
  if (SONGS.length > 1 && i === record.last && Math.random() < 0.6) i = (i + 1) % SONGS.length; // 随机，但别老是同一首
  record.last = i;
  const s = SONGS[i], a = players.music; // 复用已解锁的播放器（手机上 new Audio() 会被拦）
  a.onended = () => { if (record.audio === a) playSong(); };
  a.volume = 0; a.src = s.src;
  a.play().then(() => recordFade(a, 0.85, 1200)).catch((e) => { console.warn('[唱片机] 放不出来', e); whisper('声音被浏览器拦住了，再点一下唱片机试试', 3600); spots.get('record')?.classList.remove('is-playing'); record.audio = null; });
  record.audio = a;
  spots.get('record')?.classList.add('is-playing');
  whisper(`唱针落下来了 ·《${s.title}》${s.artist}`, 5200);
}
function stopSong(quiet) {
  const a = record.audio; if (!a) return;
  record.audio = null;
  recordFade(a, 0, 700, () => { if (!record.audio) a.pause(); }); // 淡出途中又点了放歌就别停
  spots.get('record')?.classList.remove('is-playing');
  if (!quiet) whisper('唱片慢慢停了下来。', 3600);
}
function toggleRecord(hs) {
  if (app.phase !== 'roam') return;
  ripple(hs); audio.paper();
  record.audio ? stopSong() : playSong();
}
function whisper(text, ms) {
  el.whisper.textContent = text; el.whisper.classList.add('show');
  clearTimeout(whisper.t); whisper.t = setTimeout(() => el.whisper.classList.remove('show'), ms);
}

/* ------------------------------------------------------------------ 第一次进来：在场景里每样东西旁边浮出一句说明 */

// 不弹整页说明：每个可点的物件旁边直接浮一行小字，跟着物件走，转到哪儿看到哪儿
const GUIDE = {
  crt: '照片和视频 · 点开会想起更多，按住想起更多',
  phone: 'TA 当年的 QQ · 开了数字分身 TA 会回你',
  record: '点一下放首那年的歌，再点一下停',
  drawer: '藏着一段小事 · 看完可以留一句',
  guitar: '藏着一段小事',
  fan: '藏着一段小事',
  mirror: '藏着一段小事',
  lamp: '开灯 · 关灯，看看白天和夜里',
  door: '从这里离开',
};
let guideTimer = 0;
function showGuide(force) {
  if (!force && store.data.guided) return;
  store.data.guided = true; store.save();
  document.body.classList.add('guiding');
  el.hint.textContent = '拖动看看四周 · 发着微光的小圈都能点';
  el.hint.classList.add('show');
  clearTimeout(guideTimer); guideTimer = setTimeout(hideGuide, 16000);
}
function hideGuide() {
  if (!document.body.classList.contains('guiding')) return;
  clearTimeout(guideTimer);
  document.body.classList.remove('guiding');
  el.hint.classList.remove('show');
}

/* ------------------------------------------------------------------ 卡片 */

function openMoment(id) {
  const hs = HOTSPOTS.find((h) => h.id === id);
  if (!hs) return;
  if (app.openId === id) return;
  hideGuide(); // 点了第一样东西，说明就不用了
  // 电脑、手机不再弹纸片卡片，而是推近后打开整屏的「设备」；唱片机直接放歌
  if (id === 'crt' || id === 'phone') return openDevice(hs);
  if (id === 'record') return toggleRecord(hs);

  ripple(hs);
  audio.paper();
  app.hovered = null;

  app.openId = id;
  app.phase = 'moment';
  if (!app.savedView) {
    app.savedView = { yaw: view.targetYaw, pitch: view.targetPitch, fov: view.targetFov };
  }

  // 看向它，稍微走近一点
  view.targetYaw = nearestAngle(view.yaw, hs.az * DEG);
  view.targetPitch = hs.elev * DEG;
  view.targetFov = hs.switch ? 60 * DEG : 52 * DEG;

  store.data.opened[id] = (store.data.opened[id] || 0) + 1;
  store.save();

  el.whisper.classList.remove('show');
  el.card.innerHTML = template(hs);
  el.card.hidden = false;
  el.card.classList.remove('card-out');
  requestAnimationFrame(() => el.card.classList.add('card-in'));

  bindCard(hs);
  if (hs.switch) unlockSwitch(hs);
  document.body.classList.add('has-card');
}

/* ------------------------------------------------------------------ 设备：电脑 · 手机 */

// 外层 Demo 传进来的材料（表单里上传的照片 / 视频）和这封信的收件人
const ext = { media: [], person: '', twin: null };
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || !e.data || e.data.type !== 'jrlx-room') return;
  if (e.data.action === 'leave') { stopSong(true); return; } // 外层退出房间：歌别还在后台放
  ext.media = Array.isArray(e.data.media) ? e.data.media : [];
  ext.person = e.data.person || '';
  ext.twin = e.data.twin || null; // 数字分身（../shared/twin.js 生成的人设），有它手机里的人才会回话
  warmMemories(ext.media); // 电脑里的素材先在后台让 AI 看起来
});
const tellParent = (msg) => { try { if (window.parent !== window) window.parent.postMessage({ type: 'jrlx-device', ...msg }, location.origin); } catch (e) {} };

function openDevice(hs) {
  if (app.phase !== 'roam') return;
  ripple(hs);
  audio.paper();
  app.hovered = null;
  app.phase = 'device';
  app.openId = hs.id;
  app.savedView = { yaw: view.targetYaw, pitch: view.targetPitch, fov: view.targetFov };
  // 镜头转过去、推得很近，像俯身看屏幕
  view.targetYaw = nearestAngle(view.yaw, hs.az * DEG);
  view.targetPitch = hs.elev * DEG;
  view.targetFov = (hs.id === 'phone' ? 20 : 26) * DEG;
  store.data.opened[hs.id] = (store.data.opened[hs.id] || 0) + 1;
  store.save();
  el.whisper.classList.remove('show');
  spots.get('crt')?.classList.remove('is-first');
  tellParent({ open: true, portrait: hs.id === 'phone' }); // 看手机时让外层把屏幕转成竖屏

  const done = () => {
    app.phase = 'roam';
    app.openId = null;
    if (app.savedView) {
      view.targetYaw = app.savedView.yaw;
      view.targetPitch = app.savedView.pitch;
      view.targetFov = app.savedView.fov;
      app.savedView = null;
    }
    tellParent({ open: false });
    el.whisper.textContent = hs.id === 'crt' ? '屏幕暗下去了。照片还在里面。' : '手机扣回桌上，屏幕又亮了一下。';
    el.whisper.classList.add('show');
    setTimeout(() => el.whisper.classList.remove('show'), 5200);
  };
  setTimeout(() => {
    if (hs.id === 'crt') openComputer({ media: ext.media, onClose: done });
    else openQQ({ person: ext.person || SPACE.person, twin: ext.twin, store, onClose: done });
  }, 620);
}

function ripple(hs) {
  const p = viewer.project(hs.az, hs.elev);
  if (p.depth <= 0) return;
  const r = document.createElement('div');
  r.className = 'ripple';
  r.style.left = `${p.x}px`;
  r.style.top = `${p.y}px`;
  document.getElementById('app').appendChild(r);
  setTimeout(() => r.remove(), 900);
}

function nearestAngle(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + d;
}

function closeMoment(after) {
  if (!app.openId) return;
  const hs = HOTSPOTS.find((h) => h.id === app.openId);
  app.openId = null;
  app.phase = 'roam';
  app.hovered = null;
  el.card.classList.add('card-out');
  document.body.classList.remove('has-card');
  setTimeout(() => {
    el.card.hidden = true;
    el.card.classList.remove('card-in', 'card-out');
  }, 320);

  if (app.savedView) {
    view.targetYaw = app.savedView.yaw;
    view.targetPitch = app.savedView.pitch;
    view.targetFov = app.savedView.fov;
    app.savedView = null;
  }

  if (hs && hs.id === 'crt') {
    spots.get('crt')?.classList.remove('is-first');
  }
  if (after) {
    el.whisper.textContent = after;
    el.whisper.classList.add('show');
    setTimeout(() => el.whisper.classList.remove('show'), 5200);
  }
}

function template(hs) {
  const m = hs.moment;
  const level = m.level
    ? `<button class="level" data-level="${m.level}" title="${LEVELS[m.level][0]}">${
        m.level
      } · ${LEVELS[m.level][0]}</button>`
    : '';

  const notes = (store.data.notes[hs.id] || []).slice(-1)[0];
  const drift = notes
    ? `<div class="drift-note"><span>上次你写的是</span><p>${escapeHtml(notes.text)}</p></div>`
    : '';

  return `
    <div class="paper">
      <div class="tape" aria-hidden="true"></div>
      <button class="card-close" aria-label="放下">×</button>
      <div class="paper-scroll">
        <header class="card-head">
          <p class="when">${m.when}</p>
          <h2>${m.title}</h2>
          ${level}
        </header>
        <div class="body">${bodyTemplate(hs)}</div>
        ${m.half ? `<p class="half">${m.half}</p>` : ''}
        ${
          m.side
            ? `<button class="link" data-side>那他那边的记录呢？</button><p class="side-note" hidden>${m.side}</p>`
            : ''
        }
        ${
          m.senses && m.senses.length
            ? `<ul class="senses">${m.senses
                .map(([k, v]) => `<li><span>${k}</span>${v}</li>`)
                .join('')}</ul>`
            : ''
        }
        ${m.source ? `<p class="source">来源 · ${m.source}</p>` : ''}
        ${drift}
        <footer class="card-foot">
          <button class="act" data-act>${m.action}</button>
          ${hs.switch || hs.exit ? '' : '<button class="ghost" data-note>留一句</button>'}
        </footer>
        <div class="note-form" hidden>
          <label>你现在记得的，和刚才看到的，可能不是同一件事。</label>
          <div class="note-row">
            <input type="text" maxlength="60" placeholder="写一句，下次它还会在这儿" />
            <button class="save-note">记下</button>
          </div>
        </div>
      </div>
    </div>`;
}

function bodyTemplate(hs) {
  const b = hs.moment.body;
  if (b.type === 'chat') {
    return `<div class="chat">${b.lines
      .map(
        (l) => `
        <div class="line ${l.side}">
          <span class="t">${l.t}</span>
          <div class="bubble ${l.kind === 'img' ? 'bubble-img' : ''}">${escapeHtml(l.text)}</div>
        </div>`
      )
      .join('')}</div>`;
  }
  if (b.type === 'letter') {
    return `<div class="letter">${b.lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}</div>`;
  }
  if (b.type === 'ladder') {
    return `
      <div class="ladder">
        ${b.rows
          .map(
            (r) => `<div class="rung">
              <span class="year">${r.year}</span>
              <span class="bar" style="width:${Math.round(((r.cm - 80) / 90) * 100)}%"></span>
              <span class="cm">${r.cm} cm</span>
            </div>`
          )
          .join('')}
      </div>
      <div class="paras">${b.paras.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}</div>`;
  }
  if (b.type === 'sound') {
    return `
      <div class="sound">
        <button class="play" data-play aria-label="播放">
          <span class="bars"><i></i><i></i><i></i><i></i><i></i></span>
        </button>
        <p class="sound-note">${b.note}</p>
      </div>
      <div class="paras">${b.paras.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}</div>`;
  }
  if (b.type === 'switch') {
    return `<div class="paras"><p data-switch-text>天还没黑透，灯就开着了。</p></div>`;
  }
  return `<div class="paras">${(b.paras || []).map((p) => `<p>${escapeHtml(p)}</p>`).join('')}</div>`;
}

function bindCard(hs) {
  el.card.querySelector('.card-close').addEventListener('click', () => closeMoment());

  const act = el.card.querySelector('[data-act]');
  act.addEventListener('click', () => {
    if (hs.switch) {
      toggleLight();
      return;
    }
    if (hs.exit) {
      beginEnding();
      return;
    }
    const after = hs.moment.after || '放回去了。';
    if (hs.moment.onAction) hs.moment.onAction();
    act.disabled = true;
    act.classList.add('done');
    act.textContent = '放回去了';
    setTimeout(() => closeMoment(after), 620);
  });

  const noteBtn = el.card.querySelector('[data-note]');
  const form = el.card.querySelector('.note-form');
  const sideBtn = el.card.querySelector('[data-side]');
  const sideNote = el.card.querySelector('.side-note');
  sideBtn?.addEventListener('click', () => {
    sideNote.hidden = false;
    sideBtn.hidden = true;
  });
  noteBtn?.addEventListener('click', () => {
    form.hidden = !form.hidden;
    if (!form.hidden) form.querySelector('input').focus();
  });

  const save = () => {
    const input = form.querySelector('input');
    const text = input.value.trim();
    if (!text) return;
    const list = store.data.notes[hs.id] || [];
    list.push({ at: new Date().toISOString(), text });
    store.data.notes[hs.id] = list;
    store.save();
    form.innerHTML = `<p class="saved">记下了。下次来，它还在这儿。</p>`;
  };
  form.querySelector('.save-note').addEventListener('click', save);
  form.querySelector('input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
  });

  const play = el.card.querySelector('[data-play]');
  if (play) {
    play.addEventListener('click', () => {
      play.classList.toggle('playing');
      audio.fan(play.classList.contains('playing') ? 1 : 0.15, 1.2);
      audio.enable(true);
      el.btnSound.setAttribute('aria-pressed', 'true');
      el.btnSound.textContent = '声音 开';
    });
  }
}

function unlockSwitch(hs) {
  const text = el.card.querySelector('[data-switch-text]');
  const act = el.card.querySelector('[data-act]');
  const sync = () => {
    const night = app.mode === 'night';
    if (text) {
      text.textContent = night
        ? '灯关了以后，房间比记忆里亮一点。'
        : '天还没黑透，灯就开着了。';
    }
    if (act) act.textContent = night ? '再拉一下' : '拉一下灯绳';
  };
  hs._syncSwitch = sync;
  sync();
}

function toggleLight() {
  app.mode = app.mode === 'night' ? 'dusk' : 'night';
  app.mixTarget = app.mode === 'night' ? 1 : 0;
  store.data.light = app.mode;
  store.save();
  const hs = HOTSPOTS.find((h) => h.id === 'lamp');
  hs?._syncSwitch?.();
  document.body.classList.toggle('is-night', app.mode === 'night');
}

/* ------------------------------------------------------------------ 离开 */

// 门：不再停在「这一晚到这里」那一页，直接让外层回到信件页（单独打开房间时就只关上卡片）
function beginEnding() {
  stopSong(true);
  closeMoment();
  if (window.parent !== window) tellParent({ leave: true });
}

/* ------------------------------------------------------------------ 杂项 */

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

init().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div style="position:fixed;inset:0;display:grid;place-items:center;background:#14100c;color:#f6eee2;font:14px/1.8 system-ui;padding:24px;text-align:center">
       <div>全景图没能加载。<br>把 <code>assets/pano_dusk.jpg</code> 放好，或者用 <code>启动预览.cmd</code> 起一个本地服务。<br><span style="opacity:.6">${escapeHtml(
         e.message
       )}</span></div>
     </div>`
  );
});
