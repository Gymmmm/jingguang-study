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

  const titleKey = value => String(value || '')
    .replace(/[《》〈〉]/g, '')
    .replace(/\s+/g, '')
    .replace(/[：:]/g, '')
    .trim();

  function lastEgw() {
    try { return JSON.parse(localStorage.getItem('jg_last_egw_native') || 'null'); }
    catch (_) { return null; }
  }

  function openCrossIndex() {
    const handle = detail.querySelector('.crossIndexHandle[data-cross-index-open]');
    if (handle && !handle.hidden) handle.click();
  }

  /* The inline ↔ markers are now real tap targets, not decorative-only marks. */
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

  let pagerSeq = 0;
  async function ensureEgwPager() {
    if (!detail.open || detail.dataset.readerKind !== 'egw-reader') return;
    const article = body.querySelector('.egwReaderArticle');
    if (!article || article.querySelector('.egwChapterPager')) return;

    const saved = lastEgw();
    const currentUrl = canonicalEgw(saved?.url || saved?.native_url || '');
    if (!currentUrl) return;

    const requestId = ++pagerSeq;
    try {
      const response = await fetch(`/api/egw-read?toc=1&url=${encodeURIComponent(currentUrl)}`);
      const data = await response.json();
      if (requestId !== pagerSeq || !response.ok || !data?.ok || !Array.isArray(data.chapters)) return;
      if (!detail.open || detail.dataset.readerKind !== 'egw-reader') return;
      if (article.querySelector('.egwChapterPager')) return;

      const currentTitle = titleKey(document.getElementById('detailType')?.textContent || saved?.chapter || '');
      let index = data.chapters.findIndex(ch => canonicalEgw(ch?.url) === currentUrl);
      if (index < 0 && currentTitle) {
        index = data.chapters.findIndex(ch => {
          const candidate = titleKey(ch?.title);
          return candidate && (candidate === currentTitle || candidate.includes(currentTitle) || currentTitle.includes(candidate));
        });
      }
      if (index < 0) return;

      const prev = index > 0 ? data.chapters[index - 1] : null;
      const next = index < data.chapters.length - 1 ? data.chapters[index + 1] : null;
      if (!prev && !next) return;

      const nav = document.createElement('nav');
      nav.className = 'egwChapterPager';
      nav.setAttribute('aria-label', '章节导航');
      const bookId = saved?.bookId || (currentUrl.match(/\/read\/(\d+)\./) || [])[1] || '';
      const tocUrl = saved?.tocUrl || (bookId ? `https://m.egwwritings.org/zh/book/${bookId}/toc` : '');
      const bookTitle = saved?.title || body.querySelector('.egwBookName')?.textContent || '怀爱伦著作';

      const button = (item, label, direction) => {
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

      nav.append(button(prev, '上一章', 'prev'), button(next, '下一章', 'next'));
      article.appendChild(nav);
    } catch (_) {
      /* Keep reading usable even if the TOC fallback is temporarily unavailable. */
    }
  }

  let timer = 0;
  function scheduleRefresh() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      makeLinkedMarksFocusable();
      ensureEgwPager();
    }, 90);
  }

  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(detail, {subtree:true, childList:true, attributes:true, attributeFilter:['class','data-reader-kind','open']});
  detail.addEventListener('scroll', makeLinkedMarksFocusable, {passive:true});
  detail.addEventListener('close', () => { pagerSeq += 1; });

  const style = document.createElement('style');
  style.textContent = `
    #detail .crossIndexHandle{
      z-index:32!important;
      right:max(10px,env(safe-area-inset-right))!important;
      bottom:calc(58px + env(safe-area-inset-bottom))!important;
      pointer-events:auto!important;
    }
    #detail .egwParagraphWrap.crossLinked,
    #detail .reading>.verse.crossLinked{
      cursor:pointer;
      -webkit-tap-highlight-color:transparent;
    }
    #detail .egwParagraphWrap.crossLinked::after,
    #detail .reading>.verse.crossLinked::after{
      pointer-events:none;
    }
    #detail .egwParagraphWrap.crossLinked:focus-visible,
    #detail .reading>.verse.crossLinked:focus-visible{
      outline:1px solid color-mix(in srgb,var(--accent) 45%,transparent);
      outline-offset:3px;
    }
    @media(max-width:560px){
      #detail .crossIndexHandle{
        right:max(8px,env(safe-area-inset-right))!important;
        bottom:calc(56px + env(safe-area-inset-bottom))!important;
      }
    }
  `;
  document.head.appendChild(style);

  scheduleRefresh();
})();