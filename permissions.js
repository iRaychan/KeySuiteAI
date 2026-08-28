(() => {
  'use strict';
  const BASE_ROLES=['viewer','dealer','user','admin','owner'];
  const DEFAULTS={
    viewer:{key_dashboard:'none',keyai_access:'none',keyai_openai_control:'none',keyai_sender_assign:'none',manage_roles:'none',customer_settings:'none',company_pricing:'none',manage_categories:'none',manage_price_list:'none',change_fuel_price:'none',use_quick_selection:'full',use_selector:'full',use_product:'full',choose_brand_series:'full',view_customers:'assigned',edit_customers:'none',customer_assignment:'none',create_quotations:'none',view_quotations:'assigned',own_profile:'full'},
    dealer:{key_dashboard:'none',keyai_access:'none',keyai_openai_control:'none',keyai_sender_assign:'none',manage_roles:'none',customer_settings:'none',company_pricing:'none',manage_categories:'none',manage_price_list:'none',change_fuel_price:'none',use_quick_selection:'full',use_selector:'full',use_product:'full',choose_brand_series:'full',view_customers:'own',edit_customers:'own',customer_assignment:'none',create_quotations:'full',view_quotations:'own',own_profile:'full'},
    user:{key_dashboard:'none',keyai_access:'none',keyai_openai_control:'none',keyai_sender_assign:'none',manage_roles:'none',customer_settings:'none',company_pricing:'none',manage_categories:'none',manage_price_list:'none',change_fuel_price:'none',use_quick_selection:'full',use_selector:'full',use_product:'full',choose_brand_series:'full',view_customers:'assigned',edit_customers:'assigned',customer_assignment:'none',create_quotations:'full',view_quotations:'assigned',own_profile:'full'},
    admin:{key_dashboard:'none',keyai_access:'none',keyai_openai_control:'none',keyai_sender_assign:'none',manage_roles:'none',customer_settings:'none',company_pricing:'none',manage_categories:'none',manage_price_list:'none',change_fuel_price:'none',use_quick_selection:'full',use_selector:'full',use_product:'full',choose_brand_series:'full',view_customers:'all',edit_customers:'all',customer_assignment:'full',create_quotations:'full',view_quotations:'all',own_profile:'full'},
    owner:{key_dashboard:'full',keyai_access:'full',keyai_openai_control:'full',keyai_sender_assign:'full',manage_roles:'full',customer_settings:'full',company_pricing:'full',manage_categories:'full',manage_price_list:'full',change_fuel_price:'full',use_quick_selection:'full',use_selector:'full',use_product:'full',choose_brand_series:'full',view_customers:'all',edit_customers:'all',customer_assignment:'full',create_quotations:'full',view_quotations:'all',own_profile:'full'}
  };
  let matrix=structuredClone(DEFAULTS),roles=[...BASE_ROLES];
  const normalize=value=>String(value||'none').trim().toLowerCase();
  const validRole=value=>normalize(value).replace(/\s+/g,'_').replace(/[^a-z0-9_-]/g,'').slice(0,40);
  function refreshRoles(found=[]){
    const custom=[...new Set(found.map(validRole).filter(Boolean).filter(role=>!BASE_ROLES.includes(role)))].sort((a,b)=>a.localeCompare(b));
    roles=[...BASE_ROLES.filter(role=>role!=='owner'),...custom,'owner'];
    if(api)api.ROLES=[...roles];
  }
  function merge(next){
    const merged=structuredClone(DEFAULTS),found=[];
    if(Array.isArray(next)){
      next.forEach(row=>{
        const role=validRole(row?.role);if(!role)return;found.push(role);
        let permissions=row.permissions||{};if(typeof permissions==='string'){try{permissions=JSON.parse(permissions)}catch(_){permissions={}}}
        merged[role]={...(DEFAULTS[role]||DEFAULTS.user),...permissions};
      });
    }else if(next&&typeof next==='object'){
      Object.entries(next).forEach(([rawRole,permissions])=>{
        const role=validRole(rawRole);if(!role)return;found.push(role);merged[role]={...(DEFAULTS[role]||DEFAULTS.user),...(permissions||{})};
      });
    }
    BASE_ROLES.forEach(role=>{if(!merged[role])merged[role]=structuredClone(DEFAULTS[role])});
    matrix=merged;refreshRoles([...BASE_ROLES,...found]);
    window.KEYSUITE_ROLE_PERMISSIONS=structuredClone(matrix);
    window.dispatchEvent(new CustomEvent('keysuite-permissions-changed',{detail:{matrix:structuredClone(matrix),roles:[...roles]}}));
    return matrix;
  }
  function currentRole(){return validRole(window.KEYSUITE_ACCESS?.role||window.KEYSUITE_PROFILE?.role||'viewer')||'viewer'}
  function level(key,role=currentRole()){const r=validRole(role)||'viewer';return normalize(matrix[r]?.[key]??DEFAULTS[r]?.[key]??'none')}
  function can(key,role=currentRole()){return level(key,role)!=='none'}
  function atLeast(key,accepted,role=currentRole()){const allowed=Array.isArray(accepted)?accepted:[accepted];return allowed.map(normalize).includes(level(key,role))}
  function snapshot(){return structuredClone(matrix)}
  const api={ROLES:[...roles],BASE_ROLES:[...BASE_ROLES],DEFAULTS,merge,setMatrix:merge,currentRole,level,can,atLeast,snapshot,validRole};
  window.KeySuitePermissions=api;
})();
