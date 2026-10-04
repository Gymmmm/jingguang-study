(() => {
  'use strict';

  const detail = document.getElementById('detail');
  const body = document.getElementById('detailBody');
  const chapterNav = document.getElementById('readerBottomNav');
  if (!detail || !body || !chapterNav) return;

  const readable = () => ['bible-reader', 'egw-reader'].includes(detail.dataset.readerKind || '');

  function findChapterButton(direction) {
    const label = direction === 'prev' ? '上一章' : '下一章';
    const candidates = [
      ...chapterNav.querySelectorAll('button'),
      ...body.querySelectorAll('.readerNav button,.egwChapterPager button')
    ];
    return candidates.find(btn => String(btn.textContent || '').includes(label)) || null;
  }

  function ttsButton() {
    return detail.querySelector('.readAloudBar [data-tts="toggle"]');
  }

  function ensureBar() {
    let bar = detail.querySelector('#readerQuickBar');
    const legacy = bar && (bar.querySelector('[data-reader-quick="toc"],[data-reader-quick="favorite"]') || !bar.querySelector('[data-reader-quick="prev"]'));
    if (bar && !legacy) return bar;
    if (legacy) bar.remove();
    bar = document.createElement('nav');
    bar.id = 'readerQuickBar';
    bar.className = 'readerQuickBar';
    bar.setAttribute('aria-label', '阅读章节与朗读');
    bar.hidden = !readable();
    bar.innerHTML = `
      <div class="readerQuickProgress">
        <span class="readerQuickProgressLabel" data-reader-progress-label>0 / 0</span>
        <input type="range" min="0" max="0" value="0" step="1" data-reader-progress aria-label="朗读进度">
      </div>
      <div class="readerQuickMainRow">
        <select class="readerQuickVoice" data-reader-voice aria-label="选择朗读男声"></select>
        <button type="button" class="readerQuickStep" data-reader-audio-step="-1" aria-label="上一句">‹ 句</button>
        <button type="button" class="readerQuickPlay" data-reader-quick="tts" aria-label="开始朗读">
          <span class="readerQuickPlayLabel">朗读</span>
        </button>
        <button type="button" class="readerQuickStep" data-reader-audio-step="1" aria-label="下一句">句 ›</button>
        <select class="readerQuickRate" data-reader-quick-rate aria-label="朗读速度">
          <option value="0.8">0.8x</option>
          <option value="1">1x</option>
          <option value="1.2">1.2x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2x</option>
        </select>
      </div>`
    detail.appendChild(bar);
    return bar;
  }

  function syncPlayState() {
    const bar = ensureBar();
    const quick = bar.querySelector('[data-reader-quick="tts"]');
    const label = quick?.querySelector('.readerQuickPlayLabel');
    if (!quick || !label) return;
    const s = typeof window.jgReadAloudState === 'function'
      ? window.jgReadAloudState()
      : { speaking:false, paused:false };
    const active = !!s.speaking && !s.paused;
    const progress = s.count ? ` ${Math.min((s.index || 0) + 1, s.count)}/${s.count}` : '';
    const text = active ? `暂停${progress}` : (s.paused ? `继续${progress}` : '朗读');
    label.textContent = text;
    quick.setAttribute('aria-label', active ? `暂停朗读${progress}` : (s.paused ? `继续朗读${progress}` : '开始朗读'));
    quick.dataset.playing = active ? '1' : (s.paused ? 'paused' : 'idle');
    quick.dataset.state = s.paused ? 'paused' : (active ? 'playing' : 'idle');
    const slider = bar.querySelector('[data-reader-progress]');
    const progressLabel = bar.querySelector('[data-reader-progress-label]');
    if (slider) {
      slider.max = String(Math.max(0, (s.count || 1) - 1));
      slider.value = String(Math.max(0, Math.min((s.index || 0), Math.max(0, (s.count || 1) - 1))));
      slider.disabled = !s.count;
    }
    if (progressLabel) progressLabel.textContent = s.count ? `${Math.min((s.index || 0) + 1, s.count)} / ${s.count}` : '0 / 0';
    const rate = bar.querySelector('[data-reader-quick-rate]');
    if (rate) rate.value = String(s.rate || 1);
    const voice = bar.querySelector('[data-reader-voice]');
    if (voice && typeof window.jgReadAloudVoices === 'function') {
      const available = window.jgReadAloudVoices();
      if (!voice.options.length && available.length) {
        voice.innerHTML = available.map(v => `<option value="${v.name}">${v.label || v.name}</option>`).join('');
      }
      const current = window.jgReadAloudVoiceName?.();
      if (current && [...voice.options].some(o => o.value === current)) voice.value = current;
    }
  }

  function syncChapterState() {}

  function refresh() {
    const bar = ensureBar();
    const show = readable() && (detail.open || detail.hasAttribute('open'));
    bar.hidden = !show;
    detail.classList.toggle('hasReaderQuickBar', show);
    if (!show) return;
    syncPlayState();
    syncChapterState();
  }

  detail.addEventListener('input', event => {
    const slider = event.target.closest?.('[data-reader-progress]');
    if (!slider) return;
    const label = ensureBar().querySelector('[data-reader-progress-label]');
    if (label) label.textContent = `${Number(slider.value) + 1} / ${Number(slider.max) + 1}`;
  });

  detail.addEventListener('change', event => {
    const slider = event.target.closest?.('[data-reader-progress]');
    if (slider) {
      window.jgReadAloudSeek?.(Number(slider.value));
      syncPlayState();
      return;
    }
    const rate = event.target.closest?.('[data-reader-quick-rate]');
    if (rate) {
      window.jgSetReadAloudRate?.(Number(rate.value));
      syncPlayState();
      return;
    }
    const voice = event.target.closest?.('#readerQuickBar [data-reader-voice]');
    if (voice) {
      window.jgSetReadAloudVoice?.(voice.value);
      syncPlayState();
    }
  });

  detail.addEventListener('click', event => {
    const sentenceStep = event.target.closest?.('#readerQuickBar [data-reader-audio-step]');
    if (sentenceStep) {
      window.jgReadAloudStep?.(Number(sentenceStep.dataset.readerAudioStep));
      syncPlayState();
      return;
    }
    const control = event.target.closest?.('[data-reader-quick]');
    if (!control || control.disabled) return;
    const action = control.dataset.readerQuick;
    if (action === 'tts') {
      if (typeof window.jgReadAloudToggle === 'function') window.jgReadAloudToggle();
      else ttsButton()?.click();
      syncPlayState();
      return;
    }

  });

  detail.addEventListener('jg-read-aloud-state', syncPlayState);
  detail.addEventListener('open', () => {
    requestAnimationFrame(refresh);
  });
  detail.addEventListener('close', () => {
    const bar = ensureBar();
    bar.hidden = true;
    detail.classList.remove('hasReaderQuickBar');
  });

  const previousRefresh = window.jgRefreshReadAloud;
  if (typeof previousRefresh === 'function' && !previousRefresh.__jgQuickBarWrapped) {
    const wrapped = function (...args) {
      const out = previousRefresh.apply(this, args);
      queueMicrotask(refresh);
      return out;
    };
    wrapped.__jgQuickBarWrapped = true;
    window.jgRefreshReadAloud = wrapped;
  }

  const mo = new MutationObserver(() => {
    if (detail.classList.contains('hasReaderQuickBar')) syncChapterState();
  });
  mo.observe(detail, { childList: true, subtree: true, characterData: true });

  const style = document.createElement('style');
  style.textContent = `
    .readerQuickBar[hidden]{display:none!important}
    .readerQuickBar{position:fixed;z-index:35;left:50%;bottom:0;transform:translateX(-50%);width:min(720px,100%);display:block;padding:7px 10px calc(7px + env(safe-area-inset-bottom));border-top:1px solid color-mix(in srgb,var(--line) 88%,transparent);background:color-mix(in srgb,var(--surface) 97%,transparent);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:0 -6px 22px #0000000c}
    .readerQuickProgress{display:grid;grid-template-columns:42px minmax(0,1fr);align-items:center;gap:8px;margin:0 3px 4px}
    .readerQuickProgressLabel{font-size:9.5px;font-weight:750;color:var(--muted);text-align:right;font-variant-numeric:tabular-nums}
    .readerQuickProgress input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:3px;border-radius:99px;background:var(--line);outline:none}
    .readerQuickProgress input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:17px;height:17px;border-radius:50%;border:0;background:var(--accent);box-shadow:0 1px 6px color-mix(in srgb,var(--accent) 28%,transparent)}
    .readerQuickMainRow{display:grid;grid-template-columns:minmax(88px,1fr) 42px 78px 42px 58px;align-items:center;gap:4px}
    .readerQuickMainRow button,.readerQuickMainRow select{min-width:0;min-height:38px!important;border:0!important;border-radius:9px!important;box-shadow:none!important;font-family:var(--font-ui)!important}
    .readerQuickMainRow select{padding:0 6px!important;background:var(--soft)!important;color:var(--text)!important;font-size:10.5px!important;font-weight:650!important}
    .readerQuickStep{padding:0!important;background:transparent!important;color:var(--muted)!important;font-size:11px!important;font-weight:700!important}
    .readerQuickPlay{padding:0 8px!important;background:color-mix(in srgb,var(--accent) 11%,var(--surface))!important;color:var(--accent)!important;font-size:12px!important;font-weight:780!important}
    .readerQuickPlay[data-state="playing"],.readerQuickPlay[data-state="paused"]{background:var(--accent)!important;color:#fff!important}
    .readerQuickPlay .readerQuickPlayLabel{font-size:12px!important;font-weight:780!important;white-space:nowrap}
    .readerQuickMainRow button:active{transform:scale(.97)}
    @media(max-width:390px){
      .readerQuickBar{padding-left:8px;padding-right:8px}
      .readerQuickMainRow{grid-template-columns:minmax(78px,1fr) 38px 72px 38px 54px;gap:3px}
      .readerQuickMainRow select{font-size:10px!important;padding-left:5px!important;padding-right:4px!important}
      .readerQuickStep{font-size:10.5px!important}
      .readerQuickPlay .readerQuickPlayLabel{font-size:11.5px!important}
    }
    #detail.hasReaderQuickBar .readAloudBar{display:none!important}
  `;
  document.head.appendChild(style);
  ensureBar();
  const boot = () => { if (readable()) refresh(); };
  requestAnimationFrame(boot);
  setTimeout(boot, 250);
  setTimeout(boot, 900);
})();
