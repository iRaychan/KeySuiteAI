/* KeySuite V4.17.07 — Role Brand Assigned maximum authority; permanent Keylargo + GWS house scopes. */
(() => {
  'use strict';
  if(window.__KEYSUITE_V40407_ROLE_AUTHORITY__)return;
  window.__KEYSUITE_V40407_ROLE_AUTHORITY__=true;

  const VERSION='4.17.08';
  const FAMILIES=['CHC','ES'];
  const PRODUCT_PAGE_FAMILY={productChc:'CHC',productEs:'ES'};
  // V4.17.02: Product → Keylargo is an Owner-assigned role scope.
  const KEYLARGO_PRODUCT_PAGE_FAMILY={
    productBaseplate:'BASEPLATE',
    productCoupling:'COUPLING',
    productKeyplc:'KEYPLC',
    productManifold:'MANIFOLD'
  };
  const GWS_PRODUCT_PAGE_FAMILY={productGws:'TANK'};
  const HOUSE_PRODUCT_PAGES=new Set(['keyLab']);
  const MOTOR_PRODUCT_PAGES=new Set(['productMotor']);
  const OTHER_PRODUCT_PAGES=new Set([]);
  const SELECTOR_PAGE_FAMILY={selector:'CHC',selectorEs:'ES'};
  const state={access:null,scope:{keys:[]},loaded:false,loadError:''};
  const norm=v=>String(v??'').trim();
  const upper=v=>norm(v).toUpperCase();
  const role=()=>norm(state.access?.role||window.KEYSUITE_ACCESS?.role||window.KEYSUITE_PROFILE?.role||'viewer').toLowerCase();
  const level=key=>window.KeySuitePermissions?.level?.(key,role())||(role()==='owner'?'full':'none');
  const can=key=>level(key)!=='none';
  const normalizeProductGroup=value=>upper(value).replace(/\s+/g,'_');
  const familyOf=value=>{
    const group=normalizeProductGroup(value);
    if(group==='CHC'||group==='CHC_G1'||group==='CHC_G2')return 'CHC';
    if(group==='ES')return 'ES';
    return '';
  };
  const keyOf=(brandId,family)=>`${norm(brandId)}|${upper(family)}`;
  const brandAllKey=brandId=>`${norm(brandId)}|*`;
  const isMasterBrand=brand=>!!brand&&(upper(brand.brand_type)==='MASTER'||norm(brand.brand_key).toLowerCase()==='b.g.reich'||norm(brand.brand_name).toLowerCase()==='b.g.reich');
  const isKeylargoBrand=brand=>!!brand&&(upper(brand.id)==='KEYLARGO'||norm(brand.brand_key).toLowerCase()==='keylargo'||norm(brand.brand_name).toLowerCase()==='keylargo');
  const brandApi=()=>window.KeySuiteV394410||window.KeySuiteV40001||window.KeySuiteV391||null;
  const keylargoBrandId=()=> 'KEYLARGO';
  const gwsBrandId=()=> 'GWS';
  const wildcardKeys=()=>scopeKeys().filter(k=>upper(k.split('|')[1])==='*');
  const normalizeScope=raw=>{
    let value=raw;
    if(typeof value==='string'){try{value=JSON.parse(value)}catch(_){value={}}}
    if(!value||typeof value!=='object'||Array.isArray(value))value={};
    const keys=Array.isArray(value.keys)?value.keys.map(norm).filter(Boolean):[];
    return {keys:[...new Set(keys)]};
  };
  const scopeKeys=()=>state.scope.keys.slice();
  const scopeSet=()=>new Set(scopeKeys());
  const brandSeriesLocked=()=>!can('choose_brand_series');
  // Owner is unrestricted. Every non-Owner is always bounded by Role Brand Assigned,
  // regardless of whether Change Brand / Series is Full or None.
  const scopeEnforced=()=>role()!=='owner';
  const allowedFamilies=()=>{
    if(!scopeEnforced())return FAMILIES.slice();
    const explicit=scopeKeys().map(k=>upper(k.split('|')[1])).filter(f=>FAMILIES.includes(f));
    if(!wildcardKeys().length)return [...new Set(explicit)];
    const api=brandApi(),brands=api?.state?.brands||[],maps=api?.state?.mappings||[],wildBrands=new Set(wildcardKeys().map(k=>norm(k.split('|')[0]))),fromWild=[];
    let nonHouseWildcard=false;
    wildBrands.forEach(id=>{
      const virtual=upper(id);
      const brand=virtual==='KEYLARGO'?{id:'KEYLARGO',brand_key:'keylargo',brand_name:'Keylargo'}:brands.find(b=>norm(b?.id)===id);
      // Virtual Keylargo / GWS wildcards authorize house Products only.
      if(virtual==='KEYLARGO'||virtual==='GWS'||isKeylargoBrand(brand))return;
      nonHouseWildcard=true;
      if(isMasterBrand(brand)){fromWild.push(...FAMILIES);return}
      maps.filter(m=>m&&m.active!==false&&norm(m.brand_id)===id).forEach(m=>{const f=familyOf(m.master_family);if(FAMILIES.includes(f))fromWild.push(f)});
    });
    return [...new Set([...explicit,...(fromWild.length?fromWild:(nonHouseWildcard?FAMILIES:[]))])];
  };
  const allowedBrandIds=()=>{
    if(!scopeEnforced())return [];
    return [...new Set(scopeKeys().map(k=>norm(k.split('|')[0])).filter(Boolean))];
  };
  function isBrandAllowed(brandId){
    if(!scopeEnforced())return true;
    return allowedBrandIds().includes(norm(brandId));
  }
  function isBrandSeriesAllowed(brandId,family){
    if(!scopeEnforced())return true;
    const set=scopeSet();return set.has(brandAllKey(brandId))||set.has(keyOf(brandId,family));
  }
  function resolveBrandSeries(brandId='',family=''){
    const fam=upper(family);
    if(!scopeEnforced())return {brandId:norm(brandId),family:fam};
    const keys=scopeKeys();
    const exact=keyOf(brandId,fam),all=brandAllKey(brandId);
    if(norm(brandId)&&fam&&(keys.includes(exact)||keys.includes(all)))return {brandId:norm(brandId),family:fam};
    let hit=keys.find(k=>upper(k.split('|')[1])!=='*'&&(!fam||upper(k.split('|')[1])===fam));
    if(hit){const [id,f]=hit.split('|');return {brandId:norm(id),family:upper(f)}}
    hit=keys.find(k=>upper(k.split('|')[1])==='*');if(!hit)return null;
    const id=norm(hit.split('|')[0]),families=allowedFamilies(),resolvedFamily=fam&&families.includes(fam)?fam:(families[0]||fam||FAMILIES[0]);return {brandId:id,family:resolvedFamily};
  }
  function filterBrandSeriesEntries(entries=[]){
    if(!scopeEnforced())return Array.isArray(entries)?entries:[];
    return (Array.isArray(entries)?entries:[]).filter(entry=>isBrandSeriesAllowed(entry?.brand?.id??entry?.brandId,entry?.family));
  }
  function canOpenPage(id){
    if(Object.prototype.hasOwnProperty.call(SELECTOR_PAGE_FAMILY,id)){
      const bridge=window.__KEYSUITE_QUICK_SELECTION_OPENING__,family=SELECTOR_PAGE_FAMILY[id],quickBridge=can('use_quick_selection')&&bridge&&Number(bridge.expires||0)>=Date.now()&&upper(bridge.family)===family;
      if(!can('use_selector')&&!quickBridge)return false;
      return !scopeEnforced()||allowedFamilies().includes(family);
    }
    if(Object.prototype.hasOwnProperty.call(PRODUCT_PAGE_FAMILY,id)){
      if(!can('use_product'))return false;
      return !scopeEnforced()||allowedFamilies().includes(PRODUCT_PAGE_FAMILY[id]);
    }
    if(Object.prototype.hasOwnProperty.call(KEYLARGO_PRODUCT_PAGE_FAMILY,id)){
      if(!can('use_product'))return false;
      if(!scopeEnforced())return true;
      const brandId=keylargoBrandId(),family=KEYLARGO_PRODUCT_PAGE_FAMILY[id];
      return !!brandId&&isBrandSeriesAllowed(brandId,family);
    }
    if(Object.prototype.hasOwnProperty.call(GWS_PRODUCT_PAGE_FAMILY,id)){
      if(!can('use_product'))return false;
      if(!scopeEnforced())return true;
      return isBrandSeriesAllowed(gwsBrandId(),GWS_PRODUCT_PAGE_FAMILY[id]);
    }
    if(HOUSE_PRODUCT_PAGES.has(id))return can('use_product');
    if(MOTOR_PRODUCT_PAGES.has(id)){
      if(!can('use_product'))return false;
      if(!scopeEnforced())return true;
      return scopeKeys().some(k=>upper(k.split('|')[1])==='MOTOR'||upper(k.split('|')[1])==='*');
    }
    if(OTHER_PRODUCT_PAGES.has(id))return can('use_product');
    if(id==='keyAiSettings')return can('keyai_access');
    return true;
  }
  function setDisplay(selector,show,display=''){
    document.querySelectorAll(selector).forEach(el=>{el.style.display=show?display:'none'});
  }
  function applyVisibility(){
    try{
      const selectorGroup=document.querySelector('.nav-group[data-nav-group="selectorMenu"]');
      const productGroup=document.querySelector('.nav-group[data-nav-group="productMenu"]');
      const selectorVisible=can('use_selector')&&(!scopeEnforced()||allowedFamilies().length>0);
      const productVisible=can('use_product');
      if(selectorGroup)selectorGroup.style.display=selectorVisible?'':'none';
      if(productGroup)productGroup.style.display=productVisible?'':'none';
      setDisplay('nav button[data-page="keyLab"]',can('use_product'),'block');
      Object.entries(SELECTOR_PAGE_FAMILY).forEach(([page,fam])=>setDisplay(`.nav-group[data-nav-group="selectorMenu"] button[data-page="${page}"]`,can('use_selector')&&(!scopeEnforced()||allowedFamilies().includes(fam)),'block'));

      setDisplay('#dashboard .start-customer-row-v31',can('view_customers'));
      const quick=document.getElementById('ksDashboardDutyFinder');if(quick)quick.style.display=can('use_quick_selection')?'':'none';
      const pref=document.getElementById('ks39442Pref');if(pref)pref.style.display=can('use_quick_selection')?'':'none';
      document.documentElement.classList.toggle('keysuite-brand-series-locked',brandSeriesLocked());
      setDisplay('.v3964-customer-pref',can('edit_customers'));
      setDisplay('[data-assembly-open]',can('create_quotations'));
      setDisplay('nav button[data-page="keyAiSettings"]',can('keyai_access'),'block');
      const recentAllowed=can('view_quotations');const recentButton=document.getElementById('dashboardRecentQuotesButton');if(recentButton)recentButton.style.display=recentAllowed?'':'none';const recentDialog=document.getElementById('recentQuotesDialog');if(recentDialog&&!recentAllowed&&recentDialog.open)recentDialog.close();
      const active=document.querySelector('.page.active');if(active&&!canOpenPage(active.id))window.KeySuiteApp?.showPage?.('dashboard');
    }catch(error){console.warn('[KeySuite V4.05.17] authority visibility:',error)}
  }
  function dispatch(){
    applyVisibility();
    try{window.dispatchEvent(new CustomEvent('KEYSUITE_AUTHORITY_CHANGED',{detail:{version:VERSION,role:role(),scope:normalizeScope(state.scope),locked:brandSeriesLocked()}}))}catch(_){}
  }
  async function loadScope(){
    state.loadError='';
    const db=window.KeySuiteAuth?.getClient?.();
    if(!db){state.scope={keys:[]};state.loaded=false;return state.scope}
    try{
      const {data,error}=await db.rpc('keysuite_get_my_selection_scope_v41706');if(error)throw error;
      state.scope=normalizeScope(data);state.loaded=true;return state.scope;
    }catch(error){
      state.scope={keys:[]};state.loaded=false;state.loadError=String(error?.message||error||'Selection authority unavailable');
      console.warn('[KeySuite V4.17.06] selection scope could not be loaded:',error);
      return state.scope;
    }
  }
  async function init(access=null){state.access=access||window.KEYSUITE_ACCESS||state.access;await loadScope();dispatch();return snapshot()}
  function setAccess(access=null){state.access=access||state.access;dispatch()}
  function reset(){state.access=null;state.scope={keys:[]};state.loaded=false;state.loadError='';applyVisibility()}
  function setScope(scope){state.scope=normalizeScope(scope);state.loaded=true;dispatch()}
  function snapshot(){return {version:VERSION,role:role(),permissions:{use_quick_selection:level('use_quick_selection'),use_selector:level('use_selector'),use_product:level('use_product'),choose_brand_series:level('choose_brand_series')},scope:normalizeScope(state.scope),locked:brandSeriesLocked(),scopeEnforced:scopeEnforced(),loaded:state.loaded,loadError:state.loadError}}

  window.addEventListener('keysuite-permissions-changed',()=>dispatch());
  window.addEventListener('KEYSUITE_BRANDS_READY',()=>applyVisibility());
  window.addEventListener('pageshow',()=>applyVisibility());
  document.addEventListener('DOMContentLoaded',()=>applyVisibility(),{once:true});

  window.KeySuiteAuthority={version:VERSION,state,init,setAccess,reset,setScope,loadScope,snapshot,level,can,brandSeriesLocked,scopeEnforced,scopeKeys,allowedFamilies,allowedBrandIds,isBrandAllowed,isBrandSeriesAllowed,resolveBrandSeries,filterBrandSeriesEntries,canOpenPage,applyVisibility,keyOf};
})();
