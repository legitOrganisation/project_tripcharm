
// index.js - Integrated Dashboard + Geofencing with server parsing

let map, deviceMarker, deviceCircle;
let batteryEl, gpsEl;
let geofences = [];
let activeTab = "dashboard";
let lastVibrationSent = 0; // ms timestamp

// API helper
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

function serverBase() {
  return location.origin; // same server
}

function init() {
  // Tab switching
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab-content").forEach(c => c.style.display = "none");
      document.getElementById(activeTab).style.display = "block";
    });
  });

  // Init map
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 1.3521, lng: 103.8198 },
    zoom: 14,
  });

  batteryEl = document.getElementById("battery");
  gpsEl = document.getElementById("gps");

  loadGeofences();
  setInterval(pollOnce, 5000);
  pollOnce();
}

async function pollOnce() {
  try {
    // GPS
    const gpsArray = await fetchJSON(serverBase() + "/api/download/gps");
    if (Array.isArray(gpsArray) && gpsArray.length > 0) {
      const latest = gpsArray[gpsArray.length - 1];
      const [latStr, latDir, lonStr, lonDir] = latest.gps.split(",");
      let lat = parseFloat(latStr);
      let lon = parseFloat(lonStr);
      if (latDir === "S") lat = -lat;
      if (lonDir === "W") lon = -lon;
      gpsEl.textContent = lat.toFixed(5) + ", " + lon.toFixed(5);
      updateDeviceMarker(lat, lon);
      checkGeofences(lat, lon);
    }

    // Battery
    const battArray = await fetchJSON(serverBase() + "/api/download/batt-percentage");
    if (Array.isArray(battArray) && battArray.length > 0) {
      const latest = battArray[battArray.length - 1];
      batteryEl.textContent = latest.percentage + "%";
    }
  } catch (err) {
    console.error("Poll error", err);
  }
}

function updateDeviceMarker(lat, lon) {
  if (!deviceMarker) {
    deviceMarker = new google.maps.Marker({
      position: { lat, lng: lon },
      map,
      title: "Device",
    });
    deviceCircle = new google.maps.Circle({
      map,
      radius: 10,
      fillColor: "#00F",
      strokeColor: "#00F",
    });
    deviceCircle.bindTo("center", deviceMarker, "position");
  } else {
    deviceMarker.setPosition({ lat, lng: lon });
  }
  map.setCenter({ lat, lng: lon });
}

// === Geofencing ===

function loadGeofences() {
  const saved = localStorage.getItem("geofences");
  if (saved) geofences = JSON.parse(saved);
}

function saveGeofences() {
  localStorage.setItem("geofences", JSON.stringify(geofences));
}

function checkGeofences(lat, lon) {
  const now = Date.now();
  geofences.forEach(fence => {
    let inside = false;
    if (fence.type === "circle") {
      const d = haversine(lat, lon, fence.center.lat, fence.center.lng);
      inside = d <= fence.radius;
    } else if (fence.type === "polygon") {
      inside = pointInPolygon({lat, lng: lon}, fence.points);
    }
    if (!inside && now - lastVibrationSent > 60000) {
      sendVibrate();
      lastVibrationSent = now;
    }
  });
}

function sendVibrate() {
  fetch(serverBase() + "/api/set-command", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "command=vibrate"
  }).then(r => console.log("Vibrate sent", r.status));
}

// Haversine formula in meters
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function pointInPolygon(point, vs) {
  let x = point.lat, y = point.lng;
  let inside = false;
  for (let i=0,j=vs.length-1; i<vs.length; j=i++) {
    let xi=vs[i].lat, yi=vs[i].lng;
    let xj=vs[j].lat, yj=vs[j].lng;
    let intersect = ((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi);
    if (intersect) inside=!inside;
  }
  return inside;
}

window.init = init;
