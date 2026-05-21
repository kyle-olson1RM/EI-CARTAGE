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
  const n=document.getElementById('loginName').value;
  const d=document.getElementById('loginNum').value.trim();
  const e=document.getElementById('loginErr');
  const isSub=document.getElementById('loginSubCheck')?.checked||false;
  const subFor=document.getElementById('loginSubFor')?.value||'';
  if(!n){e.textContent='Please select your name';return;}
  if(!d){e.textContent='Please enter your Driver #';return;}
  if(isSub&&!subFor){e.textContent='Please select the driver you are substituting for';return;}
  session={name:n,driverNum:d,isSub:isSub,subFor:isSub?subFor:''};
  sessionStorage.setItem('ei_session',JSON.stringify(session));
  e.textContent='';
  var welcomeMsg='Welcome, '+n+(isSub?' (Sub for '+subFor+')':'')+' · Driver #'+d;
  document.getElementById('homeWelcome').textContent=welcomeMsg;
  ss('home');
}

function toggleSubDriver(){
  var checked=document.getElementById('loginSubCheck')?.checked;
  var wrap=document.getElementById('loginSubWrap');
  if(wrap)wrap.style.display=checked?'block':'none';
  if(checked){
    // Populate sub driver select from roster
    var sel=document.getElementById('loginSubFor');
    var mainSel=document.getElementById('loginName');
    var currentName=mainSel?.value||'';
    sel.innerHTML='<option value="">Select original driver...</option>';
    getDriverRoster().forEach(function(d){
      if(d.name===currentName)return; // can't sub for yourself
      var o=document.createElement('option');
      o.value=o.textContent=d.name;
      sel.appendChild(o);
    });
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

function doMgrLogin(){
  const val=document.getElementById('mgrEmpNum').value.trim();
  const stored=cacheGet('ei_manager_emp')||'1234';
  if(!val){document.getElementById('mgrEmpErr').textContent='Please enter your employee #';return;}
  if(val!==stored){document.getElementById('mgrEmpErr').textContent='Incorrect employee #. Try again.';document.getElementById('mgrEmpNum').value='';return;}
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
}
// Direct manager dashboard access (bypasses login - for internal use)
function goMgr(){
  refreshMgr();
  ss('manager');
}
