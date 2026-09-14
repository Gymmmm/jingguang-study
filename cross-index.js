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
    // Relations also carry OSIS refs (e.g. John 3:16 / JHN 3:16 / John3:16).
    const spaced = String(value || '').trim().toUpperCase().replace(/[：]/g, ':');
    const osis = spaced.match(/^([1-3]?[A-Z]{2,5})[ .]?(\d{1,3})(?::(\d{1,3})(?:-(\d{1,3}))?)?$/);
    if (osis) {
      const row = books.find(x => String(x[0]).toUpperCase() === osis[1]);
      if (row) {
        const from = osis[3] ? +osis[3] : null;
        return {osis:row[0], full:row[1], short:row[2], chapter:+osis[2], from, to:osis[4] ? +osis[4] : from, focus:from};
      }
    }
    return null;
  }

  function parseRelationRef(rel) {
    return parseRef(rel?.bible_ref) || parseRef(rel?.normalized);
  }

  function refLabel(ref) {
    if (!ref) return '';
    return `${ref.full} ${ref.chapter}${ref.from ? ':' + ref.from + (ref.to && ref.to !== ref.from ? '-' + ref.to : '') : '章'}`;
  }

  function humanWhy(why) {
    if (why == null || why === '') return '';
    if (typeof why === 'string') return why;
    if (typeof why === 'object') {
      if (why.full || why.osis) return refLabel(why);
      if (why.bible_ref || why.normalized) return String(why.bible_ref || why.normalized);
      if (why.label || why.text || why.title) return String(why.label || why.text || why.title);
    }
    const s = String(why);
    return /^\[object |^BibleRef\{/.test(s) ? '' : s;
  }

  function chapterKey(ref) {
    return ref ? `${ref.osis}:${ref.chapter}` : '';
  }

  function sameChapter(a,b) {
    return !!a && !!b && a.osis === b.osis && +a.chapter === +b.chapter;
  }

  function overlapsVerse(parsed, verseNum) {
    if (!parsed || !Number.isFinite(+verseNum)) return false;
    const v = +verseNum;
    if (!parsed.from) return false; // chapter-only refs belong to 整章, not 本节
    const start = +parsed.from;
    const end = Math.max(start, +(parsed.to || parsed.from));
    return v >= start && v <= end;
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
      if (sameChapter(parseRelationRef(rel), ref)) for (const id of rel.egw_ids || []) ids.add(id);
    }
    const rows = [...ids].map(id => egwRecords.find(r => r.id === id)).filter(Boolean);
    const top = navStack[navStack.length - 1];
    if (top?.kind === 'egw' && top.record && !rows.some(r => r.id === top.record.id)) rows.unshift(top.record);
    return rows.slice(0,12);
  }

  function filterEgwForVerse(chapterRef, verseNum) {
    if (!chapterRef || !Number.isFinite(+verseNum)) return relatedEgwForBible(chapterRef);
    const ids = new Set();
    for (const record of egwRecords) {
      if ((record.bible_refs || []).some(v => {
        const parsed = parseRef(v);
        return sameChapter(parsed, chapterRef) && overlapsVerse(parsed, verseNum);
      })) ids.add(record.id);
    }
    for (const rel of relations) {
      const parsed = parseRelationRef(rel);
      if (sameChapter(parsed, chapterRef) && overlapsVerse(parsed, verseNum)) {
        for (const id of rel.egw_ids || []) ids.add(id);
      }
    }
    return [...ids].map(id => egwRecords.find(r => r.id === id)).filter(Boolean).slice(0,12);
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

  function relatedBibleForEgwParagraph(paragraphEl) {
    const refs = [];
    const seen = new Set();
    const add = ref => {
      if (!ref) return;
      const key = `${chapterKey(ref)}:${ref.from || 0}:${ref.to || 0}`;
      if (!seen.has(key)) { seen.add(key); refs.push(ref); }
    };
    if (paragraphEl) extractRefs(paragraphEl.textContent || '').forEach(add);
    return refs.slice(0,16);
  }

  function matchingRecordRefs(record, chapterRef, focusVerse) {
    return (record?.bible_refs || []).map(parseRef).filter(parsed => {
      if (!parsed || (chapterRef && !sameChapter(parsed, chapterRef))) return false;
      if (Number.isFinite(+focusVerse)) return overlapsVerse(parsed, focusVerse);
      return true;
    });
  }

  function relationThemesForRecord(record, chapterRef, focusVerse) {
    const themes = [];
    for (const rel of relations) {
      if (!(rel.egw_ids || []).includes(record?.id)) continue;
      const parsed = parseRelationRef(rel);
      if (chapterRef && !sameChapter(parsed, chapterRef)) continue;
      if (Number.isFinite(+focusVerse) && parsed?.from && !overlapsVerse(parsed, focusVerse)) continue;
      for (const t of rel.themes || []) if (t && !themes.includes(t)) themes.push(t);
    }
    return themes;
  }

  function relationHitsForRecord(record, chapterRef, focusVerse) {
    const hits = [];
    for (const rel of relations) {
      if (!(rel.egw_ids || []).includes(record?.id)) continue;
      const parsed = parseRelationRef(rel);
      if (chapterRef && !sameChapter(parsed, chapterRef)) continue;
      if (Number.isFinite(+focusVerse)) {
        if (!parsed?.from || !overlapsVerse(parsed, focusVerse)) continue;
      }
      hits.push({rel, parsed});
    }
    return hits;
  }

  function evidenceTypeForRecord(record, chapterRef, focusVerse) {
    const refs = matchingRecordRefs(record, chapterRef, focusVerse);
    const relHits = relationHitsForRecord(record, chapterRef, focusVerse);
    const kind = String(record?.evidence?.kind || '');
    const exactRef = r => r.from && (+r.to || +r.from) === +r.from && Number.isFinite(+focusVerse) && +r.from === +focusVerse;
    const hasExact = refs.some(exactRef) || relHits.some(h => exactRef(h.parsed || {}));
    const hasRange = refs.some(r => r.from) || relHits.some(h => h.parsed?.from);
    const themes = relationThemesForRecord(record, chapterRef, focusVerse);
    if (kind === '正文引用' || hasExact) return '直接引用';
    if (hasRange || (kind === '资料索引' && (refs.length || relHits.length))) return '经文范围匹配';
    if (themes.length) return '主题关联';
    return '章节索引';
  }

  function evidenceWhyForRecord(record, chapterRef, focusVerse) {
    // Allowed: evidence.why, explicit bible_refs, relation bible_ref/normalized, themes, locator.
    // Forbidden: summary / title / guessed topics.
    if (record?.evidence?.why) return humanWhy(record.evidence.why) || String(record.evidence.why);
    const refs = matchingRecordRefs(record, chapterRef, focusVerse);
    if (refs.length) return refs.map(refLabel).join('、');
    const relHits = relationHitsForRecord(record, chapterRef, focusVerse);
    for (const {rel, parsed} of relHits) {
      const label = rel.bible_ref || rel.normalized || refLabel(parsed);
      if (label) return label;
    }
    const themes = relationThemesForRecord(record, chapterRef, focusVerse);
    if (themes.length) return themes.slice(0, 3).join('、');
    // Chapter-scope may still cite same-chapter bible_refs as honest index evidence.
    if (!Number.isFinite(+focusVerse)) {
      const chapterRefs = (record?.bible_refs || []).map(parseRef).filter(p => sameChapter(p, chapterRef));
      if (chapterRefs.length) return chapterRefs.map(refLabel).join('、');
    }
    if (record?.locator) return `出处定位：${record.locator}`;
    return '出处定位：该资料已被索引到本章';
  }

  function evidenceTypeForBibleRef(ref) {
    if (!ref) return '章节索引';
    let best = null;
    for (const rel of relations) {
      const parsed = parseRelationRef(rel);
      if (!sameChapter(parsed, ref)) continue;
      if (ref?.from && parsed?.from && !overlapsVerse(parsed, ref.from)) continue;
      best = rel;
      if (ref?.from && parsed?.from && +parsed.from === +ref.from && (+parsed.to || +parsed.from) === +ref.from) break;
    }
    if (ref.from && ref.to && +ref.to !== +ref.from) return '经文范围匹配';
    if (ref.from) {
      if (best?.themes?.length && !(best.bible_ref || best.normalized)) return '主题关联';
      return '直接引用';
    }
    if (best?.themes?.length) return '主题关联';
    return '章节索引';
  }

  function evidenceWhyForBibleRef(ref) {
    // Allowed: explicit ref label, relation bible_ref/normalized, themes. Never summary/title.
    let best = null;
    for (const rel of relations) {
      const parsed = parseRelationRef(rel);
      if (!sameChapter(parsed, ref)) continue;
      if (ref?.from && parsed?.from && !overlapsVerse(parsed, ref.from)) continue;
      best = rel;
      if (ref?.from && overlapsVerse(parsed, ref.from)) break;
    }
    if (best?.bible_ref || best?.normalized) {
      const label = best.bible_ref || best.normalized;
      if (best.themes?.length) return `${label} · ${best.themes.slice(0, 3).join('、')}`;
      return label;
    }
    if (best?.themes?.length) return best.themes.slice(0, 3).join('、');
    if (ref?.from) return refLabel(ref);
    return '出处定位：该经文已被索引到本章';
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
    for (const rel of relations) {
      const parsed = parseRelationRef(rel);
      if (sameChapter(parsed, ref) && parsed.from) refs.push(parsed);
    }
    const seen = new Set();
    for (const r of refs) {
      const start = Math.max(1, +r.from || 1), end = Math.max(start, +r.to || start);
      for (let v = start; v <= end; v++) {
        if (seen.has(v)) continue;
        seen.add(v);
        body.querySelector(`.reading>.verse[data-verse="${v}"]`)?.classList.add('crossLinked');
      }
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
      sheet.innerHTML = `<button class="crossIndexBackdrop" type="button" data-cross-index-close aria-label="关闭关联"></button><section class="crossIndexPanel" aria-label="关联"><header><div><b>关联</b><small>只显示可核验关联，并附依据</small></div><button type="button" data-cross-index-close aria-label="关闭">×</button></header><div class="crossIndexReturn"></div><div class="crossIndexList"></div></section>`;
      detail.appendChild(sheet);
    }
    return {handle, sheet};
  }

  function associationCount() {
    const kind = detail.dataset.readerKind;
    if (kind === 'bible-reader') return relatedEgwForBible(currentBibleRef()).length;
    if (kind === 'egw-reader') return relatedBibleForEgw().length;
    return 0;
  }

  function setFabVisibility({sheetOpen = false} = {}) {
    const {handle} = ensureUi();
    const persistent = document.getElementById('readerCrossIndex');
    const kind = detail.dataset.readerKind;
    const readerOpen = detail.open && (kind === 'bible-reader' || kind === 'egw-reader');
    if (!readerOpen || sheetOpen) {
      handle.hidden = true;
      if (persistent) persistent.hidden = true;
      return;
    }
    const count = associationCount();
    handle.hidden = count === 0 && navStack.length === 0;
    handle.querySelector('b').textContent = count ? `关联 ${count}` : '返回';
    handle.setAttribute('aria-label', count ? `打开关联，共 ${count} 条` : '返回关联位置');
    if (persistent) {
      persistent.hidden = false;
      persistent.setAttribute('aria-label', count ? `打开关联，共 ${count} 条` : '打开关联');
      const label = persistent.querySelector('b');
      if (label) label.textContent = count ? `关联 ${count}` : '关联';
    }
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

  function scopeToggleHtml(sheet, kind) {
    const focusVerse = sheet._focusVerse;
    const focusPara = sheet._focusPara;
    if (kind === 'bible' && focusVerse) {
      const scope = sheet._scope || 'verse';
      return `<div class="crossIndexScope" role="tablist" aria-label="关联范围">`+
        `<button type="button" data-cross-scope="verse" class="${scope==='verse'?'active':''}" aria-selected="${scope==='verse'}">本节 ${focusVerse}</button>`+
        `<button type="button" data-cross-scope="chapter" class="${scope==='chapter'?'active':''}" aria-selected="${scope==='chapter'}">整章</button>`+
      `</div>`;
    }
    if (kind === 'egw' && focusPara) {
      const scope = sheet._scope || 'paragraph';
      return `<div class="crossIndexScope" role="tablist" aria-label="关联范围">`+
        `<button type="button" data-cross-scope="paragraph" class="${scope==='paragraph'?'active':''}" aria-selected="${scope==='paragraph'}">本段</button>`+
        `<button type="button" data-cross-scope="chapter" class="${scope==='chapter'?'active':''}" aria-selected="${scope==='chapter'}">本章</button>`+
      `</div>`;
    }
    return '';
  }


  function drawerTitle(kind, sheet) {
    if (kind === 'bible') {
      const ref = currentBibleRef();
      if (!ref) return '关联';
      if (sheet._scope === 'verse' && sheet._focusVerse) {
        return `${ref.full} ${ref.chapter}:${sheet._focusVerse} 的关联`;
      }
      return `${ref.full} ${ref.chapter}章 的关联`;
    }
    const book = String(body.querySelector('.egwBookName')?.textContent || '').trim() || '怀爱伦著作';
    const bookLabel = book.startsWith('《') ? book : `《${book.replace(/^[《]|[》]$/g, '')}》`;
    if (kind === 'egw' && sheet._scope === 'paragraph' && sheet._focusPara) {
      const locator = String(sheet._focusPara.closest('.egwParagraphWrap')?.querySelector('.egwLocator')?.textContent
        || sheet._focusPara.dataset?.locator
        || '').trim();
      if (locator) return `${bookLabel} · ${locator} 的关联`;
      return `${bookLabel} · 本段 的关联`;
    }
    const chapter = String(document.getElementById('detailType')?.textContent || body.querySelector('.egwReaderIntro h1')?.textContent || '').trim();
    if (chapter) return `${bookLabel} · ${chapter} 的关联`;
    return `${bookLabel} · 本章 的关联`;
  }

  function rowSourceBlock(label, value) {
    if (!value) return '';
    return `<div class="crossIndexBlock crossIndexSource"><span class="crossIndexBlockLabel">出处</span><span class="crossIndexBlockBody">${esc(value)}</span></div>`;
  }

  function rowContentBlock(value) {
    if (!value) return '';
    return `<div class="crossIndexBlock crossIndexContent"><span class="crossIndexBlockLabel">内容</span><span class="crossIndexBlockBody">${esc(value)}</span></div>`;
  }

  function rowEvidenceBlock(type, why) {
    const whyText = humanWhy(why) || why || '';
    const badge = type ? `<small class="crossIndexBadge">${esc(type)}</small>` : '';
    return `<div class="crossIndexBlock crossIndexEvidence"><span class="crossIndexBlockLabel">关联依据</span><span class="crossIndexBlockBody">${badge}${whyText ? `<small class="crossIndexWhy">${esc(whyText)}</small>` : ''}</span></div>`;
  }

  function egwSourceLabel(record) {
    const title = `《${record.title_cn || '怀爱伦著作'}》`;
    const parts = [title];
    if (record.chapter) parts.push(record.chapter);
    if (record.locator) parts.push(record.locator);
    return parts.join(' · ');
  }

  function renderSheet(items, kind, expanded=false) {
    const {sheet} = ensureUi();
    const list = sheet.querySelector('.crossIndexList');
    const back = sheet.querySelector('.crossIndexReturn');
    const head = sheet.querySelector('.crossIndexPanel>header>div>b');
    const note = sheet.querySelector('.crossIndexPanel>header small');
    if (head) head.textContent = drawerTitle(kind, sheet);
    if (kind === 'bible' && sheet._focusVerse && sheet._scope === 'verse') {
      if (note) note.textContent = '可核验 · 本节优先';
    } else if (kind === 'egw' && sheet._focusPara && sheet._scope === 'paragraph') {
      if (note) note.textContent = '可核验 · 本段优先';
    } else {
      if (note) note.textContent = '只显示可核验关联，并附依据';
    }
    const panel = sheet.querySelector('.crossIndexPanel');
    if (panel) panel.setAttribute('aria-label', head?.textContent || '关联');
    back.innerHTML = (scopeToggleHtml(sheet, kind) || '') + (navStack.length ? `<button type="button" data-cross-index-back>‹ 返回关联处</button>` : '');
    if (!items.length) {
      if (sheet._scope === 'verse') {
        list.innerHTML = `<div class="crossIndexEmpty">此节暂无精确关联，可查看整章<br><button type="button" class="crossIndexEmptyAction" data-cross-scope="chapter">查看整章</button></div>`;
        return;
      }
      if (sheet._scope === 'paragraph') {
        list.innerHTML = `<div class="crossIndexEmpty">此段暂无精确关联，可查看本章<br><button type="button" class="crossIndexEmptyAction" data-cross-scope="chapter">查看本章</button></div>`;
        return;
      }
      list.innerHTML = `<div class="crossIndexEmpty">本章暂无可核验关联。<br><small>索引仍在建设；可先从已覆盖章节或怀著侧试。</small></div>`;
      return;
    }
    const visible=expanded?items:items.slice(0,INITIAL_RESULT_LIMIT);
    const more=!expanded&&items.length>visible.length?`<button type="button" class="crossIndexMore" data-cross-index-all>查看全部 ${items.length} 条</button>`:'';
    if (kind === 'bible') {
      const chapterRef = currentBibleRef();
      const focusVerse = sheet._scope === 'verse' ? sheet._focusVerse : null;
      list.innerHTML = `<h3>关联怀著</h3>${visible.map(r => {
        const type = evidenceTypeForRecord(r, chapterRef, focusVerse);
        const why = evidenceWhyForRecord(r, chapterRef, focusVerse);
        const source = egwSourceLabel(r);
        const content = String(r.summary || '').trim();
        return `<button type="button" class="crossIndexRow" data-cross-egw="${esc(r.id)}"><span>${rowSourceBlock('出处', source)}${rowContentBlock(content)}${rowEvidenceBlock(type, why)}</span><i>›</i></button>`;
      }).join('')}${more}`;
    } else {
      list.innerHTML = `<h3>相关经文</h3>${visible.map((r,i) => {
        const type = evidenceTypeForBibleRef(r);
        const why = evidenceWhyForBibleRef(r);
        const source = refLabel(r);
        const content = r.focus ? `打开整章 · 定位第 ${r.focus} 节` : '打开整章';
        return `<button type="button" class="crossIndexRow" data-cross-bible="${i}"><span>${rowSourceBlock('出处', source)}${rowContentBlock(content)}${rowEvidenceBlock(type, why)}</span><i>›</i></button>`;
      }).join('')}${more}`;
    }
  }

  function itemsForSheet(sheet, kind) {
    if (kind === 'bible') {
      const chapterRef = currentBibleRef();
      if (sheet._scope === 'verse' && sheet._focusVerse) return filterEgwForVerse(chapterRef, sheet._focusVerse);
      return relatedEgwForBible(chapterRef);
    }
    if (sheet._scope === 'paragraph' && sheet._focusPara) return relatedBibleForEgwParagraph(sheet._focusPara);
    return relatedBibleForEgw();
  }

  function detectReadingFocus() {
    const kind = detail.dataset.readerKind;
    if (kind === 'bible-reader') {
      const marked = body.querySelector('.reading>.verse.readingMark');
      const verse = marked ? +marked.dataset.verse : NaN;
      if (Number.isFinite(verse)) return {verse};
      return null;
    }
    if (kind === 'egw-reader') {
      const marked = body.querySelector('.egwParagraphWrap.readingMark .egwParagraph');
      if (marked) return {paragraphEl: marked};
      return null;
    }
    return null;
  }

  function openSheet(focus) {
    const kind = detail.dataset.readerKind;
    if (kind !== 'bible-reader' && kind !== 'egw-reader') return;
    const ui = ensureUi();
    const sheet = ui.sheet;
    const mode = kind === 'bible-reader' ? 'bible' : 'egw';
    const resolvedFocus = focus === undefined ? detectReadingFocus() : focus;
    sheet._crossExpanded = false;
    sheet._focusVerse = null;
    sheet._focusPara = null;
    sheet._scope = 'chapter';
    if (mode === 'bible' && resolvedFocus && Number.isFinite(+resolvedFocus.verse)) {
      sheet._focusVerse = +resolvedFocus.verse;
      sheet._scope = 'verse';
    } else if (mode === 'egw' && resolvedFocus?.paragraphEl) {
      sheet._focusPara = resolvedFocus.paragraphEl;
      sheet._scope = 'paragraph';
    }
    const items = itemsForSheet(sheet, mode);
    renderSheet(items, mode);
    sheet.hidden = false;
    sheet.dataset.kind = kind;
    sheet._crossItems = items;
    setFabVisibility({sheetOpen: true});
  }

  window.jgOpenCrossIndex = openSheet;

  function closeSheet() {
    const sheet = detail.querySelector('.crossIndexSheet');
    if (sheet) sheet.hidden = true;
    setFabVisibility({sheetOpen: false});
  }

  function refresh() {
    if (!books.length) return;
    clearMarks();
    const {sheet} = ensureUi();
    const wasOpen = sheet && !sheet.hidden;
    const kind = detail.dataset.readerKind;
    if (!detail.open || (kind !== 'bible-reader' && kind !== 'egw-reader')) {
      if (sheet) sheet.hidden = true;
      setFabVisibility({sheetOpen: false});
      return;
    }
    if (kind === 'bible-reader') {
      const ref = currentBibleRef(), rows = relatedEgwForBible(ref);
      markBibleLinks(ref, rows);
    } else {
      markEgwLinks();
    }
    if (wasOpen) {
      const focus = sheet._focusVerse ? {verse: sheet._focusVerse} : sheet._focusPara ? {paragraphEl: sheet._focusPara} : null;
      openSheet(focus);
    } else {
      setFabVisibility({sheetOpen: false});
    }
  }

  detail.addEventListener('click', e => {
    if (e.target.closest('[data-cross-index-open]')) { e.preventDefault(); openSheet(detectReadingFocus()); return; }
    const scopeBtn = e.target.closest('[data-cross-scope]');
    if (scopeBtn) {
      e.preventDefault();
      const sheet = detail.querySelector('.crossIndexSheet');
      if (!sheet) return;
      sheet._scope = scopeBtn.dataset.crossScope;
      sheet._crossExpanded = false;
      const mode = sheet.dataset.kind === 'bible-reader' ? 'bible' : 'egw';
      const items = itemsForSheet(sheet, mode);
      sheet._crossItems = items;
      renderSheet(items, mode);
      return;
    }
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
    if (startedAwayFromEdge && dx > 72 && Math.abs(dy) < 58) openSheet(detectReadingFocus());
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
  style.textContent = `/* study-desk sheet */

    #detail[data-reader-kind="bible-reader"]>footer,#detail[data-reader-kind="egw-reader"]>footer{justify-content:flex-start!important;gap:8px!important;min-height:38px;padding:3px 11px calc(4px + env(safe-area-inset-bottom))!important;border-top:1px solid color-mix(in srgb,var(--line) 72%,transparent)!important;background:color-mix(in srgb,var(--surface) 92%,transparent)!important;backdrop-filter:blur(10px)}
    #detail[data-reader-kind="bible-reader"]>footer>*,#detail[data-reader-kind="egw-reader"]>footer>*{flex:0 0 auto!important;min-height:30px!important;padding:0 6px!important;border:0!important;border-radius:0!important;background:transparent!important;color:var(--muted)!important;font-size:10.5px!important;font-weight:600!important;box-shadow:none!important}
    #detail[data-reader-kind="bible-reader"]>footer>*:last-child,#detail[data-reader-kind="egw-reader"]>footer>*:last-child{margin-left:auto;color:color-mix(in srgb,var(--accent) 78%,var(--muted))!important}
    .crossIndexHandle[hidden],.crossIndexSheet[hidden]{display:none!important}
    .crossIndexHandle{position:fixed;right:max(8px,env(safe-area-inset-right));bottom:calc(48px + env(safe-area-inset-bottom));z-index:18;display:flex;align-items:center;gap:4px;min-height:30px!important;padding:0 8px!important;border:1px solid color-mix(in srgb,var(--accent) 34%,var(--line))!important;border-radius:999px!important;background:color-mix(in srgb,var(--surface) 92%,transparent)!important;color:var(--accent)!important;font-size:10px!important;box-shadow:0 2px 12px #0000000d!important;backdrop-filter:blur(10px);opacity:.86}
    .crossIndexHandle b{font-size:10px;font-weight:700}
    .crossIndexMore{width:100%;min-height:44px;margin-top:6px;border:0!important;border-top:1px solid var(--line)!important;border-radius:0!important;background:transparent!important;color:var(--accent)!important;font-size:13px!important;font-weight:700!important}
    .crossIndexSheet{position:fixed;inset:0;z-index:40;display:flex;align-items:flex-end;justify-content:center}
    .crossIndexBackdrop{position:absolute;inset:0;width:100%;height:100%;border:0!important;border-radius:0!important;background:#0004!important}
    .crossIndexPanel{position:relative;width:min(720px,100%);max-height:min(62vh,560px);overflow:auto;padding:12px 14px calc(48px + env(safe-area-inset-bottom,0px));border-radius:18px 18px 0 0;background:var(--surface);box-shadow:0 -14px 40px #0002}
    .crossIndexPanel>header{position:static!important;display:flex!important;align-items:center!important;justify-content:space-between!important;padding:2px 0 10px!important;border:0!important;background:transparent!important;backdrop-filter:none!important}
    .crossIndexPanel>header>div{display:flex;flex-direction:column;gap:2px}.crossIndexPanel>header b{font-size:15px}.crossIndexPanel>header small{color:var(--muted);font-size:9.5px}.crossIndexPanel>header>button{min-width:34px!important;min-height:34px!important;padding:0!important;border:0!important;background:transparent!important;color:var(--muted)!important;font-size:22px!important}
    .crossIndexReturn{margin:0 0 5px}.crossIndexReturn:empty{display:none}.crossIndexReturn button{min-height:34px!important;padding:0 2px!important;border:0!important;background:transparent!important;color:var(--accent)!important;font-size:11px!important;font-weight:700!important}
    .crossIndexScope{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 8px}
    .crossIndexScope button{min-height:34px!important;border:1px solid var(--line)!important;border-radius:999px!important;background:transparent!important;color:var(--muted)!important;font-size:11px!important}
    .crossIndexScope button.active{border-color:color-mix(in srgb,var(--accent) 40%,var(--line))!important;background:color-mix(in srgb,var(--accent) 10%,var(--surface))!important;color:var(--accent)!important;font-weight:750!important}
    .crossIndexList h3{margin:8px 0 5px;color:var(--muted);font-size:10.5px;font-weight:700;letter-spacing:.03em}
    .crossIndexRow{width:100%;min-height:54px!important;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 2px!important;border:0!important;border-bottom:1px solid var(--line)!important;border-radius:0!important;background:transparent!important;color:var(--text)!important;text-align:left;box-shadow:none!important}
    .crossIndexRow>span{min-width:0;display:flex;flex-direction:column;gap:3px}.crossIndexRow b{font-size:14px;font-weight:650;line-height:1.35}.crossIndexRow small{color:var(--muted);font-size:9.5px;line-height:1.35}.crossIndexRow i{flex:0 0 auto;color:var(--muted);font-size:22px;font-style:normal;font-weight:400}
    .crossIndexBadge{display:inline-block;margin:0 6px 0 0;padding:1px 6px;border:1px solid color-mix(in srgb,var(--accent) 35%,var(--line));border-radius:999px;color:var(--accent);font-size:9px;font-weight:700;line-height:1.4;vertical-align:middle}
    .crossIndexWhy{display:inline;margin:0;color:var(--accent);font-size:9.5px;line-height:1.45;vertical-align:middle}
    .crossIndexBlock{display:grid;grid-template-columns:52px minmax(0,1fr);gap:6px;align-items:start;margin-top:6px}
    .crossIndexBlock:first-child{margin-top:0}
    .crossIndexBlockLabel{color:var(--muted);font-size:10px;font-weight:700;line-height:1.45;padding-top:1px}
    .crossIndexBlockBody{min-width:0;color:var(--text);font-size:12.5px;line-height:1.5;font-weight:550}
    .crossIndexContent .crossIndexBlockBody{color:var(--muted);font-weight:500;font-size:12px;line-height:1.55}
    .crossIndexEvidence .crossIndexBlockBody{display:flex;flex-wrap:wrap;align-items:center;gap:4px}
    .crossIndexPanel>header b{font-size:14px;line-height:1.35;max-width:min(78vw,520px)}
    .crossIndexEmpty{padding:20px 4px;color:var(--muted);font-size:12px;text-align:center;line-height:1.55}
    .crossIndexEmptyAction{display:inline-flex;align-items:center;justify-content:center;min-height:34px;margin-top:10px;padding:0 14px;border:1px solid color-mix(in srgb,var(--accent) 40%,var(--line))!important;border-radius:999px!important;background:color-mix(in srgb,var(--accent) 10%,var(--surface))!important;color:var(--accent)!important;font-size:12px!important;font-weight:700!important}
    .egwParagraphWrap.crossLinked,.reading>.verse.crossLinked{position:relative}
    .egwParagraphWrap.crossLinked::after,.reading>.verse.crossLinked::after{content:'↔';position:absolute;right:1px;top:2px;color:var(--accent);font-family:system-ui,sans-serif;font-size:8px;font-weight:700;opacity:.42}
    @media(max-width:560px){.crossIndexPanel{padding-left:12px;padding-right:12px}.crossIndexHandle{right:6px;bottom:calc(46px + env(safe-area-inset-bottom))}.crossIndexRow{min-height:52px!important}}
  `;
  document.head.appendChild(style);

  ensureUi();
  ready.then(refresh);
})();
