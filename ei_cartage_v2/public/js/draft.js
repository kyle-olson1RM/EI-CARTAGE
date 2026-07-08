/**
 * draft.js
 * Auto-save draft system.
 * Saves manifest-in-progress to localStorage every 5 seconds
 * and on tab switch / page close. Drivers can resume mid-day.
 */


// ── DRAFT SYSTEM ──────────────────────────────────────────────────────────────
var DRAFT_KEY='ei_manifest_draft'; // legacy shared key, kept only for one-time migration below
var draftTimer=null;

function currentDraftKey(){
  var n=(session&&session.name)?session.name:'';
  return n?('ei_manifest_draft_'+n):DRAFT_KEY;
}

// One-time migration: if an old shared-key draft exists and matches the
// current session's name, move it under the new per-driver key.
function _migrateLegacyDraft(){
  try{
    var legacy=localStorage.getItem(DRAFT_KEY);
    if(!legacy)return;
    var d=JSON.parse(legacy);
    var key=currentDraftKey();
    if(key!==DRAFT_KEY && (!d.driverName || d.driverName===(session?session.name:''))){
      localStorage.setItem(key,legacy);
    }
    localStorage.removeItem(DRAFT_KEY);
  }catch(e){}
}

function saveDraft(){
  try{
    var nameEl=document.getElementById('fName');if(!nameEl||!nameEl.value)return;
    var draft={savedAt:new Date().toISOString(),date:localDateStr(),
      driverName:nameEl.value||'',truckNum:document.getElementById('fTruck')?.value||'',
      startTime:document.getElementById('fStart')?.value||'',endTime:document.getElementById('fEnd')?.value||'',
      startMi:document.getElementById('fSMi')?.value||'',endMi:document.getElementById('fEMi')?.value||'',
      deliveries:[],pickups:[]};
    delIds.forEach(function(id){var _db=document.getElementById('stopbody_'+id);var _dd=document.getElementById('stdone_'+id);draft.deliveries.push({id:id,proNum:document.getElementById('dref_'+id)?.value||'',pieces:document.getElementById('dp_'+id)?.value||'',weight:document.getElementById('dw_'+id)?.value||'',city:document.getElementById('dcity_'+id)?.value||'',consignee:document.getElementById('dcons_'+id)?.value||'',timeIn:document.getElementById('dtin_'+id)?.value||'',timeOut:document.getElementById('dtout_'+id)?.value||'',note:document.getElementById('dnote_'+id)?.value||'',done:_db&&_db.classList.contains('collapsed'),summary:document.getElementById('stsum_'+id)?.textContent||'',subDrops:(delSubDrops[id]||[]).map(function(sid){return{sid:sid,proNum:document.getElementById('sdref_'+sid)?.value||'',pieces:document.getElementById('sdpcs_'+sid)?.value||'',weight:document.getElementById('sdwt_'+sid)?.value||''};})});});
    puIds.forEach(function(id){var _pb=document.getElementById('stopbody_'+id);var _pd=document.getElementById('stdone_'+id);var _retPend=document.getElementById('retpend_'+id);draft.pickups.push({id:id,done:_pb&&_pb.classList.contains('collapsed'),returnPending:_retPend&&_retPend.style.display!=='none',summary:document.getElementById('stsum_'+id)?.textContent||'',proNum:document.getElementById('pref_'+id)?.value||'',expRef:document.getElementById('pexpref_'+id)?.value||'',pieces:document.getElementById('pp_'+id)?.value||'',weight:document.getElementById('pw_'+id)?.value||'',shipper:document.getElementById('pship_'+id)?.value||'',pickupIn:document.getElementById('ptin_'+id)?.value||'',pickupOut:document.getElementById('ptout_'+id)?.value||'',dropLocation:_resolveDropLocation('pdrop_'+id),arriveExp:document.getElementById('parr_'+id)?.value||'',departExp:document.getElementById('pdep2_'+id)?.value||'',note:document.getElementById('pnote_'+id)?.value||'',subPickups:(puSubDrops[id]||[]).map(function(sid){return{sid:sid,proNum:document.getElementById('sdref_'+sid)?.value||'',expRef:document.getElementById('sdexpref_'+sid)?.value||'',pieces:document.getElementById('sdpcs_'+sid)?.value||'',weight:document.getElementById('sdwt_'+sid)?.value||''};})});});
    var key=currentDraftKey();
    if(!localStorage.getItem(key)&&!draft.truckNum&&!draft.startTime&&draft.deliveries.length===0&&draft.pickups.length===0)return;
    localStorage.setItem(key,JSON.stringify(draft));
    var ind=document.getElementById('draftIndicator');
    if(ind){var t=new Date();ind.textContent='Saved '+t.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});ind.style.color='var(--success)';setTimeout(function(){if(ind)ind.style.color='rgba(255,255,255,.5)';},2000);}
  }catch(e){console.log('Draft save error:',e);}
}
function saveDraftForced(){saveDraft();}
function loadDraft(){try{_migrateLegacyDraft();var s=localStorage.getItem(currentDraftKey());return s?JSON.parse(s):null;}catch(e){return null;}}
function clearDraft(){
  localStorage.removeItem(currentDraftKey());
  var today=localDateStr(),toRemove=[];
  for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.startsWith('ei_draft_')){try{var d=JSON.parse(localStorage.getItem(k));if(d&&d.date===today)toRemove.push(k);}catch(e){}}}
  toRemove.forEach(function(k){localStorage.removeItem(k);});
}
function checkForDraft(){
  var btn=document.getElementById('continueDraftBtn'),sum=document.getElementById('draftSummary');if(!btn)return;
  var draft=loadDraft(),today=localDateStr();
  var driverMatch=!session||!draft||!draft.driverName||draft.driverName===''||draft.driverName===(session?session.name:'');
  if(draft&&draft.date===today&&driverMatch){
    btn.style.display='flex';
    var dels=(draft.deliveries||[]).length,pus=(draft.pickups||[]).length,t=new Date(draft.savedAt);
    if(sum){sum.style.display='flex';var txt=document.getElementById('draftSummaryText');if(txt)txt.textContent=(dels+pus)+' stop'+(dels+pus!==1?'s':'')+' \u00b7 Last saved '+t.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});}
  }else{btn.style.display='none';if(sum)sum.style.display='none';}
}
function continueDraft(){
  var draft=loadDraft();if(!draft){showToast('No draft found for today');return;}
  clearForm();ss('driverForm');
  setTimeout(function(){
    var set=function(id,val){var e=document.getElementById(id);if(e)e.value=val||'';};
    set('fName',session?session.name:draft.driverName);set('fTruck',draft.truckNum);set('fDate',draft.date||localDateStr());set('fStart',draft.startTime);set('fEnd',draft.endTime);set('fSMi',draft.startMi);set('fEMi',draft.endMi);
    onDateChange();calcHours();calcMiles();
    (draft.deliveries||[]).forEach(function(d){
      // Use addDelStop so the card renders visually
      if(typeof addDelStop==='function') addDelStop();
      else addDel();
      var id=delIds[delIds.length-1];
      var set2=function(fid,val){var e=document.getElementById(fid);if(e)e.value=val||'';};
      set2('dref_'+id,d.proNum);set2('dp_'+id,d.pieces);set2('dw_'+id,d.weight);
      set2('dcity_'+id,d.city);set2('dcons_'+id,d.consignee);
      set2('dtin_'+id,d.timeIn);set2('dtout_'+id,d.timeOut);
      if(d.note){var nt=document.getElementById('dnote_'+id);if(nt)nt.value=d.note;var nw=document.getElementById('dnote_wrap_'+id);if(nw)nw.style.display='block';}
      // Restore sub-drops
      (d.subDrops||[]).forEach(function(sd){
        if(typeof addSubDrop==='function')addSubDrop(id,'d');
        var subId=(delSubDrops[id]||[])[((delSubDrops[id]||[]).length)-1];
        if(subId!=null){
          var set3=function(fid,val){var e=document.getElementById(fid);if(e)e.value=val||'';};
          set3('sdref_'+subId,sd.proNum);set3('sdpcs_'+subId,sd.pieces);set3('sdwt_'+subId,sd.weight);
        }
      });
      // Restore collapsed/done state
      if(d.done){
        var _b=document.getElementById('stopbody_'+id);var _c=document.getElementById('stchev_'+id);var _dk=document.getElementById('stdone_'+id);
        if(_b)_b.classList.add('collapsed');if(_c)_c.style.transform='rotate(-90deg)';if(_dk)_dk.style.display='flex';
        if(d.summary){var _s=document.getElementById('stsum_'+id);if(_s)_s.textContent=d.summary;}
      }
    });
    (draft.pickups||[]).forEach(function(p){
      // Use addPUStop so the card renders visually
      if(typeof addPUStop==='function') addPUStop();
      else addPU();
      var id=puIds[puIds.length-1];
      var set2=function(fid,val){var e=document.getElementById(fid);if(e)e.value=val||'';};
      set2('pref_'+id,p.proNum);set2('pexpref_'+id,p.expRef);set2('pp_'+id,p.pieces);
      set2('pw_'+id,p.weight);set2('pship_'+id,p.shipper);set2('ptin_'+id,p.pickupIn);
      set2('ptout_'+id,p.pickupOut);
      if(typeof _setDropLocationValue==='function')_setDropLocationValue('pdrop_'+id,p.dropLocation);
      set2('parr_'+id,p.arriveExp);set2('pdep2_'+id,p.departExp);
      if(p.pickupIn&&p.pickupOut&&typeof _revealPuDropSection==='function')_revealPuDropSection(id);
      if(p.note){var nt=document.getElementById('pnote_'+id);if(nt)nt.value=p.note;var nw=document.getElementById('pnote_wrap_'+id);if(nw)nw.style.display='block';}
      // Restore sub-pickups
      (p.subPickups||[]).forEach(function(sp){
        if(typeof addSubDrop==='function')addSubDrop(id,'p');
        var subId=(puSubDrops[id]||[])[((puSubDrops[id]||[]).length)-1];
        if(subId!=null){
          var set3=function(fid,val){var e=document.getElementById(fid);if(e)e.value=val||'';};
          set3('sdref_'+subId,sp.proNum);set3('sdexpref_'+subId,sp.expRef);set3('sdpcs_'+subId,sp.pieces);set3('sdwt_'+subId,sp.weight);
        }
      });
      // Restore collapsed/done/returnPending state
      if(p.done){
        var _b=document.getElementById('stopbody_'+id);var _c=document.getElementById('stchev_'+id);var _dk=document.getElementById('stdone_'+id);
        if(_b)_b.classList.add('collapsed');if(_c)_c.style.transform='rotate(-90deg)';if(_dk)_dk.style.display='flex';
        if(p.summary){var _s=document.getElementById('stsum_'+id);if(_s)_s.textContent=p.summary;}
      }
      if(p.returnPending){var _rp=document.getElementById('retpend_'+id);if(_rp)_rp.style.display='inline-flex';}
      if(typeof _checkReturnPending==='function')_checkReturnPending(id);
    });
    updateTotals();
    if(typeof _collapseAllExceptLast==='function')_collapseAllExceptLast();
    var total=(draft.deliveries||[]).length+(draft.pickups||[]).length;
    showToast('\u270e Draft restored'+(total?' \u2014 '+total+' stop'+(total!==1?'s':''):''));
    startAutoSave();
  },250);
}
function discardDraft(){
  if(!confirm("Discard today's draft?"))return;
  clearDraft();
  var btn=document.getElementById('continueDraftBtn'),sum=document.getElementById('draftSummary');
  if(btn)btn.style.display='none';if(sum)sum.style.display='none';
  showToast('Draft discarded');
}
function startAutoSave(){if(draftTimer)clearInterval(draftTimer);draftTimer=setInterval(saveDraft,5000);}
function stopAutoSave(){if(draftTimer){clearInterval(draftTimer);draftTimer=null;}}
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')saveDraft();});
window.addEventListener('beforeunload',function(){saveDraft();});
