/* KeySuite V4.01 — Shared Product > Brand pump-series Curve/PDF owner.
 * Existing families: CHC-family and ES-family.
 * Product Curve uses each family's native Selection layout, but keeps the Product-selected model fixed.
 * PDF final-output rules:
 *   - Selling Brand / Series / Model from first render through PDF.
 *   - Assigned Brand logo -> assigned B.G.Reich logo -> native report logo.
 *   - 1 Stage / n Stages grammar.
 *   - Non-default material technical data is carried to Page 2.
 *   - Motor Type is always TEFC on every selector technical PDF.
 * Event-driven only: no MutationObserver and no recurring polling loop.
 */
(()=>{
  'use strict';
  if(window.top!==window.self||window.__KEYSUITE_V40001_PRODUCT_SERIES_OVERHAUL__)return;
  window.__KEYSUITE_V40001_PRODUCT_SERIES_OVERHAUL__=true;

  const VERSION='4.06.21';
  const $=id=>document.getElementById(id);
  const norm=v=>String(v??'').trim();
  const low=v=>norm(v).toLowerCase();
  const escRe=v=>String(v??'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const api=()=>window.KeySuiteV394412||window.KeySuiteV394410||window.KeySuiteV39449||window.KeySuiteV39448||window.KeySuiteV39447||window.KeySuiteV39446||window.KeySuiteV39445||window.KeySuiteV39444||window.KeySuiteV3944||window.KeySuiteV3943||window.KeySuiteV3942||window.KeySuiteV3941||window.KeySuiteV391||null;
  const brands=()=>((api()?.state?.brands)||[]).filter(Boolean);
  const byId=id=>brands().find(b=>String(b.id)===String(id))||null;
  const bgReich=()=>brands().find(b=>low(b.brand_key)==='b.g.reich'||low(b.brand_name)==='b.g.reich')||null;
  const frameFor=f=>$(String(f).toUpperCase()==='ES'?'productEsSelectorFrame':'productSelectorFrame');
  const productDialog=()=>$('productCurveDialog');

  let inlineOpen=false;
  let currentFamily='CHC';
  let lastScrollY=0;
  const lastDuty={CHC:null,ES:null};
  let nativeShowModal=null;
  let nativeClose=null;
  const visibleTextMaster=new WeakMap();
  const genericPdfFrames=new WeakSet();

  function markVersion(){
    document.title='KeySuite V'+VERSION;
    document.querySelectorAll('.auth-brand small').forEach(n=>n.textContent='V'+VERSION);
    document.querySelectorAll('.brand small').forEach(n=>n.textContent='Full Suite V'+VERSION);
    document.querySelectorAll('.suite-version').forEach(n=>n.textContent='KeySuite V'+VERSION);
  }
  function activeFamily(){
    const es=frameFor('ES'),chc=frameFor('CHC');
    if(es&&(es.style.display==='block'||es.getAttribute('data-active')==='1'))return 'ES';
    if(chc&&(chc.style.display==='block'||chc.getAttribute('data-active')==='1'))return 'CHC';
    return currentFamily||'CHC';
  }
  function activeFrame(){return frameFor(currentFamily||activeFamily())}

  function effectiveBrand(pin={}){
    return byId(pin.id)||byId(api()?.state?.selectedBrandId)||brands().find(b=>low(b.brand_key)===low(pin.key))||brands().find(b=>low(b.brand_name)===low(pin.name))||bgReich()||brands()[0]||null;
  }
  function effectiveLogo(pin={}){
    const b=effectiveBrand(pin),bg=bgReich();
    return norm(b?.logo_data)||norm(pin.logo)||norm(bg?.logo_data)||'';
  }
  function selectedMaterial(f,frame){
    let pin={};try{pin=frame?.contentWindow?.__KEYSUITE_MODEL_PRESENTATION_CONTEXT||{}}catch(_){}
    if(f==='ES'){
      const live=norm(frame?.contentDocument?.getElementById('material')?.value)||norm(frame===$('selectorEsFrame')?$('esMaterial')?.value:frame===$('productEsSelectorFrame')?$('esProductMaterial')?.value:'')||norm(frame?.contentWindow?.keysuiteExportPayload?.keysuite_material);
      return live||norm(pin.material)||'CI / SS / SS';
    }
    const live=frame===$('selectorFrame')?norm($('pumpMaterial')?.value):frame===$('productSelectorFrame')?norm($('productMaterial')?.value):norm($('pumpMaterial')?.value)||norm($('productMaterial')?.value);
    return live||norm(frame?.contentWindow?.keysuiteExportPayload?.keysuite_material)||norm(pin.material)||'SS304 (Cast Iron Connection)';
  }
  function selectedChcSeal(frame){
    let payload='',external=false;try{external=frame?.contentWindow?.__KEYSUITE_EXTERNAL_DATASHEET_EXPORT_ACTIVE__===true;payload=norm(frame?.contentWindow?.keysuiteExportPayload?.keysuite_seal)}catch(_){}
    if(external&&payload)return payload;
    const outer=frame===$('productSelectorFrame')?$('productSeal'):$('sealFaces'),live=norm(outer?.value);
    return live||payload||'Car/Cer';
  }
  function selectedChcElastomer(frame){
    let payload='',external=false;try{external=frame?.contentWindow?.__KEYSUITE_EXTERNAL_DATASHEET_EXPORT_ACTIVE__===true;payload=norm(frame?.contentWindow?.keysuiteExportPayload?.keysuite_elastomer)}catch(_){}
    if(external&&payload)return payload;
    const outer=frame===$('productSelectorFrame')?$('productElastomer'):$('sealElastomer'),live=norm(outer?.value);
    return live||payload||'Viton';
  }
  function baseContext(f,frame=frameFor(f)){
    let pin={};try{pin=frame?.contentWindow?.__KEYSUITE_MODEL_PRESENTATION_CONTEXT||{}}catch(_){}
    const material=selectedMaterial(f,frame);
    let ctx={};try{ctx=api()?.brandContext?.(pin.id||api()?.state?.selectedBrandId,f,material)||{}}catch(_){}
    const merged={...pin,...ctx,material,family:f};
    const brand=effectiveBrand(merged);
    merged.id=String(brand?.id||merged.id||'');
    merged.name=norm(brand?.brand_name)||norm(merged.name)||'B.G.Reich';
    merged.key=norm(brand?.brand_key)||norm(merged.key)||'';
    merged.logo=effectiveLogo(merged);
    merged.countryOfOrigin=norm(brand?.country_of_origin)||norm(merged.countryOfOrigin);
    merged.masterSeries=norm(merged.masterSeries)||f;
    merged.sellingSeries=norm(merged.sellingSeries)||norm(merged.brandSeries)||merged.masterSeries;
    return merged;
  }
  function aliasModel(model,ctx){
    let out=norm(model);if(!out)return out;
    const master=norm(ctx.masterSeries)||ctx.family||'',sell=norm(ctx.sellingSeries)||master;
    if(ctx.masterModel&&ctx.displayModel&&out.includes(ctx.masterModel))return out.split(ctx.masterModel).join(ctx.displayModel);
    if(ctx.family==='CHC'&&sell)out=out.replace(/\b(?:CHCS|CHCN|CHC)\b/g,sell);
    else if(master&&sell&&low(master)!==low(sell))out=out.replace(new RegExp(`\\b${escRe(master)}\\b`,'g'),sell);
    return out;
  }
  function snapshot(f=currentFamily,frame=frameFor(f)){
    const ctx=baseContext(f,frame);let masterModel=norm(ctx.masterModel),displayModel=norm(ctx.displayModel);
    try{
      const payload=frame?.contentWindow?.keysuiteExportPayload||{};
      if(!masterModel)masterModel=norm(payload.quotation_model)||norm(payload.model);
      if(f==='ES'&&!masterModel){const h=frame?.contentDocument?.querySelector('#summary h1')?.textContent||'';masterModel=norm(h)}
    }catch(_){}
    if(masterModel&&f==='CHC')displayModel=aliasModel(masterModel,ctx);
    else if(!displayModel&&masterModel){
      try{displayModel=window.KeySuiteSelectorBrand?.modelAliasFor?.(masterModel,ctx)||''}catch(_){}
      if(!displayModel)displayModel=aliasModel(masterModel,ctx);
    }
    return {
      family:f,id:ctx.id,name:ctx.name,key:ctx.key,logo:effectiveLogo(ctx),countryOfOrigin:ctx.countryOfOrigin,
      sellingSeries:ctx.sellingSeries||ctx.masterSeries||f,masterSeries:ctx.masterSeries||f,
      masterModel,displayModel:displayModel||masterModel,material:ctx.material,
      seal:f==='CHC'?selectedChcSeal(frame):'',elastomer:f==='CHC'?selectedChcElastomer(frame):'',
      applyBrandName:low(ctx.key)!=='b.g.reich'&&low(ctx.name)!=='b.g.reich',isMaster:low(ctx.key)==='b.g.reich'||low(ctx.name)==='b.g.reich'
    };
  }
  function lockSnapshot(f=currentFamily,frame=frameFor(f)){
    const s=snapshot(f,frame);try{frame.contentWindow.__KEYSUITE_PDF_PRESENTATION_SNAPSHOT={...s}}catch(_){}return s;
  }
  function aliasText(text,s){
    let out=String(text??'');
    if(s.masterModel&&s.displayModel)out=out.split(s.masterModel).join(s.displayModel);
    if(s.sellingSeries){
      if(s.family==='CHC')out=out.replace(/\b(?:CHCS|CHCN|CHC)\b/g,s.sellingSeries);
      else if(s.masterSeries&&low(s.masterSeries)!==low(s.sellingSeries))out=out.replace(new RegExp(`\\b${escRe(s.masterSeries)}\\b`,'g'),s.sellingSeries);
    }
    if(s.applyBrandName&&s.name)out=out.replace(/B\.G\.Reich/g,s.name);
    return out.replace(/Carbon\s+v\s+Silicon\s+Carbide\s*\(Car\/Cer\)/gi,'Carbon V Silicon Carbide (Ca SiC)').replace(/\b1\s+Stages\b/gi,'1 Stage');
  }

  function injectOuterStyle(){
    if($('ksV3964ProductCurveStyle'))return;
    const st=document.createElement('style');st.id='ksV3964ProductCurveStyle';st.textContent=`
      .ks3963-product-curve-open>.page{display:none!important}
      #productCurveDialog.ks3963-inline[open]{display:block!important;position:static!important;inset:auto!important;width:100%!important;max-width:none!important;height:auto!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;overflow:visible!important}
      #productCurveDialog.ks3963-inline::backdrop{display:none!important;background:transparent!important}
      #productCurveDialog.ks3963-inline .product-curve-selector-shell{padding:0!important;background:transparent!important}
      #productCurveDialog.ks3963-inline .product-curve-selector-head{display:flex!important;align-items:center!important;gap:8px!important;min-height:48px;padding:0 0 12px!important;margin:0 0 12px!important;border-bottom:1px solid #dbe3ec}
      #productCurveDialog.ks3963-inline #productCurveTitle{margin-right:auto!important;font-size:18px!important;font-weight:800!important;color:#17365d!important}
      #productCurveDialog.ks3963-inline #ks3942CurveActions{display:none!important}
      #productCurveDialog.ks3963-inline #closeProductCurve{margin-left:0!important;min-width:88px}
      #productCurveDialog.ks3963-inline #productCurveHost{position:relative;width:100%;min-width:0;background:transparent;border:0;border-radius:0;padding:0;box-shadow:none;overflow:visible!important}
      #productCurveDialog.ks3963-inline #productSelectorFrame,#productCurveDialog.ks3963-inline #productEsSelectorFrame{width:100%!important;min-height:1080px;border:0!important;overflow:hidden!important;transition:opacity .08s linear}
      #productCurveDialog.ks3963-inline #productCurveHost[data-ks3963-loading="1"]:before{content:'Loading selected model…';position:absolute;inset:0;z-index:2;display:flex;align-items:flex-start;justify-content:center;padding-top:56px;background:#fff;color:#687b89;font-size:13px;font-weight:700}
    `;document.head.appendChild(st);
  }
  function mainHost(){return document.querySelector('.app > main')||document.querySelector('main')}
  function setBackLabel(on){const b=$('closeProductCurve');if(!b)return;b.textContent=on?'← Back':'Close';b.setAttribute('aria-label',on?'Back to Product pump models':'Close')}
  function hideFrame(frame=activeFrame()){const host=$('productCurveHost');if(frame)frame.style.opacity='0';if(host)host.dataset.ks3963Loading='1'}
  function revealFrame(frame=activeFrame()){const host=$('productCurveHost');if(host)delete host.dataset.ks3963Loading;if(frame)frame.style.opacity='1'}
  function resizeFrame(frame=activeFrame()){
    if(!frame)return;try{const d=frame.contentDocument;frame.setAttribute('scrolling','no');frame.style.overflow='hidden';const h=Math.max(1080,Number(d?.documentElement?.scrollHeight||0),Number(d?.body?.scrollHeight||0))+10;frame.style.height=h+'px'}catch(_){frame.style.height='1900px'}
  }
  function openInline(){
    currentFamily=activeFamily();const dlg=productDialog(),main=mainHost(),fr=frameFor(currentFamily);if(!dlg||!main||!fr)return false;
    lastScrollY=window.scrollY||0;if(dlg.parentNode!==main)main.appendChild(dlg);
    inlineOpen=true;main.classList.add('ks3963-product-curve-open');dlg.classList.add('ks3963-inline');dlg.setAttribute('open','');dlg.dataset.ks3963Inline='1';setBackLabel(true);fr.style.display='block';hideFrame(fr);
    const other=frameFor(currentFamily==='ES'?'CHC':'ES');if(other)other.style.display='none';
    setTimeout(()=>{resizeFrame(fr);markVersion();window.scrollTo({top:0,behavior:'auto'})},0);return true;
  }
  function closeInline(){
    if(!inlineOpen)return false;const dlg=productDialog(),main=mainHost();inlineOpen=false;main?.classList.remove('ks3963-product-curve-open');dlg?.classList.remove('ks3963-inline');dlg?.removeAttribute('data-ks3963-inline');dlg?.removeAttribute('open');setBackLabel(false);try{window.scrollTo({top:lastScrollY,behavior:'auto'})}catch(_){window.scrollTo(0,lastScrollY)}markVersion();return true;
  }
  function installDialogBridge(){
    const dlg=productDialog();if(!dlg||dlg.dataset.ks3963Bridge==='1')return !!dlg;
    dlg.dataset.ks3963Bridge='1';nativeShowModal=HTMLDialogElement.prototype.showModal.bind(dlg);nativeClose=HTMLDialogElement.prototype.close.bind(dlg);
    dlg.showModal=function(){return openInline()||nativeShowModal()};
    dlg.close=function(value){if(inlineOpen)return closeInline();return nativeClose(value)};return true;
  }

  function ensureFrameStyle(doc,f){
    if(!doc?.head)return;let st=doc.getElementById('ksV3964ProductFrameStyle');if(!st){st=doc.createElement('style');st.id='ksV3964ProductFrameStyle';doc.head.appendChild(st)}
    if(f==='ES')st.textContent=`
      html,body.ks3963-product-es{overflow:visible!important}body.ks3963-product-es{background:#eef4f8!important}
      body.product-frame.ks3963-product-es>.top{display:flex!important;position:sticky!important;top:0!important;z-index:20!important}
      body.product-frame.ks3963-product-es>.top .actions{display:flex!important}
      body.product-frame.ks3963-product-es>.es-top-options{display:grid!important;position:sticky!important;top:60px!important;z-index:8!important}
      body.product-frame.ks3963-product-es>.layout{display:grid!important;grid-template-columns:350px minmax(0,1fr)!important;gap:14px!important;padding:14px!important;max-width:1550px!important;margin:auto!important;align-items:start!important}
      body.product-frame.ks3963-product-es aside.inputs{display:block!important;position:sticky!important;top:128px!important;align-self:start!important;max-height:none!important;overflow:visible!important;width:auto!important}
      body.product-frame.ks3963-product-es .main{display:grid!important;gap:14px!important;max-width:none!important;min-width:0!important}
      body.product-frame.ks3963-product-es .alts{display:none!important}
      body.product-frame.ks3963-product-es .details{display:block!important}
      body.product-frame.ks3963-product-es .grid2{display:grid!important;grid-template-columns:minmax(0,1.55fr) minmax(310px,1fr)!important;gap:14px!important;align-items:stretch!important}
      body.product-frame.ks3963-product-es .grid2>.chart-card{height:554px!important}
      body.product-frame.ks3963-product-es .chart-stack{display:grid!important;grid-template-rows:repeat(3,178px)!important;gap:10px!important}
      body.product-frame.ks3963-product-es .chart-stack>.chart-card{height:178px!important}
      body.product-frame.ks3963-product-es #run{background:#0f629c!important}
      @media(max-width:1100px){body.product-frame.ks3963-product-es>.layout{grid-template-columns:1fr!important}body.product-frame.ks3963-product-es aside.inputs{position:static!important}body.product-frame.ks3963-product-es .grid2{grid-template-columns:1fr!important}}
    `;
    else st.textContent=`
      html,body.ks3963-product-chc{overflow:visible!important}body.ks3963-product-chc{background:#eef3f7!important}
      body.product-frame.ks3963-product-chc>header{display:block!important;background:#fff!important}
      body.product-frame.ks3963-product-chc>header .brand-wrap{display:flex!important;max-width:1480px!important}
      body.product-frame.ks3963-product-chc>header .keysuite-header-actions{display:flex!important}
      body.product-frame.ks3963-product-chc main{display:grid!important;max-width:1480px!important;margin:20px auto!important;padding:0 15px 18px!important;grid-template-columns:340px minmax(0,1fr)!important;gap:17px!important;align-items:start!important}
      body.product-frame.ks3963-product-chc aside.inputs{display:block!important;width:auto!important;max-width:none!important}
      body.product-frame.ks3963-product-chc .result-area{display:grid!important;gap:17px!important;max-width:none!important;min-width:0!important}
      body.product-frame.ks3963-product-chc #out{display:block!important;min-height:0!important}
      body.product-frame.ks3963-product-chc #go{background:#0f629c!important}
      body.product-frame.ks3963-product-chc #alternativesCard,body.product-frame.ks3963-product-chc .alternatives-panel{display:none!important}
      body.product-frame.ks3963-product-chc .curve-grid{grid-template-columns:minmax(0,1.55fr) minmax(310px,.85fr)!important;align-items:stretch!important}
      body.product-frame.ks3963-product-chc .curve-grid>.chart-main{height:554px!important}
      body.product-frame.ks3963-product-chc .chart-stack{display:grid!important;grid-template-rows:repeat(3,178px)!important;gap:10px!important}
      body.product-frame.ks3963-product-chc .chart-stack>.chart-card{height:178px!important}
      @media(max-width:1050px){body.product-frame.ks3963-product-chc main{grid-template-columns:320px minmax(0,1fr)!important}body.product-frame.ks3963-product-chc .curve-grid{grid-template-columns:1fr!important}}
      @media(max-width:850px){body.product-frame.ks3963-product-chc main{grid-template-columns:1fr!important}}
    `;
  }

  function idsFor(f){return f==='ES'?{flow:'flow',head:'head',fu:'flowUnit',hu:'headUnit',go:'run',duty:'screenDuty',op:'screenOperating'}:{flow:'flow',head:'head',fu:'fu',hu:'hu',go:'go',duty:'showDuty',op:'showOperating'}}
  function normalizeChcMaterialOptions(doc){
    if(!doc)return;
    doc.querySelectorAll('select option').forEach(opt=>{
      const raw=norm(opt.value||opt.textContent),u=raw.toUpperCase().replace(/\s+/g,' ');
      if(!/^SS/.test(u))return;
      if(/(?:CAST\s*IRON|\bCI\b).*CONNECTION/.test(u)){opt.textContent='SS (CI Connection)';return}
      if(/^SS\s*304$/i.test(raw)||/^SS304$/i.test(raw)){opt.textContent='SS 304';return}
      if(/^SS\s*316$/i.test(raw)||/^SS316$/i.test(raw)){opt.textContent='SS 316'}
    });
  }
  function normalizeChcSeriesHeader(doc,series){
    const h1=doc?.querySelector('header h1');if(!h1)return;
    const explicit=norm(series);if(explicit){h1.textContent=`${explicit} Series`;return}
    const t=norm(h1.textContent),m=t.match(/([A-Za-z0-9._-]+)\s+Series\s*$/i);if(m)h1.textContent=`${m[1]} Series`;
  }
  function normalizeGenericChcFrame(frame){
    let doc;try{doc=frame?.contentDocument}catch(_){return}if(!doc?.body)return;
    normalizeChcMaterialOptions(doc);normalizeChcSeriesHeader(doc,'');
  }
  function captureDuty(doc,f){
    const id=idsFor(f),q=Number(doc?.getElementById(id.flow)?.value),h=Number(doc?.getElementById(id.head)?.value);if(!(q>0&&h>0))return null;
    lastDuty[f]={rawFlow:q,rawHead:h,flowUnit:doc.getElementById(id.fu)?.value||'m3h',headUnit:doc.getElementById(id.hu)?.value||'m'};return lastDuty[f];
  }
  function clearInitialDuty(doc,f){
    if(lastDuty[f]||!doc)return;const id=idsFor(f),flow=doc.getElementById(id.flow),head=doc.getElementById(id.head);if(flow)flow.value='';if(head)head.value='';
    [id.duty,id.op,f==='ES'?'screenSystem':'showSystem',f==='ES'?'screenOrifice':'showOrifice'].forEach(k=>{const el=doc.getElementById(k);if(el){el.checked=false;try{el.dispatchEvent(new Event('change',{bubbles:true}))}catch(_){}}});
  }
  function applyStoredDuty(doc,f){
    const duty=lastDuty[f];if(!duty||!doc)return false;const id=idsFor(f),flow=doc.getElementById(id.flow),head=doc.getElementById(id.head),fu=doc.getElementById(id.fu),hu=doc.getElementById(id.hu),go=doc.getElementById(id.go);if(!flow||!head||!go)return false;
    flow.value=duty.rawFlow;head.value=duty.rawHead;if(fu)fu.value=duty.flowUnit;if(hu)hu.value=duty.headUnit;const show=doc.getElementById(id.duty);if(show){show.checked=true;try{show.dispatchEvent(new Event('change',{bubbles:true}))}catch(_){}}setTimeout(()=>go.click(),0);return true;
  }

  function applyScreenIdentity(f,frame=frameFor(f)){
    let doc;try{doc=frame?.contentDocument}catch(_){return false}if(!doc?.body)return false;
    const s=snapshot(f,frame);doc.body.classList.remove('ks3963-product-chc','ks3963-product-es');doc.body.classList.add(f==='ES'?'ks3963-product-es':'ks3963-product-chc');ensureFrameStyle(doc,f);
    const id=idsFor(f),go=doc.getElementById(id.go);if(go){go.textContent='Plot';go.title='Plot Required Duty on this selected model'}
    const reportTitle=$('productCurveTitle');if(reportTitle)reportTitle.textContent=`Product Curve · ${s.displayModel||s.masterModel||s.sellingSeries||f}`;
    if(f==='CHC'){
      normalizeChcMaterialOptions(doc);normalizeChcSeriesHeader(doc,s.sellingSeries||'CHC');
      const model=doc.querySelector('.selection-model');if(model&&s.displayModel)model.textContent=s.displayModel;
      const hdr=doc.querySelector('header');if(hdr){const h1=hdr.querySelector('h1');if(h1)h1.textContent=`${s.sellingSeries||'CHC'} Series`;const logo=hdr.querySelector('img.brand-logo,img');if(logo&&s.logo){logo.src=s.logo;logo.alt=s.name||'Brand'}hdr.querySelectorAll('.keysuite-header-actions').forEach(a=>a.style.display='flex')}
    }else{
      const top=doc.querySelector('.top');if(top){const logo=top.querySelector('.brand img');if(logo&&s.logo){logo.src=s.logo;logo.alt=s.name||'Brand'}const b=top.querySelector('.brand b');if(b)b.textContent=s.isMaster?'KeySelector ES':`${s.name||s.sellingSeries} - ${s.sellingSeries||'ES'} Series`;const sm=top.querySelector('.brand small');if(sm)sm.textContent='End Suction Pump Selection';const acts=top.querySelector('.actions');if(acts)acts.style.display='flex'}
      const h1=doc.querySelector('#summary h1');if(h1&&s.displayModel)h1.textContent=s.displayModel;
    }
    const walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{const p=node.parentElement;if(!p||['SCRIPT','STYLE','TEXTAREA','OPTION'].includes(p.tagName))return;if(!visibleTextMaster.has(node))visibleTextMaster.set(node,node.nodeValue||'');const raw=visibleTextMaster.get(node)||'';const next=aliasText(raw,s);if(node.nodeValue!==next)node.nodeValue=next});
    doc.querySelectorAll('td,span,div,p').forEach(el=>{if(el.children.length)return;const t=String(el.textContent||'');if(/\b1\s+Stages\b/i.test(t))el.textContent=t.replace(/\b1\s+Stages\b/gi,'1 Stage')});
    if(s.logo)doc.querySelectorAll('img.brand-logo,header img,.top .brand img').forEach(img=>{img.src=s.logo;img.alt=s.name||'Brand'});
    try{const payload=frame.contentWindow.keysuiteExportPayload||{};frame.contentWindow.keysuiteExportPayload={...payload,keysuite_brand_name:s.name,keysuite_brand_logo:s.logo,keysuite_selling_series:s.sellingSeries,keysuite_master_series:s.masterSeries,keysuite_display_model:s.displayModel,keysuite_master_model:s.masterModel,keysuite_material:s.material}}catch(_){}
    if(!lastDuty[f]){
      if(f==='CHC')doc.querySelectorAll('.kpi').forEach(k=>{const label=norm(k.querySelector('span')?.textContent);if(/^Required Duty$/i.test(label)||/^Operating Point$/i.test(label)){const b=k.querySelector('b');if(b)b.textContent='—';const spans=k.querySelectorAll('span');if(spans[1])spans[1].textContent='Enter Flow + Head and Plot'}});
      else doc.querySelectorAll('#summary .kpi').forEach(k=>{const label=norm(k.querySelector('span')?.textContent);if(/^D1 duty$/i.test(label)){const b=k.querySelector('b');if(b)b.textContent='—';const sm=k.querySelector('small');if(sm)sm.textContent='Enter Flow + Head and Plot'}});
    }
    if(!doc.__KEYSUITE_V3964_DUTY_BOUND){doc.__KEYSUITE_V3964_DUTY_BOUND=true;doc.addEventListener('click',e=>{if(e.target?.closest?.('#'+idsFor(f).go))captureDuty(doc,f);setTimeout(()=>{applyScreenIdentity(f,frame);resizeFrame(frame)},0)},true);doc.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target?.matches?.('#flow,#head'))captureDuty(doc,f)},true);doc.addEventListener('change',()=>setTimeout(()=>{applyScreenIdentity(f,frame);resizeFrame(frame)},0),true)}
    resizeFrame(frame);return true;
  }

  function materialProfile(s){
    const raw=norm(s?.material),u=raw.toUpperCase().replace(/\s+/g,' ');if(!raw)return null;
    if(s.family==='CHC'){
      if(/(?:CAST\s*IRON|\bCI\b).*CONNECTION/.test(u)&&/^SS/.test(u))return {casing:'SS (CI Connection)',impeller:'Stainless Steel',shaft:'Stainless Steel'};
      if(/SS\s*316/.test(u))return {casing:'Stainless Steel 316',impeller:'Stainless Steel 316',shaft:'Stainless Steel 316'};
      if(/SS\s*304/.test(u))return {casing:'Stainless Steel 304',impeller:'Stainless Steel 304',shaft:'Stainless Steel 304'};
    }
    if(s.family==='ES'){
      if(/^SS\s*316$/.test(u))return {casing:'Stainless Steel 316',impeller:'Stainless Steel 316',shaft:'Stainless Steel 316'};
      if(/^SS\s*304$/.test(u))return {casing:'Stainless Steel 304',impeller:'Stainless Steel 304',shaft:'Stainless Steel 304'};
      if(/CI\s*\/\s*CI/i.test(raw))return {casing:'Cast Iron',impeller:'Cast Iron',shaft:'Stainless Steel'};
      if(/CI\s*\/\s*SS/i.test(raw))return {casing:'Cast Iron',impeller:'Stainless Steel',shaft:'Stainless Steel'};
    }
    return null;
  }
  function chcPdfSealText(rawSeal,rawElastomer){
    const raw=norm(rawSeal)||'Car/Cer',n=raw.toLowerCase().replace(/[\/_-]+/g,' ').replace(/\s+/g,' ').trim();let faces=raw.replace(/[\/]+/g,' ').replace(/\s+/g,' ').trim();
    if(!n||n==='car cer'||n==='car sic'||n==='ca sic'||n.includes('carbon'))faces='Ca SiC';else if(n==='sic sic'||n.includes('silicon carbide'))faces='SiC SiC';else if(n==='tc tc'||n==='tuc tic'||n==='tuc tuc'||n.includes('tungsten'))faces='TuC TuC';
    let e=norm(rawElastomer)||'Viton';if(/^viton$/i.test(e))e='Viton';else if(/^epdm$/i.test(e))e='EPDM';else if(/^nbr$/i.test(e))e='NBR';
    return faces==='Ca SiC'&&e==='Viton'?'Mechanical Seal':`Mech Seal - ${faces} ${e}`;
  }
  function findValueByLabel(doc,label,sectionName){
    let section='';for(const tr of doc.querySelectorAll('tr')){const tds=[...tr.querySelectorAll('td,th')];if(!tds.length)continue;const full=norm(tr.textContent);if(/^(Pump|Motor|Pumpset)$/i.test(full))section=full;if(sectionName&&low(section)!==low(sectionName))continue;for(let i=0;i<tds.length-1;i++){if(low(tds[i].textContent)===low(label))return tds[i+1]}}
    return null;
  }
  function applyTechnicalFixes(doc,s){
    if(!doc?.body)return;
    // Motor Type is globally standardized to TEFC.
    let section='';for(const tr of doc.querySelectorAll('tr')){const cells=[...tr.querySelectorAll('td,th')];if(!cells.length)continue;const full=norm(tr.textContent);if(/^(Pump|Motor|Pumpset)$/i.test(full))section=full;if(low(section)==='motor'){for(let i=0;i<cells.length-1;i++){if(low(cells[i].textContent)==='type')cells[i+1].textContent='TEFC';if(/^motor\s*type$/i.test(norm(cells[i].textContent)))cells[i+1].textContent='TEFC'}}if(low(section)==='pump'&&s?.family==='CHC'){for(let i=0;i<cells.length-1;i++){if(low(cells[i].textContent)==='type')cells[i+1].textContent='VMS Pump'}}}
    doc.querySelectorAll('td,th,dt,label,span,strong,b,p,div').forEach(l=>{if(!/^Motor\s*Type\s*:?$/i.test(norm(l.textContent)))return;let v=l.nextElementSibling;if(v)v.textContent='TEFC'});
    const mp=materialProfile(s);if(mp){const casing=findValueByLabel(doc,'Casing','Pump'),imp=findValueByLabel(doc,'Impeller','Pump'),shaft=findValueByLabel(doc,'Shaft','Pump');if(casing&&mp.casing)casing.textContent=mp.casing;if(imp&&mp.impeller)imp.textContent=mp.impeller;if(shaft&&mp.shaft)shaft.textContent=mp.shaft}
    if(s?.family==='CHC'){const shaftSeal=findValueByLabel(doc,'Shaft Seal','Pump');if(shaftSeal)shaftSeal.textContent=chcPdfSealText(s.seal,s.elastomer)}
    const stage=findValueByLabel(doc,'No. of Stage','Pump');if(stage){const m=norm(stage.textContent).match(/\d+/);if(m){const n=Number(m[0]);stage.textContent=`${n} ${n===1?'Stage':'Stages'}`}}
  }
  function applyIdentityDoc(doc,s){
    if(!doc?.body)return;try{
      if(s){const walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(n=>{const p=n.parentElement;if(!p||['SCRIPT','STYLE'].includes(p.tagName))return;n.nodeValue=aliasText(n.nodeValue,s)});doc.title=s.displayModel||aliasText(doc.title,s);if(s.countryOfOrigin)doc.querySelectorAll('td,th,dt,label,span,strong,b,p,div').forEach(l=>{if(!/^Country\s+(?:of\s+)?Origin\s*:?$/i.test(norm(l.textContent)))return;let v=l.nextElementSibling;if(v)v.textContent=s.countryOfOrigin});if(s.logo)doc.querySelectorAll('.brand-logo,.tds-logo,.report-head img,.tds-header img,.top img,header img').forEach(img=>{img.src=s.logo;img.alt=s.name||'Brand';img.dataset.keysuitePdfBrand='v40001'})}
      applyTechnicalFixes(doc,s||{});
    }catch(e){console.warn('[KeySuite V4.01] PDF finalization:',e)}
  }
  function safeData(value){return JSON.stringify(value||{}).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026')}
  function identityScript(s){
    return `<script id="ksV40001PdfFinal">(()=>{const c=${safeData(s)};const n=v=>String(v??'').trim(),lo=v=>n(v).toLowerCase(),alias=t=>{let x=String(t??'');if(c.masterModel&&c.displayModel)x=x.split(c.masterModel).join(c.displayModel);if(c.family==='CHC'&&c.sellingSeries)x=x.replace(/\\b(?:CHCS|CHCN|CHC)\\b/g,c.sellingSeries);else if(c.masterSeries&&c.sellingSeries&&lo(c.masterSeries)!==lo(c.sellingSeries))x=x.replace(new RegExp('\\\\b'+String(c.masterSeries).replace(/[.*+?^\${}()|[\\]\\\\]/g,'\\\\$&')+'\\\\b','g'),c.sellingSeries);if(c.applyBrandName&&c.name)x=x.replace(/B\\.G\\.Reich/g,c.name);return x.replace(/Carbon\\s+v\\s+Silicon\\s+Carbide\\s*\\(Car\/Cer\\)/gi,'Carbon V Silicon Carbide (Ca SiC)').replace(/\\b1\\s+Stages\\b/gi,'1 Stage')};const sealText=()=>{const raw=n(c.seal)||'Car/Cer',z=raw.toLowerCase().replace(/[\/_-]+/g,' ').replace(/\s+/g,' ').trim();let f=raw.replace(/[\/]+/g,' ').replace(/\s+/g,' ').trim();if(!z||z==='car cer'||z==='car sic'||z==='ca sic'||z.includes('carbon'))f='Ca SiC';else if(z==='sic sic'||z.includes('silicon carbide'))f='SiC SiC';else if(z==='tc tc'||z==='tuc tic'||z==='tuc tuc'||z.includes('tungsten'))f='TuC TuC';let e=n(c.elastomer)||'Viton';if(/^viton$/i.test(e))e='Viton';else if(/^epdm$/i.test(e))e='EPDM';else if(/^nbr$/i.test(e))e='NBR';return f==='Ca SiC'&&e==='Viton'?'Mechanical Seal':'Mech Seal - '+f+' '+e};const profile=()=>{const u=n(c.material).toUpperCase().replace(/\s+/g,' ');if(c.family==='CHC'&&/(?:CAST\s*IRON|\bCI\b).*CONNECTION/.test(u)&&/^SS/.test(u))return {Casing:'SS (CI Connection)',Impeller:'Stainless Steel',Shaft:'Stainless Steel'};if(c.family==='CHC'&&/SS\s*316/.test(u))return {Casing:'Stainless Steel 316',Impeller:'Stainless Steel 316',Shaft:'Stainless Steel 316'};if(c.family==='CHC'&&/SS\s*304/.test(u))return {Casing:'Stainless Steel 304',Impeller:'Stainless Steel 304',Shaft:'Stainless Steel 304'};if(c.family==='ES'&&/^SS\s*316$/.test(u))return {Casing:'Stainless Steel 316',Impeller:'Stainless Steel 316',Shaft:'Stainless Steel 316'};if(c.family==='ES'&&/^SS\s*304$/.test(u))return {Casing:'Stainless Steel 304',Impeller:'Stainless Steel 304',Shaft:'Stainless Steel 304'};if(c.family==='ES'&&/CI\s*\/\s*CI/i.test(c.material||''))return {Casing:'Cast Iron',Impeller:'Cast Iron',Shaft:'Stainless Steel'};if(c.family==='ES'&&/CI\s*\/\s*SS/i.test(c.material||''))return {Casing:'Cast Iron',Impeller:'Stainless Steel',Shaft:'Stainless Steel'};return null};const apply=()=>{try{document.title=c.displayModel||alias(document.title);const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),a=[];while(w.nextNode())a.push(w.currentNode);a.forEach(q=>{const p=q.parentElement;if(!p||['SCRIPT','STYLE'].includes(p.tagName))return;const y=alias(q.nodeValue);if(y!==q.nodeValue)q.nodeValue=y});let sec='';const mp=profile();document.querySelectorAll('tr').forEach(tr=>{const cells=[...tr.querySelectorAll('td,th')],full=n(tr.textContent);if(/^(Pump|Motor|Pumpset)$/i.test(full))sec=full;if(lo(sec)==='motor')cells.forEach((td,i)=>{if(i<cells.length-1&&(lo(td.textContent)==='type'||/^motor\\s*type$/i.test(n(td.textContent))))cells[i+1].textContent='TEFC'});if(lo(sec)==='pump'&&c.family==='CHC')cells.forEach((td,i)=>{if(i<cells.length-1&&lo(td.textContent)==='type')cells[i+1].textContent='VMS Pump'});if(lo(sec)==='pump'&&mp)cells.forEach((td,i)=>{const k=n(td.textContent);if(i<cells.length-1&&mp[k])cells[i+1].textContent=mp[k]});if(lo(sec)==='pump'&&c.family==='CHC')cells.forEach((td,i)=>{if(i<cells.length-1&&lo(td.textContent)==='shaft seal')cells[i+1].textContent=sealText()});if(lo(sec)==='pump')cells.forEach((td,i)=>{if(i<cells.length-1&&/^No\\. of Stage$/i.test(n(td.textContent))){const m=n(cells[i+1].textContent).match(/\\d+/);if(m){const z=Number(m[0]);cells[i+1].textContent=z+' '+(z===1?'Stage':'Stages')}}})});document.querySelectorAll('td,th,dt,label,span,strong,b,p,div').forEach(l=>{if(/^Motor\\s*Type\\s*:?$/i.test(n(l.textContent))&&l.nextElementSibling)l.nextElementSibling.textContent='TEFC'});if(c.countryOfOrigin)document.querySelectorAll('td,th,dt,label,span,strong,b,p,div').forEach(l=>{if(/^Country\\s+(?:of\\s+)?Origin\\s*:?$/i.test(n(l.textContent))&&l.nextElementSibling)l.nextElementSibling.textContent=c.countryOfOrigin});if(c.logo)document.querySelectorAll('.brand-logo,.tds-logo,.report-head img,.tds-header img,.top img,header img').forEach(img=>{img.src=c.logo;img.alt=c.name||'Brand';img.dataset.keysuitePdfBrand='v40001'})}catch(e){console.warn('KeySuite V4.01 PDF final:',e)}};apply();document.addEventListener('DOMContentLoaded',apply,{once:true});window.addEventListener('load',apply,{once:true});})();<\/script>`;
  }
  function transformReportHtml(html,s){
    if(typeof html!=='string'||!html)return html;let out=html.replace(/(<td[^>]*>\s*No\. of Stage\s*<\/td>\s*<td[^>]*>\s*)(\d+)\s+Stages(\s*<\/td>)/gi,(_,a,n,z)=>a+n+' '+(Number(n)===1?'Stage':'Stages')+z);
    if(/id=["']ksV40001PdfFinal["']/i.test(out))return out;const script=identityScript(s||{}),p=out.toLowerCase().lastIndexOf('</body>');return p>=0?out.slice(0,p)+script+out.slice(p):out+script;
  }
  function installReportTransform(reportWin,s){
    if(!reportWin)return;try{
      const patchDoc=doc=>{if(!doc||doc.__KEYSUITE_V3964_WRITE_HOOKED)return;doc.__KEYSUITE_V3964_WRITE_HOOKED=true;const write=doc.write?.bind(doc),writeln=doc.writeln?.bind(doc);if(write)doc.write=(...parts)=>write(...parts.map(x=>typeof x==='string'?transformReportHtml(x,s):x));if(writeln)doc.writeln=(...parts)=>writeln(...parts.map(x=>typeof x==='string'?transformReportHtml(x,s):x))};patchDoc(reportWin.document);
      if(!reportWin.__KEYSUITE_V3964_PRINT_HOOKED&&typeof reportWin.print==='function'){reportWin.__KEYSUITE_V3964_PRINT_HOOKED=true;const nativePrint=reportWin.print.bind(reportWin);reportWin.print=(...a)=>{try{applyIdentityDoc(reportWin.document,s)}catch(_){}return nativePrint(...a)}}
      try{reportWin.addEventListener('load',()=>applyIdentityDoc(reportWin.document,s),{once:true})}catch(_){}
    }catch(e){console.warn('[KeySuite V4.01] report hook:',e)}
  }
  function installPdfHooks(frame,f,{generic=false}={}){
    if(!frame?.contentWindow)return false;try{const w=frame.contentWindow,d=frame.contentDocument;if(!d?.body)return false;const getSnap=()=>generic?null:lockSnapshot(f,frame);
      if(!w.__KEYSUITE_V3964_OPEN_HOOKED){w.__KEYSUITE_V3964_OPEN_HOOKED=true;const nativeOpen=typeof w.open==='function'?w.open.bind(w):null;if(nativeOpen)w.open=(...a)=>{const s=getSnap();const report=nativeOpen(...a);if(report)installReportTransform(report,s);return report}}
      if(!d.body.__KEYSUITE_V3964_APPEND_HOOKED){d.body.__KEYSUITE_V3964_APPEND_HOOKED=true;const nativeAppend=d.body.appendChild.bind(d.body);d.body.appendChild=node=>{const r=nativeAppend(node);if(node?.tagName==='IFRAME'&&/pdfPrintFrame/i.test(node.id||'')){const s=getSnap();installReportTransform(node.contentWindow,s)}return r}}
      return true;
    }catch(e){console.warn('[KeySuite V4.01] selector PDF hook:',e);return false}
  }
  function scanGenericSelectorFrames(){
    document.querySelectorAll('iframe').forEach(fr=>{if(genericPdfFrames.has(fr))return;let src='';try{src=fr.getAttribute('src')||fr.dataset.src||''}catch(_){}if(!/selector(?:-es)?\/index\.html/i.test(src))return;genericPdfFrames.add(fr);const setup=()=>{let f=/selector-es/i.test(src)?'ES':'CHC';if(fr===frameFor('ES')||fr===frameFor('CHC'))return;installPdfHooks(fr,f,{generic:true});if(f==='CHC')normalizeGenericChcFrame(fr)};fr.addEventListener('load',setup);setTimeout(setup,0)});
  }

  function finalizeFrame({freshModel=false}={}){
    const f=currentFamily||activeFamily(),fr=frameFor(f);if(!fr)return;try{window.KeySuiteSelectorBrand?.refresh?.(fr);const pin=baseContext(f,fr),master=norm(pin.masterModel)||norm(fr.contentWindow?.keysuiteExportPayload?.quotation_model)||norm(fr.contentDocument?.querySelector(f==='ES'?'#summary h1':'.selection-model')?.textContent),display=norm(pin.displayModel)||aliasModel(master,pin);if(fr.contentWindow)fr.contentWindow.__KEYSUITE_MODEL_PRESENTATION_CONTEXT={...pin,masterModel:master,displayModel:display,pinned:true}}catch(_){}
    installPdfHooks(fr,f);applyScreenIdentity(f,fr);const doc=fr.contentDocument;if(freshModel){window.KeySuiteSelectorBrand?.collapseSummaryForFrame?.(fr);if(lastDuty[f])applyStoredDuty(doc,f);else clearInitialDuty(doc,f)}
    setTimeout(()=>{try{window.KeySuiteSelectorBrand?.refresh?.(fr)}catch(_){}applyScreenIdentity(f,fr);installPdfHooks(fr,f);revealFrame(fr);markVersion();resizeFrame(fr)},0);
    setTimeout(()=>{applyScreenIdentity(f,fr);revealFrame(fr);resizeFrame(fr);markVersion()},100);
  }
  function onMessage(event){
    const frames=['CHC','ES'].map(f=>[f,frameFor(f)]),hit=frames.find(([,fr])=>fr&&event.source===fr.contentWindow);if(!hit)return;const [f]=hit,m=event.data||{};if(m.type==='KEYSUITE_PRODUCT_FRAME_READY'){if(inlineOpen&&f===currentFamily)hideFrame(frameFor(f));setTimeout(()=>{if(inlineOpen&&f===currentFamily)finalizeFrame({freshModel:false});else installPdfHooks(frameFor(f),f)},0);return}if(m.type==='KEYSUITE_PRODUCT_CURVE_STATE'){currentFamily=f;const fresh=/^Curve loaded\./i.test(String(m.message||''));setTimeout(()=>finalizeFrame({freshModel:fresh}),0)}
  }
  function bind(){
    window.addEventListener('message',onMessage,true);window.addEventListener('resize',()=>{if(inlineOpen)resizeFrame(activeFrame())},{passive:true});window.addEventListener('pageshow',()=>setTimeout(()=>{markVersion();scanGenericSelectorFrames()},0));window.addEventListener('KEYSUITE_BRANDS_READY',()=>setTimeout(()=>{markVersion();if(inlineOpen)finalizeFrame()},0));window.addEventListener('KEYSUITE_V393_BRAND_CONTEXT_CHANGED',()=>setTimeout(()=>{markVersion();if(inlineOpen)finalizeFrame()},0));
    document.addEventListener('click',event=>{setTimeout(()=>document.querySelectorAll('iframe').forEach(fr=>{let src='';try{src=fr.getAttribute('src')||fr.dataset.src||''}catch(_){}if(/selector\/index\.html/i.test(src)&&fr!==frameFor('CHC'))normalizeGenericChcFrame(fr)}),0);if(inlineOpen&&event.target?.closest?.('#keyButton,aside nav button,nav button'))closeInline();if(event.target?.closest?.('#keysuitePdf,#keysuiteMobileExport,.ks3942-pdf')){if(inlineOpen)lockSnapshot(currentFamily,activeFrame());scanGenericSelectorFrames()}setTimeout(markVersion,0)},true);
  }
  function init(){injectOuterStyle();installDialogBridge();bind();scanGenericSelectorFrames();markVersion();setTimeout(()=>{installDialogBridge();scanGenericSelectorFrames();markVersion()},120);setTimeout(()=>{installDialogBridge();scanGenericSelectorFrames();markVersion()},700);setTimeout(markVersion,1600)}
  window.KeySuiteV40001ProductSeries={version:VERSION,refresh:()=>finalizeFrame(),snapshot:(f=currentFamily)=>snapshot(f,frameFor(f)),getDuty:f=>lastDuty[String(f||currentFamily).toUpperCase()]?{...lastDuty[String(f||currentFamily).toUpperCase()]}:null,clearDuty:f=>{lastDuty[String(f||currentFamily).toUpperCase()]=null},isOpen:()=>inlineOpen,currentFamily:()=>currentFamily};
  window.KeySuiteV3964ProductSeries=window.KeySuiteV40001ProductSeries;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
