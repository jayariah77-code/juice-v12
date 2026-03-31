const makeWASocket = require('gifted-baileys').default;
const {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
} = require('gifted-baileys');
const { Boom } = require('@hapi/boom');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const SESSION_DIR = path.join(__dirname, '..', 'data', '.wa-session');
const MAX_RECONNECT = 10;

let sock = null;
let connState = { connection: 'close' };
let linkedPhone = null;
let currentQRImage = null;
let pairingCode = null;
let pairingCodeExpiry = null;
let mode = 'idle';
let reconnectAttempts = 0;
let reconnectTimer = null;
let targetPhone = null;

function getStatus() {
  return {
    connected: connState.connection === 'open',
    connection: connState.connection || 'close',
    phone: linkedPhone,
    mode,
    pairingCode: pairingCodeExpiry && Date.now() < pairingCodeExpiry ? pairingCode : null,
    pairingCodeExpiry,
    hasQR: !!currentQRImage,
    reconnectAttempts,
  };
}

function getQRImage() { return currentQRImage; }

function wipeSession() {
  try {
    if (fs.existsSync(SESSION_DIR)) fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  } catch {}
}

function endSocket() {
  if (sock) {
    try { sock.end(new Error('closed')); } catch {}
    try { if (sock.ws) sock.ws.close(); } catch {}
    sock = null;
  }
}

function clearTimer() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
}

function reset() {
  clearTimer();
  endSocket();
  wipeSession();
  connState = { connection: 'close' };
  currentQRImage = null;
  pairingCode = null;
  pairingCodeExpiry = null;
  mode = 'idle';
  reconnectAttempts = 0;
  targetPhone = null;
}

async function createSocket() {
  if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  let version;
  try { version = (await fetchLatestBaileysVersion()).version; }
  catch { version = [2, 3000, 1023247704]; }

  const s = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, console),
    },
    printQRInTerminal: false,
    browser: Browsers.macOS('Desktop'),
    keepAliveIntervalMs: 30000,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: false,
  });

  s.ev.on('creds.update', saveCreds);

  s.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    connState = { ...connState, ...update };

    if (qr && mode === 'qr') {
      try {
        currentQRImage = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
        console.log('[WA] QR code generated ✓');
      } catch (e) { console.error('[WA] QR error:', e.message); }
    }

    if (connection === 'open') {
      reconnectAttempts = 0;
      clearTimer();
      currentQRImage = null;
      pairingCode = null;
      linkedPhone = s.user?.id?.split(':')[0] || linkedPhone || null;
      console.log('[WA] Connected ✓ Phone:', linkedPhone);
    }

    if (connection === 'close') {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      console.log('[WA] Disconnected. Code:', code);

      if (
        code === DisconnectReason.loggedOut ||
        code === DisconnectReason.connectionReplaced ||
        code === DisconnectReason.badSession
      ) {
        console.log('[WA] Session invalidated — wiping');
        reset(); linkedPhone = null;
        return;
      }

      if (mode !== 'idle' && reconnectAttempts < MAX_RECONNECT) {
        reconnectAttempts++;
        const delay = 3000 * Math.min(reconnectAttempts, 5);
        console.log(`[WA] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
        clearTimer();
        reconnectTimer = setTimeout(async () => {
          try {
            endSocket();
            if (mode === 'qr') await _connectQR();
            else if (mode === 'pair' && targetPhone) await _connectPair(targetPhone);
          } catch (e) { console.error('[WA] Reconnect failed:', e.message); }
        }, delay);
      } else if (reconnectAttempts >= MAX_RECONNECT) {
        console.error('[WA] Max reconnects reached');
        reset();
      }
    }
  });

  return s;
}

async function _connectQR() {
  sock = await createSocket();
}

async function _connectPair(phone) {
  sock = await createSocket();
  await new Promise(r => setTimeout(r, 2500));
  if (sock.authState.creds.registered) { console.log('[WA] Already registered'); return 'already-linked'; }
  const clean = phone.replace(/[^0-9]/g, '');
  const code = await sock.requestPairingCode(clean);
  pairingCode = code;
  pairingCodeExpiry = Date.now() + 160000;
  console.log('[WA] Pairing code:', code);
  return code;
}

async function startQRLogin() {
  reset(); mode = 'qr';
  return new Promise(async (resolve, reject) => {
    let done = false;
    const interval = setInterval(() => {
      if (currentQRImage && !done) { done = true; clearInterval(interval); resolve(currentQRImage); }
    }, 300);
    try {
      await _connectQR();
      if (sock?.authState?.creds?.registered) { done = true; clearInterval(interval); mode = 'idle'; resolve('already-linked'); return; }
      setTimeout(() => { clearInterval(interval); if (!done) { done = true; currentQRImage ? resolve(currentQRImage) : reject(new Error('QR timeout. Try again.')); } }, 20000);
    } catch (e) { clearInterval(interval); reject(e); }
  });
}

async function startPairLogin(phone) {
  reset(); mode = 'pair'; linkedPhone = phone; targetPhone = phone;
  try { return await _connectPair(phone); }
  catch (e) { reset(); throw new Error(e.message || 'Pairing failed. Try again.'); }
}

async function disconnect() {
  linkedPhone = null;
  reset();
}

module.exports = { getStatus, getQRImage, startQRLogin, startPairLogin, disconnect };
