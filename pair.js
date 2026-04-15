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

const _sid = (process.env.SESSION_ID || '').trim()
const HAS_SESSION = _sid && !_sid.includes('PASTE') && _sid.startsWith('JUICE~')

if (HAS_SESSION && !process.env._BOT_CHILD) {
    console.log('[Juice v12] SESSION_ID found — launching bot...')
    const child = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
        stdio: 'inherit',
        env: { ...process.env, _BOT_CHILD: '1' }
    })
    child.on('error', e => console.error('[Juice v12] Bot error:', e.message))
    child.on('close', code => console.log('[Juice v12] Bot exited:', code))
}

const sessions = new Map()

function broadcast(id, payload) {
    const s = sessions.get(id); if (!s) return
    const msg = 'data: ' + JSON.stringify(payload) + '\n\n'
    s.clients.forEach(r => { try { r.write(msg) } catch {} })
}

async function startPairing(phone, id) {
    const dir = path.join(TMP_DIR, id)
    fs.mkdirSync(dir, { recursive: true })
    const { state, saveCreds } = await useMultiFileAuthState(dir)
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
    const s = sessions.get(id); if (s) s.sock = sock
    sock.ev.on('creds.update', saveCreds)
    setTimeout(async () => {
        try {
            const code = await sock.requestPairingCode(phone)
            const fmt = (code || '').replace(/[^A-Z0-9]/gi,'').toUpperCase().match(/.{1,4}/g)?.join('-') || code
            broadcast(id, { type: 'code', code: fmt })
            console.log('[Juice v12] Code for ' + phone + ': ' + fmt)
        } catch(e) { broadcast(id, { type: 'error', message: e.message || String(e) }) }
    }, 3000)
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'open') {
            try {
                await new Promise(r => setTimeout(r, 1500))
                const cp = path.join(dir, 'creds.json')
                if (!fs.existsSync(cp)) throw new Error('creds.json not found')
                const sid = 'JUICE~' + Buffer.from(fs.readFileSync(cp, 'utf8')).toString('base64')
                broadcast(id, { type: 'success', sessionId: sid })
                console.log('[Juice v12] Paired: ' + phone)
                setTimeout(() => { try { sock.end() } catch {} }, 5000)
            } catch(e) { broadcast(id, { type: 'error', message: 'Session save failed: ' + e.message }) }
        } else if (connection === 'close') {
            const r = new Boom(lastDisconnect?.error)?.output?.statusCode
            if (r !== DisconnectReason.loggedOut) broadcast(id, { type: 'error', message: 'Connection closed. Try again.' })
        }
    })
}

setInterval(() => {
    try {
        const now = Date.now()
        fs.readdirSync(TMP_DIR).forEach(f => {
            try {
                if (now - fs.statSync(path.join(TMP_DIR,f)).mtimeMs > 15*60*1000)
                    fs.rmSync(path.join(TMP_DIR,f), { recursive: true })
            } catch {}
        })
    } catch {}
}, 5*60*1000)

const OWNER_IMG = 'https://raw.githubusercontent.com/jayariah77-code/juice-v12/main/images/juice-owner.jpg'
const LOGO_IMG  = 'https://raw.githubusercontent.com/jayariah77-code/juice-v12/main/images/juice-logo.jpg'

