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

// ── UNIT TYPE / AUTO-NUMBERING HELPERS ─────────────────────────────────────────
// Truck type is always derived from the unit string's prefix ('TT' or 'ST'),
// never freely typed, so numbering stays consistent and pricing (which is
// keyed off truck type) can never drift.
function _unitType(unit){return(unit||'').trim().toUpperCase().startsWith('ST')?'ST':'TT';}
function _unitNum(unit){return parseInt((unit||'').replace(/[^0-9]/g,''))||0;}
function _nextUnitNum(roster,type){
  var nums=roster.filter(function(d){return _unitType(d.unit)===type;}).map(function(d){return _unitNum(d.unit);});
  return(nums.length?Math.max.apply(null,nums):0)+1;
}
// Reassigns sequential unit numbers (1, 2, 3...) within one truck type, closing
// any gap left by a removed or moved driver, while preserving relative order.
function _renumberType(roster,type){
  var group=roster.filter(function(d){return _unitType(d.unit)===type;});
  group.sort(function(a,b){return _unitNum(a.unit)-_unitNum(b.unit);});
  group.forEach(function(d,i){d.unit=type+' '+(i+1);});
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
  var curType=_unitType(d.unit);
  row.innerHTML='<div style="display:grid;grid-template-columns:78px 80px 1fr 80px auto auto auto;gap:8px;align-items:center;width:100%;padding:6px 0"><div><select id="edit_type_'+i+'" onchange="_editTypeChanged('+i+')" style="width:100%;height:40px;padding:0 4px;border:1.5px solid var(--accent);border-radius:5px;font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;color:var(--accent)"><option value="TT"'+(curType==='TT'?' selected':'')+'>TT</option><option value="ST"'+(curType==='ST'?' selected':'')+'>ST</option></select><div style="font-size:9px;color:var(--muted);margin-top:2px;white-space:nowrap">Now: <b id="edit_unit_lbl_'+i+'">'+_escAttr(d.unit)+'</b></div></div><input type="text" id="edit_dnum_'+i+'" value="'+_escAttr(d.driverNum||'')+'" placeholder="e.g. 751" inputmode="tel" style="height:40px;padding:0 8px;border:1.5px solid var(--accent);border-radius:5px;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:600;width:100%"><input type="text" id="edit_name_'+i+'" value="'+_escAttr(d.name||'')+'" placeholder="Driver name" style="height:40px;padding:0 10px;border:1.5px solid var(--accent);border-radius:5px;font-size:14px;font-family:Barlow,sans-serif;width:100%"><input type="number" id="edit_rate_'+i+'" value="'+_escAttr(d.rate||92)+'" placeholder="92" style="height:40px;padding:0 8px;border:1.5px solid var(--accent);border-radius:5px;font-size:14px;font-family:Barlow Condensed,sans-serif;font-weight:600;width:100%"><button onclick="saveDriverEdit('+i+')" style="height:40px;padding:0 14px;border-radius:5px;border:none;background:var(--success);color:white;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;cursor:pointer;white-space:nowrap;touch-action:manipulation">Save</button><button onclick="renderDriverList()" style="height:40px;padding:0 10px;border-radius:5px;border:1.5px solid var(--border2);background:var(--surface2);color:var(--text2);font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;cursor:pointer;touch-action:manipulation">Cancel</button><button onclick="removeDriverRow('+i+')" style="height:40px;padding:0 10px;border-radius:5px;border:1.5px solid var(--danger);background:var(--danger-light);color:var(--danger);font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;cursor:pointer;touch-action:manipulation">&#128465;</button></div>';
  setTimeout(function(){document.getElementById('edit_name_'+i)?.focus();},50);
}
// Live preview when the truck type dropdown changes during edit: shows the
// unit # this driver will move to on save, and offers to swap the rate to
// match the new type's default (only if the rate hadn't been overridden).
function _editTypeChanged(i){
  var roster=getDriverRoster(),d=roster[i];
  var oldType=_unitType(d.unit);
  var newType=document.getElementById('edit_type_'+i)?.value;
  var lbl=document.getElementById('edit_unit_lbl_'+i);
  var rateEl=document.getElementById('edit_rate_'+i);
  if(newType===oldType){
    if(lbl)lbl.textContent=d.unit;
  } else {
    var num=_nextUnitNum(roster,newType);
    if(lbl)lbl.innerHTML=d.unit+' &rarr; '+newType+' '+num+' <span style="color:var(--accent)">(on save)</span>';
    if(rateEl && parseFloat(rateEl.value)===TRUCK_RATES[oldType]) rateEl.value=TRUCK_RATES[newType]||92;
  }
}
function saveDriverEdit(i){
  var newType=document.getElementById('edit_type_'+i)?.value||'TT';
  var driverNum=document.getElementById('edit_dnum_'+i)?.value.trim(),name=document.getElementById('edit_name_'+i)?.value.trim(),rate=parseFloat(document.getElementById('edit_rate_'+i)?.value)||TRUCK_RATES[newType]||92;
  if(!name){showToast('Driver name required');return;}
  var roster=getDriverRoster();
  var oldType=_unitType(roster[i].unit);
  if(newType!==oldType){
    // Moving to a different truck type: take the next open number in the new
    // type's sequence, then close the gap this driver leaves behind in the old type.
    var num=_nextUnitNum(roster,newType);
    roster[i]={unit:newType+' '+num,driverNum:driverNum,name:name,rate:rate};
    _renumberType(roster,oldType);
  } else {
    roster[i]={unit:roster[i].unit,driverNum:driverNum,name:name,rate:rate};
  }
  saveDriverRoster(roster);renderDriverList();showToast('\u2713 Driver updated');
}
function removeDriverRow(i){
  var roster=getDriverRoster();if(!confirm('Remove '+roster[i].name+'?'))return;
  var removedType=_unitType(roster[i].unit);
  roster.splice(i,1);
  _renumberType(roster,removedType); // close the gap left behind so numbering stays sequential
  saveDriverRoster(roster);renderDriverList();showToast('Driver removed');
}
function cancelAddDriver(){var f=document.getElementById('addDriverForm');if(f)f.remove();window._newDriverRowIds=[];}
function addDriverRow(){
  var existing=document.getElementById('addDriverForm');
  if(existing){existing.remove();window._newDriverRowIds=[];return;}
  var list=document.getElementById('driverList'),form=document.createElement('div');
  form.id='addDriverForm';form.style.cssText='background:var(--accent-light);border:1.5px solid var(--accent);border-radius:8px;padding:14px;margin-bottom:14px;';
  form.innerHTML=
    '<div style="font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">New Driver(s)</div>'+
    '<div style="font-size:11px;color:var(--muted);margin-bottom:10px">Set the truck type per driver &mdash; TT and ST can be mixed in the same batch. Unit #s auto-assign as the next open number for each type.</div>'+
    '<div id="newDriverRows"></div>'+
    '<button type="button" onclick="_addAnotherNewDriverRow()" style="width:100%;height:38px;margin-bottom:10px;border-radius:6px;border:1.5px dashed var(--accent);background:white;color:var(--accent);font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;cursor:pointer;touch-action:manipulation">+ Add Another Driver</button>'+
    '<div style="display:flex;gap:8px">'+
      '<button onclick="confirmAddDriver()" style="flex:1;height:40px;border-radius:5px;border:none;background:var(--accent);color:white;font-family:Barlow Condensed,sans-serif;font-size:16px;font-weight:700;cursor:pointer;touch-action:manipulation">Add Driver(s)</button>'+
      '<button onclick="cancelAddDriver()" style="height:40px;padding:0 16px;border-radius:5px;border:1.5px solid var(--border2);background:white;color:var(--text2);font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;cursor:pointer;touch-action:manipulation">Cancel</button>'+
    '</div>';
  list.parentNode.insertBefore(form,list);
  window._newDriverRowIds=[];window._newDriverRowSeq=0;
  _addAnotherNewDriverRow();
  setTimeout(function(){form.scrollIntoView({behavior:'smooth',block:'center'});},50);
}
// Adds one more Type / Name / Driver # / Rate row to the batch. New rows
// default to the same type as the row above them (the common case is
// several of the same type in a row), but each row's type can be changed
// independently so TT and ST drivers can be mixed in one batch. Unit #
// previews recompute per-type whenever any row's type changes or a row is
// added/removed, counting each type's rows in order to stay contiguous.
function _addAnotherNewDriverRow(){
  var rid=window._newDriverRowSeq++;
  var priorRid=window._newDriverRowIds.length?window._newDriverRowIds[window._newDriverRowIds.length-1]:null;
  var defaultType=priorRid!=null?(document.getElementById('newrow_type_'+priorRid)?.value||'TT'):'TT';
  window._newDriverRowIds.push(rid);
  var rows=document.getElementById('newDriverRows');if(!rows)return;
  var div=document.createElement('div');
  div.id='newrow_'+rid;
  div.dataset.type=defaultType;
  div.style.cssText='background:white;border:1px solid var(--border);border-radius:6px;padding:10px;margin-bottom:8px';
  div.innerHTML=
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'+
      '<span id="newrow_unit_'+rid+'" style="font-family:Barlow Condensed,sans-serif;font-size:13px;font-weight:700;color:var(--accent)"></span>'+
      '<button type="button" onclick="_removeNewDriverRow('+rid+')" id="newrow_rm_'+rid+'" style="background:none;border:none;color:var(--muted);font-size:16px;cursor:pointer;padding:2px 6px;touch-action:manipulation">&#215;</button>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:64px 1fr 84px 84px;gap:8px">'+
      '<div><label style="display:block;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px">Type</label><select id="newrow_type_'+rid+'" onchange="_onRowTypeChange('+rid+')" style="width:100%;height:40px;padding:0 4px;border:1.5px solid var(--border);border-radius:5px;font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700"><option value="TT"'+(defaultType==='TT'?' selected':'')+'>TT</option><option value="ST"'+(defaultType==='ST'?' selected':'')+'>ST</option></select></div>'+
      '<div><label style="display:block;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px">Driver Name</label><input type="text" id="new_name_'+rid+'" placeholder="First Last" autocapitalize="words" oninput="capWords(this)" style="width:100%;height:40px;padding:0 10px;border:1.5px solid var(--border);border-radius:5px;font-size:14px;font-family:Barlow,sans-serif"></div>'+
      '<div><label style="display:block;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px">Driver #</label><input type="text" id="new_dnum_'+rid+'" placeholder="e.g. 751" inputmode="tel" style="width:100%;height:40px;padding:0 8px;border:1.5px solid var(--border);border-radius:5px;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:600"></div>'+
      '<div><label style="display:block;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px">Rate ($/hr)</label><input type="number" id="new_rate_'+rid+'" inputmode="decimal" value="'+(TRUCK_RATES[defaultType]||92)+'" style="width:100%;height:40px;padding:0 8px;border:1.5px solid var(--border);border-radius:5px;font-size:14px;font-family:Barlow Condensed,sans-serif;font-weight:600"></div>'+
    '</div>';
  rows.appendChild(div);
  _refreshNewDriverRowPreviews();
  setTimeout(function(){document.getElementById('new_name_'+rid)?.focus();},50);
}
// When a row's type changes, swap its rate to the new type's default too —
// but only if the rate was still sitting at the old type's default, so a
// manually-typed exception rate doesn't get silently overwritten.
function _onRowTypeChange(rid){
  var wrap=document.getElementById('newrow_'+rid);
  var sel=document.getElementById('newrow_type_'+rid);
  var rateEl=document.getElementById('new_rate_'+rid);
  var oldType=wrap?wrap.dataset.type:'TT';
  var newType=sel?sel.value:'TT';
  if(rateEl&&parseFloat(rateEl.value)===TRUCK_RATES[oldType])rateEl.value=TRUCK_RATES[newType]||92;
  if(wrap)wrap.dataset.type=newType;
  _refreshNewDriverRowPreviews();
}
function _removeNewDriverRow(rid){
  if(window._newDriverRowIds.length<=1)return; // always keep at least one row
  window._newDriverRowIds=window._newDriverRowIds.filter(function(x){return x!==rid;});
  var el=document.getElementById('newrow_'+rid);if(el)el.remove();
  _refreshNewDriverRowPreviews();
}
function _refreshNewDriverRowPreviews(){
  var roster=getDriverRoster();
  var bases={TT:_nextUnitNum(roster,'TT'),ST:_nextUnitNum(roster,'ST')};
  var counts={TT:0,ST:0};
  window._newDriverRowIds.forEach(function(rid){
    var type=document.getElementById('newrow_type_'+rid)?.value||'TT';
    var lbl=document.getElementById('newrow_unit_'+rid);
    if(lbl)lbl.textContent='Unit '+type+' '+(bases[type]+counts[type]);
    counts[type]++;
    var rm=document.getElementById('newrow_rm_'+rid);
    if(rm)rm.style.display=window._newDriverRowIds.length>1?'inline-block':'none';
  });
}
function confirmAddDriver(){
  var ids=window._newDriverRowIds||[];
  var entries=[];
  ids.forEach(function(rid){
    var name=document.getElementById('new_name_'+rid)?.value.trim();
    if(!name)return; // skip any blank rows rather than blocking the whole batch
    var type=document.getElementById('newrow_type_'+rid)?.value||'TT';
    var driverNum=document.getElementById('new_dnum_'+rid)?.value.trim();
    var rate=parseFloat(document.getElementById('new_rate_'+rid)?.value)||TRUCK_RATES[type]||92;
    entries.push({type:type,driverNum:driverNum,name:name,rate:rate});
  });
  if(!entries.length){showToast('Enter at least one driver name');return;}
  var roster=getDriverRoster();
  // Recomputed at save time (in case the roster changed while the form was open),
  // then each type gets its own running counter so mixed TT/ST batches stay contiguous.
  var counters={TT:_nextUnitNum(roster,'TT'),ST:_nextUnitNum(roster,'ST')};
  entries.forEach(function(e){
    roster.push({unit:e.type+' '+counters[e.type],driverNum:e.driverNum,name:e.name,rate:e.rate});
    counters[e.type]++;
  });
  saveDriverRoster(roster);
  var form=document.getElementById('addDriverForm');if(form)form.remove();
  window._newDriverType=null;window._newDriverRowIds=[];
  renderDriverList();
  showToast('\u2713 '+entries.length+' driver'+(entries.length!==1?'s':'')+' added');
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
