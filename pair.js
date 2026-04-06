require('dotenv').config()

  const http    = require('http')
  const crypto  = require('crypto')
  const path    = require('path')
  const fs      = require('fs')
  const pino    = require('pino')
  const { spawn } = require('child_process')

  const {
      makeWASocket,
      useMultiFileAuthState,
      DisconnectReason,
      Browsers
  } = require('gifted-baileys')
  const { Boom } = require('@hapi/boom')

  const PORT    = process.env.PORT || 3000
  const TMP_DIR = path.join(__dirname, 'tmp_pair')
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })

  // ── Check SESSION_ID ──────────────────────────────────────────────────────────
  const _sid = (process.env.SESSION_ID || '').trim()
  const HAS_SESSION = _sid && !_sid.includes('PASTE') && _sid.startsWith('JUICE~')

  // ── If SESSION_ID is configured, spawn the actual bot as a child process ──────
  if (HAS_SESSION && !process.env._BOT_CHILD) {
      console.log('[Juice v12] SESSION_ID found — launching bot in background...')
      const child = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
          stdio: 'inherit',
          env: { ...process.env, _BOT_CHILD: '1' }
      })
      child.on('error', e => console.error('[Juice v12] Bot spawn error:', e.message))
      child.on('close', (code) => console.log('[Juice v12] Bot process exited with code:', code))
  }

  // ── Active pairing sessions store ─────────────────────────────────────────────
  const sessions = new Map()

  function broadcast(id, payload) {
      const s = sessions.get(id)
      if (!s) return
      const msg = 'data: ' + JSON.stringify(payload) + '\n\n'
      s.clients.forEach(res => { try { res.write(msg) } catch {} })
  }

  async function startPairing(phone, id) {
      const dir = path.join(TMP_DIR, id)
      fs.mkdirSync(dir, { recursive: true })

      const { state, saveCreds } = await useMultiFileAuthState(dir)
      // Handle CJS/ESM interop — makeWASocket may be under .default
      const _mkSock = (makeWASocket && makeWASocket.default) ? makeWASocket.default : makeWASocket
      const sock = _mkSock({
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
                  await new Promise(r => setTimeout(r, 1500))
                  const credsPath = path.join(dir, 'creds.json')
                  if (!fs.existsSync(credsPath)) throw new Error('creds.json not found')
                  const raw = fs.readFileSync(credsPath, 'utf8')
                  const sessionId = 'JUICE~' + Buffer.from(raw).toString('base64')
                  broadcast(id, { type: 'success', sessionId })
                  console.log('[Juice v12] ✅ Pairing successful for', phone)
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

  // ── Cleanup stale tmp sessions every 15 minutes ───────────────────────────────
  setInterval(() => {
      try {
          const now = Date.now()
          fs.readdirSync(TMP_DIR).forEach(f => {
              const fp = path.join(TMP_DIR, f)
              try {
                  if (now - fs.statSync(fp).mtimeMs > 15 * 60 * 1000) fs.rmSync(fp, { recursive: true })
              } catch {}
          })
      } catch {}
  }, 5 * 60 * 1000)

  // ── HTML Pages ────────────────────────────────────────────────────────────────
  const PAIRING_HTML = `<!DOCTYPE html>
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
  .subtitle{font-size:13px;color:#666;margin-bottom:28px;line-height:1.6}
  label{font-size:13px;font-weight:500;color:#aaa;display:block;margin-bottom:8px}
  input{width:100%;padding:14px 16px;background:#0d0d16;border:1.5px solid #252535;border-radius:12px;color:#e8e8e8;font-size:15px;outline:none;transition:.2s;margin-bottom:20px}
  input:focus{border-color:#00c851;box-shadow:0 0 0 3px rgba(0,200,81,.1)}
  input::placeholder{color:#444}
  button#pairBtn{width:100%;padding:15px;background:linear-gradient(135deg,#00c851,#00a040);border:none;border-radius:12px;color:#fff;font-size:16px;font-weight:600;cursor:pointer;transition:.2s}
  button#pairBtn:hover{opacity:.9;transform:translateY(-1px)}
  button#pairBtn:disabled{opacity:.5;cursor:not-allowed;transform:none}
  .step{display:none;animation:fadeIn .4s ease}
  @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  .code-box{background:#0d0d16;border:1.5px solid #1a3a25;border-radius:14px;padding:24px;text-align:center;margin:20px 0}
  .code-label{font-size:12px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px}
  .code-value{font-size:38px;font-weight:700;letter-spacing:8px;color:#00c851;font-family:'Courier New',monospace}
  .code-hint{font-size:12px;color:#555;margin-top:12px;line-height:1.6}
  .waiting{display:flex;align-items:center;gap:10px;padding:14px 18px;background:#0d0d16;border-radius:10px;margin-top:12px;font-size:14px;color:#888}
  .dot{width:8px;height:8px;border-radius:50%;background:#00c851;animation:pulse 1.4s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
  .success-icon{font-size:56px;text-align:center;margin-bottom:16px}
  .session-box{background:#0a1a10;border:1.5px solid #1a3a25;border-radius:12px;padding:16px;margin:16px 0;word-break:break-all;font-size:11px;font-family:'Courier New',monospace;color:#00c851;line-height:1.6;max-height:110px;overflow-y:auto}
  .copy-btn{width:100%;padding:13px;background:#1a3a25;border:1.5px solid #00c851;border-radius:10px;color:#00c851;font-size:14px;font-weight:600;cursor:pointer;transition:.2s;margin-bottom:12px}
  .copy-btn:hover{background:#00c851;color:#000}
  .deploy-hint{background:#0d0d16;border-radius:10px;padding:16px;font-size:12.5px;color:#666;line-height:1.8}
  .deploy-hint strong{color:#aaa}
  .deploy-hint code{background:#1a1a25;padding:2px 7px;border-radius:5px;color:#00c851;font-size:12px}
  .step-tag{display:inline-block;background:#1a1a25;border-radius:6px;padding:2px 8px;font-size:11px;color:#555;margin-bottom:16px}
  .error-box{background:#1a0a0a;border:1px solid #3a1a1a;border-radius:10px;padding:16px;color:#ff6b6b;font-size:13px;margin-top:12px;line-height:1.5}
  .back-btn{background:none;border:none;color:#555;font-size:13px;cursor:pointer;margin-top:16px;text-decoration:underline;width:100%}
  .back-btn:hover{color:#888}
  .steps-list{list-style:none;padding:0;margin-top:6px}
  .steps-list li{padding:5px 0;font-size:13px;color:#666;display:flex;gap:8px}
  .steps-list li:nth-child(1)::before{content:"1️⃣";min-width:22px}
  .steps-list li:nth-child(2)::before{content:"2️⃣";min-width:22px}
  .steps-list li:nth-child(3)::before{content:"3️⃣";min-width:22px}
  </style>
  </head>
  <body>
  <div class="card">
    <div class="logo">
      <div class="logo-icon">⚡</div>
      <div class="logo-text"><h1>Juice v12</h1><p>WhatsApp Bot · Session Linker</p></div>
    </div>

    <div class="step" id="step-phone" style="display:block">
      <h2>Link Your WhatsApp</h2>
      <p class="subtitle">Enter your number to get a pairing code. No QR scan needed — just type the code shown below into WhatsApp.</p>
      <label for="phone">WhatsApp Number (with country code, no + or spaces)</label>
      <input type="tel" id="phone" placeholder="e.g. 254712345678" autocomplete="off" inputmode="numeric"/>
      <ul class="steps-list">
        <li>Enter your number &amp; click Generate Code</li>
        <li>Open WhatsApp → Linked Devices → Link a Device</li>
        <li>Choose "Link with phone number" &amp; enter the code</li>
      </ul>
      <br/>
      <button id="pairBtn" onclick="startPairing()">⚡ Generate Pairing Code</button>
      <div id="errorBox"></div>
    </div>

    <div class="step" id="step-code">
      <span class="step-tag">Step 2 of 3</span>
      <h2>Enter Code in WhatsApp</h2>
      <p class="subtitle">Go to WhatsApp → ⋮ Menu → Linked Devices → Link a Device → Link with phone number</p>
      <div class="code-box">
        <div class="code-label">Your Pairing Code</div>
        <div class="code-value" id="codeDisplay">····-····</div>
        <div class="code-hint">Valid for 3 minutes · Enter exactly as shown</div>
      </div>
      <div class="waiting"><div class="dot"></div>Waiting for WhatsApp to confirm…</div>
      <button class="back-btn" onclick="goBack()">← Try a different number</button>
    </div>

    <div class="step" id="step-success">
      <span class="step-tag">Done! ✅</span>
      <div class="success-icon">🎉</div>
      <h2 style="text-align:center;margin-bottom:6px">Bot Linked!</h2>
      <p class="subtitle" style="text-align:center">Copy the SESSION_ID below and add it to your deployment environment variables.</p>
      <div class="session-box" id="sessionDisplay"></div>
      <button class="copy-btn" onclick="copySession()">📋 Copy SESSION_ID</button>
      <div class="deploy-hint">
        <strong>Next step:</strong><br/>
        In your Render / Heroku / Railway dashboard, add:<br/><br/>
        Variable name: <code>SESSION_ID</code><br/>
        Value: <em>paste what you copied</em><br/><br/>
        Then click <strong>Redeploy</strong> — the bot starts automatically. ✅
      </div>
    </div>
  </div>

  <script>
  let evtSource = null, sessionId = null

  function show(step) {
    ['step-phone','step-code','step-success'].forEach(s => {
      document.getElementById(s).style.display = (s === step) ? 'block' : 'none'
    })
  }

  async function startPairing() {
    const phone = document.getElementById('phone').value.replace(/[^0-9]/g,'')
    if (!phone || phone.length < 7) { showError('Enter a valid phone number with country code (e.g. 254712345678)'); return }
    const btn = document.getElementById('pairBtn')
    btn.disabled = true; btn.textContent = '⏳ Connecting...'
    document.getElementById('errorBox').innerHTML = ''
    try {
      const res = await fetch('/api/start', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ phone }) })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Server error')
      show('step-code')
      listenForEvents(data.id)
    } catch(e) {
      btn.disabled = false; btn.textContent = '⚡ Generate Pairing Code'
      showError(e.message)
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
          if (evtSource) evtSource.close()
        }
      } catch {}
    }
  }

  function copySession() {
    if (!sessionId) return
    navigator.clipboard?.writeText(sessionId).then(() => {
      document.querySelector('.copy-btn').textContent = '✅ Copied!'
      setTimeout(() => { document.querySelector('.copy-btn').textContent = '📋 Copy SESSION_ID' }, 2500)
    }).catch(() => {
      const ta = document.createElement('textarea'); ta.value = sessionId
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
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
    document.getElementById('errorBox').innerHTML = '<div class="error-box">⚠️ ' + msg + '</div>'
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('phone').addEventListener('keydown', e => { if (e.key === 'Enter') startPairing() })
  })
  </script>
  </body>
  </html>`

  const STATUS_HTML = `<!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Juice v12 — Bot Running</title>
  <style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{min-height:100vh;background:#0a0a0f;color:#e8e8e8;font-family:'Segoe UI',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;padding:20px}
  .card{background:#111118;border:1px solid #1e1e2e;border-radius:20px;padding:40px 36px;width:100%;max-width:420px;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.6)}
  .icon{font-size:64px;margin-bottom:20px}
  h1{font-size:24px;font-weight:700;color:#fff;margin-bottom:8px}
  p{font-size:14px;color:#666;line-height:1.7;margin-bottom:20px}
  .badge{display:inline-flex;align-items:center;gap:8px;background:#0a1a10;border:1.5px solid #1a3a25;border-radius:10px;padding:10px 20px;font-size:14px;color:#00c851;font-weight:600}
  .dot{width:8px;height:8px;border-radius:50%;background:#00c851;animation:pulse 1.4s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
  .hint{margin-top:24px;font-size:12px;color:#444;line-height:1.6}
  .hint a{color:#00c851;text-decoration:none}
  </style>
  </head>
  <body>
  <div class="card">
    <div class="icon">⚡</div>
    <h1>Juice v12 is Running</h1>
    <p>Your WhatsApp bot is active and connected.<br/>Send <strong>.menu</strong> to your bot to see all commands.</p>
    <div class="badge"><div class="dot"></div>Bot Online</div>
    <p class="hint">Need to re-pair? Remove the <code>SESSION_ID</code> env variable and redeploy.<br/>
    <a href="https://github.com/jayariah77-code/juice-v12">GitHub Repo</a> &nbsp;·&nbsp; <a href="https://wa.me/254753204154">Contact Owner</a></p>
  </div>
  </body>
  </html>`

  // ── HTTP Server — always starts regardless of SESSION_ID ──────────────────────
  const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://localhost')

      // Root / status page
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/pair')) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(HAS_SESSION ? STATUS_HTML : PAIRING_HTML)
          return
      }

      // Health check for Render/Railway/Heroku
      if (req.method === 'GET' && url.pathname === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ status: 'ok', bot: HAS_SESSION ? 'running' : 'awaiting-session' }))
          return
      }

      // POST /api/start — only available when no session
      if (req.method === 'POST' && url.pathname === '/api/start') {
          if (HAS_SESSION) {
              res.writeHead(403, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Bot already linked. Remove SESSION_ID to re-pair.' }))
              return
          }
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

      // GET /api/events?id=xxx — SSE stream
      if (req.method === 'GET' && url.pathname === '/api/events') {
          const id   = url.searchParams.get('id')
          const sess = sessions.get(id)
          if (!sess) { res.writeHead(404); res.end(); return }
          res.writeHead(200, {
              'Content-Type':      'text/event-stream',
              'Cache-Control':     'no-cache',
              'Connection':        'keep-alive',
              'X-Accel-Buffering': 'no',
          })
          res.write('data: {"type":"waiting"}\n\n')
          sess.clients.push(res)
          const hb = setInterval(() => { try { res.write(': ping\n\n') } catch {} }, 20000)
          req.on('close', () => {
              clearInterval(hb)
              if (sess.clients) sess.clients = sess.clients.filter(c => c !== res)
          })
          return
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not found')
  })

  server.listen(PORT, '0.0.0.0', () => {
      console.log('')
      console.log('╔══════════════════════════════════════════════════════╗')
      console.log('║          Juice v12 — Web Server Started              ║')
      console.log('╠══════════════════════════════════════════════════════╣')
      console.log('║  Port   : ' + PORT + '                                     ║')
      console.log('║  Status : ' + (HAS_SESSION ? '🟢 SESSION_ID set — Bot running' : '🟡 No session — Pairing UI active') + '  ║')
      console.log('╚══════════════════════════════════════════════════════╝')
      console.log('')
  })
  