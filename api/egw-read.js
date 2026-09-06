const ALLOWED=/^https?:\/\/(?:m\.|text\.)?egwwritings\.org\/(?:read\/|zh\/book\/)/i;
const decode=s=>String(s||'')
  .replace(/<br\s*\/?\s*>/gi,'\n')
  .replace(/<[^>]+>/g,' ')
  .replace(/&nbsp;/g,' ')
  .replace(/&amp;/g,'&')
  .replace(/&quot;/g,'"')
  .replace(/&#39;/g,"'")
  .replace(/&ldquo;|&rdquo;/g,'“')
  .replace(/&lsquo;|&rsquo;/g,'’')
  .replace(/&mdash;/g,'—')
  .replace(/&hellip;/g,'…')
  .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n))
  .replace(/\s+/g,' ')
  .trim();
const chinese=s=>(s.match(/[\u3400-\u9fff]/g)||[]).length;
const junk=s=>/^(Loading|Search|Contents|Book Info|Copy|Print|Larger font|Smaller font|Main|Chinese|English|Show search|Hide search|Your mail sent|Error while)/i.test(s)||/Search Syntax Examples|All collections|Support our ministry|Go to Full App/i.test(s);
function paragraphs(html){
  const cleaned=html.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<svg[\s\S]*?<\/svg>/gi,'');
  const out=[],seen=new Set();
  const rx=/<(?:p|div)[^>]*(?:class=["'][^"']*(?:paragraph|egw|book|text|body|content)[^"']*["'])?[^>]*>([\s\S]*?)<\/(?:p|div)>/gi;
  let m;
  while((m=rx.exec(cleaned))){
    const t=decode(m[1]);
    if(t.length<18||t.length>1800||chinese(t)<8||junk(t)||seen.has(t))continue;
    if(/Language:|Collection:|Section:|Search filters|怀爱伦著作.*圣经.*书籍/.test(t))continue;
    seen.add(t);out.push(t);
  }
  return out.slice(0,160);
}
function title(html){
  const h=(html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)||[])[1];
  const t=decode(h||'');
  if(t&&chinese(t))return t;
  return decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'怀爱伦著作').replace(/\s*\|\s*EGW Writings.*$/i,'');
}
function chapterLinks(html,current){
  const rows=[],seen=new Set(),rx=/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;let m;
  while((m=rx.exec(html))){
    let text=decode(m[2]).replace(/\s+/g,' ').trim();
    if(!text||text.length>110)continue;
    const chapterish=/^(?:前\s*言|序\s*言|引\s*言|导\s*言|绪\s*论|附\s*录|第\s*[0-9０-９一二三四五六七八九十百零〇]+\s*章|[0-9０-９]{1,3}[\.、\s])/i.test(text);
    if(!chapterish)continue;
    let url=m[1].replace(/&amp;/g,'&');
    if(url.startsWith('//'))url='https:'+url;
    else if(url.startsWith('/'))url='https://m.egwwritings.org'+url;
    else if(!/^https?:\/\//i.test(url)){
      try{url=new URL(url,current).href}catch{continue}
    }
    if(!ALLOWED.test(url)||seen.has(url))continue;
    seen.add(url);rows.push({title:text,url});
  }
  const key=String(current).replace(/^https?:\/\/(?:m\.|text\.)?egwwritings\.org/i,'').replace(/\/toc(?:\?.*)?$/,'');
  const i=rows.findIndex(x=>x.url.replace(/^https?:\/\/(?:m\.|text\.)?egwwritings\.org/i,'').replace(/\/toc(?:\?.*)?$/,'')===key);
  return {prev:i>0?rows[i-1]:null,next:i>=0&&i<rows.length-1?rows[i+1]:null,chapters:rows.slice(0,220)};
}
export default async function handler(req,res){
  const url=String(req.query?.url||'').trim();
  const toc=String(req.query?.toc||'')==='1';
  if(!ALLOWED.test(url))return res.status(400).json({ok:false,error:'invalid_url'});
  try{
    const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1','accept-language':'zh-CN,zh;q=0.9,en;q=0.5'}});
    if(!r.ok)throw new Error(`upstream_${r.status}`);
    const html=await r.text(),nav=chapterLinks(html,url),pageTitle=title(html);
    if(toc){
      res.setHeader('Cache-Control','public, s-maxage=1800, stale-while-revalidate=86400');
      return res.status(200).json({ok:true,title:pageTitle,chapters:nav.chapters,official_url:url});
    }
    const parts=paragraphs(html);
    if(!parts.length)return res.status(422).json({ok:false,error:'no_readable_text',official_url:url,title:pageTitle,chapters:nav.chapters});
    res.setHeader('Cache-Control','private, no-store');
    return res.status(200).json({ok:true,title:pageTitle,paragraphs:parts,official_url:url,prev:nav.prev,next:nav.next,chapters:nav.chapters});
  }catch(e){
    return res.status(502).json({ok:false,error:'official_reader_unavailable',official_url:url});
  }
}
