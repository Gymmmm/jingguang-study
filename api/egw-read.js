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
const junk=s=>/^(Loading|Search|Contents|Book Info|Copy|Print|Larger font|Smaller font|Main|Chinese|English|Show search|Hide search|Your mail sent|Error while)/i.test(s)||/Search Syntax Examples|All collections|Support our ministry|Go to Full App|Directory|Table of Contents/i.test(s);
const headers={'user-agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/151 Safari/537.36','accept-language':'zh-CN,zh;q=0.9,en;q=0.5'};
const LOCATOR_TAIL=/(?:\s*(?:〖\d+〗|\([A-Za-z]{1,12}\.?\s*\d+(?:\.\d+)*\)|\{[A-Za-z]{1,12}\s+\d+(?:\.\d+)+\}|[A-Za-z]{1,12}[A-Z]?\s+\d+(?:\.\d+)+))+\s*$/;
const LOCATOR_PART=/(〖\d+〗|\([A-Za-z]{1,12}\.?\s*\d+(?:\.\d+)*\)|\{[A-Za-z]{1,12}\s+\d+(?:\.\d+)+\}|[A-Za-z]{1,12}[A-Z]?\s+\d+(?:\.\d+)+)/g;

function readableCandidate(t){
  if(!t||t.length<12||t.length>1800||chinese(t)<6||junk(t))return false;
  if(/Language:|Collection:|Section:|Search filters|怀爱伦著作.*圣经.*书籍|No results found|EGW Extras|Android App|iOS App/i.test(t))return false;
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
    .replace(/<svg[\s\S]*?<\/svg>/gi,'')
    .replace(/<nav[\s\S]*?<\/nav>/gi,'')
    .replace(/<footer[\s\S]*?<\/footer>/gi,'');
}
function dedupeParagraphs(items){
  const seen=new Set(),unique=[];
  for(const item of items){
    const key=item.text+'\u0000'+item.locator;
    if(!item.text||seen.has(key))continue;
    seen.add(key);unique.push(item);
  }
  return unique.filter((item,i,a)=>!a.some((other,j)=>j!==i&&other.text.length<item.text.length&&item.text.includes(other.text)&&item.text.length>other.text.length*1.55));
}
function paragraphCandidates(cleaned,tagRx){
  const out=[],rx=tagRx;let m;
  while((m=rx.exec(cleaned))){
    const raw=decode(m[1]);
    if(!readableCandidate(raw))continue;
    const {text,locator}=splitLocator(raw);
    if(text)out.push({type:'paragraph',text,locator,pos:m.index});
  }
  return out;
}
function bodyRangeParagraphs(pCandidates){
  const located=pCandidates.filter(x=>x.locator);
  if(located.length<2)return pCandidates;
  const first=located[0].pos,last=located[located.length-1].pos;
  const inside=pCandidates.filter(x=>x.pos>=first&&x.pos<=last);
  return inside.length>=located.length?inside:located;
}
function blocks(html){
  const cleaned=cleanHtml(html);
  const pCandidates=paragraphCandidates(cleaned,/<p\b[^>]*>([\s\S]*?)<\/p>/gi);
  let paragraphs=bodyRangeParagraphs(pCandidates);

  // 个别 EGW 页面不用 p 包正文；只有在 p 不足时，才从 div/span 中补“带真实定位码”的正文，避免把目录和页面导航抓进来。
  if(paragraphs.length<2){
    const fallback=paragraphCandidates(cleaned,/<(?:div|span)\b[^>]*>([\s\S]*?)<\/(?:div|span)>/gi).filter(x=>x.locator);
    paragraphs=paragraphs.concat(fallback);
  }
  paragraphs=dedupeParagraphs(paragraphs).slice(0,220);
  if(!paragraphs.length)return [];

  const first=Math.min(...paragraphs.map(x=>x.pos)),last=Math.max(...paragraphs.map(x=>x.pos));
  const headings=[],hrx=/<h([2-5])\b[^>]*>([\s\S]*?)<\/h\1>/gi;let h;
  while((h=hrx.exec(cleaned))){
    const text=decode(h[2]);
    if(h.index<first||h.index>last||chinese(text)<2||text.length>80||junk(text))continue;
    if(/^第\s*[0-9０-９一二三四五六七八九十百零〇]+\s*章/.test(text))continue;
    headings.push({type:'heading',text,pos:h.index});
  }
  return [...paragraphs,...headings].sort((a,b)=>a.pos-b.pos).map(({pos,...item})=>item);
}
function paragraphs(html){
  const structured=blocks(html).filter(x=>x.type==='paragraph');
  return structured.map(x=>x.text+(x.locator?' '+x.locator:''));
}
function cleanTitleText(value){
  return decode(value||'')
    .replace(/\s*[|｜]\s*EGW Writings.*$/i,'')
    .replace(/\s*[-—–]\s*Ellen G\.? White Writings.*$/i,'')
    .replace(/\s+/g,' ')
    .trim();
}
function title(html){
  const h=(html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)||[])[1];
  const t=cleanTitleText(h||'');
  if(t&&chinese(t)&&t.length<160)return t;
  return cleanTitleText((html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)||[])[1]||(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'怀爱伦著作');
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
  return {current:i>=0?chapters[i]:null,prev:i>0?chapters[i-1]:null,next:i>=0&&i<chapters.length-1?chapters[i+1]:null};
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
    const html=await fetchHtml(url),pageTitle=title(html),structured=blocks(html),parts=paragraphs(html),tocData=await getToc(url),nav=adjacentChapters(tocData.html,url),chapterTitle=nav.current?.title||pageTitle;
    if(!parts.length)return res.status(422).json({ok:false,error:'no_readable_text',official_url:input,title:chapterTitle});
    res.setHeader('Cache-Control','private, no-store');
    return res.status(200).json({ok:true,title:chapterTitle,blocks:structured,paragraphs:parts,prev:nav.prev,next:nav.next,official_url:input,source_url:url});
  }catch(e){
    return res.status(502).json({ok:false,error:'official_reader_unavailable',detail:String(e?.message||e),official_url:input});
  }
}
