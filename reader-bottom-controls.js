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
      <span class="readerQuickChapterLabel" aria-hidden="true">章节导航</span>
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
    .readerQuickBar{position:fixed;z-index:30;left:50%;bottom:0;transform:translateX(-50%);width:min(720px,100%);display:grid;grid-template-columns:minmax(0,1fr) minmax(70px,.7fr) minmax(0,1fr);align-items:center;gap:8px;padding:7px 14px calc(7px + env(safe-area-inset-bottom));border-top:1px solid color-mix(in srgb,var(--line) 72%,transparent);background:color-mix(in srgb,var(--surface) 95%,transparent);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
    .readerQuickBar button{border:0!important;background:transparent!important;box-shadow:none!important;color:var(--accent)!important;-webkit-tap-highlight-color:transparent}
    .readerQuickChapter{min-width:0;min-height:42px!important;display:flex;align-items:center;gap:4px;padding:4px 2px!important;font-size:13px!important;font-weight:700!important;line-height:1.3;text-align:left}
    .readerQuickPrev{justify-content:flex-start}.readerQuickNext{justify-content:flex-end;text-align:right}
    .readerQuickChapter>span{flex:0 0 auto;font-size:22px;line-height:1}.readerQuickChapter>b{font:inherit;overflow-wrap:anywhere}.readerQuickChapter:disabled{opacity:.35}
    .readerQuickChapterLabel{color:var(--muted);font-size:10px;text-align:center;white-space:nowrap}
    #detail.hasReaderQuickBar #detailBody{padding-bottom:calc(76px + env(safe-area-inset-bottom))!important}
    #detail.hasReaderQuickBar #readerBottomNav{display:none!important}
    #detail.hasReaderQuickBar .readerNav,
    #detail.hasReaderQuickBar .egwChapterPager{display:none!important}
    @media(max-width:720px){
      #detail.hasReaderQuickBar .readAloudBar{display:none!important}
      #detail.hasReaderQuickBar #detailActions{position:fixed;z-index:29;left:50%;bottom:calc(62px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(720px,100%);margin:0;padding:5px 12px;border-top:1px solid var(--line);background:color-mix(in srgb,var(--surface) 95%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
      #detail.hasReaderQuickBar #detailBody{padding-bottom:calc(132px + env(safe-area-inset-bottom))!important}
    }
    @media(max-width:390px){.readerQuickBar{grid-template-columns:minmax(0,1fr) 58px minmax(0,1fr);padding-left:10px;padding-right:10px}.readerQuickChapter{font-size:12px!important}.readerQuickChapterLabel{font-size:9px}}
    @media(min-width:721px){#detail.hasReaderQuickBar #detailActions{position:fixed;z-index:29;left:50%;bottom:calc(62px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(720px,100%);margin:0;padding:5px 12px;background:color-mix(in srgb,var(--surface) 95%,transparent)}}
  `;
  document.head.appendChild(style);
  ensureBar();
})();
