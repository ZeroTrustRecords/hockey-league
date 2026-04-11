const Database = require('better-sqlite3');

const dbPath = process.env.HOCKEY_DB_PATH || '/data/hockey_league.db';
const db = new Database(dbPath);

const merges = [
  { source: 258, target: 193 },
  { source: 268, target: 175 },
  { source: 254, target: 199, rename: { first_name: 'Jean Marc', last_name: 'Lebouthillier' } },
  { source: 265, target: 191 },
  { source: 266, target: 220 },
  { source: 247, target: 186 },
  { source: 246, target: 224 },
  { source: 257, target: 240 },
  { source: 248, target: 233, rename: { first_name: 'Maxime', last_name: 'Duchesnaux' } },
  { source: 270, target: 206, rename: { first_name: 'Emile', last_name: 'Poulin' } },
];

const getPlayer = db.prepare('SELECT id, first_name, last_name FROM players WHERE id = ?');
const sourceStats = db.prepare('SELECT * FROM player_season_stats WHERE player_id = ?');
const getTargetStat = db.prepare(`
  SELECT * FROM player_season_stats
  WHERE player_id = ? AND season_id = ? AND stat_type = ?
`);
const insertStat = db.prepare(`
  INSERT INTO player_season_stats
    (player_id, season_id, stat_type, team_id, team_name, games_played, goals, assists, points, pim)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const updateStat = db.prepare(`
  UPDATE player_season_stats
  SET team_id = ?, team_name = ?, games_played = ?, goals = ?, assists = ?, points = ?, pim = ?
  WHERE id = ?
`);
const deleteSourceStats = db.prepare('DELETE FROM player_season_stats WHERE player_id = ?');

function moveSimpleRef(table, column, source, target) {
  return db.prepare(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`).run(target, source).changes;
}

function moveUniqueRef(table, uniqueCols, source, target) {
  const rows = db.prepare(`SELECT * FROM ${table} WHERE player_id = ?`).all(source);
  let moved = 0;
  let removed = 0;

  for (const row of rows) {
    const where = uniqueCols.map((col) => `${col} = ?`).join(' AND ');
    const params = uniqueCols.map((col) => row[col]);
    const existing = db.prepare(`
      SELECT id FROM ${table}
      WHERE ${where} AND player_id = ?
    `).get(...params, target);

    if (existing) {
      db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(row.id);
      removed += 1;
    } else {
      db.prepare(`UPDATE ${table} SET player_id = ? WHERE id = ?`).run(target, row.id);
      moved += 1;
    }
  }

  return { moved, removed };
}

const transaction = db.transaction(() => {
  const results = [];

  for (const merge of merges) {
    const source = getPlayer.get(merge.source);
    const target = getPlayer.get(merge.target);

    if (!source || !target) {
      results.push({ source: merge.source, target: merge.target, skipped: true });
      continue;
    }

    let insertedStats = 0;
    let updatedStats = 0;

    for (const stat of sourceStats.all(merge.source)) {
      const existing = getTargetStat.get(merge.target, stat.season_id, stat.stat_type);

      if (!existing) {
        insertStat.run(
          merge.target,
          stat.season_id,
          stat.stat_type,
          stat.team_id,
          stat.team_name,
          stat.games_played,
          stat.goals,
          stat.assists,
          stat.points,
          stat.pim
        );
        insertedStats += 1;
      } else {
        updateStat.run(
          existing.team_id || stat.team_id,
          existing.team_name || stat.team_name,
          Math.max(existing.games_played || 0, stat.games_played || 0),
          Math.max(existing.goals || 0, stat.goals || 0),
          Math.max(existing.assists || 0, stat.assists || 0),
          Math.max(existing.points || 0, stat.points || 0),
          Math.max(existing.pim || 0, stat.pim || 0),
          existing.id
        );
        updatedStats += 1;
      }
    }

    deleteSourceStats.run(merge.source);

    const attendance = moveUniqueRef('attendance', ['match_id'], merge.source, merge.target);
    const draftPicks = moveUniqueRef('draft_picks', ['team_id'], merge.source, merge.target);
    const goalsScorer = moveSimpleRef('goals', 'scorer_id', merge.source, merge.target);
    const goalsA1 = moveSimpleRef('goals', 'assist1_id', merge.source, merge.target);
    const goalsA2 = moveSimpleRef('goals', 'assist2_id', merge.source, merge.target);
    const homeGoalie = moveSimpleRef('matches', 'home_goalie_id', merge.source, merge.target);
    const awayGoalie = moveSimpleRef('matches', 'away_goalie_id', merge.source, merge.target);
    const mvp = moveSimpleRef('matches', 'mvp_id', merge.source, merge.target);
    const userRefs = moveSimpleRef('users', 'player_id', merge.source, merge.target);

    if (merge.rename) {
      db.prepare(`
        UPDATE players
        SET first_name = ?, last_name = ?
        WHERE id = ?
      `).run(merge.rename.first_name, merge.rename.last_name, merge.target);
    }

    db.prepare('DELETE FROM players WHERE id = ?').run(merge.source);

    results.push({
      source: `${source.first_name} ${source.last_name}`,
      target: `${merge.rename?.first_name || target.first_name} ${merge.rename?.last_name || target.last_name}`,
      insertedStats,
      updatedStats,
      attendance,
      draftPicks,
      goalsScorer,
      goalsA1,
      goalsA2,
      homeGoalie,
      awayGoalie,
      mvp,
      userRefs,
    });
  }

  return results;
});

const results = transaction();
console.log(JSON.stringify(results, null, 2));
