# Juice v12 Control Panel

A standalone WhatsApp bot control panel for Juice v12. Works on **Pterodactyl, aaPanel, CyberPanel, VPS, Render, Railway** — any Node.js environment.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and edit if needed
cp .env.example .env

# 3. Start the panel
npm start
```

Open `http://localhost:3000` in your browser.

## Pterodactyl Setup

1. Use the **Node.js egg**
2. Set **Startup Command**: `npm start`
3. Set **Install Command**: `npm install`
4. Set port variable: `PORT` → your allocated port
5. Upload these files and start the server

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port to run on |
| `OWNER_NUMBER` | `254753204154` | Bot owner phone number |
| `BOT_NAME` | `Juice v12` | Bot display name |
| `BOT_PREFIX` | `.` | Command prefix |

## Features

- 📷 **QR Code login** — scan to connect WhatsApp
- 📱 **Pairing Code login** — link with phone number
- ⚙️ **Feature toggles** — welcome, anti-link, anti-call, chatbot, auto-react, etc.
- 💬 **Commands browser** — all 700+ commands listed
- 🔄 **Auto-reconnect** — reconnects automatically if connection drops
- 💾 **SQLite database** — no external database needed
- 🌙 **Dark theme** — WhatsApp green accents

## Requirements

- Node.js 18+
- npm

## How to Connect WhatsApp

### Method 1 — QR Code (Recommended)
1. Click **QR Code** on the dashboard
2. Scan the QR with WhatsApp → Settings → Linked Devices → Link a Device

### Method 2 — Pairing Code
1. Click **Pairing Code**
2. Enter your phone number (with country code, e.g. `254753204154`)
3. Click **Get Pairing Code**
4. Enter the 8-character code in WhatsApp → Linked Devices → Link with phone number

---
Made with ❤️ by Juice v12 Team
