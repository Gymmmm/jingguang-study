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

  const readPos = value => {
    const m = canonicalEgw(value).match(/\/read\/(\d+)\.(\d+)$/i);
    return m ? {bookId:m[1], pos:+m[2]} : null;
  };

  const titleKey = value => String(value || '')
    .replace(/[《》〈〉]/g, '')
    .replace(/\s+/g, '')
    .replace(/[：:]/g, '')
    .trim();

  function lastEgw() {
    try { return JSON.parse(localStorage.getItem('jg_last_egw_native') || 'null'); }
    catch (_) { return null; }
  }

  let pagerRequest = 0;
  const tocCache = new Map();

  function isReaderOpen() {
    return detail.open && (detail.dataset.readerKind === 'egw-reader' || detail.dataset.readerKind === 'bible-reader');
  }

  function ensureCrossButton() {
    let button = fontTools.querySelector('.crossIndexTopButton');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'crossIndexTopButton';
      button.dataset.crossIndexOpen = '1';
      button.setAttribute('aria-label', '打开互相索引');
      button.innerHTML = '<span aria-hidden="true">↔</span>';
      fontTools.appendChild(button);
    }
    button.hidden = !isReaderOpen();
    return button;
  }

  function makeInlineLinksClickable() {
    body.querySelectorAll('.egwParagraphWrap.crossLinked,.reading>.verse.crossLinked').forEach(row => {
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-label', '查看这一处的互相索引');
    });
  }

  function openCrossIndex() {
    window.jgRefreshCrossIndex?.();
    const handle = detail.querySelector('.crossIndexHandle[data-cross-index-open]');
    if (handle) handle.click();
  }

  detail.addEventListener('click', event => {
    if (event.target.closest('.crossIndexTopButton')) {
      event.preventDefault();
      event.stopPropagation();
      openCrossIndex();
      return;
    }
    if (event.target.closest('button,a,input,select,textarea')) return;
    const linked = event.target.closest('.egwParagraphWrap.crossLinked,.reading>.verse.crossLinked');
    if (!linked) return;
    event.preventDefault();
    openCrossIndex();
  }, true);

  detail.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const linked = event.target.closest('.egwParagraphWrap.crossLinked,.reading>.verse.crossLinked');
    if (!linked) return;
    event.preventDefault();
    openCrossIndex();
  });

  async function tocFor(url) {
    const pos = readPos(url);
    const key = pos?.bookId || url;
    if (tocCache.has(key)) return tocCache.get(key);
    const promise = fetch(`/api/egw-read?toc=1&url=${encodeURIComponent(url)}`, {cache:'force-cache'})
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data?.ok || !Array.isArray(data.chapters) || !data.chapters.length) throw new Error('toc_unavailable');
        return data.chapters;
      })
      .catch(error => {
        tocCache.delete(key);
        throw error;
      });
    tocCache.set(key, promise);
    return promise;
  }

  function locateChapter(chapters, currentUrl, currentTitle) {
    let index = chapters.findIndex(ch => canonicalEgw(ch?.url) === currentUrl);
    if (index >= 0) return index;

    const current = readPos(currentUrl);
    if (current) {
      const exactBook = chapters.map((ch, i) => ({i, pos:readPos(ch?.url)})).filter(x => x.pos?.bookId === current.bookId);
      const exact = exactBook.find(x => x.pos.pos === current.pos);
      if (exact) return exact.i;
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

  function pagerButton(item, label, direction, saved) {
    if (!item) return document.createElement('span');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.egwNativeUrl = item.url || '';
    button.dataset.egwTitle = saved?.title || body.querySelector('.egwBookName')?.textContent || '怀爱伦著作';
    button.dataset.egwBookId = saved?.bookId || readPos(item.url)?.bookId || '';
    button.dataset.egwTocUrl = saved?.tocUrl || '';
    button.dataset.egwChapter = item.title || '';
    button.innerHTML = `<small>${label}</small><span>${direction === 'prev' ? '‹ ' : ''}${String(item.title || '')}${direction === 'next' ? ' ›' : ''}</span>`;
    return button;
  }

  async function ensurePager() {
    if (!detail.open || detail.dataset.readerKind !== 'egw-reader') return;
    const article = body.querySelector('.egwReaderArticle');
    if (!article || article.querySelector('.egwChapterPager')) return;

    const saved = lastEgw();
    const currentUrl = canonicalEgw(saved?.url || saved?.native_url || detail.dataset.egwCurrentUrl || '');
    if (!currentUrl) return;

    const requestId = ++pagerRequest;
    try {
      const chapters = await tocFor(currentUrl);
      if (requestId !== pagerRequest || !detail.open || detail.dataset.readerKind !== 'egw-reader') return;
      if (article.querySelector('.egwChapterPager')) return;

      const index = locateChapter(chapters, currentUrl, document.getElementById('detailType')?.textContent || saved?.chapter || '');
      if (index < 0) return;
      const prev = index > 0 ? chapters[index - 1] : null;
      const next = index < chapters.length - 1 ? chapters[index + 1] : null;
      if (!prev && !next) return;

      const nav = document.createElement('nav');
      nav.className = 'egwChapterPager';
      nav.setAttribute('aria-label', '章节导航');
      nav.append(
        pagerButton(prev, '上一章', 'prev', saved),
        pagerButton(next, '下一章', 'next', saved)
      );
      article.appendChild(nav);
    } catch (error) {
      console.warn('EGW pager fallback failed', error);
    }
  }

  function refreshControls() {
    ensureCrossButton();
    if (!isReaderOpen()) return;
    window.jgRefreshCrossIndex?.();
    requestAnimationFrame(makeInlineLinksClickable);
    ensurePager();
  }

  const previousRefreshReadAloud = window.jgRefreshReadAloud;
  if (typeof previousRefreshReadAloud === 'function' && !previousRefreshReadAloud.__readerControlsCore) {
    const wrapped = (...args) => {
      const result = previousRefreshReadAloud(...args);
      queueMicrotask(refreshControls);
      return result;
    };
    wrapped.__readerControlsCore = true;
    window.jgRefreshReadAloud = wrapped;
  }

  const previousOpenEgw = window.jgOpenNativeEgw;
  if (typeof previousOpenEgw === 'function' && !previousOpenEgw.__readerControlsCore) {
    const wrappedOpen = (url, meta) => {
      detail.dataset.egwCurrentUrl = canonicalEgw(url);
      pagerRequest += 1;
      const result = previousOpenEgw(url, meta);
      Promise.resolve(result).finally(() => queueMicrotask(refreshControls));
      return result;
    };
    wrappedOpen.__readerControlsCore = true;
    window.jgOpenNativeEgw = wrappedOpen;
  }

  detail.addEventListener('close', () => {
    pagerRequest += 1;
    ensureCrossButton().hidden = true;
  });

  const style = document.createElement('style');
  style.textContent = `
    .crossIndexTopButton[hidden]{display:none!important}
    #detail[data-reader-kind="egw-reader"]>header,
    #detail[data-reader-kind="bible-reader"]>header{grid-template-columns:68px minmax(0,1fr) 108px!important}
    #detail .crossIndexTopButton{
      display:inline-flex!important;align-items:center;justify-content:center;
      width:32px!important;min-width:32px!important;height:34px!important;min-height:34px!important;
      padding:0!important;border:0!important;background:transparent!important;
      color:var(--egw-accent,var(--accent))!important;font-size:17px!important;font-weight:700!important;
      box-shadow:none!important
    }
    #detail .egwParagraphWrap.crossLinked,
    #detail .reading>.verse.crossLinked{cursor:pointer;-webkit-tap-highlight-color:transparent}
    #detail .egwParagraphWrap.crossLinked::after,
    #detail .reading>.verse.crossLinked::after{pointer-events:none}
    #detail .egwChapterPager{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:14px!important;margin:38px 0 8px!important;padding-top:18px!important;border-top:1px solid var(--line)!important}
    #detail .egwChapterPager button{display:flex!important;min-height:62px!important;flex-direction:column!important;justify-content:center!important;gap:4px!important;padding:8px 2px!important;border:0!important;background:transparent!important;color:var(--egw-accent,var(--accent))!important;box-shadow:none!important}
    #detail .egwChapterPager button:first-child{text-align:left!important;align-items:flex-start!important}
    #detail .egwChapterPager button:last-child{text-align:right!important;align-items:flex-end!important}
    #detail .egwChapterPager small{font-size:10px!important;color:var(--muted)!important}
    #detail .egwChapterPager span{max-width:100%;font-size:13px!important;line-height:1.45!important;white-space:normal!important}
  `;
  document.head.appendChild(style);

  ensureCrossButton();
  queueMicrotask(refreshControls);
})();