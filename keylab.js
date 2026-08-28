/* KeySuite V4.14.06 — KeyLab V1.1 classification rates synchronized to workbook. */
(() => {
  'use strict';
  if (window.__KEYSUITE_KEYLAB_V41406__) return;
  window.__KEYSUITE_KEYLAB_V41406__ = true;

  const VERSION = '4.14.06';
  const TEST_GRADES = [
    'ISO 9906:2012 - Grade 1U',
    'ISO 9906:2012 - Grade 1E',
    'ISO 9906:2012 - Grade 1B',
    'ISO 9906:2012 - Grade 2B',
    'ISO 9906:2012 - Grade 2U',
    'ISO 9906:2012 - Grade 3B'
  ];
  const FLOW_UNITS = [
    ['m3/h','m³/hr'],['l/min','L/min'],['l/s','L/s'],['usgpm','US gpm'],['impgpm','Imp gpm']
  ];
  const PRESSURE_UNITS = [
    ['m','m'],['bar','bar'],['ft','ft'],['kpa','kPa'],['psi','psi']
  ];
  const INLET_SIZES = [
    ['DN25','DN25 (1")',25],['DN32','DN32 (1¼")',32],['DN40','DN40 (1½")',40],['DN50','DN50 (2")',50],
    ['DN65','DN65 (2½")',65],['DN80','DN80 (3")',80],['DN100','DN100 (4")',100],['DN125','DN125 (5")',125],
    ['DN150','DN150 (6")',150],['DN200','DN200 (8")',200],['DN250','DN250 (10")',250]
  ];
  const DEFAULTS = Object.freeze({
    powerRate: 5,
    flowMeter: { DN40: 80, DN65: 130, DN125: 250, DN250: 500 },
    pressure: { '10 Bar': 100, '16 Bar': 160, '25 Bar': 250 },
    inlet: { DN65: 130, DN125: 250, DN150: 300, DN250: 500 },
    labour: { DN65: 300, DN125: 500, DN150: 600, DN250: 800 },
    testEngineer: 300,
    accreditation: { No: 0, Yes: 500 },
    clientMargin: {
      Contractor: 0.10,
      'End User': 0.18,
      Owner: 0.18,
      Keylargo: 0,
      Other: 0.28,
      Consultant: 0.18,
      OEM: 0.05,
      Distributor: 0,
      Dealer: 0.05,
      Government: 0.23
    }
  });

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const money = value => `RM ${Number(value || 0).toLocaleString('en-MY', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
  const round10 = value => Math.ceil((Number(value) || 0) / 10) * 10;
  const number = (value, fallback=0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const deepCopy = value => JSON.parse(JSON.stringify(value));

  function normalizeConfig(raw={}){
    const cfg=deepCopy(DEFAULTS), src=raw && typeof raw==='object' ? raw : {};
    cfg.powerRate=Math.max(0,number(src.powerRate??src.power_rate,cfg.powerRate));
    for(const group of ['flowMeter','pressure','inlet','labour']){
      const incoming=src[group]||src[group.replace(/[A-Z]/g,m=>'_'+m.toLowerCase())]||{};
      for(const key of Object.keys(cfg[group])) if(incoming[key]!==undefined) cfg[group][key]=Math.max(0,number(incoming[key],cfg[group][key]));
    }
    const incomingAcc=src.accreditation||{};
    cfg.accreditation.No=Math.max(0,number(incomingAcc.No??incomingAcc['Not Accredited'],cfg.accreditation.No));
    cfg.accreditation.Yes=Math.max(0,number(incomingAcc.Yes??incomingAcc.Accredited,cfg.accreditation.Yes));
    const incomingMargin=src.clientMargin||src.client_margin||{};
    for(const key of Object.keys(cfg.clientMargin)) if(incomingMargin[key]!==undefined) cfg.clientMargin[key]=Math.max(0,number(incomingMargin[key],cfg.clientMargin[key]));
    if(incomingMargin.Keylargo===undefined) cfg.clientMargin.Keylargo=DEFAULTS.clientMargin.Keylargo;
    // Map legacy V4.14.02 margins only when the new classification values are absent.
    if(incomingMargin.Contractor===undefined && incomingMargin['Pump Related']!==undefined) cfg.clientMargin.Contractor=Math.max(0,number(incomingMargin.Contractor,0.10));
    if(incomingMargin.Owner!==undefined) cfg.clientMargin.Owner=Math.max(0,number(incomingMargin.Owner,cfg.clientMargin.Owner));
    cfg.testEngineer=Math.max(0,number(src.testEngineer??src.test_engineer,cfg.testEngineer));
    return cfg;
  }
  function secureConfig(){ return normalizeConfig(window.KEYSUITE_SECURE_DATA?.keylabConfig || window.KEYSUITE_SECURE_DATA?.keylab_config || {}); }
  let config=secureConfig();

  function role(){ return String(window.KEYSUITE_ACCESS?.role||window.KEYSUITE_PROFILE?.role||'viewer').toLowerCase(); }
  function permission(key){ return window.KeySuitePermissions?.level?.(key,role()) || (role()==='owner'?'full':'none'); }
  function canQuote(){ return permission('create_quotations')!=='none'; }
  function canMaintain(){ return permission('manage_price_list')==='full'; }
  function selectedCustomer(){ return window.KeySuiteApp?.getSelectedCustomer?.() || window.KeySuiteApp?.getPricingCustomer?.() || null; }
  function classificationFor(customer){
    const raw=String(customer?.classification||'').trim();
    return Object.prototype.hasOwnProperty.call(config.clientMargin,raw) ? raw : 'Other';
  }

  function ensureStyles(){
    if($('keyLabStyles'))return;
    const style=document.createElement('style');style.id='keyLabStyles';style.textContent=`
      .keylab-layout{display:grid;grid-template-columns:minmax(520px,.98fr) minmax(390px,1.02fr);gap:16px;align-items:start}
      .keylab-input-grid{display:grid;grid-template-columns:1fr;gap:0;border-top:1px solid #e2e8f0}
      .keylab-input-row{display:grid;grid-template-columns:minmax(190px,.85fr) minmax(290px,1.15fr);gap:22px;align-items:center;padding:11px 0;border-bottom:1px solid #e2e8f0}
      .keylab-input-row>label{margin:0;font-weight:700;color:#334155}
      .keylab-input-control{min-width:0}.keylab-input-control input,.keylab-input-control select{width:100%;min-width:0}
      .keylab-input-combo{display:grid;grid-template-columns:minmax(120px,1fr) 128px;gap:8px;align-items:center}
      .keylab-summary{display:grid;gap:0}.keylab-summary-row{display:grid;grid-template-columns:1fr auto;gap:18px;padding:9px 0;border-bottom:1px solid #e2e8f0}.keylab-summary-row.total{font-size:17px;font-weight:800;border-bottom:0;padding-top:13px}.keylab-summary-row.grand{font-size:22px;color:#17365d;font-weight:900;border-top:2px solid #17365d;border-bottom:0;margin-top:4px;padding-top:14px}.keylab-summary-row.pending b{color:#64748b}
      .keylab-auto{font-size:12px;color:#64748b;margin-top:5px}.keylab-auto.warning{color:#b45309;font-weight:700}
      .keylab-customer-class{margin-top:12px;padding:10px 12px;border-radius:8px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-size:13px;font-weight:700}
      .keylab-price-grid{display:grid;grid-template-columns:repeat(2,minmax(280px,1fr));gap:16px}.keylab-price-table input{min-width:90px}.keylab-price-table td:last-child{width:150px}.keylab-margin-input{display:flex;align-items:center;gap:8px}.keylab-margin-input input{width:100px}.keylab-margin-input span{font-weight:700}
      .keylab-badge{display:inline-block;border-radius:999px;background:#e0f2fe;color:#075985;padding:4px 9px;font-size:12px;font-weight:800}.keylab-warning{background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px 12px;margin-top:12px;font-size:13px}
      @media(max-width:1080px){.keylab-layout,.keylab-price-grid{grid-template-columns:1fr}}@media(max-width:620px){.keylab-input-row{grid-template-columns:1fr;gap:6px}.keylab-input-combo{grid-template-columns:minmax(0,1fr) 115px}}
    `;document.head.appendChild(style);
  }

  function options(list, selected){ return list.map(([value,label])=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(label)}</option>`).join(''); }
  function plainOptions(list, selected){ return list.map(value=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(value)}</option>`).join(''); }
  function inletOptions(selected){ return INLET_SIZES.map(([value,label])=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(label)}</option>`).join(''); }

  function flowM3h(value,unit){
    const v=Math.max(0,number(value));
    return v*({'m3/h':1,'l/min':0.06,'l/s':3.6,'usgpm':0.227124707,'impgpm':0.272765}[unit]||1);
  }
  function pressureBar(value,unit){
    const v=Math.max(0,number(value));
    return v*({m:0.0980665,bar:1,ft:0.0298898,kpa:0.01,psi:0.0689476}[unit]||1);
  }
  function flowMeterFor(m3h){
    if(!(m3h>0))return null;
    if(m3h<=20)return 'DN40';
    if(m3h<=60)return 'DN65';
    if(m3h<=220)return 'DN125';
    if(m3h<=850)return 'DN250';
    return null;
  }
  function pressureSensorFor(bar){
    if(!(bar>0))return null;
    if(bar<10)return '10 Bar';
    if(bar<16)return '16 Bar';
    if(bar<25)return '25 Bar';
    return null;
  }
  function inletBucket(inlet){
    const row=INLET_SIZES.find(([value])=>value===inlet), dn=row?row[2]:0;
    if(!(dn>0))return null;
    if(dn<=65)return 'DN65';
    if(dn<=125)return 'DN125';
    if(dn<=150)return 'DN150';
    if(dn<=250)return 'DN250';
    return null;
  }
  function unitLabel(list,value){ return list.find(row=>row[0]===value)?.[1]||value; }

  function populateCalculator(){
    config=secureConfig();
    if($('keyLabTestGrade')) $('keyLabTestGrade').innerHTML=plainOptions(TEST_GRADES,$('keyLabTestGrade').value||TEST_GRADES[0]);
    if($('keyLabFlowUnit')) $('keyLabFlowUnit').innerHTML=options(FLOW_UNITS,$('keyLabFlowUnit').value||'m3/h');
    if($('keyLabPressureUnit')) $('keyLabPressureUnit').innerHTML=options(PRESSURE_UNITS,$('keyLabPressureUnit').value||'m');
    if($('keyLabInlet')) $('keyLabInlet').innerHTML=inletOptions($('keyLabInlet').value||'DN125');
    if($('keyLabAccreditation')) $('keyLabAccreditation').innerHTML=plainOptions(['Yes','No'],$('keyLabAccreditation').value||'Yes');
    recalc();
  }

  function calculation(){
    const grade=$('keyLabTestGrade')?.value||TEST_GRADES[0];
    const kw=Math.max(0,number($('keyLabPowerKw')?.value,0));
    const flowValue=Math.max(0,number($('keyLabFlowMax')?.value,0));
    const flowUnit=$('keyLabFlowUnit')?.value||'m3/h';
    const pressureValue=Math.max(0,number($('keyLabPressureMax')?.value,0));
    const pressureUnit=$('keyLabPressureUnit')?.value||'m';
    const inlet=$('keyLabInlet')?.value||'DN125';
    const accreditation=$('keyLabAccreditation')?.value||'Yes';
    const normalizedFlow=flowM3h(flowValue,flowUnit), normalizedPressure=pressureBar(pressureValue,pressureUnit);
    const flowMeter=flowMeterFor(normalizedFlow), pressureSensor=pressureSensorFor(normalizedPressure), inletPriceBucket=inletBucket(inlet);
    const customer=selectedCustomer(), client=classificationFor(customer);
    const items={
      power:round10(kw*config.powerRate),
      flowMeter:flowMeter?number(config.flowMeter[flowMeter]):0,
      pressure:pressureSensor?number(config.pressure[pressureSensor]):0,
      inlet:inletPriceBucket?number(config.inlet[inletPriceBucket]):0,
      labour:inletPriceBucket?number(config.labour[inletPriceBucket]):0,
      testEngineer:number(config.testEngineer),
      accreditation:number(config.accreditation[accreditation])
    };
    const validInputs=kw>0 && normalizedFlow>0 && normalizedFlow<=850 && normalizedPressure>0 && normalizedPressure<25 && !!inletPriceBucket;
    const base=Object.values(items).reduce((sum,v)=>sum+number(v),0);
    const margin=Math.min(.95,Math.max(0,number(config.clientMargin[client],config.clientMargin.Other)));
    const final=validInputs?round10(base/(1-margin)):null;
    return {grade,kw,flowValue,flowUnit,normalizedFlow,flowMeter,pressureValue,pressureUnit,normalizedPressure,pressureSensor,inlet,inletPriceBucket,accreditation,customer,client,items,base,margin,final,validInputs};
  }

  function recalc(){
    const result=calculation();
    if($('keyLabFlowAuto')){
      $('keyLabFlowAuto').className='keylab-auto'+(result.normalizedFlow>850?' warning':'');
      $('keyLabFlowAuto').textContent=!(result.normalizedFlow>0)?'Enter maximum flow.':result.flowMeter?`Auto Flow Meter: ${result.flowMeter} · ${result.normalizedFlow.toFixed(2)} m³/hr`:'Above 850 m³/hr · Manual selection required.';
    }
    if($('keyLabPressureAuto')){
      $('keyLabPressureAuto').className='keylab-auto'+(result.normalizedPressure>=25?' warning':'');
      $('keyLabPressureAuto').textContent=!(result.normalizedPressure>0)?'Enter maximum pressure / head.':result.pressureSensor?`Auto Pressure Sensor: ${result.pressureSensor} · ${result.normalizedPressure.toFixed(2)} bar`:'25 bar or above · Manual selection required.';
    }
    if($('keyLabLabourAuto')) $('keyLabLabourAuto').textContent=`Pricing bracket ${result.inletPriceBucket||'—'} · Connection ${money(result.items.inlet)} · Labour ${money(result.items.labour)}`;
    if($('keyLabCustomerClass')) $('keyLabCustomerClass').textContent=result.customer&&String(result.customer?.classification||'').trim()?`Customer Classification: ${result.client} · KeyLab margin ${(result.margin*100).toFixed(0)}%`:`Customer Classification: Not selected → follows Other · KeyLab margin ${(result.margin*100).toFixed(0)}%`;
    if($('keyLabBreakdown')) $('keyLabBreakdown').innerHTML=`
      <div class="keylab-summary-row"><span>Test Grade</span><b>${esc(result.grade.replace('ISO 9906:2012 - ',''))}</b></div>
      <div class="keylab-summary-row"><span>Power · ${esc(result.kw)} kW × ${money(config.powerRate)}/kW</span><b>${money(result.items.power)}</b></div>
      <div class="keylab-summary-row"><span>Flow Meter · ${esc(result.flowMeter||'Manual / pending')}</span><b>${money(result.items.flowMeter)}</b></div>
      <div class="keylab-summary-row"><span>Pressure Sensor · ${esc(result.pressureSensor||'Manual / pending')}</span><b>${money(result.items.pressure)}</b></div>
      <div class="keylab-summary-row"><span>Inlet Connection · ${esc(result.inlet)} (${esc(result.inletPriceBucket||'—')} price)</span><b>${money(result.items.inlet)}</b></div>
      <div class="keylab-summary-row"><span>Labour · ${esc(result.inletPriceBucket||'—')}</span><b>${money(result.items.labour)}</b></div>
      <div class="keylab-summary-row"><span>Test Engineer</span><b>${money(result.items.testEngineer)}</b></div>
      <div class="keylab-summary-row"><span>SAMM Accredited · ${esc(result.accreditation)}</span><b>${money(result.items.accreditation)}</b></div>
      <div class="keylab-summary-row total"><span>Base Test Cost</span><b>${money(result.base)}</b></div>
      <div class="keylab-summary-row"><span>Customer Classification · ${esc(result.customer&&String(result.customer?.classification||'').trim()?result.client:'Not selected → Other')} (${(result.margin*100).toFixed(0)}%)</span><b>÷ ${(1-result.margin).toFixed(2)}</b></div>
      <div class="keylab-summary-row grand ${result.final===null?'pending':''}"><span>KeyLab Price</span><b>${result.final===null?'—':money(result.final)}</b></div>`;
    if($('keyLabFormulaNote')) $('keyLabFormulaNote').textContent=`Final = Base ÷ (1 − ${(result.margin*100).toFixed(0)}%) · round up to nearest RM10.${result.customer?'':' No customer/classification selected, so Other rate is used.'}`;
    return result;
  }

  function description(result){
    const flowLabel=unitLabel(FLOW_UNITS,result.flowUnit), pressureLabel=unitLabel(PRESSURE_UNITS,result.pressureUnit);
    return [
      'Pump Performance Test',
      result.grade,
      '(Flow, Head, Power & Efficiency)',
      `Max flow @ ${result.flowValue} ${flowLabel}`,
      `Max head @ ${result.pressureValue} ${pressureLabel}`,
      `Max Power @ ${result.kw} kW`,
      result.accreditation==='Yes'?'SAMM Accredited':null
    ].filter(Boolean).join('\n');
  }
  function addToQuotation(){
    if(!canQuote()){ alert('Your KeySuite role is not allowed to create quotations.'); return; }
    const result=recalc();
    if(!(result.kw>0)){ $('keyLabPowerKw')?.focus(); alert('Enter the maximum power in kW first.'); return; }
    if(!(result.normalizedFlow>0)){ $('keyLabFlowMax')?.focus(); alert('Enter the maximum flow first.'); return; }
    if(result.normalizedFlow>850){ $('keyLabFlowMax')?.focus(); alert('Flow is above 850 m³/hr. Manual KeyLab selection is required.'); return; }
    if(!(result.normalizedPressure>0)){ $('keyLabPressureMax')?.focus(); alert('Enter the maximum pressure / head first.'); return; }
    if(result.normalizedPressure>=25){ $('keyLabPressureMax')?.focus(); alert('Pressure is 25 bar or above. Manual KeyLab selection is required.'); return; }
    if(!result.customer){ window.KeySuiteApp?.showPage?.('quotation'); setTimeout(()=>$('qCustomer')?.focus(),0); alert('Select a quotation customer first. KeyLab pricing follows the customer Classification.'); return; }
    if(result.final===null)return;
    const row=window.KeySuiteApp?.addExternalQuoteItem?.({model:'KeyLab Pump Performance Test',qty:1,unitPrice:result.final,description:description(result),productFamily:'KEYLAB'});
    if(row)window.KeySuiteApp?.showPage?.('quotation');
  }

  function priceInput(id, value){ const node=$(id); if(node) node.value=Number(value||0); }
  const MARGIN_FIELDS=[
    ['Contractor','Contractor'],['End User','EndUser'],['Owner','Owner'],['Keylargo','Keylargo'],['Other','Other'],['Consultant','Consultant'],['OEM','OEM'],['Distributor','Distributor'],['Dealer','Dealer'],['Government','Government']
  ];
  function renderPriceList(){
    config=secureConfig();
    priceInput('keyLabRatePower',config.powerRate);
    Object.entries(config.flowMeter).forEach(([k,v])=>priceInput(`keyLabFlow_${k}`,v));
    [['10 Bar','10'],['16 Bar','16'],['25 Bar','25']].forEach(([k,id])=>priceInput(`keyLabPressure_${id}`,config.pressure[k]));
    Object.entries(config.inlet).forEach(([k,v])=>priceInput(`keyLabInlet_${k}`,v));
    Object.entries(config.labour).forEach(([k,v])=>priceInput(`keyLabLabour_${k}`,v));
    priceInput('keyLabEngineer',config.testEngineer);priceInput('keyLabAccredited',config.accreditation.Yes);
    MARGIN_FIELDS.forEach(([k,id])=>priceInput(`keyLabMargin_${id}`,number(config.clientMargin[k])*100));
    const editable=canMaintain();
    document.querySelectorAll('#keyLabPriceList input').forEach(input=>input.disabled=!editable);
    if($('saveKeyLabPriceList')) $('saveKeyLabPriceList').style.display=editable?'':'none';
    if($('keyLabPriceListMessage')) $('keyLabPriceListMessage').textContent=editable?'Owner source-price maintenance.':'Read-only. Owner permission is required to maintain KeyLab pricing.';
  }
  function readPriceList(){
    const get=id=>Math.max(0,number($(id)?.value,0)), clientMargin={};
    MARGIN_FIELDS.forEach(([k,id])=>clientMargin[k]=get(`keyLabMargin_${id}`)/100);
    return normalizeConfig({
      powerRate:get('keyLabRatePower'),
      flowMeter:{DN40:get('keyLabFlow_DN40'),DN65:get('keyLabFlow_DN65'),DN125:get('keyLabFlow_DN125'),DN250:get('keyLabFlow_DN250')},
      pressure:{'10 Bar':get('keyLabPressure_10'),'16 Bar':get('keyLabPressure_16'),'25 Bar':get('keyLabPressure_25')},
      inlet:{DN65:get('keyLabInlet_DN65'),DN125:get('keyLabInlet_DN125'),DN150:get('keyLabInlet_DN150'),DN250:get('keyLabInlet_DN250')},
      labour:{DN65:get('keyLabLabour_DN65'),DN125:get('keyLabLabour_DN125'),DN150:get('keyLabLabour_DN150'),DN250:get('keyLabLabour_DN250')},
      testEngineer:get('keyLabEngineer'),accreditation:{No:0,Yes:get('keyLabAccredited')},clientMargin
    });
  }
  async function savePriceList(){
    if(!canMaintain())return;
    const client=window.KeySuiteAuth?.getClient?.(); if(!client){alert('Supabase is not connected.');return;}
    const button=$('saveKeyLabPriceList'), message=$('keyLabPriceListMessage'), next=readPriceList();
    if(button){button.disabled=true;button.textContent='Saving…'};if(message)message.textContent='Saving KeyLab Price List…';
    try{
      const {data,error}=await client.rpc('keysuite_save_keylab_pricelist_v41402',{p_config:next});if(error)throw error;
      config=normalizeConfig(data||next);window.KEYSUITE_SECURE_DATA=window.KEYSUITE_SECURE_DATA||{};window.KEYSUITE_SECURE_DATA.keylabConfig=config;
      renderPriceList();populateCalculator();if(message)message.textContent='KeyLab Price List saved.';
    }catch(error){console.error(error);if(message)message.textContent=`Save failed: ${error.message||error}`;}
    finally{if(button){button.disabled=false;button.textContent='Save KeyLab Price List';}}
  }

  function bind(){
    if(window.__KEYSUITE_KEYLAB_BOUND__)return;window.__KEYSUITE_KEYLAB_BOUND__=true;ensureStyles();
    ['keyLabPowerKw','keyLabFlowMax','keyLabPressureMax'].forEach(id=>$(id)?.addEventListener('input',recalc));
    ['keyLabTestGrade','keyLabFlowUnit','keyLabPressureUnit','keyLabInlet','keyLabAccreditation'].forEach(id=>$(id)?.addEventListener('change',recalc));
    $('keyLabAddQuotation')?.addEventListener('click',addToQuotation);
    $('keyLabReset')?.addEventListener('click',()=>{
      if($('keyLabPowerKw'))$('keyLabPowerKw').value='';
      if($('keyLabFlowMax'))$('keyLabFlowMax').value='';
      if($('keyLabPressureMax'))$('keyLabPressureMax').value='';
      if($('keyLabTestGrade'))$('keyLabTestGrade').value=TEST_GRADES[0];
      if($('keyLabFlowUnit'))$('keyLabFlowUnit').value='m3/h';
      if($('keyLabPressureUnit'))$('keyLabPressureUnit').value='m';
      if($('keyLabInlet'))$('keyLabInlet').value='DN125';
      if($('keyLabAccreditation'))$('keyLabAccreditation').value='Yes';
      recalc();$('keyLabPowerKw')?.focus();
    });
    $('saveKeyLabPriceList')?.addEventListener('click',savePriceList);
    $('reloadKeyLabPriceList')?.addEventListener('click',renderPriceList);
  }
  function pageShown(id){
    bind();
    if(id==='keyLab'){populateCalculator();if($('keyLabAddQuotation'))$('keyLabAddQuotation').style.display=canQuote()?'':'none';}
    if(id==='keyLabPriceList')renderPriceList();
  }
  function applyData(data){ if(data){window.KEYSUITE_SECURE_DATA=data;config=secureConfig();} populateCalculator(); }

  window.KeySuiteKeyLab={version:VERSION,defaults:deepCopy(DEFAULTS),normalizeConfig,calculation:()=>calculation(),recalc,pageShown,renderPriceList,applyData};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
