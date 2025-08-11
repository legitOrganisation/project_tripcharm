// ======== CONFIG ========
function serverBase() {
  return "http://ma8w.ddns.net:3000";
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ======== NAVIGATION ========
document.querySelectorAll(".nav-button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-page").forEach(p => p.classList.add("hidden"));
    document.querySelector(`#${btn.dataset.target}`).classList.remove("hidden");
    document.querySelectorAll(".nav-button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// ======== DASHBOARD ========
let map;

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 15,
    center: { lat: 1.3521, lng: 103.8198 }
  });
}

function updateMapMarker(lat, lon) {
  if (!window.deviceMarker) {
    window.deviceMarker = new google.maps.Marker({
      position: { lat, lng: lon },
      map: map,
      title: "Device Location"
    });
    map.setCenter({ lat, lng: lon });
  } else {
    window.deviceMarker.setPosition({ lat, lng: lon });
    map.setCenter({ lat, lng: lon });
  }
}

async function pollOnce() {
  try {
    // GPS
    const gpsData = await fetchJSON(serverBase() + "/api/download/gps");
    let lat = null, lon = null;
    if (Array.isArray(gpsData) && gpsData.length > 0) {
      const latest = gpsData[gpsData.length - 1];
      if (latest.gps) {
        const parts = latest.gps.split(",");
        if (parts.length >= 4) {
          lat = parseFloat(parts[0]);
          lon = parseFloat(parts[2]);
          document.getElementById("gps-value").textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        }
      }
    }
    if (lat !== null && lon !== null) updateMapMarker(lat, lon);

    // Battery
    const battData = await fetchJSON(serverBase() + "/api/download/batt-percentage");
    if (Array.isArray(battData) && battData.length > 0) {
      const latest = battData[battData.length - 1];
      if (latest.percentage !== undefined) {
        document.getElementById("battery-value").textContent = latest.percentage + "%";
      }
    }
  } catch (err) {
    console.error("Polling error:", err);
  }
}

document.getElementById("btn-vibrate").addEventListener("click", async () => {
  try {
    const res = await fetch(serverBase() + "/api/set-command", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "command=vibrate"
    });
    if (res.ok) alert("Vibrate command sent!");
    else alert("Failed to send vibrate");
  } catch (err) {
    console.error(err);
  }
});

// Start polling every 5s
setInterval(pollOnce, 5000);
pollOnce();

// ======== GEOFENCING ========
// This is just a placeholder — you can load your geofencing HTML/UI here
document.getElementById("btn-open-geofencing").addEventListener("click", () => {
  window.location.href = "geofencing.html"; // or another tab if SPA
});
