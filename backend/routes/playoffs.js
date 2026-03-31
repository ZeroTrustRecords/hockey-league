const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function scheduleGame1(db, seriesId, daysFromNow = 1) {
  const series = db.prepare('SELECT * FROM playoff_series WHERE id = ?').get(seriesId);
  if (!series || series.status !== 'active' || !series.team1_id || !series.team2_id) return;
  const existing = db.prepare("SELECT id FROM matches WHERE playoff_series_id = ? AND status = 'scheduled'").get(seriesId);
  if (existing) return; // game already scheduled
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  db.prepare(`
    INSERT INTO matches (home_team_id, away_team_id, date, location, status, season_id, is_playoff, playoff_series_id)
    VALUES (?, ?, ?, 'Aréna Municipal', 'scheduled', ?, 1, ?)
  `).run(series.team1_id, series.team2_id, d.toISOString().slice(0, 10) + ' 21:00', series.season_id, seriesId);
}

function computeStandings(db, seasonId) {
  const teams = db.prepare('SELECT * FROM teams').all();
  return teams.map(team => {
    const matches = db.prepare(`
      SELECT * FROM matches
      WHERE (home_team_id=? OR away_team_id=?) AND validated=1 AND season_id=? AND is_playoff=0
    `).all(team.id, team.id, seasonId);
    let w=0, l=0, pts=0, gf=0, ga=0;
    for (const m of matches) {
      const isHome = m.home_team_id === team.id;
      const ts = isHome ? m.home_score : m.away_score;
      const os = isHome ? m.away_score : m.home_score;
      gf+=ts; ga+=os;
      if (ts > os) { w++; pts+=2; } else { l++; }
    }
    return { team_id: team.id, team_name: team.name, team_color: team.color, pts, w, l, gf, ga, diff: gf-ga };
  }).sort((a,b) => b.pts - a.pts || b.diff - a.diff || b.gf - a.gf);
}

