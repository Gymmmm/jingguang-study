(() => {
  const ACTIVE_KEY='jg_active_sermon';
  const $=id=>document.getElementById(id);
  const activeId=()=>localStorage.getItem(ACTIVE_KEY)||'';
  const projects=()=>getProjects().map(normalizeProject);
  const activeProject=()=>projects().find(p=>String(p.id)===String(activeId()))||null;
  const saveAll=a=>saveProjects(a);
  const setActive=id=>{if(id)localStorage.setItem(ACTIVE_KEY,String(id));else localStorage.removeItem(ACTIVE_KEY);renderActiveBar();renderProjects();};
  const esc2=s=>esc(String(s??''));
  function ensureActive(){const p=activeProject();if(p)return p;const a=projects();if(a.length){setActive(a[0].id);return a[0]}return null}
  function materialExists(p,sourceId,type='egw'){return (p.materials||[]).some(m=>m.source_id===sourceId&&m.type===type)}
  function addMaterialToActive(m){const p=ensureActive();if(!p){go('projects');alert('先建立一个讲章项目');return false}const a=projects(),t=a.find(x=>String(x.id)===String(p.id));if(!t)return false;t.materials=t.materials||[];if(!materialExists(t,m.source_id,m.type))t.materials.push(m);t.updated_at=new Date().toISOString();saveAll(a);renderActiveBar();return true}
  window.jgSetActiveProject=id=>setActive(id);
  window.jgAddEGWToActive=id=>{const m=snapshotMaterial(id);if(m&&addMaterialToActive(m))alert(`已加入「${activeProject()?.title||'当前讲章'}」`)};
  window.jgAddBibleToActive=(label,text)=>{const m={id:`mat-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,type:'bible',source_id:`bible:${label}`,label,locator:label,verified:true,note:'',source_url:'',bible_refs:[label],text};if(addMaterialToActive(m))alert(`经文已加入「${activeProject()?.title||'当前讲章'}」`)};
  window.jgUseBasketInActive=()=>{const p=ensureActive();if(!p){go('projects');return}attachBasket(p.id);renderActiveBar();alert(`材料篮已加入「${p.title}」`)};
  function renderActiveBar(){let bar=$('activeSermonBar');const p=activeProject();if(!bar){bar=document.createElement('div');bar.id='activeSermonBar';bar.className='active-sermon-bar';document.body.appendChild(bar)}if(!p){bar.innerHTML='<button onclick="go(\'projects\')"><b>当前讲章</b><span>尚未建立 · 点这里开始</span></button>';return}bar.innerHTML=`<button onclick="go('projects')"><b>当前讲章</b><span>${esc2(p.title)} · ${p.materials?.length||0} 条材料</span></button><button class="mini" onclick="window.jgUseBasketInActive()">＋材料篮</button>`}
  function installStyles(){const s=document.createElement('style');s.textContent=`.active-sermon-bar{position:fixed;left:50%;bottom:74px;transform:translateX(-50%);z-index:29;width:min(92%,760px);display:flex;gap:7px;pointer-events:none}.active-sermon-bar button{pointer-events:auto;flex:1;border:1px solid rgba(216,182,108,.4);background:rgba(13,25,43,.96);color:#fff;border-radius:14px;padding:9px 12px;text-align:left;box-shadow:0 8px 28px rgba(0,0,0,.22);backdrop-filter:blur(14px)}.active-sermon-bar b{display:block;color:var(--gold);font-size:10px}.active-sermon-bar span{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}.active-sermon-bar .mini{flex:0 0 auto;width:auto;text-align:center;font-size:11px;color:var(--gold)}@media(max-width:560px){.active-sermon-bar{bottom:69px;width:94%}.active-sermon-bar button{padding:8px 10px}.active-sermon-bar .mini{display:none}.app{padding-bottom:145px!important}}`;document.head.appendChild(s)}
  const baseEgwCard=egwCard;
  egwCard=e=>{let html=baseEgwCard(e);const extra=`<button onclick="window.jgAddEGWToActive('${esc2(e.id)}')">＋当前讲章</button>`;return html.replace('</div></div>',`${extra}</div></div>`)};
  const baseRun=runStudy;
  runStudy=async function(id){await baseRun(id);const q=$(id)?.value?.trim()||'',ref=parseBibleRef(q),host=$('studyResult');if(ref&&host){try{const p=await biblePassage(ref);const label=`${ref.full} ${ref.chapter}${ref.from?':'+ref.from+(ref.to!==ref.from?'–'+ref.to:''):''}`;const text=(p.verses||[]).map(v=>`${v.number??v.verse} ${v.text}`).join('\n');const first=host.querySelector('.card');if(first&&!first.querySelector('[data-add-bible-active]')){const a=document.createElement('div');a.className='actions';a.innerHTML=`<button data-add-bible-active class="primary" onclick='window.jgAddBibleToActive(${JSON.stringify(label)},${JSON.stringify(text)})'>＋加入当前讲章</button>`;first.appendChild(a)}}catch(e){console.warn(e)}}renderActiveBar()};
  const baseCreate=createProject;
  createProject=function(){const before=projects().map(x=>x.id);baseCreate();const after=projects();const fresh=after.find(x=>!before.includes(x.id));if(fresh)setActive(fresh.id);renderActiveBar()};
  const baseRenderProjects=renderProjects;
  renderProjects=function(){baseRenderProjects();const a=projects();const host=$('projectsList');if(!host)return;host.querySelectorAll('.result.project').forEach((card,i)=>{const p=a[i];if(!p)return;const act=document.createElement('div');act.className='actions';act.innerHTML=String(p.id)===String(activeId())?'<button class="primary" disabled>当前讲章</button>':`<button onclick="window.jgSetActiveProject('${esc2(p.id)}')">设为当前讲章</button>`;card.insertBefore(act,card.querySelector('.field')||card.lastChild)});renderActiveBar()};
  installStyles();ensureActive();renderActiveBar();
})();
