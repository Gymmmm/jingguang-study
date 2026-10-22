export const config={maxDuration:60};
const send=(res,s,v)=>res.status(s).json(v);
export default async function handler(req,res){
 if(req.method!=='POST')return send(res,405,{error:'method_not_allowed'});
 if(!process.env.AI_ACCESS_CODE)return send(res,503,{error:'AI_ACCESS_CODE_not_configured'});
 if(req.headers['x-ai-access-code']!==process.env.AI_ACCESS_CODE)return send(res,401,{error:'unauthorized'});
 const key=process.env.GEMINI_API_KEY;if(!key)return send(res,503,{error:'GEMINI_API_KEY_not_configured'});
 const {prompt='',image=''}=req.body||{};if(!prompt||prompt.length>4000)return send(res,400,{error:'invalid_prompt'});
 const m=String(image).match(/^data:(image\/(?:png|jpeg|webp));base64,([\s\S]+)$/);if(!m)return send(res,400,{error:'image_required'});
 if(image.length>4500000)return send(res,413,{error:'image_too_large'});
 try{
  const model=process.env.AI_VIDEO_MODEL||'veo-3.1-generate-preview';
  const url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':predictLongRunning';
  const r=await fetch(url,{method:'POST',headers:{'x-goog-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({instances:[{prompt:String(prompt),image:{bytesBase64Encoded:m[2],mimeType:m[1]}}],parameters:{aspectRatio:'9:16',sampleCount:1}})});
  const j=await r.json();if(!r.ok)return send(res,502,{error:'video_request_failed',detail:j.error?.message||r.status});
  return send(res,200,{ok:true,operation:j.name||'',status:'processing'});
 }catch(e){return send(res,502,{error:'video_unavailable',detail:String(e.message||e)})}
}