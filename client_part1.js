//═════════════════════════════════//

/*
🔗 Juice v12 Bot System
by Juice v12 • 2024 - 2026

>> Contact Links:
・WhatsApp : wa.me/254753204154
・Telegram : t.me/juicev12
*/

//═════════════════════════════════//
 
//━━━━━━━━━━━━━━━━━━━━━━━━//
// Module
require("./setting")
const {
    downloadContentFromMessage,
    proto,
    generateWAMessageContent,
    generateWAMessageFromContent,
    areJidsSameUser,
    useMultiFileAuthState,
    Browsers,
  } = require("gifted-baileys")
  // delay is a baileys util; polyfill for forward-compat
  const delay = require("gifted-baileys").delay
    ?? ((ms) => new Promise(r => setTimeout(r, ms)))
  const os = require('os')
const fs = require('fs')
const fg = require('api-dylux')
const fetch = require('node-fetch');
// Safe JSON fetch — never throws "not valid JSON", returns null on HTML/error responses
const safeJson = async (url, opts = {}) => {
    try {
        const r = await fetch(url, { ...opts, headers: { 'User-Agent': 'TOOSII-XD-ULTRA/2.0', ...(opts.headers || {}) } })
        const text = await r.text()
        if (text.trimStart().startsWith('<')) return null  // HTML response (404 page etc)
        return JSON.parse(text)
    } catch { return null }
}
// Patch fetch Response to never throw on HTML — returns null instead
const _origJson = require('node-fetch').Response.prototype.json
require('node-fetch').Response.prototype.json = async function() {
    const text = await this.text()
    if (text.trimStart().startsWith('<')) {
        console.warn('[API] HTML response received instead of JSON — API may be down')
        return null
    }
    try { return JSON.parse(text) } catch(e) {
        console.warn('[API] Invalid JSON response:', text.slice(0, 80))
        return null
    }
}

const util = require('util')

  //═══════════════════════════════════════════════════════════════════════════//
  // ── GiftedTech key rotator + Endless Invidious pool ──────────────────────//
  //═══════════════════════════════════════════════════════════════════════════//

  // Key pool: set GIFTED_API_KEYS=key1,key2,key3 in .env for endless rotation
  // Falls back to the free 'gifted' key if no custom keys are configured
  const _GIFTED_POOL = (() => {
      const raw = process.env.GIFTED_API_KEYS || process.env.GIFTED_API_KEY || ''
      const keys = raw.split(',').map(k => k.trim()).filter(Boolean)
      return [...new Set([...keys, 'gifted'])]
  })()
  let _giftedIdx = 0
  // Returns next key in round-robin order
  function _giftedKey() {
      const key = _GIFTED_POOL[_giftedIdx % _GIFTED_POOL.length]
      _giftedIdx = (_giftedIdx + 1) % _GIFTED_POOL.length
      return key
  }
  // giftedFetch: auto-rotates keys, retries all keys on rate-limit (403)
  async function giftedFetch(urlTemplate, opts = {}) {
      let lastData = null
      const tried = new Set()
      for (let attempt = 0; attempt < _GIFTED_POOL.length * 2; attempt++) {
          const key = _giftedKey()
          if (tried.has(key) && tried.size >= _GIFTED_POOL.length) break
          tried.add(key)
          const url = urlTemplate.replace(/apikey=[^&s`'"]+/g, `apikey=${key}`)
          try {
              const r = await fetch(url, { ...opts })
              const data = await r.json()
              if (!data) continue
              const msg = (data.message || '').toLowerCase()
              const isRateLimit = data.status === 403 ||
                  (data.success === false && (msg.includes('limit') || msg.includes('exceeded') || msg.includes('invalid') && msg.includes('key')))
              if (isRateLimit) { lastData = data; continue }
              return data
          } catch(e) { lastData = { success: false, message: e.message } }
      }
      return lastData || { success: false, message: 'All API keys exhausted' }
  }

  // ── Endless Invidious pool — starts with 20 known instances, auto-refreshes hourly ──
  let _invPool = [
      'https://invidious.privacydev.net',  'https://inv.tux.pizza',
      'https://invidious.nerdvpn.de',      'https://invidious.fdn.fr',
      'https://iv.datura.network',         'https://invidious.perennialte.ch',
      'https://yewtu.be',                  'https://invidious.kavin.rocks',
      'https://invidious.projectsegfau.lt','https://invidious.flokinet.to',
      'https://vid.puffyan.us',            'https://y.com.sb',
      'https://invidious.slipfox.xyz',     'https://invidious.snopyta.org',
      'https://invidious.tiekoetter.com',  'https://invidious.esmailelbob.xyz',
      'https://invidious.poast.org',       'https://inv.riverside.rocks',
      'https://invidious.dhusch.de',       'https://invidious.namazso.eu',
  ]
  let _invLastRefresh = 0
  async function _refreshInvPool() {
      try {
          const r = await fetch('https://api.invidious.io/instances.json', { signal: AbortSignal.timeout(12000) })
          const data = await r.json()
          if (!Array.isArray(data)) return
          const live = data
              .filter(([, info]) => info?.api && info?.type === 'https')
              .map(([uri]) => uri)
          if (live.length >= 5) {
              _invPool = live
              console.log(`[INVIDIOUS] Pool updated: ${live.length} live instances`)
          }
          _invLastRefresh = Date.now()
      } catch(e) { console.log('[INVIDIOUS] Refresh failed:', e.message) }
  }
  async function getInvPool() {
      if (Date.now() - _invLastRefresh > 3600000) _refreshInvPool().catch(() => {})
      return _invPool
  }

  //══════════════════════════════════════════════════════════════════════════//
  // ── Multi-source Sports Data Helpers (endless fallback chain) ─────────────//
  // Sources: GiftedTech → ESPN (keyless) → TheSportsDB (keyless) → Football-Data.org
  //═══════════════════════════════════════════════════════════════════════════//

  const _ESPN_IDS  = { epl:'eng.1', laliga:'esp.1', bundesliga:'ger.1', seriea:'ita.1', ucl:'uefa.champions', uel:'uefa.europa', ligue1:'fra.1' }
  const _TSDB_IDS  = { epl:4328, laliga:4335, bundesliga:4331, seriea:4332, ucl:4480, ligue1:4334, uel:4481 }
  const _FD_CODES  = { epl:'PL', laliga:'PD', bundesliga:'BL1', seriea:'SA', ucl:'CL', uel:'EL', ligue1:'FL1' }

  // ── ESPN unofficial standings ─────────────────────────────────────────────
  async function _espnStandings(league) {
      try {
          const id = _ESPN_IDS[league]; if (!id) return null
          const d = await safeJson(`https://site.api.espn.com/apis/v2/sports/soccer/${id}/standings`, { signal: AbortSignal.timeout(12000) })
          const entries = d?.standings?.[0]?.entries || d?.children?.[0]?.standings?.[0]?.entries
          if (!entries?.length) return null
          return entries.map((e, i) => ({
              position: i + 1,
              team: e.team?.displayName || e.team?.shortDisplayName || '',
              played:  +( e.stats?.find(s => s.name==='gamesPlayed')?.value  || 0),
              won:     +( e.stats?.find(s => s.name==='wins')?.value          || 0),
              draw:    +( e.stats?.find(s => s.name==='ties')?.value          || 0),
              lost:    +( e.stats?.find(s => s.name==='losses')?.value        || 0),
              goalDifference: +( e.stats?.find(s => s.name==='pointDifferential'||s.name==='goalDifferential')?.value || 0),
              points:  +( e.stats?.find(s => s.name==='points')?.value        || 0),
          }))
      } catch { return null }
  }

  // ── TheSportsDB standings ─────────────────────────────────────────────────
  async function _tsdbStandings(league) {
      try {
          const id = _TSDB_IDS[league]; if (!id) return null
          const yr = new Date().getFullYear()
          const d = await safeJson(`https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l=${id}&s=${yr-1}-${yr}`, { signal: AbortSignal.timeout(12000) })
          if (!d?.table?.length) return null
          return d.table.map(t => ({
              position: +t.intRank||0, team: t.strTeam||'',
              played: +t.intPlayed||0, won: +t.intWin||0, draw: +t.intDraw||0,
              lost: +t.intLoss||0, goalDifference: +t.intGoalDifference||0, points: +t.intPoints||0,
          }))
      } catch { return null }
  }

  // ── Football-Data.org standings (uses FOOTBALL_DATA_API_KEY env var if set) ─
  async function _fdStandings(league) {
      try {
          const code = _FD_CODES[league]; if (!code) return null
          const hdrs = {}; if (process.env.FOOTBALL_DATA_API_KEY) hdrs['X-Auth-Token'] = process.env.FOOTBALL_DATA_API_KEY
          const d = await safeJson(`https://api.football-data.org/v4/competitions/${code}/standings`, { headers: hdrs, signal: AbortSignal.timeout(12000) })
          const table = d?.standings?.find(s => s.type==='TOTAL')?.table; if (!table?.length) return null
          return table.map(t => ({ position: t.position, team: t.team?.name||'', played: t.playedGames||0, won: t.won||0, draw: t.draw||0, lost: t.lost||0, goalDifference: t.goalDifference||0, points: t.points||0 }))
      } catch { return null }
  }

  // ── Master standings: GiftedTech → ESPN → TheSportsDB → Football-Data ───────
  // ── Keith API (apiskeith.top) — free, no key, primary sports source ─────────
  const _KEITH_BASE = 'https://apiskeith.top'
  const _KEITH_LEAGUES = { epl: 'epl', laliga: 'laliga', ucl: 'ucl', bundesliga: 'bundesliga', seriea: 'seriea', ligue1: 'ligue1', euros: 'euros', fifa: 'fifa' }
  async function _keithFetch(path) {
      try {
          const r = await fetch(`${_KEITH_BASE}${path}`, { signal: AbortSignal.timeout(15000) })
          const d = await r.json()
          if (d?.status) return d.result
      } catch {}
      return null
  }

  async function _getStandings(league, gtPath) {
      // Keith first — free, no key, most up-to-date data
      const _kl = _KEITH_LEAGUES[league]
      if (_kl) { try { const _kd = await _keithFetch(`/${_kl}/standings`); const _kt = _kd?.standings || _kd; if (Array.isArray(_kt) && _kt.length) return _kt } catch {} }
      // GiftedTech fallback
      try {
          const d = await giftedFetch(`https://api.giftedtech.co.ke/api/football/${gtPath}/standings?apikey=gifted`, { signal: AbortSignal.timeout(20000) })
          const t = d?.result?.standings || d?.result; if (Array.isArray(t) && t.length) return t
      } catch {}
      return (await _espnStandings(league)) || (await _tsdbStandings(league)) || (await _fdStandings(league))
  }

  // ── ESPN top scorers ──────────────────────────────────────────────────────
  async function _espnScorers(league) {
      try {
          const id = _ESPN_IDS[league]; if (!id) return null
          const d = await safeJson(`https://site.web.api.espn.com/apis/v2/sports/soccer/${id}/leaders`, { signal: AbortSignal.timeout(12000) })
          const cats = d?.leaders || []; const goals = cats.find(c => c.name==='goals' || c.shortDisplayName?.toLowerCase().includes('goal'))
          if (!goals?.leaders?.length) return null
          return goals.leaders.map((l, i) => ({ rank: i+1, player: l.athlete?.displayName||l.athlete?.fullName||'', team: l.team?.displayName||l.team?.abbreviation||'', goals: l.value||0, played: l.gamesPlayed||0 }))
      } catch { return null }
  }

  // ── Football-Data.org scorers ────────────────────────────────────────────
  async function _fdScorers(league) {
      try {
          const code = _FD_CODES[league]; if (!code) return null
          const hdrs = {}; if (process.env.FOOTBALL_DATA_API_KEY) hdrs['X-Auth-Token'] = process.env.FOOTBALL_DATA_API_KEY
          const d = await safeJson(`https://api.football-data.org/v4/competitions/${code}/scorers`, { headers: hdrs, signal: AbortSignal.timeout(12000) })
          if (!d?.scorers?.length) return null
          return d.scorers.map((s, i) => ({ rank: i+1, player: s.player?.name||'', team: s.team?.name||'', goals: s.goals||0, assists: s.assists||0, played: s.playedMatches||0 }))
      } catch { return null }
  }

  // ── Master scorers: GiftedTech → ESPN → Football-Data ────────────────────
  // ── Master scorers: Keith → GiftedTech → ESPN → Football-Data ─────────────
  async function _getScorers(league, gtPath, label) {
      const _kl = _KEITH_LEAGUES[league]
      if (_kl) { try { const _kd = await _keithFetch(`/${_kl}/scorers`); const _ks = _kd?.topScorers || _kd?.scorers || _kd; if (Array.isArray(_ks) && _ks.length) return _ks } catch {} }
      try {
          const d = await giftedFetch(`https://api.giftedtech.co.ke/api/football/${gtPath}/scorers?apikey=gifted`, { signal: AbortSignal.timeout(20000) })
          const sc = d?.result?.topScorers || d?.result?.scorers || d?.result; if (Array.isArray(sc) && sc.length) return sc
      } catch {}
      return (await _espnScorers(league)) || (await _fdScorers(league))
  }
  // ── ESPN fixtures/scoreboard ──────────────────────────────────────────────
  async function _espnFixtures(league) {
      try {
          const id = _ESPN_IDS[league]; if (!id) return null
          const d = await safeJson(`https://site.api.espn.com/apis/v2/sports/soccer/${id}/scoreboard`, { signal: AbortSignal.timeout(12000) })
          if (!d?.events?.length) return null
          return d.events.map(e => {
              const comp = e.competitions?.[0]; const comps = comp?.competitors||[]
              const home = comps.find(c => c.homeAway==='home'); const away = comps.find(c => c.homeAway==='away')
              const st = comp?.status?.type
              return { homeTeam: home?.team?.displayName||'', awayTeam: away?.team?.displayName||'', date: e.date?.slice(0,10)||'', time: e.date?.slice(11,16)||'', venue: comp?.venue?.fullName||'', status: st?.description||st?.name||'', homeScore: home?.score, awayScore: away?.score }
          })
      } catch { return null }
  }

  // ── TheSportsDB next matches ──────────────────────────────────────────────
  async function _tsdbFixtures(league) {
      try {
          const id = _TSDB_IDS[league]; if (!id) return null
          const d = await safeJson(`https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=${id}`, { signal: AbortSignal.timeout(12000) })
          if (!d?.events?.length) return null
          return d.events.map(e => ({ homeTeam: e.strHomeTeam||'', awayTeam: e.strAwayTeam||'', date: e.dateEvent||'', time: e.strTime||'', venue: e.strVenue||'' }))
      } catch { return null }
  }

  // ── Football-Data.org scheduled matches ──────────────────────────────────
  async function _fdFixtures(league) {
      try {
          const code = _FD_CODES[league]; if (!code) return null
          const hdrs = {}; if (process.env.FOOTBALL_DATA_API_KEY) hdrs['X-Auth-Token'] = process.env.FOOTBALL_DATA_API_KEY
          const d = await safeJson(`https://api.football-data.org/v4/competitions/${code}/matches?status=SCHEDULED`, { headers: hdrs, signal: AbortSignal.timeout(12000) })
          if (!d?.matches?.length) return null
          return d.matches.map(m => ({ homeTeam: m.homeTeam?.name||'', awayTeam: m.awayTeam?.name||'', date: m.utcDate?.slice(0,10)||'', time: m.utcDate?.slice(11,16)||'' }))
      } catch { return null }
  }

  // ── Master fixtures: GiftedTech → ESPN → TheSportsDB → Football-Data ─────
  // ── Master fixtures: Keith → GiftedTech → ESPN → TheSportsDB → Football-Data
  async function _getFixtures(league, gtUrl) {
      const _kl = _KEITH_LEAGUES[league]
      if (_kl) { try { const _kd = await _keithFetch(`/${_kl}/upcomingmatches`); const _km = _kd?.upcomingMatches || _kd?.matches || _kd; if (Array.isArray(_km) && _km.length) return _km.map(x => ({ homeTeam: x.homeTeam||x.home_team||'', awayTeam: x.awayTeam||x.away_team||'', date: x.date||'', time: x.time||'', status: x.status||'' })) } catch {} }
      try {
          const d = await giftedFetch(gtUrl, { signal: AbortSignal.timeout(20000) })
          const m = d?.result?.upcomingMatches || d?.result?.matches || d?.result; if (Array.isArray(m) && m.length) return m
      } catch {}
      return (await _espnFixtures(league)) || (await _tsdbFixtures(league)) || (await _fdFixtures(league))
  }
  // ── Multi-source live scores ──────────────────────────────────────────────
  async function _getLiveScores() {
      // Source 1: Keith API (apiskeith.top)
      try {
          const _kld = await _keithFetch('/livescore')
          if (_kld?.games) {
              const _klm = Object.values(_kld.games).map(g => ({ homeTeam: g.p1||'', awayTeam: g.p2||'', homeScore: g.R?.r1||'0', awayScore: g.R?.r2||'0', status: g.R?.st||'LIVE', date: g.dt||'', time: g.tm||'' }))
              if (_klm.length) return { source: 'Keith', matches: _klm }
          }
      } catch {}
      // Source 2: GiftedTech
      try {
          const d = await giftedFetch(`https://api.giftedtech.co.ke/api/football/livescore?apikey=gifted`, { signal: AbortSignal.timeout(20000) })
          const m = d?.result?.matches || d?.result; if (Array.isArray(m) && m.length) return { source: 'GiftedTech', matches: m }
      } catch {}
      // Source 3: ESPN across top leagues (live events)
      try {
          const leagues = ['eng.1','esp.1','ger.1','ita.1','fra.1','uefa.champions']
          const live = []
          await Promise.allSettled(leagues.map(async id => {
              const d = await safeJson(`https://site.api.espn.com/apis/v2/sports/soccer/${id}/scoreboard`, { signal: AbortSignal.timeout(10000) })
              ;(d?.events || []).filter(e => e.status?.type?.state === 'in').forEach(e => {
                  const c = e.competitions?.[0]; const cp = c?.competitors||[]
                  const h = cp.find(x=>x.homeAway==='home'); const a = cp.find(x=>x.homeAway==='away')
                  live.push({ league: e.name||id, homeTeam: h?.team?.displayName||'', awayTeam: a?.team?.displayName||'', homeScore: h?.score||'0', awayScore: a?.score||'0', status: c?.status?.type?.shortDetail||'LIVE' })
              })
          }))
          if (live.length) return { source: 'ESPN', matches: live }
      } catch {}
      // Source 4: TheSportsDB live events
      try {
          const d = await safeJson(`https://www.thesportsdb.com/api/v1/json/3/eventslive.php`, { signal: AbortSignal.timeout(10000) })
          const events = d?.events
          if (Array.isArray(events) && events.length) {
              const matches = events.filter(e => e.strSport==='Soccer').map(e => ({ league: e.strLeague||'', homeTeam: e.strHomeTeam||'', awayTeam: e.strAwayTeam||'', homeScore: e.intHomeScore||'', awayScore: e.intAwayScore||'', status: e.strProgress||'LIVE' }))
              if (matches.length) return { source: 'TheSportsDB', matches }
          }
      } catch {}
      return null
  }

  // ── Multi-source football news (BBC/ESPN RSS + GiftedTech) ────────────────
  async function _getFootballNews() {
      // Source 1: Keith API (apiskeith.top)
      try {
          const _knd = await _keithFetch('/football/news')
          const _kni = _knd?.data?.items || _knd?.items
          if (Array.isArray(_kni) && _kni.length) return _kni.map(x => ({ title: x.title||'', summary: x.summary||'' }))
      } catch {}
      // Source 2: GiftedTech
      try {
          const d = await giftedFetch(`https://api.giftedtech.co.ke/api/football/news?apikey=gifted`, { signal: AbortSignal.timeout(20000) })
          const a = d?.result?.items || d?.result; if (Array.isArray(a) && a.length) return a
      } catch {}
      // Source 3: ESPN soccer RSS
      try {
          const r = await fetch(`https://www.espn.com/espn/rss/soccer/news`, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'Mozilla/5.0' } })
          const xml = await r.text()
          const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
              const title = m[1].match(/<title><![CDATA[(.*?)]]>/)?.[1] || m[1].match(/<title>(.*?)<\/title>/)?.[1] || ''
              const link  = m[1].match(/<link>(.*?)<\/link>/)?.[1] || ''
              const desc  = m[1].match(/<description><![CDATA[(.*?)]]>/)?.[1]?.replace(/<[^>]+>/g,'')?.slice(0,120) || ''
              return { title, summary: desc, link }
          }).filter(a => a.title)
          if (items.length) return items
      } catch {}
      // Source 4: BBC Sport football RSS
      try {
          const r = await fetch(`https://feeds.bbci.co.uk/sport/football/rss.xml`, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'Mozilla/5.0' } })
          const xml = await r.text()
          const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
              const title = m[1].match(/<title>(.*?)<\/title>/)?.[1]?.replace(/<![CDATA[|]]>/g,'').replace(/&amp;/g,'&')||''
              const link  = m[1].match(/<link>(.*?)<\/link>/)?.[1] || ''
              return { title, link }
          }).filter(a => a.title)
          if (items.length) return items
      } catch {}
      return null
  }

  // ── Multi-source predictions (GiftedTech + ESPN form-based) ──────────────
  async function _getPredictions() {
      // Source 1: Keith API bet tips (apiskeith.top/bet)
      try {
          const _kpd = await _keithFetch('/bet')
          if (Array.isArray(_kpd) && _kpd.length) return _kpd.map(x => ({ league: x.league||'', match: x.match||'', time: x.time||'', result: x.result||'', predictions: x.predictions||{} }))
      } catch {}
      // Source 2: GiftedTech
      try {
          const d = await giftedFetch(`https://api.giftedtech.co.ke/api/football/predictions?apikey=gifted`, { signal: AbortSignal.timeout(20000) })
          const p = Array.isArray(d?.result) ? d.result : (d?.result?.items||[]); if (p.length) return p
      } catch {}
      // Source 3: Footystats upcoming (unofficial, no key for basic access)
      try {
          const d = await safeJson('https://api.football-prediction-api.com/api/v2/predictions?market=classic&iso_date=' + new Date().toISOString().slice(0,10), { headers: { 'Authorization': 'Bearer free' }, signal: AbortSignal.timeout(10000) })
          if (d?.data?.length) return d.data.slice(0,10).map(m => ({ league: m.competition_name||'', match: `${m.home_team} vs ${m.away_team}`, time: m.start_date||'', predictions: { fulltime: { home: m.home_win_probability||0, draw: m.draw_probability||0, away: m.away_win_probability||0 } } }))
      } catch {}
      return null
  }

  //─────────────────────────────────────────────────────────────────────────────//
    // Kick off background refresh 5s after startup
  setTimeout(() => _refreshInvPool().catch(() => {}), 5000)

  //─────────────────────────────────────────────────────────────────────────────//
  const axios = require('axios')
const { exec, execSync } = require("child_process")
const chalk = require('chalk')
const nou = require('node-os-utils')
const moment = require('moment-timezone');
const path = require ('path');
const didyoumean = require('didyoumean');
const similarity = require('similarity');
const speed = require('performance-now')
const { Sticker } = require('wa-sticker-formatter');
const { igdl } = require("btch-downloader");
const yts = require ('yt-search');
const FormData = require('form-data');
//> Scrape <//
const jktNews = require('./library/scrape/jktNews');
const otakuDesu = require('./library/scrape/otakudesu');
const Kusonime = require('./library/scrape/kusonime');
const { quote } = require('./library/scrape/quote.js');
const { fdown } = require('./library/scrape/facebook.js')

const {
        komiku,
        detail
} = require('./library/scrape/komiku');

const {
        wikimedia
} = require('./library/scrape/wikimedia');

const { 
        CatBox, 
        uploadImage
} = require('./library/scrape/uploader');

//━━━━━━━━━━━━━━━━━━━━━━━━//
// ChatBoAI core function — Anthropic API primary, Pollinations fallback
// Always responds in English regardless of input language
async function _runChatBoAI(userMsg, isAutoMode = false) {
    const _sys = isAutoMode
        ? `You are a friendly WhatsApp assistant. Always reply in English only, regardless of the language the user writes in. Keep replies short and conversational — 2 to 4 sentences max. Never use markdown formatting like ** or ##.`
        : `You are ChatBoAI, a smart and helpful assistant. Always reply in English only, no matter what language the user writes in. Be clear, accurate, and helpful. Avoid markdown formatting.`

    // 1. Anthropic Claude API (most reliable)
    try {
        const { default: fetch } = require('node-fetch')
        const _r1 = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY || '',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 500,
                system: _sys,
                messages: [{ role: 'user', content: userMsg }]
            }),
            signal: AbortSignal.timeout(15000)
        })
        const _d1 = await _r1.json()
        const _t1 = _d1?.content?.[0]?.text?.trim()
        if (_t1?.length > 2) return _t1
    } catch {}

    // 2. Pollinations OpenAI-compatible (free, no key needed)
    try {
        const axios = require('axios')
        const { data: _d2 } = await axios.post('https://text.pollinations.ai/openai', {
            model: 'openai',
            messages: [{ role: 'system', content: _sys }, { role: 'user', content: userMsg }],
            stream: false
        }, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 })
        const _t2 = _d2?.choices?.[0]?.message?.content?.trim()
        if (_t2?.length > 2) return _t2
    } catch {}

    // 3. Pollinations GET fallback
    try {
        const axios = require('axios')
        const _p3 = encodeURIComponent(`${_sys}\n\nUser: ${userMsg}\n\nAssistant:`)
        const { data: _d3 } = await axios.get(`https://text.pollinations.ai/${_p3}`, { timeout: 12000, responseType: 'text' })
        if (_d3 && typeof _d3 === 'string' && _d3.trim().length > 2) return _d3.trim()
    } catch {}

    throw new Error('All AI services unavailable')
}

// ── General-purpose AI helper — used by all named AI commands ────────────────
// (.feloai, .claudeai, .deepseek, .grok, .mistral, .copilot, etc.)
async function _runAI(systemPrompt, userMsg, maxTokens = 1500) {
    // Embed system prompt into query so persona is respected by APIs that ignore system=
    const _fullQ = encodeURIComponent(systemPrompt + '\n\nUser: ' + userMsg + '\n\nAssistant:')
    const _sysEnc = encodeURIComponent(systemPrompt)
    const _qEnc   = encodeURIComponent(userMsg)

    // 1. GiftedTech GPT-4o — embed system into q for persona compliance
    try {
        const _r = await fetch(`https://api.giftedtech.co.ke/api/ai/gpt4o?apikey=${_giftedKey()}&q=${_fullQ}`, { signal: AbortSignal.timeout(22000) })
        const _d = await _r.json()
        if (_d?.success && _d?.result && String(_d.result).trim().length > 2) return String(_d.result).trim()
    } catch {}

    // 2. GiftedTech Gemini — embed system into q
    try {
        const _r2 = await fetch(`https://api.giftedtech.co.ke/api/ai/gemini?apikey=${_giftedKey()}&q=${_fullQ}`, { signal: AbortSignal.timeout(22000) })
        const _d2 = await _r2.json()
        if (_d2?.success && _d2?.result && String(_d2.result).trim().length > 2) return String(_d2.result).trim()
    } catch {}

    // 3. Pollinations OpenAI-compatible POST (free, no key, respects system role)
    try {
        const { data: _d3 } = await require('axios').post('https://text.pollinations.ai/openai', {
            model: 'openai',
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
            max_tokens: maxTokens,
            stream: false
        }, { headers: { 'Content-Type': 'application/json' }, timeout: 25000 })
        const _t3 = _d3?.choices?.[0]?.message?.content?.trim()
        if (_t3?.length > 2) return _t3
    } catch {}

    // 4. Pollinations GET fallback
    try {
        const { data: _d4 } = await require('axios').get(`https://text.pollinations.ai/${_fullQ}`, { timeout: 15000, responseType: 'text' })
        if (_d4 && typeof _d4 === 'string' && _d4.trim().length > 2) return _d4.trim()
    } catch {}

    // 5. Anthropic Claude (if API key configured)
    try {
        const _antKey = process.env.ANTHROPIC_API_KEY || ''
        if (_antKey) {
            const _r5 = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': _antKey, 'anthropic-version': '2023-06-01' },
                body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, system: systemPrompt, messages: [{ role: 'user', content: userMsg }] }),
                signal: AbortSignal.timeout(18000)
            })
            const _d5 = await _r5.json()
            const _t5 = _d5?.content?.[0]?.text?.trim()
            if (_t5?.length > 2) return _t5
        }
    } catch {}

    throw new Error('All AI services unavailable')
}

