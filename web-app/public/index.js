// index.js
// Geofencing in the browser with Google Maps Web Components.
// - Local persistence (localStorage)
// - Circle/Polygon editing & overlays
// - Inside/outside calculation on every device GPS poll
// - Optional server command when outside

/***********************
 * Configuration
 ************************/
const DEFAULT_SERVER = "http://ma8w.ddns.net:3000"; // change as needed
const GPS_POLL_MS = 5000; // how often to poll device GPS/battery
const VIBRATE_COOLDOWN_MS = 60_000; // throttle server 'vibrate' commands

/***********************
 * DOM references
 ************************/
const mapEl = document.getElementById('map');
const deviceMarkerEl = document.getElementById('device-marker');

const latEl = document.getElementById('lat');
const lonEl = document.getElementById('lon');
const updatedEl = document.getElementById('updated');
const batteryEl = document.getElementById('battery');
const statusEl = document.getElementById('status');
const listEl = document.getElementById('gf-list');

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

const exportBtn = document.getElementById('export-btn');
const importFile = document.getElementById('import-file');

/***********************
 * Maps objects (once ready)
 ************************/
let map, gmDeviceMarker;
let activeMode = null; // 'circle' | 'polygon' | null
let tempCircle = null, tempPolygon = null, tempPoints = [];
let lastOutsideSentAt = 0;

// Saved overlays for each geofence by id
const overlayById = new Map();

/***********************
 * Geofence model & store
 ************************/
/**
 * @typedef {{ id:string, name:string, type:'circle'|'polygon',
 *   center?:{lat:number,lon:number}|null, radius?:number,
 *   polygonPoints?:Array<{lat:number,lon:number}> }} Geofence
 */
let geofences = loadGeofences();
function loadGeofences(){
  try { return JSON.parse(localStorage.getItem('geofences')||'[]'); }
  catch { return []; }
}
function saveGeofences(){
  localStorage.setItem('geofences', JSON.stringify(geofences));
  renderGeofenceList();
  drawAllOverlays();
}

/***********************
 * Geometry helpers
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
 * UI wiring
 ************************/
serverBaseInput.value = localStorage.getItem('serverBase') || DEFAULT_SERVER;
serverBaseInput.addEventListener('change', ()=>{
  localStorage.setItem('serverBase', serverBaseInput.value.trim());
});
deviceIdInput.addEventListener('change', ()=>{
  localStorage.setItem('deviceId', deviceIdInput.value.trim());
});
deviceIdInput.value = localStorage.getItem('deviceId') || 'default';

btnCircle.onclick = ()=>{ activeMode='circle'; tempPoints=[]; setStatus('Tap map to set center'); };
btnPolygon.onclick = ()=>{ activeMode='polygon'; tempPoints=[]; setStatus('Tap map to add polygon vertices; Save when done'); };
btnClear.onclick = ()=>{ clearTempOverlays(); setStatus('Cleared'); };
btnSave.onclick = onSave;

testVibrateBtn.onclick = async ()=>{
  await sendVibrate();
  setStatus('Vibrate command sent (manual)');
};

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
  try {
    const obj = JSON.parse(text);
    if(Array.isArray(obj)) geofences = obj;
    else if(Array.isArray(obj.geofences)) geofences = obj.geofences;
    else throw new Error('Invalid file structure');
    saveGeofences();
    setStatus('Imported geofences');
  } catch(err){
    alert('Import failed: '+err.message);
  } finally {
    importFile.value = '';
  }
};

function setStatus(msg){ statusBadge.textContent = msg; }

/***********************
 * Map init & interactions
 ************************/
(async function initMap(){
  await customElements.whenDefined('gmp-map');
  map = mapEl.innerMap;                       // google.maps.Map
  gmDeviceMarker = deviceMarkerEl.innerMarker; // AdvancedMarkerElement

  // Draw any persisted geofences
  drawAllOverlays();
})();

