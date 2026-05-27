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


// ── TOAST NOTIFICATION ───────────────────────────────────────────────────────
var toastTimer;
function showToast(msg, dur){
  dur = dur || 2200;
  var t = document.getElementById('toast');
  if(!t) return;
  t.innerHTML = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.classList.remove('show'); }, dur);
}


// ── INIT ──────────────────────────────────────────────────────────────────────
async function bootApp(){
  // Detect if running through Railway server or local file
  var isServer = window.location.protocol !== 'file:' &&
                 window.location.hostname !== '' &&
                 window.location.hostname !== 'localhost' &&
                 window.location.hostname !== '127.0.0.1';

  if(isServer){
    // Load ALL shared data from Supabase via Railway API
    try{
      var controller=new AbortController();
      var timeout=setTimeout(function(){controller.abort();},8000);
      var res=await fetch('/api/store',{signal:controller.signal});
      clearTimeout(timeout);
      if(res.ok){
        var all=await res.json();
        Object.assign(_cache,all);
        // Also mirror to localStorage for offline fallback
        Object.keys(all).forEach(function(k){
          try{localStorage.setItem(k,all[k]);}catch(e){}
        });
      }
    }catch(e){
      // Server unreachable — fall back to localStorage
      console.log('API unavailable, using localStorage fallback');
    }
  }

  // Load manifests from cache (populated from API or localStorage)
  try{
    var m=cacheGet('ei_manifests');
    if(m)manifests=JSON.parse(m);
  }catch(e){}

  // Initialise roster — only seed if nothing stored anywhere
  try{
    var stored=cacheGet('ei_driver_roster');
    if(!stored){
      var def=Object.entries(UNIT_MAP).map(function(e){
        var name=e[0],unit=e[1];
        return{name:name,unit:unit,rate:unit.toUpperCase().startsWith('ST')?TRUCK_RATES.ST:TRUCK_RATES.TT};
      });
      saveToStore('ei_driver_roster',JSON.stringify(def));
    }
  }catch(e){}

  // Always rebuild dropdown from stored roster
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
