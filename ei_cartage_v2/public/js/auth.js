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
  if(!n){e.textContent='Please select your name';return;}
  if(!d){e.textContent='Please enter your Driver #';return;}
  session={name:n,driverNum:d};
  sessionStorage.setItem('ei_session',JSON.stringify(session));
  e.textContent='';
  document.getElementById('homeWelcome').textContent='Welcome, '+n+' · Driver #'+d;
  ss('home');
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
