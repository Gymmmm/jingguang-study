(() => {
  'use strict';

  const cleanKeyword=value=>{
    let q=String(value||'').trim();
    q=q.replace(/^(请)?(查|搜索|找|看看|帮我查)?\s*/,'');
    q=q.replace(/怀爱伦(的)?|怀著(的)?|怀师母(的)?|预言之灵(的)?/g,' ');
    q=q.replace(/关于|里面|怎么说|如何说|怎样说|怎么看|怎样看|相关内容|相关资料/g,' ');
    return q.replace(/\s+/g,' ').trim();
  };

  const synonymMap={
    '复临':['基督复临','第二次降临','再来','主再来'],'再来':['基督复临','第二次降临','复临'],'圣所':['天上圣所','二千三百日'],'安息日':['第七日','守安息日'],'祷告':['祈祷','祈求'],'信心':['信靠','因信称义'],'救赎':['救恩','基督救赎'],'三天使':['三天使信息'],'健康':['健康改革','节制']
  };
  const needlesFor=value=>{const q=cleanKeyword(value),base=[norm(q),...q.split(/[\s,，。；;、/]+/).map(norm)].filter(Boolean),extra=[];for(const p of base)for(const[k,list]of Object.entries(synonymMap))if(p===norm(k))extra.push(...list.map(norm));return [...new Set([...base,...extra])];};
  const hit=(text,needles)=>{const t=norm(text);return !!t&&needles.some(n=>n&&(t===n||t.includes(n)))};

  egwSearch=function strictEgwSearch(q){const cleaned=cleanKeyword(q)||q,ref=parse(cleaned)||parse(q),needles=needlesFor(cleaned);if(ref)return S.egw.filter(e=>(e.bible_refs||[]).some(v=>overlap(ref,parseAny(v))));return S.egw.map(e=>{let s=0;if(hit(e.title_cn,needles))s+=140;if(hit(e.title,needles))s+=100;if(hit(e.chapter,needles))s+=130;for(const t of e.topics||[])if(hit(t,needles))s+=150;if(hit(e.summary,needles))s+=55;return{e,s}}).filter(x=>x.s>=100).sort((a,b)=>b.s-a.s).map(x=>x.e)};
  egwBookSearch=function strictEgwBookSearch(q){const n=norm(q),generic=['怀爱伦','怀著','怀师母','预言之灵','ellenwhite'].some(x=>n===norm(x));if(!n||generic)return [...S.egwBooks];return S.egwBooks.filter(b=>{const t=norm(b.title_cn);return t===n||t.includes(n)})};

  // EGW Writings currently reads the search term from uppercase QUERY.
  const officialSearchUrl=q=>`https://text.egwwritings.org/search.php?QUERY=${encodeURIComponent(q)}&lang=zh`;
  const oldSearch=search;
  function fullChapterCard(q,hasLocal){const card=document.createElement('article');card.className='card egwFullChapterSearch';card.dataset.kind='egw';card.dataset.egwOfficialSearch='1';card.innerHTML=`<div class="top"><span class="badge egw">全文搜索</span><span class="title">搜索怀爱伦全部中文章节：${esc(q)}</span></div><div class="snippet">点击后进入官方中文全文结果，选一条即可看对应原文和上下文。${hasLocal?' 下方只保留真正命中的本地出处。':''}</div><div class="actions"><button class="primary" data-official-url="${esc(officialSearchUrl(q))}">搜索全部章节</button></div>`;return card}
  search=async function keywordSearch(q){const raw=String(q||'').trim();if(!raw)return;const cleaned=cleanKeyword(raw)||raw;await oldSearch(cleaned);const host=document.getElementById('studyResults');if(!host)return;host.querySelector('[data-egw-official-search]')?.remove();const hasLocal=!!host.querySelector('[data-egw]');const card=fullChapterCard(cleaned,hasLocal);const first=host.querySelector('.groupTitle[data-kind="egw"], [data-kind="egw"]');if(first)host.insertBefore(card,first);else host.appendChild(card);filter()};

  function bindFullChapterSearch(){const box=document.getElementById('egwAllChapterSearch');if(!box||box.dataset.bound==='1')return;box.dataset.bound='1';box.addEventListener('submit',e=>{e.preventDefault();const q=cleanKeyword(new FormData(box).get('q'));if(!q)return;const btn=document.createElement('button');btn.dataset.officialUrl=officialSearchUrl(q);btn.hidden=true;document.body.appendChild(btn);btn.click();btn.remove()})}
  function installFullChapterSearch(){const shelf=document.getElementById('egwShelf');if(!shelf)return;let box=document.getElementById('egwAllChapterSearch');if(!box){box=document.createElement('form');box.id='egwAllChapterSearch';box.className='fullChapterSearch';box.innerHTML=`<div><span class="badge egw">关键词搜索</span><b>搜索怀爱伦全部章节</b><small>输入主题或词语，搜索全部中文怀著正文，不是只搜书名。</small></div><div class="fullChapterSearchRow"><input name="q" placeholder="例如：安息日、信心、祷告、圣所"><button class="primary">搜索怀著</button></div>`;const title=shelf.querySelector('h2');if(title)title.insertAdjacentElement('afterend',box);else shelf.prepend(box)}bindFullChapterSearch();const bookInput=document.getElementById('egwBookSearch');if(bookInput)bookInput.placeholder='这里只搜书名，例如：历代愿望、善恶之争'}
  const observer=new MutationObserver(installFullChapterSearch);observer.observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('DOMContentLoaded',installFullChapterSearch);setTimeout(installFullChapterSearch,0);
  const style=document.createElement('style');style.textContent=`.fullChapterSearch{margin:12px 0 18px;padding:16px;border:2px solid #2e5578;border-radius:14px;background:#eef4f8}.fullChapterSearch>div:first-child{display:flex;flex-direction:column;gap:5px;margin-bottom:11px}.fullChapterSearch .badge{align-self:flex-start}.fullChapterSearch b{font-size:17px}.fullChapterSearch small{color:var(--muted)}.fullChapterSearchRow{display:grid;grid-template-columns:1fr auto;gap:8px}.egwFullChapterSearch{border:2px solid #2e5578;background:#eef4f8}.egwFullChapterSearch .title{font-size:16px}@media(max-width:560px){.fullChapterSearchRow{grid-template-columns:1fr}.fullChapterSearchRow button{min-height:44px}}`;document.head.appendChild(style);
})();