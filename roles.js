(() => {
  'use strict';

  let access=null,users=[],audit=[],editingEmail='',editingUser=null,bound=false;
  let permissionsEditing=false,permissionMatrix=null,permissionHoldTimer=null,permissionHoldTick=null,permissionHoldStarted=0,selectionScopeError='';
  const el=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const role=()=>String(access?.role||window.KEYSUITE_ACCESS?.role||'viewer').toLowerCase();
  const isOwner=()=>role()==='owner';
  const can=key=>window.KeySuitePermissions?.can?.(key,role())??(isOwner());
  const canManage=()=>can('manage_roles');
  const client=()=>window.KeySuiteAuth?.getClient?.()||null;
  const title=value=>String(value||'').replace(/[_-]+/g,' ').replace(/\b\w/g,ch=>ch.toUpperCase());
  const BASE_ROLES=['viewer','dealer','user','admin','owner'];
  const protectedRole=roleName=>BASE_ROLES.includes(String(roleName||'').toLowerCase());
  const roleNames=()=>{
    const matrix=currentPermissions(),known=Object.keys(matrix||{}).map(value=>String(value||'').toLowerCase()).filter(Boolean),custom=[...new Set(known.filter(value=>!BASE_ROLES.includes(value)))].sort((a,b)=>a.localeCompare(b));
    return [...BASE_ROLES.filter(value=>value!=='owner'),...custom,'owner'];
  };
  const LEVEL_LABELS={none:'No',view:'View',own:'Own',assigned:'Assigned',all:'All',full:'Full'};
  const PERMISSION_ROWS=[
    {key:'key_dashboard',label:'Key button / Key Dashboard',options:['none','full'],className:'permission-key-row'},
    {key:'keyai_access',label:'KeyBot access',options:['none','full']},
    {key:'keyai_openai_control',label:'KeyBot OpenAI ON / OFF',options:['none','full']},
    {key:'keyai_sender_assign',label:'KeyBot Sender / Company assignment',options:['none','full']},
    {key:'manage_roles',label:'Assign roles and account status',options:['none','full']},
    {key:'customer_settings',label:'Customer Settings (Key → Customer)',options:['none','view','full']},
    {key:'company_pricing',label:'Company & Pricing',options:['none','view','full']},
    {key:'manage_categories',label:'Create / edit pricing categories',options:['none','view','full']},
    {key:'manage_price_list',label:'Maintain Price List',options:['none','view','full']},
    {key:'change_fuel_price',label:'Change Fuel Price',options:['none','full']},
    {key:'use_quick_selection',label:'Quick Selection',options:['none','full'],className:'permission-selection-row'},
    {key:'use_selector',label:'Selector',options:['none','full'],className:'permission-selection-row'},
    {key:'use_product',label:'Product',options:['none','full'],className:'permission-selection-row'},
    {key:'choose_brand_series',label:'Change Brand / Series',options:['none','full'],className:'permission-selection-row'},
    {key:'view_customers',label:'View customers',options:['none','own','assigned','all']},
    {key:'edit_customers',label:'Add / edit customers',options:['none','own','assigned','all']},
    {key:'customer_assignment',label:'Customer assignment and distance',options:['none','full']},
    {key:'create_quotations',label:'Create quotations',options:['none','full']},
    {key:'view_quotations',label:'View quotations',options:['none','own','assigned','all']},
    {key:'own_profile',label:'Own profile and password',options:['none','full']}
  ];

  function setMessage(id,text,type='error'){const box=el(id);if(!box)return;box.textContent=text||'';box.className=text?`auth-message show ${type}`:'auth-message'}
  function formatDate(value){if(!value)return '-';try{return new Date(value).toLocaleString('en-MY',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(_){return value}}
  function currentPermissions(){return permissionMatrix||window.KeySuitePermissions?.snapshot?.()||window.KeySuitePermissions?.DEFAULTS||{}}

  function multibrandApi(){return window.KeySuiteV394410||window.KeySuiteV40001||window.KeySuiteV391||null}
  function scopeKeys(raw){let value=raw;if(typeof value==='string'){try{value=JSON.parse(value)}catch(_){value={}}}return Array.isArray(value?.keys)?[...new Set(value.keys.map(String).filter(Boolean))]:[]}
  const normalizeProductGroup=value=>String(value||'').trim().toUpperCase().replace(/\s+/g,'_');
  const hydraulicFamily=value=>{
    const group=normalizeProductGroup(value);
    if(group==='CHC'||group==='CHC_G1'||group==='CHC_G2')return 'CHC';
    if(group==='ES')return 'ES';
    return '';
  };
  const KEYLARGO_ROLE_BRAND=Object.freeze({
    id:'KEYLARGO',
    brand_name:'Keylargo',
    brand_key:'keylargo',
    brand_type:'house',
    active:true,
    virtual:true
  });
  const GWS_ROLE_BRAND=Object.freeze({
    id:'GWS',
    brand_name:'GWS',
    brand_key:'gws',
    brand_type:'house',
    active:true,
    virtual:true
  });
  function selectionBrands(){
    const api=multibrandApi();
    // V4.17.05: Keylargo is a permanent KeySuite house-brand authority.
    // It does NOT depend on a Brand Management database row.
    const databaseBrands=(api?.state?.brands||[])
      .filter(b=>{
        if(!b||b.active===false)return false;
        const key=String(b.brand_key||'').trim().toLowerCase(),name=String(b.brand_name||'').trim().toLowerCase();
        return key!=='keylargo'&&name!=='keylargo'&&key!=='gws'&&name!=='gws';
      })
      .slice();
    return [KEYLARGO_ROLE_BRAND,GWS_ROLE_BRAND,...databaseBrands]
      .sort((a,b)=>{
        const ak=String(a.brand_key||'').toLowerCase(),bk=String(b.brand_key||'').toLowerCase();
        if(ak==='keylargo'&&bk!=='keylargo')return -1;
        if(bk==='keylargo'&&ak!=='keylargo')return 1;
        if(ak==='gws'&&bk!=='gws')return -1;
        if(bk==='gws'&&ak!=='gws')return 1;
        return String(a.brand_name||'').localeCompare(String(b.brand_name||''),undefined,{numeric:true,sensitivity:'base'});
      });
  }
  function selectionEntries(){
    const api=multibrandApi(),brands=selectionBrands(),maps=(api?.state?.mappings||[]).filter(m=>m&&m.active!==false),out=[];
    brands.forEach(brand=>{
      const brandKey=String(brand.brand_key||'').trim().toLowerCase(),brandName=String(brand.brand_name||'').trim().toLowerCase();
      // V4.17.02: Product → Keylargo is role-authorized like any other Brand.
      // These are house-product permissions, not hydraulic Selector families.
      if(brandKey==='keylargo'||brandName==='keylargo'){
        [
          ['BASEPLATE','Baseplate'],
          ['COUPLING','Coupling'],
          ['KEYPLC','KeyPLC Panel'],
          ['MANIFOLD','Manifold']
        ].forEach(([family,series])=>out.push({brand,family,key:`${brand.id}|${family}`,series}));
        return;
      }
      if(brandKey==='gws'||brandName==='gws'){
        out.push({brand,family:'TANK',key:`${brand.id}|TANK`,series:'GWS Tank'});
        return;
      }
      const compactBrand=(brandKey||brandName).replace(/[^a-z0-9]/g,'');
      if(compactBrand==='mos'){
        out.push({brand,family:'MOTOR',key:`${brand.id}|MOTOR`,series:'Motor'});
        return;
      }
      const master=String(brand.brand_type||'').toLowerCase()==='master'||brandKey==='b.g.reich'||brandName==='b.g.reich';
      if(master){
        ['CHC','ES'].forEach(family=>out.push({brand,family,key:`${brand.id}|${family}`,series:String(api?.brandSeriesFor?.(brand,family)||family)}));
        return;
      }
      const seen=new Set();
      maps.filter(m=>String(m.brand_id)===String(brand.id)).forEach(m=>{
        const group=normalizeProductGroup(m.master_family),family=hydraulicFamily(group);
        if(!family||seen.has(family))return;
        seen.add(family);
        out.push({brand,family,productGroup:group,key:`${brand.id}|${family}`,series:String(api?.brandSeriesFor?.(brand,group)||family)});
      });
    });
    return out;
  }
  function roleSelectionLocked(roleName){return permissionValue(roleName,'choose_brand_series')==='none'}
  function roleSelectionEnabled(roleName){return ['use_quick_selection','use_selector','use_product'].some(key=>permissionValue(roleName,key)!=='none')}
  function collectSelectionScope(){
    if(!isOwner())return {keys:scopeKeys(editingUser?.selection_scope)};
    const keys=[];
    document.querySelectorAll('#roleSelectionScopeGrid .role-selection-brand').forEach(group=>{
      const all=group.querySelector('input[data-selection-brand-all]');
      if(all?.checked){keys.push(String(all.dataset.selectionBrandAll||''));return}
      group.querySelectorAll('input[data-selection-scope-key]:checked').forEach(input=>keys.push(String(input.dataset.selectionScopeKey||'')));
    });
    return {keys:[...new Set(keys.filter(Boolean))]};
  }
  function updateSelectionScopeNote(){
    const roleName=String(el('roleUserRole')?.value||'user'),note=el('roleSelectionScopeNote');if(!note)return;
    if(roleSelectionLocked(roleName)&&roleSelectionEnabled(roleName))note.innerHTML='<b>Role Brand Assigned:</b> only the Owner can authorize which active Brands / Series this user can see. Future OEM Brands appear here automatically. Keylargo and GWS house products are authorized here independently. Restricted users only see the Brands / Products assigned by the Owner.';
    else note.textContent=isOwner()?'All active Brands from Brand Management appear here automatically. Keylargo and GWS are permanent KeySuite house-brand authorities and are always available here. Owner may authorize Brand / Series / Keylargo Product visibility; it becomes mandatory when “Change Brand / Series = No”.':'Brand / Series visibility is Owner-authorized and cannot be changed here.';
  }
  function renderSelectionScopeEditor(user=editingUser){
    const grid=el('roleSelectionScopeGrid');if(!grid)return;
    const brands=selectionBrands(),entries=selectionEntries(),selected=new Set(scopeKeys(user?.selection_scope)),ownerCanAssign=isOwner();
    if(selectionScopeError){grid.innerHTML=`<div class="role-note" style="color:#991b1b">Selection authority database is not ready: ${esc(selectionScopeError)}. Run V41706_KEYLARGO_ROLE_SCOPE_PERSISTENCE.sql.</div>`;updateSelectionScopeNote();return}
    if(!brands.length){grid.innerHTML='<div class="role-note">Brand data is still loading. Reopen this user after Brand data is available.</div>';updateSelectionScopeNote();return}
    grid.innerHTML=brands.map(brand=>{
      const brandId=String(brand.id),allKey=`${brandId}|*`,allSelected=selected.has(allKey),mine=entries.filter(entry=>String(entry.brand.id)===brandId);
      const seriesHtml=mine.length
        ?mine.map(entry=>`<label><input type="checkbox" data-selection-scope-key="${esc(entry.key)}" data-selection-brand-id="${esc(brandId)}" ${(allSelected||selected.has(entry.key))?'checked':''} ${(allSelected||!ownerCanAssign)?'disabled':''}> <span>${esc(entry.series||entry.family)}</span></label>`).join('')
        :'<div class="role-note role-selection-no-series">No Series mapped yet. Authorize <b>All Products / Series</b> to keep this Brand available when Series are added later.</div>';
      return `<div class="role-selection-brand" data-selection-brand-group="${esc(brandId)}"><label class="role-selection-brand-all"><input type="checkbox" data-selection-brand-all="${esc(allKey)}" ${allSelected?'checked':''} ${ownerCanAssign?'':'disabled'}> <b>${esc(brand.brand_name||'Brand')}</b><span>All Products / Series</span></label><div class="role-selection-series-list">${seriesHtml}</div></div>`;
    }).join('');
    if(!ownerCanAssign)grid.insertAdjacentHTML('afterbegin','<div class="role-note" style="grid-column:1/-1"><b>Owner assigned:</b> Brand / Series visibility is read-only for non-Owner role managers.</div>');
    grid.querySelectorAll('input[data-selection-brand-all]').forEach(input=>input.addEventListener('change',()=>{
      const group=input.closest('.role-selection-brand');
      group?.querySelectorAll('input[data-selection-scope-key]').forEach(series=>{series.checked=input.checked;series.disabled=input.checked});
    }));
    grid.querySelectorAll('input[data-selection-scope-key]').forEach(input=>input.addEventListener('change',()=>{
      const group=input.closest('.role-selection-brand'),all=group?.querySelector('input[data-selection-brand-all]');
      if(all){const series=[...group.querySelectorAll('input[data-selection-scope-key]')];all.indeterminate=!all.checked&&series.some(item=>item.checked)&&series.some(item=>!item.checked)}
    }));
    updateSelectionScopeNote();
  }

  function renderKeyDashboard(){
    const notice=el('keyDashboardNotice'),button=el('openRoleModule');if(!notice||!button)return;
    if(can('key_dashboard')){
      notice.innerHTML=`Signed in as <b>${esc(access?.display_name||access?.email||'approved user')}</b> · <b>${esc(title(role()))}</b>. Key access confirmed.`;
      notice.classList.add('active-customer');
    }else{
      notice.innerHTML='Your role does not currently have Key Dashboard access.';notice.classList.remove('active-customer');
    }
    button.disabled=!canManage();button.style.opacity=canManage()?'1':'.55';
  }

  function renderUsers(){
    const rows=el('roleRows');if(!rows)return;if(!users.length){rows.innerHTML='<tr><td colspan="7" class="muted">No approved users found.</td></tr>';return}
    rows.innerHTML=users.map(user=>{const userRole=String(user.role||'user').toLowerCase(),prefix=String(user.quotation_prefix||'').toUpperCase();return `<tr><td><b>${esc(user.display_name||'-')}</b></td><td>${esc(user.email)}</td><td>${prefix?`<span class="role-badge">${esc(prefix)}</span>`:'<span class="muted">Not assigned</span>'}</td><td><span class="role-badge ${esc(userRole)}">${esc(title(userRole))}</span></td><td>${user.active?'<span class="badge won">Active</span>':'<span class="badge lost">Inactive</span>'}</td><td>${user.auth_exists?'<span class="auth-state ok" title="Supabase Auth account exists. The user can create or reset a password from the login page.">Account created</span>':'<span class="auth-state missing">Invitation required</span>'}</td><td><div class="role-row-actions"><button class="btn secondary edit-role-user" type="button" data-email="${esc(user.email)}">Edit</button>${!user.auth_exists?`<button class="btn invite-role-user" type="button" data-invite-email="${esc(user.email)}">Invite</button>`:''}</div></td></tr>`}).join('');
    rows.querySelectorAll('.edit-role-user').forEach(button=>button.addEventListener('click',()=>openEdit(button.dataset.email)));
    rows.querySelectorAll('.invite-role-user').forEach(button=>button.addEventListener('click',()=>inviteExisting(button.dataset.inviteEmail,button)));
  }

  function renderAudit(){
    const rows=el('roleAuditRows');if(!rows)return;if(!audit.length){rows.innerHTML='<tr><td colspan="5" class="muted">No role changes recorded yet.</td></tr>';return}
    rows.innerHTML=audit.map(row=>`<tr><td class="role-audit-time">${esc(formatDate(row.changed_at))}</td><td><b>${esc(row.target_display_name||row.target_email)}</b><div class="muted">${esc(row.target_email)}</div></td><td>${row.old_role?`<span class="role-badge ${esc(row.old_role)}">${esc(title(row.old_role))}</span>${row.old_active===false?' · Inactive':''}`:'New user'}</td><td><span class="role-badge ${esc(row.new_role)}">${esc(title(row.new_role))}</span>${row.new_active===false?' · Inactive':''}</td><td>${esc(row.changed_by_email||'-')}</td></tr>`).join('');
  }

  async function loadPermissions(showMessage=false){
    const db=client();if(!db)return currentPermissions();
    try{
      let result=await db.rpc('keysuite_get_role_permissions_v40512');if(result.error)result=await db.rpc('keysuite_get_role_permissions');const {data,error}=result;if(error)throw error;
      permissionMatrix=window.KeySuitePermissions?.setMatrix?.(data||[])||currentPermissions();
      if(showMessage)setMessage('rolePermissionsMessage','Permissions loaded.','info');
      renderKeyDashboard();
      return permissionMatrix;
    }catch(error){
      console.error(error);
      permissionMatrix=currentPermissions();
      if(showMessage)setMessage('rolePermissionsMessage',`Permissions could not be loaded: ${error.message||error}. Run the V1.24 Supabase migration.`,'error');
      return permissionMatrix;
    }
  }

  async function load(){
    renderKeyDashboard();const notice=el('roleAccessNotice');
    if(!canManage()){if(notice)notice.textContent='Your role is not allowed to manage users.';if(typeof showPage==='function')showPage(can('key_dashboard')?'keyDashboard':'dashboard');return}
    const db=client();if(!db)return;if(notice){notice.textContent='Loading approved users…';notice.classList.remove('active-customer')}
    try{
      const [userResult,auditResult,prefixResult,scopeResult]=await Promise.all([db.rpc('keysuite_list_role_users'),db.rpc('keysuite_list_role_audit',{p_limit:30}),isOwner()?db.rpc('keysuite_list_quotation_prefixes_v225'):Promise.resolve({data:[],error:null}),db.rpc('keysuite_list_user_selection_scopes_v41706')]);
      if(userResult.error)throw userResult.error;if(auditResult.error)throw auditResult.error;if(prefixResult.error)throw prefixResult.error;
      selectionScopeError=scopeResult.error?String(scopeResult.error.message||scopeResult.error):'';
      const prefixMap=new Map((prefixResult.data||[]).map(row=>[String(row.email||'').toLowerCase(),String(row.quotation_prefix||'').toUpperCase()]));
      const scopeMap=new Map((scopeResult.error?[]:(scopeResult.data||[])).map(row=>[String(row.email||'').toLowerCase(),row.selection_scope||{keys:[]} ]));
      users=(userResult.data||[]).map(user=>({...user,quotation_prefix:prefixMap.get(String(user.email||'').toLowerCase())||'',selection_scope:scopeMap.get(String(user.email||'').toLowerCase())||{keys:[]}}));audit=auditResult.data||[];
      if(notice){notice.innerHTML=`<b>${users.length}</b> approved user${users.length===1?'':'s'}. New users can receive a secure invitation email to set their own password.`;notice.classList.add('active-customer')}
      renderUsers();renderAudit();
    }catch(error){console.error(error);if(notice)notice.textContent=`Role data could not be loaded: ${error.message||error}.`;users=[];audit=[];renderUsers();renderAudit()}
  }

  function permissionValue(roleName,key){return String(currentPermissions()?.[roleName]?.[key]||window.KeySuitePermissions?.DEFAULTS?.[roleName]?.[key]||'none').toLowerCase()}
  function permissionCell(row,roleName){
    const fixed=roleName==='owner'&&['key_dashboard','keyai_access','keyai_openai_control','keyai_sender_assign','manage_roles','customer_settings','use_quick_selection','use_selector','use_product','choose_brand_series','own_profile'].includes(row.key);
    const value=fixed?'full':permissionValue(roleName,row.key);
    if(permissionsEditing&&!fixed){
      const options=row.options.map(option=>`<option value="${option}"${value===option?' selected':''}>${LEVEL_LABELS[option]||title(option)}</option>`).join('');
      return `<td><select data-permission-role="${roleName}" data-permission-key="${row.key}">${options}</select></td>`;
    }
    if(permissionsEditing&&fixed)return `<td><span class="permission-fixed">Fixed Full</span></td>`;
    return `<td><span class="permission-value ${esc(value)}">${esc(LEVEL_LABELS[value]||title(value))}</span></td>`;
  }
  function renderPermissions(){
    const body=el('rolePermissionsRows');if(!body)return;const roles=roleNames(),head=el('rolePermissionsHead');
    if(head)head.innerHTML=`<tr><th>Function</th>${roles.map(roleName=>`<th>${esc(title(roleName))}</th>`).join('')}</tr>`;
    body.innerHTML=PERMISSION_ROWS.map(row=>`<tr class="${row.className||''}"><td><b>${esc(row.label)}</b></td>${roles.map(r=>permissionCell(row,r)).join('')}</tr>`).join('');
    body.closest('table')?.classList.toggle('editing',permissionsEditing);
    el('saveRolePermissions').style.display=permissionsEditing?'inline-flex':'none';
    el('cancelRolePermissions').style.display=permissionsEditing?'inline-flex':'none';
    el('closeRolePermissionsBottom').style.display=permissionsEditing?'none':'inline-flex';
    el('editRolePermissions').style.display=isOwner()&&!permissionsEditing?'inline-flex':'none';
    const copy=el('newRoleCopyFrom');if(copy){const selected=copy.value||'user';copy.innerHTML=roles.filter(roleName=>roleName!=='owner').map(roleName=>`<option value="${esc(roleName)}">${esc(title(roleName))}</option>`).join('');copy.value=roles.includes(selected)?selected:'user'}
    const toolbar=el('roleCustomToolbar');if(toolbar)toolbar.style.display=isOwner()&&!permissionsEditing?'grid':'none';
  }

  function stopPermissionHold(reset=true){
    if(permissionHoldTimer)clearTimeout(permissionHoldTimer);if(permissionHoldTick)clearInterval(permissionHoldTick);
    permissionHoldTimer=permissionHoldTick=null;
    const button=el('editRolePermissions');if(button){button.classList.remove('counting');if(reset&&!permissionsEditing)button.textContent='Hold 5s to Edit'}
  }
  function startPermissionHold(event){
    if(!isOwner()||permissionsEditing)return;if(event.pointerType==='mouse'&&event.button!==0)return;
    event.preventDefault();stopPermissionHold(false);permissionHoldStarted=Date.now();const button=el('editRolePermissions');button.classList.add('counting');
    const update=()=>{const left=Math.max(1,5-Math.floor((Date.now()-permissionHoldStarted)/1000));button.textContent=`Edit in ${left}…`};update();permissionHoldTick=setInterval(update,150);
    permissionHoldTimer=setTimeout(()=>{stopPermissionHold(false);permissionsEditing=true;button.textContent='Editing';setMessage('rolePermissionsMessage','Permission editor unlocked. Change the authority levels, then Save Permissions.','info');renderPermissions()},5000);
  }

  function collectPermissionMatrix(){
    const matrix=structuredClone(currentPermissions());
    document.querySelectorAll('[data-permission-role][data-permission-key]').forEach(select=>{
      const r=select.dataset.permissionRole,k=select.dataset.permissionKey;matrix[r]=matrix[r]||{};matrix[r][k]=select.value;
    });
    matrix.owner={...(matrix.owner||{}),key_dashboard:'full',keyai_access:'full',keyai_openai_control:'full',keyai_sender_assign:'full',manage_roles:'full',customer_settings:'full',use_quick_selection:'full',use_selector:'full',use_product:'full',choose_brand_series:'full',own_profile:'full'};
    return matrix;
  }
  async function savePermissions(){
    if(!isOwner())return;const db=client();if(!db)return;
    const matrix=collectPermissionMatrix();
    const lockedRoles=roleNames().filter(r=>r!=='owner'&&String(matrix?.[r]?.choose_brand_series||'full')==='none'&&['use_quick_selection','use_selector','use_product'].some(k=>String(matrix?.[r]?.[k]||'none')!=='none'));
    if(lockedRoles.length&&selectionScopeError){setMessage('rolePermissionsMessage',`Selection authority database is not ready: ${selectionScopeError}. Run V41706_KEYLARGO_ROLE_SCOPE_PERSISTENCE.sql before assigning Brand / Series.`,'error');return}
    const missing=users.filter(u=>u.active!==false&&lockedRoles.includes(String(u.role||'').toLowerCase())&&!scopeKeys(u.selection_scope).length);
    if(missing.length){setMessage('rolePermissionsMessage',`Assign a Fixed Selection Brand / Series to ${missing.map(u=>u.display_name||u.email).join(', ')} before setting their role to Change Brand / Series = No.`,'error');return}
    const button=el('saveRolePermissions');button.disabled=true;button.textContent='Saving…';setMessage('rolePermissionsMessage','');
    try{
      let result=await db.rpc('keysuite_save_role_permissions_v40512',{p_matrix:matrix});if(result.error)result=await db.rpc('keysuite_save_role_permissions',{p_matrix:matrix});const {data,error}=result;if(error)throw error;
      permissionMatrix=window.KeySuitePermissions?.setMatrix?.(data||matrix)||matrix;permissionsEditing=false;renderPermissions();renderKeyDashboard();
      window.KeySuiteApp?.applyPermissions?.();window.KeySuiteCategories?.render?.();window.KeySuitePriceList?.render?.();window.KeySuitePricing?.render?.();
      setMessage('rolePermissionsMessage','Role permissions saved. Users receive the new authority after refresh or their next sign-in.','info');
    }catch(error){console.error(error);setMessage('rolePermissionsMessage',`${error.message||error}. Run V40512_SUPABASE_MIGRATION.sql first.`,'error')}
    finally{button.disabled=false;button.textContent='Save Permissions'}
  }
  function cancelPermissions(){permissionsEditing=false;setMessage('rolePermissionsMessage','Changes cancelled.','info');renderPermissions()}

  function setRoleOptions(selected='user'){const select=el('roleUserRole');if(!select)return;const roles=roleNames(),wanted=String(selected||'user').toLowerCase();select.innerHTML=roles.map(roleName=>`<option value="${esc(roleName)}">${esc(title(roleName))}</option>`).join('');select.value=roles.includes(wanted)?wanted:'user';select.disabled=false}
  async function addCustomRole(){
    if(!isOwner())return;const name=String(el('newRoleName')?.value||'').trim(),copyFrom=String(el('newRoleCopyFrom')?.value||'user').toLowerCase();if(!name){setMessage('rolePermissionsMessage','Enter a role name.');return}
    const button=el('addCustomRole'),original=button?.textContent||'+ Add Role';if(button){button.disabled=true;button.textContent='Adding…'}setMessage('rolePermissionsMessage','');
    try{
      const db=client();if(!db)throw new Error('Supabase is not connected.');const {data,error}=await db.rpc('keysuite_add_role_v40512',{p_role_name:name,p_copy_from:copyFrom});if(error)throw error;
      await loadPermissions();if(el('newRoleName'))el('newRoleName').value='';renderPermissions();setRoleOptions('user');setMessage('rolePermissionsMessage',`${title(data?.role||name)} role added. Set its permissions, then assign it to users.`,'info');
    }catch(error){console.error(error);setMessage('rolePermissionsMessage',`${error.message||error}. Run V40512_SUPABASE_MIGRATION.sql first.`,'error')}
    finally{if(button){button.disabled=false;button.textContent=original}}
  }
  function setInviteRow(show,checked=true){const row=el('roleInviteRow');if(row)row.style.display=show?'block':'none';const input=el('roleSendInvite');if(input)input.checked=checked}
  function openAdd(){if(!canManage())return;editingEmail='';editingUser={selection_scope:{keys:[]}};setMessage('roleDialogMessage','');el('roleDialogTitle').textContent='Add User';el('roleUserEmail').readOnly=false;el('roleUserEmail').value='';el('roleUserDisplayName').value='';if(el('roleUserQuotationPrefix')){el('roleUserQuotationPrefix').value='';el('roleUserQuotationPrefix').disabled=!isOwner()}setRoleOptions('user');el('roleUserActive').value='true';setInviteRow(true,true);renderSelectionScopeEditor(editingUser);el('roleUserDialog').showModal()}
  function openEdit(email){const user=users.find(item=>String(item.email).toLowerCase()===String(email).toLowerCase());if(!user)return;editingEmail=user.email;editingUser=user;setMessage('roleDialogMessage','');el('roleDialogTitle').textContent='Edit User Role';el('roleUserEmail').value=user.email;el('roleUserEmail').readOnly=true;el('roleUserDisplayName').value=user.display_name||'';if(el('roleUserQuotationPrefix')){el('roleUserQuotationPrefix').value=user.quotation_prefix||'';el('roleUserQuotationPrefix').disabled=!isOwner()}setRoleOptions(user.role);el('roleUserActive').value=user.active?'true':'false';setInviteRow(!user.auth_exists,!user.auth_exists);renderSelectionScopeEditor(user);el('roleUserDialog').showModal()}
  function closeDialog(){el('roleUserDialog')?.close()}
  async function openPermissions(){if(!canManage())return;permissionsEditing=false;setMessage('rolePermissionsMessage','');await loadPermissions();renderPermissions();el('rolePermissionsDialog')?.showModal()}
  function closePermissions(){stopPermissionHold();permissionsEditing=false;el('rolePermissionsDialog')?.close()}

  async function sendInvitation(user){
    const db=client();if(!db)throw new Error('Supabase is not connected.');
    const redirectTo=window.KeySuiteAuth?.getAuthRedirectUrl?.('invite')||'https://iraychan.github.io/KeySuite/?keysuite_auth=invite';
    const {data,error}=await db.functions.invoke('keysuite-invite-user',{body:{email:user.email,display_name:user.display_name,role:user.role,redirect_to:redirectTo}});
    if(error)throw new Error(`${error.message||error}. Deploy the included Supabase Edge Function “keysuite-invite-user”.`);if(data?.error)throw new Error(data.error);return data||{};
  }
  async function inviteExisting(email,button){const user=users.find(item=>String(item.email).toLowerCase()===String(email).toLowerCase());if(!user)return;const original=button.textContent;button.disabled=true;button.textContent='Sending…';try{const result=await sendInvitation(user);if(result?.status==='already_exists')alert(`A login account already exists for ${user.email}. The user can use Forgot Password on the KeySuite login page to create/reset the password.`);else alert(`Invitation sent to ${user.email}. The user can create their own password from the email link.`);await load()}catch(error){console.error(error);alert(`Invitation could not be sent: ${error.message||error}`)}finally{button.disabled=false;button.textContent=original}}

  async function save(event){
    event.preventDefault();if(!canManage())return;
    const email=el('roleUserEmail').value.trim().toLowerCase(),displayName=el('roleUserDisplayName').value.trim(),nextRole=el('roleUserRole').value,active=el('roleUserActive').value==='true',sendInvite=!!el('roleSendInvite')?.checked;
    const quotationPrefix=isOwner()?String(el('roleUserQuotationPrefix')?.value||'').trim().toUpperCase():String(editingUser?.quotation_prefix||'').trim().toUpperCase();
    if(!/^\S+@\S+\.\S+$/.test(email)){setMessage('roleDialogMessage','Enter a valid email address.');return}if(!displayName){setMessage('roleDialogMessage','Display Name is required.');return}
    if(isOwner()&&quotationPrefix&&!/^[A-Z0-9]{1,8}$/.test(quotationPrefix)){setMessage('roleDialogMessage','Quotation Prefix must contain 1 to 8 letters or numbers only.');return}
    const selectionScope=collectSelectionScope();if(roleSelectionLocked(nextRole)&&roleSelectionEnabled(nextRole)&&!selectionScope.keys.length){setMessage('roleDialogMessage',isOwner()?'Assign at least one Brand / Series visibility scope for this restricted role.':'Only the Owner can assign Brand / Series visibility for this restricted role.');return}
    const button=el('saveRoleUser');button.disabled=true;button.textContent='Saving…';setMessage('roleDialogMessage','');
    try{
      const custom=!protectedRole(nextRole);const result=await client().rpc('keysuite_manage_user_role',{p_email:email,p_display_name:displayName,p_role:custom?'user':nextRole,p_active:active});if(result.error)throw result.error;
      if(custom){button.textContent='Assigning custom role…';const assigned=await client().rpc('keysuite_assign_custom_role_v40512',{p_email:email,p_role:nextRole});if(assigned.error)throw new Error(`${assigned.error.message||assigned.error}. Run V40512_SUPABASE_MIGRATION.sql first.`)}
      if(isOwner()){button.textContent='Saving prefix…';const prefixResult=await client().rpc('keysuite_assign_quotation_prefix_v225',{p_email:email,p_prefix:quotationPrefix});if(prefixResult.error)throw prefixResult.error;}
      if(isOwner()){button.textContent='Saving Brand / Series visibility…';const scopeResult=await client().rpc('keysuite_set_user_selection_scope_v41706',{p_email:email,p_scope:selectionScope});if(scopeResult.error)throw new Error(`${scopeResult.error.message||scopeResult.error}. Run V41706_KEYLARGO_ROLE_SCOPE_PERSISTENCE.sql.`);}
      let invitationText='';if(sendInvite&&!editingUser?.auth_exists){button.textContent='Sending invite…';try{const result=await sendInvitation({email,display_name:displayName,role:nextRole});invitationText=result?.status==='already_exists'?' Login account already exists.':' Invitation email sent; the user will set their own password.'}catch(inviteError){invitationText=` Access was saved, but the invitation failed: ${inviteError.message||inviteError}`}}
      setMessage('roleDialogMessage',`${editingEmail?'User access updated.':'User access added.'}${isOwner()?` Prefix ${quotationPrefix||'cleared'}.`:''}${invitationText}`,'info');await load();if(!invitationText.includes('failed'))setTimeout(closeDialog,1100);
    }catch(error){console.error(error);setMessage('roleDialogMessage',error.message||'The user role could not be saved.')}finally{button.disabled=false;button.textContent='Save User'}
  }

  function bind(){
    if(bound)return;bound=true;
    el('openRoleModule')?.addEventListener('click',()=>{if(!canManage()){alert('Your role is not allowed to open Role management.');return}if(typeof showPage==='function')showPage('roleManagement')});
    el('viewRolePermissions')?.addEventListener('click',openPermissions);el('closeRolePermissions')?.addEventListener('click',closePermissions);el('closeRolePermissionsBottom')?.addEventListener('click',closePermissions);
    el('editRolePermissions')?.addEventListener('pointerdown',startPermissionHold);['pointerup','pointerleave','pointercancel'].forEach(name=>el('editRolePermissions')?.addEventListener(name,()=>stopPermissionHold()));el('editRolePermissions')?.addEventListener('contextmenu',e=>e.preventDefault());
    el('saveRolePermissions')?.addEventListener('click',savePermissions);el('cancelRolePermissions')?.addEventListener('click',cancelPermissions);el('addCustomRole')?.addEventListener('click',addCustomRole);
    el('roleUserQuotationPrefix')?.addEventListener('input',event=>{event.target.value=String(event.target.value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8)});
    el('roleUserRole')?.addEventListener('change',updateSelectionScopeNote);
    el('addRoleUser')?.addEventListener('click',openAdd);el('reloadRoles')?.addEventListener('click',load);el('roleUserForm')?.addEventListener('submit',save);el('closeRoleDialog')?.addEventListener('click',closeDialog);el('cancelRoleDialog')?.addEventListener('click',closeDialog);
  }
  function init(userAccess){access=userAccess||access;bind();renderKeyDashboard()}
  function pageShown(id){if(id==='keyDashboard')renderKeyDashboard();if(id==='roleManagement')load()}
  window.addEventListener('keysuite-permissions-changed',()=>{renderKeyDashboard();updateSelectionScopeNote()});
  window.addEventListener('KEYSUITE_BRANDS_READY',()=>{if(el('roleUserDialog')?.open)renderSelectionScopeEditor(editingUser)});
  window.KeySuiteRoles={init,pageShown,load,loadPermissions};
})();
