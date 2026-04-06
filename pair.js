require('dotenv').config()

  // ── If SESSION_ID is already configured, skip pairing and run the bot directly ──
  const _sid = (process.env.SESSION_ID || '').trim()
  if (_sid && !_sid.includes('PASTE') && _sid.startsWith('JUICE~')) {
      console.log('[Juice v12] SESSION_ID found — starting bot...')
      require('./index.js')
      return
  }

  // ── No session — start the pairing web server ─────────────────────────────────
  const http    = require('http')
  const crypto  = require('crypto')
  const path    = require('path')
  const fs      = require('fs')
  const pino    = require('pino')

  const {
      default: makeWASocket,
      useMultiFileAuthState,
      DisconnectReason,
      Browsers
  } = require('gifted-baileys')
  const { Boom } = require('@hapi/boom')

  const PORT       = process.env.PORT || 3000
  const TMP_DIR    = path.join(__dirname, 'tmp_pair')
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })

  // ── Active pairing sessions ───────────────────────────────────────────────────
  const sessions = new Map()

  // ── Broadcast to all SSE clients for a session ───────────────────────────────
  function broadcast(id, payload) {
      const s = sessions.get(id)
      if (!s) return
      const msg = 'data: ' + JSON.stringify(payload) + '\n\n'
      s.clients.forEach(res => { try { res.write(msg) } catch {} })
  }

  // ── Start gifted-baileys pairing for a phone number ──────────────────────────
  async function startPairing(phone, id) {
      const dir = path.join(TMP_DIR, id)
      fs.mkdirSync(dir, { recursive: true })

      const { state, saveCreds } = await useMultiFileAuthState(dir)
      const sock = makeWASocket({
          version: [2, 3000, 1015901307],
          auth: state,
          browser: Browsers.macOS('Desktop'),
          logger: pino({ level: 'silent' }),
          printQRInTerminal: false,
          markOnlineOnConnect: false,
          connectTimeoutMs: 60000,
          defaultQueryTimeoutMs: 60000,
          keepAliveIntervalMs: 10000,
      })

      const s = sessions.get(id)
      if (s) s.sock = sock

      sock.ev.on('creds.update', saveCreds)

      // Request pairing code after socket is ready
      setTimeout(async () => {
          try {
              const code = await sock.requestPairingCode(phone)
              const fmt  = (code || '').replace(/[^A-Z0-9]/gi, '').toUpperCase().match(/.{1,4}/g)?.join('-') || code
              broadcast(id, { type: 'code', code: fmt })
              console.log('[Juice v12] Pairing code for ' + phone + ': ' + fmt)
          } catch (e) {
              broadcast(id, { type: 'error', message: 'Could not generate pairing code: ' + (e.message || e) })
          }
      }, 3000)

      sock.ev.on('connection.update', async (update) => {
          const { connection, lastDisconnect } = update

          if (connection === 'open') {
              try {
                  const credsPath = path.join(dir, 'creds.json')
                  // Wait for creds to be fully written
                  await new Promise(r => setTimeout(r, 1500))
                  if (!fs.existsSync(credsPath)) throw new Error('creds.json not found')
                  const raw = fs.readFileSync(credsPath, 'utf8')
                  const sessionId = 'JUICE~' + Buffer.from(raw).toString('base64')
                  broadcast(id, { type: 'success', sessionId })
                  console.log('[Juice v12] ✅ Pairing successful for', phone)
                  // Close socket cleanly after 5s
                  setTimeout(() => { try { sock.end() } catch {} }, 5000)
              } catch (e) {
                  broadcast(id, { type: 'error', message: 'Paired but failed to save session: ' + e.message })
              }

          } else if (connection === 'close') {
              const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
              if (reason !== DisconnectReason.loggedOut) {
                  broadcast(id, { type: 'error', message: 'Connection closed. Please try again.' })
              }
          }
      })
  }

  // ── Cleanup old tmp sessions older than 15 minutes ───────────────────────────
  setInterval(() => {
      try {
          const now = Date.now()
          fs.readdirSync(TMP_DIR).forEach(f => {
              const fp = path.join(TMP_DIR, f)
              try {
                  const stat = fs.statSync(fp)
                  if (now - stat.mtimeMs > 15 * 60 * 1000) fs.rmSync(fp, { recursive: true })
              } catch {}
          })
      } catch {}
  }, 5 * 60 * 1000)

  // ── HTML Page ─────────────────────────────────────────────────────────────────
  const HTML = `<!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Juice v12 — Link Your WhatsApp</title>
  <style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{min-height:100vh;background:#0a0a0f;color:#e8e8e8;font-family:'Segoe UI',system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px}
  .card{background:#111118;border:1px solid #1e1e2e;border-radius:20px;padding:40px 36px;width:100%;max-width:480px;box-shadow:0 8px 40px rgba(0,0,0,.6)}
  .logo{display:flex;align-items:center;gap:12px;margin-bottom:28px}
  .logo-icon{width:48px;height:48px;background:linear-gradient(135deg,#00c851,#007e33);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px}
  .logo-text h1{font-size:22px;font-weight:700;color:#fff}
  .logo-text p{font-size:13px;color:#888;margin-top:2px}
  h2{font-size:19px;font-weight:600;color:#fff;margin-bottom:6px}
  .subtitle{font-size:13px;color:#666;margin-bottom:28px;line-height:1.5}
  label{font-size:13px;font-weight:500;color:#aaa;display:block;margin-bottom:8px}
  .input-wrap{position:relative;margin-bottom:20px}
  input{width:100%;padding:14px 16px;background:#0d0d16;border:1.5px solid #252535;border-radius:12px;color:#e8e8e8;font-size:15px;outline:none;transition:.2s}
  input:focus{border-color:#00c851;box-shadow:0 0 0 3px rgba(0,200,81,.1)}
  input::placeholder{color:#444}
  button#pairBtn{width:100%;padding:15px;background:linear-gradient(135deg,#00c851,#00a040);border:none;border-radius:12px;color:#fff;font-size:16px;font-weight:600;cursor:pointer;transition:.2s;letter-spacing:.3px}
  button#pairBtn:hover{opacity:.9;transform:translateY(-1px)}
  button#pairBtn:disabled{opacity:.5;cursor:not-allowed;transform:none}
  .step{display:none;animation:fadeIn .4s ease}
  @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  .code-box{background:#0d0d16;border:1.5px solid #1a3a25;border-radius:14px;padding:24px;text-align:center;margin:20px 0}
  .code-label{font-size:12px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px}
  .code-value{font-size:36px;font-weight:700;letter-spacing:8px;color:#00c851;font-family:'Courier New',monospace}
  .code-hint{font-size:12px;color:#555;margin-top:12px;line-height:1.6}
  .waiting{display:flex;align-items:center;gap:10px;padding:14px 18px;background:#0d0d16;border-radius:10px;margin-top:12px;font-size:14px;color:#888}
  .dot{width:8px;height:8px;border-radius:50%;background:#00c851;animation:pulse 1.4s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
  .success-icon{font-size:56px;text-align:center;margin-bottom:16px}
  .session-box{background:#0a1a10;border:1.5px solid #1a3a25;border-radius:12px;padding:16px;margin:16px 0;word-break:break-all;font-size:11.5px;font-family:'Courier New',monospace;color:#00c851;line-height:1.6;max-height:100px;overflow-y:auto}
  .copy-btn{width:100%;padding:13px;background:#1a3a25;border:1.5px solid #00c851;border-radius:10px;color:#00c851;font-size:14px;font-weight:600;cursor:pointer;transition:.2s;margin-bottom:12px}
  .copy-btn:hover{background:#00c851;color:#000}
  .deploy-hint{background:#0d0d16;border-radius:10px;padding:16px;font-size:12.5px;color:#666;line-height:1.7}
  .deploy-hint strong{color:#aaa}
  .deploy-hint code{background:#1a1a25;padding:2px 6px;border-radius:5px;color:#00c851;font-size:12px}
  .step-tag{display:inline-block;background:#1a1a25;border-radius:6px;padding:2px 8px;font-size:11px;color:#555;margin-bottom:16px}
  .error-box{background:#1a0a0a;border:1px solid #3a1a1a;border-radius:10px;padding:16px;color:#ff6b6b;font-size:13px;margin-top:12px;line-height:1.5}
  .back-btn{background:none;border:none;color:#555;font-size:13px;cursor:pointer;margin-top:16px;text-decoration:underline;width:100%}
  .back-btn:hover{color:#888}
  .steps-list{list-style:none;padding:0;margin-top:6px}
  .steps-list li{padding:5px 0;font-size:13px;color:#666;display:flex;gap:8px}
  .steps-list li::before{content:"";display:inline-block;min-width:18px}
  .steps-list li:nth-child(1)::before{content:"1️⃣"}
  .steps-list li:nth-child(2)::before{content:"2️⃣"}
  .steps-list li:nth-child(3)::before{content:"3️⃣"}
  </style>
  </head>
  <body>
  <div class="card">
    <div class="logo">
      <div class="logo-icon">⚡</div>
      <div class="logo-text"><h1>Juice v12</h1><p>WhatsApp Bot · Session Linker</p></div>
    </div>

    <!-- Step 1: Enter Phone -->
    <div class="step" id="step-phone" style="display:block">
      <h2>Link Your WhatsApp</h2>
      <p class="subtitle">Enter your number to get a pairing code. No QR scan needed — just type the code in WhatsApp.</p>
      <label for="phone">WhatsApp Number (with country code)</label>
      <div class="input-wrap">
        <input type="tel" id="phone" placeholder="e.g. 254712345678" autocomplete="off" inputmode="numeric"/>
      </div>
      <ul class="steps-list">
        <li>Enter your number &amp; click Generate Code</li>
        <li>Open WhatsApp → Linked Devices → Link a Device</li>
        <li>Choose "Link with phone number" &amp; enter the code</li>
      </ul>
      <br/>
      <button id="pairBtn" onclick="startPairing()">⚡ Generate Pairing Code</button>
    </div>

    <!-- Step 2: Show Code -->
    <div class="step" id="step-code">
      <span class="step-tag">Step 2 of 3</span>
      <h2>Enter Code in WhatsApp</h2>
      <p class="subtitle">Open WhatsApp → ⋮ Menu → Linked Devices → Link a Device → Link with phone number</p>
      <div class="code-box">
        <div class="code-label">Your Pairing Code</div>
        <div class="code-value" id="codeDisplay">····-····</div>
        <div class="code-hint">This code expires in 3 minutes.<br/>Enter it exactly as shown in WhatsApp.</div>
      </div>
      <div class="waiting">
        <div class="dot"></div>
        Waiting for WhatsApp to confirm…
      </div>
      <button class="back-btn" onclick="goBack()">← Try a different number</button>
    </div>

    <!-- Step 3: Success -->
    <div class="step" id="step-success">
      <span class="step-tag">Step 3 of 3 — Done!</span>
      <div class="success-icon">✅</div>
      <h2 style="text-align:center;margin-bottom:6px">Bot Linked Successfully!</h2>
      <p class="subtitle" style="text-align:center">Copy your SESSION_ID below and add it to your deployment environment variables.</p>
      <div class="session-box" id="sessionDisplay"></div>
      <button class="copy-btn" onclick="copySession()">📋 Copy SESSION_ID</button>
      <div class="deploy-hint">
        <strong>How to use:</strong><br/>
        Add this environment variable to your deployment:<br/><br/>
        <code>SESSION_ID</code> = <em>the value you copied above</em><br/><br/>
        Then restart/redeploy — your bot will start automatically without this page.
      </div>
    </div>

    <!-- Error -->
    <div id="errorBox" style="display:none"></div>
  </div>

  <script>
  let evtSource = null, sessionId = null, pairId = null

  function show(step) {
    ['step-phone','step-code','step-success'].forEach(s => {
      document.getElementById(s).style.display = s === step ? 'block' : 'none'
    })
  }

  async function startPairing() {
    const phone = document.getElementById('phone').value.replace(/[^0-9]/g, '')
    if (!phone || phone.length < 7) { alert('Please enter a valid phone number with country code'); return }
    const btn = document.getElementById('pairBtn')
    btn.disabled = true; btn.textContent = '⏳ Connecting...'
    document.getElementById('errorBox').style.display = 'none'

    try {
      const res = await fetch('/api/start', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ phone }) })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Server error')
      pairId = data.id
      show('step-code')
      listenForEvents(pairId)
    } catch(e) {
      btn.disabled = false; btn.textContent = '⚡ Generate Pairing Code'
      showError('Failed to start pairing: ' + e.message)
    }
  }

  function listenForEvents(id) {
    if (evtSource) evtSource.close()
    evtSource = new EventSource('/api/events?id=' + id)
    evtSource.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data)
        if (d.type === 'code') {
          document.getElementById('codeDisplay').textContent = d.code
        } else if (d.type === 'success') {
          sessionId = d.sessionId
          document.getElementById('sessionDisplay').textContent = d.sessionId
          show('step-success')
          evtSource.close()
        } else if (d.type === 'error') {
          show('step-phone')
          const btn = document.getElementById('pairBtn')
          btn.disabled = false; btn.textContent = '⚡ Generate Pairing Code'
          showError(d.message)
          evtSource.close()
        }
      } catch {}
    }
    evtSource.onerror = () => {
      // SSE reconnects automatically — ignore minor blips
    }
  }

  function copySession() {
    if (!sessionId) return
    navigator.clipboard.writeText(sessionId).then(() => {
      const btn = document.querySelector('.copy-btn')
      btn.textContent = '✅ Copied!'
      setTimeout(() => { btn.textContent = '📋 Copy SESSION_ID' }, 2500)
    }).catch(() => {
      // Fallback for older browsers
      const ta = document.createElement('textarea')
      ta.value = sessionId; document.body.appendChild(ta)
      ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
      document.querySelector('.copy-btn').textContent = '✅ Copied!'
      setTimeout(() => { document.querySelector('.copy-btn').textContent = '📋 Copy SESSION_ID' }, 2500)
    })
  }

  function goBack() {
    if (evtSource) evtSource.close()
    show('step-phone')
    const btn = document.getElementById('pairBtn')
    btn.disabled = false; btn.textContent = '⚡ Generate Pairing Code'
  }

  function showError(msg) {
    const el = document.getElementById('errorBox')
    el.style.display = 'block'
    el.innerHTML = '<div class="error-box">⚠️ ' + msg + '</div>'
  }

  // Allow Enter key on phone input
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('phone').addEventListener('keydown', e => {
      if (e.key === 'Enter') startPairing()
    })
  })
  </script>
  </body>
  </html>`

  // ── HTTP Server ───────────────────────────────────────────────────────────────
  const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://localhost')

      // ── Serve pairing HTML ────────────────────────────────────────────────────
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/pair')) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(HTML)
          return
      }

      // ── POST /api/start — kick off a new pairing session ─────────────────────
      if (req.method === 'POST' && url.pathname === '/api/start') {
          let body = ''
          req.on('data', d => { body += d })
          req.on('end', async () => {
              try {
                  const { phone } = JSON.parse(body)
                  const clean = (phone || '').replace(/[^0-9]/g, '').trim()
                  if (!clean || clean.length < 7) {
                      res.writeHead(400, { 'Content-Type': 'application/json' })
                      res.end(JSON.stringify({ error: 'Invalid phone number' }))
                      return
                  }
                  const id = crypto.randomBytes(8).toString('hex')
                  sessions.set(id, { status: 'pending', clients: [], sock: null })
                  startPairing(clean, id).catch(e => broadcast(id, { type: 'error', message: e.message || String(e) }))
                  res.writeHead(200, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify({ id }))
              } catch (e) {
                  res.writeHead(500, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify({ error: e.message || 'Internal error' }))
              }
          })
          return
      }

      // ── GET /api/events?id=xxx — SSE stream ───────────────────────────────────
      if (req.method === 'GET' && url.pathname === '/api/events') {
          const id  = url.searchParams.get('id')
          const sess = sessions.get(id)
          if (!sess) {
              res.writeHead(404)
              res.end()
              return
          }
          res.writeHead(200, {
              'Content-Type':  'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection':    'keep-alive',
              'X-Accel-Buffering': 'no',
          })
          res.write('data: {"type":"waiting"}\n\n')
          sess.clients.push(res)
          // Heartbeat every 20s to keep connection alive through proxies
          const hb = setInterval(() => { try { res.write(': ping\n\n') } catch {} }, 20000)
          req.on('close', () => {
              clearInterval(hb)
              if (sess.clients) sess.clients = sess.clients.filter(c => c !== res)
          })
          return
      }

      res.writeHead(404)
      res.end()
  })

  server.listen(PORT, '0.0.0.0', () => {
      console.log('')
      console.log('╔══════════════════════════════════════════════╗')
      console.log('║        Juice v12 — Pairing Server            ║')
      console.log('║  Open the URL below to link your WhatsApp    ║')
      console.log('╠══════════════════════════════════════════════╣')
      console.log('║  Port : ' + PORT + '                                ║')
      console.log('╚══════════════════════════════════════════════╝')
      console.log('')
      console.log('[Juice v12] No SESSION_ID set — showing pairing UI.')
      console.log('[Juice v12] Once linked, copy the SESSION_ID and set it in your env vars, then restart.')
  })
  