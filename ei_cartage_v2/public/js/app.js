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

  // Initialise roster - bump ROSTER_VERSION when adding new drivers
  try{
    var ROSTER_VERSION='v5';
    var stored=localStorage.getItem('ei_driver_roster');
    var rv=localStorage.getItem('ei_roster_version');
    if(!stored||rv!==ROSTER_VERSION){
      var def=Object.entries(UNIT_MAP).map(function(e){
        var name=e[0],unit=e[1];
        return{name:name,unit:unit,rate:unit.toUpperCase().startsWith('ST')?TRUCK_RATES.ST:TRUCK_RATES.TT};
      });
      localStorage.setItem('ei_driver_roster',JSON.stringify(def));
      localStorage.setItem('ei_roster_version',ROSTER_VERSION);
    }
  }catch(e){}

  // Always rebuild dropdown from roster so it stays in sync
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
