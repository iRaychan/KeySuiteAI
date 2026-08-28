import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const env=(...names:string[])=>{for(const name of names){const v=String(Deno.env.get(name)??'').trim();if(v)return v}return ''};
const mappedKey=(name:string)=>{const raw=String(Deno.env.get(name)??'').trim();if(!raw)return '';try{const p=JSON.parse(raw);if(!p||typeof p!=='object'||Array.isArray(p))return '';const d=String((p as Record<string,unknown>).default??'').trim();if(d)return d;for(const value of Object.values(p as Record<string,unknown>)){const k=String(value??'').trim();if(k)return k}}catch(_){}return ''};
const localKeys=()=>({
  url:env('SUPABASE_URL'),
  publishable:env('SUPABASE_ANON_KEY','SUPABASE_PUBLISHABLE_KEY')||mappedKey('SUPABASE_PUBLISHABLE_KEYS'),
  service:env('SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY')||mappedKey('SUPABASE_SECRET_KEYS')
});
function json(body:Record<string,unknown>,status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})}
function errorText(value:unknown){
  if(value==null)return 'Unknown KeySuite KeyAI error.';
  if(typeof value==='string')return value;
  if(value instanceof Error&&value.message)return value.message;
  if(typeof value==='object'){
    const v=value as Record<string,unknown>;
    for(const key of ['message','error_description','details','hint','code']){const hit=v[key];if(typeof hit==='string'&&hit.trim())return hit.trim()}
    try{const s=JSON.stringify(value);if(s&&s!=='{}')return s}catch(_){}
  }
  return String(value);
}

async function accessContext(req:Request){
  const k=localKeys();
  if(!k.url||!k.publishable||!k.service)return {error:json({error:'KeySuite Supabase function environment is incomplete. SUPABASE_URL / ANON(PUBLISHABLE) / SERVICE_ROLE(SECRET) are required.'})};
  const authHeader=req.headers.get('Authorization')??'';
  if(!authHeader.startsWith('Bearer '))return {error:json({error:'Missing KeySuite login session.'})};
  const jwt=authHeader.slice(7).trim();
  if(!jwt||jwt.startsWith('sb_publishable_')||jwt.startsWith('sb_secret_'))return {error:json({error:'Invalid KeySuite login session.'})};
  const caller=createClient(k.url,k.publishable,{auth:{persistSession:false,autoRefreshToken:false}});
  const user=await caller.auth.getUser(jwt);
  const email=String(user.data?.user?.email??'').trim().toLowerCase();
  if(user.error||!email)return {error:json({error:`Invalid KeySuite login session. ${user.error?errorText(user.error):''}`.trim()})};
  const service=createClient(k.url,k.service,{auth:{persistSession:false,autoRefreshToken:false}});
  const access=await service.from('ks_user_access').select('role,active,company_id').eq('email',email).eq('active',true).limit(1);
  if(access.error)return {error:json({error:`KeySuite access lookup failed: ${errorText(access.error)}`})};
  const row=(Array.isArray(access.data)?access.data:[])[0] as any;
  if(!row)return {error:json({error:'Your account does not have active KeySuite access.'})};
  const role=String(row.role??'viewer').trim().toLowerCase();
  const companyId=String(row.company_id??'').trim();
  let permissions:Record<string,unknown>={};
  if(role==='owner')permissions={keyai_access:'full',keyai_openai_control:'full',keyai_sender_assign:'full'};
  else{
    const pr=await service.from('ks_role_permissions').select('permissions').eq('company_id',companyId).ilike('role',role).limit(1).maybeSingle();
    if(pr.error)return {error:json({error:`KeyBot authority lookup failed: ${errorText(pr.error)}. Run V41202_KEYAI_AUTHORITY.sql.`})};
    const raw=(pr.data as any)?.permissions;
    if(raw&&typeof raw==='object'&&!Array.isArray(raw))permissions=raw as Record<string,unknown>;
  }
  const level=(key:string)=>String(permissions[key]??(role==='owner'?'full':'none')).trim().toLowerCase();
  const keyaiAccess=level('keyai_access')!=='none';
  const openAiControl=level('keyai_openai_control')!=='none';
  const senderAssign=level('keyai_sender_assign')!=='none';
  if(!keyaiAccess)return {error:json({error:'Your role does not have KeyBot access.'})};
  return {k,service,email,companyId,role,isOwner:role==='owner',keyaiAccess,openAiControl,senderAssign};
}

