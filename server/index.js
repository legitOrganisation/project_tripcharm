const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = 3000;

// --- Config ---
const COMMAND_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_QUEUE_LEN = 5;              // keep latest 5 for gps/batt/geofence

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
  events: []
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

// --- Helpers ---
function pruneOldCommands() {
  const cutoff = Date.now() - COMMAND_TTL_MS;
  const before = queues.commands.length;
  queues.commands = queues.commands.filter(c => {
    const t = new Date(c.timestamp).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  });
  if (queues.commands.length !== before) {
    logWithTime(`Pruned ${before - queues.commands.length} old command(s)`);
    saveQueues();
  }
}

function keepLastN(arr, n) {
  if (arr.length > n) arr.splice(0, arr.length - n);
}

function pruneSizedQueues() {
  const before = {
    gps: queues.gps.length,
    batt: queues.battPercentage.length,
    geo: queues.geofencingData.length
  };
  keepLastN(queues.gps, MAX_QUEUE_LEN);
  keepLastN(queues.battPercentage, MAX_QUEUE_LEN);
  keepLastN(queues.geofencingData, MAX_QUEUE_LEN);
  const after = {
    gps: queues.gps.length,
    batt: queues.battPercentage.length,
    geo: queues.geofencingData.length
  };
  const trimmed =
    (before.gps - after.gps) +
    (before.batt - after.batt) +
    (before.geo - after.geo);
  if (trimmed > 0) {
    logWithTime(`Pruned ${trimmed} item(s) from gps/battery/geofencing to keep last ${MAX_QUEUE_LEN}`);
    saveQueues();
  }
}

// Prune once on startup
pruneOldCommands();
pruneSizedQueues();

// ---------- UPLOAD ROUTES ----------

// GPS upload (keep last 5)
app.post('/api/upload/gps', (req, res) => {
  const gps = req.body.gps;
  if (gps) {
    queues.gps.push({ gps, timestamp: new Date().toISOString() });
    keepLastN(queues.gps, MAX_QUEUE_LEN);
    saveQueues();
    logWithTime("GPS uploaded:", gps);
    res.send("GPS data uploaded");
  } else {
    res.status(400).send("No GPS data provided");
  }
});

// Command upload (supports 'clear')
app.post('/api/upload/command', (req, res) => {
  const command = req.body.command;
  if (!command) return res.status(400).send("No command provided");

  if (String(command).toLowerCase() === 'clear') {
    const count = queues.commands.length;
    queues.commands = [];
    saveQueues();
    logWithTime(`Commands cleared (removed ${count})`);
    return res.send(`All commands cleared (${count} removed)`);
  }

  pruneOldCommands();
  queues.commands.push({ command, timestamp: new Date().toISOString() });
  saveQueues();
  logWithTime("Command uploaded:", command);
  res.send("Command uploaded");
});

// Battery percentage upload (keep last 5)
app.post('/api/upload/batt-percentage', (req, res) => {
  const percentage = req.body.percentage;
  if (percentage !== undefined) {
    queues.battPercentage.push({ percentage, timestamp: new Date().toISOString() });
    keepLastN(queues.battPercentage, MAX_QUEUE_LEN);
    saveQueues();
    logWithTime("Battery percentage uploaded:", percentage);
    res.send("Battery percentage uploaded");
  } else {
    res.status(400).send("No battery percentage provided");
  }
});

// Geofencing data upload (keep last 5)
app.post('/api/upload/geofencing-data', (req, res) => {
  const data = req.body.data;
  if (data) {
    queues.geofencingData.push({ data, timestamp: new Date().toISOString() });
    keepLastN(queues.geofencingData, MAX_QUEUE_LEN);
    saveQueues();
    logWithTime("Geofencing data uploaded:", JSON.stringify(data));
    res.send("Geofencing data uploaded");
  } else {
    res.status(400).send("No geofencing data provided");
  }
});

// Event upload (unchanged behavior)
app.post('/api/upload/event', (req, res) => {
  const { type, gps } = req.body;
  if (!type) return res.status(400).send("No event type provided");
  const event = { type, gps: gps || null, timestamp: new Date().toISOString() };
  queues.events.push(event);
  saveQueues();
  logWithTime("Event uploaded:", JSON.stringify(event));
  res.send("Event uploaded");
});

// ---------- DOWNLOAD ROUTES ----------

// GPS download (ensure only last 5)
app.get('/api/download/gps', (req, res) => {
  keepLastN(queues.gps, MAX_QUEUE_LEN);
  saveQueues();
  logWithTime("GPS data downloaded");
  res.json(queues.gps);
});

// Commands download (auto-prunes by time)
app.get('/api/download/command', (req, res) => {
  pruneOldCommands();
  logWithTime("Command data downloaded");
  res.json(queues.commands);
});

// Battery percentage download (ensure only last 5)
app.get('/api/download/batt-percentage', (req, res) => {
  keepLastN(queues.battPercentage, MAX_QUEUE_LEN);
  saveQueues();
  logWithTime("Battery percentage data downloaded");
  res.json(queues.battPercentage);
});

// Geofencing data download (ensure only last 5)
app.get('/api/download/geofencing-data', (req, res) => {
  keepLastN(queues.geofencingData, MAX_QUEUE_LEN);
  saveQueues();
  logWithTime("Geofencing data downloaded");
  res.json(queues.geofencingData);
});

// Events download (unchanged)
app.get('/api/download/events', (req, res) => {
  logWithTime("Events downloaded");
  res.json(queues.events);
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  logWithTime(`API server running at http://localhost:${PORT}`);
});
