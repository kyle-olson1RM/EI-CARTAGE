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
  var win=window.open('','_blank','width=1100,height=800');
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>EI Cartage Summary</title><style>body{font-family:Arial,sans-serif;margin:0;padding:16px;color:#1a1a1a;background:white;}h1{font-size:20px;font-weight:800;color:#E31837;margin:0 0 2px}.sub{font-size:12px;color:#666;margin-bottom:14px;}.grand-box{background:#b91c1c;color:white;border-radius:6px;padding:12px 16px;margin-bottom:14px;}.grand-box h3{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.5);margin:0 0 8px}.grand-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:8px;}.gi{text-align:center;}.gi-val{font-size:22px;font-weight:800;color:white;line-height:1;}.gi-val,.gi-charges{font-size:22px;font-weight:800;color:white;line-height:1;}.gi-lbl{font-size:9px;color:rgba(255,255,255,.5);text-transform:uppercase;margin-top:2px;}.sum-report{border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;margin-bottom:14px;}.sum-report-head{background:#E31837;color:white;padding:10px 14px;}.srh-title{font-size:16px;font-weight:800;}.srh-week{font-size:11px;color:rgba(255,255,255,.75);margin-top:2px;}table{width:100%;border-collapse:collapse;font-size:12px;}th{background:#b91c1c;color:rgba(255,255,255,.85);padding:7px 10px;text-align:right;font-size:9px;font-weight:700;text-transform:uppercase;}th:first-child,th:nth-child(2){text-align:left;}td{padding:7px 10px;text-align:right;border-bottom:1px solid #e0e0e0;}.data-row td{background:white;}.zero-row td{background:#f7f7f7;color:#888;}.total-row td{background:#b91c1c;color:white;font-weight:700;font-size:13px;}.chg-cell{color:#E31837;font-weight:700;}.total-row .chg-cell{color:#ffd700;font-size:15px;}.sum-stats{border-top:2px solid #e0e0e0;padding:10px 14px;}.ss-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #e0e0e0;font-size:13px;}.ss-row:last-child{border-bottom:none;}.ss-val{font-size:17px;font-weight:700;color:#E31837;}@media print{@page{size:landscape;margin:.4in;}}</style></head><body><h1>EI Cartage &mdash; Weekly Summary</h1><div class="sub">'+weekLabel+' &nbsp;|&nbsp; Printed: '+printDate+'</div>'+content.innerHTML+'<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script></body></html>');
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
  var filtered=manifests.slice();
  if(from)filtered=filtered.filter(function(m){return m.date>=from;});
  if(to)filtered=filtered.filter(function(m){return m.date<=to;});
  if(!filtered.length){el.innerHTML='<div class="no-data"><div style="font-size:36px;margin-bottom:10px">&#128197;</div><div style="font-family:Barlow Condensed,sans-serif;font-size:20px;font-weight:700">No data in this range</div></div>';return;}
  var dateLabel=from&&to?fs(from)+' \u2013 '+fs(to):from?'From '+fs(from):to?'Through '+fs(to):'All Time';
  var dm={};filtered.forEach(function(m){if(!dm[m.driverName])dm[m.driverName]={del:0,pu:0,ship:0,wt:0,mi:0,hrs:0,days:new Set()};dm[m.driverName].del+=m.ttlDeliveries||0;dm[m.driverName].pu+=m.ttlPickups||0;dm[m.driverName].ship+=m.ttlShipments||0;dm[m.driverName].wt+=m.ttlWeight||0;dm[m.driverName].mi+=m.totalMiles||0;dm[m.driverName].hrs+=m.totalHours||0;dm[m.driverName].days.add(m.date);});
  var gD=0,gP=0,gS=0,gW=0,gM=0,gH=0,gC=0;
  Object.keys(dm).forEach(function(n){var d=dm[n],r=rate(n),c=d.hrs*r;gD+=d.del;gP+=d.pu;gS+=d.ship;gW+=d.wt;gM+=d.mi;gH+=d.hrs;gC+=c;});
  var roster=getDriverRoster();
  var totalDays=new Set(filtered.map(function(m){return m.date;})).size;
  var acps=gS>0?gC/gS:0,acpl=gW>0?gC/gW:0,asph=gH>0?gS/gH:0,acpm=gM>0?gC/gM:0,amd=totalDays>0?gM/totalDays:0;
  var rowsHtml=roster.map(function(d){
    var data=dm[d.name],r=rate(d.name);
    if(!data)return '<tr class="zero-row"><td><strong>'+d.unit+'</strong></td><td>'+d.name+'</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0.00</td><td>0</td><td>$0.00</td></tr>';
    var c=data.hrs*r,dw=data.days.size;
    return '<tr class="data-row"><td><strong>'+d.unit+'</strong></td><td>'+d.name+'</td><td>'+data.del+'</td><td>'+data.pu+'</td><td>'+data.ship+'</td><td>'+data.wt.toLocaleString()+'</td><td>'+data.mi+'</td><td>'+data.hrs.toFixed(2)+'</td><td>'+dw+'</td><td class="chg-cell">$'+c.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td></tr>';
  }).join('');
  el.innerHTML='<div class="sum-report"><div class="sum-report-head"><div class="srh-title">Expeditors Cartage Program</div><div class="srh-week">Custom Range: '+dateLabel+' &nbsp;&middot;&nbsp; '+filtered.length+' manifest'+(filtered.length!==1?'s':'')+'</div></div><div style="overflow-x:auto"><table class="sum-tbl"><thead><tr><th>Unit</th><th>Driver</th><th>Deliveries</th><th>Pick Ups</th><th>Shipments</th><th>Weight (lbs)</th><th>Miles</th><th>Hours</th><th>Days</th><th>Charges</th></tr></thead><tbody>'+rowsHtml+'</tbody><tfoot><tr class="total-row"><td colspan="2"><strong>TOTAL</strong></td><td>'+gD+'</td><td>'+gP+'</td><td>'+gS+'</td><td>'+gW.toLocaleString()+'</td><td>'+gM+'</td><td>'+gH.toFixed(2)+'</td><td>'+totalDays+'</td><td class="chg-cell">$'+gC.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td></tr></tfoot></table></div><div class="sum-stats"><div class="ss-row"><div class="ss-lbl">Average Cost Per Shipment</div><div class="ss-val">$'+acps.toFixed(2)+'</div></div><div class="ss-row"><div class="ss-lbl">Average Cost Per Pound</div><div class="ss-val">$'+acpl.toFixed(4)+'</div></div><div class="ss-row"><div class="ss-lbl">Average Shipments Per Hour</div><div class="ss-val">'+asph.toFixed(2)+'</div></div><div class="ss-row"><div class="ss-lbl">Average Miles Per Day</div><div class="ss-val">'+amd.toFixed(1)+'</div></div><div class="ss-row"><div class="ss-lbl">Average Cost Per Mile</div><div class="ss-val">$'+acpm.toFixed(2)+'</div></div><div class="ss-row"><div class="ss-lbl">Total Days with Activity</div><div class="ss-val">'+totalDays+'</div></div></div></div>';
}
function dlRangeReport(){
  var from=document.getElementById('rsFrom')?.value,to=document.getElementById('rsTo')?.value;
  var filtered=manifests.slice();
  if(from)filtered=filtered.filter(function(m){return m.date>=from;});
  if(to)filtered=filtered.filter(function(m){return m.date<=to;});
  if(!filtered.length){showToast('No data to download');return;}
  var dm={};filtered.forEach(function(m){if(!dm[m.driverName])dm[m.driverName]={del:0,pu:0,ship:0,wt:0,mi:0,hrs:0};dm[m.driverName].del+=m.ttlDeliveries||0;dm[m.driverName].pu+=m.ttlPickups||0;dm[m.driverName].ship+=m.ttlShipments||0;dm[m.driverName].wt+=m.ttlWeight||0;dm[m.driverName].mi+=m.totalMiles||0;dm[m.driverName].hrs+=m.totalHours||0;});
  var dateLabel=from&&to?from+' to '+to:from?'From '+from:to?'Through '+to:'All Time';
  var gD=0,gP=0,gS=0,gW=0,gM=0,gH=0,gC=0;
  var csv='EI Cartage Report - '+dateLabel+'\n\nDriver,Unit,TTL Deliveries,TTL Pick Ups,TTL Shipments,TTL Weight (lbs),TTL Miles,TTL Hours,Charges\n';
  getDriverRoster().forEach(function(drv){var name=drv.name,unit=drv.unit,d=dm[name],r=rate(name);if(!d)return;var c=d.hrs*r;csv+=name+','+unit+','+d.del+','+d.pu+','+d.ship+','+d.wt+','+d.mi+','+d.hrs.toFixed(2)+',$'+c.toFixed(2)+'\n';gD+=d.del;gP+=d.pu;gS+=d.ship;gW+=d.wt;gM+=d.mi;gH+=d.hrs;gC+=c;});
  csv+='\nTOTAL,,'+gD+','+gP+','+gS+','+gW+','+gM+','+gH.toFixed(2)+',$'+gC.toFixed(2)+'\n';
  var acps=gS>0?gC/gS:0,acpl=gW>0?gC/gW:0,asph=gH>0?gS/gH:0,acpm=gM>0?gC/gM:0;
  csv+='\nAvg Cost/Shipment,$'+acps.toFixed(2)+'\nAvg Cost/lb,$'+acpl.toFixed(4)+'\nShipments/Hr,'+asph.toFixed(2)+'\nAvg Cost/Mile,$'+acpm.toFixed(2)+'\n';
  var blob=new Blob([csv],{type:'text/csv'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='EI_Cartage_Report.csv';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);showToast('Report downloaded');
}

// ── CUSTOMER VIEW ─────────────────────────────────────────────────────────────
var CUSTOMER_CODE='EXP2025';
function openCustomerLogin(){
  document.getElementById('custCode').value='';document.getElementById('custLoginErr').textContent='';
  document.getElementById('custLoginOv').classList.add('open');
  setTimeout(function(){document.getElementById('custCode').focus();},100);
}
function doCustomerLogin(){
  var code=document.getElementById('custCode').value.trim().toUpperCase();
  if(code===CUSTOMER_CODE){
    document.getElementById('custLoginOv').classList.remove('open');
    populateCustWeekSel();renderCustomerDash();ss('customerDash');
  }else{document.getElementById('custLoginErr').textContent='Incorrect access code';document.getElementById('custCode').value='';}
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
function renderCustomerDash(){
  var mon=document.getElementById('custWeekSel').value,el=document.getElementById('custContent'),ml=document.getElementById('custWeekLabel');
  if(!mon){el.innerHTML='<div class="no-data"><div style="font-size:36px;margin-bottom:10px">&#128203;</div><div style="font-family:Barlow Condensed,sans-serif;font-size:20px;font-weight:700">No data yet</div></div>';return;}
  var fri=new Date(mon+'T12:00:00');fri.setDate(fri.getDate()+4);var friday=fri.toISOString().split('T')[0];
  if(ml)ml.textContent='W/E '+fs(friday);
  var wm=manifests.filter(function(m){return m.date>=mon&&m.date<=friday;}),dm={};
  wm.forEach(function(m){if(!dm[m.driverName])dm[m.driverName]=[];dm[m.driverName].push(m);});
  var drivers=Object.keys(dm).sort();
  if(!drivers.length){el.innerHTML='<div class="no-data"><div style="font-size:36px;margin-bottom:10px">&#128197;</div><div style="font-family:Barlow Condensed,sans-serif;font-size:20px;font-weight:700">No manifests this week</div></div>';return;}
  var gD=0,gP=0,gS=0,gW=0,gM=0,gH=0,gC=0;
  drivers.forEach(function(n){var r=rate(n);dm[n].forEach(function(m){gD+=m.ttlDeliveries||0;gP+=m.ttlPickups||0;gS+=m.ttlShipments||0;gW+=m.ttlWeight||0;gM+=m.totalMiles||0;gH+=m.totalHours||0;gC+=(m.totalHours||0)*r;});});
  var acps=gS>0?gC/gS:0,acpl=gW>0?gC/gW:0,asph=gH>0?gS/gH:0,amd=gM/5,acpm=gM>0?gC/gM:0;
  var tbodyHtml=getDriverRoster().map(function(drv){
    var name=drv.name,unit=drv.unit,d=dm[name],r=rate(name);
    if(!d)return '<tr class="zero-row"><td><strong>'+unit+'</strong></td><td>'+name+'</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0.00</td><td>$0.00</td></tr>';
    var wD=0,wP=0,wS=0,wW=0,wM=0,wH=0;d.forEach(function(m){wD+=m.ttlDeliveries||0;wP+=m.ttlPickups||0;wS+=m.ttlShipments||0;wW+=m.ttlWeight||0;wM+=m.totalMiles||0;wH+=m.totalHours||0;});var wC=wH*r;
    return '<tr class="data-row"><td><strong>'+unit+'</strong></td><td>'+name+'</td><td>'+wD+'</td><td>'+wP+'</td><td>'+wS+'</td><td>'+wW.toLocaleString()+'</td><td>'+wM+'</td><td>'+wH.toFixed(2)+'</td><td class="chg-cell">$'+wC.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td></tr>';
  }).join('');
  el.innerHTML='<div class="grand-box"><h3>Program Totals &mdash; Week Ending '+fs(friday)+'</h3><div class="grand-grid"><div class="gi"><div class="gi-val">'+gD+'</div><div class="gi-lbl">Deliveries</div></div><div class="gi"><div class="gi-val">'+gP+'</div><div class="gi-lbl">Pick Ups</div></div><div class="gi"><div class="gi-val">'+gS+'</div><div class="gi-lbl">Shipments</div></div><div class="gi"><div class="gi-val">'+gW.toLocaleString()+'</div><div class="gi-lbl">Weight (lbs)</div></div><div class="gi"><div class="gi-val">'+gM.toLocaleString()+'</div><div class="gi-lbl">Miles</div></div><div class="gi"><div class="gi-val">'+gH.toFixed(2)+'</div><div class="gi-lbl">Hours</div></div><div class="gi"><div class="gi-val">$'+gC.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</div><div class="gi-lbl">Total Charges</div></div><div class="gi"><div class="gi-val">$'+(gW>0?(gC/gW).toFixed(4):'0.0000')+'</div><div class="gi-lbl">Cost Per Lb</div></div></div></div><div class="sum-report"><div class="sum-report-head"><div class="srh-title">Expeditors Cartage Program</div><div class="srh-week">Week Ending '+fs(friday)+'</div></div><div style="overflow-x:auto"><table class="sum-tbl"><thead><tr><th>Unit</th><th>Driver</th><th>Deliveries</th><th>Pick Ups</th><th>Shipments</th><th>Weight (lbs)</th><th>Miles</th><th>Hours</th><th>Charges</th></tr></thead><tbody>'+tbodyHtml+'</tbody><tfoot><tr class="total-row"><td colspan="2"><strong>TOTAL</strong></td><td>'+gD+'</td><td>'+gP+'</td><td>'+gS+'</td><td>'+gW.toLocaleString()+'</td><td>'+gM+'</td><td>'+gH.toFixed(2)+'</td><td class="chg-cell" style="color:#ffd700;font-size:16px">$'+gC.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td></tr></tfoot></table></div><div class="sum-stats"><div class="ss-row"><div class="ss-lbl">Average Cost Per Shipment</div><div class="ss-val">$'+acps.toFixed(2)+'</div></div><div class="ss-row"><div class="ss-lbl">Average Cost Per Pound</div><div class="ss-val">$'+acpl.toFixed(4)+'</div></div><div class="ss-row"><div class="ss-lbl">Average Shipments Per Hour</div><div class="ss-val">'+asph.toFixed(2)+'</div></div><div class="ss-row"><div class="ss-lbl">Average Miles Per Day</div><div class="ss-val">'+amd.toFixed(1)+'</div></div><div class="ss-row"><div class="ss-lbl">Average Cost Per Mile</div><div class="ss-val">$'+acpm.toFixed(2)+'</div></div></div></div>';
}

function allWks(){const w=new Set();manifests.forEach(m=>{if(m.date)w.add(getMon(m.date));});return[...w].sort().reverse();}

function getMon(d){const dt=new Date(d+'T12:00:00');const dy=dt.getDay();dt.setDate(dt.getDate()+(dy===0?-6:1-dy));return dt.toISOString().split('T')[0];}

function fs(d){return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});}

