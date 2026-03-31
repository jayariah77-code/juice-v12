'use strict';
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'panel.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id          INTEGER PRIMARY KEY DEFAULT 1,
    botName     TEXT    NOT NULL DEFAULT 'Juice v12',
    ownerNumber TEXT    NOT NULL DEFAULT '254753204154',
    botPrefix   TEXT    NOT NULL DEFAULT '.',
    welcome     INTEGER NOT NULL DEFAULT 1,
    antiLink    INTEGER NOT NULL DEFAULT 0,
    antiCall    INTEGER NOT NULL DEFAULT 0,
    autoRead    INTEGER NOT NULL DEFAULT 0,
    chatBot     INTEGER NOT NULL DEFAULT 0,
    autoViewStatus  INTEGER NOT NULL DEFAULT 1,
    autoLikeStatus  INTEGER NOT NULL DEFAULT 0,
    autoReact       INTEGER NOT NULL DEFAULT 0,
    autoReactEmoji  TEXT    NOT NULL DEFAULT '🔥',
    pmBlocker       INTEGER NOT NULL DEFAULT 0,
    antiBadword     INTEGER NOT NULL DEFAULT 0,
    antiTag         INTEGER NOT NULL DEFAULT 0,
    antiDelete      INTEGER NOT NULL DEFAULT 0,
    timezone    TEXT    NOT NULL DEFAULT 'Africa/Nairobi',
    repoUrl     TEXT    NOT NULL DEFAULT 'https://github.com/jayariah77-code/juice-v12'
  );
  INSERT OR IGNORE INTO settings (id) VALUES (1);
`);

function getSettings() {
  return db.prepare('SELECT * FROM settings WHERE id = 1').get();
}

function updateSettings(data) {
  const allowed = [
    'botName','ownerNumber','botPrefix','welcome','antiLink','antiCall',
    'autoRead','chatBot','autoViewStatus','autoLikeStatus','autoReact',
    'autoReactEmoji','pmBlocker','antiBadword','antiTag','antiDelete',
    'timezone','repoUrl'
  ];
  const filtered = {};
  for (const k of allowed) {
    if (data[k] !== undefined) filtered[k] = data[k];
  }
  if (Object.keys(filtered).length === 0) return getSettings();
  const sets = Object.keys(filtered).map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE settings SET ${sets} WHERE id = 1`).run(filtered);
  return getSettings();
}

module.exports = { getSettings, updateSettings };
