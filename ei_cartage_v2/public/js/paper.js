/**
 * paper.js
 * Paper-style manifest entry — the same layout as the printed Expeditors
 * Drivers Manifest (header block + Deliveries table + Pick Ups table), typed
 * into directly. Built for substitute/temp drivers who know the paper form
 * but not the stop-card app.
 *
 * Autofills: driver name/#, today's date, truck # (from the last manifest of
 * the driver being covered), default start time, shipper on deliveries, City
 * from the Consignee's usual city, suggestion lists for consignees/cities/
 * shippers from manifest history, and live totals.
 *
 * Saves the exact same manifest record as the stop-card form (shared
 * _buildManifestRecord + mergeAndSaveManifest), tagged entryMode:'paper'.
 * Auto-saves to the tablet so nothing is lost if a submit fails.
 */

var PAPER_DEL_COLS = [
  {k:'proNum',   h:'Pro #, AWB # or Ref #', w:150, up:true, req:'Pro #'},
  {k:'pieces',   h:'Pieces',  w:70,  num:true, req:'Pieces'},
  {k:'weight',   h:'Weight',  w:85,  num:true, req:'Weight'},
  {k:'_ship',    h:'Shipper / Forwarder', w:110, fixed:'EXPEDITORS'},
  {k:'consignee',h:'Consignee', w:200, up:true, list:'ppConsList', req:'Consignee'},
  {k:'city',     h:'City',    w:185, up:true, list:'ppCityList', req:'City'},
  {k:'timeIn',   h:'Time In', w:80,  time:true, req:'Time In'},
  {k:'timeOut',  h:'Time Out',w:80,  time:true, req:'Time Out'}
];
var PAPER_PU_COLS = [
  {k:'proNum',   h:'Pro #, AWB # or Ref #', w:150, up:true, req:'Pro #'},
  {k:'pieces',   h:'Pieces',  w:70,  num:true, req:'Pieces'},
  {k:'weight',   h:'Weight',  w:85,  num:true, req:'Weight'},
  {k:'shipper',  h:'Shipper', w:180, up:true, list:'ppShipList', req:'Shipper'},
  {k:'expRef',   h:'Exp Ref #', w:110, up:true, req:'Exp Ref #'},
  {k:'pickupIn', h:'Time In', w:80,  time:true, req:'Time In at shipper'},
  {k:'pickupOut',h:'Time Out',w:80,  time:true, req:'Time Out at shipper'},
  {k:'dropLocation', h:'Drop Off Location', w:110, drop:true, req:'Drop Off Location'},
  {k:'arriveExp',h:'Time In', w:80,  time:true, req:'Time In at drop off'},
  {k:'departExp',h:'Time Out',w:80,  time:true, req:'Time Out at drop off'}
];
var PAPER_START_DEL_ROWS = 6, PAPER_START_PU_ROWS = 4;

var _ppDelRows = 0, _ppPuRows = 0, _ppSaveTimer = null, _ppPendingId = null, _ppInFlight = false;
var _ppConsCity = {}; // CONSIGNEE -> most common CITY in history

function _ppKey(){ return 'ei_paper_draft_' + ((session && session.name) || ''); }
function _ppEl(id){ return document.getElementById(id); }
function _ppVal(id){ var e = _ppEl(id); return e ? String(e.value || '').trim() : ''; }

