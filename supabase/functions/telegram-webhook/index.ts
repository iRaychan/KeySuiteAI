import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateCurvePdf, selectPumpSummary } from './curve-pdf.ts';

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
const env=(...names:string[])=>{for(const name of names){const value=Deno.env.get(name);if(value)return value}return ''};

type SmartOption={key:string;label:string};
type SmartQuestion={field:string;label:string;prompt:string;options?:SmartOption[]};

async function telegramSend(token:string,chatId:string,text:string,replyMarkup:any=null){
  if(!token||!chatId)return;
  const body:any={chat_id:chatId,text};if(replyMarkup)body.reply_markup=replyMarkup;
  const response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
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


type TelegramButton={text:string;callback_data:string};
function telegramKeyboard(rows:TelegramButton[][]){return {inline_keyboard:rows}}
function telegramReplyKeyboard(rows:string[][],oneTime=false){return {keyboard:rows.map(row=>row.map(text=>({text}))),resize_keyboard:true,one_time_keyboard:oneTime}}
function telegramRemoveKeyboard(){return {remove_keyboard:true}}
async function telegramAnswerCallback(token:string,callbackId:string,text=''){
  if(!token||!callbackId)return;
  try{await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({callback_query_id:callbackId,text,show_alert:false})})}catch(_){}
}
function cleanSearch(value:any){return String(value||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function levenshtein(a:string,b:string){
  a=cleanSearch(a);b=cleanSearch(b);if(!a)return b.length;if(!b)return a.length;
  const prev=Array.from({length:b.length+1},(_,i)=>i),cur=new Array(b.length+1).fill(0);
  for(let i=1;i<=a.length;i++){cur[0]=i;for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));for(let j=0;j<=b.length;j++)prev[j]=cur[j]}
  return prev[b.length];
}
function customerMatchScore(name:any,query:any){
  const n=cleanSearch(name),q=cleanSearch(query);if(!q||!n)return 9999;if(n===q)return 0;if(n.startsWith(q))return 10;if(n.split(' ').some(x=>x.startsWith(q)))return 20;if(n.includes(q))return 30;
  const words=n.split(' ');let best=levenshtein(n,q);for(const w of words)best=Math.min(best,levenshtein(w,q));const allowance=Math.max(1,Math.floor(q.length/3));return best<=allowance?50+best:9999;
}

