(() => {
  'use strict';
  // app.js 正常完成监听绑定后，不安装第二套导航监听。
  if(window.jgAppNavigationReady)return;

  document.addEventListener('click',e=>{
    const shelf=e.target.closest('[data-open-shelf],[data-shelf]');
    if(shelf){
      const kind=shelf.dataset.openShelf||shelf.dataset.shelf;
      if((kind==='bible'||kind==='egw')&&typeof window.openShelf==='function'){
        e.preventDefault();
        window.openShelf(kind);
        return;
      }
    }
    const page=e.target.closest('[data-page]');
    if(page?.dataset.page&&typeof window.page==='function'){
      e.preventDefault();
      window.page(page.dataset.page);
    }
  },true);
  console.warn('[nav-rescue] 主导航监听未就绪，已启用单次兜底绑定');
})();
