(() => {
  'use strict';

  let access=null,selectedId='',selectedProduct='CHC_G2',editing=false,bound=false;
  const CATEGORY_SORT_KEY='keysuite-v40401n02-category-sort';
  const PRODUCT_SORT_KEY='keysuite-v40401n02-category-product-sort';
  let categorySort=(()=>{try{const x=JSON.parse(localStorage.getItem(CATEGORY_SORT_KEY)||'{}');return {dir:x.dir==='desc'?'desc':'asc'}}catch(_){return {dir:'asc'}}})();
  let productSort=(()=>{try{const x=JSON.parse(localStorage.getItem(PRODUCT_SORT_KEY)||'{}');return {dir:x.dir==='desc'?'desc':'asc'}}catch(_){return {dir:'asc'}}})();
  const byId=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const num=(value,d=2)=>Number(value||0).toLocaleString('en-MY',{minimumFractionDigits:d,maximumFractionDigits:d});
  const permissionLevel=key=>window.KeySuitePermissions?.level?.(key,String(access?.role||window.KEYSUITE_ACCESS?.role||'viewer').toLowerCase())||'none';
  const canView=()=>permissionLevel('manage_categories')!=='none';
  const isOwner=()=>permissionLevel('manage_categories')==='full';
  const categories=()=>window.KEYSUITE_SECURE_DATA?.categories||[];

  const defaultRule=()=>({margin:.38,normal:0,rare:0,transport:30,useCommission:true,useSetDiscount:true,useFinalDiscount:true,useFuelCharge:true,currencies:[]});
  const newCategoryRule=()=>({margin:0,normal:0,rare:0,transport:0,useCommission:false,useSetDiscount:false,useFinalDiscount:false,useFuelCharge:false,currencies:[]});

  function message(text,type='info'){
    const box=byId('categoryMessage');if(!box)return;
    box.textContent=text||'';box.className=text?`auth-message show ${type}`:'auth-message';
  }
  function boolValue(value,fallback=true){return value===undefined||value===null?fallback:!!value}
  function normalizeRule(rule={},fallback=defaultRule()){
    return {
      margin:Number(rule.margin??fallback.margin),normal:Number(rule.normal??fallback.normal??0),rare:Number(rule.rare??fallback.rare??0),transport:Number(rule.transport??fallback.transport),
      useCommission:boolValue(rule.useCommission??rule.use_commission??rule.includeCommission??rule.include_commission,fallback.useCommission),
      useSetDiscount:boolValue(rule.useSetDiscount??rule.use_set_discount??rule.includeSetDiscount??rule.include_set_discount,fallback.useSetDiscount),
      useFinalDiscount:boolValue(rule.useFinalDiscount??rule.use_final_discount??rule.includeFinalDiscount??rule.include_final_discount,fallback.useFinalDiscount),
      useFuelCharge:boolValue(rule.useFuelCharge??rule.use_fuel_charge??rule.includeFuelCharge??rule.include_fuel_charge,fallback.useFuelCharge),
      currencies:[...new Set((Array.isArray(rule.currencies)?rule.currencies:(Array.isArray(fallback.currencies)?fallback.currencies:[])).map(v=>String(v||'').toUpperCase()).filter(v=>['USD','RMB','MYR'].includes(v)))]
    };
  }
  const productLabel=product=>product==='CHC_G1'?'CHC G1':product==='CHC_G2'?'CHC G2':String(product||'');
  const rateFamily=product=>['CHC_G1','CHC_G2'].includes(String(product||'').toUpperCase())?'CHC':String(product||'CHC').toUpperCase();
  function ruleFor(category,product=selectedProduct){
    const fallback=product==='CHC_G2'?defaultRule():newCategoryRule();
    if(product==='CHC_G2'){fallback.margin=Number(category?.margins?.CHC_G2??category?.margins?.CHC??category?.factors?.CHC_G2??category?.factors?.CHC??fallback.margin);fallback.transport=Number(category?.transport??fallback.transport)}
    return normalizeRule(category?.productRules?.[product]||{},fallback);
  }
  function sortedRows(input=categories()){const rows=[...(input||[])],dir=categorySort.dir==='desc'?-1:1;return rows.sort((a,b)=>String(a?.name||a?.category_name||'').localeCompare(String(b?.name||b?.category_name||''),undefined,{numeric:true,sensitivity:'base'})*dir)}
  function saveCategorySort(){try{localStorage.setItem(CATEGORY_SORT_KEY,JSON.stringify(categorySort))}catch(_){}}
  function syncCategorySortUi(){const direction=byId('categorySortDirection');if(direction){direction.textContent=categorySort.dir==='asc'?'A→Z':'Z→A';direction.title=`Category · ${categorySort.dir==='asc'?'A to Z':'Z to A'}`}}
  function saveProductSort(){try{localStorage.setItem(PRODUCT_SORT_KEY,JSON.stringify(productSort))}catch(_){}}
  function applyProductSort(){const box=document.querySelector('#categoryForm .category-product-buttons');if(!box)return;const buttons=[...box.querySelectorAll('[data-category-product]')];buttons.sort((a,b)=>String(a.dataset.categoryProduct||'').localeCompare(String(b.dataset.categoryProduct||''),undefined,{numeric:true,sensitivity:'base'})*(productSort.dir==='desc'?-1:1));buttons.forEach(button=>box.appendChild(button));const control=byId('categoryProductSortDirection');if(control){control.textContent=productSort.dir==='asc'?'A→Z':'Z→A';control.title=`Product rules · ${productSort.dir==='asc'?'A to Z':'Z to A'}`}}
  function currentCategory(){return categories().find(item=>item.id===selectedId)||null}
  function productRates(product=selectedProduct){
    const data=window.KEYSUITE_SECURE_DATA||{},family=rateFamily(product),rates=data.productMultipliers?.[family]||{};
    return {USD:Number(rates.USD??data.usd_multiplier??5.8),RMB:Number(rates.RMB??data.rmb_multiplier??.65),MYR:1};
  }
  function customerFactors(){
    const customer=window.KeySuiteApp?.getPricingCustomer?.()||window.KeySuiteApp?.getSelectedCustomer?.()||null;
    const rows=window.KEYSUITE_SECURE_DATA?.customerPricingRows||[];
    const data=rows.find(row=>String(row.customerId||row.customer_id||'')===String(customer?.id||''))||{};
    return {commission:Number(data.commission??data.quotation?.commission??0),setDiscount:Number(data.setDiscount??data.set_discount??data.quotation?.setDiscount??0),finalDiscount:Number(data.finalDiscount??data.final_discount??data.quotation?.finalDiscount??0)};
  }
  function fillCompanyFactorValues(){
    const company=customerFactors();
    if(byId('categoryCommissionValue'))byId('categoryCommissionValue').value=num(company.commission*100,2).replace(/,/g,'');
    if(byId('categorySetDiscountValue'))byId('categorySetDiscountValue').value=num(company.setDiscount*100,2).replace(/,/g,'');
    if(byId('categoryFinalDiscountValue'))byId('categoryFinalDiscountValue').value=num(company.finalDiscount*100,2).replace(/,/g,'');
    if(byId('categoryFuelChargeValue'))byId('categoryFuelChargeValue').value='Automatic';
  }
  function setRuleFieldsEditable(on){
    document.querySelectorAll('#categoryForm .category-lock-field').forEach(group=>{
      group.classList.toggle('unlocked',!!on);group.classList.toggle('locked',!on);
      group.querySelectorAll('input').forEach(input=>{if(input.type==='checkbox')input.disabled=!on;else input.readOnly=input.dataset.alwaysReadonly==='true'?true:!on});
    });
    document.querySelectorAll('#categoryForm .category-company-factor input[type=checkbox]').forEach(input=>{input.disabled=!on});
    document.querySelectorAll('#categoryForm .category-currency-choice').forEach(input=>{input.disabled=!on});
  }
  function setEditable(on){
    editing=!!on;
    const name=byId('categoryNameInput');if(name)name.disabled=!editing;
    const edit=byId('editCategoryRule');if(edit){edit.style.display=isOwner()&&selectedId&&!editing?'inline-block':'none';edit.textContent='Hold 3s to Edit'}
    const save=byId('saveCategoryRule');if(save)save.disabled=!editing;
    const cancel=byId('cancelCategoryEdit');if(cancel)cancel.disabled=!editing;
    byId('categoryForm')?.classList.toggle('category-form-readonly',!editing);setRuleFieldsEditable(editing);
  }
  function selectedCurrenciesFromUi(){return ['USD','RMB','MYR'].filter(code=>!!byId(`categoryCurrency${code}`)?.checked)}
  function showCurrencySummary(){
    const rates=productRates(),box=byId('categoryCurrencySummary'),selected=selectedCurrenciesFromUi(),count=byId('categoryCurrencySelectionCount');
    if(count)count.textContent=`${selected.length} selected`;
    if(box){const note=selected.length===0?'<span>Price unavailable until at least 1 currency is ticked.</span>':selected.length===1?`<span>Use ${esc(selected[0])} only.</span>`:`<span>Use highest of ${esc(selected.join(' + '))} after MYR conversion.</span>`;box.innerHTML=`${note}<span>USD × ${num(rates.USD,4)}</span><span>RMB × ${num(rates.RMB,4)}</span><span>MYR × 1.0000</span>`}
  }
  function currencyFormula(rule){const selected=(rule?.currencies||[]).filter(v=>['USD','RMB','MYR'].includes(v));if(!selected.length)return 'No Price List Currency selected → Price unavailable';const converted=selected.map(v=>v==='MYR'?'MYR':`${v} × ${v} rate`);return selected.length===1?converted[0]:`Highest of ${converted.join(' / ')}`}
  function formulaText(rule,rarity,mode='quotation'){
    if(!(rule?.currencies||[]).length)return 'No Price List Currency selected → Price unavailable';
    if(rarity==='fixed')return `${currencyFormula(rule)} → Fixed final selling price (no Margin / Normal / Rare / Transport / Commission / Set Discount / Final Discount / Fuel / RM10 rounding)`;
    const parts=[currencyFormula(rule),'÷ (1 − Margin)'];
    if(rarity==='common'||rarity==='rare')parts.push('÷ (1 − Normal)');if(rarity==='rare')parts.push('÷ (1 − Rare)');parts.push('+ Transport');
    if(rule.useCommission)parts.push('÷ (1 − Customer Commission)');
    if(mode==='quotation'&&rule.useSetDiscount)parts.push('÷ (1 − Customer Set Discount)');
    if(rule.useFinalDiscount)parts.push('÷ (1 − Customer Final Discount)');
    if(rule.useFuelCharge)parts.push('+ Fuel Charge');
    parts.push('Round up to RM10');return parts.join('  →  ');
  }
  function updateFormula(){
    const rule=readRule(false),box=byId('categoryFormulaPreview');if(!box)return;
    box.innerHTML=`<div class="category-formula-lines"><div class="category-formula-line"><b>Many · Quote</b>${esc(formulaText(rule,'many'))}</div><div class="category-formula-line"><b>Common · Quote</b>${esc(formulaText(rule,'common'))}</div><div class="category-formula-line"><b>Rare · Quote</b>${esc(formulaText(rule,'rare'))}</div><div class="category-formula-line"><b>Fixed · Quote</b>${esc(formulaText(rule,'fixed'))}</div></div>`;
    updateManualQuote();
  }
  function manualCategory(){
    const base=currentCategory()||{id:'manual',name:'Manual',productRules:{}};
    return {...base,productRules:{...(base.productRules||{}),[selectedProduct]:readRule(false)}};
  }
  function updateManualQuote(){
    const valueBox=byId('categoryManualQuotedValue'),detail=byId('categoryManualBreakdown');if(!valueBox||!detail)return;
    const source=Number(byId('categoryManualCost')?.value),currency=String(byId('categoryManualCurrency')?.value||'USD').toUpperCase(),rarity=String(byId('categoryManualRarity')?.value||'common').toLowerCase();
    if(!Number.isFinite(source)||source<=0){valueBox.textContent='RM 0.00';detail.textContent='Enter a cost figure to calculate.';return}
    const customer=window.KeySuiteApp?.getPricingCustomer?.()||window.KeySuiteApp?.getSelectedCustomer?.()||null;
    const calc=window.KeySuitePricing?.calculateManual?.(source,currency,rarity,manualCategory(),selectedProduct,{customer,pricingMode:'quotation'});
    if(!calc){valueBox.textContent='RM 0.00';detail.textContent='Unable to calculate with the current pricing rule.';return}
    const rarityName={many:'Many',common:'Common',rare:'Rare',fixed:'Fixed'}[rarity]||'Common';
    valueBox.textContent=`RM ${num(calc.finalPrice,2)}`;
    detail.textContent=calc.fixedPrice?`${currency} ${num(source,2)} × ${num(calc.multiplier,4)} = RM ${num(calc.baseMyr,2)} · Fixed final selling price · no margin / discounts / fuel / RM10 rounding${customer?` · ${customer.company||'active customer'}`:''}`:`${currency} ${num(source,2)} × ${num(calc.multiplier,4)} = RM ${num(calc.baseMyr,2)} · ${rarityName} · Fuel RM ${num(calc.fuelCharge,2)} · rounded up to RM10${customer?` · ${customer.company||'active customer'}`:' · no active customer (fuel distance 0 km)'}`;
  }
  function refreshZeroMarginIndicators(category=currentCategory()){
    const marginRow=byId('categoryLock_margin');
    const liveMargin=Number(byId('categoryMarginInput')?.value);
    if(marginRow)marginRow.classList.toggle('zero-margin-rule',Number.isFinite(liveMargin)&&Math.abs(liveMargin)<0.000001);
    document.querySelectorAll('[data-category-product]').forEach(button=>{
      const product=button.dataset.categoryProduct;
      let margin=0;
      if(product===selectedProduct&&Number.isFinite(liveMargin)){margin=liveMargin/100}
      else if(category){margin=Number(ruleFor(category,product)?.margin||0)}
      button.classList.toggle('zero-margin',Math.abs(margin)<0.0000001);
      button.title=Math.abs(margin)<0.0000001?`${productLabel(product)} Margin = 0%`:'';
    });
  }
  function fillRule(category){
    const rule=category?ruleFor(category,selectedProduct):newCategoryRule();
    byId('categoryMarginInput').value=num(rule.margin*100,2).replace(/,/g,'');byId('categoryNormalInput').value=num(rule.normal*100,2).replace(/,/g,'');byId('categoryRareInput').value=num(rule.rare*100,2).replace(/,/g,'');byId('categoryTransportInput').value=num(rule.transport,2).replace(/,/g,'');
    byId('categoryUseCommission').checked=rule.useCommission;byId('categoryUseSetDiscount').checked=rule.useSetDiscount;byId('categoryUseFinalDiscount').checked=rule.useFinalDiscount;byId('categoryUseFuelCharge').checked=rule.useFuelCharge;
    ['USD','RMB','MYR'].forEach(code=>{const input=byId(`categoryCurrency${code}`);if(input)input.checked=(rule.currencies||[]).includes(code)});
    fillCompanyFactorValues();
    byId('categoryProductHeading').textContent=`${productLabel(selectedProduct)} Pricing Rule`;if(byId('categoryMarginLabel'))byId('categoryMarginLabel').textContent=`${productLabel(selectedProduct)} Margin`;
    document.querySelectorAll('[data-category-product]').forEach(button=>button.classList.toggle('active',button.dataset.categoryProduct===selectedProduct));
    refreshZeroMarginIndicators(category);setRuleFieldsEditable(editing);showCurrencySummary();updateFormula();
  }
  function fill(category=null){
    selectedId=category?.id||'';const name=category?.name||'';
    byId('categoryFormTitle').textContent=category?'Edit Category':'New Category';byId('categorySelectedName').textContent=category?name:'New Category';byId('categoryNameInput').value=name;fillRule(category);renderRows();
  }
  function openCategory(category,forEdit=false){if(!category)return;fill(category);setEditable(forEdit);message(forEdit?'Editing enabled. Category values and Use choices are unlocked.':'Category loaded. Hold the Edit button for 3 seconds to unlock category values and Use choices.','info')}
  function newCategory(){if(!isOwner()){message('Your role has view-only Category access.','error');return}selectedProduct='CHC_G2';fill(null);setEditable(true);message('New category ready. Values start at 0.00 and customer-factor Use choices start unticked.','info');setTimeout(()=>byId('categoryNameInput')?.focus(),0)}
  function renderRows(){
    const body=byId('categoryRows');if(!body)return;const rows=sortedRows(categories());
    if(!rows.length){body.innerHTML='<tr><td class="category-empty">No pricing categories yet.</td></tr>';return}
    body.innerHTML=rows.map(category=>{const name=String(category.name||category.category_name||'Unnamed Category').trim()||'Unnamed Category';return `<tr class="${category.id===selectedId?'category-row-selected':''}"><td><button class="category-name-button ${category.id===selectedId?'active':''}" type="button" data-category-open="${esc(category.id)}"><span>${esc(name)}</span></button></td></tr>`}).join('');
  }
  function mapRows(rows){
    return (rows||[]).map(c=>{
      let rules=c.product_rules||{};if(typeof rules==='string'){try{rules=JSON.parse(rules)}catch(_){rules={}}}
      const legacy={margin:Number(c.chc_margin??c.chc_factor??.38),normal:0,rare:0,transport:Number(c.transport??30),useCommission:true,useSetDiscount:true,useFinalDiscount:true,useFuelCharge:true,currencies:[]},other={margin:0,normal:0,rare:0,transport:0,useCommission:true,useSetDiscount:true,useFinalDiscount:true,useFuelCharge:true,currencies:[]};
      const normalize=(code,fallback=other)=>normalizeRule(rules?.[code]||{},fallback);
      return {id:c.id,name:String(c.category_name||c.name||'Unnamed Category'),productRules:{CHC:normalize('CHC',legacy),CHC_G1:normalize('CHC_G1',other),CHC_G2:normalizeRule(rules?.CHC_G2||rules?.CHC||{},legacy),ES:normalize('ES'),GWS:normalize('GWS'),KEYPLC:normalize('KEYPLC'),MANIFOLD:normalize('MANIFOLD'),MOTOR:normalize('MOTOR'),COUPLING:normalize('COUPLING'),BASEPLATE:normalize('BASEPLATE')},margins:{CHC:Number(c.chc_margin??c.chc_factor??0),CHC_G2:Number(c.chc_margin??c.chc_factor??0)},factors:{CHC:Number(c.chc_margin??c.chc_factor??0),CHC_G2:Number(c.chc_margin??c.chc_factor??0)},transport:Number(c.transport||0)};
    });
  }
  async function reload(){
    const client=window.KeySuiteAuth?.getClient?.();if(!client)return [];
    const {data,error}=await client.from('ks_pricing_categories').select('*').order('category_name');if(error)throw error;
    const mapped=mapRows(data),target=window.KEYSUITE_SECURE_DATA?.categories;if(Array.isArray(target))target.splice(0,target.length,...mapped);window.KeySuitePricing?.render?.();return mapped;
  }
  function percentValue(id,label,validate=true){const value=Number(byId(id)?.value);if(validate&&(!Number.isFinite(value)||value<0||value>=100))throw new Error(`${label} must be from 0% to below 100%.`);return Number.isFinite(value)?value/100:0}
  function readRule(validate=true){
    const transport=Number(byId('categoryTransportInput')?.value||0);if(validate&&(!Number.isFinite(transport)||transport<0))throw new Error('Transport must be RM0.00 or more.');
    return {margin:percentValue('categoryMarginInput',`${selectedProduct} Margin`,validate),normal:percentValue('categoryNormalInput','Normal',validate),rare:percentValue('categoryRareInput','Rare',validate),transport:Number.isFinite(transport)?transport:0,useCommission:!!byId('categoryUseCommission')?.checked,useSetDiscount:!!byId('categoryUseSetDiscount')?.checked,useFinalDiscount:!!byId('categoryUseFinalDiscount')?.checked,useFuelCharge:!!byId('categoryUseFuelCharge')?.checked,currencies:selectedCurrenciesFromUi()};
  }
  async function save(event){
    event.preventDefault();if(!editing)return;if(!isOwner()){message('Your role is not allowed to edit pricing categories.','error');return}
    const name=byId('categoryNameInput').value.trim();if(!name){message('Category Name is required.','error');return}
    let rule;try{rule=readRule(true)}catch(error){message(error.message,'error');return}
    const client=window.KeySuiteAuth?.getClient?.();if(!client){message('Supabase is not connected.','error');return}
    const button=byId('saveCategoryRule'),original=button.textContent;button.disabled=true;button.textContent='Saving…';message('');
    try{
      const params={p_category_id:selectedId||null,p_category_name:name,p_product_code:selectedProduct,p_margin:rule.margin,p_normal:rule.normal,p_rare:rule.rare,p_transport:rule.transport,p_use_commission:rule.useCommission,p_use_set_discount:rule.useSetDiscount,p_use_final_discount:rule.useFinalDiscount,p_use_fuel_charge:rule.useFuelCharge};
      let rpc,args;
      if(selectedProduct==='BASEPLATE'){
        rpc='keysuite_save_baseplate_category_rule_v40401';args={p_category_id:selectedId||null,p_category_name:name,p_margin:rule.margin,p_normal:rule.normal,p_rare:rule.rare,p_transport:rule.transport,p_use_commission:rule.useCommission,p_use_set_discount:rule.useSetDiscount,p_use_final_discount:rule.useFinalDiscount,p_use_fuel_charge:rule.useFuelCharge};
      }else if(['CHC_G1','CHC_G2'].includes(selectedProduct)&&selectedId){
        rpc='keysuite_save_chc_generation_category_rule_v41412';args=params;
      }else{
        rpc='keysuite_manage_pricing_category_v221';args={...params,p_product_code:selectedProduct==='CHC_G2'?'CHC':selectedProduct};
      }
      const {error}=await client.rpc(rpc,args);if(error)throw error;
      let targetId=selectedId||'';if(!targetId){const lookup=await client.from('ks_pricing_categories').select('id,category_name').ilike('category_name',name).limit(1);if(lookup.error)throw lookup.error;targetId=String(lookup.data?.[0]?.id||'')}
      if(!targetId)throw new Error('Saved Category ID could not be resolved for Price List Currency.');
      const currencySave=await client.rpc('keysuite_save_category_currency_selection_v41511',{p_category_id:targetId,p_product_code:selectedProduct,p_currencies:rule.currencies});if(currencySave.error)throw currencySave.error;
      const rows=await reload(),saved=(rows||categories()).find(item=>item.name.toLowerCase()===name.toLowerCase());openCategory(saved||rows[0],false);message(`${selectedProduct} pricing rule for “${name}” saved. ${rule.currencies.length} Price List Currency selected.`,'info');
    }catch(error){console.error(error);message(`${error.message||error}. Run V41511_CATEGORY_CURRENCY_SELECTION.sql first.`,'error')}
    finally{button.disabled=false;button.textContent=original}
  }
  function cancel(){if(selectedId){const category=currentCategory();if(category)openCategory(category,false)}else{const first=categories()[0];if(first)openCategory(first,false);else newCategory()}}
  function unlockCategoryEditor(){if(!isOwner()||!selectedId)return;setEditable(true);message('Category fields and Use choices unlocked. Edit them, then press Save Category or Cancel.','info');byId('categoryNameInput')?.focus();byId('categoryNameInput')?.select()}
  function bindEditLongHold(target,callback){
    let timer=null,progress=null,start=0;const idle='Hold 3s to Edit';
    const stop=(restore=true)=>{if(timer)clearTimeout(timer);if(progress)clearInterval(progress);timer=progress=null;target.classList.remove('holding');if(restore&&target.style.display!=='none')target.textContent=idle};
    target.textContent=idle;
    target.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'&&event.button!==0)return;event.preventDefault();if(editing||!selectedId||!isOwner())return;start=Date.now();target.classList.add('holding');target.textContent='Hold 1/3s';progress=setInterval(()=>{const elapsed=Math.min(3,Math.max(1,Math.ceil((Date.now()-start)/1000)));target.textContent=`Hold ${elapsed}/3s`},200);timer=setTimeout(()=>{stop(false);callback()},3000)});
    ['pointerup','pointercancel','pointerleave'].forEach(type=>target.addEventListener(type,()=>stop(true)));target.addEventListener('click',event=>event.preventDefault());target.addEventListener('contextmenu',event=>event.preventDefault());
  }
  function bind(){
    if(bound)return;bound=true;
    byId('categoryForm')?.addEventListener('submit',save);byId('newPricingCategory')?.addEventListener('click',newCategory);byId('cancelCategoryEdit')?.addEventListener('click',cancel);
    byId('categorySortDirection')?.addEventListener('click',()=>{categorySort.dir=categorySort.dir==='asc'?'desc':'asc';saveCategorySort();syncCategorySortUi();renderRows()});
    byId('categoryProductSortDirection')?.addEventListener('click',()=>{productSort.dir=productSort.dir==='asc'?'desc':'asc';saveProductSort();applyProductSort()});
    const editButton=byId('editCategoryRule');if(editButton)bindEditLongHold(editButton,unlockCategoryEditor);
    byId('categoryRows')?.addEventListener('click',event=>{const button=event.target.closest('[data-category-open]');if(!button)return;const category=categories().find(item=>item.id===button.dataset.categoryOpen);if(category)openCategory(category,false)});
    document.querySelectorAll('[data-category-product]').forEach(button=>button.addEventListener('click',()=>{selectedProduct=button.dataset.categoryProduct;fillRule(currentCategory());message(editing?`${selectedProduct} pricing rule loaded. Fields and Use choices are unlocked.`:`${selectedProduct} pricing rule loaded. Hold the Edit button for 3 seconds to make changes.`,'info')}));
    ['categoryMarginInput','categoryNormalInput','categoryRareInput','categoryTransportInput','categoryUseCommission','categoryUseSetDiscount','categoryUseFinalDiscount','categoryUseFuelCharge'].forEach(id=>{byId(id)?.addEventListener('input',()=>{updateFormula();if(id==='categoryMarginInput')refreshZeroMarginIndicators(currentCategory())});byId(id)?.addEventListener('change',()=>{updateFormula();if(id==='categoryMarginInput')refreshZeroMarginIndicators(currentCategory())})});
    ['USD','RMB','MYR'].forEach(code=>byId(`categoryCurrency${code}`)?.addEventListener('change',()=>{showCurrencySummary();updateFormula()}));
    ['categoryManualCost','categoryManualCurrency','categoryManualRarity'].forEach(id=>{byId(id)?.addEventListener('input',updateManualQuote);byId(id)?.addEventListener('change',updateManualQuote)});
  }
  function render(){
    if(!canView())return;syncCategorySortUi();applyProductSort();const add=byId('newPricingCategory');if(add)add.style.display=isOwner()?'inline-flex':'none';const list=categories();if(selectedId&&!list.some(item=>item.id===selectedId))selectedId='';renderRows();showCurrencySummary();fillCompanyFactorValues();
    if(!selectedId&&list.length)openCategory(list[0],false);else if(selectedId){const category=currentCategory();if(category&&!editing){fill(category);setEditable(false)}}
    const notice=byId('categoryAccessNotice');if(notice)notice.innerHTML=`Signed in as <b>${esc(access?.display_name||access?.email||'user')}</b>. Margin, Normal, Rare and Transport are category values. Customer percentages are read-only here; tick Use to apply each factor.`;
  }
  function init(data,userAccess){access=userAccess||access;bind();window.addEventListener('keysuite-customer-pricing-changed',()=>{fillCompanyFactorValues();updateFormula()});render()}
  function pageShown(id){if(id==='categoryManagement')render()}
  window.KeySuiteCategories={init,pageShown,reload,render,sortedRows};
})();
