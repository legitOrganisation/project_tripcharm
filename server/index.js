const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = 3000;

// --- Enable CORS for all origins ---
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// --- Middleware ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- Logging helper ---
function logWithTime(...args) {
  const timestamp = new Date().toISOString();
  const log = `[${timestamp}] ${args.join(" ")}`;
  console.log(log);
  fs.appendFileSync('events.log', log + '\n');
}

// --- Persistent storage ---
let queues = {
  gps: [],
  commands: [],
  battPercentage: [],
  geofencingData: [],
  events: [] // New: store device events like falls
};

try {
  if (fs.existsSync('queues.json')) {
    queues = JSON.parse(fs.readFileSync('queues.json'));
  }
} catch (e) {
  console.error("Error loading persistent data:", e);
}

function saveQueues() {
  fs.writeFileSync('queues.json', JSON.stringify(queues, null, 2));
}

// ---------- UPLOAD ROUTES ----------

// GPS upload
app.post('/api/upload/gps', (req, res) => {
  const gps = req.body.gps;
  if (gps) {
    queues.gps.push({ gps, timestamp: new Date().toISOString() });
    saveQueues();
    logWithTime("GPS uploaded:", gps);
    res.send("GPS data uploaded");
  } else {
    res.status(400).send("No GPS data provided");
  }
});

// Command upload
app.post('/api/upload/command', (req, res) => {
  const command = req.body.command;
  if (command) {
    queues.commands.push({ command, timestamp: new Date().toISOString() });
    saveQueues();
    logWithTime("Command uploaded:", command);
    res.send("Command uploaded");
  } else {
    res.status(400).send("No command provided");
  }
});

// Battery percentage upload
app.post('/api/upload/batt-percentage', (req, res) => {
  const percentage = req.body.percentage;
  if (percentage !== undefined) {
    queues.battPercentage.push({ percentage, timestamp: new Date().toISOString() });
    saveQueues();
    logWithTime("Battery percentage uploaded:", percentage);
    res.send("Battery percentage uploaded");
  } else {
    res.status(400).send("No battery percentage provided");
  }
});

// Geofencing data upload
app.post('/api/upload/geofencing-data', (req, res) => {
  const data = req.body.data;
  if (data) {
    queues.geofencingData.push({ data, timestamp: new Date().toISOString() });
    saveQueues();
    logWithTime("Geofencing data uploaded:", JSON.stringify(data));
    res.send("Geofencing data uploaded");
  } else {
    res.status(400).send("No geofencing data provided");
  }
});

// Event upload (e.g., falls)
app.post('/api/upload/event', (req, res) => {
  const { type, gps } = req.body;
  if (!type) {
    return res.status(400).send("No event type provided");
  }
  const event = {
    type,
    gps: gps || null,
    timestamp: new Date().toISOString()
  };
  queues.events.push(event);
  saveQueues();
  logWithTime("Event uploaded:", JSON.stringify(event));
  res.send("Event uploaded");
});

// ---------- DOWNLOAD ROUTES ----------

// GPS download
app.get('/api/download/gps', (req, res) => {
  logWithTime("GPS data downloaded");
  res.json(queues.gps);
});

// Commands download
app.get('/api/download/command', (req, res) => {
  logWithTime("Command data downloaded");
  res.json(queues.commands);
});

// Battery percentage download
app.get('/api/download/batt-percentage', (req, res) => {
  logWithTime("Battery percentage data downloaded");
  res.json(queues.battPercentage);
});

// Geofencing data download
app.get('/api/download/geofencing-data', (req, res) => {
  logWithTime("Geofencing data downloaded");
  res.json(queues.geofencingData);
});

// Events download
app.get('/api/download/events', (req, res) => {
  logWithTime("Events downloaded");
  res.json(queues.events);
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  logWithTime(`API server running at http://localhost:${PORT}`);
});
