(() => {
  'use strict';

  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;

  const RATE_KEY = 'jg_read_aloud_rate';
  const VOICE_KEY = 'jg_read_aloud_voice';
  const POS_KEY = 'jg_read_aloud_position';
  const RATES = [0.8, 1, 1.2, 1.5, 2];
  let units = [];
  let index = 0;
  let rate = +(localStorage.getItem(RATE_KEY) || 1);
  if (!RATES.some(x => Math.abs(x - rate) < .01)) rate = 1;
  let selectedVoiceName = localStorage.getItem(VOICE_KEY) || '';
  let voices = [];
  let speaking = false;
  let paused = false;
  let session = 0;
  let activeKey = '';

  const detail = document.getElementById('detail');
  const body = document.getElementById('detailBody');
  if (!detail || !body) return;

  const cleanText = value => String(value || '').replace(/\s+/g, ' ').trim();
  const CLOUD_VOICES = [
    { id:'yunjian', name:'云健 · 新闻播音', desc:'沉稳、字正腔圆' },
    { id:'yunyang', name:'云扬 · 纪录解说', desc:'成熟、清晰' },
    { id:'yunxi', name:'云希 · 青年男声', desc:'自然、年轻' },
    { id:'yunxia', name:'云夏 · 清亮男声', desc:'清晰、轻快' },
    { id:'yunjhe', name:'云哲 · 台湾男声', desc:'温和、自然' },
    { id:'wanlung', name:'云龙 · 粤语男声', desc:'粤语、沉稳' }
  ];
  let cloudVoice = localStorage.getItem(VOICE_KEY) || 'yunjian';
  let cloudAudio = null;
  let cloudObjectUrl = '';

  function ensureCloudAudio() {
    if (cloudAudio) return cloudAudio;
    cloudAudio = document.createElement('audio');
    cloudAudio.preload = 'auto';
    cloudAudio.setAttribute('playsinline', '');
    cloudAudio.style.display = 'none';
    document.body.appendChild(cloudAudio);
    return cloudAudio;
  }

  function clearCloudSource() {
    if (cloudObjectUrl) {
      try { URL.revokeObjectURL(cloudObjectUrl); } catch (_) {}
      cloudObjectUrl = '';
    }
  }

  function updateVoiceSelect() {
    document.querySelectorAll('[data-reader-voice]').forEach(select => {
      select.innerHTML = CLOUD_VOICES.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
      select.value = CLOUD_VOICES.some(v => v.id === cloudVoice) ? cloudVoice : 'yunjian';
      select.disabled = false;
    });
  }

  function setVoice(name) {
    if (!CLOUD_VOICES.some(v => v.id === name)) return false;
    cloudVoice = name;
    localStorage.setItem(VOICE_KEY, name);
    updateToolbar();
    return true;
  }

  async function cloudSpeak(text, token, preview = false) {
    const audio = ensureCloudAudio();
    audio.pause();
    const response = await fetch('/api/tts', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text, voice:cloudVoice, rate})
    });
    if (!response.ok) throw new Error('cloud_tts_failed');
    const blob = await response.blob();
    if (token !== session && !preview) return;
    clearCloudSource();
    cloudObjectUrl = URL.createObjectURL(blob);
    audio.src = cloudObjectUrl;
    audio.currentTime = 0;
    audio.onended = () => {
      clearCloudSource();
      if (preview) return;
      if (token !== session || !speaking) return;
      index += 1;
      speakCurrent(token);
    };
    audio.onerror = () => clearCloudSource();
    await audio.play();
  }

  function previewVoice(name) {
    if (name) setVoice(name);
    cloudSpeak('这是当前男声的朗读效果。愿你在阅读中有清晰安静的思考。', session, true).catch(() => {});
    return true;
  }

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

  function splitSentenceText(text) {
    const raw = String(text || '');
    const parts = raw.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [raw];
    return parts.filter(part => part.length);
  }

  function prepareSentenceUnits() {
    body.querySelectorAll('.egwReading .egwParagraph, .egw-original p, .detailSection p').forEach(p => {
      if (p.dataset.ttsSentenceReady === '1') return;
      [...p.childNodes].forEach(node => {
        if (node.nodeType !== Node.TEXT_NODE || !cleanText(node.nodeValue)) return;
        const frag = document.createDocumentFragment();
        splitSentenceText(node.nodeValue).forEach(part => {
          if (!cleanText(part)) {
            frag.appendChild(document.createTextNode(part));
            return;
          }
          const span = document.createElement('span');
          span.className = 'ttsSentenceUnit';
          span.textContent = part;
          frag.appendChild(span);
        });
        node.replaceWith(frag);
      });
      p.dataset.ttsSentenceReady = '1';
    });
  }

  function collectUnits() {
    prepareSentenceUnits();
    const candidates = [
      ...body.querySelectorAll('.reading .verse span, .egwReading .ttsSentenceUnit, .egw-original .ttsSentenceUnit, .detailSection .ttsSentenceUnit')
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
    const root = detail.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const targetTop = root.top + Math.min(260, root.height * .34);
    const outsideReadingBand = rect.top < root.top + 130 || rect.bottom > root.bottom - 150;
    if (outsideReadingBand) {
      const delta = rect.top - targetTop;
      detail.scrollBy({ top: delta, behavior: 'smooth' });
    }
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
    cloudSpeak(units[index].text, token).catch(() => {
      const u = new SpeechSynthesisUtterance(units[index].text);
      u.lang = 'zh-CN';
      u.rate = rate;
      u.onend = () => {
        if (token !== session || !speaking) return;
        index += 1;
        speakCurrent(token);
      };
      synth.speak(u);
    });
    updateToolbar();
  }

  function start() {
    if (!units.length) collectUnits();
    if (!units.length || !readablePage()) return;
    if (paused) {
      if (cloudAudio && cloudAudio.src && cloudAudio.paused) {
        cloudAudio.play().catch(() => {});
      } else if (synth.paused) {
        synth.resume();
      }
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
    if (cloudAudio && !cloudAudio.paused) cloudAudio.pause();
    synth.pause();
    paused = true;
    updateToolbar();
  }

  function stop(reset = false) {
    savePosition();
    session += 1;
    if (cloudAudio) {
      cloudAudio.pause();
      cloudAudio.removeAttribute('src');
      cloudAudio.load();
      clearCloudSource();
    }
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
    if (cloudAudio) {
      cloudAudio.pause();
      cloudAudio.removeAttribute('src');
      cloudAudio.load();
      clearCloudSource();
    }
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

  function seekTo(value) {
    if (!units.length) collectUnits();
    if (!units.length || !readablePage()) return false;
    const next = Math.max(0, Math.min(units.length - 1, Math.round(Number(value) || 0)));
    const wasSpeaking = speaking;
    const wasPaused = paused;
    session += 1;
    if (cloudAudio) {
      cloudAudio.pause();
      cloudAudio.removeAttribute('src');
      cloudAudio.load();
      clearCloudSource();
    }
    synth.cancel();
    index = next;
    savePosition();
    highlightCurrent();
    speaking = wasSpeaking;
    paused = wasPaused;
    if (wasSpeaking && !wasPaused) {
      speaking = true;
      paused = false;
      speakCurrent(session);
    } else {
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
      const voiceName = CLOUD_VOICES.find(v => v.id === cloudVoice)?.name || '云健 · 新闻播音';
      main.setAttribute('aria-label', `${main.textContent}，${voiceName}`);
      main.title = voiceName;
    }
    const rateBtn = bar.querySelector('[data-tts="rate"]');
    if (rateBtn) rateBtn.textContent = `${rate}×`;
    bar.dataset.active = speaking ? '1' : '0';
    emitState();
  }

  function toggle() {
    if (speaking && !paused) pause(); else start();
    return { speaking, paused, rate, index, count: units.length };
  }

  detail.addEventListener('click', e => {
    const btn = e.target.closest('[data-tts]');
    if (!btn) return;
    if (btn.dataset.tts === 'toggle') toggle();
    else if (btn.dataset.tts === 'rate') cycleRate();
  });

  detail.addEventListener('open', () => {
    if (readablePage()) collectUnits();
  });

  detail.addEventListener('close', () => {
    stop(false);
    units = [];
    activeKey = '';
    ensureToolbar().hidden = true;
  });
  detail.addEventListener('cancel', () => stop(false));

  window.jgRefreshReadAloud = refresh;
  window.jgReadAloudToggle = toggle;
  window.jgReadAloudVoiceName = () => cloudVoice;
  window.jgReadAloudVoices = () => CLOUD_VOICES.map(v => ({name:v.id, label:v.name, desc:v.desc, male:true}));
  window.jgSetReadAloudVoice = setVoice;
  window.jgPreviewReadAloudVoice = previewVoice;
  window.jgReadAloudStep = step;
  window.jgReadAloudSeek = seekTo;
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
    .ttsSentenceUnit{box-decoration-break:clone;-webkit-box-decoration-break:clone}
    .ttsSentenceUnit.ttsSpeaking{position:relative!important;padding:2px 1px!important;margin:0 -1px!important;border-radius:4px!important;background:color-mix(in srgb,var(--accent) 15%,transparent)!important;box-shadow:inset 0 -2px 0 color-mix(in srgb,var(--accent) 68%,transparent)!important;color:var(--text)!important;transition:background .14s ease,box-shadow .14s ease}
    .ttsSentenceUnit.ttsSpeaking::before{content:"▶";display:inline-block;margin-right:4px;color:var(--accent);font-family:system-ui,-apple-system,"PingFang SC",sans-serif;font-size:9px;font-weight:900;line-height:1;vertical-align:.12em}
    .reading .verse span.ttsSpeaking{padding:2px 1px!important;margin:0 -1px!important;border-radius:4px!important;background:color-mix(in srgb,var(--accent) 15%,transparent)!important;box-shadow:inset 0 -2px 0 color-mix(in srgb,var(--accent) 68%,transparent)!important}
    @media(max-width:560px){.readAloudBar{padding:4px 12px 0}.readAloudBar button{font-size:10px!important}}
  `;
  document.head.appendChild(style);
  ensureToolbar();
  updateVoiceSelect();
})();
