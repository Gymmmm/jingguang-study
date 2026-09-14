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
    bar.hidden = true;
    bar.innerHTML = `
      <button type="button" class="readerQuickPrev" data-reader-quick="prev" aria-label="上一章">上一章</button>
      <button type="button" class="readerQuickPlay" data-reader-quick="tts" aria-label="开始朗读">
        <span class="readerQuickPlayLabel">朗读</span>
      </button>
      <button type="button" class="readerQuickNext" data-reader-quick="next" aria-label="下一章">下一章</button>`;
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
    const text = active ? '暂停' : (s.paused ? '继续' : '朗读');
    label.textContent = text;
    quick.setAttribute('aria-label', active ? '暂停朗读' : (s.paused ? '继续朗读' : '开始朗读'));
    quick.dataset.playing = active ? '1' : (s.paused ? 'paused' : 'idle');
    quick.dataset.state = s.paused ? 'paused' : (active ? 'playing' : 'idle');
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
    const show = detail.open && readable();
    bar.hidden = !show;
    detail.classList.toggle('hasReaderQuickBar', show);
    if (!show) return;
    syncPlayState();
    syncChapterState();
  }

  detail.addEventListener('click', event => {
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
    .readerQuickBar{position:fixed;z-index:30;left:50%;bottom:0;transform:translateX(-50%);width:min(720px,100%);display:grid;grid-template-columns:1fr 1fr 1fr;align-items:center;gap:4px;padding:8px 14px calc(8px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:color-mix(in srgb,var(--surface) 96%,transparent);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
    .readerQuickBar button{border:0!important;background:transparent!important;box-shadow:none!important;color:var(--text)!important;-webkit-tap-highlight-color:transparent;min-height:48px!important;padding:6px 4px!important;font-size:14px!important;font-weight:650!important}
    .readerQuickBar button:disabled{opacity:.28!important;color:var(--muted)!important}
    .readerQuickPrev{justify-self:start;text-align:left;color:var(--muted)!important}
    .readerQuickNext{justify-self:end;text-align:right;color:var(--muted)!important}
    .readerQuickBar button.readerQuickPlay{justify-self:center;min-width:88px;border-radius:999px!important;background:color-mix(in srgb,var(--accent) 12%,var(--surface))!important;color:var(--accent)!important;font-weight:750!important}
    .readerQuickPlay[data-state="playing"],
    .readerQuickPlay[data-state="paused"]{background:var(--accent)!important;color:#fff!important}
    .readerQuickPlay .readerQuickPlayLabel{font-size:15px;font-weight:750;letter-spacing:.02em}
    .readerQuickPlay:active{transform:scale(.97)}
    @media(max-width:390px){.readerQuickBar{padding-left:10px;padding-right:10px}.readerQuickBar button{font-size:13px!important}.readerQuickPlay .readerQuickPlayLabel{font-size:14px}}
    #detail.hasReaderQuickBar #detailBody{padding-bottom:calc(76px + env(safe-area-inset-bottom))!important}
    #detail.hasReaderQuickBar #readerBottomNav,
    #detail.hasReaderQuickBar #detailActions,
    #detail.hasReaderQuickBar .readerNav,
    #detail.hasReaderQuickBar .egwChapterPager,
    #detail.hasReaderQuickBar .readAloudBar{display:none!important}
  `;
  document.head.appendChild(style);
  ensureBar();
})();
