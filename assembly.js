(() => {
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let type='system',drafts=[],current=null,loaded=false,autoSaveTimer=null,saveQueue=Promise.resolve(),currentPinned=false,couplingMutationDepth=0,couplingRenderQueued=false,couplingOperationSeq=0;
const dirtyDraftIds=new Set(),autoSaveRetries=new Map();
const sections={system:['pumpset','control_panel','manifold','tank'],pumpset:['pump','motor','coupling','baseplate']};
const labels={pumpset:'Pumpset',control_panel:'Control Panel',manifold:'Manifold',tank:'Tank',pump:'Pump',motor:'Motor',coupling:'Coupling',baseplate:'Baseplate'};
const CAPACITY_UNITS=['m³/hr','L/s','L/min','US GPM','Imp GPM'],HEAD_UNITS=['Mtr','ft','bar','kPa','psi'];
const ES_DEFAULT_SEAL='Carbon Ceramic (Ca Ce)',ES_DEFAULT_ELASTOMER='Viton';
function normalizeEsSeal(value){const raw=String(value||'').trim();if(!raw||/^Carbon\s*Ceramic(?:\s*\(Ca\s*Ce\))?$/i.test(raw)||/^Car\s*\/\s*Cer$/i.test(raw))return ES_DEFAULT_SEAL;if(/^Silicon\s*Carbide(?:\s*\(Sic\s*Sic\))?$/i.test(raw))return 'Silicon Carbide';if(/^Tungsten(?:\s*\(Tuc\s*Tuc\))?$/i.test(raw))return 'Tungsten';return raw}
const key=()=>`ks_v201_assembly_${window.KEYSUITE_PROFILE?.company_id||'company'}`;
const uid=()=>crypto.randomUUID?.()||`asm-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const customers=()=>window.KeySuiteApp?.getCustomers?.()||[];
const keyplcProducts=()=>window.KEYSUITE_SECURE_DATA?.keyplcProducts||[];
function quoteCustomerId(){return window.KeySuiteApp?.getPricingCustomerId?.()||''}
function quoteSessionId(){return window.KeySuiteApp?.getQuotationSessionId?.()||'quotation-session'}
function blank(t=type){return {id:uid(),assembly_type:t,model_item:'',description:'',description_manual:false,name:t==='system'?'New System':'New Pumpset',customer_id:quoteCustomerId(),quote_session_id:quoteSessionId(),status:'draft',quote_qty:1,quote_unit_price:null,quote_price_manual:false,display_capacity:false,capacity_value:'',capacity_unit:'m³/hr',head_value:'',head_unit:'Mtr',coupling_mode:'flexible',coupling_error:'',auto_suppressed:{manifold:false,tank:false,coupling:false},items:[],created_at:new Date().toISOString(),updated_at:new Date().toISOString()}}
function sourceObject(item){const raw=item?.pricingSource;if(!raw)return {};if(typeof raw==='object')return raw;try{return JSON.parse(raw)}catch(_){return {}}}
function assemblyMarginReason(items=[]){for(const item of items||[]){const reason=window.KeySuitePricing?.pricingSourceMarginBlockReason?.(item?.pricingSource||item||{});if(reason)return `${reason}${item?.model||item?.bomDescription?`\n\nItem: ${item.model||item.bomDescription}`:''}`}return ''}
function blockAssemblyMargin(items=[]){const reason=assemblyMarginReason(items);if(!reason)return false;alert(reason);return true}
function quoteMetaFromItems(items=[]){for(const item of items||[]){const meta=sourceObject(item).assembly_quote;if(meta&&typeof meta==='object')return meta}return null}
function quoteMeta(d){return {qty:Math.max(.01,Number(d?.quote_qty||1)),unitPrice:Number.isFinite(Number(d?.quote_unit_price))?Math.max(0,Number(d.quote_unit_price)):null,manual:!!d?.quote_price_manual,descriptionManual:!!d?.description_manual,displayCapacity:!!d?.display_capacity,capacityValue:String(d?.capacity_value||''),capacityUnit:String(d?.capacity_unit||'m³/hr'),headValue:String(d?.head_value||''),headUnit:String(d?.head_unit||'Mtr'),couplingMode:String(d?.coupling_mode||'flexible'),couplingError:String(d?.coupling_error||''),autoSuppressed:{manifold:!!d?.auto_suppressed?.manifold,tank:!!d?.auto_suppressed?.tank,coupling:!!d?.auto_suppressed?.coupling}}}
function defaultSection(t,item){if(t==='pumpset')return item?.section||'pump';return item?.section||'unsupported'}
function normalizePanelType(value){return /^shelter/i.test(String(value||''))?'sheltered':'indoor'}
function panelTypeLabel(value){return normalizePanelType(value)==='sheltered'?'Sheltered':'Indoor Type'}
function normalizeDescriptionIndentation(value){
 const lines=String(value||'').replace(/\r\n?/g,'\n').split('\n');
 return lines.map(line=>{
   if(/^c\/w(?:\t+| +)/i.test(line))return `c/w\t${line.replace(/^c\/w(?:\t+| +)/i,'')}`;
   if(/^(?:\t+| {4,})/.test(line))return `\t\t${line.replace(/^(?:\t+| +)/,'')}`;
   return line;
 }).join('\n');
}
function normalizeItem(item={},assemblyType=type){
 const source=sourceObject(item),normalized={...item,description:normalizeDescriptionIndentation(item.description),pricingSource:source,section:item.section||defaultSection(assemblyType,item)};
 if(assemblyType==='system'&&normalized.section==='pumpset'){normalized.autoQty=Math.max(.01,Number(normalized.autoQty??2)||2);if(normalized.bomManual==null)normalized.bomManual=Math.abs(Number(normalized.qty??normalized.autoQty)-normalized.autoQty)>1e-9}
 if(!normalized.keyplcData&&String(source.product_family||'').toUpperCase()==='KEYPLC'){
   const product=keyplcProducts().find(x=>String(x.id)===String(source.product_id))||{};
   const pumpQty=Math.max(1,Number(String(source.variant||source.material||'1').replace(/\D/g,''))||1);
   normalized.keyplcData={productId:source.product_id||product.id||'',motorRating:product.model||String(normalized.model||'').match(/KeyPLC\s+([^·]+)/i)?.[1]?.trim()||'',pumpQty,enclosure:normalizePanelType(source.panel_type),indoorUnitPrice:Math.max(0,Number(normalized.unitPrice||0)-Number(source.enclosure_surcharge||0)),shelteredSurcharge:1000,autoSized:!!source.auto_sized_panel};
 }
 if(normalized.keyplcData)normalized.keyplcData={shelteredSurcharge:1000,enclosure:'indoor',...normalized.keyplcData};
 if(!normalized.motorData&&String(source.product_family||'').toUpperCase()==='MOTOR'){
   const product=(window.KEYSUITE_SECURE_DATA?.motorProducts||[]).find(row=>String(row.id)===String(source.product_id))||{};
   normalized.motorData={productId:source.product_id||product.id||'',model:product.model||normalized.model||'',efficiencyClass:product.efficiencyClass||'IE3',hp:Number(product.hp||0),pole:Number(product.pole||2)};
 }
 if(normalized.motorData){
   normalized.motorData={...normalized.motorData,defaultHp:Number(normalized.motorData.defaultHp??normalized.motorData.hp??0),defaultPole:Number(normalized.motorData.defaultPole??normalized.motorData.pole??2),defaultEfficiencyClass:String(normalized.motorData.defaultEfficiencyClass??normalized.motorData.efficiencyClass??'IE3')};
 }
 if(!normalized.couplingData&&String(source.product_family||'').toUpperCase()==='COUPLING')normalized.couplingData={...(source.configuration||{}),model:source.configuration?.model||normalized.model||''};
 if(!normalized.baseplateData&&String(source.product_family||'').toUpperCase()==='BASEPLATE')normalized.baseplateData={...(source.configuration||{}),autoSized:!!source.auto_sized_baseplate};
 return normalized;
}
function normalize(input){
 const original=input||{},assemblyType=original.assembly_type||type;
 const allowed=sections[assemblyType]||[],items=(original.items||[]).map(x=>normalizeItem(x,assemblyType)).filter(item=>allowed.includes(item.section));
 const meta=quoteMetaFromItems(items),d={...blank(assemblyType),...original,items,description_manual:original.description_manual==null?!!meta?.descriptionManual:!!original.description_manual,auto_suppressed:{manifold:false,tank:false,coupling:false,...(meta?.autoSuppressed||{}),...(original.auto_suppressed||{})}};
 d.quote_qty=Math.max(.01,Number(original.quote_qty??meta?.qty??1)||1);d.quote_price_manual=original.quote_price_manual==null?!!meta?.manual:!!original.quote_price_manual;d.coupling_mode=String(original.coupling_mode||meta?.couplingMode||(items.find(item=>item.section==='coupling')?.couplingData?.selectionMode)||'flexible');d.coupling_error=String(original.coupling_error??meta?.couplingError??'');
 const storedPrice=original.quote_unit_price??meta?.unitPrice;d.quote_unit_price=storedPrice==null?null:Math.max(0,Number(storedPrice)||0);const parsedCapacity=parseCapacityDescription(original.description||'');d.display_capacity=!!(original.display_capacity??meta?.displayCapacity??parsedCapacity?.display_capacity??false);d.capacity_value=String(original.capacity_value??meta?.capacityValue??parsedCapacity?.capacity_value??'');d.capacity_unit=normalizeCapacityUnit(original.capacity_unit??meta?.capacityUnit??parsedCapacity?.capacity_unit);d.head_value=String(original.head_value??meta?.headValue??parsedCapacity?.head_value??'');d.head_unit=normalizeHeadUnit(original.head_unit??meta?.headUnit??parsedCapacity?.head_unit);d.quote_session_id=original.quote_session_id||`legacy:${d.id}`;return d
}
function localLoad(){try{return (JSON.parse(localStorage.getItem(key())||'[]')||[]).map(normalize)}catch(_){return []}}
function localSave(){localStorage.setItem(key(),JSON.stringify(drafts))}
function total(d=current){return (d?.items||[]).reduce((n,x)=>n+Number(x.qty||0)*Number(x.unitPrice||0),0)}
function quoteUnitPrice(d=current){const value=Number(d?.quote_unit_price);return d?.quote_price_manual&&Number.isFinite(value)?Math.max(0,value):total(d)}
function syncQuoteUnitPrice(d=current){if(!d)return;if(!d.quote_price_manual)d.quote_unit_price=total(d)}
function sourceCostAvailable(item){
 const source=sourceObject(item),currency=String(source.source_currency||source.currency||'').toUpperCase(),sourcePrice=Number(source.source_price??source.sourcePrice??0);
 // V4.04.21: the BOM item already carries the selected source-cost snapshot. Trust it first.
 // A positive USD/RMB/MYR source price is sufficient; calculated/selling price alone is never sufficient.
 if(['USD','RMB','MYR'].includes(currency)&&sourcePrice>0)return true;
 // Baseplate is a calculated MYR raw cost and is stored explicitly in the pricing snapshot.
 if(Number(source.raw_cost_myr??source.rawCostMyr??0)>0)return true;
 // Support explicit per-currency snapshots/imports when present without relying on a second product lookup.
 const books=[source.pricesByCurrency,source.prices_by_currency,source.source_costs,source.sourceCosts].filter(v=>v&&typeof v==='object');
 for(const book of books){for(const cur of ['USD','RMB','MYR']){const value=book[cur];if(Number(value)>0)return true;if(value&&typeof value==='object'&&Object.values(value).some(v=>Number(v)>0))return true}}
 // Legacy items may not yet carry a complete snapshot. Reprice only as a compatibility fallback.
 const pricing=window.KeySuitePricing;if(!pricing?.repriceSource)return false;
 const found=pricing.repriceSource(source,'quotation');if(!found?.calc)return false;
 const candidates=Array.isArray(found.calc.candidates)?found.calc.candidates:[];
 return candidates.some(row=>Number(row?.sourcePrice)>0)||Number(found.calc.sourcePrice)>0;
}
function missingPumpsetSourceCosts(items=[]){
 const required=['pump','motor','coupling','baseplate'],missing=[];
 for(const section of required){const item=(items||[]).find(entry=>entry?.section===section);if(!item||!sourceCostAvailable(item))missing.push(labels[section]||section)}
 return missing;
}
function blockMissingPumpsetSourceCosts(items=[]){
 const missing=missingPumpsetSourceCosts(items);if(!missing.length)return false;
 alert(`Cannot add to Quotation. No positive USD, RMB or MYR source cost is available for: ${missing.join(', ')}.\n\nPlease enter a source cost before adding this Pumpset to Quotation.`);return true;
}
function money(n){return `RM ${Number(n||0).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})}`}
function normalizeCapacityUnit(value){const raw=String(value||'m³/hr').trim();if(/^m(?:³|3)\/(?:h|hr)$/i.test(raw)||/^m3h$/i.test(raw))return 'm³/hr';if(/^l\/s$/i.test(raw)||/^lps$/i.test(raw))return 'L/s';if(/^l\/(?:m|min)$/i.test(raw)||/^lpm$/i.test(raw))return 'L/min';if(/^(?:gpm|us\s*gpm|usgpm)$/i.test(raw))return 'US GPM';if(/^(?:imp(?:erial)?\s*gpm|igpm)$/i.test(raw))return 'Imp GPM';return CAPACITY_UNITS.find(unit=>unit.toLowerCase()===raw.toLowerCase())||'m³/hr'}
function normalizeHeadUnit(value){const raw=String(value||'Mtr').trim();if(/^(?:m|metre|meter|mtr)$/i.test(raw))return 'Mtr';if(/^ft$/i.test(raw))return 'ft';if(/^bar$/i.test(raw))return 'bar';if(/^kpa$/i.test(raw))return 'kPa';if(/^psi$/i.test(raw))return 'psi';return HEAD_UNITS.find(unit=>unit.toLowerCase()===raw.toLowerCase())||'Mtr'}
function capacityOptions(values,selected){return values.map(value=>{const label=value==='ft'?'Ft':value==='Imp GPM'?'IGPM':value;return `<option value="${esc(value)}" ${String(selected)===value?'selected':''}>${esc(label)}</option>`}).join('')}
function capacityNumber(value,decimals=1){const number=Number(value);if(!Number.isFinite(number))return String(value??'').trim();return number.toFixed(decimals).replace(/\.?0+$/,'')}
function flowM3h(value,unit){const number=Number(value),normalized=normalizeCapacityUnit(unit);if(!Number.isFinite(number))return null;if(normalized==='L/s')return number*3.6;if(normalized==='L/min')return number*.06;if(normalized==='US GPM')return number*.227124707;if(normalized==='Imp GPM')return number*.2727654;return number}
function headMtr(value,unit){const number=Number(value),normalized=normalizeHeadUnit(unit);if(!Number.isFinite(number))return null;if(normalized==='ft')return number*.3048;if(normalized==='bar')return number*10.19716213;if(normalized==='kPa')return number/9.80665;if(normalized==='psi')return number*.70306958;return number}
function capacityFlowLabel(unit){const normalized=normalizeCapacityUnit(unit);return normalized==='Imp GPM'?'IGPM':normalized}
function capacityHeadLabel(unit){const normalized=normalizeHeadUnit(unit);return normalized==='ft'?'Ft':normalized}
function parseCapacityDescription(value){const line=String(value||'').replace(/\r\n?/g,'\n').split('\n').find(row=>/^Capacity:/i.test(row.trim()));if(!line)return null;const match=line.trim().match(/^Capacity:\s*([0-9]+(?:\.[0-9]+)?)\s*(L\/s|m³\/(?:h|hr)|m3\/(?:h|hr)|L\/(?:m|min)|US\s*GPM|Imp(?:erial)?\s*GPM|IGPM|GPM)(?:\s*\([^)]*\))?\s*@\s*([0-9]+(?:\.[0-9]+)?)\s*(Mtr|m|ft|bar|kPa|psi)(?:\s*\([^)]*\))?\s*$/i);return match?{display_capacity:true,capacity_value:match[1],capacity_unit:normalizeCapacityUnit(match[2]),head_value:match[3],head_unit:normalizeHeadUnit(match[4])}:null}
function stripCapacityDescription(value){return String(value||'').replace(/\r\n?/g,'\n').split('\n').filter(row=>!/^Capacity:/i.test(row.trim())).join('\n').replace(/^\n+|\n+$/g,'')}
function assemblyCapacityLine(d=current){const capacity=String(d?.capacity_value||'').trim(),head=String(d?.head_value||'').trim();if(!d?.display_capacity||!capacity||!head)return '';const flowUnit=normalizeCapacityUnit(d.capacity_unit),headUnit=normalizeHeadUnit(d.head_unit),flowText=`${capacityNumber(capacity,2)} ${capacityFlowLabel(flowUnit)}`,headText=`${capacityNumber(head,2)} ${capacityHeadLabel(headUnit)}`,metricFlow=flowUnit==='m³/hr'?'':` (${capacityNumber(flowM3h(capacity,flowUnit),1)} m³/hr)`,metricHead=headUnit==='Mtr'?'':` (${capacityNumber(headMtr(head,headUnit),1)} Mtr)`;return `Capacity: ${flowText}${metricFlow} @ ${headText}${metricHead}`}
function applyAssemblyCapacity(value,d=current){return [assemblyCapacityLine(d),stripCapacityDescription(value)].filter(Boolean).join('\n')}
function copyCapacity(target,source={}){if(!target)return;target.display_capacity=!!(source.display_capacity??source.displayCapacity);target.capacity_value=String(source.capacity_value??source.capacityValue??'');target.capacity_unit=normalizeCapacityUnit(source.capacity_unit??source.capacityUnit);target.head_value=String(source.head_value??source.headValue??'');target.head_unit=normalizeHeadUnit(source.head_unit??source.headUnit)}

function tankDescription(item,qty=item?.qty){
 const litres=Number(item?.tankData?.sizeLitres||0),pressure=Number(item?.tankData?.pressureBar||0),quantity=Math.max(0,Number(qty)||0);
 if(!(litres>0)||!(pressure>0))return item?.description||'';
 const clean=value=>Number.isInteger(value)?value.toFixed(0):String(value);
 return `c/w\t${clean(litres)} litres (${clean(pressure)} bar) non-jkkp approved tank @ ${clean(quantity)} ${quantity===1?'unit':'units'}`;
}
function replaceDescriptionBlock(source,previous,next){
 const text=String(source||'');if(!previous||previous===next)return text;
 const index=text.indexOf(previous);if(index<0)return text;
 return text.slice(0,index)+next+text.slice(index+previous.length);
}
function removeDescriptionBlock(source,block){
 const text=String(source||''),needle=String(block||'').trim();if(!needle)return text;
 const index=text.indexOf(needle);if(index<0)return text;
 let before=text.slice(0,index),after=text.slice(index+needle.length);
 if(after.startsWith('\n\n'))after=after.slice(2);else if(after.startsWith('\n'))after=after.slice(1);else if(before.endsWith('\n\n'))before=before.slice(0,-2);else if(before.endsWith('\n'))before=before.slice(0,-1);
 return `${before}${after}`.replace(/\n{3,}/g,'\n\n').trim();
}
function keyplcDescription(item){
 const data=item?.keyplcData||{},qty=Math.max(1,Number(data.pumpQty)||1),numberWord=qty===1?'no':'nos',indent='\t\t';
 return `c/w\tKeyPLC Control Panel (${panelTypeLabel(data.enclosure)})
