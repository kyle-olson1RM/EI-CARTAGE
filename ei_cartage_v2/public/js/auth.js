/**
 * auth.js
 * Driver login/logout, manager authentication, session management.
 */


// ── LOCAL DATE ────────────────────────────────────────────────────────────────
function localDateStr(){
  var d=new Date(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return d.getFullYear()+'-'+m+'-'+day;
}


function doLogin(){
  var e=document.getElementById('loginErr');
  var isSub=document.getElementById('loginSubCheck')?.checked||false;

  if(isSub){
    // Sub driver flow - uses typed name, no driver #
    var subName=document.getElementById('loginSubName')?.value.trim();
    var subFor=document.getElementById('loginSubFor')?.value||'';
    if(!subName){e.textContent='Please enter your name';return;}
    if(!subFor){e.textContent='Please select the driver you are covering for';return;}
    session={name:subName,driverNum:'',isSub:true,subFor:subFor};
    sessionStorage.setItem('ei_session',JSON.stringify(session));
    e.textContent='';
    document.getElementById('homeWelcome').textContent='Welcome, '+subName+' (Sub for '+subFor+')';
    ss('home');
  } else {
    // Regular driver flow
    var n=document.getElementById('loginName').value;
    var d=document.getElementById('loginNum').value.trim();
    if(!n){e.textContent='Please select your name';return;}
    if(!d){e.textContent='Please enter your Driver #';return;}
    if(typeof getDriverRoster==='function'){
      var roster=getDriverRoster();
      var driverRec=roster.find(function(r){return r.name===n;});
      if(driverRec&&driverRec.driverNum&&driverRec.driverNum!==d){
        e.textContent='Driver # does not match our records for '+n;
        return;
      }
    }
    session={name:n,driverNum:d,isSub:false,subFor:''};
    sessionStorage.setItem('ei_session',JSON.stringify(session));
    e.textContent='';
    document.getElementById('homeWelcome').textContent='Welcome, '+n+' · Driver #'+d;
    ss('home');
  }
}

function toggleSubDriver(){
  var checked=document.getElementById('loginSubCheck')?.checked;
  var wrap=document.getElementById('loginSubWrap');
  var regularFields=document.getElementById('regularDriverFields');
  if(wrap)wrap.style.display=checked?'block':'none';
  // Hide regular fields when sub is checked
  if(regularFields)regularFields.style.display=checked?'none':'block';
  if(checked){
    // Populate the "covering for" dropdown with full roster
    var sel=document.getElementById('loginSubFor');
    sel.innerHTML='<option value="">Select original driver...</option>';
    getDriverRoster().forEach(function(d){
      var o=document.createElement('option');
      o.value=o.textContent=d.name;
      sel.appendChild(o);
    });
    // Focus the name field
    setTimeout(function(){document.getElementById('loginSubName')?.focus();},100);
  }
}

function doLogout(){session=null;sessionStorage.removeItem('ei_session');document.getElementById('loginName').value='';document.getElementById('loginNum').value='';ss('login');}

function openMgrLogin(){
  document.getElementById('mgrEmpErr').textContent='';
  document.getElementById('mgrEmpNum').value='';
  document.getElementById('mgrLoginOv').classList.add('open');
  setTimeout(()=>document.getElementById('mgrEmpNum').focus(),100);
}

function closeMgrLogin(){document.getElementById('mgrLoginOv').classList.remove('open');}

async function doMgrLogin(){
  const val=document.getElementById('mgrEmpNum').value.trim();
  if(!val){document.getElementById('mgrEmpErr').textContent='Please enter your badge #';return;}
  // 1) Badge # from the Manager Access roster identifies who is logging in
  var roster=(typeof getManagerRoster==='function')?getManagerRoster():[];
  var match=roster.find(function(m){return m.badge&&String(m.badge).trim().toUpperCase()===val.toUpperCase();});
  if(match){
    setCurrentMgr({name:match.name||('Badge #'+match.badge),badge:String(match.badge).trim()});
    logChange('Login','');
    closeMgrLogin();refreshMgr();ss('manager');
    return;
  }
  // 2) Fallback: the shared manager # (checked server-side), logged as "Shared PIN"
  var ok=false;
  try{
    var res=await fetch('/api/verify',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({kind:'manager',value:val})
    });
    if(res.ok){ok=(await res.json()).ok;}
    else{
      // Server unreachable/misconfigured — fall back to local default so a
      // dev running standalone (file:// or no server) isn't locked out.
      ok=(cacheGet('ei_manager_emp')||'1234')===val;
    }
  }catch(e){
    ok=(cacheGet('ei_manager_emp')||'1234')===val;
  }
  if(!ok){document.getElementById('mgrEmpErr').textContent='Badge # not recognized. Try again.';document.getElementById('mgrEmpNum').value='';return;}
  setCurrentMgr({name:'Shared PIN',badge:''});
  logChange('Login','Logged in with the shared manager #');
  closeMgrLogin();refreshMgr();ss('manager');
}

