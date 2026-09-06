export default async function handler(req,res){
  const q=String(req.query?.q||'').trim();
  if(!q)return res.status(400).json({ok:false,error:'missing_query'});
  const url=`https://text.egwwritings.org/search.php?QUERY=${encodeURIComponent(q)}&lang=zh`;
  try{
    const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; JingguangStudy/1.0)','accept-language':'zh-CN,zh;q=0.9,en;q=0.6'}});
    if(!r.ok)throw new Error(`upstream_${r.status}`);
    const html=await r.text();
    const decode=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
    const rows=[];
    const seen=new Set();
    const rx=/<a[^>]+href=["']([^"']*(?:\/read\/|\/zh\/book\/)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while((m=rx.exec(html))&&rows.length<24){
      let href=m[1];
      if(href.startsWith('/'))href='https://text.egwwritings.org'+href;
      if(!/^https?:\/\/(?:m\.|text\.)?egwwritings\.org\//i.test(href))continue;
      const title=decode(m[2]);
      if(!title||title.length<2||seen.has(href))continue;
      const around=decode(html.slice(Math.max(0,m.index-550),Math.min(html.length,rx.lastIndex+900)));
      const qi=around.indexOf(q);
      let snippet=qi>=0?around.slice(Math.max(0,qi-75),qi+q.length+125):around.slice(0,210);
      snippet=snippet.replace(/Search Results|RESULTS|RELATED|FEATURED/gi,'').trim();
      rows.push({title,snippet,url:href});seen.add(href);
    }
    res.setHeader('Cache-Control','s-maxage=1800, stale-while-revalidate=86400');
    return res.status(200).json({ok:true,q,count:rows.length,results:rows,official_url:url});
  }catch(e){
    return res.status(502).json({ok:false,error:'official_search_unavailable',official_url:url});
  }
}
