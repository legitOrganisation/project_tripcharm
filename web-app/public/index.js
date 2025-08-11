// index.js – Integrated tabs: Dashboard + Geofencing
// Reuses styling and adds a tiny hash-router (#/dashboard, #/geofencing)

/***********************
 * Configuration
 ************************/
const DEFAULT_SERVER = localStorage.getItem('serverBase') || "http://ma8w.ddns.net:3000";
const GPS_POLL_MS = 5000;
const VIBRATE_COOLDOWN_MS = 60_000;

/***********************
 * DOM references
 ************************/
// Tabs
const tabDashboard = document.getElementById('tab-dashboard');
const tabGeofencing = document.getElementById('tab-geofencing');

// Views
const viewDashboard = document.querySelector('.view-dashboard');
const viewGeofencing = document.querySelectorAll('.view-geofencing');

// Shared displays
const latEl = document.getElementById('lat');
const lonEl = document.getElementById('lon');
const updatedEl = document.getElementById('updated');
const batteryEl = document.getElementById('battery');
const statusEl = document.getElementById('status');
const listEl = document.getElementById('gf-list');

// Dashboard server input
const serverBaseDashInput = document.getElementById('server-base-dash');
const refreshNowBtn = document.getElementById('refresh-now');

// Geofencing panel controls
const nameInput = document.getElementById('gf-name');
const radiusInput = document.getElementById('gf-radius');
const btnCircle = document.getElementById('gf-circle');
const btnPolygon = document.getElementById('gf-polygon');
const btnSave = document.getElementById('gf-save');
const btnClear = document.getElementById('gf-clear');
const statusBadge = document.getElementById('gf-status');
const insideFlag = document.getElementById('inside-flag');
const serverBaseInput = document.getElementById('server-base');
const deviceIdInput = document.getElementById('device-id');
const testVibrateBtn = document.getElementById('test-vibrate');

// Geofencing side readouts
const latGeoEl = document.getElementById('lat-geo');
const lonGeoEl = document.getElementById('lon-geo');
const insideGeoEl = document.getElementById('inside-geo');
const listGeoEl = document.getElementById('gf-list-geo');

// Export/Import
const exportBtn = document.getElementById('export-btn');
const importFile = document.getElementById('import-file');

/***********************
 * Maps objects
 ************************/
let mapDash, mkDash;
let mapGeo, mkGeo;
let activeMode = null; // 'circle' | 'polygon' | null
let tempCircle = null, tempPolygon = null, tempPoints = [];
let lastOutsideSentAt = 0;
const overlayById = new Map();

// Web components
const mapDashEl = document.getElementById('map');
const mkDashEl = document.getElementById('device-marker');
const mapGeoEl = document.getElementById('map-geo');
const mkGeoEl = document.getElementById('device-marker-geo');

/***********************
 * Geofence store
 ************************/
let geofences = loadGeofences();
function loadGeofences(){
  try { return JSON.parse(localStorage.getItem('geofences')||'[]'); }
  catch { return []; }
}
function saveGeofences(){
  localStorage.setItem('geofences', JSON.stringify(geofences));
  renderGeofenceLists();
  drawAllOverlays();
}

/***********************
 * Geometry
 ************************/
const R = 6371000;
const toRad = d => d*Math.PI/180;
function haversineMeters(lat1,lon1,lat2,lon2){
  const dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function pointInPolygon(pt, poly){
  let x=pt.lat,y=pt.lon,inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const xi=poly[i].lat, yi=poly[i].lon, xj=poly[j].lat, yj=poly[j].lon;
    const intersect = (yi>y)!==(yj>y) && x < ((xj-xi)*(y-yi))/(yj-yi)+xi;
    if(intersect) inside=!inside;
  }
  return inside;
}
function isInside(g,lat,lon){
  if(g.type==='circle' && g.center){
    return haversineMeters(lat,lon,g.center.lat,g.center.lon) <= (g.radius||0);
  }
  if(g.type==='polygon' && Array.isArray(g.polygonPoints) && g.polygonPoints.length>2){
    return pointInPolygon({lat,lon}, g.polygonPoints);
  }
  return true;
}

