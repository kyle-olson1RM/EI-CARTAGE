/**
 * manager.js
 * Manager dashboard — manifest cards, week navigation,
 * filtering, approve/delete actions.
 */


async function refreshMgr(){
  var fresh=await apiRefresh('ei_manifests');
  manifests=JSON.parse(fresh||cacheGet('ei_manifests')||'[]');
  document.getElementById('stTot').textContent=manifests.length;
  document.getElementById('stPend').textContent=manifests.filter(m=>m.status==='pending').length;
  document.getElementById('stDrvs').textContent=new Set(manifests.map(m=>m.driverName)).size;
  document.getElementById('stFlgs').textContent=manifests.filter(m=>m.flags&&m.flags.length>0).length;
  // Build ALL weeks (even empty ones) from earliest to current
  mgrWeeks=buildAllWeeks();
  if(mgrWeekIdx<0&&mgrWeeks.length>0) mgrWeekIdx=0; // default to most recent
  if(mgrWeekIdx>=mgrWeeks.length) mgrWeekIdx=mgrWeeks.length-1;
  updateMgrWeekLabel();

  // Populate driver dropdown
  const sel=document.getElementById('fDrv'),cur=sel.value;
  sel.innerHTML='<option value="">All Drivers</option>';
  [...new Set(manifests.map(m=>m.driverName))].sort().forEach(n=>{const o=document.createElement('option');o.value=o.textContent=n;if(n===cur)o.selected=true;sel.appendChild(o);});
  renderCards();
}

