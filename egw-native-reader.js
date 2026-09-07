(() => {
  'use strict';
  const detail=document.getElementById('detail'),body=document.getElementById('detailBody'),type=document.getElementById('detailType'),actions=document.getElementById('detailActions');
  if(!detail||!body||!type||!actions)return;
  let index=[],current=null,scrollTimer=0;
  const READING_KEY='jg_v10_reading',FAVORITES_KEY='jg_v10_favorites',POSITION_KEY='jg_v10_egw_position';
  fetch('./data/egw-index.json',{cache:'no-store'}).then(r=>r.json()).then(j=>{index=j.records||[]}).catch(()=>{});
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const allowed=url=>/^https?:\/\/(?:m\.|text\.)?egwwritings\.org\/(?:read\/|zh\/book\/)/i.test(String(url||''));
  const read=(key,fallback=[])=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch(_){return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(_){}};
  const itemId=item=>`egw-native:${String(item?.native_url||'').replace(/[?#].*$/,'')}`;
  const formatParagraph=text=>String(text??'').split(/(\([A-Za-z]{1,12}\.?\s*\d+(?:\.\d+)*\)|\{[A-Za-z]{1,12}\s+\d+(?:\.\d+)+\}|〖\d+〗|\b[A-Za-z]{1,12}[A-Z]?\s+\d+(?:\.\d+)+)/g).map(part=>/^(?:\(|\{|〖|[A-Za-z])/.test(part)?`<small class="egwSourceRef">${esc(part)}</small>`:esc(part)).join('');
  const renderLocator=locator=>locator?`<div class="egwLocator" aria-label="原文定位">${esc(locator)}</div>`:'';
  function renderBlocks(j){
    const blocks=Array.isArray(j.blocks)?j.blocks:[];
    if(blocks.length)return blocks.map((block,i)=>{
      if(block?.type==='heading')return `<h3 class="egwSectionHeading">${esc(block.text||'')}</h3>`;
      if(block?.type==='paragraph')return `<div class="egwParagraphWrap" data-egw-wrap="${i}"><p class="egwParagraph" data-egw-paragraph="${i}">${esc(block.text||'')}</p>${renderLocator(block.locator||'')}</div>`;
      return '';
    }).join('');
    return (j.paragraphs||[]).map((p,i)=>`<div class="egwParagraphWrap"><p class="egwParagraph" data-egw-paragraph="${i}">${formatParagraph(p)}</p></div>`).join('');
  }
  function remember(item){const id=itemId(item),items=read(READING_KEY).filter(x=>itemId(x)!==id);items.unshift({...item,at:Date.now()});write(READING_KEY,items.slice(0,12))}
  function isFavorite(item){const id=itemId(item);return read(FAVORITES_KEY).some(x=>itemId(x)===id)}
  function renderActions(){if(current)actions.innerHTML=`<button data-egw-native-favorite>${isFavorite(current)?'★ 已收藏':'☆ 收藏本章'}</button><button data-official-source="${esc(current.native_url)}">核验官方原始出处</button>`}
  function toggleFavorite(){if(!current)return;const id=itemId(current),items=read(FAVORITES_KEY);write(FAVORITES_KEY,items.some(x=>itemId(x)===id)?items.filter(x=>itemId(x)!==id):[{...current,at:Date.now()},...items]);renderActions()}
  function positionSnapshot(){
    const paras=[...body.querySelectorAll('.egwParagraph')];
    if(!paras.length)return null;
    const y=(detail.scrollTop||0)+Math.min(140,Math.max(72,detail.clientHeight*.18));
    let i=paras.findIndex(p=>p.offsetTop+p.offsetHeight>y);
    if(i<0)i=paras.length-1;
    const p=paras[i],height=Math.max(1,p.offsetHeight),offset=Math.max(0,Math.min(1,(y-p.offsetTop)/height));
    return {paragraph:i,offset:+offset.toFixed(3)};
  }
  function savePosition(){
    if(!current||!detail.open)return;
    const snap=positionSnapshot();if(!snap)return;
    const positions=read(POSITION_KEY,{});positions[itemId(current)]=snap;write(POSITION_KEY,positions);
  }
  function restorePosition(){
    const saved=read(POSITION_KEY,{})[itemId(current)];
    requestAnimationFrame(()=>{
      if(saved&&typeof saved==='object'&&Number.isFinite(+saved.paragraph)){
        const paras=[...body.querySelectorAll('.egwParagraph')],i=Math.max(0,Math.min(paras.length-1,+saved.paragraph||0)),p=paras[i];
        if(p){const offset=Math.max(0,Math.min(1,+saved.offset||0));detail.scrollTop=Math.max(0,p.offsetTop+p.offsetHeight*offset-Math.min(140,Math.max(72,detail.clientHeight*.18)));return}
      }
      detail.scrollTop=Number.isFinite(+saved)?Math.max(0,+saved):0;
    });
  }
  function showLoading(title='怀爱伦著作'){
    detail.dataset.readerKind='egw-reader';
    detail.dataset.readingKey='';
    type.textContent='预言之灵阅读';
    body.innerHTML=`<span class="badge egw">怀著</span><h1>${esc(title)}</h1><div class="empty">正在读取原文章节…</div>`;
    actions.innerHTML='';
    if(!detail.open)detail.showModal();
  }
  function returnToToc(){
    if(!current?.bookId||!current?.tocUrl||typeof window.jgOpenEgwBook!=='function')return false;
    savePosition();
    const title=String(current.title||'').replace(/^[《]|[》]$/g,'');
    window.jgOpenEgwBook(current.bookId,current.tocUrl,title);
    return true;
  }
  async function openUrl(url,meta={}){
    if(!allowed(url))return false;
    const previous=current;
    savePosition();
    showLoading(meta.title||previous?.title||'怀爱伦著作');
    try{
      const r=await fetch(`/api/egw-read?url=${encodeURIComponent(url)}`,{cache:'no-store'}),j=await r.json();
      if(!r.ok||!j.ok)throw new Error(j.error||'read_failed');
      const chapterTitle=meta.chapter||j.title||'预言之灵阅读';
      type.textContent=chapterTitle;
      const bookTitle=meta.title||previous?.title||j.title||'怀爱伦著作';
      const bookId=meta.bookId||previous?.bookId||'';
      const tocUrl=meta.tocUrl||previous?.tocUrl||'';
      const navMeta=`data-egw-title="${esc(bookTitle)}" data-egw-book-id="${esc(bookId)}" data-egw-toc-url="${esc(tocUrl)}"`;
      const nav=`<div class="readerNav egwReaderNav">${j.prev?`<button data-egw-native-url="${esc(j.prev.url)}" ${navMeta} data-egw-chapter="${esc(j.prev.title||'')}">‹ ${esc(j.prev.title)}</button>`:'<span></span>'}${j.next?`<button data-egw-native-url="${esc(j.next.url)}" ${navMeta} data-egw-chapter="${esc(j.next.title||'')}">${esc(j.next.title)} ›</button>`:'<span></span>'}</div>`;
      body.innerHTML=`${nav}<span class="badge egw">怀著原文</span><h1>${esc(bookTitle)}</h1>${chapterTitle?`<h2 class="egwChapterTitle">${esc(chapterTitle)}</h2>`:''}<div class="meta">${meta.locator?esc(meta.locator)+' · ':''}怀爱伦著作中文原文</div><div class="reading egwReading">${renderBlocks(j)}</div>`;
      current={type:'egw',native_url:url,title:bookTitle,chapter:chapterTitle,locator:meta.locator||previous?.locator||'',bookId,tocUrl};
      remember(current);renderActions();restorePosition();
      try{localStorage.setItem('jg_last_egw_native',JSON.stringify({url,title:bookTitle,chapter:chapterTitle,bookId,tocUrl,at:Date.now()}))}catch(_){}
      return true;
    }catch(e){
      console.warn('EGW native reader failed',e);
      current=previous;
      body.innerHTML=`<span class="badge egw">怀著</span><h1>${esc(meta.title||previous?.title||'怀爱伦著作')}</h1><div class="empty">这一页暂时无法在站内读取。<div class="actions"><button data-official-url="${esc(url)}">打开官方原文</button></div></div>`;
      return false;
    }
  }
  function sourceById(id){return index.find(x=>String(x.id)===String(id))}
  document.addEventListener('click',e=>{
    const back=e.target.closest('#back');
    if(back&&detail.dataset.readerKind==='egw-reader'&&returnToToc()){e.preventDefault();e.stopImmediatePropagation();return}
    const nav=e.target.closest('[data-egw-native-url]');
    if(nav){e.preventDefault();e.stopImmediatePropagation();openUrl(nav.dataset.egwNativeUrl,{title:nav.dataset.egwTitle||nav.dataset.egwBookTitle&&`《${nav.dataset.egwBookTitle}》`||current?.title||'',chapter:nav.dataset.egwChapter||nav.dataset.egwChapterTitle||'',bookId:nav.dataset.egwBookId||current?.bookId||'',tocUrl:nav.dataset.egwTocUrl||current?.tocUrl||''});return}
    if(e.target.closest('[data-egw-native-favorite]')){e.preventDefault();e.stopImmediatePropagation();toggleFavorite();return}
    const source=e.target.closest('[data-official-source]');
    if(source){e.preventDefault();e.stopImmediatePropagation();window.open(source.dataset.officialSource,'_blank','noopener');return}
    const hit=e.target.closest('[data-egw]');
    if(hit){const src=sourceById(hit.dataset.egw);if(src?.source_url){e.preventDefault();e.stopImmediatePropagation();openUrl(src.source_url,{title:`《${src.title_cn||src.title||'怀爱伦著作'}》`,chapter:src.chapter||'',locator:src.locator||''});return}}
    const official=e.target.closest('[data-official-url]');
    if(official&&allowed(official.dataset.officialUrl)&&!/search\.php/i.test(official.dataset.officialUrl)){
      if(official.dataset.officialId)return;
      e.preventDefault();e.stopImmediatePropagation();openUrl(official.dataset.officialUrl,{title:official.closest('.card')?.querySelector('.title')?.textContent||'怀爱伦著作'});
    }
  },true);
  detail.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(savePosition,220)},{passive:true});
  detail.addEventListener('cancel',savePosition);
  detail.addEventListener('close',()=>{savePosition();if(detail.dataset.readerKind==='egw-reader')delete detail.dataset.readerKind});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')savePosition()});
  window.addEventListener('pagehide',savePosition);
  const style=document.createElement('style');style.textContent=`.egwReading{max-width:720px}.egwParagraphWrap{margin:0 0 13px}.egwReading .egwParagraph{margin:0;padding:0 5px;font-family:"Songti SC","STSong","Noto Serif SC",serif;font-size:var(--reader-font,19px);line-height:2.05}.egwLocator{margin:3px 5px 0;color:var(--muted);font-size:calc(var(--reader-font,19px)*.72);line-height:1.5;letter-spacing:.01em}.egwSectionHeading{margin:28px 5px 11px;font-family:"Songti SC","STSong","Noto Serif SC",serif;font-size:1.04em;line-height:1.5;color:var(--text);font-weight:700}.egwSourceRef{display:inline;color:var(--muted);font-size:.76em;line-height:1.5}.egwChapterTitle{font-size:16px;color:var(--muted);font-weight:600;margin-top:-4px}.egwReaderNav button{white-space:normal;line-height:1.4}.egwReaderNav span{min-width:0}#detail[data-reader-kind="egw-reader"]>header{grid-template-columns:auto minmax(0,1fr) auto}#detail[data-reader-kind="egw-reader"]>header>#back{white-space:nowrap}#detail[data-reader-kind="egw-reader"]>header>#detailType{min-width:0;max-width:100%;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal;line-height:1.25}#detail[data-reader-kind="egw-reader"]>header>.fontTools{flex-wrap:nowrap;white-space:nowrap}@media(max-width:560px){.egwReading .egwParagraph{padding:0;line-height:1.95}.egwLocator,.egwSectionHeading{margin-left:0;margin-right:0}.egwReaderNav{gap:10px}.egwReaderNav button{font-size:12px;padding:8px 7px}#detail[data-reader-kind="egw-reader"]>header{gap:5px;padding-left:max(8px,env(safe-area-inset-left));padding-right:max(8px,env(safe-area-inset-right))}#detail[data-reader-kind="egw-reader"]>header>#back{min-width:58px;padding-left:0;padding-right:4px}#detail[data-reader-kind="egw-reader"]>header>#detailType{font-size:12px}#detail[data-reader-kind="egw-reader"]>header>.fontTools{gap:0}#detail[data-reader-kind="egw-reader"]>header>.fontTools button{min-width:42px;font-size:12px}}@media(max-width:390px){#detail[data-reader-kind="egw-reader"]>header>#back{min-width:52px;font-size:12px}#detail[data-reader-kind="egw-reader"]>header>.fontTools button{min-width:38px;font-size:11px}#detail[data-reader-kind="egw-reader"]>header>#detailType{font-size:11.5px}}`;document.head.appendChild(style);
  window.jgOpenNativeEgw=openUrl;
})();
