(() => {
  'use strict';
  const el=id=>document.getElementById(id);
  let access=null,bound=false,inboxItems=[],inboxFilter='all',senderItems=[],inboxPollTimer=0;
  const role=()=>String(access?.role||window.KEYSUITE_ACCESS?.role||'').toLowerCase();
  const has=key=>window.KeySuitePermissions?.can?.(key,role())??(role()==='owner');
  const canAccess=()=>has('keyai_access');
  const canOpenAiControl=()=>has('keyai_openai_control');
  const canSenderAssign=()=>has('keyai_sender_assign');
  const client=()=>window.KeySuiteAuth?.getClient?.()||null;
  function errorText(value){
    if(value==null)return 'Unknown KeyBot error.';
    if(typeof value==='string')return value;
    if(value instanceof Error&&value.message)return String(value.message);
    if(typeof value==='object'){
      const v=value;
      for(const key of ['message','error_description','details','hint','code']){const hit=v?.[key];if(typeof hit==='string'&&hit.trim())return hit.trim()}
      try{const s=JSON.stringify(v);if(s&&s!=='{}')return s}catch(_){}
    }
    return String(value);
  }
  async function bridge(action,payload={}){const c=client();if(!c)throw new Error('Secure KeySuite connection is unavailable.');const result=await c.functions.invoke('keysuite-keyai',{body:{action,...payload}});if(result.error){let message=errorText(result.error);try{const ctx=result.error.context;if(ctx&&typeof ctx.clone==='function'){const body=await ctx.clone().json().catch(()=>null);if(body?.error)message=errorText(body.error)}else if(ctx&&typeof ctx.json==='function'){const body=await ctx.json().catch(()=>null);if(body?.error)message=errorText(body.error)}}catch(_){}throw new Error(message)}const data=result.data||{};if(data.error)throw new Error(errorText(data.error));return data}
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function notice(text,type='info'){const box=el('keyAiNotice');if(!box)return;box.textContent=text||'';box.className='notice'+(type==='ok'?' active-customer':'')}
  function status(text,state=''){const label=el('keyAiOpenAiStatus'),dot=el('keyAiStatusDot');if(label)label.textContent=text||'';if(dot)dot.className=`keyai-status-dot ${state}`.trim()}
  function number(value){return Number(value||0).toLocaleString('en-MY')}
  function moneyUsd(value){const n=Number(value||0);return n<0.01?`US$ ${n.toFixed(6)}`:`US$ ${n.toFixed(2)}`}
  function row(data){return Array.isArray(data)?(data[0]||{}):(data||{})}
  function statusLabel(value){
    const map={ai_disabled_manual_review:'AI Disabled – Manual Review',ai_draft_ready:'AI Draft Ready',curve_ready:'Curve Ready',awaiting_customer:'Awaiting Customer',ai_error_manual_review:'AI Error – Manual Review',sender_mode_nothing:'Recorded Only',curve_only_manual_review:'Curve Only – Manual Review',received:'Received',processing:'Processing',followup_processed:'Follow-up Processed'};
    return map[String(value||'')]||String(value||'Received').replaceAll('_',' ');
  }
  function statusClass(value){value=String(value||'');return value==='ai_draft_ready'||value==='curve_ready'?'ready':value==='awaiting_customer'?'waiting':value.includes('error')?'error':''}
  function formatTime(value){if(!value)return '-';try{return new Date(value).toLocaleString('en-MY',{dateStyle:'medium',timeStyle:'short'})}catch(_){return String(value)}}
  function text(value,fallback='—'){const s=String(value??'').trim();return s||fallback}
  function jsonish(value){const s=String(value??'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();return s.startsWith('{')||s.startsWith('[')||s.startsWith('"{')||s.startsWith("'{")}
  function parseJsonish(value){
    if(value&&typeof value==='object'&&!Array.isArray(value))return value;
    let s=String(value??'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
    if(!s)return null;
    for(let i=0;i<3;i++){
      try{const parsed=JSON.parse(s);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return parsed;if(typeof parsed==='string'){s=parsed.trim();continue}}catch(_){/* try object slice below */}
      const first=s.indexOf('{'),last=s.lastIndexOf('}');
      if(first>=0&&last>first){try{const parsed=JSON.parse(s.slice(first,last+1));if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return parsed}catch(_){}}
      break;
    }
    return null;
  }
  function list(value){
    if(Array.isArray(value))return value.map(v=>String(v||'').trim()).filter(Boolean);
    if(typeof value==='string'&&value.trim().startsWith('[')){try{const parsed=JSON.parse(value);if(Array.isArray(parsed))return parsed.map(v=>String(v||'').trim()).filter(Boolean)}catch(_){}}
    return [];
  }
  function firstNumber(match){const n=Number(match?.[1]);return Number.isFinite(n)?n:null}
  function unitKey(value){return String(value||'').toLowerCase().replace(/³/g,'3').replace(/\s+/g,' ').trim()}
  function flowToM3h(value,unit){
    const n=Number(value);if(!Number.isFinite(n))return null;const u=unitKey(unit).replace(/\./g,'');
    if(!u||/(?:m3\s*\/\s*(?:h|hr|hour)|m3h|m3ph)/.test(u))return n;
    if(/(?:l\s*\/\s*s|lps|l\s*per\s*sec)/.test(u))return n*3.6;
    if(/(?:l\s*\/\s*(?:min|minute)|lpm)/.test(u))return n*0.06;
    if(/(?:imp(?:erial)?\s*gpm|igpm)/.test(u))return n*0.2727654;
    if(/(?:us\s*gpm|usgpm)/.test(u))return n*0.227124707;
    return null;
  }
  function headToM(value,unit){
    const n=Number(value);if(!Number.isFinite(n))return null;const u=unitKey(unit).replace(/\./g,'');
    if(!u||/^(?:m|mtr|metre|meter|metres|meters)(?:\s*head)?$/.test(u))return n;
    if(/^(?:ft|feet|foot)(?:\s*head)?$/.test(u))return n*0.3048;
    if(/^bar$/.test(u))return n*10.19716213;
    if(/^kpa$/.test(u))return n*0.1019716213;
    if(/^psi$/.test(u))return n*0.703249615;
    return null;
  }
  function normaliseUnits(d){
    if(d.flow_value!==null&&d.flow_value!==undefined){const q=flowToM3h(d.flow_value,d.flow_unit);if(q!==null){d.flow_value=Number(q.toFixed(3));d.flow_unit='m³/hr'}}
    if(d.head_value!==null&&d.head_value!==undefined){const h=headToM(d.head_value,d.head_unit);if(h!==null){d.head_value=Number(h.toFixed(3));d.head_unit='m'}}
    return d;
  }
  function extractFacts(source){
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
    let application=null;
    if(/\bbooster\b/i.test(s))application='Booster';else if(/\btransfer\b/i.test(s))application='Transfer';
    let fluid=null;
    if(/\bwater\b/i.test(s))fluid='Water';else if(/\boil\b/i.test(s))fluid='Oil';
    let material=null;
    if(/\b(?:ss\s*304|stainless\s*steel\s*304)\b/i.test(s))material='Stainless Steel 304';
    else if(/\b(?:ss\s*316|stainless\s*steel\s*316)\b/i.test(s))material='Stainless Steel 316';
    else if(/\bcast\s*iron\b[^\n]{0,30}\bstainless\s*steel\b/i.test(s)||/\bci\s*[/+-]\s*ss\b/i.test(s))material='Cast Iron / Stainless Steel';
    else if(/\bstandard\s+material\b/i.test(s))material='Standard Material';
    let elastomer=null;
    if(/\bepdm\b/i.test(s))elastomer='EPDM';else if(/\bviton\b/i.test(s))elastomer='Viton';else if(/\bnbr\b/i.test(s))elastomer='NBR';else if(/\bstandard\s+(?:seal|elastomer)\b/i.test(s))elastomer='Standard';
    let installation=null;if(/\boutdoor\b/i.test(s))installation='Outdoor';else if(/\bindoor\b/i.test(s))installation='Indoor';
    let suctionCondition=null;if(/\bsuction\s+lift\b/i.test(s))suctionCondition='Suction Lift';else if(/\bflooded\s+suction\b|\bpositive\s+suction\b/i.test(s))suctionCondition='Flooded / Positive Suction';else if(/\bsuction\s+(?:condition\s+)?unknown\b/i.test(s))suctionCondition='Unknown';
    let fluidTemperature=null;const tempMatch=s.match(/(-?\d+(?:\.\d+)?)\s*(?:(?:deg(?:ree)?s?)\s*)?(?:°\s*)?c\b/i);if(tempMatch)fluidTemperature=`${Number(tempMatch[1])}°C`;
    let flowBasis=null;
    if(/\btotal\s+(?:system\s+)?flow\b/i.test(s)||/\bsystem\s+flow\b/i.test(s)||/\b(?:m3|m³|l\s*\/\s*s|lps|lpm|gpm)\b[^\n]{0,24}\btotal\b/i.test(lower))flowBasis='total_system';
    if(/\bper\s+(?:duty\s+)?pump\b/i.test(s)||/\beach\s+(?:duty\s+)?pump\b/i.test(s)||/\bper\s+duty\b/i.test(s))flowBasis='per_duty_pump';
    const explicitArrangement=duty!==null||onDemand!==null||standby!==null;
    if(genericPump!==null&&explicitArrangement){if(duty===null)duty=1;const known=Number(duty||0)+Number(onDemand||0)+Number(standby||0);if(onDemand===null&&genericPump>known)onDemand=genericPump-known;}
    const pumpQuantity=genericPump!==null?genericPump:(explicitArrangement?Number(duty||0)+Number(onDemand||0)+Number(standby||0):null);
    const dutyConfiguration=explicitArrangement?[duty!==null?`${duty} Duty`:null,onDemand!==null?`${onDemand} On Demand`:null,standby!==null?`${standby} Standby`:null].filter(Boolean).join(' + '):null;
    const flowRaw=flowMatch?Number(flowMatch[1]):null,headRaw=headMatch?Number(headMatch[1]):null;
    const flowValue=flowMatch?flowToM3h(flowRaw,flowMatch[2]):null,headValue=headMatch?headToM(headRaw,headMatch[2]):null;
    return {application,system_type:application?`${application} System`:null,pump_quantity:pumpQuantity,duty_configuration:dutyConfiguration,flow_value:flowValue===null?null:Number(flowValue.toFixed(3)),flow_unit:flowValue===null?null:'m³/hr',flow_basis:flowBasis,head_value:headValue===null?null:Number(headValue.toFixed(3)),head_unit:headValue===null?null:'m',fluid,fluid_temperature:fluidTemperature,material,elastomer,installation,suction_condition:suctionCondition,voltage:firstNumber(voltageMatch),phase:phaseMatch?`${phaseMatch[1]} Phase`:null,frequency_hz:firstNumber(hzMatch)};
  }
  function normalApplication(value){const s=String(value||'').trim();if(/booster/i.test(s))return 'Booster';if(/transfer/i.test(s))return 'Transfer';return s||null}
  function defaultDutyConfiguration(qty){const n=Math.max(0,Math.trunc(Number(qty)||0));if(n===1)return '1 Duty';if(n>1)return `1 Duty + ${n-1} On Demand`;return null}
  function applyKeyAiDefaults(d){
    if(!d.application)d.application='Booster';
    if(!d.system_type)d.system_type=`${normalApplication(d.application)||'Booster'} System`;
    if(d.pump_quantity&&!d.duty_configuration)d.duty_configuration=defaultDutyConfiguration(d.pump_quantity);
    if(d.flow_value!==null&&d.flow_value!==undefined&&!d.flow_basis)d.flow_basis='per_duty_pump';
    if(!d.fluid)d.fluid='Water';if(!d.fluid_temperature)d.fluid_temperature='10–70°C';
    if(d.voltage===null||d.voltage===undefined)d.voltage=415;if(!d.phase)d.phase='3 Phase';if(d.frequency_hz===null||d.frequency_hz===undefined)d.frequency_hz=50;
    if(!d.material)d.material='Standard Material';if(!d.elastomer)d.elastomer='Standard';if(!d.installation)d.installation='Indoor';if(!d.suction_condition)d.suction_condition='Flooded / Positive Suction';
    return d;
  }
  function generatedSummary(d){
    const parts=[];
    if(d.system_type)parts.push(d.system_type);
    if(d.duty_configuration)parts.push(d.duty_configuration);
    if(d.flow_value!==null&&d.flow_value!==undefined)parts.push(`${d.flow_value} ${d.flow_unit||'m³/hr'}`);
    if(d.head_value!==null&&d.head_value!==undefined)parts.push(`${d.head_value} ${d.head_unit||'m'} head`);
    if(d.fluid)parts.push(d.fluid);
    if(d.voltage!==null&&d.voltage!==undefined)parts.push(`${d.voltage} V`);
    return parts.join(' · ')||'KeyBot prepared quotation requirements.';
  }
  function normaliseDraft(item){
    let d=parseJsonish(item?.ai_result)||{};
    const nested=parseJsonish(d.raw_output)||parseJsonish(jsonish(d.summary)?d.summary:'');
    if(nested)d={...d,...nested};
    const followups=Array.isArray(item?.followups)?item.followups:[];
    const source=[item?.raw_message||'',...followups.map(f=>f?.message||''),typeof item?.ai_result==='string'?item.ai_result:'',typeof d.raw_output==='string'?d.raw_output:''].filter(Boolean).join('\n');
    const facts=extractFacts(source);const merged={...d};
    const fields=['application','system_type','pump_quantity','duty_configuration','flow_value','flow_unit','flow_basis','head_value','head_unit','fluid','fluid_temperature','material','elastomer','installation','suction_condition','voltage','phase','frequency_hz'];
    fields.forEach(k=>{if((merged[k]===null||merged[k]===undefined||merged[k]==='')&&facts[k]!==null&&facts[k]!==undefined&&facts[k]!=='')merged[k]=facts[k]});
    ['application','system_type','pump_quantity','duty_configuration','flow_value','flow_unit','flow_basis','head_value','head_unit','fluid','fluid_temperature','material','elastomer','installation','suction_condition','voltage','phase','frequency_hz'].forEach(k=>{if(facts[k]!==null&&facts[k]!==undefined&&facts[k]!=='')merged[k]=facts[k]});
    normaliseUnits(merged);merged.application=normalApplication(merged.application||facts.application);
    if(merged.application&&(!merged.system_type||/duty|standby|on demand/i.test(String(merged.system_type))))merged.system_type=`${merged.application} System`;
    if(merged.flow_value!==null&&merged.flow_value!==undefined&&!merged.flow_unit)merged.flow_unit='m³/hr';
    if(merged.head_value!==null&&merged.head_value!==undefined&&!merged.head_unit)merged.head_unit='m';
    if(!['total_system','per_duty_pump'].includes(String(merged.flow_basis||'')))merged.flow_basis=facts.flow_basis||null;
    applyKeyAiDefaults(merged);
    const parsedSummary=String(merged.summary||'').trim();merged.summary=parsedSummary&&!jsonish(parsedSummary)?parsedSummary:generatedSummary(merged);
    let critical=list(merged.critical_missing_information).filter(v=>/required flow|flow is not confirmed|required head|head is not confirmed|contradict|conflict|ambiguous|unclear/i.test(v));
    const automaticCritical=[];
    if(merged.flow_value===null||merged.flow_value===undefined)automaticCritical.push('Required flow is not confirmed.');
    if(merged.head_value===null||merged.head_value===undefined)automaticCritical.push('Required head is not confirmed.');
    merged.critical_missing_information=[...automaticCritical,...critical].filter((v,i,a)=>v&&a.indexOf(v)===i);
    merged.missing_information=list(merged.missing_information).filter(v=>/required flow|required head|contradict|conflict|ambiguous|unclear/i.test(v)).filter(v=>!merged.critical_missing_information.includes(v));
    merged.clarification_questions=list(item?.clarification_questions).length?list(item.clarification_questions):list(merged.clarification_questions);
    return merged;
  }
  function flowBasis(value){return ({total_system:'Total system flow',per_duty_pump:'Flow per duty pump'})[String(value||'')]||'Not confirmed'}
  function field(label,value){return `<div class="keyai-detail"><span>${esc(label)}</span><b>${esc(text(value))}</b></div>`}
  function friendlyDraft(item){
    const d=normaliseDraft(item);
    const details=[];
    if(d.system_type)details.push(field('System',d.system_type));
    if(d.application&&String(d.application)!==String(d.system_type))details.push(field('Application',d.application));
    if(d.duty_configuration)details.push(field('Configuration',d.duty_configuration));
    if(d.pump_quantity!==null&&d.pump_quantity!==undefined)details.push(field('Total Pumps',d.pump_quantity));
    if(d.flow_value!==null&&d.flow_value!==undefined)details.push(field('Flow',`${d.flow_value} ${d.flow_unit||''}`.trim()));
    if(d.flow_value!==null&&d.flow_value!==undefined)details.push(field('Flow Basis',flowBasis(d.flow_basis)));
    if(d.head_value!==null&&d.head_value!==undefined)details.push(field('Head',`${d.head_value} ${d.head_unit||''}`.trim()));
    if(d.voltage!==null&&d.voltage!==undefined)details.push(field('Voltage',`${d.voltage} V`));
    if(d.phase)details.push(field('Phase',d.phase));
    if(d.frequency_hz!==null&&d.frequency_hz!==undefined)details.push(field('Frequency',`${d.frequency_hz} Hz`));
    if(d.fluid)details.push(field('Fluid',d.fluid));
    if(d.fluid_temperature)details.push(field('Fluid Temp',d.fluid_temperature));
    if(d.material)details.push(field('Material',d.material));
    if(d.elastomer)details.push(field('Elastomer',d.elastomer));
    if(d.installation)details.push(field('Installation',d.installation));
    if(d.suction_condition)details.push(field('Suction',d.suction_condition));
    const critical=list(d.critical_missing_information);
    const missing=list(d.missing_information).filter(x=>!critical.includes(x));
    const questions=String(item?.status||'')==='awaiting_customer'?list(d.clarification_questions):[];
    const followups=Array.isArray(item.followups)?item.followups:[];
    let html=`<div class="keyai-draft-summary"><b>Summary</b><div>${esc(d.summary||generatedSummary(d))}</div></div>`;
    if(details.length)html+=`<div class="keyai-detail-grid">${details.join('')}</div>`;
    if(questions.length)html+=`<div class="keyai-clarification"><b>Waiting for customer</b><ul>${questions.map(q=>`<li>${esc(q).replace(/\n/g,'<br>')}</li>`).join('')}</ul></div>`;
    if(critical.length)html+=`<div class="keyai-missing critical"><b>Critical / Need confirmation</b><ul>${critical.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></div>`;
    if(missing.length)html+=`<div class="keyai-missing"><b>Other information not supplied</b><ul>${missing.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></div>`;
    if(followups.length)html+=`<div class="keyai-conversation"><b>Customer follow-up</b>${followups.map(f=>`<div class="keyai-followup"><span>${esc(formatTime(f.created_at))}</span><div>${esc(f.message||'')}</div></div>`).join('')}</div>`;
    if(d.notes&&!jsonish(d.notes))html+=`<div class="keyai-notes"><b>Notes</b><div>${esc(d.notes)}</div></div>`;
    return html;
  }
  async function openInboxPdf(enquiryId,button){
    const c=client();if(!c||!enquiryId)return;
    const original=button?button.textContent:'PDF';
    const popup=window.open('about:blank','_blank');
    if(button){button.disabled=true;button.textContent='Generating…'}
    try{
      const {data,error}=await c.functions.invoke('telegram-webhook',{body:{action:'generate_curve_pdf',enquiry_id:String(enquiryId)}});
      if(error)throw error;
      let blob=data instanceof Blob?data:null;
      if(!blob&&data instanceof ArrayBuffer)blob=new Blob([data],{type:'application/pdf'});
      if(!blob&&data)blob=new Blob([data],{type:'application/pdf'});
      if(!blob||!blob.size)throw new Error('No PDF data was returned.');
      const url=URL.createObjectURL(blob);
      if(popup)popup.location.replace(url);
      else{const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.click()}
      setTimeout(()=>URL.revokeObjectURL(url),300000);
    }catch(error){
      if(popup)popup.close();
      console.error('KeyBot Inbox PDF generation failed',error);
      alert('PDF could not be generated. '+String(error?.message||error||'Please try again.'));
    }finally{
      if(button){button.disabled=false;button.textContent=original||'PDF'}
    }
  }
  function inboxKind(item){
    const st=String(item?.status||'');
    const d=normaliseDraft(item);
    if(st==='awaiting_customer')return 'waiting';
    if(st.includes('error')||st==='ai_disabled_manual_review'||list(d.critical_missing_information).length)return 'attention';
    if(st==='ai_draft_ready'||st==='curve_ready')return 'ready';
    return 'other';
  }
  function inboxCounts(items){
    return items.reduce((a,item)=>{a.all++;const k=inboxKind(item);a[k]=(a[k]||0)+1;return a},{all:0,ready:0,waiting:0,attention:0,other:0});
  }
  function renderInbox(){
    const box=el('keyAiInbox');if(!box)return;
    const q=String(el('keyAiInboxSearch')?.value||'').trim().toLowerCase();
    const counts=inboxCounts(inboxItems);
    ['all','ready','waiting','attention'].forEach(k=>{const b=el(`keyAiFilter${k[0].toUpperCase()+k.slice(1)}`);if(b){b.classList.toggle('active',inboxFilter===k);const n=counts[k]||0;b.querySelector('b')&&(b.querySelector('b').textContent=String(n))}});
    const items=inboxItems.filter(item=>{if(inboxFilter!=='all'&&inboxKind(item)!==inboxFilter)return false;if(!q)return true;return [item.sender_name,item.sender_username,item.raw_message,item.ai_summary].some(v=>String(v||'').toLowerCase().includes(q))});
    box.innerHTML=items.map(item=>{
      const sender=[item.sender_name,item.sender_username?`@${item.sender_username}`:''].filter(Boolean).join(' · ')||'Telegram user';
      const kind=inboxKind(item);const d=normaliseDraft(item);
      const isFollowup=!!item.parent_enquiry_id;
      const attention=kind==='attention'&&!String(item.status||'').includes('error')&&String(item.status||'')!=='ai_disabled_manual_review';
      const curveUrl=String(d.selector_url||'').trim();
      const canPreview=!isFollowup&&['curve_ready','curve_pdf_error'].includes(String(item.status||''))&&/^https?:\/\//i.test(curveUrl);
      const actions=canPreview?`<div class="keyai-enquiry-actions"><a class="btn secondary" href="${esc(curveUrl)}" target="_blank" rel="noopener">Preview Curve</a><button class="btn action-pdf" type="button" data-keyai-pdf-id="${esc(item.id)}">PDF</button></div>`:'';
      const followupBadge=isFollowup?'<span class="keyai-enquiry-status">Follow-up</span>':'';
      const draft=(!isFollowup&&item.ai_enabled)?`<div class="keyai-friendly-draft">${friendlyDraft(item)}</div>`:'';
      const preview=String(item.raw_message||'').replace(/\s+/g,' ').trim();
      return `<details class="keyai-enquiry"><summary class="keyai-enquiry-summary"><div class="keyai-enquiry-head"><div><b>${esc(sender)}</b><div class="keyai-enquiry-meta">${esc(formatTime(item.created_at))} · Telegram</div></div><div class="keyai-enquiry-badges">${followupBadge}<span class="keyai-enquiry-status ${statusClass(item.status)}">${esc(statusLabel(item.status))}</span>${attention?'<span class="keyai-enquiry-status error">Incomplete</span>':''}</div></div><div class="keyai-enquiry-preview">${esc(preview||'No message')}</div></summary><div class="keyai-enquiry-body"><div class="keyai-enquiry-message">${esc(item.raw_message||'')}</div>${draft}${actions}${item.ai_error?`<div class="keyai-enquiry-ai"><b>AI error:</b> ${esc(item.ai_error)}</div>`:''}</div></details>`;
    }).join('')||'<div class="muted">No enquiries match this view.</div>';
    box.querySelectorAll('[data-keyai-pdf-id]').forEach(btn=>{
      btn.addEventListener('click',()=>openInboxPdf(btn.getAttribute('data-keyai-pdf-id'),btn));
    });
  }
  async function loadInbox(silent=false){
    if(!canAccess())return;const c=client(),box=el('keyAiInbox');if(!c||!box)return;
    if(!silent)box.innerHTML='<div class="muted">Loading Telegram enquiries…</div>';
    try{
      const data=await bridge('list_inbox',{limit:100});
      inboxItems=Array.isArray(data.items)?data.items:[];renderInbox();
      if(!silent){
        const c=data?.catchup||{};
        const tg=data?.telegram||{};
        if(Number(c.synced||0)>0){
          notice(`KeyBot Inbox caught up ${Number(c.synced)} Telegram message${Number(c.synced)===1?'':'s'} from the old KeyAI project.${tg.connected?' Telegram live webhook is connected to KeySuite.':''}`,'ok');
        }else if(c.error){
          notice(`KeyBot Inbox loaded, but transition catch-up failed: ${errorText(c.error)}`);
        }else if(tg.configured&&!tg.connected){
          notice(`KeyBot Inbox loaded. Telegram webhook repair was attempted but is not yet connected to KeySuite.${tg.error?' '+errorText(tg.error):''}`);
        }
      }
    }catch(error){console.error(error);if(!silent)box.innerHTML=`<div class="notice">KeyBot Inbox connection failed. Check the KeySuite unified Supabase migration and keysuite-keyai function. ${esc(errorText(error))}</div>`}
  }
  function companyId(){return String(access?.company_id||window.KEYSUITE_ACCESS?.company_id||'').trim()}
  function customerRows(){return window.KeySuiteApp?.getCustomers?.()||[]}
  function categoryName(customer){
    const id=String(customer?.pricingCategoryId||customer?.pricing_category_id||'');
    const category=(window.KEYSUITE_SECURE_DATA?.categories||[]).find(x=>String(x.id||'')===id);
    return category?.name||'Not Set';
  }
  function customerLabel(customer){
    if(!customer)return 'Not Assigned';
    const name=String(customer.company||customer.company_name||customer.name||customer.id||'Customer').trim();
    const category=categoryName(customer);
    return category&&category!=='Not Set'?`${name} · ${category}`:name;
  }
  function senderDisplay(row){
    const name=String(row?.sender_name||'').trim(),user=String(row?.sender_username||'').trim();
    return name||user||`Telegram ${row?.sender_id||''}`;
  }
  function senderModeLabel(value){
    const mode=String(value||'nothing');
    return mode==='curve_price'?'Curve & Price':mode==='curve_only'?'Curve Only':'Nothing';
  }
  function renderSenders(){
    const body=el('keyAiSenderRows'),empty=el('keyAiSenderEmpty'),search=String(el('keyAiSenderSearch')?.value||'').trim().toLowerCase();
    if(!body)return;
    const assignAllowed=canSenderAssign();
    const customers=customerRows().slice().sort((a,b)=>String(a.company||'').localeCompare(String(b.company||''),undefined,{numeric:true,sensitivity:'base'}));
    const filtered=senderItems.filter(row=>!search||[row.sender_name,row.sender_username,row.sender_id,row.customer_name,row.pricing_category_name,senderModeLabel(row.response_mode)].some(v=>String(v||'').toLowerCase().includes(search)));
    body.innerHTML=filtered.map(row=>{
      const assigned=!!row.assigned;
      const mode=String(row.response_mode||'nothing');
      const options=['<option value="">— Not Assigned —</option>',...customers.map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(row.customer_id||'')?'selected':''}>${esc(customerLabel(c))}</option>`)].join('');
      const modeOptions=[
        `<option value="nothing" ${mode==='nothing'?'selected':''}>Nothing</option>`,
        `<option value="curve_only" ${mode==='curve_only'?'selected':''}>Curve Only</option>`,
        `<option value="curve_price" ${mode==='curve_price'?'selected':''}>Curve & Price</option>`
      ].join('');
      const disabled=assignAllowed?'':' disabled';
      return `<tr>
        <td><b>${esc(senderDisplay(row))}</b>${row.sender_username?`<div class="keyai-enquiry-meta">@${esc(row.sender_username)}</div>`:''}</td>
        <td><span class="keyai-sender-id">${esc(row.sender_id||'')}</span></td>
        <td>${assigned?`<span class="keyai-company-badge assigned">${esc(row.customer_name||'Assigned')}</span>`:'<span class="keyai-company-badge unassigned">Not Assigned</span>'}</td>
        <td>${assigned?esc(row.pricing_category_name||'Not Set'):'—'}</td>
        <td><span class="keyai-mode-badge ${esc(mode)}">${esc(senderModeLabel(mode))}</span></td>
        <td>${esc(formatTime(row.last_seen_at))}</td>
        <td><div class="keyai-sender-assign ${assignAllowed?'':'readonly'}"><select data-keyai-sender-select="${esc(row.sender_id||'')}"${disabled}>${options}</select><select class="keyai-sender-mode" data-keyai-sender-mode="${esc(row.sender_id||'')}"${disabled}>${modeOptions}</select><button class="btn secondary" type="button" data-keyai-sender-save="${esc(row.sender_id||'')}"${disabled}>Save</button></div></td>
      </tr>`;
    }).join('');
    if(empty)empty.hidden=filtered.length>0;
    el('keyAiSenderCount')&&(el('keyAiSenderCount').textContent=String(senderItems.length));
    body.querySelectorAll('[data-keyai-sender-save]').forEach(button=>button.addEventListener('click',()=>saveSenderAssignment(button.dataset.keyaiSenderSave,button)));
  }
  async function loadSenders(){
    if(!canAccess())return;
    const c=client(),body=el('keyAiSenderRows');if(!c||!body)return;
    body.innerHTML='<tr><td colspan="7" class="muted">Loading Telegram senders…</td></tr>';
    try{
      const result=await c.rpc('keysuite_v41205_list_keybot_senders',{p_company_id:companyId()});
      if(result.error)throw result.error;
      senderItems=Array.isArray(result.data)?result.data:[];
      renderSenders();
      const noticeBox=el('keyAiSenderNotice');
      if(noticeBox){
        noticeBox.textContent=canSenderAssign()
          ?'Sender mode controls automation: Nothing = record only; Curve Only = curve links only; Curve & Price = full KeyBot quotation workflow. Curve & Price requires an assigned company with a pricing category.'
          :'View only. Your role does not have KeyBot Sender / Company assignment authority.';
        noticeBox.className='notice active-customer';
      }
    }catch(error){
      console.error(error);senderItems=[];
      body.innerHTML='<tr><td colspan="7" class="muted">Sender / Company assignment is unavailable.</td></tr>';
      const noticeBox=el('keyAiSenderNotice');
      if(noticeBox){noticeBox.textContent=`Run V41205_KEYBOT_SENDER_MODE.sql in the KeySuite Supabase project before using Sender / Company assignment. ${errorText(error)}`;noticeBox.className='notice'}
    }
  }
  async function saveSenderAssignment(senderId,button){
    if(!canAccess())return;
    if(!canSenderAssign()){
      const noticeBox=el('keyAiSenderNotice');if(noticeBox){noticeBox.textContent='Your role does not have KeyBot Sender / Company assignment authority.';noticeBox.className='notice'}return;
    }
    const c=client();if(!c)return;
    const id=CSS.escape(String(senderId||''));
    const select=document.querySelector(`[data-keyai-sender-select="${id}"]`);
    const modeSelect=document.querySelector(`[data-keyai-sender-mode="${id}"]`);
    if(!select||!modeSelect)return;
    const mode=String(modeSelect.value||'nothing');
    if(mode==='curve_price'&&!String(select.value||'')){
      const noticeBox=el('keyAiSenderNotice');if(noticeBox){noticeBox.textContent='Curve & Price requires an assigned company.';noticeBox.className='notice'}return;
    }
    if(button){button.disabled=true;button.textContent='Saving…'}
    try{
      const result=await c.rpc('keysuite_v41205_assign_keybot_sender',{
        p_company_id:companyId(),p_sender_id:String(senderId||''),p_customer_id:String(select.value||''),p_response_mode:mode
      });
      if(result.error)throw result.error;
      await loadSenders();
    }catch(error){
      const noticeBox=el('keyAiSenderNotice');if(noticeBox){noticeBox.textContent=errorText(error);noticeBox.className='notice'}
    }finally{if(button){button.disabled=false;button.textContent='Save'}}
  }
  function setInboxFilter(value){inboxFilter=value;renderInbox()}
  function setInboxExpanded(open){document.querySelectorAll('#keyAiInbox details.keyai-enquiry').forEach(node=>{node.open=!!open})}
  function persistentStatus(r){
    if(!r.openai_enabled)return {text:'OpenAI is OFF',state:'off'};
    if(r.last_test_ok===true&&r.last_test_at)return {text:`Connected · ${r.last_test_model||r.openai_model} · tested ${formatTime(r.last_test_at)}`,state:'ok'};
    if(r.last_usage_at)return {text:`Active · ${r.openai_model} · last API use ${formatTime(r.last_usage_at)}`,state:'ok'};
    if(r.last_test_ok===false&&r.last_test_at)return {text:`Last test failed · ${formatTime(r.last_test_at)}`,state:'error'};
    return {text:'Enabled · connection not tested',state:''};
  }
  async function load(){
    if(!canAccess())return;const c=client();if(!c){notice('Secure connection is not available.');return}
    notice('Loading KeyBot settings…');
    try{
      const data=await bridge('get_settings');const r=row(data.settings);
      const toggleAllowed=canOpenAiControl()||data?.permissions?.openai_control===true;
      el('keyAiOpenAiEnabled').checked=!!r.openai_enabled;el('keyAiOpenAiEnabled').disabled=!toggleAllowed;el('keyAiOpenAiModel').value=r.openai_model||'gpt-5-mini';el('keyAiMonthlyLimit').value=Number(r.monthly_request_limit??500);
      const authorityNote=el('keyAiOpenAiAuthorityNote');if(authorityNote)authorityNote.textContent=toggleAllowed?'You have authority to turn OpenAI ON / OFF.':'View/edit access granted, but your role cannot turn OpenAI ON / OFF.';
      el('keyAiUsageRequests').textContent=number(r.requests);el('keyAiUsageInputTokens').textContent=number(r.input_tokens);el('keyAiUsageOutputTokens').textContent=number(r.output_tokens);if(el('keyAiUsageCost'))el('keyAiUsageCost').textContent=moneyUsd(r.estimated_cost_usd);
      if(el('keyAiLastActivity'))el('keyAiLastActivity').textContent=r.last_keybot_activity_at?formatTime(r.last_keybot_activity_at):'—';
      if(el('keyAiLastOpenAiCall'))el('keyAiLastOpenAiCall').textContent=r.last_usage_at?formatTime(r.last_usage_at):'—';
      const s=persistentStatus(r);status(s.text,s.state);
      const tg=r.telegram_connected?'Telegram connected to KeySuite.':(r.telegram_configured?'Telegram webhook needs reconnection.':'Telegram bot secrets are not configured in KeySuite.');
      const migration=data?.migration||{};
      const mig=migration.imported?(migration.already?' Legacy history already unified.':` Legacy history imported${Number(migration.enquiries||0)?` (${Number(migration.enquiries)} Telegram messages)`:''}.`):(migration.error?` Legacy history import needs attention: ${migration.error}`:(migration.reason?` ${migration.reason}`:''));
      notice(`${r.openai_enabled?'OpenAI is enabled.':'OpenAI is OFF.'} ${tg}${mig}`,migration.error?'info':'ok');
      await Promise.all([loadSenders(),loadInbox()]);
    }catch(error){console.error(error);notice(`KeyBot settings are unavailable. ${errorText(error)}`);status('Settings unavailable','error')}
  }
  async function save(){
    if(!canAccess())return;const c=client();if(!c)return;const button=el('saveKeyAiSettings');if(button){button.disabled=true;button.textContent='Saving…'}
    try{
      const model=String(el('keyAiOpenAiModel').value||'').trim();if(!model)throw new Error('OpenAI Model is required.');const limit=Math.max(0,Math.floor(Number(el('keyAiMonthlyLimit').value||0)));
      const requested=!!el('keyAiOpenAiEnabled').checked;
      const saved=await bridge('save_settings',{enabled:requested,model,monthly_request_limit:limit});
      if(!!saved?.settings?.openai_enabled!==requested)throw new Error('KeyBot ON/OFF verification failed.');
      notice(`KeyBot is ${requested?'ON':'OFF'} in KeySuite.${saved?.settings?.telegram_connected?' Telegram is connected to KeySuite.':saved?.settings?.telegram_error?' Telegram: '+saved.settings.telegram_error:''}`,'ok');await load();
    }catch(error){notice(errorText(error));status('Save failed','error')}finally{if(button){button.disabled=false;button.textContent='Save Settings'}}
  }
  async function test(){
    if(!canAccess())return;if(!el('keyAiOpenAiEnabled').checked){notice(canOpenAiControl()?'Turn OpenAI ON and save the setting before testing.':'OpenAI is OFF. A user with “KeyBot OpenAI ON / OFF” authority must turn it ON before testing.');status('OpenAI is OFF','off');return}
    const c=client();if(!c)return;const button=el('testKeyAiConnection');if(button){button.disabled=true;button.textContent='Testing…'}status('Testing connection…');
    try{
      const data=await bridge('test_openai');if(!data.ok)throw new Error(data.error||'OpenAI connection test failed.');
      notice('OpenAI connection successful. The successful test is now saved server-side.','ok');await load();
    }catch(error){console.error(error);status('Connection failed','error');notice(`OpenAI connection failed. Check the Edge Function and OPENAI_API_KEY secret. ${errorText(error)}`)}finally{if(button){button.disabled=false;button.textContent='Test Connection'}}
  }
  async function refreshInboxAndUsage(){const button=el('refreshKeyAiInbox');if(button){button.disabled=true;button.textContent='Refreshing…'}try{await load()}finally{if(button){button.disabled=false;button.textContent='Refresh Inbox'}}}
  async function refreshSenders(){const button=el('refreshKeyAiSenders');if(button){button.disabled=true;button.textContent='Refreshing…'}try{await loadSenders()}finally{if(button){button.disabled=false;button.textContent='Refresh Senders'}}}
  function bind(){if(bound)return;bound=true;el('saveKeyAiSettings')?.addEventListener('click',save);el('testKeyAiConnection')?.addEventListener('click',test);el('refreshKeyAiInbox')?.addEventListener('click',refreshInboxAndUsage);el('expandKeyAiInbox')?.addEventListener('click',()=>setInboxExpanded(true));el('collapseKeyAiInbox')?.addEventListener('click',()=>setInboxExpanded(false));el('refreshKeyAiSenders')?.addEventListener('click',refreshSenders);el('keyAiSenderSearch')?.addEventListener('input',renderSenders);el('keyAiInboxSearch')?.addEventListener('input',renderInbox);el('keyAiFilterAll')?.addEventListener('click',()=>setInboxFilter('all'));el('keyAiFilterReady')?.addEventListener('click',()=>setInboxFilter('ready'));el('keyAiFilterWaiting')?.addEventListener('click',()=>setInboxFilter('waiting'));el('keyAiFilterAttention')?.addEventListener('click',()=>setInboxFilter('attention'));window.addEventListener('keysuite-customers-changed',()=>{if(canAccess()&&el('keyAiSettings')?.classList.contains('active'))renderSenders()})}
  function init(nextAccess){access=nextAccess||window.KEYSUITE_ACCESS||{};bind();if(inboxPollTimer)clearInterval(inboxPollTimer);if(canAccess())inboxPollTimer=setInterval(()=>{if(el('keyAiSettings')?.classList.contains('active')&&!document.hidden)loadInbox(true)},15000);if(canAccess()&&el('keyAiSettings')?.classList.contains('active'))load()}
  function pageShown(id){if(id==='keyAiSettings'&&canAccess())load()}
  window.KeySuiteKeyAI={init,pageShown,load,loadInbox,loadSenders};
})();
