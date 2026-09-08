(() => {
  'use strict';

  const detail = document.getElementById('detail');
  const body = document.getElementById('detailBody');
  if (!detail || !body) return;

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

  function isReaderOpen() {
    return detail.open && (detail.dataset.readerKind === 'bible-reader' || detail.dataset.readerKind === 'egw-reader');
  }

  function lastEgw() {
    try { return JSON.parse(localStorage.getItem('jg_last_egw_native') || 'null'); }
    catch (_) { return null; }
  }

  function ensureCrossHandleVisible() {
    if (!isReaderOpen()) return;
    try { window.jgRefreshCrossIndex?.(); } catch (_) {}
    const handle = detail.querySelector('.crossIndexHandle[data-cross-index-open]');
    if (!handle) return;
    handle.hidden = false;
    handle.setAttribute('aria-label', '打开互相索引');
  }

  function makeInlineLinksClickable() {
    body.querySelectorAll('.egwParagraphWrap.crossLinked,.reading>.verse.crossLinked').forEach(row => {
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-label', '查看这一处的互相索引');
    });
  }

  function openCrossIndex() {
    try { window.jgRefreshCrossIndex?.(); } catch (_) {}
    const handle = detail.querySelector('.crossIndexHandle[data-cross-index-open]');
    if (handle) {
      handle.hidden = false;
      handle.click();
    }
  }

  detail.addEventListener('click', event => {
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

  function ensureBibleBottomPager() {
    if (!detail.open || detail.dataset.readerKind !== 'bible-reader') return;
    const reading = body.querySelector('.reading');
    const topPager = body.querySelector('.readerNav');
    if (!reading || !topPager || body.querySelector('.readerNavBottom')) return;

    const bottom = topPager.cloneNode(true);
    bottom.classList.add('readerNavBottom');
    bottom.setAttribute('aria-label', '章节导航');
    reading.insertAdjacentElement('afterend', bottom);
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

  async function ensureEgwBottomPager() {
    if (!detail.open || detail.dataset.readerKind !== 'egw-reader') return;
    const article = body.querySelector('.egwReaderArticle');
    if (!article || article.querySelector('.egwChapterPager')) return;

    const saved = lastEgw();
    const url = canonicalEgw(
      currentEgwUrl ||
      detail.dataset.egwCurrentUrl ||
      saved?.url ||
      saved?.native_url ||
      ''
    );
    if (!url) return;

    const requestId = ++pagerRequest;
    try {
      const chapters = await tocFor(url);
      if (requestId !== pagerRequest || !detail.open || detail.dataset.readerKind !== 'egw-reader') return;
      if (article.querySelector('.egwChapterPager')) return;

      const index = locateChapter(
        chapters,
        url,
        document.getElementById('detailType')?.textContent || saved?.chapter || ''
      );
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
    if (!isReaderOpen()) return;
    ensureCrossHandleVisible();
    makeInlineLinksClickable();
    ensureBibleBottomPager();
    ensureEgwBottomPager();
  }

  document.addEventListener('click', event => {
    const nav = event.target.closest?.('[data-egw-native-url]');
    if (!nav?.dataset.egwNativeUrl) return;
    currentEgwUrl = canonicalEgw(nav.dataset.egwNativeUrl);
    detail.dataset.egwCurrentUrl = currentEgwUrl;
    pagerRequest += 1;
  }, true);

  const previousOpenEgw = window.jgOpenNativeEgw;
  if (typeof previousOpenEgw === 'function' && !previousOpenEgw.__unifiedReaderControls) {
    const wrappedOpen = (url, meta) => {
      currentEgwUrl = canonicalEgw(url);
      detail.dataset.egwCurrentUrl = currentEgwUrl;
      pagerRequest += 1;
      const result = previousOpenEgw(url, meta);
      Promise.resolve(result).finally(() => queueMicrotask(refreshControls));
      return result;
    };
    wrappedOpen.__unifiedReaderControls = true;
    window.jgOpenNativeEgw = wrappedOpen;
  }

  const previousRefreshReadAloud = window.jgRefreshReadAloud;
  if (typeof previousRefreshReadAloud === 'function' && !previousRefreshReadAloud.__unifiedReaderControls) {
    const wrappedRefresh = (...args) => {
      const result = previousRefreshReadAloud(...args);
      queueMicrotask(refreshControls);
      return result;
    };
    wrappedRefresh.__unifiedReaderControls = true;
    window.jgRefreshReadAloud = wrappedRefresh;
  }

  window.jgRefreshReaderControls = refreshControls;

  detail.addEventListener('close', () => {
    pagerRequest += 1;
    currentEgwUrl = '';
  });

  const style = document.createElement('style');
  style.textContent = `
    #detail[data-reader-kind="bible-reader"] .crossIndexHandle,
    #detail[data-reader-kind="egw-reader"] .crossIndexHandle{
      display:flex!important;
      position:fixed!important;
      top:50%!important;
      right:max(7px,env(safe-area-inset-right))!important;
      bottom:auto!important;
      transform:translateY(-50%)!important;
      z-index:55!important;
      min-height:38px!important;
      padding:0 10px!important;
      opacity:.94!important;
      pointer-events:auto!important;
      box-shadow:0 4px 18px #00000014!important;
    }

    #detail .egwParagraphWrap.crossLinked,
    #detail .reading>.verse.crossLinked{
      cursor:pointer;
      -webkit-tap-highlight-color:transparent;
    }
    #detail .egwParagraphWrap.crossLinked::after,
    #detail .reading>.verse.crossLinked::after{pointer-events:none}

    #detail .readerNavBottom{
      display:flex!important;
      justify-content:space-between!important;
      gap:14px!important;
      margin:30px 0 6px!important;
      padding-top:18px!important;
      border-top:1px solid var(--line)!important;
    }
    #detail .readerNavBottom button{
      flex:1!important;
      min-height:54px!important;
      padding:8px 2px!important;
      border:0!important;
      background:transparent!important;
      color:var(--accent)!important;
      box-shadow:none!important;
    }
    #detail .readerNavBottom button:first-child{text-align:left!important}
    #detail .readerNavBottom button:last-child{text-align:right!important}

    #detail .egwChapterPager{
      display:grid!important;
      grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
      gap:14px!important;
      margin:38px 0 8px!important;
      padding-top:18px!important;
      border-top:1px solid var(--line)!important;
    }
    #detail .egwChapterPager button{
      display:flex!important;
      min-height:62px!important;
      flex-direction:column!important;
      justify-content:center!important;
      gap:4px!important;
      padding:8px 2px!important;
      border:0!important;
      background:transparent!important;
      color:var(--egw-accent,var(--accent))!important;
      box-shadow:none!important;
    }
    #detail .egwChapterPager button:first-child{text-align:left!important;align-items:flex-start!important}
    #detail .egwChapterPager button:last-child{text-align:right!important;align-items:flex-end!important}
    #detail .egwChapterPager small{font-size:10px!important;color:var(--muted)!important}
    #detail .egwChapterPager span{max-width:100%;font-size:13px!important;line-height:1.45!important;white-space:normal!important}
  `;
  document.head.appendChild(style);

  queueMicrotask(refreshControls);
})();