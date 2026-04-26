require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const http       = require('http');
const { Server } = require('socket.io');
const { MongoClient, ObjectId } = require('mongodb');
const { io: ioClient }          = require('socket.io-client');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

const PI_URL = process.env.PI_URL || 'http://localhost:5000';
const piUrlParsed = new URL(PI_URL);

// ── MongoDB ────────────────────────────────────────────────────
const client = new MongoClient(process.env.MONGO_URI);
let db, classifications, devices;

async function connectDB() {
  await client.connect();
  db              = client.db(process.env.MONGO_DB);
  classifications = db.collection('classifications');
  devices         = db.collection('devices');
  console.log('[DB] Connected to MongoDB');
}
connectDB().catch(err => console.error('[DB] Connection failed:', err.message));

// ── MJPEG stream — manual pipe (no proxy middleware) ──────────
app.get('/pi-stream', (req, res) => {
  const options = {
    hostname: piUrlParsed.hostname,
    port:     parseInt(piUrlParsed.port) || 5000,
    path:     '/stream',
    method:   'GET',
    headers: {
      'Accept':     'multipart/x-mixed-replace',
      'Connection': 'keep-alive',
    }
  };

  res.setHeader('Content-Type',     'multipart/x-mixed-replace; boundary=frame');
  res.setHeader('Cache-Control',    'no-cache, no-store, must-revalidate');
  res.setHeader('X-Accel-Buffering','no');
  res.setHeader('Pragma',           'no-cache');

  const piReq = http.request(options, (piRes) => {
    piRes.pipe(res);
    req.on('close', () => piReq.destroy());
  });

  piReq.on('error', (err) => {
    console.warn('[STREAM] Pi pipe error:', err.message);
    if (!res.headersSent) res.status(503).end();
  });

  piReq.end();
});

// ── Pi direct info (lets browser connect to stream directly) ───
app.get('/api/pi-info', (req, res) => {
  res.json({
    piUrl:      PI_URL,
    streamUrl:  `${PI_URL}/stream`,
    connected:  !!(piSocket && piSocket.connected)
  });
});

// ── Static files ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── REST API ───────────────────────────────────────────────────
app.get('/api/devices', async (req, res) => {
  try {
    const devs = await devices.find({}).toArray();
    devs.forEach(d => d._id = d._id.toString());
    res.json(devs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/classifications', async (req, res) => {
  try {
    const limit    = parseInt(req.query.limit) || 50;
    const deviceId = req.query.device_id;
    const filter   = deviceId ? { device_id: deviceId } : {};
    const docs     = await classifications
      .find(filter, { projection: { image: 0 } })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    docs.forEach(d => {
      d._id       = d._id.toString();
      d.timestamp = d.timestamp.toISOString();
    });
    res.json(docs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/classification/:id/image', async (req, res) => {
  try {
    const doc = await classifications.findOne(
      { _id: new ObjectId(req.params.id) },
      { projection: { image: 1 } }
    );
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ image: doc.image });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stats', async (req, res) => {
  try {
    const deviceId   = req.query.device_id;
    const matchStage = deviceId ? { $match: { device_id: deviceId } } : { $match: {} };
    const pipeline   = [
      matchStage,
      { $group: {
          _id:            { device: '$device_id', label: '$label' },
          total:          { $sum: 1 },
          confirmed:      { $sum: { $cond: ['$confirmed', 1, 0] } },
          avg_confidence: { $avg: '$confidence' }
      }},
      { $sort: { '_id.label': 1 } }
    ];
    res.json(await classifications.aggregate(pipeline).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/timeline', async (req, res) => {
  try {
    const deviceId = req.query.device_id;
    const hours    = parseInt(req.query.hours) || 24;
    const since    = new Date(Date.now() - hours * 3600 * 1000);
    const match    = { timestamp: { $gte: since } };
    if (deviceId) match.device_id = deviceId;
    const pipeline = [
      { $match: match },
      { $group: {
          _id:   { hour: { $hour: '$timestamp' }, label: '$label' },
          count: { $sum: 1 }
      }},
      { $sort: { '_id.hour': 1 } }
    ];
    res.json(await classifications.aggregate(pipeline).toArray());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/confirm', async (req, res) => {
  try {
    const { classification_id, confirmed, correct_label } = req.body;
    const update = { confirmed };
    if (correct_label) update.user_label = correct_label;
    await classifications.updateOne(
      { _id: new ObjectId(classification_id) },
      { $set: update }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Pi WebSocket bridge ────────────────────────────────────────
let piSocket = null;

function connectToPi() {
  if (PI_URL.includes('<YOUR_PI_IP>')) {
    console.log('[PI-BRIDGE] PI_URL not configured — skipping');
    return;
  }

  piSocket = ioClient(PI_URL, {
    reconnection:      true,
    reconnectionDelay: 3000,
    timeout:           5000
  });

  piSocket.on('connect', () => {
    console.log('[PI-BRIDGE] Connected to Pi');
    io.emit('pi_status', { connected: true });
  });

  piSocket.on('disconnect', () => {
    console.log('[PI-BRIDGE] Disconnected from Pi');
    io.emit('pi_status', { connected: false });
  });

  piSocket.on('connect_error', (err) => {
    console.warn('[PI-BRIDGE] Connect error:', err.message);
    io.emit('pi_status', { connected: false });
  });

  piSocket.on('classification', data => io.emit('classification', data));
  piSocket.on('status',         data => io.emit('pi_machine_status', data));
}

connectToPi();

// HTTP fallback poll — detects Pi online even if WebSocket bridge fails
function pollPiStatus() {
  setInterval(() => {
    if (piSocket && piSocket.connected) return;
    const req = http.get({
      hostname: piUrlParsed.hostname,
      port:     parseInt(piUrlParsed.port) || 5000,
      path:     '/status',
      timeout:  3000,
    }, (res) => {
      if (res.statusCode === 200) io.emit('pi_status', { connected: true });
      res.resume();
    });
    req.on('error', () => io.emit('pi_status', { connected: false }));
    req.on('timeout', () => { req.destroy(); });
  }, 10000);
}

pollPiStatus();

io.on('connection', socket => {
  console.log('[DASHBOARD] Client connected:', socket.id);
  socket.emit('pi_status', { connected: !!(piSocket && piSocket.connected) });
  socket.on('disconnect', () => {
    console.log('[DASHBOARD] Client disconnected:', socket.id);
  });
});

// ── Start ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[DASHBOARD] http://localhost:${PORT}`);
  console.log(`[DASHBOARD] Pi URL: ${PI_URL}`);
});