// ── Time entry: accept what people write on paper ────────────────────────────
// "1430", "930", "14:30", "2:30p", "2:30 pm", "9" -> "HH:MM" (24hr). '' if invalid.
function _ppNormTime(raw){
  var s = String(raw || '').trim().toLowerCase().replace(/\s+/g, '');
  if(!s) return '';
  var pm = /p/.test(s), am = /a/.test(s);
  s = s.replace(/[apm.]/g, '');
  var h, m;
  if(s.indexOf(':') >= 0){ var p = s.split(':'); h = parseInt(p[0], 10); m = parseInt(p[1] || '0', 10); }
  else if(/^\d{1,2}$/.test(s)){ h = parseInt(s, 10); m = 0; }
  else if(/^\d{3,4}$/.test(s)){ h = parseInt(s.slice(0, s.length - 2), 10); m = parseInt(s.slice(-2), 10); }
  else return '';
  if(isNaN(h) || isNaN(m)) return '';
  if(pm && h < 12) h += 12;
  if(am && h === 12) h = 0;
  if(h > 23 || m > 59) return '';
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
function _ppTimeBlur(el){
  var v = el.value.trim();
  if(!v){ el.classList.remove('pp-bad'); return; }
  var n = _ppNormTime(v);
  if(n){ el.value = n; el.classList.remove('pp-bad'); }
  else { el.classList.add('pp-bad'); showToast('Time not recognized: "' + v + '" — use 24hr like 1430', 3000); }
  _ppTotals(); _ppQueueSave();
}

// ── History-based suggestions ────────────────────────────────────────────────
function _ppBuildHistory(){
  var consCity = {}, cons = {}, cities = {}, ships = {};
  (Array.isArray(manifests) ? manifests : []).forEach(function(m){
    (m.deliveries || []).forEach(function(d){
      var c = String(d.consignee || '').trim().toUpperCase(), ci = String(d.city || '').trim().toUpperCase();
      if(c){ cons[c] = (cons[c] || 0) + 1; }
      if(ci){ cities[ci] = (cities[ci] || 0) + 1; }
      if(c && ci){ consCity[c] = consCity[c] || {}; consCity[c][ci] = (consCity[c][ci] || 0) + 1; }
    });
    (m.pickups || []).forEach(function(p){
      var s = String(p.shipper || '').trim().toUpperCase();
      if(s) ships[s] = (ships[s] || 0) + 1;
    });
  });
  _ppConsCity = {};
  Object.keys(consCity).forEach(function(c){
    var best = '', n = 0;
    Object.keys(consCity[c]).forEach(function(ci){ if(consCity[c][ci] > n){ n = consCity[c][ci]; best = ci; } });
    _ppConsCity[c] = best;
  });
  var fill = function(id, counts){
    var dl = _ppEl(id); if(!dl) return;
    dl.innerHTML = '';
    Object.keys(counts).sort(function(a, b){ return counts[b] - counts[a]; }).slice(0, 1500).forEach(function(v){
      var o = document.createElement('option'); o.value = v; dl.appendChild(o);
    });
  };
  fill('ppConsList', cons); fill('ppCityList', cities); fill('ppShipList', ships);
}

// Last truck # used by the driver being covered (or the driver themselves)
function _ppGuessTruck(){
  var who = session ? (session.isSub && session.subFor ? session.subFor : session.name) : '';
  if(!who || !Array.isArray(manifests)) return '';
  var best = null;
  manifests.forEach(function(m){
    var owner = m.isSubstitute && m.subFor ? m.subFor : m.driverName;
    if(owner === who && m.truckNum && (!best || String(m.date) > String(best.date))) best = m;
  });
  return best ? best.truckNum : '';
}
function _ppGuessStart(){
  var who = session ? (session.isSub && session.subFor ? session.subFor : session.name) : '';
  if(!who || typeof getDriverRoster !== 'function') return '';
  var r = getDriverRoster().find(function(d){ return d.name === who; });
  if(!r || !r.startTime) return '';
  var dow = DAYS[new Date(localDateStr() + 'T12:00:00').getDay()];
  var days = (r.startDays && r.startDays.length) ? r.startDays : DAYS;
  return days.indexOf(dow) >= 0 ? r.startTime : '';
}

// ── Rendering ────────────────────────────────────────────────────────────────
function _ppCellHtml(t, i, c){
  var id = 'pp' + t + '_' + c.k + '_' + i;
  var base = 'id="' + id + '" style="width:' + c.w + 'px"';
  if(c.fixed) return '<td class="pp-fixed">' + c.fixed + '</td>';
  if(c.drop){
    var L = (typeof getDropLocations === 'function') ? getDropLocations() : {loc1:'849', loc2:'2000'};
    return '<td><select ' + base + ' onchange="_ppTotals();_ppQueueSave()"><option value=""></option>' +
      '<option>' + _mpEsc(L.loc1) + '</option><option>' + _mpEsc(L.loc2) + '</option></select></td>';
  }
  var attrs = ' type="text" autocomplete="off"';
  if(c.num) attrs = ' type="number" inputmode="decimal" min="0"';
  if(c.time) attrs = ' type="text" inputmode="numeric" onblur="_ppTimeBlur(this)"';
  if(c.list) attrs += ' list="' + c.list + '"';
  if(c.up) attrs += ' autocapitalize="characters" oninput="this.value=this.value.toUpperCase()"';
  var extra = (t === 'D' && c.k === 'consignee') ? ' onchange="_ppConsigneeChanged(' + i + ')"' : '';
  return '<td><input ' + base + attrs + extra + '></td>';
}
function _ppRowHtml(t, i){
  var cols = t === 'D' ? PAPER_DEL_COLS : PAPER_PU_COLS;
  return '<tr id="pp' + t + 'row_' + i + '"><td class="pp-n">' + (i + 1) + '</td>' +
    cols.map(function(c){ return _ppCellHtml(t, i, c); }).join('') + '</tr>';
}
function _ppHeadHtml(cols, groupRow){
  return '<thead>' + (groupRow || '') + '<tr><th class="pp-n">#</th>' +
    cols.map(function(c){ return '<th>' + c.h + '</th>'; }).join('') + '</tr></thead>';
}

function _ppRender(){
  var body = _ppEl('ppBody'); if(!body) return;
  var hdrField = function(label, inner){ return '<label class="pp-hf"><span>' + label + '</span>' + inner + '</label>'; };
  var puGroup = '<tr class="pp-grp"><th></th><th colspan="7">At Shipper</th><th colspan="3">At Drop Off</th></tr>';
  body.innerHTML =
    '<div class="pp-sheet">' +
      '<div class="pp-title">EXPEDITORS DRIVERS MANIFEST</div>' +
      '<div class="pp-hdr">' +
        hdrField('Driver Name', '<input id="ppName" readonly>') +
        hdrField('Date', '<input id="ppDate" type="date" onchange="_ppQueueSave()">') +
        hdrField('Truck #', '<input id="ppTruck" autocapitalize="characters" oninput="this.value=this.value.toUpperCase();_ppQueueSave()">') +
        hdrField('Driver\'s #', '<input id="ppDNum" readonly>') +
        hdrField('Start Time', '<input id="ppStart" inputmode="numeric" placeholder="0600" onblur="_ppTimeBlur(this)">') +
        hdrField('End Time', '<input id="ppEnd" inputmode="numeric" placeholder="1630" onblur="_ppTimeBlur(this)">') +
        hdrField('Starting Mileage', '<input id="ppSMi" type="number" inputmode="numeric" oninput="_ppTotals();_ppQueueSave()">') +
        hdrField('Ending Mileage', '<input id="ppEMi" type="number" inputmode="numeric" oninput="_ppTotals();_ppQueueSave()">') +
        hdrField('Total Mileage', '<input id="ppTotMi" readonly tabindex="-1">') +
      '</div>' +
      '<div class="pp-sec">Deliveries</div>' +
      '<div class="pp-scroll"><table class="pp-tbl" oninput="_ppTotals();_ppQueueSave()">' + _ppHeadHtml(PAPER_DEL_COLS) + '<tbody id="ppDelBody"></tbody></table></div>' +
      '<button class="pp-add" onclick="_ppAddRow(\'D\')">+ Add Delivery Line</button>' +
      '<div class="pp-sec">Pick Ups</div>' +
      '<div class="pp-scroll"><table class="pp-tbl" oninput="_ppTotals();_ppQueueSave()">' + _ppHeadHtml(PAPER_PU_COLS, puGroup) + '<tbody id="ppPuBody"></tbody></table></div>' +
      '<button class="pp-add" onclick="_ppAddRow(\'P\')">+ Add Pick Up Line</button>' +
      '<div class="pp-totals" id="ppTotals"></div>' +
      '<div class="pp-hint">Times: type 24-hour like <b>1430</b> (or 2:30p). Leave unused lines blank. Your work saves on this tablet automatically.</div>' +
      '<button class="pp-submit" id="ppSubmitBtn" onclick="submitPaperManifest()">Submit Manifest &#8594;</button>' +
      '<button class="pp-clear" onclick="clearPaperManifest()">Clear &amp; start over</button>' +
    '</div>' +
    '<datalist id="ppConsList"></datalist><datalist id="ppCityList"></datalist><datalist id="ppShipList"></datalist>';
  _ppDelRows = 0; _ppPuRows = 0;
  // clear a red "missing" highlight as soon as that box is filled in
  if(!body._ppClrBound){
    var clr = function(e){ if(e.target && e.target.classList && String(e.target.value || '').trim()) e.target.classList.remove('pp-bad'); };
    body.addEventListener('input', clr); body.addEventListener('change', clr); body._ppClrBound = true;
  }
}
function _ppAddRow(t, silent){
  var tb = _ppEl(t === 'D' ? 'ppDelBody' : 'ppPuBody'); if(!tb) return;
  var i = t === 'D' ? _ppDelRows++ : _ppPuRows++;
  tb.insertAdjacentHTML('beforeend', _ppRowHtml(t, i));
  if(!silent){
    var first = _ppEl('pp' + t + '_proNum_' + i);
    if(first){ first.focus(); first.scrollIntoView({behavior:'smooth', block:'center'}); }
    _ppQueueSave();
  }
}

// Consignee picked/typed -> fill City from its usual city if City is blank
function _ppConsigneeChanged(i){
  var cons = _ppVal('ppD_consignee_' + i).toUpperCase(), cityEl = _ppEl('ppD_city_' + i);
  if(!cityEl || cityEl.value.trim() || !_ppConsCity[cons]) return;
  cityEl.value = _ppConsCity[cons];
  cityEl.classList.add('pp-auto');
  setTimeout(function(){ cityEl.classList.remove('pp-auto'); }, 1500);
  _ppQueueSave();
}

// ── Row data ─────────────────────────────────────────────────────────────────
function _ppReadRow(t, i){
  var cols = t === 'D' ? PAPER_DEL_COLS : PAPER_PU_COLS, r = {};
  cols.forEach(function(c){ if(!c.fixed) r[c.k] = _ppVal('pp' + t + '_' + c.k + '_' + i); });
  return r;
}
function _ppRowUsed(r){ return Object.keys(r).some(function(k){ return r[k] !== ''; }); }
function _ppAllRows(t){
  var out = [], n = t === 'D' ? _ppDelRows : _ppPuRows;
  for(var i = 0; i < n; i++){ var r = _ppReadRow(t, i); if(_ppRowUsed(r)) out.push({i:i, r:r}); }
  return out;
}

function _ppTotals(){
  var sm = parseInt(_ppVal('ppSMi')) || 0, em = parseInt(_ppVal('ppEMi')) || 0;
  var tm = _ppEl('ppTotMi'); if(tm) tm.value = em > sm ? (em - sm) : '';
  var dels = _ppAllRows('D'), pus = _ppAllRows('P'), pcs = 0, wt = 0;
  dels.concat(pus).forEach(function(x){ pcs += parseInt(x.r.pieces) || 0; wt += parseFloat(x.r.weight) || 0; });
  var hrs = '';
  var st = _ppNormTime(_ppVal('ppStart')), et = _ppNormTime(_ppVal('ppEnd'));
  if(st && et){
    var a = st.split(':').map(Number), b = et.split(':').map(Number), s1 = a[0] * 60 + a[1], e1 = b[0] * 60 + b[1];
    if(e1 <= s1) e1 += 1440;
    hrs = ' · ' + (Math.round(((e1 - s1) / 60 - 0.5) * 100) / 100) + ' hrs';
  }
  var el = _ppEl('ppTotals');
  if(el) el.textContent = dels.length + ' deliveries · ' + pus.length + ' pick ups · ' + pcs + ' pcs · ' + wt.toLocaleString() + ' lbs' + hrs;
}

// ── Draft (saved on this tablet) ─────────────────────────────────────────────
function _ppQueueSave(){ if(_ppSaveTimer) clearTimeout(_ppSaveTimer); _ppSaveTimer = setTimeout(savePaperDraft, 400); }
function savePaperDraft(){
  if(!_ppEl('ppDate') || !session) return;
  var d = {savedAt:new Date().toISOString(), savedOn:localDateStr(), driverName:session.name, pendingId:_ppPendingId,
    date:_ppVal('ppDate'), truck:_ppVal('ppTruck'), start:_ppVal('ppStart'), end:_ppVal('ppEnd'), sMi:_ppVal('ppSMi'), eMi:_ppVal('ppEMi'),
    dels:[], pus:[]};
  for(var i = 0; i < _ppDelRows; i++) d.dels.push(_ppReadRow('D', i));
  for(var j = 0; j < _ppPuRows; j++) d.pus.push(_ppReadRow('P', j));
  try { localStorage.setItem(_ppKey(), JSON.stringify(d)); } catch(e) {}
}
function loadPaperDraft(){ try { var s = localStorage.getItem(_ppKey()); return s ? JSON.parse(s) : null; } catch(e) { return null; } }
function _ppDraftHasContent(d){
  return !!(d && ((d.dels || []).concat(d.pus || []).some(_ppRowUsed) || d.eMi));
}
function clearPaperDraft(){ try { localStorage.removeItem(_ppKey()); } catch(e) {} }
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState === 'hidden' && _ppEl('paperForm') && _ppEl('paperForm').classList.contains('active')) savePaperDraft();
});

