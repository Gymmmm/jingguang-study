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

  function favoriteSource() {
    return detail.querySelector('[data-egw-native-favorite], [data-favorite-bible]');
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
        <small class="readerQuickPlayLabel">朗读</small>
      </button>
      <button type="button" class="readerQuickFav" data-reader-quick="favorite" aria-label="收藏">
        <span class="readerQuickFavIcon" aria-hidden="true">☆</span><b>收藏</b>
      </button>`;
    detail.appendChild(bar);
    return bar;
  }

  function syncPlayState() {
    const bar = ensureBar();
    const quick = bar.querySelector('[data-reader-quick="tts"]');
    const icon = quick?.querySelector('.readerQuickPlayIcon');
    const label = quick?.querySelector('.readerQuickPlayLabel');
    if (!quick || !icon) return;
    const s = typeof window.jgReadAloudState === 'function'
      ? window.jgReadAloudState()
      : { speaking:false, paused:false };
    const active = !!s.speaking && !s.paused;
    icon.textContent = active ? 'Ⅱ' : '▶';
    if (label) label.textContent = active ? '暂停' : (s.paused ? '继续' : '朗读');
    quick.setAttribute('aria-label', active ? '暂停朗读' : (s.paused ? '继续朗读' : '开始朗读'));
    quick.dataset.playing = active ? '1' : (s.paused ? 'paused' : 'idle');
    quick.dataset.state = s.paused ? 'paused' : (active ? 'playing' : 'idle');
  }

  function syncFavoriteState() {
    const bar = ensureBar();
    const fav = bar.querySelector('[data-reader-quick="favorite"]');
    const icon = fav?.querySelector('.readerQuickFavIcon');
    const label = fav?.querySelector('b');
    if (!fav || !icon) return;
    const src = favoriteSource();
    const text = String(src?.textContent || '');
    const on = /已收藏|★/.test(text);
    icon.textContent = on ? '★' : '☆';
    if (label) label.textContent = on ? '已藏' : '收藏';
    fav.dataset.on = on ? '1' : '0';
    fav.setAttribute('aria-label', on ? '取消收藏' : '收藏');
  }

  function refresh() {
    const bar = ensureBar();
    const show = detail.open && readable();
    bar.hidden = !show;
    detail.classList.toggle('hasReaderQuickBar', show);
    if (!show) return;
    syncPlayState();
    syncFavoriteState();
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
    if (action === 'favorite') {
      const src = favoriteSource();
      if (src) {
        src.click();
        queueMicrotask(syncFavoriteState);
      }
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
    if (detail.classList.contains('hasReaderQuickBar')) syncFavoriteState();
  });
  mo.observe(detail, { childList: true, subtree: true, characterData: true });

  const style = document.createElement('style');
  style.textContent = `
    .readerQuickBar[hidden]{display:none!important}
    .readerQuickBar{position:fixed;z-index:30;left:50%;bottom:0;transform:translateX(-50%);width:min(720px,100%);display:grid;grid-template-columns:1fr 72px 1fr;align-items:end;gap:8px;padding:6px 18px calc(6px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:color-mix(in srgb,var(--surface) 96%,transparent);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
    .readerQuickBar button{border:0!important;background:transparent!important;box-shadow:none!important;color:var(--muted)!important;-webkit-tap-highlight-color:transparent}
    .readerQuickToc,.readerQuickFav{min-height:48px!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:4px 0!important;font-size:11px!important;font-weight:600!important;color:var(--muted)!important}
    .readerQuickToc b,.readerQuickFav b{font-weight:600;color:var(--muted)}
    .readerQuickTocIcon,.readerQuickFavIcon{font-size:18px;line-height:1;color:var(--text)}
    .readerQuickFav[data-on="1"] .readerQuickFavIcon{color:var(--accent)}
    .readerQuickBar button.readerQuickPlay{position:relative;width:58px;height:58px;min-height:58px!important;justify-self:center;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0!important;margin:0 0 14px;border-radius:50%!important;background:var(--accent)!important;color:#fff!important;box-shadow:0 6px 18px color-mix(in srgb,var(--accent) 28%,transparent)!important;transition:transform .16s ease,background .16s ease}
    .readerQuickPlay:active{transform:scale(.94)}
    .readerQuickBar button.readerQuickPlay .readerQuickPlayIcon{font-size:18px;line-height:1;font-weight:800;transform:translateX(1px);color:#fff!important}
    .readerQuickBar button.readerQuickPlay .readerQuickPlayLabel{position:absolute;left:50%;bottom:-18px;transform:translateX(-50%);font-size:10px;font-weight:600;color:var(--muted)!important;white-space:nowrap}
    .readerQuickPlay[data-state="playing"] .readerQuickPlayIcon{font-size:16px;transform:none}
    .readerQuickPlay[data-state="paused"]{background:color-mix(in srgb,var(--accent) 86%,black)!important}
    @media(max-width:390px){.readerQuickBar{grid-template-columns:1fr 64px 1fr;padding-left:12px;padding-right:12px}.readerQuickPlay{width:54px;height:54px;min-height:54px!important}}
    #detail.hasReaderQuickBar #detailBody{padding-bottom:calc(88px + env(safe-area-inset-bottom))!important}
    #detail.hasReaderQuickBar #readerBottomNav,
    #detail.hasReaderQuickBar #detailActions,
    #detail.hasReaderQuickBar .readerNav,
    #detail.hasReaderQuickBar .egwChapterPager,
    #detail.hasReaderQuickBar .readAloudBar{display:none!important}
  `;
  document.head.appendChild(style);
  ensureBar();
})();
