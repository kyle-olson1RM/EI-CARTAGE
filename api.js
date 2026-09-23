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
//
// IMPORTANT (Sept 2026 incident fix): this THROWS on failure instead of
// returning null. Previously, both a failed refresh and a genuinely-empty
// key returned the same `null`, and every caller did
// `JSON.parse(await apiRefresh(key) || '[]')` — so a transient network
// hiccup during a routine refresh looked identical to "there's nothing
// here yet." The merge then ran against an empty array, and the resulting
// write (a single-record array) silently replaced the entire manifest
// history on the server. The save itself succeeded, so nothing ever
// surfaced to the driver or a manager — this is exactly what wiped
// ei_manifests from 257 records down to 1 with no error anywhere.
// Every caller that merges-then-writes (mergeAndSaveManifest,
// refreshThenMutateManifests, refreshThenMutateJFiles) already wraps its
// body in try/catch and returns {ok:false} on any thrown error — so
// letting this throw is enough to make a failed refresh abort the save
// instead of quietly emptying the dataset. Do NOT change this back to
// swallow-and-return-null.
async function apiRefresh(key) {
  const res = await fetch('/api/store');
  if (!res.ok) {
    const errText = await res.text().catch(function(){ return '(no body)'; });
    throw new Error('apiRefresh failed: ' + res.status + ' ' + errText);
  }
  const all = await res.json();
  Object.assign(_cache, all);
  return _cache[key] || null; // null here legitimately means "key not present yet"
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

// Same refresh-then-merge safety as refreshThenMutateManifests, for J-Files.
// J-Files previously saved via a naive read-local-cache -> push -> blind
// overwrite, with no refresh-before-write - a stale cache or a failed
// network push (silently swallowed) could clobber another device's entry
// or leave a save looking successful locally when the server never got it.
async function refreshThenMutateJFiles(mutatorFn) {
  try {
    const fresh = JSON.parse(await apiRefresh('ei_jfiles') || cacheGet('ei_jfiles') || '[]');
    const updated = mutatorFn(fresh) || fresh;
    var isServer = window.location.protocol !== 'file:' &&
                   window.location.hostname !== '' &&
                   window.location.hostname !== 'localhost' &&
                   window.location.hostname !== '127.0.0.1';
    if (isServer) {
      var res = await fetch('/api/store/' + encodeURIComponent('ei_jfiles'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(updated) })
      });
      if (!res.ok) {
        console.error('refreshThenMutateJFiles write failed:', res.status, await res.text());
        return { ok: false, jfiles: updated };
      }
    }
    _cache['ei_jfiles'] = JSON.stringify(updated);
    try { localStorage.setItem('ei_jfiles', JSON.stringify(updated)); } catch(e) {}
    return { ok: true, jfiles: updated };
  } catch(e) {
    console.error('refreshThenMutateJFiles error:', e.message);
    return { ok: false, jfiles: null };
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

// Returns a driver's current unit (e.g. "ST 6") for display/filtering.
// Checks the live roster first - the same source rate() uses for billing -
// and only falls back to the hardcoded UNIT_MAP for drivers not on the
// roster at all. UNIT_MAP is a deploy-time snapshot that goes stale the
// moment anyone is added, moved, or renamed through the roster UI, so using
// it alone for display caused drivers not in that snapshot to show as TT
// (the ternary's default) even when the roster - and their actual billing -
// correctly had them as ST.
function getDriverUnit(driverName){
  var roster=(typeof getDriverRoster==='function')?getDriverRoster():[];
  var driver=roster.find(function(d){return d.name===driverName;});
  if(driver&&driver.unit) return driver.unit;
  return UNIT_MAP[driverName]||'';
}

// ── 8-HOUR MINIMUM SHIFT ────────────────────────────────────────────────────
// Drivers are guaranteed a minimum of 8 billed hours per shift. m.totalHours
// (computed at submission as clock time minus a 0.5hr break) reflects what
// was actually worked; these helpers derive the billed/displayed values used
// everywhere on the manager side (dashboard, Summary, exports, print) without
// altering the driver's actual submitted start/end time on record.
var MIN_SHIFT_HOURS = 8;
function getEffectiveHours(m){
  var h = m.totalHours||0;
  return h < MIN_SHIFT_HOURS ? MIN_SHIFT_HOURS : h;
}
// Synthetic end time that, run back through the same (hours = span - 0.5hr
// break) formula, yields exactly the 8-hour minimum. Only diverges from the
// real submitted end time when the actual shift fell short.
function getEffectiveEndTime(m){
  var h = m.totalHours||0;
  if(h >= MIN_SHIFT_HOURS || !m.startTime) return m.endTime;
  var sArr = m.startTime.split(':').map(Number);
  if(sArr.length<2 || isNaN(sArr[0]) || isNaN(sArr[1])) return m.endTime;
  var sMin = sArr[0]*60+sArr[1];
  var eMin = Math.round(sMin + (MIN_SHIFT_HOURS+0.5)*60) % 1440;
  var eh = Math.floor(eMin/60), em = eMin%60;
  return String(eh).padStart(2,'0')+':'+String(em).padStart(2,'0');
}

// ── HOLIDAY BILLING ─────────────────────────────────────────────────────────
// On company holidays no trucks run, but every real roster unit is billed a
// flat HOLIDAY_HOURS at its truck-type rate. Like getEffectiveHours(), this
// is computed at render/billing time only — no manifests are created and no
// stored data is touched.
//
// Billable units = current roster, excluding admin/test drivers and spare
// placeholders whose name is "SP" + number (e.g. SP774). If a real manifest
// exists for a unit on a holiday (driver or substitute covering them), that
// manifest is billed normally and the flat holiday charge is skipped for that
// unit, so nothing is ever double-billed.
//
// Calendar (auto-computed every year from HOLIDAY_FIRST_YEAR on):
//   New Year's Day, Memorial Day (last Mon of May), Independence Day,
//   Labor Day (1st Mon of Sept), Thanksgiving (4th Thu of Nov), Christmas.
// Fixed-date holidays falling on a Saturday are observed the Friday before;
// on a Sunday, the Monday after. Only the observed weekday is billed.
var HOLIDAY_HOURS = 8;
var HOLIDAY_FIRST_YEAR = 2026;

function _hlFmt(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function _hlObserved(y,m,day){ // m is 0-based
  var d=new Date(y,m,day,12);
  var dow=d.getDay();
  if(dow===6)d.setDate(d.getDate()-1);      // Saturday -> Friday
  else if(dow===0)d.setDate(d.getDate()+1); // Sunday -> Monday
  return _hlFmt(d);
}
function _hlNthWeekday(y,m,dow,n){ // nth (1-based) given weekday of month
  var d=new Date(y,m,1,12);
  d.setDate(1+((dow-d.getDay()+7)%7)+(n-1)*7);
  return _hlFmt(d);
}
function _hlLastWeekday(y,m,dow){
  var d=new Date(y,m+1,0,12); // last day of month
  d.setDate(d.getDate()-((d.getDay()-dow+7)%7));
  return _hlFmt(d);
}
// Holidays belonging to calendar year y (an observed New Year's Day can land
// on Dec 31 of the prior year — getHolidaysInRange handles that by date).
function getHolidaysForYear(y){
  if(y<HOLIDAY_FIRST_YEAR)return [];
  return [
    {date:_hlObserved(y,0,1),        name:"New Year's Day"},
    {date:_hlLastWeekday(y,4,1),     name:'Memorial Day'},
    {date:_hlObserved(y,6,4),        name:'Independence Day'},
    {date:_hlNthWeekday(y,8,1,1),    name:'Labor Day'},
    {date:_hlNthWeekday(y,10,4,4),   name:'Thanksgiving Day'},
    {date:_hlObserved(y,11,25),      name:'Christmas Day'}
  ];
}
// All holidays with from <= date <= to (inclusive, 'YYYY-MM-DD' strings).
function getHolidaysInRange(from,to){
  if(!from||!to||from>to)return [];
  var y1=parseInt(from.slice(0,4),10),y2=parseInt(to.slice(0,4),10)+1;
  var out=[];
  for(var y=y1;y<=y2;y++){
    getHolidaysForYear(y).forEach(function(h){if(h.date>=from&&h.date<=to)out.push(h);});
  }
  return out.sort(function(a,b){return a.date<b.date?-1:1;});
}
function isSpareDriver(d){
  return !!(d&&d.name&&/^SP\s*\d+$/i.test(d.name.trim()));
}
function isHolidayBillableDriver(d){
  return !!(d&&d.name&&!d.isAdmin&&d.unit!=='ADMIN'&&!isSpareDriver(d));
}
// Holiday charges for the range. from/to may be '' (open-ended): an open
// start means HOLIDAY_FIRST_YEAR-01-01, an open end means today, so
// "All Time" style views never bill a holiday that hasn't happened yet.
// opts.unitFilter(d) -> bool can narrow which roster units are included.
// Returns [{date,name,dayOfWeek,units:[{name,unit,hours,rate,cost}],hours,cost}]
function getHolidayCharges(from,to,opts){
  opts=opts||{};
  var f=from||(HOLIDAY_FIRST_YEAR+'-01-01');
  var t=to||localDateStr();
  var hols=getHolidaysInRange(f,t);
  if(!hols.length)return [];
  var roster=(typeof getDriverRoster==='function')?getDriverRoster():[];
  var units=roster.filter(isHolidayBillableDriver);
  if(opts.unitFilter)units=units.filter(opts.unitFilter);
  return hols.map(function(h){
    // Units that actually worked this day are billed from their manifest.
    var worked={};
    (manifests||[]).forEach(function(m){
      if(m.date!==h.date)return;
      worked[m.driverName]=true;
      if(m.isSubstitute&&m.subFor)worked[m.subFor]=true;
    });
    var list=units.filter(function(d){return !worked[d.name];}).map(function(d){
      var r=rate(d.name);
      return {name:d.name,unit:d.unit,hours:HOLIDAY_HOURS,rate:r,cost:HOLIDAY_HOURS*r};
    });
    var dow=new Date(h.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long'});
    return {
      date:h.date,name:h.name,dayOfWeek:dow,units:list,
      hours:list.reduce(function(s,u){return s+u.hours;},0),
      cost:list.reduce(function(s,u){return s+u.cost;},0)
    };
  }).filter(function(h){return h.units.length>0;});
}
// Short label, e.g. "Labor Day (Mon 9/7)"
function holidayLabel(h){
  var d=new Date(h.date+'T12:00:00');
  return h.name+' ('+d.toLocaleDateString('en-US',{weekday:'short'})+' '+(d.getMonth()+1)+'/'+d.getDate()+')';
}
