/* KeySuite V4.02.05 - Motor & Baseplate integration
   Event-driven only: no MutationObserver and no recurring polling loop.
*/
(function(g){
  'use strict';
  var VERSION='4.02.05';
  var D=g.KeySuiteMotorBaseplateDataV40205;
  if(!D){ console.error('[KeySuite V4.02.05] Motor/Baseplate master data is not loaded.'); return; }

  function str(v){ return v===null||v===undefined?'':String(v).trim(); }
  function num(v){
    if(typeof v==='number' && Number.isFinite(v)) return v;
    var s=str(v).replace(/,/g,'');
    var m=s.match(/-?\d+(?:\.\d+)?/);
    return m?Number(m[0]):null;
  }
  function near(a,b){ return a!==null && b!==null && Math.abs(Number(a)-Number(b))<0.000001; }
  function clone(o){ try{return JSON.parse(JSON.stringify(o));}catch(e){return o;} }

  function normalizePole(v){
    var s=str(v).toLowerCase().replace(/\s+/g,'');
    var m=s.match(/(2|4|6|8|10)/);
    return m ? m[1]+'Pole' : '';
  }
  function normalizeEfficiency(v){
    var s=str(v).toUpperCase().replace(/\s+/g,'');
    if(s==='IE' || s==='IE1') return 'IE1';
    if(/^IE[2-5]$/.test(s)) return s;
    return '';
  }
  function normalizeEsModel(v){
    var s=str(v).toUpperCase().replace(/\u2013|\u2014/g,'-').trim();
    s=s.replace(/^B\.?G\.?\s*REICH\s+/,'').replace(/^ES\s*/,'');
    s=s.replace(/\s+/g,'');
    return s;
  }
  function hpFromKw(kw){
    kw=num(kw);
    if(kw===null) return null;
    var rows=D.motor.hpMaster||[];
    for(var i=0;i<rows.length;i++) if(near(num(rows[i].kw),kw)) return num(rows[i].hp);
    return null;
  }
  function kwFromHp(hp){
    hp=num(hp);
    if(hp===null) return null;
    var rows=D.motor.hpMaster||[];
    for(var i=0;i<rows.length;i++) if(near(num(rows[i].hp),hp)) return num(rows[i].kw);
    return null;
  }
  function findMotorRow(table,hp){
    var rows=D.motor.tables[table]||[];
    for(var i=0;i<rows.length;i++) if(near(num(rows[i].hp),hp)) return rows[i];
    return null;
  }
  function lookupMotor(input){
    input=input||{};
    var hp=num(input.hp);
    if(hp===null) hp=num(input.motorHp);
    if(hp===null) hp=hpFromKw(input.kw!==undefined?input.kw:input.motorKw);
    var pole=normalizePole(input.pole||input.motorPole||input.speed);
    var eff=normalizeEfficiency(input.efficiencyClass||input.motorEfficiencyClass||input.motorEff||input.eff);
    if(hp===null) return {available:false,code:'MOTOR_HP_REQUIRED',message:'Motor HP/kW is required.'};
    if(!pole) return {available:false,code:'MOTOR_POLE_REQUIRED',message:'Motor pole is required.'};
    if(!eff) return {available:false,code:'MOTOR_EFF_REQUIRED',message:'Motor efficiency class is required.'};

    var table=pole+' '+eff;
    var rows=D.motor.tables[table];
    if(!rows){
      return {available:false,code:'MOTOR_TABLE_NOT_AVAILABLE',message:table+' motor data is not in the current Motor V1.2 master.',hp:hp,pole:pole,efficiencyClass:eff,table:table,futureReady:(pole==='6Pole'||pole==='8Pole')};
    }
    var r=findMotorRow(table,hp);
    if(!r) return {available:false,code:'MOTOR_HP_NOT_AVAILABLE',message:hp+'HP is not available in '+table+'.',hp:hp,pole:pole,efficiencyClass:eff,table:table};
    var frame=str(r.frame);
    var dimension=frame ? (D.motor.dimensions[frame]||null) : null;
    var warnings=[];
    if(!frame) warnings.push('Motor frame is not available in the selected motor row.');
    else if(!dimension) warnings.push('Motor frame '+frame+' has no Dimension master row.');
    var hz=num(input.hz||input.frequency||50);
    if(hz!==50) warnings.push('Performance values in Motor V1.2 are based on the current 50Hz motor tables; '+hz+'Hz is listed as an option but has no separate performance table.');
    var voltage=num(input.voltage||415);
    var phase=str(input.phase||'3Ph').toLowerCase();
    var ratedAmp=null;
    if(voltage===415 && (phase.indexOf('3')>=0 || phase.indexOf('three')>=0)) ratedAmp=num(r.amp415_3ph);
    if(voltage===240 && (phase.indexOf('1')>=0 || phase.indexOf('one')>=0)) ratedAmp=num(r.amp240_1ph);
    return {
      available:true,source:'004 - Motor 260811 - V1.2.xlsx',table:table,
      hp:hp,kw:kwFromHp(hp),pole:pole,efficiencyClass:eff,
      model:r.model,rpm:num(r.rpm),ratedAmp:ratedAmp,
      amp415_3ph:num(r.amp415_3ph),amp240_1ph:num(r.amp240_1ph),
      eff100:num(r.eff100),eff75:num(r.eff75),pf100:num(r.pf100),pf75:num(r.pf75),
      kg:num(r.kg),frame:frame||null,dimension:dimension?clone(dimension):null,
      voltage:voltage,phase:input.phase||'3Ph',hz:hz,warnings:warnings
    };
  }

  function lookupEsPump(model){
    var key=normalizeEsModel(model);
    var r=D.es.dimensions[key];
    if(!r) return {available:false,code:'ES_MODEL_NOT_AVAILABLE',message:'ES model '+str(model)+' is not in ES Dimension master.',model:key};
    var out=clone(r); out.available=true; out.model='ES '+key; out.masterModel=key; out.source='005 - ES Imp (Selection) 260808 - V1.2.xlsx';
    return out;
  }

  function selectBaseplate(input){
    input=input||{};
    var hp=num(input.motorHp!==undefined?input.motorHp:input.hp);
    var shaft=num(input.shaft);
    if(hp===null) return {available:false,code:'BASEPLATE_HP_REQUIRED',message:'Motor HP is required for baseplate selection.'};
    if(shaft===null) return {available:false,code:'BASEPLATE_SHAFT_REQUIRED',message:'ES shaft size is required for baseplate selection.'};
    var key=String(hp);
    var row=D.baseplate.selection[key];
    if(!row) return {available:false,code:'BASEPLATE_HP_NOT_AVAILABLE',message:hp+'HP has no Baseplate V1.0 selection row.',motorHp:hp,shaft:shaft};
    var group=(shaft===48)?'shaft48':((shaft===24||shaft===32||shaft===42)?'shaft24_32_42':'');
    if(!group) return {available:false,code:'BASEPLATE_SHAFT_NOT_AVAILABLE',message:'Shaft '+shaft+'mm is outside the current ES Baseplate V1.0 groups.',motorHp:hp,shaft:shaft};
    var frame=num(row[group]);
    if(frame===null) return {available:false,code:'BASEPLATE_NOT_REQUIRED_OR_DEFINED',message:'No baseplate is defined for '+hp+'HP / '+shaft+'mm in Baseplate V1.0.',motorHp:hp,shaft:shaft};
    var p=D.baseplate.frames[String(frame)];
    if(!p) return {available:false,code:'BASEPLATE_FRAME_NOT_AVAILABLE',message:'Baseplate frame '+frame+' has no property row.',motorHp:hp,shaft:shaft,frame:frame};
    return {available:true,source:'004 - Baseplate 260812 - V1.0.xlsx',motorHp:hp,shaft:shaft,shaftGroup:group,frame:frame,gap:num(p.gap),cChannel:p.cChannel,bore:num(p.bore)};
  }

  function chooseL4(l3){
    var x=num(l3)*0.15;
    if(x>=174) return 200;
    if(x>=138) return 150;
    if(x>=113) return 125;
    return 100;
  }

  function calculateEsPumpset(input){
    input=input||{};
    var model=input.masterModel||input.master_model||input.engineeringModel||input.engineering_model||input.model||input.pumpModel||input.pump_model;
    var pump=lookupEsPump(model);
    if(!pump.available) return {available:false,code:pump.code,message:pump.message,pump:pump};

    var hp=num(input.motorHp!==undefined?input.motorHp:input.motor_hp);
    var kw=num(input.motorKw!==undefined?input.motorKw:input.motor_kw);
    if(hp===null && kw!==null) hp=hpFromKw(kw);
    var motor=lookupMotor({
      hp:hp,kw:kw,
      pole:input.pole||input.motorPole||input.motor_pole||input.speed,
      efficiencyClass:input.efficiencyClass||input.motorEfficiencyClass||input.motor_efficiency_class||input.motorEff||input.motor_eff,
      voltage:input.voltage||input.motorVoltage||input.motor_voltage||415,
      phase:input.phase||input.motorPhase||input.motor_phase||'3Ph',
      hz:input.hz||input.frequency||input.motorHz||input.motor_hz||50
    });
    if(!motor.available) return {available:false,code:motor.code,message:motor.message,pump:pump,motor:motor};

    var base=selectBaseplate({motorHp:motor.hp,shaft:pump.shaft});
    if(!base.available) return {available:false,code:base.code,message:base.message,pump:pump,motor:motor,baseplate:base};
    if(!motor.dimension) return {available:false,code:'MOTOR_DIMENSION_REQUIRED',message:'Motor frame '+str(motor.frame)+' has no usable dimensions.',pump:pump,motor:motor,baseplate:base};

    var m=motor.dimension, gap=base.gap;
    var couplingGap=6, flatbar=9;
    var l1=Math.round(num(pump.A)+num(pump.F));
    var l2=Math.round(num(m.L));
    var overallL=Math.round(l1+couplingGap+l2);
    var l3=Math.round(num(pump.F)+(0.5*num(pump.M1))+couplingGap+((num(m.BB)-num(m.B))/2)+num(m.B)+num(m.C)+num(m.E));
    var l4=chooseL4(l3);
    var l5=Math.round(l3-(2*l4));
    var w1=Math.round(Math.max(326,Math.max(num(pump.N1),num(m.AB))+(2*gap)));
    var w2=Math.round(w1-gap);
    var motorCenter=num(m.H), pumpCenter=num(pump.h1);
    var heightAdjustment=Math.max(motorCenter-pumpCenter,0);
    var h4=Math.round(flatbar+heightAdjustment);
    var overallH=Math.round(num(pump.h1)+num(pump.h2)+num(base.frame)+h4);
    var estimatedWeight=Math.ceil((num(pump.kg)+num(motor.kg))*1.3);
    var holeCount=l5>1000?6:4;
    var warnings=(motor.warnings||[]).slice();

    return {
      available:true,version:VERSION,
      source:{
        motor:'004 - Motor 260811 - V1.2.xlsx',
        baseplate:'004 - Baseplate 260812 - V1.0.xlsx',
        es:'005 - ES Imp (Selection) 260808 - V1.2.xlsx'
      },
      pump:pump,motor:motor,baseplate:base,
      dimensions:{
        overall:{lengthMm:overallL,widthMm:w1,heightMm:overallH,estimatedPumpsetWeightKg:estimatedWeight},
        longitudinal:{L1:l1,L2:l2,L3:l3,L4:l4,L5:l5,couplingGapMm:couplingGap},
        width:{W1:w1,W2:w2,minimumWidthMm:326,frameGapMm:gap},
        height:{H1:num(pump.h1),H2:num(pump.h2),H3:num(base.frame),H4:h4,flatbarMm:flatbar,heightAdjustmentMm:heightAdjustment},
        mounting:{holeCount:holeCount,boreMm:base.bore,holeSpec:holeCount+' x Ø'+base.bore+' mm'},
        pump:{suction:pump.suction,discharge:pump.discharge,A:num(pump.A),F:num(pump.F),M1:num(pump.M1),N1:num(pump.N1),shaftMm:num(pump.shaft)}
      },
      warnings:warnings
    };
  }

  function first(obj,keys){
    if(!obj||typeof obj!=='object') return undefined;
    for(var i=0;i<keys.length;i++) if(obj[keys[i]]!==undefined && obj[keys[i]]!==null && str(obj[keys[i]])!=='') return obj[keys[i]];
  }
  function extractInput(o){
    o=o||{};
    var nested=o.selection||o.selected||o.result||o.payload||o.data||o.pumpData||o.pump_data||o.detail||{};
    function pick(keys){ var v=first(o,keys); return v!==undefined?v:first(nested,keys); }
    return {
      model:pick(['masterModel','master_model','engineeringModel','engineering_model','model','pumpModel','pump_model','selectedModel','selected_model']),
      motorHp:pick(['motorHp','motor_hp','motorHP','motor_hp_selected','selectedMotorHp','selected_motor_hp']),
      motorKw:pick(['motorKw','motor_kw','motorKW','selectedMotorKw','selected_motor_kw']),
      pole:pick(['pole','motorPole','motor_pole','motorPoleCode','motor_pole_code']),
      efficiencyClass:pick(['motorEfficiencyClass','motor_efficiency_class','efficiencyClass','motorEff','motor_eff','eff']),
      voltage:pick(['motorVoltage','motor_voltage','voltage']),
      phase:pick(['motorPhase','motor_phase','phase']),
      hz:pick(['motorHz','motor_hz','frequency','hz'])
    };
  }
  function isEsLike(input){
    var m=str(input&&input.model);
    return !!m && (normalizeEsModel(m) in D.es.dimensions);
  }
  function toPumpData(result){
    if(!result||!result.available) return null;
    return {
      motor_detail:clone(result.motor),
      baseplate_detail:clone(result.baseplate),
      pumpset_dimension:clone(result.dimensions),
      motor_baseplate_version:VERSION,
      motor_baseplate_source:clone(result.source)
    };
  }
  function enrichPayload(payload){
    if(!payload||typeof payload!=='object') return null;
    var input=extractInput(payload);
    if(!isEsLike(input)) return null;
    var result=calculateEsPumpset(input);
    if(result.available){
      var pd=toPumpData(result);
      try{
        payload.motor_detail=pd.motor_detail;
        payload.baseplate_detail=pd.baseplate_detail;
        payload.pumpset_dimension=pd.pumpset_dimension;
        payload.motor_baseplate=pd;
      }catch(e){}
      g.KEYSUITE_LAST_ES_MOTOR_BASEPLATE=result;
    }
    return result;
  }
  function emit(result,sourceEvent){
    if(!result) return;
    try{
      document.dispatchEvent(new CustomEvent('KEYSUITE_MOTOR_BASEPLATE_RESULT',{detail:{version:VERSION,sourceEvent:sourceEvent||'',result:result}}));
    }catch(e){}
  }

  var EVENT_NAMES=[
    'KEYSUITE_DASHBOARD_RESULT',
    'KEYSUITE_QUICK_SELECTION_RENDERED',
    'KEYSUITE_SELECTION_RESULT',
    'KEYSUITE_ES_SELECTION',
    'KEYSUITE_ES_RESULT',
    'KEYSUITE_ES_SELECTED',
    'KEYSUITE_ASSEMBLY_PUMPSET',
    'KEYSUITE_PUMPSET_CHANGED',
    'KEYSUITE_QUOTE_ITEM_FROM_SELECTOR'
  ];
  if(typeof document!=='undefined' && document.addEventListener){
    EVENT_NAMES.forEach(function(name){
      document.addEventListener(name,function(ev){ var r=enrichPayload(ev&&ev.detail); if(r) emit(r,name); },true);
    });
    document.addEventListener('KEYSUITE_MOTOR_BASEPLATE_CALCULATE',function(ev){
      var input=(ev&&ev.detail&&ev.detail.input)||((ev&&ev.detail)||{});
      var r=calculateEsPumpset(input); emit(r,'KEYSUITE_MOTOR_BASEPLATE_CALCULATE');
    });
  }
  if(g.addEventListener){
    g.addEventListener('message',function(ev){
      try{
        if(typeof location!=='undefined' && ev.origin && ev.origin!=='null' && ev.origin!==location.origin) return;
        var data=ev.data;
        if(!data||typeof data!=='object') return;
        var r=enrichPayload(data);
        if(r) emit(r,'window.message');
      }catch(e){}
    },false);
  }


  function updateVisibleVersion(){
    if(typeof document==='undefined') return;
    try{
      if(document.title) document.title=document.title.replace(/V4\.02\.04/g,'V4.02.05');
      var candidates=document.querySelectorAll('[id*="version" i],[class*="version" i],small,footer');
      for(var i=0;i<candidates.length;i++){
        var el=candidates[i], t=str(el.textContent);
        if(t==='V4.02.04' || t==='KeySuite V4.02.04' || t==='Full Suite V4.02.04'){
          el.textContent=t.replace(/V4\.02\.04/g,'V4.02.05');
        }
      }
      document.documentElement.setAttribute('data-keysuite-motor-baseplate-version','4.02.05');
    }catch(e){}
  }
  if(typeof document!=='undefined'){
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',updateVisibleVersion,{once:true});
    else updateVisibleVersion();
  }

  var api={
    version:VERSION,
    data:D,
    normalizePole:normalizePole,
    normalizeEfficiency:normalizeEfficiency,
    normalizeEsModel:normalizeEsModel,
    hpFromKw:hpFromKw,
    kwFromHp:kwFromHp,
    lookupMotor:lookupMotor,
    lookupEsPump:lookupEsPump,
    selectBaseplate:selectBaseplate,
    calculateEsPumpset:calculateEsPumpset,
    enrichPayload:enrichPayload,
    toPumpData:toPumpData
  };
  g.KeySuiteMotorBaseplateV40205=api;
  g.KEYSUITE_MOTOR_LOOKUP=lookupMotor;
  g.KEYSUITE_BASEPLATE_LOOKUP=selectBaseplate;
  g.KEYSUITE_ES_PUMPSET_DIMENSION=calculateEsPumpset;
  g.KeySuiteV40205Health={loaded:true,version:VERSION,motorTables:Object.keys(D.motor.tables).length,motorFrames:Object.keys(D.motor.dimensions).length,esModels:Object.keys(D.es.dimensions).length,baseplateFrames:Object.keys(D.baseplate.frames).length};

  try{ if(typeof document!=='undefined') document.dispatchEvent(new CustomEvent('KEYSUITE_V40205_READY',{detail:g.KeySuiteV40205Health})); }catch(e){}
})(typeof window!=='undefined'?window:globalThis);
