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





// ── WINDOWS TABLET SCROLL FIX ────────────────────────────────────────────────
document.addEventListener('focusin', function(e){
  var el = e.target;
  if(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'){
    setTimeout(function(){
      el.scrollIntoView({behavior:'smooth', block:'center'});
    }, 100);
  }
});

// ── INIT ──────────────────────────────────────────────────────────────────────
async function bootApp(){
  // Detect if running through Railway server or local file
  var isServer = window.location.protocol !== 'file:' &&
                 window.location.hostname !== '' &&
                 window.location.hostname !== 'localhost' &&
                 window.location.hostname !== '127.0.0.1';

  var bootFetchFailed = false;
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
      }else{
        bootFetchFailed = true;
      }
    }catch(e){
      // Server unreachable — fall back to localStorage
      bootFetchFailed = true;
      console.log('API unavailable, using localStorage fallback');
    }
  }

  // Load manifests from cache (populated from API or localStorage)
  try{
    var m=cacheGet('ei_manifests');
    if(m)manifests=JSON.parse(m);
  }catch(e){}

  // Re-read truck rates now that boot data has loaded — TRUCK_RATES in api.js
  // was parsed at script-load time, before this fetch populated the cache, so
  // a fresh/wiped tablet would otherwise bill at hardcoded defaults for its
  // first session regardless of server-set rates.
  try{
    var savedRates=cacheGet('ei_truck_rates');
    if(savedRates){
      var parsedRates=JSON.parse(savedRates);
      TRUCK_RATES.TT=parsedRates.TT||TRUCK_RATES.TT;
      TRUCK_RATES.ST=parsedRates.ST||TRUCK_RATES.ST;
    }
  }catch(e){}

  // Roster sync — version-controlled so updates deploy to all devices.
  // Only seed/migrate when we actually have current server data: if the boot
  // fetch failed, a stale/offline tablet must NOT push a version mismatch back
  // to the server and clobber the live roster once the network recovers.
  // Bump ROSTER_VERSION when the default roster changes
  var ROSTER_VERSION = 'v7-may2026';
  if(!bootFetchFailed){
    try{
      var existingRosterRaw = cacheGet('ei_driver_roster');
      var existingRoster = existingRosterRaw ? JSON.parse(existingRosterRaw) : [];
      var rosterVer = cacheGet('ei_roster_version');
      var isFirstRun = !existingRoster.length;
      if(isFirstRun || rosterVer !== ROSTER_VERSION){
        // Build fresh default roster from UNIT_MAP with correct driver numbers
        var driverNums = {
          'Tom Hunt':'751','Mike Plodzein':'750','Dan Eckler':'752',
          'Armando Galeano':'776','Juan Custodio':'753','Eric Gomez':'750',
          'Marin Bezatlliu':'761','Jose Castenada':'757','Joni Grabova':'758',
          'Edi Rukaj':'785','Jorge Osorio':'760','Remon Khoshaba':'782',
          'Diego Hernandez':'783','Ermal Diko':'786','Armando Perez':'784',
          'Jose Nieves':'798','Bill Meager':'779','Miguel Gomez':'777',
          'Armando G':'','Gerardo Picazo':'781'
        };
        var def=Object.entries(UNIT_MAP).map(function(e){
          var name=e[0],unit=e[1];
          return{
            name:name,
            unit:unit,
            driverNum:driverNums[name]||'',
            rate:unit.toUpperCase().startsWith('ST')?TRUCK_RATES.ST:TRUCK_RATES.TT
          };
        });
        if(isFirstRun){
          // True first run — nothing exists yet, safe to seed outright
          saveToStore('ei_driver_roster',JSON.stringify(def));
        }else{
          // Version bump on an existing roster — merge by name so manager
          // edits (added/removed drivers, changed #s or rates) survive;
          // only add drivers that are missing, never overwrite existing ones.
          var existingNames = new Set(existingRoster.map(function(r){return r.name;}));
          var merged = existingRoster.concat(def.filter(function(d){return !existingNames.has(d.name);}));
          saveToStore('ei_driver_roster',JSON.stringify(merged));
        }
        saveToStore('ei_roster_version', ROSTER_VERSION);
        console.log('Roster updated to', ROSTER_VERSION);
      }
    }catch(e){console.error('Roster init error:',e);}
  }

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
