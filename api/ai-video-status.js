export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
 if(!process.env.AI_ACCESS_CODE)return res.status(503).json({error:'AI_ACCESS_CODE_not_configured'});
 if(req.headers['x-ai-access-code']!==process.env.AI_ACCESS_CODE)return res.status(401).json({error:'unauthorized'});
 if(!process.env.GEMINI_API_KEY)return res.status(503).json({error:'GEMINI_API_KEY_not_configured'});
 const op=String(req.query?.operation||'');
 if(!/^operations\/[A-Za-z0-9_\/-]{5,250}$/.test(op))return res.status(400).json({error:'invalid_operation'});
 try{const r=await fetch('https://generativelanguage.googleapis.com/v1beta/'+op,{headers:{'x-goog-api-key':process.env.GEMINI_API_KEY}});const j=await r.json();if(!r.ok)return res.status(502).json({error:'status_failed',detail:j.error?.message||r.status});const v=j.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri||j.response?.generatedVideos?.[0]?.video?.uri||'';return res.status(200).json({ok:true,done:!!j.done,videoUrl:v,error:j.error?.message||''})}catch(e){return res.status(502).json({error:'status_unavailable',detail:String(e.message||e)})}
}