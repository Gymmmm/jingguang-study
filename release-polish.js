(() => {
  'use strict';

  const detail = document.getElementById('detail');
  const studyResults = document.getElementById('studyResults');
  const DATA_URLS = {
    books:'./data/bible-books.json',
    egw:'./data/egw-index.json',
    relations:'./data/bible-egw-relations.json'
  };
  let books = [];
  let egwRecords = [];
  let relations = [];
  let aliases = [];
  let aliasMap = new Map();
  let searchState = null;
  let lastSearchQuery = '';
  let crossSessionDepth = 0;
  let enrichQueued = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
  const digits = value => String(value || '').replace(/[０-９]/g, ch => String('０１２３４５６７８９'.indexOf(ch)));
  const rxEscape = value => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function showToast(text) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  if (typeof window.page === 'function' && !window.page.__jgStablePage) {
    const basePage = window.page;
    const wrappedPage = function stablePage(id) {
      const active = document.querySelector('.page.active')?.id || '';
      if (active !== id) return basePage(id);
      const y = window.scrollY;
      const result = basePage(id);
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
      return result;
    };
    wrappedPage.__jgStablePage = true;
    window.page = wrappedPage;
  }

  if (typeof window.openShelf === 'function' && !window.openShelf.__jgStableShelf) {
    const baseOpenShelf = window.openShelf;
    const wrappedOpenShelf = function stableShelf(kind) {
      const app = document.querySelector('.app');
      const current = app?.getAttribute('data-open-shelf') || '';
      const switched = document.querySelector('.page.active')?.id === 'library' && current && current !== kind;
      const result = baseOpenShelf(kind);
      if (switched) requestAnimationFrame(() => window.scrollTo(0, 0));
      return result;
    };
    wrappedOpenShelf.__jgStableShelf = true;
    window.openShelf = wrappedOpenShelf;
  }

  function releaseAlphabetPointer(event) {
    const rail = document.querySelector('.egwAlphaRail');
    if (!rail || typeof rail.hasPointerCapture !== 'function') return;
    try {
      if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
    } catch (_) {}
  }
  document.addEventListener('pointerup', releaseAlphabetPointer, true);
  document.addEventListener('pointercancel', releaseAlphabetPointer, true);

  const dataReady = Promise.all([
    fetch(DATA_URLS.books).then(r => r.ok ? r.json() : Promise.reject(new Error('books'))),
    fetch(DATA_URLS.egw).then(r => r.ok ? r.json() : Promise.reject(new Error('egw'))),
    fetch(DATA_URLS.relations).then(r => r.ok ? r.json() : Promise.reject(new Error('relations')))
  ]).then(([bookData, egwData, relationData]) => {
    books = bookData.books || [];
    egwRecords = egwData.records || [];
    relations = relationData.relations || [];
    aliasMap = new Map();
    for (const [osis, full, short] of books) {
      for (const alias of [full, short]) {
        if (alias) aliasMap.set(alias, {osis, full, short});
      }
    }
    aliases = [...aliasMap.keys()].sort((a,b) => b.length - a.length);
    scheduleCrossIndexEnrich();
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

  function refKey(ref) {
    return ref ? `${ref.osis}:${ref.chapter}:${ref.from || 0}:${ref.to || 0}` : '';
  }

  function sameChapter(a, b) {
    return !!a && !!b && a.osis === b.osis && +a.chapter === +b.chapter;
  }

  function refLabel(ref) {
    if (!ref) return '';
    return `${ref.full} ${ref.chapter}${ref.from ? ':' + ref.from + (ref.to && ref.to !== ref.from ? '-' + ref.to : '') : '章'}`;
  }

  function extractExpandedRefs(text) {
    if (!aliases.length || !text) return [];
    const bookPattern = aliases.map(rxEscape).join('|');
    const rx = new RegExp(
      `(${bookPattern})\\s*([0-9０-９]{1,3})\\s*[:：]\\s*` +
      `([0-9０-９]{1,3}(?:\\s*[-–—]\\s*[0-9０-９]{1,3})?` +
      `(?:\\s*[,，、]\\s*[0-9０-９]{1,3}(?:\\s*[-–—]\\s*[0-9０-９]{1,3})?)*)`,
      'g'
    );
    const out = [], seen = new Set();
    let match;
    while ((match = rx.exec(String(text)))) {
      const book = aliasMap.get(match[1]);
      if (!book) continue;
      const chapter = +digits(match[2]);
      const parts = match[3].split(/[,，、]/).map(x => digits(x).trim()).filter(Boolean);
      for (const part of parts) {
        const range = part.match(/^(\d{1,3})(?:[-–—](\d{1,3}))?$/);
        if (!range) continue;
        const from = +range[1], to = range[2] ? +range[2] : from;
        const ref = {...book, chapter, from, to, focus:from};
        const key = refKey(ref);
        if (!seen.has(key)) {
          seen.add(key);
          out.push(ref);
        }
      }
    }
    return out;
  }

  function currentBibleRef() {
    const m = String(detail?.dataset.readingKey || '').match(/^bible:([^:]+):(\d+)$/);
    if (!m) return null;
    const row = books.find(x => x[0] === m[1]);
    return row ? {osis:row[0], full:row[1], short:row[2], chapter:+m[2], from:null, to:null} : null;
  }

  function currentEgwRecord() {
    try {
      const last = JSON.parse(localStorage.getItem('jg_last_egw_native') || 'null');
      const url = String(last?.url || last?.native_url || '').replace(/[?#].*$/, '').replace(/\/$/, '')
        .replace(/^https?:\/\/(?:m\.|text\.)?egwwritings\.org\/zh\/book\/(\d+)\.(\d+)$/i, 'https://text.egwwritings.org/read/$1.$2');
      if (url) {
        const exact = egwRecords.find(r => String(r.source_url || '').replace(/^https?:\/\/m\.egwwritings\.org\/zh\/book\/(\d+)\.(\d+)$/i, 'https://text.egwwritings.org/read/$1.$2') === url);
        if (exact) return exact;
      }
    } catch (_) {}
    return null;
  }

  function reasonForEgw(record, bibleRef) {
    const direct = (record?.bible_refs || []).filter(v => sameChapter(parseRef(v), bibleRef));
    if (direct.length) {
      return `关联依据：该怀著资料明确标注 ${direct.slice(0,2).join('、')}`;
    }
    const linked = relations.filter(rel => sameChapter(parseRef(rel.bible_ref), bibleRef) && (rel.egw_ids || []).includes(record?.id));
    if (linked.length) {
      const themes = [...new Set(linked.flatMap(rel => rel.themes || []))].slice(0,3);
      return `关联依据：经文—怀著资料索引${themes.length ? ' · ' + themes.join(' / ') : ''}`;
    }
    return '关联依据：同章经文资料索引';
  }

  function reasonForBible(ref, record, paragraphRefs) {
    const indexed = (record?.bible_refs || []).some(v => {
      const parsed = parseRef(v);
      if (!parsed || !sameChapter(parsed, ref)) return false;
      if (!parsed.from || !ref.from) return true;
      return parsed.from <= (ref.to || ref.from) && ref.from <= (parsed.to || parsed.from);
    });
    if (indexed) return '关联依据：当前怀著资料索引明确标注这处经文';
    if (paragraphRefs.some(x => refKey(x) === refKey(ref))) return '关联依据：当前怀著正文中出现这处经文引用';
    return '关联依据：当前怀著的经文引用索引';
  }

  function enrichOpenCrossIndex() {
    enrichQueued = false;
    if (!detail?.open) return;
    const sheet = detail.querySelector('.crossIndexSheet:not([hidden])');
    if (!sheet) return;
    const list = sheet.querySelector('.crossIndexList');
    if (!list) return;

    if (crossSessionDepth === 0) {
      const back = sheet.querySelector('.crossIndexReturn');
      if (back) back.innerHTML = '';
    }

    const handle = detail.querySelector('.crossIndexHandle');
    if (handle && crossSessionDepth === 0 && handle.querySelector('b')?.textContent === '返回') handle.hidden = true;

    const kind = sheet.dataset.kind;
    if (kind === 'egw') {
      const paragraphRefs = extractExpandedRefs(
        [...detail.querySelectorAll('.egwParagraph')].map(x => x.textContent || '').join(' ')
      );
      const items = Array.isArray(sheet._crossItems) ? sheet._crossItems : [];
      const seen = new Set(items.map(refKey));
      for (const ref of paragraphRefs) {
        if (items.length >= 16 || seen.has(refKey(ref))) continue;
        seen.add(refKey(ref));
        const index = items.length;
        items.push(ref);
        list.insertAdjacentHTML('beforeend',
          `<button type="button" class="crossIndexRow" data-cross-bible="${index}">` +
            `<span><b>${esc(refLabel(ref))}</b><small>打开整章 · 定位第 ${ref.from} 节</small></span><i>›</i>` +
          `</button>`
        );
      }
      sheet._crossItems = items;
      const record = currentEgwRecord();
      [...list.querySelectorAll('[data-cross-bible]')].forEach(row => {
        const ref = items[+row.dataset.crossBible];
        if (!ref || row.querySelector('.crossIndexWhy')) return;
        const why = document.createElement('small');
        why.className = 'crossIndexWhy';
        why.textContent = reasonForBible(ref, record, paragraphRefs);
        row.querySelector('span')?.appendChild(why);
      });
    } else if (kind === 'bible') {
      const bibleRef = currentBibleRef();
      const rows = [...list.querySelectorAll('[data-cross-egw]')];
      rows.forEach((row, index) => {
        if (index >= 5) {
          row.hidden = true;
          return;
        }
        const record = egwRecords.find(r => r.id === row.dataset.crossEgw);
        const host = row.querySelector('span');
        if (!record || !host || host.querySelector('.crossIndexWhy')) return;
        if (record.summary) {
          const summary = document.createElement('small');
          summary.className = 'crossIndexSummary';
          summary.textContent = record.summary;
          host.appendChild(summary);
        }
        const why = document.createElement('small');
        why.className = 'crossIndexWhy';
        why.textContent = reasonForEgw(record, bibleRef);
        host.appendChild(why);
      });
      if (rows.length > 5 && !list.querySelector('.crossIndexLimited')) {
        list.insertAdjacentHTML('beforeend','<div class="crossIndexLimited">只显示置信度较高的前 5 条关联。</div>');
      }
    }
  }

  function scheduleCrossIndexEnrich() {
    if (enrichQueued) return;
    enrichQueued = true;
    queueMicrotask(() => dataReady.finally(enrichOpenCrossIndex));
  }

  if (detail) {
    detail.addEventListener('click', event => {
      const back = event.target.closest('[data-cross-index-back]');
      if (back && crossSessionDepth <= 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
        back.remove();
        return;
      }
      if (event.target.closest('[data-cross-egw],[data-cross-bible]')) crossSessionDepth += 1;
      if (back && crossSessionDepth > 0) crossSessionDepth -= 1;
      if (event.target.closest('[data-cross-index-open]')) scheduleCrossIndexEnrich();
    }, true);

    detail.addEventListener('close', () => {
      crossSessionDepth = 0;
      queueMicrotask(() => {
        detail.querySelector('.crossIndexReturn')?.replaceChildren();
        const handle = detail.querySelector('.crossIndexHandle');
        if (handle?.querySelector('b')?.textContent === '返回') handle.hidden = true;
      });
    });

    const observer = new MutationObserver(() => {
      if (detail.querySelector('.crossIndexSheet:not([hidden])')) scheduleCrossIndexEnrich();
      forceSystemVoice();
    });
    observer.observe(detail, {subtree:true, childList:true, attributes:true, attributeFilter:['hidden']});
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function trackedFetch(...args) {
    try {
      const response = await nativeFetch(...args);
      if (searchState && !response.ok) searchState.failures += 1;
      return response;
    } catch (error) {
      if (searchState) searchState.failures += 1;
      throw error;
    }
  };

  function searchLoading(query) {
    if (!studyResults) return;
    studyResults.innerHTML =
      `<div class="searchLoading" role="status" aria-live="polite">` +
        `<i aria-hidden="true"></i><b>正在搜索资料</b>` +
        `<small>${esc(query)} · 正在读取圣经与怀爱伦资料</small>` +
      `</div>`;
  }

  function searchFailure(query) {
    if (!studyResults) return;
    studyResults.innerHTML =
      `<div class="searchStateCard searchFailed">` +
        `<b>资料读取失败</b>` +
        `<p>请检查网络后重试。这不是“没有搜索结果”。</p>` +
        `<button type="button" data-search-retry="${esc(query)}">重新读取</button>` +
      `</div>`;
  }

  function searchEmpty(query) {
    if (!studyResults) return;
    studyResults.innerHTML =
      `<div class="searchStateCard">` +
        `<b>没有找到相关内容</b>` +
        `<p>没有找到与“${esc(query)}”匹配的可核验资料，可以换一个关键词或经文。</p>` +
      `</div>`;
  }

  function wrapSearch() {
    if (typeof window.search !== 'function' || window.search.__jgSearchState) return;
    const baseSearch = window.search;
    const wrapped = async function polishedSearch(query) {
      const q = String(query || '').trim();
      if (!q) return baseSearch(query);
      lastSearchQuery = q;
      const state = {failures:0};
      searchState = state;
      let promise;
      try {
        promise = baseSearch(q);
        searchLoading(q);
        await promise;
      } catch (_) {
        state.failures += 1;
      } finally {
        if (searchState === state) searchState = null;
      }
      if (!studyResults) return;
      const hasResults = !!studyResults.querySelector('.card,.egwNativeHit,article[data-kind="bible"],article[data-kind="egw"]');
      if (!hasResults) {
        if (state.failures > 0) searchFailure(q);
        else searchEmpty(q);
      }
    };
    wrapped.__jgSearchState = true;
    window.search = wrapped;
  }
  wrapSearch();

  document.addEventListener('click', event => {
    const retry = event.target.closest('[data-search-retry]');
    if (!retry) return;
    event.preventDefault();
    window.search?.(retry.dataset.searchRetry || lastSearchQuery);
  }, true);

  const BACKUP_KEYS = [
    'jg_v10_recent',
    'jg_v10_reading',
    'jg_v10_favorites',
    'jg_v10_reading_position',
    'jg_v10_egw_position',
    'jg_v10_theme',
    'jg_v10_bible_font',
    'jg_last_egw_native',
    'jg_read_aloud_rate',
    'jg_read_aloud_position'
  ];

  function ensureBackupUi() {
    const page = document.getElementById('favorites');
    const list = document.getElementById('favoritesList');
    if (!page || !list || page.querySelector('.readerBackup')) return;
    const section = document.createElement('section');
    section.className = 'readerBackup';
    section.innerHTML =
      `<h2>数据备份</h2>` +
      `<p>保存收藏、最近阅读、阅读位置和阅读设置。不会导出材料篮或备讲内容。</p>` +
      `<div><button type="button" data-reader-export>导出备份</button>` +
      `<button type="button" data-reader-import>导入备份</button></div>` +
      `<input type="file" accept="application/json,.json" data-reader-import-file hidden>`;
    list.insertAdjacentElement('afterend', section);
  }

  function exportReaderData() {
    const data = {};
    for (const key of BACKUP_KEYS) {
      const value = localStorage.getItem(key);
      if (value != null) data[key] = value;
    }
    const payload = {
      schema:'jingguang-reader-backup',
      version:1,
      exported_at:new Date().toISOString(),
      data
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `救赎的历史-阅读备份-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    showToast('阅读数据已导出');
  }

  async function importReaderData(file) {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (payload?.schema !== 'jingguang-reader-backup' || payload?.version !== 1 || !payload.data || typeof payload.data !== 'object') {
        throw new Error('invalid_backup');
      }
      let count = 0;
      for (const key of BACKUP_KEYS) {
        if (!(key in payload.data) || typeof payload.data[key] !== 'string') continue;
        localStorage.setItem(key, payload.data[key]);
        count += 1;
      }
      if (!count) throw new Error('empty_backup');
      showToast('备份已导入，正在刷新');
      setTimeout(() => location.reload(), 650);
    } catch (_) {
      showToast('备份文件无法识别');
    }
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-reader-export]')) {
      event.preventDefault();
      exportReaderData();
      return;
    }
    if (event.target.closest('[data-reader-import]')) {
      event.preventDefault();
      document.querySelector('[data-reader-import-file]')?.click();
    }
  }, true);

  document.addEventListener('change', event => {
    if (!event.target.matches('[data-reader-import-file]')) return;
    importReaderData(event.target.files?.[0]);
    event.target.value = '';
  });

  ensureBackupUi();

  function forceSystemVoice() {
    localStorage.setItem('jg_read_aloud_voice_mode', 'system');
    const selector = document.querySelector('.readAloudBar [data-tts-voice]');
    if (!selector) return;
    if (selector.value !== 'system') {
      selector.value = 'system';
      selector.dispatchEvent(new Event('change', {bubbles:true}));
    }
    selector.remove();
  }
  forceSystemVoice();
  requestAnimationFrame(forceSystemVoice);

  const style = document.createElement('style');
  style.textContent = `
    .searchLoading{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-height:150px;color:var(--muted);text-align:center}
    .searchLoading i{width:24px;height:24px;border:2px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:jgSpin .75s linear infinite}
    .searchLoading b{color:var(--text);font-size:14px}.searchLoading small{font-size:11px;line-height:1.5}
    @keyframes jgSpin{to{transform:rotate(360deg)}}
    .searchStateCard{margin:14px 0;padding:18px 16px;border:1px solid var(--line);border-radius:14px;background:var(--surface);text-align:center}
    .searchStateCard b{display:block;margin-bottom:6px;font-size:15px}.searchStateCard p{margin:0;color:var(--muted);font-size:12px;line-height:1.6}
    .searchStateCard button{margin-top:12px;min-height:40px;padding:0 16px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--accent);font-weight:700}
    .crossIndexSummary{margin-top:3px!important;color:var(--text)!important;opacity:.78;font-size:10.5px!important;line-height:1.5!important}
    .crossIndexWhy{margin-top:2px!important;color:var(--accent)!important;font-size:9.5px!important;line-height:1.45!important}
    .crossIndexLimited{padding:10px 2px;color:var(--muted);font-size:9.5px;text-align:center}
    .readerBackup{margin:32px 0 18px;padding-top:22px;border-top:1px solid var(--line)}
    .readerBackup h2{margin:0 0 6px;font-size:16px}.readerBackup p{margin:0 0 12px;color:var(--muted);font-size:11px;line-height:1.6}
    .readerBackup>div{display:flex;gap:8px}.readerBackup button{min-height:40px;padding:0 13px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--accent);font-size:12px;font-weight:700}
    .readAloudBar .ttsVoice,[data-tts-voice]{display:none!important}
    @media(max-width:560px){.readerBackup{margin-left:2px;margin-right:2px}.readerBackup>div{display:grid;grid-template-columns:1fr 1fr}.readerBackup button{width:100%}}
  `;
  document.head.appendChild(style);
})();