function ff(d){return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}

function wkLbl(mon){const fri=new Date(mon+'T12:00:00');fri.setDate(fri.getDate()+4);return ff(mon)+' &ndash; '+ff(fri.toISOString().split('T')[0]);}

function showSum(){
  const wks=allWks();const sel=document.getElementById('weekSel');const cur=sel.value;
  if(!wks.length){sel.innerHTML='<option value="">No data yet</option>';}
  else{sel.innerHTML=wks.map(w=>`<option value="${w}" ${w===cur?'selected':''}>${wkLbl(w)}</option>`).join('');if(!cur||!wks.includes(cur))sel.value=wks[0];}
  renderSum();ss('summary');
}

function shiftW(dir){const sel=document.getElementById('weekSel');const opts=[...sel.options];const idx=opts.findIndex(o=>o.value===sel.value);const ni=idx-dir;if(ni>=0&&ni<opts.length){sel.value=opts[ni].value;renderSum();}}

function renderSum(){
  const mon=document.getElementById('weekSel').value;
  const el=document.getElementById('sumContent'),ml=document.getElementById('sumMeta');
  if(!mon){el.innerHTML='<div class="no-data"><div style="font-size:36px;margin-bottom:10px">&#128203;</div><div style="font-family:Barlow Condensed,sans-serif;font-size:20px;font-weight:700">No data yet</div></div>';return;}
  const fri=new Date(mon+'T12:00:00');fri.setDate(fri.getDate()+4);const friday=fri.toISOString().split('T')[0];
  if(ml)ml.textContent='W/E '+fs(friday);

  // Get live roster - includes any drivers added in Driver Management
  const roster=getDriverRoster();

  // Aggregate each driver's full week from submitted manifests
  const wm=manifests.filter(function(m){return m.date>=mon&&m.date<=friday;});
  const dm={};
  wm.forEach(function(m){
    if(!dm[m.driverName]){dm[m.driverName]={del:0,pu:0,ship:0,wt:0,mi:0,hrs:0};}
    dm[m.driverName].del  += m.ttlDeliveries||0;
    dm[m.driverName].pu   += m.ttlPickups||0;
    dm[m.driverName].ship += m.ttlShipments||0;
    dm[m.driverName].wt   += m.ttlWeight||0;
    dm[m.driverName].mi   += m.totalMiles||0;
    dm[m.driverName].hrs  += m.totalHours||0;
  });

  // Grand totals across all roster drivers
  var gD=0,gP=0,gS=0,gW=0,gM=0,gH=0,gC=0;
  roster.forEach(function(drv){
    var d=dm[drv.name]; if(!d)return;
    var r=rate(drv.name),c=d.hrs*r;
    gD+=d.del;gP+=d.pu;gS+=d.ship;gW+=d.wt;gM+=d.mi;gH+=d.hrs;gC+=c;
  });

  // Program stats
  var avgCostPerShip = gS>0 ? gC/gS : 0;
  var avgCostPerLb   = gW>0 ? gC/gW : 0;
  var avgShipPerHour = gH>0 ? gS/gH : 0;
  var avgMilesPerDay = gM/5;
  var avgCostPerMile = gM>0 ? gC/gM : 0;

  // Build table rows — ALL roster drivers, zero rows for those with no data
  var rowsHtml=roster.map(function(drv){
    var name=drv.name,unit=drv.unit,d=dm[name],r=rate(name);
    if(!d){
      return '<tr class="zero-row"><td><strong>'+unit+'</strong></td><td>'+name+'</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0.00</td><td>$0.00</td></tr>';
    }
    var c=d.hrs*r;
    return '<tr class="'+(d.ship>0?'data-row':'zero-row')+'"><td><strong>'+unit+'</strong></td><td>'+name+'</td><td>'+d.del+'</td><td>'+d.pu+'</td><td>'+d.ship+'</td><td>'+d.wt.toLocaleString()+'</td><td>'+d.mi+'</td><td>'+d.hrs.toFixed(2)+'</td><td class="chg-cell">$'+c.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td></tr>';
  }).join('');

  el.innerHTML=
    '<div class="sum-report">'+
      '<div class="sum-report-head">'+
        '<div class="srh-title">Expeditors Cartage Program</div>'+
        '<div class="srh-week">Summary Week Ending &nbsp;<strong>'+fs(friday)+'</strong></div>'+
      '</div>'+
      '<div style="overflow-x:auto"><table class="sum-tbl">'+
        '<thead><tr>'+
          '<th>Unit</th><th>Driver</th>'+
          '<th>TTL Deliveries</th><th>TTL Pick Ups</th><th>TTL Shipments</th>'+
          '<th>TTL Weight - LBS</th><th>TTL Miles</th><th>TTL Hours</th><th>Charges</th>'+
        '</tr></thead>'+
        '<tbody>'+rowsHtml+'</tbody>'+
        '<tfoot><tr class="total-row">'+
          '<td colspan="2"><strong>TOTAL</strong></td>'+
          '<td>'+gD+'</td><td>'+gP+'</td><td>'+gS+'</td>'+
          '<td>'+gW.toLocaleString()+'</td><td>'+gM+'</td>'+
          '<td>'+gH.toFixed(2)+'</td>'+
          '<td class="chg-cell">$'+gC.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'+
        '</tr></tfoot>'+
      '</table></div>'+
      '<div class="sum-stats">'+
        '<div class="ss-row"><div class="ss-lbl">Average Cost Per Shipment</div><div class="ss-val">$'+avgCostPerShip.toFixed(2)+'</div></div>'+
        '<div class="ss-row"><div class="ss-lbl">Average Cost Per Pound</div><div class="ss-val">$'+avgCostPerLb.toFixed(4)+'</div></div>'+
        '<div class="ss-row"><div class="ss-lbl">Average Shipments Per Hour</div><div class="ss-val">'+avgShipPerHour.toFixed(2)+'</div></div>'+
        '<div class="ss-row"><div class="ss-lbl">Average Miles Per Day</div><div class="ss-val">'+avgMilesPerDay.toFixed(1)+'</div></div>'+
        '<div class="ss-row"><div class="ss-lbl">Average Cost Per Mile</div><div class="ss-val">$'+avgCostPerMile.toFixed(2)+'</div></div>'+
      '</div>'+
    '</div>';
}


