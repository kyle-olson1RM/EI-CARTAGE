/**
 * api.js
 * API store layer — proxies data reads/writes through the Express server.
 * Falls back to localStorage when running as a standalone file.
 * Draft keys (ei_manifest_draft) always stay in localStorage.
 */


// ── API STORE (replaces localStorage for shared data) ─────────────────────────
// Draft keys stay in localStorage — everything else goes through the API
const DRAFT_ONLY_PREFIXES = ['ei_manifest_draft', 'ei_session'];
var _cache = {}; // in-memory cache so reads are instant after first load

async function apiGet(key) {
  if (_cache.hasOwnProperty(key)) return _cache[key];
  try {
    const res = await fetch('/api/store');
    if (res.ok) {
      const all = await res.json();
      Object.assign(_cache, all);
      return _cache[key] || null;
    } else {
      console.error('apiGet failed:', res.status, await res.text());
    }
  } catch(e) { console.error('apiGet network error:', e.message); }
  return null;
}

async function apiSet(key, value) {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  _cache[key] = str;
  // Always write to localStorage as backup
  try { localStorage.setItem(key, str); } catch(e) {}
  // Push to server
  var isServer = window.location.protocol !== 'file:' &&
                 window.location.hostname !== '' &&
                 window.location.hostname !== 'localhost' &&
                 window.location.hostname !== '127.0.0.1';
  if(!isServer) return; // local file mode - localStorage only
  try {
    var res = await fetch('/api/store/' + encodeURIComponent(key), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: str })
    });
    if(!res.ok) {
      var err = await res.text();
      console.error('apiSet failed for key:', key, 'status:', res.status, err);
    }
  } catch(e) {
    console.error('apiSet network error for key:', key, e.message);
  }
}

// Force a fresh read of a key from the server, bypassing the in-memory cache.
// Used before any write to ei_manifests so we merge against the latest data
// instead of clobbering everything written by other drivers/tablets since boot.
async function apiRefresh(key) {
  try {
    const res = await fetch('/api/store');
    if (res.ok) {
      const all = await res.json();
      Object.assign(_cache, all);
      return _cache[key] || null;
    } else {
      console.error('apiRefresh failed:', res.status, await res.text());
    }
  } catch(e) { console.error('apiRefresh network error:', e.message); }
  return null;
}

// Merge one manifest (new or edited) into the latest server copy of ei_manifests
// and write it back. Returns {ok, manifests} so callers can react to failure
// instead of silently reporting success.
async function mergeAndSaveManifest(m) {
  try {
    const fresh = JSON.parse(await apiRefresh('ei_manifests') || '[]');
    const idx = fresh.findIndex(function(x){ return x.id === m.id; });
    if (idx >= 0) fresh[idx] = m; else fresh.push(m);
    var isServer = window.location.protocol !== 'file:' &&
                   window.location.hostname !== '' &&
                   window.location.hostname !== 'localhost' &&
                   window.location.hostname !== '127.0.0.1';
    if (isServer) {
      var res = await fetch('/api/store/' + encodeURIComponent('ei_manifests'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(fresh) })
      });
      if (!res.ok) {
        console.error('mergeAndSaveManifest write failed:', res.status, await res.text());
        return { ok: false, manifests: fresh };
      }
    }
    _cache['ei_manifests'] = JSON.stringify(fresh);
    try { localStorage.setItem('ei_manifests', JSON.stringify(fresh)); } catch(e) {}
    manifests = fresh;
    return { ok: true, manifests: fresh };
  } catch(e) {
    console.error('mergeAndSaveManifest error:', e.message);
    return { ok: false, manifests: manifests };
  }
}

