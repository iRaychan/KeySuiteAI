(() => {
'use strict';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const uid=()=>crypto.randomUUID?.()||`qtpl-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const now=()=>new Date().toISOString();
const DEFAULT_SETTINGS={
 logoData:'',companyName:'Keylargo Industrial Sdn. Bhd.',registration:'(297660-M)',
 address:'No. 73, Jalan Industri 2/5\nRawang Integrated Industrial Park, 48000\nRawang, Selangor Darul Ehsan, Malaysia',
 phone:'+60 (3) 6094 2099',fax:'+60 (3) 6094 2033',email:'keylargo@keylargo.com.my',primaryColor:'#17365d',
 font:'Calibri,Arial,Helvetica,sans-serif',priceColumns:'full',header:'',footer:'E & O.E.',
 intro:'We like to thank you for your inquiry and pleased to submit our quotation on the terms set out below.',
 delivery:'Ex - Stock subject to prior sales. Otherwise 2-3 months upon confirmation order.',payment:'Cash before delivery',validity:'14 days',priceBasis:'Ex - K.L. only, nett in Ringgit Malaysia.',
 closing:'Please contact us if you have any remaining question(s) or when this quotation is not in line with your requirements.\nWe would appreciate to receive feedback and to keep us informed about the status of this quotation.',
 bank:'',showSignature:true,pdfName:'{quoteNo} - {customer}'
};
let templates=[],selectedId='',sealedSnapshot=null,access={},initialized=false,pendingLogo=null;
function companyId(){return String(window.KEYSUITE_PROFILE?.company_id||window.KEYSUITE_ACCESS?.company_id||access.company_id||'company')}
function email(){return String(window.KEYSUITE_PROFILE?.email||window.KEYSUITE_ACCESS?.email||access.email||'').toLowerCase()}
function role(){return String(window.KEYSUITE_ACCESS?.role||access.role||'user').toLowerCase()}
function canManageCompany(){return ['owner','admin','administrator'].includes(role())}
function key(){return `ks_v218_quotation_templates_${companyId()}`}
function selectionKey(){return `ks_v218_quotation_template_selection_${companyId()}_${email()||'user'}`}
function normalizeSettings(input={}){return {...DEFAULT_SETTINGS,...(input||{}),showSignature:input?.showSignature!==false}}
function normalizeTemplate(input={}){
 const settings=normalizeSettings(input.settings||input.template_settings||input);
 return {
  id:String(input.id||uid()),company_id:String(input.company_id||companyId()),template_name:String(input.template_name||input.name||'Quotation Template'),
  template_scope:String(input.template_scope||input.scope||'personal')==='company'?'company':'personal',owner_email:String(input.owner_email||input.ownerEmail||email()).toLowerCase(),
  is_default:!!(input.is_default??input.isDefault),status:String(input.status||'active')==='disabled'?'disabled':'active',settings,
  created_at:input.created_at||now(),updated_at:input.updated_at||now()
 };
}
function defaultTemplate(){return normalizeTemplate({id:`standard:${companyId()}`,template_name:'Keylargo Standard Quotation',template_scope:'company',owner_email:'',is_default:false,status:'active',settings:DEFAULT_SETTINGS})}
function isStandardTemplate(item){return String(item?.id||'')===`standard:${companyId()}`}
function localLoad(){try{return (JSON.parse(localStorage.getItem(key())||'[]')||[]).map(normalizeTemplate)}catch(_){return []}}
function localSave(){localStorage.setItem(key(),JSON.stringify(templates))}
function isVisible(template){return template.company_id===companyId()&&(template.template_scope==='company'||template.owner_email===email())}
function activeVisible(){return templates.filter(item=>isVisible(item)&&item.status==='active')}
function chosenDefault(){const rows=activeVisible();return rows.find(item=>!isStandardTemplate(item)&&item.template_scope==='personal'&&item.owner_email===email()&&item.is_default)||rows.find(item=>!isStandardTemplate(item)&&item.template_scope==='company'&&item.is_default)||defaultTemplate()}
async function remoteLoad(){
 const client=window.KeySuiteAuth?.getClient?.();if(!client)return null;
 const {data,error}=await client.rpc('keysuite_list_quotation_templates_v218');
 if(error){console.warn('Quotation template database fallback:',error.message||error);return null}
 return (Array.isArray(data)?data:[]).map(normalizeTemplate);
}
function ensureStandard(){
 const standard=defaultTemplate(),standardId=standard.id;
 templates=templates.filter(item=>String(item.id)!==standardId);templates.unshift(standard);
}
function renderSelect(preferredId=''){
 const select=$('qTemplate');if(!select)return;
 const rows=activeVisible();const preferred=preferredId||selectedId||chosenDefault().id;
 select.innerHTML=rows.map(item=>`<option value="${esc(item.id)}">${esc(item.template_name)}${item.template_scope==='personal'?' — Personal':''}${item.is_default&&!isStandardTemplate(item)?' ★':''}</option>`).join('');
 if(sealedSnapshot&&preferred&&!rows.some(item=>item.id===preferred))select.insertAdjacentHTML('beforeend',`<option value="${esc(preferred)}">${esc(sealedSnapshot.template_name||'Sealed Template Snapshot')} — Sealed</option>`);
 selectedId=([...select.options].some(option=>option.value===preferred)?preferred:(rows[0]?.id||''));select.value=selectedId;
 if(selectedId)localStorage.setItem(selectionKey(),selectedId);updateHeaderLogo();
}
function getTemplate(id=selectedId){return templates.find(item=>item.id===id)||null}
function updateHeaderLogo(){
 const item=sealedSnapshot?normalizeTemplate(sealedSnapshot):(getTemplate(selectedId)||chosenDefault()),settings=item?.settings||DEFAULT_SETTINGS;
 const img=$('quotationTemplateHeaderLogo'),button=$('quotationTemplateLogoButton');if(!img||!button)return;
 img.src=settings.logoData||'keylargo-logo.png';img.alt=`${item.template_name||'Quotation template'} logo`;
 button.title=`Quotation template: ${item.template_name||'Quotation Template'}`;button.setAttribute('aria-label',`Open quotation template: ${item.template_name||'Quotation Template'}`);
}
function snapshotOf(template){if(!template)return null;return JSON.parse(JSON.stringify({...template,settings:normalizeSettings(template.settings),snapshot_at:now()}))}
function selectedSnapshot(){return sealedSnapshot?JSON.parse(JSON.stringify(sealedSnapshot)):snapshotOf(getTemplate(selectedId)||chosenDefault())}
function resetSelection(){sealedSnapshot=null;selectedId=chosenDefault().id;renderSelect(selectedId)}
function loadSelection(id,snapshot,isSealed){sealedSnapshot=isSealed&&snapshot?normalizeTemplate(snapshot):null;selectedId=String(id||sealedSnapshot?.id||chosenDefault().id);renderSelect(selectedId)}
function selectForCustomer(id,{applyDefaults=true}={}){sealedSnapshot=null;const requested=String(id||''),available=templates.find(item=>item.id===requested&&item.template_scope==='company'&&item.status==='active');selectedId=(available||chosenDefault()).id;renderSelect(selectedId);if(applyDefaults)window.KeySuiteApp?.applyQuotationTemplateDefaults?.(selectedSnapshot(),!window.KeySuiteApp?.hasQuotationItems?.());return selectedSnapshot()}
function companyTemplateOptions(){return templates.filter(item=>item.template_scope==='company'&&item.status==='active').map(snapshotOf)}
function message(text,type=''){const box=$('quotationTemplateMessage');if(box){box.textContent=text||'';box.className=`template-message ${type||'muted'}`}}
function formSettings(){
 const closing=String($('templateClosing')?.value||'').replace(/\r\n?/g,'\n');
 return normalizeSettings({logoData:pendingLogo??'',companyName:$('templateCompanyName')?.value.trim(),registration:$('templateRegistration')?.value.trim(),address:$('templateAddress')?.value.trim(),phone:$('templatePhone')?.value.trim(),fax:$('templateFax')?.value.trim(),email:$('templateEmail')?.value.trim(),primaryColor:$('templatePrimaryColor')?.value||'#17365d',font:$('templateFont')?.value||DEFAULT_SETTINGS.font,priceColumns:$('templatePriceColumns')?.value||'full',header:$('templateHeader')?.value.trim(),footer:$('templateFooter')?.value.trim(),intro:$('templateIntro')?.value.trim(),delivery:$('templateDelivery')?.value.trim(),payment:$('templatePayment')?.value.trim(),validity:$('templateValidity')?.value.trim(),priceBasis:$('templatePriceBasis')?.value.trim(),closing,bank:$('templateBank')?.value.trim(),showSignature:!!$('templateShowSignature')?.checked,pdfName:$('templatePdfName')?.value.trim()||DEFAULT_SETTINGS.pdfName});
}
function formTemplate(){
 const id=$('templateId')?.value||uid(),scope=$('templateScope')?.value||'personal';
 return normalizeTemplate({id,template_name:$('templateName')?.value.trim()||'Quotation Template',template_scope:scope,owner_email:scope==='personal'?email():'',is_default:!!$('templateDefault')?.checked,status:$('templateStatus')?.value||'active',settings:formSettings(),created_at:getTemplate(id)?.created_at||now(),updated_at:now()});
}
function fillForm(template){
 const item=normalizeTemplate(template||{template_scope:canManageCompany()?'company':'personal',settings:DEFAULT_SETTINGS});const settings=item.settings;
 $('templateId').value=item.id;$('templateName').value=item.template_name;$('templateScope').value=item.template_scope;$('templateScope').disabled=!canManageCompany();$('templateStatus').value=item.status;$('templateDefault').checked=!!item.is_default;const locked=item.template_scope==='company'&&!canManageCompany();$('saveQuotationTemplate').disabled=locked;$('deleteQuotationTemplate').disabled=locked;$('templateDefault').disabled=locked;
 $('templateCompanyName').value=settings.companyName||'';$('templateRegistration').value=settings.registration||'';$('templateAddress').value=settings.address||'';$('templatePhone').value=settings.phone||'';$('templateFax').value=settings.fax||'';$('templateEmail').value=settings.email||'';$('templatePrimaryColor').value=settings.primaryColor||'#17365d';$('templateFont').value=settings.font||DEFAULT_SETTINGS.font;$('templatePriceColumns').value=settings.priceColumns||'full';$('templateHeader').value=settings.header||'';$('templateFooter').value=settings.footer||'';$('templateIntro').value=settings.intro||'';$('templateDelivery').value=settings.delivery||'';$('templatePayment').value=settings.payment||'';$('templateValidity').value=settings.validity||'';$('templatePriceBasis').value=settings.priceBasis||'';$('templateClosing').value=settings.closing||'';$('templateBank').value=settings.bank||'';$('templateShowSignature').checked=settings.showSignature!==false;$('templatePdfName').value=settings.pdfName||DEFAULT_SETTINGS.pdfName;
 pendingLogo=settings.logoData||'';renderLogo();message('');$('quotationTemplatePreview').style.display='none';
}
function renderLogo(){const img=$('templateLogoPreview');if(!img)return;img.src=pendingLogo||'keylargo-logo.png';img.style.display='block'}
function renderList(){
 const box=$('quotationTemplateList');if(!box)return;const rows=templates.filter(isVisible);
 box.innerHTML=rows.map(item=>`<button type="button" class="${$('templateId')?.value===item.id?'active':''}" data-template-id="${esc(item.id)}"><strong>${esc(item.template_name)}</strong><small>${item.template_scope==='company'?'Company':'Personal'} · ${item.status}${item.is_default?' · Default':''}</small></button>`).join('')||'<div class="muted">No templates.</div>';
 box.querySelectorAll('[data-template-id]').forEach(button=>button.onclick=()=>{fillForm(getTemplate(button.dataset.templateId));renderList()});
}
function openManager(){const current=getTemplate(selectedId)||chosenDefault();fillForm(current);renderList();$('quotationTemplateDialog')?.showModal()}
function newTemplate(){const company=window.KEYSUITE_SECURE_DATA?.companies?.find?.(c=>String(c.id)===companyId())||{};fillForm(normalizeTemplate({id:uid(),template_name:'New Quotation Template',template_scope:canManageCompany()?'company':'personal',owner_email:email(),status:'active',settings:{...DEFAULT_SETTINGS,logoData:'',companyName:company.name||company.company_name||'',registration:'',address:company.address||'',phone:company.phone||'',fax:company.fax||'',email:company.email||''}}));renderList()}
function copyTemplate(){const current=getTemplate($('templateId')?.value)||chosenDefault();fillForm(normalizeTemplate({...snapshotOf(current),id:uid(),template_name:`${current.template_name} Copy`,template_scope:'personal',owner_email:email(),is_default:false,status:'active',created_at:now(),updated_at:now()}));renderList()}
async function saveRemote(template){
 const client=window.KeySuiteAuth?.getClient?.();if(!client)return null;
 const {data,error}=await client.rpc('keysuite_save_quotation_template_v218',{p_template:template});if(error)throw error;
 return normalizeTemplate(Array.isArray(data)?data[0]:data||template);
}
async function saveTemplate(){
 let item=formTemplate();if(!item.template_name){message('Template Name is required.','error');return}
 if(item.template_scope==='company'&&!canManageCompany()){message('Only an Owner or Admin can save a company-wide template.','error');return}
 if(item.is_default){templates=templates.map(row=>({...row,is_default:row.template_scope===item.template_scope&&(item.template_scope==='company'||row.owner_email===item.owner_email)?false:row.is_default}))}
 try{const saved=await saveRemote(item);if(saved)item=saved}catch(error){console.warn(error);message(`Saved locally. Database sync needs V2.18 migration: ${error.message||error}`,'warning')}
 const index=templates.findIndex(row=>row.id===item.id);if(index>=0)templates[index]=item;else templates.push(item);localSave();selectedId=item.id;sealedSnapshot=null;renderSelect(item.id);fillForm(item);renderList();message('Template saved.','success')
}
async function deleteTemplate(){
 const id=$('templateId')?.value,item=getTemplate(id);if(!item)return;if(item.id.startsWith('standard:')&&templates.length===1){message('Keep at least one template.','error');return}
 if(item.template_scope==='company'&&!canManageCompany()){message('Only an Owner or Admin can remove a company template.','error');return}
 if(!confirm(`Delete ${item.template_name}? Sealed quotations keep their saved template snapshot.`))return;
 const client=window.KeySuiteAuth?.getClient?.();if(client){const {error}=await client.rpc('keysuite_delete_quotation_template_v218',{p_template_id:id});if(error)console.warn('Template delete database fallback:',error.message||error)}
 templates=templates.filter(row=>row.id!==id);ensureStandard();localSave();resetSelection();fillForm(chosenDefault());renderList();message('Template deleted.','success')
}
function preview(){const item=formTemplate(),s=item.settings,preview=$('quotationTemplatePreview');if(!preview)return;preview.style.display='block';preview.style.setProperty('--preview-color',s.primaryColor);preview.style.fontFamily=s.font;preview.innerHTML=`${s.header?`<div class="template-preview-header">${esc(s.header)}</div>`:''}<div class="template-preview-company"><img src="${esc(s.logoData||'keylargo-logo.png')}" alt="Logo"><div><strong>${esc([s.companyName,s.registration].filter(Boolean).join(' '))}</strong><div>${esc(s.address).replace(/\n/g,'<br>')}</div><div>${esc(s.phone)} · ${esc(s.email)}</div></div></div><h3>Quotation</h3><p>${esc(s.intro)}</p><div class="template-preview-line"></div><small>${esc(s.footer)}</small>`}
function optimizeLogo(file){return new Promise((resolve,reject)=>{if(!file)return resolve('');if(!/^image\/(png|jpeg|webp)$/i.test(file.type))return reject(new Error('Use PNG, JPEG or WebP.'));if(file.size>5*1024*1024)return reject(new Error('Logo must be 5 MB or smaller.'));const reader=new FileReader();reader.onerror=()=>reject(new Error('Logo could not be read.'));reader.onload=()=>{const image=new Image();image.onerror=()=>reject(new Error('Logo could not be decoded.'));image.onload=()=>{const scale=Math.min(1,1000/image.width,350/image.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL(file.type==='image/jpeg'?'image/jpeg':'image/png',.9))};image.src=String(reader.result||'')};reader.readAsDataURL(file)})}
function setText(id,value){const node=$(id);if(node)node.textContent=value||''}
function applyToPrint(snapshot,context={}){
 const item=normalizeTemplate(snapshot||selectedSnapshot()||chosenDefault()),s=item.settings,root=$('printQuotationDocument');if(!root)return item;
 root.style.setProperty('--template-primary',s.primaryColor||'#17365d');root.style.setProperty('--template-font',s.font||DEFAULT_SETTINGS.font);root.classList.toggle('template-amount-only',s.priceColumns==='amount-only');root.classList.toggle('template-no-signature',s.showSignature===false);
 setText('pTemplateHeader',s.header);setText('pTemplateCompanyName',[s.companyName,s.registration].filter(Boolean).join(' '));setText('pTemplateAddress',s.address);setText('pTemplatePhone',s.phone?`Tel     : ${s.phone}`:'');setText('pTemplateFax',s.fax?`Fax    : ${s.fax}`:'');const emailNode=$('pTemplateEmail');if(emailNode)emailNode.textContent=s.email?`email : ${s.email}`:'';setText('pTemplateIntro',s.intro);
 const closing=String(s.closing||'').split(/\n+/);setText('pTemplateClosing1',closing[0]||'');setText('pTemplateClosing2',closing.slice(1).join(' ')||'');setText('pTemplateSignatoryCompany',s.companyName);setText('pTemplateBank',s.bank);setText('pTemplateFooter',s.footer);
 document.querySelectorAll('#printQuotationDocument footer>div:first-child').forEach(node=>node.textContent=s.footer||'');
 const custom=String(s.logoData||'');document.querySelectorAll('#printQuotationDocument .print-company img,#printQuotationDocument .print-items-logo').forEach(img=>{if(custom){img.src=custom;img.dataset.templateLogo='custom'}else{img.src='keylargo-logo.png';delete img.dataset.templateLogo}});
 return item;
}
function safeFileName(value){return String(value||'Quotation').replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,120)||'Quotation'}
function pdfName(context={}){const item=selectedSnapshot()||chosenDefault(),pattern=item.settings.pdfName||DEFAULT_SETTINGS.pdfName;const output=pattern.replace(/\{quoteNo\}/gi,context.quoteNo||'Quotation').replace(/\{customer\}/gi,context.customer||'').replace(/\{date\}/gi,context.date||'').replace(/\{template\}/gi,item.template_name||'');return safeFileName(output)}
async function init(nextAccess={}){
 access=nextAccess||access;let loaded=null;try{loaded=await remoteLoad()}catch(error){console.warn(error)}const local=localLoad();const merged=loaded===null?local:[...loaded,...local.filter(item=>!loaded.some(remote=>remote.id===item.id))];templates=merged.map(normalizeTemplate);ensureStandard();localSave();initialized=true;renderSelect();if(window.KeySuiteApp?.isNewQuotation?.())window.KeySuiteApp?.applyQuotationTemplateDefaults?.(selectedSnapshot(),true);
}
function bind(){
 $('qTemplate')?.addEventListener('change',event=>{selectedId=event.target.value;sealedSnapshot=null;localStorage.setItem(selectionKey(),selectedId);updateHeaderLogo();window.KeySuiteApp?.applyQuotationTemplateDefaults?.(selectedSnapshot(),!window.KeySuiteApp?.hasQuotationItems?.())});
 $('quotationTemplateLogoButton')?.addEventListener('click',openManager);$('manageQuotationTemplates')?.addEventListener('click',openManager);$('settingsQuotationTemplates')?.addEventListener('click',()=>{$('settingsDialog')?.close();openManager()});$('closeQuotationTemplates')?.addEventListener('click',()=>$('quotationTemplateDialog')?.close());$('newQuotationTemplate')?.addEventListener('click',newTemplate);$('copyQuotationTemplate')?.addEventListener('click',copyTemplate);$('saveQuotationTemplate')?.addEventListener('click',saveTemplate);$('deleteQuotationTemplate')?.addEventListener('click',deleteTemplate);$('previewQuotationTemplate')?.addEventListener('click',preview);$('removeTemplateLogo')?.addEventListener('click',()=>{pendingLogo='';renderLogo()});$('templateLogoUpload')?.addEventListener('change',async event=>{try{pendingLogo=await optimizeLogo(event.target.files?.[0]);renderLogo();message('Logo ready. Save the template to keep it.','success')}catch(error){message(error.message,'error');event.target.value=''}});
}
document.addEventListener('DOMContentLoaded',()=>{bind();if(!initialized)init(window.KEYSUITE_ACCESS||{})});
window.KeySuiteTemplates={init,openManager,resetSelection,loadSelection,selectForCustomer,companyTemplateOptions,getSelectedId:()=>selectedId,getSelectedSnapshot:selectedSnapshot,applyToPrint,getPdfName:pdfName,getTemplates:()=>templates.map(snapshotOf),refreshHeaderLogo:updateHeaderLogo};
})();
