/**
 * api.js
 * API store layer — proxies data reads/writes through the Express server.
 * Falls back to localStorage when running as a standalone file.
 * Draft keys (ei_manifest_draft) always stay in localStorage.
 */


// ── API STORE (replaces localStorage for shared data) ─────────────────────────
// Draft keys stay in localStorage — everything else goes through the API
const DRAFT_ONLY_PREFIXES = ['ei_manifest_draft', 'ei_session'];
var _cache = {}; // in-memory cache so reads are instant after first load

async function apiGet(key) {
  if (_cache.hasOwnProperty(key)) return _cache[key];
  try {
    const res = await fetch('/api/store');
    if (res.ok) {
      const all = await res.json();
      Object.assign(_cache, all);
      return _cache[key] || null;
    }
  } catch(e) { console.log('apiGet error', e); }
  return null;
}

async function apiSet(key, value) {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  _cache[key] = str;
  // Always write to localStorage as backup for offline/local mode
  try { localStorage.setItem(key, str); } catch(e) {}
  // Also push to server if available
  try {
    await fetch('/api/store/' + encodeURIComponent(key), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: str })
    });
  } catch(e) { /* server not available - localStorage backup is enough */ }
}

async function apiDel(key) {
  delete _cache[key];
  try {
    await fetch('/api/store/' + encodeURIComponent(key), { method: 'DELETE' });
  } catch(e) { console.log('apiDel error', e); }
}

function cacheGet(key) {
  // Return from API cache if available, otherwise fall back to localStorage
  if (_cache.hasOwnProperty(key)) return _cache[key];
  return localStorage.getItem(key);
}

// Override localStorage-based getters/setters to use API cache
function getFromStore(key) { return cacheGet(key); }
function saveToStore(key, val) { apiSet(key, val); }
function deleteFromStore(key) { apiDel(key); }

let manifests=JSON.parse(cacheGet('ei_manifests')||'[]');
let mgrWeeks=[];
let mgrWeekIdx=-1;
let session=JSON.parse(sessionStorage.getItem('ei_session')||'null');
let delIds=[],puIds=[],rc=0;
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DO=['Monday','Tuesday','Wednesday','Thursday','Friday'];
const UNIT_MAP = {
  'Tom Hunt':      'TT 1',
  'Mike Plodzein': 'TT 2',
  'Dan Eckler':    'TT 3',
  'Ted Zervos':    'TT 4',
  'Juan Custodio': 'TT 5',
  'George Shemon': 'TT 6',
  'Sal Flores':    'TT 7',
  'Steve Herring': 'TT 8',
  'Rich Vecchio':  'TT 9',
  'Ricardo Orozco':'TT 10',
  'Jorge Osorio':  'TT 11',
  'Remon Khoshaba':'TT 12',
  'Bill Meager':   'ST 1',
  'Miguel G':      'ST 2',
  'Armando G':     'ST 3',
};
const ALL_DRIVERS = Object.keys(UNIT_MAP);

// Truck type rates - TT = Tractor Trailer, ST = Straight Truck
// These are program-wide rates based on truck type, not individual drivers
var TRUCK_RATES=JSON.parse(cacheGet('ei_truck_rates')||'{"TT":92,"ST":87}');
const RATE_TT=TRUCK_RATES.TT;
const RATE_ST=TRUCK_RATES.ST;

function rate(driverName){
  // Rate is based on the driver's unit type (TT or ST), not the driver themselves
  var roster=getDriverRoster?getDriverRoster():[];
  var driver=roster.find(function(d){return d.name===driverName;});
  if(driver&&driver.unit){
    var unitType=driver.unit.trim().toUpperCase().startsWith('ST')?'ST':'TT';
    return TRUCK_RATES[unitType]||TRUCK_RATES.TT;
  }
  // Fallback: check UNIT_MAP
  var unit=UNIT_MAP[driverName]||'';
  return unit.toUpperCase().startsWith('ST')?TRUCK_RATES.ST:TRUCK_RATES.TT;
}
function ss(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
  if(id==='driverForm'){startAutoSave();}
  else{stopAutoSave();}
  if(id==='home'){setTimeout(checkForDraft,150);}
}
function goHome(){
  saveDraft();
  ss(session?'home':'login');
  setTimeout(checkForDraft, 200);
}

// LOGIN
function doLogin(){
  const n=document.getElementById('loginName').value;
  const d=document.getElementById('loginNum').value.trim();
  const e=document.getElementById('loginErr');
  if(!n){e.textContent='Please select your name';return;}
  if(!d){e.textContent='Please enter your Driver #';return;}
  session={name:n,driverNum:d};
  sessionStorage.setItem('ei_session',JSON.stringify(session));
  e.textContent='';
  document.getElementById('homeWelcome').textContent='Welcome, '+n+' · Driver #'+d;
  ss('home');
}
function doLogout(){session=null;sessionStorage.removeItem('ei_session');document.getElementById('loginName').value='';document.getElementById('loginNum').value='';ss('login');}



