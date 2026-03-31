require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getSettings, updateSettings } = require('./lib/db');
const wa = require('./lib/whatsapp');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Bot Status ──────────────────────────────────────────────
app.get('/api/bot/status', (req, res) => {
  const s = wa.getStatus();
  res.json({
    connected: s.connected,
    connection: s.connection,
    phone: s.phone || 'Not connected',
    mode: s.mode,
    pairingCode: s.pairingCode,
    pairingCodeExpiry: s.pairingCodeExpiry,
    hasQR: s.hasQR,
    uptime: Math.floor(process.uptime()),
    version: '2.1.0',
    platform: 'Juice v12 Panel',
  });
});

// ── Settings ─────────────────────────────────────────────────
app.get('/api/bot/settings', (req, res) => {
  res.json(getSettings());
});

app.put('/api/bot/settings', (req, res) => {
  try {
    const updated = updateSettings(req.body);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── QR Login ─────────────────────────────────────────────────
app.post('/api/bot/qr', async (req, res) => {
  try {
    const qrImage = await wa.startQRLogin();
    if (qrImage === 'already-linked') return res.json({ alreadyLinked: true });
    res.json({ qrImage });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/bot/qr-image', (req, res) => {
  const img = wa.getQRImage();
  img ? res.json({ qrImage: img }) : res.status(204).end();
});

// ── Pairing Code ─────────────────────────────────────────────
app.post('/api/bot/pair', async (req, res) => {
  try {
    const phone = (req.body.phone || process.env.OWNER_NUMBER || '254753204154').replace(/[^0-9]/g, '');
    if (!phone) return res.status(400).json({ error: 'Phone number required' });
    const code = await wa.startPairLogin(phone);
    res.json({ code, phone });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Disconnect ────────────────────────────────────────────────
app.post('/api/bot/disconnect', async (req, res) => {
  await wa.disconnect();
  res.json({ success: true });
});

// ── Stats ─────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  res.json({ commandsUsed: 0, messagesHandled: 0, uptime: Math.floor(process.uptime()) });
});

// ── Health ────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── Serve frontend for all other routes ──────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🟢 Juice v12 Panel running on port ${PORT}`);
  console.log(`   Open: http://localhost:${PORT}\n`);
});
