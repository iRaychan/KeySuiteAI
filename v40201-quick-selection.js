/* KeySuite V4.17.04 — Quick Pump Selection account-scope + customer Price-gated Brand / Series.
   Preserves the user-entered Quick Selection flow/head units into the selected-model view and PDF.
   Hydraulic selection remains in m³/hr and metres. */
(() => {
'use strict';
if(window.top!==window.self||window.__KEYSUITE_V40201_QUICK_SELECTION__)return;
window.__KEYSUITE_V40201_QUICK_SELECTION__=true;

const $=id=>document.getElementById(id),norm=v=>String(v??'').trim(),upper=v=>norm(v).toUpperCase();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=()=>window.KeySuiteV394410||window.KeySuiteV39449||window.KeySuiteV39447||window.KeySuiteV39446||window.KeySuiteV39445||window.KeySuiteV39444||window.KeySuiteV3944||window.KeySuiteV3943||window.KeySuiteV3942||window.KeySuiteV3941||window.KeySuiteV391||null;
const authority=()=>window.KeySuiteAuthority||null;
const canQuick=()=>authority()?.can?.('use_quick_selection')??true;
const locked=()=>authority()?.brandSeriesLocked?.()??false;
const currentRole=()=>norm(authority()?.state?.access?.role||window.KEYSUITE_ACCESS?.role||window.KEYSUITE_PROFILE?.role||'viewer').toLowerCase();
const isOwnerAccount=()=>currentRole()==='owner';
const accountScopeReady=()=>isOwnerAccount()||authority()?.state?.loaded===true;
const accountScopeKeys=()=>isOwnerAccount()?[]:(authority()?.scopeKeys?.()||[]).map(String);
const accountAllows=(brandId,family)=>{
  if(isOwnerAccount())return true;
  const a=authority();if(!a?.state?.loaded)return false;
  const set=new Set(accountScopeKeys()),bid=String(brandId||''),fam=upper(family);
  return set.has(`${bid}|*`)||set.has(`${bid}|${fam}`);
};
const DEFAULT_CHC_MATERIAL='SS304 (Cast Iron Connection)';
const FAMILIES=['CHC','ES'];
const normalizeGroup=v=>upper(v).replace(/\s+/g,'_');
const hydraulicFamily=v=>{const g=normalizeGroup(v);return g==='CHC'||g==='CHC_G2'?'CHC':g==='ES'?'ES':''};
const state={requestId:0,pending:null,results:{},responded:{},savedKeys:new Set(),prefLoaded:false,queue:[],currentFamily:null,familyTimer:null,preferenceLoading:false,customerPriceLoading:false,customerPriceError:'',customerPriceErrorCid:'',enhancedCHC:false};
const isKeylargo=b=>norm(b?.brand_key).toLowerCase()==='keylargo';
const isMaster=b=>String(b?.brand_type||'').toLowerCase()==='master'||norm(b?.brand_key).toLowerCase()==='b.g.reich'||norm(b?.brand_name).toLowerCase()==='b.g.reich';
const brands=()=>((api()?.state?.brands)||[]).filter(b=>b&&b.active!==false&&!isKeylargo(b));
const visibleBrands=()=>{
  const all=brands();
  if(isOwnerAccount())return all;
  if(!accountScopeReady())return [];
  return all.filter(b=>FAMILIES.some(f=>accountAllows(b.id,f)));
};
const mappings=()=>((api()?.state?.mappings)||[]).filter(m=>m&&m.active!==false);
const masterSeries=()=> 'CHC';
function mapFor(brandId,family,series='',productGroup=''){
  const group=normalizeGroup(productGroup||family),fam=upper(family);
  let rows=mappings().filter(m=>String(m.brand_id)===String(brandId)&&normalizeGroup(m.master_family)===group);
  if(!rows.length&&group!==fam)rows=mappings().filter(m=>String(m.brand_id)===String(brandId)&&normalizeGroup(m.master_family)===fam);
  return rows.find(m=>upper(m.master_series)===upper(series))||rows[0]||null
}
function seriesFor(brand,family,productGroup=''){if(family==='CHC'){const ms='CHC';if(isMaster(brand))return ms;const m=mapFor(brand.id,family,ms,productGroup);return norm(m?.selling_series)||norm(m?.master_series)||ms}if(isMaster(brand))return family;const m=mapFor(brand.id,family,family,productGroup);return norm(m?.selling_series)||norm(m?.master_series)||family}
function brandSeriesFor(brand,family,productGroup=''){const group=normalizeGroup(productGroup||family);return norm(api()?.brandSeriesFor?.(brand,group))||norm(api()?.brandContext?.(brand?.id,family,'',group)?.brandSeries)||seriesFor(brand,family,group)}
const keyOf=(brandId,family)=>`${brandId}|${upper(family)}`;
function entries(){
  const out=[];
  brands().forEach(b=>{
    if(isMaster(b)){
      out.push({brand:b,family:'CHC',productGroup:'CHC_G2',key:keyOf(b.id,'CHC')});
      out.push({brand:b,family:'ES',productGroup:'ES',key:keyOf(b.id,'ES')});
      return;
    }
    const groups=mappings().filter(m=>String(m.brand_id)===String(b.id)).map(m=>normalizeGroup(m.master_family));
    // Old CHC is CHC G2. CHC G1 stays out until a real G1 hydraulic curve exists.
    if(groups.includes('CHC_G2')||groups.includes('CHC'))out.push({brand:b,family:'CHC',productGroup:'CHC_G2',key:keyOf(b.id,'CHC')});
    if(groups.includes('ES'))out.push({brand:b,family:'ES',productGroup:'ES',key:keyOf(b.id,'ES')});
  });
  if(isOwnerAccount())return out;
  if(!accountScopeReady())return [];
  return out.filter(e=>accountAllows(e.brand.id,e.family));
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
const customerPrefApi=()=>window.KeySuiteV40001CustomerBrandSettings||window.KeySuiteV3964CustomerBrandSettings||null;
function customerPriceScope(){
  const pref=customerPrefApi(),cid=String(pref?.currentDashboardCustomerId?.()||$('startCustomer')?.value||'');
  if(!pref)return {cid:'',ready:false,entries:[],error:''};
  if(!cid){
    state.customerPriceError='';state.customerPriceErrorCid='';
    return {cid:'',ready:true,entries:[],error:''};
  }

  // Customer changed: discard an error belonging to the previous customer.
  if(state.customerPriceErrorCid&&state.customerPriceErrorCid!==cid){
    state.customerPriceError='';state.customerPriceErrorCid='';
  }

  let pending=false;
  const allowed=entries().filter(e=>{
    const ok=pref.isPriceAllowed?.(e.brand.id,e.productGroup||e.family,cid);
    if(ok==null)pending=true;
    return ok===true;
  });

  // V4.17.04: if the central Supabase read already failed, stop retrying.
  // V4.17.03 would call loadPreference() again on every render. Because the
  // failed preference remained cached, each retry resolved immediately and
  // triggered another render, creating a tight Promise/render loop that froze
  // the Quick Selection page after a customer was selected.
  if(state.customerPriceErrorCid===cid&&state.customerPriceError){
    return {cid,ready:true,entries:allowed,error:state.customerPriceError};
  }

  if(pending&&!state.customerPriceLoading){
    state.customerPriceLoading=true;
    Promise.resolve(pref.loadPreference?.(cid))
      .then(loaded=>{
        const error=norm(loaded?._readError);
        if(error){
          state.customerPriceErrorCid=cid;
          state.customerPriceError=error;
        }else if(state.customerPriceErrorCid===cid){
          state.customerPriceErrorCid='';
          state.customerPriceError='';
        }
      })
      .catch(error=>{
        state.customerPriceErrorCid=cid;
        state.customerPriceError=norm(error?.message||error||'Customer Price Preference could not be loaded.');
      })
      .finally(()=>{
        state.customerPriceLoading=false;
        renderPreference();
        renderResults(true);
      });
  }
  return {cid,ready:!pending,entries:allowed,error:''};
}
const selectedEntries=()=>customerPriceScope().entries.filter(e=>state.savedKeys.has(e.key));
const selectedFamilies=()=>[...new Set(selectedEntries().map(e=>e.family))];
function aliasModel(model,e){const raw=norm(model),series=seriesFor(e.brand,e.family);if(!raw)return raw;if(e.family==='CHC')return raw.replace(/^(?:CHCS|CHCN|CHC)\b/i,series);if(e.family==='ES'&&!isMaster(e.brand)&&series!=='ES')return raw.replace(/^ES\b/i,series);return raw}
function enhancedAliasModel(model,e,enhanced){const shown=aliasModel(model,e);return enhanced&&shown&&!/E$/i.test(shown)?shown+'E':shown}
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
const kw=v=>{const x=n(v);if(x==null)return '—';const d=x>=10?1:2;return `${Number(x.toFixed(d))}kW`};
const pole=v=>{let x=n(v);if(x==null)return '—';x=Math.round(x);return `${x}Pole`};
const poleFrom=data=>{const p=n(data?.pole);if(p!=null)return pole(p);const r=n(data?.speed_rpm);if(r==null)return '—';return r>=2200?'2Pole':r>=1100?'4Pole':r>=700?'6Pole':r>=500?'8Pole':'—'};
const effClass=(data,fallback='IE3')=>norm(data?.motor_efficiency_class||data?.efficiency_class||fallback||'IE3').toUpperCase();
const flowToM3h=(v,u)=>{v=Number(v);return u==='usgpm'?v*.227124707:u==='igpm'?v*.2727654:u==='lps'?v*3.6:u==='lpm'?v*.06:v};
const headToM=(v,u)=>{v=Number(v);return u==='bar'?v*10.19716213:u==='kpa'?v*.1019716213:u==='psi'?v*.703249615:u==='ft'?v*.3048:v};

function style(){if($('ksV39444QuickStyle'))return;const s=document.createElement('style');s.id='ksV39444QuickStyle';s.textContent=`
#ksDutyProducts,#ksDutyBodies,#ks3944Material,#ksDashMaterial,.ks3944-material{display:none!important}
.ks405-quick-enhanced-inline{display:inline-flex;align-items:center;gap:7px;margin-left:7px;padding-left:8px;border-left:1px solid #c7d7e5;color:#075d91;font-size:12px;font-weight:400;line-height:1.2;cursor:pointer;white-space:nowrap}.ks405-quick-enhanced-inline input{width:auto!important;min-height:0!important;margin:0!important;accent-color:#1264a3}.ks405-quick-family-line{display:flex;align-items:center;gap:12px;margin-top:8px;font-size:12px;font-weight:400;line-height:1.2;color:#17365d}.ks405-quick-family-line>span{font:inherit}.ks405-quick-family-line .ks405-quick-enhanced-inline{margin-left:0;padding-left:0;border-left:0;color:inherit;font:inherit}.ks405-enhanced-tag{display:inline-block;margin-left:6px;padding:2px 6px;border:1px solid #9dc4e3;border-radius:999px;background:#eef7ff;color:#075d91;font-size:9px;font-weight:900;vertical-align:middle}
.ks39442-pref{margin-top:10px;border:1px solid #dbe4ed;border-radius:10px;background:#f8fbff;overflow:hidden}.ks39442-pref summary{cursor:pointer;padding:10px 12px;font-weight:800;color:#17365d}.ks39442-pref-body{padding:0 12px 12px}.ks39442-pref-actions{display:flex;gap:7px;flex-wrap:wrap;margin:8px 0}.ks39442-pref-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}.ks39442-pref-brand{border:1px solid #dbe4ed;border-radius:8px;background:#fff;padding:8px}.ks39442-pref-brand b{display:block;margin-bottom:5px}.ks41501-role-authorized{display:inline-block;font-size:9px;font-weight:800;color:#2d6a4f;margin-bottom:5px}.ks41501-no-series{font-size:11px;color:#64748b;margin-top:5px}.ks39442-check{display:flex;align-items:center;gap:14px;font-size:12px;line-height:1.2;margin:5px 0}.ks39442-check-label{display:inline-flex!important;align-items:center!important;gap:7px!important;margin:0!important;padding:0!important;border:0!important;color:inherit!important;font:inherit!important;line-height:1.2!important;white-space:nowrap;cursor:pointer}.ks39442-check-label input,.ks39442-check input{width:auto!important;min-height:0!important;margin:0!important;pointer-events:auto!important;vertical-align:middle}.ks39442-check .ks405-quick-enhanced-inline{margin:0!important;padding:0!important;border-left:0!important;color:inherit!important;font:inherit!important;line-height:1.2!important}.ks39444-brand-state{grid-column:1/-1;border:1px solid #dbe4ed;border-radius:8px;background:#fff;padding:10px}.ks39444-brand-state.error{border-color:#efb3b3;background:#fff5f5;color:#8f1d1d}.ks39444-brand-state .btn{margin-top:8px;padding:7px 10px}
#ksV39442Results{margin-top:12px}.ks39442-series{margin-top:10px;border:1px solid #dbe4ed;border-radius:10px;background:#fbfdff;overflow:hidden}.ks39442-series-head{width:100%;border:0;background:#17365d;color:#fff;padding:9px 12px;text-align:left;font-weight:800;cursor:pointer}.ks39442-series-body{padding:10px}.ks39442-section{font-size:10px;font-weight:800;text-transform:uppercase;color:#64748b;margin:4px 0 6px}.ks39442-columns,.ks39442-model{display:grid;grid-template-columns:minmax(210px,1fr) 88px 78px 72px;gap:10px;align-items:center}.ks39442-columns{padding:0 14px 5px;color:#64748b;font-size:10px;font-weight:800;text-transform:uppercase}.ks39442-columns span:not(:first-child){text-align:center}.ks39442-model{width:100%;border:1px solid #2f75b5;background:#fff;color:#17365d;border-radius:8px;padding:9px 14px;font-weight:800;cursor:pointer;text-align:left;margin-bottom:6px}.ks39442-model:hover{background:#eef6ff}.ks39442-model-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ks39442-value{text-align:center;font-size:12px;color:#17365d;white-space:nowrap;font-weight:800}
@media(max-width:800px){.ks39442-columns,.ks39442-model{grid-template-columns:minmax(132px,1fr) 68px 62px 56px;gap:5px}.ks39442-value{font-size:11px}}
`;document.head.appendChild(s)}

function removeMaterialControls(){const box=$('ksDashboardDutyFinder');if(!box)return;['ks3944Material','ksDashMaterial'].forEach(id=>{const el=$(id);if(!el)return;const wrap=el.closest?.('.ks3944-material,.ks-duty-row');if(wrap&&box.contains(wrap))wrap.remove();else el.remove()});box.querySelectorAll('.ks3944-material').forEach(x=>x.remove());box.querySelectorAll('label').forEach(label=>{if(!/^\s*(?:CHC\s+)?Material\s*$/i.test(label.textContent||''))return;const wrap=label.closest('.ks-duty-row')||label.parentElement;if(wrap&&box.contains(wrap)&&wrap!==box)wrap.remove()})}
async function userId(){try{return (await window.KeySuiteAuth?.getClient?.()?.auth?.getUser?.())?.data?.user?.id||''}catch(_){return ''}}
const prefLocalKey=uid=>`keysuite-v39442-quick-pref-${uid||'local'}`;
const legacyPrefLocalKey=uid=>`keysuite-v3944-quick-pref-${uid||'local'}`;
async function loadPreference(){
  if(state.preferenceLoading)return;
  if(!accountScopeReady()&&!isOwnerAccount()){renderPreference();return}
  const all=entries();
  if(!all.length){state.savedKeys=new Set();state.prefLoaded=true;renderPreference();renderResults(true);return}
  state.preferenceLoading=true;
  try{
    const uid=await userId();let payload=null,found=false;
    // Local is read first so a just-saved preference (including an intentional empty set)
    // cannot be replaced by an older cloud value when cloud sync is unavailable/stale.
    try{
      const raw=localStorage.getItem(prefLocalKey(uid));
      const legacy=raw==null?localStorage.getItem(legacyPrefLocalKey(uid)):null;
      if(raw!=null||legacy!=null){payload=JSON.parse(raw??legacy);found=true}
    }catch(_){}
    if(!found){
      try{
        const c=window.KeySuiteAuth?.getClient?.();
        if(c&&uid){const {data,error}=await c.from('ks_user_quick_selection_preferences').select('selection').eq('user_id',uid).maybeSingle();if(error)throw error;if(data&&Object.prototype.hasOwnProperty.call(data,'selection')){payload=data.selection;found=true}}
      }catch(err){console.warn('Quick Selection cloud preference read unavailable:',err)}
    }
    let keys=[];
    if(Array.isArray(payload))keys=payload.map(k=>String(k).split('|').slice(0,2).join('|'));
    else if(payload&&typeof payload==='object')keys=Array.isArray(payload.keys)?payload.keys:[];
    if(!found)keys=all.map(e=>e.key);
    const valid=new Set(all.map(e=>e.key));
    state.savedKeys=new Set(keys.map(String).filter(k=>valid.has(k)));
    state.prefLoaded=true;renderPreference();renderResults(true);
  }finally{state.preferenceLoading=false}
}
async function savePreference(){
  syncChecks();
  const uid=await userId(),payload={keys:[...state.savedKeys],saved_at:new Date().toISOString()};
  let localOk=true,cloudOk=false,cloudError=null;
  try{localStorage.setItem(prefLocalKey(uid),JSON.stringify(payload))}catch(err){localOk=false;console.warn('Quick Selection local preference save failed:',err)}
  try{
    const c=window.KeySuiteAuth?.getClient?.();
    if(c&&uid){
      const cid=window.KEYSUITE_PROFILE?.company_id||window.KEYSUITE_ACCESS?.company_id||api()?.state?.brands?.[0]?.company_id||window.KEYSUITE_COMPANY_ID||null;
      const {error}=await c.from('ks_user_quick_selection_preferences').upsert({user_id:uid,company_id:cid,selection:payload,updated_at:new Date().toISOString()},{onConflict:'user_id'});
      if(error)throw error;cloudOk=true;
    }
  }catch(err){cloudError=err;console.warn('Quick Selection preference cloud sync unavailable:',err)}
  renderPreference();renderResults(true);
  const st=$('ksDutyStatus');
  if(st)st.textContent=cloudOk?'Quick Selection Brand / Series preference saved.':localOk?'Quick Selection preference saved on this device. Cloud sync is unavailable.':`Quick Selection preference could not be saved${cloudError?.message?`: ${cloudError.message}`:''}.`;
}
function syncChecks(){
  const boxes=[...document.querySelectorAll('#ks39442PrefGrid input[data-pref-key]')];
  const editable=new Set(boxes.map(x=>String(x.dataset.prefKey||'')));
  const next=new Set([...state.savedKeys].filter(k=>!editable.has(String(k))));
  boxes.filter(x=>x.checked).forEach(x=>next.add(String(x.dataset.prefKey||'')));
  const valid=new Set(entries().map(e=>String(e.key)));
  state.savedKeys=new Set([...next].filter(k=>valid.has(String(k))));
}

function ensureUi(){const box=$('ksDashboardDutyFinder');if(!box)return false;if(!canQuick()){box.style.display='none';return true}box.style.display='';removeMaterialControls();$('ks405QuickEnhanced')?.remove();$('ks405QuickEnhancedLocked')?.remove();let d=$('ks39442Pref');if(!d){d=document.createElement('details');d.id='ks39442Pref';d.className='ks39442-pref';d.open=false;d.dataset.ksInitialCollapsed='1';d.innerHTML='<summary>Brand / Series Settings</summary><div class="ks39442-pref-body"><div class="muted" style="font-size:11px;margin:2px 0 8px">Only Brand / Series with Price ticked for the selected customer are shown here. From those Price-enabled choices, select which ones Quick Selection should search. Role / Owner authorization still applies.</div><div class="ks39442-pref-actions"><button class="btn secondary" type="button" id="ks39442All">Select All Allowed</button><button class="btn secondary" type="button" id="ks39442None">Clear All</button><button class="btn" type="button" id="ks39442Save">Save Preference</button></div><div id="ks39442PrefGrid" class="ks39442-pref-grid"></div></div>';const actions=box.querySelector('.ks-duty-actions');box.insertBefore(d,actions||box.firstChild);$('ks39442All').onclick=()=>d.querySelectorAll('input[data-pref-key]').forEach(x=>x.checked=true);$('ks39442None').onclick=()=>d.querySelectorAll('input[data-pref-key]').forEach(x=>x.checked=false);$('ks39442Save').onclick=savePreference}
if(!d.dataset.ksInitialCollapsed){d.open=false;d.dataset.ksInitialCollapsed='1'}d.style.display='';
let r=$('ksV39442Results');if(!r){r=document.createElement('div');r.id='ksV39442Results';box.appendChild(r)}return true}
function renderBrandState(){if(!ensureUi())return;const grid=$('ks39442PrefGrid');if(!grid)return;const a=api(),error=norm(a?.state?.coreError);grid.innerHTML=`<div class="ks39444-brand-state ${error?'error':''}"><b>${error?'Brand data unavailable':'Loading Brand / Series settings…'}</b><div class="muted" style="margin-top:4px">${esc(error||'Waiting for secure Brand data.')}</div>${error?'<button class="btn secondary" type="button" id="ks39444RetryQuickBrands">Retry</button>':''}</div>`;$('ks39444RetryQuickBrands')?.addEventListener('click',async()=>{const btn=$('ks39444RetryQuickBrands');if(btn){btn.disabled=true;btn.textContent='Loading…'}await a?.loadData?.({force:true});if(api()?.state?.coreReady)loadPreference();else renderBrandState()})}
function renderPreference(){
  if(!ensureUi())return;
  const grid=$('ks39442PrefGrid');if(!grid)return;
  if(!api()?.state?.coreReady){renderBrandState();return}
  grid.innerHTML='';
  if(!accountScopeReady()&&!isOwnerAccount()){
    grid.innerHTML='<div class="ks39444-brand-state"><b>Loading account Brand / Series permissions…</b><div class="muted" style="margin-top:4px">Quick Selection waits for the Brand / Series assigned to this user account before showing any choices.</div></div>';
    return;
  }
  const roleVisible=visibleBrands();
  if(!roleVisible.length){
    grid.innerHTML='<div class="ks39444-brand-state"><b>No Brand / Series is assigned to this account.</b><div class="muted" style="margin-top:4px">Ask the Owner to assign the required Brand / Series under Key → Role → Brand Assigned.</div></div>';
    return;
  }
  const scope=customerPriceScope();
  if(!scope.cid){
    grid.innerHTML='<div class="ks39444-brand-state"><b>Select a customer first.</b><div class="muted" style="margin-top:4px">Quick Selection only shows Brand / Series whose Price is ticked for the selected customer under Key → Customer.</div></div>';
    return;
  }
  if(scope.error){
    grid.innerHTML=`<div class="ks39444-brand-state error"><b>Customer Price Preference could not be loaded.</b><div class="muted" style="margin-top:4px">${esc(scope.error)}</div><button class="btn secondary" type="button" id="ks41704RetryCustomerPrice">Retry</button></div>`;
    $('ks41704RetryCustomerPrice')?.addEventListener('click',async()=>{
      const btn=$('ks41704RetryCustomerPrice');if(btn){btn.disabled=true;btn.textContent='Retrying…'}
      state.customerPriceError='';state.customerPriceErrorCid='';state.customerPriceLoading=true;
      try{
        const loaded=await customerPrefApi()?.loadPreference?.(scope.cid,{force:true});
        const error=norm(loaded?._readError);
        if(error){state.customerPriceErrorCid=scope.cid;state.customerPriceError=error}
      }catch(error){
        state.customerPriceErrorCid=scope.cid;
        state.customerPriceError=norm(error?.message||error||'Customer Price Preference could not be loaded.');
      }finally{
        state.customerPriceLoading=false;
        renderPreference();renderResults(true);
      }
    });
    return;
  }
  if(!scope.ready){
    grid.innerHTML='<div class="ks39444-brand-state"><b>Loading customer Price permissions…</b><div class="muted" style="margin-top:4px">Checking Key → Customer Brand / Series Price ticks.</div></div>';
    return;
  }
  const all=scope.entries,visible=roleVisible.filter(b=>all.some(e=>String(e.brand.id)===String(b.id)));
  if(!all.length){
    grid.innerHTML='<div class="ks39444-brand-state"><b>No Brand / Series Price is enabled for this customer.</b><div class="muted" style="margin-top:4px">Tick Price for the required Brand / Series under Key → Customer. Unticked series stay hidden from Quick Selection.</div></div>';
    return;
  }
  const enhancedAnchor=((all.find(e=>e.family==='CHC'&&isMaster(e.brand))||all.find(e=>e.family==='CHC'))?.key||'');
  visible.forEach(b=>{
    const mine=all.filter(e=>String(e.brand.id)===String(b.id)),card=document.createElement('div');
    card.className='ks39442-pref-brand';
    card.innerHTML=`<b>${esc(b.brand_name)}</b><span class="ks41501-role-authorized">Price Enabled</span>`;
    mine.forEach(e=>{
      const row=document.createElement('div');row.className='ks39442-check';
      const familyLabel=document.createElement('label');familyLabel.className='ks39442-check-label';
      familyLabel.innerHTML=`<input type="checkbox" data-pref-key="${esc(e.key)}" ${state.savedKeys.has(e.key)?'checked':''}><span>${esc(brandSeriesFor(b,e.family,e.productGroup))}</span>`;
      row.appendChild(familyLabel);
      if(e.family==='CHC'&&e.key===enhancedAnchor){
        const enhancedLabel=document.createElement('label');enhancedLabel.className='ks39442-check-label ks405-quick-enhanced-inline';
        enhancedLabel.innerHTML=`<input id="ksQuickEnhanced" type="checkbox" ${state.enhancedCHC?'checked':''}><span>Enhanced</span>`;
        row.appendChild(enhancedLabel);
      }
      card.appendChild(row);
    });
    grid.appendChild(card);
  });
}

function frame(f){return $(f==='CHC'?'selectorFrame':'selectorEsFrame')}
function ensureFrame(f){const x=frame(f),src=f==='CHC'?'selector/index.html':'selector-es/index.html';if(x&&(!x.getAttribute('src')||x.getAttribute('src')==='about:blank'))x.src=x.dataset.src||src;return x}
function frameReady(x){try{return !!x?.contentWindow&&x.contentDocument?.readyState==='complete'}catch(_){return false}}
function waitFrameReady(f,requestId){return new Promise(resolve=>{const x=ensureFrame(f);if(!x){resolve(false);return}if(frameReady(x)){resolve(true);return}let done=false;const finish=v=>{if(done)return;done=true;x.removeEventListener('load',onload);clearTimeout(timer);resolve(v)};const onload=()=>finish(state.pending?.requestId===requestId);x.addEventListener('load',onload,{once:true});const timer=setTimeout(()=>finish(frameReady(x)&&state.pending?.requestId===requestId),4500)})}
function sendOnce(f,msg){const x=ensureFrame(f);try{x?.contentWindow?.postMessage(msg,'*');return true}catch(_){return false}}
function clearFamilyTimer(){if(state.familyTimer){clearTimeout(state.familyTimer);state.familyTimer=null}}
function cancelPending(){clearFamilyTimer();state.queue=[];state.currentFamily=null;state.pending=null}
async function processNext(requestId){if(state.pending?.requestId!==requestId)return;clearFamilyTimer();const f=state.queue.shift();if(!f){state.currentFamily=null;renderResults(true);return}state.currentFamily=f;const status=$('ksDutyStatus');if(status)status.textContent=`Checking ${f}…`;const ready=await waitFrameReady(f,requestId);if(state.pending?.requestId!==requestId)return;if(!ready){state.responded[f]=true;state.results[f]={suitable:false,data:null,error:'Selector unavailable'};processNext(requestId);return}const req=state.pending;const sent=sendOnce(f,{type:'KEYSUITE_DASHBOARD_SELECT',requestId:req.requestId,flowM3h:req.flowM3h,headM:req.headM,rawFlow:req.rawFlow,rawHead:req.rawHead,rawFlowText:req.rawFlowText,rawHeadText:req.rawHeadText,flowUnit:req.flowUnit,headUnit:req.headUnit,quickSelection:true,enhanced:f==='CHC'&&!!req.enhancedCHC});if(!sent){state.responded[f]=true;state.results[f]={suitable:false,data:null,error:'Selector unavailable'};processNext(requestId);return}state.familyTimer=setTimeout(()=>{if(state.pending?.requestId!==requestId||state.currentFamily!==f)return;state.responded[f]=true;state.results[f]={suitable:false,data:null,error:'Selection timeout'};processNext(requestId)},6500)}
function runSelected(){if(!canQuick())return;if(!api()?.state?.coreReady){renderBrandState();const st=$('ksDutyStatus');if(st)st.textContent='Brand data must load before Quick Pump Selection.';return}if(!state.prefLoaded){loadPreference();return}syncChecks();const fams=selectedFamilies(),flow=$('ksDashFlow'),head=$('ksDashHead'),fu=$('ksDashFlowUnit'),hu=$('ksDashHeadUnit'),status=$('ksDutyStatus'),host=$('ksV39442Results');cancelPending();state.results={};state.responded={};if(host)host.innerHTML='';const q=flowToM3h(flow?.value,fu?.value||'m3h'),h=headToM(head?.value,hu?.value||'m');if(!(q>0&&h>0)){if(status)status.textContent='Enter Flow and Head.';return}if(!fams.length){if(status)status.textContent='Select at least one Brand / Series.';return}state.enhancedCHC=!!$('ksQuickEnhanced')?.checked;const req={requestId:944000000+(++state.requestId),flowM3h:q,headM:h,rawFlow:Number(flow?.value),rawHead:Number(head?.value),rawFlowText:String(flow?.value??'').trim(),rawHeadText:String(head?.value??'').trim(),flowUnit:fu?.value||'m3h',headUnit:hu?.value||'m',fams:[...fams],enhancedCHC:state.enhancedCHC};state.pending=req;state.queue=[...fams];if(status)status.textContent='Checking selected pump series…';processNext(req.requestId)}

function modelButton(e,data,defaultEff='IE3'){const b=document.createElement('button');b.type='button';b.className='ks39442-model';const enhanced=e.family==='CHC'&&!!data?.enhanced;b.innerHTML=`<span class="ks39442-model-name"><b>${esc(enhancedAliasModel(data?.model,e,enhanced))}</b>${enhanced?'<span class="ks405-enhanced-tag">Enhanced</span>':''}</span><span class="ks39442-value">${kw(data?.motor_kw)}</span><span class="ks39442-value">${poleFrom(data)}</span><span class="ks39442-value">${esc(effClass(data,defaultEff))}</span>`;b.onclick=()=>openCurve(e,data);return b}
function renderResults(final=false){const host=$('ksV39442Results'),status=$('ksDutyStatus');if(!host)return;host.innerHTML='';let shown=0;selectedEntries().forEach(e=>{const r=state.results[e.family];if(!r?.suitable||!r.data)return;shown++;const series=brandSeriesFor(e.brand,e.family,e.productGroup),isEnhanced=e.family==='CHC'&&!!r.data.enhanced,seriesLabel=`${e.brand.brand_name} · ${series}${isEnhanced?' · Enhanced':''}`,sec=document.createElement('section');sec.className='ks39442-series';sec.innerHTML=`<button class="ks39442-series-head" type="button">${esc(seriesLabel)} ▼</button><div class="ks39442-series-body"><div class="ks39442-columns"><span>Pump Model</span><span>Motor kW</span><span>Pole</span><span>Eff</span></div><div class="ks39442-section">Most Suitable</div><div class="ks39442-rec"></div><div class="ks39442-section">Alternative Models</div><div class="ks39442-alt"></div></div>`;const body=sec.querySelector('.ks39442-series-body'),head=sec.querySelector('.ks39442-series-head');head.onclick=()=>{body.hidden=!body.hidden;head.textContent=`${seriesLabel}${body.hidden?' ▸':' ▼'}`};const defaultEff=effClass(r.data,'IE3');sec.querySelector('.ks39442-rec').appendChild(modelButton(e,r.data,defaultEff));const alts=Array.isArray(r.data.alternatives)?r.data.alternatives:[];alts.forEach(a=>sec.querySelector('.ks39442-alt').appendChild(modelButton(e,a,defaultEff)));if(!alts.length)sec.querySelector('.ks39442-alt').innerHTML='<div class="muted" style="font-size:12px">No alternative model.</div>';host.appendChild(sec)});if(shown){if(status&&!state.currentFamily)status.textContent=`${shown} Brand / Series result${shown===1?'':'s'} available.`;return}const wait=state.pending&&state.queue.length+Number(!!state.currentFamily)>0;if(!final&&wait){if(status)status.textContent='Checking selected pump series…';return}if(status&&!state.currentFamily)status.textContent='No suitable model found for the selected Brand / Series.'}
function setDefaultChcPayload(fr){try{const w=fr?.contentWindow;w.keysuiteExportPayload={...(w.keysuiteExportPayload||{}),keysuite_material:DEFAULT_CHC_MATERIAL,keysuite_seal:'Car/Cer',keysuite_elastomer:'Viton',keysuite_connection:'round',keysuite_bare_shaft:false}}catch(_){}}
function presentationContext(e,data){
  const a=api(),family=upper(e?.family),group=normalizeGroup(e?.productGroup||family),base=a?.brandContext?.(e?.brand?.id,family,'',group)||{};
  const selling=seriesFor(e.brand,family,group),brandSeries=brandSeriesFor(e.brand,family,group),master=family==='CHC'?'CHC':(norm(base.masterSeries)||family),masterModel=norm(data?.model),isEnhanced=family==='CHC'&&!!data?.enhanced,displayModel=enhancedAliasModel(masterModel,e,isEnhanced);
  return {...base,id:String(e.brand.id),name:norm(e.brand.brand_name)||norm(base.name),key:norm(e.brand.brand_key)||norm(base.key),logo:norm(e.brand.logo_data)||norm(base.logo),countryOfOrigin:norm(e.brand.country_of_origin)||norm(base.countryOfOrigin),family,brandSeries,sellingSeries:selling,masterSeries:master,material:family==='CHC'?DEFAULT_CHC_MATERIAL:norm(base.material),masterModel,displayModel,source:'quick-selection',pinned:true};
}
function pinFrameContext(fr,ctx){
  try{if(window.KeySuiteSelectorBrand?.pinContext?.(fr,ctx,{hideInnerActions:false}))return true}catch(_){}
  try{if(fr?.contentWindow){fr.contentWindow.__KEYSUITE_MODEL_PRESENTATION_CONTEXT={...ctx};fr.contentWindow.__KEYSUITE_HIDE_INNER_ACTIONS=false;return true}}catch(_){}
  return false;
}
async function openCurve(e,data){
  const req=state.pending;if(!req||!data)return;const page=e.family==='ES'?'selectorEs':'selector';
  try{api()?.setSelectedBrand?.(e.brand.id,e.family,page,e.productGroup||e.family)}catch(_){}
  if(e.family==='CHC'){const mat=$('pumpMaterial');if(mat){mat.value=DEFAULT_CHC_MATERIAL;mat.dispatchEvent(new Event('change',{bubbles:true}))}}
  const fr=ensureFrame(e.family),ready=await waitFrameReady(e.family,req.requestId);if(!ready)return;
  if(e.family==='CHC')setDefaultChcPayload(fr);
  const ctx=presentationContext(e,data);pinFrameContext(fr,ctx);
  try{window.KeySuiteSelectorBrand?.collapseSummaryForFrame?.(fr)}catch(_){}
  try{window.KeySuiteModelReturn?.markQuickSelection?.(e.family)}catch(_){}
  window.__KEYSUITE_PRESERVE_SELECTOR_BRAND_ONCE__={page,family:e.family,brandId:String(e.brand.id),context:ctx};
  window.__KEYSUITE_QUICK_SELECTION_OPENING__={family:e.family,expires:Date.now()+3000};
  const nav=document.querySelector(`button[data-page="${page}"]`);if(nav)nav.click();
  setTimeout(()=>{if(window.__KEYSUITE_QUICK_SELECTION_OPENING__?.family===e.family)delete window.__KEYSUITE_QUICK_SELECTION_OPENING__},3000);
  setTimeout(()=>{
    if(state.pending?.requestId!==req.requestId)return;
    try{if(window.__KEYSUITE_PRESERVE_SELECTOR_BRAND_ONCE__?.context===ctx)delete window.__KEYSUITE_PRESERVE_SELECTOR_BRAND_ONCE__}catch(_){}
    try{api()?.setSelectedBrand?.(e.brand.id,e.family,page,e.productGroup||e.family)}catch(_){}
    pinFrameContext(fr,ctx);if(e.family==='CHC')setDefaultChcPayload(fr);
    sendOnce(e.family,{type:'KEYSUITE_DASHBOARD_OPEN_MODEL',requestId:req.requestId,flowM3h:req.flowM3h,headM:req.headM,rawFlow:req.rawFlow,rawHead:req.rawHead,rawFlowText:req.rawFlowText,rawHeadText:req.rawHeadText,flowUnit:req.flowUnit,headUnit:req.headUnit,quickSelection:true,enhanced:e.family==='CHC'&&!!data.enhanced,model:data.model||''});
    setTimeout(()=>{if(state.pending?.requestId!==req.requestId)return;pinFrameContext(fr,ctx);try{window.KeySuiteSelectorBrand?.collapseSummaryForFrame?.(fr);window.KeySuiteSelectorBrand?.refresh?.(fr)}catch(_){}},100);
  },0);
}

function bind(){const box=$('ksDashboardDutyFinder');if(!box||box.dataset.v39444Bound)return false;box.dataset.v39444Bound='1';
  box.addEventListener('wheel',ev=>{const el=ev.target;if(!(el instanceof HTMLInputElement)||el.type!=='number')return;const key=[el.id,el.name,el.className,el.getAttribute('aria-label')].filter(Boolean).join(' ').toLowerCase();if(!/(?:flow|capacity|head|speed|frequency|\bhz\b|\brpm\b)/.test(key))return;if(document.activeElement===el)el.blur()},{capture:true,passive:true});
  // Capture phase blocks the V3.8.8 Quick Selection auto-schedule and button onclick. Only this V3.9.4.4.4 engine may run selection.
  box.addEventListener('click',ev=>{if(ev.target.closest('#ksDashSelect')){ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();runSelected()}},true);
  const changed=ev=>{if(!ev.target.matches('#ksDashFlow,#ksDashHead,#ksDashFlowUnit,#ksDashHeadUnit,#ksQuickEnhanced'))return;if(ev.target.id==='ksQuickEnhanced')state.enhancedCHC=!!ev.target.checked;ev.stopPropagation();ev.stopImmediatePropagation();cancelPending();const st=$('ksDutyStatus');if(st)st.textContent='Press Check Pumps to update results.'};
  box.addEventListener('input',changed,true);box.addEventListener('change',changed,true);return true}
function message(ev){const m=ev.data||{};if(m.type!=='KEYSUITE_DASHBOARD_RESULT'||m.requestId!==state.pending?.requestId||!FAMILIES.includes(upper(m.family)))return;const f=upper(m.family);if(f!==state.currentFamily)return;clearFamilyTimer();state.responded[f]=true;state.results[f]={suitable:!!m.suitable,data:m.data||null};state.currentFamily=null;renderResults(false);processNext(m.requestId)}
function mark(){document.title=document.title.replace(/V3\.9\.4(?:\.\d+)*|V3\.9\.3|V3\.9\.2|V3\.9\.1/g,'V3.9.4.4.11');document.querySelectorAll('.suite-version').forEach(n=>n.textContent='KeySuite V3.9.4.4.11')}
function setup(){style();mark();if(!ensureUi()||!bind())return false;removeMaterialControls();if(api()?.state?.coreReady){if(!state.prefLoaded)loadPreference();else{renderPreference();renderResults(true)}}else renderBrandState();return true}
window.addEventListener('message',message,true);
window.addEventListener('KEYSUITE_BRANDS_READY',()=>{state.prefLoaded=false;if(canQuick())loadPreference()});
window.addEventListener('KEYSUITE_AUTHORITY_CHANGED',()=>{state.prefLoaded=false;state.savedKeys=new Set();setup();if(canQuick()&&api()?.state?.coreReady)loadPreference()});
window.addEventListener('KEYSUITE_CUSTOMER_BRAND_PREFERENCE_CHANGED',event=>{
  const cid=String(event?.detail?.customerId||''),error=norm(event?.detail?.error);
  if(error){state.customerPriceErrorCid=cid;state.customerPriceError=error}
  else if(cid&&state.customerPriceErrorCid===cid){state.customerPriceErrorCid='';state.customerPriceError=''}
  if(canQuick()){renderPreference();renderResults(true)}
});
window.addEventListener('KEYSUITE_BRANDS_ERROR',()=>{state.prefLoaded=false;renderBrandState()});
window.addEventListener('KEYSUITE_V393_BRAND_CONTEXT_CHANGED',()=>{if(!api()?.state?.coreReady)return;if(!state.prefLoaded){loadPreference();return}const valid=new Set(entries().map(e=>e.key));state.savedKeys=new Set([...state.savedKeys].filter(k=>valid.has(k)));renderPreference();renderResults(true)});
window.KeySuiteV39442Dashboard={version:'4.17.04',runSelected,renderResults,renderPreference,loadPreference,masterSeries,seriesFor,brandSeriesFor,cancelPending,removeMaterialControls,presentationContext};
window.KeySuiteV3944Dashboard=window.KeySuiteV39442Dashboard;window.KeySuiteV39444Dashboard=window.KeySuiteV39442Dashboard;window.KeySuiteV39445Dashboard=window.KeySuiteV39442Dashboard;window.KeySuiteV39446Dashboard=window.KeySuiteV39442Dashboard;window.KeySuiteV39447Dashboard=window.KeySuiteV39442Dashboard;window.KeySuiteV39449Dashboard=window.KeySuiteV39442Dashboard;window.KeySuiteV394410Dashboard=window.KeySuiteV39442Dashboard;window.KeySuiteV40201Dashboard=window.KeySuiteV39442Dashboard;
let attempts=0;function boot(){attempts++;if(setup())return;if(attempts<40)setTimeout(boot,200)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