function buildAllWeeks(){
  // Build every week from a fixed program start date to current week
  var pad=function(n){return String(n).padStart(2,'0');};
  var fmt=function(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
  var today=new Date();
  // Get Monday of current week
  var day=today.getDay();
  var thisMon=new Date(today);
  thisMon.setDate(today.getDate()-(day===0?6:day-1));

  // Start from earliest manifest OR program start (Jan 1 2025), whichever is earlier
  var dates=manifests.map(function(m){return m.date;}).filter(Boolean).sort();
  var programStart='2025-01-06'; // First Monday of 2025 - adjust as needed
  var earliest=dates.length&&dates[0]<programStart?dates[0]:programStart;
  var earliestDate=new Date(earliest+'T12:00:00');
  var ed=earliestDate.getDay();
  var earliestMon=new Date(earliestDate);
  earliestMon.setDate(earliestDate.getDate()-(ed===0?6:ed-1));

  // Generate every Monday from earliest to current week
  var weeks=[];
  var cur=new Date(earliestMon);
  while(cur<=thisMon){
    weeks.push(fmt(cur));
    cur.setDate(cur.getDate()+7);
  }
  return weeks.reverse(); // newest first - index 0 = most recent
}

function updateMgrWeekLabel(){
  var el=document.getElementById('mgrWeekLabel');
  if(!el)return;
  if(mgrWeekIdx<0||!mgrWeeks[mgrWeekIdx]){
    el.textContent='All Weeks';
    el.style.color='var(--muted)';
  } else {
    var mon=new Date(mgrWeeks[mgrWeekIdx]+'T12:00:00');
    var sun=new Date(mon); sun.setDate(mon.getDate()-1);
    var sat=new Date(mon); sat.setDate(mon.getDate()+5);
    function mf(d){return (d.getMonth()+1)+'/'+d.getDate();}
    el.textContent=mf(sun)+' – '+mf(sat);
    el.style.color='var(--accent)';
  }
}
function shiftMgrWeek(dir){
  if(!mgrWeeks.length)return;
  if(mgrWeekIdx<0){
    mgrWeekIdx=dir>0?mgrWeeks.length-1:0;
  } else {
    mgrWeekIdx+=dir;
    if(mgrWeekIdx<0)mgrWeekIdx=0;
    if(mgrWeekIdx>=mgrWeeks.length)mgrWeekIdx=mgrWeeks.length-1;
  }
  updateMgrWeekLabel();
  renderCards();
}
function setMgrWeekAll(){
  mgrWeekIdx=-1;
  updateMgrWeekLabel();
  renderCards();
}
function toggleGroup(el){
  var body=el.nextElementSibling;
  var arrow=el.querySelector('.dg-arrow');
  if(!body)return;
  var open=body.style.display==='block';
  body.style.display=open?'none':'block';
  if(arrow)arrow.style.transform=open?'':'rotate(180deg)';
}
function toggleCard(el){
  var card=el.closest('.mcard');
  var id=card?card.dataset.mid:'';
  if(!id)return;
  const exp=document.getElementById('expand_'+id);
  const arr=document.getElementById('arrow_'+id);
  if(!exp)return;
  const open=exp.style.display==='block';
  exp.style.display=open?'none':'block';
  if(arr)arr.style.transform=open?'':'rotate(180deg)';
}

// FORM
function onDateChange(){
  const d=document.getElementById('fDate').value;
  if(d){const dt=new Date(d+'T12:00:00');document.getElementById('frmMeta').textContent=DAYS[dt.getDay()]+' · '+dt.toLocaleDateString('en-US',{month:'short',day:'numeric'});}
}
function fmt12(t){if(!t)return'';const[h,m]=t.split(':').map(Number);const ap=h>=12?'p':'a';const h12=h>12?h-12:h===0?12:h;return m===0?h12+ap:h12+':'+String(m).padStart(2,'0')+ap;}
function calcMiles(){const s=parseInt(document.getElementById('fSMi').value)||0;const e=parseInt(document.getElementById('fEMi').value)||0;const m=e>s?e-s:0;document.getElementById('fTotMi').textContent=m>0?m:'—';updateTotals();}
function calcHours(){
  const s=document.getElementById('fStart').value,e=document.getElementById('fEnd').value;
  document.getElementById('tStart').textContent=s||'—';
  document.getElementById('tEnd').textContent=e||'—';
  if(s&&e){const[sh,sm]=s.split(':').map(Number),[eh,em]=e.split(':').map(Number);const h=(eh*60+em-sh*60-sm)/60-0.5;document.getElementById('tHrs').textContent=h>0?h.toFixed(2)+' hrs':'—';}
}
function updateTotals(){
  let dP=0,dW=0,pP=0,pW=0;
  delIds.forEach(id=>{dP+=parseInt(document.getElementById('dp_'+id)?.value)||0;dW+=parseFloat(document.getElementById('dw_'+id)?.value)||0;(delSubDrops[id]||[]).forEach(function(sid){dP+=parseInt(document.getElementById('sdpcs_'+sid)?.value)||0;dW+=parseFloat(document.getElementById('sdwt_'+sid)?.value)||0;});});
  puIds.forEach(id=>{pP+=parseInt(document.getElementById('pp_'+id)?.value)||0;pW+=parseFloat(document.getElementById('pw_'+id)?.value)||0;});
  document.getElementById('dCnt').textContent=delIds.length;document.getElementById('dPcs').textContent=dP.toLocaleString();document.getElementById('dWt').textContent=dW.toLocaleString();
  document.getElementById('delLbl').textContent=delIds.length+' stop'+(delIds.length!==1?'s':'');
  document.getElementById('pCnt').textContent=puIds.length;document.getElementById('pPcs').textContent=pP.toLocaleString();document.getElementById('pWt').textContent=pW.toLocaleString();
  document.getElementById('puLbl').textContent=puIds.length+' stop'+(puIds.length!==1?'s':'');
  document.getElementById('tDel').textContent=delIds.length;document.getElementById('tPU').textContent=puIds.length;// Count unique MAWBs for live display
  var liveRefs=[];
  delIds.forEach(function(id){var v=document.getElementById('dref_'+id)?.value.trim().toUpperCase();if(v)liveRefs.push(v);});
  puIds.forEach(function(id){var v=document.getElementById('pref_'+id)?.value.trim().toUpperCase();if(v)liveRefs.push(v);});
  var liveMAWBs=liveRefs.length>0?[...new Set(liveRefs)].length:delIds.length+puIds.length;
  document.getElementById('tShip').textContent=liveMAWBs;
  document.getElementById('tWt').textContent=(dW+pW).toLocaleString();
  const sm=parseInt(document.getElementById('fSMi').value)||0,em=parseInt(document.getElementById('fEMi').value)||0;
  document.getElementById('tMi').textContent=em>sm?em-sm:'—';
}
function updWt(id,t){const w=parseFloat(document.getElementById((t==='d'?'dw_':'pw_')+id)?.value)||0;const el=document.getElementById('rwt_'+id);if(el)el.textContent=w.toLocaleString();updateTotals();}

// ADD DELIVERY — order: Pro#, Shipper/Forwarder, Pieces, Weight, City, Consignee, Time In → Time Out
function addDel(){
  rc++;const id=rc;delIds.push(id);const n=delIds.length;
  const div=document.createElement('div');div.className='row-entry';div.id='row_'+id;
  div.innerHTML=`<div class="row-entry-head"><span class="row-num">Stop ${n}</span><span class="row-wt"><span id="rwt_${id}">0</span> <span>lbs</span></span><button class="rm-btn" onclick="rmRow(${id},'d')">&#215;</button></div>
  <div class="row-body">
    <div class="fg fg2" style="margin-bottom:8px">
      <div class="field"><label>Pro # / AWB # / Ref #</label><input type="text" id="dref_${id}" placeholder="Reference number" inputmode="tel" pattern="[0-9]*"></div>
      <div class="field"><label>Shipper / Forwarder</label><div class="auto-calc" style="font-size:14px;color:var(--text2)">Expeditors</div></div>
    </div>
    <div class="fg fg3" style="margin-bottom:8px">
      <div class="field"><label>Pieces *</label><input type="number" id="dp_${id}" placeholder="0" inputmode="tel" pattern="[0-9]*" oninput="updateTotals()"></div>
      <div class="field"><label>Weight (lbs) *</label><input type="number" id="dw_${id}" placeholder="0" inputmode="decimal" oninput="updWt(${id},'d')"></div>
      <div class="field"><label>City</label><input type="text" id="dcity_${id}" placeholder="City" autocapitalize="words" oninput="capWords(this)"></div>
    </div>
    <div class="field" style="margin-bottom:8px"><label>Consignee</label><input type="text" id="dcons_${id}" placeholder="Consignee / company name" autocapitalize="words" oninput="capWords(this)"></div>
    <div class="field"><label>Time In &rarr; Time Out — 24hr</label><div class="time-pair"><input type="time" id="dtin_${id}"><span>&rarr;</span><input type="time" id="dtout_${id}"></div></div>
    <div id="dnote_wrap_${id}" style="display:none;margin-top:8px"><div class="field"><label>Note</label><textarea id="dnote_${id}" placeholder="e.g. Sub driver, weight corrected..." rows="2" style="width:100%;padding:8px 10px;border:1.5px solid var(--warn);border-radius:6px;font-family:Barlow,sans-serif;font-size:14px;resize:vertical;background:var(--warn-light)"></textarea></div></div>
    <button class="add-note-btn" id="dnotebtn_${id}" onclick="toggleNote(\'dnote_wrap_${id}\', this)">&#128221; Add Note</button>
      <button class="add-note-btn" data-sid="${id}" onclick="addSubDrop(parseInt(this.dataset.sid),\'d\')" style="border-color:var(--accent2);color:var(--accent2);touch-action:manipulation">&#43; Add Another Drop</button>
    </div>
    <div id="delsubs_${id}"></div>
  </div>`;
  document.getElementById('delRows').appendChild(div);
  setTimeout(()=>div.scrollIntoView({behavior:'smooth',block:'center'}),100);updateTotals();
}

// ADD PICKUP — 4 steps: Shipment Info → At Shipper → Drop at 849/3400 → Deliver to Consignee
function addPU(){
  rc++;const id=rc;puIds.push(id);const n=puIds.length;
  const div=document.createElement('div');div.className='row-entry';div.id='row_'+id;
  div.innerHTML=`<div class="row-entry-head"><span class="row-num">Pick Up ${n}</span><span class="row-wt"><span id="rwt_${id}">0</span> <span>lbs</span></span><button class="rm-btn" onclick="rmRow(${id},'p')">&#215;</button></div>
  <div class="row-body">
    <div class="fsub" style="margin-bottom:10px">
      <div class="fsub-head">&#9312; Shipment Info</div>
      <div class="fsub-body">
        <div class="fg fg2" style="margin-bottom:8px">
          <div class="field"><label>Pro # / AWB # / Ref #</label><input type="text" id="pref_${id}" placeholder="Reference number" inputmode="tel" pattern="[0-9]*"></div>
          <div class="field"><label>Exp Ref #</label><input type="text" id="pexpref_${id}" placeholder="Expeditors ref #" autocapitalize="characters"></div>
        </div>
        <div class="fg fg3">
          <div class="field"><label>Pieces *</label><input type="number" id="pp_${id}" placeholder="0" inputmode="tel" pattern="[0-9]*" oninput="updateTotals()"></div>
          <div class="field"><label>Weight (lbs) *</label><input type="number" id="pw_${id}" placeholder="0" inputmode="decimal" oninput="updWt(${id},'p')"></div>
          <div class="field"><label>Shipper</label><input type="text" id="pship_${id}" placeholder="Shipper" autocapitalize="words" oninput="capWords(this)"></div>
        </div>
      </div>
    </div>
    <div class="fsub" style="margin-bottom:10px">
      <div class="fsub-head">&#9313; Pick Up &mdash; At Shipper Location</div>
      <div class="fsub-body">
        <div class="field"><label>Time In &rarr; Time Out — 24hr (at shipper)</label><div class="time-pair"><input type="time" id="ptin_${id}"><span>&rarr;</span><input type="time" id="ptout_${id}"></div></div>
        <div id="pusubs_${id}" style="margin-top:4px"></div>
        <button class="add-note-btn" onclick="addSubDrop(${id},\'p\')" style="margin-top:8px;border-color:var(--accent2);color:var(--accent2);touch-action:manipulation">+ Add Another Pick Up</button>
      </div>
    </div>
    <div class="fsub" style="margin-bottom:10px">
      <div class="fsub-head">&#9314; Drop Off at Expeditors (849 / 3400)</div>
      <div class="fsub-body">
        <div class="fg fg2" style="margin-bottom:8px">
          <div class="field"><label>Expeditors Location</label>
            <select id="pdrop_${id}"><option value="">Select...</option></select>
          </div>
          <div class="field"><label>Arrive &rarr; Depart Expeditors — 24hr</label><div class="time-pair" style="margin-top:5px"><input type="time" id="parr_${id}"><span>&rarr;</span><input type="time" id="pdep2_${id}"></div></div>
        </div>
      </div>
    </div>
    <div id="pnote_wrap_${id}" style="display:none;padding:10px 12px 0"><div class="field"><label>Note</label><textarea id="pnote_${id}" placeholder="e.g. Sub driver, pieces changed..." autocapitalize="sentences" rows="2" style="width:100%;padding:8px 10px;border:1.5px solid var(--warn);border-radius:6px;font-family:Barlow,sans-serif;font-size:14px;resize:vertical;background:var(--warn-light)"></textarea></div></div>
    <button class="add-note-btn" id="pnotebtn_${id}" onclick="toggleNote('pnote_wrap_${id}', this)" style="margin:10px 12px 12px;display:block">&#128221; Add Note</button>

  </div>`;
  document.getElementById('puRows').appendChild(div);
  buildDropLocationSelect('pdrop_'+id);
  setTimeout(()=>div.scrollIntoView({behavior:'smooth',block:'center'}),100);updateTotals();
}

function rmRow(id,t){const el=document.getElementById('row_'+id);if(el)el.remove();if(t==='d')delIds=delIds.filter(x=>x!==id);else puIds=puIds.filter(x=>x!==id);renum(t);updateTotals();}
function renum(t){const ids=t==='d'?delIds:puIds;const lbl=t==='d'?'Stop':'Pick Up';ids.forEach((id,i)=>{const h=document.querySelector('#row_'+id+' .row-num');if(h)h.textContent=lbl+' '+(i+1);});}

function startNewManifest(){
  // Check if there's a draft for today
  var draft=loadDraft();
  if(draft&&draft.driverName===( session?session.name:'')&&draft.date===localDateStr()){
    if(!confirm('You have an unfinished manifest for today. Starting a new one will discard it. Continue?'))return;
  }
  clearDraft();
  clearForm();
  if(session)document.getElementById('fName').value=session.name;
  document.getElementById('fDate').value=localDateStr();
  onDateChange();
  ss('driverForm');
}
function startForm(){startNewManifest();}
function clearForm(){['fTruck','fStart','fEnd','fSMi','fEMi'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});document.getElementById('fDate').value=localDateStr();document.getElementById('delRows').innerHTML='';document.getElementById('puRows').innerHTML='';delIds=[];puIds=[];['fTotMi','tMi','tHrs','tStart','tEnd'].forEach(id=>document.getElementById(id).textContent='—');updateTotals();onDateChange();}

