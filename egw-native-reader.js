(() => {
  'use strict';
  const detail=document.getElementById('detail'),body=document.getElementById('detailBody'),type=document.getElementById('detailType'),actions=document.getElementById('detailActions');
  if(!detail||!body||!type||!actions)return;
  let index=[];
  fetch('./data/egw-index.json',{cache:'no-store'}).then(r=>r.json()).then(j=>{index=j.records||[]}).catch(()=>{});
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const allowed=url=>/^https?:\/\/(?:m\.|text\.)?egwwritings\.org\/(?:read\/|zh\/book\/)/i.test(String(url||''));
  function showLoading(title='怀爱伦著作'){
    type.textContent='预言之灵阅读';
    body.innerHTML=`<span class="badge egw">怀著</span><h1>${esc(title)}</h1><div class="empty">正在读取原文章节…</div>`;
    actions.innerHTML='';
    if(!detail.open)detail.showModal();
  }
  async function openUrl(url,meta={}){
    if(!allowed(url))return false;
    showLoading(meta.title||'怀爱伦著作');
    try{
      const r=await fetch(`/api/egw-read?url=${encodeURIComponent(url)}`,{cache:'no-store'}),j=await r.json();
      if(!r.ok||!j.ok)throw new Error(j.error||'read_failed');
      type.textContent='预言之灵阅读';
      const nav=`<div class="readerNav">${j.prev?`<button data-egw-native-url="${esc(j.prev.url)}">‹ ${esc(j.prev.title)}</button>`:'<span></span>'}${j.next?`<button data-egw-native-url="${esc(j.next.url)}">${esc(j.next.title)} ›</button>`:'<span></span>'}</div>`;
      body.innerHTML=`${nav}<span class="badge egw">怀著原文</span><h1>${esc(meta.title||j.title||'怀爱伦著作')}</h1>${meta.chapter?`<h2 class="egwChapterTitle">${esc(meta.chapter)}</h2>`:''}<div class="meta">${meta.locator?esc(meta.locator)+' · ':''}正文来自 EGW Writings，当前章节按需读取</div><div class="reading egwReading">${(j.paragraphs||[]).map((p,i)=>`<p class="egwParagraph" data-egw-paragraph="${i}">${esc(p)}</p>`).join('')}</div>`;
      actions.innerHTML=`<button data-egw-native-url="${esc(url)}">↻ 重新载入</button><button data-official-url="${esc(url)}">查看官方原文</button>`;
      try{localStorage.setItem('jg_last_egw_native',JSON.stringify({url,title:meta.title||j.title,chapter:meta.chapter||'',at:Date.now()}))}catch(_){}
      detail.scrollTop=0;
      return true;
    }catch(e){
      body.innerHTML=`<span class="badge egw">怀著</span><h1>${esc(meta.title||'怀爱伦著作')}</h1><div class="empty">这一页暂时无法在站内读取。<div class="actions"><button data-official-url="${esc(url)}">打开官方原文</button></div></div>`;
      return false;
    }
  }
  function sourceById(id){return index.find(x=>String(x.id)===String(id))}
  document.addEventListener('click',e=>{
    const nav=e.target.closest('[data-egw-native-url]');
    if(nav){e.preventDefault();e.stopImmediatePropagation();openUrl(nav.dataset.egwNativeUrl);return}
    const hit=e.target.closest('[data-egw]');
    if(hit){const src=sourceById(hit.dataset.egw);if(src?.source_url){e.preventDefault();e.stopImmediatePropagation();openUrl(src.source_url,{title:`《${src.title_cn||src.title||'怀爱伦著作'}》`,chapter:src.chapter||'',locator:src.locator||''});return}}
    const official=e.target.closest('[data-official-url]');
    if(official&&allowed(official.dataset.officialUrl)&&!/search\.php/i.test(official.dataset.officialUrl)){
      if(official.dataset.officialId)return;
      e.preventDefault();e.stopImmediatePropagation();openUrl(official.dataset.officialUrl,{title:official.closest('.card')?.querySelector('.title')?.textContent||'怀爱伦著作'});
    }
  },true);
  const style=document.createElement('style');style.textContent=`.egwReading{max-width:720px}.egwReading .egwParagraph{margin:0;padding:10px 12px;border-radius:7px;font-family:"Songti SC","STSong","Noto Serif SC",serif;line-height:2.05}.egwReading .egwParagraph+ .egwParagraph{margin-top:2px}.egwChapterTitle{font-size:16px;color:var(--muted);font-weight:600;margin-top:-4px}@media(max-width:560px){.egwReading .egwParagraph{padding:9px 5px;line-height:1.95}}`;document.head.appendChild(style);
  window.jgOpenNativeEgw=openUrl;
})();
