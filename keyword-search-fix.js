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

  const officialSearchUrl = q => `https://text.egwwritings.org/search.php?lang=zh&query=${encodeURIComponent(q)}`;
  const oldSearch = search;

  function fullChapterCard(q, hasLocal) {
    const card = document.createElement('article');
    card.className = 'card egwFullChapterSearch';
    card.dataset.kind = 'egw';
    card.dataset.egwOfficialSearch = '1';
    card.innerHTML = `<div class="top"><span class="badge egw">全部章节</span><span class="title">在怀爱伦全部中文著作中搜索“${esc(q)}”</span></div><div class="snippet">覆盖官方中文书库的全部章节。先显示官方全文搜索结果，选择其中一条后直接阅读对应原文和上下文。${hasLocal?' 下方同时保留经光已经核验的出处。':''}</div><div class="actions"><button class="primary" data-official-url="${esc(officialSearchUrl(q))}">搜索全部章节</button></div>`;
    return card;
  }

  search = async function keywordSearch(q) {
    const raw = String(q || '').trim();
    if (!raw) return;
    const cleaned = cleanKeyword(raw) || raw;
    await oldSearch(cleaned);

    const host = document.getElementById('studyResults');
    if (!host) return;
    host.querySelector('[data-egw-official-search]')?.remove();
    const hasLocal = !!host.querySelector('[data-egw]');
    const card = fullChapterCard(cleaned, hasLocal);
    const firstEgw = [...host.children].find(x => x.dataset?.kind === 'egw');
    if (firstEgw) host.insertBefore(card, firstEgw);
    else host.appendChild(card);
    filter();
  };

  function installFullChapterSearch(){
    const shelf=document.getElementById('egwShelf');
    if(!shelf||document.getElementById('egwAllChapterSearch'))return;
    const box=document.createElement('form');
    box.id='egwAllChapterSearch';
    box.className='fullChapterSearch';
    box.innerHTML=`<div><b>搜索全部章节</b><small>不是只搜书名；直接搜索怀爱伦官方中文全文。</small></div><div class="fullChapterSearchRow"><input name="q" placeholder="例如：安息日、信心、祷告、圣所"><button class="primary">搜索全文</button></div>`;
    const title=shelf.querySelector('h2');
    if(title)title.insertAdjacentElement('afterend',box);else shelf.prepend(box);
    box.addEventListener('submit',e=>{
      e.preventDefault();
      const q=cleanKeyword(new FormData(box).get('q'));
      if(!q)return;
      const fake=document.createElement('button');
      fake.dataset.officialUrl=officialSearchUrl(q);
      fake.style.display='none';
      document.body.appendChild(fake);
      fake.click();
      fake.remove();
    });
  }

  const observer=new MutationObserver(()=>installFullChapterSearch());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',installFullChapterSearch);
  setTimeout(installFullChapterSearch,0);

  const style=document.createElement('style');
  style.textContent=`.fullChapterSearch{margin:12px 0 18px;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--card)}.fullChapterSearch>div:first-child{display:flex;flex-direction:column;gap:3px;margin-bottom:10px}.fullChapterSearch small{color:var(--muted)}.fullChapterSearchRow{display:grid;grid-template-columns:1fr auto;gap:8px}.fullChapterSearchRow input{min-width:0}.egwFullChapterSearch{border-color:rgba(176,126,45,.35)}@media(max-width:560px){.fullChapterSearchRow{grid-template-columns:1fr}.fullChapterSearchRow button{min-height:44px}}`;
  document.head.appendChild(style);
})();
