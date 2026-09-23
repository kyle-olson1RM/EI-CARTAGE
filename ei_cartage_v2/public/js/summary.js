
// ── SUMMARY HELPER FUNCTIONS ─────────────────────────────────────────────────
function fs(d){
  if(!d)return'';
  var dt=new Date(d+'T12:00:00');
  return dt.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}

function getMon(d){
  var dt=new Date(d+'T12:00:00');
  var dy=dt.getDay();
  dt.setDate(dt.getDate()+(dy===0?-6:1-dy));
  return dt.toISOString().split('T')[0];
}

function wkLbl(mon){
  var sun=new Date(mon+'T12:00:00'); sun.setDate(sun.getDate()-1);
  var sat=new Date(mon+'T12:00:00'); sat.setDate(sat.getDate()+5);
  return fs(sun.toISOString().split('T')[0])+' — '+fs(sat.toISOString().split('T')[0]);
}

function allWks(){
  var weeks=new Set();
  var adminNames0=getAdminDriverNames();
  manifests.forEach(function(m){if(m.date&&!adminNames0.has(m.driverName))weeks.add(getMon(m.date));});
  // Use a local-date string for "today" rather than toISOString(), which
  // converts to UTC first and can land on tomorrow's date during evening
  // hours in US timezones — that could push currentMon a full week ahead
  // whenever "tomorrow" crosses a Sunday-to-Monday boundary.
  var _pad=function(n){return String(n).padStart(2,'0');};
  var _lfmt=function(d){return d.getFullYear()+'-'+_pad(d.getMonth()+1)+'-'+_pad(d.getDate());};
  var today=new Date();
  var currentMon=getMon(_lfmt(today));
  var eightWeeksAgo=new Date(today);
  eightWeeksAgo.setDate(eightWeeksAgo.getDate()-56);
  var startMon=getMon(_lfmt(eightWeeksAgo));
  var allDataWeeks=[...weeks].sort();
  if(allDataWeeks.length&&allDataWeeks[0]<startMon)startMon=allDataWeeks[0];
  var cursor=new Date(startMon+'T12:00:00');
  var cursorMon=getMon(currentMon);
  while(true){
    var wk=getMon(cursor.toISOString().split('T')[0]);
    weeks.add(wk);
    if(wk>=cursorMon)break;
    cursor.setDate(cursor.getDate()+7);
    if(cursor>new Date(cursorMon+'T12:00:00'))break;
  }
  weeks.add(currentMon);
  return[...weeks].sort().reverse();
}

/**
 * summary.js
 * Weekly summary, custom date range stats, print to PDF,
 * CSV download, and customer read-only view.
 */


