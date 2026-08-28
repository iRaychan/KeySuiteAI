/* KeySuite V4.12.12 canonical CHC selector core.
   This ONE file is loaded by browser KeySelector and imported by Telegram Edge Function. */
(function(g){
'use strict';
const VERSION='4.12.12';

function solve(A,b){
  A=A.map(r=>r.slice());b=b.slice();const n=A.length;
  for(let i=0;i<n;i++){
    let m=i;for(let j=i+1;j<n;j++)if(Math.abs(A[j][i])>Math.abs(A[m][i]))m=j;
    [A[i],A[m]]=[A[m],A[i]];[b[i],b[m]]=[b[m],b[i]];
    const p=Math.abs(A[i][i])<1e-15?1e-15:A[i][i];
    for(let k=i;k<n;k++)A[i][k]/=p;b[i]/=p;
    for(let j=0;j<n;j++)if(j!==i){
      const f=A[j][i];
      for(let k=i;k<n;k++)A[j][k]-=f*A[i][k];
      b[j]-=f*b[i];
    }
  }
  return b;
}
function polyfit(xs,ys,order){
  const n=order+1,A=Array.from({length:n},()=>Array(n).fill(0)),b=Array(n).fill(0);
  for(let r=0;r<n;r++){
    for(let c=0;c<n;c++)A[r][c]=xs.reduce((s,x)=>s+x**(r+c),0);
    b[r]=xs.reduce((s,x,i)=>s+ys[i]*x**r,0);
  }
  return solve(A,b);
}
function fitValue(fit,x){
  if(!fit)return NaN;
  return (fit.c||[]).reduce((s,a,i)=>s+a*x**i,0);
}
function cleanPoints(xs,ys){
  const out=[],seen=new Set();
  for(let i=0;i<(xs||[]).length;i++){
    if(xs[i]==null||ys?.[i]==null||!Number.isFinite(Number(xs[i]))||!Number.isFinite(Number(ys[i])))continue;
    const key=Number(xs[i]).toFixed(6);if(seen.has(key))continue;seen.add(key);
    out.push({x:Number(xs[i]),y:Number(ys[i])});
  }
  return out.sort((a,b)=>a.x-b.x);
}
function fitCurve(curve,key,order,scaleQ=1,scaleY=1){
  const pts=cleanPoints(curve.flow,curve[key]).map(p=>({x:p.x*scaleQ,y:p.y*scaleY}));
  if(pts.length<2)return null;
  const ord=Math.min(order,pts.length-1);
  return {pts,c:polyfit(pts.map(p=>p.x),pts.map(p=>p.y),ord),order:ord,min:pts[0].x,max:pts[pts.length-1].x};
}
function parseImpellerMix(m){
  const total=Number(m.totalImpellers||m.stages||1);
  const full=Number(m.fullImpellers!=null?m.fullImpellers:total);
  const small=Number(m.smallImpellers||0);
  const smallest=Number(m.smallestImpellers||0);
  return {total,full,small,smallest,type:smallest>0?3:(small>0?2:1)};
}
function fitMixedHeadCurve(curve,mix,r){
  if(!curve?.head_per_stage)return null;
  if(mix.small>0&&!curve.head_per_stage_2)return null;
  if(mix.smallest>0&&!curve.head_per_stage_3)return null;
  const pts=[],seen=new Set();
  for(let i=0;i<(curve.flow||[]).length;i++){
    const q0=curve.flow[i],hf=curve.head_per_stage[i];
    const hs=mix.small>0?curve.head_per_stage_2[i]:0;
    const hss=mix.smallest>0?curve.head_per_stage_3[i]:0;
    if(q0==null||hf==null||!Number.isFinite(Number(q0))||!Number.isFinite(Number(hf)))continue;
    if(mix.small>0&&(hs==null||!Number.isFinite(Number(hs))))continue;
    if(mix.smallest>0&&(hss==null||!Number.isFinite(Number(hss))))continue;
    const key=Number(q0).toFixed(6);if(seen.has(key))continue;seen.add(key);
    pts.push({x:Number(q0)*r,y:((mix.full*Number(hf))+(mix.small*Number(hs))+(mix.smallest*Number(hss)))*r*r});
  }
  pts.sort((a,b)=>a.x-b.x);if(pts.length<3)return null;
  const order=Math.min(2,pts.length-1);
  return {pts,c:polyfit(pts.map(p=>p.x),pts.map(p=>p.y),order),order,min:pts[0].x,max:pts[pts.length-1].x};
}
function fitMixedEfficiencyCurve(curve,mix,r){
  if(!curve?.efficiency)return null;
  if(mix.small>0&&!curve.efficiency_2)return null;
  if(mix.smallest>0&&!curve.efficiency_3)return null;
  const pts=[],seen=new Set();
  for(let i=0;i<(curve.flow||[]).length;i++){
    const q0=curve.flow[i],ef=curve.efficiency[i];
    const es=mix.small>0?curve.efficiency_2[i]:0;
    const ess=mix.smallest>0?curve.efficiency_3[i]:0;
    if(q0==null||ef==null||!Number.isFinite(Number(q0))||!Number.isFinite(Number(ef)))continue;
    if(mix.small>0&&(es==null||!Number.isFinite(Number(es))))continue;
    if(mix.smallest>0&&(ess==null||!Number.isFinite(Number(ess))))continue;
    const key=Number(q0).toFixed(6);if(seen.has(key))continue;seen.add(key);
    const eff=((mix.full*Number(ef))+(mix.small*Number(es))+(mix.smallest*Number(ess)))/mix.total;
    pts.push({x:Number(q0)*r,y:eff});
  }
  pts.sort((a,b)=>a.x-b.x);if(pts.length<3)return null;
  const order=Math.min(5,pts.length-1);
  return {pts,c:polyfit(pts.map(p=>p.x),pts.map(p=>p.y),order),order,min:pts[0].x,max:pts[pts.length-1].x};
}
function evaluateModel(db,m,q,h,hz=50){
  const curve=db?.curves?.[m.series];if(!curve)return null;
  const mix=parseImpellerMix(m),r=Number(hz)/Number(db.base_hz||50);
  const headFit=fitMixedHeadCurve(curve,mix,r),effFit=fitMixedEfficiencyCurve(curve,mix,r);
  if(!headFit||!effFit||q<headFit.min||q>headFit.max)return null;
  const predHead=fitValue(headFit,q);if(!Number.isFinite(predHead)||predHead<=0)return null;
  const npshFit=fitCurve(curve,'npshr',3,r,r*r);
  const eff=Math.max(1,Math.min(100,fitValue(effFit,q)));
  const npsh=Math.max(0,fitValue(npshFit,q));
  const shaft=9.81*q*predHead/3600/(eff/100);
  const powerPts=headFit.pts.map(p=>{
    const e=Math.max(1,Math.min(100,fitValue(effFit,p.x)));
    return {x:p.x,y:9.81*p.x*p.y/3600/(e/100)};
  });
  const powerOrder=Math.min(6,powerPts.length-1);
  const powerFit={pts:powerPts,c:polyfit(powerPts.map(p=>p.x),powerPts.map(p=>p.y),powerOrder),order:powerOrder,min:headFit.min,max:headFit.max};
  return {...m,impellerCurve:mix.type,impellerMix:mix,predHead,margin:predHead-h,eff,npsh,shaft,headFit,effFit,npshFit,powerFit,rpm:(Number(curve.speed_rpm)||2900)*r};
}
function modelSortParts(model){
  const raw=String(model||'').replace(/^CHC\s*/i,'').trim(),nums=raw.split('-').map(Number);
  return {family:Number.isFinite(nums[0])?nums[0]:999999,stage:Number.isFinite(nums[1])?nums[1]:999999,variant:Number.isFinite(nums[2])?nums[2]:null,raw};
}
function modelComparator(a,b){
  const A=modelSortParts(a.model),B=modelSortParts(b.model);
  if(A.family!==B.family)return A.family-B.family;
  if(A.stage!==B.stage)return A.stage-B.stage;
  const rank=v=>v===2?0:v===1?1:v===null?2:3+Number(v||0)/1000;
  const vr=rank(A.variant)-rank(B.variant);if(vr)return vr;
  return A.raw.localeCompare(B.raw,undefined,{numeric:true,sensitivity:'base'});
}
function bepInfo(candidate,dutyQ){
  if(!candidate?.effFit||!(dutyQ>0))return {flow:NaN,eff:NaN,delta:Infinity,group:4};
  const fit=candidate.effFit,min=Number(fit.min),max=Number(fit.max);let bestFlow=NaN,bestEff=-Infinity;
  for(let i=0;i<=240;i++){
    const q=min+(max-min)*i/240,e=fitValue(fit,q);
    if(Number.isFinite(e)&&e>bestEff){bestEff=e;bestFlow=q}
  }
  const delta=(Number.isFinite(bestFlow)&&dutyQ>0)?bestFlow/dutyQ-1:Infinity;let group=4;
  if(Number.isFinite(delta)){
    if(delta>=-.05-1e-12&&delta<=.03+1e-12)group=1;
    else if(delta>=-.10-1e-12&&delta<=.08+1e-12)group=2;
    else if(delta>=-.18-1e-12&&delta<=.13+1e-12)group=3;
  }
  return {flow:bestFlow,eff:bestEff,delta,group};
}
function mostSuitableCompare(a,b,dutyQ){
  // Canonical KeySuite rule: smallest motor kW -> highest efficiency -> BEP -> margin -> model order.
  if(Math.abs(Number(a.motor_kw)-Number(b.motor_kw))>1e-9)return Number(a.motor_kw)-Number(b.motor_kw);
  if(Math.abs(Number(b.eff)-Number(a.eff))>1e-9)return Number(b.eff)-Number(a.eff);
  const A=bepInfo(a,dutyQ),B=bepInfo(b,dutyQ);
  if(A.group!==B.group)return A.group-B.group;
  const ad=Math.abs(A.delta),bd=Math.abs(B.delta);
  if(Math.abs(ad-bd)>1e-9)return ad-bd;
  if(Math.abs(Number(a.margin)-Number(b.margin))>1e-9)return Number(a.margin)-Number(b.margin);
  return modelComparator(a,b);
}
function select(db,q,h,hz=50){
  q=Number(q);h=Number(h);hz=Number(hz);
  if(!(q>0&&h>0&&hz>0))return {selected:null,candidates:[],version:VERSION};
  let all=(db.models||[]).map(m=>evaluateModel(db,m,q,h,hz)).filter(x=>x&&x.margin>=-0.01&&Number(x.motor_kw)+1e-9>=Number(x.shaft));
  if(!all.length)all=(db.models||[]).map(m=>evaluateModel(db,m,q,h,hz)).filter(x=>x&&x.margin>=-0.01);
  all.forEach(x=>x._keysuiteDutyFlow=q);
  all.sort((a,b)=>mostSuitableCompare(a,b,q));
  return {selected:all[0]||null,candidates:all,version:VERSION};
}
function sampleFit(fit,count=90){
  const out=[];if(!fit)return out;
  for(let i=0;i<=count;i++){
    const x=fit.min+(fit.max-fit.min)*i/count,y=fitValue(fit,x);
    if(Number.isFinite(y))out.push({x,y});
  }
  return out;
}

g.KeySuiteCHCCore=Object.freeze({
  VERSION,select,evaluateModel,mostSuitableCompare,bepInfo,modelComparator,
  parseImpellerMix,fitMixedHeadCurve,fitMixedEfficiencyCurve,fitCurve,fitValue,polyfit,sampleFit
});
})(globalThis);
