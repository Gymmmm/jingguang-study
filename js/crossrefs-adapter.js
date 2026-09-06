(function(root){
  const BASE='https://raw.githubusercontent.com/neuu-org/bible-crossrefs-dataset/main/data/02_unified/verses/';
  function normalizeOsis(osis){return String(osis||'').trim().toUpperCase().replace(/\s+/g,'');}
  async function getCrossReferences(osis,chapter,verse){
    const book=normalizeOsis(osis); if(!book||!chapter||!verse) return [];
    const ref=`${book}.${Number(chapter)}.${Number(verse)}`;
    const url=`${BASE}${book[0]}/${ref}.json`;
    const r=await fetch(url,{cache:'force-cache'});
    if(r.status===404) return [];
    if(!r.ok) throw new Error(`cross-reference fetch failed: ${r.status}`);
    const data=await r.json();
    const rows=data.cross_references||data.references||data.refs||[];
    return Array.isArray(rows)?rows:[];
  }
  async function getCrossReferencesForRange(osis,chapter,from,to){
    const start=Number(from||1), end=Number(to||start); const out=[];
    for(let v=start;v<=end;v++){
      const rows=await getCrossReferences(osis,chapter,v);
      out.push({ref:`${normalizeOsis(osis)}.${Number(chapter)}.${v}`,references:rows});
    }
    return out;
  }
  root.JingGuangCrossRefs={getCrossReferences,getCrossReferencesForRange,source:'NEUU/OpenBible/TSK',license:'CC BY 4.0 / CC BY / public domain'};
})(this);
