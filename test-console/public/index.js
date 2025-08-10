const baseURL = "http://ma8w.ddns.net:3000/api";

function logMessage(msg) {
  const logDiv = document.getElementById("log");
  const p = document.createElement("p");
  p.textContent = msg;
  logDiv.appendChild(p);
}

// Generic POST helper
async function postData(url, data) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const text = await res.text();
    logMessage(`${url} → ${text}`);
  } catch (err) {
    logMessage(`Error: ${err}`);
  }
}

// GPS
document.getElementById("send-gps").addEventListener("click", () => {
  const lat = parseFloat(document.getElementById("gps-lat").value);
  const lon = parseFloat(document.getElementById("gps-lon").value);
  if (!isNaN(lat) && !isNaN(lon)) {
    postData(`${baseURL}/upload/gps`, { gps: { lat, lon } });
  } else {
    logMessage("Invalid GPS values.");
  }
});

// Battery
document.getElementById("send-batt").addEventListener("click", () => {
  const percentage = parseInt(document.getElementById("batt").value, 10);
  if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
    postData(`${baseURL}/upload/batt-percentage`, { percentage });
  } else {
    logMessage("Invalid battery percentage.");
  }
});

// Command
document.getElementById("send-cmd").addEventListener("click", () => {
  const command = document.getElementById("cmd").value.trim();
  if (command) {
    postData(`${baseURL}/upload/command`, { command });
  } else {
    logMessage("Command cannot be empty.");
  }
});

// Event
document.getElementById("send-event").addEventListener("click", () => {
  const type = document.getElementById("event-type").value.trim();
  const gps = document.getElementById("event-gps").value.trim();
  if (type) {
    postData(`${baseURL}/upload/event`, { type, gps });
  } else {
    logMessage("Event type cannot be empty.");
  }
});

// Geofence
document.getElementById("send-geo").addEventListener("click", () => {
  const radius = parseInt(document.getElementById("geo-radius").value, 10);
  const lat = parseFloat(document.getElementById("geo-lat").value);
  const lon = parseFloat(document.getElementById("geo-lon").value);
  if (!isNaN(radius) && !isNaN(lat) && !isNaN(lon)) {
    postData(`${baseURL}/upload/geofencing-data`, { data: { radius, center: { lat, lon } } });
  } else {
    logMessage("Invalid geofence values.");
  }
});
