const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../lib/auditLog');

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function scheduleGame1(db, seriesId, daysFromNow = 1) {
  const series = db.prepare('SELECT * FROM playoff_series WHERE id = ?').get(seriesId);
  if (!series || series.status !== 'active' || !series.team1_id || !series.team2_id) return;
  const existing = db.prepare("SELECT id FROM matches WHERE playoff_series_id = ? AND status = 'scheduled'").get(seriesId);
  if (existing) return;
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
      INSERT OR REPLACE INTO player_season_stats (player_id, season_id, stat_type, team_id, games_played, goals, assists, points)
      VALUES (?, ?, 'regular', ?, ?, ?, ?, ?)
    `).run(player.id, seasonId, player.team_id, stats.gp, stats.goals||0, stats.assists||0, (stats.goals||0)+(stats.assists||0));
  }
}

function isRegularSeasonReadyForPlayoffs(counts) {
  return Boolean(
    counts &&
    counts.total_games > 0 &&
    Number(counts.scheduled_games || 0) === 0 &&
    Number(counts.pending_validation_games || 0) === 0
  );
}

function getRegularSeasonCounts(db, seasonId) {
  return db.prepare(`
    SELECT
      COUNT(*) AS total_games,
      SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) AS scheduled_games,
      SUM(CASE WHEN status = 'completed' AND validated = 0 THEN 1 ELSE 0 END) AS pending_validation_games
    FROM matches
    WHERE season_id = ? AND is_playoff = 0
  `).get(seasonId);
}

function buildPreviewSeries(standings) {
  if (!standings || standings.length < 6) return [];
  const seeds = standings.slice(0, 6);

  return [
    {
      id: 'preview-r1-s1',
      round: 1,
      series_number: 1,
      best_of: 1,
      status: 'preview',
      wins1: 0,
      wins2: 0,
      winner_id: null,
      team1_id: seeds[0].team_id,
      team1_name: seeds[0].team_name,
      team1_color: seeds[0].team_color,
      team2_id: seeds[1].team_id,
      team2_name: seeds[1].team_name,
      team2_color: seeds[1].team_color,
      games: [],
    },
    {
      id: 'preview-r1-s2',
      round: 1,
      series_number: 2,
      best_of: 1,
      status: 'preview',
      wins1: 0,
      wins2: 0,
      winner_id: null,
      team1_id: seeds[2].team_id,
      team1_name: seeds[2].team_name,
      team1_color: seeds[2].team_color,
      team2_id: seeds[5].team_id,
      team2_name: seeds[5].team_name,
      team2_color: seeds[5].team_color,
      games: [],
    },
    {
      id: 'preview-r1-s3',
      round: 1,
      series_number: 3,
      best_of: 1,
      status: 'preview',
      wins1: 0,
      wins2: 0,
      winner_id: null,
      team1_id: seeds[3].team_id,
      team1_name: seeds[3].team_name,
      team1_color: seeds[3].team_color,
      team2_id: seeds[4].team_id,
      team2_name: seeds[4].team_name,
      team2_color: seeds[4].team_color,
      games: [],
    },
    {
      id: 'preview-r2-s1',
      round: 2,
      series_number: 1,
      best_of: 1,
      status: 'pending',
      wins1: 0,
      wins2: 0,
      winner_id: null,
      team1_id: null,
      team1_name: null,
      team1_color: null,
      team2_id: null,
      team2_name: null,
      team2_color: null,
      games: [],
    },
    {
      id: 'preview-r2-s2',
      round: 2,
      series_number: 2,
      best_of: 1,
      status: 'pending',
      wins1: 0,
      wins2: 0,
      winner_id: null,
      team1_id: null,
      team1_name: null,
      team1_color: null,
      team2_id: null,
      team2_name: null,
      team2_color: null,
      games: [],
    },
    {
      id: 'preview-r3-s1',
      round: 3,
      series_number: 1,
      best_of: 1,
      status: 'pending',
      wins1: 0,
      wins2: 0,
      winner_id: null,
      team1_id: null,
      team1_name: null,
      team1_color: null,
      team2_id: null,
      team2_name: null,
      team2_color: null,
      games: [],
    },
    {
      id: 'preview-r3-s2',
      round: 3,
      series_number: 2,
      best_of: 1,
      status: 'pending',
      wins1: 0,
      wins2: 0,
      winner_id: null,
      team1_id: null,
      team1_name: null,
      team1_color: null,
      team2_id: null,
      team2_name: null,
      team2_color: null,
      games: [],
    },
    {
      id: 'preview-r4-s1',
      round: 4,
      series_number: 1,
      best_of: 3,
      status: 'pending',
      wins1: 0,
      wins2: 0,
      winner_id: null,
      team1_id: null,
      team1_name: null,
      team1_color: null,
      team2_id: null,
      team2_name: null,
      team2_color: null,
      games: [],
    },
  ];
}

/**
 * Recalculate a series after a game is validated.
 * Handles BOTH winner progression (next_series_id) and loser progression
 * (next_loser_series_id) so the backdoor bracket fills automatically.
 */
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
  if (wins1 < need && wins2 < need) return; // Series not over yet

  const winnerId = wins1 >= need ? series.team1_id : series.team2_id;
  const loserId  = wins1 >= need ? series.team2_id : series.team1_id;
  db.prepare("UPDATE playoff_series SET winner_id=?, status='completed' WHERE id=?").run(winnerId, seriesId);

  // ── Winner routing ──────────────────────────────────────────────────────────
  if (series.next_series_id) {
    const col = series.next_series_slot === 1 ? 'team1_id' : 'team2_id';
    db.prepare(`UPDATE playoff_series SET ${col}=? WHERE id=?`).run(winnerId, series.next_series_id);
    const next = db.prepare('SELECT * FROM playoff_series WHERE id=?').get(series.next_series_id);
    if (next.team1_id && next.team2_id) {
      db.prepare("UPDATE playoff_series SET status='active' WHERE id=?").run(series.next_series_id);
      scheduleGame1(db, series.next_series_id);
    }
  } else {
    // No next series → this is the Final; crown champion
    db.prepare("UPDATE seasons SET champion_team_id=?, status='completed' WHERE id=?").run(winnerId, series.season_id);
  }

  // ── Loser routing (backdoor bracket) ───────────────────────────────────────
  if (series.next_loser_series_id && loserId) {
    const col = series.next_loser_slot === 1 ? 'team1_id' : 'team2_id';
    db.prepare(`UPDATE playoff_series SET ${col}=? WHERE id=?`).run(loserId, series.next_loser_series_id);
    const next = db.prepare('SELECT * FROM playoff_series WHERE id=?').get(series.next_loser_series_id);
    if (next.team1_id && next.team2_id) {
      db.prepare("UPDATE playoff_series SET status='active' WHERE id=?").run(series.next_loser_series_id);
      scheduleGame1(db, series.next_loser_series_id);
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
  if (seriesWithGames.length > 0) {
    return res.json({ season, series: seriesWithGames, is_preview: false, playoffs_coming_soon: false });
  }

  const regularSeasonCounts = getRegularSeasonCounts(db, seasonId);
  const readyForPlayoffs = season.status === 'active' && isRegularSeasonReadyForPlayoffs(regularSeasonCounts);
  if (!readyForPlayoffs) {
    return res.json({ season, series: [], is_preview: false, playoffs_coming_soon: false });
  }

  const previewSeries = buildPreviewSeries(computeStandings(db, seasonId));
  return res.json({
    season,
    series: previewSeries,
    is_preview: true,
    playoffs_coming_soon: true,
  });
});

// POST /playoffs/season/:seasonId/start
router.post('/season/:seasonId/start', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const seasonId = parseInt(req.params.seasonId);

  const season = db.prepare('SELECT * FROM seasons WHERE id=?').get(seasonId);
  if (!season) return res.status(404).json({ error: 'Saison introuvable' });
  if (season.status === 'playoffs') return res.status(400).json({ error: 'Séries déjà démarrées' });
  if (season.status === 'completed') return res.status(400).json({ error: 'Saison terminée' });

  const regularSeasonCounts = getRegularSeasonCounts(db, seasonId);

  if (!regularSeasonCounts.total_games) {
    return res.status(400).json({ error: 'Aucun match de saison reguliere n est disponible pour demarrer les series' });
  }

  if (!isRegularSeasonReadyForPlayoffs(regularSeasonCounts)) {
    return res.status(400).json({
      error: 'La saison reguliere doit etre completement jouee et validee avant de demarrer les series',
    });
  }

  const standings = computeStandings(db, seasonId);
  if (standings.length < 6) return res.status(400).json({ error: 'Il faut au moins 6 équipes classées pour démarrer les séries' });

  archiveSeasonStats(db, seasonId);

  const seeds = standings.slice(0, 6); // Top 6 by standings
  db.prepare('DELETE FROM playoff_series WHERE season_id=?').run(seasonId);

  const ins = db.prepare(`
    INSERT INTO playoff_series (season_id, round, series_number, team1_id, team2_id, status, best_of)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // ── Round 1 — Semaine playoff 1 (single games, teams known) ────────────────
  // M1: 1er vs 2e
  const r1s1 = ins.run(seasonId, 1, 1, seeds[0].team_id, seeds[1].team_id, 'active', 1);
  // M2: 3e vs 6e
  const r1s2 = ins.run(seasonId, 1, 2, seeds[2].team_id, seeds[5].team_id, 'active', 1);
  // M3: 4e vs 5e
  const r1s3 = ins.run(seasonId, 1, 3, seeds[3].team_id, seeds[4].team_id, 'active', 1);

  // ── Round 2 — Semaine playoff 2, phase croisée (teams TBD) ─────────────────
  // M4: G2 (winner M2) vs P3 (loser M3)
  const r2s1 = ins.run(seasonId, 2, 1, null, null, 'pending', 1);
  // M5: P2 (loser M2) vs G3 (winner M3)
  const r2s2 = ins.run(seasonId, 2, 2, null, null, 'pending', 1);

  // ── Round 3 — Demi-finales (teams TBD) ─────────────────────────────────────
  // M6: G1 (winner M1) vs G5 (winner M5)  — Demi-finale A
  const r3s1 = ins.run(seasonId, 3, 1, null, null, 'pending', 1);
  // M7: P1 (loser M1) vs G4 (winner M4)  — Demi-finale B
  const r3s2 = ins.run(seasonId, 3, 2, null, null, 'pending', 1);

  // ── Round 4 — Finale (best-of-3, need 2 wins) ──────────────────────────────
  // M8/M9: G6 (winner M6) vs G7 (winner M7)
  const r4s1 = ins.run(seasonId, 4, 1, null, null, 'pending', 3);

  const [id1, id2, id3, id4, id5, id6, id7, id8] =
    [r1s1, r1s2, r1s3, r2s1, r2s2, r3s1, r3s2, r4s1].map(r => r.lastInsertRowid);

  // ── Wire bracket progressions ───────────────────────────────────────────────
  const wire = db.prepare(`
    UPDATE playoff_series
    SET next_series_id=?, next_series_slot=?, next_loser_series_id=?, next_loser_slot=?
    WHERE id=?
  `);
  // M1 (1v2): winner → SF-A slot1, loser → SF-B slot1
  wire.run(id6, 1, id7, 1, id1);
  // M2 (3v6): winner → Cross-A slot1, loser → Cross-B slot1
  wire.run(id4, 1, id5, 1, id2);
  // M3 (4v5): winner → Cross-B slot2, loser → Cross-A slot2
  wire.run(id5, 2, id4, 2, id3);
  // M4 (G2vP3): winner → SF-B slot2, no loser path (eliminated)
  db.prepare('UPDATE playoff_series SET next_series_id=?, next_series_slot=? WHERE id=?').run(id7, 2, id4);
  // M5 (P2vG3): winner → SF-A slot2, no loser path (eliminated)
  db.prepare('UPDATE playoff_series SET next_series_id=?, next_series_slot=? WHERE id=?').run(id6, 2, id5);
  // M6 SF-A: winner → Final slot1
  db.prepare('UPDATE playoff_series SET next_series_id=?, next_series_slot=? WHERE id=?').run(id8, 1, id6);
  // M7 SF-B: winner → Final slot2
  db.prepare('UPDATE playoff_series SET next_series_id=?, next_series_slot=? WHERE id=?').run(id8, 2, id7);

  db.prepare("UPDATE seasons SET status='playoffs' WHERE id=?").run(seasonId);

  // Auto-schedule Round 1 games (staggered by a few days)
  scheduleGame1(db, id1, 7);
  scheduleGame1(db, id2, 9);
  scheduleGame1(db, id3, 11);

  logAudit(db, {
    user_id: req.user.id,
    username: req.user.username,
    action: 'playoffs.started',
    entity_type: 'season',
    entity_id: seasonId,
    details: { seeds: seeds.map(seed => ({ team_id: seed.team_id, pts: seed.pts })) },
  });

  res.json({ message: 'Séries éliminatoires démarrées — nouveau format 6 équipes' });
});

