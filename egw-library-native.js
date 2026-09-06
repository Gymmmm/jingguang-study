(() => {
  'use strict';

  const detail=document.getElementById('detail');
  const detailBody=document.getElementById('detailBody');
  const detailType=document.getElementById('detailType');
  const detailActions=document.getElementById('detailActions');
  const shelf=document.getElementById('egwShelf');
  const booksHost=document.getElementById('egwBooks');
  const bookSearch=document.getElementById('egwBookSearch');
  if(!detail||!detailBody||!detailType||!detailActions||!shelf||!booksHost)return;

  let books=[];
  let mode='books';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s||'').trim().toLowerCase().replace(/[\s《》〈〉“”"'，。！？；、·_]/g,'');
  const devotionalRx=/每日|灵修|晨钟|天父|从心出发|从心发出|高举主耶稣|举目向上|得胜的基督|奋斗与勇敢|今日|荣耀之光|彰显主基督|信仰的基础|与主同行|一同在天上/i;
  const anchors=[['A','阿'],['B','芭'],['C','擦'],['D','搭'],['E','蛾'],['F','发'],['G','噶'],['H','哈'],['J','击'],['K','喀'],['L','垃'],['M','妈'],['N','拿'],['O','哦'],['P','啪'],['Q','期'],['R','然'],['S','撒'],['T','塌'],['W','挖'],['X','昔'],['Y','压'],['Z','匝']];
  const collator=new Intl.Collator('zh-CN-u-co-pinyin');

  function initial(title){
    const s=String(title||'').replace(/^\s*[0-9０-９]+\s*/,'').trim();
    const first=s[0]||'#';
    if(/[A-Za-z]/.test(first))return first.toUpperCase();
    let out='A';
    for(const [letter,char] of anchors){
      if(collator.compare(first,char)>=0)out=letter; else break;
    }
    return out;
  }

  function sorted(list){
    return [...list].sort((a,b)=>collator.compare(String(a.title_cn||''),String(b.title_cn||'')));
  }

  function installShell(){
    if(shelf.querySelector('.egwNativeTabs'))return;
    const heading=shelf.querySelector('h2');
    if(heading){heading.textContent='预言之灵';heading.classList.add('egwNativeTitle')}
    const searchForm=shelf.querySelector('#egwAllChapterSearch');
    if(searchForm){
      const b=searchForm.querySelector('b'); if(b)b.textContent='全文搜索';
      const small=searchForm.querySelector('small'); if(small)small.textContent='输入关键词，直接查看怀著全文匹配结果。';
    }
    const tabs=document.createElement('div');
    tabs.className='egwNativeTabs';
    tabs.innerHTML='<button data-egw-library-mode="devotional">每日灵修</button><button class="active" data-egw-library-mode="books">书籍资料</button>';
    const bookHeading=[...shelf.querySelectorAll('h2')].find(x=>x.textContent.includes('按书名'));
    if(bookHeading)bookHeading.replaceWith(tabs); else booksHost.before(tabs);
    if(bookSearch){bookSearch.placeholder='搜索书名';bookSearch.classList.add('egwNativeSearch')}
  }

  function render(){
    installShell();
    const q=norm(bookSearch?.value||'');
    let list=mode==='devotional'?books.filter(b=>devotionalRx.test(b.title_cn||'')):books;
    if(q)list=list.filter(b=>norm(b.title_cn).includes(q));
    list=sorted(list);
    const groups=new Map();
    for(const b of list){const key=initial(b.title_cn);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(b)}
    const letters=[...groups.keys()];
    booksHost.className='egwNativeBookList';
    booksHost.innerHTML=letters.map(letter=>`<section class="egwLetterGroup" id="egw-letter-${letter}"><h3>${letter}</h3>${groups.get(letter).map(b=>`<button class="egwBookRow" data-egw-book-id="${esc(b.id)}" data-egw-toc-url="${esc(b.toc_url)}" data-egw-book-title="${esc(b.title_cn)}"><span>${esc(b.title_cn)}</span><i>›</i></button>`).join('')}</section>`).join('') || '<div class="empty">没有匹配的书籍。</div>';
    let rail=shelf.querySelector('.egwLetterRail');
    if(!rail){rail=document.createElement('div');rail.className='egwLetterRail';shelf.appendChild(rail)}
    rail.innerHTML=q?'':letters.map(x=>`<a href="#egw-letter-${x}">${x}</a>`).join('');
    shelf.querySelectorAll('[data-egw-library-mode]').forEach(x=>x.classList.toggle('active',x.dataset.egwLibraryMode===mode));
  }

  async function openToc(url,title){
    detailType.textContent='预言之灵';
    detailBody.innerHTML=`<div class="egwTocHeader"><h1>${esc(title)}</h1></div><div class="empty">正在读取目录…</div>`;
    detailActions.innerHTML='';
    if(!detail.open)detail.showModal();
    try{
      const r=await fetch(`/api/egw-read?toc=1&url=${encodeURIComponent(url)}`,{cache:'no-store'});
      const j=await r.json();
      if(!r.ok||!j.ok)throw new Error(j.error||'toc_failed');
      const chapters=(j.chapters||[]).filter((x,i,a)=>x.url&&x.title&&a.findIndex(y=>y.url===x.url)===i);
      detailBody.innerHTML=`<div class="egwTocHeader"><h1>${esc(title||j.title||'怀爱伦著作')}</h1><button class="egwTocSearch" data-page-search="1" aria-label="搜索">⌕</button></div><div class="egwChapterList">${chapters.map(c=>`<button class="egwChapterRow" data-egw-native-url="${esc(c.url)}"><span>${esc(c.title)}</span><i>›</i></button>`).join('')||'<div class="empty">暂时没有读取到章节目录。</div>'}</div>`;
      detailActions.innerHTML=`<button data-official-url="${esc(url)}">查看官方目录</button>`;
      detail.scrollTop=0;
    }catch(_){
      detailBody.innerHTML=`<div class="egwTocHeader"><h1>${esc(title)}</h1></div><div class="empty">目录暂时无法读取。</div>`;
      detailActions.innerHTML=`<button data-official-url="${esc(url)}">查看官方目录</button>`;
    }
  }

  fetch('./data/egw-official-books.json',{cache:'no-store'}).then(r=>r.json()).then(j=>{books=j.books||[];render()}).catch(()=>{});

  bookSearch?.addEventListener('input',()=>render());
  document.addEventListener('click',e=>{
    const modeBtn=e.target.closest('[data-egw-library-mode]');
    if(modeBtn){e.preventDefault();mode=modeBtn.dataset.egwLibraryMode;render();return}
    const row=e.target.closest('[data-egw-book-id]');
    if(row){e.preventDefault();e.stopImmediatePropagation();openToc(row.dataset.egwTocUrl,row.dataset.egwBookTitle);return}
    const legacy=e.target.closest('[data-official-id]');
    if(legacy){
      const b=books.find(x=>String(x.id)===String(legacy.dataset.officialId));
      if(b){e.preventDefault();e.stopImmediatePropagation();openToc(b.toc_url,b.title_cn);return}
    }
    const searchBtn=e.target.closest('[data-page-search]');
    if(searchBtn){e.preventDefault();detail.close();bookSearch?.focus();bookSearch?.scrollIntoView({behavior:'smooth',block:'center'});return}
  },true);

  const style=document.createElement('style');
  style.textContent=`
    #egwShelf{position:relative}.egwNativeTitle{font-size:26px;margin-bottom:12px}.egwNativeTabs{display:grid;grid-template-columns:1fr 1fr;position:sticky;bottom:0;z-index:8;margin:16px 0 10px;background:var(--surface,#fff);border-top:1px solid var(--line,#ddd)}.egwNativeTabs button{border:0;border-radius:0;background:transparent;padding:14px 8px;font-size:16px;font-weight:700}.egwNativeTabs button.active{color:#a43a3a;background:rgba(80,110,130,.08)}.egwNativeSearch{width:100%;margin:8px 0 14px}.egwNativeBookList{display:block!important}.egwLetterGroup{margin:0}.egwLetterGroup h3{margin:0;padding:10px 4px 5px;font-size:18px}.egwBookRow,.egwChapterRow{width:100%;display:flex;align-items:center;justify-content:space-between;text-align:left;border:0;border-bottom:1px solid var(--line,#ddd);border-radius:0;background:transparent;padding:13px 8px;font-size:18px;min-height:50px}.egwBookRow i,.egwChapterRow i{font-size:30px;font-style:normal;color:#9aa1a7;font-weight:300}.egwLetterRail{position:fixed;right:max(5px,env(safe-area-inset-right));top:28%;z-index:6;display:flex;flex-direction:column;gap:0}.egwLetterRail a{font-size:10px;font-weight:700;line-height:1.25;color:var(--muted);text-decoration:none;padding:0 2px}.egwTocHeader{display:flex;align-items:center;justify-content:center;position:relative;border-bottom:1px solid var(--line,#ddd);margin:-6px -2px 8px;padding:3px 42px 10px}.egwTocHeader h1{font-size:20px;margin:0;text-align:center}.egwTocSearch{position:absolute;right:0;border:0;background:transparent;font-size:28px;padding:4px 8px}.egwChapterList{max-width:760px;margin:auto}@media(max-width:560px){.egwBookRow,.egwChapterRow{font-size:17px;padding:12px 5px}.egwLetterRail{right:2px}.egwNativeTabs{margin-bottom:0}.fullChapterSearch{padding:12px!important}}
  `;
  document.head.appendChild(style);
})();