(() => {
  'use strict';

  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;

  const RATE_KEY = 'jg_read_aloud_rate';
  const POS_KEY = 'jg_read_aloud_position';
  const RATES = [0.8, 1, 1.2, 1.5, 2];
  let units = [];
  let index = 0;
  let rate = +(localStorage.getItem(RATE_KEY) || 1);
  if (!RATES.some(x => Math.abs(x - rate) < .01)) rate = 1;
  let speaking = false;
  let paused = false;
  let session = 0;
  let activeKey = '';

  const detail = document.getElementById('detail');
  const body = document.getElementById('detailBody');
  if (!detail || !body) return;

  const cleanText = value => String(value || '').replace(/\s+/g, ' ').trim();
  const readablePage = () => detail.dataset.readerKind === 'bible-reader' || detail.dataset.readerKind === 'egw-reader';

  function titleKey() {
    const kind = detail.dataset.readerKind || 'reader';
    const book = cleanText(body.querySelector('.egwBookName,h1')?.textContent || '');
    const chapter = cleanText(document.getElementById('detailType')?.textContent || body.querySelector('h2')?.textContent || '');
    return [kind, book, chapter].filter(Boolean).join('|') || 'reader';
  }

  function savePosition() {
    if (!units.length) return;
    const key = activeKey || titleKey();
    if (!key) return;
    try {
      const all = JSON.parse(localStorage.getItem(POS_KEY) || '{}');
      all[key] = index;
      localStorage.setItem(POS_KEY, JSON.stringify(all));
    } catch (_) {}
  }

  function restorePosition(key = titleKey()) {
    try {
      const all = JSON.parse(localStorage.getItem(POS_KEY) || '{}');
      const n = +all[key];
      return Number.isFinite(n) ? Math.max(0, Math.min(n, Math.max(0, units.length - 1))) : 0;
    } catch (_) { return 0; }
  }

  function collectUnits() {
    const candidates = [
      ...body.querySelectorAll('.reading .verse span, .egwReading .egwParagraph, .egw-original p, .detailSection p')
    ];
    const seen = new Set();
    units = candidates
      .filter(el => !seen.has(el) && seen.add(el))
      .map(el => ({ el, text: cleanText(el.textContent) }))
      .filter(x => x.text.length > 1);
    if (!units.length && readablePage()) {
      const reading = body.querySelector('.reading, .egw-original');
      const text = cleanText(reading?.textContent);
      if (text) units = [{ el: reading, text }];
    }
    activeKey = units.length ? titleKey() : '';
    index = units.length ? restorePosition(activeKey) : 0;
    syncToolbarVisibility();
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

  function emitState() {
    detail.dispatchEvent(new CustomEvent('jg-read-aloud-state', {
      detail: { speaking, paused, rate, index, count: units.length }
    }));
  }

  function speakCurrent(token = session) {
    if (token !== session || !speaking) return;
    if (!units.length || index >= units.length) {
      speaking = false;
      paused = false;
      index = 0;
      savePosition();
      clearHighlight();
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
    if (!units.length) collectUnits();
    if (!units.length || !readablePage()) return;
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
    savePosition();
    session += 1;
    synth.cancel();
    speaking = false;
    paused = false;
    clearHighlight();
    if (reset) index = 0;
    updateToolbar();
  }

  function refresh() {
    savePosition();
    session += 1;
    synth.cancel();
    speaking = false;
    paused = false;
    clearHighlight();
    units = [];
    index = 0;
    activeKey = '';
    collectUnits();
  }

  function setRate(value) {
    const wanted = Number(value);
    const matched = RATES.find(x => Math.abs(x - wanted) < .01);
    if (!matched) return false;
    rate = matched;
    localStorage.setItem(RATE_KEY, String(rate));
    if (speaking && !paused) {
      session += 1;
      speakCurrent(session);
    } else updateToolbar();
    return true;
  }

  function cycleRate() {
    const current = RATES.findIndex(x => Math.abs(x - rate) < .01);
    setRate(RATES[(current + 1 + RATES.length) % RATES.length]);
  }

  function step(delta) {
    if (!units.length) collectUnits();
    if (!units.length || !readablePage()) return false;
    const next = Math.max(0, Math.min(units.length - 1, index + (delta < 0 ? -1 : 1)));
    if (next === index) {
      highlightCurrent();
      updateToolbar();
      return false;
    }
    index = next;
    savePosition();
    if (speaking) {
      session += 1;
      speaking = true;
      paused = false;
      speakCurrent(session);
    } else {
      highlightCurrent();
      updateToolbar();
    }
    return true;
  }

  function ensureToolbar() {
    let bar = detail.querySelector('.readAloudBar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.className = 'readAloudBar';
    bar.hidden = true;
    bar.innerHTML = `
      <button type="button" class="ttsMain" data-tts="toggle">朗读</button>
      <button type="button" class="ttsRate" data-tts="rate" aria-label="调整朗读语速">1×</button>`;
    detail.querySelector('header')?.insertAdjacentElement('afterend', bar);
    return bar;
  }

  function syncToolbarVisibility() {
    const bar = ensureToolbar();
    const show = detail.open && readablePage();
    bar.hidden = !show;
    return show;
  }

  function updateToolbar() {
    const bar = ensureToolbar();
    const main = bar.querySelector('[data-tts="toggle"]');
    if (main) {
      main.textContent = paused ? '继续朗读' : (speaking ? '暂停朗读' : '朗读');
      main.setAttribute('aria-label', `${main.textContent}，系统默认中文语音`);
      main.title = '系统默认中文语音';
    }
    const rateBtn = bar.querySelector('[data-tts="rate"]');
    if (rateBtn) rateBtn.textContent = `${rate}×`;
    bar.dataset.active = speaking ? '1' : '0';
    emitState();
  }

  detail.addEventListener('click', e => {
    const btn = e.target.closest('[data-tts]');
    if (!btn) return;
    if (btn.dataset.tts === 'toggle') {
      if (speaking && !paused) pause(); else start();
    } else if (btn.dataset.tts === 'rate') cycleRate();
  });

  detail.addEventListener('close', () => {
    stop(false);
    units = [];
    activeKey = '';
    ensureToolbar().hidden = true;
  });
  detail.addEventListener('cancel', () => stop(false));

  window.jgRefreshReadAloud = refresh;
  window.jgReadAloudVoiceName = () => '系统默认中文语音';
  window.jgReadAloudStep = step;
  window.jgSetReadAloudRate = setRate;
  window.jgReadAloudState = () => ({ speaking, paused, rate, index, count: units.length });

  const style = document.createElement('style');
  style.textContent = `
    .readAloudBar[hidden]{display:none!important}
    .readAloudBar{position:relative;z-index:2;display:flex;justify-content:flex-end;align-items:center;gap:5px;max-width:720px;margin:0 auto;padding:5px 14px 0;border:0;background:transparent;backdrop-filter:none}
    .readAloudBar button{min-height:30px!important;padding:0 6px!important;border:0!important;border-radius:0!important;background:transparent!important;color:var(--muted)!important;font:inherit;font-size:10.5px!important;font-weight:650!important;box-shadow:none!important}
    .readAloudBar .ttsMain{color:var(--accent)!important}
    .readAloudBar[data-active="1"] .ttsMain{font-weight:800!important}
    .readAloudBar .ttsRate{min-width:34px!important;color:color-mix(in srgb,var(--muted) 78%,transparent)!important;font-weight:550!important}
    .ttsSpeaking{border-left:2px solid var(--accent)!important;background:transparent!important;box-shadow:none!important;transition:border-color .18s ease}
    @media(max-width:560px){.readAloudBar{padding:4px 12px 0}.readAloudBar button{font-size:10px!important}}
  `;
  document.head.appendChild(style);
  ensureToolbar();
})();