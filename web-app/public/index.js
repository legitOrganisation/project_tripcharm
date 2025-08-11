// index.js – Integrated tabs: Dashboard + Geofencing
// Reuses styling and adds a tiny hash-router (#/dashboard, #/geofencing)

/***********************
 * Configuration
 ************************/
const DEFAULT_SERVER = localStorage.getItem('serverBase') || "http://ma8w.ddns.net:3000";
const GPS_POLL_MS = 5000;
const VIBRATE_COOLDOWN_MS = 60_000;
const GEOFENCE_PULL_MS = 20000; // periodic server pull to reflect deletions/changes

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

// Events panel
const eventsListEl = document.getElementById('events-list');
const eventsBadgeEl = document.getElementById('events-badge');
const ackEventsBtn = document.getElementById('ack-events');
const refreshEventsBtn = document.getElementById('refresh-events');
const toastsEl = document.getElementById('toasts');

/***********************
 * Maps objects
 ************************/
let mapDash, mkDash;
let mapGeo, mkGeo;
let markerDash, markerGeo; // device pins
let activeMode = null; // 'circle' | 'polygon' | null
let tempCircle = null, tempPolygon = null, tempPoints = [];
let lastOutsideSentAt = 0;
let lastGeoPullAt = 0;
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
 * Events store (client-side ack)
 ************************/
let lastEventSeenTs = Number(localStorage.getItem('lastEventSeenTs') || 0);
let lastRenderedEventTs = 0;

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
  // Default to Circle mode when entering geofencing
  if (showGeo && !activeMode) {
    activeMode = 'circle';
    setStatus('Circle mode: tap map to set center');
  }
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

  // Device pins
  markerDash = new google.maps.Marker({
    map: mapDash,
    position: { lat: 0, lng: 0 },
    title: "Device Location",
    icon: { url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png" }
  });
  markerGeo = new google.maps.Marker({
    map: mapGeo,
    position: { lat: 0, lng: 0 },
    title: "Device Location",
    icon: { url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png" }
  });

  // Classic Maps click listener (in addition to gmp-click)
  mapGeo.addListener('click', (e)=>{
    handleGeoMapClick(e.latLng);
  });

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

btnCircle.onclick = ()=>{
  activeMode='circle'; tempPoints=[];
  clearTempOverlays();
  setStatus('Circle mode: tap map to set center');
};
btnPolygon.onclick = ()=>{
  activeMode='polygon'; tempPoints=[];
  clearTempOverlays();
  setStatus('Polygon mode: tap map to add vertices; Save when done');
};
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
    uploadGeofencesToServer('import'); // upload after import
    setStatus('Imported geofences');
  }catch(err){ alert('Import failed: '+err.message); }
  finally{ importFile.value=''; }
};

ackEventsBtn.onclick = ()=>{
  if(lastRenderedEventTs){
    lastEventSeenTs = lastRenderedEventTs;
    localStorage.setItem('lastEventSeenTs', String(lastEventSeenTs));
    showToast('Events acknowledged.');
    highlightNewEventsInList();
  }
};
refreshEventsBtn.onclick = ()=> fetchAndRenderEvents();

function setStatus(msg){ statusBadge.textContent = msg; }

/***********************
 * Map interactions
 ************************/
