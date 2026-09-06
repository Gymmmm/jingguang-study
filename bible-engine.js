(() => {
  let sourceConfig = null;
  let bookMap = [];
  const memoryCache = new Map();

  function n(v){return String(v||'').trim().replace(/[：]/g,':').replace(/\s+/g,'').toLowerCase()}
  function safeJsonParse(v){try{return JSON.parse(v)}catch{return null}}
  function cacheKey(id){return `jg_bible_cuvs_${id}`}
  function bookName(rec){return rec?.[1]||rec?.name||''}
  function bookShort(rec){return rec?.[2]||rec?.short||''}
  function bookId(rec){return rec?.[0]||rec?.id||''}

  function findBook(raw){
    const q=n(raw);
    return bookMap.find(b=>[bookId(b),bookName(b),bookShort(b)].map(n).includes(q))||null;
  }

  function parseRef(raw){
    const q=String(raw||'').trim().replace(/[：]/g,':');
    const m=q.match(/^(.+?)(\d+)\s*:\s*(\d+)(?:\s*[-–—]\s*(\d+))?$/);
    if(!m)return null;
    const book=findBook(m[1]);
    if(!book)return null;
    return {book,chapter:Number(m[2]),from:Number(m[3]),to:Number(m[4]||m[3])};
  }

  async function loadConfig(){
    const [s,b]=await Promise.all([
      fetch('./data/bible-source.json',{cache:'no-store'}),
      fetch('./data/bible-books.json',{cache:'no-store'})
    ]);
    if(!s.ok||!b.ok)throw new Error('Bible source metadata load failed');
    sourceConfig=await s.json();
    const bj=await b.json();
    bookMap=Array.isArray(bj.books)?bj.books:[];
  }

  async function loadBook(id){
    if(memoryCache.has(id))return memoryCache.get(id);
    const cached=safeJsonParse(localStorage.getItem(cacheKey(id))||'');
    if(cached?.book===id){memoryCache.set(id,cached);return cached}
    const t=sourceConfig?.translations?.[sourceConfig.default_translation||'cuvs'];
    if(!t?.base_url)throw new Error('Bible base URL missing');
    const res=await fetch(`${t.base_url}${id}.json`);
    if(!res.ok)throw new Error(`Bible book ${id} fetch failed`);
    const data=await res.json();
    memoryCache.set(id,data);
    try{localStorage.setItem(cacheKey(id),JSON.stringify(data))}catch{}
    return data;
  }

  function refLabel(ref){return `${bookName(ref.book)} ${ref.chapter}:${ref.from}${ref.to!==ref.from?`-${ref.to}`:''}`}

  async function passage(ref){
    const data=await loadBook(bookId(ref.book));
    const ch=(data.chapters||[]).find(x=>Number(x.chapter)===ref.chapter);
    if(!ch)return [];
    return (ch.verses||[]).filter(v=>Number(v.number)>=ref.from&&Number(v.number)<=ref.to);
  }

  function scriptureCard(ref,verses){
    const body=verses.map(v=>`<p style="margin:8px 0"><b style="color:var(--gold);font-size:11px;vertical-align:super">${Number(v.number)}</b> ${esc(v.text)}</p>`).join('');
    return `<div class="card"><div class="meta">第一层 · 圣经原文 · 和合本（简体）</div><h3>${esc(refLabel(ref))}</h3><div class="reading" style="font-size:17px;line-height:1.9;margin-top:8px">${body}</div><div class="source">公版和合本 · 按卷加载 · 已读卷保存在本机缓存</div></div>`;
  }

  async function exactStudy(id,q,ref){
    const verses=await passage(ref);
    if(!verses.length)return false;
    go('study');document.getElementById('studyQ').value=q;
    const rel=typeof relationFor==='function'?(relationFor(q)||relationFor(refLabel(ref))):null;
    const hits=typeof relatedEGW==='function'?relatedEGW(q,rel):[];
    let h=scriptureCard(ref,verses);
    if(rel)h+=`<div class="card" style="margin-top:10px"><div class="meta">圣经关系索引</div><div class="source"><b>相关经文</b><br>${(rel.related_bible||[]).map(esc).join(' · ')||'暂无'}</div><div class="chips">${(rel.themes||[]).map(t=>`<span class="badge">${esc(t)}</span>`).join('')}</div></div>`;
    h+=`<div class="section-head" style="margin-top:18px"><h2>预言之灵相关原始资料</h2><span>${hits.length} 条结构化出处</span></div>`;
    if(!hits.length)h+='<div class="empty">当前预言之灵索引尚无精确关联；圣经原文仍可完整阅读。</div>';
    hits.forEach(e=>h+=egwCard(e));
    document.getElementById('studyResult').innerHTML=h;
    return true;
  }

  async function keywordStudy(q){
    const needle=String(q||'').trim();
    if(needle.length<2)return false;
    const loaded=[...memoryCache.values()];
    if(!loaded.length)return false;
    const results=[];
    for(const data of loaded){
      const mapRec=bookMap.find(b=>bookId(b)===data.book);
      for(const ch of data.chapters||[])for(const v of ch.verses||[])if(String(v.text||'').includes(needle)){
        results.push({book:mapRec,chapter:Number(ch.chapter),verse:Number(v.number),text:v.text});
        if(results.length>=40)break;
      }
      if(results.length>=40)break;
    }
    if(!results.length)return false;
    go('study');document.getElementById('studyQ').value=q;
    let h=`<div class="section-head"><h2>圣经全文搜索</h2><span>已缓存书卷中 ${results.length} 条</span></div>`;
    for(const r of results){const label=`${bookName(r.book)} ${r.chapter}:${r.verse}`;h+=`<div class="result"><div class="meta">圣经 · 和合本</div><h3>${esc(label)}</h3><p>${esc(r.text)}</p><div class="actions"><button onclick="document.getElementById('studyQ').value='${esc(label)}';runStudy('studyQ')">研究这节</button></div></div>`}
    document.getElementById('studyResult').innerHTML=h;
    return true;
  }

  const previous=window.runStudy;
  window.runStudy=async function(id){
    const el=document.getElementById(id);const q=el?.value.trim();if(!q)return;
    try{
      if(!sourceConfig)await loadConfig();
      const ref=parseRef(q);
      if(ref&&await exactStudy(id,q,ref))return;
      if(await keywordStudy(q))return;
    }catch(err){console.error('Jingguang Bible engine',err)}
    if(typeof previous==='function')return previous(id);
  };

  loadConfig().then(()=>{
    const st=document.getElementById('dataStatus');
    if(st)st.textContent += ` · 圣经66卷就绪`;
  }).catch(err=>console.error('Jingguang Bible config',err));
})();
