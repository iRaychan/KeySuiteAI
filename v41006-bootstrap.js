/* KeySuite V4.10.06 bootstrap. */
(()=>{
  'use strict';
  if(window.top!==window.self||window.__KEYSUITE_V41006_BOOTSTRAP__)return;
  window.__KEYSUITE_V41006_BOOTSTRAP__=true;
  ['V41005','V41004','V41003','V41002','V41001','V410','V4090301','V40903','V40901','V409','V40813','V40812','V40811','V40810','V40809','V40808','V40807','V40806','V40805','V40804','V40803','V40802','V40801','V408','V40704','V40703','V40702','V40701','V407','V406','V40518','V40517','V40516','V40515','V40514','V40513','V40512','V40511','V40510','V40509','V40508','V40507','V40506','V40505','V40504','V40503','V40502','V40501','V405','V40422','V40421','V40420','V40419','V40418','V40417','V40416','V40415','V40414','V40413','V40412','V40411','V40410','V40409','V40408','V40407','V40406','V40404','V40403'].forEach(v=>{try{window[`__KEYSUITE_${v}_BOOTSTRAP__`]=true}catch(_){}});
  window.KEYSUITE_VERSION='4.10.06';
  window.KEYSUITE_BUILD='V4.10.06';
  const VERSION='41006';
  const FILES=['v39441-login-stability.js','v40001-multibrand.js','v40001-selector-brand.js','v39445-model-return.js','v40201-quick-selection.js','v40001-customer-brand-settings.js','v394411-product-curve.js','v41006-duty-points.js','v41006-product-duty.js','v3944-categories.js','v40001-product-series-overhaul.js','v40205-motor-baseplate-data.js','v40205-motor-baseplate.js'];
  function load(src){return new Promise((resolve,reject)=>{const hit=[...document.scripts].find(s=>(s.src||'').includes('/'+src));if(hit){if(hit.dataset.keysuiteLoaded==='1'||hit.readyState==='complete'){resolve();return}hit.addEventListener('load',resolve,{once:true});hit.addEventListener('error',()=>reject(new Error(`Unable to load ${src}`)),{once:true});return}const el=document.createElement('script');el.src=`./${src}?v=${VERSION}`;el.async=false;el.dataset.keysuiteRuntime='v41006';el.onload=()=>{el.dataset.keysuiteLoaded='1';resolve()};el.onerror=()=>reject(new Error(`Unable to load ${src}`));(document.head||document.documentElement).appendChild(el)})}
  function updateVisibleVersion(){try{document.title='KeySuite V4.10.06';document.querySelectorAll('.suite-version,.brand small,.auth-brand small').forEach(el=>{const t=String(el.textContent||'');if(/KeySuite|Full Suite|V\d/i.test(t))el.textContent=t.includes('Full Suite')?'Full Suite V4.10.06':'V4.10.06'});document.documentElement.setAttribute('data-keysuite-version','4.10.06')}catch(_){}}
  (async()=>{for(const f of FILES){try{await load(f)}catch(e){console.error('[KeySuite V4.10.06]',e)}}updateVisibleVersion();try{window.dispatchEvent(new CustomEvent('KEYSUITE_V41006_RUNTIME_READY',{detail:{version:'4.10.06'}}))}catch(_){}})();
})();