// Unified click handler for geofencing map
function handleGeoMapClick(latLng){
  if(!activeMode || !mapGeo) return;
  const lat = latLng.lat(), lon = latLng.lng();

  if(activeMode==='circle'){
    clearTempOverlays();
    const r = Number(radiusInput.value)||150;
    tempCircle = new google.maps.Circle({
      map: mapGeo, center:{lat, lng:lon}, radius:r,
      strokeColor:'#2196F3', fillColor:'#2196F3', fillOpacity:0.2, strokeOpacity:0.9
    });
    tempPoints = [{lat,lon}];
    setStatus(`Center set @ ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
  } else if(activeMode==='polygon'){
    tempPoints.push({lat,lon});
    if(tempPolygon) tempPolygon.setMap(null);
    tempPolygon = new google.maps.Polygon({
      map: mapGeo, paths: tempPoints.map(p=>({lat:p.lat,lng:p.lon})),
      strokeColor:'#FF9800', fillColor:'#FF9800', fillOpacity:0.25, strokeOpacity:0.9
    });
    setStatus(`Vertex #${tempPoints.length} @ ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
  }
}

// Web-component click → route to shared handler
mapGeoEl.addEventListener('gmp-click', (e)=>{
  handleGeoMapClick(e.detail.latLng);
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
    uploadGeofencesToServer('save'); // upload after save
    clearTempOverlays();
    setStatus(`Saved circle "${name}"`);
  } else if(activeMode==='polygon' && tempPoints.length>=3){
    const g = { id: rnd(), name, type:'polygon', polygonPoints: tempPoints.slice() };
    geofences.push(g);
    saveGeofences();
    uploadGeofencesToServer('save'); // upload after save
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
  listEl.innerHTML='';
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
  uploadGeofencesToServer('delete'); // upload after delete
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

// Pull geofences from the server and replace local copy (even if empty)
async function fetchGeofencesFromServer() {
  try {
    const resp = await fetchJSON(serverBase() + "/api/download/geofencing-data");

    let serverGfs = [];
    let found = false;

    if (Array.isArray(resp)) {
      for (let i = resp.length - 1; i >= 0; i--) {
        const entry = resp[i];
        if (entry?.data?.geofences && Array.isArray(entry.data.geofences)) {
          serverGfs = entry.data.geofences; found = true; break;
        }
        if (Array.isArray(entry?.geofences)) {
          serverGfs = entry.geofences; found = true; break;
        }
        if (Array.isArray(entry?.data)) {
          serverGfs = entry.data; found = true; break;
        }
      }
    } else if (resp && Array.isArray(resp.geofences)) {
      serverGfs = resp.geofences; found = true;
    }

    if (!found) {
      // No geofence payload found on the server; keep local as-is.
      return;
    }

    const normalized = serverGfs.map(g => ({
      id: g.id || Math.random().toString(36).slice(2),
      name: g.name || "Unnamed Zone",
      type: (g.type === "polygon" ? "polygon" : "circle"),
      radius: g.radius ?? 0,
      center: g.center && g.center.lat != null && g.center.lon != null
        ? { lat: Number(g.center.lat), lon: Number(g.center.lon) }
        : null,
      polygonPoints: Array.isArray(g.polygonPoints)
        ? g.polygonPoints.map(p => ({ lat: Number(p.lat), lon: Number(p.lon) }))
        : []
    }));

    geofences = normalized; // may be []
    saveGeofences();        // writes localStorage + redraws overlays/lists
    setStatus("Geofences downloaded");
  } catch (err) {
    console.error("Download geofences error:", err);
  }
}

// Upload geofences to server
async function uploadGeofencesToServer(reason = 'manual') {
  try {
    const payload = {
      data: {
        reason,
        deviceId: (deviceIdInput?.value || 'default'),
        updatedAt: new Date().toISOString(),
        geofences: geofences.map(g => ({
          id: g.id,
          name: g.name,
          type: g.type,
          radius: g.radius ?? null,
          center: g.center ? { lat: g.center.lat, lon: g.center.lon } : null,
          polygonPoints: Array.isArray(g.polygonPoints) ? g.polygonPoints.map(p => ({ lat: p.lat, lon: p.lon })) : []
        }))
      }
    };

    const res = await fetch(serverBase() + "/api/upload/geofencing-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    setStatus('Geofences synced to server');
    if (typeof showToast === 'function') showToast('Geofences uploaded.', 'Sync');
  } catch (err) {
    console.error('Upload geofences error:', err);
    setStatus('Failed to upload geofences');
  }
}

async function pollOnce(){
  try{
    const gpsArray = await fetchJSON(serverBase()+"/api/download/gps");
    const battArray = await fetchJSON(serverBase()+"/api/download/batt-percentage");

    const latestGPS = gpsArray[gpsArray.length - 1] || {};
    const latestBatt = battArray[battArray.length - 1] || {};

    let lat = 0, lon = 0;

    if (latestGPS.gps !== undefined && latestGPS.gps !== null) {
      if (typeof latestGPS.gps === "object" && !Array.isArray(latestGPS.gps)) {
        // { lat, lon }
        lat = parseFloat(latestGPS.gps.lat) || 0;
        lon = parseFloat(latestGPS.gps.lon) || 0;
      } 
      else if (typeof latestGPS.gps === "string") {
        // "1.2345,N,103.6789,E"
        const parts = latestGPS.gps.split(',');
        if (parts.length >= 4) {
          lat = parseFloat(parts[0]) * (parts[1] === 'S' ? -1 : 1);
          lon = parseFloat(parts[2]) * (parts[3] === 'W' ? -1 : 1);
        }
      } 
      else if (Array.isArray(latestGPS.gps)) {
        // [lat, lon]
        lat = parseFloat(latestGPS.gps[0]) || 0;
        lon = parseFloat(latestGPS.gps[1]) || 0;
      }
    } 
    else if (latestGPS.latitude !== undefined && latestGPS.longitude !== undefined) {
      lat = parseFloat(latestGPS.latitude) || 0;
      lon = parseFloat(latestGPS.longitude) || 0;
    }

    const ts = latestGPS.timestamp ? new Date(latestGPS.timestamp) : new Date();

    // UI
    latEl.textContent = lat.toFixed(6);
    lonEl.textContent = lon.toFixed(6);
    document.getElementById('lat-geo').textContent = lat.toFixed(6);
    document.getElementById('lon-geo').textContent = lon.toFixed(6);
    updatedEl.textContent = ts.toLocaleString();
    batteryEl.textContent = (latestBatt.percentage != null ? latestBatt.percentage+'%' : '–');

    // Move markers
    if(mkDash) mkDash.position = { lat, lng: lon };
    if(mkGeo) mkGeo.position = { lat, lng: lon };
    if(markerDash) markerDash.setPosition({ lat, lng: lon });
    if(markerGeo) markerGeo.setPosition({ lat, lng: lon });
    mapDash?.setCenter({lat, lng: lon});

    // Inside/outside check
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

    // Fetch events each poll
    await fetchAndRenderEvents();

    // Periodically refresh geofences from server (reflect deletions)
    if (Date.now() - lastGeoPullAt > GEOFENCE_PULL_MS) {
      await fetchGeofencesFromServer();
      lastGeoPullAt = Date.now();
    }
  }catch(err){
    statusEl.textContent = 'error: '+err.message;
    console.error(err);
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

/***********************
 * Events fetch + UI
 ************************/
function timeAgo(date){
  const s = Math.floor((Date.now() - date.getTime())/1000);
  if(s < 60) return s+'s ago';
  const m = Math.floor(s/60);
  if(m < 60) return m+'m ago';
  const h = Math.floor(m/60);
  if(h < 24) return h+'h ago';
  const d = Math.floor(h/24);
  return d+'d ago';
}
function parseEventLatLon(gpsVal){
  if(!gpsVal) return {lat:null, lon:null};
  if(typeof gpsVal === 'object' && !Array.isArray(gpsVal)){
    return { lat: parseFloat(gpsVal.lat)||null, lon: parseFloat(gpsVal.lon)||null };
  }
  if(typeof gpsVal === 'string'){
    const parts = gpsVal.split(',');
    if(parts.length>=4){
      const lat = parseFloat(parts[0]) * (parts[1]==='S'?-1:1);
      const lon = parseFloat(parts[2]) * (parts[3]==='W'?-1:1);
      return { lat: isFinite(lat)?lat:null, lon: isFinite(lon)?lon:null };
    }
  }
  if(Array.isArray(gpsVal)){
    const lat = parseFloat(gpsVal[0]), lon = parseFloat(gpsVal[1]);
    return { lat: isFinite(lat)?lat:null, lon: isFinite(lon)?lon:null };
  }
  return {lat:null, lon:null};
}
function showToast(msg, title='New Event'){
  if(!toastsEl) return;
  const div = document.createElement('div');
  div.className = 'toast';
  div.innerHTML = `<strong>${title}</strong><div>${msg}</div>`;
  toastsEl.appendChild(div);
  setTimeout(()=>{
    div.classList.add('fade-out');
    setTimeout(()=> div.remove(), 300);
  }, 4000);
  if('Notification' in window){
    if(Notification.permission==='granted'){
      new Notification(title, { body: msg });
    } else if(Notification.permission==='default'){
      Notification.requestPermission().then(res=>{
        if(res==='granted') new Notification(title, { body: msg });
      });
    }
  }
}

function highlightNewEventsInList(){
  const items = eventsListEl?.querySelectorAll('li[data-ts]') || [];
  items.forEach(li=>{
    const ts = Number(li.getAttribute('data-ts')||0);
    li.style.outline = ts > lastEventSeenTs ? '1px solid #1a6fb8' : 'none';
  });
}

async function fetchAndRenderEvents(){
  try{
    const events = await fetchJSON(serverBase()+"/api/download/events");
    events.sort((a,b)=> new Date(a.timestamp) - new Date(b.timestamp));
    eventsBadgeEl.textContent = events.length;

    const newOnes = events.filter(e => new Date(e.timestamp).getTime() > lastEventSeenTs);
    if(newOnes.length){
      const newest = newOnes[newOnes.length-1];
      const when = timeAgo(new Date(newest.timestamp));
      showToast(`${newOnes.length} new ${newOnes.length>1?'events':'event'} (latest: ${newest.type || 'event'} • ${when})`, 'Events');
    }

    renderEventsList(events);

    const last = events[events.length-1];
    lastRenderedEventTs = last ? new Date(last.timestamp).getTime() : lastRenderedEventTs;

    highlightNewEventsInList();
  }catch(err){
    console.error('events error:', err);
  }
}

function renderEventsList(events){
  if(!eventsListEl) return;
  eventsListEl.innerHTML = '';
  for(const ev of events.slice().reverse()){
    const ts = new Date(ev.timestamp);
    const { lat, lon } = parseEventLatLon(ev.gps);
    const li = document.createElement('li');
    li.setAttribute('data-ts', String(ts.getTime()));
    const left = document.createElement('div');
    left.innerHTML = `<strong>${escapeHTML(ev.type || 'event')}</strong><div class="muted" style="font-size:12px;">${timeAgo(ts)} • ${lat!=null?lat.toFixed(5):'–'}, ${lon!=null?lon.toFixed(5):'–'}</div>`;
    const right = document.createElement('div');
    const fly = btn('Fly');
    fly.onclick = ()=>{
      if(lat!=null && lon!=null){
        mapDash.setCenter({lat, lng: lon});
        mapDash.setZoom(16);
      }
    };
    right.appendChild(fly);
    li.appendChild(left);
    li.appendChild(right);
    eventsListEl.appendChild(li);
  }
}

/***********************
 * Cross-tab localStorage sync
 ************************/
// If another tab changes local geofences, mirror it here
window.addEventListener('storage', (e) => {
  if (e.key === 'geofences') {
    try { geofences = JSON.parse(e.newValue || '[]'); }
    catch { geofences = []; }
    renderGeofenceLists();
    drawAllOverlays();
    setStatus('Geofences synced from another tab');
  }
});

/***********************
 * Startup sync hooks
 ************************/
// Pull from server at startup (before any upload-on-load)
window.addEventListener('load', () => fetchGeofencesFromServer());
// Optionally seed server with whatever is local on first load (keep below the fetch)
window.addEventListener('load', () => uploadGeofencesToServer('init'));
