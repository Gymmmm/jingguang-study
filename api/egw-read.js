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
    const text=decode(m[2]);if(!/^(?:第\d+章|前言|序言|引言)/.test(text))continue;
    let url=m[1];if(url.startsWith('/'))url='https://text.egwwritings.org'+url;
    if(!ALLOWED.test(url)||seen.has(url))continue;seen.add(url);rows.push({title:text,url});
  }
  const key=String(current).replace(/^https?:\/\/(?:m\.|text\.)?egwwritings\.org/i,'');
  const i=rows.findIndex(x=>x.url.replace(/^https?:\/\/(?:m\.|text\.)?egwwritings\.org/i,'')===key);
  return {prev:i>0?rows[i-1]:null,next:i>=0&&i<rows.length-1?rows[i+1]:null,chapters:rows.slice(0,120)};
}
export default async function handler(req,res){
  const url=String(req.query?.url||'').trim();
  if(!ALLOWED.test(url))return res.status(400).json({ok:false,error:'invalid_url'});
  try{
    const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; JingguangStudy/1.0)','accept-language':'zh-CN,zh;q=0.9,en;q=0.5'}});
    if(!r.ok)throw new Error(`upstream_${r.status}`);
    const html=await r.text();
    const parts=paragraphs(html),nav=chapterLinks(html,url);
    if(!parts.length)return res.status(422).json({ok:false,error:'no_readable_text',official_url:url,title:title(html)});
    res.setHeader('Cache-Control','private, no-store');
    return res.status(200).json({ok:true,title:title(html),paragraphs:parts,official_url:url,prev:nav.prev,next:nav.next,chapters:nav.chapters});
  }catch(e){
    return res.status(502).json({ok:false,error:'official_reader_unavailable',official_url:url});
  }
}
