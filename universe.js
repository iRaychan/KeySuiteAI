(()=>{
  'use strict';
  if(window.__KEYSUITE_KEYCORE_V383__)return;
  window.__KEYSUITE_KEYCORE_V383__=true;

  const VERSION='4.04.09';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  const num=n=>Number.isFinite(Number(n))?Number(n):0;
  const fmt=n=>Number(n||0).toLocaleString('en-MY');
  const safeJson=(value,fallback=null)=>{try{return JSON.parse(value)}catch(_){return fallback}};
  const now=()=>Date.now();
  const state={open:false,paused:false,scale:1,panX:0,panY:0,dragging:false,startX:0,startY:0,startPanX:0,startPanY:0,lastSnapshot:null,poll:null,activity:[],lastRefreshAt:0,raf:0,lastFrame:0,matrix:null,particleCtx:null,particles:[],inbound:[],coreParticles:[],moduleSizes:{}};

  const modules=[
    {id:'quotation',label:'Quotation',sub:'Total quotations',icon:'▤',tone:'purple',nav:()=>window.KeySuiteApp?.showPage?.('history')},
    {id:'customers',label:'Customers',sub:'Active customers',icon:'♟',tone:'green',nav:()=>window.KeySuiteApp?.showPage?.('customers')},
    {id:'price',label:'Price List',sub:'Source price items',icon:'▦',tone:'orange',nav:()=>window.KeySuiteApp?.showPage?.('priceListDashboard')},
    {id:'curves',label:'Selection',sub:'CHC + ES selectors',icon:'⌁',tone:'blue',nav:()=>window.KeySuiteV384?.openHub?.('selection')},
    {id:'keyai',label:'KeyAI',sub:'Recent enquiries',icon:'✦',tone:'cyan',nav:()=>{
      if((window.KeySuiteAuthority?.can?.('keyai_access')??window.KeySuitePermissions?.can?.('keyai_access')??false))window.KeySuiteApp?.showPage?.('keyAiSettings');
      else toast('Your role does not have KeyAI access.');
    }},
    {id:'assembly',label:'Assembly',sub:'Saved assemblies',icon:'⌘',tone:'gold',nav:()=>window.KeySuiteAssembly?.open?.('system')},
    {id:'products',label:'Products',sub:'Product records',icon:'◇',tone:'steel',nav:()=>window.KeySuiteV383?.openHub?.('product')},
    {id:'alerts',label:'Alerts',sub:'Items needing attention',icon:'!',tone:'red',nav:()=>{close();window.KeySuiteApp?.showPage?.('quotation');setTimeout(()=>document.querySelector('.quote-item.status-error,.quote-item.status-warning')?.scrollIntoView?.({behavior:'smooth',block:'center'}),250)}}
  ];


  function moduleAllowed(m){
    const p=window.KeySuitePermissions,a=window.KeySuiteAuthority,can=k=>a?.can?.(k)??p?.can?.(k)??true;
    if(m.id==='quotation'||m.id==='alerts')return can('view_quotations')||can('create_quotations');
    if(m.id==='customers')return can('view_customers');
    if(m.id==='price')return can('manage_price_list');
    if(m.id==='curves')return can('use_selector');
    if(m.id==='products')return can('use_product');
    if(m.id==='assembly')return can('create_quotations');
    if(m.id==='keyai')return can('keyai_access');
    return true;
  }
  function applyAuthorityVisibility(){
    modules.forEach(m=>{const show=moduleAllowed(m);const node=document.querySelector(`.ksu-node[data-module="${m.id}"]`),line=document.querySelector(`.ksu-line[data-line="${m.id}"]`),dot=document.querySelector(`.ksu-mini-node[data-module="${m.id}"]`);if(node)node.style.display=show?'':'none';if(line)line.style.display=show?'':'none';if(dot)dot.style.display=show?'':'none'});
  }

  const modulePosition={
    quotation:[50,15],customers:[27,26],price:[73,26],curves:[18,54],keyai:[82,54],assembly:[32,76],products:[50,82],alerts:[69,76]
  };

  function installVersionLabels(){
    const small=$('.brand small'); if(small&&/V\d/i.test(small.textContent))small.textContent=`Full Suite V${VERSION}`;
    const suite=$('.suite-version'); if(suite)suite.textContent=`KeySuite V${VERSION}`;
    if(/KeySuite V\d/i.test(document.title))document.title=document.title.replace(/KeySuite V[\d.]+/i,`KeySuite V${VERSION}`);
  }

  function injectStyles(){
    if($('#ksu-style'))return;
    const style=document.createElement('style');style.id='ksu-style';style.textContent=`
      :root{--ksu-side:0px}
      #ksu-nav{margin-top:11px!important;border:1px solid rgba(72,220,188,.55)!important;background:linear-gradient(135deg,rgba(8,73,82,.72),rgba(30,72,124,.62))!important;color:#ecfeff!important;position:relative;overflow:hidden}
      #ksu-nav::after{content:"";position:absolute;inset:auto -18px -23px auto;width:62px;height:62px;border:1px solid rgba(100,240,220,.45);border-radius:50%;box-shadow:0 0 18px rgba(74,222,198,.28)}
      #ksu-nav.ksu-active{box-shadow:0 0 0 1px rgba(94,234,212,.35),0 0 22px rgba(45,212,191,.22)!important}
      .ksu-launch{margin-top:16px;padding:0!important;overflow:hidden!important;border:1px solid #cce8e0!important;background:linear-gradient(135deg,#f8fffd 0%,#eef8ff 52%,#f6f0ff 100%)!important;position:relative}
      .ksu-launch-inner{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(260px,.6fr);align-items:center;gap:18px;padding:20px 22px}
      .ksu-launch h2{margin:0 0 6px;color:#17365d}.ksu-launch-copy{max-width:650px}.ksu-launch-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:15px}
      .ksu-launch-btn{border:0;border-radius:9px;padding:11px 16px;font-weight:800;background:#0f766e;color:white;box-shadow:0 8px 20px rgba(15,118,110,.18)}
      .ksu-launch-btn:hover{filter:brightness(1.08)}
      .ksu-mini-orbit{height:122px;position:relative;isolation:isolate}.ksu-mini-core{position:absolute;left:50%;top:50%;width:34px;height:34px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,#fff 0 16%,#6ee7b7 18% 30%,#0f766e 55%,#083344 100%);box-shadow:0 0 22px rgba(16,185,129,.48)}
      .ksu-mini-ring{position:absolute;left:50%;top:50%;border:1px solid rgba(36,99,235,.2);border-radius:50%;transform:translate(-50%,-50%) rotate(-10deg)}.ksu-mini-ring.r1{width:120px;height:48px}.ksu-mini-ring.r2{width:190px;height:74px}.ksu-mini-dot{position:absolute;width:13px;height:13px;border-radius:50%;box-shadow:0 0 12px currentColor}.ksu-mini-dot.d1{left:25%;top:33%;background:#22c55e;color:#22c55e}.ksu-mini-dot.d2{right:18%;top:31%;background:#f59e0b;color:#f59e0b}.ksu-mini-dot.d3{left:31%;bottom:14%;background:#3b82f6;color:#3b82f6}.ksu-mini-dot.d4{right:31%;bottom:10%;background:#a855f7;color:#a855f7}
      #ksu-overlay{position:fixed!important;z-index:5000!important;top:0!important;right:0!important;bottom:0!important;left:var(--ksu-side)!important;display:none;background:linear-gradient(180deg,#000503 0%,#010906 48%,#000302 100%)!important;background-color:#000503!important;color:#e8f3ff!important;font-family:Arial,Helvetica,sans-serif!important;overflow:hidden!important;border:0!important;border-radius:0!important;box-shadow:none!important;padding:0!important;margin:0!important;width:auto!important;height:auto!important;max-width:none!important;max-height:none!important;isolation:isolate!important}
      #ksu-overlay.ksu-open{display:block!important}
      #ksu-overlay .ksu-viewport{background:radial-gradient(ellipse at 50% 52%,rgba(0,255,174,.075),transparent 41%),linear-gradient(180deg,rgba(0,8,5,.35),rgba(0,3,2,.66))!important;background-color:#000503!important;border:0!important;border-radius:0!important;box-shadow:none!important}
      #ksu-overlay .ksu-world{background:transparent!important;background-color:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;outline:0!important}
      #ksu-overlay canvas.ksu-matrix,#ksu-overlay canvas.ksu-particles{background:transparent!important;background-color:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important}
      .ksu-stars{position:absolute;inset:0;background:
        radial-gradient(circle at 14% 20%,rgba(54,153,255,.24),transparent 1px),radial-gradient(circle at 70% 17%,rgba(255,255,255,.72),transparent 1.2px),radial-gradient(circle at 41% 81%,rgba(119,183,255,.55),transparent 1px),radial-gradient(circle at 84% 62%,rgba(255,255,255,.55),transparent 1px),radial-gradient(circle at 26% 66%,rgba(111,228,255,.42),transparent 1px),linear-gradient(180deg,#020712 0%,#03101f 52%,#020712 100%);background-size:83px 83px,137px 137px,119px 119px,103px 103px,151px 151px,100% 100%;opacity:.95;pointer-events:none}
      .ksu-nebula{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 53%,rgba(105,45,180,.16),transparent 32%),radial-gradient(ellipse at 52% 50%,rgba(0,161,255,.11),transparent 43%),radial-gradient(ellipse at 48% 54%,rgba(255,153,64,.08),transparent 26%);pointer-events:none}
      .ksu-topbar{height:86px;position:relative;z-index:9;display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:19px 24px 12px;border-bottom:1px solid rgba(148,163,184,.14);background:linear-gradient(180deg,rgba(2,7,18,.94),rgba(2,7,18,.66),transparent)}
      .ksu-title h1{font-size:25px;margin:0 0 4px;color:#fff}.ksu-title p{margin:0;color:#9fb2c7;font-size:13px}.ksu-live{display:inline-flex;align-items:center;gap:7px;margin-top:9px;font-size:11px;color:#c7d9e9}.ksu-live-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 10px #22c55e;animation:ksuLive 1.8s ease-in-out infinite}
      .ksu-top-actions{display:flex;gap:8px;align-items:center}.ksu-control{border:1px solid rgba(148,163,184,.3);background:rgba(7,18,32,.72);color:#e8f3ff;border-radius:9px;padding:9px 12px;font-weight:700;backdrop-filter:blur(8px)}.ksu-control:hover{border-color:rgba(94,234,212,.55);background:rgba(10,37,50,.82)}
      .ksu-viewport{position:absolute;inset:86px 0 0 0;overflow:hidden;cursor:grab;touch-action:none;background:#000503}.ksu-viewport.ksu-dragging{cursor:grabbing}.ksu-world{position:absolute;left:50%;top:50%;width:1600px;height:950px;transform-origin:50% 50%;will-change:transform;background:transparent!important}
      .ksu-orbit{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-8deg);border:1px solid rgba(85,145,255,.17);border-radius:50%;pointer-events:none}.ksu-orbit.o1{width:520px;height:250px}.ksu-orbit.o2{width:850px;height:430px}.ksu-orbit.o3{width:1170px;height:610px}.ksu-orbit.o4{width:1420px;height:780px;border-style:dashed;border-color:rgba(116,238,225,.12)}
      .ksu-connectors{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}.ksu-line{fill:none;stroke:rgba(94,234,212,.18);stroke-width:1.25;stroke-dasharray:4 8;transition:stroke .3s,stroke-width .3s,filter .3s}.ksu-line.ksu-flash{stroke:rgba(125,249,231,.92);stroke-width:2.8;filter:drop-shadow(0 0 7px rgba(94,234,212,.9));animation:ksuLineFlash 1.5s ease-out}
      .ksu-core{position:absolute;left:50%;top:51%;width:224px;height:224px;transform:translate(-50%,-50%);border-radius:50%;display:grid;place-items:center;text-align:center;z-index:3;pointer-events:none}
      .ksu-core::before{content:"";position:absolute;width:420px;height:180px;border-radius:50%;background:conic-gradient(from 40deg,rgba(129,74,255,.05),rgba(255,171,84,.35),rgba(255,255,255,.82),rgba(77,184,255,.22),rgba(129,74,255,.28),rgba(255,171,84,.05));filter:blur(18px);animation:ksuSpin 18s linear infinite;box-shadow:0 0 60px rgba(116,90,255,.24)}
      .ksu-core::after{content:"";position:absolute;width:112px;height:112px;border-radius:50%;background:radial-gradient(circle,#fff 0 7%,#c5ffe7 16%,#53d7ae 30%,#0e806d 52%,rgba(4,38,50,.82) 67%,transparent 72%);box-shadow:0 0 26px rgba(102,255,210,.8),0 0 70px rgba(77,183,255,.35)}
      .ksu-core-label{position:relative;z-index:2;color:#e8fff8;text-shadow:0 2px 12px #001b17;font-weight:900;font-size:21px;margin-top:3px}.ksu-core-label small{display:block;font-weight:500;color:#a9c9c5;font-size:11px;margin-top:4px}
      .ksu-node{position:absolute;transform:translate(-50%,-50%);z-index:4;display:grid;place-items:center}.ksu-planet{--size:136px;--glow:#60a5fa;width:var(--size);height:var(--size);border-radius:50%;border:1px solid color-mix(in srgb,var(--glow) 70%,white 8%);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;position:relative;color:white;cursor:pointer;user-select:none;box-shadow:inset -28px -24px 42px rgba(0,0,0,.45),inset 14px 12px 26px rgba(255,255,255,.07),0 0 18px color-mix(in srgb,var(--glow) 48%,transparent),0 0 42px color-mix(in srgb,var(--glow) 20%,transparent);background:radial-gradient(circle at 32% 27%,color-mix(in srgb,var(--glow) 68%,white 16%),color-mix(in srgb,var(--glow) 48%,#07111f 36%) 31%,color-mix(in srgb,var(--glow) 26%,#030814 74%) 68%,#02050c 100%);animation:ksuHeartbeat var(--beat,5.8s) ease-in-out infinite;transition:width .65s ease,height .65s ease,filter .25s,box-shadow .25s;will-change:transform}
      .ksu-paused .ksu-planet,.ksu-paused .ksu-live-dot,.ksu-paused .ksu-core::before,.ksu-paused .ksu-core::after,.ksu-paused .ksu-core-grid,.ksu-paused .ksu-planet::before,.ksu-paused .ksu-planet::after,.ksu-paused .ksu-node::after{animation-play-state:paused!important}.ksu-planet:hover{filter:brightness(1.13);box-shadow:inset -28px -24px 42px rgba(0,0,0,.42),inset 14px 12px 28px rgba(255,255,255,.1),0 0 26px color-mix(in srgb,var(--glow) 66%,transparent),0 0 60px color-mix(in srgb,var(--glow) 30%,transparent)}
      .ksu-planet::before{content:"";position:absolute;inset:-11px;border:1px solid color-mix(in srgb,var(--glow) 48%,transparent);border-radius:50%;opacity:.45}.ksu-planet::after{content:"";position:absolute;inset:-3px;border-top:2px solid color-mix(in srgb,var(--glow) 82%,white 8%);border-right:1px solid transparent;border-left:1px solid transparent;border-bottom:1px solid transparent;border-radius:50%;opacity:.8;filter:drop-shadow(0 0 6px var(--glow))}
      .ksu-planet.ksu-burst{animation:ksuBurst 1.05s cubic-bezier(.2,.7,.2,1),ksuHeartbeat var(--beat,5.8s) ease-in-out 1.05s infinite}.ksu-planet.ksu-burst::before{animation:ksuRipple 1.15s ease-out}
      .ksu-tone-purple{--glow:#c65dff}.ksu-tone-green{--glow:#56e982}.ksu-tone-orange{--glow:#ff9f43}.ksu-tone-blue{--glow:#4aa3ff}.ksu-tone-cyan{--glow:#25dff2}.ksu-tone-gold{--glow:#ffd84d}.ksu-tone-steel{--glow:#6eb7ff}.ksu-tone-red{--glow:#ff5c67}
      .ksu-icon{width:34px;height:34px;border-radius:50%;border:1px solid color-mix(in srgb,var(--glow) 75%,white 12%);display:grid;place-items:center;margin-bottom:6px;background:rgba(2,10,20,.42);font-weight:900;color:#fff;box-shadow:0 0 14px color-mix(in srgb,var(--glow) 35%,transparent)}
      .ksu-label{font-size:14px;font-weight:800;line-height:1.05}.ksu-value{font-size:21px;font-weight:900;margin-top:4px;line-height:1}.ksu-sub{font-size:10px;color:#bcd0df;margin-top:4px}.ksu-delta{font-size:10px;color:#65f2a0;margin-top:5px;min-height:12px}.ksu-badge{position:absolute;right:2%;top:3%;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#dc3545;color:#fff;font-size:10px;font-weight:900;display:none;place-items:center;box-shadow:0 0 12px rgba(255,72,86,.45)}.ksu-badge.show{display:grid}
      .ksu-leftpanel,.ksu-legend,.ksu-minimap,.ksu-zoom{position:absolute;z-index:8;border:1px solid rgba(148,163,184,.18);background:rgba(3,12,24,.72);backdrop-filter:blur(10px);border-radius:11px;color:#d9e8f5;box-shadow:0 14px 34px rgba(0,0,0,.18)}
      .ksu-leftpanel{left:18px;bottom:18px;width:265px;padding:12px}.ksu-panel-title{font-size:12px;font-weight:900;margin-bottom:7px;color:#f2f7fc}.ksu-activity-list{display:grid;gap:1px;max-height:146px;overflow:hidden}.ksu-activity-item{display:grid;grid-template-columns:9px 1fr auto;gap:8px;align-items:start;padding:7px 2px;border-top:1px solid rgba(148,163,184,.08);font-size:10px}.ksu-activity-dot{width:7px;height:7px;margin-top:3px;border-radius:50%;background:#63e6be;box-shadow:0 0 8px currentColor}.ksu-activity-item b{display:block;color:#e8f4ff;font-size:10px}.ksu-activity-item span{color:#7f98ac}.ksu-empty{padding:12px 4px;color:#7890a4;font-size:10px}
      .ksu-legend{right:18px;top:18px;width:176px;padding:12px}.ksu-legend-row{font-size:10px;color:#8fa7ba;margin-top:8px}.ksu-legend-dots{display:flex;gap:7px;align-items:center;margin-top:6px}.ksu-legend-dots i{display:block;border-radius:50%;background:#57a7ff}.ksu-legend-dots i:nth-child(1){width:6px;height:6px}.ksu-legend-dots i:nth-child(2){width:9px;height:9px;background:#4ade80}.ksu-legend-dots i:nth-child(3){width:12px;height:12px;background:#fbbf24}.ksu-legend-dots i:nth-child(4){width:15px;height:15px;background:#f97316}.ksu-legend-dots i:nth-child(5){width:19px;height:19px;background:#c65dff}.ksu-heartline{height:22px;width:100%;margin-top:5px;opacity:.8}
      .ksu-zoom{right:18px;top:50%;transform:translateY(-50%);width:44px;display:grid;place-items:center;padding:5px}.ksu-zoom button{width:34px;height:34px;border:0;background:transparent;color:#eff8ff;font-size:22px;border-radius:7px}.ksu-zoom button:hover{background:rgba(255,255,255,.08)}.ksu-zoom-read{font-size:9px;color:#8ca6ba;padding:4px 0}.ksu-zoom .ksu-center{font-size:16px}
      .ksu-minimap{right:18px;bottom:18px;width:196px;height:106px;padding:9px;overflow:hidden}.ksu-minimap-world{position:relative;width:100%;height:74px}.ksu-mini-center{position:absolute;left:50%;top:50%;width:12px;height:12px;border-radius:50%;transform:translate(-50%,-50%);background:#4ade80;box-shadow:0 0 12px #4ade80}.ksu-mini-node{position:absolute;width:8px;height:8px;border-radius:50%;transform:translate(-50%,-50%);background:#60a5fa;box-shadow:0 0 7px currentColor}.ksu-mini-ring-map{position:absolute;left:50%;top:50%;width:150px;height:52px;border:1px solid rgba(99,161,255,.18);border-radius:50%;transform:translate(-50%,-50%) rotate(-8deg)}
      .ksu-hint{position:absolute;z-index:8;left:50%;bottom:18px;transform:translateX(-50%);border:1px solid rgba(148,163,184,.18);background:rgba(3,12,24,.64);border-radius:999px;padding:9px 14px;color:#a9bfd0;font-size:10px;pointer-events:none;backdrop-filter:blur(7px)}
      .ksu-toast{position:absolute;z-index:30;left:50%;top:104px;transform:translate(-50%,-12px);opacity:0;pointer-events:none;background:rgba(12,28,42,.96);color:#eaf7ff;border:1px solid rgba(94,234,212,.35);border-radius:10px;padding:10px 14px;box-shadow:0 18px 40px rgba(0,0,0,.3);transition:.25s;font-size:12px}.ksu-toast.show{opacity:1;transform:translate(-50%,0)}
      .ksu-matrix{position:absolute;inset:0;width:100%;height:100%;z-index:0;opacity:.34;pointer-events:none;mix-blend-mode:screen;filter:blur(.05px)}
      .ksu-stars{z-index:0;opacity:.62!important;background:radial-gradient(circle at 14% 20%,rgba(31,255,145,.22),transparent 1px),radial-gradient(circle at 70% 17%,rgba(117,255,196,.5),transparent 1.2px),radial-gradient(circle at 41% 81%,rgba(0,255,183,.35),transparent 1px),radial-gradient(circle at 84% 62%,rgba(255,255,255,.38),transparent 1px),linear-gradient(180deg,#010604 0%,#020d0a 50%,#000503 100%)!important}
      .ksu-nebula{z-index:0;background:radial-gradient(ellipse at 50% 52%,rgba(0,255,174,.15),transparent 34%),radial-gradient(ellipse at 48% 52%,rgba(0,133,92,.13),transparent 48%),repeating-linear-gradient(90deg,rgba(44,255,171,.025) 0 1px,transparent 1px 72px),repeating-linear-gradient(0deg,rgba(44,255,171,.018) 0 1px,transparent 1px 72px)!important}
      .ksu-topbar{background:linear-gradient(180deg,rgba(0,7,5,.97),rgba(0,10,7,.78),transparent)!important;border-bottom-color:rgba(52,255,169,.14)!important}
      .ksu-kicker{font:700 9px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:2.1px;color:#38ffad;margin-bottom:4px;text-shadow:0 0 12px rgba(56,255,173,.55)}
      .ksu-title h1{color:#d9ffed!important;text-shadow:0 0 18px rgba(51,255,170,.26);letter-spacing:.4px}.ksu-title p{color:#7fbd9f!important}
      .ksu-control{border-color:rgba(58,255,172,.24)!important;background:rgba(0,18,12,.72)!important;color:#d9ffed!important}.ksu-control:hover{border-color:rgba(58,255,172,.68)!important;background:rgba(0,34,22,.9)!important;box-shadow:0 0 22px rgba(28,255,157,.12)}
      .ksu-world::before{content:"";position:absolute;left:50%;top:51%;width:1100px;height:560px;transform:translate(-50%,-50%) rotate(-8deg);border-radius:50%;background:repeating-radial-gradient(ellipse at center,transparent 0 42px,rgba(45,255,169,.028) 43px,transparent 44px 80px);filter:drop-shadow(0 0 14px rgba(32,255,162,.11));pointer-events:none}
      .ksu-particles{position:absolute;inset:0;width:1600px;height:950px;z-index:2;pointer-events:none;overflow:visible;mix-blend-mode:screen}
      .ksu-orbit{border-color:rgba(41,255,165,.13)!important;box-shadow:0 0 18px rgba(42,255,168,.035),inset 0 0 18px rgba(42,255,168,.025)}.ksu-orbit.o4{border-color:rgba(41,255,165,.09)!important}
      .ksu-line{stroke:rgba(57,255,175,.19)!important;stroke-dasharray:2 10!important}.ksu-line.ksu-flash{stroke:#63ffc1!important;filter:drop-shadow(0 0 9px rgba(71,255,185,.95))!important}
      .ksu-core{width:270px!important;height:270px!important}.ksu-core::before{width:500px!important;height:205px!important;background:conic-gradient(from 20deg,rgba(0,255,169,.02),rgba(33,255,169,.28),rgba(216,255,237,.86),rgba(0,255,183,.22),rgba(0,109,74,.12),rgba(0,255,169,.02))!important;filter:blur(14px)!important;box-shadow:0 0 80px rgba(28,255,162,.2)!important}.ksu-core::after{width:156px!important;height:156px!important;background:radial-gradient(circle at 38% 32%,#eafff5 0 4%,#78ffbf 7%,#20cb88 19%,#086544 44%,#04261a 65%,#00130d 80%,transparent 82%)!important;box-shadow:inset -25px -20px 38px rgba(0,0,0,.52),inset 12px 10px 22px rgba(158,255,210,.16),0 0 32px rgba(70,255,180,.75),0 0 100px rgba(27,255,161,.26)!important;animation:ksuCoreBreath 5.2s ease-in-out infinite}
      .ksu-core-grid{position:absolute;width:150px;height:150px;border-radius:50%;z-index:1;opacity:.44;background:repeating-linear-gradient(0deg,transparent 0 10px,rgba(124,255,199,.11) 11px),repeating-linear-gradient(90deg,transparent 0 10px,rgba(124,255,199,.08) 11px);clip-path:circle(49%);animation:ksuCoreGrid 13s linear infinite}
      .ksu-core-label{z-index:4!important;margin-top:0!important;font-family:ui-monospace,SFMono-Regular,Consolas,monospace!important}.ksu-core-label strong{display:block;font-size:24px;color:#dfffee;text-shadow:0 0 18px rgba(89,255,185,.7)}.ksu-core-label span{display:block;margin-top:8px;color:#52ffae;font-size:9px;letter-spacing:1.7px}.ksu-core-label small{font-size:8px!important;letter-spacing:1.1px;color:#79b79a!important}
      .ksu-node::before,.ksu-node::after{content:"";position:absolute;border-radius:50%;pointer-events:none}.ksu-node::before{width:calc(var(--node-size,136px) + 34px);height:calc(var(--node-size,136px) + 34px);border:1px solid rgba(79,255,188,.09);transform:rotateX(63deg) rotateZ(-12deg);box-shadow:0 0 15px rgba(79,255,188,.035)}.ksu-node::after{width:6px;height:6px;background:var(--node-glow,#5cffb2);box-shadow:0 0 12px var(--node-glow,#5cffb2);animation:ksuNodeSatellite 6.5s linear infinite;transform-origin:calc((var(--node-size,136px) + 48px)/2) 3px}
      .ksu-local-orbit{position:absolute;width:calc(var(--node-size,136px) + 64px);height:calc(var(--node-size,136px) + 26px);border:1px solid color-mix(in srgb,var(--node-glow,#55ffb2) 24%,transparent);border-radius:50%;transform:rotate(-10deg);opacity:.45;pointer-events:none}
      .ksu-planet{background:radial-gradient(circle at 30% 24%,color-mix(in srgb,var(--glow) 64%,white 12%),color-mix(in srgb,var(--glow) 40%,#02110b 48%) 29%,color-mix(in srgb,var(--glow) 19%,#020805 80%) 68%,#010302 100%)!important;border-color:color-mix(in srgb,var(--glow) 58%,#aaffd9 12%)!important;box-shadow:inset -28px -24px 42px rgba(0,0,0,.58),inset 14px 12px 28px rgba(210,255,231,.07),0 0 18px color-mix(in srgb,var(--glow) 50%,transparent),0 0 55px color-mix(in srgb,var(--glow) 18%,transparent)!important}
      .ksu-planet::before{inset:-13px!important;border-style:dashed!important;animation:ksuRingSpin 14s linear infinite}.ksu-planet::after{animation:ksuRingSpinReverse 9s linear infinite}
      .ksu-icon{background:rgba(0,12,8,.52)!important}.ksu-label{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.25px}.ksu-value{text-shadow:0 0 14px color-mix(in srgb,var(--glow) 65%,transparent)}.ksu-sub{color:#82ad99!important}.ksu-delta{color:#54ffab!important}
      .ksu-leftpanel,.ksu-legend,.ksu-minimap,.ksu-zoom{border-color:rgba(59,255,171,.16)!important;background:rgba(0,13,9,.76)!important;box-shadow:0 14px 34px rgba(0,0,0,.32),inset 0 0 24px rgba(44,255,166,.018)!important}.ksu-panel-title{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;color:#78ffc0!important;letter-spacing:.9px}.ksu-activity-item{border-top-color:rgba(63,255,172,.07)!important}.ksu-activity-item b{color:#d9ffec!important}.ksu-activity-item span,.ksu-legend-row{color:#66967e!important}.ksu-hint{border-color:rgba(59,255,171,.16)!important;background:rgba(0,13,9,.72)!important;color:#6eb38e!important;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.65px}
      #ksu-overlay.ksu-absorbing .ksu-core::after{box-shadow:0 0 46px rgba(88,255,190,.95),0 0 140px rgba(35,255,166,.5)!important}
      @keyframes ksuCoreBreath{0%,100%{transform:scale(1);filter:brightness(.94)}14%{transform:scale(1.045);filter:brightness(1.12)}21%{transform:scale(.992)}28%{transform:scale(1.025)}38%{transform:scale(1)}}
      @keyframes ksuCoreGrid{to{transform:rotate(360deg)}}
      @keyframes ksuRingSpin{to{transform:rotate(360deg)}}@keyframes ksuRingSpinReverse{to{transform:rotate(-360deg)}}
      @keyframes ksuNodeSatellite{0%{transform:rotate(0deg) translateX(calc((var(--node-size,136px) + 46px)/2))}100%{transform:rotate(360deg) translateX(calc((var(--node-size,136px) + 46px)/2))}}
      @keyframes ksuHeartbeat{0%,12%,100%{transform:scale(1)}16%{transform:scale(1.023)}21%{transform:scale(.995)}26%{transform:scale(1.016)}34%{transform:scale(1)}}
      @keyframes ksuBurst{0%{transform:scale(1)}18%{transform:scale(1.08)}34%{transform:scale(.98)}52%{transform:scale(1.055)}72%,100%{transform:scale(1)}}
      @keyframes ksuRipple{0%{transform:scale(.96);opacity:.9}100%{transform:scale(1.32);opacity:0}}
      @keyframes ksuLineFlash{0%{stroke-dashoffset:30;opacity:1}100%{stroke-dashoffset:-30;opacity:.22}}
      @keyframes ksuSpin{to{transform:rotate(360deg)}}
      @keyframes ksuLive{0%,100%{opacity:.45;transform:scale(.85)}50%{opacity:1;transform:scale(1.25)}}
      @media(max-width:900px){:root{--ksu-side:0px}.ksu-launch-inner{grid-template-columns:1fr}.ksu-mini-orbit{display:none}#ksu-overlay{left:0}.ksu-topbar{padding:15px;height:82px}.ksu-top-actions .ksu-control:nth-child(2){display:none}.ksu-legend,.ksu-minimap{display:none}.ksu-leftpanel{width:220px}.ksu-hint{display:none}.ksu-viewport{inset:82px 0 0}}
      @media(prefers-reduced-motion:reduce){.ksu-planet,.ksu-core::before,.ksu-live-dot{animation:none!important}.ksu-line{transition:none}.ksu-planet.ksu-burst{animation:none!important}}
    `;document.head.appendChild(style);
  }

  function updateSideWidth(){
    // V3.8.5: KeyCore is a true full-screen universe; normal KeySuite sidebar stays underneath the overlay.
    document.documentElement.style.setProperty('--ksu-side','0px');
  }

  function injectLaunchers(){
    const nav=$('#appView nav')||$('aside nav');
    if(nav&&!$('#ksu-nav')){
      const b=document.createElement('button');b.id='ksu-nav';b.type='button';b.innerHTML='◎&nbsp;&nbsp;KeyCore';b.addEventListener('click',open);nav.appendChild(b);
    }
    const dashboard=$('#dashboard');
    if(dashboard&&!$('#ksu-launch')){
      const start=$('.dashboard-start-card',dashboard);
      const card=document.createElement('div');card.className='card ksu-launch';card.id='ksu-launch';card.innerHTML=`<div class="ksu-launch-inner"><div class="ksu-launch-copy"><h2>KeyCore</h2><div class="muted">Enter the live AI core of KeySuite. Data globes grow with stored information, orbiting particles show data gravity, and new activity triggers absorption pulses and heartbeat reactions.</div><div class="ksu-launch-actions"><button class="ksu-launch-btn" id="ksu-launch-button" type="button">◎ Enter KeyCore</button><span class="muted">AI matrix · data gravity · drag · zoom · explore</span></div></div><div class="ksu-mini-orbit" aria-hidden="true"><div class="ksu-mini-ring r2"></div><div class="ksu-mini-ring r1"></div><div class="ksu-mini-core"></div><i class="ksu-mini-dot d1"></i><i class="ksu-mini-dot d2"></i><i class="ksu-mini-dot d3"></i><i class="ksu-mini-dot d4"></i></div></div>`;
      (start?.parentNode||dashboard).insertBefore(card,start?.nextSibling||dashboard.firstChild);
      $('#ksu-launch-button',card)?.addEventListener('click',open);
    }
  }

  function buildOverlay(){
    if($('#ksu-overlay'))return;
    const overlay=document.createElement('div');overlay.id='ksu-overlay';overlay.setAttribute('role','region');overlay.setAttribute('aria-label','KeyCore');
    overlay.innerHTML=`
      <canvas class="ksu-matrix" id="ksu-matrix" aria-hidden="true"></canvas><div class="ksu-stars"></div><div class="ksu-nebula"></div>
      <header class="ksu-topbar"><div class="ksu-title"><div class="ksu-kicker">KEYSUITE // INTELLIGENT DATA CORE</div><h1>KeyCore</h1><p>Your data. Connected. Intelligent. Watch information gain gravity as KeySuite grows.</p><div class="ksu-live"><span class="ksu-live-dot"></span><b>Live Sync</b><span id="ksu-sync-time">Preparing data…</span></div></div><div class="ksu-top-actions"><button class="ksu-control" id="ksu-pause" type="button">Ⅱ Pause motion</button><button class="ksu-control" id="ksu-refresh" type="button">↻ Refresh</button><button class="ksu-control" id="ksu-close" type="button">← Back to Dashboard</button></div></header>
      <div class="ksu-viewport" id="ksu-viewport">
        <div class="ksu-world" id="ksu-world"><canvas class="ksu-particles" id="ksu-particles" width="1600" height="950" aria-hidden="true"></canvas><div class="ksu-orbit o1"></div><div class="ksu-orbit o2"></div><div class="ksu-orbit o3"></div><div class="ksu-orbit o4"></div><svg class="ksu-connectors" id="ksu-connectors" viewBox="0 0 1600 950" preserveAspectRatio="none"></svg><div class="ksu-core"><div class="ksu-core-grid"></div><div class="ksu-core-label"><strong>KeyCore</strong><span id="ksu-core-pulse">SYSTEM ONLINE</span><small>V${VERSION} · DATA GRAVITY ACTIVE</small></div></div></div>
        <section class="ksu-leftpanel"><div class="ksu-panel-title">⌁ Recent Activity</div><div class="ksu-activity-list" id="ksu-activity-list"><div class="ksu-empty">KeyCore is synchronising…</div></div></section>
        <section class="ksu-legend"><div class="ksu-panel-title">DATA GRAVITY</div><div class="ksu-legend-row">More records → larger globe + denser orbit</div><div class="ksu-legend-dots"><i></i><i></i><i></i><i></i><i></i></div><div class="ksu-panel-title" style="margin-top:12px">LIVE ACTIVITY</div><div class="ksu-legend-row">New data → particles absorb → heartbeat</div><svg class="ksu-heartline" viewBox="0 0 150 22"><path d="M1 12h28l5-7 7 14 8-11 5 4h26l6-9 8 17 8-12 6 4h41" fill="none" stroke="#7debd7" stroke-width="1.5"/></svg></section>
        <div class="ksu-zoom"><button id="ksu-plus" type="button" title="Zoom in">+</button><div class="ksu-zoom-read" id="ksu-zoom-read">55%</div><button id="ksu-minus" type="button" title="Zoom out">−</button><button class="ksu-center" id="ksu-reset" type="button" title="Reset view">◎</button></div>
        <div class="ksu-minimap"><div class="ksu-minimap-world"><div class="ksu-mini-ring-map"></div><div class="ksu-mini-center"></div></div></div>
        <div class="ksu-hint">DRAG TO NAVIGATE &nbsp;·&nbsp; SCROLL TO ZOOM &nbsp;·&nbsp; CLICK A DATA GLOBE TO OPEN</div><div class="ksu-toast" id="ksu-toast"></div>
      </div>`;
    document.body.appendChild(overlay);
    // V3.8.1: prevent late-loaded KeySuite light/card styles from painting the KeyCore world white.
    overlay.style.setProperty('background','linear-gradient(180deg,#000503 0%,#010906 48%,#000302 100%)','important');
    overlay.style.setProperty('border-radius','0','important');
    overlay.style.setProperty('box-shadow','none','important');
    const viewport=$('#ksu-viewport',overlay),world=$('#ksu-world',overlay);
    viewport?.style.setProperty('background','radial-gradient(ellipse at 50% 52%,rgba(0,255,174,.075),transparent 41%),linear-gradient(180deg,rgba(0,8,5,.35),rgba(0,3,2,.66))','important');
    viewport?.style.setProperty('border-radius','0','important');
    world?.style.setProperty('background','transparent','important');
    world?.style.setProperty('border-radius','0','important');
    world?.style.setProperty('box-shadow','none','important');
    createPlanets();createConnectors();bindControls();applyAuthorityVisibility();
  }

  function createPlanets(){
    const world=$('#ksu-world');const mini=$('.ksu-minimap-world');
    modules.forEach((m,i)=>{
      const [x,y]=modulePosition[m.id];
      const node=document.createElement('div');node.className='ksu-node';node.dataset.module=m.id;node.style.left=`${x}%`;node.style.top=`${y}%`;
      node.innerHTML=`<div class="ksu-local-orbit" aria-hidden="true"></div><button type="button" class="ksu-planet ksu-tone-${m.tone}" data-planet="${m.id}" aria-label="Open ${m.label}"><span class="ksu-badge"></span><span class="ksu-icon">${m.icon}</span><span class="ksu-label">${m.label}</span><span class="ksu-value" data-value>—</span><span class="ksu-sub">${m.sub}</span><span class="ksu-delta" data-delta></span></button>`;
      world.appendChild(node);$('.ksu-planet',node).addEventListener('click',e=>{e.stopPropagation();close();setTimeout(()=>m.nav(),60)});
      const dot=document.createElement('i');dot.className='ksu-mini-node';dot.dataset.module=m.id;dot.style.left=`${x}%`;dot.style.top=`${y}%`;dot.style.color=['#c65dff','#56e982','#ff9f43','#4aa3ff','#25dff2','#ffd84d','#6eb7ff','#ff5c67'][i];mini?.appendChild(dot);
    });
  }

  function createConnectors(){
    const svg=$('#ksu-connectors'); if(!svg)return;
    svg.innerHTML=modules.map(m=>{const [x,y]=modulePosition[m.id];const ex=x*16,ey=y*9.5;return `<path class="ksu-line" data-line="${m.id}" d="M 800 484 Q ${(800+ex)/2 + (ey-484)*.08} ${(484+ey)/2 - (ex-800)*.04} ${ex} ${ey}"/>`}).join('');
  }

  async function loadQuotes(){
    try{const result=await window.KeySuiteQuotationStore?.load?.();if(Array.isArray(result))return result}catch(_){/* fall through */}
    let best=[];
    for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i)||'';if(!/quote/i.test(key))continue;const v=safeJson(localStorage.getItem(key),null);if(Array.isArray(v)&&v.length>best.length)best=v}
    return best;
  }
  function customers(){try{return window.KeySuiteApp?.getCustomers?.()||[]}catch(_){return []}}
  function storageArrayMax(pattern){let max=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';if(!pattern.test(k))continue;const v=safeJson(localStorage.getItem(k),null);if(Array.isArray(v))max=Math.max(max,v.length)}return max}
  async function tableCount(client,table){try{const r=await client.from(table).select('*',{count:'exact',head:true});if(r.error)throw r.error;return num(r.count)}catch(_){return 0}}
  async function keyAiCount(client){
    if(!client||String(window.KEYSUITE_ACCESS?.role||'').toLowerCase()!=='owner')return 0;
    try{const r=await client.functions.invoke('keyai-bridge',{body:{action:'list_inbox',limit:50}});if(r.error)throw r.error;return Array.isArray(r.data?.items)?r.data.items.length:0}catch(_){return 0}
  }
  function alertCount(){
    const errorRows=$$('.quote-item.status-error,.quote-item.status-warning').length;
    const noPrice=$$('.quote-item').filter(row=>{const p=row.querySelector('.item-price');return p&&num(p.value)<=0&&row.querySelector('.item-model')?.value?.trim()}).length;
    return Math.max(errorRows,noPrice);
  }

  async function collectSnapshot(){
    const c=customers();const q=await loadQuotes();const client=window.KeySuiteAuth?.getClient?.();
    let chc=0,es=0,gws=0,assemblies=0,keyai=0;
    if(client){[chc,es,gws,assemblies,keyai]=await Promise.all([tableCount(client,'ks_products_chc'),tableCount(client,'ks_products_es'),tableCount(client,'ks_products_gws'),tableCount(client,'ks_assemblies'),keyAiCount(client)])}
    if(!assemblies)assemblies=storageArrayMax(/assembl/i);
    const products=Math.max(chc+es+gws,storageArrayMax(/product/i));
    const curves=Math.max(chc+es,storageArrayMax(/curve|selector/i));
    const price=Math.max(products,storageArrayMax(/price|pricelist/i));
    return {quotation:q.length,customers:c.length,price,curves,keyai,assembly:assemblies,products,alerts:alertCount(),_quotes:q};
  }

  function moduleSize(value,maxValue){
    if(value<=0)return 122;
    const ratio=Math.log10(value+1)/Math.max(1,Math.log10(maxValue+1));
    return Math.round(122+58*Math.sqrt(clamp(ratio,0,1)));
  }
  function latestQuoteActivity(quotes){
    return (quotes||[]).slice().sort((a,b)=>String(b.updatedAt||b.updated_at||b.date||'').localeCompare(String(a.updatedAt||a.updated_at||a.date||''))).slice(0,3).map(q=>({module:'quotation',title:q.status==='sealed'?'Quotation sealed':'Quotation updated',detail:[q.no,q.customerName||q.customer||''].filter(Boolean).join(' · '),time:q.updatedAt||q.updated_at||q.date||''}));
  }
  function addActivity(module,title,detail=''){
    state.activity.unshift({module,title,detail,time:new Date().toISOString()});state.activity=state.activity.slice(0,6);renderActivity();
  }
  function renderActivity(seedQuotes){
    const box=$('#ksu-activity-list');if(!box)return;
    const items=state.activity.length?state.activity:(seedQuotes?latestQuoteActivity(seedQuotes):[]);
    box.innerHTML=items.length?items.slice(0,5).map(a=>{const m=modules.find(x=>x.id===a.module);return `<div class="ksu-activity-item"><i class="ksu-activity-dot" style="color:var(--${m?.tone||'cyan'},#63e6be)"></i><div><b>${escapeHtml(a.title)}</b><span>${escapeHtml(a.detail||m?.label||'KeySuite')}</span></div><span>${relativeTime(a.time)}</span></div>`}).join(''):'<div class="ksu-empty">No recent activity detected.</div>';
  }
  function relativeTime(value){if(!value)return 'now';const t=new Date(value).getTime();if(!Number.isFinite(t))return '';const sec=Math.max(0,Math.round((Date.now()-t)/1000));if(sec<60)return `${sec}s`;if(sec<3600)return `${Math.floor(sec/60)}m`;if(sec<86400)return `${Math.floor(sec/3600)}h`;return `${Math.floor(sec/86400)}d`}
  function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

  async function refresh({forceBurst=false}={}){
    if(state.lastRefreshAt&&now()-state.lastRefreshAt<800&&!forceBurst)return;
    state.lastRefreshAt=now();
    $('#ksu-sync-time').textContent='Syncing…';
    const snap=await collectSnapshot();const values=modules.map(m=>num(snap[m.id])).filter(n=>n>0),maxValue=Math.max(1,...values);
    rebuildParticles(snap,maxValue);
    const corePulse=$('#ksu-core-pulse');if(corePulse){const live=values.reduce((a,b)=>a+b,0);corePulse.textContent=`SYSTEM ONLINE · ${fmt(live)} DATA POINTS`;}
    modules.forEach((m,index)=>{
      const value=num(snap[m.id]);const planet=$(`[data-planet="${m.id}"]`);if(!planet)return;
      planet.style.setProperty('--size',`${moduleSize(value,maxValue)}px`);
      const old=num(state.lastSnapshot?.[m.id]);const change=state.lastSnapshot?value-old:0;
      const activity=Math.min(4,Math.abs(change));planet.style.setProperty('--beat',`${Math.max(3.2,6.4-activity*.55-(m.id==='alerts'&&value?1.1:0))}s`);
      $('[data-value]',planet).textContent=value?fmt(value):(m.id==='keyai'&&String(window.KEYSUITE_ACCESS?.role||'').toLowerCase()!=='owner'?'Private':'0');
      const delta=$('[data-delta]',planet);delta.textContent=change>0?`▲ ${fmt(change)} new / updated`:change<0?`▼ ${fmt(Math.abs(change))} changed`:value?'Live':'Ready';
      const badge=$('.ksu-badge',planet);const badgeValue=(m.id==='alerts'?value:change>0?change:0);badge.textContent=badgeValue>99?'99+':String(badgeValue);badge.classList.toggle('show',badgeValue>0);
      if((change!==0&&state.lastSnapshot)||forceBurst&&index===0)burst(m.id,change||1);
      if(change!==0&&state.lastSnapshot)addActivity(m.id,`${m.label} ${change>0?'increased':'changed'}`,`${old.toLocaleString('en-MY')} → ${value.toLocaleString('en-MY')}`);
    });
    if(!state.activity.length)renderActivity(snap._quotes);
    state.lastSnapshot=snap;$('#ksu-sync-time').textContent=`Updated ${new Date().toLocaleTimeString('en-MY',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`;
  }

  function burst(id,magnitude=1){
    const planet=$(`[data-planet="${id}"]`),line=$(`[data-line="${id}"]`);if(!planet)return;
    planet.classList.remove('ksu-burst');void planet.offsetWidth;planet.classList.add('ksu-burst');spawnAbsorption(id,magnitude);line?.classList.remove('ksu-flash');if(line){void line.getBoundingClientRect();line.classList.add('ksu-flash')}
    setTimeout(()=>{planet.classList.remove('ksu-burst');line?.classList.remove('ksu-flash')},1500);
    if(Math.abs(magnitude)>1&&!state.paused)setTimeout(()=>{planet.classList.add('ksu-burst');setTimeout(()=>planet.classList.remove('ksu-burst'),1100)},520);
  }

  function toneHex(id){return {quotation:'#c65dff',customers:'#56e982',price:'#ffb347',curves:'#4aa3ff',keyai:'#25dff2',assembly:'#ffd84d',products:'#6eb7ff',alerts:'#ff5c67'}[id]||'#55ffb2'}
  function hexRgb(hex){const h=String(hex).replace('#','');const n=parseInt(h.length===3?h.split('').map(x=>x+x).join(''):h,16);return [(n>>16)&255,(n>>8)&255,n&255]}
  function ensureCanvasSize(){
    const c=$('#ksu-matrix');if(c){const dpr=Math.min(2,window.devicePixelRatio||1),w=Math.max(1,Math.round(c.clientWidth*dpr)),h=Math.max(1,Math.round(c.clientHeight*dpr));if(c.width!==w||c.height!==h){c.width=w;c.height=h;state.matrix={dpr,w,h,font:Math.round(13*dpr),drops:[]};const cols=Math.ceil(w/(13*dpr));state.matrix.drops=Array.from({length:cols},()=>Math.random()*-80)}}
    const p=$('#ksu-particles');if(p&&!state.particleCtx)state.particleCtx=p.getContext('2d');
  }
  function rebuildParticles(snap,maxValue){
    const items=[];modules.forEach(m=>{const value=num(snap[m.id]),size=moduleSize(value,maxValue),[px,py]=modulePosition[m.id],cx=px*16,cy=py*9.5;state.moduleSizes[m.id]=size;const node=$(`[data-module="${m.id}"]`);if(node){node.style.setProperty('--node-size',`${size}px`);node.style.setProperty('--node-glow',toneHex(m.id))}
      const density=value<=0?5:Math.round(7+22*Math.sqrt(Math.log10(value+1)/Math.max(1,Math.log10(maxValue+1))));
      for(let i=0;i<density;i++){const r=size*.55+15+Math.random()*(26+size*.14);items.push({module:m.id,cx,cy,r,ry:r*(.34+Math.random()*.22),a:Math.random()*Math.PI*2,s:(.00028+Math.random()*.00055)*(Math.random()<.5?-1:1),z:.45+Math.random()*.8,tw:Math.random()*Math.PI*2})}
    });state.particles=items;
    if(!state.coreParticles.length)state.coreParticles=Array.from({length:44},(_,i)=>({a:Math.random()*Math.PI*2,r:105+Math.random()*115,ry:32+Math.random()*53,s:(.00018+Math.random()*.00042)*(i%2?1:-1),z:.35+Math.random()*.9,tw:Math.random()*6.28}));
  }
  function spawnAbsorption(id,magnitude=1){const [px,py]=modulePosition[id]||[50,50],cx=px*16,cy=py*9.5,size=state.moduleSizes[id]||136,count=clamp(5+Math.round(Math.abs(magnitude)*2),6,18),color=toneHex(id);for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,r=size*.8+75+Math.random()*130;state.inbound.push({id,cx,cy,startX:cx+Math.cos(a)*r,startY:cy+Math.sin(a)*r*(.45+Math.random()*.35),born:performance.now()+Math.random()*250,dur:780+Math.random()*650,color,size:1.2+Math.random()*2.4})}$('#ksu-overlay')?.classList.add('ksu-absorbing');setTimeout(()=>$('#ksu-overlay')?.classList.remove('ksu-absorbing'),1300)}
  function drawMatrix(dt){const c=$('#ksu-matrix'),m=state.matrix;if(!c||!m)return;const ctx=c.getContext('2d');ctx.fillStyle='rgba(0,5,3,.105)';ctx.fillRect(0,0,m.w,m.h);ctx.font=`${m.font}px ui-monospace,Consolas,monospace`;ctx.textAlign='center';const step=m.font,chars='01KEYCORE<>/{}[]:+*';for(let i=0;i<m.drops.length;i++){const x=i*step+step/2,y=m.drops[i]*step;const ch=chars[Math.floor(Math.random()*chars.length)];ctx.fillStyle=Math.random()>.985?'rgba(210,255,232,.9)':`rgba(42,255,163,${.10+Math.random()*.32})`;ctx.fillText(ch,x,y);m.drops[i]+=.38+Math.random()*.18;if(y>m.h&&Math.random()>.975)m.drops[i]=Math.random()*-35}}
  function drawWorldParticles(t,dt){const ctx=state.particleCtx;if(!ctx)return;ctx.clearRect(0,0,1600,950);ctx.globalCompositeOperation='lighter';
    for(const p of state.coreParticles){p.a+=p.s*dt;const x=800+Math.cos(p.a)*p.r,y=484+Math.sin(p.a)*p.ry,alpha=.16+.32*(.5+.5*Math.sin(t*.002+p.tw));ctx.fillStyle=`rgba(72,255,177,${alpha*p.z})`;ctx.beginPath();ctx.arc(x,y,.7+1.25*p.z,0,6.283);ctx.fill()}
    for(const p of state.particles){p.a+=p.s*dt;const x=p.cx+Math.cos(p.a)*p.r,y=p.cy+Math.sin(p.a)*p.ry,alpha=.25+.45*(.5+.5*Math.sin(t*.0024+p.tw)),rgb=hexRgb(toneHex(p.module));ctx.fillStyle=`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha*p.z})`;ctx.beginPath();ctx.arc(x,y,.65+1.15*p.z,0,6.283);ctx.fill();if(p.z>.9){ctx.strokeStyle=`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha*.18})`;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-Math.sin(p.a)*5,y+Math.cos(p.a)*2);ctx.stroke()}}
    const now=performance.now();state.inbound=state.inbound.filter(p=>{if(now<p.born)return true;const u=clamp((now-p.born)/p.dur,0,1),ease=1-Math.pow(1-u,3),bend=Math.sin(u*Math.PI)*(16+((p.startX+p.startY)%23)),x=p.startX+(p.cx-p.startX)*ease+bend*.22,y=p.startY+(p.cy-p.startY)*ease-bend*.12,rgb=hexRgb(p.color),alpha=(1-u)*.9+.08;ctx.fillStyle=`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;ctx.shadowBlur=8;ctx.shadowColor=p.color;ctx.beginPath();ctx.arc(x,y,p.size*(1-u*.55),0,6.283);ctx.fill();ctx.shadowBlur=0;return u<1});ctx.globalCompositeOperation='source-over'}
  function animationLoop(t){if(!state.open){state.raf=0;return}ensureCanvasSize();const dt=Math.min(40,Math.max(8,t-(state.lastFrame||t)));state.lastFrame=t;if(!state.paused){drawMatrix(dt);drawWorldParticles(t,dt)}state.raf=requestAnimationFrame(animationLoop)}
  function startAnimation(){cancelAnimationFrame(state.raf);state.lastFrame=0;ensureCanvasSize();state.raf=requestAnimationFrame(animationLoop)}

  function transformWorld(){const w=$('#ksu-world');if(!w)return;w.style.transform=`translate(calc(-50% + ${state.panX}px),calc(-50% + ${state.panY}px)) scale(${state.scale})`;$('#ksu-zoom-read').textContent=`${Math.round(state.scale*100)}%`}
  function zoomBy(delta,cx=null,cy=null){state.scale=clamp(state.scale+delta,.35,1.8);transformWorld()}
  function resetView(){state.scale=.55;state.panX=0;state.panY=0;transformWorld()}
  function bindControls(){
    $('#ksu-close').addEventListener('click',close);$('#ksu-refresh').addEventListener('click',()=>refresh({forceBurst:true}));$('#ksu-plus').addEventListener('click',()=>zoomBy(.12));$('#ksu-minus').addEventListener('click',()=>zoomBy(-.12));$('#ksu-reset').addEventListener('click',resetView);
    $('#ksu-pause').addEventListener('click',()=>{state.paused=!state.paused;$('#ksu-overlay').classList.toggle('ksu-paused',state.paused);$('#ksu-pause').textContent=state.paused?'▶ Resume motion':'Ⅱ Pause motion';if(!state.paused)startAnimation()});
    const vp=$('#ksu-viewport');
    vp.addEventListener('wheel',e=>{e.preventDefault();zoomBy(e.deltaY<0?.08:-.08)},{passive:false});
    vp.addEventListener('pointerdown',e=>{if(e.target.closest('button,.ksu-leftpanel,.ksu-legend,.ksu-minimap'))return;state.dragging=true;state.startX=e.clientX;state.startY=e.clientY;state.startPanX=state.panX;state.startPanY=state.panY;vp.classList.add('ksu-dragging');vp.setPointerCapture?.(e.pointerId)});
    vp.addEventListener('pointermove',e=>{if(!state.dragging)return;state.panX=state.startPanX+(e.clientX-state.startX);state.panY=state.startPanY+(e.clientY-state.startY);transformWorld()});
    const end=e=>{if(!state.dragging)return;state.dragging=false;vp.classList.remove('ksu-dragging');try{vp.releasePointerCapture?.(e.pointerId)}catch(_){}};vp.addEventListener('pointerup',end);vp.addEventListener('pointercancel',end);
    document.addEventListener('keydown',e=>{if(!state.open)return;if(e.key==='Escape')close();if(e.key==='+'||e.key==='=')zoomBy(.1);if(e.key==='-')zoomBy(-.1);if(e.key==='0')resetView()});
  }

  function toast(message){const t=$('#ksu-toast');if(!t){alert(message);return}t.textContent=message;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),3000)}
  async function open(){
    buildOverlay();updateSideWidth();state.open=true;$('#ksu-overlay').classList.add('ksu-open');$('#ksu-nav')?.classList.add('ksu-active');document.body.style.overflow='hidden';resetView();
    await refresh();startAnimation();
    clearInterval(state.poll);state.poll=setInterval(()=>{if(state.open)refresh()},12000);
  }
  function close(){state.open=false;$('#ksu-overlay')?.classList.remove('ksu-open');$('#ksu-nav')?.classList.remove('ksu-active');document.body.style.overflow='';clearInterval(state.poll);state.poll=null;cancelAnimationFrame(state.raf);state.raf=0}

  function watchLiveChanges(){
    window.addEventListener('keysuite-customers-changed',()=>{if(state.open){burst('customers',1);addActivity('customers','Customer data updated','Secure customer list changed');setTimeout(refresh,250)}});
    window.addEventListener('storage',e=>{if(!state.open)return;const k=String(e.key||'').toLowerCase();const id=k.includes('quote')?'quotation':k.includes('customer')?'customers':k.includes('assembl')?'assembly':k.includes('price')?'price':null;if(id){burst(id,1);setTimeout(refresh,220)}});
    document.addEventListener('change',e=>{if(!state.open)return;const row=e.target.closest?.('.quote-item');if(row){burst('quotation',1);addActivity('quotation','Quotation edited',row.querySelector('.item-model')?.value||'Quotation item changed')}});
    const root=$('#appView')||document.body;let timer=null;new MutationObserver(records=>{if(!state.open)return;const meaningful=records.some(r=>r.target?.id==='recentQuotes'||r.target?.id==='quoteRows'||r.target?.closest?.('#quotation,#customers'));if(!meaningful)return;clearTimeout(timer);timer=setTimeout(()=>refresh(),600)}).observe(root,{subtree:true,childList:true});
  }

  function init(){
    injectStyles();installVersionLabels();injectLaunchers();buildOverlay();updateSideWidth();watchLiveChanges();window.addEventListener('resize',updateSideWidth);
    window.addEventListener('KEYSUITE_AUTHORITY_CHANGED',applyAuthorityVisibility);
  window.addEventListener('keysuite-permissions-changed',applyAuthorityVisibility);

  window.KeySuiteKeyCore={open,close,refresh,burst,version:VERSION};
    window.KeySuiteUniverse=window.KeySuiteKeyCore; // backward compatibility for V3.7 callers
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});else setTimeout(init,0);
})();