/***********************
 * Tiny router
 ************************/
function setActiveTab(hash){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  if(hash.startsWith('#/geofencing')) document.getElementById('tab-geofencing').classList.add('active');
  else document.getElementById('tab-dashboard').classList.add('active');
}
function renderRoute(){
  const hash = location.hash || '#/dashboard';
  setActiveTab(hash);
  const showGeo = hash.startsWith('#/geofencing');
  // Toggle views
  viewDashboard.classList.toggle('hidden', showGeo);
  document.getElementById('geofence-panel').classList.toggle('hidden', !showGeo);
  document.getElementById('main-geofencing').classList.toggle('hidden', !showGeo);
  // Ensure map tiles/layout update
  setTimeout(()=>{
    mapDash && google.maps.event.trigger(mapDash, 'resize');
    mapGeo && google.maps.event.trigger(mapGeo, 'resize');
  }, 50);
}
window.addEventListener('hashchange', renderRoute);

/***********************
 * Init maps
 ************************/
(async function initMaps(){
  await customElements.whenDefined('gmp-map');
  // Dashboard map
  mapDash = mapDashEl.innerMap;
  mkDash = mkDashEl.innerMarker;
  // Geofencing map
  mapGeo = mapGeoEl.innerMap;
  mkGeo = mkGeoEl.innerMarker;

  drawAllOverlays();
  renderGeofenceLists();
  renderRoute();
})();

/***********************
 * UI events
 ************************/
serverBaseInput.value = DEFAULT_SERVER;
serverBaseInput.addEventListener('change', ()=>{
  localStorage.setItem('serverBase', serverBaseInput.value.trim());
});
serverBaseDashInput.value = DEFAULT_SERVER;
serverBaseDashInput.addEventListener('change', ()=>{
  localStorage.setItem('serverBase', serverBaseDashInput.value.trim());
  serverBaseInput.value = serverBaseDashInput.value.trim();
});

deviceIdInput.addEventListener('change', ()=>{
  localStorage.setItem('deviceId', deviceIdInput.value.trim());
});
deviceIdInput.value = localStorage.getItem('deviceId') || 'default';

btnCircle.onclick = ()=>{ activeMode='circle'; tempPoints=[]; setStatus('Tap map to set center'); };
btnPolygon.onclick = ()=>{ activeMode='polygon'; tempPoints=[]; setStatus('Tap map to add polygon vertices; Save when done'); };
btnClear.onclick = ()=>{ clearTempOverlays(); setStatus('Cleared'); };
btnSave.onclick = onSave;
testVibrateBtn.onclick = async ()=>{ await sendVibrate(); setStatus('Vibrate command sent'); };
refreshNowBtn.onclick = ()=> pollOnce();

exportBtn.onclick = ()=>{
  const data = JSON.stringify({ geofences }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'geofences-export.json';
  a.click();
  URL.revokeObjectURL(url);
};
importFile.onchange = async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const text = await file.text();
  try{
    const obj = JSON.parse(text);
    if(Array.isArray(obj)) geofences = obj;
    else if(Array.isArray(obj.geofences)) geofences = obj.geofences;
    else throw new Error('Invalid file structure');
    saveGeofences();
    setStatus('Imported geofences');
  }catch(err){ alert('Import failed: '+err.message); }
  finally{ importFile.value=''; }
};

function setStatus(msg){ statusBadge.textContent = msg; }

/***********************
 * Map interactions
 ************************/
