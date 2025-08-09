const gpsUrl = "http://ma8w.ddns.net:3000/api/download/gps";

function parseGpsString(gpsStr) {
  const parts = gpsStr.trim().split(",");
  if (parts.length < 4) return null;

  let lat = parseFloat(parts[0]);
  let lon = parseFloat(parts[2]);
  if (parts[1] === "S") lat *= -1;
  if (parts[3] === "W") lon *= -1;

  return { lat, lon };
}

async function updateGps() {
  try {
    const res = await fetch(gpsUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const gpsArray = await res.json();
    console.log("API GPS array:", gpsArray); // Debug

    if (!Array.isArray(gpsArray) || gpsArray.length === 0) {
      document.getElementById('gps').textContent = "No data";
      return;
    }

    const latest = gpsArray[gpsArray.length - 1];
    const gpsText = latest.gps || "No GPS field";
    console.log("Latest GPS text:", gpsText); // Debug

    // ✅ This should now replace Loading...
    document.getElementById('gps').textContent = gpsText;
    document.getElementById('info-gps').textContent = gpsText;
    document.getElementById('info-last-update').textContent =
      latest.timestamp ? new Date(latest.timestamp).toLocaleTimeString() : "-";

    const coords = parseGpsString(gpsText);
    if (coords) {
      document.getElementById('map').setAttribute('center', `${coords.lat},${coords.lon}`);
      document.getElementById('device-marker').setAttribute('position', `${coords.lat},${coords.lon}`);
    }
  } catch (err) {
    console.error("Error fetching GPS:", err);
    document.getElementById('gps').textContent = "Error";
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateGps();
  setInterval(updateGps, 5000);
});