function renderCards(){
  const fd=document.getElementById('fDrv').value;
  const fs=document.getElementById('fStat').value;
  const fdy=document.getElementById('fDy').value;
  const funit=document.getElementById('fUnit')?.value||'';
  var ffrom='',fto='';
  if(mgrWeekIdx>=0&&mgrWeeks[mgrWeekIdx]){
    ffrom=mgrWeeks[mgrWeekIdx];
    var _fri=new Date(ffrom+'T12:00:00');_fri.setDate(_fri.getDate()+4);
    fto=_fri.toISOString().split('T')[0];
  }

  let list=manifests.filter(function(m){
    if(fd&&m.driverName!==fd)return false;
    if(fs&&m.status!==fs)return false;
    if(fdy&&m.dayOfWeek!==fdy)return false;
    if(funit){var u=UNIT_MAP[m.driverName]||'';if(!u.startsWith(funit))return false;}
    if(ffrom&&m.date<ffrom)return false;
    if(fto&&m.date>fto)return false;
    return true;
  }).sort(function(a,b){return new Date(b.date)-new Date(a.date);});

  var c=document.getElementById('mCards');
  if(!list.length){
    c.innerHTML='<div class="no-data"><div style="font-size:40px;margin-bottom:12px">&#128203;</div><div style="font-family:Barlow Condensed,sans-serif;font-size:20px;font-weight:700;color:var(--text2)">No manifests found</div></div>';
    return;
  }

  // Group by driver name
  var groups={};
  list.forEach(function(m){
    var key=m.isSubstitute&&m.subFor?m.subFor:m.driverName;
    if(!groups[key])groups[key]=[];
    groups[key].push(m);
  });

  var driverNames=Object.keys(groups).sort();

  // Calculate program totals for the filtered period
  var pgD=0,pgP=0,pgS=0,pgW=0,pgM=0,pgH=0,pgC=0;
  list.forEach(function(m){
    var r=rate(m.driverName);
    pgD+=m.ttlDeliveries||0;pgP+=m.ttlPickups||0;pgS+=m.ttlShipments||0;
    pgW+=m.ttlWeight||0;pgM+=m.totalMiles||0;pgH+=m.totalHours||0;
    pgC+=(m.totalHours||0)*r;
  });
  // Add J Files for this week
  var allJFiles=getJFiles();
  var weekJFiles=ffrom?allJFiles.filter(function(j){return j.date>=ffrom&&j.date<=fto;}):allJFiles;
  var jfTotal=weekJFiles.reduce(function(s,j){return s+(parseFloat(j.price)||0);},0);
  var jfWt=weekJFiles.reduce(function(s,j){return s+(parseFloat(j.wt)||0);},0);
  var pgGrandC=pgC+jfTotal;
  var pgGrandW=pgW+jfWt;
  var jfRow=weekJFiles.length
    ?'<tr class="data-row" style="background:#fffbeb"><td colspan="2"><strong>&#128196; J Files</strong> ('+weekJFiles.length+')</td><td>—</td><td>—</td><td>'+weekJFiles.length+'</td><td>'+jfWt.toLocaleString()+'</td><td>—</td><td>—</td><td class="chg-cell" style="color:#d97706">$'+jfTotal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td></tr>'
    :'';
  var pgLabel=ffrom?('Week of '+(function(){var d=new Date(ffrom+'T12:00:00');return(d.getMonth()+1)+'/'+d.getDate()+'–'+(function(){var f=new Date(ffrom+'T12:00:00');f.setDate(f.getDate()+4);return(f.getMonth()+1)+'/'+f.getDate();})()+'/'+d.getFullYear();})()):'All Weeks';
  var totalsBox='<div class="grand-box" style="margin-bottom:14px"><h3>Program Totals &mdash; '+pgLabel+'</h3>'
    +'<div class="grand-grid">'
    +'<div class="gi"><div class="gi-val">'+pgD+'</div><div class="gi-lbl">Deliveries</div></div>'
    +'<div class="gi"><div class="gi-val">'+pgP+'</div><div class="gi-lbl">Pick Ups</div></div>'
    +'<div class="gi"><div class="gi-val">'+pgS+'</div><div class="gi-lbl">Shipments</div></div>'
    +'<div class="gi"><div class="gi-val">'+pgGrandW.toLocaleString()+'</div><div class="gi-lbl">Weight (lbs)</div></div>'
    +'<div class="gi"><div class="gi-val">'+pgM+'</div><div class="gi-lbl">Miles</div></div>'
    +'<div class="gi"><div class="gi-val">'+pgH.toFixed(2)+'</div><div class="gi-lbl">Hours</div></div>'
    +'<div class="gi"><div class="gi-val">$'+pgGrandC.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</div><div class="gi-lbl">Total Charges</div></div>'
    +'<div class="gi"><div class="gi-val">$'+(pgGrandW>0?(pgGrandC/pgGrandW).toFixed(4):'0.0000')+'</div><div class="gi-lbl">Cost Per Lb</div></div>'
    +'</div></div>';

  var driverCardsHtml=driverNames.map(function(name){
    var entries=groups[name];
    var init=name.split(' ').map(function(w){return w[0];}).join('').slice(0,2);
    var unit=UNIT_MAP[name]||'';
    var r=rate(name);
    // Driver totals
    var totDel=0,totPU=0,totWt=0,totMi=0,totHrs=0;
    entries.forEach(function(m){totDel+=m.ttlDeliveries||0;totPU+=m.ttlPickups||0;totWt+=m.ttlWeight||0;totMi+=m.totalMiles||0;totHrs+=m.totalHours||0;});
    var totChg=totHrs*r;
    var anyPending=entries.some(function(m){return m.status==='pending';});
    var anyFlag=entries.some(function(m){return m.flags&&m.flags.length>0;});
    // Collect all notes from deliveries and pickups for tooltip
    var flagNotes=[];
    entries.forEach(function(m){
      (m.deliveries||[]).forEach(function(d){if(d.note&&d.note.trim())flagNotes.push(d.note.trim());});
      (m.pickups||[]).forEach(function(p){if(p.note&&p.note.trim())flagNotes.push(p.note.trim());});
      if(m.flags&&m.flags.length)m.flags.forEach(function(f){if(f&&f.trim())flagNotes.push(f.trim());});
    });
    var flagTooltip=flagNotes.length?flagNotes.join(' | '):'Has driver notes';
    flagNotesMap[name]=flagNotes;

    // Build daily rows for this driver
    var dayRows=entries.map(function(m){
      var ds=new Date(m.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
      var chg=(m.totalHours||0)*r;
      var acps=m.ttlShipments>0?chg/m.ttlShipments:0;
      var flaggedDelSet=new Set((m.flaggedStops||[]).filter(function(f){return f.type==='d';}).map(function(f){return f.idx;}));
      var delRows=(m.deliveries||[]).map(function(d,i){
        var isFlagged=flaggedDelSet.has(i);
        var rowStyle=isFlagged?'background:#fffbeb;border-left:3px solid #d97706':d.isSubDrop?'background:var(--accent-light)':'background:var(--surface2)';
        var flagReason=isFlagged?((m.flaggedStops||[]).find(function(f){return f.type==='d'&&f.idx===i;})||{}).reason||'':'';
        return '<tr style="'+rowStyle+'"><td style="padding-left:24px">'+(i+1)+'</td><td style="font-family:monospace;font-size:11px">'+(d.proNum||'&mdash;')+'</td><td>'+(d.consignee||'&mdash;')+'</td><td>'+(d.city||'&mdash;')+'</td><td style="text-align:center">'+d.pieces+'</td><td style="text-align:center;font-weight:600">'+((d.weight||0).toLocaleString())+'</td><td style="font-size:11px">'+(d.timeIn||'&mdash;')+'&rarr;'+(d.timeOut||'&mdash;')+'</td>'+(d.note?'<td style="background:var(--warn-light);color:var(--warn);font-size:11px;font-weight:600">&#128221; '+d.note+'</td>':'<td></td>')+(isFlagged?'<td style="color:#d97706;font-weight:700;font-size:11px;white-space:nowrap">&#9888; '+flagReason+'</td>':'<td></td>')+'</tr>';
      }).join('');
      var flaggedPuSet=new Set((m.flaggedStops||[]).filter(function(f){return f.type==='p';}).map(function(f){return f.idx;}));
      var puRows=(m.pickups||[]).map(function(p,i){
        var isFlagged=flaggedPuSet.has(i);
        var rowStyle=isFlagged?'background:#fffbeb;border-left:3px solid #d97706':'background:var(--accent-light)';
        var flagReason=isFlagged?((m.flaggedStops||[]).find(function(f){return f.type==='p'&&f.idx===i;})||{}).reason||'':'';
        return '<tr style="'+rowStyle+'"><td style="padding-left:24px">'+(i+1)+'</td><td style="font-family:monospace;font-size:11px">'+(p.proNum||'&mdash;')+'</td><td>'+(p.shipper||'&mdash;')+'</td><td style="text-align:center">'+p.pieces+'</td><td style="text-align:center;font-weight:600">'+((p.weight||0).toLocaleString())+'</td><td style="font-size:11px">PU: '+(p.pickupIn||'&mdash;')+'&rarr;'+(p.pickupOut||'&mdash;')+'</td><td style="font-size:11px">'+(p.dropLocation||'&mdash;')+': '+(p.arriveExp||'&mdash;')+'&rarr;'+(p.departExp||'&mdash;')+'</td>'+(p.note?'<td style="background:var(--warn-light);color:var(--warn);font-size:11px;font-weight:600">&#128221; '+p.note+'</td>':'<td></td>')+(isFlagged?'<td style="color:#d97706;font-weight:700;font-size:11px;white-space:nowrap">&#9888; '+flagReason+'</td>':'<td></td>')+'</tr>';
      }).join('');
      var detailTbls='';
      if(m.deliveries&&m.deliveries.length){
        detailTbls+='<div style="padding:0 12px 8px"><div style="font-family:Barlow Condensed,sans-serif;font-size:12px;font-weight:700;color:var(--accent);letter-spacing:.5px;text-transform:uppercase;padding:6px 0 4px">Deliveries</div><div style="overflow-x:auto"><table class="det-tbl"><thead><tr><th>#</th><th>Ref #</th><th>Consignee</th><th>City</th><th style="text-align:center">Pcs</th><th style="text-align:center">Wt</th><th>Times</th></tr></thead><tbody>'+delRows+'</tbody></table></div></div>';
      }
      if(m.pickups&&m.pickups.length){
        detailTbls+='<div style="padding:0 12px 8px"><div style="font-family:Barlow Condensed,sans-serif;font-size:12px;font-weight:700;color:var(--accent);letter-spacing:.5px;text-transform:uppercase;padding:6px 0 4px">Pick Ups</div><div style="overflow-x:auto"><table class="det-tbl"><thead><tr><th>#</th><th>Ref #</th><th>Shipper</th><th style="text-align:center">Pcs</th><th style="text-align:center">Wt</th><th>PU Times</th><th>Drop Times</th></tr></thead><tbody>'+puRows+'</tbody></table></div></div>';
      }

      return '<div class="day-entry" id="dentry_'+m.id+'" style="border-top:1px solid var(--border)">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--surface2)">'+
          '<div>'+
            '<div style="font-family:Barlow Condensed,sans-serif;font-size:16px;font-weight:700">'+m.dayOfWeek+' &middot; '+ds+'</div>'+
            '<div style="font-size:11px;color:var(--muted);margin-top:2px">Truck '+( m.truckNum||'&mdash;')+' &middot; '+m.startTime+' &rarr; '+m.endTime+' &middot; '+m.totalHours+' hrs</div>'+
          '</div>'+
          '<div style="display:flex;gap:10px;align-items:center">'+
            '<span style="font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;color:var(--accent)">$'+chg.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</span>'+
            '<span class="mbadge '+(m.status==='reviewed'?'br':'bp')+'">'+m.status.toUpperCase()+'</span>'+
          '</div>'+
        '</div>'+
        '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0;border-bottom:1px solid var(--border)">'+
          '<div class="cs" style="padding:8px;border-right:1px solid var(--border)"><div class="cs-val">'+m.ttlDeliveries+'</div><div class="cs-lbl">Del</div></div>'+
          '<div class="cs" style="padding:8px;border-right:1px solid var(--border)"><div class="cs-val">'+m.ttlPickups+'</div><div class="cs-lbl">PU</div></div>'+
          '<div class="cs" style="padding:8px;border-right:1px solid var(--border)"><div class="cs-val">'+((m.ttlWeight||0).toLocaleString())+'</div><div class="cs-lbl">lbs</div></div>'+
          '<div class="cs" style="padding:8px;border-right:1px solid var(--border)"><div class="cs-val">'+(m.totalMiles||0)+'</div><div class="cs-lbl">Miles</div></div>'+'<div class="cs" style="padding:8px;border-right:1px solid var(--border)"><div class="cs-val">'+(m.totalHours||0).toFixed(2)+'</div><div class="cs-lbl">Hours</div></div>'+
          '<div class="cs" style="padding:8px"><div class="cs-val">$'+acps.toFixed(2)+'</div><div class="cs-lbl">$/Ship</div></div>'+
        '</div>'+
        detailTbls+
        '<div style="display:flex;gap:8px;padding:10px 14px;border-top:1px solid var(--border)">'+
          '<button class="ea-btn" title="Edit" data-mid="'+m.id+'" onclick="editManifest(this.dataset.mid)" style="background:var(--accent-light);color:var(--accent);border-color:var(--accent)">&#9998;</button>'+
          '<button class="ea-btn ea-del" title="Delete manifest" data-mid="'+m.id+'" onclick="if(confirm(\'Delete this manifest?\'))delM(this.dataset.mid)">&#128465;</button>'+
          '<button class="ea-btn ea-ok" style="font-size:13px;height:36px" data-mid="'+m.id+'" onclick="appM(this.dataset.mid)">'+(m.status==='reviewed'?'Reviewed':'Mark Reviewed')+'</button>'+
        '</div>'+
      '</div>';
    }).join('');

    return '<div class="driver-group" data-gid="'+name+'">'+
      '<div class="dg-header" onclick="toggleGroup(this)">'+
        '<div class="avatar">'+init+'</div>'+
        '<div style="flex:1">'+
          '<div class="mcard-driver">'+name+' <span style="font-size:12px;font-weight:700;color:'+(unit.toUpperCase().startsWith('ST')?'var(--success)':'var(--accent)')+';margin-left:6px;background:'+(unit.toUpperCase().startsWith('ST')?'var(--success-light)':'var(--accent-light)')+';padding:1px 6px;border-radius:3px">'+(unit.toUpperCase().startsWith('ST')?'ST':'TT')+'</span> <span style="font-size:11px;color:var(--muted);font-weight:400">'+unit+'</span></div>'+
          '<div class="mcard-meta">'+entries.length+' day'+(entries.length!==1?'s':'')+' &middot; '+totDel+' del &middot; '+totPU+' PU &middot; '+totWt.toLocaleString()+' lbs &middot; '+totMi+' mi</div>'+
        '</div>'+
        '<div style="display:flex;align-items:center;gap:8px">'+
          (anyFlag?'<span class="flag-icon" style="font-size:16px;cursor:pointer" onclick="showFlagPopup(this)" data-gid="'+name+'">&#9888;</span>':'')+
          '<span class="mbadge '+(anyPending?'bp':'br')+'">'+(anyPending?'PENDING':'REVIEWED')+'</span>'+
          '<div style="font-family:Barlow Condensed,sans-serif;font-size:17px;font-weight:800;color:var(--accent)">$'+totChg.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</div>'+
          '<span class="dg-arrow" style="color:var(--muted);font-size:20px;transition:transform .25s;display:inline-block">&#8964;</span>'+
        '</div>'+
      '</div>'+
      '<div class="dg-body" style="display:none">'+dayRows+'</div>'+
    '</div>';
  }).join('');
  // Build J Files row HTML for display below driver cards
  var jfCardHtml='';
  if(weekJFiles.length){
    jfCardHtml='<div class="driver-group" style="border:1.5px solid #d97706;border-radius:8px;margin-bottom:10px;overflow:hidden">'
      +'<div style="background:#fffbeb;padding:12px 14px;display:flex;align-items:center;justify-content:space-between">'
      +'<div style="font-family:Barlow Condensed,sans-serif;font-size:17px;font-weight:700">&#128196; J Files <span style="font-size:13px;font-weight:400;color:var(--muted)">('+weekJFiles.length+' entries)</span></div>'
      +'<div style="font-family:Barlow Condensed,sans-serif;font-size:20px;font-weight:800;color:#d97706">$'+jfTotal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</div>'
      +'</div>'
      +'<div style="padding:10px 14px;font-size:12px;color:var(--text2)">'
      +weekJFiles.map(function(j){
        return '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)">'
          +'<span>'+j.date+' &nbsp;·&nbsp; '+(j.ref||j.expRef||'—')+'</span>'
          +'<span style="font-weight:700;color:#d97706">$'+(parseFloat(j.price)||0).toFixed(2)+'</span>'
          +'</div>';
      }).join('')
      +'</div>'
      +'</div>';
  }
  c.innerHTML=totalsBox+driverCardsHtml+jfCardHtml;
}

function openMod(id){
  var m=manifests.find(function(x){return x.id===id;});
  if(!m)return;
  var r=rate(m.driverName),chg=(m.totalHours||0)*r;
  var ds=new Date(m.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  var fh=m.flags&&m.flags.length>0?m.flags.join(' &middot; '):'';

  // Build deliveries table rows
  var delRows='';
  var flaggedDelIdx=new Set((m.flaggedStops||[]).filter(function(f){return f.type==='d';}).map(function(f){return f.idx;}));
  (m.deliveries||[]).forEach(function(d,i){
    var isFlagged=flaggedDelIdx.has(i);
    delRows+='<tr'+(isFlagged?' style="background:#fffbeb;border-left:3px solid #d97706"':d.isSubDrop?' style="background:var(--accent-light)"':'')+'>'+
      '<td>'+(d.proNum||'&mdash;')+'</td>'+
      '<td>'+(d.shipper||'&mdash;')+'</td>'+
      '<td>'+(d.pieces||0)+'</td>'+
      '<td>'+(d.wt||d.weight||0)+' lbs</td>'+
      '<td>'+(d.city||'&mdash;')+'</td>'+
      '<td>'+(d.consignee||'&mdash;')+'</td>'+
      '<td>'+(d.timeIn||'&mdash;')+' &rarr; '+(d.timeOut||'&mdash;')+'</td>'+
      (d.note?'<td><em>'+d.note+'</em></td>':'<td></td>')+
      (isFlagged?'<td style="color:#d97706;font-weight:700;font-size:11px">&#9888; '+((m.flaggedStops||[]).find(function(f){return f.type==='d'&&f.idx===i;})||{}).reason+'</td>':'<td></td>')+
    '</tr>';
  });

  // Build pickups table rows
  var puRows='';
  var flaggedPuIdx=new Set((m.flaggedStops||[]).filter(function(f){return f.type==='p';}).map(function(f){return f.idx;}));
  (m.pickups||[]).forEach(function(p,i){
    var isFlagged=flaggedPuIdx.has(i);
    puRows+='<tr'+(isFlagged?' style="background:#fffbeb;border-left:3px solid #d97706"':p.isSubDrop?' style="background:var(--accent-light)"':'')+'>'+
      '<td>'+(p.proNum||'&mdash;')+'</td>'+
      '<td>'+(p.expRef||'&mdash;')+'</td>'+
      '<td>'+(p.shipper||'&mdash;')+'</td>'+
      '<td>'+(p.pieces||0)+'</td>'+
      '<td>'+(p.wt||p.weight||0)+' lbs</td>'+
      '<td>'+(p.pickupIn||'&mdash;')+' &rarr; '+(p.pickupOut||'&mdash;')+'</td>'+
      '<td>'+(p.dropLocation||'&mdash;')+'</td>'+
      '<td>'+(p.arriveExp||'&mdash;')+' &rarr; '+(p.departExp||'&mdash;')+'</td>'+
      (p.note?'<td><em>'+p.note+'</em></td>':'<td></td>')+
      (isFlagged?'<td style="color:#d97706;font-weight:700;font-size:11px">&#9888; '+((m.flaggedStops||[]).find(function(f){return f.type==='p'&&f.idx===i;})||{}).reason+'</td>':'<td></td>')+
    '</tr>';
  });

  var html='';
  if(fh) html+='<div class="flag-bar" style="margin:0 0 8px">'+fh+'</div>';

  html+='<h2>'+m.driverName+' &mdash; '+m.dayOfWeek+'</h2>';
  html+='<div style="font-size:12px;color:var(--muted);margin-bottom:12px">'+ds+
    ' &middot; Truck '+(m.truckNum||'&mdash;')+
    ' &middot; Driver #'+(m.driverNum||'&mdash;')+
    (m.isSubstitute?' &middot; <span style="color:var(--warn);font-weight:700">SUB for '+(m.subFor||'?')+'</span>':'')+
  '</div>';

  html+='<div class="mod-stats">'+
    '<div class="ms"><div class="ms-v">'+(m.ttlDeliveries||0)+'</div><div class="ms-l">Deliveries</div></div>'+
    '<div class="ms"><div class="ms-v">'+(m.ttlPickups||0)+'</div><div class="ms-l">Pick Ups</div></div>'+
    '<div class="ms"><div class="ms-v">'+(m.ttlShipments||0)+'</div><div class="ms-l">Shipments</div></div>'+
    '<div class="ms"><div class="ms-v">'+(m.ttlWeight||0).toLocaleString()+'</div><div class="ms-l">lbs</div></div>'+
    '<div class="ms"><div class="ms-v">'+(m.totalMiles||0)+'</div><div class="ms-l">Miles</div></div>'+'<div class="ms"><div class="ms-v">'+(m.totalHours||0).toFixed(2)+'</div><div class="ms-l">Hours</div></div>'+
    '<div class="ms"><div class="ms-v">'+(m.totalHours||0).toFixed(2)+'</div><div class="ms-l">Hours</div></div>'+
    '<div class="ms"><div class="ms-v ms-chg">$'+chg.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</div><div class="ms-l">Charges</div></div>'+
  '</div>';

  html+='<div class="mod-times">'+
    '<div><span>Start:</span> '+(m.startTime||'&mdash;')+'</div>'+
    '<div><span>End:</span> '+(m.endTime||'&mdash;')+'</div>'+
    '<div><span>Miles:</span> '+(m.totalMiles||0)+'</div>'+'<div><span>Hours:</span> '+(m.totalHours||0).toFixed(2)+'</div>'+
  '</div>';

  if(delRows){
    html+='<div class="mod-section-head">Deliveries ('+(m.deliveries||[]).length+')</div>';
    html+='<div style="overflow-x:auto"><table class="mod-tbl">'+
      '<thead><tr><th>Pro #</th><th>Shipper</th><th>Pcs</th><th>Weight</th><th>City</th><th>Consignee</th><th>Time In/Out</th><th>Note</th><th>Flag</th></tr></thead>'+
      '<tbody>'+delRows+'</tbody></table></div>';
  }

  if(puRows){
    html+='<div class="mod-section-head">Pick Ups ('+(m.pickups||[]).length+')</div>';
    html+='<div style="overflow-x:auto"><table class="mod-tbl">'+
      '<thead><tr><th>Pro #</th><th>Exp Ref</th><th>Shipper</th><th>Pcs</th><th>Weight</th><th>Time</th><th>Drop</th><th>At Exp</th><th>Note</th><th>Flag</th></tr></thead>'+
      '<tbody>'+puRows+'</tbody></table></div>';
  }

  html+='<div class="modal-actions">';
  html+='<button class="mbtn" data-mid="'+id+'" onclick="editManifest(this.dataset.mid)" style="background:var(--accent-light);color:var(--accent);border:1.5px solid var(--accent)">&#9998; Edit</button>';
  html+='<button class="mbtn mbtn-del" data-mid="'+id+'" onclick="delM(this.dataset.mid)">&#128465; Delete</button>';
  html+='<button class="mbtn mbtn-ok" data-mid="'+id+'" onclick="appM(this.dataset.mid)">'+(m.status==='reviewed'?'Reviewed':'Mark Reviewed')+'</button>';
  html+='</div>';

  document.getElementById('modContent').innerHTML=html;
  document.getElementById('modOv').classList.add('open');
}


// ── EDIT MANIFEST ─────────────────────────────────────────────────────────────
function editManifest(id){
  var m=manifests.find(function(x){return x.id===id;});
  if(!m)return;
  if(!confirm('Edit this manifest? Changes will be saved immediately.'))return;

  // Store the manifest ID being edited
  editingManifestId=id;
  wasEditingFromMgr=true; // skip EOS popup on submit

  // Close modal
  document.getElementById('modOv').classList.remove('open');

  // Pre-fill the form
  clearForm();
  ss('driverForm');

  setTimeout(function(){
    var set=function(elId,val){var e=document.getElementById(elId);if(e)e.value=val||'';};
    set('fName', m.driverName);
    set('fTruck', m.truckNum);
    set('fDate', m.date);
    set('fStart', m.startTime);
    set('fEnd', m.endTime);
    // Restore mileage from totalMiles if we have it
    // Always restore mileage fields
    set('fSMi', m.startMileage||'');
    set('fEMi', m.endMileage||'');
    onDateChange();calcHours();calcMiles();

    // Restore deliveries
    if(!(m.deliveries||[]).length && !(m.pickups||[]).length){
      showToast('No stop detail available — this manifest was submitted before stop cards were added');
    }
    (m.deliveries||[]).forEach(function(d){
      if(typeof addDelStop==='function') addDelStop(); else addDel();
      var id2=delIds[delIds.length-1];
      var set2=function(fid,val){var e=document.getElementById(fid);if(e)e.value=val||'';};
      set2('dref_'+id2, d.proNum);
      set2('dp_'+id2, d.pieces);
      set2('dw_'+id2, d.weight);
      set2('dcity_'+id2, d.city);
      set2('dcons_'+id2, d.consignee);
      set2('dtin_'+id2, d.timeIn);
      set2('dtout_'+id2, d.timeOut);
      if(d.note){
        var nw=document.getElementById('dnote_wrap_'+id2);
        var nt=document.getElementById('dnote_'+id2);
        if(nt)nt.value=d.note;
        if(nw)nw.style.display='block';
      }
    });

    // Restore pickups
    (m.pickups||[]).forEach(function(p){
      if(typeof addPUStop==='function') addPUStop(); else addPU();
      var id2=puIds[puIds.length-1];
      var set2=function(fid,val){var e=document.getElementById(fid);if(e)e.value=val||'';};
      set2('pref_'+id2, p.proNum);
      set2('pexpref_'+id2, p.expRef);
      set2('pp_'+id2, p.pieces);
      set2('pw_'+id2, p.weight);
      set2('pship_'+id2, p.shipper);
      set2('ptin_'+id2, p.pickupIn);
      set2('ptout_'+id2, p.pickupOut);
      if(typeof _setDropLocationValue==='function')_setDropLocationValue('pdrop_'+id2, p.dropLocation);
      else set2('pdrop_'+id2, p.dropLocation);
      set2('parr_'+id2, p.arriveExp);
      set2('pdep2_'+id2, p.departExp);
      if(p.pickupIn&&p.pickupOut&&typeof _revealPuDropSection==='function')_revealPuDropSection(id2);
      if(p.note){
        var nw=document.getElementById('pnote_wrap_'+id2);
        var nt=document.getElementById('pnote_'+id2);
        if(nt)nt.value=p.note;
        if(nw)nw.style.display='block';
      }
    });

    updateTotals();

    // Show end time and end mileage fields for editing
    var endTimeRow=document.getElementById('endTimeRow');
    var endMiRow=document.getElementById('endMiRow');
    if(endTimeRow)endTimeRow.style.display='block';
    if(endMiRow)endMiRow.style.display='block';

    // Change form header to show EDITING mode
    var header=document.querySelector('#driverForm .app-header h1');
    if(header)header.textContent='Edit Manifest';
    var indicator=document.getElementById('draftIndicator');
    if(indicator){indicator.textContent='Editing saved manifest';indicator.style.color='var(--warn)';}

    updateTotals();
    // Set summary text on all stop cards so they show info when collapsed
    // (same format used everywhere else: PRO#+Consignee / Shipper+PRO#)
    delIds.forEach(function(id){
      if(typeof _updateDelSummary==='function')_updateDelSummary(id);
      var done=document.getElementById('stdone_'+id);
      if(done) done.style.display='flex';
    });
    puIds.forEach(function(id){
      if(typeof _updatePuSummary==='function')_updatePuSummary(id);
      var done=document.getElementById('stdone_'+id);
      if(done) done.style.display='flex';
    });
    updateTotals();
    if(typeof _collapseAllExceptLast==='function') _collapseAllExceptLast();
    showToast('\u270e Editing manifest — submit to save changes');
  }, 300);
}

var editingManifestId=null;


function closeMod(e){if(e.target===document.getElementById('modOv'))document.getElementById('modOv').classList.remove('open');}

async function appM(id){
  var m=manifests.find(function(x){return x.id===id;});
  if(!m)return;
  var result=await refreshThenMutateManifests(function(fresh){
    var idx=fresh.findIndex(function(x){return x.id===id;});
    if(idx>=0)fresh[idx].status='reviewed';
    return fresh;
  });
  if(!result.ok){showToast('\u26a0 Could not save — check connection and try again',4000);return;}
  // Update card expand button
  var btn=document.querySelector('[data-mid="'+id+'"].ea-btn.ea-ok');
  if(btn)btn.textContent='Reviewed';
  // Update card badge
  var badge=btn?btn.closest('.day-entry')?.querySelector('.mbadge'):null;
  if(badge){badge.className='mbadge br';badge.textContent='REVIEWED';}
  // Update modal button if open
  var mBtn=document.querySelector('[data-mid="'+id+'"].mbtn-ok');
  if(mBtn)mBtn.textContent='Reviewed';
  // Update driver group header badge
  var group=btn?btn.closest('.driver-group'):null;
  if(group){
    var allReviewed=Array.from(group.querySelectorAll('.day-entry')).every(function(de){
      return de.querySelector('.mbadge.br');
    });
    var groupBadge=group.querySelector('.dg-header .mbadge');
    if(groupBadge&&allReviewed){groupBadge.className='mbadge br';groupBadge.textContent='REVIEWED';}
  }
  document.getElementById('stPend').textContent=manifests.filter(function(x){return x.status==='pending';}).length;
  showToast('Marked reviewed');
}

async function delM(id){
  if(!confirm('Delete this manifest?'))return;
  var result=await refreshThenMutateManifests(function(fresh){return fresh.filter(function(m){return m.id!==id;});});
  if(!result.ok){showToast('\u26a0 Delete failed — check connection and try again',4000);return;}
  document.getElementById('modOv').classList.remove('open');
  refreshMgr();
  showToast('Deleted');
}

async function clearAll(){
  if(!confirm('Delete ALL manifests? Cannot be undone.'))return;
  var result=await refreshThenMutateManifests(function(){return [];});
  if(!result.ok){showToast('\u26a0 Clear failed — check connection and try again',4000);return;}
  refreshMgr();
  showToast('All cleared');
}

function save(){saveManifests();}

function toggleGroup(el){
  var body=el.nextElementSibling;
  var arrow=el.querySelector('.dg-arrow');
  if(!body)return;
  var open=body.style.display==='block';
  body.style.display=open?'none':'block';
  if(arrow)arrow.style.transform=open?'':'rotate(180deg)';
}

function toggleCard(el){
  var card=el.closest('.mcard');
  var id=card?card.dataset.mid:'';
  if(!id)return;
  const exp=document.getElementById('expand_'+id);
  const arr=document.getElementById('arrow_'+id);
  if(!exp)return;
  const open=exp.style.display==='block';
  exp.style.display=open?'none':'block';
  if(arr)arr.style.transform=open?'':'rotate(180deg)';
}

function buildAllWeeks(){
  // Build every week from a fixed program start date to current week
  var pad=function(n){return String(n).padStart(2,'0');};
  var fmt=function(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
  var today=new Date();
  // Get Monday of current week
  var day=today.getDay();
  var thisMon=new Date(today);
  thisMon.setDate(today.getDate()-(day===0?6:day-1));

  // Start from earliest manifest OR program start (Jan 1 2025), whichever is earlier
  var dates=manifests.map(function(m){return m.date;}).filter(Boolean).sort();
  var programStart='2025-01-06'; // First Monday of 2025 - adjust as needed
  var earliest=dates.length&&dates[0]<programStart?dates[0]:programStart;
  var earliestDate=new Date(earliest+'T12:00:00');
  var ed=earliestDate.getDay();
  var earliestMon=new Date(earliestDate);
  earliestMon.setDate(earliestDate.getDate()-(ed===0?6:ed-1));

  // Generate every Monday from earliest to current week
  var weeks=[];
  var cur=new Date(earliestMon);
  while(cur<=thisMon){
    weeks.push(fmt(cur));
    cur.setDate(cur.getDate()+7);
  }
  return weeks.reverse(); // newest first - index 0 = most recent
}

function updateMgrWeekLabel(){
  var el=document.getElementById('mgrWeekLabel');
  if(!el)return;
  if(mgrWeekIdx<0||!mgrWeeks[mgrWeekIdx]){
    el.textContent='All Weeks';
    el.style.color='var(--muted)';
  } else {
    var mon=new Date(mgrWeeks[mgrWeekIdx]+'T12:00:00');
    var sun=new Date(mon); sun.setDate(mon.getDate()-1);
    var sat=new Date(mon); sat.setDate(mon.getDate()+5);
    function mf(d){return (d.getMonth()+1)+'/'+d.getDate();}
    el.textContent=mf(sun)+' – '+mf(sat);
    el.style.color='var(--accent)';
  }
}

function shiftMgrWeek(dir){
  if(!mgrWeeks.length)return;
  if(mgrWeekIdx<0){
    mgrWeekIdx=dir>0?mgrWeeks.length-1:0;
  } else {
    mgrWeekIdx+=dir;
    if(mgrWeekIdx<0)mgrWeekIdx=0;
    if(mgrWeekIdx>=mgrWeeks.length)mgrWeekIdx=mgrWeeks.length-1;
  }
  updateMgrWeekLabel();
  renderCards();
}

function setMgrWeekAll(){
  mgrWeekIdx=-1;
  updateMgrWeekLabel();
  renderCards();
}


// ── FLAG NOTES POPUP ──────────────────────────────────────────────────────────
var flagNotesMap={};

function showFlagPopup(el){
  var gid=el.dataset.gid;
  var notes=flagNotesMap[gid]||['No notes found'];
  // Remove any existing popup
  var existing = document.getElementById('flagPopup');
  if(existing){ existing.remove(); return; }

  var popup = document.createElement('div');
  popup.id = 'flagPopup';
  popup.style.cssText = 'position:fixed;z-index:9999;background:#1a1a1a;color:white;'+
    'padding:10px 14px;border-radius:8px;font-size:13px;max-width:280px;'+
    'box-shadow:0 4px 20px rgba(0,0,0,.4);line-height:1.5;';

  // Position near the tapped element
  var rect = el.getBoundingClientRect();
  var top = rect.bottom + 8;
  var left = Math.min(rect.left, window.innerWidth - 300);
  popup.style.top = top + 'px';
  popup.style.left = Math.max(8, left) + 'px';

  // Header
  popup.innerHTML = '<div style="font-family:Barlow Condensed,sans-serif;font-size:11px;'+
    'font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:rgba(255,255,255,.5);'+
    'margin-bottom:6px">Driver Notes</div>'+
    '<div>'+notes.map(function(n){
      return '<div style="padding:3px 0;border-bottom:1px solid rgba(255,255,255,.1)">&#9888; '+n+'</div>';
    }).join('')+'</div>';

  document.body.appendChild(popup);

  // Close on any tap outside
  setTimeout(function(){
    document.addEventListener('click', function removePop(){
      var p = document.getElementById('flagPopup');
      if(p) p.remove();
      document.removeEventListener('click', removePop);
    });
    document.addEventListener('touchend', function removePop2(){
      var p = document.getElementById('flagPopup');
      if(p) p.remove();
      document.removeEventListener('touchend', removePop2);
    });
  }, 100);
}

// ── J FILES ──────────────────────────────────────────────────────────────────
function getJFiles(){
  try{ return JSON.parse(cacheGet('ei_jfiles')||'[]'); }catch(e){ return []; }
}

function saveJFiles(jfiles){
  saveToStore('ei_jfiles', JSON.stringify(jfiles));
}

function showJFiles(){
  var today = new Date().toISOString().split('T')[0];
  var dateEl = document.getElementById('jfDate');
  if(dateEl && !dateEl.value) dateEl.value = today;
  renderJFilesList();
  document.getElementById('jfilesOv').classList.add('open');
}

function addJFile(){
  var date      = document.getElementById('jfDate')?.value;
  var ref       = document.getElementById('jfRef')?.value.trim().toUpperCase();
  var expRef    = document.getElementById('jfExpRef')?.value.trim().toUpperCase();
  var price     = parseFloat(document.getElementById('jfPrice')?.value)||0;
  var pcs       = parseInt(document.getElementById('jfPcs')?.value)||0;
  var wt        = parseFloat(document.getElementById('jfWt')?.value)||0;
  var shipper   = document.getElementById('jfShipper')?.value.trim().toUpperCase();
  var consignee = document.getElementById('jfConsignee')?.value.trim().toUpperCase();

  if(!date){ showToast('Please enter a date',3000); return; }
  if(!ref && !expRef){ showToast('Please enter at least one reference #',3000); return; }
  if(!price){ showToast('Please enter a price',3000); return; }

  var jfiles = getJFiles();
  jfiles.push({
    id: Date.now().toString(),
    date, ref, expRef, price, pcs, wt, shipper, consignee
  });
  saveJFiles(jfiles);

  // Clear form
  ['jfRef','jfExpRef','jfPrice','jfPcs','jfWt','jfShipper','jfConsignee']
    .forEach(function(id){ var el=document.getElementById(id); if(el)el.value=''; });

  renderJFilesList();
  showToast('\u2713 J File added');
}

function deleteJFile(id){
  if(!confirm('Remove this J File?')) return;
  var jfiles = getJFiles().filter(function(j){ return j.id !== id; });
  saveJFiles(jfiles);
  renderJFilesList();
}

function renderJFilesList(){
  var el = document.getElementById('jfilesList');
  if(!el) return;
  var jfiles = getJFiles();
  if(!jfiles.length){
    el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:12px">No J Files added yet</div>';
    return;
  }
  var total = jfiles.reduce(function(s,j){ return s+j.price; }, 0);
  el.innerHTML = '<div style="font-family:Barlow Condensed,sans-serif;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:8px">'+jfiles.length+' J Files — $'+total.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</div>'
    + jfiles.map(function(j){
      return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:10px 12px;margin-bottom:8px;display:flex;align-items:flex-start;justify-content:space-between;gap:10px">'
        +'<div style="flex:1;font-size:13px">'
          +'<div style="font-weight:700;color:var(--accent)">'+j.date+' &nbsp;·&nbsp; $'+j.price.toFixed(2)+'</div>'
          +'<div style="color:var(--text2);margin-top:2px">'+(j.ref||'—')+' / '+(j.expRef||'—')+'</div>'
          +'<div style="color:var(--muted);font-size:12px;margin-top:2px">'+(j.shipper||'—')+' → '+(j.consignee||'—')+' &nbsp;·&nbsp; '+j.pcs+' pcs &nbsp;·&nbsp; '+j.wt+' lbs</div>'
        +'</div>'
        +'<button data-jid="'+j.id+'" onclick="deleteJFile(this.dataset.jid)" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;flex-shrink:0;padding:0">&#128465;</button>'
      +'</div>';
    }).join('');
  // Refresh dashboard to show updated J Files
  if(typeof refreshMgr==='function') refreshMgr();
}