mapGeoEl.addEventListener('gmp-click', (e)=>{
  if(!activeMode || !mapGeo) return;
  const lat = e.detail.latLng.lat(), lon = e.detail.latLng.lng();
  if(activeMode==='circle'){
    clearTempOverlays();
    const r = Number(radiusInput.value)||150;
    tempCircle = new google.maps.Circle({
      map: mapGeo, center:{lat, lng:lon}, radius:r,
      strokeColor:'#2196F3', fillColor:'#2196F3', fillOpacity:0.2, strokeOpacity:0.9
    });
    tempPoints = [{lat,lon}];
  } else if(activeMode==='polygon'){
    tempPoints.push({lat,lon});
    if(tempPolygon) tempPolygon.setMap(null);
    tempPolygon = new google.maps.Polygon({
      map: mapGeo, paths: tempPoints.map(p=>({lat:p.lat,lng:p.lon})),
      strokeColor:'#FF9800', fillColor:'#FF9800', fillOpacity:0.25, strokeOpacity:0.9
    });
  }
});

function clearTempOverlays(){
  if(tempCircle){ tempCircle.setMap(null); tempCircle=null; }
  if(tempPolygon){ tempPolygon.setMap(null); tempPolygon=null; }
  tempPoints=[];
}

function onSave(){
  const name = (nameInput.value||'').trim();
  if(!name){ alert('Give this zone a name'); return; }
  if(activeMode==='circle' && tempPoints.length===1){
    const radius = Number(radiusInput.value)||150;
    const g = { id: rnd(), name, type:'circle', center:{ lat: tempPoints[0].lat, lon: tempPoints[0].lon }, radius };
    geofences.push(g);
    saveGeofences();
    clearTempOverlays();
    setStatus(`Saved circle "${name}"`);
  } else if(activeMode==='polygon' && tempPoints.length>=3){
    const g = { id: rnd(), name, type:'polygon', polygonPoints: tempPoints.slice() };
    geofences.push(g);
    saveGeofences();
    clearTempOverlays();
    setStatus(`Saved polygon "${name}"`);
  } else {
    alert('Nothing to save yet—add a circle center or at least 3 polygon points.');
  }
}

function rnd(){ return Math.random().toString(36).slice(2); }

/***********************
 * Render & overlays
 ************************/
function drawAllOverlays(){
  // clear
  for(const [,ov] of overlayById) destroyOverlay(ov);
  overlayById.clear();

  for(const g of geofences){
    if(g.type==='circle' && g.center){
      const circleDash = new google.maps.Circle({
        map: mapDash, center:{lat:g.center.lat, lng:g.center.lon}, radius:g.radius||0,
        strokeColor:'#64b5f6', fillColor:'#64b5f6', fillOpacity:0.09, strokeOpacity:0.9
      });
      const circleGeo = new google.maps.Circle({
        map: mapGeo, center:{lat:g.center.lat, lng:g.center.lon}, radius:g.radius||0,
        strokeColor:'#64b5f6', fillColor:'#64b5f6', fillOpacity:0.09, strokeOpacity:0.9
      });
      overlayById.set(g.id, { kind:'circle', dash: circleDash, geo: circleGeo });
    } else if(g.type==='polygon' && g.polygonPoints?.length>2){
      const polygonDash = new google.maps.Polygon({
        map: mapDash, paths: g.polygonPoints.map(p=>({lat:p.lat,lng:p.lon})),
        strokeColor:'#ffcc80', fillColor:'#ffcc80', fillOpacity:0.08, strokeOpacity:0.9
      });
      const polygonGeo = new google.maps.Polygon({
        map: mapGeo, paths: g.polygonPoints.map(p=>({lat:p.lat,lng:p.lon})),
        strokeColor:'#ffcc80', fillColor:'#ffcc80', fillOpacity:0.08, strokeOpacity:0.9
      });
      overlayById.set(g.id, { kind:'polygon', dash: polygonDash, geo: polygonGeo });
    }
  }
  renderGeofenceLists();
}
function destroyOverlay(ov){
  if(!ov) return;
  if(ov.dash) ov.dash.setMap(null);
  if(ov.geo) ov.geo.setMap(null);
}

function renderGeofenceLists(){
  // Dashboard list
  listEl.innerHTML='';
  // Geofencing list
  listGeoEl.innerHTML='';

  for(const g of geofences){
    const li1 = renderLi(g, true);
    const li2 = renderLi(g, false);
    listEl.appendChild(li1);
    listGeoEl.appendChild(li2);
  }
}