module.exports = async (X, m, chatUpdate, store) => {
try {
// ── Bot-sent message tracker ─────────────────────────────────────────────────
// Wraps X.sendMessage (once per socket) so every outgoing bot reply has its
// message-ID registered in a global Set.  The setfont handler checks this Set
// before editing a fromMe message, ensuring bot replies are NEVER touched.
if (!X._botSentTracked) {
    X._botSentTracked = true
    if (!global._botSentIds) global._botSentIds = new Set()
    const _origSM = X.sendMessage.bind(X)
    X.sendMessage = async (..._smArgs) => {
        // ── Global empty-message guard ──────────────────────────────────────
        // Block any outgoing message where text is '', '   ', undefined, null,
        // or the literal strings 'undefined'/'null' from bad template interpolation.
        // Also strips empty captions from media messages (leaves media intact).
        const _msgPayload = _smArgs[1]
        const _isEmptyVal = (v) => {
            if (v === undefined || v === null) return true
            if (typeof v !== 'string') return false
            const _s = v.trim()
            return !_s || _s === 'undefined' || _s === 'null'
        }
        if (_msgPayload) {
            if ('text' in _msgPayload && _isEmptyVal(_msgPayload.text)) {
                console.log('[EmptyGuard] Blocked empty text send to', _smArgs[0])
                return null
            }
            if ('caption' in _msgPayload && _isEmptyVal(_msgPayload.caption)) {
                delete _msgPayload.caption
            }
        }
        // ───────────────────────────────────────────────────────────────────
        const _sent = await _origSM(..._smArgs)
        if (_sent?.key?.id) {
            global._botSentIds.add(_sent.key.id)
            setTimeout(() => global._botSentIds?.delete(_sent.key.id), 60000)
        }
        return _sent
    }
}
const from = m.key.remoteJid
var body = (m.mtype === 'interactiveResponseMessage') ? JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson).id : (m.mtype === 'conversation') ? m.message.conversation : (m.mtype == 'imageMessage') ? m.message.imageMessage.caption : (m.mtype == 'videoMessage') ? m.message.videoMessage.caption : (m.mtype == 'extendedTextMessage') ? m.message.extendedTextMessage.text : (m.mtype == 'buttonsResponseMessage') ? m.message.buttonsResponseMessage.selectedButtonId : (m.mtype == 'listResponseMessage') ? m.message.listResponseMessage.singleSelectReply.selectedRowId : (m.mtype == 'templateButtonReplyMessage') ? m.message.templateButtonReplyMessage.selectedId : (m.mtype == 'messageContextInfo') ? (m.message.buttonsResponseMessage?.selectedButtonId || m.message.listResponseMessage?.singleSelectReply?.selectedRowId || m.text) : ""
body = body || m.body || m.text || ""
//━━━━━━━━━━━━━━━━━━━━━━━━//
// library
const { smsg, fetchJson, getBuffer, fetchBuffer, getGroupAdmins, TelegraPh, isUrl, hitungmundur, sleep, clockString, checkBandwidth, runtime, tanggal, getRandom } = require('./library/lib/myfunc')

//━━━━━━━━━━━━━━━━━━━━━━━━//
// Main Setting (Admin And Prefix ) 
const budy = body || (typeof m.text === 'string' ? m.text : '');
const mess = global.mess || {};
if (!mess.OnlyOwner) mess.OnlyOwner = '╔══〔 👑 OWNER ONLY 〕══╗\n\n║ This command is for bot owner only.\n╚═══════════════════════╝'
if (!mess.OnlyGrup)  mess.OnlyGrup  = '╔══〔 👥 GROUP ONLY 〕══╗\n\n║ This command only works in a group.\n╚═══════════════════════╝'
if (!mess.error)     mess.error     = '╔══〔 ❌ ERROR 〕══╗\n\n║ An error occurred. Please try again.\n╚═══════════════════════╝'
const prefixRegex = /^[°zZ#$@*+,.?=''():√%!¢£¥€π¤ΠΦ_&><`™©®Δ^βα~¦|/\\©^]/;
const _bpDefined = global.botPrefix !== undefined && global.botPrefix !== null; const prefix = _bpDefined ? (global.botPrefix || '') : (prefixRegex.test(budy) ? budy.match(prefixRegex)[0] : '.');
const isCmd = _bpDefined ? (global.botPrefix === '' ? true : budy.startsWith(global.botPrefix)) : budy.startsWith(prefix);
const command = isCmd ? budy.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
const args = isCmd
  ? budy.slice(prefix.length).trim().split(/ +/).slice(1)
  : budy.trim().split(/ +/).slice(1)
const text = q = args.join(" ")
const sender = m.key.fromMe ? (X.user.id.split(':')[0]+'@s.whatsapp.net' || X.user.id) : (m.key.participant || m.key.remoteJid)
const botNumber = await X.decodeJid(X.user.id)
const senderNumber = sender.split('@')[0].split(':')[0]
const botNum = botNumber.split('@')[0].split(':')[0]
const ownerNums = [...global.owner].map(v => v.replace(/[^0-9]/g, ''))

const botJid = X.decodeJid(X.user.id)
let botLidRaw = X.user?.lid || null
if (!botLidRaw) {
    try {
        const _fs = require('fs')
        const _path = require('path')
        const phoneNum = (X.user.id || '').split(':')[0].split('@')[0]
        const credsPaths = [
            _path.join(__dirname, 'sessions', phoneNum, 'creds.json'),
            _path.join(__dirname, 'sessions', 'creds.json'),
            _path.join(__dirname, 'auth_info_baileys', 'creds.json'),
            _path.join(__dirname, '..', 'sessions', phoneNum, 'creds.json'),
            _path.join(__dirname, '..', 'sessions', 'creds.json'),
            _path.join(__dirname, '..', 'auth_info_baileys', 'creds.json'),
        ]
        for (const cp of credsPaths) {
            if (_fs.existsSync(cp)) {
                const creds = JSON.parse(_fs.readFileSync(cp, 'utf-8'))
                if (creds?.me?.lid) {
                    botLidRaw = creds.me.lid
                    X.user.lid = botLidRaw
                    break
                }
            }
        }
    } catch (e) {}
}
const botLid = botLidRaw ? X.decodeJid(botLidRaw) : null

const senderJid = m.sender || sender
const senderFromKey = m.key?.participant ? X.decodeJid(m.key.participant) : null

function isSameUser(participantId, targetId) {
    if (!participantId || !targetId) return false
    try { return areJidsSameUser(participantId, targetId) } catch { }
    const pUser = participantId.split(':')[0].split('@')[0]
    const tUser = targetId.split(':')[0].split('@')[0]
    return pUser === tUser
}

function isParticipantBot(p) {
    if (!p || !p.id) return false
    if (isSameUser(p.id, X.user.id)) return true
    if (X.user?.lid && isSameUser(p.id, X.user.lid)) return true
    if (isSameUser(p.id, botJid)) return true
    if (botLid && isSameUser(p.id, botLid)) return true
    return false
}

function isParticipantSender(p) {
    if (!p || !p.id) return false
    if (isSameUser(p.id, senderJid)) return true
    if (senderFromKey && isSameUser(p.id, senderFromKey)) return true
    if (m.sender && isSameUser(p.id, m.sender)) return true
    if (m.key?.participant && isSameUser(p.id, m.key.participant)) return true
    if (sender && isSameUser(p.id, sender)) return true
    return false
}

const senderClean = senderJid.split(':')[0].split('@')[0]
const senderKeyClean = senderFromKey ? senderFromKey.split(':')[0].split('@')[0] : null
const botClean = botJid.split(':')[0].split('@')[0]

const isOwner = (
    m.key.fromMe ||
    senderClean === botClean ||
    ownerNums.includes(senderClean) ||
    (senderKeyClean && (senderKeyClean === botClean || ownerNums.includes(senderKeyClean)))
) || false

const isGroup = m.isGroup
const pushname = m.pushName || `${senderNumber}`
const isBot = botNumber.split('@')[0].split(':')[0] === senderNumber
const quoted = m.quoted ? m.quoted : m
const mime = (quoted.msg || quoted).mimetype || ''
const groupMetadata = isGroup ? await X.groupMetadata(from).catch(e => null) : null
const groupName = isGroup && groupMetadata ? groupMetadata.subject || '' : ''
const participants = isGroup && groupMetadata ? groupMetadata.participants || [] : []
const groupAdmins = isGroup && participants.length ? await getGroupAdmins(participants) : []

const isBotAdmins = isGroup && participants.length ? participants.some(p => {
    return isParticipantBot(p) && (p.admin === 'admin' || p.admin === 'superadmin')
}) : false

const isAdmins = isGroup ? (isOwner || (participants.length ? participants.some(p => {
    return isParticipantSender(p) && (p.admin === 'admin' || p.admin === 'superadmin')
}) : false)) : false

const isSuperAdmin = isGroup && participants.length ? participants.some(p => {
    return isParticipantSender(p) && p.admin === 'superadmin'
}) : false
//━━━━━━━━━━━━━━━━━━━━━━━━//
// Setting Console
if (m.message) {
    const _mtype = Object.keys(m.message)[0] || 'unknown'
    // Skip noisy protocol/system messages — only log real user content
    const _skipTypes = ['protocolMessage','senderKeyDistributionMessage','messageContextInfo','ephemeralMessage']
    if (!_skipTypes.includes(_mtype)) {
        const _time = new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
        const _date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        const _body = budy || (m.mtype ? m.mtype.replace('Message','') : _mtype.replace('Message',''))
        const _preview = _body.length > 60 ? _body.slice(0, 60) + '\u2026' : _body
        const _chatLabel = m.isGroup
            ? 'Group   ' + chalk.cyan(pushname) + chalk.dim(' [' + from.split('@')[0] + ']')
            : 'Private ' + chalk.cyan(pushname) + chalk.dim(' [' + m.sender.split('@')[0] + ']')
        const _icon = m.isGroup ? '\uD83D\uDC65' : '\uD83D\uDCAC'
        const _typeIcons = {imageMessage:'\uD83D\uDDBC\uFE0F ',videoMessage:'\uD83C\uDFA5 ',audioMessage:'\uD83C\uDFB5 ',stickerMessage:'\uD83C\uDF00 ',documentMessage:'\uD83D\uDCC4 ',locationMessage:'\uD83D\uDCCD ',contactMessage:'\uD83D\uDC64 '}
        const _tIcon = _typeIcons[_mtype] || ''
        console.log(
            '\n' +
            chalk.bgCyan(chalk.black(' MSG ')) + ' ' + chalk.dim(_date) + ' ' + chalk.bold(_time) + '\n' +
            chalk.dim('  \u251C ') + chalk.yellow('From    ') + chalk.green(pushname) + chalk.dim(' (' + m.sender.split('@')[0] + ')') + '\n' +
            chalk.dim('  \u251C ') + chalk.yellow(_icon + ' Chat    ') + _chatLabel + '\n' +
            chalk.dim('  \u2514 ') + chalk.yellow('\uD83D\uDCAC Text    ') + chalk.white(_tIcon + _preview)
        )
    }
}
//━━━━━━━━━━━━━━━━━━━━━━━━//
// Auto Fake Presence (typing/recording/online)
if (global.fakePresence && global.fakePresence !== 'off' && !m.key.fromMe) {
    try {
        if (global.fakePresence === 'typing') {
            await X.sendPresenceUpdate('composing', from)
        } else if (global.fakePresence === 'recording') {
            await X.sendPresenceUpdate('recording', from)
        } else if (global.fakePresence === 'online') {
            await X.sendPresenceUpdate('available')
        }
    } catch(e) {}
}
//━━━━━━━━━━━━━━━━━━━━━━━━//
// Reply / Reply Message
const reply = (teks) => {
    if (!teks && teks !== 0) return
    const _t = typeof teks === 'string' ? teks.trim() : String(teks)
    if (!_t) return
    X.sendMessage(from, { text: _t }, { quoted: m })
}

const reply2 = (teks) => {
    if (!teks && teks !== 0) return
    const _t = typeof teks === 'string' ? teks.trim() : String(teks)
    if (!_t) return
    X.sendMessage(from, { text: _t }, { quoted: m })
}
//━━━━━━━━━━━━━━━━━━━━━━━━//
// Function Area
try {
ppuser = await X.profilePictureUrl(m.sender, 'image')
} catch (err) {
ppuser = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png?q=60'
}
try { ppnyauser = await getBuffer(ppuser) } catch { ppnyauser = Buffer.alloc(0) }

const reSize = async(buffer, ukur1, ukur2) => {
   return new Promise(async(resolve, reject) => {
      let jimp = require('jimp')
      var baper = await jimp.read(buffer);
      var ab = await baper.resize(ukur1, ukur2).getBufferAsync(jimp.MIME_JPEG)
      resolve(ab)
   })
}
    let fakethmb
    try { fakethmb = await reSize(ppuser, 300, 300) } catch { fakethmb = ppnyauser || Buffer.alloc(0) }
    // function resize
    let jimp = require("jimp")
const resize = async (image, width, height) => {
    const read = await jimp.read(image);
    const data = await read.resize(width, height).getBufferAsync(jimp.MIME_JPEG);
    return data;
};

const safeSendMedia = async (jid, mediaObj, options = {}, sendOpts = {}) => {
    try {
        for (const key of ['image', 'video', 'audio', 'document', 'sticker']) {
            if (mediaObj[key]) {
                const val = mediaObj[key];
                if (val && typeof val === 'object' && val.url) {
                    if (!val.url || val.url === 'undefined' || val.url === 'null' || val.url === undefined) {
                        return reply('╔══〔 ⚠️ MEDIA ERROR 〕══╗\n\n║ Media URL is not available.\n║ The source may be down.\n╚═══════════════════════╝');
                    }
                } else if (val === undefined || val === null) {
                    return reply('╔══〔 ⚠️ MEDIA ERROR 〕══╗\n\n║ Media data is not available.\n║ Please try again later.\n╚═══════════════════════╝');
                }
            }
        }
        await X.sendMessage(jid, mediaObj, sendOpts);
    } catch (err) {
        console.error('Safe media send error:', err.message);
        reply('╔══〔 ❌ SEND FAILED 〕══╗\n\n║ Failed to send media.\n║ ' + (err.message || 'Unknown error').slice(0,100) + '\n╚═══════════════════════╝');
    }
};

const userDbPath = './database/users.json';
function loadUsers() {
    try {
        if (!fs.existsSync(userDbPath)) return {};
        return JSON.parse(fs.readFileSync(userDbPath));
    } catch { return {}; }
}
function saveUsers(data) {
    if (!fs.existsSync('./database')) fs.mkdirSync('./database', { recursive: true });
    fs.writeFileSync(userDbPath, JSON.stringify(data, null, 2));
}
function trackUser(senderJid, name, cmd) {
    let users = loadUsers();
    const now = new Date().toISOString();
    if (!users[senderJid]) {
        users[senderJid] = { name: name, firstSeen: now, lastSeen: now, commandCount: 0, commands: {} };
    }
    users[senderJid].name = name;
    users[senderJid].lastSeen = now;
    users[senderJid].commandCount = (users[senderJid].commandCount || 0) + 1;
    if (cmd) {
        users[senderJid].commands[cmd] = (users[senderJid].commands[cmd] || 0) + 1;
    }
    saveUsers(users);
}

if (isCmd && command) {
    trackUser(sender, pushname, command);
    if (!isOwner && !isBot) {
        const userData = loadUsers();
        if (userData[sender]?.banned) {
            return reply('You have been banned from using this bot. Contact the admin for assistance.');
        }
    }
}

if (global.pmBlocker && !m.isGroup && !isOwner && !isBot && !m.key.fromMe) {
    try { await X.updateBlockStatus(m.sender, 'block') } catch {}
    return
}

if (global.autoReact && m.key && !m.key.fromMe) {
    const _skipReactTypes = ['reactionMessage','protocolMessage','senderKeyDistributionMessage','messageContextInfo']
    if (!_skipReactTypes.includes(m.mtype)) {
        try { await X.sendMessage(m.chat, { react: { text: global.autoReactEmoji || '👍', key: m.key } }) } catch {}
    }
}

if (m.isGroup && !isAdmins && !isOwner) {
    if (global.antiBadword && budy) {
        let badwords = ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'pussy', 'nigga', 'nigger']
        let hasBadword = badwords.some(w => budy.toLowerCase().includes(w))
        if (hasBadword && isBotAdmins) {
            await X.sendMessage(m.chat, { delete: m.key })
            await X.sendMessage(from, { text: `@${sender.split('@')[0]} watch your language! Badword detected.`, mentions: [sender] })
        }
    }
    if (global.antiTag && m.mentionedJid && m.mentionedJid.length > 5 && isBotAdmins) {
        await X.sendMessage(m.chat, { delete: m.key })
        await X.sendMessage(from, { text: `@${sender.split('@')[0]} mass tagging is not allowed!`, mentions: [sender] })
        return
    }
    if (global.antiSticker && m.mtype === 'stickerMessage' && isBotAdmins) {
        await X.sendMessage(m.chat, { delete: m.key })
        return
    }
    if (global.antiImageGroups?.[m.chat] && m.mtype === 'imageMessage' && isBotAdmins) {
        await X.sendMessage(m.chat, { delete: m.key })
        await X.sendMessage(from, { text: `@${sender.split('@')[0]} images are not allowed in this group!`, mentions: [sender] })
        return
    }
    if (global.antiVideoGroups?.[m.chat] && m.mtype === 'videoMessage' && isBotAdmins) {
        await X.sendMessage(m.chat, { delete: m.key })
        await X.sendMessage(from, { text: `@${sender.split('@')[0]} videos are not allowed in this group!`, mentions: [sender] })
        return
    }
    if (global.antiMentionGroups?.[m.chat] && m.mentionedJid && m.mentionedJid.length > 0 && isBotAdmins) {
        await X.sendMessage(m.chat, { delete: m.key })
        await X.sendMessage(from, { text: `@${sender.split('@')[0]} mentioning members is not allowed in this group!`, mentions: [sender] })
        return
    }
    if (global.antilinkGcGroups?.[m.chat] && budy && /chat\.whatsapp\.com\/[A-Za-z0-9]+/i.test(budy) && isBotAdmins) {
        await X.sendMessage(m.chat, { delete: m.key })
        await X.sendMessage(from, { text: `@${sender.split('@')[0]} group links are not allowed here!`, mentions: [sender] })
        return
    }
    if (global.antiGroupStatusGroups?.[m.chat] && isBotAdmins) {
        const _isViewOnce    = m.mtype === 'viewOnceMessage' || m.mtype === 'viewOnceMessageV2' || m.mtype === 'viewOnceMessageV2Extension'
        const _isFwdStatus   = m.message?.extendedTextMessage?.contextInfo?.isForwarded && m.message?.extendedTextMessage?.contextInfo?.remoteJid === 'status@broadcast'
        const _isGroupStatus = m.mtype === 'groupStatusMessageV2' || !!m.message?.groupStatusMessageV2
        if (_isViewOnce || _isFwdStatus || _isGroupStatus) {
            try { await X.sendMessage(m.chat, { delete: m.key }) } catch {}
            return
        }
    }
}

// ── Anti Status Mention enforcement ──────────────────────────────────────
// Fires when someone posts a WhatsApp status that tags/mentions a group.
// Applies warn (3-strike kick) / delete-notify / instant kick in that group.
if (from === 'status@broadcast' && global.antiStatusMentionGroups && Object.values(global.antiStatusMentionGroups).some(g => g?.enabled) && !m.key.fromMe) {
    try {
        const _asmSender  = sender  // JID of the person who posted the status
        // Collect group JIDs mentioned directly in the status
        const _mentionedGroups = (m.mentionedJid || []).filter(j => j.endsWith('@g.us'))
        // Also detect WhatsApp group invite links in the status text
        const _hasGroupLink = /chat\.whatsapp\.com\/[A-Za-z0-9]{10,}/.test(budy)

        if (_mentionedGroups.length || _hasGroupLink) {
            let _targetGroups = [..._mentionedGroups]

            // If only a link (no direct JID mention), find groups where sender is a member
            if (!_targetGroups.length && _hasGroupLink) {
                try {
                    const _allGroups = await X.groupFetchAllParticipating()
                    _targetGroups = Object.keys(_allGroups).filter(gId =>
                        (_allGroups[gId].participants || []).some(p =>
                            p.id === _asmSender || p.id?.split(':')[0]+'@s.whatsapp.net' === _asmSender
                        )
                    )
                } catch {}
            }

            for (const _gId of _targetGroups) {
                try {
                    // Only act if this specific group has antistatusmention enabled
                    const _asmGrpCfg = global.antiStatusMentionGroups?.[_gId]
                    if (!_asmGrpCfg?.enabled) continue
                    const _asmAction = (_asmGrpCfg.action || 'warn').toLowerCase()

                    const _gMeta    = await X.groupMetadata(_gId).catch(() => null)
                    if (!_gMeta) continue
                    const _gParts   = _gMeta.participants || []
                    // Bot must be admin in the group to act
                    const _botAdmin = _gParts.some(p => isParticipantBot(p) && (p.admin === 'admin' || p.admin === 'superadmin'))
                    if (!_botAdmin) continue
                    // Sender must be a member of this group
                    const _sNum     = _asmSender.split('@')[0].split(':')[0]
                    const _inGroup  = _gParts.some(p => (p.id || '').split('@')[0].split(':')[0] === _sNum)
                    if (!_inGroup) continue

                    if (_asmAction === 'kick') {
                        await X.groupParticipantsUpdate(_gId, [_asmSender], 'remove')
                        await X.sendMessage(_gId, {
                            text: `🚫 @${_sNum} was removed for tagging this group in their WhatsApp status.`,
                            mentions: [_asmSender]
                        })
                    } else if (_asmAction === 'delete') {
                        // Can't delete a status post, so notify in group and DM the sender
                        await X.sendMessage(_gId, {
                            text: `⚠️ @${_sNum} tagged this group in their WhatsApp status. Warned.`,
                            mentions: [_asmSender]
                        })
                        await X.sendMessage(_asmSender, {
                            text: `⚠️ You tagged a protected group in your status. Please remove it to avoid further action.`
                        }).catch(() => {})
                    } else {
                        // warn mode: 3 strikes then kick — reuse the group warnings.json
                        const _warnPath = require('path').join(__dirname, 'database', 'warnings.json')
                        let _warnDb = {}
                        try { _warnDb = JSON.parse(require('fs').readFileSync(_warnPath, 'utf-8')) } catch { _warnDb = {} }
                        const _gWarns = _warnDb[_gId] || {}
                        const _uWarns = _gWarns[_asmSender] || []
                        _uWarns.push({ reason: 'Tagged group in WhatsApp status', time: new Date().toISOString(), by: 'antistatusmention' })
                        _gWarns[_asmSender] = _uWarns
                        _warnDb[_gId] = _gWarns
                        require('fs').writeFileSync(_warnPath, JSON.stringify(_warnDb, null, 2))
                        const _cnt = _uWarns.length
                        if (_cnt >= 3) {
                            await X.groupParticipantsUpdate(_gId, [_asmSender], 'remove')
                            _gWarns[_asmSender] = []
                            _warnDb[_gId] = _gWarns
                            require('fs').writeFileSync(_warnPath, JSON.stringify(_warnDb, null, 2))
                            await X.sendMessage(_gId, {
                                text: `🚨 @${_sNum} reached 3/3 warnings for tagging this group in their status and was removed.`,
                                mentions: [_asmSender]
                            })
                        } else {
                            await X.sendMessage(_gId, {
                                text: `⚠️ Warning ${_cnt}/3 — @${_sNum}: Do not tag this group in your WhatsApp status.\n_${3 - _cnt} more warning(s) before removal._`,
                                mentions: [_asmSender]
                            })
                        }
                    }
                } catch {} // skip groups where an action fails
            }
        }
    } catch {}
}
// ────────────────────────────────────────────────────────────────────────

//━━━━━━━━━━━━━━━━━━━━━━━━//
// Leaderboard Games
const leaderboardPath = './database/leaderboard.json';

// Load leaderboard
function loadLeaderboard() {
  if (!fs.existsSync(leaderboardPath)) return {};
  return JSON.parse(fs.readFileSync(leaderboardPath));
}

// Save leaderboard
function saveLeaderboard(data) {
  fs.writeFileSync(leaderboardPath, JSON.stringify(data, null, 2));
}

if (
  global.tebakGame &&
  global.tebakGame[m.sender] &&
  m.quoted &&
  m.quoted.text &&
  m.quoted.text.includes(global.tebakGame[m.sender].soal)
) {
  const game = global.tebakGame[m.sender];
  const jawaban = game.jawaban;
  const petunjuk = game.petunjuk || 'No hint available';
  const teksUser = m.body?.toLowerCase();

  if (teksUser === 'nyerah' || teksUser === 'giveup') {
    clearTimeout(game.timeout);
    delete global.tebakGame[m.sender];
    return reply(`╔══〔 🎮 GAME OVER 〕══════╗\n║ 😔 You gave up!\n║ ✅ *Correct answer* : ${jawaban}\n╚═══════════════════════╝`);
  }

  const benar = Array.isArray(jawaban)
    ? jawaban.some(jw => jw.toLowerCase() === teksUser)
    : teksUser === jawaban.toLowerCase();

  if (teksUser && benar) {
    let leaderboard = loadLeaderboard();
    leaderboard[m.sender] = (leaderboard[m.sender] || 0) + 1;
    saveLeaderboard(leaderboard);

    clearTimeout(game.timeout);
    delete global.tebakGame[m.sender];
    return reply(`╔══〔 ✅ CORRECT ANSWER! 〕═╗\n\n║ 🎉 Well done! Your answer is right!\n║ Use *${prefix}tebakld* to view leaderboard.\n╚═══════════════════════╝`);
  } else if (teksUser) {
    return reply(`❌ Wrong. Try again!\n💡 Hint: ${petunjuk}\n\nType *giveup* if you want to give up.`);
  }
}
//━━━━━━━━━━━━━━━━━━━━━━━━//
// Prayer & Devotion Reminders
// Globals: global.muslimPrayer / global.christianDevotion
//   values: 'off' | 'dm' | 'group' | 'all'
if (!global.muslimPrayer)    global.muslimPrayer    = 'off'
if (!global.christianDevotion) global.christianDevotion = 'off'

X.autoshalat = X.autoshalat ? X.autoshalat : {}
        let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.fromMe ? X.user.id : m.sender
        let id = m.chat
    if(id in X.autoshalat) {
    return false
    }

    // Check if this chat should receive the reminder
    const _isGroup = m.isGroup
    const _prayerAllowed = (setting) => {
        if (!setting || setting === 'off') return false
        if (setting === 'all') return true
        if (setting === 'group') return _isGroup
        if (setting === 'dm') return !_isGroup
        return false
    }

    // Skip entirely if both are off for this chat type
    if (!_prayerAllowed(global.muslimPrayer) && !_prayerAllowed(global.christianDevotion)) {
        // fall through silently
    } else {

    // Detect timezone & region from sender's country code
    const _senderNum = (m.sender || '').split('@')[0]
    const _cc = _senderNum.startsWith('254') ? '254' :
                _senderNum.startsWith('255') ? '255' :
                _senderNum.startsWith('256') ? '256' :
                _senderNum.startsWith('257') ? '257' :
                _senderNum.startsWith('250') ? '250' :
                _senderNum.startsWith('251') ? '251' :
                _senderNum.startsWith('252') ? '252' :
                _senderNum.startsWith('253') ? '253' :
                _senderNum.startsWith('62')  ? '62'  :
                _senderNum.startsWith('60')  ? '60'  :
                _senderNum.startsWith('92')  ? '92'  :
                _senderNum.startsWith('880') ? '880' :
                _senderNum.startsWith('91')  ? '91'  :
                _senderNum.startsWith('966') ? '966' :
                _senderNum.startsWith('971') ? '971' :
                _senderNum.startsWith('20')  ? '20'  :
                _senderNum.startsWith('212') ? '212' :
                _senderNum.startsWith('234') ? '234' : '254'

    const _tzMap = {
        '254': { tz: 'Africa/Nairobi',       region: 'Kenya' },
        '255': { tz: 'Africa/Dar_es_Salaam', region: 'Tanzania' },
        '256': { tz: 'Africa/Kampala',       region: 'Uganda' },
        '257': { tz: 'Africa/Bujumbura',     region: 'Burundi' },
        '250': { tz: 'Africa/Kigali',        region: 'Rwanda' },
        '251': { tz: 'Africa/Addis_Ababa',   region: 'Ethiopia' },
        '252': { tz: 'Africa/Mogadishu',     region: 'Somalia' },
        '253': { tz: 'Africa/Djibouti',      region: 'Djibouti' },
        '62':  { tz: 'Asia/Jakarta',         region: 'Indonesia' },
        '60':  { tz: 'Asia/Kuala_Lumpur',    region: 'Malaysia' },
        '92':  { tz: 'Asia/Karachi',         region: 'Pakistan' },
        '880': { tz: 'Asia/Dhaka',           region: 'Bangladesh' },
        '91':  { tz: 'Asia/Kolkata',         region: 'India' },
        '966': { tz: 'Asia/Riyadh',          region: 'Saudi Arabia' },
        '971': { tz: 'Asia/Dubai',           region: 'UAE' },
        '20':  { tz: 'Africa/Cairo',         region: 'Egypt' },
        '212': { tz: 'Africa/Casablanca',    region: 'Morocco' },
        '234': { tz: 'Africa/Lagos',         region: 'Nigeria' },
    }
    const _tzInfo = _tzMap[_cc] || { tz: 'Africa/Nairobi', region: 'Kenya' }

    // Use pushname if available, otherwise clean number
    const _displayName = (pushname && pushname !== _senderNum && pushname.length > 1)
        ? pushname : (m.isGroup ? 'everyone' : 'friend')

    const datek = new Date((new Date).toLocaleString("en-US", { timeZone: _tzInfo.tz }))
    const hours = datek.getHours()
    const minutes = datek.getMinutes()
    const timeNow = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`

    // ── Muslim Prayer Times ───────────────────────────────────────────
    if (_prayerAllowed(global.muslimPrayer)) {
        let jadwalSholat = {}
        try {
            const _prayerRes = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(_tzInfo.region)}&country=${encodeURIComponent(_tzInfo.region)}&method=3`)
            const _prayerData = await _prayerRes.json()
            if (_prayerData.code === 200 && _prayerData.data && _prayerData.data.timings) {
                const t = _prayerData.data.timings
                jadwalSholat = {
                    Fajr:    t.Fajr?.slice(0,5),
                    Dhuhr:   t.Dhuhr?.slice(0,5),
                    Asr:     t.Asr?.slice(0,5),
                    Maghrib: t.Maghrib?.slice(0,5),
                    Isha:    t.Isha?.slice(0,5),
                }
            }
        } catch {}
        if (!Object.keys(jadwalSholat).length) {
            jadwalSholat = { Fajr: '05:00', Dhuhr: '12:20', Asr: '15:30', Maghrib: '18:25', Isha: '19:35' }
        }
        for(let [sholat, waktu] of Object.entries(jadwalSholat)) {
            if(timeNow === waktu && !(id in X.autoshalat)) {
                let caption = `╔══〔 🕌 PRAYER TIME 〕═══╗\n\n║ As-salamu alaykum, *${_displayName}* 🙏\n\n║ 🕌 *${sholat}* prayer time\n║ 🕐 *${waktu}*\n║ 🌍 ${_tzInfo.region}\n\n║ _Take your ablution and pray_ 🤲\n╚═══════════════════════╝`
                X.autoshalat[id] = [reply(caption), setTimeout(() => { delete X.autoshalat[m.chat] }, 57000)]
            }
        }
    }

    // ── Christian Devotion Times ──────────────────────────────────────
    if (_prayerAllowed(global.christianDevotion)) {
        const _christianTimes = {
            '06:00': { name: 'Morning Devotion', icon: '🌅', msg: 'Start your day with God. Pray, read the Word, and commit your day to Him.' },
            '12:00': { name: 'Midday Prayer',    icon: '☀️',  msg: 'Pause midday. Give thanks, seek guidance, and renew your strength in Christ.' },
            '18:00': { name: 'Evening Prayer',   icon: '🌇', msg: 'As the day winds down, give thanks for His grace and protection.' },
            '21:00': { name: 'Night Prayer',     icon: '🌙', msg: 'Before you rest, lay your burdens before God. He watches over you.' },
        }
        if (_christianTimes[timeNow] && !(id in X.autoshalat)) {
            const _dev = _christianTimes[timeNow]
            let _devCaption = `╔══〔 ✝️  DEVOTION TIME 〕══╗\n\n║ God bless you, *${_displayName}* 🙏\n\n║ ${_dev.icon} *${_dev.name}*\n║ 🕐 *${timeNow}*\n║ 🌍 ${_tzInfo.region}\n\n║ _${_dev.msg}_\n\n║ _📖 "Call to me and I will answer you" — Jer 33:3_\n╚═══════════════════════╝`
            X.autoshalat[id] = [reply(_devCaption), setTimeout(() => { delete X.autoshalat[m.chat] }, 57000)]
        }
    }

    } // end prayer allowed check
//━━━━━━━━━━━━━━━━━━━━━━━━//
// Similarity
function getCaseNames() {
  try {
    const data = fs.readFileSync(require('path').join(__dirname, 'client.js'), 'utf8');
    const casePattern = /case\s+'([^']+)'/g;
    const matches = data.match(casePattern);

    if (matches) {
      return matches.map(match => match.replace(/case\s+'([^']+)'/, '$1'));
    } else {
      return [];
    }
  } catch (error) {
    console.error('An error occurred:', error);
    throw error;
  }
}