function gD(id){return{proNum:document.getElementById('dref_'+id)?.value||'',shipper:document.getElementById('dship_'+id)?.value||'',pieces:parseInt(document.getElementById('dp_'+id)?.value)||0,weight:parseFloat(document.getElementById('dw_'+id)?.value)||0,city:document.getElementById('dcity_'+id)?.value||'',consignee:document.getElementById('dcons_'+id)?.value||'',timeIn:document.getElementById('dtin_'+id)?.value||'',timeOut:document.getElementById('dtout_'+id)?.value||'',note:document.getElementById('dnote_'+id)?.value.trim()||'',subDrops:getSubDrops(id,'d')};}
function gP(id){return{proNum:document.getElementById('pref_'+id)?.value||'',expRef:document.getElementById('pexpref_'+id)?.value||'',pieces:parseInt(document.getElementById('pp_'+id)?.value)||0,weight:parseFloat(document.getElementById('pw_'+id)?.value)||0,shipper:document.getElementById('pship_'+id)?.value||'',pickupIn:document.getElementById('ptin_'+id)?.value||'',pickupOut:document.getElementById('ptout_'+id)?.value||'',dropLocation:document.getElementById('pdrop_'+id)?.value||'',arriveExp:document.getElementById('parr_'+id)?.value||'',departExp:document.getElementById('pdep2_'+id)?.value||'',consignee:document.getElementById('pcons_'+id)?.value||'',deliverIn:document.getElementById('pdlin_'+id)?.value||'',deliverOut:document.getElementById('pdlout_'+id)?.value||'',note:document.getElementById('pnote_'+id)?.value.trim()||'',subPickups:getSubDrops(id,'p')};}

