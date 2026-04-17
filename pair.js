// ╔══════════════════════════════════════════════════════╗
// ║          Juice v12 — Pairing Server                 ║
// ║  HTTP server starts FIRST, baileys loaded on demand ║
// ╚══════════════════════════════════════════════════════╝

try { require('dotenv').config() } catch (_) {}

const http   = require('http')
const crypto = require('crypto')
const path   = require('path')
const fs     = require('fs')
const { spawn } = require('child_process')

const PORT    = parseInt(process.env.PORT || '3000', 10)
const TMP_DIR = path.join(__dirname, 'tmp_pair')
try { fs.mkdirSync(TMP_DIR, { recursive: true }) } catch (_) {}

const _sid = (process.env.SESSION_ID || '').trim()
const HAS_SESSION = _sid.startsWith('JUICE~')

// If SESSION_ID is set, spawn the bot as background child
if (HAS_SESSION && !process.env._BOT_SPAWNED) {
    console.log('[Juice v12] SESSION_ID detected — spawning bot...')
    try {
        const child = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
            stdio: 'inherit',
            env: { ...process.env, _BOT_SPAWNED: '1' }
        })
        child.on('error', e => console.error('[Juice v12] Bot error:', e.message))
        child.on('close', code => console.log('[Juice v12] Bot exited with code:', code))
    } catch (e) {
        console.error('[Juice v12] Failed to spawn bot:', e.message)
    }
}

// ── Session store ─────────────────────────────────────────────────────────────
const sessions = new Map()

function broadcast(id, payload) {
    const s = sessions.get(id)
    if (!s) return
    const msg = 'data: ' + JSON.stringify(payload) + '\n\n'
    for (const r of [...s.clients]) {
        try { r.write(msg) } catch (_) {}
    }
}

// ── Pairing logic (gifted-baileys loaded lazily) ──────────────────────────────
async function startPairing(phone, id) {
    // Lazy load so server always starts even if deps fail
    let makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, pino, Boom

    try {
        const baileys = require('gifted-baileys')
        makeWASocket        = baileys.default?.makeWASocket ?? baileys.makeWASocket
        useMultiFileAuthState = baileys.useMultiFileAuthState
        DisconnectReason    = baileys.DisconnectReason
        Browsers            = baileys.Browsers
        if (typeof makeWASocket !== 'function') throw new Error('makeWASocket not found')
    } catch (e) {
        broadcast(id, { type: 'error', message: 'Library load failed: ' + e.message })
        return
    }

    try { pino = require('pino') } catch (_) {
        pino = () => ({ level: 'silent', child: () => ({ info(){}, warn(){}, error(){}, debug(){}, trace(){} }) })
    }

    try { Boom = require('@hapi/boom').Boom } catch (_) { Boom = class { constructor() { this.output = { statusCode: 0 } } } }

    const dir = path.join(TMP_DIR, id)
    try { fs.mkdirSync(dir, { recursive: true }) } catch (_) {}

    let state, saveCreds
    try {
        ;({ state, saveCreds } = await useMultiFileAuthState(dir))
    } catch (e) {
        broadcast(id, { type: 'error', message: 'Auth init failed: ' + e.message }); return
    }

    let sock
    try {
        sock = makeWASocket({
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
    } catch (e) {
        broadcast(id, { type: 'error', message: 'Socket failed: ' + e.message }); return
    }

    const sess = sessions.get(id)
    if (sess) sess.sock = sock

    try { sock.ev.on('creds.update', saveCreds) } catch (_) {}

    // Request pairing code after socket connects
    setTimeout(async () => {
        try {
            const raw  = await sock.requestPairingCode(phone)
            const code = (raw || '').replace(/[^A-Z0-9]/gi, '').toUpperCase().match(/.{1,4}/g)?.join('-') || raw
            broadcast(id, { type: 'code', code })
            console.log('[Juice v12] Code for', phone + ':', code)
        } catch (e) {
            broadcast(id, { type: 'error', message: 'Code request failed: ' + (e.message || String(e)) })
        }
    }, 3500)

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update || {}
        if (connection === 'open') {
            try {
                await new Promise(r => setTimeout(r, 2000))
                const cp = path.join(dir, 'creds.json')
                if (!fs.existsSync(cp)) throw new Error('creds.json not created')
                const sid = 'JUICE~' + Buffer.from(fs.readFileSync(cp, 'utf8')).toString('base64')
                broadcast(id, { type: 'success', sessionId: sid })
                console.log('[Juice v12] ✅ Paired:', phone)
                setTimeout(() => { try { sock.end() } catch (_) {} }, 5000)
            } catch (e) {
                broadcast(id, { type: 'error', message: 'Session save error: ' + e.message })
            }
        } else if (connection === 'close') {
            try {
                const code = new Boom(lastDisconnect?.error)?.output?.statusCode
                if (code !== DisconnectReason?.loggedOut)
                    broadcast(id, { type: 'error', message: 'Connection closed — please try again.' })
            } catch (_) {}
        }
    })
}

