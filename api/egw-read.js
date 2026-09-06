const ALLOWED=/^https?:\/\/(?:m\.|text\.)?egwwritings\.org\/(?:read\/|book\/b|zh\/book\/)/i;
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
const headers={'user-agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/151 Safari/537.36','accept-language':'zh-CN,zh;q=0.9,en;q=0.5'};

function readableCandidate(t){
  if(!t||t.length<12||t.length>3200||chinese(t)<6||junk(t))return false;
  if(/Language:|Collection:|Section:|Search filters|怀爱伦著作.*圣经.*书籍|No results found|EGW Extras|Directory|Android App|iOS App/i.test(t))return false;
  return true;
}
function paragraphs(html){
  const cleaned=html
    .replace(/<script[\s\S]*?<\/script>/gi,'')
    .replace(/<style[\s\S]*?<\/style>/gi,'')
    .replace(/<svg[\s\S]*?<\/svg>/gi,'');
  const strong=[],fallback=[],seen=new Set();
  const refRx=/\b[A-Za-z]{1,12}[A-Z]?\s+\d+(?:\.\d+)+(?:\s|$)|〖\d+〗/g;
  const rx=/<(?:p|div|span|li)\b[^>]*>([\s\S]*?)<\/(?:p|div|span|li)>/gi;
  let m;
  while((m=rx.exec(cleaned))){
    const t=decode(m[1]);
    if(!readableCandidate(t)||seen.has(t))continue;
    const refs=(t.match(refRx)||[]).length;
    // EGW 正文段落通常带定位码；聚合了很多段的外层容器直接丢弃。
    if(refs>=1&&refs<=3){seen.add(t);strong.push(t);continue}
    if(refs===0&&t.length<=900){seen.add(t);fallback.push(t)}
  }
  let out=strong.length?strong:fallback;
  // 去掉被更短正文完整包含的外层重复块。
  out=out.filter((t,i,a)=>!a.some((u,j)=>j!==i&&u.length<t.length&&t.includes(u)&&t.length>u.length*1.6));
  // 去掉章节目录标题，只保留真正可阅读的连续正文。
  out=out.filter(t=>!/^第\s*[0-9０-９一二三四五六七八九十百零〇]+\s*章.{0,80}$/.test(t));
  return out.slice(0,180);
}
function title(html){
  const h=(html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)||[])[1];
  const t=decode(h||'');
  if(t&&chinese(t))return t;
  return decode((html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)||[])[1]||(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'怀爱伦著作').replace(/\s*\|\s*EGW Writings.*$/i,'');
}
function bookIdFrom(url){
  const s=String(url||'');
  return (s.match(/\/zh\/book\/(\d+)/i)||s.match(/\/book\/b(\d+)/i)||s.match(/\/read\/(\d+)\./i)||[])[1]||'';
}
function normalizeReadUrl(href,base){
  let url=String(href||'').replace(/&amp;/g,'&').trim();
  if(!url)return '';
  if(/^\/read\/\d+(?:\.\d+)?/i.test(url))return 'https://text.egwwritings.org'+url;
  if(/^read\/\d+(?:\.\d+)?/i.test(url))return 'https://text.egwwritings.org/'+url;
  if(url.startsWith('//'))url='https:'+url;
  else if(url.startsWith('/'))url='https://text.egwwritings.org'+url;
  else if(!/^https?:\/\//i.test(url)){try{url=new URL(url,base).href}catch{return ''}}
  return url;
}
function chapterLinks(html,current){
  const rows=[],seen=new Set(),rx=/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;let m;
  while((m=rx.exec(html))){
    const text=decode(m[2]).replace(/\s+/g,' ').trim();
    if(!text||text.length>140)continue;
    const chapterish=/^(?:前\s*言|序\s*言|引\s*言|导\s*言|绪\s*论|附\s*录|第\s*[0-9０-９一二三四五六七八九十百零〇]+\s*章|[0-9０-９]{1,3}[\.、\s])/i.test(text);
    if(!chapterish)continue;
    const url=normalizeReadUrl(m[1],current);
    if(!/^https?:\/\/text\.egwwritings\.org\/read\/\d+(?:\.\d+)?/i.test(url)||seen.has(url))continue;
    seen.add(url);rows.push({title:text,url});
  }
  return rows.slice(0,240);
}
async function fetchHtml(url){
  const r=await fetch(url,{headers,redirect:'follow'});
  if(!r.ok)throw new Error(`upstream_${r.status}`);
  return r.text();
}
async function getToc(url){
  const id=bookIdFrom(url);
  if(!id)throw new Error('missing_book_id');
  const stable=`https://text.egwwritings.org/book/b${id}`;
  const html=await fetchHtml(stable);
  return {html,url:stable,chapters:chapterLinks(html,stable)};
}
export default async function handler(req,res){
  const input=String(req.query?.url||'').trim();
  const toc=String(req.query?.toc||'')==='1';
  if(!ALLOWED.test(input))return res.status(400).json({ok:false,error:'invalid_url'});
  try{
    if(toc){
      const t=await getToc(input);
      if(!t.chapters.length)return res.status(422).json({ok:false,error:'no_chapters_found',official_url:input,debug_book_id:bookIdFrom(input)});
      res.setHeader('Cache-Control','public, s-maxage=1800, stale-while-revalidate=86400');
      return res.status(200).json({ok:true,title:title(t.html),chapters:t.chapters,official_url:input,source_url:t.url});
    }
    let url=input;
    const mobile=input.match(/\/zh\/book\/(\d+)\.(\d+)/i);
    if(mobile)url=`https://text.egwwritings.org/read/${mobile[1]}.${mobile[2]}`;
    const html=await fetchHtml(url),pageTitle=title(html),parts=paragraphs(html);
    if(!parts.length)return res.status(422).json({ok:false,error:'no_readable_text',official_url:input,title:pageTitle});
    res.setHeader('Cache-Control','private, no-store');
    return res.status(200).json({ok:true,title:pageTitle,paragraphs:parts,official_url:input,source_url:url});
  }catch(e){
    return res.status(502).json({ok:false,error:'official_reader_unavailable',detail:String(e?.message||e),official_url:input});
  }
}