function submitManifest(){
  const name=document.getElementById('fName').value,truck=document.getElementById('fTruck').value.trim();
  const date=document.getElementById('fDate').value,st=document.getElementById('fStart').value,et=document.getElementById('fEnd').value;
  const sm=parseInt(document.getElementById('fSMi').value)||0,em=parseInt(document.getElementById('fEMi').value)||0;
  if(!truck){showToast('&#9888; Please enter your truck #',3000);return;}
  if(!date||!st||!et){showToast('&#9888; Date, start and end time required',3000);return;}
  if(!sm||!em){showToast('&#9888; Start and end mileage required',3000);return;}
  if(!delIds.length&&!puIds.length){showToast('&#9888; Add at least one delivery or pickup',3000);return;}
  for(const id of [...delIds,...puIds]){const wk=id;const wField=delIds.includes(id)?'dw_':'pw_';const pField=delIds.includes(id)?'dp_':'pp_';if(!(parseFloat(document.getElementById(wField+wk)?.value)||0)||!(parseInt(document.getElementById(pField+wk)?.value)||0)){showToast('&#9888; All stops need pieces and weight',3000);return;}}

  const dt=new Date(date+'T12:00:00');const dayOfWeek=DAYS[dt.getDay()];
  const totalMiles=em>sm?em-sm:0;
  const[sh,sm2]=st.split(':').map(Number),[eh,em2]=et.split(':').map(Number);
  const totalHours=Math.round(((eh*60+em2-sh*60-sm2)/60-0.5)*100)/100;
  const deliveries=delIds.map(id=>gD(id)),pickups=puIds.map(id=>gP(id));
  const totalWeight=deliveries.reduce((s,r)=>s+r.weight,0)+pickups.reduce((s,r)=>s+r.weight,0);
  // Count unique MAWBs (pro#/ref#) - each unique MAWB = one shipment
  var allRefs=[];
  deliveries.forEach(function(d){if(d.proNum&&d.proNum.trim())allRefs.push(d.proNum.trim().toUpperCase());});
  pickups.forEach(function(p){if(p.proNum&&p.proNum.trim())allRefs.push(p.proNum.trim().toUpperCase());});
  var uniqueMAWBs=allRefs.length>0?[...new Set(allRefs)].length:deliveries.length+pickups.length;
  const flags=[];
  if(totalMiles>300)flags.push('High mileage: '+totalMiles);
  if(totalWeight>100000)flags.push('Weight over 100,000 lbs — verify');
  if(totalHours<1||totalHours>14)flags.push('Unusual hours: '+totalHours);
  // Flag any notes
  var noteCount=0;
  deliveries.forEach(function(d){if(d.note)noteCount++;});
  pickups.forEach(function(p){if(p.note)noteCount++;});
  if(noteCount>0)flags.push(noteCount+' driver note'+(noteCount>1?'s':''));

  const m={id:Date.now().toString(),submittedAt:new Date().toISOString(),status:'pending',flags,driverName:name,driverNum:session?.driverNum||'',truckNum:truck,date,dayOfWeek,startTime:st,endTime:et,totalMiles,totalHours,ttlDeliveries:deliveries.length,ttlPickups:pickups.length,ttlShipments:uniqueMAWBs,ttlWeight:totalWeight,deliveries,pickups};
  manifests.push(m);saveToStore('ei_manifests',JSON.stringify(manifests));
  clearDraft();stopAutoSave();clearForm();showToast('&#10003; Manifest submitted!');setTimeout(function(){ss(session?'home':'login');checkForDraft();},1500);
}