function renderLi(g, onDashboard){
  const li = document.createElement('li');
  const left = document.createElement('div');
  left.innerHTML = `<strong>${escapeHTML(g.name)}</strong> <span class="tag">${g.type}</span>`;
  const right = document.createElement('div');
  const flyBtn = btn('Fly');
  flyBtn.onclick = ()=> flyTo(g, onDashboard);
  const delBtn = btn('Delete');
  delBtn.onclick = ()=> deleteGeofence(g.id);
  right.appendChild(flyBtn);
  right.appendChild(delBtn);
  li.appendChild(left);
  li.appendChild(right);
  return li;
}

function btn(label){ const b=document.createElement('button'); b.textContent=label; return b; }
function escapeHTML(s){ return s.replace(/[&<>'"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c])); }

function flyTo(g, onDashboard){
  const map = onDashboard ? mapDash : mapGeo;
  if(g.type==='circle' && g.center){
    map.setCenter({lat:g.center.lat, lng:g.center.lon});
    map.setZoom(15);
  } else if(g.type==='polygon' && g.polygonPoints?.length){
    const bounds = new google.maps.LatLngBounds();
    g.polygonPoints.forEach(p=>bounds.extend({lat:p.lat,lng:p.lon}));
    map.fitBounds(bounds);
  }
}
function deleteGeofence(id){
  if(!confirm('Delete this geofence?')) return;
  geofences = geofences.filter(x=>x.id!==id);
  saveGeofences();
}

/***********************
 * Polling & outside logic
 ************************/
function serverBase(){
  const s = (serverBaseDashInput.value || serverBaseInput.value || DEFAULT_SERVER).trim();
  return s.replace(/\/$/, '');
}
async function fetchJSON(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
async function pollOnce(){
  try{
    const gps = await fetchJSON(serverBase()+"/api/download/gps");
    const batt = await fetchJSON(serverBase()+"/api/download/batt-percentage");

    const lat = Number(gps.latitude || gps.lat || gps[0] || 0);
    const lon = Number(gps.longitude || gps.lng || gps[1] || 0);
    const ts = gps.timestamp ? new Date(gps.timestamp) : new Date();

    // UI
    latEl.textContent = lat.toFixed(6);
    lonEl.textContent = lon.toFixed(6);
    document.getElementById('lat-geo').textContent = lat.toFixed(6);
    document.getElementById('lon-geo').textContent = lon.toFixed(6);
    updatedEl.textContent = ts.toLocaleString();
    batteryEl.textContent = (batt.percentage!=null ? batt.percentage+'%' : '–');

    // Move markers
    if(mkDash) mkDash.position = { lat, lng: lon };
    if(mkGeo) mkGeo.position = { lat, lng: lon };
    mapDash?.setCenter({lat, lng: lon});

    // Inside/outside
    const insideAny = geofences.some(g => isInside(g, lat, lon));
    insideFlag.textContent = insideAny ? 'Inside' : 'Outside';
    insideFlag.style.borderColor = insideAny ? '#2e7d32' : '#b71c1c';
    insideGeoEl.textContent = insideAny ? 'Inside' : 'Outside';

    if(!insideAny){
      const now = Date.now();
      if(now - lastOutsideSentAt > VIBRATE_COOLDOWN_MS){
        lastOutsideSentAt = now;
        await sendVibrate();
        statusEl.textContent = 'outside → vibrate sent';
      }else{
        statusEl.textContent = 'outside (cooldown)';
      }
    }else{
      statusEl.textContent = 'inside';
    }
  }catch(err){
    statusEl.textContent = 'error: '+err.message;
  }
}

async function sendVibrate(){
  const params = new URLSearchParams();
  params.set('deviceId', (deviceIdInput.value || 'default'));
  params.set('command', 'vibrate');
  await fetch(serverBase()+"/api/upload/command", {
    method:'POST',
    headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
    body: params.toString()
  });
}

setInterval(pollOnce, GPS_POLL_MS);
pollOnce();

// Initial route
if(!location.hash) location.hash = '#/dashboard';
renderRoute();