async function telegramWebhookStatus(url:string){
  const token=env('TELEGRAM_BOT_TOKEN','KeySuiteBot_Token');
  if(!token)return {configured:false,connected:false,error:'TELEGRAM_BOT_TOKEN is not configured in KeySuite.'};
  try{
    const r=await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const d=await r.json().catch(()=>({}));
    const actual=String(d?.result?.url??'');
    const expected=`${url.replace(/\/$/,'')}/functions/v1/telegram-webhook`;
    return {configured:true,connected:!!d?.ok&&actual===expected,url:actual,expected,last_error_message:d?.result?.last_error_message??null,pending_update_count:Number(d?.result?.pending_update_count||0)};
  }catch(e){return {configured:true,connected:false,error:e instanceof Error?e.message:String(e)}}
}
async function ensureTelegramWebhook(url:string){
  const token=env('TELEGRAM_BOT_TOKEN','KeySuiteBot_Token');
  const secret=env('TELEGRAM_WEBHOOK_SECRET','KeySuiteBot_TELEGRAM_WEBHOOK_SECRET');
  if(!token||!secret)return {configured:false,connected:false,error:'Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in the KeySuite Supabase project.'};
  const webhookUrl=`${url.replace(/\/$/,'')}/functions/v1/telegram-webhook`;
  try{
    const r=await fetch(`https://api.telegram.org/bot${token}/setWebhook`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:webhookUrl,secret_token:secret,allowed_updates:['message','edited_message','callback_query'],drop_pending_updates:false})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d?.ok)return {configured:true,connected:false,error:String(d?.description||`Telegram HTTP ${r.status}`)};
    return {...await telegramWebhookStatus(url),repointed:true};
  }catch(e){return {configured:true,connected:false,error:e instanceof Error?e.message:String(e)}}
}

