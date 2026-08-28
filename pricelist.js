(() => {
  'use strict';

  let access=null;
  let secureData={products:[],chcG1Products:[],esProducts:[],gwsProducts:[],keyplcProducts:[],productMultipliers:{CHC:{USD:5.8,RMB:.65,MYR:1},ES:{USD:5.8,RMB:.65,MYR:1},GWS:{USD:5.8,RMB:.65,MYR:1},KEYPLC:{USD:5.8,RMB:.65,MYR:1}}};
  let selectedChcGeneration='G2';
  let bound=false;
  const unlockedMultipliers=new Set();
  const originalMultiplierValues=new Map();
  const esMaterialSelections=new Map();

  const el=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const permissionLevel=()=>window.KeySuitePermissions?.level?.('manage_price_list',String(access?.role||window.KEYSUITE_ACCESS?.role||'viewer').toLowerCase())||'none';
  const canView=()=>permissionLevel()!=='none';
  const isOwner=()=>permissionLevel()==='full';
  const chcG2Products=()=>secureData.products||[];
  const chcG1Products=()=>secureData.chcG1Products||[];
  const chcProducts=()=>selectedChcGeneration==='G1'?chcG1Products():chcG2Products();
  const gwsProducts=()=>secureData.gwsProducts||[];
  const esProducts=()=>secureData.esProducts||[];
  const keyplcProducts=()=>secureData.keyplcProducts||[];
  const validCurrency=value=>['USD','RMB','MYR'].includes(String(value||'').toUpperCase())?String(value).toUpperCase():'USD';
  const validRarity=value=>['common','many','rare','fixed'].includes(String(value||'').toLowerCase())?String(value).toLowerCase():'common';
  const currentCurrency=prefix=>validCurrency(el(`${prefix}PriceCurrency`)?.value||localStorage.getItem(`ks_${prefix}_price_currency`)||'USD');
  const familyCode=prefix=>{const family=String(prefix||'chc').toUpperCase();return ['CHC','ES','GWS','KEYPLC'].includes(family)?family:'CHC'};
  const ES_MATERIALS=['CI / SS / SS / MS','CI / SS / SS / GP','CI / CI / SS / MS','CI / CI / SS / GP','SS304','SS316'];
  const esPriceField=currency=>({USD:'priceUsd',RMB:'priceRmb',MYR:'priceMyr'})[validCurrency(currency)];
  const keyplcPriceField=esPriceField;
  const normMaterial=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9]+/g,'');
  const countId=prefix=>`${prefix}PriceListCount`;
  const isFilled=value=>value!==null&&value!==''&&Number.isFinite(Number(value))&&Number(value)>0;

  function storedInputValue(prefix,input,currency){
    if(prefix==='chc'){
      const product=chcProducts().find(item=>String(item.id)===String(input.dataset.priceProduct));
      return currencyPrices(product,currency)?.[input.dataset.priceVariant];
    }
    if(prefix==='gws'){
      const product=gwsProducts().find(item=>String(item.id)===String(input.dataset.priceProduct));
      return currencyPrices(product,currency)?.SKU;
    }
    if(prefix==='es'){
      const product=esProducts().find(item=>String(item.id)===String(input.dataset.esPrice));
      const variant=(product?.variants||[]).find(item=>normMaterial(item.material)===normMaterial(input.dataset.esMaterial));
      return variant?.[esPriceField(currency)];
    }
    if(prefix==='keyplc'){
      const product=keyplcProducts().find(item=>String(item.id)===String(input.dataset.keyplcPrice));
      const qty=Number(input.dataset.keyplcPump),variant=(product?.variants||[]).find(item=>Number(item.pumpQty||item.pump_qty||String(item.label||'').match(/\d+/)?.[0]||0)===qty);
      return variant?.[keyplcPriceField(currency)];
    }
    return null;
  }

  function completion(prefix,currency){
    let total=0,filled=0;
    if(prefix==='chc'){
      total=chcProducts().length*3;
      chcProducts().forEach(product=>['CHC','CHCS','CHCN'].forEach(variant=>{if(isFilled(currencyPrices(product,currency)?.[variant]))filled++}));
    }else if(prefix==='es'){
      total=esProducts().length*ES_MATERIALS.length;
      esProducts().forEach(product=>ES_MATERIALS.forEach(material=>{const variant=(product.variants||[]).find(item=>normMaterial(item.material)===normMaterial(material));if(isFilled(variant?.[esPriceField(currency)]))filled++}));
    }else if(prefix==='gws'){
      total=gwsProducts().length;
      gwsProducts().forEach(product=>{if(isFilled(currencyPrices(product,currency)?.SKU))filled++});
    }else if(prefix==='keyplc'){
      total=keyplcProducts().length*6;
      keyplcProducts().forEach(product=>{for(let qty=1;qty<=6;qty++){const variant=(product.variants||[]).find(item=>Number(item.pumpQty||item.pump_qty||String(item.label||'').match(/\d+/)?.[0]||0)===qty);if(isFilled(variant?.[keyplcPriceField(currency)]))filled++}});
    }
    if(currency===currentCurrency(prefix)){
      const selectors={chc:'#chcPriceRows [data-price-product]',es:'#esPriceRows [data-es-price]',gws:'#gwsPriceRows [data-price-product]',keyplc:'#keyplcPriceRows [data-keyplc-price]'};
      document.querySelectorAll(selectors[prefix]||'__none__').forEach(input=>{filled+=Number(isFilled(input.value))-Number(isFilled(storedInputValue(prefix,input,currency)))});
    }
    return {filled:Math.max(0,filled),total};
  }

  function completionText(prefix){return ['USD','RMB','MYR'].map(currency=>{const result=completion(prefix,currency);return `${currency} ${result.filled.toLocaleString('en-MY')}/${result.total.toLocaleString('en-MY')}`}).join(' · ')}
  function updateCompletionLabel(prefix){const node=el(countId(prefix));if(!node)return;node.innerHTML=`${esc(node.dataset.baseText||'')} · <span class="price-completion-indicator">${esc(completionText(prefix))}</span>`}
  function setCountLabel(prefix,text){const node=el(countId(prefix));if(!node)return;node.dataset.baseText=text;updateCompletionLabel(prefix)}
  function bindCompletionInputs(prefix,body){body?.querySelectorAll('input[type="number"]').forEach(input=>input.addEventListener('input',()=>updateCompletionLabel(prefix)))}

  function message(prefix,text,type='info'){
    const box=el(`${prefix}PriceListMessage`);if(!box)return;
    box.textContent=text||'';
    box.className=text?`auth-message show ${type}`:'auth-message';
  }

  function ratesFor(prefix){
    const family=familyCode(prefix);
    const rates=secureData.productMultipliers?.[family]||{};
    return {USD:Number(rates.USD??secureData.usd_multiplier??5.8),RMB:Number(rates.RMB??secureData.rmb_multiplier??.65),MYR:1};
  }

  function currencyPrices(product,currency){return product?.pricesByCurrency?.[currency]||{}}
  function currencyRarities(product,currency){return product?.rarityByCurrency?.[currency]||{}}
  function rarityFor(product,currency,variant){return validRarity(currencyRarities(product,currency)?.[variant])}

  function rarityOptions(selected){
    return [['common','Common'],['many','Many'],['rare','Rare'],['fixed','Fixed']].map(([value,label])=>`<option value="${value}" ${value===selected?'selected':''}>${label}</option>`).join('');
  }

  function priceEditor(currency,value,variant,id){
    const shown=value===null||value===''||!Number.isFinite(Number(value))?'':Number(value).toFixed(2);
    return `<div class="currency-price-input"><span>${esc(currency)}</span><input type="number" min="0" step="0.01" value="${esc(shown)}" data-price-product="${esc(id)}" data-price-variant="${esc(variant)}" aria-label="${esc(variant)} price"></div>`;
  }

  function rarityEditor(selected,variant,id){
    return `<select data-rarity-product="${esc(id)}" data-rarity-variant="${esc(variant)}" aria-label="${esc(variant)} rarity">${rarityOptions(validRarity(selected))}</select>`;
  }
  function readOnlyPrice(currency,value){
    const shown=value===null||value===''||!Number.isFinite(Number(value))?'—':Number(value).toFixed(2);
    return `<div class="chc-price-readonly" aria-label="Inherited G2 price"><span>${esc(currency)}</span><strong>${esc(shown)}</strong></div>`;
  }

  function readOnlyRarity(value){
    if(value===null||value===undefined||value==='')return '<span class="chc-rarity-readonly">—</span>';
    const code=validRarity(value),label=({common:'Common',many:'Many',rare:'Rare',fixed:'Fixed'})[code]||'Common';
    return `<span class="chc-rarity-readonly">${esc(label)}</span>`;
  }

  function multiplierInputId(prefix,currency){return `${prefix}${currency==='USD'?'Usd':'Rmb'}Multiplier`}

  function setMultiplierUnlocked(prefix,currency,on){
    const key=`${prefix}:${currency}`;
    if(on)unlockedMultipliers.add(key);else unlockedMultipliers.delete(key);
    const group=el(`${prefix}MultiplierLock_${currency}`);
    const input=el(multiplierInputId(prefix,currency));
    if(group){
      group.classList.toggle('unlocked',on);
      group.classList.toggle('locked',!on);
      group.classList.remove('holding');
      const feedback=group.querySelector('.multiplier-hold-feedback');
      if(feedback)feedback.textContent=on?'(Unlocked — Save or Cancel)':'(Hold 3s to edit)';
      group.querySelector('.multiplier-actions')?.classList.toggle('show',on);
    }
    if(input){
      input.readOnly=!on;
      input.setAttribute('aria-readonly',String(!on));
    }
  }

  function renderMultiplierInputs(prefix){
    const rates=ratesFor(prefix);
    const usd=el(`${prefix}UsdMultiplier`),rmb=el(`${prefix}RmbMultiplier`);
    if(usd&&document.activeElement!==usd&&!unlockedMultipliers.has(`${prefix}:USD`))usd.value=Number(rates.USD).toFixed(4);
    if(rmb&&document.activeElement!==rmb&&!unlockedMultipliers.has(`${prefix}:RMB`))rmb.value=Number(rates.RMB).toFixed(4);
    ['USD','RMB'].forEach(currency=>setMultiplierUnlocked(prefix,currency,unlockedMultipliers.has(`${prefix}:${currency}`)));
  }

  function renderChcRows(){
    const body=el('chcPriceRows');if(!body)return;
    const search=String(el('chcPriceSearch')?.value||'').trim().toLowerCase();
    const currency=currentCurrency('chc'),isG1=selectedChcGeneration==='G1';
    const allRows=chcProducts();
    const rows=allRows.filter(product=>!search||String(product.model||'').toLowerCase().includes(search));
    body.innerHTML=rows.map(product=>{
      const prices=currencyPrices(product,currency),rarities=currencyRarities(product,currency);
      return `<tr data-chc-pricelist-row="${esc(product.id)}">
        <td><b>${esc(product.model)}</b><span class="chc-price-source">${isG1?'CHC G1 · OWN PRICE LIST':'CHC G2'}</span></td>
        <td>${priceEditor(currency,prices.CHC,'CHC',product.id)}</td><td>${rarityEditor(rarities.CHC,'CHC',product.id)}</td>
        <td>${priceEditor(currency,prices.CHCS,'CHCS',product.id)}</td><td>${rarityEditor(rarities.CHCS,'CHCS',product.id)}</td>
        <td>${priceEditor(currency,prices.CHCN,'CHCN',product.id)}</td><td>${rarityEditor(rarities.CHCN,'CHCN',product.id)}</td>
        <td class="pricelist-row-actions"><button class="btn icon-save-button" type="button" data-save-chc-row="${esc(product.id)}" title="Save ${esc(product.model)}" aria-label="Save ${esc(product.model)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12l2 2v14H5z"></path><path d="M8 4v6h8V4"></path><path d="M8 20v-6h8v6"></path></svg></button></td>
      </tr>`;
    }).join('')||`<tr><td colspan="8" class="muted">No matching CHC ${esc(selectedChcGeneration)} Price List models.</td></tr>`;
    const mode=isOwner()?`Editing ${currency}`:'View only';
    setCountLabel('chc',`Showing ${rows.length.toLocaleString('en-MY')} of ${allRows.length.toLocaleString('en-MY')} CHC ${selectedChcGeneration} price models · ${mode}`);
    bindCompletionInputs('chc',body);
    body.querySelectorAll('[data-save-chc-row]').forEach(button=>button.addEventListener('click',()=>saveChcRow(button.dataset.saveChcRow,button)));
    const note=el('chcGenerationPriceNote');
    if(note){
      note.classList.toggle('g1',isG1);
      note.textContent=isG1
        ?'CHC G1 has its own independent Price List. CHC G2 prices are not used. G1 technical/product master remains locked.'
        :'CHC G2 is the existing/current Price List and is unchanged.';
    }
  }

  function syncEsScrollWidth(){
    const top=el('esPriceTopScroll'),inner=el('esPriceTopScrollInner'),wrap=el('esPriceTableWrap'),table=wrap?.querySelector('.es-matrix-table');
    if(!top||!inner||!wrap||!table)return;
    inner.style.width=`${Math.max(table.scrollWidth,wrap.clientWidth)}px`;
    if(Math.abs(top.scrollLeft-wrap.scrollLeft)>1)top.scrollLeft=wrap.scrollLeft;
  }


  function renderEsRows(){
    const body=el('esPriceRows');if(!body)return;
    const q=String(el('esPriceSearch')?.value||'').trim().toLowerCase();
    const currency=currentCurrency('es'),field=esPriceField(currency);
    const rows=esProducts().filter(x=>!q||String(x.model||'').toLowerCase().includes(q));
    body.innerHTML=rows.map(product=>{
      const variants=product.variants||[],selected=esMaterialSelections.get(String(product.id))||ES_MATERIALS[0],variant=variants.find(v=>normMaterial(v.material)===normMaterial(selected)),value=variant?.[field];
      const materialOptions=ES_MATERIALS.map(material=>`<option value="${esc(material)}" ${material===selected?'selected':''}>${esc(material)}</option>`).join('');
      return `<tr data-es-pricelist-row="${esc(product.id)}"><td><b>${esc(product.model)}</b></td><td><select data-es-rarity aria-label="${esc(product.model)} rarity">${rarityOptions(validRarity(product.rarity))}</select></td><td><select class="es-material-select ${selected!==ES_MATERIALS[0]?'non-default-selection':''}" data-es-material-select aria-label="${esc(product.model)} material">${materialOptions}</select></td><td><div class="currency-price-input"><span>${esc(currency)}</span><input type="number" min="0" step="0.01" value="${esc(value===null||value===''||!Number.isFinite(Number(value))?'':Number(value).toFixed(2))}" data-es-price="${esc(product.id)}" data-es-material="${esc(selected)}" aria-label="${esc(product.model)} ${esc(selected)} ${esc(currency)} price"></div></td><td class="pricelist-row-actions"><button class="btn icon-save-button" type="button" data-save-es-row="${esc(product.id)}" title="Save ${esc(product.model)}" aria-label="Save ${esc(product.model)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12l2 2v14H5z"></path><path d="M8 4v6h8V4"></path><path d="M8 20v-6h8v6"></path></svg></button></td></tr>`;
    }).join('')||'<tr><td colspan="5" class="muted">No matching ES models.</td></tr>';
    setCountLabel('es',`Showing ${rows.length.toLocaleString('en-MY')} of ${esProducts().length.toLocaleString('en-MY')} ES models · Editing ${currency}`);
    bindCompletionInputs('es',body);
    body.querySelectorAll('[data-es-material-select]').forEach(select=>select.addEventListener('change',()=>{const row=select.closest('[data-es-pricelist-row]'),product=esProducts().find(item=>String(item.id)===String(row?.dataset.esPricelistRow)),material=select.value,variant=(product?.variants||[]).find(item=>normMaterial(item.material)===normMaterial(material)),input=row?.querySelector('[data-es-price]'),value=variant?.[field];esMaterialSelections.set(String(product?.id||''),material);select.classList.toggle('non-default-selection',material!==ES_MATERIALS[0]);if(input){input.dataset.esMaterial=material;input.value=value===null||value===''||!Number.isFinite(Number(value))?'':Number(value).toFixed(2);input.setAttribute('aria-label',`${product?.model||''} ${material} ${currency} price`)}updateCompletionLabel('es')}));
    body.querySelectorAll('[data-save-es-row]').forEach(button=>button.addEventListener('click',()=>saveEsRow(button.dataset.saveEsRow,button)));
    requestAnimationFrame(syncEsScrollWidth);
  }
  function renderGwsRows(){
    const body=el('gwsPriceRows');if(!body)return;
    const search=String(el('gwsPriceSearch')?.value||'').trim().toLowerCase();
    const currency=currentCurrency('gws');
    const rows=gwsProducts().filter(product=>{
      const hay=[product.seriesName,product.model,product.sizeCode,product.pressureBar].join(' ').toLowerCase();
      return !search||hay.includes(search);
    });
    body.innerHTML=rows.map(product=>{
      const prices=currencyPrices(product,currency),rarities=currencyRarities(product,currency);
      return `<tr data-gws-pricelist-row="${esc(product.id)}">
        <td>${esc(product.seriesName||'-')}</td>
        <td><b>${esc(product.model)}</b></td>
        <td>${esc(product.sizeCode||'-')}</td>
        <td>${esc(product.pressureBar)} Bar</td>
        <td>${priceEditor(currency,prices.SKU,'SKU',product.id)}</td>
        <td>${rarityEditor(rarities.SKU,'SKU',product.id)}</td>
        <td class="pricelist-row-actions"><button class="btn icon-save-button" type="button" data-save-gws-row="${esc(product.id)}" title="Save ${esc(product.model)}" aria-label="Save ${esc(product.model)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12l2 2v14H5z"></path><path d="M8 4v6h8V4"></path><path d="M8 20v-6h8v6"></path></svg></button></td>
      </tr>`;
    }).join('')||'<tr><td colspan="7" class="muted">No matching GWS Tank SKUs.</td></tr>';
    setCountLabel('gws',`Showing ${rows.length.toLocaleString('en-MY')} valid GWS Tank SKU${rows.length===1?'':'s'} · Editing ${currency}`);
    bindCompletionInputs('gws',body);
    body.querySelectorAll('[data-save-gws-row]').forEach(button=>button.addEventListener('click',()=>saveGwsRow(button.dataset.saveGwsRow,button)));
  }

  function renderKeyplcRows(){
    const body=el('keyplcPriceRows');if(!body)return;
    const search=String(el('keyplcPriceSearch')?.value||'').trim().toLowerCase();
    const currency=currentCurrency('keyplc'),field=keyplcPriceField(currency);
    const rows=keyplcProducts().filter(product=>!search||String(product.model||'').toLowerCase().includes(search));
    body.innerHTML=rows.map(product=>{
      const variants=product.variants||[];
      const cells=Array.from({length:6},(_,index)=>{const qty=index+1,variant=variants.find(v=>Number(v.pumpQty||v.pump_qty||String(v.label||'').match(/\d+/)?.[0]||0)===qty),value=variant?.[field];return `<td><div class="currency-price-input"><span>${esc(currency)}</span><input type="number" min="0" step="0.01" value="${esc(value===null||value===''||!Number.isFinite(Number(value))?'':Number(value).toFixed(2))}" data-keyplc-price="${esc(product.id)}" data-keyplc-pump="${qty}" aria-label="${esc(product.model)} ${qty} pump ${esc(currency)} price"></div></td>`}).join('');
      return `<tr data-keyplc-pricelist-row="${esc(product.id)}"><td><b>${esc(product.model)}</b></td><td><select data-keyplc-rarity aria-label="${esc(product.model)} rarity">${rarityOptions(validRarity(product.rarity))}</select></td>${cells}<td class="pricelist-row-actions"><button class="btn icon-save-button" type="button" data-save-keyplc-row="${esc(product.id)}" title="Save ${esc(product.model)}" aria-label="Save ${esc(product.model)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12l2 2v14H5z"></path><path d="M8 4v6h8V4"></path><path d="M8 20v-6h8v6"></path></svg></button></td></tr>`;
    }).join('')||'<tr><td colspan="9" class="muted">No matching KeyPLC panel models.</td></tr>';
    setCountLabel('keyplc',`Showing ${rows.length.toLocaleString('en-MY')} of ${keyplcProducts().length.toLocaleString('en-MY')} KeyPLC models · Editing ${currency}`);
    bindCompletionInputs('keyplc',body);
    body.querySelectorAll('[data-save-keyplc-row]').forEach(button=>button.addEventListener('click',()=>saveKeyplcRow(button.dataset.saveKeyplcRow,button)));
  }

  function renderSettings(prefix){
    const select=el(`${prefix}PriceCurrency`);
    if(select){const saved=validCurrency(localStorage.getItem(`ks_${prefix}_price_currency`)||select.value||'USD');select.value=saved}
    renderMultiplierInputs(prefix);
  }

  function readPositive(id,label){
    const value=Number(el(id)?.value);
    if(!Number.isFinite(value)||value<=0)throw new Error(`${label} must be greater than zero.`);
    return value;
  }

  async function saveMultiplier(prefix,currency){
    if(prefix==='chc'&&selectedChcGeneration==='G1'){message('chc','CHC G1 has its own prices. The CHC currency multiplier is shared and can be maintained under CHC G2.','info');return}
    if(!isOwner()){message(prefix,'Your role is not allowed to maintain Price List settings.','error');return}
    const key=`${prefix}:${currency}`;
    if(!unlockedMultipliers.has(key))return;
    let value;
    try{value=readPositive(multiplierInputId(prefix,currency),`${currency} rate`)}catch(error){message(prefix,error.message,'error');return}
    const client=window.KeySuiteAuth?.getClient?.();if(!client){message(prefix,'Supabase is not connected.','error');return}
    const family=familyCode(prefix);
    message(prefix,`Saving ${family} ${currency} rate…`,'info');
    try{
      const {data,error}=await client.rpc('keysuite_save_product_pricelist_multiplier_v119',{p_product_code:family,p_currency:currency,p_multiplier:value});
      if(error)throw error;
      const saved=Array.isArray(data)?data[0]:data||{};
      secureData.productMultipliers=secureData.productMultipliers||{};
      secureData.productMultipliers[family]={USD:Number(saved.usd_multiplier??ratesFor(prefix).USD),RMB:Number(saved.rmb_multiplier??ratesFor(prefix).RMB),MYR:1};
      if(window.KEYSUITE_SECURE_DATA)window.KEYSUITE_SECURE_DATA.productMultipliers=secureData.productMultipliers;
      originalMultiplierValues.delete(key);setMultiplierUnlocked(prefix,currency,false);renderMultiplierInputs(prefix);
      window.KeySuitePricing?.syncPriceListSettings?.({productMultipliers:secureData.productMultipliers});
      window.KeySuiteCategories?.render?.();
      message(prefix,`${family} ${currency} saved: MYR ${Number(currency==='USD'?secureData.productMultipliers[family].USD:secureData.productMultipliers[family].RMB).toFixed(4)}.`,'info');
    }catch(error){console.error(error);message(prefix,String(error.message||error),'error')}
  }

  function cancelMultiplier(prefix,currency){
    const key=`${prefix}:${currency}`;
    const input=el(multiplierInputId(prefix,currency));
    if(input)input.value=String(originalMultiplierValues.get(key)??ratesFor(prefix)[currency]).replace(/,/g,'');
    originalMultiplierValues.delete(key);setMultiplierUnlocked(prefix,currency,false);renderMultiplierInputs(prefix);
    message(prefix,`${familyCode(prefix)} ${currency} change cancelled.`,'info');
  }

  function beginMultiplierUnlock(prefix,currency){
    if(prefix==='chc'&&selectedChcGeneration==='G1'){message('chc','CHC G1 prices are editable below. The shared CHC multiplier can be maintained under CHC G2.','info');return}
    const key=`${prefix}:${currency}`;if(!isOwner()||unlockedMultipliers.has(key))return;
    const input=el(multiplierInputId(prefix,currency));
    originalMultiplierValues.set(key,input?.value||ratesFor(prefix)[currency]);
    setMultiplierUnlocked(prefix,currency,true);
    message(prefix,`${familyCode(prefix)} ${currency} rate unlocked. Edit the value, then press Save or Cancel.`,'info');
    input?.focus();input?.select();
  }

  function bindLongHold(target,callback){
    let timer=null,progress=null,start=0,completed=false;
    const group=target.closest('.pricelist-multiplier-lock')||target;
    const feedback=()=>group.querySelector?.('.multiplier-hold-feedback');
    const reset=()=>{
      if(timer)clearTimeout(timer);if(progress)clearInterval(progress);timer=progress=null;
      group.classList.remove('holding');
      if(!group.classList.contains('unlocked')){const label=feedback();if(label)label.textContent='(Hold 3s to edit)'}
    };
    const startHold=event=>{
      if(event.pointerType==='mouse'&&event.button!==0)return;
      if(group.classList.contains('unlocked'))return;
      event.preventDefault();completed=false;start=Date.now();group.classList.add('holding');
      const label=feedback();if(label)label.textContent='Unlock in 3…';
      progress=setInterval(()=>{
        const remaining=Math.max(1,Math.ceil((3000-(Date.now()-start))/1000));
        const hint=feedback();if(hint)hint.textContent=`Unlock in ${remaining}…`;
      },150);
      timer=setTimeout(()=>{completed=true;reset();callback();},3000);
      try{target.setPointerCapture?.(event.pointerId)}catch(_){ }
    };
    const stop=event=>{if(completed)return;reset();try{if(event?.pointerId!==undefined)target.releasePointerCapture?.(event.pointerId)}catch(_){ }};
    target.addEventListener('pointerdown',startHold);
    ['pointerup','pointercancel','lostpointercapture'].forEach(type=>target.addEventListener(type,stop));
    target.addEventListener('contextmenu',event=>event.preventDefault());
  }

  function nullablePrice(value,label){
    const text=String(value??'').trim();if(text==='')return null;
    const number=Number(text);if(!Number.isFinite(number)||number<0)throw new Error(`${label} must be blank or zero and above.`);
    return number;
  }

  function rowRarity(row,variant){return validRarity(row.querySelector(`[data-rarity-variant="${CSS.escape(variant)}"]`)?.value||'common')}

  async function saveChcRow(productId,button){
    if(!isOwner()){message('chc','Your role is not allowed to maintain product prices.','error');return}
    const row=document.querySelector(`[data-chc-pricelist-row="${CSS.escape(productId)}"]`);if(!row)return;
    const currency=currentCurrency('chc');
    let chc,chcs,chcn;
    try{
      chc=nullablePrice(row.querySelector('[data-price-variant="CHC"]')?.value,'CHC Price');
      chcs=nullablePrice(row.querySelector('[data-price-variant="CHCS"]')?.value,'CHCS Price');
      chcn=nullablePrice(row.querySelector('[data-price-variant="CHCN"]')?.value,'CHCN Price');
    }catch(error){message('chc',error.message,'error');return}
    const rarities={CHC:rowRarity(row,'CHC'),CHCS:rowRarity(row,'CHCS'),CHCN:rowRarity(row,'CHCN')};
    const client=window.KeySuiteAuth?.getClient?.();if(!client){message('chc','Supabase is not connected.','error');return}
    const original=button.innerHTML;button.disabled=true;button.textContent='…';message('chc','');
    try{
      const rpcName=selectedChcGeneration==='G1'?'keysuite_save_chc_g1_product_price_v41410':'keysuite_save_chc_product_price_v120';
      const {error}=await client.rpc(rpcName,{
        p_product_id:productId,p_currency:currency,p_chc_price:chc,p_chcs_price:chcs,p_chcn_price:chcn,
        p_chc_rarity:rarities.CHC,p_chcs_rarity:rarities.CHCS,p_chcn_rarity:rarities.CHCN
      });
      if(error)throw error;
      const product=chcProducts().find(item=>item.id===productId);
      if(product){
        product.pricesByCurrency=product.pricesByCurrency||{};product.pricesByCurrency[currency]={CHC:chc,CHCS:chcs,CHCN:chcn};
        product.rarityByCurrency=product.rarityByCurrency||{};product.rarityByCurrency[currency]={...product.rarityByCurrency[currency],...rarities};
      }
      window.KeySuitePricing?.syncPriceListSettings?.({chcG1Products:secureData.chcG1Products,products:secureData.products});window.KeySuitePricing?.render?.();message('chc',`${selectedChcGeneration} ${product?.model||'CHC model'} ${currency} prices and rarity saved.`,'info');
    }catch(error){console.error(error);const text=String(error.message||error);message('chc',/rarity|fixed/i.test(text)?`${text}. Run V40602_SUPABASE_MIGRATION.sql.`:text,'error')}
    finally{button.disabled=false;button.innerHTML=original}
  }

  async function saveEsRow(productId,button){
    if(!isOwner()){message('es','Your role is not allowed to maintain ES prices.','error');return}
    const row=document.querySelector(`[data-es-pricelist-row="${CSS.escape(productId)}"]`);if(!row)return;
    const currency=currentCurrency('es'),field=esPriceField(currency),prices={},material=row.querySelector('[data-es-material-select]')?.value||ES_MATERIALS[0];
    try{prices[material]=nullablePrice(row.querySelector('[data-es-price]')?.value,`${material} Price`)}catch(error){message('es',error.message,'error');return}
    const rarity=validRarity(row.querySelector('[data-es-rarity]')?.value||'common');
    const client=window.KeySuiteAuth?.getClient?.();if(!client){message('es','Supabase is not connected.','error');return}
    const original=button.innerHTML;button.disabled=true;button.textContent='…';message('es','');
    try{
      const {error}=await client.rpc('keysuite_save_es_product_price_v205',{p_product_id:productId,p_currency:currency,p_prices:prices,p_rarity:rarity});
      if(error)throw error;
      const product=esProducts().find(item=>item.id===productId);
      if(product){
        product.rarity=rarity;product.variants=product.variants||[];let variant=product.variants.find(v=>normMaterial(v.material)===normMaterial(material));if(!variant){variant={material,priceUsd:null,priceRmb:null,priceMyr:null};product.variants.push(variant)}variant[field]=prices[material];
      }
      window.KeySuitePricing?.syncPriceListSettings?.({esProducts:secureData.esProducts});
      message('es',`${product?.model||'ES model'} ${currency} prices and rarity saved.`,'info');
    }catch(error){console.error(error);message('es',`${error.message||error}. Run V205_SUPABASE_MIGRATION.sql first.`,'error')}
    finally{button.disabled=false;button.innerHTML=original}
  }

  async function saveGwsRow(productId,button){
    if(!isOwner()){message('gws','Your role is not allowed to maintain product prices.','error');return}
    const row=document.querySelector(`[data-gws-pricelist-row="${CSS.escape(productId)}"]`);if(!row)return;
    const currency=currentCurrency('gws');
    let price;
    try{price=nullablePrice(row.querySelector('[data-price-variant="SKU"]')?.value,'GWS Price')}catch(error){message('gws',error.message,'error');return}
    const rarity=rowRarity(row,'SKU');
    const client=window.KeySuiteAuth?.getClient?.();if(!client){message('gws','Supabase is not connected.','error');return}
    const original=button.innerHTML;button.disabled=true;button.textContent='…';message('gws','');
    try{
      const {error}=await client.rpc('keysuite_save_gws_sku_price_v120',{p_product_id:productId,p_currency:currency,p_price:price,p_rarity:rarity});
      if(error)throw error;
      const product=gwsProducts().find(item=>item.id===productId);
      if(product){
        product.pricesByCurrency=product.pricesByCurrency||{};product.pricesByCurrency[currency]={SKU:price};
        product.rarityByCurrency=product.rarityByCurrency||{};product.rarityByCurrency[currency]={SKU:rarity};
      }
      window.KeySuitePricing?.render?.();message('gws',`${product?.model||'GWS Tank'} ${currency} price and rarity saved.`,'info');
    }catch(error){console.error(error);const text=String(error.message||error);message('gws',/rarity|fixed/i.test(text)?`${text}. Run V40602_SUPABASE_MIGRATION.sql.`:text,'error')}
    finally{button.disabled=false;button.innerHTML=original}
  }

  async function saveKeyplcRow(productId,button){
    if(!isOwner()){message('keyplc','Your role is not allowed to maintain KeyPLC prices.','error');return}
    const row=document.querySelector(`[data-keyplc-pricelist-row="${CSS.escape(productId)}"]`);if(!row)return;
    const currency=currentCurrency('keyplc'),field=keyplcPriceField(currency),prices={};
    try{for(let qty=1;qty<=6;qty++)prices[String(qty)]=nullablePrice(row.querySelector(`[data-keyplc-pump="${qty}"]`)?.value,`${qty} Pump Price`)}catch(error){message('keyplc',error.message,'error');return}
    const rarity=validRarity(row.querySelector('[data-keyplc-rarity]')?.value||'common');
    const client=window.KeySuiteAuth?.getClient?.();if(!client){message('keyplc','Supabase is not connected.','error');return}
    const original=button.innerHTML;button.disabled=true;button.textContent='…';message('keyplc','');
    try{
      const {error}=await client.rpc('keysuite_save_keyplc_product_price_v208',{p_product_id:productId,p_currency:currency,p_prices:prices,p_rarity:rarity});
      if(error)throw error;
      const product=keyplcProducts().find(item=>item.id===productId);
      if(product){product.rarity=rarity;product.variants=product.variants||[];for(let qty=1;qty<=6;qty++){let variant=product.variants.find(v=>Number(v.pumpQty||v.pump_qty||String(v.label||'').match(/\d+/)?.[0]||0)===qty);if(!variant){variant={pumpQty:qty,label:`${qty} ${qty===1?'Pump':'Pumps'}`,priceUsd:null,priceRmb:null,priceMyr:null};product.variants.push(variant)}variant[field]=prices[String(qty)]}}
      window.KeySuitePricing?.syncPriceListSettings?.({keyplcProducts:secureData.keyplcProducts});message('keyplc',`${product?.model||'KeyPLC model'} ${currency} prices and rarity saved.`,'info');
    }catch(error){console.error(error);message('keyplc',`${error.message||error}. Run V208_SUPABASE_MIGRATION.sql first.`,'error')}
    finally{button.disabled=false;button.innerHTML=original}
  }

  function bindCurrency(prefix,renderRows){
    el(`${prefix}PriceCurrency`)?.addEventListener('change',event=>{
      localStorage.setItem(`ks_${prefix}_price_currency`,validCurrency(event.target.value));renderRows();
    });
  }

  function bindMultiplierGroup(group){
    const prefix=group.dataset.multiplierPrefix,currency=group.dataset.multiplierCurrency;
    const input=group.querySelector('.multiplier-hold-input')||group.querySelector('input');
    if(input)bindLongHold(input,()=>beginMultiplierUnlock(prefix,currency));
    group.querySelector('[data-multiplier-save]')?.addEventListener('click',()=>saveMultiplier(prefix,currency));
    group.querySelector('[data-multiplier-cancel]')?.addEventListener('click',()=>cancelMultiplier(prefix,currency));
  }

  function bind(){
    if(bound)return;bound=true;
    el('chcPriceGeneration')?.addEventListener('change',event=>{
      selectedChcGeneration=String(event.target.value||'G2').toUpperCase()==='G1'?'G1':'G2';
      localStorage.setItem('ks_chc_price_generation',selectedChcGeneration);
      message('chc','');renderSettings('chc');renderChcRows();applyAuthorityMode();applyChcGenerationMode();
    });
    el('chcPriceSearch')?.addEventListener('input',renderChcRows);
    el('gwsPriceSearch')?.addEventListener('input',renderGwsRows);
    el('esPriceSearch')?.addEventListener('input',renderEsRows);
    el('keyplcPriceSearch')?.addEventListener('input',renderKeyplcRows);
    const esTopScroll=el('esPriceTopScroll'),esTableWrap=el('esPriceTableWrap');let syncingEsScroll=false;
    esTopScroll?.addEventListener('scroll',()=>{if(syncingEsScroll||!esTableWrap)return;syncingEsScroll=true;esTableWrap.scrollLeft=esTopScroll.scrollLeft;requestAnimationFrame(()=>syncingEsScroll=false)});
    esTableWrap?.addEventListener('scroll',()=>{if(syncingEsScroll||!esTopScroll)return;syncingEsScroll=true;esTopScroll.scrollLeft=esTableWrap.scrollLeft;requestAnimationFrame(()=>syncingEsScroll=false)});
    window.addEventListener('resize',syncEsScrollWidth);
    bindCurrency('chc',renderChcRows);bindCurrency('es',renderEsRows);bindCurrency('gws',renderGwsRows);bindCurrency('keyplc',renderKeyplcRows);
    document.querySelectorAll('.pricelist-multiplier-lock').forEach(bindMultiplierGroup);
  }

  function applyAuthorityMode(){
    const editable=isOwner();
    ['chcPriceList','esPriceList','gwsPriceList','keyplcPriceList'].forEach(pageId=>{
      const page=el(pageId);if(!page)return;
      page.querySelectorAll('.pricelist-table input,.pricelist-table select').forEach(control=>control.disabled=!editable);
      page.querySelectorAll('[data-save-chc-row],[data-save-es-row],[data-save-gws-row],[data-save-keyplc-row]').forEach(button=>button.style.display=editable?'grid':'none');
      page.querySelectorAll('.multiplier-hold-input').forEach(input=>{if(!editable){input.readOnly=true;input.disabled=true}else input.disabled=false});
      page.querySelectorAll('.multiplier-actions').forEach(actions=>{if(!editable)actions.style.display='none'});
    });
  }

  function applyChcGenerationMode(){
    const page=el('chcPriceList');if(!page)return;
    const isG1=selectedChcGeneration==='G1';
    const generation=el('chcPriceGeneration');if(generation)generation.value=selectedChcGeneration;
    if(isG1){
      ['USD','RMB'].forEach(currency=>{
        setMultiplierUnlocked('chc',currency,false);
        const input=el(multiplierInputId('chc',currency));if(input){input.readOnly=true;input.disabled=true}
        const group=el(`chcMultiplierLock_${currency}`);if(group){
          group.classList.add('locked');group.classList.remove('unlocked','holding');
          const feedback=group.querySelector('.multiplier-hold-feedback');if(feedback)feedback.textContent='Shared CHC rate · maintain under G2';
          const actions=group.querySelector('.multiplier-actions');if(actions){actions.style.display='none';actions.classList.remove('show')}
        }
      });
    }else{
      ['USD','RMB'].forEach(currency=>{
        const input=el(multiplierInputId('chc',currency));if(input)input.disabled=!isOwner();
        const group=el(`chcMultiplierLock_${currency}`);if(group){
          const actions=group.querySelector('.multiplier-actions');if(actions)actions.style.display=isOwner()?'':'none';
          const feedback=group.querySelector('.multiplier-hold-feedback');
          if(feedback&&!unlockedMultipliers.has(`chc:${currency}`))feedback.textContent='(Hold 3s to edit)';
        }
      });
    }
    page.querySelectorAll('[data-save-chc-row]').forEach(button=>button.style.display=isOwner()?'grid':'none');
    page.querySelectorAll('#chcPriceRows input,#chcPriceRows select').forEach(control=>control.disabled=!isOwner());
  }

  function render(){
    if(!canView())return;
    renderSettings('chc');renderSettings('es');renderSettings('gws');renderSettings('keyplc');renderChcRows();renderEsRows();renderGwsRows();renderKeyplcRows();applyAuthorityMode();applyChcGenerationMode();
    const notice=el('priceListAccessNotice');if(notice)notice.innerHTML=`Signed in as <b>${esc(access?.display_name||access?.email||'user')}</b>. Each product family keeps its own USD/RMB rates. CHC/GWS rarity is stored per currency; ES and KeyPLC rarity is stored once per model.${isOwner()?'':' View-only access.'}`;
  }

  function init(data,userAccess){
    secureData={...secureData,...(data||{})};access=userAccess||access;
    selectedChcGeneration=String(localStorage.getItem('ks_chc_price_generation')||'G2').toUpperCase()==='G1'?'G1':'G2';
    const generation=el('chcPriceGeneration');if(generation)generation.value=selectedChcGeneration;
    bind();render();
  }
  function pageShown(id){if(['priceListDashboard','chcPriceList','esPriceList','gwsPriceList','keyplcPriceList'].includes(id))render()}

  window.KeySuitePriceList={init,pageShown,render};
})();
