const gpsUrl = "http://ma8w.ddns.net:3000/api/download/gps";
const battUrl = "http://ma8w.ddns.net:3000/api/download/batt-percentage";

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
    if (!gpsRes.ok) throw new Error(`GPS HTTP ${gpsRes.status}`);
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
    if (!battRes.ok) throw new Error(`Batt HTTP ${battRes.status}`);
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

document.addEventListener('DOMContentLoaded', () => {
  updateData();
  setInterval(updateData, 5000);
});
