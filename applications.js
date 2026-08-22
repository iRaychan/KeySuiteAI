(() => {
'use strict';
const values=["Air Cond Pump", "Booster Pump", "Chilled Water Pump", "Circulation Pump", "Condenser Water Pump", "Cooling Tower Pump", "Dewatering Pump", "Fire Fighting Jockey Pump", "Fire Fighting Pump", "Flush Valve Booster Pump", "Hose Reel Pump", "Hot Water Pump", "Hydrant Jockey Pump", "Hydrant Pump", "Makeup Tank Pump", "Rain Water Harvesting Pump", "Sea Water Pump", "Sewage Pump", "Sprinkler Jockey Pump", "Sprinkler Pump", "Sprinkler Transfer Pump", "Submersible Pump", "Suction Pump", "Sump Pump", "Swimming Pool Pump", "Temporary Pump", "Transfer Pump", "Waste Water Pump", "Wet Riser Jockey Pump", "Wet Riser Pump", "Wet Riser Temporary Pump", "Wet Riser Transfer Pump", "Ejector Pump"];
function unique(items=[]){const seen=new Set();return items.filter(value=>{const key=String(value||'').trim().toLowerCase();if(!key||seen.has(key))return false;seen.add(key);return true})}
function fillDatalist(id,extra=[]){const list=document.getElementById(id);if(!list)return;list.innerHTML=unique([...extra,...values]).map(value=>`<option value="${String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}"></option>`).join('')}
window.KeySuiteApplications={values:unique(values),fillDatalist,unique};
document.addEventListener('DOMContentLoaded',()=>fillDatalist('quotationModelItemOptions'));
})();