function buildPairingHTML() {
return '<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'<meta charset="UTF-8"/>\n' +
'<meta name="viewport" content="width=device-width,initial-scale=1"/>\n' +
'<title>Juice v12 \u2014 Session Generator</title>\n' +
'<meta name="description" content="Deploy Juice v12 WhatsApp bot. Generate your session ID in seconds."/>\n' +
'<meta name="theme-color" content="#00c851"/>\n' +
'<link rel="preconnect" href="https://fonts.googleapis.com"/>\n' +
'<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet"/>\n' +
'<style>\n' +
':root{--green:#00c851;--green2:#00a040;--green3:#1a3a25;--bg:#060a0f;--card:#0d1117;--card2:#111820;--border:#1e2d3d;--text:#e6edf3;--muted:#7d8590;--red:#ff4444}\n' +
'*{margin:0;padding:0;box-sizing:border-box}\n' +
'html,body{min-height:100vh;background:var(--bg);color:var(--text);font-family:"Inter",system-ui,sans-serif;overflow-x:hidden}\n' +
'.bg-anim{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none}\n' +
'.bg-anim::before{content:"";position:absolute;width:700px;height:700px;background:radial-gradient(circle,rgba(0,200,81,.1) 0%,transparent 70%);border-radius:50%;top:-200px;left:-150px;animation:float1 14s ease-in-out infinite}\n' +
'.bg-anim::after{content:"";position:absolute;width:500px;height:500px;background:radial-gradient(circle,rgba(0,100,255,.07) 0%,transparent 70%);border-radius:50%;bottom:-100px;right:-100px;animation:float2 18s ease-in-out infinite}\n' +
'@keyframes float1{0%,100%{transform:translate(0,0)}50%{transform:translate(80px,50px)}}\n' +
'@keyframes float2{0%,100%{transform:translate(0,0)}50%{transform:translate(-60px,-40px)}}\n' +
'.grid-bg{position:fixed;inset:0;z-index:0;background-image:linear-gradient(rgba(0,200,81,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(0,200,81,.035) 1px,transparent 1px);background-size:50px 50px;pointer-events:none}\n' +
'.wrap{position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:24px 16px 60px}\n' +
'header{width:100%;max-width:940px;display:flex;align-items:center;justify-content:space-between;padding:14px 22px;background:rgba(13,17,23,.85);backdrop-filter:blur(16px);border:1px solid var(--border);border-radius:16px;margin-bottom:40px}\n' +
'.h-logo{display:flex;align-items:center;gap:10px}\n' +
'.h-logo img{width:34px;height:34px;border-radius:9px;object-fit:cover;border:1px solid var(--green)}\n' +
'.h-logo b{font-size:15px;color:var(--text)}\n' +
'.h-logo small{font-size:11px;color:var(--muted);display:block}\n' +
'.badge-live{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--green);background:rgba(0,200,81,.08);border:1px solid rgba(0,200,81,.2);border-radius:20px;padding:7px 16px}\n' +
'.dot{width:7px;height:7px;border-radius:50%;background:var(--green);animation:pulse 1.4s infinite;flex-shrink:0}\n' +
'@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}\n' +
'.hero{width:100%;max-width:940px;display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:start}\n' +
'@media(max-width:720px){.hero{grid-template-columns:1fr}}\n' +
'.bot-profile{display:flex;align-items:center;gap:14px;margin-bottom:22px}\n' +
'.bot-av{width:70px;height:70px;border-radius:18px;object-fit:cover;border:2px solid var(--green);box-shadow:0 0 24px rgba(0,200,81,.35)}\n' +
'.bot-nm h1{font-size:28px;font-weight:800;color:var(--text);line-height:1.1}\n' +
'.bot-nm h1 em{color:var(--green);font-style:normal}\n' +
'.bot-nm p{font-size:12px;color:var(--muted);margin-top:5px}\n' +
'.feats{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:22px}\n' +
'.feat{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:var(--muted);background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:5px 11px}\n' +
'.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:0}\n' +
'.stat{background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:14px;text-align:center}\n' +
'.sv{font-size:22px;font-weight:700;color:var(--green)}\n' +
'.sl{font-size:11px;color:var(--muted);margin-top:3px}\n' +
'.card{background:var(--card);border:1px solid var(--border);border-radius:20px;padding:30px}\n' +
'.card-ttl{font-size:17px;font-weight:700;color:var(--text);margin-bottom:5px}\n' +
'.card-sub{font-size:13px;color:var(--muted);margin-bottom:22px;line-height:1.6}\n' +
'.step-list{display:flex;flex-direction:column;gap:9px;margin-bottom:22px}\n' +
'.si{display:flex;align-items:flex-start;gap:11px;font-size:12.5px;color:var(--muted);line-height:1.5}\n' +
'.sn{min-width:22px;height:22px;border-radius:50%;background:var(--green3);border:1px solid var(--green);color:var(--green);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}\n' +
'.ilbl{font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px}\n' +
'.igrp{position:relative;margin-bottom:18px}\n' +
'.ipfx{position:absolute;left:13px;top:50%;transform:translateY(-50%);font-size:15px;pointer-events:none}\n' +
'.inp{width:100%;padding:13px 14px 13px 44px;background:#080e15;border:1.5px solid var(--border);border-radius:12px;color:var(--text);font-size:15px;font-family:"Inter",sans-serif;outline:none;transition:.2s}\n' +
'.inp:focus{border-color:var(--green);box-shadow:0 0 0 3px rgba(0,200,81,.1)}\n' +
'.inp::placeholder{color:#3a4a58}\n' +
'.btn{width:100%;padding:14px;background:linear-gradient(135deg,var(--green),var(--green2));border:none;border-radius:12px;color:#000;font-size:15px;font-weight:700;font-family:"Inter",sans-serif;cursor:pointer;transition:.2s;display:flex;align-items:center;justify-content:center;gap:8px;letter-spacing:.2px}\n' +
'.btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,200,81,.4)}\n' +
'.btn:disabled{opacity:.45;cursor:not-allowed;transform:none}\n' +
'@keyframes spin{to{transform:rotate(360deg)}}\n' +
'.spin{width:16px;height:16px;border:2.5px solid rgba(0,0,0,.25);border-top-color:#000;border-radius:50%;animation:spin .7s linear infinite}\n' +
'.err{background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.25);border-radius:10px;padding:13px;font-size:13px;color:var(--red);margin-top:12px;display:none;line-height:1.5}\n' +
'.code-scr{display:none}\n' +
'.code-hdr{display:flex;align-items:center;gap:8px;margin-bottom:18px}\n' +
'.back-btn{background:none;border:1px solid var(--border);border-radius:8px;color:var(--muted);font-size:12px;padding:6px 12px;cursor:pointer;font-family:"Inter",sans-serif;transition:.15s}\n' +
'.back-btn:hover{border-color:var(--muted);color:var(--text)}\n' +
'.ph-tag{background:var(--green3);border:1px solid var(--green);border-radius:8px;padding:5px 12px;font-size:12px;color:var(--green);font-weight:600}\n' +
'.cbox{background:#070d13;border:1.5px solid var(--green3);border-radius:16px;padding:26px;text-align:center;margin-bottom:18px;position:relative;overflow:hidden}\n' +
'.cbox::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,rgba(0,200,81,.06) 0%,transparent 65%);pointer-events:none}\n' +
'.clbl{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:var(--muted);margin-bottom:12px}\n' +
'.cval{font-family:"JetBrains Mono",monospace;font-size:42px;font-weight:600;color:var(--green);letter-spacing:10px;line-height:1;text-shadow:0 0 22px rgba(0,200,81,.5)}\n' +
'.ctmr{font-size:12px;color:var(--muted);margin-top:12px}\n' +
'.wait{display:flex;align-items:center;gap:9px;padding:13px 16px;background:rgba(0,200,81,.04);border:1px solid var(--green3);border-radius:10px;font-size:13px;color:var(--muted);margin-bottom:16px}\n' +
'.howto{background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:15px}\n' +
'.howto-ttl{font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:9px}\n' +
'.howto ol{padding-left:16px}\n' +
'.howto li{font-size:12.5px;color:var(--muted);padding:3px 0;line-height:1.5}\n' +
'.howto li::marker{color:var(--green)}\n' +
'.ok-scr{display:none}\n' +
'.ok-top{text-align:center;margin-bottom:22px}\n' +
'.ok-ico{font-size:54px;margin-bottom:12px}\n' +
'.ok-top h2{font-size:21px;font-weight:700}\n' +
'.ok-top p{font-size:13px;color:var(--muted);margin-top:4px}\n' +
'.sid{background:#070d13;border:1.5px solid var(--green3);border-radius:12px;padding:15px;margin:14px 0;max-height:115px;overflow-y:auto;word-break:break-all;font-family:"JetBrains Mono",monospace;font-size:10.5px;color:var(--green);line-height:1.7}\n' +
'.cpbtn{width:100%;padding:13px;background:var(--green3);border:1.5px solid var(--green);border-radius:12px;color:var(--green);font-size:14px;font-weight:700;font-family:"Inter",sans-serif;cursor:pointer;transition:.2s;margin-bottom:14px}\n' +
'.cpbtn:hover{background:var(--green);color:#000}\n' +
'.dep{background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:16px}\n' +
'.dep h3{font-size:13px;font-weight:600;color:var(--text);margin-bottom:11px}\n' +
'.dstep{display:flex;gap:9px;font-size:12.5px;color:var(--muted);padding:4px 0;line-height:1.5}\n' +
'.dn{min-width:19px;height:19px;border-radius:50%;background:var(--green3);border:1px solid var(--green);color:var(--green);font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px}\n' +
'kbd{background:var(--card);border:1px solid var(--border);border-radius:5px;padding:1px 7px;font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--green)}\n' +
'footer{position:relative;z-index:1;margin-top:40px;text-align:center;font-size:12px;color:var(--muted)}\n' +
'.flinks{display:flex;gap:18px;justify-content:center;margin-bottom:10px}\n' +
'.flinks a{color:var(--muted);text-decoration:none;display:flex;align-items:center;gap:5px;transition:.15s}\n' +
'.flinks a:hover{color:var(--green)}\n' +
'</style>\n' +
'</head>\n' +
'<body>\n' +
'<div class="bg-anim"></div>\n' +
'<div class="grid-bg"></div>\n' +
'<div class="wrap">\n' +
'\n' +
'<header>\n' +
'  <div class="h-logo">\n' +
'    <img src="' + LOGO_IMG + '" alt="Juice v12" onerror="this.style.display=\'none\'"/>\n' +
'    <div><b>Juice v12</b><small>WhatsApp Bot</small></div>\n' +
'  </div>\n' +
'  <div class="badge-live"><div class="dot"></div>Server Online</div>\n' +
'</header>\n' +
'\n' +
'<div class="hero">\n' +
'  <div>\n' +
'    <div class="bot-profile">\n' +
'      <img class="bot-av" src="' + OWNER_IMG + '" alt="Juice v12" onerror="this.src=\'https://ui-avatars.com/api/?name=J12&background=00c851&color=000&size=72&bold=true\'"/>\n' +
'      <div class="bot-nm">\n' +
'        <h1>Juice <em>v12</em></h1>\n' +
'        <p>by @jayariah77 &middot; Kenya &#127472;&#127466;</p>\n' +
'      </div>\n' +
'    </div>\n' +
'    <div class="feats">\n' +
'      <div class="feat">&#9889; Multi-Device</div>\n' +
'      <div class="feat">&#129302; AI Chatbot</div>\n' +
'      <div class="feat">&#128260; Auto Reconnect</div>\n' +
'      <div class="feat">&#127925; Media Download</div>\n' +
'      <div class="feat">&#128737; Anti-Delete</div>\n' +
'      <div class="feat">&#9917; Sports Live</div>\n' +
'      <div class="feat">&#128248; Sticker Maker</div>\n' +
'      <div class="feat">&#127358; 100% Free</div>\n' +
'    </div>\n' +
'    <div class="stats">\n' +
'      <div class="stat"><div class="sv">200+</div><div class="sl">Commands</div></div>\n' +
'      <div class="stat"><div class="sv">24/7</div><div class="sl">Uptime</div></div>\n' +
'      <div class="stat"><div class="sv">v12</div><div class="sl">Latest</div></div>\n' +
'    </div>\n' +
'  </div>\n' +
'\n' +
'  <div class="card">\n' +
'    <div id="scr-phone">\n' +
'      <div class="card-ttl">&#128279; Link Your WhatsApp</div>\n' +
'      <div class="card-sub">Enter your number to get a pairing code instantly. No QR needed.</div>\n' +
'      <div class="step-list">\n' +
'        <div class="si"><div class="sn">1</div><span>Enter your number &amp; click Generate</span></div>\n' +
'        <div class="si"><div class="sn">2</div><span>Open WhatsApp &rarr; Linked Devices &rarr; Link a Device</span></div>\n' +
'        <div class="si"><div class="sn">3</div><span>Choose "Link with phone number" &rarr; enter the code</span></div>\n' +
'      </div>\n' +
'      <div class="ilbl">WhatsApp Number</div>\n' +
'      <div class="igrp">\n' +
'        <div class="ipfx">&#128241;</div>\n' +
'        <input class="inp" id="ph" type="tel" placeholder="254712345678 (with country code)" inputmode="numeric" autocomplete="off"/>\n' +
'      </div>\n' +
'      <button class="btn" id="genBtn" onclick="startPairing()">\n' +
'        <span id="btnTxt">&#9889; Generate Pairing Code</span>\n' +
'        <div class="spin" id="btnSpin" style="display:none"></div>\n' +
'      </button>\n' +
'      <div class="err" id="errBox"></div>\n' +
'    </div>\n' +
'\n' +
'    <div class="code-scr" id="scr-code">\n' +
'      <div class="code-hdr">\n' +
'        <button class="back-btn" onclick="goBack()">&#8592; Back</button>\n' +
'        <div class="ph-tag" id="phTag"></div>\n' +
'      </div>\n' +
'      <div class="cbox">\n' +
'        <div class="clbl">Your Pairing Code</div>\n' +
'        <div class="cval" id="cval">&#xB7;&#xB7;&#xB7;&#xB7;-&#xB7;&#xB7;&#xB7;&#xB7;</div>\n' +
'        <div class="ctmr">&#9201; Valid for 3 minutes &middot; Enter exactly as shown</div>\n' +
'      </div>\n' +
'      <div class="wait"><div class="dot"></div><span>Waiting for WhatsApp confirmation&hellip;</span></div>\n' +
'      <div class="howto">\n' +
'        <div class="howto-ttl">How to enter the code</div>\n' +
'        <ol class="howto">\n' +
'          <li>Open <strong>WhatsApp</strong> on your phone</li>\n' +
'          <li>Tap <strong>&#8942; Menu &rarr; Linked Devices</strong></li>\n' +
'          <li>Tap <strong>Link a Device</strong></li>\n' +
'          <li>Tap <strong>&ldquo;Link with phone number instead&rdquo;</strong></li>\n' +
'          <li>Type the 8-digit code exactly as shown above</li>\n' +
'        </ol>\n' +
'      </div>\n' +
'    </div>\n' +
'\n' +
'    <div class="ok-scr" id="scr-ok">\n' +
'      <div class="ok-top">\n' +
'        <div class="ok-ico">&#127881;</div>\n' +
'        <h2>Bot Linked!</h2>\n' +
'        <p>Copy your SESSION_ID and add it to your deployment</p>\n' +
'      </div>\n' +
'      <div class="sid" id="sidBox"></div>\n' +
'      <button class="cpbtn" id="cpBtn" onclick="copySession()">&#128203; Copy SESSION_ID</button>\n' +
'      <div class="dep">\n' +
'        <h3>&#128640; Next: Deploy Your Bot</h3>\n' +
'        <div class="dstep"><div class="dn">1</div><span>Go to your Render / Heroku / Railway dashboard</span></div>\n' +
'        <div class="dstep"><div class="dn">2</div><span>Add environment variable: <kbd>SESSION_ID</kbd> = paste copied value</span></div>\n' +
'        <div class="dstep"><div class="dn">3</div><span>Click <strong>Redeploy</strong> &mdash; bot goes live &#10003;</span></div>\n' +
'      </div>\n' +
'    </div>\n' +
'  </div>\n' +
'</div>\n' +
'\n' +
'<footer>\n' +
'  <div class="flinks">\n' +
'    <a href="https://github.com/jayariah77-code/juice-v12" target="_blank">&#11088; GitHub</a>\n' +
'    <a href="https://wa.me/254753204154" target="_blank">&#128172; Support</a>\n' +
'    <a href="https://t.me/jayariah77-code" target="_blank">&#9992; Telegram</a>\n' +
'  </div>\n' +
'  <div>&copy; 2026 Juice v12 &middot; Built with &#10084; by jayariah77</div>\n' +
'</footer>\n' +
'</div>\n' +
'\n' +
'<script>\n' +
'let evt = null, sid = null\n' +
'function showScr(id) {\n' +
'  ["scr-phone","scr-code","scr-ok"].forEach(s => {\n' +
'    var el = document.getElementById(s)\n' +
'    if (el) el.style.display = (s === id) ? "block" : "none"\n' +
'  })\n' +
'}\n' +
'async function startPairing() {\n' +
'  var raw = document.getElementById("ph").value.replace(/[^0-9]/g,"")\n' +
'  if (!raw || raw.length < 7) { showErr("Enter a valid number with country code (e.g. 254712345678)"); return }\n' +
'  var btn = document.getElementById("genBtn")\n' +
'  btn.disabled = true\n' +
'  document.getElementById("btnTxt").textContent = "Connecting..."\n' +
'  document.getElementById("btnSpin").style.display = "block"\n' +
'  document.getElementById("errBox").style.display = "none"\n' +
'  try {\n' +
'    var res = await fetch("/api/start", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ phone: raw }) })\n' +
'    var data = await res.json()\n' +
'    if (!res.ok || data.error) throw new Error(data.error || "Server error")\n' +
'    document.getElementById("phTag").textContent = "+" + raw\n' +
'    showScr("scr-code")\n' +
'    listenEvt(data.id)\n' +
'  } catch(e) {\n' +
'    btn.disabled = false\n' +
'    document.getElementById("btnTxt").textContent = "\u26a1 Generate Pairing Code"\n' +
'    document.getElementById("btnSpin").style.display = "none"\n' +
'    showErr(e.message)\n' +
'  }\n' +
'}\n' +
'function listenEvt(id) {\n' +
'  if (evt) evt.close()\n' +
'  evt = new EventSource("/api/events?id=" + id)\n' +
'  evt.onmessage = function(e) {\n' +
'    try {\n' +
'      var d = JSON.parse(e.data)\n' +
'      if (d.type === "code") { document.getElementById("cval").textContent = d.code }\n' +
'      else if (d.type === "success") {\n' +
'        sid = d.sessionId\n' +
'        document.getElementById("sidBox").textContent = d.sessionId\n' +
'        showScr("scr-ok")\n' +
'        evt.close()\n' +
'      } else if (d.type === "error") {\n' +
'        goBack(); showErr(d.message); if(evt) evt.close()\n' +
'      }\n' +
'    } catch {}\n' +
'  }\n' +
'  evt.onerror = function() {}\n' +
'}\n' +
'function copySession() {\n' +
'  if (!sid) return\n' +
'  var cp = function() {\n' +
'    document.getElementById("cpBtn").textContent = "\u2705 Copied!"\n' +
'    setTimeout(function() { document.getElementById("cpBtn").textContent = "\ud83d\udccb Copy SESSION_ID" }, 2500)\n' +
'  }\n' +
'  if (navigator.clipboard) { navigator.clipboard.writeText(sid).then(cp).catch(function(){\n' +
'    var t = document.createElement("textarea"); t.value = sid; document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t); cp()\n' +
'  }) } else {\n' +
'    var t = document.createElement("textarea"); t.value = sid; document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t); cp()\n' +
'  }\n' +
'}\n' +
'function goBack() {\n' +
'  if (evt) evt.close()\n' +
'  var btn = document.getElementById("genBtn")\n' +
'  btn.disabled = false\n' +
'  document.getElementById("btnTxt").textContent = "\u26a1 Generate Pairing Code"\n' +
'  document.getElementById("btnSpin").style.display = "none"\n' +
'  showScr("scr-phone")\n' +
'}\n' +
'function showErr(msg) {\n' +
'  var el = document.getElementById("errBox"); el.textContent = "\u26a0\ufe0f " + msg; el.style.display = "block"\n' +
'}\n' +
'document.addEventListener("DOMContentLoaded", function() {\n' +
'  document.getElementById("ph").addEventListener("keydown", function(e) { if (e.key === "Enter") startPairing() })\n' +
'})\n' +
'</script>\n' +
'</body>\n' +
'</html>'
}