// Home-screen button label: shows when a paper manifest is in progress / unsubmitted
function paperUpdateHomeBtn(){
  var btn = _ppEl('paperBtn'); if(!btn) return;
  var d = loadPaperDraft();
  if(_ppDraftHasContent(d)){
    var old = d.savedOn !== localDateStr();
    btn.innerHTML = '<span>&#128221;</span> ' + (old ? 'Finish &amp; Submit ' + fmtDraftDate(d.date) + ' Paper Manifest' : 'Continue Paper Manifest');
    btn.style.background = old ? '#d0021b' : '';
    btn.style.color = old ? 'white' : '';
  } else {
    btn.innerHTML = '<span>&#128221;</span> Paper-Style Manifest';
    btn.style.background = ''; btn.style.color = '';
  }
}

// ── Open / close ─────────────────────────────────────────────────────────────
function openPaperManifest(){
  _ppRender();
  _ppBuildHistory();
  var d = loadPaperDraft();
  if(d && d.driverName && session && d.driverName !== session.name) d = null;
  var nD = Math.max(PAPER_START_DEL_ROWS, d ? (d.dels || []).length : 0);
  var nP = Math.max(PAPER_START_PU_ROWS, d ? (d.pus || []).length : 0);
  for(var i = 0; i < nD; i++) _ppAddRow('D', true);
  for(var j = 0; j < nP; j++) _ppAddRow('P', true);
  _ppEl('ppName').value = session ? session.name + (session.isSub && session.subFor ? ' (sub for ' + session.subFor + ')' : '') : '';
  _ppEl('ppDNum').value = session ? (session.driverNum || '') : '';
  if(d){
    _ppPendingId = d.pendingId || null;
    _ppEl('ppDate').value = d.date || localDateStr();
    _ppEl('ppTruck').value = d.truck || ''; _ppEl('ppStart').value = d.start || ''; _ppEl('ppEnd').value = d.end || '';
    _ppEl('ppSMi').value = d.sMi || ''; _ppEl('ppEMi').value = d.eMi || '';
    var put = function(t, rows){ rows.forEach(function(r, i){ Object.keys(r).forEach(function(k){ var e = _ppEl('pp' + t + '_' + k + '_' + i); if(e) e.value = r[k]; }); }); };
    put('D', d.dels || []); put('P', d.pus || []);
    if(d.savedOn !== localDateStr() && _ppDraftHasContent(d)) showToast('⚠ This manifest from ' + fmtDraftDate(d.date) + ' was never submitted — finish it and tap Submit', 6000);
  } else {
    _ppPendingId = null;
    _ppEl('ppDate').value = localDateStr();
    _ppEl('ppTruck').value = _ppGuessTruck();
    _ppEl('ppStart').value = _ppGuessStart();
  }
  var meta = _ppEl('ppMeta');
  if(meta) meta.textContent = session && session.isSub && session.subFor ? 'SUB for ' + session.subFor : '';
  _ppTotals();
  ss('paperForm');
}
function paperBack(){ savePaperDraft(); ss(session ? 'home' : 'login'); }
function clearPaperManifest(){
  if(!confirm('Clear this whole manifest? Everything typed will be deleted.')) return;
  clearPaperDraft(); _ppPendingId = null; openPaperManifest(); showToast('Cleared');
}

