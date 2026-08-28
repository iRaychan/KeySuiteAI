/* KeySuite V4.17.10 Service Worker. */
const CACHE='keysuite-v41710';
const BOOTSTRAP='\n<script src="./v41200-bootstrap.js?v=41710"></script>\n';
const SHELL=[
  './','./index.html','./manifest.json','./keylargo-logo.png',
  './chc-g1-price-map-v41409.js','./chc-g1-product-data-v41411.js','./permissions.js','./applications.js','./app.js','./keylab.js','./pricing.js','./quotation-references.js','./categories.js','./pricelist.js','./product.js','./manifold.js','./roles.js','./assembly.js','./motor.js','./coupling.js','./baseplate.js','./quotation-templates.js','./company-settings.js','./keyai.js','./auth.js','./v388-dashboard-keycore.js','./universe.js',
  './v41223-selection-recovery.js','./v41200-bootstrap.js','./v41006-bootstrap.js','./v41006-duty-points.js','./v41006-product-duty.js','./v40407-role-authority.js','./v39441-login-stability.js','./v40001-multibrand.js','./v40001-selector-brand.js','./v39445-model-return.js','./v40201-quick-selection.js','./v40001-customer-brand-settings.js','./v394411-product-curve.js','./v3944-categories.js','./v40001-product-series-overhaul.js','./v40205-motor-baseplate-data.js','./v40205-motor-baseplate.js',
  './selector/index.html','./selector/product.html','./selector/favicon.png','./supabase/functions/shared-chc/chc-data.js','./supabase/functions/shared-chc/chc-selector-core.js','./selector/apple-touch-icon.png','./selector/bgreich-logo.png',
  './selector-es/index.html','./selector-es/favicon.svg','./selector-es/bgreich-logo.png','./selector-es/es-core.js','./selector-es/es-data.js','./selector-es/motor-data.js','./selector-es/es-pumpset-dimension.png'
];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL).catch(()=>undefined)))});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('keysuite-')&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})())});
function stripRuntime(html){return String(html||'').replace(/<script[^>]+src=["'][^"']*v\d+-bootstrap\.js[^"']*["'][^>]*><\/script>/gi,'')}
function inject(html){const clean=stripRuntime(html),p=clean.toLowerCase().lastIndexOf('</body>');return p>=0?clean.slice(0,p)+BOOTSTRAP+clean.slice(p):clean+BOOTSTRAP}
function isSelectorPath(path){return /\/(?:selector|selector-es)\//.test(path)}
self.addEventListener('fetch',event=>{const req=event.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==self.location.origin)return;const path=url.pathname.toLowerCase();
  const navigation=req.mode==='navigate'||path.endsWith('/index.html')||path.endsWith('/');
  if(navigation&&!isSelectorPath(path)){
    event.respondWith(fetch(req,{cache:'no-store'}).then(async r=>{if(!r.ok)return r;const text=await r.text();return new Response(inject(text),{status:r.status,statusText:r.statusText,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}})}).catch(()=>caches.match('./index.html').then(async r=>r?new Response(inject(await r.text()),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}}):Response.error())));return;
  }
  if(navigation&&isSelectorPath(path)){
    event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>caches.match(req).then(r=>r||Response.error())));return;
  }
  if(/\.(?:js|css)$/.test(path)){event.respondWith(fetch(req,{cache:'no-store'}).then(r=>{if(r&&r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>undefined)}return r}).catch(()=>caches.match(req)));return}
  event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{if(r&&r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>undefined)}return r})))
});
