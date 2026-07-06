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
  if(!val){document.getElementById('mgrEmpErr').textContent='Please enter your employee #';return;}
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
  if(!ok){document.getElementById('mgrEmpErr').textContent='Incorrect employee #. Try again.';document.getElementById('mgrEmpNum').value='';return;}
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
