/**
 * form.js
 * Manifest entry form — trip info, delivery rows, pickup rows,
 * sub-drops, notes, auto-capitalization, and form submission.
 */


// ── NOTES ─────────────────────────────────────────────────────────────────────
function toggleNote(wrapId,btn){
  var wrap=document.getElementById(wrapId);if(!wrap)return;
  var open=wrap.style.display==='block';
  wrap.style.display=open?'none':'block';
  btn.textContent=open?'\ud83d\uddd1 Add Note':'\u274c Remove Note';
  btn.style.background=open?'':'var(--warn-light)';btn.style.borderColor=open?'':'var(--warn)';btn.style.color=open?'':'var(--warn)';
  if(!open)setTimeout(function(){wrap.querySelector('textarea')?.focus();},50);
}

// ── SUB-DROPS ─────────────────────────────────────────────────────────────────
var delSubDrops={},puSubDrops={},subRc=0;
function addSubDrop(stopId,type){
  subRc++;var sid=subRc;
  if(type==='d'){if(!delSubDrops[stopId])delSubDrops[stopId]=[];delSubDrops[stopId].push(sid);}
  else{if(!puSubDrops[stopId])puSubDrops[stopId]=[];puSubDrops[stopId].push(sid);}
  var container=document.getElementById((type==='d'?'del':'pu')+'subs_'+stopId);if(!container)return;
  var ids=type==='d'?delSubDrops[stopId]:puSubDrops[stopId],n=ids.length;
  var div=document.createElement('div');div.id='subdrop_'+sid;div.style.cssText='border-top:1px dashed var(--border2);padding:10px 0 4px;margin-top:8px';
  if(type==='d'){
    div.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><span style="font-family:Barlow Condensed,sans-serif;font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.5px">Additional Drop '+n+'</span><button data-sid="'+sid+'" data-stopid="'+stopId+'" data-type="'+type+'" onclick="removeSubDrop(parseInt(this.dataset.sid),parseInt(this.dataset.stopid),this.dataset.type)" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;padding:2px 6px;touch-action:manipulation">&#215;</button></div><div class="fg fg3"><div class="field"><label>Pro # / AWB # / Ref #</label><input type="text" id="sdref_'+sid+'" placeholder="Reference number" inputmode="tel" style="height:46px;padding:0 12px;border:1.5px solid var(--border);border-radius:6px;font-size:15px;width:100%"></div><div class="field"><label>Pieces</label><input type="number" id="sdpcs_'+sid+'" placeholder="0" inputmode="tel" oninput="updateTotals()" style="height:46px;padding:0 12px;border:1.5px solid var(--border);border-radius:6px;font-size:15px;width:100%"></div><div class="field"><label>Weight (lbs)</label><input type="number" id="sdwt_'+sid+'" placeholder="0" inputmode="decimal" oninput="updateTotals()" style="height:46px;padding:0 12px;border:1.5px solid var(--border);border-radius:6px;font-size:15px;width:100%"></div></div><div style="margin-top:6px;font-size:11px;color:var(--muted)">&#9432; Consignee, city &amp; times same as above</div>';
  }else{
    div.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><span style="font-family:Barlow Condensed,sans-serif;font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.5px">Additional Pick Up '+n+'</span><button data-sid="'+sid+'" data-stopid="'+stopId+'" data-type="'+type+'" onclick="removeSubDrop(parseInt(this.dataset.sid),parseInt(this.dataset.stopid),this.dataset.type)" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;padding:2px 6px;touch-action:manipulation">&#215;</button></div><div class="fg fg2" style="margin-bottom:8px"><div class="field"><label>Consignee</label><input type="text" id="sdcons_'+sid+'" placeholder="Consignee" autocapitalize="characters" oninput="this.value=this.value.toUpperCase()" style="height:46px;padding:0 12px;border:1.5px solid var(--border);border-radius:6px;font-size:15px;width:100%"></div><div class="field"><label>City</label><input type="text" id="sdcity_'+sid+'" placeholder="City" autocapitalize="characters" oninput="this.value=this.value.toUpperCase()" style="height:46px;padding:0 12px;border:1.5px solid var(--border);border-radius:6px;font-size:15px;width:100%"></div></div><div class="field"><label>Time In &rarr; Time Out</label><div class="time-pair"><input type="time" id="sdtin_'+sid+'"><span>&rarr;</span><input type="time" id="sdtout_'+sid+'"></div></div>';
  }
  container.appendChild(div);
  // Move the "Add Another Drop" button to below the new drop
  if(type==='d'){
    var addBtn=document.getElementById('adddrop_'+stopId);
    if(addBtn){
      // Move button to after the container
      container.parentNode.insertBefore(addBtn, container.nextSibling);
    }
  }
  setTimeout(function(){div.scrollIntoView({behavior:'smooth',block:'center'});},100);
}
function removeSubDrop(sid,stopId,type){
  var el=document.getElementById('subdrop_'+sid);if(el)el.remove();
  if(type==='d'&&delSubDrops[stopId])delSubDrops[stopId]=delSubDrops[stopId].filter(function(x){return x!==sid;});
  else if(puSubDrops[stopId])puSubDrops[stopId]=puSubDrops[stopId].filter(function(x){return x!==sid;});
}
function getSubDrops(stopId,type){
  var ids=type==='d'?(delSubDrops[stopId]||[]):(puSubDrops[stopId]||[]);
  return ids.map(function(sid){
    if(type==='d')return{proNum:document.getElementById('sdref_'+sid)?.value||'',pieces:parseInt(document.getElementById('sdpcs_'+sid)?.value)||0,weight:parseFloat(document.getElementById('sdwt_'+sid)?.value)||0};
    return{consignee:document.getElementById('sdcons_'+sid)?.value||'',city:document.getElementById('sdcity_'+sid)?.value||'',timeIn:document.getElementById('sdtin_'+sid)?.value||'',timeOut:document.getElementById('sdtout_'+sid)?.value||''};
  });
}

