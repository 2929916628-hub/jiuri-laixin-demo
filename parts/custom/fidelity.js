/* 旧日来信 · 定制（纪念册）
   每一屏 = 背景层（跟随背景设置）+ Figma 导出图（已去掉状态栏，顶栏按钮全部代码绘制）+ 动态叠加 + 透明热区。
   图和坐标都来自 Figma「10月19更新版本 (Copy)」→「02 定制」和「静态补充状态画面」；
   有设计稿的状态直接换图，没有设计稿的、或需要跟随用户设置变化的，用代码画。
   交互和动效跟「空间」部分统一：纸盘可转、面板弹起/下拉收起、返回 = 回上一级（随时自动保存）。 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const screenEl = $("screen"), stageEl = $("stage"), toastEl = $("toast"), picker = $("picker");
  const DEBUG = /[?&]debug\b/.test(location.search);
  if (DEBUG) screenEl.classList.add("debug");
  const STORE_KEY = "album_v4";   // v4：书架存一组相册（每本各自的封面/背景/页面），不再只有单独一本
  const IMG = (name) => `assets/screens/${name}.webp`;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const INK = "#1B0D00", MUS = "#C89A3E", SAGE = "#8FA37E", TER = "#B5654A";
  const STATUS_H = 54;   // Figma 导出图顶部的手机状态栏高度：统一遮掉，不再显示

  /* ================= 设计稿数据 ================= */

  // 底部面板：面板顶边（这条线以下是不透明的面板）和面板底色（弹起冲过头时露出来的那一截）
  const SHEETS = {
    template: { top: 402, color: "#ffffff" }, photos: { top: 402, color: "#ffffff" },
    cover: { top: 420, color: "#fcfaf8" }, background: { top: 420, color: "#fcfaf8" },
    materials: { top: 461, color: "#ffffff" }, photoEdit: { top: 368, color: "#ffffff" }, textEdit: { top: 471, color: "#ffffff" },
    export: { top: 401, color: "#ffffff" }
  };
  const isSheet = (stage) => Object.prototype.hasOwnProperty.call(SHEETS, stage);

  const TEMPLATES = ["旅行手账", "乡野胶片", "花园手记"];   // 设计稿里还有「极简白」，按要求去掉
  const MATERIAL_TABS = ["最近", "热门", "可爱", "边框", "emoji"];
  const MATERIAL_EMPTY = { 0: [7, 8, 9, 10, 11], 1: [11] };       // 设计稿里空着的素材格
  const TILE_X = [13, 113, 213, 309], TILE_Y = [593, 684, 775];    // 素材格 82×79，第 0 格是「导入」
  const FONTS = [
    { name: "黑体", css: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif', weight: 600 },
    { name: "宋体", css: '"Songti SC", "STSong", "SimSun", "Noto Serif SC", serif', weight: 400 },
    { name: "像素", css: '"Share Tech Mono", "Courier New", monospace', weight: 400 },
    { name: "宽黑", css: '"LXGW Marker Gothic", "Noto Sans SC", sans-serif', weight: 400 }
  ];
  const TEXT_SIZES = [13, 17, 23];                                   // 小号 / 标准 / 大号（按编辑器整页宽 335 计）
  const STROKE_PX = [0, 2, 5, 8];                                    // 图片描边四档对应的实际像素（按页宽 335 计）
  const COLOR_NAMES = { cover: ["白色", "湖蓝", "玫红", "草绿", "金黄", "更多颜色"], background: ["雾蓝", "嫩绿", "豆沙粉", "焦糖", "丁香紫", "靛蓝", "更多颜色"] };

  // 从设计稿取的颜色；封皮颜色按反馈调亮调艳（之前 .6 透明度叠加在白封皮上太灰）
  const C = {
    paper: "#fafbf8",
    panel: "#fcfaf8",
    inputBox: "#e8e8e8",
    coverSwatches: ["#f6f3ee", "#2f93d6", "#e2456f", "#3fa968", "#eab02e", "#d9632a"],
    bgSwatches: ["#83bad1", "#b7d589", "#e9a09f", "#d9a46d", "#e6b3d4", "#8e9fce", "#787878"],
    bgFill: ["#83b4cf", "#a8c886", "#e8a3a6", "#d9a46d", "#e6b3d4", "#8e9fce", "#787878"],
    bgCards: ["bg_doodle", "bg_grass", "bg_pink", "bg_kraft"],   // 前四张素材卡：换成指定的四张图
    palette: ["#57433c", "#795749", "#a66d5e", "#c88870", "#d7a36e", "#e2c87c", "#b8ca86", "#8caa8b", "#6a92a4", "#aabdc4", "#8e86b6", "#c58fa8", "#e4b9c5", "#eee7da", "#c8c0ae", "#535655"],
    peSwatches: ["#ffffff", "#ffd2e6", "#aee0fb", "#c8ecab", "#ffe29a", "#cccccc"],   // 图片处理背景色：白色放最前，最后一个是调色板
    strokePalette: ["#362e2a", "#6f5c49", "#b7d8eb", "#f3c7d8", "#c4d7c3", "#ead591"],
    textColors: ["#282421", "#aa6974", "#d78f6e", "#d8b76b", "#7198a6", "#6f9173"],
    dotLight: "#c3c2bb", dotDark: "#22211d", pager: "#fcf6f1"
  };

  // 面板里那一页在各屏的位置（设计稿把页画死在图里）；patch 是盖住「+ 添加内容」/示例文字的区域（页内比例）
  const PAGE = {
    materials: { r: [100, 145, 212, 300], patch: [0.3, 0.42, 0.4, 0.16] },
    textEdit: { r: [94, 152, 208, 298], patch: [0.04, 0.4, 0.92, 0.24] },
    photoEdit: { r: [37, 156, 134, 189], r2: [171, 156, 134, 189], patch: [0.3, 0.42, 0.4, 0.16] },
    preview: { r: [21, 272, 167, 235], r2: [188, 272, 168, 235], patch: [0.3, 0.42, 0.4, 0.16] }
  };
  const ED_PAGE = { y: 198, w: 335, h: 474, left: 18, right: 49 };   // 编辑页：单页 335×474；左页在 x=18，右页滑到 x=49
  // 页内排版（页内比例）：有照片时照片在上、文字在下；贴纸按顺序落在这些位置
  const LAYOUT = {
    photo: { photo: [0.1, 0.07, 0.8, 0.46], text: [0.08, 0.6, 0.84, 0.17], spots: [[0.22, 0.86], [0.78, 0.86], [0.5, 0.92], [0.14, 0.62], [0.86, 0.62], [0.36, 0.9], [0.64, 0.9]] },
    plain: { text: [0.08, 0.36, 0.84, 0.28], spots: [[0.24, 0.2], [0.76, 0.2], [0.26, 0.8], [0.74, 0.8], [0.5, 0.12], [0.5, 0.88], [0.16, 0.5], [0.84, 0.5]] }
  };
  const BOOK = [21, 272, 334, 235];               // 总览页跨页在屏幕上的位置（导出用）

  /* ================= 状态：S 是「当前正在翻看/编辑的那本相册」，S.albums 是书架上所有相册 ================= */

  const S = {
    stage: "home", base: "home",
    albums: [], albumIndex: -1,                    // 书架：已存在的相册；albumIndex = 当前这本在书架里的位置（-1 = 还没放上书架）
    template: 0, source: "create",                 // source：import 从已有空间导入（照片自动带上）| create 空白新建
    photos: [],                                    // 装订前选好的照片（不存档，太大）
    space: "",
    cover: { color: 0, custom: "", pos: 0, photo: "" },
    bg: { kind: "wood", index: -1, custom: "", photo: "" },   // kind: wood | swatch | card | photo
    palette: "",                                   // 打开着的调色板：cover | background | pe
    text: { tab: 0, font: 0, color: 0, size: 1, align: 0, bold: false, italic: false },   // 文字样式（全册共用）
    materialTab: 1,
    pages: [],                                     // 每一页 { photo, stickers, text, bgColorIndex, bgColorCustom, strokeWidth, strokeColorIndex, cutout }
    page: 0,                                       // 正在编辑的那一页（偶数 = 跨页左页，奇数 = 右页）
    spread: 1,                                     // 总览里看到的跨页（从 1 数）
    made: false
  };
  const blankPage = () => ({ photo: "", stickers: [], text: "", bgColorIndex: 0, bgColorCustom: "", strokeWidth: 0, strokeColorIndex: 0, cutout: false });
  const spreadsCount = () => Math.max(1, Math.ceil(S.pages.length / 2));
  function curPage() { while (S.pages.length <= S.page) S.pages.push(blankPage()); return S.pages[S.page]; }
  // 照片按顺序一页一张排进相册；至少一个跨页，页数补成双数（左右页成对）
  function layoutPages(photos) {
    const pages = photos.map((p) => ({ ...blankPage(), photo: p.url }));
    while (pages.length < 2 || pages.length % 2) pages.push(blankPage());
    return pages;
  }
  const history = { undo: [], redo: [] };

  // 书架相册：把 S 现在这些字段打包成一条记录（存进 S.albums）；loadAlbum 是反过来，把某一条记录摊开到 S 上
  function albumSnapshot() {
    return {
      cover: { ...S.cover }, bg: { ...S.bg, photo: S.bg.kind === "photo" ? S.bg.photo : "" },
      pages: JSON.parse(JSON.stringify(S.pages)), template: S.template, space: S.space, text: { ...S.text }
    };
  }
  function commitAlbum() {
    if (!S.made) return;
    const snap = albumSnapshot();
    if (S.albumIndex < 0 || S.albumIndex >= S.albums.length) { S.albums.push(snap); S.albumIndex = S.albums.length - 1; }
    else S.albums[S.albumIndex] = snap;
  }
  function loadAlbum(i) {
    const a = S.albums[i]; if (!a) return;
    S.cover = { ...a.cover }; S.bg = { ...a.bg }; S.pages = JSON.parse(JSON.stringify(a.pages)).map((p) => ({ ...blankPage(), ...p }));
    S.template = a.template || 0; S.space = a.space || ""; S.text = { ...a.text };
    S.made = true; S.albumIndex = i; S.page = 0; S.spread = 1; ED.slide = null;
    history.undo.length = history.redo.length = 0;
  }
  function resetWorkingAlbum() {
    S.cover = { color: 0, custom: "", pos: 0, photo: "" };
    S.bg = { kind: "wood", index: -1, custom: "", photo: "" };
    S.pages = []; S.text = { tab: 0, font: 0, color: 0, size: 1, align: 0, bold: false, italic: false };
    S.template = 0; S.space = ""; S.photos = []; S.made = false; S.albumIndex = -1; S.page = 0; S.spread = 1; ED.slide = null;
  }

  function call(name, ...args) {
    try { if (window.JRLX && typeof window.JRLX[name] === "function") return window.JRLX[name](...args); } catch (e) { /* 独立运行也不影响 */ }
    return undefined;
  }
  function save() {
    commitAlbum();
    call("save", STORE_KEY, { albums: S.albums });
  }
  function load() {
    const d = call("load", STORE_KEY, null);
    if (!d || !Array.isArray(d.albums)) return;
    S.albums = d.albums.map((a) => ({
      cover: { color: 0, custom: "", pos: 0, photo: "", ...a.cover },
      bg: { kind: "wood", index: -1, custom: "", photo: "", ...a.bg },
      pages: Array.isArray(a.pages) ? a.pages.map((p) => ({ ...blankPage(), ...p, stickers: Array.isArray(p.stickers) ? p.stickers.slice(-16) : [] })) : [],
      template: a.template || 0, space: a.space || "",
      text: { tab: 0, font: 0, color: 0, size: 1, align: 0, bold: false, italic: false, ...a.text }
    }));
  }

  function toast(msg) {
    if (window.JRLX && window.JRLX.embedded) { call("toast", msg); return; }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => toastEl.classList.remove("show"), 1900);
  }

  // 弹簧动画（和「空间」部分同一套参数）
  function spring(from, to, { k = 170, c = 20, v = 0, onUpdate, onDone, eps = 0.0008 } = {}) {
    let x = from, vel = v, last = performance.now(), id;
    const step = (now) => {
      const dt = Math.min(0.032, (now - last) / 1000); last = now;
      const a = -k * (x - to) - c * vel; vel += a * dt; x += vel * dt;
      if (Math.abs(x - to) < eps && Math.abs(vel) < eps * 10) { onUpdate(to); if (onDone) onDone(); return; }
      onUpdate(x); id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return { stop: () => cancelAnimationFrame(id) };
  }

  /* ================= 叠加元素小工具（往正在搭的 view 里放） ================= */

  let V = null;   // 正在搭建的画面
  const px = (n) => `${n}px`;
  function place(node, x, y, w, h) { Object.assign(node.style, { left: px(x), top: px(y), width: px(w), height: px(h) }); return node; }
  function el(tag, cls, parent) { const n = document.createElement(tag); if (cls) n.className = cls; (parent || V.deco).appendChild(n); return n; }
  function hot(x, y, w, h, action, label, data) {
    const b = el("button", "hot", V.ui);
    b.type = "button"; b.setAttribute("aria-label", label);
    if (action) b.dataset.act = action;
    if (data) Object.entries(data).forEach(([k, v]) => { b.dataset[k] = String(v); });
    return place(b, x, y, w, h);
  }
  function patch(x, y, w, h, color, radius) {
    const p = place(el("i", "patch"), x, y, w, h);
    p.style.background = color; if (radius) p.style.borderRadius = px(radius);
    return p;
  }
  function swatch(x, y, size, color, selected) {
    const s = place(el("i", "swatch"), x, y, size, size);
    s.style.background = color;
    if (/^#f[0-9a-f]{5}$/i.test(color)) s.style.boxShadow = "inset 0 0 0 1px rgba(0,0,0,.28)";
    if (selected) ring(x, y, size);
  }
  function ring(x, y, size) { place(el("i", "ring"), x, y, size, size); }
  function sprite(src, x, y, w, h) {   // 把同一张设计稿的某一块原样再画一遍（盖在色块上面）
    const s = place(el("i", "sprite"), x, y, w, h);
    Object.assign(s.style, { backgroundImage: `url("${src}")`, backgroundSize: "402px 874px", backgroundPosition: `${-x}px ${-y}px` });
    return s;
  }
  function photo(url, x, y, w, h, radius) {
    const img = place(el("img", "photo"), x, y, w, h);
    img.src = url; img.alt = ""; if (radius) img.style.borderRadius = px(radius);
    return img;
  }
  // 返回：用 Figma「返回图标」同源的手绘图标，不再和设计稿里原本画死的返回键叠在一起
  function backIcon(x, y) {
    const b = place(el("button", "back-icon", V.ui), x, y, 32, 32);
    b.type = "button"; b.dataset.act = "back"; b.setAttribute("aria-label", "返回");
  }
  function backPill(x, y, text) {   // 「空间」纸箱页那种纸质返回按钮
    const b = el("button", "back-pill", V.ui);
    b.type = "button"; b.dataset.act = "back"; b.textContent = text;
    Object.assign(b.style, { left: px(x), top: px(y) });
  }
  function turnIcon(x, y, dir) { place(el("i", "turn-icon" + (dir > 0 ? " next" : "")), x, y, 18, 18); }
  // 挖掉设计稿截图里不需要再显示的区域（状态栏、画死的返回/导出/完成按钮、画死的书……），露出背景层。
  // 用 clip-path 的 evenodd 规则「掏洞」（mask-image 在这套环境里不生效，试过会整张图照常显示，clip-path 稳定）。
  // 多个区域一次性传入（每次调用整体替换，不叠加），状态栏这条总会自动包含；传入的区域之间不要互相重叠
  const rectContains = (o, r) => r[0] >= o[0] && r[1] >= o[1] && r[0] + r[2] <= o[0] + o[2] && r[1] + r[3] <= o[1] + o[3];
  function maskHoles(...rects) {
    const all = [[0, 0, 402, STATUS_H], ...rects];
    // evenodd 规则下，一个洞如果整个嵌套在另一个更大的洞里，重叠部分会被「挖两次」抵消回看得见——
    // 例如状态栏那条默认总会被传进来，顶栏再整体挖一条更大的时就会嵌套；丢掉被别的洞完全包住的那个
    const kept = all.filter((r, i) => !all.some((o, j) => j !== i && rectContains(o, r)));
    const rectPath = ([x, y, w, h]) => `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
    const d = `M0 0H402V874H0Z ${kept.map(rectPath).join(" ")}`;
    V.img.style.clipPath = `path(evenodd, "${d}")`;
  }

  /* ================= App 主风格的纸质按钮 / 手绘图标 ================= */

  const ICONS = {
    share: '<path d="M12 3.5v10.5M7.6 7.9 12 3.5l4.4 4.4M5.5 12.5v6.2c0 .9.7 1.6 1.6 1.6h9.8c.9 0 1.6-.7 1.6-1.6v-6.2"/>',
    check: '<path d="M5 12.8l4.3 4.2L19.2 7.2"/>',
    undo: '<path d="M8.8 14.2 4.6 10l4.2-4.2"/><path d="M4.6 10h9.6a5.2 5.2 0 0 1 0 10.4H11"/>',
    redo: '<path d="M15.2 14.2 19.4 10l-4.2-4.2"/><path d="M19.4 10H9.8a5.2 5.2 0 0 0 0 10.4H13"/>',
    // 下方工具栏 / 导出面板：手绘线稿 + 一块错位强调色，呼应底栏「返回图标」「信封」同一套画法
    cover: `<path d="M12 5.2c-2-1.3-4.6-1.4-7-.8v13.4c2.4-.6 5-.5 7 .8 2-1.3 4.6-1.4 7-.8V4.4c-2.4-.6-5-.5-7 .8Z" fill="${MUS}" opacity=".32"/><path d="M12 5.2v13.4M5 4.4v13.4c2.4-.6 5-.5 7 .8 2-1.3 4.6-1.4 7-.8V4.4" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>`,
    bg: `<rect x="2.6" y="3.4" width="18.8" height="15.2" rx="2" fill="none" stroke="${INK}" stroke-width="1.5"/><circle cx="7.6" cy="7.6" r="1.8" fill="${MUS}"/><path d="M3.6 16.2l4.4-5 3.6 3.6 2.6-3.4 5.2 5.6" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`,
    materials: `<path d="M12 2.6l1.9 4.1 4.5.5-3.3 3.2.8 4.5-3.9-2.1-3.9 2.1.8-4.5-3.3-3.2 4.5-.5Z" fill="${TER}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`,
    edit: `<rect x="3" y="3" width="12.4" height="12.4" rx="1.4" fill="${SAGE}" opacity=".32" stroke="${INK}" stroke-width="1.3"/><path d="M13 12.6 18 7.6a1.7 1.7 0 0 0 0-2.4l-1-1a1.7 1.7 0 0 0-2.4 0l-5 5-.9 3.6Z" fill="#fff" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`,
    text: `<path d="M3.6 5h16.8M7.8 5v14M3.6 19h7.2" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/><circle cx="17.5" cy="15.5" r="3" fill="${MUS}" opacity=".85"/>`,
    spread: `<path d="M12 6c-2-1.3-4.6-1.5-7.2-.9v12c2.6-.6 5.2-.4 7.2.9 2-1.3 4.6-1.5 7.2-.9v-12C16.6 4.5 14 4.7 12 6Z" fill="none" stroke="${INK}" stroke-width="1.5"/><path d="M12 6v12" stroke="${INK}" stroke-width="1.3"/>`,
    single: `<rect x="3.6" y="3" width="16.8" height="18" rx="1.6" fill="none" stroke="${INK}" stroke-width="1.5"/><circle cx="8.6" cy="8.4" r="1.9" fill="none" stroke="${INK}" stroke-width="1.3"/><path d="M4.6 16.4l4.6-4.8 3.6 3.6 2-2.8 4.6 4.6" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`,
    video: `<rect x="3" y="5" width="13.4" height="14" rx="2" fill="none" stroke="${INK}" stroke-width="1.5"/><path d="M16.4 10.2 21 7.4v9.2l-4.6-2.8Z" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`,
    pdf: `<path d="M6.4 2.4h8.4l4 4v15.2H6.4Z" fill="#fff" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><path d="M14.8 2.4v4h4" fill="none" stroke="${INK}" stroke-width="1.3"/><path d="M9 12.4h6.8M9 15.2h6.8M9 18h4" stroke="${MUS}" stroke-width="1.5" stroke-linecap="round"/>`
  };
  const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
  function pbtn(x, y, w, h, action, label, content) {
    const b = place(el("button", "pbtn", V.ui), x, y, w, h);
    b.type = "button"; b.dataset.act = action; b.setAttribute("aria-label", label);
    b.innerHTML = ICONS[content] ? svg(content) : content;
    return b;
  }
  function undoPair(x, y) {
    const box = place(el("div", "pbtn pair", V.ui), x, y, 94, 45);
    [["undo", "撤销", !history.undo.length], ["redo", "重做", !history.redo.length]].forEach(([act, label, off]) => {
      const b = el("button", "", box);
      b.type = "button"; b.dataset.act = act; b.setAttribute("aria-label", label); b.innerHTML = svg(act);
      if (off) b.classList.add("off");
    });
    box.insertBefore(document.createElement("i"), box.lastChild);
  }
  function toolbarStrip(x, y, w, h) {   // 一整条纸质底，和一级菜单的底栏同一种做法：图标直接悬浮在一条通栏上，不再一个个单独扣白框
    place(el("i", "toolbar-strip"), x, y, w, h);
  }
  function toolBtn(x, y, w, h, action, label, iconKey) {   // 下方工具栏按钮：图标 + 文字，透明的，底色由 toolbarStrip 统一垫
    const b = place(el("button", "toolbtn", V.ui), x, y, w, h);
    b.type = "button"; b.dataset.act = action; b.setAttribute("aria-label", label);
    b.innerHTML = svg(iconKey) + `<span>${label}</span>`;
    return b;
  }
  function iconChip(x, y, size, key) {   // 导出面板每一行左边的小图标
    const c = place(el("i", "icon-chip"), x, y, size, size);
    c.innerHTML = svg(key);
  }
  // 「合上/打开相册」顶栏：返回 + 导出 + 完成，统一往上收进去掉状态栏后腾出来的空间；extraHoles 额外盖掉这屏自己画死的书/按钮
  function bookTopBar(doneAct, extraHoles) {
    maskHoles([0, 0, 402, 140], ...(extraHoles || []));
    backIcon(22, 50);
    pbtn(264, 46, 46, 42, "open-export", "保存与导出", "share");
    pbtn(320, 48, 60, 38, doneAct, "完成", "完成");
  }
  // 编辑器一族（编辑页 / 素材 / 图片处理 / 文字）顶栏：返回 + 完成 + 撤销重做，同样整体上移
  function editTopBar2(extraHoles) {
    maskHoles([0, 0, 402, 136], ...(extraHoles || []));
    backIcon(20, 50);
    pbtn(76, 48, 50, 40, "to-preview", "完成编辑，看总览", "check");
    undoPair(132, 48);
  }

  /* ================= 每一屏 ================= */

  function bgStyle() {
    const b = S.bg;
    if (b.kind === "photo" && b.photo) return `center / cover no-repeat url("${b.photo}")`;
    if (b.kind === "swatch") return b.index === 6 && b.custom ? b.custom : C.bgFill[b.index];
    if (b.kind === "card") return `center / cover url("${IMG(b.index === 4 ? "bg_polka" : b.index === 5 ? "bg_water" : C.bgCards[b.index])}")`;
    return `center / cover url("${IMG("bg_wood")}")`;
  }

  // 合上的相册：只用封面本身（book_cover，裁掉了右下书页白边），4:5 竖版；投影用 CSS 画。
  // 镂空照片做成「嵌进封皮表面」的样子：先垫一块深色内凹底（socket），照片本身只留内阴影，不再有外部浮起的投影
  const BOOKS = { big: { r: [83, 250, 236, 295] }, small: { r: [116, 150, 172, 215] }, thumb: { r: [2, 0, 36, 45] } };
  // 一层书架 3 本，等距。bottoms = 每层搁板上沿（书底）的 y，按 home.webp（2026-11-05 换的 AI 光影书架图）实测
  const SHELF_SLOT = { w: 92, h: 112, x0: 24, gapX: 26, bottoms: [215, 420, 620] };
  function shelfRect(i) {
    const row = Math.floor(i / 3), col = i % 3, B = SHELF_SLOT.bottoms;
    const bottom = row < B.length ? B[row] : B[B.length - 1] + (row - B.length + 1) * (B[B.length - 1] - B[B.length - 2]);
    return [SHELF_SLOT.x0 + col * (SHELF_SLOT.w + SHELF_SLOT.gapX), bottom - SHELF_SLOT.h, SHELF_SLOT.w, SHELF_SLOT.h];
  }
  const resolveRect = (sizeOrRect) => (Array.isArray(sizeOrRect) ? sizeOrRect : BOOKS[sizeOrRect].r);
  const COVER_PHOTO = [[0.22, 0.085, 0.66, 0.31], [0.57, 0.085, 0.32, 0.39]];   // 镂空「上方」横图 /「右上」竖图（书本内比例）
  const BAKED_BOOK = { appearance: [40, 222, 330, 356], panel: [90, 140, 232, 256] };   // 设计稿前景图里画死的书所在范围，整块挖掉
  const lastPhotoRect = {};
  function albumCoverColor(a) { return a.cover.color === 5 && a.cover.custom ? a.cover.custom : C.coverSwatches[a.cover.color]; }
  function albumCoverPhotoURL(a) { return a.cover.photo || (a.photos && a.photos[0] && a.photos[0].url) || (a.pages[0] && a.pages[0].photo) || IMG("cover_photo"); }
  function coverColor() { return albumCoverColor(S); }
  function coverPhotoURL() { return albumCoverPhotoURL(S); }
  function coverPhotoRect(sizeOrRect, album) {
    const [, , w, h] = resolveRect(sizeOrRect), p = COVER_PHOTO[album.cover.pos ? 1 : 0];
    return [p[0] * w, p[1] * h, p[2] * w, p[3] * h];
  }
  function bookNode(sizeOrRect, album, parent) {
    album = album || S;
    const [x, y, w, h] = resolveRect(sizeOrRect), k = w / 236;
    const node = place(document.createElement("div"), x, y, w, h);
    node.className = "book";
    node.style.filter = `drop-shadow(0 ${2 * k}px ${2.5 * k}px rgba(42,23,8,.22)) drop-shadow(${3 * k}px ${12 * k}px ${14 * k}px rgba(42,23,8,.3))`;
    const cover = `url("${IMG("book_cover")}") 0 0 / 100% 100% no-repeat`;
    const paper = document.createElement("i"); paper.className = "book-layer"; paper.style.background = cover; node.appendChild(paper);
    if (album.cover.color !== 0 && !(album.cover.color === 5 && !album.cover.custom)) {
      const t = document.createElement("i"); t.className = "book-layer tint";
      Object.assign(t.style, { background: albumCoverColor(album), opacity: ".88", webkitMask: cover, mask: cover });
      node.appendChild(t);
    }
    const r = coverPhotoRect([x, y, w, h], album);
    const socket = place(document.createElement("i"), r[0] - 2 * k, r[1] - 2 * k, r[2] + 4 * k, r[3] + 4 * k);
    socket.className = "cover-socket"; node.appendChild(socket);
    const img = place(document.createElement("img"), ...r);
    img.className = "cover-photo"; img.src = albumCoverPhotoURL(album); img.alt = "";
    Object.assign(img.style, {
      borderWidth: px(Math.max(1, 1.6 * k)),
      boxShadow: `inset 0 ${2 * k}px ${4 * k}px rgba(0,0,0,.4), inset 0 ${-k}px ${2 * k}px rgba(255,255,255,.3), inset ${k}px 0 ${2 * k}px rgba(0,0,0,.16)`
    });
    node.appendChild(img);
    node.photoImg = img;
    (parent || V.deco).appendChild(node);
    return node;
  }
  function bookCover(sizeOrRect, album) {
    album = album || S;
    const node = bookNode(sizeOrRect, album);
    const key = Array.isArray(sizeOrRect) ? sizeOrRect.join(",") : sizeOrRect;
    const rect = coverPhotoRect(sizeOrRect, album), prev = lastPhotoRect[key];
    if (prev && prev.join() !== rect.join()) {   // 换镂空位置：照片从原位置滑过去并变形
      const css = (q) => ({ left: px(q[0]), top: px(q[1]), width: px(q[2]), height: px(q[3]) });
      node.photoImg.animate([css(prev), css(rect)], { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
    lastPhotoRect[key] = rect;
    return node;
  }

  // 色球一排：设计稿里选中圈画死在某个球上，整排重画，选中圈跟着实际选择走；y 可指定（图片处理面板的色球行位置跟封面/背景不一样）
  function swatchRow(colors, selected, custom, y = 523) {
    patch(28, y - 4, 300, 38, C.panel);
    colors.forEach((c, i) => {
      const last = i === colors.length - 1;
      if (last && !custom) {   // 最后一个是「更多颜色」：没选过就画成彩色色环
        const s = place(el("i", "swatch"), 35 + 43 * i, y, 28, 28);
        s.style.background = "conic-gradient(#e86f6f, #e8c46f, #8fd07a, #6fc3e8, #8e8fe0, #e07ad0, #e86f6f)";
        if (selected === i) ring(35 + 43 * i, y, 28);
      } else swatch(35 + 43 * i, y, 28, last ? custom : c, i === selected);
    });
  }

  // 画一页：背景色（实心铺满整页）+ 照片（一页一张，带描边 / 抠图）+ 贴纸 + 文字。
  // o.patch 盖住设计稿里画死的「+ 添加内容」，o.placeholder 在空白页上自己画「+ 添加内容」，o.tiny 是缩略图（等比缩小）
  function drawPage(parent, rect, page, o = {}) {
    const [x, y, w, h] = rect, k = w / 335, L = page && page.photo ? LAYOUT.photo : LAYOUT.plain;
    const has = !!(page && (page.photo || page.stickers.length || page.text.trim()));
    const mk = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; parent.appendChild(n); return n; };
    if (page) {   // 页面底色每次都画实了（默认白色也画），不然页面本身就没有不透明的底，背景设置一露出来，页面就变成光秃秃的照片/文字飘在空中
      const bg = place(mk("i", "page-bg"), x, y, w, h);
      bg.style.background = page.bgColorIndex === 5 && page.bgColorCustom ? page.bgColorCustom : C.peSwatches[page.bgColorIndex];
    }
    if (o.patch) {
      const p = place(mk("i", "patch"), x + o.patch[0] * w, y + o.patch[1] * h, o.patch[2] * w, o.patch[3] * h);
      p.style.background = C.paper; p.dataset.role = "page-patch"; p.hidden = !has;
    }
    if (o.placeholder) {
      const ph = place(mk("span", "page-ph"), x, y + h * 0.42, w, h * 0.16);
      ph.innerHTML = "<b>+</b>添加内容"; ph.dataset.role = "page-ph"; ph.hidden = has;
      ph.style.fontSize = px(Math.max(6, 13 * k));
    }
    if (!page) return;
    if (page.photo) {
      const r = L.photo, img = place(mk("img", "photo"), x + r[0] * w, y + r[1] * h, r[2] * w, r[3] * h);
      img.src = page.photo; img.alt = ""; img.style.borderRadius = px(Math.max(1, 3 * k));
      if (page.strokeWidth) img.style.border = `${Math.max(0.6, STROKE_PX[page.strokeWidth] * k)}px solid ${C.strokePalette[page.strokeColorIndex] || "#333"}`;
      if (page.cutout) { const m = "radial-gradient(ellipse 70% 66% at 50% 48%, #000 58%, transparent 100%)"; img.style.webkitMaskImage = m; img.style.maskImage = m; }
    }
    page.stickers.forEach((st) => {
      const url = stickerURL(st);
      if (!url) return;
      const img = mk("img", "sticker"), size = o.tiny ? 58 * k : Math.max(18, 58 * k);
      img.src = url; img.alt = "";
      Object.assign(img.style, { left: px(x + st.x * w), top: px(y + st.y * h), width: px(size), height: px(size) });
    });
    const t = mk("div", "page-text"), r = L.text;
    t.dataset.role = "page-text"; t.dataset.k = String(k); t.dataset.tiny = o.tiny ? "1" : "";
    place(t, x + r[0] * w, y + r[1] * h, r[2] * w, r[3] * h);
    styleText(t, k, page.text, o.tiny);
    t.hidden = !page.text.trim();
  }
  function styleText(node, k, value, tiny) {
    const f = FONTS[S.text.font] || FONTS[0];
    node.textContent = value;
    Object.assign(node.style, {
      fontFamily: f.css, fontWeight: S.text.bold ? 700 : f.weight, fontStyle: S.text.italic ? "italic" : "normal",
      fontSize: px(tiny ? TEXT_SIZES[S.text.size] * k : Math.max(7, TEXT_SIZES[S.text.size] * k)), color: C.textColors[S.text.color],
      justifyContent: S.text.align === 1 ? "center" : "flex-start", textAlign: S.text.align === 1 ? "center" : "left",
      padding: tiny ? "0" : ""
    });
  }
  // 面板里的那一页（设计稿画死的页上叠当前页的内容）
  function pageContent(key) {
    const p = PAGE[key], rect = S.page % 2 && p.r2 ? p.r2 : p.r;
    drawPage(V.deco, rect, curPage(), { patch: p.patch });
  }
  function paletteHots(kind) {
    hot(0, 0, 402, 874, "close-palette", "收起色板");
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) hot(225 + 35 * c, 403 + 27 * r, 33, 27, "palette-color", `颜色 ${r * 4 + c + 1}`, { i: r * 4 + c, palette: kind });
  }
  // 封面 / 背景设置：标题和分组名靠左对齐色球（新版面板是居中文本框，缩进太多，字体也要用 app 主字体）
  function panelLabels(title, groups) {
    patch(56, 450, 120, 34, C.panel); patch(44, 493, 96, 26, C.panel); patch(44, 566, 96, 28, C.panel);
    const t = el("span", "panel-title"); t.textContent = title; Object.assign(t.style, { left: "35px", top: "455px" });
    groups.forEach((g, i) => { const n = el("span", "panel-label"); n.textContent = g; Object.assign(n.style, { left: "35px", top: px(i ? 570 : 497) }); });
  }

  const BUILD = {
    home() {
      V.bg = `center / cover url("${IMG("home")}")`;   // 书架不跟任何一本相册的背景设置走；底图用书架图本身，状态栏那条挖洞处才不会露出另一张图的接缝
      V.shot = IMG("home");
      // 新书架图里没有画死的占位书，不用再挖洞（挖了会露出底下没有搁板的 bg_wood）
      S.albums.forEach((a, i) => {
        const rect = shelfRect(i);
        bookNode(rect, a);
        hot(...rect, "resume", `打开第 ${i + 1} 本相册`, { i });
      });
      hot(140, 639, 86, 88, "open-entry", "新建或导入相册");
    },

    // 新建入口：和「空间」一样的穿孔纸盘，左右拖着转，转到正中再轻点进入；往下拖或点空白处塞回去
    entry() {
      V.bg = `center / cover url("${IMG("home")}")`;
      V.shot = IMG("home");
      V.img.classList.add("blurred");
      el("i", "entry-shade");
      hot(0, 0, 402, 874, "back", "收起纸盘");
      backPill(18, 62, "‹ 返回书架");
      buildDisc();
    },

    // 导入：选一个已经建好的空间。信封滚轮和一级菜单「空间」的信件页同一套——上下拖动 / 甩动带惯性，
    // 松手吸附到最近一封；中间那封摆正。点中间那封或底部「选择」：带上这个空间里的照片，去选模板
    spaces() {
      V.bg = `center / cover url("${IMG("bg_wood")}")`;
      el("div", "letters-bg");
      buildWheel();
      el("div", "box-inner-shadow", V.ui);
      backIcon(16, 70);
      const st = el("button", "straighten", V.ui);
      st.type = "button"; st.dataset.act = "straighten"; st.setAttribute("aria-pressed", String(WHEEL.straight));
      st.innerHTML = '<span class="chk"><svg viewBox="0 0 18 18"><path d="M4 9.4 L7.6 12.8 L14 5.6" fill="none" stroke="#f4ecdd" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>摆正中间那封';
      el("p", "letters-count", V.ui).textContent = `来信 · ${WHEEL.letters.length} 封`;
      const pick = place(el("button", "pick-btn", V.ui), 32, 790, 340, 52);   // 设计稿「选中信封」页底部那条黄色「选择」
      pick.type = "button"; pick.dataset.act = "pick-space"; pick.setAttribute("aria-label", "选择这个空间");
      Object.assign(pick.style, { backgroundImage: `url("${IMG("spaces_pick")}")`, backgroundPosition: "-32px -790px" });
    },

    // 选模板：真正跟手的轮播，松手弹簧吸附到最近的一套；下面的圆点按顺序对应每套模板，点圆点也能切
    template() {
      V.bg = `center / cover url("${IMG("bg_wood")}")`;
      V.shot = IMG("template_1");
      patch(0, 514, 402, 256, "#ffffff");   // 盖掉设计稿里画死的轮播和圆点
      patch(150, 772, 110, 22, "#ffffff");
      hot(0, 0, 402, 402, "close-sheet", "收起");
      hot(339, 425, 43, 42, "close-sheet", "关闭");
      hot(35, 809, 163, 44, "close-sheet", "取消");
      hot(210, 809, 163, 44, "pick-template", "选择这套模板");
      if (S.source === "import" && S.photos.length) {
        const tag = el("span", "count-tag one-line"); tag.style.left = "50%"; tag.style.top = "498px"; tag.style.transform = "translateX(-50%)";
        tag.textContent = `${S.space.replace(/^给\s*/, "")} · 已带上 ${S.photos.length} 张照片`;
      }
      buildCarousel();
    },

    photos() {
      V.bg = `center / cover url("${IMG("bg_wood")}")`;
      V.shot = IMG("photos");
      hot(0, 0, 402, 402, "close-sheet", "收起");
      hot(344, 416, 43, 42, "close-sheet", "关闭");
      hot(63, 541, 300, 183, "add-photos", "选择照片");
      hot(32, 787, 163, 44, "back", "上一步");
      hot(207, 786, 163, 44, "to-binding", "选好了，开始装订");
      if (S.photos.length) {
        const shown = S.photos.slice(0, 6), more = S.photos.length - shown.length;
        const grid = place(el("div", "photo-grid"), 63, 541, 300, 183);
        const cols = shown.length === 1 ? 1 : shown.length <= 4 ? 2 : 3;
        grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        grid.style.gridTemplateRows = shown.length <= cols ? "1fr" : "1fr 1fr";
        shown.forEach((p, i) => {
          if (more > 0 && i === shown.length - 1) { const b = el("b", "", grid); b.textContent = `+${more + 1}`; b.style.background = `linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)), center / cover url("${p.url}")`; }
          else { const img = el("img", "", grid); img.src = p.url; img.alt = p.name; }
        });
        const tag = el("span", "count-tag"); tag.style.right = "39px"; tag.style.top = "514px";
        tag.textContent = `已选 ${S.photos.length} 张，点框内可继续添加`;
      }
    },

    binding() {
      V.bg = `center / cover url("${IMG("bg_wood")}")`;
      V.shot = IMG("binding");
      const dots = el("div", "dots");
      for (let i = 0; i < 5; i++) {
        const d = place(el("i", "", dots), 161 + 18 * i, 549, 8, 8);
        d.style.background = C.dotLight;
        d.animate([{ background: C.dotDark }, { background: C.dotDark, offset: 0.2 }, { background: C.dotLight, offset: 0.3 }, { background: C.dotLight }], { duration: 1000, delay: i * 200, iterations: Infinity });
      }
    },

    // 合上的相册（外观）：点书的任意位置 → 翻开成全部页面总览；背景跟随背景设置
    appearance() {
      V.bg = bgStyle(); V.shot = IMG("appearance_fg");
      bookTopBar("open-book", [BAKED_BOOK.appearance, [0, 704, 402, 170]]);
      bookCover("big");
      hot(...BOOKS.big.r, "open-book", "翻开相册");
      toolbarStrip(34, 748, 334, 108);
      toolBtn(52, 770, 145, 64, "open-cover", "封面", "cover");
      toolBtn(207, 770, 145, 64, "open-background", "背景", "bg");
    },

    cover() {
      V.bg = bgStyle(); V.shot = IMG(S.palette === "cover" ? "cover_palette_fg" : S.cover.pos ? "cover_fg_right" : "cover_fg");
      bookTopBar("close-sheet", [BAKED_BOOK.panel]);
      bookCover("small");
      panelLabels("封面设置", ["封皮颜色", "镂空位置"]);
      swatchRow(C.coverSwatches, S.cover.color, S.cover.custom);
      // 镂空位置卡片里的镂空图片示意（Figma 主稿「05 封面设置」里有，新版面板漏画了）：上方 = 横条，右上 = 竖条
      patch(74, 620, 19, 13, "#555", 1);
      patch(251, 620, 9, 14, "#555", 1);
      hot(0, 0, 402, 420, "close-sheet", "收起");
      C.coverSwatches.forEach((c, i) => hot(31 + 43 * i, 515, 38, 44, i === 5 ? "open-palette" : "cover-color", `封皮颜色：${COLOR_NAMES.cover[i]}`, { i, palette: "cover" }));
      hot(35, 603, 145, 76, "cover-pos", "镂空位置：上方", { i: 0 });
      hot(201, 603, 145, 76, "cover-pos", "镂空位置：右上", { i: 1 });
      hot(34, 713, 334, 48, "upload-cover", "上传封面图片");
      if (S.palette === "cover") paletteHots("cover");
    },

    background() {
      V.bg = bgStyle(); V.shot = IMG(S.palette === "background" ? "bg_palette_fg" : "bg_fg");
      bookTopBar("close-sheet", [BAKED_BOOK.panel]);
      bookCover("small");
      panelLabels("背景设置", ["背景颜色", "图片素材"]);
      swatchRow(C.bgSwatches, S.bg.kind === "swatch" ? S.bg.index : -1, S.bg.custom);
      patch(25, 594, 58, 90, C.panel);                       // 第一张素材卡在设计稿里带着选中框，先盖掉
      C.bgCards.forEach((name, i) => {                       // 前四张纯色卡换成指定的四张图
        const card = photo(IMG(name), 29 + 61 * i, 598, 50, 82, 6);
        card.classList.add("bg-thumb");
      });
      if (S.bg.kind === "card") place(el("i", "card-pick"), 29 + 61 * S.bg.index - 3, 595, 56, 88);
      hot(0, 0, 402, 420, "close-sheet", "收起");
      C.bgSwatches.forEach((c, i) => hot(31 + 43 * i, 515, 38, 44, i === 6 ? "open-palette" : "bg-color", `背景颜色：${COLOR_NAMES.background[i]}`, { i, palette: "background" }));
      for (let i = 0; i < 6; i++) hot(29 + 61 * i - 3, 595, 56, 88, "bg-card", `背景素材 ${i + 1}`, { i });
      hot(34, 710, 334, 48, "upload-background", "上传自己的图片作背景");
      if (S.palette === "background") paletteHots("background");
    },

    // 编辑某一页：设计稿只画了一张单页，这里换成真正的跨页——当前页放大在中间，旁边露出另一页的边，
    // 点它或左右滑，视角滑到另一页（左页 ↔ 右页）
    editor() {
      V.bg = bgStyle(); V.shot = IMG("editor");
      editTopBar2([[0, 136, 402, 738]]);   // 页面卡片本身是代码画的，四周留白整块挖掉露出背景（原来只挖了底部工具条那一条）
      buildEditorSpread();
      toolbarStrip(34, 748, 334, 108);
      toolBtn(40, 770, 101, 64, "open-materials", "素材", "materials");
      toolBtn(151, 770, 101, 64, "open-photo-edit", "编辑", "edit");
      toolBtn(262, 770, 101, 64, "open-text-edit", "文字", "text");
    },

    materials() {
      V.bg = bgStyle(); V.shot = IMG(`materials_${S.materialTab}`);
      pageContent("materials");
      editTopBar2([[0, 136, 402, 325]]);   // 顶栏往下到素材面板之间那圈留白：露出背景，不动面板本身（面板里图标还是画死的）
      hot(0, 0, 402, 461, "close-sheet", "收起素材面板");
      hot(225, 484, 98, 34, "search", "搜索素材");
      hot(340, 476, 52, 52, "close-sheet", "完成");
      [[20, 66], [88, 66], [155, 64], [220, 66], [288, 66]].forEach(([x, w], i) => hot(x, 536, w, 42, "material-tab", `素材分类：${MATERIAL_TABS[i]}`, { i }));
      TILE_Y.forEach((y, r) => TILE_X.forEach((x, c) => {
        const tile = r * 4 + c;
        if (tile === 0) hot(x, y, 82, 79, "add-photos", "导入自己的照片");
        else if (!(MATERIAL_EMPTY[S.materialTab] || []).includes(tile)) hot(x, y, 82, 79, "add-sticker", `添加素材 ${tile}`, { tile });
      }));
    },

    // 图片处理：顶部是这个跨页的左右两页缩略（点哪页就编辑哪页，带滑动选中指示）；背景色改成整页实心铺满、
    // 已选照片和「添加」合并成同一排方形格、描边和颜色直接可点、抠图真的会给照片套一个柔边蒙版
    photoEdit() {
      V.bg = bgStyle(); V.shot = IMG("photo_edit");
      editTopBar2([[0, 136, 402, 738]]);   // 这屏全是代码画的实心面板，整块挖掉露出背景，顺便不再透出设计稿里画死的旧版文案
      hot(0, 0, 402, 368, "close-sheet", "收起图片处理");
      photoEditPreview();
      const page = curPage();
      place(el("span", "pe-label"), 31, 419, 150, 24).textContent = "背景色";
      swatchRow(C.peSwatches, page.bgColorIndex, page.bgColorCustom, 452);
      C.peSwatches.forEach((c, i) => hot(31 + 43 * i, 444, 38, 44, i === 5 ? "open-palette" : "pe-color", `页面背景色 ${i + 1}`, { i, palette: "pe" }));
      place(el("span", "pe-label"), 31, 505, 150, 24).textContent = "已选图片";
      const row = { x0: 34, y: 538, size: 59, gap: 9 };
      for (let s = 0; s < 3; s++) {
        const x = row.x0 + s * (row.size + row.gap);
        if (S.photos[s]) { photo(S.photos[s].url, x, row.y, row.size, 68, 6); hot(x, row.y, row.size, 68, "photo-slot", `换成已选照片 ${s + 1}`, { i: s }); }
        else { place(el("i", "pe-add-tile"), x, row.y, row.size, 68).textContent = "＋"; hot(x, row.y, row.size, 68, "add-photos", "添加照片"); }
      }
      place(el("span", "pe-label"), 31, 624, 150, 24).textContent = "图片描边";
      STROKE_PX.forEach((wpx, i) => {
        const kx = 40 + i * 70, dot = place(el("i", "pe-stroke-dot" + (page.strokeWidth === i ? " on" : "")), kx, 652, 38, 38);
        dot.style.boxShadow = wpx ? `inset 0 0 0 ${Math.max(2, wpx * 0.8)}px #3a332c` : "inset 0 0 0 1.5px #bbb";
        hot(kx - 4, 648, 46, 46, "stroke-width", wpx ? `描边粗细 ${wpx}px` : "不描边", { i });
      });
      place(el("span", "pe-label"), 31, 700, 150, 24).textContent = "描边颜色";
      C.strokePalette.forEach((c, i) => { swatch(34 + i * 40, 726, 26, c, i === page.strokeColorIndex); hot(30 + i * 40, 722, 34, 34, "stroke-color", `描边颜色 ${i + 1}`, { i }); });
      const cut = place(el("button", "pe-cutout" + (page.cutout ? " on" : "")), 31, 772, 334, 40);
      cut.type = "button"; cut.dataset.act = "cutout"; cut.textContent = page.cutout ? "已抠图 · 点击还原" : "一键抠图";
    },

    textEdit() {
      V.bg = bgStyle(); V.shot = IMG(["text_font", "text_color", "text_size", "text_format"][S.text.tab]);
      pageContent("textEdit");
      editTopBar2([[0, 136, 402, 335]]);   // 顶栏到文字面板之间那圈留白：露出背景
      hot(0, 0, 402, 471, "close-sheet", "收起文字面板");
      [[28, 58], [88, 50], [138, 50], [188, 52]].forEach(([x, w], i) => hot(x, 618, w, 42, "text-tab", ["字体", "颜色", "字号", "格式"][i], { i }));
      const t = S.text;
      if (t.tab === 0) [32, 124, 217, 308].forEach((x, i) => { if (i === t.font) place(el("i", "chip-pick"), x, 707, 81, 32); hot(x, 702, 81, 42, "text-font", FONTS[i].name, { i }); });
      if (t.tab === 1) C.textColors.forEach((c, i) => { if (i === t.color) ring(49 + 54 * i, 708, 30); hot(44 + 54 * i, 703, 40, 40, "text-color", `文字颜色 ${i + 1}`, { i }); });
      if (t.tab === 2) [45, 155, 265].forEach((x, i) => { if (i === t.size) place(el("i", "chip-pick"), x, 707, 88, 36); hot(x, 704, 88, 42, "text-size", ["小号", "标准", "大号"][i], { i }); });
      if (t.tab === 3) [32, 124, 217, 308].forEach((x, i) => {
        if ((i < 2 && t.align === i) || (i === 2 && t.bold) || (i === 3 && t.italic)) place(el("i", "chip-pick"), x, 707, 81, 32);
        hot(x, 702, 81, 42, "text-format", ["左对齐", "居中", "加粗", "斜体"][i], { i });
      });
      const input = place(el("textarea", "text-input", V.ui), 29, 537, 360, 74);
      input.maxLength = 60; input.placeholder = "编辑你的段落文字"; input.value = curPage().text;
      input.style.background = C.inputBox;
      input.setAttribute("aria-label", "编辑相册文字");
      input.addEventListener("focus", () => snapshot());
      input.addEventListener("input", () => { curPage().text = input.value; save(); refreshText(); });
    },

    // 打开的相册：全部页面总览。点左页 / 右页放大进入那一页；左右滑翻跨页；下方缩略图条按顺序列出每个跨页
    preview() {
      const spread = clamp(S.spread, 1, spreadsCount()), L = 2 * (spread - 1);
      S.spread = spread;
      V.bg = bgStyle(); V.shot = IMG("preview_1");
      drawPage(V.deco, PAGE.preview.r, S.pages[L] || blankPage(), { patch: PAGE.preview.patch });
      drawPage(V.deco, PAGE.preview.r2, S.pages[L + 1] || blankPage(), { patch: PAGE.preview.patch });
      const pager = place(el("span", "pager"), 160, 561, 48, 22);   // 盖住设计稿里写死的「1/2」：有几个跨页就显示几
      pager.textContent = `${spread}/${spreadsCount()}`; pager.style.background = C.pager;
      bookTopBar("finish", [[0, 140, 402, 734]]);   // 这屏全是代码画的（跨页+缩略图条），整块挖掉露出背景
      turnIcon(120, 561, -1); turnIcon(238, 561, 1);   // 翻页箭头原本是设计稿画死的，面板整块挖空后要补成代码画的
      hot(112, 552, 52, 38, "turn", "上一跨页", { d: -1 });
      hot(206, 552, 52, 38, "turn", "下一跨页", { d: 1 });
      const book = hot(21, 272, 334, 235, "", "点左页或右页进入编辑，左右滑动翻页");
      let x0 = null;
      book.addEventListener("pointerdown", (e) => { x0 = pt(e).x; });
      book.addEventListener("pointerup", (e) => {
        if (x0 == null) return;
        const x = pt(e).x, dx = x - x0; x0 = null;
        if (Math.abs(dx) > 30) turnPage(dx < 0 ? 1 : -1);
        else openPage(L + (x > 188 ? 1 : 0));
      });
      buildThumbStrip();
    },

    export() {
      V.bg = bgStyle(); V.shot = IMG("export");
      bookTopBar("close-sheet", [[0, 140, 402, 261]]);   // 面板顶上那截背景（面板本身行文案还是画死的，不动）
      hot(0, 0, 402, 401, "close-sheet", "收起导出面板");
      // 每行图标原来是设计稿里的灰色方框，边缘和挖洞对不齐会漏底；改成直接拿一块和面板同色的白块盖掉旧方框，图标本身不画框
      [548, 628, 704, 780].forEach((y) => patch(36, y - 4, 56, 56, "#fff"));
      iconChip(40, 548, 48, "spread"); hot(30, 541, 341, 63, "export-jpg", "导出跨页拼图 JPG", { mode: "spread" });
      iconChip(40, 628, 48, "single"); hot(30, 621, 341, 63, "export-jpg", "导出单页图片 JPG", { mode: "page" });
      iconChip(40, 704, 48, "video"); hot(30, 698, 341, 63, "export-video", "导出翻页动画 MP4");
      iconChip(40, 780, 48, "pdf"); hot(30, 773, 341, 63, "export-pdf", "整本导出 PDF");
    }
  };

  // 图片处理面板顶部：这个跨页左右两页的缩略，点哪页就切到编辑哪页，带一个滑动的选中指示框
  let lastPEInd = null;
  function photoEditPreview() {
    const pair = S.page - (S.page % 2), onLeft = S.page % 2 === 0;
    const r = onLeft ? PAGE.photoEdit.r : PAGE.photoEdit.r2;
    drawPage(V.deco, PAGE.photoEdit.r, S.pages[pair] || blankPage(), { patch: PAGE.photoEdit.patch, placeholder: true });
    drawPage(V.deco, PAGE.photoEdit.r2, S.pages[pair + 1] || blankPage(), { patch: PAGE.photoEdit.patch, placeholder: true });
    const ind = place(el("i", "pe-pageind"), r[0] - 3, r[1] - 3, r[2] + 6, r[3] + 6);
    if (lastPEInd && lastPEInd.join() !== r.join()) {
      ind.animate([{ left: px(lastPEInd[0] - 3), top: px(lastPEInd[1] - 3) }, { left: px(r[0] - 3), top: px(r[1] - 3) }], { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
    lastPEInd = r;
    hot(...PAGE.photoEdit.r, "select-page", "编辑左页", { side: 0 });
    hot(...PAGE.photoEdit.r2, "select-page", "编辑右页", { side: 1 });
  }

  /* ================= 纸盘（和「空间」的纸盘同一套：遮罩打孔、弹簧升起、左右转动吸附） ================= */

  const DISC = { q: 0, rot: 0, qAnim: null, rotAnim: null, root: null, wrap: null, disc: null, divider: null, opts: {}, busy: false };
  const DISC_RANGE = 330, DISC_SNAPS = [38, 0, -38];   // rot = 38：左边「导入」转到正中；-38：右边「创建」转到正中
  function buildDisc() {
    const wrap = el("div", "disc-wrap", V.ui), disc = el("div", "disc", wrap);
    el("div", "disc-paper", disc);
    const divider = el("div", "disc-divider", disc);
    const labels = el("div", "disc-labels", wrap);
    const opts = {};
    [["import", "导入", "从已有空间导出"], ["create", "创建", "创建空白相册"]].forEach(([k, b, s]) => {
      const o = el("button", "opt", labels);
      o.type = "button"; o.dataset.opt = k;
      o.innerHTML = `<b>${b}</b><span>${s}</span>`;
      opts[k] = o;
    });
    Object.assign(DISC, { root: V.el, wrap, disc, divider, opts, q: 0, rot: 0, busy: false });
    renderDisc(); renderDial();
    bindDisc(wrap);
    V.after = () => settleDisc(1);
  }
  function renderDisc() {
    if (!DISC.wrap) return;
    const q = DISC.q, u = 1 - clamp(q, 0, 1.2), over = Math.max(0, q - 1), lift = clamp(q, 0, 1);
    DISC.wrap.style.transform = `translate3d(${u * -26}px, ${u * (DISC_RANGE + 20) - over * 40}px, 0) perspective(1400px) rotateX(${u * 9}deg) rotate(${u * -5}deg) scale(${1 + over * 0.04})`;
    DISC.wrap.style.filter = `drop-shadow(0 ${-3 - lift * 9}px ${8 + lift * 16}px rgba(42,23,8,${0.18 + lift * 0.22}))`;
    DISC.root.querySelectorAll(".entry-shade, .back-pill").forEach((n) => { n.style.opacity = String(smooth(0, 0.8, q)); });
  }
  function renderDial() {
    if (!DISC.disc) return;
    const rot = DISC.rot;
    DISC.disc.style.transform = `rotate(${rot}deg)`;
    DISC.divider.style.opacity = String(clamp(1 - Math.abs(rot) / 22, 0, 1));
    [["import", -38], ["create", 38]].forEach(([k, base]) => {
      const a = base + rot, rad = a * Math.PI / 180, R = 178;
      const x = 300 + R * Math.sin(rad), y = 300 - R * Math.cos(rad);
      const sc = 1 + 0.16 * clamp(1 - Math.abs(a) / 38, 0, 1) * clamp(Math.abs(rot) / 38, 0, 1);
      const o = DISC.opts[k];
      o.style.transform = `translate(${x}px, ${y - 12}px) scale(${sc})`;
      o.style.opacity = String(clamp(1 - (Math.abs(a) - 40) / 24, 0, 1));
      o.classList.toggle("centered", Math.abs(a) < 6);
    });
  }
  function settleDisc(target, v = 0, done) {
    if (DISC.qAnim) DISC.qAnim.stop();
    if (target === 1 && DISC.q < 0.5) call("sound", "unfold");
    DISC.qAnim = spring(DISC.q, target, { k: target ? 150 : 220, c: target ? 15 : 26, v, onUpdate: (x) => { DISC.q = x; renderDisc(); }, onDone: done });
  }
  function snapRot(target, v = 0) {
    if (DISC.rotAnim) DISC.rotAnim.stop();
    if (target !== DISC.rot) call("sound", "tick");
    DISC.rotAnim = spring(DISC.rot, target, { k: 160, c: 17, v, onUpdate: (x) => { DISC.rot = x; renderDial(); } });
  }
  // 塞回纸盘，然后去下一屏（默认回书架）
  function tuckDisc(next) {
    if (DISC.busy) return;
    DISC.busy = true;
    call("sound", "tap");
    settleDisc(0, 0, () => { DISC.wrap = null; next ? next() : go("home", "fade"); });
  }
  function bindDisc(wrap) {
    let d = null;
    wrap.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      if (DISC.busy) return;
      wrap.setPointerCapture(e.pointerId);
      if (DISC.rotAnim) DISC.rotAnim.stop();
      const p = pt(e);
      d = { x0: p.x, y0: p.y, x: p.x, y: p.y, r0: DISC.rot, t: performance.now(), vx: 0, vy: 0, axis: "", target: e.target.closest(".opt") };
    });
    wrap.addEventListener("pointermove", (e) => {
      if (!d) return;
      const p = pt(e), now = performance.now(), dt = Math.max(1, now - d.t);
      d.vx = d.vx * 0.6 + ((p.x - d.x) / dt) * 0.4; d.vy = d.vy * 0.6 + ((p.y - d.y) / dt) * 0.4;
      d.x = p.x; d.y = p.y; d.t = now;
      const dx = p.x - d.x0, dy = p.y - d.y0;
      if (!d.axis && Math.hypot(dx, dy) > 6) d.axis = Math.abs(dy) > Math.abs(dx) && dy > 0 ? "y" : "x";
      if (d.axis === "x") {
        let r = d.r0 + dx * 0.2;
        if (r > 44) r = 44 + (r - 44) * 0.3; if (r < -44) r = -44 + (r + 44) * 0.3;
        DISC.rot = r; renderDial();
      } else if (d.axis === "y") {
        if (DISC.qAnim) DISC.qAnim.stop();
        DISC.q = clamp(1 - dy / DISC_RANGE, 0, 1); renderDisc();
      }
    });
    const end = (e) => {
      if (!d) return;
      const cur = d; d = null;
      if (cur.axis === "y") {   // 往下塞：拖过一段或甩得快就收回去，不然弹回来
        if (DISC.q < 0.75 || cur.vy > 0.5) tuckDisc(); else settleDisc(1, -cur.vy * 1000 / DISC_RANGE);
        return;
      }
      if (cur.axis === "x") {
        const proj = DISC.rot + cur.vx * 0.2 * 60;
        snapRot(DISC_SNAPS.reduce((b, s) => (Math.abs(s - proj) < Math.abs(b - proj) ? s : b), DISC_SNAPS[0]), cur.vx * 0.2 * 1000);
        return;
      }
      // 轻点：有选项在正中时点它进入；否则点哪半边就把哪边转过来
      const x = pt(e).x, rot = DISC.rot;
      const centered = Math.abs(rot - 38) < 4 ? "import" : Math.abs(rot + 38) < 4 ? "create" : null;
      if (cur.target) {
        const k = cur.target.dataset.opt;
        if (k === centered) chooseEntry(k); else snapRot(k === "import" ? 38 : -38);
      } else if (centered && x > 110 && x < 292) chooseEntry(centered);
      else if (x < 201) snapRot(centered === "create" ? 0 : 38);
      else snapRot(centered === "import" ? 0 : -38);
    };
    wrap.addEventListener("pointerup", end);
    wrap.addEventListener("pointercancel", end);
    wrap.addEventListener("click", (e) => e.stopPropagation());
  }
  function chooseEntry(k) {
    if (k === "import") tuckDisc(() => go("spaces", "fade"));
    else { resetWorkingAlbum(); S.source = "create"; tuckDisc(() => { S.base = "home"; go("template"); }); }
  }

  /* ================= 信封滚轮（和一级菜单「空间」的信件页同一套关键帧和手感） ================= */

  const PRESET_LETTERS = [
    ["给 外婆", "老房子 · 一九九八年春", "关于院子里的花", SAGE], ["给 阿杰", "篮球场 · 二〇〇〇年夏", "那年夏天的风扇", MUS],
    ["给 小时候的自己", "课桌抽屉 · 二〇〇一年", "等你长大了再拆", TER], ["给 妈妈", "老房子 · 二〇〇三年夏", "四年以后", SAGE],
    ["给 小满", "楼下小卖部 · 二〇〇一年", "搬家以后", MUS], ["给 爸爸", "单位宿舍 · 二〇〇二年冬", "谢谢你，认真地", TER],
    ["给 阿明", "学校后门 · 二〇〇四年", "借你的那盘磁带", SAGE], ["给 小芳", "三年二班 · 二〇〇二年", "三八线", MUS],
    ["给 外公", "巷子口 · 一九九七年", "收音机里的戏", TER], ["给 表姐", "外婆家阁楼 · 一九九九年", "那本没还的书", SAGE],
    ["给 同桌", "靠窗那排 · 二〇〇三年", "毕业那天没说的", MUS], ["给 小时候的我", "老房子 · 一九九六年", "别怕打针", TER]
  ].map(([to, addr, subj, stamp]) => ({ to, addr, subj, stamp }));
  const PRESET_NAMES = new Set(PRESET_LETTERS.map((l) => l.to));
  // 预设空间进的都是那间 2009 年的卧室：照片就是房间电脑「记忆桌面」上那几张（复制在 assets/space_photos/）
  const ROOM_PHOTOS = [["photo_1", "书桌 · 下午四点的太阳"], ["photo_4", "收拾过一次，又乱了"], ["photo_5", "床边 · 那把只会一个和弦的吉他"], ["photo_6", "墙上的地图"]]
    .map(([f, name]) => ({ url: `assets/space_photos/${f}.jpg`, name }));
  let sharedMedia = [];

  const WHEEL = { p: 3, mode: 0, straight: true, letters: PRESET_LETTERS, items: [], anim: null, modeAnim: 0 };
  const KD = [-4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
  const KY = [64, 120, 176, 232, 298, 534, 592, 650, 708, 766];
  const KH = [54, 54, 54, 54, 216, 54, 54, 54, 54, 54];
  const KO = [0, 0.55, 0.85, 1, 1, 1, 0.9, 0.75, 0.5, 0];
  function key(arr, d) {
    if (d <= KD[0]) return arr === KY ? KY[0] - (KD[0] - d) * 56 : arr[0];
    if (d >= KD[KD.length - 1]) return arr === KY ? KY[KY.length - 1] + (d - KD[KD.length - 1]) * 58 : arr[arr.length - 1];
    const i = Math.floor(d) - KD[0], t = d - Math.floor(d);
    return lerp(arr[i], arr[i + 1], t);
  }
  function spaceLetters() {
    const shared = window.JRLX && window.JRLX.embedded && window.JRLX.state && Array.isArray(window.JRLX.state.letters) ? window.JRLX.state.letters : [];
    if (!shared.length) return PRESET_LETTERS;
    return shared.map((l, i) => {
      const preset = PRESET_LETTERS.find((p) => p.to === l.to);
      return { to: l.to, addr: l.addr || "", subj: l.subj || "", stamp: preset ? preset.stamp : [SAGE, MUS, TER][i % 3] };
    });
  }
  const spacePhotos = (l) => (!PRESET_NAMES.has(l.to) && sharedMedia.length ? sharedMedia : ROOM_PHOTOS);
  function letterHTML(l) {
    const year = ((l.addr.split("·")[1] || "").trim().match(/^[^年]+/) || [""])[0];
    return `
      <div class="tilt is-front">
        <div class="tf"><div class="t-zip">${"<i></i>".repeat(6)}</div><div class="t-name">${l.to}</div><div class="t-stamp" style="background:${l.stamp}"></div></div>
        <div class="tb"><div class="t-line"></div><div class="t-sub">${l.subj}</div></div>
      </div>
      <div class="flat"><div class="card"><div class="face front">
        <div class="emboss"></div><div class="zip">${[..."528000"].map((c) => `<i>${c}</i>`).join("")}</div>
        <div class="stamp"><div class="sf" style="background:${l.stamp}"></div><img src="../../assets/fig/stamp_plant.svg" alt=""><em>8分</em></div>
        <img class="postmark" src="../../assets/fig/postmark.svg" alt="">
        <div class="to">${l.to}</div><div class="addr">${l.addr}</div><div class="rule"></div><div class="from">${year ? `寄自 · ${year}` : ""}</div>
        <div class="pick-hint">轻点选这个空间 · ${spacePhotos(l).length} 张照片</div>
      </div></div></div>`;
  }
  function buildWheel() {
    WHEEL.letters = spaceLetters();
    WHEEL.p = clamp(Math.round(WHEEL.p), 0, WHEEL.letters.length - 1);
    WHEEL.mode = WHEEL.straight ? 0 : 1;
    const wheel = el("div", "wheel", V.ui);
    WHEEL.items = WHEEL.letters.map((l, i) => {
      const item = el("div", "item", wheel);
      item.dataset.i = String(i); item.innerHTML = letterHTML(l);
      return { el: item, tilt: item.querySelector(".tilt"), flat: item.querySelector(".flat") };
    });
    renderWheel();
    bindWheel(wheel);
  }
  function renderWheel() {
    const m = WHEEL.mode;
    WHEEL.items.forEach((it, i) => {
      const d = i - WHEEL.p;
      const y = lerp(key(KY, d), 403 + d * 57, m), h = lerp(key(KH, d), 54, m);
      const yB = 403 + d * 57, oB = clamp((yB - 70) / 60, 0, 1) * clamp((790 - yB) / 60, 0, 1);
      const o = lerp(key(KO, d), oB, m), f = clamp((h - 54) / 162, 0, 1);
      Object.assign(it.el.style, { top: px(y), height: px(h), opacity: String(o), zIndex: String(100 - Math.round(Math.abs(d) * 10)), visibility: o < 0.01 ? "hidden" : "visible" });
      const flatO = smooth(0.22, 0.62, f);
      it.flat.style.opacity = String(flatO);
      it.flat.style.visibility = flatO < 0.01 ? "hidden" : "visible";
      it.flat.style.transform = `perspective(800px) rotateX(${Math.acos(clamp(h / 216, 0.25, 1)) * 180 / Math.PI * (d < 0 ? -1 : 1)}deg)`;
      it.tilt.style.opacity = String(1 - smooth(0.12, 0.5, f));
      it.tilt.classList.toggle("is-front", d <= 0.001); it.tilt.classList.toggle("is-back", d > 0.001);
      it.el.classList.toggle("center", Math.abs(d) < 0.02 && m < 0.02);
    });
  }
  function scrollWheel(target, v = 0) {
    if (WHEEL.anim) WHEEL.anim.stop();
    target = clamp(Math.round(target), 0, WHEEL.items.length - 1);
    let last = Math.round(WHEEL.p);
    WHEEL.anim = spring(WHEEL.p, target, { k: 120, c: 19, v, onUpdate: (x) => { WHEEL.p = x; const r = Math.round(x); if (r !== last) { last = r; call("sound", "tick"); } renderWheel(); } });
  }
  function setStraighten(on) {
    WHEEL.straight = on;
    const btn = stageEl.querySelector(".view:not(.leaving) .straighten");
    if (btn) btn.setAttribute("aria-pressed", String(on));
    const from = WHEEL.mode, to = on ? 0 : 1, t0 = performance.now(), token = ++WHEEL.modeAnim;
    const step = (now) => {
      if (token !== WHEEL.modeAnim) return;
      const t = clamp((now - t0) / 460, 0, 1), e = 1 - Math.pow(1 - t, 3);
      WHEEL.mode = lerp(from, to, e); renderWheel();
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function bindWheel(wheel) {
    let wd = null;
    wheel.addEventListener("pointerdown", (e) => {
      wheel.setPointerCapture(e.pointerId);
      if (WHEEL.anim) WHEEL.anim.stop();
      const p = pt(e);
      wd = { y0: p.y, p0: WHEEL.p, y: p.y, t: performance.now(), v: 0, moved: false, target: e.target };
    });
    wheel.addEventListener("pointermove", (e) => {
      if (!wd) return;
      const p = pt(e), now = performance.now();
      wd.v = wd.v * 0.6 + ((p.y - wd.y) / Math.max(1, now - wd.t)) * 0.4; wd.y = p.y; wd.t = now;
      if (Math.abs(p.y - wd.y0) > 6) wd.moved = true;
      if (!wd.moved) return;
      let np = wd.p0 - (p.y - wd.y0) / 64;
      const max = WHEEL.items.length - 1;
      if (np < 0) np *= 0.3; if (np > max) np = max + (np - max) * 0.3;
      const r0 = Math.round(WHEEL.p); WHEEL.p = np; if (Math.round(np) !== r0) call("sound", "tick");
      renderWheel();
    });
    const end = () => {
      if (!wd) return;
      const w = wd; wd = null;
      if (!w.moved) { tapWheel(w.target); return; }
      const v = -w.v * 1000 / 64;   // 封/秒
      scrollWheel(WHEEL.p + v * 0.28, v);
    };
    wheel.addEventListener("pointerup", end);
    wheel.addEventListener("pointercancel", () => { wd = null; scrollWheel(WHEEL.p); });
    wheel.addEventListener("wheel", (e) => { e.preventDefault(); scrollWheel(Math.round(WHEEL.p) + Math.sign(e.deltaY)); }, { passive: false });
  }
  function tapWheel(target) {
    const itEl = target.closest && target.closest(".item");
    if (!itEl) return;
    const i = Number(itEl.dataset.i), center = Math.round(WHEEL.p);
    if (i !== center || WHEEL.mode > 0.5) { if (WHEEL.mode > 0.5) setStraighten(true); scrollWheel(i); return; }
    pickSpace();
  }
  // 选中：中间那封轻轻抬起一下，带上这个空间的照片去选模板（和「创建」一样要经过选模板再装订）
  function pickSpace() {
    if (WHEEL.mode > 0.5) { setStraighten(true); return; }
    const i = Math.round(WHEEL.p), l = WHEEL.letters[i], it = WHEEL.items[i];
    if (!l || !it || pickSpace.busy) return;
    pickSpace.busy = true;
    call("sound", "flip");
    it.flat.querySelector(".card").animate([{ transform: "none" }, { transform: "translateY(-14px) scale(1.035)", offset: 0.45 }, { transform: "translateY(-6px) scale(1.02)" }],
      { duration: 380, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
    setTimeout(() => {
      pickSpace.busy = false;
      resetWorkingAlbum();
      S.source = "import"; S.space = l.to; S.photos = spacePhotos(l).slice();
      S.template = 0;
      toast(`已带上「${l.to}」里的 ${S.photos.length} 张照片，选个模板吧`);
      go("template");
    }, 360);
  }

  /* ================= 模板轮播：跟手拖动 + 弹簧吸附 ================= */

  const CARD_STEP = 287, CARD_X = 20;          // 卡片 271 宽、间距 16；导出图四周各多 48px 阴影
  const TPL = { pos: 0, anim: null, track: null, dots: [] };
  function buildCarousel() {
    TPL.pos = S.template;
    const area = place(el("div", "tpl-area", V.ui), 0, 520, 402, 240);
    const track = el("div", "tpl-track", area);
    TEMPLATES.forEach((name, i) => {
      const card = el("img", "tpl-card", track);
      card.src = IMG(`template_card_${i + 1}`); card.alt = name; card.draggable = false;
      card.style.left = px(CARD_X + i * CARD_STEP);
    });
    TPL.track = track;
    TPL.dots = TEMPLATES.map((name, i) => {
      const d = el("button", "tpl-dot", V.ui);
      d.type = "button"; d.setAttribute("aria-label", `第 ${i + 1} 套：${name}`);
      d.addEventListener("click", (e) => { e.stopPropagation(); snapTemplate(i); });
      return d;
    });
    renderCarousel();
    let d = null;
    area.addEventListener("pointerdown", (e) => {
      area.setPointerCapture(e.pointerId);
      if (TPL.anim) TPL.anim.stop();
      const p = pt(e);
      d = { x0: p.x, x: p.x, p0: TPL.pos, t: performance.now(), v: 0, moved: false };
    });
    area.addEventListener("pointermove", (e) => {
      if (!d) return;
      const p = pt(e), now = performance.now();
      d.v = d.v * 0.6 + ((p.x - d.x) / Math.max(1, now - d.t)) * 0.4; d.x = p.x; d.t = now;
      if (Math.abs(p.x - d.x0) > 5) d.moved = true;
      if (!d.moved) return;
      let np = d.p0 - (p.x - d.x0) / CARD_STEP;
      const max = TEMPLATES.length - 1;
      if (np < 0) np *= 0.3; if (np > max) np = max + (np - max) * 0.3;   // 拉过头有阻力
      TPL.pos = np; renderCarousel();
    });
    const end = (e) => {
      if (!d) return;
      const cur = d; d = null;
      if (!cur.moved) {   // 轻点两侧露出来的卡片：转到那一套
        const x = pt(e).x;
        if (x > 335) snapTemplate(Math.round(TPL.pos) + 1); else if (x < 67) snapTemplate(Math.round(TPL.pos) - 1);
        return;
      }
      const v = -cur.v * 1000 / CARD_STEP;   // 张/秒
      snapTemplate(Math.round(TPL.pos + v * 0.18), v);
    };
    area.addEventListener("pointerup", end);
    area.addEventListener("pointercancel", () => { d = null; snapTemplate(Math.round(TPL.pos)); });
  }
  function renderCarousel() {
    if (!TPL.track) return;
    TPL.track.style.transform = `translate3d(${-TPL.pos * CARD_STEP}px, 0, 0)`;
    // 圆点：离当前位置越近越长越深（37×8 的条 ↔ 8×8 的点），跟着手指连续变化
    const ws = TPL.dots.map((_, i) => 8 + 29 * clamp(1 - Math.abs(TPL.pos - i), 0, 1));
    let x = 201 - (ws.reduce((a, b) => a + b, 0) + 5 * (ws.length - 1)) / 2;
    TPL.dots.forEach((dot, i) => {
      const t = clamp(1 - Math.abs(TPL.pos - i), 0, 1), g = Math.round(178 - (178 - 118) * t);
      Object.assign(dot.style, { left: px(x), width: px(ws[i]), background: `rgb(${g},${g},${g})` });
      x += ws[i] + 5;
    });
  }
  function snapTemplate(target, v = 0) {
    if (TPL.anim) TPL.anim.stop();
    target = clamp(target, 0, TEMPLATES.length - 1);
    if (target !== S.template) call("sound", "tick");
    S.template = target; save();
    TPL.anim = spring(TPL.pos, target, { k: 170, c: 22, v, onUpdate: (x) => { TPL.pos = x; renderCarousel(); } });
  }

  /* ================= 编辑页：一个跨页，左页 ↔ 右页 跟手滑动 ================= */

  const ED = { slide: null, anim: null, track: null };
  const ED_SLIDE_RIGHT = ED_PAGE.right - (ED_PAGE.left + ED_PAGE.w);   // 看右页时整条跨页左移的距离（-304）
  const edTarget = () => (S.page % 2 ? ED_SLIDE_RIGHT : 0);
  function buildEditorSpread() {
    const pair = S.page - (S.page % 2);
    const vp = place(el("div", "ed-viewport", V.ui), 0, ED_PAGE.y - 20, 402, ED_PAGE.h + 40);
    const track = el("div", "ed-track", vp);
    [0, 1].forEach((side) => {
      const idx = pair + side;
      const pg = place(el("div", `ed-page ${side ? "right" : "left"}`, track), ED_PAGE.left + side * ED_PAGE.w, 20, ED_PAGE.w, ED_PAGE.h);
      pg.dataset.page = String(idx);
      drawPage(pg, [0, 0, ED_PAGE.w, ED_PAGE.h], S.pages[idx] || blankPage(), { placeholder: true });
      el("span", "page-no", pg).textContent = String(idx + 1);
    });
    ED.track = track;
    const target = edTarget(), from = ED.slide == null ? target : ED.slide;
    ED.slide = from; track.style.transform = `translate3d(${from}px, 0, 0)`;
    if (from !== target) slideEditor(target);
    let d = null;
    vp.addEventListener("pointerdown", (e) => {
      vp.setPointerCapture(e.pointerId);
      if (ED.anim) ED.anim.stop();
      const p = pt(e);
      d = { x0: p.x, x: p.x, s0: ED.slide, t: performance.now(), v: 0, moved: false, target: e.target };
    });
    vp.addEventListener("pointermove", (e) => {
      if (!d) return;
      const p = pt(e), now = performance.now();
      d.v = d.v * 0.6 + ((p.x - d.x) / Math.max(1, now - d.t)) * 0.4; d.x = p.x; d.t = now;
      if (Math.abs(p.x - d.x0) > 6) d.moved = true;
      if (!d.moved) return;
      let s = d.s0 + (p.x - d.x0);
      if (s > 0) s *= 0.3; if (s < ED_SLIDE_RIGHT) s = ED_SLIDE_RIGHT + (s - ED_SLIDE_RIGHT) * 0.3;   // 拉过头有阻力
      ED.slide = s; ED.track.style.transform = `translate3d(${s}px, 0, 0)`;
    });
    const end = () => {
      if (!d) return;
      const cur = d; d = null;
      let side;
      if (cur.moved) side = ED.slide + cur.v * 140 < ED_SLIDE_RIGHT / 2 ? 1 : 0;
      else {
        const pg = cur.target.closest && cur.target.closest(".ed-page");
        if (!pg) return;
        const idx = Number(pg.dataset.page);
        if (idx === S.page) { go("materials"); return; }   // 点当前这页：打开素材
        side = idx % 2;
      }
      const next = pair + side;
      if (next !== S.page) { S.page = next; call("sound", "flip"); save(); }
      slideEditor(edTarget(), cur.moved ? cur.v * 1000 : 0);
    };
    vp.addEventListener("pointerup", end);
    vp.addEventListener("pointercancel", () => { d = null; slideEditor(edTarget()); });
  }
  function slideEditor(target, v = 0) {
    if (ED.anim) ED.anim.stop();
    ED.anim = spring(ED.slide, target, { k: 150, c: 21, v, eps: 0.05, onUpdate: (x) => { ED.slide = x; if (ED.track) ED.track.style.transform = `translate3d(${x}px, 0, 0)`; } });
  }
  function openPage(idx) {   // 总览里点了某一页：放大进入这一页
    S.page = clamp(idx, 0, S.pages.length - 1);
    ED.slide = null;
    go("editor", "page-zoom");
  }

  /* ================= 总览下方的缩略图条：按顺序列出封面和每个跨页，超出框淡化，左右划动 ================= */

  const TH = { scroll: 0, anim: null, track: null, view: null, max: 0 };
  const TH_VIEW_W = 266, TH_COVER_W = 40, TH_SPREAD_W = 72, TH_GAP = 12;
  function buildThumbStrip() {
    const box = place(el("div", "strip", V.ui), 28, 754, 343, 87);
    const vp = place(el("div", "strip-view", box), 12, 0, TH_VIEW_W, 87);
    const track = el("div", "strip-track", vp);
    const cover = place(el("button", "thumb cover", track), 0, 21, TH_COVER_W, 45);
    cover.type = "button"; cover.dataset.act = "close-book"; cover.setAttribute("aria-label", "封面（合上相册）");
    bookNode("thumb", S, cover);
    const n = spreadsCount();
    let x = TH_COVER_W + TH_GAP;
    for (let k = 1; k <= n; k++) {
      const t = place(el("button", `thumb spread${k === S.spread ? " on" : ""}`, track), x, 18, TH_SPREAD_W, 51);
      t.type = "button"; t.dataset.act = "goto-spread"; t.dataset.n = String(k); t.setAttribute("aria-label", `第 ${k} 个跨页`);
      [0, 1].forEach((side) => {
        const pg = place(el("i", "thumb-page", t), side * 36, 0, 36, 51);
        drawPage(pg, [0, 0, 36, 51], S.pages[2 * (k - 1) + side] || blankPage(), { tiny: true });
      });
      x += TH_SPREAD_W + TH_GAP;
    }
    const total = x - TH_GAP + 2;
    track.style.width = px(total);
    const add = place(el("button", "strip-add", box), 296, 27, 34, 34);
    add.type = "button"; add.dataset.act = "add-spread"; add.setAttribute("aria-label", "添加一页"); add.textContent = "+";
    Object.assign(TH, { track, view: vp, max: Math.max(0, total - TH_VIEW_W) });
    // 让当前跨页露在框里
    const ax = TH_COVER_W + TH_GAP + (S.spread - 1) * (TH_SPREAD_W + TH_GAP);
    let want = clamp(TH.scroll, 0, TH.max);
    if (ax < want) want = ax - 6; else if (ax + TH_SPREAD_W > want + TH_VIEW_W) want = ax + TH_SPREAD_W - TH_VIEW_W + 6;
    want = clamp(want, 0, TH.max);
    renderStrip();
    if (want !== TH.scroll) scrollStrip(want);
    let d = null;
    vp.addEventListener("pointerdown", (e) => {
      if (TH.anim) TH.anim.stop();
      const p = pt(e);
      d = { x0: p.x, x: p.x, s0: TH.scroll, t: performance.now(), v: 0, moved: false };
    });
    vp.addEventListener("pointermove", (e) => {
      if (!d) return;
      const p = pt(e), now = performance.now();
      d.v = d.v * 0.6 + ((p.x - d.x) / Math.max(1, now - d.t)) * 0.4; d.x = p.x; d.t = now;
      if (!d.moved && Math.abs(p.x - d.x0) > 6) { d.moved = true; vp.setPointerCapture(e.pointerId); }
      if (!d.moved) return;
      let s = d.s0 - (p.x - d.x0);
      if (s < 0) s *= 0.3; if (s > TH.max) s = TH.max + (s - TH.max) * 0.3;
      TH.scroll = s; renderStrip();
    });
    const end = () => {
      if (!d) return;
      const cur = d; d = null;
      if (!cur.moved) return;
      swallowClick = true; setTimeout(() => { swallowClick = false; }, 0);
      scrollStrip(clamp(TH.scroll - cur.v * 220, 0, TH.max), -cur.v * 1000);
    };
    vp.addEventListener("pointerup", end);
    vp.addEventListener("pointercancel", end);
  }
  function renderStrip() {
    if (!TH.track) return;
    TH.track.style.transform = `translate3d(${-TH.scroll}px, 0, 0)`;
    TH.view.classList.toggle("fade-l", TH.scroll > 1);
    TH.view.classList.toggle("fade-r", TH.scroll < TH.max - 1);
  }
  function scrollStrip(target, v = 0) {
    if (TH.anim) TH.anim.stop();
    TH.anim = spring(TH.scroll, target, { k: 120, c: 20, v, eps: 0.05, onUpdate: (x) => { TH.scroll = x; renderStrip(); } });
  }

  /* ================= 书本 / 页面的过渡动画 ================= */

  function flyLayer() { const f = document.createElement("div"); f.className = "fly"; stageEl.appendChild(f); return f; }
  // 从 a 矩形飞到 b 矩形的 transform（元素本身摆在 b）
  const fromRect = (a, b, extra = "") => `translate(${a[0] - b[0]}px, ${a[1] - b[1]}px) scale(${a[2] / b[2]}, ${a[3] / b[3]}) ${extra}`;
  function editorPageNode(idx) {   // 编辑页里那一页的样子（放大 / 缩小过场用）
    const side = idx % 2, r = [side ? ED_PAGE.right : ED_PAGE.left, ED_PAGE.y, ED_PAGE.w, ED_PAGE.h];
    const node = place(document.createElement("div"), ...r);
    node.className = `ed-page ${side ? "right" : "left"} fly-page`;
    drawPage(node, [0, 0, ED_PAGE.w, ED_PAGE.h], S.pages[idx] || blankPage(), { placeholder: true });
    return { node, r };
  }
  const previewPageRect = (idx) => (idx % 2 ? PAGE.preview.r2 : PAGE.preview.r);
  const FLIGHTS = {
    // 书架 → 合上的相册：书从书架上被拿下来，飞到地板上放大；书架虚化淡出
    "shelf-out"(old, view) {
      stageEl.appendChild(view);
      view.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 260, easing: "ease-out", fill: "backwards" });
      if (old) { old.animate([{ filter: "none", opacity: 1 }, { filter: "blur(8px) brightness(.9)", opacity: 0.2 }], { duration: 520, easing: "ease-in", fill: "forwards" }); setTimeout(() => old.remove(), 700); }
      const fly = flyLayer(), book = bookNode(BOOKS.big.r, S, fly);
      book.classList.add("flying");
      const a = shelfRect(S.albumIndex), b = BOOKS.big.r;
      book.animate([
        { transform: fromRect(a, b) },
        { transform: fromRect([a[0] - 6, a[1] - 14, a[2] * 1.1, a[3] * 1.1], b, "rotate(-3deg)"), offset: 0.22 },
        { transform: "translate(0, -10px) rotate(1deg)", offset: 0.82 },
        { transform: "none" }
      ], { duration: 760, easing: "cubic-bezier(.3,.7,.2,1)" }).finished.then(() => fly.remove());
      call("sound", "unfold");
    },
    // 合上的相册 / 总览 → 书架：书飞回书架上
    "shelf-in"(old, view) {
      stageEl.insertBefore(view, old || null);
      view.animate([{ opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "none" }], { duration: 520, easing: "ease-out" });
      const target = view.querySelectorAll(".book")[S.albumIndex];   // home() 按 S.albums 顺序画书，DOM 顺序跟下标一致
      if (target) target.style.visibility = "hidden";
      if (old) { old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: "ease-in", fill: "forwards" }); setTimeout(() => old.remove(), 260); }
      const fly = flyLayer(), book = bookNode(BOOKS.big.r, S, fly);
      book.classList.add("flying");
      const a = BOOKS.big.r, b = shelfRect(S.albumIndex);
      book.animate([
        { transform: fromRect(a, b), opacity: 0.4 },
        { transform: fromRect(a, b), opacity: 1, offset: 0.12 },
        { transform: fromRect([b[0] - 6, b[1] - 16, b[2] * 1.1, b[3] * 1.1], b, "rotate(-3deg)"), offset: 0.75 },
        { transform: "none" }
      ], { duration: 720, easing: "cubic-bezier(.3,.7,.2,1)" }).finished.then(() => { fly.remove(); if (target) target.style.visibility = ""; });
    },
    // 合上 → 打开：封皮先转到侧面，视角同时滑到跨页中心，再把封底翻过去落定成左页——比纯旋转更像「翻开」而不是「消失」
    "book-open"(old, view) {
      stageEl.appendChild(view);
      view.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360, delay: 160, easing: "ease-out", fill: "backwards" });
      if (old) setTimeout(() => old.remove(), 540);
      const fly = flyLayer(), book = bookNode(BOOKS.big.r, S, fly);
      book.classList.add("flying", "hinge");
      book.animate([
        { transform: "perspective(1300px) rotateY(0) scale(1)", opacity: 1, offset: 0 },
        { transform: "perspective(1300px) rotateY(-55deg) scale(1.02)", opacity: 1, offset: 0.38 },
        { transform: "perspective(1300px) translate(70px,16px) rotateY(-120deg) scale(.82,.86)", opacity: 0.5, offset: 0.74 },
        { transform: "perspective(1300px) translate(105px,22px) rotateY(-150deg) scale(.708,.797)", opacity: 0, offset: 1 }
      ], { duration: 640, easing: "cubic-bezier(.3,0,.2,1)" }).finished.then(() => fly.remove());
      call("sound", "flip");
    },
    // 打开 → 合上（反向播放同一组关键帧）
    "book-close"(old, view) {
      stageEl.appendChild(view);
      view.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out" });
      if (old) setTimeout(() => old.remove(), 320);
      const fly = flyLayer(), book = bookNode(BOOKS.big.r, S, fly);
      book.classList.add("flying", "hinge");
      book.animate([
        { transform: "perspective(1300px) translate(105px,22px) rotateY(-150deg) scale(.708,.797)", opacity: 0, offset: 0 },
        { transform: "perspective(1300px) translate(70px,16px) rotateY(-120deg) scale(.82,.86)", opacity: 0.5, offset: 0.3 },
        { transform: "perspective(1300px) rotateY(-55deg) scale(1.02)", opacity: 1, offset: 0.68 },
        { transform: "perspective(1300px) rotateY(0) scale(1)", opacity: 1, offset: 1 }
      ], { duration: 560, easing: "cubic-bezier(.4,0,.2,1)" }).finished.then(() => fly.remove());
      call("sound", "flip");
    },
    // 总览 → 编辑：点中的那一页放大成编辑页
    "page-zoom"(old, view) {
      stageEl.appendChild(view);
      view.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 300, easing: "ease-out", fill: "backwards" });
      if (old) setTimeout(() => old.remove(), 520);
      const fly = flyLayer(), { node, r } = editorPageNode(S.page);
      fly.appendChild(node);
      node.animate([{ transform: fromRect(previewPageRect(S.page), r) }, { transform: "none" }], { duration: 440, easing: "cubic-bezier(.2,.8,.2,1)" })
        .finished.then(() => fly.remove());
    },
    // 编辑 → 总览：这一页缩回跨页里
    "page-unzoom"(old, view) {
      stageEl.appendChild(view);
      view.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out" });
      if (old) setTimeout(() => old.remove(), 280);
      const fly = flyLayer(), { node, r } = editorPageNode(S.page);
      fly.appendChild(node);
      node.animate([{ transform: "none", opacity: 1 }, { transform: fromRect(previewPageRect(S.page), r), opacity: 1, offset: 0.85 }, { transform: fromRect(previewPageRect(S.page), r), opacity: 0 }],
        { duration: 440, easing: "cubic-bezier(.2,.8,.2,1)" }).finished.then(() => fly.remove());
    }
  };

  /* ================= 渲染与转场 ================= */

  let renderToken = 0;
  async function render(transition) {
    const token = ++renderToken;
    call("tabbar", S.stage === "home");
    const view = document.createElement("div");
    view.className = "view";
    V = { el: view, bg: "", shot: "", after: null };
    V.bgEl = document.createElement("div"); V.bgEl.className = "bg";
    V.img = document.createElement("img"); V.img.className = "shot"; V.img.alt = ""; V.img.draggable = false;
    V.deco = document.createElement("div"); V.deco.className = "deco";
    V.ui = document.createElement("div"); V.ui.className = "ui";
    maskHoles();   // 默认：只挖掉状态栏；各屏可以在 BUILD 里再调用 maskHoles(...) 覆盖，一并挖掉自己画死的按钮/书
    (BUILD[S.stage] || BUILD.home)();
    if (!V.bg) V.bg = bgStyle();   // 默认背景永远跟着背景设置走（打开相册后的各个面板也一样）
    V.bgEl.style.background = V.bg; view.appendChild(V.bgEl);
    if (V.shot) { V.img.src = V.shot; view.append(V.img); }
    view.append(V.deco, V.ui);
    const built = V; V = null;
    await Promise.all(Array.from(view.querySelectorAll("img")).map((img) => (img.decode ? img.decode().catch(() => {}) : null)));
    if (token !== renderToken) return;
    mount(built, transition);
    if (built.after) built.after();
  }

  // 面板弹起 / 收起用的克隆层：只截面板那一截，底下多垫一条面板色，冲过头时不露缝
  function panelClone(source, sheet) {
    const fx = source.cloneNode(true);
    fx.className = "fx";
    fx.querySelectorAll(".ui").forEach((n) => n.remove());
    fx.style.clipPath = `inset(${sheet.top}px 0 -40px 0)`;
    const pad = document.createElement("i");
    pad.className = "fx-pad"; pad.style.background = sheet.color;
    fx.appendChild(pad);
    return fx;
  }

  let sheetLeaving = "";
  function mount(built, transition) {
    // 保险起见：不管这次过场是不是「飞」的那几种，先把上一趟可能没来得及自己清掉的 .fly 清空——
    // 之前只在「飞」过场里清，如果上一趟还没放完就被普通面板过场打断，画死的大图会卡在最上层挡住后面所有屏
    stageEl.querySelectorAll(".fly").forEach((n) => n.remove());
    const olds = [...stageEl.querySelectorAll(".view:not(.leaving)")];
    const old = olds.shift();
    olds.forEach((n) => n.remove());   // 正常情况下不该有第二个没标记 leaving 的旧屏；真出现了也直接丢掉，别让它变成永久卡住的幽灵
    stageEl.querySelectorAll(".fx:not(.dragging)").forEach((n) => n.remove());
    const view = built.el;
    const leave = (ms) => { if (!old) return; old.classList.add("leaving"); setTimeout(() => old.remove(), ms); };
    if (FLIGHTS[transition]) {
      if (old) old.classList.add("leaving");
      FLIGHTS[transition](old, view);
      return;
    }

    if (transition === "sheet-up") {          // 面板从屏幕下面弹上来（冲过头一点再落稳），上半屏淡入
      const sheet = SHEETS[S.stage];
      const fx = panelClone(view, sheet);
      view.style.clipPath = `inset(0 0 ${874 - sheet.top}px 0)`;
      stageEl.append(view, fx);
      view.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: "ease-out" });
      const travel = 874 - sheet.top + 40;
      fx.animate([{ transform: `translateY(${travel}px)` }, { transform: "translateY(-14px)", offset: 0.72 }, { transform: "translateY(3px)", offset: 0.88 }, { transform: "none" }],
        { duration: 640, easing: "cubic-bezier(.22,.7,.3,1)" }).finished.then(() => { view.style.clipPath = ""; fx.remove(); });
      if (old) old.remove();
      return;
    }
    if (transition === "sheet-down" || transition === "drag-down") {   // 面板往下滑走，露出底下那一屏
      const sheet = SHEETS[sheetLeaving] || { top: 420, color: "#fff" };
      stageEl.insertBefore(view, old || null);
      if (old) {
        old.style.clipPath = `inset(0 0 ${874 - sheet.top}px 0)`;
        old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: "ease-in" });
        leave(300);
      }
      const fx = transition === "drag-down" ? stageEl.querySelector(".fx.dragging") : old && panelClone(old, sheet);
      if (fx) {
        if (!fx.parentNode) stageEl.appendChild(fx);
        const from = new DOMMatrix(getComputedStyle(fx).transform).m42 || 0;
        fx.animate([{ transform: `translateY(${from}px)` }, { transform: `translateY(${874 - sheet.top + 60}px)` }], { duration: transition === "drag-down" ? 240 : 380, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" })
          .finished.then(() => fx.remove());
      }
      return;
    }
    stageEl.appendChild(view);
    if (transition === "fade") {               // 换页：和「空间」一样 300ms 淡入
      view.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out" });
      leave(300);
    } else if (old) old.remove();
  }

  /* ================= 导航 ================= */

  function go(stage, transition) {
    clearTimeout(go.binding);
    S.palette = "";
    const from = S.stage;
    if (isSheet(stage) && !isSheet(from)) S.base = from === "entry" ? "home" : from;
    S.stage = stage;
    const t = transition || (isSheet(stage) ? (isSheet(from) ? "fade" : "sheet-up") : "fade");
    if (stage !== "entry") call("sound", "tap");
    render(t); save();
    if (stage === "binding") go.binding = setTimeout(() => go("appearance", "fade"), 2200);
  }
  function closeSheet(transition) {
    if (!isSheet(S.stage)) return;
    sheetLeaving = S.stage;
    S.palette = "";
    S.stage = S.base || "home";
    call("sound", "tap");
    render(transition || "sheet-down"); save();
  }

  // 返回：一律回上一级；所有改动随时保存，不再弹确认框
  function back() {
    if (S.palette) { S.palette = ""; render("none"); return; }
    switch (S.stage) {
      case "entry": tuckDisc(); break;
      case "spaces": go("entry", "fade"); break;
      case "photos": go("template"); break;
      case "appearance": save(); go("home", "shelf-in"); toast("已保存，放回书架了"); break;
      case "preview": go("appearance", "book-close"); break;
      case "editor": go("preview", "page-unzoom"); break;
      case "binding": case "home": break;
      default: if (isSheet(S.stage)) closeSheet();
    }
  }

  function turnPage(d) {
    const next = S.spread + d;
    if (next < 1 || next > spreadsCount()) { toast(next < 1 ? "已经是第一页" : "已经是最后一页"); return; }
    S.spread = next; call("sound", "flip"); render("fade");
  }

  /* ================= 撤销 / 重做（整本相册的页面内容） ================= */

  const snap = () => JSON.stringify(S.pages);
  function snapshot() { history.undo.push(snap()); if (history.undo.length > 30) history.undo.shift(); history.redo.length = 0; }
  function restore(from, to) {
    if (!from.length) { toast(from === history.undo ? "没有可以撤销的操作" : "没有可以重做的操作"); return; }
    to.push(snap());
    S.pages = JSON.parse(from.pop());
    render("none"); save();
  }

  /* ================= 贴纸：从素材网格设计稿里抠出图标 ================= */

  const stickerCache = new Map();
  function stickerURL(s) {
    const key = `${s.tab}-${s.tile}`;
    if (stickerCache.has(key)) return stickerCache.get(key);
    stickerCache.set(key, "");
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"), size = 60;
      c.width = c.height = size * 2;
      const g = c.getContext("2d");
      const tx = TILE_X[s.tile % 4] + 41 - size / 2, ty = TILE_Y[Math.floor(s.tile / 4)] + 40 - size / 2;
      g.drawImage(img, tx, ty, size, size, 0, 0, size * 2, size * 2);
      try {
        const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
        const r0 = p[0], g0 = p[1], b0 = p[2];        // 角上是素材格的灰底，抠掉
        for (let i = 0; i < p.length; i += 4) {
          const diff = Math.abs(p[i] - r0) + Math.abs(p[i + 1] - g0) + Math.abs(p[i + 2] - b0);
          if (diff < 26) p[i + 3] = 0; else if (diff < 60) p[i + 3] = Math.round(255 * (diff - 26) / 34);
        }
        g.putImageData(d, 0, 0);
      } catch (e) { /* file:// 下取不到像素，就带底色用 */ }
      stickerCache.set(key, c.toDataURL("image/png"));
      render("none");
    };
    img.src = IMG(`materials_${s.tab}`);
    return "";
  }

  /* ================= 文件选择 ================= */

  let pickPurpose = "photos", pickSlot = -1;
  function choose(purpose, slot) {
    pickPurpose = purpose; pickSlot = slot == null ? -1 : slot;
    picker.value = "";
    picker.multiple = purpose === "photos";
    picker.click();
  }
  const readFile = (file) => new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve({ url: String(r.result), name: file.name });
    r.onerror = () => resolve(null);
    r.readAsDataURL(file);
  });
  picker.addEventListener("change", async () => {
    const files = Array.from(picker.files || []).filter((f) => f.type.startsWith("image/"));
    const got = (await Promise.all(files.map(readFile))).filter(Boolean);
    if (!got.length) return;
    if (pickPurpose === "cover") { S.cover.photo = got[0].url; toast("封面照片已换上"); }
    else if (pickPurpose === "background") { S.bg = { ...S.bg, kind: "photo", photo: got[0].url }; toast("背景已换成你的图片"); }
    else if (pickPurpose === "slot") { snapshot(); curPage().photo = got[0].url; toast("已换上这一页的照片"); }
    else {
      S.photos = S.photos.concat(got);
      if (S.made && S.stage !== "photos") {   // 编辑时导入的照片：先找空页放，不够就加页
        snapshot();
        let i = S.page;
        got.forEach((p) => {
          while (i < S.pages.length && S.pages[i].photo) i++;
          while (S.pages.length <= i) S.pages.push(blankPage());
          S.pages[i].photo = p.url; i++;
        });
        if (S.pages.length % 2) S.pages.push(blankPage());
      }
      toast(`已添加 ${got.length} 张照片`);
    }
    render("none"); save();
  });

  /* ================= 导出 ================= */

  const loadImage = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
  function drawCover(g, img, x, y, w, h) {
    const sr = img.naturalWidth / img.naturalHeight, dr = w / h;
    let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
    if (sr > dr) { sw = sh * dr; sx = (img.naturalWidth - sw) / 2; } else { sh = sw / dr; sy = (img.naturalHeight - sh) / 2; }
    g.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }
  // 导出：总览页的空白跨页做底，按页画上背景色 / 照片（带描边、抠图）/ 贴纸 / 文字（和屏幕上 drawPage 同一套排版）
  async function paintPage(g, rect, page, k) {
    const [x, y, w, h] = rect.map((v) => v * k), L = page.photo ? LAYOUT.photo : LAYOUT.plain, s = rect[2] / 335;
    if (page.bgColorIndex > 0) {
      g.fillStyle = page.bgColorIndex === 5 && page.bgColorCustom ? page.bgColorCustom : C.peSwatches[page.bgColorIndex];
      g.fillRect(x, y, w, h);
    }
    if (page.photo || page.stickers.length || page.text.trim()) {
      const p = PAGE.preview.patch; g.fillStyle = C.paper; g.fillRect(x + p[0] * w, y + p[1] * h, p[2] * w, p[3] * h);
    }
    if (page.photo) {
      const r = L.photo, img = await loadImage(page.photo), rx = x + r[0] * w, ry = y + r[1] * h, rw = r[2] * w, rh = r[3] * h;
      if (page.cutout) {
        g.save(); g.beginPath(); g.ellipse(rx + rw / 2, ry + rh / 2, rw * 0.47, rh * 0.44, 0, 0, Math.PI * 2); g.clip();
        drawCover(g, img, rx, ry, rw, rh); g.restore();
      } else drawCover(g, img, rx, ry, rw, rh);
      if (page.strokeWidth) {
        g.strokeStyle = C.strokePalette[page.strokeColorIndex] || "#333"; g.lineWidth = Math.max(1, STROKE_PX[page.strokeWidth] * s * k);
        g.strokeRect(rx, ry, rw, rh);
      }
    }
    for (const st of page.stickers) {
      const url = stickerCache.get(`${st.tab}-${st.tile}`);
      if (!url) continue;
      const size = Math.max(18, 58 * s) * k;
      g.drawImage(await loadImage(url), x + st.x * w - size / 2, y + st.y * h - size / 2, size, size);
    }
    if (page.text.trim()) {
      const f = FONTS[S.text.font] || FONTS[0], fs = Math.max(7, TEXT_SIZES[S.text.size] * s) * k, r = L.text;
      g.font = `${S.text.italic ? "italic " : ""}${S.text.bold ? 700 : f.weight} ${fs}px ${f.css}`;
      g.fillStyle = C.textColors[S.text.color]; g.textBaseline = "middle";
      g.textAlign = S.text.align === 1 ? "center" : "left";
      const tx = S.text.align === 1 ? x + (r[0] + r[2] / 2) * w : x + (r[0] + 0.02) * w, cy = y + (r[1] + r[3] / 2) * h;
      wrapLines(g, page.text, r[2] * w).forEach((line, i, all) => g.fillText(line, tx, cy + (i - (all.length - 1) / 2) * fs * 1.35));
    }
  }
  async function spreadCanvas(spread, half) {
    const k = 3, [bx, by, bw, bh] = BOOK, w = half ? Math.round(bw / 2) : bw, L = 2 * (spread - 1);
    const c = document.createElement("canvas"); c.width = w * k; c.height = bh * k;
    const g = c.getContext("2d");
    g.drawImage(await loadImage(IMG("preview_1")), bx, by, w, bh, 0, 0, w * k, bh * k);
    const local = (r) => [r[0] - bx, r[1] - by, r[2], r[3]];
    await paintPage(g, local(PAGE.preview.r), S.pages[L] || blankPage(), k);
    if (!half) await paintPage(g, local(PAGE.preview.r2), S.pages[L + 1] || blankPage(), k);
    return c;
  }
  function wrapLines(g, text, maxW) {
    const lines = [];
    text.split("\n").forEach((para) => {
      let line = "";
      for (const ch of para) { if (g.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch; } else line += ch; }
      lines.push(line);
    });
    return lines;
  }
  function download(canvas, name) {
    canvas.toBlob((blob) => {
      if (!blob) { toast("导出失败，请再试一次"); return; }
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast("JPG 已开始下载");
    }, "image/jpeg", 0.92);
  }
  async function exportJpg(mode) {
    const spread = S.base === "preview" ? S.spread : 1;
    try { download(await spreadCanvas(spread, mode === "page"), `旧日来信-相册-${mode === "page" ? "单页" : "跨页"}${spread}.jpg`); }
    catch (e) { toast("页面还在载入，请稍后再试"); }
  }
  async function exportPdf() {
    const win = window.open("", "_blank");
    if (!win) { toast("浏览器拦截了新窗口，请允许弹出窗口后再试"); return; }
    win.document.write("<p style='font:14px sans-serif;padding:20px'>正在生成…</p>");
    const pages = [];
    for (let n = 1; n <= spreadsCount(); n++) pages.push((await spreadCanvas(n, false)).toDataURL("image/jpeg", 0.92));
    win.document.open();
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>旧日来信-相册</title><style>@page{size:334mm 235mm;margin:0}body{margin:0}img{display:block;width:100vw;height:auto;page-break-after:always}</style></head><body>${pages.map((p) => `<img src="${p}">`).join("")}<script>onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`);
    win.document.close();
  }

  /* ================= 交互 ================= */

  function pt(e) {   // 屏幕坐标 → 402×874 设计稿坐标（独立预览时 .screen 被缩放过）
    const r = screenEl.getBoundingClientRect(), k = r.width / 402;
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  }

  function act(name, d) {
    const i = Number(d.i);
    switch (name) {
      case "back": back(); break;
      case "resume": { const idx = Number(d.i); if (S.albums[idx]) { loadAlbum(idx); go("appearance", "shelf-out"); } break; }
      case "open-book": S.spread = 1; go("preview", "book-open"); break;
      case "close-book": go("appearance", "book-close"); break;
      case "noop": break;
      case "open-entry": go("entry", "none"); break;
      case "close-sheet": closeSheet(); break;
      case "straighten": call("sound", "tick"); setStraighten(!WHEEL.straight); break;
      case "pick-space": pickSpace(); break;
      case "pick-template":   // 从空间导入的已经带着照片，直接装订；空白新建的先去选照片
        if (TPL.anim) TPL.anim.stop();
        S.template = clamp(Math.round(TPL.pos), 0, TEMPLATES.length - 1);
        if (S.source === "import" && S.photos.length) { toast(`用「${TEMPLATES[S.template]}」装订 ${S.photos.length} 张照片`); begin(); } else go("photos");
        break;
      case "add-photos": choose("photos"); break;
      case "photo-slot":   // 图片处理「已选图片」：点哪张就把哪张放到当前页
        if (S.photos[i]) { snapshot(); curPage().photo = S.photos[i].url; render("none"); save(); toast("已放到当前页"); } else choose("photos");
        break;
      case "to-binding": if (!S.photos.length) toast("没选照片，先用示例照片装订"); begin(); break;
      case "open-cover": go("cover"); break;
      case "open-background": go("background"); break;
      case "open-export": go("export"); break;
      case "cover-color": S.cover.color = i; render("none"); save(); break;
      case "bg-color": S.bg = { ...S.bg, kind: "swatch", index: i }; render("none"); save(); break;
      case "bg-card": S.bg = { ...S.bg, kind: "card", index: i }; render("none"); save(); break;
      case "cover-pos": S.cover.pos = i; render("none"); save(); break;
      case "upload-cover": choose("cover"); break;
      case "upload-background": choose("background"); break;
      case "open-palette": S.palette = d.palette; render("none"); break;
      case "close-palette": S.palette = ""; render("none"); break;
      case "palette-color":
        if (d.palette === "cover") { S.cover.custom = C.palette[i]; S.cover.color = 5; }
        else if (d.palette === "background") S.bg = { ...S.bg, kind: "swatch", index: 6, custom: C.palette[i] };
        else { snapshot(); const p = curPage(); p.bgColorIndex = 5; p.bgColorCustom = C.palette[i]; }
        S.palette = ""; render("none"); save(); break;
      case "to-preview": S.spread = Math.floor(S.page / 2) + 1; go("preview", "page-unzoom"); break;
      case "open-materials": go("materials"); break;
      case "open-photo-edit": go("photoEdit"); break;
      case "open-text-edit": go("textEdit"); break;
      case "undo": restore(history.undo, history.redo); break;
      case "redo": restore(history.redo, history.undo); break;
      case "search": toast("素材搜索在演示版里还没接入"); break;
      case "material-tab": S.materialTab = i; render("none"); save(); break;
      case "add-sticker": {
        snapshot();
        const page = curPage(), spots = (page.photo ? LAYOUT.photo : LAYOUT.plain).spots, spot = spots[page.stickers.length % spots.length];
        page.stickers = page.stickers.concat({ tab: S.materialTab, tile: Number(d.tile), x: spot[0], y: spot[1] }).slice(-16);
        render("none"); save(); toast("已贴到当前页"); break;
      }
      case "pe-color": snapshot(); curPage().bgColorIndex = i; curPage().bgColorCustom = ""; render("none"); save(); break;
      case "stroke-width": snapshot(); curPage().strokeWidth = i; render("none"); save(); break;
      case "stroke-color": snapshot(); curPage().strokeColorIndex = i; render("none"); save(); break;
      case "cutout": { snapshot(); const p = curPage(); p.cutout = !p.cutout; render("none"); save(); toast(p.cutout ? "已抠图" : "已还原原图"); break; }
      case "select-page": { const pair = S.page - (S.page % 2), want = pair + Number(d.side); if (want !== S.page) { S.page = want; call("sound", "tick"); render("none"); save(); } break; }
      case "text-tab": S.text.tab = i; render("none"); save(); break;
      case "text-font": S.text.font = i; render("none"); save(); break;
      case "text-color": S.text.color = i; render("none"); save(); break;
      case "text-size": S.text.size = i; render("none"); save(); break;
      case "text-format":
        if (i < 2) S.text.align = i; else if (i === 2) S.text.bold = !S.text.bold; else S.text.italic = !S.text.italic;
        render("none"); save(); break;
      case "turn": turnPage(Number(d.d)); break;
      case "goto-spread": if (Number(d.n) !== S.spread) { S.spread = Number(d.n); call("sound", "flip"); render("fade"); } break;
      case "add-spread": S.pages.push(blankPage(), blankPage()); S.spread = spreadsCount(); call("sound", "flip"); render("fade"); save(); toast(`已添加空白页，现在共 ${spreadsCount()} 页`); break;
      case "finish": S.made = true; save(); go("home", "shelf-in"); toast("相册已放回书架，点它可以继续编辑"); break;
      case "export-jpg": exportJpg(d.mode); break;
      case "export-pdf": exportPdf(); break;
      case "export-video": toast("网页演示暂不生成 MP4，可以先导出 JPG 或 PDF"); break;
      default: break;
    }
  }
  // 装订：照片按顺序一页一张排进相册，多出来的自动加页
  function begin() {
    S.made = true; S.spread = 1; S.page = 0; ED.slide = null; history.undo.length = history.redo.length = 0;
    S.pages = layoutPages(S.photos.length ? S.photos : [{ url: IMG("cover_photo") }]);
    go("binding", "fade"); call("sound", "unfold");
  }

  function refreshText() {   // 打字时只改页面上的文字，不重建整屏（不然输入框会失焦）
    const page = curPage(), hasContent = !!(page.photo || page.stickers.length || page.text.trim());
    stageEl.querySelectorAll('.view:not(.leaving) [data-role="page-text"]').forEach((n) => { styleText(n, Number(n.dataset.k), page.text, !!n.dataset.tiny); n.hidden = !page.text.trim(); });
    stageEl.querySelectorAll('.view:not(.leaving) [data-role="page-patch"]').forEach((n) => { n.hidden = !hasContent; });
  }

  let swallowClick = false;
  stageEl.addEventListener("click", (e) => {
    if (swallowClick) { swallowClick = false; e.stopPropagation(); return; }
    const b = e.target.closest("[data-act]");
    if (!b || !b.dataset.act || b.closest(".leaving")) return;
    act(b.dataset.act, b.dataset);
  });

  // 面板跟手下拉：按住面板顶部往下拖，面板跟着走；拖过一段或甩下去就收起，不然弹回原位
  let drag = null;
  stageEl.addEventListener("pointerdown", (e) => {
    const sheet = SHEETS[S.stage];
    drag = null;
    if (!sheet || S.palette || e.target.closest("textarea, .slider")) return;
    const p = pt(e);
    if (p.y < sheet.top - 10 || p.y > sheet.top + 70) return;
    drag = { y0: p.y, y: p.y, t: performance.now(), v: 0, fx: null, sheet, pointer: e.pointerId };
  });
  stageEl.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = pt(e), now = performance.now();
    drag.v = drag.v * 0.6 + ((p.y - drag.y) / Math.max(1, now - drag.t)) * 0.4; drag.y = p.y; drag.t = now;
    const dy = p.y - drag.y0;
    if (!drag.fx) {
      if (dy < 8) return;
      const view = stageEl.querySelector(".view:not(.leaving)");
      if (!view) return;
      drag.view = view;
      drag.fx = panelClone(view, drag.sheet);
      drag.fx.classList.add("dragging");
      view.style.clipPath = `inset(0 0 ${874 - drag.sheet.top}px 0)`;
      stageEl.appendChild(drag.fx);
    }
    drag.fx.style.transform = `translateY(${Math.max(-6, dy < 0 ? dy * 0.3 : dy)}px)`;
  });
  const endDrag = () => {
    if (!drag) return;
    const cur = drag; drag = null;
    if (!cur.fx) return;
    swallowClick = true;
    setTimeout(() => { swallowClick = false; }, 0);
    if (cur.y - cur.y0 > 90 || cur.v > 0.6) { closeSheet("drag-down"); return; }
    const from = cur.y - cur.y0;
    cur.fx.animate([{ transform: `translateY(${from}px)` }, { transform: "translateY(-6px)", offset: 0.7 }, { transform: "none" }], { duration: 300, easing: "cubic-bezier(.2,.8,.2,1)" })
      .finished.then(() => { cur.fx.remove(); cur.view.style.clipPath = ""; });
    cur.fx.style.transform = "";
  };
  stageEl.addEventListener("pointerup", endDrag);
  stageEl.addEventListener("pointercancel", endDrag);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") back();
  });

  /* ================= 启动 ================= */

  load();
  // 预载所有画面，切换时不闪
  ["home", "spaces_pick", "template_1", "template_card_1", "template_card_2", "template_card_3", "book_cover", "cover_photo", "photos", "binding",
    "appearance_fg", "cover_fg", "cover_fg_right", "cover_palette_fg", "bg_fg", "bg_palette_fg", "bg_wood", "bg_polka", "bg_water",
    "editor", "materials_0", "materials_1", "materials_2", "materials_3", "materials_4", "photo_edit",
    "text_font", "text_color", "text_size", "text_format", "preview_1", "export", "bg_doodle", "bg_grass", "bg_pink", "bg_kraft"
  ].forEach((n) => { const i = new Image(); i.src = IMG(n); });

  call("ready", (state) => {
    const media = (state && Array.isArray(state.media) ? state.media : []).filter((m) => m && m.url && String(m.type || "").startsWith("image/"));
    sharedMedia = media.map((m) => ({ url: m.url, name: m.name || "空间里的照片" }));
    const known = new Set(S.photos.map((p) => p.url));
    media.forEach((m) => { if (!known.has(m.url)) S.photos.push({ url: m.url, name: m.name || "空间里的照片" }); });
    render("none");
  });
  call("onEnter", () => { call("tabbar", S.stage === "home"); });
  render("none");
})();
