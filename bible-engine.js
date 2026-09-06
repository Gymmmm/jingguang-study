(() => {
  const load = src => new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
  const ensureBase = typeof loadData === 'function' ? Promise.resolve() : load('./app-main.js');
  ensureBase
    .then(()=>load('./bible-engine-core.js'))
    .then(()=>load('./egw-data-expansion.js'))
    .then(()=>load('./sermon-workflow.js'))
    .then(()=>load('./study-workspace.js'))
    .then(()=>load('./mobile-polish.js'))
    .then(()=>load('./egw-search-reader.js'))
    .catch(err=>{console.error('经光研经增强模块加载失败',err);const st=document.getElementById('dataStatus');if(st&&st.textContent.includes('加载中')){st.textContent='程序加载失败，请刷新';st.className='status bad'}});
})();
