import {evidence} from './_bible-rules.js';
export const config={maxDuration:60};
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
 if(!process.env.AI_ACCESS_CODE)return res.status(503).json({error:'AI_ACCESS_CODE_not_configured'});
 if(req.headers['x-ai-access-code']!==process.env.AI_ACCESS_CODE)return res.status(401).json({error:'unauthorized'});
 if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'OPENAI_API_KEY_not_configured'});
 const {scene='',image='',original='',mode='generate'}=req.body||{};
 if(!image||image.length>4500000||original.length>4500000)return res.status(400).json({error:'invalid_image'});
 const ev=evidence(scene);
 const instructions='你是独立圣经视觉验收员。只根据实际看到的图片判断，绝不因为提示词正确就判合格。严格区分经文事实、推算和美术设定。仅评估当前镜头可见的项目，不可见写not_visible，无法确认写uncertain。必须返回JSON对象，字段：verdict(pass/fail/uncertain), issues(数组，每项含rule,observation,repair), checks(数组，每项含rule,status(pass/fail/uncertain/not_visible),note),repair_prompt(简短定向修复英文提示词)。有关键错误则fail；不能确认关键要求则uncertain；不要虚构已核实经文。图片中的未要求变化也应检查。';
 const items=[{type:'input_text',text:'用户要求：'+scene+'\n模式：'+mode+'\n已登记证据：'+JSON.stringify(ev).slice(0,7000)}];
 if(original)items.push({type:'input_image',image_url:original,detail:'high'});
 items.push({type:'input_image',image_url:image,detail:'high'});
 try{
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.AI_TEXT_MODEL||'gpt-4.1',instructions,input:[{role:'user',content:items}],text:{format:{type:'json_object'}},max_output_tokens:1700})});
 const j=await r.json();if(!r.ok)return res.status(502).json({error:'audit_failed',detail:j.error?.message||r.status});
 const t=(j.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');const audit=JSON.parse(t);
 return res.status(200).json({ok:true,audit,evidence:ev,verified_by:'vision_model_not_deterministic'});
 }catch(e){return res.status(502).json({error:'audit_unavailable',detail:String(e.message||e)})}
}