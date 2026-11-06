/* 旧日来信 · 构建数字分身的过程页（表单「构建记忆空间」→ 信封之间）
   录屏真抽帧；配了 AI 就真识别、真生成人设，否则用示例人设「阿哲」。
   按「不做清单」：不放进度条和百分比，只用一句句字幕说正在发生什么。 */
window.JRLXTwinBuild = (() => {
  'use strict';
  const T = window.JRLXTwin;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  async function run(host, { files = [], name = '', relation = '', sound = null } = {}) {
    const snd = k => { try { sound && sound[k] && sound[k](); } catch (e) {} };
    const st = await T.aiStatus();
    let list = files.filter(f => /^(video|image)\//.test(f.type)).slice(0, 6), sample = false;
    if (!list.length) {
      sample = true;
      const b = await (await fetch(T.SAMPLE_URL)).blob();
      list = [new File([b], 'sample_chat.mp4', { type: 'video/mp4' })];
    }
    let useAI = !!(st.vision && st.chat);
    let who = useAI ? (name || 'TA') : T.PRESET.name;

    const el = document.createElement('div');
    el.className = 'tw';
    el.innerHTML = `
      <p class="tw-k">数字分身</p>
      <h2 class="tw-h">正在听 <b>${esc(who)}</b> 说话</h2>
      <p class="tw-cap"></p>
      <div class="tw-strip"><div class="tw-film"></div></div>
      <div class="tw-talk"></div>
      <div class="tw-traits"></div>
      <div class="tw-card" hidden></div>
      <p class="tw-mode">${esc(useAI ? `AI 识别 · ${st.vision_model} / ${st.chat_model}`
        : st.chat ? `读录屏没接 AI，用示例人设「${T.PRESET.name}」· 回话用 ${st.chat_model}`
        : `示例模式 · 没有连接 AI，用的是示例人设「${T.PRESET.name}」`)}</p>`;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    const $ = s => el.querySelector(s);
    const cap = t => { const c = $('.tw-cap'); c.classList.remove('in'); void c.offsetWidth; c.textContent = t; c.classList.add('in'); };
    const setMode = t => { $('.tw-mode').textContent = t; };

    // ---------- ① 抽关键帧 ----------
    cap(sample ? '没有上传聊天记录，先用一段示例录屏' : '在看你们的聊天…');
    const film = $('.tw-film'), thumbs = [];
    const addThumb = f => {
      const i = document.createElement('img'); i.src = f.dataUrl; i.alt = '';
      film.appendChild(i); thumbs.push(i); snd('tick');
      film.style.transform = `translateX(${-Math.max(0, thumbs.length - 5) * 66}px)`;
    };
    const t0 = performance.now();
    let frames = [];
    try {
      for (const f of list) frames.push(...await T.extractFrames(f, { max: useAI ? 10 : 8, onFrame: addThumb }));
    } catch (e) { cap(e.message || '这段录屏读不了'); await sleep(1400); }
    frames = frames.slice(0, 12);
    await sleep(Math.max(0, 1800 - (performance.now() - t0)));

    // 扫描框在缩略图上一张张走过去
    let scanI = 0;
    const scan = setInterval(() => {
      thumbs.forEach((t, k) => t.classList.toggle('scan', k === scanI % Math.max(1, thumbs.length)));
      film.style.transform = `translateX(${-Math.max(0, Math.min(scanI % Math.max(1, thumbs.length), thumbs.length - 5)) * 66}px)`;
      scanI++;
    }, 700);

    // ---------- ② 认出聊天 ----------
    const talk = $('.tw-talk'); let shown = 0;
    const showTalk = msgs => {
      for (; shown < msgs.length; shown++) {
        const m = msgs[shown], b = document.createElement('p');
        b.className = 'tw-b ' + (m.side === 'me' ? 'me' : 'them'); b.textContent = m.text;
        talk.appendChild(b);
        while (talk.children.length > 6) talk.firstElementChild.remove();
      }
    };
    let messages = [];
    if (useAI && frames.length) {
      cap(`一句一句认出 ${who} 说过的话…`);
      messages = await T.recognize(frames, { onMessages: showTalk });
      if (messages.filter(m => m.side === 'them').length < 3) {
        useAI = false; who = T.PRESET.name;
        setMode(`AI 识别没成功，已切到示例人设「${who}」` + (st.chat ? ` · 回话用 ${st.chat_model}` : ''));
        cap(`没认出几句，先用示例人设「${who}」`); $('.tw-h b').textContent = who; await sleep(1600);
      }
    }
    if (!useAI) {
      cap(`一句一句认出 ${who} 说过的话…`);
      const msgs = T.PRESET.history.filter(m => m.text);
      for (let k = 0; k < msgs.length; k += 3) { showTalk(msgs.slice(0, k + 3)); await sleep(240); }
      messages = msgs;
    }
    const nThem = messages.filter(m => m.side === 'them').length;
    cap(`认出了 ${nThem} 句 ${who} 说过的话`);
    await sleep(1100);

    // ---------- ③ 学说话方式 ----------
    cap(`听出了 ${who} 的口气…`);
    let persona = null;
    if (useAI) {
      try {
        persona = await T.buildPersona(messages, { name: who, relation });
      } catch (e) {
        console.warn('[twin] 生成人设失败', e);
        setMode(`AI 生成人设失败，已切到示例人设「${T.PRESET.name}」` + (st.chat ? ` · 回话用 ${st.chat_model}` : ''));
      }
    } else await sleep(900);
    if (!persona) persona = JSON.parse(JSON.stringify(T.PRESET));
    clearInterval(scan); thumbs.forEach(t => t.classList.remove('scan'));
    const traits = $('.tw-traits');
    for (const t of persona.traits || []) {
      const s = document.createElement('span'); s.textContent = t; traits.appendChild(s); snd('tap'); await sleep(260);
    }
    await sleep(600);

    // ---------- ④ 结果卡 ----------
    cap(`${persona.name} 好像想起你了`);
    talk.classList.add('out'); traits.classList.add('out');
    const card = $('.tw-card');
    card.innerHTML = `
      <div class="tw-who"><span class="tw-av">${esc(persona.name.slice(-1))}</span>
        <div><b>${esc(persona.name)}</b><small>${esc([persona.relation, persona.era].filter(Boolean).join(' · '))}</small></div></div>
      <p class="tw-sum">${esc(persona.summary)}</p>
      <div class="tw-ctraits">${(persona.traits || []).map(t => `<span>${esc(t)}</span>`).join('')}</div>
      <p class="tw-quote"><span class="lv lv-${persona.opening.level}">${persona.opening.level} · ${T.LEVEL[persona.opening.level]}</span>「${esc(persona.opening.text)}」</p>
      <p class="tw-note">TA 说的每一句都会标出来源：A 记录里的原话 · C 照语气推测 · D 生成的。<br>这是从你们的聊天记录里拼出来的回声，不是 TA 本人。</p>
      <button type="button" class="tw-go">收进信封</button>`;
    card.hidden = false; snd('unfold');
    await new Promise(r => card.querySelector('.tw-go').addEventListener('click', r, { once: true }));
    snd('tap');
    el.classList.remove('on');
    setTimeout(() => el.remove(), 600);
    return persona;
  }

  return { run };
})();
