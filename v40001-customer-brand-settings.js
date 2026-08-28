/* KeySuite V4.17.03 — Customer-owned Brand settings with central Supabase Price Preference and strict Role Brand scope.
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

  const VERSION='4.17.10';
  const $=id=>document.getElementById(id);
  const norm=v=>String(v??'').trim();
  const low=v=>norm(v).toLowerCase();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const api=()=>window.KeySuiteV394410||window.KeySuiteV39449||window.KeySuiteV39446||window.KeySuiteV39445||window.KeySuiteV39444||window.KeySuiteV3944||window.KeySuiteV3943||window.KeySuiteV3942||window.KeySuiteV3941||window.KeySuiteV391||null;
  const client=()=>window.KeySuiteAuth?.getClient?.()||null;
  const authority=()=>window.KeySuiteAuthority||null;
  const currentRole=()=>norm(authority()?.state?.access?.role||window.KEYSUITE_ACCESS?.role||window.KEYSUITE_PROFILE?.role||'viewer').toLowerCase();
  const isOwnerAccount=()=>currentRole()==='owner';
  const customerSettingsLevel=()=>isOwnerAccount()?'full':String(window.KeySuitePermissions?.level?.('customer_settings',currentRole())||'none').toLowerCase();
  const canEditCustomerSettings=()=>customerSettingsLevel()==='full';
  const accountScopeReady=()=>isOwnerAccount()||authority()?.state?.loaded===true;
  const accountScopeKeys=()=>isOwnerAccount()?[]:(authority()?.scopeKeys?.()||[]).map(String);
  const accountAllows=(brandId,family)=>{
    if(isOwnerAccount())return true;
    const a=authority();if(!a?.state?.loaded)return false;
    const set=new Set(accountScopeKeys()),bid=String(brandId||''),fam=String(family||'').toUpperCase();
    return set.has(`${bid}|*`)||set.has(`${bid}|${fam}`);
  };
  const KEYLARGO_SCOPE_ID='KEYLARGO',GWS_SCOPE_ID='GWS';
  const virtualKeylargo=()=>({id:KEYLARGO_SCOPE_ID,brand_name:'Keylargo',brand_key:'keylargo',brand_type:'house',active:true,virtual:true});
  const virtualGws=()=>({id:GWS_SCOPE_ID,brand_name:'GWS',brand_key:'gws',brand_type:'house',active:true,virtual:true});
  const brands=()=>((api()?.state?.brands)||[]).filter(b=>{
    if(!b||b.active===false)return false;
    const key=low(b.brand_key),name=low(b.brand_name);
    return key!=='keylargo'&&name!=='keylargo'&&key!=='gws'&&name!=='gws';
  });
  const priceBrands=()=>[virtualKeylargo(),virtualGws(),...brands()];
  const visibleBrands=()=>{
    const all=brands();
    if(isOwnerAccount())return all;
    if(!accountScopeReady())return [];
    return all.filter(b=>HYDRAULIC_FAMILIES.some(f=>accountAllows(b.id,f)));
  };
  const byId=id=>priceBrands().find(b=>String(b.id)===String(id))||null;
  const bgReich=()=>brands().find(b=>low(b.brand_key)==='b.g.reich'||low(b.brand_name)==='b.g.reich')||null;
  const isMaster=b=>!!b&&(low(b.brand_type)==='master'||low(b.brand_key)==='b.g.reich'||low(b.brand_name)==='b.g.reich');
  const mappings=()=>((api()?.state?.mappings)||[]).filter(m=>m&&m.active!==false);
  const HYDRAULIC_FAMILIES=['CHC','ES'];
  const PRICE_GROUPS=['CHC_G1','CHC_G2','ES','MOTOR','BASEPLATE','COUPLING','KEYPLC','MANIFOLD','GWS'];
  const FAMILIES=HYDRAULIC_FAMILIES;
  const normalizeGroup=v=>String(v??'').trim().toUpperCase().replace(/\s+/g,'_');
  const hydraulicFamily=v=>{
    const g=normalizeGroup(v);
    if(g==='CHC'||g==='CHC_G2')return 'CHC';
    if(g==='ES')return 'ES';
    return ''; // CHC_G1 intentionally has no hydraulic Customer/Quick Selection entry yet.
  };
  const keyOf=(bid,f)=>`${String(bid)}|${String(f).toUpperCase()}`;
  const priceKeyOf=(bid,g)=>`${String(bid)}|${normalizeGroup(g)==='CHC'?'CHC_G2':normalizeGroup(g)}`;
  const normalizedPriceGroup=g=>normalizeGroup(g)==='CHC'?'CHC_G2':normalizeGroup(g);
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
  function selectedDashboardCustomer(){return String($('startCustomer')?.value||'')}
  function rawEntries(){
    const out=[];
    brands().forEach(b=>{
      if(isMaster(b)){
        out.push({brand:b,family:'CHC',productGroup:'CHC_G2',key:keyOf(b.id,'CHC')});
        out.push({brand:b,family:'ES',productGroup:'ES',key:keyOf(b.id,'ES')});
        return;
      }
      const groups=mappings().filter(m=>String(m.brand_id)===String(b.id)).map(m=>normalizeGroup(m.master_family));
      // Old CHC is CHC G2. G1 is intentionally not a hydraulic entry.
      if(groups.includes('CHC_G2')||groups.includes('CHC'))out.push({brand:b,family:'CHC',productGroup:'CHC_G2',key:keyOf(b.id,'CHC')});
      if(groups.includes('ES'))out.push({brand:b,family:'ES',productGroup:'ES',key:keyOf(b.id,'ES')});
    });
    return out;
  }
  function allEntries(){
    const out=rawEntries();
    if(isOwnerAccount())return out;
    if(!accountScopeReady())return [];
    return out.filter(e=>accountAllows(e.brand.id,e.family));
  }

  function isMosBrand(b){
    const compact=String(b?.brand_key||b?.brand_name||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    return compact==='mos';
  }
  function rawPriceEntries(){
    const out=[];
    brands().forEach(b=>{
      if(isMaster(b)){
        out.push({brand:b,priceGroup:'CHC_G1',family:'CHC',selectionKey:'',key:priceKeyOf(b.id,'CHC_G1')});
        out.push({brand:b,priceGroup:'CHC_G2',family:'CHC',selectionKey:keyOf(b.id,'CHC'),key:priceKeyOf(b.id,'CHC_G2')});
        out.push({brand:b,priceGroup:'ES',family:'ES',selectionKey:keyOf(b.id,'ES'),key:priceKeyOf(b.id,'ES')});
        out.push({brand:b,priceGroup:'MOTOR',family:'MOTOR',selectionKey:'',key:priceKeyOf(b.id,'MOTOR'),label:'Motor'});
        return;
      }
      const groups=[...new Set(
        mappings().filter(m=>String(m.brand_id)===String(b.id))
          .map(m=>normalizedPriceGroup(m.master_family))
          .filter(g=>['CHC_G1','CHC_G2','ES','MOTOR'].includes(g))
      )];
      if(isMosBrand(b)&&!groups.includes('MOTOR'))groups.push('MOTOR');
      groups.forEach(g=>out.push({
        brand:b,
        priceGroup:g,
        family:g==='ES'?'ES':g==='MOTOR'?'MOTOR':'CHC',
        selectionKey:g==='CHC_G2'?keyOf(b.id,'CHC'):g==='ES'?keyOf(b.id,'ES'):'',
        key:priceKeyOf(b.id,g),
        label:g==='MOTOR'?'Motor':''
      }));
    });
    const keylargo=virtualKeylargo();
    [
      ['BASEPLATE','BASEPLATE','Baseplate'],
      ['COUPLING','COUPLING','Coupling'],
      ['KEYPLC','KEYPLC','KeyPLC Panel'],
      ['MANIFOLD','MANIFOLD','Manifold']
    ].forEach(([group,family,label])=>out.push({brand:keylargo,priceGroup:group,family,selectionKey:'',key:priceKeyOf(keylargo.id,group),label}));
    const gws=virtualGws();
    out.push({brand:gws,priceGroup:'GWS',family:'TANK',selectionKey:'',key:priceKeyOf(gws.id,'GWS'),label:'GWS Tank'});
    return out;
  }
  function allPriceEntries(){
    return rawPriceEntries().filter(e=>isOwnerAccount()||accountAllows(e.brand.id,e.family));
  }
  function visiblePriceBrands(){
    const allowed=new Set(allPriceEntries().map(e=>String(e.brand.id)));
    return priceBrands().filter(b=>allowed.has(String(b.id)));
  }
  function priceGroupLabel(group){
    return ({CHC_G1:'CHC G1',CHC_G2:'CHC G2',ES:'End Suction',MOTOR:'Motor',BASEPLATE:'Baseplate',COUPLING:'Coupling',KEYPLC:'KeyPLC Panel',MANIFOLD:'Manifold',GWS:'GWS Tank'})[normalizedPriceGroup(group)]||String(group||'');
  }
  function priceEntrySeriesLabel(entry){
    if(entry.label)return String(entry.label);
    const series=seriesLabel(entry.brand,entry.family,entry.priceGroup);
    return `${series}${series&&series!==priceGroupLabel(entry.priceGroup)?` · ${priceGroupLabel(entry.priceGroup)}`:''}`;
  }
  function seriesLabel(b,f,productGroup=''){
    const group=normalizeGroup(productGroup||f)||String(f||'').toUpperCase();
    try{return norm(api()?.brandSeriesFor?.(b,group))||norm(api()?.brandContext?.(b.id,f,'',group)?.brandSeries)||f}catch(_){return f}
  }
  function priceGroupsForBrand(brandId){
    return [...new Set(mappings().filter(m=>String(m.brand_id)===String(brandId)).map(m=>{
      const group=normalizeGroup(m.master_family);
      return group==='CHC'?'CHC_G2':group;
    }).filter(Boolean))];
  }
  function noHydraulicStatus(brandId){
    const groups=priceGroupsForBrand(brandId);
    if(groups.includes('CHC_G1'))return 'CHC G1 · Price / Quote available · Curve / Selection unavailable';
    return 'No hydraulic Selection series configured for this Brand.';
  }
  function defaultPreference(){
    const brand_enabled={};visiblePriceBrands().forEach(b=>brand_enabled[String(b.id)]=true);
    // V4.15.07: Customer Price and Curve preferences are opt-in.
    // New / unset customers start with every Price and Curve checkbox OFF.
    return {
      keys:[],
      price_keys:[],
      brand_enabled,
      exists:false,
      _hiddenKeys:[],
      _hiddenPriceKeys:[],
      _readError:'',
      _source:'supabase'
    };
  }
  function normalizePreference(raw,exists=true){
    const def=defaultPreference();
    if(raw==null)return def;
    if(Array.isArray(raw))raw={keys:raw};
    if(typeof raw!=='object')return def;

    const rawSelValid=new Set(rawEntries().map(e=>e.key)),visibleSelValid=new Set(allEntries().map(e=>e.key));
    const rawPriceValid=new Set(rawPriceEntries().map(e=>e.key)),visiblePriceValid=new Set(allPriceEntries().map(e=>e.key));

    const fullKeys=Array.isArray(raw.keys)
      ?raw.keys.map(String).filter(k=>rawSelValid.has(k))
      :[...def.keys,...def._hiddenKeys];
    const fullPriceKeys=Array.isArray(raw.price_keys)
      ?raw.price_keys.map(String).filter(k=>rawPriceValid.has(k))
      :[...def.price_keys,...def._hiddenPriceKeys];

    // Keep Selection memory even when Price is OFF.
    // isSelectionAllowed() applies Price as the live master gate.
    const keys=fullKeys.filter(k=>visibleSelValid.has(k));
    const price_keys=fullPriceKeys.filter(k=>visiblePriceValid.has(k));
    const hiddenKeys=fullKeys.filter(k=>!visibleSelValid.has(k));
    const hiddenPriceKeys=fullPriceKeys.filter(k=>!visiblePriceValid.has(k));

    const brand_enabled={};visiblePriceBrands().forEach(b=>brand_enabled[String(b.id)]=true);
    return {keys,price_keys,brand_enabled,exists,_hiddenKeys:hiddenKeys,_hiddenPriceKeys:hiddenPriceKeys,_readError:raw?._readError||'',_source:raw?._source||'supabase'};
  }

  const localKey=cid=>`keysuite-v3964-customer-brand-series-${cid||'none'}`;
  function missingPreferenceRpc(error){
    const code=String(error?.code||'').toUpperCase(),msg=String(error?.message||error||'').toLowerCase();
    return code==='PGRST202'||code==='42883'||msg.includes('could not find the function')||msg.includes('schema cache')||msg.includes('does not exist');
  }
  async function readCentralPreference(cid){
    const c=client();if(!c)throw new Error('Secure database connection is not ready.');
    let result=await c.rpc('keysuite_get_customer_price_preference_v41710',{p_customer_id:cid});
    if(result.error&&missingPreferenceRpc(result.error)){
      // Installation fallback only. Once V41710 SQL is installed, this path is not used.
      result=await c.rpc('keysuite_get_customer_quick_preference_v41705',{p_customer_id:cid});
      if(result.error&&missingPreferenceRpc(result.error)){
        result=await c.rpc('keysuite_get_customer_quick_preference_v3963',{p_customer_id:cid});
      }
    }
    if(result.error)throw result.error;
    return result.data;
  }
  async function loadPreference(cid,{force=false}={}){
    cid=String(cid||'');if(!cid)return defaultPreference();
    if(cache.has(cid)&&!force)return cache.get(cid);
    let raw=null,exists=false,readError='';
    try{
      const data=await readCentralPreference(cid);
      if(data!=null){raw=data;exists=true}
    }catch(e){
      readError=String(e?.message||e||'Customer Price Preference could not be loaded.');
      console.warn('V4.17.03 central customer preference read:',e);
    }

    // IMPORTANT: localStorage is no longer an authority source for Price Preference.
    // It remains only a successful-save backup. Cross-user pricing must come from Supabase.
    const normalized=normalizePreference(raw,exists);
    normalized._readError=readError;
    normalized._source='supabase';
    cache.set(cid,normalized);
    try{window.dispatchEvent(new CustomEvent('KEYSUITE_CUSTOMER_BRAND_PREFERENCE_CHANGED',{detail:{customerId:cid,source:'supabase',error:readError}}))}catch(_){}
    return normalized;
  }
  async function savePreference(cid,pref){
    cid=String(cid||'');if(!cid)throw new Error('Select a customer before saving Brand / Series preference.');
    const prior=cache.get(cid)||defaultPreference(),hiddenKeys=prior._hiddenKeys||[],hiddenPriceKeys=prior._hiddenPriceKeys||[];
    const payload={
      keys:[...new Set([...(pref?.keys||[]).map(String),...hiddenKeys.map(String)])],
      price_keys:[...new Set([...(pref?.price_keys||[]).map(String),...hiddenPriceKeys.map(String)])],
      brand_enabled:{}
    };
    visiblePriceBrands().forEach(b=>payload.brand_enabled[String(b.id)]=true);

    // V4.17.10 generic Supabase store accepts virtual / non-hydraulic keys.
    const c=client();if(!c)throw new Error('Secure database connection is not ready.');
    const {data,error}=await c.rpc('keysuite_save_customer_price_preference_v41710',{p_customer_id:cid,p_selection:payload});
    if(error){
      if(missingPreferenceRpc(error))throw new Error('V4.17.10 Customer Price Preference database is not installed. Run supabase/migrations/V41710_GENERIC_CUSTOMER_PRICE_PREFERENCE.sql.');
      throw error;
    }

    const saved=normalizePreference(payload,true);saved._readError='';saved._source='supabase';
    cache.set(cid,saved);
    try{localStorage.setItem(localKey(cid),JSON.stringify(payload))}catch(_){}
    try{window.dispatchEvent(new CustomEvent('KEYSUITE_CUSTOMER_BRAND_PREFERENCE_CHANGED',{detail:{customerId:cid,source:'supabase'}}))}catch(_){}
    return data||payload;
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
      .v41501-authorized{font-size:10px;font-weight:800;color:#2d6a4f;margin-left:auto;white-space:nowrap}.v41501-no-series{font-size:11px;color:#64748b;margin:8px 0 2px;line-height:1.35}
      .v3964-pref-grid,#ks39442PrefGrid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;align-items:stretch}
      .v3964-pref-card,.ks39442-pref-brand{min-width:0!important;max-width:100%!important;overflow:hidden!important;box-sizing:border-box!important}
      .v3964-brand-master{display:flex!important;align-items:center!important;gap:8px!important;min-width:0!important}
      .v3964-brand-master b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .v41710-brand-toggle-wrap{display:flex;align-items:center;gap:7px;min-width:0;cursor:pointer}
      .v41710-brand-toggle-wrap input{width:auto!important;min-height:0!important;margin:0!important}
      .v41710-brand-toggle-note{font-size:9px;color:#64748b;font-weight:700;white-space:nowrap}
      .v41504-pref-head,.v41504-pref-row{display:grid;grid-template-columns:minmax(0,1fr) 54px 66px;column-gap:8px;align-items:center;width:100%;min-width:0;box-sizing:border-box}
      .v41504-pref-head{font-size:10px;font-weight:800;color:#64748b;border-bottom:1px solid #e5edf5;padding:6px 0}
      .v41504-pref-head span:nth-child(2),.v41504-pref-head span:nth-child(3){text-align:center;white-space:nowrap}
      .v41504-pref-row{font-size:12px;padding:7px 0;border-bottom:1px solid #f0f3f6}.v41504-pref-row:last-child{border-bottom:0}
      .v41504-pref-row>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:2px}
      .v41504-pref-row label{display:flex;justify-content:center;align-items:center;margin:0;min-width:0}.v41504-pref-row input{width:auto!important;min-height:0!important;margin:0!important}
      .v41504-disabled{opacity:.45}.v41504-no-curve{font-size:10px;color:#64748b;text-align:center;line-height:1.15;white-space:normal;overflow-wrap:anywhere}
      .v41506-price-head,.v41506-price-row{display:grid;grid-template-columns:minmax(0,1fr) 68px;gap:10px;align-items:center;width:100%;box-sizing:border-box}
      .v41506-selection-head,.v41506-selection-row{display:grid;grid-template-columns:minmax(0,1fr) 82px;gap:10px;align-items:center;width:100%;box-sizing:border-box}
      .v41506-price-head,.v41506-selection-head{padding:6px 0;border-bottom:1px solid #e5edf5;font-size:10px;font-weight:800;color:#64748b}
      .v41506-price-head span:last-child,.v41506-selection-head span:last-child{text-align:center}
      .v41506-price-row,.v41506-selection-row{padding:8px 0;border-bottom:1px solid #f0f3f6;font-size:12px}
      .v41506-price-row:last-child,.v41506-selection-row:last-child{border-bottom:0}
      .v41506-price-row>span,.v41506-selection-row>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .v41506-price-row label,.v41506-selection-row label{display:flex;align-items:center;justify-content:center;margin:0}
      .v41506-price-row input,.v41506-selection-row input{width:auto!important;min-height:0!important;margin:0!important}
      .v41506-empty{grid-column:1/-1;border:1px dashed #cbd5e1;border-radius:9px;padding:12px;color:#64748b;background:#f8fafc;font-size:12px}
      @media (max-width:900px){.v3964-pref-grid,#ks39442PrefGrid{grid-template-columns:1fr!important}}
      @media (max-width:520px){.v41504-pref-head,.v41504-pref-row{grid-template-columns:minmax(0,1fr) 48px 58px;column-gap:5px}.v41501-authorized{font-size:9px}}
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

  // V4.16.03: Dashboard Quick Selection Brand / Series UI is owned by
  // v40201-quick-selection.js (user preference within Role/Owner authority).
  // Customer Brand settings must never rename, hide, rebuild or filter that panel.
  function dashboardPrefTitle(cid){ return true; }

  function renderDashboardPreference(pref=cache.get(dashboardCustomerId)||defaultPreference()){ return true; }
  function cardBrand(card){
    const name=norm(card?.querySelector(':scope > b,:scope > .v3964-brand-master b')?.textContent||'');return brands().find(b=>low(b.brand_name)===low(name))||null;
  }
  function collectDashboardPreference(){
    const keys=[...document.querySelectorAll('#ks39442PrefGrid input[data-pref-key]')].filter(x=>x.checked&&!x.disabled).map(x=>String(x.dataset.prefKey||''));
    const price_keys=[...document.querySelectorAll('#ks39442PrefGrid input[data-v41504-price-key]')].filter(x=>x.checked).map(x=>String(x.dataset.v41504PriceKey||''));
    return {keys,price_keys,brand_enabled:{},exists:true};
  }
  function decorateDashboardCards(pref){ return true; }
  function applyDashboardPreference(pref=cache.get(dashboardCustomerId)||defaultPreference()){ return true; }
  function applyResultVisibility(pref=cache.get(dashboardCustomerId)||defaultPreference()){ return true; }
  function prepareDashboardRun(){ return true; }
  async function loadDashboardCustomer(cid,{force=false}={}){
    cid=String(cid||'');dashboardCustomerId=cid;const token=++loadToken;dashboardPrefTitle(cid);
    if(!cid){applyDashboardPreference(defaultPreference());const st=$('ksDutyStatus');if(st)st.textContent='Select a customer to use customer Brand / Series preference.';return}
    const pref=await loadPreference(cid,{force});if(token!==loadToken)return;applyDashboardPreference(pref);
    const st=$('ksDutyStatus');if(st)st.textContent=`Brand / Series preference loaded for ${customerName(cid)}.`;
    setTimeout(()=>applyDashboardPreference(pref),80);setTimeout(()=>applyDashboardPreference(pref),350);
  }
  async function saveDashboard(){ return true; }

  function pricePreferenceEditorHtml(cid){
    const pref=cache.get(String(cid))||defaultPreference(),priceSet=new Set(pref.price_keys||[]),editable=canEditCustomerSettings();
    const cards=visiblePriceBrands().map(b=>{
      const bid=String(b.id),rows=allPriceEntries().filter(e=>String(e.brand.id)===bid);
      if(!rows.length)return '';
      const checkedCount=rows.filter(e=>priceSet.has(e.key)).length,allChecked=checkedCount===rows.length&&rows.length>0;
      return `<div class="v3964-pref-card" data-v41506-price-brand="${esc(bid)}">
        <div class="v3964-brand-master">
          <label class="v41710-brand-toggle-wrap" title="${editable?'Tick / untick all Role-authorized series under this Brand':'View only'}">
            <input type="checkbox" data-v41710-price-brand-toggle="${esc(bid)}" ${allChecked?'checked':''} ${editable?'':'disabled'}>
            <b>${esc(b.brand_name)}</b>
          </label>
          <span class="v41710-brand-toggle-note">All Series</span>
          <span class="v41501-authorized">Role Authorized</span>
        </div>
        <div class="v41506-price-head"><span>Brand Series</span><span>Price</span></div>
        ${rows.map(e=>`<div class="v41506-price-row">
          <span><b>${esc(priceEntrySeriesLabel(e))}</b></span>
          <label title="${editable?'Allow price and quotation for this customer':'View only'}"><input type="checkbox" data-v41506-price-key="${esc(e.key)}" ${priceSet.has(e.key)?'checked':''} ${editable?'':'disabled'}></label>
        </div>`).join('')}
      </div>`;
    }).filter(Boolean).join('');
    return `<div class="v391-note" style="margin-bottom:10px"><b>Customer Brand Assignment:</b> every checked Price row is assigned to this Customer. When this Customer is selected in Quick Selection, the Left Panel shows only the intersection of the user's Role Brand Assigned and these checked Brand / Series rows.</div>
      <div class="v3964-pref-grid">${cards||'<div class="v41506-empty">No Role-authorized Price Groups are available.</div>'}</div>
      <div class="v3964-pref-actions"><button class="btn" type="button" data-v41506-save-price="1" ${editable?'':'disabled'}>${editable?'Save Price Preference':'View Only'}</button><span class="v3964-pref-status" data-v41506-price-status></span></div>`;
  }

  function selectionPreferenceEditorHtml(cid){
    const pref=cache.get(String(cid))||defaultPreference(),priceSet=new Set(pref.price_keys||[]),selectionSet=new Set(pref.keys||[]);
    const cards=visibleBrands().map(b=>{
      const bid=String(b.id);
      // Left Customer page only shows series whose Price is authorized.
      const rows=allPriceEntries().filter(e=>String(e.brand.id)===bid&&!!e.selectionKey&&priceSet.has(e.key));
      if(!rows.length)return '';
      return `<div class="v3964-pref-card" data-v41506-selection-brand="${esc(bid)}">
        <div class="v3964-brand-master"><b>${esc(b.brand_name)}</b><span class="v41501-authorized">Price Authorized</span></div>
        <div class="v41506-selection-head"><span>Brand Series</span><span>Selection</span></div>
        ${rows.map(e=>`<div class="v41506-selection-row">
          <span><b>${esc(priceEntrySeriesLabel(e))}</b></span>
          <label title="Show this Brand / Series in Quick Selection"><input type="checkbox" data-v41506-selection-key="${esc(e.selectionKey)}" ${selectionSet.has(e.selectionKey)?'checked':''}></label>
        </div>`).join('')}
      </div>`;
    }).filter(Boolean).join('');
    return `<div class="v3964-pref-grid">${cards||'<div class="v41506-empty">No Price-authorized Curve / Quick Selection series are available. Enable Price first under Key → Customer.</div>'}</div>
      <div class="v3964-pref-actions"><button class="btn" type="button" data-v41506-save-selection="1">Save Curve Preference</button><span class="v3964-pref-status" data-v41506-selection-status></span></div>`;
  }

  function syncPriceBrandToggles(root){
    if(!root)return;
    root.querySelectorAll('[data-v41710-price-brand-toggle]').forEach(master=>{
      const bid=String(master.dataset.v41710PriceBrandToggle||'');
      const card=master.closest('[data-v41506-price-brand]')||root;
      const rows=[...card.querySelectorAll('[data-v41506-price-key]')];
      const checked=rows.filter(x=>x.checked).length;
      master.checked=rows.length>0&&checked===rows.length;
      master.indeterminate=checked>0&&checked<rows.length;
    });
  }

  async function savePriceOnly(cid,root){
    const prior=cache.get(String(cid))||await loadPreference(cid);
    const price_keys=[...root.querySelectorAll('[data-v41506-price-key]')].filter(x=>x.checked).map(x=>String(x.dataset.v41506PriceKey||''));
    return savePreference(cid,{...prior,price_keys,keys:[...(prior.keys||[])]});
  }

  async function saveSelectionOnly(cid,root){
    const prior=cache.get(String(cid))||await loadPreference(cid);
    const selected=[...root.querySelectorAll('[data-v41506-selection-key]')].filter(x=>x.checked).map(x=>String(x.dataset.v41506SelectionKey||''));
    const priceSet=new Set(prior.price_keys||[]);
    const editable=new Set(
      allPriceEntries()
        .filter(e=>!!e.selectionKey&&priceSet.has(e.key))
        .map(e=>String(e.selectionKey))
    );
    // Preserve hidden/off-price selection memory in the background.
    const keep=(prior.keys||[]).map(String).filter(k=>!editable.has(k));
    const keys=[...new Set([...keep,...selected])];
    return savePreference(cid,{...prior,keys,price_keys:[...(prior.price_keys||[])]});
  }

  function bindPriceEditor(root,cid){
    if(!root)return;
    // V4.17.10 Brand checkbox is Select / Clear All for the visible Role-authorized series.
    root.dataset.v41506PriceCustomerId=String(cid||'');
    syncPriceBrandToggles(root);
    if(root.dataset.v41506PriceBound==='1')return;
    root.dataset.v41506PriceBound='1';
    root.addEventListener('change',e=>{
      const master=e.target.closest('[data-v41710-price-brand-toggle]');
      if(master){
        const card=master.closest('[data-v41506-price-brand]');
        card?.querySelectorAll('[data-v41506-price-key]').forEach(box=>{if(!box.disabled)box.checked=master.checked});
        syncPriceBrandToggles(root);
        return;
      }
      if(e.target.matches?.('[data-v41506-price-key]'))syncPriceBrandToggles(root);
    });
    root.addEventListener('click',async e=>{
      const btn=e.target.closest('[data-v41506-save-price]');if(!btn)return;
      const status=root.querySelector('[data-v41506-price-status]');
      const activeCid=String(root.dataset.v41506PriceCustomerId||$('companySettingsCompanySelect')?.value||'');
      if(!activeCid){if(status)status.textContent='Select a customer before saving Price Preference.';return}
      if(!canEditCustomerSettings()){if(status)status.textContent='Your role has View-only access to Key → Customer.';return}
      try{
        await savePriceOnly(activeCid,root);
        syncPriceBrandToggles(root);
        if(status)status.textContent=`Price Preference saved to ${customerName(activeCid)}.`;
        if(activeCid===selectedDashboardCustomer())await loadDashboardCustomer(activeCid,{force:true});
      }catch(err){if(status)status.textContent=err.message||String(err)}
    });
  }

  function bindSelectionEditor(root,cid){
    if(!root)return;
    // V4.16.05: same stale-listener protection for Curve / Quick Selection preference.
    root.dataset.v41506SelectionCustomerId=String(cid||'');
    if(root.dataset.v41506SelectionBound==='1')return;
    root.dataset.v41506SelectionBound='1';
    root.addEventListener('click',async e=>{
      const btn=e.target.closest('[data-v41506-save-selection]');if(!btn)return;
      const status=root.querySelector('[data-v41506-selection-status]');
      const activeCid=String(root.dataset.v41506SelectionCustomerId||detailCustomerId||'');
      if(!activeCid){if(status)status.textContent='Select a customer before saving Curve Preference.';return}
      try{
        await saveSelectionOnly(activeCid,root);
        if(status)status.textContent=`Brand / Series Curve Preference saved to ${customerName(activeCid)}.`;
        if(activeCid===selectedDashboardCustomer())await loadDashboardCustomer(activeCid,{force:true});
      }catch(err){if(status)status.textContent=err.message||String(err)}
    });
  }

  async function renderCustomerDetailPreference(cid){
    cid=String(cid||'');if(!cid)return;
    detailCustomerId=cid;
    await loadPreference(cid);
    const host=$('customerDetail');if(!host||host.style.display==='none')return;
    let section=$('v3964CustomerDetailPreference');
    if(!section){section=document.createElement('div');section.id='v3964CustomerDetailPreference';section.className='v3964-customer-pref';host.appendChild(section)}
    section.innerHTML=`<h3>Brand / Series Curve Preference</h3>
      <div class="muted">Curve / Quick Selection only. Only Brand / Series with Price enabled under Key → Customer are shown here.</div>
      ${selectionPreferenceEditorHtml(cid)}`;
    bindSelectionEditor(section,cid);
  }

  async function renderKeyCustomerPreference(cid){
    cid=String(cid||'');
    const editor=$('companyPricingEditor');if(!editor)return;
    let section=$('v3964KeyCustomerPreference');
    if(!section){section=document.createElement('div');section.id='v3964KeyCustomerPreference';section.className='v3964-customer-pref';const actions=editor.querySelector('.actions');editor.insertBefore(section,actions||null)}
    if(!cid){
      section.innerHTML='<h3>Brand / Series Price Preference</h3><div class="muted">Select a customer to edit Price availability.</div>';
      return;
    }
    await loadPreference(cid);
    section.innerHTML=`<h3>Brand / Series Price Preference</h3>
      <div class="muted">Commercial master permission. Unticked Brand / Series cannot be priced or quoted and will not appear in the Customer Quick Selection preference.</div>
      ${pricePreferenceEditorHtml(cid)}`;
    bindPriceEditor(section,cid);
  }

  function currentPreferenceCustomerId(){
    return String(selectedDashboardCustomer()||window.KeySuiteApp?.getPricingCustomerId?.()||$('qCustomer')?.value||'');
  }
  function isPriceAllowed(brandId,priceGroup,cid=currentPreferenceCustomerId()){
    const group=normalizedPriceGroup(priceGroup);
    if(!PRICE_GROUPS.includes(group))return true;
    if(!cid)return true;
    const key=priceKeyOf(brandId,group);
    if(!allPriceEntries().some(e=>e.key===key))return false;
    const pref=cache.get(String(cid));if(!pref||pref._readError)return null;
    return new Set(pref.price_keys||[]).has(key);
  }
  function isSelectionAllowed(brandId,priceGroup,cid=currentPreferenceCustomerId()){
    const group=normalizedPriceGroup(priceGroup);
    if(group==='CHC_G1')return false;
    if(!['CHC_G2','ES'].includes(group))return false;
    if(isPriceAllowed(brandId,group,cid)!==true)return false;
    const pref=cache.get(String(cid));if(!pref)return false;
    const selectionKey=group==='CHC_G2'?keyOf(brandId,'CHC'):keyOf(brandId,'ES');
    return new Set(pref.keys||[]).has(selectionKey);
  }
  function rowPriceIdentity(row){
    let source={},pump={};try{source=JSON.parse(row?.dataset?.pricingSource||'{}')}catch(_){}
    try{pump=JSON.parse(row?.dataset?.pumpData||'{}')}catch(_){}
    let brandId=String(source.v391_brand_id||pump.keysuite_brand_id||row?.dataset?.v391BrandId||'');
    let group=normalizedPriceGroup(source.v41413_price_group_code||source.v41413_product_group_code||pump.keysuite_price_group_code||pump.keysuite_product_group_code||'');
    const family=String(source.product_family||source.family||pump.keysuite_product_family||row?.dataset?.v391Family||'').toUpperCase();
    if(!group){
      if(family==='ES')group='ES';
      else if(family==='CHC')group=String(source.generation_code||pump.keysuite_generation_code||'G2').toUpperCase()==='G1'?'CHC_G1':'CHC_G2';
      else if(family==='MOTOR')group='MOTOR';
      else if(['BASEPLATE','COUPLING','KEYPLC','MANIFOLD'].includes(family))group=family;
      else if(family==='GWS'||family==='TANK')group='GWS';
    }
    if(['BASEPLATE','COUPLING','KEYPLC','MANIFOLD'].includes(group))brandId=KEYLARGO_SCOPE_ID;
    if(group==='GWS')brandId=GWS_SCOPE_ID;
    return {brandId,group};
  }
  function currentBrandPriceBlockReason(){
    let ctx=api()?.brandContext?.();
    const state=api()?.state||{};
    let group=normalizedPriceGroup(ctx?.priceGroup||ctx?.productGroup||state.selectedProductGroup||state.selectedFamily||'');
    let brandId=String(ctx?.id||state.selectedBrandId||''),name=String(ctx?.name||'Selected Brand');
    if(['BASEPLATE','COUPLING','KEYPLC','MANIFOLD'].includes(group)){brandId=KEYLARGO_SCOPE_ID;name='Keylargo'}
    if(group==='GWS'||String(state.selectedBrandId||'')===GWS_SCOPE_ID){group='GWS';brandId=GWS_SCOPE_ID;name='GWS'}
    if(!PRICE_GROUPS.includes(group)||!brandId)return '';
    const cid=currentPreferenceCustomerId();if(!cid)return '';
    if(!cache.has(cid)){loadPreference(cid).then(()=>refresh()).catch(()=>{});return 'Customer Price Preference is still loading. Please try again.'}
    const pref=cache.get(cid);if(pref?._readError)return `Customer Price Preference could not be loaded from Supabase: ${pref._readError}`;
    return isPriceAllowed(brandId,group,cid)===false?`${name} · ${priceGroupLabel(group)} Price is disabled for this customer.`:'';
  }
  function quotationPriceBlockReason(){
    const cid=currentPreferenceCustomerId();if(!cid)return '';
    if(!cache.has(cid)){loadPreference(cid).then(()=>refresh()).catch(()=>{});return 'Customer Price Preference is still loading. Please try again.'}
    const pref=cache.get(cid);if(pref?._readError)return `Customer Price Preference could not be loaded from Supabase: ${pref._readError}`;
    for(const row of document.querySelectorAll('#quoteItems .quote-item')){
      const id=rowPriceIdentity(row);if(!id.brandId||!id.group)continue;
      if(isPriceAllowed(id.brandId,id.group,cid)===false){
        const brand=byId(id.brandId);return `${brand?.brand_name||'Selected Brand'} · ${priceGroupLabel(id.group)} Price is disabled for this customer.`;
      }
    }
    return '';
  }
  let pricingGateWrapped=false;
  function wrapPricingGate(){
    if(pricingGateWrapped||!window.KeySuiteApp)return;pricingGateWrapped=true;
    const originalContext=window.KeySuiteApp.ensureQuotationPricingContext?.bind(window.KeySuiteApp),originalSource=window.KeySuiteApp.ensureQuotationSourcePricing?.bind(window.KeySuiteApp);
    if(originalContext)window.KeySuiteApp.ensureQuotationPricingContext=(action='continue')=>{
      if(!originalContext(action))return false;
      if(/\badd\b/i.test(String(action||''))){
        const reason=currentBrandPriceBlockReason();if(reason){alert(reason);return false}
      }
      return true;
    };
    if(originalSource)window.KeySuiteApp.ensureQuotationSourcePricing=(action='continue')=>{
      const reason=quotationPriceBlockReason();
      if(reason){alert(`${reason}\n\nEnable Price under Brand / Series Settings before you ${action}.`);return false}
      return originalSource(action);
    };
  }

  function refresh(){
    markVersion();injectStyle();zeroGlobalBrandMargins();removeGlobalBrandMarginUi();wrapBrandContext();wrapFormula();wrapPricingGate();decorateCustomerMarginUi();decorateLogoPanel();sealLabel();normalizeVisibleFormula();
    const cid=selectedDashboardCustomer();if(cid!==dashboardCustomerId)loadDashboardCustomer(cid);else if(cid)applyDashboardPreference(cache.get(cid)||defaultPreference());
    const keyCid=String($('companySettingsCompanySelect')?.value||'');if(keyCid)renderKeyCustomerPreference(keyCid);
  }
  function bind(){
    document.addEventListener('click',e=>{
      if(e.target?.closest?.('#ksDashSelect')){prepareDashboardRun();return}
      const customer=e.target?.closest?.('[data-start-customer-id]');if(customer){const cid=String(customer.dataset.startCustomerId||'');setTimeout(()=>loadDashboardCustomer(cid,{force:true}),0);return}
      const detail=e.target?.closest?.('[data-view-c]');if(detail){const cid=String(detail.dataset.viewC||'');detailCustomerId=cid;setTimeout(()=>renderCustomerDetailPreference(cid),0);return}
      if(e.target?.closest?.('#startCustomerClear')){setTimeout(()=>loadDashboardCustomer('',{force:true}),0);return}
      if(e.target?.closest?.('[data-page="brandManagement"],#v391BrandsCard,#v392LogoBrandSelect'))setTimeout(refresh,0);
      if(e.target?.closest?.('[data-page="companySettings"],#saveCompanyPricing'))setTimeout(()=>{decorateCustomerMarginUi();renderKeyCustomerPreference(String($('companySettingsCompanySelect')?.value||''));removeGlobalBrandMarginUi()},60);
    },true);
    document.addEventListener('change',e=>{
      const t=e.target;if(!t)return;
      if(t.matches('#qCustomer')){setTimeout(()=>loadDashboardCustomer(selectedDashboardCustomer(),{force:true}),0);return}
      if(t.matches('#companySettingsCompanySelect')){setTimeout(()=>{decorateCustomerMarginUi();renderKeyCustomerPreference(String(t.value||''))},0);return}
      if(t.matches('#ks39442PrefGrid input[data-v41504-price-key]')){
        const key=String(t.dataset.v41504PriceKey||''),row=t.closest('.v41504-pref-row'),selection=$('ks39442PrefGrid')?.querySelector(`[data-v41504-price-parent="${CSS.escape(key)}"]`);
        row?.classList.toggle('v41504-disabled',!t.checked);
        if(selection){selection.disabled=!t.checked;if(!t.checked)selection.checked=false}
        const p=normalizePreference(collectDashboardPreference(),true);cache.set(dashboardCustomerId,p);applyResultVisibility(p);return
      }
      if(t.matches('#v392LogoBrandSelect'))setTimeout(decorateLogoPanel,0);
    },true);
    window.addEventListener('KEYSUITE_AUTHORITY_CHANGED',()=>{
      cache.clear();
      setTimeout(()=>{
        refresh();
        const cid=selectedDashboardCustomer();
        if(cid)loadDashboardCustomer(cid,{force:true});
        const keyCid=String($('companySettingsCompanySelect')?.value||'');
        if(keyCid)renderKeyCustomerPreference(keyCid);
      },0);
    });
    window.addEventListener('KEYSUITE_BRANDS_READY',()=>{zeroGlobalBrandMargins();setTimeout(()=>{refresh();loadDashboardCustomer(selectedDashboardCustomer(),{force:true})},0);setTimeout(refresh,350);setTimeout(refresh,1200)});
    window.addEventListener('KEYSUITE_V393_BRAND_CONTEXT_CHANGED',()=>setTimeout(refresh,0));
    window.addEventListener('pageshow',()=>setTimeout(refresh,0));
    window.addEventListener('KEYSUITE_V3964_RUNTIME_READY',()=>setTimeout(refresh,0));
  }
  async function init(){
    injectStyle();bind();markVersion();wrapBrandContext();wrapFormula();wrapPricingGate();sealLabel();
    dashboardCustomerId=selectedDashboardCustomer();if(dashboardCustomerId)await loadDashboardCustomer(dashboardCustomerId);refresh();
    const save=$('v392SaveLogo');if(save)save.onclick=saveLogo;
    setTimeout(()=>{const s=$('v392SaveLogo');if(s)s.onclick=saveLogo;refresh()},250);
    setTimeout(()=>{const s=$('v392SaveLogo');if(s)s.onclick=saveLogo;refresh()},1200);
  }

  window.KeySuiteV40001CustomerBrandSettings={version:VERSION,loadPreference,savePreference,loadDashboardCustomer,renderDashboardPreference,refresh,isPriceAllowed,isSelectionAllowed,currentPreferenceCustomerId,currentDashboardCustomerId:selectedDashboardCustomer,effectiveLogo:brandId=>norm(byId(brandId)?.logo_data)||norm(bgReich()?.logo_data)||''};
  window.KeySuiteV3964CustomerBrandSettings=window.KeySuiteV40001CustomerBrandSettings;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