function goHome(){
  saveDraft();
  ss(session?'home':'login');
  setTimeout(checkForDraft, 200);
}

function ss(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
  if(id==='driverForm'){startAutoSave();}
  else{stopAutoSave();}
  if(id==='home'){setTimeout(checkForDraft,150);}
  // Hide manager legend when not on manager screen
  var legend=document.getElementById('mgrLegend');
  if(legend)legend.style.display=(id==='manager')?'flex':'none';
}
// Direct manager dashboard access (bypasses login - for internal use)
function goMgr(){
  refreshMgr();
  ss('manager');
}

// ── MANAGER IDENTITY & CHANGE LOG ────────────────────────────────────────────
// Lightweight "who did this" tracking — not a security boundary. Managers log
// in with their badge # from the Manager Access roster (ei_manager_roster);
// the shared manager # still works as a fallback and is recorded as
// "Shared PIN". Every billing-affecting change is stamped with the manager's
// name and time, and appended to ei_change_log (newest last, capped).
var CHANGE_LOG_MAX = 3000;

function currentMgr(){
  try{ return JSON.parse(sessionStorage.getItem('ei_mgr_user')||'null'); }catch(e){ return null; }
}
function setCurrentMgr(u){
  try{ if(u) sessionStorage.setItem('ei_mgr_user',JSON.stringify(u)); else sessionStorage.removeItem('ei_mgr_user'); }catch(e){}
  renderMgrWho();
}
function mgrName(){ var u=currentMgr(); return u?u.name:'Unknown'; }
// {by, at} stamp to attach to records
function mgrStamp(){ return {by:mgrName(), at:new Date().toISOString()}; }
function fmtStamp(iso){
  if(!iso) return '';
  var d=new Date(iso);
  return (d.getMonth()+1)+'/'+d.getDate()+' '+d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
}

// Append one entry to the change log. Fire-and-forget: a failed log write
// never blocks or undoes the change itself (it's logged to the console).
function logChange(action, detail){
  var u=currentMgr();
  var entry={id:Date.now().toString()+'_'+Math.random().toString(36).slice(2,7),
    at:new Date().toISOString(), by:u?u.name:'Unknown', badge:u?u.badge:'', action:action, detail:detail||''};
  if(typeof refreshThenMutateList!=='function') return;
  // Queue writes so back-to-back changes can't overwrite each other's entry
  _logQueue=_logQueue.then(function(){
    return refreshThenMutateList('ei_change_log',function(fresh){
      fresh.push(entry);
      if(fresh.length>CHANGE_LOG_MAX) fresh=fresh.slice(fresh.length-CHANGE_LOG_MAX);
      return fresh;
    }).then(function(r){ if(!r.ok) console.error('logChange: could not save log entry', entry); });
  }).catch(function(e){ console.error('logChange error', e); });
}
var _logQueue=Promise.resolve();
function getChangeLog(){ try{ return JSON.parse(cacheGet('ei_change_log')||'[]'); }catch(e){ return []; } }

// "Logged in as" chip in the manager legend bar
function renderMgrWho(){
  var btn=document.getElementById('mgrAccessBtn');
  if(btn&&typeof canAccessManagerRoster==='function')btn.style.display=canAccessManagerRoster()?'':'none';
  var lnk=document.getElementById('mgrAccessLink');
  if(lnk&&typeof canAccessManagerRoster==='function')lnk.style.display=canAccessManagerRoster()?'':'none';
  var el=document.getElementById('mgrWho'); if(!el) return;
  var u=currentMgr();
  el.innerHTML=u
    ? '&#128100; <strong>'+u.name+'</strong>'+(u.badge?' <span style="color:var(--muted)">#'+u.badge+'</span>':'')+((typeof isMgrAdmin==='function'&&isMgrAdmin())?' <span style="font-size:10px;padding:1px 5px;border-radius:3px;background:var(--accent-light);color:var(--accent);font-weight:700">ADMIN</span>':'')+' &nbsp;<button onclick="mgrSwitchUser()" style="background:none;border:1px solid var(--border2);border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer;color:var(--text2)">Switch</button>'
    : '';
}
function mgrSwitchUser(){
  logChange('Logout','');
  setCurrentMgr(null);
  ss('login');
  openMgrLogin();
}
