(() => {
  'use strict';

  const READING_KEY='jg_v10_reading';
  const FAVORITES_KEY='jg_v10_favorites';
  const POSITION_KEY='jg_v10_egw_position';
  const LAST_KEY='jg_last_egw_native';

  function canonicalUrl(value){
    const raw=String(value||'').trim();
    if(!raw)return '';
    let clean=raw.replace(/[?#].*$/,'').replace(/\/$/,'');
    const mobile=clean.match(/^https?:\/\/(?:m\.|text\.)?egwwritings\.org\/zh\/book\/(\d+)\.(\d+)$/i);
    if(mobile)return `https://text.egwwritings.org/read/${mobile[1]}.${mobile[2]}`;
    const read=clean.match(/^https?:\/\/(?:m\.|text\.)?egwwritings\.org\/read\/(\d+)\.(\d+)$/i);
    if(read)return `https://text.egwwritings.org/read/${read[1]}.${read[2]}`;
    return clean;
  }

  function normalizeItem(item){
    if(!item||typeof item!=='object'||!item.native_url)return item;
    const native_url=canonicalUrl(item.native_url);
    const m=native_url.match(/\/read\/(\d+)\./i);
    return {...item,native_url,bookId:item.bookId||m?.[1]||''};
  }

  function migrateList(key){
    try{
      const source=JSON.parse(localStorage.getItem(key)||'[]');
      if(!Array.isArray(source))return;
      const seen=new Set(),next=[];
      for(const raw of source){
        const item=normalizeItem(raw);
        if(item?.native_url){
          const id=`egw-native:${item.native_url}`;
          if(seen.has(id))continue;
          seen.add(id);
        }
        next.push(item);
      }
      if(JSON.stringify(next)!==JSON.stringify(source))localStorage.setItem(key,JSON.stringify(next));
    }catch(_){}
  }

  function migratePositions(){
    try{
      const source=JSON.parse(localStorage.getItem(POSITION_KEY)||'{}');
      if(!source||Array.isArray(source)||typeof source!=='object')return;
      const next={};
      for(const [key,value] of Object.entries(source)){
        if(!key.startsWith('egw-native:')){next[key]=value;continue}
        const normalized=`egw-native:${canonicalUrl(key.slice('egw-native:'.length))}`;
        if(!(normalized in next))next[normalized]=value;
      }
      if(JSON.stringify(next)!==JSON.stringify(source))localStorage.setItem(POSITION_KEY,JSON.stringify(next));
    }catch(_){}
  }

  function migrateLast(){
    try{
      const source=JSON.parse(localStorage.getItem(LAST_KEY)||'null');
      if(!source||typeof source!=='object'||!source.url)return;
      const url=canonicalUrl(source.url),m=url.match(/\/read\/(\d+)\./i);
      const next={...source,url,bookId:source.bookId||m?.[1]||''};
      if(JSON.stringify(next)!==JSON.stringify(source))localStorage.setItem(LAST_KEY,JSON.stringify(next));
    }catch(_){}
  }

  migrateList(READING_KEY);
  migrateList(FAVORITES_KEY);
  migratePositions();
  migrateLast();

  document.addEventListener('click',event=>{
    const native=event.target.closest?.('[data-egw-native-url]');
    if(native?.dataset.egwNativeUrl)native.dataset.egwNativeUrl=canonicalUrl(native.dataset.egwNativeUrl);
    const official=event.target.closest?.('[data-official-url]');
    if(official?.dataset.officialUrl){
      const normalized=canonicalUrl(official.dataset.officialUrl);
      if(/\/read\/\d+\.\d+$/i.test(normalized))official.dataset.officialUrl=normalized;
    }
  },true);

  window.jgCanonicalEgwUrl=canonicalUrl;
})();
