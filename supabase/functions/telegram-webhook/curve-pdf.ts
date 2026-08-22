import { PDFDocument, StandardFonts, rgb, degrees } from 'https://esm.sh/pdf-lib@1.17.1?target=deno';
import '../shared-chc/chc-data.js';
import '../shared-chc/chc-selector-core.js';
import { CHC_DIMENSIONS } from './chc-dimensions.ts';
import { REPORT_LOGO_BASE64, ES_DIMENSION_BASE64, CHC_DIMENSION_BASE64 } from './report-assets.ts';
import './es-core.js';
import './es-data.js';
import './motor-data.js';
import './v40205-motor-baseplate-data.js';
import './v40205-motor-baseplate.js';

const CHC_DB:any=(globalThis as any).KeySuiteCHCData;
const CHC_CORE:any=(globalThis as any).KeySuiteCHCCore;
const MB:any=(globalThis as any).KeySuiteMotorBaseplateV40205;
if(!CHC_DB||!CHC_CORE)throw new Error('KeySuite canonical CHC selector core/data unavailable.');

type XY={x:number,y:number};
type ChartSpec={
  yLabel:string;
  points:XY[];
  duty:XY;
  dutyLabel?:string;
  series?:Array<{points:XY[],label?:string,color?:any,width?:number,dash?:number[]}>;
  bep?:XY|null;
  bepLabel?:string;
  xLabel?:string;
  yMax?:number;
};

const finite=(v:any)=>Number.isFinite(Number(v));
const n=(v:any,d=2)=>finite(v)?Number(Number(v).toFixed(d)):0;
const fmt=(v:any,d=1)=>{const x=n(v,d);return Number.isInteger(x)?String(x):x.toFixed(d)};
const LETTER:[number,number]=[612,792];
const BLUE=rgb(0.04,0.38,0.64), DARK=rgb(0.08,0.22,0.31), GRID=rgb(0.85,0.90,0.93);
const RED=rgb(0.85,0.13,0.12), GREEN=rgb(0.02,0.50,0.33), PINK=rgb(0.90,0.68,0.69);