// Click handler from the web component
mapEl.addEventListener('gmp-click', (e)=>{
  if(!activeMode || !map) return;
  const lat = e.detail.latLng.lat(), lon = e.detail.latLng.lng();
  if(activeMode==='circle'){
    clearTempOverlays();
    const r = Number(radiusInput.value)||150;
    tempCircle = new google.maps.Circle({
      map, center:{lat, lng:lon}, radius:r,
      strokeColor:'#2196F3', fillColor:'#2196F3', fillOpacity:0.2, strokeOpacity:0.9
    });
    tempPoints = [{lat,lon}];
  } else if(activeMode==='polygon'){
    tempPoints.push({lat,lon});
    if(tempPolygon) tempPolygon.setMap(null);
    tempPolygon = new google.maps.Polygon({
      map, paths: tempPoints.map(p=>({lat:p.lat,lng:p.lon})),
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
 * Rendering saved geofences
 ************************/
function drawAllOverlays(){
  // Clear existing
  for(const [,ov] of overlayById) destroyOverlay(ov);
  overlayById.clear();

  for(const g of geofences){
    if(g.type==='circle' && g.center){
      const circle = new google.maps.Circle({
        map, center:{lat:g.center.lat, lng:g.center.lon}, radius:g.radius||0,
        strokeColor:'#64b5f6', fillColor:'#64b5f6', fillOpacity:0.09, strokeOpacity:0.9
      });
      overlayById.set(g.id, { kind:'circle', circle });
    } else if(g.type==='polygon' && Array.isArray(g.polygonPoints) && g.polygonPoints.length>2){
      const polygon = new google.maps.Polygon({
        map, paths: g.polygonPoints.map(p=>({lat:p.lat,lng:p.lon})),
        strokeColor:'#ffcc80', fillColor:'#ffcc80', fillOpacity:0.08, strokeOpacity:0.9
      });
      overlayById.set(g.id, { kind:'polygon', polygon });
    }
  }
  renderGeofenceList();
}

function destroyOverlay(ov){
  if(!ov) return;
  if(ov.kind==='circle' && ov.circle) ov.circle.setMap(null);
  if(ov.kind==='polygon' && ov.polygon) ov.polygon.setMap(null);
}

function renderGeofenceList(){
  listEl.innerHTML='';
  for(const g of geofences){
    const li = document.createElement('li');
    const left = document.createElement('div');
    left.innerHTML = `<strong>${escapeHTML(g.name)}</strong> <span class="tag">${g.type}</span>`;
    const right = document.createElement('div');
    const flyBtn = btn('Fly');
    flyBtn.onclick = ()=> flyTo(g);
    const delBtn = btn('Delete');
    delBtn.onclick = ()=> deleteGeofence(g.id);
    right.appendChild(flyBtn);
    right.appendChild(delBtn);
    li.appendChild(left);
    li.appendChild(right);
    listEl.appendChild(li);
  }
}
function btn(label){ const b=document.createElement('button'); b.textContent=label; return b; }
function escapeHTML(s){ return s.replace(/[&<>'"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"\'":'&#39;','"':'&quot;' }[c])); }

function flyTo(g){
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
 * Device polling + inside/outside logic
 ************************/
async function fetchJSON(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
function serverBase(){ return (serverBaseInput.value||DEFAULT_SERVER).replace(/\/$/,''); }
async function pollOnce(){
  try{
    // Your existing endpoints – adapt if different
    const gps = await fetchJSON(serverBase()+"/api/download/gps");
    const batt = await fetchJSON(serverBase()+"/api/download/batt-percentage");

    const lat = Number(gps.latitude || gps.lat || gps[0] || 0);
    const lon = Number(gps.longitude || gps.lng || gps[1] || 0);
    const ts = gps.timestamp ? new Date(gps.timestamp) : new Date();

    // Update UI
    latEl.textContent = lat.toFixed(6);
    lonEl.textContent = lon.toFixed(6);
    updatedEl.textContent = ts.toLocaleString();
    batteryEl.textContent = (batt.percentage!=null ? batt.percentage+'%' : '–');

    // Move marker
    if(gmDeviceMarker) gmDeviceMarker.position = { lat, lng: lon };
    map?.setCenter({lat, lng: lon});

    // Inside/outside check
    const insideAny = geofences.some(g => isInside(g, lat, lon));
    insideFlag.textContent = insideAny ? 'Inside' : 'Outside';
    insideFlag.style.borderColor = insideAny ? '#2e7d32' : '#b71c1c';

    // Throttled server vibrate if OUTSIDE
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
  params.set('deviceId', deviceIdInput.value || 'default');
  params.set('command', 'vibrate');
  await fetch(serverBase()+"/api/upload/command", {
    method:'POST',
    headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
    body: params.toString()
  });
}

setInterval(pollOnce, GPS_POLL_MS);
pollOnce(); // initial

/***********************
 * Utilities
 ************************/
