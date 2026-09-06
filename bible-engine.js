(() => {
  const state={egwSource:null,egwBooks:[],crossrefConfig:null,crossrefText:null};
  const $=id=>document.getElementById(id);
  const cn=s=>String(s||'').toLowerCase().replace(/[\s《》〈〉“”"'，。！？；：、·_]/g,'').replace(/[–—]/g,'-');

  function parseParts(s){
    const n=String(s||'').replace(/\s+/g,'').replace(/：/g,':');
    const m=n.match(/^(.+?)(\d+)(?::(\d+)(?:[-–](\d+))?)?)?$/);
    return m?{book:cn(m[1]),chapter:m[2]?+m[2]:null,from:m[3]?+m[3]:null,to:m[4]?+m[4]:(m[3]?+m[3]:null)}:null;
  }
  function overlap(a,b){if(!a||!b||a.book!==b.book)return false;if(a.chapter&&b.chapter&&a.chapter!==b.chapter)return false;if(!a.from||!b.from)return true;return Math.max(a.from,b.from)<=Math.min(a.to||a.from,b.to||b.from)}

  function relationMatches(q){
    const n=cn(q),p=parseParts(q);
    return (relations||[]).map(r=>{
      let score=0;
      for(const v of [r.bible_ref,r.normalized].filter(Boolean)){
        const x=cn(v);if(x===n)score=Math.max(score,130);else if(x.includes(n)||n.includes(x))score=Math.max(score,80);if(p&&overlap(p,parseParts(v)))score=Math.max(score,110);
      }
      for(const t of r.themes||[]){const x=cn(t);if(x===n)score=Math.max(score,100);else if(x.includes(n)||n.includes(x))score=Math.max(score,60)}
      return {r,score};
    }).filter(x=>x.score).sort((a,b)=>b.score-a.score);
  }
  function mergedRelation(q){
    const a=relationMatches(q);if(!a.length)return null;const rows=a.map(x=>x.r);
    return {bible_ref:rows[0].bible_ref,themes:[...new Set(rows.flatMap(x=>x.themes||[]))],related_bible:[...new Set(rows.flatMap(x=>x.related_bible||[]))],egw_ids:[...new Set(rows.flatMap(x=>x.egw_ids||[]))],matches:rows};
  }
  relationFor=q=>mergedRelation(q);

  function egwScore(e,q,rel){
    const n=cn(q);let s=0;if(!n)return 0;
    const vals=[e.title_cn,e.chapter,e.locator].map(cn),refs=(e.bible_refs||[]).map(cn),topics=(e.topics||[]).map(cn),sum=cn(e.summary);
    if(vals[0]===n)s+=100;else if(vals[0].includes(n)||n.includes(vals[0]))s+=70;
    if(vals[1].includes(n))s+=50;if(vals[2].includes(n))s+=45;
    if(refs.some(x=>x===n))s+=100;else if(refs.some(x=>x.includes(n)||n.includes(x)))s+=60;
    if(topics.some(x=>x===n))s+=85;else if(topics.some(x=>x.includes(n)||n.includes(x)))s+=45;
    if(sum.includes(n))s+=20;if((rel?.egw_ids||[]).includes(e.id))s+=160;return s;
  }
  function rankedEGW(q,rel){return (egw||[]).map(e=>({e,s:egwScore(e,q,rel||mergedRelation(q))})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.e)}
  relatedEGW=(q,rel)=>rankedEGW(q,rel);

  egwCard=e=>`<div class="result"><div class="meta">预言之灵 · 出处资料</div><h3>《${esc(e.title_cn||'未命名')}》${e.chapter?' · '+esc(e.chapter):''}</h3><div class="source"><b>${esc(e.locator||'出处待复核')}</b>${(e.bible_refs||[]).length?'<br>相关经文：'+e.bible_refs.map(esc).join(' · '):''}</div>${e.summary?`<p style="margin-top:9px"><b>研究提示：</b>${esc(String(e.summary).replace('研究摘要：',''))}</p>`:''}<div>${(e.topics||[]).map(t=>`<span class="badge">${esc(t)}</span>`).join('')}</div><div class="actions"><button class="primary" onclick="openEGW('${esc(e.id)}')">查看出处</button><button onclick="addBasket('${esc(e.id)}')">＋材料篮</button></div></div>`;

  async function loadEGWMeta(){
    if(state.egwSource)return;try{const [a,b]=await Promise.all([fetch('./data/egw-source.json',{cache:'no-store'}),fetch('./data/egw-books.json',{cache:'no-store'})]);if(a.ok)state.egwSource=await a.json();if(b.ok)state.egwBooks=(await b.json()).books||[]}catch(e){console.warn(e)}
  }
  window.jgOpenOfficialEGW=async()=>{await loadEGWMeta();window.open(state.egwSource?.homepage||'https://m.egwwritings.org/zh','_blank')};
  window.jgSearchEGWLibrary=()=>{const q=$('egwLibraryQ')?.value.trim()||'',hits=q?rankedEGW(q,mergedRelation(q)):egw,host=$('egwLibraryResults');if(host)host.innerHTML=hits.length?hits.map(egwCard).join(''):'<div class="empty">本地中文索引暂时没有结果。可到官方中文资料继续核对。</div>'};
  window.jgPickEGWBook=t=>{if($('egwLibraryQ'))$('egwLibraryQ').value=t;window.jgSearchEGWLibrary()};
  renderLibrary=async()=>{await loadEGWMeta();libraryCount.textContent=`${egw.length} 条出处索引 · ${state.egwBooks.length} 本中文书目`;libraryList.innerHTML=`<div class="card"><div class="field"><label>查预言之灵</label><input id="egwLibraryQ" placeholder="输入主题、书名或经文，例如：安息日" onkeydown="if(event.key==='Enter')window.jgSearchEGWLibrary()"></div><div class="actions"><button class="primary" onclick="window.jgSearchEGWLibrary()">搜索</button><button onclick="window.jgOpenOfficialEGW()">官方中文资料</button></div><div class="chips">${state.egwBooks.slice(0,12).map(b=>`<button class="chip" onclick="window.jgPickEGWBook('${esc(b.title_cn)}')">${esc(b.title_cn)}</button>`).join('')}</div></div><div id="egwLibraryResults">${egw.map(egwCard).join('')}</div>`};

  function osisCN(s){
    const m=String(s||'').match(/^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)(?:-([1-3]?[A-Za-z]+)\.(\d+)\.(\d+))?$/);if(!m)return {label:s,query:s};
    const b=bibleBooks.find(x=>x[0].toLowerCase()===m[1].toLowerCase()),n=b?.[2]||b?.[1]||m[1];
    if(!m[4])return {label:`${n}${m[2]}:${m[3]}`,query:`${n}${m[2]}:${m[3]}`};
    const b2=bibleBooks.find(x=>x[0].toLowerCase()===m[4].toLowerCase()),n2=b2?.[2]||b2?.[1]||m[4];
    const label=m[1]===m[4]&&m[2]===m[5]?`${n}${m[2]}:${m[3]}-${m[6]}`:`${n}${m[2]}:${m[3]}-${n2}${m[5]}:${m[6]}`;return {label,query:label};
  }
  async function crossrefText(){if(state.crossrefText)return state.crossrefText;const c=await fetch('./data/crossrefs-source.json',{cache:'no-store'});if(!c.ok)throw Error('串珠配置读取失败');state.crossrefConfig=await c.json();const r=await fetch(state.crossrefConfig.runtime_url);if(!r.ok)throw Error('串珠资料读取失败');return state.crossrefText=await r.text()}
  async function findCrossrefs(ref,limit=18){if(!ref?.from||ref.from!==ref.to)return[];const key=`${ref.osis}.${ref.chapter}.${ref.from}`,txt=await crossrefText(),out=[];for(const line of txt.split('\n')){if(!line||line[0]==='#')continue;const p=line.split('\t');if(p[0]===key)out.push({to:p[1],votes:+(p[2]||0)})}return out.sort((a,b)=>b.votes-a.votes).slice(0,limit)}
  window.jgStudyCrossref=q=>{if($('studyQ'))$('studyQ').value=q;runStudy('studyQ')};
  window.jgLoadCrossrefs=async q=>{const box=$('crossrefsBox');if(!box)return;box.innerHTML='<div class="empty">正在查相关经文…</div>';try{const hits=await findCrossrefs(parseBibleRef(q));box.innerHTML=hits.length?`<div class="card"><div class="meta">相关经文</div><div class="chips">${hits.map(h=>{const x=osisCN(h.to);return `<button class="chip" onclick="window.jgStudyCrossref('${esc(x.query)}')">${esc(x.label)}</button>`}).join('')}</div></div>`:'<div class="empty">暂未找到相关经文。</div>'}catch(e){box.innerHTML='<div class="empty">相关经文暂时读取失败，不影响正文和预言之灵。</div>'}};

  function graph(q){const r=mergedRelation(q);if(!r)return'';return `<div class="card" style="margin-top:14px"><div class="meta">研经脉络</div>${r.themes.length?`<h3>主题</h3><div class="chips">${r.themes.map(t=>`<button class="chip" onclick="window.jgStudyCrossref('${esc(t)}')">${esc(t)}</button>`).join('')}</div>`:''}${r.related_bible.length?`<div class="source"><b>建议继续查</b><div class="chips">${r.related_bible.map(x=>`<button class="chip" onclick="window.jgStudyCrossref('${esc(x)}')">${esc(x)}</button>`).join('')}</div></div>`:''}</div>`}

  function installUX(){
    const style=document.createElement('style');style.textContent=`
      body{background:#08111d}.app{max-width:860px}.top{position:sticky;top:0;z-index:20;padding:10px 2px;background:rgba(8,17,29,.92);backdrop-filter:blur(16px)}
      .hero{padding:22px 18px}.hero h1{font-size:24px;line-height:1.35}.hero p{margin:6px 0 0}.search input{font-size:16px}.search button{min-width:64px}
      .quick-start{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}.quick-start button{border:1px solid var(--line);background:#101d31;color:#fff;border-radius:13px;padding:12px 7px;font-size:12px}.quick-start b{display:block;color:var(--gold);font-size:15px;margin-bottom:3px}
      .result,.card{box-shadow:0 10px 28px rgba(0,0,0,.12)}.verse-text{font-size:19px;line-height:1.95}.bottom button{font-size:12px}.source{line-height:1.75}
      @media(max-width:560px){.app{padding:10px 12px 100px}.logo{font-size:24px}.ver{display:none}.status{font-size:10px}.hero{border-radius:19px}.hero h1{font-size:21px}.search{position:relative}.search input{padding-right:68px}.search button{position:absolute;right:4px;top:4px;bottom:4px}.quick-start{grid-template-columns:repeat(3,1fr)}.bottom{bottom:8px;width:96%;padding:5px}.bottom button{padding:10px 1px}.reader-inner{padding:10px 14px 70px}}
    `;document.head.appendChild(style);
    const homeHero=document.querySelector('#home .hero');if(homeHero&&!homeHero.querySelector('.quick-start'))homeHero.insertAdjacentHTML('beforeend',`<div class="quick-start"><button onclick="quick('约3:16')"><b>查经文</b>正文与上下文</button><button onclick="quick('安息日')"><b>查主题</b>圣经＋怀著</button><button onclick="go('projects')"><b>备讲章</b>整理材料</button></div>`);
    const homeTitle=document.querySelector('#home .hero h1');if(homeTitle)homeTitle.textContent='输入经文或主题，开始研经';
    const homeP=document.querySelector('#home .hero p');if(homeP)homeP.textContent='先读中文圣经，再看相关经文和预言之灵出处。';
    const studyTitle=document.querySelector('#study .hero h1');if(studyTitle)studyTitle.textContent='查经文 · 查预言之灵';
    const studyP=document.querySelector('#study .hero p');if(studyP)studyP.textContent='输入一节经文或一个主题，资料按来源分层显示。';
    document.querySelector('[data-p="study"]')&&(document.querySelector('[data-p="study"]').textContent='研经');
    document.querySelector('[data-p="library"]')&&(document.querySelector('[data-p="library"]').textContent='怀著');
    document.querySelector('[data-p="projects"]')&&(document.querySelector('[data-p="projects"]').textContent='讲章');
    document.querySelector('[data-p="basket"]')&&(document.querySelector('[data-p="basket"]').textContent='材料');
    ['homeQ','studyQ'].forEach(id=>{const el=$(id);if(el)el.setAttribute('autocomplete','off')});
  }

  const baseRun=runStudy;
  runStudy=async function(id){await baseRun(id);const q=$(id)?.value.trim()||'',ref=parseBibleRef(q),host=$('studyResult');if(!host)return;const g=graph(q);if(g)host.insertAdjacentHTML('beforeend',g);if(ref?.from&&ref.from===ref.to)host.insertAdjacentHTML('beforeend',`<div class="section-head" style="margin-top:18px"><h2>相关经文</h2><span>需要时展开</span></div><div id="crossrefsBox"><div class="card"><p>查看与这节经文关系最强的串珠经文。</p><div class="actions"><button class="primary" onclick="window.jgLoadCrossrefs('${esc(q)}')">展开相关经文</button></div></div></div>`);const hits=rankedEGW(q,mergedRelation(q));if(!hits.length)host.insertAdjacentHTML('beforeend',`<div class="card" style="margin-top:14px"><div class="meta">预言之灵</div><p>本地出处索引暂时没有命中。不会用 AI 猜测怀爱伦原文。</p><div class="actions"><button onclick="window.jgOpenOfficialEGW()">到官方中文资料核对</button></div></div>`)};

  installUX();loadEGWMeta();
})();
