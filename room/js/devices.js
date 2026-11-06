/* 旧日来信 · 房间里的两件「设备」
   电脑 → 开机，放映那段时间的照片和视频（优先用表单里上传的材料）
   手机 → 2009 年前后手机 QQ 风格的聊天记录：一条条进来，最后一句断在「正在输入」 */

const $ = (s, r = document) => r.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BACK_SVG = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M17 6.4 C23 6.3 27.9 11.1 27.8 17.2 C27.7 23.2 23 28.1 17 28 C10.9 28.1 6.1 23.3 6.2 17.2 C6.3 11.2 11 6.5 17 6.4 Z" fill="#C89A3E"/><path d="M19.6 6.8 Q15.2 11.1 11 15.5 Q10.5 16 11 16.5 Q15.2 20.9 19.8 25.2" fill="none" stroke="#1B0D00" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* ---------- 声音：几个很轻的合成音，不用音频文件 ---------- */
let actx = null;
function ac() {
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(freq, dur, { type = 'sine', gain = 0.06, delay = 0 } = {}) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
}
const sfx = {
  crtOn() { tone(60, 0.5, { type: 'sawtooth', gain: 0.05 }); tone(15700, 1.4, { gain: 0.006, delay: 0.1 }); },
  click() { tone(2400, 0.03, { type: 'square', gain: 0.02 }); },
  msgIn() { tone(1175, 0.09, { gain: 0.05 }); tone(1568, 0.14, { gain: 0.045, delay: 0.1 }); },
  msgOut() { tone(880, 0.07, { gain: 0.035 }); },
  fail() { tone(330, 0.18, { type: 'triangle', gain: 0.05 }); },
};

/* ---------- 共用：浮层的开关 ---------- */
function makeLayer(cls, html) {
  const layer = document.createElement('section');
  layer.className = `device-layer ${cls}`;
  layer.innerHTML = html + `<button class="dv-back" type="button" aria-label="放下，回到房间">${BACK_SVG}</button>`;
  document.getElementById('app').appendChild(layer);
  requestAnimationFrame(() => layer.classList.add('on'));
  return layer;
}
async function closeLayer(layer) {
  layer.classList.remove('on');
  layer.classList.add('off');
  await sleep(420);
  layer.remove();
}

/* ================================================================ 电脑 */

/* 记忆桌面：屏幕上先只摆几张；看一张会想起相关的（记忆连锁）；长按聚焦，按得越久周围浮现越多。
   每张素材有一份「分析」：tags 内容标签、tod 时段、sense 一句感官描写、sound 环境音。
   默认素材的分析是手写的；上传的素材由 AI 看图生成（本地服务 /__ai，没配就只按时间关联），结果缓存在浏览器里。 */
