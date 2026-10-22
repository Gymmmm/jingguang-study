export const config={maxDuration:120};
const send=(res,s,v)=>res.status(s).json(v);
export default async function handler(req,res){
 if(req.method!=='POST')return send(res,405,{error:'method_not_allowed'});
 if(!process.env.AI_ACCESS_CODE)return send(res,503,{error:'AI_ACCESS_CODE_not_configured'});
 if(req.headers['x-ai-access-code']!==process.env.AI_ACCESS_CODE)return send(res,401,{error:'unauthorized'});
 const key=process.env.OPENAI_API_KEY;if(!key)return send(res,503,{error:'OPENAI_API_KEY_not_configured'});
 const {prompt='',image='',mode='generate'}=req.body||{};
 if(!String(prompt).trim()||String(prompt).length>6500)return send(res,400,{error:'invalid_prompt'});
 if(image&&image.length>4500000)return send(res,413,{error:'image_too_large'});
 const model=process.env.AI_IMAGE_MODEL||'gpt-image-1.5';
 const system='9:16 vertical cinematic realistic biblical historical scene. Faithful to scriptural dimensions, counts, symmetry and materials. No modern objects. No typography. ';
 try{
  let r;
  if(mode==='edit'&&image){
   const m=String(image).match(/^data:(image\/(?:png|jpeg|webp));base64,([\s\S]+)$/);if(!m)return send(res,400,{error:'invalid_image'});
   const form=new FormData();form.append('model',model);form.append('prompt',system+prompt);form.append('size','1024x1536');form.append('image',new Blob([Buffer.from(m[2],'base64')],{type:m[1]}),'reference.png');
   r=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:'Bearer '+key},body:form});
  }else{
   r=await fetch('https://api.openai.com/v1/images/generations',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model,prompt:system+prompt,size:'1024x1536',n:1,output_format:'png'})});
  }
  const j=await r.json();if(!r.ok)return send(res,502,{error:'image_generation_failed',detail:j.error?.message||r.status});
  const b64=j.data?.[0]?.b64_json;if(!b64)return send(res,502,{error:'missing_image_data'});
  return send(res,200,{ok:true,image:'data:image/png;base64,'+b64,model});
 }catch(e){return send(res,502,{error:'image_unavailable',detail:String(e.message||e)})}
}