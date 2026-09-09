(() => {
  'use strict';

  const detail = document.getElementById('detail');
  const body = document.getElementById('detailBody');
  const crossButton = document.getElementById('readerCrossIndex');
  const bottomNav = document.getElementById('readerBottomNav');
  if (!detail || !body || !crossButton || !bottomNav) return;

  const canonicalEgw = value => String(value || '')
    .trim()
    .replace(/[?#].*$/, '')
    .replace(/\/$/, '')
    .replace(/^https?:\/\/(?:m\.|text\.)?egwwritings\.org\/zh\/book\/(\d+)\.(\d+)$/i, 'https://text.egwwritings.org/read/$1.$2')
    .replace(/^https?:\/\/(?:m\.|text\.)?egwwritings\.org\/read\/(\d+)\.(\d+)$/i, 'https://text.egwwritings.org/read/$1.$2');

  const readPos = value => {
    const m = canonicalEgw(value).match(/\/read\/(\d+)\.(\d+)$/i);
    return m ? {bookId:m[1], pos:+m[2]} : null;
  };

  const titleKey = value => String(value || '')
    .replace(/[《》〈〉]/g, '')
    .replace(/\s+/g, '')
    .replace(/[：:]/g, '')
    .trim();

  const tocCache = new Map();
  let currentEgwUrl = '';
  let pagerRequest = 0;
  let refreshTimer = 0;

  function readerKind() {
    return detail.dataset.readerKind || '';
  }

  function isReaderOpen() {
    const kind = readerKind();
    return detail.open && (kind === 'bible-reader' || kind === 'egw-reader');
  }

  function lastEgw() {
    try { return JSON.parse(localStorage.getItem('jg_last_egw_native') || 'null'); }
    catch (_) { return null; }
  }

  function setCrossButton() {
    crossButton.hidden = !isReaderOpen();
    if (!crossButton.hidden) {
      crossButton.setAttribute('aria-label', '打开关联');
      crossButton.querySelector('b').textContent = '关联';
    }
  }

  function openCrossIndex(focus) {
    try { window.jgRefreshCrossIndex?.(); } catch (_) {}
    if (typeof window.jgOpenCrossIndex === 'function') {
      window.jgOpenCrossIndex(focus || null);
      return;
    }
    const tryOpen = () => {
      const handle = detail.querySelector('.crossIndexHandle[data-cross-index-open]');
      if (!handle) return false;
      handle.hidden = false;
      handle.click();
      return true;
    };
    if (!tryOpen()) setTimeout(tryOpen, 160);
  }

  function focusFromLinked(linked) {
    if (!linked) return null;
    if (linked.matches?.('.reading>.verse, .verse') || linked.classList?.contains('verse')) {
      const verse = +linked.dataset.verse;
      return Number.isFinite(verse) ? {verse} : null;
    }
    const para = linked.querySelector?.('.egwParagraph') || (linked.classList?.contains('egwParagraph') ? linked : null);
    return para ? {paragraphEl: para} : null;
  }

  crossButton.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    openCrossIndex();
  });

  function makeInlineLinksClickable() {
    body.querySelectorAll('.egwParagraphWrap.crossLinked,.reading>.verse.crossLinked').forEach(row => {
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-label', '查看这一处的关联');
    });
  }

  detail.addEventListener('click', event => {
    if (event.target.closest('button,a,input,select,textarea')) return;
    const linked = event.target.closest('.egwParagraphWrap.crossLinked,.reading>.verse.crossLinked');
    if (!linked) return;
    event.preventDefault();
    openCrossIndex(focusFromLinked(linked));
  }, true);

  detail.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const linked = event.target.closest('.egwParagraphWrap.crossLinked,.reading>.verse.crossLinked');
    if (!linked) return;
    event.preventDefault();
    openCrossIndex(focusFromLinked(linked));
  });

  function clearBottomNav() {
    bottomNav.innerHTML = '';
    bottomNav.hidden = true;
    delete bottomNav.dataset.kind;
  }

  function fillBibleBottomNav() {
    if (!detail.open || readerKind() !== 'bible-reader') return false;
    const topPager = body.querySelector('.readerNav');
    if (!topPager) return false;
    bottomNav.innerHTML = topPager.innerHTML;
    bottomNav.dataset.kind = 'bible';
    bottomNav.hidden = false;
    return true;
  }

  async function tocFor(url) {
    const pos = readPos(url);
    const key = pos?.bookId || url;
    if (tocCache.has(key)) return tocCache.get(key);
    const promise = fetch(`/api/egw-read?toc=1&url=${encodeURIComponent(url)}`, {cache:'force-cache'})
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data?.ok || !Array.isArray(data.chapters) || !data.chapters.length) {
          throw new Error('toc_unavailable');
        }
        return data.chapters;
      })
      .catch(error => {
        tocCache.delete(key);
        throw error;
      });
    tocCache.set(key, promise);
    return promise;
  }

  function locateChapter(chapters, url, title) {
    let index = chapters.findIndex(ch => canonicalEgw(ch?.url) === canonicalEgw(url));
    if (index >= 0) return index;

    const pos = readPos(url);
    if (pos) {
      const exact = chapters
        .map((ch, i) => ({i, p:readPos(ch?.url)}))
        .find(x => x.p?.bookId === pos.bookId && x.p.pos === pos.pos);
      if (exact) return exact.i;
    }

    const key = titleKey(title);
    if (!key) return -1;
    return chapters.findIndex(ch => {
      const candidate = titleKey(ch?.title);
      return candidate && (candidate === key || candidate.includes(key) || key.includes(candidate));
    });
  }

  function egwPagerButton(item, label, direction, saved) {
    if (!item) return '<span></span>';
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const bookTitle = saved?.title || body.querySelector('.egwBookName')?.textContent || '怀爱伦著作';
    const bookId = saved?.bookId || readPos(item.url)?.bookId || '';
    const tocUrl = saved?.tocUrl || '';
    return `<button type="button" data-egw-native-url="${esc(item.url || '')}" data-egw-title="${esc(bookTitle)}" data-egw-book-id="${esc(bookId)}" data-egw-toc-url="${esc(tocUrl)}" data-egw-chapter="${esc(item.title || '')}"><small>${label}</small><span>${direction === 'prev' ? '‹ ' : ''}${esc(item.title || '')}${direction === 'next' ? ' ›' : ''}</span></button>`;
  }

  async function fillEgwBottomNav() {
    if (!detail.open || readerKind() !== 'egw-reader') return false;
    const saved = lastEgw();
    const url = canonicalEgw(currentEgwUrl || detail.dataset.egwCurrentUrl || saved?.url || saved?.native_url || '');
    if (!url) return false;

    const requestId = ++pagerRequest;
    try {
      const chapters = await tocFor(url);
      if (requestId !== pagerRequest || !detail.open || readerKind() !== 'egw-reader') return false;
      const index = locateChapter(chapters, url, document.getElementById('detailType')?.textContent || saved?.chapter || '');
      if (index < 0) return false;

      const prev = index > 0 ? chapters[index - 1] : null;
      const next = index < chapters.length - 1 ? chapters[index + 1] : null;
      if (!prev && !next) return false;

      bottomNav.innerHTML = `${egwPagerButton(prev, '上一章', 'prev', saved)}${egwPagerButton(next, '下一章', 'next', saved)}`;
      bottomNav.dataset.kind = 'egw';
      bottomNav.hidden = false;
      return true;
    } catch (error) {
      console.warn('EGW bottom pager failed', error);
      return false;
    }
  }

  function refreshControls() {
    clearTimeout(refreshTimer);
    setCrossButton();
    if (!isReaderOpen()) {
      clearBottomNav();
      return;
    }
    try { window.jgRefreshCrossIndex?.(); } catch (_) {}
    makeInlineLinksClickable();
    if (readerKind() === 'bible-reader') {
      fillBibleBottomNav();
    } else {
      clearBottomNav();
      fillEgwBottomNav();
    }
  }

  function scheduleRefresh(delay = 0) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshControls();
      requestAnimationFrame(() => {
        setCrossButton();
        makeInlineLinksClickable();
        if (readerKind() === 'bible-reader' && bottomNav.hidden) fillBibleBottomNav();
      });
    }, delay);
  }

  document.addEventListener('click', event => {
    const egw = event.target.closest?.('[data-egw-native-url]');
    if (egw?.dataset.egwNativeUrl) {
      currentEgwUrl = canonicalEgw(egw.dataset.egwNativeUrl);
      detail.dataset.egwCurrentUrl = currentEgwUrl;
      pagerRequest += 1;
      scheduleRefresh(80);
      return;
    }
    if (event.target.closest?.('[data-bible]')) scheduleRefresh(80);
  }, true);

  const previousOpenEgw = window.jgOpenNativeEgw;
  if (typeof previousOpenEgw === 'function' && !previousOpenEgw.__staticReaderControls) {
    const wrappedOpen = (url, meta) => {
      currentEgwUrl = canonicalEgw(url);
      detail.dataset.egwCurrentUrl = currentEgwUrl;
      pagerRequest += 1;
      const result = previousOpenEgw(url, meta);
      Promise.resolve(result).finally(() => scheduleRefresh(0));
      return result;
    };
    wrappedOpen.__staticReaderControls = true;
    window.jgOpenNativeEgw = wrappedOpen;
  }

  const previousRefreshReadAloud = window.jgRefreshReadAloud;
  if (typeof previousRefreshReadAloud === 'function' && !previousRefreshReadAloud.__staticReaderControls) {
    const wrappedRefresh = (...args) => {
      const result = previousRefreshReadAloud(...args);
      queueMicrotask(refreshControls);
      return result;
    };
    wrappedRefresh.__staticReaderControls = true;
    window.jgRefreshReadAloud = wrappedRefresh;
  }

  window.jgRefreshReaderControls = refreshControls;

  detail.addEventListener('close', () => {
    pagerRequest += 1;
    currentEgwUrl = '';
    crossButton.hidden = true;
    clearBottomNav();
  });

  window.addEventListener('load', () => scheduleRefresh(0), {once:true});

  const style = document.createElement('style');
  style.textContent = `
    #readerCrossIndex[hidden],#readerBottomNav[hidden]{display:none!important}
    #readerCrossIndex{
      position:fixed!important;
      top:50%!important;
      right:max(7px,env(safe-area-inset-right))!important;
      bottom:auto!important;
      transform:translateY(-50%)!important;
      z-index:80!important;
      display:flex!important;
      align-items:center!important;
      gap:4px!important;
      min-height:40px!important;
      padding:0 10px!important;
      border:1px solid color-mix(in srgb,var(--accent) 34%,var(--line))!important;
      border-radius:999px!important;
      background:color-mix(in srgb,var(--surface) 94%,transparent)!important;
      color:var(--accent)!important;
      font-size:10px!important;
      box-shadow:0 4px 18px #00000018!important;
      backdrop-filter:blur(12px)!important;
      pointer-events:auto!important;
    }
    #readerCrossIndex b{font-size:10px!important;font-weight:700!important}
    #detail .crossIndexHandle{display:none!important}
    #detail .egwParagraphWrap.crossLinked,
    #detail .reading>.verse.crossLinked{cursor:pointer;-webkit-tap-highlight-color:transparent}
    #detail .egwParagraphWrap.crossLinked::after,
    #detail .reading>.verse.crossLinked::after{pointer-events:none}

    #readerBottomNav{
      width:min(680px,calc(100% - 36px));
      margin:12px auto 18px!important;
      padding:18px 0 0!important;
      border-top:1px solid var(--line)!important;
      background:transparent!important;
    }
    #readerBottomNav[data-kind="bible"]{display:flex!important;justify-content:space-between!important;gap:14px!important}
    #readerBottomNav[data-kind="egw"]{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:14px!important}
    #readerBottomNav button{
      flex:1!important;
      min-width:0!important;
      min-height:58px!important;
      padding:8px 2px!important;
      border:0!important;
      background:transparent!important;
      color:var(--egw-accent,var(--accent))!important;
      box-shadow:none!important;
    }
    #readerBottomNav button:first-child{text-align:left!important;align-items:flex-start!important}
    #readerBottomNav button:last-child{text-align:right!important;align-items:flex-end!important}
    #readerBottomNav[data-kind="egw"] button{display:flex!important;flex-direction:column!important;justify-content:center!important;gap:4px!important}
    #readerBottomNav small{font-size:10px!important;color:var(--muted)!important}
    #readerBottomNav span{max-width:100%;font-size:13px!important;line-height:1.45!important;white-space:normal!important}
  `;
  document.head.appendChild(style);

  scheduleRefresh(0);
})();