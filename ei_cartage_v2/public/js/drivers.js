/**
 * drivers.js
 * Driver roster management, manager roster, truck type rates,
 * drop location settings, and manager PIN/employee# management.
 */

function _escAttr(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── DRIVER ROSTER ─────────────────────────────────────────────────────────────
function getDriverRoster(){
  try{
    var s=cacheGet('ei_driver_roster'); // reads from Supabase cache first, falls back to localStorage
    if(s)return JSON.parse(s);
  }catch(e){}
  return Object.entries(UNIT_MAP).map(function(e){var n=e[0],u=e[1];return{name:n,unit:u,rate:u.toUpperCase().startsWith('ST')?TRUCK_RATES.ST:TRUCK_RATES.TT};});
}
function saveDriverRoster(roster){
  var sorted=sortRoster(roster);
  saveToStore('ei_driver_roster',JSON.stringify(sorted)); // saves to Supabase + localStorage
  rebuildUnitMap(sorted);
}
function sortRoster(roster){
  return roster.slice().sort(function(a,b){
    var aT=a.unit.toUpperCase().startsWith('ST')?1:0,bT=b.unit.toUpperCase().startsWith('ST')?1:0;
    if(aT!==bT)return aT-bT;
    return(parseInt(a.unit.replace(/[^0-9]/g,''))||0)-(parseInt(b.unit.replace(/[^0-9]/g,''))||0);
  });
}
function rebuildUnitMap(roster){
  var sel=document.getElementById('loginName');if(!sel)return;
  var cur=sel.value;
  sel.innerHTML='<option value="">Select your name...</option>';
  roster.forEach(function(d){if(!d.name)return;var o=document.createElement('option');o.value=o.textContent=d.name;if(d.name===cur)o.selected=true;sel.appendChild(o);});
}
function saveManifests(){saveToStore('ei_manifests',JSON.stringify(manifests));}

// ── DROP LOCATIONS ────────────────────────────────────────────────────────────
function getDropLocations(){try{var s=cacheGet('ei_drop_locations');if(s)return JSON.parse(s);}catch(e){}return{loc1:'849',loc2:'2000'};}
function saveDropLocations(){
  var l1=document.getElementById('dropLoc1')?.value.trim(),l2=document.getElementById('dropLoc2')?.value.trim();
  if(!l1||!l2){showToast('Both locations required');return;}
  saveToStore('ei_drop_locations',JSON.stringify({loc1:l1,loc2:l2}));
  var msg=document.getElementById('dropLocMsg');if(msg){msg.textContent='\u2713 Saved';setTimeout(function(){msg.textContent='';},3000);}
  showToast('\u2713 Drop locations updated');
}
function buildDropLocationSelect(selectId){
  var locs=getDropLocations(),sel=document.getElementById(selectId);if(!sel)return;
  var cur=sel.value;
  sel.innerHTML='<option value="">Select...</option><option value="'+locs.loc1+'">'+locs.loc1+'</option><option value="'+locs.loc2+'">'+locs.loc2+'</option><option value="__other__">Other (type in)&hellip;</option>';
  if(cur&&(cur===locs.loc1||cur===locs.loc2||cur==='__other__'))sel.value=cur;
}

// Shared write-in support for every drop-location select (per-stop and the
// batch Arrived-at-Expeditors popup). Pairs a <select id="X"> with a hidden
// <input id="X_other"> that's revealed when "Other" is chosen.
function _toggleOtherLoc(selectId){
  var sel=document.getElementById(selectId);
  var other=document.getElementById(selectId+'_other');
  if(!sel||!other)return;
  if(sel.value==='__other__'){
    other.style.display='block';
    setTimeout(function(){other.focus();},50);
  }else{
    other.style.display='none';
  }
}
function _resolveDropLocation(selectId){
  var sel=document.getElementById(selectId);
  if(!sel)return'';
  if(sel.value==='__other__'){
    var other=document.getElementById(selectId+'_other');
    return other?other.value.trim():'';
  }
  return sel.value||'';
}
function _setDropLocationValue(selectId,value){
  var sel=document.getElementById(selectId);
  var other=document.getElementById(selectId+'_other');
  if(!sel)return;
  if(!value){sel.value='';if(other){other.style.display='none';other.value='';}return;}
  var locs=getDropLocations();
  if(value===locs.loc1||value===locs.loc2){
    sel.value=value;
    if(other){other.style.display='none';other.value='';}
  }else{
    sel.value='__other__';
    if(other){other.style.display='block';other.value=value;}
  }
}

// ── DRIVER MANAGEMENT ─────────────────────────────────────────────────────────
function showDriverMgr(){
  var rates=JSON.parse(cacheGet('ei_truck_rates')||'{"TT":92,"ST":87}');
  var ttEl=document.getElementById('rateTT'),stEl=document.getElementById('rateST');
  if(ttEl)ttEl.value=rates.TT;if(stEl)stEl.value=rates.ST;
  var locs=getDropLocations();
  var l1=document.getElementById('dropLoc1'),l2=document.getElementById('dropLoc2');
  if(l1)l1.value=locs.loc1;if(l2)l2.value=locs.loc2;
  // Load customer code
  var custCode=(cacheGet('ei_customer_code')||'EXP2025');
  var custEl=document.getElementById('custCodeInput');
  if(custEl)custEl.value=custCode;
  // Load manager PIN
  var pin=cacheGet('ei_manager_emp')||'1234';
  var pinEl=document.getElementById('mgrPinInput');
  if(pinEl)pinEl.value=pin;
  renderDriverList();ss('driverMgr');
}
function renderDriverList(){
  var roster=getDriverRoster(),el=document.getElementById('driverList');
  if(!el)return;
  if(!roster.length){el.innerHTML='<div style="text-align:center;padding:24px;color:var(--muted)">No drivers yet.</div>';return;}
  var sorted=sortRoster(roster);
  el.innerHTML='<div style="display:flex;align-items:center;gap:10px;padding:6px 0 8px;border-bottom:2px solid var(--border2)"><div style="width:60px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted)">Unit</div><div style="width:80px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted)">Driver #</div><div style="flex:1;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted)">Name</div><div style="width:65px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);text-align:right">Rate</div><div style="width:60px"></div></div>'+
  sorted.map(function(d){
    var origIdx=roster.indexOf(d);
    return '<div class="dl-row" id="dlrow_'+origIdx+'" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><div style="width:60px;font-family:Barlow Condensed,sans-serif;font-size:16px;font-weight:700;color:var(--accent)">'+d.unit+'</div><div style="width:80px;font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:600;color:var(--text2)">'+(d.driverNum?'#'+d.driverNum:'&mdash;')+'</div><div style="flex:1;font-size:14px;font-weight:500">'+d.name+'</div><div style="width:65px;font-family:Barlow Condensed,sans-serif;font-size:14px;color:var(--text2);text-align:right">$'+d.rate+'/hr</div><button onclick="editDriver('+origIdx+')" style="height:34px;padding:0 14px;border-radius:5px;border:1.5px solid var(--accent);background:var(--accent-light);color:var(--accent);font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;cursor:pointer;touch-action:manipulation">Edit</button></div>';
  }).join('');
}
function editDriver(i){
  var roster=getDriverRoster(),d=roster[i],row=document.getElementById('dlrow_'+i);if(!row)return;
  row.innerHTML='<div style="display:grid;grid-template-columns:70px 80px 1fr 80px auto auto auto;gap:8px;align-items:center;width:100%;padding:6px 0"><input type="text" id="edit_unit_'+i+'" value="'+_escAttr(d.unit||'')+'" placeholder="TT 1" style="height:40px;padding:0 8px;border:1.5px solid var(--accent);border-radius:5px;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;color:var(--accent);width:100%"><input type="text" id="edit_dnum_'+i+'" value="'+_escAttr(d.driverNum||'')+'" placeholder="e.g. 751" inputmode="tel" style="height:40px;padding:0 8px;border:1.5px solid var(--accent);border-radius:5px;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:600;width:100%"><input type="text" id="edit_name_'+i+'" value="'+_escAttr(d.name||'')+'" placeholder="Driver name" style="height:40px;padding:0 10px;border:1.5px solid var(--accent);border-radius:5px;font-size:14px;font-family:Barlow,sans-serif;width:100%"><input type="number" id="edit_rate_'+i+'" value="'+_escAttr(d.rate||92)+'" placeholder="92" style="height:40px;padding:0 8px;border:1.5px solid var(--accent);border-radius:5px;font-size:14px;font-family:Barlow Condensed,sans-serif;font-weight:600;width:100%"><button onclick="saveDriverEdit('+i+')" style="height:40px;padding:0 14px;border-radius:5px;border:none;background:var(--success);color:white;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;cursor:pointer;white-space:nowrap;touch-action:manipulation">Save</button><button onclick="renderDriverList()" style="height:40px;padding:0 10px;border-radius:5px;border:1.5px solid var(--border2);background:var(--surface2);color:var(--text2);font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;cursor:pointer;touch-action:manipulation">Cancel</button><button onclick="removeDriverRow('+i+')" style="height:40px;padding:0 10px;border-radius:5px;border:1.5px solid var(--danger);background:var(--danger-light);color:var(--danger);font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;cursor:pointer;touch-action:manipulation">&#128465;</button></div>';
  setTimeout(function(){document.getElementById('edit_name_'+i)?.focus();},50);
}
function saveDriverEdit(i){
  var unit=document.getElementById('edit_unit_'+i)?.value.trim(),driverNum=document.getElementById('edit_dnum_'+i)?.value.trim(),name=document.getElementById('edit_name_'+i)?.value.trim(),rate=parseFloat(document.getElementById('edit_rate_'+i)?.value)||92;
  if(!name){showToast('Driver name required');return;}if(!unit){showToast('Unit required');return;}
  var roster=getDriverRoster();roster[i]={unit:unit,driverNum:driverNum,name:name,rate:rate};saveDriverRoster(roster);renderDriverList();showToast('\u2713 Driver updated');
}
function removeDriverRow(i){
  var roster=getDriverRoster();if(!confirm('Remove '+roster[i].name+'?'))return;roster.splice(i,1);saveDriverRoster(roster);renderDriverList();showToast('Driver removed');
}
function cancelAddDriver(){var f=document.getElementById('addDriverForm');if(f)f.remove();}
function addDriverRow(){
  var container=document.getElementById('addDriverForm');
  if(container){container.style.display=container.style.display==='none'?'block':'none';return;}
  var list=document.getElementById('driverList'),form=document.createElement('div');
  form.id='addDriverForm';form.style.cssText='background:var(--accent-light);border:1.5px solid var(--accent);border-radius:8px;padding:14px;margin-bottom:14px;';
  form.innerHTML='<div style="font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">New Driver</div><div style="display:grid;grid-template-columns:70px 80px 1fr 80px;gap:8px;margin-bottom:10px"><div><label style="display:block;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px">Unit</label><input type="text" id="new_unit" placeholder="TT 12" style="width:100%;height:40px;padding:0 8px;border:1.5px solid var(--border);border-radius:5px;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;color:var(--accent)"></div><div><label style="display:block;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px">Driver #</label><input type="text" id="new_dnum" placeholder="e.g. 751" inputmode="tel" style="width:100%;height:40px;padding:0 8px;border:1.5px solid var(--border);border-radius:5px;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:600"></div><div><label style="display:block;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px">Driver Name</label><input type="text" id="new_name" placeholder="First Last" autocapitalize="words" oninput="capWords(this)" style="width:100%;height:40px;padding:0 10px;border:1.5px solid var(--border);border-radius:5px;font-size:14px;font-family:Barlow,sans-serif"></div><div><label style="display:block;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px">Rate ($/hr)</label><input type="number" id="new_rate" value="92" inputmode="decimal" style="width:100%;height:40px;padding:0 8px;border:1.5px solid var(--border);border-radius:5px;font-size:14px;font-family:Barlow Condensed,sans-serif;font-weight:600"></div></div><div style="display:flex;gap:8px"><button onclick="confirmAddDriver()" style="flex:1;height:40px;border-radius:5px;border:none;background:var(--accent);color:white;font-family:Barlow Condensed,sans-serif;font-size:16px;font-weight:700;cursor:pointer;touch-action:manipulation">Add Driver</button><button onclick="cancelAddDriver()" style="height:40px;padding:0 16px;border-radius:5px;border:1.5px solid var(--border2);background:white;color:var(--text2);font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;cursor:pointer;touch-action:manipulation">Cancel</button></div>';
  list.parentNode.insertBefore(form,list);setTimeout(function(){document.getElementById('new_name').focus();},50);
}
function confirmAddDriver(){
  var unit=document.getElementById('new_unit')?.value.trim(),driverNum=document.getElementById('new_dnum')?.value.trim(),name=document.getElementById('new_name')?.value.trim(),rate=parseFloat(document.getElementById('new_rate')?.value)||92;
  if(!name){showToast('Driver name required');return;}if(!unit){showToast('Unit required (e.g. TT 12)');return;}
  var roster=getDriverRoster();roster.push({unit:unit,driverNum:driverNum,name:name,rate:rate});saveDriverRoster(roster);
  var form=document.getElementById('addDriverForm');if(form)form.remove();renderDriverList();showToast('\u2713 '+name+' added');
}
function saveDrivers(){rebuildUnitMap(getDriverRoster());showToast('\u2713 Roster saved');setTimeout(function(){ss('manager');},600);}
function saveTruckRates(){
  var tt=parseFloat(document.getElementById('rateTT')?.value)||92,st=parseFloat(document.getElementById('rateST')?.value)||87;
  var rates={TT:tt,ST:st};saveToStore('ei_truck_rates',JSON.stringify(rates));
  TRUCK_RATES.TT=tt;TRUCK_RATES.ST=st;
  var msg=document.getElementById('rateMsg');if(msg){msg.textContent='\u2713 Updated';setTimeout(function(){msg.textContent='';},3000);}
  showToast('\u2713 Rates updated');
}
function changeMgrPin(){
  var cur=document.getElementById('mgrPinCurrent')?.value.trim(),nw=document.getElementById('mgrPinNew')?.value.trim();
  var stored=cacheGet('ei_manager_emp')||'1234',msg=document.getElementById('mgrPinMsg');
  if(!cur||!nw){if(msg){msg.style.color='var(--danger)';msg.textContent='Fill in both fields';}return;}
  if(cur!==stored){if(msg){msg.style.color='var(--danger)';msg.textContent='Current # incorrect';}return;}
  saveToStore('ei_manager_emp',nw);
  if(msg){msg.style.color='var(--success)';msg.textContent='\u2713 Updated';document.getElementById('mgrPinCurrent').value='';document.getElementById('mgrPinNew').value='';}
}

// ── MANAGER ACCESS ROSTER ─────────────────────────────────────────────────────
function getManagerRoster(){try{var s=cacheGet('ei_manager_roster');if(s)return JSON.parse(s);}catch(e){}return[];}
function saveManagerRoster(r){saveToStore('ei_manager_roster',JSON.stringify(r));}
function showManagerAccess(){renderManagerList();ss('managerAccess');}
function renderManagerList(){
  var roster=getManagerRoster(),el=document.getElementById('managerList');if(!el)return;
  if(!roster.length){el.innerHTML='<div style="text-align:center;padding:24px;color:var(--muted)">No managers yet. Click + Add to get started.</div>';return;}
  el.innerHTML='<div style="display:flex;align-items:center;gap:10px;padding:6px 0 8px;border-bottom:2px solid var(--border2)"><div style="flex:1;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted)">Manager Name</div><div style="width:130px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted)">Badge #</div><div style="width:60px"></div></div>'+
  roster.map(function(m,i){
    return '<div class="dl-row" id="mgrow_'+i+'" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><div style="flex:1;font-size:14px;font-weight:500">'+(m.name||'<span style="color:var(--muted);font-style:italic">Unnamed</span>')+'</div><div style="width:130px;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;color:var(--text2)">'+(m.badge?'#'+m.badge:'<span style="color:var(--muted)">&mdash;</span>')+'</div><button onclick="editManager('+i+')" style="height:34px;padding:0 14px;border-radius:5px;border:1.5px solid var(--accent);background:var(--accent-light);color:var(--accent);font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;cursor:pointer;touch-action:manipulation">Edit</button></div>';
  }).join('');
}
function editManager(i){
  var roster=getManagerRoster(),m=roster[i],row=document.getElementById('mgrow_'+i);if(!row)return;
  row.innerHTML='<div style="display:grid;grid-template-columns:1fr 130px auto auto auto;gap:8px;align-items:center;width:100%;padding:6px 0"><input type="text" id="emgr_name_'+i+'" value="'+_escAttr(m.name||'')+'" placeholder="Manager name" style="height:40px;padding:0 10px;border:1.5px solid var(--accent);border-radius:5px;font-size:14px;font-family:Barlow,sans-serif;width:100%"><input type="text" id="emgr_badge_'+i+'" value="'+_escAttr(m.badge||'')+'" placeholder="Badge #" inputmode="tel" style="height:40px;padding:0 10px;border:1.5px solid var(--accent);border-radius:5px;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;width:100%"><button onclick="saveManagerEdit('+i+')" style="height:40px;padding:0 14px;border-radius:5px;border:none;background:var(--success);color:white;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;cursor:pointer;touch-action:manipulation">Save</button><button onclick="renderManagerList()" style="height:40px;padding:0 10px;border-radius:5px;border:1.5px solid var(--border2);background:var(--surface2);color:var(--text2);font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;cursor:pointer;touch-action:manipulation">Cancel</button><button onclick="removeManager('+i+')" style="height:40px;padding:0 10px;border-radius:5px;border:1.5px solid var(--danger);background:var(--danger-light);color:var(--danger);font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;cursor:pointer;touch-action:manipulation">&#128465;</button></div>';
  setTimeout(function(){document.getElementById('emgr_name_'+i)?.focus();},50);
}
function saveManagerEdit(i){
  var name=document.getElementById('emgr_name_'+i)?.value.trim(),badge=document.getElementById('emgr_badge_'+i)?.value.trim();
  if(!name){showToast('Manager name required');return;}
  var roster=getManagerRoster();roster[i]={name:name,badge:badge};saveManagerRoster(roster);renderManagerList();showToast('\u2713 Manager updated');
}
function removeManager(i){
  var roster=getManagerRoster();if(!confirm('Remove '+(roster[i].name||'this manager')+'?'))return;roster.splice(i,1);saveManagerRoster(roster);renderManagerList();showToast('Manager removed');
}
function addManagerRow(){
  var roster=getManagerRoster();roster.push({name:'',badge:''});saveManagerRoster(roster);renderManagerList();editManager(roster.length-1);
}
function saveManagers(){showToast('\u2713 Manager roster saved');setTimeout(function(){ss('manager');},600);}

function saveCustomerCode(){
  var code=document.getElementById('custCodeInput')?.value.trim().toUpperCase();
  if(!code){showToast('Please enter a code');return;}
  saveToStore('ei_customer_code',code); // saves to Supabase + all devices
  var msg=document.getElementById('custCodeMsg');
  if(msg){msg.textContent='\u2713 Updated to '+code;setTimeout(function(){msg.textContent='';},3000);}
  showToast('\u2713 Customer code updated');
}