const DEFAULT_MEDIA = [
  { src: 'assets/memories/photo_1.jpg', kind: 'img', t: '2009-07-12T16:10', cap: '书桌 · 下午四点的太阳',
    a: { tags: ['书桌', '电脑', '聊天', '唱片机', '阳光', '窗'], tod: '午后', sense: '机箱嗡嗡地热着，像一只趴在桌上睡着的猫', sound: 'summer_day' } },
  { src: 'assets/memories/photo_4.jpg', kind: 'img', t: '2009-07-18T17:30', cap: '收拾过一次，又乱了',
    a: { tags: ['书桌', '书架', '挂历', '电脑', '阳光'], tod: '傍晚', sense: '挂历还停在七月，纸角被风掀起又落下', sound: 'wind' } },
  { src: 'assets/memories/video_1.mp4', kind: 'video', t: '2009-07-21T15:00', cap: '风一吹，窗帘就鼓起来',
    a: { tags: ['窗帘', '窗', '风', '阳光', '午后'], tod: '午后', sense: '蕾丝窗帘一鼓一鼓，把太阳筛成碎碎的光斑', sound: 'wind' } },
  { src: 'assets/memories/photo_5.jpg', kind: 'img', t: '2009-08-02T22:40', cap: '床边 · 那把只会一个和弦的吉他',
    a: { tags: ['床', '吉他', '风扇', '海报', '夜晚'], tod: '夜里', sense: '风扇摇着头，把凉气一下一下送到枕头边', sound: 'fan' } },
  { src: 'assets/memories/photo_6.jpg', kind: 'img', t: '2009-08-15T10:20', cap: '墙上的地图，从来没去过上面的地方',
    a: { tags: ['地图', '电视', '衣柜', '窗帘', '远方'], tod: '上午', sense: '手指在地图上划过的海，比楼下的河还要远', sound: 'waves' } },
  { src: '../assets/fig/scene_classroom.jpg', kind: 'img', t: '2009-06-30T11:50', cap: '教室 · 靠窗那排',
    a: { tags: ['教室', '课桌', '黑板', '窗', '阳光', '学校'], tod: '中午', sense: '粉笔灰浮在光里，后排有人把书本翻得哗哗响', sound: 'school' } },
  { src: '../assets/fig/scene_playground.jpg', kind: 'img', t: '2009-07-25T18:20', cap: '小区游乐场 · 大象滑梯',
    a: { tags: ['游乐场', '滑梯', '小区', '树荫', '傍晚'], tod: '傍晚', sense: '滑梯被晒了一整天，坐上去还是温的', sound: 'playground' } },
];
const SOUNDS = { // 环境音（assets/ambience，Mixkit 免费授权）；fan 是代码合成的
  rain: '雨声', storm: '雷雨', wind: '风声', birds: '鸟叫', summer_night: '夏夜虫鸣', summer_day: '午后的虫鸣',
  night_market: '夜市人声', canteen: '饭馆里的说话声', street: '街上的车声', waves: '海浪', stream: '流水',
  playground: '孩子们在玩', school: '教室里的声音', fire: '柴火噼啪', fan: '风扇转着',
};
const SOUND_FILE = { summer_day: 'summer_night' }; // 白天的虫鸣暂时借用夏夜虫鸣
const stamp = (d) => { const y = String(d.getFullYear()).slice(2), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0'); return `'${y} ${m} ${dd}`; };
const clamp01 = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/* ---------- 手机上的声音解锁 ----------
   手机浏览器只允许在「手指点下去那一下」里开始放声音；AI 分析完再放、或者每次 new Audio() 都会被拦。
   所以只用两个固定的播放器（音乐、环境音），在第一次点屏幕时用一段静音把它们和 WebAudio 一起解锁，之后随时能放。 */
export const players = { music: new Audio(), amb: new Audio() };
const SILENT = (() => { // 0.05 秒的静音 WAV
  const n = 400, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
})();
const extraCtx = new Set(); // 房间环境声等别的 AudioContext 也一起恢复
export function registerAudioContext(c) { if (c) extraCtx.add(c); }
let unlocked = false;
function unlockAudio() {
  const c = ac(); extraCtx.forEach((x) => { if (x.state === 'suspended') x.resume(); });
  if (c) { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); }
  if (unlocked) return;
  unlocked = true;
  Object.values(players).forEach((p) => { if (!p.src || p.src === SILENT) { p.src = SILENT; p.play().then(() => p.pause()).catch(() => { unlocked = false; }); } });
}
['touchend', 'pointerup', 'click', 'keydown'].forEach((ev) => window.addEventListener(ev, unlockAudio, { capture: true, passive: true }));

/* ---------- 环境音：聚焦时淡入，松开淡出 ---------- */
const ambience = (() => {
  let cur = null;
  function fanNode(c) { // 风扇：低通的棕噪声 + 一点点电机嗡声，音量随摇头慢慢起伏
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    const hum = c.createOscillator(); hum.frequency.value = 98; const hg = c.createGain(); hg.gain.value = 0.012;
    const out = c.createGain(); out.gain.value = 0;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.12; const lg = c.createGain(); lg.gain.value = 0.25; lfo.connect(lg).connect(out.gain);
    src.connect(lp).connect(out); hum.connect(hg).connect(out); out.connect(c.destination);
    src.start(); hum.start(); lfo.start();
    return { out, stop: () => { try { src.stop(); hum.stop(); lfo.stop(); } catch (e) {} } };
  }
  function play(key) {
    stop();
    if (!key || !SOUNDS[key]) return;
    if (key === 'fan') {
      const c = ac(); if (!c) return; const n = fanNode(c);
      n.out.gain.setValueAtTime(0, c.currentTime); n.out.gain.linearRampToValueAtTime(0.55, c.currentTime + 1.4);
      cur = { stop: () => { n.out.gain.cancelScheduledValues(c.currentTime); n.out.gain.setValueAtTime(n.out.gain.value, c.currentTime); n.out.gain.linearRampToValueAtTime(0, c.currentTime + 0.8); setTimeout(n.stop, 900); } };
      return;
    }
    const a = players.amb, token = {}; // 复用已解锁的那一个播放器
    a.loop = true; a.volume = 0; a.src = `assets/ambience/${SOUND_FILE[key] || key}.mp3`; a._token = token;
    a.play().catch((e) => console.warn('[环境音] 放不出来', e));
    let raf = 0; const fade = (to, ms, done) => { cancelAnimationFrame(raf); const v0 = a.volume, t0 = performance.now();
      const f = (t) => { if (a._token !== token) return; const k = clamp01((t - t0) / ms); a.volume = v0 + (to - v0) * k; if (k < 1) raf = requestAnimationFrame(f); else done && done(); }; raf = requestAnimationFrame(f); };
    fade(0.7, 1400);
    cur = { stop: () => fade(0, 800, () => { if (a._token === token) a.pause(); }) };
  }
  function stop() { if (cur) { cur.stop(); cur = null; } }
  return { play, stop };
})();

/* ---------- 分析：AI 看图（或手写的默认分析），缓存在 localStorage ---------- */
const SOUND_LIST = Object.entries(SOUNDS).map(([k, v]) => `${k}=${v}`).join('，');
const VISION = '这是某个人旧日回忆里的一张照片。请像一个会写短诗的朋友那样看它，只输出 JSON：' +
  '{"tags":["3到6个中文名词，画面里的东西、地点、季节"],"tod":"清晨|上午|中午|午后|傍晚|夜里|不确定",' +
  '"sense":"一句画面之外的感官描写，写气味、声音、温度或触感，22 字以内，要文艺、具体、克制，不要出现“照片”“画面”“回忆”这些词。' +
  '比如夜市：远处传来烤生蚝的味道，混着一点炭火的烟；比如雨天的窗：玻璃上的水痕一道追着一道往下跑",' +
  `"sound":"从这些里选一个最贴切的：${SOUND_LIST}；都不贴切就写 none"}`;
const cacheKey = (m) => 'jrlx.mem.' + (m.src.startsWith('blob:') ? `${m.name}|${m.lastModified}` : m.src);
async function frameOf(it) { // 取一张缩小的图（视频取第 0.8 秒）给 AI 看
  const el = it.kind === 'video' ? Object.assign(document.createElement('video'), { muted: true, preload: 'auto', src: it.src }) : Object.assign(new Image(), { src: it.src });
  await new Promise((ok, no) => { if (it.kind === 'video') { el.onloadeddata = () => { el.currentTime = Math.min(0.8, (el.duration || 1) / 2); }; el.onseeked = ok; } else el.onload = ok; el.onerror = no; });
  const w = el.videoWidth || el.naturalWidth, h = el.videoHeight || el.naturalHeight, k = Math.min(1, 640 / w), c = document.createElement('canvas');
  if (!w || !h) throw new Error('解不出画面'); // 比如电脑版 Chrome 播不了 HEVC 视频：别把空图发给 AI（会被退回 400）
  c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext('2d').drawImage(el, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.75);
}
const inflight = new Map(); // 同一份素材只分析一次（进房间时预热、打开电脑时又要，共用一个请求）
// 服务端共用的分析结果（_serve.py 的 /__data/mem）：电脑上看过的，手机扫码进来直接用，不用再等 AI 看二三十秒
let sharedMem = null;
let hostStore = null;
try { hostStore = window.JRLXStore || (window.parent !== window && window.parent.JRLXStore); } catch (e) {}
const staticHost = !!(hostStore && hostStore.static);
const loadShared = () => staticHost ? Promise.resolve({}) : (sharedMem ||= fetch('/__data/mem', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
const putShared = (key, a) => staticHost ? Promise.resolve() : fetch('/__data/mem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, a }) }).catch(() => {});
function analyze(it) {
  if (it.a) return Promise.resolve(it.a);
  const key = cacheKey(it);
  let local = null;
  try { local = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) {}
  if (!inflight.has(key)) inflight.set(key, (async () => {
    const shared = await loadShared(), mine = key.startsWith('jrlx.mem./__data/'); // 只有存进服务端的材料，换台设备还是同一个地址
    if (local) { if (mine && !shared[key]) { shared[key] = local; putShared(key, local); } return local; } // 本机早先看过的，顺手传上去
    if (shared[key]) { try { localStorage.setItem(key, JSON.stringify(shared[key])); } catch (e) {} return shared[key]; }
    let a = await analyzeAI(it);
    if (!a) a = await analyzeLocal(it);
    if (a && mine) { shared[key] = a; putShared(key, a); }
    return a;
  })().finally(() => inflight.delete(key)));
  return inflight.get(key).then((a) => (a ? (it.a = a) : null));
}
async function analyzeAI(it) {
  const st = window.JRLXTwin ? await window.JRLXTwin.aiStatus() : { vision: false };
  if (!st.vision) return null;
  let url; try { url = await frameOf(it); } catch (e) { return null; }
  for (const max_tokens of [1600, 3200]) { // deepseek-flash 先想再答，额度给少了正文会是空的；空了就加额度再试一次
    try {
      const r = await fetch('/__ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'vision', temperature: 0.8, max_tokens,
        messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url } }, { type: 'text', text: VISION }] }] }) });
      const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error);
      const m = String(d.content || '').replace(/```(?:json)?/g, '').match(/\{[\s\S]*\}/); if (!m) continue;
      const j = JSON.parse(m[0]);
      const a = { tags: (j.tags || []).map(String).slice(0, 6), tod: String(j.tod || ''), sense: String(j.sense || '').slice(0, 40), sound: SOUNDS[j.sound] ? j.sound : null, ai: true };
      try { localStorage.setItem(cacheKey(it), JSON.stringify(a)); } catch (e) {}
      return a;
    } catch (e) { console.warn('[记忆] 分析失败', e); }
  }
  return null;
}

