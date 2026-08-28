(() => {
  'use strict';

  let access=null,bound=false,selectedCustomerId='',filterMode='all',pricingEditing=false,pricingHoldTimer=null,pricingHoldTick=null,pricingHoldStarted=0;
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const currentRole=()=>String(access?.role||window.KEYSUITE_ACCESS?.role||'viewer').toLowerCase();
  const isOwner=()=>currentRole()==='owner';
  const customerSettingsLevel=()=>isOwner()?'full':String(window.KeySuitePermissions?.level?.('customer_settings',currentRole())||'none').toLowerCase();
  const canView=()=>customerSettingsLevel()!=='none';
  const canEdit=()=>customerSettingsLevel()==='full';
  const pct=value=>(Number(value||0)*100).toFixed(2);
  const titleRole=value=>String(value||'user').replace(/[_-]+/g,' ').replace(/\b\w/g,ch=>ch.toUpperCase());
  const customers=()=>{
    const rows=window.KeySuiteApp?.getCustomers?.()||[];
    return rows.filter(row=>String(row.status||'active').toLowerCase()!=='archived').slice().sort((a,b)=>String(a.company||a.company_name||'').localeCompare(String(b.company||b.company_name||'')));
  };
  const activeCustomerId=()=>String(window.KeySuiteApp?.getPricingCustomerId?.()||window.KeySuiteApp?.getSelectedCustomer?.()?.id||'');

  function message(text,type='info'){
    const box=$('companySettingsMessage');if(!box)return;
    box.textContent=text||'';box.className=text?`auth-message show ${type}`:'auth-message';
  }
  function normalizedRows(){
    const source=window.KEYSUITE_SECURE_DATA?.customerPricingRows||[];
    const map=new Map(source.map(row=>{const normalized=normalizeRow(row);return [String(normalized.customerId||''),normalized]}));
    return customers().map(customer=>map.get(String(customer.id))||normalizeRow({customer_id:customer.id,customer_name:customer.company||customer.company_name,commission:0,set_discount:0,final_discount:0}));
  }
  function selectedSettings(){return normalizedRows().find(row=>String(row.customerId)===String(selectedCustomerId))||null}
  function isNotSet(row){return !(Number(row?.commission)>0)&&!(Number(row?.setDiscount)>0)&&!(Number(row?.finalDiscount)>0)}
  function selectedCustomer(){return customers().find(row=>String(row.id)===String(selectedCustomerId))||null}

  function renderCount(){
    const rows=normalizedRows(),missing=rows.filter(isNotSet).length,total=rows.length,box=$('companySetupCount');
    if(box)box.textContent=`Not Set: ${missing} / ${total}`;
  }
  function renderSelect(){
    const select=$('companySettingsCompanySelect');if(!select)return;
    const rows=normalizedRows(),allowedIds=new Set(rows.filter(row=>filterMode!=='not-set'||isNotSet(row)).map(row=>String(row.customerId)));
    const visible=customers().filter(customer=>allowedIds.has(String(customer.id)));
    if(!visible.some(customer=>String(customer.id)===String(selectedCustomerId)))selectedCustomerId=String(visible[0]?.id||'');
    select.innerHTML=visible.length?visible.map(customer=>`<option value="${esc(customer.id)}">${esc(customer.company||customer.company_name||'Unnamed Customer')}</option>`).join(''):'<option value="">No customers match this filter</option>';
    select.value=selectedCustomerId;select.disabled=!canView()||!visible.length;
  }
  function renderCustomer(){
    const customer=selectedCustomer(),host=$('companyIdentitySummary');if(!host)return;
    host.innerHTML=customer?[
      ['Customer Name',customer.company||customer.company_name||'-'],['Classification',customer.classification||'Other'],['Phone',customer.companyPhone||customer.company_phone||'-'],['Address',customer.address||'-'],['TIN',customer.tinNumber||customer.tin_number||'-'],['Business Registration No.',customer.brnNumber||customer.business_registration_no||'-'],['SST No.',customer.sstNumber||customer.sst_number||'-']
    ].map(([label,value])=>`<div class="pricing-kv"><b>${esc(label)}</b><span>${esc(value)}</span></div>`).join(''):'<p class="muted">No customer is selected.</p>';
  }
  function renderFields(){
    const data=selectedSettings()||normalizeRow({customer_id:selectedCustomerId});
    if($('companyCommissionInput'))$('companyCommissionInput').value=pct(data.commission);
    if($('companySetDiscountInput'))$('companySetDiscountInput').value=pct(data.setDiscount);
    if($('companyFinalDiscountInput'))$('companyFinalDiscountInput').value=pct(data.finalDiscount);
    const unavailable=!canView()||!selectedCustomerId,editable=canEdit()&&!unavailable;
    ['companyCommissionInput','companySetDiscountInput','companyFinalDiscountInput'].forEach(id=>{const input=$(id);if(input){input.disabled=unavailable;input.readOnly=!pricingEditing||!editable;input.setAttribute('aria-readonly',String(input.readOnly));}});
    if($('saveCompanyPricing'))$('saveCompanyPricing').disabled=!editable||!pricingEditing;
    const editor=$('companyPricingEditor');editor?.classList.toggle('company-pricing-locked',!pricingEditing||!editable);
    const unlock=$('unlockCompanyPricing');if(unlock){unlock.disabled=!editable;unlock.textContent=!editable?'View Only':(pricingEditing?'Editing Enabled':'Hold 3s to Edit');unlock.classList.toggle('green',pricingEditing&&editable)}
  }
  function stopPricingHold(reset=true){
    if(pricingHoldTimer)clearTimeout(pricingHoldTimer);if(pricingHoldTick)clearInterval(pricingHoldTick);pricingHoldTimer=pricingHoldTick=null;
    const button=$('unlockCompanyPricing');if(button){button.classList.remove('counting');if(reset&&!pricingEditing)button.textContent='Hold 3s to Edit'}
  }
  function lockPricingEditor(){stopPricingHold();pricingEditing=false;renderFields()}
  function startPricingHold(event){
    if(!canEdit()||pricingEditing||!selectedCustomerId)return;if(event.pointerType==='mouse'&&event.button!==0)return;
    event.preventDefault();stopPricingHold(false);pricingHoldStarted=Date.now();const button=$('unlockCompanyPricing');button?.classList.add('counting');
    const update=()=>{const left=Math.max(0,3000-(Date.now()-pricingHoldStarted));if(button)button.textContent=`Edit in ${(left/1000).toFixed(1)}s`};update();pricingHoldTick=setInterval(update,100);
    pricingHoldTimer=setTimeout(()=>{stopPricingHold(false);pricingEditing=true;message('Editing enabled. Save the customer rates when finished.','info');renderFields()},3000);
  }
  function renderAll(){renderCount();renderSelect();renderCustomer();renderFields()}
  function percentInput(id,label){
    const value=Number($(id)?.value);if(!Number.isFinite(value)||value<0||value>=100)throw new Error(`${label} must be from 0% to below 100%.`);return value/100;
  }
  function upsertLocal(row){
    const normalized=normalizeRow(row),data=window.KEYSUITE_SECURE_DATA||(window.KEYSUITE_SECURE_DATA={}),rows=Array.isArray(data.customerPricingRows)?data.customerPricingRows:[];
    const index=rows.findIndex(item=>String(item.customerId||item.customer_id)===String(normalized.customerId));
    if(index>=0)rows.splice(index,1,normalized);else rows.push(normalized);data.customerPricingRows=rows;
    if(String(normalized.customerId)===activeCustomerId())data.customerPricing=normalized;
    return normalized;
  }
  function missingMigration(error){
    const text=String(error?.message||error||'').toLowerCase();
    return text.includes('keysuite_save_customer_pricing_v222')&&(text.includes('does not exist')||text.includes('schema cache')||text.includes('could not find'));
  }
  async function save(){
    if(!canEdit()){message('Your role has View-only access to Key → Customer.','error');return}
    if(!selectedCustomerId){message('Select a customer first.','error');return}
    const targetName=selectedCustomer()?.company||selectedCustomer()?.company_name||'the selected customer';
    let commission,setDiscount,finalDiscount;
    try{commission=percentInput('companyCommissionInput','Commission');setDiscount=percentInput('companySetDiscountInput','Set Discount');finalDiscount=percentInput('companyFinalDiscountInput','Final Discount')}catch(error){message(error.message,'error');return}
    const button=$('saveCompanyPricing'),original=button?.textContent;if(button){button.disabled=true;button.textContent='Saving…'}message('');
    try{
      const client=window.KeySuiteAuth?.getClient?.();if(!client)throw new Error('Supabase is not connected.');
      const {data,error}=await client.rpc('keysuite_save_customer_pricing_v222',{p_customer_id:selectedCustomerId,p_commission:commission,p_set_discount:setDiscount,p_final_discount:finalDiscount});if(error)throw error;
      const row=Array.isArray(data)?data[0]:data;const normalized=upsertLocal(row||{customer_id:selectedCustomerId,customer_name:selectedCustomer()?.company,commission,set_discount:setDiscount,final_discount:finalDiscount});
      window.dispatchEvent(new CustomEvent('keysuite-customer-pricing-changed',{detail:{customerId:normalized.customerId,settings:normalized}}));
      pricingEditing=false;renderAll();window.KeySuitePricing?.render?.();window.KeySuiteCategories?.render?.();window.KeySuiteAssembly?.refreshPricing?.();message(`Customer rates saved for ${targetName}. Editing is locked again.`,'info');
    }catch(error){console.error(error);message(missingMigration(error)?'Customer pricing storage is not installed. Run V222_SUPABASE_MIGRATION.sql first.':(error.message||String(error)),'error')}
    finally{if(button){button.textContent=original;button.disabled=!pricingEditing||!canEdit()||!selectedCustomerId}}
  }
  function bind(){
    if(bound)return;bound=true;
    $('companySettingsCompanySelect')?.addEventListener('change',event=>{selectedCustomerId=String(event.target.value||'');pricingEditing=false;renderCustomer();renderFields();message('')});
    $('companySetupFilter')?.addEventListener('change',event=>{filterMode=event.target.value==='not-set'?'not-set':'all';renderAll();message('')});
    $('saveCompanyPricing')?.addEventListener('click',save);$('unlockCompanyPricing')?.addEventListener('pointerdown',startPricingHold);['pointerup','pointerleave','pointercancel'].forEach(name=>$('unlockCompanyPricing')?.addEventListener(name,()=>stopPricingHold()));$('unlockCompanyPricing')?.addEventListener('contextmenu',event=>event.preventDefault());
    window.addEventListener('keysuite-customers-changed',()=>{if(!selectedCustomerId)selectedCustomerId=activeCustomerId()||String(customers()[0]?.id||'');renderAll()});
  }
  function render(){
    if(!$('companySettings'))return;
    const level=customerSettingsLevel(),allowed=level!=='none',editable=level==='full';
    $('companySettingsOwnerNotice').innerHTML=allowed
      ?`Signed in as <b>${esc(access?.display_name||access?.email||titleRole(currentRole()))}</b>. Customer Settings access: <b>${editable?'Full':'View'}</b>.${isOwner()?' Customer Assigned Brand remains Owner-controlled.':''}`
      :'Your role does not have access to Key → Customer.';
    $('companyPricingEditor').style.display=allowed?'block':'none';
    const toolbar=document.querySelector('.company-settings-toolbar');if(toolbar)toolbar.style.display=allowed?'grid':'none';
    if(!selectedCustomerId)selectedCustomerId=activeCustomerId()||String(customers()[0]?.id||'');renderAll();
  }
  function normalizeRow(row={},fallback={}){
    const q=row.quotation||fallback.quotation||{},a=row.assembly||fallback.assembly||{};
    const commission=Number(row.commission??row.quotation_commission??q.commission??row.assembly_commission??a.commission??0);
    const setDiscount=Number(row.setDiscount??row.set_discount??row.quotation_set_discount??q.setDiscount??0);
    const finalDiscount=Number(row.finalDiscount??row.final_discount??row.quotation_final_discount??q.finalDiscount??row.assembly_final_discount??a.finalDiscount??0);
    const customerId=String(row.customerId??row.customer_id??fallback.customerId??'');
    return {customerId,customerName:row.customerName??row.customer_name??fallback.customerName??'',commission,setDiscount,finalDiscount,updatedAt:row.updatedAt??row.updated_at??null,
      quotation:{commission,setDiscount,finalDiscount,includeCommission:true,includeSetDiscount:true,includeFinalDiscount:true,includeFuelCharge:true},
      assembly:{commission,setDiscount:0,finalDiscount,includeCommission:true,includeSetDiscount:false,includeFinalDiscount:true,includeFuelCharge:true}};
  }
  function normalizeRows(rows=[],fallback=[]){return (Array.isArray(rows)?rows:rows?[rows]:[]).map((row,index)=>normalizeRow(row,Array.isArray(fallback)?fallback[index]||{}:fallback))}
  function init(data,userAccess){access=userAccess||access;bind();if(!selectedCustomerId)selectedCustomerId=activeCustomerId()||String(customers()[0]?.id||'');render()}
  function pageShown(id){if(id==='companySettings')render();else if(pricingEditing)lockPricingEditor()}
  const api={init,pageShown,render,normalizeRow,normalizeRows};
  window.KeySuiteCompanySettings=api;
  window.KeySuiteCustomerSettings=api;
})();
