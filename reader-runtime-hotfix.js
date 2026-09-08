(() => {
  'use strict';

  const detail = document.getElementById('detail');
  const body = document.getElementById('detailBody');
  const fontTools = detail?.querySelector('.fontTools');
  if (!detail || !body || !fontTools) return;

  const TOC_PREFIX = 'jg_egw_toc_context_';
  const canonicalEgw = value => String(value || '')
    .trim()
    .replace(/[?#].*$/, '')
    .replace(/\/$/, '')
    .replace(/^https?:\/\/(?:m\.|text\.)?egwwritings\.org\/zh\/book\/(\d+)\.(\d+)$/i, 'https://text.egwwritings.org/read/$1.$2')
    .replace(/^https?:\/\/(?:m\.|text\.)?egwwritings\.org\/read\/(\d+)\.(\d+)$/i, 'https://text.egwwritings.org/read/$1.$2');

  const titleKey = value => String(value || '')
    .replace(/[《》〈〉]/g, '')
    .replace(/\s+/g, '')
    .replace(/[：:]/g, '')
    .trim();

  const readPos = value => {
    const m = canonicalEgw(value).match(/\/read\/(\d+)\.(\d+)$/i);
    return m ? {bookId:m[1], pos:+m[2]} : null;
  };

  function lastEgw() {
    try { return JSON.parse(localStorage.getItem('jg_last_egw_native') || 'null'); }
    catch (_) { return null; }
  }

  let capturedUrl = '';
  let tocContext = null;
  const tocCache = new Map();
  let pagerSeq = 0;
  let timer = 0;
  let lastCrossSignature = '';

  function readerOpen() {
    const kind = detail.dataset.readerKind;
    return detail.open && (kind === 'bible-reader' || kind === 'egw-reader');
  }

  function currentEgwUrl() {
    const saved = lastEgw();
    return canonicalEgw(saved?.url || saved?.native_url || detail.dataset.egwCurrentUrl || capturedUrl || '');
  }

  function readerSignature() {
    if (!detail.open) return '';
    if (detail.dataset.readerKind === 'egw-reader') {
      const url = currentEgwUrl();
      return url ? `egw:${url}` : '';
    }
    if (detail.dataset.readerKind === 'bible-reader') {
      return detail.dataset.readingKey ? `bible:${detail.dataset.readingKey}` : '';
    }
    return '';
  }

  function ensureTopCrossButton() {
    let btn = fontTools.querySelector('.crossIndexTopButton');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'crossIndexTopButton';
      btn.dataset.crossIndexOpen = '1';
      btn.setAttribute('aria-label', '打开互相索引');
      btn.title = '互相索引';
      btn.innerHTML = '<span aria-hidden="true">↔</span>';
      fontTools.appendChild(btn);
    }
    btn.hidden = !readerOpen();
    return btn;
  }

  function openCrossIndex() {
    syncCrossIndex(true);
    queueMicrotask(() => {
      const handle = detail.querySelector('.crossIndexHandle[data-cross-index-open]');
      if (handle) handle.click();
    });
  }

  detail.addEventListener('click', event => {
    if (event.target.closest('button,a,input,select,textarea')) return;
    const linked = event.target.closest('.egwParagraphWrap.crossLinked,.reading>.verse.crossLinked');
    if (!linked) return;
    event.preventDefault();
    openCrossIndex();
  });

  detail.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const linked = event.target.closest('.egwParagraphWrap.crossLinked,.reading>.verse.crossLinked');
    if (!linked) return;
    event.preventDefault();
    openCrossIndex();
  });

  function makeLinkedMarksFocusable() {
    body.querySelectorAll('.egwParagraphWrap.crossLinked,.reading>.verse.crossLinked').forEach(row => {
      if (!row.hasAttribute('tabindex')) row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-label', '查看这一处的互相索引');
    });
  }

  function syncCrossIndex(force = false) {
    ensureTopCrossButton();
    makeLinkedMarksFocusable();
    const signature = readerSignature();
    if (!signature) return;
    if (!force && signature === lastCrossSignature) return;
    lastCrossSignature = signature;
    try { window.jgRefreshCrossIndex?.(); } catch (_) {}
    requestAnimationFrame(() => requestAnimationFrame(makeLinkedMarksFocusable));
  }

  function saveTocContext(context) {
    if (!context?.bookId || !Array.isArray(context.chapters) || !context.chapters.length) return;
    tocContext = context;
    try { localStorage.setItem(TOC_PREFIX + context.bookId, JSON.stringify(context)); } catch (_) {}
  }

  function readTocContext(bookId) {
    if (!bookId) return null;
    if (tocContext?.bookId === bookId && tocContext.chapters?.length) return tocContext;
    try {
      const value = JSON.parse(localStorage.getItem(TOC_PREFIX + bookId) || 'null');
      if (value?.bookId === bookId && Array.isArray(value.chapters) && value.chapters.length) {
        tocContext = value;
        return value;
      }
    } catch (_) {}
    return null;
  }

  function captureVisibleToc() {
    const list = body.querySelector('.egwChapterList');
    if (!list) return null;
    const rows = [...list.querySelectorAll('[data-egw-native-url]')];
    if (!rows.length) return null;
    const first = rows[0];
    const bookId = String(first.dataset.egwBookId || readPos(first.dataset.egwNativeUrl)?.bookId || '');
    if (!bookId) return null;
    const context = {
      bookId,
      tocUrl:first.dataset.egwTocUrl || '',
      bookTitle:first.dataset.egwBookTitle || '',
      chapters:rows.map(row => ({
        url:canonicalEgw(row.dataset.egwNativeUrl),
        title:row.dataset.egwDisplayTitle || row.dataset.egwChapterTitle || ''
      })).filter(item => item.url)
    };
    saveTocContext(context);
    return context;
  }

  /* Capture the visible official TOC before older document handlers replace it with the reader. */
  window.addEventListener('click', event => {
    const row = event.target.closest?.('.egwChapterRow,[data-egw-chapter-title]');
    if (!row) return;
    captureVisibleToc();
  }, true);

  function locateChapter(chapters, currentUrl, currentTitle) {
    let index = chapters.findIndex(ch => canonicalEgw(ch?.url) === currentUrl);
    if (index >= 0) return index;

    const current = readPos(currentUrl);
    if (current) {
      const sameBook = chapters
        .map((ch, i) => ({i, p:readPos(ch?.url)}))
        .filter(x => x.p && x.p.bookId === current.bookId)
        .sort((a, b) => a.p.pos - b.p.pos);
      if (sameBook.length) {
        let chosen = sameBook[0];
        for (const item of sameBook) {
          if (item.p.pos <= current.pos) chosen = item;
          else break;
        }
        return chosen.i;
      }
    }

    const key = titleKey(currentTitle);
    if (key) {
      index = chapters.findIndex(ch => {
        const candidate = titleKey(ch?.title);
        return candidate && (candidate === key || candidate.includes(key) || key.includes(candidate));
      });
    }
    return index;
  }

  function pagerButton(item, label, direction, context, saved) {
    if (!item) return document.createElement('span');
    const el = document.createElement('button');
    el.type = 'button';
    el.dataset.egwNativeUrl = item.url || '';
    el.dataset.egwTitle = context?.bookTitle || saved?.title || body.querySelector('.egwBookName')?.textContent || '怀爱伦著作';
    el.dataset.egwBookId = context?.bookId || saved?.bookId || readPos(item.url)?.bookId || '';
    el.dataset.egwTocUrl = context?.tocUrl || saved?.tocUrl || '';
    el.dataset.egwChapter = item.title || '';
    el.innerHTML = `<small>${label}</small><span>${direction === 'prev' ? '‹ ' : ''}${String(item.title || '')}${direction === 'next' ? ' ›' : ''}</span>`;
    return el;
  }

  function appendPager(article, prev, next, context, saved) {
    if (!article || article.querySelector('.egwChapterPager') || (!prev && !next)) return false;
    const nav = document.createElement('nav');
    nav.className = 'egwChapterPager';
    nav.setAttribute('aria-label', '章节导航');
    nav.append(
      pagerButton(prev, '上一章', 'prev', context, saved),
      pagerButton(next, '下一章', 'next', context, saved)
    );
    article.appendChild(nav);
    return true;
  }

  function pagerFromCachedToc(article, currentUrl, saved) {
    const bookId = String(saved?.bookId || readPos(currentUrl)?.bookId || '');
    const context = readTocContext(bookId);
    if (!context?.chapters?.length) return false;
    const index = locateChapter(context.chapters, currentUrl, document.getElementById('detailType')?.textContent || saved?.chapter || '');
    if (index < 0) return false;
    const prev = index > 0 ? context.chapters[index - 1] : null;
    const next = index < context.chapters.length - 1 ? context.chapters[index + 1] : null;
    return appendPager(article, prev, next, context, saved);
  }

  async function tocFor(currentUrl) {
    const pos = readPos(currentUrl);
    const key = pos?.bookId || currentUrl;
    if (tocCache.has(key)) return tocCache.get(key);
    const pending = fetch(`/api/egw-read?toc=1&url=${encodeURIComponent(currentUrl)}`)
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data?.ok || !Array.isArray(data.chapters)) throw new Error('toc_unavailable');
        return data.chapters;
      })
      .catch(error => {
        tocCache.delete(key);
        throw error;
      });
    tocCache.set(key, pending);
    return pending;
  }

  async function pagerFromApi(article, currentUrl, saved, requestId) {
    try {
      const chapters = await tocFor(currentUrl);
      if (requestId !== pagerSeq || !detail.open || detail.dataset.readerKind !== 'egw-reader') return;
      if (article.querySelector('.egwChapterPager')) return;

      const index = locateChapter(chapters, currentUrl, document.getElementById('detailType')?.textContent || saved?.chapter || '');
      if (index < 0) return;

      const context = {
        bookId:String(saved?.bookId || readPos(currentUrl)?.bookId || ''),
        tocUrl:saved?.tocUrl || '',
        bookTitle:saved?.title || body.querySelector('.egwBookName')?.textContent || '',
        chapters:chapters.map(ch => ({url:canonicalEgw(ch?.url), title:ch?.title || ''})).filter(ch => ch.url)
      };
      saveTocContext(context);
      const prev = index > 0 ? chapters[index - 1] : null;
      const next = index < chapters.length - 1 ? chapters[index + 1] : null;
      appendPager(article, prev, next, context, saved);
    } catch (_) {
      // Reading stays usable even when the official TOC is temporarily unavailable.
    }
  }

  async function ensureEgwPager() {
    if (!detail.open || detail.dataset.readerKind !== 'egw-reader') return;
    const article = body.querySelector('.egwReaderArticle');
    if (!article || article.querySelector('.egwChapterPager')) return;

    const saved = lastEgw();
    const currentUrl = currentEgwUrl();
    if (!currentUrl) return;

    if (pagerFromCachedToc(article, currentUrl, saved)) return;
    const requestId = ++pagerSeq;
    await pagerFromApi(article, currentUrl, saved, requestId);
  }

  function scheduleRefresh(delay = 140) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (detail.dataset.readerKind === 'egw-toc') captureVisibleToc();
      if (readerOpen()) syncCrossIndex();
      ensureEgwPager();
    }, delay);
  }

  window.addEventListener('click', event => {
    const nav = event.target.closest?.('[data-egw-native-url]');
    if (!nav?.dataset.egwNativeUrl) return;
    capturedUrl = canonicalEgw(nav.dataset.egwNativeUrl);
    detail.dataset.egwCurrentUrl = capturedUrl;
    lastCrossSignature = '';
    pagerSeq += 1;
    scheduleRefresh(180);
  }, true);

  if (typeof window.jgOpenNativeEgw === 'function' && !window.jgOpenNativeEgw.__readerControlsV3) {
    const baseOpen = window.jgOpenNativeEgw;
    const wrapped = function readerControlsOpen(url, meta) {
      capturedUrl = canonicalEgw(url);
      detail.dataset.egwCurrentUrl = capturedUrl;
      lastCrossSignature = '';
      pagerSeq += 1;
      const result = baseOpen(url, meta);
      Promise.resolve(result).finally(() => scheduleRefresh(40));
      return result;
    };
    wrapped.__readerControlsV3 = true;
    window.jgOpenNativeEgw = wrapped;
  }

  const observer = new MutationObserver(() => scheduleRefresh());
  observer.observe(detail, {subtree:true, childList:true, attributes:true, attributeFilter:['class','data-reader-kind','open']});

  /* TTS scrolls often; do not refresh cross-index or pager on every scroll. */
  detail.addEventListener('scroll', makeLinkedMarksFocusable, {passive:true});

  detail.addEventListener('close', () => {
    pagerSeq += 1;
    lastCrossSignature = '';
    capturedUrl = '';
    ensureTopCrossButton().hidden = true;
  });

  const style = document.createElement('style');
  style.textContent = `
    .crossIndexTopButton[hidden]{display:none!important}
    #detail[data-reader-kind="egw-reader"]>header{grid-template-columns:68px minmax(0,1fr) 104px!important}
    #detail .crossIndexTopButton{
      width:31px!important;
      min-width:31px!important;
      height:34px!important;
      min-height:34px!important;
      padding:0!important;
      border:0!important;
      border-radius:0!important;
      background:transparent!important;
      color:var(--egw-accent,var(--accent))!important;
      font-size:16px!important;
      font-weight:650!important;
      box-shadow:none!important;
    }
    #detail[data-reader-kind="bible-reader"] .crossIndexTopButton,
    #detail[data-reader-kind="egw-reader"] .crossIndexTopButton{display:inline-flex!important;align-items:center;justify-content:center}
    #detail[data-reader-kind="bible-reader"] .crossIndexHandle,
    #detail[data-reader-kind="egw-reader"] .crossIndexHandle{display:none!important}
    #detail .egwParagraphWrap.crossLinked,
    #detail .reading>.verse.crossLinked{
      cursor:pointer;
      -webkit-tap-highlight-color:transparent;
    }
    #detail .egwParagraphWrap.crossLinked::after,
    #detail .reading>.verse.crossLinked::after{pointer-events:none}
    #detail .egwParagraphWrap.crossLinked:focus-visible,
    #detail .reading>.verse.crossLinked:focus-visible{
      outline:1px solid color-mix(in srgb,var(--accent) 45%,transparent);
      outline-offset:3px;
    }
  `;
  document.head.appendChild(style);

  ensureTopCrossButton();
  scheduleRefresh(0);
})();