/* ---------- 静态托管：手机浏览器内做视觉识别，不依赖后台和 API key ---------- */
let localVisionP = null;
const scriptP = new Map();
function loadScript(src) {
  if (scriptP.has(src)) return scriptP.get(src);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('视觉模型脚本没加载出来'));
    document.head.appendChild(s);
  });
  scriptP.set(src, p);
  return p;
}
function localVisionModel() {
  if (!localVisionP) {
    localVisionP = (async () => {
      await loadScript('assets/vision/tf.min.js');
      await loadScript('assets/vision/mobilenet.min.js');
      if (!window.tf || !window.mobilenet) throw new Error('视觉模型没有初始化');
      const modelUrl = new URL('assets/vision/mobilenet/model.json', location.href).href;
      return window.mobilenet.load({ version: 1, alpha: 1.0, modelUrl });
    })().catch((e) => {
      console.warn('[记忆] 本地视觉模型不可用', e);
      localVisionP = null;
      return null;
    });
  }
  return localVisionP;
}

const VISION_RULES = [
  {
    tag: '鸟', sound: 'birds',
    re: /bird|jay|magpie|chickadee|robin|bulbul|toucan|hornbill|hummingbird|kite|vulture|ostrich|flamingo|pelican|albatross|parrot|cockatoo|lorikeet|macaw|peacock|quail|partridge|grouse|jacamar|bee eater/i,
    sense: { 清晨: '叶子还带着夜里的湿气，枝头先传来几声轻叫。', 上午: '枝叶把光筛得很细，鸟在枝间轻轻换了换脚。', 中午: '日头落在叶背上，偶尔一声鸟叫，把午后叫得更静。', 午后: '叶子把午后的光筛得很碎，枝头传来两声轻叫。', 傍晚: '天色慢慢收下来，鸟叫一声短，一声长。', 夜里: '天黑以后只剩叶子的响动，远处偶尔掠过一翅。' }
  },
  {
    tag: '水', sound: 'waves',
    re: /seashore|lakeside|ocean|reef|coral|geyser|fountain|waterfall|sandbar|breakwater|pier|canoe|gondola|lakeshore|river|water/i,
    sense: { 清晨: '水声还没醒透，一下一下，慢慢推到岸边。', 上午: '水面上有很细的亮光，风一吹就碎开了。', 中午: '水面白得发亮，潮气贴着皮肤慢慢浮上来。', 午后: '水声一直没有停，像谁在远处反复翻一页纸。', 傍晚: '水面把最后一点天光揉碎，风里带着潮湿的味道。', 夜里: '黑下来的水还在响，一阵近，一阵远。' }
  },
  {
    tag: '街', sound: 'street',
    re: /car|taxi|bus|truck|traffic|street|convertible|jeep|minibus|limousine|van|motor|scooter|bicycle|cab/i,
    sense: { 清晨: '街面刚被洒过水，车轮压过去，声音湿漉漉的。', 上午: '远处的车一辆接一辆，喇叭声隔着楼传过来。', 中午: '阳光把路面照得发白，车声在热气里变得很钝。', 午后: '车流不断，玻璃上反着一层晃动的光。', 傍晚: '路灯亮起来，轮胎碾过地面的声音慢了下来。', 夜里: '偶尔有车从楼下经过，灯光扫过墙面又消失。' }
  },
  {
    tag: '吃的', sound: 'canteen',
    re: /pizza|plate|cake|espresso|restaurant|dining table|hotdog|bagel|pretzel|ice cream|banana|orange|lemon|strawberry|pineapple|broccoli|cauliflower|mushroom|meat|bread|corn|pepper|apple|food/i,
    sense: { 清晨: '热气刚冒起来，杯沿和碗边都有一点温。', 上午: '空气里有食物的香味，混着桌边轻轻的说话声。', 中午: '饭菜的热气浮上来，勺子碰到碗沿响了一下。', 午后: '桌面还留着一点余温，甜味慢慢散在空气里。', 傍晚: '灯亮以后，香味显得更近，也更容易让人饿。', 夜里: '厨房里只剩很轻的动静，余味还浮在空气里。' }
  },
  {
    tag: '猫', sound: 'summer_day',
    re: /tabby|tiger cat|siamese|persian cat|egyptian cat|cat/i,
    sense: { 清晨: '它把身子团成一小块，呼吸轻得几乎听不见。', 上午: '阳光移到脚边，它也慢慢挪过去了一点。', 中午: '屋里很静，只剩均匀的呼吸和风扇的轻响。', 午后: '它半眯着眼，尾巴偶尔在地上扫一下。', 傍晚: '窗外的光暗下来，它抬头看了很久。', 夜里: '黑暗里两点眼睛亮了一下，又安静下去。' }
  },
  {
    tag: '狗', sound: 'summer_day',
    re: /dog|retriever|terrier|spaniel|shepherd|poodle|husky|malamute|corgi|collie|pug|chihuahua|dalmatian|schnauzer|dingo/i,
    sense: { 清晨: '爪子在地面上嗒嗒走过，尾巴先替它打了招呼。', 上午: '它跑过一小段路，又回头停下来等你。', 中午: '太阳晒得地面发亮，它趴在阴影边上喘气。', 午后: '它把鼻子贴在门边，外面的声音都听得清清楚楚。', 傍晚: '风里有熟悉的味道，它忽然抬起头，耳朵也竖起来。', 夜里: '它听见楼下的脚步，低低地哼了一声。' }
  },
  {
    tag: '植物', sound: 'wind',
    re: /flower|daisy|sunflower|rose|orchid|vase|pot|garden|greenhouse|mushroom|grass|tree|leaf|plant|wood/i,
    sense: { 清晨: '叶尖还挂着一点湿气，风碰过去，整片影子都在动。', 上午: '阳光从叶缝里落下来，桌面上多了一层碎光。', 中午: '绿意被日头照得更深，空气里有一点土和水的味道。', 午后: '风从叶间穿过去，沙沙声很轻，却一直没有停。', 傍晚: '叶片的颜色慢慢沉下来，边缘还留着最后一点亮。', 夜里: '看不清颜色了，只听见叶子偶尔互相碰一下。' }
  },
  {
    tag: '天空', sound: 'wind',
    re: /sky|cloud|mountain|cliff|valley|lakeside|seashore|sunset|alp|volcano/i,
    sense: { 清晨: '天边的颜色还很淡，风先一步吹过来。', 上午: '云影慢慢移过去，地面上的光也跟着换了地方。', 中午: '天光太亮，远处的轮廓几乎要融在一起。', 午后: '风从很远的地方过来，带着一点干燥的味道。', 傍晚: '最后一点亮落在天边，颜色一层一层收下去。', 夜里: '天完全暗了，只剩风从很高的地方经过。' }
  },
  {
    tag: '屋里', sound: 'fan',
    re: /computer|monitor|keyboard|mouse|laptop|desk|bookshelf|bookcase|wardrobe|chest|table lamp|television|screen|projector|printer/i,
    sense: { 清晨: '窗帘还没完全拉开，机器低低地响着。', 上午: '桌面上的光慢慢移过去，键盘边缘落了一层亮。', 中午: '屋里比外面安静，只有风扇和电流的轻响。', 午后: '机箱嗡嗡地热着，屏幕上的光映在桌边。', 傍晚: '房间先暗下来，屏幕显得比白天更亮。', 夜里: '屏幕是屋里最亮的地方，风扇一直轻轻地转。' }
  }
];

