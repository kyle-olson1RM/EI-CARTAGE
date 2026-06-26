
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
  manifests.forEach(function(m){if(m.date)weeks.add(getMon(m.date));});
  var today=new Date();
  var currentMon=getMon(today.toISOString().split('T')[0]);
  var eightWeeksAgo=new Date(today);
  eightWeeksAgo.setDate(eightWeeksAgo.getDate()-56);
  var startMon=getMon(eightWeeksAgo.toISOString().split('T')[0]);
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
var CUSTOMER_CODE=cacheGet('ei_customer_code')||'EXP2025';
function openCustomerLogin(){
  document.getElementById('custCode').value='';document.getElementById('custLoginErr').textContent='';
  document.getElementById('custLoginOv').classList.add('open');
  setTimeout(function(){document.getElementById('custCode').focus();},100);
}
function doCustomerLogin(){
  var errEl=document.getElementById('custLoginErr');
  var codeEl=document.getElementById('custCode');
  var code=(codeEl?codeEl.value||'':'').trim().toUpperCase();
  if(!code){if(errEl)errEl.textContent='Please enter the access code';return;}
  // Try cache first, then localStorage, then default
  var stored=(_cache&&_cache['ei_customer_code'])||localStorage.getItem('ei_customer_code');
  // If nothing stored anywhere, accept EXP2025 as default
  var currentCode=stored?stored.trim().toUpperCase():'EXP2025';
  if(code===currentCode||code==='EXP2025'&&!stored){
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
  var friDt=new Date(mon+'T12:00:00');friDt.setDate(friDt.getDate()+5);var friday=friDt.toISOString().split('T')[0];var sunDt=new Date(mon+'T12:00:00');sunDt.setDate(sunDt.getDate()-1);var sunday=sunDt.toISOString().split('T')[0];_custMon=sunday;_custFriday=friday;
  if(ml)ml.textContent=fs(sunday||mon)+' — '+fs(friday);

  var roster=getDriverRoster();
  var wm=manifests.filter(function(m){return m.date>=(sunday||mon)&&m.date<=friday;});
  var dm={};
  wm.forEach(function(m){
    // Sub drivers group under the driver they subbed for
    var key=m.isSubstitute&&m.subFor?m.subFor:m.driverName;
    if(!dm[key])dm[key]=[];
    dm[key].push(m);
  });

  var gD=0,gP=0,gS=0,gW=0,gM=0,gH=0,gC=0;
  roster.forEach(function(drv){
    var d=dm[drv.name];if(!d)return;
    var r=rate(drv.name),c=0;
    d.forEach(function(m){gD+=m.ttlDeliveries||0;gP+=m.ttlPickups||0;gS+=m.ttlShipments||0;gW+=m.ttlWeight||0;gM+=m.totalMiles||0;gH+=m.totalHours||0;c+=(m.totalHours||0)*r;});
    gC+=c;
  });
  var acps=gS>0?grandC/gS:0,acpl=grandW>0?grandC/grandW:0,asph=gH>0?gS/gH:0,amd=gM/5,acpm=gM>0?grandC/gM:0;

  var tbodyHtml=roster.map(function(drv){
    var name=drv.name,unit=drv.unit,d=dm[name],r=rate(name);
    if(!d)return '<tr class="zero-row"><td><strong>'+unit+'</strong></td><td>'+name+'</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0.00</td><td>$0.00</td><td></td></tr>';
    var wD=0,wP=0,wS=0,wW=0,wM=0,wH=0;
    d.forEach(function(m){wD+=m.ttlDeliveries||0;wP+=m.ttlPickups||0;wS+=m.ttlShipments||0;wW+=m.ttlWeight||0;wM+=m.totalMiles||0;wH+=m.totalHours||0;});
    var wC=wH*r;
    return '<tr class="data-row" style="cursor:pointer" data-dname="'+name+'" onclick="custToggleDriver(this.dataset.dname,this)">'
      +'<td><strong>'+unit+'</strong></td><td>'+name+'</td><td>'+wD+'</td><td>'+wP+'</td><td>'+wS+'</td>'
      +'<td>'+wW.toLocaleString()+'</td><td>'+wM+'</td><td>'+wH.toFixed(2)+'</td>'
      +'<td class="chg-cell">$'+wC.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
      +'<td style="text-align:center;color:var(--accent);font-size:16px">&#9660;</td>'
      +'</tr>'
      +'<tr id="custdetail_'+name.replace(/[^a-zA-Z0-9]/g,'_')+'" style="display:none">'
      +'<td colspan="10" style="padding:0;background:var(--surface2)">'
      +custBuildDetail(d, name, mon, friday)
      +'</td></tr>';
  }).join('');

  el.innerHTML=
    '<div style="display:flex;justify-content:flex-end;margin-bottom:10px">'
    +'<div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button onclick="custExportAll()" style="height:38px;padding:0 16px;border-radius:6px;border:none;background:var(--accent);color:white;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;cursor:pointer;touch-action:manipulation">&#11015; Export All Ref #s (CSV)</button></div>'
    +'</div>'
    +'<div class="grand-box"><h3>Program Totals &mdash; Week Ending '+fs(friday)+'</h3>'
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
    +'<div class="sum-report-head"><div class="srh-title">Expeditors Cartage Program</div><div class="srh-week">Week Ending '+fs(friday)+' &nbsp;&middot;&nbsp; Click a driver row to see stop details</div></div>'
    +'<div style="overflow-x:auto"><table class="sum-tbl">'
    +'<thead><tr><th>Unit</th><th>Driver</th><th>Deliveries</th><th>Pick Ups</th><th>Shipments</th><th>Weight (lbs)</th><th>Miles</th><th>Hours</th><th>Charges</th><th></th></tr></thead>'
    +'<tbody>'+tbodyHtml+'</tbody>'
    // Add J Files to customer view
    var custJFiles=[];try{custJFiles=JSON.parse(cacheGet('ei_jfiles')||'[]');}catch(e){}
    var custWeekJF=custJFiles.filter(function(j){return j.date>=(sunday||mon)&&j.date<=friday;});
    var custJfTotal=custWeekJF.reduce(function(s,j){return s+j.price;},0);
    var custJfWt=custWeekJF.reduce(function(s,j){return s+j.wt;},0);
    var custJfRow=custWeekJF.length?'<tr class="data-row" style="background:#fffbeb"><td colspan="2"><strong>J Files</strong> ('+custWeekJF.length+')</td><td>—</td><td>—</td><td>'+custWeekJF.length+'</td><td>'+custJfWt.toLocaleString()+'</td><td>—</td><td>—</td><td class="chg-cell">$'+custJfTotal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td><td></td></tr>':'';
    var custGrandC=gC+custJfTotal; var custGrandW=gW+custJfWt;
    +'<tfoot>'+custJfRow+'<tr class="total-row"><td colspan="2"><strong>TOTAL</strong></td><td>'+gD+'</td><td>'+gP+'</td><td>'+gS+'</td><td>'+custGrandW.toLocaleString()+'</td><td>'+gM+'</td><td>'+gH.toFixed(2)+'</td><td class="chg-cell">$'+custGrandC.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td><td></td></tr></tfoot>'
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

function custBuildDetail(manifests_arr, driverName, mon, friday){
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

  if(!allDels.length && !allPUs.length){
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
  var wm=manifests.filter(function(m){return m.date>=(sunday||mon)&&m.date<=friday;});
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

// ── WEEKLY SUMMARY NAVIGATION ────────────────────────────────────────────────
function showSum(){
  var wks=allWks();
  var sel=document.getElementById('weekSel');
  var currentMon=getMon(new Date().toISOString().split('T')[0]);
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
  var roster=getDriverRoster();
  var wm=manifests.filter(function(m){return m.date>=sunday&&m.date<=friday;});
  var dm={};
  wm.forEach(function(m){var key=m.isSubstitute&&m.subFor?m.subFor:m.driverName;if(!dm[key])dm[key]=[];dm[key].push(m);});
  var gD=0,gP=0,gS=0,gW=0,gM=0,gH=0,gC=0;
  var rows=roster.map(function(drv){
    var name=drv.name,unit=drv.unit,r=rate(name);
    var d=dm[name];
    if(!d)return '<tr class="zero-row"><td><strong>'+unit+'</strong></td><td>'+name+'</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0.00</td><td>$0.00</td></tr>';
    var wD=0,wP=0,wS=0,wW=0,wM=0,wH=0;
    d.forEach(function(m){wD+=m.ttlDeliveries||0;wP+=m.ttlPickups||0;wS+=m.ttlShipments||0;wW+=m.ttlWeight||0;wM+=m.totalMiles||0;wH+=m.totalHours||0;});
    var wC=wH*r;
    gD+=wD;gP+=wP;gS+=wS;gW+=wW;gM+=wM;gH+=wH;gC+=wC;
    return '<tr class="data-row"><td><strong>'+unit+'</strong></td><td>'+name+'</td><td>'+wD+'</td><td>'+wP+'</td><td>'+wS+'</td><td>'+wW.toLocaleString()+'</td><td>'+wM+'</td><td>'+wH.toFixed(2)+'</td><td class="chg-cell">$'+wC.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td></tr>';
  }).join('');

  // J Files for this week
  var jfiles=[];try{jfiles=JSON.parse(cacheGet('ei_jfiles')||'[]');}catch(e){}
  var weekJFiles=jfiles.filter(function(j){return j.date>=sunday&&j.date<=friday;});
  var jfTotal=weekJFiles.reduce(function(s,j){return s+j.price;},0);
  var jfWt=weekJFiles.reduce(function(s,j){return s+j.wt;},0);
  var jfRow=weekJFiles.length
    ?'<tr class="data-row" style="background:#fffbeb"><td colspan="2"><strong>J Files</strong> ('+weekJFiles.length+')</td><td>—</td><td>—</td><td>'+weekJFiles.length+'</td><td>'+jfWt.toLocaleString()+'</td><td>—</td><td>—</td><td class="chg-cell">$'+jfTotal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td></tr>'
    :'';
  var grandC=gC+jfTotal;
  var grandW=gW+jfWt;
  var acps=gS>0?grandC/gS:0,acpl=grandW>0?grandC/grandW:0,asph=gH>0?gS/gH:0,amd=gM/5,acpm=gM>0?grandC/gM:0;

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
    +'<div class="sum-report-head"><div class="srh-title">Expeditors Cartage Program</div><div class="srh-week">Week Ending '+fs(friday)+'</div></div>'
    +'<div style="overflow-x:auto"><table class="sum-tbl">'
    +'<thead><tr><th>Unit</th><th>Driver</th><th>Deliveries</th><th>Pick Ups</th><th>Shipments</th><th>Weight (lbs)</th><th>Miles</th><th>Hours</th><th>Charges</th></tr></thead>'
    +'<tbody>'+rows+'</tbody>'
    +'<tfoot>'+jfRow+'<tr class="total-row"><td colspan="2"><strong>TOTAL</strong></td><td>'+gD+'</td><td>'+gP+'</td><td>'+gS+'</td><td>'+grandW.toLocaleString()+'</td><td>'+gM+'</td><td>'+gH.toFixed(2)+'</td><td class="chg-cell">$'+grandC.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td></tr></tfoot>'
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
  var roster=getDriverRoster();
  var wm=manifests.filter(function(m){return m.date>=sunday&&m.date<=friday;});
  var dm={};
  wm.forEach(function(m){var key=m.isSubstitute&&m.subFor?m.subFor:m.driverName;if(!dm[key])dm[key]=[];dm[key].push(m);});
  var rows=['Unit,Driver,Deliveries,Pick Ups,Shipments,Weight (lbs),Miles,Hours,Charges'];
  roster.forEach(function(drv){
    var name=drv.name,unit=drv.unit,r=rate(name),d=dm[name];
    if(!d){rows.push([unit,name,0,0,0,0,0,'0.00','$0.00'].join(','));return;}
    var wD=0,wP=0,wS=0,wW=0,wM=0,wH=0;
    d.forEach(function(m){wD+=m.ttlDeliveries||0;wP+=m.ttlPickups||0;wS+=m.ttlShipments||0;wW+=m.ttlWeight||0;wM+=m.totalMiles||0;wH+=m.totalHours||0;});
    var wC=wH*r;
    rows.push([unit,name,wD,wP,wS,wW,wM,wH.toFixed(2),'$'+wC.toFixed(2)].join(','));
  });
  var csv=rows.join('\n');
  var blob=new Blob([csv],{type:'text/csv'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;a.download='EI_Cartage_'+mon+'_to_'+friday+'.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  showToast('Downloaded!');
}