${indent}Pump Controller & HMI Touch Screen @ 1 Lot
${indent}${data.motorRating||''} VFD @ ${qty} ${numberWord} & Pressure Transmitter @ 1 no
${indent}Wiring for pumps & pressure transmitter within pump skid @ 1 Lot`;
}
function orderedItems(d=current){
 const order=sections[d?.assembly_type||type]||[];return order.flatMap(section=>(d?.items||[]).filter(item=>item.section===section));
}
function pumpDescriptionParts(item){
 const lines=String(item?.description||'').replace(/\r\n?/g,'\n').split('\n').map(line=>line.trimEnd()).filter(Boolean),modelFromItem=String(item?.pumpData?.quotation_model||item?.pumpData?.model||item?.model||'').replace(/^ES\s*/i,'').trim();
 const duty=String(item?.pumpData?.quotation_duty||'').trim(),capacity=lines.find(line=>/^Capacity:/i.test(line))||(duty?`Capacity: ${duty}`:'');
 let modelLine=lines.find(line=>/^B\.G\.Reich End Suction Pump Model:/i.test(line))||`B.G.Reich End Suction Pump Model: ${modelFromItem}`;
 modelLine=modelLine.replace(/(Model:\s*)(?:ES\s*)?/i,'$1ES ');
 const suction=lines.find(line=>/^Suction\s*x\s*Discharge:/i.test(line))||'';
 const material=lines.find(line=>/^Pump Material:/i.test(line))||'';
 const extras=lines.filter(line=>line!==capacity&&line!==suction&&line!==material&&!/^B\.G\.Reich End Suction Pump Model:/i.test(line)&&!/Bare shaft pump only/i.test(line));
 return {capacity,model:modelLine,suction,material,extras};
}
function completedPumpsetDescription(d=current){
 if(!d||d.assembly_type!=='pumpset')return '';
 const pumps=(d.items||[]).filter(item=>item.section==='pump');pumps.forEach(sanitizeEsPumpDescription);const motor=(d.items||[]).find(item=>item.section==='motor'),couplings=(d.items||[]).filter(item=>item.section==='coupling'&&item.couplingData?.model),coupling=couplings.find(isAutoCouplingItem)||couplings[0];
 if(!pumps.length||!motor||!coupling)return '';
 const motorLine=normalizeDescriptionIndentation(String(motor.description||'')).split('\n').find(line=>/^c\/w(?:\t+| +)/i.test(line))||String(motor.description||'').trim();
 const couplingLine=window.KeySuiteCoupling?.assemblyDescription?.(coupling.couplingData?.selectionMode||d.coupling_mode||'flexible')||String(coupling.description||'').trim();
 return pumps.map((pump,index)=>{const part=pumpDescriptionParts(pump),lines=[part.model];if(index===0)lines.push(motorLine,couplingLine);lines.push(part.suction,part.material,...part.extras);return lines.filter(Boolean).join('\n')}).join('\n');
}
function rebuildDescription(d=current){
 if(!d)return '';
 (d.items||[]).forEach(item=>{item.description=normalizeDescriptionIndentation(item.description)});
 const completed=completedPumpsetDescription(d);
 const body=completed||orderedItems(d).map(item=>stripCapacityDescription(String(item.description||'').trimEnd())).filter(Boolean).join('\n');
 d.description=applyAssemblyCapacity(body,d);
 d.description=normalizeDescriptionIndentation(d.description);
 return d.description;
}
function highlightDescription(text){
 let html=esc(String(text||'')),marks=[];const mark=value=>{const token=`@@KS_MARK_${marks.length}@@`;marks.push(String(value));return token};
 const replacements=[
  {pattern:/((?:Pump )?Material:\s*)([^\n]+)/gi,replace:(match,prefix,value)=>`${prefix}${mark(value)}`},
  {pattern:/(c\/w\s+Baseplate with\s+)(Flexible Coupling|Pin &amp; Bush Coupling|Tyre Coupling)/gi,replace:(match,prefix,value)=>`${prefix}${mark(value)}`},
  {pattern:/(\b(?:SS|GI))(?=\s+Manifold\b)/gi,replace:match=>mark(match)},
  {pattern:/(Model:\s*)([^\n]+)/gi,replace:(match,prefix,value)=>`${prefix}${mark(value)}`},
  {pattern:/(\bIE[1-5]\b)/gi,replace:match=>mark(match)},
  {pattern:/(\b\d+(?:\.\d+)?\s*(?:HP|kW|Pole|Hz|V|Ph|bar|litres?|Lot|nos?|units?|Pumps?|Sets?)\b)/gi,replace:match=>mark(match)},
  {pattern:/(DN\s*\d+(?:\s*x\s*DN\s*\d+)?)/gi,replace:match=>mark(match)},
  {pattern:/(\d+(?:\.\d+)?&quot;\s+(?:inlet|outlet)(?:\s*&amp;\s*\d+(?:\.\d+)?&quot;\s+(?:inlet|outlet))?)/gi,replace:match=>mark(match)},
  {pattern:/(Indoor Type|Sheltered|SS304 \(Cast Iron Connection\)|SS316|Mech Seal|Gland Packing|Viton|EPDM|NBR|Carbon Ceramic \(Ca Ce\)|Silicon Carbide|Tungsten|Silicon Carbide \(Sic Sic\)|Tungsten \(Tuc Tuc\))/gi,replace:match=>mark(match)}
 ];
 replacements.forEach(item=>{html=html.replace(item.pattern,item.replace)});marks.forEach((value,index)=>{html=html.replace(`@@KS_MARK_${index}@@`,`<mark>${value}</mark>`)});return html.replace(/\n/g,'<br>');
}
function renderDescriptionPreview(){const preview=$('assemblyDescriptionPreview'),input=$('assemblyDescription'),text=normalizeDescriptionIndentation(input?.value||current?.description||'');if(input&&input.value!==text)input.value=text;if(current)current.description=text;if(preview)preview.innerHTML=highlightDescription(text)}
function pumpMotorKw(item){return Number(item?.pumpData?.motor_kw??item?.pumpData?.motorKw??item?.motor_kw??item?.motorKw??0)}
function pumpsetBom(item){const source=sourceObject(item),bom=item?.pumpsetData?.bom??source.assembly_items;return Array.isArray(bom)?bom:[]}
function expandedAssemblyItems(d=current){
 return (d?.items||[]).flatMap(item=>{
   const bom=item?.section==='pumpset'?pumpsetBom(item):[];
   if(!bom.length)return [item];
   const setQty=Math.max(.01,Number(item.qty)||1);
   return bom.map(component=>({...component,qty:Math.max(0,Number(component.qty)||0)*setQty,pumpsetParentId:item.id}));
 });
}
function pumpItems(d=current){return expandedAssemblyItems(d).filter(x=>x.section==='pump'||pumpMotorKw(x)>0).filter(x=>!x.keyplcData&&String(sourceObject(x).product_family||'').toUpperCase()!=='KEYPLC')}
function motorHp(item){
 const direct=Number(item?.motorData?.hp??sourceObject(item).motor_hp??0);if(direct>0)return direct;
 const match=String(item?.model||item?.bomDescription||'').match(/^(?:[2345]?BM)(\d+(?:\.\d+)?)-\d+$/i);return Number(match?.[1]||0);
}
function motorItems(d=current){return expandedAssemblyItems(d).filter(item=>item?.section==='motor'||item?.motorData||String(sourceObject(item).product_family||'').toUpperCase()==='MOTOR').filter(item=>motorHp(item)>0)}
function totalPumpQty(d=current){return pumpItems(d).reduce((sum,item)=>sum+Math.max(0,Number(item.qty)||0),0)}
function automaticPanelSizing(d=current){
 const motors=motorItems(d);
 if(motors.length){return {qty:Math.round(motors.reduce((sum,item)=>sum+Math.max(0,Number(item.qty)||0),0)),requiredKw:Math.max(0,...motors.map(item=>motorHp(item)*.746)),source:'motor'}}
 const pumps=pumpItems(d);return {qty:Math.round(pumps.reduce((sum,item)=>sum+Math.max(0,Number(item.qty)||0),0)),requiredKw:Math.max(0,...pumps.map(pumpMotorKw)),source:'pump'};
}
function systemModelPumpQty(d=current){
 const pumps=pumpItems(d);if(!pumps.length)return 0;
 const quantities=pumps.map(item=>Math.max(1,Number(item.qty)||1));
 if(quantities.length===1)return quantities[0];
 return quantities.some(qty=>qty>1)?Math.max(...quantities):quantities.reduce((sum,qty)=>sum+qty,0);
}
function updateModelSuggestions(){
 const list=$('assemblyModelItemOptions');if(!list)return;const applications=window.KeySuiteApplications?.values||[],help=$('assemblyModelItemHelp');let suggestions=[];
 if(type==='pumpset'){suggestions=applications;if(help)help.textContent='Select an application suggestion or type a custom Pumpset Model / Item.'}
 else{const count=Math.max(1,systemModelPumpQty(current)||1),suffix=`${count}Pump${count===1?'':'s'} System`;suggestions=[`KeyPLC VSD Booster System (${suffix})`,`KeyPLC VSD Transfer System (${suffix})`];if(help)help.textContent='System suggestions follow the pump quantity in the BOM; custom text is allowed.';const input=$('assemblyModelItem'),value=String(input?.value||current?.model_item||'');if(/^(KeyPLC VSD (?:Booster|Transfer) System) \(\d+Pumps? System\)$/i.test(value)){const base=value.match(/^(KeyPLC VSD (?:Booster|Transfer) System)/i)?.[1]||'';const next=`${base} (${suffix})`;if(input)input.value=next;if(current)current.model_item=next}}
 list.innerHTML=(window.KeySuiteApplications?.unique?.(suggestions)||suggestions).map(value=>`<option value="${esc(value)}"></option>`).join('');
}
function appendCompactDescription(d,description){const existing=String(d.description||'').replace(/\s+$/,'');d.description=existing?`${existing}\n${description}`:description}
function removeAutoPanel(d){
 const panels=(d.items||[]).filter(item=>item.keyplcData?.autoSized||sourceObject(item).auto_sized_panel);
 panels.forEach(panel=>{d.description=removeDescriptionBlock(d.description,panel.description)});
 d.items=(d.items||[]).filter(item=>!panels.includes(item));
}
function nearestKeyplcProduct(requiredKw){return keyplcProducts().filter(p=>Number(p.motorKw||String(p.model||'').replace(/[^0-9.]/g,''))>=requiredKw-1e-9).sort((a,b)=>Number(a.motorKw||0)-Number(b.motorKw||0))[0]||null}
function syncAutomaticControlPanel(d=current){
 if(!d||d.assembly_type!=='system')return;
 const sizing=automaticPanelSizing(d),qty=sizing.qty,requiredKw=sizing.requiredKw;
 if(qty<1||requiredKw<=0){removeAutoPanel(d);syncQuoteUnitPrice(d);return}
 let panel=(d.items||[]).find(item=>item.keyplcData?.autoSized||sourceObject(item).auto_sized_panel);
 const manualProduct=panel?.keyplcData?.manualSize?keyplcProducts().find(item=>String(item.id)===String(panel.keyplcData.productId)):null;
 const product=manualProduct||nearestKeyplcProduct(requiredKw);if(!product)return;
 const priceQty=Math.max(1,Math.min(6,qty));
 const previous=panel?.description||'',existingEnclosure=normalizePanelType(panel?.keyplcData?.enclosure||sourceObject(panel).panel_type||'indoor');
 const found=window.KeySuitePricing?.findKeyplcPrice?.(product.id,priceQty,{enclosure:existingEnclosure,pricingMode:'assembly'});
 const indoorPrice=Number(found?.calc?.indoorPrice??Math.max(0,Number(panel?.unitPrice||0)-(existingEnclosure==='sheltered'?1000:0)));
 const surcharge=existingEnclosure==='sheltered'?1000:0;
 const data={productId:product.id,motorRating:product.model,pumpQty:qty,enclosure:existingEnclosure,indoorUnitPrice:indoorPrice,shelteredSurcharge:1000,autoSized:true,manualSize:!!manualProduct,manualOverride:!!panel?.keyplcData?.manualOverride};
 const model=`KeyPLC ${product.model} · ${qty} ${qty===1?'Pump':'Pumps'} · ${panelTypeLabel(existingEnclosure)}`;
 const pricingSource={...(panel?sourceObject(panel):{}),...(found?window.KeySuitePricing?.sourceSnapshot?.(found)||{}:{}),product_family:'KEYPLC',product_id:product.id,variant:`P${priceQty}`,material:`P${priceQty}`,pricing_mode:'assembly',panel_type:existingEnclosure,enclosure_surcharge:surcharge,calculated_price:Number(found?.calc?.finalPrice??indoorPrice+surcharge),auto_sized_panel:true};
 if(!panel){panel={id:uid(),section:'control_panel',model,bomDescription:model,description:'',qty:1,unitPrice:Number(found?.calc?.finalPrice??indoorPrice+surcharge),pricingSource,pumpData:null,keyplcData:data};d.items.push(panel)}
 else{panel.section='control_panel';panel.model=model;panel.bomDescription=model;panel.qty=1;panel.unitPrice=Number(found?.calc?.finalPrice??indoorPrice+surcharge);panel.pricingSource=pricingSource;panel.keyplcData=data}
 panel.description=keyplcDescription(panel);
 if(previous)d.description=replaceDescriptionBlock(d.description,previous,panel.description);else appendCompactDescription(d,panel.description);
 const duplicates=(d.items||[]).filter(item=>item!==panel&&(item.keyplcData?.autoSized||sourceObject(item).auto_sized_panel));
 duplicates.forEach(item=>{d.description=removeDescriptionBlock(d.description,item.description)});d.items=d.items.filter(item=>!duplicates.includes(item));
 syncQuoteUnitPrice(d);
}
function pumpSeriesNumber(item){
 const p=item?.pumpData||{},text=String(p.series||p.quotation_model||p.model||item?.model||'');return Number((text.match(/CHC\s+(\d+)/i)||[])[1]||0)
}
function dnFrom(value){return Number((String(value||'').match(/DN\s*(\d+)/i)||[])[1]||0)}
const CHC_CONNECTION_DN={1:25,2:25,3:25,4:32,5:32,8:40,10:40,12:50,15:50,16:50,20:50,32:65,45:80,64:100,90:100,120:125,150:125,200:150};
function chcConnectionFallbackDn(item){const p=item?.pumpData||{},text=[p.series,p.base_model,p.quotation_model,p.model,item?.model].filter(Boolean).join(' '),match=text.match(/CHC[SN]?\s*(\d+)/i),series=Number(match?.[1]||0);return Number(CHC_CONNECTION_DN[series]||0)}
function pumpConnectionSides(item){
 const p=item?.pumpData||{},explicitS=dnFrom(p.suction_dn||p.suction||p.dimensions?.suction),explicitD=dnFrom(p.discharge_dn||p.discharge||p.dimensions?.discharge);let suction=explicitS,discharge=explicitD;
 const connection=String(p.connection||p.suctionDischarge||'');const pair=[...connection.matchAll(/DN\s*(\d+)/gi)].map(match=>Number(match[1])||0).filter(Boolean);if(!suction&&pair.length)suction=pair[0];if(!discharge&&pair.length>1)discharge=pair[1];
 const text=String(item?.description||'');const labelled=text.match(/Suction(?:\s*x\s*Discharge)?[^\n]*DN\s*(\d+)[^\n]*DN\s*(\d+)/i);if(labelled){if(!suction)suction=Number(labelled[1])||0;if(!discharge)discharge=Number(labelled[2])||0}
 const all=[...([p.connection,p.suction_dn,p.discharge_dn,p.suction,p.discharge,p.suctionDischarge,item?.description,item?.model].filter(Boolean).join(' ')).matchAll(/DN\s*(\d+)/gi)].map(match=>Number(match[1])||0).filter(Boolean),fallback=all.length?Math.max(...all):chcConnectionFallbackDn(item);if(!suction)suction=fallback;if(!discharge)discharge=fallback;return {suction,discharge,max:Math.max(suction||0,discharge||0)}
}
function pumpConnectionDn(item){return pumpConnectionSides(item).max}
function pumpShutoffHead(item){
 const p=item?.pumpData||{},direct=Number(p.shutoff_head_m??p.zero_flow_head_m??p.shutoffHead??p.zeroFlowHead);if(Number.isFinite(direct)&&direct>0)return direct;
 const model=p.export_state?.models?.[0]||p.exportState?.models?.[0]||{},fit=model.headFit||model.head_fit||p.headFit||p.head_fit||{};
 if(Array.isArray(fit.c)&&fit.c.length&&Number.isFinite(Number(fit.c[0]))&&Number(fit.c[0])>0)return Number(fit.c[0]);
 const points=Array.isArray(fit.pts)?fit.pts:[];if(points.length){const first=[...points].sort((a,b)=>Number(a.x||0)-Number(b.x||0))[0],head=Number(first?.y);if(Number.isFinite(head)&&head>0)return head}
 return null
}
function systemShutoffHead(d=current){const heads=pumpItems(d).map(pumpShutoffHead).filter(value=>Number.isFinite(value)&&value>0);return heads.length?Math.max(...heads):null}
function autoComponent(item,kind){const source=sourceObject(item);return kind==='manifold'?!!(item?.manifoldData?.autoSelected||source.auto_sized_manifold):kind==='tank'?!!(item?.tankData?.autoSelected||source.auto_sized_tank):false}
function removeAutoComponent(d,kind){const items=(d.items||[]).filter(item=>autoComponent(item,kind));items.forEach(item=>{d.description=removeDescriptionBlock(d.description,item.description)});d.items=(d.items||[]).filter(item=>!items.includes(item))}
function placeAutomaticDescription(d,previous,next){if(previous&&String(d.description||'').includes(previous))d.description=replaceDescriptionBlock(d.description,previous,next);else if(next&&!String(d.description||'').includes(next))appendCompactDescription(d,next)}
function syncAutomaticManifold(d=current){
 if(!d||d.assembly_type!=='system')return;if(d.auto_suppressed?.manifold){removeAutoComponent(d,'manifold');return}const pumps=pumpItems(d),qty=Math.round(totalPumpQty(d)),sides=pumps.map(pumpConnectionSides),suctionDn=Math.max(0,...sides.map(x=>x.suction)),dischargeDn=Math.max(0,...sides.map(x=>x.discharge)),dn=Math.max(suctionDn,dischargeDn);
 if(!pumps.length||qty<1||dn<=0||!window.KeySuiteManifold?.buildConfiguredItem){removeAutoComponent(d,'manifold');return}
 const shutoffHead=systemShutoffHead(d),connectionChoice=window.KeySuiteManifold.connectionForShutoffHead?.(shutoffHead)||{connection:'FLANGE_16',fallback:true};
 if(!connectionChoice.connection){removeAutoComponent(d,'manifold');return}
 const existing=(d.items||[]).find(x=>autoComponent(x,'manifold')),existingData=existing?.manifoldData||{},override=existingData.manualOverride?existingData:{},manifoldOptions=window.KeySuiteManifold?.normalizeOptions?.((existing?existingData.options||{}:window.KeySuiteManifold?.getGlobalOptions?.()||{}))||{};window.KeySuiteManifold?.setGlobalOptions?.(manifoldOptions,{silent:true,source:'assembly-sync'});
 const config={material:String(override.material||'GI').toUpperCase(),connection:connectionChoice.connection,suctionDn:`DN${suctionDn||dn}`,dischargeDn:`DN${dischargeDn||dn}`,headerDn:String(override.headerDn||''),pumpQty:Math.max(1,Math.min(6,qty)),tankSize:'',rarity:'common',options:manifoldOptions};
 const built=window.KeySuiteManifold.buildConfiguredItem(config,{includeCw:true,auto:true,pricingMode:'assembly'});if(!built){removeAutoComponent(d,'manifold');return}
 let item=(d.items||[]).find(x=>autoComponent(x,'manifold')),previous=item?.description||'';
 const manifoldData={...(built.manifoldData||{}),autoSelected:true,manualOverride:!!override.manualOverride,shutoffHeadM:shutoffHead,shutoffPressureBar:connectionChoice.pressureBar,fallbackConnection:!!connectionChoice.fallback};
 if(!item){item={id:uid(),section:'manifold'};d.items.push(item)}
 Object.assign(item,normalizeItem({...item,...built,section:'manifold',qty:1,manifoldData,pricingSource:{...sourceObject(built),auto_sized_manifold:true}},'system'));
 placeAutomaticDescription(d,previous,item.description);const duplicates=(d.items||[]).filter(x=>x!==item&&autoComponent(x,'manifold'));duplicates.forEach(x=>{d.description=removeDescriptionBlock(d.description,x.description)});d.items=d.items.filter(x=>!duplicates.includes(x))
}
function tankLitresForSeries(series){const value=Number(series)||0;if(value>0&&value<=10)return 24;if(value>=12&&value<=28)return 35;if(value>=32&&value<=90)return 100;if(value>=120&&value<=150)return 200;if(value===200)return 300;return 0}
function syncAutomaticTank(d=current){
 if(!d||d.assembly_type!=='system')return;if(d.auto_suppressed?.tank){removeAutoComponent(d,'tank');return}
 const pumps=pumpItems(d),autoLitres=Math.max(0,...pumps.map(item=>tankLitresForSeries(pumpSeriesNumber(item)))),head=systemShutoffHead(d),pressureBar=Number.isFinite(Number(head))?Number(head)*.0981:null;
 const existing=(d.items||[]).find(x=>autoComponent(x,'tank')),override=existing?.tankData?.manualOverride?existing.tankData:null,litres=Math.max(0,Number(override?.sizeLitres||autoLitres)||0);
 if(!pumps.length||!litres||!Number.isFinite(pressureBar)||!window.KeySuitePricing?.findAutoGwsTank){removeAutoComponent(d,'tank');return}
 const found=window.KeySuitePricing.findAutoGwsTank(litres,pressureBar,{pricingMode:'assembly'});if(!found){if(override&&existing){existing.tankData={...(existing.tankData||{}),manualOverride:true,manualUnavailable:true,autoSizeLitres:autoLitres,shutoffHeadM:head,shutoffPressureBar:pressureBar};return}removeAutoComponent(d,'tank');return}
 const built=window.KeySuitePricing.buildGwsAssemblyItem?.(found.product.id,null,{pricingMode:'assembly'});if(!built){if(override&&existing)return;removeAutoComponent(d,'tank');return}
 let item=existing,previous=item?.description||'';const tankData={...(built.tankData||{}),autoSelected:true,manualOverride:!!override,manualUnavailable:false,autoSizeLitres:autoLitres,chcSeries:pumps.map(pumpSeriesNumber).filter(Boolean),shutoffHeadM:head,shutoffPressureBar:pressureBar};
 if(!item){item={id:uid(),section:'tank'};d.items.push(item)}
 Object.assign(item,normalizeItem({...item,...built,section:'tank',qty:1,bomDescription:built.model,tankData,pricingSource:{...sourceObject(built),auto_sized_tank:true}},'system'));item.description=tankDescription(item,1);
 placeAutomaticDescription(d,previous,item.description);const duplicates=(d.items||[]).filter(x=>x!==item&&autoComponent(x,'tank'));duplicates.forEach(x=>{d.description=removeDescriptionBlock(d.description,x.description)});d.items=d.items.filter(x=>!duplicates.includes(x))
}
function bomDescriptionState(d=current){return JSON.stringify((d?.items||[]).map(item=>[item.id,item.section,item.model,Number(item.qty||0),normalizeDescriptionIndentation(item.description)]))}
function isAutoCouplingItem(item){return !!(item?.section==='coupling'&&item?.couplingData?.managedByPumpset===true)}
function isManualCouplingItem(item){return !!(item?.section==='coupling'&&!isAutoCouplingItem(item))}
function autoCouplingItems(d=current){return (d?.items||[]).filter(isAutoCouplingItem)}
function manualCouplingItems(d=current){return (d?.items||[]).filter(isManualCouplingItem)}
function couplingMode(d=current){return String(d?.coupling_mode||autoCouplingItems(d)[0]?.couplingData?.selectionMode||'flexible')}
function couplingContextSignature(context={}){return [context.pumpModel||'',Number(context.pumpShaft||0),Number(context.motorShaft||0),Math.round(Number(context.motorTorque||0)*100)/100,Number(context.motorRpm||0),Number(context.couplingQty||1)].join('|')}
function couplingSyncSignature(d,item,context){const data=item?.couplingData||{},mode=couplingMode(d),manual=!!data.manualModel;return [mode,couplingContextSignature(context),manual?data.model||item?.model||'':'',manual?data.arrangement||'':''].join('::')}
function withCouplingMutation(callback){couplingMutationDepth+=1;try{return callback()}finally{couplingMutationDepth=Math.max(0,couplingMutationDepth-1)}}
function queueCouplingRender(){if(couplingRenderQueued)return;couplingRenderQueued=true;const run=()=>{couplingRenderQueued=false;if(!current)return;renderItems();renderQuoteFields()};if(typeof requestAnimationFrame==='function')requestAnimationFrame(run);else setTimeout(run,0)}
function createCouplingPlaceholder(d,context){const mode=couplingMode(d);return normalizeItem({id:uid(),section:'coupling',model:'',bomDescription:'No suitable Coupling model',description:window.KeySuiteCoupling?.assemblyDescription?.(mode)||'',qty:Math.max(1,Number(context.couplingQty||1)),unitPrice:0,pricingSource:{product_family:'COUPLING',pricing_mode:'assembly'},couplingData:{selectionMode:mode,type:mode==='tyre'?'tyre':'pin_bush',autoSelected:true,manualModel:false,managedByPumpset:true,validationReasons:['No suitable Coupling model is available.']}},'pumpset')}
function applyCouplingConfiguration(d,item,values,context){
 const previous={...(item.couplingData||{})},managedByPumpset=previous.managedByPumpset===true,mode=String(values?.selectionMode||(managedByPumpset?d?.coupling_mode:'')||previous.selectionMode||'flexible');if(managedByPumpset)d.coupling_mode=mode;
 item.couplingData={...previous,selectionMode:mode,autoSelected:managedByPumpset,managedByPumpset,source:managedByPumpset?'auto':'manual',_assemblySyncKey:'',_assemblyErrorKey:''};
 try{
  const result=window.KeySuiteCoupling?.configureAssemblyItem?.(item,{...values,selectionMode:mode},context),signature=couplingSyncSignature(d,item,context);
  if(result?.error){
   const explicitType=mode==='tyre'?'tyre':mode==='pin_bush'?'pin_bush':previous.resolvedType||previous.type||'pin_bush';
   item.couplingData={...previous,...(item.couplingData||{}),selectionMode:mode,resolvedType:explicitType,type:explicitType,autoSelected:managedByPumpset,managedByPumpset,source:managedByPumpset?'auto':'manual',validationReasons:result.reasons||[result.error],_assemblyErrorKey:managedByPumpset?signature:'',_assemblySyncKey:''};
   item.description=window.KeySuiteCoupling?.assemblyDescription?.(mode)||item.description;if(managedByPumpset)d.coupling_error=result.error;return result
  }
  const resolved=String(result?.config?.resolvedType||result?.config?.type||item.couplingData?.resolvedType||item.couplingData?.type||'pin_bush');
  item.couplingData={...(item.couplingData||{}),selectionMode:mode,resolvedType:resolved,type:resolved,autoSelected:managedByPumpset,managedByPumpset,source:managedByPumpset?'auto':'manual',_assemblySyncKey:managedByPumpset?couplingSyncSignature(d,item,context):'',_assemblyErrorKey:''};
  if(managedByPumpset)d.coupling_error=(result?.config?.validationReasons||[]).join('; ');return result||{item}
 }catch(error){
  const message=error?.message||String(error),explicitType=mode==='tyre'?'tyre':mode==='pin_bush'?'pin_bush':previous.resolvedType||previous.type||'pin_bush';
  item.couplingData={...previous,...(item.couplingData||{}),selectionMode:mode,resolvedType:explicitType,type:explicitType,autoSelected:managedByPumpset,managedByPumpset,source:managedByPumpset?'auto':'manual',validationReasons:[message],_assemblyErrorKey:managedByPumpset?couplingSyncSignature(d,item,context):'',_assemblySyncKey:''};
  item.description=window.KeySuiteCoupling?.assemblyDescription?.(mode)||item.description;if(managedByPumpset)d.coupling_error=`Coupling selection could not be completed: ${message}`;console.error('Coupling configuration failed',error);return {error:managedByPumpset?d.coupling_error:message,reasons:[message],item}
 }
}
function syncCouplingItems(d=current){
 if(!d||d.assembly_type!=='pumpset'||!window.KeySuiteCoupling?.configureAssemblyItem||couplingMutationDepth>0)return;
 const context=window.KeySuiteCoupling.contextFromItems?.(d.items||[])||{},esPump=(d.items||[]).find(item=>item?.section==='pump'&&String(item?.pumpData?.product||item?.pumpData?.productFamily||item?.pumpData?.product_family||item?.pumpData?.series||'').toUpperCase().includes('ES'));
 // V4.04.20: one ES pumpset uses one coupling regardless of generic component-count context.
 if(esPump)context.couplingQty=1;
 const hasPump=Number(context.pumpCount)>0,hasMotor=Number(context.motorCount)>0,autoItems=autoCouplingItems(d);
 if(d.auto_suppressed?.coupling){autoItems.forEach(item=>{d.description=removeDescriptionBlock(d.description,item.description)});d.items=(d.items||[]).filter(item=>!isAutoCouplingItem(item));d.coupling_error='Auto Coupling was removed. Use Restore Auto Coupling to size it again.';return}
 if(!hasPump||!hasMotor){autoItems.forEach(item=>{d.description=removeDescriptionBlock(d.description,item.description)});d.items=(d.items||[]).filter(item=>!isAutoCouplingItem(item));d.coupling_error=hasPump||hasMotor?'Select both Pump and Motor to size the Auto Coupling':'';return}
 d.coupling_mode=couplingMode(d);let item=autoItems[0]||null;
 if(!item){item=createCouplingPlaceholder(d,context);d.items.push(item)}
 item.couplingData={...(item.couplingData||{}),selectionMode:d.coupling_mode,autoSelected:true,managedByPumpset:true,source:'auto'};
 const signature=couplingSyncSignature(d,item,context);if(item.couplingData?._assemblySyncKey===signature||item.couplingData?._assemblyErrorKey===signature)return;
 const previous=item.description||'';applyCouplingConfiguration(d,item,{selectionMode:d.coupling_mode},context);if(previous&&previous!==item.description)d.description=replaceDescriptionBlock(d.description,previous,item.description);
 const duplicates=autoCouplingItems(d).filter(entry=>entry!==item);duplicates.forEach(entry=>{d.description=removeDescriptionBlock(d.description,entry.description)});d.items=(d.items||[]).filter(entry=>!duplicates.includes(entry));
}
function removeAutomaticBaseplate(d=current){if(!d)return;d.items=(d.items||[]).filter(item=>!(item?.baseplateData?.autoSized||sourceObject(item).auto_sized_baseplate))}
function syncAutomaticBaseplate(d=current){
 if(!d||d.assembly_type!=='pumpset')return;
 const pump=(d.items||[]).find(item=>item.section==='pump'&&String(item?.pumpData?.product||item?.pumpData?.productFamily||item?.pumpData?.product_family||item?.pumpData?.series||item?.pumpData?.product||'ES').toUpperCase().includes('ES')&&item?.pumpData?.baseplate_detail&&item?.pumpData?.pumpset_dimension);
 if(!pump){removeAutomaticBaseplate(d);return}
 const pd=pump.pumpData||{},bp=pd.baseplate_detail||{},dim=pd.pumpset_dimension||{};
 let item=(d.items||[]).find(entry=>entry?.baseplateData?.autoSized||sourceObject(entry).auto_sized_baseplate),qty=Math.max(1,Number(pump.qty)||1),manualFrame=!!item?.baseplateData?.manualFrame,chosenFrame=Number(manualFrame?item.baseplateData.frame:bp.frame);
 if(!Number.isFinite(chosenFrame)||chosenFrame<=0)chosenFrame=125;
 const master=window.KeySuiteMotorBaseplateV40205?.data?.baseplate?.frames?.[String(chosenFrame)]||{},baseData=item?.baseplateData||{},config=manualFrame?baseplateCostConfigForFrame(item,chosenFrame):{family:'ES',frame:chosenFrame,cChannel:master.cChannel||bp.cChannel||'',L3:dim.longitudinal?.L3??'',W1:dim.width?.W1??'',drillingQty:window.KeySuiteBaseplate?.getSettings?.()?.general?.defaultDrillingQty,boltNutQty:window.KeySuiteBaseplate?.getSettings?.()?.general?.defaultBoltNutQty,manualFrame:false};
 const found=window.KeySuitePricing?.findBaseplatePrice?.(config,{pricingMode:'assembly'});if(!found){removeAutomaticBaseplate(d);return}
 const model=found.product?.model||(`ES Baseplate Frame ${chosenFrame}`),source={...(window.KeySuitePricing?.sourceSnapshot?.(found)||{}),auto_sized_baseplate:true,configuration:config};
 const data={...baseData,...config,defaultFrame:Number(bp.frame||chosenFrame),sourcePumpModel:String(pd.model||pd.quotation_model||pd.pumpData?.model||pd.pumpData?.pumpModel||''),rawCostMyr:Number(found.sourceExtra?.raw_cost_myr||0),autoSized:true};
 if(!item){item={id:uid(),section:'baseplate',model,bomDescription:model,description:'',qty,unitPrice:Number(found.calc?.finalPrice||0),pricingSource:source,baseplateData:data};d.items.push(item)}
 else{item.section='baseplate';item.model=model;item.bomDescription=model;item.description='';item.qty=qty;item.unitPrice=Number(found.calc?.finalPrice||0);item.pricingSource=source;item.baseplateData=data}
}
function syncAutomaticComponents(d=current){const before=bomDescriptionState(d);syncCouplingItems(d);syncAutomaticBaseplate(d);syncAutomaticControlPanel(d);syncAutomaticManifold(d);syncAutomaticTank(d);syncQuoteUnitPrice(d);const changed=before!==bomDescriptionState(d);if(changed&&d)d.description_manual=false;return changed}
function updateKeyplcItem(item,enclosure,productId=null){
 if(!item?.keyplcData)return;
 const previous=item.description||'',data=item.keyplcData,qty=Math.max(1,Number(data.pumpQty)||1);data.enclosure=normalizePanelType(enclosure);
 data.manualOverride=true;
 if(productId){const product=keyplcProducts().find(row=>String(row.id)===String(productId));if(product){data.productId=product.id;data.motorRating=product.model;data.manualSize=true}}
 item.model=`KeyPLC ${data.motorRating||''} · ${qty} ${qty===1?'Pump':'Pumps'} · ${panelTypeLabel(data.enclosure)}`;item.bomDescription=item.model;item.description=keyplcDescription(item);
 const priceQty=Math.max(1,Math.min(6,qty)),found=window.KeySuitePricing?.findKeyplcPrice?.(data.productId,priceQty,{enclosure:data.enclosure,pricingMode:'assembly'});
 const indoor=Number(found?.calc?.indoorPrice??data.indoorUnitPrice??item.unitPrice??0),surcharge=data.enclosure==='sheltered'?Number(data.shelteredSurcharge||1000):0;data.indoorUnitPrice=indoor;item.unitPrice=Number(found?.calc?.finalPrice??indoor+surcharge);
 item.pricingSource={...sourceObject(item),...(found?window.KeySuitePricing?.sourceSnapshot?.(found)||{}:{}),product_family:'KEYPLC',product_id:data.productId,variant:`P${priceQty}`,material:`P${priceQty}`,pricing_mode:'assembly',panel_type:data.enclosure,enclosure_surcharge:surcharge,calculated_price:item.unitPrice,...(data.autoSized?{auto_sized_panel:true}:{})};
 current.description=replaceDescriptionBlock(current.description,previous,item.description);syncQuoteUnitPrice(current);if($('assemblyDescription'))$('assemblyDescription').value=current.description||'';
}
async function load(){
 const localById=new Map(localLoad().map(d=>[d.id,d])),client=window.KeySuiteAuth?.getClient?.();
 if(client){
   try{
     let {data,error}=await client.rpc('keysuite_list_assemblies_v218');if(error){const fallback=await client.rpc('keysuite_list_assemblies_v201');data=fallback.data;error=fallback.error}if(error)throw error;
     drafts=(data||[]).map(remote=>{
       const local=localById.get(remote.id)||{};
       const items=(remote.items||[]).map(item=>{
         const localItem=(local.items||[]).find(x=>x.id===item.id)||{};
         return {...item,bomDescription:localItem.bomDescription??item.bomDescription,tankData:localItem.tankData??item.tankData,keyplcData:localItem.keyplcData??item.keyplcData,manifoldData:localItem.manifoldData??item.manifoldData,motorData:localItem.motorData??item.motorData,couplingData:localItem.couplingData??item.couplingData,baseplateData:localItem.baseplateData??item.baseplateData,pumpsetData:localItem.pumpsetData??item.pumpsetData};
       });
       const meta=quoteMetaFromItems(items);
       return normalize({...remote,quote_session_id:local.quote_session_id||remote.quote_session_id||`legacy:${remote.id}`,quote_qty:local.quote_qty??meta?.qty,quote_unit_price:local.quote_unit_price??meta?.unitPrice,quote_price_manual:local.quote_price_manual??meta?.manual,display_capacity:local.display_capacity??meta?.displayCapacity,capacity_value:local.capacity_value??meta?.capacityValue,capacity_unit:local.capacity_unit??meta?.capacityUnit,head_value:local.head_value??meta?.headValue,head_unit:local.head_unit??meta?.headUnit,auto_suppressed:local.auto_suppressed||remote.auto_suppressed,items});
     });
     loaded=true;refreshPricing();localSave();return;
   }catch(e){console.warn('Assembly V2.01 Supabase fallback',e)}
 }
 drafts=localLoad();loaded=true;refreshPricing();
}
async function persist(d){
 const originalId=d.id,wasCurrent=current?.id===originalId,meta=quoteMeta(d),items=(d.items||[]).map((item,index)=>index===0?{...item,pricingSource:{...sourceObject(item),assembly_quote:meta}}:item),payload=JSON.parse(JSON.stringify({...d,items,updated_at:new Date().toISOString()}));let savedDraft=d;const client=window.KeySuiteAuth?.getClient?.();
 if(client){let {data,error}=await client.rpc('keysuite_save_assembly_v218',{p_assembly:payload});if(error){const fallback=await client.rpc('keysuite_save_assembly_v201',{p_assembly:payload});data=fallback.data;error=fallback.error}if(error)throw error;const saved=Array.isArray(data)?data[0]:data,latest=drafts.find(x=>x.id===originalId)||d;if(saved)savedDraft=normalize({...saved,...latest,id:saved.id||latest.id,created_at:saved.created_at||latest.created_at,updated_at:saved.updated_at||payload.updated_at,items:latest.items})}
 else d.updated_at=payload.updated_at;
 const i=drafts.findIndex(x=>x.id===originalId);if(i>=0)drafts[i]=savedDraft;else drafts.unshift(savedDraft);if(wasCurrent)current=savedDraft;localSave();return savedDraft
}
function scheduleAutoSave(delay=650){
 if(!current)return;dirtyDraftIds.add(current.id);autoSaveRetries.set(current.id,0);localSave();if($('assemblyNotice'))$('assemblyNotice').textContent='Saving changes automatically…';clearTimeout(autoSaveTimer);const id=current.id;autoSaveTimer=setTimeout(()=>flushAutoSave(id),delay)
}
function flushAutoSave(preferredId){
 clearTimeout(autoSaveTimer);autoSaveTimer=null;const id=preferredId&&dirtyDraftIds.has(preferredId)?preferredId:dirtyDraftIds.values().next().value;if(!id)return;dirtyDraftIds.delete(id);const draft=drafts.find(x=>x.id===id);if(!draft)return;
 saveQueue=saveQueue.then(async()=>{try{await persist(draft);autoSaveRetries.delete(id);if(current?.id===id){renderList();$('assemblyNotice').textContent='Saved automatically.'}}catch(e){const tries=(autoSaveRetries.get(id)||0)+1;autoSaveRetries.set(id,tries);if(tries<=1)dirtyDraftIds.add(id);if(current?.id===id)$('assemblyNotice').textContent=tries<=1?`Auto-save failed. Retrying once… (${e.message||e})`:`Auto-save failed. Your changes remain on this device. (${e.message||e})`}}).finally(()=>{if(dirtyDraftIds.size){clearTimeout(autoSaveTimer);const retrying=[...dirtyDraftIds].some(draftId=>(autoSaveRetries.get(draftId)||0)>0);autoSaveTimer=setTimeout(()=>flushAutoSave(),retrying?2000:300)}})
}
async function remove(){if(!current||!confirm(`Delete ${current.name}?`))return;const client=window.KeySuiteAuth?.getClient?.();if(client){const {error}=await client.rpc('keysuite_delete_assembly_v200',{p_assembly_id:current.id});if(error)throw error}drafts=drafts.filter(x=>x.id!==current.id);localSave();current=currentSessionDrafts(type)[0]||blank(type);render()}
function read(options={}){
 if(!current)return;current.model_item=$('assemblyModelItem')?.value.trim()||'';current.description=$('assemblyDescription')?.value||'';current.quote_qty=Math.max(.01,Number($('assemblyQuoteQty')?.value)||1);current.display_capacity=!!$('assemblyDisplayCapacity')?.checked;current.capacity_value=String($('assemblyCapacityValue')?.value||'');current.capacity_unit=normalizeCapacityUnit($('assemblyCapacityUnit')?.value);current.head_value=String($('assemblyHeadValue')?.value||'');current.head_unit=normalizeHeadUnit($('assemblyHeadUnit')?.value);
 const priceInput=$('assemblyQuoteUnitPrice');if(priceInput){if(priceInput.value===''){current.quote_price_manual=false;current.quote_unit_price=total(current)}else{current.quote_unit_price=Math.max(0,Number(priceInput.value)||0)}}
 current.name=current.model_item||current.name||(`New ${type==='system'?'System':'Pumpset'}`);current.customer_id=quoteCustomerId()||current.customer_id||'';current.status=$('assemblyStatus')?.value||current.status||'draft';
 $('assemblyItems')?.querySelectorAll('[data-assembly-item]').forEach(row=>{const item=current.items.find(x=>x.id===row.dataset.assemblyItem);if(item){if(options.skipCouplingDom&&item.section==='coupling')return;const previousDescription=item.description||'',autoPanel=!!(item.keyplcData?.autoSized||sourceObject(item).auto_sized_panel),autoCoupling=!!item.couplingData?.managedByPumpset,autoLocked=autoPanel||autoCoupling||autoComponent(item,'manifold')||autoComponent(item,'tank');if(!autoLocked){const qty=row.querySelector('.assembly-qty'),price=row.querySelector('.assembly-price');if(qty){if(qty.value===''&&type==='system'&&item.section==='pumpset'){item.qty=Number(item.autoQty||2);item.bomManual=false}else if(qty.value!==''){item.qty=type==='system'&&item.section==='pumpset'?Math.min(6,Math.max(1,Number(qty.value)||1)):Math.max(0,Number(qty.value)||0);if(type==='system'&&item.section==='pumpset')item.bomManual=Math.abs(Number(item.qty)-Number(item.autoQty||2))>1e-9}}if(price&&price.value!=='')item.unitPrice=Math.max(0,Number(price.value)||0)}if(item.keyplcData&&!autoPanel){const currentSurcharge=normalizePanelType(item.keyplcData.enclosure)==='sheltered'?Number(item.keyplcData.shelteredSurcharge||1000):0;item.keyplcData.indoorUnitPrice=Math.max(0,item.unitPrice-currentSurcharge)}if(item.tankData&&!item.tankData.autoSelected){item.description=tankDescription(item,item.qty);current.description=replaceDescriptionBlock(current.description,previousDescription,item.description)}}});
 if(!options.skipAutomatic)syncAutomaticComponents(current);if(!current.description_manual)rebuildDescription(current);current.description=normalizeDescriptionIndentation(current.description);if($('assemblyDescription'))$('assemblyDescription').value=current.description||'';renderDescriptionPreview()
}
function currentSessionDrafts(t=type){const session=quoteSessionId();return drafts.filter(x=>x.assembly_type===t&&x.quote_session_id===session&&((x.items||[]).length||String(x.model_item||'').trim()||String(x.description||'').trim()))}
function renderList(){const list=$('assemblyDraftList');if(!list)return;const rows=currentSessionDrafts(type);list.innerHTML=rows.map(d=>`<button type="button" class="${d.id===current?.id?'active':''}" data-draft="${esc(d.id)}"><b>${esc(d.model_item||d.name)}</b><br><small>${esc(d.status)} · ${money(quoteUnitPrice(d))}</small></button>`).join('')||'<div class="muted">No saved drafts.</div>';list.querySelectorAll('[data-draft]').forEach(b=>b.onclick=()=>{current=drafts.find(x=>x.id===b.dataset.draft);currentPinned=true;render()})}
function sanitizeEsPumpDescription(item){
 const source=sourceObject(item),seal=normalizeEsSeal(source.seal_material||item?.pumpData?.keysuite_seal||item?.pumpData?.keysuite_seal_material||item?.pumpData?.sealMaterial),elastomer=String(source.elastomer||item?.pumpData?.keysuite_elastomer||item?.pumpData?.elastomer||ES_DEFAULT_ELASTOMER);
 const lines=String(item?.description||'').replace(/\r\n?/g,'\n').split('\n').filter(line=>{const t=line.trim();if(/^Mech Seal Material:/i.test(t))return seal!==ES_DEFAULT_SEAL;if(/^Elastomer:/i.test(t))return elastomer!==ES_DEFAULT_ELASTOMER;return true});
 if(seal===ES_DEFAULT_SEAL){for(let i=lines.length-1;i>=0;i--)if(/^Mech Seal Material:\s*Carbon\s*Ceramic/i.test(lines[i].trim()))lines.splice(i,1)}
 item.description=normalizeDescriptionIndentation(lines.join('\n'));source.seal_material=seal;source.elastomer=elastomer;item.pricingSource=source;return item.description;
}
function pumpOptions(item){
 // V4.04.12: ES seal and elastomer are selected in ES. They are no longer editable in the Pumpset BOM.
 sanitizeEsPumpDescription(item);return '';
}

function motorHpOptions(selected){
 const values=[...new Set((window.KEYSUITE_SECURE_DATA?.motorProducts||[]).map(row=>Number(row.hp)).filter(value=>value>0))].sort((a,b)=>a-b);
 return values.map(value=>`<option value="${value}" ${Number(selected)===value?'selected':''}>${Number.isInteger(value)?value:String(value).replace(/0+$/,'').replace(/\.$/,'')} HP</option>`).join('');
}
function motorOptions(item){
 if(!item?.motorData)return '';
 const data=item.motorData,defaultHp=Number(data.defaultHp??data.hp),defaultPole=Number(data.defaultPole??data.pole??2),defaultEff=String(data.defaultEfficiencyClass??data.efficiencyClass??'IE3');
 const hpChanged=Math.abs(Number(data.hp)-defaultHp)>1e-9,hpOversized=Number(data.hp)>defaultHp+1e-9,poleChanged=Number(data.pole)!==defaultPole,effChanged=String(data.efficiencyClass||'IE3')!==defaultEff;
 return `<div class="assembly-motor-options"><div class="assembly-item-option"><label>Motor</label><select class="assembly-motor-hp ${hpOversized?'motor-hp-oversized':hpChanged?'non-default-selection':''}">${motorHpOptions(data.hp)}</select></div><div class="assembly-item-option"><label>Pole</label><select class="assembly-motor-pole ${poleChanged?'non-default-selection':''}">${[2,4,6,8].map(value=>`<option value="${value}" ${Number(data.pole)===value?'selected':''}>${value} Pole</option>`).join('')}</select></div><div class="assembly-item-option"><label>Efficiency</label><select class="assembly-motor-efficiency ${effChanged?'non-default-selection':''}">${['IE1','IE2','IE3','IE4','IE5'].map(value=>`<option value="${value}" ${String(data.efficiencyClass||'IE3')===value?'selected':''}>${value}</option>`).join('')}</select></div></div>`;
}

function updateMotorItemFromRow(row){
 const item=current?.items?.find(entry=>entry.id===row?.dataset.assemblyItem);if(!item?.motorData)return;
 const result=window.KeySuiteMotor?.configureAssemblyItem?.(item,{hp:Number(row.querySelector('.assembly-motor-hp')?.value),pole:Number(row.querySelector('.assembly-motor-pole')?.value),efficiencyClass:row.querySelector('.assembly-motor-efficiency')?.value||'IE3'});
 if(result?.error){alert(result.error);return}
 current.description_manual=false;syncAutomaticComponents(current);syncQuoteUnitPrice(current);rebuildDescription(current);current.description=normalizeDescriptionIndentation(current.description);if($('assemblyDescription'))$('assemblyDescription').value=current.description||'';renderDescriptionPreview();localSave();renderItems();renderQuoteFields();scheduleAutoSave(100);
}
function baseplateFrameRows(){const frames=window.KeySuiteMotorBaseplateV40205?.data?.baseplate?.frames||{};return Object.keys(frames).map(Number).filter(Number.isFinite).sort((a,b)=>a-b).map(frame=>({frame,...frames[String(frame)]}))}
function baseplateFrameOptions(item){
 if(!item?.baseplateData)return '';const data=item.baseplateData,currentFrame=Number(data.frame||data.defaultFrame||0),defaultFrame=Number(data.defaultFrame||data.frame||0),rows=baseplateFrameRows();if(!rows.length)return '';
 return `<div class="assembly-component-options assembly-baseplate-options"><div class="assembly-item-option"><label>ES Baseplate Frame</label><select class="assembly-baseplate-frame ${defaultFrame>0&&currentFrame!==defaultFrame?'non-default-selection':''}" data-default-frame="${defaultFrame||''}">${rows.map(row=>`<option value="${row.frame}" ${currentFrame===row.frame?'selected':''}>${row.frame}</option>`).join('')}</select></div></div>`;
}
function baseplateCostConfigForFrame(item,frame){
 const data=item?.baseplateData||{},master=window.KeySuiteMotorBaseplateV40205?.data?.baseplate?.frames?.[String(frame)]||{},pump=(current?.items||[]).find(entry=>entry.section==='pump'&&entry.pumpData),pd=pump?.pumpData||{},dim=pd.pumpset_dimension||{},motor=pd.motor_detail||{},pumpDims=dim.pump||{},oldGap=Number(dim.width?.frameGapMm||0),newGap=Number(master.gap??oldGap),motorAb=Number(motor.dimension?.AB),pumpN1=Number(pumpDims.N1);let W1=Number(data.W1||dim.width?.W1||0);
 if(Number.isFinite(motorAb)&&Number.isFinite(pumpN1)&&newGap>=0)W1=Math.round(Math.max(326,Math.max(motorAb,pumpN1)+(2*newGap)));
 const defaultFrame=Number(data.defaultFrame||pd.baseplate_detail?.frame||data.frame||frame);return {...data,family:'ES',frame:Number(frame),defaultFrame,cChannel:master.cChannel||data.cChannel||'',L3:Number(data.L3||dim.longitudinal?.L3||0),W1,drillingQty:data.drillingQty??window.KeySuiteBaseplate?.getSettings?.()?.general?.defaultDrillingQty,boltNutQty:data.boltNutQty??window.KeySuiteBaseplate?.getSettings?.()?.general?.defaultBoltNutQty,manualFrame:Number(frame)!==defaultFrame};
}
function updateBaseplateItemFromRow(row){
 const item=current?.items?.find(entry=>entry.id===row?.dataset.assemblyItem);if(!item?.baseplateData)return;const frame=Number(row.querySelector('.assembly-baseplate-frame')?.value||item.baseplateData.frame||item.baseplateData.defaultFrame||0),config=baseplateCostConfigForFrame(item,frame),found=window.KeySuitePricing?.findBaseplatePrice?.(config,{pricingMode:'assembly'});item.baseplateData=config;item.model=found?.product?.model||`ES Baseplate Frame ${frame}`;item.bomDescription=item.model;if(found){item.unitPrice=Number(found.calc?.finalPrice||0);item.pricingSource={...(window.KeySuitePricing?.sourceSnapshot?.(found)||{}),auto_sized_baseplate:true,configuration:config}}else item.pricingSource={...sourceObject(item),auto_sized_baseplate:true,configuration:config};current.description_manual=false;syncQuoteUnitPrice(current);rebuildDescription(current);localSave();renderItems();renderQuoteFields();scheduleAutoSave(100);
}
function couplingModelOptions(type,selected){
 const componentType=String(type||'pin_bush')==='tyre'?'tyre':'pin_bush';
 const rows=(window.KeySuiteCoupling?.productRows?.(componentType)||[]).sort((a,b)=>Number(String(a.model).match(/\d+/)?.[0]||0)-Number(String(b.model).match(/\d+/)?.[0]||0));return rows.length?rows.map(product=>`<option value="${esc(product.model)}" ${String(product.model)===String(selected)?'selected':''}>${esc(product.model)}</option>`).join(''):'<option value="">No model available</option>';
}
function couplingArrangementOptions(data,context){
 const options=Number(context?.pumpShaft)>24?[['pump_h_motor_f','Pump H / Motor F'],['pump_f_motor_h','Pump F / Motor H']]:[['pump_f_motor_h','Pump F / Motor H']];
 return options.map(([value,label])=>`<option value="${value}" ${String(data.arrangement)===value?'selected':''}>${label}</option>`).join('');
}
function couplingOptions(item){
 if(!item?.couplingData)return '';
 const data=item.couplingData,auto=isAutoCouplingItem(item),mode=String(auto?(current?.coupling_mode||data.selectionMode||'flexible'):(data.selectionMode||data.type||'pin_bush')),resolvedType=String(data.resolvedType||data.type||(/^FCL/i.test(String(data.model||''))?'pin_bush':'tyre'))==='tyre'?'tyre':'pin_bush',explicitType=mode==='tyre'?'tyre':mode==='pin_bush'?'pin_bush':resolvedType,context=window.KeySuiteCoupling?.contextFromItems?.(current?.items||[])||{};
 if(!data.defaultModel&&data.model)data.defaultModel=data.model;const typeChanged=mode!=='flexible',modelChanged=!!(data.defaultModel&&data.model&&String(data.model)!==String(data.defaultModel));
 const modelControl=mode==='flexible'?`<input class="assembly-coupling-resolved-model ${modelChanged?'non-default-selection':''}" value="${esc(data.model||'No suitable model')}" readonly aria-readonly="true">`:`<select class="assembly-coupling-model ${modelChanged?'non-default-selection':''}">${couplingModelOptions(explicitType,data.model)}</select>`;
 const arrangementControl=explicitType==='tyre'?(mode==='flexible'?`<input class="assembly-coupling-resolved-arrangement" value="${esc(data.arrangement==='pump_h_motor_f'?'Pump H / Motor F':data.arrangement==='pump_f_motor_h'?'Pump F / Motor H':data.arrangement||'—')}" readonly aria-readonly="true">`:`<select class="assembly-coupling-arrangement">${couplingArrangementOptions(data,context)}</select>`):'';
 const resolvedBadge=mode==='flexible'?`<div class="assembly-coupling-resolved-note">Resolved as <b>${resolvedType==='tyre'?'Tyre':'Pin &amp; Bush'}</b> using the higher suitable price. Selected Type remains Flexible.</div>`:'';
 const sourceBadge=`<div class="assembly-coupling-source-note"><b>${auto?'Auto Coupling':'Manual Coupling'}</b>${auto?' · sized from the Pumpset Pump and Motor':' · added from Product > Coupling'}</div>`;
 const bushSummary=resolvedType==='tyre'?`<div class="assembly-coupling-bush-summary">Pump: ${esc(data.pumpBushType||'')} Bush ${esc(data.pumpBush||'—')} · ${Number(context.pumpShaft||0)} / ${Number(data.pumpBushMax||0)} mm<br>Motor: ${esc(data.motorBushType||'')} Bush ${esc(data.motorBush||'—')} · ${Number(context.motorShaft||0)} / ${Number(data.motorBushMax||0)} mm</div>`:'';
 const warnings=(data.validationReasons||[]).filter(Boolean);if(auto&&!warnings.length&&current?.coupling_error)warnings.push(current.coupling_error);const warning=warnings.length?`<div class="assembly-coupling-warning">${esc(warnings.join('; '))}</div>`:'';
 return `${sourceBadge}<div class="assembly-motor-options assembly-coupling-options"><div class="assembly-item-option"><label>Selected Type</label><select class="assembly-coupling-type ${typeChanged?'non-default-selection':''}"><option value="flexible" ${mode==='flexible'?'selected':''}>Flexible</option><option value="pin_bush" ${mode==='pin_bush'?'selected':''}>Pin &amp; Bush</option><option value="tyre" ${mode==='tyre'?'selected':''}>Tyre</option></select></div><div class="assembly-item-option"><label>${mode==='flexible'?'Resolved Model':'Model'}</label>${modelControl}</div>${explicitType==='tyre'?`<div class="assembly-item-option"><label>F/H Arrangement</label>${arrangementControl}</div>`:''}</div>${resolvedBadge}${bushSummary}${warning}`;
}
function couplingModeControls(){
 if(type!=='pumpset')return '';const context=window.KeySuiteCoupling?.contextFromItems?.(current?.items||[])||{};if(!(Number(context.pumpCount)>0&&Number(context.motorCount)>0))return `<div class="assembly-coupling-mode-controls"><div class="muted">Select both Pump and Motor to size the Auto Coupling.</div></div>`;if(current?.auto_suppressed?.coupling)return `<div class="assembly-coupling-mode-controls"><div class="muted">Auto Coupling removed from this Pumpset. Manual Couplings remain available.</div><button class="btn assembly-coupling-restore" type="button">Restore Auto Coupling</button></div>`;return '';
}
function finishCouplingMutation(){current.description_manual=false;syncQuoteUnitPrice(current);rebuildDescription(current);current.description=normalizeDescriptionIndentation(current.description);if($('assemblyDescription'))$('assemblyDescription').value=current.description||'';renderDescriptionPreview();localSave();queueCouplingRender();scheduleAutoSave(180)}
function setCouplingMode(mode,rowId=''){
 if(!current||couplingMutationDepth>0)return;const operation=++couplingOperationSeq,next=String(mode||'flexible');
 withCouplingMutation(()=>{if(operation!==couplingOperationSeq)return;const context=window.KeySuiteCoupling?.contextFromItems?.(current.items||[])||{};let item=rowId?current.items.find(entry=>entry.id===rowId):autoCouplingItems(current)[0]||null;const auto=!item||isAutoCouplingItem(item);
  if(!item){current.auto_suppressed={...(current.auto_suppressed||{}),coupling:false};item=createCouplingPlaceholder(current,context);current.items.push(item)}
  if(auto){current.auto_suppressed={...(current.auto_suppressed||{}),coupling:false};current.coupling_mode=next}
  const previousResolved=item.couplingData?.resolvedType||item.couplingData?.type||'pin_bush';item.couplingData={...(item.couplingData||{}),selectionMode:next,resolvedType:next==='tyre'?'tyre':next==='pin_bush'?'pin_bush':previousResolved,type:next==='tyre'?'tyre':next==='pin_bush'?'pin_bush':previousResolved,autoSelected:auto,managedByPumpset:auto,source:auto?'auto':'manual',manualModel:false,_assemblySyncKey:'',_assemblyErrorKey:''};
  applyCouplingConfiguration(current,item,{selectionMode:next},context);finishCouplingMutation()
 })
}
function updateCouplingItemFromRow(row,changedClass=''){
 if(!current||couplingMutationDepth>0||!row)return;const operation=++couplingOperationSeq,rowId=row.dataset.assemblyItem,item=current?.items?.find(entry=>entry.id===rowId);if(!item?.couplingData)return;const auto=isAutoCouplingItem(item),selectedMode=row.querySelector('.assembly-coupling-type')?.value||(auto?current.coupling_mode:item.couplingData.selectionMode)||'flexible',selectedModel=row.querySelector('.assembly-coupling-model')?.value||'',selectedArrangement=row.querySelector('.assembly-coupling-arrangement')?.value||'';
 withCouplingMutation(()=>{if(operation!==couplingOperationSeq)return;const context=window.KeySuiteCoupling?.contextFromItems?.(current.items||[])||{},values={selectionMode:selectedMode};if(auto){current.auto_suppressed={...(current.auto_suppressed||{}),coupling:false};current.coupling_mode=selectedMode}if(changedClass.includes('model'))values.model=selectedModel;if(changedClass.includes('arrangement')){values.model=selectedModel;values.arrangement=selectedArrangement}applyCouplingConfiguration(current,item,values,context);finishCouplingMutation()
 })
}
function deleteCouplingItem(rowId){if(!current)return;couplingOperationSeq+=1;withCouplingMutation(()=>{const item=current.items.find(entry=>entry.id===rowId);if(!item)return;const auto=isAutoCouplingItem(item);current.items=current.items.filter(entry=>entry.id!==rowId);if(auto){current.auto_suppressed={...(current.auto_suppressed||{}),coupling:true};current.coupling_error='Auto Coupling was removed. Use Restore Auto Coupling to size it again.'}current.description_manual=false;rebuildDescription(current);if($('assemblyDescription'))$('assemblyDescription').value=current.description||'';renderDescriptionPreview();localSave();queueCouplingRender();scheduleAutoSave(180)})}
function restoreCoupling(){if(!current||couplingMutationDepth>0)return;couplingOperationSeq+=1;current.auto_suppressed={...(current.auto_suppressed||{}),coupling:false};current.coupling_error='';syncAutomaticComponents(current);finishCouplingMutation()}
function keyplcModelOptions(selectedId){return [...keyplcProducts()].sort((a,b)=>Number(a.motorKw||0)-Number(b.motorKw||0)).map(product=>`<option value="${esc(product.id)}" ${String(product.id)===String(selectedId)?'selected':''}>${esc(product.model)}</option>`).join('')}
function restoreControlPanelAuto(row){
 const item=current?.items?.find(entry=>entry.id===row?.dataset.assemblyItem);if(!item?.keyplcData)return;
 item.keyplcData={...(item.keyplcData||{}),manualSize:false,manualOverride:false,enclosure:'indoor'};current.description_manual=false;syncAutomaticComponents(current);rebuildDescription(current);if($('assemblyDescription'))$('assemblyDescription').value=current.description||'';renderDescriptionPreview();localSave();renderItems();renderQuoteFields();scheduleAutoSave(100)
}
function tankSizeValues(){
 return [...new Set((window.KEYSUITE_SECURE_DATA?.gwsProducts||[]).map(product=>Number(product.sizeLitres||0)).filter(value=>value>0))].sort((a,b)=>a-b)
}
function tankOptions(item){
 if(item?.section!=='tank'||!autoComponent(item,'tank'))return '';const data=item.tankData||{},manual=!!data.manualOverride,currentSize=Number(data.sizeLitres||0);
 return `<div class="assembly-tank-options"><div class="assembly-item-option"><label>Tank Size</label><select class="assembly-tank-size ${manual?'non-default-selection':''}">${tankSizeValues().map(value=>`<option value="${value}" ${Number(value)===currentSize?'selected':''}>${value} L</option>`).join('')}</select></div><button class="btn secondary assembly-auto-action assembly-tank-auto" type="button" ${manual?'':'disabled'}>Auto</button></div>`
}
function updateTankItemFromRow(row){
 const item=current?.items?.find(entry=>entry.id===row?.dataset.assemblyItem);if(!item?.tankData)return;const before={...(item.tankData||{})},size=Number(row.querySelector('.assembly-tank-size')?.value||0);if(!(size>0))return;
 item.tankData={...(item.tankData||{}),sizeLitres:size,manualOverride:true,autoSelected:true};current.description_manual=false;syncAutomaticComponents(current);
 if(item.tankData?.manualUnavailable||Number(item.tankData?.sizeLitres||0)!==size){alert(`No suitable ${size} L tank is available above the system shut-off pressure with a valid Assembly price.`);item.tankData=before;syncAutomaticComponents(current)}
 rebuildDescription(current);if($('assemblyDescription'))$('assemblyDescription').value=current.description||'';renderDescriptionPreview();localSave();renderItems();renderQuoteFields();scheduleAutoSave(100)
}
function restoreTankAuto(row){
 const item=current?.items?.find(entry=>entry.id===row?.dataset.assemblyItem);if(!item?.tankData)return;item.tankData={...(item.tankData||{}),manualOverride:false,sizeLitres:Number(item.tankData.autoSizeLitres||item.tankData.sizeLitres||0),autoSelected:true};current.description_manual=false;syncAutomaticComponents(current);rebuildDescription(current);if($('assemblyDescription'))$('assemblyDescription').value=current.description||'';renderDescriptionPreview();localSave();renderItems();renderQuoteFields();scheduleAutoSave(100)
}
function manifoldHeaderOptions(item){
 const data=item?.manifoldData||{},values=window.KeySuiteManifold?.headerSizes?.(data.material||'GI')||[];return '<option value="">Auto</option>'+values.map(value=>`<option value="${esc(value)}" ${String(data.headerDn||'')===String(value)?'selected':''}>${esc(value)}</option>`).join('')
}
function manifoldOptions(item){
 if(item?.section!=='manifold'||!autoComponent(item,'manifold'))return '';const data=item.manifoldData||{},manual=!!data.manualOverride,opts=window.KeySuiteManifold?.normalizeOptions?.(data.options||{})||{};
 return `<div class="assembly-manifold-options"><div class="assembly-item-option"><label>Material</label><select class="assembly-manifold-material ${manual&&String(data.material||'GI')!=='GI'?'non-default-selection':''}"><option value="GI" ${String(data.material||'GI')==='GI'?'selected':''}>GI</option><option value="SS" ${String(data.material||'GI')==='SS'?'selected':''}>SS</option></select></div><div class="assembly-item-option"><label>Header Size</label><select class="assembly-manifold-header ${manual&&data.headerDn?'non-default-selection':''}">${manifoldHeaderOptions(item)}</select></div><button class="btn secondary assembly-auto-action assembly-manifold-auto" type="button" ${manual?'':'disabled'}>Auto</button></div><div class="assembly-manifold-accessory-options"><label class="assembly-manifold-check"><input type="checkbox" class="assembly-manifold-option" data-manifold-option="suctionStrainer" ${opts.suctionStrainer?'checked':''}><span>Strainer · Suction</span></label><label class="assembly-manifold-check"><input type="checkbox" class="assembly-manifold-option" data-manifold-option="suctionFlexible" ${opts.suctionFlexible?'checked':''}><span>Flexible · Suction</span></label><label class="assembly-manifold-check"><input type="checkbox" class="assembly-manifold-option" data-manifold-option="dischargeFlexible" ${opts.dischargeFlexible?'checked':''}><span>Flexible · Discharge</span></label></div>`
}
function pumpsetOptions(item){
 if(type!=='system'||item?.section!=='pumpset')return '';return `<div class="assembly-pumpset-options"><button class="btn secondary assembly-auto-action assembly-pumpset-auto" type="button" ${item.bomManual?'':'disabled'}>Auto Qty (2)</button></div>`
}
function updateManifoldItemFromRow(row){
 const item=current?.items?.find(entry=>entry.id===row?.dataset.assemblyItem);if(!item?.manifoldData)return;item.manifoldData={...(item.manifoldData||{}),material:String(row.querySelector('.assembly-manifold-material')?.value||'GI'),headerDn:String(row.querySelector('.assembly-manifold-header')?.value||''),manualOverride:true,autoSelected:true};current.description_manual=false;syncAutomaticComponents(current);rebuildDescription(current);if($('assemblyDescription'))$('assemblyDescription').value=current.description||'';renderDescriptionPreview();localSave();renderItems();renderQuoteFields();scheduleAutoSave(100)
}
function updateManifoldOptionFromRow(row){
 const item=current?.items?.find(entry=>entry.id===row?.dataset.assemblyItem);if(!item?.manifoldData)return;const options=window.KeySuiteManifold?.normalizeOptions?.(item.manifoldData.options||{})||{};row.querySelectorAll('.assembly-manifold-option').forEach(input=>{options[input.dataset.manifoldOption]=!!input.checked});item.manifoldData={...(item.manifoldData||{}),options,autoSelected:true};window.KeySuiteManifold?.setGlobalOptions?.(options,{source:'assembly'});current.description_manual=false;syncAutomaticComponents(current);rebuildDescription(current);if($('assemblyDescription'))$('assemblyDescription').value=current.description||'';renderDescriptionPreview();localSave();renderItems();renderQuoteFields();scheduleAutoSave(100)
}
function restoreManifoldAuto(row){const item=current?.items?.find(entry=>entry.id===row?.dataset.assemblyItem);if(!item?.manifoldData)return;item.manifoldData={...(item.manifoldData||{}),material:'GI',headerDn:'',manualOverride:false,autoSelected:true};current.description_manual=false;syncAutomaticComponents(current);rebuildDescription(current);if($('assemblyDescription'))$('assemblyDescription').value=current.description||'';renderDescriptionPreview();localSave();renderItems();renderQuoteFields();scheduleAutoSave(100)}
function restorePumpsetQtyAuto(row){const item=current?.items?.find(entry=>entry.id===row?.dataset.assemblyItem);if(!item||item.section!=='pumpset')return;item.autoQty=2;item.qty=2;item.bomManual=false;current.description_manual=false;syncAutomaticComponents(current);rebuildDescription(current);if($('assemblyDescription'))$('assemblyDescription').value=current.description||'';renderDescriptionPreview();localSave();renderItems();renderQuoteFields();scheduleAutoSave(100)}
function refreshSystemPumpsetQty(item,{render=false}={}){if(!item||type!=='system'||item.section!=='pumpset')return;item.qty=Math.min(6,Math.max(1,Number(item.qty)||1));item.bomManual=Math.abs(Number(item.qty)-Number(item.autoQty||2))>1e-9;current.description_manual=false;syncAutomaticComponents(current);rebuildDescription(current);if($('assemblyDescription'))$('assemblyDescription').value=current.description||'';renderDescriptionPreview();syncQuoteUnitPrice(current);if($('assemblyTotal'))$('assemblyTotal').textContent=money(total());renderQuoteFields();localSave();if(render)renderItems();scheduleAutoSave(render?100:300)}
function stepSystemPumpsetQty(row,delta){const item=current?.items?.find(entry=>entry.id===row?.dataset.assemblyItem);if(!item||type!=='system'||item.section!=='pumpset')return;item.qty=Math.min(6,Math.max(1,(Number(item.qty)||1)+Number(delta||0)));refreshSystemPumpsetQty(item,{render:true})}
function itemHtml(x){
 const autoPanel=!!(x.keyplcData?.autoSized||sourceObject(x).auto_sized_panel),autoCoupling=isAutoCouplingItem(x),manifoldAuto=autoComponent(x,'manifold'),tankAuto=autoComponent(x,'tank'),autoGenerated=autoPanel||autoCoupling||manifoldAuto||tankAuto,pumpsetManual=type==='system'&&x.section==='pumpset'&&!!x.bomManual,controlPanelManual=autoPanel&&!!x.keyplcData?.manualOverride,manifoldManual=manifoldAuto&&!!x.manifoldData?.manualOverride,tankManual=tankAuto&&!!x.tankData?.manualOverride,manualOverride=pumpsetManual||controlPanelManual||manifoldManual||tankManual,autoLocked=autoGenerated;
 const qtyLocked=autoLocked&&x.section!=='pumpset',locked=qtyLocked?' readonly aria-readonly="true" class="assembly-qty assembly-auto-locked"':' class="assembly-qty"',priceLocked=autoLocked?' readonly aria-readonly="true" class="assembly-price assembly-auto-locked"':' class="assembly-price"';
 const panel=x.keyplcData?`<div class="assembly-keyplc-options">${autoPanel?`<div class="assembly-item-option"><label>Motor Rating</label><select class="assembly-keyplc-model">${keyplcModelOptions(x.keyplcData.productId)}</select></div>`:''}<div class="assembly-item-option"><label>Panel Type</label><select class="assembly-keyplc-type"><option value="indoor" ${normalizePanelType(x.keyplcData.enclosure)==='indoor'?'selected':''}>Indoor</option><option value="sheltered" ${normalizePanelType(x.keyplcData.enclosure)==='sheltered'?'selected':''}>Sheltered (+ RM 1,000.00)</option></select></div>${autoPanel?`<div class="assembly-auto-control"><button class="btn secondary assembly-auto-action assembly-keyplc-auto" type="button" ${controlPanelManual?'':'disabled'}>Auto</button></div>`:''}</div>`:'';
 const details=[panel,motorOptions(x),couplingOptions(x),baseplateFrameOptions(x),manifoldOptions(x),tankOptions(x),pumpsetOptions(x)].filter(Boolean).join(''),pumpsetAuto=type==='system'&&x.section==='pumpset'&&!pumpsetManual,badge=manualOverride?'<span class="assembly-manual-badge">Manual</span>':(autoGenerated||pumpsetAuto)?'<span class="assembly-auto-badge">Auto</span>':'';
 const systemPumpsetQty=type==='system'&&x.section==='pumpset',qtyControl=systemPumpsetQty?`<div class="assembly-pumpset-qty-control"><button class="assembly-pumpset-qty-step" type="button" data-pumpset-qty-step="-1" aria-label="Decrease pumpset quantity">−</button><input${locked} type="number" min="1" max="6" step="1" value="${Number.isFinite(Number(x.qty))?Math.min(6,Math.max(1,Number(x.qty))):2}"><button class="assembly-pumpset-qty-step" type="button" data-pumpset-qty-step="1" aria-label="Increase pumpset quantity">+</button></div>`:`<input${locked} type="number" min="0" step="1" value="${Number.isFinite(Number(x.qty))?Number(x.qty):1}">`;return `<div class="assembly-item assembly-item-${esc(x.section||'pumpset')} ${systemPumpsetQty?'system-pumpset-qty-row':''} ${autoGenerated?'auto-generated':''} ${manualOverride?'manual-override':''}" data-assembly-item="${esc(x.id)}"><div class="assembly-bom-main-row"><div class="assembly-bom-model"><label>Model / Item ${badge}</label><input class="assembly-model-value" value="${esc(x.bomDescription||x.model)}" readonly></div><div><label>Qty</label>${qtyControl}</div><div><label>Unit Price</label><input${priceLocked} type="number" min="0" step="0.01" value="${Number(x.unitPrice||0).toFixed(2)}"></div><div><label>Total Price</label><div class="assembly-line-total">${money(Number(x.qty||0)*Number(x.unitPrice||0))}</div></div><button class="btn danger assembly-delete" type="button">Delete</button></div>${details?`<div class="assembly-component-detail-row">${details}</div>`:''}</div>`
}
function renderItems(){
 const box=$('assemblyItems');if(!box)return;box.innerHTML=sections[type].map(section=>{const rows=(current?.items||[]).filter(x=>x.section===section),controls=section==='coupling'?couplingModeControls():'';return `<section class="assembly-section assembly-section-${esc(section)}"><div class="assembly-section-head"><h2>${labels[section]}</h2><span>${rows.length} item${rows.length===1?'':'s'}</span></div>${controls}<div class="assembly-section-body">${rows.map(itemHtml).join('')||'<p class="muted assembly-empty">Empty</p>'}</div></section>`}).join('');
 box.querySelectorAll('.assembly-qty').forEach(input=>{input.oninput=()=>{const row=input.closest('[data-assembly-item]'),item=current?.items?.find(entry=>entry.id===row?.dataset.assemblyItem);if(!item)return;current.description_manual=false;if(input.value!==''){item.qty=type==='system'&&item.section==='pumpset'?Math.min(6,Math.max(1,Number(input.value)||1)):Math.max(0,Number(input.value)||0);if(type==='system'&&item.section==='pumpset'&&Number(input.value)>6)input.value='6';const totalCell=row.querySelector('.assembly-line-total');if(totalCell)totalCell.textContent=money(Number(item.qty||0)*Number(item.unitPrice||0));if(type==='system'&&item.section==='pumpset'){refreshSystemPumpsetQty(item);return}syncQuoteUnitPrice(current);$('assemblyTotal').textContent=money(total());renderQuoteFields();scheduleAutoSave()}};input.onchange=()=>{const row=input.closest('[data-assembly-item]'),item=current?.items?.find(entry=>entry.id===row?.dataset.assemblyItem);if(!item)return;if(input.value===''){item.qty=type==='system'&&item.section==='pumpset'?Number(item.autoQty||2):Math.max(0,Number(item.qty)||0);input.value=String(item.qty)}if(type==='system'&&item.section==='pumpset'){refreshSystemPumpsetQty(item,{render:true});return}syncAutomaticComponents(current);if(!current.description_manual)rebuildDescription(current);localSave();renderItems();renderQuoteFields();renderDescriptionPreview();scheduleAutoSave(100)}});
 box.querySelectorAll('.assembly-price').forEach(input=>input.oninput=()=>{const row=input.closest('[data-assembly-item]'),item=current?.items?.find(entry=>entry.id===row?.dataset.assemblyItem);if(!item||input.readOnly)return;if(input.value!=='')item.unitPrice=Math.max(0,Number(input.value)||0);syncQuoteUnitPrice(current);const totalCell=row.querySelector('.assembly-line-total');if(totalCell)totalCell.textContent=money(Number(item.qty||0)*Number(item.unitPrice||0));$('assemblyTotal').textContent=money(total());renderQuoteFields();scheduleAutoSave()});
 box.querySelectorAll('.assembly-keyplc-type').forEach(select=>select.onchange=()=>{current.description_manual=false;read();const row=select.closest('[data-assembly-item]'),item=current.items.find(x=>x.id===row?.dataset.assemblyItem);updateKeyplcItem(item,select.value);if(!current.description_manual)rebuildDescription(current);current.description=normalizeDescriptionIndentation(current.description);if($('assemblyDescription'))$('assemblyDescription').value=current.description||'';renderDescriptionPreview();localSave();renderItems();renderQuoteFields();scheduleAutoSave(100)});
 box.querySelectorAll('.assembly-keyplc-model').forEach(select=>select.onchange=()=>{current.description_manual=false;read();const row=select.closest('[data-assembly-item]'),item=current.items.find(x=>x.id===row?.dataset.assemblyItem);updateKeyplcItem(item,item?.keyplcData?.enclosure||'indoor',select.value);if(!current.description_manual)rebuildDescription(current);current.description=normalizeDescriptionIndentation(current.description);if($('assemblyDescription'))$('assemblyDescription').value=current.description||'';renderDescriptionPreview();localSave();renderItems();renderQuoteFields();scheduleAutoSave(100)});
 box.querySelectorAll('.assembly-keyplc-auto').forEach(button=>button.onclick=()=>restoreControlPanelAuto(button.closest('[data-assembly-item]')));
 box.querySelectorAll('.assembly-motor-hp,.assembly-motor-pole,.assembly-motor-efficiency').forEach(select=>select.onchange=()=>updateMotorItemFromRow(select.closest('[data-assembly-item]')));
 box.querySelectorAll('.assembly-manifold-material,.assembly-manifold-header').forEach(select=>select.onchange=()=>updateManifoldItemFromRow(select.closest('[data-assembly-item]')));
 box.querySelectorAll('.assembly-manifold-option').forEach(input=>input.onchange=()=>updateManifoldOptionFromRow(input.closest('[data-assembly-item]')));
 box.querySelectorAll('.assembly-manifold-auto').forEach(button=>button.onclick=()=>restoreManifoldAuto(button.closest('[data-assembly-item]')));
 box.querySelectorAll('.assembly-tank-size').forEach(select=>select.onchange=()=>updateTankItemFromRow(select.closest('[data-assembly-item]')));
 box.querySelectorAll('.assembly-tank-auto').forEach(button=>button.onclick=()=>restoreTankAuto(button.closest('[data-assembly-item]')));
 box.querySelectorAll('.assembly-pumpset-auto').forEach(button=>button.onclick=()=>restorePumpsetQtyAuto(button.closest('[data-assembly-item]')));
 box.querySelectorAll('.assembly-pumpset-qty-step').forEach(button=>button.onclick=()=>stepSystemPumpsetQty(button.closest('[data-assembly-item]'),Number(button.dataset.pumpsetQtyStep||0)));
 box.querySelectorAll('.assembly-baseplate-frame').forEach(select=>select.onchange=()=>updateBaseplateItemFromRow(select.closest('[data-assembly-item]')));
 box.querySelectorAll('.assembly-coupling-model,.assembly-coupling-arrangement').forEach(select=>select.onchange=()=>updateCouplingItemFromRow(select.closest('[data-assembly-item]'),select.className));
 box.querySelectorAll('.assembly-coupling-type').forEach(select=>select.onchange=()=>{const row=select.closest('[data-assembly-item]');setCouplingMode(select.value,row?.dataset.assemblyItem||'')});box.querySelectorAll('.assembly-coupling-restore').forEach(button=>button.onclick=restoreCoupling);
 box.querySelectorAll('.assembly-delete').forEach(b=>b.onclick=()=>{const row=b.closest('[data-assembly-item]'),rowId=row?.dataset.assemblyItem||'',item=current.items.find(x=>x.id===rowId);if(item?.section==='coupling'){deleteCouplingItem(rowId);return}read({skipAutomatic:true,skipCouplingDom:true});if(item){current.description_manual=false;current.description=removeDescriptionBlock(current.description,item.description);if(autoComponent(item,'manifold'))current.auto_suppressed={...(current.auto_suppressed||{}),manifold:true};if(autoComponent(item,'tank'))current.auto_suppressed={...(current.auto_suppressed||{}),tank:true}}current.items=current.items.filter(x=>x.id!==rowId);syncAutomaticComponents(current);rebuildDescription(current);if($('assemblyDescription'))$('assemblyDescription').value=current.description||'';renderDescriptionPreview();localSave();renderItems();renderQuoteFields();scheduleAutoSave(100)});
 $('assemblyTotal').textContent=money(total())
}
function renderQuoteFields(){
 updateModelSuggestions();if($('assemblyModelItem'))$('assemblyModelItem').value=current.model_item||'';if($('assemblyQuoteQty'))$('assemblyQuoteQty').value=Number(current.quote_qty||1);if($('assemblyQuoteUnitPrice'))$('assemblyQuoteUnitPrice').value=Number(quoteUnitPrice(current)).toFixed(2);if($('assemblyDisplayCapacity'))$('assemblyDisplayCapacity').checked=!!current.display_capacity;if($('assemblyCapacityValue'))$('assemblyCapacityValue').value=current.capacity_value||'';if($('assemblyCapacityUnit'))$('assemblyCapacityUnit').value=normalizeCapacityUnit(current.capacity_unit);if($('assemblyHeadValue'))$('assemblyHeadValue').value=current.head_value||'';if($('assemblyHeadUnit'))$('assemblyHeadUnit').value=normalizeHeadUnit(current.head_unit);const enabled=!!current.display_capacity;document.querySelectorAll('#assemblyCapacityValue,#assemblyCapacityUnit,#assemblyHeadValue,#assemblyHeadUnit').forEach(control=>control.disabled=!enabled);$('assemblyCapacityRow')?.classList.toggle('capacity-disabled',!enabled)
}
function render(){
 if(!current||current.assembly_type!==type||current.quote_session_id!==quoteSessionId())current=currentSessionDrafts(type)[0]||blank(type);const currentIndex=drafts.findIndex(draft=>draft.id===current.id);current=normalize(current);if(currentIndex>=0)drafts[currentIndex]=current;const qCustomer=quoteCustomerId();if(qCustomer)current.customer_id=qCustomer;syncAutomaticComponents(current);if(!current.description_manual)rebuildDescription(current);current.description=normalizeDescriptionIndentation(current.description);
 $('assemblyBuilderTitle').textContent=type==='system'?'System':'Pumpset';if($('newAssemblyDraft'))$('newAssemblyDraft').style.display=type==='system'?'none':'inline-flex';if($('assemblyToSystem'))$('assemblyToSystem').style.display=type==='pumpset'?'inline-flex':'none';$('assemblyDescription').value=current.description||'';$('assemblyDescriptionLabel').textContent=type==='system'?'System Description':'Pumpset Description';$('assemblyCustomer').innerHTML='<option value="">No quotation customer selected</option>'+customers().map(c=>`<option value="${esc(c.id)}">${esc(c.company)}</option>`).join('');$('assemblyCustomer').value=current.customer_id||'';$('assemblyCustomer').disabled=true;if($('assemblyStatus'))$('assemblyStatus').value=current.status||'draft';$('assemblyNotice').textContent=qCustomer?'Customer is locked to the active Quotation selection. The Coupling, KeyPLC panel, Manifold and Tank are selected automatically from the Pump and Motor BOM, connection data and shut-off head.':'Select a customer in Dashboard or Quotation first. Assembly customer cannot be entered manually.';renderQuoteFields();renderList();renderItems();renderDescriptionPreview()
}
async function open(t){type=t;currentPinned=false;window.KeySuiteApp?.showPage?.('assemblyBuilder');if(!loaded)await load();if(!current||current.assembly_type!==type||current.quote_session_id!==quoteSessionId())current=currentSessionDrafts(type).find(x=>x.status==='draft')||currentSessionDrafts(type)[0]||blank(type);render()}
function routeItem(item={}){const level=String(item.assemblyLevel||item.assembly_level||'').toUpperCase();const section=String(item.assemblySection||item.assembly_section||'').toLowerCase();if(level==='COMPLETE_PUMPSET'||section==='pumpset')return {type:'system',section:'pumpset'};if(['pump','motor','coupling','baseplate'].includes(section))return {type:'pumpset',section};if(['control_panel','manifold','tank'].includes(section))return {type:'system',section};const model=String(item.model||'');if(/^CHC\b/i.test(model))return {type:'system',section:'pumpset'};if(/^ES\b/i.test(model))return {type:'pumpset',section:'pump'};if(/tank|gws/i.test(model+' '+(item.description||'')))return {type:'system',section:'tank'};return null}
async function addItem(item,explicitRoute){
 const route=explicitRoute||routeItem(item);if(!route){alert('This product has no supported System or Pumpset BOM destination.');return false}const customerId=quoteCustomerId();if(!customerId){alert('Select the customer in Dashboard or Quotation first. Assembly follows the Quotation customer and cannot be filled manually.');window.KeySuiteApp?.showPage?.('dashboard');return false}if(blockAssemblyMargin([item]))return false;if(!loaded)await load();type=route.type;const session=quoteSessionId();
 let target=(current&&current.assembly_type===type&&current.customer_id===customerId&&current.quote_session_id===session)?current:null;
 if(!target)target=drafts.find(x=>x.assembly_type===type&&x.status==='draft'&&x.customer_id===customerId&&x.quote_session_id===session)||blank(type);
 // V4.04.19: a deliberate Move to Pumpset replaces the current Pumpset only.
 // System drafts are intentionally excluded and never cleared here.
 if(type==='pumpset'&&route.section==='pump'&&route.replacePumpset){
   const reset=blank('pumpset'),keepId=target.id,keepCreated=target.created_at||reset.created_at;
   Object.keys(target).forEach(key=>delete target[key]);
   Object.assign(target,reset,{id:keepId,created_at:keepCreated,customer_id:customerId,quote_session_id:session});
   currentPinned=false;
 }
 if(type==='system'&&route.section==='pumpset'&&(target.items||[]).some(x=>x.section==='pumpset')&&!currentPinned){
   if(target===current){read();rebuildDescription(target);try{await persist(target)}catch(error){console.warn('Existing System draft saved locally only.',error)}}
   target=blank(type);drafts.unshift(target);
 }
 const targetWasListed=drafts.some(x=>x.id===target.id),before=JSON.parse(JSON.stringify(target));if(!targetWasListed)drafts.unshift(target);target.customer_id=customerId;target.quote_session_id=session;if(type==='system'&&route.section==='pumpset')target.auto_suppressed={manifold:false,tank:false,coupling:false};
 const rawDescription=item.keyplcData?keyplcDescription(item):String(item.description||'').trim(),description=String(rawDescription||'').trimEnd();if(type==='pumpset'&&route.section==='pump'&&!target.model_item)target.model_item=item.model||'';
 let incomingCouplingData=item.couplingData||null;
 if(type==='pumpset'&&route.section==='coupling'){
   incomingCouplingData={...(incomingCouplingData||{}),autoSelected:false,managedByPumpset:false,source:'manual',productSelection:true,_assemblySyncKey:'',_assemblyErrorKey:''};
 }
 const incomingQty=(type==='system'&&route.section==='pumpset')?2:Number(item.qty||1);target.items.push(normalizeItem({id:uid(),section:route.section,model:item.model||'Product',bomDescription:item.bomDescription||item.model||'Product',description,qty:incomingQty,autoQty:(type==='system'&&route.section==='pumpset')?2:undefined,bomManual:false,unitPrice:Number(item.unitPrice||0),pricingSource:item.pricingSource||null,pumpData:item.pumpData||null,tankData:item.tankData||null,keyplcData:item.keyplcData||null,manifoldData:item.manifoldData||null,motorData:item.motorData||null,couplingData:incomingCouplingData,baseplateData:item.baseplateData||null,pumpsetData:item.pumpsetData||null},type));
 const directCapacity={displayCapacity:item.displayCapacity??item.display_capacity,capacityValue:item.capacityValue??item.capacity_value,capacityUnit:item.capacityUnit??item.capacity_unit,headValue:item.headValue??item.head_value,headUnit:item.headUnit??item.head_unit};const directFlow=String(directCapacity.capacityValue??'').trim(),directHead=String(directCapacity.headValue??'').trim();const incomingCapacity=item.pumpsetData?.capacity||((directFlow||directHead)?directCapacity:null)||parseCapacityDescription(description);if(incomingCapacity){const incomingFlow=String(incomingCapacity.capacity_value??incomingCapacity.capacityValue??'').trim(),incomingHead=String(incomingCapacity.head_value??incomingCapacity.headValue??'').trim();if(incomingFlow||incomingHead){copyCapacity(target,incomingCapacity);target.display_capacity=true}}
 current=target;current.description_manual=false;syncAutomaticComponents(current);if(blockAssemblyMargin(current.items)){Object.keys(target).forEach(key=>delete target[key]);Object.assign(target,before);if(!targetWasListed)drafts=drafts.filter(draft=>draft!==target);current=targetWasListed?target:currentSessionDrafts(type)[0]||blank(type);localSave();render();return false}rebuildDescription(current);localSave();window.KeySuiteApp?.showPage?.('assemblyBuilder');render();scheduleAutoSave(100);$('assemblyNotice').textContent=`${item.model||'Product'} routed to ${type==='system'?'System':'Pumpset'} → ${labels[route.section]}. Saving automatically…`;return true;
}
async function toSystem(){
 read();if(type!=='pumpset')return;if(!current?.items?.length){alert('Add at least one component first.');return}if(!current.customer_id){alert('Select a customer for this Pumpset.');return}
 const sourceDraft=current,description=normalizeDescriptionIndentation(String(sourceDraft.description||'')).trim(),unitPrice=quoteUnitPrice(sourceDraft),qty=2;
 const resolvedCouplings=(sourceDraft.items||[]).filter(item=>item.section==='coupling').map(item=>JSON.parse(JSON.stringify(item))),resolvedCoupling=resolvedCouplings.find(isAutoCouplingItem)||resolvedCouplings[0]||null,couplingSnapshot=resolvedCoupling?JSON.parse(JSON.stringify(resolvedCoupling)):null;
 const grouped={model:sourceDraft.model_item||sourceDraft.name||'Pumpset',bomDescription:sourceDraft.model_item||sourceDraft.name||'Pumpset',description,qty,unitPrice,assemblyLevel:'COMPLETE_PUMPSET',assemblySection:'pumpset',section:'pumpset',productFamily:'ASSEMBLY',pricingSource:{product_family:'MANUAL',source_kind:'PUMPSET_TO_SYSTEM',pricing_mode:'assembly',calculated_price:unitPrice,assembly_items:JSON.parse(JSON.stringify(sourceDraft.items||[])),resolved_coupling:couplingSnapshot,resolved_couplings:resolvedCouplings},pumpsetData:{sourceAssemblyId:sourceDraft.id,modelItem:sourceDraft.model_item||'',qty,unitPrice,bom:JSON.parse(JSON.stringify(sourceDraft.items||[])),resolvedCoupling:couplingSnapshot,resolvedCouplings,capacity:{displayCapacity:!!sourceDraft.display_capacity,capacityValue:sourceDraft.capacity_value||'',capacityUnit:sourceDraft.capacity_unit||'m³/hr',headValue:sourceDraft.head_value||'',headUnit:sourceDraft.head_unit||'Mtr'}}};
 if(blockAssemblyMargin(sourceDraft.items||[]))return;const added=await addItem(grouped,{type:'system',section:'pumpset'});if(!added)return;sourceDraft.status='system';try{await persist(sourceDraft)}catch(error){console.warn('Pumpset source status could not be saved.',error)}
 if($('assemblyNotice'))$('assemblyNotice').textContent='Pumpset transferred to System with an automatically selected KeyPLC panel based on Motor HP and quantity.';
}
async function quotePumpsetSelection(items=[],meta={}){
 if(!Array.isArray(items)||!items.length)return false;
 const customerId=quoteCustomerId();if(!customerId){alert('Select a customer before adding the Pumpset to Quotation.');return false}
 const d=blank('pumpset');d.customer_id=customerId;d.quote_session_id=quoteSessionId();d.model_item=String(meta.model||items.find(item=>item.section==='pump')?.model||'ES Pumpset');d.name=d.model_item;d.quote_qty=Math.max(.01,Number(meta.qty||1)||1);
 d.items=items.map(item=>normalizeItem({...item,id:item.id||uid()},'pumpset')).filter(item=>sections.pumpset.includes(item.section));
 const capacity=meta.capacity||null;if(capacity){const flow=String(capacity.capacityValue??capacity.capacity_value??'').trim(),head=String(capacity.headValue??capacity.head_value??'').trim();if(flow||head){copyCapacity(d,capacity);d.display_capacity=true}}
 syncAutomaticComponents(d);const requiredSections=['pump','motor','coupling','baseplate'],missingSections=requiredSections.filter(section=>!(d.items||[]).some(item=>item.section===section));if(missingSections.length){alert(`Unable to create a complete ES Pumpset automatically. Missing: ${missingSections.map(section=>labels[section]||section).join(', ')}. Move to Pumpset to review the selection.`);return false}if(blockMissingPumpsetSourceCosts(d.items||[]))return false;if(blockAssemblyMargin(d.items||[]))return false;rebuildDescription(d);d.quote_unit_price=quoteUnitPrice(d);
 const missing=[];
 const pricingSource={product_family:'MANUAL',source_kind:'PUMPSET_DIRECT_ES',pricing_mode:'quotation',missing_bom_prices:missing,calculated_price:Number(d.quote_unit_price||0),assembly_items:JSON.parse(JSON.stringify(d.items||[]))};
 window.KeySuiteApp?.selectCustomerForQuotation?.(customerId);window.KeySuiteApp?.showPage?.('quotation');
 const pumpData=meta.pumpData||items.find(item=>item.section==='pump'&&item.pumpData)?.pumpData||null;
 const row=window.KeySuiteApp?.addExternalQuoteItem?.({model:d.model_item,qty:d.quote_qty,unitPrice:Number(d.quote_unit_price||0),description:d.description,unit:'set',sourceType:'pumpset',pricingSource,pumpData,displayCapacity:!!d.display_capacity,capacityValue:d.capacity_value||'',capacityUnit:d.capacity_unit||'m³/hr',headValue:d.head_value||'',headUnit:d.head_unit||'Mtr'});
 if(!row){alert('Unable to add the ES Pumpset to Quotation.');return false}
 if(missing.length)alert(`Pumpset added to Quotation. ${missing.length} BOM component price${missing.length===1?' is':'s are'} missing; complete the quotation Unit Price before sealing.`);
 return true;
}
async function toQuotation(){
 read();if(!current?.items?.length){alert('Add at least one component first.');return}if(!current.customer_id){alert('Select a customer for this assembly.');return}if(blockAssemblyMargin(current.items||[]))return;
 window.KeySuiteApp?.selectCustomerForQuotation?.(current.customer_id);const description=normalizeDescriptionIndentation(String(current.description||'')).trim();let unitPrice=0,pricingSource=null;
 if(type==='pumpset'){
   if(blockMissingPumpsetSourceCosts(current.items||[]))return;
   unitPrice=quoteUnitPrice(current);const missing=[];
   pricingSource={product_family:'MANUAL',source_kind:'PUMPSET',pricing_mode:'quotation',source_assembly_id:current.id,missing_bom_prices:missing,calculated_price:unitPrice};
 }else{
   const repriced=window.KeySuitePricing?.priceAssemblyForQuotation?.(current.items)||{error:'Quotation pricing is not available.'};if(repriced.error){alert(repriced.error);return}unitPrice=Number(repriced.total||0);pricingSource=repriced.source;
 }
 current.quote_unit_price=Number(unitPrice||0);window.KeySuiteApp?.showPage?.('quotation');
 const row=window.KeySuiteApp?.addExternalQuoteItem?.({model:current.model_item||current.name||'',qty:Number(current.quote_qty||1),unitPrice:Number(unitPrice||0),description,unit:'set',sourceType:type,pricingSource,displayCapacity:!!current.display_capacity,capacityValue:current.capacity_value||'',capacityUnit:current.capacity_unit||'m³/hr',headValue:current.head_value||'',headUnit:current.head_unit||'Mtr'});if(!row){alert('Unable to add the assembly to Quotation.');return}
 current.status='quoted';dirtyDraftIds.delete(current.id);try{await persist(current)}catch(e){alert(`Assembly quotation was created, but the assembly status could not be saved: ${e.message||e}`)}
 const missing=pricingSource?.missing_bom_prices||[];if(missing.length)alert(`Pumpset added to Quotation. ${missing.length} BOM component price${missing.length===1?' is':'s are'} missing; complete the quotation Unit Price before sealing.`)
}


function refreshPricing(){
 const pricing=window.KeySuitePricing;if(!pricing?.repriceSource)return;
 for(const draft of drafts){
   const customer=customers().find(row=>String(row.id)===String(draft.customer_id));if(!customer)continue;let changed=false;
   for(const item of draft.items||[]){
     if(item.couplingData){item.couplingData._assemblySyncKey='';item.couplingData._assemblyErrorKey=''}
     const source=sourceObject(item);if(!source.product_family)continue;
     const found=pricing.repriceSource(source,'assembly',{customer});if(!found?.calc)continue;
     const nextPrice=Number(found.calc.finalPrice||0);if(Math.abs(nextPrice-Number(item.unitPrice||0))>.001||String(source.pricing_mode||'')!=='assembly')changed=true;
     item.unitPrice=nextPrice;item.pricingSource={...source,...(pricing.sourceSnapshot?.(found)||{}),pricing_mode:'assembly'};
   }
   if(changed){syncQuoteUnitPrice(draft);draft.updated_at=new Date().toISOString();dirtyDraftIds.add(draft.id);autoSaveRetries.set(draft.id,0)}
 }
 localSave();if(current)render();if(dirtyDraftIds.size){clearTimeout(autoSaveTimer);autoSaveTimer=setTimeout(()=>flushAutoSave(),100)}
}
function resetForNewQuotation(){clearTimeout(autoSaveTimer);autoSaveTimer=null;dirtyDraftIds.clear();autoSaveRetries.clear();current=blank(type);currentPinned=false;if(document.getElementById('assemblyBuilder')?.classList.contains('active'))render();else localSave()}
function pageShown(id){if(id==='assemblyBuilder'&&loaded)render()}
window.addEventListener('keysuite-baseplate-costing-changed',()=>{try{refreshPricing()}catch(error){console.warn('Baseplate assembly repricing failed.',error)}});
window.addEventListener('keysuite-manifold-options-changed',event=>{try{if(event?.detail?.source==='assembly'||!current||current.assembly_type!=='system')return;const item=(current.items||[]).find(x=>autoComponent(x,'manifold'));if(!item?.manifoldData)return;item.manifoldData={...(item.manifoldData||{}),options:window.KeySuiteManifold?.normalizeOptions?.(event.detail?.options||{})||{}};current.description_manual=false;syncAutomaticComponents(current);rebuildDescription(current);localSave();if(document.getElementById('assemblyBuilder')?.classList.contains('active'))render();scheduleAutoSave(100)}catch(error){console.warn('Global manifold option sync failed.',error)}});
document.addEventListener('DOMContentLoaded',()=>{
 document.querySelectorAll('[data-assembly-open]').forEach(b=>b.onclick=()=>open(b.dataset.assemblyOpen));$('newAssemblyDraft')?.addEventListener('click',()=>{if(type==='system')return;current=blank(type);currentPinned=false;render()});$('deleteAssemblyDraft')?.addEventListener('click',()=>remove().catch(e=>alert(e.message||e)));$('assemblyToSystem')?.addEventListener('click',()=>toSystem());$('assemblyToQuotation')?.addEventListener('click',()=>toQuotation());
 $('assemblyModelItem')?.addEventListener('input',()=>{current.model_item=$('assemblyModelItem').value.trim();current.name=current.model_item||current.name;scheduleAutoSave()});
 $('assemblyQuoteQty')?.addEventListener('input',()=>{current.quote_qty=Math.max(.01,Number($('assemblyQuoteQty').value)||1);scheduleAutoSave()});
 $('assemblyQuoteUnitPrice')?.addEventListener('input',()=>{const value=$('assemblyQuoteUnitPrice').value;if(value===''){current.quote_price_manual=false;syncQuoteUnitPrice(current);$('assemblyQuoteUnitPrice').value=Number(quoteUnitPrice(current)).toFixed(2)}else{current.quote_price_manual=true;current.quote_unit_price=Math.max(0,Number(value)||0)}scheduleAutoSave()});
 const capacityChanged=()=>{if(!current)return;current.display_capacity=!!$('assemblyDisplayCapacity')?.checked;current.capacity_value=String($('assemblyCapacityValue')?.value||'');current.capacity_unit=normalizeCapacityUnit($('assemblyCapacityUnit')?.value);current.head_value=String($('assemblyHeadValue')?.value||'');current.head_unit=normalizeHeadUnit($('assemblyHeadUnit')?.value);current.description=applyAssemblyCapacity(current.description,current);if(!current.description_manual)rebuildDescription(current);if($('assemblyDescription'))$('assemblyDescription').value=current.description||'';renderDescriptionPreview();renderQuoteFields();scheduleAutoSave(100)};
 $('assemblyDisplayCapacity')?.addEventListener('change',capacityChanged);['assemblyCapacityValue','assemblyCapacityUnit','assemblyHeadValue','assemblyHeadUnit'].forEach(id=>$(id)?.addEventListener(id.includes('Unit')?'change':'input',capacityChanged));

 const main=$('assemblyDescription'),preview=$('assemblyDescriptionPreview'),dlg=$('assemblyDescriptionDialog'),popup=$('assemblyDescriptionPopup');
 const openDescriptionEditor=()=>{if(!dlg||!popup||!main)return;popup.value=main.value;dlg.showModal();setTimeout(()=>popup.focus(),0)};
 preview?.addEventListener('dblclick',openDescriptionEditor);preview?.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openDescriptionEditor()}});
 $('saveAssemblyDescriptionPopup')?.addEventListener('click',()=>{current.description_manual=true;current.description=normalizeDescriptionIndentation(popup.value);main.value=current.description;renderDescriptionPreview();scheduleAutoSave(100)})
});
window.KeySuiteAssembly={open,addItem,routeItem,toSystem,toQuotation,quotePumpsetSelection,pageShown,resetForNewQuotation,refreshPricing,getCurrentPumpsetContext:()=>type==='pumpset'&&current?window.KeySuiteCoupling?.contextFromItems?.(current.items||[])||{}:{},isCurrentCouplingSuppressed:()=>!!current?.auto_suppressed?.coupling,getCurrentCouplingItems:()=>({auto:autoCouplingItems(current).map(item=>JSON.parse(JSON.stringify(item))),manual:manualCouplingItems(current).map(item=>JSON.parse(JSON.stringify(item)))}),formatPumpsetDescription:completedPumpsetDescription,refreshAutomaticPanel:()=>{if(current){syncAutomaticComponents(current);render();scheduleAutoSave(100)}}};
})();
