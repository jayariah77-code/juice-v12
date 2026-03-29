
      // ── global on/off ──────────────────────────────────────────────────
      if (_arg === 'on' || _arg === 'enable') {
          _ad.gc.enabled = true; _ad.pm.enabled = true; _syncLegacy()
          return reply(`✅ *Anti-Delete ENABLED*\nGroups: ${_modeLabel(_ad.gc.mode)}\nPMs: ${_modeLabel(_ad.pm.mode)}`)
      }
      if (_arg === 'off' || _arg === 'disable') {
          _ad.gc.enabled = false; _ad.pm.enabled = false; _syncLegacy()
          return reply(`❌ *Anti-Delete DISABLED*\nNo messages will be tracked.`)
      }

      // ── global mode shortcuts ──────────────────────────────────────────
      if (['private','prvt','priv'].includes(_arg)) {
          _ad.gc.enabled = true; _ad.gc.mode = 'private'
          _ad.pm.enabled = true; _ad.pm.mode = 'private'; _syncLegacy()
          return reply(`╔══〔 🔒 ANTI DELETE 〕════╗\n║ 📨 *Mode* : PRIVATE\n║ All deleted messages → your DM\n╚═══════════════════════╝`)
      }
      if (['chat','cht'].includes(_arg)) {
          _ad.gc.enabled = true; _ad.gc.mode = 'chat'
          _ad.pm.enabled = true; _ad.pm.mode = 'chat'; _syncLegacy()
          return reply(`╔══〔 💬 ANTI DELETE 〕════╗\n║ 📨 *Mode* : CHAT\n║ All deleted messages → same chat\n╚═══════════════════════╝`)
      }
      if (['both','all'].includes(_arg)) {
          _ad.gc.enabled = true; _ad.gc.mode = 'both'
          _ad.pm.enabled = true; _ad.pm.mode = 'both'; _syncLegacy()
          return reply(`╔══〔 📢 ANTI DELETE 〕════╗\n║ 📨 *Mode* : BOTH\n║ All deleted messages → DM + chat\n╚═══════════════════════╝`)
      }

      // ── stats ──────────────────────────────────────────────────────────
      if (_arg === 'stats') {
          return reply(
              `╔══〔 📊 ANTI-DELETE STATS 〕══╗\n\n\n╚═══════════════════════╝` +
              `║ 👥 *Groups* : ${_ad.gc.enabled ? _modeLabel(_ad.gc.mode) : '❌ OFF'}\n` +
              `║ 💬 *PMs* : ${_ad.pm.enabled ? _modeLabel(_ad.pm.mode) : '❌ OFF'}\n` +
              `║ 📈 *Tracked* : ${_ad.stats.total}\n` +
              `║ ✅ *Retrieved* : ${_ad.stats.retrieved}\n` +
              `║ 🖼️  *Media* : ${_ad.stats.media}\n` +
              `║ 🗂️  *Cache* : ${global._adCache?.size || 0} entries`
          )
      }

      // ── clear ─────────────────────────────────────────────────────────
      if (_arg === 'clear' || _arg === 'clean') {
          const _sz = global._adCache?.size || 0
          global._adCache = new Map()
          global.adMediaCache = {}
          _ad.stats = { total: 0, retrieved: 0, media: 0 }
          return reply(`╔══〔 🧹 CACHE CLEARED 〕══╗\n║ 🗑️ *Removed* : ${_sz} entries\n║ 🛡️ *Anti-Delete* : ${global.antiDelete ? '✅ ON' : '❌ OFF'}\n╚═══════════════════════╝`)
      }

      reply(_statusMsg())
  }
  break


case 'antibot':
case 'setantibot': {
    await X.sendMessage(m.chat, { react: { text: '🤖', key: m.key } })
    if (!isAdmins && !isOwner) return reply(mess.admin)
    if (!m.isGroup) return reply(mess.OnlyGrup)

    // Init globals
    if (!global.antiBot) global.antiBot = false
    if (!global.antiBotGroups) global.antiBotGroups = {}
    if (!global.knownBots) global.knownBots = []

    // Known bot JID patterns — numbers that are commonly bots
    const _botPatterns = [
        /^0@/, /^1@/, /^status/,
    ]
    // Known bot pushname keywords
    const _botNameKeywords = ['bot', 'Bot', 'BOT', 'robot', 'Robot', 'assistant', 'Assistant', 'ai', 'AI']

    const _isBotNumber = (jid) => {
        const num = jid.split('@')[0]
        // Custom list
        if (global.knownBots.includes(num)) return true
        // Numbers ending in 0000, 1234, 9999 etc (common bot numbers)
        if (/0{4,}$/.test(num) || /1234$/.test(num) || /9{4,}$/.test(num)) return true
        return false
    }

    const _subArg = (args[0] || '').toLowerCase()
    const _subArg2 = args.slice(1).join(' ').trim()

    // ── status ────────────────────────────────────────────────────────
    if (!_subArg || _subArg === 'status') {
        const _grpEnabled = global.antiBotGroups[m.chat] ? '✅ ON' : '❌ OFF'
        const _botList = global.knownBots.length
            ? global.knownBots.map(n => `  • +${n}`).join('\n')
            : '  _None added yet_'
        return reply(`╔══〔 🤖 ANTIBOT SETTINGS 〕══╗\n\n║ 📊 *This group* : ${_grpEnabled}\n║ 🗂️  *Known bots* : ${global.knownBots.length}\n\n${_botList}\n\n║ ${prefix}antibot on     — enable here\n║ ${prefix}antibot off    — disable here\n║ ${prefix}antibot scan   — scan & remove bots\n║ ${prefix}antibot add [number] — mark as bot\n║ ${prefix}antibot list   — list known bots\n╚═══════════════════════╝`)
    }

    // ── on ───────────────────────────────────────────────────────────
    if (_subArg === 'on' || _subArg === 'enable') {
        global.antiBotGroups[m.chat] = true
        return reply(`╔════〔 🤖 ANTIBOT 〕═════╗\n\n║ ✅ *Enabled in this group*\n║ _Bots will be auto-removed when detected._\n╚═══════════════════════╝`)
    }

    // ── off ───────────────────────────────────────────────────────────
    if (_subArg === 'off' || _subArg === 'disable') {
        global.antiBotGroups[m.chat] = false
        return reply(`╔════〔 🤖 ANTIBOT 〕═════╗\n\n║ ❌ *Disabled in this group*\n╚═══════════════════════╝`)
    }

    // ── add ───────────────────────────────────────────────────────────
    if (_subArg === 'add') {
        const _addNum = _subArg2.replace(/[^0-9]/g, '')
        if (!_addNum) return reply(`❌ Provide a number. Example: ${prefix}antibot add 254712345678`)
        if (global.knownBots.includes(_addNum)) return reply(`⚠️ *+${_addNum}* is already in the bot list.`)
        global.knownBots.push(_addNum)
        return reply(`╔════〔 🤖 ANTIBOT 〕═════╗\n\n║ ✅ *+${_addNum}* added to known bots list.\n╚═══════════════════════╝`)
    }

    // ── remove ────────────────────────────────────────────────────────
    if (_subArg === 'remove' || _subArg === 'del') {
        const _remNum = _subArg2.replace(/[^0-9]/g, '')
        if (!_remNum) return reply(`❌ Provide a number. Example: ${prefix}antibot remove 254712345678`)
        global.knownBots = global.knownBots.filter(n => n !== _remNum)
        return reply(`✅ *+${_remNum}* removed from known bots list.`)
    }

    // ── list ──────────────────────────────────────────────────────────
    if (_subArg === 'list') {
        if (!global.knownBots.length) return reply(`╔═══〔 🤖 KNOWN BOTS 〕═══╗\n\n║ _No bots marked yet._\n║ Use ${prefix}antibot add [number]\n╚═══════════════════════╝`)
        const _list = global.knownBots.map((n, i) => `  ${i+1}. +${n}`).join('\n')
        return reply(`╔══〔 🤖 KNOWN BOTS LIST 〕══╗\n\n${_list}\n╚═══════════════════════╝`)
    }

    // ── scan ──────────────────────────────────────────────────────────
    if (_subArg === 'scan') {
        try {
            const _meta = await X.groupMetadata(m.chat)
            const _botIsAdmin = _meta.participants.some(p => {
                const isBot = p.id.split('@')[0] === X.user.id.split('@')[0]
                return isBot && (p.admin === 'admin' || p.admin === 'superadmin')
            })
            if (!_botIsAdmin) return reply(`❌ Bot must be *admin* to remove members.`)

            const _members = _meta.participants.filter(p => !p.id.endsWith('@lid'))
            let _botsFound = []

            for (const p of _members) {
                const _num = p.id.split('@')[0]
                const _isOwnerNum = global.owner.includes(_num)
                const _isBotSelf = _num === X.user.id.split('@')[0]
                if (_isOwnerNum || _isBotSelf) continue
                if (_isBotNumber(p.id)) _botsFound.push(p.id)
            }

            if (!_botsFound.length) {
                return reply(`╔══〔 🤖 ANTIBOT SCAN 〕══╗\n\n║ ✅ No bots detected in this group.\n║ _${_members.length} members scanned._\n╚═══════════════════════╝`)
            }

            // Remove detected bots
            let _removed = []
            for (const _botJid of _botsFound) {
                try {
                    await X.groupParticipantsUpdate(m.chat, [_botJid], 'remove')
                    _removed.push('+' + _botJid.split('@')[0])
                    await new Promise(r => setTimeout(r, 500))
                } catch {}
            }

            const _removedList = _removed.map(n => `  • ${n}`).join('\n')
            return reply(`╔══〔 🤖 ANTIBOT SCAN DONE 〕══╗\n\n║ 🔍 *Scanned* : ${_members.length} members\n║ 🚫 *Removed* : ${_removed.length} bot(s)\n\n${_removedList}\n╚═══════════════════════╝`)

        } catch(e) {
            return reply(`❌ Scan failed: ${e.message}`)
        }
    }
}
break

