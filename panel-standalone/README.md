# 🧃 Juice v12 Control Panel — Standalone

A fully standalone WhatsApp bot control panel. Works on **Pterodactyl, aaPanel, CyberPanel, Render, Railway, VPS** — any Node.js environment.

> **Requirements:** Node.js 18+ and npm. That's it — no build step, no external database, no Docker.

---

## ⚡ Quick Start

```bash
npm install
npm start
```

Open `http://localhost:3000` in your browser.

---

## 🦕 Pterodactyl Setup

1. Create a new server using the **Node.js 18** egg
2. Upload all files from this folder to your server
3. Set:
   - **Install Command:** `npm install`
   - **Start Command:** `npm start`
   - **Port variable:** `PORT` → your allocated port
4. Start the server and open the panel URL

---

## 🌐 Other Panels / VPS

```bash
# Clone or upload files, then:
npm install
cp .env.example .env
# Edit .env if needed, then:
npm start
```

To run in the background (VPS):
```bash
npm install -g pm2
pm2 start server.js --name juice-panel
pm2 save
```

---

## 🔧 Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port to listen on |
| `OWNER_NUMBER` | `254753204154` | Your WhatsApp number (digits only) |
| `BOT_NAME` | `Juice v12` | Bot display name |
| `BOT_PREFIX` | `.` | Command prefix |

---

## 📱 How to Connect WhatsApp

### Method 1 — QR Code (Recommended)
1. Open the panel → **Connect** tab → **QR Code**
2. Click **Generate QR Code**
3. On your phone: WhatsApp → **Settings → Linked Devices → Link a Device**
4. Scan the QR code shown in the panel

### Method 2 — Pairing Code
1. Open the panel → **Connect** tab → **Pairing Code**
2. Enter your phone number with country code (e.g. `254753204154`)
3. Click **Get Pairing Code**
4. On your phone: WhatsApp → **Linked Devices → Link with phone number**
5. Enter the 8-character code shown in the panel within 3 minutes

---

## 📂 File Structure

```
panel-standalone/
├── server.js          ← Express server (API + static files)
├── package.json       ← Single package, npm install
├── .env.example       ← Environment variable template
├── lib/
│   ├── whatsapp.js    ← Gifted Baileys WhatsApp connection
│   └── db.js          ← SQLite database (auto-created)
├── public/
│   └── index.html     ← Full dashboard (no build needed)
└── data/              ← Created automatically on first run
    ├── panel.db       ← Settings database
    └── session/       ← WhatsApp session files
```

---

## ✨ Features

- 📷 **QR Code login** — scan with WhatsApp to connect
- 📱 **Pairing Code login** — link with your phone number
- 🔄 **Auto-reconnect** — reconnects automatically (up to 15 attempts)
- ⚙️ **Feature toggles** — welcome, anti-link, anti-call, chatbot, auto-react, etc.
- 💬 **700+ commands browser** — all commands listed by category
- 💾 **SQLite** — no external database needed
- 🌙 **Dark theme** — clean WhatsApp-green design
- 🔐 **Uses Gifted Baileys** — maintained WhatsApp Web library

---

## ⚠️ Important Notes

- Keep the panel running while connecting WhatsApp
- The `data/` folder contains your session — back it up after linking
- If pairing fails, the session is wiped automatically so you can retry cleanly
- Do not run two instances at the same time

---

Made with ❤️ — Juice v12 Team
