(() => {
  'use strict';
  const detail=document.getElementById('detail'),body=document.getElementById('detailBody'),type=document.getElementById('detailType'),actions=document.getElementById('detailActions');
  if(!detail||!body||!type||!actions)return;
  let index=[],books=[],current=null,scrollTimer=0,openSeq=0,paraObserver=null,visibleParagraph=null,visibleOffset=0;
  const READING_KEY='jg_v10_reading',FAVORITES_KEY='jg_v10_favorites',POSITION_KEY='jg_v10_egw_position';
  fetch('./data/egw-index.json',{cache:'no-store'}).then(r=>r.json()).then(j=>{index=j.records||[]}).catch(()=>{});
  const booksReady=fetch('./data/egw-official-books.json',{cache:'no-store'}).then(r=>r.json()).then(j=>{books=j.books||[];return books}).catch(()=>books);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const allowed=url=>/^https?:\/\/(?:m\.|text\.)?egwwritings\.org\/(?:read\/|zh\/book\/)/i.test(String(url||''));
  const read=(key,fallback=[])=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch(_){return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(_){}};
  const canonicalUrl=url=>typeof window.jgCanonicalEgwUrl==='function'?window.jgCanonicalEgwUrl(url):String(url||'').trim().replace(/[?#].*$/,'').replace(/\/$/,'').replace(/^https?:\/\/(?:m\.|text\.)?egwwritings\.org\/zh\/book\/(\d+)\.(\d+)$/i,'https://text.egwwritings.org/read/$1.$2').replace(/^https?:\/\/(?:m\.|text\.)?egwwritings\.org\/read\/(\d+)\.(\d+)$/i,'https://text.egwwritings.org/read/$1.$2');
  const itemId=item=>`egw-native:${canonicalUrl(item?.native_url||'')}`;
  const bookIdFromUrl=url=>(String(url||'').match(/\/(?:read|zh\/book)\/(\d+)/i)||[])[1]||'';
  const bookById=id=>books.find(x=>String(x.id)===String(id));
  const formatParagraph=text=>String(text??'').split(/(\([A-Za-z]{1,12}\.?\s*\d+(?:\.\d+)*\)|\{[A-Za-z]{1,12}\s+\d+(?:\.\d+)+\}|〖\d+〗|\b[A-Za-z]{1,12}[A-Z]?\s+\d+(?:\.\d+)+)/g).map(part=>/^(?:\(|\{|〖|[A-Za-z])/.test(part)?`<small class="egwSourceRef">${esc(part)}</small>`:esc(part)).join('');
  const renderLocator=locator=>locator?`<div class="egwLocator" aria-label="原文定位">${esc(locator)}</div>`:'';
  function renderBlocks(j){
    const blocks=Array.isArray(j.blocks)?j.blocks:[];
    if(blocks.length)return blocks.map((block,i)=>{
      if(block?.type==='heading')return `<h3 class="egwSectionHeading">${esc(block.text||'')}</h3>`;
      if(block?.type==='paragraph')return `<div class="egwParagraphWrap"><p class="egwParagraph" data-egw-paragraph="${i}">${esc(block.text||'')}</p>${renderLocator(block.locator||'')}</div>`;
      return '';
    }).join('');
    return (j.paragraphs||[]).map((p,i)=>`<div class="egwParagraphWrap"><p class="egwParagraph" data-egw-paragraph="${i}">${formatParagraph(p)}</p></div>`).join('');
  }
  function remember(item){const id=itemId(item),items=read(READING_KEY).filter(x=>itemId(x)!==id);items.unshift({...item,at:Date.now()});write(READING_KEY,items.slice(0,12))}
  function isFavorite(item){const id=itemId(item);return read(FAVORITES_KEY).some(x=>itemId(x)===id)}
  function renderActions(){if(current)actions.innerHTML=`<button data-egw-native-favorite>${isFavorite(current)?'★ 已收藏':'☆ 收藏本章'}</button><button data-official-source="${esc(current.native_url)}">核验官方原始出处</button>`}
  function toggleFavorite(){if(!current)return;const id=itemId(current),items=read(FAVORITES_KEY);write(FAVORITES_KEY,items.some(x=>itemId(x)===id)?items.filter(x=>itemId(x)!==id):[{...current,at:Date.now()},...items]);renderActions()}
  function disconnectParaObserver(){
    if(paraObserver){paraObserver.disconnect();paraObserver=null}
  }
  function observeParagraphs(){
    disconnectParaObserver();
    visibleParagraph=null;visibleOffset=0;
    const paras=[...body.querySelectorAll('.egwParagraph')];
    if(!paras.length||typeof IntersectionObserver!=='function')return;
    paraObserver=new IntersectionObserver(entries=>{
      // Prefer the most visible intersecting paragraph near the upper reading band.
      let best=null,bestRatio=-1;
      for(const entry of entries){
        if(!entry.isIntersecting)continue;
        if(entry.intersectionRatio>=bestRatio){bestRatio=entry.intersectionRatio;best=entry.target}
      }
      if(!best)return;
      const i=+best.dataset.egwParagraph;
      if(Number.isFinite(i)){visibleParagraph=i;visibleOffset=0}
    },{root:detail,threshold:[0.2,0.4,0.6,0.8],rootMargin:'-12% 0px -55% 0px'});
    paras.forEach(p=>paraObserver.observe(p));
  }
  function positionSnapshot(){
    // Prefer IntersectionObserver-tracked paragraph to avoid offsetTop layout thrash while scrolling.
    if(Number.isFinite(visibleParagraph))return {paragraph:visibleParagraph,offset:+(+visibleOffset||0).toFixed(3)};
    const paras=[...body.querySelectorAll('.egwParagraph')];
    if(!paras.length)return null;
    const y=(detail.scrollTop||0)+Math.min(140,Math.max(72,detail.clientHeight*.18));
    let i=paras.findIndex(p=>p.offsetTop+p.offsetHeight>y);
    if(i<0)i=paras.length-1;
    const p=paras[i],height=Math.max(1,p.offsetHeight),offset=Math.max(0,Math.min(1,(y-p.offsetTop)/height));
    return {paragraph:i,offset:+offset.toFixed(3)};
  }
  function markParagraph(saved){
    body.querySelectorAll('.readingMark').forEach(x=>x.classList.remove('readingMark'));
    if(!saved||typeof saved!=='object'||!Number.isFinite(+saved.paragraph))return;
    const paras=[...body.querySelectorAll('.egwParagraph')],p=paras[Math.max(0,Math.min(paras.length-1,+saved.paragraph||0))];
    p?.closest('.egwParagraphWrap')?.classList.add('readingMark');
  }
  function refineOffset(paragraphIndex){
    const paras=body.querySelectorAll('.egwParagraph');
    const p=paras[paragraphIndex];
    if(!p)return 0;
    // Single layout read after scroll rests — not on every scroll frame.
    const y=(detail.scrollTop||0)+Math.min(140,Math.max(72,detail.clientHeight*.18));
    const height=Math.max(1,p.offsetHeight);
    return +Math.max(0,Math.min(1,(y-p.offsetTop)/height)).toFixed(3);
  }
  function savePosition(opts={}){
    if(!current||!detail.open)return;
    let snap=positionSnapshot();if(!snap)return;
    // When resting after scroll, refine in-paragraph offset once.
    if(opts.refineOffset&&Number.isFinite(snap.paragraph)){
      snap={paragraph:snap.paragraph,offset:refineOffset(snap.paragraph)};
      visibleOffset=snap.offset;
    }
    const positions=read(POSITION_KEY,{});positions[itemId(current)]=snap;write(POSITION_KEY,positions);
    // Avoid class thrash while the user is still scrolling (causes jank on scroll-up).
    if(!opts.silent)markParagraph(snap);
  }
  function restoreSnapshot(saved){
    requestAnimationFrame(()=>{
      if(saved&&typeof saved==='object'&&Number.isFinite(+saved.paragraph)){
        const paras=[...body.querySelectorAll('.egwParagraph')],i=Math.max(0,Math.min(paras.length-1,+saved.paragraph||0)),p=paras[i];
        if(p){const offset=Math.max(0,Math.min(1,+saved.offset||0));detail.scrollTop=Math.max(0,p.offsetTop+p.offsetHeight*offset-Math.min(140,Math.max(72,detail.clientHeight*.18)));markParagraph(saved);return}
      }
      detail.scrollTop=Number.isFinite(+saved)?Math.max(0,+saved):0;
    });
  }
  function restorePosition(){restoreSnapshot(read(POSITION_KEY,{})[itemId(current)])}
  function showLoading(title='怀爱伦著作'){
    detail.dataset.readerKind='egw-reader';
    detail.dataset.readingKey='';
    type.textContent='正在读取';
    disconnectParaObserver();visibleParagraph=null;
    body.innerHTML=`<div class="egwLoading"><div>${esc(title)}</div><span>正在读取原文章节…</span></div>`;
    actions.innerHTML='';
    if(!detail.open)detail.showModal();
    window.jgRefreshReadAloud?.();
  }
  function returnToToc(){
    if(!current?.bookId||!current?.tocUrl||typeof window.jgOpenEgwBook!=='function')return false;
    openSeq+=1;
    savePosition();
    const title=String(current.title||'').replace(/^[《]|[》]$/g,'');
    window.jgOpenEgwBook(current.bookId,current.tocUrl,title);
    return true;
  }
  async function resolveBookContext(url,meta,previous){
    const urlBookId=bookIdFromUrl(url);
    let bookId=String(meta.bookId||urlBookId||previous?.bookId||'');
    if(bookId&&!bookById(bookId))await booksReady;
    const book=bookById(bookId);
    const previousMatches=!bookId||String(previous?.bookId||'')===bookId;
    const bookTitle=meta.title||(book?.title_cn?`《${book.title_cn}》`:'')||(previousMatches?previous?.title:'')||'怀爱伦著作';
    const tocUrl=meta.tocUrl||book?.toc_url||(previousMatches?previous?.tocUrl:'')||'';
    return {bookId,tocUrl,bookTitle};
  }
  async function openUrl(url,meta={}){
    url=canonicalUrl(url);
    if(!allowed(url))return false;
    const requestId=++openSeq;
    const previous=current;
    savePosition();
    showLoading(meta.title||previous?.title||'怀爱伦著作');
    try{
      const r=await fetch(`/api/egw-read?url=${encodeURIComponent(url)}`);
      if(requestId!==openSeq)return false;
      const j=await r.json();
      if(requestId!==openSeq)return false;
      if(!r.ok||!j.ok)throw new Error(j.error||'read_failed');
      const chapterTitle=meta.chapter||j.title||'预言之灵阅读';
      const {bookId,tocUrl,bookTitle}=await resolveBookContext(url,meta,previous);
      if(requestId!==openSeq)return false;
      type.textContent=chapterTitle;
      const navMeta=`data-egw-title="${esc(bookTitle)}" data-egw-book-id="${esc(bookId)}" data-egw-toc-url="${esc(tocUrl)}"`;
      const bottomNav=(j.prev||j.next)?`<nav class="egwChapterPager" aria-label="章节导航">${j.prev?`<button data-egw-native-url="${esc(j.prev.url)}" ${navMeta} data-egw-chapter="${esc(j.prev.title||'')}"><small>上一章</small><span>‹ ${esc(j.prev.title)}</span></button>`:'<span></span>'}${j.next?`<button data-egw-native-url="${esc(j.next.url)}" ${navMeta} data-egw-chapter="${esc(j.next.title||'')}"><small>下一章</small><span>${esc(j.next.title)} ›</span></button>`:'<span></span>'}</nav>`:'';
      body.innerHTML=`<article class="egwReaderArticle"><header class="egwReaderIntro"><div class="egwBookName">${esc(bookTitle)}</div><h1>${esc(chapterTitle)}</h1></header><div class="reading egwReading">${renderBlocks(j)}</div>${bottomNav}</article>`;
      current={type:'egw',native_url:url,title:bookTitle,chapter:chapterTitle,locator:meta.locator||previous?.locator||'',bookId,tocUrl};
      remember(current);renderActions();window.jgRefreshReadAloud?.();observeParagraphs();restorePosition();
      try{localStorage.setItem('jg_last_egw_native',JSON.stringify({url,title:bookTitle,chapter:chapterTitle,bookId,tocUrl,at:Date.now()}))}catch(_){}
      return true;
    }catch(e){
      if(requestId!==openSeq)return false;
      console.warn('EGW native reader failed',e);
      current=previous;
      body.innerHTML=`<div class="empty">这一页暂时无法在站内读取。<div class="actions"><button data-official-source="${esc(url)}">打开官方原文</button></div></div>`;
      window.jgRefreshReadAloud?.();
      return false;
    }
  }
  function sourceById(id){return index.find(x=>String(x.id)===String(id))}
  document.addEventListener('click',e=>{
    const back=e.target.closest('#back');
    if(back&&detail.dataset.readerKind==='egw-reader'&&returnToToc()){e.preventDefault();e.stopImmediatePropagation();return}
    const nav=e.target.closest('[data-egw-native-url]');
    if(nav){e.preventDefault();e.stopImmediatePropagation();openUrl(nav.dataset.egwNativeUrl,{title:nav.dataset.egwTitle||nav.dataset.egwBookTitle&&`《${nav.dataset.egwBookTitle}》`||'',chapter:nav.dataset.egwChapter||nav.dataset.egwChapterTitle||'',bookId:nav.dataset.egwBookId||'',tocUrl:nav.dataset.egwTocUrl||''});return}
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
  detail.addEventListener('scroll',()=>{
    if(!detail.classList.contains('is-scrolling'))detail.classList.add('is-scrolling');
    clearTimeout(scrollTimer);
    scrollTimer=setTimeout(()=>{
      detail.classList.remove('is-scrolling');
      // After rest: one offset layout read + silent persist. No .readingMark writes.
      savePosition({silent:true,refineOffset:true});
    },300);
  },{passive:true});
  document.querySelector('.fontTools')?.addEventListener('click',event=>{
    if(detail.dataset.readerKind!=='egw-reader'||!event.target.closest('[data-font]'))return;
    const saved=positionSnapshot();
    if(saved)requestAnimationFrame(()=>restoreSnapshot(saved));
  },true);
  detail.addEventListener('cancel',savePosition);
  detail.addEventListener('close',()=>{openSeq+=1;savePosition();if(detail.dataset.readerKind==='egw-reader')delete detail.dataset.readerKind});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')savePosition({silent:true})});
  window.addEventListener('pagehide',()=>savePosition({silent:true}));
  const style=document.createElement('style');style.textContent=`
    .egwReaderArticle{max-width:720px;margin:0 auto;padding:18px 18px 34px}
    .egwReaderIntro{padding:8px 0 22px;border-bottom:1px solid var(--line);text-align:center}
    .egwReaderIntro .egwBookName{color:var(--muted);font-size:12px;line-height:1.4}
    .egwReaderIntro h1{margin:7px auto 0;max-width:620px;font-family:"Songti SC","STSong","Noto Serif SC",serif;font-size:24px;line-height:1.4;font-weight:700;color:var(--text)}
    .egwReading{max-width:680px;margin:0 auto;padding:24px 0 6px;background:transparent!important}
    .egwParagraphWrap{margin:0 0 1.25em}
    .egwReading .egwParagraph{margin:0;padding:0;font-family:"Songti SC","STSong","Noto Serif SC",serif;font-size:var(--reader-font,19px);line-height:2.02;text-align:justify;text-justify:inter-ideograph;letter-spacing:.01em}
    .egwLocator{margin:4px 0 0;color:var(--muted);font-size:calc(var(--reader-font,19px)*.68);line-height:1.45;letter-spacing:.015em}
    .egwSectionHeading{margin:1.75em 0 .75em;font-family:"Songti SC","STSong","Noto Serif SC",serif;font-size:calc(var(--reader-font,19px)*1.04);line-height:1.55;color:var(--text);font-weight:700}
    .egwSourceRef{display:inline;color:var(--muted);font-size:.76em;line-height:1.5}
    .egwChapterPager{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:34px 0 0;padding-top:18px;border-top:1px solid var(--line)}
    .egwChapterPager button{min-width:0;padding:10px 0;border:0;background:transparent;color:var(--accent);text-align:left}
    .egwChapterPager button:last-child{text-align:right}
    .egwChapterPager small,.egwChapterPager span{display:block}
    .egwChapterPager small{margin-bottom:4px;color:var(--muted);font-size:11px;font-weight:500}
    .egwChapterPager span{font-size:13px;line-height:1.45;white-space:normal}
    .egwLoading{padding:46px 18px;text-align:center;color:var(--text)}.egwLoading span{display:block;margin-top:8px;color:var(--muted);font-size:13px}
    #detail[data-reader-kind="egw-reader"]>header{grid-template-columns:auto minmax(0,1fr) auto}
    #detail[data-reader-kind="egw-reader"]>header>#back{white-space:nowrap}
    #detail[data-reader-kind="egw-reader"]>header>#detailType{min-width:0;max-width:100%;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal;line-height:1.25}
    #detail[data-reader-kind="egw-reader"]>header>.fontTools{flex-wrap:nowrap;white-space:nowrap}
    @media(max-width:560px){
      .egwReaderArticle{padding:12px 14px 28px}.egwReaderIntro{padding:5px 0 18px}.egwReaderIntro h1{font-size:21px}.egwReading{padding-top:20px}.egwReading .egwParagraph{line-height:1.92}.egwParagraphWrap{margin-bottom:1.18em}.egwChapterPager{gap:12px;margin-top:28px}
      #detail[data-reader-kind="egw-reader"]>header{gap:5px;padding-left:max(8px,env(safe-area-inset-left));padding-right:max(8px,env(safe-area-inset-right))}#detail[data-reader-kind="egw-reader"]>header>#back{min-width:58px;padding-left:0;padding-right:4px}#detail[data-reader-kind="egw-reader"]>header>#detailType{font-size:12px}#detail[data-reader-kind="egw-reader"]>header>.fontTools{gap:0}#detail[data-reader-kind="egw-reader"]>header>.fontTools button{min-width:42px;font-size:12px}
    }
    @media(max-width:390px){.egwReaderArticle{padding-left:12px;padding-right:12px}.egwReaderIntro h1{font-size:20px}#detail[data-reader-kind="egw-reader"]>header>#back{min-width:52px;font-size:12px}#detail[data-reader-kind="egw-reader"]>header>.fontTools button{min-width:38px;font-size:11px}#detail[data-reader-kind="egw-reader"]>header>#detailType{font-size:11.5px}}
  
    #detail.is-scrolling .readerQuickBar,#detail.is-scrolling #readerCrossIndex,#detail.is-scrolling>footer{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background:color-mix(in srgb,var(--surface) 96%,transparent)!important}
  `;document.head.appendChild(style);
  window.jgOpenNativeEgw=openUrl;
})();
