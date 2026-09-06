(() => {
  const waitForBase=()=>new Promise(resolve=>{
    const tick=()=>{
      try{
        if(typeof egw!=='undefined'&&typeof relations!=='undefined'&&Array.isArray(egw)&&Array.isArray(relations)&&egw.length)return resolve();
      }catch(_e){}
      setTimeout(tick,60);
    };
    tick();
  });
  async function load(){
    await waitForBase();
    try{
      const [a,b]=await Promise.all([
        fetch('./data/egw-index-verified-2026-09.json',{cache:'no-store'}),
        fetch('./data/bible-egw-relations-extension.json',{cache:'no-store'})
      ]);
      if(a.ok){const j=await a.json(),seen=new Set(egw.map(x=>x.id));for(const r of j.records||[])if(!seen.has(r.id)){egw.push(r);seen.add(r.id)}}
      if(b.ok){const j=await b.json(),key=r=>`${r.normalized||''}|${r.bible_ref||''}`,seen=new Set(relations.map(key));for(const r of j.relations||[])if(!seen.has(key(r))){relations.push(r);seen.add(key(r))}}
      const st=document.getElementById('dataStatus');if(st)st.textContent=`圣经66卷 · 怀著 ${egw.length} · 关系 ${relations.length}`;
      if(typeof renderLibrary==='function'&&document.getElementById('library')?.classList.contains('active'))renderLibrary();
    }catch(e){console.warn('EGW extension load failed',e)}
  }
  load();
})();