// ── AUTO CAPITALIZE ───────────────────────────────────────────────────────────
function capWords(el){
  var v=el.value,pos=el.selectionStart;
  var c=v.replace(/(^|\s)([a-z])/g,function(m,p1,p2){return p1+p2.toUpperCase();});
  if(c!==v){el.value=c;try{el.setSelectionRange(pos,pos);}catch(e){}}
}

function onDateChange(){
  const d=document.getElementById('fDate').value;
  if(d){const dt=new Date(d+'T12:00:00');document.getElementById('frmMeta').textContent=DAYS[dt.getDay()]+' · '+dt.toLocaleDateString('en-US',{month:'short',day:'numeric'});}
}

function fmt12(t){if(!t)return'';const[h,m]=t.split(':').map(Number);const ap=h>=12?'p':'a';const h12=h>12?h-12:h===0?12:h;return m===0?h12+ap:h12+':'+String(m).padStart(2,'0')+ap;}

function calcMiles(){const s=parseInt(document.getElementById('fSMi').value)||0;const e=parseInt(document.getElementById('fEMi').value)||0;const m=e>s?e-s:0;document.getElementById('fTotMi').textContent=m>0?m:'—';updateTotals();}

function calcHours(){
  var s=document.getElementById('fStart').value,e=document.getElementById('fEnd').value;
  document.getElementById('tStart').textContent=s||'—';
  document.getElementById('tEnd').textContent=e||'—';
  if(s&&e){
    var sp=s.split(':').map(Number),ep=e.split(':').map(Number);
    var startMin=sp[0]*60+sp[1];
    var endMin=ep[0]*60+ep[1];
    // If end is before or equal to start, driver worked past midnight — add 24hrs
    if(endMin<=startMin) endMin+=1440;
    var h=(endMin-startMin)/60-0.5; // subtract 0.5hr break
    document.getElementById('tHrs').textContent=h>0?h.toFixed(2)+' hrs':'—';
  }
}