function buildStatusHTML() {
return '<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>\n' +
'<title>Juice v12 \u2014 Bot Active</title>\n' +
'<meta name="theme-color" content="#00c851"/>\n' +
'<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet"/>\n' +
'<style>\n' +
'*{margin:0;padding:0;box-sizing:border-box}\n' +
'body{min-height:100vh;background:#060a0f;color:#e6edf3;font-family:"Inter",sans-serif;display:flex;align-items:center;justify-content:center;padding:20px}\n' +
'.bg{position:fixed;inset:0;background:radial-gradient(circle at 35% 45%,rgba(0,200,81,.09) 0%,transparent 60%);pointer-events:none}\n' +
'.card{position:relative;background:#0d1117;border:1px solid #1e2d3d;border-radius:24px;padding:48px 40px;text-align:center;max-width:440px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.5)}\n' +
'.av{width:80px;height:80px;border-radius:20px;object-fit:cover;border:2px solid #00c851;box-shadow:0 0 26px rgba(0,200,81,.4);margin-bottom:20px}\n' +
'h1{font-size:27px;font-weight:800;margin-bottom:8px} h1 em{color:#00c851;font-style:normal}\n' +
'p{font-size:14px;color:#7d8590;line-height:1.7;margin-bottom:28px}\n' +
'.badge{display:inline-flex;align-items:center;gap:8px;background:rgba(0,200,81,.09);border:1.5px solid rgba(0,200,81,.28);border-radius:50px;padding:10px 26px;font-size:14px;font-weight:700;color:#00c851;margin-bottom:28px}\n' +
'.dot{width:8px;height:8px;border-radius:50%;background:#00c851;animation:pulse 1.4s infinite}\n' +
'@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}\n' +
'.links{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}\n' +
'.lbtn{padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none;display:flex;align-items:center;gap:6px;border:1px solid #1e2d3d;color:#7d8590;transition:.2s}\n' +
'.lbtn:hover{border-color:#00c851;color:#00c851}\n' +
'.hint{margin-top:22px;font-size:12px;color:#3a4a58;line-height:1.6}\n' +
'</style>\n' +
'</head>\n' +
'<body>\n' +
'<div class="bg"></div>\n' +
'<div class="card">\n' +
'  <img class="av" src="' + OWNER_IMG + '" alt="Juice v12" onerror="this.src=\'https://ui-avatars.com/api/?name=J12&background=00c851&color=000&size=80&bold=true\'"/>\n' +
'  <h1>Juice <em>v12</em> is Live</h1>\n' +
'  <p>Your bot is running and connected to WhatsApp.<br/>Send <strong>.menu</strong> to your bot number to see all commands.</p>\n' +
'  <div class="badge"><div class="dot"></div>Bot Online &amp; Active</div>\n' +
'  <div class="links">\n' +
'    <a class="lbtn" href="https://github.com/jayariah77-code/juice-v12" target="_blank">&#11088; GitHub</a>\n' +
'    <a class="lbtn" href="https://wa.me/254753204154" target="_blank">&#128172; Support</a>\n' +
'    <a class="lbtn" href="https://t.me/jayariah77-code" target="_blank">&#9992; Telegram</a>\n' +
'  </div>\n' +
'  <p class="hint">To re-pair: remove the SESSION_ID environment variable and redeploy.</p>\n' +
'</div>\n' +
'</body>\n' +
'</html>'
}

// HTTP Server — always starts regardless of SESSION_ID
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost')

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/pair')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(HAS_SESSION ? buildStatusHTML() : buildPairingHTML())
        return
    }

    if (req.method === 'GET' && url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'ok', bot: HAS_SESSION ? 'running' : 'awaiting-session', ts: Date.now() }))
        return
    }

    if (req.method === 'POST' && url.pathname === '/api/start') {
        if (HAS_SESSION) {
            res.writeHead(403, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Bot already linked.' }))
            return
        }
        let body = ''
        req.on('data', d => { body += d })
        req.on('end', async () => {
            try {
                const { phone } = JSON.parse(body)
                const clean = (phone || '').replace(/[^0-9]/g,'').trim()
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
            } catch(e) {
                res.writeHead(500, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: e.message || 'Internal error' }))
            }
        })
        return
    }

    if (req.method === 'GET' && url.pathname === '/api/events') {
        const id = url.searchParams.get('id')
        const sess = sessions.get(id)
        if (!sess) { res.writeHead(404); res.end(); return }
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
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
    console.log('\n[Juice v12] Web server started on port ' + PORT)
    console.log('[Juice v12] ' + (HAS_SESSION ? '🟢 Bot running — status page active' : '🟡 No session — pairing UI active'))
})
