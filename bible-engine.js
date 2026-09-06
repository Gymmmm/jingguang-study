(() => {
  const load = src => new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
  load('./bible-engine-core.js')
    .then(()=>load('./sermon-workflow.js'))
    .then(()=>load('./study-workspace.js'))
    .catch(err=>console.error('经光研经增强模块加载失败',err));
})();
