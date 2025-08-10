const gpsUrl = "http://ma8w.ddns.net:3000/api/download/gps";
const battUrl = "http://ma8w.ddns.net:3000/api/download/batt-percentage";
const commandUrl = "http://ma8w.ddns.net:3000/api/upload/command";
const eventsUrl = "http://ma8w.ddns.net:3000/api/download/events";

function parseGpsString(gpsStr) {
  const parts = gpsStr.trim().split(",");
  if (parts.length < 4) return null;
  let lat = parseFloat(parts[0]);
  let lon = parseFloat(parts[2]);
  if (parts[1] === "S") lat *= -1;
  if (parts[3] === "W") lon *= -1;
  return { lat, lon };
}

async function updateEvents() {
  try {
    const res = await fetch(eventsUrl);
    if (!res.ok) throw new Error(`Events HTTP ${res.status}`);
    const eventsArray = await res.json();
    const eventList = document.getElementById('event-list');
    eventList.innerHTML = "";
    if (Array.isArray(eventsArray) && eventsArray.length > 0) {
      eventsArray.slice().reverse().forEach(ev => {
        const li = document.createElement('li');
        li.textContent = `[${new Date(ev.timestamp).toLocaleTimeString()}] ${ev.type.toUpperCase()} ${ev.gps ? `@ ${ev.gps}` : ""}`;
        eventList.appendChild(li);
      });
    } else {
      eventList.innerHTML = "<li>No events recorded</li>";
    }
  } catch (err) {
    console.error("Error fetching events:", err);
  }
}

async function updateData() {
  try {
    // GPS
    const gpsRes = await fetch(gpsUrl);
    const gpsArray = await gpsRes.json();
    if (Array.isArray(gpsArray) && gpsArray.length > 0) {
      const latestGPS = gpsArray[gpsArray.length - 1];
      const gpsText = typeof latestGPS.gps === "string"
        ? latestGPS.gps
        : `${latestGPS.gps.lat},N,${latestGPS.gps.lon},E`;
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

    // Battery
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

async function sendCommand(cmd) {
  try {
    const res = await fetch(commandUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: cmd })
    });
    const text = await res.text();
    console.log(`Command sent: ${cmd} → ${text}`);
  } catch (err) {
    console.error("Error sending command:", err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateData();
  setInterval(updateData, 5000);

  updateEvents();
  setInterval(updateEvents, 5000);

  document.getElementById('vibrate').addEventListener('click', () => {
    sendCommand("vibrate");
    alert("Vibrate command sent.");
  });

  document.getElementById('set-fall').addEventListener('click', () => {
    const fallValue = document.getElementById('fall').value;
    if (fallValue >= 1 && fallValue <= 100) {
      sendCommand(`set-fall:${fallValue}`);
      alert(`Fall detection strength set to ${fallValue}`);
    } else {
      alert("Please enter a value between 1 and 100.");
    }
  });
});
