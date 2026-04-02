const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { assignMissingRosterNumbers } = require('../lib/jerseyNumbers');

test('assignMissingRosterNumbers fills only missing numbers and keeps existing ones', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER,
      number INTEGER,
      status TEXT DEFAULT 'active'
    );
  `);

  db.prepare('INSERT INTO players (team_id, number, status) VALUES (?, ?, ?)').run(1, 12, 'active');
  db.prepare('INSERT INTO players (team_id, number, status) VALUES (?, ?, ?)').run(1, null, 'active');
  db.prepare('INSERT INTO players (team_id, number, status) VALUES (?, ?, ?)').run(1, null, 'active');
  db.prepare('INSERT INTO players (team_id, number, status) VALUES (?, ?, ?)').run(2, 12, 'active');
  db.prepare('INSERT INTO players (team_id, number, status) VALUES (?, ?, ?)').run(2, null, 'inactive');

  const updated = assignMissingRosterNumbers(db);
  const players = db.prepare('SELECT id, team_id, number, status FROM players ORDER BY id').all();

  assert.equal(updated, 2);
  assert.equal(players[0].number, 12);
  assert.ok(players[1].number >= 1 && players[1].number <= 99);
  assert.ok(players[2].number >= 1 && players[2].number <= 99);
  assert.notEqual(players[1].number, players[2].number);
  assert.notEqual(players[1].number, 12);
  assert.notEqual(players[2].number, 12);
  assert.equal(players[3].number, 12);
  assert.equal(players[4].number, null);

  db.close();
});
