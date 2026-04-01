const fs = require('fs');
const path = require('path');
const { getConfig } = require('../config');
const { ensureDir } = require('./logger');

const TABLE_INSERT_ORDER = [
  'seasons',
  'teams',
  'players',
  'users',
  'team_staff',
  'player_season_stats',
  'draft_settings',
  'draft_picks',
  'playoff_series',
  'matches',
  'goals',
  'messages',
  'message_reads',
  'attendance',
  'audit_logs',
];

const TABLE_DELETE_ORDER = [...TABLE_INSERT_ORDER].reverse();

function buildBackupSnapshot(db) {
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    tables: {
      seasons: db.prepare('SELECT * FROM seasons ORDER BY id').all(),
      teams: db.prepare('SELECT * FROM teams ORDER BY id').all(),
      players: db.prepare('SELECT * FROM players ORDER BY id').all(),
      users: db.prepare('SELECT * FROM users ORDER BY id').all(),
      team_staff: db.prepare('SELECT * FROM team_staff ORDER BY id').all(),
      matches: db.prepare('SELECT * FROM matches ORDER BY id').all(),
      goals: db.prepare('SELECT * FROM goals ORDER BY id').all(),
      messages: db.prepare('SELECT * FROM messages ORDER BY id').all(),
      message_reads: db.prepare('SELECT * FROM message_reads ORDER BY id').all(),
      attendance: db.prepare('SELECT * FROM attendance ORDER BY id').all(),
      playoff_series: db.prepare('SELECT * FROM playoff_series ORDER BY id').all(),
      draft_settings: db.prepare('SELECT * FROM draft_settings ORDER BY id').all(),
      draft_picks: db.prepare('SELECT * FROM draft_picks ORDER BY id').all(),
      player_season_stats: db.prepare('SELECT * FROM player_season_stats ORDER BY id').all(),
      audit_logs: db.prepare('SELECT * FROM audit_logs ORDER BY id').all(),
    },
  };
}

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('Snapshot invalide');
  if (!snapshot.tables || typeof snapshot.tables !== 'object') throw new Error('Le snapshot ne contient pas de tables');

  for (const tableName of TABLE_INSERT_ORDER) {
    if (!Array.isArray(snapshot.tables[tableName])) {
      throw new Error(`Table manquante dans le snapshot: ${tableName}`);
    }
  }
}

function insertRows(db, tableName, rows) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  const placeholders = columns.map((column) => `@${column}`).join(', ');
  const statement = db.prepare(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`);
  for (const row of rows) {
    statement.run(row);
  }
}

function restoreBackupSnapshot(db, snapshot) {
  validateSnapshot(snapshot);

  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    TABLE_DELETE_ORDER.forEach((tableName) => {
      db.prepare(`DELETE FROM ${tableName}`).run();
    });
    try {
      db.prepare('DELETE FROM sqlite_sequence').run();
    } catch {}

    TABLE_INSERT_ORDER.forEach((tableName) => {
      insertRows(db, tableName, snapshot.tables[tableName]);
    });
  })();
  db.pragma('foreign_keys = ON');
}

function writeBackupFile(snapshot) {
  const { backupDir } = getConfig();
  ensureDir(backupDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `lhma-backup-${timestamp}.json`;
  const filePath = path.join(backupDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf8');
  return { filename, filePath };
}

function listBackupFiles() {
  const { backupDir } = getConfig();
  ensureDir(backupDir);
  return fs.readdirSync(backupDir)
    .filter(name => name.endsWith('.json'))
    .map(name => {
      const filePath = path.join(backupDir, name);
      const stat = fs.statSync(filePath);
      return {
        filename: name,
        size: stat.size,
        created_at: stat.birthtime.toISOString(),
        updated_at: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

function readBackupFile(filename) {
  const { backupDir } = getConfig();
  const safeName = path.basename(filename);
  const filePath = path.join(backupDir, safeName);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

module.exports = {
  buildBackupSnapshot,
  restoreBackupSnapshot,
  writeBackupFile,
  listBackupFiles,
  readBackupFile,
};