function archiveSeasonStats(db, seasonId) {
  const players = db.prepare("SELECT * FROM players WHERE status='active'").all();
  for (const player of players) {
    const stats = db.prepare(`
      SELECT
        COUNT(DISTINCT m.id) as gp,
        SUM(CASE WHEN g.scorer_id=? THEN 1 ELSE 0 END) as goals,
        SUM(CASE WHEN g.assist1_id=? OR g.assist2_id=? THEN 1 ELSE 0 END) as assists
      FROM goals g
      INNER JOIN matches m ON g.match_id=m.id
      WHERE m.validated=1 AND m.season_id=? AND m.is_playoff=0
        AND (g.scorer_id=? OR g.assist1_id=? OR g.assist2_id=?)
    `).get(player.id, player.id, player.id, seasonId, player.id, player.id, player.id);
    if (!stats || stats.gp === 0) continue;
    db.prepare(`
      INSERT OR REPLACE INTO player_season_stats (player_id, season_id, team_id, games_played, goals, assists, points)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(player.id, seasonId, player.team_id, stats.gp, stats.goals||0, stats.assists||0, (stats.goals||0)+(stats.assists||0));
  }
}

function recalcSeries(db, seriesId) {
  const series = db.prepare('SELECT * FROM playoff_series WHERE id=?').get(seriesId);
  if (!series || series.status === 'completed') return;

  const games = db.prepare('SELECT * FROM matches WHERE playoff_series_id=? AND validated=1').all(seriesId);
  let wins1=0, wins2=0;
  for (const g of games) {
    const isHome1 = g.home_team_id === series.team1_id;
    const s1 = isHome1 ? g.home_score : g.away_score;
    const s2 = isHome1 ? g.away_score : g.home_score;
    if (s1 > s2) wins1++; else wins2++;
  }
  db.prepare('UPDATE playoff_series SET wins1=?, wins2=? WHERE id=?').run(wins1, wins2, seriesId);

  const need = Math.ceil(series.best_of / 2);
  if (wins1 >= need || wins2 >= need) {
    const winnerId = wins1 >= need ? series.team1_id : series.team2_id;
    db.prepare("UPDATE playoff_series SET winner_id=?, status='completed' WHERE id=?").run(winnerId, seriesId);

    if (series.next_series_id) {
      const col = series.next_series_slot === 1 ? 'team1_id' : 'team2_id';
      db.prepare(`UPDATE playoff_series SET ${col}=? WHERE id=?`).run(winnerId, series.next_series_id);
      const next = db.prepare('SELECT * FROM playoff_series WHERE id=?').get(series.next_series_id);
      if (next.team1_id && next.team2_id) {
        db.prepare("UPDATE playoff_series SET status='active' WHERE id=?").run(series.next_series_id);
        // Auto-schedule Game 1 for newly activated series
        scheduleGame1(db, series.next_series_id);
      }
    } else {
      // This is the Final — set champion
      db.prepare("UPDATE seasons SET champion_team_id=?, status='completed' WHERE id=?").run(winnerId, series.season_id);
    }
  }
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────

// GET /playoffs/season/:seasonId
router.get('/season/:seasonId', (req, res) => {
  const db = getDB();
  const seasonId = req.params.seasonId;

  const season = db.prepare('SELECT s.*, t.name as champion_name, t.color as champion_color FROM seasons s LEFT JOIN teams t ON s.champion_team_id = t.id WHERE s.id=?').get(seasonId);
  if (!season) return res.status(404).json({ error: 'Saison introuvable' });

  const series = db.prepare(`
    SELECT ps.*,
      t1.name as team1_name, t1.color as team1_color,
      t2.name as team2_name, t2.color as team2_color,
      tw.name as winner_name, tw.color as winner_color
    FROM playoff_series ps
    LEFT JOIN teams t1 ON ps.team1_id = t1.id
    LEFT JOIN teams t2 ON ps.team2_id = t2.id
    LEFT JOIN teams tw ON ps.winner_id = tw.id
    WHERE ps.season_id = ?
    ORDER BY ps.round, ps.series_number
  `).all(seasonId);

  const seriesWithGames = series.map(s => {
    const games = db.prepare(`
      SELECT m.*, ht.name as home_team_name, at2.name as away_team_name
      FROM matches m
      INNER JOIN teams ht ON m.home_team_id = ht.id
      INNER JOIN teams at2 ON m.away_team_id = at2.id
      WHERE m.playoff_series_id = ?
      ORDER BY m.date
    `).all(s.id);
    return { ...s, games };
  });

  res.json({ season, series: seriesWithGames });
});

// POST /playoffs/season/:seasonId/start
router.post('/season/:seasonId/start', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const seasonId = parseInt(req.params.seasonId);

  const season = db.prepare('SELECT * FROM seasons WHERE id=?').get(seasonId);
  if (!season) return res.status(404).json({ error: 'Saison introuvable' });
  if (season.status === 'playoffs') return res.status(400).json({ error: 'Séries déjà démarrées' });
  if (season.status === 'completed') return res.status(400).json({ error: 'Saison terminée' });

  const standings = computeStandings(db, seasonId);
  if (standings.length < 4) return res.status(400).json({ error: 'Pas assez d\'équipes classées (min. 4)' });

  archiveSeasonStats(db, seasonId);

  const seeds = standings.slice(0, Math.min(6, standings.length));
  db.prepare('DELETE FROM playoff_series WHERE season_id=?').run(seasonId);

  const ins = db.prepare(`
    INSERT INTO playoff_series (season_id, round, series_number, team1_id, team2_id, status, best_of)
    VALUES (?, ?, ?, ?, ?, ?, 3)
  `);

  // Round 1: 1v6, 2v5, 3v4 (or fewer if < 6 teams)
  const r1s1 = ins.run(seasonId, 1, 1, seeds[0].team_id, seeds[5]?.team_id ?? null, seeds[5] ? 'active' : 'pending');
  const r1s2 = ins.run(seasonId, 1, 2, seeds[1].team_id, seeds[4]?.team_id ?? null, seeds[4] ? 'active' : 'pending');
  const r1s3 = ins.run(seasonId, 1, 3, seeds[2].team_id, seeds[3]?.team_id ?? null, seeds[3] ? 'active' : 'pending');

  // Round 2: SF (W of series2 vs W of series3) — seed 1 winner has bye to Final
  const r2s1 = ins.run(seasonId, 2, 1, null, null, 'pending');

  // Round 3: Final (W of series1 vs W of SF)
  const r3s1 = ins.run(seasonId, 3, 1, null, null, 'pending');

  const [id1, id2, id3, id4, id5] = [r1s1, r1s2, r1s3, r2s1, r3s1].map(r => r.lastInsertRowid);

  // Wire up bracket progression
  db.prepare('UPDATE playoff_series SET next_series_id=?, next_series_slot=1 WHERE id=?').run(id5, id1); // W1 → Final slot 1
  db.prepare('UPDATE playoff_series SET next_series_id=?, next_series_slot=1 WHERE id=?').run(id4, id2); // W2 → SF slot 1
  db.prepare('UPDATE playoff_series SET next_series_id=?, next_series_slot=2 WHERE id=?').run(id4, id3); // W3 → SF slot 2
  db.prepare('UPDATE playoff_series SET next_series_id=?, next_series_slot=2 WHERE id=?').run(id5, id4); // WSF → Final slot 2

  db.prepare("UPDATE seasons SET status='playoffs' WHERE id=?").run(seasonId);

  // Auto-schedule Game 1 for each active Round 1 series
  scheduleGame1(db, id1, 1);
  scheduleGame1(db, id2, 3);
  scheduleGame1(db, id3, 5);

  res.json({ message: 'Séries éliminatoires démarrées' });
});

// POST /playoffs/series/:seriesId/game — Schedule a game in a series
router.post('/series/:seriesId/game', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const series = db.prepare('SELECT * FROM playoff_series WHERE id=?').get(req.params.seriesId);
  if (!series) return res.status(404).json({ error: 'Série introuvable' });
  if (series.status !== 'active') return res.status(400).json({ error: 'Série non active' });

  const need = Math.ceil(series.best_of / 2);
  if (series.wins1 >= need || series.wins2 >= need) return res.status(400).json({ error: 'Série déjà gagnée' });

  const { date, location = 'Aréna Municipal' } = req.body;
  const gameCount = db.prepare('SELECT COUNT(*) as c FROM matches WHERE playoff_series_id=?').get(series.id).c;
  // Alternate home: team1 home for games 1,3,5; team2 home for games 2,4
  const homeId = gameCount % 2 === 0 ? series.team1_id : series.team2_id;
  const awayId = gameCount % 2 === 0 ? series.team2_id : series.team1_id;

  const result = db.prepare(`
    INSERT INTO matches (home_team_id, away_team_id, date, location, status, season_id, is_playoff, playoff_series_id)
    VALUES (?, ?, ?, ?, 'scheduled', ?, 1, ?)
  `).run(homeId, awayId, date, location, series.season_id, series.id);

  res.json({ id: result.lastInsertRowid });
});

router.recalcSeries = recalcSeries;
module.exports = router;