// Cleanup stale tmp dirs
setInterval(() => {
    try {
        const now = Date.now()
        for (const f of fs.readdirSync(TMP_DIR)) {
            try {
                if (now - fs.statSync(path.join(TMP_DIR, f)).mtimeMs > 900000)
                    fs.rmSync(path.join(TMP_DIR, f), { recursive: true })
            } catch (_) {}
        }
    } catch (_) {}
}, 300000)

// ── Assets ────────────────────────────────────────────────────────────────────
const RAW  = 'https://raw.githubusercontent.com/jayariah77-code/juice-v12/main'
const OIMG = RAW + '/images/juice-owner.jpg'
const LIMG = RAW + '/images/juice-logo.jpg'
const VIDURL = RAW + '/images/juice-preview.mp4'

// ── HTML pages ────────────────────────────────────────────────────────────────
function getPairingHTML() {
return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Juice v12 — Get Session ID</title>
<meta name="description" content="Link your WhatsApp to Juice v12 bot. Get your pairing code in seconds."/>
<meta name="theme-color" content="#00c851"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--g:#00c851;--g2:#009940;--g3:#0d2518;--bg:#060a0f;--card:#0d1117;--card2:#0f1922;--b:#1a2535;--t:#e6edf3;--m:#7d8590}
html,body{min-height:100vh;background:var(--bg);color:var(--t);font-family:Inter,sans-serif;overflow-x:hidden}
body{background-image:radial-gradient(ellipse at 10% 20%,rgba(0,200,81,.1) 0%,transparent 55%),radial-gradient(ellipse at 90% 80%,rgba(0,100,255,.07) 0%,transparent 50%)}
.grid{position:fixed;inset:0;background-image:linear-gradient(rgba(0,200,81,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,200,81,.03) 1px,transparent 1px);background-size:50px 50px;pointer-events:none;z-index:0}
.wrap{position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:20px 16px 56px}

/* Header */
header{width:100%;max-width:940px;display:flex;align-items:center;justify-content:space-between;padding:13px 20px;background:rgba(13,17,23,.92);backdrop-filter:blur(16px);border:1px solid var(--b);border-radius:14px;margin-bottom:32px}
.hlog{display:flex;align-items:center;gap:10px}
.hlog img{width:32px;height:32px;border-radius:8px;object-fit:cover}
.hlog b{font-size:14px} .hlog small{font-size:11px;color:var(--m);display:block}
.live{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--g);background:rgba(0,200,81,.08);border:1px solid rgba(0,200,81,.2);border-radius:20px;padding:6px 14px}
.dot{width:7px;height:7px;border-radius:50%;background:var(--g);animation:blink 1.4s infinite;flex-shrink:0}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}

/* Hero grid */
.hero{width:100%;max-width:940px;display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}
@media(max-width:700px){.hero{grid-template-columns:1fr}}

