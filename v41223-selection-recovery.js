/* KeySuite V4.12.23 — Selection navigation recovery guard. */
(()=>{
  'use strict';
  if(window.__KEYSUITE_V41223_SELECTION_RECOVERY__)return;
  window.__KEYSUITE_V41223_SELECTION_RECOVERY__=true;

  const submenu=()=>document.querySelector('.nav-group[data-nav-group="selectorMenu"] .nav-submenu');

  function makeButton(host,page,family,label){
    const b=document.createElement('button');
    b.type='button';b.dataset.page=page;b.dataset.v41223SelectorFallback=family;b.textContent=label;
    b.addEventListener('click',()=>window.KeySuiteApp?.showPage?.(page));
    host.insertBefore(b,host.firstChild);
    return b;
  }

  function ensureFallback(){
    const host=submenu();if(!host)return false;
    let chc=host.querySelector('button[data-v41223-selector-fallback="CHC"]')||host.querySelector(':scope > button[data-page="selector"]');
    let es=host.querySelector('button[data-v41223-selector-fallback="ES"]')||host.querySelector(':scope > button[data-page="selectorEs"]');
    if(!chc)chc=makeButton(host,'selector','CHC','CHC');
    if(!es)es=makeButton(host,'selectorEs','ES','ES');
    chc.dataset.v41223SelectorFallback='CHC';es.dataset.v41223SelectorFallback='ES';
    return true;
  }

  let repairing=false;
  async function repair(){
    if(repairing)return;repairing=true;
    try{
      ensureFallback();
      try{window.KeySuiteV40001?.repairBrandUi?.({reload:!!window.KEYSUITE_PROFILE?.company_id&&!window.KeySuiteV40001?.state?.coreReady})}catch(e){console.warn('[KeySuite V4.12.23 Brand UI]',e)}
      ensureFallback();
    }finally{repairing=false}
  }

  document.addEventListener('DOMContentLoaded',()=>setTimeout(repair,0),{once:true});
  window.addEventListener('KEYSUITE_AUTH_CONTEXT_READY',()=>setTimeout(repair,0));
  window.addEventListener('KEYSUITE_V41223_RUNTIME_READY',()=>setTimeout(repair,0));
  window.addEventListener('pageshow',()=>setTimeout(repair,100));
  document.addEventListener('click',e=>{
    // V4.12.23 hotfix: do not rebuild the selector tree for clicks INSIDE it.
    // Rebuilding on <summary> Brand / brand-name clicks instantly closed the
    // native <details>, making B.G.Reich / TESK / VEC look as if they did not exist.
    const selectorToggle=e.target?.closest?.('[data-nav-toggle="selectorMenu"]');
    if(selectorToggle||e.target?.closest?.('#keyButton,#v391BrandsCard'))setTimeout(repair,0);
  },true);

  // Protect the Selection submenu against an older cached Brand runtime
  // replacing its contents after this guard has already run.
  let observed=false;
  function watch(){
    const host=submenu();if(!host||observed||!window.MutationObserver)return;
    observed=true;
    new MutationObserver(()=>ensureFallback()).observe(host,{childList:true,subtree:false});
  }
  setTimeout(()=>{repair();watch()},500);
  setTimeout(()=>{repair();watch()},2000);
})();
