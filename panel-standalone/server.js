'use strict';
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { getSettings, updateSettings } = require('./lib/db');
const wa = require('./lib/whatsapp');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Health ────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

// ── Status ────────────────────────────────────────────────────
app.get('/api/bot/status', (_req, res) => {
  const s = wa.getStatus();
  res.json({
    connected:       s.connected,
    connection:      s.connection,
    phone:           s.phone || null,
    mode:            s.mode,
    pairingCode:     s.pairingCode,
    pairingExpiry:   s.pairingExpiry,
    hasQR:           s.hasQR,
    retries:         s.retries,
    uptime:          Math.floor(process.uptime()),
    version:         '2.1.0',
    platform:        'Juice v12 Panel',
  });
});

// ── Settings ──────────────────────────────────────────────────
app.get('/api/bot/settings', (_req, res) => {
  try { res.json(getSettings()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/bot/settings', (req, res) => {
  try { res.json(updateSettings(req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── QR Login ──────────────────────────────────────────────────
app.post('/api/bot/qr', async (_req, res) => {
  try {
    const img = await wa.startQRLogin();
    if (img === 'already-linked') return res.json({ alreadyLinked: true });
    res.json({ qrImage: img });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Poll for refreshed QR (WhatsApp refreshes QR every ~20s)
app.get('/api/bot/qr-image', (_req, res) => {
  const img = wa.getQR();
  img ? res.json({ qrImage: img }) : res.status(204).end();
});

// ── Pairing Code ──────────────────────────────────────────────
app.post('/api/bot/pair', async (req, res) => {
  const raw   = req.body.phone || process.env.OWNER_NUMBER || '254753204154';
  const phone = raw.replace(/[^0-9]/g, '');
  if (!phone || phone.length < 7) {
    return res.status(400).json({ error: 'Invalid phone number — digits only with country code e.g. 254753204154' });
  }
  try {
    const code = await wa.startPairLogin(phone);
    if (code === 'already-linked') return res.json({ alreadyLinked: true });
    res.json({ code, phone, expiresIn: 180 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Disconnect ────────────────────────────────────────────────
app.post('/api/bot/disconnect', async (_req, res) => {
  try { await wa.disconnectBot(); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Stats ─────────────────────────────────────────────────────
app.get('/api/stats', (_req, res) => {
  res.json({ uptime: Math.floor(process.uptime()), commands: 700, ai: 37 });
});

// ── SPA fallback ──────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  🧃 Juice v12 Panel');
  console.log(`  ➜  http://localhost:${PORT}`);
  console.log('');
});
