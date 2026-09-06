(() => {
  let crossrefConfig = null;
  let crossrefTextPromise = null;
  let egwSource = null;
  let egwBooks = [];

  function crossrefKey(ref) {
    if (!ref || !ref.from || ref.from !== ref.to) return null;
    return `${ref.osis}.${ref.chapter}.${ref.from}`;
  }

  function osisToChinese(refText) {
    const m = String(refText || '').match(/^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)(?:-([1-3]?[A-Za-z]+)\.(\d+)\.(\d+))?$/);
    if (!m) return { label: refText, query: refText };
    const [, osis, chapter, verse, osis2, chapter2, verse2] = m;
    const book = bibleBooks.find(x => x[0] === osis);
    const name = book?.[2] || book?.[1] || osis;
    if (!osis2) return { label: `${name}${chapter}:${verse}`, query: `${name}${chapter}:${verse}` };
    const book2 = bibleBooks.find(x => x[0] === osis2);
    const name2 = book2?.[2] || book2?.[1] || osis2;
    const sameBook = osis === osis2;
    const sameChapter = sameBook && chapter === chapter2;
    const label = sameChapter ? `${name}${chapter}:${verse}-${verse2}` : `${name}${chapter}:${verse}-${name2}${chapter2}:${verse2}`;
    return { label, query: label };
  }

  async function getCrossrefConfig() {
    if (crossrefConfig) return crossrefConfig;
    const r = await fetch('./data/crossrefs-source.json', { cache: 'no-store' });
    if (!r.ok) throw new Error(`crossref config ${r.status}`);
    crossrefConfig = await r.json();
    return crossrefConfig;
  }

  async function getCrossrefText() {
    if (!crossrefTextPromise) {
      crossrefTextPromise = getCrossrefConfig().then(async cfg => {
        const r = await fetch(cfg.runtime_url);
        if (!r.ok) throw new Error(`crossref dataset ${r.status}`);
        return r.text();
      });
    }
    return crossrefTextPromise;
  }

  async function findCrossrefs(ref, limit = 16) {
    const key = crossrefKey(ref);
    if (!key) return [];
    const text = await getCrossrefText();
    const hits = [];
    for (const line of text.split('\n')) {
      if (!line || line[0] === '#') continue;
      const parts = line.split('\t');
      if (parts.length < 2 || parts[0] !== key) continue;
      hits.push({ from: parts[0], to: parts[1], votes: Number(parts[2] || 0) });
    }
    return hits.sort((a, b) => b.votes - a.votes).slice(0, limit);
  }

  async function renderCrossrefs(q) {
    const ref = parseBibleRef(q);
    const box = document.getElementById('crossrefsBox');
    if (!box || !ref) return;
    box.innerHTML = '<div class="empty">正在加载串珠资料…</div>';
    try {
      const hits = await findCrossrefs(ref);
      if (!hits.length) {
        box.innerHTML = '<div class="empty">这一节暂时没有找到串珠记录。</div>';
        return;
      }
      box.innerHTML = `<div class="card"><div class="meta">圣经串珠 · OpenBible</div><h3>相关经文 ${hits.length} 条</h3><div class="chips">${hits.map(h => {
        const x = osisToChinese(h.to);
        return `<button class="chip" onclick="window.jgStudyCrossref('${esc(x.query)}')">${esc(x.label)}</button>`;
      }).join('')}</div><p class="muted" style="margin-top:10px">按关联票数排序；点击经文继续研经。</p></div>`;
    } catch (e) {
      console.error(e);
      box.innerHTML = '<div class="empty">串珠资料读取失败；圣经正文和预言之灵检索不受影响。</div>';
    }
  }

  async function loadEGWMeta() {
    if (egwSource && egwBooks.length) return;
    try {
      const [s, b] = await Promise.all([
        fetch('./data/egw-source.json', { cache: 'no-store' }),
        fetch('./data/egw-books.json', { cache: 'no-store' })
      ]);
      if (s.ok) egwSource = await s.json();
      if (b.ok) {
        const j = await b.json();
        egwBooks = j.books || [];
      }
    } catch (e) {
      console.error('EGW metadata load failed', e);
    }
  }

  function cnNorm(s) {
    return String(s || '').toLowerCase().replace(/[\s《》〈〉“”"'，。！？；：、·\-–—_]/g, '');
  }

  function refParts(s) {
    const n = String(s || '').replace(/\s+/g, '').replace(/：/g, ':');
    const m = n.match(/^(.+?)(\d+)(?::(\d+)(?:[-–](\d+))?)?)?$/);
    if (!m) return null;
    return { book: cnNorm(m[1]), chapter: m[2] ? Number(m[2]) : null, from: m[3] ? Number(m[3]) : null, to: m[4] ? Number(m[4]) : (m[3] ? Number(m[3]) : null) };
  }

  function rangesOverlap(a, b) {
    if (!a || !b || a.book !== b.book) return false;
    if (a.chapter && b.chapter && a.chapter !== b.chapter) return false;
    if (!a.from || !b.from) return true;
    return Math.max(a.from, b.from) <= Math.min(a.to || a.from, b.to || b.from);
  }

  function relationMatches(q) {
    const n = cnNorm(q);
    const parsed = refParts(q);
    const scored = (relations || []).map(r => {
      let score = 0;
      const candidates = [r.bible_ref, r.normalized].filter(Boolean);
      for (const c of candidates) {
        const cn = cnNorm(c);
        if (cn === n) score = Math.max(score, 120);
        else if (cn.includes(n) || n.includes(cn)) score = Math.max(score, 80);
        if (parsed && rangesOverlap(parsed, refParts(c))) score = Math.max(score, 105);
      }
      for (const t of r.themes || []) {
        const tn = cnNorm(t);
        if (tn === n) score = Math.max(score, 100);
        else if (tn.includes(n) || n.includes(tn)) score = Math.max(score, 60);
      }
      return { r, score };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
    return scored.map(x => x.r);
  }

  function mergedRelation(q) {
    const list = relationMatches(q);
    if (!list.length) return null;
    return {
      bible_ref: list[0].bible_ref,
      normalized: list[0].normalized,
      themes: [...new Set(list.flatMap(x => x.themes || []))],
      related_bible: [...new Set(list.flatMap(x => x.related_bible || []))],
      egw_ids: [...new Set(list.flatMap(x => x.egw_ids || []))],
      matches: list
    };
  }

  relationFor = function(q) {
    return mergedRelation(q);
  };

  function egwScore(e, q, rel) {
    const n = cnNorm(q);
    if (!n) return 0;
    let score = 0;
    const title = cnNorm(e.title_cn);
    const chapter = cnNorm(e.chapter);
    const locator = cnNorm(e.locator);
    const refs = (e.bible_refs || []).map(cnNorm);
    const topics = (e.topics || []).map(cnNorm);
    const summary = cnNorm(e.summary);
    if (title === n) score += 100;
    else if (title.includes(n) || n.includes(title)) score += 70;
    if (chapter.includes(n)) score += 55;
    if (locator.includes(n)) score += 50;
    if (refs.some(x => x === n)) score += 95;
    else if (refs.some(x => x.includes(n) || n.includes(x))) score += 60;
    if (topics.some(x => x === n)) score += 80;
    else if (topics.some(x => x.includes(n) || n.includes(x))) score += 45;
    if (summary.includes(n)) score += 20;
    if ((rel?.egw_ids || []).includes(e.id)) score += 150;
    for (const theme of rel?.themes || []) {
      const t = cnNorm(theme);
      if (topics.includes(t)) score += 35;
    }
    return score;
  }

  function rankedEGW(q, rel) {
    const merged = rel || mergedRelation(q);
    return (egw || [])
      .map(e => ({ e, score: egwScore(e, q, merged) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.e);
  }

  relatedEGW = function(q, rel) {
    return rankedEGW(q, rel);
  };

  egwCard = function(e) {
    return `<div class="result"><div class="meta">第二层 · 预言之灵 · 可核验出处</div><h3>《${esc(e.title_cn || '未命名')}》 · ${esc(e.chapter || '')}</h3><div class="source"><b>出处：${esc(e.locator || '待补')}</b><br>相关经文：${(e.bible_refs || []).map(esc).join(' · ') || '暂无'}</div><p style="margin-top:9px"><b>研究摘要：</b>${esc(String(e.summary || '').replace('研究摘要：', ''))}</p><div>${(e.topics || []).map(t => `<span class="badge">${esc(t)}</span>`).join('')}</div><div class="actions"><button class="primary" onclick="openEGW('${esc(e.id)}')">核对原始出处</button><button onclick="addBasket('${esc(e.id)}')">＋材料篮</button></div></div>`;
  };

  window.jgSearchEGWLibrary = function() {
    const q = document.getElementById('egwLibraryQ')?.value?.trim() || '';
    const hits = q ? rankedEGW(q, mergedRelation(q)) : egw;
    const host = document.getElementById('egwLibraryResults');
    if (!host) return;
    host.innerHTML = hits.length ? hits.map(egwCard).join('') : `<div class="empty">本地中文索引暂时没有结果。<div class="actions"><button onclick="window.jgOpenOfficialEGW()">到官方中文资料核对</button></div></div>`;
  };

  window.jgPickEGWBook = function(title) {
    const input = document.getElementById('egwLibraryQ');
    if (input) input.value = title;
    window.jgSearchEGWLibrary();
  };

  window.jgOpenOfficialEGW = async function() {
    await loadEGWMeta();
    window.open(egwSource?.homepage || 'https://m.egwwritings.org/zh', '_blank');
  };

  renderLibrary = async function() {
    await loadEGWMeta();
    libraryCount.textContent = `${egw.length} 条已核验索引 · ${egwBooks.length} 本中文书目`;
    libraryList.innerHTML = `<div class="card"><div class="field"><label>查中文预言之灵</label><input id="egwLibraryQ" placeholder="安息日 / 圣所 / 历代愿望 / 但以理书8:14" onkeydown="if(event.key==='Enter')window.jgSearchEGWLibrary()"></div><div class="actions"><button class="primary" onclick="window.jgSearchEGWLibrary()">检索</button><button onclick="window.jgOpenOfficialEGW()">官方中文资料</button></div><div class="chips">${egwBooks.slice(0, 16).map(b => `<button class="chip" onclick="window.jgPickEGWBook('${esc(b.title_cn)}')">${esc(b.title_cn)}</button>`).join('')}</div></div><div id="egwLibraryResults">${egw.map(egwCard).join('')}</div>`;
  };

  window.jgStudyCrossref = q => {
    const input = document.getElementById('studyQ');
    if (input) input.value = q;
    runStudy('studyQ');
  };
  window.jgLoadCrossrefs = q => renderCrossrefs(q);

  function renderRelationGraph(q) {
    const rel = mergedRelation(q);
    if (!rel) return '';
    const themes = rel.themes || [];
    const refs = rel.related_bible || [];
    return `<div class="card" style="margin-top:14px"><div class="meta">圣经关系图 · 聚合 ${rel.matches?.length || 1} 个关系节点</div><h3>主题脉络</h3><div class="chips">${themes.map(t => `<button class="chip" onclick="window.jgStudyCrossref('${esc(t)}')">${esc(t)}</button>`).join('')}</div>${refs.length ? `<div class="source"><b>相关经文</b><br>${refs.map(r => `<button class="chip" style="margin-top:6px" onclick="window.jgStudyCrossref('${esc(r)}')">${esc(r)}</button>`).join(' ')}</div>` : ''}</div>`;
  }

  const originalRunStudy = runStudy;
  runStudy = async function(id) {
    await originalRunStudy(id);
    const q = document.getElementById(id)?.value?.trim() || '';
    const ref = parseBibleRef(q);
    const host = document.getElementById('studyResult');
    if (!host) return;

    const graph = renderRelationGraph(q);
    if (graph) host.insertAdjacentHTML('beforeend', graph);

    if (ref && ref.from && ref.from === ref.to) {
      host.insertAdjacentHTML('beforeend', `<div class="section-head" style="margin-top:18px"><h2>圣经串珠</h2><span>34万+ OpenBible 关系</span></div><div id="crossrefsBox"><div class="card"><p>需要时再展开，不影响页面首屏速度。</p><div class="actions"><button onclick="window.jgLoadCrossrefs('${esc(q)}')">展开相关经文</button></div></div></div>`);
    }

    const rel = mergedRelation(q);
    const hits = rankedEGW(q, rel);
    if (!hits.length) {
      await loadEGWMeta();
      host.insertAdjacentHTML('beforeend', `<div class="card" style="margin-top:14px"><div class="meta">预言之灵中文资料</div><p>本地已核验索引暂时没有命中。经光不会用 AI 猜测原文。</p><div class="actions"><button onclick="window.jgOpenOfficialEGW()">打开官方中文资料核对</button></div></div>`);
    }
  };

  loadEGWMeta();
})();
