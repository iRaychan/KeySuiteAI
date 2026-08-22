import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateCurvePdf } from './curve-pdf.ts';

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
const env=(...names:string[])=>{for(const name of names){const value=Deno.env.get(name);if(value)return value}return ''};

type SmartOption={key:string;label:string};
type SmartQuestion={field:string;label:string;prompt:string;options?:SmartOption[]};

async function telegramSend(token:string,chatId:string,text:string){
  if(!token||!chatId)return;
  const response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text})
  });
  if(!response.ok){const detail=await response.text().catch(()=>response.statusText);console.error('Telegram sendMessage failed',response.status,detail)}
}

async function telegramSendDocument(token:string,chatId:string,bytes:Uint8Array,filename:string,caption:string){
  if(!token||!chatId||!bytes?.length)return {ok:false,error:'Missing Telegram document data.'};
  const form=new FormData();
  form.append('chat_id',chatId);
  form.append('caption',caption);
  form.append('document',new Blob([bytes],{type:'application/pdf'}),filename);
  const response=await fetch(`https://api.telegram.org/bot${token}/sendDocument`,{method:'POST',body:form});
  if(!response.ok){
    const detail=await response.text().catch(()=>response.statusText);
    console.error('Telegram sendDocument failed',response.status,detail);
    return {ok:false,error:detail||response.statusText};
  }
  return {ok:true};
}
function curveFamily(source:string){
  const chc=/\bchc\b/i.test(String(source||'')),es=/\bes\b/i.test(String(source||''));
  if(chc&&es)return 'AMBIGUOUS';
  return chc?'CHC':es?'ES':null;
}
function curveEsPole(source:string){
  const s=String(source||'');
  const p2=/\b2\s*-?\s*p(?:ole)?s?\b/i.test(s);
  const p4=/\b4\s*-?\s*p(?:ole)?s?\b/i.test(s);
  if(p2&&p4)return 'AMBIGUOUS';
  return p2?2:p4?4:null;
}
function esPoleRpm(pole:any){
  return Number(pole)===2?2900:Number(pole)===4?1450:0;
}
function esPoleLabel(pole:any){
  return Number(pole)===2?'ES 2 Pole':Number(pole)===4?'ES 4 Pole':'ES';
}
function selectorCurveUrl(baseUrl:string,family:string,flowM3h:number,headM:number,display:any={},esPole:any=null){
  const base=String(baseUrl||'').trim().replace(/\/+$/,'');
  if(!base)return '';
  const route=family==='CHC'?'selector/':'selector-es/';
  const params=new URLSearchParams({
    auto:'curve',source:'telegram',flowM3h:String(flowM3h),headM:String(headM),
    rawFlow:String(display?.raw_flow??flowM3h),flowUnit:String(display?.flow_unit||'m3h'),
    rawHead:String(display?.raw_head??headM),headUnit:String(display?.head_unit||'m')
  });
  if(family==='ES'&&(Number(esPole)===2||Number(esPole)===4)){
    params.set('esPole',String(Number(esPole)));
    params.set('rpm',String(esPoleRpm(esPole)));
  }
  return `${base}/${route}?${params.toString()}`;
}
function senderResponseMode(value:any){
  const mode=String(value||'nothing').trim().toLowerCase();
  return mode==='curve_price'||mode==='curve_only'?mode:'nothing';
}
function parseAiJson(text:string){
  let cleaned=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  if(!cleaned)return null;
  for(let i=0;i<3;i++){
    try{const parsed=JSON.parse(cleaned);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return parsed;if(typeof parsed==='string'){cleaned=parsed.trim();continue}}catch(_){/* try extracting the object below */}
    const first=cleaned.indexOf('{'),last=cleaned.lastIndexOf('}');
    if(first>=0&&last>first){try{const parsed=JSON.parse(cleaned.slice(first,last+1));if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return parsed}catch(_){}}
    break;
  }
  return {raw_output:cleaned};
}
function strings(value:any,max=20){
  if(typeof value==='string'&&value.trim().startsWith('[')){try{value=JSON.parse(value)}catch(_){}}
  return (Array.isArray(value)?value:[]).map(v=>String(v||'').trim()).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).slice(0,max);
}
function firstNumber(match:RegExpMatchArray|null){const n=Number(match?.[1]);return Number.isFinite(n)?n:null}
function unitKey(value:any){return String(value||'').toLowerCase().replace(/³/g,'3').replace(/\s+/g,' ').trim()}
function flowToM3h(value:any,unit:any){
  const n=Number(value);if(!Number.isFinite(n))return null;const u=unitKey(unit).replace(/\./g,'');
  if(!u||/(?:m3\s*\/\s*(?:h|hr|hour)|m3h|m3ph)/.test(u))return n;
  if(/(?:l\s*\/\s*s|lps|l\s*per\s*sec)/.test(u))return n*3.6;
  if(/(?:l\s*\/\s*(?:min|minute)|lpm)/.test(u))return n*0.06;
  if(/(?:imp(?:erial)?\s*gpm|igpm)/.test(u))return n*0.2727654;
  if(/(?:us\s*gpm|usgpm)/.test(u))return n*0.227124707;
  return null;
}
function headToM(value:any,unit:any){
  const n=Number(value);if(!Number.isFinite(n))return null;const u=unitKey(unit).replace(/\./g,'');
  if(!u||/^(?:m|mtr|metre|meter|metres|meters)(?:\s*head)?$/.test(u))return n;
  if(/^(?:ft|feet|foot)(?:\s*head)?$/.test(u))return n*0.3048;
  if(/^bar$/.test(u))return n*10.19716213;
  if(/^kpa$/.test(u))return n*0.1019716213;
  if(/^psi$/.test(u))return n*0.703249615;
  return null;
}

