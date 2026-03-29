//═════════════════════════════════//

/*
🔗 Juice v12 Bot System
by Juice v12 • 2024 - 2026

>> Contact Links:
・WhatsApp : wa.me/254753204154
・Telegram : t.me/jayariah77-code

⚠️ PROPRIETARY SOFTWARE - DO NOT MODIFY
Any unauthorized modification, redistribution,
or removal of credits is strictly prohibited.
*/

//═════════════════════════════════//
require('../setting')
const axios = require('axios');

module.exports = {
    type: 'ai',
    command: ['poliai', 'polination-ai'],
    operate: async (context) => {
        const { args, reply } = context;

  try {
    if (!args[0]) return reply(`╔══════════════════════════╗\n║   ⚡ *Juice v12*\n║   _WhatsApp Multi-Device Bot_\n╚══════════════════════════╝\n\n  🤖 *Pollinations AI*\n\n  └ Send a message to get a response!\n\n  _Example: .poliai What is AI?_\n\n┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n_⚡ Powered by Juice v12 — wa.me/254753204154_`)

    let { data } = await axios.post('https://text.pollinations.ai/openai', {
      messages: [
        { role: 'system', content: 'You are a helpful assistant for Juice v12 WhatsApp bot by Juice v12.' },
        { role: 'user', content: args.join(' ') }
      ],
      stream: false
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'user-agent': 'Mozilla/5.0 (Linux; Android 14; NX769J Build/UKQ1.230917.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.107 Mobile Safari/537.36'
      }
    })

    const result = data?.choices?.[0]?.message?.content
    if (!result) return reply(`❌ *No response from AI. Try again.*`)

    reply(`╔══════════════════════════╗\n║   ⚡ *Juice v12*\n║   _WhatsApp Multi-Device Bot_\n╚══════════════════════════╝\n\n  🤖 *Pollinations AI*\n\n${result}\n\n┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n_⚡ Powered by Juice v12 — wa.me/254753204154_`)

  } catch (e) {
    reply(`❌ *Error* — AI service unavailable. Please try again.\n\n_⚡ Juice v12 by Juice v12_`)
  }
 }
}
