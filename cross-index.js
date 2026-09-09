(() => {
  'use strict';

  const detail = document.getElementById('detail');
  const body = document.getElementById('detailBody');
  if (!detail || !body) return;

  let books = [];
  let relations = [];
  let egwRecords = [];
  let aliases = [];
  let aliasMap = new Map();
  const navStack = [];
  const INITIAL_RESULT_LIMIT = 5;
  let touchStart = null;
  let pendingRestore = null;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = s => String(s || '').trim().toLowerCase().replace(/[\s《》〈〉“”"'，。！？；、·_]/g, '').replace(/：/g, ':').replace(/[–—]/g, '-');
  const digits = value => String(value || '').replace(/[０-９]/g, ch => String('０１２３４５６７８９'.indexOf(ch)));
  const rxEscape = value => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const canonicalEgw = url => String(url || '').trim().replace(/[?#].*$/, '').replace(/\/$/, '').replace(/^https?:\/\/(?:m\.|text\.)?egwwritings\.org\/zh\/book\/(\d+)\.(\d+)$/i, 'https://text.egwwritings.org/read/$1.$2').replace(/^https?:\/\/(?:m\.|text\.)?egwwritings\.org\/read\/(\d+)\.(\d+)$/i, 'https://text.egwwritings.org/read/$1.$2');

  const ready = Promise.all([
    fetch('./data/bible-books.json', {cache:'no-store'}).then(r => r.json()),
    fetch('./data/bible-egw-relations.json', {cache:'no-store'}).then(r => r.json()),
    fetch('./data/egw-index.json', {cache:'no-store'}).then(r => r.json())
  ]).then(([b, rel, egw]) => {
    books = b.books || [];
    relations = rel.relations || [];
    egwRecords = egw.records || [];
    aliasMap = new Map();
    for (const [osis, full, short] of books) {
      for (const alias of [full, short]) if (alias) aliasMap.set(alias, {osis, full, short});
    }
    aliases = [...aliasMap.keys()].sort((a,b) => b.length - a.length);
    refresh();
  }).catch(() => {});

  function parseRef(value) {
    const raw = String(value || '').replace(/\s+/g, '');
    if (!raw) return null;
    for (const alias of aliases) {
      if (!raw.startsWith(alias)) continue;
      const book = aliasMap.get(alias);
      const rest = digits(raw.slice(alias.length));
      const m = rest.match(/^(\d{1,3})(?:章|[:：](\d{1,3})(?:[-–—](\d{1,3}))?)?/);
      if (!m) continue;
      const chapter = +m[1], from = m[2] ? +m[2] : null, to = m[3] ? +m[3] : from;
      return {...book, chapter, from, to, focus:from};
    }
    return null;
  }

  function refLabel(ref) {
    if (!ref) return '';
    return `${ref.full} ${ref.chapter}${ref.from ? ':' + ref.from + (ref.to && ref.to !== ref.from ? '-' + ref.to : '') : '章'}`;
  }

  function chapterKey(ref) {
    return ref ? `${ref.osis}:${ref.chapter}` : '';
  }

  function sameChapter(a,b) {
    return !!a && !!b && a.osis === b.osis && +a.chapter === +b.chapter;
  }

  function extractRefs(text) {
    if (!aliases.length || !text) return [];
    const pattern = aliases.map(rxEscape).join('|');
    const rx = new RegExp(`(${pattern})\\s*([0-9０-９]{1,3})(?:\\s*(?:章|[:：]\\s*([0-9０-９]{1,3})(?:\\s*[-–—]\\s*([0-9０-９]{1,3}))?(?:\\s*[,，、]\\s*[0-9０-９]{1,3})*))?`, 'g');
    const out = [], seen = new Set();
    let m;
    while ((m = rx.exec(String(text)))) {
      const book = aliasMap.get(m[1]);
      if (!book) continue;
      const chapter = +digits(m[2]);
      const from = m[3] ? +digits(m[3]) : null;
      const to = m[4] ? +digits(m[4]) : from;
      const ref = {...book, chapter, from, to, focus:from};
      const key = `${chapterKey(ref)}:${from || 0}:${to || 0}`;
      if (!seen.has(key)) { seen.add(key); out.push(ref); }
    }
    return out;
  }

  function currentBibleRef() {
    if (detail.dataset.readerKind !== 'bible-reader') return null;
    const m = String(detail.dataset.readingKey || '').match(/^bible:([^:]+):(\d+)$/);
    if (!m) return null;
    const row = books.find(x => x[0] === m[1]);
    return row ? {osis:row[0], full:row[1], short:row[2], chapter:+m[2], from:null, to:null, focus:null} : null;
  }

  function lastEgw() {
    try { return JSON.parse(localStorage.getItem('jg_last_egw_native') || 'null'); }
    catch (_) { return null; }
  }

  function recordBookContext(record) {
    const id = (String(record?.source_url || '').match(/\/(?:read|zh\/book)\/(\d+)/i) || [])[1] || '';
    return {
      bookId:id,
      tocUrl:id ? `https://m.egwwritings.org/zh/book/${id}/toc` : ''
    };
  }

  function currentEgwRecord() {
    if (detail.dataset.readerKind !== 'egw-reader') return null;
    const last = lastEgw();
    const url = canonicalEgw(last?.url || last?.native_url || '');
    if (url) {
      const exact = egwRecords.find(r => canonicalEgw(r.source_url) === url);
      if (exact) return exact;
    }
    const bookName = norm(body.querySelector('.egwBookName')?.textContent || '');
    const chapter = norm(document.getElementById('detailType')?.textContent || body.querySelector('.egwReaderIntro h1')?.textContent || '');
    return egwRecords.find(r => bookName.includes(norm(r.title_cn)) && (chapter.includes(norm(r.chapter)) || norm(r.chapter).includes(chapter))) || null;
  }

  function relatedEgwForBible(ref) {
    if (!ref) return [];
    const ids = new Set();
    for (const record of egwRecords) {
      if ((record.bible_refs || []).some(v => sameChapter(parseRef(v), ref))) ids.add(record.id);
    }
    for (const rel of relations) {
      if (sameChapter(parseRef(rel.bible_ref), ref)) for (const id of rel.egw_ids || []) ids.add(id);
    }
    const rows = [...ids].map(id => egwRecords.find(r => r.id === id)).filter(Boolean);
    const top = navStack[navStack.length - 1];
    if (top?.kind === 'egw' && top.record && !rows.some(r => r.id === top.record.id)) rows.unshift(top.record);
    return rows.slice(0,12);
  }

  function relatedBibleForEgw() {
    const refs = [];
    const seen = new Set();
    const add = ref => {
      if (!ref) return;
      const key = `${chapterKey(ref)}:${ref.from || 0}:${ref.to || 0}`;
      if (!seen.has(key)) { seen.add(key); refs.push(ref); }
    };
    const record = currentEgwRecord();
    for (const value of record?.bible_refs || []) add(parseRef(value));
    body.querySelectorAll('.egwParagraph').forEach(p => extractRefs(p.textContent).forEach(add));
    const top = navStack[navStack.length - 1];
    if (top?.kind === 'bible' && top.ref) add(top.ref);
    return refs.slice(0,16);
  }

  function clearMarks() {
    body.querySelectorAll('.crossLinked').forEach(x => x.classList.remove('crossLinked'));
  }

  function markEgwLinks() {
    body.querySelectorAll('.egwParagraph').forEach(p => {
      if (extractRefs(p.textContent).length) p.closest('.egwParagraphWrap')?.classList.add('crossLinked');
    });
  }

  function markBibleLinks(ref, records) {
    if (!ref) return;
    const refs = records.flatMap(record => (record.bible_refs || []).map(parseRef).filter(Boolean)).filter(r => sameChapter(r, ref) && r.from);
    for (const r of refs) {
      const start = Math.max(1, +r.from || 1), end = Math.max(start, +r.to || start);
      for (let v = start; v <= end; v++) body.querySelector(`.reading>.verse[data-verse="${v}"]`)?.classList.add('crossLinked');
    }
  }

  function ensureUi() {
    let handle = detail.querySelector('.crossIndexHandle');
    if (!handle) {
      handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'crossIndexHandle';
      handle.dataset.crossIndexOpen = '1';
      handle.hidden = true;
      handle.innerHTML = '<span aria-hidden="true">↔</span><b>关联</b>';
      detail.appendChild(handle);
    }
    let sheet = detail.querySelector('.crossIndexSheet');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.className = 'crossIndexSheet';
      sheet.hidden = true;
      sheet.innerHTML = `<button class="crossIndexBackdrop" type="button" data-cross-index-close aria-label="关闭互相索引"></button><section class="crossIndexPanel" aria-label="互相索引"><header><div><b>互相索引</b><small>只显示可从现有资料核验的关联</small></div><button type="button" data-cross-index-close aria-label="关闭">×</button></header><div class="crossIndexReturn"></div><div class="crossIndexList"></div></section>`;
      detail.appendChild(sheet);
    }
    return {handle, sheet};
  }

  function captureOrigin() {
    if (detail.dataset.readerKind === 'bible-reader') {
      const ref = currentBibleRef();
      return ref ? {kind:'bible', ref, scroll:detail.scrollTop, title:refLabel(ref)} : null;
    }
    if (detail.dataset.readerKind === 'egw-reader') {
      const last = lastEgw();
      const record = currentEgwRecord();
      if (!last?.url && !last?.native_url) return null;
      return {
        kind:'egw',
        url:last.url || last.native_url,
        title:last.title || body.querySelector('.egwBookName')?.textContent || '怀爱伦著作',
        chapter:last.chapter || document.getElementById('detailType')?.textContent || '',
        bookId:last.bookId || '',
        tocUrl:last.tocUrl || '',
        scroll:detail.scrollTop,
        record
      };
    }
    return null;
  }

  function triggerBible(ref) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.hidden = true;
    btn.dataset.bible = JSON.stringify({...ref, from:null, to:null, focus:ref.focus || ref.from || null});
    document.body.appendChild(btn); btn.click(); btn.remove();
  }

  function triggerEgw(recordOrOrigin) {
    const source = recordOrOrigin.source_url || recordOrOrigin.url;
    if (!source) return;
    const context = recordOrOrigin.source_url ? recordBookContext(recordOrOrigin) : {bookId:recordOrOrigin.bookId || '', tocUrl:recordOrOrigin.tocUrl || ''};
    const btn = document.createElement('button');
    btn.type = 'button'; btn.hidden = true;
    btn.dataset.egwNativeUrl = source;
    btn.dataset.egwTitle = recordOrOrigin.source_url ? `《${recordOrOrigin.title_cn || '怀爱伦著作'}》` : (recordOrOrigin.title || '怀爱伦著作');
    btn.dataset.egwChapter = recordOrOrigin.chapter || '';
    btn.dataset.egwBookId = context.bookId || '';
    btn.dataset.egwTocUrl = context.tocUrl || '';
    document.body.appendChild(btn); btn.click(); btn.remove();
  }

  function scheduleRestore(scroll) {
    if (!Number.isFinite(+scroll)) return;
    pendingRestore = +scroll;
    setTimeout(() => {
      if (pendingRestore == null) return;
      detail.scrollTop = pendingRestore;
      pendingRestore = null;
    }, 120);
  }

  function jumpBible(ref) {
    const origin = captureOrigin();
    if (origin) navStack.push(origin);
    closeSheet();
    triggerBible(ref);
  }

  function jumpEgw(record) {
    const origin = captureOrigin();
    if (origin) navStack.push(origin);
    closeSheet();
    triggerEgw(record);
  }

  function goBack() {
    const origin = navStack.pop();
    if (!origin) return;
    closeSheet();
    if (origin.kind === 'bible') triggerBible(origin.ref);
    else triggerEgw(origin);
    scheduleRestore(origin.scroll);
  }

  function renderSheet(items, kind, expanded=false) {
    const {sheet} = ensureUi();
    const list = sheet.querySelector('.crossIndexList');
    const back = sheet.querySelector('.crossIndexReturn');
    back.innerHTML = navStack.length ? `<button type="button" data-cross-index-back>‹ 返回关联处</button>` : '';
    if (!items.length) {
      list.innerHTML = '<div class="crossIndexEmpty">当前章节暂时没有可核验的双向关联。</div>';
      return;
    }
    const visible=expanded?items:items.slice(0,INITIAL_RESULT_LIMIT);
    const more=!expanded&&items.length>visible.length?`<button type="button" class="crossIndexMore" data-cross-index-all>查看全部 ${items.length} 条</button>`:'';
    if (kind === 'bible') {
      list.innerHTML = `<h3>相关怀著</h3>${visible.map(r => `<button type="button" class="crossIndexRow" data-cross-egw="${esc(r.id)}"><span><b>《${esc(r.title_cn || '怀爱伦著作')}》</b><small>${esc(r.chapter || '')}${r.locator ? ' · ' + esc(r.locator) : ''}</small></span><i>›</i></button>`).join('')}${more}`;
    } else {
      list.innerHTML = `<h3>相关经文</h3>${visible.map((r,i) => `<button type="button" class="crossIndexRow" data-cross-bible="${i}"><span><b>${esc(refLabel(r))}</b><small>打开整章${r.focus ? ` · 定位第 ${r.focus} 节` : ''}</small></span><i>›</i></button>`).join('')}${more}`;
    }
  }

  function openSheet() {
    const kind = detail.dataset.readerKind;
    if (kind !== 'bible-reader' && kind !== 'egw-reader') return;
    const items = kind === 'bible-reader' ? relatedEgwForBible(currentBibleRef()) : relatedBibleForEgw();
    const ui = ensureUi();
    renderSheet(items, kind === 'bible-reader' ? 'bible' : 'egw');
    ui.sheet.hidden = false;
    ui.sheet.dataset.kind = kind;
    ui.sheet._crossItems = items;
    ui.sheet._crossExpanded = false;
  }

  window.jgOpenCrossIndex = openSheet;

  function closeSheet() {
    const sheet = detail.querySelector('.crossIndexSheet');
    if (sheet) sheet.hidden = true;
  }

  function refresh() {
    if (!books.length) return;
    clearMarks();
    const {handle, sheet} = ensureUi();
    closeSheet();
    const kind = detail.dataset.readerKind;
    if (!detail.open || (kind !== 'bible-reader' && kind !== 'egw-reader')) {
      handle.hidden = true;
      return;
    }
    let count = 0;
    if (kind === 'bible-reader') {
      const ref = currentBibleRef(), rows = relatedEgwForBible(ref);
      count = rows.length;
      markBibleLinks(ref, rows);
    } else {
      const refs = relatedBibleForEgw();
      count = refs.length;
      markEgwLinks();
    }
    handle.hidden = count === 0 && navStack.length === 0;
    handle.querySelector('b').textContent = count ? `关联 ${count}` : '返回';
    handle.setAttribute('aria-label', count ? `打开互相索引，共 ${count} 条` : '返回关联位置');
    if (!sheet.hidden) openSheet();
  }

  detail.addEventListener('click', e => {
    if (e.target.closest('[data-cross-index-open]')) { e.preventDefault(); openSheet(); return; }
    if (e.target.closest('[data-cross-index-close]')) { e.preventDefault(); closeSheet(); return; }
    if (e.target.closest('[data-cross-index-all]')) {
      e.preventDefault();
      const sheet=detail.querySelector('.crossIndexSheet');
      if(sheet){sheet._crossExpanded=true;renderSheet(sheet._crossItems||[],sheet.dataset.kind==='bible-reader'?'bible':'egw',true)}
      return;
    }
    if (e.target.closest('[data-cross-index-back]')) { e.preventDefault(); goBack(); return; }
    const egw = e.target.closest('[data-cross-egw]');
    if (egw) {
      e.preventDefault();
      const record = egwRecords.find(r => r.id === egw.dataset.crossEgw);
      if (record) jumpEgw(record);
      return;
    }
    const bible = e.target.closest('[data-cross-bible]');
    if (bible) {
      e.preventDefault();
      const sheet = detail.querySelector('.crossIndexSheet');
      const ref = sheet?._crossItems?.[+bible.dataset.crossBible];
      if (ref) jumpBible(ref);
    }
  });

  detail.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || e.target.closest('button,input,select,textarea,a')) return;
    const t = e.touches[0];
    touchStart = {x:t.clientX, y:t.clientY};
  }, {passive:true});

  detail.addEventListener('touchend', e => {
    if (!touchStart || !e.changedTouches.length) return;
    const t = e.changedTouches[0], dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
    const startedAwayFromEdge = touchStart.x > 38;
    touchStart = null;
    const selection = window.getSelection?.();
    if (selection && !selection.isCollapsed) return;
    if (startedAwayFromEdge && dx > 72 && Math.abs(dy) < 58) openSheet();
    else if (dx < -72 && Math.abs(dy) < 58 && !detail.querySelector('.crossIndexSheet')?.hidden) closeSheet();
  }, {passive:true});

  detail.addEventListener('close', () => { closeSheet(); });

  const baseRefresh = window.jgRefreshReadAloud;
  if (typeof baseRefresh === 'function') {
    window.jgRefreshReadAloud = (...args) => {
      const result = baseRefresh(...args);
      queueMicrotask(refresh);
      return result;
    };
  }
  window.jgRefreshCrossIndex = refresh;

  const style = document.createElement('style');
  style.textContent = `
    #detail[data-reader-kind="bible-reader"]>footer,#detail[data-reader-kind="egw-reader"]>footer{justify-content:flex-start!important;gap:8px!important;min-height:38px;padding:3px 11px calc(4px + env(safe-area-inset-bottom))!important;border-top:1px solid color-mix(in srgb,var(--line) 72%,transparent)!important;background:color-mix(in srgb,var(--surface) 92%,transparent)!important;backdrop-filter:blur(10px)}
    #detail[data-reader-kind="bible-reader"]>footer>*,#detail[data-reader-kind="egw-reader"]>footer>*{flex:0 0 auto!important;min-height:30px!important;padding:0 6px!important;border:0!important;border-radius:0!important;background:transparent!important;color:var(--muted)!important;font-size:10.5px!important;font-weight:600!important;box-shadow:none!important}
    #detail[data-reader-kind="bible-reader"]>footer>*:last-child,#detail[data-reader-kind="egw-reader"]>footer>*:last-child{margin-left:auto;color:color-mix(in srgb,var(--accent) 78%,var(--muted))!important}
    .crossIndexHandle[hidden],.crossIndexSheet[hidden]{display:none!important}
    .crossIndexHandle{position:fixed;right:max(8px,env(safe-area-inset-right));bottom:calc(48px + env(safe-area-inset-bottom));z-index:18;display:flex;align-items:center;gap:4px;min-height:30px!important;padding:0 8px!important;border:1px solid color-mix(in srgb,var(--accent) 34%,var(--line))!important;border-radius:999px!important;background:color-mix(in srgb,var(--surface) 92%,transparent)!important;color:var(--accent)!important;font-size:10px!important;box-shadow:0 2px 12px #0000000d!important;backdrop-filter:blur(10px);opacity:.86}
    .crossIndexHandle b{font-size:10px;font-weight:700}
    .crossIndexMore{width:100%;min-height:44px;margin-top:6px;border:0!important;border-top:1px solid var(--line)!important;border-radius:0!important;background:transparent!important;color:var(--accent)!important;font-size:13px!important;font-weight:700!important}
    .crossIndexSheet{position:fixed;inset:0;z-index:40;display:flex;align-items:flex-end;justify-content:center}
    .crossIndexBackdrop{position:absolute;inset:0;width:100%;height:100%;border:0!important;border-radius:0!important;background:#0004!important}
    .crossIndexPanel{position:relative;width:min(720px,100%);max-height:min(62vh,560px);overflow:auto;padding:12px 14px calc(14px + env(safe-area-inset-bottom));border-radius:18px 18px 0 0;background:var(--surface);box-shadow:0 -14px 40px #0002}
    .crossIndexPanel>header{position:static!important;display:flex!important;align-items:center!important;justify-content:space-between!important;padding:2px 0 10px!important;border:0!important;background:transparent!important;backdrop-filter:none!important}
    .crossIndexPanel>header>div{display:flex;flex-direction:column;gap:2px}.crossIndexPanel>header b{font-size:15px}.crossIndexPanel>header small{color:var(--muted);font-size:9.5px}.crossIndexPanel>header>button{min-width:34px!important;min-height:34px!important;padding:0!important;border:0!important;background:transparent!important;color:var(--muted)!important;font-size:22px!important}
    .crossIndexReturn{margin:0 0 5px}.crossIndexReturn:empty{display:none}.crossIndexReturn button{min-height:34px!important;padding:0 2px!important;border:0!important;background:transparent!important;color:var(--accent)!important;font-size:11px!important;font-weight:700!important}
    .crossIndexList h3{margin:8px 0 5px;color:var(--muted);font-size:10.5px;font-weight:700;letter-spacing:.03em}
    .crossIndexRow{width:100%;min-height:54px!important;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 2px!important;border:0!important;border-bottom:1px solid var(--line)!important;border-radius:0!important;background:transparent!important;color:var(--text)!important;text-align:left;box-shadow:none!important}
    .crossIndexRow>span{min-width:0;display:flex;flex-direction:column;gap:3px}.crossIndexRow b{font-size:14px;font-weight:650;line-height:1.35}.crossIndexRow small{color:var(--muted);font-size:9.5px;line-height:1.35}.crossIndexRow i{flex:0 0 auto;color:var(--muted);font-size:22px;font-style:normal;font-weight:400}
    .crossIndexEmpty{padding:20px 4px;color:var(--muted);font-size:12px;text-align:center}
    .egwParagraphWrap.crossLinked,.reading>.verse.crossLinked{position:relative}
    .egwParagraphWrap.crossLinked::after,.reading>.verse.crossLinked::after{content:'↔';position:absolute;right:1px;top:2px;color:var(--accent);font-family:system-ui,sans-serif;font-size:8px;font-weight:700;opacity:.42}
    @media(max-width:560px){.crossIndexPanel{padding-left:12px;padding-right:12px}.crossIndexHandle{right:6px;bottom:calc(46px + env(safe-area-inset-bottom))}.crossIndexRow{min-height:52px!important}}
  `;
  document.head.appendChild(style);

  ensureUi();
  ready.then(refresh);
})();