async function importLegacyIfNeeded(service:any,force=false){
  try{
    const localSettings=await service.from('ks_app_settings').select('*').eq('id','default').maybeSingle();
    if(localSettings.error)throw new Error(`Local KeyBot migration state: ${errorText(localSettings.error)}`);
    const localRow:any=localSettings.data||{};
    const hasImportTracking=Object.prototype.hasOwnProperty.call(localRow,'keyai_unified_imported_at');
    if(!force&&hasImportTracking&&localRow.keyai_unified_imported_at){
      return {needed:false,imported:true,already:true,at:localRow.keyai_unified_imported_at};
    }

    const sourceUrl=env('KEYAI_SUPABASE_URL');
    const sourceKey=env('KEYAI_SUPABASE_SERVICE_ROLE_KEY','KEYAI_SUPABASE_SECRET_KEY');
    if(!sourceUrl||!sourceKey){
      return {needed:true,imported:false,reason:'Legacy KeyAI secrets are not present. KeySuite itself can still run; old history has not been copied yet.'};
    }

    if(sourceUrl.replace(/\/$/,'')===String(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'')){
      const now=new Date().toISOString();
      if(hasImportTracking){
        const mark=await service.from('ks_app_settings').update({keyai_unified_imported_at:now,keyai_legacy_source:'same-project'}).eq('id','default');
        if(mark.error)console.warn('Saving local KeyBot migration state skipped:',errorText(mark.error));
      }
      return {needed:false,imported:true,already:true,at:now};
    }

    const old=createClient(sourceUrl,sourceKey,{auth:{persistSession:false,autoRefreshToken:false}});

    // Read the whole legacy settings row so older KeyAI schemas do not fail
    // merely because one newer column did not exist yet.
    const settings=await old.from('ks_app_settings').select('*').eq('id','default').maybeSingle();
    if(settings.error)throw new Error(`Legacy settings: ${errorText(settings.error)}`);
    if(settings.data){
      const allowed=[
        'keyai_openai_enabled','keyai_openai_model','keyai_monthly_request_limit',
        'keyai_openai_last_test_at','keyai_openai_last_test_ok',
        'keyai_openai_last_test_model','keyai_openai_last_test_error'
      ];
      const payload:Record<string,unknown>={};
      for(const key of allowed)if(Object.prototype.hasOwnProperty.call(settings.data,key))payload[key]=(settings.data as any)[key];
      if(Object.keys(payload).length){
        const s=await service.from('ks_app_settings').update(payload).eq('id','default');
        if(s.error)throw new Error(`Saving imported settings: ${errorText(s.error)}`);
      }
    }

    const enquiryAllowed=[
      'id','source','external_update_id','external_message_id','external_chat_id',
      'sender_username','sender_name','raw_message','status','ai_enabled','ai_model',
      'ai_summary','ai_result','ai_error','clarification_question','clarification_questions',
      'parent_enquiry_id','conversation_id','external_sender_id','keyai_company_id',
      'keyai_customer_id','created_at','updated_at'
    ];
    let enquiryCount=0;
    for(let from=0;;from+=500){
      const q=await old.from('ks_keyai_enquiries').select('*').order('created_at',{ascending:true}).range(from,from+499);
      if(q.error)throw new Error(`Legacy Telegram inbox: ${errorText(q.error)}`);
      const sourceRows=Array.isArray(q.data)?q.data:[];
      const rows=sourceRows.map((r:any)=>{
        const row:Record<string,unknown>={};
        for(const key of enquiryAllowed)if(Object.prototype.hasOwnProperty.call(r,key))row[key]=r[key];
        row.id=String(r.id??crypto.randomUUID());
        if(Object.prototype.hasOwnProperty.call(row,'parent_enquiry_id')&&row.parent_enquiry_id!=null)row.parent_enquiry_id=String(row.parent_enquiry_id);
        if(Object.prototype.hasOwnProperty.call(row,'conversation_id')&&row.conversation_id!=null)row.conversation_id=String(row.conversation_id);
        return row;
      });
      if(rows.length){
        const ins=await service.from('ks_keyai_enquiries').upsert(rows,{onConflict:'id'});
        if(ins.error)throw new Error(`Saving Telegram inbox: ${errorText(ins.error)}`);
        enquiryCount+=rows.length;
      }
      if(sourceRows.length<500)break;
    }

    const usageAllowed=[
      'id','provider','model','purpose','requested_by','input_tokens','output_tokens',
      'cached_input_tokens','estimated_cost_usd','created_at'
    ];
    let usageCount=0;
    for(let from=0;;from+=500){
      const q=await old.from('ks_keyai_usage').select('*').order('created_at',{ascending:true}).range(from,from+499);
      if(q.error){
        // Usage is useful but must not block Telegram history migration.
        console.warn('Legacy usage import skipped:',errorText(q.error));
        break;
      }
      const sourceRows=Array.isArray(q.data)?q.data:[];
      const rows=sourceRows.map((r:any)=>{
        const row:Record<string,unknown>={};
        for(const key of usageAllowed)if(Object.prototype.hasOwnProperty.call(r,key))row[key]=r[key];
        row.id=String(r.id??crypto.randomUUID());
        return row;
      });
      if(rows.length){
        const ins=await service.from('ks_keyai_usage').upsert(rows,{onConflict:'id'});
        if(ins.error){
          console.warn('Legacy usage save skipped:',errorText(ins.error));
          break;
        }
        usageCount+=rows.length;
      }
      if(sourceRows.length<500)break;
    }

    const now=new Date().toISOString();
    if(hasImportTracking){
      const mark=await service.from('ks_app_settings').update({keyai_unified_imported_at:now,keyai_legacy_source:sourceUrl}).eq('id','default');
      if(mark.error)console.warn('Marking KeyBot migration complete skipped:',errorText(mark.error));
    }
    return {needed:false,imported:true,at:now,enquiries:enquiryCount,usage:usageCount,tracking:hasImportTracking};
  }catch(error){
    console.error('Legacy KeyBot import failed',error);
    return {
      needed:true,
      imported:false,
      error:errorText(error),
      reason:'KeySuite is running, but old KeyBot history could not be copied yet.'
    };
  }
}