type KeybotLearningRow={id:string;context:string;phrase:string;meaning:string;learning_type:string;confidence:number;usage_count:number};
function learningContextFromText(value:any){
  const s=String(value||'');
  if(/\bkey\s*plc\b/i.test(s))return 'keyplc';
  if(/\b(?:gws|tank|pressure\s*(?:tank|vessel))\b/i.test(s))return 'tank';
  if(/\b(?:chc|vms|vertical\s+multistage|es|pump)\b/i.test(s)||/@/.test(s))return 'pump';
  return 'global';
}
function normalLearningContext(value:any){const v=cleanSearch(value).replace(/\s+/g,'');return ['global','keyplc','pump','tank','customer'].includes(v)?v:'global'}
function escapeRegex(value:any){return String(value||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function learningProtected(value:any){
  const s=cleanSearch(value);
  if(!s)return true;
  return /\b(?:margin|discount|commission|pricing|price formula|permission|permissions|role|owner|admin|seal|quotation number|quote number|hydraulic|selector|sizing|vfd|hmi|standby|on demand|fuel price|currency rate)\b/i.test(s);
}
function learningReservedPhrase(value:any){const s=cleanSearch(value);return /^(?:hi|hello|hey|start|menu|curve|price|pricing|quotation|new request|options|done|learning|learned|teach|remember|forget)$/.test(s)}
function parseLearningTeachCommand(value:any){
  const raw=String(value||'').trim();
  const m=raw.match(/^(?:teach|remember)\s*(?:(global|key\s*plc|keyplc|pump|tank|customer)\s*)?[:\-]?\s*(.+?)\s*(?:=|->|means)\s*(.+?)\s*$/i);
  if(!m)return null;
  return {context:normalLearningContext(m[1]||'global'),phrase:String(m[2]||'').trim(),meaning:String(m[3]||'').trim()};
}
function parseLearningForgetCommand(value:any){
  const raw=String(value||'').trim();
  const m=raw.match(/^forget\s*(?:(global|key\s*plc|keyplc|pump|tank|customer)\s*)?[:\-]?\s*(.+?)\s*$/i);
  if(!m)return null;
  return {context:normalLearningContext(m[1]||'global'),phrase:String(m[2]||'').trim()};
}
async function applyKeybotLearning(service:any,companyId:string,value:any){
  const raw=String(value||'');if(!raw||!companyId)return {text:raw,used:[] as KeybotLearningRow[]};
  const ctx=learningContextFromText(raw),contexts=[...new Set(['global','customer',...(ctx==='keyplc'?['keyplc','pump']:ctx==='global'?[]:[ctx])])];
  const r=await service.from('ks_keybot_learning_v41400').select('id,context,phrase,meaning,learning_type,confidence,usage_count').eq('company_id',companyId).eq('status','approved').in('context',contexts).gte('confidence',0.7).order('phrase',{ascending:false});
  if(r.error){console.error('[KeySuite V4.14.00] Learning lookup failed',r.error);return {text:raw,used:[] as KeybotLearningRow[]}}
  const rows=(r.data||[]).filter((x:any)=>String(x.phrase||'').trim()&&String(x.meaning||'').trim()).sort((a:any,b:any)=>String(b.phrase).length-String(a.phrase).length);
  let text=raw;const used:any[]=[];
  for(const row of rows){
    const phrase=String(row.phrase||'').trim(),meaning=String(row.meaning||'').trim();if(!phrase||!meaning)continue;
    const boundary=/^[A-Za-z0-9]+$/.test(phrase)?`\\b${escapeRegex(phrase)}\\b`:escapeRegex(phrase);
    const re=new RegExp(boundary,'gi');
    if(re.test(text)){text=text.replace(re,meaning);used.push(row)}
  }
  for(const row of used){service.from('ks_keybot_learning_v41400').update({usage_count:Number(row.usage_count||0)+1,last_used_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',row.id).then(()=>{}).catch(()=>{})}
  return {text,used};
}
async function listKeybotLearning(service:any,companyId:string){
  const r=await service.from('ks_keybot_learning_v41400').select('id,context,phrase,meaning,learning_type,confidence,usage_count,updated_at').eq('company_id',companyId).eq('status','approved').order('usage_count',{ascending:false}).order('updated_at',{ascending:false}).limit(25);
  if(r.error)throw r.error;return r.data||[];
}
async function saveKeybotLearning(service:any,companyId:string,user:any,input:any){
  const phrase=String(input?.phrase||'').trim(),meaning=String(input?.meaning||'').trim(),context=normalLearningContext(input?.context);
  if(!phrase||!meaning)throw new Error('Both the phrase and meaning are required.');
  if(phrase.length>80||meaning.length>120)throw new Error('Keep the phrase under 80 characters and the meaning under 120 characters.');
  if(learningReservedPhrase(phrase))throw new Error('That phrase is reserved by the KeyBot menu and cannot be learned.');
  if(learningProtected(phrase)||learningProtected(meaning))throw new Error('That rule affects protected pricing, security or engineering behaviour and cannot be learned.');
  const existing=await service.from('ks_keybot_learning_v41400').select('id').eq('company_id',companyId).eq('context',context).ilike('phrase',phrase).eq('status','approved').maybeSingle();
  const payload={company_id:companyId,context,phrase,meaning,learning_type:'alias',confidence:1,status:'approved',approved_by_email:String(user?.email||'').toLowerCase(),source:'telegram_owner',updated_at:new Date().toISOString()};
  if(existing.data?.id){const u=await service.from('ks_keybot_learning_v41400').update(payload).eq('id',existing.data.id).select('*').single();if(u.error)throw u.error;return u.data}
  const i=await service.from('ks_keybot_learning_v41400').insert({...payload,created_by_email:String(user?.email||'').toLowerCase()}).select('*').single();if(i.error)throw i.error;return i.data;
}
async function forgetKeybotLearning(service:any,companyId:string,user:any,input:any){
  const phrase=String(input?.phrase||'').trim(),context=normalLearningContext(input?.context);if(!phrase)throw new Error('Phrase is required.');
  const r=await service.from('ks_keybot_learning_v41400').update({status:'disabled',approved_by_email:String(user?.email||'').toLowerCase(),updated_at:new Date().toISOString()}).eq('company_id',companyId).eq('context',context).ilike('phrase',phrase).eq('status','approved').select('id');
  if(r.error)throw r.error;return (r.data||[]).length;
}
function parseFlowStep(text:string){
  const s=String(text||'').trim();const n=Number((s.match(/-?\d+(?:\.\d+)?/)||[])[0]);if(!(n>0))return null;
  const lower=s.toLowerCase().replace(/³/g,'3');let unit='m3h';
  if(/l\s*\/\s*s|\blps\b/.test(lower))unit='lps';else if(/l\s*\/\s*(?:m|min)|\blpm\b/.test(lower))unit='lpm';else if(/\bus\s*gpm\b|\busgpm\b/.test(lower))unit='usgpm';else if(/\bimp(?:erial)?\s*gpm\b|\bigpm\b/.test(lower))unit='igpm';
  const value=flowToM3h(n,unit);return value&&value>0?{value:Number(value.toFixed(3)),raw:s}:null;
}
function parseHeadStep(text:string){
  const s=String(text||'').trim();const n=Number((s.match(/-?\d+(?:\.\d+)?/)||[])[0]);if(!(n>0))return null;
  const lower=s.toLowerCase();let unit='m';if(/\bbar\b/.test(lower))unit='bar';else if(/\bkpa\b/.test(lower))unit='kpa';else if(/\bpsi\b/.test(lower))unit='psi';else if(/\bft\b|\bfeet\b|\bfoot\b/.test(lower))unit='ft';
  const value=headToM(n,unit);return value&&value>0?{value:Number(value.toFixed(3)),raw:s}:null;
}
function quoteFamilyFromText(text:any){
  const s=String(text||'');
  if(/\b(?:chc|vms|vertical\s+multistage(?:\s+inline\s+pump)?)\b/i.test(s))return 'CHC';
  if(/\bes\s*[- ]?4\s*(?:p|pole)?\b|\b4\s*(?:p|pole)\s*es\b/i.test(s))return 'ES4';
  if(/\bes\s*[- ]?2\s*(?:p|pole)?\b|\b2\s*(?:p|pole)\s*es\b/i.test(s))return 'ES2';
  if(/\bes\s*4\s*pole/i.test(s))return 'ES4';
  if(/\bes\s*2\s*pole/i.test(s))return 'ES2';
  if(/\bes\b/i.test(s))return 'ES';
  return '';
}

function parseDirectPumpModel(text:any){
  const raw=String(text||'');
  const chc=raw.match(/\b(?:CHC|VMS)\s*(\d{1,3})\s*-\s*(\d{1,3}(?:\s*-\s*\d{1,2})?(?:\s*-\s*\d{1,2})?)\b/i);
  if(chc)return {family:'CHC',model:`CHC ${chc[1]}-${String(chc[2]).replace(/\s+/g,'')}`};
  return null;
}
function parseKeyplcSystemRequest(text:any){
  const raw=String(text||'');if(!/\bkey\s*plc\b/i.test(raw))return null;
  let qty=0;
  const near=raw.match(/\bkey\s*plc\s*(\d+)\s*(?:p|pumps?)\b/i)||raw.match(/\b(\d+)\s*pumps?\s*(?:system)?\b/i);
  if(near)qty=Math.max(1,Math.min(6,Number(near[1])||0));
  const direct=parseDirectPumpModel(raw);
  return {system_type:'KEYPLC',system_pump_qty:qty||2,system_operation:'1 Duty + balance On Demand',panel_control:'VFD + HMI',...(direct?{direct_model:direct.model,family_code:direct.family}:{})};
}
function smartQuoteRequest(text:any){
  const raw=String(text||'').trim();
  const normalized=raw.toLowerCase().replace(/³/g,'3').replace(/m3\s*[.]\s*(?:hr|h)\b/g,'m3/hr').replace(/m3\s*(?:per|\\)\s*(?:hr|h)\b/g,'m3/hr');
  const request:any={raw_input:raw};
  const family=quoteFamilyFromText(raw);if(family)request.family_code=family;
  const directModel=parseDirectPumpModel(raw);if(directModel){request.direct_model=directModel.model;request.family_code=directModel.family;request.product_type='pump';}
  const keyplc=parseKeyplcSystemRequest(raw);if(keyplc){Object.assign(request,keyplc);request.product_type='keyplc_system';}
  const tankIntent=!keyplc&&/\b(?:gws|tank|pressure\s*(?:tank|vessel))\b/i.test(raw);
  const pumpIntent=!keyplc&&!tankIntent&&(!!family||!!directModel||/\bpump\b/i.test(raw)||/@/.test(raw)||/\bm3\s*\/?\s*(?:h|hr)\b/i.test(normalized));
  if(tankIntent)request.product_type='tank';else if(pumpIntent)request.product_type='pump';
  let qty:number|null=null;
  const qtyMatch=raw.match(/\b(?:qty\s*[:=]?\s*)?(\d+)\s*(?:x|units?|pcs?|sets?)\b/i)||raw.match(/\b(\d+)\s*x\s*(?=[a-z])/i);
  if(qtyMatch){const n=Number(qtyMatch[1]);if(n>0&&n<=999)qty=n}if(qty)request.qty=qty;
  const flowMatch=normalized.match(/(\d+(?:\.\d+)?)\s*(m3\s*\/?\s*(?:h|hr|hour)|m3h|m3ph|l\s*\/\s*s|lps|l\s*\/\s*(?:min|minute)|lpm|us\s*gpm|usgpm|imp(?:erial)?\s*gpm|igpm)\b/i);
  if(flowMatch){const q=flowToM3h(Number(flowMatch[1]),flowMatch[2]);if(q&&q>0){request.flow_m3h=Number(q.toFixed(3));request.flow_raw=flowMatch[0]}}
  let headMatch=normalized.match(/@\s*(\d+(?:\.\d+)?)\s*(mtr|metres?|meters?|m|ft|feet|foot|bar|kpa|psi)\b/i);
  if(!headMatch)headMatch=normalized.match(/(?:head\s*[:=]?\s*)(\d+(?:\.\d+)?)\s*(mtr|metres?|meters?|m|ft|feet|foot|bar|kpa|psi)?\b/i);
  if(!headMatch&&request.flow_m3h)headMatch=normalized.match(/\b(\d+(?:\.\d+)?)\s*(mtr|metres?|meters?|m|ft|feet|foot|bar|kpa|psi)\b(?!\s*3)/i);
  if(headMatch){const h=headToM(Number(headMatch[1]),headMatch[2]||'m');if(h&&h>0){request.head_m=Number(h.toFixed(3));request.head_raw=headMatch[0]}}
  if((!request.flow_m3h||!request.head_m)){const bare=normalized.match(/\b(\d+(?:\.\d+)?)\s*@\s*(\d+(?:\.\d+)?)\b/);if(bare){if(!request.flow_m3h)request.flow_m3h=Number(bare[1]);if(!request.head_m)request.head_m=Number(bare[2]);request.product_type=request.product_type||'pump'}}
  if(tankIntent){
    const size=normalized.match(/\b(\d+(?:\.\d+)?)\s*(?:l|ltr|litres?|liters?)\b/i);if(size)request.tank_size_litres=Number(size[1]);
    const pressure=normalized.match(/\b(\d+(?:\.\d+)?)\s*bar\b/i);if(pressure)request.tank_pressure_bar=Number(pressure[1]);
    const model=raw.match(/\bmodel\s*[:=]?\s*([a-z0-9][a-z0-9._\/-]{1,30})/i);if(model)request.tank_model_hint=model[1];
  }
  if(!tankIntent){const options=parsePumpOptionsText(raw);if(Object.keys(options).length)request.options=options;}
  return request;
}
function parsePumpOptionsText(text:any){
  const s=String(text||'');const out:any={};
  if(/\bss\s*316\b|\b316\s*(?:ss|stainless)?\b/i.test(s))out.material='SS316';
  else if(/\bss\s*304\b|\b304\s*(?:ss|stainless)?\b/i.test(s))out.material='SS304';
  if(/\bie\s*5\b/i.test(s))out.motor_efficiency='IE5';else if(/\bie\s*4\b/i.test(s))out.motor_efficiency='IE4';else if(/\bie\s*2\b/i.test(s))out.motor_efficiency='IE2';else if(/\bie\s*3\b/i.test(s))out.motor_efficiency='IE3';
  if(/\bsi?c\s*[\/-]\s*si?c\b/i.test(s))out.seal='SiC/SiC';else if(/\btc\s*[\/-]\s*tc\b/i.test(s))out.seal='TC/TC';else if(/\bcarbon\s*[\/-]\s*si?c\b/i.test(s))out.seal='Carbon/SiC';
  if(/\bepdm\b/i.test(s))out.elastomer='EPDM';else if(/\bnbr\b/i.test(s))out.elastomer='NBR';else if(/\bviton\b/i.test(s))out.elastomer='Viton';
  if(/\boval\s*(?:flange)?\b/i.test(s))out.connection='Oval Flange';else if(/\bround\s*(?:flange)?\b/i.test(s))out.connection='Round Flange';
  if(/\bbare\s*shaft\b/i.test(s))out.bare_shaft=true;
  return out;
}
function pumpOptions(existing:any={},qty:any=1){
  const o=existing&&typeof existing==='object'?existing:{};return {
    material:['Standard','SS304','SS316'].includes(String(o.material))?String(o.material):'Standard',
    motor_efficiency:['IE2','IE3','IE4','IE5'].includes(String(o.motor_efficiency))?String(o.motor_efficiency):'IE3',
    seal:['Carbon/SiC','SiC/SiC','TC/TC'].includes(String(o.seal))?String(o.seal):'Carbon/SiC',
    elastomer:['Viton','EPDM','NBR'].includes(String(o.elastomer))?String(o.elastomer):'Viton',
    connection:['Round Flange','Oval Flange'].includes(String(o.connection))?String(o.connection):'Round Flange',
    bare_shaft:!!o.bare_shaft,qty:Math.max(1,Math.min(999,Math.trunc(Number(o.qty||qty)||1)))
  };
}
function mergePumpOptions(base:any,next:any,qty:any=1){return pumpOptions({...pumpOptions(base,qty),...(next&&typeof next==='object'?next:{})},qty)}
function pumpOptionSummary(item:any){const o=pumpOptions(item?.options,item?.qty);return [`Material: ${o.material}`,`Motor: ${o.motor_efficiency}`,`Seal: ${o.seal} / ${o.elastomer}`,`Connection: ${o.connection}`,`Bare Shaft: ${o.bare_shaft?'Yes':'No'}`,`Quantity: ${o.qty}`].join('\n')}
function pumpOptionsMenu(){return telegramReplyKeyboard([['Material','Motor'],['Seal','Connection'],['Bare Shaft','Quantity'],['✅ Done','⬅️ Main Menu']])}
function pumpResultMenu(mode:any){if(mode==='curve')return simpleCurveMenu();if(mode==='price')return simplePriceMenu(true);return telegramReplyKeyboard([['📈 Curve PDF','⚙️ Options'],['🔄 New Request']])}
function applyPumpOptionsToItem(item:any,options:any){
  const o=pumpOptions(options,item?.qty);let model=String(item?.model||'');
  if(String(item?.family||'').toUpperCase()==='CHC'){
    const base=model.replace(/^CHCS\b/i,'CHC').replace(/^CHCN\b/i,'CHC');
    model=o.material==='SS304'?base.replace(/^CHC\b/i,'CHCS'):o.material==='SS316'?base.replace(/^CHC\b/i,'CHCN'):base;
  }
  return {...item,model,qty:o.qty,options:o};
}
function activeQuoteFromSession(session:any){
  const c=sessionContext(session);if(session?.selected_customer_id&&c.keysuite_user_email){return {customer_id:String(session.selected_customer_id),customer_name:String(c.customer_name||'Selected Customer'),keysuite_user_email:String(c.keysuite_user_email||''),draft_items:draftItemsFrom(session)}}
  const a=c.active_quote;return a&&a.customer_id&&a.keysuite_user_email?{...a,draft_items:Array.isArray(a.draft_items)?a.draft_items:[]}:null;
}
function mergeQuoteRequest(base:any,next:any){
  const out={...(base&&typeof base==='object'?base:{}),...(next&&typeof next==='object'?next:{})};
  if(!out.qty)out.qty=1;return out;
}
function hasQuoteTechnicalFacts(req:any){return !!(req?.product_type||req?.flow_m3h||req?.head_m||req?.family_code||req?.direct_model||req?.system_type||req?.tank_size_litres||req?.tank_pressure_bar||req?.tank_model_hint||Number(req?.qty)>1)}
function customerQueryFromQuoteText(text:any,req:any={}){
  let s=String(text||'');
  s=s.replace(/\b(?:quote|quotation|please|prepare|need|for)\b/ig,' ')
    .replace(/\b(?:qty\s*[:=]?\s*)?\d+\s*(?:x|units?|pcs?|sets?)\b/ig,' ')
    .replace(/\b(?:chc|es\s*[- ]?[24]\s*(?:p|pole)?|pump|gws|tank|pressure\s*(?:tank|vessel))\b/ig,' ')
    .replace(/\d+(?:\.\d+)?\s*(?:m3|m³)\s*[./]?\s*(?:h|hr|hour)\b/ig,' ')
    .replace(/@\s*\d+(?:\.\d+)?\s*(?:mtr|metres?|meters?|m|ft|feet|foot|bar|kpa|psi)?\b/ig,' ')
    .replace(/\b\d+(?:\.\d+)?\s*(?:l|ltr|litres?|liters?|bar)\b/ig,' ')
    .replace(/\bmodel\s*[:=]?\s*[a-z0-9._\/-]+\b/ig,' ')
    .replace(/[,@;|]+/g,' ');
  return s.replace(/\s+/g,' ').trim();
}
async function keybotSession(service:any,companyId:string,chatId:string,senderId:string){
  if(!companyId||!chatId||!senderId)return null;
  const r=await service.from('ks_keybot_sessions_v41300').select('*').eq('keysuite_company_id',companyId).eq('channel','telegram').eq('chat_id',chatId).eq('sender_id',senderId).maybeSingle();
  if(r.error){console.error('[KeySuite V4.14.00] Session lookup failed',r.error);return null}
  const row:any=r.data||null;if(!row)return null;const age=Date.now()-new Date(row.updated_at||0).getTime(),c=row.context&&typeof row.context==='object'?row.context:{};const hasDraft=Array.isArray(c.draft_items)&&c.draft_items.length>0;return age>(hasDraft?30*24:12)*60*60*1000?null:row;
}
async function saveKeybotSession(service:any,companyId:string,chatId:string,senderId:string,patch:any){
  if(!companyId||!chatId||!senderId)return null;
  const payload={keysuite_company_id:companyId,channel:'telegram',chat_id:chatId,sender_id:senderId,...patch,updated_at:new Date().toISOString()};
  const r=await service.from('ks_keybot_sessions_v41300').upsert(payload,{onConflict:'keysuite_company_id,channel,chat_id,sender_id'}).select('*').single();
  if(r.error){console.error('[KeySuite V4.14.00] Session save failed',r.error);return null}return r.data;
}
async function linkedKeySuiteUser(service:any,companyId:string,senderId:string){
  if(!companyId||!senderId)return null;
  const map=await service.from('ks_keyai_sender_customer_v40903').select('keysuite_user_email').eq('keysuite_company_id',companyId).eq('channel','telegram').eq('sender_id',senderId).maybeSingle();
  if(map.error){console.error('[KeySuite V4.14.00] Telegram user link lookup failed',map.error);return null}
  const email=String(map.data?.keysuite_user_email||'').trim().toLowerCase();if(!email)return null;
  const access=await service.from('ks_user_access').select('email,display_name,role,active,company_id').eq('company_id',companyId).ilike('email',email).eq('active',true).maybeSingle();
  if(access.error||!access.data)return null;
  const role=String(access.data.role||'user').trim().toLowerCase();
  const privilegedRole=role==='owner'||role==='admin';
  let viewCustomers=privilegedRole?'all':'assigned';
  if(!privilegedRole){
    const pr=await service.from('ks_role_permissions').select('permissions').eq('company_id',companyId).ilike('role',role).maybeSingle();
    const p:any=pr.data?.permissions||{};viewCustomers=String(p.view_customers||viewCustomers).toLowerCase();
  }
  return {...access.data,email,role,view_customers:viewCustomers};
}
async function findAllowedCustomers(service:any,companyId:string,user:any,query:string){
  if(!user||String(user.view_customers||'none')==='none')return [];
  let q=service.from('ks_customers').select('id,company_name,assigned_user_email,status').eq('company_id',companyId).eq('status','active');
  if(String(user.view_customers)!=='all')q=q.ilike('assigned_user_email',String(user.email||''));
  const r=await q.limit(300);if(r.error){console.error('[KeySuite V4.14.00] Customer search failed',r.error);return []}
  return (r.data||[]).map((x:any)=>({...x,score:customerMatchScore(x.company_name,query)})).filter((x:any)=>x.score<9999).sort((a:any,b:any)=>a.score-b.score||String(a.company_name).localeCompare(String(b.company_name))).slice(0,8);
}
async function allowedCustomerById(service:any,companyId:string,user:any,id:string){
  if(!user||!id||String(user.view_customers||'none')==='none')return null;
  let q=service.from('ks_customers').select('id,company_name,assigned_user_email,status').eq('company_id',companyId).eq('id',id).eq('status','active');
  if(String(user.view_customers)!=='all')q=q.ilike('assigned_user_email',String(user.email||''));
  const r=await q.maybeSingle();return r.error?null:r.data;
}
function mainMenuMarkup(){return telegramReplyKeyboard([['🔄 New Request']])}
function simpleCurveMenu(){return telegramReplyKeyboard([['⚙️ Options','💰 Check Price'],['🔄 New Request']])}
function simplePriceMenu(hasCurve=true){return hasCurve?telegramReplyKeyboard([['📈 Curve PDF','⚙️ Options'],['🔄 New Request']]):telegramReplyKeyboard([['🔄 New Request']])}
function money(value:any){return `RM ${Number(value||0).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})}`}
function parseJsonObject(value:any){if(!value)return {};if(typeof value==='object'&&!Array.isArray(value))return value;try{const parsed=JSON.parse(String(value));return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{}}catch(_){return {}}}
function pricingRarity(value:any){const v=String(value||'common').toLowerCase();return ['common','many','rare','fixed'].includes(v)?v:'common'}
function pricingBool(value:any,fallback=true){return value===undefined||value===null?fallback:!!value}
function pricingRule(category:any,family:string){
  const fam=String(family||'CHC').toUpperCase(),rules=parseJsonObject(category?.product_rules),raw=parseJsonObject(rules?.[fam]);
  const fallback=fam==='CHC'?{margin:Number(category?.chc_margin??category?.chc_factor??.38),normal:0,rare:0,transport:Number(category?.transport??30),useCommission:true,useSetDiscount:true,useFinalDiscount:true,useFuelCharge:true}:{margin:0,normal:0,rare:0,transport:0,useCommission:true,useSetDiscount:true,useFinalDiscount:true,useFuelCharge:true};
  return {margin:Number(raw.margin??fallback.margin),normal:Number(raw.normal??fallback.normal),rare:Number(raw.rare??fallback.rare),transport:Number(raw.transport??fallback.transport),useCommission:pricingBool(raw.useCommission??raw.use_commission??raw.includeCommission??raw.include_commission,fallback.useCommission),useSetDiscount:pricingBool(raw.useSetDiscount??raw.use_set_discount??raw.includeSetDiscount??raw.include_set_discount,fallback.useSetDiscount),useFinalDiscount:pricingBool(raw.useFinalDiscount??raw.use_final_discount??raw.includeFinalDiscount??raw.include_final_discount,fallback.useFinalDiscount),useFuelCharge:pricingBool(raw.useFuelCharge??raw.use_fuel_charge??raw.includeFuelCharge??raw.include_fuel_charge,fallback.useFuelCharge)};
}
function customerPricingRow(row:any={}){const q=row?.quotation||{};return {commission:Number(row?.commission??row?.quotation_commission??q?.commission??0),setDiscount:Number(row?.setDiscount??row?.set_discount??row?.quotation_set_discount??q?.setDiscount??0),finalDiscount:Number(row?.finalDiscount??row?.final_discount??row?.quotation_final_discount??q?.finalDiscount??0)}}
function productRates(settings:any,family:string){const fam=String(family||'CHC').toLowerCase();return {USD:Number(settings?.[`${fam}_usd_multiplier`]??settings?.usd_multiplier??5.8),RMB:Number(settings?.[`${fam}_rmb_multiplier`]??settings?.rmb_multiplier??.65),MYR:1}}
function calculateQuotedPrice(candidates:any[],rarityHint:any,rule:any,customerRates:any,ctx:any){
  const rows=(candidates||[]).filter(row=>Number(row?.sourcePrice)>0).map(row=>({...row,rarity:pricingRarity(row.rarity),baseMyr:Number(row.sourcePrice)*Number(row.multiplier||1)}));if(!rows.length)return null;
  const requested=pricingRarity(rarityHint),fixedRows=requested==='fixed'?rows:rows.filter(row=>row.rarity==='fixed'),pool=fixedRows.length?fixedRows:rows;
  const chosen=(fixedRows.length?pool.find(row=>row.currency==='MYR'):null)||pool.reduce((best,row)=>!best||row.baseMyr>best.baseMyr?row:best,null),rarity=pricingRarity(rarityHint||chosen.rarity),fixedPrice=rarity==='fixed';
  if(fixedPrice)return {finalPrice:chosen.baseMyr,fixedPrice:true,rarity,sourceCurrency:chosen.currency,sourcePrice:chosen.sourcePrice,multiplier:chosen.multiplier,baseMyr:chosen.baseMyr,fuelCharge:0};
  if(!(Number(rule.margin)>0))throw new Error('Category Margin is blank or 0%. Update Key → Category Pricing before quoting this pump.');
  const marginPrice=chosen.baseMyr/Math.max(.0001,1-Number(rule.margin||0));
  const afterNormal=(rarity==='common'||rarity==='rare')?marginPrice/Math.max(.0001,1-Number(rule.normal||0)):marginPrice;
  const afterRare=rarity==='rare'?afterNormal/Math.max(.0001,1-Number(rule.rare||0)):afterNormal;
  const withTransport=afterRare+Number(rule.transport||0);
  const afterCommission=rule.useCommission?withTransport/Math.max(.0001,1-Number(customerRates.commission||0)):withTransport;
  const afterSetDiscount=rule.useSetDiscount?afterCommission/Math.max(.0001,1-Number(customerRates.setDiscount||0)):afterCommission;
  const beforeFuel=rule.useFinalDiscount?afterSetDiscount/Math.max(.0001,1-Number(customerRates.finalDiscount||0)):afterSetDiscount;
  const fuelCharge=rule.useFuelCharge?Math.max(0,Number(ctx.distanceKm||0))*Math.max(Number(ctx.fuelPrice||2)-Number(ctx.fuelBasePrice||2),0):0;
  const unrounded=beforeFuel+fuelCharge,finalPrice=Math.ceil((unrounded-1e-9)/10)*10;
  return {finalPrice,fixedPrice:false,rarity,sourceCurrency:chosen.currency,sourcePrice:chosen.sourcePrice,multiplier:chosen.multiplier,baseMyr:chosen.baseMyr,fuelCharge,unroundedPrice:unrounded};
}
async function quotePumpForCustomer(service:any,customerId:string,item:any,keySuiteUserEmail:string,pricingOverride:any={}){
  const customerRes=await service.from('ks_customers').select('id,company_name,pricing_category_id,distance_km,status').eq('id',customerId).eq('status','active').maybeSingle();
  if(customerRes.error||!customerRes.data)throw new Error('Selected customer could not be loaded for pricing.');const customer:any=customerRes.data;
  if(!customer.pricing_category_id)throw new Error(`${customer.company_name} has no Pricing Category assigned.`);
  const [categoryRes,settingsRes]=await Promise.all([
    service.from('ks_pricing_categories').select('*').eq('id',customer.pricing_category_id).maybeSingle(),
    service.from('ks_app_settings').select('*').eq('id','default').maybeSingle()
  ]);
  if(categoryRes.error||!categoryRes.data)throw new Error('Customer Pricing Category could not be loaded.');
  if(settingsRes.error)throw new Error('KeySuite pricing settings could not be loaded.');
  const category:any=categoryRes.data,settings:any=settingsRes.data||{},family=String(item?.family||'CHC').toUpperCase(),rates=productRates(settings,family),baseRule=pricingRule(category,family),rule=pricingOverride?.skipSetDiscount?{...baseRule,useSetDiscount:false}:baseRule;
  // V4.13.10: load the exact same V2.22 customer-specific Commission / Set Discount /
  // Final Discount row used by the normal KeySuite quotation screen.
  const pricingRes=await service.rpc('keysuite_v41306_get_customer_pricing',{p_user_email:String(keySuiteUserEmail||''),p_customer_id:String(customerId||'')});
  if(pricingRes.error)throw new Error(`Customer-specific pricing could not be loaded: ${pricingRes.error.message||pricingRes.error}`);
  const pricingRow=(Array.isArray(pricingRes.data)?pricingRes.data[0]:pricingRes.data)||{};
  const companyRates=customerPricingRow(pricingRow);
  const ctx={distanceKm:Number(customer.distance_km||0),fuelPrice:Number(settings.fuel_price??2),fuelBasePrice:Number(settings.fuel_base_price??2)};
  let candidates:any[]=[],rarity:any='common',productId='',material='';
  if(family==='CHC'){
    const model=String(item?.model||'').replace(/^CHCS\b/i,'CHC').replace(/^CHCN\b/i,'CHC').trim();
    const productRes=await service.from('ks_products_chc').select('*').ilike('model',model).maybeSingle();if(productRes.error||!productRes.data)throw new Error(`No CHC price-list record was found for ${item?.model||model}.`);const p:any=productRes.data;productId=String(p.id||'');
    material=/^CHCS\b/i.test(String(item?.model||''))?'CHCS':/^CHCN\b/i.test(String(item?.model||''))?'CHCN':'CHC';const key=material.toLowerCase();
    candidates=['USD','RMB','MYR'].map(currency=>{const ck=currency.toLowerCase(),source=p[`${key}_${ck}`],r=p[`${key}_rarity_${ck}`]??'common';return {currency,sourcePrice:Number(source||0),multiplier:(rates as any)[currency],rarity:r}});rarity='';
  }else if(family==='ES'){
    const full=String(item?.model||'').trim(),stripped=full.replace(/^ES\s+/i,'').trim();let productRes=await service.from('ks_products_es').select('*').ilike('model',stripped).maybeSingle();if((productRes.error||!productRes.data)&&full!==stripped)productRes=await service.from('ks_products_es').select('*').ilike('model',full).maybeSingle();if(productRes.error||!productRes.data)throw new Error(`No ES price-list record was found for ${full}.`);const p:any=productRes.data;productId=String(p.id||'');rarity=pricingRarity(p.rarity||'common');
    const variants=Array.isArray(p.variants)?p.variants:[];const variant=variants.find((v:any)=>['priceUsd','priceRmb','priceMyr'].some(k=>Number(v?.[k])>0));if(!variant)throw new Error(`No ES source price is available for ${full}.`);material=String(variant.material||'');
    candidates=[{currency:'USD',sourcePrice:Number(variant.priceUsd||0),multiplier:rates.USD,rarity},{currency:'RMB',sourcePrice:Number(variant.priceRmb||0),multiplier:rates.RMB,rarity},{currency:'MYR',sourcePrice:Number(variant.priceMyr||0),multiplier:1,rarity}];
  }else throw new Error('Pricing is currently enabled for CHC and ES pump items only.');
  const calc=calculateQuotedPrice(candidates,rarity,rule,companyRates,ctx);if(!calc)throw new Error(`No valid ${family} USD, RMB or MYR source price is available for ${item?.model||'this pump'}.`);
  return {...item,unit_price:Number(calc.finalPrice||0),line_total:Number(calc.finalPrice||0)*Math.max(1,Number(item?.qty||1)),pricing:{product_family:family,product_id:productId,material,category_id:String(category.id||''),category_name:String(category.category_name||''),source_currency:calc.sourceCurrency,source_price:calc.sourcePrice,currency_multiplier:calc.multiplier,base_myr:calc.baseMyr,rarity:calc.rarity,fixed_price:!!calc.fixedPrice,fuel_charge:Number(calc.fuelCharge||0),calculated_price:Number(calc.finalPrice||0)}};
}
async function quoteGwsForCustomer(service:any,customerId:string,product:any,qty:any,keySuiteUserEmail:string){
  const customerRes=await service.from('ks_customers').select('id,company_name,pricing_category_id,distance_km,status').eq('id',customerId).eq('status','active').maybeSingle();
  if(customerRes.error||!customerRes.data)throw new Error('Selected customer could not be loaded for pricing.');const customer:any=customerRes.data;
  if(!customer.pricing_category_id)throw new Error(`${customer.company_name} has no Pricing Category assigned.`);
  const [categoryRes,settingsRes,pricingRes]=await Promise.all([
    service.from('ks_pricing_categories').select('*').eq('id',customer.pricing_category_id).maybeSingle(),
    service.from('ks_app_settings').select('*').eq('id','default').maybeSingle(),
    service.rpc('keysuite_v41306_get_customer_pricing',{p_user_email:String(keySuiteUserEmail||''),p_customer_id:String(customerId||'')})
  ]);
  if(categoryRes.error||!categoryRes.data)throw new Error('Customer Pricing Category could not be loaded.');if(settingsRes.error)throw new Error('KeySuite pricing settings could not be loaded.');if(pricingRes.error)throw new Error(`Customer-specific pricing could not be loaded: ${pricingRes.error.message||pricingRes.error}`);
  const category:any=categoryRes.data,settings:any=settingsRes.data||{},rates=productRates(settings,'GWS'),rule=pricingRule(category,'GWS'),pricingRow=(Array.isArray(pricingRes.data)?pricingRes.data[0]:pricingRes.data)||{},companyRates=customerPricingRow(pricingRow),ctx={distanceKm:Number(customer.distance_km||0),fuelPrice:Number(settings.fuel_price??2),fuelBasePrice:Number(settings.fuel_base_price??2)};
  const candidates=[
    {currency:'USD',sourcePrice:Number(product?.price_usd||0),multiplier:rates.USD,rarity:product?.rarity_usd||'common'},
    {currency:'RMB',sourcePrice:Number(product?.price_rmb||0),multiplier:rates.RMB,rarity:product?.rarity_rmb||'common'},
    {currency:'MYR',sourcePrice:Number(product?.price_myr||0),multiplier:1,rarity:product?.rarity_myr||'common'}
  ];
  const calc=calculateQuotedPrice(candidates,'',rule,companyRates,ctx);if(!calc)throw new Error(`No valid GWS source price is available for ${product?.model||'this tank'}.`);
  const count=Math.max(1,Math.trunc(Number(qty)||1));return {family:'GWS',brand:'Keylargo',series:String(product?.series_name||'GWS Tank'),model:String(product?.model||''),qty:count,tank_size_litres:Number(product?.size_litres||0),tank_pressure_bar:Number(product?.pressure_bar||0),unit_price:Number(calc.finalPrice||0),line_total:Number(calc.finalPrice||0)*count,pricing:{product_family:'GWS',product_id:String(product?.id||''),material:'SKU',category_id:String(category.id||''),category_name:String(category.category_name||''),source_currency:calc.sourceCurrency,source_price:calc.sourcePrice,currency_multiplier:calc.multiplier,base_myr:calc.baseMyr,rarity:calc.rarity,fixed_price:!!calc.fixedPrice,fuel_charge:Number(calc.fuelCharge||0),calculated_price:Number(calc.finalPrice||0)}};
}
function gwsChoiceLabel(product:any){const size=Number(product?.size_litres||0),bar=Number(product?.pressure_bar||0);return `${String(product?.model||'GWS Tank')}${size>0?` · ${inputNumber(size)}L`:''}${bar>0?` · ${inputNumber(bar)}bar`:''}`.slice(0,60)}
async function findGwsMatches(service:any,request:any){
  const r=await service.from('ks_products_gws').select('*').eq('status','active').order('source_row').limit(1000);if(r.error)throw new Error(`GWS Tank catalogue could not be loaded: ${r.error.message||r.error}`);let rows:any[]=r.data||[];
  const size=Number(request?.tank_size_litres||0),bar=Number(request?.tank_pressure_bar||0),hint=cleanSearch(request?.tank_model_hint||'');
  if(size>0)rows=rows.filter(p=>Math.abs(Number(p.size_litres||0)-size)<.001);if(bar>0)rows=rows.filter(p=>Math.abs(Number(p.pressure_bar||0)-bar)<.001);
  if(hint)rows=rows.filter(p=>cleanSearch(`${p.model||''} ${p.series_code||''} ${p.series_name||''}`).includes(hint));
  return rows.slice(0,12);
}

const KEYSUITE_CHC_CONNECTION_DN:any={1:25,2:25,3:25,4:32,5:32,8:40,10:40,12:50,15:50,16:50,20:50,32:65,45:80,64:100,90:100,120:125,150:125,200:150};
const KEYSUITE_MANIFOLD_FALLBACK:any={DN25:['DN25','DN40','DN50','DN65','DN80','DN100'],DN32:['DN32','DN50','DN65','DN80','DN100','DN100'],DN40:['DN40','DN65','DN80','DN100','DN100','DN150'],DN50:['DN50','DN80','DN100','DN100','DN150','DN200'],DN65:['DN65','DN100','DN100','DN150','DN200','DN250'],DN80:['DN80','DN100','DN150','DN200','DN250','DN300'],DN100:['DN100','DN150','DN200','DN250','DN300','DN350'],DN125:['DN125','DN200','DN250','DN300','DN350','DN400'],DN150:['DN150','DN200','DN250','DN350','DN400','DN450'],DN200:['DN200','DN300','DN300','DN400','DN450','DN500']};
function variantArray(value:any){if(Array.isArray(value))return value;if(value&&typeof value==='object')return Object.values(value);return []}
function variantQty(v:any){return Math.max(0,Number(v?.pumpQty??v?.pump_qty??(String(v?.label||'').match(/\d+/)?.[0]||0)))}
function variantCode(v:any){return String(v?.code??v?.pumpQty??v?.pump_qty??v?.tankSize??v?.tank_size??v?.label??'')}
function variantPrice(v:any,currency:string){const c=String(currency).toUpperCase();return Number(v?.[`price${c[0]}${c.slice(1).toLowerCase()}`]??v?.[`price_${c.toLowerCase()}`]??0)}
function dnNumberServer(value:any){return Number(String(value||'').replace(/[^0-9.]/g,''))||0}
function directChcModelInfo(model:any){
  const db:any=(globalThis as any).KeySuiteCHCData,core:any=(globalThis as any).KeySuiteCHCCore;const wanted=String(model||'').replace(/^VMS\b/i,'CHC').replace(/\s+/g,' ').trim().toUpperCase();
  const row=(db?.models||[]).find((m:any)=>String(m.model||'').toUpperCase()===wanted);if(!row)return null;
  let shutoff=0;try{const e=core?.evaluateModel?.(db,row,0,0,50);shutoff=Number(e?.predHead||0)}catch(_){ }
  const seriesNo=Number((String(row.series||row.model||'').match(/CHC\s*(\d+)/i)||[])[1]||0),dn=dnNumberServer(row.connection)||Number(KEYSUITE_CHC_CONNECTION_DN[seriesNo]||0);
  return {family:'CHC',brand:'B.G.Reich',series:String(row.series||`CHC ${seriesNo}`),model:String(row.model),motor_kw:Number(row.motor_kw||0),motor_hp:Number(row.motor_hp||0),connection_dn:dn,connection:dn?`DN${dn}`:String(row.connection||''),shutoff_head_m:shutoff,series_no:seriesNo};
}
function directPumpInfo(model:any){const text=String(model||'');if(/^CHC\b|^VMS\b/i.test(text))return directChcModelInfo(text);return null}
function systemTankLitresForSeries(series:any){const value=Number(series)||0;if(value>0&&value<=10)return 24;if(value>=12&&value<=28)return 35;if(value>=32&&value<=90)return 100;if(value>=120&&value<=150)return 200;if(value===200)return 300;return 0}
function manifoldConnectionForHead(head:any){const h=Number(head);if(!(h>0))return {connection:'FLANGE_16',priceCode:'FLANGE_16',pressureBar:null};const bar=h*.0981;if(bar<8)return {connection:'THREAD_8',priceCode:'THREAD_10',pressureBar:bar};if(bar<16)return {connection:'FLANGE_16',priceCode:'FLANGE_16',pressureBar:bar};if(bar<25)return {connection:'FLANGE_25',priceCode:'FLANGE_25',pressureBar:bar};return {connection:'',priceCode:'',pressureBar:bar}}
function systemBomOptions(req:any){const b=req?.system_bom&&typeof req.system_bom==='object'?req.system_bom:{};return {panel_kw:Number(b.panel_kw||0),manifold_dn:String(b.manifold_dn||''),inlet_flexible:!!b.inlet_flexible,outlet_flexible:!!b.outlet_flexible,strainer:!!b.strainer,tank_size_litres:Number(b.tank_size_litres||0)}}
async function pricingContextForFamily(service:any,customerId:string,userEmail:string,family:string){
  const customerRes=await service.from('ks_customers').select('id,company_name,pricing_category_id,distance_km,status').eq('id',customerId).eq('status','active').maybeSingle();if(customerRes.error||!customerRes.data)throw new Error('Selected customer could not be loaded for pricing.');const customer:any=customerRes.data;if(!customer.pricing_category_id)throw new Error(`${customer.company_name} has no Pricing Category assigned.`);
  const [categoryRes,settingsRes,pricingRes]=await Promise.all([service.from('ks_pricing_categories').select('*').eq('id',customer.pricing_category_id).maybeSingle(),service.from('ks_app_settings').select('*').eq('id','default').maybeSingle(),service.rpc('keysuite_v41306_get_customer_pricing',{p_user_email:String(userEmail||''),p_customer_id:String(customerId||'')})]);
  if(categoryRes.error||!categoryRes.data)throw new Error('Customer Pricing Category could not be loaded.');if(settingsRes.error)throw new Error('KeySuite pricing settings could not be loaded.');if(pricingRes.error)throw new Error(`Customer-specific pricing could not be loaded: ${pricingRes.error.message||pricingRes.error}`);
  const category:any=categoryRes.data,settings:any=settingsRes.data||{},pricingRow=(Array.isArray(pricingRes.data)?pricingRes.data[0]:pricingRes.data)||{};return {customer,category,settings,rates:productRates(settings,family),rule:pricingRule(category,family),customerRates:customerPricingRow(pricingRow),ctx:{distanceKm:Number(customer.distance_km||0),fuelPrice:Number(settings.fuel_price??2),fuelBasePrice:Number(settings.fuel_base_price??2)}};
}
async function quoteKeyplcPanel(service:any,customerId:string,userEmail:string,motorKw:number,pumpQty:number,manualKw=0){
  const r=await service.from('ks_products_keyplc').select('*').eq('status','active').order('source_row').limit(1000);if(r.error)throw new Error(`KeyPLC catalogue could not be loaded: ${r.error.message||r.error}`);const need=Math.max(Number(motorKw)||0,Number(manualKw)||0),rows=(r.data||[]).filter((p:any)=>Number(p.motor_kw||String(p.model||'').replace(/[^0-9.]/g,''))>=need-1e-9).sort((a:any,b:any)=>Number(a.motor_kw||0)-Number(b.motor_kw||0));const p:any=rows[0]||null;if(!p)return null;
  const qty=Math.max(1,Math.min(6,Math.trunc(Number(pumpQty)||1))),v=variantArray(p.variants).find((x:any)=>variantQty(x)===qty);if(!v)return {product:p,qty,unit_price:0,price_missing:true};
  if(!customerId)return {product:p,qty,unit_price:0,price_missing:false};const pc=await pricingContextForFamily(service,customerId,userEmail,'KEYPLC');const candidates=['USD','RMB','MYR'].map(c=>({currency:c,sourcePrice:variantPrice(v,c),multiplier:(pc.rates as any)[c],rarity:p.rarity||'common'}));const calc=calculateQuotedPrice(candidates,p.rarity||'common',pc.rule,pc.customerRates,pc.ctx);if(!calc)return {product:p,qty,unit_price:0,price_missing:true};return {product:p,qty,unit_price:Number(calc.finalPrice||0),price_missing:false,pricing:calc};
}
async function manifoldSystemComponent(service:any,customerId:string,userEmail:string,pump:any,pumpQty:number,req:any){
  const rowsRes=await service.from('ks_products_manifold').select('*').eq('status','active').order('section').order('source_row').limit(2000);if(rowsRes.error)throw new Error(`Manifold catalogue could not be loaded: ${rowsRes.error.message||rowsRes.error}`);const rows:any[]=rowsRes.data||[],bom=systemBomOptions(req),pumpDn=`DN${Number(pump.connection_dn||0)}`,conn=manifoldConnectionForHead(pump.shutoff_head_m);if(!pumpDn||pumpDn==='DN0'||!conn.connection)return {model:'Manifold',price_missing:true,warning:'Automatic manifold sizing requires a valid pump connection and shutoff pressure.'};
  const by=(section:string,model:string)=>rows.find(x=>String(x.section)==section&&String(x.model||'').toUpperCase()===String(model).toUpperCase());const findV=(p:any,key:any)=>variantArray(p?.variants).find((v:any)=>variantCode(v)===String(key)||Number(variantQty(v))===Number(key));
  const sizing=by('sizing',pumpDn),sv=findV(sizing,Math.max(1,Math.min(6,pumpQty))),autoDn=String(sv?.resultDn||KEYSUITE_MANIFOLD_FALLBACK[pumpDn]?.[Math.max(1,Math.min(6,pumpQty))-1]||''),headerDn=String(bom.manifold_dn||autoDn);if(!headerDn)return {model:'Manifold',price_missing:true,warning:'No manifold header size could be resolved.'};
  const code=`GI_${conn.priceCode}`,branch=by('branch',pumpDn),bv=findV(branch,code),header=by('header',`GI ${headerDn}`),hv=findV(header,Math.max(1,Math.min(6,pumpQty)));const options={inlet_flexible:bom.inlet_flexible,outlet_flexible:bom.outlet_flexible,strainer:bom.strainer};let accessoryAddon=0;const missing:string[]=[];
  const baseCandidates=['USD','RMB','MYR'].map(currency=>{const bp=variantPrice(bv,currency),hp=variantPrice(hv,currency);if(!(bp>0)||!(hp>0))return {currency,sourcePrice:0,multiplier:1,rarity:'common'};return {currency,sourcePrice:bp*pumpQty+hp,multiplier:1,rarity:'common'}});
  if(customerId){const pc=await pricingContextForFamily(service,customerId,userEmail,'MANIFOLD');baseCandidates.forEach((x:any)=>x.multiplier=(pc.rates as any)[x.currency]);const acc=(section:string)=>{const row=by(section,pumpDn),v=findV(row,code);if(!v)return null;const cand=['USD','RMB','MYR'].map(c=>({currency:c,sourcePrice:variantPrice(v,c),multiplier:(pc.rates as any)[c]})).filter(x=>x.sourcePrice>0);if(!cand.length)return null;return cand.reduce((a,b)=>!a||b.sourcePrice*b.multiplier>a.sourcePrice*a.multiplier?b:a,null)};for(const [enabled,section,label] of [[options.strainer,'strainer','Strainer'],[options.inlet_flexible,'flexible','Inlet Flexible'],[options.outlet_flexible,'flexible','Outlet Flexible']] as any[]){if(!enabled)continue;const a:any=acc(section);if(!a)missing.push(label);else accessoryAddon+=Number(a.sourcePrice)*Number(a.multiplier)*pumpQty}const calc=calculateQuotedPrice(baseCandidates,'common',pc.rule,pc.customerRates,pc.ctx);const base=Number(calc?.finalPrice||0);return {model:`GI Manifold ${headerDn}`,header_dn:headerDn,pump_dn:pumpDn,connection:conn.connection,options,unit_price:base+accessoryAddon,accessory_addon:accessoryAddon,price_missing:!calc||missing.length>0,missing};}
  return {model:`GI Manifold ${headerDn}`,header_dn:headerDn,pump_dn:pumpDn,connection:conn.connection,options,unit_price:0,price_missing:false,missing};
}
async function autoGwsSystemTank(service:any,customerId:string,userEmail:string,pump:any,req:any){const bom=systemBomOptions(req),auto=systemTankLitresForSeries(pump.series_no),litres=Number(bom.tank_size_litres||auto),minimumBar=Number(pump.shutoff_head_m||0)*.0981;if(!(litres>0))return {model:'GWS Tank',size_litres:0,pressure_bar:0,unit_price:0,price_missing:true,warning:'No automatic tank size rule matched this pump series.'};const r=await service.from('ks_products_gws').select('*').eq('status','active').eq('size_litres',litres).order('pressure_bar').limit(100);if(r.error)throw new Error(`GWS Tank catalogue could not be loaded: ${r.error.message||r.error}`);const p:any=(r.data||[]).filter((x:any)=>Number(x.pressure_bar||0)>minimumBar+1e-9).sort((a:any,b:any)=>Number(a.pressure_bar||0)-Number(b.pressure_bar||0))[0]||null;if(!p)return {model:`GWS ${litres}L`,size_litres:litres,pressure_bar:0,unit_price:0,price_missing:true,warning:`No ${litres}L GWS Tank above ${minimumBar.toFixed(1)} bar is available.`};if(!customerId)return {model:String(p.model||''),size_litres:Number(p.size_litres||litres),pressure_bar:Number(p.pressure_bar||0),unit_price:0,price_missing:false,product:p};const priced=await quoteGwsForCustomer(service,customerId,p,1,userEmail);return {model:priced.model,size_litres:priced.tank_size_litres,pressure_bar:priced.tank_pressure_bar,unit_price:priced.unit_price,price_missing:false,product:p,pricing:priced.pricing};}
async function buildKeyplcSystem(service:any,request:any,customer:any=null,user:any=null){const req=mergeQuoteRequest({},request),qty=Math.max(1,Math.min(6,Math.trunc(Number(req.system_pump_qty||2)||2))),opts=mergePumpOptions({},req.options,qty);let pump:any=null;if(req.direct_model){pump=directPumpInfo(req.direct_model);if(!pump)throw new Error(`Pump model ${req.direct_model} was not found in the KeySuite CHC/VMS database.`)}else if(Number(req.flow_m3h)>0&&Number(req.head_m)>0&&simplePumpFamilyCode(req)==='CHC'){const s:any=selectPumpSummary('CHC',Number(req.flow_m3h),Number(req.head_m),0);pump={...directPumpInfo(s.model),...s}}else throw new Error('KeyPLC needs an exact CHC/VMS model or a complete CHC duty point.');pump=applyPumpOptionsToItem({...pump,qty},opts);const cid=String(customer?.id||''),email=String(user?.email||''),pumpPriced=cid?await quotePumpForCustomer(service,cid,pump,email,{skipSetDiscount:true}):pump,bom=systemBomOptions(req),panel=await quoteKeyplcPanel(service,cid,email,Number(pump.motor_kw||0),qty,bom.panel_kw),manifold=await manifoldSystemComponent(service,cid,email,pump,qty,req),tank=await autoGwsSystemTank(service,cid,email,pump,req);const linePump=Number(pumpPriced.unit_price||0)*qty,total=linePump+Number(panel?.unit_price||0)+Number(manifold?.unit_price||0)+Number(tank?.unit_price||0),missing=[panel?.price_missing?'KeyPLC Panel':null,manifold?.price_missing?'Manifold':null,tank?.price_missing?'GWS Tank':null,cid&&!Number(pumpPriced.unit_price||0)?'Pump':null].filter(Boolean);return {system_type:'KEYPLC',pump_qty:qty,operation:`1 Duty + ${Math.max(0,qty-1)} On Demand`,control:'VFD + HMI',pump:pumpPriced,panel,manifold,tank,customer_name:String(customer?.company_name||''),system_total:cid&&!missing.length?total:0,price_missing:!!missing.length,missing_prices:missing,request:req};}
function keyplcBomText(bom:any){const p=bom?.pump||{},panel=bom?.panel||{},m=bom?.manifold||{},t=bom?.tank||{},priced=!!bom?.customer_name;const lines=[`KeyPLC ${bom.pump_qty}-Pump System`,`Operation: ${bom.operation}`,`Control: VFD + HMI`,'',`Pump: ${bom.pump_qty} × ${p.model||'-'}${Number(p.motor_kw)>0?` · ${inputNumber(p.motor_kw)} kW / ${inputNumber(p.motor_hp)} HP`:''}`,priced&&Number(p.unit_price)>0?`Pump Price: ${money(p.unit_price)} each · ${money(Number(p.unit_price)*bom.pump_qty)}`:null,`Panel: KeyPLC ${panel?.product?.model||'-'} · ${bom.pump_qty} Pumps · VFD + HMI`,priced&&Number(panel.unit_price)>0?`Panel Price: ${money(panel.unit_price)}`:null,`Manifold: ${m.model||'-'} · Pump ${m.pump_dn||'-'}${m.options?.inlet_flexible?' · Inlet Flexible':''}${m.options?.outlet_flexible?' · Outlet Flexible':''}${m.options?.strainer?' · Strainer':''}`,priced&&Number(m.unit_price)>0?`Manifold Price: ${money(m.unit_price)}`:null,`GWS Tank: ${t.model||'-'}${Number(t.size_litres)>0?` · ${inputNumber(t.size_litres)}L`:''}${Number(t.pressure_bar)>0?` · ${inputNumber(t.pressure_bar)} bar`:''}`,priced&&Number(t.unit_price)>0?`Tank Price: ${money(t.unit_price)}`:null,priced?'':null,priced&&!bom.price_missing?`System Total: ${money(bom.system_total)}`:priced&&bom.price_missing?`System Total: unavailable (${bom.missing_prices.join(', ')} price missing)`:null].filter(x=>x!==null&&x!==undefined&&x!=='');if(bom.customer_name)lines.unshift(`Customer: ${bom.customer_name}`,'');return lines.join('\n')}
function keyplcResultMenu(hasCustomer=false){return hasCustomer?telegramReplyKeyboard([['✏️ Edit BOM'],['🔄 New Request']]):telegramReplyKeyboard([['✏️ Edit BOM','💰 Check Price'],['🔄 New Request']])}
function keyplcEditMenu(){return telegramReplyKeyboard([['💧 Pump','⚡ Panel'],['🔩 Manifold','🛢️ Tank'],['✅ Done','🔄 New Request']])}
function keyplcManifoldMenu(bom:any){const o=bom?.manifold?.options||{};return telegramReplyKeyboard([['Size'],[`${o.inlet_flexible?'✅':'⬜'} Inlet Flexible`,`${o.outlet_flexible?'✅':'⬜'} Outlet Flexible`],[`${o.strainer?'✅':'⬜'} Strainer`],['⬅️ Edit BOM']])}
async function sendKeyplcSystem(service:any,telegramToken:string,companyId:string,chatId:string,senderId:string,session:any,request:any,customer:any=null,user:any=null){try{const bom=await buildKeyplcSystem(service,request,customer,user);const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'keyplc',step:'keyplc_result',selected_customer_id:customer?String(customer.id):null,context:{...sessionContext(session),keysuite_user_email:String(user?.email||''),customer_name:String(customer?.company_name||''),keyplc_request:bom.request,keyplc_bom:bom}});await telegramSend(telegramToken,chatId,keyplcBomText(bom),keyplcResultMenu(!!customer));return saved}catch(error){await telegramSend(telegramToken,chatId,`KeyPLC system could not be prepared.\n\n${error instanceof Error?error.message:String(error)}`,mainMenuMarkup());return session}}
async function resolveKeyplcCustomer(service:any,telegramToken:string,companyId:string,chatId:string,senderId:string,session:any,user:any,query:string,request:any){const matches=await findAllowedCustomers(service,companyId,user,query);if(!matches.length){const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'keyplc',step:'keyplc_waiting_company',selected_customer_id:null,context:{...sessionContext(session),keysuite_user_email:user.email,keyplc_request:request,customer_choices:[]}});await telegramSend(telegramToken,chatId,`No customer matched “${query}”.\nPlease type another part of the company name.`,telegramRemoveKeyboard());return saved}const exact=matches.find((x:any)=>cleanSearch(x.company_name)===cleanSearch(query));if(exact||matches.length===1)return await sendKeyplcSystem(service,telegramToken,companyId,chatId,senderId,session,request,exact||matches[0],user);const choices=matches.map((x:any)=>({id:String(x.id),label:String(x.company_name).slice(0,55)}));const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'keyplc',step:'keyplc_waiting_company',selected_customer_id:null,context:{...sessionContext(session),keysuite_user_email:user.email,keyplc_request:request,customer_choices:choices}});await telegramSend(telegramToken,chatId,`I found ${matches.length} similar customers for “${query}”.\nPlease confirm which customer you mean:`,telegramReplyKeyboard([...choices.map((x:any)=>[x.label]),['🔄 New Request']]));return saved}
function sessionContext(session:any){
  const c=session?.context;return c&&typeof c==='object'&&!Array.isArray(c)?{...c}:{};
}
function draftItemsFrom(session:any){const c=sessionContext(session);return Array.isArray(c.draft_items)?c.draft_items.slice(0,50):[];}
function persistentDraftMenu(){return telegramReplyKeyboard([['➕ Add Another Item','✏️ Edit Item'],['🗑 Remove Item','📄 Create Quotation'],['❌ Cancel Draft','⬅️ Main Menu']])}
function draftItemButtonLabel(item:any,index:number){return `${index+1}. ${String(item?.model||'Item').slice(0,42)}`}
async function loadPersistentDraft(service:any,companyId:string,draftId:string){if(!draftId)return null;const r=await service.from('ks_keybot_quote_drafts_v41309').select('*').eq('company_id',companyId).eq('id',draftId).maybeSingle();return r.error?null:r.data}
async function ensurePersistentDraft(service:any,companyId:string,chatId:string,senderId:string,userEmail:string,customerId:string,customerName:string,items:any[]=[],preferredId:string=''){
  if(preferredId){const existing=await loadPersistentDraft(service,companyId,preferredId);if(existing&&existing.status==='active'&&String(existing.customer_id)===String(customerId)){const nextItems=Array.isArray(items)&&items.length?items:(Array.isArray(existing.items)?existing.items:[]);const u=await service.from('ks_keybot_quote_drafts_v41309').update({user_email:userEmail,customer_name:customerName,items:nextItems,updated_at:new Date().toISOString()}).eq('id',existing.id).select('*').single();if(!u.error)return u.data}}
  const found=await service.from('ks_keybot_quote_drafts_v41309').select('*').eq('company_id',companyId).eq('channel','telegram').eq('sender_id',senderId).eq('user_email',userEmail).eq('customer_id',customerId).eq('status','active').order('updated_at',{ascending:false}).limit(1).maybeSingle();
  if(!found.error&&found.data){const nextItems=Array.isArray(items)&&items.length?items:(Array.isArray(found.data.items)?found.data.items:[]);const u=await service.from('ks_keybot_quote_drafts_v41309').update({chat_id:chatId,customer_name:customerName,items:nextItems,updated_at:new Date().toISOString()}).eq('id',found.data.id).select('*').single();if(!u.error)return u.data}
  const ins=await service.from('ks_keybot_quote_drafts_v41309').insert({company_id:companyId,channel:'telegram',chat_id:chatId,sender_id:senderId,user_email:userEmail,customer_id:customerId,customer_name:customerName,items:Array.isArray(items)?items:[],status:'active',created_at:new Date().toISOString(),updated_at:new Date().toISOString()}).select('*').single();if(ins.error)throw ins.error;return ins.data;
}
async function persistDraftItems(service:any,companyId:string,chatId:string,senderId:string,session:any,items:any[]){const c=sessionContext(session),draft=await ensurePersistentDraft(service,companyId,chatId,senderId,String(c.keysuite_user_email||''),String(session?.selected_customer_id||''),String(c.customer_name||'Selected Customer'),items,String(c.active_draft_id||''));return draft}
function quoteItemForKeySuite(item:any){
  const family=String(item?.family||'').toUpperCase(),qty=Math.max(1,Math.trunc(Number(item?.qty)||1)),unitPrice=Number(item?.unit_price||0),pricingSource=item?.pricing||null;
  if(family==='GWS')return {model:String(item?.model||''),qty,unit:'Unit',unitPrice,productFamily:'GWS',description:[`Keylargo GWS Tank Model: ${String(item?.model||'')}`,Number(item?.tank_size_litres)>0?`Capacity: ${inputNumber(item.tank_size_litres)} Litres`:null,Number(item?.tank_pressure_bar)>0?`Pressure: ${inputNumber(item.tank_pressure_bar)} Bar`:null].filter(Boolean).join('\n'),pricingSource};
  const o=pumpOptions(item?.options,qty),kw=Number(item?.motor_kw||0),hp=Number(item?.motor_hp||0),pole=Number(item?.pole||2)||2,brand=String(item?.brand||'B.G.Reich'),series=family==='ES'?`End Suction Pump`:`Vertical Multistage Pump`,desc=[`${brand} ${series} Model: ${String(item?.model||'')}`,o.bare_shaft?'(Bare shaft pump)':(kw>0?`c/w ${hp>0?`${oneDecimal(hp)} HP / `:''}${oneDecimal(kw)} kW ${pole} Pole ${o.motor_efficiency} Motor (415 V / 3 Ph / 50 Hz)`:null),`Material: ${o.material} / Mech Seal - ${o.seal}/${o.elastomer}`,`Connection: ${o.connection}`].filter(Boolean).join('\n');
  return {model:String(item?.model||''),qty,unit:'Unit',unitPrice,productFamily:family,description:desc,displayCapacity:true,capacityValue:String(Number(item?.requested_flow_m3h||0)),capacityUnit:'m³/hr',headValue:String(Number(item?.requested_head_m||0)),headUnit:'Mtr',pumpData:item,pricingSource};
}
async function createSavedQuotationFromDraft(service:any,companyId:string,draft:any){
  if(!draft||!Array.isArray(draft.items)||!draft.items.length)throw new Error('The draft has no items.');
  const customer=await service.from('ks_customers').select('id,company_name,contacts,payment_terms').eq('id',draft.customer_id).eq('company_id',companyId).eq('status','active').maybeSingle();if(customer.error||!customer.data)throw new Error('Draft customer could not be loaded.');
  const profile=await service.from('ks_user_profiles').select('display_name,designation,signatory_name,signature_image').ilike('email',String(draft.user_email||'')).maybeSingle();const pr=profile.data||{};const contacts=Array.isArray(customer.data.contacts)?customer.data.contacts:[],contact=contacts[0]||{};
  const items=draft.items.map((x:any)=>quoteItemForKeySuite(x)),total=items.reduce((sum:number,x:any)=>sum+Number(x.unitPrice||0)*Number(x.qty||1),0),now=new Date().toISOString();
  const quote:any={id:crypto.randomUUID(),date:now.slice(0,10),documentType:'Quotation',customerId:String(draft.customer_id),contactIndex:contacts.length?'0':'',printedCompany:String(customer.data.company_name||draft.customer_name||''),printedContact:[contact.prefix,contact.name].filter(Boolean).join(' '),pricingCustomerId:String(draft.customer_id),status:'saved',revisionOf:'',revisionRootId:'',revisionNumber:0,audit:[{action:'keybot_created',at:now,by:String(draft.user_email||'')}],assemblySessionId:`keybot:${draft.id}`,preparedBy:String(pr.display_name||draft.user_email||''),preparedByDesignation:String(pr.designation||''),signatoryName:String(pr.signatory_name||''),signatureImage:String(pr.signature_image||''),items,project:'',project2:'',customerReference:'',delivery:'Ex - Stock subject to prior sales. Otherwise 2-3 months upon confirmation order.',delivery2:'',validity:'14 days',priceBasis:'Ex - K.L. only, nett in Ringgit Malaysia.',payment:String(customer.data.payment_terms||'Cash before delivery'),remarks:'',total,createdByEmail:String(draft.user_email||''),createdByName:String(pr.display_name||draft.user_email||''),updatedByEmail:String(draft.user_email||''),createdAt:now,updatedAt:now};
  const r=await service.rpc('keysuite_v41309_create_saved_quotation',{p_user_email:String(draft.user_email||''),p_customer_id:String(draft.customer_id||''),p_quotation:quote});if(r.error)throw new Error(r.error.message||String(r.error));return (Array.isArray(r.data)?r.data[0]:r.data)||quote;
}
function quotationProductMenu(){return telegramReplyKeyboard([['💧 Pump','🛢️ Tank'],['🔎 Change Company','⬅️ Main Menu']])}
function quotationPumpSeriesMenu(){return telegramReplyKeyboard([['CHC'],['ES 2 Pole','ES 4 Pole'],['🔄 Select Again','⬅️ Main Menu']])}
function quotationResultText(item:any){
  const price=Number(item?.unit_price||0),qty=Math.max(1,Number(item?.qty||1));
  if(String(item?.family||'').toUpperCase()==='GWS')return ['Tank Selection',`Brand: ${item?.brand||'Keylargo'}`,`Series: ${item?.series||'GWS Tank'}`,`Model: ${item?.model||'-'}`,Number(item?.tank_size_litres)>0?`Size: ${inputNumber(item.tank_size_litres)} Litres`:null,Number(item?.tank_pressure_bar)>0?`Pressure: ${inputNumber(item.tank_pressure_bar)} Bar`:null,`Qty: ${qty}`,price>0?`Unit Price: ${money(price)}`:null,price>0&&qty>1?`Total: ${money(price*qty)}`:null,item?.pricing?.category_name?`Pricing Category: ${item.pricing.category_name}`:null].filter(Boolean).join('\n');
  const kw=Number(item?.motor_kw||0),hp=Number(item?.motor_hp||0),eff=Number(item?.efficiency||0),motor=kw>0?`${oneDecimal(kw)} kW${hp>0?` (${oneDecimal(hp)} HP)`:''}`:'-';
  return ['Pump Selection',`Brand: ${item?.brand||'B.G.Reich'}`,`Series: ${item?.series||item?.family||'-'}${item?.family==='ES'&&item?.pole?` ${item.pole} Pole`:''}`,`Model: ${item?.model||'-'}`,`Duty: ${oneDecimal(item?.requested_flow_m3h)} m³/hr @ ${oneDecimal(item?.requested_head_m)} Mtr`,`Motor: ${motor}${item?.options?.bare_shaft?' · Bare Shaft':''}`,eff>0?`Efficiency: ${oneDecimal(eff)} %`:null,`Qty: ${qty}`,item?.options?`Options: ${pumpOptions(item.options,qty).material} · ${pumpOptions(item.options,qty).motor_efficiency} · ${pumpOptions(item.options,qty).seal} · ${pumpOptions(item.options,qty).elastomer} · ${pumpOptions(item.options,qty).connection}`:null,price>0?`Unit Price: ${money(price)}`:null,price>0&&qty>1?`Total: ${money(price*qty)}`:null,item?.pricing?.category_name?`Pricing Category: ${item.pricing.category_name}`:null].filter(Boolean).join('\n');
}
function quotationDraftText(session:any){
  const c=sessionContext(session),items=draftItemsFrom(session),lines=[`📄 Quotation Draft`,`Company: ${String(c.customer_name||'Selected Customer')}`,''];
  if(!items.length){lines.push('No items added yet.');return lines.join('\n')}
  let total=0;items.forEach((item:any,i:number)=>{const qty=Math.max(1,Number(item?.qty||1)),unit=Number(item?.unit_price||0),line=unit*qty;total+=line;lines.push(`${i+1}. ${item?.model||'-'}`);if(String(item?.family||'').toUpperCase()==='GWS'){lines.push(`   GWS Tank${Number(item?.tank_size_litres)>0?` · ${inputNumber(item.tank_size_litres)}L`:''}${Number(item?.tank_pressure_bar)>0?` · ${inputNumber(item.tank_pressure_bar)}bar`:''} · Qty ${qty}`)}else{const kw=Number(item?.motor_kw||0);lines.push(`   ${oneDecimal(item?.requested_flow_m3h)} m³/hr @ ${oneDecimal(item?.requested_head_m)} Mtr`);lines.push(`   ${item?.family==='ES'&&item?.pole?`ES ${item.pole} Pole`:item?.series||item?.family||'-'} · ${kw>0?`${oneDecimal(kw)} kW`:'Motor -'} · Qty ${qty}`)}lines.push(`   ${money(unit)} each · ${money(line)}`);});
  lines.push('',`Items: ${items.length}`,`Draft Total: ${money(total)}`);return lines.join('\n');
}
async function selectQuotationCustomer(service:any,telegramToken:string,companyId:string,chatId:string,senderId:string,user:any,customer:any,previousContext:any={},pendingRequest:any=null){
  const prior=previousContext&&typeof previousContext==='object'?previousContext:{},priorItems=Array.isArray(prior.draft_items)?prior.draft_items:[];const draft=await ensurePersistentDraft(service,companyId,chatId,senderId,String(user.email||''),String(customer.id),String(customer.company_name||''),priorItems,String(prior.active_draft_id||''));const items=Array.isArray(draft?.items)?draft.items:priorItems,context={...prior,keysuite_user_email:user.email,customer_name:customer.company_name,draft_items:items,active_draft_id:String(draft?.id||''),pending_request:pendingRequest||prior.pending_request||null,pending_item:null};
  return await saveKeybotSession(service,companyId,chatId,senderId,{mode:'quotation',step:'customer_selected',selected_customer_id:String(customer.id),flow_m3h:null,head_m:null,flow_raw:null,head_raw:null,context});
}
async function showPumpQuoteFromRequest(service:any,telegramToken:string,companyId:string,chatId:string,senderId:string,session:any,request:any){
  const c=sessionContext(session),q=Number(request?.flow_m3h||session?.flow_m3h||c.quote_flow_m3h||0),h=Number(request?.head_m||session?.head_m||c.quote_head_m||0),code=String(request?.family_code||'').toUpperCase(),qty=Math.max(1,Math.trunc(Number(request?.qty)||1));
  const merged=mergeQuoteRequest(c.pending_request,request);merged.product_type='pump';merged.qty=qty;
  if(!(q>0)){const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'quotation',step:'quote_waiting_flow',flow_m3h:null,head_m:h>0?h:null,context:{...c,pending_request:merged,pending_item:null}});await telegramSend(telegramToken,chatId,'Please enter the pump flow.\nExample: 20 m³/h\n\nYou can also enter everything at once, for example: 20m3/hr @ 30m, CHC',telegramRemoveKeyboard());return saved}
  merged.flow_m3h=q;
  if(!(h>0)){const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'quotation',step:'quote_waiting_head',flow_m3h:q,head_m:null,context:{...c,pending_request:merged,pending_item:null}});await telegramSend(telegramToken,chatId,`Flow: ${oneDecimal(q)} m³/hr\n\nPlease enter the required head.\nExample: 45 m\n\nIf your reply also includes CHC / ES, KeyBot will skip the next question.`);return saved}
  merged.head_m=h;
  if(!['CHC','ES2','ES4'].includes(code)){const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'quotation',step:'quote_waiting_family',flow_m3h:q,head_m:h,context:{...c,pending_request:merged,pending_item:null}});await telegramSend(telegramToken,chatId,`Duty Point\nFlow: ${oneDecimal(q)} m³/hr\nHead: ${oneDecimal(h)} Mtr\n\nChoose the pump series:`,quotationPumpSeriesMenu());return saved}
  merged.family_code=code;const family=code==='CHC'?'CHC':'ES',pole=code==='ES2'?2:code==='ES4'?4:0;const opts=mergePumpOptions(c.pending_item?.options,merged.options,qty);merged.options=opts;
  try{let summary:any=selectPumpSummary(family,q,h,pole);summary=applyPumpOptionsToItem({...summary,qty},opts);summary=await quotePumpForCustomer(service,String(session.selected_customer_id||''),summary,String(c.keysuite_user_email||''));const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'quotation',step:'quote_result',flow_m3h:q,head_m:h,context:{...c,pending_request:merged,pending_item:summary}});await telegramSend(telegramToken,chatId,quotationResultText(summary),pumpResultMenu('quotation'));return saved}catch(error){await telegramSend(telegramToken,chatId,`The pump selection/pricing could not be completed.\n\n${error instanceof Error?error.message:String(error)}`,telegramReplyKeyboard([['🔄 Select Again'],['📄 View Draft'],['⬅️ Main Menu']]));return session}
}
async function showTankQuoteFromRequest(service:any,telegramToken:string,companyId:string,chatId:string,senderId:string,session:any,request:any){
  const c=sessionContext(session),merged=mergeQuoteRequest(c.pending_request,request);merged.product_type='tank';const qty=Math.max(1,Math.trunc(Number(merged.qty)||1));merged.qty=qty;
  const hasSearch=!!(merged.tank_model_hint||Number(merged.tank_size_litres)>0||Number(merged.tank_pressure_bar)>0);
  if(!hasSearch){const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'quotation',step:'quote_waiting_tank',context:{...c,pending_request:merged,pending_item:null}});await telegramSend(telegramToken,chatId,'Please enter the GWS Tank model or size.\n\nExamples:\n100L 10 bar\nmodel PWB-100\n2 units 200L',telegramRemoveKeyboard());return saved}
  try{const matches=await findGwsMatches(service,merged);if(!matches.length){const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'quotation',step:'quote_waiting_tank',context:{...c,pending_request:merged,pending_item:null}});await telegramSend(telegramToken,chatId,'No GWS Tank matched that request. Please enter another model, size or pressure.',telegramRemoveKeyboard());return saved}
    if(matches.length>1){const choices=matches.slice(0,8).map((p:any)=>({id:String(p.id),label:gwsChoiceLabel(p)})),rows=choices.map((x:any)=>[x.label]);rows.push(['🔄 Select Again','⬅️ Main Menu']);const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'quotation',step:'quote_waiting_tank_choice',context:{...c,pending_request:merged,pending_tank_matches:choices,pending_item:null}});await telegramSend(telegramToken,chatId,'More than one GWS Tank matches. Please choose:',telegramReplyKeyboard(rows));return saved}
    const item=await quoteGwsForCustomer(service,String(session.selected_customer_id||''),matches[0],qty,String(c.keysuite_user_email||''));const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'quotation',step:'quote_result',context:{...c,pending_request:merged,pending_tank_matches:null,pending_item:item}});await telegramSend(telegramToken,chatId,quotationResultText(item),telegramReplyKeyboard([['✅ Add to Quotation'],['🔄 Select Again','📄 View Draft'],['⬅️ Main Menu']]));return saved
  }catch(error){await telegramSend(telegramToken,chatId,`The GWS Tank selection/pricing could not be completed.\n\n${error instanceof Error?error.message:String(error)}`,telegramReplyKeyboard([['🔄 Select Again'],['📄 View Draft'],['⬅️ Main Menu']]));return session}
}
async function continueQuotationRequest(service:any,telegramToken:string,companyId:string,chatId:string,senderId:string,session:any,request:any){
  const merged=mergeQuoteRequest(sessionContext(session).pending_request,request);if(merged.product_type==='tank')return await showTankQuoteFromRequest(service,telegramToken,companyId,chatId,senderId,session,merged);if(merged.product_type==='pump'||merged.flow_m3h||merged.head_m||merged.family_code)return await showPumpQuoteFromRequest(service,telegramToken,companyId,chatId,senderId,session,merged);await telegramSend(telegramToken,chatId,'What would you like to quote?',quotationProductMenu());return session
}