function oneDecimal(value:any){
  const n=Number(value);
  if(!Number.isFinite(n))return '-';
  const r=Math.round((n+Number.EPSILON)*10)/10;
  return Number.isInteger(r)?String(r):r.toFixed(1);
}
function inputNumber(value:any){
  const n=Number(value);
  if(!Number.isFinite(n))return '-';
  const r=Math.round((n+Number.EPSILON)*100)/100;
  if(Number.isInteger(r))return String(r);
  return r.toFixed(2).replace(/0$/,'');
}
function flowUnitLabel(unit:any){
  const u=unitKey(unit).replace(/\./g,'');
  if(/(?:m3\s*\/\s*(?:h|hr|hour)|m3h|m3ph)/.test(u))return 'm³/hr';
  if(/(?:l\s*\/\s*s|lps|l\s*per\s*sec)/.test(u))return 'Lps';
  if(/(?:l\s*\/\s*(?:min|minute)|lpm)/.test(u))return 'Lpm';
  if(/(?:imp(?:erial)?\s*gpm|igpm)/.test(u))return 'IGPM';
  if(/(?:us\s*gpm|usgpm)/.test(u))return 'US GPM';
  return String(unit||'').trim();
}
function headUnitLabel(unit:any){
  const u=unitKey(unit).replace(/\./g,'');
  if(/^(?:m|mtr|metre|meter|metres|meters)(?:\s*head)?$/.test(u))return 'Mtr';
  if(/^(?:ft|feet|foot)(?:\s*head)?$/.test(u))return 'Ft';
  if(/^bar$/.test(u))return 'bar';
  if(/^kpa$/.test(u))return 'kPa';
  if(/^psi$/.test(u))return 'psi';
  return String(unit||'').trim();
}
function flowUnitCode(unit:any){
  const u=unitKey(unit).replace(/\./g,'');
  if(/(?:m3\s*\/\s*(?:h|hr|hour)|m3h|m3ph)/.test(u))return 'm3h';
  if(/(?:l\s*\/\s*s|lps|l\s*per\s*sec)/.test(u))return 'lps';
  if(/(?:l\s*\/\s*(?:min|minute)|lpm)/.test(u))return 'lpm';
  if(/(?:imp(?:erial)?\s*gpm|igpm)/.test(u))return 'igpm';
  if(/(?:us\s*gpm|usgpm)/.test(u))return 'usgpm';
  return '';
}
function headUnitCode(unit:any){
  const u=unitKey(unit).replace(/\./g,'');
  if(/^(?:m|mtr|metre|meter|metres|meters)(?:\s*head)?$/.test(u))return 'm';
  if(/^(?:ft|feet|foot)(?:\s*head)?$/.test(u))return 'ft';
  if(/^bar$/.test(u))return 'bar';
  if(/^kpa$/.test(u))return 'kpa';
  if(/^psi$/.test(u))return 'psi';
  return '';
}
function dutyDisplay(source:string,flowM3h:any,headM:any){
  const s=String(source||'');
  const fm=s.match(/(\d+(?:\.\d+)?)\s*(m3\s*\/\s*(?:h|hr|hour)|m³\s*\/\s*(?:h|hr|hour)|m3h|m3ph|l\s*\/\s*s|lps|l\s*\/\s*(?:min|minute)|lpm|us\s*gpm|usgpm|imp(?:erial)?\s*gpm|igpm)\b/i);
  const hm=s.match(/(?:head\s*[:=]?\s*)?(\d+(?:\.\d+)?)\s*(mtr|metres?|meters?|m|ft|feet|foot|bar|kpa|psi)\s*(?:head)?\b/i);

  const q=Number(flowM3h),h=Number(headM);
  let flowText=Number.isFinite(q)?`${oneDecimal(q)} m³/hr`:'-';
  let headText=Number.isFinite(h)?`${oneDecimal(h)} Mtr`:'-';

  if(fm){
    const raw=Number(fm[1]),label=flowUnitLabel(fm[2]);
    const common=/^m³\/hr$/i.test(label);
    flowText=common?`${inputNumber(raw)} ${label}`:`${inputNumber(raw)} ${label} (${oneDecimal(q)} m³/hr)`;
  }
  if(hm){
    const raw=Number(hm[1]),label=headUnitLabel(hm[2]);
    const common=/^Mtr$/i.test(label);
    headText=common?`${inputNumber(raw)} ${label}`:`${inputNumber(raw)} ${label} (${oneDecimal(h)} Mtr)`;
  }
  return {
    flow_text:flowText,head_text:headText,duty_text:`${flowText} @ ${headText}`,
    raw_flow:fm?Number(fm[1]):q,flow_unit:fm?flowUnitCode(fm[2]):'m3h',
    raw_head:hm?Number(hm[1]):h,head_unit:hm?headUnitCode(hm[2]):'m'
  };
}
function normaliseUnits(d:any){
  if(d.flow_value!==null&&d.flow_value!==undefined){const q=flowToM3h(d.flow_value,d.flow_unit);if(q!==null){d.flow_value=Number(q.toFixed(3));d.flow_unit='m³/hr'}}
  if(d.head_value!==null&&d.head_value!==undefined){const h=headToM(d.head_value,d.head_unit);if(h!==null){d.head_value=Number(h.toFixed(3));d.head_unit='m'}}
  return d;
}
function normalFluid(value:any){
  const s=String(value||'').trim();if(!s)return null;
  if(/\bwater\b/i.test(s))return 'Water';
  if(/\boil\b/i.test(s))return 'Oil';
  return s;
}
function extractFacts(source:string){
  const s=String(source||''),lower=s.toLowerCase();
  let duty=firstNumber(s.match(/(\d+)\s*duty\b/i));
  let onDemand=firstNumber(s.match(/(\d+)\s*(?:on\s*demand|demand)\b/i));
  let standby=firstNumber(s.match(/(\d+)\s*standby\b/i));
  const compactDS=s.match(/\b(\d+)\s*d(?:uty)?\s*(?:\+|\/|,)\s*(\d+)\s*s(?:tandby)?\b/i);
  if(compactDS){duty=Number(compactDS[1]);standby=Number(compactDS[2])}
  const compactDOS=s.match(/\b(\d+)\s*d(?:uty)?\s*(?:\+|\/|,)\s*(\d+)\s*(?:od|on\s*demand)\s*(?:\+|\/|,)\s*(\d+)\s*s(?:tandby)?\b/i);
  if(compactDOS){duty=Number(compactDOS[1]);onDemand=Number(compactDOS[2]);standby=Number(compactDOS[3])}
  const genericPump=firstNumber(s.match(/\b(\d+)\s*(?:pumps?|pump\s*system|pump\s*set)\b/i));
  const flowMatch=s.match(/(\d+(?:\.\d+)?)\s*(m3\s*\/\s*(?:h|hr|hour)|m³\s*\/\s*(?:h|hr|hour)|m3h|m3ph|l\s*\/\s*s|lps|l\s*\/\s*(?:min|minute)|lpm|us\s*gpm|usgpm|imp(?:erial)?\s*gpm|igpm)\b/i);
  const headMatch=s.match(/(?:head\s*[:=]?\s*)?(\d+(?:\.\d+)?)\s*(mtr|metres?|meters?|m|ft|feet|foot|bar|kpa|psi)\s*(?:head)?\b/i);
  const voltageMatch=s.match(/(\d+(?:\.\d+)?)\s*v\b/i);
  const hzMatch=s.match(/(\d+(?:\.\d+)?)\s*hz\b/i);
  const phaseMatch=s.match(/\b([13])\s*(?:ph|phase)\b/i);
  let application:string|null=null;
  if(/\bbooster\b/i.test(s))application='Booster';else if(/\btransfer\b/i.test(s))application='Transfer';
  let fluid:string|null=null;
  if(/\bwater\b/i.test(s))fluid='Water';
  else if(/\boil\b/i.test(s))fluid='Oil';
  else {
    const fluidMatch=s.match(/\b(?:fluid|liquid)\s*(?:is|:|=)?\s*([a-z][a-z0-9 +./-]{2,40})/i);
    if(fluidMatch)fluid=fluidMatch[1].trim().replace(/[,.].*$/,'');
  }
  let material:string|null=null;
  if(/\b(?:ss\s*304|stainless\s*steel\s*304)\b/i.test(s))material='Stainless Steel 304';
  else if(/\b(?:ss\s*316|stainless\s*steel\s*316)\b/i.test(s))material='Stainless Steel 316';
  else if(/\bcast\s*iron\b[^\n]{0,30}\bstainless\s*steel\b/i.test(s)||/\bci\s*[/+-]\s*ss\b/i.test(s))material='Cast Iron / Stainless Steel';
  else if(/\bstandard\s+material\b/i.test(s))material='Standard Material';
  let elastomer:string|null=null;
  if(/\bepdm\b/i.test(s))elastomer='EPDM';
  else if(/\bviton\b/i.test(s))elastomer='Viton';
  else if(/\bnbr\b/i.test(s))elastomer='NBR';
  else if(/\bstandard\s+(?:seal|elastomer)\b/i.test(s))elastomer='Standard';
  let installation:string|null=null;
  if(/\boutdoor\b/i.test(s))installation='Outdoor';else if(/\bindoor\b/i.test(s))installation='Indoor';
  let suctionCondition:string|null=null;
  if(/\bsuction\s+lift\b/i.test(s))suctionCondition='Suction Lift';
  else if(/\bflooded\s+suction\b|\bpositive\s+suction\b/i.test(s))suctionCondition='Flooded / Positive Suction';
  else if(/\bsuction\s+(?:condition\s+)?unknown\b/i.test(s))suctionCondition='Unknown';
  let fluidTemperature:string|null=null;
  const tempMatch=s.match(/(-?\d+(?:\.\d+)?)\s*(?:(?:deg(?:ree)?s?)\s*)?(?:°\s*)?c\b/i);
  if(tempMatch)fluidTemperature=`${Number(tempMatch[1])}°C`;
  let flowBasis:string|null=null;
  if(/\btotal\s+(?:system\s+)?flow\b/i.test(s)||/\bsystem\s+flow\b/i.test(s)||/\b(?:m3|m³|l\s*\/\s*s|lps|lpm|gpm)\b[^\n]{0,24}\btotal\b/i.test(lower))flowBasis='total_system';
  if(/\bper\s+(?:duty\s+)?pump\b/i.test(s)||/\beach\s+(?:duty\s+)?pump\b/i.test(s)||/\bper\s+duty\b/i.test(s))flowBasis='per_duty_pump';
  const explicitArrangement=duty!==null||onDemand!==null||standby!==null;
  if(genericPump!==null&&explicitArrangement){
    if(duty===null)duty=1;
    const known=Number(duty||0)+Number(onDemand||0)+Number(standby||0);
    if(onDemand===null&&genericPump>known)onDemand=genericPump-known;
  }
  const pumpQuantity=genericPump!==null?genericPump:(explicitArrangement?Number(duty||0)+Number(onDemand||0)+Number(standby||0):null);
  const dutyConfiguration=explicitArrangement?[duty!==null?`${duty} Duty`:null,onDemand!==null?`${onDemand} On Demand`:null,standby!==null?`${standby} Standby`:null].filter(Boolean).join(' + '):null;
  const flowRaw=flowMatch?Number(flowMatch[1]):null,headRaw=headMatch?Number(headMatch[1]):null;
  const flowValue=flowMatch?flowToM3h(flowRaw,flowMatch[2]):null,headValue=headMatch?headToM(headRaw,headMatch[2]):null;
  return {
    application,system_type:application?`${application} System`:null,pump_quantity:pumpQuantity,duty_configuration:dutyConfiguration,
    flow_value:flowValue===null?null:Number(flowValue.toFixed(3)),flow_unit:flowValue===null?null:'m³/hr',flow_basis:flowBasis,
    head_value:headValue===null?null:Number(headValue.toFixed(3)),head_unit:headValue===null?null:'m',fluid,fluid_temperature:fluidTemperature,material,elastomer,installation,suction_condition:suctionCondition,
    voltage:firstNumber(voltageMatch),phase:phaseMatch?`${phaseMatch[1]} Phase`:null,frequency_hz:firstNumber(hzMatch)
  };
}
function normalApplication(value:any){const s=String(value||'').trim();if(/booster/i.test(s))return 'Booster';if(/transfer/i.test(s))return 'Transfer';return s||null}
function defaultDutyConfiguration(qty:any){
  const n=Math.max(0,Math.trunc(Number(qty)||0));
  if(n===1)return '1 Duty';
  if(n>1)return `1 Duty + ${n-1} On Demand`;
  return null;
}
function applyKeyAiDefaults(d:any){
  if(!d.application)d.application='Booster';
  if(!d.system_type)d.system_type=`${normalApplication(d.application)||'Booster'} System`;
  if(d.pump_quantity&&!d.duty_configuration)d.duty_configuration=defaultDutyConfiguration(d.pump_quantity);
  if(d.flow_value!==null&&d.flow_value!==undefined&&!d.flow_basis)d.flow_basis='per_duty_pump';
  if(!d.fluid)d.fluid='Water';
  if(!d.fluid_temperature)d.fluid_temperature='10–70°C';
  if(d.voltage===null||d.voltage===undefined)d.voltage=415;
  if(!d.phase)d.phase='3 Phase';
  if(d.frequency_hz===null||d.frequency_hz===undefined)d.frequency_hz=50;
  if(!d.material)d.material='Standard Material';
  if(!d.elastomer)d.elastomer='Standard';
  if(!d.installation)d.installation='Indoor';
  if(!d.suction_condition)d.suction_condition='Flooded / Positive Suction';
  return d;
}
function generatedSummary(d:any){
  const parts:string[]=[];
  if(d.system_type)parts.push(String(d.system_type));
  if(d.duty_configuration)parts.push(String(d.duty_configuration));
  if(d.flow_value!==null&&d.flow_value!==undefined)parts.push(`${d.flow_value} ${d.flow_unit||'m³/hr'}`);
  if(d.head_value!==null&&d.head_value!==undefined)parts.push(`${d.head_value} ${d.head_unit||'m'} head`);
  if(d.fluid)parts.push(String(d.fluid));
  if(d.voltage!==null&&d.voltage!==undefined)parts.push(`${d.voltage} V`);
  return parts.join(' · ')||'KeyAI prepared quotation requirements.';
}
function cleanQuestion(question:string,ordinaryWaterSystem:boolean){
  const q=String(question||'').trim();if(!q)return '';
  if(ordinaryWaterSystem&&/fluid temperature|viscosity|solids content|fluid properties|material/i.test(q))return '';
  return q.replace(/^[-*\d.)\s]+/,'').trim();
}
function normaliseResult(parsed:any,source:string,existing:any=null){
  const base=existing&&typeof existing==='object'&&!Array.isArray(existing)?{...existing}:{};
  const incoming=parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};
  let d:any={...base};
  Object.entries(incoming).forEach(([key,value])=>{
    if(Array.isArray(value)){d[key]=value;return;}
    if(value!==null&&value!==undefined&&value!==''){d[key]=value;return;}
    if(!(key in d))d[key]=value;
  });
  if(typeof d.raw_output==='string'){
    const nested=parseAiJson(d.raw_output);if(nested&&!nested.raw_output)d={...base,...nested,...incoming};
  }
  const facts=extractFacts(source);
  normaliseUnits(d);
  const fields=['application','system_type','pump_quantity','duty_configuration','flow_value','flow_unit','flow_basis','head_value','head_unit','fluid','fluid_temperature','material','elastomer','installation','suction_condition','voltage','phase','frequency_hz'];
  fields.forEach(k=>{if((d[k]===null||d[k]===undefined||d[k]==='')&&facts[k]!==null&&facts[k]!==undefined&&facts[k]!=='')d[k]=facts[k]});
  // Explicit customer facts always override a previously assumed default.
  ['application','system_type','pump_quantity','duty_configuration','flow_value','flow_unit','flow_basis','head_value','head_unit','fluid','fluid_temperature','material','elastomer','installation','suction_condition','voltage','phase','frequency_hz'].forEach(k=>{
    if(facts[k]!==null&&facts[k]!==undefined&&facts[k]!=='')d[k]=facts[k];
  });
  d.fluid=normalFluid(d.fluid);
  d.application=normalApplication(d.application||facts.application);
  if(d.application&&(!d.system_type||/duty|standby|on demand/i.test(String(d.system_type))))d.system_type=`${d.application} System`;
  if(d.flow_value!==null&&d.flow_value!==undefined&&!d.flow_unit)d.flow_unit='m³/hr';
  if(d.head_value!==null&&d.head_value!==undefined&&!d.head_unit)d.head_unit='m';
  if(!['total_system','per_duty_pump'].includes(String(d.flow_basis||'')))d.flow_basis=facts.flow_basis||null;
  if(!d.pump_quantity&&facts.pump_quantity)d.pump_quantity=facts.pump_quantity;
  if(!d.duty_configuration&&facts.duty_configuration)d.duty_configuration=facts.duty_configuration;
  applyKeyAiDefaults(d);
  let critical=strings(d.critical_missing_information);
  let missing=strings(d.missing_information);
  if(d.flow_value!==null&&d.flow_value!==undefined)critical=critical.filter(v=>!/required flow|flow is not confirmed/i.test(v));
  if(d.head_value!==null&&d.head_value!==undefined)critical=critical.filter(v=>!/required head|head is not confirmed/i.test(v));
  // B4.06.04: defaults resolve all non-duty omissions. Only Flow/Head or genuine contradictions require customer follow-up.
  critical=critical.filter(v=>/required flow|flow is not confirmed|required head|head is not confirmed|contradict|conflict|ambiguous|unclear/i.test(v));
  missing=missing.filter(v=>/required flow|required head|contradict|conflict|ambiguous|unclear/i.test(v));
  const automaticCritical:string[]=[];
  if(d.flow_value===null||d.flow_value===undefined)automaticCritical.push('Required flow is not confirmed.');
  if(d.head_value===null||d.head_value===undefined)automaticCritical.push('Required head is not confirmed.');
  d.critical_missing_information=[...automaticCritical,...critical].filter((v,i,a)=>v&&a.indexOf(v)===i);
  d.missing_information=missing.filter((v,i,a)=>v&&a.indexOf(v)===i).filter(v=>!d.critical_missing_information.includes(v));
  d.clarification_questions=strings(d.clarification_questions,6).filter(q=>/flow|head|pressure|contradict|conflict|ambiguous|unclear/i.test(q));
  const summary=String(d.summary||'').trim();
  d.summary=summary&&!summary.startsWith('{')?summary:generatedSummary(d);
  if('raw_output' in d)delete d.raw_output;
  return d;
}
function summaryFrom(result:any){return String(result?.summary||generatedSummary(result||{})).trim()}
function multiDuty(d:any,source=''){return Number(d?.pump_quantity||0)>1||/\b[2-9]\d*\s*duty\b/i.test(String(d?.duty_configuration||source))}
function questionText(q:SmartQuestion){
  return q.options?.length?`${q.prompt}\n${q.options.map(o=>`${o.key}. ${o.label}`).join('\n')}`:q.prompt;
}
function buildSmartQuestions(d:any,source:string,aiQuestions:string[]=[]){
  const questions:SmartQuestion[]=[];
  if(d.flow_value===null||d.flow_value===undefined)questions.push({field:'flow',label:'Required Flow',prompt:'What is the required flow rate? Please include the unit (for example 600 L/min, 30 m3/hr, or 10 L/s).'});
  if(d.head_value===null||d.head_value===undefined)questions.push({field:'head',label:'Required Head',prompt:'What is the required head or pressure? Please include the unit (for example 45 m, 3 bar, or 300 kPa).'});
  for(const q of aiQuestions){
    if(questions.length>=3)break;
    const clean=String(q||'').trim();if(!clean)continue;
    if(!/contradict|conflict|ambiguous|unclear|confirm which/i.test(clean))continue;
    if(questions.some(existing=>existing.prompt.toLowerCase()===clean.toLowerCase()))continue;
    questions.push({field:`conflict_${questions.length+1}`,label:'Confirmation',prompt:clean});
  }
  return questions.slice(0,3);
}
function clarificationText(questions:SmartQuestion[]){
  if(!questions.length)return '';
  const heading=questions.length===1?'Thank you. I need one more detail before preparing the requirements:':'Thank you. I need a few details before preparing the requirements:';
  const body=questions.map((q,i)=>{
    const options=q.options?.length?`\n${q.options.map(o=>`   ${o.key}. ${o.label}`).join('\n')}`:'';
    return `${i+1}. ${q.prompt}${options}`;
  }).join('\n\n');
  const choiceQuestions=questions.filter(q=>q.options?.length);
  const example=choiceQuestions.length?`\n\nYou can reply with the choices together, for example: ${choiceQuestions.map((q)=>`${questions.indexOf(q)+1}${q.options?.[0]?.key||'a'}`).join(', ')}. Free-text answers are also fine.`:'\n\nYou can reply in normal text.';
  return `${heading}\n\n${body}${example}`;
}
function smartQuestionsFrom(value:any):SmartQuestion[]{
  return (Array.isArray(value)?value:[]).map((q:any)=>({
    field:String(q?.field||''),label:String(q?.label||''),prompt:String(q?.prompt||''),
    options:Array.isArray(q?.options)?q.options.map((o:any)=>({key:String(o?.key||'').toLowerCase(),label:String(o?.label||'')})).filter((o:SmartOption)=>o.key&&o.label):undefined
  })).filter((q:SmartQuestion)=>q.field&&q.prompt).slice(0,3);
}
function choiceSegments(text:string){
  const s=String(text||'');const re=/(\d+)\s*([abc])(?=$|[\s,;:/-])/gi;const matches=[...s.matchAll(re)];
  return matches.map((m,i)=>({number:Number(m[1]),choice:String(m[2]).toLowerCase(),extra:s.slice((m.index||0)+m[0].length,i+1<matches.length?(matches[i+1].index||s.length):s.length).replace(/^[\s,;:/-]+|[\s,;:/-]+$/g,'').trim()}));
}
function interpretSmartReply(text:string,questions:SmartQuestion[]){
  const overrides:any={};const understood:string[]=[];let recognized=0;
  for(const seg of choiceSegments(text)){
    const q=questions[seg.number-1];if(!q?.options?.some(o=>o.key===seg.choice))continue;
    if(q.field==='flow_basis'){
      if(seg.choice==='a'){overrides.flow_basis='total_system';understood.push(`Question ${seg.number} Flow Basis = Total system flow`);recognized++;}
      if(seg.choice==='b'){overrides.flow_basis='per_duty_pump';understood.push(`Question ${seg.number} Flow Basis = Flow per duty pump`);recognized++;}
    }else if(q.field==='fluid'){
      if(seg.choice==='a'){overrides.fluid='Water';understood.push(`Question ${seg.number} Fluid = Water`);recognized++;}
      else if(seg.choice==='b'){overrides.fluid='Oil';understood.push(`Question ${seg.number} Fluid = Oil`);recognized++;}
      else if(seg.choice==='c'&&seg.extra){overrides.fluid=seg.extra;understood.push(`Question ${seg.number} Fluid = ${seg.extra}`);recognized++;}
    }else if(q.field==='power_supply'){
      if(seg.choice==='a'){Object.assign(overrides,{voltage:415,phase:'3 Phase',frequency_hz:50});understood.push(`Question ${seg.number} Power Supply = 415V / 3Ph / 50Hz`);recognized++;}
      else if(seg.choice==='b'){Object.assign(overrides,{voltage:240,phase:'1 Phase',frequency_hz:50});understood.push(`Question ${seg.number} Power Supply = 240V / 1Ph / 50Hz`);recognized++;}
      else if(seg.choice==='c'&&seg.extra){const facts=extractFacts(seg.extra);if(facts.voltage!==null)overrides.voltage=facts.voltage;if(facts.phase)overrides.phase=facts.phase;if(facts.frequency_hz!==null)overrides.frequency_hz=facts.frequency_hz;understood.push(`Question ${seg.number} Power Supply = ${seg.extra}`);recognized++;}
    }
  }
  return {overrides,recognized,semantic:understood.length?understood.join('\n'):''};
}
function applyOverrides(d:any,overrides:any){
  Object.entries(overrides||{}).forEach(([key,value])=>{if(value!==null&&value!==undefined&&value!=='')d[key]=value});
  if(d.fluid)d.fluid=normalFluid(d.fluid);
  return d;
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return json({ok:false,error:'POST required.'},405);
  try{
    const supabaseUrl=env('SUPABASE_URL');
    const serviceKey=env('SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY');
    if(!supabaseUrl||!serviceKey)throw new Error('Supabase function environment is incomplete.');
    const service=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const payload=await req.json().catch(()=>null) as any;

    // V4.12.18 Inbox PDF: same server PDF as Telegram attachment.
    if(payload?.action==='generate_curve_pdf'){
      const authHeader=req.headers.get('Authorization')||'';
      const jwt=authHeader.replace(/^Bearer\s+/i,'').trim();
      if(!jwt)return json({ok:false,error:'Authentication required.'},401);
      const userResult=await service.auth.getUser(jwt);
      if(userResult.error||!userResult.data?.user)return json({ok:false,error:'Invalid KeySuite session.'},401);
      const enquiryId=String(payload?.enquiry_id||'').trim();
      if(!enquiryId)return json({ok:false,error:'enquiry_id is required.'},400);
      const rowResult=await service.from('ks_keyai_enquiries').select('id,status,raw_message,ai_result,parent_enquiry_id').eq('id',enquiryId).maybeSingle();
      if(rowResult.error)throw rowResult.error;
      const row=rowResult.data as any;
      if(!row)return json({ok:false,error:'Curve enquiry not found.'},404);
      const d=row.ai_result&&typeof row.ai_result==='object'?row.ai_result:{};
      const family=String(d.pump_family||'').toUpperCase(),q=Number(d.flow_value),h=Number(d.head_value),pole=Number(d.es_pole||0);
      if((family!=='CHC'&&family!=='ES')||!(q>0&&h>0))return json({ok:false,error:'This enquiry does not contain a complete curve request.'},400);
      if(family==='ES'&&pole!==2&&pole!==4)return json({ok:false,error:'ES pole information is missing.'},400);
      const dutyText=String(d.duty_text||dutyDisplay(String(row.raw_message||''),q,h).duty_text);
      const pdfMeta=await generateCurvePdf(family,q,h,dutyText,env('KEYSUITE_PUBLIC_URL'),family==='ES'?pole:0);
      return new Response(pdfMeta.bytes,{status:200,headers:{...corsHeaders,'Content-Type':'application/pdf','Content-Disposition':`inline; filename="${pdfMeta.filename}"`,'Cache-Control':'no-store'}});
    }

    const telegramToken=env('TELEGRAM_BOT_TOKEN','KeySuiteBot_Token');
    const webhookSecret=env('TELEGRAM_WEBHOOK_SECRET','KeySuiteBot_TELEGRAM_WEBHOOK_SECRET');
    if(!telegramToken)throw new Error('Telegram bot token secret is missing.');
    if(!webhookSecret)throw new Error('Telegram webhook secret is missing.');
    const supplied=req.headers.get('X-Telegram-Bot-Api-Secret-Token')||'';
    if(supplied!==webhookSecret)return json({ok:false,error:'Invalid Telegram webhook secret.'},401);

    const update=payload;
    const message=update?.message||update?.edited_message||null;
    if(!message)return json({ok:true,ignored:true});
    const text=String(message?.text||message?.caption||'').trim();
    const chatId=String(message?.chat?.id||'');
    if(!text){await telegramSend(telegramToken,chatId,'Thank you. Please send your pump or quotation enquiry as a text message.');return json({ok:true,ignored:true,reason:'non-text'})}

    // V4.12.00 Unified Supabase: Telegram, KeyAI and KeySuite data all live in this project.
    const updateId=Number.isFinite(Number(update?.update_id))?Number(update.update_id):null;
    if(updateId!==null){
      const existing=await service.from('ks_keyai_enquiries').select('id,status').eq('source','telegram').eq('external_update_id',updateId).maybeSingle();
      if(existing.data?.id)return json({ok:true,duplicate:true,id:existing.data.id,status:existing.data.status});
    }

    const senderName=[message?.from?.first_name,message?.from?.last_name].filter(Boolean).join(' ').trim();
    const senderUsername=String(message?.from?.username||'');
    const senderId=String(message?.from?.id||'').trim();
    const keySuiteCompanyId=env('KEYSUITE_COMPANY_ID');
    let senderContext:any={assigned:false,keysuite_company_id:keySuiteCompanyId||null,sender_id:senderId||null,customer_id:null,customer_name:null,pricing_category_id:null,pricing_category_name:null,response_mode:'nothing'};
    if(keySuiteCompanyId&&senderId){
      const touched=await service.rpc('keysuite_v40903_touch_keyai_sender',{
        p_company_id:keySuiteCompanyId,p_sender_id:senderId,p_sender_username:senderUsername,p_sender_name:senderName
      });
      if(touched.error){
        console.error('[KeySuite V4.12.05] Sender/company lookup failed',touched.error);
      }else{
        const first=Array.isArray(touched.data)?touched.data[0]:touched.data;
        senderContext={...senderContext,...(first?.row_data||first||{})};
      }
      const modeRow=await service.from('ks_keyai_sender_customer_v40903')
        .select('response_mode')
        .eq('keysuite_company_id',keySuiteCompanyId)
        .eq('channel','telegram')
        .eq('sender_id',senderId)
        .maybeSingle();
      if(modeRow.error){
        console.error('[KeySuite V4.12.05] Sender mode lookup failed',modeRow.error);
      }else{
        senderContext.response_mode=senderResponseMode(modeRow.data?.response_mode);
      }
    }
    const responseMode=senderResponseMode(senderContext.response_mode);
    senderContext.response_mode=responseMode;
    const settingsResult=await service.from('ks_app_settings').select('keyai_openai_enabled,keyai_openai_model').eq('id','default').maybeSingle();
    if(settingsResult.error)throw settingsResult.error;
    const openAiEnabled=!!settingsResult.data?.keyai_openai_enabled;
    const model=String(settingsResult.data?.keyai_openai_model||'gpt-5-mini');

    const activeSince=new Date(Date.now()-7*24*60*60*1000).toISOString();
    const activeResult=await service.from('ks_keyai_enquiries')
      .select('id,conversation_id,raw_message,ai_result,clarification_question,clarification_questions,updated_at')
      .eq('source','telegram').eq('external_chat_id',chatId).is('parent_enquiry_id',null).eq('status','awaiting_customer')
      .gte('updated_at',activeSince).order('updated_at',{ascending:false}).limit(1).maybeSingle();
    if(activeResult.error)throw activeResult.error;
    const active=activeResult.data||null;

    const fullAutomation=responseMode==='curve_price'&&openAiEnabled;
    const initialStatus=responseMode==='nothing'
      ?'sender_mode_nothing'
      :(responseMode==='curve_only'?'received':(openAiEnabled?'processing':'ai_disabled_manual_review'));
    const insertPayload:any={
      source:'telegram',external_update_id:updateId,external_message_id:Number(message?.message_id||0)||null,
      external_chat_id:chatId,sender_username:senderUsername||null,sender_name:senderName||null,
      raw_message:text,status:initialStatus,ai_enabled:fullAutomation,ai_model:fullAutomation?model:null,
      parent_enquiry_id:active?.id||null,conversation_id:active?(active.conversation_id||active.id):null,
      external_sender_id:senderId||null,keyai_company_id:keySuiteCompanyId||null,keyai_customer_id:senderContext.customer_id||null
    };
    const insertResult=await service.from('ks_keyai_enquiries').insert(insertPayload).select('id').single();
    if(insertResult.error)throw insertResult.error;
    const enquiryId=insertResult.data.id;
    const rootId=active?.id||enquiryId;
    if(!active)await service.from('ks_keyai_enquiries').update({conversation_id:enquiryId}).eq('id',enquiryId);

    // V4.12.08: Global AI ON is only a master enable switch. The sender/company
    // mode decides what automation this Telegram sender is allowed to receive.
    if(responseMode==='nothing'){
      return json({ok:true,id:rootId,status:'sender_mode_nothing',response_mode:responseMode,automated_reply:false});
    }

    // V4.12.08: the Telegram structured curve path is deterministic and zero-token. Flow + Head + an
    // explicit CHC/ES family is handled before OpenAI, so there is no
    // OpenAI token charge for a complete structured duty request.
    const curveSource=active?`${active.raw_message||''}\n${text}`:text;
    const previousCurve=active?.ai_result&&typeof active.ai_result==='object'?active.ai_result:{};
    const curveFacts=extractFacts(curveSource);

    // V4.12.14: follow-up answers are merged as structured state, not by
    // re-interpreting the whole conversation as a brand-new request.
    // Example:
    // root: "ES 30 m3/hr @ 20 Mtr" -> waiting for es_pole
    // reply: "4Pole" -> keep ES/flow/head from root and apply only pole=4.
    const currentFamily=curveFamily(text);
    const priorFamily=previousCurve.pump_family||curveFamily(String(active?.raw_message||''))||null;
    const family=currentFamily||priorFamily||curveFamily(curveSource)||null;
    const currentEsPole=curveEsPole(text);
    const priorEsPole=previousCurve.es_pole||curveEsPole(String(active?.raw_message||''))||null;
    const esPole=family==='ES'
      ?(currentEsPole==='AMBIGUOUS'?'AMBIGUOUS':(currentEsPole||priorEsPole||null))
      :null;
    const curveFlow=curveFacts.flow_value??previousCurve.flow_value??null;
    const curveHead=curveFacts.head_value??previousCurve.head_value??null;
    const curveIntent=!!(family||previousCurve.intent==='curve'||(curveFlow!==null&&curveHead!==null));
    if(curveIntent){
      const display=dutyDisplay(curveSource,curveFlow,curveHead);
      const curveResult:any={
        intent:'curve',
        pump_family:family==='AMBIGUOUS'?null:family,
        es_pole:family==='ES'&&esPole!=='AMBIGUOUS'&&esPole?Number(esPole):null,
        pump_speed_rpm:family==='ES'&&esPole!=='AMBIGUOUS'&&esPole?esPoleRpm(esPole):null,
        flow_value:curveFlow,flow_unit:curveFlow===null?null:'m³/hr',
        head_value:curveHead,head_unit:curveHead===null?null:'m',
        flow_text:display.flow_text,head_text:display.head_text,duty_text:display.duty_text,
        processing_engine:'deterministic',
        openai_used:false
      };
      const missing:string[]=[];
      if(family==='AMBIGUOUS')missing.push('Please choose only one pump family: CHC or ES.');
      else if(!family)missing.push('Please confirm the pump family: CHC or ES.');
      else if(family==='ES'&&esPole==='AMBIGUOUS')missing.push('Please choose only one ES speed: 2 Pole or 4 Pole.');
      else if(family==='ES'&&!esPole)missing.push('ES 2 Pole or 4 Pole?');
      if(curveFlow===null)missing.push('Please provide the required flow with its unit.');
      if(curveHead===null)missing.push('Please provide the required head or pressure with its unit.');
      if(missing.length){
        curveResult.clarification_questions=missing;
        curveResult.awaiting_field=(family==='ES'&&!esPole)?'es_pole':(!family?'pump_family':(curveFlow===null?'flow':(curveHead===null?'head':null)));
        await service.from('ks_keyai_enquiries').update({status:'awaiting_customer',ai_summary:'Telegram curve request',ai_result:curveResult,clarification_questions:missing,clarification_question:missing.join('\n'),updated_at:new Date().toISOString()}).eq('id',rootId);
        if(active)await service.from('ks_keyai_enquiries').update({status:'followup_processed',updated_at:new Date().toISOString()}).eq('id',enquiryId);
        await telegramSend(telegramToken,chatId,missing.join('\n'));
        return json({ok:true,id:rootId,status:'awaiting_customer',curve:true,clarification_questions:missing});
      }
      const curveUrl=selectorCurveUrl(env('KEYSUITE_PUBLIC_URL'),String(family),Number(curveFlow),Number(curveHead),display,esPole);
      if(!curveUrl){
        const error='KEYSUITE_PUBLIC_URL is not configured for Telegram curve links.';
        await service.from('ks_keyai_enquiries').update({status:'ai_error_manual_review',ai_error:error,ai_result:curveResult,updated_at:new Date().toISOString()}).eq('id',rootId);
        await telegramSend(telegramToken,chatId,'The curve request is complete, but the KeySuite curve link is not configured. Please contact the KeySuite administrator.');
        return json({ok:true,id:rootId,status:'ai_error_manual_review',curve:true,error});
      }
      curveResult.selector_url=curveUrl;curveResult.selector_engine=family==='CHC'?'KeyCHC manual Selector':`KeyES ${Number(esPole)} Pole Selector`;
      delete curveResult.awaiting_field;
      let pdfMeta:any=null,pdfError='';
      try{
        pdfMeta=await generateCurvePdf(String(family),Number(curveFlow),Number(curveHead),display.duty_text,env('KEYSUITE_PUBLIC_URL'),family==='ES'?Number(esPole):0);
        curveResult.pdf_filename=pdfMeta.filename;
        curveResult.selected_model=pdfMeta.model;
        curveResult.motor_kw=pdfMeta.motor_kw;
        curveResult.motor_hp=pdfMeta.motor_hp;
        curveResult.efficiency=pdfMeta.efficiency;
        curveResult.npshr=pdfMeta.npshr;
        curveResult.shaft_kw=pdfMeta.shaft_kw;
        if(pdfMeta.pole)curveResult.es_pole=Number(pdfMeta.pole);
        if(pdfMeta.rpm)curveResult.pump_speed_rpm=Number(pdfMeta.rpm);
        if(pdfMeta.selector_core_version)curveResult.selector_core_version=pdfMeta.selector_core_version;
        if(pdfMeta.pdf_layout)curveResult.pdf_layout=pdfMeta.pdf_layout;
        if(pdfMeta.pdf_layout_version)curveResult.pdf_layout_version=pdfMeta.pdf_layout_version;
      }catch(error){
        pdfError=error instanceof Error?error.message:String(error);
        console.error('KeyBot curve PDF generation failed',pdfError);
      }
      await service.from('ks_keyai_enquiries').update({
        status:pdfMeta?'curve_ready':'curve_pdf_error',
        ai_enabled:false,
        ai_model:null,
        ai_summary:`${family==='ES'?esPoleLabel(esPole):family} curve · ${display.duty_text}${pdfMeta?` · ${pdfMeta.model}`:''}`,
        ai_result:curveResult,
        ai_error:pdfError||null,
        clarification_questions:[],
        clarification_question:null,
        updated_at:new Date().toISOString()
      }).eq('id',rootId);
      if(active)await service.from('ks_keyai_enquiries').update({status:'followup_processed',updated_at:new Date().toISOString()}).eq('id',enquiryId);
      if(pdfMeta){
        const sent=await telegramSendDocument(
          telegramToken,
          chatId,
          pdfMeta.bytes,
          pdfMeta.filename,
          `${family==='ES'?esPoleLabel(esPole):family} curve ready\n${display.duty_text}\nSelected: ${pdfMeta.model}`
        );
        if(!sent.ok){
          pdfError=`Telegram PDF send failed: ${sent.error||'Unknown error'}`;
          await service.from('ks_keyai_enquiries').update({status:'curve_pdf_error',ai_error:pdfError,updated_at:new Date().toISOString()}).eq('id',rootId);
          await telegramSend(telegramToken,chatId,`${family==='ES'?esPoleLabel(esPole):family} curve is ready, but the PDF could not be sent. Please contact KeySuite support.`);
        }
      }else{
        await telegramSend(telegramToken,chatId,`${family==='ES'?esPoleLabel(esPole):family} curve is ready, but the PDF could not be generated. Please contact KeySuite support.`);
      }
      return json({
        ok:true,id:rootId,status:pdfMeta&&!pdfError?'curve_ready':'curve_pdf_error',curve:true,response_mode:responseMode,
        family,es_pole:family==='ES'?Number(esPole):null,pump_speed_rpm:family==='ES'?esPoleRpm(esPole):null,
        flow_m3h:Number(curveFlow),head_m:Number(curveHead),
        duty_text:display.duty_text,selector_url:curveUrl,
        pdf_filename:pdfMeta?.filename||null,selected_model:pdfMeta?.model||null,pdf_error:pdfError||null,
        processing_engine:'deterministic',openai_used:false
      });
    }

    if(responseMode==='curve_only'){
      await service.from('ks_keyai_enquiries').update({
        status:'curve_only_manual_review',
        ai_enabled:false,
        ai_model:null,
        ai_summary:'Sender is limited to Curve Only; non-curve enquiry saved for manual review.',
        updated_at:new Date().toISOString()
      }).eq('id',rootId);
      if(active)await service.from('ks_keyai_enquiries').update({status:'followup_processed',updated_at:new Date().toISOString()}).eq('id',enquiryId);
      await telegramSend(telegramToken,chatId,'Thank you. Your enquiry has been received for manual review.');
      return json({ok:true,id:rootId,status:'curve_only_manual_review',response_mode:responseMode,openai:false});
    }

    if(responseMode==='curve_price'&&!senderContext.assigned){
      await service.from('ks_keyai_enquiries').update({
        status:'ai_error_manual_review',
        ai_enabled:false,
        ai_model:null,
        ai_error:'Curve & Price requires an assigned KeySuite company/customer.',
        updated_at:new Date().toISOString()
      }).eq('id',rootId);
      await telegramSend(telegramToken,chatId,'Thank you. Your enquiry has been received for manual review. Pricing access is not configured for this sender.');
      return json({ok:true,id:rootId,status:'ai_error_manual_review',response_mode:responseMode,openai:false});
    }

    if(!openAiEnabled){
      if(active)await service.from('ks_keyai_enquiries').update({status:'ai_disabled_manual_review',updated_at:new Date().toISOString()}).eq('id',active.id);
      await telegramSend(telegramToken,chatId,'Thank you. Your enquiry has been received. AI processing is currently disabled. Your enquiry has been saved for manual review.');
      return json({ok:true,id:rootId,openai:false,status:'ai_disabled_manual_review',response_mode:responseMode});
    }

    const baseInstructions=`You are KeyBot for KeySuite. Extract and update customer pump/system quotation requirements only. Do not select a pump model, calculate engineering performance, calculate prices, discounts, margins, commercial terms, or send a quotation. The API enforces the JSON schema. Use null only for genuinely unknown scalar values before defaults are applied and [] for empty arrays. B4.06.04 uses DEFAULT ASSUMPTIONS for unspecified normal enquiries: application/system = Booster System; if a pump quantity is stated, it is a system request; duty configuration = 1 Duty + remaining pumps On Demand (so 3 pumps = 1 Duty + 2 On Demand); flow_basis = per_duty_pump; fluid = Water; fluid_temperature = 10–70°C; power = 415V / 3Ph / 50Hz; material = Standard Material; elastomer = Standard; installation = Indoor; suction_condition = Flooded / Positive Suction. Explicit customer wording ALWAYS overrides these defaults, including total/system flow, standby arrangements, Oil/other fluids, non-standard temperature, voltage, material, elastomer, outdoor installation or suction lift. The only normally required inputs are FLOW and HEAD/PRESSURE. Do not ask the customer to confirm any default. clarification_questions should be empty when flow and head are known unless the customer's own wording contains a genuine contradiction/ambiguity that cannot be safely resolved. Preserve facts already confirmed by the customer. Normalize system_type to the actual system such as Booster System or Transfer System; keep duty_configuration separate. Normalize recognised flow units to m³/hr and recognised head/pressure units to metres of water head before returning the structured result. Keep the summary concise.`;
    const existingNormal=active?normaliseResult(active.ai_result,active.raw_message):null;
    const currentSmart=active?smartQuestionsFrom(existingNormal?.smart_followup_questions||active.ai_result?.smart_followup_questions):[];
    const interpreted=active?interpretSmartReply(text,currentSmart):{overrides:{},recognized:0,semantic:''};
    const aiInput=active
      ?`Existing extracted requirements:\n${JSON.stringify(existingNormal||{},null,2)}\n\nCurrent KeyBot follow-up questions:\n${currentSmart.map((q,i)=>`${i+1}. ${questionText(q)}`).join('\n\n')||String(active.clarification_question||'')}\n\nCustomer follow-up reply:\n${text}\n${interpreted.semantic?`\nDeterministically interpreted current choices:\n${interpreted.semantic}\n`:''}\nMerge the reply into the existing requirements. Treat the deterministic interpretations as authoritative. Remove resolved items from critical_missing_information and clarification_questions.`
      :text;
    const aiResponse=await fetch(`${supabaseUrl}/functions/v1/keyai-openai`,{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${serviceKey}`,'apikey':serviceKey},
      body:JSON.stringify({
        mode:active?'telegram-followup':'telegram',
        input:aiInput,
        instructions:baseInstructions,
        keySuiteContext:senderContext
      })
    });
    const aiData=await aiResponse.json().catch(()=>({}));
    if(!aiResponse.ok||!aiData?.ok){
      const error=String(aiData?.error||`KeyBot OpenAI HTTP ${aiResponse.status}`);
      await service.from('ks_keyai_enquiries').update({status:'ai_error_manual_review',ai_error:error,updated_at:new Date().toISOString()}).eq('id',rootId);
      if(active)await service.from('ks_keyai_enquiries').update({status:'ai_error_manual_review',ai_error:error}).eq('id',enquiryId);
      await telegramSend(telegramToken,chatId,'Thank you. Your enquiry has been received and saved for manual review.');
      return json({ok:true,id:rootId,openai:true,status:'ai_error_manual_review',error});
    }

    const parsed=parseAiJson(String(aiData.output||''));
    const source=active?`${active.raw_message}\n${text}`:text;
    const result=applyKeyAiDefaults(applyOverrides(normaliseResult(parsed,source,existingNormal),interpreted.overrides));
    // Keep the resolved KeySuite customer/pricing context with the enquiry without
    // requiring new columns in the separate KeyAI database. It is refreshed on every message.
    result.keySuiteContext=senderContext;
    const smart=buildSmartQuestions(result,source,strings(result.clarification_questions,6));
    result.smart_followup_questions=smart;
    result.clarification_questions=smart.map(questionText);
    // Keep status lists accurate after deterministic choice application.
    if(result.fluid)result.missing_information=strings(result.missing_information).filter(v=>!/fluid not specified|fluid being pumped/i.test(v));
    if(result.flow_basis)result.critical_missing_information=strings(result.critical_missing_information).filter(v=>!/total system flow|per duty pump|flow basis|whether .*flow/i.test(v));
    const summary=summaryFrom(result);
    const questions=result.clarification_questions;
    const questionTextJoined=questions.join('\n\n');
    const nextStatus=questions.length?'awaiting_customer':'ai_draft_ready';
    await service.from('ks_keyai_enquiries').update({
      status:nextStatus,ai_model:String(aiData.model||model),ai_summary:summary||null,ai_result:result,ai_error:null,
      clarification_questions:questions,clarification_question:questionTextJoined||null,updated_at:new Date().toISOString()
    }).eq('id',rootId);
    if(active)await service.from('ks_keyai_enquiries').update({status:'followup_processed',ai_model:String(aiData.model||model),ai_error:null,updated_at:new Date().toISOString()}).eq('id',enquiryId);

    if(smart.length)await telegramSend(telegramToken,chatId,clarificationText(smart));
    else await telegramSend(telegramToken,chatId,active?'Thank you. KeyBot has updated the quotation requirements and they are ready for review.':'Thank you. Your enquiry has been received. KeyBot has prepared the quotation requirements for review.');
    return json({ok:true,id:rootId,openai:true,status:nextStatus,response_mode:responseMode,clarification_questions:questions,smart_followup_questions:smart,keySuiteContext:senderContext});
  }catch(error){console.error(error);return json({ok:false,error:error instanceof Error?error.message:String(error)},500)}
});