async function syncLegacyLatest(service:any){
  try{
    const sourceUrl=env('KEYAI_SUPABASE_URL');
    const sourceKey=env('KEYAI_SUPABASE_SERVICE_ROLE_KEY','KEYAI_SUPABASE_SECRET_KEY');
    if(!sourceUrl||!sourceKey)return {enabled:false,synced:0,reason:'Legacy KeyAI secrets are not present.'};

    const localUrl=String(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'');
    if(sourceUrl.replace(/\/$/,'')===localUrl)return {enabled:false,synced:0,reason:'Legacy source is already the KeySuite project.'};

    const old=createClient(sourceUrl,sourceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const q=await old.from('ks_keyai_enquiries')
      .select('*')
      .eq('source','telegram')
      .order('created_at',{ascending:false})
      .limit(500);

    if(q.error)throw new Error(`Legacy latest inbox: ${errorText(q.error)}`);

    const sourceRows=Array.isArray(q.data)?q.data:[];
    if(!sourceRows.length)return {enabled:true,synced:0,checked:0};

    const enquiryAllowed=[
      'id','source','external_update_id','external_message_id','external_chat_id',
      'sender_username','sender_name','raw_message','status','ai_enabled','ai_model',
      'ai_summary','ai_result','ai_error','clarification_question','clarification_questions',
      'parent_enquiry_id','conversation_id','external_sender_id','keyai_company_id',
      'keyai_customer_id','created_at','updated_at'
    ];

    const updateIds=sourceRows
      .map((r:any)=>Number(r?.external_update_id))
      .filter((v:number)=>Number.isFinite(v));

    const existingIds=new Set<number>();
    if(updateIds.length){
      const existing=await service.from('ks_keyai_enquiries')
        .select('external_update_id')
        .eq('source','telegram')
        .in('external_update_id',updateIds);
      if(existing.error)throw new Error(`Checking existing Telegram updates: ${errorText(existing.error)}`);
      for(const row of (Array.isArray(existing.data)?existing.data:[])){
        const n=Number((row as any)?.external_update_id);
        if(Number.isFinite(n))existingIds.add(n);
      }
    }

    const rows=sourceRows
      .filter((r:any)=>{
        const n=Number(r?.external_update_id);
        return !Number.isFinite(n)||!existingIds.has(n);
      })
      .map((r:any)=>{
        const row:Record<string,unknown>={};
        for(const key of enquiryAllowed){
          if(Object.prototype.hasOwnProperty.call(r,key))row[key]=r[key];
        }
        row.id=String(r.id??crypto.randomUUID());
        if(Object.prototype.hasOwnProperty.call(row,'parent_enquiry_id')&&row.parent_enquiry_id!=null){
          row.parent_enquiry_id=String(row.parent_enquiry_id);
        }
        if(Object.prototype.hasOwnProperty.call(row,'conversation_id')&&row.conversation_id!=null){
          row.conversation_id=String(row.conversation_id);
        }
        return row;
      });

    if(rows.length){
      const ins=await service.from('ks_keyai_enquiries').upsert(rows,{onConflict:'id'});
      if(ins.error)throw new Error(`Saving latest Telegram catch-up: ${errorText(ins.error)}`);
    }

    return {
      enabled:true,
      synced:rows.length,
      checked:sourceRows.length,
      newest_legacy_at:sourceRows[0]?.created_at||null
    };
  }catch(error){
    console.error('Legacy latest Telegram sync failed',error);
    return {enabled:true,synced:0,error:errorText(error)};
  }
}


Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return json({error:'POST required.'},405);
  try{
    const ctx:any=await accessContext(req);if(ctx.error)return ctx.error;
    const {k,service}=ctx;
    const body=await req.json().catch(()=>({}));
    const action=String(body?.action??'').toLowerCase();

    if(action==='import_legacy'){
      if(!ctx.isOwner)return json({error:'Only the Owner can import legacy KeyBot history.'});
      const migration=await importLegacyIfNeeded(service,true);
      return json({ok:!!migration.imported,migration,error:(migration as any).error||null});
    }

    if(action==='list_inbox'){
      const migration=ctx.isOwner?await importLegacyIfNeeded(service):{needed:false,imported:false,skipped:true,reason:'Legacy history import is Owner-only.'};
      const catchup=ctx.isOwner?await syncLegacyLatest(service):{enabled:false,synced:0,skipped:true};
      const limit=Math.max(1,Math.min(200,Math.trunc(Number(body?.limit)||100)));
      const result=await service.from('ks_keyai_enquiries')
        .select('id,source,sender_username,sender_name,raw_message,status,ai_enabled,ai_model,ai_summary,ai_result,ai_error,clarification_question,clarification_questions,conversation_id,parent_enquiry_id,external_message_id,external_update_id,created_at,updated_at')
        .eq('source','telegram').order('created_at',{ascending:false}).limit(limit);
      if(result.error)throw new Error(`KeyBot Inbox: ${errorText(result.error)}`);
      let telegram=await telegramWebhookStatus(k.url);
      if(ctx.isOwner&&telegram.configured&&!telegram.connected){
        telegram=await ensureTelegramWebhook(k.url);
      }
      return json({
        ok:true,
        items:Array.isArray(result.data)?result.data:[],
        migration,
        catchup,
        telegram:{
          connected:!!telegram.connected,
          configured:!!telegram.configured,
          url:(telegram as any).url||null,
          expected:(telegram as any).expected||null,
          error:(telegram as any).error||(telegram as any).last_error_message||null,
          pending_update_count:Number((telegram as any).pending_update_count||0)
        }
      });
    }

    if(action==='get_settings'){
      const migration=ctx.isOwner?await importLegacyIfNeeded(service):{needed:false,imported:false,skipped:true,reason:'Legacy history import is Owner-only.'};
      const settingsResult=await service.from('ks_app_settings').select('*').eq('id','default').maybeSingle();
      if(settingsResult.error)throw new Error(`KeyBot settings: ${errorText(settingsResult.error)}`);
      const start=new Date();start.setUTCDate(1);start.setUTCHours(0,0,0,0);
      const usageResult=await service.from('ks_keyai_usage').select('input_tokens,output_tokens,estimated_cost_usd,created_at').gte('created_at',start.toISOString()).order('created_at',{ascending:false}).limit(1000);
      const usageWarning=usageResult.error?`Usage data unavailable: ${errorText(usageResult.error)}`:'';
      const usage:any[]=usageResult.error?[]:(Array.isArray(usageResult.data)?usageResult.data:[]);
      const activityResult=await service.from('ks_keyai_enquiries').select('created_at,updated_at').eq('source','telegram').order('updated_at',{ascending:false}).limit(1).maybeSingle();
      const activityWarning=activityResult.error?`KeyBot activity unavailable: ${errorText(activityResult.error)}`:'';
      const activity:any=activityResult.error?null:activityResult.data;
      const s:any=settingsResult.data||{};
      let telegram=await telegramWebhookStatus(k.url);
      if(ctx.isOwner&&telegram.configured&&!telegram.connected){
        telegram=await ensureTelegramWebhook(k.url);
      }
      return json({ok:true,settings:{openai_enabled:!!s.keyai_openai_enabled,openai_model:String(s.keyai_openai_model||'gpt-5-mini'),monthly_request_limit:Number(s.keyai_monthly_request_limit||0),last_test_at:s.keyai_openai_last_test_at||null,last_test_ok:s.keyai_openai_last_test_ok,last_test_model:s.keyai_openai_last_test_model||null,last_test_error:s.keyai_openai_last_test_error||null,last_usage_at:usage[0]?.created_at||null,last_keybot_activity_at:activity?.updated_at||activity?.created_at||null,requests:usage.length,input_tokens:usage.reduce((n,r)=>n+Number(r.input_tokens||0),0),output_tokens:usage.reduce((n,r)=>n+Number(r.output_tokens||0),0),estimated_cost_usd:usage.reduce((n,r)=>n+Number(r.estimated_cost_usd||0),0),unified_imported_at:s.keyai_unified_imported_at||null,telegram_connected:!!telegram.connected,telegram_configured:!!telegram.configured,telegram_url:(telegram as any).url||null,telegram_expected_url:(telegram as any).expected||null,telegram_error:(telegram as any).error||(telegram as any).last_error_message||null,pending_update_count:Number((telegram as any).pending_update_count||0),usage_warning:[usageWarning,activityWarning].filter(Boolean).join(' ')||null},permissions:{access:true,openai_control:!!ctx.openAiControl,sender_assign:!!ctx.senderAssign},migration});
    }

    if(action==='save_settings'){
      const model=String(body?.model??'').trim();if(!model)return json({error:'OpenAI Model is required.'});
      const requested=!!body?.enabled;
      const current=await service.from('ks_app_settings').select('keyai_openai_enabled').eq('id','default').maybeSingle();
      if(current.error)throw new Error(`Reading current OpenAI state: ${errorText(current.error)}`);
      const currentEnabled=!!(current.data as any)?.keyai_openai_enabled;
      if(requested!==currentEnabled&&!ctx.openAiControl)return json({error:'Your role can access KeyBot but does not have “KeyBot OpenAI ON / OFF” authority.'});
      const saved=await service.from('ks_app_settings').update({keyai_openai_enabled:requested,keyai_openai_model:model,keyai_monthly_request_limit:Math.max(0,Math.trunc(Number(body?.monthly_request_limit)||0))}).eq('id','default').select('id,keyai_openai_enabled,keyai_openai_model,keyai_monthly_request_limit').single();
      if(saved.error)throw new Error(`Saving KeyBot settings: ${errorText(saved.error)}`);
      if(!saved.data||!!saved.data.keyai_openai_enabled!==requested)throw new Error('KeyBot ON/OFF setting did not persist in KeySuite.');
      const telegram=await ensureTelegramWebhook(k.url);
      return json({ok:true,settings:{openai_enabled:!!saved.data.keyai_openai_enabled,openai_model:String(saved.data.keyai_openai_model||model),monthly_request_limit:Number(saved.data.keyai_monthly_request_limit||0),telegram_connected:!!telegram.connected,telegram_configured:!!telegram.configured,telegram_error:(telegram as any).error||(telegram as any).last_error_message||null,telegram_url:(telegram as any).url||null}});
    }

    if(action==='test_openai'){
      const response=await fetch(`${k.url.replace(/\/$/,'')}/functions/v1/keyai-openai`,{method:'POST',headers:{'Authorization':`Bearer ${k.service}`,'apikey':k.service,'Content-Type':'application/json'},body:JSON.stringify({mode:'test'})});
      const result=await response.json().catch(()=>({error:`keyai-openai returned HTTP ${response.status}`}));
      return json((result&&typeof result==='object')?result:{ok:false,error:errorText(result)});
    }
    return json({error:'Unknown KeySuite KeyBot action.'});
  }catch(error){console.error(error);return json({ok:false,error:errorText(error)},200)}
});