// ── Submit ───────────────────────────────────────────────────────────────────
function _ppMark(el, bad){ if(el) el.classList.toggle('pp-bad', !!bad); }
function submitPaperManifest(){
  if(_ppInFlight) return;
  document.querySelectorAll('#ppBody .pp-bad').forEach(function(e){ e.classList.remove('pp-bad'); });
  var problems = [], firstBad = null;
  var need = function(id, label){
    var el = _ppEl(id), v = el ? String(el.value || '').trim() : '';
    if(!v){ _ppMark(el, true); problems.push(label); if(!firstBad) firstBad = el; }
    return v;
  };
  var needTime = function(id, label){
    var v = need(id, label); if(!v) return '';
    var n = _ppNormTime(v);
    if(!n){ _ppMark(_ppEl(id), true); problems.push(label + ' (bad time)'); if(!firstBad) firstBad = _ppEl(id); return ''; }
    _ppEl(id).value = n; return n;
  };
  var date = need('ppDate', 'Date'), truck = need('ppTruck', 'Truck #');
  var st = needTime('ppStart', 'Start Time'), et = needTime('ppEnd', 'End Time');
  var sm = parseInt(need('ppSMi', 'Starting Mileage')) || 0, em = parseInt(need('ppEMi', 'Ending Mileage')) || 0;
  if(sm && em && em < sm){ _ppMark(_ppEl('ppEMi'), true); problems.push('Ending Mileage is less than Starting'); if(!firstBad) firstBad = _ppEl('ppEMi'); }

  var dels = _ppAllRows('D'), pus = _ppAllRows('P');
  if(!dels.length && !pus.length){ showToast('Fill in at least one delivery or pick up line', 3500); return; }
  var checkRows = function(t, rows, cols, label){
    rows.forEach(function(x, n){
      cols.forEach(function(c){
        if(!c.req) return;
        var id = 'pp' + t + '_' + c.k + '_' + x.i;
        if(c.time) needTime(id, label + ' line ' + (x.i + 1) + ' ' + c.req);
        else need(id, label + ' line ' + (x.i + 1) + ' ' + c.req);
      });
    });
  };
  checkRows('D', dels, PAPER_DEL_COLS, 'Delivery');
  checkRows('P', pus, PAPER_PU_COLS, 'Pick up');
  if(problems.length){
    showToast('Missing: ' + problems.slice(0, 3).join(', ') + (problems.length > 3 ? ' +' + (problems.length - 3) + ' more (in red)' : ''), 6000);
    if(firstBad){ firstBad.scrollIntoView({behavior:'smooth', block:'center'}); setTimeout(function(){ try { firstBad.focus(); } catch(e) {} }, 300); }
    return;
  }

  var deliveries = dels.map(function(x){ var r = _ppReadRow('D', x.i); return {
    proNum:r.proNum, shipper:'Expeditors', pieces:parseInt(r.pieces) || 0, weight:parseFloat(r.weight) || 0,
    city:r.city, consignee:r.consignee, timeIn:r.timeIn, timeOut:r.timeOut, note:'', subDrops:[] }; });
  var pickups = pus.map(function(x){ var r = _ppReadRow('P', x.i); return {
    proNum:r.proNum, expRef:r.expRef, pieces:parseInt(r.pieces) || 0, weight:parseFloat(r.weight) || 0, shipper:r.shipper,
    pickupIn:r.pickupIn, pickupOut:r.pickupOut, dropLocation:r.dropLocation, arriveExp:r.arriveExp, departExp:r.departExp,
    consignee:'', deliverIn:'', deliverOut:'', note:'', subPickups:[] }; });

  if(!confirm('Submit manifest for ' + fmtDraftDate(date) + '?\n\n' + deliveries.length + ' deliveries · ' + pickups.length + ' pick ups\nStart ' + st + ' · End ' + et + ' · ' + (em - sm) + ' miles')) return;

  var m = _buildManifestRecord({name:session ? session.name : _ppVal('ppName'), truck:truck, date:date, st:st, et:et, sm:sm, em:em, deliveries:deliveries, pickups:pickups});
  m.entryMode = 'paper';
  if(_ppPendingId) m.id = _ppPendingId; else _ppPendingId = m.id;
  savePaperDraft(); // pendingId saved with the draft, so a later retry can't duplicate

  var btn = _ppEl('ppSubmitBtn'); if(btn) btn.disabled = true;
  _ppInFlight = true;
  showToast('Submitting…', 120000);
  mergeAndSaveManifest(m).catch(function(e){ console.error('Paper submit error:', e); return {ok:false}; }).then(function(result){
    _ppInFlight = false;
    if(btn) btn.disabled = false;
    if(!result || !result.ok){
      showToast('⚠ Not submitted — no connection. Your manifest is SAVED on this tablet. Tap Submit again, or finish it later from the home screen.', 10000);
      return;
    }
    _ppPendingId = null;
    clearPaperDraft();
    showToast('✓ Manifest submitted!');
    setTimeout(function(){ ss(session ? 'home' : 'login'); }, 1500);
  });
}