/* Left: bot info */
.bprof{display:flex;align-items:center;gap:14px;margin-bottom:20px}
.bav{width:70px;height:70px;border-radius:16px;object-fit:cover;border:2px solid var(--g);box-shadow:0 0 22px rgba(0,200,81,.3)}
.bnm h1{font-size:27px;font-weight:800;line-height:1.1}
.bnm h1 span{color:var(--g)}
.bnm p{font-size:12px;color:var(--m);margin-top:4px}
.feats{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px}
.feat{font-size:11.5px;font-weight:500;color:var(--m);background:var(--card2);border:1px solid var(--b);border-radius:7px;padding:5px 10px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.stat{background:var(--card2);border:1px solid var(--b);border-radius:11px;padding:13px;text-align:center}
.sv{font-size:20px;font-weight:700;color:var(--g)} .sl{font-size:11px;color:var(--m);margin-top:2px}

/* Right: card */
.card{background:var(--card);border:1px solid var(--b);border-radius:18px;padding:26px}
.ctit{font-size:16px;font-weight:700;margin-bottom:4px}
.csub{font-size:12.5px;color:var(--m);margin-bottom:20px;line-height:1.6}
.steps{display:flex;flex-direction:column;gap:8px;margin-bottom:20px}
.si{display:flex;align-items:flex-start;gap:10px;font-size:12.5px;color:var(--m);line-height:1.5}
.sn{min-width:21px;height:21px;border-radius:50%;background:var(--g3);border:1px solid var(--g);color:var(--g);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.ilbl{font-size:11px;font-weight:600;color:var(--m);text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px}
.igrp{position:relative;margin-bottom:16px}
.ipfx{position:absolute;left:13px;top:50%;transform:translateY(-50%);pointer-events:none;font-size:15px}
.inp{width:100%;padding:13px 14px 13px 42px;background:#07101a;border:1.5px solid var(--b);border-radius:11px;color:var(--t);font-size:15px;font-family:Inter,sans-serif;outline:none;transition:.2s}
.inp:focus{border-color:var(--g);box-shadow:0 0 0 3px rgba(0,200,81,.12)}
.inp::placeholder{color:#2e4055}
.btn{width:100%;padding:14px;background:linear-gradient(135deg,#00c851,#009940);border:none;border-radius:11px;color:#000;font-size:15px;font-weight:700;font-family:Inter,sans-serif;cursor:pointer;transition:transform .2s,box-shadow .2s;display:flex;align-items:center;justify-content:center;gap:8px}
.btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,200,81,.4)}
.btn:disabled{opacity:.45;cursor:not-allowed;transform:none!important;box-shadow:none!important}
@keyframes spin{to{transform:rotate(360deg)}}
.spin{width:16px;height:16px;border:2.5px solid rgba(0,0,0,.2);border-top-color:#000;border-radius:50%;animation:spin .7s linear infinite}
.err{background:rgba(255,50,50,.08);border:1px solid rgba(255,50,50,.25);border-radius:9px;padding:12px;font-size:12.5px;color:#ff6b6b;margin-top:11px;display:none;line-height:1.5}

/* Code screen */
.cscr{display:none}
.chdr{display:flex;align-items:center;gap:8px;margin-bottom:17px}
.bk{background:none;border:1px solid var(--b);border-radius:7px;color:var(--m);font-size:12px;padding:5px 11px;cursor:pointer;font-family:Inter,sans-serif;transition:.15s}
.bk:hover{border-color:var(--m);color:var(--t)}
.ptag{background:var(--g3);border:1px solid var(--g);border-radius:7px;padding:5px 12px;font-size:12px;color:var(--g);font-weight:600}
.cbox{background:#060e16;border:1.5px solid var(--g3);border-radius:15px;padding:26px;text-align:center;margin-bottom:17px;position:relative;overflow:hidden}
.cbox::after{content:"";position:absolute;inset:0;background:radial-gradient(circle,rgba(0,200,81,.06),transparent 65%);pointer-events:none}
.clbl{font-size:10px;text-transform:uppercase;letter-spacing:2.5px;color:var(--m);margin-bottom:12px}
.cval{font-family:"JetBrains Mono",monospace;font-size:40px;font-weight:600;color:var(--g);letter-spacing:10px;line-height:1;text-shadow:0 0 24px rgba(0,200,81,.5)}
.ctmr{font-size:11.5px;color:var(--m);margin-top:11px}
.wait{display:flex;align-items:center;gap:9px;padding:12px 15px;background:rgba(0,200,81,.04);border:1px solid var(--g3);border-radius:9px;font-size:12.5px;color:var(--m);margin-bottom:15px}
.hw{background:var(--card2);border:1px solid var(--b);border-radius:11px;padding:14px}
.hwtit{font-size:11px;font-weight:600;color:var(--m);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
.hw ol{padding-left:15px} .hw li{font-size:12px;color:var(--m);padding:2px 0;line-height:1.5} .hw li::marker{color:var(--g)}

/* Success screen */
.oscr{display:none}
.otok{text-align:center;margin-bottom:20px}
.oico{font-size:52px;margin-bottom:10px}
.otok h2{font-size:20px;font-weight:700} .otok p{font-size:12.5px;color:var(--m);margin-top:4px}
.sid{background:#060e16;border:1.5px solid var(--g3);border-radius:11px;padding:14px;margin:12px 0;max-height:115px;overflow-y:auto;word-break:break-all;font-family:"JetBrains Mono",monospace;font-size:10px;color:var(--g);line-height:1.7}
.cpbtn{width:100%;padding:13px;background:var(--g3);border:1.5px solid var(--g);border-radius:11px;color:var(--g);font-size:13px;font-weight:700;font-family:Inter,sans-serif;cursor:pointer;transition:.2s;margin-bottom:13px}
.cpbtn:hover{background:var(--g);color:#000}
.dep{background:var(--card2);border:1px solid var(--b);border-radius:11px;padding:15px}
.dep h3{font-size:12.5px;font-weight:600;margin-bottom:10px}
.ds{display:flex;gap:9px;font-size:12px;color:var(--m);padding:3px 0;line-height:1.5}
.dn{min-width:19px;height:19px;border-radius:50%;background:var(--g3);border:1px solid var(--g);color:var(--g);font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px}
kbd{background:var(--card);border:1px solid var(--b);border-radius:4px;padding:1px 6px;font-family:"JetBrains Mono",monospace;font-size:10.5px;color:var(--g)}

footer{position:relative;z-index:1;margin-top:36px;text-align:center;font-size:11.5px;color:var(--m)}
.fl{display:flex;gap:16px;justify-content:center;margin-bottom:8px}
.fl a{color:var(--m);text-decoration:none;transition:.15s} .fl a:hover{color:var(--g)}
</style>
</head>
<body>
<div class="grid"></div>
<div class="wrap">

<header>
  <div class="hlog">
    <img src="${LIMG}" alt="Juice v12" onerror="this.style.display='none'"/>
    <div><b>Juice v12</b><small>WhatsApp Bot</small></div>
  </div>
  <div class="live"><div class="dot"></div>Server Online</div>
</header>

<div class="hero">
  <!-- Left: Bot Info -->
  <div>
    <div class="bprof">
      <img class="bav" src="${OIMG}" alt="Ariah"
        onerror="this.src='https://ui-avatars.com/api/?name=Ariah&background=00c851&color=000&size=70&bold=true'"/>
      <div class="bnm">
        <h1>Juice <span>v12</span></h1>
        <p>Owner: <b>Ariah</b> &middot; Kenya &#127472;&#127466;</p>
      </div>
    </div>
    <div class="feats">
      <div class="feat">&#9889; Multi-Device</div>
      <div class="feat">&#129302; AI Chatbot</div>
      <div class="feat">&#128260; Auto-Reconnect</div>
      <div class="feat">&#127925; Media Download</div>
      <div class="feat">&#128737;&#65039; Anti-Delete</div>
      <div class="feat">&#9917; Sports Live</div>
      <div class="feat">&#128248; Sticker Maker</div>
      <div class="feat">&#127358; 100% Free</div>
    </div>
    <div class="stats">
      <div class="stat"><div class="sv">200+</div><div class="sl">Commands</div></div>
      <div class="stat"><div class="sv">24/7</div><div class="sl">Uptime</div></div>
      <div class="stat"><div class="sv">v12</div><div class="sl">Latest</div></div>
    </div>
  </div>

  <!-- Right: Pairing Card -->
  <div class="card">

    <!-- Screen 1: Phone input -->
    <div id="sp">
      <div class="ctit">&#128279; Link Your WhatsApp</div>
      <div class="csub">Enter any WhatsApp number with country code to get your 8-digit pairing code instantly.</div>
      <div class="steps">
        <div class="si"><div class="sn">1</div><span>Enter your WhatsApp number below</span></div>
        <div class="si"><div class="sn">2</div><span>Open WhatsApp &rarr; Linked Devices &rarr; Link a Device</span></div>
        <div class="si"><div class="sn">3</div><span>Tap <b>Link with phone number</b> &rarr; type the code</span></div>
      </div>
      <div class="ilbl">WhatsApp Number (with country code)</div>
      <div class="igrp">
        <div class="ipfx">&#128241;</div>
        <input class="inp" id="ph" type="tel" placeholder="254712345678  or  1xxxxxxxxxx" inputmode="numeric" autocomplete="off"/>
      </div>
      <button class="btn" id="gb" onclick="doGen()">
        <span id="bt">&#9889; Get Pairing Code</span>
        <div class="spin" id="bs" style="display:none"></div>
      </button>
      <div class="err" id="eb"></div>
    </div>

    <!-- Screen 2: Show code -->
    <div class="cscr" id="sc">
      <div class="chdr">
        <button class="bk" onclick="goBack()">&#8592; Back</button>
        <div class="ptag" id="pt"></div>
      </div>
      <div class="cbox">
        <div class="clbl">Your Pairing Code</div>
        <div class="cval" id="cv">&#xB7;&#xB7;&#xB7;&#xB7;-&#xB7;&#xB7;&#xB7;&#xB7;</div>
        <div class="ctmr">&#9201; Valid for 3 minutes &middot; type it exactly as shown</div>
      </div>
      <div class="wait"><div class="dot"></div><span>Waiting for WhatsApp to confirm&hellip;</span></div>
      <div class="hw">
        <div class="hwtit">How to enter the code</div>
        <ol>
          <li>Open <b>WhatsApp</b> on your phone</li>
          <li>Tap <b>&#8942; Menu &rarr; Linked Devices</b></li>
          <li>Tap <b>Link a Device</b></li>
          <li>Tap <b>&ldquo;Link with phone number instead&rdquo;</b></li>
          <li>Enter the 8-digit code exactly as shown above</li>
        </ol>
      </div>
    </div>

    <!-- Screen 3: Success -->
    <div class="oscr" id="so">
      <div class="otok">
        <div class="oico">&#127881;</div>
        <h2>Successfully Linked!</h2>
        <p>Your SESSION_ID is ready. Copy it and add to your deployment.</p>
      </div>
      <div class="sid" id="sib"></div>
      <button class="cpbtn" id="cb" onclick="doCopy()">&#128203; Copy SESSION_ID</button>
      <div class="dep">
        <h3>&#128640; Next: Deploy Your Bot Free</h3>
        <div class="ds"><div class="dn">1</div><span>Go to Render / Railway / Heroku dashboard</span></div>
        <div class="ds"><div class="dn">2</div><span>Add env var: <kbd>SESSION_ID</kbd> = paste the copied value</span></div>
        <div class="ds"><div class="dn">3</div><span>Click <b>Redeploy</b> &mdash; bot goes live &#10003;</span></div>
      </div>
    </div>
  </div>
</div>

<footer>
  <div class="fl">
    <a href="https://github.com/jayariah77-code/juice-v12" target="_blank">&#11088; GitHub</a>
    <a href="https://wa.me/254753204154" target="_blank">&#128172; Owner Support</a>
    <a href="https://render.com/deploy?repo=https://github.com/jayariah77-code/juice-v12" target="_blank">&#128640; Deploy Free</a>
  </div>
  <div>&copy; 2026 Juice v12 &middot; Owner: Ariah &middot; Kenya &#127472;&#127466;</div>
</footer>
</div>

<script>
var es = null, sid = null
function sh(id) {
  ['sp','sc','so'].forEach(function(s) {
    var el = document.getElementById(s)
    if (el) el.style.display = s === id ? 'block' : 'none'
  })
}
async function doGen() {
  var raw = document.getElementById('ph').value.replace(/\D/g,'')
  if (!raw || raw.length < 7) { showErr('Please enter your number with country code. E.g. 254712345678'); return }
  var btn = document.getElementById('gb')
  btn.disabled = true
  document.getElementById('bt').textContent = 'Connecting...'
  document.getElementById('bs').style.display = 'block'
  document.getElementById('eb').style.display = 'none'
  try {
    var r = await fetch('/api/start', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({phone:raw}) })
    var d = await r.json()
    if (!r.ok || d.error) throw new Error(d.error || 'Server error (' + r.status + ')')
    document.getElementById('pt').textContent = '+' + raw
    sh('sc')
    listen(d.id)
  } catch(e) {
    btn.disabled = false
    document.getElementById('bt').textContent = '\u26a1 Get Pairing Code'
    document.getElementById('bs').style.display = 'none'
    showErr(e.message)
  }
}
function listen(id) {
  if (es) es.close()
  es = new EventSource('/api/events?id=' + id)
  es.onmessage = function(e) {
    try {
      var d = JSON.parse(e.data)
      if (d.type === 'code') {
        document.getElementById('cv').textContent = d.code
      } else if (d.type === 'success') {
        sid = d.sessionId
        document.getElementById('sib').textContent = d.sessionId
        sh('so')
        if (es) es.close()
      } else if (d.type === 'error') {
        goBack()
        showErr(d.message)
        if (es) es.close()
      }
    } catch(x) {}
  }
  es.onerror = function() {}
}
function doCopy() {
  if (!sid) return
  function done() {
    document.getElementById('cb').textContent = '\u2705 Copied!'
    setTimeout(function() { document.getElementById('cb').textContent = '\ud83d\udccb Copy SESSION_ID' }, 2500)
  }
  try {
    navigator.clipboard.writeText(sid).then(done).catch(fb)
  } catch(e) { fb() }
  function fb() {
    var t = document.createElement('textarea'); t.value = sid
    document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); done()
  }
}
function goBack() {
  if (es) es.close()
  var btn = document.getElementById('gb')
  btn.disabled = false
  document.getElementById('bt').textContent = '\u26a1 Get Pairing Code'
  document.getElementById('bs').style.display = 'none'
  sh('sp')
}
function showErr(m) {
  var el = document.getElementById('eb')
  el.textContent = '\u26a0\ufe0f ' + m; el.style.display = 'block'
}
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('ph').addEventListener('keydown', function(e) { if (e.key === 'Enter') doGen() })
})
</script>
</body>
</html>`
}

function getStatusHTML() {
return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Juice v12 &mdash; Bot Active</title>
<meta name="theme-color" content="#00c851"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;background:#060a0f;color:#e6edf3;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;padding:20px;background-image:radial-gradient(ellipse at 40% 40%,rgba(0,200,81,.09),transparent 60%)}
.card{background:#0d1117;border:1px solid #1a2535;border-radius:22px;padding:44px 36px;text-align:center;max-width:420px;width:100%}
.av{width:76px;height:76px;border-radius:18px;object-fit:cover;border:2px solid #00c851;box-shadow:0 0 24px rgba(0,200,81,.38);margin:0 auto 18px;display:block}
h1{font-size:25px;font-weight:800;margin-bottom:8px} h1 span{color:#00c851}
.own{font-size:12px;color:#7d8590;margin-bottom:20px}
p{font-size:13.5px;color:#7d8590;line-height:1.7;margin-bottom:26px}
.badge{display:inline-flex;align-items:center;gap:8px;background:rgba(0,200,81,.08);border:1.5px solid rgba(0,200,81,.25);border-radius:50px;padding:9px 22px;font-size:13px;font-weight:700;color:#00c851;margin-bottom:26px}
.dot{width:8px;height:8px;border-radius:50%;background:#00c851;animation:blink 1.4s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}
.links{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.lb{padding:9px 18px;border-radius:9px;font-size:13px;font-weight:600;text-decoration:none;border:1px solid #1a2535;color:#7d8590;transition:.2s}
.lb:hover{border-color:#00c851;color:#00c851}
.hint{margin-top:20px;font-size:11.5px;color:#2e4055;line-height:1.6}
</style>
</head>
<body>
<div class="card">
  <img class="av" src="${OIMG}" alt="Ariah"
    onerror="this.src='https://ui-avatars.com/api/?name=Ariah&background=00c851&color=000&size=76&bold=true'"/>
  <h1>Juice <span>v12</span></h1>
  <div class="own">Owner: <b>Ariah</b> &middot; Kenya &#127472;&#127466;</div>
  <p>Your bot is running and connected to WhatsApp.<br/>Send <b>.menu</b> to see all 200+ commands.</p>
  <div class="badge"><div class="dot"></div>Bot Online &amp; Active</div>
  <div class="links">
    <a class="lb" href="https://github.com/jayariah77-code/juice-v12" target="_blank">&#11088; GitHub</a>
    <a class="lb" href="https://wa.me/254753204154" target="_blank">&#128172; Support</a>
  </div>
  <p class="hint">To re-pair: remove the SESSION_ID environment variable and redeploy.</p>
</div>
</body>
</html>`
}

// ── HTTP Server ───────────────────────────────────────────────────────────────
const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

const server = http.createServer(function handler(req, res) {
    let url
    try { url = new URL(req.url, 'http://x') } catch (_) { url = { pathname: '/', searchParams: new URLSearchParams() } }
    const p = url.pathname.replace(/\/+$/, '') || '/'

    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS); res.end(); return
    }

    // ── GET home / pairing / status page
    if (req.method === 'GET' && (p === '/' || p === '/pair' || p === '/index.html' || p === '')) {
        res.writeHead(200, { ...CORS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
        res.end(HAS_SESSION ? getStatusHTML() : getPairingHTML())
        return
    }

    // ── Health check
    if (req.method === 'GET' && p === '/health') {
        res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'ok', paired: HAS_SESSION, uptime: Math.floor(process.uptime()), ts: Date.now() }))
        return
    }

    // ── Start pairing session
    if (req.method === 'POST' && p === '/api/start') {
        if (HAS_SESSION) {
            res.writeHead(403, { ...CORS, 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Bot already linked. Remove SESSION_ID env var to re-pair.' }))
            return
        }
        let body = ''
        req.on('data', function(c) { body += c })
        req.on('end', function() {
            let phone = ''
            try { phone = (JSON.parse(body).phone || '').replace(/\D/g, '') } catch (_) {}
            if (!phone || phone.length < 7) {
                res.writeHead(400, { ...CORS, 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'Enter a valid phone number with country code (e.g. 254712345678).' }))
                return
            }
            const id = crypto.randomBytes(8).toString('hex')
            sessions.set(id, { clients: [], sock: null, ts: Date.now() })
            startPairing(phone, id).catch(function(e) {
                broadcast(id, { type: 'error', message: e.message || String(e) })
            })
            res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ id: id }))
        })
        return
    }

    // ── Server-Sent Events for real-time updates
    if (req.method === 'GET' && p === '/api/events') {
        const id = url.searchParams.get('id')
        const sess = sessions.get(id)
        if (!sess) { res.writeHead(404, CORS); res.end('Session not found'); return }
        res.writeHead(200, {
            ...CORS,
            'Content-Type':  'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection':    'keep-alive',
            'X-Accel-Buffering': 'no',
        })
        res.write('data: {"type":"waiting"}\n\n')
        sess.clients.push(res)
        const hb = setInterval(function() { try { res.write(': hb\n\n') } catch (_) {} }, 25000)
        req.on('close', function() {
            clearInterval(hb)
            if (sess.clients) sess.clients = sess.clients.filter(function(c) { return c !== res })
        })
        return
    }

    // ── 404 fallback — also serve pairing page to avoid blank screen
    if (req.method === 'GET') {
        res.writeHead(200, { ...CORS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
        res.end(HAS_SESSION ? getStatusHTML() : getPairingHTML())
        return
    }

    res.writeHead(404, { ...CORS, 'Content-Type': 'text/plain' })
    res.end('Not found')
})

server.listen(PORT, '0.0.0.0', function() {
    console.log('╔════════════════════════════════════╗')
    console.log('║        Juice v12 — Pair Server      ║')
    console.log('╚════════════════════════════════════╝')
    console.log('[Juice v12] Port    :', PORT)
    console.log('[Juice v12] Mode    :', HAS_SESSION ? 'BOT ACTIVE' : 'PAIRING UI')
    console.log('[Juice v12] Session :', HAS_SESSION ? 'SET' : 'NOT SET — pairing page shown')
})

server.on('error', function(e) {
    if (e.code === 'EADDRINUSE') {
        console.error('[Juice v12] Port', PORT, 'already in use. Set PORT env var to a different port.')
    } else {
        console.error('[Juice v12] Server error:', e.message)
    }
    process.exit(1)
})
