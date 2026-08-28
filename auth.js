(() => {
  'use strict';
  const el=id=>document.getElementById(id);
  let client=null;
  let session=null;
  let access=null;
  let profile=null;
  let pendingSignatureData=null;
  let removeSignatureRequested=false;

  function initialAuthFlow(){
    try{
      const url=new URL(location.href);
      const explicit=String(url.searchParams.get('keysuite_auth')||'').toLowerCase();
      if(explicit==='invite'||explicit==='recovery')return explicit;
    }catch(_){}
    if(/(?:[?#&])type=recovery(?:&|$)/i.test(location.href)||/type=recovery/i.test(location.hash))return 'recovery';
    if(/(?:[?#&])type=invite(?:&|$)/i.test(location.href)||/type=invite/i.test(location.hash))return 'invite';
    return '';
  }
  let authFlowMode=initialAuthFlow();
  let inviteFlowPending=authFlowMode==='invite';
  let recoveryFlowPending=authFlowMode==='recovery';

  function authRedirectUrl(mode=''){
    const cfg=window.KEYSUITE_CONFIG||{};
    let base=String(cfg.authRedirectUrl||'').trim();
    if(!/^https:\/\//i.test(base)){
      base=(location.hostname==='localhost'||location.hostname==='127.0.0.1')
        ?'https://iraychan.github.io/KeySuite/'
        :`${location.origin}${location.pathname}`;
    }
    try{
      const url=new URL(base,location.href);
      if(mode)url.searchParams.set('keysuite_auth',mode);
      return url.toString();
    }catch(_){return base}
  }

  function clearAuthCallbackUrl(){
    try{
      const url=new URL(location.href);
      ['keysuite_auth','code','type'].forEach(key=>url.searchParams.delete(key));
      url.hash='';
      history.replaceState(null,'',`${url.pathname}${url.search}`);
    }catch(_){}
  }

  function configReady(){
    const cfg=window.KEYSUITE_CONFIG||{};
    return /^https:\/\/.+\.supabase\.co\/?$/i.test(String(cfg.supabaseUrl||'').trim())&&String(cfg.supabaseAnonKey||'').trim().length>20&&!String(cfg.supabaseAnonKey).includes('PASTE_');
  }
  function setView(name){el('loginView').classList.toggle('hidden',name!=='login');el('loadingView').classList.toggle('hidden',name!=='loading');el('appView').classList.toggle('hidden',name!=='app')}
  function message(text,type='error'){const box=el('loginMessage');box.textContent=text||'';box.className=text?`auth-message show ${type}`:'auth-message'}
  function busy(on){el('loginButton').disabled=on;el('loginButton').textContent=on?'Signing in…':'Sign in';el('loginEmail').disabled=on;el('loginPassword').disabled=on}
  function showLogin(text='',type='error'){const key=el('keyButton');if(key){key.hidden=true;key.style.display='none'}setView('login');busy(false);message(text,type);el('loginPassword').value='';lockSelector()}
  function showLoading(text){el('loadingText').textContent=text||'Checking secure access…';setView('loading')}
  function friendly(error){const text=String(error?.message||'').toLowerCase();if(text.includes('invalid login credentials'))return 'The email or password is incorrect.';if(text.includes('email not confirmed'))return 'This email account has not been confirmed yet.';if(text.includes('rate limit'))return 'Too many attempts. Please try again later.';return error?.message||'Unable to sign in.'}
  function unlockSelector(){[['selectorFrame','selector/index.html'],['selectorEsFrame','selector-es/index.html']].forEach(([id,fallback])=>{const frame=el(id);if(frame&&frame.getAttribute('src')==='about:blank')frame.src=frame.dataset.src||fallback})}
  function lockSelector(){/* V3.8.5: keep CHC/ES selector engines loaded. The authenticated app view is already hidden at login, and blanking both iframes caused the shared Selection launch regression. */const frame=el('productSelectorFrame');if(frame&&frame.getAttribute('src')!=='about:blank')frame.src='about:blank'}

  async function verify(email){
    const {data,error}=await client.from('ks_user_access').select('email,employee_id,company_id,role,display_name,active').eq('email',String(email||'').toLowerCase()).limit(1);
    if(error)throw new Error(`Access check failed: ${error.message}`);
    return data?.[0]?.active?data[0]:null;
  }
  async function loadData(userAccess=null){
    const [companies,users,categories,products,esProducts,gwsProducts,keyplcProducts,manifoldProducts,motorProducts,couplingProducts,settings]=await Promise.all([
      client.from('ks_companies').select('*').order('company_name'),
      client.from('ks_company_users').select('*').order('full_name'),
      client.from('ks_pricing_categories').select('*').order('category_name'),
      client.from('ks_products_chc').select('*').order('source_row'),
      client.from('ks_products_es').select('*').order('source_row'),
      client.from('ks_products_gws').select('*').eq('status','active').order('source_row'),
      client.from('ks_products_keyplc').select('*').eq('status','active').order('source_row'),
      client.from('ks_products_manifold').select('*').eq('status','active').order('section').order('source_row'),
      client.from('ks_products_motor').select('*').eq('active',true).order('efficiency_class').order('hp').order('pole'),
      client.from('ks_products_coupling').select('*').eq('active',true).order('component_type').order('source_row'),
      client.from('ks_app_settings').select('*').eq('id','default').limit(1)
    ]);
    const failed=[companies,users,categories,products,esProducts,gwsProducts,keyplcProducts,manifoldProducts,motorProducts,couplingProducts,settings].find(x=>x.error);if(failed?.error)throw new Error(failed.error.message);
    let chcG1Products={data:[]};
    try{
      chcG1Products=await client.from('ks_products_chc_g1').select('*').order('source_row');
      if(chcG1Products.error)throw chcG1Products.error;
    }catch(error){
      console.warn('CHC G1 independent Price List is not installed yet. Run V41410_CHC_G1_INDEPENDENT_PRICELIST.sql.',error);
      chcG1Products={data:[]};
    }
    let customerPricingRows=[];
    try{const result=await client.rpc('keysuite_get_customer_pricing_v222');if(result.error)throw result.error;customerPricingRows=Array.isArray(result.data)?result.data:(result.data?[result.data]:[])}catch(error){
      console.warn('V2.22 Customer pricing is not available yet. Customer-specific percentages will remain zero until the migration is run.',error);
    }
    const setting=settings.data?.[0]||{};
    const parseJson=value=>{if(!value)return{};if(typeof value==='object')return value;try{return JSON.parse(value)}catch(_){return{}}};
    const baseplateCosting=parseJson(setting.baseplate_costing);
    const chcUsdMultiplier=Number(setting.chc_usd_multiplier??setting.usd_multiplier??5.8);
    const chcRmbMultiplier=Number(setting.chc_rmb_multiplier??setting.rmb_multiplier??.65);
    const gwsUsdMultiplier=Number(setting.gws_usd_multiplier??setting.usd_multiplier??5.8);
    const gwsRmbMultiplier=Number(setting.gws_rmb_multiplier??setting.rmb_multiplier??.65);
    const esUsdMultiplier=Number(setting.es_usd_multiplier??setting.usd_multiplier??5.8);
    const esRmbMultiplier=Number(setting.es_rmb_multiplier??setting.rmb_multiplier??.65);
    const keyplcUsdMultiplier=Number(setting.keyplc_usd_multiplier??setting.usd_multiplier??5.8);
    const keyplcRmbMultiplier=Number(setting.keyplc_rmb_multiplier??setting.rmb_multiplier??.65);
    const manifoldUsdMultiplier=Number(setting.manifold_usd_multiplier??setting.usd_multiplier??5.8);
    const manifoldRmbMultiplier=Number(setting.manifold_rmb_multiplier??setting.rmb_multiplier??.65);
    const motorUsdMultiplier=Number(setting.motor_usd_multiplier??setting.usd_multiplier??5.8);
    const motorRmbMultiplier=Number(setting.motor_rmb_multiplier??setting.rmb_multiplier??.65);
    const couplingUsdMultiplier=Number(setting.coupling_usd_multiplier??setting.usd_multiplier??5.8);
    const couplingRmbMultiplier=Number(setting.coupling_rmb_multiplier??setting.rmb_multiplier??.65);
    const parseRules=value=>{if(!value)return{};if(typeof value==='object')return value;try{return JSON.parse(value)}catch(_){return{}}};
    const bool=(value,fallback=true)=>value===undefined||value===null?fallback:!!value;
    const normalizeRule=(raw={},fallback={})=>({margin:Number(raw.margin??fallback.margin??.38),transport:Number(raw.transport??fallback.transport??30),normal:Number(raw.normal??fallback.normal??0),rare:Number(raw.rare??fallback.rare??0),useCommission:bool(raw.useCommission??raw.use_commission??raw.includeCommission??raw.include_commission,fallback.useCommission??true),useSetDiscount:bool(raw.useSetDiscount??raw.use_set_discount??raw.includeSetDiscount??raw.include_set_discount,fallback.useSetDiscount??true),useFinalDiscount:bool(raw.useFinalDiscount??raw.use_final_discount??raw.includeFinalDiscount??raw.include_final_discount,fallback.useFinalDiscount??true),useFuelCharge:bool(raw.useFuelCharge??raw.use_fuel_charge??raw.includeFuelCharge??raw.include_fuel_charge,fallback.useFuelCharge??true),currencies:[...new Set((Array.isArray(raw.currencies)?raw.currencies:(Array.isArray(fallback.currencies)?fallback.currencies:[])).map(v=>String(v||'').toUpperCase()).filter(v=>['USD','RMB','MYR'].includes(v)))]});
    const normalizedCustomerRows=window.KeySuiteCustomerSettings?.normalizeRows?.(customerPricingRows)||window.KeySuiteCompanySettings?.normalizeRows?.(customerPricingRows)||customerPricingRows.map(row=>window.KeySuiteCompanySettings?.normalizeRow?.(row)||row);
    return {
      version:'3.1',release_date:'2026-08-07',currency:setting.currency||'MYR',
      usd_multiplier:chcUsdMultiplier,rmb_multiplier:chcRmbMultiplier,myr_multiplier:1,
      productMultipliers:{CHC:{USD:chcUsdMultiplier,RMB:chcRmbMultiplier,MYR:1},ES:{USD:esUsdMultiplier,RMB:esRmbMultiplier,MYR:1},GWS:{USD:gwsUsdMultiplier,RMB:gwsRmbMultiplier,MYR:1},KEYPLC:{USD:keyplcUsdMultiplier,RMB:keyplcRmbMultiplier,MYR:1},MANIFOLD:{USD:manifoldUsdMultiplier,RMB:manifoldRmbMultiplier,MYR:1},MOTOR:{USD:motorUsdMultiplier,RMB:motorRmbMultiplier,MYR:1},COUPLING:{USD:couplingUsdMultiplier,RMB:couplingRmbMultiplier,MYR:1},BASEPLATE:{USD:1,RMB:1,MYR:1}},
      fuel_price:Number(setting.fuel_price??2),fuel_base_price:Number(setting.fuel_base_price??2),baseplateCosting:baseplateCosting,keylabConfig:parseJson(setting.keylab_config),customerPricing:null,customerPricingRows:normalizedCustomerRows,
      companies:(companies.data||[]).map(c=>({id:c.id,name:c.company_name,category:c.pricing_category,delivery_distance:Number(c.delivery_distance||0),phone:c.company_phone,term_days:c.term_days,address:c.address,tin:c.tin_number,business_registration_no:c.business_registration_no,sst_no:c.sst_no,msic_code:c.msic_code,business_activities:c.business_activities})),
      users:(users.data||[]).map(u=>({id:u.id,company_id:u.company_id,source_company_id:u.source_company_id,prefix:u.prefix,name:u.full_name,phone:u.phone,email:u.email})),
      categories:(categories.data||[]).map(c=>{
        const rules=parseRules(c.product_rules),chcFallback={margin:Number(c.chc_margin??c.chc_factor??.38),normal:0,rare:0,transport:Number(c.transport??30),useCommission:true,useSetDiscount:true,useFinalDiscount:true,useFuelCharge:true,currencies:[]},otherFallback={margin:0,normal:0,rare:0,transport:0,useCommission:true,useSetDiscount:true,useFinalDiscount:true,useFuelCharge:true,currencies:[]};
        return {id:c.id,name:c.category_name,productRules:{CHC:normalizeRule(rules.CHC,chcFallback),CHC_G1:normalizeRule(rules.CHC_G1,otherFallback),CHC_G2:normalizeRule(rules.CHC_G2||rules.CHC,chcFallback),ES:normalizeRule(rules.ES,otherFallback),GWS:normalizeRule(rules.GWS,otherFallback),KEYPLC:normalizeRule(rules.KEYPLC,otherFallback),MANIFOLD:normalizeRule(rules.MANIFOLD,otherFallback),MOTOR:normalizeRule(rules.MOTOR,otherFallback),COUPLING:normalizeRule(rules.COUPLING,otherFallback),BASEPLATE:normalizeRule(rules.BASEPLATE,otherFallback)},margins:{CHC:chcFallback.margin,CHC_G2:chcFallback.margin},factors:{CHC:chcFallback.margin,CHC_G2:chcFallback.margin},transport:chcFallback.transport};
      }),
      products:(products.data||[]).map(p=>({
        id:p.id,category:p.product_category,model:p.model,source_row:p.source_row,
        pricesByCurrency:{
          USD:{CHC:p.chc_usd===null?null:Number(p.chc_usd),CHCS:p.chcs_usd===null?null:Number(p.chcs_usd),CHCN:p.chcn_usd===null?null:Number(p.chcn_usd)},
          RMB:{CHC:p.chc_rmb===null?null:Number(p.chc_rmb),CHCS:p.chcs_rmb===null?null:Number(p.chcs_rmb),CHCN:p.chcn_rmb===null?null:Number(p.chcn_rmb)},
          MYR:{CHC:p.chc_myr===null?null:Number(p.chc_myr),CHCS:p.chcs_myr===null?null:Number(p.chcs_myr),CHCN:p.chcn_myr===null?null:Number(p.chcn_myr)}
        },
        rarityByCurrency:{
          USD:{CHC:String(p.chc_rarity_usd||'common').toLowerCase(),CHCS:String(p.chcs_rarity_usd||'common').toLowerCase(),CHCN:String(p.chcn_rarity_usd||'common').toLowerCase()},
          RMB:{CHC:String(p.chc_rarity_rmb||'common').toLowerCase(),CHCS:String(p.chcs_rarity_rmb||'common').toLowerCase(),CHCN:String(p.chcn_rarity_rmb||'common').toLowerCase()},
          MYR:{CHC:String(p.chc_rarity_myr||'common').toLowerCase(),CHCS:String(p.chcs_rarity_myr||'common').toLowerCase(),CHCN:String(p.chcn_rarity_myr||'common').toLowerCase()}
        }
      })),
      chcG1Products:(chcG1Products.data||[]).map(p=>({
        id:p.id,generation:'G1',category:p.product_category||'CHC G1',model:p.model,source_row:p.source_row,
        pricesByCurrency:{
          USD:{CHC:p.chc_usd===null?null:Number(p.chc_usd),CHCS:p.chcs_usd===null?null:Number(p.chcs_usd),CHCN:p.chcn_usd===null?null:Number(p.chcn_usd)},
          RMB:{CHC:p.chc_rmb===null?null:Number(p.chc_rmb),CHCS:p.chcs_rmb===null?null:Number(p.chcs_rmb),CHCN:p.chcn_rmb===null?null:Number(p.chcn_rmb)},
          MYR:{CHC:p.chc_myr===null?null:Number(p.chc_myr),CHCS:p.chcs_myr===null?null:Number(p.chcs_myr),CHCN:p.chcn_myr===null?null:Number(p.chcn_myr)}
        },
        rarityByCurrency:{
          USD:{CHC:String(p.chc_rarity_usd||'common').toLowerCase(),CHCS:String(p.chcs_rarity_usd||'common').toLowerCase(),CHCN:String(p.chcn_rarity_usd||'common').toLowerCase()},
          RMB:{CHC:String(p.chc_rarity_rmb||'common').toLowerCase(),CHCS:String(p.chcs_rarity_rmb||'common').toLowerCase(),CHCN:String(p.chcn_rarity_rmb||'common').toLowerCase()},
          MYR:{CHC:String(p.chc_rarity_myr||'common').toLowerCase(),CHCS:String(p.chcs_rarity_myr||'common').toLowerCase(),CHCN:String(p.chcn_rarity_myr||'common').toLowerCase()}
        }
      })),
      esProducts:(esProducts.data||[]).map(p=>({id:p.id,model:p.model,source_row:p.source_row,rarity:String(p.rarity||'common').toLowerCase(),variants:Array.isArray(p.variants)?p.variants:(typeof p.variants==='object'?p.variants:[])})),
      gwsProducts:(gwsProducts.data||[]).map(p=>({
        id:p.id,model:p.model,source_row:p.source_row,seriesCode:p.series_code||'',seriesName:p.series_name||'',sizeCode:p.size_code||p.model,sizeLitres:Number(p.size_litres||String(p.size_code||p.model).replace(/\D/g,'')||0),pressureBar:Number(p.pressure_bar||0),
        systemConnection:p.system_connection||'',prechargeText:p.precharge_text||'',maxWorkingPressureText:p.max_working_pressure_text||'',maxWorkingTemperatureText:p.max_working_temperature_text||'',
        pricesByCurrency:{USD:{SKU:p.price_usd===null?null:Number(p.price_usd)},RMB:{SKU:p.price_rmb===null?null:Number(p.price_rmb)},MYR:{SKU:p.price_myr===null?null:Number(p.price_myr)}},
        rarityByCurrency:{USD:{SKU:String(p.rarity_usd||'common').toLowerCase()},RMB:{SKU:String(p.rarity_rmb||'common').toLowerCase()},MYR:{SKU:String(p.rarity_myr||'common').toLowerCase()}}
      })),
      keyplcProducts:(keyplcProducts.data||[]).map(p=>({id:p.id,model:p.model,motorKw:Number(p.motor_kw||String(p.model||'').replace(/[^0-9.]/g,'')||0),source_row:p.source_row,rarity:String(p.rarity||'common').toLowerCase(),variants:Array.isArray(p.variants)?p.variants:(typeof p.variants==='object'?p.variants:[])})),
      manifoldProducts:(manifoldProducts.data||[]).map(p=>({id:p.id,section:p.section,model:p.model,source_row:p.source_row,rarity:String(p.rarity||'common').toLowerCase(),variants:Array.isArray(p.variants)?p.variants:(typeof p.variants==='object'?p.variants:[])})),
      motorProducts:(motorProducts.data||[]).map(p=>({id:p.id,model:p.model,efficiencyClass:p.efficiency_class,modelPrefix:p.model_prefix,hp:Number(p.hp),pole:Number(p.pole),description:p.description,sourceSheet:p.source_sheet,sourceRow:p.source_row,priceUsd:Number(p.price_usd||0),priceRmb:Number(p.price_rmb||0),priceMyr:Number(p.price_myr||0),rarity:String(p.rarity||'common').toLowerCase(),active:p.active!==false,pricesByCurrency:{USD:{MOTOR:Number(p.price_usd||0)},RMB:{MOTOR:Number(p.price_rmb||0)},MYR:{MOTOR:Number(p.price_myr||0)}},rarityByCurrency:{USD:{MOTOR:String(p.rarity||'common').toLowerCase()},RMB:{MOTOR:String(p.rarity||'common').toLowerCase()},MYR:{MOTOR:String(p.rarity||'common').toLowerCase()}}})),
      couplingProducts:(couplingProducts.data||[]).map(p=>({id:p.id,componentType:p.component_type,model:p.model,torqueNm:Number(p.torque_nm||0),maxSpeedRpm:Number(p.max_speed_rpm||0),maxShaftMm:Number(p.max_shaft_mm||0),pumpBush:p.pump_bush||'',motorBush:p.motor_bush||'',sourceSheet:p.source_sheet,sourceRow:p.source_row,priceUsd:Number(p.price_usd||0),priceRmb:Number(p.price_rmb||0),priceMyr:Number(p.price_myr||0),rarity:String(p.rarity||'common').toLowerCase(),active:p.active!==false,pricesByCurrency:{USD:{COUPLING:Number(p.price_usd||0)},RMB:{COUPLING:Number(p.price_rmb||0)},MYR:{COUPLING:Number(p.price_myr||0)}},rarityByCurrency:{USD:{COUPLING:String(p.rarity||'common').toLowerCase()},RMB:{COUPLING:String(p.rarity||'common').toLowerCase()},MYR:{COUPLING:String(p.rarity||'common').toLowerCase()}}}))
    };
  }

  async function loadRolePermissions(){
    try{
      let result=await client.rpc('keysuite_get_role_permissions_v40512');
      if(result.error)result=await client.rpc('keysuite_get_role_permissions');
      const {data,error}=result;if(error)throw error;
      window.KeySuitePermissions?.setMatrix?.(data||[]);
      return data||[];
    }catch(error){
      console.warn('Custom role permissions are not available yet',error);
      window.KeySuitePermissions?.setMatrix?.(window.KeySuitePermissions?.DEFAULTS||{});
      return [];
    }
  }

  async function loadUserProfile(email){
    try{
      const {data,error}=await client.from('ks_user_profiles').select('*').eq('email',String(email||'').toLowerCase()).maybeSingle();
      if(error){
        if(String(error.code||'')==='PGRST205'||String(error.message||'').toLowerCase().includes('schema cache'))return {};
        throw error;
      }
      return data||{};
    }catch(error){console.warn('User profile settings are not available yet',error);return {}}
  }
  function buildProfile(s,userAccess,data,saved={}){
    const meta=s?.user?.user_metadata||{};
    const directory=(data?.users||[]).find(u=>String(u.email||'').toLowerCase()===String(s?.user?.email||'').toLowerCase())||{};
    return {
      display_name:String(saved.display_name||meta.display_name||userAccess?.display_name||directory.name||s?.user?.email||'').trim(),
      designation:String(saved.designation||meta.designation||'').trim(),
      phone:String(saved.phone||meta.phone||directory.phone||'').trim(),
      signatory_name:String(saved.signatory_name||meta.signatory_name||'').trim(),
      signature_image:String(saved.signature_image||'').trim(),
      quotation_prefix:String(saved.quotation_prefix||'').trim().toUpperCase(),
      email:String(s?.user?.email||userAccess?.email||'').toLowerCase(),
      role:userAccess?.role||'user',
      company_id:userAccess?.company_id||''
    };
  }
  function applyProfile(next){
    profile=next||profile||{};window.KEYSUITE_PROFILE=profile;
    el('sessionUserName').textContent=profile.display_name||profile.email||'Signed in';
    el('sessionUserEmail').textContent=`${profile.email||''}${profile.role?` · ${profile.role}`:''}`;
    window.KeySuiteApp?.applyProfile?.(profile);
  }
  async function enter(s){
    showLoading('Verifying approved user…');
    try{
      const userAccess=await verify(s?.user?.email||'');
      if(!userAccess){await client.auth.signOut({scope:'local'});showLogin('This account is valid, but it is not approved for KeySuite.');return}
      showLoading('Loading protected company and pricing data…');
      const data=await loadData(userAccess);if(!data.companies.length)throw new Error('No company data was returned. Check the database and RLS policies.');
      session=s;access=userAccess;window.KEYSUITE_ACCESS=access;await loadRolePermissions();await window.KeySuiteAuthority?.init?.(access);const savedProfile=await loadUserProfile(s?.user?.email||'');profile=buildProfile(s,access,data,savedProfile);
      window.KEYSUITE_SECURE_DATA=data;window.KeySuiteKeyLab?.applyData?.(data);applyProfile(profile);
      try{window.dispatchEvent(new CustomEvent('KEYSUITE_AUTH_CONTEXT_READY',{detail:{company_id:profile?.company_id||userAccess?.company_id||'',email:profile?.email||'',role:profile?.role||''}}))}catch(_){}
      window.KeySuitePricing?.init(data,access);window.KeySuiteCategories?.init(data,access);window.KeySuiteCompanySettings?.init(data,access);window.KeySuitePriceList?.init(data,access);window.KeySuiteManifold?.init(data,access);window.KeySuiteMotor?.init(data,access);window.KeySuiteCoupling?.init(data,access);window.KeySuiteBaseplate?.init(data,access);window.KeySuiteRoles?.init(access);window.KeySuiteKeyAI?.init?.(access);await window.KeySuiteTemplates?.init?.(access);await window.KeySuiteQuotationReferences?.init?.(profile);window.KeySuiteApp?.refreshNewQuotationReference?.();unlockSelector();
      showLoading('Loading your customer access…');
      try{await window.KeySuiteCustomerStore?.load?.()}catch(error){console.warn('Customer load warning',error)}
      try{await window.KeySuiteNoteStore?.load?.()}catch(error){console.warn('Global Note load warning',error)}
      showLoading('Loading secure quotation history…');
      try{await window.KeySuiteQuotationStore?.load?.()}catch(error){console.warn('Quotation history load warning',error)}
      refreshAll();setView('app');
      if(inviteFlowPending||recoveryFlowPending)setTimeout(openInvitePassword,250);
    }catch(error){console.error(error);try{await client.auth.signOut({scope:'local'})}catch(_){ }showLogin(`Secure data could not be loaded: ${error.message}`)}
  }
  async function signIn(event){
    event.preventDefault();message('');if(!client){message('Supabase is not configured. Keep your working config.js in the repository.','info');return}
    const email=el('loginEmail').value.trim().toLowerCase(),password=el('loginPassword').value;if(!email||!password){message('Enter both email and password.');return}
    busy(true);const {data,error}=await client.auth.signInWithPassword({email,password});if(error||!data?.session){busy(false);message(friendly(error));return}await enter(data.session)
  }
  async function signOut(){el('logoutButton').disabled=true;try{await client?.auth.signOut()}catch(error){console.warn(error)}session=null;access=null;profile=null;window.KEYSUITE_SECURE_DATA=null;window.KEYSUITE_ACCESS=null;window.KEYSUITE_PROFILE=null;window.KeySuitePermissions?.setMatrix?.(window.KeySuitePermissions?.DEFAULTS||{});window.KeySuiteAuthority?.reset?.();el('logoutButton').disabled=false;showLogin('You have signed out.','info')}
  async function refreshSecure(){if(!session)return;await enter(session)}

  function invitePasswordMessage(text,type='error'){
    const box=el('invitePasswordMessage');if(!box)return;box.textContent=text||'';box.className=text?`auth-message show ${type}`:'auth-message';
  }

  function forgotPasswordMessage(text,type='error'){
    const box=el('forgotPasswordMessage');if(!box)return;box.textContent=text||'';box.className=text?`auth-message show ${type}`:'auth-message';
  }

  function openForgotPassword(){
    forgotPasswordMessage('');
    el('forgotPasswordEmail').value=String(el('loginEmail')?.value||'').trim().toLowerCase();
    el('forgotPasswordDialog')?.showModal();
    setTimeout(()=>el('forgotPasswordEmail')?.focus(),50);
  }

  function closeForgotPassword(){el('forgotPasswordDialog')?.close()}

  async function sendPasswordReset(event){
    event.preventDefault();
    const email=String(el('forgotPasswordEmail')?.value||'').trim().toLowerCase();
    if(!/^\S+@\S+\.\S+$/.test(email)){forgotPasswordMessage('Enter a valid email address.');return}
    const button=el('sendPasswordReset');button.disabled=true;button.textContent='Sending…';forgotPasswordMessage('');
    try{
      if(!client)throw new Error('Supabase is not connected.');
      const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:authRedirectUrl('recovery')});
      if(error)throw error;
      forgotPasswordMessage('If this is an approved KeySuite account, a password reset email has been sent. Open the newest email link.','info');
    }catch(error){
      forgotPasswordMessage(error?.message||'The reset email could not be sent.');
    }finally{
      button.disabled=false;button.textContent='Send Reset Link';
    }
  }

  function openInvitePassword(){
    if(!session)return;
    const recovery=recoveryFlowPending||authFlowMode==='recovery';
    const title=el('authPasswordDialogTitle'),hint=el('authPasswordDialogHint'),button=el('saveInvitePassword');
    if(title)title.textContent=recovery?'Set New Password':'Create KeySuite Password';
    if(hint)hint.textContent=recovery?'Choose a new password for your KeySuite account.':'Complete your invitation.';
    if(button)button.textContent=recovery?'Update Password':'Set Password';
    invitePasswordMessage(recovery?'Enter and confirm your new password.':'Create your KeySuite password to complete the invitation.','info');
    el('inviteNewPassword').value='';
    el('inviteConfirmPassword').value='';
    el('invitePasswordDialog')?.showModal();
  }

  async function saveInvitePassword(event){
    event.preventDefault();
    const password=el('inviteNewPassword').value,confirm=el('inviteConfirmPassword').value;
    if(password.length<8){invitePasswordMessage('The password must contain at least 8 characters.');return}
    if(password!==confirm){invitePasswordMessage('The passwords do not match.');return}
    const recovery=recoveryFlowPending||authFlowMode==='recovery';
    const button=el('saveInvitePassword');button.disabled=true;button.textContent='Saving…';
    try{
      const activeSession=await ensureActiveSession();
      if(!activeSession)throw new Error(recovery?'The password reset link has expired. Request a new reset email.':'The invitation session has expired. Request a new invitation.');
      const result=await client.auth.updateUser({password});
      if(result.error)throw result.error;
      inviteFlowPending=false;
      recoveryFlowPending=false;
      authFlowMode='';
      clearAuthCallbackUrl();
      invitePasswordMessage(recovery?'Password updated. You are signed in with your new password.':'Password created. Your KeySuite login is ready.','info');
      setTimeout(()=>el('invitePasswordDialog')?.close(),1000);
    }catch(error){
      invitePasswordMessage(error.message||(recovery?'The password could not be reset.':'The password could not be created.'));
    }finally{
      button.disabled=false;
      button.textContent=recovery?'Update Password':'Set Password';
    }
  }

  function settingsMessage(text,type='error'){
    const box=el('settingsMessage');box.textContent=text||'';box.className=text?`auth-message show ${type}`:'auth-message';
  }
  function openSettings(){
    if(!session||!profile)return;
    settingsMessage('');el('settingsDisplayName').value=profile.display_name||'';el('settingsDesignation').value=profile.designation||'';el('settingsPhone').value=profile.phone||'';el('settingsEmail').value=profile.email||'';el('settingsSignatoryName').value=profile.signatory_name||profile.display_name||'';
    pendingSignatureData=profile.signature_image||'';removeSignatureRequested=false;el('settingsSignatureUpload').value='';renderSignaturePreview();
    el('settingsCurrentPassword').value='';el('settingsNewPassword').value='';el('settingsConfirmPassword').value='';el('settingsDialog').showModal();
  }
  function renderSignaturePreview(){
    const preview=el('settingsSignaturePreview'),remove=el('settingsRemoveSignature');if(!preview||!remove)return;
    const data=removeSignatureRequested?'':(pendingSignatureData||profile?.signature_image||'');
    preview.src=data||'';preview.style.display=data?'block':'none';remove.disabled=!data;
  }
  function optimizeSignature(file){
    return new Promise((resolve,reject)=>{
      if(!/^image\/(png|jpeg|webp)$/.test(file.type))return reject(new Error('Please upload PNG, JPG or WEBP.'));
      if(file.size>3*1024*1024)return reject(new Error('The signature file must be smaller than 3 MB.'));
      const reader=new FileReader();
      reader.onerror=()=>reject(new Error('The signature image could not be read.'));
      reader.onload=()=>{
        const image=new Image();image.onerror=()=>reject(new Error('The signature image is invalid.'));
        image.onload=()=>{
          const maxW=900,maxH=300,scale=Math.min(1,maxW/image.width,maxH/image.height);
          const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
          const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
          resolve(canvas.toDataURL('image/png'));
        };image.src=String(reader.result||'');
      };reader.readAsDataURL(file);
    });
  }
  function closeSettings(){el('settingsDialog')?.close()}
  async function ensureActiveSession(){
    const current=await client.auth.getSession();
    if(current.data?.session){session=current.data.session;return session}
    if(session?.access_token&&session?.refresh_token){
      const restored=await client.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token});
      if(restored.data?.session){session=restored.data.session;return session}
    }
    return null;
  }
  async function saveSettings(event){
    event.preventDefault();if(!client||!session)return;
    const displayName=el('settingsDisplayName').value.trim(),designation=el('settingsDesignation').value.trim();
    const phone=typeof window.formatMYPhone==='function'?window.formatMYPhone(el('settingsPhone').value):el('settingsPhone').value.trim();
    const signatoryName=el('settingsSignatoryName').value.trim()||displayName;
    const signatureImage=removeSignatureRequested?'':(pendingSignatureData!==null?pendingSignatureData:(profile.signature_image||''));
    const currentPassword=el('settingsCurrentPassword').value,newPassword=el('settingsNewPassword').value,confirmPassword=el('settingsConfirmPassword').value;
    if(!displayName){settingsMessage('Display Name is required.');return}
    const changingPassword=!!(currentPassword||newPassword||confirmPassword);
    if(changingPassword){
      if(!currentPassword||!newPassword||!confirmPassword){settingsMessage('Complete all three password fields.');return}
      if(newPassword.length<8){settingsMessage('The new password must contain at least 8 characters.');return}
      if(newPassword!==confirmPassword){settingsMessage('The new passwords do not match.');return}
    }
    const button=el('saveSettings');button.disabled=true;button.textContent='Saving…';settingsMessage('');
    try{
      const activeSession=await ensureActiveSession();
      if(!activeSession)throw new Error('Your login session has expired. Please sign out and sign in again.');
      if(changingPassword){
        const check=await client.auth.signInWithPassword({email:profile.email,password:currentPassword});
        if(check.error)throw new Error('The current password is incorrect.');
        if(check.data?.session)session=check.data.session;
      }
      const {data:profileRows,error:profileError}=await client.rpc('keysuite_save_my_profile',{
        p_display_name:displayName,
        p_designation:designation,
        p_phone:phone,
        p_signatory_name:signatoryName,
        p_signature_image:signatureImage
      });
      if(profileError)throw new Error(`${profileError.message}. Run the V1.16 Supabase migration first.`);
      const metadata={...(session?.user?.user_metadata||{}),display_name:displayName,designation,phone,signatory_name:signatoryName};
      const profileResult=await client.auth.updateUser({data:metadata});
      if(profileResult.error&&!String(profileResult.error.message||'').toLowerCase().includes('auth session missing'))throw profileResult.error;
      if(changingPassword){const passwordResult=await client.auth.updateUser({password:newPassword});if(passwordResult.error)throw passwordResult.error}
      const sessionResult=await client.auth.getSession();if(sessionResult.data?.session)session=sessionResult.data.session;
      const saved=Array.isArray(profileRows)?profileRows[0]:profileRows||{};
      pendingSignatureData=signatureImage;removeSignatureRequested=false;applyProfile({...profile,...saved,display_name:displayName,designation,phone,signatory_name:signatoryName,signature_image:signatureImage});
      el('settingsPhone').value=phone;el('settingsCurrentPassword').value='';el('settingsNewPassword').value='';el('settingsConfirmPassword').value='';
      settingsMessage(changingPassword?'Profile and password updated.':'Profile and signatory updated.','info');
      setTimeout(closeSettings,700);
    }catch(error){console.error(error);settingsMessage(error.message||'Settings could not be saved.')}finally{button.disabled=false;button.textContent='Save Settings'}
  }

  async function init(){
    el('loginForm').addEventListener('submit',signIn);el('logoutButton').addEventListener('click',signOut);el('showPassword').addEventListener('change',event=>el('loginPassword').type=event.target.checked?'text':'password');
    el('forgotPasswordButton')?.addEventListener('click',openForgotPassword);
    el('forgotPasswordForm')?.addEventListener('submit',sendPasswordReset);
    el('closeForgotPassword')?.addEventListener('click',closeForgotPassword);
    el('cancelForgotPassword')?.addEventListener('click',closeForgotPassword);
    el('invitePasswordForm')?.addEventListener('submit',saveInvitePassword);
    el('settingsButton')?.addEventListener('click',openSettings);el('settingsForm')?.addEventListener('submit',saveSettings);el('closeSettings')?.addEventListener('click',closeSettings);el('cancelSettings')?.addEventListener('click',closeSettings);
    el('settingsSignatureUpload')?.addEventListener('change',async event=>{
      const file=event.target.files?.[0];if(!file)return;
      try{pendingSignatureData=await optimizeSignature(file);removeSignatureRequested=false;renderSignaturePreview();settingsMessage('Signature ready. Click Save Settings to keep it.','info')}
      catch(error){event.target.value='';settingsMessage(error.message||'The signature could not be loaded.')}
    });
    el('settingsRemoveSignature')?.addEventListener('click',()=>{pendingSignatureData='';removeSignatureRequested=true;el('settingsSignatureUpload').value='';renderSignaturePreview();settingsMessage('Signature will be removed when you save.','info')});
    if(!configReady()){showLogin('Your existing config.js is missing or incomplete. Keep the config.js that already works on GitHub.','info');return}
    if(!window.supabase?.createClient){showLogin('The Supabase library could not be loaded. Check the internet connection.');return}
    const cfg=window.KEYSUITE_CONFIG;client=window.supabase.createClient(cfg.supabaseUrl.trim(),cfg.supabaseAnonKey.trim(),{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    client.auth.onAuthStateChange((event,nextSession)=>{
      if(event==='PASSWORD_RECOVERY'){
        authFlowMode='recovery';
        recoveryFlowPending=true;
        inviteFlowPending=false;
        if(nextSession)session=nextSession;
      }
      if(event==='SIGNED_OUT'){session=null;access=null;profile=null;showLogin()}
    });
    showLoading('Checking existing session…');
    const {data,error}=await client.auth.getSession();
    if(error){showLogin(error.message);return}
    if(data?.session)await enter(data.session);
    else if(inviteFlowPending)showLogin('This invitation link is invalid or has expired. Ask the Owner to send a new invitation.','error');
    else if(recoveryFlowPending)showLogin('This password reset link is invalid or has expired. Use Forgot Password to request a new link.','error');
    else showLogin();
  }

  window.KeySuiteAuth={getClient:()=>client,getSession:()=>session,getAccess:()=>access,getProfile:()=>profile,openSettings,refreshSecure,getAuthRedirectUrl:authRedirectUrl};
  init();
})();