case 'botsettings':
case 'settings':
case 'botconfig': {
    await X.sendMessage(m.chat, { react: { text: '⚙️', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
const on = '✅ ON'
const off = '❌ OFF'
let settingsText = `╔══〔 ⚙️  BOT SETTINGS 〕══╗

║ 📛 *Name* : ${global.botname}
║ 🏷️  *Version* : v${global.botver}
║ 🔤 *Prefix* : ${global.botPrefix || 'Multi-prefix'}
║ 🌍 *Timezone* : ${global.botTimezone}
║ 🔒 *Mode* : ${X.public ? 'Public' : 'Private'}
║ 🔗 *URL* : ${global.botUrl || global.wagc}

║ 📦 *Pack* : ${global.packname}
║ ✍️  *Author* : ${global.author}


║ 🤖 *Auto Features*
║ 👁️  Auto Read : ${global.autoRead ? on : off}
║ 📝 Auto Bio : ${global.autoBio ? on : off}
║ 💬 ChatBot : ${global.chatBot ? on : off}
║ 👀 View Status : ${global.autoViewStatus ? on : off}
║ ❤️  Like Status : ${global.autoLikeStatus ? on : off} ${global.autoLikeEmoji ? '(' + global.autoLikeEmoji + ')' : ''}
║ 💌 Reply Status : ${global.autoReplyStatus ? on : off}
║ 📤 Fwd Status : ${global.statusToGroup ? on + ' → ' + global.statusToGroup.split('@')[0] : off}
║ 👻 Presence : ${global.fakePresence}

  🛡️  *Protection*
║ 📵 Anti-Call : ${global.antiCall ? on : off}
║ 🔗 Anti-Link : ${global.antiLink ? on : off}
║ 🗑️  Anti-Delete : ${global.antiDelete ? on : off}
║ 📢 Anti Status Mention : ${global.antiStatusMention ? on : off}

  👥 *Group*
║ 👋 Welcome : ${global.welcome ? on : off}
║ 📣 Admin Events : ${global.adminevent ? on : off}

  🛡️  *Per-Group Protections* _(current group)_
║ 🖼️  Anti Image : ${m.isGroup ? (global.antiImageGroups?.[m.chat] ? on : off) : '—'}
║ 🎬 Anti Video : ${m.isGroup ? (global.antiVideoGroups?.[m.chat] ? on : off) : '—'}
║ 📣 Anti Mention : ${m.isGroup ? (global.antiMentionGroups?.[m.chat] ? on : off) : '—'}
║ 🔗 Anti Link GC : ${m.isGroup ? (global.antilinkGcGroups?.[m.chat] ? on : off) : '—'}
║ 📢 Anti Status Msg : ${m.isGroup ? (global.antiGroupStatusGroups?.[m.chat] ? on : off) : '—'}

║ _⚡ Powered by ${global.ownername || 'Juice v12'}_
╚═══════════════════════╝`
reply(settingsText)
}
break

case 'restart':
case 'reboot': {
    await X.sendMessage(m.chat, { react: { text: '🔄', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
await reply(`╔══〔 🔄 RESTARTING 〕═════╗\n║ ⏳ Bot will be back shortly...\n║ _Powered by ${global.botname}_\n╚═══════════════════════╝`)
await sleep(2000)
process.exit(0)
} break

//━━━━━━━━━━━━━━━━━━━━━━━━//
// Update Command — fully functional with step-by-step feedback
case 'update': {
    await X.sendMessage(m.chat, { react: { text: '⬆️', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
const repoUrl = global.repoUrl || ''
if (!repoUrl) return reply(`❌ *No repo URL set!*\n\nAdd this to *setting.js*:\nglobal.repoUrl = "https://github.com/Juicev12/TOOSII-XD-ULTRA"`)

// Helper: run a shell command and return { ok, stdout, stderr }
const run = (cmd, cwd) => new Promise(resolve => {
    exec(cmd, { cwd: cwd || __dirname, timeout: 60000 }, (err, stdout, stderr) => {
        resolve({ ok: !err, stdout: (stdout || '').trim(), stderr: (stderr || '').trim(), err })
    })
})

await reply(`╔══〔 🔃 CHECKING FOR UPDATES 〕══╗

║ 📦 ${repoUrl}
╚═══════════════════════╝`)

try {
    // ── Step 1: Ensure git repo ───────────────────────────────────────
    const gitCheck = await run('git rev-parse --is-inside-work-tree')
    if (!gitCheck.ok) {
        await run('git init')
        await run(`git remote add origin ${repoUrl}`)
        const fetchInit = await run('git fetch origin')
        if (!fetchInit.ok) return reply(`❌ *Cannot reach GitHub.*\n_Check internet & repo visibility._`)
        let initBranch = 'main'
        const tryMain = await run('git reset --hard origin/main')
        if (!tryMain.ok) {
            const tryMaster = await run('git reset --hard origin/master')
            if (!tryMaster.ok) return reply(`❌ Could not find main or master branch.`)
            initBranch = 'master'
        }
        await run('npm install --production')
        await reply(`╔══〔 ✅ BOT INITIALIZED 〕══╗\n\n║ 🌿 *Branch* : ${initBranch}\n║ 🔄 Restarting now...\n╚═══════════════════════╝`)
        await new Promise(r => setTimeout(r, 2500))
        return _restartBot()
    }

    // ── Step 2: Point remote ──────────────────────────────────────────
    await run(`git remote set-url origin ${repoUrl} 2>/dev/null || git remote add origin ${repoUrl}`)

    // ── Step 3: Fetch ─────────────────────────────────────────────────
    const fetchResult = await run('git fetch origin')
    if (!fetchResult.ok) return reply(`❌ *Fetch failed.*\n_Check internet connection._`)

    // ── Step 4: Detect branch ─────────────────────────────────────────
    let branchRes = await run('git rev-parse --abbrev-ref HEAD')
    let branch = branchRes.stdout && branchRes.stdout !== 'HEAD' ? branchRes.stdout : 'main'
    const remoteBranchCheck = await run(`git ls-remote --heads origin ${branch}`)
    if (!remoteBranchCheck.stdout) branch = branch === 'main' ? 'master' : 'main'

    // ── Step 5: Compare commits ───────────────────────────────────────
    const localCommit  = await run('git rev-parse HEAD')
    const remoteCommit = await run(`git rev-parse origin/${branch}`)
    const localHash  = localCommit.stdout.slice(0, 7)

    if (localCommit.stdout && remoteCommit.stdout && localCommit.stdout === remoteCommit.stdout) {
        const lastLog = await run('git log -1 --format="%s | %cr" HEAD')
        return reply(`╔══〔 ✅ ALREADY UP TO DATE 〕══╗\n\n║ 🌿 *Branch* : ${branch}\n║ 🔖 *Commit* : ${localHash}\n║ 📝 ${(lastLog.stdout || 'N/A').slice(0,80)}\n╚═══════════════════════╝`)
    }

    // ── Step 6: Get changelog ─────────────────────────────────────────
    const changelog = await run(`git log HEAD..origin/${branch} --oneline --no-merges`)
    const changeLines = changelog.stdout ? changelog.stdout.split('\n').slice(0, 10).join('\n') : 'New changes available'
    const changeCount = changelog.stdout ? changelog.stdout.split('\n').filter(Boolean).length : '?'

    // ── Step 7: Pull ──────────────────────────────────────────────────
    await run('git stash')
    const pullResult = await run(`git pull origin ${branch} --force`)
    if (!pullResult.ok) {
        const resetResult = await run(`git reset --hard origin/${branch}`)
        if (!resetResult.ok) return reply(`❌ *Update failed.*\n${(pullResult.stderr || resetResult.stderr).slice(0, 300)}`)
    }

    // ── Step 8: Install deps ──────────────────────────────────────────
    await run('npm install --production')

    // ── Step 9: Done ──────────────────────────────────────────────────
    const newCommit = await run('git rev-parse HEAD')
    const newHash = newCommit.stdout.slice(0, 7)
    await reply(`╔══〔 ✅ BOT UPDATED 〕══╗

║ 🌿 *Branch*   : ${branch}
║ 🔖 *Old*      : ${localHash}
║ 🆕 *New*      : ${newHash}
║ 📋 *Changes*  : ${changeCount} commit(s)
${changeLines ? changeLines.split('\n').slice(0,8).map(l => '║  • '+l.trim().slice(0,60)).join('\n') : ''}
║
║ 🔄 Restarting panel now...
╚═══════════════════════╝`)
    await new Promise(r => setTimeout(r, 2500))
    _restartBot()

} catch (e) {
    reply(`❌ *Update error:*\n${(e.message || e).slice(0, 300)}`)
}
} break

case 'addplugin': case 'addplug':{
if (!isOwner) return  reply(mess.OnlyOwner)
if (!q.includes("|")) return reply(`╔══〔 📋 USAGE 〕══════════╗\n║ *${prefix + command} name|category|content*\n╚═══════════════════════╝`)
const [
pluginName,
category, ...pluginContent
] = q.split("|")
const pluginDirPath = path.join(path.resolve(__dirname, './plugin', category))
const pluginFilePath = path.join(pluginDirPath, pluginName + ".js")
if (!q.includes("|") || pluginContent.length === 0 || fs.existsSync(pluginFilePath)) return
if (!fs.existsSync(pluginDirPath)) fs.mkdirSync(pluginDirPath, {
recursive: true
})
fs.writeFileSync(pluginFilePath, pluginContent.join('|'))
await reply(`✅ Plugin created at *${pluginFilePath}*`)
}
break
case 'cgplugin': case 'cgplug':{
if (!isOwner) return  reply(mess.OnlyOwner)
if (!q.includes("|")) return reply(`╔══〔 🔧 EDIT PLUGIN 〕════╗\n\n║ Usage: *${prefix}cgplugin [name]|[new content]*\n║ Example: ${prefix}cgplugin myplug|new content here\n╚═══════════════════════╝`)
let [mypler, ...rest] = q.split("|")
let mypenis = rest.join("|")
let pluginsDirect = path.resolve(__dirname, './plugin')
let plugins = loadPlugins(pluginsDirect)
for (const plugin of plugins) {
if (plugin.command.includes(mypler)) {
let filePath = plugin.filePath
fs.writeFileSync(filePath, mypenis)
await reply(`✅ Plugin replaced at *${filePath}*`)
return
}
}
await reply(`╔══〔 ❌ NOT FOUND 〕══════╗\n║ Plugin *${mypler}* not found.\n╚═══════════════════════╝`)
}
break
case 'rmplugin': case 'rmplug':{
if (!isOwner) return  reply(mess.OnlyOwner)
if (!q) return reply(`╔══〔 📋 USAGE 〕══════════╗\n║ *${prefix + command} nama plugin*\n╚═══════════════════════╝`)
let pluginsDirect = path.resolve(__dirname, './plugin')
let plugins = loadPlugins(pluginsDirect)
for (const plugin of plugins) {
if (plugin.command.includes(q)) {
let filePath = plugin.filePath
fs.unlinkSync(filePath)
await reply(`✅ Plugin removed: *${filePath}*`)
return
}
}
await reply(`╔══〔 ❌ NOT FOUND 〕══════╗\n║ Plugin *${q}* not found.\n╚═══════════════════════╝`)
}
break
case 'getplugin': case 'getplug':{
if (!isOwner) return  reply(mess.OnlyOwner)
if (!q) return reply(`╔══〔 📋 USAGE 〕══════════╗\n║ *${prefix + command} nama plugin*\n╚═══════════════════════╝`) 
let pluginsDirect = path.resolve(__dirname, './plugin')
let plugin = loadPlugins(pluginsDirect).find(p => p.command.includes(q))
if (!plugin) return reply(`Plugin with command '${q}' not found.`)
await X.sendMessage(m.chat, {
document: fs.readFileSync(plugin.filePath),
fileName: path.basename(plugin.filePath),
mimetype: '*/*'
}, {
quoted: m
})
await reply(`✅ Plugin *${q}* retrieved and submitted.`)
}
break

//━━━━━━━━━━━━━━━━━━━━━━━━//
// Group Features

            case 'welcome':
            case 'greet':
            case 'left':{
               if (!m.isGroup) return reply(mess.OnlyGrup)
               if (!isAdmins && !isOwner) return reply(mess.admin)
               let welArg = (args[0] || '').toLowerCase()
               if (!welArg) {
                  let welState = global.welcome ? '✅ ON' : '❌ OFF'
                  reply(`╔══〔 👋 WELCOME / GOODBYE 〕══╗\n\n║ 📊 *Status* : ${welState}\n║ Sends greetings when members join/leave\n\n║ ${prefix}welcome on  — Enable\n║ ${prefix}welcome off — Disable\n╚═══════════════════════╝`)
               } else if (welArg === 'on' || welArg === 'enable') {
                  global.welcome = true
                  reply(`╔══〔 👋 WELCOME / GOODBYE 〕══╗\n\n║ ✅ *Enabled in ${groupName || 'this group'}*\n║ _Bot will greet joins & announce leaves._\n╚═══════════════════════╝`)
               } else if (welArg === 'off' || welArg === 'disable') {
                  global.welcome = false
                  reply(`╔══〔 👋 WELCOME / GOODBYE 〕══╗\n\n║ ❌ *Disabled in ${groupName || 'this group'}*\n║ _Welcome and goodbye messages turned off._\n╚═══════════════════════╝`)
               }
            }
            break
            case 'events':
            case 'groupevent':
            case 'adminevent':{
               if (!m.isGroup) return reply(mess.OnlyGrup)
               if (!isAdmins && !isOwner) return reply(mess.admin)
               let evArg = (args[0] || '').toLowerCase()
               if (!evArg) {
                  let evState = global.adminevent ? '✅ ON' : '❌ OFF'
                  reply(`╔══〔 🌟 ADMIN EVENTS 〕══╗\n\n║ 📊 *Status* : ${evState}\n║ Announces admin promotions & demotions\n\n║ ${prefix}events on  — Enable\n║ ${prefix}events off — Disable\n╚═══════════════════════╝`)
               } else if (evArg === 'on' || evArg === 'enable') {
                  global.adminevent = true
                  reply(`╔══〔 🌟 ADMIN EVENTS 〕══╗\n\n║ ✅ *Enabled in ${groupName || 'this group'}*\n║ _Admin changes will be announced._\n╚═══════════════════════╝`)
               } else if (evArg === 'off' || evArg === 'disable') {
                  global.adminevent = false
                  reply(`╔══〔 🌟 ADMIN EVENTS 〕══╗\n\n║ ❌ *Disabled in ${groupName || 'this group'}*\n║ _Admin event notifications turned off._\n╚═══════════════════════╝`)
               }
            }
            break
            
            
                        case 'add': {
    await X.sendMessage(m.chat, { react: { text: '➕', key: m.key } })
                                if (!m.isGroup) return reply(mess.OnlyGrup);
                                if (!isAdmins && !isOwner) return reply(mess.admin);
                                if (!isBotAdmins) return reply(mess.botAdmin);
                                let addTarget = null;
                                if (m.mentionedJid && m.mentionedJid[0]) {
                                        addTarget = m.mentionedJid[0];
                                } else if (m.quoted) {
                                        if (m.quoted.sender) {
                                                addTarget = m.quoted.sender;
                                        } else {
                                                let vcardMatch = (m.quoted.text || JSON.stringify(m.quoted.message || '')).match(/waid=(\d+)|TEL[;:][^:]*:[\+]?(\d+)/);
                                                if (vcardMatch) addTarget = (vcardMatch[1] || vcardMatch[2]) + '@s.whatsapp.net';
                                        }
                                } else if (text) {
                                        addTarget = text.replace(/\D/g, '') + '@s.whatsapp.net';
                                }
                                if (!addTarget) return reply(`╔════〔 ➕ ADD USER 〕═════╗\n\n║ Usage: *${prefix + command} @user*\n║ Or type the number: ${prefix + command} 254xxxxxxxxx\n╚═══════════════════════╝`);
                                try {
                                        let res = await X.groupParticipantsUpdate(m.chat, [addTarget], 'add');
                                        for (let i of res) {
                                                if (i.status == 408) return reply('⏳ User recently left the group. Try again later.');
                                                if (i.status == 401) return reply('🚫 Bot is blocked by this user.');
                                                if (i.status == 409) return reply('ℹ️ User is already in the group.');
                                                if (i.status == 500) return reply('📛 Group is full.');
                                                if (i.status == 403) {
                                                        let addNum = addTarget.split('@')[0]
                                                        await X.sendMessage(m.chat, { 
                                                                text: `🔒 @${addNum} has a private account. Sending invite to their DM...`, 
                                                                mentions: [addTarget] 
                                                        }, { quoted: m });
                                                        try {
                                                                let invv = await X.groupInviteCode(m.chat);
                                                                await X.sendMessage(addTarget, { 
                                                                        text: `https://chat.whatsapp.com/${invv}\n\n📨 You've been invited to join this group by an admin.`, 
                                                                        detectLink: true 
                                                                }).catch(() => reply('❌ Failed to send invite to their DM.'));
                                                        } catch { reply('❌ Could not get group invite link.'); }
                                                } else {
                                                        let addNum = addTarget.split('@')[0];
                                                        X.sendMessage(from, { text: `✅ *@${addNum} has been added to the group.*`, mentions: [addTarget] }, { quoted: m });
                                                }
                                        }
                                } catch (e) {
                                        let errMsg = (e?.message || '').toLowerCase();
                                        if (errMsg.includes('not-authorized') || errMsg.includes('403')) {
                                                reply(mess.botAdmin);
                                        } else {
                                                reply('❌ Failed to add user: ' + (e.message || 'Unknown error'));
                                        }
                                }
                        }
                        break;

                        case 'kick':
                        case 'remove': {
    await X.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
                                if (!m.isGroup) return reply(mess.OnlyGrup);
                                if (!isOwner && !isAdmins) return reply(mess.admin);
                                if (!isBotAdmins) return reply(mess.botAdmin);
                                let kickTarget = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : text ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null;
                                if (!kickTarget) return reply(`╔═══〔 👢 KICK USER 〕════╗\n\n║ Usage: *${prefix + command} @user*\n║ Or reply to their message\n╚═══════════════════════╝`)
                                let kickNum = kickTarget.split('@')[0]
                                let isTargetOwner = owner.some(o => kickTarget.includes(o)) || (typeof X.areJidsSameUser === 'function' && owner.some(o => X.areJidsSameUser(kickTarget, o + '@s.whatsapp.net')))
                                if (isTargetOwner) return reply('🛡️ Cannot remove the bot owner.');
                                try {
                                        await X.groupParticipantsUpdate(m.chat, [kickTarget], 'remove');
                                        X.sendMessage(from, { text: `🚪 *@${kickNum} has been removed from the group.*`, mentions: [kickTarget] }, { quoted: m })
                                } catch (err) {
                                        let errMsg = (err?.message || '').toLowerCase();
                                        if (errMsg.includes('not-authorized') || errMsg.includes('403')) {
                                                reply(mess.botAdmin);
                                        } else {
                                                reply('❌ Failed to remove user: ' + (err.message || 'Unknown error'));
                                        }
                                }
                        }
                        break;

                        case 'del':
                        case 'delete': {
    await X.sendMessage(m.chat, { react: { text: '🗑️', key: m.key } })
                                if (!m.quoted) return reply(`╔════〔 🗑️ DELETE 〕═════╗\n\n║ Reply to any message with *${prefix + command}* to delete it\n╚═══════════════════════╝`);
                                let quotedKey = m.quoted.fakeObj ? { ...m.quoted.fakeObj.key } : { remoteJid: m.quoted.chat || m.chat, fromMe: m.quoted.fromMe || false, id: m.quoted.id }
                                if (m.isGroup && !quotedKey.participant) {
                                        quotedKey.participant = m.quoted.sender
                                }
                                if (m.isGroup && !quotedKey.fromMe && !isBotAdmins) return reply('⚠️ *Bot Not Admin* — Please promote me to group admin to delete messages.');
                                try {
                                        if (quotedKey.fromMe || isOwner || (m.isGroup && isAdmins)) {
                                                await X.sendMessage(m.chat, { delete: quotedKey });
                                        } else {
                                                reply('🚫 You can only delete bot messages or your own messages (admin required in groups).');
                                        }
                                } catch (err) {
                                        let errMsg = (err?.message || '').toLowerCase()
                                        if (errMsg.includes('not-authorized') || errMsg.includes('403')) reply('⚠️ *Bot Not Admin* — Please promote me to group admin to delete messages.')
                                        else reply('❌ Failed to delete message: ' + (err.message || 'Unknown error'));
                                }
                        }
                        break;

                        case 'warn': {
    await X.sendMessage(m.chat, { react: { text: '⚠️', key: m.key } })
                                if (!m.isGroup) return reply(mess.OnlyGrup);
                                if (!isOwner && !isAdmins) return reply(mess.admin);
                                if (!isBotAdmins) return reply(mess.botAdmin);
                                let warnUser = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : text ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null;
                                if (!warnUser) return reply(`╔═══〔 ⚠️ WARN USER 〕════╗\n\n║ Usage: *${prefix}warn @user [reason]*\n║ Or reply to a message\n╚═══════════════════════╝`);
                                let isWarnOwner = owner.some(o => warnUser.includes(o)) || (typeof X.areJidsSameUser === 'function' && owner.some(o => X.areJidsSameUser(warnUser, o + '@s.whatsapp.net')))
                                if (isWarnOwner) return reply('🛡️ Cannot warn the bot owner.');
                                let warnReason = args.slice(m.mentionedJid && m.mentionedJid[0] ? 1 : 0).join(' ') || 'No reason given';
                                let warnDbPath = path.join(__dirname, 'database', 'warnings.json');
                                let warnDb = {};
                                try { warnDb = JSON.parse(fs.readFileSync(warnDbPath, 'utf-8')); } catch { warnDb = {}; }
                                let groupWarn = warnDb[m.chat] || {};
                                let userWarns = groupWarn[warnUser] || [];
                                userWarns.push({ reason: warnReason, time: new Date().toISOString(), by: sender });
                                groupWarn[warnUser] = userWarns;
                                warnDb[m.chat] = groupWarn;
                                fs.writeFileSync(warnDbPath, JSON.stringify(warnDb, null, 2));
                                let warnCount = userWarns.length;
                                let maxWarns = 3;
                                let warnNum = warnUser.split('@')[0];
                                if (warnCount >= maxWarns) {
                                    try {
                                        await X.groupParticipantsUpdate(m.chat, [warnUser], 'remove');
                                        groupWarn[warnUser] = [];
                                        warnDb[m.chat] = groupWarn;
                                        fs.writeFileSync(warnDbPath, JSON.stringify(warnDb, null, 2));
                                        X.sendMessage(from, { text: `🚨 *@${warnNum} has reached ${maxWarns}/${maxWarns} warnings and has been removed!*\n\n📝 Reason: ${warnReason}`, mentions: [warnUser] }, { quoted: m });
                                    } catch(err) {
                                        let errMsg = (err?.message || '').toLowerCase();
                                        if (errMsg.includes('not-authorized') || errMsg.includes('403')) {
                                            reply(mess.botAdmin);
                                        } else { reply(mess.error); }
                                    }
                                } else {
                                    X.sendMessage(from, { text: `⚠️ *Warning ${warnCount}/${maxWarns} for @${warnNum}*\n📝 Reason: ${warnReason}\n\n_${maxWarns - warnCount} more warning(s) before removal._`, mentions: [warnUser] }, { quoted: m });
                                }
                        }
                        break;

                        case 'unwarn':
                        case 'resetwarn': {
    await X.sendMessage(m.chat, { react: { text: '🔄', key: m.key } })
                                if (!m.isGroup) return reply(mess.OnlyGrup);
                                if (!isOwner && !isAdmins) return reply(mess.admin);
                                let uwUser = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : text ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null;
                                if (!uwUser) return reply(`╔═══〔 ✅ UNWARN USER 〕═══╗\n\n║ Usage: *${prefix}unwarn @user*\n║ Or reply to a message\n╚═══════════════════════╝`);
                                let uwDbPath = path.join(__dirname, 'database', 'warnings.json');
                                let uwDb = {};
                                try { uwDb = JSON.parse(fs.readFileSync(uwDbPath, 'utf-8')); } catch { uwDb = {}; }
                                if (uwDb[m.chat] && uwDb[m.chat][uwUser]) {
                                    uwDb[m.chat][uwUser] = [];
                                    fs.writeFileSync(uwDbPath, JSON.stringify(uwDb, null, 2));
                                    let uwNum = uwUser.split('@')[0];
                                    X.sendMessage(from, { text: `✅ *Warnings cleared for @${uwNum}.*`, mentions: [uwUser] }, { quoted: m });
                                } else {
                                    reply('ℹ️ This user has no warnings.');
                                }
                        }
                        break;

                        case 'listwarn':
                        case 'warnlist':
                        case 'warnings': {
    await X.sendMessage(m.chat, { react: { text: '⚠️', key: m.key } })
                                if (!m.isGroup) return reply(mess.OnlyGrup);
                                if (!isOwner && !isAdmins) return reply(mess.admin);
                                let wlDbPath = path.join(__dirname, 'database', 'warnings.json');
                                let wlDb = {};
                                try { wlDb = JSON.parse(fs.readFileSync(wlDbPath, 'utf-8')); } catch { wlDb = {}; }
                                let groupWarns = wlDb[m.chat] || {};
                                let warnEntries = Object.entries(groupWarns).filter(([, w]) => w.length > 0);
                                if (warnEntries.length === 0) return reply('ℹ️ No warnings in this group.');
                                let warnListText = `╔══〔 ⚠️  GROUP WARNINGS 〕══╗\n\n\n╚═══════════════════════╝`;
                                let warnMentions = [];
                                for (let [jid, warns] of warnEntries) {
                                    let num = jid.split('@')[0];
                                    warnMentions.push(jid);
                                    warnListText += `│ 👤 @${num} — *${warns.length}/3*\n`;
                                    warns.forEach((w, i) => {
                                        warnListText += `│   ${i + 1}. ${w.reason} _(${new Date(w.time).toLocaleDateString()})_\n`;
                                    });
                                    warnListText += `│\n`;
                                }
                                warnListText += `╚═══════════════════════╝`
                                X.sendMessage(from, { text: warnListText, mentions: warnMentions }, { quoted: m });
                        }
                        break;

                        case 'promote': {
    await X.sendMessage(m.chat, { react: { text: '⬆️', key: m.key } })
                                if (!m.isGroup) return reply(mess.OnlyGrup)
                                if (!isOwner && !isAdmins) return reply(mess.admin)
                                if (!isBotAdmins) return reply(mess.botAdmin)
                                let promoteTarget = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : text ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null
                                if (!promoteTarget) return reply(`╔════〔 ⬆️ PROMOTE 〕═════╗\n\n║ Usage: *${prefix + command} @user*\n║ Or reply to their message\n╚═══════════════════════╝`)
                                try {
                                    await X.groupParticipantsUpdate(m.chat, [promoteTarget], 'promote')
                                    let promoteNum = promoteTarget.split('@')[0]
                                    X.sendMessage(from, { text: `⬆️ *@${promoteNum} has been promoted to admin!*`, mentions: [promoteTarget] }, { quoted: m })
                                } catch(err) {
                                    let errMsg = (err?.message || err || '').toString().toLowerCase()
                                    if (errMsg.includes('not-authorized') || errMsg.includes('403') || errMsg.includes('admin')) {
                                        reply(mess.botAdmin)
                                    } else {
                                        reply(mess.error)
                                    }
                                }
                        }
                        break

                        case 'demote': {
    await X.sendMessage(m.chat, { react: { text: '⬇️', key: m.key } })
                                if (!m.isGroup) return reply(mess.OnlyGrup)
                                if (!isOwner && !isAdmins) return reply(mess.admin)
                                if (!isBotAdmins) return reply(mess.botAdmin)
                                let demoteTarget = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : text ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null
                                if (!demoteTarget) return reply(`╔═════〔 ⬇️ DEMOTE 〕═════╗\n\n║ Usage: *${prefix + command} @user*\n║ Or reply to their message\n╚═══════════════════════╝`)
                                let demoteNum = demoteTarget.split('@')[0]
                                let isDemoteOwner = owner.some(o => demoteTarget.includes(o)) || (typeof X.areJidsSameUser === 'function' && owner.some(o => X.areJidsSameUser(demoteTarget, o + '@s.whatsapp.net')))
                                if (isDemoteOwner) return reply('🛡️ Cannot demote the bot owner.')
                                try {
                                    await X.groupParticipantsUpdate(m.chat, [demoteTarget], 'demote')
                                    X.sendMessage(from, { text: `⬇️ *@${demoteNum} has been demoted from admin.*`, mentions: [demoteTarget] }, { quoted: m })
                                } catch(err) {
                                    let errMsg = (err?.message || err || '').toString().toLowerCase()
                                    if (errMsg.includes('not-authorized') || errMsg.includes('403') || errMsg.includes('admin')) {
                                        reply(mess.botAdmin)
                                    } else {
                                        reply(mess.error)
                                    }
                                }
                        }
                        break

                        case 'revoke':{
                                if (!m.isGroup) return reply(mess.OnlyGrup);
                                if (!isAdmins && !isOwner) return reply(mess.admin);
                                if (!isBotAdmins) return reply(mess.botAdmin);
                                try {
                                    await X.groupRevokeInvite(m.chat)
                                    reply(`╔══〔 🚫 LINK REVOKED 〕══╗\n\n║ ✅ Invite link successfully revoked.\n║ _Use ${prefix}link to generate a new one._\n╚═══════════════════════╝`)
                                } catch(err) {
                                    let errMsg = (err?.message || '').toLowerCase()
                                    if (errMsg.includes('not-authorized') || errMsg.includes('403')) reply(mess.botAdmin)
                                    else reply(`❌ *Failed to revoke group link.*\n_${err.message || 'Unknown error'}_`)
                                }
                                }
                                break

                        case 'approve':
                        case 'acceptjoin': {
    await X.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
                                if (!m.isGroup) return reply(mess.OnlyGrup)
                                if (!isAdmins && !isOwner) return reply(mess.admin)
                                if (!isBotAdmins) return reply(mess.botAdmin)
                                try {
                                        let pending = await X.groupRequestParticipantsList(m.chat)
                                        if (!pending || pending.length === 0) return reply('ℹ️ No pending join requests.')
                                        if (text && text.toLowerCase() === 'all') {
                                                let jids = pending.map(p => p.jid)
                                                await X.groupRequestParticipantsUpdate(m.chat, jids, 'approve')
                                                reply(`✅ *Approved all ${jids.length} pending join request(s).*`)
                                        } else if (text) {
                                                let target = text.replace(/[^0-9]/g, '') + '@s.whatsapp.net'
                                                let found = pending.find(p => p.jid === target)
                                                if (!found) return reply(`❌ That number is not in the pending requests.\n\n📋 Pending: ${pending.map(p => p.jid.split('@')[0]).join(', ')}`)
                                                await X.groupRequestParticipantsUpdate(m.chat, [target], 'approve')
                                                reply(`✅ *Approved @${target.split('@')[0]}*`)
                                        } else {
                                                let list = pending.map((p, i) => `│ ${i + 1}. ${p.jid.split('@')[0]}`).join('\n')
                                                reply(`╔══〔 📋 PENDING REQUESTS 〕══╗\n\n║ *Total:* ${pending.length}\n\n${list}\n\n║ ${prefix}approve all / [number]\n║ ${prefix}reject all / [number]\n╚═══════════════════════╝`)
                                        }
                                } catch (err) {
                                        let errMsg = (err?.message || '').toLowerCase()
                                        if (errMsg.includes('not-authorized') || errMsg.includes('403')) reply(mess.botAdmin)
                                        else reply('❌ Failed: ' + (err.message || 'Unknown error'))
                                }
                        }
                        break

                        case 'reject':
                        case 'rejectjoin': {
    await X.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
                                if (!m.isGroup) return reply(mess.OnlyGrup)
                                if (!isAdmins && !isOwner) return reply(mess.admin)
                                if (!isBotAdmins) return reply(mess.botAdmin)
                                try {
                                        let pending = await X.groupRequestParticipantsList(m.chat)
                                        if (!pending || pending.length === 0) return reply('ℹ️ No pending join requests.')
                                        if (text && text.toLowerCase() === 'all') {
                                                let jids = pending.map(p => p.jid)
                                                await X.groupRequestParticipantsUpdate(m.chat, jids, 'reject')
                                                reply(`✅ *Rejected all ${jids.length} pending join request(s).*`)
                                        } else if (text) {
                                                let target = text.replace(/[^0-9]/g, '') + '@s.whatsapp.net'
                                                let found = pending.find(p => p.jid === target)
                                                if (!found) return reply(`❌ That number is not in the pending requests.`)
                                                await X.groupRequestParticipantsUpdate(m.chat, [target], 'reject')
                                                reply(`✅ *Rejected @${target.split('@')[0]}*`)
                                        } else {
                                                let list = pending.map((p, i) => `${i + 1}. ${p.jid.split('@')[0]}`).join('\n')
                                                reply(`╔══〔 📋 PENDING REQUESTS 〕╗\n║ *${pending.length} pending requests:*\n║
${list}\n║ ${prefix}reject all — reject all\n║ ${prefix}reject [n]  — reject specific\n╚═══════════════════════╝`)
                                        }
                                } catch (err) {
                                        let errMsg = (err?.message || '').toLowerCase()
                                        if (errMsg.includes('not-authorized') || errMsg.includes('403')) reply(mess.botAdmin)
                                        else reply('❌ Failed: ' + (err.message || 'Unknown error'))
                                }
                        }
                        break
                                
//━━━━━━━━━━━━━━━━━━━━━━━//                            
// search features
                        case 'wikimedia': {
    await X.sendMessage(m.chat, { react: { text: '📖', key: m.key } })
                                if (!text) return reply(`╔══〔 📋 USAGE 〕══════════╗\n║ *${prefix + command} Query*\n╚═══════════════════════╝`);
                                try {
                                        const results = await wikimedia(text);
                                        if (results.length === 0) return reply(`⚠️ No images found on Wikimedia for "${text}".`);
                                        let result = results.map(img => `🖼️ *${img.title || 'No Title'}*\n🔗 ${img.source}`).join('\n\n');
                                        reply(`╔═══〔 🌐 WIKIMEDIA 〕════╗\n\n║ 🔍 *${text}*\n\n${result}\n╚═══════════════════════╝`);
                                } catch (err) {
                                        console.error(err);
                                        reply(`❌ Error fetching images from Wikimedia. Please try again later.`);
                                }
                        }
                        break;

                        case 'mangainfo': {
    await X.sendMessage(m.chat, { react: { text: '📚', key: m.key } })
                                const mangaName = args.join(' ');
                                if (!mangaName) return reply(`╔══〔 📋 USAGE 〕══════════╗\n║ *${prefix + command} Anime*\n╚═══════════════════════╝`);
                                try {
                                        const mangaList = await komiku("manga", mangaName);
                                        if (mangaList.length === 0) {
                                                return reply('_[ Invalid ]_ Not Found !!');
                                        }
                                        let captionText = `📚 *Hasil Pencarian Manga - ${mangaName}* 📚\n\n`;
                                        mangaList.slice(0, 5).forEach((manga, index) => {
                                                captionText += `📖 *${index + 1}. ${manga.title}*\n`;
                                                captionText += `🗂️ *Genre*: ${manga.genre}\n`;
                                                captionText += `🔗 *Url*: ${manga.url}\n`;
                                                captionText += `📖 *Description*: ${manga.description}\n\n`;
                                        });
                                        await reply(captionText);
                                } catch (error) {
                                        console.error("Report Error :", error);
                                        reply(mess.error);
                                }
                                break;
                        }

                        case 'mangadetail': {
    await X.sendMessage(m.chat, { react: { text: '📚', key: m.key } })
                                const url = args[0];
                                if (!url) return reply(`╔══〔 📋 USAGE 〕══════════╗\n║ *${prefix + command} URL*\n╚═══════════════════════╝`);
                                try {
                                        const mangaDetail = await detail(url);
                                        let captionText = `📚 *Manga Details* 📚\n\n`;
                                        captionText += `📖 *Title*: ${mangaDetail.title}\n`;
                                        captionText += `🗂️ *Genre*: ${mangaDetail.genres.join(', ')}\n`;
                                        captionText += `📖 *Description*: ${mangaDetail.description}\n`;
                                        captionText += `📅 *First Chapter*: ${mangaDetail.awalChapter}\n`;
                                        captionText += `📅 *Latest Chapter*: ${mangaDetail.newChapter}\n`;
                                        X.sendMessage(m.chat, {
                                                image: { url: mangaDetail.coverImage },
                                                caption: captionText
                                        }, {
                                                quoted: m
                                        })
                                } catch (error) {
                                        console.error("Report Error :", error);
                                        reply(mess.error);
                                }
                                break;
                        }

                        case 'jkt48news': {
    await X.sendMessage(m.chat, { react: { text: '📰', key: m.key } })
                                const lang = args[0] || "id";
                                try {
                                        const news = await jktNews(lang);
                                        if (news.length === 0) {
                                                return reply('_[ Report ]_ No News Find');
                                        }
                                        let captionText = `🎤 *Latest JKT48 News* 🎤\n\n`;
                                        news.slice(0, 5).forEach((item, index) => {
                                                captionText += `📰 *${index + 1}. ${item.title}*\n`;
                                                captionText += `📅 *Date*: ${item.date}\n`;
                                                captionText += `🔗 *Link*: ${item.link}\n\n`;
                                        });
                                        await reply(captionText);
                                } catch (error) {
                                        console.error("Report Error :", error);
                                        reply(mess.error);
                                }
                                break;
                        }

                        case 'otakudesu':{
                                let data = await otakuDesu.ongoing();
                                let captionText = `「 *ANIME SCHEDULE* 」\n\n`
                                for (let i of data) {
                                        captionText += `*💬 Title*: ${i.title}\n`
                                        captionText += `*📺 Eps*: ${i.episode}\n`
                                        captionText += `*🔗 URL*: ${i.link}\n\n`
                                }
                                X.sendMessage(m.chat, {
                                        text: captionText,
                                        contextInfo: {
                                                mentionedJid: [m.sender],
                                                forwardingScore: 999999, 
                                                isForwarded: true, 
                                                forwardedNewsletterMessageInfo: {
                                                        newsletterName: newsletterName,
                                                        newsletterJid: idch,
                                                },
                                                externalAdReply: {
                                                        showAdAttribution: true,
                                                        title: 'Ini Update Anime Terbaru!',
                                                        mediaType: 1,
                                                        previewType: 1,
                                                        body: 'Halo 👋',
                                                        thumbnailUrl: thumb,
                                                        renderLargerThumbnail: false,
                                                        mediaUrl: wagc,
                                                        sourceUrl: wagc
                                                }
                                        }
                                }, {
                                        quoted: m
                                })
                        }
                        break;

                        case 'kusonimeinfo':
                        case 'animeinfo': {
    await X.sendMessage(m.chat, { react: { text: '🎌', key: m.key } })
                                try {
                                        const animeList = await Kusonime.info();
                                        if (animeList.length === 0) {
                                                return reply('╔══〔 🎌 ANIME INFO 〕═════╗\n\n║ ⚠️ No latest anime data found right now.\n╚═══════════════════════╝');
                                        }
                                        let captionText = `╔══〔 🎌 LATEST ANIME 〕═══╗\n\n`;
                                        animeList.slice(0, 5).forEach((anime, index) => {
                                                captionText += `📺 *${index + 1}. ${anime.title}*\n`;
                                                captionText += `🔗 *URL*: ${anime.url}\n`;
                                                captionText += `🗂️ *Genre*: ${anime.genres.join(', ')}\n`;
                                                captionText += `📅 *Rilis*: ${anime.releaseTime}\n\n`;
                                        });
                                        await reply(captionText);
                                } catch (error) {
                                        console.error("Report Error :", error);
                                        reply(mess.error);
                                };
                        }
                        break

                        case 'kusonimesearch':
                        case 'animesearch': {
    await X.sendMessage(m.chat, { react: { text: '🔍', key: m.key } })
                                if (!text) return reply(`╔══〔 📋 USAGE 〕══════════╗\n║ *${prefix + command} Anime*\n╚═══════════════════════╝`);
                                try {
                                        const searchResults = await Kusonime.search(text);
                                        if (typeof searchResults === 'string') {
                                                return reply(`⚠️ ${searchResults}`);
                                        }
                                        let captionText = `🔍 *Search Results for*: ${text}\n\n`;
                                        searchResults.slice(0, 5).forEach((anime, index) => {
                                                captionText += `📺 *${index + 1}. ${anime.title}*\n`;
                                                captionText += `🔗 *URL*: ${anime.url}\n`;
                                                captionText += `🗂️ *Genre*: ${anime.genres.join(', ')}\n`;
                                                captionText += `📅 *Rilis*: ${anime.releaseTime}\n\n`;
                                        });
                                        await reply(captionText);
                                } catch (error) {
                                        console.error("Report Error :", error);
                                        reply(mess.error);
                                }
                        }
                        break;

                        case 'infogempa':
                        case 'infobmkg':
                        case 'gempa':
                        case 'bmkg': {
    await X.sendMessage(m.chat, { react: { text: '🌤️', key: m.key } })
                                try {
                                        let result = await gempa();
                                        let gempaData = result.data;
                                        let captionText = `「 *EARTHQUAKE INFO* 」\n\n`;
                                        captionText += `*🌍 Source*: ${result.source}\n`;
                                        captionText += `*📊 Magnitude*: ${gempaData.magnitude.trim()}\n`;
                                        captionText += `*📏 Depth*: ${gempaData.kedalaman.trim()}\n`;
                                        captionText += `*🗺️ Latitude & Longitude*: ${gempaData.lintang_bujur.trim()}\n`;
                                        captionText += `*🕒 Time*: ${gempaData.waktu.trim()}\n`;
                                        captionText += `*📍 Region*: ${gempaData.wilayah.trim() || 'No data'}\n`;
                                        captionText += `*😱 Felt*: ${gempaData.dirasakan.trim() || 'No data'}\n\n`;
                                        captionText += `Stay alert and follow instructions from authorities!`;
                                        if (gempaData.imagemap) {
                                                X.sendMessage(m.chat, {
                                                        image: { url: gempaData.imagemap.startsWith('http') ? gempaData.imagemap : `https://www.bmkg.go.id${gempaData.imagemap}` },
                                                        caption: captionText,
                                                        contextInfo: {
                                                                mentionedJid: [m.sender],
                                                                forwardingScore: 999999, 
                                                                isForwarded: true, 
                                                                forwardedNewsletterMessageInfo: {
                                                                        newsletterName: saluranName,
                                                                        newsletterJid: saluran,
                                                                },
                                                                externalAdReply: {
                                                                        showAdAttribution: true,
                                                                        title: 'Latest Earthquake Information!',
                                                                        mediaType: 1,
                                                                        previewType: 1,
                                                                        body: 'Be careful',
                                                                        thumbnailUrl: imageUrl,
                                                                        renderLargerThumbnail: false,
                                                                        mediaUrl: 'https://www.bmkg.go.id',
                                                                        sourceUrl: 'https://www.bmkg.go.id'
                                                                }
                                                        }
                                                }, {
                                                        quoted: m
                                                });
                                        } else {
                                                X.sendMessage(m.chat, {
                                                        text: captionText,
                                                        contextInfo: {
                                                                mentionedJid: [m.sender],
                                                                forwardingScore: 999999, 
                                                                isForwarded: true, 
                                                                forwardedNewsletterMessageInfo: {
                                                                        newsletterName: saluranName,
                                                                        newsletterJid: saluran,
                                                                },
                                                                externalAdReply: {
                                                                        showAdAttribution: true,
                                                                        title: 'Latest Earthquake Information!',
                                                                        mediaType: 1,
                                                                        previewType: 1,
                                                                        body: 'Be careful',
                                                                        thumbnailUrl: imageUrl,
                                                                        renderLargerThumbnail: false,
                                                                        mediaUrl: 'https://www.bmkg.go.id',
                                                                        sourceUrl: 'https://www.bmkg.go.id'
                                                                }
                                                        }
                                                }, {
                                                        quoted: m
                                                });
                                        }
                                } catch (error) {
                                        console.error("Report Error :", error);
                                        X.sendMessage(m.chat, {
                                                text: mess.error
                                        }, {
                                                quoted: m
                                        });
                                }
                        }
                        break;


//━━━━━━━━━━━━━━━━━━━━━━━━//
// Tools Features

                        case 'myip':
                        case 'ipbot':
                                if (!isOwner) return reply(mess.OnlyOwner);
                                let http = require('http');
                                http.get({
                                        'host': 'api.ipify.org',
                                        'port': 80,
                                        'path': '/'
                                }, function(resp) {
                                        resp.on('data', function(ip) {
                                                reply("🔎 Oii, Public IP address: " + ip);
                                        })
                                });
                        break;

                        case "ipwhois": {
                                if (!text) return reply(`╔══〔 📋 USAGE 〕══════════╗\n║ *${prefix + command} 114.5.213.103*\n╚═══════════════════════╝`);
                                const ip = text.trim();
                                const apiUrl = `https://ipwho.is/${ip}`;
                                try {
                                        reply("🔍 Searching for information, please wait...");
                                        const data = await fetchJson(apiUrl);
                                        if (data.success) {
                                                const flagEmoji = data.flag?.emoji || "🏳️";
                                                let messageText = "📍 *IP Whois Information*\n";
                                                messageText += `🌐 *IP Address*: ${data.ip}\n`;
                                                messageText += `🗺️ *Type*: ${data.type}\n`;
                                                messageText += `🌍 *Continent*: ${data.continent} (${data.continent_code})\n`;
                                                messageText += `🇨🇺 *Country*: ${data.country} (${data.country_code}) ${flagEmoji}\n`;
                                                messageText += `🏙️ *City*: ${data.city}, ${data.region} (${data.region_code})\n`;
                                                messageText += `📞 *Calling Code*: +${data.calling_code}\n`;
                                                messageText += `📫 *Postal Code*: ${data.postal}\n`;
                                                messageText += `🏛️ *Capital*: ${data.capital}\n\n`;
                                                messageText += "📡 *Provider Information*\n";
                                                messageText += `🏢 *ISP*: ${data.connection?.isp || "Not available"}\n`;
                                                messageText += `🔗 *Domain*: ${data.connection?.domain || "Not available"}\n`;
                                                messageText += `🔢 *ASN*: ${data.connection?.asn || "Not available"}\n\n`;
                                                messageText += "🕰️ *Timezone*\n";
                                                messageText += `🕒 *ID*: ${data.timezone?.id || "Not available"}\n`;
                                                messageText += `🕒 *UTC*: ${data.timezone?.utc || "Not available"}\n`;
                                                messageText += `🕒 *Current Time*: ${data.timezone?.current_time || "Not available"}\n`;
                                                reply(messageText);
                                        } else {
                                                reply(`❌ Invalid IP Address or information not found.`);
                                        }
                                } catch (err) {
                                        console.error(err);
                                        reply("❌ An error occurred while fetching data. Please try again later.");
                                }
                        }
                        break;
 
case 'telestick': {
    await X.sendMessage(m.chat, { react: { text: '📲', key: m.key } })
  async function telestick(url) {
    let match = url.match(/https:\/\/t\.me\/addstickers\/([^\/\?#]+)/)
    if (!match) return reply(`╔══〔 📋 USAGE 〕══════════╗\n║ *${prefix + command} https://...*\n╚═══════════════════════╝`);
    let { data: a } = await axios.get(`https://api.telegram.org/bot${(process.env.TELEGRAM_BOT_TOKEN || '7935827856:AAGdbLXArulCigWyi6gqR07gi--ZPm7ewhc')}/getStickerSet?name=${match[1]}`)
    let stickers = await Promise.all(a.result.stickers.map(async v => {
      let { data: b } = await axios.get(`https://api.telegram.org/bot${(process.env.TELEGRAM_BOT_TOKEN || '7935827856:AAGdbLXArulCigWyi6gqR07gi--ZPm7ewhc')}/getFile?file_id=${v.file_id}`)
      return {
        emoji: v.emoji,
        is_animated: v.is_animated,
        image_url: `https://api.telegram.org/file/bot${(process.env.TELEGRAM_BOT_TOKEN || '7935827856:AAGdbLXArulCigWyi6gqR07gi--ZPm7ewhc')}/${b.result.file_path}`
      }
    }))
    return { name: a.result.name, title: a.result.title, sticker_type: a.result.sticker_type, stickers }
  }
 
  try {
    if (!args[0]) return reply('Enter the Telegram sticker URL')
    let res = await telestick(args[0])
    for (let v of res.stickers) {
      let { data } = await axios.get(v.image_url, { responseType: 'arraybuffer' })
      let sticker = new Sticker(data, { pack: res.title, author: 'MT-BOT', type: v.is_animated ? 'full' : 'default' })
      await X.sendMessage(m.chat, await sticker.toMessage(), { quoted: m })
    }
  } catch (e) {
    reply(e.message)
  }
}
break;

case 'stikerly': {
    await X.sendMessage(m.chat, { react: { text: '🎨', key: m.key } })
if (!text) return reply(`╔══〔 📋 USAGE 〕══════════╗\n║ *${prefix + command} anomali*\n╚═══════════════════════╝`)
try {
throw new Error('stikerly_offline')
} catch (e) {
if (e.message === 'stikerly_offline') {
    return reply('❌ *Stickerly service is currently offline.*\n_The sticker search API is unavailable. Please try again later._')
}
console.error(e)
reply('❌ Sticker search failed. Service may be unavailable.')
}
}
break

case 'stickercrop':
case 'scrop': {
  const _scIsImg = m.mtype === 'imageMessage'
  const _scIsQuote = m.quoted && (m.quoted.mtype === 'imageMessage' || m.quoted.mtype === 'stickerMessage')
  if (!_scIsImg && !_scIsQuote) return reply(`╔══〔 ✂️ SQUARE CROP 〕════╗\n\n║ Usage: *${prefix}scrop*\n║ Reply to an image to crop it\n║ into a square sticker.\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '✂️', key: m.key } })
    const _scQuoted = m.quoted ? m.quoted : m
    let _scBuf = await _scQuoted.download()
    const Jimp = require('jimp')
    let _scImg = await Jimp.read(_scBuf)
    let _scW = _scImg.getWidth(), _scH = _scImg.getHeight()
    let _scSize = Math.min(_scW, _scH)
    _scImg.crop(Math.floor((_scW - _scSize) / 2), Math.floor((_scH - _scSize) / 2), _scSize, _scSize)
    let _scOut = await _scImg.getBufferAsync(Jimp.MIME_JPEG)
    const { StickerTypes } = require('wa-sticker-formatter')
    let _scSticker = new Sticker(_scOut, { pack: global.packname || 'TOOSII-XD', author: global.authorname || 'Juice v12', type: StickerTypes.FULL, quality: 70 })
    await X.sendMessage(m.chat, { sticker: await _scSticker.toBuffer() }, { quoted: m })
  } catch (e) {
    console.error('[STICKERCROP ERROR]', e.message)
    reply('❌ Sticker crop failed: ' + e.message)
  }
}
break

case 'meme':
case 'smeme': {
  const _mmIsImg = m.mtype === 'imageMessage'
  const _mmIsQuote = m.quoted && (m.quoted.mtype === 'imageMessage' || m.quoted.mtype === 'stickerMessage')
  if (!_mmIsImg && !_mmIsQuote) return reply(`╔══〔 🎭 MEME MAKER 〕═════╗\n║ Reply to an image with:\n║ *${prefix}${command} top text | bottom text*\n║\n║ Or just bottom text:\n║ *${prefix}${command} bottom text only*\n╚═══════════════════════╝`)
  if (!text) return reply(`╔══〔 🎭 MEME MAKER 〕═════╗\n║ Reply to an image with:\n║ *${prefix}${command} top | bottom*\n║\n║ Example:\n║ *${prefix}meme Fixed a bug | 10 more appear*\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🎭', key: m.key } })
    const _mmQuoted = m.quoted ? m.quoted : m
    const _mmParts = text.split('|')
    const _mmTop = (_mmParts.length > 1 ? _mmParts[0].trim() : '').toUpperCase()
    const _mmBot = (_mmParts.length > 1 ? _mmParts[1] : _mmParts[0]).trim().toUpperCase()
    let _mmBuf = await _mmQuoted.download()
    const Jimp = require('jimp')
    let _mmImg = await Jimp.read(_mmBuf)
    const _mmW = _mmImg.getWidth(), _mmH = _mmImg.getHeight()
    const _mmFont = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE)
    const _mmShadow = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK)
    const _mmPad = 10
    const _mmMaxW = _mmW - (_mmPad * 2)
    const _mmFontH = 80
    const _mmTextTop = _mmPad
    const _mmTextBot = _mmH - _mmFontH - _mmPad
    const _mmOffsets = [[-2,0],[2,0],[0,-2],[0,2],[-2,-2],[2,-2],[-2,2],[2,2]]
    if (_mmTop) {
      for (const [ox, oy] of _mmOffsets) _mmImg.print(_mmShadow, _mmPad + ox, _mmTextTop + oy, { text: _mmTop, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, _mmMaxW)
      _mmImg.print(_mmFont, _mmPad, _mmTextTop, { text: _mmTop, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, _mmMaxW)
    }
    if (_mmBot) {
      for (const [ox, oy] of _mmOffsets) _mmImg.print(_mmShadow, _mmPad + ox, _mmTextBot + oy, { text: _mmBot, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, _mmMaxW)
      _mmImg.print(_mmFont, _mmPad, _mmTextBot, { text: _mmBot, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, _mmMaxW)
    }
    let _mmOut = await _mmImg.getBufferAsync(Jimp.MIME_JPEG)
    if (command === 'smeme') {
      const { StickerTypes } = require('wa-sticker-formatter')
      let _mmStick = new Sticker(_mmOut, { pack: global.packname || 'TOOSII-XD', author: global.authorname || 'Meme', type: StickerTypes.FULL, quality: 70 })
      await X.sendMessage(m.chat, { sticker: await _mmStick.toBuffer() }, { quoted: m })
    } else {
      await X.sendMessage(m.chat, { image: _mmOut, caption: '🎭 *Meme generated!*' }, { quoted: m })
    }
  } catch (e) {
    console.error('[MEME ERROR]', e.message)
    reply('❌ Meme generation failed: ' + e.message)
  }
}
break

//━━━━━━━━━━━━━━━━━━━━━━━━//
// Ai Features
case 'quantum':
case 'quantum-ai':{
  if (!text) return reply(`╔══〔 ⚛️ QUANTUM AI 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '⚛️', key: m.key } })
    const result = await _runAI('You are Quantum AI, an advanced AI with deep analytical and quantum-level thinking capabilities. Provide thorough, intelligent, well-structured responses.', text)
    reply(result)
  } catch (e) {
    console.error('[QUANTUM-AI ERROR]', e.message)
    reply('❌ quantum-ai is currently unavailable. Please try again.')
  }
}
break
case 'chatai':{
  if (!text) return reply(`╔══〔 🗨️ CHAT AI 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '💬', key: m.key } })
    const result = await _runAI('You are ChatAI, a friendly and conversational AI assistant. Keep responses clear, helpful and natural.', text)
    reply(result)
  } catch (e) {
    console.error('[CHATAI ERROR]', e.message)
    reply('❌ chatai is currently unavailable. Please try again.')
  }
}
break;
case 'veniceai':
case 'conciseai':{
  if (!text) return reply(`╔══〔 📌 CONCISE AI 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🧠', key: m.key } })
    const result = await _runAI('You are ConciseAI, an AI that gives short, sharp, well-structured answers. Be brief but complete.', text)
    reply(result)
  } catch (e) {
    console.error('[CONCISEAI ERROR]', e.message)
    reply('❌ conciseai is currently unavailable. Please try again.')
  }
}
break;
case 'claudeai':{
  if (!text) return reply(`╔══〔 💎 CLAUDE AI 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '💎', key: m.key } })
    let _kResultclaudeai = null
    try {
      let _kr = await fetch(`https://apiskeith.top/ai/claude?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
      let _kd = await _kr.json()
      if (_kd.status && _kd.result) _kResultclaudeai = typeof _kd.result === 'string' ? _kd.result : JSON.stringify(_kd.result)
    } catch {}
    if (_kResultclaudeai) return reply(_kResultclaudeai)
    const result = await _runAI('You are Claude AI, an AI assistant made by Anthropic. You are helpful, harmless, and honest. Provide thoughtful and detailed responses.', text)
    reply(result)
  } catch (e) {
    console.error('[CLAUDEAI ERROR]', e.message)
    reply('❌ claudeai is currently unavailable. Please try again.')
  }
}
break
case 'venice': case 'veniceai':{
  if (!text) return reply(`╔══〔 🎨 VENICE AI 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🎭', key: m.key } })
    let _kResultveniceai = null
    try {
      let _kr = await fetch(`https://apiskeith.top/ai/venice?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
      let _kd = await _kr.json()
      if (_kd.status && _kd.result) _kResultveniceai = typeof _kd.result === 'string' ? _kd.result : JSON.stringify(_kd.result)
    } catch {}
    if (_kResultveniceai) return reply(_kResultveniceai)
    const result = await _runAI('You are Venice AI, a private and uncensored AI assistant. Be helpful, creative and thorough.', text)
    reply(result)
  } catch (e) {
    console.error('[VENICE ERROR]', e.message)
    reply('❌ venice is currently unavailable. Please try again.')
  }
}
break
case 'logic':
case 'logic-eai':{
  if (!text) return reply(`╔══〔 🧠 LOGIC-E AI 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🔣', key: m.key } })
    const result = await _runAI('You are Logic-E AI, a highly logical and reasoning-focused AI. Break down problems step by step with precise logic.', text)
    reply(result)
  } catch (e) {
    console.error('[LOGIC-EAI ERROR]', e.message)
    reply('❌ logic-eai is currently unavailable. Please try again.')
  }
}
break

case 'chatgpt':{
  if (!text) return reply(`╔══〔 🤖 CHAT GPT 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🤖', key: m.key } })
    let _cgResult = null
    // Source 1: EliteProTech ChatGPT (primary)
    try {
      let _ep = await fetch(`https://eliteprotech-apis.zone.id/chatgpt?prompt=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(25000) })
      let _epd = await _ep.json()
      if (_epd.success && _epd.response) _cgResult = _epd.response
    } catch {}
    // Source 2: _runAI fallback
    if (!_cgResult) {
      try { _cgResult = await _runAI('You are ChatGPT, a highly intelligent AI assistant by OpenAI. Be helpful, clear and concise.', text) } catch {}
    }
    if (_cgResult) reply(_cgResult)
    else reply('❌ ChatGPT is currently unavailable. Please try again.')
  } catch (e) {
    console.error('[CHATGPT ERROR]', e.message)
    reply('❌ ChatGPT is currently unavailable. Please try again.')
  }
}
break

case 'talkai':
case 'talkgpt':
case 'eliteai': {
  if (!text) return reply(`╔════〔 🧠 TALK AI 〕═════╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} What is quantum computing?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🧠', key: m.key } })
    let _taResult = null
    // Source 1: EliteProTech Talk-AI (primary)
    try {
      let _ep = await fetch(`https://eliteprotech-apis.zone.id/talk-ai?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(25000) })
      let _epd = await _ep.json()
      if (_epd.success && _epd.response) _taResult = _epd.response
    } catch {}
    // Source 2: _runAI fallback
    if (!_taResult) {
      try { _taResult = await _runAI('You are a helpful and intelligent AI assistant. Respond clearly and accurately.', text) } catch {}
    }
    if (_taResult) reply(_taResult)
    else reply('❌ Talk AI is currently unavailable. Please try again.')
  } catch (e) {
    console.error('[TALKAI ERROR]', e.message)
    reply('❌ Talk AI is currently unavailable. Please try again.')
  }
}
break

case 'gpt41':
case 'gpt41-mini':{
  if (!text) return reply(`╔══〔 ⚡ GPT 4.1 MINI 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '⚡', key: m.key } })
    let _kResultgpt41mini = null
    try {
      let _kr = await fetch(`https://apiskeith.top/ai/gpt?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
      let _kd = await _kr.json()
      if (_kd.status && _kd.result) _kResultgpt41mini = typeof _kd.result === 'string' ? _kd.result : JSON.stringify(_kd.result)
    } catch {}
    if (_kResultgpt41mini) return reply(_kResultgpt41mini)
    const result = await _runAI('You are GPT-4.1 Mini, a fast and efficient AI assistant by OpenAI. Give concise but accurate answers.', text)
    reply(result)
  } catch (e) {
    console.error('[GPT41-MINI ERROR]', e.message)
    reply('❌ gpt41-mini is currently unavailable. Please try again.')
  }
}
break

case 'openai':{
  if (!text) return reply(`╔══〔 🔵 OPEN AI 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🤖', key: m.key } })
    let _kResultopenai = null
    try {
      let _kr = await fetch(`https://apiskeith.top/ai/gpt?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
      let _kd = await _kr.json()
      if (_kd.status && _kd.result) _kResultopenai = typeof _kd.result === 'string' ? _kd.result : JSON.stringify(_kd.result)
    } catch {}
    if (_kResultopenai) return reply(_kResultopenai)
    const result = await _runAI('You are OpenAI GPT-4.1, a powerful AI assistant by OpenAI. Provide detailed, accurate and helpful responses.', text)
    reply(result)
  } catch (e) {
    console.error('[OPENAI ERROR]', e.message)
    reply('❌ openai is currently unavailable. Please try again.')
  }
}
break
case 'metaai':{
  if (!text) return reply(`╔══〔 🌀 META AI 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🔵', key: m.key } })
    let _kResultmetaai = null
    try {
      let _kr = await fetch(`https://apiskeith.top/ai/llama?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
      let _kd = await _kr.json()
      if (_kd.status && _kd.result) _kResultmetaai = typeof _kd.result === 'string' ? _kd.result : JSON.stringify(_kd.result)
    } catch {}
    if (_kResultmetaai) return reply(_kResultmetaai)
    const result = await _runAI('You are Meta AI, an intelligent and helpful AI assistant by Meta. Be friendly, informative and engaging.', text)
    reply(result)
  } catch (e) {
    console.error('[METAAI ERROR]', e.message)
    reply('❌ metaai is currently unavailable. Please try again.')
  }
}
break
case 'deepseek':{
  if (!text) return reply(`╔══〔 🌊 DEEP SEEK 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🔬', key: m.key } })
    let _kResultdeepseek = null
    try {
      let _kr = await fetch(`https://apiskeith.top/ai/deepseek?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
      let _kd = await _kr.json()
      if (_kd.status && _kd.result) _kResultdeepseek = typeof _kd.result === 'string' ? _kd.result : JSON.stringify(_kd.result)
    } catch {}
    if (_kResultdeepseek) return reply(_kResultdeepseek)
    const result = await _runAI('You are DeepSeek AI, a powerful AI specializing in deep reasoning, coding and technical analysis. Provide thorough technical responses.', text)
    reply(result)
  } catch (e) {
    console.error('[DEEPSEEK ERROR]', e.message)
    reply('❌ deepseek is currently unavailable. Please try again.')
  }
}
break

case 'gptlogic':{
  if (!text) return reply(`╔══〔 🧩 GPT LOGIC 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🧩', key: m.key } })
    let _kResultgptlogic = null
    try {
      let _kr = await fetch(`https://apiskeith.top/ai/gpt?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
      let _kd = await _kr.json()
      if (_kd.status && _kd.result) _kResultgptlogic = typeof _kd.result === 'string' ? _kd.result : JSON.stringify(_kd.result)
    } catch {}
    if (_kResultgptlogic) return reply(_kResultgptlogic)
    const result = await _runAI('You are GPT Logic, a highly analytical AI. Answer questions with precise reasoning and logical structure.', text)
    reply(result)
  } catch (e) {
    console.error('[GPTLOGIC ERROR]', e.message)
    reply('❌ gptlogic is currently unavailable. Please try again.')
  }
}
break

case 'aoyoai':{
  if (!text) return reply(`╔══〔 🌙 AOYO AI 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🌸', key: m.key } })
    let _kResultaoyoai = null
    try {
      let _kr = await fetch(`https://apiskeith.top/ai/gemini?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
      let _kd = await _kr.json()
      if (_kd.status && _kd.result) _kResultaoyoai = typeof _kd.result === 'string' ? _kd.result : JSON.stringify(_kd.result)
    } catch {}
    if (_kResultaoyoai) return reply(_kResultaoyoai)
    const result = await _runAI('You are AoyoAI, a creative and helpful AI assistant. Be imaginative, warm and informative.', text)
    reply(result)
  } catch (e) {
    console.error('[AOYOAI ERROR]', e.message)
    reply('❌ aoyoai is currently unavailable. Please try again.')
  }
}
break

case 'blackbox':
case 'blackbox-pro':{
  if (!text) return reply(`╔══〔 ⬛ BLACKBOX PRO 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '⬛', key: m.key } })
    let _kResultblackboxpro = null
    try {
      let _kr = await fetch(`https://apiskeith.top/ai/gpt?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
      let _kd = await _kr.json()
      if (_kd.status && _kd.result) _kResultblackboxpro = typeof _kd.result === 'string' ? _kd.result : JSON.stringify(_kd.result)
    } catch {}
    if (_kResultblackboxpro) return reply(_kResultblackboxpro)
    const result = await _runAI('You are Blackbox AI Pro, a specialized AI for coding and technical questions. Provide precise, working code solutions.', text)
    reply(result)
  } catch (e) {
    console.error('[BLACKBOX-PRO ERROR]', e.message)
    reply('❌ blackbox-pro is currently unavailable. Please try again.')
  }
}
break

case 'zerogpt':{
  if (!text) return reply(`╔══〔 🔲 ZERO GPT 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🔲', key: m.key } })
    let _kResultzerogpt = null
    try {
      let _kr = await fetch(`https://apiskeith.top/ai/gpt?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
      let _kd = await _kr.json()
      if (_kd.status && _kd.result) _kResultzerogpt = typeof _kd.result === 'string' ? _kd.result : JSON.stringify(_kd.result)
    } catch {}
    if (_kResultzerogpt) return reply(_kResultzerogpt)
    const result = await _runAI('You are ZeroGPT, an advanced AI assistant. Provide accurate and comprehensive answers on any topic.', text)
    reply(result)
  } catch (e) {
    console.error('[ZEROGPT ERROR]', e.message)
    reply('❌ zerogpt is currently unavailable. Please try again.')
  }
}
break

case 'yupraai':{
  if (!text) return reply(`╔══〔 🌟 YUPRA AI 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🌟', key: m.key } })
    const result = await _runAI('You are Yupra AI, a knowledgeable and helpful assistant. Be clear, accurate and thorough.', text)
    reply(result)
  } catch (e) {
    console.error('[YUPRAAI ERROR]', e.message)
    reply('❌ yupraai is currently unavailable. Please try again.')
  }
}
break

case 'feloai':{
  if (!text) return reply(`╔══〔 🦅 FELO AI 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🔭', key: m.key } })
    const result = await _runAI('You are Felo AI, a research-oriented AI assistant. Provide well-researched, in-depth answers.', text)
    reply(result)
  } catch (e) {
    console.error('[FELOAI ERROR]', e.message)
    reply('❌ feloai is currently unavailable. Please try again.')
  }
}
break

case 'chatevery':
case 'chatevery-where':{
  if (!text) return reply(`╔══〔 🌐 CHAT EVERYWHERE 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '💬', key: m.key } })
    const result = await _runAI('You are ChatEveryWhere AI, a helpful AI available anywhere. Provide knowledgeable and friendly responses.', text)
    reply(result)
  } catch (e) {
    console.error('[CHATEVERY-WHERE ERROR]', e.message)
    reply('❌ chatevery-where is currently unavailable. Please try again.')
  }
}
break

case 'gpt-4o':{
  if (!text) return reply(`╔══〔 ⚡ GPT-4o 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🧠', key: m.key } })
    let _kResultgpt_4o = null
    try {
      let _kr = await fetch(`https://apiskeith.top/ai/gpt?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
      let _kd = await _kr.json()
      if (_kd.status && _kd.result) _kResultgpt_4o = typeof _kd.result === 'string' ? _kd.result : JSON.stringify(_kd.result)
    } catch {}
    if (_kResultgpt_4o) return reply(_kResultgpt_4o)
    const result = await _runAI('You are GPT-4o, a powerful and versatile AI by OpenAI. Provide detailed, accurate responses with rich understanding.', text)
    reply(result)
  } catch (e) {
    console.error('[GPT-4O ERROR]', e.message)
    reply('❌ gpt-4o is currently unavailable. Please try again.')
  }
}
break


case 'aliceai': {
  if (!text) return reply(`╔══〔 🐇 ALICE AI 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n║ Example: ${prefix}${command} generate an image of a sunset\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🤍', key: m.key } })
    let isImageReq = /(generate.*image|create.*image|make.*image|image of|picture of|draw)/i.test(text)
    if (isImageReq) {
      await reply('🎨 _Generating image, please wait..._')
      let seed = Math.floor(Math.random() * 999999)
      let imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}?model=flux&width=1024&height=1024&seed=${seed}&nologo=true&enhance=true`
      let imgBuffer = await getBuffer(imgUrl)
      if (!imgBuffer || imgBuffer.length < 5000) throw new Error('Image generation failed')
      await X.sendMessage(m.chat, { image: imgBuffer, caption: `🤍 *Alice AI:*\n\n_${text}_` }, { quoted: m })
    } else {
      const result = await _runAI('You are Alice AI, a warm, friendly and knowledgeable AI assistant. Be conversational, helpful and clear in your responses.', text)
      reply(result)
    }
  } catch (e) {
    console.error('[ALICEAI ERROR]', e.message)
    reply('❌ AliceAI is currently unavailable. Please try again.')
  }
}
break

case 'magicstudio':{
if (!text) return reply(`╔══〔 ✨ MAGIC STUDIO AI 〕══╗\n\n║ Generate stunning AI images instantly.\n\n║ *Usage:* ${prefix}magicstudio [description]\n\n║ _Examples:_\n║ • a woman in a red dress in Paris\n║ • cyberpunk warrior with glowing sword\n║ • magical forest with fairy lights\n╚═══════════════════════╝`)
try {
await reply('✨ _Magic Studio is generating your image..._')
// Use pollinations with artistic model parameters for magic studio style
let enhancedPrompt = text + ', highly detailed, professional quality, vivid colors, artistic masterpiece'
let seed = Math.floor(Math.random() * 999999)
let imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?model=flux&width=1024&height=1024&seed=${seed}&nologo=true&enhance=true`
let imgBuffer = await getBuffer(imgUrl)
if (!imgBuffer || imgBuffer.length < 5000) throw new Error('Generation failed')
let caption = `╔══〔 ✨ MAGIC STUDIO 〕═══╗\n\n║ 📝 *Prompt* : ${text}\n║ 🌟 *Style* : Magic Studio\n║ 🎲 *Seed* : ${seed}\n╚═══════════════════════╝`
await X.sendMessage(m.chat, { image: imgBuffer, caption }, { quoted: m })
} catch(e) {
try {
let seed2 = Math.floor(Math.random() * 999999)
let fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(text + ', professional, high quality')}?width=1024&height=1024&seed=${seed2}&nologo=true`
await X.sendMessage(m.chat, { image: { url: fallbackUrl }, caption: `✨ *Magic Studio:* ${text}` }, { quoted: m })
} catch(e2) { reply(`❌ *Magic Studio failed.*\n_${e2.message || 'Try again shortly.'}_`) }
}
}
break

case 'gemmaai':{
  if (!text) return reply(`╔══〔 💎 GEMMA AI 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '💠', key: m.key } })
    const result = await _runAI('You are Gemma AI, a lightweight but powerful AI by Google. Provide clear and helpful responses.', text)
    reply(result)
  } catch (e) {
    console.error('[GEMMAAI ERROR]', e.message)
    reply('❌ gemmaai is currently unavailable. Please try again.')
  }
}
break
case 'aivelyn':
case 'velynai': {
  if (!text) return reply(`╔══〔 🌸 VELYN AI 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🌸', key: m.key } })
    let _kResultvelynai = null
    try {
      let _kr = await fetch(`https://apiskeith.top/ai/gemini?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
      let _kd = await _kr.json()
      if (_kd.status && _kd.result) _kResultvelynai = typeof _kd.result === 'string' ? _kd.result : JSON.stringify(_kd.result)
    } catch {}
    if (_kResultvelynai) return reply(_kResultvelynai)
    const result = await _runAI('You are Velyn AI, a creative, friendly and helpful AI assistant. Provide engaging and informative responses.', text)
    reply(result)
  } catch (e) {
    console.error('[VELYNAI ERROR]', e.message)
    reply('❌ VelynAI is currently unavailable. Please try again.')
  }
}
break

