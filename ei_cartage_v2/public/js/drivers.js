/**
 * drivers.js
 * Driver roster management, manager roster, truck type rates,
 * drop location settings, and manager PIN/employee# management.
 */

function _escAttr(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── DAY-OF-WEEK TOGGLE (which days a driver's default start time applies to) ──
var _DOW=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var _DOW_ABBR={'Sunday':'Su','Monday':'Mo','Tuesday':'Tu','Wednesday':'We','Thursday':'Th','Friday':'Fr','Saturday':'Sa'};
// selectedDays: array of day names, or null/undefined to mean "every day" (default)
function _dayToggleHtml(hiddenId,selectedDays){
  var sel=(selectedDays&&selectedDays.length)?selectedDays:_DOW.slice();
  var btns=_DOW.map(function(d){
    var active=sel.indexOf(d)>=0;
    return '<button type="button" class="day-btn" data-day="'+d+'" data-target="'+hiddenId+'" data-active="'+(active?'1':'0')+'" onclick="_toggleDayBtn(this)" style="width:28px;height:28px;border-radius:4px;border:1.5px solid '+(active?'var(--accent)':'var(--border)')+';background:'+(active?'var(--accent)':'white')+';color:'+(active?'white':'var(--text2)')+';font-size:10px;font-weight:700;cursor:pointer;padding:0;touch-action:manipulation">'+_DOW_ABBR[d]+'</button>';
  }).join('');
  return '<div class="daytoggle" style="display:flex;gap:3px;align-items:center;flex-wrap:wrap">'
    +btns
    +'<button type="button" data-target="'+hiddenId+'" onclick="_selectAllDaysBtn(this)" style="height:28px;padding:0 8px;border-radius:4px;border:1.5px solid var(--accent);background:white;color:var(--accent);font-size:10px;font-weight:700;cursor:pointer;margin-left:4px;touch-action:manipulation">All</button>'
    +'<input type="hidden" id="'+hiddenId+'" value="'+sel.join(',')+'">'
    +'</div>';
}
function _toggleDayBtn(btn){
  var willBeActive=btn.dataset.active!=='1';
  btn.dataset.active=willBeActive?'1':'0';
  btn.style.background=willBeActive?'var(--accent)':'white';
  btn.style.borderColor=willBeActive?'var(--accent)':'var(--border)';
  btn.style.color=willBeActive?'white':'var(--text2)';
  _syncDayHidden(btn.dataset.target);
}
function _selectAllDaysBtn(btn){
  var hiddenId=btn.dataset.target;
  document.querySelectorAll('.day-btn[data-target="'+hiddenId+'"]').forEach(function(b){
    b.dataset.active='1';
    b.style.background='var(--accent)';b.style.borderColor='var(--accent)';b.style.color='white';
  });
  _syncDayHidden(hiddenId);
}
function _syncDayHidden(hiddenId){
  var hidden=document.getElementById(hiddenId);if(!hidden)return;
  var selected=[];
  document.querySelectorAll('.day-btn[data-target="'+hiddenId+'"]').forEach(function(b){
    if(b.dataset.active==='1') selected.push(b.dataset.day);
  });
  hidden.value=selected.join(',');
}

// ── DRIVER ROSTER ─────────────────────────────────────────────────────────────
function getDriverRoster(){
  try{
    var s=cacheGet('ei_driver_roster'); // reads from Supabase cache first, falls back to localStorage
    if(s)return JSON.parse(s);
  }catch(e){}
  return Object.entries(UNIT_MAP).map(function(e){var n=e[0],u=e[1];return{name:n,unit:u,rate:u.toUpperCase().startsWith('ST')?TRUCK_RATES.ST:TRUCK_RATES.TT};});
}
// Plain-English summary of what changed between two rosters, for the change log
function _rosterDiff(oldR,newR){
  var byName=function(r){var o={};(r||[]).forEach(function(d){if(d&&d.name)o[d.name]=d;});return o;};
  var a=byName(oldR),b=byName(newR),out=[];
  Object.keys(b).forEach(function(n){
    if(!a[n]){out.push('Added '+n+' ('+(b[n].unit||'')+')');return;}
    var ch=[];
    ['unit','driverNum','rate','startTime'].forEach(function(k){if(String(a[n][k]||'')!==String(b[n][k]||''))ch.push(k+' '+(a[n][k]||'\u2014')+'\u2192'+(b[n][k]||'\u2014'));});
    if(!!a[n].isAdmin!==!!b[n].isAdmin)ch.push(b[n].isAdmin?'set admin/test':'removed admin/test');
    if(ch.length)out.push(n+': '+ch.join(', '));
  });
  Object.keys(a).forEach(function(n){if(!b[n])out.push('Removed '+n+' ('+(a[n].unit||'')+')');});
  return out.join('; ');
}
function saveDriverRoster(roster){
  var _diff=_rosterDiff(getDriverRoster(),roster);
  if(_diff)logChange('Driver roster',_diff);
  var sorted=sortRoster(roster);
  saveToStore('ei_driver_roster',JSON.stringify(sorted)); // saves to Supabase + localStorage
  rebuildUnitMap(sorted);
}
function sortRoster(roster){
  return roster.slice().sort(function(a,b){
    var aAdm=!!a.isAdmin,bAdm=!!b.isAdmin;
    if(aAdm!==bAdm)return(aAdm?1:0)-(bAdm?1:0); // admin/test drivers always sort last
    if(aAdm&&bAdm)return a.name.localeCompare(b.name);
    var aT=a.unit.toUpperCase().startsWith('ST')?1:0,bT=b.unit.toUpperCase().startsWith('ST')?1:0;
    if(aT!==bT)return aT-bT;
    return(parseInt(a.unit.replace(/[^0-9]/g,''))||0)-(parseInt(b.unit.replace(/[^0-9]/g,''))||0);
  });
}
// Names of drivers flagged as admin/test-only. Used to exclude their manifests
// from the manager dashboard, weekly Summary, custom-range reports, and the
// customer-facing dashboard — they exist purely to test the driver-side
// manifest flow and were never real billable work.
function getAdminDriverNames(){
  return new Set(getDriverRoster().filter(function(d){return d.isAdmin;}).map(function(d){return d.name;}));
}

// ── UNIT TYPE / AUTO-NUMBERING HELPERS ─────────────────────────────────────────
// Truck type is always derived from the unit string's prefix ('TT' or 'ST'),
// never freely typed, so numbering stays consistent and pricing (which is
// keyed off truck type) can never drift. Admin/test drivers (unit 'ADMIN')
// are excluded entirely — they never occupy or consume a TT/ST slot.
function _unitType(unit){return(unit||'').trim().toUpperCase().startsWith('ST')?'ST':'TT';}
function _unitNum(unit){return parseInt((unit||'').replace(/[^0-9]/g,''))||0;}
function _nextUnitNum(roster,type){
  var nums=roster.filter(function(d){return !d.isAdmin&&_unitType(d.unit)===type;}).map(function(d){return _unitNum(d.unit);});
  return(nums.length?Math.max.apply(null,nums):0)+1;
}
// Reassigns sequential unit numbers (1, 2, 3...) within one truck type, closing
// any gap left by a removed or moved driver, while preserving relative order.
function _renumberType(roster,type){
  var group=roster.filter(function(d){return !d.isAdmin&&_unitType(d.unit)===type;});
  group.sort(function(a,b){return _unitNum(a.unit)-_unitNum(b.unit);});
  group.forEach(function(d,i){d.unit=type+' '+(i+1);});
}

function rebuildUnitMap(roster){
  var sel=document.getElementById('loginName');if(!sel)return;
  var cur=sel.value;
  sel.innerHTML='<option value="">Select your name...</option>';
  roster.forEach(function(d){if(!d.name)return;var o=document.createElement('option');o.value=o.textContent=d.name;if(d.name===cur)o.selected=true;sel.appendChild(o);});
}
// DANGER — DO NOT CALL, DO NOT WIRE UP TO ANY UI ELEMENT:
// this blindly overwrites the ENTIRE server-side ei_manifests array with
// whatever happens to be in the local `manifests` variable at the moment
// it's called, with no refresh-and-merge safety. It is currently unused
// (only referenced by the also-unused save() in manager.js) — leave it
// that way. Any real manifest save must go through mergeAndSaveManifest()
// or refreshThenMutateManifests() in api.js instead.
function saveManifests(){saveToStore('ei_manifests',JSON.stringify(manifests));}

// ── DROP LOCATIONS ────────────────────────────────────────────────────────────
function getDropLocations(){try{var s=cacheGet('ei_drop_locations');if(s)return JSON.parse(s);}catch(e){}return{loc1:'849',loc2:'2000'};}
function saveDropLocations(){
  var l1=document.getElementById('dropLoc1')?.value.trim(),l2=document.getElementById('dropLoc2')?.value.trim();
  if(!l1||!l2){showToast('Both locations required');return;}
  saveToStore('ei_drop_locations',JSON.stringify({loc1:l1,loc2:l2}));
  logChange('Drop locations',l1+', '+l2);
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
  var trEl=document.getElementById('trailerRateInput');
  if(trEl){var tr=getTrailerRate();trEl.value=tr?tr:'';}
  renderDriverList();renderHolidayList();if(typeof renderMgrWho==='function')renderMgrWho();ss('driverMgr');
}
function saveTrailerRate(){
  var v=parseFloat(document.getElementById('trailerRateInput')?.value);
  if(isNaN(v)||v<0){showToast('Enter a valid trailer rate',3000);return;}
  var _old=getTrailerRate();
  saveToStore('ei_trailer_rate',String(v));
  if(_old!==v)logChange('Trailer rate','$'+_old.toFixed(2)+' \u2192 $'+v.toFixed(2));
  var msg=document.getElementById('trailerRateMsg');if(msg){msg.textContent='\u2713 Updated';setTimeout(function(){msg.textContent='';},3000);}
  showToast('\u2713 Trailer rate updated');
}
// Read-only list of this year's and next year's billable holidays, with the
// unit count and amount they bill at the current roster and rates.
function renderHolidayList(){
  var el=document.getElementById('holidayList');if(!el)return;
  var today=localDateStr(),y=parseInt(today.slice(0,4),10);
  var units=getDriverRoster().filter(isHolidayBillableDriver);
  var perDay=units.reduce(function(s,d){return s+HOLIDAY_HOURS*rate(d.name);},0);
  var hols=getHolidaysInRange(y+'-01-01',(y+1)+'-12-31');
  if(!hols.length){el.innerHTML='<div style="font-size:13px;color:var(--muted)">No holidays scheduled.</div>';return;}
  el.innerHTML='<div style="font-size:12px;color:var(--text2);margin-bottom:8px"><strong>'+units.length+'</strong> billable units &times; '+HOLIDAY_HOURS+' hrs = <strong>$'+perDay.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</strong> per holiday at current roster/rates</div>'
    +hols.map(function(h){
      var past=h.date<today;
      var d=new Date(h.date+'T12:00:00');
      var ds=d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;'+(past?'color:var(--muted)':'')+'">'
        +'<span><strong>'+h.name+'</strong> &nbsp;·&nbsp; '+ds+'</span>'
        +'<span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">'+(past?'Billed':'Upcoming')+'</span>'
        +'</div>';
    }).join('');
}
function renderDriverList(){
  var roster=getDriverRoster(),el=document.getElementById('driverList');
  if(!el)return;
  if(!roster.length){el.innerHTML='<div style="text-align:center;padding:24px;color:var(--muted)">No drivers yet.</div>';return;}
  var sorted=sortRoster(roster);
  el.innerHTML='<div style="display:flex;align-items:center;gap:10px;padding:6px 0 8px;border-bottom:2px solid var(--border2)"><div style="width:60px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted)">Unit</div><div style="width:80px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted)">Driver #</div><div style="flex:1;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted)">Name</div><div style="width:65px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);text-align:right">Rate</div><div style="width:70px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);text-align:right">Start</div><div style="width:60px"></div></div>'+
  sorted.map(function(d){
    var origIdx=roster.indexOf(d);
    var unitDisplay=d.isAdmin?'<span style="font-size:10px;padding:2px 6px;border-radius:3px;background:var(--surface2);color:var(--muted);font-weight:700;letter-spacing:.3px">ADMIN</span>':d.unit;
    var rateDisplay=d.isAdmin?'&mdash;':('$'+(TRUCK_RATES[_unitType(d.unit)]||d.rate)+'/hr');
    var startDisplay=d.startTime||'&mdash;';
    return '<div class="dl-row" id="dlrow_'+origIdx+'" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><div style="width:60px;font-family:Barlow Condensed,sans-serif;font-size:16px;font-weight:700;color:var(--accent)">'+unitDisplay+'</div><div style="width:80px;font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:600;color:var(--text2)">'+(d.driverNum?'#'+d.driverNum:'&mdash;')+'</div><div style="flex:1;font-size:14px;font-weight:500">'+d.name+(d.isAdmin?' <span style="font-size:10px;color:var(--muted);font-weight:400">(test only \u2014 hidden from reports)</span>':'')+'</div><div style="width:65px;font-family:Barlow Condensed,sans-serif;font-size:14px;color:var(--text2);text-align:right">'+rateDisplay+'</div><div style="width:70px;font-family:Barlow Condensed,sans-serif;font-size:14px;color:var(--text2);text-align:right">'+startDisplay+'</div><button onclick="editDriver('+origIdx+')" style="height:34px;padding:0 14px;border-radius:5px;border:1.5px solid var(--accent);background:var(--accent-light);color:var(--accent);font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;cursor:pointer;touch-action:manipulation">Edit</button></div>';
  }).join('');
}
function editDriver(i){
  var roster=getDriverRoster(),d=roster[i],row=document.getElementById('dlrow_'+i);if(!row)return;
  var isAdmin=!!d.isAdmin;
  var curType=_unitType(d.unit);
  var daysHiddenId='edit_days_'+i;
  row.innerHTML='<div style="width:100%;padding:6px 0"><div style="display:grid;grid-template-columns:88px 80px 1fr 80px 90px auto auto auto;gap:8px;align-items:start;margin-bottom:8px"><div><select id="edit_type_'+i+'" onchange="_editTypeChanged('+i+')" '+(isAdmin?'disabled':'')+' style="width:100%;height:40px;padding:0 4px;border:1.5px solid var(--accent);border-radius:5px;font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;color:var(--accent)"><option value="TT"'+(curType==='TT'?' selected':'')+'>TT</option><option value="ST"'+(curType==='ST'?' selected':'')+'>ST</option></select><div style="font-size:9px;color:var(--muted);margin-top:2px;white-space:nowrap">Now: <b id="edit_unit_lbl_'+i+'">'+_escAttr(d.unit)+'</b></div><label style="display:flex;align-items:center;gap:3px;font-size:9px;color:var(--muted);margin-top:4px;white-space:nowrap;cursor:pointer"><input type="checkbox" id="edit_admin_'+i+'" onchange="_editAdminToggled('+i+')" '+(isAdmin?'checked':'')+'> Admin/test</label></div><input type="text" id="edit_dnum_'+i+'" value="'+_escAttr(d.driverNum||'')+'" placeholder="e.g. 751" inputmode="tel" style="height:40px;padding:0 8px;border:1.5px solid var(--accent);border-radius:5px;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:600;width:100%"><input type="text" id="edit_name_'+i+'" value="'+_escAttr(d.name||'')+'" placeholder="Driver name" style="height:40px;padding:0 10px;border:1.5px solid var(--accent);border-radius:5px;font-size:14px;font-family:Barlow,sans-serif;width:100%"><input type="number" id="edit_rate_'+i+'" value="'+_escAttr(isAdmin?(d.rate||0):(TRUCK_RATES[curType]||d.rate||92))+'" placeholder="92" '+(isAdmin?'disabled':'')+' style="height:40px;padding:0 8px;border:1.5px solid var(--accent);border-radius:5px;font-size:14px;font-family:Barlow Condensed,sans-serif;font-weight:600;width:100%"><div><input type="time" id="edit_start_'+i+'" value="'+_escAttr(d.startTime||'')+'" style="height:40px;padding:0 6px;border:1.5px solid var(--accent);border-radius:5px;font-size:13px;font-family:Barlow Condensed,sans-serif;font-weight:600;width:100%"><div style="font-size:8px;color:var(--muted);margin-top:2px;white-space:nowrap">Default start</div></div><button onclick="saveDriverEdit('+i+')" style="height:40px;padding:0 14px;border-radius:5px;border:none;background:var(--success);color:white;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;cursor:pointer;white-space:nowrap;touch-action:manipulation">Save</button><button onclick="renderDriverList()" style="height:40px;padding:0 10px;border-radius:5px;border:1.5px solid var(--border2);background:var(--surface2);color:var(--text2);font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;cursor:pointer;touch-action:manipulation">Cancel</button><button onclick="removeDriverRow('+i+')" style="height:40px;padding:0 10px;border-radius:5px;border:1.5px solid var(--danger);background:var(--danger-light);color:var(--danger);font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;cursor:pointer;touch-action:manipulation">&#128465;</button></div>'
    +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);white-space:nowrap">Applies on:</span>'+_dayToggleHtml(daysHiddenId,d.startDays)+'</div>'
    +'</div>';
  setTimeout(function(){document.getElementById('edit_name_'+i)?.focus();},50);
}
// Toggling the Admin/test checkbox during edit disables the Type/Rate fields
// (irrelevant for a non-billed test driver) and previews where the unit #
// will land on save — either 'ADMIN' or the next open slot in the chosen type.
function _editAdminToggled(i){
  var roster=getDriverRoster(),d=roster[i];
  var checked=document.getElementById('edit_admin_'+i)?.checked;
  var typeSel=document.getElementById('edit_type_'+i);
  var rateEl=document.getElementById('edit_rate_'+i);
  var lbl=document.getElementById('edit_unit_lbl_'+i);
  if(typeSel)typeSel.disabled=checked;
  if(rateEl)rateEl.disabled=checked;
  if(checked){
    if(lbl)lbl.innerHTML=d.unit+' &rarr; ADMIN <span style="color:var(--accent)">(on save)</span>';
  } else {
    var newType=typeSel?typeSel.value:'TT';
    var num=_nextUnitNum(roster,newType);
    if(lbl)lbl.innerHTML=d.unit+' &rarr; '+newType+' '+num+' <span style="color:var(--accent)">(on save)</span>';
  }
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
  var isAdminNow=!!document.getElementById('edit_admin_'+i)?.checked;
  var newType=document.getElementById('edit_type_'+i)?.value||'TT';
  var driverNum=document.getElementById('edit_dnum_'+i)?.value.trim(),name=document.getElementById('edit_name_'+i)?.value.trim();
  var rate=isAdminNow?0:(parseFloat(document.getElementById('edit_rate_'+i)?.value)||TRUCK_RATES[newType]||92);
  var startTime=document.getElementById('edit_start_'+i)?.value||'';
  var startDaysRaw=document.getElementById('edit_days_'+i)?.value||'';
  var startDays=startDaysRaw?startDaysRaw.split(','):_DOW.slice();
  if(!name){showToast('Driver name required');return;}
  var roster=getDriverRoster();
  var wasAdmin=!!roster[i].isAdmin;
  var oldType=_unitType(roster[i].unit);
  if(isAdminNow&&!wasAdmin){
    // Becoming admin/test: drop out of whichever type group they were in and close that gap
    roster[i]={unit:'ADMIN',driverNum:driverNum,name:name,rate:0,isAdmin:true,startTime:startTime,startDays:startDays};
    _renumberType(roster,oldType);
  } else if(!isAdminNow&&wasAdmin){
    // Leaving admin/test: join the selected type's sequence at the next open number
    var num=_nextUnitNum(roster,newType);
    roster[i]={unit:newType+' '+num,driverNum:driverNum,name:name,rate:rate,isAdmin:false,startTime:startTime,startDays:startDays};
  } else if(isAdminNow&&wasAdmin){
    roster[i]={unit:'ADMIN',driverNum:driverNum,name:name,rate:0,isAdmin:true,startTime:startTime,startDays:startDays};
  } else if(newType!==oldType){
    var num2=_nextUnitNum(roster,newType);
    roster[i]={unit:newType+' '+num2,driverNum:driverNum,name:name,rate:rate,isAdmin:false,startTime:startTime,startDays:startDays};
    _renumberType(roster,oldType);
  } else {
    roster[i]={unit:roster[i].unit,driverNum:driverNum,name:name,rate:rate,isAdmin:false,startTime:startTime,startDays:startDays};
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
    '<div style="display:grid;grid-template-columns:64px 1fr 84px 84px 90px;gap:8px;margin-bottom:8px">'+
      '<div><label style="display:block;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px">Type</label><select id="newrow_type_'+rid+'" onchange="_onRowTypeChange('+rid+')" style="width:100%;height:40px;padding:0 4px;border:1.5px solid var(--border);border-radius:5px;font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700"><option value="TT"'+(defaultType==='TT'?' selected':'')+'>TT</option><option value="ST"'+(defaultType==='ST'?' selected':'')+'>ST</option></select></div>'+
      '<div><label style="display:block;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px">Driver Name</label><input type="text" id="new_name_'+rid+'" placeholder="First Last" autocapitalize="words" oninput="capWords(this)" style="width:100%;height:40px;padding:0 10px;border:1.5px solid var(--border);border-radius:5px;font-size:14px;font-family:Barlow,sans-serif"></div>'+
      '<div><label style="display:block;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px">Driver #</label><input type="text" id="new_dnum_'+rid+'" placeholder="e.g. 751" inputmode="tel" style="width:100%;height:40px;padding:0 8px;border:1.5px solid var(--border);border-radius:5px;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:600"></div>'+
      '<div><label style="display:block;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px">Rate ($/hr)</label><input type="number" id="new_rate_'+rid+'" inputmode="decimal" value="'+(TRUCK_RATES[defaultType]||92)+'" style="width:100%;height:40px;padding:0 8px;border:1.5px solid var(--border);border-radius:5px;font-size:14px;font-family:Barlow Condensed,sans-serif;font-weight:600"></div>'+
      '<div><label style="display:block;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px">Default Start</label><input type="time" id="new_start_'+rid+'" style="width:100%;height:40px;padding:0 6px;border:1.5px solid var(--border);border-radius:5px;font-size:13px;font-family:Barlow Condensed,sans-serif;font-weight:600"></div>'+
    '</div>'+
    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px"><span style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);white-space:nowrap">Applies on:</span>'+_dayToggleHtml('new_days_'+rid,null)+'</div>'+
    '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted);cursor:pointer"><input type="checkbox" id="newrow_admin_'+rid+'" onchange="_onRowAdminToggle('+rid+')"> Admin/test driver &mdash; no truck, hidden from Summary &amp; Manager dashboard</label>';
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
// Admin/test rows skip truck assignment entirely — disable Type/Rate and
// drop out of the TT/ST slot counting used for the unit-number previews.
function _onRowAdminToggle(rid){
  var checked=document.getElementById('newrow_admin_'+rid)?.checked;
  var typeSel=document.getElementById('newrow_type_'+rid);
  var rateEl=document.getElementById('new_rate_'+rid);
  if(typeSel)typeSel.disabled=checked;
  if(rateEl)rateEl.disabled=checked;
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
    var isAdmin=document.getElementById('newrow_admin_'+rid)?.checked;
    var lbl=document.getElementById('newrow_unit_'+rid);
    if(isAdmin){
      if(lbl)lbl.textContent='ADMIN (no truck)';
    } else {
      var type=document.getElementById('newrow_type_'+rid)?.value||'TT';
      if(lbl)lbl.textContent='Unit '+type+' '+(bases[type]+counts[type]);
      counts[type]++;
    }
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
    var isAdmin=!!document.getElementById('newrow_admin_'+rid)?.checked;
    var driverNum=document.getElementById('new_dnum_'+rid)?.value.trim();
    var startTime=document.getElementById('new_start_'+rid)?.value||'';
    var startDaysRaw=document.getElementById('new_days_'+rid)?.value||'';
    var startDays=startDaysRaw?startDaysRaw.split(','):_DOW.slice();
    if(isAdmin){
      entries.push({isAdmin:true,driverNum:driverNum,name:name,rate:0,startTime:startTime,startDays:startDays});
    } else {
      var type=document.getElementById('newrow_type_'+rid)?.value||'TT';
      var rate=parseFloat(document.getElementById('new_rate_'+rid)?.value)||TRUCK_RATES[type]||92;
      entries.push({isAdmin:false,type:type,driverNum:driverNum,name:name,rate:rate,startTime:startTime,startDays:startDays});
    }
  });
  if(!entries.length){showToast('Enter at least one driver name');return;}
  var roster=getDriverRoster();
  // Recomputed at save time (in case the roster changed while the form was open),
  // then each type gets its own running counter so mixed TT/ST batches stay contiguous.
  // Admin/test entries skip this entirely - they never occupy a TT/ST slot.
  var counters={TT:_nextUnitNum(roster,'TT'),ST:_nextUnitNum(roster,'ST')};
  entries.forEach(function(e){
    if(e.isAdmin){
      roster.push({unit:'ADMIN',driverNum:e.driverNum,name:e.name,rate:0,isAdmin:true,startTime:e.startTime,startDays:e.startDays});
    } else {
      roster.push({unit:e.type+' '+counters[e.type],driverNum:e.driverNum,name:e.name,rate:e.rate,isAdmin:false,startTime:e.startTime,startDays:e.startDays});
      counters[e.type]++;
    }
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
  var rates={TT:tt,ST:st};
  if(TRUCK_RATES.TT!==tt||TRUCK_RATES.ST!==st)logChange('Truck rates','TT $'+TRUCK_RATES.TT+' \u2192 $'+tt+', ST $'+TRUCK_RATES.ST+' \u2192 $'+st);
  saveToStore('ei_truck_rates',JSON.stringify(rates));
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
  logChange('Shared manager #','Changed');
  if(msg){msg.style.color='var(--success)';msg.textContent='\u2713 Updated';document.getElementById('mgrPinCurrent').value='';document.getElementById('mgrPinNew').value='';}
}

// ── MANAGER ACCESS ROSTER ─────────────────────────────────────────────────────
function getManagerRoster(){try{var s=cacheGet('ei_manager_roster');if(s)return JSON.parse(s);}catch(e){}return[];}
function saveManagerRoster(r){saveToStore('ei_manager_roster',JSON.stringify(r));}
// Admin gate for the Manager Access screen (manager roster + change log).
// Until at least one manager is marked Admin, anyone logged in can open it
// (first-time setup); after that, only managers whose roster entry has
// isAdmin can. Checked against the live roster, so un-ticking Admin takes
// effect immediately.
function hasAnyMgrAdmin(){return getManagerRoster().some(function(m){return m.isAdmin&&m.badge;});}
function isMgrAdmin(){
  var u=(typeof currentMgr==='function')?currentMgr():null;
  if(!u||!u.badge)return false;
  return getManagerRoster().some(function(m){return m.isAdmin&&String(m.badge).trim().toUpperCase()===String(u.badge).toUpperCase();});
}
function canAccessManagerRoster(){return !hasAnyMgrAdmin()||isMgrAdmin();}
function showManagerAccess(){
  if(!canAccessManagerRoster()){showToast('\u26a0 Admin access required',3000);return;}
  renderManagerList();renderChangeLog();ss('managerAccess');
}
// Change log viewer (Manager Access screen): newest first, filter by manager
async function renderChangeLog(){
  var el=document.getElementById('changeLogList');if(!el)return;
  try{await apiRefresh('ei_change_log');}catch(e){} // best effort; falls back to cached copy
  var log=getChangeLog().slice().reverse();
  var sel=document.getElementById('changeLogWho');
  if(sel){
    var cur=sel.value,names=[];
    log.forEach(function(e){if(names.indexOf(e.by)<0)names.push(e.by);});
    sel.innerHTML='<option value="">All managers</option>'+names.sort().map(function(n){return '<option'+(n===cur?' selected':'')+'>'+_escAttr(n)+'</option>';}).join('');
    if(cur)log=log.filter(function(e){return e.by===cur;});
  }
  var shown=log.slice(0,300);
  if(!shown.length){el.innerHTML='<div style="text-align:center;padding:18px;color:var(--muted);font-size:13px">No changes logged yet.</div>';return;}
  el.innerHTML=shown.map(function(e){
    var d=new Date(e.at);
    var when=d.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' '+d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
    return '<div style="display:grid;grid-template-columns:110px 130px 150px 1fr;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px;align-items:start">'
      +'<div style="color:var(--muted)">'+when+'</div>'
      +'<div style="font-weight:700">'+_escAttr(e.by)+'</div>'
      +'<div style="color:var(--accent);font-weight:600">'+_escAttr(e.action)+'</div>'
      +'<div style="color:var(--text2)">'+_escAttr(e.detail)+'</div>'
      +'</div>';
  }).join('')+(log.length>shown.length?'<div style="font-size:11px;color:var(--muted);padding-top:8px">Showing newest 300 of '+log.length+'</div>':'');
}
function renderManagerList(){
  var roster=getManagerRoster(),el=document.getElementById('managerList');if(!el)return;
  if(!roster.length){el.innerHTML='<div style="text-align:center;padding:24px;color:var(--muted)">No managers yet. Click + Add to get started.</div>';return;}
  el.innerHTML='<div style="display:flex;align-items:center;gap:10px;padding:6px 0 8px;border-bottom:2px solid var(--border2)"><div style="flex:1;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted)">Manager Name</div><div style="width:130px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted)">Badge #</div><div style="width:60px"></div></div>'+
  roster.map(function(m,i){
    return '<div class="dl-row" id="mgrow_'+i+'" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><div style="flex:1;font-size:14px;font-weight:500">'+(m.name||'<span style="color:var(--muted);font-style:italic">Unnamed</span>')+(m.isAdmin?' <span style="font-size:10px;padding:2px 6px;border-radius:3px;background:var(--accent-light);color:var(--accent);font-weight:700;letter-spacing:.3px">ADMIN</span>':'')+'</div><div style="width:130px;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;color:var(--text2)">'+(m.badge?'#'+m.badge:'<span style="color:var(--muted)">&mdash;</span>')+'</div><button onclick="editManager('+i+')" style="height:34px;padding:0 14px;border-radius:5px;border:1.5px solid var(--accent);background:var(--accent-light);color:var(--accent);font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;cursor:pointer;touch-action:manipulation">Edit</button></div>';
  }).join('');
}
function editManager(i){
  var roster=getManagerRoster(),m=roster[i],row=document.getElementById('mgrow_'+i);if(!row)return;
  row.innerHTML='<div style="display:grid;grid-template-columns:1fr 130px auto auto auto auto;gap:8px;align-items:center;width:100%;padding:6px 0"><input type="text" id="emgr_name_'+i+'" value="'+_escAttr(m.name||'')+'" placeholder="Manager name" style="height:40px;padding:0 10px;border:1.5px solid var(--accent);border-radius:5px;font-size:14px;font-family:Barlow,sans-serif;width:100%"><input type="text" id="emgr_badge_'+i+'" value="'+_escAttr(m.badge||'')+'" placeholder="Badge #" inputmode="tel" style="height:40px;padding:0 10px;border:1.5px solid var(--accent);border-radius:5px;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;width:100%"><label style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:var(--text2);white-space:nowrap;cursor:pointer"><input type="checkbox" id="emgr_admin_'+i+'" '+(m.isAdmin?'checked':'')+'> Admin</label><button onclick="saveManagerEdit('+i+')" style="height:40px;padding:0 14px;border-radius:5px;border:none;background:var(--success);color:white;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;cursor:pointer;touch-action:manipulation">Save</button><button onclick="renderManagerList()" style="height:40px;padding:0 10px;border-radius:5px;border:1.5px solid var(--border2);background:var(--surface2);color:var(--text2);font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;cursor:pointer;touch-action:manipulation">Cancel</button><button onclick="removeManager('+i+')" style="height:40px;padding:0 10px;border-radius:5px;border:1.5px solid var(--danger);background:var(--danger-light);color:var(--danger);font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;cursor:pointer;touch-action:manipulation">&#128465;</button></div>';
  setTimeout(function(){document.getElementById('emgr_name_'+i)?.focus();},50);
}
function saveManagerEdit(i){
  var name=document.getElementById('emgr_name_'+i)?.value.trim(),badge=document.getElementById('emgr_badge_'+i)?.value.trim();
  if(!name){showToast('Manager name required');return;}
  var roster=getManagerRoster();
  var dupe=badge&&roster.some(function(m,j){return j!==i&&m.badge&&String(m.badge).trim().toUpperCase()===badge.toUpperCase();});
  if(dupe){showToast('\u26a0 Badge #'+badge+' is already assigned to another manager',4000);return;}
  var isAdmin=!!document.getElementById('emgr_admin_'+i)?.checked;
  if(isAdmin&&!badge){showToast('\u26a0 An admin needs a badge # to log in with',4000);return;}
  var prev=roster[i]||{};
  roster[i]={name:name,badge:badge,isAdmin:isAdmin};saveManagerRoster(roster);renderManagerList();showToast('\u2713 Manager updated');
  var notes=[];if(prev.name&&prev.badge!==badge)notes.push('badge changed');if(!!prev.isAdmin!==isAdmin)notes.push(isAdmin?'made admin':'admin removed');
  logChange('Manager roster',(prev.name?'Updated ':'Added ')+name+(notes.length?' ('+notes.join(', ')+')':''));
  renderMgrWho();
  // If you just removed your own admin access, leave the screen
  if(!canAccessManagerRoster()){showToast('This screen is now limited to admins',3000);ss('manager');}
}
function removeManager(i){
  var roster=getManagerRoster();if(!confirm('Remove '+(roster[i].name||'this manager')+'?'))return;var _gone=roster[i].name||'unnamed';roster.splice(i,1);saveManagerRoster(roster);renderManagerList();showToast('Manager removed');logChange('Manager roster','Removed '+_gone);
}
function addManagerRow(){
  var roster=getManagerRoster();roster.push({name:'',badge:''});saveManagerRoster(roster);renderManagerList();editManager(roster.length-1);
}
function saveManagers(){showToast('\u2713 Manager roster saved');setTimeout(function(){ss('manager');},600);}

function saveCustomerCode(){
  var code=document.getElementById('custCodeInput')?.value.trim().toUpperCase();
  if(!code){showToast('Please enter a code');return;}
  saveToStore('ei_customer_code',code); // saves to Supabase + all devices
  logChange('Customer access code','Changed');
  var msg=document.getElementById('custCodeMsg');
  if(msg){msg.textContent='\u2713 Updated to '+code;setTimeout(function(){msg.textContent='';},3000);}
  showToast('\u2713 Customer code updated');
}
