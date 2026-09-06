(() => {
  'use strict';
  function showPage(id){
    document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===id));
    document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===id));
    try{window.scrollTo(0,0)}catch(_){}
  }
  function openShelf(kind){
    showPage('library');
    const bible=document.getElementById('bibleShelf');
    const egw=document.getElementById('egwShelf');
    if(bible)bible.hidden=kind!=='bible';
    if(egw)egw.hidden=kind!=='egw';
    document.querySelectorAll('[data-shelf]').forEach(x=>x.classList.toggle('active',x.dataset.shelf===kind));
    document.querySelectorAll('nav button[data-open-shelf]').forEach(x=>x.classList.toggle('active',x.dataset.openShelf===kind));
    if(kind==='egw'){
      const input=document.getElementById('egwBookSearch');
      if(input)input.dispatchEvent(new Event('input',{bubbles:true}));
    }
    if(kind==='bible'){
      const input=document.getElementById('bibleBookSearch');
      if(input)input.dispatchEvent(new Event('input',{bubbles:true}));
    }
  }
  document.addEventListener('click',e=>{
    const shelf=e.target.closest('[data-open-shelf],[data-shelf]');
    if(shelf){
      const kind=shelf.dataset.openShelf||shelf.dataset.shelf;
      if(kind==='bible'||kind==='egw'){
        e.preventDefault();
        openShelf(kind);
        return;
      }
    }
    const page=e.target.closest('[data-page]');
    if(page&&page.dataset.page){
      e.preventDefault();
      showPage(page.dataset.page);
    }
  },true);
  window.jgNavOpenShelf=openShelf;
  window.jgNavShowPage=showPage;
})();
