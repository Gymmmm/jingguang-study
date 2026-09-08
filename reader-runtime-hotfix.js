(() => {
  'use strict';

  const detail = document.getElementById('detail');
  const body = document.getElementById('detailBody');
  const fontTools = detail?.querySelector('.fontTools');
  if (!detail || !body || !fontTools) return;

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

  let capturedUrl = canonicalEgw(lastEgw()?.url || lastEgw()?.native_url || '');
  const tocCache = new Map();
  let pagerSeq = 0;
  let timer = 0;

  function readerOpen() {
    const kind = detail.dataset.readerKind;
    return detail.open && (kind === 'bible-reader' || kind === 'egw-reader');
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
    window.jgRefreshCrossIndex?.();
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

  async function ensureEgwPager() {
    if (!detail.open || detail.dataset.readerKind !== 'egw-reader') return;
    const article = body.querySelector('.egwReaderArticle');
    if (!article || article.querySelector('.egwChapterPager')) return;

    const saved = lastEgw();
    const currentUrl = canonicalEgw(capturedUrl || saved?.url || saved?.native_url || '');
    if (!currentUrl) return;

    const requestId = ++pagerSeq;
    try {
      const chapters = await tocFor(currentUrl);
      if (requestId !== pagerSeq || !detail.open || detail.dataset.readerKind !== 'egw-reader') return;
      if (article.querySelector('.egwChapterPager')) return;

      const currentTitle = document.getElementById('detailType')?.textContent || saved?.chapter || '';
      const index = locateChapter(chapters, currentUrl, currentTitle);
      if (index < 0) return;

      const prev = index > 0 ? chapters[index - 1] : null;
      const next = index < chapters.length - 1 ? chapters[index + 1] : null;
      if (!prev && !next) return;

      const nav = document.createElement('nav');
      nav.className = 'egwChapterPager';
      nav.setAttribute('aria-label', '章节导航');
      const parsed = readPos(currentUrl);
      const bookId = saved?.bookId || parsed?.bookId || '';
      const tocUrl = saved?.tocUrl || (bookId ? `https://m.egwwritings.org/zh/book/${bookId}/toc` : '');
      const bookTitle = saved?.title || body.querySelector('.egwBookName')?.textContent || '怀爱伦著作';

      const makeButton = (item, label, direction) => {
        if (!item) return document.createElement('span');
        const el = document.createElement('button');
        el.type = 'button';
        el.dataset.egwNativeUrl = item.url || '';
        el.dataset.egwTitle = bookTitle;
        el.dataset.egwBookId = bookId;
        el.dataset.egwTocUrl = tocUrl;
        el.dataset.egwChapter = item.title || '';
        el.innerHTML = `<small>${label}</small><span>${direction === 'prev' ? '‹ ' : ''}${String(item.title || '')}${direction === 'next' ? ' ›' : ''}</span>`;
        return el;
      };

      nav.append(makeButton(prev, '上一章', 'prev'), makeButton(next, '下一章', 'next'));
      article.appendChild(nav);
    } catch (_) {
      // Reading stays usable even when the official TOC is temporarily unavailable.
    }
  }

  function syncCrossIndex() {
    ensureTopCrossButton();
    makeLinkedMarksFocusable();
    if (readerOpen()) window.jgRefreshCrossIndex?.();
  }

  function scheduleRefresh(delay = 90) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      syncCrossIndex();
      ensureEgwPager();
    }, delay);
  }

  window.addEventListener('click', event => {
    const nav = event.target.closest?.('[data-egw-native-url]');
    if (!nav?.dataset.egwNativeUrl) return;
    capturedUrl = canonicalEgw(nav.dataset.egwNativeUrl);
    detail.dataset.egwCurrentUrl = capturedUrl;
    pagerSeq += 1;
    scheduleRefresh(140);
  }, true);

  if (typeof window.jgOpenNativeEgw === 'function' && !window.jgOpenNativeEgw.__readerControlsV2) {
    const baseOpen = window.jgOpenNativeEgw;
    const wrapped = function readerControlsOpen(url, meta) {
      capturedUrl = canonicalEgw(url);
      detail.dataset.egwCurrentUrl = capturedUrl;
      pagerSeq += 1;
      const result = baseOpen(url, meta);
      Promise.resolve(result).finally(() => scheduleRefresh(30));
      return result;
    };
    wrapped.__readerControlsV2 = true;
    window.jgOpenNativeEgw = wrapped;
  }

  const observer = new MutationObserver(() => scheduleRefresh());
  observer.observe(detail, {subtree:true, childList:true, attributes:true, attributeFilter:['class','data-reader-kind','open','hidden']});
  detail.addEventListener('scroll', () => scheduleRefresh(30), {passive:true});
  detail.addEventListener('close', () => {
    pagerSeq += 1;
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
