    if (!_buf || _buf.length < 100) throw new Error('Download failed — media may have expired')
    // Write with correct extension based on mimetype
    const _mime = m.quoted.mimetype || m.quoted.msg?.mimetype || 'application/octet-stream'
    const _extMap = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','audio/mpeg':'mp3','audio/ogg':'ogg','audio/mp4':'m4a','application/pdf':'pdf'}
    const _ext = _extMap[_mime.split(';')[0].trim()] || 'bin'
    const _tmp = require("path").join(__dirname, "tmp", `tourl_${Date.now()}.${_ext}`)
    require('fs').writeFileSync(_tmp, _buf)
    const _url = await CatBox(_tmp)
    require('fs').unlinkSync(_tmp)
    if (!_url || !_url.startsWith('http')) throw new Error('Upload failed — try again')
    await X.sendMessage(m.chat, {
        text: `✅ *Media uploaded!*\n\n🔗 *URL:*\n${_url}\n\n📦 _Size: ${(_buf.length/1024).toFixed(1)} KB | Type: ${_mime.split(';')[0]}_`
    }, { quoted: m })
} catch(e) { reply(`❌ *tourl failed:* ${e.message}`) }
} break

case 'simage':
case 'timage':
case 'toimage': {
    await X.sendMessage(m.chat, { react: { text: '🖼️', key: m.key } })
// Convert sticker (webp) → image (jpeg/png)
const _qmtype = m.quoted?.mtype || ''
const _qmime = m.quoted?.mimetype || m.quoted?.msg?.mimetype || ''
const _isSticker = _qmtype === 'stickerMessage' || /webp/.test(_qmime)
if (!m.quoted || !_isSticker) return reply(`🖼️ *Reply to a sticker* with *${prefix}toimage* to convert it to an image`)
try {
    await reply('🔄 _Converting sticker to image..._')
    const _buf = await m.quoted.download()
    if (!_buf || _buf.length < 100) throw new Error('Sticker download failed')
    // Use jimp to convert webp → jpeg since WA webp may be animated
    const _outPath = require("path").join(__dirname, "tmp", `toimage_${Date.now()}`)
    require('fs').writeFileSync(`${_outPath}.webp`, _buf)
    // ffmpeg: webp → png (handles both static and animated, takes first frame)
    await new Promise((resolve, reject) => {
        require('child_process').exec(
            `ffmpeg -y -i ${_outPath}.webp -vframes 1 -f image2 ${_outPath}.png`,
            (err) => err ? reject(err) : resolve()
        )
    })
    const _img = require('fs').readFileSync(`${_outPath}.png`)
    await X.sendMessage(m.chat, { image: _img, caption: '🖼️ *Sticker → Image*' }, { quoted: m })
    try { require('fs').unlinkSync(`${_outPath}.webp`); require('fs').unlinkSync(`${_outPath}.png`) } catch {}
} catch(e) { reply(`❌ *toimage failed:* ${e.message}`) }
} break

case 'totext': {
    await X.sendMessage(m.chat, { react: { text: '📝', key: m.key } })
// Extract text from an image using OCR via pollinations vision API
if (!m.quoted || !/image/.test(m.quoted.mimetype || m.quoted.msg?.mimetype || '')) {
    return reply(`╔══〔 📄 TEXT EXTRACTOR 〕══╗\n║ Reply to an image with *${prefix}totext*\n║ _Screenshots, docs, signs, receipts_\n╚═══════════════════════╝`)
}
try {
    await reply('🔍 _Reading text from image..._')
    const _imgBuf = await m.quoted.download()
    if (!_imgBuf || _imgBuf.length < 100) throw new Error('Image download failed')
    const _mime = m.quoted.mimetype || m.quoted.msg?.mimetype || 'image/jpeg'
    const _b64 = _imgBuf.toString('base64')
    const _prompt = 'Extract ALL text from this image exactly as it appears. Preserve formatting, line breaks, and structure. If no text is found, say "No text detected."'
    let _extracted = null
    // Primary: pollinations base64 vision
    try {
        const { data: _d } = await axios.post('https://text.pollinations.ai/openai', {
            model: 'openai', max_tokens: 2000, stream: false,
            messages: [{ role: 'user', content: [
                { type: 'text', text: _prompt },
                { type: 'image_url', image_url: { url: `data:${_mime};base64,${_b64}` } }
            ]}]
        }, { headers: { 'Content-Type': 'application/json' }, timeout: 30000 })
        _extracted = _d?.choices?.[0]?.message?.content
    } catch {}
    // Fallback: upload to catbox then use URL
    if (!_extracted) {
        const _tmp = require("path").join(__dirname, "tmp", `totext_${Date.now()}.jpg`)
        require('fs').writeFileSync(_tmp, _imgBuf)
        const _uploadUrl = await CatBox(_tmp)
        require('fs').unlinkSync(_tmp)
        if (_uploadUrl && _uploadUrl.startsWith('http')) {
            const { data: _d2 } = await axios.post('https://text.pollinations.ai/openai', {
                model: 'openai', max_tokens: 2000, stream: false,
                messages: [{ role: 'user', content: [
                    { type: 'text', text: _prompt },
                    { type: 'image_url', image_url: { url: _uploadUrl } }
                ]}]
            }, { headers: { 'Content-Type': 'application/json' }, timeout: 30000 })
            _extracted = _d2?.choices?.[0]?.message?.content
        }
    }
    if (!_extracted) throw new Error('Could not extract text — try a clearer image')
    reply(`╔══〔 📄 EXTRACTED TEXT 〕══╗\n\n${_extracted}\n╚═══════════════════════╝`)
} catch(e) { reply(`❌ *totext failed:* ${e.message}`) }
} break

case 'toaudio':
case 'tomp3': {
    await X.sendMessage(m.chat, { react: { text: '🎵', key: m.key } })
// Convert video → MP3 audio using ffmpeg
const _qmime2 = m.quoted?.mimetype || m.quoted?.msg?.mimetype || ''
if (!m.quoted || !/video|audio/.test(_qmime2)) return reply(`🎵 *Reply to a video* with *${prefix}tomp3* to extract its audio as MP3`)
try {
    await reply('🔄 _Extracting audio from video..._')
    const _vBuf = await m.quoted.download()
    if (!_vBuf || _vBuf.length < 100) throw new Error('Video download failed')
    const _vPath = require("path").join(__dirname, "tmp", `tomp3_in_${Date.now()}.mp4`)
    const _aPath = require("path").join(__dirname, "tmp", `tomp3_out_${Date.now()}.mp3`)
    require('fs').writeFileSync(_vPath, _vBuf)
    await new Promise((resolve, reject) => {
        require('child_process').exec(
            `ffmpeg -y -i "${_vPath}" -vn -acodec libmp3lame -ab 128k -ar 44100 "${_aPath}"`,
            { timeout: 120000 },
            (err, _so, se) => err ? reject(new Error(se || err.message)) : resolve()
        )
    })
    const _mp3 = require('fs').readFileSync(_aPath)
    await X.sendMessage(m.chat, {
        audio: _mp3, mimetype: 'audio/mpeg',
        fileName: `audio_${Date.now()}.mp3`
    }, { quoted: m })
    try { require('fs').unlinkSync(_vPath); require('fs').unlinkSync(_aPath) } catch {}
} catch(e) { reply(`❌ *tomp3 failed:* ${e.message}`) }
} break

case 'toppt':
case 'tovoice': {
    await X.sendMessage(m.chat, { react: { text: '🔊', key: m.key } })
// Convert any audio or video → WhatsApp voice note (ogg opus ptt)
const _qmime3 = m.quoted?.mimetype || m.quoted?.msg?.mimetype || ''
if (!m.quoted || !/audio|video/.test(_qmime3)) return reply(`🎤 *Reply to an audio or video* with *${prefix}toppt* to convert it to a voice note`)
try {
    await reply('🔄 _Converting to voice note..._')
    const _inBuf = await m.quoted.download()
    if (!_inBuf || _inBuf.length < 100) throw new Error('Media download failed')
    const _inExt = /video/.test(_qmime3) ? 'mp4' : 'mp3'
    const _inPath = require("path").join(__dirname, "tmp", `toppt_in_${Date.now()}.${_inExt}`)
    const _outPath = require("path").join(__dirname, "tmp", `toppt_out_${Date.now()}.ogg`)
    require('fs').writeFileSync(_inPath, _inBuf)
    await new Promise((resolve, reject) => {
        require('child_process').exec(
            `ffmpeg -y -i "${_inPath}" -vn -c:a libopus -b:a 64k -ar 48000 -ac 1 "${_outPath}"`,
            { timeout: 120000 },
            (err, _so, se) => err ? reject(new Error(se || err.message)) : resolve()
        )
    })
    const _ogg = require('fs').readFileSync(_outPath)
    await X.sendMessage(m.chat, {
        audio: _ogg, mimetype: 'audio/ogg; codecs=opus', ptt: true
    }, { quoted: m })
    try { require('fs').unlinkSync(_inPath); require('fs').unlinkSync(_outPath) } catch {}
} catch(e) { reply(`❌ *toppt failed:* ${e.message}`) }
} break

case 'removebg': {
    await X.sendMessage(m.chat, { react: { text: '✂️', key: m.key } })
if (!m.quoted || !/image/.test(m.quoted.mimetype || m.quoted.msg?.mimetype || '')) {
    return reply(`🖼️ *Reply to an image* with *${prefix}removebg* to remove its background`)
}
try {
    await reply('✂️ _Removing background, please wait..._')
    const _rBuf = await m.quoted.download()
    if (!_rBuf || _rBuf.length < 100) throw new Error('Could not download the image')
    let _result = null

    // ── Helper: download image from URL into Buffer ──────────────────
    const _dlImg = async (url) => {
        const _r = await fetch(url, { signal: AbortSignal.timeout(20000) })
        if (!_r.ok) throw new Error(`HTTP ${_r.status}`)
        return Buffer.from(await _r.arrayBuffer())
    }

    // ── Method 1: GiftedTech removebgv2 (returns JSON with result URL) ──
    if (!_result) {
        try {
            const _tmpG = require("path").join(__dirname, "tmp", `rbg_${Date.now()}.jpg`)
            require('fs').writeFileSync(_tmpG, _rBuf)
            const _catUrl = await CatBox(_tmpG)
            try { require('fs').unlinkSync(_tmpG) } catch {}
            if (_catUrl) {
                const _gtRes = await fetch(`https://api.giftedtech.co.ke/api/tools/removebgv2?apikey=${_giftedKey()}&url=${encodeURIComponent(_catUrl)}`, { signal: AbortSignal.timeout(45000) })
                const _ctype = _gtRes.headers.get('content-type') || ''
                if (_ctype.includes('image')) {
                    // Direct image response
                    _result = Buffer.from(await _gtRes.arrayBuffer())
                } else {
                    // JSON response — extract result URL and download it
                    const _gtJson = await _gtRes.json()
                    const _imgUrl = _gtJson?.result?.image_url || _gtJson?.result?.url || _gtJson?.result
                    if (_imgUrl && typeof _imgUrl === 'string' && _imgUrl.startsWith('http')) {
                        _result = await _dlImg(_imgUrl)
                    }
                }
            }
        } catch {}
    }

    // ── Method 2: Python rembg (local AI, no API limits) ─────────────
    if (!_result) {
        try {
            const _os = require('os'), _path = require('path'), _cp = require('child_process')
            const _inFile  = _path.join(_os.tmpdir(), `rbg_in_${Date.now()}.jpg`)
            const _outFile = _path.join(_os.tmpdir(), `rbg_out_${Date.now()}.png`)
            require('fs').writeFileSync(_inFile, _rBuf)
            // Install rembg if needed (quiet, user install)
            const _pyScript = `
import sys, subprocess
try:
    from rembg import remove
except ImportError:
    subprocess.run([sys.executable,'-m','pip','install','rembg','onnxruntime','--quiet','--user'], check=True)
    from rembg import remove
with open('${_inFile.replace(/\\/g,'/')}','rb') as f:
    data = f.read()
out = remove(data)
with open('${_outFile.replace(/\\/g,'/')}','wb') as f:
    f.write(out)
print('ok')
`
            await new Promise((res, rej) => {
                const _p = _cp.spawn('python3', ['-c', _pyScript], { timeout: 120000 })
                let _out = ''
                _p.stdout.on('data', d => _out += d)
                _p.on('close', code => code === 0 && _out.includes('ok') ? res() : rej(new Error('rembg failed')))
                _p.on('error', rej)
            })
            if (require('fs').existsSync(_outFile)) {
                _result = require('fs').readFileSync(_outFile)
            }
            try { require('fs').unlinkSync(_inFile); require('fs').unlinkSync(_outFile) } catch {}
        } catch {}
    }

    // ── Method 3: remove.bg (if API key configured) ──────────────────
    if (!_result) {
        const _rbKey = process.env.REMOVEBG_KEY || global.removebgKey || ''
        if (_rbKey) {
            try {
                const _fd = new FormData()
                _fd.append('image_file', _rBuf, { filename: 'image.jpg', contentType: 'image/jpeg' })
                _fd.append('size', 'auto')
                const _rbRes = await axios.post('https://api.remove.bg/v1.0/removebg', _fd, {
                    headers: { ..._fd.getHeaders(), 'X-Api-Key': _rbKey },
                    responseType: 'arraybuffer', timeout: 30000
                })
                if (_rbRes.status === 200) _result = Buffer.from(_rbRes.data)
            } catch {}
        }
    }

    // ── Method 4: Clipdrop (if key configured) ───────────────────────
    if (!_result) {
        const _cdKey = process.env.CLIPDROP_KEY || global.clipdropKey || ''
        if (_cdKey) {
            try {
                const _fd4 = new FormData()
                _fd4.append('image_file', _rBuf, { filename: 'image.jpg', contentType: 'image/jpeg' })
                const _cdRes = await axios.post('https://clipdrop-api.co/remove-background/v1', _fd4, {
                    headers: { ..._fd4.getHeaders(), 'x-api-key': _cdKey },
                    responseType: 'arraybuffer', timeout: 30000
                })
                if (_cdRes.status === 200) _result = Buffer.from(_cdRes.data)
            } catch {}
        }
    }

    if (!_result) throw new Error('Background removal failed. The service may be busy — please try again in a moment.')
    await X.sendMessage(m.chat, { image: _result, caption: '✅ *Background removed successfully!*\n_✂️ Powered by Juice v12_' }, { quoted: m })
} catch(e) { reply(`❌ *removebg failed:* ${e.message}`) }
} break

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🖼️  IMAGE ENHANCEMENT (Keith API)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
case 'hd':
case 'upscale': {
    await X.sendMessage(m.chat, { react: { text: '🔭', key: m.key } })
    if (!m.quoted) return reply('❌ *Reply to an image* to upscale/enhance it to HD quality.')
    if (!/image/.test(mime)) return reply('❌ *Reply to an image* to upscale/enhance it to HD quality.')
    try {
        await reply('🔭 _Enhancing image to HD... Please wait..._')
        const _hdBuf = await quoted.download()
        if (!_hdBuf || _hdBuf.length < 100) throw new Error('Failed to download image')
        let _hdOutUrl = null
        let _hdOutBuf = null
        // Source 1: waifu2x free API (no key required)
        try {
            const _fd = require('form-data')
            const _form = new _fd()
            _form.append('file', _hdBuf, { filename: 'image.jpg', contentType: 'image/jpeg' })
            const { data: _w } = await axios.post('https://api.deepai.org/api/waifu2x', _form, {
                headers: { ..._form.getHeaders(), 'api-key': 'quickstart-QUdJIGlzIGF3ZXNvbWU=' },
                timeout: 40000
            })
            if (_w?.output_url) _hdOutUrl = _w.output_url
        } catch {}
        // Source 2: Jimp 2× upscale (always works — no API needed)
        if (!_hdOutUrl) {
            try {
                const Jimp = require('jimp')
                const _img = await Jimp.read(_hdBuf)
                const _w2 = _img.getWidth(), _h2 = _img.getHeight()
                _img.resize(Math.min(_w2 * 2, 2048), Jimp.AUTO, Jimp.RESIZE_BICUBIC)
                _img.quality(95)
                _hdOutBuf = await _img.getBufferAsync(Jimp.MIME_JPEG)
            } catch (_je) { throw new Error('Image processing failed: ' + _je.message) }
        }
        if (_hdOutUrl) {
            await X.sendMessage(m.chat, { image: { url: _hdOutUrl }, caption: '✅ *Image enhanced to HD!*' }, { quoted: m })
        } else if (_hdOutBuf) {
            await X.sendMessage(m.chat, { image: _hdOutBuf, caption: '✅ *Image upscaled 2× with HD quality!*' }, { quoted: m })
        } else {
            throw new Error('Could not process image')
        }
    } catch(e) { reply(`❌ HD upscale failed: ${e.message}`) }
} break
case 'imageedit':
case 'imgfilter': {
    await X.sendMessage(m.chat, { react: { text: '🎨', key: m.key } })
    const _ieMsg = m.quoted || m
    const _ieMime = _ieMsg?.message?.imageMessage?.mimetype || ''
    if (!_ieMime.startsWith('image/')) return reply('❌ *Reply to an image* then use .imageedit [effect]\n\n*Effects:* grayscale | sepia | blur | sharpen | flip | rotate | vintage | bright | dark | cartoon')
    const _ieEffect = (q?.trim() || text?.trim() || 'enhance').toLowerCase()
    try {
        await reply(`🎨 _Applying ${_ieEffect} effect..._`)
        const _ieBuf = await X.downloadMediaMessage(_ieMsg)
        const _ieB64 = _ieBuf.toString('base64')
        const _ieRes = await fetch('https://apiskeith.top/images/edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: _ieB64, effect: _ieEffect }),
            signal: AbortSignal.timeout(40000)
        })
        const _ieData = await _ieRes.json()
        const _ieUrl = _ieData?.result?.url || _ieData?.url || _ieData?.imageUrl
        if (!_ieUrl) throw new Error('No edited image returned')
        await safeSendMedia(m.chat, { image: { url: _ieUrl }, caption: `🎨 *Effect:* ${_ieEffect}` }, {}, { quoted: m })
    } catch(e) { reply(`❌ Image edit failed: ${e.message}`) }
} break



//━━━━━━━━━━━━━━━━━━━━━━━━//
// Game Commands
case 'tictactoe':
case 'ttt': {
    await X.sendMessage(m.chat, { react: { text: '❎', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
let tttUser = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : null
if (!tttUser) return reply(`╔═══〔 ❎ TIC TAC TOE 〕═══╗\n\n║ Usage: *${prefix}ttt @opponent*\n║ Mention the user you want to play against\n╚═══════════════════════╝`)
if (tttUser === sender) return reply('╔══〔 ⚠️ GAME 〕══╗\n\n║ You cannot play against yourself!\n╚═══════════════════════╝')
if (!global.tttGames) global.tttGames = {}
let gameId = m.chat
if (global.tttGames[gameId]) return reply('╔══〔 ⚠️ TIC-TAC-TOE 〕══╗\n\n║ A game is already in progress.\n║ Use .tttend to end it.\n╚═══════════════════════╝')
global.tttGames[gameId] = { board: [' ',' ',' ',' ',' ',' ',' ',' ',' '], players: { X: sender, O: tttUser }, turn: 'X' }
let boardDisplay = (b) => `\n ${b[0]} | ${b[1]} | ${b[2]}\n---+---+---\n ${b[3]} | ${b[4]} | ${b[5]}\n---+---+---\n ${b[6]} | ${b[7]} | ${b[8]}\n`
X.sendMessage(from, { text: `*Tic Tac Toe*\n\n@${sender.split('@')[0]} (X) vs @${tttUser.split('@')[0]} (O)\n\n${boardDisplay(global.tttGames[gameId].board)}\n\n@${sender.split('@')[0]}'s turn (X)\nReply with a number (1-9) to place your mark.`, mentions: [sender, tttUser] }, { quoted: m })
} break

case 'tttend': {
    await X.sendMessage(m.chat, { react: { text: '🏁', key: m.key } })
if (!global.tttGames || !global.tttGames[m.chat]) return reply('╔══〔 ⚠️ GAME 〕══╗\n\n║ No game in progress.\n╚═══════════════════════╝')
delete global.tttGames[m.chat]
reply('╔══〔 🎮 GAME 〕══╗\n\n║ Game ended.\n╚═══════════════════════╝')
} break

case 'connect4':
case 'c4': {
    await X.sendMessage(m.chat, { react: { text: '🔴', key: m.key } })
reply(`╔═══〔 🔴 CONNECT 4 〕════╗\n\n║ 🔴🟡🔴🟡🔴🟡🔴\n║ ⬜⬜⬜⬜⬜⬜⬜\n║ ⬜⬜⬜⬜⬜⬜⬜\n║ ⬜⬜⬜⬜⬜⬜⬜\n║ ⬜⬜⬜⬜⬜⬜⬜\n║ ⬜⬜⬜⬜⬜⬜⬜\n\n║ 🎮 *Not yet available as a live game.*\n║ Play Tic Tac Toe instead:\n║ *${prefix}ttt* — start a game now!\n╚═══════════════════════╝`)
} break

case 'hangman': {
    await X.sendMessage(m.chat, { react: { text: '🎯', key: m.key } })
if (!global.hangmanGames) global.hangmanGames = {}
if (global.hangmanGames[m.chat]) return reply('╔══〔 ⚠️ HANGMAN 〕══╗\n\n║ A game is already in progress.\n║ Use .hangmanend to end it.\n╚═══════════════════════╝')
let words = ['javascript', 'python', 'programming', 'computer', 'algorithm', 'database', 'internet', 'software', 'hardware', 'keyboard', 'function', 'variable', 'boolean', 'whatsapp', 'telegram', 'android', 'network', 'security', 'elephant', 'universe']
let word = words[Math.floor(Math.random() * words.length)]
global.hangmanGames[m.chat] = { word, guessed: [], lives: 6, players: [sender] }
let display = word.split('').map(l => '_').join(' ')
reply(`╔════〔 🪢 HANGMAN 〕═════╗\n\n║ ${display}\n\n║ ❤️  Lives : 6\n║ 🔡 Letters : ${word.length}\n\n║ _Send a single letter to guess!_\n╚═══════════════════════╝`)
} break

case 'hangmanend': {
    await X.sendMessage(m.chat, { react: { text: '🏁', key: m.key } })
if (!global.hangmanGames || !global.hangmanGames[m.chat]) return reply('╔══〔 ⚠️ HANGMAN 〕══╗\n\n║ No hangman game in progress.\n╚═══════════════════════╝')
reply(`╔═══〔 🏁 GAME ENDED 〕═══╗\n\n║ 🔡 *Word* : *${global.hangmanGames[m.chat].word}*\n╚═══════════════════════╝`)
delete global.hangmanGames[m.chat]
} break

case 'trivia': {
    await X.sendMessage(m.chat, { react: { text: '🧠', key: m.key } })
try {
let res = await fetch('https://opentdb.com/api.php?amount=1&type=multiple')
let data = await res.json()
if (!data.results || !data.results.length) return reply('Failed to fetch trivia.')
let q = data.results[0]
let answers = [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5)
let decode = (str) => str.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#039;/g,"'")
if (!global.triviaGames) global.triviaGames = {}
global.triviaGames[m.chat] = { answer: decode(q.correct_answer).toLowerCase(), timeout: setTimeout(() => { if (global.triviaGames[m.chat]) { reply(`⏰ *Time up!*  The answer was: *${decode(q.correct_answer)}*`); delete global.triviaGames[m.chat] } }, 30000) }
let qText = `*Trivia (${decode(q.category)})*\nDifficulty: ${q.difficulty}\n\n${decode(q.question)}\n\n`
answers.forEach((a, i) => qText += `${String.fromCharCode(65+i)}. ${decode(a)}\n`)
qText += `\nAnswer within 30 seconds!`
reply(qText)
} catch(e) { reply('Error: ' + e.message) }
} break

case 'bored':
case 'activity': {
    await X.sendMessage(m.chat, { react: { text: '🎲', key: m.key } })
    try {
        // Bored API — completely free
        let _br = await fetch('https://bored-api.appbrewery.com/random')
        let _brd = await _br.json()
        let _act = _brd?.activity || _brd?.activity?.activity
        if (!_act) throw new Error('No activity')
        let typeIcon = { education: '📚', recreational: '🎮', social: '👥', diy: '🔨', charity: '💝', cooking: '🍳', relaxation: '🛌', music: '🎵', busywork: '💻' }
        let icon = typeIcon[_brd.type] || '🎲'
        let msg = `╬══〔 ${icon} ACTIVITY SUGGESTION 〕══╬\n\n║ 📍 *Activity:* ${_act}\n║ 🏷️ *Type:* ${_brd.type || 'Fun'}\n║ 👥 *Participants:* ${_brd.participants || 1}\n║ 💰 *Price:* ${(_brd.price === 0 ? 'Free' : '$' + _brd.price) || 'Free'}\n║ 📊 *Accessibility:* ${Math.round((1 - (_brd.accessibility || 0)) * 100)}% easy\n╚═══════════════════════╝`
        await reply(msg)
    } catch { reply('❌ Could not find an activity right now. Try again!') }
} break

case 'dadjoke':
case 'dj': {
    await X.sendMessage(m.chat, { react: { text: '🤣', key: m.key } })
    try {
        // icanhazdadjoke — free, no key
        let _dj = await fetch('https://icanhazdadjoke.com/', { headers: { 'Accept': 'application/json' } })
        let _djd = await _dj.json()
        if (!_djd.joke) throw new Error('No joke')
        await reply(`🤭 *Dad Joke of the Day*\n\n_${_djd.joke}_\n\n🤣 hehe`)
    } catch {
        const _djs = ['Why don\'t scientists trust atoms? Because they make up everything!', 'I\'m reading a book about anti-gravity. It\'s impossible to put down!', 'Why did the math book look so sad? Because it had too many problems.', 'What do you call cheese that isn\'t yours? Nacho cheese!', 'Why can\'t you give Elsa a balloon? Because she\'ll let it go!']
        await reply(`🤭 *Dad Joke*\n\n_${_djs[Math.floor(Math.random() * _djs.length)]}_\n\n🤣 hehe`)
    }
} break

case 'compliment': {
    await X.sendMessage(m.chat, { react: { text: '💜', key: m.key } })
    try {
        // complimentr — free, no key
        let _cr = await fetch('https://complimentr.com/api')
        let _crd = await _cr.json()
        let _cmpl = _crd.compliment
        if (!_cmpl) throw new Error('No compliment')
        let _mention = (m.mentionedJid && m.mentionedJid[0]) ? `@${m.mentionedJid[0].split('@')[0]}` : 'you'
        await reply(`💜 *Compliment for ${_mention}:*\n\n_${_cmpl}_\n\n✨ Have a wonderful day!`, m.mentionedJid || [])
    } catch {
        const _cmpls = ['You have an incredible heart.', 'Your smile lights up the room.', 'You make everything better just by being here.', 'You are stronger than you think.', 'The world is better with you in it.']
        let _mention = (m.mentionedJid && m.mentionedJid[0]) ? `@${m.mentionedJid[0].split('@')[0]}` : 'you'
        await reply(`💜 *Compliment for ${_mention}:*\n\n_${_cmpls[Math.floor(Math.random() * _cmpls.length)]}_\n\n✨ Have a wonderful day!`, m.mentionedJid || [])
    }
} break


case 'advice':
case 'advise': {
    await X.sendMessage(m.chat, { react: { text: '💡', key: m.key } })
    try {
        // adviceslip.com — free, no key
        let _ar = await fetch('https://api.adviceslip.com/advice')
        let _ad = await _ar.json()
        let _advice = _ad?.slip?.advice
        if (!_advice) throw new Error('No advice')
        await reply(`💡 *Daily Advice*\n\n_“${_advice}”_\n\n✨ Hope that helps!`)
    } catch {
        const _advs = ['“Do small things with great love.”', '“Persistence is the key to success.”', '“Kindness is free — sprinkle it everywhere.”', '“Be the change you wish to see in the world.”', '“Every day is a new opportunity to grow.”']
        await reply(`💡 *Advice*\n\n_${_advs[Math.floor(Math.random() * _advs.length)]}_\n\n✨ Hope that helps!`)
    }
} break

case 'numberfact':
case 'numfact': {
    await X.sendMessage(m.chat, { react: { text: '🔢', key: m.key } })
    let _num = parseInt(text) || Math.floor(Math.random() * 1000)
    try {
        // numbersapi.com — free, no key
        let _nr = await fetch(`http://numbersapi.com/${_num}/trivia?json`)
        let _nd = await _nr.json()
        let _nf = _nd.text
        if (!_nf) throw new Error('No fact')
        await reply(`🔢 *Fact about ${_num}*\n\n_${_nf}_`)
    } catch { reply(`🔢 *Fact about ${_num}*\n\n_${_num} is ${_num % 2 === 0 ? 'an even' : 'an odd'} number with ${_num.toString().length} digit(s)._`) }
} break

case 'answer': {
    await X.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
let userAnswer = text?.toLowerCase().trim()
if (!userAnswer) return reply('❌ Please provide your answer. Example: *' + prefix + 'answer Paris*')
// Handle tebakld game
if (global.tebakldGames && global.tebakldGames[m.chat]) {
  let tg = global.tebakldGames[m.chat]
  if (userAnswer === tg.answer) {
    clearTimeout(tg.timeout)
    delete global.tebakldGames[m.chat]
    return reply(`╔══〔 ✅ CORRECT! 〕════════╗
║ 🎉 Well done, @${sender.split('@')[0]}!
║ 🗺️ *Answer:* ${tg.answer.charAt(0).toUpperCase() + tg.answer.slice(1)}
╚═══════════════════════╝`)
  } else {
    return reply(`❌ *Wrong!* Try again or wait for time to run out.`)
  }
}
// Handle tebak game
if (global.tebakGame && global.tebakGame[m.chat]) {
  let tg2 = global.tebakGame[m.chat]
  if (userAnswer === (tg2.answer || tg2.jawaban || '').toLowerCase()) {
    clearTimeout(tg2.timeout)
    delete global.tebakGame[m.chat]
    return reply(`╔══〔 ✅ CORRECT! 〕════════╗
║ 🎉 Well done, @${sender.split('@')[0]}!
╚═══════════════════════╝`)
  } else return reply(`❌ *Wrong!* Try again.`)
}
// Handle trivia
if (!global.triviaGames || !global.triviaGames[m.chat]) return reply('╔══〔 ⚠️ TRIVIA 〕══╗\n\n║ No active game.\n║ Use .trivia or .tebak to start.\n╚═══════════════════════╝')
if (userAnswer === global.triviaGames[m.chat].answer || userAnswer === global.triviaGames[m.chat].answer.charAt(0)) {
clearTimeout(global.triviaGames[m.chat].timeout)
delete global.triviaGames[m.chat]
reply(`╔══〔 ✅ CORRECT! 〕════════╗
║ 🎉 Well done, @${sender.split('@')[0]}!
╚═══════════════════════╝`)
} else reply(`❌ *Wrong!* Try again or wait for timeout.`)
} break

case 'truth': {
    await X.sendMessage(m.chat, { react: { text: '💬', key: m.key } })
    if (m.isGroup && global.antiSocialGames && global.antiSocialGames[m.chat]) return reply(`❌ *Social games are disabled in this group.*`)
let truths = ['What is your biggest fear?', 'What is the most embarrassing thing you have done?', 'What is a secret you have never told anyone?', 'Who was your first crush?', 'What is the worst lie you have told?', 'What is your guilty pleasure?', 'Have you ever cheated on a test?', 'What is the most childish thing you still do?', 'What is your biggest insecurity?', 'What was your most awkward date?', 'Have you ever been caught lying?', 'What is the craziest thing on your bucket list?', 'What is the weirdest dream you have had?', 'If you could be invisible for a day what would you do?', 'What is the most stupid thing you have ever done?']
let _truthQ = null
try {
  let _kr = await fetch('https://apiskeith.top/fun/truth', { signal: AbortSignal.timeout(8000) })
  let _kd = await _kr.json()
  if (_kd.status && _kd.result) _truthQ = typeof _kd.result === 'string' ? _kd.result : JSON.stringify(_kd.result)
} catch {}
if (!_truthQ) _truthQ = truths[Math.floor(Math.random() * truths.length)]
reply(`╔══〔 💬 TRUTH QUESTION 〕═╗\n║ ❓ ${_truthQ}\n╚═══════════════════════╝`)
} break

case 'dare': {
    await X.sendMessage(m.chat, { react: { text: '🎯', key: m.key } })
    if (m.isGroup && global.antiSocialGames && global.antiSocialGames[m.chat]) return reply(`❌ *Social games are disabled in this group.*`)
let dares = ['Send a voice note singing your favorite song.', 'Change your profile picture to something funny for 1 hour.', 'Send the last photo in your gallery.', 'Text your crush right now.', 'Do 10 pushups and send a video.', 'Send a voice note doing your best animal impression.', 'Let someone else send a message from your phone.', 'Share your screen time report.', 'Send a selfie right now without filters.', 'Call the 5th person in your contacts and sing happy birthday.', 'Post a childhood photo in the group.', 'Let the group choose your status for 24 hours.', 'Send a voice note speaking in an accent.', 'Do a handstand and send proof.', 'Type with your eyes closed for the next message.']
let _dareQ = null
try {
  let _kr2 = await fetch('https://apiskeith.top/fun/dare', { signal: AbortSignal.timeout(8000) })
  let _kd2 = await _kr2.json()
  if (_kd2.status && _kd2.result) _dareQ = typeof _kd2.result === 'string' ? _kd2.result : JSON.stringify(_kd2.result)
} catch {}
if (!_dareQ) _dareQ = dares[Math.floor(Math.random() * dares.length)]
reply(`╔══〔 🔥 DARE CHALLENGE 〕══╗\n║ 🎯 ${_dareQ}\n╚═══════════════════════╝`)
} break

  case 'paranoia': {
      await X.sendMessage(m.chat, { react: { text: '😱', key: m.key } })
      try {
          const _pnd = await _keithFetch('/fun/paranoia')
          const _pntxt = typeof _pnd === 'string' ? _pnd : (_pnd?.result || _pnd?.question)
          if (!_pntxt) throw new Error('No question')
          await reply(`╌══〔 😱 PARANOIA 〕══════╌\n\n💬 _Someone just whispered a question about you..._\n\n❓ *${_pntxt}*\n\n🙄 _Only your neighbors know the answer!_\n╚═══════════════════════╝`)
      } catch(e) { reply('❌ Could not get a paranoia question. Try again!') }
  } break

  case 'nhie':
  case 'neverhaveiever': {
      await X.sendMessage(m.chat, { react: { text: '🙅', key: m.key } })
      try {
          const _nhd = await _keithFetch('/fun/never-have-i-ever')
          const _nhtxt = typeof _nhd === 'string' ? _nhd : (_nhd?.result || _nhd?.statement)
          if (!_nhtxt) throw new Error('No statement')
          await reply(`╌══〔 🙅 NEVER HAVE I EVER 〕═╌\n\n✋ _Raise your hand if you have..._\n\n💬 *Never have I ever ${_nhtxt}*\n\n🤫 _Who has done this? React below!_\n╚═══════════════════════╝`)
      } catch(e) { reply('❌ Could not get a NHIE statement. Try again!') }
  } break

  case 'question': {
      await X.sendMessage(m.chat, { react: { text: '🧩', key: m.key } })
      try {
          const _trd = await _keithFetch('/fun/question')
          const _trq = _trd?.question || _trd?.result?.question
          const _tca = _trd?.correctAnswer || _trd?.result?.correctAnswer
          const _tcat = _trd?.category || _trd?.result?.category || 'General'
          if (!_trq) throw new Error('No question')
          await reply(`╌══〔 🧩 TRIVIA 〕════════╌\n\n📚 *Category:* ${_tcat}\n\n❓ *${_trq}*\n\n💡 _Reply with your answer! Correct answer will be revealed!_\n🟢 *Answer:* ||${_tca}||\n╚═══════════════════════╝`)
      } catch(e) { reply('❌ Could not fetch a trivia question. Try again!') }
  } break


case '8ball': {
    await X.sendMessage(m.chat, { react: { text: '🎱', key: m.key } })
if (!text) return reply(`╔══〔 🎱 MAGIC 8-BALL 〕══╗\n\n║ Usage: *${prefix}8ball [your question]*\n║ Example: ${prefix}8ball Will I pass my exam?\n╚═══════════════════════╝`)
let responses8 = ['It is certain.', 'It is decidedly so.', 'Without a doubt.', 'Yes definitely.', 'You may rely on it.', 'As I see it, yes.', 'Most likely.', 'Outlook good.', 'Yes.', 'Signs point to yes.', 'Reply hazy, try again.', 'Ask again later.', 'Better not tell you now.', 'Cannot predict now.', 'Concentrate and ask again.', 'Don\'t count on it.', 'My reply is no.', 'My sources say no.', 'Outlook not so good.', 'Very doubtful.']
reply(`╔══〔 🎱 MAGIC 8-BALL 〕══╗\n\n║ ❓ *${text}*\n\n║ 🎱 ${responses8[Math.floor(Math.random() * responses8.length)]}\n╚═══════════════════════╝`)
} break

case 'cf':
case 'coinflip':
case 'flip': {
    await X.sendMessage(m.chat, { react: { text: '🪙', key: m.key } })
let coin = Math.random() < 0.5 ? 'Heads' : 'Tails'
reply(`╔══〔 🪙 COIN FLIP 〕══════╗\n║ Result: *${coin}!*\n╚═══════════════════════╝`)
} break

case 'dice':
case 'roll': {
    await X.sendMessage(m.chat, { react: { text: '🎲', key: m.key } })
let sides = parseInt(args[0]) || 6
let result = Math.floor(Math.random() * sides) + 1
reply(`╔══〔 🎲 DICE ROLL 〕══════╗\n║ 🎲 d${sides} → *${result}*\n╚═══════════════════════╝`)
} break

case 'rps': {
    await X.sendMessage(m.chat, { react: { text: '✊', key: m.key } })
let choices = ['rock', 'paper', 'scissors']
let userChoice = (args[0] || '').toLowerCase()
if (!['rock', 'paper', 'scissors', 'r', 'p', 's'].includes(userChoice)) return reply(`╔══〔 ✊ ROCK PAPER SCISSORS 〕══╗\n\n║ Usage: *${prefix}rps rock/paper/scissors*\n║ Shorthand: r / p / s\n╚═══════════════════════╝`)
if (userChoice === 'r') userChoice = 'rock'
if (userChoice === 'p') userChoice = 'paper'
if (userChoice === 's') userChoice = 'scissors'
let botChoice = choices[Math.floor(Math.random() * 3)]
let rpsResult = userChoice === botChoice ? 'Draw!' : (userChoice === 'rock' && botChoice === 'scissors') || (userChoice === 'paper' && botChoice === 'rock') || (userChoice === 'scissors' && botChoice === 'paper') ? 'You win! 🎉' : 'You lose! 😢'
reply(`╔══〔 ✂️  ROCK PAPER SCISSORS 〕══╗\n\n║ 👤 *You* : ${userChoice}\n║ 🤖 *Bot* : ${botChoice}\n║ 🏆 *${rpsResult}*\n╚═══════════════════════╝`)
} break

case 'slot': {
    await X.sendMessage(m.chat, { react: { text: '🎰', key: m.key } })
let symbols = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣', '🔔']
let s1 = symbols[Math.floor(Math.random() * symbols.length)]
let s2 = symbols[Math.floor(Math.random() * symbols.length)]
let s3 = symbols[Math.floor(Math.random() * symbols.length)]
let slotWin = s1 === s2 && s2 === s3 ? '🎉 JACKPOT! You won!' : s1 === s2 || s2 === s3 || s1 === s3 ? '😃 Two match! Small win!' : '😢 No match. Try again!'
reply(`╔══〔 🎰 SLOT MACHINE 〕══╗\n\n║ [ ${s1} | ${s2} | ${s3} ]\n\n║ ${slotWin}\n╚═══════════════════════╝`)
} break

//━━━━━━━━━━━━━━━━━━━━━━━━//
// Fun & Social Commands
case 'insult': {
    await X.sendMessage(m.chat, { react: { text: '🗡️', key: m.key } })
    try {
        let _inTxt = null
        const _inkd = await _keithFetch('/fun/insult')
        if (typeof _inkd === 'string') _inTxt = _inkd; else if (_inkd?.insult) _inTxt = _inkd.insult; else if (_inkd?.result) _inTxt = typeof _inkd.result === 'string' ? _inkd.result : _inkd.result?.insult
        if (!_inTxt) {
            let _ingr = await fetch(`https://api.giftedtech.co.ke/api/fun/insult?apikey=${_giftedKey()}`, { signal: AbortSignal.timeout(10000) })
            let _ingd = await _ingr.json()
            if (_ingd.success && _ingd.result) _inTxt = _ingd.result
        }
        if (!_inTxt) throw new Error('No insult')
        const _inTarget = m.quoted?.pushName || mentioned[0] && store.contacts[mentioned[0]]?.name || sender.split('@')[0]
        await reply(`╌══〔 🗡️ INSULT 〕════════╌\n\n@${_inTarget} 👇\n\n_${_inTxt}_\n\n╚═══════════════════════╝`)
    } catch(e) { reply('❌ Could not generate insult. Try again!') }
} break

  case 'story':
  case 'tellstory':
  case 'generatestory': {
      await X.sendMessage(m.chat, { react: { text: '📖', key: m.key } })
      if (!text) return reply(`╔══〔 📖 STORY GENERATOR 〕══╗\n\n║ Usage: *${prefix}story [topic or theme]*\n║ Example: ${prefix}story a hero saves the world\n╚═══════════════════════╝`)
      try {
          await reply('📖 _Writing your story, please wait..._')
          let _epS = await fetch(`https://eliteprotech-apis.zone.id/story?text=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(30000) })
          let _epSd = await _epS.json()
          if (_epSd.success && _epSd.story) {
              let _storyText = _epSd.story
              let _header = `╔════〔 📖 AI STORY 〕════╗\n\n\n╚═══════════════════════╝`
              // Split long stories into chunks of 3500 chars
              if (_storyText.length <= 3500) {
                  await reply(_header + _storyText)
              } else {
                  await reply(_header + _storyText.slice(0, 3500) + '...')
                  for (let _i = 3500; _i < _storyText.length; _i += 3500) {
                      await reply(_storyText.slice(_i, _i + 3500))
                  }
              }
          } else {
              reply('❌ Could not generate story. Please try again.')
          }
      } catch(e) { reply('❌ Story generation failed: ' + e.message) }
  } break
  

case 'flirt': {
    await X.sendMessage(m.chat, { react: { text: '😏', key: m.key } })
let flirts = ['Are you a magician? Because whenever I look at you, everyone else disappears.', 'Do you have a map? I keep getting lost in your eyes.', 'Are you a campfire? Because you are hot and I want s\'more.', 'Is your name Google? Because you have everything I have been searching for.', 'Do you believe in love at first sight, or should I walk by again?', 'If beauty were time, you would be an eternity.']
reply(`╔═════〔 💘 FLIRT 〕══════╗\n\n║ ${flirts[Math.floor(Math.random() * flirts.length)]}\n╚═══════════════════════╝`)
} break

case 'shayari': {
    await X.sendMessage(m.chat, { react: { text: '✨', key: m.key } })
try {
    let _gs = await fetch(`https://api.giftedtech.co.ke/api/fun/shayari?apikey=${_giftedKey()}`, { signal: AbortSignal.timeout(10000) })
    let _gsd = await _gs.json()
    if (_gsd.success && _gsd.result) return reply(`╔════〔 📜 SHAYARI 〕═════╗\n\n║ ${_gsd.result}\n╚═══════════════════════╝`)
} catch {}
let shayaris = ['Dil mein tere liye jagah hai,\nPar tu door hai, yeh kya wajah hai.', 'Teri yaad mein hum pagal hue,\nDuniya se hum bekhabar hue.', 'Mohabbat ka koi mol nahi,\nDil hai yeh koi phool nahi.', 'Zindagi mein teri kami hai,\nHar khushi adhuri si hai.', 'Tere bina zindagi se koi shikwa nahi,\nTere bina zindagi hai toh kya.']
reply(`╔════〔 📜 SHAYARI 〕═════╗\n\n║ ${shayaris[Math.floor(Math.random() * shayaris.length)]}\n╚═══════════════════════╝`)
} break

case 'goodnight': {
    await X.sendMessage(m.chat, { react: { text: '🌙', key: m.key } })
try {
    let _ggn = await fetch(`https://api.giftedtech.co.ke/api/fun/goodnight?apikey=${_giftedKey()}`, { signal: AbortSignal.timeout(10000) })
    let _ggnd = await _ggn.json()
    if (_ggnd.success && _ggnd.result) return reply(`╔═══〔 🌙 GOOD NIGHT 〕═══╗\n\n║ ${_ggnd.result}\n╚═══════════════════════╝`)
} catch {}
let gn = ['Sweet dreams! May tomorrow bring you joy. 🌙', 'Good night! Sleep tight and don\'t let the bugs bite! 💤', 'Wishing you a peaceful night full of beautiful dreams. ✨', 'Close your eyes and let the stars guide your dreams. 🌟', 'Good night! Tomorrow is a new opportunity. Rest well! 😴']
reply(`╔═══〔 🌙 GOOD NIGHT 〕═══╗\n\n║ ${gn[Math.floor(Math.random() * gn.length)]}\n╚═══════════════════════╝`)
} break

case 'roseday': {
    await X.sendMessage(m.chat, { react: { text: '🌹', key: m.key } })
try {
    let _gr = await fetch(`https://api.giftedtech.co.ke/api/fun/roseday?apikey=${_giftedKey()}`, { signal: AbortSignal.timeout(10000) })
    let _grd = await _gr.json()
    if (_grd.success && _grd.result) return reply(`╔════〔 🌹 ROSE DAY 〕════╗\n\n║ ${_grd.result}\n╚═══════════════════════╝`)
} catch {}
reply('🌹 *Happy Rose Day!* 🌹\nRoses are red, violets are blue, sending this beautiful rose just for you! May your day be as beautiful as a garden full of roses.')
} break

case 'character': {
    await X.sendMessage(m.chat, { react: { text: '🎌', key: m.key } })
let characters = ['Naruto Uzumaki', 'Goku', 'Luffy', 'Batman', 'Spider-Man', 'Iron Man', 'Sherlock Holmes', 'Harry Potter', 'Pikachu', 'Mario', 'Sonic', 'Link (Zelda)', 'Levi Ackerman', 'Tanjiro Kamado', 'Eren Yeager', 'Gojo Satoru']
reply(`╔══〔 🎭 RANDOM CHARACTER 〕══╗\n\n║ ${characters[Math.floor(Math.random() * characters.length)]}\n╚═══════════════════════╝`)
} break

case 'ship': {
    await X.sendMessage(m.chat, { react: { text: '💑', key: m.key } })
    if (m.isGroup && global.antiSocialGames && global.antiSocialGames[m.chat]) return reply(`❌ *Social games are disabled in this group.*`)
if (!m.isGroup) return reply(mess.OnlyGrup)
let members = participants.map(p => p.id)
let p1 = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : members[Math.floor(Math.random() * members.length)]
let p2 = m.mentionedJid && m.mentionedJid[1] ? m.mentionedJid[1] : members[Math.floor(Math.random() * members.length)]
let shipPercent = Math.floor(Math.random() * 101)
let bar = '█'.repeat(Math.floor(shipPercent/10)) + '░'.repeat(10 - Math.floor(shipPercent/10))
X.sendMessage(from, { text: `*💕 Love Ship 💕*\n\n@${p1.split('@')[0]} ❤️ @${p2.split('@')[0]}\n\n[${bar}] ${shipPercent}%\n\n${shipPercent > 80 ? 'Perfect match! 💕' : shipPercent > 50 ? 'Good chemistry! 💖' : shipPercent > 30 ? 'There is potential! 💛' : 'Not meant to be... 💔'}`, mentions: [p1, p2] }, { quoted: m })
} break

case 'simp': {
    await X.sendMessage(m.chat, { react: { text: '😍', key: m.key } })
    if (m.isGroup && global.antiSocialGames && global.antiSocialGames[m.chat]) return reply(`❌ *Social games are disabled in this group.*`)
let simpTarget = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : sender
let simpLevel = Math.floor(Math.random() * 101)
X.sendMessage(from, { text: `*Simp Meter:*\n@${simpTarget.split('@')[0]}\n\n${'🟩'.repeat(Math.floor(simpLevel/10))}${'⬜'.repeat(10 - Math.floor(simpLevel/10))} ${simpLevel}%\n\n${simpLevel > 80 ? 'MAXIMUM SIMP! 😂' : simpLevel > 50 ? 'Moderate simp 😏' : 'Not a simp 😎'}`, mentions: [simpTarget] }, { quoted: m })
} break

case 'wasted': {
    await X.sendMessage(m.chat, { react: { text: '💀', key: m.key } })
    if (m.isGroup && global.antiSocialGames && global.antiSocialGames[m.chat]) return reply(`❌ *Social games are disabled in this group.*`)
let wastedTarget = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : sender
X.sendMessage(from, { text: `*WASTED*\n\n@${wastedTarget.split('@')[0]} is WASTED 💀\n\nR.I.P.`, mentions: [wastedTarget] }, { quoted: m })
} break

case 'stupid':
case 'iq': {
    await X.sendMessage(m.chat, { react: { text: '🧠', key: m.key } })
    if (m.isGroup && global.antiSocialGames && global.antiSocialGames[m.chat]) return reply(`❌ *Social games are disabled in this group.*`)
let iqTarget = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : sender
let iqScore = Math.floor(Math.random() * 80) + 70
const iqMsg = iqScore > 130 ? 'Genius level! 🧠💡' : iqScore > 110 ? 'Above average mind 🎓' : iqScore > 90 ? 'Average intelligence 😊' : 'Room to grow! 📚'
X.sendMessage(from, { text: `╔════〔 🧠 IQ METER 〕════╗\n\n║ 👤 @${iqTarget.split('@')[0]}\n\n║ ${'🧠'.repeat(Math.min(10,Math.floor(iqScore/15)))}${'⬜'.repeat(10 - Math.min(10,Math.floor(iqScore/15)))} *IQ: ${iqScore}*\n\n║ _${iqMsg}_\n╚═══════════════════════╝`, mentions: [iqTarget] }, { quoted: m })
} break

case 'joke':
case 'jokes': {
    await X.sendMessage(m.chat, { react: { text: '😂', key: m.key } })
    try {
        let _jkTxt = null
        // Keith API first
        const _jkkd = await _keithFetch('/fun/jokes')
        if (_jkkd?.setup && _jkkd?.punchline) _jkTxt = `*${_jkkd.setup}*\n\n${_jkkd.punchline}`
        else if (_jkkd?.result?.setup) _jkTxt = `*${_jkkd.result.setup}*\n\n${_jkkd.result.punchline}`
        else if (typeof _jkkd === 'string') _jkTxt = _jkkd
        // GiftedTech fallback
        if (!_jkTxt) {
            let _jkgr = await fetch(`https://api.giftedtech.co.ke/api/fun/joke?apikey=${_giftedKey()}`, { signal: AbortSignal.timeout(10000) })
            let _jkgd = await _jkgr.json()
            if (_jkgd.success && _jkgd.result) _jkTxt = _jkgd.result
        }
        if (!_jkTxt) throw new Error('No joke')
        await reply(`╌══〔 😂 JOKE OF THE DAY 〕══╌\n\n${_jkTxt}\n\n😄 _Haha!_\n╚═══════════════════════╝`)
    } catch(e) { reply('❌ Could not fetch a joke. Try again!') }
} break

case 'quote':
case 'motivation': {
    await X.sendMessage(m.chat, { react: { text: '💪', key: m.key } })
    try {
        let _qtText = null, _qtAuthor = null
        // Keith API first
        const _qtkd = await _keithFetch('/fun/quote')
        if (_qtkd?.quote) { _qtText = _qtkd.quote; _qtAuthor = _qtkd.author || 'Unknown' }
        else if (_qtkd?.result?.quote) { _qtText = _qtkd.result.quote; _qtAuthor = _qtkd.result.author || 'Unknown' }
        else if (typeof _qtkd === 'string') { _qtText = _qtkd; _qtAuthor = 'Unknown' }
        // Local fallback
        if (!_qtText) {
            const _localQts = [
                { q: 'The secret of getting ahead is getting started.', a: 'Mark Twain' },
                { q: 'It always seems impossible until it is done.', a: 'Nelson Mandela' },
                { q: 'The harder you work, the luckier you get.', a: 'Gary Player' },
                { q: 'Success is not final, failure is not fatal.', a: 'Winston Churchill' },
                { q: 'Believe you can and you are halfway there.', a: 'Theodore Roosevelt' },
                { q: 'Your time is limited, don\'t waste it living someone else\'s life.', a: 'Steve Jobs' },
                { q: 'Do what you can, with what you have, where you are.', a: 'Theodore Roosevelt' },
                { q: 'Strive not to be a success, but rather to be of value.', a: 'Albert Einstein' },
                { q: 'The only way to do great work is to love what you do.', a: 'Steve Jobs' },
                { q: 'In the middle of every difficulty lies opportunity.', a: 'Albert Einstein' },
            ]
            const _lq = _localQts[Math.floor(Math.random() * _localQts.length)]
            _qtText = _lq.q; _qtAuthor = _lq.a
        }
        await reply(`╌══〔 💫 QUOTE 〕══════════╌\n\n❝ ${_qtText} ❞\n\n— *${_qtAuthor}*\n╚═══════════════════════╝`)
    } catch(e) {
        reply('╌══〔 💫 QUOTE 〕══════════╌\n\n❝ The secret of getting ahead is getting started. ❞\n\n— *Mark Twain*\n╚═══════════════════════╝')
    }
} break

case 'fact':
case 'randomfact': {
    await X.sendMessage(m.chat, { react: { text: '🧠', key: m.key } })
    try {
        let _ftTxt = null
        // Keith API first
        const _ftkd = await _keithFetch('/fun/fact')
        if (typeof _ftkd === 'string') _ftTxt = _ftkd; else if (_ftkd?.fact) _ftTxt = _ftkd.fact; else if (_ftkd?.result) _ftTxt = typeof _ftkd.result === 'string' ? _ftkd.result : _ftkd.result.fact
        // GiftedTech fallback
        if (!_ftTxt) {
            let _ftgr = await fetch(`https://api.giftedtech.co.ke/api/fun/fact?apikey=${_giftedKey()}`, { signal: AbortSignal.timeout(10000) })
            let _ftgd = await _ftgr.json()
            if (_ftgd.success && _ftgd.result) _ftTxt = _ftgd.result
        }
        if (!_ftTxt) throw new Error('No fact')
        await reply(`╌══〔 🧠 RANDOM FACT 〕════╌\n\n💡 _${_ftTxt}_\n\n╚═══════════════════════╝`)
    } catch(e) { reply('❌ Could not fetch a random fact. Try again!') }
} break

//━━━━━━━━━━━━━━━━━━━━━━━━//
// Anime Commands
case 'neko': {
    await X.sendMessage(m.chat, { react: { text: '🐱', key: m.key } })
    try {
        let nekoUrl = null
        // Source 1: nekos.best (free, no key)
        try {
            const _nb = await fetch('https://nekos.best/api/v2/neko', { signal: AbortSignal.timeout(8000) })
            const _nbd = await _nb.json()
            if (_nbd.results?.[0]?.url) nekoUrl = _nbd.results[0].url
        } catch {}
        // Source 2: waifu.pics
        if (!nekoUrl) {
            const _wp = await fetch('https://api.waifu.pics/sfw/neko', { signal: AbortSignal.timeout(8000) })
            const _wpd = await _wp.json()
            if (_wpd.url) nekoUrl = _wpd.url
        }
        // Source 3: GiftedTech
        if (!nekoUrl) {
            const _gn = await fetch(`https://api.giftedtech.co.ke/api/anime/neko?apikey=${_giftedKey()}`, { signal: AbortSignal.timeout(10000) })
            const _gnd = await _gn.json()
            if (_gnd.success && _gnd.result) nekoUrl = _gnd.result
        }
        if (!nekoUrl) throw new Error('No neko image')
        await safeSendMedia(m.chat, { image: { url: nekoUrl }, caption: '*Neko!* 🐱' }, {}, { quoted: m })
    } catch { reply('❌ Failed to fetch neko image. Try again!') }
} break

case 'waifu': {
    await X.sendMessage(m.chat, { react: { text: '👩', key: m.key } })
    try {
        let waifuUrl = null
        // Source 1: waifu.pics (free, no key)
        try {
            const _wp = await fetch('https://api.waifu.pics/sfw/waifu', { signal: AbortSignal.timeout(8000) })
            const _wpd = await _wp.json()
            if (_wpd.url) waifuUrl = _wpd.url
        } catch {}
        // Source 2: waifu.im (free, no key)
        if (!waifuUrl) {
            const _wi = await fetch('https://api.waifu.im/search?included_tags=waifu&is_nsfw=false', { signal: AbortSignal.timeout(8000) })
            const _wid = await _wi.json()
            if (_wid.images?.[0]?.url) waifuUrl = _wid.images[0].url
        }
        // Source 3: GiftedTech
        if (!waifuUrl) {
            const _gw = await fetch(`https://api.giftedtech.co.ke/api/anime/waifu?apikey=${_giftedKey()}`, { signal: AbortSignal.timeout(10000) })
            const _gwd = await _gw.json()
            if (_gwd.success && _gwd.result) waifuUrl = _gwd.result
        }
        if (!waifuUrl) throw new Error('No waifu image')
        await safeSendMedia(m.chat, { image: { url: waifuUrl }, caption: '*Waifu!* 👩‍🎤' }, {}, { quoted: m })
    } catch { reply('❌ Failed to fetch waifu image. Try again!') }
} break

case 'loli': {
    await X.sendMessage(m.chat, { react: { text: '🌸', key: m.key } })
try {
let res = await fetch('https://nekos.life/api/v2/img/neko')
let data = await res.json()
await X.sendMessage(m.chat, { image: { url: data.url }, caption: '*Anime!* 🌸' }, { quoted: m })
} catch { reply('Failed to fetch image.') }
} break

case 'nom': {
    await X.sendMessage(m.chat, { react: { text: '😋', key: m.key } })
try {
let res = await fetch('https://api.waifu.pics/sfw/nom')
let data = await res.json()
await X.sendMessage(m.chat, { image: { url: data.url }, caption: '*Nom nom!* 😋' }, { quoted: m })
} catch { reply('Failed to fetch image.') }
} break

case 'poke': {
    await X.sendMessage(m.chat, { react: { text: '👉', key: m.key } })
try {
let res = await fetch('https://api.waifu.pics/sfw/poke')
let data = await res.json()
let pokeTarget = (m.mentionedJid && m.mentionedJid[0]) ? `@${m.mentionedJid[0].split('@')[0]}` : ''
await X.sendMessage(m.chat, { image: { url: data.url }, caption: `*${pushname} pokes ${pokeTarget || 'someone'}!* 👉`, mentions: m.mentionedJid || [] }, { quoted: m })
} catch { reply('Failed to fetch image.') }
} break

case 'cry': {
    await X.sendMessage(m.chat, { react: { text: '😢', key: m.key } })
try {
let res = await fetch('https://api.waifu.pics/sfw/cry')
let data = await res.json()
await X.sendMessage(m.chat, { image: { url: data.url }, caption: `*${pushname} is crying!* 😢` }, { quoted: m })
} catch { reply('Failed to fetch image.') }
} break

case 'kiss': {
    await X.sendMessage(m.chat, { react: { text: '😘', key: m.key } })
try {
let res = await fetch('https://api.waifu.pics/sfw/kiss')
let data = await res.json()
let kissTarget = (m.mentionedJid && m.mentionedJid[0]) ? `@${m.mentionedJid[0].split('@')[0]}` : 'someone'
await X.sendMessage(m.chat, { image: { url: data.url }, caption: `*${pushname} kisses ${kissTarget}!* 💋`, mentions: m.mentionedJid || [] }, { quoted: m })
} catch { reply('Failed to fetch image.') }
} break

case 'pat': {
    await X.sendMessage(m.chat, { react: { text: '🤝', key: m.key } })
try {
let res = await fetch('https://api.waifu.pics/sfw/pat')
let data = await res.json()
let patTarget = (m.mentionedJid && m.mentionedJid[0]) ? `@${m.mentionedJid[0].split('@')[0]}` : 'someone'
await X.sendMessage(m.chat, { image: { url: data.url }, caption: `*${pushname} pats ${patTarget}!* 🤗`, mentions: m.mentionedJid || [] }, { quoted: m })
} catch { reply('Failed to fetch image.') }
} break

case 'hug': {
    await X.sendMessage(m.chat, { react: { text: '🤗', key: m.key } })
try {
let res = await fetch('https://api.waifu.pics/sfw/hug')
let data = await res.json()
let hugTarget = (m.mentionedJid && m.mentionedJid[0]) ? `@${m.mentionedJid[0].split('@')[0]}` : 'someone'
await X.sendMessage(m.chat, { image: { url: data.url }, caption: `*${pushname} hugs ${hugTarget}!* 🤗`, mentions: m.mentionedJid || [] }, { quoted: m })
} catch { reply('Failed to fetch image.') }
} break

case 'slap':
case 'smack': {
    await X.sendMessage(m.chat, { react: { text: '👋', key: m.key } })
    try {
        let _wp = await fetch('https://api.waifu.pics/sfw/slap')
        let _wpd = await _wp.json()
        let _tgt = (m.mentionedJid && m.mentionedJid[0]) ? `@${m.mentionedJid[0].split('@')[0]}` : 'someone'
        await safeSendMedia(m.chat, { image: { url: _wpd.url }, caption: `*${pushname} slaps ${_tgt}!* 👋` }, { mentions: m.mentionedJid || [] }, { quoted: m })
    } catch { reply('❌ Failed to fetch image.') }
} break

case 'cuddle': {
    await X.sendMessage(m.chat, { react: { text: '🤗', key: m.key } })
    try {
        let _wp = await fetch('https://api.waifu.pics/sfw/cuddle')
        let _wpd = await _wp.json()
        let _tgt = (m.mentionedJid && m.mentionedJid[0]) ? `@${m.mentionedJid[0].split('@')[0]}` : 'someone'
        await safeSendMedia(m.chat, { image: { url: _wpd.url }, caption: `*${pushname} cuddles ${_tgt}!* 🤗` }, { mentions: m.mentionedJid || [] }, { quoted: m })
    } catch { reply('❌ Failed to fetch image.') }
} break

case 'wave': {
    await X.sendMessage(m.chat, { react: { text: '👋', key: m.key } })
    try {
        let _wp = await fetch('https://api.waifu.pics/sfw/wave')
        let _wpd = await _wp.json()
        let _tgt = (m.mentionedJid && m.mentionedJid[0]) ? `@${m.mentionedJid[0].split('@')[0]}` : 'someone'
        await safeSendMedia(m.chat, { image: { url: _wpd.url }, caption: `*${pushname} waves at ${_tgt}!* 👋` }, { mentions: m.mentionedJid || [] }, { quoted: m })
    } catch { reply('❌ Failed to fetch image.') }
} break

case 'wink': {
    await X.sendMessage(m.chat, { react: { text: '😉', key: m.key } })
try {
let res = await fetch('https://api.waifu.pics/sfw/wink')
let data = await res.json()
await X.sendMessage(m.chat, { image: { url: data.url }, caption: `*${pushname} winks!* 😉` }, { quoted: m })
} catch { reply('Failed to fetch image.') }
} break

case 'facepalm': {
    await X.sendMessage(m.chat, { react: { text: '🤦', key: m.key } })
try {
let res = await fetch('https://api.waifu.pics/sfw/cringe')
let data = await res.json()
await X.sendMessage(m.chat, { image: { url: data.url }, caption: `*${pushname} facepalms!* 🤦` }, { quoted: m })
} catch { reply('Failed to fetch image.') }
} break

case 'mal':
case 'myanimelist':
case 'anime': {
    await X.sendMessage(m.chat, { react: { text: '🎌', key: m.key } })
if (!text) return reply(`╔══〔 🎌 ANIME SEARCH 〕══╗\n\n║ Usage: *${prefix}anime [title]*\n║ Example: ${prefix}anime Naruto\n╚═══════════════════════╝`)
try {
let res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(text)}&limit=5`)
let data = await res.json()
if (!data.data || !data.data.length) return reply('No anime found.')
let animeList = data.data.map((a, i) => `${i+1}. *${a.title}* (${a.title_japanese || ''})\nScore: ${a.score || 'N/A'}\nEpisodes: ${a.episodes || 'N/A'}\nStatus: ${a.status}\nGenres: ${(a.genres || []).map(g => g.name).join(', ')}\nSynopsis: ${(a.synopsis || 'N/A').slice(0, 200)}...\nURL: ${a.url}`).join('\n\n')
if (data.data[0].images?.jpg?.image_url) {
await X.sendMessage(m.chat, { image: { url: data.data[0].images.jpg.image_url }, caption: `*Anime Search: ${text}*\n\n${animeList}` }, { quoted: m })
} else reply(`╔══〔 🎌 ANIME SEARCH 〕══╗\n\n║ 🔍 *${text}*\n\n${animeList}\n╚═══════════════════════╝`)
} catch(e) { reply('Error: ' + e.message) }
} break

//━━━━━━━━━━━━━━━━━━━━━━━━//
// Unicode Font Commands
// All outputs are plain Unicode text — everyone sees them in any WhatsApp chat
// Owner uses the command, copies the output, pastes it anywhere
case 'setfont': {
    await X.sendMessage(m.chat, { react: { text: '✏️', key: m.key } })
// Activate persistent font mode — all your messages auto-convert until you run .fontoff
if (!isOwner) return reply(mess.OnlyOwner)
const _validFonts = ['bold','italic','bolditalic','mono','serif','serifbold','serifitalic','scriptfont','scriptbold','fraktur','frakturbold','doublestruck','smallcaps','bubble','bubblebold','square','squarebold','wide','upsidedown','strikethrough','underline','aesthetic','tiny','cursive','gothic','medieval','oldeng','inverted','mirror','currency','dotted','parenthesis','flags']
let _chosen = (text || '').toLowerCase().trim()
if (!_chosen) return reply(`╔════〔 🔤 SET FONT 〕════╗\n\n║ Usage: *${prefix}setfont [fontname]*\n║ Fonts: ${_validFonts.join(' · ')}\n\n║ _Auto-converts your messages until ${prefix}fontoff_\n╚═══════════════════════╝`)
if (!_validFonts.includes(_chosen)) return reply(`❌ Unknown font: *${_chosen}*\n\nValid options:\n${_validFonts.map(f=>'• '+f).join('\n')}`)
global.ownerFontMode = _chosen
reply(`✅ *Font mode set to: ${_chosen}*\n\n_Every message you send will now appear in ${_chosen} style._\n_Use ${prefix}fontoff to return to normal._`)
} break

case 'fontoff':
case 'resetfont': {
    await X.sendMessage(m.chat, { react: { text: '✏️', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
global.ownerFontMode = 'off'
reply(`✅ *Font mode disabled.*\n_Your messages will now send normally._`)
} break

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ✨  FANCY TEXT — 35 numbered styles + pick-by-reply
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
case 'fancy':
case 'fancytext':
case 'stylish': {
    await X.sendMessage(m.chat, { react: { text: '✨', key: m.key } })
    // ── font table (from fontConverter.js) ──────────────────────────
    const _FNTS = {
        bold:            { l:'𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇', u:'𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭', d:'𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵', n:'Bold' },
        italic:          { l:'𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻', u:'𝘈𝘉𝘊𝘋𝘌𝘍𝘎𝘏𝘐𝘑𝘒𝘓𝘔𝘕𝘖𝘗𝘘𝘙𝘚𝘛𝘜𝘝𝘞𝘟𝘠𝘡', d:'0123456789', n:'Italic' },
        bolditalic:      { l:'𝙖𝙗𝙘𝙙𝙚𝙛𝙜𝙝𝙞𝙟𝙠𝙡𝙢𝙣𝙤𝙥𝙦𝙧𝙨𝙩𝙪𝙫𝙬𝙭𝙮𝙯', u:'𝘼𝘽𝘾𝘿𝙀𝙁𝙂𝙃𝙄𝙅𝙆𝙇𝙈𝙉𝙊𝙋𝙌𝙍𝙎𝙏𝙐𝙑𝙒𝙓𝙔𝙕', d:'0123456789', n:'Bold Italic' },
        serif:           { l:'𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳', u:'𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙', d:'0123456789', n:'Serif Bold' },
        serifitalic:     { l:'𝑎𝑏𝑐𝑑𝑒𝑓𝑔ℎ𝑖𝑗𝑘𝑙𝑚𝑛𝑜𝑝𝑞𝑟𝑠𝑡𝑢𝑣𝑤𝑥𝑦𝑧', u:'𝐴𝐵𝐶𝐷𝐸𝐹𝐺𝐻𝐼𝐽𝐾𝐿𝑀𝑁𝑂𝑃𝑄𝑅𝑆𝑇𝑈𝑉𝑊𝑋𝑌𝑍', d:'0123456789', n:'Serif Italic' },
        serifbolditalic: { l:'𝒂𝒃𝒄𝒅𝒆𝒇𝒈𝒉𝒊𝒋𝒌𝒍𝒎𝒏𝒐𝒑𝒒𝒓𝒔𝒕𝒖𝒗𝒘𝒙𝒚𝒛', u:'𝑨𝑩𝑪𝑫𝑬𝑭𝑮𝑯𝑰𝑱𝑲𝑳𝑴𝑵𝑶𝑷𝑸𝑹𝑺𝑻𝑼𝑽𝑾𝑿𝒀𝒁', d:'0123456789', n:'Serif Bold Italic' },
        script:          { l:'𝓪𝓫𝓬𝓭𝓮𝓯𝓰𝓱𝓲𝓳𝓴𝓵𝓶𝓷𝓸𝓹𝓺𝓻𝓼𝓽𝓾𝓿𝔀𝔁𝔂𝔃', u:'𝓐𝓑𝓒𝓓𝓔𝓕𝓖𝓗𝓘𝓙𝓚𝓛𝓜𝓝𝓞𝓟𝓠𝓡𝓢𝓣𝓤𝓥𝓦𝓧𝓨𝓩', d:'0123456789', n:'Script Bold' },
        scriptlight:     { l:'𝒶𝒷𝒸𝒹𝑒𝒻𝑔𝒽𝒾𝒿𝓀𝓁𝓂𝓃𝑜𝓅𝓆𝓇𝓈𝓉𝓊𝓋𝓌𝓍𝓎𝓏', u:'𝒜𝐵𝒞𝒟𝐸𝐹𝒢𝐻𝐼𝒥𝒦𝐿𝑀𝒩𝒪𝒫𝒬𝑅𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵', d:'0123456789', n:'Script' },
        gothic:          { l:'𝔞𝔟𝔠𝔡𝔢𝔣𝔤𝔥𝔦𝔧𝔨𝔩𝔪𝔫𝔬𝔭𝔮𝔯𝔰𝔱𝔲𝔳𝔴𝔵𝔶𝔷', u:'𝔄𝔅ℭ𝔇𝔈𝔉𝔊ℌℑ𝔍𝔎𝔏𝔐𝔑𝔒𝔓𝔔ℜ𝔖𝔗𝔘𝔙𝔚𝔛𝔜ℨ', d:'0123456789', n:'Gothic' },
        gothicbold:      { l:'𝖆𝖇𝖈𝖉𝖊𝖋𝖌𝖍𝖎𝖏𝖐𝖑𝖒𝖓𝖔𝖕𝖖𝖗𝖘𝖙𝖚𝖛𝖜𝖝𝖞𝖟', u:'𝕬𝕭𝕮𝕯𝕰𝕱𝕲𝕳𝕴𝕵𝕶𝕷𝕸𝕹𝕺𝕻𝕼𝕽𝕾𝕿𝖀𝖁𝖂𝖃𝖄𝖅', d:'0123456789', n:'Gothic Bold' },
        mono:            { l:'𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣', u:'𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉', d:'𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿', n:'Monospace' },
        double:          { l:'𝕒𝕓𝕔𝕕𝕖𝕗𝕘𝕙𝕚𝕛𝕜𝕝𝕞𝕟𝕠𝕡𝕢𝕣𝕤𝕥𝕦𝕧𝕨𝕩𝕪𝕫', u:'𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ', d:'𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡', n:'Double Struck' },
        circled:         { l:'ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ', u:'ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ', d:'⓪①②③④⑤⑥⑦⑧⑨', n:'Circled' },
        squared:         { l:'🄰🄱🄲🄳🄴🄵🄶🄷🄸🄹🄺🄻🄼🄽🄾🄿🅀🅁🅂🅃🅄🅅🅆🅇🅈🅉', u:'🄰🄱🄲🄳🄴🄵🄶🄷🄸🄹🄺🄻🄼🄽🄾🄿🅀🅁🅂🅃🅄🅅🅆🅇🅈🅉', d:'0123456789', n:'Squared' },
        fullwidth:       { l:'ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ', u:'ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ', d:'０１２３４５６７８９', n:'Full Width' },
        smallcaps:       { l:'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ', u:'ABCDEFGHIJKLMNOPQRSTUVWXYZ', d:'0123456789', n:'Small Caps' },
        superscript:     { l:'ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖqʳˢᵗᵘᵛʷˣʸᶻ', u:'ᴬᴮᶜᴰᴱᶠᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾQᴿˢᵀᵁⱽᵂˣʸᶻ', d:'⁰¹²³⁴⁵⁶⁷⁸⁹', n:'Superscript' },
        inverted:        { l:'ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz', u:'∀ꓭƆꓷƎꓞ⅁HIꓩꓘ⅂WNOꓒΌꓤSꓕꓵΛMX⅄Z', d:'0123456789', n:'Inverted/Flip' },
        bubbles:         { l:'🅐🅑🅒🅓🅔🅕🅖🅗🅘🅙🅚🅛🅜🅝🅞🅟🅠🅡🅢🅣🅤🅥🅦🅧🅨🅩', u:'🅐🅑🅒🅓🅔🅕🅖🅗🅘🅙🅚🅛🅜🅝🅞🅟🅠🅡🅢🅣🅤🅥🅦🅧🅨🅩', d:'0123456789', n:'Bubbles' },
        strikethrough:   { l:'a̶b̶c̶d̶e̶f̶g̶h̶i̶j̶k̶l̶m̶n̶o̶p̶q̶r̶s̶t̶u̶v̶w̶x̶y̶z̶', u:'A̶B̶C̶D̶E̶F̶G̶H̶I̶J̶K̶L̶M̶N̶O̶P̶Q̶R̶S̶T̶U̶V̶W̶X̶Y̶Z̶', d:'0123456789', n:'Strikethrough' },
        sansserif:       { l:'𝖺𝖻𝖼𝖽𝖾𝖿𝗀𝗁𝗂𝗃𝗄𝗅𝗆𝗇𝗈𝗉𝗊𝗋𝗌𝗍𝗎𝗏𝗐𝗑𝗒𝗓', u:'𝖠𝖡𝖢𝖣𝖤𝖥𝖦𝖧𝖨𝖩𝖪𝖫𝖬𝖭𝖮𝖯𝖰𝖱𝖲𝖳𝖴𝖵𝖶𝖷𝖸𝖹', d:'𝟢𝟣𝟤𝟥𝟦𝟧𝟨𝟩𝟪𝟫', n:'Sans Serif' },
        parenthesized:   { l:'⒜⒝⒞⒟⒠⒡⒢⒣⒤⒥⒦⒧⒨⒩⒪⒫⒬⒭⒮⒯⒰⒱⒲⒳⒴⒵', u:'ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ', d:'⓪①②③④⑤⑥⑦⑧⑨', n:'Parenthesized' },
    }
    const _COMB = [
        { n:'Underline',        c:'\u0332' }, { n:'Double Underline', c:'\u0333' },
        { n:'Overline',         c:'\u0305' }, { n:'Wavy Below',       c:'\u0330' },
        { n:'Dotted Above',     c:'\u0307' }, { n:'Ring Above',       c:'\u030A' },
        { n:'Tilde Above',      c:'\u0303' }, { n:'Tilde Overlay',    c:'\u0334' },
        { n:'Acute Above',      c:'\u0301' }, { n:'Grave Above',      c:'\u0300' },
        { n:'Circumflex',       c:'\u0302' }, { n:'Diaeresis',        c:'\u0308' },
        { n:'Slash Through',    c:'\u0338' },
    ]
    const _NL  = 'abcdefghijklmnopqrstuvwxyz'
    const _NU  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const _ND  = '0123456789'
    const _conv = (ch, f) => {
        const li = _NL.indexOf(ch); if (li !== -1) return [...f.l][li] || ch
        const ui = _NU.indexOf(ch); if (ui !== -1) return [...f.u][ui] || ch
        const di = _ND.indexOf(ch); if (di !== -1) return [...f.d][di] || ch
        return ch
    }
    // ── pick mode: user replied to a fancy list with a number ────────
    const _fqText = m.quoted?.text || m.quoted?.body || m.quoted?.caption || ''
    const _fIsFancyList = _fqText.includes('✨ *Fancy Styles for:*')
    const _fIsNum = /^\d+$/.test(text?.trim() || '')
    if (_fIsFancyList && _fIsNum) {
        const _fPick = parseInt(text.trim())
        const _fLines = _fqText.split('\n')
        const _fTarget = _fLines.find(l => l.trimStart().startsWith(`*${_fPick}.*`))
        if (!_fTarget) {
            const _fMax = _fLines.filter(l => /^\*\d+\.\*/.test(l.trimStart())).length
            return reply(`❌ Style #${_fPick} not found. Pick 1–${_fMax}.`)
        }
        const _fClean = _fTarget.replace(/^\*\d+\.\*\s*/, '').replace(/\s{2}_\[.+?\]_$/, '').trim()
        return reply(_fClean)
    }
    // ── generate mode ────────────────────────────────────────────────
    let _fInput = text?.trim() || _fqText.trim()
    if (!_fInput) return reply(`╔═══〔 ✨ FANCY TEXT 〕════╗\n\n║ Usage: *${prefix}fancy [text]*\n║ Example: ${prefix}fancy Hello World\n\n║ _Or reply to any message with *${prefix}fancy*_\n║ _Then reply the result with *${prefix}fancy [number]*_\n║ _to send just that one style._\n╚═══════════════════════╝`)
    // build numbered list
    const _fLines2 = []
    let _fNum = 1
    for (const font of Object.values(_FNTS)) {
        const styled = [..._fInput].map(ch => _conv(ch, font)).join('')
        _fLines2.push(`*${_fNum}.* ${styled}  _[${font.n}]_`)
        _fNum++
    }
    for (const cs of _COMB) {
        const styled = [..._fInput].map(ch => /\s/.test(ch) ? ch : ch + cs.c).join('')
        _fLines2.push(`*${_fNum}.* ${styled}  _[${cs.n}]_`)
        _fNum++
    }
    // ── Keith API extra styles ────────────────────────────────────────
    try {
        const _kfData = await _keithFetch(`/fancytext?q=${encodeURIComponent(_fInput)}`)
        const _kfStyles = _kfData?.result || _kfData?.styles || (Array.isArray(_kfData) ? _kfData : null)
        if (Array.isArray(_kfStyles)) {
            for (const s of _kfStyles.slice(0, 15)) {
                const _kfText = typeof s === 'string' ? s : (s.text || s.style || s.value)
                const _kfName = typeof s === 'string' ? 'Keith Style' : (s.name || s.font || 'Keith Style')
                if (_kfText && _kfText !== _fInput) _fLines2.push(`*${_fNum}.* ${_kfText}  _[${_kfName}]_`); _fNum++
            }
        }
    } catch {} // Keith bonus styles optional
    const _fTotal = _fLines2.length
    const _fHeader = `╔═══〔 ✨ FANCY TEXT 〕════╗\n_${_fInput}_ · ${_fTotal} styles\n\n\n╚═══════════════════════╝`
    const _fFooter = `\n╚═══════════════════════╝ _Reply with_ *${prefix}fancy [number]* _to send just that style_`
    const _fFull = _fHeader + _fLines2.join('\n') + _fFooter
    if (_fFull.length <= 60000) {
        await reply(_fFull)
    } else {
        let _fBuf = _fHeader
        for (const line of _fLines2) {
            if ((_fBuf + line + '\n').length > 60000) { await reply(_fBuf.trimEnd()); _fBuf = '' }
            _fBuf += line + '\n'
        }
        if (_fBuf.trim()) await reply(_fBuf.trimEnd() + _fFooter)
    }
} break

  case 'ascii':
  case 'asciiart': {
      await X.sendMessage(m.chat, { react: { text: '🎨', key: m.key } })
      const _asq = q?.trim() || text?.trim()
      if (!_asq) return reply(`╌══〔 🎨 ASCII ART 〕═════╌\n║ *Usage:* ${prefix}ascii [word]\n║ Example: ${prefix}ascii dragon\n╚═══════════════════════╝`)
      try {
          await reply(`🎨 _Generating ASCII art for: ${_asq}..._`)
          const _asd = await _keithFetch(`/tools/ascii?q=${encodeURIComponent(_asq)}`)
          const _asr = Array.isArray(_asd) ? _asd : (_asd?.arts || _asd?.result?.arts || (_asd?.art ? [_asd.art] : null))
          if (!Array.isArray(_asr) || !_asr.length) throw new Error('No art')
          const _asArt = _asr[Math.floor(Math.random() * Math.min(_asr.length, 3))]
          await reply(`🎨 *ASCII: ${_asq.toUpperCase()}*\n\`\`\`\n${_asArt}\n\`\`\``)
      } catch(e) { reply('❌ ASCII art generation failed. Try another word.') }
  } break

  case 'walink':
  case 'whatsapplink': {
      await X.sendMessage(m.chat, { react: { text: '🔗', key: m.key } })
      const _wlparts = text?.split(' ') || []
      const _wlnum = _wlparts[0]?.replace(/[^0-9]/g, '')
      const _wlmsg = _wlparts.slice(1).join(' ')
      if (!_wlnum) return reply(`╌══〔 🔗 WA LINK 〕═══════╌\n║ *Usage:* ${prefix}walink [number] [message]\n║ Example: ${prefix}walink 254712345678 Hello!\n╚═══════════════════════╝`)
      try {
          const _wld = await _keithFetch(`/tools/walink?q=${encodeURIComponent(_wlmsg || 'Hello')}&number=${_wlnum}`)
          const _wlurl = _wld?.shortUrl || _wld?.url || `https://wa.me/${_wlnum}${_wlmsg ? '?text=' + encodeURIComponent(_wlmsg) : ''}`
          await reply(`╌══〔 🔗 WHATSAPP LINK 〕══╌\n\n📞 *Number:* +${_wlnum}\n🔗 *Link:* ${_wlurl}\n╚═══════════════════════╝`)
      } catch(e) { reply('❌ Failed to create WhatsApp link.') }
  } break


case 'font':
case 'fonts': {
    await X.sendMessage(m.chat, { react: { text: '🔤', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n_Send text with the command to preview all fonts:_\n*${prefix}font [your text]*\n\n║ *Or use individual commands:*\n║ ${prefix}bold · ${prefix}italic · ${prefix}bolditalic\n║ ${prefix}mono · ${prefix}serif · ${prefix}serifbold\n║ ${prefix}scriptfont · ${prefix}scriptbold\n║ ${prefix}fraktur · ${prefix}frakturbold\n║ ${prefix}doublestruck · ${prefix}smallcaps\n║ ${prefix}bubble · ${prefix}bubblebold\n║ ${prefix}square · ${prefix}squarebold\n║ ${prefix}wide · ${prefix}upsidedown\n║ ${prefix}strikethrough · ${prefix}underline\n\n║ _Tip: ${prefix}setfont [name] for persistent style_\n╚═══════════════════════╝`)
// text provided — show all fonts as live Unicode preview
const _fMaps = {
  '𝗕𝗼𝗹𝗱 𝗦𝗮𝗻𝘀':      {a:'𝗮',b:'𝗯',c:'𝗰',d:'𝗱',e:'𝗲',f:'𝗳',g:'𝗴',h:'𝗵',i:'𝗶',j:'𝗷',k:'𝗸',l:'𝗹',m:'𝗺',n:'𝗻',o:'𝗼',p:'𝗽',q:'𝗾',r:'𝗿',s:'𝘀',t:'𝘁',u:'𝘂',v:'𝘃',w:'𝘄',x:'𝘅',y:'𝘆',z:'𝘇',A:'𝗔',B:'𝗕',C:'𝗖',D:'𝗗',E:'𝗘',F:'𝗙',G:'𝗚',H:'𝗛',I:'𝗜',J:'𝗝',K:'𝗞',L:'𝗟',M:'𝗠',N:'𝗡',O:'𝗢',P:'𝗣',Q:'𝗤',R:'𝗥',S:'𝗦',T:'𝗧',U:'𝗨',V:'𝗩',W:'𝗪',X:'𝗫',Y:'𝗬',Z:'𝗭'},
  '𝘐𝘵𝘢𝘭𝘪𝘤 𝘚𝘢𝘯𝘴':    {a:'𝘢',b:'𝘣',c:'𝘤',d:'𝘥',e:'𝘦',f:'𝘧',g:'𝘨',h:'𝘩',i:'𝘪',j:'𝘫',k:'𝘬',l:'𝘭',m:'𝘮',n:'𝘯',o:'𝘰',p:'𝘱',q:'𝘲',r:'𝘳',s:'𝘴',t:'𝘵',u:'𝘶',v:'𝘷',w:'𝘸',x:'𝘹',y:'𝘺',z:'𝘻',A:'𝘈',B:'𝘉',C:'𝘊',D:'𝘋',E:'𝘌',F:'𝘍',G:'𝘎',H:'𝘏',I:'𝘐',J:'𝘑',K:'𝘒',L:'𝘓',M:'𝘔',N:'𝘕',O:'𝘖',P:'𝘗',Q:'𝘘',R:'𝘙',S:'𝘚',T:'𝘛',U:'𝘜',V:'𝘝',W:'𝘞',X:'𝘟',Y:'𝘠',Z:'𝘡'},
  '𝙱𝚘𝚕𝚍 𝙸𝚝𝚊𝚕𝚒𝚌':   {a:'𝙖',b:'𝙗',c:'𝙘',d:'𝙙',e:'𝙚',f:'𝙛',g:'𝙜',h:'𝙝',i:'𝙞',j:'𝙟',k:'𝙠',l:'𝙡',m:'𝙢',n:'𝙣',o:'𝙤',p:'𝙥',q:'𝙦',r:'𝙧',s:'𝙨',t:'𝙩',u:'𝙪',v:'𝙫',w:'𝙬',x:'𝙭',y:'𝙮',z:'𝙯',A:'𝘼',B:'𝘽',C:'𝘾',D:'𝘿',E:'𝙀',F:'𝙁',G:'𝙂',H:'𝙃',I:'𝙄',J:'𝙅',K:'𝙆',L:'𝙇',M:'𝙈',N:'𝙉',O:'𝙊',P:'𝙋',Q:'𝙌',R:'𝙍',S:'𝙎',T:'𝙏',U:'𝙐',V:'𝙑',W:'𝙒',X:'𝙓',Y:'𝙔',Z:'𝙕'},
  '𝙼𝚘𝚗𝚘':            {a:'𝚊',b:'𝚋',c:'𝚌',d:'𝚍',e:'𝚎',f:'𝚏',g:'𝚐',h:'𝚑',i:'𝚒',j:'𝚓',k:'𝚔',l:'𝚕',m:'𝚖',n:'𝚗',o:'𝚘',p:'𝚙',q:'𝚚',r:'𝚛',s:'𝚜',t:'𝚝',u:'𝚞',v:'𝚟',w:'𝚠',x:'𝚡',y:'𝚢',z:'𝚣',A:'𝙰',B:'𝙱',C:'𝙲',D:'𝙳',E:'𝙴',F:'𝙵',G:'𝙶',H:'𝙷',I:'𝙸',J:'𝙹',K:'𝙺',L:'𝙻',M:'𝙼',N:'𝙽',O:'𝙾',P:'𝙿',Q:'𝚀',R:'𝚁',S:'𝚂',T:'𝚃',U:'𝚄',V:'𝚅',W:'𝚆',X:'𝚇',Y:'𝚈',Z:'𝚉'},
  '𝒮𝒸𝓇𝒾𝓅𝓉':         {a:'𝒶',b:'𝒷',c:'𝒸',d:'𝒹',e:'𝑒',f:'𝒻',g:'𝑔',h:'𝒽',i:'𝒾',j:'𝒿',k:'𝓀',l:'𝓁',m:'𝓂',n:'𝓃',o:'𝑜',p:'𝓅',q:'𝓆',r:'𝓇',s:'𝓈',t:'𝓉',u:'𝓊',v:'𝓋',w:'𝓌',x:'𝓍',y:'𝓎',z:'𝓏',A:'𝒜',B:'ℬ',C:'𝒞',D:'𝒟',E:'ℰ',F:'ℱ',G:'𝒢',H:'ℋ',I:'ℐ',J:'𝒥',K:'𝒦',L:'ℒ',M:'ℳ',N:'𝒩',O:'𝒪',P:'𝒫',Q:'𝒬',R:'ℛ',S:'𝒮',T:'𝒯',U:'𝒰',V:'𝒱',W:'𝒲',X:'𝒳',Y:'𝒴',Z:'𝒵'},
  '𝓑𝓸𝓵𝓭 𝓢𝓬𝓻𝓲𝓹𝓽':  {a:'𝓪',b:'𝓫',c:'𝓬',d:'𝓭',e:'𝓮',f:'𝓯',g:'𝓰',h:'𝓱',i:'𝓲',j:'𝓳',k:'𝓴',l:'𝓵',m:'𝓶',n:'𝓷',o:'𝓸',p:'𝓹',q:'𝓺',r:'𝓻',s:'𝓼',t:'𝓽',u:'𝓾',v:'𝓿',w:'𝔀',x:'𝔁',y:'𝔂',z:'𝔃',A:'𝓐',B:'𝓑',C:'𝓒',D:'𝓓',E:'𝓔',F:'𝓕',G:'𝓖',H:'𝓗',I:'𝓘',J:'𝓙',K:'𝓚',L:'𝓛',M:'𝓜',N:'𝓝',O:'𝓞',P:'𝓟',Q:'𝓠',R:'𝓡',S:'𝓢',T:'𝓣',U:'𝓤',V:'𝓥',W:'𝓦',X:'𝓧',Y:'𝓨',Z:'𝓩'},
  '𝔉𝔯𝔞𝔨𝔱𝔲𝔯':        {a:'𝔞',b:'𝔟',c:'𝔠',d:'𝔡',e:'𝔢',f:'𝔣',g:'𝔤',h:'𝔥',i:'𝔦',j:'𝔧',k:'𝔨',l:'𝔩',m:'𝔪',n:'𝔫',o:'𝔬',p:'𝔭',q:'𝔮',r:'𝔯',s:'𝔰',t:'𝔱',u:'𝔲',v:'𝔳',w:'𝔴',x:'𝔵',y:'𝔶',z:'𝔷',A:'𝔄',B:'𝔅',C:'ℭ',D:'𝔇',E:'𝔈',F:'𝔉',G:'𝔊',H:'ℌ',I:'ℑ',J:'𝔍',K:'𝔎',L:'𝔏',M:'𝔐',N:'𝔑',O:'𝔒',P:'𝔓',Q:'𝔔',R:'ℜ',S:'𝔖',T:'𝔗',U:'𝔘',V:'𝔙',W:'𝔚',X:'𝔛',Y:'𝔜',Z:'ℨ'},
  '𝕭𝖔𝖑𝖉 𝕱𝖗𝖆𝖐𝖙𝖚𝖗': {a:'𝖆',b:'𝖇',c:'𝖈',d:'𝖉',e:'𝖊',f:'𝖋',g:'𝖌',h:'𝖍',i:'𝖎',j:'𝖏',k:'𝖐',l:'𝖑',m:'𝖒',n:'𝖓',o:'𝖔',p:'𝖕',q:'𝖖',r:'𝖗',s:'𝖘',t:'𝖙',u:'𝖚',v:'𝖛',w:'𝖜',x:'𝖝',y:'𝖞',z:'𝖟',A:'𝕬',B:'𝕭',C:'𝕮',D:'𝕯',E:'𝕰',F:'𝕱',G:'𝕲',H:'𝕳',I:'𝕴',J:'𝕵',K:'𝕶',L:'𝕷',M:'𝕸',N:'𝕹',O:'𝕺',P:'𝕻',Q:'𝕼',R:'𝕽',S:'𝕾',T:'𝕿',U:'𝖀',V:'𝖁',W:'𝖂',X:'𝖃',Y:'𝖄',Z:'𝖅'},
  '𝔻𝕠𝕦𝕓𝕝𝕖 𝕊𝕥𝕣𝕦𝕔𝕜':{a:'𝕒',b:'𝕓',c:'𝕔',d:'𝕕',e:'𝕖',f:'𝕗',g:'𝕘',h:'𝕙',i:'𝕚',j:'𝕛',k:'𝕜',l:'𝕝',m:'𝕞',n:'𝕟',o:'𝕠',p:'𝕡',q:'𝕢',r:'𝕣',s:'𝕤',t:'𝕥',u:'𝕦',v:'𝕧',w:'𝕨',x:'𝕩',y:'𝕪',z:'𝕫',A:'𝔸',B:'𝔹',C:'ℂ',D:'𝔻',E:'𝔼',F:'𝔽',G:'𝔾',H:'ℍ',I:'𝕀',J:'𝕁',K:'𝕂',L:'𝕃',M:'𝕄',N:'ℕ',O:'𝕆',P:'ℙ',Q:'ℚ',R:'ℝ',S:'𝕊',T:'𝕋',U:'𝕌',V:'𝕍',W:'𝕎',X:'𝕏',Y:'𝕐',Z:'ℤ'},
  'ꜱᴍᴀʟʟ ᴄᴀᴘꜱ':      {a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ꜰ',g:'ɢ',h:'ʜ',i:'ɪ',j:'ᴊ',k:'ᴋ',l:'ʟ',m:'ᴍ',n:'ɴ',o:'ᴏ',p:'ᴘ',q:'Q',r:'ʀ',s:'ꜱ',t:'ᴛ',u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ',A:'ᴀ',B:'ʙ',C:'ᴄ',D:'ᴅ',E:'ᴇ',F:'ꜰ',G:'ɢ',H:'ʜ',I:'ɪ',J:'ᴊ',K:'ᴋ',L:'ʟ',M:'ᴍ',N:'ɴ',O:'ᴏ',P:'ᴘ',Q:'Q',R:'ʀ',S:'ꜱ',T:'ᴛ',U:'ᴜ',V:'ᴠ',W:'ᴡ',X:'x',Y:'ʏ',Z:'ᴢ'},
  'ⓑⓤⓑⓑⓛⓔ':         {a:'ⓐ',b:'ⓑ',c:'ⓒ',d:'ⓓ',e:'ⓔ',f:'ⓕ',g:'ⓖ',h:'ⓗ',i:'ⓘ',j:'ⓙ',k:'ⓚ',l:'ⓛ',m:'ⓜ',n:'ⓝ',o:'ⓞ',p:'ⓟ',q:'ⓠ',r:'ⓡ',s:'ⓢ',t:'ⓣ',u:'ⓤ',v:'ⓥ',w:'ⓦ',x:'ⓧ',y:'ⓨ',z:'ⓩ',A:'Ⓐ',B:'Ⓑ',C:'Ⓒ',D:'Ⓓ',E:'Ⓔ',F:'Ⓕ',G:'Ⓖ',H:'Ⓗ',I:'Ⓘ',J:'Ⓙ',K:'Ⓚ',L:'Ⓛ',M:'Ⓜ',N:'Ⓝ',O:'Ⓞ',P:'Ⓟ',Q:'Ⓠ',R:'Ⓡ',S:'Ⓢ',T:'Ⓣ',U:'Ⓤ',V:'Ⓥ',W:'Ⓦ',X:'Ⓧ',Y:'Ⓨ',Z:'Ⓩ'},
  '🅑🅤🅑🅑🅛🅔 🅑🅞🅛🅓':{a:'🅐',b:'🅑',c:'🅒',d:'🅓',e:'🅔',f:'🅕',g:'🅖',h:'🅗',i:'🅘',j:'🅙',k:'🅚',l:'🅛',m:'🅜',n:'🅝',o:'🅞',p:'🅟',q:'🅠',r:'🅡',s:'🅢',t:'🅣',u:'🅤',v:'🅥',w:'🅦',x:'🅧',y:'🅨',z:'🅩',A:'🅐',B:'🅑',C:'🅒',D:'🅓',E:'🅔',F:'🅕',G:'🅖',H:'🅗',I:'🅘',J:'🅙',K:'🅚',L:'🅛',M:'🅜',N:'🅝',O:'🅞',P:'🅟',Q:'🅠',R:'🅡',S:'🅢',T:'🅣',U:'🅤',V:'🅥',W:'🅦',X:'🅧',Y:'🅨',Z:'🅩'},
  'Ａｅｓｔｈｅｔｉｃ':    {a:'ａ',b:'ｂ',c:'ｃ',d:'ｄ',e:'ｅ',f:'ｆ',g:'ｇ',h:'ｈ',i:'ｉ',j:'ｊ',k:'ｋ',l:'ｌ',m:'ｍ',n:'ｎ',o:'ｏ',p:'ｐ',q:'ｑ',r:'ｒ',s:'ｓ',t:'ｔ',u:'ｕ',v:'ｖ',w:'ｗ',x:'ｘ',y:'ｙ',z:'ｚ',A:'Ａ',B:'Ｂ',C:'Ｃ',D:'Ｄ',E:'Ｅ',F:'Ｆ',G:'Ｇ',H:'Ｈ',I:'Ｉ',J:'Ｊ',K:'Ｋ',L:'Ｌ',M:'Ｍ',N:'Ｎ',O:'Ｏ',P:'Ｐ',Q:'Ｑ',R:'Ｒ',S:'Ｓ',T:'Ｔ',U:'Ｕ',V:'Ｖ',W:'Ｗ',X:'Ｘ',Y:'Ｙ',Z:'Ｚ'},
  'ᵗⁱⁿʸ':             {a:'ᵃ',b:'ᵇ',c:'ᶜ',d:'ᵈ',e:'ᵉ',f:'ᶠ',g:'ᵍ',h:'ʰ',i:'ⁱ',j:'ʲ',k:'ᵏ',l:'ˡ',m:'ᵐ',n:'ⁿ',o:'ᵒ',p:'ᵖ',q:'q',r:'ʳ',s:'ˢ',t:'ᵗ',u:'ᵘ',v:'ᵛ',w:'ʷ',x:'ˣ',y:'ʸ',z:'ᶻ',A:'ᴬ',B:'ᴮ',C:'ᶜ',D:'ᴰ',E:'ᴱ',F:'ᶠ',G:'ᴳ',H:'ᴴ',I:'ᴵ',J:'ᴶ',K:'ᴷ',L:'ᴸ',M:'ᴹ',N:'ᴺ',O:'ᴼ',P:'ᴾ',Q:'Q',R:'ᴿ',S:'ˢ',T:'ᵀ',U:'ᵁ',V:'ᵛ',W:'ᵂ',X:'ˣ',Y:'ʸ',Z:'ᶻ'},
  'ɥsdısᴉ uʍop':      null,  // handled separately
}
let _fOut = `╔══〔 🔤 FONT PREVIEW 〕══╗\n\n\n╚═══════════════════════╝`
for (const [fname, fmap] of Object.entries(_fMaps)) {
    if (fmap === null) {
        const udM={a:'ɐ',b:'q',c:'ɔ',d:'p',e:'ǝ',f:'ɟ',g:'ƃ',h:'ɥ',i:'ᴉ',j:'ɾ',k:'ʞ',l:'l',m:'ɯ',n:'u',o:'o',p:'d',q:'b',r:'ɹ',s:'s',t:'ʇ',u:'n',v:'ʌ',w:'ʍ',x:'x',y:'ʎ',z:'z',A:'∀',B:'𐐒',C:'Ɔ',D:'ᗡ',E:'Ǝ',F:'Ⅎ',G:'פ',H:'H',I:'I',J:'ſ',K:'ʞ',L:'˥',M:'W',N:'N',O:'O',P:'Ԁ',Q:'Q',R:'ɹ',S:'S',T:'┴',U:'∩',V:'Λ',W:'M',X:'X',Y:'⅄',Z:'Z'}
        _fOut += `*${fname}*\n${[...ftIn].map(c=>udM[c]||c).join('').split('').reverse().join('')}\n\n`
    } else {
        _fOut += `*${fname}*\n${[...ftIn].map(c=>fmap[c]||c).join('')}\n\n`
    }
}
// wide (fullwidth)
const _wide = [...ftIn].map(c=>{const cd=c.charCodeAt(0);return (cd>=33&&cd<=126)?String.fromCharCode(cd+65248):c===' '?'　':c}).join('')
_fOut += `*Ｗｉｄｅ*\n${_wide}\n\n`
// strikethrough & underline
_fOut += `*S̶t̶r̶i̶k̶e̶t̶h̶r̶o̶u̶g̶h̶*\n${[...ftIn].map(c=>c+'\u0336').join('')}\n\n`
_fOut += `*U͟n͟d͟e͟r͟l͟i͟n͟e͟*\n${[...ftIn].map(c=>c+'\u0332').join('')}`
reply(_fOut.trim())
} break

case 'bold': {
    await X.sendMessage(m.chat, { react: { text: '𝐁', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}bold [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const boldMap={a:'𝗮',b:'𝗯',c:'𝗰',d:'𝗱',e:'𝗲',f:'𝗳',g:'𝗴',h:'𝗵',i:'𝗶',j:'𝗷',k:'𝗸',l:'𝗹',m:'𝗺',n:'𝗻',o:'𝗼',p:'𝗽',q:'𝗾',r:'𝗿',s:'𝘀',t:'𝘁',u:'𝘂',v:'𝘃',w:'𝘄',x:'𝘅',y:'𝘆',z:'𝘇',A:'𝗔',B:'𝗕',C:'𝗖',D:'𝗗',E:'𝗘',F:'𝗙',G:'𝗚',H:'𝗛',I:'𝗜',J:'𝗝',K:'𝗞',L:'𝗟',M:'𝗠',N:'𝗡',O:'𝗢',P:'𝗣',Q:'𝗤',R:'𝗥',S:'𝗦',T:'𝗧',U:'𝗨',V:'𝗩',W:'𝗪',X:'𝗫',Y:'𝗬',Z:'𝗭','0':'𝟬','1':'𝟭','2':'𝟮','3':'𝟯','4':'𝟰','5':'𝟱','6':'𝟲','7':'𝟳','8':'𝟴','9':'𝟵'}
reply([...ftIn].map(c=>boldMap[c]||c).join(''))
} break

case 'italic': {
    await X.sendMessage(m.chat, { react: { text: '𝐼', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}italic [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const italicMap={a:'𝘢',b:'𝘣',c:'𝘤',d:'𝘥',e:'𝘦',f:'𝘧',g:'𝘨',h:'𝘩',i:'𝘪',j:'𝘫',k:'𝘬',l:'𝘭',m:'𝘮',n:'𝘯',o:'𝘰',p:'𝘱',q:'𝘲',r:'𝘳',s:'𝘴',t:'𝘵',u:'𝘶',v:'𝘷',w:'𝘸',x:'𝘹',y:'𝘺',z:'𝘻',A:'𝘈',B:'𝘉',C:'𝘊',D:'𝘋',E:'𝘌',F:'𝘍',G:'𝘎',H:'𝘏',I:'𝘐',J:'𝘑',K:'𝘒',L:'𝘓',M:'𝘔',N:'𝘕',O:'𝘖',P:'𝘗',Q:'𝘘',R:'𝘙',S:'𝘚',T:'𝘛',U:'𝘜',V:'𝘝',W:'𝘞',X:'𝘟',Y:'𝘠',Z:'𝘡'}
reply([...ftIn].map(c=>italicMap[c]||c).join(''))
} break

case 'bolditalic': {
    await X.sendMessage(m.chat, { react: { text: '𝑩', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}bolditalic [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const biMap={a:'𝙖',b:'𝙗',c:'𝙘',d:'𝙙',e:'𝙚',f:'𝙛',g:'𝙜',h:'𝙝',i:'𝙞',j:'𝙟',k:'𝙠',l:'𝙡',m:'𝙢',n:'𝙣',o:'𝙤',p:'𝙥',q:'𝙦',r:'𝙧',s:'𝙨',t:'𝙩',u:'𝙪',v:'𝙫',w:'𝙬',x:'𝙭',y:'𝙮',z:'𝙯',A:'𝘼',B:'𝘽',C:'𝘾',D:'𝘿',E:'𝙀',F:'𝙁',G:'𝙂',H:'𝙃',I:'𝙄',J:'𝙅',K:'𝙆',L:'𝙇',M:'𝙈',N:'𝙉',O:'𝙊',P:'𝙋',Q:'𝙌',R:'𝙍',S:'𝙎',T:'𝙏',U:'𝙐',V:'𝙑',W:'𝙒',X:'𝙓',Y:'𝙔',Z:'𝙕'}
reply([...ftIn].map(c=>biMap[c]||c).join(''))
} break

case 'mono': {
    await X.sendMessage(m.chat, { react: { text: '𝙼', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}mono [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const monoMap={a:'𝚊',b:'𝚋',c:'𝚌',d:'𝚍',e:'𝚎',f:'𝚏',g:'𝚐',h:'𝚑',i:'𝚒',j:'𝚓',k:'𝚔',l:'𝚕',m:'𝚖',n:'𝚗',o:'𝚘',p:'𝚙',q:'𝚚',r:'𝚛',s:'𝚜',t:'𝚝',u:'𝚞',v:'𝚟',w:'𝚠',x:'𝚡',y:'𝚢',z:'𝚣',A:'𝙰',B:'𝙱',C:'𝙲',D:'𝙳',E:'𝙴',F:'𝙵',G:'𝙶',H:'𝙷',I:'𝙸',J:'𝙹',K:'𝙺',L:'𝙻',M:'𝙼',N:'𝙽',O:'𝙾',P:'𝙿',Q:'𝚀',R:'𝚁',S:'𝚂',T:'𝚃',U:'𝚄',V:'𝚅',W:'𝚆',X:'𝚇',Y:'𝚈',Z:'𝚉','0':'𝟶','1':'𝟷','2':'𝟸','3':'𝟹','4':'𝟺','5':'𝟻','6':'𝟼','7':'𝟽','8':'𝟾','9':'𝟿'}
reply([...ftIn].map(c=>monoMap[c]||c).join(''))
} break

case 'serif': {
    await X.sendMessage(m.chat, { react: { text: '𝐒', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}serif [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const serifMap={a:'𝐚',b:'𝐛',c:'𝐜',d:'𝐝',e:'𝐞',f:'𝐟',g:'𝐠',h:'𝐡',i:'𝐢',j:'𝐣',k:'𝐤',l:'𝐥',m:'𝐦',n:'𝐧',o:'𝐨',p:'𝐩',q:'𝐪',r:'𝐫',s:'𝐬',t:'𝐭',u:'𝐮',v:'𝐯',w:'𝐰',x:'𝐱',y:'𝐲',z:'𝐳',A:'𝐀',B:'𝐁',C:'𝐂',D:'𝐃',E:'𝐄',F:'𝐅',G:'𝐆',H:'𝐇',I:'𝐈',J:'𝐉',K:'𝐊',L:'𝐋',M:'𝐌',N:'𝐍',O:'𝐎',P:'𝐏',Q:'𝐐',R:'𝐑',S:'𝐒',T:'𝐓',U:'𝐔',V:'𝐕',W:'𝐖',X:'𝐗',Y:'𝐘',Z:'𝐙','0':'𝟎','1':'𝟏','2':'𝟐','3':'𝟑','4':'𝟒','5':'𝟓','6':'𝟔','7':'𝟕','8':'𝟖','9':'𝟗'}
reply([...ftIn].map(c=>serifMap[c]||c).join(''))
} break

case 'serifbold': {
    await X.sendMessage(m.chat, { react: { text: '𝐒', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}serifbold [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const sbMap={a:'𝐚',b:'𝐛',c:'𝐜',d:'𝐝',e:'𝐞',f:'𝐟',g:'𝐠',h:'𝐡',i:'𝐢',j:'𝐣',k:'𝐤',l:'𝐥',m:'𝐦',n:'𝐧',o:'𝐨',p:'𝐩',q:'𝐪',r:'𝐫',s:'𝐬',t:'𝐭',u:'𝐮',v:'𝐯',w:'𝐰',x:'𝐱',y:'𝐲',z:'𝐳',A:'𝐀',B:'𝐁',C:'𝐂',D:'𝐃',E:'𝐄',F:'𝐅',G:'𝐆',H:'𝐇',I:'𝐈',J:'𝐉',K:'𝐊',L:'𝐋',M:'𝐌',N:'𝐍',O:'𝐎',P:'𝐏',Q:'𝐐',R:'𝐑',S:'𝐒',T:'𝐓',U:'𝐔',V:'𝐕',W:'𝐖',X:'𝐗',Y:'𝐘',Z:'𝐙'}
reply([...ftIn].map(c=>sbMap[c]||c).join(''))
} break

case 'serifitalic': {
    await X.sendMessage(m.chat, { react: { text: '𝑆', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}serifitalic [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const siMap={a:'𝑎',b:'𝑏',c:'𝑐',d:'𝑑',e:'𝑒',f:'𝑓',g:'𝑔',h:'ℎ',i:'𝑖',j:'𝑗',k:'𝑘',l:'𝑙',m:'𝑚',n:'𝑛',o:'𝑜',p:'𝑝',q:'𝑞',r:'𝑟',s:'𝑠',t:'𝑡',u:'𝑢',v:'𝑣',w:'𝑤',x:'𝑥',y:'𝑦',z:'𝑧',A:'𝐴',B:'𝐵',C:'𝐶',D:'𝐷',E:'𝐸',F:'𝐹',G:'𝐺',H:'𝐻',I:'𝐼',J:'𝐽',K:'𝐾',L:'𝐿',M:'𝑀',N:'𝑁',O:'𝑂',P:'𝑃',Q:'𝑄',R:'𝑅',S:'𝑆',T:'𝑇',U:'𝑈',V:'𝑉',W:'𝑊',X:'𝑋',Y:'𝑌',Z:'𝑍'}
reply([...ftIn].map(c=>siMap[c]||c).join(''))
} break

case 'scriptfont': {
    await X.sendMessage(m.chat, { react: { text: '𝒮', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}scriptfont [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const scriptMap={a:'𝒶',b:'𝒷',c:'𝒸',d:'𝒹',e:'𝑒',f:'𝒻',g:'𝑔',h:'𝒽',i:'𝒾',j:'𝒿',k:'𝓀',l:'𝓁',m:'𝓂',n:'𝓃',o:'𝑜',p:'𝓅',q:'𝓆',r:'𝓇',s:'𝓈',t:'𝓉',u:'𝓊',v:'𝓋',w:'𝓌',x:'𝓍',y:'𝓎',z:'𝓏',A:'𝒜',B:'ℬ',C:'𝒞',D:'𝒟',E:'ℰ',F:'ℱ',G:'𝒢',H:'ℋ',I:'ℐ',J:'𝒥',K:'𝒦',L:'ℒ',M:'ℳ',N:'𝒩',O:'𝒪',P:'𝒫',Q:'𝒬',R:'ℛ',S:'𝒮',T:'𝒯',U:'𝒰',V:'𝒱',W:'𝒲',X:'𝒳',Y:'𝒴',Z:'𝒵'}
reply([...ftIn].map(c=>scriptMap[c]||c).join(''))
} break

case 'scriptbold': {
    await X.sendMessage(m.chat, { react: { text: '𝓢', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}scriptbold [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const scbMap={a:'𝓪',b:'𝓫',c:'𝓬',d:'𝓭',e:'𝓮',f:'𝓯',g:'𝓰',h:'𝓱',i:'𝓲',j:'𝓳',k:'𝓴',l:'𝓵',m:'𝓶',n:'𝓷',o:'𝓸',p:'𝓹',q:'𝓺',r:'𝓻',s:'𝓼',t:'𝓽',u:'𝓾',v:'𝓿',w:'𝔀',x:'𝔁',y:'𝔂',z:'𝔃',A:'𝓐',B:'𝓑',C:'𝓒',D:'𝓓',E:'𝓔',F:'𝓕',G:'𝓖',H:'𝓗',I:'𝓘',J:'𝓙',K:'𝓚',L:'𝓛',M:'𝓜',N:'𝓝',O:'𝓞',P:'𝓟',Q:'𝓠',R:'𝓡',S:'𝓢',T:'𝓣',U:'𝓤',V:'𝓥',W:'𝓦',X:'𝓧',Y:'𝓨',Z:'𝓩'}
reply([...ftIn].map(c=>scbMap[c]||c).join(''))
} break

case 'fraktur': {
    await X.sendMessage(m.chat, { react: { text: '𝔉', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}fraktur [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const frakMap={a:'𝔞',b:'𝔟',c:'𝔠',d:'𝔡',e:'𝔢',f:'𝔣',g:'𝔤',h:'𝔥',i:'𝔦',j:'𝔧',k:'𝔨',l:'𝔩',m:'𝔪',n:'𝔫',o:'𝔬',p:'𝔭',q:'𝔮',r:'𝔯',s:'𝔰',t:'𝔱',u:'𝔲',v:'𝔳',w:'𝔴',x:'𝔵',y:'𝔶',z:'𝔷',A:'𝔄',B:'𝔅',C:'ℭ',D:'𝔇',E:'𝔈',F:'𝔉',G:'𝔊',H:'ℌ',I:'ℑ',J:'𝔍',K:'𝔎',L:'𝔏',M:'𝔐',N:'𝔑',O:'𝔒',P:'𝔓',Q:'𝔔',R:'ℜ',S:'𝔖',T:'𝔗',U:'𝔘',V:'𝔙',W:'𝔚',X:'𝔛',Y:'𝔜',Z:'ℨ'}
reply([...ftIn].map(c=>frakMap[c]||c).join(''))
} break

case 'frakturbold': {
    await X.sendMessage(m.chat, { react: { text: '𝕱', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}frakturbold [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const fbMap={a:'𝖆',b:'𝖇',c:'𝖈',d:'𝖉',e:'𝖊',f:'𝖋',g:'𝖌',h:'𝖍',i:'𝖎',j:'𝖏',k:'𝖐',l:'𝖑',m:'𝖒',n:'𝖓',o:'𝖔',p:'𝖕',q:'𝖖',r:'𝖗',s:'𝖘',t:'𝖙',u:'𝖚',v:'𝖛',w:'𝖜',x:'𝖝',y:'𝖞',z:'𝖟',A:'𝕬',B:'𝕭',C:'𝕮',D:'𝕯',E:'𝕰',F:'𝕱',G:'𝕲',H:'𝕳',I:'𝕴',J:'𝕵',K:'𝕶',L:'𝕷',M:'𝕸',N:'𝕹',O:'𝕺',P:'𝕻',Q:'𝕼',R:'𝕽',S:'𝕾',T:'𝕿',U:'𝖀',V:'𝖁',W:'𝖂',X:'𝖃',Y:'𝖄',Z:'𝖅'}
reply([...ftIn].map(c=>fbMap[c]||c).join(''))
} break

case 'doublestruck': {
    await X.sendMessage(m.chat, { react: { text: '𝔻', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}doublestruck [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const dsMap={a:'𝕒',b:'𝕓',c:'𝕔',d:'𝕕',e:'𝕖',f:'𝕗',g:'𝕘',h:'𝕙',i:'𝕚',j:'𝕛',k:'𝕜',l:'𝕝',m:'𝕞',n:'𝕟',o:'𝕠',p:'𝕡',q:'𝕢',r:'𝕣',s:'𝕤',t:'𝕥',u:'𝕦',v:'𝕧',w:'𝕨',x:'𝕩',y:'𝕪',z:'𝕫',A:'𝔸',B:'𝔹',C:'ℂ',D:'𝔻',E:'𝔼',F:'𝔽',G:'𝔾',H:'ℍ',I:'𝕀',J:'𝕁',K:'𝕂',L:'𝕃',M:'𝕄',N:'ℕ',O:'𝕆',P:'ℙ',Q:'ℚ',R:'ℝ',S:'𝕊',T:'𝕋',U:'𝕌',V:'𝕍',W:'𝕎',X:'𝕏',Y:'𝕐',Z:'ℤ','0':'𝟘','1':'𝟙','2':'𝟚','3':'𝟛','4':'𝟜','5':'𝟝','6':'𝟞','7':'𝟟','8':'𝟠','9':'𝟡'}
reply([...ftIn].map(c=>dsMap[c]||c).join(''))
} break

case 'smallcaps': {
    await X.sendMessage(m.chat, { react: { text: 'ꜱ', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}smallcaps [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const scMap={a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ꜰ',g:'ɢ',h:'ʜ',i:'ɪ',j:'ᴊ',k:'ᴋ',l:'ʟ',m:'ᴍ',n:'ɴ',o:'ᴏ',p:'ᴘ',q:'Q',r:'ʀ',s:'ꜱ',t:'ᴛ',u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ',A:'ᴀ',B:'ʙ',C:'ᴄ',D:'ᴅ',E:'ᴇ',F:'ꜰ',G:'ɢ',H:'ʜ',I:'ɪ',J:'ᴊ',K:'ᴋ',L:'ʟ',M:'ᴍ',N:'ɴ',O:'ᴏ',P:'ᴘ',Q:'Q',R:'ʀ',S:'ꜱ',T:'ᴛ',U:'ᴜ',V:'ᴠ',W:'ᴡ',X:'x',Y:'ʏ',Z:'ᴢ'}
reply([...ftIn].map(c=>scMap[c]||c).join(''))
} break

case 'bubble': {
    await X.sendMessage(m.chat, { react: { text: '🔵', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}bubble [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const bubMap={a:'ⓐ',b:'ⓑ',c:'ⓒ',d:'ⓓ',e:'ⓔ',f:'ⓕ',g:'ⓖ',h:'ⓗ',i:'ⓘ',j:'ⓙ',k:'ⓚ',l:'ⓛ',m:'ⓜ',n:'ⓝ',o:'ⓞ',p:'ⓟ',q:'ⓠ',r:'ⓡ',s:'ⓢ',t:'ⓣ',u:'ⓤ',v:'ⓥ',w:'ⓦ',x:'ⓧ',y:'ⓨ',z:'ⓩ',A:'Ⓐ',B:'Ⓑ',C:'Ⓒ',D:'Ⓓ',E:'Ⓔ',F:'Ⓕ',G:'Ⓖ',H:'Ⓗ',I:'Ⓘ',J:'Ⓙ',K:'Ⓚ',L:'Ⓛ',M:'Ⓜ',N:'Ⓝ',O:'Ⓞ',P:'Ⓟ',Q:'Ⓠ',R:'Ⓡ',S:'Ⓢ',T:'Ⓣ',U:'Ⓤ',V:'Ⓥ',W:'Ⓦ',X:'Ⓧ',Y:'Ⓨ',Z:'Ⓩ','0':'⓪','1':'①','2':'②','3':'③','4':'④','5':'⑤','6':'⑥','7':'⑦','8':'⑧','9':'⑨'}
reply([...ftIn].map(c=>bubMap[c]||c).join(''))
} break

case 'bubblebold': {
    await X.sendMessage(m.chat, { react: { text: '🟦', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}bubblebold [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const bbbMap={a:'🅐',b:'🅑',c:'🅒',d:'🅓',e:'🅔',f:'🅕',g:'🅖',h:'🅗',i:'🅘',j:'🅙',k:'🅚',l:'🅛',m:'🅜',n:'🅝',o:'🅞',p:'🅟',q:'🅠',r:'🅡',s:'🅢',t:'🅣',u:'🅤',v:'🅥',w:'🅦',x:'🅧',y:'🅨',z:'🅩',A:'🅐',B:'🅑',C:'🅒',D:'🅓',E:'🅔',F:'🅕',G:'🅖',H:'🅗',I:'🅘',J:'🅙',K:'🅚',L:'🅛',M:'🅜',N:'🅝',O:'🅞',P:'🅟',Q:'🅠',R:'🅡',S:'🅢',T:'🅣',U:'🅤',V:'🅥',W:'🅦',X:'🅧',Y:'🅨',Z:'🅩'}
reply([...ftIn].map(c=>bbbMap[c]||c).join(''))
} break

case 'square': {
    await X.sendMessage(m.chat, { react: { text: '🟥', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}square [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const sqMap={a:'🄰',b:'🄱',c:'🄲',d:'🄳',e:'🄴',f:'🄵',g:'🄶',h:'🄷',i:'🄸',j:'🄹',k:'🄺',l:'🄻',m:'🄼',n:'🄽',o:'🄾',p:'🄿',q:'🅀',r:'🅁',s:'🅂',t:'🅃',u:'🅄',v:'🅅',w:'🅆',x:'🅇',y:'🅈',z:'🅉',A:'🄰',B:'🄱',C:'🄲',D:'🄳',E:'🄴',F:'🄵',G:'🄶',H:'🄷',I:'🄸',J:'🄹',K:'🄺',L:'🄻',M:'🄼',N:'🄽',O:'🄾',P:'🄿',Q:'🅀',R:'🅁',S:'🅂',T:'🅃',U:'🅄',V:'🅅',W:'🅆',X:'🅇',Y:'🅈',Z:'🅉'}
reply([...ftIn].map(c=>sqMap[c]||c).join(''))
} break

case 'squarebold': {
    await X.sendMessage(m.chat, { react: { text: '🟥', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}squarebold [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const sqbMap={a:'🅰',b:'🅱',c:'🅲',d:'🅳',e:'🅴',f:'🅵',g:'🅶',h:'🅷',i:'🅸',j:'🅹',k:'🅺',l:'🅻',m:'🅼',n:'🅽',o:'🅾',p:'🅿',q:'🆀',r:'🆁',s:'🆂',t:'🆃',u:'🆄',v:'🆅',w:'🆆',x:'🆇',y:'🆈',z:'🆉',A:'🅰',B:'🅱',C:'🅲',D:'🅳',E:'🅴',F:'🅵',G:'🅶',H:'🅷',I:'🅸',J:'🅹',K:'🅺',L:'🅻',M:'🅼',N:'🅽',O:'🅾',P:'🅿',Q:'🆀',R:'🆁',S:'🆂',T:'🆃',U:'🆄',V:'🆅',W:'🆆',X:'🆇',Y:'🆈',Z:'🆉'}
reply([...ftIn].map(c=>sqbMap[c]||c).join(''))
} break

case 'wide': {
    await X.sendMessage(m.chat, { react: { text: '🔡', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}wide [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
reply([...ftIn].map(c=>{let code=c.charCodeAt(0);return (code>=33&&code<=126)?String.fromCharCode(code+65248):c==' '?'　':c}).join(''))
} break

case 'upsidedown': {
    await X.sendMessage(m.chat, { react: { text: '🙃', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}upsidedown [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const udMap={a:'ɐ',b:'q',c:'ɔ',d:'p',e:'ǝ',f:'ɟ',g:'ƃ',h:'ɥ',i:'ᴉ',j:'ɾ',k:'ʞ',l:'l',m:'ɯ',n:'u',o:'o',p:'d',q:'b',r:'ɹ',s:'s',t:'ʇ',u:'n',v:'ʌ',w:'ʍ',x:'x',y:'ʎ',z:'z',A:'∀',B:'𐐒',C:'Ɔ',D:'ᗡ',E:'Ǝ',F:'Ⅎ',G:'פ',H:'H',I:'I',J:'ſ',K:'ʞ',L:'˥',M:'W',N:'N',O:'O',P:'Ԁ',Q:'Q',R:'ɹ',S:'S',T:'┴',U:'∩',V:'Λ',W:'M',X:'X',Y:'⅄',Z:'Z','0':'0','1':'Ɩ','2':'ᄅ','3':'Ɛ','4':'ㄣ','5':'ϛ','6':'9','7':'L','8':'8','9':'6',',':'\'','\'':',','.':'˙','?':'¿','!':'¡','(':')',')':'(','[':']',']':'[','{':'}','}':'{','<':'>','>':'<','&':'⅋',_:'‾'}
reply([...ftIn].map(c=>udMap[c]||c).join('').split('').reverse().join(''))
} break

case 'strikethrough': {
    await X.sendMessage(m.chat, { react: { text: '~~', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}strikethrough [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
reply([...ftIn].map(c=>c+'\u0336').join(''))
} break

case 'underline': {
    await X.sendMessage(m.chat, { react: { text: '📏', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}underline [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
reply([...ftIn].map(c=>c+'\u0332').join(''))
} break

case 'superscript': {
    await X.sendMessage(m.chat, { react: { text: '⁰', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}superscript [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const sspMap={a:'ᵃ',b:'ᵇ',c:'ᶜ',d:'ᵈ',e:'ᵉ',f:'ᶠ',g:'ᵍ',h:'ʰ',i:'ⁱ',j:'ʲ',k:'ᵏ',l:'ˡ',m:'ᵐ',n:'ⁿ',o:'ᵒ',p:'ᵖ',q:'q',r:'ʳ',s:'ˢ',t:'ᵗ',u:'ᵘ',v:'ᵛ',w:'ʷ',x:'ˣ',y:'ʸ',z:'ᶻ',A:'ᴬ',B:'ᴮ',C:'ᶜ',D:'ᴰ',E:'ᴱ',F:'ᶠ',G:'ᴳ',H:'ᴴ',I:'ᴵ',J:'ᴶ',K:'ᴷ',L:'ᴸ',M:'ᴹ',N:'ᴺ',O:'ᴼ',P:'ᴾ',Q:'Q',R:'ᴿ',S:'ˢ',T:'ᵀ',U:'ᵁ',V:'ᵛ',W:'ᵂ',X:'ˣ',Y:'ʸ',Z:'ᶻ','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'}
reply([...ftIn].map(c=>sspMap[c]||c).join(''))
} break

case 'subscript': {
    await X.sendMessage(m.chat, { react: { text: '₀', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}subscript [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const subMap={a:'ₐ',b:'b',c:'c',d:'d',e:'ₑ',f:'f',g:'g',h:'ₕ',i:'ᵢ',j:'ⱼ',k:'ₖ',l:'ₗ',m:'ₘ',n:'ₙ',o:'ₒ',p:'ₚ',q:'q',r:'ᵣ',s:'ₛ',t:'ₜ',u:'ᵤ',v:'ᵥ',w:'w',x:'ₓ',y:'y',z:'z',A:'A',B:'B',C:'C',D:'D',E:'E',F:'F',G:'G',H:'H',I:'I',J:'J',K:'K',L:'L',M:'M',N:'N',O:'O',P:'P',Q:'Q',R:'R',S:'S',T:'T',U:'U',V:'V',W:'W',X:'X',Y:'Y',Z:'Z','0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉'}
reply([...ftIn].map(c=>subMap[c]||c).join(''))
} break

case 'medieval': {
    await X.sendMessage(m.chat, { react: { text: '🏰', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}medieval [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const medMap={a:'𝔞',b:'𝔟',c:'𝔠',d:'𝔡',e:'𝔢',f:'𝔣',g:'𝔤',h:'𝔥',i:'𝔦',j:'𝔧',k:'𝔨',l:'𝔩',m:'𝔪',n:'𝔫',o:'𝔬',p:'𝔭',q:'𝔮',r:'𝔯',s:'𝔰',t:'𝔱',u:'𝔲',v:'𝔳',w:'𝔴',x:'𝔵',y:'𝔶',z:'𝔷',A:'𝕬',B:'𝕭',C:'𝕮',D:'𝕯',E:'𝕰',F:'𝕱',G:'𝕲',H:'𝕳',I:'𝕴',J:'𝕵',K:'𝕶',L:'𝕷',M:'𝕸',N:'𝕹',O:'𝕺',P:'𝕻',Q:'𝕼',R:'𝕽',S:'𝕾',T:'𝕿',U:'𝖀',V:'𝖁',W:'𝖂',X:'𝖃',Y:'𝖄',Z:'𝖅'}
reply([...ftIn].map(c=>medMap[c]||c).join(''))
} break

case 'circled': {
    await X.sendMessage(m.chat, { react: { text: '⭕', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}circled [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const cirMap={a:'ⓐ',b:'ⓑ',c:'ⓒ',d:'ⓓ',e:'ⓔ',f:'ⓕ',g:'ⓖ',h:'ⓗ',i:'ⓘ',j:'ⓙ',k:'ⓚ',l:'ⓛ',m:'ⓜ',n:'ⓝ',o:'ⓞ',p:'ⓟ',q:'ⓠ',r:'ⓡ',s:'ⓢ',t:'ⓣ',u:'ⓤ',v:'ⓥ',w:'ⓦ',x:'ⓧ',y:'ⓨ',z:'ⓩ',A:'Ⓐ',B:'Ⓑ',C:'Ⓒ',D:'Ⓓ',E:'Ⓔ',F:'Ⓕ',G:'Ⓖ',H:'Ⓗ',I:'Ⓘ',J:'Ⓙ',K:'Ⓚ',L:'Ⓛ',M:'Ⓜ',N:'Ⓝ',O:'Ⓞ',P:'Ⓟ',Q:'Ⓠ',R:'Ⓡ',S:'Ⓢ',T:'Ⓣ',U:'Ⓤ',V:'Ⓥ',W:'Ⓦ',X:'Ⓧ',Y:'Ⓨ',Z:'Ⓩ','0':'⓪','1':'①','2':'②','3':'③','4':'④','5':'⑤','6':'⑥','7':'⑦','8':'⑧','9':'⑨'}
reply([...ftIn].map(c=>cirMap[c]||c).join(''))
} break

case 'negative': {
    await X.sendMessage(m.chat, { react: { text: '🔲', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}negative [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const negMap={a:'🅐',b:'🅑',c:'🅒',d:'🅓',e:'🅔',f:'🅕',g:'🅖',h:'🅗',i:'🅘',j:'🅙',k:'🅚',l:'🅛',m:'🅜',n:'🅝',o:'🅞',p:'🅟',q:'🅠',r:'🅡',s:'🅢',t:'🅣',u:'🅤',v:'🅥',w:'🅦',x:'🅧',y:'🅨',z:'🅩',A:'🅐',B:'🅑',C:'🅒',D:'🅓',E:'🅔',F:'🅕',G:'🅖',H:'🅗',I:'🅘',J:'🅙',K:'🅚',L:'🅛',M:'🅜',N:'🅝',O:'🅞',P:'🅟',Q:'🅠',R:'🅡',S:'🅢',T:'🅣',U:'🅤',V:'🅥',W:'🅦',X:'🅧',Y:'🅨',Z:'🅩'}
reply([...ftIn].map(c=>negMap[c]||c).join(''))
} break

case 'parenthesized': {
    await X.sendMessage(m.chat, { react: { text: '〔〕', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}parenthesized [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const parMap={a:'⒜',b:'⒝',c:'⒞',d:'⒟',e:'⒠',f:'⒡',g:'⒢',h:'⒣',i:'⒤',j:'⒥',k:'⒦',l:'⒧',m:'⒨',n:'⒩',o:'⒪',p:'⒫',q:'⒬',r:'⒭',s:'⒮',t:'⒯',u:'⒰',v:'⒱',w:'⒲',x:'⒳',y:'⒴',z:'⒵',A:'⒜',B:'⒝',C:'⒞',D:'⒟',E:'⒠',F:'⒡',G:'⒢',H:'⒣',I:'⒤',J:'⒥',K:'⒦',L:'⒧',M:'⒨',N:'⒩',O:'⒪',P:'⒫',Q:'⒬',R:'⒭',S:'⒮',T:'⒯',U:'⒰',V:'⒱',W:'⒲',X:'⒳',Y:'⒴',Z:'⒵'}
reply([...ftIn].map(c=>parMap[c]||c).join(''))
} break

case 'gothic': {
    await X.sendMessage(m.chat, { react: { text: '🦇', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}gothic [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const gotMap={a:'𝖆',b:'𝖇',c:'𝖈',d:'𝖉',e:'𝖊',f:'𝖋',g:'𝖌',h:'𝖍',i:'𝖎',j:'𝖏',k:'𝖐',l:'𝖑',m:'𝖒',n:'𝖓',o:'𝖔',p:'𝖕',q:'𝖖',r:'𝖗',s:'𝖘',t:'𝖙',u:'𝖚',v:'𝖛',w:'𝖜',x:'𝖝',y:'𝖞',z:'𝖟',A:'𝔄',B:'𝔅',C:'ℭ',D:'𝔇',E:'𝔈',F:'𝔉',G:'𝔊',H:'ℌ',I:'ℑ',J:'𝔍',K:'𝔎',L:'𝔏',M:'𝔐',N:'𝔑',O:'𝔒',P:'𝔓',Q:'𝔔',R:'ℜ',S:'𝔖',T:'𝔗',U:'𝔘',V:'𝔙',W:'𝔚',X:'𝔛',Y:'𝔜',Z:'ℨ'}
reply([...ftIn].map(c=>gotMap[c]||c).join(''))
} break

case 'cursive': {
    await X.sendMessage(m.chat, { react: { text: '✒️', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}cursive [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const crvMap={a:'𝓪',b:'𝓫',c:'𝓬',d:'𝓭',e:'𝓮',f:'𝓯',g:'𝓰',h:'𝓱',i:'𝓲',j:'𝓳',k:'𝓴',l:'𝓵',m:'𝓶',n:'𝓷',o:'𝓸',p:'𝓹',q:'𝓺',r:'𝓻',s:'𝓼',t:'𝓽',u:'𝓾',v:'𝓿',w:'𝔀',x:'𝔁',y:'𝔂',z:'𝔃',A:'𝓐',B:'𝓑',C:'𝓒',D:'𝓓',E:'𝓔',F:'𝓕',G:'𝓖',H:'𝓗',I:'𝓘',J:'𝓙',K:'𝓚',L:'𝓛',M:'𝓜',N:'𝓝',O:'𝓞',P:'𝓟',Q:'𝓠',R:'𝓡',S:'𝓢',T:'𝓣',U:'𝓤',V:'𝓥',W:'𝓦',X:'𝓧',Y:'𝓨',Z:'𝓩'}
reply([...ftIn].map(c=>crvMap[c]||c).join(''))
} break

case 'aesthetic': {
    await X.sendMessage(m.chat, { react: { text: '✨', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}aesthetic [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const aesMap={a:'ａ',b:'ｂ',c:'ｃ',d:'ｄ',e:'ｅ',f:'ｆ',g:'ｇ',h:'ｈ',i:'ｉ',j:'ｊ',k:'ｋ',l:'ｌ',m:'ｍ',n:'ｎ',o:'ｏ',p:'ｐ',q:'ｑ',r:'ｒ',s:'ｓ',t:'ｔ',u:'ｕ',v:'ｖ',w:'ｗ',x:'ｘ',y:'ｙ',z:'ｚ',A:'Ａ',B:'Ｂ',C:'Ｃ',D:'Ｄ',E:'Ｅ',F:'Ｆ',G:'Ｇ',H:'Ｈ',I:'Ｉ',J:'Ｊ',K:'Ｋ',L:'Ｌ',M:'Ｍ',N:'Ｎ',O:'Ｏ',P:'Ｐ',Q:'Ｑ',R:'Ｒ',S:'Ｓ',T:'Ｔ',U:'Ｕ',V:'Ｖ',W:'Ｗ',X:'Ｘ',Y:'Ｙ',Z:'Ｚ','0':'０','1':'１','2':'２','3':'３','4':'４','5':'５','6':'６','7':'７','8':'８','9':'９'}
reply([...ftIn].map(c=>aesMap[c]||c).join(''))
} break

case 'tiny': {
    await X.sendMessage(m.chat, { react: { text: '🔹', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}tiny [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const tnyMap={a:'ᵃ',b:'ᵇ',c:'ᶜ',d:'ᵈ',e:'ᵉ',f:'ᶠ',g:'ᵍ',h:'ʰ',i:'ⁱ',j:'ʲ',k:'ᵏ',l:'ˡ',m:'ᵐ',n:'ⁿ',o:'ᵒ',p:'ᵖ',q:'q',r:'ʳ',s:'ˢ',t:'ᵗ',u:'ᵘ',v:'ᵛ',w:'ʷ',x:'ˣ',y:'ʸ',z:'ᶻ',A:'ᴬ',B:'ᴮ',C:'ᶜ',D:'ᴰ',E:'ᴱ',F:'ᶠ',G:'ᴳ',H:'ᴴ',I:'ᴵ',J:'ᴶ',K:'ᴷ',L:'ᴸ',M:'ᴹ',N:'ᴺ',O:'ᴼ',P:'ᴾ',Q:'Q',R:'ᴿ',S:'ˢ',T:'ᵀ',U:'ᵁ',V:'ᵛ',W:'ᵂ',X:'ˣ',Y:'ʸ',Z:'ᶻ'}
reply([...ftIn].map(c=>tnyMap[c]||c).join(''))
} break

case 'inverted': {
    await X.sendMessage(m.chat, { react: { text: '🔄', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}inverted [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const invMap={a:'ɐ',b:'q',c:'ɔ',d:'p',e:'ǝ',f:'ɟ',g:'ƃ',h:'ɥ',i:'ᴉ',j:'ɾ',k:'ʞ',l:'l',m:'ɯ',n:'u',o:'o',p:'d',q:'b',r:'ɹ',s:'s',t:'ʇ',u:'n',v:'ʌ',w:'ʍ',x:'x',y:'ʎ',z:'z',A:'∀',B:'q',C:'Ɔ',D:'p',E:'Ǝ',F:'Ⅎ',G:'פ',H:'H',I:'I',J:'ɾ',K:'ʞ',L:'˥',M:'W',N:'N',O:'O',P:'Ԁ',Q:'Q',R:'ɹ',S:'S',T:'┴',U:'∩',V:'Λ',W:'M',X:'X',Y:'ʎ',Z:'Z'}
reply([...ftIn].map(c=>invMap[c]||c).join('').split('').reverse().join(''))
} break

case 'mirror': {
    await X.sendMessage(m.chat, { react: { text: '🔁', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}mirror [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const mirMap={a:'ɒ',b:'d',c:'ɔ',d:'b',e:'ɘ',f:'ʇ',g:'ϱ',h:'ʜ',i:'i',j:'ᴉ',k:'ʞ',l:'l',m:'m',n:'n',o:'o',p:'q',q:'p',r:'ɿ',s:'ƨ',t:'ƚ',u:'u',v:'v',w:'w',x:'x',y:'y',z:'z',A:'A',B:'ᗺ',C:'Ɔ',D:'ᗡ',E:'Ǝ',F:'ꟻ',G:'Ꭾ',H:'H',I:'I',J:'Ꮈ',K:'ꓘ',L:'⅃',M:'M',N:'И',O:'O',P:'ꟼ',Q:'Ọ',R:'Я',S:'Ƨ',T:'T',U:'U',V:'V',W:'W',X:'X',Y:'Y',Z:'Z'}
reply([...ftIn].map(c=>mirMap[c]||c).join('').split('').reverse().join(''))
} break

case 'currency': {
    await X.sendMessage(m.chat, { react: { text: '💱', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}currency [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const curMap={a:'₳',b:'฿',c:'₵',d:'₫',e:'€',f:'₣',g:'₲',h:'♄',i:'ł',j:'ʝ',k:'₭',l:'₤',m:'₥',n:'₦',o:'ø',p:'₱',q:'q',r:'®',s:'$',t:'₮',u:'µ',v:'√',w:'₩',x:'×',y:'¥',z:'z',A:'₳',B:'฿',C:'₵',D:'₫',E:'€',F:'₣',G:'₲',H:'♄',I:'ł',J:'ʝ',K:'₭',L:'₤',M:'₥',N:'₦',O:'ø',P:'₱',Q:'Q',R:'®',S:'$',T:'₮',U:'µ',V:'√',W:'₩',X:'×',Y:'¥',Z:'Z'}
reply([...ftIn].map(c=>curMap[c]||c).join(''))
} break

case 'dotted': {
    await X.sendMessage(m.chat, { react: { text: '·', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}dotted [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const dotMap={a:'ȧ',b:'ḃ',c:'ċ',d:'ḋ',e:'ė',f:'ḟ',g:'ġ',h:'ḣ',i:'ı',j:'j',k:'k',l:'l',m:'ṁ',n:'ṅ',o:'ȯ',p:'ṗ',q:'q',r:'ṙ',s:'ṡ',t:'ṫ',u:'u',v:'v',w:'ẇ',x:'ẋ',y:'ẏ',z:'ż',A:'Ȧ',B:'Ḃ',C:'Ċ',D:'Ḋ',E:'Ė',F:'Ḟ',G:'Ġ',H:'Ḣ',I:'İ',J:'J',K:'K',L:'L',M:'Ṁ',N:'Ṅ',O:'Ȯ',P:'Ṗ',Q:'Q',R:'Ṙ',S:'Ṡ',T:'Ṫ',U:'U',V:'V',W:'Ẇ',X:'Ẋ',Y:'Ẏ',Z:'Ż'}
reply([...ftIn].map(c=>dotMap[c]||c).join(''))
} break

case 'oldeng': {
    await X.sendMessage(m.chat, { react: { text: '📜', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}oldeng [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const oengMap={a:'𝒶',b:'𝒷',c:'𝒸',d:'𝒹',e:'𝑒',f:'𝒻',g:'𝑔',h:'𝒽',i:'𝒾',j:'𝒿',k:'𝓀',l:'𝓁',m:'𝓂',n:'𝓃',o:'𝑜',p:'𝓅',q:'𝓆',r:'𝓇',s:'𝓈',t:'𝓉',u:'𝓊',v:'𝓋',w:'𝓌',x:'𝓍',y:'𝓎',z:'𝓏',A:'𝒜',B:'ℬ',C:'𝒞',D:'𝒟',E:'ℰ',F:'ℱ',G:'𝒢',H:'ℋ',I:'ℐ',J:'𝒥',K:'𝒦',L:'ℒ',M:'ℳ',N:'𝒩',O:'𝒪',P:'𝒫',Q:'𝒬',R:'ℛ',S:'𝒮',T:'𝒯',U:'𝒰',V:'𝒱',W:'𝒲',X:'𝒳',Y:'𝒴',Z:'𝒵'}
reply([...ftIn].map(c=>oengMap[c]||c).join(''))
} break

case 'allfonts': {
    await X.sendMessage(m.chat, { react: { text: '🔤', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let ftIn = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
if (!ftIn) return reply(`╔══〔 🔤 FONT CONVERTER 〕══╗\n\n║ Usage: *${prefix}allfonts [text]*\n║ Or reply to any message with the command\n╚═══════════════════════╝`)
const maps = {
  'Bold Sans':       {a:'𝗮',b:'𝗯',c:'𝗰',d:'𝗱',e:'𝗲',f:'𝗳',g:'𝗴',h:'𝗵',i:'𝗶',j:'𝗷',k:'𝗸',l:'𝗹',m:'𝗺',n:'𝗻',o:'𝗼',p:'𝗽',q:'𝗾',r:'𝗿',s:'𝘀',t:'𝘁',u:'𝘂',v:'𝘃',w:'𝘄',x:'𝘅',y:'𝘆',z:'𝘇',A:'𝗔',B:'𝗕',C:'𝗖',D:'𝗗',E:'𝗘',F:'𝗙',G:'𝗚',H:'𝗛',I:'𝗜',J:'𝗝',K:'𝗞',L:'𝗟',M:'𝗠',N:'𝗡',O:'𝗢',P:'𝗣',Q:'𝗤',R:'𝗥',S:'𝗦',T:'𝗧',U:'𝗨',V:'𝗩',W:'𝗪',X:'𝗫',Y:'𝗬',Z:'𝗭'},
  'Italic Sans':     {a:'𝘢',b:'𝘣',c:'𝘤',d:'𝘥',e:'𝘦',f:'𝘧',g:'𝘨',h:'𝘩',i:'𝘪',j:'𝘫',k:'𝘬',l:'𝘭',m:'𝘮',n:'𝘯',o:'𝘰',p:'𝘱',q:'𝘲',r:'𝘳',s:'𝘴',t:'𝘵',u:'𝘶',v:'𝘷',w:'𝘸',x:'𝘹',y:'𝘺',z:'𝘻',A:'𝘈',B:'𝘉',C:'𝘊',D:'𝘋',E:'𝘌',F:'𝘍',G:'𝘎',H:'𝘏',I:'𝘐',J:'𝘑',K:'𝘒',L:'𝘓',M:'𝘔',N:'𝘕',O:'𝘖',P:'𝘗',Q:'𝘘',R:'𝘙',S:'𝘚',T:'𝘛',U:'𝘜',V:'𝘝',W:'𝘞',X:'𝘟',Y:'𝘠',Z:'𝘡'},
  'Bold Italic':     {a:'𝙖',b:'𝙗',c:'𝙘',d:'𝙙',e:'𝙚',f:'𝙛',g:'𝙜',h:'𝙝',i:'𝙞',j:'𝙟',k:'𝙠',l:'𝙡',m:'𝙢',n:'𝙣',o:'𝙤',p:'𝙥',q:'𝙦',r:'𝙧',s:'𝙨',t:'𝙩',u:'𝙪',v:'𝙫',w:'𝙬',x:'𝙭',y:'𝙮',z:'𝙯',A:'𝘼',B:'𝘽',C:'𝘾',D:'𝘿',E:'𝙀',F:'𝙁',G:'𝙂',H:'𝙃',I:'𝙄',J:'𝙅',K:'𝙆',L:'𝙇',M:'𝙈',N:'𝙉',O:'𝙊',P:'𝙋',Q:'𝙌',R:'𝙍',S:'𝙎',T:'𝙏',U:'𝙐',V:'𝙑',W:'𝙒',X:'𝙓',Y:'𝙔',Z:'𝙕'},
  'Mono':            {a:'𝚊',b:'𝚋',c:'𝚌',d:'𝚍',e:'𝚎',f:'𝚏',g:'𝚐',h:'𝚑',i:'𝚒',j:'𝚓',k:'𝚔',l:'𝚕',m:'𝚖',n:'𝚗',o:'𝚘',p:'𝚙',q:'𝚚',r:'𝚛',s:'𝚜',t:'𝚝',u:'𝚞',v:'𝚟',w:'𝚠',x:'𝚡',y:'𝚢',z:'𝚣',A:'𝙰',B:'𝙱',C:'𝙲',D:'𝙳',E:'𝙴',F:'𝙵',G:'𝙶',H:'𝙷',I:'𝙸',J:'𝙹',K:'𝙺',L:'𝙻',M:'𝙼',N:'𝙽',O:'𝙾',P:'𝙿',Q:'𝚀',R:'𝚁',S:'𝚂',T:'𝚃',U:'𝚄',V:'𝚅',W:'𝚆',X:'𝚇',Y:'𝚈',Z:'𝚉'},
  'Script':          {a:'𝒶',b:'𝒷',c:'𝒸',d:'𝒹',e:'𝑒',f:'𝒻',g:'𝑔',h:'𝒽',i:'𝒾',j:'𝒿',k:'𝓀',l:'𝓁',m:'𝓂',n:'𝓃',o:'𝑜',p:'𝓅',q:'𝓆',r:'𝓇',s:'𝓈',t:'𝓉',u:'𝓊',v:'𝓋',w:'𝓌',x:'𝓍',y:'𝓎',z:'𝓏',A:'𝒜',B:'ℬ',C:'𝒞',D:'𝒟',E:'ℰ',F:'ℱ',G:'𝒢',H:'ℋ',I:'ℐ',J:'𝒥',K:'𝒦',L:'ℒ',M:'ℳ',N:'𝒩',O:'𝒪',P:'𝒫',Q:'𝒬',R:'ℛ',S:'𝒮',T:'𝒯',U:'𝒰',V:'𝒱',W:'𝒲',X:'𝒳',Y:'𝒴',Z:'𝒵'},
  'Bold Script':     {a:'𝓪',b:'𝓫',c:'𝓬',d:'𝓭',e:'𝓮',f:'𝓯',g:'𝓰',h:'𝓱',i:'𝓲',j:'𝓳',k:'𝓴',l:'𝓵',m:'𝓶',n:'𝓷',o:'𝓸',p:'𝓹',q:'𝓺',r:'𝓻',s:'𝓼',t:'𝓽',u:'𝓾',v:'𝓿',w:'𝔀',x:'𝔁',y:'𝔂',z:'𝔃',A:'𝓐',B:'𝓑',C:'𝓒',D:'𝓓',E:'𝓔',F:'𝓕',G:'𝓖',H:'𝓗',I:'𝓘',J:'𝓙',K:'𝓚',L:'𝓛',M:'𝓜',N:'𝓝',O:'𝓞',P:'𝓟',Q:'𝓠',R:'𝓡',S:'𝓢',T:'𝓣',U:'𝓤',V:'𝓥',W:'𝓦',X:'𝓧',Y:'𝓨',Z:'𝓩'},
  'Fraktur':         {a:'𝔞',b:'𝔟',c:'𝔠',d:'𝔡',e:'𝔢',f:'𝔣',g:'𝔤',h:'𝔥',i:'𝔦',j:'𝔧',k:'𝔨',l:'𝔩',m:'𝔪',n:'𝔫',o:'𝔬',p:'𝔭',q:'𝔮',r:'𝔯',s:'𝔰',t:'𝔱',u:'𝔲',v:'𝔳',w:'𝔴',x:'𝔵',y:'𝔶',z:'𝔷',A:'𝔄',B:'𝔅',C:'ℭ',D:'𝔇',E:'𝔈',F:'𝔉',G:'𝔊',H:'ℌ',I:'ℑ',J:'𝔍',K:'𝔎',L:'𝔏',M:'𝔐',N:'𝔑',O:'𝔒',P:'𝔓',Q:'𝔔',R:'ℜ',S:'𝔖',T:'𝔗',U:'𝔘',V:'𝔙',W:'𝔚',X:'𝔛',Y:'𝔜',Z:'ℨ'},
  'Bold Fraktur':    {a:'𝖆',b:'𝖇',c:'𝖈',d:'𝖉',e:'𝖊',f:'𝖋',g:'𝖌',h:'𝖍',i:'𝖎',j:'𝖏',k:'𝖐',l:'𝖑',m:'𝖒',n:'𝖓',o:'𝖔',p:'𝖕',q:'𝖖',r:'𝖗',s:'𝖘',t:'𝖙',u:'𝖚',v:'𝖛',w:'𝖜',x:'𝖝',y:'𝖞',z:'𝖟',A:'𝕬',B:'𝕭',C:'𝕮',D:'𝕯',E:'𝕰',F:'𝕱',G:'𝕲',H:'𝕳',I:'𝕴',J:'𝕵',K:'𝕶',L:'𝕷',M:'𝕸',N:'𝕹',O:'𝕺',P:'𝕻',Q:'𝕼',R:'𝕽',S:'𝕾',T:'𝕿',U:'𝖀',V:'𝖁',W:'𝖂',X:'𝖃',Y:'𝖄',Z:'𝖅'},
  'Double Struck':   {a:'𝕒',b:'𝕓',c:'𝕔',d:'𝕕',e:'𝕖',f:'𝕗',g:'𝕘',h:'𝕙',i:'𝕚',j:'𝕛',k:'𝕜',l:'𝕝',m:'𝕞',n:'𝕟',o:'𝕠',p:'𝕡',q:'𝕢',r:'𝕣',s:'𝕤',t:'𝕥',u:'𝕦',v:'𝕧',w:'𝕨',x:'𝕩',y:'𝕪',z:'𝕫',A:'𝔸',B:'𝔹',C:'ℂ',D:'𝔻',E:'𝔼',F:'𝔽',G:'𝔾',H:'ℍ',I:'𝕀',J:'𝕁',K:'𝕂',L:'𝕃',M:'𝕄',N:'ℕ',O:'𝕆',P:'ℙ',Q:'ℚ',R:'ℝ',S:'𝕊',T:'𝕋',U:'𝕌',V:'𝕍',W:'𝕎',X:'𝕏',Y:'𝕐',Z:'ℤ'},
  'Small Caps':      {a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ꜰ',g:'ɢ',h:'ʜ',i:'ɪ',j:'ᴊ',k:'ᴋ',l:'ʟ',m:'ᴍ',n:'ɴ',o:'ᴏ',p:'ᴘ',q:'Q',r:'ʀ',s:'ꜱ',t:'ᴛ',u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ',A:'ᴀ',B:'ʙ',C:'ᴄ',D:'ᴅ',E:'ᴇ',F:'ꜰ',G:'ɢ',H:'ʜ',I:'ɪ',J:'ᴊ',K:'ᴋ',L:'ʟ',M:'ᴍ',N:'ɴ',O:'ᴏ',P:'ᴘ',Q:'Q',R:'ʀ',S:'ꜱ',T:'ᴛ',U:'ᴜ',V:'ᴠ',W:'ᴡ',X:'x',Y:'ʏ',Z:'ᴢ'},
  'Bubble':          {a:'ⓐ',b:'ⓑ',c:'ⓒ',d:'ⓓ',e:'ⓔ',f:'ⓕ',g:'ⓖ',h:'ⓗ',i:'ⓘ',j:'ⓙ',k:'ⓚ',l:'ⓛ',m:'ⓜ',n:'ⓝ',o:'ⓞ',p:'ⓟ',q:'ⓠ',r:'ⓡ',s:'ⓢ',t:'ⓣ',u:'ⓤ',v:'ⓥ',w:'ⓦ',x:'ⓧ',y:'ⓨ',z:'ⓩ',A:'Ⓐ',B:'Ⓑ',C:'Ⓒ',D:'Ⓓ',E:'Ⓔ',F:'Ⓕ',G:'Ⓖ',H:'Ⓗ',I:'Ⓘ',J:'Ⓙ',K:'Ⓚ',L:'Ⓛ',M:'Ⓜ',N:'Ⓝ',O:'Ⓞ',P:'Ⓟ',Q:'Ⓠ',R:'Ⓡ',S:'Ⓢ',T:'Ⓣ',U:'Ⓤ',V:'Ⓥ',W:'Ⓦ',X:'Ⓧ',Y:'Ⓨ',Z:'Ⓩ'},
  'Wide':            {},
  'Medieval':        {a:'\u{1D51E}',b:'\u{1D51F}',c:'\u{1D520}',d:'\u{1D521}',e:'\u{1D522}',f:'\u{1D523}',g:'\u{1D524}',h:'\u{1D525}',i:'\u{1D526}',j:'\u{1D527}',k:'\u{1D528}',l:'\u{1D529}',m:'\u{1D52A}',n:'\u{1D52B}',o:'\u{1D52C}',p:'\u{1D52D}',q:'\u{1D52E}',r:'\u{1D52F}',s:'\u{1D530}',t:'\u{1D531}',u:'\u{1D532}',v:'\u{1D533}',w:'\u{1D534}',x:'\u{1D535}',y:'\u{1D536}',z:'\u{1D537}',A:'\u{1D504}',B:'\u{1D505}',C:'\u212D',D:'\u{1D507}',E:'\u{1D508}',F:'\u{1D509}',G:'\u{1D50A}',H:'\u210C',I:'\u2111',J:'\u{1D50D}',K:'\u{1D50E}',L:'\u{1D50F}',M:'\u{1D510}',N:'\u{1D511}',O:'\u{1D512}',P:'\u{1D513}',Q:'\u{1D514}',R:'\u211C',S:'\u{1D516}',T:'\u{1D517}',U:'\u{1D518}',V:'\u{1D519}',W:'\u{1D51A}',X:'\u{1D51B}',Y:'\u{1D51C}',Z:'\u2128'},
  'Cursive':         {a:'\u{1D4EA}',b:'\u{1D4EB}',c:'\u{1D4EC}',d:'\u{1D4ED}',e:'\u{1D4EE}',f:'\u{1D4EF}',g:'\u{1D4F0}',h:'\u{1D4F1}',i:'\u{1D4F2}',j:'\u{1D4F3}',k:'\u{1D4F4}',l:'\u{1D4F5}',m:'\u{1D4F6}',n:'\u{1D4F7}',o:'\u{1D4F8}',p:'\u{1D4F9}',q:'\u{1D4FA}',r:'\u{1D4FB}',s:'\u{1D4FC}',t:'\u{1D4FD}',u:'\u{1D4FE}',v:'\u{1D4FF}',w:'\u{1D500}',x:'\u{1D501}',y:'\u{1D502}',z:'\u{1D503}',A:'\u{1D4D0}',B:'\u{1D4D1}',C:'\u{1D4D2}',D:'\u{1D4D3}',E:'\u{1D4D4}',F:'\u{1D4D5}',G:'\u{1D4D6}',H:'\u{1D4D7}',I:'\u{1D4D8}',J:'\u{1D4D9}',K:'\u{1D4DA}',L:'\u{1D4DB}',M:'\u{1D4DC}',N:'\u{1D4DD}',O:'\u{1D4DE}',P:'\u{1D4DF}',Q:'\u{1D4E0}',R:'\u{1D4E1}',S:'\u{1D4E2}',T:'\u{1D4E3}',U:'\u{1D4E4}',V:'\u{1D4E5}',W:'\u{1D4E6}',X:'\u{1D4E7}',Y:'\u{1D4E8}',Z:'\u{1D4E9}'},
  'Aesthetic':       {a:'ａ',b:'ｂ',c:'ｃ',d:'ｄ',e:'ｅ',f:'ｆ',g:'ｇ',h:'ｈ',i:'ｉ',j:'ｊ',k:'ｋ',l:'ｌ',m:'ｍ',n:'ｎ',o:'ｏ',p:'ｐ',q:'ｑ',r:'ｒ',s:'ｓ',t:'ｔ',u:'ｕ',v:'ｖ',w:'ｗ',x:'ｘ',y:'ｙ',z:'ｚ',A:'Ａ',B:'Ｂ',C:'Ｃ',D:'Ｄ',E:'Ｅ',F:'Ｆ',G:'Ｇ',H:'Ｈ',I:'Ｉ',J:'Ｊ',K:'Ｋ',L:'Ｌ',M:'Ｍ',N:'Ｎ',O:'Ｏ',P:'Ｐ',Q:'Ｑ',R:'Ｒ',S:'Ｓ',T:'Ｔ',U:'Ｕ',V:'Ｖ',W:'Ｗ',X:'Ｘ',Y:'Ｙ',Z:'Ｚ'},
  'Tiny':            {a:'ᵃ',b:'ᵇ',c:'ᶜ',d:'ᵈ',e:'ᵉ',f:'ᶠ',g:'ᵍ',h:'ʰ',i:'ⁱ',j:'ʲ',k:'ᵏ',l:'ˡ',m:'ᵐ',n:'ⁿ',o:'ᵒ',p:'ᵖ',q:'q',r:'ʳ',s:'ˢ',t:'ᵗ',u:'ᵘ',v:'ᵛ',w:'ʷ',x:'ˣ',y:'ʸ',z:'ᶻ',A:'ᴬ',B:'ᴮ',C:'ᶜ',D:'ᴰ',E:'ᴱ',F:'ᶠ',G:'ᴳ',H:'ᴴ',I:'ᴵ',J:'ᴶ',K:'ᴷ',L:'ᴸ',M:'ᴹ',N:'ᴺ',O:'ᴼ',P:'ᴾ',Q:'Q',R:'ᴿ',S:'ˢ',T:'ᵀ',U:'ᵁ',V:'ᵛ',W:'ᵂ',X:'ˣ',Y:'ʸ',Z:'ᶻ'},
  'Inverted':        {a:'ɐ',b:'q',c:'ɔ',d:'p',e:'ǝ',f:'ɟ',g:'ƃ',h:'ɥ',i:'ᴉ',j:'ɾ',k:'ʞ',l:'l',m:'ɯ',n:'u',o:'o',p:'d',q:'b',r:'ɹ',s:'s',t:'ʇ',u:'n',v:'ʌ',w:'ʍ',x:'x',y:'ʎ',z:'z',A:'∀',B:'q',C:'Ɔ',D:'p',E:'Ǝ',F:'Ⅎ',G:'פ',H:'H',I:'I',J:'ɾ',K:'ʞ',L:'˥',M:'W',N:'N',O:'O',P:'Ԁ',Q:'Q',R:'ɹ',S:'S',T:'┴',U:'∩',V:'Λ',W:'M',X:'X',Y:'ʎ',Z:'Z'},
  'Mirror':          {a:'ɒ',b:'d',c:'ɔ',d:'b',e:'ɘ',f:'ʇ',g:'ϱ',h:'ʜ',i:'i',j:'ᴉ',k:'ʞ',l:'l',m:'m',n:'n',o:'o',p:'q',q:'p',r:'ɿ',s:'ƨ',t:'ƚ',u:'u',v:'v',w:'w',x:'x',y:'y',z:'z',A:'A',B:'ᗺ',C:'Ɔ',D:'ᗡ',E:'Ǝ',F:'ꟻ',G:'Ꭾ',H:'H',I:'I',J:'Ꮈ',K:'ꓘ',L:'⅃',M:'M',N:'И',O:'O',P:'ꟼ',Q:'Ọ',R:'Я',S:'Ƨ',T:'T',U:'U',V:'V',W:'W',X:'X',Y:'Y',Z:'Z'},
  'Currency':        {a:'₳',b:'฿',c:'₵',d:'₫',e:'€',f:'₣',g:'₲',h:'♄',i:'ł',j:'ʝ',k:'₭',l:'₤',m:'₥',n:'₦',o:'ø',p:'₱',q:'q',r:'®',s:'$',t:'₮',u:'µ',v:'√',w:'₩',x:'×',y:'¥',z:'z',A:'₳',B:'฿',C:'₵',D:'₫',E:'€',F:'₣',G:'₲',H:'♄',I:'ł',J:'ʝ',K:'₭',L:'₤',M:'₥',N:'₦',O:'ø',P:'₱',Q:'Q',R:'®',S:'$',T:'₮',U:'µ',V:'√',W:'₩',X:'×',Y:'¥',Z:'Z'},
  'Dotted':          {a:'ȧ',b:'ḃ',c:'ċ',d:'ḋ',e:'ė',f:'ḟ',g:'ġ',h:'ḣ',i:'ı',j:'j',k:'k',l:'l',m:'ṁ',n:'ṅ',o:'ȯ',p:'ṗ',q:'q',r:'ṙ',s:'ṡ',t:'ṫ',u:'u',v:'v',w:'ẇ',x:'ẋ',y:'ẏ',z:'ż',A:'Ȧ',B:'Ḃ',C:'Ċ',D:'Ḋ',E:'Ė',F:'Ḟ',G:'Ġ',H:'Ḣ',I:'İ',J:'J',K:'K',L:'L',M:'Ṁ',N:'Ṅ',O:'Ȯ',P:'Ṗ',Q:'Q',R:'Ṙ',S:'Ṡ',T:'Ṫ',U:'U',V:'V',W:'Ẇ',X:'Ẋ',Y:'Ẏ',Z:'Ż'},
  'Old English':     {a:'𝒶',b:'𝒷',c:'𝒸',d:'𝒹',e:'𝑒',f:'𝒻',g:'𝑔',h:'𝒽',i:'𝒾',j:'𝒿',k:'𝓀',l:'𝓁',m:'𝓂',n:'𝓃',o:'𝑜',p:'𝓅',q:'𝓆',r:'𝓇',s:'𝓈',t:'𝓉',u:'𝓊',v:'𝓋',w:'𝓌',x:'𝓍',y:'𝓎',z:'𝓏',A:'𝒜',B:'ℬ',C:'𝒞',D:'𝒟',E:'ℰ',F:'ℱ',G:'𝒢',H:'ℋ',I:'ℐ',J:'𝒥',K:'𝒦',L:'ℒ',M:'ℳ',N:'𝒩',O:'𝒪',P:'𝒫',Q:'𝒬',R:'ℛ',S:'𝒮',T:'𝒯',U:'𝒰',V:'𝒱',W:'𝒲',X:'𝒳',Y:'𝒴',Z:'𝒵'},
  'Parenthesis':    {a:'⒜',b:'⒝',c:'⒞',d:'⒟',e:'⒠',f:'⒡',g:'⒢',h:'⒣',i:'⒤',j:'⒥',k:'⒦',l:'⒧',m:'⒨',n:'⒩',o:'⒪',p:'⒫',q:'⒬',r:'⒭',s:'⒮',t:'⒯',u:'⒰',v:'⒱',w:'⒲',x:'⒳',y:'⒴',z:'⒵',A:'⒜',B:'⒝',C:'⒞',D:'⒟',E:'⒠',F:'⒡',G:'⒢',H:'⒣',I:'⒤',J:'⒥',K:'⒦',L:'⒧',M:'⒨',N:'⒩',O:'⒪',P:'⒫',Q:'⒬',R:'⒭',S:'⒮',T:'⒯',U:'⒰',V:'⒱',W:'⒲',X:'⒳',Y:'⒴',Z:'⒵'},
  'Flags':          {a:'🇦',b:'🇧',c:'🇨',d:'🇩',e:'🇪',f:'🇫',g:'🇬',h:'🇭',i:'🇮',j:'🇯',k:'🇰',l:'🇱',m:'🇲',n:'🇳',o:'🇴',p:'🇵',q:'🇶',r:'🇷',s:'🇸',t:'🇹',u:'🇺',v:'🇻',w:'🇼',x:'🇽',y:'🇾',z:'🇿',A:'🇦',B:'🇧',C:'🇨',D:'🇩',E:'🇪',F:'🇫',G:'🇬',H:'🇭',I:'🇮',J:'🇯',K:'🇰',L:'🇱',M:'🇲',N:'🇳',O:'🇴',P:'🇵',Q:'🇶',R:'🇷',S:'🇸',T:'🇹',U:'🇺',V:'🇻',W:'🇼',X:'🇽',Y:'🇾',Z:'🇿'}
}
let out = `╔══〔 🔤 ALL FONTS — ${ftIn} 〕══╗\n\n\n╚═══════════════════════╝`
for (let [name, map] of Object.entries(maps)) {
  if (name === 'Wide') {
    let w = [...ftIn].map(c=>{let code=c.charCodeAt(0);return (code>=33&&code<=126)?String.fromCharCode(code+65248):c==' '?'　':c}).join('')
    out += `*${name}:*\n${w}\n\n`
  } else if (Object.keys(map).length === 0) {
    out += ''
  } else {
    out += `*${name}:*\n${[...ftIn].map(c=>map[c]||c).join('')}\n\n`
  }
}
reply(out.trim())
} break


//━━━━━━━━━━━━━━━━━━━━━━━━//
// Text Maker Commands (using Pollinations image generation)
case 'metallic':
case 'ice':
case 'snow':
case 'impressive':
case 'matrix':
case 'light':
case 'neon':
case 'devil':
case 'purple':
case 'thunder':
case 'leaves':
case '1917':
case 'arena':
case 'hacker':
case 'sand':
case 'blackpink':
case 'glitch':
case 'fire': {
    await X.sendMessage(m.chat, { react: { text: '🔥', key: m.key } })
let _tmRaw = text || (m.quoted && (m.quoted.text || m.quoted.caption || m.quoted.body || '').trim()) || ''
// Strip any "*Xxx Text:*" or "Text:*" prefixes from quoted bot replies to prevent nesting
let tmText = _tmRaw.replace(/^(\*[\w\s]+ Text:\*\s*)+/i, '').replace(/^(Text:\*\s*)+/i, '').trim()
if (!tmText) return reply(`╔══〔 🎨 STYLED TEXT 〕═════╗\n\n║ Usage: *${prefix}${command} [text]*\n║ Or reply to any message\n║\n╠══〔 🔥 AVAILABLE STYLES 〕═╣\n║ ${prefix}fire  · ${prefix}ice   · ${prefix}neon  · ${prefix}matrix\n║ ${prefix}glitch · ${prefix}hacker · ${prefix}snow  · ${prefix}devil\n║ ${prefix}purple · ${prefix}thunder · ${prefix}leaves · ${prefix}sand\n║ ${prefix}impressive · ${prefix}light · ${prefix}blackpink\n║ ${prefix}arena  · ${prefix}1917  · ${prefix}snow\n╚═══════════════════════╝`)

const _label = command.charAt(0).toUpperCase() + command.slice(1)
const _caption = `*${_label} Text:* ${tmText}`

// ── Style configs: bg RGB, font (sans/mono/serif), layers [{ox,oy,r,g,b}], blur ──
const _tmStyles = {
    metallic: { bg:[18,18,30],  font:'sans',  layers:[[6,6,34,34,51],[4,4,68,68,85],[2,2,136,136,153],[1,1,187,187,204],[0,0,232,232,248]] },
    ice:      { bg:[3,8,24],    font:'sans',  layers:[[6,6,0,17,51],[4,4,0,51,102],[2,2,0,85,170],[1,1,68,170,221],[0,0,170,238,255]] },
    snow:     { bg:[200,216,240],font:'sans', layers:[[5,5,136,153,187],[3,3,170,187,221],[1,1,204,221,240],[0,0,255,255,255]] },
    impressive:{ bg:[13,8,0],   font:'sans',  layers:[[7,7,61,32,0],[5,5,122,64,0],[3,3,204,136,0],[1,1,255,204,0],[0,0,255,240,170]] },
    matrix:   { bg:[0,8,0],     font:'mono',  layers:[[5,5,0,20,0],[3,3,0,68,0],[1,1,0,170,0],[0,0,0,255,65]] },
    light:    { bg:[0,0,16],    font:'sans',  layers:[[-6,-6,68,68,0],[-4,-4,136,136,0],[-2,-2,204,204,0],[6,6,68,68,0],[4,4,136,136,0],[2,2,204,204,0],[0,0,255,255,204]], blur:1 },
    neon:     { bg:[5,0,26],    font:'sans',  layers:[[6,0,170,0,136],[-6,0,170,0,136],[0,6,170,0,136],[0,-6,170,0,136],[4,4,204,0,204],[-4,-4,204,0,204],[0,0,255,136,255]], blur:1 },
    devil:    { bg:[16,0,0],    font:'sans',  layers:[[7,7,51,0,0],[5,5,102,0,0],[3,3,170,0,0],[1,1,221,34,0],[0,0,255,85,51]] },
    purple:   { bg:[8,0,16],    font:'sans',  layers:[[6,6,17,0,51],[4,4,51,0,102],[2,2,102,0,204],[1,1,153,51,255],[0,0,204,153,255]] },
    thunder:  { bg:[5,5,16],    font:'sans',  layers:[[6,6,34,34,0],[4,4,102,102,0],[2,2,170,170,0],[1,1,255,255,0],[0,0,255,255,170]], blur:1 },
    leaves:   { bg:[0,21,0],    font:'sans',  layers:[[6,6,0,26,0],[4,4,0,51,0],[2,2,17,102,0],[1,1,51,170,0],[0,0,136,238,68]] },
    '1917':   { bg:[26,16,8],   font:'serif', layers:[[5,5,42,26,8],[3,3,107,68,32],[1,1,170,119,68],[0,0,212,169,106]] },
    arena:    { bg:[16,8,0],    font:'sans',  layers:[[7,7,42,16,0],[5,5,106,40,0],[3,3,204,85,0],[1,1,255,136,0],[0,0,255,204,136]] },
    hacker:   { bg:[0,3,0],     font:'mono',  layers:[[3,3,0,34,0],[1,1,0,102,0],[0,0,0,255,0]] },
    sand:     { bg:[26,16,5],   font:'serif', layers:[[6,6,58,42,16],[4,4,122,90,40],[2,2,192,144,80],[1,1,212,170,112],[0,0,238,221,153]] },
    blackpink:{ bg:[10,0,10],   font:'sans',  layers:[[6,6,51,0,51],[4,4,136,0,68],[2,2,204,0,102],[1,1,255,68,170],[0,0,255,187,221]] },
    glitch:   { bg:[0,0,16],    font:'mono',  layers:[[-5,0,255,0,0],[5,0,0,255,255],[0,0,255,255,255]] },
    fire:     { bg:[13,2,0],    font:'sans',  layers:[[7,7,51,0,0],[5,5,136,17,0],[3,3,204,68,0],[2,2,255,102,0],[1,1,255,170,0],[0,0,255,238,136]] },
}

const _sty = _tmStyles[command] || _tmStyles.fire
const _fs = require('fs')
const _path = require('path')
const _os = require('os')
const _outFile = _path.join(_os.tmpdir(), `tm_${Date.now()}.jpg`)

// Build a self-contained Python script — no PATH issues, Pillow works everywhere
const _safeText = tmText.replace(/`/g, '').replace(/\\/g, '').replace(/"/g, '').replace(/'/g, "\\'").replace(/\n/g, ' ').trim().slice(0, 80)
const _layersJson = JSON.stringify(_sty.layers)
const _bgJson = JSON.stringify(_sty.bg)
const _fontType = _sty.font
const _blur = _sty.blur || 0

const _pyScript = `
import sys, os

# Auto-install Pillow if not available
try:
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
except ImportError:
    import subprocess
    subprocess.run([sys.executable, '-m', 'pip', 'install', 'Pillow', '--quiet', '--user'], check=True)
    from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1024, 400
text = '${_safeText}'
font_type = '${_fontType}'
bg = tuple(${_bgJson})
layers = ${_layersJson}
blur = ${_blur}
out = '${_outFile.replace(/\\/g, '/')}'

FONTS = {
    'sans':  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    'mono':  '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf',
    'serif': '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf',
}
font_path = FONTS.get(font_type, FONTS['sans'])
if not os.path.exists(font_path):
    import glob
    candidates = (
        glob.glob('/usr/share/fonts/**/*Bold*.ttf', recursive=True) +
        glob.glob('/usr/share/fonts/**/*bold*.ttf', recursive=True) +
        glob.glob('/usr/local/share/fonts/**/*.ttf', recursive=True) +
        glob.glob('/data/data/com.termux/files/usr/share/fonts/**/*.ttf', recursive=True) +
        glob.glob(os.path.expanduser('~/.fonts/**/*.ttf'), recursive=True) +
        glob.glob('/system/fonts/*.ttf')
    )
    font_path = candidates[0] if candidates else None

n = len(text)
pt = 160 if n<=6 else 130 if n<=10 else 105 if n<=15 else 80 if n<=22 else 60 if n<=32 else 45

font = ImageFont.truetype(font_path, pt) if font_path else ImageFont.load_default()

img = Image.new('RGB', (W, H), bg)
draw = ImageDraw.Draw(img)
bbox = draw.textbbox((0, 0), text, font=font)
tw, th = bbox[2]-bbox[0], bbox[3]-bbox[1]
x, y = (W-tw)//2, (H-th)//2

for layer in layers:
    ox, oy, r, g, b = layer
    draw.text((x+ox, y+oy), text, font=font, fill=(r, g, b))

if blur:
    img = img.filter(ImageFilter.GaussianBlur(radius=blur))

img.save(out, 'JPEG', quality=92)
print('OK')
`

const _pyFile = _path.join(_os.tmpdir(), `tm_${Date.now()}_gen.py`)
_fs.writeFileSync(_pyFile, _pyScript)

// Outer safety net — guarantees a reply no matter what fails
let _iceDone = false
try {
    // ── Step 1: Try Python (async exec keeps event loop alive) ──────
    let _pyOk = false
    await new Promise(resolve => {
        const { exec: _exec } = require('child_process')
        const _tryPy = (bins, i2) => {
            if (i2 >= bins.length) { resolve(); return }
            _exec(`${bins[i2]} "${_pyFile}"`, { timeout: 22000 }, (err) => {
                if (!err) { _pyOk = true; resolve() }
                else _tryPy(bins, i2 + 1)
            })
        }
        _tryPy(['python3', 'python'], 0)
    })

    if (_pyOk) {
        try {
            const _buf = _fs.readFileSync(_outFile)
            if (_buf && _buf.length > 1000) {
                await X.sendMessage(m.chat, { image: _buf, caption: _caption }, { quoted: m })
                _iceDone = true
            }
        } catch (_re) { console.log('[ice] read outFile:', _re.message) }
    }

    // ── Step 2: Jimp fallback ────────────────────────────────────────
    if (!_iceDone) {
        try {
            const Jimp = require('jimp')
            const _W = 1024, _H = 400
            if (typeof Jimp.rgbaToInt === 'function' && typeof Jimp.loadFont === 'function') {
                // Jimp v3 — full layered font rendering
                const _bgInt = Jimp.rgbaToInt(_sty.bg[0], _sty.bg[1], _sty.bg[2], 255)
                const _img = new Jimp(_W, _H, _bgInt)
                const _font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE)
                const _tw = Jimp.measureText(_font, tmText)
                const _th = Jimp.measureTextHeight(_font, tmText, _W)
                const _cx = Math.max(0, Math.floor((_W - _tw) / 2))
                const _cy = Math.max(0, Math.floor((_H - _th) / 2))
                for (const [_ox, _oy, _r, _g, _b] of _sty.layers) {
                    const _layer = new Jimp(_W, _H, 0x00000000)
                    _layer.print(_font, _cx + _ox, _cy + _oy, tmText)
                    _layer.scan(0, 0, _W, _H, function(_x, _y, _i) {
                        if (this.bitmap.data[_i + 3] > 10) {
                            this.bitmap.data[_i] = _r
                            this.bitmap.data[_i + 1] = _g
                            this.bitmap.data[_i + 2] = _b
                        }
                    })
                    _img.composite(_layer, 0, 0, { mode: Jimp.BLEND_SOURCE_OVER, opacitySource: 1, opacityDest: 1 })
                }
                const _buf2 = await _img.getBufferAsync(Jimp.MIME_JPEG)
                await X.sendMessage(m.chat, { image: _buf2, caption: _caption }, { quoted: m })
                _iceDone = true
            } else {
                // Jimp v4 — solid color bg + text in caption
                const [_br, _bg2, _bb] = _sty.bg
                const _bgHex = (_br << 24 | _bg2 << 16 | _bb << 8 | 0xff) >>> 0
                const _topLayer = _sty.layers[_sty.layers.length - 1]
                const _accentHex = (_topLayer[2] << 24 | _topLayer[3] << 16 | _topLayer[4] << 8 | 0xff) >>> 0
                let _img4
                try { _img4 = new Jimp({ width: _W, height: _H, color: _bgHex }) }
                catch { _img4 = new Jimp(_W, _H, _bgHex) }
                for (let _px = 0; _px < _W; _px++)
                    for (let _py2 = Math.floor(_H*0.38); _py2 < Math.floor(_H*0.62); _py2++)
                        _img4.setPixelColor(_accentHex, _px, _py2)
                const _buf4 = await (_img4.getBufferAsync ? _img4.getBufferAsync(Jimp.MIME_JPEG || 'image/jpeg') : _img4.getBuffer('image/jpeg'))
                await X.sendMessage(m.chat, { image: _buf4, caption: _caption }, { quoted: m })
                _iceDone = true
            }
        } catch (_je) { console.log('[ice] jimp:', _je.message) }
    }
} catch (_oe) { console.log('[ice] outer error:', _oe.message) }

// ── Step 3: Text-only final fallback ───────────────────────────────
if (!_iceDone) {
    reply(`╔══〔 🎨 ${command.toUpperCase()} TEXT 〕══╗\n\n║ ${tmText}\n╚═══════════════════════╝`)
}
try { _fs.unlinkSync(_pyFile) } catch {}
try { _fs.unlinkSync(_outFile) } catch {}
} break

case 'heart': {
    await X.sendMessage(m.chat, { react: { text: '💕', key: m.key } })
    let heartTarget = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : sender
    if (!m.quoted) {
        X.sendMessage(from, { text: `*💕 ${pushname} sends love to @${heartTarget.split('@')[0]}! 💕*`, mentions: [heartTarget] }, { quoted: m })
    } else {
    try {
        const imgBuf = await m.quoted.download()
        const Jimp = require('jimp')
        const img = await Jimp.read(imgBuf)
        img.scan(0, 0, img.bitmap.width, img.bitmap.height, function(x, y, idx) {
            this.bitmap.data[idx]   = Math.min(255, this.bitmap.data[idx] + 80)
            this.bitmap.data[idx+1] = Math.max(0,   this.bitmap.data[idx+1] - 30)
            this.bitmap.data[idx+2] = Math.max(0,   this.bitmap.data[idx+2] - 30)
        })
        const output = await img.getBufferAsync(Jimp.MIME_JPEG)
        await X.sendMessage(from, { image: output, caption: '💕 *Heart effect applied!*' }, { quoted: m })
    } catch(e) { reply('❌ Failed to apply heart effect: ' + e.message) }
}
} break

case 'rizz': {
    await X.sendMessage(m.chat, { react: { text: '😎', key: m.key } })
    if (m.isGroup && global.antiSocialGames && global.antiSocialGames[m.chat]) return reply(`❌ *Social games are disabled in this group.*`)
let rizzTarget = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : sender
let rizzLevel = Math.floor(Math.random() * 101)
const rizzMsg = rizzLevel > 80 ? 'Unmatched rizz! 😎🔥' : rizzLevel > 50 ? 'Solid rizz game 💪' : rizzLevel > 30 ? 'Rizz needs work 😅' : 'No rizz detected 💀'
X.sendMessage(from, { text: `╔═══〔 😎 RIZZ METER 〕═══╗\n\n║ 👤 @${rizzTarget.split('@')[0]}\n\n║ ${'🔥'.repeat(Math.floor(rizzLevel/10))}${'⬜'.repeat(10 - Math.floor(rizzLevel/10))} *${rizzLevel}%*\n\n║ _${rizzMsg}_\n╚═══════════════════════╝`, mentions: [rizzTarget] }, { quoted: m })
} break

case 'circle': {
    await X.sendMessage(m.chat, { react: { text: '⭕', key: m.key } })
if (!m.quoted || !/image/.test(m.quoted.mimetype || '')) return reply(`Reply to an image with ${prefix}circle`)
try {
let buf = await m.quoted.download()
await X.sendMessage(m.chat, { sticker: buf }, { quoted: m })
} catch(e) { reply('Error: ' + e.message) }
} break

case 'lgbt': {
    await X.sendMessage(m.chat, { react: { text: '🌈', key: m.key } })
    if (m.isGroup && global.antiSocialGames && global.antiSocialGames[m.chat]) return reply(`❌ *Social games are disabled in this group.*`)
let lgbtTarget = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : sender
X.sendMessage(from, { text: `*🏳️‍🌈 @${lgbtTarget.split('@')[0]} supports LGBTQ+! 🏳️‍🌈*\n🌈 Love is Love 🌈`, mentions: [lgbtTarget] }, { quoted: m })
} break

case 'lolice':
case 'police': {
    await X.sendMessage(m.chat, { react: { text: '🚔', key: m.key } })
    if (m.isGroup && global.antiSocialGames && global.antiSocialGames[m.chat]) return reply(`❌ *Social games are disabled in this group.*`)
let policeTarget = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : sender
const policeReasons = ['Being too awesome 😂', 'Excessive good vibes ✨', 'Stealing hearts 💘', 'Being suspiciously cool 😎', 'Causing too much fun 🎉']
const reason = policeReasons[Math.floor(Math.random() * policeReasons.length)]
X.sendMessage(from, { text: `╔══〔 🚔 POLICE ALERT! 〕══╗\n\n║ 🚨 @${policeTarget.split('@')[0]} has been arrested!\n\n║ 📋 *Crime* : ${reason}\n║ ⚖️  *Sentence* : Life of fun 🎉\n╚═══════════════════════╝`, mentions: [policeTarget] }, { quoted: m })
} break

case 'namecard': {
    await X.sendMessage(m.chat, { react: { text: '🪪', key: m.key } })
let ncName = text || pushname
reply(`╔═══〔 🪪 ${ncName} 〕════╗\n\n║ Bot : ${global.botname}\n╚═══════════════════════╝`)
} break

case 'tweet': {
    await X.sendMessage(m.chat, { react: { text: '🐦', key: m.key } })
if (!text) return reply(`╔═══〔 🐦 TWEET CARD 〕═══╗\n\n║ Usage: *${prefix}tweet [message]*\n║ Example: ${prefix}tweet I love coding!\n╚═══════════════════════╝`)
reply(`╔═════〔 🐦 TWEET 〕══════╗\n\n║ 👤 *@${pushname}*\n║ ${text}\n\n║ ❤️ ${Math.floor(Math.random() * 10000)}  🔁 ${Math.floor(Math.random() * 5000)}  💬 ${Math.floor(Math.random() * 1000)}\n╚═══════════════════════╝`)
} break

case 'ytcomment': {
    await X.sendMessage(m.chat, { react: { text: '💬', key: m.key } })
if (!text) return reply(`╔══〔 💬 YT COMMENT CARD 〕══╗\n\n║ Usage: *${prefix}ytcomment [message]*\n║ Example: ${prefix}ytcomment This video is amazing!\n╚═══════════════════════╝`)
reply(`╔══〔 ▶️  YOUTUBE COMMENT 〕══╗\n\n║ 👤 *${pushname}*\n║ ${text}\n\n║ 👍 ${Math.floor(Math.random() * 5000)}  👎  💬 ${Math.floor(Math.random() * 200)} replies\n╚═══════════════════════╝`)
} break

case 'comrade': {
    await X.sendMessage(m.chat, { react: { text: '☭', key: m.key } })
    if (m.isGroup && global.antiSocialGames && global.antiSocialGames[m.chat]) return reply(`❌ *Social games are disabled in this group.*`)
let comradeTarget = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : sender
X.sendMessage(from, { text: `*☭ Our Comrade @${comradeTarget.split('@')[0]}! ☭*\nServing the motherland with honor!`, mentions: [comradeTarget] }, { quoted: m })
} break

case 'vibe': {
    await X.sendMessage(m.chat, { react: { text: '✨', key: m.key } })
    if (m.isGroup && global.antiSocialGames && global.antiSocialGames[m.chat]) return reply(`❌ *Social games are disabled in this group.*\n\nUse *${prefix}antisocialgames off* to re-enable.`)
let vibeTarget = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : sender
let vibeLevel = Math.floor(Math.random() * 101)
const vibeMsg = vibeLevel > 80 ? 'Absolutely radiating! 🔥' : vibeLevel > 50 ? 'Good vibes only ✨' : vibeLevel > 30 ? 'Vibes loading... 😌' : 'Needs a coffee first ☕'
X.sendMessage(from, { text: `╔═══〔 ✨ VIBE CHECK 〕════╗\n\n║ 👤 @${vibeTarget.split('@')[0]}\n\n║ ${'✨'.repeat(Math.floor(vibeLevel/10))}${'⬜'.repeat(10 - Math.floor(vibeLevel/10))} *${vibeLevel}%*\n\n║ _${vibeMsg}_\n╚═══════════════════════╝`, mentions: [vibeTarget] }, { quoted: m })
} break

case 'gay': {
    await X.sendMessage(m.chat, { react: { text: '🏳️‍🌈', key: m.key } })
    if (m.isGroup && global.antiSocialGames && global.antiSocialGames[m.chat]) return reply(`❌ *Social games are disabled in this group.*`)
let gayTarget = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : sender
let gayLevel = Math.floor(Math.random() * 101)
const gayMsg = gayLevel > 90 ? 'Absolutely fabulous! 🏳️‍🌈💅' : gayLevel > 70 ? 'Serving rainbow energy ✨' : gayLevel > 50 ? 'Somewhere over the rainbow 🌈' : gayLevel > 30 ? 'Just a little bit 😅' : 'Straight as an arrow 🏹'
X.sendMessage(from, { text: `╔══〔 🏳️‍🌈 GAY METER 〕══╗\n\n║ 👤 @${gayTarget.split('@')[0]}\n\n║ ${'🌈'.repeat(Math.floor(gayLevel/10))}${'⬜'.repeat(10 - Math.floor(gayLevel/10))} *${gayLevel}%*\n\n║ _${gayMsg}_\n╚═══════════════════════╝`, mentions: [gayTarget] }, { quoted: m })
} break

case 'glass': {
    await X.sendMessage(m.chat, { react: { text: '🕶️', key: m.key } })
if (!m.quoted || !/image/.test(m.quoted.mimetype || '')) return reply(`Reply to an image with *${prefix}glass* to apply a frosted glass blur effect.`)
try {
    const imgBuf = await m.quoted.download()
    const Jimp = require('jimp')
    const img = await Jimp.read(imgBuf)
    img.blur(8).brightness(-0.05).contrast(0.15)
    const output = await img.getBufferAsync(Jimp.MIME_JPEG)
    await X.sendMessage(from, { image: output, caption: '🪟 *Glass effect applied!*' }, { quoted: m })
} catch(e) { reply('❌ Failed to apply glass effect: ' + e.message) }
} break

case 'jail': {
    await X.sendMessage(m.chat, { react: { text: '⛓️', key: m.key } })
let jailTarget = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : sender
X.sendMessage(from, { text: `*🔒 @${jailTarget.split('@')[0]} has been jailed! 🔒*\nCrime: Being too awesome\nSentence: Life 😂`, mentions: [jailTarget] }, { quoted: m })
} break

case 'passed': {
    await X.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
let passedTarget = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : sender
X.sendMessage(from, { text: `*✅ @${passedTarget.split('@')[0]} has PASSED! ✅*\nCongratulations! 🎉`, mentions: [passedTarget] }, { quoted: m })
} break

case 'triggered': {
    await X.sendMessage(m.chat, { react: { text: '😡', key: m.key } })
let triggeredTarget = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : sender
X.sendMessage(from, { text: `*⚡ @${triggeredTarget.split('@')[0]} is TRIGGERED! ⚡*\n😤😤😤`, mentions: [triggeredTarget] }, { quoted: m })
} break

//━━━━━━━━━━━━━━━━━━━━━━━━//
// GitHub Commands
case 'git':
case 'github': {
    await X.sendMessage(m.chat, { react: { text: '🐙', key: m.key } })
if (!text) return reply(`╔══〔 🐙 GITHUB PROFILE 〕══╗\n\n║ Usage: *${prefix}github [username]*\n║ Example: ${prefix}github torvalds\n╚═══════════════════════╝`)
try {
let res = await fetch(`https://api.github.com/users/${encodeURIComponent(text)}`)
let data = await res.json()
if (data.message) return reply('User not found.')
let info = `*GitHub Profile:*\n\n👤 Name: ${data.name || data.login}\n📝 Bio: ${data.bio || 'N/A'}\n📍 Location: ${data.location || 'N/A'}\n🏢 Company: ${data.company || 'N/A'}\n📦 Repos: ${data.public_repos}\n👥 Followers: ${data.followers}\n👤 Following: ${data.following}\n🔗 URL: ${data.html_url}\n📅 Joined: ${new Date(data.created_at).toLocaleDateString()}`
if (data.avatar_url) {
await X.sendMessage(m.chat, { image: { url: data.avatar_url }, caption: info }, { quoted: m })
} else reply(info)
} catch(e) { reply('Error: ' + e.message) }
} break

case 'repo': {
    await X.sendMessage(m.chat, { react: { text: '📦', key: m.key } })
try {
// Default to bot repo if no arg given
let repoPath = 'Juicev12/TOOSII-XD-ULTRA'
if (text) {
    repoPath = text.includes('/') ? text.trim() : `${text.trim()}/${text.trim()}`
}
// Don't encode the whole path — only encode each segment
const [owner, ...repoParts] = repoPath.split('/')
const repoName = repoParts.join('/')
let res = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`, {
    headers: { 'User-Agent': 'TOOSII-XD-ULTRA-Bot' }
})
let data = await res.json()
if (data.message) {
    return reply(
        `╔══〔 ❌ REPO NOT FOUND 〕══╗\n\n║ Could not find: *${repoPath}*\n║ Try: *.repo owner/reponame*\n\n║ 📦 *Bot Repo:* github.com/Juicev12/TOOSII-XD-ULTRA\n║ ⭐ *Star* & 🍴 *Fork*: ${global.repoUrl}/fork\n\n╚═══════════════════════╝`
    )
}
const repoInfo =
`╔══〔 📦 REPOSITORY INFO 〕══╗
║ 🏷️  *${data.full_name}*
║ 📝 _${(data.description || 'No description').slice(0,80)}_
║
║ ⭐ *Stars* : ${data.stargazers_count}
║ 🍴 *Forks* : ${data.forks_count}
║ 💻 *Language* : ${data.language || 'N/A'}
║ 🔄 *Updated* : ${new Date(data.updated_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}

║ 🔗 ${data.html_url}

║ 💛 *Enjoyed the bot?*
║ ⭐ Star & 🍴 Fork — every click counts!

║ 🔑 Session : ${global.sessionUrl}

║ _⚡ Powered by Juice v12 — wa.me/254753204154_
╚═══════════════════════╝`
reply(repoInfo)
} catch(e) { reply('❌ Error fetching repo: ' + e.message) }
} break

case 'sc':
case 'script':
case 'source': {
    await X.sendMessage(m.chat, { react: { text: '📜', key: m.key } })
let scText = `╔══〔 📂 SOURCE CODE 〕═══╗

║ 🤖 *${global.botname}*

║ 🔗 *GitHub*
║ github.com/Juicev12/TOOSII-XD-ULTRA
║ 🍴 *Fork it*
║ github.com/Juicev12/TOOSII-XD-ULTRA/fork
║ 👨‍💻 *Dev* : ${global.ownername}
║ 📞 *Contact* : ${global.ownerNumber}

║ _© ${global.ownername} — All Rights Reserved_
╚═══════════════════════╝`
reply(scText)
} break

case 'clone': {
    await X.sendMessage(m.chat, { react: { text: '📦', key: m.key } })
if (!text) return reply(`╔══〔 🐙 GITHUB CLONE 〕══╗\n\n║ Usage: *${prefix}clone [github url]*\n║ Example: ${prefix}clone https://github.com/user/repo\n╚═══════════════════════╝`)
try {
let match = text.match(/github\.com\/([^\/]+)\/([^\/\s]+)/)
if (!match) return reply('Invalid GitHub URL.')
let [, user, repo] = match
repo = repo.replace(/\.git$/, '')
let zipUrl = `https://api.github.com/repos/${user}/${repo}/zipball`
await X.sendMessage(m.chat, { document: { url: zipUrl }, mimetype: 'application/zip', fileName: `${repo}.zip` }, { quoted: m })
} catch(e) { reply('Error: ' + e.message) }
} break

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🌤️  WEATHER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
case 'wttr':
case 'weather':
case 'clima': {
    await X.sendMessage(m.chat, { react: { text: '🌤️', key: m.key } })
    if (!text) return reply(`╔════〔 🌤️ WEATHER 〕════╗\n\n║ Usage: *${prefix}weather [city]*\n║ Example: ${prefix}weather Nairobi\n╚═══════════════════════╝`)
    try {
        let _wCity = text.trim()
        let _wMsg = null

        // ── Primary: Keith API ──────────────────────────────────────────────
        try {
            const _kw = await _keithFetch(`/weather?city=${encodeURIComponent(_wCity)}`)
            const _kwd = (_kw?.result || _kw) ?? {}
            const _wTemp = _kwd.temperature ?? _kwd.temp
            if (_wTemp !== undefined) {
                const _wCond = _kwd.condition || _kwd.description || _kwd.weather || '-'
                const _wFeel = _kwd.feels_like ?? _kwd.feelslike
                const _wHum  = _kwd.humidity
                const _wWnd  = _kwd.wind || _kwd.wind_speed
                const _wLoc  = (_kwd.location || _kwd.city || _wCity).toUpperCase()
                _wMsg = `╔══〔 🌤️ WEATHER 〕══╗\n║ 📍 *${_wLoc}*\n║ 🌡️ *Temp:* ${_wTemp}°C${_wFeel !== undefined ? ` (feels ${_wFeel}°C)` : ''}\n║ 🌤️ *Condition:* ${_wCond}\n${_wHum !== undefined ? `║ 💧 *Humidity:* ${_wHum}%\n` : ''}${_wWnd !== undefined ? `║ 💨 *Wind:* ${_wWnd} km/h\n` : ''}╚═══════════════════════╝`
            }
        } catch(_) {}

        // ── Fallback: wttr.in (free, no key) ───────────────────────────────
        if (!_wMsg) {
            const _wr = await safeJson(`https://wttr.in/${encodeURIComponent(_wCity)}?format=j1`)
            const _wc = _wr?.current_condition?.[0]
            if (_wc) {
                const _wa    = _wr?.nearest_area?.[0]
                const _wLoc2 = _wa?.areaName?.[0]?.value || _wCity
                const _wCtry = _wa?.country?.[0]?.value || ''
                _wMsg = `╔══〔 🌤️ WEATHER 〕══╗\n║ 📍 *${_wLoc2}${_wCtry ? ', ' + _wCtry : ''}*\n║ 🌡️ *Temp:* ${_wc.temp_C}°C (feels ${_wc.FeelsLikeC}°C)\n║ 🌤️ *Condition:* ${_wc.weatherDesc?.[0]?.value || '-'}\n║ 💧 *Humidity:* ${_wc.humidity}%\n║ 💨 *Wind:* ${_wc.windspeedKmph} km/h (${_wc.winddir16Point})\n║ 👁️ *Visibility:* ${_wc.visibility} km\n║ 🔵 *Pressure:* ${_wc.pressure} hPa\n║ ☀️ *UV Index:* ${_wc.uvIndex}\n╚═══════════════════════╝`
            }
        }

        if (!_wMsg) throw new Error('No weather data')
        await reply(_wMsg)
    } catch(e) { reply(`❌ Could not fetch weather for *${text}*. Try a different city name.`) }
} break

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔗  URL SHORTENER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
case 'tinyurl':
case 'shorturl':
case 'shorten': {
    await X.sendMessage(m.chat, { react: { text: '🔗', key: m.key } })
    if (!text || !text.startsWith('http')) return reply(`╌════〔 🔗 URL SHORTENER 〕══╌\n\n║ *Usage:* ${prefix}tinyurl [url]\n║ Example: ${prefix}tinyurl https://google.com\n╚═══════════════════════╝`)
    try {
        let _suUrl = null
        // Keith first
        const _sukd = await _keithFetch(`/shortener/tinyurl?url=${encodeURIComponent(text)}`)
        if (_sukd?.shortened) _suUrl = _sukd.shortened
        // GiftedTech fallback
        if (!_suUrl) {
            let _sugr = await fetch(`https://api.giftedtech.co.ke/api/tools/tinyurl?apikey=${_giftedKey()}&url=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(12000) })
            let _sugd = await _sugr.json()
            if (_sugd.success && _sugd.result) _suUrl = _sugd.result
        }
        if (!_suUrl) throw new Error('Failed')
        await reply(`╌══〔 🔗 URL SHORTENER 〕══╌\n║ 📎 *Original* : ${text}\n║ ✅ *Short URL* : ${_suUrl}\n╚═══════════════════════╝`)
    } catch(e) { reply('❌ Failed to shorten URL. Make sure it starts with https://') }
} break

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 💘  PICKUP LINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
case 'pickupline': {
    await X.sendMessage(m.chat, { react: { text: '💘', key: m.key } })
    try {
        let _plTxt = null
        const _plkd = await _keithFetch('/fun/pickuplines')
        if (typeof _plkd === 'string') _plTxt = _plkd; else if (_plkd?.result) _plTxt = _plkd.result
        if (!_plTxt) {
            let _plr = await fetch(`https://api.giftedtech.co.ke/api/fun/pickupline?apikey=${_giftedKey()}`, { signal: AbortSignal.timeout(10000) })
            let _pld = await _plr.json()
            if (_pld.success && _pld.result) _plTxt = _pld.result
        }
        if (!_plTxt) throw new Error('No pickup line')
        await reply(`╌══〔 💘 PICKUP LINE 〕════╌\n║ _“${_plTxt}”_\n╚═══════════════════════╝`)
    } catch(e) { reply('❌ Could not fetch a pickup line right now. Try again!') }
} break

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📲  QR CODE GENERATOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
case 'qr':
case 'qrcode':
case 'makeqr':
case 'genqr': {
    await X.sendMessage(m.chat, { react: { text: '📲', key: m.key } })
    if (!text) return reply(`╔══〔 📲 QR CODE GENERATOR 〕══╗\n\n║ Usage: *${prefix}${command} [text or url]*\n║ Example: ${prefix}${command} https://google.com\n║ Example: ${prefix}${command} Hello World\n╚═══════════════════════╝`)
    try {
        let _qrRes = await fetch(`https://eliteprotech-apis.zone.id/qr?text=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
        if (!_qrRes.ok) throw new Error('QR API error: ' + _qrRes.status)
        let _qrBuf = Buffer.from(await _qrRes.arrayBuffer())
        if (!_qrBuf || _qrBuf.length < 500) throw new Error('Empty QR response')
        await X.sendMessage(m.chat, {
            image: _qrBuf,
            caption: `╔════〔 📲 QR CODE 〕═════╗\n\n║ 📝 *Content* : ${text.length > 60 ? text.slice(0,60) + '...' : text}\n╚═══════════════════════╝`
        }, { quoted: m })
    } catch(e) {
        // Fallback: goqr.me API
        try {
            let _qrFallback = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(text)}`
            await X.sendMessage(m.chat, {
                image: { url: _qrFallback },
                caption: `╔════〔 📲 QR CODE 〕═════╗\n\n║ 📝 *Content* : ${text.length > 60 ? text.slice(0,60) + '...' : text}\n╚═══════════════════════╝`
            }, { quoted: m })
        } catch(e2) { reply(`❌ QR code generation failed.\n_${e2.message}_`) }
    }
} break

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📷  READ QR CODE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
case 'readqr':
case 'scanqr':
case 'qrread': {
    await X.sendMessage(m.chat, { react: { text: '📷', key: m.key } })
    if (!m.quoted || !/image/.test(m.quoted.mimetype || m.quoted.msg?.mimetype || '')) {
        return reply(`╌══〔 📷 READ QR CODE 〕══╌\n║ Reply to a QR image with *${prefix}readqr*\n║ Works with any standard QR code\n╚═══════════════════════╝`)
    }
    try {
        await reply('📷 _Scanning QR code..._')
        let _buf = await m.quoted.download()
        if (!_buf || _buf.length < 100) throw new Error('Image download failed')
        let _tmp = require('path').join(__dirname, 'tmp', `qr_${Date.now()}.png`)
        fs.writeFileSync(_tmp, _buf)
        let _url = await CatBox(_tmp)
        try { fs.unlinkSync(_tmp) } catch {}
        if (!_url) throw new Error('Upload failed')
        let qrData = null
        // Source 1: api.qrserver.com (free, no key)
        try {
            const _qsR = await fetch(`https://api.qrserver.com/v1/read-qr-code/?fileurl=${encodeURIComponent(_url)}`, { signal: AbortSignal.timeout(15000) })
            const _qsD = await _qsR.json()
            if (_qsD?.[0]?.symbol?.[0]?.data) qrData = _qsD[0].symbol[0].data
        } catch {}
        // Source 2: GiftedTech
        if (!qrData) {
            const _gtR = await fetch(`https://api.giftedtech.co.ke/api/tools/readqr?apikey=${_giftedKey()}&url=${encodeURIComponent(_url)}`, { signal: AbortSignal.timeout(25000) })
            const _gtD = await _gtR.json()
            if (_gtD.success && _gtD.result) qrData = _gtD.result?.qrcode_data || _gtD.result
        }
        if (!qrData) throw new Error('Could not read QR')
        await reply(`╌══〔 📷 QR CODE RESULT 〕══╌\n║ ${qrData}\n╚═══════════════════════╝`)
    } catch(e) { reply('❌ Could not read the QR code. Make sure the image is clear and contains a valid QR code.') }
} break

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎨  AI IMAGE GENERATOR (DeepImg)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
case 'deepimg':
case 'genimage':
case 'aiart':
case 'aiimage': {
    await X.sendMessage(m.chat, { react: { text: '🎨', key: m.key } })
    if (!text) return reply(`╌══〔 🎨 AI IMAGE GEN 〕══╌\n║ *Usage:* ${prefix}imagine [describe image]\n║ Example: ${prefix}imagine a lion at sunset\n║\n║ 💡 Be descriptive for best results!\n╚═══════════════════════╝`)
    try {
        await reply('🎨 _Generating your image with AI... please wait ⏳_')
        let _aiImgUrl = null
        // Source 1: Pollinations.ai (free, no key)
        try {
            const _polUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}?width=1024&height=1024&nologo=true&model=flux`
            const _polR = await fetch(_polUrl, { signal: AbortSignal.timeout(45000) })
            if (_polR.ok && _polR.headers.get('content-type')?.startsWith('image/')) {
                _aiImgUrl = _polUrl
            }
        } catch {}
        // Source 2: GiftedTech fluximg
        if (!_aiImgUrl) {
            try {
                const _gtR = await fetch(`https://api.giftedtech.co.ke/api/ai/fluximg?apikey=${_giftedKey()}&prompt=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(60000) })
                const _gtD = await _gtR.json()
                if (_gtD.success && (_gtD.result?.url || _gtD.result)) _aiImgUrl = _gtD.result?.url || _gtD.result
            } catch {}
        }
        // Source 3: MagicStudio (direct image)
        if (!_aiImgUrl) _aiImgUrl = `https://api.giftedtech.co.ke/api/ai/magicstudio?apikey=${_giftedKey()}&prompt=${encodeURIComponent(text)}`
        await safeSendMedia(m.chat, { image: { url: _aiImgUrl }, caption: `🎨 *AI Generated Image*\n📝 _${text}_` }, {}, { quoted: m })
    } catch(e) { reply('❌ Image generation failed. Try a shorter or different prompt.') }
} break

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎵  AI SONG GENERATOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
case 'songgenerator':
case 'makesong':
case 'aisong': {
    await X.sendMessage(m.chat, { react: { text: '🎵', key: m.key } })
    if (!text) return reply(`╔══〔 🎵 AI SONG GENERATOR 〕══╗\n\n║ Usage: *${prefix}songgenerator [describe your song]*\n║ Example: ${prefix}songgenerator Upbeat Afrobeats about success\n╚═══════════════════════╝`)
    try {
        await reply('🎵 _Composing your song with AI, please wait (this may take a while)..._')
        let r = await fetch(`https://api.giftedtech.co.ke/api/tools/songgenerator?apikey=${_giftedKey()}&prompt=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(120000) })
        let d = await r.json()
        if (!d.success || !d.result) throw new Error('Song generation failed')
        let res = d.result
        let audioUrl = typeof res === 'string' ? res : (res.audio_url || res.url || res.download_url)
        if (audioUrl) {
            await X.sendMessage(m.chat, { audio: { url: audioUrl }, mimetype: 'audio/mpeg', fileName: 'ai_song.mp3', caption: `🎵 *AI Generated Song*\n📝 _${text}_` }, { quoted: m })
        } else {
            await reply(`╔══〔 🎵 AI SONG GENERATED 〕╗\n║ ${JSON.stringify(res, null, 2)}\n╚═══════════════════════╝`)
        }
    } catch(e) { reply(`❌ Song generation failed. Try a simpler prompt.`) }
} break

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⚽  FOOTBALL LIVE SCORE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
case 'livescore':
case 'livescores':
case 'footballscore': {
    await X.sendMessage(m.chat, { react: { text: '⚽', key: m.key } })
    try {
        await reply('⚽ _Fetching live football scores..._')
        const _lsData = await _getLiveScores()
        if (!_lsData || !_lsData.matches?.length) return reply('⚽ No live matches right now. Try again during match time.')
        let matches = _lsData.matches
        let msg = `╔══〔 ⚽ LIVE FOOTBALL SCORES (${matches.length} matches) 〕══╗`
        let currentLeague = ''
        for (let _lm of matches) {
            if (_lm.league !== currentLeague) {
                currentLeague = _lm.league
                msg += `\n🏆 *${currentLeague}*\n`
            }
            let score = (_lm.homeScore !== undefined && _lm.awayScore !== undefined) ? `${_lm.homeScore} - ${_lm.awayScore}` : `vs`
            msg += `  ⚽ ${_lm.homeTeam} *${score}* ${_lm.awayTeam}`
            if (_lm.status && _lm.status !== 'Unknown') msg += ` _( ${_lm.status})_`
            msg += '\n'
        }
        msg += `\n╚═══════════════════════╝`
        await reply(msg)
    } catch(e) { reply('❌ Could not fetch live scores. Try again later.') }
} break

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔮  FOOTBALL PREDICTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
case 'predictions':
case 'footballpredictions':
case 'betpredictions':
case 'tips': {
    await X.sendMessage(m.chat, { react: { text: '🔮', key: m.key } })
    try {
        await reply('🔮 _Fetching today\'s football predictions..._')
        let preds = await _getPredictions()
        if (!preds?.length) return reply('🔮 No predictions available right now. Try again later.')
        let msg = `╔══〔 🔮 FOOTBALL PREDICTIONS (${preds.length}) 〕══╗`
        for (let p of preds) {
            msg += `\n🏆 *${p.league || 'Unknown League'}*\n`
            msg += `  ⚽ ${p.match}\n`
            if (p.time) msg += `  ⏰ ${p.time}\n`
            if (p.predictions?.fulltime) {
                let ft = p.predictions.fulltime
                msg += `  📊 Home: ${ft.home?.toFixed(0)}% | Draw: ${ft.draw?.toFixed(0)}% | Away: ${ft.away?.toFixed(0)}%\n`
            }
            if (p.predictions?.over_2_5) {
                msg += `  🥅 Over 2.5: ${p.predictions.over_2_5.yes?.toFixed(0)}%\n`
            }
            if (p.predictions?.bothTeamToScore) {
                msg += `  🎯 BTTS: ${p.predictions.bothTeamToScore.yes?.toFixed(0)}%\n`
            }
        }
        msg += `\n╚═══════════════════════╝\n\n⚠️ _Predictions are for entertainment only. Bet responsibly._`
        await reply(msg)
    } catch(e) { reply('❌ Could not fetch predictions. Try again later.') }
} break

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📰  FOOTBALL NEWS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
case 'footnews':
case 'footballnews':
case 'sportnews': {
    await X.sendMessage(m.chat, { react: { text: '📰', key: m.key } })
    try {
        await reply('📰 _Fetching latest football news..._')
        let articles = await _getFootballNews()
        if (!articles?.length) return reply('📰 No football news available right now. Try again later.')
        let msg = `╔══〔 📰 FOOTBALL NEWS 〕══╗`
        for (let a of articles) {
            msg += `\n📌 *${a.title}*\n`
            if (a.summary) msg += `  _${a.summary}_\n`
            if (a.link || a.url) msg += `  🔗 ${a.link || a.url}\n`
        }
        msg += `\n╚═══════════════════════╝`
        await reply(msg)
    } catch(e) { reply('❌ Could not fetch football news. Try again later.') }
} break

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🏆  EPL STANDINGS, SCORERS, UPCOMING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
case 'epl':
case 'eplstandings':
case 'premierleague': {
    await X.sendMessage(m.chat, { react: { text: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', key: m.key } })
    try {
        await reply('🏆 _Fetching EPL standings..._')
        let teams = await _getStandings('epl', 'epl')
        if (!teams?.length) throw new Error('No data from any source')
        let msg = `╔══〔 🏆 EPL STANDINGS ${new Date().getFullYear()} 〕══╗`
        msg += `${'#'.padEnd(3)} ${'Team'.padEnd(22)} ${'P'.padEnd(3)} ${'W'.padEnd(3)} ${'D'.padEnd(3)} ${'L'.padEnd(3)} ${'GD'.padEnd(5)} Pts\n`
        msg += `${'─'.repeat(50)}\n`
        for (let t of teams) {
            let pos = String(t.position).padEnd(3)
            let team = (t.team || '').substring(0, 20).padEnd(22)
            let p = String(t.played || 0).padEnd(3)
            let w = String(t.won || 0).padEnd(3)
            let dr = String(t.draw || 0).padEnd(3)
            let l = String(t.lost || 0).padEnd(3)
            let gd = String(t.goalDifference || 0).padEnd(5)
            let pts = String(t.points || 0)
            msg += `${pos}${team}${p}${w}${dr}${l}${gd}${pts}\n`
        }
        await reply('```\n' + msg + '```')
    } catch(e) { reply('❌ Could not fetch EPL standings. Try again later.') }
} break

case 'eplscorers':
case 'epltopscorers': {
    await X.sendMessage(m.chat, { react: { text: '⚽', key: m.key } })
    try {
        await reply('⚽ _Fetching EPL top scorers..._')
        let scorers = await _getScorers('epl', 'epl')
        if (!scorers?.length) throw new Error('No data from any source')
        let msg = `╔══〔 ⚽ EPL TOP SCORERS 〕══╗`
        for (let s of scorers) {
            let rank = s.rank || s.position || ''
            msg += `${rank}. *${s.player || s.name}* (${s.team || s.club || ''})\n`
            msg += `   🥅 Goals: *${s.goals}*`
            if (s.assists) msg += `  🎯 Assists: ${s.assists}`
            if (s.played) msg += `  📅 Played: ${s.played}`
            msg += '\n'
        }
        msg += `\n╚═══════════════════════╝`
        await reply(msg)
    } catch(e) { reply('❌ Could not fetch EPL top scorers. Try again later.') }
} break

case 'eplmatches':
case 'eplfixtures':
case 'eplupcoming': {
    await X.sendMessage(m.chat, { react: { text: '📅', key: m.key } })
    try {
        await reply('📅 _Fetching upcoming EPL matches..._')
        let matches = await _getFixtures('epl', `https://api.giftedtech.co.ke/api/football/epl/upcoming?apikey=${_giftedKey()}`)
        if (!matches?.length) throw new Error('No data from any source')
        let msg = `╔══〔 📅 EPL UPCOMING FIXTURES 〕══╗`
        for (let _fm of matches) {
            msg += `\n📆 *${_fm.date || ''}* ${_fm.time ? '⏰ ' + _fm.time : ''}\n`
            msg += `  ⚽ *${_fm.homeTeam}* vs *${_fm.awayTeam}*\n`
            if (_fm.venue || _fm.stadium) msg += `  🏟️ ${_fm.venue || _fm.stadium}\n`
        }
        msg += `\n╚═══════════════════════╝`
        await reply(msg)
    } catch(e) { reply('❌ Could not fetch EPL fixtures. Try again later.') }
} break

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🇪🇸  LA LIGA STANDINGS, SCORERS, MATCHES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
case 'laliga':
case 'laligastandings': {
    await X.sendMessage(m.chat, { react: { text: '🇪🇸', key: m.key } })
    try {
        await reply('🏆 _Fetching La Liga standings..._')
        let teams = await _getStandings('laliga', 'laliga')
        if (!teams?.length) throw new Error('No data from any source')
        let msg = `╔══〔 🏆 LA LIGA STANDINGS ${new Date().getFullYear()} 〕══╗`
        msg += `${'#'.padEnd(3)} ${'Team'.padEnd(22)} ${'P'.padEnd(3)} ${'W'.padEnd(3)} ${'D'.padEnd(3)} ${'L'.padEnd(3)} ${'GD'.padEnd(5)} Pts\n`
        msg += `${'─'.repeat(50)}\n`
        for (let t of teams) {
            let pos = String(t.position).padEnd(3)
            let team = (t.team || '').substring(0, 20).padEnd(22)
            let p = String(t.played || 0).padEnd(3)
            let w = String(t.won || 0).padEnd(3)
            let dr = String(t.draw || 0).padEnd(3)
            let l = String(t.lost || 0).padEnd(3)
            let gd = String(t.goalDifference || 0).padEnd(5)
            let pts = String(t.points || 0)
            msg += `${pos}${team}${p}${w}${dr}${l}${gd}${pts}\n`
        }
        await reply('```\n' + msg + '```')
    } catch(e) { reply('❌ Could not fetch La Liga standings. Try again later.') }
} break

case 'laligascorers':
case 'laligatopscorers': {
    await X.sendMessage(m.chat, { react: { text: '⚽', key: m.key } })
    try {
        await reply('⚽ _Fetching La Liga top scorers..._')
        let scorers = await _getScorers('laliga', 'laliga')
        if (!scorers?.length) throw new Error('No data from any source')
        let msg = `╔══〔 ⚽ LA LIGA TOP SCORERS 〕══╗`
        for (let s of scorers) {
            let rank = s.rank || s.position || ''
            msg += `${rank}. *${s.player || s.name}* (${s.team || s.club || ''})\n`
            msg += `   🥅 Goals: *${s.goals}*`
            if (s.assists) msg += `  🎯 Assists: ${s.assists}`
            if (s.played) msg += `  📅 Played: ${s.played}`
            msg += '\n'
        }
        msg += `\n╚═══════════════════════╝`
        await reply(msg)
    } catch(e) { reply('❌ Could not fetch La Liga top scorers. Try again later.') }
} break

case 'laligamatches':
case 'laligafixtures':
case 'laligaupcoming': {
    await X.sendMessage(m.chat, { react: { text: '📅', key: m.key } })
    try {
        await reply('📅 _Fetching La Liga matches..._')
        let matches = await _getFixtures('laliga', `https://api.giftedtech.co.ke/api/football/laliga/upcoming?apikey=${_giftedKey()}`)
        if (!matches?.length) throw new Error('No data from any source')
        let msg = `╔══〔 📅 LA LIGA FIXTURES 〕══╗`
        for (let _fm of matches) {
            msg += `\n📆 *${_fm.date || ''}* ${_fm.time ? '⏰ ' + _fm.time : ''}\n`
            msg += `  ⚽ *${_fm.homeTeam}* vs *${_fm.awayTeam}*\n`
            if (_fm.venue || _fm.stadium) msg += `  🏟️ ${_fm.venue || _fm.stadium}\n`
            if (_fm.status && _fm.status !== 'Unknown') msg += `  ℹ️ Status: ${_fm.status}\n`
        }
        msg += `\n╚═══════════════════════╝`
        await reply(msg)
    } catch(e) { reply('❌ Could not fetch La Liga fixtures. Try again later.') }
} break

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🏆  UCL STANDINGS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  case 'ucl':
  case 'uclstandings':
  case 'championsleague': {
      await X.sendMessage(m.chat, { react: { text: '🏆', key: m.key } })
      try {
        await reply('🏆 _Fetching UCL standings..._')
        let teams = await _getStandings('ucl', 'ucl')
        if (!teams?.length) throw new Error('No data from any source')
          let msg = `╔══〔 🏆 UCL STANDINGS ${new Date().getFullYear()} 〕══╗`
          msg += `${'#'.padEnd(3)} ${'Team'.padEnd(22)} ${'P'.padEnd(3)} ${'W'.padEnd(3)} ${'D'.padEnd(3)} ${'L'.padEnd(3)} ${'GD'.padEnd(5)} Pts\n`
          msg += `${'─'.repeat(50)}\n`
          for (let t of teams) {
              let pos = String(t.position).padEnd(3)
              let team = (t.team || '').substring(0, 20).padEnd(22)
              let p = String(t.played || 0).padEnd(3)
              let w = String(t.won || 0).padEnd(3)
              let dr = String(t.draw || 0).padEnd(3)
              let l = String(t.lost || 0).padEnd(3)
              let gd = String(t.goalDifference || 0).padEnd(5)
              let pts = String(t.points || 0)
              msg += `${pos}${team}${p}${w}${dr}${l}${gd}${pts}\n`
          }
          await reply('```\n' + msg + '```')
      } catch(e) { reply('❌ Could not fetch UCL standings. Try again later.') }
  } break

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🇩🇪  BUNDESLIGA STANDINGS & SCORERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  case 'bundesliga':
  case 'bundesligastandings': {
      await X.sendMessage(m.chat, { react: { text: '🇩🇪', key: m.key } })
      try {
        await reply('🏆 _Fetching Bundesliga standings..._')
        let teams = await _getStandings('bundesliga', 'bundesliga')
        if (!teams?.length) throw new Error('No data from any source')
          let msg = `╔══〔 🏆 BUNDESLIGA STANDINGS ${new Date().getFullYear()} 〕══╗`
          msg += `${'#'.padEnd(3)} ${'Team'.padEnd(22)} ${'P'.padEnd(3)} ${'W'.padEnd(3)} ${'D'.padEnd(3)} ${'L'.padEnd(3)} ${'GD'.padEnd(5)} Pts\n`
          msg += `${'─'.repeat(50)}\n`
          for (let t of teams) {
              let pos = String(t.position).padEnd(3)
              let team = (t.team || '').substring(0, 20).padEnd(22)
              let p = String(t.played || 0).padEnd(3)
              let w = String(t.won || 0).padEnd(3)
              let dr = String(t.draw || 0).padEnd(3)
              let l = String(t.lost || 0).padEnd(3)
              let gd = String(t.goalDifference || 0).padEnd(5)
              let pts = String(t.points || 0)
              msg += `${pos}${team}${p}${w}${dr}${l}${gd}${pts}\n`
          }
          await reply('```\n' + msg + '```')
      } catch(e) { reply('❌ Could not fetch Bundesliga standings. Try again later.') }
  } break

  case 'bundesligascorers':
  case 'bundesligatopscorers': {
      await X.sendMessage(m.chat, { react: { text: '⚽', key: m.key } })
      try {
        await reply('⚽ _Fetching Bundesliga top scorers..._')
        let scorers = await _getScorers('bundesliga', 'bundesliga')
        if (!scorers?.length) throw new Error('No data from any source')
          let msg = `╔══〔 ⚽ BUNDESLIGA TOP SCORERS 〕══╗`
          for (let s of scorers) {
              let rank = s.rank || s.position || ''
              msg += `${rank}. *${s.player || s.name}* (${s.team || s.club || ''})\n`
              msg += `   🥅 Goals: *${s.goals}*`
              if (s.assists) msg += `  🎯 Assists: ${s.assists}`
              if (s.penalties && s.penalties !== 'N/A') msg += `  🎯 Pens: ${s.penalties}`
              if (s.played) msg += `  📅 Played: ${s.played}`
              msg += '\n'
          }
          msg += `\n╚═══════════════════════╝`
          await reply(msg)
      } catch(e) { reply('❌ Could not fetch Bundesliga top scorers. Try again later.') }
  } break

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🇮🇹  SERIE A STANDINGS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  case 'seriea':
  case 'serieastandings': {
      await X.sendMessage(m.chat, { react: { text: '🇮🇹', key: m.key } })
      try {
        await reply('🏆 _Fetching Serie A standings..._')
        let teams = await _getStandings('seriea', 'seriea')
        if (!teams?.length) throw new Error('No data from any source')
          let msg = `╔══〔 🏆 SERIE A STANDINGS ${new Date().getFullYear()} 〕══╗`
          msg += `${'#'.padEnd(3)} ${'Team'.padEnd(22)} ${'P'.padEnd(3)} ${'W'.padEnd(3)} ${'D'.padEnd(3)} ${'L'.padEnd(3)} ${'GD'.padEnd(5)} Pts\n`
          msg += `${'─'.repeat(50)}\n`
          for (let t of teams) {
              let pos = String(t.position).padEnd(3)
              let team = (t.team || '').substring(0, 20).padEnd(22)
              let p = String(t.played || 0).padEnd(3)
              let w = String(t.won || 0).padEnd(3)
              let dr = String(t.draw || 0).padEnd(3)
              let l = String(t.lost || 0).padEnd(3)
              let gd = String(t.goalDifference || 0).padEnd(5)
              let pts = String(t.points || 0)
              msg += `${pos}${team}${p}${w}${dr}${l}${gd}${pts}\n`
          }
          await reply('```\n' + msg + '```')
      } catch(e) { reply('❌ Could not fetch Serie A standings. Try again later.') }
  } break

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🇮🇹  SERIE A TOP SCORERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  case 'serieascorers':
  case 'serieaTopscorers': {
      await X.sendMessage(m.chat, { react: { text: '⚽', key: m.key } })
      try {
        await reply('⚽ _Fetching Serie A top scorers..._')
        let scorers = await _getScorers('seriea', 'seriea')
        if (!scorers?.length) throw new Error('No data from any source')
          let msg = `╔══〔 ⚽ SERIE A TOP SCORERS 〕══╗`
          for (let s of scorers) {
              msg += `${s.rank}. *${s.player}* (${s.team})\n`
              msg += `   🥅 Goals: *${s.goals}*`
              if (s.assists) msg += `  🎯 Assists: ${s.assists}`
              if (s.penalties && s.penalties !== 'N/A') msg += `  🎽 Pens: ${s.penalties}`
              msg += '\n'
          }
          msg += `\n╚═══════════════════════╝`
          await reply(msg)
      } catch(e) { reply('❌ Could not fetch Serie A top scorers. Try again later.') }
  } break
  

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🇫🇷  LIGUE 1 — STANDINGS · SCORERS · MATCHES (Keith API)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    case 'ligue1':
    case 'ligue1standings': {
        await X.sendMessage(m.chat, { react: { text: '🇫🇷', key: m.key } })
        try {
            await reply('🏆 _Fetching Ligue 1 standings..._')
            let teams = await _getStandings('ligue1', 'ligue1')
            if (!teams?.length) throw new Error('No data')
            let msg = `╔══〔 🏆 LIGUE 1 STANDINGS ${new Date().getFullYear()} 〕══╗`
            msg += `${'#'.padEnd(3)} ${'Team'.padEnd(22)} ${'P'.padEnd(3)} ${'W'.padEnd(3)} ${'D'.padEnd(3)} ${'L'.padEnd(3)} ${'GD'.padEnd(5)} Pts\n`
            msg += `${'─'.repeat(50)}\n`
            for (let t of teams) {
                let pos = String(t.position).padEnd(3), team = (t.team||'').substring(0,20).padEnd(22)
                let p = String(t.played||0).padEnd(3), w = String(t.won||0).padEnd(3), dr = String(t.draw||0).padEnd(3)
                let l = String(t.lost||0).padEnd(3), gd = String(t.goalDifference||0).padEnd(5), pts = String(t.points||0)
                msg += `${pos}${team}${p}${w}${dr}${l}${gd}${pts}\n`
            }
            await reply('```\n' + msg + '```')
        } catch(e) { reply('❌ Could not fetch Ligue 1 standings. Try again later.') }
    } break

    case 'ligue1scorers':
    case 'ligue1topscorers': {
        await X.sendMessage(m.chat, { react: { text: '⚽', key: m.key } })
        try {
            await reply('⚽ _Fetching Ligue 1 top scorers..._')
            let scorers = await _getScorers('ligue1', 'ligue1')
            if (!scorers?.length) throw new Error('No data')
            let msg = `╔══〔 ⚽ LIGUE 1 TOP SCORERS 〕══╗`
            for (let s of scorers) {
                let rank = s.rank || s.position || ''
                msg += `${rank}. *${s.player||s.name}* (${s.team||s.club||''})\n`
                msg += `   🥅 Goals: *${s.goals}*`
                if (s.assists) msg += `  🎯 Assists: ${s.assists}`
                if (s.penalties && s.penalties !== 'N/A') msg += `  🎽 Pens: ${s.penalties}`
                msg += '\n'
            }
            msg += `\n╚═══════════════════════╝`
            await reply(msg)
        } catch(e) { reply('❌ Could not fetch Ligue 1 top scorers. Try again later.') }
    } break

    case 'ligue1matches':
    case 'ligue1fixtures': {
        await X.sendMessage(m.chat, { react: { text: '📅', key: m.key } })
        try {
            await reply('📅 _Fetching Ligue 1 matches..._')
            let matches = await _getFixtures('ligue1', `https://api.giftedtech.co.ke/api/football/ligue1/upcoming?apikey=${_giftedKey()}`)
            if (!matches?.length) throw new Error('No data')
            let msg = `╔══〔 📅 LIGUE 1 FIXTURES 〕══╗`
            for (let _fm of matches) {
                msg += `\n📆 *${_fm.date||_fm.matchday||''}*\n`
                msg += `  ⚽ *${_fm.homeTeam}* vs *${_fm.awayTeam}*`
                if (_fm.status && _fm.status !== '') msg += ` [${_fm.status}]`
                msg += '\n'
            }
            msg += `\n╚═══════════════════════╝`
            await reply(msg)
        } catch(e) { reply('❌ Could not fetch Ligue 1 fixtures. Try again later.') }
    } break

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🏆  UEFA EUROS — STANDINGS · SCORERS (Keith API)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    case 'euros':
    case 'eurosstandings':
    case 'eurostandings': {
        await X.sendMessage(m.chat, { react: { text: '🏆', key: m.key } })
        try {
            await reply('🏆 _Fetching Euros standings..._')
            let teams = await _getStandings('euros', 'euros')
            if (!teams?.length) throw new Error('No data')
            let msg = `╔══〔 🏆 UEFA EUROS STANDINGS 〕══╗`
            msg += `${'#'.padEnd(3)} ${'Team'.padEnd(22)} ${'P'.padEnd(3)} ${'W'.padEnd(3)} ${'D'.padEnd(3)} ${'L'.padEnd(3)} ${'GD'.padEnd(5)} Pts\n`
            msg += `${'─'.repeat(50)}\n`
            for (let t of teams) {
                let pos = String(t.position).padEnd(3), team = (t.team||'').substring(0,20).padEnd(22)
                let p = String(t.played||0).padEnd(3), w = String(t.won||0).padEnd(3), dr = String(t.draw||0).padEnd(3)
                let l = String(t.lost||0).padEnd(3), gd = String(t.goalDifference||0).padEnd(5), pts = String(t.points||0)
                msg += `${pos}${team}${p}${w}${dr}${l}${gd}${pts}\n`
            }
            await reply('```\n' + msg + '```')
        } catch(e) { reply('❌ Could not fetch Euros standings. Try again later.') }
    } break

    case 'eurosscorers':
    case 'eurotopscorers': {
        await X.sendMessage(m.chat, { react: { text: '⚽', key: m.key } })
        try {
            await reply('⚽ _Fetching Euros top scorers..._')
            let scorers = await _getScorers('euros', 'euros')
            if (!scorers?.length) throw new Error('No data')
            let msg = `╔══〔 ⚽ EUROS TOP SCORERS 〕══╗`
            for (let s of scorers) {
                let rank = s.rank || s.position || ''
                msg += `${rank}. *${s.player||s.name}* (${s.team||s.club||''})\n`
                msg += `   🥅 Goals: *${s.goals}*`
                if (s.assists) msg += `  🎯 Assists: ${s.assists}`
                msg += '\n'
            }
            msg += `\n╚═══════════════════════╝`
            await reply(msg)
        } catch(e) { reply('❌ Could not fetch Euros top scorers. Try again later.') }
    } break

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🌍  FIFA WORLD CUP — STANDINGS · SCORERS (Keith API)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    case 'fifa':
    case 'fifastandings':
    case 'worldcupstandings': {
        await X.sendMessage(m.chat, { react: { text: '🌍', key: m.key } })
        try {
            await reply('🌍 _Fetching FIFA standings..._')
            let teams = await _getStandings('fifa', 'fifa')
            if (!teams?.length) throw new Error('No data')
            let msg = `╔══〔 🌍 FIFA STANDINGS 〕══╗`
            msg += `${'#'.padEnd(3)} ${'Team'.padEnd(22)} ${'P'.padEnd(3)} ${'W'.padEnd(3)} ${'D'.padEnd(3)} ${'L'.padEnd(3)} ${'GD'.padEnd(5)} Pts\n`
            msg += `${'─'.repeat(50)}\n`
            for (let t of teams) {
                let pos = String(t.position).padEnd(3), team = (t.team||'').substring(0,20).padEnd(22)
                let p = String(t.played||0).padEnd(3), w = String(t.won||0).padEnd(3), dr = String(t.draw||0).padEnd(3)
                let l = String(t.lost||0).padEnd(3), gd = String(t.goalDifference||0).padEnd(5), pts = String(t.points||0)
                msg += `${pos}${team}${p}${w}${dr}${l}${gd}${pts}\n`
            }
            await reply('```\n' + msg + '```')
        } catch(e) { reply('❌ Could not fetch FIFA standings. Try again later.') }
    } break

    case 'fifascorers':
    case 'fifatopscorers':
    case 'worldcupscorers': {
        await X.sendMessage(m.chat, { react: { text: '⚽', key: m.key } })
        try {
            await reply('⚽ _Fetching FIFA top scorers..._')
            let scorers = await _getScorers('fifa', 'fifa')
            if (!scorers?.length) throw new Error('No data')
            let msg = `╔══〔 ⚽ FIFA TOP SCORERS 〕══╗`
            for (let s of scorers) {
                let rank = s.rank || s.position || ''
                msg += `${rank}. *${s.player||s.name}* (${s.team||s.club||''})\n`
                msg += `   🥅 Goals: *${s.goals}*`
                if (s.assists) msg += `  🎯 Assists: ${s.assists}`
                msg += '\n'
            }
            msg += `\n╚═══════════════════════╝`
            await reply(msg)
        } catch(e) { reply('❌ Could not fetch FIFA top scorers. Try again later.') }
    } break

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔍  PLAYER / TEAM / VENUE SEARCH + MATCH EVENTS (Keith API)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    case 'playersearch':
    case 'searchplayer': {
        await X.sendMessage(m.chat, { react: { text: '🔍', key: m.key } })
        const _psq = q?.trim()
        if (!_psq) { reply('⚠️ Usage: *.playersearch* [player name]\nExample: .playersearch Erling Haaland'); break }
        try {
            await reply(`🔍 _Searching for player: ${_psq}..._`)
            const _psd = await _keithFetch(`/sport/playersearch?q=${encodeURIComponent(_psq)}`)
            const _psr = Array.isArray(_psd) ? _psd : (_psd?.result || [])
            if (!_psr.length) { reply(`❌ No player found for "*${_psq}*"`); break }
            let msg = `╔══〔 🔍 PLAYER SEARCH: ${_psq.toUpperCase()} 〕══╗\n`
            for (let p of _psr.slice(0, 5)) {
                msg += `\n👤 *${p.name}*\n`
                if (p.team) msg += `  🏟️ Club: ${p.team}\n`
                if (p.nationality) msg += `  🌍 Nationality: ${p.nationality}\n`
                if (p.position) msg += `  ⚽ Position: ${p.position}\n`
                if (p.birthDate) msg += `  🎂 Born: ${p.birthDate}\n`
                if (p.status) msg += `  📋 Status: ${p.status}\n`
            }
            msg += `\n╚═══════════════════════╝`
            await reply(msg)
        } catch(e) { reply('❌ Player search failed. Try again later.') }
    } break

    case 'teamsearch':
    case 'searchteam': {
        await X.sendMessage(m.chat, { react: { text: '🔍', key: m.key } })
        const _tsq = q?.trim()
        if (!_tsq) { reply('⚠️ Usage: *.teamsearch* [team name]\nExample: .teamsearch Arsenal'); break }
        try {
            await reply(`🔍 _Searching for team: ${_tsq}..._`)
            const _tsd = await _keithFetch(`/sport/teamsearch?q=${encodeURIComponent(_tsq)}`)
            const _tsr = Array.isArray(_tsd) ? _tsd : (_tsd?.result || [])
            if (!_tsr.length) { reply(`❌ No team found for "*${_tsq}*"`); break }
            let msg = `╔══〔 🔍 TEAM SEARCH: ${_tsq.toUpperCase()} 〕══╗\n`
            for (let t of _tsr.slice(0, 3)) {
                msg += `\n🏆 *${t.name}*`
                if (t.shortName) msg += ` (${t.shortName})`
                msg += '\n'
                if (t.league) msg += `  🏟️ League: ${t.league}\n`
                if (t.country) msg += `  🌍 Country: ${t.country}\n`
                if (t.stadium) msg += `  🏟️ Stadium: ${t.stadium}\n`
                if (t.stadiumCapacity) msg += `  👥 Capacity: ${t.stadiumCapacity}\n`
                if (t.location) msg += `  📍 Location: ${t.location}\n`
            }
            msg += `\n╚═══════════════════════╝`
            await reply(msg)
        } catch(e) { reply('❌ Team search failed. Try again later.') }
    } break

    case 'venuesearch':
    case 'searchvenue':
    case 'stadiumsearch': {
        await X.sendMessage(m.chat, { react: { text: '🏟️', key: m.key } })
        const _vsq = q?.trim()
        if (!_vsq) { reply('⚠️ Usage: *.venuesearch* [stadium name]\nExample: .venuesearch Wembley'); break }
        try {
            await reply(`🏟️ _Searching for venue: ${_vsq}..._`)
            const _vsd = await _keithFetch(`/sport/venuesearch?q=${encodeURIComponent(_vsq)}`)
            const _vsr = Array.isArray(_vsd) ? _vsd : (_vsd?.result || [])
            if (!_vsr.length) { reply(`❌ No venue found for "*${_vsq}*"`); break }
            let msg = `╔══〔 🏟️ VENUE SEARCH: ${_vsq.toUpperCase()} 〕══╗\n`
            for (let v of _vsr.slice(0, 3)) {
                msg += `\n🏟️ *${v.name}*\n`
                if (v.sport) msg += `  ⚽ Sport: ${v.sport}\n`
                if (v.description) msg += `  📝 ${v.description.slice(0,200)}...\n`
            }
            msg += `\n╚═══════════════════════╝`
            await reply(msg)
        } catch(e) { reply('❌ Venue search failed. Try again later.') }
    } break

    case 'gameevents':
    case 'matchevents':
    case 'matchhistory': {
        await X.sendMessage(m.chat, { react: { text: '📋', key: m.key } })
        const _geq = q?.trim()
        if (!_geq) { reply('⚠️ Usage: *.gameevents* [team1 vs team2]\nExample: .gameevents Arsenal vs Chelsea'); break }
        try {
            await reply(`📋 _Searching match events: ${_geq}..._`)
            const _ged = await _keithFetch(`/sport/gameevents?q=${encodeURIComponent(_geq)}`)
            const _ger = Array.isArray(_ged) ? _ged : (_ged?.result || [])
            if (!_ger.length) { reply(`❌ No match events found for "*${_geq}*"`); break }
            let msg = `╔══〔 📋 MATCH EVENTS: ${_geq.toUpperCase()} 〕══╗\n`
            for (let ev of _ger.slice(0, 5)) {
                msg += `\n⚽ *${ev.match||ev.alternateMatchName||''}*\n`
                if (ev.league?.name) msg += `  🏆 League: ${ev.league.name}\n`
                if (ev.season) msg += `  📅 Season: ${ev.season}\n`
                if (ev.dateTime?.date) msg += `  🗓️ Date: ${ev.dateTime.date} ${ev.dateTime.time||''}\n`
                if (ev.teams?.home && ev.teams?.away) {
                    msg += `  🔵 ${ev.teams.home.name} ${ev.teams.home.score ?? ''} – ${ev.teams.away.score ?? ''} ${ev.teams.away.name}\n`
                }
                if (ev.venue?.name) msg += `  🏟️ Venue: ${ev.venue.name}\n`
                if (ev.status) msg += `  📋 Status: ${ev.status}\n`
            }
            msg += `\n╚═══════════════════════╝`
            await reply(msg)
        } catch(e) { reply('❌ Match events search failed. Try again later.') }
    } break

  

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🏅  SPORTS — LIVE, ALL, CATEGORIES, STREAM  (xcasper /api/live)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helper: send long text in chunks so ALL matches always appear (WA limit ~65KB)
async function _sendAllChunked(chat, lines, chunkSize = 3500) {
    let buf = ''
    for (const line of lines) {
        if (buf.length + line.length > chunkSize) {
            await X.sendMessage(chat, { text: buf.trimEnd() })
            buf = ''
        }
        buf += line
    }
    if (buf.trim()) await X.sendMessage(chat, { text: buf.trimEnd() })
}
case 'sportscategories':
case 'sportcategories':
case 'sportcat': {
    await X.sendMessage(m.chat, { react: { text: '🏅', key: m.key } })
    try {
        let _r = await fetch('https://movieapi.xcasper.space/api/live', { signal: AbortSignal.timeout(15000) })
        let _d = await _r.json()
        if (!_d.success || !_d.data?.matchList) throw new Error('No data')
        let _all = _d.data.matchList
        let _catMap = {}
        for (let _ev of _all) {
            let _t = (_ev.type || 'other').toLowerCase()
            _catMap[_t] = (_catMap[_t] || 0) + 1
        }
        const _sportIcon = { football: '⚽', basketball: '🏀', tennis: '🎾', cricket: '🏏', baseball: '⚾', hockey: '🏒', rugby: '🏉', volleyball: '🏐', motorsports: '🏎️', boxing: '🥊', mma: '🥋', badminton: '🏸', tabletennis: '🏓', snooker: '🎱' }
        let _msg = `╔══〔 🏅 SPORTS CATEGORIES 〕══╗\n\n\n╚═══════════════════════╝`
        for (let [_cat, _cnt] of Object.entries(_catMap).sort((a,b) => b[1]-a[1])) {
            _msg += `  ${_sportIcon[_cat] || '🏅'} *${_cat}* — ${_cnt} match${_cnt!==1?'es':''}\n`
        }
        _msg += `\n_Use ${prefix}livesports [sport] to see live events_\n_Use ${prefix}allsports [sport] to see all events_\n_Use ${prefix}watchsport [match-id] to get stream link_`
        await reply(_msg)
    } catch(e) { reply('❌ Could not fetch sports categories. Try again later.') }
} break

case 'livesports':
case 'sportslive': {
    await X.sendMessage(m.chat, { react: { text: '🔴', key: m.key } })
    let _lsCat = (text?.toLowerCase().trim()) || ''
    try {
        await reply(`🔴 _Fetching live sports events..._`)
        let _r = await fetch('https://movieapi.xcasper.space/api/live', { signal: AbortSignal.timeout(20000) })
        let _d = await _r.json()
        if (!_d.success || !_d.data?.matchList) throw new Error('No data')
        let _all = _d.data.matchList
        // Filter: only genuinely live/ongoing matches
        let _live = _all.filter(ev => {
            let _st = (ev.status || '').toLowerCase()
            let _sl = (ev.statusLive || '').toLowerCase()
            return _st === 'living' || _sl === 'living' || _st.includes('live') || _st.includes('progress') || _st.includes('half')
        })
        if (_lsCat) _live = _live.filter(ev => (ev.type || '').toLowerCase().includes(_lsCat))
        if (!_live.length) {
            let _label = _lsCat ? `*${_lsCat}*` : 'any sport'
            return reply(`╔══〔 🔴 NO LIVE EVENTS 〕══╗\n║ No live *${_label}* events right now\n╠══〔 💡 TRY INSTEAD 〕═══╣\n║ ${prefix}allsports        — all matches\n║ ${prefix}sportscategories — all sports\n╚═══════════════════════╝`)
        }
        const _si = { football: '⚽', basketball: '🏀', tennis: '🎾', cricket: '🏏', baseball: '⚾', hockey: '🏒', rugby: '🏉', volleyball: '🏐', motorsports: '🏎️', boxing: '🥊', mma: '🥋' }
        let _lines = [`╔══〔 🔴 LIVE SPORTS (${live.length}) 〕══╗\n\n╚═══════════════════════╝`]
        for (let _ev of _live) {
            let _icon = _si[(_ev.type||'').toLowerCase()] || '🏅'
            let _sc1 = _ev.team1?.score || '0', _sc2 = _ev.team2?.score || '0'
            let _entry = `\n${_icon} *${_ev.team1?.name || '?'} ${_sc1} - ${_sc2} ${_ev.team2?.name || '?'}*\n`
            if (_ev.league) _entry += `   🏆 ${_ev.league}\n`
            if (_ev.timeDesc) _entry += `   ⏱️ ${_ev.timeDesc}\n`
            _entry += `   🆔 ${_ev.id}\n`
            _lines.push(_entry)
        }
        _lines.push(`\n_Use ${prefix}watchsport [match-id] to get the stream link_`)
        await _sendAllChunked(m.chat, _lines)
    } catch(e) { reply(`❌ Could not fetch live sports. Try again later.`) }
} break

case 'allsports':
case 'sportsall': {
    await X.sendMessage(m.chat, { react: { text: '🏅', key: m.key } })
    let _asCat = (text?.toLowerCase().trim()) || ''
    try {
        await reply(`🏅 _Fetching sports events..._`)
        let _r = await fetch('https://movieapi.xcasper.space/api/live', { signal: AbortSignal.timeout(20000) })
        let _d = await _r.json()
        if (!_d.success || !_d.data?.matchList) throw new Error('No data')
        let _all = _d.data.matchList
        if (_asCat) _all = _all.filter(ev => (ev.type || '').toLowerCase().includes(_asCat))
        if (!_all.length) return reply(`╔══〔 🏅 NO EVENTS FOUND 〕══╗\n║ No *${_asCat || 'sports'}* events found\n║ Try: *${prefix}sportscategories*\n╚═══════════════════════╝`)
        const _si = { football: '⚽', basketball: '🏀', tennis: '🎾', cricket: '🏏', baseball: '⚾', hockey: '🏒', rugby: '🏉', volleyball: '🏐', motorsports: '🏎️', boxing: '🥊', mma: '🥋' }
        const _statusLabel = { living: '🔴 LIVE', matchended: '✅ Ended', matchnotstart: '🕐 Not Started' }
        let _lines = [`╔══〔 🏅 ${asCat ? asCat.toUpperCase() + ' EVENTS' : 'ALL SPORTS'} (${all.length}) 〕══╗\n\n╚═══════════════════════╝`]
        for (let _ev of _all) {
            let _icon = _si[(_ev.type||'').toLowerCase()] || '🏅'
            let _sc1 = _ev.team1?.score || '0', _sc2 = _ev.team2?.score || '0'
            let _stKey = (_ev.status || '').toLowerCase().replace(/\s/g,'')
            let _stLabel = _statusLabel[_stKey] || _ev.timeDesc || _ev.status || ''
            let _entry = `\n${_icon} *${_ev.team1?.name || '?'} ${_sc1} - ${_sc2} ${_ev.team2?.name || '?'}*\n`
            if (_ev.league) _entry += `   🏆 ${_ev.league}\n`
            if (_stLabel) _entry += `   📊 ${_stLabel}\n`
            _entry += `   🆔 ${_ev.id}\n`
            _lines.push(_entry)
        }
        _lines.push(`\n_Use ${prefix}watchsport [match-id] to get the stream link_`)
        await _sendAllChunked(m.chat, _lines)
    } catch(e) { reply(`❌ Could not fetch sports events. Try again later.`) }
} break

case 'watchsport':
case 'streamsport':
case 'sportsstream': {
    await X.sendMessage(m.chat, { react: { text: '📺', key: m.key } })
    if (!text) return reply(`╔══〔 📺 WATCH SPORT 〕═══╗\n\n║ Usage: *${prefix}watchsport [match-id]*\n║ Get IDs: *${prefix}livesports* or *${prefix}allsports*\n║ Example: ${prefix}watchsport 4789881499804909776\n╚═══════════════════════╝`)
    try {
        await reply('📺 _Fetching stream link..._')
        let _r = await fetch('https://movieapi.xcasper.space/api/live', { signal: AbortSignal.timeout(20000) })
        let _d = await _r.json()
        if (!_d.success || !_d.data?.matchList) throw new Error('No data')
        let _ev = _d.data.matchList.find(ev => ev.id === text.trim())
        if (!_ev) return reply(`❌ Match ID *${text.trim()}* not found.\n\nUse *${prefix}allsports* to get valid match IDs.`)
        let _streamUrl = _ev.playPath || ''
        let _msg = `╔══〔 📺 SPORT STREAM 〕══╗\n\n\n╚═══════════════════════╝`
        _msg += `⚽ *${_ev.team1?.name || '?'} vs ${_ev.team2?.name || '?'}*\n`
        if (_ev.league) _msg += `🏆 *League:* ${_ev.league}\n`
        let _stKey = (_ev.status || '').toLowerCase()
        if (_stKey === 'living') _msg += `📊 *Status:* 🔴 LIVE\n`
        else if (_stKey === 'matchended') _msg += `📊 *Status:* ✅ Ended (${_ev.team1?.score || 0}-${_ev.team2?.score || 0})\n`
        else _msg += `📊 *Status:* ${_ev.status || 'Unknown'}\n`
        if (_streamUrl) {
            _msg += `\n🔗 *Stream URL (HLS/M3U8):*\n${_streamUrl}\n\n`
            _msg += `_Open with VLC, MX Player, or any HLS-compatible player_`
        } else {
            _msg += `\n⚠️ _No stream available for this match right now._\n_Streams are only available for live/ongoing matches._`
        }
        await reply(_msg)
    } catch(e) { reply(`❌ Could not get stream for match *${text}*. Try again later.`) }
} break


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NEW COMMANDS FROM PLUGIN ZIP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ─── AI aliases ─────────────────────────────────────────────────────
case 'gpt':
case 'gpt4': {
    await X.sendMessage(m.chat, { react: { text: '🤖', key: m.key } })
    if (!text) return reply(`╔═════〔 🤖 GPT-4 〕══════╗\n\n║ Usage: *${prefix}gpt4 [message]*\n║ Example: ${prefix}gpt4 Hello, how are you?\n╚═══════════════════════╝`)
    try {
        let _kResultgpt4 = null
    try {
      let _kr = await fetch(`https://apiskeith.top/ai/gpt?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
      let _kd = await _kr.json()
      if (_kd.status && _kd.result) _kResultgpt4 = typeof _kd.result === 'string' ? _kd.result : JSON.stringify(_kd.result)
    } catch {}
    if (_kResultgpt4) return reply(_kResultgpt4)
    const result = await _runAI('You are GPT-4, a highly intelligent AI assistant by OpenAI. Be helpful, clear and concise.', text)
        reply(result)
    } catch (e) {
        reply('❌ GPT-4 is currently unavailable. Please try again.')
    }
} break

case 'claude': {
    await X.sendMessage(m.chat, { react: { text: '💎', key: m.key } })
    if (!text) return reply(`╔═══〔 💎 CLAUDE AI 〕════╗\n\n║ Usage: *${prefix}claude [message]*\n║ Example: ${prefix}claude Hello, how are you?\n╚═══════════════════════╝`)
    try {
        let _kResultclaude = null
        try {
          let _kr = await fetch(`https://apiskeith.top/ai/claude?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
          let _kd = await _kr.json()
          if (_kd.status && _kd.result) _kResultclaude = typeof _kd.result === 'string' ? _kd.result : JSON.stringify(_kd.result)
        } catch {}
        if (_kResultclaude) return reply(_kResultclaude)
        const result = await _runAI('You are Claude AI, an AI assistant made by Anthropic. You are helpful, harmless, and honest. Provide thoughtful and detailed responses.', text)
        reply(result)
    } catch (e) {
        reply('❌ Claude AI is currently unavailable. Please try again.')
    }
} break

// ─── Fun aliases ─────────────────────────────────────────────────────
case 'eightball':
case 'magicball': {
    await X.sendMessage(m.chat, { react: { text: '🎱', key: m.key } })
    if (!text) return reply(`╔══〔 🎱 MAGIC 8 BALL 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Will I pass my exam?\n╚═══════════════════════╝`)
    const _8bAnswers = ['It is certain.','It is decidedly so.','Without a doubt.','Yes definitely.','You may rely on it.','As I see it, yes.','Most likely.','Outlook good.','Yes.','Signs point to yes.','Reply hazy, try again.','Ask again later.','Better not tell you now.','Cannot predict now.','Concentrate and ask again.',"Don't count on it.",'My reply is no.','My sources say no.','Outlook not so good.','Very doubtful.']
    reply(`╔══〔 🎱 MAGIC 8 BALL 〕═══╗\n║ ❓ *${text}*\n║\n║ 💬 ${_8bAnswers[Math.floor(Math.random() * _8bAnswers.length)]}\n╚═══════════════════════╝`)
} break

// ─── Sports aliases ──────────────────────────────────────────────────
case 'fixtures':
case 'matches': {
    await X.sendMessage(m.chat, { react: { text: '📅', key: m.key } })
    try {
        await reply('📅 _Fetching upcoming EPL fixtures..._')
        const _gKey = typeof _giftedKey === 'function' ? _giftedKey() : (global._giftedApiKey || '')
        let _fxMatches = await _getFixtures('epl', `https://api.giftedtech.co.ke/api/football/epl/upcoming?apikey=${_gKey}`)
        if (!_fxMatches?.length) throw new Error('No fixtures found')
        let _fxMsg = `╔══〔 📅  UPCOMING EPL FIXTURES 〕══╗\n\n╚═══════════════════════╝`
        for (let _fm of _fxMatches) {
            _fxMsg += `\n📆 *${_fm.date || ''}*${_fm.time ? '  ⏰ ' + _fm.time : ''}\n`
            _fxMsg += `  ⚽ *${_fm.homeTeam}* vs *${_fm.awayTeam}*\n`
            if (_fm.venue || _fm.stadium) _fxMsg += `  🏟️ _${_fm.venue || _fm.stadium}_\n`
        }
        await reply(_fxMsg)
    } catch(e) { reply('❌ Could not fetch EPL fixtures. Try again later.') }
} break

// ─── Owner commands ──────────────────────────────────────────────────
case 'broadcast':
case 'bc': {
    await X.sendMessage(m.chat, { react: { text: '📢', key: m.key } })
    if (!isOwner) return reply(mess.OnlyOwner)
    if (!text) return reply(`╔═══〔 📢 BROADCAST 〕════╗\n\n║ Usage: *${prefix}broadcast <your message>*\n║ Sends to all groups the bot is in\n╚═══════════════════════╝`)
    await reply('📢 Sending broadcast...')
    try {
        const _bcGroups = await X.groupFetchAllParticipating()
        const _bcIds = Object.keys(_bcGroups)
        let _bcSent = 0
        for (const _bcId of _bcIds) {
            try {
                await X.sendMessage(_bcId, { text: `📢 *BROADCAST*\n\n${text}` })
                _bcSent++
                await new Promise(r => setTimeout(r, 500))
            } catch (_) {}
        }
        reply(`✅ Broadcast sent to *${_bcSent}/${_bcIds.length}* groups!`)
    } catch (e) { reply('❌ Broadcast failed: ' + e.message) }
} break

case 'addsudo':
case 'addmod': {
    await X.sendMessage(m.chat, { react: { text: '🛡️', key: m.key } })
    if (!isOwner) return reply(mess.OnlyOwner)
    let _sudoTarget = (m.mentionedJid && m.mentionedJid[0]) || (m.quoted && m.quoted.sender) || (args[0] && args[0].replace(/\D/g,'') + '@s.whatsapp.net')
    if (!_sudoTarget) return reply(`╔═══〔 🛡️ ADD SUDO 〕════╗\n\n║ Usage: *${prefix}addsudo @user*\n║ Or reply to a message\n╚═══════════════════════╝`)
    const _sudoPath = path.join(__dirname, 'database', 'sudoUsers.json')
    let _sudoList = []
    try { _sudoList = JSON.parse(fs.readFileSync(_sudoPath, 'utf-8')) } catch { _sudoList = [] }
    if (_sudoList.includes(_sudoTarget)) return reply(`⚠️ @${_sudoTarget.split('@')[0]} is already a sudo user.`)
    _sudoList.push(_sudoTarget)
    fs.mkdirSync(path.join(__dirname, 'database'), { recursive: true })
    fs.writeFileSync(_sudoPath, JSON.stringify(_sudoList, null, 2))
    await X.sendMessage(m.chat, { text: `✅ @${_sudoTarget.split('@')[0]} added as *sudo/mod*!`, mentions: [_sudoTarget] }, { quoted: m })
} break

case 'delsudo':
case 'removesudo':
case 'removemod': {
    await X.sendMessage(m.chat, { react: { text: '🔓', key: m.key } })
    if (!isOwner) return reply(mess.OnlyOwner)
    let _dsuTarget = (m.mentionedJid && m.mentionedJid[0]) || (m.quoted && m.quoted.sender) || (args[0] && args[0].replace(/\D/g,'') + '@s.whatsapp.net')
    if (!_dsuTarget) return reply(`╔══〔 🔓 REMOVE SUDO 〕═══╗\n\n║ Usage: *${prefix}delsudo @user*\n║ Or reply to a message\n╚═══════════════════════╝`)
    const _dsuPath = path.join(__dirname, 'database', 'sudoUsers.json')
    let _dsuList = []
    try { _dsuList = JSON.parse(fs.readFileSync(_dsuPath, 'utf-8')) } catch { _dsuList = [] }
    const _dsuIdx = _dsuList.indexOf(_dsuTarget)
    if (_dsuIdx === -1) return reply(`⚠️ @${_dsuTarget.split('@')[0]} is not a sudo user.`)
    _dsuList.splice(_dsuIdx, 1)
    fs.writeFileSync(_dsuPath, JSON.stringify(_dsuList, null, 2))
    await X.sendMessage(m.chat, { text: `✅ @${_dsuTarget.split('@')[0]} removed from *sudo*!`, mentions: [_dsuTarget] }, { quoted: m })
} break

case 'sudolist':
case 'mods':
case 'listmods': {
    await X.sendMessage(m.chat, { react: { text: '📋', key: m.key } })
    if (!isOwner) return reply(mess.OnlyOwner)
    const _slPath = path.join(__dirname, 'database', 'sudoUsers.json')
    let _slList = []
    try { _slList = JSON.parse(fs.readFileSync(_slPath, 'utf-8')) } catch { _slList = [] }
    if (!_slList.length) return reply('╔══〔 🛡️  SUDO / MOD USERS 〕══╗\n\n║ _No sudo users set yet._\n\n║ Use `.addsudo @user` to add one.')
    const _slMentions = _slList.map(u => u)
    await X.sendMessage(m.chat, {
        text: `╔══〔 🛡️  SUDO / MOD USERS 〕══╗\n\n${_slList.map((u, i) => `  ${i+1}. @${u.split('@')[0]}`).join('\n')}\n\n║ _Total: ${_slList.length} user(s)_\n╚═══════════════════════╝`,
        mentions: _slMentions
    }, { quoted: m })
} break

case 'setname':
case 'setbotname': {
    await X.sendMessage(m.chat, { react: { text: '✏️', key: m.key } })
    if (!isOwner) return reply(mess.OnlyOwner)
    if (!text) return reply(`╔══〔 ✏️ SET BOT NAME 〕══╗\n\n║ Usage: *${prefix}setbotname <new name>*\n╚═══════════════════════╝`)
    try {
        await X.updateProfileName(text)
        reply(`✅ Bot name updated to: *${text}*`)
    } catch (e) { reply('❌ Failed to update name: ' + e.message) }
} break

case 'sysinfo':
case 'system':
case 'serverinfo': {
    await X.sendMessage(m.chat, { react: { text: '🖥️', key: m.key } })
    if (!isOwner) return reply(mess.OnlyOwner)
    const _siMem = process.memoryUsage()
    const _siTot = os.totalmem(), _siFree = os.freemem()
    const _siUsed = ((_siTot - _siFree) / 1024 / 1024).toFixed(1)
    const _siTotMb = (_siTot / 1024 / 1024).toFixed(1)
    const _siCpus = os.cpus()
    const _siUp = process.uptime()
    const _siD = Math.floor(_siUp / 86400), _siH = Math.floor((_siUp % 86400) / 3600)
    const _siMn = Math.floor((_siUp % 3600) / 60), _siS = Math.floor(_siUp % 60)
    reply(
        `╔══〔 🖥️ SYSTEM INFORMATION 〕══╗\n\n\n╚═══════════════════════╝` +
        `║ 💾 *RAM* : ${_siUsed} MB / ${_siTotMb} MB\n` +
        `║ 🧠 *Heap* : ${(_siMem.heapUsed / 1024 / 1024).toFixed(1)} MB\n` +
        `║ ⚙️  *CPU* : ${_siCpus[0]?.model?.trim() || 'Unknown'}\n` +
        `║ 🔢 *Cores* : ${_siCpus.length}\n` +
        `║ 🖥️  *OS* : ${os.type()} ${os.release()}\n` +
        `║ 📦 *Node* : ${process.version}\n` +
        `║ ⏱️  *Uptime* : ${_siD}d ${_siH}h ${_siMn}m ${_siS}s\n` +
        `║ 🏠 *Host* : ${os.hostname()}`
    )
} break

case 'onlygroup':
case 'onlygc': {
    await X.sendMessage(m.chat, { react: { text: '👥', key: m.key } })
    if (!isOwner) return reply(mess.OnlyOwner)
    const _ogArg = (args[0] || '').toLowerCase()
    if (_ogArg === 'on') { global.onlyGroup = true; reply('✅ *Only Group mode ON* — bot will only respond in groups.') }
    else if (_ogArg === 'off') { global.onlyGroup = false; reply('✅ *Only Group mode OFF*') }
    else reply(`╔══〔 👥 ONLY GROUP MODE 〕══╗\n║ 📊 *Status* : ${global.onlyGroup ? '✅ ON' : '❌ OFF'}\n║ Usage: *${prefix}onlygroup on/off*\n╚═══════════════════════╝`)
} break

case 'onlypc': {
    await X.sendMessage(m.chat, { react: { text: '💬', key: m.key } })
    if (!isOwner) return reply(mess.OnlyOwner)
    const _opcArg = (args[0] || '').toLowerCase()
    if (_opcArg === 'on') { global.onlyPC = true; reply('✅ *Only Private Chat mode ON* — bot will only respond in DMs.') }
    else if (_opcArg === 'off') { global.onlyPC = false; reply('✅ *Only Private Chat mode OFF*') }
    else reply(`╔══〔 📩 ONLY DM MODE 〕═══╗\n║ 📊 *Status* : ${global.onlyPC ? '✅ ON' : '❌ OFF'}\n║ Usage: *${prefix}onlypc on/off*\n╚═══════════════════════╝`)
} break

case 'unavailable': {
    await X.sendMessage(m.chat, { react: { text: '🔕', key: m.key } })
    if (!isOwner) return reply(mess.OnlyOwner)
    const _unavArg = (args[0] || '').toLowerCase()
    if (_unavArg === 'on') {
        global.botUnavailable = true
        try { await X.sendPresenceUpdate('unavailable') } catch (_) {}
        reply('✅ *Unavailable mode ON* — bot appears offline.')
    } else if (_unavArg === 'off') {
        global.botUnavailable = false
        try { await X.sendPresenceUpdate('available') } catch (_) {}
        reply('✅ *Unavailable mode OFF* — bot appears online.')
    } else reply(`╔══〔 🔕 UNAVAILABLE MODE 〕╗\n║ 📊 *Status* : ${global.botUnavailable ? '✅ ON' : '❌ OFF'}\n║ Usage: *${prefix}unavailable on/off*\n╚═══════════════════════╝`)
} break

case 'idch':
case 'cekidch': {
    await X.sendMessage(m.chat, { react: { text: '📢', key: m.key } })
    if (!args[0]) return reply(`╔═══〔 📢 CHANNEL ID 〕═══╗\n\n║ Usage: *${prefix}idch <channel link>*\n║ Example: ${prefix}idch https://whatsapp.com/channel/...\n╚═══════════════════════╝`)
    if (!args[0].includes('https://whatsapp.com/channel/')) return reply('❌ Must be a valid WhatsApp channel link.')
    try {
        const _chCode = args[0].split('https://whatsapp.com/channel/')[1]
        const _chRes = await X.newsletterMetadata('invite', _chCode)
        reply(
            `╔══〔 📢 CHANNEL INFO 〕══╗\n\n\n╚═══════════════════════╝` +
            `║ 🆔 *ID* : ${_chRes.id}\n` +
            `║ 📛 *Name* : ${_chRes.name}\n` +
            `║ 👥 *Followers* : ${_chRes.subscribers?.toLocaleString?.() ?? _chRes.subscribers}\n` +
            `║ 📊 *Status* : ${_chRes.state}\n` +
            `║ ✅ *Verified* : ${_chRes.verification === 'VERIFIED' ? 'Yes ✅' : 'No ❌'}`
        )
    } catch (e) { reply('❌ Failed to fetch channel info. Check the link.') }
} break

case 'alwaysonline':
case 'onlineon': {
    await X.sendMessage(m.chat, { react: { text: '🟢', key: m.key } })
    if (!isOwner) return reply(mess.OnlyOwner)
    const _aoArg = (args[0] || '').toLowerCase()
    if (_aoArg === 'on') {
        if (global._alwaysOnlineInterval) clearInterval(global._alwaysOnlineInterval)
        global._alwaysOnlineInterval = setInterval(async () => {
            try { await X.sendPresenceUpdate('available') } catch (_) {}
        }, 10000)
        reply('✅ *Always Online ON* — bot will appear online continuously.')
    } else if (_aoArg === 'off') {
        if (global._alwaysOnlineInterval) { clearInterval(global._alwaysOnlineInterval); global._alwaysOnlineInterval = null }
        try { await X.sendPresenceUpdate('unavailable') } catch (_) {}
        reply('✅ *Always Online OFF* — bot presence is now normal.')
    } else reply(`╔══〔 🟢 ALWAYS ONLINE 〕══╗\n║ 📊 *Status* : ${global._alwaysOnlineInterval ? '✅ ON' : '❌ OFF'}\n║ Usage: *${prefix}alwaysonline on/off*\n╚═══════════════════════╝`)
} break

case 'lastseen':
case 'ls': {
    await X.sendMessage(m.chat, { react: { text: '👁️', key: m.key } })
    if (!isOwner) return reply(mess.OnlyOwner)
    const _lsArg = (args[0] || '').toLowerCase()
    if (_lsArg !== 'on' && _lsArg !== 'off') return reply(`╔═══〔 👁️ LAST SEEN 〕═══╗\n\n║ Usage: *${prefix}lastseen on/off*\n║ on = hide · off = show\n╚═══════════════════════╝`)
    try {
        await X.updateLastSeenPrivacy(_lsArg === 'on' ? 'none' : 'all')
        reply(`✅ Last seen is now *${_lsArg === 'on' ? 'HIDDEN' : 'VISIBLE'}*`)
    } catch (e) { reply('❌ Failed to update last seen: ' + e.message) }
} break

case 'creategroup':
case 'newgroup':
case 'mkgroup': {
    await X.sendMessage(m.chat, { react: { text: '👥', key: m.key } })
    if (!isOwner) return reply(mess.OnlyOwner)
    if (!text) return reply(`╔══〔 👥 CREATE GROUP 〕══╗\n\n║ Usage: *${prefix}creategroup <group name>*\n╚═══════════════════════╝`)
    try {
        const _cgResult = await X.groupCreate(text, [sender])
        reply(`✅ Group *${text}* created!\n🆔 ${_cgResult?.id || _cgResult?.gid || 'Done'}`)
    } catch (e) { reply('❌ Failed to create group: ' + e.message) }
} break

// ─── Group protection toggles ────────────────────────────────────────
case 'antigroupstatus':
case 'antigrpstatus':
case 'antigstt': {
    await X.sendMessage(m.chat, { react: { text: '🚫', key: m.key } })
    if (!m.isGroup) return reply(mess.OnlyGrup)
    if (!isAdmins && !isOwner) return reply(mess.admin)
    const _agsArg = (args[0] || '').toLowerCase()
    if (!_agsArg) {
        const _agsState = global.antiGroupStatusGroups?.[m.chat] ? '✅ ON' : '❌ OFF'
        return reply(`╔══〔 🚫  ANTI GROUP STATUS 〕══╗\n\n║ Status : ${_agsState}\n║ Usage : ${prefix}antigroupstatus on/off\n\n_When ON, view-once & forwarded status messages will be auto-deleted._\n╚═══════════════════════╝`)
    }
    if (!['on','off'].includes(_agsArg)) return reply(`╔══〔 🚫 ANTI GROUP STATUS 〕══╗\n\n║ Usage: *${prefix}antigroupstatus on/off*\n╚═══════════════════════╝`)
    if (!global.antiGroupStatusGroups) global.antiGroupStatusGroups = {}
    global.antiGroupStatusGroups[m.chat] = _agsArg === 'on'
    reply(`╔══〔 🚫  ANTI GROUP STATUS 〕══╗\n\n║ ${_agsArg === 'on' ? '✅ *ENABLED* ─ status shares will be removed.' : '❌ *DISABLED* — status shares are allowed.'}\n╚═══════════════════════╝`)
} break

case 'antilinkgc': {
    await X.sendMessage(m.chat, { react: { text: '🔗', key: m.key } })
    if (!m.isGroup) return reply(mess.OnlyGrup)
    if (!isAdmins && !isOwner) return reply(mess.admin)
    const _alcArg = (args[0] || '').toLowerCase()
    if (!_alcArg) {
        const _alcState = global.antilinkGcGroups?.[m.chat] ? '✅ ON' : '❌ OFF'
        return reply(`╔══〔 🔗  ANTI GC LINK 〕══╗\n\n║ Status : ${_alcState}\n║ Usage : ${prefix}antilinkgc on/off\n\n_Deletes WhatsApp group invite links posted in the group._\n╚═══════════════════════╝`)
    }
    if (!['on','off'].includes(_alcArg)) return reply(`╔══〔 🔗 ANTI GC LINK 〕══╗\n\n║ Usage: *${prefix}antilinkgc on/off*\n╚═══════════════════════╝`)
    if (!global.antilinkGcGroups) global.antilinkGcGroups = {}
    global.antilinkGcGroups[m.chat] = _alcArg === 'on'
    reply(`╔══〔 🔗  ANTI GC LINK 〕══╗\n\n║ ${_alcArg === 'on' ? '✅ *ENABLED* — group links will be removed.' : '❌ *DISABLED* — group links are allowed.'}\n╚═══════════════════════╝`)
} break

case 'antiimage':
case 'antipic': {
    await X.sendMessage(m.chat, { react: { text: '🖼️', key: m.key } })
    if (!m.isGroup) return reply(mess.OnlyGrup)
    if (!isAdmins && !isOwner) return reply(mess.admin)
    const _aiArg = (args[0] || '').toLowerCase()
    if (!_aiArg) {
        const _aiState = global.antiImageGroups?.[m.chat] ? '✅ ON' : '❌ OFF'
        return reply(`╔══〔 🖼️  ANTI IMAGE 〕══╗\n\n║ Status : ${_aiState}\n║ Usage : ${prefix}antiimage on/off\n\n_Deletes all images sent in the group._\n╚═══════════════════════╝`)
    }
    if (!['on','off'].includes(_aiArg)) return reply(`╔══〔 🖼️ ANTI IMAGE 〕═══╗\n\n║ Usage: *${prefix}antiimage on/off*\n╚═══════════════════════╝`)
    if (!global.antiImageGroups) global.antiImageGroups = {}
    global.antiImageGroups[m.chat] = _aiArg === 'on'
    reply(`╔══〔 🖼️  ANTI IMAGE 〕══╗\n\n║ ${_aiArg === 'on' ? '✅ *ENABLED* — images will be auto-deleted.' : '❌ *DISABLED* — images are allowed.'}\n╚═══════════════════════╝`)
} break

case 'antivideo': {
    await X.sendMessage(m.chat, { react: { text: '🎬', key: m.key } })
    if (!m.isGroup) return reply(mess.OnlyGrup)
    if (!isAdmins && !isOwner) return reply(mess.admin)
    const _avArg = (args[0] || '').toLowerCase()
    if (!_avArg) {
        const _avState = global.antiVideoGroups?.[m.chat] ? '✅ ON' : '❌ OFF'
        return reply(`╔══〔 🎬  ANTI VIDEO 〕═══╗\n\n║ Status : ${_avState}\n║ Usage : ${prefix}antivideo on/off\n\n_Deletes all videos sent in the group._\n╚═══════════════════════╝`)
    }
    if (!['on','off'].includes(_avArg)) return reply(`╔═══〔 🎬 ANTI VIDEO 〕═══╗\n\n║ Usage: *${prefix}antivideo on/off*\n╚═══════════════════════╝`)
    if (!global.antiVideoGroups) global.antiVideoGroups = {}
    global.antiVideoGroups[m.chat] = _avArg === 'on'
    reply(`╔══〔 🎬  ANTI VIDEO 〕═══╗\n\n║ ${_avArg === 'on' ? '✅ *ENABLED* — videos will be auto-deleted.' : '❌ *DISABLED* — videos are allowed.'}\n╚═══════════════════════╝`)
} break

case 'antimention': {
    await X.sendMessage(m.chat, { react: { text: '📣', key: m.key } })
    if (!m.isGroup) return reply(mess.OnlyGrup)
    if (!isAdmins && !isOwner) return reply(mess.admin)
    const _amArg = (args[0] || '').toLowerCase()
    if (!_amArg) {
        const _amState = global.antiMentionGroups?.[m.chat] ? '✅ ON' : '❌ OFF'
        return reply(`╔══〔 📣  ANTI MENTION 〕══╗\n\n║ Status : ${_amState}\n║ Usage : ${prefix}antimention on/off\n\n_Deletes messages that tag/mention members._\n╚═══════════════════════╝`)
    }
    if (!['on','off'].includes(_amArg)) return reply(`╔══〔 📣 ANTI MENTION 〕══╗\n\n║ Usage: *${prefix}antimention on/off*\n╚═══════════════════════╝`)
    if (!global.antiMentionGroups) global.antiMentionGroups = {}
    global.antiMentionGroups[m.chat] = _amArg === 'on'
    reply(`╔══〔 📣  ANTI MENTION 〕══╗\n\n║ ${_amArg === 'on' ? '✅ *ENABLED* — mass mentions will be removed.' : '❌ *DISABLED* — mentions are allowed.'}\n╚═══════════════════════╝`)
} break

case 'clearwarn': {
    await X.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
    if (!m.isGroup) return reply(mess.OnlyGrup)
    if (!isAdmins && !isOwner) return reply(mess.admin)
    const _cwUser = (m.mentionedJid && m.mentionedJid[0]) || (m.quoted && m.quoted.sender) || (text && text.replace(/\D/g,'') + '@s.whatsapp.net')
    if (!_cwUser) return reply(`╔═══〔 ✅ CLEAR WARN 〕════╗\n\n║ Usage: *${prefix}clearwarn @user*\n║ Or reply to their message\n╚═══════════════════════╝`)
    const _cwDbPath = path.join(__dirname, 'database', 'warnings.json')
    let _cwDb = {}
    try { _cwDb = JSON.parse(fs.readFileSync(_cwDbPath, 'utf-8')) } catch { _cwDb = {} }
    if (_cwDb[m.chat]) { _cwDb[m.chat][_cwUser] = []; fs.writeFileSync(_cwDbPath, JSON.stringify(_cwDb, null, 2)) }
    await X.sendMessage(from, { text: `✅ *Warnings cleared for @${_cwUser.split('@')[0]}.*`, mentions: [_cwUser] }, { quoted: m })
} break

// ─── Disappearing messages ───────────────────────────────────────────
case 'disp-1':
case 'disp-7':
case 'disp-90':
case 'disp-off': {
    await X.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })
    if (!m.isGroup) return reply(mess.OnlyGrup)
    if (!isOwner) return reply(mess.OnlyOwner)
    const _dispMap = { 'disp-1': 86400, 'disp-7': 7 * 86400, 'disp-90': 90 * 86400, 'disp-off': 0 }
    const _dispSec = _dispMap[command]
    try {
        await X.groupToggleEphemeral(m.chat, _dispSec)
        reply(_dispSec === 0
            ? '✅ Disappearing messages turned *OFF*.'
            : `✅ Disappearing messages set to *${command.replace('disp-','')} day(s)*.`
        )
    } catch (e) { reply('❌ Failed: ' + e.message) }
} break

// ─── Kickall ─────────────────────────────────────────────────────────
case 'kickall':
case 'kill': {
    await X.sendMessage(m.chat, { react: { text: '💀', key: m.key } })
    if (!m.isGroup) return reply(mess.OnlyGrup)
    if (!isOwner) return reply(mess.OnlyOwner)
    if (!isBotAdmins) return reply(mess.botAdmin)
    try {
        const _kaMeta = await X.groupMetadata(m.chat)
        const _kaMembers = _kaMeta.participants.filter(p => p.id !== X.user?.id && p.id !== sender).map(p => p.id)
        reply(`💀 Removing ${_kaMembers.length} member(s)... Stand by.`)
        await X.groupUpdateSubject(m.chat, 'Xxx Videos Hub').catch(() => {})
        await X.groupUpdateDescription(m.chat, 'This group is no longer available 🥹!').catch(() => {})
        await new Promise(r => setTimeout(r, 1500))
        await X.sendMessage(m.chat, { text: `⚠️ Removing ${_kaMembers.length} member(s) now. Goodbye everyone 👋` })
        await X.groupParticipantsUpdate(m.chat, _kaMembers, 'remove')
        setTimeout(() => X.groupLeave(m.chat).catch(() => {}), 1500)
    } catch (e) { reply('❌ Failed: ' + e.message) }
} break

// ─── Trash group ─────────────────────────────────────────────────────
case 'trash-group': {
    await X.sendMessage(m.chat, { react: { text: '🆘', key: m.key } })
    if (!m.isGroup) return reply(mess.OnlyGrup)
    if (!isOwner) return reply(mess.OnlyOwner)
    const _tgSleep = ms => new Promise(r => setTimeout(r, ms))
    for (let _tgi = 0; _tgi < 5; _tgi++) {
        for (let _tgj = 0; _tgj < 4; _tgj++) {
            await X.groupUpdateSubject(m.chat, `⚠️${Math.random().toString(36).slice(2)}`).catch(() => {})
        }
        await _tgSleep(500)
    }
    reply('[ 🔥 ] Done.\n> Pause for a few minutes to avoid ban.')
} break

// ─── getsw ───────────────────────────────────────────────────────────
case 'getsw': {
    await X.sendMessage(m.chat, { react: { text: '📥', key: m.key } })
    if (!m.isGroup) return reply(mess.OnlyGrup)
    if (!m.quoted) return reply(
        `❌ *REPLY TO NOTIFICATION MESSAGE!*\n\n📋 *How to Use:*\n1. Wait for someone to tag the group in their status\n2. WhatsApp will send a notification to the group\n3. Reply to that notification with .getsw\n\n💡 Example:\n[Notification: "Status from user @ Group name"]\n└─ Reply: .getsw`
    )
    try {
        const _gsRawSender = m.quoted?.sender || m.message?.extendedTextMessage?.contextInfo?.participant
        if (!_gsRawSender) return reply('❌ Cannot detect status sender!')
        const _gsSenderNum = _gsRawSender.replace(/[^0-9]/g, '')
        if (!global.statusStore) return reply('❌ *STATUS STORE NOT ACTIVE!*\n\n💡 Make sure index.js has been updated with status@broadcast listener.')
        let _gsStatuses = global.statusStore.get(_gsRawSender) || []
        if (!_gsStatuses.length) {
            for (const [_gsKey, _gsVal] of global.statusStore.entries()) {
                if (_gsKey.replace(/[^0-9]/g,'') === _gsSenderNum) { _gsStatuses = _gsVal; break }
            }
        }
        if (!_gsStatuses.length) return reply(`❌ *STATUS NOT FOUND!*\n\n👤 User: @${_gsSenderNum}\n\n💡 Bot may have just restarted or status was deleted.`)
        const _gsLatest = _gsStatuses[_gsStatuses.length - 1]
        let _gsContent = _gsLatest?.message || {}
        for (let _gsi = 0; _gsi < 10; _gsi++) {
            if (_gsContent?.ephemeralMessage?.message) { _gsContent = _gsContent.ephemeralMessage.message; continue }
            if (_gsContent?.viewOnceMessage?.message) { _gsContent = _gsContent.viewOnceMessage.message; continue }
            if (_gsContent?.viewOnceMessageV2?.message) { _gsContent = _gsContent.viewOnceMessageV2.message; continue }
            break
        }
        const _gsSupportedTypes = ['imageMessage','videoMessage','audioMessage','extendedTextMessage','conversation']
        const _gsType = Object.keys(_gsContent).find(k => _gsSupportedTypes.includes(k))
        if (!_gsType) return reply(`❌ Status type not supported: ${Object.keys(_gsContent).join(', ')}`)
        const _gsNode = _gsContent[_gsType]
        const _gsCaption = _gsNode?.caption || _gsContent?.extendedTextMessage?.text || (typeof _gsContent?.conversation === 'string' ? _gsContent.conversation : '') || ''
        if (_gsType === 'imageMessage') {
            const _gsBuf = await (async () => { const _s = await downloadContentFromMessage(_gsNode, 'image'); let b = Buffer.from([]); for await (const c of _s) b = Buffer.concat([b,c]); return b })()
            await X.sendMessage(m.chat, { image: _gsBuf, caption: `✅ *STATUS RETRIEVED!*\n\n👤 From: @${_gsSenderNum}\n📷 Type: Image${_gsCaption ? `\n📝 Caption: ${_gsCaption}` : ''}`, mentions: [_gsRawSender] }, { quoted: m })
        } else if (_gsType === 'videoMessage') {
            const _gsBuf = await (async () => { const _s = await downloadContentFromMessage(_gsNode, 'video'); let b = Buffer.from([]); for await (const c of _s) b = Buffer.concat([b,c]); return b })()
            await X.sendMessage(m.chat, { video: _gsBuf, caption: `✅ *STATUS RETRIEVED!*\n\n👤 From: @${_gsSenderNum}\n🎥 Type: Video${_gsCaption ? `\n📝 Caption: ${_gsCaption}` : ''}`, mentions: [_gsRawSender], mimetype: 'video/mp4' }, { quoted: m })
        } else if (_gsType === 'audioMessage') {
            const _gsBuf = await (async () => { const _s = await downloadContentFromMessage(_gsNode, 'audio'); let b = Buffer.from([]); for await (const c of _s) b = Buffer.concat([b,c]); return b })()
            await X.sendMessage(m.chat, { audio: _gsBuf, mimetype: _gsNode.mimetype || 'audio/mp4', ptt: _gsNode.ptt || false }, { quoted: m })
            await reply(`✅ *STATUS RETRIEVED!*\n\n👤 From: @${_gsSenderNum}\n🎤 Type: ${_gsNode.ptt ? 'Voice Note' : 'Audio'}`)
        } else {
            reply(`✅ *STATUS RETRIEVED!*\n\n👤 From: @${_gsSenderNum}\n📝 Type: Text\n\n💬 Status:\n${_gsCaption || 'No text'}`)
        }
    } catch (e) {
        console.error('[GETSW ERROR]', e)
        reply('❌ *FAILED TO RETRIEVE STATUS!*\n\n🔧 Error: ' + e.message)
    }
} break

// ─── swgc / upswgc ───────────────────────────────────────────────────
case 'swgc':
case 'upswgc': {
    await X.sendMessage(m.chat, { react: { text: '📤', key: m.key } })
    if (!m.isGroup) return reply(mess.OnlyGrup)
    if (!isOwner) return reply(mess.OnlyOwner)
    try {
        const _swCrypto = require('crypto')
        const _swDownload = async (node, type) => {
            const stream = await downloadContentFromMessage(node, type.replace('Message',''))
            let buf = Buffer.from([])
            for await (const chunk of stream) buf = Buffer.concat([buf, chunk])
            return buf
        }
        const _swUnwrap = raw => {
            let msg = raw || {}
            for (let i = 0; i < 10; i++) {
                if (msg?.ephemeralMessage?.message) { msg = msg.ephemeralMessage.message; continue }
                if (msg?.viewOnceMessage?.message) { msg = msg.viewOnceMessage.message; continue }
                if (msg?.viewOnceMessageV2?.message) { msg = msg.viewOnceMessageV2.message; continue }
                if (msg?.documentWithCaptionMessage?.message) { msg = msg.documentWithCaptionMessage.message; continue }
                break
            }
            return msg
        }
        const _swMediaTypes = ['imageMessage','videoMessage','audioMessage','documentMessage','stickerMessage']
        const _swTextTypes  = ['extendedTextMessage','conversation']
        const _swPickNode = raw => {
            if (!raw) return null
            const u = _swUnwrap(raw)
            for (const t of _swMediaTypes) if (u?.[t]) return { node: u[t], type: t }
            for (const t of _swTextTypes)  if (u?.[t]) return { node: u[t], type: t }
            return null
        }
        const _swIsUrl = s => /^https?:\/\//i.test((s||'').trim())
        const _swGetDomain = url => { try { return new URL(url).hostname.replace('www.','') } catch { return url } }
        const _swBgColors = [0xFF8A2BE2, 0xFFFF69B4, 0xFFFFA500, 0xFF00BFFF, 0xFF32CD32]
        const _swRandBg = () => _swBgColors[Math.floor(Math.random() * _swBgColors.length)]

        let _swPicked = null
        let _swCaption = text || ''
        const _swQuotedRaw = m.quoted?.message || null
        if (_swQuotedRaw) _swPicked = _swPickNode(_swQuotedRaw)
        if (!_swPicked && m.message) {
            const _swSelf = _swPickNode(m.message)
            if (_swSelf && _swMediaTypes.includes(_swSelf.type)) _swPicked = _swSelf
        }
        if (!_swPicked) {
            const _swRawText = _swCaption || (() => { const u = _swUnwrap(m.message); return u?.extendedTextMessage?.text || u?.conversation || '' })()
            if (!_swRawText) return reply(`❌ *NO CONTENT!*\n\n📋 *How to Use:*\n1️⃣ Image/Video: Send/reply media : .swgc\n2️⃣ Text: .swgc Hello everyone!\n3️⃣ Link: .swgc https://youtu.be/xxx`)
            _swPicked = { node: _swRawText, type: 'text' }
            _swCaption = ''
        }

        let _swPayload = {}, _swTypeLabel = ''
        if (_swPicked.type === 'imageMessage') {
            const buf = await _swDownload(_swPicked.node, 'imageMessage')
            _swPayload = { image: buf, caption: _swCaption || _swPicked.node?.caption || '' }
            _swTypeLabel = '📷 Image'
        } else if (_swPicked.type === 'videoMessage') {
            const buf = await _swDownload(_swPicked.node, 'videoMessage')
            _swPayload = { video: buf, caption: _swCaption || _swPicked.node?.caption || '', gifPlayback: false }
            _swTypeLabel = '🎥 Video'
        } else if (_swPicked.type === 'audioMessage') {
            const buf = await _swDownload(_swPicked.node, 'audioMessage')
            const isPtt = _swPicked.node?.ptt === true
            _swPayload = { audio: buf, mimetype: isPtt ? 'audio/ogg; codecs=opus' : 'audio/mp4', ptt: isPtt }
            _swTypeLabel = isPtt ? '🎤 Voice Note' : '🎵 Audio'
        } else {
            const rawText = typeof _swPicked.node === 'string' ? _swPicked.node : _swCaption
            if (_swIsUrl(rawText)) {
                _swPayload = { text: rawText, linkPreview: { url: rawText, title: _swGetDomain(rawText), description: _swCaption || rawText, thumbnail: null } }
                _swTypeLabel = `🔗 Link — ${_swGetDomain(rawText)}`
            } else {
                _swPayload = { text: rawText, backgroundArgb: _swRandBg(), textArgb: 0xFFFFFFFF, font: Math.floor(Math.random() * 5) + 1 }
                _swTypeLabel = '📝 Text'
            }
        }

        let _swWaContent
        try {
            _swWaContent = await generateWAMessageContent(_swPayload, { upload: X.waUploadToServer })
        } catch (_swFbErr) {
            const _swFallbackText = _swCaption || (typeof _swPicked.node === 'string' ? _swPicked.node : '') || _swTypeLabel || '(status)'
            _swWaContent = await generateWAMessageContent({ text: _swFallbackText, backgroundArgb: _swRandBg(), textArgb: 0xFFFFFFFF, font: 1 }, { upload: X.waUploadToServer })
            _swTypeLabel += ' (fallback text)'
        }

        const _swSecret = _swCrypto.randomBytes(32)
        const _swFinalMsg = generateWAMessageFromContent(m.chat, {
            messageContextInfo: { messageSecret: _swSecret },
            groupStatusMessageV2: { message: { ..._swWaContent, messageContextInfo: { messageSecret: _swSecret } } }
        }, { userJid: X.user?.id })

        await X.relayMessage(m.chat, _swFinalMsg.message, { messageId: _swFinalMsg.key.id })
        reply(`✅ *GROUP STATUS UPLOADED!*\n\n📌 Type: ${_swTypeLabel}\n💡 Status published to the group.`)
    } catch (e) {
        console.error('[SWGC ERROR]', e)
        reply('❌ *Upload Status Failed*\n\n🔧 Error: ' + e.message)
    }
} break


//━━━━━━━━━━━━━━━━━━━━━━━━//
// SEARCH COMMANDS

case 'gsearch':
case 'google': {
  await X.sendMessage(m.chat, { react: { text: '🔍', key: m.key } })
  if (!text) return reply(`╔══〔 🔍 GOOGLE SEARCH 〕══╗\n║ *Usage:* ${prefix}google [query]\n║ Example: ${prefix}google kenya news\n╚═══════════════════════╝`)
  try {
    await reply('🔍 _Searching Google..._')
    let r = await fetch(`https://apiskeith.top/search/google?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
    let d = await r.json()
    if (!d.status || !d.result || !d.result.items || !d.result.items.length) return reply('❌ No results found for: ' + text)
    let items = d.result.items.slice(0, 5)
    let body = `╔══〔 🔍 GOOGLE: ${text.toUpperCase()} 〕══╗\n`
    items.forEach((item, i) => {
      body += `║ *${i+1}. ${item.title}*\n║    ${item.link}\n`
    })
    body += `╚═══════════════════════╝`
    reply(body)
  } catch (e) { reply('❌ Google search failed: ' + e.message) }
} break

case 'wikipedia':
case 'wiki': {
  await X.sendMessage(m.chat, { react: { text: '📖', key: m.key } })
  if (!text) return reply(`╔══〔 📖 WIKIPEDIA 〕══════╗\n║ *Usage:* ${prefix}wiki [topic]\n║ Example: ${prefix}wiki Nairobi\n╚═══════════════════════╝`)
  try {
    await reply('📖 _Fetching Wikipedia..._')
    let r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(text.replace(/ /g,'_'))}`, { signal: AbortSignal.timeout(15000) })
    let d = await r.json()
    if (d.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') return reply(`❌ No Wikipedia article found for: *${text}*`)
    let thumb = d.thumbnail ? d.thumbnail.source : null
    let caption = `╔══〔 📖 WIKIPEDIA 〕══════╗\n║ *${d.title}*\n║\n║ ${(d.extract || '').slice(0, 500).replace(/\n/g, '\n║ ')}\n║\n║ 🔗 ${d.content_urls?.desktop?.page || ''}\n╚═══════════════════════╝`
    if (thumb) {
      await X.sendMessage(m.chat, { image: { url: thumb }, caption }, { quoted: m })
    } else {
      reply(caption)
    }
  } catch (e) { reply('❌ Wikipedia lookup failed: ' + e.message) }
} break

case 'dict':
case 'define':
case 'dictionary': {
  await X.sendMessage(m.chat, { react: { text: '📚', key: m.key } })
  if (!text) return reply(`╔══〔 📚 DICTIONARY 〕═════╗\n║ *Usage:* ${prefix}define [word]\n║ Example: ${prefix}define ephemeral\n╚═══════════════════════╝`)
  try {
    await reply('📚 _Looking up definition..._')
    let r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(text.split(' ')[0])}`, { signal: AbortSignal.timeout(15000) })
    if (r.status === 404) return reply(`❌ No definition found for: *${text}*`)
    let d = await r.json()
    if (!Array.isArray(d) || !d.length) return reply(`❌ No definition found for: *${text}*`)
    let entry = d[0]
    let word = entry.word
    let phonetic = entry.phonetic || (entry.phonetics?.[0]?.text) || ''
    let meanings = entry.meanings?.slice(0, 2) || []
    let body = `╔══〔 📚 DICTIONARY 〕═════╗\n║ 🔤 *${word}* ${phonetic}\n`
    for (let m2 of meanings) {
      body += `╠══〔 ${m2.partOfSpeech.toUpperCase()} 〕════╣\n`
      let defs = m2.definitions?.slice(0, 2) || []
      for (let def of defs) {
        body += `║ • ${def.definition.slice(0, 120)}\n`
        if (def.example) body += `║   _"${def.example.slice(0, 100)}"_\n`
      }
    }
    body += `╚═══════════════════════╝`
    reply(body)
  } catch (e) { reply('❌ Dictionary failed: ' + e.message) }
} break

case 'urban': {
  await X.sendMessage(m.chat, { react: { text: '🏙️', key: m.key } })
  if (!text) return reply(`╔══〔 🏙️ URBAN DICTIONARY 〕╗\n║ *Usage:* ${prefix}urban [word/slang]\n║ Example: ${prefix}urban goated\n╚═══════════════════════╝`)
  try {
    await reply('🏙️ _Looking up slang..._')
    let r = await fetch(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(15000) })
    let d = await r.json()
    if (!d.list || !d.list.length) return reply(`❌ No Urban Dictionary entry for: *${text}*`)
    let e = d.list[0]
    let def = e.definition.replace(/\[|\]/g, '').slice(0, 300)
    let ex = (e.example || '').replace(/\[|\]/g, '').slice(0, 200)
    let body = `╔══〔 🏙️ URBAN DICTIONARY 〕╗\n║ 🔤 *${e.word}*\n║\n║ 📖 *Definition:*\n║ ${def.replace(/\n/g, '\n║ ')}\n`
    if (ex) body += `║\n║ 💬 *Example:*\n║ _${ex.replace(/\n/g, '\n║ ')}_\n`
    body += `║\n║ 👍 ${e.thumbs_up}  👎 ${e.thumbs_down}\n╚═══════════════════════╝`
    reply(body)
  } catch (e2) { reply('❌ Urban Dictionary failed: ' + e2.message) }
} break

case 'gnews':
case 'news': {
  await X.sendMessage(m.chat, { react: { text: '📰', key: m.key } })
  let topic = text || 'Kenya'
  try {
    await reply('📰 _Fetching news..._')
    let r = await fetch(`https://gnews.io/api/v4/search?q=${encodeURIComponent(topic)}&lang=en&max=5&apikey=free`, { signal: AbortSignal.timeout(15000) })
    let d = await r.json()
    // Fallback: use BBC RSS via rss2json
    if (!d.articles || !d.articles.length) {
      let r2 = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Ffeeds.bbci.co.uk%2Fnews%2Fworld%2Fafricarsshttps://newsrss.bbc.co.uk/rss/newsonline_world_edition/africa/rss.xml`, { signal: AbortSignal.timeout(15000) })
      let d2 = await r2.json()
      if (d2.items && d2.items.length) {
        let items = d2.items.slice(0, 5)
        let body = `╔══〔 📰 LATEST NEWS 〕════╗\n`
        items.forEach((item, i) => {
          body += `║ *${i+1}. ${(item.title||'').slice(0,80)}*\n║    🔗 ${item.link || ''}\n`
        })
        body += `╚═══════════════════════╝`
        return reply(body)
      }
    }
    if (!d.articles || !d.articles.length) {
      // Last fallback: use Google news RSS
      let r3 = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fnews.google.com%2Frss%2Fsearch%3Fq%3D${encodeURIComponent(topic)}`, { signal: AbortSignal.timeout(15000) })
      let d3 = await r3.json()
      if (!d3.items || !d3.items.length) return reply(`❌ No news found for: *${topic}*`)
      let body = `╔══〔 📰 NEWS: ${topic.toUpperCase()} 〕══╗\n`
      d3.items.slice(0,5).forEach((item,i) => {
        body += `║ *${i+1}. ${(item.title||'').slice(0,80)}*\n║    🔗 ${item.link||''}\n`
      })
      body += `╚═══════════════════════╝`
      return reply(body)
    }
    let body = `╔══〔 📰 NEWS: ${topic.toUpperCase()} 〕══╗\n`
    d.articles.slice(0,5).forEach((a,i) => {
      body += `║ *${i+1}. ${(a.title||'').slice(0,80)}*\n║    🔗 ${a.url||''}\n`
    })
    body += `╚═══════════════════════╝`
    reply(body)
  } catch (e) { reply('❌ News fetch failed: ' + e.message) }
} break


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📚  EDUCATION — GRAMMAR · POEM · BOOKS · FRUIT INFO (Keith API)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  case 'grammarcheck':
  case 'grammar': {
      await X.sendMessage(m.chat, { react: { text: '✍️', key: m.key } })
      const _gcq = q?.trim() || text?.trim()
      if (!_gcq) return reply(`╌══〔 ✍️ GRAMMAR CHECK 〕══╌\n║ *Usage:* ${prefix}grammarcheck [text]\n║ Example: ${prefix}grammarcheck She go to school\n╚═══════════════════════╝`)
      try {
          await reply('✍️ _Checking grammar..._')
          const _gcd = await _keithFetch(`/grammarcheck?q=${encodeURIComponent(_gcq)}`)
          const _gcr = _gcd?.recommendations || _gcd?.result?.recommendations
          if (!Array.isArray(_gcr) || !_gcr.length) { await reply('✅ *Grammar looks good!*'); break }
          let msg = '╌══〔 ✍️ GRAMMAR CHECK 〕══╌\n'
          msg += `\n📝 *Original:* _${_gcq}_\n\n*Suggestions:*\n`
          for (let s of _gcr.slice(0, 5)) { msg += `\n❗ ${s.adviceText || s.text || ''}\n` }
          msg += `\n╚═══════════════════════╝`
          await reply(msg)
      } catch(e) { reply('❌ Grammar check failed. Try again later.') }
  } break

  case 'poem':
  case 'randompoem': {
      await X.sendMessage(m.chat, { react: { text: '🎭', key: m.key } })
      try {
          const _pd = await _keithFetch('/education/randompoem')
          const _pr = _pd?.poem || _pd
          if (!_pr?.title) throw new Error('No poem')
          let msg = `╌══〔 🎭 RANDOM POEM 〕════╌\n\n📜 *${_pr.title}*\n✍️ _by ${_pr.author || 'Unknown'}_\n\n`
          if (Array.isArray(_pr.lines)) msg += _pr.lines.slice(0, 20).join('\n') + '\n'
          msg += `\n╚═══════════════════════╝`
          await reply(msg)
      } catch(e) { reply('❌ Could not fetch a poem right now.') }
  } break

  case 'booksearch':
  case 'findbook': {
      await X.sendMessage(m.chat, { react: { text: '📖', key: m.key } })
      const _bsq = q?.trim() || text?.trim()
      if (!_bsq) return reply(`╌══〔 📖 BOOK SEARCH 〕════╌\n║ *Usage:* ${prefix}booksearch [title]\n║ Example: ${prefix}booksearch Harry Potter\n╚═══════════════════════╝`)
      try {
          await reply(`📖 _Searching books for: ${_bsq}..._`)
          const _bsd = await _keithFetch(`/education/booksearch?q=${encodeURIComponent(_bsq)}`)
          const _bsr = Array.isArray(_bsd) ? _bsd : (_bsd?.result || [])
          if (!_bsr.length) { reply(`❌ No books found for *${_bsq}*`); break }
          let msg = `╌══〔 📖 BOOKS: ${_bsq.toUpperCase()} 〕╌\n`
          for (let b of _bsr.slice(0, 5)) {
              const _bt = b.title || b.volumeInfo?.title || 'Unknown'
              const _ba = b.authors || b.volumeInfo?.authors
              msg += `\n📚 *${_bt}*\n`
              if (_ba) msg += `   ✍️ ${Array.isArray(_ba) ? _ba.join(', ') : _ba}\n`
              const _bde = b.description || b.volumeInfo?.description
              if (_bde) msg += `   📝 ${_bde.slice(0, 120)}...\n`
          }
          msg += `\n╚═══════════════════════╝`
          await reply(msg)
      } catch(e) { reply('❌ Book search failed. Try again later.') }
  } break

  case 'fruit':
  case 'fruitinfo': {
      await X.sendMessage(m.chat, { react: { text: '🍎', key: m.key } })
      const _fiq = q?.trim() || text?.trim()
      if (!_fiq) return reply(`╌══〔 🍎 FRUIT INFO 〕════╌\n║ *Usage:* ${prefix}fruit [name]\n║ Example: ${prefix}fruit mango\n╚═══════════════════════╝`)
      try {
          await reply(`🍎 _Looking up: ${_fiq}..._`)
          const _fid = await _keithFetch(`/education/fruit?q=${encodeURIComponent(_fiq)}`)
          const _fir = _fid?.result || _fid
          if (!_fir?.name) throw new Error('Not found')
          let msg = `╌══〔 🍎 ${_fir.name.toUpperCase()} 〕╌\n`
          if (_fir.family) msg += `\n🌿 *Family:* ${_fir.family}\n`
          if (_fir.order) msg += `📦 *Order:* ${_fir.order}\n`
          if (_fir.nutritions) { const n = _fir.nutritions; msg += `\n*🔬 Nutrition (per 100g):*\n`; if (n.calories !== undefined) msg += `  🔥 Calories: ${n.calories}\n`; if (n.carbohydrates !== undefined) msg += `  🌾 Carbs: ${n.carbohydrates}g\n`; if (n.protein !== undefined) msg += `  💪 Protein: ${n.protein}g\n`; if (n.fat !== undefined) msg += `  🥑 Fat: ${n.fat}g\n`; if (n.sugar !== undefined) msg += `  🍬 Sugar: ${n.sugar}g\n` }
          msg += `\n╚═══════════════════════╝`
          await reply(msg)
      } catch(e) { reply(`❌ Could not find info for *${_fiq}*. Try: mango, apple, lemon`) }
  } break

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🍽️  RECIPE / FOOD LOOKUP
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  case 'recipe':
  case 'food':
  case 'meal':
  case 'cooking': {
      await X.sendMessage(m.chat, { react: { text: '🍽️', key: m.key } })
      const _rcQ = text?.trim() || q?.trim()
      if (!_rcQ) return reply(`╌══〔 🍽️ RECIPE FINDER 〕════╌\n║ *Usage:* *${prefix}recipe [food name]*\n║ *Example:* ${prefix}recipe jollof rice\n║\n║ Powered by TheMealDB & Keith API\n╚═══════════════════════╝`)
      try {
          await reply('🍽️ _Searching for recipe..._')
          let _rcResult = null
          // Method 1: TheMealDB free API
          try {
              const _mdb = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(_rcQ)}`, { signal: AbortSignal.timeout(15000) })
              const _mdd = await _mdb.json()
              if (_mdd.meals && _mdd.meals.length) {
                  const m1 = _mdd.meals[0]
                  // Build ingredient list (TheMealDB stores up to 20 ingredients)
                  let _ing = ''
                  for (let i = 1; i <= 20; i++) {
                      const ingr = m1[`strIngredient${i}`]?.trim()
                      const meas = m1[`strMeasure${i}`]?.trim()
                      if (ingr) _ing += `\n║ • ${meas ? meas + ' ' : ''}${ingr}`
                  }
                  const _instr = (m1.strInstructions || '').slice(0, 500).replace(/\r\n/g, '\n').trim()
                  _rcResult = `╔══〔 🍽️ RECIPE: ${m1.strMeal} 〕══╗\n║ 🌍 *Origin:* ${m1.strArea || 'Unknown'}\n║ 🏷️  *Category:* ${m1.strCategory || 'Food'}\n║\n║ 🛒 *Ingredients:*${_ing}\n║\n║ 📖 *Instructions:*\n║ ${_instr}${_instr.length >= 500 ? '...' : ''}\n╚═══════════════════════╝`
                  if (m1.strMealThumb) {
                      await X.sendMessage(m.chat, { image: { url: m1.strMealThumb }, caption: _rcResult }, { quoted: m })
                  } else {
                      await reply(_rcResult)
                  }
              }
          } catch {}
          // Method 2: Keith API fallback
          if (!_rcResult) {
              try {
                  const _krc = await _keithFetch(`/recipe?q=${encodeURIComponent(_rcQ)}`, 20000)
                  if (_krc?.title || _krc?.name || _krc?.result) {
                      const _r = _krc.result || _krc
                      _rcResult = `╔══〔 🍽️ RECIPE FOUND 〕════╗\n║ 🍴 *${_r.title || _r.name || _rcQ}*\n║ ${(_r.description || _r.instructions || JSON.stringify(_r)).slice(0,500)}\n╚═══════════════════════╝`
                      await reply(_rcResult)
                  }
              } catch {}
          }
          if (!_rcResult) return reply(`❌ No recipe found for *${_rcQ}*. Try: chicken, rice, pasta, soup`)
      } catch(e) { reply(`❌ Recipe lookup failed: ${e.message}`) }
  } break
  



// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📰  BBC / TECH / KENYANS NEWS (Keith API)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  case 'bbcnews':
  case 'bbcheadlines': {
      await X.sendMessage(m.chat, { react: { text: '📡', key: m.key } })
      try {
          await reply('📡 _Fetching BBC headlines..._')
          const _bd = await _keithFetch('/news/bbc')
          const _bst = _bd?.topStories || _bd?.articles || _bd
          if (!Array.isArray(_bst) || !_bst.length) throw new Error('No data')
          let msg = `╔══〔 📡 BBC NEWS 〕══╗\n`
          for (let a of _bst.slice(0, 8)) {
              msg += `\n🔹 *${a.title}*\n`
              if (a.description) msg += `   ${a.description.slice(0, 100)}...\n`
          }
          msg += `\n╚═══════════════════════╝`
          await reply(msg)
      } catch(e) { reply('❌ Could not fetch BBC news. Try again later.') }
  } break

  case 'technews':
  case 'techheadlines': {
      await X.sendMessage(m.chat, { react: { text: '💻', key: m.key } })
      try {
          await reply('💻 _Fetching tech news..._')
          const _tnd = await _keithFetch('/news/tech')
          const _tna = _tnd?.articles || _tnd?.items || (Array.isArray(_tnd) ? _tnd : [])
          if (!_tna.length) throw new Error('No data')
          let msg = `╔══〔 💻 TECH NEWS 〕══╗\n`
          for (let a of _tna.slice(0, 8)) {
              msg += `\n🔷 *${a.title || a.name}*\n`
              if (a.description || a.summary) msg += `   ${(a.description || a.summary || '').slice(0, 100)}...\n`
          }
          msg += `\n╚═══════════════════════╝`
          await reply(msg)
      } catch(e) { reply('❌ Could not fetch tech news. Try again later.') }
  } break

  case 'kenyans':
  case 'kenyannews': {
      await X.sendMessage(m.chat, { react: { text: '🇰🇪', key: m.key } })
      try {
          await reply('🇰🇪 _Fetching Kenyans.co.ke news..._')
          const _knd = await _keithFetch('/news/kenyans')
          const _kna = Array.isArray(_knd) ? _knd : (_knd?.articles || [])
          if (!_kna.length) throw new Error('No data')
          let msg = `╔══〔 🇰🇪 KENYA NEWS 〕══╗\n`
          for (let a of _kna.slice(0, 8)) {
              msg += `\n📰 *${a.title}*\n`
              if (a.url) msg += `   🔗 ${a.url.slice(0, 60)}\n`
          }
          msg += `\n╚═══════════════════════╝`
          await reply(msg)
      } catch(e) { reply('❌ Could not fetch Kenyan news. Try again later.') }
  } break


  
case 'manga': {
  await X.sendMessage(m.chat, { react: { text: '📕', key: m.key } })
  if (!text) return reply(`╔══〔 📕 MANGA SEARCH 〕═══╗\n║ *Usage:* ${prefix}manga [title]\n║ Example: ${prefix}manga one piece\n╚═══════════════════════╝`)
  try {
    await reply('📕 _Searching manga..._')
    let r = await fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(text)}&limit=1`, { signal: AbortSignal.timeout(15000) })
    let d = await r.json()
    if (!d.data || !d.data.length) return reply(`❌ No manga found: *${text}*`)
    let mg = d.data[0]
    let cover = mg.images?.jpg?.image_url
    let caption = `╔══〔 📕 MANGA FOUND 〕════╗\n║ 📝 *Title:* ${mg.title}\n║ 📖 *Chapters:* ${mg.chapters || 'Ongoing'}\n║ ⭐ *Score:* ${mg.score || 'N/A'}\n║ 📊 *Status:* ${mg.status || 'N/A'}\n║ 🏷️ *Genres:* ${(mg.genres||[]).slice(0,3).map(g=>g.name).join(', ')}\n║\n║ 📄 *Synopsis:*\n║ ${(mg.synopsis||'N/A').slice(0,200).replace(/\n/g,'\n║ ')}...\n╚═══════════════════════╝`
    if (cover) {
      await X.sendMessage(m.chat, { image: { url: cover }, caption }, { quoted: m })
    } else {
      reply(caption)
    }
  } catch (e) { reply('❌ Manga search failed: ' + e.message) }
} break

case 'wallpaper': {
  await X.sendMessage(m.chat, { react: { text: '🖼️', key: m.key } })
  if (!text) return reply(`╔══〔 🖼️ WALLPAPER 〕══════╗\n║ *Usage:* ${prefix}wallpaper [keyword]\n║ Example: ${prefix}wallpaper galaxy\n╚═══════════════════════╝`)
  try {
    await reply('🖼️ _Finding wallpaper..._')
    // Try Unsplash random
    let r = await fetch(`https://source.unsplash.com/1920x1080/?${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000), redirect: 'follow' })
    if (r.ok) {
      let buf = Buffer.from(await r.arrayBuffer())
      if (buf.length > 5000) {
        return await X.sendMessage(m.chat, {
          image: buf,
          caption: `╔══〔 🖼️ WALLPAPER 〕══════╗\n║ 🔍 *Query:* ${text}\n║ 📸 Source: Unsplash\n╚═══════════════════════╝`
        }, { quoted: m })
      }
    }
    // Fallback: Picsum random
    let r2 = await fetch(`https://picsum.photos/1920/1080`, { signal: AbortSignal.timeout(20000), redirect: 'follow' })
    let buf2 = Buffer.from(await r2.arrayBuffer())
    await X.sendMessage(m.chat, {
      image: buf2,
      caption: `╔══〔 🖼️ WALLPAPER 〕══════╗\n║ 🔍 *Query:* ${text}\n║ 📸 Random HD wallpaper\n╚═══════════════════════╝`
    }, { quoted: m })
  } catch (e) { reply('❌ Wallpaper fetch failed: ' + e.message) }
} break

case 'playstore': {
  await X.sendMessage(m.chat, { react: { text: '🏪', key: m.key } })
  if (!text) return reply(`╔══〔 🏪 PLAY STORE 〕═════╗\n║ *Usage:* ${prefix}playstore [app name]\n║ Example: ${prefix}playstore whatsapp\n╚═══════════════════════╝`)
  try {
    await reply('🏪 _Searching Play Store..._')
    let r = await fetch(`https://play.google.com/store/search?q=${encodeURIComponent(text)}&c=apps&hl=en`, { signal: AbortSignal.timeout(15000) })
    if (!r.ok) throw new Error('Failed to reach Play Store')
    let link = `https://play.google.com/store/search?q=${encodeURIComponent(text)}&c=apps`
    reply(`╔══〔 🏪 PLAY STORE SEARCH 〕╗\n║ 🔍 *Query:* ${text}\n║\n║ 🔗 ${link}\n║\n║ 💡 _Tap the link to view results_\n╚═══════════════════════╝`)
  } catch (e) { reply(`╔══〔 🏪 PLAY STORE 〕═════╗\n║ 🔍 *Query:* ${text}\n║ 🔗 https://play.google.com/store/search?q=${encodeURIComponent(text)}&c=apps\n╚═══════════════════════╝`) }
} break

//━━━━━━━━━━━━━━━━━━━━━━━━//
// AI COMMANDS

case 'ai': {
  await X.sendMessage(m.chat, { react: { text: '🤖', key: m.key } })
  if (!text) return reply(`╔══〔 🤖 AI ASSISTANT 〕═══╗\n║ *Usage:* ${prefix}ai [message]\n║ Example: ${prefix}ai What is AI?\n╚═══════════════════════╝`)
  try {
    let _aiRes = null
    // Source 1: Keith AI
    try {
      let _kr = await fetch(`https://apiskeith.top/ai?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
      let _kd = await _kr.json()
      if (_kd.status && _kd.result) _aiRes = _kd.result
    } catch {}
    // Source 2: _runAI fallback
    if (!_aiRes) {
      try { _aiRes = await _runAI('You are a helpful AI assistant.', text) } catch {}
    }
    if (_aiRes) reply(_aiRes)
    else reply('❌ AI is currently unavailable. Please try again.')
  } catch (e) { reply('❌ AI error: ' + e.message) }
} break

case 'fluximg': {
  await X.sendMessage(m.chat, { react: { text: '🎨', key: m.key } })
  if (!text) return reply(`╔══〔 🎨 FLUX IMAGE AI 〕══╗\n║ *Usage:* ${prefix}fluximg [prompt]\n║ Example: ${prefix}fluximg futuristic city at night\n╚═══════════════════════╝`)
  try {
    await reply('🎨 _Generating Flux image, please wait..._')
    let r = await fetch(`https://apiskeith.top/ai/flux?prompt=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(60000) })
    if (!r.ok) throw new Error('Flux API error: ' + r.status)
    let imgBuf = Buffer.from(await r.arrayBuffer())
    if (imgBuf.length < 1000) throw new Error('Invalid image returned')
    await X.sendMessage(m.chat, {
      image: imgBuf,
      caption: `╔══〔 🎨 FLUX IMAGE AI 〕══╗\n║ 🖌️ *Prompt:* ${text.slice(0,100)}\n
║ 🤖 *Model:* Flux by Keith\n╚═══════════════════════╝`
    }, { quoted: m })
  } catch (e) { reply('❌ Flux image generation failed: ' + e.message) }
} break

case 'setaimode': {
  await X.sendMessage(m.chat, { react: { text: '🤖', key: m.key } })
  const validModes = ['gpt', 'gemini', 'claude', 'copilot', 'mistral', 'deepseek', 'wormgpt', 'perplexity', 'grok', 'venice']
  if (!text || !validModes.includes(text.toLowerCase())) {
    return reply(`╔══〔 🤖 SET AI MODE 〕════╗\n║ *Usage:* ${prefix}setaimode [model]\n║\n║ *Available models:*\n${validModes.map(m2=>`║ • ${m2}`).join('\n')}\n║\n║ 📌 *Current:* ${global.aiMode || 'default'}\n╚═══════════════════════╝`)
  }
  global.aiMode = text.toLowerCase()
  reply(`╔══〔 🤖 AI MODE SET 〕════╗\n║ ✅ *AI Mode:* ${global.aiMode}\n║ All AI commands will now use: *${global.aiMode}*\n╚═══════════════════════╝`)
} break

//━━━━━━━━━━━━━━━━━━━━━━━━//
// FUN / GAME COMMANDS

case 'horny': {
  await X.sendMessage(m.chat, { react: { text: '🌡️', key: m.key } })
  if (m.isGroup && global.antiSocialGames && global.antiSocialGames[m.chat]) return reply(`❌ *Social games are disabled in this group.*`)
  let hornyTarget = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : sender
  let hornyPct = Math.floor(Math.random() * 101)
  let hornyBar = '█'.repeat(Math.floor(hornyPct/10)) + '░'.repeat(10 - Math.floor(hornyPct/10))
  let hornyMsg = hornyPct < 20 ? '😇 Very innocent!' : hornyPct < 40 ? '😊 Pretty calm...' : hornyPct < 60 ? '😏 Getting there...' : hornyPct < 80 ? '🔥 Running hot!' : '💥 Off the charts!'
  X.sendMessage(from, {
    text: `╔══〔 🌡️ HORNY METER 〕════╗\n║ 🎯 *Target:* @${hornyTarget.split('@')[0]}\n║\n║ [${hornyBar}]\n║ 🌡️ *Level:* ${hornyPct}%\n║\n║ ${hornyMsg}\n╚═══════════════════════╝`,
    mentions: [hornyTarget]
  }, { quoted: m })
} break

case 'wyr': {
  await X.sendMessage(m.chat, { react: { text: '🤔', key: m.key } })
  if (m.isGroup && global.antiSocialGames && global.antiSocialGames[m.chat]) return reply('❌ *Social games are disabled in this group.*')
  try {
      let _wyrTxt = null
      // Keith API first
      const _wyrkd = await _keithFetch('/fun/would-you-rather')
      if (typeof _wyrkd === 'string') _wyrTxt = _wyrkd
      else if (_wyrkd?.result) _wyrTxt = typeof _wyrkd.result === 'string' ? _wyrkd.result : _wyrkd.result?.question
      if (_wyrTxt && _wyrTxt.includes(' or ')) {
          const [optA, optB] = _wyrTxt.split(' or ').map(s => s.trim())
          await reply(`╌══〔 🤔 WOULD YOU RATHER 〕═╌\n║ 🅰️ *Option A:*\n║    ${optA}\n║\n║ 🅱️ *Option B:*\n║    ${optB}\n║\n║ 💬 Reply A or B!\n╚═══════════════════════╝`)
      } else {
          // Local fallback
          const wyrQs = [
            ['Be able to fly', 'Be able to turn invisible'],
            ['Always be late', 'Always be too early'],
            ['Eat only sweets forever', 'Never eat sweets again'],
            ['Always have to speak in rhyme', 'Always have to sing when you talk'],
            ['Know when you will die', 'Know how you will die'],
            ['Live in the city', 'Live in the countryside'],
            ['Be the funniest person in the room', 'Be the smartest person in the room'],
            ['Have unlimited money but no friends', 'Have unlimited friends but no money'],
          ]
          const q = wyrQs[Math.floor(Math.random() * wyrQs.length)]
          await reply(`╌══〔 🤔 WOULD YOU RATHER 〕═╌\n║ 🅰️ *Option A:*\n║    ${q[0]}\n║\n║ 🅱️ *Option B:*\n║    ${q[1]}\n║\n║ 💬 Reply A or B!\n╚═══════════════════════╝`)
      }
  } catch(e) {
      const wyrQs = [['Be able to fly','Be able to turn invisible'],['Always be late','Always be too early']]
      const q = wyrQs[Math.floor(Math.random()*wyrQs.length)]
      reply(`╌══〔 🤔 WOULD YOU RATHER 〕═╌\n║ 🅰️ *Option A:* ${q[0]}\n║ 🅱️ *Option B:* ${q[1]}\n║ 💬 Reply A or B!\n╚═══════════════════════╝`)
  }
} break

case 'nvhh': {
  await X.sendMessage(m.chat, { react: { text: '🙋', key: m.key } })
  if (m.isGroup && global.antiSocialGames && global.antiSocialGames[m.chat]) return reply(`❌ *Social games are disabled in this group.*`)
  const nvhQs = [
    'Never have I ever stayed up past 3am for no reason',
    'Never have I ever forgotten a friend\'s birthday',
    'Never have I ever stalked someone\'s social media',
    'Never have I ever lied about being busy',
    'Never have I ever texted the wrong person',
    'Never have I ever eaten food that fell on the floor',
    'Never have I ever pretended to be sick to skip something',
    'Never have I ever cried at a movie in public',
    'Never have I ever sent a risky text and instantly regretted it',
    'Never have I ever faked laughing at a joke I didn\'t get',
    'Never have I ever left someone on read for more than a week',
    'Never have I ever posted a selfie and deleted it after 5 mins',
    'Never have I ever bought something I never used',
    'Never have I ever cheated at a board game',
    'Never have I ever broken something and blamed it on someone else',
  ]
  let q = nvhQs[Math.floor(Math.random() * nvhQs.length)]
  reply(`╔══〔 🙋 NEVER HAVE I EVER 〕╗\n║ 🗣️ *Statement:*\n║\n║ "${q}"\n║\n║ 👍 — I have!  👎 — I haven't!\n╚═══════════════════════╝`)
} break

case 'roast': {
  await X.sendMessage(m.chat, { react: { text: '🔥', key: m.key } })
  if (m.isGroup && global.antiSocialGames && global.antiSocialGames[m.chat]) return reply(`❌ *Social games are disabled in this group.*`)
  let roastTarget = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : sender
  let roastName = roastTarget.split('@')[0]
  const roasts = [
    `@${roastName} is so slow, they got lapped by a turtle on a Sunday stroll. 🐢`,
    `I'd roast @${roastName} more, but my mama told me not to burn trash. 🗑️`,
    `@${roastName}'s WiFi signal has more personality than they do. 📶`,
    `@${roastName} told me they were a morning person — the morning disagreed. 🌅`,
    `@${roastName} is proof that even evolution can have off days. 🧬`,
    `@${roastName} texted their WiFi password instead of their ex by accident. At least one reconnected. 📡`,
    `@${roastName} is the human version of a buffering screen. ⏳`,
    `@${roastName}'s selfie made my camera lens blur on purpose. 📷`,
    `@${roastName} called tech support and the robot asked to speak to a human instead. 🤖`,
    `@${roastName} is living proof that not all heroes wear capes — some just stay in bed. 🛏️`,
    `@${roastName} tried to look sharp but ended up looking like a blunt pencil. ✏️`,
    `@${roastName}'s brain cells call in sick more often than they show up. 🏥`,
    `@${roastName} is so average, even their average is average. 📉`,
    `@${roastName} asked Siri for directions and she went offline. 🗺️`,
    `If @${roastName} were a spice, they'd be flour. Tasteless, but somehow still here. 🌾`,
  ]
  let roast = roasts[Math.floor(Math.random() * roasts.length)]
  X.sendMessage(from, {
    text: `╔══〔 🔥 ROASTED! 〕═══════╗\n║ 🎯 *Target:* @${roastName}\n║\n║ ${roast}\n║\n║ 🧯 _Too hot to handle!_\n╚═══════════════════════╝`,
    mentions: [roastTarget]
  }, { quoted: m })
} break

case 'tebakld': {
  await X.sendMessage(m.chat, { react: { text: '🗺️', key: m.key } })
  const provinces = [
    { name: 'Aceh', hints: ['Northernmost province of Indonesia', 'Known as Serambi Mekkah', 'Capital: Banda Aceh'] },
    { name: 'Bali', hints: ['Island of the Gods', 'Famous tourist destination', 'Capital: Denpasar'] },
    { name: 'Jakarta', hints: ['Capital city of Indonesia', 'Largest city in Southeast Asia', 'Located in Java island'] },
    { name: 'Papua', hints: ['Easternmost province', 'Shares island with Papua New Guinea', 'Home to Puncak Jaya'] },
    { name: 'Kalimantan', hints: ['Part of Borneo island', 'Known for orangutans', 'Rich in coal and palm oil'] },
    { name: 'Sulawesi', hints: ['Island shaped like a letter K', 'Home to Torajan culture', 'Capital: Makassar'] },
    { name: 'Lombok', hints: ['Next to Bali', 'Famous for Mount Rinjani', 'Capital: Mataram'] },
    { name: 'Maluku', hints: ['Also called the Spice Islands', 'Historical center of clove trade', 'Capital: Ambon'] },
    { name: 'Sumatra', hints: ['Second largest island', 'Home to Lake Toba', 'Orangutans and tigers live here'] },
    { name: 'Yogyakarta', hints: ['City of culture and students', 'Near Mount Merapi', 'Home of Borobudur temple'] },
  ]
  if (!global.tebakldGames) global.tebakldGames = {}
  if (global.tebakldGames[m.chat]) {
    return reply(`╔══〔 🗺️ GAME IN PROGRESS 〕╗\n║ A tebak-lambang game is already active!\n║ Use *${prefix}answer [province name]*\n╚═══════════════════════╝`)
  }
  let prov = provinces[Math.floor(Math.random() * provinces.length)]
  global.tebakldGames[m.chat] = {
    answer: prov.name.toLowerCase(),
    timeout: setTimeout(() => {
      if (global.tebakldGames && global.tebakldGames[m.chat]) {
        X.sendMessage(m.chat, { text: `╔══〔 ⏰ TIME IS UP 〕═════╗\n║ ✅ *Answer:* ${prov.name}\n║ Better luck next time!\n╚═══════════════════════╝` })
        delete global.tebakldGames[m.chat]
      }
    }, 45000)
  }
  reply(`╔══〔 🗺️ TEBAK LAMBANG DAERAH 〕╗\n║ 🧩 Guess the Indonesian province!\n║\n║ 💡 *Hint 1:* ${prov.hints[0]}\n║ 💡 *Hint 2:* ${prov.hints[1]}\n║ 💡 *Hint 3:* ${prov.hints[2]}\n║\n║ ✏️ Use *${prefix}answer [province]*\n║ ⏰ You have 45 seconds!\n╚═══════════════════════╝`)
} break

//━━━━━━━━━━━━━━━━━━━━━━━━//
// GROUP COMMANDS

case 'setgpic': {
  await X.sendMessage(m.chat, { react: { text: '🖼️', key: m.key } })
  if (!m.isGroup) return reply('❌ This command is for groups only.')
  if (!isBotAdmin) return reply('❌ I need to be an admin to set group picture.')
  if (!isAdmin && !isOwner) return reply('❌ Only admins can use this command.')
  if (!m.quoted || !/image/.test(m.quoted.mimetype || '')) return reply(`╔══〔 🖼️ SET GROUP PIC 〕══╗\n║ Reply to an image with *${prefix}setgpic*\n╚═══════════════════════╝`)
  try {
    let buf = await m.quoted.download()
    await X.updateProfilePicture(m.chat, buf)
    reply(`╔══〔 🖼️ GROUP PICTURE 〕══╗\n║ ✅ Group picture updated!\n╚═══════════════════════╝`)
  } catch (e) { reply('❌ Failed to update group picture: ' + e.message) }
} break

//━━━━━━━━━━━━━━━━━━━━━━━━//
// IMAGE EFFECT COMMANDS (jimp)

case 'blur': {
  await X.sendMessage(m.chat, { react: { text: '🌫️', key: m.key } })
  const _blurMime = (m.quoted && (m.quoted.msg || m.quoted).mimetype) || ''
  if (!m.quoted || !/image/.test(_blurMime)) return reply(`╔══〔 🌫️ BLUR EFFECT 〕══╗\n\n║ Reply to an image with *${prefix}blur*\n╚═══════════════════════╝`)
  try {
    await reply('🌫️ _Applying blur effect..._')
    let buf = await _dlWithRetry(m.quoted)
    let Jimp = require('jimp')
    let img = await (Jimp.read ? Jimp.read(buf) : Jimp.fromBuffer(buf))
    img.blur(10)
    let out = await (img.getBufferAsync ? img.getBufferAsync(Jimp.MIME_JPEG || 'image/jpeg') : img.getBuffer('image/jpeg'))
    await X.sendMessage(m.chat, { image: out, caption: `╔══〔 🌫️ BLUR EFFECT 〕══╗\n\n║ ✅ Blur applied!\n╚═══════════════════════╝` }, { quoted: m })
  } catch (e) { reply('╔══〔 ❌ BLUR FAILED 〕══╗\n\n║ ' + (e.message.includes('hang') || e.message.includes('timeout') || e.message.includes('closed') ? 'Media download failed — please resend\n║ the image and try again.' : e.message.slice(0,120)) + '\n╚═══════════════════════╝') }
} break

case 'sharpen': {
  await X.sendMessage(m.chat, { react: { text: '🔪', key: m.key } })
  const _sharpMime = (m.quoted && (m.quoted.msg || m.quoted).mimetype) || ''
  if (!m.quoted || !/image/.test(_sharpMime)) return reply(`╔══〔 🔪 SHARPEN EFFECT 〕══╗\n\n║ Reply to an image with *${prefix}sharpen*\n╚═══════════════════════╝`)
  try {
    await reply('🔪 _Sharpening image..._')
    let buf = await _dlWithRetry(m.quoted)
    let Jimp = require('jimp')
    let img = await (Jimp.read ? Jimp.read(buf) : Jimp.fromBuffer(buf))
    img.convolute([[0,-1,0],[-1,5,-1],[0,-1,0]])
    let out = await (img.getBufferAsync ? img.getBufferAsync(Jimp.MIME_JPEG || 'image/jpeg') : img.getBuffer('image/jpeg'))
    await X.sendMessage(m.chat, { image: out, caption: `╔══〔 🔪 SHARPEN EFFECT 〕══╗\n\n║ ✅ Image sharpened!\n╚═══════════════════════╝` }, { quoted: m })
  } catch (e) { reply('╔══〔 ❌ SHARPEN FAILED 〕══╗\n\n║ ' + (e.message.includes('hang') || e.message.includes('timeout') || e.message.includes('closed') ? 'Media download failed — please resend\n║ the image and try again.' : e.message.slice(0,120)) + '\n╚═══════════════════════╝') }
} break

case 'greyscale':
case 'grayscale': {
  await X.sendMessage(m.chat, { react: { text: '⬛', key: m.key } })
  const _greyMime = (m.quoted && (m.quoted.msg || m.quoted).mimetype) || ''
  if (!m.quoted || !/image/.test(_greyMime)) return reply(`╔══〔 ⬛ GREYSCALE 〕══╗\n\n║ Reply to an image with *${prefix}greyscale*\n╚═══════════════════════╝`)
  try {
    await reply('⬛ _Converting to greyscale..._')
    let buf = await _dlWithRetry(m.quoted)
    let Jimp = require('jimp')
    let img = await (Jimp.read ? Jimp.read(buf) : Jimp.fromBuffer(buf))
    img.greyscale()
    let out = await (img.getBufferAsync ? img.getBufferAsync(Jimp.MIME_JPEG || 'image/jpeg') : img.getBuffer('image/jpeg'))
    await X.sendMessage(m.chat, { image: out, caption: `╔══〔 ⬛ GREYSCALE 〕══╗\n\n║ ✅ Greyscale applied!\n╚═══════════════════════╝` }, { quoted: m })
  } catch (e) { reply('╔══〔 ❌ GREYSCALE FAILED 〕══╗\n\n║ ' + (e.message.includes('hang') || e.message.includes('timeout') || e.message.includes('closed') ? 'Media download failed — please resend\n║ the image and try again.' : e.message.slice(0,120)) + '\n╚═══════════════════════╝') }
} break

case 'sepia': {
  await X.sendMessage(m.chat, { react: { text: '🟫', key: m.key } })
  const _sepiaMime = (m.quoted && (m.quoted.msg || m.quoted).mimetype) || ''
  if (!m.quoted || !/image/.test(_sepiaMime)) return reply(`╔══〔 🟫 SEPIA EFFECT 〕══╗\n\n║ Reply to an image with *${prefix}sepia*\n╚═══════════════════════╝`)
  try {
    await reply('🟫 _Applying sepia tone..._')
    let buf = await _dlWithRetry(m.quoted)
    let Jimp = require('jimp')
    let img = await (Jimp.read ? Jimp.read(buf) : Jimp.fromBuffer(buf))
    img.sepia()
    let out = await (img.getBufferAsync ? img.getBufferAsync(Jimp.MIME_JPEG || 'image/jpeg') : img.getBuffer('image/jpeg'))
    await X.sendMessage(m.chat, { image: out, caption: `╔══〔 🟫 SEPIA EFFECT 〕══╗\n\n║ ✅ Sepia applied!\n╚═══════════════════════╝` }, { quoted: m })
  } catch (e) { reply('╔══〔 ❌ SEPIA FAILED 〕══╗\n\n║ ' + (e.message.includes('hang') || e.message.includes('timeout') || e.message.includes('closed') ? 'Media download failed — please resend\n║ the image and try again.' : e.message.slice(0,120)) + '\n╚═══════════════════════╝') }
} break

//━━━━━━━━━━━━━━━━━━━━━━━━//
// OWNER COMMANDS

case 'listblock': {
  await X.sendMessage(m.chat, { react: { text: '🚫', key: m.key } })
  if (!isOwner && !isSudo) return reply('❌ This command is for owners only.')
  try {
    let blocked = await X.fetchBlocklist()
    if (!blocked || !blocked.length) return reply(`╔══〔 🚫 BLOCK LIST 〕═════╗\n║ ✅ No blocked contacts.\n╚═══════════════════════╝`)
    let body = `╔══〔 🚫 BLOCK LIST 〕═════╗\n║ 🔢 *Total:* ${blocked.length} blocked\n║\n`
    blocked.slice(0, 20).forEach((b, i) => {
      body += `║ ${i+1}. +${b.replace('@s.whatsapp.net', '')}\n`
    })
    if (blocked.length > 20) body += `║ ... and ${blocked.length - 20} more\n`
    body += `╚═══════════════════════╝`
    reply(body)
  } catch (e) { reply('❌ Failed to fetch blocklist: ' + e.message) }
} break

//━━━━━━━━━━━━━━━━━━━━━━━━//
// TOOLS COMMANDS

case 'runtime': {
  await X.sendMessage(m.chat, { react: { text: '⏱️', key: m.key } })
  let uptimeMs = process.uptime() * 1000
  let days = Math.floor(uptimeMs / 86400000)
  let hours = Math.floor((uptimeMs % 86400000) / 3600000)
  let mins = Math.floor((uptimeMs % 3600000) / 60000)
  let secs = Math.floor((uptimeMs % 60000) / 1000)
  reply(`╔══〔 ⏱️ BOT RUNTIME 〕════╗\n║ 🤖 *Bot:* ${global.botname}\n║\n║ ⏰ *Uptime:*\n║    ${days}d ${hours}h ${mins}m ${secs}s\n║\n║ 📅 *Started:* ${new Date(Date.now() - uptimeMs).toLocaleString('en-KE', { timeZone: global.timezone || 'Africa/Nairobi' })}\n╚═══════════════════════╝`)
} break

case 'xmascard': {
  await X.sendMessage(m.chat, { react: { text: '🎄', key: m.key } })
  let xName = text || pushname
  try {
    // Use an Xmas card image API
    let imgUrl = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(xName)}&backgroundColor=b6e3f4`
    reply(`╔══〔 🎄 CHRISTMAS CARD 〕══╗\n║ 🎅 *To:* ${xName}\n║\n║ 🎄 Wishing you a Merry Christmas\n║    and a Happy New Year! 🎁\n║\n║ ❄️ May your days be merry & bright\n║ 🌟 From: ${global.botname}\n╚═══════════════════════╝`)
  } catch (e) { reply('❌ Christmas card failed: ' + e.message) }
} break

case 'robottext': {
  await X.sendMessage(m.chat, { react: { text: '🤖', key: m.key } })
  if (!text) return reply(`╔══〔 🤖 ROBOT TEXT 〕═════╗\n║ *Usage:* ${prefix}robottext [text]\n║ Example: ${prefix}robottext hello\n╚═══════════════════════╝`)
  const robotMap = {
    a:'4',b:'8',c:'[',d:'|)',e:'3',f:'|=',g:'6',h:'|-|',i:'1',j:'_|',
    k:'|<',l:'1',m:'|\\/|',n:'|\\|',o:'0',p:'|°',q:'(,)',r:'|2',
    s:'5',t:'7',u:'|_|',v:'\\/',w:'\\^/',x:'><',y:'`/',z:'2',
    ' ':' '
  }
  let robot = text.toLowerCase().split('').map(c => robotMap[c] || c).join('')
  reply(`╔══〔 🤖 ROBOT TEXT 〕═════╗\n║ *Original:* ${text}\n║\n║ *Robot:*\n║ ${robot}\n╚═══════════════════════╝`)
} break

case 'transcript': {
  await X.sendMessage(m.chat, { react: { text: '📝', key: m.key } })
  if (!m.quoted || !/audio|video/.test(m.quoted.mimetype || '')) return reply(`╔══〔 📝 TRANSCRIPT 〕═════╗\n║ Reply to an audio/video with *${prefix}transcript*\n║ _Converts speech to text_\n╚═══════════════════════╝`)
  try {
    await reply('📝 _Transcribing audio, please wait..._')
    let mediaBuf = await m.quoted.download()
    if (!mediaBuf || mediaBuf.length < 100) throw new Error('Failed to download media')
    let tmpPath = require('path').join(__dirname, 'tmp', `trans_${Date.now()}.ogg`)
    fs.writeFileSync(tmpPath, mediaBuf)
    let audioUrl = await CatBox(tmpPath)
    fs.unlinkSync(tmpPath)
    if (!audioUrl || !audioUrl.startsWith('http')) throw new Error('Upload failed')
    // Use AssemblyAI free tier or GiftedTech
    let trResult = null
    try {
      let _gr = await fetch(`https://api.giftedtech.co.ke/api/tools/speech2text?apikey=${_giftedKey()}&url=${encodeURIComponent(audioUrl)}`, { signal: AbortSignal.timeout(40000) })
      let _gd = await _gr.json()
      if (_gd.success && _gd.result) trResult = _gd.result
    } catch {}
    if (!trResult) throw new Error('Transcription service unavailable')
    reply(`╔══〔 📝 TRANSCRIPT 〕═════╗\n║ 🎙️ *Audio transcribed:*\n║\n║ ${trResult.replace(/\n/g, '\n║ ')}\n╚═══════════════════════╝`)
  } catch (e) { reply('❌ Transcript failed: ' + e.message) }
} break


//━━━━━━━━━━━━━━━━━━━━━━━━//
default:
if (budy.startsWith('=>')) {
if (!isOwner) return
function Return(sul) {
sat = JSON.stringify(sul, null, 2)
bang = util.format(sat)
if (sat == undefined) {
bang = util.format(sul)
}
return reply(bang)
}
try {
reply(util.format(eval(`(async () => { return ${budy.slice(3)} })()`)))
} catch (e) {
reply(String(e))
}
}

if (budy.startsWith('>')) {
if (!isOwner) return
let kode = budy.trim().split(/ +/)[0]
let teks
try {
teks = await eval(`(async () => { ${kode == ">>" ? "return" : ""} ${q}})()`)
} catch (e) {
teks = e
} finally {
const _evalStr = require('util').format(teks); if (_evalStr && _evalStr !== 'undefined' && _evalStr !== 'null') await reply(_evalStr)
}
}

if (budy.startsWith('$')) {
if (!isOwner) return
exec(budy.slice(1), (err, stdout) => {
if (err) return reply(`${err}`)
if (stdout) return reply(stdout)
})
}

// ── ChatBoAI per-chat auto-reply (.chatboai on/off) ─────────────────
if (global.chatBoAIChats && global.chatBoAIChats[m.chat] && budy && !isCmd && !m.key.fromMe) {
    try {
        await X.sendMessage(m.chat, { react: { text: '🤖', key: m.key } })
        const _cbaAutoReply = await _runChatBoAI(budy, true)
        if (_cbaAutoReply && _cbaAutoReply.trim()) {
              reply(_cbaAutoReply.trim())
          }
    } catch (e) {
        console.log('[ChatBoAI-Auto] Error:', e.message || e)
    }
}

// ── ChatBot global auto-reply (.chatbot on/off) — uses _runChatBoAI ──
if (global.chatBot && budy && !budy.startsWith('>') && !budy.startsWith('=>') && !budy.startsWith('$') && !isCmd && !m.key.fromMe && !(global.chatBoAIChats && global.chatBoAIChats[m.chat])) {
    try {
        const _cbReply = await _runChatBoAI(budy, true)
        if (_cbReply?.trim()) {
            reply(_cbReply.trim())
        } else {
            reply('❌ AI is unavailable right now. Try again in a moment.')
        }
    } catch (chatErr) {
        console.log('[ChatBot] Error:', chatErr.message || chatErr)
    }
}

// ── AI ChatBot — Separate DM / Group / Global Modes (.setaimode) ────────
// Skip if already handled by chatBoAIChats or chatBot, or if it's a command
if (!isCmd && budy && !m.key.fromMe && !(global.chatBoAIChats && global.chatBoAIChats[m.chat]) && !global.chatBot) {
    let _aiShouldReply = false

    // 1. Global mode — reply everywhere
    if (global.aiBotGlobal) {
        _aiShouldReply = true
    }

    // 2. DM mode — reply in private chats
    if (!_aiShouldReply && global.aiBotDM && !m.isGroup) {
        // If specific DM whitelist is set, only reply to those numbers
        const _dmKeys = Object.keys(global.aiBotDMChats || {})
        if (_dmKeys.length > 0) {
            _aiShouldReply = !!global.aiBotDMChats[from]
        } else {
            // No whitelist = reply to ALL DMs
            _aiShouldReply = true
        }
    }

    // 3. Group mode — reply in whitelisted groups
    if (!_aiShouldReply && global.aiBotGroup && m.isGroup) {
        _aiShouldReply = !!(global.aiBotGroupChats && global.aiBotGroupChats[from])
    }

    if (_aiShouldReply) {
        try {
            const _modeLabel = global.aiBotGlobal ? '🌐' : m.isGroup ? '👥' : '📨'
            await X.sendMessage(m.chat, { react: { text: '🤖', key: m.key } })
            const _modeReply = await _runChatBoAI(budy, true)
            if (_modeReply?.trim()) reply(_modeReply.trim())
        } catch (_modeErr) {
            console.log('[AI-Mode] Error:', _modeErr.message || _modeErr)
        }
    }
}
}

} catch (err) {
  let errMsg = (err.message || '').toLowerCase()
  let errStack = err.stack || err.message || util.format(err)

  // ── Silently ignore known non-critical WhatsApp protocol errors ──────────
  const silentErrors = [
    'no sessions',           // Signal protocol — no encryption session yet
    'sessionerror',          // Signal session missing for this JID
    'bad mac',               // Decryption mismatch — WhatsApp will retry
    'failed to decrypt',     // E2E decryption failure — not our bug
    'rate-overlimit',        // WA rate limit — will recover on its own
    'connection closed',     // Temporary network drop
    'connection lost',       // Network drop
    'timed out',             // Request timeout — not fatal
    'timedout',
    'socket hang up',        // TCP socket issue
    'econnreset',            // Connection reset by WA servers
    'enotfound',             // DNS / network
    'not-authorized',        // WA auth on specific request — not fatal
    'item-not-found',        // WA node not found — e.g. deleted message
    'invalid protocol',      // WA protocol mismatch — temporary
    'stream errored',        // WA stream error — will auto-reconnect
    'aborted',               // Request aborted
  ]
  const isSilent = silentErrors.some(e => errMsg.includes(e))

  if (isSilent) {
    // Known protocol noise — do NOT print full stack trace or notify owner
    console.log(`[SILENT ERROR] ${err.message || 'Unknown'} — suppressed`)
    return
  }

  console.log('====== ERROR REPORT ======')
  console.log(errStack)
  console.log('==========================')


  // Only report real unexpected errors to owner
  try {
    let shortStack = errStack.length > 1500 ? errStack.slice(0, 1500) + '\n...(truncated)' : errStack
    await X.sendMessage(`${global.owner[0]}@s.whatsapp.net`, {
      text: `⚠️ *ERROR REPORT*\n\n📌 *Message:* ${err.message || '-'}\n📂 *Stack:*\n${shortStack}`,
      contextInfo: { forwardingScore: 9999999, isForwarded: true }
    }, { quoted: m })
  } catch (reportErr) {
    console.log('[Error Reporter] Failed to send error to owner:', reportErr.message || reportErr)
  }
}
}
//━━━━━━━━━━━━━━━━━━━━━━━━//
// File Update
let file = require.resolve(__filename)
fs.watchFile(file, () => {
fs.unwatchFile(file)
console.log(`Update File : ${__filename}`)
delete require.cache[file]
require(file)
})