function imageStats(img) {
  const c = document.createElement('canvas'); c.width = 48; c.height = 48;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, 48, 48);
  const d = g.getImageData(0, 0, 48, 48).data;
  let lum = 0, warm = 0, green = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2];
    lum += r * .2126 + gg * .7152 + b * .0722;
    warm += r - b;
    green += gg - (r + b) / 2;
  }
  const n = d.length / 4;
  return { lum: lum / n, warm: warm / n, green: green / n };
}
function timeWord(it, stats) {
  let hour = null;
  const m = String(it.name || '').match(/(?:20)?(\d{2})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/);
  if (m) hour = +m[4];
  if (hour == null && it.lastModified) {
    const d = new Date(it.lastModified); if (!Number.isNaN(d.getTime())) hour = d.getHours();
  }
  if (hour == null) {
    if (stats.lum < 48) return '夜里';
    if (stats.warm > 24 && stats.lum < 130) return '傍晚';
    if (stats.lum > 175) return '中午';
    return '午后';
  }
  if (hour >= 5 && hour < 9) return '清晨';
  if (hour >= 9 && hour < 12) return '上午';
  if (hour >= 12 && hour < 14) return '中午';
  if (hour >= 14 && hour < 18) return '午后';
  if (hour >= 18 && hour < 20) return '傍晚';
  return '夜里';
}
function localAnalysis(preds, stats, tod) {
  const labels = (preds || []).map((p) => String(p.className || '').split(',')[0].trim());
  const rule = VISION_RULES.find((r) => labels.some((x) => r.re.test(x)));
  let sound = rule && rule.sound;
  let tag = rule && rule.tag;
  if (!sound) {
    if (stats.lum < 55) sound = 'summer_night';
    else if (stats.green > 10) sound = 'wind';
    else if (stats.warm > 30) sound = 'summer_day';
    else sound = 'street';
    tag = stats.green > 10 ? '日常' : stats.lum < 55 ? '夜色' : '旧时光';
  }
  const sense = rule && rule.sense[tod]
    ? rule.sense[tod]
    : (tod === '夜里'
      ? '屋里只剩很轻的电流声，窗外的光慢慢停在墙上。'
      : '光从旁边慢慢移过来，空气里留着一点那天熟悉的味道。');
  const tags = [tag];
  if (stats.green > 12) tags.push('绿意');
  if (stats.lum > 160) tags.push('日光');
  if (stats.warm > 25) tags.push('暖色');
  return { tags: [...new Set(tags)].slice(0, 6), tod, sense, sound, local: true };
}
async function analyzeLocal(it) {
  const data = await frameOf(it);
  const img = new Image();
  img.src = data;
  await new Promise((ok, no) => { img.onload = ok; img.onerror = no; });
  if (img.decode) { try { await img.decode(); } catch (e) {} }
  const stats = imageStats(img);
  const model = await localVisionModel();
  let preds = [];
  if (model) {
    try { preds = await model.classify(img, 8); } catch (e) { console.warn('[记忆] 本地识别失败', e); }
  }
  const a = localAnalysis(preds, stats, timeWord(it, stats));
  try { localStorage.setItem(cacheKey(it), JSON.stringify(a)); } catch (e) {}
  return a;
}
const toItems = (media) => (media.length
  ? media.map((m, i) => ({ src: m.url, kind: m.type && m.type.startsWith('video') ? 'video' : 'img', name: m.name, lastModified: m.lastModified,
    ts: m.lastModified || 0, cap: m.name || '你放进来的材料', a: null, i }))
  : DEFAULT_MEDIA.map((m, i) => ({ ...m, ts: Date.parse(m.t), i })))
  .map((it) => ({ ...it, date: it.ts ? stamp(new Date(it.ts)) : '' }));
