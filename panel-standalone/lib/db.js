const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(path.join(DB_DIR, 'panel.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    botName TEXT DEFAULT 'Juice v12',
    ownerNumber TEXT DEFAULT '254753204154',
    botPrefix TEXT DEFAULT '.',
    welcome INTEGER DEFAULT 1,
    antiLink INTEGER DEFAULT 0,
    antiCall INTEGER DEFAULT 0,
    autoRead INTEGER DEFAULT 0,
    chatBot INTEGER DEFAULT 0,
    autoViewStatus INTEGER DEFAULT 1,
    autoLikeStatus INTEGER DEFAULT 0,
    autoReact INTEGER DEFAULT 0,
    autoReactEmoji TEXT DEFAULT '🔥',
    pmBlocker INTEGER DEFAULT 0,
    antiBadword INTEGER DEFAULT 0,
    antiTag INTEGER DEFAULT 0,
    antiDelete INTEGER DEFAULT 0,
    timezone TEXT DEFAULT 'Africa/Nairobi',
    repoUrl TEXT DEFAULT 'https://github.com/jayariah77-code/juice-v12'
  );
  INSERT OR IGNORE INTO settings (id) VALUES (1);
`);

function getSettings() {
  return db.prepare('SELECT * FROM settings WHERE id = 1').get();
}

function updateSettings(data) {
  const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE settings SET ${fields} WHERE id = 1`).run(data);
  return getSettings();
}

module.exports = { getSettings, updateSettings };
