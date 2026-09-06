(() => {
  'use strict';
  const files=[['egw','./data/egw-index.json','records',[]],['egwBooks','./data/egw-official-books.json','books',[]],['rels','./data/bible-egw-relations.json','relations',[]],['source','./data/bible-source.json',null,null],['books','./data/bible-books.json','books',[]]];
  const rawBase='https://raw.githubusercontent.com/Gymmmm/jingguang-study/main/data/';
  async function getJson(url){const name=url.split('/').pop();let last=null;for(const u of [url,rawBase+name]){try{const r=await fetch(u,{cache:'no-store'});if(!r.ok){last=new Error(`${name}: HTTP ${r.status}`);continue}const t=await r.text();try{return JSON.parse(t)}catch{last=new Error(`${name}: JSON 格式错误`)}}catch(e){last=e}}throw last||new Error(`${name}: 读取失败`)}
  async function recover(){const status=document.getElementById('status');if(!status||!/失败|加载中/.test(status.textContent||''))return;const errors=[];for(const [key,url,field,fallback] of files){try{const data=await getJson(url);S[key]=field?(data?.[field]??fallback):data}catch(e){errors.push(e?.message||String(e));if(key==='source')S.source=S.source||null;else if(!Array.isArray(S[key]))S[key]=fallback}}
    if(!Array.isArray(S.books)||!S.books.length){status.textContent='圣经基础资料读取失败';console.error('[startup-recovery]',errors);return}
    status.textContent=`圣经 ${S.books.length} 卷 · 怀爱伦著作 ${Array.isArray(S.egwBooks)?S.egwBooks.length:0} 本`;
    for(const fn of [migrate,home,library,renderProjects,renderBasket]){try{typeof fn==='function'&&fn()}catch(e){console.warn('[startup-recovery ui]',e)}}
    if(errors.length)console.warn('[startup-recovery partial]',errors)
  }
  window.addEventListener('load',()=>setTimeout(recover,700));setTimeout(recover,1800);
})();