// 一进房间就在后台先分析上传的素材，等走到电脑前多半已经好了
export function warmMemories(media = []) { if (media.length) toItems(media).forEach((it) => analyze(it)); }
// 两份素材有多相关：内容标签重合 + 时段 / 声音相同 + 时间接近（没有分析时只看时间）
function related(a, b) {
  let s = 0;
  if (a.a && b.a) {
    const A = new Set(a.a.tags), B = new Set(b.a.tags), inter = [...A].filter((x) => B.has(x)).length;
    s += inter / Math.max(1, new Set([...A, ...B]).size) * 1.4;
    if (a.a.tod && a.a.tod === b.a.tod) s += 0.2;
    if (a.a.sound && a.a.sound === b.a.sound) s += 0.25;
  }
  if (a.ts && b.ts) s += Math.exp(-Math.abs(a.ts - b.ts) / (5 * 864e5)) * 0.7;
  return s;
}

export function openComputer({ media = [], onClose } = {}) {
  const items = toItems(media);
  const layer = makeLayer('pc', `
    <div class="pc-crt">
      <div class="pc-screen">
        <div class="pc-desk">
          <div class="pc-board">
            <svg class="pc-threads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>
            <div class="pc-prints"></div>
            <div class="pc-veil"></div>
            <div class="pc-focus" hidden><div class="pf-media"></div><span class="pf-date"></span><div class="pf-words"><p class="pf-sense"></p><p class="pf-cap"></p><p class="pf-sound"></p></div></div>
            <p class="pc-hint">点一张看看　·　按住不放，会想起更多</p>
          </div>
          <div class="pc-task"><span class="pc-start">开始</span><span class="pc-tab">那年夏天</span><span class="pc-clock">21:47</span></div>
        </div>
        <div class="pc-scan"></div>
      </div>
      <div class="pc-led"></div>
    </div>`);

  const board = $('.pc-board', layer), prints = $('.pc-prints', layer), threads = $('.pc-threads', layer), veil = $('.pc-veil', layer);
  const focus = $('.pc-focus', layer), fMedia = $('.pf-media', layer), hint = $('.pc-hint', layer);
  let alive = true;
  const shown = new Map(); // 素材序号 → { el, x, y }（x、y 是桌面上的 0–1 坐标）
  const thumb = (it) => it.kind === 'video' ? `<video src="${esc(it.src)}#t=0.6" muted playsinline preload="metadata"></video>` : `<img src="${esc(it.src)}" alt="" draggable="false">`;
  const aspect = () => board.clientWidth / Math.max(1, board.clientHeight);

  function place(it, x, y, from) {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'pr' + (it.kind === 'video' ? ' vid' : '');
    el.innerHTML = thumb(it) + (it.kind === 'video' ? '<i class="vmark">▶</i>' : '') + (it.date ? `<span>${esc(it.date)}</span>` : '');
    el.style.left = x * 100 + '%'; el.style.top = y * 100 + '%';
    el.style.setProperty('--r', ((it.i * 37) % 13 - 6) + 'deg'); el.style.zIndex = ++zTop; // 新想起的在最上面
    prints.appendChild(el); shown.set(it.i, { el, x, y });
    if (from) { // 从聚焦处飞回来 / 从母照片旁边浮现
      el.animate([{ left: from.x * 100 + '%', top: from.y * 100 + '%', opacity: from.o ?? 0, transform: `translate(-50%,-50%) scale(${from.s || 0.6})`, filter: 'blur(6px)' },
        { left: x * 100 + '%', top: y * 100 + '%', opacity: 1, transform: 'translate(-50%,-50%) rotate(var(--r))', filter: 'none' }], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)' });
    } else el.animate([{ opacity: 0, filter: 'blur(8px)', transform: 'translate(-50%,-46%) rotate(var(--r)) scale(.92)' }, { opacity: 1, filter: 'none' }], { duration: 900, delay: it.i * 120, easing: 'ease-out', fill: 'backwards' });
    bind(el, it);
  }
  const links = []; // [a, b, path]：母照片和想起来的那张之间的线，拖动时跟着重画
  function drawLink([a, b, l]) {
    const p = shown.get(a), q = shown.get(b); if (!p || !q) return;
    const mx = (p.x + q.x) / 2 * 100, my = (p.y + q.y) / 2 * 100 - 6;
    l.setAttribute('d', `M${p.x * 100} ${p.y * 100} Q${mx} ${my} ${q.x * 100} ${q.y * 100}`);
  }
  function thread(a, b) {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'path'); l.setAttribute('pathLength', '1');
    threads.appendChild(l); const k = [a, b, l]; links.push(k); drawLink(k);
  }
  // 相纸在桌面上占多大（0–1 坐标）：宽 = CSS 里的 16%，高按 4:3.4 的比例换算
  const PW = 0.16, size = () => [PW, PW * aspect() * 3.4 / 4];
  // 找一块不挡别人的空地：先在母照片周围一圈圈找，找不到就在整张桌面上挑最空、离母照片最近的地方
  function spot(px, py) {
    const [pw, ph] = size(), ar = aspect();
    const lo = [pw / 2 + 0.015, ph / 2 + 0.03], hi = [1 - pw / 2 - 0.015, 1 - ph / 2 - 0.03];
    const sep = (x, y) => Math.min(9, ...[...shown.values()].map((s) => Math.max(Math.abs(x - s.x) / pw, Math.abs(y - s.y) / ph))); // ≥1.08 就不重叠
    const inside = (x, y) => x >= lo[0] && x <= hi[0] && y >= lo[1] && y <= hi[1];
    for (const r of [0.3, 0.42, 0.55]) for (let k = 0; k < 16; k++) {
      const ang = (k * 22.5 + (px * 97) % 22) * Math.PI / 180, x = px + Math.cos(ang) * r / ar, y = py + Math.sin(ang) * r;
      if (inside(x, y) && sep(x, y) >= 1.08) return [x, y];
    }
    let best = null, bv = -9;
    for (let gx = 0; gx <= 20; gx++) for (let gy = 0; gy <= 12; gy++) {
      const x = lo[0] + (hi[0] - lo[0]) * gx / 20, y = lo[1] + (hi[1] - lo[1]) * gy / 12;
      const v = Math.min(sep(x, y), 1.1) - Math.hypot((x - px) * ar, y - py) * 0.15;
      if (v > bv) { bv = v; best = [x, y]; }
    }
    return best;
  }
  // 和 it 最相关、还没出现在桌上的几张
  async function nextRelated(it, n) {
    const rest = items.filter((x) => !shown.has(x.i) && !pending.has(x.i));
    // 最多等 0.6 秒：新设备（比如手机扫码）没有分析缓存，每张要 AI 看二三十秒，全等完人早松手了。
    // 等不到的先按拍摄时间挑，分析在后台继续跑，下一次连锁就按内容挑
    await Promise.race([Promise.all([analyze(it), ...rest.map(analyze)]), sleep(600)]);
    return rest.map((x) => [x, related(it, x) + x.i * 1e-4]).sort((p, q) => q[1] - p[1]).slice(0, n).map((p) => p[0]);
  }
  const pending = new Set();
  async function chain(it, n = 2) { // 记忆连锁：看过一张，旁边浮现相关的
    const p = shown.get(it.i); if (!p) return;
    for (const x of await nextRelated(it, n)) {
      if (!alive || shown.has(x.i)) continue;
      const [sx, sy] = spot(p.x, p.y); place(x, sx, sy, { x: p.x, y: p.y, s: 0.4 }); thread(it.i, x.i); sfx.click();
      await sleep(420);
    }
  }

  // ---------- 聚焦：点一下 = 打开看；按住 = 越按越大，周围浮现越来越多 ----------
  let foc = null; // { it, hold, ring: [], timer }
  function openFocus(it, fromEl, hold) {
    foc = { it, hold, ring: [], timers: [], at: performance.now() };
    hint.classList.add('gone');
    fMedia.innerHTML = it.kind === 'video' ? `<video src="${esc(it.src)}" autoplay muted loop playsinline></video>` : `<img src="${esc(it.src)}" alt="">`;
    $('.pf-date', layer).textContent = it.date; $('.pf-cap', layer).textContent = it.cap || '';
    const sense = $('.pf-sense', layer), sound = $('.pf-sound', layer); sense.textContent = ''; sound.textContent = ''; sense.classList.remove('in'); sound.classList.remove('in');
    // 从小照片的位置长出来
    const br = board.getBoundingClientRect(), r = fromEl.getBoundingClientRect();
    focus.hidden = false; focus.className = 'pc-focus' + (hold ? ' hold' : '');
    focus.style.setProperty('--fx', ((r.left + r.width / 2 - br.left) / br.width * 100) + '%');
    focus.style.setProperty('--fy', ((r.top + r.height / 2 - br.top) / br.height * 100) + '%');
    focus.style.setProperty('--fs', (r.width / (br.width * 0.5)).toFixed(3));
    void focus.offsetWidth; focus.classList.add('on'); veil.classList.add('on'); fromEl.classList.add('lifted');
    // 感官描写和环境音：分析好了就浮现；AI 还在看的话先放一个「……」
    if (!it.a) { sense.textContent = staticHost ? '正在辨认这张照片……' : '……'; sense.classList.add('in', 'think'); }
    analyze(it).then((a) => {
      if (!foc || foc.it !== it) return;
      sense.classList.remove('think');
      if (!a) { sense.classList.remove('in'); return; }
      foc.timers.push(setTimeout(() => {
        if (a.sense) { sense.textContent = a.sense; sense.classList.add('in'); }
        const cap = $('.pf-cap', layer);
        if (cap && (!it.cap || /^(IMG|Screenshot|image)/i.test(it.cap))) cap.textContent = (a.tags || []).join(' · ');
        if (a.sound) { sound.textContent = '♪ ' + SOUNDS[a.sound]; sound.classList.add('in'); ambience.play(a.sound); }
      }, hold ? 700 : 450));
    });
    if (hold) grow(it);
  }
  async function grow(it) { // 按住时每 0.7 秒想起一张，排成一圈
    const list = await nextRelated(it, 6); const f = foc;
    list.forEach((x, k) => f.timers.push(setTimeout(() => {
      if (foc !== f) return;
      pending.add(x.i);
      // 排在放大那张的四周：中心落在它的边框外一点，只压住一小截边，不挡主体；正下方留给那句感官描写
      const ar = aspect(), B = board.clientHeight || 1;
      const fw = 0.34, fh = fw * ar * 0.75 + 32 / B, gw = 0.13, gh = gw * ar * 3.4 / 4; // 和 CSS 里 .pc-focus.hold / .pr.ghost 的宽度对应
      const ang = [-32, -148, 8, 172, -90, 38, 142][k] * Math.PI / 180;
      const gx = clamp01(0.5 + Math.cos(ang) * (fw / 2 + gw * 0.42), gw / 2, 1 - gw / 2);
      const gy = clamp01(0.40 + Math.sin(ang) * (fh / 2 + gh * 0.42), gh / 2, 1 - gh / 2);
      const g = document.createElement('div'); g.className = 'pr ghost' + (x.kind === 'video' ? ' vid' : '');
      g.innerHTML = thumb(x); g.style.left = gx * 100 + '%'; g.style.top = gy * 100 + '%';
      board.appendChild(g); f.ring.push({ x, g, gx, gy }); sfx.click();
    }, 500 + k * 700))); // 前面挑相关照片最多等了 0.6 秒，首张少等一点补回来
  }
  function closeFocus() {
    const f = foc; if (!f) return; foc = null;
    f.timers.forEach(clearTimeout); ambience.stop();
    focus.classList.remove('on'); veil.classList.remove('on');
    const p = shown.get(f.it.i); p && p.el.classList.remove('lifted');
    setTimeout(() => { if (!foc) { focus.hidden = true; fMedia.innerHTML = ''; } }, 420);
    // 按住时想起的那几张：从圈上落到桌面上，和母照片牵线；点开看的：看完再想起两张
    if (f.hold && f.ring.length) {
      f.ring.forEach(({ x, g, gx, gy }, k) => setTimeout(() => {
        g.remove(); pending.delete(x.i); if (shown.has(x.i) || !alive) return;
        const [sx, sy] = spot(p.x, p.y); place(x, sx, sy, { x: gx, y: gy, s: 1, o: 1 }); thread(f.it.i, x.i);
      }, 120 + k * 90));
    } else if (!f.hold) setTimeout(() => chain(f.it, 2), 500);
  }
  // 一张相纸：点一下 = 打开看；按住不动 = 聚焦；按住就拖 = 挪开（拖起来的放到最上面，线跟着走）
  let zTop = 10;
  function bind(el, it) {
    let down = null;
    el.addEventListener('pointerdown', (e) => {
      if (foc) return; e.preventDefault(); el.setPointerCapture(e.pointerId);
      down = { x: e.clientX, y: e.clientY, held: false, drag: false };
      down.timer = setTimeout(() => { down.held = true; openFocus(it, el, true); }, 320);
    });
    el.addEventListener('pointermove', (e) => {
      if (!down || down.held) return;
      if (!down.drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) {
        clearTimeout(down.timer); down.drag = true; el.classList.add('dragging'); el.style.zIndex = ++zTop; hint.classList.add('gone');
      }
      if (!down.drag) return;
      const br = board.getBoundingClientRect(), [pw, ph] = size(), s = shown.get(it.i);
      s.x = clamp01((e.clientX - br.left) / br.width, pw / 2, 1 - pw / 2); s.y = clamp01((e.clientY - br.top) / br.height, ph / 2, 1 - ph / 2);
      el.style.left = s.x * 100 + '%'; el.style.top = s.y * 100 + '%';
      links.forEach((k) => { if (k[0] === it.i || k[1] === it.i) drawLink(k); });
    });
    const up = () => {
      if (!down) return; clearTimeout(down.timer);
      if (down.drag) el.classList.remove('dragging');
      else if (down.held) closeFocus(); else openFocus(it, el, false);
      down = null;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', () => { if (down) { clearTimeout(down.timer); if (down.held) closeFocus(); el.classList.remove('dragging'); down = null; } });
  }
  // 点开看时：点任意处收起
  const tapClose = () => { if (foc && !foc.hold && performance.now() - foc.at > 300) { sfx.click(); closeFocus(); } }; // 刚打开那一下的 click 不算
  focus.addEventListener('click', tapClose);
  veil.addEventListener('click', tapClose);

  layer.addEventListener('click', (e) => { if (e.target.closest('[data-close], .dv-back')) close(); });
  // 手机长按照片时，浏览器会弹「保存图片」菜单或开始拖图片，把触摸抢走：都拦掉
  layer.addEventListener('contextmenu', (e) => e.preventDefault());
  layer.addEventListener('dragstart', (e) => e.preventDefault());
  const onKey = (e) => { if (e.key === 'Escape') { foc ? closeFocus() : close(); } };
  window.addEventListener('keydown', onKey);

  async function close() {
    if (!alive) return; alive = false;
    window.removeEventListener('keydown', onKey); ambience.stop();
    layer.querySelectorAll('video').forEach((v) => v.pause());
    layer.classList.add('power-off');
    await sleep(380);
    await closeLayer(layer);
    onClose && onClose();
  }

  // 开机：一道亮线 → 桌面亮起 → 只有几张照片慢慢浮出来；其余的在后台先分析着
  (async () => {
    await sleep(80); sfx.crtOn(); layer.classList.add('power');
    await sleep(760); if (!alive) return; layer.classList.add('desk', 'win');
    const first = items.length <= 3 ? items : [items[0], items[Math.floor(items.length / 2)], items[items.length - 1]];
    const slots = [[0.27, 0.42], [0.52, 0.6], [0.76, 0.38]];
    first.forEach((it, k) => place(it, ...slots[k]));
    items.forEach((it) => analyze(it));
  })();
  return { close };
}

