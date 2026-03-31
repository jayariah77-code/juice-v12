import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
  type WASocket,
  type ConnectionState,
} from "gifted-baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import { logger } from "./logger";

const SESSION_DIR = path.join(process.cwd(), ".wa-session");
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_MS = 3_000;

// ---- Module-level state ----
let sock: WASocket | null = null;
let connState: Partial<ConnectionState & { qr?: string }> = { connection: "close" };
let linkedPhone: string | null = null;
let currentQRImage: string | null = null;
let pairingCode: string | null = null;
let pairingCodeExpiry: number | null = null;
let mode: "idle" | "qr" | "pair" = "idle";
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let targetPhone: string | null = null; // for auto-pair on reconnect

// ---- Public status ----
export function getConnectionStatus() {
  return {
    connected: connState.connection === "open",
    connection: connState.connection ?? "close",
    phone: linkedPhone,
    mode,
    pairingCode: pairingCodeExpiry && Date.now() < pairingCodeExpiry ? pairingCode : null,
    pairingCodeExpiry,
    hasQR: !!currentQRImage,
    reconnectAttempts,
  };
}

export function getQRImage() {
  return currentQRImage;
}

// ---- Helpers ----
function wipeSession() {
  try {
    if (fs.existsSync(SESSION_DIR)) fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  } catch {}
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function endSocket() {
  if (sock) {
    try { sock.end(new Error("closed")); } catch {}
    try { sock.ws?.close(); } catch {}
    sock = null;
  }
}

function reset() {
  clearReconnectTimer();
  endSocket();
  wipeSession();
  connState = { connection: "close" };
  currentQRImage = null;
  pairingCode = null;
  pairingCodeExpiry = null;
  mode = "idle";
  reconnectAttempts = 0;
  targetPhone = null;
}

// ---- Core connection factory ----
async function createSocket(): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  let version: [number, number, number];
  try {
    const v = await fetchLatestBaileysVersion();
    version = v.version;
  } catch {
    version = [2, 3000, 1023247704]; // safe fallback version
  }

  const s = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger as any),
    },
    printQRInTerminal: false,
    logger: logger.child({ level: "silent" }) as any,
    browser: Browsers.macOS("Desktop"),
    keepAliveIntervalMs: 30_000,
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 60_000,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: false,
    retryRequestDelayMs: 2_000,
  });

  s.ev.on("creds.update", saveCreds);

  s.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update as any;
    connState = { ...connState, ...update } as any;

    // New QR received
    if (qr && mode === "qr") {
      try {
        currentQRImage = await QRCode.toDataURL(qr, {
          width: 320,
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
        });
        logger.info("QR code generated ✓");
      } catch (err) {
        logger.error({ err }, "Failed to generate QR image");
      }
    }

    if (connection === "open") {
      reconnectAttempts = 0;
      clearReconnectTimer();
      currentQRImage = null;
      pairingCode = null;
      linkedPhone = (s.user?.id?.split(":")[0]) ?? linkedPhone ?? null;
      logger.info({ phone: linkedPhone }, "WhatsApp connected ✓");
    }

    if (connection === "close") {
      const boom = lastDisconnect?.error as Boom;
      const statusCode = boom?.output?.statusCode;
      logger.info({ statusCode }, "WA connection closed");

      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const isReplaced = statusCode === DisconnectReason.connectionReplaced;
      const isBadSession = statusCode === DisconnectReason.badSession;
      const isRestart = statusCode === DisconnectReason.restartRequired;

      if (isLoggedOut || isReplaced || isBadSession) {
        logger.warn({ statusCode }, "Session invalidated — clearing");
        reset();
        linkedPhone = null;
        return;
      }

      // Auto-reconnect for transient failures
      if (mode !== "idle" && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        const delay = RECONNECT_DELAY_MS * Math.min(reconnectAttempts, 5);
        logger.info({ attempt: reconnectAttempts, delay }, "Scheduling reconnect...");

        clearReconnectTimer();
        reconnectTimer = setTimeout(async () => {
          try {
            endSocket();
            if (mode === "qr") {
              await _connectQR();
            } else if (mode === "pair" && targetPhone) {
              await _connectPair(targetPhone);
            }
          } catch (err) {
            logger.error({ err }, "Reconnect attempt failed");
          }
        }, delay);
      } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        logger.error("Max reconnect attempts reached — giving up");
        reset();
      }
    }
  });

  return s;
}

// ---- Internal QR connect (called on initial + reconnects) ----
async function _connectQR(): Promise<void> {
  sock = await createSocket();
}

// ---- Internal pair connect (called on initial + reconnects) ----
async function _connectPair(phone: string): Promise<string> {
  sock = await createSocket();

  // Wait for socket to be ready before requesting pairing code
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Socket ready timeout")), 20_000);
    // If already registered, skip pairing
    if (sock!.authState.creds.registered) {
      clearTimeout(timeout);
      resolve();
      return;
    }
    // Wait briefly for WS to open
    setTimeout(() => { clearTimeout(timeout); resolve(); }, 2_500);
  });

  if (sock!.authState.creds.registered) {
    logger.info("Already registered — no pairing code needed");
    return "already-linked";
  }

  const clean = phone.replace(/[^0-9]/g, "");
  logger.info({ clean }, "Requesting pairing code from WhatsApp");

  const code = await sock!.requestPairingCode(clean);
  pairingCode = code;
  pairingCodeExpiry = Date.now() + 160_000; // 2m 40s — plenty of time to enter it
  logger.info({ code }, "Pairing code ready ✓");
  return code;
}

// ---- QR Code connection (public) ----
export async function startQRLogin(): Promise<string> {
  reset();
  mode = "qr";
  reconnectAttempts = 0;

  return new Promise(async (resolve, reject) => {
    let resolved = false;

    const qrCheckInterval = setInterval(() => {
      if (currentQRImage && !resolved) {
        resolved = true;
        clearInterval(qrCheckInterval);
        resolve(currentQRImage);
      }
    }, 300);

    try {
      await _connectQR();

      // Already registered
      if (sock?.authState?.creds?.registered) {
        resolved = true;
        clearInterval(qrCheckInterval);
        mode = "idle";
        resolve("already-linked");
        return;
      }

      // Timeout if QR never arrives
      setTimeout(() => {
        clearInterval(qrCheckInterval);
        if (!resolved) {
          resolved = true;
          if (currentQRImage) {
            resolve(currentQRImage);
          } else {
            reject(new Error("Timed out waiting for QR code. Please try again."));
          }
        }
      }, 20_000);
    } catch (err: any) {
      clearInterval(qrCheckInterval);
      reject(new Error(err?.message ?? "Failed to start QR login"));
    }
  });
}

// ---- Pairing code connection (public) ----
export async function startPairLogin(phoneNumber: string): Promise<string> {
  reset();
  mode = "pair";
  linkedPhone = phoneNumber;
  targetPhone = phoneNumber;
  reconnectAttempts = 0;

  try {
    const result = await _connectPair(phoneNumber);
    return result;
  } catch (err: any) {
    logger.error({ err: err?.message }, "Pairing code request failed");
    reset();
    throw new Error(err?.message ?? "Failed to generate pairing code. Try again.");
  }
}

// ---- Disconnect ----
export async function disconnectWhatsApp() {
  linkedPhone = null;
  reset();
}
