const { initDB, getDB, closeDB } = require('../db');
const { seedPastSeasonStats } = require('../lib/pastSeasonStats');

function main() {
  initDB();
  const db = getDB();
  const activeSeason =
    db.prepare(`SELECT * FROM seasons WHERE status = 'active' ORDER BY id DESC LIMIT 1`).get() ||
    db.prepare(`SELECT * FROM seasons ORDER BY id DESC LIMIT 1`).get() ||
    { name: '' };

  const result = seedPastSeasonStats(db, activeSeason);
  console.log(JSON.stringify(result));
  closeDB();
}

main();
