(function(root){
  const BASE='https://media.githubusercontent.com/media/neuu-org/bible-crossrefs-dataset/main/data/02_unified/verses/';
  function normalizeOsis(osis){return String(osis||'').trim().toUpperCase().replace(/\s+/g,'');}
  function isLfsPointer(text){return typeof text==='string'&&text.startsWith('version https://git-lfs.github.com/spec/v1');}
  async function getCrossReferences(osis,chapter,verse){
    const book=normalizeOsis(osis); if(!book||!chapter||!verse) return [];
    const ref=`${book}.${Number(chapter)}.${Number(verse)}`;
    const url=`${BASE}${book[0]}/${ref}.json`;
    const r=await fetch(url,{cache:'force-cache'});
    if(r.status===404) return [];
    if(!r.ok) throw new Error(`cross-reference fetch failed: ${r.status}`);
    const text=await r.text();
    if(isLfsPointer(text)) throw new Error('cross-reference source returned Git LFS pointer');
    const data=JSON.parse(text);
    const rows=data.cross_references||data.references||data.refs||[];
    return Array.isArray(rows)?rows:[];
  }
  async function getCrossReferencesForRange(osis,chapter,from,to){
    const start=Number(from||1),end=Number(to||start),out=[];
    for(let v=start;v<=end;v++){
      try{out.push({ref:`${normalizeOsis(osis)}.${Number(chapter)}.${v}`,references:await getCrossReferences(osis,chapter,v)});}
      catch(error){out.push({ref:`${normalizeOsis(osis)}.${Number(chapter)}.${v}`,references:[],error:String(error.message||error)});}
    }
    return out;
  }
  root.JingGuangCrossRefs={getCrossReferences,getCrossReferencesForRange,source:'NEUU/OpenBible/TSK',license:'CC BY 4.0 / CC BY / public domain'};
})(this);
