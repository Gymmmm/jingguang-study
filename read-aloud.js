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
    const kind = detail.dataset.readerKind || 'reader';
    const book = cleanText(body.querySelector('.egwBookName,h1')?.textContent || '');
    const chapter = cleanText(document.getElementById('detailType')?.textContent || body.querySelector('h2')?.textContent || '');
    return [kind, book, chapter].filter(Boolean).join('|') || 'reader';
  }

  function savePosition() {
    if (!units.length) return;
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

  function readablePage() {
    return !!body.querySelector('.reading .verse span, .egwReading .egwParagraph, .reading p');
  }

  function syncToolbarVisibility() {
    const bar = ensureToolbar();
    const show = detail.open && readablePage();
    bar.hidden = !show;
    if (!show && speaking) stop(false);
    return show;
  }

  function collectUnits() {
    const candidates = [
      ...body.querySelectorAll('.reading .verse span, .egwReading .egwParagraph, .egw-original p, .detailSection p')
    ];
    const seen = new Set();
    units = candidates.map(el => ({ el, text: cleanText(el.textContent) }))
      .filter(x => x.text.length > 1 && !seen.has(x.text) && seen.add(x.text));
    if (!units.length && readablePage()) {
      const reading = body.querySelector('.reading, .egw-original');
      const text = cleanText(reading?.textContent);
      if (text) units = [{ el: reading, text }];
    }
    index = restorePosition();
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
    bar.hidden = true;
    bar.innerHTML = `
      <button type="button" data-tts="prev" aria-label="上一段">‹</button>
      <button type="button" class="ttsMain" data-tts="toggle">朗读</button>
      <button type="button" data-tts="next" aria-label="下一段">›</button>
      <label aria-label="朗读语速">
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
    if (main) main.textContent = paused ? '继续' : (speaking ? '暂停' : '朗读');
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

  detail.addEventListener('close', () => {
    stop(false);
    ensureToolbar().hidden = true;
  });
  detail.addEventListener('cancel', () => stop(false));

  const observer = new MutationObserver(() => {
    if (!detail.open) {
      ensureToolbar().hidden = true;
      return;
    }
    if (speaking) stop(false);
    collectUnits();
  });
  observer.observe(body, { childList: true, subtree: true });

  const style = document.createElement('style');
  style.textContent = `
    .readAloudBar[hidden]{display:none!important}
    .readAloudBar{position:sticky;top:52px;z-index:6;display:flex;justify-content:center;align-items:center;gap:4px;padding:6px 10px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--surface) 94%,transparent);backdrop-filter:blur(12px)}
    .readAloudBar button,.readAloudBar select{min-height:34px;border:0;border-radius:0;background:transparent;color:var(--text);font:inherit;box-shadow:none}
    .readAloudBar button{min-width:38px;padding:0 8px}.readAloudBar .ttsMain{min-width:68px;color:var(--accent);font-weight:800}.readAloudBar label{display:flex;align-items:center}.readAloudBar select{padding:0 5px;color:var(--muted);font-size:12px}
    .ttsSpeaking{border-left:3px solid var(--accent)!important;background:transparent!important;box-shadow:none!important;transition:border-color .18s ease}
    @media(max-width:560px){.readAloudBar{top:48px;padding:5px 8px}.readAloudBar button{min-width:34px;padding:0 6px;font-size:12px}.readAloudBar .ttsMain{min-width:60px}.readAloudBar select{font-size:11px}}
  `;
  document.head.appendChild(style);
  ensureToolbar();
})();
