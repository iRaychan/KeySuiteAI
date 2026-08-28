(() => {
  'use strict';

  let secureData={manifoldProducts:[],categories:[],productMultipliers:{MANIFOLD:{USD:5.8,RMB:.65,MYR:1}}};
  let access=null,bound=false,activeTable='branch',lastFound=null;
  const OPTION_DEFAULTS={suctionStrainer:false,suctionFlexible:false,dischargeFlexible:false};
  const ACCESSORY_VARIANTS=[
    ['GI_THREAD_10','GI Thread @ 10 Bar'],['SS_THREAD_10','SS Threaded @ 10 Bar'],
    ['GI_FLANGE_16','GI Flange @ 16 Bar'],['SS_FLANGE_16','SS Flange @ 16 Bar'],
    ['GI_FLANGE_25','GI Flange @ 25 Bar2'],['SS_FLANGE_25','SS Flange @ 25Bar']
  ];
  const SIZING_FALLBACK={
    DN25:['DN25','DN40','DN50','DN65','DN80','DN100'],DN32:['DN32','DN50','DN65','DN80','DN100','DN100'],
    DN40:['DN40','DN65','DN80','DN100','DN100','DN150'],DN50:['DN50','DN80','DN100','DN100','DN150','DN200'],
    DN65:['DN65','DN100','DN100','DN150','DN200','DN250'],DN80:['DN80','DN100','DN150','DN200','DN250','DN300'],
    DN100:['DN100','DN150','DN200','DN250','DN300','DN350'],DN125:['DN125','DN200','DN250','DN300','DN350','DN400'],
    DN150:['DN150','DN200','DN250','DN350','DN400','DN450'],DN200:['DN200','DN300','DN300','DN400','DN450','DN500']
  };
  let globalOptions={...OPTION_DEFAULTS};
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const money=value=>`RM ${Number(value||0).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const validCurrency=value=>['USD','RMB','MYR'].includes(String(value||'').toUpperCase())?String(value).toUpperCase():'MYR';
  const validRarity=value=>['many','common','rare'].includes(String(value||'').toLowerCase())?String(value).toLowerCase():'common';
  const fieldFor=currency=>({USD:'priceUsd',RMB:'priceRmb',MYR:'priceMyr'})[validCurrency(currency)];
  const products=section=>(secureData.manifoldProducts||[]).filter(row=>row.section===section).sort((a,b)=>Number(a.source_row||0)-Number(b.source_row||0));
  const permissionLevel=()=>window.KeySuitePermissions?.level?.('manage_price_list',String(access?.role||window.KEYSUITE_ACCESS?.role||'viewer').toLowerCase())||'none';
  const isOwner=()=>permissionLevel()==='full';
  const isFilled=value=>value!==null&&value!==''&&Number.isFinite(Number(value))&&Number(value)>0;
  const dnNumber=value=>Number(String(value||'').replace(/[^0-9.]/g,''))||0;
  const currentCurrency=()=>validCurrency($('manifoldPriceCurrency')?.value||localStorage.getItem('ks_manifold_price_currency')||'MYR');
  const rates=()=>secureData.productMultipliers?.MANIFOLD||{USD:5.8,RMB:.65,MYR:1};
  const variantKey=variant=>String(variant?.code||variant?.pumpQty||variant?.tankSize||variant?.label||'');
  const findVariant=(product,key)=>(product?.variants||[]).find(v=>variantKey(v)===String(key));
  function ensureAccessoryVariants(product){
    if(!product||!['flexible','strainer'].includes(String(product.section||'').toLowerCase()))return product;
    product.variants=Array.isArray(product.variants)?product.variants:[];
    ACCESSORY_VARIANTS.forEach(([code,label])=>{if(!findVariant(product,code))product.variants.push({code,label,priceUsd:null,priceRmb:null,priceMyr:100})});
    return product;
  }
  function ensureHeaderVariants(product){
    if(!product||product.section!=='header')return product;
    product.variants=Array.isArray(product.variants)?product.variants:[];
    for(let qty=1;qty<=6;qty++){
      if(!findVariant(product,qty))product.variants.push({pumpQty:qty,label:`${qty} ${qty===1?'Pump':'Pumps'}`,priceUsd:null,priceRmb:null,priceMyr:null});
    }
    return product;
  }
  const rowBy=(section,model)=>products(section).find(row=>String(row.model).toUpperCase()===String(model).toUpperCase());
  function headerSizes(material='GI'){const prefix=String(material||'GI').toUpperCase()+' ';return [...new Set(products('header').map(row=>String(row.model||'')).filter(model=>model.toUpperCase().startsWith(prefix)).map(model=>model.slice(prefix.length)).filter(Boolean))].sort((a,b)=>dnNumber(a)-dnNumber(b))}
  const pricingCustomer=()=>window.KeySuiteApp?.getPricingCustomer?.()||window.KeySuiteApp?.getSelectedCustomer?.()||null;
  const categoryFor=customer=>(secureData.categories||[]).find(row=>row.id===customer?.pricingCategoryId)||null;
  function normalizeOptions(value={}){return {suctionStrainer:!!value.suctionStrainer,suctionFlexible:!!value.suctionFlexible,dischargeFlexible:!!value.dischargeFlexible}}
  function loadGlobalOptions(){globalOptions={...OPTION_DEFAULTS};return {...globalOptions}}
  function getGlobalOptions(){return {...globalOptions}}
  function syncOptionControls(){document.querySelectorAll('[data-manifold-option]').forEach(input=>{const key=input.dataset.manifoldOption;if(Object.prototype.hasOwnProperty.call(globalOptions,key))input.checked=!!globalOptions[key]})}
  function setGlobalOptions(value={},meta={}){const next=normalizeOptions(value),changed=Object.keys(OPTION_DEFAULTS).some(key=>next[key]!==globalOptions[key]);globalOptions=next;syncOptionControls();if(changed&&!meta.silent){try{window.dispatchEvent(new CustomEvent('keysuite-manifold-options-changed',{detail:{options:getGlobalOptions(),source:meta.source||'manifold'}}))}catch(_){}}return getGlobalOptions()}
  function optionLines(options){const o=normalizeOptions(options),lines=[];if(o.suctionStrainer)lines.push('Strainer on suction port of each pump');if(o.suctionFlexible)lines.push('Flexible connector on suction port of each pump');if(o.dischargeFlexible)lines.push('Flexible connector on discharge port of each pump');return lines}

  function normalizeConnection(value){const code=String(value||'FLANGE_16').toUpperCase();if(code==='FLANGE_10')return 'FLANGE_16';return ['THREAD_8','FLANGE_16','FLANGE_25'].includes(code)?code:'FLANGE_16'}
  function priceConnection(value){return ({THREAD_8:'THREAD_10',FLANGE_16:'FLANGE_16',FLANGE_25:'FLANGE_25'})[normalizeConnection(value)]||'FLANGE_16'}
  function branchCode(material,connection){
    const [type,pressure]=priceConnection(connection).split('_');
    return `${String(material||'GI').toUpperCase()}_${type}_${pressure}`;
  }
  function connectionForShutoffHead(headMetres){
    const head=Number(headMetres);if(!Number.isFinite(head)||head<=0)return {connection:'FLANGE_16',pressureBar:null,fallback:true,engineeringReview:false};
    const pressureBar=head*.0981;
    // B4.06.13 automatic manifold rating: <8 bar Thread 10; 8-<16 Flange 16; 16-<25 Flange 25; >=25 engineering review.
    if(pressureBar<8)return {connection:'THREAD_8',pressureBar,fallback:false,engineeringReview:false};
    if(pressureBar<16)return {connection:'FLANGE_16',pressureBar,fallback:false,engineeringReview:false};
    if(pressureBar<25)return {connection:'FLANGE_25',pressureBar,fallback:false,engineeringReview:false};
    return {connection:'',pressureBar,fallback:false,engineeringReview:true};
  }
  function priceOf(variant,currency){const value=variant?.[fieldFor(currency)];return isFilled(value)?Number(value):null}
  function selectedConfig(){return {
    material:String($('manifoldMaterial')?.value||'GI').toUpperCase(),connection:normalizeConnection($('manifoldConnection')?.value||'FLANGE_16'),
    suctionDn:String($('manifoldSuctionDn')?.value||'DN25'),dischargeDn:String($('manifoldDischargeDn')?.value||'DN25'),
    headerDn:String($('manifoldHeaderDn')?.value||''),pumpQty:Math.max(1,Math.min(6,Number($('manifoldPumpQty')?.value)||2)),tankSize:String($('manifoldTankSize')?.value||''),rarity:validRarity($('manifoldRarity')?.value),options:getGlobalOptions()
  }}

  function fallbackSizingDn(pumpDn,pumpQty){const values=SIZING_FALLBACK[String(pumpDn||'').toUpperCase()]||[];return String(values[Math.max(1,Math.min(6,Number(pumpQty)||1))-1]||'')}
  function accessoryPriceMyr(product,code){
    const row=ensureAccessoryVariants(product),variant=row?findVariant(row,code):null;if(!variant)return null;
    const candidates=['USD','RMB','MYR'].map(currency=>{const sourcePrice=priceOf(variant,currency);if(sourcePrice===null)return null;const multiplier=Number(rates()?.[currency]??1);return {currency,sourcePrice,multiplier,baseMyr:Number(sourcePrice)*multiplier}}).filter(row=>row&&Number.isFinite(row.baseMyr));
    if(!candidates.length)return null;return candidates.reduce((best,row)=>!best||row.baseMyr>best.baseMyr?row:best,null);
  }
  function sourceBook(config){
    const pumpDn=`DN${Math.max(dnNumber(config.suctionDn),dnNumber(config.dischargeDn))}`;
    const sizing=rowBy('sizing',pumpDn),sizingVariant=findVariant(sizing,config.pumpQty),autoManifoldDn=String(sizingVariant?.resultDn||fallbackSizingDn(pumpDn,config.pumpQty)||''),manifoldDn=String(config.headerDn||autoManifoldDn);
    if(!manifoldDn)return null;
    const branchSuction=rowBy('branch',config.suctionDn),branchDischarge=rowBy('branch',config.dischargeDn),code=branchCode(config.material,config.connection);
    const suctionVariant=findVariant(branchSuction,code),dischargeVariant=findVariant(branchDischarge,code);
    const header=rowBy('header',`${config.material} ${manifoldDn}`),headerVariant=findVariant(header,config.pumpQty);
    const tank=config.tankSize?rowBy('tank_fitting',config.tankSize):null,tankVariant=tank?findVariant(tank,'FITTING'):null;
    const opts=normalizeOptions(config.options),missing=[];
    if(!suctionVariant)missing.push(`Branch ${config.suctionDn} ${code}`);if(!dischargeVariant)missing.push(`Branch ${config.dischargeDn} ${code}`);if(!headerVariant)missing.push(`Header ${config.material} ${manifoldDn} / ${config.pumpQty} pump`);if(config.tankSize&&!tankVariant)missing.push(`Tank fitting ${config.tankSize}`);

    // V4.07.04: all optional Strainer / Flexible add-ons use the pump SUCTION DN.
    // Every selected accessory is required once per pump, so its selling-price add-on is
    // accessory unit price x configured pump quantity. The result is then added on top of
    // the already-calculated Manifold base selling price; it never replaces that base price.
    const accessoryBreakdown={suctionStrainer:null,suctionFlexible:null,dischargeFlexible:null},accessoryQty=Math.max(1,Math.min(6,Number(config.pumpQty)||1)),accessoryDn=String(config.suctionDn||'DN25');
    function accessoryEntry(section){const row=accessoryPriceMyr(rowBy(section,accessoryDn),code);return row?{...row,dn:accessoryDn,qty:accessoryQty,unitMyr:Number(row.baseMyr||0),totalMyr:Number(row.baseMyr||0)*accessoryQty}:null}
    if(opts.suctionStrainer){accessoryBreakdown.suctionStrainer=accessoryEntry('strainer');if(!accessoryBreakdown.suctionStrainer)missing.push(`Strainer ${accessoryDn} ${code}`)}
    if(opts.suctionFlexible){accessoryBreakdown.suctionFlexible=accessoryEntry('flexible');if(!accessoryBreakdown.suctionFlexible)missing.push(`Flexible ${accessoryDn} ${code}`)}
    if(opts.dischargeFlexible){accessoryBreakdown.dischargeFlexible=accessoryEntry('flexible');if(!accessoryBreakdown.dischargeFlexible)missing.push(`Flexible ${accessoryDn} ${code}`)}
    const accessoryAddonMyr=Object.values(accessoryBreakdown).reduce((sum,row)=>sum+Number(row?.totalMyr||0),0);

    const baseMissing=missing.filter(label=>!/^Flexible\b|^Strainer\b/i.test(label)),book={USD:{TOTAL:null},RMB:{TOTAL:null},MYR:{TOTAL:null}},parts={};
    if(!baseMissing.length)['USD','RMB','MYR'].forEach(currency=>{
      const suction=priceOf(suctionVariant,currency),discharge=priceOf(dischargeVariant,currency),headerPrice=priceOf(headerVariant,currency),tankPrice=tankVariant?priceOf(tankVariant,currency):0;
      const required=[suction,discharge,headerPrice];if(tankVariant)required.push(tankPrice);if(required.some(value=>value===null))return;
      const branchPerPump=(suction+discharge)/2,branchTotal=branchPerPump*config.pumpQty,total=branchTotal+headerPrice+(tankPrice||0);
      book[currency].TOTAL=total;parts[currency]={suction,discharge,branchPerPump,branchTotal,header:headerPrice,tank:tankPrice||0,total};
    });
    const basePriceable=Object.values(book).some(row=>row.TOTAL!==null&&Number.isFinite(Number(row.TOTAL))),accessoriesPriceable=!missing.some(label=>/^Flexible\b|^Strainer\b/i.test(label)),priceable=basePriceable&&accessoriesPriceable;
    return {book,parts,pumpDn,manifoldDn,autoManifoldDn,branchCode:code,header,headerVariant,tank,tankVariant,options:opts,accessoryBreakdown,accessoryAddonMyr,missing,basePriceable,priceable};
  }

  function findConfiguredPrice(config={},options={}){
    const normalized={material:String(config.material||'GI').toUpperCase(),connection:normalizeConnection(config.connection||'FLANGE_16'),suctionDn:String(config.suctionDn||'DN25'),dischargeDn:String(config.dischargeDn||'DN25'),headerDn:String(config.headerDn||''),pumpQty:Math.max(1,Math.min(6,Number(config.pumpQty)||2)),tankSize:String(config.tankSize||''),rarity:validRarity(config.rarity),options:normalizeOptions(config.options||getGlobalOptions())};
    const customer=options.customer||pricingCustomer(),category=options.category||categoryFor(customer);if(!customer||!category)return null;
    const source=sourceBook(normalized);if(!source?.priceable)return null;
    const baseCalc=window.KeySuitePricing?.calculatePrice?.(source.book,'TOTAL',category,'MANIFOLD',{...options,customer,rarity:normalized.rarity,pricingMode:options.pricingMode||'quotation'});if(!baseCalc)return null;
    const accessoryAddonMyr=Number(source.accessoryAddonMyr||0),baseManifoldFinalPrice=Number(baseCalc.finalPrice||0),calc={...baseCalc,baseManifoldFinalPrice,accessoryAddonMyr,unroundedPrice:Number(baseCalc.unroundedPrice??baseManifoldFinalPrice)+accessoryAddonMyr,finalPrice:baseManifoldFinalPrice+accessoryAddonMyr};
    return {product:{id:'MANIFOLD-CALCULATOR',model:`${normalized.material} Manifold ${source.manifoldDn}`},material:'TOTAL',variant:'TOTAL',calc,category,customer,family:'MANIFOLD',configuration:normalized,source,sourceExtra:{configuration:normalized,base_manifold_price:baseManifoldFinalPrice,accessory_addon_myr:accessoryAddonMyr,accessory_breakdown:source.accessoryBreakdown}};
  }

  function connectionLabel(value){return ({THREAD_8:'Thread @ 10 Bar',FLANGE_16:'Flange @ 16 Bar',FLANGE_25:'Flange @ 25 Bar'})[normalizeConnection(value)]||value}
  function dnInches(value){const dn=dnNumber(value),map={15:'.5',20:'.75',25:'1',32:'1.25',40:'1.5',50:'2',65:'2.5',80:'3',100:'4',125:'5',150:'6',200:'8',250:'10',300:'12'};return map[dn]||String(Number((dn/25.4).toFixed(1))||'')}
  function description(found,options={}){
    const c=found.configuration,s=found.source,includeCw=!!options.includeCw,indent=includeCw?'\t\t':'',size=dnInches(s.manifoldDn);
    const extras=optionLines(c.options).map(line=>`${indent}${line}`);
    return [`${includeCw?'c/w\t':''}Baseplate in mild steel, ${c.material} manifold ${size}" inlet & ${size}" outlet`,`${indent}Gate valves on suction & discharge ports of each pump`,`${indent}Check valves on discharge ports of each pump`,...extras,`${indent}1 Pressure gauge on discharge ports`].join('\n');
  }
  function itemFrom(found,options={}){
    const auto=!!options.auto,model=`Manifold ${dnInches(found.source.manifoldDn)}" · ${found.configuration.pumpQty} ${found.configuration.pumpQty===1?'Pump':'Pumps'} · ${connectionLabel(found.configuration.connection)}`;
    return {model,bomDescription:model,description:description(found,{includeCw:!!options.includeCw}),qty:1,unitPrice:found.calc.finalPrice,pricingSource:{product_family:'MANIFOLD',product_id:'MANIFOLD-CALCULATOR',material:'TOTAL',variant:'TOTAL',rarity:found.calc.rarity,pricing_mode:found.calc.pricingMode||'quotation',customer_id:found.customer?.id||'',category_id:found.category?.id||'',source_currency:found.calc.sourceCurrency,currency_multiplier:found.calc.multiplier,source_price:found.calc.sourcePrice,base_myr:found.calc.baseMyr,margin:found.calc.margin,normal:found.calc.normal,rare:found.calc.rare,transport:found.calc.transport,commission:found.calc.commission,set_discount:found.calc.setDiscount,final_discount:found.calc.finalDiscount,include_commission:found.calc.includeCommission,include_set_discount:found.calc.includeSetDiscount,include_final_discount:found.calc.includeFinalDiscount,include_fuel_charge:found.calc.includeFuelCharge,distance_km:found.calc.distanceKm,fuel_price:found.calc.fuelPrice,fuel_base_price:found.calc.fuelBasePrice,fuel_charge:found.calc.fuelCharge,unrounded_price:found.calc.unroundedPrice,calculated_price:found.calc.finalPrice,base_manifold_price:Number((found.calc.baseManifoldFinalPrice??found.calc.finalPrice)||0),accessory_addon_myr:Number(found.calc.accessoryAddonMyr||0),accessory_breakdown:found.source?.accessoryBreakdown||{},configuration:found.configuration,...(auto?{auto_sized_manifold:true}:{})},productFamily:'MANIFOLD',assemblyLevel:'SYSTEM_COMPONENT',assemblySection:'manifold',manifoldData:{...found.configuration,manifoldDn:found.source.manifoldDn,autoSelected:auto}};
  }
  function unpricedItemFrom(config,source,options={}){
    const normalized={material:String(config.material||'GI').toUpperCase(),connection:normalizeConnection(config.connection||'FLANGE_16'),suctionDn:String(config.suctionDn||'DN25'),dischargeDn:String(config.dischargeDn||'DN25'),headerDn:String(config.headerDn||''),pumpQty:Math.max(1,Math.min(6,Number(config.pumpQty)||2)),tankSize:String(config.tankSize||''),rarity:validRarity(config.rarity),options:normalizeOptions(config.options||getGlobalOptions())};
    const auto=!!options.auto,model=`Manifold ${dnInches(source.manifoldDn)}" · ${normalized.pumpQty} ${normalized.pumpQty===1?'Pump':'Pumps'} · ${connectionLabel(normalized.connection)}`,pseudo={configuration:normalized,source},baseUnitPrice=Math.max(0,Number(options.baseUnitPrice||0));
    return {model,bomDescription:model,description:description(pseudo,{includeCw:options.includeCw!==false}),qty:1,unitPrice:baseUnitPrice,pricingSource:{product_family:'MANIFOLD',product_id:'MANIFOLD-CALCULATOR',material:'TOTAL',variant:'TOTAL',rarity:normalized.rarity,pricing_mode:options.pricingMode||'assembly',configuration:normalized,base_manifold_price:baseUnitPrice,accessory_addon_myr:0,price_missing:true,missing_components:[...(source.missing||[])],...(auto?{auto_sized_manifold:true}:{})},productFamily:'MANIFOLD',assemblyLevel:'SYSTEM_COMPONENT',assemblySection:'manifold',manifoldData:{...normalized,manifoldDn:source.manifoldDn,autoSelected:auto,priceMissing:true,missingComponents:[...(source.missing||[])]}};
  }
  function buildConfiguredItem(config={},options={}){
    const found=findConfiguredPrice(config,options);if(found)return itemFrom(found,{includeCw:options.includeCw!==false,auto:!!options.auto});
    const normalized={material:String(config.material||'GI').toUpperCase(),connection:normalizeConnection(config.connection||'FLANGE_16'),suctionDn:String(config.suctionDn||'DN25'),dischargeDn:String(config.dischargeDn||'DN25'),headerDn:String(config.headerDn||''),pumpQty:Math.max(1,Math.min(6,Number(config.pumpQty)||2)),tankSize:String(config.tankSize||''),rarity:validRarity(config.rarity),options:normalizeOptions(config.options||getGlobalOptions())},source=sourceBook(normalized);if(!source)return null;
    const customer=options.customer||pricingCustomer(),category=options.category||categoryFor(customer),baseCalc=source.basePriceable&&customer&&category?window.KeySuitePricing?.calculatePrice?.(source.book,'TOTAL',category,'MANIFOLD',{...options,customer,rarity:normalized.rarity,pricingMode:options.pricingMode||'quotation'}):null;
    return unpricedItemFrom(normalized,source,{...options,baseUnitPrice:Number(baseCalc?.finalPrice||0)});
  }

  function renderProduct(){
    const page=$('productManifold');if(!page)return;
    const dns=[...new Set(products('branch').map(row=>row.model))].sort((a,b)=>dnNumber(a)-dnNumber(b));
    ['manifoldSuctionDn','manifoldDischargeDn'].forEach(id=>{const select=$(id);if(!select)return;const old=select.value;select.innerHTML=dns.map(dn=>`<option value="${esc(dn)}">${esc(dn)}</option>`).join('');select.value=dns.includes(old)?old:(id==='manifoldSuctionDn'?(dns[3]||dns[0]):(dns[1]||dns[0]))});
    const tank=$('manifoldTankSize');if(tank){const old=tank.value;tank.innerHTML='<option value="">No Tank Fitting</option>'+products('tank_fitting').map(row=>`<option value="${esc(row.model)}">${esc(row.model)}</option>`).join('');tank.value=products('tank_fitting').some(row=>row.model===old)?old:''}
    refreshHeaderOptions();updateProduct();
  }
  function refreshHeaderOptions(){const select=$('manifoldHeaderDn');if(!select)return;const old=select.value,values=headerSizes($('manifoldMaterial')?.value||'GI');select.innerHTML='<option value="">Auto</option>'+values.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('');select.value=values.includes(old)?old:'';applyDefaultState(select)}
  function summaryRow(label,value,cls=''){return `<div class="manifold-summary-row"><span>${esc(label)}</span><b class="${cls}">${esc(value)}</b></div>`}
  function updateProduct(){
    const customer=pricingCustomer(),category=categoryFor(customer),config=selectedConfig(),found=findConfiguredPrice(config,{customer,category});lastFound=found;
    const notice=$('manifoldProductNotice');if(notice)notice.innerHTML=!customer?'Select a customer in Dashboard or Quotation first.':!category?`<b>${esc(customer.company||'Customer')}</b> has no Pricing Category.`:`Pricing for <b>${esc(customer.company||'Customer')}</b> · ${esc(category.name||'Category')}`;
    const selection=$('manifoldSelectionSummary'),price=$('manifoldPriceSummary');
    const raw=sourceBook(config);
    if(selection)selection.innerHTML=raw?[summaryRow('Pump connection used',raw.pumpDn),summaryRow('Header size',`${raw.manifoldDn}${config.headerDn?' · Manual':' · Auto'}`),summaryRow('Auto calculated size',raw.autoManifoldDn||raw.manifoldDn),summaryRow('Branch construction',`${config.material} ${connectionLabel(config.connection)}`),summaryRow('Suction strainer',config.options.suctionStrainer?'Included':'No'),summaryRow('Suction flexible',config.options.suctionFlexible?'Included':'No'),summaryRow('Discharge flexible',config.options.dischargeFlexible?'Included':'No'),summaryRow('Tank fitting',config.tankSize||'None')].join(''):'<p class="muted">No valid sizing/price combination is available.</p>';
    if(price)price.innerHTML=found?[summaryRow('Highest source',`${found.calc.sourceCurrency} ${Number(found.calc.sourcePrice).toFixed(2)}`),summaryRow('Converted source',money(found.calc.baseMyr)),summaryRow('Pricing type',found.calc.rarity[0].toUpperCase()+found.calc.rarity.slice(1)),summaryRow('Quoted value',money(found.calc.finalPrice),'manifold-total')].join(''):raw?.missing?.length?`<p class="muted">Price source missing: ${esc(raw.missing.join(' · '))}. The manifold sizing remains available.</p>`:'<p class="muted">Select a valid combination and customer pricing category.</p>';
    ['manifoldAddAssembly','manifoldAddQuotation'].forEach(id=>{if($(id))$(id).disabled=!found});
  }
  function addTo(route){
    if(!lastFound){updateProduct();if(!lastFound)return}
    const found=route==='assembly'?findConfiguredPrice(lastFound.configuration,{pricingMode:'assembly'}):lastFound;if(!found)return;
    const item=itemFrom(found,{includeCw:route==='assembly'});
    if(route==='assembly'){window.KeySuiteAssembly?.addItem?.(item);return}
    if(!window.KeySuitePricing?.ensureQuoteableCalculation?.(found.calc,item.model))return;
    if(window.KeySuiteApp?.canEditQuotation&&!window.KeySuiteApp.canEditQuotation(true))return;
    const row=window.KeySuiteApp?.addExternalQuoteItem?.(item);if(!row)return;
    row.dataset.pricingSource=JSON.stringify(item.pricingSource);window.KeySuiteApp?.showPage?.('quotation');
  }

  function message(text,type='info'){const box=$('manifoldPriceListMessage');if(!box)return;box.textContent=text||'';box.className=text?`auth-message show ${type}`:'auth-message'}
  function priceInput(product,variant,currency,label){const value=priceOf(variant,currency);return `<div class="currency-price-input"><span>${currency}</span><input type="number" min="0" step="0.01" value="${value===null?'':Number(value).toFixed(2)}" data-manifold-product="${esc(product.id)}" data-manifold-variant="${esc(variantKey(variant))}" aria-label="${esc(label)}"></div>`}
  function saveButton(product){return `<button class="btn icon-save-button" type="button" data-save-manifold="${esc(product.id)}" title="Save ${esc(product.model)}" aria-label="Save ${esc(product.model)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12l2 2v14H5z"></path><path d="M8 4v6h8V4"></path><path d="M8 20v-6h8v6"></path></svg></button>`}
  function raritySelect(product){return `<select data-manifold-rarity="${esc(product.id)}"><option value="many" ${product.rarity==='many'?'selected':''}>Many</option><option value="common" ${product.rarity==='common'?'selected':''}>Common</option><option value="rare" ${product.rarity==='rare'?'selected':''}>Rare</option></select>`}
  function renderPriceTable(){
    const host=$('manifoldPriceTableHost');if(!host)return;const currency=currentCurrency(),rows=products(activeTable).map(product=>ensureAccessoryVariants(product));let html='';
    if(['branch','flexible','strainer'].includes(activeTable)){
      const codes=['GI_THREAD_10','SS_THREAD_10','GI_FLANGE_16','SS_FLANGE_16','GI_FLANGE_25','SS_FLANGE_25'];
      const labels=['GI Thread 10','SS Thread 10','GI Flange 16','SS Flange 16','GI Flange 25','SS Flange 25'];
      const heading=activeTable==='branch'?'Pump':activeTable==='flexible'?'Flexible':'Strainer';
      html=`<table class="pricelist-table manifold-table"><thead><tr><th>${heading}</th><th>Rarity</th>${labels.map(x=>`<th>${x}</th>`).join('')}<th></th></tr></thead><tbody>`+rows.map(product=>`<tr data-manifold-row="${esc(product.id)}"><td><b>${esc(product.model)}</b></td><td>${raritySelect(product)}</td>${codes.map((code,i)=>`<td>${priceInput(product,findVariant(product,code),currency,labels[i])}</td>`).join('')}<td>${saveButton(product)}</td></tr>`).join('')+'</tbody></table>';
    }else if(activeTable==='sizing'){
      const dns=[...new Set(rows.map(row=>row.model))].sort((a,b)=>dnNumber(a)-dnNumber(b));
      html=`<table class="pricelist-table manifold-table"><thead><tr><th>Pump Connection</th>${[1,2,3,4,5,6].map(q=>`<th>${q} ${q===1?'Pump':'Pumps'}</th>`).join('')}<th></th></tr></thead><tbody>`+rows.map(product=>`<tr data-manifold-row="${esc(product.id)}"><td><b>${esc(product.model)}</b></td>${[1,2,3,4,5,6].map(q=>{const v=findVariant(product,q);return `<td><select data-manifold-sizing="${q}">${dns.map(dn=>`<option value="${dn}" ${v?.resultDn===dn?'selected':''}>${dn}</option>`).join('')}</select></td>`}).join('')}<td>${saveButton(product)}</td></tr>`).join('')+'</tbody></table>';
    }else if(activeTable==='header'){
      html=`<table class="pricelist-table manifold-table"><thead><tr><th>Header</th><th>Rarity</th>${[1,2,3,4,5,6].map(q=>`<th>${q} ${q===1?'Pump':'Pumps'}</th>`).join('')}<th></th></tr></thead><tbody>`+rows.map(product=>`<tr data-manifold-row="${esc(product.id)}"><td><b>${esc(product.model)}</b></td><td>${raritySelect(product)}</td>${[1,2,3,4,5,6].map(q=>{ensureHeaderVariants(product);const v=findVariant(product,q);return `<td>${priceInput(product,v,currency,`${q} pump`)}</td>`}).join('')}<td>${saveButton(product)}</td></tr>`).join('')+'</tbody></table>';
    }else{
      html=`<table class="pricelist-table manifold-table"><thead><tr><th>Tank</th><th>Rarity</th><th>Fitting Price</th><th></th></tr></thead><tbody>`+rows.map(product=>{const v=findVariant(product,'FITTING');return `<tr data-manifold-row="${esc(product.id)}"><td><b>${esc(product.model)}</b></td><td>${raritySelect(product)}</td><td>${priceInput(product,v,currency,'Tank fitting')}</td><td>${saveButton(product)}</td></tr>`}).join('')+'</tbody></table>';
    }
    if(!rows.length&&['flexible','strainer'].includes(activeTable))html='<div class="notice">No '+(activeTable==='flexible'?'Flexible':'Strainer')+' price rows are loaded. Run V40702_SUPABASE_MIGRATION.sql, then sign out and back in.</div>';
    host.innerHTML=html;host.querySelectorAll('[data-save-manifold]').forEach(button=>button.addEventListener('click',()=>saveRow(button.dataset.saveManifold,button)));host.querySelectorAll('input').forEach(input=>input.addEventListener('input',updateCompletion));applyAuthority();updateCompletion();
  }
  function completion(currency){let total=0,filled=0;['branch','flexible','strainer','header','tank_fitting'].forEach(section=>products(section).forEach(product=>(product.variants||[]).forEach(v=>{if(!Object.prototype.hasOwnProperty.call(v,fieldFor(currency)))return;total++;if(isFilled(v[fieldFor(currency)]))filled++})));if(currency===currentCurrency())document.querySelectorAll('#manifoldPriceTableHost [data-manifold-product]').forEach(input=>{const product=(secureData.manifoldProducts||[]).find(row=>row.id===input.dataset.manifoldProduct),variant=findVariant(product,input.dataset.manifoldVariant),old=isFilled(variant?.[fieldFor(currency)]),now=isFilled(input.value);filled+=Number(now)-Number(old)});return {filled:Math.max(0,filled),total}}
  function updateCompletion(){const box=$('manifoldPriceListCount');if(!box)return;box.innerHTML=`Editing ${currentCurrency()} · `+['USD','RMB','MYR'].map(c=>{const x=completion(c);return `${c} ${x.filled}/${x.total}`}).join(' · ')}
  function renderPriceList(){
    if(!$('manifoldPriceList'))return;const currency=currentCurrency();$('manifoldPriceCurrency').value=currency;$('manifoldUsdMultiplier').value=Number(rates().USD||5.8).toFixed(4);$('manifoldRmbMultiplier').value=Number(rates().RMB||.65).toFixed(4);document.querySelectorAll('[data-manifold-table]').forEach(b=>b.classList.toggle('active',b.dataset.manifoldTable===activeTable));renderPriceTable();
  }
  function applyAuthority(){const editable=isOwner();document.querySelectorAll('#manifoldPriceList input,#manifoldPriceList select').forEach(control=>{if(control.id==='manifoldPriceCurrency')return;control.disabled=!editable});document.querySelectorAll('#manifoldPriceList [data-save-manifold],#saveManifoldUsdMultiplier,#saveManifoldRmbMultiplier').forEach(button=>button.style.display=editable?'grid':'none')}
  function nullable(value,label){const text=String(value??'').trim();if(text==='')return null;const number=Number(text);if(!Number.isFinite(number)||number<0)throw new Error(`${label} must be blank or zero and above.`);return number}
  async function saveRow(id,button){
    if(!isOwner())return;const product=(secureData.manifoldProducts||[]).find(row=>row.id===id),row=document.querySelector(`[data-manifold-row="${CSS.escape(id)}"]`);if(!product||!row)return;ensureHeaderVariants(product);const variants=JSON.parse(JSON.stringify(product.variants||[])),currency=currentCurrency(),field=fieldFor(currency);
    try{if(product.section==='sizing')row.querySelectorAll('[data-manifold-sizing]').forEach(select=>{const v=findVariant({variants},select.dataset.manifoldSizing);if(v)v.resultDn=select.value});else row.querySelectorAll('[data-manifold-product]').forEach(input=>{const v=findVariant({variants},input.dataset.manifoldVariant);if(v)v[field]=nullable(input.value,input.getAttribute('aria-label')||'Price')})}catch(error){message(error.message,'error');return}
    const rarity=validRarity(row.querySelector('[data-manifold-rarity]')?.value||product.rarity),client=window.KeySuiteAuth?.getClient?.();if(!client){message('Supabase is not connected.','error');return}const original=button.innerHTML;button.disabled=true;button.textContent='…';
    try{const {error}=await client.rpc('keysuite_save_manifold_product_v213',{p_product_id:id,p_variants:variants,p_rarity:rarity});if(error)throw error;product.variants=variants;product.rarity=rarity;window.KeySuitePricing?.syncPriceListSettings?.({manifoldProducts:secureData.manifoldProducts});message(`${product.model} saved.`,'info');renderPriceTable();updateProduct()}catch(error){console.error(error);message(`${error.message||error}. Run V213_SUPABASE_MIGRATION.sql first.`,'error')}finally{button.disabled=false;button.innerHTML=original}
  }
  async function saveMultiplier(currency){if(!isOwner())return;const input=$(currency==='USD'?'manifoldUsdMultiplier':'manifoldRmbMultiplier'),value=Number(input?.value);if(!Number.isFinite(value)||value<=0){message(`${currency} rate must be greater than zero.`,'error');return}const client=window.KeySuiteAuth?.getClient?.();if(!client)return;try{const {data,error}=await client.rpc('keysuite_save_product_pricelist_multiplier_v119',{p_product_code:'MANIFOLD',p_currency:currency,p_multiplier:value});if(error)throw error;const saved=Array.isArray(data)?data[0]:data||{};secureData.productMultipliers=secureData.productMultipliers||{};secureData.productMultipliers.MANIFOLD={USD:Number(saved.usd_multiplier??rates().USD),RMB:Number(saved.rmb_multiplier??rates().RMB),MYR:1};if(window.KEYSUITE_SECURE_DATA)window.KEYSUITE_SECURE_DATA.productMultipliers=secureData.productMultipliers;window.KeySuitePricing?.syncPriceListSettings?.({productMultipliers:secureData.productMultipliers});window.KeySuiteCategories?.render?.();message(`MANIFOLD ${currency} rate saved.`,'info');renderPriceList();updateProduct()}catch(error){message(`${error.message||error}. Run V213_SUPABASE_MIGRATION.sql first.`,'error')}}

  function applyDefaultState(control){if(!control)return;const update=()=>control.classList.toggle('non-default-selection',String(control.value)!==String(control.dataset.defaultValue||''));control.addEventListener('change',update);update()}

  function bind(){if(bound)return;bound=true;
    ['manifoldConnection','manifoldSuctionDn','manifoldDischargeDn','manifoldHeaderDn','manifoldPumpQty','manifoldTankSize','manifoldRarity'].forEach(id=>$(id)?.addEventListener('change',updateProduct));
    $('manifoldMaterial')?.addEventListener('change',()=>{refreshHeaderOptions();updateProduct()});
    document.querySelectorAll('#productManifold [data-manifold-option]').forEach(input=>input.addEventListener('change',()=>{const next=getGlobalOptions();next[input.dataset.manifoldOption]=!!input.checked;setGlobalOptions(next,{source:'product'});updateProduct()}));
    ['manifoldMaterial','manifoldConnection','manifoldHeaderDn','manifoldPumpQty','manifoldRarity'].forEach(id=>applyDefaultState($(id)));
    $('manifoldAddAssembly')?.addEventListener('click',()=>addTo('assembly'));$('manifoldAddQuotation')?.addEventListener('click',()=>addTo('quotation'));
    $('manifoldPriceCurrency')?.addEventListener('change',event=>{localStorage.setItem('ks_manifold_price_currency',validCurrency(event.target.value));renderPriceList()});
    $('saveManifoldUsdMultiplier')?.addEventListener('click',()=>saveMultiplier('USD'));$('saveManifoldRmbMultiplier')?.addEventListener('click',()=>saveMultiplier('RMB'));
    document.querySelectorAll('[data-manifold-table]').forEach(button=>button.addEventListener('click',()=>{activeTable=button.dataset.manifoldTable;renderPriceList()}));
  }
  function init(data,userAccess){secureData={...secureData,...(data||{})};(secureData.manifoldProducts||[]).forEach(product=>{ensureHeaderVariants(product);ensureAccessoryVariants(product)});access=userAccess||access;loadGlobalOptions();bind();syncOptionControls();renderProduct();renderPriceList()}
  function pageShown(id){if(id==='productManifold')renderProduct();if(id==='manifoldPriceList')renderPriceList()}
  window.KeySuiteManifold={init,pageShown,renderProduct,renderPriceList,findConfiguredPrice,buildConfiguredItem,connectionForShutoffHead,connectionLabel,description,headerSizes,getGlobalOptions,setGlobalOptions,normalizeOptions};
})();
