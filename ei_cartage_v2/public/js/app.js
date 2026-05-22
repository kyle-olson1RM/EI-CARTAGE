/**
 * app.js
 * Application entry point.
 * iOS touch compatibility fixes and app initialization.
 * This file runs last — all other modules must be loaded first.
 */

// ── iOS TOUCH FIX ─────────────────────────────────────────────────────────────
document.addEventListener('touchstart', function(){}, {passive:true});
document.addEventListener('touchend', function(e){
  var el=e.target;
  while(el && el!==document.body){
    if(el.onclick||el.tagName==='BUTTON'||el.tagName==='A'||
       el.tagName==='SELECT'||el.tagName==='INPUT'||el.getAttribute('onclick')){break;}
    el=el.parentElement;
  }
},{passive:true});

// ── INIT ──────────────────────────────────────────────────────────────────────
function bootApp(){
  // Load manifests
  try{var m=localStorage.getItem('ei_manifests');if(m)manifests=JSON.parse(m);}catch(e){}

  // Initialise roster
  // IMPORTANT: If a roster is already saved, ALWAYS use it — never overwrite it.
  // Only seed from UNIT_MAP if there is no roster stored at all (first time setup).
  try{
    var stored=localStorage.getItem('ei_driver_roster');
    if(!stored){
      // First time — seed from UNIT_MAP defaults
      var def=Object.entries(UNIT_MAP).map(function(e){
        var name=e[0],unit=e[1];
        return{name:name,unit:unit,rate:unit.toUpperCase().startsWith('ST')?TRUCK_RATES.ST:TRUCK_RATES.TT};
      });
      localStorage.setItem('ei_driver_roster',JSON.stringify(def));
    }
    // If roster exists — leave it completely alone regardless of code updates
  }catch(e){}

  // Always rebuild dropdown from whatever roster is stored
  rebuildUnitMap(getDriverRoster());

  // Restore session
  var sess=sessionStorage.getItem('ei_session');
  if(sess){
    try{
      session=JSON.parse(sess);
      document.getElementById('homeWelcome').textContent='Welcome, '+session.name+' · Driver #'+session.driverNum;
      ss('home');
      checkForDraft();
    }catch(e){ss('login');}
  }else{
    ss('login');
  }

  // iOS continue draft touch fix
  var cdb=document.getElementById('continueDraftBtn');
  if(cdb)cdb.addEventListener('touchend',function(e){e.preventDefault();continueDraft();},false);
}

bootApp();
