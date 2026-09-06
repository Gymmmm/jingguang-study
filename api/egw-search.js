export default async function handler(req,res){
  const q=String(req.query?.q||'').trim();
  if(!q)return res.status(400).json({ok:false,error:'missing_query'});

  const url=`https://m.egwwritings.org/zh/search?query=${encodeURIComponent(q)}`;
  const official_url=url;

  try{
    const r=await fetch(url,{
      redirect:'follow',
      headers:{
        'user-agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
        'accept':'text/html,application/xhtml+xml',
        'accept-language':'zh-CN,zh;q=0.9,en;q=0.5'
      }
    });
    if(!r.ok)throw new Error(`upstream_${r.status}`);
    const html=await r.text();

    const decode=s=>String(s||'')
      .replace(/<script[\s\S]*?<\/script>/gi,' ')
      .replace(/<style[\s\S]*?<\/style>/gi,' ')
      .replace(/<[^>]+>/g,' ')
      .replace(/&nbsp;|&#160;/gi,' ')
      .replace(/&amp;/gi,'&')
      .replace(/&quot;|&#34;/gi,'"')
      .replace(/&#39;|&apos;/gi,"'")
      .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
      .replace(/\s+/g,' ').trim();

    const abs=href=>{
      if(/^https?:\/\//i.test(href))return href;
      if(href.startsWith('/'))return `https://m.egwwritings.org${href}`;
      return `https://m.egwwritings.org/zh/${href.replace(/^\.\//,'')}`;
    };

    const rows=[];
    const seen=new Set();

    // Current mobile search results link directly to /zh/book/{book}.{paragraph}
    const rx=/<a\b[^>]*href=["']([^"']*\/zh\/book\/\d+(?:\.\d+)?[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while((m=rx.exec(html))&&rows.length<30){
      const href=abs(m[1]);
      if(seen.has(href))continue;
      let title=decode(m[2]);
      if(!title||title.length<2)continue;

      // Search result blocks include title + book/page + matching excerpt around the link.
      const left=Math.max(0,m.index-900),right=Math.min(html.length,rx.lastIndex+1700);
      const around=decode(html.slice(left,right));
      const qi=around.toLowerCase().indexOf(q.toLowerCase());
      let snippet=qi>=0
        ? around.slice(Math.max(0,qi-90),Math.min(around.length,qi+q.length+180))
        : around.slice(0,270);
      snippet=snippet
        .replace(/^\s*\d+\s+/,'')
        .replace(/Search for:.*?(?=\S)/i,'')
        .replace(/First|Previous|Next|Last/gi,' ')
        .replace(/\s+/g,' ').trim();

      // Try to derive a readable chapter/book label from the title/nearby text.
      const chapterMatch=around.match(/(第\s*\d+\s*章[^。；|]{0,45}|\d+月\d+日[^。；|]{0,45})/);
      rows.push({
        title,
        chapter:chapterMatch?chapterMatch[1].replace(/\s+/g,' '):'',
        snippet,
        url:href,
        source:'EGW Writings'
      });
      seen.add(href);
    }

    // Fallback parser for alternate result markup where href is relative book path.
    if(!rows.length){
      const rx2=/<a\b[^>]*href=["']([^"']*book\/\d+(?:\.\d+)?[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
      while((m=rx2.exec(html))&&rows.length<30){
        let href=m[1];
        if(!href.includes('/zh/'))href=href.startsWith('/')?`/zh${href}`:`/zh/${href}`;
        href=abs(href);
        if(seen.has(href))continue;
        const title=decode(m[2]);
        if(!title||title.length<2)continue;
        const around=decode(html.slice(Math.max(0,m.index-800),Math.min(html.length,rx2.lastIndex+1500)));
        const qi=around.toLowerCase().indexOf(q.toLowerCase());
        const snippet=qi>=0?around.slice(Math.max(0,qi-90),qi+q.length+180):around.slice(0,270);
        rows.push({title,chapter:'',snippet,url:href,source:'EGW Writings'});
        seen.add(href);
      }
    }

    res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json({ok:true,q,count:rows.length,results:rows,official_url,endpoint:'mobile-search-v2'});
  }catch(e){
    return res.status(502).json({ok:false,error:'official_search_unavailable',detail:String(e?.message||e),official_url});
  }
}
