/* 旧日来信 · 数字分身（总入口和房间共用，只由总负责人维护）
   用法：<script src="…/shared/twin.js"></script>，然后用全局 JRLXTwin。

   定位（对齐 AI_CONTEXT.md §4.3 / §4.4「人格模拟」档）：
   · 每条回复都标来源等级：A 聊天记录里的原话 · C 照语气推测 · D 模型生成
   · 不说「我还活着」，不谈现实里的重大决定；被认真问到时承认自己是拼出来的
   · 有 AI（本地服务 /__ai 配了 key）就真识别录屏、真生成人设和回复；没有就用示例人设 + 本地规则 */
(() => {
  'use strict';

  const LEVEL = { A: '原话', B: '你补充的', C: '照语气推测', D: '生成的' };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const norm = s => String(s || '').replace(/[\s，。,.!！?？~～…、]/g, '');

  /* ================= 示例：虚构人物「阿哲」 =================
     示例录屏 assets/twin/sample_chat.mp4 就是用这段 history 生成的；房间手机里的旧聊天也是最后一段。 */
  const SAMPLE_HISTORY = [
    { date: '2009年6月12日 16:20' },
    { side: 'them', text: '明天物理考试你复习了木有' },
    { side: 'me', text: '没有。。' },
    { side: 'them', text: '我也木有 = =' },
    { side: 'them', text: '那就一起挂' },
    { side: 'me', text: '呸' },
    { side: 'them', text: '嘿嘿' },
    { date: '2009年6月20日 22:05' },
    { side: 'them', text: '帮我偷下菜' },
    { side: 'them', text: '我妈不让我开电脑' },
    { side: 'me', text: '你自己不会用手机？' },
    { side: 'them', text: '手机流量要钱的好吧' },
    { side: 'me', text: '好吧 偷了' },
    { side: 'them', text: '够意思' },
    { side: 'them', text: '下次请你喝冰红茶' },
    { date: '2009年7月2日 13:40' },
    { side: 'me', text: '你中午干嘛' },
    { side: 'them', text: '打球' },
    { side: 'them', text: '太阳大得要死' },
    { side: 'me', text: '那你还去' },
    { side: 'them', text: '不去会被说是怂' },
    { side: 'me', text: '谁说你' },
    { side: 'them', text: '我自己说我自己' },
    { side: 'me', text: '囧' },
    { date: '2009年7月9日 23:58' },
    { side: 'them', text: '你睡了没' },
    { side: 'me', text: '快了' },
    { side: 'them', text: '我听到一首歌' },
    { side: 'them', text: '周杰伦的 稻香' },
    { side: 'me', text: '早就听过了好吧' },
    { side: 'them', text: '哦。' },
    { side: 'them', text: '那你还挺快的' },
    { side: 'me', text: '你怎么还不睡' },
    { side: 'them', text: '不困' },
    { side: 'them', text: '睡了也是瞎想' },
    { side: 'me', text: '想什么' },
    { side: 'them', text: '没什么' },
    { side: 'them', text: '睡了' },
    { date: '2009年7月15日 19:12' },
    { side: 'me', text: '你家是不是要搬了' },
    { side: 'them', text: '谁说的' },
    { side: 'me', text: '你妈跟我妈说的' },
    { side: 'them', text: '= =' },
    { side: 'them', text: '还没定' },
    { side: 'them', text: '定了跟你说' },
    { side: 'me', text: '哦' },
    { side: 'them', text: '别跟班里人说啊' },
    { date: '2009年7月22日 21:47' },
    { side: 'them', text: '你睡了吗' },
    { side: 'me', text: '没' },
    { side: 'them', text: '我给你看个东西' },
    { side: 'them', text: '[图片]' },
    { side: 'me', text: '什么啊，黑乎乎的' },
    { side: 'them', text: '月亮。我趴在窗台上拍的' },
    { side: 'them', text: '拍不清楚，你就当它是' },
  ];

  const PRESET = {
    source: 'preset',
    name: '阿哲',
    relation: '初中同桌',
    era: '2009 年夏天',
    summary: '话少，嘴硬，关心人从来不直说',
    traits: ['话少', '嘴硬心软', '爱发 = =', '熬夜不睡', '中午也去打球'],
    style: { maxLen: 12, notes: '几乎不用句号，一句话拆成好几条发；常用「= =」「嘿嘿」「木有」；不正面回答，岔开话题' },
    // A 级：全部是聊天记录里出现过的原话，按话题分组
    corpus: {
      greet: ['你睡了没', '你睡了吗', '我给你看个东西'],
      study: ['我也木有 = =', '那就一起挂'],
      help: ['够意思', '下次请你喝冰红茶', '帮我偷下菜'],
      sport: ['打球', '太阳大得要死', '不去会被说是怂', '我自己说我自己'],
      music: ['我听到一首歌', '周杰伦的 稻香', '那你还挺快的'],
      night: ['不困', '睡了也是瞎想', '没什么', '睡了'],
      move: ['谁说的', '还没定', '定了跟你说', '别跟班里人说啊'],
      moon: ['月亮。我趴在窗台上拍的', '拍不清楚，你就当它是'],
      shrug: ['= =', '嘿嘿', '哦。'],
    },
    keywords: {
      greet: ['在吗', '在不在', '你好', '嗨', 'hi', '喂'],
      study: ['考试', '作业', '复习', '学习', '成绩', '老师', '物理', '挂科'],
      help: ['帮', '偷菜', '农场', '谢谢', '请你', '冰红茶'],
      sport: ['打球', '篮球', '球', '太阳', '热', '运动'],
      music: ['歌', '周杰伦', '稻香', '听', '音乐'],
      night: ['睡', '困', '晚安', '熬夜', '想什么', '失眠'],
      move: ['搬', '走了', '离开', '转学', '去哪', '后来'],
      moon: ['月亮', '窗台', '照片', '拍', '看什么'],
    },
    // C 级：照他的语气推测的话，记录里没有原句
    fallback: ['额', '不知道 = =', '你说呢', '那算了', '嘿嘿 没什么', '哦', '你又在想有的没的'],
    opening: { text: '就当它是我们一起看的', level: 'D' },
    history: SAMPLE_HISTORY,
  };

  /* ================= 本地 AI 服务（_serve.py 的 /__ai，key 只在电脑本地） ================= */
  let statusP = null;
  function aiStatus() {
    let hostStore = null;
    try { hostStore = window.JRLXStore || (window.parent !== window && window.parent.JRLXStore); } catch (e) {}
    if (hostStore && hostStore.static) return Promise.resolve({ enabled: false, vision: false, chat: false, localVision: true });
    if (!statusP) statusP = fetch('/__ai/status', { cache: 'no-store' }).then(r => r.ok ? r.json() : { enabled: false }).catch(() => ({ enabled: false }));
    return statusP;
  }
  async function aiCall(kind, messages, { temperature = 0.7, max_tokens = 800, json = false, timeout = 60000 } = {}) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch('/__ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
        body: JSON.stringify({ kind, messages, temperature, max_tokens, json }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) throw new Error(d.error || ('HTTP ' + r.status));
      return String(d.content || '');
    } finally { clearTimeout(t); }
  }
  function parseJSON(s) {
    const m = String(s).replace(/```(?:json)?/g, '').match(/[\[{][\s\S]*[\]}]/);
    return m ? JSON.parse(m[0]) : null;
  }

  /* ================= 录屏 → 关键帧（浏览器里真的抽帧） ================= */
  // 每 0.5 秒取一帧，和上一张保留的帧差别够大（滚动了）或隔了 3 秒就留下，最多 max 张
  async function extractFrames(file, { max = 12, width = 540, onFrame } = {}) {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      const c = toCanvas(img, img.naturalWidth, img.naturalHeight, width);
      const f = { dataUrl: c.toDataURL('image/jpeg', 0.75), t: 0 };
      onFrame && onFrame(f); URL.revokeObjectURL(url); return [f];
    }
    const url = URL.createObjectURL(file);
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    await new Promise((ok, no) => { v.onloadeddata = ok; v.onerror = () => no(new Error('这个视频读不了，换成 mp4 试试')); });
    const dur = v.duration || 0, step = 0.5, frames = [];
    const probe = document.createElement('canvas'); probe.width = 24; probe.height = 48; const pg = probe.getContext('2d', { willReadFrequently: true });
    let last = null, lastT = -99;
    for (let t = 0.2; t < dur && frames.length < max * 3; t += step) {
      v.currentTime = t; await new Promise(r => { v.onseeked = r; });
      pg.drawImage(v, 0, 0, 24, 48);
      const px = pg.getImageData(0, 0, 24, 48).data, sig = new Float32Array(24 * 48);
      for (let i = 0; i < sig.length; i++) sig[i] = (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3;
      let diff = last ? 0 : 999; if (last) { for (let i = 0; i < sig.length; i++) diff += Math.abs(sig[i] - last[i]); diff /= sig.length; }
      if (diff > 6 || t - lastT >= 3) {
        const f = { dataUrl: toCanvas(v, v.videoWidth, v.videoHeight, width).toDataURL('image/jpeg', 0.75), t };
        frames.push(f); last = sig; lastT = t; onFrame && onFrame(f);
      }
    }
    URL.revokeObjectURL(url);
    // 太多就均匀挑 max 张
    if (frames.length <= max) return frames;
    return Array.from({ length: max }, (_, i) => frames[Math.round(i * (frames.length - 1) / (max - 1))]);
  }
  function toCanvas(src, w, h, width) {
    const k = Math.min(1, width / w), c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c;
  }

  /* ================= 关键帧 → 聊天文字（视觉模型，一张一张认，再按重叠拼起来） ================= */
  const VISION_PROMPT = '这是一张手机聊天软件的截图。按从上到下的顺序，逐条抄出聊天气泡里的文字。' +
    '左边的气泡是对方（side 写 them），右边的是我（side 写 me）。忽略时间、日期、系统提示、输入框和顶部标题栏。' +
    '图片消息写 [图片]，表情写 [表情]。只看得到一半的气泡也照抄。' +
    '只输出 JSON：{"messages":[{"side":"them","text":"…"}]}';
  async function recognize(frames, { onMessages, concurrency = 2 } = {}) {
    const results = new Array(frames.length); let next = 0, merged = [];
    const flush = () => {
      merged = [];
      for (const r of results) { if (!r) break; merged = mergeOverlap(merged, r); }
      onMessages && onMessages(merged);
    };
    async function worker() {
      while (next < frames.length) {
        const i = next++;
        try {
          const out = await aiCall('vision', [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: frames[i].dataUrl } }, { type: 'text', text: VISION_PROMPT }] }],
          { temperature: 0.1, max_tokens: 1200, json: true });
          let d = null; try { d = parseJSON(out); } catch (e) { d = { messages: scrapeMessages(out) }; } // 模型偶尔吐出坏 JSON，就逐条抠
          results[i] = cleanMessages(d && d.messages);
        } catch (e) { results[i] = []; console.warn('[twin] 第 ' + (i + 1) + ' 帧识别失败', e); }
        flush();
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, frames.length) }, worker));
    flush(); return merged;
  }
  function scrapeMessages(s) {
    const out = [], re = /"side"\s*:\s*"(them|me)"\s*,\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    let m; while ((m = re.exec(String(s)))) out.push({ side: m[1], text: m[2].replace(/\\(.)/g, '$1') });
    return out;
  }
  function cleanMessages(list) {
    return (Array.isArray(list) ? list : []).map(m => ({ side: m && m.side === 'me' ? 'me' : 'them', text: String((m && m.text) || '').trim() }))
      .filter(m => m.text && m.text.length <= 200);
  }
  // 相邻两帧滚动后会重复一截：找 a 的结尾和 b 的开头最长的重合，拼接
  function mergeOverlap(a, b) {
    const key = m => m.side + '|' + norm(m.text);
    for (let k = Math.min(a.length, b.length); k > 0; k--) {
      let ok = true;
      for (let j = 0; j < k; j++) if (key(a[a.length - k + j]) !== key(b[j])) { ok = false; break; }
      if (ok) return a.concat(b.slice(k));
    }
    return a.concat(b);
  }

  /* ================= 聊天文字 → 人设（文本模型；原话库只收记录里真有的句子） ================= */
  async function buildPersona(messages, { name = 'TA', relation = '' } = {}) {
    const lines = messages.map(m => (m.side === 'me' ? '我：' : 'TA：') + m.text).join('\n');
    const sys = '你在帮一个记忆陪伴 App 分析一段真实的聊天记录，提炼「TA」的说话方式。只输出 JSON，不要解释。';
    const user = `TA 的名字：${name}${relation ? '，是我的' + relation : ''}\n聊天记录（TA 是对方，我是用户）：\n${lines}\n\n` +
      '输出 JSON，字段：\n' +
      '{"summary":"一句话说 TA 是个什么样的人（20 字内）",' +
      '"traits":["3-5 个短标签，每个不超过 6 个字"],' +
      '"style":{"maxLen":TA 平均一条消息的字数上限（整数）,"notes":"TA 打字习惯：标点、语气词、表情、是否拆成多条发"},' +
      '"corpus":{"话题英文名":["TA 的原话，必须一字不差从记录里抄"]},' +
      '"keywords":{"同一个话题英文名":["用户说到哪些词时会聊到这个话题"]},' +
      '"fallback":["5 句 TA 可能会说、但记录里没有的短回复，模仿 TA 的语气"],' +
      '"opening":"TA 看到我回来之后，最可能先说的一句话（短，像 TA）"}';
    const out = await aiCall('chat', [{ role: 'system', content: sys }, { role: 'user', content: user }], { temperature: 0.4, max_tokens: 1500, json: true });
    const d = parseJSON(out) || {};
    return sanitizePersona(d, messages, { name, relation });
  }
  function sanitizePersona(d, messages, { name, relation }) {
    const said = new Set(messages.filter(m => m.side === 'them').map(m => norm(m.text)));
    const corpus = {};
    Object.entries(d.corpus || {}).forEach(([k, arr]) => {
      const ok = (Array.isArray(arr) ? arr : []).map(String).filter(s => said.has(norm(s))); // 不是原话的一律不收进 A 级
      if (ok.length) corpus[k] = ok;
    });
    if (!Object.keys(corpus).length) corpus.all = messages.filter(m => m.side === 'them' && m.text !== '[图片]' && m.text !== '[表情]').map(m => m.text).slice(0, 40);
    const keywords = {}; Object.entries(d.keywords || {}).forEach(([k, arr]) => { if (corpus[k] && Array.isArray(arr)) keywords[k] = arr.map(String).filter(Boolean).slice(0, 12); });
    const maxLen = Math.max(4, Math.min(30, parseInt(d.style && d.style.maxLen, 10) || 14));
    return {
      source: 'ai', name, relation, era: '',
      summary: String(d.summary || '').slice(0, 40),
      traits: (Array.isArray(d.traits) ? d.traits : []).map(String).filter(Boolean).slice(0, 5),
      style: { maxLen, notes: String((d.style && d.style.notes) || '').slice(0, 120) },
      corpus, keywords,
      fallback: (Array.isArray(d.fallback) ? d.fallback : []).map(String).filter(Boolean).slice(0, 8),
      opening: { text: String(d.opening || '我在').slice(0, 40), level: said.has(norm(d.opening)) ? 'A' : 'D' },
      history: messages.slice(-40),
    };
  }

  /* ================= 回话 ================= */
  const CRISIS = /(不想活|想死|自杀|活着没意思|结束生命|轻生)/;
  const IDENTITY = /(你是真的|是你本人|你是谁|你是ai|你是AI|你是机器|你还活着|是不是真的你)/i;
  function createChat(persona) {
    const used = new Set();
    const aLines = Object.values(persona.corpus || {}).flat().map(norm);
    const allA = { has: s => aLines.includes(s) || (s.length >= 4 && aLines.some(l => l.includes(s))) }; // 原话里截出来的片段也算 A
    const pick = (arr, n = 1) => {
      const fresh = arr.filter(s => !used.has(s)), pool = fresh.length ? fresh : arr;
      const i = Math.floor(Math.random() * pool.length), out = pool.slice(i, i + n);
      out.forEach(s => used.add(s)); return out;
    };
    function special(text) {
      if (CRISIS.test(text)) return [{ text: '如果你现在很难受，先找身边信得过的人说说话；也可以打 12356 心理援助热线。', level: 'sys' }];
      if (IDENTITY.test(text)) return [{ text: `我是照着你们的聊天记录拼出来的，不是${persona.name}本人`, level: 'D' }, { text: '记录里的话我都记着', level: 'D' }];
      return null;
    }
    function local(text) {
      const s = special(text); if (s) return s;
      const t = text.toLowerCase();
      for (const [scene, kws] of Object.entries(persona.keywords || {})) {
        if (persona.corpus[scene] && kws.some(k => t.includes(String(k).toLowerCase()))) {
          return pick(persona.corpus[scene], Math.random() < 0.45 ? 2 : 1).map(x => ({ text: x, level: 'A' }));
        }
      }
      if (persona.corpus.shrug && Math.random() < 0.3) return pick(persona.corpus.shrug).map(x => ({ text: x, level: 'A' }));
      const fb = persona.fallback && persona.fallback.length ? persona.fallback : ['嗯'];
      return pick(fb).map(x => ({ text: x, level: 'C' }));
    }
    function systemPrompt() {
      const c = Object.entries(persona.corpus || {}).map(([k, v]) => `【${k}】${v.join(' / ')}`).join('\n');
      const h = (persona.history || []).filter(m => m.text).slice(-24).map(m => (m.side === 'me' ? '我：' : persona.name + '：') + m.text).join('\n');
      return `你在一个记忆陪伴 App 里，扮演用户记忆中的${persona.name}${persona.relation ? '（用户的' + persona.relation + '）' : ''}${persona.era ? '，时间停在' + persona.era : ''}。\n` +
        `TA 是这样的人：${persona.summary}；${(persona.traits || []).join('、')}。\n打字习惯：${persona.style.notes}\n\n` +
        `TA 说过的原话（能用原话就用原话，一字不改）：\n${c}\n\n最近的聊天：\n${h}\n\n` +
        `规则：\n1. 每次回 1 到 2 条短消息，每条不超过 ${persona.style.maxLen} 个字，一条一行，不要编号、不要引号。\n` +
        '2. 像 TA 一样随便、没逻辑也没关系，不讲道理、不安慰人、不说 AI 腔的漂亮话。\n' +
        '3. 记录里没有的具体事情不要编，用「不记得了」「你说呢」这类话带过。\n' +
        '4. 不谈现实里的重大决定（钱、工作、医疗、法律、感情选择）；不说自己还活着、会回来。\n' +
        `5. 如果用户认真问你是不是真的${persona.name}，就用 TA 的口气承认：自己是照着聊天记录拼出来的。`;
    }
    const log = [];
    return {
      persona,
      async reply(text) {
        log.push({ role: 'user', content: text });
        const s = special(text); if (s) { log.push({ role: 'assistant', content: s.map(x => x.text).join('\n') }); return s; }
        const st = await aiStatus();
        if (st.chat) {
          try {
            const out = await aiCall('chat', [{ role: 'system', content: systemPrompt() }, ...log.slice(-12)], { temperature: 0.9, max_tokens: 120, timeout: 20000 });
            const lines = out.split(/\n+/).map(x => x.replace(/^[\d.、\-\s"“”「」]+|["“”「」]+$/g, '').trim()).filter(Boolean).slice(0, 2);
            if (lines.length) {
              log.push({ role: 'assistant', content: lines.join('\n') });
              return lines.map(x => ({ text: x, level: allA.has(norm(x)) ? 'A' : 'D' }));
            }
          } catch (e) { console.warn('[twin] AI 回复失败，改用本地规则', e); }
        }
        const r = local(text); log.push({ role: 'assistant', content: r.map(x => x.text).join('\n') }); return r;
      },
    };
  }

  window.JRLXTwin = { LEVEL, PRESET, SAMPLE_URL: 'assets/twin/sample_chat.mp4', aiStatus, extractFrames, recognize, buildPersona, createChat, sleep };
})();
