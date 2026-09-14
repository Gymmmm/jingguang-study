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
      <button type="button" class="readerQuickToc" data-reader-quick="toc" aria-label="返回目录">
        <span class="readerQuickTocIcon" aria-hidden="true">☰</span><b>目录</b>
      </button>
      <button type="button" class="readerQuickPlay" data-reader-quick="tts" aria-label="开始朗读">
        <span class="readerQuickPlayIcon" aria-hidden="true">▶</span>
      </button>
      <span class="readerQuickChapterGroup"><button type="button" class="readerQuickChapter readerQuickPrev" data-reader-quick="prev" aria-label="上一章">‹</button><button type="button" class="readerQuickChapter readerQuickNext" data-reader-quick="next" aria-label="下一章">›</button></span>`;
    detail.appendChild(bar);
    return bar;
  }

  function syncPlayState() {
    const bar = ensureBar();
    const quick = bar.querySelector('[data-reader-quick="tts"]');
    const icon = quick?.querySelector('.readerQuickPlayIcon');
    if (!quick || !icon) return;
    const s = typeof window.jgReadAloudState === 'function'
      ? window.jgReadAloudState()
      : { speaking:false, paused:false };
    const active = !!s.speaking && !s.paused;
    icon.textContent = active ? 'Ⅱ' : '▶';
    quick.setAttribute('aria-label', active ? '暂停朗读' : (s.paused ? '继续朗读' : '开始朗读'));
    quick.dataset.playing = active ? '1' : (s.paused ? 'paused' : 'idle');
    quick.dataset.state = s.paused ? 'paused' : (active ? 'playing' : 'idle');
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
      if (typeof window.jgReadAloudToggle === 'function') window.jgReadAloudToggle();
      else ttsButton()?.click();
      syncPlayState();
      return;
    }
    if (action === 'toc') {
      detail.querySelector('#back')?.click();
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

  const style = document.createElement('style');
  style.textContent = `
    .readerQuickBar[hidden]{display:none!important}
    .readerQuickBar{position:fixed;z-index:30;left:50%;bottom:0;transform:translateX(-50%);width:min(720px,100%);display:grid;grid-template-columns:1fr 72px 1fr;align-items:center;gap:8px;padding:8px 18px calc(8px + env(safe-area-inset-bottom));border-top:1px solid color-mix(in srgb,var(--line) 72%,transparent);background:color-mix(in srgb,var(--surface) 96%,transparent);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
    .readerQuickBar button{border:0!important;background:transparent!important;box-shadow:none!important;color:var(--accent)!important;-webkit-tap-highlight-color:transparent}
    .readerQuickToc{min-height:44px!important;display:flex;align-items:center;justify-content:flex-start;gap:7px;padding:4px 0!important;font-size:13px!important;font-weight:750!important}
    .readerQuickTocIcon{font-size:17px;line-height:1;color:var(--muted)}
    .readerQuickPlay{width:58px;height:58px;min-height:58px!important;justify-self:center;display:flex;align-items:center;justify-content:center;padding:0!important;border-radius:50%!important;background:var(--accent)!important;color:var(--surface)!important;box-shadow:0 6px 18px color-mix(in srgb,var(--accent) 25%,transparent)!important;transition:transform .16s ease,background .16s ease}
    .readerQuickPlay:active{transform:scale(.94)}
    .readerQuickPlayIcon{font-size:19px;line-height:1;font-weight:800;transform:translateX(1px)}
    .readerQuickPlay[data-state="playing"] .readerQuickPlayIcon{font-size:17px;transform:none}
    .readerQuickPlay[data-state="paused"]{background:color-mix(in srgb,var(--accent) 86%,black)!important}
    .readerQuickChapterGroup{display:flex;justify-content:flex-end;gap:4px}.readerQuickChapter{width:36px;min-height:40px!important;padding:0!important;border:1px solid var(--line)!important;border-radius:9px!important;font-size:22px!important}.readerQuickChapter:disabled{opacity:.35}.readerQuickBalance{display:block;min-height:44px}
    @media(max-width:390px){.readerQuickBar{grid-template-columns:1fr 64px 1fr;padding-left:14px;padding-right:14px}.readerQuickPlay{width:54px;height:54px;min-height:54px!important}.readerQuickToc{font-size:12px!important}}
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
