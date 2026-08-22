import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-keyai-internal-secret',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});

const env=(...names:string[])=>{for(const name of names){const v=String(Deno.env.get(name)??'').trim();if(v)return v}return ''};
const mappedKey=(name:string)=>{const raw=String(Deno.env.get(name)??'').trim();if(!raw)return '';try{const p=JSON.parse(raw);if(!p||typeof p!=='object'||Array.isArray(p))return '';const d=String((p as Record<string,unknown>).default??'').trim();if(d)return d;for(const value of Object.values(p as Record<string,unknown>)){const k=String(value??'').trim();if(k)return k}}catch(_){}return ''};

const keyAiSchema={
  type:'object',
  additionalProperties:false,
  properties:{
    summary:{type:'string'},
    application:{type:['string','null']},
    system_type:{type:['string','null']},
    pump_quantity:{type:['integer','null']},
    duty_configuration:{type:['string','null']},
    flow_value:{type:['number','null']},
    flow_unit:{type:['string','null']},
    flow_basis:{type:['string','null'],enum:['total_system','per_duty_pump',null]},
    head_value:{type:['number','null']},
    head_unit:{type:['string','null']},
    fluid:{type:['string','null']},
    fluid_temperature:{type:['string','null']},
    material:{type:['string','null']},
    elastomer:{type:['string','null']},
    installation:{type:['string','null']},
    suction_condition:{type:['string','null']},
    voltage:{type:['number','null']},
    phase:{type:['string','null']},
    frequency_hz:{type:['number','null']},
    critical_missing_information:{type:'array',items:{type:'string'}},
    missing_information:{type:'array',items:{type:'string'}},
    clarification_questions:{type:'array',items:{type:'string'}},
    notes:{type:['string','null']}
  },
  required:['summary','application','system_type','pump_quantity','duty_configuration','flow_value','flow_unit','flow_basis','head_value','head_unit','fluid','fluid_temperature','material','elastomer','installation','suction_condition','voltage','phase','frequency_hz','critical_missing_information','missing_information','clarification_questions','notes']
};

