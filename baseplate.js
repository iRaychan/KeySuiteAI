/* KeySuite V4.09.03.01 - ES Baseplate Product + Pricelist
   Source: 010 - Baseplate (Pricelist) - 260813 - V1.1.xlsx
*/
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=v=>{const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:0};
  const clone=v=>{try{return structuredClone(v)}catch(_){return JSON.parse(JSON.stringify(v))}};
  const C_CHANNELS=['1½" x 3"','2" x 4"','2½" x 5"','3" x 6"','3½" x 7"','3½" x 8"'];
  function normalizeChannel(v){const key=String(v||'').trim().replace(/\s*[xX×]\s*/g,' x ').replace(/\s+/g,' ');return C_CHANNELS.find(row=>row.toLowerCase()===key.toLowerCase())||''}
  const DEFAULTS={
    version:2,
    source:'010 - Baseplate (Pricelist) - 260813 - V1.1.xlsx',
    family:'ES',
    cChannels:{
      '1½" x 3"':{pricePerStock:205,labour:150,misc:50},
      '2" x 4"':{pricePerStock:270,labour:200,misc:100},
      '2½" x 5"':{pricePerStock:390,labour:250,misc:150},
      '3" x 6"':{pricePerStock:540,labour:300,misc:200},
      '3½" x 7"':{pricePerStock:950,labour:350,misc:250},
      '3½" x 8"':{pricePerStock:1080,labour:400,misc:300}
    },
    general:{
      materialRounding:10,wasteFactor:1.33,stockLengthMm:6000,l3Members:2,w1Members:5,
      paintPrice:150,paintCoverage:10,thinnerPrice:100,thinnerCoverage:20,weldingRod:0,weldingRodCoverage:1,
      drillingUnitPrice:5,defaultDrillingQty:22,boltNutUnitPrice:5,defaultBoltNutQty:20,
      oxygenPrice:500,oxygenCoverage:50
    }
  };
  let settings=clone(DEFAULTS),access=null,bound=false,generalEditing=false,channelEditing=false,holdTimer=null,holdTick=null,holdStarted=0,channelHoldTimer=null,channelHoldTick=null,channelHoldStarted=0,lastEsSignature='',productBaseplateFamily='',productRecommendationCollapsed=true;

  function permissionLevel(key){return window.KeySuitePermissions?.level?.(key)||((String(access?.role||'').toLowerCase()==='owner')?'full':'none')}
  const canEdit=()=>permissionLevel('manage_price_list')==='full';
  function normalize(raw){
    raw=raw&&typeof raw==='object'?raw:{};const out=clone(DEFAULTS);out.version=2;out.source=DEFAULTS.source;out.family='ES';
    const channels=raw.cChannels||raw.c_channels||{};
    C_CHANNELS.forEach(size=>{const src=channels[size]||{};['pricePerStock','labour','misc'].forEach(k=>{const v=Number(src[k]??src[k.replace(/[A-Z]/g,m=>'_'+m.toLowerCase())]);if(Number.isFinite(v)&&v>=0)out.cChannels[size][k]=v})});
    const general=raw.general||{};
    Object.keys(out.general).forEach(k=>{const snake=k.replace(/[A-Z]/g,m=>'_'+m.toLowerCase()),v=Number(general[k]??general[snake]);if(Number.isFinite(v)&&v>=0)out.general[k]=v});
    out.general.stockLengthMm=6000;
    if(!(out.general.weldingRodCoverage>0))out.general.weldingRodCoverage=1;
    return out;
  }
  function roundUpTo(value,step){value=number(value);step=number(step);return step>0?Math.ceil(value/step)*step:value}
  function calculateCost(input={}){
    const s=normalize(input.settings||settings),g=s.general,size=normalizeChannel(input.cChannel);
    if(!size)return {available:false,total:0,settings:s};
    const row=s.cChannels[size],l3=Math.max(0,number(input.L3??input.l3)),w1=Math.max(0,number(input.W1??input.w1));
    const drillingQty=Math.max(0,number(input.drillingQty??input.drilling_qty??g.defaultDrillingQty));
    const boltNutQty=Math.max(0,number(input.boltNutQty??input.bolt_nut_qty??g.defaultBoltNutQty));
    const rawMaterial=((l3*g.l3Members+w1*g.w1Members)*g.wasteFactor*row.pricePerStock)/(g.stockLengthMm||1);
    const material=roundUpTo(rawMaterial,g.materialRounding),paint=g.paintCoverage>0?g.paintPrice/g.paintCoverage:0,thinner=g.thinnerCoverage>0?g.thinnerPrice/g.thinnerCoverage:0;
    const welding=g.weldingRodCoverage>0?g.weldingRod/g.weldingRodCoverage:0,drilling=drillingQty*g.drillingUnitPrice,boltNut=boltNutQty*g.boltNutUnitPrice,oxygen=g.oxygenCoverage>0?g.oxygenPrice/g.oxygenCoverage:0;
    const labour=row.labour,misc=row.misc,total=material+paint+thinner+welding+drilling+boltNut+oxygen+labour+misc;
    return {available:true,source:s.source,cChannel:size,L3:l3,W1:w1,drillingQty,boltNutQty,rawMaterial,material,paint,thinner,welding,drilling,boltNut,oxygen,labour,misc,total,settings:s};
  }
  function calculateForPumpset(result,input={}){
    if(!result?.available)return {available:false,message:'A valid ES pumpset result is required.'};
    const cChannel=result.baseplate?.cChannel||input.cChannel,L3=result.dimensions?.longitudinal?.L3,W1=result.dimensions?.width?.W1;
    if(!cChannel||!Number.isFinite(Number(L3))||!Number.isFinite(Number(W1)))return {available:false,message:'Baseplate C-channel, L and W are required.'};
    return calculateCost({cChannel,L3,W1,drillingQty:input.drillingQty,boltNutQty:input.boltNutQty});
  }
  function money(v){return `RM ${number(v).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})}`}
  function message(text,type='info'){const box=$('baseplatePriceMessage');if(!box)return;box.textContent=text||'';box.className=text?`auth-message show ${type}`:'auth-message'}
  function style(){
    if(document.getElementById('keysuiteBaseplateStyle'))return;const el=document.createElement('style');el.id='keysuiteBaseplateStyle';el.textContent=`
      #baseplatePriceList .baseplate-adjustable-title,#baseplatePriceList .baseplate-channel-title{justify-content:flex-start!important;gap:14px!important}
      #baseplatePriceList .baseplate-channel-title>.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:0}
      #baseplatePriceList .baseplate-adjustable-title>div,#baseplatePriceList .baseplate-channel-title>div{flex:0 1 auto!important}
      #baseplatePriceList .baseplate-adjustable-title>.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:0}
      #baseplatePriceList .baseplate-input-grid{display:grid;gap:8px;max-width:900px}
      #baseplatePriceList .baseplate-input-row{display:grid;grid-template-columns:minmax(0,440px) minmax(0,440px);gap:14px;align-items:start}
      #baseplatePriceList .baseplate-input-row.single{grid-template-columns:minmax(0,440px)}
      #baseplatePriceList .baseplate-field{display:grid;grid-template-columns:145px 155px minmax(0,1fr);gap:6px;align-items:center;min-height:40px}
      #baseplatePriceList .baseplate-field label{margin:0;font-weight:700}
      #baseplatePriceList .baseplate-field input{width:100%;box-sizing:border-box}
      #baseplatePriceList .baseplate-field .muted{font-size:11px;line-height:1.25;margin:0}
      #baseplatePriceList .baseplate-adjustable{background:#fff2cc!important}
      #baseplatePriceList .baseplate-general-locked .baseplate-adjustable{background:#f3f4f6!important;color:#6b7280!important;cursor:not-allowed}
      #baseplatePriceList .baseplate-cost-table .currency-price-input{width:132px;min-width:132px;display:inline-flex}
      #baseplatePriceList .baseplate-cost-table .currency-price-input input{width:92px;min-width:92px;max-width:92px}
      #baseplatePriceList .baseplate-channel-value{display:inline-block;min-width:112px;font-variant-numeric:tabular-nums;font-weight:700;color:#334155}
      #baseplatePriceList .baseplate-channel-editing .baseplate-adjustable{background:#fff2cc!important}
      #baseplateUnlockChannels.holding,#baseplateUnlockGeneral.holding{background:#fff7ed;border-color:#f59e0b;color:#92400e}
      #baseplatePriceList .baseplate-calculator-grid,#productBaseplate .baseplate-calculator-grid{display:grid;grid-template-columns:repeat(5,minmax(130px,1fr));gap:12px;align-items:end}
      #productBaseplate .baseplate-product-editable-grid{grid-template-columns:repeat(3,minmax(170px,240px));justify-content:start}
      #productBaseplate .baseplate-es-reference-grid{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:12px;align-items:end;margin-bottom:14px}
      #productBaseplate .baseplate-es-reference-grid>div{min-width:0}
      #productBaseplate .baseplate-es-reference-grid label{display:block;margin-bottom:5px;font-weight:800;color:#17365d}
      #productBaseplate .baseplate-es-reference-grid select{width:100%;box-sizing:border-box}
      #productBaseplate .baseplate-fixed-title{margin-top:18px;margin-bottom:8px;font-weight:800;color:#17365d}
      #productBaseplate .baseplate-fixed-grid{display:grid;grid-template-columns:repeat(4,minmax(150px,210px));gap:12px;align-items:end}
      #productBaseplate .baseplate-fixed-grid input[readonly]{background:#f3f4f6!important;color:#475569!important;cursor:not-allowed}
      #productBaseplate .baseplate-recommendation{border:1px solid #dbe4ee;border-radius:10px;padding:14px;background:#f8fbff}
      #productBaseplate .baseplate-recommendation-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:start}
      #productBaseplate .baseplate-recommendation-current{padding:10px 12px;border-radius:8px;background:#eaf2f8;color:#17365d;font-weight:800;margin:0}
      #productBaseplate .baseplate-recommendation-toggle{min-width:42px;height:42px;padding:0 10px}
      #productBaseplate .baseplate-recommendation-body{margin-top:12px}
      #productBaseplate .baseplate-recommendation.is-collapsed .baseplate-recommendation-body{display:none}
      #productBaseplate .baseplate-recommendation-grid{display:grid;grid-template-columns:repeat(2,minmax(260px,1fr));gap:16px}
      #productBaseplate .baseplate-recommendation-grid h3{margin:0 0 7px;font-size:14px;color:#17365d}
      #productBaseplate .baseplate-recommendation-table{width:100%;border-collapse:collapse;background:#fff}
      #productBaseplate .baseplate-recommendation-table td{padding:7px 9px;border-bottom:1px solid #e5e7eb}
      #productBaseplate .baseplate-recommendation-table td:last-child{text-align:right;font-weight:800}
      #productBaseplate .baseplate-recommendation-table tr.is-recommended td{background:#C1F0C8!important}
      #baseplatePriceList .baseplate-calc-modified,#productBaseplate .baseplate-calc-modified{background:#ffd6e7!important;border-color:#e879a7!important;box-shadow:0 0 0 1px rgba(232,121,167,.16)}
      #baseplatePriceList .baseplate-total,#productBaseplate .baseplate-total{font-size:20px;font-weight:800;color:#17365d}
      #baseplatePriceList .baseplate-breakdown td:last-child,#baseplatePriceList .baseplate-breakdown th:last-child,#productBaseplate .baseplate-breakdown td:last-child,#productBaseplate .baseplate-breakdown th:last-child{text-align:right}
      @media(max-width:1050px){#baseplatePriceList .baseplate-input-row{grid-template-columns:minmax(0,440px)}#baseplatePriceList .baseplate-field{grid-template-columns:145px 155px minmax(0,1fr)}#productBaseplate .baseplate-fixed-grid{grid-template-columns:repeat(2,minmax(150px,240px))}}
      @media(max-width:900px){#baseplatePriceList .baseplate-calculator-grid,#productBaseplate .baseplate-calculator-grid{grid-template-columns:repeat(2,minmax(150px,1fr))}#productBaseplate .baseplate-es-reference-grid{grid-template-columns:repeat(2,minmax(150px,1fr))}#productBaseplate .baseplate-product-editable-grid{grid-template-columns:repeat(2,minmax(150px,240px))}#productBaseplate .baseplate-recommendation-grid{grid-template-columns:1fr}}
      @media(max-width:620px){#baseplatePriceList .baseplate-field{grid-template-columns:1fr}#baseplatePriceList .baseplate-calculator-grid,#productBaseplate .baseplate-calculator-grid,#productBaseplate .baseplate-es-reference-grid,#productBaseplate .baseplate-product-editable-grid,#productBaseplate .baseplate-fixed-grid{grid-template-columns:1fr}}
    `;(document.head||document.documentElement).appendChild(el)
  }
  function channelCell(size,field){
    const value=settings.cChannels[size][field];
    if(!channelEditing)return `<span class="baseplate-channel-value">${money(value)}</span>`;
    return `<div class="currency-price-input" data-ks-price-group="1"><span>RM</span><input class="baseplate-adjustable" data-ks-price-field="1" data-bp-channel-field="${field}" type="number" min="0" step="0.01" value="${number(value).toFixed(2)}"></div>`;
  }
  function channelRows(){return C_CHANNELS.map(size=>`<tr data-bp-channel="${esc(size)}"><td><b>${esc(size)}</b></td><td>${channelCell(size,'pricePerStock')}</td><td>${channelCell(size,'labour')}</td><td>${channelCell(size,'misc')}</td></tr>`).join('')}
  const FIELD={
    materialRounding:['Rounding','RM','Round C-channel material upward'],wasteFactor:['Waste Factor','Multiplier','C-channel material allowance'],l3Members:['Length','pcs','Longitudinal C-channel pieces'],w1Members:['Width','pcs','Cross / width C-channel pieces'],
    paintPrice:['Paint Price','RM / tin','Current paint purchase price'],paintCoverage:['Paint Coverage','baseplates / tin','Coverage per tin'],thinnerPrice:['Thinner Price','RM / tin','Current thinner purchase price'],thinnerCoverage:['Thinner Coverage','baseplates / tin','Coverage per tin'],
    weldingRod:['Welding Rod Price','RM / Ctn (20kg)','Current welding rod purchase price'],weldingRodCoverage:['Welding Rod Coverage','Baseplate / Ctn (20kg)','Coverage per carton'],drillingUnitPrice:['Drilling Unit Price','RM / hole','Current drilling rate'],defaultDrillingQty:['Default Drilling Qty','holes / baseplate','Default fabrication quantity'],
    boltNutUnitPrice:['Bolt & Nut Unit Price','RM / set','Current bolt & nut rate'],defaultBoltNutQty:['Default Bolt & Nut Qty','sets / baseplate','Default fabrication quantity'],oxygenPrice:['Oxygen Price','RM / cylinder','Current oxygen purchase price'],oxygenCoverage:['Oxygen Coverage','baseplates / cylinder','Coverage per cylinder']
  };
  const GENERAL_ROWS=[['materialRounding'],['wasteFactor'],['l3Members','w1Members'],['paintPrice','paintCoverage'],['thinnerPrice','thinnerCoverage'],['weldingRod','weldingRodCoverage'],['drillingUnitPrice','defaultDrillingQty'],['boltNutUnitPrice','defaultBoltNutQty'],['oxygenPrice','oxygenCoverage']];
  function generalField(key){const [label,unit,purpose]=FIELD[key],moneyFields=new Set(['paintPrice','thinnerPrice','weldingRod','drillingUnitPrice','boltNutUnitPrice','oxygenPrice']),isMoney=moneyFields.has(key),control=isMoney?`<div class="currency-price-input baseplate-general-price" data-ks-price-group="1"><span>RM</span><input id="bp_${key}" class="baseplate-adjustable" data-ks-price-field="1" data-bp-general="${key}" type="number" min="0" step="any" value="${settings.general[key]}"></div>`:`<input id="bp_${key}" class="baseplate-adjustable" data-bp-general="${key}" type="number" min="0" step="any" value="${settings.general[key]}">`;return `<div class="baseplate-field"><label for="bp_${key}">${esc(label)}</label>${control}<div class="muted">${esc(unit)} · ${esc(purpose)}</div></div>`}
  function generalRows(){return GENERAL_ROWS.map(keys=>`<div class="baseplate-input-row ${keys.length===1?'single':''}">${keys.map(generalField).join('')}</div>`).join('')}
  function setChannelEditing(on){channelEditing=!!on&&canEdit();renderChannels()}
  function renderChannels(){
    if(!canEdit())channelEditing=false;
    const rows=$('baseplateChannelRows'),btn=$('baseplateUnlockChannels');
    if(rows){rows.innerHTML=channelRows();rows.closest('.baseplate-cost-table')?.classList.toggle('baseplate-channel-editing',channelEditing)}
    if(btn){btn.disabled=!canEdit();btn.textContent=channelEditing?'Editing Enabled':'Hold 3s to Edit'}
  }
  function stopChannelHold(reset=true){if(channelHoldTimer)clearTimeout(channelHoldTimer);if(channelHoldTick)clearInterval(channelHoldTick);channelHoldTimer=channelHoldTick=null;const b=$('baseplateUnlockChannels');if(b){b.classList.remove('holding');if(reset&&!channelEditing)b.textContent='Hold 3s to Edit'}}
  function startChannelHold(e){if(!canEdit()||channelEditing)return;if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();stopChannelHold(false);channelHoldStarted=Date.now();const b=$('baseplateUnlockChannels');b?.classList.add('holding');const tick=()=>{const left=Math.max(0,3000-(Date.now()-channelHoldStarted));if(b)b.textContent=`Edit in ${(left/1000).toFixed(1)}s`};tick();channelHoldTick=setInterval(tick,100);channelHoldTimer=setTimeout(()=>{stopChannelHold(false);setChannelEditing(true);message('C-Channel Costing unlocked. Save Baseplate Costing when finished.','info')},3000)}
  function setGeneralEditing(on){generalEditing=!!on&&canEdit();renderGeneralLock()}
  function renderGeneralLock(){
    const host=$('baseplateGeneralInputs'),btn=$('baseplateUnlockGeneral'),editable=canEdit()&&generalEditing;if(host)host.classList.toggle('baseplate-general-locked',!editable);
    document.querySelectorAll('[data-bp-general]').forEach(input=>{input.readOnly=!editable;input.disabled=!canEdit()});if(btn){btn.disabled=!canEdit();btn.textContent=editable?'Editing Enabled':'Hold 3s to Edit'}
  }
  function stopHold(reset=true){if(holdTimer)clearTimeout(holdTimer);if(holdTick)clearInterval(holdTick);holdTimer=holdTick=null;const b=$('baseplateUnlockGeneral');if(b){b.classList.remove('holding');if(reset&&!generalEditing)b.textContent='Hold 3s to Edit'}}
  function startHold(e){if(!canEdit()||generalEditing)return;if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();stopHold(false);holdStarted=Date.now();const b=$('baseplateUnlockGeneral');b?.classList.add('holding');const tick=()=>{const left=Math.max(0,3000-(Date.now()-holdStarted));if(b)b.textContent=`Edit in ${(left/1000).toFixed(1)}s`};tick();holdTick=setInterval(tick,100);holdTimer=setTimeout(()=>{stopHold(false);setGeneralEditing(true);message('General Adjustable Inputs unlocked. Save Baseplate Costing when finished.','info')},3000)}
  function esResult(){const r=window.KEYSUITE_LAST_ES_MOTOR_BASEPLATE;return r?.available?r:null}
  function esSignature(r){if(!r)return '';return [r.pump?.model||r.model||'',r.motor?.kw||'',r.baseplate?.cChannel||'',r.dimensions?.longitudinal?.L3||'',r.dimensions?.width?.W1||'',settings.general.defaultDrillingQty,settings.general.defaultBoltNutQty].join('|')}
  const CALC_IDS=['baseplateCalcChannel','baseplateCalcL3','baseplateCalcW1','baseplateCalcDrillingQty','baseplateCalcBoltQty'];
  function setCalcDefault(el,value){if(!el)return;el.value=value;el.dataset.defaultValue=String(value??'');delete el.dataset.touched;el.classList.remove('baseplate-calc-modified')}
  function updateCalculatorModifiedState(){CALC_IDS.forEach(id=>{const el=$(id);if(!el)return;const baseline=String(el.dataset.defaultValue??''),current=String(el.value??'');let modified=false;if(baseline!==''){if(el.tagName==='SELECT')modified=current!==baseline;else{const a=Number(current),b=Number(baseline);modified=!(Number.isFinite(a)&&Number.isFinite(b))||Math.abs(a-b)>1e-9}}el.classList.toggle('baseplate-calc-modified',modified)})}
  function clearCalculator(){CALC_IDS.forEach(id=>{const el=$(id);if(el){el.value='';el.dataset.defaultValue='';delete el.dataset.touched;el.classList.remove('baseplate-calc-modified')}});lastEsSignature=''}
  function populateCalculator(r,{force=false}={}){
    if(!r?.available){clearCalculator();return}
    const sig=esSignature(r);if(!force&&sig===lastEsSignature)return;lastEsSignature=sig;
    const values={baseplateCalcChannel:normalizeChannel(r.baseplate?.cChannel)||'',baseplateCalcL3:r.dimensions?.longitudinal?.L3??'',baseplateCalcW1:r.dimensions?.width?.W1??'',baseplateCalcDrillingQty:settings.general.defaultDrillingQty,baseplateCalcBoltQty:settings.general.defaultBoltNutQty};
    Object.entries(values).forEach(([id,value])=>setCalcDefault($(id),value));updateCalculatorModifiedState();
  }
  function renderCalculatorState(){
    const r=esResult(),content=$('baseplateCalcContent'),empty=$('baseplateCalcEmpty'),help=$('baseplateCalcHelp');if(content)content.hidden=!r;if(empty)empty.hidden=!!r;if(help)help.textContent=r?'Inputs are populated from the selected ES pumpset. You may modify them for costing preview.':'Select an ES pump first. The calculator inputs will populate from the selected ES pumpset.';
    if(r)populateCalculator(r);else clearCalculator();updateCalculator();
  }
  const PRODUCT_CALC_IDS=['productBaseplateCalcChannel','productBaseplateCalcL3','productBaseplateCalcW1'];
  function setProductCalcDefault(el,value){if(!el)return;el.value=value;el.dataset.defaultValue=String(value??'');delete el.dataset.touched;el.classList.remove('baseplate-calc-modified')}
  function updateProductCalculatorModifiedState(){PRODUCT_CALC_IDS.forEach(id=>{const el=$(id);if(!el)return;const baseline=String(el.dataset.defaultValue??''),current=String(el.value??'');let modified=false;if(baseline!==''){if(el.tagName==='SELECT')modified=current!==baseline;else{const a=Number(current),b=Number(baseline);modified=!(Number.isFinite(a)&&Number.isFinite(b))||Math.abs(a-b)>1e-9}}el.classList.toggle('baseplate-calc-modified',modified)})}
  function setProductFixedFields(){
    const values={productBaseplateCalcLengthQty:settings.general.l3Members,productBaseplateCalcWidthQty:settings.general.w1Members,productBaseplateCalcDrillingQty:settings.general.defaultDrillingQty,productBaseplateCalcBoltQty:settings.general.defaultBoltNutQty};
    Object.entries(values).forEach(([id,value])=>{const el=$(id);if(el)el.value=number(value)});
  }
  function clearProductCalculator(){PRODUCT_CALC_IDS.forEach(id=>{const el=$(id);if(el){el.value='';el.dataset.defaultValue='';delete el.dataset.touched;el.classList.remove('baseplate-calc-modified')}});setProductFixedFields()}
  function esReferenceData(){return window.KeySuiteMotorBaseplateV40205?.data||window.KeySuiteMotorBaseplateDataV40205||{}}
  function esDimensionMap(){return esReferenceData()?.es?.dimensions||{}}
  function normalizeEsReferenceModel(value){return String(value||'').replace(/^ES\s+/i,'').trim()}
  function naturalModelSort(a,b){return String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'})}
  function esReferenceModels(){
    const dims=esDimensionMap(),fromDims=Object.keys(dims||{}),fromSecure=(window.KEYSUITE_SECURE_DATA?.esProducts||[]).map(row=>normalizeEsReferenceModel(row.model)).filter(Boolean);
    const hasDims=fromDims.length>0,rows=[...new Set([...fromDims,...fromSecure])].filter(model=>!hasDims||dims[model]||dims[normalizeEsReferenceModel(model)]).sort(naturalModelSort);
    return rows;
  }
  function esSeriesFromModel(model){const hit=normalizeEsReferenceModel(model).match(/^(\d+)/);return hit?hit[1]:''}
  function esReferenceSeries(){return [...new Set(esReferenceModels().map(esSeriesFromModel).filter(Boolean))].sort((a,b)=>Number(a)-Number(b))}
  function motorHpValuesForPole(pole){
    pole=Number(pole)||2;const secure=(window.KEYSUITE_SECURE_DATA?.motorProducts||[]).filter(row=>Number(row.pole)===pole).map(row=>number(row.hp)).filter(hp=>hp>0);
    if(secure.length)return [...new Set(secure)].sort((a,b)=>a-b);
    const data=esReferenceData()?.motor||{},tables=data.tables||{},fromTables=[];
    Object.entries(tables).forEach(([key,rows])=>{if(new RegExp(`^${pole}Pole\\b`,'i').test(key))(rows||[]).forEach(row=>{const hp=number(row.hp);if(hp>0)fromTables.push(hp)})});
    const fallback=(data.hpMaster||[]).map(row=>number(row.hp)).filter(hp=>hp>0);
    return [...new Set(fromTables.length?fromTables:fallback)].sort((a,b)=>a-b);
  }
  function fillSelect(select,rows,current,placeholder,formatter){
    if(!select)return '';current=String(current??'');select.innerHTML=`<option value="">${esc(placeholder)}</option>`+rows.map(row=>{const value=String(row),label=formatter?formatter(row):value;return `<option value="${esc(value)}" ${value===current?'selected':''}>${esc(label)}</option>`}).join('');
    if(current&&rows.map(String).includes(current))select.value=current;else select.value='';return select.value;
  }
  function renderEsReferenceSelectors({seriesChanged=false,poleChanged=false}={}){
    const seriesEl=$('productBaseplateEsSeries'),modelEl=$('productBaseplateEsModel'),hpEl=$('productBaseplateEsMotorHp'),poleEl=$('productBaseplateEsPole');if(!seriesEl||!modelEl||!hpEl||!poleEl)return;
    let pole=Number(poleEl.value)||2;if(!['2','4'].includes(String(pole)))pole=2;poleEl.value=String(pole);
    const oldSeries=String(seriesEl.value||''),oldModel=seriesChanged?'':normalizeEsReferenceModel(modelEl.value),oldHp=String(hpEl.value||'');
    const series=fillSelect(seriesEl,esReferenceSeries(),oldSeries,'Select',v=>v);
    const models=series?esReferenceModels().filter(model=>esSeriesFromModel(model)===series):[];
    fillSelect(modelEl,models,oldModel,series?'Select Pump Model':'Select Series First',model=>`ES ${model}`);modelEl.disabled=!series;
    const hps=motorHpValuesForPole(pole),hpAvailable=!oldHp||hps.map(String).includes(oldHp);
    fillSelect(hpEl,hps,oldHp,'Select',hp=>`${Number.isInteger(hp)?hp:Math.round(hp*100)/100} HP`);
    if(oldHp&&!hpAvailable){
      const opt=document.createElement('option');opt.value=oldHp;opt.textContent=`${oldHp} HP (not available for ${pole} Pole)`;opt.selected=true;opt.dataset.unavailable='1';hpEl.appendChild(opt);hpEl.value=oldHp;
    }
    if(seriesChanged)clearProductCalculator();
    renderProductRecommendation();
  }
  function productReferenceSelection(){
    const model=normalizeEsReferenceModel($('productBaseplateEsModel')?.value),hp=number($('productBaseplateEsMotorHp')?.value),pole=number($('productBaseplateEsPole')?.value)||2,dims=esDimensionMap(),dimension=dims[model]||null,shaft=number(dimension?.shaft);
    return {series:esSeriesFromModel(model)||String($('productBaseplateEsSeries')?.value||''),model,hp,pole,shaft,dimension};
  }
  function recommendationFor(shaft,hp){
    shaft=number(shaft);hp=number(hp);if(!(shaft>0)||!(hp>0))return null;
    if(hp>420)return {shaft,hp,size:'',rule:'manual'};
    if(shaft<=42){
      if(hp<=10)return {shaft,hp,size:'1½" x 3"',rule:'le42-10'};
      if(hp<=30)return {shaft,hp,size:'2" x 4"',rule:'le42-30'};
      if(hp<=75)return {shaft,hp,size:'2½" x 5"',rule:'le42-75'};
      if(hp<=175)return {shaft,hp,size:'3" x 6"',rule:'le42-175'};
      if(hp<=270)return {shaft,hp,size:'3½" x 7"',rule:'le42-270'};
      return {shaft,hp,size:'3½" x 8"',rule:'le42-420'};
    }
    if(hp<=30)return {shaft,hp,size:'2½" x 5"',rule:'gt42-30'};
    if(hp<=175)return {shaft,hp,size:'3" x 6"',rule:'gt42-175'};
    if(hp<=270)return {shaft,hp,size:'3½" x 7"',rule:'gt42-270'};
    return {shaft,hp,size:'3½" x 8"',rule:'gt42-420'};
  }

  function productReferencePumpsetResult(){
    const ref=productReferenceSelection();if(!ref.model||!(ref.hp>0))return null;
    const hpEl=$('productBaseplateEsMotorHp');if(hpEl?.selectedOptions?.[0]?.dataset?.unavailable==='1')return {available:false,code:'MOTOR_HP_NOT_AVAILABLE',message:`${ref.hp}HP is not available for ${ref.pole} Pole.`};
    const engine=window.KeySuiteMotorBaseplateV40205?.calculateEsPumpset||window.KEYSUITE_ES_PUMPSET_DIMENSION;if(typeof engine!=='function')return null;
    let last=null;for(const efficiencyClass of ['IE3','IE1','IE2','IE4','IE5']){try{const result=engine({model:ref.model,motorHp:ref.hp,pole:ref.pole,efficiencyClass,voltage:415,phase:'3Ph',hz:50});last=result;if(result?.available)return result}catch(_){}}
    return last;
  }
  function autoFillProductBaseplate(){
    const ref=productReferenceSelection();
    if(!ref.model||!(ref.hp>0)){clearProductCalculator();updateProductCalculator();return null}
    const result=productReferencePumpsetResult();
    if(!result?.available){clearProductCalculator();updateProductCalculator();return result}
    setProductCalcDefault($('productBaseplateCalcChannel'),normalizeChannel(result.baseplate?.cChannel)||'');
    setProductCalcDefault($('productBaseplateCalcL3'),result.dimensions?.longitudinal?.L3??'');
    setProductCalcDefault($('productBaseplateCalcW1'),result.dimensions?.width?.W1??'');
    updateProductCalculator();return result;
  }
  function handleProductReferenceChange(options={}){
    if(options.seriesChanged||options.poleChanged)renderEsReferenceSelectors(options);else renderProductRecommendation();
    const result=autoFillProductBaseplate();
    if(result&&!result.available){const host=$('productBaseplateRecommendationCurrent'),ref=productReferenceSelection();if(host&&ref.model&&ref.hp>0)host.textContent=`ES ${ref.model} · Motor ${ref.hp} HP · ${ref.pole} Pole → ${result.message||'Automatic Baseplate dimensions are unavailable. Please select Size / Length / Width manually.'}`}
  }
  function renderProductRecommendation(){
    document.querySelectorAll('#productBaseplate [data-bp-rule]').forEach(row=>row.classList.remove('is-recommended'));
    const host=$('productBaseplateRecommendationCurrent');if(!host)return;const ref=productReferenceSelection();
    if(!ref.model){host.textContent='Select Pump Series and Pump Model, then choose Motor HP to show the recommended Baseplate Size.';return}
    if(!(ref.shaft>0)){host.textContent=`ES ${ref.model}: pump shaft data is unavailable. Select the Baseplate Size manually.`;return}
    if(!(ref.hp>0)){host.textContent=`ES ${ref.model} · Shaft ${ref.shaft} mm · ${ref.pole} Pole → Select Motor HP to show the recommended Baseplate Size.`;return}
    const rec=recommendationFor(ref.shaft,ref.hp),hp=Number.isInteger(ref.hp)?String(ref.hp):String(Math.round(ref.hp*10)/10);
    if(!rec?.size){host.textContent=`ES ${ref.model} · Shaft ${ref.shaft} mm · Motor ${hp} HP · ${ref.pole} Pole → Manual Selection Required (above 420 HP).`;return}
    host.textContent=`ES ${ref.model} · Shaft ${ref.shaft} mm · Motor ${hp} HP · ${ref.pole} Pole → Recommended Baseplate: ${rec.size.replace(/ x /g,' × ')}`;
    document.querySelector(`#productBaseplate [data-bp-rule="${rec.rule}"]`)?.classList.add('is-recommended');
  }
  function setProductRecommendationCollapsed(collapsed){
    productRecommendationCollapsed=!!collapsed;const panel=$('productBaseplateRecommendation'),toggle=$('productBaseplateRecommendationToggle');
    panel?.classList.toggle('is-collapsed',productRecommendationCollapsed);
    if(toggle){toggle.textContent=productRecommendationCollapsed?'▼':'▲';toggle.setAttribute('aria-expanded',productRecommendationCollapsed?'false':'true');toggle.title=productRecommendationCollapsed?'Expand recommendation guide':'Collapse recommendation guide'}
  }
  function productBaseplateConfiguration(){
    return {cChannel:normalizeChannel($('productBaseplateCalcChannel')?.value),L3:number($('productBaseplateCalcL3')?.value),W1:number($('productBaseplateCalcW1')?.value),drillingQty:number(settings.general.defaultDrillingQty),boltNutQty:number(settings.general.defaultBoltNutQty)};
  }
  function quoteProductBaseplate(){
    if(!productCalcReady()){alert('Select the Baseplate Size and enter both Length and Width before adding the ES Baseplate to Quotation.');return}
    if(!window.KeySuiteApp?.ensureQuotationPricingContext?.('add the ES Baseplate to the quotation'))return;
    const config=productBaseplateConfiguration(),found=window.KeySuitePricing?.findBaseplatePrice?.(config,{pricingMode:'quotation'});
    if(!found){alert('No ES Baseplate quotation price is available for the selected customer. Check the Baseplate costing and Pricing Category.');return}
    if(window.KeySuitePricing?.ensureQuoteableCalculation&&!window.KeySuitePricing.ensureQuoteableCalculation(found.calc,'ES Baseplate'))return;
    const channel=config.cChannel.replace(/ x /g,' × '),length=Number.isInteger(config.L3)?config.L3:Math.round(config.L3*10)/10,width=Number.isInteger(config.W1)?config.W1:Math.round(config.W1*10)/10;
    const item={model:`ES Baseplate ${channel}`,description:`ES Baseplate\nC-Channel: ${channel}\nBaseplate Size: ${length} mm (L) × ${width} mm (W)`,qty:1,unitPrice:Number(found.calc?.finalPrice||0),pricingSource:window.KeySuitePricing?.sourceSnapshot?.(found)||{},productFamily:'BASEPLATE'};
    const row=window.KeySuiteApp?.addExternalQuoteItem?.(item);if(row)window.KeySuiteApp?.showPage?.('quotation');
  }
  function productCalcReady(){
    const channel=normalizeChannel($('productBaseplateCalcChannel')?.value),L3=number($('productBaseplateCalcL3')?.value),W1=number($('productBaseplateCalcW1')?.value);
    return !!channel&&L3>0&&W1>0;
  }
  function initStandaloneProductCalculator(){setProductFixedFields();renderEsReferenceSelectors();renderProductRecommendation();autoFillProductBaseplate()}
  function updateProductCalculator(){
    updateProductCalculatorModifiedState();setProductFixedFields();
    const ready=productCalcReady();if($('productBaseplateQuote'))$('productBaseplateQuote').disabled=!ready;
    if(!ready){if($('productBaseplateCalcBreakdown'))$('productBaseplateCalcBreakdown').innerHTML='';if($('productBaseplateCalcTotal'))$('productBaseplateCalcTotal').textContent='—';return}
    const calc=calculateCost({settings,cChannel:$('productBaseplateCalcChannel')?.value,L3:$('productBaseplateCalcL3')?.value,W1:$('productBaseplateCalcW1')?.value,drillingQty:settings.general.defaultDrillingQty,boltNutQty:settings.general.defaultBoltNutQty});
    if(!calc.available){if($('productBaseplateCalcBreakdown'))$('productBaseplateCalcBreakdown').innerHTML='';if($('productBaseplateCalcTotal'))$('productBaseplateCalcTotal').textContent='—';return}
    const host=$('productBaseplateCalcBreakdown');if(host)host.innerHTML=[['C-Channel Material',calc.material],['Paint',calc.paint],['Thinner',calc.thinner],['Welding Rod',calc.welding],['Drilling',calc.drilling],['Bolt & Nut',calc.boltNut],['Oxygen',calc.oxygen],['Labour',calc.labour],['MISC',calc.misc]].map(([label,value])=>`<tr><td>${esc(label)}</td><td>${money(value)}</td></tr>`).join('');if($('productBaseplateCalcTotal'))$('productBaseplateCalcTotal').textContent=money(calc.total)
  }
  function showProductBaseplateFamily(family){productBaseplateFamily=String(family||'').toUpperCase()==='ES'?'ES':'';if(productBaseplateFamily==='ES')setProductRecommendationCollapsed(true);renderProductCalculatorState()}
  function renderProductCalculatorState(){
    const chooser=$('productBaseplateFamilyChooser'),panel=$('productBaseplateEsPanel'),total=$('productBaseplateCalcTotal'),isEs=productBaseplateFamily==='ES';
    if(chooser)chooser.hidden=isEs;if(panel)panel.hidden=!isEs;if(total)total.hidden=!isEs;
    if(!isEs)return;
    const select=$('productBaseplateCalcChannel');if(select&&!select.options.length)select.innerHTML='<option value="">Select</option>'+C_CHANNELS.map(x=>`<option value="${esc(x)}">${esc(x.replace(/ x /g,' × '))}</option>`).join('');
    const help=$('productBaseplateCalcHelp');if(help)help.textContent='Select Pump Series / Pump Model / Motor HP / Pole. KeySuite fills Baseplate Size / Length / Width automatically; manual changes are highlighted. ES fabrication quantities stay fixed.';
    initStandaloneProductCalculator();updateProductCalculator();
  }
  function render(){
    style();renderChannels();const gen=$('baseplateGeneralInputs');if(gen)gen.innerHTML=generalRows();
    const select=$('baseplateCalcChannel');if(select){const previous=select.value;select.innerHTML='<option value="">Select</option>'+C_CHANNELS.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');if(C_CHANNELS.includes(previous))select.value=previous}
    document.querySelectorAll('[data-baseplate-save]').forEach(save=>save.disabled=!canEdit());renderGeneralLock();renderCalculatorState();renderProductCalculatorState();
  }
  function readUi(){const next=clone(settings);document.querySelectorAll('[data-bp-channel]').forEach(tr=>{const size=tr.dataset.bpChannel;tr.querySelectorAll('[data-bp-channel-field]').forEach(input=>{next.cChannels[size][input.dataset.bpChannelField]=Math.max(0,number(input.value))})});document.querySelectorAll('[data-bp-general]').forEach(input=>{next.general[input.dataset.bpGeneral]=Math.max(0,number(input.value))});return normalize(next)}
  function updateCalculator(){
    updateCalculatorModifiedState();
    if(!esResult()){if($('baseplateCalcBreakdown'))$('baseplateCalcBreakdown').innerHTML='';if($('baseplateCalcTotal'))$('baseplateCalcTotal').textContent='—';return}
    const preview=readUi(),calc=calculateCost({settings:preview,cChannel:$('baseplateCalcChannel')?.value,L3:$('baseplateCalcL3')?.value,W1:$('baseplateCalcW1')?.value,drillingQty:$('baseplateCalcDrillingQty')?.value,boltNutQty:$('baseplateCalcBoltQty')?.value});
    if(!calc.available){if($('baseplateCalcBreakdown'))$('baseplateCalcBreakdown').innerHTML='';if($('baseplateCalcTotal'))$('baseplateCalcTotal').textContent='—';return}
    const host=$('baseplateCalcBreakdown');if(host)host.innerHTML=[['C-Channel Material',calc.material],['Paint',calc.paint],['Thinner',calc.thinner],['Welding Rod',calc.welding],['Drilling',calc.drilling],['Bolt & Nut',calc.boltNut],['Oxygen',calc.oxygen],['Labour',calc.labour],['MISC',calc.misc]].map(([label,value])=>`<tr><td>${esc(label)}</td><td>${money(value)}</td></tr>`).join('');if($('baseplateCalcTotal'))$('baseplateCalcTotal').textContent=money(calc.total)
  }
  async function save(){
    if(!canEdit()){message('Your role is not allowed to maintain Baseplate costing.','error');return}const next=readUi(),g=next.general;
    if(g.wasteFactor<=0||g.materialRounding<=0||g.paintCoverage<=0||g.thinnerCoverage<=0||g.weldingRodCoverage<=0||g.oxygenCoverage<=0){message('Waste Factor, Rounding and all coverage values must be greater than zero.','error');return}
    const client=window.KeySuiteAuth?.getClient?.();if(!client){message('Supabase is not connected.','error');return}const buttons=[...document.querySelectorAll('[data-baseplate-save]')],labels=buttons.map(button=>button.textContent||'Save Baseplate Costing');buttons.forEach(button=>{button.disabled=true;button.textContent='Saving…'});message('Saving Baseplate costing…','info');
    try{const {data,error}=await client.rpc('keysuite_save_baseplate_costing_v40401',{p_costing:next});if(error)throw error;settings=normalize(data||next);if(window.KEYSUITE_SECURE_DATA)window.KEYSUITE_SECURE_DATA.baseplateCosting=clone(settings);window.KeySuitePricing?.syncPriceListSettings?.({baseplateCosting:clone(settings)});generalEditing=false;channelEditing=false;render();message('ES Baseplate costing saved. New calculations use these values immediately.','info');try{window.dispatchEvent(new CustomEvent('keysuite-baseplate-costing-changed',{detail:{settings:clone(settings)}}))}catch(_){}}
    catch(error){console.error(error);message(`${error.message||error}. Run V40401N02_SUPABASE_MIGRATION.sql first.`,'error')}
    finally{buttons.forEach((button,i)=>{button.disabled=!canEdit();button.textContent=labels[i]||'Save Baseplate Costing'})}
  }
  function bind(){if(bound)return;bound=true;document.querySelectorAll('[data-baseplate-save]').forEach(button=>button.addEventListener('click',save));const channelUnlock=$('baseplateUnlockChannels');channelUnlock?.addEventListener('pointerdown',startChannelHold);['pointerup','pointerleave','pointercancel'].forEach(n=>channelUnlock?.addEventListener(n,()=>stopChannelHold(true)));channelUnlock?.addEventListener('contextmenu',e=>e.preventDefault());const unlock=$('baseplateUnlockGeneral');unlock?.addEventListener('pointerdown',startHold);['pointerup','pointerleave','pointercancel'].forEach(n=>unlock?.addEventListener(n,()=>stopHold(true)));unlock?.addEventListener('contextmenu',e=>e.preventDefault());document.getElementById('baseplatePriceList')?.addEventListener('input',event=>{if(event.target?.matches?.('[data-bp-general],[data-bp-channel-field],[data-bp-calculator]')){if(event.target.matches('[data-bp-calculator]'))event.target.dataset.touched='1';updateCalculator()}});document.getElementById('baseplatePriceList')?.addEventListener('change',event=>{if(event.target?.matches?.('[data-bp-calculator]')){event.target.dataset.touched='1';updateCalculator()}});document.getElementById('productBaseplate')?.addEventListener('input',event=>{if(event.target?.matches?.('[data-product-bp-calculator]')){event.target.dataset.touched='1';updateProductCalculator()}});document.getElementById('productBaseplate')?.addEventListener('change',event=>{if(event.target?.matches?.('[data-product-bp-calculator]')){event.target.dataset.touched='1';updateProductCalculator()}});$('productBaseplateEsButton')?.addEventListener('click',()=>showProductBaseplateFamily('ES'));$('productBaseplateBack')?.addEventListener('click',()=>showProductBaseplateFamily(''));$('productBaseplateRecommendationToggle')?.addEventListener('click',()=>setProductRecommendationCollapsed(!productRecommendationCollapsed));$('productBaseplateQuote')?.addEventListener('click',quoteProductBaseplate);$('productBaseplateEsSeries')?.addEventListener('change',()=>handleProductReferenceChange({seriesChanged:true}));$('productBaseplateEsModel')?.addEventListener('change',()=>handleProductReferenceChange());$('productBaseplateEsMotorHp')?.addEventListener('change',()=>handleProductReferenceChange());$('productBaseplateEsPole')?.addEventListener('change',()=>handleProductReferenceChange({poleChanged:true}))}
  function init(data,userAccess){access=userAccess||access;settings=normalize(data?.baseplateCosting||settings);bind();render()}
  function pageShown(id){if(id==='baseplatePriceList')render();if(id==='productBaseplate'){style();productBaseplateFamily='';setProductRecommendationCollapsed(true);renderProductCalculatorState()}}
  function decoratePumpsetResult(result){if(!result?.available)return result;try{result.baseplateCost=calculateForPumpset(result)}catch(_){}return result}
  document.addEventListener('KEYSUITE_MOTOR_BASEPLATE_RESULT',event=>{const result=event?.detail?.result;if(result?.available){decoratePumpsetResult(result);window.KEYSUITE_LAST_ES_BASEPLATE_COST=result.baseplateCost;populateCalculator(result,{force:true});renderCalculatorState()}});
  document.addEventListener('KEYSUITE_V40205_READY',()=>{if(productBaseplateFamily==='ES'){renderEsReferenceSelectors();renderProductRecommendation()}});
  window.KeySuiteBaseplate={init,pageShown,render,calculateCost,calculateForPumpset,decoratePumpsetResult,getSettings:()=>clone(settings),defaults:()=>clone(DEFAULTS)};
})();