// POST /playoffs/series/:seriesId/game — manually schedule next game
router.post('/series/:seriesId/game', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const series = db.prepare('SELECT * FROM playoff_series WHERE id=?').get(req.params.seriesId);
  if (!series) return res.status(404).json({ error: 'Série introuvable' });
  if (series.status !== 'active') return res.status(400).json({ error: 'Série non active' });

  const need = Math.ceil(series.best_of / 2);
  if (series.wins1 >= need || series.wins2 >= need) return res.status(400).json({ error: 'Série déjà gagnée' });

  const { date, location = 'Aréna Municipal' } = req.body;
  const gameCount = db.prepare('SELECT COUNT(*) as c FROM matches WHERE playoff_series_id=?').get(series.id).c;
  const homeId = gameCount % 2 === 0 ? series.team1_id : series.team2_id;
  const awayId = gameCount % 2 === 0 ? series.team2_id : series.team1_id;

  const result = db.prepare(`
    INSERT INTO matches (home_team_id, away_team_id, date, location, status, season_id, is_playoff, playoff_series_id)
    VALUES (?, ?, ?, ?, 'scheduled', ?, 1, ?)
  `).run(homeId, awayId, date, location, series.season_id, series.id);

  res.json({ id: result.lastInsertRowid });
});

router.recalcSeries = recalcSeries;
router.isRegularSeasonReadyForPlayoffs = isRegularSeasonReadyForPlayoffs;
module.exports = router;