/* ================================================================ 手机 · QQ */

// 那一晚的记录（原「那台电脑」里的 QQ 片段，移到手机上）
const CHAT = [
  { t: '21:47', side: 'them', text: '你睡了吗' },
  { side: 'me', text: '没' },
  { t: '21:49', side: 'them', text: '我给你看个东西' },
  { side: 'them', kind: 'img' },
  { t: '21:52', side: 'me', text: '什么啊，黑乎乎的' },
  { t: '21:53', side: 'them', text: '月亮。我趴在窗台上拍的' },
  { side: 'them', text: '拍不清楚，你就当它是' },
];

function moonPhoto() {
  const c = document.createElement('canvas'); c.width = 320; c.height = 240;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, 240); bg.addColorStop(0, '#0b0f1c'); bg.addColorStop(1, '#151a26'); g.fillStyle = bg; g.fillRect(0, 0, 320, 240);
  g.filter = 'blur(6px)'; const m = g.createRadialGradient(205, 82, 2, 205, 82, 34); m.addColorStop(0, 'rgba(255,248,225,.95)'); m.addColorStop(0.45, 'rgba(255,236,190,.55)'); m.addColorStop(1, 'rgba(255,236,190,0)'); g.fillStyle = m; g.fillRect(150, 30, 120, 110);
  g.filter = 'none'; g.fillStyle = 'rgba(20,22,30,.9)'; g.fillRect(0, 196, 320, 44); // 窗台
  const img = g.getImageData(0, 0, 320, 240); for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 26; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; } g.putImageData(img, 0, 0);
  return c.toDataURL('image/jpeg', 0.7);
}

