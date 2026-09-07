(() => {
  'use strict';

  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;

  const RATE_KEY = 'jg_read_aloud_rate';
  const POS_KEY = 'jg_read_aloud_position';
  let units = [];
  let index = 0;
  let rate = +(localStorage.getItem(RATE_KEY) || 1);
  let speaking = false;
  let paused = false;
  let session = 0;

  const detail = document.getElementById('detail');
  const body = document.getElementById('detailBody');
  if (!detail || !body) return;

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function titleKey() {
    const h = body.querySelector('h1,h2');
    return cleanText(h?.textContent || document.getElementById('detailType')?.textContent || 'reader');
  }

  function savePosition() {
    try {
      const all = JSON.parse(localStorage.getItem(POS_KEY) || '{}');
      all[titleKey()] = index;
      localStorage.setItem(POS_KEY, JSON.stringify(all));
    } catch (_) {}
  }

  function restorePosition() {
    try {
      const all = JSON.parse(localStorage.getItem(POS_KEY) || '{}');
      const n = +all[titleKey()];
      return Number.isFinite(n) ? Math.max(0, Math.min(n, Math.max(0, units.length - 1))) : 0;
    } catch (_) { return 0; }
  }

  function collectUnits() {
    const candidates = [
      ...body.querySelectorAll('.reading .verse span, .reading p, .egw-original p, .egw-original div, .detailSection p')
    ];
    const seen = new Set();
    units = candidates.map(el => ({ el, text: cleanText(el.textContent) }))
      .filter(x => x.text.length > 1 && !seen.has(x.text) && seen.add(x.text));
    if (!units.length) {
      const reading = body.querySelector('.reading, .egw-original');
      const text = cleanText(reading?.textContent);
      if (text) units = [{ el: reading, text }];
    }
    index = restorePosition();
    updateToolbar();
  }

  function clearHighlight() {
    body.querySelectorAll('.ttsSpeaking').forEach(el => el.classList.remove('ttsSpeaking'));
  }

  function highlightCurrent() {
    clearHighlight();
    const el = units[index]?.el;
    if (!el) return;
    el.classList.add('ttsSpeaking');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function pickChineseVoice() {
    const voices = synth.getVoices?.() || [];
    return voices.find(v => /^zh(-|_)/i.test(v.lang) && /female|ting|mei|xiaoxiao|sinji|yunxi|zh/i.test(v.name))
      || voices.find(v => /^zh(-|_)/i.test(v.lang))
      || null;
  }

  function speakCurrent(token = session) {
    if (token !== session || !speaking) return;
    if (!units.length || index >= units.length) {
      stop(false);
      index = 0;
      savePosition();
      updateToolbar();
      return;
    }
    synth.cancel();
    paused = false;
    highlightCurrent();
    savePosition();
    const u = new SpeechSynthesisUtterance(units[index].text);
    u.lang = 'zh-CN';
    u.rate = rate;
    const voice = pickChineseVoice();
    if (voice) u.voice = voice;
    u.onend = () => {
      if (token !== session || !speaking) return;
      index += 1;
      speakCurrent(token);
    };
    u.onerror = () => {
      if (token !== session) return;
      speaking = false;
      paused = false;
      clearHighlight();
      updateToolbar();
    };
    synth.speak(u);
    updateToolbar();
  }

  function start() {
    collectUnits();
    if (!units.length) return;
    if (paused && synth.paused) {
      synth.resume();
      paused = false;
      speaking = true;
      updateToolbar();
      return;
    }
    speaking = true;
    paused = false;
    session += 1;
    speakCurrent(session);
  }

  function pause() {
    if (!speaking) return;
    synth.pause();
    paused = true;
    updateToolbar();
  }

  function stop(reset = false) {
    session += 1;
    synth.cancel();
    speaking = false;
    paused = false;
    clearHighlight();
    if (reset) index = 0;
    savePosition();
    updateToolbar();
  }

  function jump(delta) {
    collectUnits();
    if (!units.length) return;
    index = Math.max(0, Math.min(units.length - 1, index + delta));
    savePosition();
    if (speaking) {
      session += 1;
      speakCurrent(session);
    } else {
      highlightCurrent();
      updateToolbar();
    }
  }

  function setRate(value) {
    rate = +value || 1;
    localStorage.setItem(RATE_KEY, String(rate));
    if (speaking && !paused) {
      session += 1;
      speakCurrent(session);
    }
    updateToolbar();
  }

  function ensureToolbar() {
    let bar = detail.querySelector('.readAloudBar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.className = 'readAloudBar';
    bar.innerHTML = `
      <button type="button" data-tts="prev" aria-label="上一段">‹ 上一段</button>
      <button type="button" class="ttsMain" data-tts="toggle">▶ 朗读</button>
      <button type="button" data-tts="next" aria-label="下一段">下一段 ›</button>
      <label>语速
        <select data-tts-rate aria-label="朗读语速">
          <option value="0.8">0.8×</option>
          <option value="1">1×</option>
          <option value="1.2">1.2×</option>
          <option value="1.5">1.5×</option>
          <option value="2">2×</option>
        </select>
      </label>`;
    detail.querySelector('header')?.insertAdjacentElement('afterend', bar);
    bar.querySelector('[data-tts-rate]').value = String(rate);
    return bar;
  }

  function updateToolbar() {
    const bar = ensureToolbar();
    const main = bar.querySelector('[data-tts="toggle"]');
    if (main) main.textContent = paused ? '▶ 继续' : (speaking ? '⏸ 暂停' : '▶ 朗读');
    const select = bar.querySelector('[data-tts-rate]');
    if (select && select.value !== String(rate)) select.value = String(rate);
    bar.dataset.active = speaking ? '1' : '0';
  }

  detail.addEventListener('click', e => {
    const btn = e.target.closest('[data-tts]');
    if (!btn) return;
    const action = btn.dataset.tts;
    if (action === 'toggle') {
      if (speaking && !paused) pause(); else start();
    } else if (action === 'prev') jump(-1);
    else if (action === 'next') jump(1);
  });

  detail.addEventListener('change', e => {
    if (e.target.matches('[data-tts-rate]')) setRate(e.target.value);
  });

  detail.addEventListener('close', () => stop(false));
  detail.addEventListener('cancel', () => stop(false));

  const observer = new MutationObserver(() => {
    if (!detail.open) return;
    if (speaking) stop(false);
    collectUnits();
  });
  observer.observe(body, { childList: true, subtree: true });

  const style = document.createElement('style');
  style.textContent = `
    .readAloudBar{position:sticky;top:52px;z-index:6;display:grid;grid-template-columns:auto 1fr auto auto;gap:8px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--card) 94%,transparent);backdrop-filter:blur(12px)}
    .readAloudBar button,.readAloudBar select{min-height:38px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--text);font:inherit}
    .readAloudBar button{padding:0 12px}.readAloudBar .ttsMain{font-weight:800}.readAloudBar label{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:13px}.readAloudBar select{padding:0 8px}
    .ttsSpeaking{border-left:3px solid var(--accent)!important;background:transparent!important;box-shadow:none!important;transition:border-color .18s ease}
    @media(max-width:560px){.readAloudBar{top:48px;grid-template-columns:1fr 1.4fr 1fr}.readAloudBar label{grid-column:1/-1;justify-content:flex-end}.readAloudBar button{padding:0 8px;font-size:13px}}
  `;
  document.head.appendChild(style);
  ensureToolbar();
})();
