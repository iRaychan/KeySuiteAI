/* KeySuite V4.01 — live material + assigned Brand logo PDF identity.
   Selling brand/model/logo stay fixed to the selected OEM, while the material-dependent CHC sub-series and CHC/ES technical materials refresh immediately. */
(() => {
  'use strict';

  // If an old V3.9.2 cached selector page still contains this script, do nothing there.
  if (window.top !== window.self) return;
  if (window.__KEYSUITE_V394411_SELECTOR_BRAND_INSTALLED) return;
  window.__KEYSUITE_V394411_SELECTOR_BRAND_INSTALLED = true;
  window.__KEYSUITE_V40001_SELECTOR_BRAND_INSTALLED = true;

  const FRAME_IDS = ['selectorFrame','selectorEsFrame','productSelectorFrame','productEsSelectorFrame'];
  const frameState = new WeakMap();
  let defaultBrandLogo = '';
  const visibleTextMaster = new WeakMap();

  const escapeRe = value => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const norm = value => String(value ?? '').trim();
  function api(){return window.KeySuiteV40001||window.KeySuiteV394410||window.KeySuiteV39449||window.KeySuiteV39446||window.KeySuiteV39445||window.KeySuiteV39444||window.KeySuiteV3944||window.KeySuiteV3943||window.KeySuiteV3942||window.KeySuiteV3941||window.KeySuiteV394||window.KeySuiteV393||window.KeySuiteV391||window.KeySuiteV392||null}
  function frameForSourceWin(sourceWin){return FRAME_IDS.map(id=>document.getElementById(id)).find(frame=>{try{return frame?.contentWindow===sourceWin}catch(_){return false}})||null}
  function liveMaterial(family='CHC',sourceWin=null){
    const fam=String(family||'CHC').toUpperCase(),frame=frameForSourceWin(sourceWin);let v='';
    try{
      if(fam==='CHC'){
        const outerId=frame?.id==='productSelectorFrame'?'productMaterial':'pumpMaterial';
        v=norm(document.getElementById(outerId)?.value)||norm(sourceWin?.keysuiteExportPayload?.keysuite_material);
      }else if(fam==='ES'){
        const outerId=frame?.id==='productEsSelectorFrame'?'esProductMaterial':'esMaterial';
        v=norm(sourceWin?.document?.getElementById('material')?.value)||norm(document.getElementById(outerId)?.value)||norm(sourceWin?.keysuiteExportPayload?.keysuite_material);
      }
    }catch(_){}
    return v;
  }
  function materialProfile(family,material){
    const fam=String(family||'').toUpperCase(),raw=norm(material),u=raw.toUpperCase().replace(/\s+/g,' ');if(!raw)return null;
    if(fam==='CHC'){
      if(/^SS/.test(u)&&/(?:CAST\s*IRON|\bCI\b).*CONNECTION/.test(u))return {casing:'SS (CI Connection)',impeller:'Stainless Steel',shaft:'Stainless Steel'};
      if(/^SS\s*304$/.test(u))return {casing:'Stainless Steel 304',impeller:'Stainless Steel 304',shaft:'Stainless Steel 304'};
      if(/^SS\s*316$/.test(u))return {casing:'Stainless Steel 316',impeller:'Stainless Steel 316',shaft:'Stainless Steel 316'};
    }
    if(fam==='ES'){
      if(/^SS\s*304$/.test(u))return {casing:'Stainless Steel 304',impeller:'Stainless Steel 304',shaft:'Stainless Steel 304'};
      if(/^SS\s*316$/.test(u))return {casing:'Stainless Steel 316',impeller:'Stainless Steel 316',shaft:'Stainless Steel 316'};
      if(/^CI(?:\s*\/\s*|\s+)CI(?:\s*\/\s*|\s+)SS(?:\b|\s*\/)/.test(u))return {casing:'Cast Iron',impeller:'Cast Iron',shaft:'Stainless Steel'};
      if(/^CI(?:\s*\/\s*|\s+)SS(?:\s*\/\s*|\s+)SS(?:\b|\s*\/)/.test(u))return {casing:'Cast Iron',impeller:'Stainless Steel',shaft:'Stainless Steel'};
    }
    return null;
  }

  function pinnedContext(sourceWin=null,familyOverride=''){
    try{
      const pin=sourceWin?.__KEYSUITE_MODEL_PRESENTATION_CONTEXT;
      if(!pin||typeof pin!=='object')return null;
      const family=String(familyOverride||'').toUpperCase();
      if(family&&String(pin.family||'').toUpperCase()!==family)return null;
      return {...pin,pinned:true};
    }catch(_){return null}
  }
  function context(familyOverride='',sourceWin=null){
    const family=String(familyOverride||'').toUpperCase();
    const pinned=pinnedContext(sourceWin,familyOverride);
    try {
      const a=api();
      if(pinned){
        const material=liveMaterial(family,sourceWin)||norm(pinned.material);
        if(family==='CHC'){
          const fresh=a?.brandContext?.(pinned.id||a?.state?.selectedBrandId,family,material)||{};
          const target=norm(fresh.sellingSeries||fresh.masterSeries||pinned.sellingSeries||pinned.masterSeries||'CHC');
          const masterModel=norm(pinned.masterModel);
          const displayModel=masterModel?masterModel.replace(/^(?:CHCS|CHCN|CHC)\b/i,target):norm(pinned.displayModel);
          return {...pinned,...fresh,material,masterModel,displayModel,pinned:true};
        }
        return {...pinned,material:material||norm(pinned.material),pinned:true};
      }
      const ctx = family ? a?.brandContext?.(a?.state?.selectedBrandId,family,family==='CHC'?liveMaterial(family,sourceWin):'') : a?.brandContext?.();
      if (ctx) return {...ctx,material:liveMaterial(family,sourceWin)||ctx.material||''};
    } catch (_) {}
    return {id:'',name:'B.G.Reich',key:'b.g.reich',logo:'',countryOfOrigin:'',family:String(familyOverride||'CHC').toUpperCase(),brandSeries:String(familyOverride||'CHC').toUpperCase(),sellingSeries:'',masterSeries:String(familyOverride||'CHC').toUpperCase(),material:liveMaterial(family,sourceWin)};
  }
  function isMaster(ctx=context()){
    return String(ctx?.key || '').toLowerCase() === 'b.g.reich' || String(ctx?.name || '').toLowerCase() === 'b.g.reich';
  }
  function modelAlias(text,ctx=context()){
    let out=String(text??''),family=String(ctx?.family||'').toUpperCase(),target=String(ctx?.sellingSeries||ctx?.masterSeries||'').trim();
    if(family==='CHC'&&target)return out.replace(/\bCHCS\b|\bCHCN\b|\bCHC\b/g,target);
    if(isMaster(ctx))return out;
    const master=String(ctx?.masterSeries||'').trim();if(master&&target&&master.toUpperCase()!==target.toUpperCase())out=out.replace(new RegExp(`\\b${escapeRe(master)}\\b`,'g'),target);
    return out;
  }
  function brandAlias(text,ctx=context()){
    let out = modelAlias(text,ctx);
    if (!isMaster(ctx)) out = out.replace(/B\.G\.Reich/g, String(ctx?.name || 'B.G.Reich'));
    return out;
  }

  function captureDefaultLogo(doc){
    if (defaultBrandLogo || !doc) return;
    const candidates = [
      ...doc.querySelectorAll('header img,.brand-wrap img,.brand img,img.brand-logo,img.tds-logo,.report-head img,.tds-header img')
    ];
    const chosen = candidates.find(img => /reich|brand|logo/i.test(`${img.alt || ''} ${img.getAttribute('src') || ''}`)) || candidates[0];
    if (chosen?.src) defaultBrandLogo = chosen.src;
  }

  function selectorLogoCandidates(doc){
    if(!doc) return [];
    return [...doc.querySelectorAll('header .brand-logo,.brand-wrap > .brand-logo,.top > .brand img,.top .brand > img')];
  }

  function displayedSelectorLogo(doc){
    const img=selectorLogoCandidates(doc)[0];
    return String(img?.currentSrc||img?.src||img?.getAttribute?.('src')||'').trim();
  }

  function applySelectorLogo(doc,ctx=context()){
    if(!doc) return;
    const logo=String(ctx?.logo||'').trim();
    selectorLogoCandidates(doc).forEach(img=>{
      if(!img.dataset.v394MasterSrc) img.dataset.v394MasterSrc=img.getAttribute('src')||'';
      if(!img.dataset.v394MasterAlt) img.dataset.v394MasterAlt=img.getAttribute('alt')||'B.G.Reich';
      const masterSrc=img.dataset.v394MasterSrc||'';
      if(!logo){
        img.onerror=null;
        if(masterSrc && img.getAttribute('src')!==masterSrc) img.setAttribute('src',masterSrc);
        img.alt=img.dataset.v394MasterAlt||String(ctx?.name||'B.G.Reich');
        return;
      }
      if(img.getAttribute('src')!==logo) img.setAttribute('src',logo);
      img.alt=String(ctx.name||'Brand');
      img.onerror=()=>{
        img.onerror=null;
        if(masterSrc) img.setAttribute('src',masterSrc);
      };
    });
  }

  function applyPinnedChrome(doc,sourceWin=null){
    if(!doc?.head)return;
    const id='ksV39446PinnedSelectorChrome';let style=doc.getElementById(id);
    const hide=!!sourceWin?.__KEYSUITE_HIDE_INNER_ACTIONS;
    if(!hide){if(style)style.remove();return}
    if(!style){style=doc.createElement('style');style.id=id;doc.head.appendChild(style)}
    style.textContent='.keysuite-header-actions{display:none!important}';
  }

  function applyVisibleAliases(doc,familyOverride='',sourceWin=null){
    if (!doc?.body) return;
    captureDefaultLogo(doc);
    const ctx = context(familyOverride,sourceWin);
    applyPinnedChrome(doc,sourceWin);
    applySelectorLogo(doc,ctx);
    // V3.9.4.3: every user-facing master-series reference follows the selected selling series.
    // Text nodes retain their original master wording so B.G.Reich can always be restored exactly.
    const walker=doc.createTreeWalker(doc.body,4),nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      const parent=node.parentElement;
      if(!parent||['SCRIPT','STYLE','TEXTAREA'].includes(parent.tagName))return;
      if(parent.closest?.('[data-keysuite-no-brand-alias]'))return;
      if(!visibleTextMaster.has(node))visibleTextMaster.set(node,node.nodeValue||'');
      const masterText=visibleTextMaster.get(node)||'';
      const next=isMaster(ctx)?modelAlias(masterText,ctx):brandAlias(masterText,ctx);
      if(node.nodeValue!==next)node.nodeValue=next;
    });
    // Main selector heading follows the Brand Series (CHC / SVM / VMS), not the material-dependent Sub Series.
    const mainSeries=String(ctx?.brandSeries||ctx?.sellingSeries||ctx?.masterSeries||ctx?.family||'').trim();
    if(mainSeries){
      doc.querySelectorAll('h1,h2,h3,.brand-title,.selector-title,.series-title').forEach(el=>{
        const raw=String(el.textContent||'');
        if(/KeyCHC\s*-\s*.+?\s+Series\b/i.test(raw))el.textContent=raw.replace(/(KeyCHC\s*-\s*).+?(\s+Series\b)/i,`$1${mainSeries}$2`);
      });
    }
  }

  function replaceReportText(doc,ctx){
    if(!doc?.body)return;
    const walker=doc.createTreeWalker(doc.body,4),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{const parent=node.parentElement;if(!parent||['SCRIPT','STYLE'].includes(parent.tagName))return;const raw=node.nodeValue||'',next=isMaster(ctx)?modelAlias(raw,ctx):brandAlias(raw,ctx);if(next!==raw)node.nodeValue=next;});
    if(String(ctx.family||'').toUpperCase()==='CHC'){
      doc.querySelectorAll('td').forEach(td=>{if(td.textContent.trim()==='Type'){const value=td.nextElementSibling;if(value)value.textContent='VMS Pump';}});
    }
  }

  function applyCountryOfOrigin(doc,ctx){
    if(!doc?.body) return;
    const origin=String(ctx?.countryOfOrigin||'').trim();
    if(!origin) return;
    const exact=/^Country\s+(?:of\s+)?Origin\s*:?$/i;
    const inline=/(Country\s+(?:of\s+)?Origin\s*[:：-]\s*)([^\n\r]+)/i;
    // Structured label/value layouts.
    [...doc.querySelectorAll('td,th,dt,label,span,strong,b,p,div')].forEach(label=>{
      const txt=String(label.textContent||'').trim();
      if(!exact.test(txt)) return;
      let value=label.nextElementSibling;
      if(!value&&label.parentElement){
        const kids=[...label.parentElement.children],i=kids.indexOf(label);
        if(i>=0)value=kids[i+1]||null;
      }
      if(value&&!exact.test(String(value.textContent||'').trim())) value.textContent=origin;
    });
    // Inline text layouts such as “Country of Origin: Malaysia”.
    const walker=doc.createTreeWalker(doc.body,4),nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      const parent=node.parentElement;
      if(!parent||['SCRIPT','STYLE'].includes(parent.tagName))return;
      const text=String(node.nodeValue||'');
      if(inline.test(text))node.nodeValue=text.replace(inline,`$1${origin}`);
    });
  }

  function ensureOemPdfLogoStyle(doc){
    if(!doc?.head||doc.getElementById('ksV3941OemPdfLogoStyle'))return;
    const style=doc.createElement('style');
    style.id='ksV3941OemPdfLogoStyle';
    style.textContent='.ks-v3941-oem-pdf-logo{width:52mm!important;height:auto!important;max-width:52mm!important;max-height:17mm!important;object-fit:contain!important;object-position:left bottom!important;box-sizing:border-box!important;}.top{align-items:flex-end!important;padding-bottom:calc(1px + .353mm)!important;}.top .ks-v3941-oem-pdf-logo{object-position:left bottom!important;align-self:flex-end!important;margin-bottom:0!important;}';
    doc.head.appendChild(style);
  }

  function applyReportImages(doc,ctx,selectorLogo=''){
    // Every selected Product Brand uses its assigned logo when present; missing logo keeps the native selector/PDF logo.
    if (!doc) return;
    const logo = String(ctx?.logo || selectorLogo || '').trim();
    if (!logo) return; // OEM missing logo: leave existing system logo; never block PDF.
    ensureOemPdfLogoStyle(doc);
    doc.querySelectorAll('img.brand-logo,img.tds-logo,.report-head img,.tds-header img,.dimension-page .brand-logo,.top img,header img').forEach(img => {
      if (!img.dataset.v393FallbackSrc) img.dataset.v393FallbackSrc = img.getAttribute('src') || '';
      img.src = logo;
      img.setAttribute('src',logo);
      img.dataset.keysuitePdfBrand='1';
      img.alt = String(ctx.name || 'Brand');
      img.classList.add('ks-v3941-oem-pdf-logo');
      img.onerror = () => {
        const fallback = img.dataset.v393FallbackSrc || '';
        img.onerror = null;
        img.classList.remove('ks-v3941-oem-pdf-logo');
        if (fallback) img.src = fallback;
      };
    });
  }

  function chcPdfSealText(rawSeal,rawElastomer){
    const raw=norm(rawSeal)||'Car/Cer',n=raw.toLowerCase().replace(/[\/_-]+/g,' ').replace(/\s+/g,' ').trim();let faces=raw.replace(/[\/]+/g,' ').replace(/\s+/g,' ').trim();
    if(!n||n==='car cer'||n==='car sic'||n==='ca sic'||n.includes('carbon'))faces='Ca SiC';else if(n==='sic sic'||n.includes('silicon carbide'))faces='SiC SiC';else if(n==='tc tc'||n==='tuc tic'||n==='tuc tuc'||n.includes('tungsten'))faces='TuC TuC';
    let e=norm(rawElastomer)||'Viton';if(/^viton$/i.test(e))e='Viton';else if(/^epdm$/i.test(e))e='EPDM';else if(/^nbr$/i.test(e))e='NBR';
    return faces==='Ca SiC'&&e==='Viton'?'Mechanical Seal':`Mech Seal - ${faces} ${e}`;
  }

  function applyProductMaterial(doc,sourceWin,ctx=context()){
    if(!doc?.body||!sourceWin)return;
    let payload={};try{payload=sourceWin.keysuiteExportPayload||{}}catch(_){payload={}}
    const family=String(ctx?.family||sourceWin?.__KEYSUITE_V39445_FAMILY||'').toUpperCase();
    const material=liveMaterial(family,sourceWin)||norm(payload.keysuite_material)||norm(ctx?.material);
    const heading=doc.querySelector('td.material-heading,.material-heading');
    if(heading)heading.textContent='Material: -';
    const profile=material?materialProfile(family,material):null;
    [...doc.querySelectorAll('td,th')].forEach(td=>{
      const label=norm(td.textContent).toLowerCase(),value=td.nextElementSibling;if(!value)return;
      if(profile&&label==='casing')value.textContent=profile.casing;
      if(profile&&label==='impeller')value.textContent=profile.impeller;
      if(profile&&label==='shaft')value.textContent=profile.shaft;
      // V4.05.08 FIX: never write the raw seal-face code (Car/Cer, SiC/SiC, TC/TC)
      // into Page 2. The final writer must always apply the combined face + elastomer rule.
      if(family==='CHC'&&label==='shaft seal')value.textContent=chcPdfSealText(payload.keysuite_seal,payload.keysuite_elastomer);
    });
  }

  function applyReport(doc,sourceWin=null){
    try {
      const family=String(sourceWin?.__KEYSUITE_V39445_FAMILY||'').toUpperCase();
      const ctx = context(family,sourceWin);
      let selectorLogo='';
      if(sourceWin?.document){
        applySelectorLogo(sourceWin.document,ctx);
        selectorLogo=String(ctx?.logo||'').trim() ? displayedSelectorLogo(sourceWin.document) : '';
      }
      if (doc?.title){const lockedTitle=String(sourceWin?.__KEYSUITE_PDF_PRESENTATION_SNAPSHOT?.pdfFileTitle||sourceWin?.__KEYSUITE_PDF_FILE_TITLE__||'').trim();doc.title=lockedTitle||modelAlias(doc.title,ctx);}
      applyReportImages(doc,ctx,selectorLogo);
      applyProductMaterial(doc,sourceWin,ctx);
      replaceReportText(doc,ctx);
      doc?.querySelectorAll?.('td')?.forEach?.(td=>{if(!/^No\. of Stage$/i.test(String(td.textContent||'').trim()))return;const v=td.nextElementSibling,m=String(v?.textContent||'').match(/\d+/);if(v&&m){const n=Number(m[0]);v.textContent=`${n} ${n===1?'Stage':'Stages'}`;}});
      applyCountryOfOrigin(doc,ctx);
    } catch (error) {
      console.warn('KeySuite V3.9.4.4.11 PDF branding skipped; original PDF remains available.', error);
    }
  }

  function reportContextSnapshot(sourceWin=null){
    // V3.9.4.4.11: PDF identity is frozen at the instant the user presses PDF.
    // This prevents later navigation/material/brand events from reverting TESK/OEM output.
    try{
      const locked=sourceWin?.__KEYSUITE_PDF_PRESENTATION_SNAPSHOT;
      if(locked&&typeof locked==='object')return {...locked};
    }catch(_){}
    const family=String(sourceWin?.__KEYSUITE_V39445_FAMILY||'CHC').toUpperCase();
    const ctx=context(family,sourceWin);
    let logo=String(ctx?.logo||'').trim();
    try{if(sourceWin?.document){applySelectorLogo(sourceWin.document,ctx);if(logo)logo=displayedSelectorLogo(sourceWin.document)||logo;}}catch(_){}
    return {
      family,
      name:String(ctx?.name||'B.G.Reich'),
      key:String(ctx?.key||''),
      logo,
      countryOfOrigin:String(ctx?.countryOfOrigin||''),
      sellingSeries:String(ctx?.sellingSeries||ctx?.masterSeries||family),
      masterSeries:String(ctx?.masterSeries||family),
      masterModel:String(ctx?.masterModel||''),
      displayModel:String(ctx?.displayModel||''),
      material:liveMaterial(family,sourceWin)||String(ctx?.material||''),
      seal:norm(sourceWin?.keysuiteExportPayload?.keysuite_seal)||'Car/Cer',
      elastomer:norm(sourceWin?.keysuiteExportPayload?.keysuite_elastomer)||'Viton',
      applyBrandName:!isMaster(ctx),
      isMaster:isMaster(ctx)
    };
  }

  function reportIdentityScript(snapshot){
    const data=JSON.stringify(snapshot).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
    return String.raw`<script id="ksV394410PdfIdentity">(()=>{const c=${data};const sealText=()=>{const raw=String(c.seal||'Car/Cer').trim(),z=raw.toLowerCase().replace(/[\/_-]+/g,' ').replace(/\s+/g,' ').trim();let f=raw.replace(/[\/]+/g,' ').replace(/\s+/g,' ').trim();if(!z||z==='car cer'||z==='car sic'||z==='ca sic'||z.includes('carbon'))f='Ca SiC';else if(z==='sic sic'||z.includes('silicon carbide'))f='SiC SiC';else if(z==='tc tc'||z==='tuc tic'||z==='tuc tuc'||z.includes('tungsten'))f='TuC TuC';let e=String(c.elastomer||'Viton').trim()||'Viton';if(/^viton$/i.test(e))e='Viton';else if(/^epdm$/i.test(e))e='EPDM';else if(/^nbr$/i.test(e))e='NBR';return f==='Ca SiC'&&e==='Viton'?'Mechanical Seal':'Mech Seal - '+f+' '+e};const alias=t=>{let x=String(t??'');if(c.masterModel&&c.displayModel)x=x.split(c.masterModel).join(c.displayModel);if(c.family==='CHC'&&c.sellingSeries)x=x.replace(/\b(?:CHCS|CHCN|CHC)\b/g,c.sellingSeries);else if(c.masterSeries&&c.sellingSeries&&c.masterSeries!==c.sellingSeries)x=x.split(c.masterSeries).join(c.sellingSeries);if(c.applyBrandName&&c.name)x=x.replace(/B\.G\.Reich/g,c.name);return x};const apply=()=>{try{document.title=c.pdfFileTitle||c.displayModel||alias(document.title);const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),a=[];while(w.nextNode())a.push(w.currentNode);a.forEach(n=>{const p=n.parentElement;if(!p||['SCRIPT','STYLE'].includes(p.tagName))return;const y=alias(n.nodeValue);if(y!==n.nodeValue)n.nodeValue=y});document.querySelectorAll('td').forEach(td=>{const label=String(td.textContent||'').trim();if(label==='Type'){const v=td.nextElementSibling;if(v&&c.family==='CHC')v.textContent='VMS Pump';}if(c.family==='CHC'&&/^Shaft Seal$/i.test(label)){const v=td.nextElementSibling;if(v)v.textContent=sealText();}if(/^No\. of Stage$/i.test(label)){const v=td.nextElementSibling;if(v){const m=String(v.textContent||'').match(/\d+/);if(m){const n=Number(m[0]);v.textContent=n+' '+(n===1?'Stage':'Stages');}}}});if(c.countryOfOrigin){document.querySelectorAll('td,th,dt,label,span,strong,b,p,div').forEach(l=>{if(!/^Country\s+(?:of\s+)?Origin\s*:?$/i.test(String(l.textContent||'').trim()))return;let v=l.nextElementSibling;if(!v&&l.parentElement){const k=[...l.parentElement.children],i=k.indexOf(l);v=i>=0?k[i+1]:null}if(v)v.textContent=c.countryOfOrigin});}if(c.logo){let st=document.getElementById('ksV394410PdfLogoStyle');if(!st){st=document.createElement('style');st.id='ksV394410PdfLogoStyle';st.textContent='.ks-v394410-brand-logo{width:52mm!important;height:auto!important;max-width:52mm!important;max-height:17mm!important;object-fit:contain!important;object-position:left bottom!important;box-sizing:border-box!important}.top{align-items:flex-end!important;padding-bottom:calc(1px + .353mm)!important}.top .ks-v394410-brand-logo{object-position:left bottom!important;align-self:flex-end!important;margin-bottom:0!important}';document.head.appendChild(st)}document.querySelectorAll('.top img,.tds-header img,.report-head img,img.brand-logo,img.tds-logo,.dimension-page img.brand-logo,header img').forEach(img=>{img.src=c.logo;img.setAttribute('src',c.logo);img.alt=c.name||'Brand';img.dataset.keysuitePdfBrand='1';img.classList.add('ks-v394410-brand-logo')});}}catch(e){console.warn('KeySuite V4.01 PDF identity:',e)}};apply();})();<\/script>`;
  }

  function escAttr(value){return String(value??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
  function replaceFirstImageInSection(html,className,logo,brandName){
    if(!logo)return html;
    const startRe=new RegExp('<(?:div|section)\\b[^>]*class=["\\\'][^"\\\']*\\b'+className+'\\b[^"\\\']*["\\\'][^>]*>','i');
    const m=startRe.exec(html);if(!m)return html;
    const start=m.index+m[0].length;const tail=html.slice(start);const im=/<img\b[^>]*>/i.exec(tail);if(!im||im.index>1200000)return html;
    let tag=im[0];const src='src="'+escAttr(logo)+'"',alt='alt="'+escAttr(brandName||'Brand')+'"';
    tag=/\bsrc\s*=\s*(["']).*?\1/i.test(tag)?tag.replace(/\bsrc\s*=\s*(["']).*?\1/i,src):tag.replace(/<img\b/i,'<img '+src);
    tag=/\balt\s*=\s*(["']).*?\1/i.test(tag)?tag.replace(/\balt\s*=\s*(["']).*?\1/i,alt):tag.replace(/<img\b/i,'<img '+alt);
    if(!/data-keysuite-pdf-brand=/i.test(tag))tag=tag.replace(/<img\b/i,'<img data-keysuite-pdf-brand="1"');
    const pos=start+im.index;return html.slice(0,pos)+tag+html.slice(pos+im[0].length);
  }
  function transformReportHtml(html,sourceWin=null){
    if(typeof html!=='string'||!html)return html;
    const snapshot=reportContextSnapshot(sourceWin);
    let out=html;
    // Native-source correction: Page 2 must say 1 Stage, otherwise n Stages.
    out=out.replace(/(<td[^>]*>\s*No\. of Stage\s*<\/td>\s*<td[^>]*>\s*)(\d+)\s+Stages(\s*<\/td>)/gi,(_,a,n,z)=>a+n+' '+(Number(n)===1?'Stage':'Stages')+z);
    // Replace the native B.G.Reich image in Page 1 and Page 2 before the report is parsed.
    if(snapshot.logo){out=replaceFirstImageInSection(out,'top',snapshot.logo,snapshot.name);out=replaceFirstImageInSection(out,'tds-header',snapshot.logo,snapshot.name);}
    const script=reportIdentityScript(snapshot);
    const idx=out.toLowerCase().lastIndexOf('</body>');
    return idx>=0?out.slice(0,idx)+script+out.slice(idx):out+script;
  }

  function installReportWriteTransform(reportWin,sourceWin=null){
    if(!reportWin)return;
    try{
      reportWin.__KEYSUITE_REPORT_SOURCE_WIN=sourceWin||reportWin.__KEYSUITE_REPORT_SOURCE_WIN||null;
      const installOnDoc=doc=>{
        if(!doc||doc.__KEYSUITE_V394411_WRITE_HOOKED)return;
        doc.__KEYSUITE_V394411_WRITE_HOOKED=true;
        const nativeWrite=doc.write.bind(doc),nativeWriteln=typeof doc.writeln==='function'?doc.writeln.bind(doc):null;
        doc.write=(...parts)=>nativeWrite(...parts.map(x=>typeof x==='string'?transformReportHtml(x,reportWin.__KEYSUITE_REPORT_SOURCE_WIN):x));
        if(nativeWriteln)doc.writeln=(...parts)=>nativeWriteln(...parts.map(x=>typeof x==='string'?transformReportHtml(x,reportWin.__KEYSUITE_REPORT_SOURCE_WIN):x));
      };
      installOnDoc(reportWin.document);
      // document.open() may recreate/reset the initial about:blank Document.
      // Patch this iframe/window's Document prototype too so the transform survives that reset.
      const proto=reportWin.Document?.prototype;
      if(proto&&!proto.__KEYSUITE_V394411_WRITE_PROTO_HOOKED){
        proto.__KEYSUITE_V394411_WRITE_PROTO_HOOKED=true;
        const pw=proto.write,pwl=proto.writeln;
        if(typeof pw==='function')proto.write=function(...parts){return pw.apply(this,parts.map(x=>typeof x==='string'?transformReportHtml(x,reportWin.__KEYSUITE_REPORT_SOURCE_WIN):x))};
        if(typeof pwl==='function')proto.writeln=function(...parts){return pwl.apply(this,parts.map(x=>typeof x==='string'?transformReportHtml(x,reportWin.__KEYSUITE_REPORT_SOURCE_WIN):x))};
      }
    }catch(e){console.warn('KeySuite V4.01 PDF write hook:',e)}
  }


  function hookPrintWindow(win,sourceWin=null){
    if (!win || win.__KEYSUITE_V393_PRINT_HOOKED) return;
    try {
      const nativePrint = typeof win.print === 'function' ? win.print.bind(win) : null;
      if (!nativePrint) return;
      win.__KEYSUITE_V393_PRINT_HOOKED = true;
      win.print = (...args) => {
        try { applyReport(win.document,sourceWin); } catch (_) {}
        return nativePrint(...args);
      };
    } catch (_) {}
  }

  function watchReportWindow(win,sourceWin=null){
    if(!win)return;
    const apply=()=>{try{hookPrintWindow(win,sourceWin);if(win.document?.body?.childNodes?.length)applyReport(win.document,sourceWin);}catch(_){}};
    apply();
    try{win.addEventListener('load',apply,{once:true});}catch(_){}
    // One deferred pass handles document.write() reports without any recurring poll.
    setTimeout(apply,0);
  }

  function hookSelectorWindow(win,family='CHC'){
    if(!win)return;
    const fam=String(family||'CHC').toUpperCase();
    try{
      win.__KEYSUITE_V39445_FAMILY=fam;
      if(!win.__KEYSUITE_V39445_SELECTOR_WINDOW_HOOKED){
        win.__KEYSUITE_V39445_SELECTOR_WINDOW_HOOKED=true;
        const nativeOpen=typeof win.open==='function'?win.open.bind(win):null;
        if(nativeOpen){win.open=(...args)=>{const report=nativeOpen(...args);if(report){installReportWriteTransform(report,win);watchReportWindow(report,win);}return report;};}
        const doc=win.document;
        const reapply=()=>setTimeout(()=>applyVisibleAliases(doc,fam,win),0);
        doc.addEventListener('click',event=>{if(event.target?.closest?.('button,.alt-card,[role="button"]'))reapply();},true);
        doc.addEventListener('change',event=>{if(event.target?.matches?.('select,input'))reapply();},true);
        // KeyCHC desktop export writes into a hidden #pdfPrintFrame instead of window.open().
        // Hook that one append event so the exact selected brand/material is applied before print.
        if(doc.body&&!doc.body.__KEYSUITE_V39445_PDF_APPEND_HOOKED){
          doc.body.__KEYSUITE_V39445_PDF_APPEND_HOOKED=true;
          const nativeAppend=doc.body.appendChild.bind(doc.body);
          doc.body.appendChild=node=>{const result=nativeAppend(node);if(node?.tagName==='IFRAME'&&node.id==='pdfPrintFrame'){const snap=reportContextSnapshot(win);installReportWriteTransform(node.contentWindow,win);{const title=String(snap.pdfFileTitle||'').trim()||snap.displayModel||modelAlias(node.name||node.title||'',context(fam,win));if(title){try{node.name=title;node.title=title;win.document.title=title;node.contentWindow.__KEYSUITE_PDF_FILE_TITLE__=title;}catch(_){}}}watchReportWindow(node.contentWindow,win);}return result;};
        }
      }
      const doc=win.document;captureDefaultLogo(doc);applyVisibleAliases(doc,fam,win);
      frameState.set(win,{installed:true,family:fam});
    }catch(error){console.warn('KeySuite V4.01 selector presentation bridge skipped.',error);}
  }

  function collapseSummaryForFrame(frame){
    try{const w=frame?.contentWindow;if(!w)return;const isEs=/Es/i.test(frame.id||'');w.sessionStorage.setItem(isEs?'keyes-summary-collapsed':'keychc-summary-collapsed','1');const d=w.document;if(isEs){const b=d.getElementById('esSummaryToggle');if(b&&!/▶/.test(b.textContent||''))b.click();}else{const b=[...d.querySelectorAll('button')].find(x=>/^Summary\s*[▼▶]/i.test((x.textContent||'').trim()));if(b&&!/▶/.test(b.textContent||''))b.click();}}catch(_){}
  }

  function syncParentChcOptions(frame){
    if(!frame)return;
    try{
      const w=frame.contentWindow,family=frameFamily(frame),product=/^product/i.test(frame.id||'');
      if(family==='CHC'){
        const material=norm(document.getElementById(product?'productMaterial':'pumpMaterial')?.value)||norm(context('CHC',w)?.material)||'SS304 (Cast Iron Connection)';
        w.keysuiteExportPayload={...(w.keysuiteExportPayload||{}),keysuite_material:material,keysuite_seal:document.getElementById(product?'productSeal':'sealFaces')?.value||'',keysuite_elastomer:document.getElementById(product?'productElastomer':'sealElastomer')?.value||'',keysuite_connection_type:document.getElementById(product?'productConnection':'connectionType')?.value||'',keysuite_bare_shaft:!!document.getElementById(product?'productBareShaft':'bareShaft')?.checked};
      }else if(family==='ES'){
        const material=norm(document.getElementById(product?'esProductMaterial':'esMaterial')?.value)||norm(w.document?.getElementById('material')?.value)||norm(w.keysuiteExportPayload?.keysuite_material);
        if(material)w.keysuiteExportPayload={...(w.keysuiteExportPayload||{}),keysuite_material:material};
      }
    }catch(_){}
  }

  function frameFamily(frame){return /Es/i.test(frame?.id||'')?'ES':'CHC'}
  function installFrame(frame){
    if (!frame) return;
    try {
      const win = frame.contentWindow,family=frameFamily(frame);
      if (win?.document?.documentElement){syncParentChcOptions(frame);hookSelectorWindow(win,family);collapseSummaryForFrame(frame);}
    } catch (_) {}
  }
  function isActiveFrame(frame){
    if(!frame)return false;
    try{if(frame.closest?.('dialog[open]'))return true;}catch(_){}
    const style=getComputedStyle(frame);return style.display!=='none'&&style.visibility!=='hidden'&&!!frame.getClientRects().length;
  }
  function bindFrame(frame){
    if(!frame||frame.dataset.v39443BrandBridgeBound)return;
    frame.dataset.v39443BrandBridgeBound='1';
    frame.addEventListener('load',()=>{if(isActiveFrame(frame))installFrame(frame);});
  }
  function refresh(targetFrame=null){
    const frames=targetFrame?[targetFrame]:FRAME_IDS.map(id=>document.getElementById(id)).filter(isActiveFrame);
    frames.forEach(frame=>{bindFrame(frame);if(!isActiveFrame(frame))return;installFrame(frame);try{if(frame.contentDocument){syncParentChcOptions(frame);applyVisibleAliases(frame.contentDocument,frameFamily(frame),frame.contentWindow);}}catch(_){}});
  }

  window.addEventListener('KEYSUITE_V393_BRAND_CONTEXT_CHANGED',event=>{
    const page=event.detail?.page||'';
    const id=page==='selectorEs'||page==='productEs'?'selectorEsFrame':page==='selector'||page==='productChc'?'selectorFrame':'';
    const frame=id?document.getElementById(id):null;if(frame&&isActiveFrame(frame))refresh(frame);
  });
  document.addEventListener('change',event=>{const id=event.target?.id;if(!['pumpMaterial','sealFaces','sealElastomer','connectionType','bareShaft','productMaterial','productSeal','productElastomer','productConnection','productBareShaft','esMaterial','esProductMaterial','esSealType','esProductSealType','esSealMaterial','esProductSealMaterial','esElastomer','esProductElastomer'].includes(id))return;const isEs=/^es/i.test(id),product=/Product/.test(id);const frame=document.getElementById(isEs?(product?'productEsSelectorFrame':'selectorEsFrame'):(product?'productSelectorFrame':'selectorFrame'));try{if(frame?.contentWindow)delete frame.contentWindow.__KEYSUITE_PDF_PRESENTATION_SNAPSHOT}catch(_){}if(frame&&isActiveFrame(frame)){syncParentChcOptions(frame);refresh(frame);}},true);
  window.addEventListener('message',event=>{const data=event.data||{};if(data.type!=='KEYSUITE_PRODUCT_FRAME_READY')return;const frame=FRAME_IDS.map(id=>document.getElementById(id)).find(f=>f?.contentWindow===event.source);if(frame&&isActiveFrame(frame))refresh(frame);},true);
  document.addEventListener('click',event=>{const btn=event.target.closest?.('button[data-page="selector"],button[data-page="selectorEs"],#productCurveDialog button');if(!btn)return;let frame=null;if(btn.dataset?.page)frame=document.getElementById(btn.dataset.page==='selectorEs'?'selectorEsFrame':'selectorFrame');else frame=FRAME_IDS.map(id=>document.getElementById(id)).find(isActiveFrame);if(frame)setTimeout(()=>{refresh(frame);collapseSummaryForFrame(frame);},0);},true);

  function pinContext(frame,ctx,{hideInnerActions=true}={}){
    if(!frame?.contentWindow||!ctx)return false;
    try{
      frame.contentWindow.__KEYSUITE_MODEL_PRESENTATION_CONTEXT={...ctx,pinned:true};
      frame.contentWindow.__KEYSUITE_HIDE_INNER_ACTIONS=!!hideInnerActions;
      try{applyPinnedChrome(frame.contentDocument,frame.contentWindow)}catch(_){}
      if(isActiveFrame(frame))refresh(frame);
      return true;
    }catch(_){return false}
  }
  function clearPinnedContext(frame){
    if(!frame?.contentWindow)return false;
    try{delete frame.contentWindow.__KEYSUITE_MODEL_PRESENTATION_CONTEXT;delete frame.contentWindow.__KEYSUITE_HIDE_INNER_ACTIONS;applyPinnedChrome(frame.contentDocument,frame.contentWindow);if(isActiveFrame(frame))refresh(frame);return true}catch(_){return false}
  }

  window.KeySuiteSelectorBrand={version:'4.01',refresh,getDefaultLogo:()=>defaultBrandLogo,refreshLogo:()=>refresh(),modelAlias:text=>modelAlias(text,context()),modelAliasFor:(text,ctx)=>modelAlias(text,ctx),brandAlias:text=>brandAlias(text,context()),context,collapseSummaryForFrame,pinContext,clearPinnedContext,transformReportHtml,installReportWriteTransform,liveMaterial,materialProfile};window.KeySuiteV40001SelectorBrand=window.KeySuiteSelectorBrand;
})();
