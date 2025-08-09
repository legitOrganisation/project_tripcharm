const gpsUrl = "http://ma8w.ddns.net:3000/api/download/gps";
const battUrl = "http://ma8w.ddns.net:3000/api/download/batt-percentage";
const vibrateUrl = "http://ma8w.ddns.net:3000/api/upload/command";

function parseGpsString(gpsStr) {
  const parts = gpsStr.trim().split(",");
  if (parts.length < 4) return null;
  let lat = parseFloat(parts[0]);
  let lon = parseFloat(parts[2]);
  if (parts[1] === "S") lat *= -1;
  if (parts[3] === "W") lon *= -1;
  return { lat, lon };
}

async function updateData() {
  try {
    // --- GPS ---
    const gpsRes = await fetch(gpsUrl);
    const gpsArray = await gpsRes.json();
    if (Array.isArray(gpsArray) && gpsArray.length > 0) {
      const latestGPS = gpsArray[gpsArray.length - 1];
      const gpsText = typeof latestGPS.gps === "string"
        ? latestGPS.gps
        : `${latestGPS.gps.lat},N,${latestGPS.gps.lon},E`; // handle object format
      document.getElementById('gps').textContent = gpsText;
      document.getElementById('info-gps').textContent = gpsText;
      document.getElementById('info-last-update').textContent =
        new Date(latestGPS.timestamp).toLocaleTimeString();
      const coords = parseGpsString(gpsText);
      if (coords) {
        document.getElementById('map').setAttribute('center', `${coords.lat},${coords.lon}`);
        document.getElementById('device-marker').setAttribute('position', `${coords.lat},${coords.lon}`);
      }
    }

    // --- Battery ---
    const battRes = await fetch(battUrl);
    const battArray = await battRes.json();
    if (Array.isArray(battArray) && battArray.length > 0) {
      const latestBatt = battArray[battArray.length - 1];
      document.getElementById('battery').textContent = latestBatt.percentage;
      document.getElementById('info-battery').textContent = latestBatt.percentage;
    }

  } catch (err) {
    console.error("Error updating data:", err);
  }
}

async function sendVibrateCommand() {
  try {
    const res = await fetch(vibrateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "vibrate" })
    });
    const text = await res.text();
    alert(`Vibrate command sent: ${text}`);
  } catch (err) {
    console.error("Error sending vibrate command:", err);
    alert("Failed to send vibrate command.");
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Start updating GPS and battery
  updateData();
  setInterval(updateData, 5000);

  // Vibrate button listener
  document.getElementById('vibrate').addEventListener('click', sendVibrateCommand);
});