// MANAGER
function refreshMgr(){
  manifests=JSON.parse(cacheGet('ei_manifests')||'[]');
  document.getElementById('stTot').textContent=manifests.length;
  document.getElementById('stPend').textContent=manifests.filter(m=>m.status==='pending').length;
  document.getElementById('stDrvs').textContent=new Set(manifests.map(m=>m.driverName)).size;
  document.getElementById('stFlgs').textContent=manifests.filter(m=>m.flags&&m.flags.length>0).length;
  // Build ALL weeks (even empty ones) from earliest to current
  mgrWeeks=buildAllWeeks();
  if(mgrWeekIdx<0&&mgrWeeks.length>0) mgrWeekIdx=0; // default to most recent
  if(mgrWeekIdx>=mgrWeeks.length) mgrWeekIdx=mgrWeeks.length-1;
  updateMgrWeekLabel();

  // Populate driver dropdown
  const sel=document.getElementById('fDrv'),cur=sel.value;
  sel.innerHTML='<option value="">All Drivers</option>';
  [...new Set(manifests.map(m=>m.driverName))].sort().forEach(n=>{const o=document.createElement('option');o.value=o.textContent=n;if(n===cur)o.selected=true;sel.appendChild(o);});
  renderCards();
}
function renderCards(){
  const fd=document.getElementById('fDrv').value;
  const fs=document.getElementById('fStat').value;
  const fdy=document.getElementById('fDy').value;
  const funit=document.getElementById('fUnit')?.value||'';
  var ffrom='',fto='';
  if(mgrWeekIdx>=0&&mgrWeeks[mgrWeekIdx]){
    ffrom=mgrWeeks[mgrWeekIdx];
    var _fri=new Date(ffrom+'T12:00:00');_fri.setDate(_fri.getDate()+4);
    fto=_fri.toISOString().split('T')[0];
  }

  let list=manifests.filter(function(m){
    if(fd&&m.driverName!==fd)return false;
    if(fs&&m.status!==fs)return false;
    if(fdy&&m.dayOfWeek!==fdy)return false;
    if(funit){var u=UNIT_MAP[m.driverName]||'';if(!u.startsWith(funit))return false;}
    if(ffrom&&m.date<ffrom)return false;
    if(fto&&m.date>fto)return false;
    return true;
  }).sort(function(a,b){return new Date(b.date)-new Date(a.date);});

  var c=document.getElementById('mCards');
  if(!list.length){
    c.innerHTML='<div class="no-data"><div style="font-size:40px;margin-bottom:12px">&#128203;</div><div style="font-family:Barlow Condensed,sans-serif;font-size:20px;font-weight:700;color:var(--text2)">No manifests found</div></div>';
    return;
  }

  // Group by driver name
  var groups={};
  list.forEach(function(m){
    if(!groups[m.driverName])groups[m.driverName]=[];
    groups[m.driverName].push(m);
  });

  var driverNames=Object.keys(groups).sort();

  c.innerHTML=driverNames.map(function(name){
    var entries=groups[name];
    var init=name.split(' ').map(function(w){return w[0];}).join('').slice(0,2);
    var unit=UNIT_MAP[name]||'';
    var r=rate(name);
    // Driver totals
    var totDel=0,totPU=0,totWt=0,totMi=0,totHrs=0;
    entries.forEach(function(m){totDel+=m.ttlDeliveries||0;totPU+=m.ttlPickups||0;totWt+=m.ttlWeight||0;totMi+=m.totalMiles||0;totHrs+=m.totalHours||0;});
    var totChg=totHrs*r;
    var anyPending=entries.some(function(m){return m.status==='pending';});
    var anyFlag=entries.some(function(m){return m.flags&&m.flags.length>0;});

    // Build daily rows for this driver
    var dayRows=entries.map(function(m){
      var ds=new Date(m.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
      var chg=(m.totalHours||0)*r;
      var acps=m.ttlShipments>0?chg/m.ttlShipments:0;
      var delRows=(m.deliveries||[]).map(function(d,i){
        return '<tr style="background:var(--surface2)"><td style="padding-left:24px">'+(i+1)+'</td><td style="font-family:monospace;font-size:11px">'+(d.proNum||'&mdash;')+'</td><td>'+(d.consignee||'&mdash;')+'</td><td>'+(d.city||'&mdash;')+'</td><td style="text-align:center">'+d.pieces+'</td><td style="text-align:center;font-weight:600">'+((d.weight||0).toLocaleString())+'</td><td style="font-size:11px">'+(d.timeIn||'&mdash;')+'&rarr;'+(d.timeOut||'&mdash;')+'</td>'+(d.note?'<td style="background:var(--warn-light);color:var(--warn);font-size:11px;font-weight:600">&#128221; '+d.note+'</td>':'<td></td>')+'</tr>';
      }).join('');
      var puRows=(m.pickups||[]).map(function(p,i){
        return '<tr style="background:var(--accent-light)"><td style="padding-left:24px">'+(i+1)+'</td><td style="font-family:monospace;font-size:11px">'+(p.proNum||'&mdash;')+'</td><td>'+(p.shipper||'&mdash;')+'</td><td style="text-align:center">'+p.pieces+'</td><td style="text-align:center;font-weight:600">'+((p.weight||0).toLocaleString())+'</td><td style="font-size:11px">PU: '+(p.pickupIn||'&mdash;')+'&rarr;'+(p.pickupOut||'&mdash;')+'</td><td style="font-size:11px">'+(p.dropLocation||'&mdash;')+': '+(p.arriveExp||'&mdash;')+'&rarr;'+(p.departExp||'&mdash;')+'</td>'+(p.note?'<td style="background:var(--warn-light);color:var(--warn);font-size:11px;font-weight:600">&#128221; '+p.note+'</td>':'<td></td>')+'</tr>';
      }).join('');
      var detailTbls='';
      if(m.deliveries&&m.deliveries.length){
        detailTbls+='<div style="padding:0 12px 8px"><div style="font-family:Barlow Condensed,sans-serif;font-size:12px;font-weight:700;color:var(--accent);letter-spacing:.5px;text-transform:uppercase;padding:6px 0 4px">Deliveries</div><div style="overflow-x:auto"><table class="det-tbl"><thead><tr><th>#</th><th>Ref #</th><th>Consignee</th><th>City</th><th style="text-align:center">Pcs</th><th style="text-align:center">Wt</th><th>Times</th></tr></thead><tbody>'+delRows+'</tbody></table></div></div>';
      }
      if(m.pickups&&m.pickups.length){
        detailTbls+='<div style="padding:0 12px 8px"><div style="font-family:Barlow Condensed,sans-serif;font-size:12px;font-weight:700;color:var(--accent);letter-spacing:.5px;text-transform:uppercase;padding:6px 0 4px">Pick Ups</div><div style="overflow-x:auto"><table class="det-tbl"><thead><tr><th>#</th><th>Ref #</th><th>Shipper</th><th style="text-align:center">Pcs</th><th style="text-align:center">Wt</th><th>PU Times</th><th>Drop Times</th></tr></thead><tbody>'+puRows+'</tbody></table></div></div>';
      }

      return '<div class="day-entry" id="dentry_'+m.id+'" style="border-top:1px solid var(--border)">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--surface2)">'+
          '<div>'+
            '<div style="font-family:Barlow Condensed,sans-serif;font-size:16px;font-weight:700">'+m.dayOfWeek+' &middot; '+ds+'</div>'+
            '<div style="font-size:11px;color:var(--muted);margin-top:2px">Truck '+( m.truckNum||'&mdash;')+' &middot; '+m.startTime+' &rarr; '+m.endTime+' &middot; '+m.totalHours+' hrs</div>'+
          '</div>'+
          '<div style="display:flex;gap:10px;align-items:center">'+
            '<span style="font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;color:var(--accent)">$'+chg.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</span>'+
            '<span class="mbadge '+(m.status==='reviewed'?'br':'bp')+'">'+m.status.toUpperCase()+'</span>'+
          '</div>'+
        '</div>'+
        '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0;border-bottom:1px solid var(--border)">'+
          '<div class="cs" style="padding:8px;border-right:1px solid var(--border)"><div class="cs-val">'+m.ttlDeliveries+'</div><div class="cs-lbl">Del</div></div>'+
          '<div class="cs" style="padding:8px;border-right:1px solid var(--border)"><div class="cs-val">'+m.ttlPickups+'</div><div class="cs-lbl">PU</div></div>'+
          '<div class="cs" style="padding:8px;border-right:1px solid var(--border)"><div class="cs-val">'+((m.ttlWeight||0).toLocaleString())+'</div><div class="cs-lbl">lbs</div></div>'+
          '<div class="cs" style="padding:8px;border-right:1px solid var(--border)"><div class="cs-val">'+(m.totalMiles||0)+'</div><div class="cs-lbl">Miles</div></div>'+
          '<div class="cs" style="padding:8px"><div class="cs-val">$'+acps.toFixed(2)+'</div><div class="cs-lbl">$/Ship</div></div>'+
        '</div>'+
        detailTbls+
        '<div style="display:flex;gap:8px;padding:10px 14px;border-top:1px solid var(--border)">'+
          '<button class="ea-btn ea-del" title="Delete manifest" data-mid="'+m.id+'" onclick="if(confirm(\'Delete this manifest?\'))delM(this.dataset.mid)">&#128465;</button>'+
          '<button class="ea-btn ea-ok" style="font-size:13px;height:36px" data-mid="'+m.id+'" onclick="appM(this.dataset.mid)">'+(m.status==='reviewed'?'&#10003; Reviewed':'Mark Reviewed &#10003;')+'</button>'+
        '</div>'+
      '</div>';
    }).join('');

    return '<div class="driver-group" data-gid="'+name+'">'+
      '<div class="dg-header" onclick="toggleGroup(this)">'+
        '<div class="avatar">'+init+'</div>'+
        '<div style="flex:1">'+
          '<div class="mcard-driver">'+name+' <span style="font-size:11px;color:var(--muted);font-weight:400">&middot; '+unit+'</span></div>'+
          '<div class="mcard-meta">'+entries.length+' day'+(entries.length!==1?'s':'')+' &middot; '+totDel+' del &middot; '+totPU+' PU &middot; '+totWt.toLocaleString()+' lbs &middot; '+totMi+' mi</div>'+
        '</div>'+
        '<div style="display:flex;align-items:center;gap:8px">'+
          (anyFlag?'<span style="font-size:16px" title="Has flags">&#9888;</span>':'')+
          '<span class="mbadge '+(anyPending?'bp':'br')+'">'+(anyPending?'PENDING':'REVIEWED')+'</span>'+
          '<div style="font-family:Barlow Condensed,sans-serif;font-size:17px;font-weight:800;color:var(--accent)">$'+totChg.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</div>'+
          '<span class="dg-arrow" style="color:var(--muted);font-size:20px;transition:transform .25s;display:inline-block">&#8964;</span>'+
        '</div>'+
      '</div>'+
      '<div class="dg-body" style="display:none">'+dayRows+'</div>'+
    '</div>';
  }).join('');
}


function openMod(id){
  const m=manifests.find(x=>x.id===id);if(!m)return;
  const r=rate(m.driverName),chg=(m.totalHours||0)*r;
  const ds=new Date(m.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const fh=m.flags&&m.flags.length>0?m.flags.map(f=>`<div class="flag-bar" style="margin:0 0 8px">&#9888; ${f}</div>`).join(''):'<div style="color:var(--success);font-size:12px;margin-bottom:10px">&#10003; No flags</div>';
  const delH=m.deliveries.length?`<div style="font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;margin:12px 0 6px">DELIVERIES</div><div style="overflow-x:auto"><table class="det-tbl"><thead><tr><th>#</th><th>Ref #</th><th>Consignee</th><th>City</th><th style="text-align:center">Pcs</th><th style="text-align:center">Wt (lbs)</th><th>Times</th></tr></thead><tbody>${m.deliveries.map((d,i)=>`<tr><td>${i+1}</td><td>${d.proNum||'&mdash;'}</td><td>${d.consignee||'&mdash;'}</td><td>${d.city||'&mdash;'}</td><td style="text-align:center">${d.pieces}</td><td style="text-align:center;font-weight:600">${d.weight.toLocaleString()}</td><td>${d.timeIn||'&mdash;'}&rarr;${d.timeOut||'&mdash;'}</td></tr>`).join('')}</tbody></table></div>`:'';
  const puH=m.pickups.length?`<div style="font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;margin:12px 0 6px">PICK UPS</div>${m.pickups.map((p,i)=>`<div style="border:1.5px solid var(--border);border-radius:6px;margin-bottom:8px;overflow:hidden;font-size:12px"><div style="background:var(--surface2);padding:7px 10px;font-weight:700;color:var(--accent);font-family:Barlow Condensed,sans-serif;font-size:13px">Pick Up ${i+1}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px 10px 4px;text-align:center;border-bottom:1px solid var(--border)"><div><div style="font-family:Barlow Condensed,sans-serif;font-size:20px;font-weight:700;color:var(--accent)">${p.pieces}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Pieces</div></div><div><div style="font-family:Barlow Condensed,sans-serif;font-size:20px;font-weight:700;color:var(--accent)">${p.weight.toLocaleString()}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Weight (lbs)</div></div></div><div style="padding:8px 10px;display:grid;gap:5px"><div><b>Ref:</b> ${p.proNum||'&mdash;'} &nbsp;<b>Exp:</b> ${p.expRef||'&mdash;'} &nbsp;<b>Shipper:</b> ${p.shipper||'&mdash;'}</div><div>&#9313; <b>At Shipper:</b> In ${p.pickupIn||'&mdash;'} &rarr; Out ${p.pickupOut||'&mdash;'}</div><div>&#9314; <b>Drop at Expeditors ${p.dropLocation||'&mdash;'}:</b> Arrive ${p.arriveExp||'&mdash;'} &rarr; Depart ${p.departExp||'&mdash;'}</div></div></div>`).join('')}`:'';
  document.getElementById('modContent').innerHTML=`<h2>${m.driverName} &mdash; ${m.dayOfWeek}</h2>
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px">${ds} &middot; Truck ${m.truckNum||'&mdash;'} &middot; Driver #${m.driverNum||'&mdash;'}</div>${fh}
    <div class="det-grid">
      <div class="det-item"><div class="det-lbl">Deliveries</div><div class="det-val">${m.ttlDeliveries}</div></div>
      <div class="det-item"><div class="det-lbl">Pick Ups</div><div class="det-val">${m.ttlPickups}</div></div>
      <div class="det-item"><div class="det-lbl">Shipments</div><div class="det-val">${m.ttlShipments}</div></div>
      <div class="det-item"><div class="det-lbl">Total Weight</div><div class="det-val">${(m.ttlWeight||0).toLocaleString()} lbs</div></div>
      <div class="det-item"><div class="det-lbl">Total Miles</div><div class="det-val">${m.totalMiles}</div></div>
      <div class="det-item"><div class="det-lbl">Total Hours</div><div class="det-val">${m.totalHours}</div></div>
      <div class="det-item"><div class="det-lbl">Start &rarr; End</div><div class="det-val">${m.startTime} &rarr; ${m.endTime}</div></div>
      <div class="det-item"><div class="det-lbl">Charges ($${r}/hr)</div><div class="det-val" style="color:var(--accent)">$${chg.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
    </div>${delH}${puH}
    <div class="modal-actions">
      <button class="mbtn mbtn-del" onclick="delM('${id}')">&#128465; Delete</button>
      <button class="mbtn mbtn-ok" onclick="appM('${id}')">${m.status==='reviewed'?'&#10003; Reviewed':'Mark Reviewed &#10003;'}</button>
    </div>`;
  document.getElementById('modOv').classList.add('open');
}
function closeMod(e){if(e.target===document.getElementById('modOv'))document.getElementById('modOv').classList.remove('open');}
function appM(id){
  const m=manifests.find(x=>x.id===id);
  if(!m)return;
  m.status='reviewed';
  save();
  // Find which driver group this belongs to so we can re-open it
  var driverName=m.driverName;
  // Update just the button and badge without re-rendering everything
  var btn=document.querySelector('[data-mid="'+id+'"].ea-btn.ea-ok');
  if(btn){btn.textContent='&#10003; Reviewed';}
  var badge=btn?btn.closest('.day-entry')?.querySelector('.mbadge'):null;
  if(badge){badge.className='mbadge br';badge.textContent='REVIEWED';}
  // Update the driver group header badge if all are now reviewed
  var group=btn?btn.closest('.driver-group'):null;
  if(group){
    var allReviewed=Array.from(group.querySelectorAll('.day-entry')).every(function(de){
      return de.querySelector('.mbadge.br');
    });
    var groupBadge=group.querySelector('.dg-header .mbadge');
    if(groupBadge&&allReviewed){groupBadge.className='mbadge br';groupBadge.textContent='REVIEWED';}
  }
  // Update stats counts
  document.getElementById('stPend').textContent=manifests.filter(m=>m.status==='pending').length;
  showToast('&#10003; Marked reviewed');
}
function delM(id){if(!confirm('Delete this manifest?'))return;manifests=manifests.filter(m=>m.id!==id);save();document.getElementById('modOv').classList.remove('open');refreshMgr();showToast('Deleted');}
function clearAll(){if(!confirm('Delete ALL manifests? Cannot be undone.'))return;manifests=[];save();refreshMgr();showToast('All cleared');}
function save(){saveManifests();}

// WEEKLY SUMMARY
function getMon(d){const dt=new Date(d+'T12:00:00');const dy=dt.getDay();dt.setDate(dt.getDate()+(dy===0?-6:1-dy));return dt.toISOString().split('T')[0];}
function fs(d){return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});}
function ff(d){return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}
function wkLbl(mon){const fri=new Date(mon+'T12:00:00');fri.setDate(fri.getDate()+4);return ff(mon)+' &ndash; '+ff(fri.toISOString().split('T')[0]);}
function allWks(){const w=new Set();manifests.forEach(m=>{if(m.date)w.add(getMon(m.date));});return[...w].sort().reverse();}