// ── PRINT / EXPORT ────────────────────────────────────────────────────────────
function printSummary(){
  var content=document.getElementById('sumContent'),weekSel=document.getElementById('weekSel');
  var weekLabel=weekSel&&weekSel.selectedIndex>=0?weekSel.options[weekSel.selectedIndex].text:'';
  var printDate=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

  // Build a print-only copy of the summary: unit number only (no driver
  // name), and any unit with zero activity this week dropped entirely.
  // This is what goes out as the customer invoice, so idle units and
  // internal driver names are just noise on it. The live in-app Summary
  // page (with driver names, including idle units) is untouched.
  var clone = content.cloneNode(true);
  var table = clone.querySelector('table.sum-tbl');
  if(table){
    table.querySelectorAll('tr.zero-row').forEach(function(tr){ tr.remove(); });
    var headerCells = table.querySelectorAll('thead tr th');
    if(headerCells[1]) headerCells[1].remove(); // Driver header
    // Every remaining row either leads with a plain Unit cell + Driver cell
    // (regular driver rows), or a colspan="2" label cell already spanning
    // Unit+Driver (the J Files line and the TOTAL line). Handle both by
    // shape rather than by tbody/tfoot position, since J Files now lives
    // in the body (between the TT and ST groups) rather than the footer.
    table.querySelectorAll('tbody tr, tfoot tr').forEach(function(tr){
      var cells = tr.querySelectorAll('td');
      var first = cells[0];
      if(first && first.hasAttribute('colspan')){
        first.setAttribute('colspan','1'); // was Unit+Driver, now just Unit
      } else if(cells[1]){
        cells[1].remove(); // drop the Driver name cell
      }
    });
  }

  var win=window.open('','_blank','width=1100,height=800');
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>EI Cartage Summary</title><style>body{font-family:Arial,sans-serif;margin:0;padding:16px;color:#1a1a1a;background:white;}h1{font-size:20px;font-weight:800;color:#E31837;margin:0 0 2px}.sub{font-size:12px;color:#666;margin-bottom:14px;}.grand-box{background:#b91c1c;color:white;border-radius:6px;padding:12px 16px;margin-bottom:14px;}.grand-box h3{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.5);margin:0 0 8px}.grand-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:8px;}.gi{text-align:center;}.gi-val{font-size:22px;font-weight:800;color:white;line-height:1;}.gi-val,.gi-charges{font-size:22px;font-weight:800;color:white;line-height:1;}.gi-lbl{font-size:9px;color:rgba(255,255,255,.5);text-transform:uppercase;margin-top:2px;}.sum-report{border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;margin-bottom:14px;}.sum-report-head{background:#E31837;color:white;padding:10px 14px;}.srh-title{font-size:16px;font-weight:800;}.srh-week{font-size:11px;color:rgba(255,255,255,.75);margin-top:2px;}table{width:100%;border-collapse:collapse;font-size:12px;}th{background:#b91c1c;color:rgba(255,255,255,.85);padding:7px 10px;text-align:right;font-size:9px;font-weight:700;text-transform:uppercase;}th:first-child{text-align:left;}td{padding:7px 10px;text-align:right;border-bottom:1px solid #e0e0e0;}td:first-child{text-align:left;}.data-row td{background:white;}.zero-row td{background:#f7f7f7;color:#888;}.total-row td{background:#b91c1c;color:white;font-weight:700;font-size:13px;}.chg-cell{color:#E31837;font-weight:700;}.total-row .chg-cell{color:#ffd700;font-size:15px;}.sum-stats{border-top:2px solid #e0e0e0;padding:10px 14px;}.ss-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #e0e0e0;font-size:13px;}.ss-row:last-child{border-bottom:none;}.ss-val{font-size:17px;font-weight:700;color:#E31837;}@media print{@page{size:landscape;margin:.4in;}}</style></head><body><h1>EI Cartage &mdash; Weekly Summary</h1><div class="sub">'+weekLabel+' &nbsp;|&nbsp; Printed: '+printDate+'</div>'+clone.innerHTML+'<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script></body></html>');
  win.document.close();
}
function openRangeStats(){ss('rangeStats');}
function rsPreset(p){
  var today=new Date(),pad=function(n){return String(n).padStart(2,'0');},fmt=function(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
  var from='',to=fmt(today);
  if(p==='month')from=fmt(new Date(today.getFullYear(),today.getMonth(),1));
  else if(p==='last30'){var d=new Date(today);d.setDate(d.getDate()-30);from=fmt(d);}
  else if(p==='quarter'){var d2=new Date(today);d2.setDate(d2.getDate()-90);from=fmt(d2);}
  else if(p==='year')from=fmt(new Date(today.getFullYear(),0,1));
  else if(p==='all'){from='';to='';}
  document.getElementById('rsFrom').value=from;document.getElementById('rsTo').value=to;
  renderRangeStats();
}
function renderRangeStats(){
  var from=document.getElementById('rsFrom')?.value,to=document.getElementById('rsTo')?.value,el=document.getElementById('rsContent');if(!el)return;
  var adminNames=getAdminDriverNames();
  var filtered=manifests.filter(function(m){return !adminNames.has(m.driverName);});
  if(from)filtered=filtered.filter(function(m){return m.date>=from;});
  if(to)filtered=filtered.filter(function(m){return m.date<=to;});
  var holidays=getHolidayCharges(from||'',to||'');
  if(!filtered.length&&!holidays.length){el.innerHTML='<div class="no-data"><div style="font-size:36px;margin-bottom:10px">&#128197;</div><div style="font-family:Barlow Condensed,sans-serif;font-size:20px;font-weight:700">No data in this range</div></div>';return;}
  var dateLabel=from&&to?fs(from)+' \u2013 '+fs(to):from?'From '+fs(from):to?'Through '+fs(to):'All Time';
  var dm={};filtered.forEach(function(m){if(!dm[m.driverName])dm[m.driverName]={del:0,pu:0,ship:0,wt:0,mi:0,hrs:0,days:new Set()};dm[m.driverName].del+=m.ttlDeliveries||0;dm[m.driverName].pu+=m.ttlPickups||0;dm[m.driverName].ship+=m.ttlShipments||0;dm[m.driverName].wt+=m.ttlWeight||0;dm[m.driverName].mi+=m.totalMiles||0;dm[m.driverName].hrs+=getEffectiveHours(m);dm[m.driverName].days.add(m.date);});
  var gD=0,gP=0,gS=0,gW=0,gM=0,gH=0,gC=0;
  Object.keys(dm).forEach(function(n){var d=dm[n];gH+=d.hrs;});
  var workedH=gH; // shipments/hr stays based on hours actually worked
  gH=0;
  // Holiday: add each unit's 8-hr holiday day(s) into its own row
  holidays.forEach(function(h){h.units.forEach(function(u){
    if(!dm[u.name])dm[u.name]={del:0,pu:0,ship:0,wt:0,mi:0,hrs:0,days:new Set()};
    dm[u.name].hrs+=u.hours;dm[u.name].hlHrs=(dm[u.name].hlHrs||0)+u.hours;dm[u.name].days.add(h.date);
  });});
  Object.keys(dm).forEach(function(n){var d=dm[n],r=rate(n),c=d.hrs*r;gD+=d.del;gP+=d.pu;gS+=d.ship;gW+=d.wt;gM+=d.mi;gH+=d.hrs;gC+=c;});
  var roster=getDriverRoster().filter(function(d){return !d.isAdmin;});
  var totalDays=new Set(filtered.map(function(m){return m.date;})).size;
  var acps=gS>0?gC/gS:0,acpl=gW>0?gC/gW:0,asph=workedH>0?gS/workedH:0,acpm=gM>0?gC/gM:0,amd=totalDays>0?gM/totalDays:0;
  var rowsHtml=roster.map(function(d){
    var data=dm[d.name],r=rate(d.name);
    if(!data)return '<tr class="zero-row"><td><strong>'+d.unit+'</strong></td><td>'+d.name+'</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0.00</td><td>0</td><td>$0.00</td></tr>';
    var c=data.hrs*r,dw=data.days.size;
    return '<tr class="data-row"><td><strong>'+d.unit+'</strong></td><td>'+d.name+'</td><td>'+data.del+'</td><td>'+data.pu+'</td><td>'+data.ship+'</td><td>'+data.wt.toLocaleString()+'</td><td>'+data.mi+'</td><td>'+data.hrs.toFixed(2)+_hlMark(data.hlHrs||0)+'</td><td>'+dw+'</td><td class="chg-cell">$'+c.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td></tr>';
  }).join('');
  el.innerHTML='<div class="sum-report"><div class="sum-report-head"><div class="srh-title">Expeditors Cartage Program</div><div class="srh-week">Custom Range: '+dateLabel+' &nbsp;&middot;&nbsp; '+filtered.length+' manifest'+(filtered.length!==1?'s':'')+_hlNote(holidays)+'</div></div><div style="overflow-x:auto"><table class="sum-tbl"><thead><tr><th>Unit</th><th>Driver</th><th>Deliveries</th><th>Pick Ups</th><th>Shipments</th><th>Weight (lbs)</th><th>Miles</th><th>Hours</th><th>Days</th><th>Charges</th></tr></thead><tbody>'+rowsHtml+'</tbody><tfoot><tr class="total-row"><td colspan="2"><strong>TOTAL</strong></td><td>'+gD+'</td><td>'+gP+'</td><td>'+gS+'</td><td>'+gW.toLocaleString()+'</td><td>'+gM+'</td><td>'+gH.toFixed(2)+'</td><td>'+totalDays+'</td><td class="chg-cell">$'+gC.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td></tr></tfoot></table></div><div class="sum-stats"><div class="ss-row"><div class="ss-lbl">Average Cost Per Shipment</div><div class="ss-val">$'+acps.toFixed(2)+'</div></div><div class="ss-row"><div class="ss-lbl">Average Cost Per Pound</div><div class="ss-val">$'+acpl.toFixed(4)+'</div></div><div class="ss-row"><div class="ss-lbl">Average Shipments Per Hour</div><div class="ss-val">'+asph.toFixed(2)+'</div></div><div class="ss-row"><div class="ss-lbl">Average Miles Per Day</div><div class="ss-val">'+amd.toFixed(1)+'</div></div><div class="ss-row"><div class="ss-lbl">Average Cost Per Mile</div><div class="ss-val">$'+acpm.toFixed(2)+'</div></div><div class="ss-row"><div class="ss-lbl">Total Days with Activity</div><div class="ss-val">'+totalDays+'</div></div></div></div>';
}
function dlRangeReport(){
  var from=document.getElementById('rsFrom')?.value,to=document.getElementById('rsTo')?.value;
  var adminNames=getAdminDriverNames();
  var filtered=manifests.filter(function(m){return !adminNames.has(m.driverName);});
  if(from)filtered=filtered.filter(function(m){return m.date>=from;});
  if(to)filtered=filtered.filter(function(m){return m.date<=to;});
  var holidays=getHolidayCharges(from||'',to||'');
  if(!filtered.length&&!holidays.length){showToast('No data to download');return;}
  var dm={};filtered.forEach(function(m){if(!dm[m.driverName])dm[m.driverName]={del:0,pu:0,ship:0,wt:0,mi:0,hrs:0};dm[m.driverName].del+=m.ttlDeliveries||0;dm[m.driverName].pu+=m.ttlPickups||0;dm[m.driverName].ship+=m.ttlShipments||0;dm[m.driverName].wt+=m.ttlWeight||0;dm[m.driverName].mi+=m.totalMiles||0;dm[m.driverName].hrs+=getEffectiveHours(m);});
  var workedH=0;Object.keys(dm).forEach(function(n){workedH+=dm[n].hrs;});
  holidays.forEach(function(h){h.units.forEach(function(u){
    if(!dm[u.name])dm[u.name]={del:0,pu:0,ship:0,wt:0,mi:0,hrs:0};
    dm[u.name].hrs+=u.hours;dm[u.name].hlHrs=(dm[u.name].hlHrs||0)+u.hours;
  });});
  var dateLabel=from&&to?from+' to '+to:from?'From '+from:to?'Through '+to:'All Time';
  var gD=0,gP=0,gS=0,gW=0,gM=0,gH=0,gC=0;
  var csv='EI Cartage Report - '+dateLabel+'\n\nDriver,Unit,TTL Deliveries,TTL Pick Ups,TTL Shipments,TTL Weight (lbs),TTL Miles,TTL Hours,Charges,Holiday Hrs Included\n';
  getDriverRoster().filter(function(d){return !d.isAdmin;}).forEach(function(drv){var name=drv.name,unit=drv.unit,d=dm[name],r=rate(name);if(!d)return;var c=d.hrs*r;csv+=name+','+unit+','+d.del+','+d.pu+','+d.ship+','+d.wt+','+d.mi+','+d.hrs.toFixed(2)+',$'+c.toFixed(2)+','+(d.hlHrs||0)+'\n';gD+=d.del;gP+=d.pu;gS+=d.ship;gW+=d.wt;gM+=d.mi;gH+=d.hrs;gC+=c;});
  if(holidays.length)csv+='"Includes '+holidays.map(holidayLabel).join(', ')+' - '+HOLIDAY_HOURS+' hrs billed per unit"\n';
  csv+='\nTOTAL,,'+gD+','+gP+','+gS+','+gW+','+gM+','+gH.toFixed(2)+',$'+gC.toFixed(2)+'\n';
  var acps=gS>0?gC/gS:0,acpl=gW>0?gC/gW:0,asph=workedH>0?gS/workedH:0,acpm=gM>0?gC/gM:0;
  csv+='\nAvg Cost/Shipment,$'+acps.toFixed(2)+'\nAvg Cost/lb,$'+acpl.toFixed(4)+'\nShipments/Hr,'+asph.toFixed(2)+'\nAvg Cost/Mile,$'+acpm.toFixed(2)+'\n';
  var blob=new Blob([csv],{type:'text/csv'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='EI_Cartage_Report.csv';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);showToast('Report downloaded');
}

// ── CUSTOMER VIEW ─────────────────────────────────────────────────────────────
var CUSTOMER_CODE=cacheGet('ei_customer_code')||'EXP2025';
function openCustomerLogin(){
  document.getElementById('custCode').value='';document.getElementById('custLoginErr').textContent='';
  document.getElementById('custLoginOv').classList.add('open');
  setTimeout(function(){document.getElementById('custCode').focus();},100);
}
async function doCustomerLogin(){
  var errEl=document.getElementById('custLoginErr');
  var codeEl=document.getElementById('custCode');
  var code=(codeEl?codeEl.value||'':'').trim().toUpperCase();
  if(!code){if(errEl)errEl.textContent='Please enter the access code';return;}
  var ok=false;
  try{
    var res=await fetch('/api/verify',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({kind:'customer',value:code})
    });
    if(res.ok){ok=(await res.json()).ok;}
    else{
      // Server unreachable/misconfigured — fall back to local default
      var stored=(_cache&&_cache['ei_customer_code'])||localStorage.getItem('ei_customer_code');
      var currentCode=stored?stored.trim().toUpperCase():'EXP2025';
      ok=(code===currentCode)||(code==='EXP2025'&&!stored);
    }
  }catch(e){
    var stored2=(_cache&&_cache['ei_customer_code'])||localStorage.getItem('ei_customer_code');
    var currentCode2=stored2?stored2.trim().toUpperCase():'EXP2025';
    ok=(code===currentCode2)||(code==='EXP2025'&&!stored2);
  }
  if(ok){
    var ov=document.getElementById('custLoginOv');
    if(ov)ov.classList.remove('open');
    if(errEl)errEl.textContent='';
    ss('customerDash');
    try{
      populateCustWeekSel();
      renderCustomerDash();
    }catch(e){
      console.error('Customer dash error:',e);
      document.getElementById('custContent').innerHTML='<div style="padding:20px;color:red">Error loading dashboard. Please refresh.</div>';
    }
  }else{
    if(errEl)errEl.textContent='Incorrect access code';
    if(codeEl)codeEl.value='';
    if(codeEl)codeEl.focus();
  }
}
function populateCustWeekSel(){
  var weeks=allWks(),sel=document.getElementById('custWeekSel'),cur=sel.value;
  if(!weeks.length){sel.innerHTML='<option value="">No data yet</option>';return;}
  sel.innerHTML=weeks.map(function(w){return'<option value="'+w+'" '+(w===cur?'selected':'')+'>'+wkLbl(w)+'</option>';}).join('');
  if(!cur||!weeks.includes(cur))sel.value=weeks[0];
}
function shiftCustWeek(dir){
  var sel=document.getElementById('custWeekSel'),opts=[].slice.call(sel.options),idx=opts.findIndex(function(o){return o.value===sel.value;}),ni=idx-dir;
  if(ni>=0&&ni<opts.length){sel.value=opts[ni].value;renderCustomerDash();}
}
var _custMon="",_custFriday="";
function renderCustomerDash(){
  var mon=document.getElementById('custWeekSel').value;
  var el=document.getElementById('custContent'),ml=document.getElementById('custWeekLabel');
  if(!mon){el.innerHTML='<div class="no-data"><div style="font-size:36px;margin-bottom:10px">&#128203;</div><div style="font-family:Barlow Condensed,sans-serif;font-size:20px;font-weight:700">No data yet</div></div>';return;}
  var friDt=new Date(mon+'T12:00:00');friDt.setDate(friDt.getDate()+5);
  var friday=friDt.toISOString().split('T')[0];
  var sunDt=new Date(mon+'T12:00:00');sunDt.setDate(sunDt.getDate()-1);
  var sunday=sunDt.toISOString().split('T')[0];
  _custMon=sunday;_custFriday=friday;
  if(ml)ml.textContent=fs(sunday)+' — '+fs(friday);

  var roster=getDriverRoster().filter(function(d){return !d.isAdmin;});
  var wm=manifests.filter(function(m){return m.date>=sunday&&m.date<=friday;});
  var dm={};
  wm.forEach(function(m){
    var key=m.isSubstitute&&m.subFor?m.subFor:m.driverName;
    if(!dm[key])dm[key]=[];dm[key].push(m);
  });

  // Holiday: each billable unit gets an 8-hr day added to its own row
  var holidays=getHolidayCharges(sunday,friday);
  var hlByDrv=getHolidayDaysByDriver(holidays);
  var gD=0,gP=0,gS=0,gW=0,gM=0,gH=0,gC=0;
  roster.forEach(function(drv){
    var d=dm[drv.name]||[],hd=hlByDrv[drv.name]||[];
    var r=rate(drv.name),c=0;
    d.forEach(function(m){gD+=m.ttlDeliveries||0;gP+=m.ttlPickups||0;gS+=m.ttlShipments||0;gW+=m.ttlWeight||0;gM+=m.totalMiles||0;gH+=getEffectiveHours(m);c+=getEffectiveHours(m)*r;});
    hd.forEach(function(x){gH+=x.hours;c+=x.hours*r;});
    gC+=c;
  });

  // J Files for this week
  var allJF=[];try{allJF=JSON.parse(cacheGet('ei_jfiles')||'[]');}catch(e){}
  var weekJF=allJF.filter(function(j){return j.date>=sunday&&j.date<=friday;});
  var jfTotal=weekJF.reduce(function(s,j){return s+(parseFloat(j.price)||0);},0);
  var jfWt=weekJF.reduce(function(s,j){return s+(parseFloat(j.wt)||0);},0);
  var grandC=gC+jfTotal;
  var grandW=gW+jfWt;
  var jfRow=weekJF.length
    ?'<tr class="data-row" style="background:#fffbeb"><td colspan="2"><strong>&#128196; J Files</strong> ('+weekJF.length+')</td><td>—</td><td>—</td><td>'+weekJF.length+'</td><td>'+jfWt.toLocaleString()+'</td><td>—</td><td>—</td><td class="chg-cell" style="color:#d97706">$'+jfTotal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td><td></td></tr>'
    :'';

  var tbodyHtml=roster.map(function(drv){
    var name=drv.name,unit=drv.unit,d=dm[name]||[],hd=hlByDrv[name]||[],r=rate(name);
    if(!d.length&&!hd.length)return '<tr class="zero-row"><td><strong>'+unit+'</strong></td><td>'+name+'</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0.00</td><td>$0.00</td><td></td></tr>';
    var wD=0,wP=0,wS=0,wW=0,wM=0,wH=0;
    d.forEach(function(m){wD+=m.ttlDeliveries||0;wP+=m.ttlPickups||0;wS+=m.ttlShipments||0;wW+=m.ttlWeight||0;wM+=m.totalMiles||0;wH+=getEffectiveHours(m);});
    var hH=hd.reduce(function(s,x){return s+x.hours;},0);
    wH+=hH;
    var wC=wH*r;
    return '<tr class="data-row" style="cursor:pointer" data-dname="'+name+'" onclick="custToggleDriver(this.dataset.dname,this)">'
      +'<td><strong>'+unit+'</strong></td><td>'+name+'</td><td>'+wD+'</td><td>'+wP+'</td><td>'+wS+'</td>'
      +'<td>'+wW.toLocaleString()+'</td><td>'+wM+'</td><td>'+wH.toFixed(2)+_hlMark(hH)+'</td>'
      +'<td class="chg-cell">$'+wC.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
      +'<td style="text-align:center;color:var(--accent);font-size:16px">&#9660;</td>'
      +'</tr>'
      +'<tr id="custdetail_'+name.replace(/[^a-zA-Z0-9]/g,'_')+'" style="display:none">'
      +'<td colspan="10" style="padding:0;background:var(--surface2)">'
      +custBuildDetail(d,name,sunday,friday,hd)
      +'</td></tr>';
  }).join('');

  el.innerHTML=
    '<div style="display:flex;justify-content:flex-end;margin-bottom:10px">'
    +'<button onclick="custExportAll()" style="height:38px;padding:0 16px;border-radius:6px;border:none;background:var(--accent);color:white;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;cursor:pointer;touch-action:manipulation">&#11015; Export All Ref #s (CSV)</button>'
    +'</div>'
    +'<div class="grand-box"><h3>Program Totals &mdash; '+fs(sunday)+' &mdash; '+fs(friday)+'</h3>'
    +'<div class="grand-grid">'
    +'<div class="gi"><div class="gi-val">'+gD+'</div><div class="gi-lbl">Deliveries</div></div>'
    +'<div class="gi"><div class="gi-val">'+gP+'</div><div class="gi-lbl">Pick Ups</div></div>'
    +'<div class="gi"><div class="gi-val">'+gS+'</div><div class="gi-lbl">Shipments</div></div>'
    +'<div class="gi"><div class="gi-val">'+grandW.toLocaleString()+'</div><div class="gi-lbl">Weight (lbs)</div></div>'
    +'<div class="gi"><div class="gi-val">'+gM.toLocaleString()+'</div><div class="gi-lbl">Miles</div></div>'
    +'<div class="gi"><div class="gi-val">'+gH.toFixed(2)+'</div><div class="gi-lbl">Hours</div></div>'
    +'<div class="gi"><div class="gi-val">$'+grandC.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</div><div class="gi-lbl">Total Charges</div></div>'
    +'<div class="gi"><div class="gi-val">$'+(grandW>0?(grandC/grandW).toFixed(4):'0.0000')+'</div><div class="gi-lbl">Cost Per Lb</div></div>'
    +'</div></div>'
    +'<div class="sum-report">'
    +'<div class="sum-report-head"><div class="srh-title">Expeditors Cartage Program</div><div class="srh-week">'+fs(sunday)+' — '+fs(friday)+' &nbsp;&middot;&nbsp; Click a driver row to see stop details'+_hlNote(holidays)+'</div></div>'
    +'<div style="overflow-x:auto"><table class="sum-tbl">'
    +'<thead><tr><th>Unit</th><th>Driver</th><th>Deliveries</th><th>Pick Ups</th><th>Shipments</th><th>Weight (lbs)</th><th>Miles</th><th>Hours</th><th>Charges</th><th></th></tr></thead>'
    +'<tbody>'+tbodyHtml+'</tbody>'
    +'<tfoot>'+jfRow+'<tr class="total-row"><td colspan="2"><strong>TOTAL</strong></td><td>'+gD+'</td><td>'+gP+'</td><td>'+gS+'</td><td>'+grandW.toLocaleString()+'</td><td>'+gM+'</td><td>'+gH.toFixed(2)+'</td><td class="chg-cell">$'+grandC.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td><td></td></tr></tfoot>'
    +'</table></div>'
    +'</div>';
}


function custBuildDetail(manifests_arr, driverName, mon, friday, holidayDays){
  // Collect all deliveries and pickups for this driver this week
  var allDels=[], allPUs=[];
  manifests_arr.forEach(function(m){
    (m.deliveries||[]).forEach(function(d){allDels.push({date:m.date,proNum:d.proNum,consignee:d.consignee,city:d.city,pieces:d.pieces,weight:d.weight||d.wt||0});});
    (m.pickups||[]).forEach(function(p){allPUs.push({date:m.date,proNum:p.proNum,shipper:p.shipper,pieces:p.pieces,weight:p.weight||p.wt||0,drop:p.dropLocation});});
  });

  var html='<div style="padding:12px 16px;overflow-x:auto">'; 

  // Export button for this driver
  html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
    +'<span style="font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--accent)">'+driverName+' — Stop Detail</span>'
    +'<button data-dname="'+driverName+'" data-mon="'+mon+'" data-fri="'+friday+'" onclick="custExportDriver(this.dataset.dname,this.dataset.mon,this.dataset.fri)" style="height:34px;padding:0 14px;border-radius:5px;border:none;background:var(--accent);color:white;font-family:Barlow Condensed,sans-serif;font-size:13px;font-weight:700;cursor:pointer;touch-action:manipulation">&#11015; Export CSV</button>'
    +'</div>';

  if(allDels.length){
    html+='<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#E31837;margin-bottom:6px">Deliveries ('+allDels.length+')</div>';
    html+='<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px;table-layout:fixed">'
      +'<thead><tr style="background:#1a1a1a;color:white">'
      +'<th style="padding:6px 8px;text-align:left;width:15%">Date</th>'
      +'<th style="padding:6px 8px;text-align:left;width:15%">Pro #</th>'
      +'<th style="padding:6px 8px;text-align:left;width:35%">Consignee</th>'
      +'<th style="padding:6px 8px;text-align:left;width:15%">City</th>'
      +'<th style="padding:6px 8px;text-align:left;width:8%">Pcs</th>'
      +'<th style="padding:6px 8px;text-align:left;width:8%">Lbs</th>'
      +'<th style="padding:6px 8px;width:4%"></th>'
      +'</tr></thead><tbody>';
    allDels.forEach(function(d,i){
      html+='<tr style="background:'+(i%2===0?'white':'var(--surface2)')+';">'
        +'<td style="padding:6px 8px;text-align:left;white-space:nowrap">'+fs(d.date)+'</td>'
        +'<td style="padding:6px 8px;text-align:left;font-family:monospace;font-weight:700;color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(d.proNum||'—')+'</td>'
        +'<td style="padding:6px 8px;text-align:left;overflow:hidden;text-overflow:ellipsis;max-width:0">'+(d.consignee||'—')+'</td>'
        +'<td style="padding:6px 8px;text-align:left;overflow:hidden;text-overflow:ellipsis;max-width:0">'+(d.city||'—')+'</td>'
        +'<td style="padding:6px 8px;text-align:left">'+(d.pieces||0)+'</td>'
        +'<td style="padding:6px 8px;text-align:left">'+(d.weight||0)+'</td>'
        +'<td></td>'
        +'</tr>';
    });
    html+='</tbody></table>';
  }

  if(allPUs.length){
    html+='<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#185FA5;margin-bottom:6px">Pick Ups ('+allPUs.length+')</div>';
    html+='<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px;table-layout:fixed">'
      +'<thead><tr style="background:#1a1a1a;color:white">'
      +'<th style="padding:6px 8px;text-align:left;width:15%">Date</th>'
      +'<th style="padding:6px 8px;text-align:left;width:15%">Exp Ref #</th>'
      +'<th style="padding:6px 8px;text-align:left;width:35%">Shipper</th>'
      +'<th style="padding:6px 8px;text-align:left;width:8%">Pcs</th>'
      +'<th style="padding:6px 8px;text-align:left;width:8%">Lbs</th>'
      +'<th style="padding:6px 8px;text-align:left;width:15%">Drop</th>'
      +'<th style="padding:6px 8px;width:4%"></th>'
      +'</tr></thead><tbody>';
    allPUs.forEach(function(p,i){
      html+='<tr style="background:'+(i%2===0?'#f0f5ff':'#e8f0fe')+';">'
        +'<td style="padding:6px 8px;text-align:left;white-space:nowrap">'+fs(p.date)+'</td>'
        +'<td style="padding:6px 8px;text-align:left;font-family:monospace;font-weight:700;color:#185FA5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(p.expRef||p.proNum||'—')+'</td>'
        +'<td style="padding:6px 8px;text-align:left;overflow:hidden;text-overflow:ellipsis;max-width:0">'+(p.shipper||'—')+'</td>'
        +'<td style="padding:6px 8px;text-align:left">'+(p.pieces||0)+'</td>'
        +'<td style="padding:6px 8px;text-align:left">'+(p.weight||0)+'</td>'
        +'<td style="padding:6px 8px;text-align:left;overflow:hidden;text-overflow:ellipsis;max-width:0">'+(p.drop||'—')+'</td>'
        +'<td></td>'
        +'</tr>';
    });
    html+='</tbody></table>';
  }

  (holidayDays||[]).forEach(function(x){
    html+='<div style="background:#ecfdf5;border-left:3px solid #059669;padding:6px 10px;margin-bottom:8px;font-size:12px;color:#065f46"><strong>&#127881; '+x.dayOfWeek+' '+fs(x.date)+' &mdash; '+x.holiday+'</strong> &middot; No service &middot; '+x.hours+' hrs billed</div>';
  });
  if(!allDels.length && !allPUs.length && !(holidayDays||[]).length){
    html+='<div style="color:var(--muted);font-size:13px;padding:8px 0">No stop detail available for this driver this week.</div>';
  }

  html+='</div>';
  return html;
}

function custToggleDriver(name, row){
  var safeId=name.replace(/[^a-zA-Z0-9]/g,'_');
  var detailRow=document.getElementById('custdetail_'+safeId);
  if(!detailRow)return;
  var isOpen=detailRow.style.display!=='none';
  // Close all others first
  document.querySelectorAll('[id^="custdetail_"]').forEach(function(r){r.style.display='none';});
  document.querySelectorAll('.data-row td:last-child').forEach(function(td){td.innerHTML='&#9660;';});
  if(!isOpen){
    detailRow.style.display='table-row';
    row.querySelector('td:last-child').innerHTML='&#9650;';
    detailRow.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
}

function custExportDriver(driverName, mon, friday){
  var driverMans=manifests.filter(function(m){return m.driverName===driverName&&m.date>=mon&&m.date<=friday;});
  var rows=['Driver,Unit,Date,Type,Pro #/Ref #,Consignee/Shipper,City,Pieces,Weight (lbs),Drop Location'];
  var unit=getDriverRoster().find(function(d){return d.name===driverName;});
  var unitStr=unit?unit.unit:'';
  driverMans.forEach(function(m){
    (m.deliveries||[]).forEach(function(d){
      rows.push([driverName,unitStr,m.date,'Delivery',d.proNum||'',d.consignee||'',d.city||'',d.pieces||0,d.weight||d.wt||0,''].join(','));
    });
    (m.pickups||[]).forEach(function(p){
      rows.push([driverName,unitStr,m.date,'Pick Up',p.proNum||'',p.shipper||'','',p.pieces||0,p.weight||p.wt||0,p.dropLocation||''].join(','));
    });
  });
  var csv=rows.join('\n');
  var blob=new Blob([csv],{type:'text/csv'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;a.download='EI_'+driverName.replace(/ /g,'_')+'_'+mon+'_to_'+friday+'.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  showToast('Downloaded: '+driverName);
}

function custExportAll(){var mon=_custMon,friday=_custFriday;
  var adminNames=getAdminDriverNames();
  var wm=manifests.filter(function(m){return m.date>=mon&&m.date<=friday&&!adminNames.has(m.driverName);});
  var rows=['Driver,Unit,Date,Type,Pro #/Ref #,Consignee/Shipper,City,Pieces,Weight (lbs),Drop Location'];
  var rosterMap={};
  getDriverRoster().forEach(function(d){rosterMap[d.name]=d.unit;});
  wm.forEach(function(m){
    var unit=rosterMap[m.driverName]||'';
    (m.deliveries||[]).forEach(function(d){
      rows.push([m.driverName,unit,m.date,'Delivery',d.proNum||'',d.consignee||'',d.city||'',d.pieces||0,d.weight||d.wt||0,''].join(','));
    });
    (m.pickups||[]).forEach(function(p){
      rows.push([m.driverName,unit,m.date,'Pick Up',p.proNum||'',p.shipper||'','',p.pieces||0,p.weight||p.wt||0,p.dropLocation||''].join(','));
    });
  });
  var csv=rows.join('\n');
  var blob=new Blob([csv],{type:'text/csv'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;a.download='EI_Cartage_All_'+mon+'_to_'+friday+'.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  showToast('All ref #s exported!');
}

// ── HOLIDAY HELPERS ───────────────────────────────────────────────────────────
// Small "🎉" marker for an Hours cell that includes holiday hours.
function _hlMark(hH){
  return hH?' <span title="Includes '+hH+' holiday hrs" style="font-size:11px">&#127881;</span>':'';
}
// One-line note naming the holiday(s) in a period, for report headers.
function _hlNote(holidays){
  if(!holidays.length)return '';
  return ' &nbsp;&middot;&nbsp; &#127881; Includes '+holidays.map(holidayLabel).join(', ')+' &mdash; '+HOLIDAY_HOURS+' hrs billed per unit';
}

// ── WEEKLY SUMMARY NAVIGATION ────────────────────────────────────────────────

function showSumForWeek(mon){
  var wks=allWks();
  var sel=document.getElementById('weekSel');
  sel.innerHTML=wks.map(function(w){
    return '<option value="'+w+'" '+(w===mon?'selected':'')+'>'+wkLbl(w)+'</option>';
  }).join('');
  if(mon && wks.includes(mon)) sel.value=mon;
  else if(wks.length) sel.value=wks[0];
  renderSum();ss('summary');
}

function showSum(){
  var wks=allWks();
  var sel=document.getElementById('weekSel');
  var currentMon=getMon(localDateStr());
  if(!wks.length){
    sel.innerHTML='<option value="">No data yet</option>';
  } else {
    sel.innerHTML=wks.map(function(w){
      return '<option value="'+w+'" '+(w===currentMon?'selected':'')+'>'+wkLbl(w)+'</option>';
    }).join('');
    if(wks.includes(currentMon)) sel.value=currentMon;
    else sel.value=wks[0];
  }
  renderSum();ss('summary');
}

function shiftW(dir){
  var sel=document.getElementById('weekSel');
  var opts=Array.from(sel.options);
  var idx=opts.findIndex(function(o){return o.value===sel.value;});
  var next=idx-dir;
  if(next>=0&&next<opts.length){sel.selectedIndex=next;renderSum();}
}

function renderSum(){
  var mon=document.getElementById('weekSel').value;
  var el=document.getElementById('sumContent');
  if(!mon){el.innerHTML='<div class="no-data"><div style="font-size:36px">&#128203;</div><div>No week selected</div></div>';return;}
  var friDt=new Date(mon+'T12:00:00');friDt.setDate(friDt.getDate()+5);
  var friday=friDt.toISOString().split('T')[0];
  var sunDt=new Date(mon+'T12:00:00');sunDt.setDate(sunDt.getDate()-1);
  var sunday=sunDt.toISOString().split('T')[0];
  var roster=getDriverRoster().filter(function(d){return !d.isAdmin;});
  var wm=manifests.filter(function(m){return m.date>=sunday&&m.date<=friday;});
  var dm={};
  wm.forEach(function(m){var key=m.isSubstitute&&m.subFor?m.subFor:m.driverName;if(!dm[key])dm[key]=[];dm[key].push(m);});
  var gD=0,gP=0,gS=0,gW=0,gM=0,gH=0,gC=0,workedH=0;
  // Holiday: each billable unit gets an 8-hr day added to its own row
  var holidays=getHolidayCharges(sunday,friday);
  var hlByDrv=getHolidayDaysByDriver(holidays);
  function buildSumRow(drv){
    var name=drv.name,unit=drv.unit,r=rate(name);
    var d=dm[name]||[],hd=hlByDrv[name]||[];
    if(!d.length&&!hd.length)return '<tr class="zero-row"><td><strong>'+unit+'</strong></td><td>'+name+'</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0.00</td><td>$0.00</td><td>$0.0000</td></tr>';
    var wD=0,wP=0,wS=0,wW=0,wM=0,wH=0;
    d.forEach(function(m){wD+=m.ttlDeliveries||0;wP+=m.ttlPickups||0;wS+=m.ttlShipments||0;wW+=m.ttlWeight||0;wM+=m.totalMiles||0;wH+=getEffectiveHours(m);});
    workedH+=wH; // shipments/hr stays based on hours actually worked
    var hH=hd.reduce(function(s,x){return s+x.hours;},0);
    wH+=hH;
    var wC=wH*r;
    var wCpl=wW>0?wC/wW:0;
    gD+=wD;gP+=wP;gS+=wS;gW+=wW;gM+=wM;gH+=wH;gC+=wC;
    return '<tr class="data-row"><td><strong>'+unit+'</strong></td><td>'+name+'</td><td>'+wD+'</td><td>'+wP+'</td><td>'+wS+'</td><td>'+wW.toLocaleString()+'</td><td>'+wM+'</td><td>'+wH.toFixed(2)+_hlMark(hH)+'</td><td class="chg-cell">$'+wC.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td><td class="chg-cell">$'+wCpl.toFixed(4)+'</td></tr>';
  }
  // Split into TT / ST groups so J Files can sit between them as a single
  // one-time row, instead of living in <tfoot> - which browsers repeat at
  // the bottom of every printed page once the table spans more than one,
  // making it (and the total) appear to print twice.
  var ttRoster=roster.filter(function(d){return _unitType(d.unit)==='TT';});
  var stRoster=roster.filter(function(d){return _unitType(d.unit)==='ST';});
  var ttRows=ttRoster.map(buildSumRow).join('');
  var stRows=stRoster.map(buildSumRow).join('');

  // J Files for this week
  var jfiles=[];try{jfiles=JSON.parse(cacheGet('ei_jfiles')||'[]');}catch(e){}
  var weekJFiles=jfiles.filter(function(j){return j.date>=sunday&&j.date<=friday;});
  var jfTotal=weekJFiles.reduce(function(s,j){return s+(parseFloat(j.price)||0);},0);
  var jfWt=weekJFiles.reduce(function(s,j){return s+(parseFloat(j.wt)||0);},0);
  var jfCpl=jfWt>0?jfTotal/jfWt:0;
  var jfRow=weekJFiles.length
    ?'<tr class="data-row" style="background:#fffbeb"><td colspan="2"><strong>J Files</strong> ('+weekJFiles.length+')</td><td>—</td><td>—</td><td>'+weekJFiles.length+'</td><td>'+jfWt.toLocaleString()+'</td><td>—</td><td>—</td><td class="chg-cell">$'+jfTotal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td><td class="chg-cell">$'+jfCpl.toFixed(4)+'</td></tr>'
    :'';
  // Tolls + Additional Trailers (internal add-ons; not on customer view).
  // Rows use a colspan="2" label like J Files so print drops Driver cleanly.
  var extras=getWeekExtras(sunday,friday);
  var exRows='';
  if(extras.tolls.length)exRows+='<tr class="data-row"><td colspan="2"><strong>Tolls</strong></td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td class="chg-cell">$'+extras.tollTotal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td><td>—</td></tr>';
  if(extras.trailerTotal>0)exRows+='<tr class="data-row"><td colspan="2"><strong>Additional Trailers</strong> ('+extras.trailerCount+')</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td class="chg-cell">$'+extras.trailerTotal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td><td>—</td></tr>';
  var grandC=gC+jfTotal+extras.tollTotal+extras.trailerTotal;
  var grandW=gW+jfWt;
  var acps=gS>0?grandC/gS:0,acpl=grandW>0?grandC/grandW:0,asph=workedH>0?gS/workedH:0,amd=gM/5,acpm=gM>0?grandC/gM:0;

  el.innerHTML=
    '<div class="grand-box"><h3>Program Totals &mdash; Week Ending '+fs(friday)+'</h3>'
    +'<div class="grand-grid">'
    +'<div class="gi"><div class="gi-val">'+gD+'</div><div class="gi-lbl">Deliveries</div></div>'
    +'<div class="gi"><div class="gi-val">'+gP+'</div><div class="gi-lbl">Pick Ups</div></div>'
    +'<div class="gi"><div class="gi-val">'+gS+'</div><div class="gi-lbl">Shipments</div></div>'
    +'<div class="gi"><div class="gi-val">'+grandW.toLocaleString()+'</div><div class="gi-lbl">Weight (lbs)</div></div>'
    +'<div class="gi"><div class="gi-val">'+gM+'</div><div class="gi-lbl">Miles</div></div>'
    +'<div class="gi"><div class="gi-val">'+gH.toFixed(2)+'</div><div class="gi-lbl">Hours</div></div>'
    +'<div class="gi"><div class="gi-val">$'+grandC.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</div><div class="gi-lbl">Total Charges</div></div>'
    +'<div class="gi"><div class="gi-val">$'+(grandW>0?(grandC/grandW).toFixed(4):'0.0000')+'</div><div class="gi-lbl">Cost Per Lb</div></div>'
    +'</div></div>'
    +'<div class="sum-report">'
    +'<div class="sum-report-head"><div class="srh-title">Expeditors Cartage Program</div><div class="srh-week">Week Ending '+fs(friday)+_hlNote(holidays)+'</div></div>'
    +'<div style="overflow-x:auto"><table class="sum-tbl">'
    +'<colgroup><col style="width:7%"><col style="width:15%"><col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:11%"><col style="width:8%"><col style="width:8%"><col style="width:13%"><col style="width:11%"></colgroup>'
    +'<thead><tr><th>Unit</th><th>Driver</th><th>Deliveries</th><th>Pick Ups</th><th>Shipments</th><th>Weight (lbs)</th><th>Miles</th><th>Hours</th><th>Charges</th><th>$/Lb</th></tr></thead>'
    +'<tbody>'+ttRows+jfRow+stRows+exRows+'</tbody>'
    +'<tfoot><tr class="total-row"><td colspan="2"><strong>TOTAL</strong></td><td>'+gD+'</td><td>'+gP+'</td><td>'+gS+'</td><td>'+grandW.toLocaleString()+'</td><td>'+gM+'</td><td>'+gH.toFixed(2)+'</td><td class="chg-cell">$'+grandC.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td><td class="chg-cell">$'+(grandW>0?(grandC/grandW).toFixed(4):'0.0000')+'</td></tr></tfoot>'
    +'</table></div>'
    +'<div class="sum-stats">'
    +'<div class="ss-row"><div class="ss-lbl">Average Cost Per Shipment</div><div class="ss-val">$'+acps.toFixed(2)+'</div></div>'
    +'<div class="ss-row"><div class="ss-lbl">Average Cost Per Pound</div><div class="ss-val">$'+acpl.toFixed(4)+'</div></div>'
    +'<div class="ss-row"><div class="ss-lbl">Average Shipments Per Hour</div><div class="ss-val">'+asph.toFixed(2)+'</div></div>'
    +'<div class="ss-row"><div class="ss-lbl">Average Miles Per Day</div><div class="ss-val">'+amd.toFixed(1)+'</div></div>'
    +'<div class="ss-row"><div class="ss-lbl">Average Cost Per Mile</div><div class="ss-val">$'+acpm.toFixed(2)+'</div></div>'
    +'</div>'
    +'</div>';
}


function dlWeekly(){
  var mon=document.getElementById('weekSel').value;
  if(!mon){showToast('No week selected');return;}
  var friDt=new Date(mon+'T12:00:00');friDt.setDate(friDt.getDate()+5);
  var friday=friDt.toISOString().split('T')[0];
  var sunDt=new Date(mon+'T12:00:00');sunDt.setDate(sunDt.getDate()-1);
  var sunday=sunDt.toISOString().split('T')[0];
  var roster=getDriverRoster().filter(function(d){return !d.isAdmin;});
  var wm=manifests.filter(function(m){return m.date>=sunday&&m.date<=friday;});
  var dm={};
  wm.forEach(function(m){var key=m.isSubstitute&&m.subFor?m.subFor:m.driverName;if(!dm[key])dm[key]=[];dm[key].push(m);});
  var holidays=getHolidayCharges(sunday,friday),hlByDrv=getHolidayDaysByDriver(holidays);
  var rows=['Unit,Driver,Deliveries,Pick Ups,Shipments,Weight (lbs),Miles,Hours,Charges,Holiday Hrs Included'];
  roster.forEach(function(drv){
    var name=drv.name,unit=drv.unit,r=rate(name),d=dm[name]||[],hd=hlByDrv[name]||[];
    if(!d.length&&!hd.length){rows.push([unit,name,0,0,0,0,0,'0.00','$0.00',0].join(','));return;}
    var wD=0,wP=0,wS=0,wW=0,wM=0,wH=0;
    d.forEach(function(m){wD+=m.ttlDeliveries||0;wP+=m.ttlPickups||0;wS+=m.ttlShipments||0;wW+=m.ttlWeight||0;wM+=m.totalMiles||0;wH+=getEffectiveHours(m);});
    var hH=hd.reduce(function(s,x){return s+x.hours;},0);
    wH+=hH;
    var wC=wH*r;
    rows.push([unit,name,wD,wP,wS,wW,wM,wH.toFixed(2),'$'+wC.toFixed(2),hH].join(','));
  });
  if(holidays.length)rows.push('','"Includes '+holidays.map(holidayLabel).join(', ')+' - '+HOLIDAY_HOURS+' hrs billed per unit"');
  var csv=rows.join('\n');
  var blob=new Blob([csv],{type:'text/csv'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;a.download='EI_Cartage_'+mon+'_to_'+friday+'.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  showToast('Downloaded!');
}