//━━━━━━━━━━━━━━━━━━━━━━━━//
let totalfitur = () =>{
var mytext = fs.readFileSync(require("path").join(__dirname, "client.js")).toString()
var numUpper = (mytext.match(/case '/g) || []).length;
return numUpper
        }
//━━━━━━━━━━━━━━━━━━━━━━━━//
// Function Waktu
function getFormattedDate() {
  var currentDate = new Date();
  var day = currentDate.getDate();
  var month = currentDate.getMonth() + 1;
  var year = currentDate.getFullYear();
  var hours = currentDate.getHours();
  var minutes = currentDate.getMinutes();
  var seconds = currentDate.getSeconds();
}

let d = new Date(new Date + 3600000)
let locale = 'en'
let week = d.toLocaleDateString(locale, { weekday: 'long' })
let date = d.toLocaleDateString(locale, {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
})
const hariini = d.toLocaleDateString('id', { day: 'numeric', month: 'long', year: 'numeric' })

function msToTime(duration) {
var milliseconds = parseInt((duration % 1000) / 100),
seconds = Math.floor((duration / 1000) % 60),
minutes = Math.floor((duration / (1000 * 60)) % 60),
hours = Math.floor((duration / (1000 * 60 * 60)) % 24)

hours = (hours < 10) ? "0" + hours : hours
minutes = (minutes < 10) ? "0" + minutes : minutes
seconds = (seconds < 10) ? "0" + seconds : seconds
return hours + " hours " + minutes + " minutes " + seconds + " seconds"
}

function msToDate(ms) {
                temp = ms
                days = Math.floor(ms / (24*60*60*1000));
                daysms = ms % (24*60*60*1000);
                hours = Math.floor((daysms)/(60*60*1000));
                hoursms = ms % (60*60*1000);
                minutes = Math.floor((hoursms)/(60*1000));
                minutesms = ms % (60*1000);
                sec = Math.floor((minutesms)/(1000));
                return days+" Days "+hours+" Hours "+ minutes + " Minutes";
  }
//━━━━━━━━━━━━━━━━━━━━━━━━//
// Ucapan Waktu
const timee = moment().tz('Asia/Jakarta').format('HH:mm:ss')
if(timee < "23:59:00"){
var waktuucapan = 'Good Night'
}
if(timee < "19:00:00"){
var waktuucapan = 'Good Evening'
}
if(timee < "18:00:00"){
var waktuucapan = 'Good Afternoon'
}
if(timee < "15:00:00"){
var waktuucapan = 'Good Day'
}
if(timee < "10:00:00"){
var waktuucapan = 'Good Morning'
}
if(timee < "05:00:00"){
var waktuucapan = 'Early Morning'
}
if(timee < "03:00:00"){
var waktuucapan = 'Midnight'
}
//━━━━━━━━━━━━━━━━━━━━━━━━//
// Plugin Connector
const loadPlugins = (directory) => {
    let plugins = []
    const entries = fs.readdirSync(directory)
    entries.forEach(entry => {
        const entryPath = path.join(directory, entry)
        if (fs.lstatSync(entryPath).isDirectory()) {
            const files = fs.readdirSync(entryPath)
            files.forEach(file => {
                const filePath = path.join(entryPath, file)
                if (filePath.endsWith(".js")) {
                    try {
                        delete require.cache[require.resolve(filePath)]
                        const plugin = require(filePath)
                        plugin.filePath = filePath
                        plugins.push(plugin)
                    } catch (error) {
                        console.error(`Error loading plugin at ${filePath}:`, error)
                    }
                }
            })
        } else if (entryPath.endsWith(".js")) {
            try {
                delete require.cache[require.resolve(entryPath)]
                const plugin = require(entryPath)
                plugin.filePath = entryPath
                plugins.push(plugin)
            } catch (error) {
                console.error(`Error loading plugin at ${entryPath}:`, error)
            }
        }
    })
    return plugins
}
const plugins = loadPlugins(path.resolve(__dirname, "./plugin"))
const context = { 
    args, 
    X, 
    reply,
    m, 
    body,   
    prefix,
    command,
    isUrl,
    q,
    text,
    quoted,
    require,
    smsg,
    sleep,
    clockString,
    msToDate,
    runtime,
    fetchJson,
    getBuffer,
    delay,
    getRandom
     }
let handled = false
for (const plugin of plugins) {
    if (plugin.command.includes(command)) {
        try {
            await plugin.operate(context)
            handled = true
        } catch (error) {
            console.error(`Error executing plugin ${plugin.filePath}:`, error)
        }
        break
    }
}
// Batas Plugins
//━━━━━━━━━━━━━━━━━━━━━━━━//
//━━━━━━━━━━━━━━━━━━━━━━━━//
// tag owner reaction
if (m.isGroup) {
    if (body.includes(`@${owner}`)) {
        await X.sendMessage(m.chat, { react: { text: "❌", key: m.key } })
    }
 }
// tes bot no prefix
if ((budy.match) && ["bot",].includes(budy) && !isCmd) {
reply(`╔══〔 🟢 ONLINE & READY 〕══╗\n\n║ 🤖 *${global.botname || 'Juice v12'}*\n║ ⏱️  *Uptime* : ${runtime(process.uptime())}\n╚═══════════════════════╝`)
}       

//━━━━━━━━━━━━━━━━━━━━━━━━//
// Mode Gate
// Private mode: ONLY the deployed bot number can use any command
// Public mode:  All users can use non-owner commands normally
const isDeployedNumber = m.key.fromMe || senderClean === botClean

if (isCmd && X.public === false && !isDeployedNumber) {
    return reply('🔒 *Bot is in Private Mode.*\n_Only the bot owner can use commands._')
}

//━━━━━━━━━━━━━━━━━━━━━━━━//
// Owner Font Mode — auto-converts every message the bot owner sends
// Activated via .setfont [fontname], deactivated via .fontoff
// _botSentIds guard: skip any message the bot itself sent (command replies, fancy output, etc.)
if (m.key.fromMe && global.ownerFontMode && global.ownerFontMode !== 'off' && budy && !isCmd && !(global._botSentIds?.has(m.key.id))) {
    try {
        const _fontMaps = {
            bold:          {a:'𝗮',b:'𝗯',c:'𝗰',d:'𝗱',e:'𝗲',f:'𝗳',g:'𝗴',h:'𝗵',i:'𝗶',j:'𝗷',k:'𝗸',l:'𝗹',m:'𝗺',n:'𝗻',o:'𝗼',p:'𝗽',q:'𝗾',r:'𝗿',s:'𝘀',t:'𝘁',u:'𝘂',v:'𝘃',w:'𝘄',x:'𝘅',y:'𝘆',z:'𝘇',A:'𝗔',B:'𝗕',C:'𝗖',D:'𝗗',E:'𝗘',F:'𝗙',G:'𝗚',H:'𝗛',I:'𝗜',J:'𝗝',K:'𝗞',L:'𝗟',M:'𝗠',N:'𝗡',O:'𝗢',P:'𝗣',Q:'𝗤',R:'𝗥',S:'𝗦',T:'𝗧',U:'𝗨',V:'𝗩',W:'𝗪',X:'𝗫',Y:'𝗬',Z:'𝗭','0':'𝟬','1':'𝟭','2':'𝟮','3':'𝟯','4':'𝟰','5':'𝟱','6':'𝟲','7':'𝟳','8':'𝟴','9':'𝟵'},
            italic:        {a:'𝘢',b:'𝘣',c:'𝘤',d:'𝘥',e:'𝘦',f:'𝘧',g:'𝘨',h:'𝘩',i:'𝘪',j:'𝘫',k:'𝘬',l:'𝘭',m:'𝘮',n:'𝘯',o:'𝘰',p:'𝘱',q:'𝘲',r:'𝘳',s:'𝘴',t:'𝘵',u:'𝘶',v:'𝘷',w:'𝘸',x:'𝘹',y:'𝘺',z:'𝘻',A:'𝘈',B:'𝘉',C:'𝘊',D:'𝘋',E:'𝘌',F:'𝘍',G:'𝘎',H:'𝘏',I:'𝘐',J:'𝘑',K:'𝘒',L:'𝘓',M:'𝘔',N:'𝘕',O:'𝘖',P:'𝘗',Q:'𝘘',R:'𝘙',S:'𝘚',T:'𝘛',U:'𝘜',V:'𝘝',W:'𝘞',X:'𝘟',Y:'𝘠',Z:'𝘡'},
            bolditalic:    {a:'𝙖',b:'𝙗',c:'𝙘',d:'𝙙',e:'𝙚',f:'𝙛',g:'𝙜',h:'𝙝',i:'𝙞',j:'𝙟',k:'𝙠',l:'𝙡',m:'𝙢',n:'𝙣',o:'𝙤',p:'𝙥',q:'𝙦',r:'𝙧',s:'𝙨',t:'𝙩',u:'𝙪',v:'𝙫',w:'𝙬',x:'𝙭',y:'𝙮',z:'𝙯',A:'𝘼',B:'𝘽',C:'𝘾',D:'𝘿',E:'𝙀',F:'𝙁',G:'𝙂',H:'𝙃',I:'𝙄',J:'𝙅',K:'𝙆',L:'𝙇',M:'𝙈',N:'𝙉',O:'𝙊',P:'𝙋',Q:'𝙌',R:'𝙍',S:'𝙎',T:'𝙏',U:'𝙐',V:'𝙑',W:'𝙒',X:'𝙓',Y:'𝙔',Z:'𝙕'},
            mono:          {a:'𝚊',b:'𝚋',c:'𝚌',d:'𝚍',e:'𝚎',f:'𝚏',g:'𝚐',h:'𝚑',i:'𝚒',j:'𝚓',k:'𝚔',l:'𝚕',m:'𝚖',n:'𝚗',o:'𝚘',p:'𝚙',q:'𝚚',r:'𝚛',s:'𝚜',t:'𝚝',u:'𝚞',v:'𝚟',w:'𝚠',x:'𝚡',y:'𝚢',z:'𝚣',A:'𝙰',B:'𝙱',C:'𝙲',D:'𝙳',E:'𝙴',F:'𝙵',G:'𝙶',H:'𝙷',I:'𝙸',J:'𝙹',K:'𝙺',L:'𝙻',M:'𝙼',N:'𝙽',O:'𝙾',P:'𝙿',Q:'𝚀',R:'𝚁',S:'𝚂',T:'𝚃',U:'𝚄',V:'𝚅',W:'𝚆',X:'𝚇',Y:'𝚈',Z:'𝚉','0':'𝟶','1':'𝟷','2':'𝟸','3':'𝟹','4':'𝟺','5':'𝟻','6':'𝟼','7':'𝟽','8':'𝟾','9':'𝟿'},
            serif:         {a:'𝐚',b:'𝐛',c:'𝐜',d:'𝐝',e:'𝐞',f:'𝐟',g:'𝐠',h:'𝐡',i:'𝐢',j:'𝐣',k:'𝐤',l:'𝐥',m:'𝐦',n:'𝐧',o:'𝐨',p:'𝐩',q:'𝐪',r:'𝐫',s:'𝐬',t:'𝐭',u:'𝐮',v:'𝐯',w:'𝐰',x:'𝐱',y:'𝐲',z:'𝐳',A:'𝐀',B:'𝐁',C:'𝐂',D:'𝐃',E:'𝐄',F:'𝐅',G:'𝐆',H:'𝐇',I:'𝐈',J:'𝐉',K:'𝐊',L:'𝐋',M:'𝐌',N:'𝐍',O:'𝐎',P:'𝐏',Q:'𝐐',R:'𝐑',S:'𝐒',T:'𝐓',U:'𝐔',V:'𝐕',W:'𝐖',X:'𝐗',Y:'𝐘',Z:'𝐙','0':'𝟎','1':'𝟏','2':'𝟐','3':'𝟑','4':'𝟒','5':'𝟓','6':'𝟔','7':'𝟕','8':'𝟖','9':'𝟗'},
            serifbold:     {a:'𝒂',b:'𝒃',c:'𝒄',d:'𝒅',e:'𝒆',f:'𝒇',g:'𝒈',h:'𝒉',i:'𝒊',j:'𝒋',k:'𝒌',l:'𝒍',m:'𝒎',n:'𝒏',o:'𝒐',p:'𝒑',q:'𝒒',r:'𝒓',s:'𝒔',t:'𝒕',u:'𝒖',v:'𝒗',w:'𝒘',x:'𝒙',y:'𝒚',z:'𝒛',A:'𝑨',B:'𝑩',C:'𝑪',D:'𝑫',E:'𝑬',F:'𝑭',G:'𝑮',H:'𝑯',I:'𝑰',J:'𝑱',K:'𝑲',L:'𝑳',M:'𝑴',N:'𝑵',O:'𝑶',P:'𝑷',Q:'𝑸',R:'𝑹',S:'𝑺',T:'𝑻',U:'𝑼',V:'𝑽',W:'𝑾',X:'𝑿',Y:'𝒀',Z:'𝒁'},
            serifitalic:   {a:'𝑎',b:'𝑏',c:'𝑐',d:'𝑑',e:'𝑒',f:'𝑓',g:'𝑔',h:'ℎ',i:'𝑖',j:'𝑗',k:'𝑘',l:'𝑙',m:'𝑚',n:'𝑛',o:'𝑜',p:'𝑝',q:'𝑞',r:'𝑟',s:'𝑠',t:'𝑡',u:'𝑢',v:'𝑣',w:'𝑤',x:'𝑥',y:'𝑦',z:'𝑧',A:'𝐴',B:'𝐵',C:'𝐶',D:'𝐷',E:'𝐸',F:'𝐹',G:'𝐺',H:'𝐻',I:'𝐼',J:'𝐽',K:'𝐾',L:'𝐿',M:'𝑀',N:'𝑁',O:'𝑂',P:'𝑃',Q:'𝑄',R:'𝑅',S:'𝑆',T:'𝑇',U:'𝑈',V:'𝑉',W:'𝑊',X:'𝑋',Y:'𝑌',Z:'𝑍'},
            scriptfont:    {a:'𝒶',b:'𝒷',c:'𝒸',d:'𝒹',e:'𝑒',f:'𝒻',g:'𝑔',h:'𝒽',i:'𝒾',j:'𝒿',k:'𝓀',l:'𝓁',m:'𝓂',n:'𝓃',o:'𝑜',p:'𝓅',q:'𝓆',r:'𝓇',s:'𝓈',t:'𝓉',u:'𝓊',v:'𝓋',w:'𝓌',x:'𝓍',y:'𝓎',z:'𝓏',A:'𝒜',B:'ℬ',C:'𝒞',D:'𝒟',E:'ℰ',F:'ℱ',G:'𝒢',H:'ℋ',I:'ℐ',J:'𝒥',K:'𝒦',L:'ℒ',M:'ℳ',N:'𝒩',O:'𝒪',P:'𝒫',Q:'𝒬',R:'ℛ',S:'𝒮',T:'𝒯',U:'𝒰',V:'𝒱',W:'𝒲',X:'𝒳',Y:'𝒴',Z:'𝒵'},
            scriptbold:    {a:'𝓪',b:'𝓫',c:'𝓬',d:'𝓭',e:'𝓮',f:'𝓯',g:'𝓰',h:'𝓱',i:'𝓲',j:'𝓳',k:'𝓴',l:'𝓵',m:'𝓶',n:'𝓷',o:'𝓸',p:'𝓹',q:'𝓺',r:'𝓻',s:'𝓼',t:'𝓽',u:'𝓾',v:'𝓿',w:'𝔀',x:'𝔁',y:'𝔂',z:'𝔃',A:'𝓐',B:'𝓑',C:'𝓒',D:'𝓓',E:'𝓔',F:'𝓕',G:'𝓖',H:'𝓗',I:'𝓘',J:'𝓙',K:'𝓚',L:'𝓛',M:'𝓜',N:'𝓝',O:'𝓞',P:'𝓟',Q:'𝓠',R:'𝓡',S:'𝓢',T:'𝓣',U:'𝓤',V:'𝓥',W:'𝓦',X:'𝓧',Y:'𝓨',Z:'𝓩'},
            fraktur:       {a:'𝔞',b:'𝔟',c:'𝔠',d:'𝔡',e:'𝔢',f:'𝔣',g:'𝔤',h:'𝔥',i:'𝔦',j:'𝔧',k:'𝔨',l:'𝔩',m:'𝔪',n:'𝔫',o:'𝔬',p:'𝔭',q:'𝔮',r:'𝔯',s:'𝔰',t:'𝔱',u:'𝔲',v:'𝔳',w:'𝔴',x:'𝔵',y:'𝔶',z:'𝔷',A:'𝔄',B:'𝔅',C:'ℭ',D:'𝔇',E:'𝔈',F:'𝔉',G:'𝔊',H:'ℌ',I:'ℑ',J:'𝔍',K:'𝔎',L:'𝔏',M:'𝔐',N:'𝔑',O:'𝔒',P:'𝔓',Q:'𝔔',R:'ℜ',S:'𝔖',T:'𝔗',U:'𝔘',V:'𝔙',W:'𝔚',X:'𝔛',Y:'𝔜',Z:'ℨ'},
            frakturbold:   {a:'𝖆',b:'𝖇',c:'𝖈',d:'𝖉',e:'𝖊',f:'𝖋',g:'𝖌',h:'𝖍',i:'𝖎',j:'𝖏',k:'𝖐',l:'𝖑',m:'𝖒',n:'𝖓',o:'𝖔',p:'𝖕',q:'𝖖',r:'𝖗',s:'𝖘',t:'𝖙',u:'𝖚',v:'𝖛',w:'𝖜',x:'𝖝',y:'𝖞',z:'𝖟',A:'𝕬',B:'𝕭',C:'𝕮',D:'𝕯',E:'𝕰',F:'𝕱',G:'𝕲',H:'𝕳',I:'𝕴',J:'𝕵',K:'𝕶',L:'𝕷',M:'𝕸',N:'𝕹',O:'𝕺',P:'𝕻',Q:'𝕼',R:'𝕽',S:'𝕾',T:'𝕿',U:'𝖀',V:'𝖁',W:'𝖂',X:'𝖃',Y:'𝖄',Z:'𝖅'},
            doublestruck:  {a:'𝕒',b:'𝕓',c:'𝕔',d:'𝕕',e:'𝕖',f:'𝕗',g:'𝕘',h:'𝕙',i:'𝕚',j:'𝕛',k:'𝕜',l:'𝕝',m:'𝕞',n:'𝕟',o:'𝕠',p:'𝕡',q:'𝕢',r:'𝕣',s:'𝕤',t:'𝕥',u:'𝕦',v:'𝕧',w:'𝕨',x:'𝕩',y:'𝕪',z:'𝕫',A:'𝔸',B:'𝔹',C:'ℂ',D:'𝔻',E:'𝔼',F:'𝔽',G:'𝔾',H:'ℍ',I:'𝕀',J:'𝕁',K:'𝕂',L:'𝕃',M:'𝕄',N:'ℕ',O:'𝕆',P:'ℙ',Q:'ℚ',R:'ℝ',S:'𝕊',T:'𝕋',U:'𝕌',V:'𝕍',W:'𝕎',X:'𝕏',Y:'𝕐',Z:'ℤ','0':'𝟘','1':'𝟙','2':'𝟚','3':'𝟛','4':'𝟜','5':'𝟝','6':'𝟞','7':'𝟟','8':'𝟠','9':'𝟡'},
            smallcaps:     {a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ꜰ',g:'ɢ',h:'ʜ',i:'ɪ',j:'ᴊ',k:'ᴋ',l:'ʟ',m:'ᴍ',n:'ɴ',o:'ᴏ',p:'ᴘ',q:'Q',r:'ʀ',s:'ꜱ',t:'ᴛ',u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ',A:'ᴀ',B:'ʙ',C:'ᴄ',D:'ᴅ',E:'ᴇ',F:'ꜰ',G:'ɢ',H:'ʜ',I:'ɪ',J:'ᴊ',K:'ᴋ',L:'ʟ',M:'ᴍ',N:'ɴ',O:'ᴏ',P:'ᴘ',Q:'Q',R:'ʀ',S:'ꜱ',T:'ᴛ',U:'ᴜ',V:'ᴠ',W:'ᴡ',X:'x',Y:'ʏ',Z:'ᴢ'},
            bubble:        {a:'ⓐ',b:'ⓑ',c:'ⓒ',d:'ⓓ',e:'ⓔ',f:'ⓕ',g:'ⓖ',h:'ⓗ',i:'ⓘ',j:'ⓙ',k:'ⓚ',l:'ⓛ',m:'ⓜ',n:'ⓝ',o:'ⓞ',p:'ⓟ',q:'ⓠ',r:'ⓡ',s:'ⓢ',t:'ⓣ',u:'ⓤ',v:'ⓥ',w:'ⓦ',x:'ⓧ',y:'ⓨ',z:'ⓩ',A:'Ⓐ',B:'Ⓑ',C:'Ⓒ',D:'Ⓓ',E:'Ⓔ',F:'Ⓕ',G:'Ⓖ',H:'Ⓗ',I:'Ⓘ',J:'Ⓙ',K:'Ⓚ',L:'Ⓛ',M:'Ⓜ',N:'Ⓝ',O:'Ⓞ',P:'Ⓟ',Q:'Ⓠ',R:'Ⓡ',S:'Ⓢ',T:'Ⓣ',U:'Ⓤ',V:'Ⓥ',W:'Ⓦ',X:'Ⓧ',Y:'Ⓨ',Z:'Ⓩ','0':'⓪','1':'①','2':'②','3':'③','4':'④','5':'⑤','6':'⑥','7':'⑦','8':'⑧','9':'⑨'},
            bubblebold:    {a:'🅐',b:'🅑',c:'🅒',d:'🅓',e:'🅔',f:'🅕',g:'🅖',h:'🅗',i:'🅘',j:'🅙',k:'🅚',l:'🅛',m:'🅜',n:'🅝',o:'🅞',p:'🅟',q:'🅠',r:'🅡',s:'🅢',t:'🅣',u:'🅤',v:'🅥',w:'🅦',x:'🅧',y:'🅨',z:'🅩',A:'🅐',B:'🅑',C:'🅒',D:'🅓',E:'🅔',F:'🅕',G:'🅖',H:'🅗',I:'🅘',J:'🅙',K:'🅚',L:'🅛',M:'🅜',N:'🅝',O:'🅞',P:'🅟',Q:'🅠',R:'🅡',S:'🅢',T:'🅣',U:'🅤',V:'🅥',W:'🅦',X:'🅧',Y:'🅨',Z:'🅩'},
            square:        {a:'🄰',b:'🄱',c:'🄲',d:'🄳',e:'🄴',f:'🄵',g:'🄶',h:'🄷',i:'🄸',j:'🄹',k:'🄺',l:'🄻',m:'🄼',n:'🄽',o:'🄾',p:'🄿',q:'🅀',r:'🅁',s:'🅂',t:'🅃',u:'🅄',v:'🅅',w:'🅆',x:'🅇',y:'🅈',z:'🅉',A:'🄰',B:'🄱',C:'🄲',D:'🄳',E:'🄴',F:'🄵',G:'🄶',H:'🄷',I:'🄸',J:'🄹',K:'🄺',L:'🄻',M:'🄼',N:'🄽',O:'🄾',P:'🄿',Q:'🅀',R:'🅁',S:'🅂',T:'🅃',U:'🅄',V:'🅅',W:'🅆',X:'🅇',Y:'🅈',Z:'🅉'},
            squarebold:    {a:'🅰',b:'🅱',c:'🅲',d:'🅳',e:'🅴',f:'🅵',g:'🅶',h:'🅷',i:'🅸',j:'🅹',k:'🅺',l:'🅻',m:'🅼',n:'🅽',o:'🅾',p:'🅿',q:'🆀',r:'🆁',s:'🆂',t:'🆃',u:'🆄',v:'🆅',w:'🆆',x:'🆇',y:'🆈',z:'🆉',A:'🅰',B:'🅱',C:'🅲',D:'🅳',E:'🅴',F:'🅵',G:'🅶',H:'🅷',I:'🅸',J:'🅹',K:'🅺',L:'🅻',M:'🅼',N:'🅽',O:'🅾',P:'🅿',Q:'🆀',R:'🆁',S:'🆂',T:'🆃',U:'🆄',V:'🆅',W:'🆆',X:'🆇',Y:'🆈',Z:'🆉'},
            wide:          'wide',
            upsidedown:    'upsidedown',
            strikethrough: 'strikethrough',
            underline:     'underline',
            medieval:      {a:'𝔞',b:'𝔟',c:'𝔠',d:'𝔡',e:'𝔢',f:'𝔣',g:'𝔤',h:'𝔥',i:'𝔦',j:'𝔧',k:'𝔨',l:'𝔩',m:'𝔪',n:'𝔫',o:'𝔬',p:'𝔭',q:'𝔮',r:'𝔯',s:'𝔰',t:'𝔱',u:'𝔲',v:'𝔳',w:'𝔴',x:'𝔵',y:'𝔶',z:'𝔷',A:'𝔄',B:'𝔅',C:'ℭ',D:'𝔇',E:'𝔈',F:'𝔉',G:'𝔊',H:'ℌ',I:'ℑ',J:'𝔍',K:'𝔎',L:'𝔏',M:'𝔐',N:'𝔑',O:'𝔒',P:'𝔓',Q:'𝔔',R:'ℜ',S:'𝔖',T:'𝔗',U:'𝔘',V:'𝔙',W:'𝔚',X:'𝔛',Y:'𝔜',Z:'ℨ'},
            cursive:       {a:'𝓪',b:'𝓫',c:'𝓬',d:'𝓭',e:'𝓮',f:'𝓯',g:'𝓰',h:'𝓱',i:'𝓲',j:'𝓳',k:'𝓴',l:'𝓵',m:'𝓶',n:'𝓷',o:'𝓸',p:'𝓹',q:'𝓺',r:'𝓻',s:'𝓼',t:'𝓽',u:'𝓾',v:'𝓿',w:'𝔀',x:'𝔁',y:'𝔂',z:'𝔃',A:'𝓐',B:'𝓑',C:'𝓒',D:'𝓓',E:'𝓔',F:'𝓕',G:'𝓖',H:'𝓗',I:'𝓘',J:'𝓙',K:'𝓚',L:'𝓛',M:'𝓜',N:'𝓝',O:'𝓞',P:'𝓟',Q:'𝓠',R:'𝓡',S:'𝓢',T:'𝓣',U:'𝓤',V:'𝓥',W:'𝓦',X:'𝓧',Y:'𝓨',Z:'𝓩'},
            aesthetic:     {a:'ａ',b:'ｂ',c:'ｃ',d:'ｄ',e:'ｅ',f:'ｆ',g:'ｇ',h:'ｈ',i:'ｉ',j:'ｊ',k:'ｋ',l:'ｌ',m:'ｍ',n:'ｎ',o:'ｏ',p:'ｐ',q:'ｑ',r:'ｒ',s:'ｓ',t:'ｔ',u:'ｕ',v:'ｖ',w:'ｗ',x:'ｘ',y:'ｙ',z:'ｚ',A:'Ａ',B:'Ｂ',C:'Ｃ',D:'Ｄ',E:'Ｅ',F:'Ｆ',G:'Ｇ',H:'Ｈ',I:'Ｉ',J:'Ｊ',K:'Ｋ',L:'Ｌ',M:'Ｍ',N:'Ｎ',O:'Ｏ',P:'Ｐ',Q:'Ｑ',R:'Ｒ',S:'Ｓ',T:'Ｔ',U:'Ｕ',V:'Ｖ',W:'Ｗ',X:'Ｘ',Y:'Ｙ',Z:'Ｚ','0':'０','1':'１','2':'２','3':'３','4':'４','5':'５','6':'６','7':'７','8':'８','9':'９'},
            tiny:          {a:'ᵃ',b:'ᵇ',c:'ᶜ',d:'ᵈ',e:'ᵉ',f:'ᶠ',g:'ᵍ',h:'ʰ',i:'ⁱ',j:'ʲ',k:'ᵏ',l:'ˡ',m:'ᵐ',n:'ⁿ',o:'ᵒ',p:'ᵖ',q:'q',r:'ʳ',s:'ˢ',t:'ᵗ',u:'ᵘ',v:'ᵛ',w:'ʷ',x:'ˣ',y:'ʸ',z:'ᶻ',A:'ᴬ',B:'ᴮ',C:'ᶜ',D:'ᴰ',E:'ᴱ',F:'ᶠ',G:'ᴳ',H:'ᴴ',I:'ᴵ',J:'ᴶ',K:'ᴷ',L:'ᴸ',M:'ᴹ',N:'ᴺ',O:'ᴼ',P:'ᴾ',Q:'Q',R:'ᴿ',S:'ˢ',T:'ᵀ',U:'ᵁ',V:'ᵛ',W:'ᵂ',X:'ˣ',Y:'ʸ',Z:'ᶻ'},
            gothic:        {a:'𝖆',b:'𝖇',c:'𝖈',d:'𝖉',e:'𝖊',f:'𝖋',g:'𝖌',h:'𝖍',i:'𝖎',j:'𝖏',k:'𝖐',l:'𝖑',m:'𝖒',n:'𝖓',o:'𝖔',p:'𝖕',q:'𝖖',r:'𝖗',s:'𝖘',t:'𝖙',u:'𝖚',v:'𝖛',w:'𝖜',x:'𝖝',y:'𝖞',z:'𝖟',A:'𝕬',B:'𝕭',C:'𝕮',D:'𝕯',E:'𝕰',F:'𝕱',G:'𝕲',H:'𝕳',I:'𝕴',J:'𝕵',K:'𝕶',L:'𝕷',M:'𝕸',N:'𝕹',O:'𝕺',P:'𝕻',Q:'𝕼',R:'𝕽',S:'𝕾',T:'𝕿',U:'𝖀',V:'𝖁',W:'𝖂',X:'𝖃',Y:'𝖄',Z:'𝖅'},
            inverted:      {a:'ɐ',b:'q',c:'ɔ',d:'p',e:'ǝ',f:'ɟ',g:'ƃ',h:'ɥ',i:'ᴉ',j:'ɾ',k:'ʞ',l:'l',m:'ɯ',n:'u',o:'o',p:'d',q:'b',r:'ɹ',s:'s',t:'ʇ',u:'n',v:'ʌ',w:'ʍ',x:'x',y:'ʎ',z:'z',A:'∀',B:'q',C:'Ɔ',D:'p',E:'Ǝ',F:'Ⅎ',G:'פ',H:'H',I:'I',J:'ɾ',K:'ʞ',L:'˥',M:'W',N:'N',O:'O',P:'Ԁ',Q:'Q',R:'ɹ',S:'S',T:'┴',U:'∩',V:'Λ',W:'M',X:'X',Y:'ʎ',Z:'Z'},
            mirror:        {a:'ɒ',b:'d',c:'ɔ',d:'b',e:'ɘ',f:'ʇ',g:'ϱ',h:'ʜ',i:'i',j:'ᴉ',k:'ʞ',l:'l',m:'m',n:'n',o:'o',p:'q',q:'p',r:'ɿ',s:'ƨ',t:'ƚ',u:'u',v:'v',w:'w',x:'x',y:'y',z:'z',A:'A',B:'ᗺ',C:'Ɔ',D:'ᗡ',E:'Ǝ',F:'ꟻ',G:'Ꭾ',H:'H',I:'I',J:'Ꮈ',K:'ꓘ',L:'⅃',M:'M',N:'И',O:'O',P:'ꟼ',Q:'Ọ',R:'Я',S:'Ƨ',T:'T',U:'U',V:'V',W:'W',X:'X',Y:'Y',Z:'Z'},
            currency:      {a:'₳',b:'฿',c:'₵',d:'₫',e:'€',f:'₣',g:'₲',h:'♄',i:'ł',j:'ʝ',k:'₭',l:'₤',m:'₥',n:'₦',o:'ø',p:'₱',q:'q',r:'®',s:'$',t:'₮',u:'µ',v:'√',w:'₩',x:'×',y:'¥',z:'z',A:'₳',B:'฿',C:'₵',D:'₫',E:'€',F:'₣',G:'₲',H:'♄',I:'ł',J:'ʝ',K:'₭',L:'₤',M:'₥',N:'₦',O:'ø',P:'₱',Q:'Q',R:'®',S:'$',T:'₮',U:'µ',V:'√',W:'₩',X:'×',Y:'¥',Z:'Z'},
            dotted:        {a:'ȧ',b:'ḃ',c:'ċ',d:'ḋ',e:'ė',f:'ḟ',g:'ġ',h:'ḣ',i:'ı',j:'j',k:'k',l:'l',m:'ṁ',n:'ṅ',o:'ȯ',p:'ṗ',q:'q',r:'ṙ',s:'ṡ',t:'ṫ',u:'u',v:'v',w:'ẇ',x:'ẋ',y:'ẏ',z:'ż',A:'Ȧ',B:'Ḃ',C:'Ċ',D:'Ḋ',E:'Ė',F:'Ḟ',G:'Ġ',H:'Ḣ',I:'İ',J:'J',K:'K',L:'L',M:'Ṁ',N:'Ṅ',O:'Ȯ',P:'Ṗ',Q:'Q',R:'Ṙ',S:'Ṡ',T:'Ṫ',U:'U',V:'V',W:'Ẇ',X:'Ẋ',Y:'Ẏ',Z:'Ż'},
            oldeng:        {a:'𝒶',b:'𝒷',c:'𝒸',d:'𝒹',e:'𝑒',f:'𝒻',g:'𝑔',h:'𝒽',i:'𝒾',j:'𝒿',k:'𝓀',l:'𝓁',m:'𝓂',n:'𝓃',o:'𝑜',p:'𝓅',q:'𝓆',r:'𝓇',s:'𝓈',t:'𝓉',u:'𝓊',v:'𝓋',w:'𝓌',x:'𝓍',y:'𝓎',z:'𝓏',A:'𝒜',B:'ℬ',C:'𝒞',D:'𝒟',E:'ℰ',F:'ℱ',G:'𝒢',H:'ℋ',I:'ℐ',J:'𝒥',K:'𝒦',L:'ℒ',M:'ℳ',N:'𝒩',O:'𝒪',P:'𝒫',Q:'𝒬',R:'ℛ',S:'𝒮',T:'𝒯',U:'𝒰',V:'𝒱',W:'𝒲',X:'𝒳',Y:'𝒴',Z:'𝒵'},
            parenthesis:   {a:'⒜',b:'⒝',c:'⒞',d:'⒟',e:'⒠',f:'⒡',g:'⒢',h:'⒣',i:'⒤',j:'⒥',k:'⒦',l:'⒧',m:'⒨',n:'⒩',o:'⒪',p:'⒫',q:'⒬',r:'⒭',s:'⒮',t:'⒯',u:'⒰',v:'⒱',w:'⒲',x:'⒳',y:'⒴',z:'⒵',A:'⒜',B:'⒝',C:'⒞',D:'⒟',E:'⒠',F:'⒡',G:'⒢',H:'⒣',I:'⒤',J:'⒥',K:'⒦',L:'⒧',M:'⒨',N:'⒩',O:'⒪',P:'⒫',Q:'⒬',R:'⒭',S:'⒮',T:'⒯',U:'⒰',V:'⒱',W:'⒲',X:'⒳',Y:'⒴',Z:'⒵'},
            flags:         {a:'🇦',b:'🇧',c:'🇨',d:'🇩',e:'🇪',f:'🇫',g:'🇬',h:'🇭',i:'🇮',j:'🇯',k:'🇰',l:'🇱',m:'🇲',n:'🇳',o:'🇴',p:'🇵',q:'🇶',r:'🇷',s:'🇸',t:'🇹',u:'🇺',v:'🇻',w:'🇼',x:'🇽',y:'🇾',z:'🇿',A:'🇦',B:'🇧',C:'🇨',D:'🇩',E:'🇪',F:'🇫',G:'🇬',H:'🇭',I:'🇮',J:'🇯',K:'🇰',L:'🇱',M:'🇲',N:'🇳',O:'🇴',P:'🇵',Q:'🇶',R:'🇷',S:'🇸',T:'🇹',U:'🇺',V:'🇻',W:'🇼',X:'🇽',Y:'🇾',Z:'🇿'},
            medieval:      {a:'𝔞',b:'𝔟',c:'𝔠',d:'𝔡',e:'𝔢',f:'𝔣',g:'𝔤',h:'𝔥',i:'𝔦',j:'𝔧',k:'𝔨',l:'𝔩',m:'𝔪',n:'𝔫',o:'𝔬',p:'𝔭',q:'𝔮',r:'𝔯',s:'𝔰',t:'𝔱',u:'𝔲',v:'𝔳',w:'𝔴',x:'𝔵',y:'𝔶',z:'𝔷',A:'𝔄',B:'𝔅',C:'ℭ',D:'𝔇',E:'𝔈',F:'𝔉',G:'𝔊',H:'ℌ',I:'ℑ',J:'𝔍',K:'𝔎',L:'𝔏',M:'𝔐',N:'𝔑',O:'𝔒',P:'𝔓',Q:'𝔔',R:'ℜ',S:'𝔖',T:'𝔗',U:'𝔘',V:'𝔙',W:'𝔚',X:'𝔛',Y:'𝔜',Z:'ℨ'},
            cursive:       {a:'𝓪',b:'𝓫',c:'𝓬',d:'𝓭',e:'𝓮',f:'𝓯',g:'𝓰',h:'𝓱',i:'𝓲',j:'𝓳',k:'𝓴',l:'𝓵',m:'𝓶',n:'𝓷',o:'𝓸',p:'𝓹',q:'𝓺',r:'𝓻',s:'𝓼',t:'𝓽',u:'𝓾',v:'𝓿',w:'𝔀',x:'𝔁',y:'𝔂',z:'𝔃',A:'𝓐',B:'𝓑',C:'𝓒',D:'𝓓',E:'𝓔',F:'𝓕',G:'𝓖',H:'𝓗',I:'𝓘',J:'𝓙',K:'𝓚',L:'𝓛',M:'𝓜',N:'𝓝',O:'𝓞',P:'𝓟',Q:'𝓠',R:'𝓡',S:'𝓢',T:'𝓣',U:'𝓤',V:'𝓥',W:'𝓦',X:'𝓧',Y:'𝓨',Z:'𝓩'},
            aesthetic:     {a:'ａ',b:'ｂ',c:'ｃ',d:'ｄ',e:'ｅ',f:'ｆ',g:'ｇ',h:'ｈ',i:'ｉ',j:'ｊ',k:'ｋ',l:'ｌ',m:'ｍ',n:'ｎ',o:'ｏ',p:'ｐ',q:'ｑ',r:'ｒ',s:'ｓ',t:'ｔ',u:'ｕ',v:'ｖ',w:'ｗ',x:'ｘ',y:'ｙ',z:'ｚ',A:'Ａ',B:'Ｂ',C:'Ｃ',D:'Ｄ',E:'Ｅ',F:'Ｆ',G:'Ｇ',H:'Ｈ',I:'Ｉ',J:'Ｊ',K:'Ｋ',L:'Ｌ',M:'Ｍ',N:'Ｎ',O:'Ｏ',P:'Ｐ',Q:'Ｑ',R:'Ｒ',S:'Ｓ',T:'Ｔ',U:'Ｕ',V:'Ｖ',W:'Ｗ',X:'Ｘ',Y:'Ｙ',Z:'Ｚ','0':'０','1':'１','2':'２','3':'３','4':'４','5':'５','6':'６','7':'７','8':'８','9':'９'},
            tiny:          {a:'ᵃ',b:'ᵇ',c:'ᶜ',d:'ᵈ',e:'ᵉ',f:'ᶠ',g:'ᵍ',h:'ʰ',i:'ⁱ',j:'ʲ',k:'ᵏ',l:'ˡ',m:'ᵐ',n:'ⁿ',o:'ᵒ',p:'ᵖ',q:'q',r:'ʳ',s:'ˢ',t:'ᵗ',u:'ᵘ',v:'ᵛ',w:'ʷ',x:'ˣ',y:'ʸ',z:'ᶻ',A:'ᴬ',B:'ᴮ',C:'ᶜ',D:'ᴰ',E:'ᴱ',F:'ᶠ',G:'ᴳ',H:'ᴴ',I:'ᴵ',J:'ᴶ',K:'ᴷ',L:'ᴸ',M:'ᴹ',N:'ᴺ',O:'ᴼ',P:'ᴾ',Q:'Q',R:'ᴿ',S:'ˢ',T:'ᵀ',U:'ᵁ',V:'ᵛ',W:'ᵂ',X:'ˣ',Y:'ʸ',Z:'ᶻ'},
            gothic:        {a:'𝖆',b:'𝖇',c:'𝖈',d:'𝖉',e:'𝖊',f:'𝖋',g:'𝖌',h:'𝖍',i:'𝖎',j:'𝖏',k:'𝖐',l:'𝖑',m:'𝖒',n:'𝖓',o:'𝖔',p:'𝖕',q:'𝖖',r:'𝖗',s:'𝖘',t:'𝖙',u:'𝖚',v:'𝖛',w:'𝖜',x:'𝖝',y:'𝖞',z:'𝖟',A:'𝕬',B:'𝕭',C:'𝕮',D:'𝕯',E:'𝕰',F:'𝕱',G:'𝕲',H:'𝕳',I:'𝕴',J:'𝕵',K:'𝕶',L:'𝕷',M:'𝕸',N:'𝕹',O:'𝕺',P:'𝕻',Q:'𝕼',R:'𝕽',S:'𝕾',T:'𝕿',U:'𝖀',V:'𝖁',W:'𝖂',X:'𝖃',Y:'𝖄',Z:'𝖅'},
            inverted:      {a:'ɐ',b:'q',c:'ɔ',d:'p',e:'ǝ',f:'ɟ',g:'ƃ',h:'ɥ',i:'ᴉ',j:'ɾ',k:'ʞ',l:'l',m:'ɯ',n:'u',o:'o',p:'d',q:'b',r:'ɹ',s:'s',t:'ʇ',u:'n',v:'ʌ',w:'ʍ',x:'x',y:'ʎ',z:'z',A:'∀',B:'q',C:'Ɔ',D:'p',E:'Ǝ',F:'Ⅎ',G:'פ',H:'H',I:'I',J:'ɾ',K:'ʞ',L:'˥',M:'W',N:'N',O:'O',P:'Ԁ',Q:'Q',R:'ɹ',S:'S',T:'┴',U:'∩',V:'Λ',W:'M',X:'X',Y:'ʎ',Z:'Z'},
            mirror:        {a:'ɒ',b:'d',c:'ɔ',d:'b',e:'ɘ',f:'ʇ',g:'ϱ',h:'ʜ',i:'i',j:'ᴉ',k:'ʞ',l:'l',m:'m',n:'n',o:'o',p:'q',q:'p',r:'ɿ',s:'ƨ',t:'ƚ',u:'u',v:'v',w:'w',x:'x',y:'y',z:'z',A:'A',B:'ᗺ',C:'Ɔ',D:'ᗡ',E:'Ǝ',F:'ꟻ',G:'Ꭾ',H:'H',I:'I',J:'Ꮈ',K:'ꓘ',L:'⅃',M:'M',N:'И',O:'O',P:'ꟼ',Q:'Ọ',R:'Я',S:'Ƨ',T:'T',U:'U',V:'V',W:'W',X:'X',Y:'Y',Z:'Z'},
            currency:      {a:'₳',b:'฿',c:'₵',d:'₫',e:'€',f:'₣',g:'₲',h:'♄',i:'ł',j:'ʝ',k:'₭',l:'₤',m:'₥',n:'₦',o:'ø',p:'₱',q:'q',r:'®',s:'$',t:'₮',u:'µ',v:'√',w:'₩',x:'×',y:'¥',z:'z',A:'₳',B:'฿',C:'₵',D:'₫',E:'€',F:'₣',G:'₲',H:'♄',I:'ł',J:'ʝ',K:'₭',L:'₤',M:'₥',N:'₦',O:'ø',P:'₱',Q:'Q',R:'®',S:'$',T:'₮',U:'µ',V:'√',W:'₩',X:'×',Y:'¥',Z:'Z'},
            dotted:        {a:'ȧ',b:'ḃ',c:'ċ',d:'ḋ',e:'ė',f:'ḟ',g:'ġ',h:'ḣ',i:'ı',j:'j',k:'k',l:'l',m:'ṁ',n:'ṅ',o:'ȯ',p:'ṗ',q:'q',r:'ṙ',s:'ṡ',t:'ṫ',u:'u',v:'v',w:'ẇ',x:'ẋ',y:'ẏ',z:'ż',A:'Ȧ',B:'Ḃ',C:'Ċ',D:'Ḋ',E:'Ė',F:'Ḟ',G:'Ġ',H:'Ḣ',I:'İ',J:'J',K:'K',L:'L',M:'Ṁ',N:'Ṅ',O:'Ȯ',P:'Ṗ',Q:'Q',R:'Ṙ',S:'Ṡ',T:'Ṫ',U:'U',V:'V',W:'Ẇ',X:'Ẋ',Y:'Ẏ',Z:'Ż'},
            oldeng:        {a:'𝒶',b:'𝒷',c:'𝒸',d:'𝒹',e:'𝑒',f:'𝒻',g:'𝑔',h:'𝒽',i:'𝒾',j:'𝒿',k:'𝓀',l:'𝓁',m:'𝓂',n:'𝓃',o:'𝑜',p:'𝓅',q:'𝓆',r:'𝓇',s:'𝓈',t:'𝓉',u:'𝓊',v:'𝓋',w:'𝓌',x:'𝓍',y:'𝓎',z:'𝓏',A:'𝒜',B:'ℬ',C:'𝒞',D:'𝒟',E:'ℰ',F:'ℱ',G:'𝒢',H:'ℋ',I:'ℐ',J:'𝒥',K:'𝒦',L:'ℒ',M:'ℳ',N:'𝒩',O:'𝒪',P:'𝒫',Q:'𝒬',R:'ℛ',S:'𝒮',T:'𝒯',U:'𝒰',V:'𝒱',W:'𝒲',X:'𝒳',Y:'𝒴',Z:'𝒵'}
        }
        const _activeFont = global.ownerFontMode
        const _map = _fontMaps[_activeFont]
        if (_map) {
            let _converted
            if (_activeFont === 'wide') {
                _converted = [...budy].map(c=>{let code=c.charCodeAt(0);return (code>=33&&code<=126)?String.fromCharCode(code+65248):c===' '?'\u3000':c}).join('')
            } else if (_activeFont === 'upsidedown') {
                const _ud = {a:'ɐ',b:'q',c:'ɔ',d:'p',e:'ǝ',f:'ɟ',g:'ƃ',h:'ɥ',i:'ᴉ',j:'ɾ',k:'ʞ',l:'l',m:'ɯ',n:'u',o:'o',p:'d',q:'b',r:'ɹ',s:'s',t:'ʇ',u:'n',v:'ʌ',w:'ʍ',x:'x',y:'ʎ',z:'z',A:'∀',B:'q',C:'Ɔ',D:'p',E:'Ǝ',F:'Ⅎ',G:'פ',H:'H',I:'I',J:'ɾ',K:'ʞ',L:'˥',M:'W',N:'N',O:'O',P:'Ԁ',Q:'Q',R:'ɹ',S:'S',T:'┴',U:'∩',V:'Λ',W:'M',X:'X',Y:'ʎ',Z:'Z',' ':' '}
                _converted = [...budy].map(c=>_ud[c]||c).reverse().join('')
            } else if (_activeFont === 'strikethrough') {
                _converted = [...budy].map(c=>c===' '?' ':c+'̶').join('')
            } else if (_activeFont === 'underline') {
                _converted = [...budy].map(c=>c===' '?' ':c+'̲').join('')
            } else {
                _converted = [...budy].map(c=>_map[c]||c).join('')
            }
            // Only act if conversion actually changed something, and result is non-empty
            if (_converted && _converted.trim() && _converted !== budy) {
                await X.sendMessage(m.chat, { text: _converted, edit: m.key })
            }
        }
    } catch (_fe) {
        // Silently ignore font mode errors — never crash normal flow
    }
    return
}
//━━━━━━━━━━━━━━━━━━━━━━━━//
// jangan di apa apain
// Media download with retry — handles WhatsApp CDN socket hang up
// Panel restart helper — works on Heroku, Render, Railway, VPS, pm2, bare server
const _restartBot = () => {
  if (process.env._BOT_CHILD) {
    // Running under the built-in supervisor — just exit; supervisor restarts us in 3s
    setTimeout(() => process.exit(1), 500)
    return
  }
  // Running standalone (no supervisor) — try pm2, then exit with code 1
  const { exec: _rex } = require('child_process')
  _rex('pm2 restart all', (e1) => {
    if (!e1) return
    _rex('pm2 restart 0', (e2) => {
      if (!e2) return
      process.exit(1)
    })
  })
}
const _dlWithRetry = async (quotedMsg, maxTries = 3) => {
  let lastErr
  for (let _t = 0; _t < maxTries; _t++) {
    try {
      const _b = await Promise.race([
        quotedMsg.download(),
        new Promise((_,rej) => setTimeout(() => rej(new Error('Download timeout')), 20000))
      ])
      if (_b && _b.length > 100) return _b
      throw new Error('Empty buffer received')
    } catch (_e) {
      lastErr = _e
      if (_t < maxTries - 1) await new Promise(r => setTimeout(r, 1200 * (_t + 1)))
    }
  }
  throw lastErr
}
switch(command) {
// awas error
//━━━━━━━━━━━━━━━━━━━━━━━━//
// help command
case 'help': {
    await X.sendMessage(m.chat, { react: { text: '📋', key: m.key } })
const helpText = `╔══〔 📋  QUICK HELP GUIDE 〕══╗

║ .menu : all commands
║ .menu ai : AI & chat
║ .menu tools : utilities
║ .menu owner : bot settings
║ .menu group : group mgmt
║ .menu downloader : downloads
║ .menu search : search
║ .menu sticker : stickers
║ .menu games : games & fun
║ .menu other : effects & fonts
║ .menu football : sports & scores

╠══〔 ⚡  POPULAR COMMANDS 〕══╣
║ .ai : [question]
║ .sticker : reply media
║ .play : [song name]
║ .ig : [instagram url]
║ .tt : [tiktok url]
║ .toimage : sticker to image
║ .save : reply any message

╠════〔 📞  CONTACT 〕════╣
║ wa.me/254753204154
║ Telegram: @juicev12

║ _Powered by Juice v12_
╚═══════════════════════╝`
const helpThumb = global.botPic || global.thumb || 'https://files.catbox.moe/qbcebp.jpg'
X.sendMessage(m.chat, { image: { url: helpThumb }, caption: helpText }, { quoted: m })
break
}

// system menu
case 'menu': {
    await X.sendMessage(m.chat, { react: { text: '📋', key: m.key } })
// menu list - clear cache to always load fresh
const menuFiles = ['aimenu','toolsmenu','groupmenu','ownermenu','searchmenu','gamemenu','stickermenu','othermenu','downloadermenu','footballmenu'];
menuFiles.forEach(f => { try { delete require.cache[require.resolve('./library/menulist/' + f)]; } catch {} });
const aiMenu = require('./library/menulist/aimenu');
const toolsMenu = require('./library/menulist/toolsmenu');
const groupMenu = require('./library/menulist/groupmenu');
const ownerMenu = require('./library/menulist/ownermenu');
const searchMenu = require('./library/menulist/searchmenu');
const gameMenu = require('./library/menulist/gamemenu');
const stickerMenu = require('./library/menulist/stickermenu');
const otherMenu = require('./library/menulist/othermenu');
const downloaderMenu = require('./library/menulist/downloadermenu');
const footballMenu = require('./library/menulist/footballmenu');
const textmakerMenu = `
╔══〔 ✨ TEXT EFFECTS 〕═══╗
║ .metallic
║ .ice
║ .snow
║ .neon
║ .fire
║ .glitch
║ .thunder
║ .matrix
║ .hacker
║ .devil
║ .purple
║ .blackpink
║ .sand
║ .arena
║ .1917
║ .light
║ .impressive
║ .leaves
║ all accept [text]

╠══〔 🔤 FONT CONVERTER 〕══╣
║ .fonts : show all styles
║ .allfonts : [text]
║ .bold
║ .italic
║ .bolditalic
║ .mono
║ .serif
║ .serifbold
║ .serifitalic
║ .scriptfont
║ .scriptbold
║ .fraktur
║ .frakturbold
║ .doublestruck
║ .smallcaps
║ .bubble
║ .bubblebold
║ .square
║ .squarebold
║ .wide
║ .upsidedown
║ .strikethrough
║ .underline : all accept [text]
╚═══════════════════════╝`

  let subcmd = args[0] ? args[0].toLowerCase() : '';

  let infoBot = `╔══〔 ⚡ Juice v12 〕══╗
║ 👋 Hey *${pushname}*! ${waktuucapan}

║ 🤖 *Bot* : ${botname}
║ 👑 *Owner* : ${ownername}
║ 🔢 *Version* : v${botver}
║ ⚙️  *Mode* : ${typebot}
║ 📋 *Commands* : ${totalfitur()}
║ 📞 *Contact* : wa.me/254753204154
║ ✈️  *Telegram* : t.me/juicev12
║ 🔑 *Session* : ${global.sessionUrl}

╠══〔 📂  BROWSE BY CATEGORY 〕══╣
║ .menu ai : AI & Chat
║ .menu tools : Utilities
║ .menu owner : Bot Settings
║ .menu group : Group Mgmt
║ .menu downloader : Downloads
║ .menu search : Search
║ .menu sticker : Stickers
║ .menu games : Games & Fun
║ .menu other : Effects & Fonts
║ .menu football : Sports & Scores
║ .menu textmaker : Text Effects

╠══〔 📜  FULL COMMAND LIST 〕══╣
╚═══════════════════════╝`.trim();

  let menu = '';

  if (subcmd === 'ai') menu = aiMenu;
  else if (subcmd === 'tools') menu = toolsMenu;
  else if (subcmd === 'group') menu = groupMenu;
  else if (subcmd === 'owner') menu = ownerMenu;
  else if (subcmd === 'search') menu = searchMenu;
  else if (subcmd === 'games') menu = gameMenu;
  else if (subcmd === 'sticker') menu = stickerMenu;  
  else if (subcmd === 'other') menu = otherMenu;    
  else if (subcmd === 'downloader') menu = downloaderMenu;
  else if (subcmd === 'textmaker') menu = textmakerMenu;
  else if (subcmd === 'football' || subcmd === 'sports') menu = footballMenu;
  else if (subcmd === 'all') {
    menu = [
      otherMenu,
      downloaderMenu,
      stickerMenu,
      ownerMenu,
      groupMenu,
      toolsMenu,
      gameMenu,
      searchMenu,
      aiMenu,
      footballMenu,
      textmakerMenu
    ].join('\n');
  } else {
    menu = [
      otherMenu,
      downloaderMenu,
      stickerMenu,
      ownerMenu,
      groupMenu,
      toolsMenu,
      gameMenu,
      searchMenu,
      aiMenu,
      footballMenu,
      textmakerMenu
    ].join('\n');
  }

  let fullMenu = `${infoBot}\n${menu}`;

  // Resolve thumbnail — honour .menuimage setting, persist across restarts
  let _thumbBuf = null
  try {
    const _mt = global.menuThumb
    const _savedThumb = path.join(__dirname, 'media', 'menu_thumb.jpg')
    if (_mt) {
      if (/^https?:\/\//.test(_mt)) {
        _thumbBuf = await getBuffer(_mt).catch(() => null)
      } else if (fs.existsSync(_mt)) {
        _thumbBuf = fs.readFileSync(_mt)
      }
    }
    // Auto-restore saved thumbnail from disk after bot restart
    if (!_thumbBuf && fs.existsSync(_savedThumb)) {
      if (!global.menuThumb) global.menuThumb = _savedThumb
      _thumbBuf = fs.readFileSync(_savedThumb)
    }
    if (!_thumbBuf) _thumbBuf = fs.readFileSync(path.join(__dirname, 'media', 'thumb.png'))
  } catch {}

  await X.sendMessage(
    m.chat,
    {
      text: fullMenu,
      contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        mentionedJid: [sender],
        externalAdReply: {
          title: "Juice v12",
          body: "Juice v12",
          thumbnail: _thumbBuf || undefined,
          sourceUrl: global.wagc || global.sessionUrl || '',
          mediaType: 1,
          renderLargerThumbnail: true
        }
      }
    },
    { quoted: m }
  );
}
break;

//━━━━━━━━━━━━━━━━━━━━━━━━//
// Download Features
case 'mfdl':
case 'mediafire': {
    await X.sendMessage(m.chat, { react: { text: '📥', key: m.key } })
 if (!text) return reply(`╔══〔 📥 MEDIAFIRE 〕══════╗
║ *Usage:* ${prefix}mediafire [link]
║ Example: ${prefix}mediafire https://mediafire.com/...
╚═══════════════════════╝`)
  try {
    const _mfHtml = await axios.get(text, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 20000
    })
    const _mfPage = _mfHtml.data || ''
    const _dlMatch = _mfPage.match(/href="(https:\/\/download\d*\.mediafire\.com\/[^"]+)"/)
      || _mfPage.match(/"downloadUrl":"([^"]+)"/)
      || _mfPage.match(/id="downloadButton"[^>]+href="([^"]+)"/)
    if (!_dlMatch) return reply('❌ Could not extract download link. Please check the MediaFire URL.')
    const _dlLink = _dlMatch[1].replace(/&amp;/g, '&')
    const _fnMatch = _mfPage.match(/"filename"\s*:\s*"([^"]+)"/)
      || _mfPage.match(/class="filename"[^>]*>([^<]+)</)
      || _mfPage.match(/<title>([^<|]+)/)
    const fileNama = (_fnMatch ? _fnMatch[1].trim() : 'mediafire_file') + ''
    const extension = fileNama.split('.').pop().toLowerCase()
    let mimetype = extension === 'mp4' ? 'video/mp4' : extension === 'mp3' ? 'audio/mpeg' : `application/${extension}`
    const _res = await axios.get(_dlLink, {
      responseType: 'arraybuffer', timeout: 60000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    })
    await X.sendMessage(m.chat, {
      document: Buffer.from(_res.data),
      fileName: fileNama,
      mimetype: mimetype
    }, { quoted: m })
  } catch (err) {
    console.error('[MEDIAFIRE]', err.message)
    reply('❌ Download failed. Make sure the MediaFire link is valid and public.')
  }
}
break
case 'ig':
  case 'instagram': {
      await X.sendMessage(m.chat, { react: { text: '📸', key: m.key } })
      if (!text) return reply(`╔══〔 📸 INSTAGRAM DL 〕═══╗\n\n║ Usage: *${prefix}ig [link]*\n║ Example: ${prefix}ig https://www.instagram.com/p/...\n╚═══════════════════════╝`);
      let _igUrl = null

      // Source 1: igdl library (btch-downloader)
      try {
          const mediaUrl = await igdl(text);
          if (mediaUrl?.[0]?.url) _igUrl = mediaUrl[0].url
          console.log('[ig] igdl:', _igUrl ? 'success' : 'no url')
      } catch(_e1) { console.log('[ig] igdl:', _e1.message) }

      // Source 2: api-dylux ig downloader
      if (!_igUrl) {
        try {
          const { igdl: _dyluxIg } = require('api-dylux')
          const _dynRes = await Promise.race([_dyluxIg(text), new Promise(r=>setTimeout(()=>r(null),15000))])
          if (_dynRes?.[0]?.url) { _igUrl = _dynRes[0].url; console.log('[ig] api-dylux: success') }
        } catch(_e2) { console.log('[ig] api-dylux:', _e2.message) }
      }

      // Source 3: GiftedTech instadl
      if (!_igUrl) {
        try {
          let _gtIg = await fetch(`https://api.giftedtech.co.ke/api/download/instadl?apikey=${_giftedKey()}&url=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
          let _gtIgd = await _gtIg.json()
          console.log('[ig] gifted:', _gtIgd.success)
          if (_gtIgd.success && _gtIgd.result?.download_url) _igUrl = _gtIgd.result.download_url
        } catch(_e3) { console.log('[ig] gifted:', _e3.message) }
      }

      if (!_igUrl) return reply('❌ Failed to download. The link may be private or invalid. Try again.')
      try {
          const response = await axios.head(_igUrl);
          const contentType = response.headers['content-type'];
          if (contentType && contentType.startsWith('image/')) {
              await safeSendMedia(m.chat, { image: { url: _igUrl}, caption: `╔══〔 📸 INSTAGRAM DOWNLOAD 〕╗
║ ✅ Downloaded!
╚═══════════════════════╝` }, {}, { quoted: m });
          } else {
              await safeSendMedia(m.chat, { video: { url: _igUrl}, caption: `╔══〔 📸 INSTAGRAM DOWNLOAD 〕╗
║ ✅ Downloaded!
╚═══════════════════════╝` }, {}, { quoted: m });
          }
      } catch(e) {
         console.log('[ig] send error:', e.message)
         reply('❌ An error occurred while sending the media. Please try again.')
      }
  }
break

  case 'tw':
  case 'twitter':
  case 'xdl': {
      await X.sendMessage(m.chat, { react: { text: '🐦', key: m.key } })
      if (!text) return reply(`╔══〔 🐦 TWITTER DOWNLOADER 〕══╗\n\n║ Usage: *${prefix + command} <link>*\n║ Example: ${prefix + command} https://x.com/i/status/...\n╚═══════════════════════╝`)
      let _twUrl = null, _twThumb = null

      // Source 1: EliteProTech /twitter (working endpoint)
      try {
        const _epTw = await fetch(`https://eliteprotech-apis.zone.id/twitter?url=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
        const _epTwd = await _epTw.json()
        console.log('[tw] eliteprotech/twitter: success=', _epTwd.success, 'count=', _epTwd.data?.length)
        if (_epTwd.success && Array.isArray(_epTwd.data) && _epTwd.data.length) {
          // Pick highest quality entry
          const _sorted = [..._epTwd.data].sort((a,b) => (parseInt(b.quality||b.resolution)||0) - (parseInt(a.quality||a.resolution)||0))
          const _pick = _sorted.find(x => x.url) || _sorted[0]
          if (_pick?.url) { _twUrl = _pick.url; _twThumb = _epTwd.thumbnail || null }
        }
      } catch(_e1) { console.log('[tw] eliteprotech/twitter:', _e1.message) }

      // Source 2: GiftedTech twitter
      if (!_twUrl) {
        try {
          const _gtTw = await fetch(`https://api.giftedtech.co.ke/api/download/twitter?apikey=${_giftedKey()}&url=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
          const _gtTwd = await _gtTw.json()
          console.log('[tw] gifted:', _gtTwd.success)
          if (_gtTwd.success && _gtTwd.result?.videoUrls?.length) {
            const _sorted = _gtTwd.result.videoUrls.sort((a,b) => (parseInt(b.quality)||0) - (parseInt(a.quality)||0))
            _twUrl = _sorted[0].url
            _twThumb = _gtTwd.result.thumbnail || null
          }
        } catch(_e2) { console.log('[tw] gifted:', _e2.message) }
      }

      if (!_twUrl) return reply('❌ Failed to download. The link may be invalid or the tweet has no video.')
      try {
        await safeSendMedia(m.chat, { video: { url: _twUrl }, caption: '✅ Downloaded from X/Twitter' }, {}, { quoted: m })
      } catch(e) { reply('❌ Error sending media: ' + e.message) }
  }
  break

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🕵️  SOCIAL STALKER (Keith API)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  case 'tiktokstalk':
  case 'tikstalk': {
      await X.sendMessage(m.chat, { react: { text: '🎵', key: m.key } })
      const _tksu = q?.trim() || text?.trim()
      if (!_tksu) return reply(`╌══〔 🎵 TIKTOK STALK 〕══╌\n║ *Usage:* ${prefix}tiktokstalk [@username]\n║ Example: ${prefix}tiktokstalk @charlidamelio\n╚═══════════════════════╝`)
      try {
          await reply(`🔍 _Stalking TikTok: ${_tksu}..._`)
          const _tkd = await _keithFetch(`/stalker/tiktok?user=${encodeURIComponent(_tksu.replace('@',''))}`)
          const _tkp = _tkd?.profile || _tkd?.result?.profile || _tkd
          if (!_tkp?.username) throw new Error('User not found')
          let msg = `╌══〔 🎵 TIKTOK PROFILE 〕═╌\n`
          msg += `\n👤 *@${_tkp.username}* (_${_tkp.nickname || ''}_ )\n`
          if (_tkp.bio) msg += `\n💬 *Bio:* ${_tkp.bio}\n`
          if (_tkp.followers !== undefined) msg += `\n👥 *Followers:* ${_tkp.followers?.toLocaleString() || _tkp.followers}\n`
          if (_tkp.following !== undefined) msg += `💞 *Following:* ${_tkp.following?.toLocaleString() || _tkp.following}\n`
          if (_tkp.likes !== undefined) msg += `❤️ *Total Likes:* ${_tkp.likes?.toLocaleString() || _tkp.likes}\n`
          if (_tkp.videos !== undefined) msg += `🎬 *Videos:* ${_tkp.videos}\n`
          if (_tkp.verified) msg += `✅ *Verified Account*\n`
          msg += `\n╚═══════════════════════╝`
          await reply(msg)
      } catch(e) { reply(`❌ Could not stalk TikTok user *${_tksu}*. Make sure the username is correct.`) }
  } break

  case 'igstalk':
  case 'instastalk': {
      await X.sendMessage(m.chat, { react: { text: '📷', key: m.key } })
      const _igsu = q?.trim() || text?.trim()
      if (!_igsu) return reply(`╌══〔 📷 INSTAGRAM STALK 〕╌\n║ *Usage:* ${prefix}igstalk [@username]\n║ Example: ${prefix}igstalk @cristiano\n╚═══════════════════════╝`)
      try {
          await reply(`🔍 _Stalking Instagram: ${_igsu}..._`)
          const _igd = await _keithFetch(`/stalker/ig?user=${encodeURIComponent(_igsu.replace('@',''))}`)
          const _igp = _igd?.profile || _igd?.result?.profile || _igd
          if (!_igp?.username) throw new Error('Not found')
          let msg = `╌══〔 📷 INSTAGRAM PROFILE 〕╌\n`
          msg += `\n👤 *@${_igp.username}* (_${_igp.fullName || _igp.name || ''}_ )\n`
          if (_igp.bio) msg += `\n💬 *Bio:* ${_igp.bio}\n`
          if (_igp.followers !== undefined) msg += `\n👥 *Followers:* ${_igp.followers?.toLocaleString() || _igp.followers}\n`
          if (_igp.following !== undefined) msg += `💞 *Following:* ${_igp.following?.toLocaleString() || _igp.following}\n`
          if (_igp.posts !== undefined) msg += `🖼️ *Posts:* ${_igp.posts}\n`
          if (_igp.isPrivate) msg += `🔒 *Private Account*\n`
          if (_igp.isVerified) msg += `✅ *Verified Account*\n`
          msg += `\n╚═══════════════════════╝`
          await reply(msg)
      } catch(e) { reply(`❌ Could not fetch Instagram profile *${_igsu}*.`) }
  } break

  case 'twitterstalk':
  case 'xstalk': {
      await X.sendMessage(m.chat, { react: { text: '🐦', key: m.key } })
      const _twsu = q?.trim() || text?.trim()
      if (!_twsu) return reply(`╌══〔 🐦 TWITTER/X STALK 〕═╌\n║ *Usage:* ${prefix}twitterstalk [@username]\n║ Example: ${prefix}twitterstalk @elonmusk\n╚═══════════════════════╝`)
      try {
          await reply(`🔍 _Stalking X/Twitter: ${_twsu}..._`)
          const _twsd = await _keithFetch(`/stalker/twitter?user=${encodeURIComponent(_twsu.replace('@',''))}`)
          const _twsp = _twsd?.profile || _twsd?.result?.profile || _twsd
          if (!_twsp?.username) throw new Error('User not found')
          let msg = `╌══〔 🐦 TWITTER/X PROFILE 〕╌\n`
          msg += `\n👤 *@${_twsp.username}*\n`
          if (_twsp.displayName || _twsp.name) msg += `   🏷️ ${_twsp.displayName || _twsp.name}\n`
          if (_twsp.bio || _twsp.description) msg += `\n💬 *Bio:* ${_twsp.bio || _twsp.description}\n`
          if (_twsp.followers !== undefined) msg += `\n👥 *Followers:* ${(_twsp.followers || 0).toLocaleString()}\n`
          if (_twsp.following !== undefined) msg += `💞 *Following:* ${(_twsp.following || 0).toLocaleString()}\n`
          if (_twsp.tweets !== undefined) msg += `📝 *Tweets:* ${(_twsp.tweets || 0).toLocaleString()}\n`
          if (_twsp.likes !== undefined) msg += `❤️ *Likes:* ${(_twsp.likes || 0).toLocaleString()}\n`
          if (_twsp.location) msg += `📍 *Location:* ${_twsp.location}\n`
          if (_twsp.verified || _twsp.isVerified) msg += `✅ *Verified Account*\n`
          if (_twsp.joinDate || _twsp.created) msg += `📅 *Joined:* ${_twsp.joinDate || _twsp.created}\n`
          msg += `\n╚═══════════════════════╝`
          await reply(msg)
      } catch(e) { reply(`❌ Could not stalk *${_twsu}*. Check the username and try again.`) }
  } break


  case 'githubtrends':
  case 'ghtrend': {
      await X.sendMessage(m.chat, { react: { text: '💜', key: m.key } })
      try {
          await reply('🔍 _Fetching GitHub trending repos..._')
          const _ghd = await _keithFetch('/stalker/githubtrend')
          const _gha = Array.isArray(_ghd) ? _ghd : (_ghd?.result || _ghd?.repos || [])
          if (!_gha.length) throw new Error('No data')
          let msg = `╌══〔 💜 GITHUB TRENDING 〕═╌\n`
          for (let r of _gha.slice(0, 10)) { msg += `\n${r.rank || '?'}. *${r.title || r.name}*\n   ✍️ ${r.author || ''}  |  🔗 ${r.url || ''}\n` }
          msg += `\n╚═══════════════════════╝`
          await reply(msg)
      } catch(e) { reply('❌ Could not fetch GitHub trends. Try again later.') }
  } break

  case 'countryinfo':
  case 'country': {
      await X.sendMessage(m.chat, { react: { text: '🌍', key: m.key } })
      const _ciq = q?.trim() || text?.trim()
      if (!_ciq) return reply(`╌══〔 🌍 COUNTRY INFO 〕══╌\n║ *Usage:* ${prefix}country [name]\n║ Example: ${prefix}country Kenya\n╚═══════════════════════╝`)
      try {
          await reply(`🌍 _Looking up: ${_ciq}..._`)
          const _cid = await _keithFetch(`/stalker/country?region=${encodeURIComponent(_ciq)}`)
          const _cir = _cid?.result || (Array.isArray(_cid) ? _cid[0] : _cid)
          if (!_cir?.name) throw new Error('Not found')
          let msg = `╌══〔 🌍 ${(_cir.name?.common || _cir.name || _ciq).toUpperCase()} 〕╌\n`
          const _cin = _cir.name?.common || _cir.name; if (_cin) msg += `\n🏳️ *Name:* ${_cin}\n`
          if (_cir.capital) msg += `🏢 *Capital:* ${Array.isArray(_cir.capital) ? _cir.capital[0] : _cir.capital}\n`
          if (_cir.population) msg += `👥 *Population:* ${_cir.population?.toLocaleString()}\n`
          if (_cir.region) msg += `🗺️ *Region:* ${_cir.region}\n`
          if (_cir.subregion) msg += `🏷️ *Subregion:* ${_cir.subregion}\n`
          if (_cir.languages) msg += `🗣️ *Languages:* ${Object.values(_cir.languages).slice(0,3).join(', ')}\n`
          if (_cir.currencies) msg += `💰 *Currency:* ${Object.values(_cir.currencies).map(c => `${c.name} (${c.symbol || '?'})`).join(', ')}\n`
          if (_cir.flag || _cir.emoji) msg += `\n${_cir.flag || _cir.emoji}\n`
          msg += `\n╚═══════════════════════╝`
          await reply(msg)
      } catch(e) { reply(`❌ Country *${_ciq}* not found. Try the full name.`) }
  } break

  case 'npminfo':
  case 'npm': {
      await X.sendMessage(m.chat, { react: { text: '📦', key: m.key } })
      const _npq = q?.trim() || text?.trim()
      if (!_npq) return reply(`╌══〔 📦 NPM INFO 〕═══════╌\n║ *Usage:* ${prefix}npm [package-name]\n║ Example: ${prefix}npm baileys\n╚═══════════════════════╝`)
      try {
          await reply(`📦 _Looking up npm: ${_npq}..._`)
          const _npd = await _keithFetch(`/stalker/npm?q=${encodeURIComponent(_npq)}`)
          const _npr = _npd?.result || _npd
          if (!_npr?.name) throw new Error('Not found')
          let msg = `╌══〔 📦 NPM: ${_npr.name} 〕══╌\n`
          if (_npr.description) msg += `\n📝 *Description:* ${_npr.description}\n`
          if (_npr.version) msg += `📌 *Latest Version:* ${_npr.version}\n`
          if (_npr.author) msg += `✍️ *Author:* ${typeof _npr.author === 'object' ? _npr.author.name : _npr.author}\n`
          if (_npr.license) msg += `📄 *License:* ${_npr.license}\n`
          if (_npr.weeklyDownloads) msg += `📥 *Weekly Downloads:* ${_npr.weeklyDownloads?.toLocaleString()}\n`
          if (_npr.homepage) msg += `🔗 *Homepage:* ${_npr.homepage}\n`
          msg += `\n📦 npm install ${_npr.name}\n`
          msg += `\n╚═══════════════════════╝`
          await reply(msg)
      } catch(e) { reply(`❌ Package *${_npq}* not found on npm.`) }
  } break

  case 'pinterestsearch':
  case 'pinterest': {
      await X.sendMessage(m.chat, { react: { text: '📌', key: m.key } })
      const _piq = q?.trim() || text?.trim()
      if (!_piq) return reply(`╌══〔 📌 PINTEREST 〕══════╌\n║ *Usage:* ${prefix}pinterest [search]\n║ Example: ${prefix}pinterest cute cats\n╚═══════════════════════╝`)
      try {
          await reply(`📌 _Searching Pinterest for: ${_piq}..._`)
          const _pid = await _keithFetch(`/stalker/pinterest?q=${encodeURIComponent(_piq)}`)
          const _pir = Array.isArray(_pid) ? _pid : (_pid?.result || _pid?.pins || [])
          if (!_pir.length) { reply(`❌ No Pinterest results for *${_piq}*`); break }
          const _pickpin = _pir[Math.floor(Math.random() * Math.min(_pir.length, 5))]
          const _pinUrl = _pickpin.url || _pickpin.image || _pickpin.imageUrl
          if (_pinUrl) {
              await safeSendMedia(m.chat, { image: { url: _pinUrl }, caption: `📌 *Pinterest: ${_piq}*\n\n🔎 ${_pir.length} results found` }, {}, { quoted: m })
          } else {
              let msg = `╌══〔 📌 PINTEREST: ${_piq} 〕╌\n`
              for (let p of _pir.slice(0, 5)) { msg += `\n📌 *${p.title || p.board || ''}* \n   🔗 ${p.link || p.url || ''}\n` }
              msg += `\n╚═══════════════════════╝`
              await reply(msg)
          }
      } catch(e) { reply('❌ Pinterest search failed. Try again later.') }
  } break



  case 'firelogo':
  case 'flogo': {
      await X.sendMessage(m.chat, { react: { text: '🔥', key: m.key } })
      if (!text) return reply(`╔═══〔 🔥 FIRE LOGO 〕════╗\n\n║ Usage: *${prefix + command} [your text]*\n║ Example: ${prefix + command} TOOSII\n╚═══════════════════════╝`)
      try {
        const _fl = await fetch(`https://eliteprotech-apis.zone.id/firelogo?text=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
        const _fld = await _fl.json()
        if (_fld.success && _fld.image) {
          await safeSendMedia(m.chat, { image: { url: _fld.image }, caption: `🔥 *Fire Logo* : ${text}` }, {}, { quoted: m })
        } else reply('❌ Failed to generate logo. Try shorter text.')
      } catch(e) { reply('❌ Error: ' + e.message) }
  }
  break

  case 'spotify':
  case 'sp': {
      await X.sendMessage(m.chat, { react: { text: '🎵', key: m.key } })
      if (!text) return reply(`╔══〔 🎵 SPOTIFY 〕════════╗\n\n║ *Download:* ${prefix}spotify [track url]\n║ *Search:*   ${prefix}spotify [song name]\n╚═══════════════════════╝`)
      const _isSpotUrl = /open\.spotify\.com\/track|spotify\.link/i.test(text)
      if (!_isSpotUrl) {
          // Song name search → show YouTube results
          try {
              let _srch = await yts(text)
              let _hits = (_srch.all || []).filter(v => v.type === 'video').slice(0, 5)
              if (!_hits.length) return reply('❌ No results found. Try different keywords.')
              let _out = `╔══〔 🔍 SPOTIFY SEARCH 〕══╗\n\n`
              _hits.forEach((v, i) => {
                  _out += `║ *${i+1}.* ${(v.title||'').slice(0,50)}\n`
                  _out += `║    👤 ${v.author?.name || 'Unknown'} | ⏱️ ${v.timestamp || '?'}\n`
              })
              _out += `╠══〔 📥 DOWNLOAD 〕════════╣\n║ Use *${prefix}play [song name]* to download\n╚═══════════════════════╝`
              return reply(_out)
          } catch (_se) { return reply('❌ Search failed: ' + _se.message) }
      }
      try {
        const _sp = await fetch(`https://eliteprotech-apis.zone.id/spotify?url=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(25000) })
        const _spd = await _sp.json()
        if (_spd.success && _spd.data?.download) {
          const _meta = _spd.data.metadata
          const _cap = `🎵 *${_meta?.title || 'Track'}*\n👤 ${_meta?.artist || 'Unknown'}\n⏱️ ${_meta?.duration || '--:--'}\n\n_Downloaded via Juice v12_`
          await X.sendMessage(m.chat, { audio: { url: _spd.data.download }, mimetype: 'audio/mpeg', fileName: `${_meta?.title || 'spotify'}.mp3` }, { quoted: m })
          await reply(_cap)
        } else {
          // Fallback: Keith Spotify
          try {
            let _kSp = await fetch(`https://apiskeith.top/download/spotify?url=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(25000) })
            let _kSpd = await _kSp.json()
            console.log('[spotify] keith:', _kSpd.status)
            if (_kSpd.status && (_kSpd.result?.download_url || _kSpd.result?.url)) {
              let _spUrl = _kSpd.result.download_url || _kSpd.result.url
              let _spTitle = _kSpd.result.title || 'Spotify Track'
              await X.sendMessage(m.chat, { audio: { url: _spUrl }, mimetype: 'audio/mpeg', fileName: `${_spTitle}.mp3` }, { quoted: m })
              reply(`╔══〔 🎵 SPOTIFY DOWNLOAD 〕══╗
║ 🎵 *${_spTitle}*
╚═══════════════════════╝`)
            } else reply('❌ Could not download. Make sure it is a valid public Spotify track link.')
          } catch (_kE) { reply('❌ Could not download. Make sure it is a valid public Spotify track link.') }
        }
      } catch(e) { reply('❌ Error: ' + e.message) }
  }
  break

  case 'tempemail':
  case 'tempmail': {
      await X.sendMessage(m.chat, { react: { text: '📧', key: m.key } })

      // ── Check inbox: .tempmail [email] ──────────────────────────────
      if (text && text.includes('@')) {
          try {
              await reply('📬 _Checking inbox, please wait..._')
              let _inboxReply = null
              // Primary: Keith API
              try {
                  const _ki = await _keithFetch(`/tempmail/inbox?email=${encodeURIComponent(text.trim())}`)
                  const _kim = _ki?.result?.messages || _ki?.messages || (_ki?.result ? [_ki.result] : null)
                  if (Array.isArray(_kim) && _kim.length) {
                      const _msg = _kim[0]
                      const _from    = _msg.from || _msg.sender || 'Unknown'
                      const _subject = _msg.subject || '(no subject)'
                      const _time    = _msg.date || _msg.time || 'Unknown'
                      const _body    = (_msg.body || _msg.text || _msg.content || _msg.message || '').slice(0, 1500)
                      _inboxReply = `╔══〔 📬 INBOX 〕══╗\n\n║ 📧 *To* : ${text.trim()}\n║ 👤 *From* : ${_from}\n║ 📌 *Subject* : ${_subject}\n║ 🕐 *Time* : ${_time}\n${_body ? '\n' + _body + '\n' : ''}\n╚═══════════════════════╝`
                  } else if (_ki !== null) {
                      _inboxReply = `╔══〔 📭 INBOX EMPTY 〕═══╗\n\n║ 📧 *Email* : ${text.trim()}\n\n║ _No messages received yet._\n╚═══════════════════════╝`
                  }
              } catch(_) {}
              // Fallback: eliteprotech
              if (!_inboxReply) {
                  const _ti = await fetch(`https://eliteprotech-apis.zone.id/tempemail?action=inbox&email=${encodeURIComponent(text.trim())}`, { signal: AbortSignal.timeout(20000) })
                  const _tid = await _ti.json()
                  if (!_tid.success) return reply('❌ Could not check inbox. Make sure the email is valid.')
                  if (!_tid.inbox) {
                      return reply(`╔══〔 📭 INBOX EMPTY 〕═══╗\n\n║ 📧 *Email* : ${text.trim()}\n\n║ _No messages received yet._\n║ _Send something to this address, then check again._\n╚═══════════════════════╝`)
                  }
                  const _fmsg = _tid.inbox
                  const _fbody = (_fmsg.body || _fmsg.text || _fmsg.content || _fmsg.message || '').slice(0, 1500)
                  _inboxReply = `╔══〔 📬 INBOX 〕══╗\n\n║ 📧 *To* : ${text.trim()}\n║ 👤 *From* : ${_fmsg.from || 'Unknown'}\n║ 📌 *Subject* : ${_fmsg.subject || '(no subject)'}\n║ 🕐 *Time* : ${_fmsg.time || 'Unknown'}\n${_fbody ? '\n' + _fbody + '\n' : ''}\n╚═══════════════════════╝`
              }
              reply(_inboxReply || '❌ Could not check inbox. Try again.')
          } catch(e) { reply('❌ Inbox check failed: ' + e.message) }

      // ── Generate new temp email: .tempmail ──────────────────────────
      } else {
          try {
              let _email = null
              // Primary: Keith API
              try {
                  const _ke = await _keithFetch('/tempmail/generate')
                  _email = _ke?.result?.email || _ke?.email || (typeof _ke?.result === 'string' ? _ke.result : null)
              } catch(_) {}
              // Fallback: eliteprotech
              if (!_email) {
                  const _te = await fetch('https://eliteprotech-apis.zone.id/tempemail', { signal: AbortSignal.timeout(15000) })
                  const _ted = await _te.json()
                  if (_ted.success && _ted.email) _email = _ted.email
              }
              if (_email) {
                  reply(`╔══〔 📧 TEMP EMAIL 〕══╗\n\n║ ✅ *Your Temporary Email:*\n\n║ 📨  ${_email}\n\n║ Use it for sign-ups & verifications\n║ To check received messages:\n║ *${prefix}tempmail ${_email}*\n\n║ _Inbox refreshes on each check._\n╚═══════════════════════╝`)
              } else reply('❌ Failed to generate email. Try again.')
          } catch(e) { reply('❌ Error: ' + e.message) }
      }
  } break

  case 'tt':  
case 'tt':
case 'tiktok': {
    await X.sendMessage(m.chat, { react: { text: '🎵', key: m.key } })
if (!text) return reply(`╔══〔 🎵 TIKTOK DOWNLOADER 〕══╗\n\n║ Usage:  *${prefix}tt [tiktok url]*\n║ Example: ${prefix}tt https://vm.tiktok.com/xxx\n╚═══════════════════════╝`)
try {
    let data = await fg.tiktok(text)
    if (!data || !data.result) return reply('╔══〔 ❌ DOWNLOAD FAILED 〕══╗\n\n║ Failed to download.\n║ The link may be invalid.\n╚═══════════════════════╝')
    let json = data.result
    let caption = `╔══〔 🎵 TIKTOK DOWNLOAD 〕══╗\n`
    caption += `║ 👤 *Username* : ${json.author?.nickname || 'Unknown'}\n`
    caption += `║ 📝 *Title* : ${json.title || '-'}\n`
    caption += `║ ❤️  *Likes* : ${json.digg_count || 0}\n`
    caption += `║ 💬 *Comments* : ${json.comment_count || 0}\n`
    caption += `║ 🔁 *Shares* : ${json.share_count || 0}\n`
    caption += `║ ▶️  *Plays* : ${json.play_count || 0}\n`
    caption += `║ ⏱️  *Duration* : ${json.duration || '-'}\n`
    caption += `╚═══════════════════════╝`
    if (json.images && json.images.length) {
        for (const k of json.images) {
            if (k) await safeSendMedia(m.chat, { image: { url: k }}, {}, { quoted: m });
        }
    } else if (json.play) {
        await safeSendMedia(m.chat, { video: { url: json.play }, mimetype: 'video/mp4', caption: caption }, {}, { quoted: m });
        if (json.music) {
            await sleep(3000);
            await safeSendMedia(m.chat, { audio: { url: json.music }, mimetype: 'audio/mpeg' }, {}, { quoted: m });
        }
    } else {
        reply('╔══〔 ❌ DOWNLOAD FAILED 〕══╗\n\n║ Failed to download.\n║ No media URL found from source.\n╚═══════════════════════╝')
    }
} catch (err1) {
    console.log('[tt] fg.tiktok failed:', err1.message)
    // Fallback: EliteProTech /tiktok
    let _ttFallback = false
    try {
      let _ep = await fetch(`https://eliteprotech-apis.zone.id/tiktok?url=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(25000) })
      let _epd = await _ep.json()
      console.log('[tt] eliteprotech:', _epd.success)
      if (_epd.success && (_epd.video || _epd.result?.url || _epd.data?.url)) {
        let _vidUrl = _epd.video || _epd.result?.url || _epd.data?.url || _epd.url
        let _ttCap = `╔══〔 🎵 TIKTOK DOWNLOAD 〕══╗
║ 👤 *Author* : ${_epd.author?.nickname || _epd.author || 'Unknown'}
║ 📝 *Title* : ${(_epd.title || _epd.desc || '').slice(0,80)}
╚═══════════════════════╝`
        await safeSendMedia(m.chat, { video: { url: _vidUrl }, mimetype: 'video/mp4', caption: _ttCap }, {}, { quoted: m })
        _ttFallback = true
      }
    } catch (_e2) { console.log('[tt] eliteprotech:', _e2.message) }
    // Fallback 2: tikwm
    if (!_ttFallback) {
      try {
        let _tw = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(text)}&hd=1`, { signal: AbortSignal.timeout(25000) })
        let _twd = await _tw.json()
        console.log('[tt] tikwm: code=', _twd.code)
        if (_twd.code === 0 && _twd.data?.play) {
          let _vidUrl2 = _twd.data.hdplay || _twd.data.play
          let _ttCap2 = `╔══〔 🎵 TIKTOK DOWNLOAD 〕══╗
║ 👤 *Author* : ${_twd.data.author?.nickname || 'Unknown'}
║ 📝 *Title* : ${(_twd.data.title || '').slice(0,80)}
║ ❤️  *Likes* : ${_twd.data.digg_count || 0}
║ ▶️  *Plays* : ${_twd.data.play_count || 0}
╚═══════════════════════╝`
          await safeSendMedia(m.chat, { video: { url: _vidUrl2 }, mimetype: 'video/mp4', caption: _ttCap2 }, {}, { quoted: m })
          if (_twd.data.music) await safeSendMedia(m.chat, { audio: { url: _twd.data.music }, mimetype: 'audio/mpeg' }, {}, { quoted: m })
          _ttFallback = true
        }
      } catch (_e3) { console.log('[tt] tikwm:', _e3.message) }
    }
    if (!_ttFallback) reply('❌ TikTok download failed. Please make sure the link is valid and public.')
}
}
break

case 'fb':
case 'fbdl':
case 'facebook' : {
if (!text) return reply(`╔══〔 📘 FACEBOOK DL 〕════╗\n\n║ Usage: *${prefix}fb [link]*\n║ Example: ${prefix}fb https://www.facebook.com/...\n╚═══════════════════════╝`)
    try {
        await X.sendMessage(m.chat, { react: { text: '📥', key: m.key } })
        let _fbUrl = null, _fbTitle = null, _fbDuration = null

        // Source 1: EliteProTech API
        try {
          let _ep = await fetch(`https://eliteprotech-apis.zone.id/facebook?url=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
          let _epd = await _ep.json()
          console.log('[fb] eliteprotech: success=', _epd.success, 'has video=', !!_epd.video)
          const _fbEpUrl = _epd.video || _epd.result?.hd || _epd.result?.sd || _epd.result?.url
          if (_epd.success && _fbEpUrl) {
            _fbUrl      = _fbEpUrl
            _fbTitle    = _epd.title    || _epd.result?.title    || null
            _fbDuration = _epd.duration || _epd.result?.duration || null
          }
        } catch (_e1) { console.log('[fb] eliteprotech:', _e1.message) }

        // Source 1b: EliteProTech /facebook1
          if (!_fbUrl) {
            try {
              let _ep1b = await fetch(`https://eliteprotech-apis.zone.id/facebook1?url=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
              let _ep1bd = await _ep1b.json()
              console.log('[fb] eliteprotech1:', _ep1bd.success, 'results=', _ep1bd.results?.length)
              if (_ep1bd.success && _ep1bd.results?.length) {
                const _fb1hd = _ep1bd.results.find(r => /hd|720|1080/i.test(r.quality)) || _ep1bd.results[0]
                if (_fb1hd?.url) {
                  _fbUrl      = _fb1hd.url
                  _fbTitle    = _ep1bd.title    || null
                  _fbDuration = _ep1bd.duration || null
                }
              }
            } catch (_e1b) { console.log('[fb] eliteprotech1:', _e1b.message) }
          }

          // Source 2: fdown library fallback
        if (!_fbUrl) {
          try {
            let res = await fdown.download(text)
            if (res?.length > 0) {
              _fbUrl      = res[0].hdQualityLink || res[0].normalQualityLink
              _fbTitle    = res[0].title       || null
              _fbDuration = res[0].duration    || null
            }
          } catch (_e2) { console.log('[fb] fdown:', _e2.message) }
        }

        // Source 3: GiftedTech fbdl
        if (!_fbUrl) {
          try {
            let _gt = await fetch(`https://api.giftedtech.co.ke/api/download/fbdl?apikey=${_giftedKey()}&url=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) })
            let _gtd = await _gt.json()
            console.log('[fb] giftedtech: success=', _gtd.success)
            if (_gtd.success && _gtd.result) {
              _fbUrl      = _gtd.result.video_hd || _gtd.result.video_sd || _gtd.result.download_url
              _fbTitle    = _gtd.result.title    || null
              _fbDuration = _gtd.result.duration || null
            }
          } catch (_e3) { console.log('[fb] giftedtech:', _e3.message) }
        }

        if (_fbUrl) {
          let _cap = `╔══〔 📹 FACEBOOK VIDEO 〕══╗\n`
          if (_fbTitle)    _cap += `║ 📌 *Title* : ${_fbTitle}\n`
          if (_fbDuration) _cap += `║ ⏱️ *Duration* : ${_fbDuration}\n`
          _cap += `╚═══════════════════════╝`
          await safeSendMedia(m.chat, { video: { url: _fbUrl }, caption: _cap, mimetype: 'video/mp4' }, {}, { quoted: m })
        } else {
          reply('❌ Could not download that Facebook video. Make sure the video is public and the link is correct.')
        }
      } catch (e) {
        console.log('[fb] error:', e.message)
        reply('❌ An error occurred while downloading. Please try again.')
      }
  }
break

  case 'vocalremove':
  case 'removevocal':
  case 'instrumental': {
      await X.sendMessage(m.chat, { react: { text: '🎙️', key: m.key } })
      try {
          let _vrUrl = text?.match(/^https?:\/\//i) ? text.trim() : null
          if (!_vrUrl && m.quoted) {
              let _mtype = m.quoted.mimetype || ''
              if (!/audio|video/.test(_mtype)) return reply('❌ Reply to an audio/video message with *.vocalremove*, or provide an audio URL.')
              await reply('⏳ _Uploading audio for processing..._')
              let _buf = await m.quoted.download()
              if (!_buf || _buf.length < 1000) return reply('❌ Could not download the audio. Try again.')
              const _FormData = (await import('form-data')).default
              const _fd = new _FormData()
              _fd.append('reqtype', 'fileupload')
              _fd.append('fileToUpload', _buf, { filename: 'audio.mp3', contentType: _mtype || 'audio/mpeg' })
              let _cbRes = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: _fd, headers: _fd.getHeaders(), signal: AbortSignal.timeout(30000) })
              _vrUrl = (await _cbRes.text()).trim()
              if (!_vrUrl.startsWith('http')) return reply('❌ Failed to upload audio. Try again.')
              console.log('[vocalremove] catbox url:', _vrUrl)
          }
          if (!_vrUrl) return reply('❌ Reply to an audio message or provide an audio URL.\nExample: *.vocalremove https://example.com/song.mp3*')
          await reply('🎙️ _Removing vocals, please wait..._')
          let _vrRes = await fetch(`https://eliteprotech-apis.zone.id/vocalremove?url=${encodeURIComponent(_vrUrl)}`, { signal: AbortSignal.timeout(60000) })
          let _vrd = await _vrRes.json()
          console.log('[vocalremove] result:', JSON.stringify(_vrd).slice(0, 200))
          if (_vrd.success !== false && (_vrd.instrumental || _vrd.result || _vrd.url || _vrd.download)) {
              let _instrUrl = _vrd.instrumental || _vrd.result || _vrd.url || _vrd.download
              await X.sendMessage(m.chat, { audio: { url: _instrUrl }, mimetype: 'audio/mpeg', fileName: 'instrumental.mp3' }, { quoted: m })
              await reply('╔══〔 🎵 VOCAL REMOVER 〕══╗\n\n║ ✅ Vocals removed!\n║ Instrumental track sent above.\n╚═══════════════════════╝')
          } else {
              reply('❌ Could not process this audio. Make sure it is a valid, accessible audio URL.\n_Details: ' + (JSON.stringify(_vrd).slice(0, 120)) + '_')
          }
      } catch(e) { reply('❌ Vocal removal failed: ' + e.message) }
  } break
  
case 'play':
case 'song':
case 'music':
case 'ytplay': {
    await X.sendMessage(m.chat, { react: { text: '🎵', key: m.key } })
    if (!text) return reply(`╔══〔 🎵 YTPLAY 〕═════════╗\n\n║ Usage: *${prefix}ytplay [song name]*\n║ Example: ${prefix}ytplay Juice WRLD Lucid Dreams\n╚═══════════════════════╝`)
    let _tmpFile = null
    try {
        let search = await yts(text)
        if (!search || !search.all || !search.all.length) return reply('❌ No results found for that song. Try different keywords.')
        let firstVideo = search.all.find(v => v.type === 'video') || search.all[0]
        let videoTitle  = firstVideo.title || 'Unknown Title'
        let videoAuthor = firstVideo.author?.name || firstVideo.author || 'Unknown Artist'
        let cleanName   = `${videoAuthor} - ${videoTitle}.mp3`.replace(/[<>:"/\\|?*]/g, '')

        // audioUrl  = remote HTTPS URL  (no RAM usage — baileys streams it)
        // audioPath = local file path   (no readFileSync — baileys reads via file:// URL)
        let audioUrl = null, audioPath = null

        // Extract video ID helper
        const _getVideoId = (url) => {
            let m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/)
            return m ? m[1] : null
        }

        // Method 1: GiftedTech API — 128kbps, direct download URL
        if (!audioUrl && !audioPath) {
            try {
                let res = await fetch(`https://api.giftedtech.co.ke/api/download/ytmp3?apikey=${_giftedKey()}&quality=128kbps&url=${encodeURIComponent(firstVideo.url)}`, {
                    signal: AbortSignal.timeout(30000)
                })
                let data = await res.json()
                console.log('[play] giftedtech: success=', data.success, 'quality=', data.result?.quality)
                if (data.success && data.result?.download_url) {
                    audioUrl = data.result.download_url
                }
            } catch (e0) { console.log('[play] giftedtech:', e0.message) }

          // Method 1.5: EliteProTech API — fast single-call MP3 URL
          if (!audioUrl && !audioPath) {
              try {
                  let _ep = await fetch(`https://eliteprotech-apis.zone.id/ytmp3?url=${encodeURIComponent(firstVideo.url)}`, { signal: AbortSignal.timeout(20000) })
                  let _epd = await _ep.json()
                  console.log('[play] eliteprotech: status=', _epd.status)
                  if (_epd.status === true && _epd.result?.download) {
                      audioUrl = _epd.result.download
                      if (!videoTitle || videoTitle === 'Unknown Title') videoTitle = _epd.result.title || videoTitle
                  }
              } catch (_ep0) { console.log('[play] eliteprotech:', _ep0.message) }
          }

          // Method 1.7: Keith API ytmp3 backup
          if (!audioUrl && !audioPath) {
              try {
                  let _kp = await fetch(`https://apiskeith.top/download/ytmp3?url=${encodeURIComponent(firstVideo.url)}`, { signal: AbortSignal.timeout(25000) })
                  let _kpd = await _kp.json()
                  console.log('[play] keith: status=', _kpd.status)
                  if (_kpd.status && _kpd.result?.download_url) {
                      audioUrl = _kpd.result.download_url
                  } else if (_kpd.status && _kpd.result?.url) {
                      audioUrl = _kpd.result.url
                  }
              } catch (_kp0) { console.log('[play] keith:', _kp0.message) }
          }
  
        }

        // Method 2: YouTube InnerTube API — try iOS then TV client (Android gets blocked)
        if (!audioUrl && !audioPath) {
            const _innerTube = async (clientName, clientVersion, extra = {}) => {
                try {
                    let videoId = _getVideoId(firstVideo.url)
                    if (!videoId) return null
                    let itRes = await fetch('https://www.youtube.com/youtubei/v1/player', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-YouTube-Client-Name': '5', 'X-YouTube-Client-Version': clientVersion },
                        body: JSON.stringify({ videoId, context: { client: { clientName, clientVersion, hl: 'en', gl: 'US', ...extra } } }),
                        signal: AbortSignal.timeout(20000)
                    })
                    let itData = await itRes.json()
                    let fmts = [...(itData.streamingData?.adaptiveFormats || []), ...(itData.streamingData?.formats || [])]
                    let audioFmts = fmts.filter(f => f.mimeType?.startsWith('audio/') && f.url)
                    audioFmts.sort((a, b) => Math.abs((a.bitrate || 0) - 128000) - Math.abs((b.bitrate || 0) - 128000))
                    if (audioFmts[0]?.url) return { url: audioFmts[0].url, bitrate: audioFmts[0].bitrate }
                    console.log(`[play] innertube(${clientName}): status=`, itData.playabilityStatus?.status || 'no streamingData')
                } catch (e) { console.log(`[play] innertube(${clientName}):`, e.message) }
                return null
            }
            // ANDROID_TESTSUITE bypasses most auth/music restrictions
            let it = await _innerTube('ANDROID_TESTSUITE', '1.9', { androidSdkVersion: 30 })
                   || await _innerTube('IOS', '19.29.1', { deviceModel: 'iPhone16,2' })
                   || await _innerTube('TVHTML5', '7.20220325')
            if (it) { audioUrl = it.url; console.log('[play] innertube: success bitrate=', it.bitrate) }
        }

        // Method 2: loader.to — mp3 (moved up, confirmed working)
        if (!audioUrl && !audioPath) {
            try {
                let _ltRes = await fetch(`https://loader.to/ajax/download.php?format=mp3&url=${encodeURIComponent(firstVideo.url)}`, { signal: AbortSignal.timeout(12000) })
                let _ltData = await _ltRes.json()
                console.log('[play] loader.to init:', _ltData.success, _ltData.id)
                if (_ltData.success && _ltData.id) {
                    for (let _i = 0; _i < 25; _i++) {
                        await new Promise(r => setTimeout(r, 3000))
                        let _prog = await (await fetch(`https://loader.to/ajax/progress.php?id=${_ltData.id}`)).json()
                        if (_prog.success === 1 && _prog.progress >= 1000 && _prog.download_url) {
                            audioUrl = _prog.download_url
                            console.log('[play] loader.to: success')
                            break
  
                        }
                        if (_prog.progress < 0) { console.log('[play] loader.to: failed'); break }
                    }
                }
            } catch (_e2) { console.log('[play] loader.to-early:', _e2.message) }
        }

        // Method 3: Invidious — multiple instances, actual call (fixed dead code)
        if (!audioUrl && !audioPath) {
            const _invidious = async (instance) => {
                try {
                    let videoId = _getVideoId(firstVideo.url)
                    if (!videoId) return null
                    let res = await fetch(`${instance}/api/v1/videos/${videoId}?fields=adaptiveFormats,formatStreams`, { signal: AbortSignal.timeout(12000) })
                    let data = await res.json()
                    let fmts = [...(data.adaptiveFormats || []), ...(data.formatStreams || [])]
                    let audioFmts = fmts.filter(f => (f.type || f.mimeType || '').startsWith('audio/') && f.url)
                    audioFmts.sort((a, b) => Math.abs((a.bitrate || 0) - 128000) - Math.abs((b.bitrate || 0) - 128000))
                    if (audioFmts[0]?.url) return audioFmts[0].url
                } catch (e) { console.log('[play] invidious(' + instance + '):', e.message) }
                return null
            }
            const _invInstances = await getInvPool()
            for (const _inst of _invInstances) {
                audioUrl = await _invidious(_inst)
                if (audioUrl) { console.log('[play] invidious: success', _inst); break }
            }
        }

        // Method 5: ytdl-core with agent
        if (!audioUrl && !audioPath) {
            try {
                const ytdl = require('@distube/ytdl-core')
                const agent = ytdl.createAgent()
                let info = await ytdl.getInfo(firstVideo.url, { agent })
                let audioFormats = info.formats.filter(f => f.hasAudio && !f.hasVideo)
                audioFormats.sort((a, b) => (a.audioBitrate || 0) - (b.audioBitrate || 0))
                let format = audioFormats.find(f => (f.audioBitrate || 0) >= 96) || audioFormats[audioFormats.length - 1]
                if (!format) format = ytdl.chooseFormat(info.formats, { filter: f => f.hasAudio })
                if (format) {
                    let tmpDir = path.join(__dirname, 'tmp')
                    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
                    let tmpBase = path.join(tmpDir, `play_${Date.now()}`)
                    _tmpFile = tmpBase + '.mp3'
                    await new Promise((resolve, reject) => {
                        let writeStream = fs.createWriteStream(_tmpFile)
                        let ytStream = ytdl(firstVideo.url, { format, agent })
                        ytStream.pipe(writeStream)
                        writeStream.on('finish', resolve)
                        writeStream.on('error', reject)
                        ytStream.on('error', reject)
                        setTimeout(() => { ytStream.destroy(); reject(new Error('timeout')) }, 300000)
                    })
                    if (fs.existsSync(_tmpFile) && fs.statSync(_tmpFile).size > 10000) {
                        // Re-encode raw stream to 128kbps CBR MP3 if ffmpeg is available
                        try {
                            const _rawPath = _tmpFile.replace('.mp3', '_raw.m4a')
                            fs.renameSync(_tmpFile, _rawPath)
                            await new Promise((res, rej) => exec(
                                `ffmpeg -y -i "${_rawPath}" -codec:a libmp3lame -b:a 128k -ar 44100 -ac 2 "${_tmpFile}"`,
                                { timeout: 120000 }, (err) => { try { fs.unlinkSync(_rawPath) } catch {}; err ? rej(err) : res() }
                            ))
                        } catch { /* ffmpeg unavailable — use raw download */ }
                        audioPath = _tmpFile
                        console.log('[play] ytdl-core: success')
                    }
                }
            } catch (e5) { console.log('[play] ytdl-core:', e5.message) }
        }

        // Method 6: yt-dlp — only if installed on the system (skips silently if not found)
        if (!audioUrl && !audioPath) {
            try {
                let tmpDir = path.join(__dirname, 'tmp')
                if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
                let tmpBase = path.join(tmpDir, `play_${Date.now()}`)
                _tmpFile = tmpBase + '.mp3'
                let ytdlpBin = null
                for (let bin of ['yt-dlp', 'youtube-dl', 'yt-dlp_linux']) {
                    try { require('child_process').execSync(`which ${bin} 2>/dev/null`); ytdlpBin = bin; break } catch {}
                }
                if (!ytdlpBin) throw new Error('no yt-dlp binary found')
                await new Promise((resolve, reject) => {
                    exec(
                        `${ytdlpBin} -x --audio-format mp3 --audio-quality 5 --postprocessor-args "ffmpeg:-b:a 128k -ar 44100 -ac 2" --no-playlist -o "${tmpBase}.%(ext)s" "${firstVideo.url}"`,
                        { timeout: 300000 },
                        (err) => err ? reject(err) : resolve()
                    )
                })
                if (!fs.existsSync(_tmpFile)) {
                    let base = path.basename(tmpBase)
                    let found = fs.readdirSync(tmpDir).find(f => f.startsWith(base))
                    if (found) { _tmpFile = path.join(tmpDir, found) }
                }
                if (fs.existsSync(_tmpFile) && fs.statSync(_tmpFile).size > 10000) {
                    audioPath = _tmpFile
                    console.log('[play] yt-dlp: success')
                }
            } catch (e4) { console.log('[play] yt-dlp:', e4.message) }
        }

        if (audioUrl || audioPath) {
            let thumbBuffer = null
            try { thumbBuffer = await getBuffer(firstVideo.thumbnail) } catch {}
            let songInfo = `╔══〔 🎵 NOW PLAYING 〕═══╗\n║ 📌 *Title* : ${videoTitle}\n║ 🎤 *Artist* : ${videoAuthor}\n║ ⏱️ *Duration* : ${firstVideo.timestamp}\n║ 👁️ *Views* : ${firstVideo.views?.toLocaleString?.() || firstVideo.views}\n╚═══════════════════════╝`
            let msgPayload = {
                document: audioUrl ? { url: audioUrl } : { url: `file://${audioPath}` },
                mimetype: 'audio/mpeg',
                fileName: cleanName,
                caption: songInfo
            }
            if (thumbBuffer) msgPayload.jpegThumbnail = thumbBuffer
            await X.sendMessage(m.chat, msgPayload, { quoted: m })
        } else {
            reply(`╔══〔 🎵 SONG SEARCH 〕═══╗\n║ 📌 *Title* : ${videoTitle}\n║ 🎤 *Artist* : ${videoAuthor}\n║ ⏱️ *Duration* : ${firstVideo.timestamp}\n║\n║ ⚠️ Audio download failed — try again\n╚═══════════════════════╝`)
        }
    } catch (e) {
        console.log('[play] error:', e.message)
        reply('╔══〔 ❌ PLAY ERROR 〕══╗\n\n║ An error occurred while processing.\n║ Please try again.\n╚═══════════════════════╝')
    } finally {
        // Always clean up tmp file
        if (_tmpFile && fs.existsSync(_tmpFile)) { try { fs.unlinkSync(_tmpFile) } catch {} }
    }
}
break;
//━━━━━━━━━━━━━━━━━━━━━━━━//
// Lyrics Command — multi-source with fallback chain
case 'lyrics':
case 'lyric':
case 'songlyrics': {
    await X.sendMessage(m.chat, { react: { text: '🎵', key: m.key } })
    if (!text) return reply(`╔══〔 🎵 LYRICS SEARCH 〕═══╗
║ *Usage:* ${prefix}lyrics [song] - [artist]
╠══〔 💡 EXAMPLES 〕═══════╣
║ ${prefix}lyrics Lucid Dreams Juice WRLD
║ ${prefix}lyrics Blinding Lights - The Weeknd
║ ${prefix}lyrics HUMBLE Kendrick Lamar
╚═══════════════════════╝`)

    await X.sendMessage(m.chat, { react: { text: '🎵', key: m.key } })

    // Parse "song - artist" or "song artist" from input
    let _lyrQuery = text.trim()
    let _lyrSong = _lyrQuery
    let _lyrArtist = ''
    const _dashSplit = _lyrQuery.split(/\s*-\s*/)
    if (_dashSplit.length >= 2) {
        _lyrSong = _dashSplit[0].trim()
        _lyrArtist = _dashSplit.slice(1).join(' ').trim()
    }

    let _lyrResult = null
    let _lyrSource = ''

    // ── Source 0: GiftedTech lyrics API ─────────────────────────────
    try {
        let _gt = await fetch(`https://api.giftedtech.co.ke/api/search/lyrics?apikey=${_giftedKey()}&query=${encodeURIComponent(_lyrQuery)}`, { signal: AbortSignal.timeout(15000) })
        let _gtd = await _gt.json()
        if (_gtd.success && _gtd.result?.lyrics) {
            _lyrResult = { lyrics: _gtd.result.lyrics, title: _gtd.result.title || _lyrSong, artist: _gtd.result.artist || _lyrArtist, image: _gtd.result.image }
            _lyrSource = 'Juice v12'
        }
    } catch {}

    // ── Source 1: lyrics.ovh (free, no key) ─────────────────────────
    if (!_lyrResult && _lyrArtist) {
        try {
            const _r1 = await axios.get(
                `https://api.lyrics.ovh/v1/${encodeURIComponent(_lyrArtist)}/${encodeURIComponent(_lyrSong)}`,
                { timeout: 10000 }
            )
            if (_r1.data?.lyrics?.trim().length > 10) {
                _lyrResult = { lyrics: _r1.data.lyrics.trim(), title: _lyrSong, artist: _lyrArtist }
                _lyrSource = 'lyrics.ovh'
            }
        } catch {}
    }

    // ── Source 2: Lyrics.ovh search (no artist needed) ───────────────
    if (!_lyrResult) {
        try {
            const _r2 = await axios.get(
                `https://api.lyrics.ovh/suggest/${encodeURIComponent(_lyrQuery)}`,
                { timeout: 10000 }
            )
            const _hit = _r2.data?.data?.[0]
            if (_hit) {
                const _r2b = await axios.get(
                    `https://api.lyrics.ovh/v1/${encodeURIComponent(_hit.artist?.name || '')}/${encodeURIComponent(_hit.title || '')}`,
                    { timeout: 10000 }
                )
                if (_r2b.data?.lyrics?.trim().length > 10) {
                    _lyrResult = {
                        lyrics: _r2b.data.lyrics.trim(),
                        title: _hit.title || _lyrSong,
                        artist: _hit.artist?.name || _lyrArtist,
                        album: _hit.album?.title || '',
                        thumbnail: _hit.album?.cover_medium || ''
                    }
                    _lyrSource = 'lyrics.ovh'
                }
            }
        } catch {}
    }

    // ── Source 3: Musixmatch unofficial ──────────────────────────────
    if (!_lyrResult) {
        try {
            const _mmSearch = await axios.get(
                `https://api.musixmatch.com/ws/1.1/track.search?q_track_artist=${encodeURIComponent(_lyrQuery)}&page_size=1&page=1&s_track_rating=desc&apikey=0e9ce71d2f2c9251f74a9bfcd7e3aead`,
                { timeout: 10000 }
            )
            const _mmTrack = _mmSearch.data?.message?.body?.track_list?.[0]?.track
            if (_mmTrack) {
                const _mmLyr = await axios.get(
                    `https://api.musixmatch.com/ws/1.1/track.lyrics.get?track_id=${_mmTrack.track_id}&apikey=0e9ce71d2f2c9251f74a9bfcd7e3aead`,
                    { timeout: 10000 }
                )
                const _mmText = _mmLyr.data?.message?.body?.lyrics?.lyrics_body?.trim()
                if (_mmText && _mmText.length > 10 && !_mmText.includes('******* This Lyrics')) {
                    _lyrResult = {
                        lyrics: _mmText,
                        title: _mmTrack.track_name || _lyrSong,
                        artist: _mmTrack.artist_name || _lyrArtist
                    }
                    _lyrSource = 'Musixmatch'
                }
            }
        } catch {}
    }

    // ── Source 4: lrclib.net (has synced + plain lyrics, no key) ─────
    if (!_lyrResult) {
        try {
            const _lcQ = encodeURIComponent(_lyrQuery)
            const _lcRes = await axios.get(
                `https://lrclib.net/api/search?q=${_lcQ}`,
                { timeout: 10000 }
            )
            const _lcHit = _lcRes.data?.[0]
            if (_lcHit && (_lcHit.plainLyrics || _lcHit.syncedLyrics)) {
                // Prefer plain lyrics; strip timestamps from synced if needed
                let _lcText = _lcHit.plainLyrics || ''
                if (!_lcText && _lcHit.syncedLyrics) {
                    _lcText = _lcHit.syncedLyrics
                        .split('\n')
                        .map(l => l.replace(/^\[\d+:\d+\.\d+\]\s*/, '').trim())
                        .filter(Boolean)
                        .join('\n')
                }
                if (_lcText.trim().length > 10) {
                    _lyrResult = {
                        lyrics: _lcText.trim(),
                        title: _lcHit.trackName || _lyrSong,
                        artist: _lcHit.artistName || _lyrArtist,
                        album: _lcHit.albumName || ''
                    }
                    _lyrSource = 'lrclib.net'
                }
            }
        } catch {}
    }

    // ── Source 5: Genius search via unofficial scrape helper ─────────
    if (!_lyrResult) {
        try {
            const _gSearch = await axios.get(
                `https://genius.com/api/search/multi?per_page=1&q=${encodeURIComponent(_lyrQuery)}`,
                {
                    timeout: 10000,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                }
            )
            const _gHits = _gSearch.data?.response?.sections?.find(s => s.type === 'song')?.hits
            const _gHit = _gHits?.[0]?.result
            if (_gHit) {
                // Scrape the Genius page for plain lyrics
                const _gPage = await axios.get(_gHit.url, {
                    timeout: 12000,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                })
                const _gHtml = _gPage.data || ''
                // Extract lyrics from data-lyrics-container divs
                const _lyricChunks = []
                const _containerRe = /data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi
                let _cm
                while ((_cm = _containerRe.exec(_gHtml)) !== null) {
                    let _chunk = _cm[1]
                        .replace(/<br\s*\/?>/gi, '\n')
                        .replace(/<[^>]+>/g, '')
                        .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
                        .replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                        .replace(/&nbsp;/g, ' ')
                    _lyricChunks.push(_chunk.trim())
                }
                const _gLyrics = _lyricChunks.join('\n\n').trim()
                if (_gLyrics.length > 20) {
                    _lyrResult = {
                        lyrics: _gLyrics,
                        title: _gHit.title || _lyrSong,
                        artist: _gHit.primary_artist?.name || _lyrArtist,
                        thumbnail: _gHit.song_art_image_thumbnail_url || ''
                    }
                    _lyrSource = 'Genius'
                }
            }
        } catch {}
    }

    // ── Source 6: AI fallback — generate from knowledge ──────────────
    if (!_lyrResult) {
        try {
            const _aiLyr = await _runChatBoAI(
                `Please provide the full song lyrics for "${_lyrQuery}". Format: first line = "Title: [title]", second line = "Artist: [artist]", then a blank line, then the complete lyrics. If you don't know the exact lyrics, say UNKNOWN.`,
                false
            )
            if (_aiLyr && !_aiLyr.includes('UNKNOWN') && _aiLyr.length > 50) {
                const _aiLines = _aiLyr.split('\n')
                const _aiTitle = (_aiLines.find(l => /^title:/i.test(l)) || '').replace(/^title:\s*/i, '').trim() || _lyrSong
                const _aiArtist = (_aiLines.find(l => /^artist:/i.test(l)) || '').replace(/^artist:\s*/i, '').trim() || _lyrArtist
                const _aiText = _aiLines.filter(l => !/^(title|artist):/i.test(l)).join('\n').trim()
                if (_aiText.length > 20) {
                    _lyrResult = { lyrics: _aiText, title: _aiTitle, artist: _aiArtist }
                    _lyrSource = 'AI'
                }
            }
        } catch {}
    }

    // ── No result found ───────────────────────────────────────────────
    if (!_lyrResult) {
        return reply(
`❌ *Lyrics Not Found*

Could not find lyrics for: *${_lyrQuery}*

Tips:
• Try: ${prefix}lyrics [song name] - [artist name]
• Check spelling
• Use English title if available`)
    }

    // ── Format & send lyrics ──────────────────────────────────────────
    const _cleanLyrics = _lyrResult.lyrics
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

    // Split into chunks if lyrics are too long (WA message limit ~65KB)
    const _MAX_CHUNK = 3500
    const _lyrHeader =
`╔══〔 🎵 SONG LYRICS 〕═══╗

║ 🎤 *Title* : ${_lyrResult.title}
║ 👤 *Artist* : ${_lyrResult.artist}${_lyrResult.album ?`\n║ 💿 *Album* : ${_lyrResult.album}` : ''}
║ 📡 *Source* : ${_lyrSource}




╚═══════════════════════╝`

    if (_cleanLyrics.length <= _MAX_CHUNK) {
        const _fullMsg = _lyrHeader + _cleanLyrics + '\n\n_─────────────────────────_\n_🤖 Juice v12_'
        // Send with thumbnail if available
        if (_lyrResult.thumbnail) {
            try {
                const _thumb = await getBuffer(_lyrResult.thumbnail)
                await X.sendMessage(m.chat, { image: _thumb, caption: _fullMsg }, { quoted: m })
            } catch {
                reply(_fullMsg)
            }
        } else {
            reply(_fullMsg)
        }
    } else {
        // Send in multiple parts for long lyrics
        const _parts = []
        let _remaining = _cleanLyrics
        while (_remaining.length > 0) {
            // Try to break at a newline near the limit
            let _cutAt = _MAX_CHUNK
            if (_remaining.length > _MAX_CHUNK) {
                const _breakAt = _remaining.lastIndexOf('\n', _MAX_CHUNK)
                _cutAt = _breakAt > 500 ? _breakAt : _MAX_CHUNK
            }
            _parts.push(_remaining.slice(0, _cutAt).trim())
            _remaining = _remaining.slice(_cutAt).trim()
        }

        // Part 1 — with header and thumbnail
        const _part1 = _lyrHeader + _parts[0]
        if (_lyrResult.thumbnail) {
            try {
                const _thumb = await getBuffer(_lyrResult.thumbnail)
                await X.sendMessage(m.chat, { image: _thumb, caption: _part1 }, { quoted: m })
            } catch {
                await X.sendMessage(m.chat, { text: _part1 }, { quoted: m })
            }
        } else {
            await X.sendMessage(m.chat, { text: _part1 }, { quoted: m })
        }

        // Remaining parts
        for (let _pi = 1; _pi < _parts.length; _pi++) {
            const _isLast = _pi === _parts.length - 1
            await X.sendMessage(m.chat, {
                text: `🎵 *[Part ${_pi + 1}/${_parts.length}]*\n\n${_parts[_pi]}${_isLast ? '\n\n_─────────────────────────_\n_🤖 Juice v12_' : ''}`
            }, { quoted: m })
            await new Promise(r => setTimeout(r, 500))
        }
    }
} break
case 'owner':
case 'creator': {
    await X.sendMessage(m.chat, { react: { text: '👑', key: m.key } })
    await reply(`╔══〔 ⚡ Juice v12 〕══╗

║ 🧑‍💻 *Name* : ${global.ownername || 'Juice v12'}
║ ✈️  *Telegram* : @juicev12
║ 🤖 *Bot* : ${global.botname} v${global.botver}
║ 🔑 *Session* : ${global.sessionUrl}

  📞 *Contact Numbers:*
║ +254753204154
║ +254746677793
║ +254788781373


║ _👇 Tap a contact card below to reach the owner_
╚═══════════════════════╝`)
    const namaown = global.ownername || 'Juice v12'
    const ownerNumbers = ['254753204154', '254746677793', '254788781373']
    const contacts = generateWAMessageFromContent(m.chat, proto.Message.fromObject({
        contactsArrayMessage: {
            displayName: namaown,
            contacts: ownerNumbers.map(num => ({
                displayName: namaown,
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;;;;\nFN:${namaown}\nitem1.TEL;waid=${num}:+${num}\nitem1.X-ABLabel:WhatsApp\nX-WA-BIZ-NAME:${namaown}\nEND:VCARD`
            }))
        }
    }), { userJid: m.chat, quoted: m })
    await X.relayMessage(m.chat, contacts.message, { messageId: contacts.key.id })
}
break

case 'infobot':
case 'botinfo': {
    await X.sendMessage(m.chat, { react: { text: '🤖', key: m.key } })
  const botInfo = `╔══〔 ⚡ Juice v12 〕══╗

║ 📛 *Name* : ${botname}
║ 👑 *Owner* : ${ownername}
║ 🏷️  *Version* : v${botver}
║ 📋 *Commands* : ${totalfitur()}
║ ⏱️  *Uptime* : ${runtime(process.uptime())}
║ 🔒 *Mode* : ${X.public ? 'Public' : 'Private'}
║ 🔤 *Prefix* : ${global.botPrefix || 'Multi-prefix'}
║ 📞 *Contact* : ${global.ownerNumber}
║ ✈️  *Telegram* : @juicev12
║ 🔑 *Session* : ${global.sessionUrl}


║ _⚡ Powered by Juice v12 — wa.me/254753204154_
╚═══════════════════════╝`
  reply(botInfo)
}
break
//━━━━━━━━━━━━━━━━━━━━━━━━//
// Sticker Features
case 'bratvid':
case 'bratv':
case 'bratvideo': {
    await X.sendMessage(m.chat, { react: { text: '✏️', key: m.key } })
  if (!text) return reply(`╔══〔 🎬 BRAT VIDEO 〕══╗\n\n║ Usage: *${prefix}${command} [pesan]*\n║ Contoh: ${prefix}${command} Hai bang, apa kabar?\n╚═══════════════════════╝`)
  if (text.length > 250) return reply(`╔══〔 ⚠️ BRAT VIDEO 〕══╗\n\n║ Character limit exceeded!\n║ Maximum: 250 characters\n╚═══════════════════════╝`)
  const words = text.split(" ")
  const tempDir = path.join(process.cwd(), 'tmp')
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir)
  const framePaths = []

  try {
    for (let i = 0; i < words.length; i++) {
      const currentText = words.slice(0, i + 1).join(" ")

      const res = await axios.get(
        `https://aqul-brat.hf.space/api/brat?text=${encodeURIComponent(currentText)}`,
        { responseType: "arraybuffer", timeout: 20000 }
      ).catch((e) => e.response)

      const framePath = path.join(tempDir, `frame${i}.mp4`)
      fs.writeFileSync(framePath, res.data)
      framePaths.push(framePath)
    }

    const fileListPath = path.join(tempDir, "filelist.txt")
    let fileListContent = ""

    for (let i = 0; i < framePaths.length; i++) {
      fileListContent += `file '${framePaths[i]}'\n`
      fileListContent += `duration 0.7\n`
    }

    fileListContent += `file '${framePaths[framePaths.length - 1]}'\n`
    fileListContent += `duration 2\n`

    fs.writeFileSync(fileListPath, fileListContent)
    const outputVideoPath = path.join(tempDir, "output.mp4")
    execSync(
      `ffmpeg -y -f concat -safe 0 -i ${fileListPath} -vf "fps=30" -c:v libx264 -preset ultrafast -pix_fmt yuv420p ${outputVideoPath}`
    )

    await X.sendImageAsStickerAV(m.chat, outputVideoPath, m, {
      packname: '',
      author: `${global.author}`
    })

    framePaths.forEach((frame) => {
      if (fs.existsSync(frame)) fs.unlinkSync(frame)
    })
    if (fs.existsSync(fileListPath)) fs.unlinkSync(fileListPath)
    if (fs.existsSync(outputVideoPath)) fs.unlinkSync(outputVideoPath)
  } catch (err) {
    console.error(err)
    reply('╔══〔 ❌ ERROR 〕══╗\n\n║ An error occurred. Please try again.\n╚═══════════════════════╝')
  }
}
break

case 'brat': {
    await X.sendMessage(m.chat, { react: { text: '✏️', key: m.key } })
if (!q) return reply(`╔══〔 ✏️ BRAT TEXT 〕══════╗\n\n║ Usage: *${prefix}brat [text]*\n║ Example: ${prefix}brat alok hamil\n╚═══════════════════════╝`);
let _bratBuf = null
try {
  const _r1 = await axios.get(`https://aqul-brat.hf.space/api/brat?text=${encodeURIComponent(q)}`, { responseType: 'arraybuffer', timeout: 15000 })
  _bratBuf = Buffer.from(_r1.data, 'binary')
} catch {}
if (!_bratBuf || _bratBuf.length < 1000) {
  try {
    const _r2 = await axios.get(`https://brat.space/api/brat?text=${encodeURIComponent(q)}`, { responseType: 'arraybuffer', timeout: 15000 })
    _bratBuf = Buffer.from(_r2.data, 'binary')
  } catch {}
}
try {
  if (!_bratBuf || _bratBuf.length < 1000) throw new Error('Both brat APIs failed')
  await X.sendImageAsStickerAV(m.chat, _bratBuf, m, { packname: ``, author: `${global.author}` })
} catch (e) {
  console.log(e)
  await reply('❌ Brat sticker generation failed. Please try again.')
}
}
break

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ✏️  ANIMATED TEXT TO STICKER (ATTP / TTP)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  case 'attp':
  case 'ttp':
  case 'totext':
  case 'textsticker': {
      await X.sendMessage(m.chat, { react: { text: '✏️', key: m.key } })
      const _atText = text || (m.quoted ? (m.quoted.text || m.quoted.body || '') : '')
      if (!_atText) return reply(`╔══〔 ✏️ TEXT STICKER 〕══╗\n\n║ *Usage:* *${prefix}attp [text]*\n║ *Example:* ${prefix}attp Hello World\n║\n║ Creates an animated text sticker\n╚═══════════════════════╝`)
      try {
          let _atBuf = null
          // Method 1: GiftedTech ATTP API
          try {
              const _gt = await fetch(`https://api.giftedtech.co.ke/api/sticker/attp?apikey=${_giftedKey()}&text=${encodeURIComponent(_atText)}`, { signal: AbortSignal.timeout(25000) })
              if (_gt.ok) {
                  const _ct = _gt.headers.get('content-type') || ''
                  if (_ct.includes('image') || _ct.includes('octet')) {
                      _atBuf = Buffer.from(await _gt.arrayBuffer())
                  } else {
                      const _gtd = await _gt.json().catch(() => null)
                      if (_gtd?.result) {
                          const _img = await fetch(_gtd.result, { signal: AbortSignal.timeout(15000) })
                          if (_img.ok) _atBuf = Buffer.from(await _img.arrayBuffer())
                      }
                  }
              }
          } catch {}
          // Method 2: Keith API TTP
          if (!_atBuf) {
              try {
                  const _kth = await _keithFetch(`/ttp?text=${encodeURIComponent(_atText)}`, 25000)
                  if (_kth?.url) {
                      const _kImg = await fetch(_kth.url, { signal: AbortSignal.timeout(15000) })
                      if (_kImg.ok) _atBuf = Buffer.from(await _kImg.arrayBuffer())
                  } else if (_kth?.result) {
                      const _kImg2 = await fetch(_kth.result, { signal: AbortSignal.timeout(15000) })
                      if (_kImg2.ok) _atBuf = Buffer.from(await _kImg2.arrayBuffer())
                  }
              } catch {}
          }
          // Method 3: Pollinations text-to-image (renders styled text as image)
          if (!_atBuf) {
              try {
                  const _prompt = `Bold stylized neon text on black background: "${_atText.slice(0,50)}", high contrast, vibrant colors, art style`
                  const _pUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(_prompt)}?width=512&height=512&nologo=true`
                  const _pImg = await fetch(_pUrl, { signal: AbortSignal.timeout(30000) })
                  if (_pImg.ok) _atBuf = Buffer.from(await _pImg.arrayBuffer())
              } catch {}
          }
          if (!_atBuf || _atBuf.length < 1000) throw new Error('Text sticker generation failed. Please try again.')
          await X.sendImageAsStickerAV(m.chat, _atBuf, m, { packname: global.packname || 'XD Ultra', author: global.author || 'Bot' })
      } catch(e) { reply(`❌ *ATTP failed:* ${e.message}`) }
  } break
  

case 'emojimix': {
    await X.sendMessage(m.chat, { react: { text: '😎', key: m.key } })
    if (!text) return reply(`╔══〔 😎 EMOJI MIX 〕══╗\n\n║ Usage: *${prefix + command} [emoji1]+[emoji2]*\n║ Example: ${prefix + command} 😂+😍\n╚═══════════════════════╝`);

    const emojis = text.split(/[\+\|]/);
    if (emojis.length !== 2) return reply('╔══〔 ⚠️ EMOJI MIX 〕══╗\n\n║ Please enter two valid emojis.\n║ Example: .emojimix 😂+😍\n╚═══════════════════════╝');
    const text1 = emojis[0].trim();
    const text2 = emojis[1].trim();
 
    let api = `https://emojik.vercel.app/s/${encodeURIComponent(text1)}_${encodeURIComponent(text2)}?size=128`;
    await X.sendImageAsStickerAV(m.chat, api, m, { packname: '', author: `${packname}` });
}
break;
case 'qc': {
    await X.sendMessage(m.chat, { react: { text: '💬', key: m.key } })
    let text;

    if (args.length >= 1) {
        text = args.slice(0).join(" ");
    } else if (m.quoted && m.quoted.text) {
        text = m.quoted.text;
    } else {
        return reply(`╔══〔 💬 QUOTE CARD 〕═════╗\n\n║ Usage: *${prefix}qc [text]*\n║ Or reply to any message.\n╚═══════════════════════╝`);
    }
    if (!text) return reply(`╔══〔 💬 QUOTE CARD 〕═════╗\n\n║ Usage: *${prefix}qc [text]*\n╚═══════════════════════╝`);
    if (text.length > 200) return reply('❌ Maximum *200 characters* allowed. Your text: ' + text.length + ' chars.');
    let ppnyauser = await X.profilePictureUrl(m.sender, 'image').catch(_ => 'https://files.catbox.moe/nwvkbt.png');
    const rest = await quote(text, pushname, ppnyauser);
    X.sendImageAsStickerAV(m.chat, rest.result, m, {
        packname: ``,
        author: `${global.author}`
    });
}
break
case 'sticker':
case 'stiker':
case 's':{
    await X.sendMessage(m.chat, { react: { text: '🖼️', key: m.key } })
if (!quoted) return reply(`╔══〔 🖼️ STICKER MAKER 〕══╗\n\n║ Usage: *${prefix}s*\n║ Reply to any image or video.\n╚═══════════════════════╝`)
if (/image/.test(mime)) {
let media = await quoted.download()
let encmedia = await X.sendImageAsStickerAV(m.chat, media, m, {
packname: global.packname,
author: global.author
})
} else if (/video/.test(mime)) {
if ((quoted.msg || quoted).seconds > 31) return reply('╔══〔 ⚠️ STICKER 〕══╗\n\n║ Video must be 30 seconds or less!\n╚═══════════════════════╝')
let media = await quoted.download()
let encmedia = await X.sendVideoAsStickerAV(m.chat, media, m, {
packname: global.packname,
author: global.author
})
} else {
return reply(`Send an Image/Video with caption ${prefix + command}\nVideo duration: 1-9 seconds`)
}
}
break
//━━━━━━━━━━━━━━━━━━━━━━━━//
// Take / Steal Sticker
case 'take':
case 'steal': {
    await X.sendMessage(m.chat, { react: { text: '🎨', key: m.key } })
    if (!quoted) return reply(`╔══〔 🎨 TAKE STICKER 〕══╗\n\n║ Reply to a sticker with *${prefix + command}*\n║ Usage: *${prefix + command} [packname|author]*\n║ Example: ${prefix}take MyPack|MyName\n╚═══════════════════════╝`)
    if (mime !== 'image/webp') return reply(`╔══〔 ⚠️ TAKE STICKER 〕══╗\n\n║ Please reply to a *sticker* to use\n║ *${prefix + command}*\n╚═══════════════════════╝`)

    let _tkPack = global.packname || 'XD Ultra'
    let _tkAuth = global.author || 'Bot'

    if (text) {
        const _split = text.split('|')
        if (_split.length >= 2) {
            _tkPack = _split[0].trim()
            _tkAuth = _split[1].trim()
        } else {
            _tkPack = text.trim()
        }
    }

    try {
        const _tkMedia = await quoted.download()

        // Detect animated WebP by ANIM chunk presence (bytes 12-16)
        const _isAnimated = _tkMedia && _tkMedia.length > 16 && _tkMedia.toString('ascii', 12, 16) === 'ANIM'

        if (_isAnimated) {
            // Animated sticker — route through video pipeline
            await X.sendVideoAsStickerAV(m.chat, _tkMedia, m, {
                packname: _tkPack,
                author: _tkAuth
            })
        } else {
            // Static WebP sticker — inject EXIF metadata directly, skip ffmpeg entirely
            const _webp    = require('node-webpmux')
            const _Crypto  = require('crypto')
            const _os      = require('os')
            const _fs      = require('fs')
            const _path    = require('path')

            const _tmpIn  = _path.join(_os.tmpdir(), `tk_${_Crypto.randomBytes(4).toString('hex')}.webp`)
            const _tmpOut = _path.join(_os.tmpdir(), `tk_${_Crypto.randomBytes(4).toString('hex')}.webp`)
            _fs.writeFileSync(_tmpIn, _tkMedia)

            const _img = new _webp.Image()
            const _json = {
                'sticker-pack-id': 'TOOSII-XD-ULTRA',
                'sticker-pack-name': _tkPack,
                'sticker-pack-publisher': _tkAuth,
                'emojis': ['']
            }
            const _exifAttr = Buffer.from([0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,0x01,0x00,0x41,0x57,0x07,0x00,0x00,0x00,0x00,0x00,0x16,0x00,0x00,0x00])
            const _jsonBuf  = Buffer.from(JSON.stringify(_json), 'utf-8')
            const _exif     = Buffer.concat([_exifAttr, _jsonBuf])
            _exif.writeUIntLE(_jsonBuf.length, 14, 4)
            await _img.load(_tmpIn)
            _img.exif = _exif
            await _img.save(_tmpOut)

            const _finalBuf = _fs.readFileSync(_tmpOut)
            try { _fs.unlinkSync(_tmpIn) } catch {}
            try { _fs.unlinkSync(_tmpOut) } catch {}

            await X.sendMessage(m.chat, { sticker: _finalBuf }, { quoted: m })
        }
    } catch (e) {
        console.error('Take sticker error:', e.message)
        reply('❌ Failed to steal sticker: ' + (e.message || 'Unknown error'))
    }
}
break
//━━━━━━━━━━━━━━━━━━━━━━━━//
// View Once Opener
case 'vv': {
    await X.sendMessage(m.chat, { react: { text: '👁️', key: m.key } })
if (!m.quoted) return reply(`╔══〔 👁️ VIEW ONCE REVEAL 〕╗\n\n║ Usage: *${prefix}vv*\n║ Reply to a view-once image/video.\n╚═══════════════════════╝`)
let quotedMsg = m.quoted
let quotedType = quotedMsg.mtype || ''
let viewOnceContent = null
if (quotedType === 'viewOnceMessage' || quotedType === 'viewOnceMessageV2' || quotedType === 'viewOnceMessageV2Extension') {
    let innerMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage
    if (innerMsg) {
        let voKey = innerMsg.viewOnceMessage || innerMsg.viewOnceMessageV2 || innerMsg.viewOnceMessageV2Extension
        if (voKey && voKey.message) {
            let innerType = Object.keys(voKey.message)[0]
            viewOnceContent = { type: innerType, msg: voKey.message[innerType] }
        }
    }
}
if (!viewOnceContent) {
    let rawQuoted = m.msg?.contextInfo?.quotedMessage
    if (rawQuoted) {
        for (let vk of ['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension']) {
            if (rawQuoted[vk] && rawQuoted[vk].message) {
                let innerType = Object.keys(rawQuoted[vk].message)[0]
                viewOnceContent = { type: innerType, msg: rawQuoted[vk].message[innerType] }
                break
            }
        }
    }
}
if (!viewOnceContent) {
    if (/image/.test(mime)) {
        viewOnceContent = { type: 'imageMessage', msg: quotedMsg.msg || quotedMsg }
    } else if (/video/.test(mime)) {
        viewOnceContent = { type: 'videoMessage', msg: quotedMsg.msg || quotedMsg }
    }
}
if (!viewOnceContent) return reply('╔══〔 ⚠️ VIEW ONCE 〕══╗\n\n║ Reply to a view-once image or video.\n╚═══════════════════════╝')
try {
    let stream = await downloadContentFromMessage(viewOnceContent.msg, viewOnceContent.type.replace('Message', ''))
    let buffer = Buffer.from([])
    for await (let chunk of stream) {
        buffer = Buffer.concat([buffer, chunk])
    }
    if (viewOnceContent.type === 'imageMessage') {
        await X.sendMessage(from, { image: buffer, caption: viewOnceContent.msg.caption || '' }, { quoted: m })
    } else if (viewOnceContent.type === 'videoMessage') {
        await X.sendMessage(from, { video: buffer, caption: viewOnceContent.msg.caption || '' }, { quoted: m })
    } else if (viewOnceContent.type === 'audioMessage') {
        await X.sendMessage(from, { audio: buffer, mimetype: 'audio/mp4' }, { quoted: m })
    } else {
        reply('╔══〔 ⚠️ VIEW ONCE 〕══╗\n\n║ Unsupported view once media type.\n╚═══════════════════════╝')
    }
} catch (err) {
    console.error('VV Error:', err)
    reply('╔══〔 ❌ VIEW ONCE 〕══╗\n\n║ Failed to open view once message.\n║ ' + (err.message || 'Unknown error').slice(0,100) + '\n╚═══════════════════════╝')
}
}
break

case 'autorecording':
case 'autorecord':
case 'fakerecording':
case 'fakerecord':
case 'frecord': {
    await X.sendMessage(m.chat, { react: { text: '🎙️', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
if (global.fakePresence === 'recording') {
    global.fakePresence = 'off'
    reply('╔══〔 🎙️ FAKE RECORDING 〕══╗\n\n║ ❌ *Status* : OFF\n╚═══════════════════════╝')
} else {
    global.fakePresence = 'recording'
    reply('╔══〔 🎙️ FAKE RECORDING 〕══╗\n\n║ ✅ *Status* : ON\n║ Bot now appears as recording.\n╚═══════════════════════╝')
}
}
break

case 'autotyping':
case 'faketyping':
case 'faketype':
case 'ftype': {
    await X.sendMessage(m.chat, { react: { text: '⌨️', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
if (global.fakePresence === 'typing') {
    global.fakePresence = 'off'
    reply('╔══〔 ⌨️ FAKE TYPING 〕════╗\n\n║ ❌ *Status* : OFF\n╚═══════════════════════╝')
} else {
    global.fakePresence = 'typing'
    reply('╔══〔 ⌨️ FAKE TYPING 〕════╗\n\n║ ✅ *Status* : ON\n║ Bot now appears as typing.\n╚═══════════════════════╝')
}
}
break

case 'autoonline':
case 'fakeonline':
case 'fonline': {
    await X.sendMessage(m.chat, { react: { text: '🟢', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
if (global.fakePresence === 'online') {
    global.fakePresence = 'off'
    reply('❌ *Auto Online OFF*')
} else {
    global.fakePresence = 'online'
    reply('✅ *Auto Online ON* — bot appears as online.')
}
}
break

case 'fakestatus':
case 'fpresence': {
    await X.sendMessage(m.chat, { react: { text: '👻', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let current = global.fakePresence || 'off'
reply(`╔══〔 👻 PRESENCE STATUS 〕══╗\n\n║ 📊 *Mode* : *${current}*\n\n║ ${prefix}autotyping    — toggle typing\n║ ${prefix}autorecording — toggle recording\n║ ${prefix}autoonline    — toggle online\n\n║ _Run again to turn off_\n╚═══════════════════════╝`)
}
break

case 'autoviewstatus':
case 'autoview':
case 'avs': {
    await X.sendMessage(m.chat, { react: { text: '👁️', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let avsArg = (args[0] || '').toLowerCase()
if (avsArg === 'on' || avsArg === 'enable') {
    global.autoViewStatus = true
    try { if (typeof _savePhoneState === 'function') _savePhoneState(X.user?.id?.split(':')[0]?.split('@')[0] || '') } catch {}
    reply('╔══〔 👀 AUTO VIEW STATUS 〕╗\n\n║ ✅ *Status* : ON\n║ Bot will auto-view all statuses.\n╚═══════════════════════╝')
} else if (avsArg === 'off' || avsArg === 'disable') {
    global.autoViewStatus = false
    try { if (typeof _savePhoneState === 'function') _savePhoneState(X.user?.id?.split(':')[0]?.split('@')[0] || '') } catch {}
    reply('╔══〔 👀 AUTO VIEW STATUS 〕╗\n\n║ ❌ *Status* : OFF\n║ Bot will no longer auto-view statuses.\n╚═══════════════════════╝')
} else {
    if (global.autoViewStatus) {
        global.autoViewStatus = false
        try { if (typeof _savePhoneState === 'function') _savePhoneState(X.user?.id?.split(':')[0]?.split('@')[0] || '') } catch {}
        reply('╔══〔 👀 AUTO VIEW STATUS 〕╗\n\n║ ❌ *Status* : OFF\n║ Bot will no longer auto-view statuses.\n╚═══════════════════════╝')
    } else {
        global.autoViewStatus = true
        try { if (typeof _savePhoneState === 'function') _savePhoneState(X.user?.id?.split(':')[0]?.split('@')[0] || '') } catch {}
        reply('*👀 Auto View Status: ✅ ON*\n\nBot will automatically view all contact statuses.')
    }
}
}
break

case 'autolikestatus':
case 'autolike':
case 'als':
case 'sr':
case 'reactstatus':
case 'statusreact': {
    await X.sendMessage(m.chat, { react: { text: '❤️', key: m.key } })
    if (!isOwner) return reply(mess.OnlyOwner)

    // Init global react manager state
    if (!global.arManager) global.arManager = {
        enabled: false,
        viewMode: 'view+react',   // 'view+react' | 'react-only'
        mode: 'fixed',            // 'fixed' | 'random'
        fixedEmoji: '❤️',
        reactions: ['❤️','🔥','👍','😂','😮','👏','🎉','🎯','💯','🌟','✨','⚡','💥','🫶','🐺'],
        totalReacted: 0,
        reactedIds: [],           // dedupe by status id
        lastReactionTime: 0,
        rateLimitDelay: 2000,
    }
    const _ar = global.arManager
    const _arAction = (args[0] || '').toLowerCase().trim()
    const _arVal = (args[1] || '').trim()

    // Helper: status line
    const _arStatus = () => {
        const _vm = _ar.viewMode === 'view+react' ? '👁️ + react' : 'react only'
        const _em = _ar.mode === 'fixed' ? _ar.fixedEmoji : '🎲 random'
        return `╔══〔 ❤️  AUTO REACT STATUS 〕══╗\n\n║ 📊 *Status* : ${_ar.enabled ? '✅ ON' : '❌ OFF'}\n║ 👁️  *View Mode* : ${_vm}\n║ 🎭 *Emoji* : ${_em}\n║ 📈 *Reacted* : ${_ar.totalReacted} statuses\n║ 🎨 *Pool* : ${_ar.reactions.join(' ')}\n\n║ *Commands:*\n║ ${prefix}als on / off\n║ ${prefix}als view+react / react-only\n║ ${prefix}als fixed / random\n║ ${prefix}als emoji [emoji]\n║ ${prefix}als add [emoji] / remove [emoji]\n║ ${prefix}als reset\n║ ${prefix}als stats\n╚═══════════════════════╝`
    }

    if (!_arAction || _arAction === 'status') return reply(_arStatus())

    if (_arAction === 'on' || _arAction === 'enable') {
        _ar.enabled = true
        global.autoLikeStatus = true
        global.autoViewStatus = _ar.viewMode === 'view+react'
        // sync emoji so index.js auto-like handler actually fires
        global.autoLikeEmoji = _ar.mode === 'random'
            ? (_ar.reactions[Math.floor(Math.random() * _ar.reactions.length)] || '❤️')
            : (_ar.fixedEmoji || '❤️')
        try { if (typeof _savePhoneState === 'function') _savePhoneState(X.user?.id?.split(':')[0]?.split('@')[0] || '') } catch {}
        return reply(`✅ *Auto React ON*\n║ Mode: ${_ar.viewMode} · ${_ar.mode === 'fixed' ? _ar.fixedEmoji : '🎲 random'}`)
    }

    if (_arAction === 'off' || _arAction === 'disable') {
        _ar.enabled = false
        global.autoLikeStatus = false
        try { if (typeof _savePhoneState === 'function') _savePhoneState(X.user?.id?.split(':')[0]?.split('@')[0] || '') } catch {}
        return reply(`❌ *Auto React OFF*`)
    }

    if (_arAction === 'view+react' || _arAction === 'viewreact') {
        _ar.viewMode = 'view+react'
        global.autoViewStatus = true
        return reply(`👁️ *View + React mode* — bot marks status as viewed then reacts.`)
    }

    if (_arAction === 'react-only' || _arAction === 'reactonly') {
        _ar.viewMode = 'react-only'
        global.autoViewStatus = false   // stop marking statuses as viewed
        return reply(`🎭 *React-only mode* — reacts without marking as viewed.`)
    }

    if (_arAction === 'fixed') {
        _ar.mode = 'fixed'
        return reply(`📌 *Fixed mode* — always reacts with ${_ar.fixedEmoji}`)
    }

    if (_arAction === 'random') {
        _ar.mode = 'random'
        return reply(`╔══〔 🎲 RANDOM MODE 〕════╗\n║ Picks random emoji from pool:\n║ ${_ar.reactions.join(' ')}\n╚═══════════════════════╝`)
    }

    if (_arAction === 'emoji') {
        if (!_arVal) return reply(`╔══〔 ❤️ AUTO LIKE STATUS 〕══╗\n\n║ Usage: *${prefix}als emoji [emoji]*\n║ Example: ${prefix}als emoji ❤️\n╚═══════════════════════╝`)
        _ar.fixedEmoji = _arVal
        _ar.mode = 'fixed'
        global.autoLikeEmoji = _arVal
        return reply(`✅ Emoji set to *${_arVal}* (fixed mode)`)
    }

    if (_arAction === 'add') {
        if (!_arVal) return reply(`╔══〔 🔥 AUTO LIKE STATUS 〕══╗\n\n║ Usage: *${prefix}als add [emoji]*\n║ Example: ${prefix}als add 🔥\n╚═══════════════════════╝`)
        if (_ar.reactions.includes(_arVal)) return reply(`⚠️ *${_arVal}* already in pool.`)
        _ar.reactions.push(_arVal)
        return reply(`✅ *${_arVal}* added.\n\n${_ar.reactions.join(' ')}`)
    }

    if (_arAction === 'remove') {
        if (!_arVal) return reply(`╔══〔 🗑️ AUTO LIKE STATUS 〕══╗\n\n║ Usage: *${prefix}als remove [emoji]*\n║ Example: ${prefix}als remove 🔥\n╚═══════════════════════╝`)
        const _ri = _ar.reactions.indexOf(_arVal)
        if (_ri === -1) return reply(`❌ *${_arVal}* not in pool.`)
        _ar.reactions.splice(_ri, 1)
        return reply(`✅ *${_arVal}* removed.\n\n${_ar.reactions.join(' ')}`)
    }

    if (_arAction === 'reset') {
        _ar.reactions = ['❤️','🔥','👍','😂','😮','👏','🎉','🎯','💯','🌟','✨','⚡','💥','🫶','🐺']
        _ar.totalReacted = 0
        _ar.reactedIds = []
        return reply(`🔄 *Reset* — emoji pool restored, stats cleared.`)
    }

    if (_arAction === 'stats') {
        return reply(`╔══〔 📊 REACT STATS 〕═══╗\n\n║ 📈 *Total reacted* : ${_ar.totalReacted}\n║ 🗂️  *Tracked IDs* : ${_ar.reactedIds.length}\n║ 🎭 *Mode* : ${_ar.mode}\n║ 👁️  *View Mode* : ${_ar.viewMode}\n║ 🎨 *Emoji pool* : ${_ar.reactions.join(' ')}\n╚═══════════════════════╝`)
    }

    if (_arAction === 'list' || _arAction === 'emojis') {
        return reply(`🎨 *Emoji Pool (${_ar.reactions.length}):*\n\n${_ar.reactions.join(' ')}\n\n║ Fixed: ${_ar.fixedEmoji}\n║ Mode: ${_ar.mode}`)
    }

    if (_arAction === 'post' || _arAction === 'send' || _arAction === 'status') {
        // .als post [text] — post text/image directly to WhatsApp status
        const _postText = args.slice(1).join(' ').trim() || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''
        const _jidList = Object.keys(store?.contacts || {}).filter(j => j.endsWith('@s.whatsapp.net'))
        if (!_jidList.length) _jidList.push(X.decodeJid(X.user.id).replace(/:.*@/,'@'))

        // check if replying to media
        if (m.quoted && m.quoted.message) {
            const _qm = m.quoted.message
            const _qt = Object.keys(_qm)[0]
            if (_qt === 'imageMessage') {
                const _stream = await downloadContentFromMessage(_qm.imageMessage, 'image')
                let _chunks = []; for await (const c of _stream) _chunks.push(c)
                const _buf = Buffer.concat(_chunks)
                await X.sendMessage('status@broadcast', { image: _buf, caption: _postText }, { statusJidList: _jidList })
                return reply(`✅ *Image posted to status!*\n║ Visible to ${_jidList.length} contact(s)`)
            } else if (_qt === 'videoMessage') {
                const _stream = await downloadContentFromMessage(_qm.videoMessage, 'video')
                let _chunks = []; for await (const c of _stream) _chunks.push(c)
                const _buf = Buffer.concat(_chunks)
                await X.sendMessage('status@broadcast', { video: _buf, caption: _postText, mimetype: 'video/mp4' }, { statusJidList: _jidList })
                return reply(`✅ *Video posted to status!*\n║ Visible to ${_jidList.length} contact(s)`)
            }
        }
        if (!_postText) return reply(`╔══〔 📤 POST TO STATUS 〕══╗\n\n║ ${prefix}als post [text] — text status\n║ Reply to image/video with ${prefix}als post — media status\n╚═══════════════════════╝`)
        await X.sendMessage('status@broadcast', { text: _postText }, { statusJidList: _jidList })
        return reply(`✅ *Posted to status!*\n║ Visible to ${_jidList.length} contact(s)`)
    }

    reply(_arStatus())
}
break

case 'poststatus':
case 'sendstatus':
case 'sts': {
    await X.sendMessage(m.chat, { react: { text: '📤', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
try {
    const _jidList = Object.keys(store?.contacts || {}).filter(j => j.endsWith('@s.whatsapp.net'))
    const _botJid = (X.decodeJid ? X.decodeJid(X.user.id) : X.user.id).replace(/:.*@/,'@')
    if (!_jidList.includes(_botJid)) _jidList.push(_botJid)
    const _caption = text || (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()) || ''

    if (m.quoted && m.quoted.message) {
        const _qm = m.quoted.message
        const _qt = Object.keys(_qm)[0]
        if (_qt === 'imageMessage') {
            const _stream = await downloadContentFromMessage(_qm.imageMessage, 'image')
            let _chunks = []; for await (const c of _stream) _chunks.push(c)
            await X.sendMessage('status@broadcast', { image: Buffer.concat(_chunks), caption: _caption }, { statusJidList: _jidList })
            return reply(`✅ *Image posted to your status!*\n║ Shown to ${_jidList.length} contact(s)`)
        } else if (_qt === 'videoMessage') {
            const _stream = await downloadContentFromMessage(_qm.videoMessage, 'video')
            let _chunks = []; for await (const c of _stream) _chunks.push(c)
            await X.sendMessage('status@broadcast', { video: Buffer.concat(_chunks), caption: _caption, mimetype: 'video/mp4' }, { statusJidList: _jidList })
            return reply(`✅ *Video posted to your status!*\n║ Shown to ${_jidList.length} contact(s)`)
        } else if (_qt === 'stickerMessage') {
            const _stream = await downloadContentFromMessage(_qm.stickerMessage, 'sticker')
            let _chunks = []; for await (const c of _stream) _chunks.push(c)
            await X.sendMessage('status@broadcast', { image: Buffer.concat(_chunks) }, { statusJidList: _jidList })
            return reply(`✅ *Sticker posted as status!*\n║ Shown to ${_jidList.length} contact(s)`)
        }
    }
    if (!_caption) return reply(
        `╔══〔 📤 POST TO STATUS 〕══╗\n\n\n╚═══════════════════════╝` +
        `  *Text:*  ${prefix}poststatus [your text]\n` +
        `  *Image:* reply to an image with ${prefix}poststatus\n` +
        `  *Video:* reply to a video with ${prefix}poststatus\n` +
        `  *Short:* ${prefix}sts [text]\n\n` +
        `║ Also: ${prefix}als post [text]`
    )
    await X.sendMessage('status@broadcast', { text: _caption }, { statusJidList: _jidList })
    reply(`✅ *Posted to your status!*\n║ Shown to ${_jidList.length} contact(s)`)
} catch(e) { reply('❌ Failed to post status: ' + e.message) }
}
break

case 'statusconfig':
case 'autostatus': {
    await X.sendMessage(m.chat, { react: { text: '⚙️', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let viewState = global.autoViewStatus ? '✅ ON' : '❌ OFF'
let likeState = (global.autoLikeStatus && global.autoLikeEmoji) ? `✅ ON (${global.autoLikeEmoji})` : '❌ OFF'
let replyState = global.autoReplyStatus ? `✅ ON ("${global.autoReplyStatusMsg}")` : '❌ OFF'
let fwdState = global.statusToGroup ? '✅ ON' : '❌ OFF'
let fwdGroup = global.statusToGroup ? global.statusToGroup : 'Not set'
let asmState = global.antiStatusMention ? `✅ ON (${(global.antiStatusMentionAction||'warn').toUpperCase()})` : '❌ OFF'
reply(`╔══〔 📊 STATUS TOOLS CONFIG 〕══╗

║ 👀 *Auto View* : ${viewState}
║ ❤️  *Auto Like* : ${likeState}
║ 💬 *Auto Reply* : ${replyState}
║ 📤 *Forward* : ${fwdState}
║ 🛡️  *Anti-Mention* : ${asmState}


  🛠️  *Commands*
║ ${prefix}autoviewstatus
║ ${prefix}autolikestatus [emoji/off]
║ ${prefix}autoreplystatus [msg/off]
║ ${prefix}togroupstatus on/off
║ ${prefix}antistatusmention [on/warn/kick/del]
╚═══════════════════════╝`)
}
break

case 'togroupstatus':
case 'statustogroup':
case 'fwdstatus': {
    await X.sendMessage(m.chat, { react: { text: '📢', key: m.key } })
// ── Two modes ─────────────────────────────────────────────────────────────────
// 1. Used inside a group with media/text → posts it as a status visible to group members
// 2. Used with 'on'/'off' arg → enables/disables AUTO-FORWARD of incoming statuses to this group
if (!isOwner) return reply(mess.OnlyOwner)

let _tgsArg = (args[0] || '').toLowerCase()

// Mode 2: toggle auto-forward
if (_tgsArg === 'on' || _tgsArg === 'enable') {
    if (!m.isGroup) return reply(`❌ Use *${prefix}togroupstatus on* inside the group you want statuses forwarded to.`)
    global.statusToGroup = from
    reply(`✅ *Status Auto-Forward: ON*

All incoming statuses will be forwarded to:
*${groupName || from}*

Use *${prefix}togroupstatus off* to disable.`)
} else if (_tgsArg === 'off' || _tgsArg === 'disable') {
    global.statusToGroup = ''
    reply('❌ *Status Auto-Forward: OFF*\n\nStatuses will no longer be forwarded to any group.')
} else if (_tgsArg === 'status') {
    let fwdGroup = global.statusToGroup
    if (fwdGroup) {
        let fwdMeta = await X.groupMetadata(fwdGroup).catch(() => null)
        reply(`📊 *Status Auto-Forward: ✅ ON*

Forwarding to: *${fwdMeta?.subject || fwdGroup}*

Use *${prefix}togroupstatus off* to disable.`)
    } else {
        reply(`📊 *Status Auto-Forward: ❌ OFF*

Use *${prefix}togroupstatus on* inside a group to enable.`)
    }
} else {
    // Mode 1: post quoted media/text as status visible to group members
    if (!m.isGroup) return reply(`╔══〔 📤 STATUS TOOLS 〕══╗\n\n║ *Post to group status:*\n║ Reply to media/text with *${prefix}togroupstatus*\n║ Or: *${prefix}togroupstatus [text]*\n\n║ *Auto-forward:*\n║ *${prefix}togroupstatus on*  — enable in group\n║ *${prefix}togroupstatus off* — disable\n║ *${prefix}togroupstatus status* — check setting\n╚═══════════════════════╝`)
    try {
        // Helper: download quoted media using downloadContentFromMessage
        const _dlQuoted = async (type) => {
            const ctxInfo = m.msg?.contextInfo
            const qMsg = ctxInfo?.quotedMessage
            if (!qMsg) throw new Error('No quoted message')
            const mediaMsg = qMsg[`${type}Message`] || qMsg
            const stream = await downloadContentFromMessage(mediaMsg, type)
            const chunks = []
            for await (const chunk of stream) chunks.push(chunk)
            return Buffer.concat(chunks)
        }

        // Helper: post via groupStatusMessageV2 (posts to group status, visible to all members)
        const _postGroupStatus = async (content) => {
            const crypto = require('crypto')
            const { backgroundColor } = content
            delete content.backgroundColor
            const inside = await generateWAMessageContent(content, {
                upload: X.waUploadToServer,
                backgroundColor: backgroundColor || '#9C27B0',
            })
            const secret = crypto.randomBytes(32)
            const built = generateWAMessageFromContent(
                from,
                {
                    messageContextInfo: { messageSecret: secret },
                    groupStatusMessageV2: {
                        message: {
                            ...inside,
                            messageContextInfo: { messageSecret: secret },
                        },
                    },
                },
                {}
            )
            await X.relayMessage(from, built.message, { messageId: built.key.id })
        }

        if (m.quoted) {
            const ctxInfo = m.msg?.contextInfo
            const qMsg = ctxInfo?.quotedMessage
            const qType = qMsg ? Object.keys(qMsg)[0] : (m.quoted.mtype || '')

            if (/image|sticker/i.test(qType)) {
                const mediaType = /sticker/i.test(qType) ? 'sticker' : 'image'
                const buf = await _dlQuoted(mediaType)
                const cap = m.quoted.text || m.quoted.caption || ''
                await _postGroupStatus({ image: buf, caption: cap })
                reply(`✅ *Image posted to group status!*`)
            } else if (/video/i.test(qType)) {
                const buf = await _dlQuoted('video')
                const cap = m.quoted.text || m.quoted.caption || ''
                await _postGroupStatus({ video: buf, caption: cap })
                reply(`✅ *Video posted to group status!*`)
            } else if (/audio/i.test(qType)) {
                const buf = await _dlQuoted('audio')
                await _postGroupStatus({ audio: buf, mimetype: 'audio/ogg; codecs=opus', ptt: true })
                reply(`✅ *Audio posted to group status!*`)
            } else {
                const quotedText = m.quoted.text || m.quoted.body || m.quoted.caption
                    || m.quoted.conversation || m.quoted.title || m.quoted.description || ''
                if (quotedText.trim()) {
                    await _postGroupStatus({ text: quotedText, backgroundColor: '#9C27B0' })
                    reply(`✅ *Text posted to group status!*`)
                } else {
                    reply(`❌ Unsupported type. Reply to an image, video, audio, or text message.`)
                }
            }
        } else if (text) {
            await _postGroupStatus({ text: text, backgroundColor: '#9C27B0' })
            reply(`✅ *Text posted to group status!*`)
        } else {
            reply(`╔══〔 📤 GROUP STATUS POSTER 〕══╗\n\n║ Reply to media with *${prefix}togroupstatus*\n║ Or: *${prefix}togroupstatus [text]*\n║ Auto-forward: *${prefix}togroupstatus on*\n╚═══════════════════════╝`)
        }
    } catch(e) {
        reply(`❌ Failed to post group status: ${e.message}`)
    }
}
}
break

//━━━━━━━━━━━━━━━━━━━━━━━━//
// Post to bot's own WhatsApp status
case 'tostatus':
case 'mystatus': {
    try {
        // Build statusJidList from store contacts — targets them directly,
        // bypassing WhatsApp privacy settings which often block delivery
        const _getStatusJids = () => {
            try {
                const _raw = store?.contacts
                if (!_raw) return []
                const _entries = typeof _raw.entries === 'function'
                    ? [..._raw.entries()] : Object.entries(_raw)
                return _entries
                    .map(([jid]) => jid)
                    .filter(jid => jid && jid.endsWith('@s.whatsapp.net'))
            } catch { return [] }
        }
        const _statusJids = _getStatusJids()
        const _sendOpts = _statusJids.length ? { statusJidList: _statusJids } : {}

        const _send = (content) => X.sendMessage('status@broadcast', content, _sendOpts)

        if (m.quoted) {
            const ctxInfo = m.msg?.contextInfo
            const qMsg = ctxInfo?.quotedMessage
            const qType = qMsg ? Object.keys(qMsg)[0] : (m.quoted.mtype || '')

            const _dlTS = async (type) => {
                const mediaMsg = (qMsg || {})[`${type}Message`] || qMsg
                const stream = await downloadContentFromMessage(mediaMsg, type)
                const chunks = []
                for await (const chunk of stream) chunks.push(chunk)
                return Buffer.concat(chunks)
            }

            if (/image|sticker/i.test(qType)) {
                const buf = await _dlTS(/sticker/i.test(qType) ? 'sticker' : 'image')
                const cap = m.quoted.text || m.quoted.caption || ''
                await _send({ image: buf, caption: cap })
                reply(`✅ *Image posted to your status!*`)
            } else if (/video/i.test(qType)) {
                const buf = await _dlTS('video')
                const cap = m.quoted.text || m.quoted.caption || ''
                await _send({ video: buf, caption: cap, gifPlayback: false })
                reply(`✅ *Video posted to your status!*`)
            } else if (/audio/i.test(qType)) {
                const buf = await _dlTS('audio')
                await _send({ audio: buf, mimetype: 'audio/ogg; codecs=opus', ptt: true })
                reply(`✅ *Audio posted to your status!*`)
            } else {
                const quotedText = m.quoted.text || m.quoted.body || m.quoted.caption
                    || m.quoted.conversation || m.quoted.title || m.quoted.description || ''
                if (quotedText.trim()) {
                    await _send({ text: quotedText, backgroundColor: '#075E54', font: 4 })
                    reply(`✅ *Text posted to your status!*`)
                } else {
                    reply(`❌ Unsupported type. Reply to an image, video, audio, or text message.`)
                }
            }
        } else if (text) {
            await _send({ text: text, backgroundColor: '#075E54', font: 4 })
            reply(`✅ *Text posted to your status!*`)
        } else {
            reply(`╔══〔 📤 STATUS POSTER 〕══╗\n\n║ Reply to media with *${prefix}tostatus*\n║ Or: *${prefix}tostatus [text]*\n╚═══════════════════════╝`)
        }
    } catch(e) {
        reply(`❌ Failed to post status: ${e.message}`)
    }
}
break

//━━━━━━━━━━━━━━━━━━━━━━━━//
// Developer tools
case 'self':
case 'private': {
    await X.sendMessage(m.chat, { react: { text: '🔒', key: m.key } })
if (!isDeployedNumber) return reply(mess.OnlyOwner)
X.public = false
reply(`╔══〔 🔒 BOT MODE: PRIVATE 〕══╗\n\n║ ✅ *Enabled*\n║ Only *${botClean}* can use commands.\n║ All other users are blocked.\n╚═══════════════════════╝`)
}
break

case 'public': {
    await X.sendMessage(m.chat, { react: { text: '🔓', key: m.key } })
if (!isDeployedNumber) return reply(mess.OnlyOwner)
X.public = true
reply(`╔══〔 🌐 BOT MODE: PUBLIC 〕══╗\n\n║ ✅ *Enabled*\n║ All users can use bot commands.\n║ Owner-only commands still restricted.\n╚═══════════════════════╝`)
}
break

case 'join': {
    await X.sendMessage(m.chat, { react: { text: '🔗', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
if (!q) return reply(`╔═══〔 🔗 JOIN GROUP 〕═══╗\n\n║ Usage: *${prefix}join [invite link]*\n║ Example: ${prefix}join https://chat.whatsapp.com/...\n╚═══════════════════════╝`)
let linkMatch = q.match(/chat\.whatsapp\.com\/([A-Za-z0-9]{10,})/)
if (!linkMatch) return reply(`╔══〔 ❌ INVALID LINK 〕═══╗\n\n║ That doesn't look like a valid WhatsApp\n║ group invite link.\n║\n║ ✅ Format: *https://chat.whatsapp.com/XXX*\n╚═══════════════════════╝`)
try {
    await reply('🔗 _Checking group info..._')

    // Step 1: fetch group metadata from the invite link
    let _grpInfo = null
    try { _grpInfo = await X.groupGetInviteInfo(linkMatch[1]) } catch (_gi) { console.log('[join] getInviteInfo:', _gi.message) }

    const _grpName    = _grpInfo?.subject || 'Unknown Group'
    const _grpSize    = _grpInfo?.size    || '?'
    const _needsApproval = _grpInfo?.joinApprovalMode === 'on' || _grpInfo?.joinApprovalMode === true

    if (_needsApproval) {
        await reply(`╔══〔 ⏳ APPROVAL REQUIRED 〕══╗\n\n║ 👥 *Group* : ${_grpName}\n║ 👤 *Members* : ${_grpSize}\n║\n║ This group requires admin approval.\n║ Sending join request now...\n╚═══════════════════════╝`)
    }

    // Step 2: attempt to join (or submit join request)
    let joinResult = await X.groupAcceptInvite(linkMatch[1])

    if (_needsApproval) {
        reply(`╔══〔 📨 REQUEST SENT 〕════╗\n\n║ 🛎️ Join request sent to admins of\n║ *${_grpName}*.\n║\n║ The bot will join once an admin\n║ approves the request.\n╚═══════════════════════╝`)
    } else {
        reply(`╔══〔 ✅ GROUP JOINED 〕═══╗\n\n║ 🎉 Bot successfully joined!\n║ 👥 *Group* : ${_grpName}\n║ 👤 *Members* : ${_grpSize}\n║ 🆔 *ID* : ${joinResult}\n╚═══════════════════════╝`)
    }

} catch (e) {
    let errMsg = (e.message || '').toLowerCase()
    // Baileys throws this when the request was submitted but approval is pending
    if (errMsg.includes('membership') || errMsg.includes('approval') || errMsg.includes('pending')) {
        reply(`╔══〔 📨 REQUEST SENT 〕════╗\n\n║ 🛎️ This group requires admin approval.\n║\n║ Join request has been submitted.\n║ The bot will be added once an admin\n║ approves it.\n╚═══════════════════════╝`)
    } else if (errMsg.includes('conflict') || errMsg.includes('already')) {
        reply(`╔══〔 ⚠️ ALREADY JOINED 〕══╗\n\n║ The bot is already a member\n║ of that group.\n╚═══════════════════════╝`)
    } else if (errMsg.includes('gone') || errMsg.includes('not-authorized') || errMsg.includes('expired')) {
        reply(`╔══〔 ❌ LINK EXPIRED 〕════╗\n\n║ This invite link is invalid or has\n║ been revoked. Ask for a new one.\n╚═══════════════════════╝`)
    } else if (errMsg.includes('forbidden') || errMsg.includes('blocked')) {
        reply(`╔══〔 🚫 JOIN BLOCKED 〕═══╗\n\n║ The bot has been blocked from\n║ joining this group.\n╚═══════════════════════╝`)
    } else {
        reply(`╔══〔 ❌ JOIN FAILED 〕════╗\n\n║ ⚠️ ${(e.message || 'Unknown error').slice(0, 120)}\n╚═══════════════════════╝`)
    }
}
}
break

case 'prefix': {
    await X.sendMessage(m.chat, { react: { text: '⚙️', key: m.key } })
let currentPfx = global.botPrefix || '.'
reply(`╔════〔 ⚙️  PREFIX 〕═════╗\n\n║ 🔤 *Current prefix* : *${currentPfx}*\n\n║ 💡 Supports: chars · emojis · words\n║ Use *${currentPfx}setprefix [prefix]* to change\n╚═══════════════════════╝`)
}
break

case 'save': {
    await X.sendMessage(m.chat, { react: { text: '💾', key: m.key } })
if (!m.quoted) return reply(`╔══〔 💾 SAVE TO DM 〕═════╗
║ Reply to any message/media
║ with *${prefix}save* to save it to your DM
╚═══════════════════════╝`)
try {
let savedMsg = {}
if (/image/.test(m.quoted.mimetype || '')) {
    let media = await m.quoted.download()
    savedMsg = { image: media, caption: m.quoted.text || '' }
} else if (/video/.test(m.quoted.mimetype || '')) {
    let media = await m.quoted.download()
    savedMsg = { video: media, caption: m.quoted.text || '', mimetype: 'video/mp4' }
} else if (/audio/.test(m.quoted.mimetype || '')) {
    let media = await m.quoted.download()
    savedMsg = { audio: media, mimetype: 'audio/mpeg' }
} else if (/sticker/.test(m.quoted.mtype || '')) {
    let media = await m.quoted.download()
    savedMsg = { sticker: media }
} else if (m.quoted.text) {
    savedMsg = { text: m.quoted.text }
} else {
    return reply('❌ *Unsupported media type.* Only images, videos, audio, stickers and text are supported.')
}
await X.sendMessage(sender, savedMsg)
} catch (e) { reply('Failed to save: ' + e.message) }
}
break

case 'setprefix': {
    await X.sendMessage(m.chat, { react: { text: '⚙️', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let newPrefix = text.trim()
if (!newPrefix) {
    let currentPfx = (global.botPrefix === '') ? '*none* (no prefix)' : (global.botPrefix || '.')
    reply(`╔══〔 ⌨️  SET PREFIX 〕═══╗\n\n║ 📌 *Current* : ${currentPfx}\n\n║ ${prefix}setprefix [prefix]  — set new prefix\n║ ${prefix}setprefix none     — remove prefix\n║ ${prefix}setprefix reset    — restore default (.)\n\n║ 💡 *Works with anything:*\n║  Single char  : . ! # @ $\n║  Emojis       : 🔥 ⚡ 🤖 👑\n║  Words        : bot toosii XD\n║  Mixed        : 🔥bot! XD~\n╚═══════════════════════╝`)
} else if (newPrefix.toLowerCase() === 'reset' || newPrefix.toLowerCase() === 'default') {
    global.botPrefix = '.'
    reply(`╔══〔 ⌨️  SET PREFIX 〕═══╗\n\n║ ✅ *Prefix reset to default*\n║ 🔤 Now using: *.*\n║ Example: *.menu*, *.ping*\n╚═══════════════════════╝`)
} else if (newPrefix.toLowerCase() === 'none' || newPrefix.toLowerCase() === 'off' || newPrefix.toLowerCase() === 'remove') {
    global.botPrefix = ''
    reply(`╔══〔 ⌨️  SET PREFIX 〕═══╗\n\n║ ✅ *Prefix removed!*\n║ Commands now work without a prefix.\n║ Example: *menu*, *ping*, *help*\n╚═══════════════════════╝`)
} else {
    global.botPrefix = newPrefix
    reply(`╔══〔 ⌨️  SET PREFIX 〕═══╗\n\n║ ✅ *Prefix updated!*\n║ 🔤 *New prefix* : *${global.botPrefix}*\n\n║ Example: *${global.botPrefix}menu*\n║          *${global.botPrefix}ping*\n║          *${global.botPrefix}help*\n╚═══════════════════════╝`)
}
}
break

// Bot Configuration Commands
case 'botname': {
    await X.sendMessage(m.chat, { react: { text: '✏️', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let newName = args.join(' ').trim()
if (!newName) return reply(`╔════〔 🤖 BOT NAME 〕════╗\n\n║ Current: *${global.botname}*\n║ Usage: *${prefix}botname [new name]*\n╚═══════════════════════╝`)
global.botname = newName
reply(`✅ *Bot name updated* : *${newName}*`)
}
break

case 'setauthor':
case 'author': {
    await X.sendMessage(m.chat, { react: { text: '✏️', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let newAuthor = args.join(' ').trim()
if (!newAuthor) return reply(`╔══〔 ✏️ STICKER AUTHOR 〕══╗\n\n║ Current: *${global.author}*\n║ Usage: *${prefix}author [new name]*\n╚═══════════════════════╝`)
global.author = newAuthor
reply(`✅ *Sticker author updated* : *${newAuthor}*`)
}
break

case 'setwm':
case 'setwatermark':
case 'setpackname':
case 'packname': {
    await X.sendMessage(m.chat, { react: { text: '✏️', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let newPack = args.join(' ').trim()
if (!newPack) return reply(`╔══〔 📦 STICKER PACK 〕══╗\n\n║ Current: *${global.packname}*\n║ Usage: *${prefix}packname [new name]*\n╚═══════════════════════╝`)
global.packname = newPack
reply(`✅ *Sticker pack updated* : *${newPack}*`)
}
break

case 'timezone':
case 'settz': {
    await X.sendMessage(m.chat, { react: { text: '🕐', key: m.key } })
    if (!isOwner) return reply(mess.OnlyOwner)
    const _allZones = moment.tz.names()
    let _tzArg = args.join(' ').trim()

    // Alias map — country/city names → correct IANA timezone
    const _tzAliases = {
        'africa/nigeria': 'Africa/Lagos', 'africa/abuja': 'Africa/Lagos', 'africa/lagos': 'Africa/Lagos',
        'africa/ghana': 'Africa/Accra', 'africa/accra': 'Africa/Accra',
        'africa/cameroon': 'Africa/Douala', 'africa/douala': 'Africa/Douala',
        'africa/kenya': 'Africa/Nairobi', 'africa/nairobi': 'Africa/Nairobi',
        'africa/uganda': 'Africa/Kampala', 'africa/kampala': 'Africa/Kampala',
        'africa/tanzania': 'Africa/Dar_es_Salaam', 'africa/ethiopia': 'Africa/Addis_Ababa',
        'africa/egypt': 'Africa/Cairo', 'africa/cairo': 'Africa/Cairo',
        'africa/morocco': 'Africa/Casablanca', 'africa/casablanca': 'Africa/Casablanca',
        'africa/sudan': 'Africa/Khartoum', 'africa/zimbabwe': 'Africa/Harare',
        'africa/zambia': 'Africa/Lusaka', 'africa/angola': 'Africa/Luanda',
        'africa/mozambique': 'Africa/Maputo', 'africa/rwanda': 'Africa/Kigali',
        'africa/burundi': 'Africa/Bujumbura', 'africa/senegal': 'Africa/Dakar',
        'africa/congo': 'Africa/Brazzaville', 'africa/drc': 'Africa/Kinshasa',
        'africa/somalia': 'Africa/Mogadishu', 'africa/liberia': 'Africa/Monrovia',
        'africa/ivory_coast': 'Africa/Abidjan', 'africa/cote_divoire': 'Africa/Abidjan',
        'africa/mali': 'Africa/Bamako', 'africa/guinea': 'Africa/Conakry',
        'africa/niger': 'Africa/Niamey', 'africa/chad': 'Africa/Ndjamena',
        'africa/madagascar': 'Indian/Antananarivo', 'africa/mauritius': 'Indian/Mauritius',
        'europe/uk': 'Europe/London', 'europe/england': 'Europe/London',
        'europe/scotland': 'Europe/London', 'europe/wales': 'Europe/London',
        'europe/ireland': 'Europe/Dublin', 'europe/holland': 'Europe/Amsterdam',
        'europe/netherlands': 'Europe/Amsterdam',
        'america/usa': 'America/New_York', 'america/uk': 'Europe/London',
        'america/brazil': 'America/Sao_Paulo', 'america/canada': 'America/Toronto',
        'america/mexico': 'America/Mexico_City', 'america/colombia': 'America/Bogota',
        'america/venezuela': 'America/Caracas', 'america/argentina': 'America/Argentina/Buenos_Aires',
        'america/chile': 'America/Santiago', 'america/peru': 'America/Lima',
        'asia/india': 'Asia/Kolkata', 'asia/pakistan': 'Asia/Karachi',
        'asia/bangladesh': 'Asia/Dhaka', 'asia/china': 'Asia/Shanghai',
        'asia/japan': 'Asia/Tokyo', 'asia/korea': 'Asia/Seoul',
        'asia/indonesia': 'Asia/Jakarta', 'asia/thailand': 'Asia/Bangkok',
        'asia/vietnam': 'Asia/Ho_Chi_Minh', 'asia/malaysia': 'Asia/Kuala_Lumpur',
        'asia/philippines': 'Asia/Manila', 'asia/singapore': 'Asia/Singapore',
        'asia/uae': 'Asia/Dubai', 'asia/dubai': 'Asia/Dubai',
        'asia/saudi': 'Asia/Riyadh', 'asia/saudi_arabia': 'Asia/Riyadh',
        'asia/qatar': 'Asia/Qatar', 'asia/kuwait': 'Asia/Kuwait',
        'asia/israel': 'Asia/Jerusalem', 'asia/turkey': 'Europe/Istanbul',
        'australia/sydney': 'Australia/Sydney', 'australia/melbourne': 'Australia/Melbourne',
        'australia/perth': 'Australia/Perth', 'australia/brisbane': 'Australia/Brisbane',
    }

    // No arg — show current timezone + time
    if (!_tzArg) {
        const _cur = global.botTimezone || 'Africa/Nairobi'
        const _now = moment().tz(_cur)
        return reply(
            `╔════〔 🕐 TIMEZONE 〕════╗\n\n\n╚═══════════════════════╝` +
            `║ 🌍 *Current* : ${_cur}\n` +
            `║ 🕐 *Time* : ${_now.format('HH:mm:ss')}\n` +
            `║ 📅 *Date* : ${_now.format('DD/MM/YYYY')}\n` +
            `║ ⏰ *Offset* : UTC${_now.format('Z')}\n\n` +
            `  📌 *Usage:*\n` +
            `  ${prefix}timezone Africa/Lagos\n` +
            `  ${prefix}timezone Asia/Dubai\n` +
            `  ${prefix}timezone America/New_York\n\n` +
            `  🔍 *Search:* ${prefix}timezone Africa`
        )
    }

    // Alias lookup — resolve common country/city names
    const _aliasKey = _tzArg.toLowerCase().replace(/\s+/g, '_')
    const _aliasMatch = _tzAliases[_aliasKey]
    if (_aliasMatch) {
        global.botTimezone = _aliasMatch
        const _now = moment().tz(_aliasMatch)
        return reply(
            `╔════〔 🕐 TIMEZONE 〕════╗\n\n\n╚═══════════════════════╝` +
            `  ✅ *Updated!*\n\n` +
            `║ 🌍 *Timezone* : ${_aliasMatch}\n` +
            `║ 🕐 *Time* : ${_now.format('HH:mm:ss')}\n` +
            `║ 📅 *Date* : ${_now.format('DD/MM/YYYY')}\n` +
            `║ ⏰ *Offset* : UTC${_now.format('Z')}`
        )
    }

    // Exact IANA match — set it
    if (moment.tz.zone(_tzArg)) {
        global.botTimezone = _tzArg
        const _now = moment().tz(_tzArg)
        return reply(
            `╔════〔 🕐 TIMEZONE 〕════╗\n\n\n╚═══════════════════════╝` +
            `  ✅ *Updated!*\n\n` +
            `║ 🌍 *Timezone* : ${_tzArg}\n` +
            `║ 🕐 *Time* : ${_now.format('HH:mm:ss')}\n` +
            `║ 📅 *Date* : ${_now.format('DD/MM/YYYY')}\n` +
            `║ ⏰ *Offset* : UTC${_now.format('Z')}`
        )
    }

    // Partial search in IANA list
    const _query = _tzArg.toLowerCase()
    const _matches = _allZones.filter(z => z.toLowerCase().includes(_query)).slice(0, 20)
    if (_matches.length) {
        return reply(
            `╔════〔 🕐 TIMEZONE 〕════╗\n\n\n╚═══════════════════════╝` +
            `  ❌ *"${_tzArg}"* not found.\n` +
            `  Did you mean one of these?\n\n` +
            _matches.map((z, i) => {
                const _t = moment().tz(z).format('HH:mm')
                return `  ${i+1}. ${z} (🕐 ${_t})`
            }).join('\n') +
            (_allZones.filter(z => z.toLowerCase().includes(_query)).length > 20
                ? `\n║ ... and more. Be more specific.` : ``) +
            `\n\n║ 📌 Copy a timezone above and run:\n║ ${prefix}timezone <timezone>`
        )
    }

    // Nothing found — suggest searching by continent
    const _continent = _tzArg.split('/')[0] || ''
    const _contSearch = _allZones.filter(z => z.toLowerCase().startsWith(_continent.toLowerCase())).slice(0, 10)
    reply(
        `╔════〔 🕐 TIMEZONE 〕════╗\n\n\n╚═══════════════════════╝` +
        `  ❌ *"${_tzArg}"* is not a valid timezone.\n\n` +
        (_contSearch.length ? `  *${_continent} timezones:*\n` + _contSearch.map(z => `  • ${z}`).join('\n') + '\n\n' : '') +
        `  🔍 Search: ${prefix}timezone ${_continent || 'Africa'}\n` +
        `  📌 Example: ${prefix}timezone Africa/Lagos`
    )
}
break

case 'botpic':
case 'setbotpic': {
    await X.sendMessage(m.chat, { react: { text: '🖼️', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let picUrl = args.join(' ').trim()
if (m.quoted && m.quoted.mtype === 'imageMessage') {
    try {
        let media = await X.downloadAndSaveMediaMessage(m.quoted, 'botpic')
        await X.updateProfilePicture(X.user.id, { url: media })
        fs.unlinkSync(media)
        reply('╔══〔 🖼️ BOT PP 〕══╗\n\n║ ✅ Profile picture updated!\n╚═══════════════════════╝')
    } catch (e) {
        reply('*Failed to update profile picture.* Make sure you reply to an image.')
    }
} else if (picUrl) {
    global.botPic = picUrl
    global.thumb = picUrl
    reply(`✅ *Bot thumbnail updated*`)
} else {
    reply(`╔══〔 🖼️ BOT PICTURE 〕════╗\n║ 🔗 *Current* : ${global.thumb}\n╠══〔 📋 USAGE 〕══════════╣\n║ ${prefix}botpic [url]   — set thumbnail URL\n║ Reply + ${prefix}botpic  — set profile picture\n╚═══════════════════════╝`)
}
}
break

case 'boturl':
case 'setboturl': {
    await X.sendMessage(m.chat, { react: { text: '🔗', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let newUrl = args.join(' ').trim()
if (!newUrl) return reply(`╔════〔 🌐 BOT URL 〕═════╗\n\n║ Current: *${global.botUrl || global.wagc}*\n║ Usage: *${prefix}boturl [url]*\n╚═══════════════════════╝`)
global.botUrl = newUrl
global.wagc = newUrl
reply(`✅ *Bot URL updated* : *${newUrl}*`)
}
break

case 'anticall':
case 'setanticall': {
    await X.sendMessage(m.chat, { react: { text: '📵', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let acArg = (args[0] || '').toLowerCase()
if (!acArg) {
    let acState = global.antiCall ? 'ON' : 'OFF'
    reply(`╔══〔 📵 ANTI CALL 〕══════╗\n║ 📊 *Status* : ${acState}\n║ ✅ Rejects & warns callers automatically\n╠══〔 📋 USAGE 〕══════════╣\n║ ${prefix}anticall on\n║ ${prefix}anticall off\n╚═══════════════════════╝`)
} else if (acArg === 'on' || acArg === 'enable') {
    global.antiCall = true
    reply('╔══〔 📵 ANTI-CALL 〕══╗\n\n║ Status: ✅ ON\n║ Incoming calls will be rejected.\n╚═══════════════════════╝')
} else if (acArg === 'off' || acArg === 'disable') {
    global.antiCall = false
    reply('╔══〔 📵 ANTI-CALL 〕══╗\n\n║ Status: ❌ OFF\n╚═══════════════════════╝')
}
}
break

case 'autoread':
case 'setautoread': {
    await X.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let arArg = (args[0] || '').toLowerCase()
if (!arArg) {
    let arState = global.autoRead ? 'ON' : 'OFF'
    reply(`╔══〔 👁️ AUTO READ 〕══════╗\n║ 📊 *Status* : ${arState}\n║ Marks all messages as read automatically\n╠══〔 📋 USAGE 〕══════════╣\n║ ${prefix}autoread on\n║ ${prefix}autoread off\n╚═══════════════════════╝`)
} else if (arArg === 'on' || arArg === 'enable') {
    global.autoRead = true
    reply('╔══〔 📖 AUTO READ 〕══╗\n\n║ Status: ✅ ON\n║ All messages will be marked as read.\n╚═══════════════════════╝')
} else if (arArg === 'off' || arArg === 'disable') {
    global.autoRead = false
    reply('╔══〔 📖 AUTO READ 〕══╗\n\n║ Status: ❌ OFF\n╚═══════════════════════╝')
}
}
break

case 'chatbot':
case 'setchatbot': {
    await X.sendMessage(m.chat, { react: { text: '🤖', key: m.key } })
// Owner can toggle globally; group admins/members can toggle per-chat via chatboai
if (!isOwner) return reply(mess.OnlyOwner)
let cbArg = (args[0] || '').toLowerCase()
if (!cbArg) {
    let cbState = global.chatBot ? '✅ ON' : '❌ OFF'
    let cbaChats = Object.keys(global.chatBoAIChats || {}).length
    reply(`╔══〔 🤖 CHATBOT STATUS 〕══╗\n║ 🌐 *Global ChatBot* : ${cbState}\n║ 💬 *AI Active Chats* : ${cbaChats}\n╠══〔 📋 COMMANDS 〕══════╣\n║ ${prefix}chatbot on       — global auto-reply\n║ ${prefix}chatbot off      — disable\n║ ${prefix}chatboai on      — this chat only\n║ ${prefix}chatboai off     — disable here\n║ ${prefix}chatboai [msg]   — one-shot AI reply\n╚═══════════════════════╝`)
} else if (cbArg === 'on' || cbArg === 'enable') {
    global.chatBot = true
    reply('*🤖 ChatBot: ✅ ON*\n_Bot will now auto-reply to all messages in English using AI._\n\n_Use_ ' + prefix + 'chatbot off _to stop._')
} else if (cbArg === 'off' || cbArg === 'disable') {
    global.chatBot = false
    reply('*🤖 ChatBot: ❌ OFF*\n_Global auto-replies disabled._')
}
}
break

case 'setbio':
  case 'changebio':
  case 'setstatus': {
      await X.sendMessage(m.chat, { react: { text: '📝', key: m.key } })
      if (!isOwner) return reply(mess.OnlyOwner)
      if (!text) return reply(`╔══〔 📝 SET BIO 〕════╗\n\n║ Usage: *${prefix}setbio <text>*\n║ Sets the bot's WhatsApp status/bio\n╚═══════════════════════╝`)
      try {
          await X.updateProfileStatus(text)
          reply(`✅ *Bio updated!*\n📝 ${text}`)
      } catch(e) { reply('❌ Failed to update bio: ' + e.message) }
  } break

  case 'autobio':
case 'setautobio': {
    await X.sendMessage(m.chat, { react: { text: '📝', key: m.key } })
    if (!isOwner) return reply(mess.OnlyOwner)
    let abArg = (args[0] || '').toLowerCase()
    if (!abArg) {
        let abState = global._autoBioInterval ? 'ON' : 'OFF'
        reply(`╔══〔 ✍️ AUTO BIO 〕═══════╗\n║ 📊 *Status* : ${abState}\n║ Bio updates with current time every min\n╠══〔 📋 USAGE 〕══════════╣\n║ ${prefix}autobio on\n║ ${prefix}autobio off\n╚═══════════════════════╝`)
    } else if (abArg === 'on' || abArg === 'enable') {
        if (global._autoBioInterval) clearInterval(global._autoBioInterval)
        const _doBio = async () => {
            try {
                const _now = new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos', hour12: true, weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                await X.updateProfileStatus(`🤖 TOOSII-XD-ULTRA | Online ✅ | ${_now}`)
            } catch (_) {}
        }
        _doBio()
        global._autoBioInterval = setInterval(_doBio, 60000)
        global.autoBio = true
        reply('╔══〔 ⚙️ AUTO BIO 〕══╗\n\n║ Status: ✅ ON\n║ Bio will update with current time every minute.\n╚═══════════════════════╝')
    } else if (abArg === 'off' || abArg === 'disable') {
        if (global._autoBioInterval) { clearInterval(global._autoBioInterval); global._autoBioInterval = null }
        global.autoBio = false
        try { await X.updateProfileStatus('🤖 TOOSII-XD-ULTRA | Powered by Baileys') } catch (_) {}
        reply('╔══〔 ⚙️ AUTO BIO 〕══╗\n\n║ Status: ❌ OFF\n║ Bio restored to default.\n╚═══════════════════════╝')
    }
} break

case 'autoreplystatus':
case 'autoreply': {
    await X.sendMessage(m.chat, { react: { text: '💬', key: m.key } })
if (!isOwner) return reply(mess.OnlyOwner)
let arsArg = args.join(' ').trim()
if (!arsArg) {
    let arsState = global.autoReplyStatus ? 'ON' : 'OFF'
    let arsMsg = global.autoReplyStatusMsg || 'Not set'
    reply(`╔══〔 💬 AUTO REPLY STATUS 〕╗\n║ 📊 *Status* : ${arsState}\n║ 📝 *Reply msg* : ${arsMsg}\n╠══〔 📋 USAGE 〕══════════╣\n║ ${prefix}autoreplystatus [msg] — enable\n║ ${prefix}autoreplystatus off  — disable\n╚═══════════════════════╝`)
} else if (arsArg.toLowerCase() === 'off' || arsArg.toLowerCase() === 'disable') {
    global.autoReplyStatus = false
    global.autoReplyStatusMsg = ''
    reply('╔══〔 🔄 AUTO REPLY STATUS 〕══╗\n\n║ Status: ❌ OFF\n╚═══════════════════════╝')
} else {
    global.autoReplyStatusMsg = arsArg
    global.autoReplyStatus = true
    reply(`✅ *Auto Reply Status ON*\n║ Replying with: _"${arsArg}"_`)
}
}
break

case 'antistatusmention':
case 'antismention': {
    await X.sendMessage(m.chat, { react: { text: '🛡️', key: m.key } })
    if (!m.isGroup) return reply(mess.OnlyGrup)
    if (!isAdmins && !isOwner) return reply(mess.admin)
    if (!global.antiStatusMentionGroups) global.antiStatusMentionGroups = {}
    const _asmCfg = global.antiStatusMentionGroups[m.chat] || { enabled: false, action: 'warn' }
    let asmArg = (args[0] || '').toLowerCase()

    const _asmStatus = () => {
        const _s    = _asmCfg.enabled ? '✅ ON' : '❌ OFF'
        const _a    = (_asmCfg.action || 'warn').toUpperCase()
        const _aIcon = _a === 'WARN' ? '⚠️' : _a === 'KICK' ? '🚫' : '🗑️'
        return `╔══〔 🛡️  ANTI STATUS MENTION 〕══╗\n\n║ 📊 *Status* : ${_s}\n║ ${_aIcon} *Action* : ${_a}\n║ 📍 *Scope* : This group only\n\n║ *Commands:*\n║ ${prefix}antistatusmention on\n║ ${prefix}antistatusmention off\n║ ${prefix}antistatusmention warn   — 3 strikes then kick\n║ ${prefix}antistatusmention delete — notify in group\n║ ${prefix}antistatusmention kick   — instant removal\n\n║ _Bot must be admin in the group._\n╚═══════════════════════╝`
    }

    const _save = (enabled, action) => {
        global.antiStatusMentionGroups[m.chat] = { enabled, action: action || _asmCfg.action || 'warn' }
    }

    if (!asmArg) {
        reply(_asmStatus())
    } else if (asmArg === 'on' || asmArg === 'enable') {
        _save(true, _asmCfg.action || 'warn')
        const _a = (_asmCfg.action || 'warn').toUpperCase()
        reply(`╔══〔 🛡️  ANTI STATUS MENTION 〕══╗\n\n║ ✅ *Enabled for this group*\n║ Action: *${_a}*\n\n║ _Anyone who tags this group in their status\n║ will be ${_a === 'WARN' ? 'warned (3x = kick)' : _a === 'KICK' ? 'instantly kicked' : 'notified and warned'}._\n╚═══════════════════════╝`)
    } else if (asmArg === 'off' || asmArg === 'disable') {
        _save(false, _asmCfg.action || 'warn')
        reply(`╔══〔 🛡️  ANTI STATUS MENTION 〕══╗\n\n║ ❌ *Disabled for this group*\n║ Group tagging in statuses no longer actioned.\n╚═══════════════════════╝`)
    } else if (asmArg === 'warn') {
        _save(true, 'warn')
        reply(`╔══〔 🛡️  ANTI STATUS MENTION 〕══╗\n\n║ ⚠️ *WARN MODE — Enabled*\n║ 📍 This group only\n║ 3 warnings : automatic kick\n\n║ _Bot must be admin in the group._\n╚═══════════════════════╝`)
    } else if (asmArg === 'delete' || asmArg === 'del') {
        _save(true, 'delete')
        reply(`╔══〔 🛡️  ANTI STATUS MENTION 〕══╗\n\n║ 🗑️ *DELETE MODE — Enabled*\n║ 📍 This group only\n║ Group notified + sender DM'd\n\n║ _Bot must be admin in the group._\n╚═══════════════════════╝`)
    } else if (asmArg === 'kick' || asmArg === 'remove') {
        _save(true, 'kick')
        reply(`╔══〔 🛡️  ANTI STATUS MENTION 〕══╗\n\n║ 🚫 *KICK MODE — Enabled*\n║ 📍 This group only\n║ Instant removal from group\n\n║ _Bot must be admin in the group._\n╚═══════════════════════╝`)
    } else {
        reply(`❌ Unknown option. Use: *on, off, warn, delete, kick*`)
    }
}
break




case 'antilink':
case 'setantilink': {
    await X.sendMessage(m.chat, { react: { text: '🔗', key: m.key } })
if (!m.isGroup) return reply(mess.OnlyGrup)
if (!isAdmins && !isOwner) return reply(mess.admin)
let alArg = (args[0] || '').toLowerCase()
if (!alArg) {
    let alState = global.antiLink ? 'ON' : 'OFF'
    reply(`╔══〔 🔗 ANTI LINK 〕══════╗\n║ 📊 *Status* : ${alState}\n║ Deletes links & warns sender\n╠══〔 📋 USAGE 〕══════════╣\n║ ${prefix}antilink on\n║ ${prefix}antilink off\n╚═══════════════════════╝`)
} else if (alArg === 'on' || alArg === 'enable') {
    global.antiLink = true
    reply(`╔══〔 🔗 ANTI-LINK: ON 〕══╗\n\n║ ✅ Links will be deleted.\n║ _Bot must be admin._\n╚═══════════════════════╝`)
} else if (alArg === 'off' || alArg === 'disable') {
    global.antiLink = false
    reply('╔══〔 🔗 ANTI-LINK 〕══╗\n\n║ Status: ❌ OFF\n╚═══════════════════════╝')
}
}
break

case 'antichat':
case 'nochat':
case 'chatlock': {
    await X.sendMessage(m.chat, { react: { text: '💬', key: m.key } })
    if (!m.isGroup) return reply(mess.OnlyGrup)
    if (!isAdmins && !isOwner) return reply(mess.admin)

    const _acPath = './database/antichat.json'
    let _acDB = {}
    try { _acDB = JSON.parse(fs.readFileSync(_acPath, 'utf8')) } catch {}
    const _acSave = () => {
        try {
            if (!fs.existsSync('./database')) fs.mkdirSync('./database', { recursive: true })
            fs.writeFileSync(_acPath, JSON.stringify(_acDB, null, 2))
        } catch {}
    }

    const _acGC  = _acDB[m.chat] || { enabled: false, action: 'delete', warnings: {} }
    const _acSub = (args[0] || '').toLowerCase()

    if (!_acSub || _acSub === 'status') {
        const _acStatus = _acGC.enabled
            ? `✅ ON (${(_acGC.action || 'delete').toUpperCase()})`
            : '❌ OFF'
        return reply(
            `╔══〔 💬 ANTI-CHAT 〕══════╗
` +
            `║ 📊 *Status*  : ${_acStatus}
` +
            `║ 🔒 Blocks non-admin messages
` +
            `╠══〔 📋 USAGE 〕══════════╣
` +
            `║ ${prefix}antichat on
` +
            `║ ${prefix}antichat off
` +
            `║ ${prefix}antichat action delete
` +
            `║ ${prefix}antichat action warn
` +
            `║ ${prefix}antichat action kick
` +
            `║ ${prefix}antichat resetwarns
` +
            `╚═══════════════════════╝`
        )
    }

    if (_acSub === 'on' || _acSub === 'enable') {
        _acDB[m.chat] = { ..._acGC, enabled: true }
        _acSave()
        return reply(
            `╔══〔 💬 ANTI-CHAT: ON 〕══╗

` +
            `║ ✅ Non-admins cannot send messages.
` +
            `║ 🔧 *Action* : ${(_acDB[m.chat].action || 'delete').toUpperCase()}
` +
            `║ _Bot must be group admin._
` +
            `╚═══════════════════════╝`
        )
    }

    if (_acSub === 'off' || _acSub === 'disable') {
        _acDB[m.chat] = { ..._acGC, enabled: false }
        _acSave()
        return reply(
            `╔══〔 💬 ANTI-CHAT: OFF 〕═╗

` +
            `║ Members can now chat freely.
` +
            `╚═══════════════════════╝`
        )
    }

    if (_acSub === 'action') {
        const _acAct = (args[1] || '').toLowerCase()
        if (!['delete', 'warn', 'kick'].includes(_acAct)) {
            return reply(
                `╔══〔 ❌ INVALID ACTION 〕══╗

` +
                `║ Valid actions:
` +
                `║  • delete — remove message
` +
                `║  • warn   — warn + count
` +
                `║  • kick   — remove from group
` +
                `║
` +
                `║ Example: ${prefix}antichat action warn
` +
                `╚═══════════════════════╝`
            )
        }
        _acDB[m.chat] = { ..._acGC, action: _acAct }
        _acSave()
        return reply(
            `╔══〔 💬 ANTI-CHAT 〕══════╗

` +
            `║ ✅ Action set to: *${_acAct.toUpperCase()}*
` +
            `╚═══════════════════════╝`
        )
    }

    if (_acSub === 'resetwarns' || _acSub === 'reset') {
        _acDB[m.chat] = { ..._acGC, warnings: {} }
        _acSave()
        return reply(
            `╔══〔 💬 ANTI-CHAT 〕══════╗

` +
            `║ ✅ All warnings have been cleared.
` +
            `╚═══════════════════════╝`
        )
    }

    return reply(
        `╔══〔 ❌ UNKNOWN OPTION 〕══╗

` +
        `║ Use *${prefix}antichat* to see commands.
` +
        `╚═══════════════════════╝`
    )
}
break

case 'antidelete':
  case 'antidel':
  case 'setantidelete': {
      await X.sendMessage(m.chat, { react: { text: '🗑️', key: m.key } })
      if (!isOwner) return reply(mess.OnlyOwner)

      // Init state with gc/pm structure
      if (!global.adState || !global.adState.gc) global.adState = {
          gc: { enabled: false, mode: 'private' },
          pm: { enabled: false, mode: 'private' },
          stats: { total: 0, retrieved: 0, media: 0 }
      }
      const _ad = global.adState
      // Keep legacy globals in sync
      const _syncLegacy = () => {
          global.antiDelete = _ad.gc.enabled || _ad.pm.enabled
          global.antiDeleteMode = _ad.gc.mode === 'chat' || _ad.pm.mode === 'chat' ? 'public' : 'private'
          global._saveAdState?.()
      }

      const _arg = (args[0] || '').toLowerCase().trim()
      const _sub = (args[1] || '').toLowerCase().trim()

      const _modeLabel = (mode) => mode === 'both' ? '📢 BOTH (DM + Chat)' : mode === 'chat' ? '💬 CHAT' : '🔒 PRIVATE (DM)'

      const _statusMsg = () => {
          const _gcSt = _ad.gc.enabled ? _modeLabel(_ad.gc.mode) : '❌ OFF'
          const _pmSt = _ad.pm.enabled ? _modeLabel(_ad.pm.mode) : '❌ OFF'
          return (
              `╔══〔 🗑️ ANTI-DELETE 〕══╗\n\n\n╚═══════════════════════╝` +
              `║ 👥 *Groups* : ${_gcSt}\n` +
              `║ 💬 *PMs* : ${_pmSt}\n` +
              `║ 📈 *Tracked* : ${_ad.stats.total} msgs\n` +
              `║ ✅ *Retrieved* : ${_ad.stats.retrieved}\n` +
              `║ 🖼️  *Media* : ${_ad.stats.media} files\n\n` +
              `  *Commands:*\n` +
              `║ ${prefix}antidelete on/off\n` +
              `║ ${prefix}antidelete private/chat/both\n` +
              `║ ${prefix}antidelete gc on/off/private/chat/both\n` +
              `║ ${prefix}antidelete pm on/off/private/chat/both\n` +
              `║ ${prefix}antidelete stats | clear`
          )
      }

      if (!_arg || _arg === 'status') return reply(_statusMsg())

      // ── gc subcommand ─────────────────────────────────────────────────
      if (_arg === 'gc' || _arg === 'group' || _arg === 'groups') {
          if (_sub === 'on' || _sub === 'enable') {
              _ad.gc.enabled = true; _syncLegacy()
              return reply(`✅ *Anti-Delete GROUPS: ON*\nMode: ${_modeLabel(_ad.gc.mode)}`)
          } else if (_sub === 'off' || _sub === 'disable') {
              _ad.gc.enabled = false; _syncLegacy()
              return reply(`❌ *Anti-Delete GROUPS: OFF*`)
          } else if (['private','prvt','priv'].includes(_sub)) {
              _ad.gc.enabled = true; _ad.gc.mode = 'private'; _syncLegacy()
              return reply(`╔══〔 🔒 ANTI DELETE: GROUPS 〕╗\n║ 📨 *Mode* : PRIVATE\n║ Deleted messages sent to your DM only\n╚═══════════════════════╝`)
          } else if (['chat','cht'].includes(_sub)) {
              _ad.gc.enabled = true; _ad.gc.mode = 'chat'; _syncLegacy()
              return reply(`╔══〔 💬 ANTI DELETE: GROUPS 〕╗\n║ 📨 *Mode* : CHAT\n║ Deleted messages shown in group chat\n╚═══════════════════════╝`)
          } else if (['both','all'].includes(_sub)) {
              _ad.gc.enabled = true; _ad.gc.mode = 'both'; _syncLegacy()
              return reply(`╔══〔 📢 ANTI DELETE: GROUPS 〕╗\n║ 📨 *Mode* : BOTH\n║ Deleted messages → DM + Group chat\n╚═══════════════════════╝`)
          } else {
              return reply(`╔══〔 🛡 ANTI DELETE — GROUPS 〕══╗\n\n║ ${prefix}antidelete gc on/off\n║ ${prefix}antidelete gc private/chat/both\n╚═══════════════════════╝`)
          }
      }

      // ── pm subcommand ──────────────────────────────────────────────────
      if (_arg === 'pm' || _arg === 'dm' || _arg === 'pms' || _arg === 'dms') {
          if (_sub === 'on' || _sub === 'enable') {
              _ad.pm.enabled = true; _syncLegacy()
              return reply(`✅ *Anti-Delete PMs: ON*\nMode: ${_modeLabel(_ad.pm.mode)}`)
          } else if (_sub === 'off' || _sub === 'disable') {
              _ad.pm.enabled = false; _syncLegacy()
              return reply(`❌ *Anti-Delete PMs: OFF*`)
          } else if (['private','prvt','priv'].includes(_sub)) {
              _ad.pm.enabled = true; _ad.pm.mode = 'private'; _syncLegacy()
              return reply(`╔══〔 🔒 ANTI DELETE: PMs 〕══╗\n║ 📨 *Mode* : PRIVATE\n║ Deleted PMs sent to your DM only\n╚═══════════════════════╝`)
          } else if (['chat','cht'].includes(_sub)) {
              _ad.pm.enabled = true; _ad.pm.mode = 'chat'; _syncLegacy()
              return reply(`╔══〔 💬 ANTI DELETE: PMs 〕══╗\n║ 📨 *Mode* : CHAT\n║ Deleted PMs shown in same chat\n╚═══════════════════════╝`)
          } else if (['both','all'].includes(_sub)) {
              _ad.pm.enabled = true; _ad.pm.mode = 'both'; _syncLegacy()
              return reply(`╔══〔 📢 ANTI DELETE: PMs 〕══╗\n║ 📨 *Mode* : BOTH\n║ Deleted PMs → DM + Same chat\n╚═══════════════════════╝`)
          } else {
              return reply(`╔══〔 🛡 ANTI DELETE — PMS 〕══╗\n\n║ ${prefix}antidelete pm on/off\n║ ${prefix}antidelete pm private/chat/both\n╚═══════════════════════╝`)
          }
      }