function updateTotals(){
  let dP=0,dW=0,pP=0,pW=0;
  delIds.forEach(id=>{dP+=parseInt(document.getElementById('dp_'+id)?.value)||0;dW+=parseFloat(document.getElementById('dw_'+id)?.value)||0;(delSubDrops[id]||[]).forEach(function(sid){dP+=parseInt(document.getElementById('sdpcs_'+sid)?.value)||0;dW+=parseFloat(document.getElementById('sdwt_'+sid)?.value)||0;});});
  puIds.forEach(id=>{pP+=parseInt(document.getElementById('pp_'+id)?.value)||0;pW+=parseFloat(document.getElementById('pw_'+id)?.value)||0;});
  // Count sub-drops for display
  var subDelCount=0,subPUCount=0;
  delIds.forEach(function(id){subDelCount+=(delSubDrops[id]||[]).length;});
  puIds.forEach(function(id){subPUCount+=(puSubDrops[id]||[]).length;});
  var totalDelStops=delIds.length+subDelCount;
  var totalPUStops=puIds.length+subPUCount;
  document.getElementById('dCnt').textContent=totalDelStops;
  document.getElementById('dPcs').textContent=dP.toLocaleString();
  document.getElementById('dWt').textContent=dW.toLocaleString();
  var dl=document.getElementById('delLbl');if(dl)dl.textContent=totalDelStops+' stop'+(totalDelStops!==1?'s':'');
  document.getElementById('pCnt').textContent=totalPUStops;
  document.getElementById('pPcs').textContent=pP.toLocaleString();
  document.getElementById('pWt').textContent=pW.toLocaleString();
  var pl=document.getElementById('puLbl');if(pl)pl.textContent=totalPUStops+' stop'+(totalPUStops!==1?'s':'');
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
      <div class="field"><label>City</label><input type="text" id="dcity_${id}" placeholder="City" autocapitalize="characters" oninput="this.value=this.value.toUpperCase()"></div>
    </div>
    <div class="field" style="margin-bottom:8px"><label>Consignee</label><input type="text" id="dcons_${id}" placeholder="Consignee / company name" autocapitalize="characters" oninput="this.value=this.value.toUpperCase()"></div>
    <div class="field"><label>Time In &rarr; Time Out — 24hr</label><div class="time-pair"><input type="time" id="dtin_${id}"><span>&rarr;</span><input type="time" id="dtout_${id}"></div></div>
    <div id="dnote_wrap_${id}" style="display:none;margin-top:8px"><div class="field"><label>Note</label><textarea id="dnote_${id}" placeholder="e.g. Sub driver, weight corrected..." rows="2" style="width:100%;padding:8px 10px;border:1.5px solid var(--warn);border-radius:6px;font-family:Barlow,sans-serif;font-size:14px;resize:vertical;background:var(--warn-light)"></textarea></div></div>
    <button class="add-note-btn" id="dnotebtn_${id}" onclick="toggleNote(\'dnote_wrap_${id}\', this)">&#128221; Add Note</button>
      <button class="add-note-btn" id="adddrop_${id}" data-sid="${id}" onclick="addSubDrop(parseInt(this.dataset.sid),\'d\')" style="border-color:var(--accent2);color:var(--accent2);touch-action:manipulation">&#43; Add Another Drop</button>
    </div>
    <div id="delsubs_${id}"></div>
  </div>`;
  document.getElementById('delRows').appendChild(div);
  setTimeout(()=>div.scrollIntoView({behavior:'smooth',block:'center'}),100);updateTotals();
}

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
          <div class="field"><label>Shipper</label><input type="text" id="pship_${id}" placeholder="Shipper" autocapitalize="characters" oninput="this.value=this.value.toUpperCase()"></div>
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

function startForm(){startNewManifest();}

function startNewManifest(){
  var draft=loadDraft();
  if(draft&&draft.driverName===(session?session.name:'')&&draft.date===localDateStr()){
    if(!confirm('You have an unfinished manifest for today. Starting a new one will discard it. Continue?'))return;
  }
  clearDraft();
  clearForm();
  if(session){
    document.getElementById('fName').value=session.name;
    var meta=document.getElementById('frmMeta');
    if(session.isSub&&session.subFor&&meta){
      meta.textContent='SUB for '+session.subFor;
    }
  }
  document.getElementById('fDate').value=localDateStr();
  onDateChange();
  ss('driverForm');
}

function clearForm(){['fTruck','fStart','fEnd','fSMi','fEMi'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});document.getElementById('fDate').value=localDateStr();document.getElementById('delRows').innerHTML='';document.getElementById('puRows').innerHTML='';var asr=document.getElementById('allStopsRows');if(asr)asr.innerHTML='';delIds=[];puIds=[];delSubDrops={};puSubDrops={};subRc=0;if(typeof stopOrder!=='undefined')stopOrder=[];['fTotMi','tMi','tHrs','tStart','tEnd'].forEach(id=>document.getElementById(id).textContent='—');updateTotals();onDateChange();}

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
  var sArr=st.split(':').map(Number),eArr=et.split(':').map(Number);
  var sMin2=sArr[0]*60+sArr[1],eMin2=eArr[0]*60+eArr[1];
  if(eMin2<=sMin2)eMin2+=1440; // past midnight
  const totalHours=Math.round(((eMin2-sMin2)/60-0.5)*100)/100;
  // Build full deliveries array - each sub-drop becomes its own delivery record
  var deliveries=[];
  delIds.forEach(function(id){
    var main=gD(id);
    deliveries.push(main); // main stop
    // Each sub-drop is a full delivery inheriting location/times from parent
    (delSubDrops[id]||[]).forEach(function(sid){
      var sub=getSubDrops(id,'d').find(function(s){return true;}) || {};
      // Get this specific sub-drop's data
      var sdRef=document.getElementById('sdref_'+sid)?.value||'';
      var sdPcs=parseInt(document.getElementById('sdpcs_'+sid)?.value)||0;
      var sdWt=parseFloat(document.getElementById('sdwt_'+sid)?.value)||0;
      deliveries.push({
        proNum: sdRef,
        shipper: main.shipper,
        pieces: sdPcs,
        weight: sdWt,
        city: main.city,        // inherited from parent stop
        consignee: main.consignee, // inherited from parent stop
        timeIn: main.timeIn,    // inherited from parent stop
        timeOut: main.timeOut,  // inherited from parent stop
        note: '',
        isSubDrop: true,
        parentProNum: main.proNum
      });
    });
  });

  // Build full pickups array - each sub-pickup becomes its own PU record
  var pickups=[];
  puIds.forEach(function(id){
    var main=gP(id);
    pickups.push(main); // main stop
    (puSubDrops[id]||[]).forEach(function(sid){
      var sdCons=document.getElementById('sdcons_'+sid)?.value||'';
      var sdCity=document.getElementById('sdcity_'+sid)?.value||'';
      var sdTin=document.getElementById('sdtin_'+sid)?.value||'';
      var sdTout=document.getElementById('sdtout_'+sid)?.value||'';
      pickups.push({
        proNum: main.proNum,
        expRef: main.expRef,
        pieces: main.pieces,
        weight: main.weight,
        shipper: main.shipper,
        pickupIn: sdTin,
        pickupOut: sdTout,
        dropLocation: main.dropLocation,
        arriveExp: main.arriveExp,
        departExp: main.departExp,
        consignee: sdCons,
        note: '',
        isSubDrop: true
      });
    });
  });

  var extraDel=0,extraPU=0; // no longer needed - sub-drops are full records now
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

  const m={id:Date.now().toString(),submittedAt:new Date().toISOString(),status:'pending',flags,driverName:name,driverNum:session?.driverNum||'',isSubstitute:session?!!session.isSub:false,subFor:session?session.subFor||'':'',truckNum:truck,date,dayOfWeek,startTime:st,endTime:et,totalMiles,startMileage:sm,endMileage:em,totalHours,ttlDeliveries:deliveries.length,ttlPickups:pickups.length,ttlShipments:uniqueMAWBs,ttlWeight:totalWeight,deliveries,pickups};
  // If editing an existing manifest, replace it; otherwise add new
  if(typeof editingManifestId!=='undefined'&&editingManifestId){
    var editIdx=manifests.findIndex(function(x){return x.id===editingManifestId;});
    if(editIdx>=0){
      m.id=editingManifestId;
      m.status=manifests[editIdx].status;
      manifests[editIdx]=m;
    }else{manifests.push(m);}
    editingManifestId=null;
    wasEditingFromMgr=true;
    showToast('\u2713 Manifest updated!');
  }else{
    wasEditingFromMgr=false;
    manifests.push(m);
    showToast('\u2713 Manifest submitted!');
  }
  saveToStore('ei_manifests',JSON.stringify(manifests));
  clearDraft();stopAutoSave();clearForm();
  var hdr=document.querySelector('#driverForm .app-header h1');
  if(hdr)hdr.textContent='New Manifest';
  setTimeout(function(){
    if(wasEditingFromMgr){
      wasEditingFromMgr=false;
      if(typeof refreshMgr==='function')refreshMgr();
      ss('manager');
    } else {
      ss(session?'home':'login');
      checkForDraft();
    }
  },1500);
}




// ── STOP CARDS (new visual layer over addDel/addPU) ─────────────────────────
var stopOrder = []; // [{type:'d'|'p', id:N}] tracks manifest order

function addDelStop(){
  addDel();
  var id = delIds[delIds.length-1];
  stopOrder.push({type:'d', id:id});
  _renderStopCard('d', id);
  _updateStopsLbl();
}

function addPUStop(){
  addPU();
  var id = puIds[puIds.length-1];
  stopOrder.push({type:'p', id:id});
  _renderStopCard('p', id);
  _updateStopsLbl();
}

function _updateStopsLbl(){
  var el = document.getElementById('stopsLbl');
  if(el) el.textContent = stopOrder.length + ' stop' + (stopOrder.length!==1?'s':'');
}

function _renderStopCard(type, id){
  var container = document.getElementById('allStopsRows');
  if(!container) return;

  var delN = delIds.indexOf(id)+1;
  var puN  = puIds.indexOf(id)+1;
  var badgeClass = type==='d' ? 'del-badge' : 'pu-badge';
  var cardClass  = type==='d' ? 'del-card'  : 'pu-card';
  var badgeTxt   = type==='d' ? 'DEL '+delN : 'P/U '+puN;
  var stopNum    = stopOrder.length;

  // Get the row content from the hidden div that addDel/addPU created
  var srcRow = document.getElementById('row_'+id);
  if(!srcRow) return;

  // Create the card wrapper
  var card = document.createElement('div');
  card.className = 'stop-card ' + cardClass;
  card.id = 'stopcard_'+id;

  // Header
  var head = document.createElement('div');
  head.className = 'stop-card-head';
  head.setAttribute('onclick', '_toggleStop('+id+')');
  head.innerHTML =
    '<span class="stop-badge '+badgeClass+'">'+badgeTxt+'</span>'+
    '<span class="stop-card-summary" id="stsum_'+id+'">Stop '+stopNum+'</span>'+
    '<span id="stdone_'+id+'" class="stop-card-done" style="display:none">'+
      '<svg width="12" height="12" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" stroke="#16a34a" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'+
    '</span>'+
    '<svg id="stchev_'+id+'" width="14" height="14" viewBox="0 0 14 14" style="flex-shrink:0"><polyline points="3,5 7,9 11,5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // Body - clone the src row contents
  var body = document.createElement('div');
  body.className = 'stop-card-body';
  body.id = 'stopbody_'+id;
  // Move src row children into body
  while(srcRow.firstChild){
    // Skip the row-entry-head (old style header)
    if(srcRow.firstChild.className && srcRow.firstChild.className.indexOf('row-entry-head') >= 0){
      srcRow.removeChild(srcRow.firstChild);
    } else {
      body.appendChild(srcRow.firstChild);
    }
  }

  // Add "Done with this stop" button
  var doneBtn = document.createElement('button');
  doneBtn.className = 'done-stop-btn';
  doneBtn.setAttribute('onclick', '_doneStop('+id+')');
  doneBtn.textContent = '✓ Done with this stop';
  body.appendChild(doneBtn);

  card.appendChild(head);
  card.appendChild(body);

  // Remove the old hidden row
  srcRow.remove();

  // Insert at bottom of stops list, ABOVE the add buttons
  container.appendChild(card);

  // Scroll to new card
  setTimeout(function(){card.scrollIntoView({behavior:'smooth',block:'center'});}, 100);
}

function _toggleStop(id){
  var body = document.getElementById('stopbody_'+id);
  var chev = document.getElementById('stchev_'+id);
  if(!body) return;
  var open = !body.classList.contains('collapsed');
  if(open){
    body.classList.add('collapsed');
    if(chev) chev.style.transform = 'rotate(-90deg)';
  } else {
    body.classList.remove('collapsed');
    if(chev) chev.style.transform = '';
  }
}

function _doneStop(id){
  // Update summary line with key info
  var type = stopOrder.find(function(s){return s.id===id;});
  if(type){
    var isD = type.type === 'd';
    var ref  = document.getElementById((isD?'dref_':'pref_')+id)?.value || '';
    var pcs  = document.getElementById((isD?'dp_':'pp_')+id)?.value || '0';
    var wt   = document.getElementById((isD?'dw_':'pw_')+id)?.value || '0';
    var sum  = document.getElementById('stsum_'+id);
    if(sum) sum.textContent = (ref?'Pro# '+ref+' · ':'')+pcs+' pcs · '+wt+' lbs';
  }
  // Show done tick, collapse body
  var done = document.getElementById('stdone_'+id);
  if(done) done.style.display = 'flex';
  var body = document.getElementById('stopbody_'+id);
  if(body) body.classList.add('collapsed');
  var chev = document.getElementById('stchev_'+id);
  if(chev) chev.style.transform = 'rotate(-90deg)';
  updateTotals();
  saveDraft();
}

// Make sure rmRow also removes the stop card
var _origRmRow = rmRow;
rmRow = function(id, type){
  _origRmRow(id, type);
  var card = document.getElementById('stopcard_'+id);
  if(card) card.remove();
  stopOrder = stopOrder.filter(function(s){return s.id!==id;});
  _updateStopsLbl();
};

// Override addSubDrop to keep "Add Another Drop" button below latest drop in card
var _origAddSubDrop = addSubDrop;
addSubDrop = function(stopId, type){
  _origAddSubDrop(stopId, type);
  // Move the add drop button to after the container (already handled in addSubDrop)
  // but also ensure it scrolls into view
  var addBtn = document.getElementById('adddrop_'+stopId);
  if(addBtn) setTimeout(function(){addBtn.scrollIntoView({behavior:'smooth',block:'center'});}, 200);
};
