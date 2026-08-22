/* KeySuite V4.08.09 — cumulative Multi-Brand runtime. Keylargo Baseplate remains directly accessible even when OEM Brand/Series choice is locked. */
(() => {
  'use strict';
  if (window.__KEYSUITE_V394410_MULTIBRAND__) return;
  window.__KEYSUITE_V394410_MULTIBRAND__=true;

  const VERSION='4.12.26';
  const $=id=>document.getElementById(id);
  const clone=v=>JSON.parse(JSON.stringify(v??{}));
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const roundUp01=v=>Math.ceil((num(v)-1e-10)*10)/10;
  const roundUp10=v=>Math.ceil((num(v)-1e-9)/10)*10;
  const role=()=>String(window.KEYSUITE_ACCESS?.role||'viewer').toLowerCase();
  const permission=key=>window.KeySuitePermissions?.level?.(key,role())||(role()==='owner'?'full':'none');
  const canManagePrice=()=>['full','all'].includes(permission('manage_price_list'));
  const canManageCustomerBrand=()=>['full','all'].includes(permission('company_pricing'));
  const companyId=()=>String(window.KEYSUITE_PROFILE?.company_id||window.KEYSUITE_ACCESS?.company_id||'');
  const client=()=>window.KeySuiteAuth?.getClient?.()||null;
  const authority=()=>window.KeySuiteAuthority||null;
  const brandSeriesLocked=()=>!!authority()?.brandSeriesLocked?.();
  const canUseProduct=()=>authority()?.can?.('use_product')??true;
  const resolveAuthorityTarget=(brandId,family)=>authority()?.resolveBrandSeries?.(brandId,String(family||'').toUpperCase())||null;
  const activeBrands=()=>state.brands.filter(b=>b.active!==false).slice().sort((a,b)=>{
    const order=x=>String(x.brand_key||'')==='b.g.reich'?0:String(x.brand_key||'')==='tesk'?1:String(x.brand_key||'')==='o.k. pump'?2:String(x.brand_key||'')==='vec'?3:String(x.brand_key||'')==='keylargo'?4:10;
    return order(a)-order(b)||String(a.brand_name).localeCompare(String(b.brand_name));
  });
  // Keylargo is a separate house-product group in the left Product panel, not an OEM selling brand.
  const commercialBrands=()=>activeBrands().filter(b=>String(b.brand_key||'').toLowerCase()!=='keylargo');
  const byBrandId=id=>state.brands.find(b=>String(b.id)===String(id))||null;
  const brandByKey=key=>state.brands.find(b=>String(b.brand_key||'').toLowerCase()===String(key||'').toLowerCase())||null;
  const masterBrand=()=>state.brands.find(b=>b.brand_type==='master'&&b.active!==false)||commercialBrands()[0]||activeBrands()[0]||null;
  const customerId=()=>String($('companySettingsCompanySelect')?.value||window.KeySuiteApp?.getPricingCustomerId?.()||$('qCustomer')?.value||'');
  const quoteCustomerId=()=>String(window.KeySuiteApp?.getPricingCustomerId?.()||$('qCustomer')?.value||'');

  const DEFAULT_GENERAL={usdActual:4.5,usdBased:4.5,rmbActual:.65,rmbBased:.65,fuelPrice:2,fuelBasePrice:2};
  const state={
    initialized:false,loading:false,loadPromise:null,coreReady:false,coreError:'',general:{...DEFAULT_GENERAL},generalEditing:false,generalHoldTimer:null,generalHoldTick:null,generalHoldStarted:0,
    brands:[],series:[],mappings:[],assignments:new Map(),customerMargins:new Map(),
    baseMultipliers:{},effectiveMultipliers:{},selectedBrandId:'',selectedFamily:'',
    pricingWrapped:false,appWrapped:false,applyingRates:false,applyingMargin:false,quoteObserver:null,customerObserver:null,productDisplayObserver:null,lastCompanyCustomer:'',lastQuoteCustomer:'',mappingSort:{key:'brand',dir:1}
  };

  function msg(id,text,type=''){
    const n=$(id); if(!n)return; n.textContent=text||''; n.className=`auth-message ${text?'show ':''}${type}`.trim();
  }
  function multibrandDbError(error){
    const text=String(error?.message||error||'Database error');
    return error?.code==='PGRST202'||/keysuite_save_oem_series_mapping_v40404|keysuite_save_oem_brand_v40404|schema cache/i.test(text)?`${text}. Run V40404_SUPABASE_MIGRATION.sql first.`:text;
  }
  function effectiveRate(base,currency){
    const cur=String(currency||'').toUpperCase(); if(cur==='MYR')return 1;
    const actual=cur==='USD'?state.general.usdActual:state.general.rmbActual;
    const based=cur==='USD'?state.general.usdBased:state.general.rmbBased;
    if(!(num(base)>0)||!(actual>0)||!(based>0))return num(base);
    return roundUp01(num(base)*(actual/based));
  }
  function buildEffectiveMultipliers(book=state.baseMultipliers){
    const out={}; Object.entries(book||{}).forEach(([family,rates])=>{
      out[family]={...rates,USD:effectiveRate(rates?.USD,'USD'),RMB:effectiveRate(rates?.RMB,'RMB'),MYR:num(rates?.MYR,1)||1};
    }); return out;
  }
  function currentBrand(){return byBrandId(state.selectedBrandId)||masterBrand();}
  function isMasterBrand(b){return !!b&&(String(b.brand_type||'').toLowerCase()==='master'||String(b.brand_key||'').toLowerCase()==='b.g.reich'||String(b.brand_name||'').toLowerCase()==='b.g.reich');}
  function sourceOfRow(row){try{return JSON.parse(row?.dataset?.pricingSource||'{}')}catch(_){return {}}}
  function pumpDataOfRow(row){try{return JSON.parse(row?.dataset?.pumpData||'{}')}catch(_){return {}}}
  function sourceFamily(source,row=null){return String(source?.product_family||source?.family||source?.productFamily||row?.dataset?.productFamily||'').toUpperCase()}
  function inferFamilyFromPage(page=''){
    const map={productChc:'CHC',productEs:'ES',productMotor:'MOTOR',productGws:'GWS',productKeyplc:'KEYPLC',productManifold:'MANIFOLD',productCoupling:'COUPLING',productBaseplate:'BASEPLATE',selector:'CHC',selectorEs:'ES'};
    return map[page]||'';
  }
  function inferSeries(model,source={}){
    const raw=String(source.material||source.variant||'').toUpperCase(); if(['CHC','CHCS','CHCN'].includes(raw))return raw;
    const m=String(model||'').trim().match(/^(CHCS|CHCN|CHC)\b/i); return m?m[1].toUpperCase():String(source.master_series||'').toUpperCase();
  }
  function familyMapping(brandId,family,series=''){
    const rows=state.mappings.filter(m=>String(m.brand_id)===String(brandId)&&m.active!==false&&String(m.master_family||'').toUpperCase()===String(family||'').toUpperCase());
    if(!rows.length)return null; const wanted=String(series||'').toUpperCase();
    return rows.find(m=>String(m.master_series||'').toUpperCase()===wanted)||rows[0]||null;
  }
  function brandSeriesRow(brandId,family){
    return state.series.find(r=>String(r.brand_id)===String(brandId)&&r.active!==false&&String(r.product_group||'').toUpperCase()===String(family||'').toUpperCase())||null;
  }
  function brandSeriesFallback(brand,family){
    const fam=String(family||'').toUpperCase(),key=String(brand?.brand_key||brand?.brand_name||'').trim().toLowerCase();
    if(fam==='ES')return 'ES';
    if(fam==='CHC'){
      if(isMasterBrand(brand))return 'CHC';
      if(key==='tesk')return 'SVM';
      if(['o.k. pump','o.k.pump','ok pump','vec'].includes(key))return 'VMS';
    }
    if(fam==='MOTOR')return 'Motor';
    const rows=state.mappings.filter(m=>String(m.brand_id)===String(brand?.id)&&m.active!==false&&String(m.master_family||'').toUpperCase()===fam);
    const preferred=rows.find(m=>String(m.master_series||'').toUpperCase()===fam)||rows[0];
    return String(preferred?.selling_series||preferred?.master_series||fam);
  }
  function brandSeriesFor(brandOrId,family){
    const brand=typeof brandOrId==='object'?brandOrId:(byBrandId(brandOrId)||masterBrand());
    const row=brandSeriesRow(brand?.id,family);
    return String(row?.brand_series||brandSeriesFallback(brand,family)||String(family||'')).trim();
  }
  function chcMasterSeriesFromMaterial(material=''){
    const v=String(material||'').trim().toUpperCase().replace(/\s+/g,' ');
    if(/(?:CAST\s*IRON|\bCI\b).*CONNECTION/.test(v))return 'CHC';
    if(/^SS\s*316$/.test(v))return 'CHCN';
    if(/^SS\s*304$/.test(v))return 'CHCS';
    return 'CHC';
  }
  function currentChcMaterial(){
    for(const id of ['productMaterial','pumpMaterial','ksDashMaterial']){const el=$(id);if(el&&el.offsetParent!==null&&String(el.value||'').trim())return String(el.value).trim();}
    return sessionStorage.getItem('keysuite-v3944-chc-material')||$('productMaterial')?.value||$('pumpMaterial')?.value||$('ksDashMaterial')?.value||'SS304 (Cast Iron Connection)';
  }
  function currentMasterSeries(family){return String(family||'').toUpperCase()==='CHC'?chcMasterSeriesFromMaterial(currentChcMaterial()):String(family||'').toUpperCase();}
  function marginKey(cid,bid){return `${String(cid)}::${String(bid)}`}
  function customerBrandMargin(cid,bid){
    const key=marginKey(cid,bid); if(state.customerMargins.has(key))return num(state.customerMargins.get(key),0);
    return 0;
  }
  function rowBrandId(row){
    const source=sourceOfRow(row),pump=pumpDataOfRow(row);
    return String(row?.dataset?.v391BrandId||source.v391_brand_id||pump.keysuite_brand_id||'');
  }
  function setSelectedBrand(brandId,family='',routePage=''){
    let fam=String(family||'').toUpperCase(),target=resolveAuthorityTarget(brandId,fam);
    if(brandSeriesLocked()){if(!target)return false;brandId=target.brandId;fam=target.family;}
    const brand=byBrandId(brandId)||(brandSeriesLocked()?null:masterBrand()); if(!brand)return false;
    state.selectedBrandId=String(brand.id); state.selectedFamily=fam;
    sessionStorage.setItem('keysuite-v391-product-brand',state.selectedBrandId);
    sessionStorage.setItem('keysuite-v391-product-family',state.selectedFamily);
    postBrandContext(routePage||null);return true;
  }
  function brandContext(brandId=state.selectedBrandId,family=state.selectedFamily,materialOverride=''){
    let fam=String(family||'').toUpperCase(),target=resolveAuthorityTarget(brandId,fam);
    if(brandSeriesLocked()){if(!target)return null;brandId=target.brandId;fam=target.family;}
    const brand=byBrandId(brandId)||(brandSeriesLocked()?null:masterBrand());
    const material=fam==='CHC'?String(materialOverride||currentChcMaterial()||'SS304 (Cast Iron Connection)').trim():'';
    const masterSeries=fam==='CHC'?chcMasterSeriesFromMaterial(material):fam;
    const map=familyMapping(brand?.id,fam,masterSeries);
    const sellingSeries=isMasterBrand(brand)?(fam==='CHC'?masterSeries:fam):String(map?.selling_series||map?.master_series||masterSeries||fam);
    const brandSeries=brandSeriesFor(brand,fam);
    return brand?{id:String(brand.id),name:String(brand.brand_name||''),key:String(brand.brand_key||''),logo:String(brand.logo_data||''),countryOfOrigin:String(brand.country_of_origin||''),family:fam,brandSeries,sellingSeries,masterSeries:String(map?.master_series||masterSeries||''),material,templateId:String(brand.quotation_template_id||'')}:null;
  }
  function postBrandContext(page=null,materialOverride=''){
    const ctx=brandContext(state.selectedBrandId,state.selectedFamily,materialOverride); if(!ctx)return;
    // V3.9.4.4.3: targeted/event-driven handoff only. Never sweep every iframe.
    const send=frame=>{try{if(frame?.contentWindow)frame.contentWindow.postMessage({type:'KEYSUITE_V393_BRAND_CONTEXT',brand:ctx},'*')}catch(_){}};
    if(['productChc','selector'].includes(page))send($('selectorFrame'));
    if(['productEs','selectorEs'].includes(page))send($('selectorEsFrame'));
    try{window.dispatchEvent(new CustomEvent('KEYSUITE_V393_BRAND_CONTEXT_CHANGED',{detail:{...ctx,page:page||''}}));}catch(_){}
    decorateProductDisplay();
  }

  function stampRowBrand(row,brandId=state.selectedBrandId,family=state.selectedFamily,{force=false}={}){
    if(!row)return; const existing=rowBrandId(row); if(existing&&!force)return;
    const brand=byBrandId(brandId)||masterBrand(); if(!brand)return;
    const source=sourceOfRow(row),pump=pumpDataOfRow(row),detectedFamily=sourceFamily(source,row)||String(family||'').toUpperCase();
    const rawModel=row.querySelector('.item-model')?.value||pump.quotation_model||pump.model||'';
    const mapping=familyMapping(brand.id,detectedFamily,inferSeries(rawModel,source));
    const masterSeries=String(mapping?.master_series||inferSeries(rawModel,source)||'');
    const sellingSeries=String(mapping?.selling_series||masterSeries||'');
    row.dataset.v391BrandId=String(brand.id); row.dataset.v391BrandName=String(brand.brand_name||''); row.dataset.v391Family=detectedFamily;
    source.v391_brand_id=String(brand.id); source.v391_brand_name=String(brand.brand_name||''); source.v391_brand_logo=String(brand.logo_data||''); source.v391_brand_country_of_origin=String(brand.country_of_origin||''); source.v391_product_family=detectedFamily; source.v391_master_series=masterSeries; source.v391_selling_series=sellingSeries;
    pump.keysuite_brand_id=String(brand.id); pump.keysuite_brand_name=String(brand.brand_name||''); pump.keysuite_brand_logo=String(brand.logo_data||''); pump.keysuite_brand_country_of_origin=String(brand.country_of_origin||''); pump.keysuite_product_family=detectedFamily; pump.keysuite_master_series=masterSeries; pump.keysuite_selling_series=sellingSeries;
    if(Object.keys(source).length)row.dataset.pricingSource=JSON.stringify(source);
    if(Object.keys(pump).length)row.dataset.pumpData=JSON.stringify(pump);
    renderRowBrandChip(row); mapRowIdentity(row);
    const brandedPump=pumpDataOfRow(row);if(Object.keys(brandedPump).length){brandedPump.keysuite_brand_id=String(brand.id);brandedPump.keysuite_brand_name=String(brand.brand_name||'');brandedPump.keysuite_brand_logo=String(brand.logo_data||'');brandedPump.keysuite_brand_country_of_origin=String(brand.country_of_origin||'');brandedPump.keysuite_product_family=detectedFamily;brandedPump.keysuite_master_series=masterSeries;brandedPump.keysuite_selling_series=sellingSeries;brandedPump.quotation_model=row.querySelector('.item-model')?.value||brandedPump.quotation_model||brandedPump.model||'';row.dataset.pumpData=JSON.stringify(brandedPump);}
    applyBrandMargin(row,{resetBase:true});
    if(document.querySelectorAll('#quoteItems .quote-item').length===1&&brand.quotation_template_id){try{window.KeySuiteTemplates?.selectForCustomer?.(String(brand.quotation_template_id),{applyDefaults:false});}catch(_){}}
    postBrandContext();
  }
  function renderRowBrandChip(row){
    if(!row)return; const brand=byBrandId(rowBrandId(row)); if(!brand)return;
    let chip=row.querySelector('.v391-row-brand-chip'); if(!chip){chip=document.createElement('span');chip.className='v391-row-brand-chip no-print'; const model=row.querySelector('.item-model'); const host=model?.parentElement||row; host.appendChild(chip);} chip.textContent=brand.brand_name;
  }
  function reapplyQuoteCapacity(row){
    try{window.KeySuiteApp?.syncQuoteCapacityDescription?.(row)}catch(error){console.warn('[KeySuite V4.04.16] Unable to reapply quotation capacity after brand mapping.',error)}
  }
  function mapRowIdentity(row){
    const bid=rowBrandId(row),brand=byBrandId(bid); if(!row||!brand)return;
    const modelInput=row.querySelector('.item-model'),descInput=row.querySelector('.item-description'); if(!modelInput||!descInput)return;
    const source=sourceOfRow(row),family=sourceFamily(source,row); if(!family||family==='MANUAL'||family==='ASSEMBLY')return;
    if(!row.dataset.v391MasterModel)row.dataset.v391MasterModel=source.v391_master_model||source.v390_master_model||modelInput.value||'';
    if(!row.dataset.v391MasterDescription)row.dataset.v391MasterDescription=source.v391_master_description||source.v390_master_description||descInput.value||'';
    const baseModel=row.dataset.v391MasterModel,baseDesc=row.dataset.v391MasterDescription;
    source.v391_master_model=baseModel; source.v391_master_description=baseDesc; row.dataset.pricingSource=JSON.stringify(source);
    const master=masterBrand(); if(String(brand.id)===String(master?.id)){let masterDesc=baseDesc;if(['CHC','ES','MOTOR'].includes(family)&&!/B\.G\.Reich/i.test(masterDesc)){const lines=masterDesc.split('\n'),idx=Math.max(0,lines.findIndex(line=>line.trim()&&!/^Capacity:/i.test(line.trim())));if(lines[idx])lines[idx]=`B.G.Reich ${lines[idx].trim()}`;masterDesc=lines.join('\n');}modelInput.value=baseModel;descInput.value=masterDesc;reapplyQuoteCapacity(row);return;}
    const mapping=familyMapping(brand.id,family,inferSeries(baseModel,source));
    if(!mapping){modelInput.value=baseModel;descInput.value=baseDesc;reapplyQuoteCapacity(row);return;}
    const masterSeries=String(mapping.master_series||inferSeries(baseModel,source)||'').trim(),sellingSeries=String(mapping.selling_series||masterSeries).trim();
    let shownModel=baseModel,shownDesc=baseDesc;
    if(masterSeries&&sellingSeries){
      const re=masterSeries.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      shownModel=shownModel.replace(new RegExp(`^${re}\\b`,'i'),sellingSeries);
      if(masterSeries.toUpperCase()!==sellingSeries.toUpperCase())shownDesc=shownDesc.replace(new RegExp(`\\b${re}\\b`,'g'),sellingSeries);
    }
    shownDesc=shownDesc.replace(/B\.G\.Reich/gi,String(brand.brand_name||'B.G.Reich'));
    if(['CHC','ES','MOTOR'].includes(family)&&!new RegExp(String(brand.brand_name||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i').test(shownDesc)){
      const lines=shownDesc.split('\n'),idx=Math.max(0,lines.findIndex(line=>line.trim()&&!/^Capacity:/i.test(line.trim())));if(lines[idx])lines[idx]=`${brand.brand_name} ${lines[idx].trim()}`;shownDesc=lines.join('\n');
    }
    modelInput.value=shownModel; descInput.value=shownDesc; reapplyQuoteCapacity(row);
  }
  function calculateWithBrandMargin(source,brandMargin){
    const base=num(source?.base_myr,NaN);if(!(base>0))return null;
    const safe=v=>{v=num(v,0);return v>=0&&v<1?v:0};
    const rarity=String(source?.rarity||'many').toLowerCase();
    if(rarity==='fixed'||source?.fixed_price===true){const final=num(source?.calculated_price,base);return {withTransport:final,afterBrand:final,unrounded:final,final}}
    let value=base/(1-safe(source?.margin));
    if(rarity==='common'||rarity==='rare')value=value/(1-safe(source?.normal));
    if(rarity==='rare')value=value/(1-safe(source?.rare));
    const withTransport=value+num(source?.transport,0);
    const afterBrand=brandMargin>0&&brandMargin<1?withTransport/(1-brandMargin):withTransport;
    const afterCommission=source?.include_commission===false?afterBrand:afterBrand/(1-safe(source?.commission));
    const afterSet=source?.include_set_discount===false?afterCommission:afterCommission/(1-safe(source?.set_discount));
    const beforeFuel=source?.include_final_discount===false?afterSet:afterSet/(1-safe(source?.final_discount));
    const fuel=source?.include_fuel_charge===false?0:num(source?.fuel_charge,0),unrounded=beforeFuel+fuel;
    return {withTransport,afterBrand,unrounded,final:roundUp10(unrounded)};
  }
  function applyBrandMargin(row,{resetBase=false}={}){
    if(!row||state.applyingMargin)return;const price=row.querySelector('.item-price');if(!price)return;
    const bid=rowBrandId(row);if(!bid)return;const source=sourceOfRow(row),cid=quoteCustomerId(),margin=customerBrandMargin(cid,bid);
    state.applyingMargin=true;
    try{
      const adjusted=calculateWithBrandMargin(source,margin);
      if(adjusted){
        price.value=adjusted.final.toFixed(2);source.brand_margin=margin;source.after_transport_price=adjusted.withTransport;source.after_brand_margin_price=adjusted.afterBrand;source.unrounded_price=adjusted.unrounded;source.calculated_price=adjusted.final;row.dataset.pricingSource=JSON.stringify(source);
        if(margin>0){row.dataset.v391MarginApplied=String(margin);row.title=`${byBrandId(bid)?.brand_name||'Brand'} Margin ${(margin*100).toFixed(1)}% applied after Transport.`;}else{delete row.dataset.v391MarginApplied;if(/Margin .*applied/.test(row.title||''))row.title='';}
      }
      const keepSource=row.dataset.pricingSource||'';price.dispatchEvent(new Event('input',{bubbles:true}));if(keepSource)row.dataset.pricingSource=keepSource;
    }finally{state.applyingMargin=false;}
  }
  function applyAllRows({resetBase=false}={}){
    document.querySelectorAll('#quoteItems .quote-item').forEach(row=>{
      const existing=rowBrandId(row); if(existing){renderRowBrandChip(row);mapRowIdentity(row);applyBrandMargin(row,{resetBase});}
    });
  }

  function wrapPricing(){
    if(state.pricingWrapped||!window.KeySuitePricing)return; state.pricingWrapped=true;
    const originalInit=window.KeySuitePricing.init?.bind(window.KeySuitePricing),originalSync=window.KeySuitePricing.syncPriceListSettings?.bind(window.KeySuitePricing),originalRefresh=window.KeySuitePricing.refreshQuotePrices?.bind(window.KeySuitePricing);
    const originalFormula=window.KeySuitePricing.formula?.bind(window.KeySuitePricing);
    if(originalFormula)window.KeySuitePricing.formula=(...args)=>{const text=String(originalFormula(...args)||'');return text.includes('Brand Margin')?text:text.replace(/(\+\s*Transport)/i,'$1 → ÷ (1 − Brand Margin)');};
    if(originalInit)window.KeySuitePricing.init=(data={},access)=>{
      let next=data||{}; if(next.productMultipliers){state.baseMultipliers=clone(next.productMultipliers);state.effectiveMultipliers=buildEffectiveMultipliers();next={...next,productMultipliers:clone(state.effectiveMultipliers)};}
      next={...next,fuel_price:state.general.fuelPrice,fuel_base_price:state.general.fuelBasePrice}; const r=originalInit(next,access); setTimeout(()=>{applyEffectiveRates();applyAllRows({resetBase:true});hideOldFuel();},0);return r;
    };
    if(originalSync)window.KeySuitePricing.syncPriceListSettings=(next={})=>{
      if(state.applyingRates)return originalSync(next); if(next.productMultipliers){state.baseMultipliers=clone(next.productMultipliers);state.effectiveMultipliers=buildEffectiveMultipliers();next={...next,productMultipliers:clone(state.effectiveMultipliers)};}
      next={...next,fuel_price:state.general.fuelPrice,fuel_base_price:state.general.fuelBasePrice}; const r=originalSync(next);setTimeout(()=>{decorateProductRates();applyAllRows({resetBase:true});},0);return r;
    };
    if(originalRefresh)window.KeySuitePricing.refreshQuotePrices=(...args)=>{const r=originalRefresh(...args);setTimeout(()=>applyAllRows({resetBase:true}),0);return r;};
  }
  function wrapApp(){
    if(state.appWrapped||!window.KeySuiteApp)return; state.appWrapped=true;
    const original=window.KeySuiteApp.addExternalQuoteItem?.bind(window.KeySuiteApp);
    if(original)window.KeySuiteApp.addExternalQuoteItem=data=>{
      const chosenBrand=byBrandId(state.selectedBrandId)||masterBrand(),family=String(data?.productFamily||data?.pricingSource?.product_family||state.selectedFamily||'').toUpperCase();
      const copy={...(data||{})}; if(copy.pricingSource)copy.pricingSource={...copy.pricingSource,v391_brand_id:chosenBrand?.id||'',v391_brand_name:chosenBrand?.brand_name||'',v391_brand_logo:chosenBrand?.logo_data||'',v391_brand_country_of_origin:chosenBrand?.country_of_origin||'',v391_product_family:family};
      const row=original(copy); setTimeout(()=>{if(row)stampRowBrand(row,chosenBrand?.id,family,{force:true});},0); return row;
    };
  }

  function applyEffectiveRates(){
    if(!window.KeySuitePricing||state.applyingRates)return; if(!Object.keys(state.baseMultipliers).length)state.baseMultipliers=clone(window.KEYSUITE_SECURE_DATA?.productMultipliers||{});
    state.effectiveMultipliers=buildEffectiveMultipliers(); state.applyingRates=true;
    try{
      if(window.KEYSUITE_SECURE_DATA){window.KEYSUITE_SECURE_DATA.productMultipliers=clone(state.effectiveMultipliers);window.KEYSUITE_SECURE_DATA.fuel_price=state.general.fuelPrice;window.KEYSUITE_SECURE_DATA.fuel_base_price=state.general.fuelBasePrice;}
      window.KeySuitePricing.syncPriceListSettings?.({productMultipliers:clone(state.effectiveMultipliers),fuel_price:state.general.fuelPrice,fuel_base_price:state.general.fuelBasePrice});
    }finally{state.applyingRates=false;}
    renderEffectiveRates();decorateProductRates();
  }
  function decorateProductRates(){
    const map={CHC:['chcUsdMultiplier','chcRmbMultiplier'],ES:['esUsdMultiplier','esRmbMultiplier'],GWS:['gwsUsdMultiplier','gwsRmbMultiplier'],KEYPLC:['keyplcUsdMultiplier','keyplcRmbMultiplier'],MANIFOLD:['manifoldUsdMultiplier','manifoldRmbMultiplier'],MOTOR:['motorUsdMultiplier','motorRmbMultiplier'],COUPLING:['couplingUsdMultiplier','couplingRmbMultiplier']};
    Object.entries(map).forEach(([fam,ids])=>ids.forEach((id,i)=>{const input=$(id);if(!input)return;let note=$(`v391Effective_${id}`);if(!note){note=document.createElement('div');note.id=`v391Effective_${id}`;note.className='v391-effective-note';input.closest('div')?.appendChild(note);}const cur=i?'RMB':'USD',base=num(state.baseMultipliers?.[fam]?.[cur],num(input.value)),eff=effectiveRate(base,cur);note.innerHTML=`Base ${base.toFixed(cur==='USD'?2:3)} → <b>Effective ${eff.toFixed(1)}</b>`;}));
  }

  function injectStyle(){
    if($('v391Style'))return; const s=document.createElement('style');s.id='v391Style';s.textContent=`
      .v391-card{background:#fff;border:1px solid #dce4ec;border-radius:14px;padding:18px}.v391-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}.v391-pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}.v391-field label{display:block;font-weight:700;margin:0 0 6px}.v391-field input,.v391-field select{width:100%;box-sizing:border-box}.v391-table input,.v391-table select{min-width:88px}.v40401-sort{border:0;background:transparent;padding:0;font:inherit;font-weight:800;color:inherit;cursor:pointer;white-space:nowrap}.v40401-sort.active{color:#0f4c81}.v40401-map-delete.holding{background:#fee2e2!important;border-color:#dc2626!important;color:#991b1b!important}.v391-compact{display:grid;gap:9px;margin-top:10px}.v391-compact-head,.v391-compact-row{display:grid;grid-template-columns:110px minmax(115px,170px) minmax(115px,170px);gap:10px;align-items:center}.v391-compact-row>label{margin:0;font-weight:800}.v391-compact input{width:100%;box-sizing:border-box}.v391-fuel-compact .v391-compact-row{grid-template-columns:110px minmax(115px,170px)}.v391-note{font-size:12px;color:#64748b;margin-top:6px;line-height:1.4}.v391-chip{display:inline-flex;padding:4px 9px;border-radius:999px;background:#eaf4ff;border:1px solid #bfdbfe;font-size:12px;font-weight:800}.v391-general-locked input{background:#f3f4f6!important;color:#6b7280!important;cursor:not-allowed}.v391-row-brand-chip{display:inline-flex;margin:5px 0 0 8px;padding:2px 7px;border-radius:999px;background:#eef6ff;border:1px solid #bfdcff;color:#1e4f7a;font-size:10px;font-weight:800;vertical-align:middle}.v391-logo-preview{width:100%;height:120px;object-fit:contain;border:1px solid #dbe4ec;border-radius:10px;background:#fff;padding:12px}.v391-brand-logo-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.v392-logo-panel{display:grid;grid-template-columns:minmax(220px,320px) minmax(280px,1fr);gap:18px;align-items:start}.v392-logo-preview-box{border:1px solid #dbe4ec;border-radius:12px;background:#f8fafc;padding:12px}.v392-logo-help{font-size:12px;color:#64748b;line-height:1.5;margin-top:8px}@media(max-width:760px){.v392-logo-panel{grid-template-columns:1fr}}.v391-brand-tree{display:grid;gap:4px;padding:3px 0 4px}.v391-brand-tree details{border-radius:7px;overflow:hidden}.v391-brand-tree summary{list-style:none;cursor:pointer;padding:8px 11px;font:inherit;font-weight:400;color:#dbeafe;display:flex;align-items:center;gap:7px}.v391-brand-tree .v391-brand-root[open]>summary,.v391-brand-tree .v391-direct-brand-root[open]>summary{background:#5891D6;color:#fff}.v391-brand-tree .v391-brand-list>details>summary{font:inherit;font-weight:400;color:#fff}.v391-brand-tree summary::-webkit-details-marker{display:none}.v391-brand-tree summary:before{content:'▶';font-size:9px;opacity:.8}.v391-brand-tree details[open]>summary:before{content:'▼'}.v391-brand-tree .v391-brand-list>details>summary{padding-left:20px}.v391-brand-tree .v391-brand-root>summary,.v391-brand-tree .v391-direct-brand-root>summary{color:#fff}.v391-brand-tree .v391-family-btn{display:block;width:calc(100% - 18px);margin:1px 9px 3px;padding:7px 11px 7px 24px;text-align:left;border:0;border-radius:6px;background:transparent;color:#cbd5e1;cursor:pointer}.v391-brand-tree .v391-family-btn:hover,.v391-brand-tree .v391-family-btn.active{background:rgba(255,255,255,.12);color:#fff}.v391-brand-tree .v391-direct-product-btn{display:block;width:100%;margin:0;padding:8px 11px;text-align:left;border:0;border-radius:7px;background:transparent;color:#fff;cursor:pointer;font:inherit;font-weight:400}.v391-brand-tree .v391-direct-product-btn:hover,.v391-brand-tree .v391-direct-product-btn.active{background:rgba(255,255,255,.12);color:#fff}.v391-effective-note{font-size:11px;color:#475569;margin-top:4px}.v391-effective-note b{color:#0f766e}.v391-margin-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-top:12px}.v391-margin-item{border:1px solid #e2e8f0;border-radius:9px;padding:10px;background:#fbfdff}.v391-margin-item label{display:block;font-weight:800;margin-bottom:6px}.v391-margin-input-wrap{display:grid;grid-template-columns:1fr auto;gap:5px;align-items:center}.v391-margin-default{font-size:10px;color:#64748b;margin-top:5px}.fuel-inline-setting{display:none!important}@media(max-width:700px){.v391-pair{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }
  function hideOldFuel(){document.querySelectorAll('.fuel-inline-setting').forEach(n=>n.style.setProperty('display','none','important'));const card=document.querySelector('.key-module-card[data-go="companyPricing"] p');if(card&&/fuel price/i.test(card.textContent||''))card.textContent='Assign customer pricing categories and view protected product selling prices.';}

  function addDashboardCards(){
    const pg=document.querySelector('#priceListDashboard .pricelist-dashboard-grid'); if(pg&&!$('v391GeneralCard')){const b=document.createElement('button');b.id='v391GeneralCard';b.type='button';b.className='key-module-card';b.innerHTML='<span class="module-icon">GEN</span><h2>General Pricelist</h2><p>Currency Actual/Based, global Fuel Price and default Brand Margin.</p><span class="module-order">GLOBAL</span>';b.onclick=()=>showPage('generalPriceList');pg.prepend(b);}
    const kg=document.querySelector('#keyDashboard .key-dashboard-grid'); if(kg&&!$('v391BrandsCard')){const b=document.createElement('button');b.id='v391BrandsCard';b.type='button';b.className='key-module-card';b.innerHTML='<span class="module-icon">BR</span><h2>Brands</h2><p>Brand identity, logo, OEM family mapping and quotation template.</p><span class="module-order">MULTI-BRAND</span>';kg.appendChild(b);}const brandCard=$('v391BrandsCard');if(brandCard){brandCard.dataset.go='brandManagement';brandCard.onclick=()=>showPage('brandManagement');}
  }
  function addPages(){
    const main=document.querySelector('main'); if(!main)return;
    $('generalPriceList')?.remove(); $('brandManagement')?.remove();
    const general=document.createElement('section');general.id='generalPriceList';general.className='page';general.innerHTML=`
      <div class="key-back-row"><button class="btn secondary" id="v391BackPrice">← Price List</button></div>
      <div class="page-title-row"><div><h1>General Pricelist</h1><div class="muted">Global reference values used by all product pricelists.</div></div><div style="display:flex;gap:8px;align-items:center"><span class="v391-chip">V3.9.3</span><button class="btn secondary" id="v391UnlockGeneral">Hold 3s to Edit</button></div></div>
      <div id="v391GeneralMessage" class="auth-message"></div>
      <div id="v391GeneralEditor" class="v391-general-locked">
        <div class="v391-grid">
          <div class="v391-card"><h2>Currency Exchange</h2><div class="v391-compact"><div class="v391-compact-head"><span></span><b>Actual</b><b>Based</b></div><div class="v391-compact-row"><label>USD 1 = MYR</label><input id="v391UsdActual" type="number" min="0.000001" step="0.0001"><input id="v391UsdBased" type="number" min="0.000001" step="0.0001"></div><div class="v391-compact-row"><label>RMB 1 = MYR</label><input id="v391RmbActual" type="number" min="0.000001" step="0.0001"><input id="v391RmbBased" type="number" min="0.000001" step="0.0001"></div></div><div class="v391-note">Effective Product Rate = Base × (Actual ÷ Based), rounded UP to nearest 0.1. Base product rates are never overwritten.</div></div>
          <div class="v391-card"><h2>Fuel Price (RM/L)</h2><div class="v391-compact v391-fuel-compact"><div class="v391-compact-row"><label>Actual</label><input id="v391FuelActual" type="number" min="0" step="0.01"></div><div class="v391-compact-row"><label>Based</label><input id="v391FuelBased" type="number" min="0" step="0.01"></div></div><div class="v391-note">Single global Fuel Price source for KeySuite. The duplicate Company & Pricing Fuel Price is removed.</div></div>
        </div>
        <div class="v391-card" style="margin-top:16px"><div class="page-title-row"><div><h2 style="margin:0">Effective Product Exchange Rates</h2><div class="muted">Base rates remain editable in their own product pricelist.</div></div></div><div class="table-wrap"><table class="v391-table"><thead><tr><th>Pricelist</th><th>USD Base</th><th>USD Effective</th><th>RMB Base</th><th>RMB Effective</th></tr></thead><tbody id="v391EffectiveRates"></tbody></table></div></div>
        <div class="v391-card" style="margin-top:16px"><div class="page-title-row"><div><h2 style="margin:0">Default Brand Margin</h2><div class="muted">New/no-override customer margins fall back to these values.</div></div></div><div class="table-wrap"><table class="v391-table"><thead><tr><th>Brand</th><th>Default Margin %</th></tr></thead><tbody id="v391DefaultMarginRows"></tbody></table></div></div>
        <div class="actions" style="justify-content:flex-end;margin-top:14px"><button class="btn" id="v391SaveGeneral">Save General Pricelist</button></div>
      </div>`;main.appendChild(general);
    const brands=document.createElement('section');brands.id='brandManagement';brands.className='page';brands.innerHTML=`
      <div class="key-back-row"><button class="btn secondary" id="v391BackKey">← Key Dashboard</button></div>
      <div class="page-title-row"><div><h1>Brands</h1><div class="muted">Selected product brand controls quotation identity and curve/technical PDF logo.</div></div><button class="btn" id="v391AddBrand">+ Add Brand</button></div>
      <div id="v391BrandMessage" class="auth-message"></div>
      <div class="v391-card"><div class="table-wrap"><table class="v391-table"><thead><tr><th>Brand</th><th>Code</th><th>Type</th><th>Country of Origin</th><th>Quotation Template</th><th>Active</th><th></th></tr></thead><tbody id="v391BrandRows"></tbody></table></div><div class="v391-note">Country of Origin is brand-specific and is used in customer-facing technical/curve PDFs where that field is displayed.</div></div>
      <div class="v391-card" style="margin-top:16px"><div class="page-title-row"><div><h2 style="margin:0">Brand Logo</h2><div class="muted">Logo used by that brand's pump curve and technical PDFs.</div></div></div><div class="v392-logo-panel"><div><label>Select Brand</label><select id="v392LogoBrandSelect"></select><div class="v392-logo-help"><b>Brand Logo:</b> 900 × 200 px, transparent PNG preferred, JPG/WebP accepted, maximum 2 MB. Uploaded images are fitted proportionally into a 900 × 200 px canvas without stretching or cropping.</div></div><div class="v392-logo-preview-box"><img id="v392BrandLogoPreview" class="v391-logo-preview" alt="Brand logo preview"><div id="v393BrandLogoStatus" class="v392-logo-help"></div><input id="v392BrandLogoFile" type="file" accept="image/png,image/jpeg,image/webp" hidden><div class="v391-brand-logo-actions" style="margin-top:10px"><button class="btn secondary" id="v392UploadLogo" type="button">Upload / Replace</button><button class="btn secondary" id="v392RemoveLogo" type="button">Remove</button><button class="btn" id="v392SaveLogo" type="button">Save Logo</button></div></div></div></div>
      <div class="v391-card" style="margin-top:16px"><div class="page-title-row"><div><h2 style="margin:0">OEM Series Mapping</h2><div class="muted">Brand → Main Series → Sub Series → Model. Engineering names remain internal.</div></div><button class="btn" id="v391AddMapping">+ Add Mapping</button></div><div class="table-wrap"><table class="v391-table"><thead><tr><th><button class="v40401-sort active" type="button" data-map-sort="brand">Brand ↑</button></th><th><button class="v40401-sort" type="button" data-map-sort="family">Product Group</button></th><th><button class="v40401-sort" type="button" data-map-sort="series">Brand Series</button></th><th>Base Sub Series</th><th>Selling Sub Series</th><th>Active</th><th></th></tr></thead><tbody id="v391MappingRows"></tbody></table></div></div>`;main.appendChild(brands);
    $('v391BackPrice').onclick=()=>window.KeySuiteApp?.showPage?.('priceListDashboard'); $('v391BackKey').onclick=()=>window.KeySuiteApp?.showPage?.('keyDashboard');
    $('v392LogoBrandSelect').addEventListener('change',renderBrandLogoPanel);
    $('v392UploadLogo').onclick=()=>$('v392BrandLogoFile').click();
    $('v392BrandLogoFile').onchange=async()=>{const f=$('v392BrandLogoFile').files?.[0];if(!f)return;try{const data=await optimizeLogo(f);$('v392BrandLogoPreview').src=data;$('v392BrandLogoPreview').dataset.pending=data;msg('v391BrandMessage','Logo ready. Press Save Logo to store it.','info');}catch(e){msg('v391BrandMessage',e.message||String(e),'error')}};
    $('v392RemoveLogo').onclick=()=>{$('v392BrandLogoPreview').removeAttribute('src');$('v392BrandLogoPreview').dataset.pending='';$('v392BrandLogoPreview').dataset.remove='1';};
    $('v392SaveLogo').onclick=saveBrandLogoPanel;
    $('v391UnlockGeneral').addEventListener('pointerdown',startGeneralHold);['pointerup','pointerleave','pointercancel'].forEach(n=>$('v391UnlockGeneral').addEventListener(n,stopGeneralHold));$('v391UnlockGeneral').oncontextmenu=e=>e.preventDefault();
    $('v391SaveGeneral').onclick=saveGeneral; $('v391AddBrand').onclick=()=>addBrandRow(); $('v391AddMapping').onclick=()=>addMappingRow(); document.querySelectorAll('[data-map-sort]').forEach(b=>b.onclick=()=>setMappingSort(b.dataset.mapSort));
  }
  function showPage(id){window.KeySuiteApp?.showPage?.(id);if(id==='generalPriceList')renderGeneral();if(id==='brandManagement')renderBrands();}

  function stopGeneralHold(reset=true){
    if(state.generalHoldTimer)clearTimeout(state.generalHoldTimer);if(state.generalHoldTick)clearInterval(state.generalHoldTick);state.generalHoldTimer=state.generalHoldTick=null;
    const b=$('v391UnlockGeneral');if(b&&reset&&!state.generalEditing)b.textContent='Hold 3s to Edit';
  }
  function startGeneralHold(e){
    if(!canManagePrice()||state.generalEditing)return;if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();stopGeneralHold(false);state.generalHoldStarted=Date.now();
    const b=$('v391UnlockGeneral'),tick=()=>{const left=Math.max(0,3000-(Date.now()-state.generalHoldStarted));if(b)b.textContent=`Edit in ${(left/1000).toFixed(1)}s`;};tick();state.generalHoldTick=setInterval(tick,100);state.generalHoldTimer=setTimeout(()=>{stopGeneralHold(false);state.generalEditing=true;renderGeneral();msg('v391GeneralMessage','Editing enabled. Save when finished.','info');},3000);
  }
  function renderGeneral(){
    if(!$('v391UsdActual'))return; $('v391UsdActual').value=num(state.general.usdActual,4.5).toFixed(4);$('v391UsdBased').value=num(state.general.usdBased,4.5).toFixed(4);$('v391RmbActual').value=num(state.general.rmbActual,.65).toFixed(4);$('v391RmbBased').value=num(state.general.rmbBased,.65).toFixed(4);$('v391FuelActual').value=num(state.general.fuelPrice,2).toFixed(2);$('v391FuelBased').value=num(state.general.fuelBasePrice,2).toFixed(2);
    const editable=canManagePrice()&&state.generalEditing;['v391UsdActual','v391UsdBased','v391RmbActual','v391RmbBased','v391FuelActual','v391FuelBased'].forEach(id=>{$(id).readOnly=!editable;$(id).disabled=!canManagePrice();});$('v391GeneralEditor').classList.toggle('v391-general-locked',!editable);$('v391SaveGeneral').disabled=!editable;$('v391UnlockGeneral').disabled=!canManagePrice();$('v391UnlockGeneral').textContent=editable?'Editing Enabled':'Hold 3s to Edit';
    renderEffectiveRates();renderDefaultMargins(editable);
  }
  function renderEffectiveRates(){
    const body=$('v391EffectiveRates');if(!body)return;const labels={CHC:'CHC',ES:'ES',GWS:'GWS',KEYPLC:'KeyPLC',MANIFOLD:'Manifold',MOTOR:'Motor',COUPLING:'Coupling'};
    body.innerHTML=Object.keys(labels).map(f=>{const r=state.baseMultipliers?.[f]||{};return `<tr><td><b>${labels[f]}</b></td><td>${num(r.USD).toFixed(2)}</td><td><b>${effectiveRate(r.USD,'USD').toFixed(1)}</b></td><td>${num(r.RMB).toFixed(3)}</td><td><b>${effectiveRate(r.RMB,'RMB').toFixed(1)}</b></td></tr>`}).join('');
  }
  function renderDefaultMargins(editable=state.generalEditing){
    const body=$('v391DefaultMarginRows');if(!body)return;body.innerHTML=commercialBrands().map(b=>`<tr data-brand-id="${esc(b.id)}"><td><b>${esc(b.brand_name)}</b></td><td><input class="v391-default-margin" type="number" min="0" max="99.99" step="0.1" value="${(num(b.brand_premium)*100).toFixed(1)}" ${editable?'':'readonly'}></td></tr>`).join('');
  }
  async function saveGeneral(){
    if(!canManagePrice()||!state.generalEditing)return; const vals={usdA:num($('v391UsdActual').value,NaN),usdB:num($('v391UsdBased').value,NaN),rmbA:num($('v391RmbActual').value,NaN),rmbB:num($('v391RmbBased').value,NaN),fuelA:num($('v391FuelActual').value,NaN),fuelB:num($('v391FuelBased').value,NaN)};
    if(![vals.usdA,vals.usdB,vals.rmbA,vals.rmbB].every(v=>v>0)||![vals.fuelA,vals.fuelB].every(v=>v>=0))return msg('v391GeneralMessage','Check Actual/Based values. Currency must be > 0 and Fuel cannot be negative.','error');
    const c=client();if(!c)return msg('v391GeneralMessage','Supabase is not connected.','error'); const btn=$('v391SaveGeneral');btn.disabled=true;btn.textContent='Saving…';
    try{
      const {data,error}=await c.rpc('keysuite_save_general_pricing_v391',{p_usd_actual:vals.usdA,p_usd_based:vals.usdB,p_rmb_actual:vals.rmbA,p_rmb_based:vals.rmbB,p_fuel_price:vals.fuelA,p_fuel_base_price:vals.fuelB});if(error)throw error;
      const rows=[...document.querySelectorAll('#v391DefaultMarginRows tr')];for(const row of rows){const id=row.dataset.brandId,margin=num(row.querySelector('.v391-default-margin')?.value,0)/100;if(!(margin>=0&&margin<1))throw new Error('Brand Margin must be from 0% to below 100%.');const {error:e}=await c.from('ks_oem_brands').update({brand_premium:margin,updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId());if(e)throw e;const b=byBrandId(id);if(b)b.brand_premium=margin;}
      const saved=Array.isArray(data)?data[0]:data||{};state.general={usdActual:num(saved.general_usd_actual,vals.usdA),usdBased:num(saved.general_usd_based,vals.usdB),rmbActual:num(saved.general_rmb_actual,vals.rmbA),rmbBased:num(saved.general_rmb_based,vals.rmbB),fuelPrice:num(saved.fuel_price,vals.fuelA),fuelBasePrice:num(saved.fuel_base_price,vals.fuelB)};state.generalEditing=false;applyEffectiveRates();applyAllRows({resetBase:true});renderGeneral();renderCustomerMargins();msg('v391GeneralMessage','General Pricelist saved globally. Editing is locked again.','info');
    }catch(error){console.error(error);msg('v391GeneralMessage',multibrandDbError(error),'error');}
    finally{btn.textContent='Save General Pricelist';btn.disabled=!state.generalEditing;}
  }

  function templateOptions(selected=''){const t=window.KeySuiteTemplates?.getTemplates?.()||[];return '<option value="">Use customer/default template</option>'+t.filter(x=>x.status!=='disabled').map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(selected)?'selected':''}>${esc(x.template_name||x.name||x.id)}</option>`).join('')}
  function renderBrands(){const body=$('v391BrandRows');if(!body)return;body.innerHTML='';state.brands.slice().sort((a,b)=>String(a.brand_name).localeCompare(String(b.brand_name))).forEach(b=>addBrandRow(b));renderMappings();renderBrandLogoPanel();}
  function addBrandRow(b={}){
    const body=$('v391BrandRows');if(!body)return;const tr=document.createElement('tr');tr.dataset.brandId=b.id||'';tr.innerHTML=`<td><input class="v391-brand-name" value="${esc(b.brand_name||'')}"></td><td><input class="v391-brand-code" value="${esc(b.brand_code||'')}"></td><td><select class="v391-brand-type"><option value="master" ${b.brand_type==='master'?'selected':''}>Master</option><option value="oem" ${b.brand_type!=='master'?'selected':''}>OEM / Selling</option></select></td><td><input class="v391-brand-origin" value="${esc(b.country_of_origin||'')}" placeholder="e.g. China"></td><td><select class="v391-brand-template">${templateOptions(b.quotation_template_id||'')}</select></td><td><input class="v391-brand-active" type="checkbox" ${b.active!==false?'checked':''}></td><td><div style="display:flex;gap:6px"><button class="btn v391-save-brand">Save</button><button class="btn secondary v391-delete-brand">Delete</button></div></td>`;body.appendChild(tr);
    tr.querySelector('.v391-save-brand').onclick=()=>saveBrandRow(tr);tr.querySelector('.v391-delete-brand').onclick=()=>deleteBrandRow(tr); if(!canManagePrice())tr.querySelectorAll('input,select,button').forEach(el=>el.disabled=true);
  }
  async function optimizeLogo(file){
    if(file.size>2*1024*1024)throw new Error('Logo file must be 2 MB or smaller.');const url=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error('Unable to read logo.'));r.readAsDataURL(file)});const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('Unable to open logo image.'));i.src=url});const canvas=document.createElement('canvas');canvas.width=900;canvas.height=200;const ctx=canvas.getContext('2d');if(file.type!=='image/png'){ctx.fillStyle='#fff';ctx.fillRect(0,0,900,200)}else{ctx.clearRect(0,0,900,200)}const scale=Math.min(900/img.width,200/img.height),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale)),x=Math.round((900-w)/2),y=Math.round((200-h)/2);ctx.drawImage(img,x,y,w,h);return canvas.toDataURL(file.type==='image/png'?'image/png':'image/jpeg',.9);
  }
  function isSystemBrand(brand){return String(brand?.brand_key||'').toLowerCase()==='b.g.reich';}
  function currentSystemBrandLogo(){
    try{const saved=String(window.KeySuiteSelectorBrand?.getDefaultLogo?.()||'');if(saved)return saved;}catch(_){}
    for(const id of ['selectorFrame','selectorEsFrame','productSelectorFrame','productEsSelectorFrame']){
      try{const doc=$(id)?.contentDocument;if(!doc)continue;const imgs=[...doc.querySelectorAll('header img,.brand-wrap img,.brand img,img.brand-logo,img.tds-logo')];const img=imgs.find(x=>/reich|brand|logo/i.test(`${x.alt||''} ${x.getAttribute('src')||''}`))||imgs[0];if(img?.src)return img.src;}catch(_){}
    }
    return '';
  }
  function renderBrandLogoPanel(){
    const select=$('v392LogoBrandSelect'),preview=$('v392BrandLogoPreview'),status=$('v393BrandLogoStatus');if(!select||!preview)return;
    const current=select.value||commercialBrands()[0]?.id||activeBrands()[0]?.id||'';
    select.innerHTML=activeBrands().map(b=>`<option value="${esc(b.id)}" ${String(b.id)===String(current)?'selected':''}>${esc(b.brand_name)}</option>`).join('');
    if(current&&[...select.options].some(o=>o.value===String(current)))select.value=current;
    const brand=byBrandId(select.value),system=isSystemBrand(brand);preview.dataset.pending='';preview.dataset.remove='';
    if(system){
      const src=currentSystemBrandLogo();if(src)preview.src=src;else preview.removeAttribute('src');
      if(status)status.innerHTML='<b>Existing System Logo</b> — B.G.Reich reuses the exact logo already produced by the current CHC/ES PDF. Upload is disabled so the existing PDF output is not changed.';
    }else{
      if(brand?.logo_data)preview.src=brand.logo_data;else preview.removeAttribute('src');
      if(status)status.textContent=brand?.logo_data?'Uploaded brand logo. This logo is used only as the presentation layer; it never affects curve generation.':'No logo uploaded. PDF will fall back to the existing system logo without blocking curve generation.';
    }
    const disabled=!canManagePrice()||!brand||system;
    [$('v392UploadLogo'),$('v392RemoveLogo'),$('v392SaveLogo')].forEach(el=>{if(el)el.disabled=disabled});
    select.disabled=!canManagePrice()||!brand;
  }
  async function saveBrandLogoPanel(){
    const bid=$('v392LogoBrandSelect')?.value,brand=byBrandId(bid),c=client();if(!bid||!brand||!c||!canManagePrice())return;
    if(isSystemBrand(brand))return msg('v391BrandMessage','B.G.Reich uses the existing system CHC/ES PDF logo. No upload is required or allowed.','info');
    const preview=$('v392BrandLogoPreview');const remove=preview?.dataset.remove==='1';const logo=remove?'':(preview?.dataset.pending||brand.logo_data||'');const {error}=await c.from('ks_oem_brands').update({logo_data:logo,updated_at:new Date().toISOString()}).eq('id',bid).eq('company_id',companyId());if(error)return msg('v391BrandMessage',multibrandDbError(error),'error');msg('v391BrandMessage',`${brand.brand_name} logo saved.`,'info');await loadData();
  }
  async function saveBrandRow(tr){
    const c=client(),name=tr.querySelector('.v391-brand-name').value.trim();if(!c||!name)return;
    const existingId=tr.dataset.brandId||'',id=existingId||crypto.randomUUID(),existing=byBrandId(existingId||id);
    const payload={id,brand_name:name,brand_code:tr.querySelector('.v391-brand-code').value.trim(),brand_type:tr.querySelector('.v391-brand-type').value,country_of_origin:tr.querySelector('.v391-brand-origin')?.value.trim()||'',brand_premium:num(existing?.brand_premium,0),quotation_template_id:tr.querySelector('.v391-brand-template').value||'',logo_data:existing?.logo_data||'',active:tr.querySelector('.v391-brand-active').checked};
    const {data,error}=await c.rpc('keysuite_save_oem_brand_v40404',{p_brand:payload});
    if(error)return msg('v391BrandMessage',multibrandDbError(error),'error');
    tr.dataset.brandId=String(data?.id||id);msg('v391BrandMessage',`${name} saved.`,'info');await loadData({force:true});
  }
  async function deleteBrandRow(tr){const id=tr.dataset.brandId;if(!id){tr.remove();return}if(!confirm('Delete this brand and its OEM mappings?'))return;const {error}=await client().from('ks_oem_brands').delete().eq('id',id).eq('company_id',companyId());if(error)return msg('v391BrandMessage',multibrandDbError(error),'error');await loadData();}
  function mappingSortValue(m,key){const brand=byBrandId(m.brand_id),fam=String(m.master_family||'').toUpperCase();if(key==='brand')return String(brand?.brand_name||'');if(key==='family')return fam;if(key==='series')return brandSeriesFor(brand,fam);return ''}
  function setMappingSort(key){if(state.mappingSort.key===key)state.mappingSort.dir*=-1;else state.mappingSort={key,dir:1};renderMappings()}
  function renderMappingSortHeaders(){document.querySelectorAll('[data-map-sort]').forEach(b=>{const active=b.dataset.mapSort===state.mappingSort.key,label=b.dataset.mapSort==='brand'?'Brand':b.dataset.mapSort==='family'?'Product Group':'Brand Series';b.classList.toggle('active',active);b.textContent=label+(active?(state.mappingSort.dir>0?' ↑':' ↓'):'')})}
  function renderMappings(){const body=$('v391MappingRows');if(!body)return;body.innerHTML='';const {key,dir}=state.mappingSort;state.mappings.slice().sort((a,b)=>mappingSortValue(a,key).localeCompare(mappingSortValue(b,key),undefined,{numeric:true,sensitivity:'base'})*dir||String(a.master_series||'').localeCompare(String(b.master_series||''),undefined,{numeric:true})).forEach(m=>addMappingRow(m));renderMappingSortHeaders();}
  function brandOptions(selected=''){return commercialBrands().map(b=>`<option value="${esc(b.id)}" ${String(b.id)===String(selected)?'selected':''}>${esc(b.brand_name)}</option>`).join('')}
  function bindMappingDeleteHold(btn,tr){let timer=null,tick=null,start=0,completed=false;const reset=()=>{clearTimeout(timer);clearInterval(tick);timer=tick=null;btn.classList.remove('holding');if(!completed)btn.textContent='Hold 5s to Delete'};btn.addEventListener('pointerdown',e=>{if(btn.disabled||(e.pointerType==='mouse'&&e.button!==0))return;e.preventDefault();completed=false;start=Date.now();btn.classList.add('holding');const update=()=>{const left=Math.max(0,5000-(Date.now()-start));btn.textContent=`Delete in ${(left/1000).toFixed(1)}s`};update();tick=setInterval(update,100);timer=setTimeout(()=>{completed=true;clearInterval(tick);tick=null;btn.classList.remove('holding');deleteMapping(tr)},5000)});['pointerup','pointerleave','pointercancel'].forEach(n=>btn.addEventListener(n,reset));btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation()});btn.addEventListener('contextmenu',e=>e.preventDefault())}
  function addMappingRow(m={}){const body=$('v391MappingRows');if(!body)return;const tr=document.createElement('tr');tr.dataset.mappingId=m.id||'';tr.dataset.originalBrandId=m.brand_id||'';tr.dataset.originalFamily=String(m.master_family||'').toUpperCase();const brand=byBrandId(m.brand_id),fam=String(m.master_family||'CHC').toUpperCase(),main=brandSeriesFor(brand,fam);tr.innerHTML=`<td><select class="v391-map-brand">${brandOptions(m.brand_id)}</select></td><td><select class="v391-map-family">${['CHC','ES'].map(f=>`<option ${fam===f?'selected':''}>${f}</option>`).join('')}</select></td><td><input class="v391-map-brand-series" value="${esc(main)}" placeholder="e.g. SVM"></td><td><input class="v391-map-master" value="${esc(m.master_series||'')}" placeholder="e.g. CHC"></td><td><input class="v391-map-selling" value="${esc(m.selling_series||'')}" placeholder="e.g. SVMT"></td><td><input class="v391-map-active" type="checkbox" ${m.active!==false?'checked':''}></td><td><div style="display:flex;gap:6px"><button class="btn v391-save-map">Save</button><button class="btn secondary v391-delete-map v40401-map-delete">Hold 5s to Delete</button></div></td>`;body.appendChild(tr);const syncMain=()=>{const b=byBrandId(tr.querySelector('.v391-map-brand').value),f=tr.querySelector('.v391-map-family').value;tr.querySelector('.v391-map-brand-series').value=brandSeriesFor(b,f)};tr.querySelector('.v391-map-brand').addEventListener('change',syncMain);tr.querySelector('.v391-map-family').addEventListener('change',syncMain);tr.querySelector('.v391-save-map').onclick=()=>saveMapping(tr);bindMappingDeleteHold(tr.querySelector('.v391-delete-map'),tr);if(!canManagePrice())tr.querySelectorAll('input,select,button').forEach(el=>el.disabled=true);}
  async function cleanupBrandSeriesIfUnused(brandId,family){if(!brandId||!family)return;const c=client();if(!c)return;const {data,error}=await c.from('ks_oem_brand_family_map').select('id').eq('company_id',companyId()).eq('brand_id',brandId).eq('master_family',family).eq('active',true).limit(1);if(error)return;if(!(data||[]).length)await c.from('ks_oem_brand_series').delete().eq('company_id',companyId()).eq('brand_id',brandId).eq('product_group',family)}
  async function saveMapping(tr){const c=client(),existingId=tr.dataset.mappingId||'',id=existingId||crypto.randomUUID(),oldBrand=tr.dataset.originalBrandId||'',oldFamily=tr.dataset.originalFamily||'',payload={id,brand_id:tr.querySelector('.v391-map-brand').value,master_family:tr.querySelector('.v391-map-family').value,brand_series:tr.querySelector('.v391-map-brand-series').value.trim(),master_series:tr.querySelector('.v391-map-master').value.trim(),selling_series:tr.querySelector('.v391-map-selling').value.trim(),active:tr.querySelector('.v391-map-active').checked,old_brand_id:oldBrand||null,old_master_family:oldFamily||null};if(!c)return msg('v391BrandMessage','Supabase is not available.','error');if(!payload.brand_series)return msg('v391BrandMessage','Brand Series is required.','error');if(!payload.master_series)return msg('v391BrandMessage','Base Sub Series is required.','error');if(!payload.selling_series)return msg('v391BrandMessage','Selling Sub Series is required.','error');const {data,error}=await c.rpc('keysuite_save_oem_series_mapping_v40404',{p_mapping:payload});if(error)return msg('v391BrandMessage',multibrandDbError(error),'error');tr.dataset.mappingId=String(data?.id||id);tr.dataset.originalBrandId=payload.brand_id;tr.dataset.originalFamily=String(payload.master_family||'').toUpperCase();await loadData({force:true});msg('v391BrandMessage','OEM Series / Sub Series mapping saved.','info');}
  async function deleteMapping(tr){if(!tr.dataset.mappingId){tr.remove();return}const c=client(),brandId=tr.querySelector('.v391-map-brand')?.value||tr.dataset.originalBrandId,family=tr.querySelector('.v391-map-family')?.value||tr.dataset.originalFamily;const {error}=await c.from('ks_oem_brand_family_map').delete().eq('id',tr.dataset.mappingId).eq('company_id',companyId());if(error)return msg('v391BrandMessage',multibrandDbError(error),'error');await cleanupBrandSeriesIfUnused(brandId,family);await loadData({force:true});msg('v391BrandMessage','OEM mapping deleted. Product > Brand availability refreshed.','info');}

  function addCustomerBrandSection(){
    const editor=$('companyPricingEditor');if(!editor)return; let section=$('v391CustomerBrandPricing');if(!section){section=document.createElement('div');section.id='v391CustomerBrandPricing';section.innerHTML='<hr style="border:0;border-top:1px solid #e2e8f0;margin:16px 0"><h3 style="margin:0">Brand Margin</h3><div class="muted">One margin for every active brand. The selected product brand determines which margin is used.</div><div id="v391CustomerMarginGrid" class="v391-margin-grid"></div><div style="margin-top:14px"><label for="v391CustomerAssignedBrand"><b>OEM / Assigned Brand</b></label><select id="v391CustomerAssignedBrand" style="max-width:320px"></select><div class="v391-note">Commercial/default context only. It does not relabel a product selected under another brand.</div></div>'; const actions=editor.querySelector('.actions');editor.insertBefore(section,actions||null);}
    renderCustomerMargins();
    if(!$('v391CustomerAssignedBrand')?.dataset.bound){$('v391CustomerAssignedBrand').dataset.bound='1';$('v391CustomerAssignedBrand').addEventListener('change',saveCustomerAssignment);}
    observeCustomerEditor();
  }
  function renderCustomerMargins(){
    const grid=$('v391CustomerMarginGrid'),select=$('v391CustomerAssignedBrand');if(!grid||!select)return;const cid=String($('companySettingsCompanySelect')?.value||'');const locked=$('companyPricingEditor')?.classList.contains('company-pricing-locked')!==false;
    grid.innerHTML=commercialBrands().map(b=>{const key=marginKey(cid,b.id),has=state.customerMargins.has(key),value=(has?num(state.customerMargins.get(key)):0)*100;return `<div class="v391-margin-item"><label>${esc(b.brand_name)} Margin</label><div class="v391-margin-input-wrap"><input class="v391-customer-margin" data-brand-id="${esc(b.id)}" type="number" min="0" max="99.99" step="0.1" value="${value.toFixed(1)}" ${locked?'readonly':''}><span>%</span></div><div class="v391-margin-default">${has?'Saved for this Customer':'0% for this Customer'}</div></div>`}).join('');
    const assigned=state.assignments.get(cid)||masterBrand()?.id||'';select.innerHTML=brandOptions(assigned);select.value=assigned;select.disabled=!canManageCustomerBrand()||locked;
  }
  function customerMarginSnapshot(){
    const cid=String($('companySettingsCompanySelect')?.value||'');
    return [...document.querySelectorAll('.v391-customer-margin')].map(input=>({cid,bid:String(input.dataset.brandId||''),margin:num(input.value,NaN)/100}));
  }
  function observeCustomerEditor(){
    const editor=$('companyPricingEditor');if(!editor||editor.dataset.v39443CustomerEvents)return;editor.dataset.v39443CustomerEvents='1';
    $('companySettingsCompanySelect')?.addEventListener('change',()=>{state.lastCompanyCustomer=String($('companySettingsCompanySelect')?.value||'');renderCustomerMargins();});
    $('saveCompanyPricing')?.addEventListener('click',()=>{const rows=customerMarginSnapshot();saveCustomerMargins(rows);},true);
    if(window.MutationObserver){const ob=new MutationObserver(()=>renderCustomerMargins());ob.observe(editor,{attributes:true,attributeFilter:['class']});editor.__keysuiteCustomerBrandMarginObserver=ob;}
  }
  async function saveCustomerMargins(snapshot=null){
    const rows=Array.isArray(snapshot)?snapshot:customerMarginSnapshot(),cid=String(rows[0]?.cid||$('companySettingsCompanySelect')?.value||'');if(!cid||!canManageCustomerBrand()||!rows.length)return;const c=client();
    try{for(const row of rows){const margin=Number(row.margin);if(!(margin>=0&&margin<1))throw new Error('Brand Margin must be from 0% to below 100%.');const bid=row.bid,payload={company_id:companyId(),customer_id:cid,brand_id:bid,margin,updated_at:new Date().toISOString()};const {error}=await c.from('ks_customer_brand_margins').upsert(payload,{onConflict:'company_id,customer_id,brand_id'});if(error)throw error;state.customerMargins.set(marginKey(cid,bid),margin);}setTimeout(()=>{renderCustomerMargins();applyAllRows({resetBase:true});},60);}catch(e){console.error('V4.01 Brand Margin save:',e);msg('companySettingsMessage',e.message||String(e),'error');}
  }
  async function saveCustomerAssignment(){const cid=String($('companySettingsCompanySelect')?.value||''),bid=$('v391CustomerAssignedBrand')?.value||'';if(!cid||!bid||!canManageCustomerBrand())return;const {error}=await client().from('ks_customer_brand_assignments').upsert({company_id:companyId(),customer_id:cid,brand_id:bid,updated_at:new Date().toISOString()},{onConflict:'company_id,customer_id'});if(error)return msg('companySettingsMessage',multibrandDbError(error),'error');state.assignments.set(cid,bid);msg('companySettingsMessage','OEM / Assigned Brand saved. Product brand remains selected independently.','info');}

  function displayModelAlias(text,ctx=brandContext()){
    let out=String(text??'');if(!ctx)return out;
    const family=String(ctx.family||'').toUpperCase(),target=String(ctx.sellingSeries||ctx.masterSeries||'').trim();
    if(family==='CHC'&&target)return out.replace(/\b(?:CHCS|CHCN|CHC)\b/g,target);
    if(isMasterBrand(byBrandId(ctx.id)))return out;
    const master=String(ctx.masterSeries||'').trim();if(master&&target&&master.toUpperCase()!==target.toUpperCase()){const re=master.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');out=out.replace(new RegExp(`\\b${re}\\b`,'g'),target);}return out;
  }
  function decorateProductDisplay(materialOverride=''){
    const ctx=brandContext(state.selectedBrandId,state.selectedFamily,materialOverride);if(!ctx)return;
    // Display alias only. All data-* values and messages sent to selector keep the original master CHC model.
    document.querySelectorAll('#productSeriesList [data-product-series]').forEach(btn=>{const master=btn.dataset.productSeries||btn.textContent||'',next=displayModelAlias(master,ctx);if(btn.textContent!==next)btn.textContent=next;});
    document.querySelectorAll('#productModelGrid .product-model-row').forEach(row=>{const master=row.querySelector('[data-product-view]')?.dataset.productView||row.querySelector('[data-product-add]')?.dataset.productAdd||row.querySelector('h3')?.textContent||'';const h=row.querySelector('h3'),next=displayModelAlias(master,ctx);if(h&&h.textContent!==next)h.textContent=next;});
    const title=$('productSeriesTitle');if(title){const active=document.querySelector('#productSeriesList [data-product-series].active');const master=active?.dataset.productSeries||title.dataset.v393MasterText||title.textContent||'';title.dataset.v393MasterText=master;const next=displayModelAlias(master,ctx);if(title.textContent!==next)title.textContent=next;}
    const curveTitle=$('productCurveTitle');if(curveTitle){if(!curveTitle.dataset.v393MasterText||/^(CHC|CHCS|CHCN|ES)\b/i.test(curveTitle.textContent||''))curveTitle.dataset.v393MasterText=curveTitle.textContent||'';const next=displayModelAlias(curveTitle.dataset.v393MasterText,ctx);if(curveTitle.textContent!==next)curveTitle.textContent=next;}
    {const fam=String(ctx.family||'').toUpperCase();if(['CHC','ES'].includes(fam)){const main=String(ctx.brandSeries||brandSeriesFor(currentBrand(),fam)||fam),root=fam==='CHC'?'#productChc':'#productEs',h1=document.querySelector(`${root} h1`);if(h1)h1.textContent=`Product · ${main}`;document.querySelectorAll(`${root} h2,${root} h3`).forEach(h=>{if(/\b(?:CHC|CHCS|CHCN|SVMT|SVM|VMS|VMSS|VMSN|ES)\s+Series\b/i.test(h.textContent||''))h.textContent=`${main} Series`;});}}
  }

  function decorateProductDisplaySoon(materialOverride=''){
    // Bounded/event-driven only: Product's native renderer may finish one frame after navigation.
    decorateProductDisplay(materialOverride);
    requestAnimationFrame(()=>decorateProductDisplay(materialOverride));
    setTimeout(()=>decorateProductDisplay(materialOverride),120);
    setTimeout(()=>decorateProductDisplay(materialOverride),320);
    setTimeout(()=>decorateProductDisplay(materialOverride),700);
  }
  function observeProductDisplay(){
    // No always-on Product DOM observer. Known Product actions get a short bounded re-apply only.
    if(state.productDisplayEventsBound)return;state.productDisplayEventsBound=true;
    document.addEventListener('click',event=>{const target=event.target?.closest?.('[data-product-series],[data-product-view],[data-product-add],.v391-family-btn');if(!target)return;setTimeout(decorateProductDisplaySoon,0);},true);
  }

  const BUILTIN_FAMILIES={
    'b.g.reich':[{label:'CHC',family:'CHC',page:'productChc'},{label:'End Suction',family:'ES',page:'productEs'},{label:'Motor',family:'MOTOR',page:'productMotor'}],
    'keylargo':[{label:'Baseplate',family:'BASEPLATE',page:'productBaseplate'},{label:'Coupling',family:'COUPLING',page:'productCoupling'},{label:'KeyPLC Panel',family:'KEYPLC',page:'productKeyplc'},{label:'Manifold',family:'MANIFOLD',page:'productManifold'}]
  };
  function familyPage(fam){return ({CHC:'productChc',ES:'productEs',MOTOR:'productMotor',GWS:'productGws',KEYPLC:'productKeyplc',MANIFOLD:'productManifold',COUPLING:'productCoupling',BASEPLATE:'productBaseplate'})[String(fam).toUpperCase()]||''}
  function brandFamilies(brand){
    const key=String(brand.brand_key||'').toLowerCase(),built=isMasterBrand(brand)?BUILTIN_FAMILIES['b.g.reich']:BUILTIN_FAMILIES[key];if(built)return built.map(f=>({...f,label:f.family==='CHC'?brandSeriesFor(brand,f.family):f.label}));
    // V4.04.01: an OEM family exists in Product > Brand only while at least one active OEM mapping exists. A stale Brand Series row must never resurrect a deleted family.
    const fams=new Set();state.mappings.filter(m=>m.active!==false&&String(m.brand_id)===String(brand.id)).forEach(m=>fams.add(String(m.master_family||'').toUpperCase()));
    const out=[];fams.forEach(fam=>{const page=familyPage(fam);if(page)out.push({label:brandSeriesFor(brand,fam),family:fam,page});});return out.sort((a,b)=>({CHC:0,ES:1,MOTOR:2}[a.family]??9)-({CHC:0,ES:1,MOTOR:2}[b.family]??9));
  }
  function renderProductTree(){
    const submenu=document.querySelector('.nav-group[data-nav-group="productMenu"] .nav-submenu');if(!submenu)return;
    if(!canUseProduct()){submenu.innerHTML='';return}
    if(brandSeriesLocked()){
      const allowed=[];commercialBrands().forEach(b=>brandFamilies(b).forEach(f=>{if(authority()?.isBrandSeriesAllowed?.(b.id,f.family))allowed.push({brand:b,...f})}));
      submenu.innerHTML='<div class="v391-brand-tree"><details class="v391-keylargo-root"><summary>Keylargo</summary><div id="v40809KeylargoLockedProducts"></div></details><div id="v40407AssignedProductTree"></div></div>';
      const keyHost=$('v40809KeylargoLockedProducts'),host=$('v40407AssignedProductTree');if(!keyHost||!host)return;
      const bp=document.createElement('button');bp.type='button';bp.className='v391-family-btn';bp.textContent='Baseplate';bp.dataset.family='BASEPLATE';bp.dataset.page='productBaseplate';if(String(state.selectedFamily)==='BASEPLATE')bp.classList.add('active');bp.onclick=()=>{state.selectedFamily='BASEPLATE';document.querySelectorAll('.v391-family-btn').forEach(x=>x.classList.remove('active'));bp.classList.add('active');window.KeySuiteApp?.showPage?.('productBaseplate');setTimeout(()=>{postBrandContext('productBaseplate');decorateProductDisplaySoon();},100)};keyHost.appendChild(bp);
      if(!allowed.length){host.innerHTML='<div class="muted" style="padding:8px 10px">No OEM Product Brand / Series is assigned to this user.</div>';return}
      allowed.forEach(item=>{const btn=document.createElement('button');btn.type='button';btn.className='v391-family-btn';btn.textContent=item.label;btn.dataset.brandId=item.brand.id;btn.dataset.family=item.family;btn.dataset.page=item.page;if(String(state.selectedBrandId)===String(item.brand.id)&&String(state.selectedFamily)===item.family)btn.classList.add('active');btn.onclick=()=>{if(!setSelectedBrand(item.brand.id,item.family,item.page))return;document.querySelectorAll('.v391-family-btn').forEach(x=>x.classList.remove('active'));btn.classList.add('active');window.KeySuiteApp?.showPage?.(item.page);setTimeout(()=>{postBrandContext(item.page);decorateProductDisplaySoon();},100)};host.appendChild(btn)});
      return;
    }
    // V4.04.21 Product hierarchy: Keylargo, B.G.Reich and TESK are first-class top-level groups.
    // Only other OEM/assigned selling brands remain under the generic Brand group.
    submenu.innerHTML='<div id="v391ProductBrandTree" class="v391-brand-tree"><details class="v391-keylargo-root"><summary>Keylargo</summary><div class="v391-keylargo-list"></div></details><details class="v391-direct-brand-root v391-bgreich-root"><summary>B.G.Reich</summary><div class="v391-bgreich-list"></div></details><details class="v391-direct-brand-root v391-tesk-root"><summary>TESK</summary><div class="v391-tesk-list"></div></details><details class="v391-direct-brand-root v391-gws-root"><summary>GWS</summary><div class="v391-gws-list"></div></details><details class="v391-brand-root"><summary>Brand</summary><div class="v391-brand-list"></div></details></div>';
    const tree=$('v391ProductBrandTree'),brandHost=tree?.querySelector('.v391-brand-list'),keyHost=tree?.querySelector('.v391-keylargo-list'),bgHost=tree?.querySelector('.v391-bgreich-list'),teskHost=tree?.querySelector('.v391-tesk-list'),gwsHost=tree?.querySelector('.v391-gws-list');if(!brandHost||!keyHost||!bgHost||!teskHost||!gwsHost)return;
    const bg=brandByKey('b.g.reich')||state.brands.find(b=>String(b.brand_name||'').toLowerCase()==='b.g.reich')||null;
    const tesk=brandByKey('tesk')||state.brands.find(b=>String(b.brand_name||'').toLowerCase()==='tesk')||null;
    const addFamilyButtons=(host,b,families)=>{if(!host||!b)return;families.forEach(f=>{const btn=document.createElement('button');btn.type='button';btn.className='v391-family-btn';btn.textContent=f.label;btn.dataset.brandId=b.id;btn.dataset.family=f.family;btn.dataset.page=f.page;if(String(state.selectedBrandId)===String(b.id)&&String(state.selectedFamily)===f.family)btn.classList.add('active');btn.onclick=()=>{setSelectedBrand(b.id,f.family,f.page);document.querySelectorAll('.v391-family-btn').forEach(x=>x.classList.remove('active'));btn.classList.add('active');window.KeySuiteApp?.showPage?.(f.page);setTimeout(()=>{postBrandContext(f.page);decorateProductDisplaySoon();},100);};host.appendChild(btn)});};
    if(bg)addFamilyButtons(bgHost,bg,brandFamilies(bg));else tree.querySelector('.v391-bgreich-root')?.remove();
    if(tesk&&brandFamilies(tesk).length)addFamilyButtons(teskHost,tesk,brandFamilies(tesk));else tree.querySelector('.v391-tesk-root')?.remove();
    // V4.12.26: GWS is a first-class expandable left-panel group below TESK.
    // Tank remains the existing Keylargo house GWS product internally; this changes navigation only.
    const keylargo=brandByKey('keylargo');
    const gwsTank=document.createElement('button');gwsTank.type='button';gwsTank.className='v391-family-btn';gwsTank.textContent='Tank';gwsTank.dataset.brandId=keylargo?.id||'';gwsTank.dataset.family='GWS';gwsTank.dataset.page='productGws';
    if(String(state.selectedBrandId)===String(keylargo?.id||'')&&String(state.selectedFamily)==='GWS')gwsTank.classList.add('active');
    gwsTank.onclick=()=>{if(keylargo)setSelectedBrand(keylargo.id,'GWS','productGws');else{state.selectedBrandId=masterBrand()?.id||'';state.selectedFamily='GWS'}document.querySelectorAll('.v391-family-btn,.v391-direct-product-btn').forEach(x=>x.classList.remove('active'));gwsTank.classList.add('active');window.KeySuiteApp?.showPage?.('productGws');setTimeout(()=>{postBrandContext('productGws');decorateProductDisplaySoon();},100);};
    gwsHost.appendChild(gwsTank);
    const otherBrands=commercialBrands().filter(b=>{const k=String(b.brand_key||'').toLowerCase(),n=String(b.brand_name||'').toLowerCase();return k!=='b.g.reich'&&n!=='b.g.reich'&&k!=='tesk'&&n!=='tesk'});
    if(!commercialBrands().length){
      brandHost.innerHTML=`<div class="v39444-brand-recovery"><div><b>${state.loading?'Loading Brand data…':'Brand data unavailable'}</b></div><div class="muted">${esc(state.coreError||'Brand data has not loaded yet.')}</div><button class="btn secondary" type="button" id="v39444RetryBrands">Retry</button></div>`;
      $('v39444RetryBrands')?.addEventListener('click',()=>loadData({force:true}));
    }else{
      otherBrands.forEach(b=>{const families=brandFamilies(b);if(!families.length)return;const d=document.createElement('details');d.innerHTML=`<summary>${esc(b.brand_name)}</summary><div></div>`;const inner=d.lastElementChild;addFamilyButtons(inner,b,families);brandHost.appendChild(d);});
      if(!brandHost.children.length)tree.querySelector('.v391-brand-root')?.remove();
    }
    BUILTIN_FAMILIES.keylargo.slice().sort((a,b)=>a.label.localeCompare(b.label,undefined,{numeric:true,sensitivity:'base'})).forEach(f=>{const btn=document.createElement('button');btn.type='button';btn.className='v391-family-btn';btn.textContent=f.label;btn.dataset.brandId=keylargo?.id||'';btn.dataset.family=f.family;btn.dataset.page=f.page;if(String(state.selectedBrandId)===String(keylargo?.id||'')&&String(state.selectedFamily)===f.family)btn.classList.add('active');btn.onclick=()=>{if(keylargo)setSelectedBrand(keylargo.id,f.family,f.page);else{state.selectedBrandId=masterBrand()?.id||'';state.selectedFamily=f.family}document.querySelectorAll('.v391-family-btn').forEach(x=>x.classList.remove('active'));btn.classList.add('active');window.KeySuiteApp?.showPage?.(f.page);setTimeout(()=>{postBrandContext(f.page);decorateProductDisplaySoon();},100);};keyHost.appendChild(btn);});
  }


  function bindMaterialContext(){
    if(state.materialContextBound)return;state.materialContextBound=true;
    const applyMaterial=event=>{const el=event.target;if(!el||!['ksDashMaterial','productMaterial','pumpMaterial'].includes(el.id))return;const value=String(el.value||'').trim();if(value)sessionStorage.setItem('keysuite-v3944-chc-material',value);const page=el.id==='productMaterial'?'productChc':el.id==='pumpMaterial'?'selector':null;postBrandContext(page,value);decorateProductDisplaySoon(value);renderProductTree();try{window.dispatchEvent(new CustomEvent('KEYSUITE_CHC_MATERIAL_CONTEXT_CHANGED',{detail:{material:value,page:page||'',masterSeries:chcMasterSeriesFromMaterial(value),brandId:state.selectedBrandId}}));}catch(_){} };
    document.addEventListener('change',applyMaterial,true);
    document.addEventListener('input',event=>{if(event.target?.tagName==='SELECT')applyMaterial(event)},true);
  }

  function selectorFrameForPage(page){return $(page==='selectorEs'?'selectorEsFrame':'selectorFrame')}
  function clearSelectorPresentationContext(page='selector'){
    const frame=selectorFrameForPage(page);
    try{if(frame?.contentWindow){delete frame.contentWindow.__KEYSUITE_MODEL_PRESENTATION_CONTEXT;delete frame.contentWindow.__KEYSUITE_HIDE_INNER_ACTIONS;}}catch(_){}
    try{window.KeySuiteSelectorBrand?.clearPinnedContext?.(frame)}catch(_){}
  }
  function consumePreservedSelectorBrand(page,family){
    const guard=window.__KEYSUITE_PRESERVE_SELECTOR_BRAND_ONCE__;
    if(!guard)return false;
    const samePage=String(guard.page||'')===String(page),sameFamily=String(guard.family||'').toUpperCase()===String(family||'').toUpperCase();
    if(!samePage||!sameFamily)return false;
    try{delete window.__KEYSUITE_PRESERVE_SELECTOR_BRAND_ONCE__}catch(_){window.__KEYSUITE_PRESERVE_SELECTOR_BRAND_ONCE__=null}
    const brand=byBrandId(guard.brandId)||currentBrand();
    if(brand)setSelectedBrand(brand.id,family,page);else postBrandContext(page);
    return true;
  }
  function selectorFallbackButtons(submenu){
    if(!submenu)return {};
    let chc=submenu.querySelector('button[data-v41222-selector-fallback="CHC"]')||submenu.querySelector(':scope > button[data-page="selector"]');
    let es=submenu.querySelector('button[data-v41222-selector-fallback="ES"]')||submenu.querySelector(':scope > button[data-page="selectorEs"]');
    const create=(page,family,label)=>{
      const b=document.createElement('button');b.type='button';b.dataset.page=page;b.dataset.v41222SelectorFallback=family;b.textContent=label;
      b.addEventListener('click',()=>{
        if(!window.KeySuiteApp?.showPage)return;
        clearSelectorPresentationContext(page);
        if(state.coreReady){
          if(brandSeriesLocked()){
            const target=resolveAuthorityTarget('',family),brand=target?byBrandId(target.brandId):null;
            if(brand)setSelectedBrand(brand.id,target.family,page);
          }else{
            const brand=masterBrand();if(brand)setSelectedBrand(brand.id,family,page);
          }
        }
        window.KeySuiteApp.showPage(page);
        setTimeout(()=>{postBrandContext(page);decorateProductDisplaySoon()},100);
      });
      submenu.insertBefore(b,submenu.firstChild);return b;
    };
    if(!chc)chc=create('selector','CHC','CHC');
    if(!es)es=create('selectorEs','ES','ES');
    if(chc)chc.dataset.v41222SelectorFallback='CHC';
    if(es)es.dataset.v41222SelectorFallback='ES';
    return {chc,es};
  }
  function openSelectorRoute(page){
    if(window.KeySuiteApp?.showPage){window.KeySuiteApp.showPage(page);return true}
    const fallback=document.querySelector(`.nav-group[data-nav-group="selectorMenu"] .nav-submenu button[data-v41222-selector-fallback][data-page="${page}"]`);
    if(fallback){fallback.click();return true}
    return false;
  }
  function renderSelectorTree(){
    const submenu=document.querySelector('.nav-group[data-nav-group="selectorMenu"] .nav-submenu');if(!submenu)return;
    const fallback=selectorFallbackButtons(submenu);
    let tree=$('v41222SelectorBrandTree');
    if(!tree){
      tree=document.createElement('div');tree.id='v41222SelectorBrandTree';tree.className='v391-brand-tree v41223-selector-brand-tree';submenu.appendChild(tree);
    }else{
      tree.classList.add('v41223-selector-brand-tree');
    }
    const showFallback=(visible)=>{
      [fallback.chc,fallback.es].forEach(btn=>{if(btn){btn.hidden=!visible;btn.style.display=visible?'block':'none'}});
    };
    const canUse=authority()?.can?.('use_selector')||permission('use_selector')!=='none';
    if(!canUse){tree.innerHTML='';showFallback(false);return}

    const route=(family)=>String(family||'').toUpperCase()==='ES'?'selectorEs':'selector';
    const pumpFamilies=(brand)=>brandFamilies(brand)
      .filter(f=>['CHC','ES'].includes(String(f.family||'').toUpperCase()))
      .map(f=>({...f,page:route(f.family)}));

    const addButtons=(host,brand,families)=>{
      if(!host||!brand)return 0;let count=0;
      families.forEach(f=>{
        const page=route(f.family),btn=document.createElement('button');
        btn.type='button';btn.className='v391-family-btn';
        // V4.12.23: Selection shows the configured Brand Series (CHC / ES for B.G.Reich)
        // rather than substituting a generic family label such as "End Suction".
        btn.textContent=brandSeriesFor(brand,f.family)||String(f.family||'').toUpperCase();
        btn.dataset.brandId=brand.id;btn.dataset.family=f.family;btn.dataset.page=page;
        if(String(state.selectedBrandId)===String(brand.id)&&String(state.selectedFamily)===String(f.family))btn.classList.add('active');
        btn.onclick=()=>{
          const selected=setSelectedBrand(brand.id,f.family,page);
          if(!selected&&!brandSeriesLocked()){
            const master=masterBrand();if(master)setSelectedBrand(master.id,f.family,page);
          }
          clearSelectorPresentationContext(page);
          document.querySelectorAll('#v41222SelectorBrandTree .v391-family-btn').forEach(x=>x.classList.remove('active'));
          btn.classList.add('active');
          openSelectorRoute(page);
          setTimeout(()=>{postBrandContext(page);decorateProductDisplaySoon()},100);
        };
        host.appendChild(btn);count++;
      });
      return count;
    };

    const brands=commercialBrands();
    // Preserve the user's open Brand / OEM nodes across legitimate async refreshes.
    // Without this, a delayed Brand data refresh can collapse the chooser while the
    // user is selecting B.G.Reich / TESK / VEC.
    const wasBrandRootOpen=!!tree.querySelector('.v41223-selector-brand-root[open]');
    const openBrandIds=new Set([...tree.querySelectorAll('.v41223-selector-brand[open][data-brand-id]')].map(n=>String(n.dataset.brandId||'')));
    tree.innerHTML='';

    // V4.12.23 recovery rule: Brand data enhances the selector, but never blocks it.
    // CHC / ES remain as hidden working fallbacks whenever the Brand tree is healthy.
    if(!brands.length){
      showFallback(true);
      tree.innerHTML=`<div class="v39444-brand-recovery"><div><b>${state.loading?'Loading Brand data…':'Brand data unavailable'}</b></div><div class="muted">${esc(state.coreError||'CHC / ES remain available while Brand data is loading.')}</div><button class="btn secondary" type="button" id="v41223RetrySelectorBrands">Retry Brand</button></div>`;
      $('v41223RetrySelectorBrands')?.addEventListener('click',async()=>{await loadData({force:true});renderSelectorTree()});
      return;
    }

    // V4.12.23 hierarchy: Selection -> Brand -> Brand name -> Series.
    const brandRoot=document.createElement('details');
    brandRoot.className='v391-brand-root v41223-selector-brand-root';
    brandRoot.innerHTML='<summary>Brand</summary><div class="v391-brand-list" id="v41223SelectorBrandList"></div>';
    if(wasBrandRootOpen)brandRoot.open=true;
    tree.appendChild(brandRoot);
    const brandHost=$('v41223SelectorBrandList');
    if(!brandHost){showFallback(true);return}

    let usable=0;
    brands.forEach(brand=>{
      let families=pumpFamilies(brand);
      if(brandSeriesLocked())families=families.filter(f=>authority()?.isBrandSeriesAllowed?.(brand.id,f.family));
      if(!families.length)return;
      const d=document.createElement('details');
      d.className='v391-direct-brand-root v41223-selector-brand';
      d.dataset.brandId=brand.id;
      d.innerHTML=`<summary>${esc(brand.brand_name)}</summary><div></div>`;
      if(openBrandIds.has(String(brand.id)))d.open=true;
      usable+=addButtons(d.lastElementChild,brand,families);
      brandHost.appendChild(d);
    });

    if(!usable){
      showFallback(!brandSeriesLocked());
      brandHost.innerHTML=brandSeriesLocked()
        ?'<div class="muted" style="padding:8px 10px">No Pump Selection Brand / Series is assigned to this user.</div>'
        :'<div class="muted" style="padding:8px 10px">No Pump Selection Brand / Series is available. CHC / ES fallback remains active.</div>';
      return;
    }

    // Healthy Brand -> Series tree is the visible chooser. Keep fallback buttons in DOM only.
    showFallback(false);
  }

  function bindSelectionDefaults(){
    const master=()=>masterBrand(),submenu=document.querySelector('.nav-group[data-nav-group="selectorMenu"] .nav-submenu');
    const fallback=selectorFallbackButtons(submenu);
    [['selector','CHC',fallback.chc],['selectorEs','ES',fallback.es]].forEach(([page,family,btn])=>{if(btn&&!btn.dataset.v391Bound){btn.dataset.v391Bound='1';btn.addEventListener('click',()=>{
      if(consumePreservedSelectorBrand(page,family))return;
      clearSelectorPresentationContext(page);
      if(brandSeriesLocked()){const target=resolveAuthorityTarget('',family),b=target?byBrandId(target.brandId):null;if(b)setSelectedBrand(b.id,target.family,page);return}
      const b=master();if(b)setSelectedBrand(b.id,family,page);
    },true);}});
  }

  function observeQuote(){
    // V3.9.4.4.3: no post-login MutationObserver. Existing app wrappers stamp brand at row creation.
    if(state.quoteEventsBound)return;state.quoteEventsBound=true;
    $('qCustomer')?.addEventListener('change',()=>{state.lastQuoteCustomer=quoteCustomerId();applyAllRows({resetBase:true});});
    document.addEventListener('click',event=>{if(!event.target?.closest?.('[data-page="quotation"],#quoteItems,.quote-item'))return;setTimeout(()=>{document.querySelectorAll('#quoteItems .quote-item').forEach(row=>{if(rowBrandId(row)){renderRowBrandChip(row);mapRowIdentity(row);applyBrandMargin(row,{resetBase:true});}});},0);},true);
  }
  function restoreSavedRows(){document.querySelectorAll('#quoteItems .quote-item').forEach(row=>{const source=sourceOfRow(row),pump=pumpDataOfRow(row),bid=source.v391_brand_id||pump.keysuite_brand_id;if(bid)stampRowBrand(row,bid,source.v391_product_family||pump.keysuite_product_family||sourceFamily(source,row),{force:true});});}
  function repairQuotationBrands(){
    if(!state.coreReady)return;
    document.querySelectorAll('#quoteItems .quote-item').forEach(row=>{
      const source=sourceOfRow(row),pump=pumpDataOfRow(row),existing=rowBrandId(row),family=source.v391_product_family||pump.keysuite_product_family||sourceFamily(source,row);
      if(existing){renderRowBrandChip(row);mapRowIdentity(row);return}
      if(!family||['MANUAL','ASSEMBLY'].includes(String(family).toUpperCase()))return;
      const saved=source.v391_brand_id||pump.keysuite_brand_id;
      const fallback=saved||masterBrand()?.id||state.selectedBrandId;
      if(fallback)stampRowBrand(row,fallback,family,{force:true});
    });
  }
  function repairBrandUi({reload=false}={}){
    injectStyle();addDashboardCards();if(!$('brandManagement'))addPages();
    renderProductTree();renderSelectorTree();
    if(state.coreReady){renderBrands();restoreSavedRows();repairQuotationBrands();decorateProductDisplay();postBrandContext();}
    if(reload&&client()&&companyId())loadData({force:true}).then(()=>{renderProductTree();renderSelectorTree();repairQuotationBrands()});
    return {ready:state.coreReady,brands:state.brands.length,error:state.coreError||''};
  }

  const withTimeout=(promise,ms,label)=>Promise.race([Promise.resolve(promise),new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label||'Request'} timed out after ${Math.round(ms/1000)}s`)),ms))]);
  async function withRetry(factory,label,firstMs=15000,retryMs=22000){
    try{return await withTimeout(factory(),firstMs,label)}
    catch(firstError){
      console.warn(`[KeySuite V4.12.05] ${label} first attempt failed; retrying once.`,firstError);
      await new Promise(resolve=>setTimeout(resolve,450));
      return await withTimeout(factory(),retryMs,`${label} retry`);
    }
  }
  function dispatchBrandEvent(type,detail={}){try{window.dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,...detail}}))}catch(_){}}
  async function loadData({force=false}={}){
    if(state.loading&&!force)return state.loadPromise;
    const c=client(),cid=companyId();if(!c||!cid)return false;
    state.loading=true;state.coreError='';renderProductTree();
    state.loadPromise=(async()=>{
      try{
        // Core Brand data is independent. Optional pricing/customer tables can no longer make Product > Brand disappear.
        const brandRes=await withRetry(()=>c.from('ks_oem_brands').select('*').eq('company_id',cid).order('brand_name'),'Brand list');
        if(brandRes?.error)throw brandRes.error;
        state.brands=brandRes?.data||[];
        if(!state.brands.length)throw new Error('No Brand records were returned for this company.');

        let mapRes=null;
        try{mapRes=await withTimeout(c.from('ks_oem_brand_family_map').select('*').eq('company_id',cid),12000,'Brand mapping');if(mapRes?.error)throw mapRes.error;state.mappings=mapRes?.data||[]}
        catch(mapError){state.mappings=[];state.coreError=`Brand mappings unavailable: ${mapError.message||mapError}`;console.warn('KeySuite V3.9.4.4.11 mapping load:',mapError)}
        try{const seriesRes=await withTimeout(c.from('ks_oem_brand_series').select('*').eq('company_id',cid),12000,'Brand Series');if(seriesRes?.error)throw seriesRes.error;state.series=seriesRes?.data||[]}
        catch(seriesError){state.series=[];console.warn('KeySuite V3.9.4.4.11 Brand Series table unavailable; using safe built-in/family fallback:',seriesError)}

        const stored=sessionStorage.getItem('keysuite-v391-product-brand'),storedFamily=sessionStorage.getItem('keysuite-v391-product-family')||'CHC',authorized=brandSeriesLocked()?resolveAuthorityTarget(stored,storedFamily):null;if(brandSeriesLocked()){state.selectedBrandId=authorized?.brandId||'';state.selectedFamily=authorized?.family||''}else{state.selectedBrandId=byBrandId(stored)?.id||masterBrand()?.id||'';state.selectedFamily=storedFamily;}
        state.coreReady=true;renderProductTree();renderSelectorTree();renderBrands();decorateProductDisplay();
        dispatchBrandEvent('KEYSUITE_BRANDS_READY',{brands:state.brands.length,mappings:state.mappings.length,warning:state.coreError||''});

        // Optional data: each request is isolated so one old/missing column/table cannot blank the Brand runtime.
        const optional=await Promise.allSettled([
          withTimeout(c.from('ks_app_settings').select('general_usd_actual,general_usd_based,general_rmb_actual,general_rmb_based,fuel_price,fuel_base_price').eq('id','default').maybeSingle(),10000,'General pricing'),
          withTimeout(c.from('ks_customer_brand_assignments').select('*').eq('company_id',cid),10000,'Customer Brand assignment'),
          withTimeout(c.from('ks_customer_brand_margins').select('*').eq('company_id',cid),10000,'Customer Brand margin')
        ]);
        const [settingsR,assignsR,marginsR]=optional;
        if(settingsR.status==='fulfilled'&&!settingsR.value?.error){const s0=settingsR.value?.data||{};state.general={usdActual:num(s0.general_usd_actual,4.5),usdBased:num(s0.general_usd_based,4.5),rmbActual:num(s0.general_rmb_actual,.65),rmbBased:num(s0.general_rmb_based,.65),fuelPrice:num(s0.fuel_price,2),fuelBasePrice:num(s0.fuel_base_price,2)}}
        if(assignsR.status==='fulfilled'&&!assignsR.value?.error)state.assignments=new Map((assignsR.value?.data||[]).map(x=>[String(x.customer_id),x.brand_id]));
        if(marginsR.status==='fulfilled'&&!marginsR.value?.error)state.customerMargins=new Map((marginsR.value?.data||[]).map(x=>[marginKey(x.customer_id,x.brand_id),num(x.margin,0)]));
        if(!Object.keys(state.baseMultipliers).length)state.baseMultipliers=clone(window.KEYSUITE_SECURE_DATA?.productMultipliers||{});
        try{applyEffectiveRates()}catch(e){console.warn('KeySuite V3.9.4.4.11 effective rate refresh skipped:',e)}
        renderGeneral();renderBrands();addCustomerBrandSection();renderProductTree();renderSelectorTree();restoreSavedRows();repairQuotationBrands();hideOldFuel();postBrandContext();decorateProductDisplay();
        return true;
      }catch(error){
        state.coreReady=false;state.coreError=String(error?.message||error||'Unable to load Brand data.');console.error('KeySuite V3.9.4.4.11 Brand recovery:',error);renderProductTree();renderSelectorTree();renderBrands();
        msg('v391GeneralMessage',`Brand data unavailable: ${state.coreError}`,'error');msg('v391BrandMessage',`Brand data unavailable: ${state.coreError}`,'error');dispatchBrandEvent('KEYSUITE_BRANDS_ERROR',{error:state.coreError});return false;
      }finally{state.loading=false;renderProductTree();renderSelectorTree();}
    })();
    return state.loadPromise;
  }
  function waitForBrands(timeout=30000){if(state.coreReady)return Promise.resolve(true);return new Promise(resolve=>{let done=false;const finish=v=>{if(done)return;done=true;clearTimeout(timer);window.removeEventListener('KEYSUITE_BRANDS_READY',ok);window.removeEventListener('KEYSUITE_BRANDS_ERROR',fail);resolve(v)};const ok=()=>finish(true),fail=()=>finish(false);window.addEventListener('KEYSUITE_BRANDS_READY',ok,{once:true});window.addEventListener('KEYSUITE_BRANDS_ERROR',fail,{once:true});const timer=setTimeout(()=>finish(state.coreReady),timeout)})}
  function markVersion(){document.title='KeySuite V'+VERSION;document.querySelectorAll('.auth-brand small').forEach(n=>n.textContent='V'+VERSION);document.querySelectorAll('.brand small').forEach(n=>n.textContent='Full Suite V'+VERSION);document.querySelectorAll('.suite-version').forEach(n=>n.textContent='KeySuite V'+VERSION);}
  window.addEventListener('KEYSUITE_AUTHORITY_CHANGED',()=>{if(state.coreReady&&brandSeriesLocked()){const target=resolveAuthorityTarget(state.selectedBrandId,state.selectedFamily);state.selectedBrandId=target?.brandId||'';state.selectedFamily=target?.family||'';if(target)postBrandContext(familyPage(target.family)||null)}renderProductTree();decorateProductDisplaySoon();});

  window.addEventListener('KEYSUITE_AUTH_CONTEXT_READY',()=>{setTimeout(()=>repairBrandUi({reload:true}),0);setTimeout(()=>repairBrandUi(),500)});
  window.addEventListener('KEYSUITE_V41223_BRAND_RECOVERY',()=>setTimeout(()=>repairBrandUi({reload:!state.coreReady}),0));
  window.addEventListener('pageshow',()=>setTimeout(()=>repairBrandUi(),100));

  async function init(){
    if(state.initialized)return;state.initialized=true;injectStyle();addPages();addDashboardCards();hideOldFuel();markVersion();renderProductTree();renderSelectorTree();
    // Core Brand data waits only for authentication/company context, not pricing or Quick Selection.
    let brandTries=0;const waitBrandCore=()=>{brandTries++;if(window.KeySuiteAuth?.getClient?.()&&companyId()){loadData();return}if(brandTries<1200)setTimeout(waitBrandCore,250);else{state.coreError='Secure company context was not ready in time.';renderProductTree();renderSelectorTree();dispatchBrandEvent('KEYSUITE_BRANDS_ERROR',{error:state.coreError})}};waitBrandCore();
    // Pricing/quotation wrappers are a separate optional phase.
    let appTries=0;const waitApp=()=>{appTries++;if(window.KeySuiteApp&&window.KeySuitePricing){wrapPricing();wrapApp();observeQuote();observeProductDisplay();bindSelectionDefaults();addCustomerBrandSection();bindMaterialContext();if(state.coreReady){renderProductTree();decorateProductDisplay()}return}if(appTries<60)setTimeout(waitApp,250);else console.warn('KeySuite V4.01: pricing/app wrappers were not ready; Brand navigation remains available.');};waitApp();
  }

  window.KeySuiteV391={version:VERSION,state,effectiveRate,roundUp01,roundUp10,loadData,waitForBrands,setSelectedBrand,brandContext,brandSeriesFor,stampRowBrand,applyAllRows,decorateProductDisplay,chcMasterSeriesFromMaterial,currentChcMaterial,currentMasterSeries,renderProductTree,renderSelectorTree,repairBrandUi,repairQuotationBrands,clearSelectorPresentationContext,postBrandContext,displayModelAlias};window.KeySuiteV40001=window.KeySuiteV391;window.KeySuiteV392=window.KeySuiteV391;window.KeySuiteV393=window.KeySuiteV391;window.KeySuiteV3941=window.KeySuiteV391;window.KeySuiteV3942=window.KeySuiteV391;window.KeySuiteV3943=window.KeySuiteV391;window.KeySuiteV3944=window.KeySuiteV391;window.KeySuiteV39443=window.KeySuiteV391;window.KeySuiteV39444=window.KeySuiteV391;window.KeySuiteV39445=window.KeySuiteV391;window.KeySuiteV39446=window.KeySuiteV391;window.KeySuiteV39449=window.KeySuiteV391;window.KeySuiteV394410=window.KeySuiteV391;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
