(() => {
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  function installStyle(){
    const s=document.createElement('style');
    s.textContent=`
      button,input,select,textarea{touch-action:manipulation}
      button{min-height:36px}.chip{min-height:34px}.actions button{min-height:38px}
      .readerbar{z-index:5;backdrop-filter:blur(16px)}
      .sermon-collapse-btn{width:100%;margin:9px 0 0;border:1px solid var(--line);background:#14233a;color:#fff;border-radius:10px;padding:9px;font-size:11px}
      .sermon-editor.jg-collapsed>.field,.sermon-editor.jg-collapsed>.editor-grid,.sermon-editor.jg-collapsed>.section-head,.sermon-editor.jg-collapsed>.material-group,.sermon-editor.jg-collapsed>.empty{display:none!important}
      .sermon-editor.jg-collapsed{padding-bottom:12px}.sermon-editor.jg-collapsed>.actions{margin-top:8px}
      @media(max-width:560px){
        body{padding-bottom:env(safe-area-inset-bottom)}
        .readerbar{top:0;padding-top:max(8px,env(safe-area-inset-top))}
        .field input,.field textarea,.field select{font-size:16px}
        .sermon-editor{padding:13px}.sermon-editor textarea{min-height:92px}
        .material-tools{width:100%;justify-content:flex-start}.material-tools select{flex:1;min-width:0}
        .chapter-nav{position:sticky;top:52px;z-index:4;background:rgba(7,16,29,.94);padding:6px 0}
        .verse-tools button{min-height:34px;padding:7px 9px}
        .active-sermon-bar{bottom:calc(68px + env(safe-area-inset-bottom))}
        .bottom{bottom:calc(7px + env(safe-area-inset-bottom))}
      }
    `;
    document.head.appendChild(s);
  }
  function collapseProjects(){
    const active=localStorage.getItem('jg_active_sermon')||'';
    $$('.sermon-editor').forEach(card=>{
      const isActive=(card.querySelector('.meta')?.textContent||'').includes('当前讲章');
      if(!isActive)card.classList.add('jg-collapsed');
      if(card.querySelector('.sermon-collapse-btn'))return;
      const btn=document.createElement('button');btn.className='sermon-collapse-btn';
      btn.textContent=isActive?'收起编辑区':'展开编辑';
      btn.onclick=()=>{card.classList.toggle('jg-collapsed');btn.textContent=card.classList.contains('jg-collapsed')?'展开编辑':'收起编辑区'};
      const h=card.querySelector('h3')||card.querySelector('.field');
      if(h)h.insertAdjacentElement('afterend',btn);else card.prepend(btn);
    });
  }
  function wireProjectRender(){
    if(typeof renderProjects!=='function')return;
    const base=renderProjects;
    renderProjects=function(){base();setTimeout(collapseProjects,0)};
    if(document.getElementById('projects')?.classList.contains('active'))setTimeout(collapseProjects,0);
  }
  function readerVisibility(){
    const r=document.getElementById('reader'),bar=document.getElementById('activeSermonBar');if(!r||!bar)return;
    const obs=new MutationObserver(()=>{bar.style.display=r.style.display==='block'?'none':''});obs.observe(r,{attributes:true,attributeFilter:['style']});
  }
  installStyle();wireProjectRender();readerVisibility();
})();
