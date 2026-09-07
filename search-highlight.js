(() => {
  'use strict';

  const synonymMap={
    '复临':['基督复临','第二次降临','再来','主再来'],
    '再来':['基督复临','第二次降临','复临'],
    '圣所':['天上圣所','二千三百日'],
    '安息日':['第七日','守安息日'],
    '祷告':['祈祷','祈求'],
    '信心':['信靠','因信称义'],
    '救赎':['救恩','基督救赎'],
    '三天使':['三天使信息'],
    '健康':['健康改革','节制']
  };

  const clean=value=>String(value||'').trim()
    .replace(/^(请)?(查|搜索|找|看看|帮我查)?\s*/,'')
    .replace(/怀爱伦(的)?|怀著(的)?|怀师母(的)?|预言之灵(的)?/g,' ')
    .replace(/关于|里面|怎么说|如何说|怎样说|怎么看|怎样看|相关内容|相关资料/g,' ')
    .replace(/\s+/g,' ').trim();

  const termsFor=value=>{
    const q=clean(value),parts=q.split(/[\s,，。；;、/]+/).map(x=>x.trim()).filter(x=>x.length>=2),out=[q,...parts];
    for(const p of [...out])if(synonymMap[p])out.push(...synonymMap[p]);
    return [...new Set(out.filter(x=>x&&x.length>=2))].sort((a,b)=>b.length-a.length);
  };

  const escapeRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

  function highlightNode(root,terms){
    if(!root||!terms.length)return;
    root.querySelectorAll('mark.search-hit').forEach(m=>m.replaceWith(document.createTextNode(m.textContent)));
    const re=new RegExp(`(${terms.map(escapeRe).join('|')})`,'gi');
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
      const p=node.parentElement;
      if(!p||p.closest('button,a,input,textarea,select,mark,script,style'))return NodeFilter.FILTER_REJECT;
      return re.test(node.nodeValue||'')?(re.lastIndex=0,NodeFilter.FILTER_ACCEPT):NodeFilter.FILTER_REJECT;
    }});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      const text=node.nodeValue||'';re.lastIndex=0;let last=0,m;const frag=document.createDocumentFragment();
      while((m=re.exec(text))){
        if(m.index>last)frag.appendChild(document.createTextNode(text.slice(last,m.index)));
        const mark=document.createElement('mark');mark.className='search-hit';mark.textContent=m[0];frag.appendChild(mark);last=m.index+m[0].length;
        if(re.lastIndex===m.index)re.lastIndex++;
      }
      if(last<text.length)frag.appendChild(document.createTextNode(text.slice(last)));
      node.replaceWith(frag);
    }
  }

  function highlightResults(q){
    const host=document.getElementById('studyResults');if(!host)return;
    const terms=termsFor(q);
    host.querySelectorAll('.card[data-kind="egw"],.card[data-kind="bible"]').forEach(card=>{
      card.querySelectorAll('.title,.snippet,.meta').forEach(el=>highlightNode(el,terms));
    });
  }

  const previousSearch=search;
  search=async function highlightedSearch(q){
    await previousSearch(q);
    requestAnimationFrame(()=>highlightResults(q));
  };

  const style=document.createElement('style');
  style.textContent=`mark.search-hit{background:transparent;color:var(--accent);border-radius:0;padding:0;font-weight:800;box-shadow:inset 0 -1px 0 var(--accent)}html[data-theme="dark"] mark.search-hit{background:transparent;color:var(--accent);box-shadow:inset 0 -1px 0 var(--accent)}`;
  document.head.appendChild(style);
})();