case 'muslimprayer':
case 'islamprayer':
case 'prayermuslim': {
    await X.sendMessage(m.chat, { react: { text: '🕌', key: m.key } })
    if (!isOwner) return reply(mess.OnlyOwner)
    const _arg = (text || '').toLowerCase().trim()
    const _valid = ['on', 'off', 'dm', 'group', 'all', 'status']
    if (_arg === 'status' || !_arg) {
        const _cur = global.muslimPrayer || 'off'
        return reply(`╔══〔 🕌 MUSLIM PRAYER REMINDER 〕══╗\n\n║ 📊 *Status* : *${_cur.toUpperCase()}*\n\n║ ${prefix}muslimprayer on    — DM + groups\n║ ${prefix}muslimprayer dm    — DM only\n║ ${prefix}muslimprayer group — groups only\n║ ${prefix}muslimprayer off   — disable\n╚═══════════════════════╝`)
    }
    if (!_valid.includes(_arg)) return reply(`❌ Invalid. Use: on · off · dm · group · all`)
    global.muslimPrayer = _arg === 'on' ? 'all' : _arg
    const _labels = { all: '✅ ON (DM + Groups)', dm: '✅ ON (DM only)', group: '✅ ON (Groups only)', off: '❌ OFF' }
    reply(`🕌 *Muslim Prayer Reminder* : ${_labels[global.muslimPrayer]}`)
}
break

case 'christianprayer':
case 'devotion':
case 'prayerchristian': {
    await X.sendMessage(m.chat, { react: { text: '✝️', key: m.key } })
    if (!isOwner) return reply(mess.OnlyOwner)
    const _arg2 = (text || '').toLowerCase().trim()
    const _valid2 = ['on', 'off', 'dm', 'group', 'all', 'status']
    if (_arg2 === 'status' || !_arg2) {
        const _cur2 = global.christianDevotion || 'off'
        return reply(`╔══〔 ✝️  CHRISTIAN DEVOTION 〕══╗\n\n║ 📊 *Status* : *${_cur2.toUpperCase()}*\n\n║ ${prefix}christianprayer on    — DM + groups\n║ ${prefix}christianprayer dm    — DM only\n║ ${prefix}christianprayer group — groups only\n║ ${prefix}christianprayer off   — disable\n╚═══════════════════════╝`)
    }
    if (!_valid2.includes(_arg2)) return reply(`❌ Invalid. Use: on · off · dm · group · all`)
    global.christianDevotion = _arg2 === 'on' ? 'all' : _arg2
    const _labels2 = { all: '✅ ON (DM + Groups)', dm: '✅ ON (DM only)', group: '✅ ON (Groups only)', off: '❌ OFF' }
    reply(`✝️ *Christian Devotion* : ${_labels2[global.christianDevotion]}`)
}
break

case 'writecream': {
  if (!text) return reply(`╔══〔 ✍️  WRITECREAM AI 〕══╗\n\n║ AI-powered content writer.\n\n║ *Usage:* ${prefix}writecream [topic or instruction]\n\n║ _Examples:_\n║ • blog post about social media marketing\n║ • product description for wireless earbuds\n║ • email subject lines for a sale campaign\n║ • Instagram caption for a sunset photo\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '✍️', key: m.key } })
    await reply('✍️ _WriteCream AI is writing your content..._')
    const result = await _runAI('You are WriteCream AI, a professional content writer and copywriter. Create engaging, well-structured, high-quality written content including blog posts, product descriptions, email copy, social media captions, ad headlines, and more. Match the tone and format to the request. Use clear structure with headings or bullet points where appropriate.', text)
    reply(`╔══〔 ✍️  WRITECREAM AI 〕══╗\n\n${result}\n╚═══════════════════════╝`)
  } catch (e) {
    console.error('[WRITECREAM ERROR]', e.message)
    reply('❌ WriteCream AI is currently unavailable. Please try again.')
  }
}
break

case 'chatbotai': {
  if (!text) return reply(`╔══〔 🤖 CHATBOT AI 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🤖', key: m.key } })
    const result = await _runAI('You are ChatbotAI, a friendly, intelligent and engaging conversational AI assistant. Have natural conversations, answer questions thoughtfully, and be helpful at all times.', text)
    reply(result)
  } catch (e) {
    console.error('[CHATBOTAI ERROR]', e.message)
    reply('❌ ChatbotAI is currently unavailable. Please try again.')
  }
}
break

case 'muslimai':{
  if (!text) return reply('Please enter your question?');
  try {
    const result = await muslimai(text);

    if (result.error) return reply(result.error);

    let sourcesText = result.sources.length > 0 
        ? result.sources.map((src, index) => `${index + 1}. *${src.title}*\n🔗 ${src.url}`).join("\n\n")
        : "No sources found.";

    let responseMessage = `ᴘᴏᴡᴇʀᴇᴅ ᴡɪᴛʜ ᴍᴜsʟɪᴍᴀɪ\n\n${result.answer}`;

    reply(responseMessage);
} catch (error) {
    console.error("⚠ *Error* :", error);
    reply("An error occurred.");
}
}
break;