function pricingFor(model:string){
  const key=String(model||'').toLowerCase();
  if(key.startsWith('gpt-5-mini'))return {input:0.25,cached:0.025,output:2.00};
  if(key==='gpt-5'||key.startsWith('gpt-5-2025-'))return {input:1.25,cached:0.125,output:10.00};
  return null;
}
function estimatedCost(model:string,inputTokens:number,cachedTokens:number,outputTokens:number){
  const p=pricingFor(model);if(!p)return null;
  const cached=Math.max(0,Math.min(inputTokens,cachedTokens));
  const uncached=Math.max(0,inputTokens-cached);
  return (uncached*p.input+cached*p.cached+Math.max(0,outputTokens)*p.output)/1_000_000;
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return json({ok:false,error:'POST required.'},405);
  try{
    const supabaseUrl=env('SUPABASE_URL');
    const anonKey=env('SUPABASE_ANON_KEY','SUPABASE_PUBLISHABLE_KEY')||mappedKey('SUPABASE_PUBLISHABLE_KEYS');
    const serviceKey=env('SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY')||mappedKey('SUPABASE_SECRET_KEYS');
    const openAiKey=Deno.env.get('OPENAI_API_KEY')||'';
    if(!supabaseUrl||!anonKey||!serviceKey)throw new Error('Supabase Edge Function environment is incomplete.');
    const service=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const body=await req.json().catch(()=>({}));
    const mode=String(body?.mode||'process').toLowerCase();
    const keySuiteContext=body?.keySuiteContext&&typeof body.keySuiteContext==='object'?body.keySuiteContext:null;

    let requestedBy='';let authorised=false;let owner=false;
    const authHeaderRaw=req.headers.get('Authorization')||'';
    const bearer=authHeaderRaw.toLowerCase().startsWith('bearer ')?authHeaderRaw.slice(7).trim():'';
    // V4.12.00: same-project service credential is sufficient for trusted internal calls.
    if(bearer&&bearer===serviceKey){authorised=true;requestedBy='keysuite-internal';owner=true;}
    // Backward-compatible during migration only; KEYAI_INTERNAL_SECRET is no longer required.
    const internalSecret=Deno.env.get('KEYAI_INTERNAL_SECRET')||'';
    const suppliedInternal=req.headers.get('x-keyai-internal-secret')||'';
    if(!authorised&&internalSecret&&suppliedInternal&&suppliedInternal===internalSecret){authorised=true;requestedBy='keyai-internal';owner=true;}
    if(!authorised){
      const authHeader=req.headers.get('Authorization')||'';
      if(!authHeader.toLowerCase().startsWith('bearer '))return json({ok:false,error:'Authorisation required.'},401);
      const userClient=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
      const userResult=await userClient.auth.getUser();
      const email=String(userResult.data?.user?.email||'').toLowerCase();
      if(!email)return json({ok:false,error:'Invalid KeySuite session.'},401);
      const accessResult=await service.from('ks_user_access').select('role,active').eq('email',email).eq('active',true).limit(1).maybeSingle();
      if(accessResult.error||!accessResult.data?.active)return json({ok:false,error:'KeySuite access is not active.'},403);
      requestedBy=email;owner=String(accessResult.data.role||'').toLowerCase()==='owner';authorised=true;
    }
    if(mode==='test'&&!owner&&requestedBy!=='keyai-internal')return json({ok:false,error:'Only the Owner can test the OpenAI connection.'},403);

    const settingsResult=await service.from('ks_app_settings').select('keyai_openai_enabled,keyai_openai_model,keyai_monthly_request_limit').eq('id','default').maybeSingle();
    if(settingsResult.error)throw settingsResult.error;
    const settings=settingsResult.data||{};
    const enabled=!!settings.keyai_openai_enabled;
    const model=String(settings.keyai_openai_model||'gpt-5-mini');
    const monthlyLimit=Math.max(0,Number(settings.keyai_monthly_request_limit||0));

    const saveTestStatus=async(ok:boolean,error:string|null=null)=>{
      if(mode!=='test')return;
      try{
        await service.from('ks_app_settings').update({
          keyai_openai_last_test_at:new Date().toISOString(),
          keyai_openai_last_test_ok:ok,
          keyai_openai_last_test_model:model,
          keyai_openai_last_test_error:error
        }).eq('id','default');
      }catch(statusError){console.warn('Could not persist KeyAI test status',statusError)}
    };

    if(!enabled){await saveTestStatus(false,'KeyAI OpenAI is switched OFF by the Owner.');return json({ok:false,enabled:false,error:'KeyAI OpenAI is switched OFF by the Owner.'},409)}
    if(!openAiKey){await saveTestStatus(false,'OPENAI_API_KEY is not configured.');return json({ok:false,enabled:true,error:'OPENAI_API_KEY is not configured in Supabase Edge Function secrets.'},500)}

    if(monthlyLimit>0){
      const start=new Date();start.setUTCDate(1);start.setUTCHours(0,0,0,0);
      const countResult=await service.from('ks_keyai_usage').select('id',{count:'exact',head:true}).gte('created_at',start.toISOString());
      if(countResult.error)throw countResult.error;
      if(Number(countResult.count||0)>=monthlyLimit){
        const error=`KeyAI monthly request limit (${monthlyLimit}) has been reached.`;await saveTestStatus(false,error);
        return json({ok:false,enabled:true,error},429);
      }
    }

    const input=mode==='test'?'Reply exactly with: KeyAI OpenAI connection OK':String(body?.input||'').trim();
    if(!input)return json({ok:false,error:'No KeyAI input was supplied.'},400);
    const instructions=String(body?.instructions||'You are KeyAI for KeySuite. Understand customer pump and quotation enquiries. Do not invent engineering selections, prices, discounts or commercial terms. Return clear information for KeySuite/KeyES to process.');
    const structured=mode==='telegram'||mode==='telegram-followup';
    const requestBody:any={model,instructions,input,max_output_tokens:mode==='test'?80:3200};
    if(structured)requestBody.text={format:{type:'json_schema',name:'keyai_quotation_requirements',description:'Structured pump or system quotation requirements extracted from the customer enquiry.',strict:true,schema:keyAiSchema}};
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',headers:{'Authorization':`Bearer ${openAiKey}`,'Content-Type':'application/json'},body:JSON.stringify(requestBody)
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      const error=String(data?.error?.message||`OpenAI HTTP ${response.status}`);await saveTestStatus(false,error);
      return json({ok:false,error,model},502);
    }
    if(data?.status==='incomplete'){
      const error=`OpenAI response incomplete${data?.incomplete_details?.reason?`: ${data.incomplete_details.reason}`:''}.`;
      await saveTestStatus(false,error);
      return json({ok:false,error,model},502);
    }
    const outputText=String(data?.output_text||data?.output?.flatMap((item:any)=>item?.content||[]).find((part:any)=>part?.type==='output_text')?.text||'').trim();
    if(!outputText){const error='OpenAI returned no text output.';await saveTestStatus(false,error);return json({ok:false,error,model},502)}
    const usage=data?.usage||{};
    const inputTokens=Number(usage.input_tokens||0);
    const cachedTokens=Number(usage.input_tokens_details?.cached_tokens||0);
    const outputTokens=Number(usage.output_tokens||0);
    const cost=estimatedCost(model,inputTokens,cachedTokens,outputTokens);
    const usageRow:any={provider:'openai',model,purpose:mode,requested_by:requestedBy,input_tokens:inputTokens,output_tokens:outputTokens,cached_input_tokens:cachedTokens};
    if(cost!==null)usageRow.estimated_cost_usd=cost;
    const usageInsert=await service.from('ks_keyai_usage').insert(usageRow);
    if(usageInsert.error)console.error('KeyAI usage insert failed',usageInsert.error);
    await saveTestStatus(true,null);
    return json({ok:true,enabled:true,model,output:outputText,keySuiteContext,usage:{input_tokens:inputTokens,cached_input_tokens:cachedTokens,output_tokens:outputTokens,estimated_cost_usd:cost}});
  }catch(error){console.error(error);return json({ok:false,error:error instanceof Error?error.message:String(error)},500)}
});
