(() => {
  'use strict';

  const detail=document.getElementById('detail');
  const body=document.getElementById('detailBody');
  const type=document.getElementById('detailType');
  const actions=document.getElementById('detailActions');
  const shelfRoot=document.getElementById('egwShelf');
  const shelf=document.getElementById('egwBooks');
  const input=document.getElementById('egwBookSearch');
  const app=document.querySelector('.app');
  const appLogo=app?.querySelector(':scope>header .logo');
  const headerTools=app?.querySelector(':scope>header .headerTools');
  if(!detail||!body||!type||!actions||!shelfRoot||!shelf)return;

  let books=[];
  let mode='books';
  let tocSeq=0;
  let chapterObserver=null;
  let metaActive=0;
  const metaQueue=[];
  const metaCache=new Map();
  const metaWaiters=new Map();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s||'').trim().toLowerCase().replace(/[\s《》〈〉“”"'，。！？；、·_]/g,'');
  const canonicalUrl=url=>{
    const s=String(url||'').trim();
    const read=s.match(/\/(?:read|zh\/book)\/(\d+)\.(\d+)/i);
    return read?`https://text.egwwritings.org/read/${read[1]}.${read[2]}`:s.replace(/[?#].*$/,'');
  };
  const officialTocAllowed=url=>/^https?:\/\/(?:m\.|text\.)?egwwritings\.org\/(?:book\/b|zh\/book\/)/i.test(String(url||''));
  const lastReading=()=>{try{return JSON.parse(localStorage.getItem('jg_last_egw_native')||'null')}catch(_){return null}};
  const devotionalRx=/每日|灵修|晨钟|天父|从心出发|从心发出|高举主耶稣|举目向上|得胜的基督|奋斗与勇敢|今日|荣耀之光|彰显主基督|信仰的基础|与主同行|一同在天上/i;
  const collator=new Intl.Collator('zh-CN-u-co-pinyin');
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const anchors=[['A','阿'],['B','芭'],['C','擦'],['D','搭'],['E','蛾'],['F','发'],['G','噶'],['H','哈'],['J','击'],['K','喀'],['L','垃'],['M','妈'],['N','拿'],['O','哦'],['P','啪'],['Q','期'],['R','然'],['S','撒'],['T','塌'],['W','挖'],['X','昔'],['Y','压'],['Z','匝']];

  function initial(title){
    const s=String(title||'')
      .replace(/^\s*[0-9０-９]+\s*/,'')
      .replace(/^[\s《》〈〉“”"'「」『』【】（）()]+/,'')
      .trim();
    const first=s[0]||'#';
    if(/[A-Za-z]/.test(first))return first.toUpperCase();
    let out='A';
    for(const [letter,ch] of anchors){if(collator.compare(first,ch)>=0)out=letter;else break}
    return out;
  }

  function setupHeaderSearch(){
    if(!headerTools||headerTools.querySelector('.egwHeaderSearch'))return;
    const button=document.createElement('button');
    button.type='button';
    button.className='egwHeaderSearch';
    button.dataset.egwHeaderSearch='1';
    button.hidden=true;
    button.setAttribute('aria-label','搜索怀爱伦书名');
    button.innerHTML='<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.3"/><line x1="20" y1="20" x2="15.1" y2="15.1"/></svg>';
    headerTools.appendChild(button);
  }
  function setShelfHeader(active){
    setupHeaderSearch();
    app?.classList.toggle('egwShelfContext',!!active);
    if(appLogo)appLogo.textContent=active?'预言之灵':'救赎的历史';
    const button=headerTools?.querySelector('.egwHeaderSearch');
    if(button)button.hidden=!active;
  }
  function syncShelfHeader(){
    const library=document.getElementById('library');
    setShelfHeader(!!library?.classList.contains('active')&&!shelfRoot.hidden);
  }
  function setupShell(){
    setupHeaderSearch();
    if(!shelfRoot.querySelector('.egwModeTabs')){
      const tabs=document.createElement('div');
      tabs.className='egwModeTabs';
      tabs.innerHTML='<button data-egw-mode="devotional">每日灵修</button><button class="active" data-egw-mode="books">书籍资料</button>';
      shelfRoot.insertBefore(tabs,input||shelf);
    }
    if(input){input.placeholder='搜索书名';input.classList.add('egwBookSearchNative')}
  }
  function jumpToLetter(letter){
    const groups=[...shelf.querySelectorAll('.egwAlphaGroup')];
    if(!groups.length)return;
    const exact=groups.find(x=>x.dataset.letter===letter);
    const next=groups.find(x=>x.dataset.letter>letter);
    const target=exact||next||groups[groups.length-1];
    target.scrollIntoView({behavior:'auto',block:'start'});
  }
  function setupRail(rail){
    if(rail.dataset.ready)return;
    rail.dataset.ready='1';
    const jumpFromPoint=e=>{
      const rect=rail.getBoundingClientRect();
      const index=Math.max(0,Math.min(alphabet.length-1,Math.floor((e.clientY-rect.top)/rect.height*alphabet.length)));
      jumpToLetter(alphabet[index]);
    };
    rail.addEventListener('click',e=>{const button=e.target.closest('[data-egw-letter]');if(button)jumpToLetter(button.dataset.egwLetter)});
    rail.addEventListener('pointerdown',e=>{e.preventDefault();rail.setPointerCapture(e.pointerId);jumpFromPoint(e)});
    rail.addEventListener('pointermove',e=>{if(rail.hasPointerCapture(e.pointerId))jumpFromPoint(e)});
  }
  function renderBooks(){
    setupShell();
    syncShelfHeader();
    const q=norm(input?.value||'');
    let list=mode==='devotional'?books.filter(b=>devotionalRx.test(b.title_cn||'')):books;
    if(q)list=list.filter(b=>norm(b.title_cn).includes(q));
    list=[...list].sort((a,b)=>collator.compare(a.title_cn||'',b.title_cn||''));
    const groups=new Map();
    for(const b of list){const key=initial(b.title_cn);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(b)}
    const letters=[...groups.keys()].sort((a,b)=>alphabet.indexOf(a)-alphabet.indexOf(b));
    shelf.className='egwNativeList';
    shelf.innerHTML=letters.map(k=>`<section class="egwAlphaGroup" id="egw-alpha-${k}" data-letter="${k}"><h3>${k}</h3>${groups.get(k).map(b=>`<button class="egwBookRow" data-egw-book-id="${esc(b.id)}" data-egw-toc-url="${esc(b.toc_url)}" data-egw-book-title="${esc(b.title_cn)}"><span>${esc(b.title_cn)}</span><b aria-hidden="true">›</b></button>`).join('')}</section>`).join('')||(mode==='devotional'?'<div class="empty">每日灵修书单正在核验整理，请先使用书籍资料阅读。</div>':'<div class="empty">没有匹配的书籍。</div>');
    let rail=shelfRoot.querySelector('.egwAlphaRail');if(!rail){rail=document.createElement('div');rail.className='egwAlphaRail';shelfRoot.appendChild(rail)}
    const available=new Set(letters);
    rail.innerHTML=alphabet.map(k=>`<button type="button" data-egw-letter="${k}" aria-label="跳到 ${k}" aria-disabled="${available.has(k)?'false':'true'}" class="${available.has(k)?'':'empty'}">${k}</button>`).join('');
    setupRail(rail);
    shelfRoot.querySelectorAll('[data-egw-mode]').forEach(x=>x.classList.toggle('active',x.dataset.egwMode===mode));
  }

  function chineseNumber(value){
    const raw=String(value||'').replace(/[０-９]/g,ch=>String('０１２３４５６７８９'.indexOf(ch)));
    if(/^\d+$/.test(raw))return +raw;
    const d={零:0,〇:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
    if(raw.includes('百')){
      const [a,rest='']=raw.split('百'),hundreds=(d[a]??1)*100;
      return hundreds+(rest?chineseNumber(rest):0);
    }
    if(raw.includes('十')){
      const [a,b='']=raw.split('十');
      return (a?(d[a]??0):1)*10+(b?(d[b]??0):0);
    }
    if([...raw].every(ch=>ch in d))return +[...raw].map(ch=>d[ch]).join('');
    return NaN;
  }
  function chapterNumberLabel(title){
    const m=String(title||'').match(/^第\s*([0-9０-９一二三四五六七八九十百零〇两]+)\s*章/);
    if(!m)return '';
    const n=chineseNumber(m[1]);
    return Number.isFinite(n)?`第 ${String(n).padStart(2,'0')} 章`:m[0].replace(/\s+/g,'');
  }
  function chapterLabelHtml(base,subtitle=''){
    const number=chapterNumberLabel(base);
    if(number)return `<span class="egwChapterText${subtitle?' hasSubtitle':''}"><small class="egwChapterNumber">${esc(number)}</small>${subtitle?`<strong class="egwChapterName">${esc(subtitle)}</strong>`:''}</span>`;
    return `<span class="egwChapterText"><strong class="egwChapterName">${esc(base)}</strong></span>`;
  }
  function addCurrentReadingLabel(row){
    const host=row?.querySelector('.egwChapterText');
    if(!host||host.querySelector('.currentReadingLabel'))return;
    const label=document.createElement('small');
    label.className='currentReadingLabel';
    label.textContent='上次读到这里';
    host.appendChild(label);
  }
  function applyChapterMeta(row,data){
    if(!row?.isConnected||!data?.ok)return;
    const base=row.dataset.egwChapterTitle||'';
    const subtitle=String(data.subtitle||'').trim();
    if(!subtitle||norm(subtitle)===norm(base))return;
    row.dataset.egwDisplayTitle=`${base} ${subtitle}`.trim();
    const host=row.querySelector('.egwChapterText');
    if(host)host.outerHTML=chapterLabelHtml(base,subtitle);
    if(row.classList.contains('currentReading'))addCurrentReadingLabel(row);
  }
  function pumpMetaQueue(){
    while(metaActive<3&&metaQueue.length){
      const task=metaQueue.shift();
      metaActive+=1;
      fetch(`/api/egw-read?meta=1&url=${encodeURIComponent(task.url)}`,{cache:'force-cache'})
        .then(r=>r.json().then(j=>({ok:r.ok,j})))
        .then(({ok,j})=>{if(ok&&j?.ok)metaCache.set(task.key,j)})
        .catch(()=>{})
        .finally(()=>{
          const data=metaCache.get(task.key),waiters=metaWaiters.get(task.key)||new Set();
          for(const row of waiters)applyChapterMeta(row,data);
          metaWaiters.delete(task.key);
          metaActive-=1;
          pumpMetaQueue();
        });
    }
  }
  function enqueueChapterMeta(row){
    const url=canonicalUrl(row?.dataset.egwNativeUrl||'');
    if(!url)return;
    const key=url;
    if(metaCache.has(key)){applyChapterMeta(row,metaCache.get(key));return}
    if(metaWaiters.has(key)){metaWaiters.get(key).add(row);return}
    metaWaiters.set(key,new Set([row]));
    metaQueue.push({key,url});
    pumpMetaQueue();
  }
  function observeChapterTitles(){
    chapterObserver?.disconnect();
    const rows=[...body.querySelectorAll('.egwChapterRow')];
    if(!rows.length)return;
    if(!('IntersectionObserver' in window)){rows.slice(0,12).forEach(enqueueChapterMeta);return}
    chapterObserver=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(!entry.isIntersecting)continue;
        chapterObserver.unobserve(entry.target);
        enqueueChapterMeta(entry.target);
      }
    },{root:detail,rootMargin:'420px 0px'});
    rows.forEach(row=>chapterObserver.observe(row));
  }

  function openDialog(){
    detail.dataset.readingKey='';
    if(!detail.open)detail.showModal();
    detail.scrollTop=0;
    window.jgRefreshReadAloud?.();
  }
  function restoreChapterInToc(bookId){
    const last=lastReading();
    if(!last||String(last.bookId||'')!==String(bookId||''))return;
    const target=canonicalUrl(last.url||last.native_url||'');
    if(!target)return;
    const row=[...body.querySelectorAll('.egwChapterRow')].find(x=>canonicalUrl(x.dataset.egwNativeUrl)===target);
    if(!row)return;
    row.classList.add('currentReading');
    row.setAttribute('aria-current','location');
    addCurrentReadingLabel(row);
    requestAnimationFrame(()=>row.scrollIntoView({block:'center',behavior:'auto'}));
  }
  function showEgwShelfSearch(){
    tocSeq+=1;
    chapterObserver?.disconnect();
    if(detail.open)detail.close();
    const nav=document.querySelector('[data-open-shelf="egw"]');
    if(nav)nav.click();
    setShelfHeader(true);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      input?.focus();
      input?.scrollIntoView({behavior:'smooth',block:'center'});
    }));
  }
  async function openBook(id,fallbackUrl='',fallbackTitle=''){
    const requestId=++tocSeq;
    chapterObserver?.disconnect();
    const found=books.find(x=>String(x.id)===String(id));
    const b=found||{id,title_cn:fallbackTitle||'怀爱伦著作',toc_url:fallbackUrl};
    detail.dataset.readerKind='egw-toc';
    detail.dataset.readingKey='';
    type.textContent=b.title_cn||'预言之灵';
    if(!b.toc_url){
      actions.innerHTML='';
      body.innerHTML='<div class="empty">这本书暂时没有目录地址。</div>';
      openDialog();
      return;
    }
    const officialAction=officialTocAllowed(b.toc_url)?`<button type="button" data-egw-official-toc="${esc(b.toc_url)}">查看官方目录</button>`:'';
    actions.innerHTML=officialAction;
    body.innerHTML=`<div class="nativeBookHead"><h1>${esc(b.title_cn)}</h1><button type="button" class="nativeSearchIcon" data-egw-back-search aria-label="搜索书名"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" aria-hidden="true"><circle cx="10.3" cy="10.3" r="6.3"/><line x1="20" y1="20" x2="15.1" y2="15.1"/></svg></button></div><div class="empty">正在读取章节目录…</div>`;
    openDialog();
    try{
      const r=await fetch(`/api/egw-read?toc=1&url=${encodeURIComponent(b.toc_url)}&_=${Date.now()}`,{cache:'no-store'});
      if(requestId!==tocSeq)return;
      const j=await r.json();
      if(requestId!==tocSeq)return;
      if(!r.ok||!j.ok)throw new Error(j.error||'toc_failed');
      const chapters=(j.chapters||[]).filter((x,i,a)=>x.url&&x.title&&a.findIndex(y=>canonicalUrl(y.url)===canonicalUrl(x.url))===i);
      if(!chapters.length)throw new Error('empty_toc');
      body.innerHTML=`<div class="nativeBookHead"><h1>${esc(b.title_cn)}</h1><button type="button" class="nativeSearchIcon" data-egw-back-search aria-label="搜索书名"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" aria-hidden="true"><circle cx="10.3" cy="10.3" r="6.3"/><line x1="20" y1="20" x2="15.1" y2="15.1"/></svg></button></div><div class="egwChapterList">${chapters.map(c=>`<button type="button" class="egwChapterRow" data-egw-native-url="${esc(c.url)}" data-egw-chapter-title="${esc(c.title)}" data-egw-display-title="${esc(c.title)}" data-egw-book-title="${esc(b.title_cn)}" data-egw-book-id="${esc(b.id)}" data-egw-toc-url="${esc(b.toc_url)}">${chapterLabelHtml(c.title)}<b aria-hidden="true">›</b></button>`).join('')}</div>`;
      restoreChapterInToc(b.id);
      observeChapterTitles();
    }catch(err){
      if(requestId!==tocSeq)return;
      console.warn('EGW TOC read failed',err);
      body.innerHTML=`<div class="nativeBookHead"><h1>${esc(b.title_cn)}</h1><button type="button" class="nativeSearchIcon" data-egw-back-search aria-label="搜索书名"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" aria-hidden="true"><circle cx="10.3" cy="10.3" r="6.3"/><line x1="20" y1="20" x2="15.1" y2="15.1"/></svg></button></div><div class="empty">暂时无法读取目录，请稍后重试。</div>`;
    }
  }

  fetch('./data/egw-official-books.json',{cache:'no-store'}).then(r=>r.json()).then(j=>{books=j.books||[];renderBooks()}).catch(()=>{});
  input?.addEventListener('input',renderBooks);
  document.addEventListener('click',e=>{
    const headerSearch=e.target.closest('[data-egw-header-search]');if(headerSearch){e.preventDefault();showEgwShelfSearch();return}
    const openShelfBtn=e.target.closest('[data-open-shelf]');if(openShelfBtn)setShelfHeader(openShelfBtn.dataset.openShelf==='egw');
    const shelfBtn=e.target.closest('[data-shelf]');if(shelfBtn)setShelfHeader(shelfBtn.dataset.shelf==='egw');
    const pageBtn=e.target.closest('[data-page]');if(pageBtn&&pageBtn.dataset.page!=='library')setShelfHeader(false);
    const modeBtn=e.target.closest('[data-egw-mode]');if(modeBtn){e.preventDefault();mode=modeBtn.dataset.egwMode;renderBooks();return}
    const book=e.target.closest('[data-egw-book-id]:not([data-egw-chapter-title])');if(book){e.preventDefault();e.stopImmediatePropagation();openBook(book.dataset.egwBookId,book.dataset.egwTocUrl,book.dataset.egwBookTitle);return}
    const legacy=e.target.closest('[data-official-id]');if(legacy){e.preventDefault();e.stopImmediatePropagation();const title=legacy.closest('button,article')?.querySelector('b,.title')?.textContent?.replace(/[《》]/g,'')||'';openBook(legacy.dataset.officialId,legacy.dataset.officialUrl,title);return}
    const chapter=e.target.closest('[data-egw-chapter-title]');if(chapter){e.preventDefault();e.stopImmediatePropagation();if(window.jgOpenNativeEgw){window.jgOpenNativeEgw(chapter.dataset.egwNativeUrl,{title:`《${chapter.dataset.egwBookTitle||'怀爱伦著作'}》`,chapter:chapter.dataset.egwDisplayTitle||chapter.dataset.egwChapterTitle||'',bookId:chapter.dataset.egwBookId||'',tocUrl:chapter.dataset.egwTocUrl||''})}else{location.href=chapter.dataset.egwNativeUrl}return}
    const officialToc=e.target.closest('[data-egw-official-toc]');if(officialToc){e.preventDefault();e.stopImmediatePropagation();if(officialTocAllowed(officialToc.dataset.egwOfficialToc))window.open(officialToc.dataset.egwOfficialToc,'_blank','noopener');return}
    const search=e.target.closest('[data-egw-back-search]');if(search){e.preventDefault();e.stopImmediatePropagation();showEgwShelfSearch();return}
  },true);
  detail.addEventListener('close',()=>{if(detail.dataset.readerKind==='egw-toc')tocSeq+=1;chapterObserver?.disconnect()});

  const style=document.createElement('style');
  style.textContent=`
    #egwShelf{position:relative;padding-right:18px}
    .egwHeaderSearch{display:none;align-items:center;justify-content:center;width:44px;height:44px;padding:0;border:0!important;border-radius:0!important;background:transparent!important;color:var(--accent)!important}
    .app.egwShelfContext>header{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;padding-left:12px;padding-right:12px}
    .app.egwShelfContext>header .logo{grid-column:2;justify-self:center;color:var(--text);font-size:18px;letter-spacing:0}
    .app.egwShelfContext>header .headerTools{grid-column:3;justify-self:end;gap:0}
    .app.egwShelfContext>header .headerTools>small,.app.egwShelfContext>header .themePicker{display:none!important}
    .app.egwShelfContext>header .egwHeaderSearch{display:inline-flex}
    .egwModeTabs{display:grid;grid-template-columns:1fr 1fr;margin:4px 0 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);position:sticky;bottom:0;z-index:7;background:var(--bg)}
    .egwModeTabs button{min-height:48px;border:0;border-radius:0;background:transparent;padding:9px 6px;font-weight:650;font-size:13px;color:var(--muted)}
    .egwModeTabs button.active{color:var(--accent);background:color-mix(in srgb,var(--soft) 68%,transparent)}
    .egwBookSearchNative{width:100%;height:44px;margin:8px 0 3px;padding:9px 12px;border-radius:10px}
    .egwNativeList{display:block!important;border-top:0!important;margin-top:0!important}
    .egwAlphaGroup{margin:0;scroll-margin-top:82px}
    .egwAlphaGroup h3{font-size:16px;margin:0;padding:9px 5px 3px;color:var(--accent);font-weight:800;line-height:1.2}
    .egwBookRow,.egwChapterRow{width:100%;display:flex;align-items:center;justify-content:space-between;text-align:left;background:transparent;border:0;border-bottom:1px solid color-mix(in srgb,var(--line) 88%,transparent);border-radius:0;padding:8px 5px;font:inherit;min-height:56px;cursor:pointer;color:var(--text)}
    .egwBookRow span{min-width:0;font-size:17px;font-weight:560;line-height:1.35;white-space:normal;overflow:visible;text-overflow:clip;word-break:break-word}
    .egwBookRow b,.egwChapterRow>b{flex:0 0 auto;font-size:23px;color:color-mix(in srgb,var(--muted) 70%,transparent);font-weight:400;line-height:1}
    .egwAlphaRail{position:fixed;right:max(2px,env(safe-area-inset-right));top:50%;z-index:7;display:flex;flex-direction:column;align-items:center;width:20px;height:min(500px,59vh);transform:translateY(-50%);touch-action:none;user-select:none}
    .egwAlphaRail button{flex:1;width:20px;min-height:0;padding:0;border:0;background:transparent;color:var(--accent);font-size:8.5px;font-weight:800;line-height:1}
    .egwAlphaRail button.empty{color:color-mix(in srgb,var(--muted) 30%,transparent);font-weight:500}
    .nativeBookHead{display:flex;align-items:center;justify-content:center;position:sticky;top:0;background:var(--bg);z-index:3;padding:6px 42px 10px;border-bottom:1px solid var(--line)}
    .nativeBookHead h1{text-align:center;font-size:19px;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .nativeSearchIcon{position:absolute;right:0;border:0!important;background:transparent!important;font-size:28px!important;padding:0 8px!important}
    .egwChapterList{margin-top:0}
    .egwChapterRow{align-items:center;gap:12px;min-height:58px;padding:8px 4px}
    .egwChapterText{min-width:0;display:flex;flex:1;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px}
    .egwChapterNumber{color:var(--text);font-size:16px;font-weight:540;line-height:1.35}
    .egwChapterText.hasSubtitle .egwChapterNumber{color:var(--muted);font-size:10.5px;font-weight:650;letter-spacing:.025em}
    .egwChapterName{max-width:100%;color:var(--text);font-size:16.5px;font-weight:620;line-height:1.35;white-space:normal;overflow:visible;text-overflow:clip;word-break:break-word}
    .egwChapterRow.currentReading{background:color-mix(in srgb,var(--soft) 55%,transparent);box-shadow:inset 2px 0 0 var(--accent)}
    .currentReadingLabel{display:block;margin-top:2px;color:var(--accent);font-size:9.5px;font-weight:700;line-height:1.3}
    @media(max-width:560px){#egwShelf{padding-right:14px}.egwBookSearchNative{margin-top:6px}.egwBookRow{min-height:54px;padding:7px 3px}.egwBookRow span{font-size:16.5px}.egwAlphaGroup h3{padding:8px 4px 2px;font-size:15.5px}.egwAlphaRail{right:0;height:min(460px,57vh)}.egwModeTabs{margin-bottom:0}.egwChapterRow{min-height:56px;padding:7px 3px}.egwChapterName{font-size:16px}.egwChapterNumber{font-size:15.5px}.egwChapterText.hasSubtitle .egwChapterNumber{font-size:10px}}
  `;
  document.head.appendChild(style);
  window.jgOpenEgwBook=openBook;
})();
