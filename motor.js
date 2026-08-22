(() => {
  'use strict';

  const PREFIX_TO_IE=Object.freeze({BM:'IE1','2BM':'IE2','3BM':'IE3','4BM':'IE4','5BM':'IE5'});
  const IE_TO_PREFIX=Object.freeze({IE1:'BM',IE2:'2BM',IE3:'3BM',IE4:'4BM',IE5:'5BM'});
  const CURRENCIES=['USD','RMB','MYR'];
  const EFFICIENCIES=['IE1','IE2','IE3','IE4','IE5'];
  const POLES=[2,4,6,8];
  const RARITIES=['common','many','rare','fixed'];
  const unlockedRates=new Set();
  const rateHoldState=new Map();
  let secureData={motorProducts:[],categories:[],productMultipliers:{MOTOR:{USD:1,RMB:1,MYR:1}}};
  let access=null;
  let bound=false;

  const byId=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const number=value=>Number.isFinite(Number(value))?Number(value):0;
  const money=value=>`RM ${number(value).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const hpLabel=value=>Number.isInteger(Number(value))?String(Number(value)):String(Number(value)).replace(/0+$/,'').replace(/\.$/,'');
  const validCurrency=value=>CURRENCIES.includes(String(value||'').toUpperCase())?String(value).toUpperCase():'USD';
  const permissionLevel=key=>window.KeySuitePermissions?.level?.(key,String(access?.role||window.KEYSUITE_ACCESS?.role||'viewer').toLowerCase())||'none';
  const canEditPrices=()=>permissionLevel('manage_price_list')==='full';
  const products=()=>secureData.motorProducts||[];
  const categories=()=>secureData.categories||[];
  const pricingCustomer=()=>window.KeySuiteApp?.getPricingCustomer?.()||window.KeySuiteApp?.getSelectedCustomer?.()||null;

  function categoryFor(customer=pricingCustomer()){
    if(!customer)return null;
    const wanted=customer.pricingCategoryId||customer.pricing_category_id||customer.categoryId||customer.category_id||'';
    return categories().find(row=>String(row.id)===String(wanted))||null;
  }

  function parseMotorModel(value){
    const model=String(value||'').trim().toUpperCase();
    const match=model.match(/^(BM|2BM|3BM|4BM|5BM)(\d+(?:\.\d+)?)-(\d+)$/);
    if(!match)return null;
    const hp=Number(match[2]);
    const pole=Number(match[3]);
    const efficiencyClass=PREFIX_TO_IE[match[1]];
    if(!(hp>0)||!Number.isInteger(pole)||pole<=0)return null;
    return {model,prefix:match[1],efficiencyClass,hp,pole,description:`${hpLabel(hp)}HP ${pole}Pole ${efficiencyClass} Motor (415V / 3Ph / 50Hz)`};
  }

  function buildMotorModel(efficiencyClass,hp,pole){
    const prefix=IE_TO_PREFIX[String(efficiencyClass||'').toUpperCase()];
    return prefix?parseMotorModel(`${prefix}${hpLabel(hp)}-${Number(pole)}`):null;
  }

  function priceBook(product){
    return product?.pricesByCurrency||{
      USD:{MOTOR:number(product?.priceUsd??product?.price_usd)},
      RMB:{MOTOR:number(product?.priceRmb??product?.price_rmb)},
      MYR:{MOTOR:number(product?.priceMyr??product?.price_myr)}
    };
  }

  function rarityBook(product){
    const rarity=String(product?.rarity||'common').toLowerCase();
    return product?.rarityByCurrency||{
      USD:{MOTOR:rarity},RMB:{MOTOR:rarity},MYR:{MOTOR:rarity}
    };
  }

  function findPrice(idOrModel,options={}){
    const product=products().find(row=>String(row.id)===String(idOrModel)||String(row.model).toLowerCase()===String(idOrModel||'').toLowerCase());
    const customer=options.customer||pricingCustomer();
    const category=options.category||categoryFor(customer);
    if(!product||!customer||!category)return null;
    const calc=window.KeySuitePricing?.calculatePrice?.(
      priceBook(product),'MOTOR',category,'MOTOR',
      {...options,customer,rarity:product.rarity||'common',rarityBook:rarityBook(product),pricingMode:options.pricingMode||'quotation'}
    );
    if(!calc)return null;
    return {product,material:'MOTOR',variant:'MOTOR',rarity:calc.rarity,calc,category,customer,family:'MOTOR'};
  }

  function snapshot(found){
    return window.KeySuitePricing?.sourceSnapshot?.(found)||{
      product_family:'MOTOR',product_id:found.product.id,material:'MOTOR',variant:'MOTOR',
      rarity:found.calc.rarity,pricing_mode:found.calc.pricingMode,calculated_price:found.calc.finalPrice
    };
  }

  function makeItem(found,route='quotation'){
    const parsed=buildMotorModel(found.product.efficiencyClass,found.product.hp,found.product.pole);
    const code=parsed?.model||found.product.model;
    const plainDescription=parsed?.description||`${hpLabel(found.product.hp)}HP ${Number(found.product.pole)}Pole ${found.product.efficiencyClass} Motor (415V / 3Ph / 50Hz)`;
    return {
      model:route==='quotation'?`B.G.Reich Motor Model: ${code}`:code,
      bomDescription:code,
      description:route==='assembly'?`c/w\t${plainDescription}`:plainDescription,
      qty:1,unitPrice:number(found.calc.finalPrice),
      pricingSource:snapshot(found),productFamily:'MOTOR',assemblyLevel:'PUMPSET_COMPONENT',
      assemblySection:'motor',section:'motor',
      motorData:{productId:found.product.id,model:code,efficiencyClass:found.product.efficiencyClass,hp:number(found.product.hp),pole:number(found.product.pole)}
    };
  }

  function findStandardProduct(hp,pole,efficiencyClass){
    return products().find(product=>number(product.hp)===number(hp)&&number(product.pole)===number(pole)&&String(product.efficiencyClass)===String(efficiencyClass||'IE3'))||null;
  }

  function configureAssemblyItem(item,values={}){
    const hp=number(values.hp??item?.motorData?.hp),pole=number(values.pole??item?.motorData?.pole??2),efficiencyClass=String(values.efficiencyClass??item?.motorData?.efficiencyClass??'IE3');
    const product=findStandardProduct(hp,pole,efficiencyClass);if(!product)return {error:'The selected Motor combination is not available.'};
    const found=findPrice(product.id,{pricingMode:'assembly'});const parsed=buildMotorModel(efficiencyClass,hp,pole);const description=parsed?.description||`${hpLabel(hp)}HP ${pole}Pole ${efficiencyClass} Motor (415V / 3Ph / 50Hz)`;
    item.model=parsed?.model||product.model;item.bomDescription=item.model;item.description=`c/w\t${description}`;item.qty=Math.max(0,number(item.qty||1));
    const previous=item.motorData||{},defaults={
      defaultHp:Number(previous.defaultHp??previous.hp??hp),
      defaultPole:Number(previous.defaultPole??previous.pole??pole),
      defaultEfficiencyClass:String(previous.defaultEfficiencyClass??previous.efficiencyClass??efficiencyClass)
    };
    item.motorData={productId:product.id,model:item.model,efficiencyClass,hp,pole,...defaults};
    if(found){item.unitPrice=number(found.calc.finalPrice);item.pricingSource=snapshot(found)}
    else{item.unitPrice=0;item.pricingSource={product_family:'MOTOR',product_id:product.id,pricing_mode:'assembly',motor_model:item.model}}
    return {product,found,item};
  }

  function requireContext(action){return window.KeySuiteApp?.ensureQuotationPricingContext?.(action)!==false}

  async function addProduct(product,route){
    if(!product||!requireContext(`add a Motor to the ${route==='assembly'?'Assembly':'quotation'}`))return;
    const found=findPrice(product.id,{pricingMode:route==='assembly'?'assembly':'quotation'});
    if(!found){alert('No Motor source price or Motor Category Pricing Rule is available for this model.');return}
    const item=makeItem(found,route);
    if(route==='assembly'){
      await window.KeySuiteAssembly?.addItem?.(item,{type:'pumpset',section:'motor'});
      return;
    }
    if(!window.KeySuitePricing?.ensureQuoteableCalculation?.(found.calc,product.model))return;
    const row=window.KeySuiteApp?.addExternalQuoteItem?.(item);
    if(row)window.KeySuiteApp?.showPage?.('quotation');
  }


  function message(id,text,type='info'){
    const box=byId(id);if(!box)return;
    box.textContent=text||'';
    box.className=text?`auth-message show ${type}`:'auth-message';
  }

  function uniqueHpValues(){
    return [...new Set(products().map(product=>number(product.hp)).filter(value=>value>0))].sort((a,b)=>a-b);
  }

  function fillHpSelect(id){
    const select=byId(id);if(!select)return;
    const previous=select.value;
    const values=uniqueHpValues();
    select.innerHTML=values.map(value=>`<option value="${esc(hpLabel(value))}">${esc(hpLabel(value))} HP</option>`).join('');
    if(values.some(value=>hpLabel(value)===previous))select.value=previous;
    else if(values.length)select.value=hpLabel(values[0]);
  }

  function selectedStandardProduct(){
    const hp=number(byId('motorProductHp')?.value);
    const pole=number(byId('motorProductPole')?.value||2);
    const efficiency=byId('motorProductEfficiency')?.value||'IE3';
    return products().find(product=>number(product.hp)===hp&&number(product.pole)===pole&&product.efficiencyClass===efficiency)||null;
  }

  function renderProduct(){
    const efficiencySelect=byId('motorProductEfficiency');
    if(efficiencySelect)efficiencySelect.classList.toggle('non-default-selection',String(efficiencySelect.value||'IE3')!=='IE3');
    const customer=pricingCustomer();
    const category=categoryFor(customer);
    const notice=byId('motorProductNotice');
    if(notice)notice.textContent=customer&&category
      ?`Pricing customer: ${customer.company||customer.name||'Selected customer'} · ${category.name}`
      :'Select a quotation customer with a Pricing Category before pricing a motor.';

    const product=selectedStandardProduct();
    const model=byId('motorSelectedModel');
    const description=byId('motorSelectedDescription');
    if(model)model.textContent=product?.model||'No matching model';
    if(description)description.textContent=product?(buildMotorModel(product.efficiencyClass,product.hp,product.pole)?.description||product.description):'This HP, Pole and Efficiency combination is not available.';
    ['motorSelectedAssembly','motorSelectedQuote'].forEach(id=>{if(byId(id))byId(id).disabled=!product});
  }

  function currentPriceCurrency(){
    return validCurrency(byId('motorPriceCurrency')?.value||localStorage.getItem('ks_motor_price_currency')||'USD');
  }

  function priceField(currency){return currency==='USD'?'priceUsd':currency==='RMB'?'priceRmb':'priceMyr'}

  function selectedPriceRows(){
    const efficiency=byId('motorPriceEfficiency')?.value||'IE3';
    const pole=number(byId('motorPricePole')?.value||2);
    return products()
      .filter(product=>product.efficiencyClass===efficiency&&number(product.pole)===pole)
      .sort((a,b)=>number(a.hp)-number(b.hp));
  }

  function storedPrice(product,currency){
    const value=product?.pricesByCurrency?.[currency]?.MOTOR;
    if(value!==undefined&&value!==null)return number(value);
    return number(product?.[priceField(currency)]);
  }

  function priceCompletion(rows,currency){
    const filled=rows.filter(product=>storedPrice(product,currency)>0).length;
    return `${filled}/${rows.length}`;
  }

  function rarityOptions(selected){
    return RARITIES.map(rarity=>`<option value="${rarity}" ${rarity===selected?'selected':''}>${rarity[0].toUpperCase()+rarity.slice(1)}</option>`).join('');
  }

  function renderPriceList(){
    const body=byId('motorPriceRows');if(!body)return;
    const currency=currentPriceCurrency();
    const editable=canEditPrices();
    const rows=selectedPriceRows();
    const efficiency=byId('motorPriceEfficiency')?.value||'IE3';
    const pole=number(byId('motorPricePole')?.value||2);
    const heading=byId('motorPriceValueHeading');
    if(heading)heading.textContent=`${currency} Price`;

    body.innerHTML=rows.map(product=>{
      const raw=storedPrice(product,currency);
      const shown=raw>0?raw.toFixed(2):'';
      return `<tr data-motor-price-row="${esc(product.id)}">
        <td><b>${esc(hpLabel(product.hp))}</b></td>
        <td>${esc(product.model)}</td>
        <td><select class="motor-row-rarity" ${editable?'':'disabled'}>${rarityOptions(String(product.rarity||'common').toLowerCase())}</select></td>
        <td><div class="currency-price-input"><span>${esc(currency)}</span><input class="motor-row-price" type="number" min="0" step="0.01" value="${esc(shown)}" ${editable?'':'readonly'} aria-label="${esc(product.model)} ${esc(currency)} price"></div></td>
        <td class="pricelist-row-actions"><button class="btn icon-save-button motor-row-save" type="button" ${editable?'':'disabled'} title="Save ${esc(product.model)}" aria-label="Save ${esc(product.model)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12l2 2v14H5z"></path><path d="M8 4v6h8V4"></path><path d="M8 20v-6h8v6"></path></svg></button></td>
      </tr>`;
    }).join('')||'<tr><td colspan="5" class="muted">No Motor HP ratings are available for this Efficiency and Pole selection.</td></tr>';

    body.querySelectorAll('[data-motor-price-row]').forEach(row=>{
      row.querySelector('.motor-row-save')?.addEventListener('click',()=>savePrice(row.dataset.motorPriceRow,row));
    });

    const count=byId('motorPriceCount');
    if(count){
      count.textContent=`${rows.length} HP ratings · ${efficiency} · ${pole} Pole · Editing ${currency} · USD ${priceCompletion(rows,'USD')} · RMB ${priceCompletion(rows,'RMB')} · MYR ${priceCompletion(rows,'MYR')}`;
    }
    renderRateInputs();
  }

  async function savePrice(id,row){
    if(!canEditPrices())return;
    const currency=currentPriceCurrency();
    const input=row.querySelector('.motor-row-price');
    const raw=String(input?.value||'').trim();
    const price=raw===''?0:number(raw);
    const rarity=row.querySelector('.motor-row-rarity')?.value||'common';
    const client=window.KeySuiteAuth?.getClient?.();
    if(!client)return;
    try{
      const {error}=await client.rpc('keysuite_save_motor_price_v223',{p_product_id:id,p_currency:currency,p_price:price,p_rarity:rarity});
      if(error)throw error;
      const product=products().find(item=>item.id===id);
      if(product){
        product[priceField(currency)]=price;
        product.pricesByCurrency=product.pricesByCurrency||{};
        product.pricesByCurrency[currency]=product.pricesByCurrency[currency]||{};
        product.pricesByCurrency[currency].MOTOR=price;
        product.rarity=rarity;
        product.rarityByCurrency=product.rarityByCurrency||{};
        CURRENCIES.forEach(code=>{
          product.rarityByCurrency[code]=product.rarityByCurrency[code]||{};
          product.rarityByCurrency[code].MOTOR=rarity;
        });
      }
      message('motorPriceMessage',`${product?.model||'Motor'} ${currency} price saved.`,'info');
      renderPriceList();
      renderProduct();
    }catch(error){
      message('motorPriceMessage',`${error.message||error}. Run V223_SUPABASE_MIGRATION.sql first.`,'error');
    }
  }

  function motorRates(){
    const rates=secureData.productMultipliers?.MOTOR||{};
    return {USD:number(rates.USD||1),RMB:number(rates.RMB||1),MYR:1};
  }

  function rateInput(currency){return byId(currency==='USD'?'motorUsdMultiplier':'motorRmbMultiplier')}
  function rateGroup(currency){return byId(`motorMultiplierLock_${currency}`)}

  function setRateUnlocked(currency,on){
    const input=rateInput(currency);
    const group=rateGroup(currency);
    if(on)unlockedRates.add(currency);else unlockedRates.delete(currency);
    if(input){input.readOnly=!on;input.setAttribute('aria-readonly',String(!on));}
    if(group){
      group.classList.toggle('unlocked',on);
      group.classList.toggle('locked',!on);
      group.classList.remove('holding');
      const hint=group.querySelector('.multiplier-hold-feedback');
      if(hint)hint.textContent=on?'Unlocked — Save or Cancel':'Hold input 3s to edit';
      group.querySelector('.multiplier-actions')?.classList.toggle('show',on);
    }
  }

  function renderRateInputs(){
    const rates=motorRates();
    ['USD','RMB'].forEach(currency=>{
      const input=rateInput(currency);
      if(input&&document.activeElement!==input&&!unlockedRates.has(currency))input.value=Number(rates[currency]).toFixed(4);
      setRateUnlocked(currency,unlockedRates.has(currency));
      if(input)input.disabled=!canEditPrices();
      const group=rateGroup(currency);
      group?.querySelectorAll('button').forEach(button=>button.disabled=!canEditPrices());
    });
  }

  function clearRateHold(currency){
    const state=rateHoldState.get(currency);
    if(state){clearTimeout(state.timer);clearInterval(state.interval);rateHoldState.delete(currency);}
    const group=rateGroup(currency);
    if(group&&!unlockedRates.has(currency)){
      group.classList.remove('holding');
      const hint=group.querySelector('.multiplier-hold-feedback');
      if(hint)hint.textContent='Hold input 3s to edit';
    }
  }

  function beginRateHold(currency,event){
    if(!canEditPrices()||unlockedRates.has(currency))return;
    event.preventDefault();
    clearRateHold(currency);
    const started=Date.now();
    const group=rateGroup(currency);
    const hint=group?.querySelector('.multiplier-hold-feedback');
    group?.classList.add('holding');
    const update=()=>{
      const remaining=Math.max(0,3000-(Date.now()-started));
      if(hint)hint.textContent=`Hold ${(remaining/1000).toFixed(1)}s to edit`;
    };
    update();
    const interval=setInterval(update,100);
    const timer=setTimeout(()=>{
      clearInterval(interval);
      rateHoldState.delete(currency);
      setRateUnlocked(currency,true);
      rateInput(currency)?.focus();
      rateInput(currency)?.select();
    },3000);
    rateHoldState.set(currency,{timer,interval});
  }

  function cancelRateEdit(currency){
    const rates=motorRates();
    const input=rateInput(currency);
    if(input)input.value=Number(rates[currency]).toFixed(4);
    setRateUnlocked(currency,false);
  }

  async function saveRate(currency){
    if(!canEditPrices()||!unlockedRates.has(currency))return;
    const input=rateInput(currency);
    const value=number(input?.value);
    const client=window.KeySuiteAuth?.getClient?.();
    if(!client||value<=0){message('motorPriceMessage',`${currency} rate must be greater than zero.`,'error');return}
    try{
      const {error}=await client.rpc('keysuite_save_motor_multiplier_v223',{p_currency:currency,p_multiplier:value});
      if(error)throw error;
      secureData.productMultipliers=secureData.productMultipliers||{};
      secureData.productMultipliers.MOTOR={...(secureData.productMultipliers.MOTOR||{}),[currency]:value,MYR:1};
      window.KeySuitePricing?.syncPriceListSettings?.({productMultipliers:secureData.productMultipliers});
      setRateUnlocked(currency,false);
      message('motorPriceMessage',`Motor ${currency} rate saved: MYR ${value.toFixed(4)}.`,'info');
      renderProduct();
    }catch(error){message('motorPriceMessage',error.message||String(error),'error')}
  }


  function initializeControls(){
    fillHpSelect('motorProductHp');
    const productEfficiency=byId('motorProductEfficiency');
    if(productEfficiency&&!EFFICIENCIES.includes(productEfficiency.value))productEfficiency.value='IE3';
    const productPole=byId('motorProductPole');
    if(productPole&&!POLES.includes(number(productPole.value)))productPole.value='2';

    const priceCurrency=byId('motorPriceCurrency');
    if(priceCurrency)priceCurrency.value=validCurrency(localStorage.getItem('ks_motor_price_currency')||priceCurrency.value||'USD');
    const priceEfficiency=byId('motorPriceEfficiency');
    if(priceEfficiency&&!EFFICIENCIES.includes(priceEfficiency.value))priceEfficiency.value='IE3';
    const pricePole=byId('motorPricePole');
    if(pricePole&&!POLES.includes(number(pricePole.value)))pricePole.value='2';
  }

  function bind(){
    if(bound)return;
    bound=true;

    ['motorProductHp','motorProductPole','motorProductEfficiency'].forEach(id=>byId(id)?.addEventListener('change',renderProduct));
    byId('motorSelectedAssembly')?.addEventListener('click',()=>addProduct(selectedStandardProduct(),'assembly'));
    byId('motorSelectedQuote')?.addEventListener('click',()=>addProduct(selectedStandardProduct(),'quotation'));

    byId('motorPriceCurrency')?.addEventListener('change',event=>{
      localStorage.setItem('ks_motor_price_currency',validCurrency(event.target.value));
      renderPriceList();
    });
    ['motorPriceEfficiency','motorPricePole'].forEach(id=>byId(id)?.addEventListener('change',renderPriceList));

    ['USD','RMB'].forEach(currency=>{
      const input=rateInput(currency);
      input?.addEventListener('pointerdown',event=>beginRateHold(currency,event));
      ['pointerup','pointercancel','pointerleave'].forEach(type=>input?.addEventListener(type,()=>clearRateHold(currency)));
      rateGroup(currency)?.querySelector('[data-motor-rate-save]')?.addEventListener('click',()=>saveRate(currency));
      rateGroup(currency)?.querySelector('[data-motor-rate-cancel]')?.addEventListener('click',()=>cancelRateEdit(currency));
    });

    window.addEventListener('keysuite-customer-pricing-changed',renderProduct);
  }

  function init(data,userAccess){
    secureData={...secureData,...(data||{})};
    access=userAccess||access;
    initializeControls();
    bind();
    renderProduct();
    renderPriceList();
  }

  function pageShown(id){
    if(id==='productMotor')renderProduct();
    if(id==='motorPriceList')renderPriceList();
  }

  window.KeySuiteMotor={
    init,pageShown,renderProduct,renderPriceList,findPrice,parseMotorModel,buildMotorModel,addProduct,findStandardProduct,configureAssemblyItem,
    PREFIX_TO_IE,IE_TO_PREFIX
  };
})();
