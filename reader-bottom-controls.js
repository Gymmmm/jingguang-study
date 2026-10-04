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
        <button type="button" class="readerQuickPrev" data-reader-quick="prev" aria-label="上一章">上一章</button>
        <div class="readerQuickAudio">
          <button type="button" class="readerQuickStep" data-reader-audio-step="-1" aria-label="上一句">‹ 句</button>
          <button type="button" class="readerQuickPlay" data-reader-quick="tts" aria-label="开始朗读">
            <span class="readerQuickPlayLabel">朗读</span>
          </button>
          <button type="button" class="readerQuickStep" data-reader-audio-step="1" aria-label="下一句">句 ›</button>
        </div>
        <button type="button" class="readerQuickNext" data-reader-quick="next" aria-label="下一章">下一章</button>
      </div>
      <div class="readerQuickOptions">
        <select data-reader-voice aria-label="选择朗读男声"></select>
        <button type="button" data-reader-voice-preview aria-label="试听当前声音">试听</button>
        <select data-reader-quick-rate aria-label="朗读速度">
          <option value="0.8">0.8x</option>
          <option value="1">1x</option>
          <option value="1.2">1.2x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2x</option>
        </select>
      </div>`;
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

  function syncChapterState() {
    const bar = ensureBar();
    ['prev', 'next'].forEach(direction => {
      const btn = bar.querySelector(`[data-reader-quick="${direction}"]`);
      if (!btn) return;
      const target = findChapterButton(direction);
      const disabled = !target || !!target.disabled || target.hidden;
      btn.disabled = disabled;
      btn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    });
  }

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
    const preview = event.target.closest?.('#readerQuickBar [data-reader-voice-preview]');
    if (preview) {
      const voice = ensureBar().querySelector('[data-reader-voice]');
      window.jgPreviewReadAloudVoice?.(voice?.value || '');
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
    const target = findChapterButton(action);
    if (target && !target.disabled) target.click();
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
    .readerQuickBar{position:fixed;z-index:30;left:50%;bottom:0;transform:translateX(-50%);width:min(720px,100%);display:block;padding:7px 12px calc(8px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:color-mix(in srgb,var(--surface) 97%,transparent);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
    .readerQuickProgress{display:grid;grid-template-columns:46px minmax(0,1fr);align-items:center;gap:8px;margin:0 2px 3px}
    .readerQuickProgressLabel{font-size:10px;font-weight:700;color:var(--muted);text-align:right;font-variant-numeric:tabular-nums}
    .readerQuickProgress input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:99px;background:var(--line);outline:none}
    .readerQuickProgress input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;border:0;background:var(--accent);box-shadow:0 1px 6px color-mix(in srgb,var(--accent) 30%,transparent)}
    .readerQuickMainRow{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px}
    .readerQuickAudio{display:flex;align-items:center;justify-content:center;gap:4px}
    .readerQuickBar button{border:0!important;background:transparent!important;box-shadow:none!important;color:var(--text)!important;-webkit-tap-highlight-color:transparent;min-height:42px!important;padding:5px 5px!important;font-size:13px!important;font-weight:650!important}
    .readerQuickBar button:disabled{opacity:.28!important;color:var(--muted)!important}
    .readerQuickPrev{justify-self:start;text-align:left;color:var(--muted)!important}
    .readerQuickNext{justify-self:end;text-align:right;color:var(--muted)!important}
    .readerQuickStep{min-width:44px!important;color:var(--muted)!important;font-size:11px!important}
    .readerQuickBar button.readerQuickPlay{min-width:78px;border-radius:999px!important;background:color-mix(in srgb,var(--accent) 12%,var(--surface))!important;color:var(--accent)!important;font-weight:750!important}
    .readerQuickPlay[data-state="playing"],.readerQuickPlay[data-state="paused"]{background:var(--accent)!important;color:#fff!important}
    .readerQuickPlay .readerQuickPlayLabel{font-size:13px;font-weight:750;letter-spacing:.01em}
    .readerQuickOptions{display:grid;grid-template-columns:minmax(0,1fr) 52px 66px;gap:6px;align-items:center;margin-top:3px}
    .readerQuickOptions select,.readerQuickOptions button{min-height:34px!important;border:1px solid var(--line)!important;border-radius:9px!important;background:var(--surface)!important;color:var(--text)!important;font-size:11px!important;font-weight:650!important;padding:0 8px!important;box-shadow:none!important}
    .readerQuickOptions button{color:var(--accent)!important}
    @media(max-width:390px){.readerQuickBar{padding-left:9px;padding-right:9px}.readerQuickBar button{font-size:12px!important}.readerQuickStep{min-width:40px!important}.readerQuickOptions{grid-template-columns:minmax(0,1fr) 48px 62px}}
    #detail.hasReaderQuickBar #readerBottomNav,
    #detail.hasReaderQuickBar #detailActions,
    #detail.hasReaderQuickBar .readerNav,
    #detail.hasReaderQuickBar .egwChapterPager,
    #detail.hasReaderQuickBar .readAloudBar{display:none!important}
  `;
  document.head.appendChild(style);
  ensureBar();
  const boot = () => { if (readable()) refresh(); };
  requestAnimationFrame(boot);
  setTimeout(boot, 250);
  setTimeout(boot, 900);
})();
