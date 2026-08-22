/* KeySuite V4.01 — Customer-owned Brand settings.
 * - Brand Margin belongs to Customer + selling Brand only. No global Brand fallback.
 * - Dashboard Brand / Series Settings Save belongs to the currently selected Customer.
 * - Opening/switching a Customer restores that Customer's Brand / Series preference.
 * - Customer list and Key > Customer expose the same preference.
 * - Brand master switch hides a Brand without destroying saved child Series ticks.
 * - Assigned PDF Brand logo fallback remains: selected Brand -> B.G.Reich assigned logo -> native.
 * - CHC mechanical seal display label: Carbon V Silicon Carbide (Ca SiC).
 * Event-driven with bounded deferred refreshes only; no MutationObserver / permanent polling.
 */
(()=>{
  'use strict';
  if(window.top!==window.self||window.__KEYSUITE_V40001_CUSTOMER_BRAND_SETTINGS__)return;
  window.__KEYSUITE_V40001_CUSTOMER_BRAND_SETTINGS__=true;

  const VERSION='4.05.17';
  const $=id=>document.getElementById(id);
  const norm=v=>String(v??'').trim();
  const low=v=>norm(v).toLowerCase();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const api=()=>window.KeySuiteV394410||window.KeySuiteV39449||window.KeySuiteV39446||window.KeySuiteV39445||window.KeySuiteV39444||window.KeySuiteV3944||window.KeySuiteV3943||window.KeySuiteV3942||window.KeySuiteV3941||window.KeySuiteV391||null;
  const client=()=>window.KeySuiteAuth?.getClient?.()||null;
  const authority=()=>window.KeySuiteAuthority||null;
  const brands=()=>((api()?.state?.brands)||[]).filter(b=>b&&b.active!==false&&low(b.brand_key)!=='keylargo');
  const byId=id=>brands().find(b=>String(b.id)===String(id))||null;
  const bgReich=()=>brands().find(b=>low(b.brand_key)==='b.g.reich'||low(b.brand_name)==='b.g.reich')||null;
  const isMaster=b=>!!b&&(low(b.brand_type)==='master'||low(b.brand_key)==='b.g.reich'||low(b.brand_name)==='b.g.reich');
  const mappings=()=>((api()?.state?.mappings)||[]).filter(m=>m&&m.active!==false);
  const FAMILIES=['CHC','ES'];
  const keyOf=(bid,f)=>`${String(bid)}|${String(f).toUpperCase()}`;
  const companyId=()=>String(window.KEYSUITE_PROFILE?.company_id||window.KEYSUITE_ACCESS?.company_id||api()?.state?.brands?.[0]?.company_id||'');

  const cache=new Map();
  let dashboardCustomerId='';
  let detailCustomerId='';
  let formulaWrapped=false;
  let contextWrapped=false;
  let loadToken=0;

  function markVersion(){
    document.title='KeySuite V'+VERSION;
    document.querySelectorAll('.auth-brand small').forEach(n=>n.textContent='V'+VERSION);
    document.querySelectorAll('.brand small').forEach(n=>n.textContent='Full Suite V'+VERSION);
    document.querySelectorAll('.suite-version').forEach(n=>n.textContent='KeySuite V'+VERSION);
  }
  function customerName(id){return norm(window.KeySuiteApp?.getCustomerById?.(String(id||''))?.company)||'Selected Customer'}
  function selectedDashboardCustomer(){return String($('startCustomer')?.value||window.KeySuiteApp?.getPricingCustomerId?.()||$('qCustomer')?.value||'')}
  function rawEntries(){
    const out=[];
    brands().forEach(b=>{
      if(isMaster(b)){FAMILIES.forEach(f=>out.push({brand:b,family:f,key:keyOf(b.id,f)}));return}
      const fams=[...new Set(mappings().filter(m=>String(m.brand_id)===String(b.id)).map(m=>String(m.master_family||'').toUpperCase()).filter(f=>FAMILIES.includes(f)))];
      fams.forEach(f=>out.push({brand:b,family:f,key:keyOf(b.id,f)}));
    });
    return out;
  }
  function allEntries(){const out=rawEntries();return authority()?.filterBrandSeriesEntries?.(out)||out}
  function seriesLabel(b,f){
    try{return norm(api()?.brandSeriesFor?.(b,f))||norm(api()?.brandContext?.(b.id,f)?.brandSeries)||f}catch(_){return f}
  }
  function defaultPreference(){
    const visible=allEntries(),visibleSet=new Set(visible.map(e=>e.key)),raw=rawEntries(),brand_enabled={},hidden_brand_enabled={};
    visible.forEach(e=>brand_enabled[String(e.brand.id)]=true);
    raw.forEach(e=>{if(!visibleSet.has(e.key))hidden_brand_enabled[String(e.brand.id)]=true});
    return {keys:visible.map(e=>e.key),brand_enabled,exists:false,_hiddenKeys:raw.filter(e=>!visibleSet.has(e.key)).map(e=>e.key),_hiddenBrandEnabled:hidden_brand_enabled};
  }
  function normalizePreference(raw,exists=true){
    const def=defaultPreference();
    if(raw==null)return def;
    if(Array.isArray(raw))raw={keys:raw};
    if(typeof raw!=='object')return def;
    const rawValid=new Set(rawEntries().map(e=>e.key)),visibleValid=new Set(allEntries().map(e=>e.key));
    const fullKeys=Array.isArray(raw.keys)?raw.keys.map(String).filter(k=>rawValid.has(k)):[...def.keys,...def._hiddenKeys];
    const keys=fullKeys.filter(k=>visibleValid.has(k)),hiddenKeys=fullKeys.filter(k=>!visibleValid.has(k));
    const visibleBrandIds=new Set(allEntries().map(e=>String(e.brand.id))),brand_enabled={...def.brand_enabled},hidden_brand_enabled={...def._hiddenBrandEnabled};
    if(raw.brand_enabled&&typeof raw.brand_enabled==='object'&&!Array.isArray(raw.brand_enabled))Object.entries(raw.brand_enabled).forEach(([id,v])=>{if(visibleBrandIds.has(String(id)))brand_enabled[String(id)]=v!==false;else hidden_brand_enabled[String(id)]=v!==false});
    return {keys,brand_enabled,exists,_hiddenKeys:hiddenKeys,_hiddenBrandEnabled:hidden_brand_enabled};
  }
  const localKey=cid=>`keysuite-v3964-customer-brand-series-${cid||'none'}`;
  async function loadPreference(cid,{force=false}={}){
    cid=String(cid||'');if(!cid)return defaultPreference();
    if(cache.has(cid)&&!force)return cache.get(cid);
    let raw=null,exists=false;
    try{
      const c=client();if(c){const {data,error}=await c.rpc('keysuite_get_customer_quick_preference_v3963',{p_customer_id:cid});if(error)throw error;if(data!=null){raw=data;exists=true}}
    }catch(e){console.warn('V3.96.4 customer preference read:',e)}
    if(!exists){try{const saved=JSON.parse(localStorage.getItem(localKey(cid))||'null');if(saved!=null){raw=saved;exists=true}}catch(_){}}
    const pref=normalizePreference(raw,exists);cache.set(cid,pref);return pref;
  }
  async function savePreference(cid,pref){
    cid=String(cid||'');if(!cid)throw new Error('Select a customer before saving Brand / Series preference.');
    const prior=cache.get(cid)||defaultPreference(),hiddenKeys=prior._hiddenKeys||[],hiddenBrandEnabled=prior._hiddenBrandEnabled||{};
    const payload={keys:[...new Set([...(pref?.keys||[]).map(String),...hiddenKeys.map(String)])],brand_enabled:{...hiddenBrandEnabled,...(pref?.brand_enabled||{})}};
    cache.set(cid,normalizePreference(payload,true));try{localStorage.setItem(localKey(cid),JSON.stringify(payload))}catch(_){}
    const c=client();if(!c)throw new Error('Secure database connection is not ready.');
    const {data,error}=await c.rpc('keysuite_save_customer_quick_preference_v3963',{p_customer_id:cid,p_selection:payload});
    if(error)throw error;return data||payload;
  }

  function injectStyle(){
    if($('ksV3964CustomerBrandStyle'))return;
    const s=document.createElement('style');s.id='ksV3964CustomerBrandStyle';s.textContent=`
      .v3964-brand-master{display:flex!important;align-items:center;gap:7px;margin:0 0 6px;font-size:12px;font-weight:800;color:#17365d;cursor:pointer}
      .v3964-brand-master input{width:auto!important;min-height:0!important;margin:0!important;pointer-events:auto!important}
      .ks39442-pref-brand.v3964-brand-off{background:#f7f8fa}.ks39442-pref-brand.v3964-brand-off .ks39442-check{opacity:.55}
      .v3964-customer-pref{margin-top:16px;border-top:1px solid #dbe4ed;padding-top:16px}.v3964-customer-pref h3{margin:0;color:#17365d}
      .v3964-pref-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:10px}
      .v3964-pref-card{border:1px solid #dbe4ed;border-radius:9px;background:#fff;padding:9px}.v3964-pref-card.off{background:#f7f8fa}.v3964-pref-card.off .v3964-series{opacity:.55}
      .v3964-series{display:flex;align-items:center;gap:7px;font-size:12px;margin:6px 0}.v3964-series input,.v3964-pref-card input{width:auto!important;min-height:0!important;margin:0!important}
      .v3964-pref-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px}.v3964-pref-status{font-size:12px;color:#64748b}
      .v3964-customer-margin-note{font-size:11px;color:#64748b;margin-top:3px}
    `;document.head.appendChild(s);
  }

  function zeroGlobalBrandMargins(){
    const a=api();if(!a?.state?.brands)return;a.state.brands.forEach(b=>{b.brand_premium=0});
  }
  function removeGlobalBrandMarginUi(){
    $('v394412PremiumCard')?.remove();
    const rows=$('v391DefaultMarginRows');if(rows){const card=rows.closest('.v391-card,.card')||rows.parentElement;card?.remove()}
    document.querySelectorAll('#brandManagement .v391-card,#generalPriceList .v391-card,#generalPriceList .card').forEach(card=>{const t=norm(card.textContent);if(/Default Brand Margin|Brand Premium|Global Brand Margin/i.test(t)&&!card.querySelector('#v391CustomerMarginGrid'))card.remove()});
  }
  function decorateCustomerMarginUi(){
    const section=$('v391CustomerBrandPricing');if(!section)return;
    const h=section.querySelector('h3');if(h)h.textContent='Customer Brand Margin';
    const muted=section.querySelector('.muted');if(muted)muted.textContent='Each customer has an independent margin for each selling Brand. If no value is stored, the margin is 0%.';
    const cid=String($('companySettingsCompanySelect')?.value||'');
    section.querySelectorAll('.v391-customer-margin').forEach(input=>{
      const bid=String(input.dataset.brandId||''),key=`${cid}::${bid}`,has=api()?.state?.customerMargins?.has?.(key),v=has?Number(api().state.customerMargins.get(key)||0)*100:0;
      if(!has&&Number(input.value||0)!==0)input.value='0.0';
      const note=input.closest('.v391-margin-item')?.querySelector('.v391-margin-default');if(note){note.className='v3964-customer-margin-note';note.textContent=has?`Saved for ${customerName(cid)} · ${v.toFixed(1)}%`:'0% for this customer';}
      const label=input.closest('.v391-margin-item')?.querySelector('label');if(label){const b=byId(bid);if(b)label.textContent=`${b.brand_name} Margin`}
    });
  }
  function wrapFormula(){
    if(formulaWrapped||!window.KeySuitePricing?.formula)return;
    const original=window.KeySuitePricing.formula.bind(window.KeySuitePricing);
    window.KeySuitePricing.formula=(...args)=>{
      let text=String(original(...args)||'').replace(/Customer Brand Margin/gi,'__KEYSUITE_CBM__').replace(/Brand Premium/gi,'Customer Brand Margin').replace(/Brand Margin/gi,'Customer Brand Margin').replace(/__KEYSUITE_CBM__/g,'Customer Brand Margin');
      if(!/Customer Brand Margin/i.test(text))text=text.replace(/(\+\s*Transport)/i,'$1 → ÷ (1 − Customer Brand Margin)');
      return text;
    };
    formulaWrapped=true;
  }
  function normalizeVisibleFormula(){
    document.querySelectorAll('body *').forEach(n=>{if(n.children.length||!n.textContent)return;const t=n.textContent;if(!/(Brand Premium|Brand Margin)/i.test(t))return;if(!/(Transport|Commission|Margin|Quote)/i.test(t)&&!n.closest('#v391CustomerBrandPricing'))return;n.textContent=t.replace(/Customer Brand Margin/gi,'__KEYSUITE_CBM__').replace(/Brand Premium/gi,'Customer Brand Margin').replace(/Brand Margin/gi,'Customer Brand Margin').replace(/__KEYSUITE_CBM__/g,'Customer Brand Margin')});
  }

  function wrapBrandContext(){
    if(contextWrapped)return;const a=api(),original=a?.brandContext?.bind(a);if(!a||!original)return;
    a.brandContext=(...args)=>{const ctx=original(...args);if(!ctx)return ctx;if(!norm(ctx.logo)){const bg=bgReich();if(bg?.logo_data)ctx.logo=String(bg.logo_data)}return ctx};
    a.effectiveBrandLogo=brandId=>norm(byId(brandId)?.logo_data)||norm(bgReich()?.logo_data)||'';
    window.KeySuiteV394412=a;contextWrapped=true;
  }
  function logoStatus(brand){
    const bg=bgReich();if(brand?.logo_data)return 'Assigned Brand logo. Pump technical PDF output uses this logo.';
    if(isMaster(brand))return 'No assigned B.G.Reich logo. Native B.G.Reich report logo is the final fallback.';
    return bg?.logo_data?`No logo assigned to ${brand?.brand_name||'this Brand'}. PDF uses the assigned B.G.Reich logo.`:'No Brand logo assigned. PDF uses the native B.G.Reich report logo.';
  }
  function decorateLogoPanel(){
    const select=$('v392LogoBrandSelect'),preview=$('v392BrandLogoPreview'),status=$('v393BrandLogoStatus');if(!select||!preview)return;
    const brand=byId(select.value);if(!brand)return;const bg=bgReich();
    if(brand.logo_data)preview.src=brand.logo_data;else if(!isMaster(brand)&&bg?.logo_data)preview.src=bg.logo_data;
    if(status)status.textContent=logoStatus(brand);
    const canEdit=!select.disabled;[$('v392UploadLogo'),$('v392RemoveLogo'),$('v392SaveLogo')].forEach(b=>{if(b)b.disabled=!canEdit});
  }
  async function saveLogo(){
    const select=$('v392LogoBrandSelect'),preview=$('v392BrandLogoPreview'),brand=byId(select?.value);if(!brand||!preview||$('v392SaveLogo')?.disabled)return;
    const c=client();if(!c)return;const remove=preview.dataset.remove==='1',logo=remove?'':(preview.dataset.pending||brand.logo_data||'');
    let q=c.from('ks_oem_brands').update({logo_data:logo,updated_at:new Date().toISOString()}).eq('id',brand.id);if(brand.company_id)q=q.eq('company_id',brand.company_id);const {error}=await q;
    if(error){const m=$('v391BrandMessage');if(m)m.textContent=error.message||String(error);return}
    brand.logo_data=logo;preview.dataset.pending='';preview.dataset.remove='';const m=$('v391BrandMessage');if(m)m.textContent=`${brand.brand_name} logo saved.`;
    try{await api()?.loadData?.({force:true})}catch(_){}setTimeout(refresh,0);
  }

  function sealLabel(){
    ['sealFaces','productSeal'].forEach(id=>{const opt=$(id)?.querySelector('option[value="Car/Cer"]');if(opt)opt.textContent='Carbon V Silicon Carbide (Ca SiC)'});
    ['selectorFrame','productSelectorFrame'].forEach(id=>{try{const d=$(id)?.contentDocument,opt=d?.querySelector('option[value="Car/Cer"]');if(opt)opt.textContent='Carbon V Silicon Carbide (Ca SiC)'}catch(_){}});
  }

  function dashboardPrefTitle(cid){
    const d=$('ks39442Pref');if(!d)return;const s=d.querySelector('summary');if(s)s.textContent=cid?`Brand / Series Settings · ${customerName(cid)}`:'Brand / Series Settings · Select Customer';
  }
  function cardBrand(card){
    const name=norm(card?.querySelector(':scope > b,:scope > .v3964-brand-master b')?.textContent||'');return brands().find(b=>low(b.brand_name)===low(name))||null;
  }
  function collectDashboardPreference(){
    const base=cache.get(dashboardCustomerId)||defaultPreference(),keys=[];document.querySelectorAll('#ks39442PrefGrid input[data-pref-key]').forEach(x=>{if(x.checked)keys.push(String(x.dataset.prefKey||''))});
    const brand_enabled={...(base.brand_enabled||{})};document.querySelectorAll('#ks39442PrefGrid input[data-v3964-brand-master]').forEach(x=>brand_enabled[String(x.dataset.brandId||'')]=x.checked);
    return {keys,brand_enabled,exists:true};
  }
  function decorateDashboardCards(pref){
    const grid=$('ks39442PrefGrid');if(!grid)return;
    [...grid.querySelectorAll('.ks39442-pref-brand')].forEach(card=>{
      const brand=cardBrand(card);if(!brand)return;const bid=String(brand.id);let row=card.querySelector(':scope > .v3964-brand-master');
      if(!row){const old=card.querySelector(':scope > b');row=document.createElement('label');row.className='v3964-brand-master';row.innerHTML=`<input type="checkbox" data-v3964-brand-master="1" data-brand-id="${esc(bid)}"><b>${esc(brand.brand_name)}</b>`;if(old)old.replaceWith(row);else card.prepend(row)}
      const master=row.querySelector('input');master.checked=pref.brand_enabled?.[bid]!==false;card.classList.toggle('v3964-brand-off',!master.checked);
    });
  }
  function applyDashboardPreference(pref=cache.get(dashboardCustomerId)||defaultPreference()){
    dashboardPrefTitle(dashboardCustomerId);const set=new Set(pref.keys||[]);
    document.querySelectorAll('#ks39442PrefGrid input[data-pref-key]').forEach(x=>x.checked=set.has(String(x.dataset.prefKey||'')));
    decorateDashboardCards(pref);applyResultVisibility(pref);
  }
  function applyResultVisibility(pref=cache.get(dashboardCustomerId)||defaultPreference()){
    document.querySelectorAll('#ksV39442Results .ks39442-series').forEach(sec=>{
      const text=low(sec.querySelector('.ks39442-series-head')?.textContent||''),b=brands().find(x=>text.startsWith(low(x.brand_name)+' ·'));sec.hidden=!!b&&pref.brand_enabled?.[String(b.id)]===false;
    });
  }
  function prepareDashboardRun(){
    dashboardCustomerId=selectedDashboardCustomer();const pref=cache.get(dashboardCustomerId)||defaultPreference();applyDashboardPreference(pref);
    document.querySelectorAll('#ks39442PrefGrid .ks39442-pref-brand').forEach(card=>{const b=cardBrand(card);if(!b||pref.brand_enabled?.[String(b.id)]!==false)return;card.querySelectorAll('input[data-pref-key]').forEach(x=>x.checked=false)});
    setTimeout(()=>applyDashboardPreference(pref),0);
  }
  async function loadDashboardCustomer(cid,{force=false}={}){
    cid=String(cid||'');dashboardCustomerId=cid;const token=++loadToken;dashboardPrefTitle(cid);
    if(!cid){applyDashboardPreference(defaultPreference());const st=$('ksDutyStatus');if(st)st.textContent='Select a customer to use customer Brand / Series preference.';return}
    const pref=await loadPreference(cid,{force});if(token!==loadToken)return;applyDashboardPreference(pref);
    const st=$('ksDutyStatus');if(st)st.textContent=`Brand / Series preference loaded for ${customerName(cid)}.`;
    setTimeout(()=>applyDashboardPreference(pref),80);setTimeout(()=>applyDashboardPreference(pref),350);
  }
  async function saveDashboard(){
    dashboardCustomerId=selectedDashboardCustomer();const st=$('ksDutyStatus');if(!dashboardCustomerId){if(st)st.textContent='Select a customer before saving Brand / Series preference.';return}
    const pref=collectDashboardPreference();try{await savePreference(dashboardCustomerId,pref);applyDashboardPreference(pref);if(st)st.textContent=`Brand / Series preference saved to ${customerName(dashboardCustomerId)}.`}catch(e){console.error(e);if(st)st.textContent=e.message||String(e)}
  }

  function preferenceEditorHtml(cid,prefix){
    const pref=cache.get(String(cid))||defaultPreference(),set=new Set(pref.keys||[]);return `<div class="v3964-pref-grid">${brands().map(b=>{const mine=allEntries().filter(e=>String(e.brand.id)===String(b.id));if(!mine.length)return '';const bid=String(b.id),on=pref.brand_enabled?.[bid]!==false;return `<div class="v3964-pref-card ${on?'':'off'}" data-v3964-editor-brand="${esc(bid)}"><label class="v3964-brand-master"><input type="checkbox" data-v3964-editor-master="1" data-brand-id="${esc(bid)}" ${on?'checked':''}><b>${esc(b.brand_name)}</b></label>${mine.map(e=>`<label class="v3964-series"><input type="checkbox" data-v3964-editor-key="${esc(e.key)}" ${set.has(e.key)?'checked':''}><span>${esc(seriesLabel(b,e.family))}</span></label>`).join('')}</div>`}).join('')}</div><div class="v3964-pref-actions"><button class="btn" type="button" data-v3964-save-editor="${esc(prefix)}">Save Brand / Series Preference</button><span class="v3964-pref-status" data-v3964-status></span></div>`;
  }
  function readEditor(root){
    const keys=[...root.querySelectorAll('[data-v3964-editor-key]')].filter(x=>x.checked).map(x=>String(x.dataset.v3964EditorKey||'')),brand_enabled={};root.querySelectorAll('[data-v3964-editor-master]').forEach(x=>brand_enabled[String(x.dataset.brandId||'')]=x.checked);return {keys,brand_enabled,exists:true};
  }
  function bindEditorBehavior(root,cid){
    if(!root||root.dataset.v3964Bound)return;root.dataset.v3964Bound='1';
    root.addEventListener('change',e=>{const t=e.target;if(!t.matches('[data-v3964-editor-master]'))return;t.closest('.v3964-pref-card')?.classList.toggle('off',!t.checked)});
    root.addEventListener('click',async e=>{const btn=e.target.closest('[data-v3964-save-editor]');if(!btn)return;const status=root.querySelector('[data-v3964-status]');try{const pref=readEditor(root);await savePreference(cid,pref);if(status)status.textContent=`Saved to ${customerName(cid)}.`;if(String(cid)===selectedDashboardCustomer())loadDashboardCustomer(cid,{force:true})}catch(err){if(status)status.textContent=err.message||String(err)}});
  }
  async function renderCustomerDetailPreference(cid){
    cid=String(cid||'');if(!cid)return;detailCustomerId=cid;await loadPreference(cid);const host=$('customerDetail');if(!host||host.style.display==='none')return;
    let section=$('v3964CustomerDetailPreference');if(!section){section=document.createElement('div');section.id='v3964CustomerDetailPreference';section.className='v3964-customer-pref';host.appendChild(section)}
    section.innerHTML=`<h3>Brand / Series Preference</h3><div class="muted">Quick Selection automatically uses this preference when ${esc(customerName(cid))} is selected.</div>${preferenceEditorHtml(cid,'detail')}`;bindEditorBehavior(section,cid);
  }
  async function renderKeyCustomerPreference(cid){
    cid=String(cid||'');const editor=$('companyPricingEditor');if(!editor)return;let section=$('v3964KeyCustomerPreference');if(!section){section=document.createElement('div');section.id='v3964KeyCustomerPreference';section.className='v3964-customer-pref';const actions=editor.querySelector('.actions');editor.insertBefore(section,actions||null)}
    if(!cid){section.innerHTML='<h3>Brand / Series Preference</h3><div class="muted">Select a customer to edit its Quick Selection preference.</div>';return}
    await loadPreference(cid);section.innerHTML=`<h3>Brand / Series Preference</h3><div class="muted">Saved against this customer and loaded automatically on Dashboard Quick Selection.</div>${preferenceEditorHtml(cid,'key')}`;bindEditorBehavior(section,cid);
  }

  function refresh(){
    markVersion();injectStyle();zeroGlobalBrandMargins();removeGlobalBrandMarginUi();wrapBrandContext();wrapFormula();decorateCustomerMarginUi();decorateLogoPanel();sealLabel();normalizeVisibleFormula();
    const cid=selectedDashboardCustomer();if(cid!==dashboardCustomerId)loadDashboardCustomer(cid);else if(cid)applyDashboardPreference(cache.get(cid)||defaultPreference());
    const keyCid=String($('companySettingsCompanySelect')?.value||'');if(keyCid)renderKeyCustomerPreference(keyCid);
  }
  function bind(){
    document.addEventListener('click',e=>{
      if(e.target?.closest?.('#ks39442Save')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();saveDashboard();return}
      if(e.target?.closest?.('#ksDashSelect')){prepareDashboardRun();return}
      const customer=e.target?.closest?.('[data-start-customer-id]');if(customer){const cid=String(customer.dataset.startCustomerId||'');setTimeout(()=>loadDashboardCustomer(cid,{force:true}),0);return}
      const detail=e.target?.closest?.('[data-view-c]');if(detail){const cid=String(detail.dataset.viewC||'');detailCustomerId=cid;setTimeout(()=>renderCustomerDetailPreference(cid),0);return}
      if(e.target?.closest?.('#startCustomerClear')){setTimeout(()=>loadDashboardCustomer('',{force:true}),0);return}
      if(e.target?.closest?.('[data-page="brandManagement"],#v391BrandsCard,#v392LogoBrandSelect'))setTimeout(refresh,0);
      if(e.target?.closest?.('[data-page="companySettings"],#saveCompanyPricing'))setTimeout(()=>{decorateCustomerMarginUi();renderKeyCustomerPreference(String($('companySettingsCompanySelect')?.value||''));removeGlobalBrandMarginUi()},60);
      if(e.target?.closest?.('#ks39442All,#ks39442None'))setTimeout(()=>{const p=collectDashboardPreference();cache.set(dashboardCustomerId,p);decorateDashboardCards(p)},0);
    },true);
    document.addEventListener('change',e=>{
      const t=e.target;if(!t)return;
      if(t.matches('#qCustomer')){setTimeout(()=>loadDashboardCustomer(selectedDashboardCustomer(),{force:true}),0);return}
      if(t.matches('#companySettingsCompanySelect')){setTimeout(()=>{decorateCustomerMarginUi();renderKeyCustomerPreference(String(t.value||''))},0);return}
      if(t.matches('input[data-v3964-brand-master]')){const p=cache.get(dashboardCustomerId)||defaultPreference();p.brand_enabled[String(t.dataset.brandId||'')]=t.checked;cache.set(dashboardCustomerId,p);t.closest('.ks39442-pref-brand')?.classList.toggle('v3964-brand-off',!t.checked);applyResultVisibility(p);return}
      if(t.matches('#ks39442PrefGrid input[data-pref-key]')){const p=collectDashboardPreference();cache.set(dashboardCustomerId,p);return}
      if(t.matches('#v392LogoBrandSelect'))setTimeout(decorateLogoPanel,0);
    },true);
    $('ks39442Pref')?.addEventListener('toggle',()=>{if($('ks39442Pref')?.open)setTimeout(()=>applyDashboardPreference(cache.get(selectedDashboardCustomer())||defaultPreference()),0)});
    window.addEventListener('KEYSUITE_AUTHORITY_CHANGED',()=>{cache.clear();setTimeout(refresh,0)});
    window.addEventListener('KEYSUITE_BRANDS_READY',()=>{zeroGlobalBrandMargins();setTimeout(()=>{refresh();loadDashboardCustomer(selectedDashboardCustomer(),{force:true})},0);setTimeout(refresh,350);setTimeout(refresh,1200)});
    window.addEventListener('KEYSUITE_V393_BRAND_CONTEXT_CHANGED',()=>setTimeout(refresh,0));
    window.addEventListener('pageshow',()=>setTimeout(refresh,0));
    window.addEventListener('KEYSUITE_V3964_RUNTIME_READY',()=>setTimeout(refresh,0));
  }
  async function init(){
    injectStyle();bind();markVersion();wrapBrandContext();wrapFormula();sealLabel();
    dashboardCustomerId=selectedDashboardCustomer();if(dashboardCustomerId)await loadDashboardCustomer(dashboardCustomerId);refresh();
    const save=$('v392SaveLogo');if(save)save.onclick=saveLogo;
    setTimeout(()=>{const s=$('v392SaveLogo');if(s)s.onclick=saveLogo;refresh()},250);
    setTimeout(()=>{const s=$('v392SaveLogo');if(s)s.onclick=saveLogo;refresh()},1200);
  }

  window.KeySuiteV40001CustomerBrandSettings={version:VERSION,loadPreference,savePreference,loadDashboardCustomer,refresh,effectiveLogo:brandId=>norm(byId(brandId)?.logo_data)||norm(bgReich()?.logo_data)||''};
  window.KeySuiteV3964CustomerBrandSettings=window.KeySuiteV40001CustomerBrandSettings;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
