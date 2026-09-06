(() => {
  'use strict';
  const nativeFetch=window.fetch.bind(window);
  const rawBase='https://raw.githubusercontent.com/Gymmmm/jingguang-study/main/data/';
  window.fetch=async function(input,init){
    const raw=typeof input==='string'?input:(input?.url||'');
    const m=raw.match(/(?:^|\/)data\/([^/?#]+\.json)(?:[?#].*)?$/i);
    if(!m)return nativeFetch(input,init);
    try{
      const res=await nativeFetch(input,init);
      if(res.ok){
        try{await res.clone().json();return res}catch(_){/* retry below */}
      }
    }catch(_){/* retry below */}
    try{
      return await nativeFetch(rawBase+encodeURIComponent(m[1]),{cache:'no-store'});
    }catch(_){
      return nativeFetch(input,init);
    }
  };
})();
