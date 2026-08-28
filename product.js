(() => {
  'use strict';

  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const natural=(a,b)=>String(a??'').localeCompare(String(b??''),undefined,{numeric:true,sensitivity:'base'});
  let selectedSeries='',frameReady=false,queued=null,currentCurveModel='',currentCurveFamily='CHC',esFrameReady=false,esQueued=null;
  const catalogueRefreshSeq={GWS:0,KEYPLC:0};

  const products=()=>window.KEYSUITE_SECURE_DATA?.products||[];
  const g1Data=()=>window.KeySuiteCHCG1ProductData||{models:[],byModel:()=>null,dimensionFor:()=>null};
  const CHC_GENERATION_KEY='keysuite-v41412-product-chc-generation';
  let selectedChcGeneration=(()=>{try{return sessionStorage.getItem(CHC_GENERATION_KEY)==='G1'?'G1':'G2'}catch(_){return 'G2'}})();
  const g1Products=()=>g1Data().models||[];
  const activeChcProducts=()=>selectedChcGeneration==='G1'?g1Products():products();
  const gwsProducts=()=>window.KEYSUITE_SECURE_DATA?.gwsProducts||[];
  const esProducts=()=>window.KEYSUITE_SECURE_DATA?.esProducts||[];
  const keyplcProducts=()=>window.KEYSUITE_SECURE_DATA?.keyplcProducts||[];
  const ES_DEFAULT_MATERIAL='CI / SS / SS / MS';
  const ES_DEFAULT_SEAL='Carbon Ceramic (Ca Ce)';
  const ES_DEFAULT_ELASTOMER='Viton';
  const ES_SEALS=['Carbon Ceramic (Ca Ce)','Silicon Carbide (Sic Sic)','Tungsten (Tuc Tuc)'];
  const ES_ELASTOMERS=['Viton','EPDM','NBR'];
  const seriesName=model=>{const m=String(model||'').match(/^CHC\s+(\d+)/i);return m?`CHC ${m[1]}`:'Other'};
  const orderedSeries=()=>[...new Set(activeChcProducts().map(p=>seriesName(p.model)))].sort((a,b)=>Number((a.match(/\d+/)||[999])[0])-Number((b.match(/\d+/)||[999])[0]));
  const normMaterial=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9]+/g,'');

  function updateDefaultState(control){
    if(!control)return;
    if(control.type==='checkbox'){
      const defaultChecked=String(control.dataset.defaultChecked||'false')==='true';
      (control.closest('.default-choice-control')||control).classList.toggle('non-default-selection',control.checked!==defaultChecked);
      return;
    }
    if(control.dataset.defaultValue!==undefined)control.classList.toggle('non-default-selection',String(control.value)!==String(control.dataset.defaultValue));
  }

  function bindDefaultState(control){if(!control||control.dataset.defaultStateBound==='1')return;control.dataset.defaultStateBound='1';const refresh=()=>updateDefaultState(control);control.addEventListener('change',refresh);control.addEventListener('input',refresh);refresh()}
  function bindStaticDefaults(){['pumpMaterial','sealFaces','sealElastomer','connectionType','bareShaft','productMaterial','productSeal','productElastomer','productConnection','productBareShaft'].forEach(id=>bindDefaultState($(id)))}

  function ensureFrame(){const frame=$('productSelectorFrame');if(frame&&frame.src==='about:blank'){frameReady=false;frame.src=frame.dataset.src}return frame}
  function options(){return {material:$('productMaterial')?.value||'SS304 (Cast Iron Connection)',seal:$('productSeal')?.value||'Car/Cer',elastomer:$('productElastomer')?.value||'Viton',connection:$('productConnection')?.value||'round',bare:!!$('productBareShaft')?.checked,hz:50}}
  function postToFrame(frame,message){try{frame.contentWindow.postMessage(message,'*')}catch(error){console.error('Unable to contact CHC product frame.',error)}}
  function send(model,action){
    const frame=ensureFrame();if(!frame)return;
    const message={type:'KEYSUITE_PRODUCT_MODEL',model,action,options:options()};
    if(frameReady){queued=null;postToFrame(frame,message)}else queued=message;
  }

  function directG1Payload(model){
    const row=g1Data().byModel?.(model)||g1Products().find(x=>String(x.model||'').toLowerCase()===String(model||'').toLowerCase());
    if(!row)return null;
    const opts=options(),dimension=g1Data().dimensionFor?.(row.model,opts.material)||null;
    return {
      source:'KeySuite-CHC-G1-Direct-V4.14.14',
      model:row.model,
      base_model:row.model,
      display_model:row.model,
      quotation_model:row.model,
      generation_code:'G1',
      technical_source_model:String(row.g2Model||''),
      series:`CHC ${row.family||''}`.trim(),
      stages:Number(row.stages||row.stage||1),
      connection:String(row.connection||''),
      motor_kw:Number(row.kw||0),
      motor_hp:Number(row.hp||0),
      speed_rpm:2900,
      pole:2,
      frequency_hz:50,
      motor_efficiency_class:'IE2',
      motor_phase:'3Ph',
      motor_voltage:415,
      product_mode:true,
      keysuite_material:opts.material,
      keysuite_seal:opts.seal,
      keysuite_elastomer:opts.elastomer,
      keysuite_connection_type:opts.connection,
      keysuite_bare_shaft:!!opts.bare,
      keysuite_supply_mode:opts.bare?'BARE':'COMPLETE',
      keysuite_dimension_override:dimension
    };
  }
  function sendG1(model,action){
    const payload=directG1Payload(model);if(!payload)return;
    window.postMessage({type:'KEYSUITE_ADD_SELECTION',route:action==='add'?'quotation':action,payload},'*');
  }
  function ensureEsFrame(){const frame=$('productEsSelectorFrame');if(frame&&frame.src==='about:blank'){esFrameReady=false;frame.src=frame.dataset.src}return frame}
  function esProductSealSync(){const type=$('esProductSealType'),mat=$('esProductSealMaterial');if(!type||!mat)return;if(type.value==='Gland Packing'){mat.innerHTML='<option value="Graphite">Graphite</option>';mat.value='Graphite'}else{const keep=['Carbon Ceramic','Silicon Carbide','Tungsten'].includes(mat.value)?mat.value:'Carbon Ceramic';mat.innerHTML='<option value="Carbon Ceramic">Carbon Ceramic</option><option value="Silicon Carbide">Silicon Carbide</option><option value="Tungsten">Tungsten</option>';mat.value=keep}updateDefaultState(type);updateDefaultState(mat)}
  function esProductChoices(){const material=$('esProductMaterial')?.value||'CI / SS / SS',sealType=$('esProductSealType')?.value||'Mechanical Seal',sealMaterial=$('esProductSealMaterial')?.value||(sealType==='Gland Packing'?'Graphite':'Carbon Ceramic'),elastomer=$('esProductElastomer')?.value||ES_DEFAULT_ELASTOMER;const pricingMaterial=/^SS30[46]$/i.test(material)?material:`${material} / ${sealType==='Gland Packing'?'GP':'MS'}`;const pricingSeal=sealMaterial==='Carbon Ceramic'?ES_DEFAULT_SEAL:sealMaterial==='Silicon Carbide'?'Silicon Carbide (Sic Sic)':sealMaterial==='Tungsten'?'Tungsten (Tuc Tuc)':sealMaterial;return {material,pricingMaterial,sealType,sealMaterial,pricingSeal,elastomer}}
  function sendEsProduct(model,action){const frame=ensureEsFrame();if(!frame)return;const c=esProductChoices(),message={type:'KEYSUITE_PRODUCT_MODEL',model,action,options:{material:c.material,sealType:c.sealType,sealMaterial:c.sealMaterial,elastomer:c.elastomer}};if(esFrameReady){esQueued=null;postToFrame(frame,message)}else esQueued=message}


  function renderSeries(){
    const series=orderedSeries();if(!selectedSeries||!series.includes(selectedSeries))selectedSeries=series[0]||'';
    $('productSeriesList').innerHTML=series.map(name=>`<button type="button" class="product-series-button ${name===selectedSeries?'active':''}" data-product-series="${esc(name)}">${esc(name)}</button>`).join('');
    $('productSeriesList').querySelectorAll('[data-product-series]').forEach(button=>button.onclick=()=>{selectedSeries=button.dataset.productSeries;renderSeries();renderModels()});
  }

  function curveIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18c4-10 8 2 12-8 2-4 4-5 6-5"></path><path d="M3 20h18"></path></svg>'}

  function renderModelsG2(){
    const query=String($('productModelInput')?.value||'').trim().toLowerCase();let rows=products().filter(p=>seriesName(p.model)===selectedSeries);if(query)rows=rows.filter(p=>String(p.model).toLowerCase().includes(query));
    $('productSeriesTitle').textContent=selectedSeries||'Models';$('productModelCount').textContent=`${rows.length} model${rows.length===1?'':'s'}`;
    $('productModelGrid').innerHTML=rows.length?rows.map(p=>`<div class="product-model-row"><h3>${esc(p.model)}</h3><div class="product-model-actions"><button class="btn secondary product-action-button" type="button" data-product-view="${esc(p.model)}">Curve</button><button class="btn action-assembly product-action-button" type="button" data-product-assembly="${esc(p.model)}">Assembly</button><button class="btn action-quote product-action-button" type="button" data-product-add="${esc(p.model)}">Quote</button></div></div>`).join(''):'<div class="product-empty">No matching CHC models.</div>';
    const grid=$('productModelGrid');
    grid.querySelectorAll('[data-product-view]').forEach(button=>button.onclick=()=>{const model=button.dataset.productView;currentCurveFamily='CHC';currentCurveModel=model;$('productCurveTitle').textContent=model;const frame=ensureFrame(),host=$('productCurveHost');if(frame.parentNode!==host)host.appendChild(frame);frame.style.display='block';$('productCurveDialog').showModal();send(model,'view')});
    grid.querySelectorAll('[data-product-add]').forEach(button=>button.onclick=()=>{if(!window.KeySuiteApp?.ensureQuotationPricingContext?.('add a product to the quotation'))return;send(button.dataset.productAdd,'add')});
    grid.querySelectorAll('[data-product-assembly]').forEach(button=>button.onclick=()=>{if(!window.KeySuiteApp?.ensureQuotationPricingContext?.('add a product to Assembly'))return;send(button.dataset.productAssembly,'assembly')});
  }

  function renderModelsG1(){
    const query=String($('productModelInput')?.value||'').trim().toLowerCase();
    let rows=g1Products().filter(p=>seriesName(p.model)===selectedSeries);
    if(query)rows=rows.filter(p=>String(p.model).toLowerCase().includes(query));
    rows.sort((a,b)=>natural(a.model,b.model));
    $('productSeriesTitle').textContent=selectedSeries||'Models';
    $('productModelCount').textContent=`${rows.length} G1 model${rows.length===1?'':'s'}`;
    $('productModelGrid').innerHTML=rows.length?rows.map(p=>`<div class="product-model-row" data-product-generation="G1"><h3>${esc(p.model)}</h3><div class="product-model-actions product-no-curve-actions"><button class="btn action-assembly product-action-button" type="button" data-product-g1-assembly="${esc(p.model)}">Assembly</button><button class="btn action-quote product-action-button" type="button" data-product-g1-add="${esc(p.model)}">Quote</button></div></div>`).join(''):'<div class="product-empty">No matching CHC G1 models.</div>';
    const grid=$('productModelGrid');
    grid.querySelectorAll('[data-product-g1-add]').forEach(button=>button.onclick=()=>{if(!window.KeySuiteApp?.ensureQuotationPricingContext?.('add a product to the quotation'))return;sendG1(button.dataset.productG1Add,'add')});
    grid.querySelectorAll('[data-product-g1-assembly]').forEach(button=>button.onclick=()=>{if(!window.KeySuiteApp?.ensureQuotationPricingContext?.('add a product to Assembly'))return;sendG1(button.dataset.productG1Assembly,'assembly')});
  }
  function renderModels(){return selectedChcGeneration==='G1'?renderModelsG1():renderModelsG2()}


  function gwsSeriesKey(product){
    const name=String(product?.seriesName||'').trim();
    return /superflow/i.test(name)?'Superflow Series':name;
  }

  function gwsSeriesOptions(){
    const select=$('gwsProductSeries');if(!select)return;
    const current=select.value||'ALL',series=[...new Set(gwsProducts().map(gwsSeriesKey).filter(Boolean))].sort(natural);
    select.innerHTML='<option value="ALL">All Series</option>'+series.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');select.value=series.includes(current)?current:'ALL';
  }

  function gwsModelOptions(){
    const select=$('gwsProductModel');if(!select)return;
    const series=$('gwsProductSeries')?.value||'ALL',current=select.value||'ALL';
    const rows=gwsProducts().filter(product=>series==='ALL'||gwsSeriesKey(product)===series);
    const models=[...new Set(rows.map(product=>String(product.model||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
    select.innerHTML='<option value="ALL">All Models</option>'+models.map(model=>`<option value="${esc(model)}">${esc(model)}</option>`).join('');
    select.value=models.includes(current)?current:'ALL';
  }

  function renderGws(){
    const body=$('gwsProductRows');if(!body)return;gwsSeriesOptions();gwsModelOptions();
    const series=$('gwsProductSeries')?.value||'ALL',model=$('gwsProductModel')?.value||'ALL';
    const rows=gwsProducts().filter(product=>(series==='ALL'||gwsSeriesKey(product)===series)&&(model==='ALL'||String(product.model)===model)).sort((a,b)=>natural(gwsSeriesKey(a),gwsSeriesKey(b))||natural(a.model,b.model)||Number(a.pressureBar||0)-Number(b.pressureBar||0));
    body.innerHTML=rows.map(product=>`<tr><td>${esc(product.seriesName)}</td><td><b>${esc(product.model)}</b></td><td>${esc(product.sizeLitres)} Litres</td><td>${esc(product.pressureBar)} Bar</td><td style="text-align:right"><div class="route-actions product-no-curve-actions"><button class="btn action-assembly" type="button" data-gws-assembly="${esc(product.id)}">Add to Assembly</button><button class="btn action-quote" type="button" data-gws-quote="${esc(product.id)}">Quote</button></div></td></tr>`).join('')||'<tr><td colspan="5" class="muted">No matching GWS Tank models.</td></tr>';
    $('gwsProductCount').textContent=`${rows.length} valid tank SKU${rows.length===1?'':'s'}`;
    body.querySelectorAll('[data-gws-quote]').forEach(button=>button.addEventListener('click',()=>window.KeySuitePricing?.addGwsToQuotation?.(button.dataset.gwsQuote,null)));
    body.querySelectorAll('[data-gws-assembly]').forEach(button=>button.addEventListener('click',()=>{if(!window.KeySuiteApp?.ensureQuotationPricingContext?.('add a tank to Assembly'))return;const item=window.KeySuitePricing?.buildGwsAssemblyItem?.(button.dataset.gwsAssembly,null);if(item){item.assemblyLevel='SYSTEM_COMPONENT';item.assemblySection='tank';window.KeySuiteAssembly?.addItem?.(item)}else alert('No price is available for this GWS Tank SKU.')}));
  }


  function renderEs(){
    const body=$('esProductRows');if(!body)return;const q=String($('esProductSearch')?.value||'').trim().toLowerCase();
    const rows=esProducts().filter(x=>!q||x.model.toLowerCase().includes(q));
    body.innerHTML=rows.map(x=>`<tr data-es-product-row="${esc(x.id)}"><td><b>${esc(x.model)}</b></td><td style="text-align:right"><div class="route-actions"><button class="btn secondary" type="button" data-es-curve="${esc(x.id)}">Curve</button><button class="btn action-assembly" type="button" data-es-assembly="${esc(x.id)}">Assembly</button><button class="btn action-quote" type="button" data-es-quote="${esc(x.id)}">Quote</button></div></td></tr>`).join('')||'<tr><td colspan="2" class="muted">No matching ES models.</td></tr>';
    $('esProductCount').textContent=`${rows.length} model${rows.length===1?'':'s'}`;
    const productFor=id=>rows.find(x=>String(x.id)===String(id))||esProducts().find(x=>String(x.id)===String(id));
    body.querySelectorAll('[data-es-curve]').forEach(b=>b.onclick=()=>{const p=productFor(b.dataset.esCurve);if(!p)return;currentCurveFamily='ES';currentCurveModel=p.model;$('productCurveTitle').textContent=p.model;const frame=ensureEsFrame(),host=$('productCurveHost');if(frame.parentNode!==host)host.appendChild(frame);frame.style.display='block';$('productCurveDialog').showModal();sendEsProduct(p.model,'view')});
    body.querySelectorAll('[data-es-assembly]').forEach(b=>b.onclick=()=>{const c=esProductChoices();window.KeySuitePricing?.addEs?.(b.dataset.esAssembly,'assembly',c.pricingMaterial,{seal:c.pricingSeal,sealType:c.sealType,sealMaterial:c.sealMaterial,elastomer:c.elastomer})});
    body.querySelectorAll('[data-es-quote]').forEach(b=>b.onclick=()=>{const c=esProductChoices();window.KeySuitePricing?.addEs?.(b.dataset.esQuote,'quotation',c.pricingMaterial,{seal:c.pricingSeal,sealType:c.sealType,sealMaterial:c.sealMaterial,elastomer:c.elastomer})});
  }
  function renderKeyplc(){
    const body=$('keyplcProductRows');if(!body)return;
    const q=String($('keyplcProductSearch')?.value||'').trim().toLowerCase();
    const rows=keyplcProducts().filter(x=>!q||String(x.model||'').toLowerCase().includes(q)).sort((a,b)=>natural(a.model,b.model));
    const pumpOptions=Array.from({length:6},(_,i)=>`<option value="${i+1}" ${i+1===2?'selected':''}>${i+1} ${i===0?'Pump':'Pumps'}</option>`).join('');
    const actions=(product,type)=>`<div class="route-actions keyplc-route-actions product-no-curve-actions"><button class="btn action-assembly" type="button" data-keyplc-assembly="${esc(product.id)}" data-keyplc-type="${type}">Assembly</button><button class="btn action-quote" type="button" data-keyplc-quote="${esc(product.id)}" data-keyplc-type="${type}">Quote</button></div>`;
    body.innerHTML=rows.map(product=>`<tr data-keyplc-product-row="${esc(product.id)}"><td><b>${esc(product.model)}</b></td><td><select data-keyplc-pump-count data-default-value="2" aria-label="Number of pumps for ${esc(product.model)}">${pumpOptions}</select></td><td>${actions(product,'indoor')}</td><td>${actions(product,'sheltered')}<div class="keyplc-surcharge-note">Indoor + RM 1,000.00</div></td></tr>`).join('')||'<tr><td colspan="4" class="muted">No matching KeyPLC panel models.</td></tr>';
    $('keyplcProductCount').textContent=`${rows.length} panel model${rows.length===1?'':'s'}`;
    const qtyFor=button=>Number(button.closest('[data-keyplc-product-row]')?.querySelector('[data-keyplc-pump-count]')?.value||1);
    body.querySelectorAll('[data-keyplc-pump-count]').forEach(bindDefaultState);
    body.querySelectorAll('[data-keyplc-assembly]').forEach(button=>button.addEventListener('click',()=>window.KeySuitePricing?.addKeyplc?.(button.dataset.keyplcAssembly,qtyFor(button),'assembly',button.dataset.keyplcType||'indoor')));
    body.querySelectorAll('[data-keyplc-quote]').forEach(button=>button.addEventListener('click',()=>window.KeySuitePricing?.addKeyplc?.(button.dataset.keyplcQuote,qtyFor(button),'quotation',button.dataset.keyplcType||'indoor')));
  }

  function mapGwsProduct(p){return {id:p.id,model:p.model,source_row:p.source_row,seriesCode:p.series_code||'',seriesName:p.series_name||'',sizeCode:p.size_code||p.model,sizeLitres:Number(p.size_litres||String(p.size_code||p.model).replace(/\D/g,'')||0),pressureBar:Number(p.pressure_bar||0),systemConnection:p.system_connection||'',prechargeText:p.precharge_text||'',maxWorkingPressureText:p.max_working_pressure_text||'',maxWorkingTemperatureText:p.max_working_temperature_text||'',pricesByCurrency:{USD:{SKU:p.price_usd===null?null:Number(p.price_usd)},RMB:{SKU:p.price_rmb===null?null:Number(p.price_rmb)},MYR:{SKU:p.price_myr===null?null:Number(p.price_myr)}},rarityByCurrency:{USD:{SKU:String(p.rarity_usd||'common').toLowerCase()},RMB:{SKU:String(p.rarity_rmb||'common').toLowerCase()},MYR:{SKU:String(p.rarity_myr||'common').toLowerCase()}}}}
  function mapKeyplcProduct(p){return {id:p.id,model:p.model,motorKw:Number(p.motor_kw||String(p.model||'').replace(/[^0-9.]/g,'')||0),source_row:p.source_row,rarity:String(p.rarity||'common').toLowerCase(),variants:Array.isArray(p.variants)?p.variants:(typeof p.variants==='object'&&p.variants?p.variants:[])}}
  function syncCatalogue(field,rows){const secure=window.KEYSUITE_SECURE_DATA||(window.KEYSUITE_SECURE_DATA={}),current=secure[field];if(Array.isArray(current)){current.splice(0,current.length,...rows)}else secure[field]=rows;window.KeySuitePricing?.syncPriceListSettings?.({[field]:secure[field]});return secure[field]}
  function catalogueState(family,text,error=false){const gws=family==='GWS',body=$(gws?'gwsProductRows':'keyplcProductRows'),count=$(gws?'gwsProductCount':'keyplcProductCount'),cols=gws?5:4;if(body)body.innerHTML=`<tr><td colspan="${cols}" class="muted">${esc(text)}${error?' <button class="btn secondary" type="button" data-product-catalogue-retry="'+family+'">Retry</button>':''}</td></tr>`;if(count)count.textContent=text;body?.querySelector('[data-product-catalogue-retry]')?.addEventListener('click',()=>refreshCatalogue(family,true))}
  async function refreshCatalogue(family,force=false){const isGws=family==='GWS',field=isGws?'gwsProducts':'keyplcProducts',existing=isGws?gwsProducts():keyplcProducts(),client=window.KeySuiteAuth?.getClient?.();if(!client){if(!existing.length)catalogueState(family,`No active ${isGws?'GWS Tank':'KeyPLC Panel'} models available.`,true);return existing}const seq=++catalogueRefreshSeq[family];if(!existing.length||force)catalogueState(family,`Loading ${isGws?'GWS Tank':'KeyPLC Panel'} catalogue...`);try{const table=isGws?'ks_products_gws':'ks_products_keyplc',result=await client.from(table).select('*').eq('status','active').order('source_row');if(seq!==catalogueRefreshSeq[family])return isGws?gwsProducts():keyplcProducts();if(result.error)throw result.error;const rows=(result.data||[]).map(isGws?mapGwsProduct:mapKeyplcProduct);syncCatalogue(field,rows);if(isGws)renderGws();else renderKeyplc();if(!rows.length)catalogueState(family,`No active ${isGws?'GWS Tank':'KeyPLC Panel'} models available.`);return rows}catch(error){console.error(`${family} Product catalogue refresh failed`,error);if(existing.length){if(isGws)renderGws();else renderKeyplc();const count=$(isGws?'gwsProductCount':'keyplcProductCount');if(count)count.textContent=`Using loaded catalogue · refresh failed`;}else catalogueState(family,`${isGws?'GWS Tank':'KeyPLC Panel'} catalogue could not be loaded.`,true);return existing}}

  function setChcGeneration(code='G2'){
    selectedChcGeneration=String(code||'G2').toUpperCase()==='G1'?'G1':'G2';
    try{sessionStorage.setItem(CHC_GENERATION_KEY,selectedChcGeneration)}catch(_){}
    const series=orderedSeries();if(!selectedSeries||!series.includes(selectedSeries))selectedSeries=series[0]||'';
    const input=$('productModelInput');if(input)input.value='';
    const h1=document.querySelector('#productChc h1');if(h1)h1.textContent=`Product · CHC ${selectedChcGeneration}`;
    const help=document.querySelector('#productChc .page-title-row .muted');
    if(help)help.textContent=selectedChcGeneration==='G1'
      ?'CHC G1 product range. Curve is not enabled yet. Quote and Assembly use G1 own Price List, G1 dimensions and IE2 motors.'
      :'CHC G2 existing/current product range. Curve uses the original proven G2 Product curve path.';
    render();
    return selectedChcGeneration;
  }
  const getChcGeneration=()=>selectedChcGeneration;

  function render(){if($('productModelOptions'))$('productModelOptions').innerHTML=activeChcProducts().map(p=>`<option value="${esc(p.model)}"></option>`).join('');bindStaticDefaults();renderSeries();renderModels();renderEs();renderGws();renderKeyplc()}
  function pageShown(id){if(id==='productChc'){setChcGeneration(selectedChcGeneration);return}if(id==='productEs'){renderEs();return}if(id==='productGws'){renderGws();refreshCatalogue('GWS');return}if(id==='productKeyplc'){renderKeyplc();refreshCatalogue('KEYPLC')}}

  window.addEventListener('message',event=>{const data=event.data||{};if(data.type==='KEYSUITE_PRODUCT_FRAME_READY'){if(event.source===$('productSelectorFrame')?.contentWindow){frameReady=true;if(queued){const message=queued;queued=null;postToFrame($('productSelectorFrame'),message)}}if(event.source===$('productEsSelectorFrame')?.contentWindow){esFrameReady=true;if(esQueued){const message=esQueued;esQueued=null;postToFrame($('productEsSelectorFrame'),message)}}return}if(data.type==='KEYSUITE_PRODUCT_CURVE_STATE'){if(data.family&&data.family!==currentCurveFamily)return;if(data.model&&String(data.model).replace(/^ES\s+/i,'')!==String(currentCurveModel).replace(/^ES\s+/i,''))return;return}});
  document.addEventListener('DOMContentLoaded',()=>{
    $('productModelInput')?.addEventListener('input',()=>{const exact=activeChcProducts().find(p=>String(p.model||'').toLowerCase()===$('productModelInput').value.trim().toLowerCase());if(exact)selectedSeries=seriesName(exact.model);renderSeries();renderModels()});
    bindStaticDefaults();
    $('closeProductCurve')?.addEventListener('click',()=>$('productCurveDialog')?.close());['esProductMaterial','esProductSealType','esProductSealMaterial','esProductElastomer'].forEach(id=>{const el=$(id);if(el){bindDefaultState(el);el.addEventListener('change',()=>{if(id==='esProductSealType')esProductSealSync();if(currentCurveFamily==='ES'&&currentCurveModel)sendEsProduct(currentCurveModel,'view')})}});esProductSealSync();$('esProductSearch')?.addEventListener('input',renderEs);$('gwsProductSeries')?.addEventListener('change',()=>{if($('gwsProductModel'))$('gwsProductModel').value='ALL';renderGws()});$('gwsProductModel')?.addEventListener('change',renderGws);$('keyplcProductSearch')?.addEventListener('input',renderKeyplc);
  });
  window.KeySuiteProduct={pageShown,render,refreshCatalogue,setChcGeneration,getChcGeneration};
})();
