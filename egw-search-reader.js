(() => {
  const $=id=>document.getElementById(id);
  const safe=s=>esc(String(s??''));
  const norm=s=>String(s||'').toLowerCase().replace(/[\s《》〈〉“”"'，。；：:、·.\-_/]/g,'');
  const score=(e,q)=>{
    const n=norm(q); if(!n)return 0;
    const fields=[
      [e.title_cn,9],[e.title,5],[e.chapter,8],[e.locator,4],
      ...((e.topics||[]).map(x=>[x,10])),...((e.bible_refs||[]).map(x=>[x,8])),[e.summary,5]
    ];
    return fields.reduce((s,[v,w])=>{const x=norm(v);return s+(x===n?w*3:x.includes(n)?w:n.includes(x)&&x.length>1?Math.ceil(w/2):0)},0);
  };
  function search(q){
    q=String(q||'').trim();
    const host=$('libraryList')||$('egwList'); if(!host)return;
    if(!q){host.innerHTML='<div class="empty">输入关键词，例如：安息日、信心、祷告、圣所、复临。</div>';return}
    const rows=(window.egw||[]).map(e=>({e,s:score(e,q)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,12);
    host.innerHTML=rows.length?rows.map(({e})=>`<button class="egw-hit" onclick="window.jgOpenEGWSource('${safe(e.id)}')"><div><b>${safe(e.title_cn||e.title||e.book_code)}</b><span>${safe(e.chapter||'')}</span><small>${safe(e.locator||'')}</small></div><span class="chev">›</span></button>`).join(''):`<div class="empty">没有找到“${safe(q)}”的本地核验出处。<div class="actions"><button onclick="window.open('https://text.egwwritings.org/search.php?lang=zh&query=${encodeURIComponent(q)}','_blank')">到官方继续搜索</button></div></div>`;
  }
  window.jgSearchEGW=search;

  function installSearch(){
    const lib=$('library');if(!lib)return;
    let box=$('jgEgwSimpleSearch');
    if(!box){box=document.createElement('div');box.id='jgEgwSimpleSearch';box.className='card egw-simple-search';box.innerHTML=`<div class="meta">预言之灵</div><h2>搜关键词，选择一条看原文</h2><div class="search-row"><input id="jgEgwKeyword" placeholder="例如：安息日、信心、祷告、圣所" onkeydown="if(event.key==='Enter')window.jgSearchEGW(this.value)"><button class="primary" onclick="window.jgSearchEGW($('jgEgwKeyword').value)">搜索</button></div><div class="chips"><button class="chip" onclick="$('jgEgwKeyword').value='安息日';window.jgSearchEGW('安息日')">安息日</button><button class="chip" onclick="$('jgEgwKeyword').value='信心';window.jgSearchEGW('信心')">信心</button><button class="chip" onclick="$('jgEgwKeyword').value='祷告';window.jgSearchEGW('祷告')">祷告</button><button class="chip" onclick="$('jgEgwKeyword').value='圣所';window.jgSearchEGW('圣所')">圣所</button></div>`;lib.insertBefore(box,lib.firstChild)}
    const list=$('libraryList')||$('egwList');if(list)list.innerHTML='<div class="empty">输入关键词开始搜索。</div>';
  }

  window.jgOpenEGWSource=id=>{
    const e=(window.egw||[]).find(x=>x.id===id);if(!e)return;
    current=e;
    rmeta.textContent='预言之灵 · 原始资料';
    rtitle.textContent=e.title_cn||e.title||e.book_code;
    rbody.innerHTML=`<div class="source-head"><b>${safe(e.chapter||'')}</b><span>${safe(e.locator||'')}</span></div>${e.original_text?`<div class="egw-original">${safe(e.original_text)}</div>`:`<div class="source-notice"><b>原文由官方来源提供</b><p>经光保存书名、章节和精确定位，不复制整本受版权保护著作。点下面“查看官方原文”即可打开对应原文位置并查看上下文。</p></div>`}${(e.bible_refs||[]).length?`<div class="meta">相关经文</div><div class="chips">${e.bible_refs.map(x=>`<button class="chip" onclick="closeReader();quick('${safe(x)}')">${safe(x)}</button>`).join('')}</div>`:''}`;
    rtools.innerHTML=`<button class="primary" onclick="window.open('${safe(e.source_url)}','_blank')">查看官方原文</button><button onclick="window.jgAddEGWToActive('${safe(e.id)}')">＋当前讲章</button><button onclick="window.jgToggleFavorite&&window.jgToggleFavorite('egw','${safe(e.id)}','${safe('《'+(e.title_cn||e.title)+'》 '+(e.locator||''))}','${safe((e.bible_refs||[])[0]||e.title_cn||e.title)}')">☆ 收藏</button>`;
    readerAction.style.display='none';reader.style.display='block';
  };

  const oldGo=window.go;
  window.go=function(id){oldGo(id);if(id==='library')setTimeout(installSearch,0)};
  function styles(){const s=document.createElement('style');s.textContent=`.egw-simple-search h2{margin:5px 0 12px}.egw-hit{width:100%;display:flex;align-items:center;justify-content:space-between;text-align:left;background:var(--card);border:1px solid var(--line);color:var(--text);border-radius:14px;padding:14px;margin:8px 0}.egw-hit div{min-width:0}.egw-hit b,.egw-hit span,.egw-hit small{display:block}.egw-hit b{font-size:15px}.egw-hit span{font-size:12px;margin-top:4px}.egw-hit small{font-size:11px;color:var(--muted);margin-top:3px}.egw-hit .chev{font-size:26px;color:var(--gold);margin-left:12px}.source-head{padding-bottom:12px;border-bottom:1px solid var(--line);margin-bottom:14px}.source-head b,.source-head span{display:block}.source-head span{font-size:12px;color:var(--muted);margin-top:4px}.source-notice{padding:16px;border-radius:13px;background:rgba(216,182,108,.08);border:1px solid rgba(216,182,108,.22);margin-bottom:16px}.source-notice p{margin:7px 0 0}.egw-original{font-size:17px;line-height:1.9;white-space:pre-wrap;margin-bottom:18px}@media(max-width:560px){.egw-hit{padding:13px 12px;min-height:68px}.egw-simple-search .search-row{position:sticky;top:0;z-index:3;background:var(--bg);padding:5px 0}}`;document.head.appendChild(s)}
  styles();
})();