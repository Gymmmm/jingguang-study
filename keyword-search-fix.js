(() => {
  'use strict';

  const cleanKeyword = value => {
    let q = String(value || '').trim();
    q = q.replace(/^(请)?(查|搜索|找|看看|帮我查)?\s*/,'');
    q = q.replace(/怀爱伦(的)?|怀著(的)?|怀师母(的)?|预言之灵(的)?/g,' ');
    q = q.replace(/关于|里面|怎么说|如何说|怎样说|怎么看|怎样看|相关内容|相关资料/g,' ');
    return q.replace(/\s+/g,' ').trim();
  };

  const partsFor = value => {
    const cleaned = cleanKeyword(value);
    const parts = cleaned.split(/[\s,，。；;、/]+/).map(norm).filter(Boolean);
    const full = norm(cleaned);
    if (full && !parts.includes(full)) parts.unshift(full);
    return [...new Set(parts)];
  };

  const fieldScore = (field, needles, exactWeight, containsWeight) => {
    const text = norm(field);
    if (!text) return 0;
    let score = 0;
    for (const n of needles) {
      if (!n) continue;
      if (text === n) score += exactWeight;
      else if (text.includes(n)) score += containsWeight;
      else if (n.length >= 4 && n.includes(text)) score += Math.round(containsWeight * 0.55);
    }
    return score;
  };

  egwSearch = function expandedEgwSearch(q, rel = relation(cleanKeyword(q) || q)) {
    const needles = partsFor(q);
    const ref = parse(cleanKeyword(q) || q) || parse(q);
    return S.egw.map(e => {
      let score = rel?.ids?.includes(e.id) ? 220 : 0;
      if (ref && (e.bible_refs || []).some(v => overlap(ref, parseAny(v)))) score = Math.max(score, 160);

      score += fieldScore(e.title_cn, needles, 160, 90);
      score += fieldScore(e.title, needles, 120, 70);
      score += fieldScore(e.chapter, needles, 100, 60);
      score += fieldScore(e.locator, needles, 70, 35);
      for (const t of e.topics || []) score += fieldScore(t, needles, 150, 85);
      for (const b of e.bible_refs || []) score += fieldScore(b, needles, 90, 45);
      score += fieldScore(e.summary, needles, 90, 35);

      return { e, s: score };
    }).filter(x => x.s > 0).sort((a,b) => b.s - a.s).map(x => x.e);
  };

  egwBookSearch = function expandedEgwBookSearch(q) {
    const raw = norm(q);
    const generic = ['怀爱伦','怀著','怀师母','预言之灵','ellenwhite'].some(x => raw === norm(x));
    if (!raw || generic) return [...S.egwBooks];

    const needles = partsFor(q);
    const direct = S.egwBooks.filter(b => needles.some(n => {
      const t = norm(b.title_cn);
      return t === n || t.includes(n) || (n.length >= 4 && n.includes(t));
    }));

    const matchingIndexedTitles = new Set(
      egwSearch(q).map(e => norm(e.title_cn)).filter(Boolean)
    );
    const derived = S.egwBooks.filter(b => {
      const title = norm(b.title_cn);
      return [...matchingIndexedTitles].some(t => title === t || title.includes(t) || t.includes(title));
    });

    const seen = new Set();
    return [...direct, ...derived].filter(b => {
      const id = String(b.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };

  const oldSearch = search;
  search = async function keywordSearch(q) {
    const raw = String(q || '').trim();
    if (!raw) return;
    const cleaned = cleanKeyword(raw);
    await oldSearch(cleaned || raw);

    const host = document.getElementById('studyResults');
    if (!host) return;
    const hasEgw = !!host.querySelector('[data-kind="egw"]');
    if (!hasEgw && !parse(cleaned || raw)) {
      const card = document.createElement('article');
      card.className = 'card';
      card.dataset.kind = 'egw';
      card.innerHTML = `<div class="top"><span class="badge egw">怀爱伦著作</span><span class="title">继续搜索“${esc(cleaned || raw)}”</span></div><div class="snippet">本地已核验索引暂时没有命中。可继续到怀爱伦官方中文全文检索，不在这里编造结果。</div><div class="actions"><button class="primary" data-official-url="https://m.egwwritings.org/advsearch">打开官方中文全文搜索</button></div>`;
      host.appendChild(card);
      filter();
    }
  };
})();
