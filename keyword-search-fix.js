(() => {
  'use strict';

  const cleanKeyword = value => {
    let q = String(value || '').trim();
    q = q.replace(/^(请)?(查|搜索|找|看看|帮我查)?\s*/,'');
    q = q.replace(/怀爱伦(的)?|怀著(的)?|怀师母(的)?|预言之灵(的)?/g,' ');
    q = q.replace(/关于|里面|怎么说|如何说|怎样说|怎么看|怎样看|相关内容|相关资料/g,' ');
    return q.replace(/\s+/g,' ').trim();
  };

  const synonymMap = {
    '复临':['基督复临','第二次降临','再来','主再来'],
    '再来':['基督复临','第二次降临','复临'],
    '圣所':['天上圣所','查案审判','审判','1844','二千三百日'],
    '审判':['查案审判','圣所','1844','二千三百日'],
    '安息日':['第七日','守安息日','创造记念'],
    '祷告':['祈祷','祈求','代祷'],
    '信心':['信仰','因信称义','信靠'],
    '救赎':['救恩','救赎史','基督救赎'],
    '三天使':['三天使信息','启示录14章'],
    '健康':['健康改革','节制','医疗布道']
  };

  const partsFor = value => {
    const cleaned = cleanKeyword(value);
    const rawParts = cleaned.split(/[\s,，。；;、/]+/).map(norm).filter(Boolean);
    const full = norm(cleaned);
    if (full && !rawParts.includes(full)) rawParts.unshift(full);
    const expanded = [...rawParts];
    for (const part of rawParts) {
      for (const [key, list] of Object.entries(synonymMap)) {
        if (part === norm(key) || part.includes(norm(key)) || norm(key).includes(part)) {
          expanded.push(norm(key), ...list.map(norm));
        }
      }
    }
    return [...new Set(expanded.filter(Boolean))];
  };

  const fieldScore = (field, needles, exactWeight, containsWeight) => {
    const text = norm(field);
    if (!text) return 0;
    let score = 0;
    for (const n of needles) {
      if (!n) continue;
      if (text === n) score += exactWeight;
      else if (text.includes(n)) score += containsWeight;
      else if (n.length >= 2 && n.includes(text)) score += Math.round(containsWeight * 0.55);
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
      score += fieldScore(e.chapter, needles, 110, 65);
      score += fieldScore(e.locator, needles, 70, 35);
      for (const t of e.topics || []) score += fieldScore(t, needles, 160, 95);
      for (const b of e.bible_refs || []) score += fieldScore(b, needles, 95, 50);
      score += fieldScore(e.summary, needles, 100, 45);
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
      return t === n || t.includes(n) || (n.length >= 2 && n.includes(t));
    }));
    const matchingIndexedTitles = new Set(egwSearch(q).map(e => norm(e.title_cn)).filter(Boolean));
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

  const officialSearchUrl = q => `https://text.egwwritings.org/search.php?QUERY=${encodeURIComponent(q)}&lang=zh`;
  const oldSearch = search;
  const parseChapter = text => {
    const s=String(text||'');
    return (s.match(/第\s*[0-9一二三四五六七八九十百零〇两]+\s*章[^。；，]{0,30}/)?.[0] || s.match(/\bchapter\s+\d+[^.]{0,30}/i)?.[0] || '').trim();
  };
  const highlight = (text,q) => {
    const safe=esc(text||'');
    const needle=String(q||'').trim();
    if(!needle)return safe;
    const re=new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');
    return safe.replace(re,m=>`<mark class="egwHitMark">${m}</mark>`);
  };
  async function appendOfficialResults(host,q){
    const loading=document.createElement('div');
    loading.className='empty egwOfficialLoading';
    loading.dataset.kind='egw';
    loading.textContent=`正在搜索怀著全文：“${q}”…`;
    host.appendChild(loading);
    try{
      const r=await fetch(`/api/egw-search?q=${encodeURIComponent(q)}`,{cache:'no-store'});
      const j=await r.json();
      loading.remove();
      if(!r.ok||!j.ok)throw new Error(j.error||'search_failed');
      const rows=Array.isArray(j.results)?j.results:[];
      const localUrls=new Set([...host.querySelectorAll('[data-official-url],[data-egw-native-url]')].map(x=>x.dataset.officialUrl||x.dataset.egwNativeUrl).filter(Boolean));
      const unique=rows.filter(x=>x?.url&&!localUrls.has(x.url));
      const heading=document.createElement('h2');
      heading.className='groupTitle egwNativeResultsTitle';
      heading.dataset.kind='egw';
      heading.textContent=`怀著 · ${rows.length} 条结果`;
      host.appendChild(heading);
      if(!rows.length){
        const empty=document.createElement('div');empty.className='empty';empty.dataset.kind='egw';
        empty.innerHTML=`没有找到“${esc(q)}”的怀著全文结果。 <button data-official-url="${esc(j.official_url||officialSearchUrl(q))}">打开官方搜索</button>`;
        host.appendChild(empty);return;
      }
      rows.forEach((row,i)=>{
        const chapter=parseChapter(`${row.title||''} ${row.snippet||''}`);
        const card=document.createElement('article');
        card.className='card egwNativeHit';card.dataset.kind='egw';card.dataset.egwNativeUrl=row.url;
        card.innerHTML=`<div class="top"><span class="badge egw">怀著</span><span class="title">${esc(row.title||`怀著结果 ${i+1}`)}</span><span class="chevron">›</span></div>${chapter?`<div class="egwResultChapter">${esc(chapter)}</div>`:''}<div class="snippet">${highlight(row.snippet||'',q)}</div><div class="meta">点开阅读原文</div>`;
        host.appendChild(card);
      });
    }catch(e){
      loading.remove();
      const card=document.createElement('article');card.className='card';card.dataset.kind='egw';card.dataset.egwOfficialSearch='1';
      card.innerHTML=`<div class="top"><span class="badge egw">怀著全文</span><span class="title">搜索“${esc(q)}”</span></div><div class="snippet">全文搜索暂时未返回结果，可打开官方搜索。</div><div class="actions"><button class="primary" data-official-url="${esc(officialSearchUrl(q))}">打开官方搜索</button></div>`;
      host.appendChild(card);
    }
  }

  search = async function keywordSearch(q) {
    const raw = String(q || '').trim();
    if (!raw) return;
    const cleaned = cleanKeyword(raw) || raw;
    await oldSearch(cleaned);
    const host = document.getElementById('studyResults');
    if (!host) return;
    host.querySelector('[data-egw-official-search]')?.remove();
    host.querySelectorAll('.egwNativeResultsTitle,.egwNativeHit,.egwOfficialLoading').forEach(x=>x.remove());
    await appendOfficialResults(host,cleaned);
    filter();
  };

  const style=document.createElement('style');
  style.textContent=`.fullChapterSearch{margin:12px 0 18px;padding:16px;border:2px solid #2e5578;border-radius:14px;background:#eef4f8}.fullChapterSearch>div:first-child{display:flex;flex-direction:column;gap:5px;margin-bottom:11px}.fullChapterSearch .badge{align-self:flex-start}.fullChapterSearch b{font-size:17px}.fullChapterSearch small{color:var(--muted)}.fullChapterSearchRow{display:grid;grid-template-columns:1fr auto;gap:8px}.egwNativeHit{cursor:pointer}.egwNativeHit .top{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center}.egwNativeHit .chevron{font-size:24px;color:var(--muted)}.egwResultChapter{margin:5px 0 6px;font-weight:700}.egwHitMark{background:rgba(72,123,145,.16);color:inherit;border-radius:4px;padding:0 2px}@media(max-width:560px){.fullChapterSearchRow{grid-template-columns:1fr}.fullChapterSearchRow button{min-height:44px}}`;
  document.head.appendChild(style);
})();