(() => {
  const $=id=>document.getElementById(id);
  const RECENT='jg_recent_studies', FAV='jg_favorites';
  const cats=['圣经依据','预言之灵','例证','应用','结尾','未分类'];
  const read=(k,d=[])=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch{return d}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const now=()=>new Date().toISOString();
  const safe=s=>esc(String(s??''));
  const activeId=()=>localStorage.getItem('jg_active_sermon')||'';
  const allProjects=()=>getProjects().map(normalizeProject);
  const activeProject=()=>allProjects().find(p=>String(p.id)===String(activeId()))||null;

  function remember(q){
    q=String(q||'').trim(); if(!q)return;
    let a=read(RECENT,[]).filter(x=>x.q!==q);a.unshift({q,at:now()});write(RECENT,a.slice(0,12));renderHomeTools();
  }
  function favorites(){return read(FAV,[])}
  function isFav(type,key){return favorites().some(x=>x.type===type&&x.key===key)}
  function toggleFav(item){let a=favorites(),i=a.findIndex(x=>x.type===item.type&&x.key===item.key);if(i>=0)a.splice(i,1);else a.unshift({...item,at:now()});write(FAV,a.slice(0,100));renderHomeTools();return i<0}
  window.jgToggleFavorite=(type,key,label,query)=>{const added=toggleFav({type,key,label,query});alert(added?'已收藏':'已取消收藏')};

  function renderHomeTools(){
    const home=$('home');if(!home)return;
    let box=$('jgHomeTools');if(!box){box=document.createElement('div');box.id='jgHomeTools';box.className='section';home.appendChild(box)}
    const rec=read(RECENT,[]),fav=favorites();
    box.innerHTML=`<div class="section-head"><h2>继续研经</h2><span>最近与收藏</span></div><div class="card">${rec.length?`<div class="meta">最近研究</div><div class="chips">${rec.slice(0,8).map(x=>`<button class="chip" onclick="quick('${safe(x.q)}')">${safe(x.q)}</button>`).join('')}</div>`:'<p class="muted">查过的经文和主题会自动留在这里。</p>'}${fav.length?`<div class="meta" style="margin-top:14px">收藏</div><div class="chips">${fav.slice(0,10).map(x=>`<button class="chip" onclick="quick('${safe(x.query||x.label)}')">★ ${safe(x.label)}</button>`).join('')}</div>`:''}</div>`;
  }

  async function bibleSearch(q){
    q=String(q||'').trim();if(!q)return;
    const host=$('studyResult');if(!host)return;
    host.innerHTML=`<div class="card"><div class="meta">中文圣经全文搜索</div><h3>“${safe(q)}”</h3><p id="jgSearchProgress" class="muted">正在搜索 66 卷和合本…</p></div><div id="jgBibleSearchHits"></div>`;
    const hits=[];let done=0;const limit=80,queue=[...bibleBooks];
    async function worker(){while(queue.length&&hits.length<limit){const [osis,full,short]=queue.shift();try{const book=await loadBibleBook(osis);for(let ci=0;ci<(book.chapters||[]).length&&hits.length<limit;ci++){const verses=chapterFromBook(book,ci+1);for(const v of verses){if(String(v.text||'').includes(q)){const vn=Number(v.number??v.verse);hits.push({osis,full,short,chapter:ci+1,verse:vn,text:v.text});if(hits.length>=limit)break}}}}catch(e){console.warn('search book failed',osis,e)}done++;const p=$('jgSearchProgress');if(p)p.textContent=`已搜索 ${done}/66 卷 · 找到 ${hits.length} 处`}}
    await Promise.all(Array.from({length:6},worker));
    const out=$('jgBibleSearchHits');if(out)out.innerHTML=hits.length?hits.map(h=>`<div class="result"><div class="meta">${safe(h.full)} ${h.chapter}:${h.verse}</div><p class="verse-text">${safe(h.text)}</p><div class="actions"><button class="primary" onclick="window.jgStudyCrossref('${safe(h.short)}${h.chapter}:${h.verse}')">研读这节</button><button onclick="window.jgAddBibleToActive('${safe(h.full)} ${h.chapter}:${h.verse}','${safe(h.verse+' '+h.text)}')">＋当前讲章</button><button onclick="window.jgToggleFavorite('bible','${safe(h.osis+'.'+h.chapter+'.'+h.verse)}','${safe(h.short+h.chapter+':'+h.verse)}','${safe(h.short+h.chapter+':'+h.verse)}')">☆ 收藏</button></div></div>`).join(''):'<div class="empty">整本和合本没有找到这个词。可以换同义词或主题词。</div>';
    const p=$('jgSearchProgress');if(p)p.textContent=`搜索完成 · ${hits.length} 处${hits.length>=limit?'（先显示前80处）':''}`;
  }
  window.jgBibleFullTextSearch=bibleSearch;

  function normalizeMaterial(m){m.category=m.category||((m.type==='bible')?'圣经依据':(m.type==='egw'?'预言之灵':'未分类'));m.order=Number.isFinite(m.order)?m.order:0;return m}
  function saveProjectEdit(id,patch){let a=allProjects(),p=a.find(x=>String(x.id)===String(id));if(!p)return;Object.assign(p,patch,{updated_at:now()});saveProjects(a)}
  window.jgSaveProjectField=(id,key,val)=>saveProjectEdit(id,{[key]:val});
  window.jgSetMaterialCategory=(pid,mid,val)=>{let a=allProjects(),p=a.find(x=>String(x.id)===String(pid));if(!p)return;let m=(p.materials||[]).find(x=>x.id===mid);if(!m)return;m.category=val;p.updated_at=now();saveProjects(a)};
  window.jgMoveMaterial=(pid,mid,dir)=>{let a=allProjects(),p=a.find(x=>String(x.id)===String(pid));if(!p)return;let ms=p.materials||[],i=ms.findIndex(x=>x.id===mid),j=i+Number(dir);if(i<0||j<0||j>=ms.length)return;[ms[i],ms[j]]=[ms[j],ms[i]];p.updated_at=now();saveProjects(a)};
  window.jgRemoveProjectMaterial=(pid,mid)=>{let a=allProjects(),p=a.find(x=>String(x.id)===String(pid));if(!p)return;p.materials=(p.materials||[]).filter(x=>x.id!==mid);p.updated_at=now();saveProjects(a)};

  function projectEditor(p){
    p.core_bible_refs=p.core_bible_refs||[];p.outline=p.outline||[];p.application=p.application||'';p.appeal=p.appeal||'';p.opening=p.opening||'';
    const mats=(p.materials||[]).map(normalizeMaterial);
    const grouped=cats.map(c=>[c,mats.filter(m=>m.category===c)]).filter(x=>x[1].length);
    return `<div class="result project sermon-editor"><div class="meta">${String(p.id)===String(activeId())?'当前讲章 · ':''}${statusLabel(p.status)} · 自动保存</div><div class="field"><label>讲章题目</label><input value="${safe(p.title)}" onchange="window.jgSaveProjectField('${safe(p.id)}','title',this.value)"></div><div class="editor-grid"><div class="field"><label>核心经文</label><input value="${safe((p.core_bible_refs||[]).join('；'))}" placeholder="例如：约3:16；罗5:8" onchange="window.jgSaveProjectField('${safe(p.id)}','core_bible_refs',this.value.split(/[；;,，]/).map(x=>x.trim()).filter(Boolean))"></div><div class="field"><label>听众 / 时长</label><div class="muted">${safe(p.audience)} · ${p.duration_minutes}分钟</div></div></div><div class="field"><label>开场</label><textarea onchange="window.jgSaveProjectField('${safe(p.id)}','opening',this.value)" placeholder="为什么今天要讲这个主题？">${safe(p.opening)}</textarea></div><div class="field"><label>讲道结构（每行一个要点）</label><textarea onchange="window.jgSaveProjectField('${safe(p.id)}','outline',this.value.split('\n').map(x=>x.trim()).filter(Boolean))" placeholder="一、…\n二、…\n三、…">${safe((p.outline||[]).join('\n'))}</textarea></div><div class="field"><label>应用</label><textarea onchange="window.jgSaveProjectField('${safe(p.id)}','application',this.value)">${safe(p.application)}</textarea></div><div class="field"><label>呼召 / 结尾</label><textarea onchange="window.jgSaveProjectField('${safe(p.id)}','appeal',this.value)">${safe(p.appeal)}</textarea></div><div class="field"><label>研究笔记</label><textarea onchange="window.jgSaveProjectField('${safe(p.id)}','research_notes',this.value)">${safe(p.research_notes||'')}</textarea></div><div class="section-head" style="margin-top:15px"><h2>讲章材料</h2><span>${mats.length} 条</span></div>${grouped.length?grouped.map(([c,ms])=>`<div class="material-group"><div class="meta">${safe(c)} · ${ms.length}</div>${ms.map(m=>`<div class="material-row"><div><b>${safe(m.label||m.locator||m.source_id)}</b>${m.note?`<p>${safe(m.note)}</p>`:''}</div><div class="material-tools"><select onchange="window.jgSetMaterialCategory('${safe(p.id)}','${safe(m.id)}',this.value)">${cats.map(x=>`<option ${x===m.category?'selected':''}>${x}</option>`).join('')}</select><button onclick="window.jgMoveMaterial('${safe(p.id)}','${safe(m.id)}',-1)">↑</button><button onclick="window.jgMoveMaterial('${safe(p.id)}','${safe(m.id)}',1)">↓</button><button onclick="window.jgRemoveProjectMaterial('${safe(p.id)}','${safe(m.id)}')">移除</button></div></div>`).join('')}</div>`).join(''):'<div class="empty">还没有材料。研经时点“＋当前讲章”。</div>'}<div class="actions"><button onclick="attachBasket('${safe(p.id)}')">把材料篮加入项目</button>${String(p.id)===String(activeId())?'<button class="primary" disabled>当前讲章</button>':`<button onclick="window.jgSetActiveProject('${safe(p.id)}')">设为当前讲章</button>`}<button onclick="deleteProject('${safe(p.id)}')">删除</button></div></div>`;
  }

  const baseRenderProjects=renderProjects;
  renderProjects=function(){const a=allProjects();projectsList.innerHTML=a.length?a.map(projectEditor).join(''):'<div class="empty">还没有讲章项目。</div>';if(typeof renderActiveBar==='function')renderActiveBar()};

  async function openChapter(osis,chapter){
    const b=bibleBooks.find(x=>x[0]===osis);if(!b)return;const book=await loadBibleBook(osis),total=(book.chapters||[]).length;if(chapter<1||chapter>total)return;
    const verses=chapterFromBook(book,chapter);current=null;readerAction.style.display='none';rmeta.textContent='圣经 · 和合本简体';rtitle.textContent=`${b[1]} ${chapter}章`;
    rbody.innerHTML=`<div class="chapter-nav"><button ${chapter<=1?'disabled':''} onclick="window.jgOpenChapter('${safe(osis)}',${chapter-1})">← 上一章</button><button onclick="window.jgToggleFavorite('bible-chapter','${safe(osis+'.'+chapter)}','${safe(b[2]+chapter+'章')}','${safe(b[2]+chapter)}')">☆ 收藏本章</button><button ${chapter>=total?'disabled':''} onclick="window.jgOpenChapter('${safe(osis)}',${chapter+1})">下一章 →</button></div>${verses.map(v=>{const n=v.number??v.verse,label=`${b[1]} ${chapter}:${n}`,q=`${b[2]}${chapter}:${n}`;return `<div class="verse verse-action"><div class="verse-num">${safe(n)}</div><div><div class="verse-text">${safe(v.text)}</div><div class="verse-tools"><button onclick="window.jgStudyCrossref('${safe(q)}');closeReader()">研读</button><button onclick="window.jgAddBibleToActive('${safe(label)}','${safe(n+' '+v.text)}')">＋讲章</button><button onclick="window.jgToggleFavorite('bible','${safe(osis+'.'+chapter+'.'+n)}','${safe(q)}','${safe(q)}')">☆</button></div></div></div>`}).join('')}`;
    rtools.innerHTML='';reader.style.display='block';
  }
  window.jgOpenChapter=openChapter;openBible=(osis,chapter)=>openChapter(osis,chapter).catch(()=>alert('这一章暂时读取失败'));

  const baseRun=runStudy;
  runStudy=async function(id){const q=$(id)?.value?.trim()||'';remember(q);await baseRun(id);const ref=parseBibleRef(q),host=$('studyResult');if(!host)return;if(ref){const first=host.querySelector('.card');if(first&&!first.querySelector('[data-fav-passage]')){const a=document.createElement('div');a.className='actions';const label=`${ref.short}${ref.chapter}${ref.from?':'+ref.from+(ref.to!==ref.from?'-'+ref.to:''):''}`;a.innerHTML=`<button data-fav-passage onclick="window.jgToggleFavorite('bible-passage','${safe(ref.osis+'.'+ref.chapter+'.'+(ref.from||''))}','${safe(label)}','${safe(label)}')">☆ 收藏</button>`;first.appendChild(a)}}else{const topic=host.querySelector('.card');if(topic&&!topic.querySelector('[data-full-search]')){const a=document.createElement('div');a.className='actions';a.innerHTML=`<button data-full-search class="primary" onclick="window.jgBibleFullTextSearch('${safe(q)}')">在整本圣经搜索“${safe(q)}”</button>`;topic.appendChild(a)}}};

  const baseEGW=egwCard;
  egwCard=e=>{let h=baseEGW(e);const fav=`<button onclick="window.jgToggleFavorite('egw','${safe(e.id)}','${safe('《'+(e.title_cn||e.title)+'》 '+(e.locator||''))}','${safe((e.bible_refs||[])[0]||e.title_cn||e.title)}')">☆ 收藏</button>`;return h.replace('</div></div>',`${fav}</div></div>`)};

  function installStyles(){const s=document.createElement('style');s.textContent=`.sermon-editor{padding:16px}.editor-grid{display:grid;grid-template-columns:1.4fr .8fr;gap:10px}.sermon-editor textarea{min-height:76px}.material-group{margin-top:12px;border-top:1px solid var(--line);padding-top:10px}.material-row{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(40,58,88,.45)}.material-row b{font-size:12px}.material-row p{font-size:11px}.material-tools{display:flex;gap:4px;align-items:center}.material-tools select,.material-tools button,.verse-tools button,.chapter-nav button{border:1px solid var(--line);background:#14233a;color:#fff;border-radius:9px;padding:6px 7px;font-size:10px}.material-tools select{max-width:92px}.verse-action{grid-template-columns:30px 1fr}.verse-tools{display:flex;gap:5px;margin-top:4px}.chapter-nav{position:sticky;top:52px;z-index:4;display:flex;justify-content:space-between;gap:6px;background:rgba(7,16,29,.95);padding:8px 0 10px}.chapter-nav button{flex:1}.chapter-nav button:disabled{opacity:.35}@media(max-width:560px){.editor-grid{grid-template-columns:1fr}.material-row{grid-template-columns:1fr}.material-tools{flex-wrap:wrap}.material-tools select{max-width:none;flex:1}.sermon-editor{padding:13px}.verse-tools button{padding:6px 9px}}`;document.head.appendChild(s)}

  installStyles();renderHomeTools();
})();