function b64bytes(s:string){const bin=atob(s),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
function sampleFit(f:any,count=120){return CHC_CORE.sampleFit(f,count)}
function sampleEsFit(points:XY[],order:number,yScale=1,count=180){
  const core=(globalThis as any).ESCore;
  const clean=(points||[]).filter(p=>finite(p.x)&&finite(p.y)).sort((a,b)=>a.x-b.x);
  if(!core||clean.length<2)return clean.map(p=>({x:Number(p.x),y:Number(p.y)*yScale}));
  const fit=core.polyFit(clean.map(p=>Number(p.x)),clean.map(p=>Number(p.y)),order);
  if(!fit)return clean.map(p=>({x:Number(p.x),y:Number(p.y)*yScale}));
  const out:XY[]=[];
  for(let i=0;i<=count;i++){
    const x=fit.min+(fit.max-fit.min)*i/count;
    const y=core.polyEval(fit,x,false);
    if(finite(y))out.push({x:Number(x),y:Math.max(0,Number(y)*yScale)});
  }
  return out;
}
function selectChc(q:number,h:number){return CHC_CORE.select(CHC_DB,q,h,50).selected}
function esSelect(q:number,h:number,pole:number){
  const core=(globalThis as any).ESCore,db=(globalThis as any).ES_SELECTOR_DB;
  if(!core||!db)throw new Error('ES selector engine is unavailable in the Telegram function.');
  const rpm=Number(pole)===2?2900:Number(pole)===4?1450:0;
  if(!rpm)throw new Error('ES selection requires 2 Pole or 4 Pole.');
  const results=core.selectPumpsMulti(db,{dutyPoints:[{label:'D1',totalFlowLps:q/3.6,headM:h,pumps:1}],mode:'trim',rpm});
  const r=Array.isArray(results)?results[0]:null;if(!r)return null;
  const p=r.pump,d=r.dutyPoints?.[0]||{},perf=d.performance||r.performance||{},motor=d.motor||r.motor||{};
  const points=core.curvePoints(p,Number(r.impellerMm),Number(r.speedRatio||1),120)||[];
  return {result:r,pump:p,duty:d,perf,motor,points,pole:Number(pole),rpm};
}
function motorTech(hp:number,pole:number){
  try{
    if(MB&&typeof MB.lookupMotor==='function'){
      const x=MB.lookupMotor({hp,pole,efficiencyClass:'IE3',voltage:415,phase:'3Ph',hz:50});
      if(x&&x.available)return x;
    }
  }catch(_){}
  const db=(globalThis as any).KEYSUITE_MOTOR_TECH_DB;
  const row=(db?.IE3||[]).find((x:any)=>Math.abs(Number(x.hp)-Number(hp))<.011);
  return row?{available:true,model:row.model,rpm:row.rpm,ratedAmp:row.amp3,eff100:row.eff100,eff75:row.eff75,pf100:row.pf100,pf75:row.pf75}:null;
}
function esPumpset(model:string,motorHp:number,motorKw:number,pole:number){
  try{
    return MB&&typeof MB.calculateEsPumpset==='function'
      ?MB.calculateEsPumpset({model,motorHp,motorKw,pole,efficiencyClass:'IE3',voltage:415,phase:'3Ph',hz:50})
      :null;
  }catch(_){return null}
}
function dutyParts(dutyText:string){
  const parts=String(dutyText||'').split(/\s+@\s+/);
  return {flow:(parts[0]||'-').trim(),head:(parts.slice(1).join(' @ ')||'-').trim()};
}
function niceAxis(v:number,targetIntervals=5){
  const value=Math.max(Number(v)||0,1e-9),minIntervals=4,maxIntervals=7,preferred=[1,2,2.5,5,10];
  const raw=value/targetIntervals,exponent=Math.floor(Math.log10(raw));
  let best:any=null;
  for(let e=exponent-1;e<=exponent+2;e++){
    const mag=Math.pow(10,e);
    for(const mult of preferred){
      const step=mult*mag;if(!(step>0))continue;
      const max=Math.ceil(value/step-1e-12)*step,intervals=Math.round(max/step);
      if(intervals<minIntervals||intervals>maxIntervals)continue;
      const score=Math.abs(intervals-targetIntervals)+(max-value)/Math.max(value,1e-9)*.35;
      if(!best||score<best.score)best={step,max,score};
    }
  }
  if(!best){const step=Math.pow(10,exponent);best={step,max:Math.ceil(value/step)*step};}
  return {step:Number(best.step),max:Number(best.max)};
}
function interpolate(points:XY[],x:number){
  const p=points.filter(a=>finite(a.x)&&finite(a.y)).sort((a,b)=>a.x-b.x);
  if(!p.length)return NaN;
  if(x<=p[0].x)return p[0].y;if(x>=p[p.length-1].x)return p[p.length-1].y;
  for(let i=1;i<p.length;i++)if(x<=p[i].x){
    const a=p[i-1],b=p[i],r=(x-a.x)/(b.x-a.x||1);return a.y+(b.y-a.y)*r;
  }
  return p[p.length-1].y;
}
function bepFromEff(headPoints:XY[],effPoints:XY[]){
  if(!effPoints.length)return null;
  let best=effPoints[0];for(const p of effPoints)if(p.y>best.y)best=p;
  return {x:best.x,y:interpolate(headPoints,best.x)};
}
function opFromSystem(headPoints:XY[],q:number,h:number){
  if(!(q>0&&h>0)||headPoints.length<2)return null;
  let best:any=null;
  const maxX=Math.max(...headPoints.map(p=>p.x),q)*1.05;
  for(let i=0;i<=800;i++){
    const x=maxX*i/800,pump=interpolate(headPoints,x),sys=h*Math.pow(x/q,2),d=Math.abs(pump-sys);
    if(!best||d<best.d)best={x,y:pump,d};
  }
  return best?{x:best.x,y:best.y}:null;
}
function systemPoints(q:number,h:number,maxX:number){
  const out:XY[]=[];for(let i=0;i<=90;i++){const x=maxX*i/90;out.push({x,y:h*Math.pow(x/q,2)})}return out;
}
function textWidth(font:any,text:string,size:number){try{return font.widthOfTextAtSize(String(text),size)}catch(_){return String(text).length*size*.52}}
function drawRight(page:any,font:any,text:string,right:number,y:number,size:number,color:any=DARK){
  page.drawText(String(text),{x:right-textWidth(font,String(text),size),y,size,font,color});
}
function drawCentered(page:any,font:any,text:string,cx:number,y:number,size:number,color:any=DARK){
  page.drawText(String(text),{x:cx-textWidth(font,String(text),size)/2,y,size,font,color});
}
function drawReportHeader(page:any,logo:any,bold:any,model:string){
  const x=47,right=564,lineY=738.7,logoH=28.3,logoW=139.2;
  if(logo)page.drawImage(logo,{x,y:740.7,width:logoW,height:logoH});
  drawRight(page,bold,model,right,744,23,DARK);
  page.drawLine({start:{x,y:lineY},end:{x:right,y:lineY},thickness:2.2,color:BLUE});
}
function drawDutyDrive(page:any,bold:any,font:any,duty:string,motorHp:number,pole:number,hz:number){
  drawCentered(page,bold,duty,306,712,11.5,RED);
  drawRight(page,font,`${fmt(motorHp,2)} HP ${pole}P`,564,723,11,BLUE);
  drawRight(page,font,`${fmt(hz,1)} Hz`,564,707,11,BLUE);
}
function drawPolyline(page:any,pts:XY[],X:(v:number)=>number,Y:(v:number)=>number,color:any,thickness:number){
  let prev:XY|null=null;
  for(const p of pts){
    if(!finite(p.x)||!finite(p.y)){prev=null;continue}
    if(prev)page.drawLine({start:{x:X(prev.x),y:Y(prev.y)},end:{x:X(p.x),y:Y(p.y)},thickness,color});
    prev=p;
  }
}
function drawMarker(page:any,bold:any,X:any,Y:any,p:XY|null|undefined,label:string,color:any,dx=7,dy=5){
  if(!p||!finite(p.x)||!finite(p.y))return;
  page.drawCircle({x:X(p.x),y:Y(p.y),size:4.2,color,borderColor:rgb(1,1,1),borderWidth:1});
  if(label)page.drawText(label,{x:X(p.x)+dx,y:Y(p.y)+dy,size:8.5,font:bold,color});
}
function drawFrozenChart(page:any,font:any,bold:any,x:number,y:number,w:number,h:number,s:ChartSpec,xAxisShared:any){
  page.drawRectangle({x,y,width:w,height:h,borderWidth:.7,borderColor:rgb(.80,.87,.91),color:rgb(.995,.998,1)});
  const pad={l:58,r:24,t:14,b:43},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b;
  const allSeries=(s.series&&s.series.length?s.series:[{points:s.points}]);
  const allY=allSeries.flatMap(z=>z.points.map(p=>p.y)).concat([s.duty.y,s.bep?.y||0]).filter(finite);
  const xAxis=(xAxisShared&&xAxisShared.max&&xAxisShared.step)?xAxisShared:niceAxis(Number(xAxisShared)||1,5);
  const yAxis=s.yMax?niceAxis(Number(s.yMax),5):niceAxis(Math.max(1,...allY)*1.03,5);
  if(s.yMax){yAxis.max=Number(s.yMax);yAxis.step=niceAxis(Number(s.yMax),5).step;}
  const xmax=xAxis.max,ymax=yAxis.max;
  const X=(v:number)=>x+pad.l+Math.max(0,Math.min(xmax,Number(v)))/xmax*pw;
  const Y=(v:number)=>y+pad.b+Math.max(0,Math.min(ymax,Number(v)))/ymax*ph;

  for(let xv=0;xv<=xmax+1e-9;xv+=xAxis.step){
    const xx=X(xv);
    page.drawLine({start:{x:xx,y:y+pad.b},end:{x:xx,y:y+pad.b+ph},thickness:.35,color:GRID});
    drawCentered(page,font,fmt(xv,1),xx,y+20,7,rgb(.35,.43,.50));
  }
  for(let yv=0;yv<=ymax+1e-9;yv+=yAxis.step){
    const yy=Y(yv);
    page.drawLine({start:{x:x+pad.l,y:yy},end:{x:x+pad.l+pw,y:yy},thickness:.35,color:GRID});
    drawRight(page,font,fmt(yv,1),x+pad.l-8,yy-2.5,7,rgb(.35,.43,.50));
  }

  const xl='Flow (m³/hr)';
  page.drawText(xl,{x:x+w/2-textWidth(bold,xl,8.2)/2,y:y+5,size:8.2,font:bold,color:rgb(.25,.34,.40)});
  page.drawText(s.yLabel,{x:x+16,y:y+h/2-textWidth(bold,s.yLabel,8)/2,size:8,font:bold,color:rgb(.25,.34,.40),rotate:degrees(90)});

  allSeries.forEach((ser:any)=>{
    const color=ser.color||BLUE,width=ser.width||2.1;drawPolyline(page,ser.points,X,Y,color,width);
    if(ser.label&&ser.points?.length){
      const ep=ser.points[ser.points.length-1];
      if(finite(ep.x)&&finite(ep.y))page.drawText(ser.label,{x:Math.min(x+w-90,X(ep.x)+7),y:Y(ep.y)-2,size:7.6,font:bold,color});
    }
  });
  drawMarker(page,bold,X,Y,s.duty,s.dutyLabel||'',RED,7,5);
  drawMarker(page,bold,X,Y,s.bep||null,s.bepLabel||'BEP',GREEN,7,5);
}
function drawPage1(page:any,logo:any,font:any,bold:any,args:any){
  drawReportHeader(page,logo,bold,args.model);drawDutyDrive(page,bold,font,args.dutyText,args.motorHp,args.pole,args.hz);
  const x=47,w=517,maxFlow=Math.max(1,...args.charts.flatMap((z:ChartSpec)=>(z.series&&z.series.length?z.series.flatMap(s=>s.points):z.points).map((p:any)=>p.x)),args.q),xAxis=niceAxis(maxFlow,5);
  drawFrozenChart(page,font,bold,x,505,w,190,args.charts[0],xAxis);
  drawFrozenChart(page,font,bold,x,347,w,154,args.charts[1],xAxis);
  drawFrozenChart(page,font,bold,x,189,w,154,args.charts[2],xAxis);
  drawFrozenChart(page,font,bold,x,31,w,154,args.charts[3],xAxis);
  drawRight(page,font,'ISO 9906:Grade 3B',564,14,7.5,rgb(.45,.53,.58));
}
function fitText(font:any,text:string,size:number,maxW:number){
  let s=size;while(s>6&&textWidth(font,text,s)>maxW)s-=.3;return s;
}
function drawTechHeader(page:any,logo:any,font:any,bold:any){
  if(logo)page.drawImage(logo,{x:47,y:740.7,width:139.2,height:28.3});
  page.drawText('Project:',{x:207,y:744,size:9.5,font:bold,color:rgb(0,0,0)});
  page.drawText('-',{x:207,y:729,size:9.5,font:font.regular,color:rgb(0,0,0)});
  drawRight(page,bold,'TECHNICAL DATA',564,744,9.5,rgb(0,0,0));
}
function drawCellText(page:any,font:any,text:string,x:number,y:number,w:number,h:number,bold=false,indent=0){
  const f=bold?font.bold:font.regular;
  const raw=String(text??'-'),size=fitText(f,raw,9.3,w-10-indent);
  page.drawText(raw,{x:x+6+indent,y:y+h/2-size*.36,size,font:f,color:rgb(.03,.03,.03)});
}
function drawSection(page:any,font:any,title:string,y:number){ // returns new y
  const x=42,w=511,h=20;
  page.drawRectangle({x,y:y-h,width:w,height:h,color:PINK,borderColor:rgb(.05,.05,.05),borderWidth:1.2});
  drawCentered(page,font.bold,title,x+w/2,y-h+5.3,10,rgb(.03,.03,.03));
  return y-h;
}
function drawRow4(page:any,font:any,vals:any[],y:number,h=18,weights=[.22,.28,.22,.28]){ // returns new y
  const x=42,w=511,widths=weights.map((z:number)=>w*z);
  let xx=x;
  for(let i=0;i<4;i++){
    page.drawRectangle({x:xx,y:y-h,width:widths[i],height:h,borderColor:rgb(.15,.15,.15),borderWidth:.55});
    const v=vals[i]&&typeof vals[i]==='object'?vals[i]:{text:vals[i]};
    drawCellText(page,font,v?.text??'',xx,y-h,widths[i],h,!!v?.bold,Number(v?.indent||0));
    xx+=widths[i];
  }
  return y-h;
}
function drawPage2(page:any,logo:any,font:any,bold:any,a:any){
  drawTechHeader(page,logo,font,bold);
  const d=dutyParts(a.dutyText),mt=a.motorTech||{};
  let y=718;
  y=drawSection(page,font,'Operating Data',y);
  y=drawRow4(page,font,['Application','-','',''],y);
  y=drawRow4(page,font,['Location','-','Capacity',d.flow],y);
  y=drawRow4(page,font,['Fluid','Water, Clean','Pressure',d.head],y);
  y=drawRow4(page,font,['Density','0.9983 kg/dm³','Temperature','20 °C'],y);
  y=drawRow4(page,font,['Kin. Viscosity','1.005 mm²/s','',''],y);
  y-=8;

  y=drawSection(page,font,'Pump',y);
  y=drawRow4(page,font,['Brand','B.G.Reich','Country of Origin','Malaysia'],y);
  y=drawRow4(page,font,['Type',a.family==='CHC'?'VMS Pump':'End Suction Pump','Country of Manufacture','China'],y);
  y=drawRow4(page,font,['Model',{text:a.model,bold:true},'Suction Size',a.suction],y);
  y=drawRow4(page,font,['Speed',`${fmt(a.rpm,0)} rpm`,'Discharge Size',a.discharge],y);
  y=drawRow4(page,font,['Material: -','', 'Efficiency',`${fmt(a.eff,1)} %`],y);
  y=drawRow4(page,font,[{text:'Casing',indent:10},a.material.casing,'Brake HP',`${fmt(a.brakeHp,1)} HP`],y);
  y=drawRow4(page,font,[{text:'Impeller',indent:10},a.material.impeller,a.family==='CHC'?'No. of Stage':'Impeller Diameter',a.family==='CHC'?`${fmt(a.stages,0)} Stages`:`${fmt(a.impellerMm,1)} mm`],y);
  y=drawRow4(page,font,[{text:'Shaft',indent:10},a.material.shaft,'NPSHr',`${fmt(a.npsh,1)} Mtr`],y);
  y=drawRow4(page,font,['Shaft Seal',a.material.seal,'Max Casing Pressure',`${fmt(a.maxPressure,1)} Bar`],y);
  y=drawRow4(page,font,['Bearing Type',a.family==='CHC'?'Bush':'Ball','',''],y);
  y-=8;

  y=drawSection(page,font,'Motor',y);
  y=drawRow4(page,font,['Brand','B.G.Reich','Country of Origin','Malaysia'],y);
  y=drawRow4(page,font,['Type','TEFC','Country of Manufacture','China'],y);
  y=drawRow4(page,font,['Model',mt.model||'Data Not Available','Efficiency:','IE3'],y);
  y=drawRow4(page,font,['Rated Power',`${fmt(a.motorHp,2)} HP / ${fmt(a.motorKw,2)} kW`,'100%',mt.eff100!=null?`${fmt(mt.eff100,1)} %`:'-'],y);
  y=drawRow4(page,font,['Speed',mt.rpm!=null?`${fmt(mt.rpm,0)} rpm`:'-','75%',mt.eff75!=null?`${fmt(mt.eff75,1)} %`:'-'],y);
  y=drawRow4(page,font,['Rated FL Amp',mt.ratedAmp!=null?`${fmt(mt.ratedAmp,2)} Amp`:(mt.amp3!=null?`${fmt(mt.amp3,2)} Amp`:'-'),'Power Factor:-',''],y);
  y=drawRow4(page,font,['Frequency',`${fmt(a.hz,0)} Hz`,'100%',mt.pf100!=null?fmt(mt.pf100,2):'-'],y);
  y=drawRow4(page,font,['Rated Voltage','415 Volt','75%',mt.pf75!=null?fmt(mt.pf75,2):'-'],y);
  y=drawRow4(page,font,['Phase','3 Phase','Protection','IP 55'],y);
  y=drawRow4(page,font,['Insulation Class','Class F','',''],y);
  y-=8;

  y=drawSection(page,font,'Pumpset',y);
  y=drawRow4(page,font,['Dimension: -','', 'Weight',a.pumpset.weight],y);
  y=drawRow4(page,font,[{text:'Length',indent:10},a.pumpset.length,'Coupling Type',a.family==='ES'?'Flexible':'-'],y);
  y=drawRow4(page,font,[{text:'Width',indent:10},a.pumpset.width,'',''],y);
  y=drawRow4(page,font,[{text:'Height',indent:10},a.pumpset.height,'',''],y);

  page.drawText('* Approximate dimension & weight',{x:42,y:y-15,size:7.5,font:font.regular,color:rgb(.15,.15,.15)});
  drawCentered(page,font.regular,'B.G.Reich reserves the right to make modifications without notice.',306,y-32,8,rgb(.20,.20,.20));
}
function drawDimensionHeader(page:any,logo:any,bold:any,model:string){drawReportHeader(page,logo,bold,model)}
function drawDimensionTable(page:any,font:any,x:number,y:number,leftRows:[string,string][],rightRows:[string,string][],rowH=16,widths=[64.629921,108.566929,64.629921,108.566929]){
  const leftCount=leftRows.length,rightCount=rightRows.length,total=widths.reduce((a,b)=>a+b,0);
  const line1=x;
  const line2=x+widths[0];
  const line3=x+widths[0]+widths[1]; // one centre line only
  const line4=line3+widths[2];
  const line5=x+total;
  const top=y+3;
  const leftBottom=y-leftCount*rowH+3;
  const rightBottom=y-rightCount*rowH+3;

  // Global Page 3 rule:
  // Line 1/2/3 follow the full left-side dimension list.
  // Line 3 is drawn once only at the report centre.
  // Line 4/5 retain the shorter right-side table height.
  [line1,line2,line3].forEach(xx=>page.drawLine({
    start:{x:xx,y:top},end:{x:xx,y:leftBottom},thickness:.55,color:rgb(.1,.1,.1)
  }));
  [line4,line5].forEach(xx=>page.drawLine({
    start:{x:xx,y:top},end:{x:xx,y:rightBottom},thickness:.55,color:rgb(.1,.1,.1)
  }));

  const rows=Math.max(leftCount,rightCount);
  for(let i=0;i<rows;i++){
    const yy=y-i*rowH,l=leftRows[i],r=rightRows[i];
    if(l){
      page.drawText(String(l[0]),{x:x+9,y:yy-9,size:9,font:font.regular,color:rgb(.03,.03,.03)});
      page.drawText(String(l[1]),{x:x+widths[0]+9,y:yy-9,size:9,font:font.regular,color:rgb(.03,.03,.03)});
    }
    if(r){
      page.drawText(String(r[0]),{x:line3+9,y:yy-9,size:9,font:font.regular,color:rgb(.03,.03,.03)});
      page.drawText(String(r[1]),{x:line4+9,y:yy-9,size:9,font:font.regular,color:rgb(.03,.03,.03)});
    }
  }
}
function drawPage3CHC(page:any,logo:any,font:any,bold:any,a:any,dimImage:any){
  drawDimensionHeader(page,logo,bold,a.model);
  drawCentered(page,bold,'Dimension',306,668,20,rgb(.03,.03,.03));
  page.drawLine({start:{x:255,y:664},end:{x:357,y:664},thickness:1.2,color:rgb(.03,.03,.03)});
  if(dimImage){
    // Keep a clear gap below the Dimension heading.
    // Standard CHC image zone: top <= ~625 pt, bottom >= ~245 pt.
    const d=dimImage.scale(1),maxW=315,maxH=380,scale=Math.min(maxW/d.width,maxH/d.height);
    page.drawImage(dimImage,{x:297.5-d.width*scale/2,y:245,width:d.width*scale,height:d.height*scale});
  }
  const tableX=132.803150,tableWidths=[64.629921,108.566929,64.629921,108.566929];
  page.drawText('Table Dimensions',{x:tableX,y:205,size:11.5,font:bold,color:rgb(.03,.03,.03)});
  const d=a.dim||{};
  drawDimensionTable(page,font,tableX,187,[
    ['B1',d.b1?`${fmt(d.b1,0)} mm`:'-'],
    ['B2',d.b2?`${fmt(d.b2,0)} mm`:'-'],
    ['B1+B2',d.height?`${fmt(d.height,0)} mm`:'-'],
    ['D1',d.d1?`${fmt(d.d1,0)} mm`:'-'],
    ['D2',d.d2?`${fmt(d.d2,0)} mm`:'-']
  ],[['Weight',d.weight?`${fmt(d.weight,0)} kG`:'-']],16,tableWidths);
  page.drawText('* Approximate dimension & weight',{x:tableX,y:92,size:8,font:font.regular,color:rgb(.10,.10,.10)});
}
function drawPage3ES(page:any,logo:any,font:any,bold:any,a:any,dimImage:any){
  drawDimensionHeader(page,logo,bold,a.model);
  drawCentered(page,bold,'Dimension',306,668,20,rgb(.03,.03,.03));
  page.drawLine({start:{x:255,y:664},end:{x:357,y:664},thickness:1.2,color:rgb(.03,.03,.03)});
  if(dimImage){
    const d=dimImage.scale(1),maxW=445,maxH=360,scale=Math.min(maxW/d.width,maxH/d.height);
    page.drawImage(dimImage,{x:297.5-d.width*scale/2,y:370,width:d.width*scale,height:d.height*scale});
  }
  const ps=a.esPumpset, X=ps?.dimensions||{}, P=ps?.pump||{}, M=ps?.motor||{}, B=ps?.baseplate||{};
  const lon=X.longitudinal||{},wid=X.width||{},ht=X.height||{},mount=X.mounting||{};
  const motorH=Number(M?.dimension?.H),pumpH1=Number(P?.h1),stool=finite(motorH)&&finite(pumpH1)&&motorH>pumpH1?Math.ceil(motorH-pumpH1)+3:null;
  const tableX=132.803150,tableWidths=[64.629921,108.566929,64.629921,108.566929];
  page.drawText('Table Dimensions',{x:tableX,y:284,size:11.5,font:bold,color:rgb(.03,.03,.03)});
  drawDimensionTable(page,font,tableX,266,[
    ['L1',finite(lon.L1)?`${fmt(lon.L1,0)} mm`:'-'],['L2',finite(lon.L2)?`${fmt(lon.L2,0)} mm`:'-'],
    ['L3',finite(lon.L3)?`${fmt(lon.L3,0)} mm`:'-'],['L4',finite(lon.L4)?`${fmt(lon.L4,0)} mm`:'-'],
    ['L5',finite(lon.L5)?`${fmt(lon.L5,0)} mm`:'-'],['W1',finite(wid.W1)?`${fmt(wid.W1,0)} mm`:'-'],
    ['W2',finite(wid.W2)?`${fmt(wid.W2,0)} mm`:'-'],['H1',finite(ht.H1)?`${fmt(ht.H1,0)} mm`:'-'],
    ['H2',finite(ht.H2)?`${fmt(ht.H2,0)} mm`:'-'],['H3',finite(ht.H3)?`${fmt(ht.H3,0)} mm`:'-'],
    ['H4',stool!=null&&finite(stool)?`${fmt(stool,0)} mm`:'-']
  ],[
    ['DNA',P.suction||a.suction||'-'],['DNM',P.discharge||a.discharge||'-'],
    ['A',finite(P.A)?`${fmt(P.A,0)} mm`:'-'],
    ['D',finite(mount.holeCount)&&finite(mount.boreMm)?`${fmt(mount.holeCount,0)} x ${fmt(mount.boreMm,0)} mm`:'-'],
    ['Weight',finite(X?.overall?.estimatedPumpsetWeightKg)?`${fmt(X.overall.estimatedPumpsetWeightKg,0)} kG`:'-']
  ],14,tableWidths);
  page.drawText('* Approximate dimension & weight',{x:tableX,y:91,size:8,font:font.regular,color:rgb(.10,.10,.10)});
}
function materialFor(fam:string){
  return fam==='CHC'
    ?{casing:'SS (CI Connection)',impeller:'Stainless Steel',shaft:'Stainless Steel',seal:'Mechanical Seal'}
    :{casing:'Cast Iron',impeller:'Stainless Steel',shaft:'Stainless Steel',seal:'Mechanical Seal'};
}

export async function generateCurvePdf(family:string,q:number,h:number,dutyText:string,_baseUrl:string,esPole=0){
  const fam=String(family||'').toUpperCase();
  let model='',motorKw=0,motorHp=0,eff=0,npsh=0,selectionShaft=0,dutyBrakeHp=0,rpm=0,pole=2,hz=50;
  let suction='-',discharge='-',stages=0,impellerMm=0,maxPressure=0,dim:any={},esPs:any=null;
  let headPoints:XY[]=[],effPoints:XY[]=[],powerPoints:XY[]=[],npsPoints:XY[]=[];

  if(fam==='CHC'){
    const s=selectChc(q,h);if(!s)throw new Error(`No CHC model can meet ${fmt(q)} m³/hr @ ${fmt(h)} Mtr.`);
    model=String(s.model);motorKw=Number(s.motor_kw||0);motorHp=Number(s.motor_hp||0);eff=Number(s.eff||0);npsh=Number(s.npsh||0);
    selectionShaft=Number(s.shaft||0);rpm=Number((CHC_DB as any).curves[s.series]?.speed_rpm||2900);pole=2;hz=50;
    suction=String(s.connection||'-');discharge=String(s.connection||'-');stages=Number(s.stages||0);maxPressure=Number(s.max_pressure_bar||0);dim=(CHC_DIMENSIONS as any)[s.model]||{};
    headPoints=sampleFit(s.headFit);effPoints=sampleFit(s.effFit);
    powerPoints=sampleFit(s.powerFit).map((p:any)=>({x:Number(p.x),y:Number(p.y)*1.34102209}));
    npsPoints=sampleFit(s.npshFit);
  }else if(fam==='ES'){
    pole=Number(esPole);if(pole!==2&&pole!==4)throw new Error('ES selection requires 2 Pole or 4 Pole.');
    const s=esSelect(q,h,pole);if(!s)throw new Error(`No ES ${pole} Pole model can meet ${fmt(q)} m³/hr @ ${fmt(h)} Mtr.`);
    model=`ES ${s.pump.model}`;motorKw=Number(s.motor.motorKw||0);motorHp=Number(s.motor.motorHp||0);eff=Number(s.perf.efficiencyPct||0);npsh=Number(s.perf.npshrM||0);
    selectionShaft=Number(s.perf.shaftKw||0);dutyBrakeHp=Number(s.perf.bhp||selectionShaft*1.34102209);rpm=Number(s.perf.rpm||s.pump.rpm||0);hz=Number(s.perf.frequencyHz||50);
    suction=String(s.pump.dimensions?.suction||'-');discharge=String(s.pump.dimensions?.discharge||'-');impellerMm=Number(s.result.impellerMm||0);maxPressure=Number(s.pump.dimensions?.casing_pressure_bar||0);dim=s.pump.dimensions||{};
    const pts=(s.points||[]).filter((p:any)=>finite(p.flowM3h));
    const rawHead=pts.map((p:any)=>({x:Number(p.flowM3h),y:Number(p.headM)}));
    const rawEff=pts.map((p:any)=>({x:Number(p.flowM3h),y:Number(p.efficiencyPct)}));
    const rawPowerKw=pts.map((p:any)=>({x:Number(p.flowM3h),y:Number(p.shaftKw)}));
    const rawNpsh=pts.map((p:any)=>({x:Number(p.flowM3h),y:Number(p.npshrM)}));
    // Same curve fitting as KeySelector ES Product.
    headPoints=sampleEsFit(rawHead,2,1);
    effPoints=sampleEsFit(rawEff,6,1);
    powerPoints=sampleEsFit(rawPowerKw,6,1/0.746);
    npsPoints=sampleEsFit(rawNpsh,3,1);
    esPs=esPumpset(s.pump.model,motorHp,motorKw,pole);
  }else throw new Error('Unsupported pump family.');

  // Frozen KeySelector PDF displays Brake HP at the REQUIRED duty head.
  const requiredBrakeKw=9.81*q*h/3600/(Math.max(1,eff)/100), brakeHp=fam==='ES'&&dutyBrakeHp>0?dutyBrakeHp:requiredBrakeKw*1.34102209;
  const bep=bepFromEff(headPoints,effPoints);
  let headEnvelope:any=null;
  if(fam==='ES'){
    const core=(globalThis as any).ESCore,selected=esSelect(q,h,pole),pump=selected?.pump,ratio=Number(selected?.result?.speedRatio||1);
    if(pump){
      const maxD=Number(core.dmax(pump)),minD=Number(core.dmin(pump)),selD=Number(selected.result.impellerMm);
      const defs:any[]=[];const add=(d:number)=>{if(!defs.some(x=>Math.abs(x-d)<.01))defs.push(d)};
      add(maxD);add(selD);add(minD);
      headEnvelope=defs.map((d:number)=>{
        const selectedCurve=Math.abs(d-selD)<.01;
        const raw=(core.curvePoints(pump,d,ratio,120)||[]).filter((p:any)=>finite(p.flowM3h)).map((p:any)=>({x:Number(p.flowM3h),y:Number(p.headM)}));
        const pts=sampleEsFit(raw,2,1);
        return {points:pts,label:`Ø${fmt(d,d%1?1:0)}`,color:selectedCurve?BLUE:rgb(.36,.55,.68),width:selectedCurve?2.5:1.35};
      });
    }
  }
  const xLabel='Flow (m³/hr)';
  const charts:ChartSpec[]=[
    {yLabel:'Head (m)',points:headPoints,series:headEnvelope,duty:{x:q,y:h},bep,bepLabel:'BEP',xLabel,dutyLabel:''},
    {yLabel:'Efficiency (%)',points:effPoints,duty:{x:q,y:eff},xLabel,yMax:100,dutyLabel:`${fmt(eff,1)}%`},
    {yLabel:fam==='ES'?'Total Power (HP)':'Power (HP)',points:powerPoints,duty:{x:q,y:brakeHp},xLabel,dutyLabel:`${fmt(brakeHp,1)} HP`},
    {yLabel:fam==='ES'?'NPSH (m)':'NPSHr (m)',points:npsPoints,duty:{x:q,y:npsh},xLabel,dutyLabel:`${fmt(npsh,1)} Mtr`}
  ];
  const pdf=await PDFDocument.create(),regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const font={regular,bold};
  const logo=await pdf.embedPng(b64bytes(REPORT_LOGO_BASE64));
  let dimImage:any=null;
  if(fam==='CHC'){
    const series=String((selectChc(q,h) as any)?.series||'');
    const b64=(CHC_DIMENSION_BASE64 as any)[series];if(b64)dimImage=await pdf.embedPng(b64bytes(b64));
  }else dimImage=await pdf.embedPng(b64bytes(ES_DIMENSION_BASE64));

  const mt=motorTech(motorHp,pole);
  const pumpEnvelope=fam==='CHC'?(Number(dim.d1||0)/2+Number(dim.d2||0)):0;
  const chcLength=fam==='CHC'?Math.max(pumpEnvelope,Number(dim.pumpL||0)):0,chcWidth=fam==='CHC'?Math.max(pumpEnvelope,Number(dim.pumpW||0)):0;
  const pumpset=fam==='CHC'
    ?{length:chcLength?`${fmt(chcLength,0)} mm`:'-',width:chcWidth?`${fmt(chcWidth,0)} mm`:'-',height:dim.height?`${fmt(dim.height,0)} mm`:'-',weight:dim.weight?`${fmt(dim.weight,0)} kG`:'-'}
    :{length:esPs?.dimensions?.overall?.lengthMm?`${fmt(esPs.dimensions.overall.lengthMm,0)} mm`:'-',width:esPs?.dimensions?.overall?.widthMm?`${fmt(esPs.dimensions.overall.widthMm,0)} mm`:'-',height:esPs?.dimensions?.overall?.heightMm?`${fmt(esPs.dimensions.overall.heightMm,0)} mm`:'-',weight:esPs?.dimensions?.overall?.estimatedPumpsetWeightKg?`${fmt(esPs.dimensions.overall.estimatedPumpsetWeightKg,0)} kg`:'-'};

  const pageArgs={family:fam,model,dutyText,q,motorHp,motorKw,pole,hz,rpm,eff,npsh,brakeHp,suction,discharge,stages,impellerMm,maxPressure,dim,esPumpset:esPs,motorTech:mt,pumpset,material:materialFor(fam),charts};

  const p1=pdf.addPage(LETTER);drawPage1(p1,logo,regular,bold,pageArgs);
  const p2=pdf.addPage(LETTER);drawPage2(p2,logo,font,bold,pageArgs);
  const p3=pdf.addPage(LETTER);fam==='CHC'?drawPage3CHC(p3,logo,font,bold,pageArgs,dimImage):drawPage3ES(p3,logo,font,bold,pageArgs,dimImage);

  pdf.setTitle(`${model} Selection`);
  pdf.setSubject('KeySuite KeySelector frozen-layout pump performance report');
  pdf.setProducer('KeySuite KeyBot - KeySelector Frozen Layout');

  const bytes=await pdf.save(),safe=model.replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'');
  return {
    bytes:new Uint8Array(bytes),filename:`${safe||fam}_Selection.pdf`,model,
    motor_kw:motorKw,motor_hp:motorHp,efficiency:eff,npshr:npsh,shaft_kw:selectionShaft,
    pole:fam==='ES'?pole:null,rpm,selector_core_version:fam==='CHC'?CHC_CORE.VERSION:null,
    pdf_layout:'KeySelector frozen layout',pdf_layout_version:'4.12.20'
  };
}