function showSum(){
  const wks=allWks();const sel=document.getElementById('weekSel');const cur=sel.value;
  if(!wks.length){sel.innerHTML='<option value="">No data yet</option>';}
  else{sel.innerHTML=wks.map(w=>`<option value="${w}" ${w===cur?'selected':''}>${wkLbl(w)}</option>`).join('');if(!cur||!wks.includes(cur))sel.value=wks[0];}
  renderSum();ss('summary');
}
function shiftW(dir){const sel=document.getElementById('weekSel');const opts=[...sel.options];const idx=opts.findIndex(o=>o.value===sel.value);const ni=idx-dir;if(ni>=0&&ni<opts.length){sel.value=opts[ni].value;renderSum();}}

function renderSum(){
  const mon=document.getElementById('weekSel').value;
  const el=document.getElementById('sumContent'),ml=document.getElementById('sumMeta');
  if(!mon){el.innerHTML='<div class="no-data"><div style="font-size:36px;margin-bottom:10px">&#128203;</div><div style="font-family:Barlow Condensed,sans-serif;font-size:20px;font-weight:700">No data yet</div></div>';return;}
  const fri=new Date(mon+'T12:00:00');fri.setDate(fri.getDate()+4);const friday=fri.toISOString().split('T')[0];
  if(ml)ml.textContent='W/E '+fs(friday);

  // Aggregate each driver's full week
  const wm=manifests.filter(m=>m.date>=mon&&m.date<=friday);
  const dm={};
  wm.forEach(m=>{
    if(!dm[m.driverName]){dm[m.driverName]={del:0,pu:0,ship:0,wt:0,mi:0,hrs:0};}
    dm[m.driverName].del  += m.ttlDeliveries||0;
    dm[m.driverName].pu   += m.ttlPickups||0;
    dm[m.driverName].ship += m.ttlShipments||0;
    dm[m.driverName].wt   += m.ttlWeight||0;
    dm[m.driverName].mi   += m.totalMiles||0;
    dm[m.driverName].hrs  += m.totalHours||0;
  });

  // Grand totals
  let gD=0,gP=0,gS=0,gW=0,gM=0,gH=0,gC=0;
  ALL_DRIVERS.forEach(name=>{
    const d=dm[name];if(!d)return;
    const r=rate(name);const c=d.hrs*r;
    gD+=d.del;gP+=d.pu;gS+=d.ship;gW+=d.wt;gM+=d.mi;gH+=d.hrs;gC+=c;
  });

  // Program-level stats (match spreadsheet exactly)
  const avgCostPerShip  = gS>0  ? gC/gS  : 0;
  const avgCostPerLb    = gW>0  ? gC/gW  : 0;
  const avgShipPerHour  = gH>0  ? gS/gH  : 0;
  const avgMilesPerDay  = gM/5;
  const avgCostPerMile  = gM>0  ? gC/gM  : 0;

  // Build table rows — ALL drivers in order, zero rows for those with no data
  const rowsHtml = ALL_DRIVERS.map(name=>{
    const d=dm[name];
    const r=rate(name);
    const unit=UNIT_MAP[name];
    if(!d){
      return `<tr class="zero-row">
        <td>${unit}</td><td>${name}</td>
        <td>0</td><td>0</td><td>0</td>
        <td>0</td><td>0</td><td>0.00</td>
        <td>$0.00</td>
      </tr>`;
    }
    const c=d.hrs*r;
    const hasData = d.ship > 0;
    return `<tr class="${hasData?'data-row':'zero-row'}">
      <td><strong>${unit}</strong></td><td>${name}</td>
      <td>${d.del}</td><td>${d.pu}</td><td>${d.ship}</td>
      <td>${d.wt.toLocaleString()}</td><td>${d.mi}</td>
      <td>${d.hrs.toFixed(2)}</td>
      <td class="chg-cell">$${c.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
  <div class="sum-report">
    <div class="sum-report-head">
      <div class="srh-title">Expeditors Cartage Program</div>
      <div class="srh-week">Summary Week Ending &nbsp;<strong>${fs(friday)}</strong></div>
    </div>

    <div style="overflow-x:auto">
      <table class="sum-tbl">
        <thead>
          <tr>
            <th>Unit</th><th>Driver</th>
            <th>TTL Deliveries</th><th>TTL Pick Ups</th><th>TTL Shipments</th>
            <th>TTL Weight - LBS</th><th>TTL Miles</th><th>TTL Hours</th>
            <th>Charges</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="2"><strong>TOTAL</strong></td>
            <td>${gD}</td><td>${gP}</td><td>${gS}</td>
            <td>${gW.toLocaleString()}</td><td>${gM}</td>
            <td>${gH.toFixed(2)}</td>
            <td class="chg-cell">$${gC.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div class="sum-stats">
      <div class="ss-row"><div class="ss-lbl">Average Cost Per Shipment</div><div class="ss-val">$${avgCostPerShip.toFixed(2)}</div></div>
      <div class="ss-row"><div class="ss-lbl">Average Cost Per Pound</div><div class="ss-val">$${avgCostPerLb.toFixed(4)}</div></div>
      <div class="ss-row"><div class="ss-lbl">Average Shipments Per Hour</div><div class="ss-val">${avgShipPerHour.toFixed(2)}</div></div>
      <div class="ss-row"><div class="ss-lbl">Average Miles Per Day</div><div class="ss-val">${avgMilesPerDay.toFixed(1)}</div></div>
      <div class="ss-row"><div class="ss-lbl">Average Cost Per Mile</div><div class="ss-val">$${avgCostPerMile.toFixed(2)}</div></div>
    </div>
  </div>`;
}

function dlWeekly(){
  const mon=document.getElementById('weekSel').value;if(!mon){showToast('No week selected');return;}
  const fri=new Date(mon+'T12:00:00');fri.setDate(fri.getDate()+4);const friday=fri.toISOString().split('T')[0];
  const wm=manifests.filter(m=>m.date>=mon&&m.date<=friday);
  const dm={};wm.forEach(m=>{if(!dm[m.driverName])dm[m.driverName]=[];dm[m.driverName].push(m);});
  const drivers=Object.keys(dm).sort();
  let gD=0,gP=0,gS=0,gW=0,gM=0,gH=0,gC=0;
  drivers.forEach(n=>{const r=rate(n);dm[n].forEach(m=>{gD+=m.ttlDeliveries||0;gP+=m.ttlPickups||0;gS+=m.ttlShipments||0;gW+=m.ttlWeight||0;gM+=m.totalMiles||0;gH+=m.totalHours||0;gC+=(m.totalHours||0)*r;});});
  let csv=`EI Cartage Weekly Summary - Week Ending ${fs(friday)}\n\nPROGRAM TOTALS\nTTL Deliveries,TTL Pick Ups,TTL Shipments,TTL Weight (lbs),TTL Miles,TTL Hours,TTL Charges\n${gD},${gP},${gS},${gW},${gM},${gH.toFixed(2)},$${gC.toFixed(2)}\n\nDRIVER BREAKDOWN\nDriver,Day,TTL Deliveries,TTL Pick Ups,TTL Shipments,TTL Weight (lbs),TTL Miles,Start Time,End Time,TTL Hours,Charges,Avg Cost/Ship,Avg Cost/lb,Ships/Hr,Avg Mi/Day\n`;
  drivers.forEach(name=>{
    const r=rate(name);const dd={};dm[name].forEach(m=>{dd[m.dayOfWeek]=m;});
    let wD=0,wP=0,wS=0,wW=0,wM=0,wH=0;
    DO.forEach(day=>{const m=dd[day];if(m){const c=(m.totalHours||0)*r;csv+=`${name},${day},${m.ttlDeliveries||0},${m.ttlPickups||0},${m.ttlShipments||0},${m.ttlWeight||0},${m.totalMiles||0},${m.startTime||''},${m.endTime||''},${m.totalHours||0},$${c.toFixed(2)},,,, \n`;wD+=m.ttlDeliveries||0;wP+=m.ttlPickups||0;wS+=m.ttlShipments||0;wW+=m.ttlWeight||0;wM+=m.totalMiles||0;wH+=m.totalHours||0;}else{csv+=`${name},${day},0,0,0,0,0,,,0,$0.00,,,,\n`;}});
    const wC=wH*r,acps=wS>0?wC/wS:0,acpl=wW>0?wC/wW:0,asph=wH>0?wS/wH:0,amd=wM/5;
    csv+=`${name},WEEKLY TOTAL,${wD},${wP},${wS},${wW},${wM},,${wH.toFixed(2)},$${wC.toFixed(2)},$${acps.toFixed(2)},$${acpl.toFixed(4)},${asph.toFixed(2)},${amd.toFixed(1)}\n\n`;
  });
  const blob=new Blob([csv],{type:'text/csv'});const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`EI_Cartage_WE_${fs(friday).replace(' ','-').replace(',','')}.csv`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  showToast('Downloaded - week ending '+fs(friday));
}

let toastT;
function showToast(msg,dur=2200){const t=document.getElementById('toast');t.innerHTML=msg;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),dur);}

// INIT