case 'bible':
case 'verse':
case 'bibleverse': {
    await X.sendMessage(m.chat, { react: { text: '📖', key: m.key } })
    if (!text) {
        return reply(`╔══〔 📖 BIBLE SEARCH 〕══╗\n\n║ Search any verse or topic.\n\n║ *By reference:*\n║ ${prefix}bible John 3:16\n║ ${prefix}bible Romans 8:28\n║ ${prefix}bible Psalm 23:1\n\n║ *By topic/keyword:*\n║ ${prefix}bible love\n║ ${prefix}bible faith\n║ ${prefix}bible strength\n╚═══════════════════════╝`)
    }
    try {
        const isRef = /^[1-3]?\s?[a-zA-Z]+\s+\d+:\d+/i.test(text.trim())
        let verseText = '', reference = '', translation = 'KJV'

        if (isRef) {
            const _bRef = encodeURIComponent(text.trim())
            // ── Primary: Keith API ──────────────────────────────────────────
            try {
                const _kb = await _keithFetch(`/bible/search?q=${_bRef}`)
                const _kbr = _kb?.result || _kb
                if (_kbr?.text || _kbr?.verse) {
                    verseText   = _kbr.text || _kbr.verse
                    reference   = _kbr.reference || _kbr.ref || text.trim()
                    translation = _kbr.translation || 'KJV'
                }
            } catch(_) {}
            // ── Fallback: bible-api.com ─────────────────────────────────────
            if (!verseText) {
                let _bRes = await fetch(`https://bible-api.com/${_bRef}?translation=kjv`)
                let _bData = await _bRes.json()
                if (_bData.error) {
                    _bRes = await fetch(`https://bible-api.com/${_bRef}?translation=web`)
                    _bData = await _bRes.json()
                    if (_bData.error) return reply(`❌ *Verse not found:* _${text}_\n\n_Check spelling, e.g._ *John 3:16* _or_ *Psalm 23:1*`)
                    translation = 'WEB'
                }
                verseText = _bData.text?.trim()
                reference = _bData.reference
            }
        } else {
            // ── Topic search: Keith then Pollinations.ai ────────────────────
            try {
                const _kt = await _keithFetch(`/bible/verse?topic=${encodeURIComponent(text.trim())}`)
                const _ktr = _kt?.result || _kt
                if (_ktr?.text || _ktr?.verse) {
                    verseText   = _ktr.text || _ktr.verse
                    reference   = _ktr.reference || _ktr.ref || `Topic: ${text}`
                    translation = _ktr.translation || 'KJV'
                }
            } catch(_) {}
            if (!verseText) {
                const _aiRes = await fetch('https://text.pollinations.ai/openai', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'openai', stream: false, max_tokens: 300,
                        messages: [
                            { role: 'system', content: 'You are a Bible scholar. When given a topic or keyword, respond with ONLY three lines: Line 1: the verse text. Line 2: the reference (e.g. John 3:16). Line 3: the translation (e.g. KJV). No extra text.' },
                            { role: 'user', content: `Give me a Bible verse about: ${text}` }
                        ]
                    })
                })
                const _aiData = await _aiRes.json()
                const _aiLines = (_aiData.choices?.[0]?.message?.content || '').trim().split('\n').filter(Boolean)
                verseText   = _aiLines[0] || ''
                reference   = _aiLines[1] || `Topic: ${text}`
                translation = _aiLines[2] || 'KJV'
            }
        }

        if (!verseText) return reply(`❌ Could not find a verse for: _${text}_`)
        reply(`╔══〔 📖 BIBLE VERSE 〕═══╗\n\n║ _❝ ${verseText} ❞_\n\n║ 📌 *${reference}*\n║ 📚 *Translation* : ${translation}\n\n_⚡ Juice v12_\n╚═══════════════════════╝`)

    } catch(e) {
        reply(`❌ *Bible search failed.*\n_${e.message || 'Please try again.'}_`)
    }
} break

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎶  HYMN SEARCH (Keith API)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
case 'hymn':
case 'hymnbook': {
    await X.sendMessage(m.chat, { react: { text: '🎶', key: m.key } })
    const _hmq = q?.trim() || text?.trim()
    try {
        if (_hmq) {
            await reply(`🎶 _Searching hymn: ${_hmq}..._`)
            const _hmd = await _keithFetch(`/hymn?q=${encodeURIComponent(_hmq)}`)
            const _hmr = _hmd?.result || (Array.isArray(_hmd) ? _hmd[0] : _hmd)
            if (!_hmr?.title && !_hmr?.lyrics) throw new Error('Not found')
            let msg = `╌══〔 🎶 HYMN 〕═════════╌\n`
            if (_hmr.title) msg += `\n🎵 *${_hmr.title}*\n`
            if (_hmr.number) msg += `📌 *Number:* ${_hmr.number}\n`
            if (_hmr.lyrics) msg += `\n${_hmr.lyrics.slice(0, 1000)}${_hmr.lyrics.length > 1000 ? '\n...' : ''}\n`
            msg += `\n╚═══════════════════════╝`
            await reply(msg)
        } else {
            // Random hymn
            await reply('🎶 _Fetching random hymn..._')
            const _hrnd = await _keithFetch('/hymn/random')
            const _hrnr = _hrnd?.result || _hrnd
            if (!_hrnr?.title) throw new Error('No hymn')
            let msg = `╌══〔 🎶 HYMN OF THE DAY 〕═╌\n`
            if (_hrnr.title) msg += `\n🎵 *${_hrnr.title}*\n`
            if (_hrnr.number) msg += `📌 *Number:* ${_hrnr.number}\n`
            if (_hrnr.lyrics) msg += `\n${_hrnr.lyrics.slice(0, 1000)}${_hrnr.lyrics.length > 1000 ? '\n...' : ''}\n`
            msg += `\n╚═══════════════════════╝`
            await reply(msg)
        }
    } catch(e) {
        reply(`╌══〔 🎶 HYMN 〕═════════╌\n║ *Usage:* ${prefix}hymn [search term]\n║ *Random:* ${prefix}hymn\n║ Example: ${prefix}hymn amazing grace\n╚═══════════════════════╝`)
    }
} break

case 'randommeme':
case 'rmeme': {
    await X.sendMessage(m.chat, { react: { text: '🤣', key: m.key } })
    try {
        const _rmd = await _keithFetch('/fun/meme')
        const _rmr = _rmd?.result || _rmd
        const _rmUrl = _rmr?.url || _rmr?.imageUrl
        const _rmTitle = _rmr?.title || 'Random Meme'
        const _rmSub = _rmr?.subreddit ? ` (r/${_rmr.subreddit})` : ''
        if (!_rmUrl) throw new Error('No meme')
        await safeSendMedia(m.chat, { image: { url: _rmUrl }, caption: `🤣 *${_rmTitle}*${_rmSub}` }, {}, { quoted: m })
    } catch(e) { reply('❌ Could not fetch a meme right now. Try again!') }
} break



case 'quran':
case 'ayah':
case 'quranverse': {
    await X.sendMessage(m.chat, { react: { text: '📿', key: m.key } })
    if (!text) {
        return reply(`╔══〔 📿 QURAN SEARCH 〕══╗\n\n║ Search any ayah or topic.\n\n║ *By reference (Surah:Ayah):*\n║ ${prefix}quran 2:255    (Ayatul Kursi)\n║ ${prefix}quran 1:1      (Al-Fatiha)\n║ ${prefix}quran 112:1    (Al-Ikhlas)\n\n║ *By topic/keyword:*\n║ ${prefix}quran patience\n║ ${prefix}quran mercy\n║ ${prefix}quran paradise\n╚═══════════════════════╝`)
    }
    try {
        const isRef = /^\d+:\d+$/.test(text.trim())
        let arabicText = '', englishText = '', reference = '', surahName = ''

        if (isRef) {
            const [surah, ayah] = text.trim().split(':')
            // Fetch Arabic text
            const _qAr = await fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/ar.alafasy`)
            const _qArData = await _qAr.json()
            // Fetch English translation
            const _qEn = await fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/en.asad`)
            const _qEnData = await _qEn.json()

            if (_qArData.code !== 200) return reply(`❌ *Ayah not found:* _${text}_\n\n_Check format, e.g._ *2:255* _(Surah:Ayah)_`)

            arabicText = _qArData.data?.text || ''
            englishText = _qEnData.data?.text || ''
            surahName = _qArData.data?.surah?.englishName || ''
            const surahNameAr = _qArData.data?.surah?.name || ''
            reference = `${surahName} (${surahNameAr}) — ${surah}:${ayah}`
        } else {
            // Keyword search via AI
            const _aiRes = await fetch('https://text.pollinations.ai/openai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'openai', stream: false, max_tokens: 400,
                    messages: [
                        { role: 'system', content: 'You are a Quran scholar. When given a topic or keyword, respond with ONLY four lines: Line 1: the Arabic ayah text. Line 2: the English translation. Line 3: the reference (e.g. Al-Baqarah 2:155). Line 4: translator (e.g. Muhammad Asad). No extra text, no explanation.' },
                        { role: 'user', content: `Give me a Quran ayah about: ${text}` }
                    ]
                })
            })
            const _aiData = await _aiRes.json()
            const _aiLines = (_aiData.choices?.[0]?.message?.content || '').trim().split('\n').filter(Boolean)
            arabicText = _aiLines[0] || ''
            englishText = _aiLines[1] || ''
            reference = _aiLines[2] || `Topic: ${text}`
            surahName = _aiLines[3] || 'Muhammad Asad'
        }

        if (!englishText && !arabicText) return reply(`❌ Could not find an ayah for: _${text}_`)

        let msg = `╔═══〔 📿 QURAN AYAH 〕═══╗`
        if (arabicText) msg += `  *${arabicText}*\n\n`
        if (englishText) msg += `  _❝ ${englishText} ❞_\n\n`
        msg += `║ 📌 *${reference}*\n`
        msg += `║ 📚 *Translator* : ${isRef ? 'Muhammad Asad' : surahName}\n\n`
        msg += `_⚡ Juice v12_`

        msg += `\n╚═══════════════════════╝`
        reply(msg)

    } catch(e) {
        reply(`❌ *Quran search failed.*\n_${e.message || 'Please try again.'}_`)
    }
}
break;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📖  SURAH LOOKUP (Keith API)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
case 'surah':
case 'surahsearch': {
    await X.sendMessage(m.chat, { react: { text: '📖', key: m.key } })
    const _srq = q?.trim() || text?.trim()
    if (!_srq) return reply(`╌══〔 📖 SURAH SEARCH 〕══╌\n║ *Usage:* ${prefix}surah [number/name]\n║ Example: ${prefix}surah 1\n║ Example: ${prefix}surah al-fatiha\n╚═══════════════════════╝`)
    try {
        await reply(`📖 _Fetching Surah ${_srq}..._`)
        const _srd = await _keithFetch(`/surah?number=${encodeURIComponent(_srq)}`)
        const _srs = _srd?.surah || _srd?.result || _srd
        if (!_srs || (!_srs.englishName && !_srs.name)) throw new Error('Not found')
        let msg = `╌══〔 📖 SURAH ${_srs.number || _srq} 〕══╌\n`
        if (_srs.englishName) msg += `\n📜 *Name:* ${_srs.englishName} (${_srs.name || ''})\n`
        if (_srs.englishNameTranslation) msg += `🖼️ *Meaning:* ${_srs.englishNameTranslation}\n`
        if (_srs.numberOfAyahs) msg += `📊 *Ayahs:* ${_srs.numberOfAyahs}\n`
        if (_srs.revelationType) msg += `🏙️ *Revealed in:* ${_srs.revelationType}\n`
        const _sray = Array.isArray(_srs.ayahs) ? _srs.ayahs.slice(0, 3) : []
        if (_sray.length) { msg += `\n*🔉 First Ayahs:*\n`; for (let a of _sray) { msg += `\n🔹 [${a.numberInSurah}] ${a.text || ''}\n`; if (a.translation) msg += `   _${a.translation}_\n` } }
        msg += `\n╚═══════════════════════╝`
        await reply(msg)
    } catch(e) { reply(`❌ Could not find Surah *${_srq}*. Try a number (1-114) or use .surahlist to see all.`) }
} break

case 'surahlist': {
    await X.sendMessage(m.chat, { react: { text: '📋', key: m.key } })
    try {
        const _sld = await _keithFetch('/surah')
        const _sls = Array.isArray(_sld) ? _sld : (_sld?.surahs || _sld?.result)
        if (!Array.isArray(_sls) || !_sls.length) throw new Error('No list')
        let msg = `╌══〔 📋 ALL SURAHS (${_sls.length}) 〕╌\n`
        for (let s of _sls.slice(0, 30)) { msg += `\n${s.number || '?'}. *${s.englishName || s.name}* — ${s.numberOfAyahs || '?'} ayahs` }
        if (_sls.length > 30) msg += `\n\n_...use ${prefix}surah [number] for full details_`
        msg += `\n╚═══════════════════════╝`
        await reply(msg)
    } catch(e) { reply('❌ Could not fetch surah list. Try again later.') }
} break



case 'llama':
case 'llama-ai':{
  if (!text) return reply(`╔══〔 🦙 LLAMA AI 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🦙', key: m.key } })
    let _kResultllamaai = null
    try {
      let _kr = await fetch(`https://apiskeith.top/ai/llama?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
      let _kd = await _kr.json()
      if (_kd.status && _kd.result) _kResultllamaai = typeof _kd.result === 'string' ? _kd.result : JSON.stringify(_kd.result)
    } catch {}
    if (_kResultllamaai) return reply(_kResultllamaai)
    const result = await _runAI('You are LLaMA AI, a powerful open-source AI model by Meta. Be helpful, accurate and conversational.', text)
    reply(result)
  } catch (e) {
    console.error('[LLAMA-AI ERROR]', e.message)
    reply('❌ llama-ai is currently unavailable. Please try again.')
  }
}
break

case 'gptturbo':{
if (!text) return reply(`╔════〔 ⚡ GPT TURBO 〕════╗\n\n║ Usage: *${prefix}gptturbo [message]*\n║ Example: ${prefix}gptturbo Tell me a joke\n╚═══════════════════════╝`);
try {
  await X.sendMessage(m.chat, { react: { text: '⚡', key: m.key } })
  let _kResultgptturbo = null
  try {
    let _kr = await fetch(`https://apiskeith.top/ai/gpt?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
    let _kd = await _kr.json()
    if (_kd.status && _kd.result) _kResultgptturbo = typeof _kd.result === 'string' ? _kd.result : JSON.stringify(_kd.result)
  } catch {}
  const _aiResult = _kResultgptturbo || await _runAI('You are GPT Turbo, a fast and intelligent AI assistant. Provide clear, helpful responses.', text)
  let turbo = `Title : ${text}\n\nMessage : ${_aiResult}\n`
  await X.sendMessage(m.chat, { text: '⬣───「 *G P T T U R B O* 」───⬣\n\n' + turbo }, { quoted: m })
} catch (e) { reply('❌ gptturbo is currently unavailable. Please try again.') }
}
break

case 'gemini-ai':{
    const isQuotedImage = m.quoted && m.quoted.mtype === 'imageMessage'
    const isImage = m.mtype === 'imageMessage'
    const quoted = m.quoted ? m.quoted : m
    await X.sendMessage(m.chat, { react: { text: '✨', key: m.key } })

    if (isImage || isQuotedImage) {
        try {
            const question = text || 'What is in this image? Describe it in detail.'
            await reply('🔍 _Analysing image with Gemini AI, please wait..._')
            let imgBuffer = await quoted.download()
            if (!imgBuffer || imgBuffer.length < 100) throw new Error('Failed to download image')
            let b64 = imgBuffer.toString('base64')
            let mime = quoted.mimetype || 'image/jpeg'
            let { data: vd } = await axios.post('https://text.pollinations.ai/openai', {
                model: 'openai',
                messages: [{ role: 'user', content: [
                    { type: 'text', text: question },
                    { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } }
                ]}],
                max_tokens: 1000,
                stream: false
            }, { headers: { 'Content-Type': 'application/json' }, timeout: 45000 })
            const description = vd?.choices?.[0]?.message?.content
            if (!description) throw new Error('No response from vision API')
            await X.sendMessage(m.chat, { text: `✨ *Gemini AI Vision:*\n\n${description}` }, { quoted: m })
        } catch (error) {
            console.error('[GEMINI-AI VISION ERROR]', error.message)
            await X.sendMessage(m.chat, { text: '❌ *Image analysis failed.* Please try again.' }, { quoted: m })
        }
    } else {
        try {
            if (!text) return reply(`╔══〔 🤖 AI ASSISTANT 〕══╗\n\n║ Usage: *${prefix}${command} [question]*\n║ Example: ${prefix}${command} Who is Elon Musk?\n╚═══════════════════════╝`)
            const result = await _runAI('You are Gemini AI, a powerful and intelligent AI assistant by Google. Provide detailed, accurate, and well-structured answers.', text)
            await X.sendMessage(m.chat, { text: `✨ *Gemini AI:*\n\n${result}` }, { quoted: m })
        } catch (error) {
            console.error('[GEMINI-AI ERROR]', error.message)
            await X.sendMessage(m.chat, { text: '❌ *Gemini AI is currently unavailable.* Please try again.' }, { quoted: m })
        }
    }
}
break

case 'lumin':
case 'lumin-ai':{
  if (!text) return reply(`╔══〔 💡 LUMIN AI 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '💡', key: m.key } })
    const result = await _runAI('You are Lumin AI, a bright and insightful AI assistant. Provide illuminating and clear answers.', text)
    reply(result)
  } catch (e) {
    console.error('[LUMIN-AI ERROR]', e.message)
    reply('❌ lumin-ai is currently unavailable. Please try again.')
  }
}
break

case 'typli':
case 'typli-ai':{
  if (!text) return reply(`╔══〔 ✍️ TYPLI AI 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '✍️', key: m.key } })
    const result = await _runAI('You are Typli AI, a versatile AI writing assistant. Help with writing, editing and creative content.', text)
    reply(result)
  } catch (e) {
    console.error('[TYPLI-AI ERROR]', e.message)
    reply('❌ typli-ai is currently unavailable. Please try again.')
  }
}
break;

case 'poly':
case 'poly-ai':{
  if (!text) return reply(`╔══〔 🔷 POLY AI 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🌐', key: m.key } })
    const result = await _runAI('You are Poly AI, a conversational AI assistant. Be engaging, friendly and informative.', text)
    reply(result)
  } catch (e) {
    console.error('[POLY-AI ERROR]', e.message)
    reply('❌ poly-ai is currently unavailable. Please try again.')
  }
}
break

case 'gemini-pro':{
  if (!text) return reply(`╔══〔 ♊ GEMINI PRO 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🌟', key: m.key } })
    let _kResultgemini_pro = null
    try {
      let _kr = await fetch(`https://apiskeith.top/ai/gemini?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
      let _kd = await _kr.json()
      if (_kd.status && _kd.result) _kResultgemini_pro = typeof _kd.result === 'string' ? _kd.result : JSON.stringify(_kd.result)
    } catch {}
    if (_kResultgemini_pro) return reply(_kResultgemini_pro)
    const result = await _runAI('You are Gemini Pro, a powerful AI assistant by Google. Provide comprehensive and accurate answers.', text)
    reply(result)
  } catch (e) {
    console.error('[GEMINI-PRO ERROR]', e.message)
    reply('❌ gemini-pro is currently unavailable. Please try again.')
  }
}
break;
case 'tebak': {
    await X.sendMessage(m.chat, { react: { text: '🧩', key: m.key } })
  const quizPath = './database/tebakgame.json';
  if (!fs.existsSync(quizPath)) return reply('⚠️ Quiz data file not found.');

  const data = JSON.parse(fs.readFileSync(quizPath));
  const kategoriUnik = [...new Set(data.map(item => item.kategori))];

  const kategori = args[0]?.toLowerCase();
  if (!kategori) {
    const daftar = kategoriUnik.join(', ');
    return reply(`╔═════〔 📚 TEBAK 〕══════╗\n\n║ Usage: *.tebak [category]*\n║ Example: .tebak lagu\n\n${daftar}\n╚═══════════════════════╝`);
  }

  if (!kategoriUnik.includes(kategori)) {
    return reply(`❌ Kategori "${kategori}" not found.\nAvailable categories: ${kategoriUnik.join(', ')}`);
  }
  const soalKategori = data.filter(item => item.kategori === kategori);
  const soal = soalKategori[Math.floor(Math.random() * soalKategori.length)];

  if (!global.tebakGame) global.tebakGame = {};
  if (global.tebakGame[m.sender]) {
    return reply('⚠️ You still have an unanswered question! Answer it or type giveup first.');
  }

  global.tebakGame[m.sender] = {
    jawaban: soal.jawaban,
    soal: soal.soal,
    petunjuk: soal.petunjuk || 'No hint available',
    timeout: setTimeout(() => {
      if (global.tebakGame[m.sender]) {
        reply(`╔══〔 ⏰ TIME IS UP 〕═════╗\n║ ✅ *Correct answer* : ${global.tebakGame[m.sender].jawaban}\n╚═══════════════════════╝`);
        delete global.tebakGame[m.sender];
      }
    }, 60000) // 60 detik
  };

  return reply(`╔══〔 🧠 GUESS THE ${kategori.toUpperCase()} 〕══╗\n\n║ ${soal.soal}\n\n║ ⏱️ *60 seconds* — reply to answer!\n╚═══════════════════════╝`);
}
break;
//━━━━━━━━━━━━━━━━━━━━━━━━//
//━━━━━━━━━━━━━━━━━━━━━━━━//
// Info Bot             
case 'debugrole': {
    await X.sendMessage(m.chat, { react: { text: '🔍', key: m.key } })
    if (!isOwner) return reply('╔══〔 👑 OWNER ONLY 〕══╗\n\n║ This command is for owner only.\n╚═══════════════════════╝')
    let dbgMsg = `*🔍 ROLE DEBUG INFO*\n\n`
    dbgMsg += `*Bot Identity:*\n`
    dbgMsg += `• X.user.id: ${X.user?.id || 'null'}\n`
    dbgMsg += `• X.user.lid: ${X.user?.lid || 'null'}\n`
    dbgMsg += `• botJid (decoded): ${botJid}\n`
    dbgMsg += `• botLid (decoded): ${botLid || 'null'}\n\n`
    dbgMsg += `*Sender Identity:*\n`
    dbgMsg += `• m.sender: ${m.sender}\n`
    dbgMsg += `• m.key.participant: ${m.key?.participant || 'null'}\n`
    dbgMsg += `• senderFromKey: ${senderFromKey || 'null'}\n\n`
    dbgMsg += `*Role Results:*\n`
    dbgMsg += `• isGroup: ${isGroup}\n`
    dbgMsg += `• isOwner: ${isOwner}\n`
    dbgMsg += `• isAdmins: ${isAdmins}\n`
    dbgMsg += `• isBotAdmins: ${isBotAdmins}\n`
    dbgMsg += `• isSuperAdmin: ${isSuperAdmin}\n\n`
    if (isGroup && participants) {
        dbgMsg += `*Admin Participants:*\n`
        participants.filter(p => p.admin).forEach(p => {
            let matchBot = isParticipantBot(p)
            let matchSender = isParticipantSender(p)
            dbgMsg += `• ${p.id}\n`
            dbgMsg += `  role: ${p.admin} | isBot: ${matchBot} | isSender: ${matchSender}\n`
            dbgMsg += `  sameAsUserId: ${isSameUser(p.id, X.user.id)} | sameAsLid: ${X.user?.lid ? isSameUser(p.id, X.user.lid) : 'no lid'}\n`
        })
    }
    reply(dbgMsg)
}
break;

case 'p':
case 'ping':
case 'info':
case 'storage':
case 'server':
case 'srvinfo': {
    await X.sendMessage(m.chat, { react: { text: command === 'ping' ? '🏓' : '🖥️', key: m.key } })
  const _pingStart = Date.now()

  function formatp(bytes) {
    if (bytes < 1024) return `${bytes} B`
    const kb = bytes / 1024
    if (kb < 1024) return `${kb.toFixed(2)} KB`
    const mb = kb / 1024
    if (mb < 1024) return `${mb.toFixed(2)} MB`
    const gb = mb / 1024
    return `${gb.toFixed(2)} GB`
  }

async function getServerInfo() {
  const start = Date.now()

  const osType = os.type()
  const release = os.release()
  const arch = os.arch()
  const nodeVersion = process.version
  const platform = os.platform()

  const cpus = os.cpus()
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'Unknown'
  const coreCount = cpus.length
  let cpuUsage = '0%'
  if (cpus.length > 0) {
    const cpu = cpus.reduce((acc, c) => {
      acc.total += Object.values(c.times).reduce((a, b) => a + b, 0)
      acc.user += c.times.user
      acc.sys += c.times.sys
      acc.speed += c.speed
      return acc
    }, { speed: 0, total: 0, user: 0, sys: 0 })
    cpuUsage = ((cpu.user + cpu.sys) / cpu.total * 100).toFixed(2) + '%'
  }
  const loadAverage = os.loadavg().map(l => l.toFixed(2))
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem

  let storageText = ''
  try {
    const storageInfo = await nou.drive.info()
    if (storageInfo && storageInfo.totalGb) {
      storageText = `\n*STORAGE*\n║ 💾 Total: ${storageInfo.totalGb} GB\n║ 📥 Used: ${storageInfo.usedGb} GB (${storageInfo.usedPercentage}%)\n║ ✅ Free: ${storageInfo.freeGb} GB (${storageInfo.freePercentage}%)`
    }
  } catch(e) {}

  const latensi = (Date.now() - start)

  const responseText = `╔══〔 🤖 ${global.botname || 'Juice v12'} 〕══╗
║ 🟢 *Bot uptime* : ${runtime(process.uptime())}
║ 🖥️  *Server uptime* : ${runtime(os.uptime())}

║ 🔧 *OS* : ${osType} (${arch})
║ 🟩 *Node.js* : ${nodeVersion}
║ 💎 *CPU* : ${cpuModel}
║ ⚙️  *Cores* : ${coreCount}  📊 *Load* : ${cpuUsage}

║ 📦 *RAM Total* : ${formatp(totalMem)}
║ 🔴 *RAM Used* : ${formatp(usedMem)}
║ 🟢 *RAM Free* : ${formatp(freeMem)}${storageText ?`


║ 💿 *Storage*
${storageText.replace(/\*STORAGE\*\n/,'').replace(/• /g,'║ ')}` : ''}

║ _⚡ Powered by ${global.ownername || 'Juice v12'}_
╚═══════════════════════╝`
    return responseText.trim()
}

if (command === 'ping' || command === 'p') {
    const _t = Date.now()
    const _sent = await X.sendMessage(m.chat, { text: `╔══════〔 🏓 PING 〕══════╗\n║ Measuring...\n╚═══════════════════════╝` }, { quoted: m })
    const _ms = Date.now() - _t
    const _rating = _ms < 200 ? '🟢 Fast' : _ms < 600 ? '🟡 Normal' : '🔴 Slow'
    const _ram = process.memoryUsage()
    const _ramUsed = (_ram.rss / 1024 / 1024).toFixed(1)
    const _pingText = `╔══════〔 🏓 PING 〕══════╗\n║ 📡 Speed   : ${_ms}ms\n║ ${_rating}\n║ ⏱️  Uptime  : ${runtime(process.uptime())}\n║ 💾 RAM     : ${_ramUsed} MB\n╚${'═'.repeat(23)}╝`
    await X.sendMessage(m.chat, { text: _pingText, edit: _sent.key })
} else {
  const responseText = await getServerInfo()
  await X.sendMessage(m.chat, { text: responseText }, { quoted: m })
}
}
break           

case 'totalfitur':{
reply(`╔══〔 📋 TOTAL COMMANDS 〕══╗\n\n║ *${totalfitur()}* commands available\n╚═══════════════════════╝`)
}
break   

case 'getcmd': {
  await X.sendMessage(m.chat, { react: { text: '🔍', key: m.key } })
  if (!text) return reply(`╔══〔 🔍 GET COMMAND CODE 〕══╗\n\n║ Usage: *${prefix}getcmd [command]*\n║ Example: *${prefix}getcmd play*\n\n║ Returns the real source code for that command.\n╚═══════════════════════╝`)
  const _q = text.trim().toLowerCase().replace(/^\./, '')
  try {
    const _src = fs.readFileSync(__filename, 'utf8')
    const _lines = _src.split('\n')
    // Find the case line — matches  case 'cmd':  or  case "cmd":
    const _caseRe = new RegExp(`^\\s*case\\s+['"]${_q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}['"]\\s*[:{]?`)
    let _startLine = -1
    for (let _i = 0; _i < _lines.length; _i++) {
      if (_caseRe.test(_lines[_i])) { _startLine = _i; break }
    }
    if (_startLine === -1) {
      return reply(`╔═══〔 🔍 NOT FOUND 〕════╗\n\n║ ❌  No case block found for *${_q}*\n║ Check spelling or try ${prefix}menu\n╚═══════════════════════╝`)
    }
    // Walk forward tracking brace depth; stop at top-level  break
    let _depth = 0, _endLine = _lines.length - 1
    for (let _i = _startLine; _i < _lines.length; _i++) {
      for (const _ch of _lines[_i]) {
        if (_ch === '{') _depth++
        else if (_ch === '}') _depth--
      }
      if (_i > _startLine && _depth <= 0 && /^\s*break\b/.test(_lines[_i])) {
        _endLine = _i; break
      }
    }
    let _block = _lines.slice(_startLine, _endLine + 1).join('\n').trimEnd()
    const _totalLines = _endLine - _startLine + 1
    const _MAX_CHARS = 60000
    let _truncNote = ''
    if (_block.length > _MAX_CHARS) {
      _block = _block.slice(0, _MAX_CHARS)
      _block = _block.slice(0, _block.lastIndexOf('\n'))
      _truncNote = `\n\n║ ⚠️ Output truncated — ${_totalLines} lines total`
    }
    reply(`\n${_block}\n${_truncNote}`)
  } catch (_gcErr) {
    reply(`❌ Could not read source: ${_gcErr.message}`)
  }
} break

//━━━━━━━━━━━━━━━━━━━━━━━━//
// OWNER MENU COMMANDS
// autotyping handled above (case 'autotyping'/'faketyping'/'faketype'/'ftype')

