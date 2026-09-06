(() => {
  'use strict';

  const detail=document.getElementById('detail');
  const body=document.getElementById('detailBody');
  const type=document.getElementById('detailType');
  const actions=document.getElementById('detailActions');
  const shelfRoot=document.getElementById('egwShelf');
  const shelf=document.getElementById('egwBooks');
  const input=document.getElementById('egwBookSearch');
  if(!detail||!body||!type||!actions||!shelfRoot||!shelf)return;

  let books=[];
  let mode='books';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const norm=s=>String(s||'').trim().toLowerCase().replace(/[\s《》〈〉“”"'，。！？；、·_]/g,'');
  const devotionalRx=/每日|灵修|晨钟|天父|从心出发|从心发出|高举主耶稣|举目向上|得胜的基督|奋斗与勇敢|今日|荣耀之光|彰显主基督|信仰的基础|与主同行|一同在天上/i;
  const collator=new Intl.Collator('zh-CN-u-co-pinyin');
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const anchors=[['A','阿'],['B','芭'],['C','擦'],['D','搭'],['E','蛾'],['F','发'],['G','噶'],['H','哈'],['J','击'],['K','喀'],['L','垃'],['M','妈'],['N','拿'],['O','哦'],['P','啪'],['Q','期'],['R','然'],['S','撒'],['T','塌'],['W','挖'],['X','昔'],['Y','压'],['Z','匝']];

  function initial(title){
    const s=String(title||'').replace(/^\s*[0-9０-９]+\s*/,'').trim();
    const first=s[0]||'#';
    if(/[A-Za-z]/.test(first))return first.toUpperCase();
    let out='A';
    for(const [letter,ch] of anchors){if(collator.compare(first,ch)>=0)out=letter;else break}
    return out;
  }
  function setupShell(){
    if(shelfRoot.querySelector('.egwModeTabs'))return;
    const title=shelfRoot.querySelector('h2');
    if(title)title.innerHTML='预言之灵';
    const form=shelfRoot.querySelector('#egwAllChapterSearch');
    if(form){form.classList.add('egwAppSearch');const badge=form.querySelector('.badge');if(badge)badge.remove();const b=form.querySelector('b');if(b)b.textContent='全文搜索';const small=form.querySelector('small');if(small)small.textContent='搜索怀爱伦著作正文，结果直接在本站打开。'}
    const tabs=document.createElement('div');
    tabs.className='egwModeTabs';
    tabs.innerHTML='<button data-egw-mode="devotional">每日灵修</button><button class="active" data-egw-mode="books">书籍资料</button>';
    const heading=[...shelfRoot.querySelectorAll('h2')].find(x=>x!==title&&x.textContent.includes('书籍'));
    if(heading)heading.replaceWith(tabs);else shelf.before(tabs);
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
    const q=norm(input?.value||'');
    let list=mode==='devotional'?books.filter(b=>devotionalRx.test(b.title_cn||'')):books;
    if(q)list=list.filter(b=>norm(b.title_cn).includes(q));
    list=[...list].sort((a,b)=>collator.compare(a.title_cn||'',b.title_cn||''));
    const groups=new Map();
    for(const b of list){const key=initial(b.title_cn);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(b)}
    const letters=[...groups.keys()].sort((a,b)=>alphabet.indexOf(a)-alphabet.indexOf(b));
    shelf.className='egwNativeList';
    shelf.innerHTML=letters.map(k=>`<section class="egwAlphaGroup" id="egw-alpha-${k}" data-letter="${k}"><h3>${k}</h3>${groups.get(k).map(b=>`<button class="egwBookRow" data-egw-book-id="${esc(b.id)}" data-egw-toc-url="${esc(b.toc_url)}" data-egw-book-title="${esc(b.title_cn)}"><span>${esc(b.title_cn)}</span><b>›</b></button>`).join('')}</section>`).join('')||'<div class="empty">没有匹配的书籍。</div>';
    let rail=shelfRoot.querySelector('.egwAlphaRail');if(!rail){rail=document.createElement('div');rail.className='egwAlphaRail';shelfRoot.appendChild(rail)}
    const available=new Set(letters);
    rail.innerHTML=alphabet.map(k=>`<button type="button" data-egw-letter="${k}" aria-label="跳到 ${k}" aria-disabled="${available.has(k)?'false':'true'}" class="${available.has(k)?'':'empty'}">${k}</button>`).join('');
    setupRail(rail);
    shelfRoot.querySelectorAll('[data-egw-mode]').forEach(x=>x.classList.toggle('active',x.dataset.egwMode===mode));
  }
  function openDialog(){if(!detail.open)detail.showModal();detail.scrollTop=0}
  async function openBook(id,fallbackUrl='',fallbackTitle=''){
    const found=books.find(x=>String(x.id)===String(id));
    const b=found||{id,title_cn:fallbackTitle||'怀爱伦著作',toc_url:fallbackUrl};
    if(!b.toc_url){body.innerHTML='<div class="empty">这本书暂时没有目录地址。</div>';openDialog();return}
    type.textContent='预言之灵';
    body.innerHTML=`<div class="nativeBookHead"><h1>${esc(b.title_cn)}</h1><button class="nativeSearchIcon" data-egw-back-search aria-label="搜索">⌕</button></div><div class="empty">正在读取章节目录…</div>`;
    actions.innerHTML=`<button data-official-url="${esc(b.toc_url)}">查看官方目录</button>`;openDialog();
    try{
      const r=await fetch(`/api/egw-read?toc=1&url=${encodeURIComponent(b.toc_url)}&_=${Date.now()}`,{cache:'no-store'}),j=await r.json();
      if(!r.ok||!j.ok)throw new Error(j.error||'toc_failed');
      const chapters=(j.chapters||[]).filter((x,i,a)=>x.url&&x.title&&a.findIndex(y=>y.url===x.url)===i);
      if(!chapters.length)throw new Error('empty_toc');
      body.innerHTML=`<div class="nativeBookHead"><h1>${esc(b.title_cn)}</h1><button class="nativeSearchIcon" data-egw-back-search aria-label="搜索">⌕</button></div><div class="egwChapterList">${chapters.map(c=>`<button class="egwChapterRow" data-egw-native-url="${esc(c.url)}" data-egw-chapter-title="${esc(c.title)}" data-egw-book-title="${esc(b.title_cn)}"><span>${esc(c.title)}</span><b>›</b></button>`).join('')}</div>`;
    }catch(err){
      body.innerHTML=`<div class="nativeBookHead"><h1>${esc(b.title_cn)}</h1></div><div class="empty">章节目录读取失败，请稍后重试。<br><small>${esc(err?.message||'toc_failed')}</small></div>`;
    }
  }

  fetch('./data/egw-official-books.json',{cache:'no-store'}).then(r=>r.json()).then(j=>{books=j.books||[];renderBooks()}).catch(()=>{});
  input?.addEventListener('input',renderBooks);
  document.addEventListener('click',e=>{
    const modeBtn=e.target.closest('[data-egw-mode]');if(modeBtn){e.preventDefault();mode=modeBtn.dataset.egwMode;renderBooks();return}
    const book=e.target.closest('[data-egw-book-id]');if(book){e.preventDefault();e.stopImmediatePropagation();openBook(book.dataset.egwBookId,book.dataset.egwTocUrl,book.dataset.egwBookTitle);return}
    const legacy=e.target.closest('[data-official-id]');if(legacy){e.preventDefault();e.stopImmediatePropagation();const title=legacy.closest('button,article')?.querySelector('b,.title')?.textContent?.replace(/[《》]/g,'')||'';openBook(legacy.dataset.officialId,legacy.dataset.officialUrl,title);return}
    const chapter=e.target.closest('[data-egw-chapter-title]');if(chapter){e.preventDefault();e.stopImmediatePropagation();if(window.jgOpenNativeEgw){window.jgOpenNativeEgw(chapter.dataset.egwNativeUrl,{title:`《${chapter.dataset.egwBookTitle||'怀爱伦著作'}》`,chapter:chapter.dataset.egwChapterTitle||''})}else{location.href=chapter.dataset.egwNativeUrl}return}
    const search=e.target.closest('[data-egw-back-search]');if(search){e.preventDefault();detail.close();input?.focus();input?.scrollIntoView({behavior:'smooth',block:'center'});return}
  },true);

  const style=document.createElement('style');
  style.textContent=`#egwShelf{position:relative;padding-right:18px}.egwAppSearch{margin:8px 0 12px!important;padding:12px!important;border-radius:12px!important}.egwModeTabs{display:grid;grid-template-columns:1fr 1fr;margin:12px 0 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);position:sticky;bottom:0;z-index:7;background:var(--bg)}.egwModeTabs button{border:0;border-radius:0;background:transparent;padding:14px 6px;font-weight:700;font-size:16px;color:var(--muted)}.egwModeTabs button.active{color:var(--accent);background:var(--soft)}.egwBookSearchNative{width:100%;margin:12px 0 4px}.egwNativeList{display:block!important;border-top:0!important;margin-top:0!important}.egwAlphaGroup{margin:0;scroll-margin-top:88px}.egwAlphaGroup h3{font-size:18px;margin:0;padding:13px 6px 5px;color:var(--accent)}.egwBookRow,.egwChapterRow{width:100%;display:flex;align-items:center;justify-content:space-between;text-align:left;background:transparent;border:0;border-bottom:1px solid var(--line);border-radius:0;padding:13px 6px;font:inherit;min-height:51px;cursor:pointer;color:var(--text)}.egwBookRow span,.egwChapterRow span{font-size:18px;font-weight:600;line-height:1.35}.egwBookRow b,.egwChapterRow b{font-size:29px;color:var(--muted);font-weight:400}.egwAlphaRail{position:fixed;right:max(4px,env(safe-area-inset-right));top:50%;z-index:7;display:flex;flex-direction:column;align-items:center;width:22px;height:min(520px,60vh);transform:translateY(-50%);touch-action:none;user-select:none}.egwAlphaRail button{flex:1;width:22px;min-height:0;padding:0;border:0;background:transparent;color:var(--accent);font-size:9px;font-weight:800;line-height:1}.egwAlphaRail button.empty{color:color-mix(in srgb,var(--muted) 35%,transparent);font-weight:500}.nativeBookHead{display:flex;align-items:center;justify-content:center;position:sticky;top:0;background:var(--bg);z-index:3;padding:6px 42px 12px;border-bottom:1px solid var(--line)}.nativeBookHead h1{text-align:center;font-size:19px;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nativeSearchIcon{position:absolute;right:0;border:0!important;background:transparent!important;font-size:28px!important;padding:0 8px!important}.egwChapterList{margin-top:0}@media(max-width:560px){#egwShelf{padding-right:15px}#egwShelf>h2:first-child{font-size:22px}.egwBookRow,.egwChapterRow{padding:12px 4px}.egwBookRow span,.egwChapterRow span{font-size:18px}.egwAlphaRail{right:1px;height:min(468px,58vh)}.egwModeTabs{margin-bottom:0}}`;
  document.head.appendChild(style);
})();
