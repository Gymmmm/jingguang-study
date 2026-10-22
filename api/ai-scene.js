import {evidence} from './_bible-rules.js';
export const config={maxDuration:60};
const respond=(res,status,obj)=>res.status(status).json(obj);
export default async function handler(req,res){
 if(req.method!=='POST')return respond(res,405,{error:'method_not_allowed'});
 const access=process.env.AI_ACCESS_CODE;
 if(!access)return respond(res,503,{error:'AI_ACCESS_CODE_not_configured'});
 if(req.headers['x-ai-access-code']!==access)return respond(res,401,{error:'unauthorized'});
 const key=process.env.OPENAI_API_KEY;
 if(!key)return respond(res,503,{error:'OPENAI_API_KEY_not_configured'});
 const {scene='',image='',sources=[]}=req.body||{};
 if(!String(scene).trim()&&!image)return respond(res,400,{error:'missing_scene'});
 if(String(scene).length>4000||String(image).length>4500000)return respond(res,413,{error:'input_too_large'});
 const ev=evidence(scene);if(ev.conflicts.length)return respond(res,409,{error:'conflicting_constraints',detail:ev.conflicts.join('；'),evidence:ev});
 const prompt=`你是严谨的圣经历史场景研究员和美术审查员。先识别场景，辨别不确定之处；严格区分圣经原文、怀爱伦来源、艺术推断。绝不伪造经文或引文。重点检查人数、柱子、帷幔、比例、对称、轴线、材料和颜色。只根据实际提供的来源作出引用，未提供原文不得声称已经查到。输出中文，分为：场景识别、经文依据（待核对要明确写出）、原图问题、修改或重做决策、9:16可执行生成提示词、逐项质检表。对会幕参考出埃及记25-27、36-38章，外院100×50肘，帷幔高5肘，祭坛5×5×3肘，圣所入口5根柱。怀爱伦内容是辅助，不得替代圣经。来源摘要仅作检索线索。`;
 const input=[{type:'input_text',text:'用户要求：'+String(scene)+'\n来源线索：'+JSON.stringify(sources).slice(0,6000)+'\n经文证据卡：'+JSON.stringify(ev.rules).slice(0,5000)}];
 if(image)input.push({type:'input_image',image_url:image,detail:'high'});
 try{
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.AI_TEXT_MODEL||'gpt-4.1',instructions:prompt,input:[{role:'user',content:input}],max_output_tokens:1800})});
  const j=await r.json();if(!r.ok)return respond(res,502,{error:'model_request_failed',detail:j.error?.message||r.status});
  const text=(j.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n');
  return respond(res,200,{ok:true,text,model:j.model,evidence:ev});
 }catch(e){return respond(res,502,{error:'model_unavailable',detail:String(e.message||e)})}
}