(() => {
  'use strict';
  const detail=document.getElementById('detail'),body=document.getElementById('detailBody'),type=document.getElementById('detailType'),actions=document.getElementById('detailActions');
  const shelf=document.getElementById('egwBooks');
  if(!detail||!body||!type||!actions||!shelf)return;
  let books=[];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const initial=s=>{const t=String(s||'').trim().replace(/^[《\d\s]+/,'');const ch=t[0]||'#';return /[A-Za-z]/.test(ch)?ch.toUpperCase():'#'};
  fetch('./data/egw-official-books.json',{cache:'no-store'}).then(r=>r.json()).then(j=>{books=j.books||[];renderBooks(books)}).catch(()=>{});

  function openDialog(){if(!detail.open)detail.showModal();detail.scrollTop=0}
  function renderBooks(list){
    if(!list?.length)return;
    const groups=new Map();
    for(const b of list){const k=initial(b.title_cn);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(b)}
    const keys=[...groups.keys()].sort((a,b)=>a.localeCompare(b,'zh-Hans-CN'));
    shelf.classList.add('egwNativeList');
    shelf.innerHTML=keys.map(k=>`<section class="egwAlphaGroup"><h3>${esc(k)}</h3>${groups.get(k).map(b=>`<button class="egwBookRow" data-egw-book-id="${esc(b.id)}"><span>${esc(b.title_cn)}</span><b>›</b></button>`).join('')}</section>`).join('');
  }
  async function openBook(id){
    const b=books.find(x=>String(x.id)===String(id));if(!b)return;
    type.textContent='怀爱伦著作';
    body.innerHTML=`<div class="nativeBookHead"><button data-egw-back-library>‹ 返回</button><h1>${esc(b.title_cn)}</h1></div><div class="empty">正在读取章节目录…</div>`;
    actions.innerHTML=`<button data-official-url="${esc(b.toc_url)}">查看官方目录</button>`;openDialog();
    try{
      const r=await fetch(`/api/egw-read?toc=1&url=${encodeURIComponent(b.toc_url)}`,{cache:'no-store'}),j=await r.json();
      if(!r.ok||!j.ok)throw new Error(j.error||'toc_failed');
      const chapters=j.chapters||[];
      body.innerHTML=`<div class="nativeBookHead"><button data-egw-back-library>‹ 返回</button><h1>${esc(b.title_cn)}</h1></div>${chapters.length?`<div class="egwChapterList">${chapters.map((c,i)=>`<button class="egwChapterRow" data-egw-native-url="${esc(c.url)}" data-egw-chapter-title="${esc(c.title)}" data-egw-book-title="${esc(b.title_cn)}"><span>${esc(c.title)}</span><b>›</b></button>`).join('')}</div>`:`<div class="empty">暂时没有解析到章节目录。可用下方按钮核对官方目录。</div>`}`;
    }catch(e){
      body.innerHTML=`<div class="nativeBookHead"><button data-egw-back-library>‹ 返回</button><h1>${esc(b.title_cn)}</h1></div><div class="empty">章节目录暂时无法读取。可用下方按钮查看官方目录。</div>`;
    }
  }
  document.addEventListener('click',e=>{
    const book=e.target.closest('[data-egw-book-id]');
    if(book){e.preventDefault();e.stopImmediatePropagation();openBook(book.dataset.egwBookId);return}
    const legacy=e.target.closest('[data-official-id]');
    if(legacy){e.preventDefault();e.stopImmediatePropagation();openBook(legacy.dataset.officialId);return}
    const back=e.target.closest('[data-egw-back-library]');
    if(back){e.preventDefault();detail.close();return}
    const chapter=e.target.closest('[data-egw-chapter-title]');
    if(chapter&&window.jgOpenNativeEgw){e.preventDefault();e.stopImmediatePropagation();window.jgOpenNativeEgw(chapter.dataset.egwNativeUrl,{title:`《${chapter.dataset.egwBookTitle||'怀爱伦著作'}》`,chapter:chapter.dataset.egwChapterTitle||''});}
  },true);
  const input=document.getElementById('egwBookSearch');
  input?.addEventListener('input',()=>{const q=input.value.trim().toLowerCase();renderBooks(!q?books:books.filter(b=>String(b.title_cn||'').toLowerCase().includes(q)))});
  const style=document.createElement('style');
  style.textContent=`
    #egwBooks.egwNativeList{display:block!important;border-top:1px solid var(--line);margin-top:10px}
    .egwAlphaGroup{margin:0}.egwAlphaGroup h3{font-size:16px;margin:18px 4px 6px;color:var(--muted)}
    .egwBookRow,.egwChapterRow{width:100%;display:flex;align-items:center;justify-content:space-between;text-align:left;background:transparent;border:0;border-bottom:1px solid var(--line);border-radius:0;padding:14px 6px;font:inherit;min-height:50px}
    .egwBookRow span,.egwChapterRow span{font-size:17px;font-weight:600;line-height:1.35}.egwBookRow b,.egwChapterRow b{font-size:28px;color:var(--muted);font-weight:400}
    .nativeBookHead{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;position:sticky;top:0;background:var(--bg);z-index:2;padding:4px 0 10px;border-bottom:1px solid var(--line)}
    .nativeBookHead h1{text-align:center;font-size:18px;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nativeBookHead button{border:0;background:transparent;padding:8px 0;font:inherit}
    .egwChapterList{margin-top:8px}
    @media(max-width:560px){#egwShelf>h2:first-child{font-size:20px}.egwBookRow,.egwChapterRow{padding:13px 3px}.egwBookRow span,.egwChapterRow span{font-size:18px}}
  `;
  document.head.appendChild(style);
})();