function dlWeekly(){
  const mon=document.getElementById('weekSel').value;if(!mon){showToast('No week selected');return;}
  const fri=new Date(mon+'T12:00:00');fri.setDate(fri.getDate()+4);const friday=fri.toISOString().split('T')[0];
  const wm=manifests.filter(m=>m.date>=mon&&m.date<=friday);
  const dm={};wm.forEach(m=>{if(!dm[m.driverName])dm[m.driverName]=[];dm[m.driverName].push(m);});
  const drivers=Object.keys(dm).sort();
  let gD=0,gP=0,gS=0,gW=0,gM=0,gH=0,gC=0;
  drivers.forEach(n=>{const r=rate(n);dm[n].forEach(m=>{gD+=m.ttlDeliveries||0;gP+=m.ttlPickups||0;gS+=m.ttlShipments||0;gW+=m.ttlWeight||0;gM+=m.totalMiles||0;gH+=m.totalHours||0;gC+=(m.totalHours||0)*r;});});
  let csv=`EI Cartage Weekly Summary - Week Ending ${fs(friday)}\n\nPROGRAM TOTALS\nTTL Deliveries,TTL Pick Ups,TTL Shipments,TTL Weight (lbs),TTL Miles,TTL Hours,TTL Charges\n${gD},${gP},${gS},${gW},${gM},${gH.toFixed(2)},$${gC.toFixed(2)}\n\nDRIVER BREAKDOWN\nDriver,Day,TTL Deliveries,TTL Pick Ups,TTL Shipments,TTL Weight (lbs),TTL Miles,Start Time,End Time,TTL Hours,Charges,Avg Cost/Ship,Avg Cost/lb,Ships/Hr,Avg Mi/Day\n`;
  drivers.forEach(name=>{
    const r=rate(name);const dd={};dm[name].forEach(m=>{dd[m.dayOfWeek]=m;});
    let wD=0,wP=0,wS=0,wW=0,wM=0,wH=0;
    DO.forEach(day=>{const m=dd[day];if(m){const c=(m.totalHours||0)*r;csv+=`${name},${day},${m.ttlDeliveries||0},${m.ttlPickups||0},${m.ttlShipments||0},${m.ttlWeight||0},${m.totalMiles||0},${m.startTime||''},${m.endTime||''},${m.totalHours||0},$${c.toFixed(2)},,,, \n`;wD+=m.ttlDeliveries||0;wP+=m.ttlPickups||0;wS+=m.ttlShipments||0;wW+=m.ttlWeight||0;wM+=m.totalMiles||0;wH+=m.totalHours||0;}else{csv+=`${name},${day},0,0,0,0,0,,,0,$0.00,,,,\n`;}});
    const wC=wH*r,acps=wS>0?wC/wS:0,acpl=wW>0?wC/wW:0,asph=wH>0?wS/wH:0,amd=wM/5;
    csv+=`${name},WEEKLY TOTAL,${wD},${wP},${wS},${wW},${wM},,${wH.toFixed(2)},$${wC.toFixed(2)},$${acps.toFixed(2)},$${acpl.toFixed(4)},${asph.toFixed(2)},${amd.toFixed(1)}\n\n`;
  });
  const blob=new Blob([csv],{type:'text/csv'});const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`EI_Cartage_WE_${fs(friday).replace(' ','-').replace(',','')}.csv`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  showToast('Downloaded - week ending '+fs(friday));
}



















