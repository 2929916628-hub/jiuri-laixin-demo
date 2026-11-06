/* 旧日来信 · 拍片模式（答辩短片《晚了十五年》录屏用，平时不生效）
   开启：地址加 ?film=1（会记进 localStorage，房间 iframe 同源也能读到）；关闭：?film=0
   · 示例人设换成高中好友「阿哲」（2011 年夏，林川偷偷改了志愿）
   · 构建分身时不真识别录屏，直接用这段剧本里的聊天（画面流程不变）
   · 房间手机里前几轮是真 AI 回话；问到「你还怪我吗」时返回固定的三句
   放在 shared/twin.js 之后加载。 */
(() => {
  'use strict';
  try {
    const q = new URLSearchParams(location.search).get('film');
    if (q === '1') localStorage.setItem('jrlx.film', '1');
    if (q === '0') localStorage.removeItem('jrlx.film');
    if (localStorage.getItem('jrlx.film') !== '1') return;
  } catch (e) { return; }
  const T = window.JRLXTwin; if (!T) return;
  document.documentElement.classList.add('film');
  // 录屏画面：去掉左侧说明栏，只留居中的手机
  const css = document.createElement('style');
  const bg = new URL('film_bg.jpg', document.currentScript.src).href; // 涂鸦格子信纸
  css.textContent = `.film .guide{display:none!important}.film .stage{gap:0;background:url("${bg}") center/cover #f3ece0}`;
  document.head.appendChild(css);
  // 片子的故事在 2011 年：界面上「2009 · 那个夏天」都换成 2011
  const fixYear = root => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) if (n.nodeValue.includes('2009 · 那个夏天')) n.nodeValue = n.nodeValue.replace('2009 · 那个夏天', '2011 · 那个夏天');
  };
  const watch = () => { fixYear(document.body); new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.nodeType === 1 ? fixYear(n) : n.nodeType === 3 && fixYear(n.parentNode || document.body)))).observe(document.body, { childList: true, subtree: true, characterData: true }); };
  document.body ? watch() : document.addEventListener('DOMContentLoaded', watch);

  const HISTORY = [
    { date: '2010年11月3日 21:15' },
    { side: 'them', text: '明天数学小测' },
    { side: 'them', text: '你抄我的还是我抄你的' },
    { side: 'me', text: '你那叫抄？你那叫猜' },
    { side: 'them', text: '猜也是一种能力好吧' },
    { side: 'them', text: '嘿嘿' },
    { date: '2011年3月12日 17:40' },
    { side: 'them', text: '篮球场 速度' },
    { side: 'them', text: '三班的又来占场了' },
    { side: 'me', text: '来了来了' },
    { side: 'them', text: '带两瓶水' },
    { side: 'them', text: '冰的！' },
    { date: '2011年5月20日 23:02' },
    { side: 'them', text: '睡了没' },
    { side: 'me', text: '没' },
    { side: 'them', text: '你说我们去了广州 住一起不' },
    { side: 'me', text: '宿舍又不能选' },
    { side: 'them', text: '那就住隔壁' },
    { side: 'them', text: '说好了啊 一起去广州' },
    { side: 'me', text: '嗯' },
    { date: '2011年6月24日 22:30' },
    { side: 'them', text: '志愿填了没' },
    { side: 'them', text: '我填完了 中大' },
    { side: 'them', text: '你呢' },
    { side: 'me', text: '还没想好' },
    { side: 'them', text: '还想啥 不是说好了吗' },
    { date: '2011年7月21日 23:47' },
    { side: 'them', text: '你改志愿了？' },
    { side: 'them', text: '……' },
    { side: 'them', text: '没事。你去吧。' },
  ];

  Object.assign(T.PRESET, {
    source: 'film',
    name: '阿哲',
    relation: '高中最好的朋友',
    era: '2011 年夏天',
    summary: '爱笑，嘴上不饶人，答应过的事都当真',
    traits: ['爱笑', '嘴贫', '篮球场常驻', '说好了就当真', '不说重话'],
    style: { maxLen: 12, notes: '几乎不用句号，一句话拆成好几条发；常用「嘿嘿」「速度」「好吧」；真生气时反而很客气、用句号' },
    corpus: {
      study: ['明天数学小测', '你抄我的还是我抄你的', '猜也是一种能力好吧'],
      sport: ['篮球场 速度', '三班的又来占场了', '带两瓶水', '冰的！'],
      night: ['睡了没'],
      city: ['你说我们去了广州 住一起不', '那就住隔壁', '说好了啊 一起去广州'],
      wish: ['志愿填了没', '我填完了 中大', '你呢', '还想啥 不是说好了吗'],
      end: ['你改志愿了？', '没事。你去吧。'],
      shrug: ['嘿嘿', '……'],
    },
    keywords: {
      study: ['考试', '小测', '数学', '作业', '抄', '老师', '成绩'],
      sport: ['打球', '篮球', '球场', '三班', '水', '热'],
      night: ['睡', '晚安', '熬夜', '困'],
      city: ['广州', '一起', '宿舍', '隔壁', '住'],
      wish: ['志愿', '中大', '高考', '大学', '分数'],
      end: ['北京', '改', '对不起', '后来'],
    },
    fallback: ['嘿嘿 你说呢', '不记得了', '你又在想有的没的', '好吧', '行吧行吧'],
    opening: { text: '这么晚了 还不睡', level: 'C' },
    history: HISTORY,
  });

  // 构建分身：画面照常走（抽帧、扫描、一句句浮现），内容用剧本里的聊天
  const sleep = T.sleep;
  T.recognize = async (frames, { onMessages } = {}) => {
    const msgs = HISTORY.filter(m => m.text);
    for (let k = 0; k < msgs.length; k += 2) { onMessages && onMessages(msgs.slice(0, k + 2)); await sleep(380); }
    return msgs;
  };
  T.buildPersona = async () => { await sleep(1800); return JSON.parse(JSON.stringify(T.PRESET)); };

  // 回话：「你还怪我吗」→ 固定三句；其余照常（真 AI）
  const FIXED = [
    { text: '这句我答不了', level: 'D' },
    { text: '我是照着你给的聊天记录拼出来的，记录停在 2011 年 7 月 21 号', level: 'D' },
    { text: '他现在怎么想，你得自己去问他', level: 'D' },
  ];
  const create = T.createChat;
  T.createChat = persona => {
    const chat = create(persona), reply = chat.reply;
    chat.reply = async text => /怪我|原谅|生我.*气/.test(text) ? (await sleep(900), FIXED) : reply(text);
    return chat;
  };
})();