case 'autoreact': {
    await X.sendMessage(m.chat, { react: { text: '👍', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let arArg = (args[0] || '').toLowerCase()
if (!arArg) { reply(`╔══〔 ❤️ AUTO REACT 〕══════╗\n║ 📊 *Status* : ${global.autoReact ? '✅ ON' : '❌ OFF'}\n║ 🎭 *Emoji* : ${global.autoReactEmoji || '👍'}\n╠══〔 📋 USAGE 〕══════════╣\n║ ${prefix}autoreact on/off\n║ ${prefix}autoreact [emoji]\n╚═══════════════════════╝`) }
else if (arArg === 'on') { global.autoReact = true; reply('╔══〔 😊 AUTO REACT 〕══╗\n\n║ Status: ✅ ON\n╚═══════════════════════╝') }
else if (arArg === 'off') { global.autoReact = false; reply('╔══〔 😊 AUTO REACT 〕══╗\n\n║ Status: ❌ OFF\n╚═══════════════════════╝') }
else { global.autoReact = true; global.autoReactEmoji = arArg; reply(`✅ *Auto React ON* : emoji: ${arArg}`) }
} break

case 'pmblocker': {
    await X.sendMessage(m.chat, { react: { text: '🚫', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let pbArg = (args[0] || '').toLowerCase()
if (pbArg === 'on') { global.pmBlocker = true; reply('╔══〔 🛡️ PM BLOCKER 〕══╗\n\n║ Status: ✅ ON\n║ Non-owner PMs will be blocked.\n╚═══════════════════════╝') }
else if (pbArg === 'off') { global.pmBlocker = false; reply('╔══〔 🛡️ PM BLOCKER 〕══╗\n\n║ Status: ❌ OFF\n╚═══════════════════════╝') }
else reply(`╔══〔 🚫 PM BLOCKER 〕═════╗\n║ 📊 *Status* : ${global.pmBlocker ? '✅ ON' : '❌ OFF'}\n║ Usage: *${prefix}pmblocker on/off*\n╚═══════════════════════╝`)
} break

case 'block': {
      await X.sendMessage(m.chat, { react: { text: '🚫', key: m.key } })
      if (!isOwner) return reply(mess.OnlyOwner)
      const _normJ = (j) => (j || '').split(':')[0].split('@')[0]
      const _blkIsPhone = text && /^\d{6,15}$/.test(text.replace(/[^0-9]/g, ''))
      let _blkRaw = _blkIsPhone
          ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net'
          : (m.mentionedJid && m.mentionedJid[0])
              ? m.mentionedJid[0]
              : m.quoted ? (m.quoted.sender || m.quoted.key?.participant)
              : null
      if (!_blkRaw) return reply(`╔═══〔 🚫 BLOCK USER 〕═══╗\n\n║ ❌ *No target!*\n║ Tag a user, reply to their message,\n║ or provide their number.\n\n║ 📌 *Usage:* ${prefix}block @user | number\n╚═══════════════════════╝`)
      // If LID → try resolving to real JID via contacts/participants
      if (_blkRaw.endsWith('@lid')) {
          const _lidKey = _normJ(_blkRaw)
          let _res = null
          if (!_res && m.isGroup && participants) {
              const p = participants.find(p => p.id && !p.id.endsWith('@lid') && p.lid && _normJ(p.lid) === _lidKey)
              if (p) _res = p.id
          }
          if (!_res && store?.contacts) {
              for (const [jid, c] of Object.entries(store.contacts)) {
                  if (jid.endsWith('@s.whatsapp.net') && c?.lid && _normJ(c.lid) === _lidKey) { _res = jid; break }
                  if (jid.endsWith('@lid') && _normJ(jid) === _lidKey && c?.phone) { _res = c.phone.replace(/[^0-9]/g,'') + '@s.whatsapp.net'; break }
              }
          }
          if (!_res && m.quoted?.id) {
              try {
                  const _qm = await store.loadMessage(m.chat, m.quoted.id, X)
                  const _rp = _qm?.key?.participant || _qm?.participant
                  if (_rp && !_rp.endsWith('@lid')) _res = _rp
              } catch {}
          }
          if (_res) _blkRaw = _res
          else return reply(`❌ Cannot identify this user's number.\nUse: ${prefix}block 254xxxxxxxxx`)
      }
      const _blkPhone = _normJ(_blkRaw)
      if (ownerNums.some(o => _blkPhone === o) || _blkPhone === botNum) return reply('🛡️ Cannot block the bot owner.')
      // Query WhatsApp for this number to get the correct JID and LID
      let _blkJid = _blkPhone + '@s.whatsapp.net'
      let _blkLid = null
      try {
          const _wa = await X.onWhatsApp(_blkPhone)
          if (_wa && _wa[0]) { _blkJid = _wa[0].jid || _blkJid; _blkLid = _wa[0].lid || null }
      } catch {}
      // Fetch current blocklist
    let _currentBL = []
    try { _currentBL = await X.fetchBlocklist() } catch {}
    const _alreadyBlocked = _currentBL.some(j => j.includes(_blkPhone) || (_blkLid && j.includes(_blkLid.split('@')[0])))
    if (_alreadyBlocked) return reply(`╔═══〔 🚫 BLOCK USER 〕══╗\n\n║ ⚠️ Already blocked\n║ +${_blkPhone} is already on your block list.\n╚═══════════════════════╝`)
    const _blkJidToUse = _blkLid || _blkJid
    let _blkOk = false, _blkLastErr = ''
    // Strategy 1: wrap item in <list> node (matches fetchBlocklist response format)
    try {
        await X.query({ tag: 'iq', attrs: { xmlns: 'blocklist', to: 's.whatsapp.net', type: 'set' }, content: [{ tag: 'list', attrs: {}, content: [{ tag: 'item', attrs: { action: 'block', jid: _blkJidToUse } }] }] })
        _blkOk = true
    } catch(e) { _blkLastErr = 'list+lid:' + e.message }
    // Strategy 2: same but with real JID
    if (!_blkOk) { try {
        await X.query({ tag: 'iq', attrs: { xmlns: 'blocklist', to: 's.whatsapp.net', type: 'set' }, content: [{ tag: 'list', attrs: {}, content: [{ tag: 'item', attrs: { action: 'block', jid: _blkJid } }] }] })
        _blkOk = true
    } catch(e) { _blkLastErr += ' | list+jid:' + e.message } }
    // Strategy 3: original updateBlockStatus
    if (!_blkOk) { try { await X.updateBlockStatus(_blkJidToUse, 'block'); _blkOk = true } catch(e) { _blkLastErr += ' | ubs:' + e.message } }
    if (_blkOk) {
        reply(`╔═══〔 🚫 BLOCK USER 〕═══╗\n\n║ ✅ *Blocked*\n║ +${_blkPhone} has been blocked.\n╚═══════════════════════╝`)
    } else {
        reply(`❌ debug: ${_blkLastErr}`)
    }
  } break

case 'unblock': {
      await X.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
      if (!isOwner) return reply(mess.OnlyOwner)
      const _normU = (j) => (j || '').split(':')[0].split('@')[0]
      const _ublkIsPhone = text && /^\d{6,15}$/.test(text.replace(/[^0-9]/g, ''))
      let _ublkRaw = _ublkIsPhone
          ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net'
          : (m.mentionedJid && m.mentionedJid[0])
              ? m.mentionedJid[0]
              : m.quoted ? (m.quoted.sender || m.quoted.key?.participant)
              : null
      if (!_ublkRaw) return reply(`╔══〔 ✅ UNBLOCK USER 〕═══╗\n\n║ ❌ *No target!*\n║ Tag a user, reply to their message,\n║ or provide their number.\n\n║ 📌 *Usage:* ${prefix}unblock @user | number\n╚═══════════════════════╝`)
      if (_ublkRaw.endsWith('@lid')) {
          const _lidKey = _normU(_ublkRaw)
          let _res = null
          if (!_res && m.isGroup && participants) {
              const p = participants.find(p => p.id && !p.id.endsWith('@lid') && p.lid && _normU(p.lid) === _lidKey)
              if (p) _res = p.id
          }
          if (!_res && store?.contacts) {
              for (const [jid, c] of Object.entries(store.contacts)) {
                  if (jid.endsWith('@s.whatsapp.net') && c?.lid && _normU(c.lid) === _lidKey) { _res = jid; break }
                  if (jid.endsWith('@lid') && _normU(jid) === _lidKey && c?.phone) { _res = c.phone.replace(/[^0-9]/g,'') + '@s.whatsapp.net'; break }
              }
          }
          if (!_res && m.quoted?.id) {
              try {
                  const _qm = await store.loadMessage(m.chat, m.quoted.id, X)
                  const _rp = _qm?.key?.participant || _qm?.participant
                  if (_rp && !_rp.endsWith('@lid')) _res = _rp
              } catch {}
          }
          if (_res) _ublkRaw = _res
          else return reply(`❌ Cannot identify this user's number.\nUse: ${prefix}unblock 254xxxxxxxxx`)
      }
      const _ublkPhone = _normU(_ublkRaw)
      let _ublkJid = _ublkPhone + '@s.whatsapp.net'
      let _ublkLid = null
      try {
          const _wa = await X.onWhatsApp(_ublkPhone)
          if (_wa && _wa[0]) { _ublkJid = _wa[0].jid || _ublkJid; _ublkLid = _wa[0].lid || null }
      } catch {}
      let _ublkOk = false
      if (_ublkLid) { try { await X.updateBlockStatus(_ublkLid, 'unblock'); _ublkOk = true } catch {} }
      if (!_ublkOk) { try { await X.updateBlockStatus(_ublkJid, 'unblock'); _ublkOk = true } catch {} }
      if (_ublkOk) {
          reply(`╔══〔 ✅ UNBLOCK USER 〕═══╗\n\n║ ✅ *Unblocked*\n║ +${_ublkPhone} has been unblocked.\n╚═══════════════════════╝`)
      } else {
          reply(`❌ Failed to unblock +${_ublkPhone}.\nTry: ${prefix}unblock 254xxxxxxxxx with their number.`)
      }
  } break

case 'blocklist': {
    await X.sendMessage(m.chat, { react: { text: '📋', key: m.key } })
    if (!isOwner) return reply(mess.OnlyOwner)
    try {
        const _blist = await X.fetchBlocklist()
        if (!_blist || !_blist.length) return reply(`╔═══〔 📋 BLOCK LIST 〕═══╗\n\n║ ✅ No blocked contacts.\n╚═══════════════════════╝`)
        const _blines = _blist.map((j, idx) => `  ${idx + 1}. +${j.split('@')[0]}`).join('\n')
        reply(`╔═══〔 📋 BLOCK LIST 〕═══╗\n\n║ Total: ${_blist.length} blocked\n\n${_blines}\n╚═══════════════════════╝`)
    } catch (e) {
        reply('❌ Failed to fetch block list: ' + (e.message || 'Unknown error'))
    }
} break

case 'pp':
case 'getpp': {
    await X.sendMessage(m.chat, { react: { text: '🖼️', key: m.key } })
// Get profile picture of sender, mentioned user, quoted user, or bot itself
try {
let target, label
// Resolve JID to real phone number — handles normal JIDs and Baileys LID JIDs
const _ppNum = (jid) => {
    if (!jid) return null
    const raw = jid.split('@')[0].split(':')[0]
    if (raw.length > 15) return null  // LID — not a real phone number
    return '+' + raw
}
const _ppLabel = async (jid) => {
    if (!jid) return 'Unknown'
    const isLid = jid.endsWith('@lid')
    if (isLid) {
        const lidNum = jid.split('@')[0]
        // TIER 1: resolve via group participant list — match on p.lid (correct field)
        try {
            if (m.isGroup && participants) {
                const match = participants.find(p =>
                    (p.lid && p.lid.split('@')[0] === lidNum) ||
                    (p.id && !p.id.endsWith('@lid') && p.id.split('@')[0] === lidNum)
                )
                if (match && match.id && !match.id.endsWith('@lid')) {
                    const resolvedJid = match.id
                    const num = '+' + resolvedJid.split('@')[0]
                    const sc = store?.contacts?.[resolvedJid]
                    const sn = sc?.name || sc?.notify || sc?.verifiedName
                    return sn ? `${sn} (${num})` : num
                }
            }
        } catch {}
        // TIER 2: store.contacts keyed by LID directly
        const lidSc = store?.contacts?.[jid]
        if (lidSc) {
            const sn = lidSc?.name || lidSc?.notify || lidSc?.verifiedName
            const num = _ppNum(lidSc?.id || '')
            if (sn && num) return `${sn} (${num})`
            if (sn) return sn
            if (num) return num
        }
        // TIER 3: scan store.contacts for a contact whose .lid matches
        if (store?.contacts) {
            for (const [cjid, c] of Object.entries(store.contacts)) {
                if (c?.lid && c.lid.split('@')[0] === lidNum) {
                    const num = '+' + cjid.split('@')[0]
                    const sn = c?.name || c?.notify || c?.verifiedName
                    return sn ? `${sn} (${num})` : num
                }
            }
        }
        // TIER 4: unresolvable LID — we have no phone number
        return 'Unsaved Contact'
    }
    // Non-LID JID — phone number is always extractable
    const num = _ppNum(jid)
    const sc = store?.contacts?.[jid]
    const storeName = sc?.name || sc?.notify || sc?.verifiedName
    if (storeName) return num ? `${storeName} (${num})` : storeName
    // Fallback: use pushName from the message if this is the sender
    if (jid === m.sender && m.pushName) return num ? `${m.pushName} (${num})` : m.pushName
    return num || 'Unsaved Contact'
}
// Resolve LID JID to real phone JID before fetching profile picture
const _resolveTarget = (jid) => {
    if (!jid) return null
    if (jid.endsWith('@lid') && m.isGroup && participants) {
        const lidNum = jid.split('@')[0]
        const real = participants.find(p =>
            p.id && !p.id.endsWith('@lid') && p.lid && p.lid.split('@')[0] === lidNum
        )
        if (real) return real.id
    }
    return jid
}
if (m.mentionedJid && m.mentionedJid[0]) {
    target = _resolveTarget(m.mentionedJid[0])
    label = await _ppLabel(target)
} else if (m.quoted) {
    const rawTarget = m.quoted.sender || m.quoted.participant || m.quoted.key?.participant
    target = _resolveTarget(rawTarget)
    label = target ? await _ppLabel(target) : 'Unknown'
} else if (text && /^[0-9]+$/.test(text.replace(/[^0-9]/g,''))) {
    target = text.replace(/[^0-9]/g,'') + '@s.whatsapp.net'
    label = await _ppLabel(target)
} else {
    target = m.sender
    label = await _ppLabel(target)
}
if (!target) target = m.sender
let ppUrl = null
try { ppUrl = await X.profilePictureUrl(target, 'image') } catch {}
if (!ppUrl) {
    return reply(`╔══〔 🖼️  PROFILE PICTURE 〕══╗\n\n║ ❌ *No profile picture for ${label}*\n║ _Privacy restrictions or not on WhatsApp._\n╚═══════════════════════╝`)
}
let ppBuf = await getBuffer(ppUrl)
if (!ppBuf || ppBuf.length < 100) throw new Error('Failed to download picture')
await X.sendMessage(m.chat, {
    image: ppBuf,
    caption: `╔══〔 🖼️  PROFILE PICTURE 〕══╗\n\n║ 👤 *User* : ${label}\n╚═══════════════════════╝`
}, { quoted: m })
} catch(e) {
reply(`❌ *Failed to fetch profile picture.*
_${e.message || 'User may have privacy restrictions.'}_`)
}
} break

case 'setpp': {
    await X.sendMessage(m.chat, { react: { text: '🖼️', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
if (!m.quoted || !/image/.test(m.quoted.mimetype || '')) return reply(`╔══〔 🖼️  SET BOT PROFILE PIC 〕══╗\n\n║ Reply to an image with *${prefix}setpp*\n║ _Image will be set as the bot profile picture._\n╚═══════════════════════╝`)
try {
let imgBuf = await m.quoted.download()
if (!imgBuf || imgBuf.length < 100) throw new Error('Failed to download image')
await X.updateProfilePicture(X.user.id, imgBuf)
reply(`╔══〔 🖼️  PROFILE PIC UPDATED 〕══╗\n\n║ ✅ Bot profile picture updated successfully.\n║ _Changes may take a moment to appear._\n╚═══════════════════════╝`)
} catch(e) {
let errMsg = (e?.message || '').toLowerCase()
if (errMsg.includes('not-authorized') || errMsg.includes('403')) reply(mess.botAdmin)
else reply(`❌ *Failed to update profile picture.*
_${e.message || 'Unknown error'}_`)
}
} break

case 'clearsession': {
    await X.sendMessage(m.chat, { react: { text: '🗑️', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
try {
const sessPath = path.join(__dirname, 'sessions')
if (fs.existsSync(sessPath)) {
let files = fs.readdirSync(sessPath).filter(f => f !== 'creds.json' && !f.includes('creds'))
let count = 0
for (let f of files) { try { fs.unlinkSync(path.join(sessPath, f)); count++ } catch {} }
reply(`✅ *${count} session files* cleared.`)
} else reply('╔══〔 ⚠️ SESSION 〕══╗\n\n║ No sessions directory found.\n╚═══════════════════════╝')
} catch(e) { reply('Error: ' + e.message) }
} break

case 'cleartmp': {
    await X.sendMessage(m.chat, { react: { text: '🗑️', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
try {
const tmpPath = path.join(__dirname, 'tmp')
if (fs.existsSync(tmpPath)) {
let files = fs.readdirSync(tmpPath)
for (let f of files) { try { fs.unlinkSync(path.join(tmpPath, f)) } catch {} }
reply(`✅ *${files.length} temp files* cleared.`)
} else reply('╔══〔 ⚠️ TEMP DIR 〕══╗\n\n║ No tmp directory found.\n╚═══════════════════════╝')
} catch(e) { reply('Error: ' + e.message) }
} break

case 'sudo': {
    await X.sendMessage(m.chat, { react: { text: '🛡️', key: m.key } })
    if (!isOwner) return reply(mess.OnlyOwner)
    const _sdPath = require('path').join(__dirname, 'database', 'sudoUsers.json')
    const _sdRead = () => { try { return JSON.parse(fs.readFileSync(_sdPath, 'utf-8')) } catch { return [] } }
    const _sdWrite = d => { fs.mkdirSync(require('path').join(__dirname, 'database'), { recursive: true }); fs.writeFileSync(_sdPath, JSON.stringify(d, null, 2)) }
    const _sdAction = (args[0] || '').toLowerCase()

    // .sudo list / .sudo (no args)
    if (!_sdAction || _sdAction === 'list') {
        let _sdList = _sdRead()
        if (!_sdList.length) return reply(`╔══〔 🛡️ SUDO USERS 〕════╗\n\n║ _No sudo users added yet._\n║ ${prefix}sudo add @user\n╚═══════════════════════╝`)
        await X.sendMessage(m.chat, {
            text: `╔══〔 🛡️ SUDO USERS 〕════╗\n\n${_sdList.map((u,i) => `  ${i+1}. @${u.split('@')[0]}`).join('\n')}\n\n║ _Total: ${_sdList.length} user(s)_\n╚═══════════════════════╝`,
            mentions: _sdList
        }, { quoted: m })

    // .sudo add @user / .sudo add 254xxx
    } else if (_sdAction === 'add') {
        let _sdTarget = (m.mentionedJid && m.mentionedJid[0])
            || (m.quoted && m.quoted.sender)
            || (args[1] && args[1].replace(/\D/g,'') + '@s.whatsapp.net')
        if (!_sdTarget || _sdTarget === '@s.whatsapp.net') return reply(`╔══〔 🛡️ ADD SUDO 〕══════╗\n\n║ Usage: *${prefix}sudo add @user*\n║ Or: *${prefix}sudo add 254xxxxxxx*\n║ Or reply to a message\n╚═══════════════════════╝`)
        let _sdList = _sdRead()
        if (_sdList.includes(_sdTarget)) return reply(`⚠️ @${_sdTarget.split('@')[0]} is already a sudo user.`)
        _sdList.push(_sdTarget)
        _sdWrite(_sdList)
        await X.sendMessage(m.chat, { text: `╔══〔 ✅ SUDO ADDED 〕════╗\n\n║ 🛡️ @${_sdTarget.split('@')[0]} is now a *sudo user*!\n║ Total sudo users: ${_sdList.length}\n╚═══════════════════════╝`, mentions: [_sdTarget] }, { quoted: m })

    // .sudo remove / .sudo del @user
    } else if (_sdAction === 'remove' || _sdAction === 'del') {
        let _sdTarget = (m.mentionedJid && m.mentionedJid[0])
            || (m.quoted && m.quoted.sender)
            || (args[1] && args[1].replace(/\D/g,'') + '@s.whatsapp.net')
        if (!_sdTarget || _sdTarget === '@s.whatsapp.net') return reply(`╔══〔 🔓 REMOVE SUDO 〕═══╗\n\n║ Usage: *${prefix}sudo remove @user*\n║ Or: *${prefix}sudo remove 254xxxxxxx*\n║ Or reply to a message\n╚═══════════════════════╝`)
        let _sdList = _sdRead()
        const _sdIdx = _sdList.indexOf(_sdTarget)
        if (_sdIdx === -1) return reply(`⚠️ @${_sdTarget.split('@')[0]} is not a sudo user.`)
        _sdList.splice(_sdIdx, 1)
        _sdWrite(_sdList)
        await X.sendMessage(m.chat, { text: `╔══〔 🔓 SUDO REMOVED 〕══╗\n\n║ @${_sdTarget.split('@')[0]} removed from *sudo*!\n║ Total sudo users: ${_sdList.length}\n╚═══════════════════════╝`, mentions: [_sdTarget] }, { quoted: m })

    } else {
        reply(`╔══〔 🛡️ SUDO MANAGER 〕══╗\n\n║ ${prefix}sudo           — list all sudo users\n║ ${prefix}sudo add @user  — grant sudo access\n║ ${prefix}sudo remove @user — revoke sudo access\n╠══〔 💡 TIPS 〕═══════════╣\n║ You can @mention, reply to a\n║ message, or use the number directly.\n╚═══════════════════════╝`)
    }
} break

case 'setowner': {
    await X.sendMessage(m.chat, { react: { text: '👑', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let newOwner = (args[0] || '').replace(/[^0-9]/g, '')
if (!newOwner) return reply(`╔═══〔 👑 SET OWNER 〕════╗\n\n║ Current: *${global.ownerNumber}*\n║ Usage: *${prefix}setowner [number]*\n╚═══════════════════════╝`)
global.ownerNumber = newOwner
if (!global.owner.includes(newOwner)) global.owner.push(newOwner)
reply(`✅ *Owner updated* : ${newOwner}`)
} break

case 'setmenu': {
    await X.sendMessage(m.chat, { react: { text: '🎨', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
reply('*Menu Categories:*\nai, tools, owner, group, downloader, search, sticker, games, other, fun, anime, textmaker, imgedit, github, converter\n\nUse .menu [category] to view specific menus.')
} break

case 'menuimage': {
    await X.sendMessage(m.chat, { react: { text: '🖼️', key: m.key } })
    if (!isOwner) return reply(mess.OnlyOwner)
    if (m.quoted && /image/.test(mime)) {
        try {
            const _miBuf = await quoted.download()
            if (!_miBuf || _miBuf.length < 100) throw new Error('Failed to download image')
            const _miPath = path.join(__dirname, 'media', 'menu_thumb.jpg')
            fs.writeFileSync(_miPath, _miBuf)
            global.menuThumb = _miPath
            reply('✅ *Menu image updated!* It will now show in .menu')
        } catch(e) { reply('❌ Error: ' + e.message) }
    } else if (args[0]) {
        global.menuThumb = args[0]
        reply(`✅ *Menu image URL set.*`)
    } else reply(`Reply to an image or provide URL: ${prefix}menuimage [url]`)
} break

case 'configimage': {
    await X.sendMessage(m.chat, { react: { text: '🖼️', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
reply(`╔══〔 🖼️ IMAGE CONFIG 〕═══╗\n║ 🖼️ *Menu Thumb* : ${global.menuThumb || global.thumb}\n║ 🤖 *Bot Pic* : ${global.botPic || 'Default'}\n╠══〔 📋 USAGE 〕══════════╣\n║ ${prefix}menuimage — change menu image\n║ ${prefix}botpic    — change bot picture\n╚═══════════════════════╝`)
} break

case 'mode': {
    await X.sendMessage(m.chat, { react: { text: '⚙️', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let modeArg = (args[0] || '').toLowerCase()
if (modeArg === 'public') {
    X.public = true
    reply(`╔══〔 🌐 BOT MODE: PUBLIC 〕══╗\n\n║ ✅ Everyone can use bot commands.\n╚═══════════════════════╝`)
} else if (modeArg === 'private' || modeArg === 'self') {
    X.public = false
    reply(`╔══〔 🔒 BOT MODE: PRIVATE 〕══╗\n\n║ 🚫 Only the owner can use commands.\n╚═══════════════════════╝`)
} else {
    let currentMode = X.public !== false ? 'PUBLIC ✅' : 'PRIVATE 🔒'
    reply(`╔═══〔 ⚙️  BOT MODE 〕════╗\n\n║ 📊 *Current* : ${currentMode}\n║ ${prefix}mode public  — all users\n║ ${prefix}mode private — owner only\n╚═══════════════════════╝`)
}
} break

// GROUP ADMIN COMMANDS
case 'mute': {
    await X.sendMessage(m.chat, { react: { text: '🔇', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!isAdmins && !isOwner) return reply(mess.admin)
if (!isBotAdmins) return reply(mess.botAdmin)
try {
await X.groupSettingUpdate(m.chat, 'announcement')
reply('🔇 *Group muted.* Only admins can send messages.')
} catch(err) {
let errMsg = (err?.message || '').toLowerCase()
if (errMsg.includes('not-authorized') || errMsg.includes('403')) reply(mess.botAdmin)
else reply(mess.error)
}
} break

case 'unmute': {
    await X.sendMessage(m.chat, { react: { text: '🔊', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!isAdmins && !isOwner) return reply(mess.admin)
if (!isBotAdmins) return reply(mess.botAdmin)
try {
await X.groupSettingUpdate(m.chat, 'not_announcement')
reply('🔊 *Group unmuted.* Everyone can send messages.')
} catch(err) {
let errMsg = (err?.message || '').toLowerCase()
if (errMsg.includes('not-authorized') || errMsg.includes('403')) reply(mess.botAdmin)
else reply(mess.error)
}
} break

case 'ban': {
    await X.sendMessage(m.chat, { react: { text: '🚫', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!isAdmins && !isOwner) return reply(mess.admin)
let banUser = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : text ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null
if (!banUser) return reply(`╔════〔 🚫 BAN USER 〕════╗\n\n║ Usage: *${prefix}ban @user*\n╚═══════════════════════╝`)
let isBanOwner = owner.some(o => banUser.includes(o)) || (typeof X.areJidsSameUser === 'function' && owner.some(o => X.areJidsSameUser(banUser, o + '@s.whatsapp.net')))
if (isBanOwner) return reply('🛡️ Cannot ban the bot owner.')
let banUsers = loadUsers()
if (!banUsers[banUser]) banUsers[banUser] = { name: banUser.split('@')[0], firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(), commandCount: 0, commands: {} }
banUsers[banUser].banned = true
saveUsers(banUsers)
X.sendMessage(from, { text: `🚫 *@${banUser.split('@')[0]} has been banned from using the bot.*`, mentions: [banUser] }, { quoted: m })
} break

case 'unban': {
    await X.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!isAdmins && !isOwner) return reply(mess.admin)
let unbanUser = (m.mentionedJid && m.mentionedJid[0]) ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : text ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null
if (!unbanUser) return reply(`╔═══〔 ✅ UNBAN USER 〕════╗\n\n║ Usage: *${prefix}unban @user*\n╚═══════════════════════╝`)
let usersDb = loadUsers()
if (usersDb[unbanUser]) { usersDb[unbanUser].banned = false; saveUsers(usersDb) }
X.sendMessage(from, { text: `✅ *@${unbanUser.split('@')[0]} has been unbanned.*`, mentions: [unbanUser] }, { quoted: m })
} break

case 'antisocialgames':
case 'antisgames': {
    await X.sendMessage(m.chat, { react: { text: '🎭', key: m.key } })
    if (!m.isGroup) return reply(mess.OnlyGrup)
    if (!isAdmins && !isOwner) return reply(mess.admin)
    if (!global.antiSocialGames) global.antiSocialGames = {}
    const _asgArg = (args[0] || '').toLowerCase()
    if (!_asgArg || _asgArg === 'status') {
        const _on = global.antiSocialGames[m.chat] ? '✅ ON' : '❌ OFF'
        return reply(`╔══〔 🎭 ANTI SOCIAL GAMES 〕══╗\n\n║ 📊 *Status* : *${_on}*\n\n║ _When ON, blocks:_\n║ .vibe
║ .rizz
║ .iq\n║ .ship
║ .simp
║ .wasted\n║ .truth
║ .dare
║ .lolice\n\n║ _Removed offensive aliases:_\n║ .gay   (now .vibe)\n║ .horny (now .rizz)\n\n║ ${prefix}antisocialgames on\n║ ${prefix}antisocialgames off
╚═══════════════════════╝`)
    }
    if (_asgArg === 'on') {
        global.antiSocialGames[m.chat] = true
        return reply(`✅ *Anti Social Games ON*\n_Social game commands are now blocked in this group._`)
    }
    if (_asgArg === 'off') {
        global.antiSocialGames[m.chat] = false
        return reply(`❌ *Anti Social Games OFF*\n_Social game commands are now allowed._`)
    }
}
break

case 'antibadword': {
    await X.sendMessage(m.chat, { react: { text: '🤬', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!isAdmins && !isOwner) return reply(mess.admin)
let abwArg = (args[0] || '').toLowerCase()
if (abwArg === 'on') { global.antiBadword = true; reply('🛡️ *Anti Badword ON* — Bad words will be detected.') }
else if (abwArg === 'off') { global.antiBadword = false; reply('❌ *Anti Badword OFF*') }
else reply(`╔══〔 🛡️ ANTI BADWORD 〕══╗\n║ 📊 *Status* : ${global.antiBadword ? '✅ ON' : '❌ OFF'}\n║ Usage: *${prefix}antibadword on/off*\n╚═══════════════════════╝`)
} break

case 'antitag': {
    await X.sendMessage(m.chat, { react: { text: '🏷️', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!isAdmins && !isOwner) return reply(mess.admin)
let atgArg = (args[0] || '').toLowerCase()
if (atgArg === 'on') { global.antiTag = true; reply('🛡️ *Anti Tag ON* — Mass tagging will be detected.') }
else if (atgArg === 'off') { global.antiTag = false; reply('❌ *Anti Tag OFF*') }
else reply(`╔══〔 🏷️ ANTI TAG 〕══════╗\n║ 📊 *Status* : ${global.antiTag ? '✅ ON' : '❌ OFF'}\n║ Usage: *${prefix}antitag on/off*\n╚═══════════════════════╝`)
} break

case 'antisticker': {
    await X.sendMessage(m.chat, { react: { text: '🖼️', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!isAdmins && !isOwner) return reply(mess.admin)
let asArg = (args[0] || '').toLowerCase()
if (asArg === 'on') { global.antiSticker = true; reply('🛡️ *Anti Sticker ON* — Stickers will be deleted.') }
else if (asArg === 'off') { global.antiSticker = false; reply('❌ *Anti Sticker OFF*') }
else reply(`╔══〔 🖼️ ANTI STICKER 〕══╗\n║ 📊 *Status* : ${global.antiSticker ? '✅ ON' : '❌ OFF'}\n║ Usage: *${prefix}antisticker on/off*\n╚═══════════════════════╝`)
} break

case 'antidemote': {
    await X.sendMessage(m.chat, { react: { text: '⚠️', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!isAdmins && !isOwner) return reply(mess.admin)
let adArg2 = (args[0] || '').toLowerCase()
if (adArg2 === 'on') { global.antiDemote = true; reply('🛡️ *Anti Demote ON* — Demoted admins will be re-promoted.') }
else if (adArg2 === 'off') { global.antiDemote = false; reply('❌ *Anti Demote OFF*') }
else reply(`╔══〔 ⚠️ ANTI DEMOTE 〕═══╗\n║ 📊 *Status* : ${global.antiDemote ? '✅ ON' : '❌ OFF'}\n║ Usage: *${prefix}antidemote on/off*\n╚═══════════════════════╝`)
} break

case 'setgdesc': {
    await X.sendMessage(m.chat, { react: { text: '📝', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!isAdmins && !isOwner) return reply(mess.admin)
if (!isBotAdmins) return reply(mess.botAdmin)
if (!text) return reply(`╔══〔 ✏️ SET GROUP DESC 〕══╗\n\n║ Usage: *${prefix}setgdesc [description]*\n╚═══════════════════════╝`)
try {
await X.groupUpdateDescription(m.chat, text)
reply('✅ *Group description updated.*')
} catch(err) {
let errMsg = (err?.message || '').toLowerCase()
if (errMsg.includes('not-authorized') || errMsg.includes('403')) reply(mess.botAdmin)
else reply(mess.error)
}
} break

case 'setgname': {
    await X.sendMessage(m.chat, { react: { text: '✏️', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!isAdmins && !isOwner) return reply(mess.admin)
if (!isBotAdmins) return reply(mess.botAdmin)
if (!text) return reply(`╔══〔 ✏️  SET GROUP NAME 〕══╗\n\n║ *Usage:* ${prefix}setgname [new name]\n║ _Example: ${prefix}setgname My Awesome Group_\n╚═══════════════════════╝`)
try {
let oldName = groupName || 'Unknown'
await X.groupUpdateSubject(m.chat, text)
reply(`╔══〔 ✏️  GROUP NAME UPDATED 〕══╗\n\n║ 📛 *Old* : ${oldName}\n║ ✅ *New* : ${text}\n\n║ _Group name successfully changed._\n╚═══════════════════════╝`)
} catch(err) {
let errMsg = (err?.message || '').toLowerCase()
if (errMsg.includes('not-authorized') || errMsg.includes('403')) reply(mess.botAdmin)
else reply(`❌ *Failed to update group name.*\n_${err.message || 'Unknown error'}_`)
}
} break

case 'setgpp': {
    await X.sendMessage(m.chat, { react: { text: '🖼️', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!isAdmins && !isOwner) return reply(mess.admin)
if (!isBotAdmins) return reply(mess.botAdmin)
if (!m.quoted || !/image/.test(m.quoted.mimetype || '')) return reply(`╔══〔 🖼️  SET GROUP PHOTO 〕══╗\n\n║ Reply to an image with *${prefix}setgpp*\n║ _Image will be set as group profile picture._\n╚═══════════════════════╝`)
try {
let media = await m.quoted.download()
await X.updateProfilePicture(m.chat, media)
reply(`╔══〔 🖼️  GROUP PHOTO UPDATED 〕══╗\n\n║ ✅ *${groupName || 'Group'}* profile picture updated.\n╚═══════════════════════╝`)
} catch(err) {
let errMsg = (err?.message || '').toLowerCase()
if (errMsg.includes('not-authorized') || errMsg.includes('403')) reply(mess.botAdmin)
else reply(`❌ *Failed to update group photo.*\n_${err.message || 'Unknown error'}_`)
}
} break

case 'open': {
    await X.sendMessage(m.chat, { react: { text: '🔓', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!isAdmins && !isOwner) return reply(mess.admin)
if (!isBotAdmins) return reply(mess.botAdmin)
try {
await X.groupSettingUpdate(m.chat, 'not_announcement')
reply('🔓 *Group opened.* Everyone can send messages.')
} catch(err) {
let errMsg = (err?.message || '').toLowerCase()
if (errMsg.includes('not-authorized') || errMsg.includes('403')) reply(mess.botAdmin)
else reply(mess.error)
}
} break

case 'close': {
    await X.sendMessage(m.chat, { react: { text: '🔒', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!isAdmins && !isOwner) return reply(mess.admin)
if (!isBotAdmins) return reply(mess.botAdmin)
try {
await X.groupSettingUpdate(m.chat, 'announcement')
reply('🔐 *Group closed.* Only admins can send messages.')
} catch(err) {
let errMsg = (err?.message || '').toLowerCase()
if (errMsg.includes('not-authorized') || errMsg.includes('403')) reply(mess.botAdmin)
else reply(mess.error)
}
} break

case 'resetlink': {
    await X.sendMessage(m.chat, { react: { text: '🔄', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!isAdmins && !isOwner) return reply(mess.admin)
if (!isBotAdmins) return reply(mess.botAdmin)
try {
await X.groupRevokeInvite(m.chat)
let newCode = await X.groupInviteCode(m.chat)
reply(`╔══〔 🔄 GROUP LINK RESET 〕══╗\n\n║ ✅ Old link revoked, new link generated.\n\n║ 🔗 https://chat.whatsapp.com/${newCode}\n\n║ _Share to invite new members._\n╚═══════════════════════╝`)
} catch(err) {
let errMsg = (err?.message || '').toLowerCase()
if (errMsg.includes('not-authorized') || errMsg.includes('403')) reply(mess.botAdmin)
else reply(`❌ *Failed to reset group link.*\n_${err.message || 'Unknown error'}_`)
}
} break

case 'link': {
    await X.sendMessage(m.chat, { react: { text: '🔗', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!isAdmins && !isOwner) return reply(mess.admin)
if (!isBotAdmins) return reply(mess.botAdmin)
try {
let code = await X.groupInviteCode(m.chat)
let memberCount = participants.length
reply(`╔══〔 🔗 GROUP INVITE LINK 〕══╗\n\n║ 🏘️  *Group* : ${groupName || 'This Group'}\n║ 👥 *Members* : ${memberCount}\n\n║ 🔗 https://chat.whatsapp.com/${code}\n\n║ _Use ${prefix}resetlink to revoke & regenerate._\n╚═══════════════════════╝`)
} catch(err) {
let errMsg = (err?.message || '').toLowerCase()
if (errMsg.includes('not-authorized') || errMsg.includes('403')) reply(mess.botAdmin)
else reply(`❌ *Failed to get group link.*\n_${err.message || 'Unknown error'}_`)
}
} break

case 'goodbye': {
    await X.sendMessage(m.chat, { react: { text: '👋', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!isAdmins && !isOwner) return reply(mess.admin)
let gbArg = (args[0] || '').toLowerCase()
if (gbArg === 'on') {
    global.goodbye = true
    reply(`╔══〔 👋 GOODBYE MESSAGES 〕══╗\n\n║ ✅ *Enabled in ${groupName || 'this group'}*\n║ _Bot will farewell departing members._\n╚═══════════════════════╝`)
} else if (gbArg === 'off') {
    global.goodbye = false
    reply(`╔══〔 👋 GOODBYE MESSAGES 〕══╗\n\n║ ❌ *Disabled in ${groupName || 'this group'}*\n║ _Goodbye messages turned off._\n╚═══════════════════════╝`)
} else {
    let gbState = (global.goodbye ?? global.welcome) ? '✅ ON' : '❌ OFF'
    reply(`╔══〔 👋 GOODBYE MESSAGES 〕══╗\n\n║ 📊 *Status* : ${gbState}\n║ Farewells departing members\n\n║ ${prefix}goodbye on  — Enable\n║ ${prefix}goodbye off — Disable\n╚═══════════════════════╝`)
}
} break

// GROUP TOOLS COMMANDS
case 'everyone':
case 'all':
case 'tageveryone':
case 'mentionall':
case 'tagall': {
    await X.sendMessage(m.chat, { react: { text: '📢', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!isAdmins && !isOwner) return reply(mess.admin)
let tagMsg = text || '📢 Tag All Members'
let tagText = `*${tagMsg}*\n\n`
let mentions = []
for (let mem of participants) { if (!mem.id.endsWith('@newsletter')) { tagText += `• @${mem.id.split('@')[0]}\n`; mentions.push(mem.id) } }
X.sendMessage(from, { text: tagText, mentions }, { quoted: m })
} break

case 'tag': {
    await X.sendMessage(m.chat, { react: { text: '📢', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!text) return reply(`╔════〔 📣 TAG ALL 〕═════╗\n\n║ Usage: *${prefix}tag [message]*\n╚═══════════════════════╝`)
let tagMentions = participants.map(p => p.id).filter(id => !id.endsWith('@newsletter'))
X.sendMessage(from, { text: text, mentions: tagMentions }, { quoted: m })
} break

case 'hidetag': {
    await X.sendMessage(m.chat, { react: { text: '🏷️', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!isAdmins && !isOwner) return reply(mess.admin)
let htText = text || '​'  // zero-width space: invisible but non-empty, bypasses empty guard
let htMentions = participants.map(p => p.id).filter(id => !id.endsWith('@newsletter'))
X.sendMessage(from, { text: htText, mentions: htMentions }, { quoted: m })
} break

case 'tagnoadmin': {
    await X.sendMessage(m.chat, { react: { text: '📢', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!isAdmins && !isOwner) return reply(mess.admin)
let nonAdmins = participants.filter(p => !p.admin && !p.id.endsWith('@newsletter')).map(p => p.id)
let tnaText = `📢 *${text || 'Attention non-admins!'}*\n\n`
nonAdmins.forEach(id => tnaText += `• @${id.split('@')[0]}\n`)
X.sendMessage(from, { text: tnaText, mentions: nonAdmins }, { quoted: m })
} break

case 'hiall':
case 'hiko':
case 'mention': {
    await X.sendMessage(m.chat, { react: { text: '📢', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!text) return reply(`╔══〔 📢 MENTION ALL 〕═══╗\n\n║ Usage: *${prefix}mention [message]*\n╚═══════════════════════╝`)
let mentionIds = participants.map(p => p.id).filter(id => !id.endsWith('@newsletter'))
X.sendMessage(from, { text: text, mentions: mentionIds }, { quoted: m })
} break

case 'groupinfo': {
    await X.sendMessage(m.chat, { react: { text: '📊', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
let gInfo = `*Group Info*\n\n`
gInfo += `Name: ${groupMetadata.subject}\n`
gInfo += `ID: ${m.chat}\n`
gInfo += `Created: ${new Date(groupMetadata.creation * 1000).toLocaleDateString()}\n`
gInfo += `Members: ${participants.length}\n`
gInfo += `Admins: ${groupAdmins.length}\n`
gInfo += `Description: ${groupMetadata.desc || 'None'}\n`
reply(gInfo)
} break

case 'vcf': {
    await X.sendMessage(m.chat, { react: { text: '📋', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
try {
    const freshMeta = await X.groupMetadata(m.chat)
    if (!freshMeta || !freshMeta.participants || !freshMeta.participants.length)
        return reply('❌ Could not fetch group members. Try again.')

    const totalParticipants = freshMeta.participants.length
    const seen    = new Set()  // dedup by phone number
    const contacts = new Map() // phone → name

    // ── TIER 1: participants with real @s.whatsapp.net / @c.us JIDs ──────────
    for (const p of freshMeta.participants) {
        if (!p.id) continue
        if (p.id.endsWith('@s.whatsapp.net') || p.id.endsWith('@c.us')) {
            const num = p.id.split('@')[0].split(':')[0]
            if (!/^\d{5,15}$/.test(num) || seen.has(num)) continue
            seen.add(num)
            const sc = store?.contacts?.[p.id] || store?.contacts?.[num + '@s.whatsapp.net']
            const name = sc?.name || sc?.notify || sc?.verifiedName || `+${num}`
            contacts.set(num, name)
        }
    }

    // ── TIER 2: @lid participants — reverse-map via store.contacts ────────────
    // Baileys sometimes stores contacts by @s.whatsapp.net with a .lid field
    const lidToPhone = new Map()
    const lidToName  = new Map()
    if (store?.contacts) {
        for (const [jid, c] of Object.entries(store.contacts)) {
            const cname = c?.name || c?.notify || c?.verifiedName
            if (jid.endsWith('@s.whatsapp.net')) {
                const phone = jid.split('@')[0].split(':')[0]
                if (c?.lid) {
                    lidToPhone.set(c.lid, phone)
                    if (cname) lidToName.set(c.lid, cname)
                }
            }
            if (jid.endsWith('@lid') && c?.phone) {
                lidToPhone.set(jid, c.phone)
                if (cname) lidToName.set(jid, cname)
            }
        }
    }
    for (const p of freshMeta.participants) {
        if (!p.id || !p.id.endsWith('@lid')) continue
        const num = lidToPhone.get(p.id)
        if (!num || !/^\d{5,15}$/.test(num) || seen.has(num)) continue
        seen.add(num)
        contacts.set(num, lidToName.get(p.id) || `+${num}`)
    }

    // ── TIER 3 (fallback): scan message history for real sender JIDs ─────────
    // Even in @lid privacy-mode groups, message keys carry @s.whatsapp.net JIDs
    if (contacts.size < totalParticipants) {
        try {
            const chatMsgs = store?.messages?.get ? store.messages.get(m.chat) : null
            if (chatMsgs && chatMsgs.size) {
                for (const [, msg] of chatMsgs) {
                    const pJid = msg?.key?.participant
                    if (!pJid) continue
                    if (!pJid.endsWith('@s.whatsapp.net') && !pJid.endsWith('@c.us')) continue
                    const num = pJid.split('@')[0].split(':')[0]
                    if (!/^\d{5,15}$/.test(num) || seen.has(num)) continue
                    seen.add(num)
                    const sc = store?.contacts?.[pJid] || store?.contacts?.[num + '@s.whatsapp.net']
                    const name = sc?.name || sc?.notify || sc?.verifiedName || `+${num}`
                    contacts.set(num, name)
                }
            }
        } catch {}
    }

    if (!contacts.size) return reply(
        `❌ Could not export any contacts from *${freshMeta.subject}*.\n\n` +
        `All ${totalParticipants} members are using WhatsApp privacy mode (@lid JIDs). ` +
        `The bot can only resolve their numbers once they send a message in this group or DM the bot.`
    )

    let vcfData = ''
    for (const [num, name] of contacts) {
        vcfData += `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;TYPE=CELL:+${num}\nEND:VCARD\n`
    }

    const vcfBuf = Buffer.from(vcfData, 'utf8')
    const gname  = (freshMeta.subject || 'group').replace(/[^a-zA-Z0-9]/g, '_')
    const note   = contacts.size < totalParticipants
        ? `\n║ ⚠️ ${totalParticipants - contacts.size} member(s) hidden by WhatsApp privacy mode`
        : `\n║ Import the file into your phone contacts`
    await X.sendMessage(from, {
        document: vcfBuf,
        mimetype: 'text/x-vcard',
        fileName: `${gname}_contacts.vcf`,
        caption: `📋 *${freshMeta.subject}*\n\n║ 👥 *${contacts.size}/${totalParticipants} contacts* exported${note}`
    }, { quoted: m })
} catch(e) { reply('❌ Failed to generate VCF: ' + e.message) }
} break

case 'admins': {
    await X.sendMessage(m.chat, { react: { text: '👑', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
let adminList = '*Group Admins:*\n\n'
let adminMentions = []
for (let p of participants) {
if (p.admin) { adminList += `@${p.id.split('@')[0]} (${p.admin})\n`; adminMentions.push(p.id) }
}
X.sendMessage(from, { text: adminList, mentions: adminMentions }, { quoted: m })
} break

case 'leave': {
    await X.sendMessage(m.chat, { react: { text: '🚪', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!isOwner) return reply(mess.OnlyOwner)
try {
reply('╔══〔 🚪 LEAVE GROUP 〕══╗\n\n║ Bot is leaving this group...\n╚═══════════════════════╝')
await delay(2000)
await X.groupLeave(m.chat)
} catch(err) { reply('Failed to leave: ' + err.message) }
} break

case 'pair': {
      await X.sendMessage(m.chat, { react: { text: '🔗', key: m.key } })
      await reply(
          `╔══〔 🔗 PAIRING SITE 〕══╗\n\n\n╚═══════════════════════╝` +
          `  Click the link below to get your pairing code:\n\n` +
          `  🌐 https://toosii-xd-ultra.onrender.com/pair\n\n` +
          `║ Enter your WhatsApp number\n` +
          `║ Copy the code shown\n` +
          `║ WhatsApp → Linked Devices → Link with phone number`
      )
  } break

case 'clear': {
    await X.sendMessage(m.chat, { react: { text: '🗑️', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!isAdmins && !isOwner) return reply(mess.admin)
reply('╔══〔 🗑️ CLEAR CHAT 〕══╗\n\n║ ✅ Chat cleared.\n║ Note: WhatsApp does not support\n║ remote chat clearing.\n╚═══════════════════════╝')
} break

//━━━━━━━━━━━━━━━━━━━━━━━//
// Additional AI Commands
case 'copilot':{
  if (!text) return reply(`╔══〔 🪁 COPILOT 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🪁', key: m.key } })
    let _cpResult = null
    // Source 1: EliteProTech Copilot (primary — live & direct)
    try {
      let _ep = await fetch(`https://eliteprotech-apis.zone.id/copilot?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(25000) })
      let _epd = await _ep.json()
      if (_epd.success && _epd.text) _cpResult = _epd.text
    } catch {}
    // Source 2: _runAI fallback
    if (!_cpResult) {
      try { _cpResult = await _runAI('You are Microsoft Copilot, a helpful AI assistant. Be productive, accurate and helpful.', text) } catch {}
    }
    if (_cpResult) reply(_cpResult)
    else reply('❌ Copilot is currently unavailable. Please try again.')
  } catch (e) {
    console.error('[COPILOT ERROR]', e.message)
    reply('❌ Copilot is currently unavailable. Please try again.')
  }
}
break

  case 'gemini':{
    if (!text) return reply(`╔══〔 ♊ GEMINI AI 〕══╗\n\n║ Usage: *${prefix}${command} [question]*\n║ Example: ${prefix}${command} What is the capital of Kenya?\n╚═══════════════════════╝`)
    try {
      await X.sendMessage(m.chat, { react: { text: '✨', key: m.key } })
      let _gmResult = null
      // Source 1: EliteProTech Gemini
      try {
          let _ep = await fetch(`https://eliteprotech-apis.zone.id/gemini?prompt=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(25000) })
          let _epd = await _ep.json()
          if (_epd.success && _epd.text) _gmResult = _epd.text
      } catch {}
      // Source 2: _runAI fallback
      if (!_gmResult) { try { _gmResult = await _runAI('You are Gemini, Google\'s advanced AI assistant. Provide accurate, helpful and well-structured responses.', text) } catch {} }
      if (_gmResult) reply(_gmResult)
      else reply('❌ Gemini is currently unavailable. Please try again.')
    } catch (e) {
      reply('❌ Gemini is currently unavailable. Please try again.')
    }
  }
  break
  

case 'vision':
case 'analyse': {
    await X.sendMessage(m.chat, { react: { text: '🔍', key: m.key } })
if (!m.quoted || !/image/.test(m.quoted.mimetype || '')) return reply(`╔══〔 🔍 IMAGE ANALYSIS 〕══╗\n\n║ Reply to an image with *${prefix}${command}*\n║ _Optionally add a question after the command._\n╚═══════════════════════╝`)
try {
let question = text || 'Describe this image in detail. Include objects, people, colors, text, and any notable elements.'
await reply('🔍 _Analysing image, please wait..._')
// Download image as buffer directly
let imgBuffer = await m.quoted.download()
if (!imgBuffer || imgBuffer.length < 100) throw new Error('Failed to download image')
// Convert buffer to base64
let b64 = imgBuffer.toString('base64')
let mime = m.quoted.mimetype || 'image/jpeg'
// Use pollinations vision API (openai-compatible with image support)
let apiBody = {
    model: 'openai',
    messages: [{
        role: 'user',
        content: [
            { type: 'text', text: question },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } }
        ]
    }],
    max_tokens: 1000,
    stream: false
}
let response = await axios.post('https://text.pollinations.ai/openai', apiBody, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000
})
let desc = response.data?.choices?.[0]?.message?.content
if (!desc) throw new Error('No response from vision API')
reply(`╔══〔 🔍 IMAGE ANALYSIS 〕══╗\n\n${desc}\n╚═══════════════════════╝`)
} catch(e) {
// Fallback: upload to catbox then use URL-based vision
try {
let imgBuffer2 = await m.quoted.download()
let uploadUrl = await uploadImage(imgBuffer2)
if (!uploadUrl || !uploadUrl.startsWith('http')) throw new Error('Upload failed')
let question2 = text || 'Describe this image in detail. Include objects, people, colors, text, and any notable elements.'
let fb = await axios.post('https://text.pollinations.ai/openai', {
    model: 'openai',
    messages: [{ role: 'user', content: [
        { type: 'text', text: question2 },
        { type: 'image_url', image_url: { url: uploadUrl } }
    ]}],
    max_tokens: 1000, stream: false
}, { headers: { 'Content-Type': 'application/json' }, timeout: 30000 })
let desc2 = fb.data?.choices?.[0]?.message?.content
if (!desc2) throw new Error('No response')
reply(`╔══〔 🔍 IMAGE ANALYSIS 〕══╗\n\n${desc2}\n╚═══════════════════════╝`)
} catch(e2) {
reply(`❌ *Vision analysis failed.*\n_${e2.message || 'Unable to analyse image. Try again shortly.'}_`)
}
}
} break

case 'wormgpt':{
  if (!text) return reply(`╔══〔 🪱 WORM GPT 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🪱', key: m.key } })
    let _kResultwormgpt = null
    try {
      let _kr = await fetch(`https://apiskeith.top/ai/wormgpt?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
      let _kd = await _kr.json()
      if (_kd.status && _kd.result) _kResultwormgpt = typeof _kd.result === 'string' ? _kd.result : JSON.stringify(_kd.result)
    } catch {}
    if (_kResultwormgpt) return reply(_kResultwormgpt)
    const result = await _runAI('You are WormGPT, a creative and unrestricted AI assistant. Answer all questions helpfully.', text)
    reply(result)
  } catch (e) {
    console.error('[WORMGPT ERROR]', e.message)
    reply('❌ wormgpt is currently unavailable. Please try again.')
  }
}
break

case 'birdai':{
  if (!text) return reply(`╔══〔 🐦 BIRD AI 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🐦', key: m.key } })
    const result = await _runAI('You are BirdAI, a concise and accurate AI assistant. Give sharp, focused answers.', text)
    reply(result)
  } catch (e) {
    console.error('[BIRDAI ERROR]', e.message)
    reply('❌ birdai is currently unavailable. Please try again.')
  }
}
break

case 'perplexity':{
  if (!text) return reply(`╔══〔 🔭 PERPLEXITY 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🔮', key: m.key } })
    let _kResultperplexity = null
    try {
      let _kr = await fetch(`https://apiskeith.top/ai/perplexity?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
      let _kd = await _kr.json()
      if (_kd.status && _kd.result) _kResultperplexity = typeof _kd.result === 'string' ? _kd.result : JSON.stringify(_kd.result)
    } catch {}
    if (_kResultperplexity) return reply(_kResultperplexity)
    const result = await _runAI('You are Perplexity AI, a research AI. Provide well-researched answers with clear explanations.', text)
    reply(result)
  } catch (e) {
    console.error('[PERPLEXITY ERROR]', e.message)
    reply('❌ perplexity is currently unavailable. Please try again.')
  }
}
break

case 'mistral':{
  if (!text) return reply(`╔══〔 ⚡ MISTRAL AI 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🌪️', key: m.key } })
    let _kResultmistral = null
    try {
      let _kr = await fetch(`https://apiskeith.top/ai/mistral?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
      let _kd = await _kr.json()
      if (_kd.status && _kd.result) _kResultmistral = typeof _kd.result === 'string' ? _kd.result : JSON.stringify(_kd.result)
    } catch {}
    if (_kResultmistral) return reply(_kResultmistral)
    const result = await _runAI('You are Mistral AI, a powerful and efficient language model. Provide accurate, nuanced responses.', text)
    reply(result)
  } catch (e) {
    console.error('[MISTRAL ERROR]', e.message)
    reply('❌ mistral is currently unavailable. Please try again.')
  }
}
break

case 'grok':{
  if (!text) return reply(`╔══〔 🔬 GROK AI 〕══╗\n\n║ Usage: *${prefix}${command} [message]*\n║ Example: ${prefix}${command} Hello, how are you?\n╚═══════════════════════╝`)
  try {
    await X.sendMessage(m.chat, { react: { text: '🤖', key: m.key } })
    let _kResultgrok = null
    try {
      let _kr = await fetch(`https://apiskeith.top/ai/grok?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
      let _kd = await _kr.json()
      if (_kd.status && _kd.result) _kResultgrok = typeof _kd.result === 'string' ? _kd.result : JSON.stringify(_kd.result)
    } catch {}
    if (_kResultgrok) return reply(_kResultgrok)
    const result = await _runAI('You are Grok, a witty and intelligent AI assistant by xAI. Be sharp, clever and insightful.', text)
    reply(result)
  } catch (e) {
    console.error('[GROK ERROR]', e.message)
    reply('❌ grok is currently unavailable. Please try again.')
  }
}
break

case 'speechwrite': {
    await X.sendMessage(m.chat, { react: { text: '🎙️', key: m.key } })
if (!text) return reply(`╔══〔 🎤 SPEECH WRITER 〕══╗\n\n║ *Usage:* ${prefix}speechwrite [topic]\n\n║ _Examples:_\n║ • graduation ceremony about perseverance\n║ • wedding toast for my best friend\n║ • motivational speech for a sports team\n╚═══════════════════════╝`)
try {
await reply('🎤 _Crafting your speech, please wait..._')
let systemPrompt = 'You are an elite professional speechwriter with 20+ years of experience writing for world leaders, CEOs, and celebrities. Write compelling, eloquent, emotionally resonant speeches that feel authentic and human. Structure every speech with: a powerful opening hook, a clear body with 3 main points, emotional storytelling and vivid examples, a memorable inspiring conclusion, and natural transitions throughout. Keep the tone warm, confident, and conversational. The speech should feel like a real person wrote it.'
let { data } = await axios.post('https://text.pollinations.ai/openai', {
    model: 'openai',
    messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Write a complete, professional speech about: ' + text + '\n\nMake it 400-600 words, ready to deliver.' }
    ],
    max_tokens: 1500,
    stream: false
}, { headers: { 'Content-Type': 'application/json' }, timeout: 30000 })
let speech = data?.choices?.[0]?.message?.content
if (!speech) throw new Error('No response from API')
reply(`╔══〔 🎤 YOUR SPEECH 〕═══╗\n\n${speech}\n\n_Generated by Juice v12_\n╚═══════════════════════╝`)
} catch(e) { reply('❌ *Speech generation failed.*\n_' + (e.message || 'Try again shortly.') + '_') }
} break

case 'imagine':
case 'flux': {
    await X.sendMessage(m.chat, { react: { text: '🎨', key: m.key } })
    // Resolve prompt — typed text > quoted text > quoted image caption
    let _imgPrompt = text
    if (!_imgPrompt && m.quoted) {
        const _qBody = m.quoted.text || m.quoted.caption || ''
        if (_qBody.trim()) {
            _imgPrompt = _qBody.trim()
        } else if (/image/.test(mime)) {
            return reply(`╔══〔 🎨 IMAGINE 〕══╗\n\n║ ℹ️ You replied to an image.\n║ Add a description after the command:\n║ *${prefix}imagine [what to generate]*\n╚═══════════════════════╝`)
        }
    }
    if (!_imgPrompt) return reply(`╔══〔 🎨 AI IMAGE GENERATOR 〕══╗\n\n║ *Usage:* ${prefix}${command} [description]\n║ _Or reply to a text/caption with the command_\n\n║ _Examples:_\n║ • a futuristic city at night\n║ • lion wearing a crown, digital art\n║ • sunset over the ocean, photorealistic\n╚═══════════════════════╝`)
    try {
        await reply('🎨 _Generating your image, please wait..._')
        const _imgCaption = `╔══〔 🎨 AI GENERATED IMAGE 〕══╗\n\n║ 📝 *Prompt* : ${_imgPrompt}\n╚═══════════════════════╝`
        let _imgSent = false
        // Source 1: EliteProTech Imagine (primary — returns raw JPEG)
        if (command !== 'flux') {
            try {
                let _epImgRes = await fetch(`https://eliteprotech-apis.zone.id/imagine?prompt=${encodeURIComponent(_imgPrompt)}`, { signal: AbortSignal.timeout(35000) })
                if (_epImgRes.ok) {
                    let _epBuf = Buffer.from(await _epImgRes.arrayBuffer())
                    if (_epBuf && _epBuf.length > 5000) {
                        await X.sendMessage(m.chat, { image: _epBuf, caption: _imgCaption }, { quoted: m })
                        _imgSent = true
                    }
                }
            } catch {}
        }
        // Source 2: Pollinations fallback (also handles .flux)
        if (!_imgSent) {
            let model = command === 'flux' ? 'flux' : 'turbo'
            let seed  = Math.floor(Math.random() * 999999)
            let imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(_imgPrompt)}?model=${model}&width=1024&height=1024&seed=${seed}&nologo=true&enhance=true`
            let imgBuffer = await getBuffer(imgUrl)
            if (!imgBuffer || imgBuffer.length < 5000) throw new Error('Image generation returned empty result')
            await X.sendMessage(m.chat, { image: imgBuffer, caption: _imgCaption + `\n║ 🤖 *Model* : ${model.toUpperCase()}\n║ 🎲 *Seed* : ${seed}` }, { quoted: m })
            _imgSent = true
        }
    } catch(e) {
        // Final fallback: direct URL send
        try {
            let seed2 = Math.floor(Math.random() * 999999)
            let fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(_imgPrompt || text)}?width=1024&height=1024&seed=${seed2}&nologo=true`
            await X.sendMessage(m.chat, { image: { url: fallbackUrl }, caption: `🎨 *Generated:* ${_imgPrompt || text}` }, { quoted: m })
        } catch(e2) { reply(`❌ *Image generation failed.*\n_${e2.message || 'Try again shortly.'}_`) }
    }
} break

//━━━━━━━━━━━━━━━━━━━━━━━━//
// Downloader Commands
case 'ytmp4':
case 'ytvideo':
case 'ytdl':
case 'yt':
case 'video':
case 'ytv': {
    await X.sendMessage(m.chat, { react: { text: '📺', key: m.key } })
if (!text) return reply(`╔══〔 📺 YOUTUBE VIDEO 〕══╗\n\n║ Usage: *${prefix}ytv [url or query]*\n║ Example: ${prefix}ytv Afrobeats mix 2025\n╚═══════════════════════╝`)
let _vidTmp1 = null
try {
let url = text, title = text
if (!text.match(/youtu/gi)) {
    let search = await yts(text)
    if (!search.all.length) return reply('No results found.')
    url = search.all[0].url; title = search.all[0].title
}
let videoUrl = null, videoPath = null
// Method 1: GiftedTech API — direct 720p MP4 URL
try {
    let res = await fetch(`https://api.giftedtech.co.ke/api/download/savetubemp4?apikey=${_giftedKey()}&url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(30000) })
    let data = await res.json()
    console.log('[video] giftedtech: success=', data.success)
    if (data.success && data.result?.download_url) videoUrl = data.result.download_url
} catch (e1) { console.log('[video] giftedtech:', e1.message) }
// Method 2: loader.to — URL-based (no RAM buffer)
if (!videoUrl && !videoPath) {
    try {
        let initData = await (await fetch(`https://loader.to/ajax/download.php?format=mp4&url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(10000) })).json()
        if (initData.success && initData.id) {
            for (let i = 0; i < 40; i++) {
                await new Promise(r => setTimeout(r, 3000))
                let p = await (await fetch(`https://loader.to/ajax/progress.php?id=${initData.id}`)).json()
                if (p.success === 1 && p.progress >= 1000 && p.download_url) { videoUrl = p.download_url; break }
                if (p.progress < 0) break
            }
        }
    } catch (e2) { console.log('[video] loader.to:', e2.message) }
}
// Method 3: ytdl-core — stream to file (no RAM buffer)
if (!videoUrl && !videoPath) {
    try {
        let ytdl = require('@distube/ytdl-core')
        let agent = ytdl.createAgent()
        let info = await ytdl.getInfo(url, { agent })
        title = info.videoDetails.title
        let format = ytdl.chooseFormat(info.formats, { quality: 'highest', filter: 'videoandaudio' })
        if (format) {
            let tmpDir = path.join(__dirname, 'tmp')
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
            _vidTmp1 = path.join(tmpDir, `vid_${Date.now()}.mp4`)
            await new Promise((resolve, reject) => {
                let ws = fs.createWriteStream(_vidTmp1)
                let ys = ytdl(url, { format, agent })
                ys.pipe(ws); ws.on('finish', resolve); ws.on('error', reject); ys.on('error', reject)
                setTimeout(() => { ys.destroy(); reject(new Error('timeout')) }, 300000)
            })
            if (fs.existsSync(_vidTmp1) && fs.statSync(_vidTmp1).size > 10000) videoPath = _vidTmp1
        }
    } catch (e3) { console.log('[video] ytdl-core:', e3.message) }
}
// Method 4: Keith API ytmp4 backup
if (!videoUrl && !videoPath) {
    try {
        let _kv = await fetch(`https://apiskeith.top/download/ytmp4?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(40000) })
        let _kvd = await _kv.json()
        console.log('[video] keith: status=', _kvd.status)
        if (_kvd.status && _kvd.result?.download_url) videoUrl = _kvd.result.download_url
        else if (_kvd.status && _kvd.result?.url) videoUrl = _kvd.result.url
    } catch (_kv0) { console.log('[video] keith:', _kv0.message) }
}
if (videoUrl || videoPath) {
    let src = videoUrl ? { url: videoUrl } : { url: `file://${videoPath}` }
    await X.sendMessage(m.chat, { video: src, caption: `╔══〔 📺 VIDEO DOWNLOAD 〕══╗\n║ 🎬 *${title}*\n╚═══════════════════════╝`, mimetype: 'video/mp4' }, { quoted: m })
} else {
    reply('⚠️ Video download failed. Please try again later.')
}
} catch(e) { reply('Error: ' + e.message) }
finally { if (_vidTmp1 && fs.existsSync(_vidTmp1)) try { fs.unlinkSync(_vidTmp1) } catch {} }
} break

case 'ytdocplay': {
    await X.sendMessage(m.chat, { react: { text: '🎵', key: m.key } })
if (!text) return reply(`╔══〔 🎵 YT DOC AUDIO 〕══╗\n\n║ Usage: *${prefix}ytdocplay [song name]*\n║ Example: ${prefix}ytdocplay Tems Free Mind\n╚═══════════════════════╝`)
let _ytdocTmp = null
try {
let search = await yts(text)
if (!search.all.length) return reply('No results found.')
let vid = search.all.find(v => v.type === 'video') || search.all[0]
let audioUrl = null, audioPath = null
// Method 1: GiftedTech API
try {
    let res = await fetch(`https://api.giftedtech.co.ke/api/download/ytmp3?apikey=${_giftedKey()}&quality=128kbps&url=${encodeURIComponent(vid.url)}`, { signal: AbortSignal.timeout(30000) })
    let data = await res.json()
    if (data.success && data.result?.download_url) audioUrl = data.result.download_url
} catch (e1) { console.log('[ytdocplay] giftedtech:', e1.message) }
// Method 2: loader.to
if (!audioUrl && !audioPath) {
    try {
        let initData = await (await fetch(`https://loader.to/ajax/download.php?format=mp3&url=${encodeURIComponent(vid.url)}`, { signal: AbortSignal.timeout(10000) })).json()
        if (initData.success && initData.id) {
            for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 3000))
                let p = await (await fetch(`https://loader.to/ajax/progress.php?id=${initData.id}`)).json()
                if (p.success === 1 && p.progress >= 1000 && p.download_url) { audioUrl = p.download_url; break }
                if (p.progress < 0) break
            }
        }
    } catch (e2) { console.log('[ytdocplay] loader.to:', e2.message) }
}
// Method 3: ytdl-core — stream to file
if (!audioUrl && !audioPath) {
    try {
        let ytdl = require('@distube/ytdl-core')
        let agent = ytdl.createAgent()
        let info = await ytdl.getInfo(vid.url, { agent })
        let format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' })
        if (!format) format = ytdl.chooseFormat(info.formats, { filter: f => f.hasAudio })
        if (format) {
            let tmpDir = path.join(__dirname, 'tmp')
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
            _ytdocTmp = path.join(tmpDir, `ytdoc_${Date.now()}.mp3`)
            await new Promise((resolve, reject) => {
                let ws = fs.createWriteStream(_ytdocTmp)
                let ys = ytdl(vid.url, { format, agent })
                ys.pipe(ws); ws.on('finish', resolve); ws.on('error', reject); ys.on('error', reject)
                setTimeout(() => { ys.destroy(); reject(new Error('timeout')) }, 300000)
            })
            if (fs.existsSync(_ytdocTmp) && fs.statSync(_ytdocTmp).size > 10000) {
                // Re-encode to 128kbps CBR if ffmpeg is available
                try {
                    const _rawPath = _ytdocTmp.replace('.mp3', '_raw.m4a')
                    fs.renameSync(_ytdocTmp, _rawPath)
                    await new Promise((res, rej) => exec(
                        `ffmpeg -y -i "${_rawPath}" -codec:a libmp3lame -b:a 128k -ar 44100 -ac 2 "${_ytdocTmp}"`,
                        { timeout: 120000 }, (err) => { try { fs.unlinkSync(_rawPath) } catch {}; err ? rej(err) : res() }
                    ))
                } catch { /* ffmpeg unavailable — use raw download */ }
                audioPath = _ytdocTmp
            }
        }
    } catch (e3) { console.log('[ytdocplay] ytdl-core:', e3.message) }
}
if (audioUrl || audioPath) {
    let cleanName = `${vid.author?.name || 'Unknown'} - ${vid.title}.mp3`.replace(/[<>:"/\\|?*]/g, '')
    let src = audioUrl ? { url: audioUrl } : { url: `file://${audioPath}` }
    await X.sendMessage(m.chat, { document: src, mimetype: 'audio/mpeg', fileName: cleanName }, { quoted: m })
} else {
    reply('⚠️ Audio download failed. Please try again later.')
}
} catch(e) { reply('Error: ' + e.message) }
finally { if (_ytdocTmp && fs.existsSync(_ytdocTmp)) try { fs.unlinkSync(_ytdocTmp) } catch {} }
} break

case 'ytdocvideo': {
    await X.sendMessage(m.chat, { react: { text: '📺', key: m.key } })
if (!text) return reply(`╔══〔 📺 YT DOC VIDEO 〕══╗\n\n║ Usage: *${prefix}ytdocvideo [video name]*\n║ Example: ${prefix}ytdocvideo Burna Boy live\n╚═══════════════════════╝`)
let _ytdocvTmp = null
try {
let search = await yts(text)
if (!search.all.length) return reply('No results found.')
let vid = search.all.find(v => v.type === 'video') || search.all[0]
let videoUrl = null, videoPath = null
// Method 1: GiftedTech API
try {
    let res = await fetch(`https://api.giftedtech.co.ke/api/download/ytv?apikey=${_giftedKey()}&url=${encodeURIComponent(vid.url)}`, { signal: AbortSignal.timeout(30000) })
    let data = await res.json()
    if (data.success && data.result?.download_url) videoUrl = data.result.download_url
} catch (e1) { console.log('[ytdocvideo] giftedtech:', e1.message) }
// Method 2: cobalt.tools — reliable yt downloader API
if (!videoUrl && !videoPath) {
    try {
        let _cRes = await fetch('https://api.cobalt.tools/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ url: vid.url, downloadMode: 'auto', videoQuality: '720' }),
            signal: AbortSignal.timeout(25000)
        })
        let _cData = await _cRes.json()
        console.log('[ytdocvideo] cobalt:', _cData.status, _cData.url)
        if ((_cData.status === 'tunnel' || _cData.status === 'redirect') && _cData.url) {
            videoUrl = _cData.url
        } else if (_cData.status === 'picker' && _cData.picker?.length) {
            videoUrl = _cData.picker.find(x => x.type === 'video')?.url || _cData.picker[0]?.url
        }
        if (videoUrl) console.log('[ytdocvideo] cobalt: success')
    } catch (_ce) { console.log('[ytdocvideo] cobalt:', _ce.message) }
}
// Method 3: InnerTube ANDROID — direct muxed mp4 stream
if (!videoUrl && !videoPath) {
    try {
        let _itVid = (vid.url.match(/(?:v=|youtu\.be\/)([^&?#]+)/) || [])[1]
        if (_itVid) {
            let _itRes = await fetch('https://www.youtube.com/youtubei/v1/player?key=AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip' },
                body: JSON.stringify({ context: { client: { clientName: 'ANDROID_TESTSUITE', clientVersion: '1.9', androidSdkVersion: 30, hl: 'en', gl: 'US' } }, videoId: _itVid }),
                signal: AbortSignal.timeout(15000)
            })
            let _itData = await _itRes.json()
            let _fmts = (_itData.streamingData?.formats || []).filter(f => f.mimeType?.includes('video/mp4') && f.url)
            _fmts.sort((a, b) => (b.width || 0) - (a.width || 0))
            if (_fmts[0]?.url) { videoUrl = _fmts[0].url; console.log('[ytdocvideo] innertube: success quality=', _fmts[0].qualityLabel) }
        }
    } catch (_ite) { console.log('[ytdocvideo] innertube:', _ite.message) }
}
// Method 4: loader.to
if (!videoUrl && !videoPath) {
    try {
        let initData = await (await fetch(`https://loader.to/ajax/download.php?format=mp4&url=${encodeURIComponent(vid.url)}`, { signal: AbortSignal.timeout(10000) })).json()
        if (initData.success && initData.id) {
            for (let i = 0; i < 40; i++) {
                await new Promise(r => setTimeout(r, 3000))
                let p = await (await fetch(`https://loader.to/ajax/progress.php?id=${initData.id}`)).json()
                if (p.success === 1 && p.progress >= 1000 && p.download_url) { videoUrl = p.download_url; break }
                if (p.progress < 0) break
            }
        }
    } catch (e2) { console.log('[ytdocvideo] loader.to:', e2.message) }
}
// Method 5: ytdl-core — stream to file
if (!videoUrl && !videoPath) {
    try {
        let ytdl = require('@distube/ytdl-core')
        let agent = ytdl.createAgent()
        let info = await ytdl.getInfo(vid.url, { agent })
        let format = ytdl.chooseFormat(info.formats, { quality: 'highest', filter: 'videoandaudio' })
        if (format) {
            let tmpDir = path.join(__dirname, 'tmp')
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
            _ytdocvTmp = path.join(tmpDir, `ytdocv_${Date.now()}.mp4`)
            await new Promise((resolve, reject) => {
                let ws = fs.createWriteStream(_ytdocvTmp)
                let ys = ytdl(vid.url, { format, agent })
                ys.pipe(ws); ws.on('finish', resolve); ws.on('error', reject); ys.on('error', reject)
                setTimeout(() => { ys.destroy(); reject(new Error('timeout')) }, 300000)
            })
            if (fs.existsSync(_ytdocvTmp) && fs.statSync(_ytdocvTmp).size > 10000) videoPath = _ytdocvTmp
        }
    } catch (e3) { console.log('[ytdocvideo] ytdl-core:', e3.message) }
}
if (videoUrl || videoPath) {
    let cleanName = `${vid.title}.mp4`.replace(/[<>:"/\\|?*]/g, '')
    let src = videoUrl ? { url: videoUrl } : { url: `file://${videoPath}` }
    await X.sendMessage(m.chat, { document: src, mimetype: 'video/mp4', fileName: cleanName }, { quoted: m })
} else {
    reply('⚠️ Video download failed. Please try again later.')
}
} catch(e) { reply('Error: ' + e.message) }
finally { if (_ytdocvTmp && fs.existsSync(_ytdocvTmp)) try { fs.unlinkSync(_ytdocvTmp) } catch {} }
} break


case 'apk': {
    await X.sendMessage(m.chat, { react: { text: '📲', key: m.key } })
    if (!text) return reply(`╔══〔 📲 APK SEARCH 〕═════╗
║ *Usage:* ${prefix}apk [app name]
║ Example: ${prefix}apk WhatsApp
╚═══════════════════════╝`)
    try {
        await reply('📲 _Searching APK..._')
        let _apkResults = null
        // Source 1: EliteProTech
        try {
            let _ep = await fetch(`https://eliteprotech-apis.zone.id/apk?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
            let _epd = await _ep.json()
            if (_epd.status && _epd.results?.length) _apkResults = _epd.results.slice(0, 5).map(a => ({
                name: a.name, package: a.package,
                version: a.file?.vername || '?',
                size: a.file?.filesize ? (a.file.filesize / 1024 / 1024).toFixed(1) + ' MB' : '?',
                download: a.file?.path || null,
                icon: a.icon || null
            }))
        } catch (_e1) { console.log('[apk] eliteprotech:', _e1.message) }
        // Source 2: maizapk fallback
        if (!_apkResults?.length) {
            try {
                let _mz = await fetch(`https://api.maizapk.my.id/search?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(15000) })
                let _mzd = await _mz.json()
                if (_mzd.results?.length) _apkResults = _mzd.results.slice(0, 5).map(a => ({ name: a.name, download: a.link || null, version: '?', size: '?', package: '' }))
            } catch (_e2) {}
        }
        if (!_apkResults?.length) return reply(`❌ No APK found for "${text}". Try: https://apkpure.com/search?q=${encodeURIComponent(text)}`)
        let _msg = `╔══〔 📦 APK SEARCH: ${text} 〕══╗\n\n╚═══════════════════════╝`
        for (let [i, a] of _apkResults.entries()) {
            _msg += `\n${i+1}. *${a.name}*`
            if (a.package) _msg += ` (${a.package})`
            _msg += `\n║ 📦 Version: ${a.version} | 💾 Size: ${a.size}`
            if (a.download) _msg += `\n║ 🔗 ${a.download}`
            _msg += '\n'
        }
        await reply(_msg)
    } catch (e) { reply(`╔══〔 📲 APK SEARCH 〕═════╗\n║ 🔍 *Query* : ${text}\n║ 🔗 apkpure.com/search?q=${encodeURIComponent(text)}\n╚═══════════════════════╝`) }
} break

case 'gitclone': {
    await X.sendMessage(m.chat, { react: { text: '📦', key: m.key } })
if (!text) return reply(`╔══〔 📦 GIT CLONE INFO 〕══╗\n\n║ Usage: *${prefix}gitclone [github url]*\n║ Example: ${prefix}gitclone https://github.com/user/repo\n╚═══════════════════════╝`)
try {
let repoUrl = text.replace(/\.git$/, '')
let match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/)
if (!match) return reply('Invalid GitHub URL.')
let [, user, repo] = match
let zipUrl = `https://api.github.com/repos/${user}/${repo}/zipball`
await X.sendMessage(m.chat, { document: { url: zipUrl }, mimetype: 'application/zip', fileName: `${repo}.zip` }, { quoted: m })
} catch(e) { reply('Error: ' + e.message) }
} break

//━━━━━━━━━━━━━━━━━━━━━━━━//
// Search & Tools Commands
case 'yts':
case 'ytsearch': {
    await X.sendMessage(m.chat, { react: { text: '🔍', key: m.key } })
if (!text) return reply(`╔══〔 🔍 YOUTUBE SEARCH 〕══╗\n\n║ Usage: *${prefix}yts [query]*\n║ Example: ${prefix}yts best Afrobeats 2025\n╚═══════════════════════╝`)
try {
let yts = require('yt-search')
let search = await yts(text)
if (!search.all.length) return reply('No results found.')
let results = search.all.slice(0, 10).map((v, i) => `${i+1}. *${v.title}*\nChannel: ${v.author?.name || 'Unknown'}\nDuration: ${v.timestamp || 'N/A'}\nViews: ${v.views?.toLocaleString() || 'N/A'}\nURL: ${v.url}`).join('\n\n')
reply(`╔══〔 🎬 YOUTUBE SEARCH 〕══╗\n\n║ 🔍 *${text}*\n\n${results}\n╚═══════════════════════╝`)
} catch(e) { reply('Error: ' + e.message) }
} break

case 'img':
case 'imgfind':
case 'gimage':
case 'image': {
    await X.sendMessage(m.chat, { react: { text: '🖼️', key: m.key } })
if (!text) return reply(`╔══〔 🖼️ IMAGE SEARCH 〕══╗\n\n║ Usage: *${prefix}img [query]*\n║ Example: ${prefix}img beautiful sunset\n╚═══════════════════════╝`)
try {
let imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}?width=512&height=512&nologo=true`
// Also try Keith image search for real photos
let _keithImgUrl = null
try {
  let _kr = await fetch(`https://apiskeith.top/search/images?q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(10000) })
  let _kd = await _kr.json()
  if (_kd.status && Array.isArray(_kd.result) && _kd.result.length) {
    _keithImgUrl = _kd.result[0].url || _kd.result[0].link || _kd.result[0].src
  }
} catch {}
let _finalImg = _keithImgUrl || imgUrl
await X.sendMessage(m.chat, { image: { url: _finalImg }, caption: `╔══〔 🖼️ IMAGE SEARCH 〕══╗
║ 🔍 *Query:* ${text}
╚═══════════════════════╝` }, { quoted: m })
} catch(e) { reply('Error: ' + e.message) }
} break

case 'imdb':
case 'tmdb':
case 'movie':
case 'film':
case 'series': {
    await X.sendMessage(m.chat, { react: { text: '🎬', key: m.key } })
    if (!text) return reply(
        `╔══〔 🎬 MOVIE / SERIES 〕══╗\n\n\n╚═══════════════════════╝` +
        `  Search any movie or TV series and get info + stream links.\n\n` +
        `║ *${prefix}movie* Inception\n` +
        `║ *${prefix}movie* Breaking Bad\n` +
        `║ *${prefix}movie* Avengers 2019\n` +
        `║ *${prefix}stream* [id] [movie|tv] — get episodes/streams directly`
    )
    try {
        await reply(`🎬 _Searching for_ *${text}*_..._`)

        const _TMDB = '8265bd1679663a7ea12ac168da84d2e8'
        const _BASE = 'https://api.themoviedb.org/3'
        const _IMG  = 'https://image.tmdb.org/t/p/w500'
        const _XCASPER = 'https://movieapi.xcasper.space'
        const _na   = (v) => (v !== null && v !== undefined && v !== '') ? v : '—'
        const _q    = text.trim()
        const _ym   = _q.match(/(19|20)\d{2}/)
        const _year = _ym ? _ym[0] : ''
        const _titl = _q.replace(_year, '').trim()

        // Search movies + TV + xcasper showbox in parallel
        const [_mRes, _tRes, _xmRes, _xtvRes] = await Promise.allSettled([
            fetch(`${_BASE}/search/movie?api_key=${_TMDB}&query=${encodeURIComponent(_titl)}${_year ? `&year=${_year}` : ''}`).then(r => r.json()),
            fetch(`${_BASE}/search/tv?api_key=${_TMDB}&query=${encodeURIComponent(_titl)}${_year ? `&first_air_date_year=${_year}` : ''}`).then(r => r.json()),
            fetch(`${_XCASPER}/api/showbox/search?keyword=${encodeURIComponent(_q)}&type=movie`, { signal: AbortSignal.timeout(15000) }).then(r => r.json()),
            fetch(`${_XCASPER}/api/showbox/search?keyword=${encodeURIComponent(_q)}&type=tv`, { signal: AbortSignal.timeout(15000) }).then(r => r.json()),
        ])

        const _tmdbAll = [
            ...((_mRes.value?.results || _mRes.status==='fulfilled' ? _mRes.value?.results||[] : [])).map(x => ({ ...x, _mt: 'movie' })),
            ...((_tRes.value?.results || _tRes.status==='fulfilled' ? _tRes.value?.results||[] : [])).map(x => ({ ...x, _mt: 'tv'    }))
        ].sort((a, b) => (b.popularity || 0) - (a.popularity || 0))

        // Best xcasper match (movie preferred, then tv)
        const _xcMovies = _xmRes.status==='fulfilled' && _xmRes.value?.success ? (_xmRes.value.data||[]) : []
        const _xcTV     = _xtvRes.status==='fulfilled' && _xtvRes.value?.success ? (_xtvRes.value.data||[]) : []
        const _xcPick   = _xcMovies[0] || _xcTV[0] || null
        const _xcIsTV   = !_xcMovies[0] && !!_xcTV[0]

        if (!_tmdbAll.length && !_xcPick) return reply(
            `╔══〔 🎬 MOVIE SEARCH 〕══╗\n\n\n╚═══════════════════════╝` +
            `  ❌ *Not found:* _${text}_\n\n` +
            `  _Try a different spelling or add the year._\n` +
            `  _Example:_ *${prefix}movie Inception 2010*`
        )

        // Get TMDB details + xcasper stream data in parallel
        const _pick = _tmdbAll[0]
        const _mt   = _pick?._mt || (_xcIsTV ? 'tv' : 'movie')
        const _isTV = _mt === 'tv'

        const [_dRes, _streamRes] = await Promise.allSettled([
            _pick ? fetch(`${_BASE}/${_mt}/${_pick.id}?api_key=${_TMDB}&append_to_response=credits`).then(r => r.json()) : Promise.resolve(null),
            _xcPick ? fetch(`${_XCASPER}/api/showbox/${_xcIsTV ? 'tv' : 'movie'}?id=${_xcPick.id}${_xcIsTV ? '&season=1&episode=1' : ''}`, { signal: AbortSignal.timeout(15000) }).then(r => r.json()) : Promise.resolve(null)
        ])
        const _d = _dRes.status === 'fulfilled' ? _dRes.value : null
        const _sd = _streamRes.status === 'fulfilled' ? _streamRes.value : null

        const _icon   = _isTV ? '📺' : '🎬'
        const _tStr   = _isTV ? 'TV SERIES' : 'MOVIE'
        const _title2 = _na(_d?.title || _d?.name || _xcPick?.title || _pick?.title || _pick?.name)
        const _yr2    = (_d?.release_date || _d?.first_air_date || '').slice(0, 4) || (_xcPick?.year ? String(_xcPick.year) : '')
        const _genres = (_d?.genres || []).map(g => g.name).join(', ') || (_xcPick?.cats || '—')
        const _rt     = _isTV
            ? (_d?.episode_run_time?.[0] ? `${_d.episode_run_time[0]} min/ep` : '—')
            : (_d?.runtime ? `${_d.runtime} min` : (_sd?.data?.runtime ? `${_sd.data.runtime} min` : '—'))
        const _lang   = _na((_d?.original_language || '').toUpperCase())
        const _score  = _d?.vote_average
            ? `${_d.vote_average.toFixed(1)}/10 ⭐`
            : (_sd?.data?.imdb_rating ? `${_sd.data.imdb_rating}/10 ⭐ (IMDb)` : '—')
        const _plot   = _na(_d?.overview || _sd?.data?.description)
        const _poster = _d?.poster_path ? `${_IMG}${_d.poster_path}` : (_xcPick?.poster_org || _xcPick?.poster_min || null)
        const _dir    = !_isTV
            ? (_d?.credits?.crew?.find(c => c.job === 'Director')?.name || _sd?.data?.director || '—')
            : (_d?.created_by?.map(c => c.name).join(', ') || '—')
        const _cast   = (_d?.credits?.cast || []).slice(0, 5).map(c => c.name).join(', ') || (_sd?.data?.actors?.split(',').slice(0,4).join(',').trim() || '—')
        const _imdbId = _d?.imdb_id || _sd?.data?.imdb_id || ''

        // ── Stream links from xcasper ──
        const _files = _sd?.data?.file || []
        const _freeFiles = _files.filter(f => !f.vip_only && f.path && f.path.startsWith('http'))
        const _vipFiles  = _files.filter(f =>  f.vip_only && f.path && f.path.startsWith('http'))
        const _allPlayable = [..._freeFiles, ..._vipFiles]

        let _cap  = `╔══〔 ${icon} ${tStr} INFO 〕══╗\n\n\n╚═══════════════════════╝`
            _cap += `  *${_title2}*  _(${_yr2 || '?'})_\n\n`
            _cap += `║ 🎭 *Genre* : ${_genres}\n`
            _cap += `║ ⏱️  *Runtime* : ${_rt}\n`
            _cap += `║ 🌍 *Language* : ${_lang}\n`
            _cap += `║ ⭐ *Rating* : ${_score}\n`
        if (_isTV && _d) {
            _cap += `║ 📺 *Seasons* : ${_na(_d.number_of_seasons)} seasons · ${_na(_d.number_of_episodes)} episodes\n`
        }
            _cap += `║ 🎬 *${_isTV ? 'Creator ' : 'Director'}* : ${_dir}\n`
            _cap += `║ 🎭 *Cast* : ${_cast}\n`
            _cap += `\n║ *📝 Plot:*\n║ _${_plot.slice(0, 300)}${_plot.length > 300 ? '…' : ''}_\n`
        if (_imdbId) _cap += `\n║ 🔗 https://www.imdb.com/title/${_imdbId}\n`

        // Stream section
        if (_allPlayable.length) {
            _cap += `\n╠══〔 📥 STREAM / DOWNLOAD LINKS 〕══╣\n`
            if (_isTV) _cap += `  _Season 1, Ep 1 — use ${prefix}stream for other episodes_\n`
            for (const _f of _allPlayable.slice(0, 5)) {
                _cap += `\n🎞️ *${_f.quality || '?'}* ${_f.format ? `(${_f.format.toUpperCase()})` : ''} — ${_f.size || '?'}\n`
                _cap += `${_f.path}\n`
            }
            if (_allPlayable.length > 5) _cap += `\n_...and ${_allPlayable.length - 5} more quality options_\n`
            _cap += `\n_Open links in VLC / MX Player / browser to watch_`
        } else if (_xcPick) {
            // Has xcasper data but no free stream links (VIP only or not yet available)
            _cap += `\n╠═════〔 📡 STREAM 〕═════╣\n`
            _cap += `_Streams for this title require VIP access on ShowBox._\n`
            if (_isTV) {
                _cap += `\nUse *${prefix}stream ${_xcPick.id} tv [season] [ep]* to check specific episodes`
            } else {
                _cap += `\nUse *${prefix}stream ${_xcPick.id} movie* to check availability`
            }
        } else {
            _cap += `\n_No direct stream found. Try searching on:_\n🔗 https://showbox.media\n🔗 https://fmovies.ps`
        }

        if (_poster) {
            await X.sendMessage(m.chat, { image: { url: _poster }, caption: _cap }, { quoted: m })
        } else {
            reply(_cap)
        }

    } catch(e) {
        reply(`❌ *Movie search failed.*\n_${e.message || 'Please try again.'}_`)
    }
} break

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎬  DRAMA & MOVIE SEARCH (Keith API)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
case 'dramabox':
case 'drama': {
    await X.sendMessage(m.chat, { react: { text: '🇟🇰', key: m.key } })
    const _dbq = q?.trim() || text?.trim()
    if (!_dbq) return reply(`╌══〔 🇟🇰 DRAMABOX SEARCH 〕╌\n║ *Usage:* ${prefix}drama [title]\n║ Example: ${prefix}drama crash landing\n╚═══════════════════════╝`)
    try {
        await reply(`🔍 _Searching DramaBox for: ${_dbq}..._`)
        const _dbd = await _keithFetch(`/dramabox?q=${encodeURIComponent(_dbq)}`)
        const _dbr = Array.isArray(_dbd) ? _dbd : (_dbd?.result || _dbd?.dramas || [])
        if (!_dbr.length) { reply(`❌ No dramas found for *${_dbq}*`); break }
        let msg = `╌══〔 🇟🇰 DRAMABOX RESULTS 〕╌\n`
        for (let d of _dbr.slice(0, 5)) {
            msg += `\n🎬 *${d.title || d.name}*\n`
            if (d.year) msg += `   📅 Year: ${d.year}\n`
            if (d.rating) msg += `   ⭐ Rating: ${d.rating}\n`
            if (d.episodes) msg += `   📺 Episodes: ${d.episodes}\n`
            if (d.genre) msg += `   🏷️ Genre: ${Array.isArray(d.genre) ? d.genre.join(', ') : d.genre}\n`
            if (d.url) msg += `   🔗 ${d.url}\n`
        }
        msg += `\n╚═══════════════════════╝`
        await reply(msg)
    } catch(e) { reply('❌ Drama search failed. Try again later.') }
} break

case 'movsearch':
case 'searchmovie': {
    await X.sendMessage(m.chat, { react: { text: '🎬', key: m.key } })
    const _mvsq = q?.trim() || text?.trim()
    if (!_mvsq) return reply(`╌══〔 🎬 MOVIE SEARCH 〕═══╌\n║ *Usage:* ${prefix}movsearch [title]\n║ Example: ${prefix}movsearch avengers\n╚═══════════════════════╝`)
    try {
        await reply(`🔍 _Searching movies: ${_mvsq}..._`)
        const _mvsd = await _keithFetch(`/moviebox/search?q=${encodeURIComponent(_mvsq)}`)
        const _mvsr = Array.isArray(_mvsd) ? _mvsd : (_mvsd?.result || _mvsd?.movies || [])
        if (!_mvsr.length) { reply(`❌ No movies found for *${_mvsq}*`); break }
        let msg = `╌══〔 🎬 MOVIE RESULTS 〕═══╌\n`
        for (let mv of _mvsr.slice(0, 5)) {
            msg += `\n🎬 *${mv.title || mv.name}*\n`
            if (mv.year) msg += `   📅 Year: ${mv.year}\n`
            if (mv.rating || mv.imdbRating) msg += `   ⭐ Rating: ${mv.rating || mv.imdbRating}\n`
            if (mv.genre) msg += `   🏷️ Genre: ${Array.isArray(mv.genre) ? mv.genre.join(', ') : mv.genre}\n`
            if (mv.description || mv.plot) msg += `   📝 ${(mv.description || mv.plot || '').slice(0, 100)}...\n`
        }
        msg += `\n╚═══════════════════════╝`
        await reply(msg)
    } catch(e) { reply('❌ Movie search failed. Try again later.') }
} break

case 'trailer':
case 'movietrailer': {
    await X.sendMessage(m.chat, { react: { text: '🎬', key: m.key } })
    const _trq = q?.trim() || text?.trim()
    if (!_trq) return reply(`╌══〔 🎬 MOVIE TRAILER 〕══╌\n║ *Usage:* ${prefix}trailer [movie name]\n║ Example: ${prefix}trailer avengers\n╚═══════════════════════╝`)
    try {
        await reply(`🎬 _Searching trailer for: ${_trq}..._`)
        const _trd = await _keithFetch(`/movie/trailer?q=${encodeURIComponent(_trq)}`)
        const _trr = _trd?.result || _trd
        if (!_trr?.title) {
            // fallback: use youtube search for trailer
            const _yts = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(_trq + ' official trailer')}`)
            const _ythtml = await _yts.text()
            const _ytmatch = _ythtml.match(/\"videoId\":\"([^\"]{11})\"/)
            if (_ytmatch) {
                const _ytUrl = `https://www.youtube.com/watch?v=${_ytmatch[1]}`
                await reply(`🎬 *Trailer: ${_trq}*\n\n🔗 ${_ytUrl}\n\n_Use .ytdl to download the trailer!_`)
            } else throw new Error('No trailer found')
        } else {
            let msg = `╌══〔 🎬 TRAILER 〕═══════╌\n`
            msg += `\n🎬 *${_trr.title}*\n`
            if (_trr.year) msg += `   📅 Year: ${_trr.year}\n`
            if (_trr.rating) msg += `   ⭐ Rating: ${_trr.rating}\n`
            if (_trr.trailerUrl || _trr.url) msg += `\n🔗 *Trailer:* ${_trr.trailerUrl || _trr.url}\n`
            if (_trr.description || _trr.overview) msg += `\n📝 _${(_trr.description || _trr.overview).slice(0, 200)}_\n`
            msg += `\n╚═══════════════════════╝`
            await reply(msg)
        }
    } catch(e) { reply(`❌ Could not find trailer for *${_trq}*. Try another title.`) }
} break



// ── Direct stream lookup: .stream [xcasper-id] [movie|tv] [season?] [ep?]
case 'stream':
case 'getstream':
case 'episode': {
    await X.sendMessage(m.chat, { react: { text: '📺', key: m.key } })
    const _sArgs = text?.trim().split(/\s+/) || []
    const _sId   = _sArgs[0]
    const _sType = (_sArgs[1] || 'movie').toLowerCase()
    const _sSeas = parseInt(_sArgs[2]) || 1
    const _sEp   = parseInt(_sArgs[3]) || 1
    if (!_sId) return reply(
        `╔══〔 📺 STREAM LOOKUP 〕══╗\n\n\n╚═══════════════════════╝` +
        `Usage: *${prefix}stream [id] [movie|tv] [season] [episode]*\n\n` +
        `Examples:\n║ ${prefix}stream 4059 movie\n║ ${prefix}stream 77 tv 1 3\n\n` +
        `_Get the ID from ${prefix}movie search results_`
    )
    try {
        await reply(`📺 _Fetching stream links..._`)
        const _XCASPER = 'https://movieapi.xcasper.space'
        const _isTV = _sType === 'tv'
        const _url = _isTV
            ? `${_XCASPER}/api/showbox/tv?id=${_sId}&season=${_sSeas}&episode=${_sEp}`
            : `${_XCASPER}/api/showbox/movie?id=${_sId}`
        const _sr = await fetch(_url, { signal: AbortSignal.timeout(20000) })
        const _sd = await _sr.json()
        if (!_sd.success || !_sd.data) return reply(`❌ Title ID *${_sId}* not found. Get IDs from *${prefix}movie* search.`)

        const _files = _sd.data.file || []
        const _freeFiles = _files.filter(f => !f.vip_only && f.path && f.path.startsWith('http'))
        const _allFiles  = _files.filter(f => f.path && f.path.startsWith('http'))
        const _title = _sd.data.title || `ID ${_sId}`

        let _msg = `╔══〔 📺 STREAM LINKS 〕══╗\n\n\n╚═══════════════════════╝`
        _msg += `🎬 *${_title}*`
        if (_isTV) _msg += ` — S${_sSeas}E${_sEp}`
        _msg += '\n'
        if (_sd.data.imdb_rating) _msg += `⭐ IMDb: ${_sd.data.imdb_rating}/10\n`

        if (!_allFiles.length) {
            _msg += `\n⚠️ _No stream links available for this title right now._\n`
            _msg += _isTV ? `\nTry a different season/episode.` : `\nThis movie may be VIP-only or not yet available.`
        } else {
            if (_freeFiles.length) {
                _msg += `\n✅ *FREE STREAMS (${_freeFiles.length}):*\n`
                for (const _f of _freeFiles) {
                    _msg += `\n🎞️ *${_f.quality}* ${_f.format ? `(${_f.format.toUpperCase()})` : ''} — ${_f.size || '?'}\n`
                    _msg += `${_f.path}\n`
                }
            }
            const _vipOnly = _allFiles.filter(f => f.vip_only)
            if (_vipOnly.length) {
                _msg += `\n🔒 *VIP QUALITY OPTIONS:* ${_vipOnly.map(f => f.quality).join(', ')}\n`
            }
            _msg += `\n_Open in VLC / MX Player / any video player_`
        }

        if (_isTV && _sd.data.seasons?.length) {
            _msg += `\n\n📺 *Seasons available:* ${_sd.data.seasons.map(s => `S${s.season_num}`).join(', ')}`
            _msg += `\n_Use ${prefix}stream ${_sId} tv [season] [episode] for specific episodes_`
        }
        await reply(_msg)
    } catch(e) {
        reply(`❌ Stream lookup failed: ${e.message}`)
    }
} break

case 'shazam': {
    await X.sendMessage(m.chat, { react: { text: '🎵', key: m.key } })
if (!m.quoted || !/audio|video/.test(m.quoted.mimetype || '')) return reply(`╔══〔 🎵 SHAZAM — SONG FINDER 〕══╗\n\n║ Reply to an audio/video with *${prefix}shazam*\n║ _Works with voice notes, music & video clips._\n╚═══════════════════════╝`)
try {
await reply('🎵 _Listening and identifying the song, please wait..._')
// Download the media buffer
let mediaBuf = await m.quoted.download()
if (!mediaBuf || mediaBuf.length < 100) throw new Error('Failed to download media')
// Save to a temp file
let tmpFile = require("path").join(__dirname, "tmp", `shazam_${Date.now()}.mp3`)
fs.writeFileSync(tmpFile, mediaBuf)
// Upload to CatBox to get a public URL
let audioUrl = await CatBox(tmpFile)
fs.unlinkSync(tmpFile)
if (!audioUrl || !audioUrl.startsWith('http')) throw new Error('Failed to upload audio for recognition')
// Method 1: GiftedTech Shazam API
let shazamResult = null
try {
    let _gtSh = await fetch(`https://api.giftedtech.co.ke/api/search/shazam?apikey=${_giftedKey()}&url=${encodeURIComponent(audioUrl)}`, { signal: AbortSignal.timeout(30000) })
    let _gtShD = await _gtSh.json()
    if (_gtShD.success && _gtShD.result) shazamResult = _gtShD.result
} catch {}
if (shazamResult) {
    let s = shazamResult
    let caption = `╔══〔 🎵 SHAZAM RESULT 〕══╗\n`
    caption += `║ 🎼 *Title* : ${s.title || 'Unknown'}\n`
    caption += `║ 🎤 *Artist* : ${s.artist || 'Unknown'}\n`
    if (s.album) caption += `║ 💿 *Album* : ${s.album}\n`
    if (s.genre) caption += `║ 🎸 *Genre* : ${s.genre}\n`
    if (s.year) caption += `║ 📅 *Year* : ${s.year}\n`
    if (s.spotify) caption += `║ 🟢 *Spotify* : ${s.spotify}\n`
    if (s.apple_music) caption += `║ 🍎 *Apple Music* : ${s.apple_music}\n`
    caption += `╚═══════════════════════╝`
    if (s.coverart) {
        await X.sendMessage(m.chat, { image: { url: s.coverart }, caption }, { quoted: m })
    } else {
        await reply(caption)
    }
    break
}
// Method 2: AudD music recognition API (free, no key required)
let auddForm = new FormData()
auddForm.append('url', audioUrl)
auddForm.append('return', 'apple_music,spotify')
let auddRes = await axios.post('https://api.audd.io/', auddForm, {
    headers: { ...auddForm.getHeaders() },
    timeout: 25000
})
let auddData = auddRes.data
// If AudD returns no result, try again with the raw URL directly
if (!auddData?.result && audioUrl) {
    let retry = await axios.get(`https://api.audd.io/?url=${encodeURIComponent(audioUrl)}&return=apple_music,spotify`, { timeout: 20000 })
    auddData = retry.data
}
if (!auddData?.result) {
    // Fallback: try ACRCloud-compatible free endpoint
    let fallbackForm = new FormData()
    fallbackForm.append('url', audioUrl)
    let fallbackRes = await axios.post('https://api.audd.io/findLyrics/', fallbackForm, {
        headers: { ...fallbackForm.getHeaders() },
        timeout: 20000
    })
    if (fallbackRes.data?.status === 'success' && fallbackRes.data?.result?.length) {
        let topLyric = fallbackRes.data.result[0]
        return reply(`╔═══〔 🎵 SONG FOUND 〕═══╗\n\n║ 🎤 *Title* : ${topLyric.title || 'Unknown'}\n║ 👤 *Artist* : ${topLyric.artist || 'Unknown'}\n\n║ _Lyrics match (fingerprint unavailable)._\n╚═══════════════════════╝`)
    }
    return reply(`╔═════〔 🎵 SHAZAM 〕═════╗\n\n║ ❌ Song not recognized.\n\n║ Use a longer clip (10–30 seconds)\n║ Ensure clear audio, minimal noise\n║ Try the chorus or main melody\n╚═══════════════════════╝`)
}
let r = auddData.result
// Build response
let lines = []
lines.push(`╔══〔 🎵 SONG IDENTIFIED! 〕══╗\n╚═══════════════════════╝`)
lines.push(``)
lines.push(`🎤 *Title:*   ${r.title || 'Unknown'}`)
lines.push(`👤 *Artist:*  ${r.artist || 'Unknown'}`)
if (r.album) lines.push(`💿 *Album:*   ${r.album}`)
if (r.release_date) lines.push(`📅 *Released:* ${r.release_date}`)
if (r.label) lines.push(`🏷️ *Label:*   ${r.label}`)
lines.push(``)
// Apple Music link
if (r.apple_music?.url) {
    lines.push(`🍎 *Apple Music:*`)
    lines.push(`${r.apple_music.url}`)
    lines.push(``)
}
// Spotify link
if (r.spotify?.external_urls?.spotify) {
    lines.push(`🟢 *Spotify:*`)
    lines.push(`${r.spotify.external_urls.spotify}`)
    lines.push(``)
}
// Song preview if available
if (r.apple_music?.previews?.[0]?.url) {
    lines.push(`🔊 *Preview available*`)
    lines.push(``)
}
lines.push(`╚═══════════════════════╝`)
lines.push(`_Powered by Juice v12_`)
let replyText = lines.join('\n')
await reply(replyText)
// Send audio preview if Apple Music preview is available
if (r.apple_music?.previews?.[0]?.url) {
    try {
        let previewBuf = await getBuffer(r.apple_music.previews[0].url)
        if (previewBuf && previewBuf.length > 1000) {
            await X.sendMessage(m.chat, {
                audio: previewBuf,
                mimetype: 'audio/mp4',
                ptt: false
            }, { quoted: m })
        }
    } catch(pe) { /* Preview send failed silently */ }
}
} catch(e) {
console.log('[Shazam] Error:', e.message || e)
reply(`❌ *Shazam failed.*\n_${e.message || 'Unable to identify the song. Try again with a clearer or longer audio clip.'}_`)
}
} break

case 'fetch':
case 'get': {
    await X.sendMessage(m.chat, { react: { text: '📥', key: m.key } })
if (!text) return reply(`╔═══〔 📥 API FETCH 〕════╗\n\n║ Usage: *${prefix}fetch [url]*\n║ Example: ${prefix}fetch https://api.example.com/data\n╚═══════════════════════╝`)
try {
let res = await fetch(text)
let contentType = res.headers.get('content-type') || ''
if (contentType.includes('json')) {
let data = await res.json()
reply(JSON.stringify(data, null, 2).slice(0, 4000))
} else if (contentType.includes('image')) {
let buffer = Buffer.from(await res.arrayBuffer())
await X.sendMessage(m.chat, { image: buffer }, { quoted: m })
} else if (contentType.includes('video')) {
let buffer = Buffer.from(await res.arrayBuffer())
await X.sendMessage(m.chat, { video: buffer }, { quoted: m })
} else if (contentType.includes('audio')) {
let buffer = Buffer.from(await res.arrayBuffer())
await X.sendMessage(m.chat, { audio: buffer, mimetype: 'audio/mpeg' }, { quoted: m })
} else {
let txt = await res.text()
reply(txt.slice(0, 4000))
}
} catch(e) { reply('Error: ' + e.message) }
} break

case 'ssweb':
case 'ssphone':
case 'screenshot':
case 'ss': {
    await X.sendMessage(m.chat, { react: { text: '📸', key: m.key } })
    if (!text || !text.startsWith('http')) return reply(`╌══〔 📸 SCREENSHOT 〕════╌\n║ *Usage:* ${prefix}ss [url]\n║ Example: ${prefix}ss https://google.com\n╚═══════════════════════╝`)
    try {
        await reply(`📸 _Taking screenshot of ${text}..._`)
        let _ssUrl = null
        // Keith API first
        try {
            const _sskd = await _keithFetch(`/tool/screenshot?url=${encodeURIComponent(text)}`)
            if (_sskd?.screenshot) _ssUrl = _sskd.screenshot
            else if (_sskd?.result?.url) _ssUrl = _sskd.result.url
            else if (_sskd?.url) _ssUrl = _sskd.url
        } catch {}
        // Thum.io fallback
        if (!_ssUrl) _ssUrl = `https://image.thum.io/get/width/1280/crop/800/${encodeURIComponent(text)}`
        await safeSendMedia(m.chat, { image: { url: _ssUrl }, caption: `📸 *Screenshot*\n🔗 ${text}` }, {}, { quoted: m })
    } catch(e) { reply('❌ Screenshot failed: ' + e.message) }
} break

case 'webcopier':
case 'sitecopy':
case 'webcopy': {
    await X.sendMessage(m.chat, { react: { text: '💾', key: m.key } })
    if (!text || !text.startsWith('http')) return reply(`╔═══〔 💾 WEB COPIER 〕═══╗\n\n║ Usage: *${prefix}${command} [url]*\n║ Example: ${prefix}${command} https://google.com\n\n║ _Downloads a full offline copy of any website as a ZIP archive._\n╚═══════════════════════╝`)
    try {
        await reply('💾 _Copying website, please wait..._')
        let _wcRes = await fetch(`https://eliteprotech-apis.zone.id/webcopier?url=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(45000) })
        let _wcd   = await _wcRes.json()
        if (_wcd.success && _wcd.download) {
            reply(`╔═══〔 💾 WEB COPIER 〕═══╗\n\n║ ✅ *Website copied successfully!*\n\n║ 🔗 *Source* : ${text}\n║ 📦 *Download ZIP* : ${_wcd.download}\n\n║ _Click the link above to download the full website archive._\n╚═══════════════════════╝`)
        } else {
            reply('❌ Could not copy this website. Make sure the URL is accessible and try again.')
        }
    } catch(e) { reply(`❌ Web copier failed.\n_${e.message}_`) }
} break

case 'trt':
case 'translate':
case 'tr': {
    await X.sendMessage(m.chat, { react: { text: '🌐', key: m.key } })
    if (!text) return reply(`╌══〔 🌐 TRANSLATOR 〕═════╌\n║ *Usage:* ${prefix}translate [lang]|[text]\n║ *Reply:* ${prefix}translate [lang]\n║\n║ *Codes:* en fr es de ar zh sw pt ru ja\n╚═══════════════════════╝`)
    try {
        let targetLang = 'en', inputText = ''
        if (text.includes('|')) { const parts = text.split('|'); targetLang = parts[0].trim(); inputText = parts.slice(1).join('|').trim() }
        else if (m.quoted) { targetLang = text.trim() || 'en'; inputText = m.quoted.text || m.quoted.body || '' }
        else { inputText = text }
        if (!inputText) return reply('❌ Please provide text to translate.')
        await reply(`🌐 _Translating to ${targetLang.toUpperCase()}..._`)
        let _trResult = null
        // Keith API first
        try {
            const _trkd = await _keithFetch(`/translate?q=${encodeURIComponent(inputText)}&to=${encodeURIComponent(targetLang)}`)
            if (_trkd?.translated) _trResult = _trkd.translated
            else if (_trkd?.result?.translated) _trResult = _trkd.result.translated
            else if (typeof _trkd?.result === 'string') _trResult = _trkd.result
        } catch {}
        // MyMemory fallback
        if (!_trResult) {
            const _mm = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(inputText)}&langpair=auto|${targetLang}`, { signal: AbortSignal.timeout(12000) })
            const _mmd = await _mm.json()
            _trResult = _mmd.responseData?.translatedText || null
        }
        if (!_trResult) throw new Error('Translation failed')
        await reply(`╌══〔 🌐 TRANSLATION 〕════╌\n\n📝 *Original:* _${inputText}_\n\n💬 *${targetLang.toUpperCase()}:*\n${_trResult}\n╚═══════════════════════╝`)
    } catch(e) { reply('❌ Translation failed: ' + e.message) }
} break

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔊  TEXT TO SPEECH
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  case 'tts':
  case 'speak':
  case 'say': {
      await X.sendMessage(m.chat, { react: { text: '🔊', key: m.key } })
      let _ttsText = text || (m.quoted ? (m.quoted.text || m.quoted.body || '') : '')
      let _ttsLang = 'en'
      if (!_ttsText) return reply(`╔══〔 🔊 TEXT TO SPEECH 〕══╗\n\n║ *Usage:*\n║ *${prefix}tts* [text]\n║ *${prefix}tts* [lang]|[text]\n║ Reply to text with *${prefix}tts*\n║\n║ *Languages:* en · es · fr · de · ar\n║   pt · hi · zh · ja · ko · ru\n╚═══════════════════════╝`)
      if (_ttsText.includes('|')) {
          const _sp = _ttsText.split('|')
          _ttsLang = _sp[0].trim().toLowerCase() || 'en'
          _ttsText = _sp.slice(1).join('|').trim()
      }
      if (!_ttsText) return reply('❌ Please provide text to convert to speech.')
      if (_ttsText.length > 200) _ttsText = _ttsText.slice(0, 200)
      try {
          let _ttsAudio = null
          // Method 1: Keith API TTS
          try {
              const _kth = await _keithFetch(`/tts?text=${encodeURIComponent(_ttsText)}&lang=${encodeURIComponent(_ttsLang)}`, 30000)
              if (_kth?.url) {
                  const _rb = await fetch(_kth.url, { signal: AbortSignal.timeout(20000) })
                  if (_rb.ok) _ttsAudio = Buffer.from(await _rb.arrayBuffer())
              }
          } catch {}
          // Method 2: Google Translate TTS (no key)
          if (!_ttsAudio) {
              try {
                  const _gtUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(_ttsLang)}&client=tw-ob&q=${encodeURIComponent(_ttsText)}`
                  const _gtRes = await fetch(_gtUrl, {
                      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36' },
                      signal: AbortSignal.timeout(20000)
                  })
                  if (_gtRes.ok) {
                      const _ct = _gtRes.headers.get('content-type') || ''
                      if (_ct.includes('audio') || _ct.includes('mpeg')) {
                          _ttsAudio = Buffer.from(await _gtRes.arrayBuffer())
                      }
                  }
              } catch {}
          }
          // Method 3: VoiceRSS-style fallback via Keith translate endpoint
          if (!_ttsAudio) {
              try {
                  const _vRes = await fetch(`https://apiskeith.top/api/tts?text=${encodeURIComponent(_ttsText)}&language=${encodeURIComponent(_ttsLang)}`, {
                      signal: AbortSignal.timeout(25000)
                  })
                  if (_vRes.ok) {
                      const _vct = _vRes.headers.get('content-type') || ''
                      if (_vct.includes('audio') || _vct.includes('mpeg') || _vct.includes('wav')) {
                          _ttsAudio = Buffer.from(await _vRes.arrayBuffer())
                      } else {
                          const _vd = await _vRes.json().catch(() => null)
                          if (_vd?.url) {
                              const _vAB = await fetch(_vd.url, { signal: AbortSignal.timeout(15000) })
                              if (_vAB.ok) _ttsAudio = Buffer.from(await _vAB.arrayBuffer())
                          }
                      }
                  }
              } catch {}
          }
          if (!_ttsAudio || _ttsAudio.length < 500) throw new Error('TTS service unavailable. Try again shortly.')
          await X.sendMessage(m.chat, {
              audio: _ttsAudio,
              mimetype: 'audio/mpeg',
              fileName: 'tts.mp3',
              ptt: true
          }, { quoted: m })
      } catch(e) { reply(`❌ *TTS failed:* ${e.message}`) }
  } break
  

case 'transcribe': {
    await X.sendMessage(m.chat, { react: { text: '🎙️', key: m.key } })
if (!m.quoted || !/audio|video/.test(m.quoted.mimetype || ''))
    return reply(`╔══〔 🎙️ VOICE TRANSCRIBER 〕══╗\n\n║ Reply to a voice note or audio with\n║ *${prefix}transcribe*\n║ _Converts speech to text automatically._\n╚═══════════════════════╝`)
try {
    await reply('🎙️ _Transcribing audio, please wait..._')
    const _tcBuf = await m.quoted.download()
    if (!_tcBuf || _tcBuf.length < 100) throw new Error('Failed to download audio')
    const _tcPath = require('path').join(__dirname, 'tmp', `tc_${Date.now()}.mp3`)
    fs.writeFileSync(_tcPath, _tcBuf)
    const _tcUrl = await CatBox(_tcPath)
    fs.unlinkSync(_tcPath)
    if (!_tcUrl || !_tcUrl.startsWith('http')) throw new Error('Audio upload failed')
    let _tcText = null
    // Method 1: HuggingFace Whisper public inference (free, no key required)
    try {
        const _hfRes = await fetch('https://api-inference.huggingface.co/models/openai/whisper-small', {
            method: 'POST', headers: { 'Content-Type': 'application/octet-stream' },
            body: _tcBuf, signal: AbortSignal.timeout(45000)
        })
        const _hfData = await _hfRes.json()
        if (_hfData?.text && _hfData.text.trim().length > 2) _tcText = _hfData.text.trim()
    } catch {}
    // Method 2: GiftedTech totext (tries the URL against their API)
    if (!_tcText) try {
        const _gtRes = await fetch(`https://api.giftedtech.co.ke/api/tools/totext?apikey=${_giftedKey()}&url=${encodeURIComponent(_tcUrl)}`, { signal: AbortSignal.timeout(30000) })
        const _gtData = await _gtRes.json()
        if (_gtData?.success && typeof _gtData.result === 'string' && _gtData.result.trim().length > 2) _tcText = _gtData.result.trim()
    } catch {}
    // Method 3: Whisper large-v3 via HuggingFace (better accuracy)
    if (!_tcText) try {
        const _hf2Res = await fetch('https://api-inference.huggingface.co/models/openai/whisper-large-v3', {
            method: 'POST', headers: { 'Content-Type': 'application/octet-stream' },
            body: _tcBuf, signal: AbortSignal.timeout(60000)
        })
        const _hf2Data = await _hf2Res.json()
        if (_hf2Data?.text && _hf2Data.text.trim().length > 2) _tcText = _hf2Data.text.trim()
    } catch {}
    if (_tcText) {
        reply(`╔══〔 🎙️ TRANSCRIPTION 〕══╗\n\n${_tcText}\n╚═══════════════════════╝`)
    } else {
        reply(`╔══〔 🎙️ TRANSCRIPTION 〕══╗\n\n║ ⚠️ _Could not auto-transcribe this audio._\n\n║ Try these alternatives:\n║ *${prefix}shazam* : identify music\n║ *${prefix}ai* [describe what you heard]\n╚═══════════════════════╝`)
    }
} catch (e) { reply('❌ Transcription failed: ' + e.message) }
} break

case 'locate':
case 'location': {
    await X.sendMessage(m.chat, { react: { text: '📍', key: m.key } })
if (!text) return reply(`╔════〔 📍 LOCATION 〕════╗\n\n║ Usage: *${prefix}location [city / address]*\n║ Example: ${prefix}location Nairobi, Kenya\n╚═══════════════════════╝`)
try {
let res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=1`, { headers: { 'User-Agent': 'ToosiiBot/1.0' } })
let data = await res.json()
if (!data.length) return reply('╔══〔 ⚠️ WEATHER 〕══╗\n\n║ Location not found.\n║ Try a different city name.\n╚═══════════════════════╝')
let loc = data[0]
await X.sendMessage(m.chat, { location: { degreesLatitude: parseFloat(loc.lat), degreesLongitude: parseFloat(loc.lon) }, caption: loc.display_name }, { quoted: m })
} catch(e) { reply('Error: ' + e.message) }
} break

case 'tourl': {
    await X.sendMessage(m.chat, { react: { text: '🔗', key: m.key } })
// Upload any media (image/video/audio/doc/sticker) and return a public CDN link
if (!m.quoted) return reply(`📎 *Reply to any media* (image, video, audio, doc, sticker) with *${prefix}tourl*`)
try {
    await reply('📤 _Uploading media..._')
    const _buf = await m.quoted.download()