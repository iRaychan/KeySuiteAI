(() => {
  'use strict';

  const PIN_SPECS=[{"model":"FCL 90","price_rmb":0.0,"source_row":4,"torque_nm":4.0,"max_speed_rpm":4000.0,"d1_mm":35.5,"max_shaft_mm":25.0},{"model":"FCL 100","price_rmb":37.37,"source_row":5,"torque_nm":10.0,"max_speed_rpm":4000.0,"d1_mm":40.0,"max_shaft_mm":28.0},{"model":"FCL 112","price_rmb":53.46,"source_row":6,"torque_nm":16.0,"max_speed_rpm":4000.0,"d1_mm":45.0,"max_shaft_mm":32.0},{"model":"FCL 125","price_rmb":66.33,"source_row":7,"torque_nm":25.0,"max_speed_rpm":4000.0,"d1_mm":50.0,"max_shaft_mm":35.0},{"model":"FCL 140","price_rmb":85.14,"source_row":8,"torque_nm":50.0,"max_speed_rpm":4000.0,"d1_mm":63.0,"max_shaft_mm":44.0},{"model":"FCL 160","price_rmb":112.86,"source_row":9,"torque_nm":110.0,"max_speed_rpm":4000.0,"d1_mm":80.0,"max_shaft_mm":56.0},{"model":"FCL 180","price_rmb":142.56,"source_row":10,"torque_nm":157.0,"max_speed_rpm":3500.0,"d1_mm":90.0,"max_shaft_mm":63.0},{"model":"FCL 200","price_rmb":221.76,"source_row":11,"torque_nm":250.0,"max_speed_rpm":3200.0,"d1_mm":100.0,"max_shaft_mm":70.0},{"model":"FCL 224","price_rmb":272.25,"source_row":12,"torque_nm":392.0,"max_speed_rpm":3000.0,"d1_mm":112.0,"max_shaft_mm":78.0},{"model":"FCL 250","price_rmb":417.78,"source_row":13,"torque_nm":618.0,"max_speed_rpm":2550.0,"d1_mm":125.0,"max_shaft_mm":88.0},{"model":"FCL 280","price_rmb":0.0,"source_row":14,"torque_nm":980.0,"max_speed_rpm":2300.0,"d1_mm":140.0,"max_shaft_mm":98.0},{"model":"FCL 315","price_rmb":0.0,"source_row":15,"torque_nm":1568.0,"max_speed_rpm":2050.0,"d1_mm":160.0,"max_shaft_mm":112.0},{"model":"FCL 355","price_rmb":0.0,"source_row":16,"torque_nm":2450.0,"max_speed_rpm":1800.0,"d1_mm":180.0,"max_shaft_mm":126.0},{"model":"FCL 400","price_rmb":0.0,"source_row":17,"torque_nm":3920.0,"max_speed_rpm":1600.0,"d1_mm":200.0,"max_shaft_mm":140.0},{"model":"FCL 450","price_rmb":0.0,"source_row":18,"torque_nm":6174.0,"max_speed_rpm":1400.0,"d1_mm":224.0,"max_shaft_mm":157.0},{"model":"FCL 560","price_rmb":0.0,"source_row":19,"torque_nm":9800.0,"max_speed_rpm":1150.0,"d1_mm":250.0,"max_shaft_mm":175.0},{"model":"FCL 630","price_rmb":0.0,"source_row":20,"torque_nm":15680.0,"max_speed_rpm":1000.0,"d1_mm":280.0,"max_shaft_mm":196.0}];
  const TYRE_SPECS=[{"model":"F40","price_rmb":0.0,"source_row":4,"torque_nm":24.0,"max_speed_rpm":4500.0,"pump_bush":"1008","motor_bush":"1008"},{"model":"F50","price_rmb":133.72,"source_row":5,"torque_nm":66.0,"max_speed_rpm":4500.0,"pump_bush":"1210","motor_bush":"1210"},{"model":"F60","price_rmb":185.0,"source_row":6,"torque_nm":127.0,"max_speed_rpm":4000.0,"pump_bush":"1610","motor_bush":"1610"},{"model":"F70","price_rmb":264.9,"source_row":7,"torque_nm":250.0,"max_speed_rpm":3600.0,"pump_bush":"2012","motor_bush":"1610"},{"model":"F80","price_rmb":355.91,"source_row":8,"torque_nm":375.0,"max_speed_rpm":3100.0,"pump_bush":"2517","motor_bush":"2012"},{"model":"F90","price_rmb":458.62,"source_row":9,"torque_nm":500.0,"max_speed_rpm":3000.0,"pump_bush":"2517","motor_bush":"2517"},{"model":"F100","price_rmb":597.49,"source_row":10,"torque_nm":675.0,"max_speed_rpm":2600.0,"pump_bush":"3020","motor_bush":"2517"},{"model":"F110","price_rmb":0.0,"source_row":11,"torque_nm":875.0,"max_speed_rpm":2300.0,"pump_bush":"3020","motor_bush":"3020"},{"model":"F120","price_rmb":849.69,"source_row":12,"torque_nm":1330.0,"max_speed_rpm":2050.0,"pump_bush":"3525","motor_bush":"3020"},{"model":"F140","price_rmb":0.0,"source_row":13,"torque_nm":2325.0,"max_speed_rpm":1800.0,"pump_bush":"3525","motor_bush":"3525"},{"model":"F160","price_rmb":0.0,"source_row":14,"torque_nm":3730.0,"max_speed_rpm":1600.0,"pump_bush":"4030","motor_bush":"4030"},{"model":"F180","price_rmb":0.0,"source_row":15,"torque_nm":6270.0,"max_speed_rpm":1500.0,"pump_bush":"4535","motor_bush":"4535"},{"model":"F200","price_rmb":0.0,"source_row":16,"torque_nm":9325.0,"max_speed_rpm":1300.0,"pump_bush":"4535","motor_bush":"4535"},{"model":"F220","price_rmb":0.0,"source_row":17,"torque_nm":11600.0,"max_speed_rpm":1100.0,"pump_bush":"5040","motor_bush":"5040"},{"model":"F250","price_rmb":0.0,"source_row":18,"torque_nm":14675.0,"max_speed_rpm":1000.0,"pump_bush":"-","motor_bush":"-"}];
  const BUSH_SPECS=[{"model":"1008","price_rmb":0.0,"source_row":4,"max_shaft_mm":24.0},{"model":"1210","price_rmb":12.84,"source_row":5,"max_shaft_mm":32.0},{"model":"1610","price_rmb":15.17,"source_row":6,"max_shaft_mm":42.0},{"model":"2012","price_rmb":19.84,"source_row":7,"max_shaft_mm":50.0},{"model":"2517","price_rmb":29.18,"source_row":8,"max_shaft_mm":65.0},{"model":"3020","price_rmb":51.35,"source_row":9,"max_shaft_mm":75.0},{"model":"3525","price_rmb":79.71,"source_row":10,"max_shaft_mm":90.0},{"model":"4030","price_rmb":0.0,"source_row":11,"max_shaft_mm":100.0},{"model":"4535","price_rmb":0.0,"source_row":12,"max_shaft_mm":110.0},{"model":"5040","price_rmb":0.0,"source_row":13,"max_shaft_mm":125.0}];
  const MOTOR_FRAMES=[{"hp":0.25,"frames":{"2":"63","4":"63","6":"80","8":"80"}},{"hp":0.33,"frames":{"2":"71","4":"71","6":"80","8":"80"}},{"hp":0.5,"frames":{"2":"71","4":"71","6":"80","8":"90S"}},{"hp":0.75,"frames":{"2":"71","4":"71","6":"80","8":"90L"}},{"hp":1.0,"frames":{"2":"80","4":"80","6":"90S","8":"100L"}},{"hp":1.5,"frames":{"2":"80","4":"80","6":"90L","8":"100L"}},{"hp":2.0,"frames":{"2":"90S","4":"90S","6":"100L","8":"112M"}},{"hp":3.0,"frames":{"2":"90L","4":"90L","6":"112M","8":"132S"}},{"hp":4.0,"frames":{"2":"100L","4":"100L","6":"132S","8":"132M"}},{"hp":5.5,"frames":{"2":"112M","4":"112M","6":"132M","8":"160M"}},{"hp":7.5,"frames":{"2":"132S","4":"132S","6":"132M","8":"160M"}},{"hp":10.0,"frames":{"2":"132S","4":"132S","6":"160M","8":"160L"}},{"hp":15.0,"frames":{"2":"160M","4":"160M","6":"160L","8":"180L"}},{"hp":20.0,"frames":{"2":"160M","4":"160M","6":"180L","8":"200L"}},{"hp":25.0,"frames":{"2":"160L","4":"160L","6":"200L","8":"225S"}},{"hp":30.0,"frames":{"2":"180M","4":"180M","6":"200L","8":"225M"}},{"hp":40.0,"frames":{"2":"200L","4":"200L","6":"225M","8":"250M"}},{"hp":50.0,"frames":{"2":"200L","4":"200L","6":"250M","8":"280S"}},{"hp":60.0,"frames":{"2":"225M","4":"225M","6":"280S","8":"280M"}},{"hp":75.0,"frames":{"2":"250M","4":"250M","6":"280M","8":"315S"}},{"hp":100.0,"frames":{"2":"280S","4":"280S","6":"315S","8":"315M"}},{"hp":125.0,"frames":{"2":"280M","4":"280M","6":"315M","8":"315L"}},{"hp":150.0,"frames":{"2":"315S","4":"315S","6":"315L","8":"315L"}},{"hp":175.0,"frames":{"2":"315M","4":"315M","6":"315L","8":"355M"}},{"hp":200.0,"frames":{"2":"315L","4":"315L","6":"355M","8":"355M"}},{"hp":215.0,"frames":{"2":"315L","4":"315L","6":"355M","8":"355M"}},{"hp":250.0,"frames":{"2":"315L","4":"315L","6":"355M","8":"355L"}},{"hp":270.0,"frames":{"2":"315L","4":"315L","6":"355M","8":"355L"}},{"hp":300.0,"frames":{"2":"355M","4":"355M","6":"355L","8":"x"}},{"hp":335.0,"frames":{"2":"355M","4":"355M","6":"355L","8":"x"}},{"hp":375.0,"frames":{"2":"355L","4":"355L","6":"x","8":"x"}},{"hp":420.0,"frames":{"2":"355L","4":"355L","6":"x","8":"x"}},{"hp":500.0,"frames":{"2":"355L","4":"355L","6":"x","8":"x"}}];
  const SHAFT_BY_FRAME={"63":{"2":11.0,"other":11.0},"71":{"2":14.0,"other":14.0},"80":{"2":19.0,"other":19.0},"90S":{"2":24.0,"other":24.0},"90L":{"2":24.0,"other":24.0},"100L":{"2":28.0,"other":28.0},"112M":{"2":28.0,"other":28.0},"132S":{"2":38.0,"other":38.0},"132M":{"2":38.0,"other":38.0},"160M":{"2":42.0,"other":42.0},"160L":{"2":42.0,"other":42.0},"180M":{"2":48.0,"other":48.0},"180L":{"2":48.0,"other":48.0},"200L":{"2":55.0,"other":55.0},"225S":{"2":55.0,"other":60.0},"225M":{"2":60.0,"other":60.0},"250M":{"2":60.0,"other":65.0},"280S":{"2":65.0,"other":75.0},"280M":{"2":65.0,"other":75.0},"315S":{"2":65.0,"other":80.0},"315M":{"2":65.0,"other":80.0},"315L":{"2":65.0,"other":80.0},"355M":{"2":75.0,"other":95.0},"355L":{"2":75.0,"other":95.0},"400M":{"2":85.0,"other":110.0},"400L":{"2":85.0,"other":110.0}};
  const PUMP_SHAFTS={"32-13":24.0,"32-16":24.0,"32-20":24.0,"32-26":24.0,"40-13":24.0,"40-16":24.0,"40-20":24.0,"40-26":24.0,"40-32":32.0,"40-32H":32.0,"40-32G":42.0,"50-13":24.0,"50-16":24.0,"50-20":24.0,"50-26":24.0,"50-26G":32.0,"50-32":32.0,"50-32H":32.0,"50-32G":42.0,"65-13":24.0,"65-16":24.0,"65-20":24.0,"65-20G":32.0,"65-26":32.0,"65-32":32.0,"65-32H":32.0,"65-32G":42.0,"80-16":24.0,"80-20":32.0,"80-26":32.0,"80-32":32.0,"80-32H":32.0,"80-32G":42.0,"80-40":42.0,"100-16":32.0,"100-20":32.0,"100-26":32.0,"100-26H":32.0,"100-26G":42.0,"100-32":32.0,"100-32G":42.0,"100-40":42.0,"125-20":32.0,"125-26":32.0,"125-26G":42.0,"125-32":42.0,"125-40":42.0,"150-20":32.0,"150-26":42.0,"150-32":42.0,"150-40":42.0,"200-26":42.0,"200-32":48.0,"200-40":48.0,"250-32":48.0,"250-40":48.0};
  const CURRENCIES=['USD','RMB','MYR'];
  const RARITIES=['common','many','rare'];
  let secureData={couplingProducts:[],categories:[],productMultipliers:{COUPLING:{USD:1,RMB:1,MYR:1}}};
  let access=null,bound=false,productSelectionMethod='auto',productResolvedConfig=null,productResolvedContext=null,productPumpShaftManual=false,rateHoldState=new Map(),unlockedRates=new Set();
  const productManualModels={pin_bush:'',tyre:''};

  const byId=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const number=value=>Number(value||0);
  const clone=value=>value==null?null:JSON.parse(JSON.stringify(value));
  const hpLabel=value=>Number.isInteger(number(value))?String(number(value)):String(number(value)).replace(/0+$/,'').replace(/\.$/,'');
  const normalizePumpModel=value=>String(value||'').toUpperCase().replace(/^B\.G\.REICH\s+END\s+SUCTION\s+PUMP\s+MODEL:\s*/i,'').replace(/^ES\s*/i,'').trim();
  const normalizeType=value=>String(value||'pin_bush').toLowerCase()==='tyre'?'tyre':'pin_bush';
  const normalizeMode=value=>{const mode=String(value||'flexible').toLowerCase().replace(/\s+/g,'_');return mode==='tyre'?'tyre':mode==='pin_bush'||mode==='pin'?'pin_bush':'flexible'};
  const typeLabel=value=>normalizeType(value)==='tyre'?'Tyre Coupling':'Pin & Bush Coupling';
  const modeLabel=value=>normalizeMode(value)==='flexible'?'Flexible Coupling':normalizeMode(value)==='tyre'?'Tyre Coupling':'Pin & Bush Coupling';
  const products=()=>secureData.couplingProducts||[];
  const componentRows=type=>products().filter(row=>String(row.componentType||row.component_type)===type&&row.active!==false);
  const numericModel=value=>number(String(value||'').match(/\d+(?:\.\d+)?/)?.[0]);
  const sortedComponents=type=>[...componentRows(type)].sort((a,b)=>numericModel(a.model)-numericModel(b.model));
  const findComponent=(type,model)=>componentRows(type).find(row=>String(row.model).toUpperCase()===String(model||'').toUpperCase())||null;
  const effectiveMaxSpeed=row=>String(row?.model||'').toUpperCase()==='FCL 224'?Math.max(3000,number(row?.maxSpeedRpm||row?.max_speed_rpm)):number(row?.maxSpeedRpm||row?.max_speed_rpm);
  const fBushModel=row=>String(row?.fBush||row?.pumpBush||row?.pump_bush||'');
  const hBushModel=row=>String(row?.hBush||row?.motorBush||row?.motor_bush||'');
  const bushMax=model=>number(findComponent('bush',model)?.maxShaftMm||BUSH_SPECS.find(row=>row.model===String(model))?.max_shaft_mm);
  const pricingCustomer=()=>window.KeySuiteApp?.getPricingCustomer?.()||window.KeySuiteApp?.getSelectedCustomer?.()||null;
  const categories=()=>secureData.categories||[];
  const categoryFor=customer=>categories().find(row=>String(row.id)===String(customer?.pricingCategoryId||customer?.pricing_category_id||''))||null;
  const role=()=>String(access?.role||window.KEYSUITE_ACCESS?.role||'viewer').toLowerCase();
  const permissionLevel=key=>window.KeySuitePermissions?.level?.(key,role())||(role()==='owner'?'full':'none');
  const canEditPrices=()=>permissionLevel('manage_price_list')==='full';
  const validCurrency=value=>CURRENCIES.includes(String(value||'').toUpperCase())?String(value).toUpperCase():'RMB';
  const speedForPole=pole=>({2:2900,4:1450,6:960,8:720}[number(pole)]||2900);
  const torqueForMotor=(hp,pole)=>{const rpm=speedForPole(pole);return hp>0?number(hp)*.746*9550/rpm:0};

  function frameFor(hp,pole){
    const row=MOTOR_FRAMES.find(entry=>number(entry.hp)===number(hp));if(!row)return null;
    const frame=String(row.frames?.[String(number(pole))]||'');if(!frame||frame.toLowerCase()==='x')return null;
    const shaft=SHAFT_BY_FRAME[frame];return {frame,shaftSize:number(number(pole)===2?shaft?.['2']:shaft?.other)};
  }
  function pumpShaft(model){return number(PUMP_SHAFTS[normalizePumpModel(model)]||0)}
  function contextForSelection(pumpModel,hp,pole){
    const motor=frameFor(hp,pole),rpm=speedForPole(pole);
    return {pumpModel:normalizePumpModel(pumpModel),pumpShaft:pumpShaft(pumpModel),motorHp:number(hp),motorPole:number(pole||2),motorFrame:motor?.frame||'',motorShaft:number(motor?.shaftSize),motorTorque:torqueForMotor(hp,pole),motorRpm:rpm,couplingQty:1,pumpCount:1,motorCount:1};
  }
  function normalizeContext(context={}){
    const base=contextForSelection(context.pumpModel,context.motorHp,context.motorPole||2);
    return {...base,...context,pumpModel:normalizePumpModel(context.pumpModel||base.pumpModel),pumpShaft:number(context.pumpShaft||base.pumpShaft),motorHp:number(context.motorHp||base.motorHp),motorPole:number(context.motorPole||base.motorPole||2),motorShaft:number(context.motorShaft||base.motorShaft),motorTorque:number(context.motorTorque||base.motorTorque),motorRpm:number(context.motorRpm||base.motorRpm),couplingQty:Math.max(1,number(context.couplingQty||1))};
  }
  function missingContextReasons(context){const c=normalizeContext(context),reasons=[];if(!c.pumpModel)reasons.push('Pump model is not selected');if(!(c.pumpShaft>0))reasons.push('Missing pump-shaft data');if(!(c.motorShaft>0))reasons.push('Missing motor-shaft data');if(!(c.motorTorque>0))reasons.push('Missing motor torque');if(!(c.motorRpm>0))reasons.push('Missing motor speed');return reasons}
  function pinEvaluation(product,context){
    const c=normalizeContext(context),reasons=missingContextReasons(c),maxShaft=number(product?.maxShaftMm||product?.max_shaft_mm),torque=number(product?.torqueNm||product?.torque_nm),speed=effectiveMaxSpeed(product);
    if(c.pumpShaft>maxShaft)reasons.push(`Pump shaft ${c.pumpShaft} mm exceeds maximum shaft ${maxShaft} mm`);
    if(c.motorShaft>maxShaft)reasons.push(`Motor shaft ${c.motorShaft} mm exceeds maximum shaft ${maxShaft} mm`);
    if(c.motorTorque>torque)reasons.push(`Required torque ${Math.ceil(c.motorTorque)} Nm exceeds rated torque ${torque} Nm`);
    if(c.motorRpm>speed)reasons.push(`Required speed ${c.motorRpm.toLocaleString('en-MY')} rpm exceeds maximum speed ${speed.toLocaleString('en-MY')} rpm`);
    return {product,context:c,suitable:reasons.length===0,reasons,maxShaft,torque,maxSpeed:speed};
  }
  function tyreArrangements(product,context){
    const c=normalizeContext(context),f=fBushModel(product),h=hBushModel(product),arrangements=[];
    if(c.pumpShaft>24)arrangements.push({key:'pump_h_motor_f',pumpBushType:'H',pumpBush:h,motorBushType:'F',motorBush:f});
    arrangements.push({key:'pump_f_motor_h',pumpBushType:'F',pumpBush:f,motorBushType:'H',motorBush:h});
    return arrangements.filter(row=>row.pumpBush&&row.motorBush&&row.pumpBush!=='-'&&row.motorBush!=='-');
  }
  function tyreArrangementEvaluation(product,context,arrangement){
    const c=normalizeContext(context),reasons=missingContextReasons(c),torque=number(product?.torqueNm||product?.torque_nm),speed=effectiveMaxSpeed(product),pumpMax=bushMax(arrangement?.pumpBush),motorMax=bushMax(arrangement?.motorBush);
    if(c.pumpShaft<=24&&arrangement?.pumpBushType!=='F')reasons.push('Pump shafts of 24 mm or smaller must use the F Bush');
    if(!(pumpMax>0))reasons.push(`Pump ${arrangement?.pumpBushType||''} Bush data is unavailable`);else if(c.pumpShaft>pumpMax)reasons.push(`Pump shaft ${c.pumpShaft} mm exceeds ${arrangement.pumpBushType} Bush ${arrangement.pumpBush} maximum ${pumpMax} mm`);
    if(!(motorMax>0))reasons.push(`Motor ${arrangement?.motorBushType||''} Bush data is unavailable`);else if(c.motorShaft>motorMax)reasons.push(`Motor shaft ${c.motorShaft} mm exceeds ${arrangement.motorBushType} Bush ${arrangement.motorBush} maximum ${motorMax} mm`);
    if(c.motorTorque>torque)reasons.push(`Required torque ${Math.ceil(c.motorTorque)} Nm exceeds rated torque ${torque} Nm`);
    if(c.motorRpm>speed)reasons.push(`Required speed ${c.motorRpm.toLocaleString('en-MY')} rpm exceeds maximum speed ${speed.toLocaleString('en-MY')} rpm`);
    return {...arrangement,pumpBushMax:pumpMax,motorBushMax:motorMax,suitable:reasons.length===0,reasons,torque,maxSpeed:speed};
  }
  function tyreEvaluation(product,context,arrangementKey=''){
    const candidates=tyreArrangements(product,context),evaluations=candidates.map(row=>tyreArrangementEvaluation(product,context,row));
    const selected=arrangementKey?evaluations.find(row=>row.key===arrangementKey):evaluations.find(row=>row.suitable);
    const best=selected||evaluations.sort((a,b)=>a.reasons.length-b.reasons.length)[0]||{suitable:false,reasons:['No F/H Bush arrangement is available']};
    return {product,context:normalizeContext(context),suitable:!!best.suitable,reasons:best.reasons||[],arrangement:best,arrangements:evaluations};
  }
  function configFromPinEvaluation(result){const c=result.context;return {type:'pin_bush',model:result.product.model,pumpModel:c.pumpModel,pumpShaft:c.pumpShaft,motorHp:c.motorHp,motorPole:c.motorPole,motorFrame:c.motorFrame,motorShaft:c.motorShaft,motorTorque:c.motorTorque,motorRpm:c.motorRpm,pumpBush:'',motorBush:'',pumpBushType:'',motorBushType:'',couplingQty:c.couplingQty,contextKey:contextKey(c)}}
  function configFromTyreEvaluation(result){const c=result.context,a=result.arrangement;return {type:'tyre',model:result.product.model,pumpModel:c.pumpModel,pumpShaft:c.pumpShaft,motorHp:c.motorHp,motorPole:c.motorPole,motorFrame:c.motorFrame,motorShaft:c.motorShaft,motorTorque:c.motorTorque,motorRpm:c.motorRpm,pumpBush:a.pumpBush,motorBush:a.motorBush,pumpBushType:a.pumpBushType,motorBushType:a.motorBushType,pumpBushMax:a.pumpBushMax,motorBushMax:a.motorBushMax,arrangement:a.key,couplingQty:c.couplingQty,contextKey:contextKey(c)}}
  function contextKey(context){const c=normalizeContext(context);return [c.pumpModel,c.pumpShaft,c.motorShaft,Math.round(c.motorTorque*100)/100,c.motorRpm,c.couplingQty].join('|')}
  function recommendPinContext(context){for(const product of sortedComponents('pin_bush')){const result=pinEvaluation(product,context);if(result.suitable)return configFromPinEvaluation(result)}return null}
  function recommendTyreContext(context){for(const product of sortedComponents('tyre')){const result=tyreEvaluation(product,context);if(result.suitable)return configFromTyreEvaluation(result)}return null}
  function sourceComparablePrice(config){
    if(!config?.model)return 0;const books=configuredBooks(config).price,rates=couplingRates();return Math.max(number(books.USD.COUPLING)*rates.USD,number(books.RMB.COUPLING)*rates.RMB,number(books.MYR.COUPLING));
  }
  function recommendFlexibleContext(context){
    const pin=recommendPinContext(context),tyre=recommendTyreContext(context);if(!pin&&!tyre)return null;if(!pin)return {...tyre,selectionMode:'flexible',resolvedType:'tyre'};if(!tyre)return {...pin,selectionMode:'flexible',resolvedType:'pin_bush'};
    const pinFound=findConfiguredPrice(pin,{pricingMode:'assembly'}),tyreFound=findConfiguredPrice(tyre,{pricingMode:'assembly'}),pinPrice=number(pinFound?.calc?.finalPrice||sourceComparablePrice(pin)),tyrePrice=number(tyreFound?.calc?.finalPrice||sourceComparablePrice(tyre));
    const chosen=tyrePrice>pinPrice?tyre:pin;return {...chosen,selectionMode:'flexible',resolvedType:chosen.type,comparison:{pinModel:pin.model,pinPrice,tyreModel:tyre.model,tyrePrice}};
  }
  function recommendForContext(mode,context){const normalized=normalizeMode(mode);if(normalized==='tyre')return recommendTyreContext(context);if(normalized==='pin_bush')return recommendPinContext(context);return recommendFlexibleContext(context)}
  function recommend(type,pumpModel,hp,pole){return recommendForContext(type,contextForSelection(pumpModel,hp,pole))}

  function priceBook(product){return product?.pricesByCurrency||{USD:{COUPLING:number(product?.priceUsd)},RMB:{COUPLING:number(product?.priceRmb)},MYR:{COUPLING:number(product?.priceMyr)}}}
  function componentRaw(product,currency){return number(priceBook(product)?.[currency]?.COUPLING)}
  function configuredComponents(config){const type=normalizeType(config?.type);if(type==='pin_bush')return [findComponent('pin_bush',config?.model)].filter(Boolean);return [findComponent('tyre',config?.model),findComponent('bush',config?.pumpBush),findComponent('bush',config?.motorBush)].filter(Boolean)}
  function configuredBooks(config){
    const components=configuredComponents(config),expected=normalizeType(config?.type)==='tyre'?3:1;
    const price={USD:{COUPLING:0},RMB:{COUPLING:0},MYR:{COUPLING:0}},rarity={USD:{COUPLING:'common'},RMB:{COUPLING:'common'},MYR:{COUPLING:'common'}},rank={many:0,common:1,rare:2};
    CURRENCIES.forEach(currency=>{const raws=components.map(row=>componentRaw(row,currency));price[currency].COUPLING=components.length===expected&&raws.every(value=>value>0)?raws.reduce((sum,value)=>sum+value,0):0;rarity[currency].COUPLING=components.map(row=>String(row.rarity||'common').toLowerCase()).sort((a,b)=>(rank[b]??1)-(rank[a]??1))[0]||'common'});
    return {price,rarity,components};
  }
  function findConfiguredPrice(config,options={}){
    const customer=options.customer||pricingCustomer(),category=options.category||categoryFor(customer);if(!customer||!category||!config?.model)return null;
    const books=configuredBooks(config),calc=window.KeySuitePricing?.calculatePrice?.(books.price,'COUPLING',category,'COUPLING',{...options,customer,rarity:books.rarity.RMB.COUPLING,rarityBook:books.rarity,pricingMode:options.pricingMode||'quotation'});if(!calc)return null;
    const synthetic={id:books.components.map(row=>row.id).join('+'),model:config.model,configuration:{...config},componentIds:books.components.map(row=>row.id)};
    return {product:synthetic,material:'COUPLING',variant:'COUPLING',rarity:calc.rarity,calc,category,customer,family:'COUPLING',sourceExtra:{configuration:{...config},component_ids:synthetic.componentIds}};
  }
  function snapshot(found){return window.KeySuitePricing?.sourceSnapshot?.(found)||{product_family:'COUPLING',product_id:found.product.id,configuration:found.product.configuration,pricing_mode:found.calc.pricingMode,calculated_price:found.calc.finalPrice}}

  function shaftLimits(config={}){const type=normalizeType(config.type||config.resolvedType||(/^FCL\b/i.test(String(config.model||''))?'pin_bush':'tyre'));if(type==='tyre'){return {pumpMax:number(config.pumpBushMax||bushMax(config.pumpBush)),motorMax:number(config.motorBushMax||bushMax(config.motorBush)),pumpBush:config.pumpBush||'',motorBush:config.motorBush||''}}const product=findComponent('pin_bush',config.model),max=number(product?.maxShaftMm||product?.max_shaft_mm);return {pumpMax:max,motorMax:max}}

  function contextFromItems(items=[]){
    const pumps=(items||[]).filter(item=>item?.section==='pump'||String(item?.model||'').toUpperCase().startsWith('ES ')).map(item=>{const model=normalizePumpModel(item?.pumpData?.model||item?.pumpData?.quotation_model||item?.model||'');return {item,model,shaft:pumpShaft(model),qty:Math.max(0,number(item?.qty||1))}});
    const motors=(items||[]).filter(item=>item?.section==='motor'||item?.motorData).map(item=>{const parsed=window.KeySuiteMotor?.parseMotorModel?.(item?.motorData?.model||item?.model||'')||{},hp=number(item?.motorData?.hp??parsed.hp),pole=number(item?.motorData?.pole??parsed.pole??2),frame=frameFor(hp,pole);return {item,hp,pole,frame:frame?.frame||'',shaft:number(frame?.shaftSize),torque:torqueForMotor(hp,pole),rpm:speedForPole(pole),qty:Math.max(0,number(item?.qty||1))}});
    const largestPump=[...pumps].sort((a,b)=>b.shaft-a.shaft)[0]||{},largestShaftMotor=[...motors].sort((a,b)=>b.shaft-a.shaft)[0]||{},largestTorqueMotor=[...motors].sort((a,b)=>b.torque-a.torque)[0]||{};
    const pumpCount=pumps.reduce((sum,row)=>sum+row.qty,0),motorCount=motors.reduce((sum,row)=>sum+row.qty,0);
    return {pumpModel:largestPump.model||'',pumpShaft:number(largestPump.shaft),motorHp:number(largestTorqueMotor.hp),motorPole:number(largestTorqueMotor.pole||2),motorFrame:largestShaftMotor.frame||largestTorqueMotor.frame||'',motorShaft:Math.max(0,...motors.map(row=>row.shaft)),motorTorque:Math.max(0,...motors.map(row=>row.torque)),motorRpm:Math.max(0,...motors.map(row=>row.rpm)),couplingQty:Math.max(1,pumpCount,motorCount),pumpCount,motorCount,pumpItems:pumps,motorItems:motors};
  }

  function assemblyDescription(mode){return `c/w\tBaseplate with ${modeLabel(mode)}`}
  function makeItem(found,config,route='quotation'){
    const label=typeLabel(config.type),quoteModel=normalizeType(config.type)==='tyre'?`Tyre Coupling Model: ${config.model}`:`Pin & Bush Coupling Model: ${config.model}`,mode=normalizeMode(config.selectionMode||config.type);
    const description=route==='assembly'?assemblyDescription(mode):label;
    const shaftInfo={displayShaftInfo:true,pumpShaft:number(config.pumpShaft||0),motorShaft:number(config.motorShaft||0),motorPole:number(config.motorPole||2),motorSpeed:number(config.motorRpm||speedForPole(config.motorPole))};
    return {model:route==='quotation'?quoteModel:config.model,bomDescription:config.model,description,qty:number(config.couplingQty||1),unitPrice:number(found.calc.finalPrice),pricingSource:snapshot(found),productFamily:'COUPLING',isCoupling:true,shaftInfo,assemblyLevel:'PUMPSET_COMPONENT',assemblySection:'coupling',section:'coupling',couplingData:{...config,selectionMode:mode,autoSelected:route==='assembly'?false:config.autoSelected,manualModel:!!config.manualModel}};
  }
  function validateManualConfig(type,model,context,arrangement=''){
    const product=findComponent(type==='tyre'?'tyre':'pin_bush',model);if(!product)return {suitable:false,reasons:['Coupling model was not found'],config:null};
    if(type==='tyre'){const result=tyreEvaluation(product,context,arrangement);return {suitable:result.suitable,reasons:result.reasons,config:result.arrangement?configFromTyreEvaluation(result):null,evaluation:result}}
    const result=pinEvaluation(product,context);return {suitable:result.suitable,reasons:result.reasons,config:configFromPinEvaluation(result),evaluation:result};
  }
  function configureAssemblyItem(item,values={},context={}){
    const current=item?.couplingData||{},selectionMode=normalizeMode(values.selectionMode??current.selectionMode??current.type??'flexible'),c=normalizeContext(context),key=contextKey(c);
    let config=null,reasons=[];
    const modeChanged=values.selectionMode!=null&&normalizeMode(values.selectionMode)!==normalizeMode(current.selectionMode||current.type);
    if(values.model&&selectionMode!=='flexible'){
      const checked=validateManualConfig(selectionMode,values.model,c,values.arrangement||current.arrangement||'');config=checked.config;reasons=checked.reasons;if(config)config.manualModel=true;
    }else if(current.manualModel&&selectionMode!=='flexible'&&!modeChanged){
      const checked=validateManualConfig(selectionMode,current.model,c,current.arrangement||'');config=checked.config;reasons=checked.reasons;if(config)config.manualModel=true;
    }else config=recommendForContext(selectionMode,c);
    const manualRequested=selectionMode!=='flexible'&&(!!values.model||!!current.manualModel&&!modeChanged);
    if(!config||reasons.length&&!manualRequested){return {error:reasons[0]||'No suitable Coupling model is available. See the Reason column for details.',reasons,config:null,item}}
    const resolvedType=normalizeType(config.resolvedType||config.type),defaultModels={...(current.defaultModels||{})};if(!manualRequested)defaultModels[selectionMode]=config.model;config={...config,type:resolvedType,selectionMode,resolvedType,contextKey:key,autoSelected:manualRequested?false:current.autoSelected!==false,manualModel:manualRequested||!!config.manualModel,validationReasons:reasons,defaultModels,defaultModel:defaultModels[selectionMode]||config.model};
    item.model=config.model;item.bomDescription=config.model;item.description=assemblyDescription(selectionMode);item.couplingData=config;item.qty=Math.max(1,number(c.couplingQty||item.qty||1));
    const found=findConfiguredPrice(config,{pricingMode:'assembly'});if(found){item.unitPrice=number(found.calc.finalPrice);item.pricingSource=snapshot(found)}else{item.unitPrice=0;item.pricingSource={product_family:'COUPLING',configuration:{...config},pricing_mode:'assembly'}}
    return {config,found,item};
  }
  function buildAssemblyItem(mode,context){const item={model:'',bomDescription:'',description:'',qty:Math.max(1,number(context?.couplingQty||1)),unitPrice:0,pricingSource:{product_family:'COUPLING'},productFamily:'COUPLING',assemblyLevel:'PUMPSET_COMPONENT',assemblySection:'coupling',section:'coupling',couplingData:{selectionMode:normalizeMode(mode),autoSelected:true}};const result=configureAssemblyItem(item,{selectionMode:mode},context);return result.error?null:item}

  function requireContext(action){return window.KeySuiteApp?.ensureQuotationPricingContext?.(action)!==false}
  async function addConfigured(config,route){
    const standalone=clone(config||productResolvedConfig);if(!standalone){alert('Select a suitable Coupling model first.');return false}
    if(!requireContext(`add a Coupling to the ${route==='assembly'?'Assembly':'quotation'}`))return false;
    const found=findConfiguredPrice(standalone,{pricingMode:route==='assembly'?'assembly':'quotation'});if(!found){alert('No complete Coupling source price or Coupling Category Pricing Rule is available for this selection.');return false}
    const item=makeItem(found,standalone,route);
    if(route==='assembly'){const added=await window.KeySuiteAssembly?.addItem?.(item,{type:'pumpset',section:'coupling'});return added!==false}
    if(!window.KeySuitePricing?.ensureQuoteableCalculation?.(found.calc,standalone.model))return false;
    const row=window.KeySuiteApp?.addExternalQuoteItem?.(item);if(row){window.KeySuiteApp?.showPage?.('quotation');return true}alert('Unable to add the Coupling to Quotation.');return false;
  }

  function message(id,text,type='info'){const box=byId(id);if(!box)return;box.textContent=text||'';box.className=text?`auth-message show ${type}`:'auth-message'}
  function fillProductSelectors(){
    const pump=byId('couplingProductPump');if(pump){const previous=normalizePumpModel(pump.value);pump.innerHTML=Object.keys(PUMP_SHAFTS).map(model=>`<option value="${esc(model)}">${esc(`ES ${model}`)}</option>`).join('');if(PUMP_SHAFTS[previous])pump.value=previous}
    const hp=byId('couplingProductMotorHp');if(hp){const previous=hp.value;hp.innerHTML=MOTOR_FRAMES.map(row=>`<option value="${row.hp}">${esc(hpLabel(row.hp))} HP</option>`).join('');if(MOTOR_FRAMES.some(row=>String(row.hp)===previous))hp.value=previous}
  }
  function modelOptions(type,selected){return sortedComponents(normalizeType(type)==='tyre'?'tyre':'pin_bush').map(row=>`<option value="${esc(row.model)}" ${row.model===selected?'selected':''}>${esc(row.model)}</option>`).join('')}
  function productAutoPumpShaft(){return pumpShaft(normalizePumpModel(byId('couplingProductPump')?.value))}
  function updateProductPumpShaftAppearance(){const input=byId('couplingProductPumpShaft');if(!input)return;input.classList.toggle('non-default-selection',!!productPumpShaftManual);input.setAttribute('aria-invalid','false');input.dataset.manualOverride=productPumpShaftManual?'1':'0';input.title=productPumpShaftManual?'Manual Pump Shaft override — used for coupling sizing.':'Auto-filled from Pump Model. Manual entries are highlighted and used for coupling sizing.'}
  function syncProductPumpShaftInput(forceAuto=false){const input=byId('couplingProductPumpShaft');if(!input)return;const auto=productAutoPumpShaft();if(forceAuto||!productPumpShaftManual||!String(input.value||'').trim())input.value=auto>0?String(auto):'';updateProductPumpShaftAppearance()}
  function productContext(){const base=contextForSelection(normalizePumpModel(byId('couplingProductPump')?.value),number(byId('couplingProductMotorHp')?.value),number(byId('couplingProductMotorPole')?.value||2)),input=byId('couplingProductPumpShaft'),raw=String(input?.value||'').trim(),manual=productPumpShaftManual&&raw!==''&&number(raw)>0;return {...base,pumpShaft:manual?number(raw):base.pumpShaft,pumpShaftManual:manual}}
  function productType(){return normalizeType(byId('couplingProductType')?.value)}
  function selectedProductResult(){
    const type=productType(),context=productContext();if(productSelectionMethod==='auto'){const config=recommendForContext(type,context);return {config,suitable:!!config,reasons:config?[]:['No model satisfies all shaft, torque and speed requirements']}}
    const model=byId('couplingProductModel')?.value||productManualModels[type]||'',arrangement=byId('couplingProductArrangement')?.value||'';const checked=validateManualConfig(type,model,context,arrangement);return checked;
  }
  function selectedProductConfig(){const result=selectedProductResult(),config=result.config||productResolvedConfig;if(!config)return null;return {...clone(config),selectionMode:config.type,autoSelected:false,manualModel:productSelectionMethod==='manual',productSelection:true}}
  function renderBushInfo(config,context){
    const body=byId('couplingTyreBushInfoRows');if(!body)return;if(!config||config.type!=='tyre'){body.innerHTML='<tr><td colspan="6" class="muted">Select a Tyre Coupling model to view F/H Bush information.</td></tr>';return}
    const rows=[{position:'Pump',type:config.pumpBushType,model:config.pumpBush,actual:context.pumpShaft,max:bushMax(config.pumpBush)},{position:'Motor',type:config.motorBushType,model:config.motorBush,actual:context.motorShaft,max:bushMax(config.motorBush)}];
    body.innerHTML=rows.map(row=>`<tr><td>${row.position}</td><td>${row.type} Bush</td><td><b>${esc(row.model)}</b></td><td>${number(row.actual)} mm</td><td>${number(row.max)} mm</td><td>${number(row.actual)<=number(row.max)?'<span class="coupling-status suitable">Suitable</span>':'<span class="coupling-status unsuitable">Not Suitable</span>'}</td></tr>`).join('');
  }
  function suitabilityForRow(type,row,context){if(type==='tyre')return tyreEvaluation(row,context);return pinEvaluation(row,context)}
  function renderSuitability(type,context){
    const body=byId('couplingSuitabilityRows');if(!body)return;body.innerHTML=sortedComponents(type==='tyre'?'tyre':'pin_bush').map(row=>{const result=suitabilityForRow(type,row,context),arr=result.arrangement,config=result.suitable?(type==='tyre'?configFromTyreEvaluation(result):configFromPinEvaluation(result)):null,books=config?configuredBooks(config).price:null,hasPrice=books&&CURRENCIES.some(currency=>number(books[currency]?.COUPLING)>0),reason=result.suitable?`Meets shaft, torque and speed requirements${hasPrice?'':'; complete source price is missing'}`:(result.reasons||[]).join('; '),bush=type==='tyre'&&arr?`${arr.pumpBushType}:${arr.pumpBush} / ${arr.motorBushType}:${arr.motorBush}`:'—';return `<tr><td><b>${esc(row.model)}</b></td><td>${type==='tyre'?esc(bush):`${number(row.maxShaftMm)} mm`}</td><td>${result.suitable?'<span class="coupling-status suitable">Suitable</span>':'<span class="coupling-status unsuitable">Not Suitable</span>'}</td><td>${esc(reason)}</td></tr>`}).join('');
  }
  function renderProduct(){
    updateProductPumpShaftAppearance();
    const type=productType(),context=productContext(),modelSelect=byId('couplingProductModel'),autoConfig=recommendForContext(type,context),selectedBefore=modelSelect?.value||productManualModels[type];
    if(modelSelect){const desired=productSelectionMethod==='auto'?autoConfig?.model:(selectedBefore||sortedComponents(type==='tyre'?'tyre':'pin_bush')[0]?.model);modelSelect.innerHTML=modelOptions(type,desired);if(desired&&[...modelSelect.options].some(option=>option.value===desired))modelSelect.value=desired;modelSelect.disabled=productSelectionMethod==='auto'}
    if(productSelectionMethod==='manual'&&modelSelect)productManualModels[type]=modelSelect.value;
    const arrangement=byId('couplingProductArrangement');if(arrangement){const options=context.pumpShaft>24?[['pump_h_motor_f','Pump H / Motor F'],['pump_f_motor_h','Pump F / Motor H']]:[['pump_f_motor_h','Pump F / Motor H (required for pump shaft ≤ 24 mm)']];const prior=arrangement.value;arrangement.innerHTML=options.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');if(options.some(([value])=>value===prior))arrangement.value=prior;arrangement.disabled=productSelectionMethod==='auto'}
    const result=selectedProductResult(),config=result.config,motor=frameFor(context.motorHp,context.motorPole),tyre=type==='tyre';productResolvedConfig=config&&result.suitable!==false?clone(config):null;productResolvedContext=clone(context);byId('couplingTyreBushFields')?.classList.toggle('hidden',!tyre);
    const badge=byId('couplingSelectionBadge');if(badge){badge.textContent=productSelectionMethod==='auto'?'Auto Selected':'Manually Selected';badge.className=`coupling-selection-badge ${productSelectionMethod}`}
    document.querySelectorAll('[data-coupling-selection-method]').forEach(button=>button.classList.toggle('active',button.dataset.couplingSelectionMethod===productSelectionMethod));
    const description=config?typeLabel(config.type):'No suitable coupling is available. See the Reason column for details.';
    const fields={couplingSelectedPumpShaft:`${context.pumpShaft||0} mm${context.pumpShaftManual?' (Manual)':''}`,couplingSelectedMotorFrame:motor?.frame||'—',couplingSelectedMotorShaft:context.motorShaft?`${context.motorShaft} mm`:'—',couplingSelectedModel:config?.model||'No suitable model',couplingSelectedDescription:description,couplingSelectedTorque:`${Math.ceil(context.motorTorque||0)} Nm`,couplingSelectedSpeed:`${number(context.motorRpm||0).toLocaleString('en-MY')} rpm`};Object.entries(fields).forEach(([id,value])=>{if(byId(id))byId(id).textContent=value});
    renderBushInfo(config,context);renderSuitability(type,context);
    const valid=!!config&&result.suitable!==false;['couplingSelectedAssembly','couplingSelectedQuote'].forEach(id=>{if(byId(id))byId(id).disabled=!valid});
    message('couplingProductMessage',result.suitable===false?(result.reasons||[]).join('; '):'',result.suitable===false?'error':'info');
    const customer=pricingCustomer(),category=categoryFor(customer),notice=byId('couplingProductNotice');if(notice)notice.textContent=customer&&category?`Pricing customer: ${customer.company||customer.name||'Selected customer'} · ${category.name}`:'Select a quotation customer with a Pricing Category before pricing a coupling.';
  }

  function currentPriceCurrency(){return validCurrency(byId('couplingPriceCurrency')?.value||localStorage.getItem('ks_coupling_price_currency')||'RMB')}
  function selectedPriceType(){return String(document.querySelector('[data-coupling-price-type].active')?.dataset.couplingPriceType||'pin_bush')}
  function storedPrice(product,currency){return componentRaw(product,currency)}
  function rarityOptions(selected){return RARITIES.map(value=>`<option value="${value}" ${value===selected?'selected':''}>${value[0].toUpperCase()+value.slice(1)}</option>`).join('')}
  function renderPriceList(){
    const body=byId('couplingPriceRows');if(!body)return;const currency=currentPriceCurrency(),type=selectedPriceType(),editable=canEditPrices(),rows=sortedComponents(type),isBush=type==='bush';
    const head=byId('couplingPriceHead');if(head)head.innerHTML=isBush?`<tr><th>Model</th><th>Maximum Shaft</th><th>Rarity</th><th id="couplingPriceValueHeading">${currency} Price</th><th></th></tr>`:`<tr><th>Model</th><th>Torque (N·m)</th><th>Max Speed (rpm)</th><th>Max Shaft</th><th>Rarity</th><th id="couplingPriceValueHeading">${currency} Price</th><th></th></tr>`;
    body.innerHTML=rows.map(row=>{const price=`<td><div class="currency-price-input"><span>${currency}</span><input class="coupling-row-price" type="number" min="0" step="0.01" value="${storedPrice(row,currency)>0?storedPrice(row,currency).toFixed(2):''}" ${editable?'':'readonly'}></div></td><td class="pricelist-row-actions"><button class="btn icon-save-button coupling-row-save" type="button" ${editable?'':'disabled'}>Save</button></td>`;return isBush?`<tr data-coupling-price-row="${esc(row.id)}"><td><b>${esc(row.model)}</b></td><td>${row.maxShaftMm?`${number(row.maxShaftMm)} mm`:'—'}</td><td><select class="coupling-row-rarity" ${editable?'':'disabled'}>${rarityOptions(String(row.rarity||'common'))}</select></td>${price}</tr>`:`<tr data-coupling-price-row="${esc(row.id)}"><td><b>${esc(row.model)}</b></td><td>${row.torqueNm?number(row.torqueNm).toLocaleString('en-MY'):'—'}</td><td>${row.maxSpeedRpm?effectiveMaxSpeed(row).toLocaleString('en-MY'):'—'}</td><td>${row.maxShaftMm?`${number(row.maxShaftMm)} mm`:'—'}</td><td><select class="coupling-row-rarity" ${editable?'':'disabled'}>${rarityOptions(String(row.rarity||'common'))}</select></td>${price}</tr>`}).join('');
    body.querySelectorAll('[data-coupling-price-row]').forEach(row=>row.querySelector('.coupling-row-save')?.addEventListener('click',()=>savePrice(row.dataset.couplingPriceRow,row)));const filled=rows.filter(row=>storedPrice(row,currency)>0).length;if(byId('couplingPriceCount'))byId('couplingPriceCount').textContent=`${rows.length} items · ${filled} priced in ${currency}`;renderRateInputs();
  }
  async function savePrice(id,row){
    if(!canEditPrices())return;const currency=currentPriceCurrency(),raw=String(row.querySelector('.coupling-row-price')?.value||'').trim(),price=raw===''?0:number(raw),rarity=row.querySelector('.coupling-row-rarity')?.value||'common',client=window.KeySuiteAuth?.getClient?.();if(!client)return;
    try{const {error}=await client.rpc('keysuite_save_coupling_price_v228',{p_product_id:id,p_currency:currency,p_price:price,p_rarity:rarity});if(error)throw error;const product=products().find(item=>item.id===id);if(product){product[`price${currency[0]+currency.slice(1).toLowerCase()}`]=price;product.pricesByCurrency=product.pricesByCurrency||{};product.pricesByCurrency[currency]={COUPLING:price};product.rarity=rarity}message('couplingPriceMessage',`${product?.model||'Coupling'} ${currency} price saved.`,'info');renderPriceList();renderProduct()}catch(error){message('couplingPriceMessage',`${error.message||error}. Run V228_SUPABASE_MIGRATION.sql first.`,'error')}
  }
  function couplingRates(){const rates=secureData.productMultipliers?.COUPLING||{};return {USD:number(rates.USD||1),RMB:number(rates.RMB||1),MYR:1}}
  function rateInput(currency){return byId(currency==='USD'?'couplingUsdMultiplier':'couplingRmbMultiplier')}
  function rateGroup(currency){return byId(`couplingMultiplierLock_${currency}`)}
  function setRateUnlocked(currency,on){const input=rateInput(currency),group=rateGroup(currency);if(on)unlockedRates.add(currency);else unlockedRates.delete(currency);if(input)input.readOnly=!on;if(group){group.classList.toggle('unlocked',on);group.classList.toggle('locked',!on);group.classList.remove('holding');const hint=group.querySelector('.multiplier-hold-feedback');if(hint)hint.textContent=on?'Unlocked — Save or Cancel':'Hold input 3s to edit';group.querySelector('.multiplier-actions')?.classList.toggle('show',on)}}
  function renderRateInputs(){const rates=couplingRates();['USD','RMB'].forEach(currency=>{const input=rateInput(currency);if(input&&document.activeElement!==input&&!unlockedRates.has(currency))input.value=number(rates[currency]).toFixed(4);setRateUnlocked(currency,unlockedRates.has(currency));if(input)input.disabled=!canEditPrices()})}
  function clearRateHold(currency){const state=rateHoldState.get(currency);if(state){clearTimeout(state.timer);clearInterval(state.interval);rateHoldState.delete(currency)}const group=rateGroup(currency);if(group&&!unlockedRates.has(currency)){group.classList.remove('holding');const hint=group.querySelector('.multiplier-hold-feedback');if(hint)hint.textContent='Hold input 3s to edit'}}
  function beginRateHold(currency,event){if(!canEditPrices()||unlockedRates.has(currency))return;event.preventDefault();clearRateHold(currency);const started=Date.now(),group=rateGroup(currency),hint=group?.querySelector('.multiplier-hold-feedback');group?.classList.add('holding');const update=()=>{const remaining=Math.max(0,3000-(Date.now()-started));if(hint)hint.textContent=`Hold ${(remaining/1000).toFixed(1)}s to edit`};update();const interval=setInterval(update,100),timer=setTimeout(()=>{clearInterval(interval);rateHoldState.delete(currency);setRateUnlocked(currency,true);rateInput(currency)?.focus()},3000);rateHoldState.set(currency,{timer,interval})}
  function cancelRateEdit(currency){const input=rateInput(currency);if(input)input.value=number(couplingRates()[currency]).toFixed(4);setRateUnlocked(currency,false)}
  async function saveRate(currency){if(!canEditPrices()||!unlockedRates.has(currency))return;const value=number(rateInput(currency)?.value),client=window.KeySuiteAuth?.getClient?.();if(!client||value<=0)return;try{const {error}=await client.rpc('keysuite_save_coupling_multiplier_v228',{p_currency:currency,p_multiplier:value});if(error)throw error;secureData.productMultipliers=secureData.productMultipliers||{};secureData.productMultipliers.COUPLING={...(secureData.productMultipliers.COUPLING||{}),[currency]:value,MYR:1};window.KeySuitePricing?.syncPriceListSettings?.({productMultipliers:secureData.productMultipliers});setRateUnlocked(currency,false);message('couplingPriceMessage',`Coupling ${currency} rate saved.`,'info');renderProduct()}catch(error){message('couplingPriceMessage',error.message||String(error),'error')}}

  function initialize(){
    fillProductSelectors();const context=window.KeySuiteAssembly?.getCurrentPumpsetContext?.();if(context?.pumpModel&&PUMP_SHAFTS[normalizePumpModel(context.pumpModel)])byId('couplingProductPump').value=normalizePumpModel(context.pumpModel);if(context?.motorHp)byId('couplingProductMotorHp').value=String(context.motorHp);if(context?.motorPole)byId('couplingProductMotorPole').value=String(context.motorPole);productPumpShaftManual=false;syncProductPumpShaftInput(true);const currency=byId('couplingPriceCurrency');if(currency)currency.value=validCurrency(localStorage.getItem('ks_coupling_price_currency')||'RMB');
  }
  function bind(){
    if(bound)return;bound=true;
    ['couplingProductType','couplingProductMotorHp','couplingProductMotorPole'].forEach(id=>byId(id)?.addEventListener('change',renderProduct));
    byId('couplingProductPump')?.addEventListener('change',()=>{productPumpShaftManual=false;syncProductPumpShaftInput(true);renderProduct()});
    byId('couplingProductPumpShaft')?.addEventListener('input',event=>{const raw=String(event.target.value||'').trim();productPumpShaftManual=raw!==''&&number(raw)>0;updateProductPumpShaftAppearance();renderProduct()});
    byId('couplingProductPumpShaft')?.addEventListener('change',()=>{if(!productPumpShaftManual)syncProductPumpShaftInput(true);renderProduct()});
    document.querySelectorAll('[data-coupling-selection-method]').forEach(button=>button.addEventListener('click',()=>{productSelectionMethod=button.dataset.couplingSelectionMethod==='manual'?'manual':'auto';renderProduct()}));
    byId('couplingProductModel')?.addEventListener('change',event=>{productManualModels[productType()]=event.target.value;renderProduct()});byId('couplingProductArrangement')?.addEventListener('change',renderProduct);
    byId('couplingSelectedAssembly')?.addEventListener('click',()=>addConfigured(selectedProductConfig(),'assembly'));byId('couplingSelectedQuote')?.addEventListener('click',()=>addConfigured(selectedProductConfig(),'quotation'));
    byId('couplingPriceCurrency')?.addEventListener('change',event=>{localStorage.setItem('ks_coupling_price_currency',validCurrency(event.target.value));renderPriceList()});document.querySelectorAll('[data-coupling-price-type]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-coupling-price-type]').forEach(item=>item.classList.toggle('active',item===button));renderPriceList()}));
    ['USD','RMB'].forEach(currency=>{const input=rateInput(currency);input?.addEventListener('pointerdown',event=>beginRateHold(currency,event));['pointerup','pointercancel','pointerleave'].forEach(type=>input?.addEventListener(type,()=>clearRateHold(currency)));rateGroup(currency)?.querySelector('[data-coupling-rate-save]')?.addEventListener('click',()=>saveRate(currency));rateGroup(currency)?.querySelector('[data-coupling-rate-cancel]')?.addEventListener('click',()=>cancelRateEdit(currency))});window.addEventListener('keysuite-customer-pricing-changed',renderProduct);
  }
  function init(data,userAccess){secureData={...secureData,...(data||{})};access=userAccess||access;const fcl200=products().find(row=>String(row.model).toUpperCase()==='FCL 200');if(fcl200){fcl200.torqueNm=250;fcl200.torque_nm=250}const fcl224=products().find(row=>String(row.model).toUpperCase()==='FCL 224');if(fcl224)fcl224.maxSpeedRpm=3000;initialize();bind();renderProduct();renderPriceList()}
  function pageShown(id){if(id==='productCoupling'){initialize();renderProduct()}if(id==='couplingPriceList')renderPriceList()}
  window.KeySuiteCoupling={init,pageShown,recommend,recommendForContext,findConfiguredPrice,configureAssemblyItem,buildAssemblyItem,contextFromItems,normalizePumpModel,typeLabel,modeLabel,speedForPole,productRows:componentRows,pinEvaluation,tyreEvaluation,validateManualConfig,assemblyDescription,shaftLimits,getProductSelection:()=>clone(productResolvedConfig),getProductContext:()=>clone(productResolvedContext),addProductSelectionToQuote:()=>addConfigured(selectedProductConfig(),'quotation')};
})();