export function openQQ({ person = '阿哲', twin = null, store, onClose } = {}) {
  const moon = moonPhoto();
  // 有数字分身：旧聊天放完后，那句「正在输入」会真的说出来，之后能接着聊（每句标来源等级）
  const T = twin && window.JRLXTwin;
  const chat = T ? T.createChat(twin) : null;
  const script = !T || twin.source === 'preset' ? CHAT
    : (twin.history || []).filter((m) => m.text).slice(-8).map((m) => ({ side: m.side === 'me' ? 'me' : 'them', text: m.text }));
  let awake = false;
  const initial = person.replace(/^给\s*/, '').slice(-1) || '他';
  const layer = makeLayer('qq', `
    <div class="qq-phone">
      <div class="qq-ear"></div><div class="qq-cam"></div>
      <div class="qq-screen">
        <div class="qq-status"><span>中国移动 3G</span><span class="qq-time">21:47</span><span class="qq-bat"><i></i></span></div>
        <div class="qq-nav">
          <button type="button" class="qq-navback" data-close>消息</button>
          <div class="qq-who"><b>${esc(person)}</b><small class="qq-sub">[3G] 手机在线</small></div>
          <span class="qq-navr" aria-hidden="true"></span>
        </div>
        <div class="qq-list" role="log" aria-live="polite"></div>
        <form class="qq-input"><span class="qq-emo" aria-hidden="true">☺</span><input type="text" maxlength="60" placeholder="想回一句什么…" /><button type="submit" class="qq-send">发送</button></form>
        <div class="qq-lightbox" hidden><img alt="月亮"><p>月亮。我趴在窗台上拍的</p></div>
      </div>
      <div class="qq-home" aria-hidden="true"><i></i></div>
    </div>`);

  const list = $('.qq-list', layer), sub = $('.qq-sub', layer), lb = $('.qq-lightbox', layer);
  let alive = true;
  const scrollEnd = () => list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  const av = (side) => `<span class="qq-av ${side}">${side === 'me' ? '我' : esc(initial)}</span>`;

  function addTime(t) { const d = document.createElement('p'); d.className = 'qq-t'; d.textContent = t; list.appendChild(d); }
  function bubble(side, html, extra = '') {
    const row = document.createElement('div'); row.className = `qq-row ${side} ${extra}`;
    row.innerHTML = `${av(side)}<div class="qq-b">${html}</div>`;
    list.appendChild(row); scrollEnd(); return row;
  }
  // 中文按 2–4 个字一段淡入（每段从透明、轻微模糊变清楚）
  async function streamText(el, text) {
    const parts = text.match(/.{1,3}/gu) || [text];
    el.innerHTML = parts.map((p) => `<span class="qq-chunk">${esc(p)}</span>`).join('');
    for (const s of el.querySelectorAll('.qq-chunk')) { if (!alive) return; await sleep(70); s.classList.add('in'); }
  }
  async function typing(ms) {
    sub.textContent = '对方正在输入…';
    const row = bubble('them', '<span class="qq-dots"><i></i><i></i><i></i></span>', 'is-typing');
    await sleep(ms);
    row.remove(); sub.textContent = awake ? '数字分身 · 照聊天记录拼的' : '[3G] 手机在线';
  }

  (async () => {
    await sleep(520);
    for (const m of script) {
      if (!alive) return;
      if (m.t) addTime(m.t);
      if (m.side === 'them') {
        await typing(m.kind === 'img' ? 1300 : 700 + (m.text || '').length * 70);
        if (!alive) return;
        sfx.msgIn();
        if (m.kind === 'img') { const r = bubble('them', `<img class="qq-img" src="${moon}" alt="[图片]">`, 'is-img'); r.querySelector('img').addEventListener('click', () => { lb.hidden = false; lb.querySelector('img').src = moon; }); }
        else { const r = bubble('them', ''); await streamText(r.querySelector('.qq-b'), m.text); }
      } else {
        await sleep(650); if (!alive) return; sfx.msgOut();
        bubble('me', esc(m.text));
      }
      await sleep(480);
    }
    // 最后一句：开始输入，然后停住
    if (!alive) return;
    if (chat) return wakeTwin();
    sub.textContent = '对方正在输入…';
    const row = bubble('them', '<span class="qq-dots"><i></i><i></i><i></i></span>', 'is-typing');
    await sleep(3200); if (!alive) return;
    row.classList.add('fade'); sub.textContent = '[3G] 手机在线';
    await sleep(500); row.remove();
    const end = document.createElement('p'); end.className = 'qq-sys'; end.innerHTML = '后面还有一句。记录到这里断了。<br><span>这段记录只有你这一侧，TA 那边说过什么、删过什么，没有留下来。</span>';
    list.appendChild(end); scrollEnd();
  })();

  // ---------- 数字分身 ----------
  const LV = (T && T.LEVEL) || {};
  async function twinSay(items) {
    for (const it of items) {
      if (!alive) return;
      if (it.level === 'sys') { const p = document.createElement('p'); p.className = 'qq-sys'; p.textContent = it.text; list.appendChild(p); scrollEnd(); continue; }
      await typing(500 + it.text.length * 90);
      if (!alive) return;
      sfx.msgIn();
      const r = bubble('them', '', `lv-${it.level}`);
      const tag = document.createElement('span'); tag.className = `qq-lv lv-${it.level}`; tag.textContent = `${it.level} · ${LV[it.level] || ''}`;
      r.querySelector('.qq-b').after(tag);
      await streamText(r.querySelector('.qq-b'), it.text);
      await sleep(260);
    }
  }
  async function wakeTwin() {
    const row = bubble('them', '<span class="qq-dots"><i></i><i></i><i></i></span>', 'is-typing');
    await sleep(2400); if (!alive) return;
    row.remove();
    const p = document.createElement('p'); p.className = 'qq-sys';
    p.innerHTML = `记录到这里断了。<br><span>下面是照着你们的聊天记录拼出来的 ${esc(twin.name)}，不是 TA 本人。每句话都标了来源。</span>`;
    list.appendChild(p); scrollEnd();
    await sleep(1200); if (!alive) return;
    await twinSay([twin.opening]);
    awake = true;
    sub.textContent = '数字分身 · 照聊天记录拼的';
    const inp = $('.qq-input input', layer); inp.placeholder = `和 ${twin.name} 说点什么…`; inp.focus({ preventScroll: true });
  }

  // 回一句：没有分身时发不出去，但会留下；有分身时 TA 会回
  $('.qq-input', layer).addEventListener('submit', async (e) => {
    e.preventDefault();
    const inp = e.target.querySelector('input'); const text = inp.value.trim(); if (!text) return;
    if (chat) {
      if (!awake) return;
      inp.value = ''; sfx.msgOut(); bubble('me', esc(text));
      const items = await chat.reply(text);
      await twinSay(items);
      return;
    }
    inp.value = '';
    sfx.msgOut();
    const r = bubble('me', esc(text), 'is-fail');
    setTimeout(() => { sfx.fail(); r.classList.add('failed'); }, 700);
    setTimeout(() => { const p = document.createElement('p'); p.className = 'qq-sys'; p.textContent = '这句话发不出去了。但它留在这儿了。'; list.appendChild(p); scrollEnd(); }, 1500);
    if (store) { const l = store.data.notes.phone || []; l.push({ at: new Date().toISOString(), text }); store.data.notes.phone = l; store.save(); }
  });
  // 以前回过的话也在（分身模式不提这个）
  const old = !chat && store && (store.data.notes.phone || []).slice(-3);

  lb.addEventListener('click', () => { lb.hidden = true; });
  layer.addEventListener('click', (e) => { if (e.target.closest('[data-close], .dv-back')) close(); });
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  window.addEventListener('keydown', onKey);
  // 手机尺寸跟着窗口缩放
  // 手机始终竖着；外层 Demo 会在打开手机时把屏幕转成竖屏，这里尽量占满
  const fit = () => { const k = Math.min((innerHeight * 0.96) / 716, (innerWidth * 0.96) / 364, 1.25); layer.style.setProperty('--k', k); };
  fit(); window.addEventListener('resize', fit);

  async function close() {
    if (!alive) return; alive = false;
    window.removeEventListener('keydown', onKey); window.removeEventListener('resize', fit);
    await closeLayer(layer);
    onClose && onClose();
  }
  if (old && old.length) setTimeout(() => { if (!alive) return; const p = document.createElement('p'); p.className = 'qq-sys'; p.textContent = `上次你回了：「${old[old.length - 1].text}」——没有发出去。`; list.prepend(p); }, 200);
  return { close };
}