function customerHintFromMessage(text:any,req:any={}){
  let s=String(text||'');
  // Strip exact product/model expressions before generic family words so model fragments do not look like company names.
  s=s.replace(/\b(?:CHC|VMS)\s*\d{1,3}\s*-\s*\d{1,3}(?:\s*-\s*\d{1,2})?(?:\s*-\s*\d{1,2})?\b/ig,' ')
    .replace(/\bES\s*\d{1,3}\s*-\s*[0-9]{1,3}[A-Z]?(?:-[A-Z0-9]+)?\b/ig,' ')
    .replace(/\b(?:quote|quotation|price|pricing|check|curve|please|prepare|need|want|for|select|selection)\b/ig,' ')
    .replace(/\b(?:qty\s*[:=]?\s*)?\d+\s*(?:x|units?|pcs?|sets?)\b/ig,' ')
    .replace(/\b\d+\s*x\s*(?=[a-z])/ig,' ')
    .replace(/\bkey\s*plc\s*\d+\s*(?:p|pumps?)\b/ig,' ')
    .replace(/\b\d+\s*(?:p|pumps?)\s*(?:system)?\b/ig,' ')
    .replace(/\b(?:key\s*plc|vfd|hmi|system|vms|vertical\s+multistage(?:\s+inline\s+pump)?|chc|es\s*[- ]?[24]\s*(?:p|pole)?|es|pump|pumps|gws|tank|pressure\s*(?:tank|vessel))\b/ig,' ')
    .replace(/\b\d+(?:\.\d+)?\s*(?:m3|m³)\s*[.\/]?\s*(?:h|hr|hour)\b/ig,' ')
    .replace(/\b\d+(?:\.\d+)?\s*(?:l\s*\/\s*s|lps|l\s*\/\s*(?:m|min|minute)|lpm|us\s*gpm|usgpm|imp(?:erial)?\s*gpm|igpm)\b/ig,' ')
    .replace(/\b\d+(?:\.\d+)?\s*@\s*\d+(?:\.\d+)?(?:\s*(?:mtr|metres?|meters?|m|ft|feet|foot|bar|kpa|psi))?\b/ig,' ')
    .replace(/@\s*\d+(?:\.\d+)?\s*(?:mtr|metres?|meters?|m|ft|feet|foot|bar|kpa|psi)?\b/ig,' ')
    .replace(/\b(?:head\s*[:=]?\s*)?\d+(?:\.\d+)?\s*(?:mtr|metres?|meters?|m|ft|feet|foot|bar|kpa|psi)\b/ig,' ')
    .replace(/\b\d+(?:\.\d+)?\s*(?:l|ltr|litres?|liters?)\b/ig,' ')
    .replace(/\bmodel\s*[:=]?\s*[a-z0-9._\/-]+\b/ig,' ')
    .replace(/\b(?:ss\s*304|ss\s*316|304\s*(?:ss|stainless)?|316\s*(?:ss|stainless)?|ie\s*[2345]|sic\s*[\/-]\s*sic|tc\s*[\/-]\s*tc|carbon\s*[\/-]\s*sic|epdm|nbr|viton|round\s*(?:flange)?|oval\s*(?:flange)?|bare\s*shaft)\b/ig,' ')
    .replace(/[,@;|]+/g,' ')
    .replace(/\s+/g,' ').trim();
  if(/^(?:customer|company)$/i.test(s))return '';
  return s;
}
function simplePumpFamilyCode(req:any){const c=String(req?.family_code||'').toUpperCase();return ['CHC','ES2','ES4','ES'].includes(c)?c:''}
function simplePumpMissing(req:any){if(req?.direct_model)return '';if(!(Number(req?.flow_m3h)>0))return 'flow';if(!(Number(req?.head_m)>0))return 'head';const c=simplePumpFamilyCode(req);if(!c||c==='ES')return 'family';return ''}
function simpleRequestHasTechnical(req:any){return !!(req?.product_type||req?.family_code||req?.direct_model||req?.system_type||Number(req?.flow_m3h)>0||Number(req?.head_m)>0||req?.tank_model_hint||Number(req?.tank_size_litres)>0||Number(req?.tank_pressure_bar)>0)}
function simpleRequestMenuText(){return 'Send your request in one message.\n\nCurve: CHC 30m3/hr @ 90ft\nPrice: Keylargo, CHC 15-20\nSystem: KeyPLC 2P, CHC 15-20\n\nVMS = CHC. KeyBot asks only for information that is missing.'}
async function sendSimpleCurve(service:any,telegramToken:string,companyId:string,chatId:string,senderId:string,session:any,request:any){
  const req=mergeQuoteRequest(sessionContext(session).pending_request,request);req.product_type='pump';
  if(req.direct_model){const info=directPumpInfo(req.direct_model);if(!info){await telegramSend(telegramToken,chatId,`Pump model ${req.direct_model} was not found.`,mainMenuMarkup());return session}const item=applyPumpOptionsToItem({...info,qty:Math.max(1,Number(req.qty||1))},mergePumpOptions({},req.options,req.qty||1));const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'curve',step:'direct_model_result',selected_customer_id:null,context:{pending_request:req,pending_item:item}});await telegramSend(telegramToken,chatId,[`Model: ${item.model}`,`Type: VMS · Vertical Multistage Inline Pump`,Number(item.motor_kw)>0?`Motor: ${inputNumber(item.motor_kw)} kW / ${inputNumber(item.motor_hp)} HP`:null,item.connection?`Connection: ${item.connection}`:null].filter(Boolean).join('\n'),telegramReplyKeyboard([['⚙️ Options','💰 Check Price'],['🔄 New Request']]));return saved}
  const missing=simplePumpMissing(req);
  if(missing==='flow'){const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'smart_curve',step:'smart_waiting_flow',selected_customer_id:null,context:{pending_request:req}});await telegramSend(telegramToken,chatId,'Please enter the required flow.\nExample: 30 m³/hr',telegramRemoveKeyboard());return saved}
  if(missing==='head'){const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'smart_curve',step:'smart_waiting_head',selected_customer_id:null,context:{pending_request:req}});await telegramSend(telegramToken,chatId,'Please enter the required head.\nExample: 80 m or 90 ft',telegramRemoveKeyboard());return saved}
  if(missing==='family'){const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'smart_curve',step:'smart_waiting_family',selected_customer_id:null,context:{pending_request:req}});await telegramSend(telegramToken,chatId,'Please choose the pump series:',telegramReplyKeyboard([['CHC'],['ES 2 Pole','ES 4 Pole'],['🔄 New Request']]));return saved}
  const code=simplePumpFamilyCode(req),family=code==='CHC'?'CHC':'ES',pole=code==='ES4'?4:code==='ES2'?2:0,q=Number(req.flow_m3h),h=Number(req.head_m),display=dutyDisplay(String(req.raw_input||''),q,h),opts=mergePumpOptions({},req.options,req.qty||1);
  try{const pdfMeta=await generateCurvePdf(family,q,h,display.duty_text,env('KEYSUITE_PUBLIC_URL'),pole);const sent=await telegramSendDocument(telegramToken,chatId,pdfMeta.bytes,pdfMeta.filename,`${family==='ES'?esPoleLabel(pole):family} curve ready\n${display.duty_text}\nSelected: ${pdfMeta.model}`);let item:any=selectPumpSummary(family,q,h,pole);item=applyPumpOptionsToItem({...item,qty:Math.max(1,Number(req.qty||1))},opts);const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'curve',step:'curve_result',flow_m3h:q,head_m:h,selected_customer_id:null,context:{pending_request:req,pending_item:item,curve_pdf:{family,pole,q,h,duty:display.duty_text,filename:pdfMeta.filename}}});await telegramSend(telegramToken,chatId,sent.ok?'Curve ready.':'The curve was prepared but Telegram could not send the PDF.',simpleCurveMenu());return saved}catch(error){await telegramSend(telegramToken,chatId,`KeyBot could not generate this curve.\n\n${error instanceof Error?error.message:String(error)}`,mainMenuMarkup());return session}
}
async function sendSimplePumpPrice(service:any,telegramToken:string,companyId:string,chatId:string,senderId:string,session:any,customer:any,user:any,request:any){
  const req=mergeQuoteRequest(sessionContext(session).pending_request,request);req.product_type='pump';const missing=simplePumpMissing(req),baseCtx={...sessionContext(session),keysuite_user_email:String(user.email||''),customer_name:String(customer.company_name||''),pending_request:req};
  if(req.direct_model){const info=directPumpInfo(req.direct_model);if(!info){await telegramSend(telegramToken,chatId,`Pump model ${req.direct_model} was not found.`,mainMenuMarkup());return session}try{let item=applyPumpOptionsToItem({...info,qty:Math.max(1,Number(req.qty||1))},mergePumpOptions({},req.options,req.qty||1));item=await quotePumpForCustomer(service,String(customer.id),item,String(user.email||''));const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'price',step:'price_result',selected_customer_id:String(customer.id),context:{...baseCtx,pending_item:item}});await telegramSend(telegramToken,chatId,`Customer: ${customer.company_name}\n\n${quotationResultText(item)}`,simplePriceMenu(false));return saved}catch(error){await telegramSend(telegramToken,chatId,`The direct model price could not be completed.\n\n${error instanceof Error?error.message:String(error)}`,mainMenuMarkup());return session}}
  if(missing==='flow'){const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'price',step:'price_waiting_flow',selected_customer_id:String(customer.id),context:baseCtx});await telegramSend(telegramToken,chatId,'Please enter the required flow.\nExample: 30 m³/hr',telegramRemoveKeyboard());return saved}
  if(missing==='head'){const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'price',step:'price_waiting_head',selected_customer_id:String(customer.id),context:baseCtx});await telegramSend(telegramToken,chatId,'Please enter the required head.\nExample: 80 m or 90 ft',telegramRemoveKeyboard());return saved}
  if(missing==='family'){const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'price',step:'price_waiting_family',selected_customer_id:String(customer.id),context:baseCtx});await telegramSend(telegramToken,chatId,'Please choose the pump series:',telegramReplyKeyboard([['CHC'],['ES 2 Pole','ES 4 Pole'],['🔄 New Request']]));return saved}
  const code=simplePumpFamilyCode(req),family=code==='CHC'?'CHC':'ES',pole=code==='ES4'?4:2,q=Number(req.flow_m3h),h=Number(req.head_m),opts=mergePumpOptions({},req.options,req.qty||1);
  try{let item:any=selectPumpSummary(family,q,h,pole);item=applyPumpOptionsToItem({...item,qty:Math.max(1,Number(req.qty||1))},opts);item=await quotePumpForCustomer(service,String(customer.id),item,String(user.email||''));const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'price',step:'price_result',flow_m3h:q,head_m:h,selected_customer_id:String(customer.id),context:{...baseCtx,pending_item:item}});await telegramSend(telegramToken,chatId,`Customer: ${customer.company_name}\n\n${quotationResultText(item)}`,simplePriceMenu(true));return saved}catch(error){await telegramSend(telegramToken,chatId,`The pump selection/pricing could not be completed.\n\n${error instanceof Error?error.message:String(error)}`,mainMenuMarkup());return session}
}
async function sendSimpleTankPrice(service:any,telegramToken:string,companyId:string,chatId:string,senderId:string,session:any,customer:any,user:any,request:any){
  const req=mergeQuoteRequest(sessionContext(session).pending_request,request);req.product_type='tank';const baseCtx={...sessionContext(session),keysuite_user_email:String(user.email||''),customer_name:String(customer.company_name||''),pending_request:req};
  const hasSearch=!!(req.tank_model_hint||Number(req.tank_size_litres)>0||Number(req.tank_pressure_bar)>0);if(!hasSearch){const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'price',step:'price_waiting_tank',selected_customer_id:String(customer.id),context:baseCtx});await telegramSend(telegramToken,chatId,'Please enter the GWS Tank model or size.\nExample: 100L 10 bar or model PWB-100',telegramRemoveKeyboard());return saved}
  try{const matches=await findGwsMatches(service,req);if(!matches.length){const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'price',step:'price_waiting_tank',selected_customer_id:String(customer.id),context:baseCtx});await telegramSend(telegramToken,chatId,'No GWS Tank matched that request. Please enter another model, size or pressure.');return saved}if(matches.length>1){const choices=matches.slice(0,8).map((p:any)=>({id:String(p.id),label:gwsChoiceLabel(p)}));const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'price',step:'price_waiting_tank_choice',selected_customer_id:String(customer.id),context:{...baseCtx,pending_tank_matches:choices}});await telegramSend(telegramToken,chatId,'More than one GWS Tank matches. Please choose:',telegramReplyKeyboard([...choices.map((x:any)=>[x.label]),['🔄 New Request']]));return saved}const qty=Math.max(1,Math.trunc(Number(req.qty)||1)),item=await quoteGwsForCustomer(service,String(customer.id),matches[0],qty,String(user.email||''));const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'price',step:'price_result',selected_customer_id:String(customer.id),context:{...baseCtx,pending_item:item}});await telegramSend(telegramToken,chatId,`Customer: ${customer.company_name}\n\n${quotationResultText(item)}`,simplePriceMenu(false));return saved}catch(error){await telegramSend(telegramToken,chatId,`The GWS Tank pricing could not be completed.\n\n${error instanceof Error?error.message:String(error)}`,mainMenuMarkup());return session}
}
async function continueSimplePrice(service:any,telegramToken:string,companyId:string,chatId:string,senderId:string,session:any,customer:any,user:any,request:any){const req=mergeQuoteRequest(sessionContext(session).pending_request,request);if(req.product_type==='keyplc_system'||req.system_type==='KEYPLC')return await sendKeyplcSystem(service,telegramToken,companyId,chatId,senderId,session,req,customer,user);if(req.product_type==='tank')return await sendSimpleTankPrice(service,telegramToken,companyId,chatId,senderId,session,customer,user,req);if(!req.product_type&&!simpleRequestHasTechnical(req)){const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'price',step:'price_waiting_product',selected_customer_id:String(customer.id),context:{...sessionContext(session),keysuite_user_email:user.email,customer_name:customer.company_name,pending_request:req}});await telegramSend(telegramToken,chatId,'What do you need? Send a pump duty such as CHC 30@80, or a GWS Tank model/size.',telegramRemoveKeyboard());return saved}return await sendSimplePumpPrice(service,telegramToken,companyId,chatId,senderId,session,customer,user,{...req,product_type:'pump'})}
async function resolveSimplePriceCustomer(service:any,telegramToken:string,companyId:string,chatId:string,senderId:string,session:any,user:any,query:string,request:any){
  const matches=await findAllowedCustomers(service,companyId,user,query);if(!matches.length){const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'price',step:'price_waiting_company',selected_customer_id:null,context:{...sessionContext(session),keysuite_user_email:user.email,pending_request:request,customer_choices:[]}});await telegramSend(telegramToken,chatId,`No customer matched “${query}”.\nPlease type another part of the company name.`,telegramRemoveKeyboard());return saved}
  const exact=matches.find((x:any)=>cleanSearch(x.company_name)===cleanSearch(query));if(exact||matches.length===1)return await continueSimplePrice(service,telegramToken,companyId,chatId,senderId,session,exact||matches[0],user,request);
  const choices=matches.map((x:any)=>({id:String(x.id),label:String(x.company_name).slice(0,55)}));const saved=await saveKeybotSession(service,companyId,chatId,senderId,{mode:'price',step:'price_waiting_company',selected_customer_id:null,context:{...sessionContext(session),keysuite_user_email:user.email,pending_request:request,customer_choices:choices}});await telegramSend(telegramToken,chatId,`I found ${matches.length} similar customers for “${query}”.\nPlease confirm which customer you mean:`,telegramReplyKeyboard([...choices.map((x:any)=>[x.label]),['🔄 New Request']]));return saved
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
    const callbackQuery=update?.callback_query||null;
    const message=callbackQuery?.message||update?.message||update?.edited_message||null;
    if(!message)return json({ok:true,ignored:true});
    let text=String(callbackQuery?'':(message?.text||message?.caption||'')).trim();
    const rawTelegramText=text;
    const chatId=String(message?.chat?.id||'');
    if(!callbackQuery&&!text){await telegramSend(telegramToken,chatId,'Please send a text message or use the KeyBot menu.',mainMenuMarkup());return json({ok:true,ignored:true,reason:'non-text'})}

    // V4.12.00 Unified Supabase: Telegram, KeyAI and KeySuite data all live in this project.
    const updateId=Number.isFinite(Number(update?.update_id))?Number(update.update_id):null;
    if(updateId!==null){
      const existing=await service.from('ks_keyai_enquiries').select('id,status').eq('source','telegram').eq('external_update_id',updateId).maybeSingle();
      if(existing.data?.id)return json({ok:true,duplicate:true,id:existing.data.id,status:existing.data.status});
    }

    const sender=callbackQuery?.from||message?.from||{};
    const senderName=[sender?.first_name,sender?.last_name].filter(Boolean).join(' ').trim();
    const senderUsername=String(sender?.username||'');
    const senderId=String(sender?.id||'').trim();
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
.select('response_mode,keysuite_user_email')
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

    // V4.14.00 Controlled KeyBot Learning. Explicit Owner/Admin teaching is approved immediately;
    // learned aliases are applied before the deterministic parser. Protected commercial/security/
    // engineering rules cannot be learned.
    if(!callbackQuery&&text&&keySuiteCompanyId&&senderId){
      const teach=parseLearningTeachCommand(rawTelegramText),forget=parseLearningForgetCommand(rawTelegramText),showLearning=/^(?:learning|learned|what have you learned)[\s!?.]*$/i.test(rawTelegramText);
      if(teach||forget||showLearning){
        const teacher=await linkedKeySuiteUser(service,keySuiteCompanyId,senderId);
        if(!teacher||!['owner','admin'].includes(String(teacher.role||'').toLowerCase())){
          await telegramSend(telegramToken,chatId,'Only a linked KeySuite Owner/Admin can teach or manage KeyBot learning.',mainMenuMarkup());
          return json({ok:true,status:'learning_not_authorised'});
        }
        try{
          if(teach){const row=await saveKeybotLearning(service,keySuiteCompanyId,teacher,teach);await telegramSend(telegramToken,chatId,`🧠 Learned\nContext: ${row.context}\n${row.phrase} → ${row.meaning}\n\nThis affects language interpretation only. Pricing, permissions and engineering rules remain locked.`,mainMenuMarkup());return json({ok:true,status:'learning_saved',learning_id:row.id})}
          if(forget){const count=await forgetKeybotLearning(service,keySuiteCompanyId,teacher,forget);await telegramSend(telegramToken,chatId,count?`🧠 Forgotten: ${forget.phrase} (${forget.context})`:`No active learned rule matched ${forget.phrase} (${forget.context}).`,mainMenuMarkup());return json({ok:true,status:'learning_forgotten',count})}
          const rows=await listKeybotLearning(service,keySuiteCompanyId);const body=rows.length?rows.map((x:any,i:number)=>`${i+1}. [${x.context}] ${x.phrase} → ${x.meaning} · used ${Number(x.usage_count||0)}x`).join('\n'):'KeyBot has no approved learned aliases yet.';await telegramSend(telegramToken,chatId,`🧠 KeyBot Learning\n\n${body}\n\nTeach examples:\nTeach: VMS = CHC\nTeach KeyPLC: 2P = 2 Pumps\nTeach Customer: KLI = Keylargo Industrial Sdn Bhd\n\nForget example:\nForget KeyPLC: 2P`,mainMenuMarkup());return json({ok:true,status:'learning_list',count:rows.length});
        }catch(error){await telegramSend(telegramToken,chatId,`KeyBot could not update learning.\n\n${error instanceof Error?error.message:String(error)}`,mainMenuMarkup());return json({ok:true,status:'learning_error'})}
      }
      const learned=await applyKeybotLearning(service,keySuiteCompanyId,text);text=learned.text;
    }

    // V4.14.00 KeyPLC BOM + direct-model routing. Reply-keyboard buttons send normal text
    // messages, so the guided flow works even when Telegram webhook allowed_updates
    // does not include callback_query. Legacy inline callback handling remains supported.
    let session=await keybotSession(service,keySuiteCompanyId,chatId,senderId);
    const callbackData=String(callbackQuery?.data||'').trim();
    const cleanButton=cleanSearch(text);
    const menuText=/^(?:\/start(?:@[A-Za-z0-9_]+)?|start|hi|hello|hey|menu)[\s!.,?]*$/i.test(text)||cleanButton==='main menu';
    const curveButton=!callbackQuery&&cleanButton==='curve';
    const quotationButton=!callbackQuery&&cleanButton==='quotation';
    const changeButton=!callbackQuery&&(cleanButton==='change'||cleanButton==='change duty');
    const continueButton=!callbackQuery&&cleanButton==='continue';
    const searchAgainButton=!callbackQuery&&(cleanButton==='search again'||cleanButton==='change company');
    const pumpButton=!callbackQuery&&cleanButton==='pump';
    const tankButton=!callbackQuery&&cleanButton==='tank';
    const byFlowHeadButton=!callbackQuery&&cleanButton==='by flow head';
    const addToQuotationButton=!callbackQuery&&cleanButton==='add to quotation';
    const addAnotherItemButton=!callbackQuery&&cleanButton==='add another item';
    const viewDraftButton=!callbackQuery&&cleanButton==='view draft';
    const myDraftsButton=!callbackQuery&&cleanButton==='my drafts';
    const editItemButton=!callbackQuery&&cleanButton==='edit item';
    const removeItemButton=!callbackQuery&&cleanButton==='remove item';
    const createQuotationButton=!callbackQuery&&cleanButton==='create quotation';
    const cancelDraftButton=!callbackQuery&&cleanButton==='cancel draft';
    const selectAgainButton=!callbackQuery&&(cleanButton==='select again'||cleanButton==='new selection');
    const curvePdfButton=!callbackQuery&&cleanButton==='curve pdf';
    const checkPriceButton=!callbackQuery&&cleanButton==='check price';
    const newRequestButton=!callbackQuery&&(cleanButton==='new request'||cleanButton==='new selection'||cleanButton==='select again');
    const optionsButton=!callbackQuery&&cleanButton==='options';
    const doneOptionsButton=!callbackQuery&&cleanButton==='done';
    const materialButton=!callbackQuery&&cleanButton==='material';
    const motorButton=!callbackQuery&&cleanButton==='motor';
    const sealButton=!callbackQuery&&cleanButton==='seal';
    const connectionButton=!callbackQuery&&cleanButton==='connection';
    const bareShaftButton=!callbackQuery&&cleanButton==='bare shaft';
    const quantityButton=!callbackQuery&&cleanButton==='quantity';
    const editBomButton=!callbackQuery&&cleanButton==='edit bom';
    const editBomBackButton=!callbackQuery&&cleanButton==='edit bom';
    const manifoldSizeButton=!callbackQuery&&cleanButton==='size';
    const inletFlexibleButton=!callbackQuery&&cleanButton.endsWith('inlet flexible');
    const outletFlexibleButton=!callbackQuery&&cleanButton.endsWith('outlet flexible');
    const strainerButton=!callbackQuery&&cleanButton.endsWith('strainer');
    const familyTextCode=!callbackQuery?(cleanButton==='chc'?'CHC':cleanButton==='es 2 pole'?'ES2':cleanButton==='es 4 pole'?'ES4':''):'';
    if(callbackQuery?.id)await telegramAnswerCallback(telegramToken,String(callbackQuery.id));

    if(myDraftsButton){await telegramSend(telegramToken,chatId,'KeyBot quotation drafts are disabled for now. Use KeySuite for quotations.\n\nFor a price, send customer + requirement in one message.',mainMenuMarkup());return json({ok:true,status:'quotation_disabled_in_keybot'})}

    if(false&&myDraftsButton){
      const user=await linkedKeySuiteUser(service,keySuiteCompanyId,senderId);if(!user){await telegramSend(telegramToken,chatId,'My Drafts is available to linked KeySuite users only.',mainMenuMarkup());return json({ok:true,status:'draft_user_not_linked'})}
      const r=await service.from('ks_keybot_quote_drafts_v41309').select('*').eq('company_id',keySuiteCompanyId).eq('channel','telegram').eq('sender_id',senderId).eq('user_email',String(user.email||'')).eq('status','active').order('updated_at',{ascending:false}).limit(8);if(r.error){await telegramSend(telegramToken,chatId,`Drafts could not be loaded.\n\n${r.error.message||r.error}`,mainMenuMarkup());return json({ok:true,status:'draft_load_error'})}
      const drafts=r.data||[];if(!drafts.length){await telegramSend(telegramToken,chatId,'You have no active quotation drafts.',mainMenuMarkup());return json({ok:true,status:'draft_none'})}
      const choices=drafts.map((d:any,i:number)=>({id:String(d.id),label:`${i+1}. ${String(d.customer_name||'Customer').slice(0,38)} · ${(Array.isArray(d.items)?d.items.length:0)} item${(Array.isArray(d.items)?d.items.length:0)===1?'':'s'}`}));session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'quotation',step:'draft_list',context:{keysuite_user_email:user.email,draft_choices:choices}});await telegramSend(telegramToken,chatId,'📂 My Drafts\nChoose a quotation draft to continue:',telegramReplyKeyboard([...choices.map((x:any)=>[x.label]),['⬅️ Main Menu']]));return json({ok:true,status:'draft_list',count:choices.length});
    }
    if(!callbackQuery&&session?.step==='draft_list'&&text){const c=sessionContext(session),choices=Array.isArray(c.draft_choices)?c.draft_choices:[],choice=choices.find((x:any)=>cleanSearch(x.label)===cleanButton);if(choice){const draft=await loadPersistentDraft(service,keySuiteCompanyId,choice.id);if(!draft||draft.status!=='active'){await telegramSend(telegramToken,chatId,'That draft is no longer active.',mainMenuMarkup());return json({ok:true,status:'draft_inactive'})}session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'quotation',step:'quote_after_add',selected_customer_id:String(draft.customer_id),context:{keysuite_user_email:String(draft.user_email),customer_name:String(draft.customer_name),draft_items:Array.isArray(draft.items)?draft.items:[],active_draft_id:String(draft.id),pending_item:null,pending_request:null}});await telegramSend(telegramToken,chatId,quotationDraftText(session),persistentDraftMenu());return json({ok:true,status:'draft_resumed',draft_id:draft.id})}}

    if(menuText||callbackData==='menu:home'){
      const aq=activeQuoteFromSession(session);session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'',step:'idle',flow_m3h:null,head_m:null,flow_raw:null,head_raw:null,selected_customer_id:null,context:aq?{active_quote:aq}:{}});
      await telegramSend(telegramToken,chatId,`Hi 👋

${simpleRequestMenuText()}`,mainMenuMarkup());
      return json({ok:true,status:'keybot_menu',version:'V4.14.00'});
    }

    if(newRequestButton){
      session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'',step:'idle',flow_m3h:null,head_m:null,flow_raw:null,head_raw:null,selected_customer_id:null,context:{}});
      await telegramSend(telegramToken,chatId,simpleRequestMenuText(),mainMenuMarkup());
      return json({ok:true,status:'new_request'});
    }
    if(quotationButton||myDraftsButton||createQuotationButton){
      await telegramSend(telegramToken,chatId,'Quotation creation stays in KeySuite.\n\nFor a customer price, send the customer name together with the requirement.\nExample: Keylargo, CHC 30m3/hr @ 80m',mainMenuMarkup());
      return json({ok:true,status:'quotation_disabled_in_keybot'});
    }

    if(curveButton||callbackData==='menu:curve'){
      const aq=activeQuoteFromSession(session);session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'curve',step:'waiting_flow',flow_m3h:null,head_m:null,flow_raw:null,head_raw:null,selected_customer_id:null,context:aq?{active_quote:aq}:{}});
      await telegramSend(telegramToken,chatId,'Please enter the required flow.\nExample: 20 m³/h\n\nIf you enter only a number, KeyBot uses m³/h.',telegramRemoveKeyboard());
      return json({ok:true,status:'curve_waiting_flow'});
    }

    if(quotationButton||callbackData==='menu:quotation'){
      const user=await linkedKeySuiteUser(service,keySuiteCompanyId,senderId);
      if(!user){
        await telegramSend(telegramToken,chatId,'Quotation is available to linked KeySuite users only. Please ask the KeySuite administrator to link this Telegram account to your KeySuite user.',telegramReplyKeyboard([['⬅️ Main Menu']]));
        return json({ok:true,status:'quotation_user_not_linked'});
      }
      if(String(user.view_customers||'none')==='none'){
        await telegramSend(telegramToken,chatId,'Your KeySuite role does not have customer access.',telegramReplyKeyboard([['⬅️ Main Menu']]));
        return json({ok:true,status:'quotation_customer_access_denied'});
      }
      const aq=activeQuoteFromSession(session);if(aq?.customer_id){const customer=await allowedCustomerById(service,keySuiteCompanyId,user,String(aq.customer_id));if(customer){session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'quotation',step:'customer_selected',flow_m3h:null,head_m:null,flow_raw:null,head_raw:null,selected_customer_id:String(customer.id),context:{keysuite_user_email:user.email,customer_name:customer.company_name,draft_items:Array.isArray(aq.draft_items)?aq.draft_items:[],active_quote:aq,pending_request:null,pending_item:null}});await telegramSend(telegramToken,chatId,`Continuing quotation for ${customer.company_name}.\nWhat would you like to add?`,quotationProductMenu());return json({ok:true,status:'quotation_resumed',customer_id:customer.id})}}
      session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'quotation',step:'waiting_company',flow_m3h:null,head_m:null,flow_raw:null,head_raw:null,selected_customer_id:null,context:{keysuite_user_email:user.email}});
      await telegramSend(telegramToken,chatId,'Please type the customer/company name.\n\nExample: Key',telegramRemoveKeyboard());
      return json({ok:true,status:'quotation_waiting_company',user_email:user.email});
    }

    if(changeButton||callbackData==='curve:change'){
      session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'curve',step:'waiting_flow',flow_m3h:null,head_m:null,flow_raw:null,head_raw:null});
      await telegramSend(telegramToken,chatId,'Please enter the required flow again.',telegramRemoveKeyboard());
      return json({ok:true,status:'curve_waiting_flow'});
    }

    if(continueButton||callbackData==='curve:confirm'){
      if(!session||session.mode!=='curve'||!(Number(session.flow_m3h)>0&&Number(session.head_m)>0)){
        await telegramSend(telegramToken,chatId,'The duty point session has expired. Please start again.',mainMenuMarkup());
        return json({ok:true,status:'curve_session_expired'});
      }
      await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'curve',step:'waiting_family'});
      await telegramSend(telegramToken,chatId,'Choose the pump series for this curve:',telegramReplyKeyboard([['CHC'],['ES 2 Pole','ES 4 Pole'],['✏️ Change Duty','⬅️ Main Menu']]));
      return json({ok:true,status:'curve_waiting_family'});
    }

    const familyCallback=/^curve:family:(?:CHC|ES2|ES4)$/.test(callbackData)?callbackData.split(':').pop()||'':'';
    const selectedFamilyCode=familyCallback||familyTextCode;
    if(selectedFamilyCode&&session?.mode==='smart_curve'&&session?.step==='smart_waiting_family'){const c=sessionContext(session);session=await sendSimpleCurve(service,telegramToken,keySuiteCompanyId,chatId,senderId,session,mergeQuoteRequest(c.pending_request,{family_code:selectedFamilyCode,product_type:'pump'}));return json({ok:true,status:'smart_curve_family'})}
    if(selectedFamilyCode&&session?.mode==='price'&&session?.step==='price_waiting_family'){const user=await linkedKeySuiteUser(service,keySuiteCompanyId,senderId),customer=await allowedCustomerById(service,keySuiteCompanyId,user,String(session.selected_customer_id||'')),c=sessionContext(session);if(user&&customer){session=await continueSimplePrice(service,telegramToken,keySuiteCompanyId,chatId,senderId,session,customer,user,mergeQuoteRequest(c.pending_request,{family_code:selectedFamilyCode,product_type:'pump'}));return json({ok:true,status:'price_family'})}}
    if(selectedFamilyCode&&session?.mode==='quotation'&&session?.step==='quote_waiting_family'){
      const c=sessionContext(session),request=mergeQuoteRequest(c.pending_request,{product_type:'pump',family_code:selectedFamilyCode,flow_m3h:Number(session.flow_m3h||c.pending_request?.flow_m3h||0),head_m:Number(session.head_m||c.pending_request?.head_m||0)});session=await showPumpQuoteFromRequest(service,telegramToken,keySuiteCompanyId,chatId,senderId,session,request);return json({ok:true,status:'quotation_selection_processed'});
    }
    if(selectedFamilyCode){
      if(!session||session.mode!=='curve'||!(Number(session.flow_m3h)>0&&Number(session.head_m)>0)){
        await telegramSend(telegramToken,chatId,'The duty point session has expired. Please start again.',mainMenuMarkup());
        return json({ok:true,status:'curve_session_expired'});
      }
      const familyCode=selectedFamilyCode||'CHC';const family=familyCode==='CHC'?'CHC':'ES';const pole=familyCode==='ES2'?2:familyCode==='ES4'?4:0;
      const q=Number(session.flow_m3h),h=Number(session.head_m);const duty=`${oneDecimal(q)} m³/hr @ ${oneDecimal(h)} Mtr`;
      try{
        const pdfMeta=await generateCurvePdf(family,q,h,duty,env('KEYSUITE_PUBLIC_URL'),pole);
        const sent=await telegramSendDocument(telegramToken,chatId,pdfMeta.bytes,pdfMeta.filename,`${family==='ES'?esPoleLabel(pole):family} curve ready\n${duty}\nSelected: ${pdfMeta.model}`);
        const updateId=Number.isFinite(Number(update?.update_id))?Number(update.update_id):null;
        await service.from('ks_keyai_enquiries').insert({source:'telegram',external_update_id:updateId,external_message_id:Number(message?.message_id||0)||null,external_chat_id:chatId,sender_username:senderUsername||null,sender_name:senderName||null,raw_message:`Guided Curve: ${family==='ES'?esPoleLabel(pole):family} · ${duty}`,status:sent.ok?'curve_ready':'curve_pdf_error',ai_enabled:false,ai_summary:`${family==='ES'?esPoleLabel(pole):family} · ${duty} · ${pdfMeta.model}`,ai_result:{pump_family:family,es_pole:pole||null,flow_value:q,flow_unit:'m³/hr',head_value:h,head_unit:'m',duty_text:duty,selected_model:pdfMeta.model,guided:true},external_sender_id:senderId||null,keyai_company_id:keySuiteCompanyId||null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}).then(()=>{}).catch(()=>{});
        const prior=sessionContext(session),summary=applyPumpOptionsToItem(selectPumpSummary(family,q,h,pole),pumpOptions(prior.pending_item?.options,1));session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'curve',step:'curve_result',flow_m3h:q,head_m:h,context:{...prior,pending_item:summary,curve_pdf:{family,pole,q,h,duty,filename:pdfMeta.filename}}});
        await telegramSend(telegramToken,chatId,sent.ok?'Curve ready. You can adjust optional configuration or check the customer price.':'The curve was prepared but Telegram could not send the PDF. You can retry Curve PDF below.',pumpResultMenu('curve'));
        return json({ok:true,status:sent.ok?'curve_ready':'curve_pdf_error',guided:true,family,pole,model:pdfMeta.model});
      }catch(error){
        await telegramSend(telegramToken,chatId,'KeyBot could not generate this curve. Please try another duty point or contact KeySuite support.',telegramReplyKeyboard([['✏️ Change Duty','⬅️ Main Menu']]));
        return json({ok:true,status:'curve_generation_error',error:error instanceof Error?error.message:String(error)});
      }
    }


    if(editBomButton&&session?.mode==='keyplc'&&session?.step==='keyplc_result'){session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'keyplc',step:'keyplc_edit_menu',context:sessionContext(session)});await telegramSend(telegramToken,chatId,'✏️ Edit KeyPLC BOM\nChoose the component to change:',keyplcEditMenu());return json({ok:true,status:'keyplc_edit_menu'})}
    if(session?.mode==='keyplc'&&session?.step==='keyplc_edit_menu'&&!callbackQuery){const c=sessionContext(session);if(pumpButton){session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'keyplc',step:'keyplc_edit_pump',context:c});await telegramSend(telegramToken,chatId,'Enter the CHC/VMS pump model.\nExample: CHC 15-20',telegramRemoveKeyboard());return json({ok:true,status:'keyplc_edit_pump'})}if(motorButton||cleanButton==='panel'){session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'keyplc',step:'keyplc_edit_panel',context:c});await telegramSend(telegramToken,chatId,'Enter the KeyPLC VFD motor rating, for example 5.5kW, or type Auto.',telegramReplyKeyboard([['Auto']]));return json({ok:true,status:'keyplc_edit_panel'})}if(cleanButton==='manifold'){session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'keyplc',step:'keyplc_edit_manifold',context:c});await telegramSend(telegramToken,chatId,'Edit Manifold:',keyplcManifoldMenu(c.keyplc_bom));return json({ok:true,status:'keyplc_edit_manifold'})}if(tankButton){const r=await service.from('ks_products_gws').select('size_litres').eq('status','active').order('size_litres');const sizes=[...new Set((r.data||[]).map((x:any)=>Number(x.size_litres||0)).filter((x:number)=>x>0))].slice(0,16);const rows:any[]=[['Auto']];for(let i=0;i<sizes.length;i+=2)rows.push(sizes.slice(i,i+2).map(x=>`${inputNumber(x)}L`));rows.push(['⬅️ Edit BOM']);session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'keyplc',step:'keyplc_edit_tank',context:c});await telegramSend(telegramToken,chatId,'Choose GWS Tank size:',telegramReplyKeyboard(rows));return json({ok:true,status:'keyplc_edit_tank'})}if(doneOptionsButton){const req=c.keyplc_request||{};const user=c.keysuite_user_email?await linkedKeySuiteUser(service,keySuiteCompanyId,senderId):null;const customer=session.selected_customer_id&&user?await allowedCustomerById(service,keySuiteCompanyId,user,String(session.selected_customer_id)):null;session=await sendKeyplcSystem(service,telegramToken,keySuiteCompanyId,chatId,senderId,session,req,customer,user);return json({ok:true,status:'keyplc_edit_done'})}}
    if(session?.mode==='keyplc'&&session?.step==='keyplc_edit_pump'&&text&&!callbackQuery){const c=sessionContext(session),direct=parseDirectPumpModel(text);if(!direct||direct.family!=='CHC'){await telegramSend(telegramToken,chatId,'Please enter a valid CHC/VMS model, for example CHC 15-20.');return json({ok:true,status:'keyplc_edit_pump_waiting'})}const req={...(c.keyplc_request||{}),direct_model:direct.model,family_code:'CHC'};session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'keyplc',step:'keyplc_edit_menu',context:{...c,keyplc_request:req}});await telegramSend(telegramToken,chatId,`Pump changed to ${direct.model}.`,keyplcEditMenu());return json({ok:true,status:'keyplc_pump_updated'})}
    if(session?.mode==='keyplc'&&session?.step==='keyplc_edit_panel'&&text&&!callbackQuery){const c=sessionContext(session),req={...(c.keyplc_request||{})},b=systemBomOptions(req);if(cleanButton==='auto')b.panel_kw=0;else{const kw=Number((String(text).match(/\d+(?:\.\d+)?/)||[])[0]);if(!(kw>0)){await telegramSend(telegramToken,chatId,'Enter a motor rating such as 5.5kW, or Auto.');return json({ok:true,status:'keyplc_edit_panel_waiting'})}b.panel_kw=kw}req.system_bom=b;session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'keyplc',step:'keyplc_edit_menu',context:{...c,keyplc_request:req}});await telegramSend(telegramToken,chatId,b.panel_kw?`Panel rating override: ${inputNumber(b.panel_kw)} kW VFD + HMI.`:'Panel returned to Auto sizing.',keyplcEditMenu());return json({ok:true,status:'keyplc_panel_updated'})}
    if(session?.mode==='keyplc'&&session?.step==='keyplc_edit_manifold'&&!callbackQuery){const c=sessionContext(session),req={...(c.keyplc_request||{})},b=systemBomOptions(req);if(manifoldSizeButton){const r=await service.from('ks_products_manifold').select('model').eq('status','active').eq('section','header').order('source_row');const sizes=[...new Set((r.data||[]).map((x:any)=>String(x.model||'').replace(/^(?:GI|SS)\s+/i,'')).filter((x:string)=>/^DN\d+$/i.test(x)))].sort((a:any,b:any)=>dnNumberServer(a)-dnNumberServer(b));const rows:any[]=[['Auto']];for(let i=0;i<sizes.length;i+=2)rows.push(sizes.slice(i,i+2));rows.push(['⬅️ Manifold']);session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'keyplc',step:'keyplc_edit_manifold_size',context:c});await telegramSend(telegramToken,chatId,'Choose manifold header size:',telegramReplyKeyboard(rows));return json({ok:true,status:'keyplc_manifold_size'})}if(inletFlexibleButton){b.inlet_flexible=!b.inlet_flexible}else if(outletFlexibleButton){b.outlet_flexible=!b.outlet_flexible}else if(strainerButton){b.strainer=!b.strainer}else if(cleanButton==='edit bom'){session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'keyplc',step:'keyplc_edit_menu',context:c});await telegramSend(telegramToken,chatId,'Choose the component to change:',keyplcEditMenu());return json({ok:true,status:'keyplc_edit_menu'})}else{await telegramSend(telegramToken,chatId,'Choose a Manifold option.',keyplcManifoldMenu(c.keyplc_bom));return json({ok:true,status:'keyplc_manifold_waiting'})}req.system_bom=b;const user=c.keysuite_user_email?await linkedKeySuiteUser(service,keySuiteCompanyId,senderId):null,customer=session.selected_customer_id&&user?await allowedCustomerById(service,keySuiteCompanyId,user,String(session.selected_customer_id)):null;const bom=await buildKeyplcSystem(service,req,customer,user);session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'keyplc',step:'keyplc_edit_manifold',selected_customer_id:session.selected_customer_id,context:{...c,keyplc_request:req,keyplc_bom:bom}});await telegramSend(telegramToken,chatId,keyplcBomText(bom),keyplcManifoldMenu(bom));return json({ok:true,status:'keyplc_manifold_updated'})}
    if(session?.mode==='keyplc'&&session?.step==='keyplc_edit_manifold_size'&&text&&!callbackQuery){const c=sessionContext(session),req={...(c.keyplc_request||{})},b=systemBomOptions(req);if(cleanButton==='manifold'){session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'keyplc',step:'keyplc_edit_manifold',context:c});await telegramSend(telegramToken,chatId,'Edit Manifold:',keyplcManifoldMenu(c.keyplc_bom));return json({ok:true,status:'keyplc_edit_manifold'})}if(cleanButton==='auto')b.manifold_dn='';else if(/^dn\s*\d+$/i.test(String(text).trim()))b.manifold_dn=String(text).toUpperCase().replace(/\s+/g,'');else{await telegramSend(telegramToken,chatId,'Choose one of the shown DN sizes or Auto.');return json({ok:true,status:'keyplc_manifold_size_waiting'})}req.system_bom=b;session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'keyplc',step:'keyplc_edit_menu',context:{...c,keyplc_request:req}});await telegramSend(telegramToken,chatId,b.manifold_dn?`Manifold header override: ${b.manifold_dn}.`:'Manifold returned to Auto sizing.',keyplcEditMenu());return json({ok:true,status:'keyplc_manifold_size_updated'})}
    if(session?.mode==='keyplc'&&session?.step==='keyplc_edit_tank'&&text&&!callbackQuery){const c=sessionContext(session),req={...(c.keyplc_request||{})},b=systemBomOptions(req);if(cleanButton==='edit bom'){session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'keyplc',step:'keyplc_edit_menu',context:c});await telegramSend(telegramToken,chatId,'Choose the component to change:',keyplcEditMenu());return json({ok:true,status:'keyplc_edit_menu'})}if(cleanButton==='auto')b.tank_size_litres=0;else{const litres=Number((String(text).match(/\d+(?:\.\d+)?/)||[])[0]);if(!(litres>0)){await telegramSend(telegramToken,chatId,'Choose a shown GWS Tank size or Auto.');return json({ok:true,status:'keyplc_tank_waiting'})}b.tank_size_litres=litres}req.system_bom=b;session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'keyplc',step:'keyplc_edit_menu',context:{...c,keyplc_request:req}});await telegramSend(telegramToken,chatId,b.tank_size_litres?`Tank size override: ${inputNumber(b.tank_size_litres)}L.`:'Tank returned to Auto sizing.',keyplcEditMenu());return json({ok:true,status:'keyplc_tank_updated'})}
    if(checkPriceButton&&session?.mode==='keyplc'&&session?.step==='keyplc_result'&&!session.selected_customer_id){const user=await linkedKeySuiteUser(service,keySuiteCompanyId,senderId);if(!user){await telegramSend(telegramToken,chatId,'Price checking is available to linked KeySuite users only.',keyplcResultMenu(false));return json({ok:true,status:'keyplc_price_user_not_linked'})}const c=sessionContext(session);session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'keyplc',step:'keyplc_waiting_company',selected_customer_id:null,context:{...c,keysuite_user_email:user.email,customer_choices:[]}});await telegramSend(telegramToken,chatId,'Which customer is this KeyPLC system price for?\nType part of the company name.',telegramRemoveKeyboard());return json({ok:true,status:'keyplc_price_waiting_company'})}
    if(session?.mode==='keyplc'&&session?.step==='keyplc_waiting_company'&&text&&!callbackQuery&&!simpleRequestHasTechnical(smartQuoteRequest(text))){const c=sessionContext(session),user=await linkedKeySuiteUser(service,keySuiteCompanyId,senderId);if(!user){await telegramSend(telegramToken,chatId,'This Telegram account is not linked to an active KeySuite user.',mainMenuMarkup());return json({ok:true,status:'keyplc_user_not_linked'})}const choices=Array.isArray(c.customer_choices)?c.customer_choices:[],chosen=choices.find((x:any)=>cleanSearch(x.label)===cleanButton);if(chosen){const customer=await allowedCustomerById(service,keySuiteCompanyId,user,String(chosen.id));if(customer){session=await sendKeyplcSystem(service,telegramToken,keySuiteCompanyId,chatId,senderId,session,c.keyplc_request||{},customer,user);return json({ok:true,status:'keyplc_customer_selected'})}}session=await resolveKeyplcCustomer(service,telegramToken,keySuiteCompanyId,chatId,senderId,session,user,String(text),c.keyplc_request||{});return json({ok:true,status:'keyplc_customer_search'})}
    if((checkPriceButton||addToQuotationButton)&&session?.mode==='curve'&&['curve_result','direct_model_result'].includes(String(session?.step||''))){
      const user=await linkedKeySuiteUser(service,keySuiteCompanyId,senderId);if(!user){await telegramSend(telegramToken,chatId,'Price checking is available to linked KeySuite users only.',simpleCurveMenu());return json({ok:true,status:'price_user_not_linked'})}
      const c=sessionContext(session),item=c.pending_item;if(!item?.model){await telegramSend(telegramToken,chatId,'There is no pump selection waiting for pricing.',mainMenuMarkup());return json({ok:true,status:'price_no_selection'})}
      const code=String(item.family||'').toUpperCase()==='CHC'?'CHC':Number(item.pole||2)===4?'ES4':'ES2',req=mergeQuoteRequest(c.pending_request,{product_type:'pump',...(c.pending_request?.direct_model?{direct_model:c.pending_request.direct_model}:{}),flow_m3h:Number(item.requested_flow_m3h||session.flow_m3h||0),head_m:Number(item.requested_head_m||session.head_m||0),family_code:code,qty:Number(item.qty||1),options:pumpOptions(item.options,item.qty)});
      session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'price',step:'price_waiting_company',selected_customer_id:null,context:{keysuite_user_email:user.email,pending_request:req,pending_item:item}});await telegramSend(telegramToken,chatId,'Which customer is this price for?\nType part of the company name.',telegramRemoveKeyboard());return json({ok:true,status:'price_waiting_company'});
    }

    if(curvePdfButton){
      const c=sessionContext(session),item=c.pending_item;if(!item||!['CHC','ES'].includes(String(item.family||'').toUpperCase())){await telegramSend(telegramToken,chatId,'There is no pump curve waiting to be generated. Please make a pump selection first.',mainMenuMarkup());return json({ok:true,status:'curve_pdf_no_selection'})}
      try{const family=String(item.family).toUpperCase(),q=Number(item.requested_flow_m3h||session?.flow_m3h),h=Number(item.requested_head_m||session?.head_m),pole=family==='ES'?Number(item.pole||2):0,duty=`${oneDecimal(q)} m³/hr @ ${oneDecimal(h)} Mtr`,pdfMeta=await generateCurvePdf(family,q,h,duty,env('KEYSUITE_PUBLIC_URL'),pole);await telegramSendDocument(telegramToken,chatId,pdfMeta.bytes,pdfMeta.filename,`${family==='ES'?esPoleLabel(pole):family} curve ready\n${duty}\nSelected: ${pdfMeta.model}`);await telegramSend(telegramToken,chatId,'What would you like to do with this selection?',pumpResultMenu(session?.mode==='price'?'price':'curve'));return json({ok:true,status:'curve_pdf_sent',model:pdfMeta.model})}catch(error){await telegramSend(telegramToken,chatId,`Curve PDF could not be generated.\n\n${error instanceof Error?error.message:String(error)}`,pumpResultMenu(session?.mode==='price'?'price':'curve'));return json({ok:true,status:'curve_pdf_error'})}
    }

    if(optionsButton){
      const c=sessionContext(session),item=c.pending_item;if(!item||!['CHC','ES'].includes(String(item.family||'').toUpperCase())){await telegramSend(telegramToken,chatId,'Options are available after a pump has been selected.',mainMenuMarkup());return json({ok:true,status:'pump_options_no_selection'})}
      const returnStep=session?.mode==='price'?'price_result':session?.mode==='quotation'?'quote_result':'curve_result';const optionMode=session?.mode==='price'?'price':session?.mode==='quotation'?'quotation':'curve';session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:optionMode,step:'pump_options',context:{...c,option_return_step:returnStep,pending_item:applyPumpOptionsToItem(item,pumpOptions(item.options,item.qty))}});await telegramSend(telegramToken,chatId,`⚙️ Pump Options\n\n${pumpOptionSummary(sessionContext(session).pending_item)}\n\nChoose only what you want to change.`,pumpOptionsMenu());return json({ok:true,status:'pump_options'});
    }
    if(materialButton&&session?.step==='pump_options'){const c=sessionContext(session);await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:session.mode,step:'pump_option_material',context:c});await telegramSend(telegramToken,chatId,'Choose Material:',telegramReplyKeyboard([['Standard','SS304','SS316'],['⬅️ Options']]));return json({ok:true,status:'pump_option_material'})}
    if(motorButton&&session?.step==='pump_options'){const c=sessionContext(session);await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:session.mode,step:'pump_option_motor',context:c});await telegramSend(telegramToken,chatId,'Choose Motor Efficiency:',telegramReplyKeyboard([['IE3','IE4'],['IE5','IE2'],['⬅️ Options']]));return json({ok:true,status:'pump_option_motor'})}
    if(sealButton&&session?.step==='pump_options'){const c=sessionContext(session);await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:session.mode,step:'pump_option_seal',context:c});await telegramSend(telegramToken,chatId,'Choose Mechanical Seal:',telegramReplyKeyboard([['Carbon/SiC','SiC/SiC'],['TC/TC'],['⬅️ Options']]));return json({ok:true,status:'pump_option_seal'})}
    if(connectionButton&&session?.step==='pump_options'){const c=sessionContext(session);await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:session.mode,step:'pump_option_connection',context:c});await telegramSend(telegramToken,chatId,'Choose Connection:',telegramReplyKeyboard([['Round Flange','Oval Flange'],['⬅️ Options']]));return json({ok:true,status:'pump_option_connection'})}
    if(bareShaftButton&&session?.step==='pump_options'){const c=sessionContext(session);await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:session.mode,step:'pump_option_bare',context:c});await telegramSend(telegramToken,chatId,'Bare shaft pump?',telegramReplyKeyboard([['No','Yes'],['⬅️ Options']]));return json({ok:true,status:'pump_option_bare'})}
    if(quantityButton&&session?.step==='pump_options'){const c=sessionContext(session);await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:session.mode,step:'pump_option_qty',context:c});await telegramSend(telegramToken,chatId,'Enter quantity, for example 2.',telegramRemoveKeyboard());return json({ok:true,status:'pump_option_qty'})}
    if(!callbackQuery&&cleanButton==='options'&&String(session?.step||'').startsWith('pump_option_')){const c=sessionContext(session);session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:session.mode,step:'pump_options',context:c});await telegramSend(telegramToken,chatId,`⚙️ Pump Options\n\n${pumpOptionSummary(c.pending_item)}`,pumpOptionsMenu());return json({ok:true,status:'pump_options'})}
    if(!callbackQuery&&String(session?.step||'').startsWith('pump_option_')&&text){
      const c=sessionContext(session),item=c.pending_item;if(!item)return json({ok:true,status:'pump_option_no_item'});let o=pumpOptions(item.options,item.qty),accepted=true;
      if(session.step==='pump_option_material'){const map:any={standard:'Standard',ss304:'SS304',ss316:'SS316'};if(!map[cleanButton])accepted=false;else o.material=map[cleanButton]}
      else if(session.step==='pump_option_motor'){const v=String(text||'').toUpperCase().replace(/\s+/g,'');if(!['IE2','IE3','IE4','IE5'].includes(v))accepted=false;else o.motor_efficiency=v}
      else if(session.step==='pump_option_seal'){const map:any={'carbon sic':'Carbon/SiC','sic sic':'SiC/SiC','tc tc':'TC/TC'};if(!map[cleanButton])accepted=false;else o.seal=map[cleanButton]}
      else if(session.step==='pump_option_connection'){const map:any={'round flange':'Round Flange','oval flange':'Oval Flange'};if(!map[cleanButton])accepted=false;else o.connection=map[cleanButton]}
      else if(session.step==='pump_option_bare'){if(!['yes','no'].includes(cleanButton))accepted=false;else o.bare_shaft=cleanButton==='yes'}
      else if(session.step==='pump_option_qty'){const n=Math.trunc(Number((String(text).match(/\d+/)||[])[0]));if(!(n>=1&&n<=999))accepted=false;else o.qty=n}
      if(!accepted){await telegramSend(telegramToken,chatId,'Please choose one of the shown options.');return json({ok:true,status:'pump_option_waiting'})}
      let updated=applyPumpOptionsToItem(item,o);if((session.mode==='quotation'||session.mode==='price')&&session.selected_customer_id){try{updated=await quotePumpForCustomer(service,String(session.selected_customer_id),updated,String(c.keysuite_user_email||''))}catch(error){await telegramSend(telegramToken,chatId,`That option could not be priced.\n\n${error instanceof Error?error.message:String(error)}`);return json({ok:true,status:'pump_option_pricing_error'})}}
      const pendingRequest=mergeQuoteRequest(c.pending_request,{options:o,qty:o.qty});session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:session.mode,step:'pump_options',context:{...c,pending_item:updated,pending_request:pendingRequest}});await telegramSend(telegramToken,chatId,`Updated.\n\n${pumpOptionSummary(updated)}`,pumpOptionsMenu());return json({ok:true,status:'pump_option_updated'});
    }
    if(doneOptionsButton&&session?.step==='pump_options'){const c=sessionContext(session),item=c.pending_item;const returnMode=session.mode==='price'?'price':session.mode==='quotation'?'quotation':'curve',returnStep=returnMode==='price'?'price_result':returnMode==='quotation'?'quote_result':'curve_result';session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:returnMode,step:returnStep,context:{...c,option_return_step:null}});await telegramSend(telegramToken,chatId,quotationResultText(item),pumpResultMenu(returnMode));return json({ok:true,status:'pump_options_done'})}

    if(addToQuotationButton&&session?.mode==='curve'&&session?.step==='curve_result'){
      const c=sessionContext(session),pending=c.pending_item;if(!pending?.model){await telegramSend(telegramToken,chatId,'There is no pump selection waiting to be added.',mainMenuMarkup());return json({ok:true,status:'curve_no_pending_item'})}
      const user=await linkedKeySuiteUser(service,keySuiteCompanyId,senderId);if(!user){await telegramSend(telegramToken,chatId,'Add to Quotation is available to linked KeySuite users only.',mainMenuMarkup());return json({ok:true,status:'quotation_user_not_linked'})}
      const aq=c.active_quote;if(aq?.customer_id){const customer=await allowedCustomerById(service,keySuiteCompanyId,user,String(aq.customer_id));if(customer){try{let priced=await quotePumpForCustomer(service,String(customer.id),pending,String(user.email||''));const items=Array.isArray(aq.draft_items)?aq.draft_items.slice(0,49):[];items.push({...priced,id:crypto.randomUUID()});const draft=await ensurePersistentDraft(service,keySuiteCompanyId,chatId,senderId,String(user.email||''),String(customer.id),String(customer.company_name||''),items,String(c.active_draft_id||''));session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'quotation',step:'quote_after_add',selected_customer_id:String(customer.id),context:{keysuite_user_email:user.email,customer_name:customer.company_name,draft_items:items,active_draft_id:String(draft?.id||''),pending_item:null,pending_request:null,active_quote:{customer_id:String(customer.id),customer_name:customer.company_name,keysuite_user_email:user.email,draft_items:items}}});await telegramSend(telegramToken,chatId,`✅ Added to ${customer.company_name} quotation draft.`,telegramReplyKeyboard([['➕ Add Another Item','📄 View Draft'],['⬅️ Main Menu']]));return json({ok:true,status:'curve_added_to_active_quote',items:items.length})}catch(error){await telegramSend(telegramToken,chatId,`This pump could not be priced for ${customer.company_name}.\n\n${error instanceof Error?error.message:String(error)}`,pumpResultMenu('curve'));return json({ok:true,status:'curve_quote_price_error'})}}}
      const familyCode=String(pending.family||'').toUpperCase()==='CHC'?'CHC':Number(pending.pole)===4?'ES4':'ES2',request={product_type:'pump',flow_m3h:Number(pending.requested_flow_m3h),head_m:Number(pending.requested_head_m),family_code:familyCode,qty:Number(pending.qty||1),options:pumpOptions(pending.options,pending.qty)};session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'quotation',step:'waiting_company',selected_customer_id:null,context:{keysuite_user_email:user.email,draft_items:[],pending_request:request,pending_item:null,from_curve:true}});await telegramSend(telegramToken,chatId,'Which customer is this quotation for?\nPlease type part of the company name.',telegramRemoveKeyboard());return json({ok:true,status:'curve_quote_waiting_company'});
    }

    if(searchAgainButton||callbackData==='quote:search'){
      const user=await linkedKeySuiteUser(service,keySuiteCompanyId,senderId);
      if(!user){await telegramSend(telegramToken,chatId,'This Telegram account is not linked to a KeySuite user.',mainMenuMarkup());return json({ok:true,status:'quotation_user_not_linked'})}
      const prior=sessionContext(session);await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'quotation',step:'waiting_company',selected_customer_id:null,context:{keysuite_user_email:user.email,draft_items:[],active_draft_id:'',pending_request:null}});
      await telegramSend(telegramToken,chatId,'Type the customer/company name to search again.',telegramRemoveKeyboard());
      return json({ok:true,status:'quotation_waiting_company'});
    }

    if(/^quote:customer:[A-Za-z0-9_-]+$/.test(callbackData)){
      const customerId=callbackData.slice('quote:customer:'.length);const user=await linkedKeySuiteUser(service,keySuiteCompanyId,senderId);const customer=await allowedCustomerById(service,keySuiteCompanyId,user,customerId);
      if(!customer){await telegramSend(telegramToken,chatId,'That customer is not available under your KeySuite access. Please search again.',telegramReplyKeyboard([['🔎 Search Again','⬅️ Main Menu']]));return json({ok:true,status:'quotation_customer_denied'})}
      const prior=sessionContext(session);session=await selectQuotationCustomer(service,telegramToken,keySuiteCompanyId,chatId,senderId,user,customer,prior,prior.pending_request);session=await continueQuotationRequest(service,telegramToken,keySuiteCompanyId,chatId,senderId,session,prior.pending_request||{});
      return json({ok:true,status:'quotation_customer_selected',customer_id:customer.id,customer_name:customer.company_name});
    }

    // V4.13.10 quotation draft builder.
    if(pumpButton){
      if(!session||session.mode!=='quotation'||!session.selected_customer_id){await telegramSend(telegramToken,chatId,'Please select the customer first.',mainMenuMarkup());return json({ok:true,status:'quotation_customer_required'})}
      const c=sessionContext(session);session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'quotation',step:'quote_pump_method',context:{...c,pending_item:null}});
      await telegramSend(telegramToken,chatId,'How would you like to select the pump?',telegramReplyKeyboard([['📐 By Flow & Head'],['🔎 Change Company','⬅️ Main Menu']]));return json({ok:true,status:'quotation_pump_method'});
    }
    if(tankButton){
      if(!session||session.mode!=='quotation'||!session.selected_customer_id){await telegramSend(telegramToken,chatId,'Please select the customer first.',mainMenuMarkup());return json({ok:true,status:'quotation_customer_required'})}
      const c=sessionContext(session),request=mergeQuoteRequest(c.pending_request,{product_type:'tank'});session=await showTankQuoteFromRequest(service,telegramToken,keySuiteCompanyId,chatId,senderId,session,request);return json({ok:true,status:'quotation_tank_started'});
    }
    if(byFlowHeadButton){
      if(!session||session.mode!=='quotation'||!session.selected_customer_id){await telegramSend(telegramToken,chatId,'Please select the customer first.',mainMenuMarkup());return json({ok:true,status:'quotation_customer_required'})}
      const c=sessionContext(session);session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'quotation',step:'quote_waiting_flow',flow_m3h:null,head_m:null,flow_raw:null,head_raw:null,context:{...c,pending_request:mergeQuoteRequest(c.pending_request,{product_type:'pump'}),pending_item:null}});
      await telegramSend(telegramToken,chatId,'Please enter the pump flow.\nExample: 20 m³/h\n\nIf you enter only a number, KeyBot uses m³/h.',telegramRemoveKeyboard());return json({ok:true,status:'quotation_waiting_flow'});
    }
    if(selectAgainButton){
      if(!session||session.mode!=='quotation'||!session.selected_customer_id){await telegramSend(telegramToken,chatId,'Please select the customer first.',mainMenuMarkup());return json({ok:true,status:'quotation_customer_required'})}
      const c=sessionContext(session),tankAgain=String(c.pending_item?.family||'').toUpperCase()==='GWS'||String(c.pending_request?.product_type||'')==='tank';
      if(tankAgain){const request={product_type:'tank',qty:Math.max(1,Number(c.pending_request?.qty||c.pending_item?.qty||1))};session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'quotation',step:'quote_waiting_tank',flow_m3h:null,head_m:null,context:{...c,pending_request:request,pending_tank_matches:null,pending_item:null}});await telegramSend(telegramToken,chatId,'Please enter the GWS Tank model or size again.\nExample: 100L 10 bar or PWB-100',telegramRemoveKeyboard());return json({ok:true,status:'quotation_waiting_tank'})}
      const request={...mergeQuoteRequest(c.pending_request,{product_type:'pump'}),flow_m3h:null,head_m:null,family_code:''};session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'quotation',step:'quote_waiting_flow',flow_m3h:null,head_m:null,flow_raw:null,head_raw:null,context:{...c,pending_request:request,pending_item:null}});
      await telegramSend(telegramToken,chatId,'Please enter the pump flow again.\nYou can enter everything at once, for example: 20m3/hr @ 30m, CHC',telegramRemoveKeyboard());return json({ok:true,status:'quotation_waiting_flow'});
    }
    if(addToQuotationButton&&session?.mode==='quotation'){
      if(!session||session.mode!=='quotation'||!session.selected_customer_id){await telegramSend(telegramToken,chatId,'The quotation session has expired. Please select the customer again.',mainMenuMarkup());return json({ok:true,status:'quotation_session_expired'})}
      const c=sessionContext(session),pending=c.pending_item;if(!pending?.model){await telegramSend(telegramToken,chatId,'There is no product selection waiting to be added. Please select a product first.',quotationProductMenu());return json({ok:true,status:'quotation_no_pending_item'})}
      const qty=Math.max(1,Math.trunc(Number(pending.qty)||1)),items=draftItemsFrom(session);items.push({...pending,id:crypto.randomUUID(),qty});const draft=await persistDraftItems(service,keySuiteCompanyId,chatId,senderId,session,items),activeQuote={customer_id:String(session.selected_customer_id),customer_name:String(c.customer_name||'Selected Customer'),keysuite_user_email:String(c.keysuite_user_email||''),draft_items:items};session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'quotation',step:'quote_after_add',context:{...c,draft_items:items,active_draft_id:String(draft?.id||c.active_draft_id||''),pending_request:null,pending_item:null,pending_tank_matches:null,active_quote:activeQuote}});
      await telegramSend(telegramToken,chatId,`✅ ${qty} unit${qty===1?'':'s'} added to quotation draft.\n\nDraft now has ${items.length} line item${items.length===1?'':'s'}.`,telegramReplyKeyboard([['➕ Add Another Item','📄 View Draft'],['📄 Create Quotation'],['⬅️ Main Menu']]));return json({ok:true,status:'quotation_item_added',items:items.length,qty});
    }
    if(addAnotherItemButton){
      if(!session||session.mode!=='quotation'||!session.selected_customer_id){await telegramSend(telegramToken,chatId,'The quotation session has expired. Please select the customer again.',mainMenuMarkup());return json({ok:true,status:'quotation_session_expired'})}
      const c=sessionContext(session);session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'quotation',step:'customer_selected',flow_m3h:null,head_m:null,flow_raw:null,head_raw:null,context:{...c,pending_request:null,pending_tank_matches:null,pending_item:null}});await telegramSend(telegramToken,chatId,'What would you like to add?',quotationProductMenu());return json({ok:true,status:'quotation_add_another'});
    }
    if(viewDraftButton){
      if(!session||session.mode!=='quotation'||!session.selected_customer_id){await telegramSend(telegramToken,chatId,'The quotation session has expired. Please select the customer again.',mainMenuMarkup());return json({ok:true,status:'quotation_session_expired'})}
      const c=sessionContext(session);if(c.active_draft_id){const draft=await loadPersistentDraft(service,keySuiteCompanyId,String(c.active_draft_id));if(draft&&draft.status==='active')session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'quotation',step:'quote_after_add',selected_customer_id:String(draft.customer_id),context:{...c,customer_name:draft.customer_name,draft_items:Array.isArray(draft.items)?draft.items:[]}})}
      await telegramSend(telegramToken,chatId,quotationDraftText(session),persistentDraftMenu());return json({ok:true,status:'quotation_draft_view',items:draftItemsFrom(session).length});
    }
    if(editItemButton){
      if(!session||session.mode!=='quotation'){await telegramSend(telegramToken,chatId,'Open a quotation draft first.',mainMenuMarkup());return json({ok:true,status:'draft_required'})}const items=draftItemsFrom(session);if(!items.length){await telegramSend(telegramToken,chatId,'There are no items to edit.',persistentDraftMenu());return json({ok:true,status:'draft_no_items'})}const labels=items.map((x:any,i:number)=>({index:i,label:draftItemButtonLabel(x,i)})),c=sessionContext(session);session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'quotation',step:'draft_edit_choose',context:{...c,draft_item_choices:labels}});await telegramSend(telegramToken,chatId,'Which item do you want to edit?',telegramReplyKeyboard([...labels.map((x:any)=>[x.label]),['📄 View Draft','⬅️ Main Menu']]));return json({ok:true,status:'draft_edit_choose'});
    }
    if(removeItemButton){
      if(!session||session.mode!=='quotation'){await telegramSend(telegramToken,chatId,'Open a quotation draft first.',mainMenuMarkup());return json({ok:true,status:'draft_required'})}const items=draftItemsFrom(session);if(!items.length){await telegramSend(telegramToken,chatId,'There are no items to remove.',persistentDraftMenu());return json({ok:true,status:'draft_no_items'})}const labels=items.map((x:any,i:number)=>({index:i,label:draftItemButtonLabel(x,i)})),c=sessionContext(session);session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'quotation',step:'draft_remove_choose',context:{...c,draft_item_choices:labels}});await telegramSend(telegramToken,chatId,'Which item do you want to remove?',telegramReplyKeyboard([...labels.map((x:any)=>[x.label]),['📄 View Draft','⬅️ Main Menu']]));return json({ok:true,status:'draft_remove_choose'});
    }
    if(!callbackQuery&&session?.step==='draft_edit_choose'&&text){const c=sessionContext(session),choices=Array.isArray(c.draft_item_choices)?c.draft_item_choices:[],choice=choices.find((x:any)=>cleanSearch(x.label)===cleanButton);if(choice){session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'quotation',step:'draft_edit_qty',context:{...c,draft_edit_index:Number(choice.index)}});await telegramSend(telegramToken,chatId,`Enter the new quantity for ${choice.label}.`,telegramRemoveKeyboard());return json({ok:true,status:'draft_edit_qty'})}}
    if(!callbackQuery&&session?.step==='draft_edit_qty'&&text){const n=Math.trunc(Number((String(text).match(/\d+/)||[])[0]));if(!(n>=1&&n<=999)){await telegramSend(telegramToken,chatId,'Please enter a quantity from 1 to 999.');return json({ok:true,status:'draft_edit_qty'})}const c=sessionContext(session),items=draftItemsFrom(session),i=Number(c.draft_edit_index);if(!(i>=0&&i<items.length)){await telegramSend(telegramToken,chatId,'That draft item is no longer available.',persistentDraftMenu());return json({ok:true,status:'draft_edit_missing'})}items[i]={...items[i],qty:n,line_total:Number(items[i].unit_price||0)*n};const draft=await persistDraftItems(service,keySuiteCompanyId,chatId,senderId,session,items);session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'quotation',step:'quote_after_add',context:{...c,draft_items:items,active_draft_id:String(draft?.id||c.active_draft_id||''),draft_edit_index:null,draft_item_choices:null}});await telegramSend(telegramToken,chatId,`✅ Quantity updated to ${n}.\n\n${quotationDraftText(session)}`,persistentDraftMenu());return json({ok:true,status:'draft_item_updated'})}
    if(!callbackQuery&&session?.step==='draft_remove_choose'&&text){const c=sessionContext(session),choices=Array.isArray(c.draft_item_choices)?c.draft_item_choices:[],choice=choices.find((x:any)=>cleanSearch(x.label)===cleanButton);if(choice){const items=draftItemsFrom(session),i=Number(choice.index),removed=items.splice(i,1)[0];const draft=await persistDraftItems(service,keySuiteCompanyId,chatId,senderId,session,items);session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'quotation',step:'quote_after_add',context:{...c,draft_items:items,active_draft_id:String(draft?.id||c.active_draft_id||''),draft_item_choices:null}});await telegramSend(telegramToken,chatId,`🗑 Removed ${removed?.model||'item'}.\n\n${quotationDraftText(session)}`,persistentDraftMenu());return json({ok:true,status:'draft_item_removed'})}}
    if(cancelDraftButton){const c=sessionContext(session);if(c.active_draft_id)await service.from('ks_keybot_quote_drafts_v41309').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('id',String(c.active_draft_id));session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'',step:'idle',selected_customer_id:null,flow_m3h:null,head_m:null,context:{}});await telegramSend(telegramToken,chatId,'Quotation draft cancelled.',mainMenuMarkup());return json({ok:true,status:'draft_cancelled'})}
    if(createQuotationButton){
      if(!session||session.mode!=='quotation'){await telegramSend(telegramToken,chatId,'Open a quotation draft first.',mainMenuMarkup());return json({ok:true,status:'draft_required'})}const c=sessionContext(session),draft=await loadPersistentDraft(service,keySuiteCompanyId,String(c.active_draft_id||''));if(!draft||draft.status!=='active'){await telegramSend(telegramToken,chatId,'The active quotation draft could not be found. Open My Drafts and try again.',mainMenuMarkup());return json({ok:true,status:'draft_missing'})}if(!Array.isArray(draft.items)||!draft.items.length){await telegramSend(telegramToken,chatId,'Add at least one item before creating the quotation.',persistentDraftMenu());return json({ok:true,status:'draft_empty'})}
      try{const saved=await createSavedQuotationFromDraft(service,keySuiteCompanyId,draft),no=String(saved?.no||saved?.quotationNo||'Saved quotation'),id=String(saved?.id||'');await service.from('ks_keybot_quote_drafts_v41309').update({status:'converted',converted_quotation_id:id||null,converted_quotation_no:no||null,updated_at:new Date().toISOString()}).eq('id',draft.id);session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'',step:'idle',selected_customer_id:null,flow_m3h:null,head_m:null,context:{}});await telegramSend(telegramToken,chatId,`✅ Quotation created in KeySuite.\n\nReference: ${no}\nStatus: Saved\n\nOpen KeySuite to review it. KeyBot did not Seal it or generate the quotation PDF.`,mainMenuMarkup());return json({ok:true,status:'quotation_created',quotation_no:no,quotation_id:id})}catch(error){await telegramSend(telegramToken,chatId,`The Saved quotation could not be created.\n\n${error instanceof Error?error.message:String(error)}`,persistentDraftMenu());return json({ok:true,status:'quotation_create_error'})}
    }

    if(!callbackQuery&&session?.mode==='quotation'&&session?.step==='quote_waiting_flow'&&text){
      const c=sessionContext(session),smart=smartQuoteRequest(text),fallback=parseFlowStep(text);if(!smart.flow_m3h&&fallback)smart.flow_m3h=fallback.value;if(!smart.flow_m3h){await telegramSend(telegramToken,chatId,'I could not read that flow. Please enter a positive number, for example 20 or 20 m³/h.');return json({ok:true,status:'quotation_waiting_flow'})}smart.product_type='pump';session=await showPumpQuoteFromRequest(service,telegramToken,keySuiteCompanyId,chatId,senderId,session,mergeQuoteRequest(c.pending_request,smart));return json({ok:true,status:'quotation_smart_flow_processed'});
    }
    if(!callbackQuery&&session?.mode==='quotation'&&session?.step==='quote_waiting_head'&&text){
      const c=sessionContext(session),smart=smartQuoteRequest(text),fallback=parseHeadStep(text);if(!smart.head_m&&fallback)smart.head_m=fallback.value;smart.flow_m3h=Number(smart.flow_m3h||session.flow_m3h||c.pending_request?.flow_m3h||0);smart.product_type='pump';if(!smart.head_m){await telegramSend(telegramToken,chatId,'I could not read that head. Please enter a positive number, for example 45 or 4.5 bar.');return json({ok:true,status:'quotation_waiting_head'})}session=await showPumpQuoteFromRequest(service,telegramToken,keySuiteCompanyId,chatId,senderId,session,mergeQuoteRequest(c.pending_request,smart));return json({ok:true,status:'quotation_smart_head_processed'});
    }

    if(!callbackQuery&&session?.mode==='quotation'&&session?.step==='quote_waiting_tank'&&text){
      const c=sessionContext(session),smart=smartQuoteRequest(`tank ${text}`);smart.raw_input=text;smart.product_type='tank';session=await showTankQuoteFromRequest(service,telegramToken,keySuiteCompanyId,chatId,senderId,session,mergeQuoteRequest(c.pending_request,smart));return json({ok:true,status:'quotation_tank_processed'});
    }
    if(!callbackQuery&&session?.mode==='quotation'&&session?.step==='quote_waiting_tank_choice'&&text){
      const c=sessionContext(session),choices=Array.isArray(c.pending_tank_matches)?c.pending_tank_matches:[],choice=choices.find((x:any)=>cleanSearch(x.label)===cleanSearch(text));if(!choice){await telegramSend(telegramToken,chatId,'Please choose one of the GWS Tank options shown, or press Select Again.');return json({ok:true,status:'quotation_tank_choice_waiting'})}
      try{const r=await service.from('ks_products_gws').select('*').eq('id',choice.id).eq('status','active').maybeSingle();if(r.error||!r.data)throw new Error('That GWS Tank is no longer available.');const qty=Math.max(1,Math.trunc(Number(c.pending_request?.qty)||1)),item=await quoteGwsForCustomer(service,String(session.selected_customer_id||''),r.data,qty,String(c.keysuite_user_email||''));session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'quotation',step:'quote_result',context:{...c,pending_tank_matches:null,pending_item:item}});await telegramSend(telegramToken,chatId,quotationResultText(item),telegramReplyKeyboard([['✅ Add to Quotation'],['🔄 Select Again','📄 View Draft'],['⬅️ Main Menu']]));return json({ok:true,status:'quotation_tank_selection_ready',model:item.model,unit_price:item.unit_price})}catch(error){await telegramSend(telegramToken,chatId,`The GWS Tank selection/pricing could not be completed.\n\n${error instanceof Error?error.message:String(error)}`);return json({ok:true,status:'quotation_tank_error'})}
    }

    if(!callbackQuery&&session?.mode==='curve'&&session?.step==='waiting_flow'&&text){
      const parsed=parseFlowStep(text);if(!parsed){await telegramSend(telegramToken,chatId,'I could not read that flow. Please enter a positive number, for example 20 or 20 m³/h.');return json({ok:true,status:'curve_waiting_flow'})}
      await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'curve',step:'waiting_head',flow_m3h:parsed.value,flow_raw:parsed.raw});
      await telegramSend(telegramToken,chatId,`Flow: ${oneDecimal(parsed.value)} m³/hr\n\nPlease enter the required head.\nExample: 45 m\n\nIf you enter only a number, KeyBot uses metres.`);
      return json({ok:true,status:'curve_waiting_head',flow_m3h:parsed.value});
    }

    if(!callbackQuery&&session?.mode==='curve'&&session?.step==='waiting_head'&&text){
      const parsed=parseHeadStep(text);if(!parsed){await telegramSend(telegramToken,chatId,'I could not read that head. Please enter a positive number, for example 45 or 4.5 bar.');return json({ok:true,status:'curve_waiting_head'})}
      const next=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'curve',step:'confirm',head_m:parsed.value,head_raw:parsed.raw});const q=Number(next?.flow_m3h||session.flow_m3h),h=Number(parsed.value);
      await telegramSend(telegramToken,chatId,`Duty Point\nFlow: ${oneDecimal(q)} m³/hr\nHead: ${oneDecimal(h)} Mtr`,telegramReplyKeyboard([['✅ Continue','✏️ Change'],['⬅️ Main Menu']]));
      return json({ok:true,status:'curve_confirm',flow_m3h:q,head_m:h});
    }

    if(!callbackQuery&&session?.mode==='quotation'&&session?.step==='waiting_company'&&text&&!simpleRequestHasTechnical(smartQuoteRequest(text))){
      const user=await linkedKeySuiteUser(service,keySuiteCompanyId,senderId);if(!user){await telegramSend(telegramToken,chatId,'This Telegram account is no longer linked to an active KeySuite user.',mainMenuMarkup());return json({ok:true,status:'quotation_user_not_linked'})}
      const c=sessionContext(session),parsed=smartQuoteRequest(text),pending=mergeQuoteRequest(c.pending_request,parsed),query=customerQueryFromQuoteText(text,parsed)||text,matches=await findAllowedCustomers(service,keySuiteCompanyId,user,query);
      if(!matches.length){session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'quotation',step:'waiting_company',context:{...c,pending_request:hasQuoteTechnicalFacts(pending)?pending:c.pending_request}});await telegramSend(telegramToken,chatId,`No customer matched “${query}”.\nPlease try another part of the company name.`,telegramReplyKeyboard([['⬅️ Main Menu']]));return json({ok:true,status:'quotation_no_company_match'})}
      const exact=matches.find((x:any)=>cleanSearch(x.company_name)===cleanSearch(query));
      if(exact||matches.length===1){const chosen=exact||matches[0];session=await selectQuotationCustomer(service,telegramToken,keySuiteCompanyId,chatId,senderId,user,chosen,c,hasQuoteTechnicalFacts(pending)?pending:c.pending_request);await telegramSend(telegramToken,chatId,`✅ Company selected: ${chosen.company_name}`);session=await continueQuotationRequest(service,telegramToken,keySuiteCompanyId,chatId,senderId,session,hasQuoteTechnicalFacts(pending)?pending:{});return json({ok:true,status:'quotation_customer_selected',customer_id:chosen.id,customer_name:chosen.company_name})}
      session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'quotation',step:'waiting_company',context:{...c,pending_request:hasQuoteTechnicalFacts(pending)?pending:c.pending_request}});const rows=matches.map((x:any)=>[String(x.company_name).slice(0,55)]);rows.push(['🔎 Search Again','⬅️ Main Menu']);await telegramSend(telegramToken,chatId,`I found ${matches.length} similar customers for “${query}”.\nPlease confirm which company you mean:`,telegramReplyKeyboard(rows));return json({ok:true,status:'quotation_company_matches',count:matches.length,matches:matches.map((x:any)=>({id:x.id,name:x.company_name}))});
    }

    if(!callbackQuery&&session?.mode==='quotation'&&session?.step==='customer_selected'&&text){
      const smart=smartQuoteRequest(text);if(hasQuoteTechnicalFacts(smart)){session=await continueQuotationRequest(service,telegramToken,keySuiteCompanyId,chatId,senderId,session,smart);return json({ok:true,status:'quotation_smart_request_processed'})}
    }

    // V4.13.10 message-first KeyBot. Any supplied facts are kept; only missing facts are requested.
    if(!callbackQuery&&session?.mode==='smart_curve'&&['smart_waiting_flow','smart_waiting_head'].includes(String(session?.step||''))&&text){const c=sessionContext(session),parsed=smartQuoteRequest(text),fallback=session.step==='smart_waiting_flow'?parseFlowStep(text):parseHeadStep(text);if(session.step==='smart_waiting_flow'&&!parsed.flow_m3h&&fallback)parsed.flow_m3h=fallback.value;if(session.step==='smart_waiting_head'&&!parsed.head_m&&fallback)parsed.head_m=fallback.value;session=await sendSimpleCurve(service,telegramToken,keySuiteCompanyId,chatId,senderId,session,mergeQuoteRequest(c.pending_request,parsed));return json({ok:true,status:'smart_curve_followup'})}
    if(!callbackQuery&&session?.mode==='smart_curve'&&session?.step==='smart_waiting_family'&&familyTextCode){const c=sessionContext(session);session=await sendSimpleCurve(service,telegramToken,keySuiteCompanyId,chatId,senderId,session,mergeQuoteRequest(c.pending_request,{family_code:familyTextCode}));return json({ok:true,status:'smart_curve_family'})}
    if(!callbackQuery&&session?.mode==='price'&&session?.step==='price_waiting_company'&&text&&!simpleRequestHasTechnical(smartQuoteRequest(text))){const user=await linkedKeySuiteUser(service,keySuiteCompanyId,senderId);if(!user){await telegramSend(telegramToken,chatId,'This Telegram account is not linked to an active KeySuite user.',mainMenuMarkup());return json({ok:true,status:'price_user_not_linked'})}const c=sessionContext(session),choices=Array.isArray(c.customer_choices)?c.customer_choices:[],chosen=choices.find((x:any)=>cleanSearch(x.label)===cleanButton);if(chosen){const customer=await allowedCustomerById(service,keySuiteCompanyId,user,String(chosen.id));if(customer){session=await continueSimplePrice(service,telegramToken,keySuiteCompanyId,chatId,senderId,session,customer,user,c.pending_request||{});return json({ok:true,status:'price_customer_selected'})}}session=await resolveSimplePriceCustomer(service,telegramToken,keySuiteCompanyId,chatId,senderId,session,user,String(text),c.pending_request||{});return json({ok:true,status:'price_customer_search'})}
    if(!callbackQuery&&session?.mode==='price'&&['price_waiting_flow','price_waiting_head','price_waiting_product','price_waiting_tank'].includes(String(session?.step||''))&&text){const user=await linkedKeySuiteUser(service,keySuiteCompanyId,senderId),customer=await allowedCustomerById(service,keySuiteCompanyId,user,String(session.selected_customer_id||''));if(!user||!customer){await telegramSend(telegramToken,chatId,'The customer price session has expired. Start a new request.',mainMenuMarkup());return json({ok:true,status:'price_session_expired'})}const c=sessionContext(session),prefix=session.step==='price_waiting_tank'?'tank ':'',parsed=smartQuoteRequest(prefix+text);if(session.step==='price_waiting_flow'&&!parsed.flow_m3h){const f=parseFlowStep(text);if(f)parsed.flow_m3h=f.value}if(session.step==='price_waiting_head'&&!parsed.head_m){const h=parseHeadStep(text);if(h)parsed.head_m=h.value}session=await continueSimplePrice(service,telegramToken,keySuiteCompanyId,chatId,senderId,session,customer,user,mergeQuoteRequest(c.pending_request,parsed));return json({ok:true,status:'price_followup'})}
    if(!callbackQuery&&session?.mode==='price'&&session?.step==='price_waiting_family'&&familyTextCode){const user=await linkedKeySuiteUser(service,keySuiteCompanyId,senderId),customer=await allowedCustomerById(service,keySuiteCompanyId,user,String(session.selected_customer_id||'')),c=sessionContext(session);if(user&&customer){session=await continueSimplePrice(service,telegramToken,keySuiteCompanyId,chatId,senderId,session,customer,user,mergeQuoteRequest(c.pending_request,{family_code:familyTextCode,product_type:'pump'}));return json({ok:true,status:'price_family'})}}
    if(!callbackQuery&&session?.mode==='price'&&session?.step==='price_waiting_tank_choice'&&text){const user=await linkedKeySuiteUser(service,keySuiteCompanyId,senderId),customer=await allowedCustomerById(service,keySuiteCompanyId,user,String(session.selected_customer_id||'')),c=sessionContext(session),choices=Array.isArray(c.pending_tank_matches)?c.pending_tank_matches:[],choice=choices.find((x:any)=>cleanSearch(x.label)===cleanButton);if(user&&customer&&choice){const r=await service.from('ks_products_gws').select('*').eq('id',choice.id).eq('status','active').maybeSingle();if(r.data){const qty=Math.max(1,Math.trunc(Number(c.pending_request?.qty)||1)),item=await quoteGwsForCustomer(service,String(customer.id),r.data,qty,String(user.email||''));session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'price',step:'price_result',selected_customer_id:String(customer.id),context:{...c,pending_item:item,pending_tank_matches:null}});await telegramSend(telegramToken,chatId,`Customer: ${customer.company_name}\n\n${quotationResultText(item)}`,simplePriceMenu(false));return json({ok:true,status:'tank_price_ready'})}}await telegramSend(telegramToken,chatId,'Please choose one of the shown GWS Tank options.');return json({ok:true,status:'tank_choice_waiting'})}

    // V4.14.00: fresh technical/system commands override stale customer-search sessions.
    if(!callbackQuery&&text&&!menuText&&!curveButton&&!quotationButton&&!optionsButton&&!curvePdfButton&&!checkPriceButton&&!newRequestButton&&!familyTextCode&&!editBomButton){const parsed=smartQuoteRequest(text),customerHint=customerHintFromMessage(text,parsed),explicitPrice=/\b(?:price|pricing)\b/i.test(text);if(simpleRequestHasTechnical(parsed)||customerHint||explicitPrice){
      if(parsed.product_type==='keyplc_system'||parsed.system_type==='KEYPLC'){if(customerHint){const user=await linkedKeySuiteUser(service,keySuiteCompanyId,senderId);if(!user){await telegramSend(telegramToken,chatId,'Customer pricing is available to linked KeySuite users only.',mainMenuMarkup());return json({ok:true,status:'keyplc_user_not_linked'})}session=await resolveKeyplcCustomer(service,telegramToken,keySuiteCompanyId,chatId,senderId,session,user,customerHint,parsed);return json({ok:true,status:'message_first_keyplc_price'})}session=await sendKeyplcSystem(service,telegramToken,keySuiteCompanyId,chatId,senderId,session,parsed,null,null);return json({ok:true,status:'message_first_keyplc'})}
      if((parsed.product_type==='tank'||explicitPrice)&&!customerHint){const user=await linkedKeySuiteUser(service,keySuiteCompanyId,senderId);if(!user){await telegramSend(telegramToken,chatId,'For GWS Tank pricing, this Telegram account must be linked to a KeySuite user.',mainMenuMarkup());return json({ok:true,status:'tank_price_user_not_linked'})}session=await saveKeybotSession(service,keySuiteCompanyId,chatId,senderId,{mode:'price',step:'price_waiting_company',selected_customer_id:null,context:{keysuite_user_email:user.email,pending_request:parsed}});await telegramSend(telegramToken,chatId,parsed.product_type==='tank'?'Which customer is this tank price for?\nType part of the company name.':'Which customer is this price for?\nType part of the company name.',telegramRemoveKeyboard());return json({ok:true,status:'price_waiting_company'})}
      if(customerHint){const user=await linkedKeySuiteUser(service,keySuiteCompanyId,senderId);if(!user){await telegramSend(telegramToken,chatId,'Customer pricing is available to linked KeySuite users only.',mainMenuMarkup());return json({ok:true,status:'price_user_not_linked'})}session=await resolveSimplePriceCustomer(service,telegramToken,keySuiteCompanyId,chatId,senderId,session,user,customerHint,parsed);return json({ok:true,status:'message_first_price'})}
      session=await sendSimpleCurve(service,telegramToken,keySuiteCompanyId,chatId,senderId,session,parsed);return json({ok:true,status:'message_first_curve'});
    }}

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