// Same idea for whole-array replacement operations initiated from the manager
// dashboard (delete / bulk status updates) where there's no single "the record
// I'm changing" — refresh first, apply the mutator to the fresh array, save.
async function refreshThenMutateManifests(mutatorFn) {
  try {
    const fresh = JSON.parse(await apiRefresh('ei_manifests') || '[]');
    const updated = mutatorFn(fresh) || fresh;
    var isServer = window.location.protocol !== 'file:' &&
                   window.location.hostname !== '' &&
                   window.location.hostname !== 'localhost' &&
                   window.location.hostname !== '127.0.0.1';
    if (isServer) {
      var res = await fetch('/api/store/' + encodeURIComponent('ei_manifests'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(updated) })
      });
      if (!res.ok) {
        console.error('refreshThenMutateManifests write failed:', res.status, await res.text());
        return { ok: false, manifests: updated };
      }
    }
    _cache['ei_manifests'] = JSON.stringify(updated);
    try { localStorage.setItem('ei_manifests', JSON.stringify(updated)); } catch(e) {}
    manifests = updated;
    return { ok: true, manifests: updated };
  } catch(e) {
    console.error('refreshThenMutateManifests error:', e.message);
    return { ok: false, manifests: manifests };
  }
}

async function apiDel(key) {
  delete _cache[key];
  try {
    await fetch('/api/store/' + encodeURIComponent(key), { method: 'DELETE' });
  } catch(e) { console.log('apiDel error', e); }
}

function cacheGet(key) {
  // Return from API cache if available, otherwise fall back to localStorage
  if (_cache.hasOwnProperty(key)) return _cache[key];
  return localStorage.getItem(key);
}

// Override localStorage-based getters/setters to use API cache
function getFromStore(key) { return cacheGet(key); }
function saveToStore(key, val) { apiSet(key, val); }
function deleteFromStore(key) { apiDel(key); }

let manifests=JSON.parse(cacheGet('ei_manifests')||'[]');
let mgrWeeks=[];
let mgrWeekIdx=-1;
let session=JSON.parse(sessionStorage.getItem('ei_session')||'null');
let delIds=[],puIds=[],rc=0;
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DO=['Monday','Tuesday','Wednesday','Thursday','Friday'];
const UNIT_MAP = {
  'Tom Hunt':         'TT 1',
  'Mike Plodzein':    'TT 2',
  'Dan Eckler':       'TT 3',
  'Armando Galeano':  'TT 4',
  'Juan Custodio':    'TT 5',
  'Eric Gomez':       'TT 6',
  'Marin Bezatlliu':  'TT 7',
  'Jose Castenada':   'TT 8',
  'Joni Grabova':     'TT 9',
  'Edi Rukaj':        'TT 10',
  'Jorge Osorio':     'TT 11',
  'Remon Khoshaba':   'TT 12',
  'Diego Hernandez':  'TT 13',
  'Ermal Diko':       'TT 14',
  'Armando Perez':    'TT 15',
  'Jose Nieves':      'TT 16',
  'Bill Meager':      'ST 1',
  'Miguel Gomez':     'ST 2',
  'Armando G':        'ST 3',
  'Gerardo Picazo':   'ST 4',
};
const ALL_DRIVERS = Object.keys(UNIT_MAP);

// Truck type rates - TT = Tractor Trailer, ST = Straight Truck
// These are program-wide rates based on truck type, not individual drivers
var TRUCK_RATES=JSON.parse(cacheGet('ei_truck_rates')||'{"TT":92,"ST":87}');

function rate(driverName){
  // Rate is based on the driver's unit type (TT or ST), not the driver themselves
  var roster=(typeof getDriverRoster==='function')?getDriverRoster():[];
  var driver=roster.find(function(d){return d.name===driverName;});
  if(driver&&driver.unit){
    var unitType=driver.unit.trim().toUpperCase().startsWith('ST')?'ST':'TT';
    return TRUCK_RATES[unitType]||TRUCK_RATES.TT;
  }
  // Fallback: check UNIT_MAP
  var unit=UNIT_MAP[driverName]||'';
  return unit.toUpperCase().startsWith('ST')?TRUCK_RATES.ST:TRUCK_RATES.TT;
}
