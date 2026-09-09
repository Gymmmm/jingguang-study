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
    if (bar) return bar;
    bar = document.createElement('nav');
    bar.id = 'readerQuickBar';
    bar.className = 'readerQuickBar';
    bar.setAttribute('aria-label', '阅读快速控制');
    bar.hidden = true;
    bar.innerHTML = `
      <button type="button" class="readerQuickChapter readerQuickPrev" data-reader-quick="prev" aria-label="上一章">
        <span aria-hidden="true">‹</span><b>上一章</b>
      </button>
      <button type="button" class="readerQuickPlay" data-reader-quick="tts" aria-label="开始朗读">
        <span class="readerQuickPlayIcon" aria-hidden="true">▶</span>
        <small>朗读</small>
      </button>
      <button type="button" class="readerQuickChapter readerQuickNext" data-reader-quick="next" aria-label="下一章">
        <b>下一章</b><span aria-hidden="true">›</span>
      </button>`;
    detail.appendChild(bar);
    return bar;
  }

  function syncPlayState() {
    const bar = ensureBar();
    const quick = bar.querySelector('[data-reader-quick="tts"]');
    const icon = quick?.querySelector('.readerQuickPlayIcon');
    const label = quick?.querySelector('small');
    if (!quick || !icon || !label) return;
    const s = typeof window.jgReadAloudState === 'function'
      ? window.jgReadAloudState()
      : { speaking:false, paused:false };
    const active = !!s.speaking && !s.paused;
    icon.textContent = active ? 'Ⅱ' : '▶';
    label.textContent = active ? '暂停' : (s.paused ? '继续' : '朗读');
    quick.setAttribute('aria-label', active ? '暂停朗读' : (s.paused ? '继续朗读' : '开始朗读'));
    quick.dataset.playing = active ? '1' : '0';
  }

  function refresh() {
    const bar = ensureBar();
    const show = detail.open && readable();
    bar.hidden = !show;
    detail.classList.toggle('hasReaderQuickBar', show);
    if (!show) return;

    const prev = findChapterButton('prev');
    const next = findChapterButton('next');
    const prevQuick = bar.querySelector('[data-reader-quick="prev"]');
    const nextQuick = bar.querySelector('[data-reader-quick="next"]');
    if (prevQuick) {
      prevQuick.disabled = !prev;
      prevQuick.hidden = false;
      prevQuick.setAttribute('aria-disabled', prev ? 'false' : 'true');
    }
    if (nextQuick) {
      nextQuick.disabled = !next;
      nextQuick.hidden = false;
      nextQuick.setAttribute('aria-disabled', next ? 'false' : 'true');
    }
    syncPlayState();
  }

  detail.addEventListener('click', event => {
    const control = event.target.closest?.('[data-reader-quick]');
    if (!control || control.disabled) return;
    const action = control.dataset.readerQuick;
    if (action === 'tts') {
      ttsButton()?.click();
      return;
    }
    const target = findChapterButton(action);
    if (target && !target.disabled) target.click();
  });

  detail.addEventListener('jg-read-aloud-state', syncPlayState);
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

  const style = document.createElement('style');
  style.textContent = `
    .readerQuickBar[hidden]{display:none!important}
    .readerQuickBar{position:fixed;z-index:30;left:50%;bottom:0;transform:translateX(-50%);width:min(720px,100%);display:grid;grid-template-columns:1fr 72px 1fr;align-items:center;gap:6px;padding:6px 16px calc(6px + env(safe-area-inset-bottom));border-top:1px solid color-mix(in srgb,var(--line) 72%,transparent);background:color-mix(in srgb,var(--surface) 94%,transparent);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
    .readerQuickBar button{border:0!important;background:transparent!important;box-shadow:none!important;color:var(--muted)!important;-webkit-tap-highlight-color:transparent}
    .readerQuickChapter{min-height:42px!important;display:flex;align-items:center;gap:4px;padding:0 4px!important;font-size:11px!important;font-weight:560!important}
    .readerQuickPrev{justify-content:flex-start}.readerQuickNext{justify-content:flex-end}
    .readerQuickChapter>span{font-size:19px;line-height:1}.readerQuickChapter>b{font:inherit}.readerQuickChapter:disabled{opacity:.18}
    .readerQuickPlay{width:50px;height:50px;min-height:50px!important;justify-self:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:0!important;border-radius:50%!important;background:var(--accent)!important;color:var(--surface)!important;box-shadow:0 4px 13px color-mix(in srgb,var(--accent) 17%,transparent)!important}
    .readerQuickPlayIcon{font-size:17px;font-weight:800;line-height:1;transform:translateX(1px)}.readerQuickPlay[data-playing="1"] .readerQuickPlayIcon{transform:none;font-size:16px;letter-spacing:-2px}.readerQuickPlay small{font-size:8px;line-height:1;color:inherit}
    #detail.hasReaderQuickBar #detailBody{padding-bottom:78px!important}
    /* One chapter control surface on mobile: sticky quick bar wins. */
    #detail.hasReaderQuickBar #readerBottomNav{display:none!important}
    #detail.hasReaderQuickBar .readerNav,
    #detail.hasReaderQuickBar .egwChapterPager{display:none!important}
    @media(max-width:720px){
      #detail.hasReaderQuickBar .readAloudBar{display:none!important}
    }
    @media(max-width:390px){.readerQuickBar{grid-template-columns:1fr 64px 1fr;padding-left:12px;padding-right:12px}.readerQuickPlay{width:48px;height:48px;min-height:48px!important}.readerQuickChapter{font-size:11px!important}}
  `;
  document.head.appendChild(style);
  ensureBar();
})();
