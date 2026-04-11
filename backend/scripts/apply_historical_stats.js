const { initDB, getDB, closeDB } = require('../db');
const { seedPastSeasonStats } = require('../lib/pastSeasonStats');

function main() {
  initDB();
  const db = getDB();
  db.prepare(`
    DELETE FROM player_season_stats
    WHERE season_id IN (SELECT id FROM seasons WHERE name GLOB '?T? -*')
  `).run();
  db.prepare(`DELETE FROM seasons WHERE name GLOB '?T? -*'`).run();
  const activeSeason =
    db.prepare(`SELECT * FROM seasons WHERE status = 'active' ORDER BY id DESC LIMIT 1`).get() ||
    db.prepare(`SELECT * FROM seasons ORDER BY id DESC LIMIT 1`).get() ||
    { name: '' };

  const result = seedPastSeasonStats(db, activeSeason);
  console.log(JSON.stringify(result));
  closeDB();
}

main();
