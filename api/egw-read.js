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
const LOCATOR_TAIL=/(?:\s*(?:〖\d+〗|\([A-Za-z]{1,12}\.?\s*\d+(?:\.\d+)*\)|\{[A-Za-z]{1,12}\s+\d+(?:\.\d+)+\}|[A-Za-z]{1,12}[A-Z]?\s+\d+(?:\.\d+)+))+\s*$/;
const LOCATOR_PART=/(〖\d+〗|\([A-Za-z]{1,12}\.?\s*\d+(?:\.\d+)*\)|\{[A-Za-z]{1,12}\s+\d+(?:\.\d+)+\}|[A-Za-z]{1,12}[A-Z]?\s+\d+(?:\.\d+)+)/g;

function readableCandidate(t){
  if(!t||t.length<12||t.length>3200||chinese(t)<6||junk(t))return false;
  if(/Language:|Collection:|Section:|Search filters|怀爱伦著作.*圣经.*书籍|No results found|EGW Extras|Directory|Android App|iOS App/i.test(t))return false;
  return true;
}
function splitLocator(text){
  const value=String(text||'').trim(),m=value.match(LOCATOR_TAIL);
  if(!m)return {text:value,locator:''};
  const locator=(m[0].match(LOCATOR_PART)||[]).join(' '),body=value.slice(0,m.index).trim();
  return body?{text:body,locator}:{text:value,locator:''};
}
function cleanHtml(html){
  return html
    .replace(/<script[\s\S]*?<\/script>/gi,'')
    .replace(/<style[\s\S]*?<\/style>/gi,'')
    .replace(/<svg[\s\S]*?<\/svg>/gi,'');
}
function blocks(html){
  const cleaned=cleanHtml(html),out=[],seen=new Set();
  const rx=/<(h[2-6]|p|div|span|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;let m;
  while((m=rx.exec(cleaned))){
    const tag=m[1].toLowerCase(),raw=decode(m[2]);
    if(!raw||junk(raw)||seen.has(raw))continue;
    if(/^h[2-6]$/.test(tag)){
      if(chinese(raw)>=2&&raw.length<=160&&!/^第\s*[0-9０-９一二三四五六七八九十百零〇]+\s*章/.test(raw)){
        seen.add(raw);out.push({type:'heading',text:raw});
      }
      continue;
    }
    if(!readableCandidate(raw))continue;
    const {text,locator}=splitLocator(raw);
    if(!text||seen.has(text))continue;
    seen.add(raw);seen.add(text);out.push({type:'paragraph',text,locator});
  }
  const paras=out.filter(x=>x.type==='paragraph');
  const filtered=out.filter((item,i,a)=>{
    if(item.type!=='paragraph')return true;
    return !a.some((other,j)=>j!==i&&other.type==='paragraph'&&other.text.length<item.text.length&&item.text.includes(other.text)&&item.text.length>other.text.length*1.6);
  });
  if(paras.length)return filtered.slice(0,220);
  return [];
}
function paragraphs(html){
  const structured=blocks(html).filter(x=>x.type==='paragraph');
  if(structured.length)return structured.map(x=>x.text+(x.locator?' '+x.locator:''));
  const cleaned=cleanHtml(html),fallback=[],seen=new Set();
  const rx=/<(?:p|div|span|li)\b[^>]*>([\s\S]*?)<\/(?:p|div|span|li)>/gi;let m;
  while((m=rx.exec(cleaned))){
    const t=decode(m[1]);
    if(!readableCandidate(t)||seen.has(t)||t.length>900)continue;
    seen.add(t);fallback.push(t);
  }
  return fallback.filter((t,i,a)=>!a.some((u,j)=>j!==i&&u.length<t.length&&t.includes(u)&&t.length>u.length*1.6)).slice(0,180);
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
  return url.replace(/[?#].*$/,'');
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
function adjacentChapters(html,current){
  const chapters=chapterLinks(html,current),needle=normalizeReadUrl(current,current),i=chapters.findIndex(x=>normalizeReadUrl(x.url,current)===needle);
  return {prev:i>0?chapters[i-1]:null,next:i>=0&&i<chapters.length-1?chapters[i+1]:null};
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
    const html=await fetchHtml(url),pageTitle=title(html),structured=blocks(html),parts=paragraphs(html),nav=adjacentChapters(html,url);
    if(!parts.length)return res.status(422).json({ok:false,error:'no_readable_text',official_url:input,title:pageTitle});
    res.setHeader('Cache-Control','private, no-store');
    return res.status(200).json({ok:true,title:pageTitle,blocks:structured,paragraphs:parts,prev:nav.prev,next:nav.next,official_url:input,source_url:url});
  }catch(e){
    return res.status(502).json({ok:false,error:'official_reader_unavailable',detail:String(e?.message||e),official_url:input});
  }
}
