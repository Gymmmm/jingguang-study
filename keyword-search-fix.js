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

  const oldSearch = search;
  const chineseResultText=value=>String(value||'')
    .replace(/<[^>]*>/g,' ')
    .replace(/\s*\(Ellen\s+Gould(?:\s+White|\s+Wh)?\)?/gi,'')
    .replace(/,\s*p\.\s*([0-9.]+)/gi,' · 原版位置 $1')
    .replace(/,?\s*p\.?\s*(?=$|…)/gi,' ')
    .replace(/[?&]?t?ype=basic(?:&amp;|&)limit=\d+["'>]*/gi,' ')
    .replace(/(?:>\s*){2,}/g,' ')
    .replace(/https?:\/\/\S+/gi,' ')
    .replace(/\S*(?:%[0-9A-F]{2}){2,}\S*/gi,' ')
    .replace(/\s+/g,' ').trim();
  const resultExcerpt=(value,q)=>{
    const text=chineseResultText(value)
      .replace(/(?:^|\s)\d{1,3}\s+[\u4e00-\u9fff][^·]{0,32}·\s*原版位置\s*[0-9.]+/g,' ')
      .replace(/\s+/g,' ').trim();
    if(text.length<=280)return text;
    const at=text.indexOf(String(q||'').trim());
    const start=at>90?at-90:0,end=Math.min(text.length,start+280);
    return `${start?'…':''}${text.slice(start,end)}${end<text.length?'…':''}`;
  };
  const parseChapter = text => {
    const s=String(text||'');
    return (s.match(/第\s*[0-9一二三四五六七八九十百零〇两]+\s*章[^。；，]{0,30}/)?.[0] || '').trim();
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
        empty.textContent=`没有找到“${q}”的怀爱伦著作正文结果。`;
        host.appendChild(empty);return;
      }
      rows.forEach((row,i)=>{
        const title=chineseResultText(row.title)||`怀爱伦著作结果 ${i+1}`,snippet=resultExcerpt(row.snippet,q),chapter=parseChapter(`${title} ${snippet}`);
        const card=document.createElement('article');
        card.className='card egwNativeHit';card.dataset.kind='egw';card.dataset.egwNativeUrl=row.url;
        card.innerHTML=`<div class="top"><span class="badge egw">怀著</span><span class="title">${esc(title)}</span><span class="chevron">›</span></div>${chapter?`<div class="egwResultChapter">${esc(chapter)}</div>`:''}<div class="snippet">${highlight(snippet,q)}</div><div class="meta">点开阅读原文</div>`;
        host.appendChild(card);
      });
    }catch(e){
      loading.remove();
      const card=document.createElement('article');card.className='empty';card.dataset.kind='egw';card.dataset.egwOfficialSearch='1';
      card.textContent='怀爱伦著作正文暂时无法读取，请稍后在本站重试。';
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
  style.textContent=`.fullChapterSearch{margin:12px 0 18px;padding:16px;border:1px solid var(--line);border-radius:14px;background:var(--soft)}.fullChapterSearch>div:first-child{display:flex;flex-direction:column;gap:5px;margin-bottom:11px}.fullChapterSearch .badge{align-self:flex-start}.fullChapterSearch b{font-size:17px}.fullChapterSearch small{color:var(--muted)}.fullChapterSearchRow{display:grid;grid-template-columns:1fr auto;gap:8px}.egwNativeHit{cursor:pointer}.egwNativeHit .top{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center}.egwNativeHit .chevron{font-size:24px;color:var(--muted)}.egwResultChapter{margin:5px 0 6px;font-weight:700}.egwHitMark{background:transparent;color:var(--accent);border-bottom:1px solid var(--accent);padding:0;font-weight:750}@media(max-width:560px){.fullChapterSearchRow{grid-template-columns:1fr}.fullChapterSearchRow button{min-height:44px}}`;
  document.head.appendChild(style);
})();
