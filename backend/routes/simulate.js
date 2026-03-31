const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

/**
 * POST /api/simulate/season
 * Admin only. Seeds the completed "Saison 2024-2025" (season id 5) with
 * 15 validated matches + realistic goals so the player history feature
 * can be tested. Six players are "transferred" — their S5 goals are
 * attributed to a different team than the one they're currently on,
 * which lets us verify stats follow the player across seasons.
 */
router.post('/season', authenticate, requireAdmin, (req, res) => {
  const db = getDB();

  const season5 = db.prepare("SELECT id FROM seasons WHERE name = 'Saison 2024-2025'").get();
  if (!season5) return res.status(404).json({ error: 'Saison 2024-2025 introuvable' });

  const teams = db.prepare('SELECT id FROM teams ORDER BY id').all();
  const teamIds = teams.map(t => t.id);

  // All active players grouped by current team
  const playersByTeam = {};
  teamIds.forEach(tid => {
    playersByTeam[tid] = db.prepare(
      "SELECT id FROM players WHERE team_id = ? AND status = 'active' ORDER BY id"
    ).all(tid).map(p => p.id);
  });

  // Transfer map: for each team, player index 0 "played for" the next team in S5
  // e.g. Rangers[0] → had Canadiens as their S5 team
  const transfers = {};
  teamIds.forEach((tid, i) => {
    const players = playersByTeam[tid];
    if (players.length > 0) {
      const s5Team = teamIds[(i + 1) % teamIds.length];
      transfers[players[0]] = s5Team;
    }
  });

  // All 15 unique matchups among 6 teams
  const matchups = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      matchups.push([teamIds[i], teamIds[j]]);
    }
  }

  const dates = [
    '2024-09-09 21:00', '2024-09-11 21:00', '2024-09-12 20:00',
    '2024-09-16 21:00', '2024-09-18 21:00', '2024-09-19 20:00',
    '2024-09-23 21:00', '2024-09-25 21:00', '2024-09-26 20:00',
    '2024-10-02 21:00', '2024-10-03 21:00', '2024-10-07 20:00',
    '2024-10-09 21:00', '2024-10-14 21:00', '2024-10-16 20:00',
  ];

  // Deterministic score patterns (no ties)
  const scorePatterns = [
    [4, 2], [3, 1], [5, 3], [2, 1], [4, 1],
    [3, 2], [6, 4], [2, 0], [4, 3], [3, 0],
    [5, 2], [1, 0], [4, 2], [3, 1], [2, 1],
  ];

  db.transaction(() => {
    // Wipe existing season 5 matches/goals
    const old = db.prepare('SELECT id FROM matches WHERE season_id = ?').all(season5.id);
    old.forEach(m => db.prepare('DELETE FROM goals WHERE match_id = ?').run(m.id));
    db.prepare('DELETE FROM matches WHERE season_id = ?').run(season5.id);

    matchups.forEach(([home, away], idx) => {
      const [hs, as_] = scorePatterns[idx];
      const matchRow = db.prepare(`
        INSERT INTO matches (home_team_id, away_team_id, date, status, validated,
                             home_score, away_score, season_id, location)
        VALUES (?, ?, ?, 'completed', 1, ?, ?, ?, 'Aréna Municipal')
      `).run(home, away, dates[idx], hs, as_, season5.id);
      const matchId = matchRow.lastInsertRowid;

      const hp = playersByTeam[home] || [];
      const ap = playersByTeam[away] || [];

      const addGoals = (count, teamId, roster) => {
        for (let g = 0; g < count; g++) {
          const scorer  = roster[g % roster.length];
          const assist1 = roster[(g + 1) % roster.length] !== scorer
            ? roster[(g + 1) % roster.length]
            : (roster.length > 2 ? roster[(g + 2) % roster.length] : null);
          // Use transfer team if this scorer was transferred
          const goalTeam = transfers[scorer] !== undefined ? transfers[scorer] : teamId;
          db.prepare(`
            INSERT INTO goals (match_id, team_id, scorer_id, assist1_id, period)
            VALUES (?, ?, ?, ?, ?)
          `).run(matchId, goalTeam, scorer, assist1 || null, (g % 3) + 1);
        }
      };

      if (hp.length) addGoals(hs, home, hp);
      if (ap.length) addGoals(as_, away, ap);
    });
  })();

  const transferred = Object.entries(transfers).map(([playerId, s5Team]) => {
    const p = db.prepare('SELECT first_name, last_name, team_id FROM players WHERE id = ?').get(playerId);
    const currentTeam = db.prepare('SELECT name FROM teams WHERE id = ?').get(p.team_id);
    const oldTeam = db.prepare('SELECT name FROM teams WHERE id = ?').get(s5Team);
    return `${p.first_name} ${p.last_name}: ${oldTeam.name} (S5) → ${currentTeam.name} (S6)`;
  });

  res.json({
    message: '✅ Saison 2024-2025 simulée',
    matches: 15,
    transferred,
  });
});

/**
 * POST /api/simulate/current-season
 * Admin only. Validates ALL remaining scheduled regular-season matches for
 * the active season, generating goals so standings and stats are populated.
 */
router.post('/current-season', authenticate, requireAdmin, (req, res) => {
  const db = getDB();

  const season = db.prepare("SELECT * FROM seasons WHERE status = 'active'").get();
  if (!season) return res.status(400).json({ error: 'Aucune saison active trouvée' });

  const matches = db.prepare(
    "SELECT * FROM matches WHERE season_id = ? AND status = 'scheduled' AND is_playoff = 0 ORDER BY date"
  ).all(season.id);

  if (matches.length === 0)
    return res.json({ message: 'Tous les matchs de la saison sont déjà joués', matches: 0 });

  const playersByTeam = {};
  db.prepare('SELECT id FROM teams').all().forEach(t => {
    playersByTeam[t.id] = db.prepare(
      "SELECT id FROM players WHERE team_id = ? AND status = 'active' ORDER BY id"
    ).all(t.id).map(p => p.id);
  });

  // Varied score patterns — no ties, realistic variety
  const patterns = [
    [3,1],[4,2],[2,1],[5,3],[3,2],[4,1],[2,0],[3,0],[4,3],[5,2],
    [1,0],[3,1],[2,1],[4,2],[3,0],[5,1],[2,0],[4,3],[3,2],[1,0],
    [4,1],[3,2],[5,3],[2,1],[3,0],[4,2],[1,0],[3,1],[2,0],[5,2],
    [3,2],[4,1],[2,1],[5,3],[1,0],[3,0],[4,2],[2,0],[3,1],[4,3],
    [5,2],[2,1],[3,0],[4,1],[3,2],
  ];

  const addGoals = (db, matchId, count, teamId, roster) => {
    if (!roster.length) return;
    for (let g = 0; g < count; g++) {
      const scorer  = roster[g % roster.length];
      const assist1 = roster.length > 1 ? roster[(g + 1) % roster.length] : null;
      db.prepare('INSERT INTO goals (match_id, team_id, scorer_id, assist1_id, period) VALUES (?, ?, ?, ?, ?)')
        .run(matchId, teamId, scorer, assist1, (g % 3) + 1);
    }
  };

  let count = 0;
  db.transaction(() => {
    matches.forEach((match, idx) => {
      const [hs, as_] = patterns[idx % patterns.length];
      db.prepare("UPDATE matches SET status='completed', validated=1, home_score=?, away_score=? WHERE id=?")
        .run(hs, as_, match.id);
      addGoals(db, match.id, hs, match.home_team_id, playersByTeam[match.home_team_id] || []);
      addGoals(db, match.id, as_, match.away_team_id, playersByTeam[match.away_team_id] || []);
      count++;
    });
  })();

  res.json({ message: `✅ ${count} matchs simulés — ${season.name}`, matches: count });
});

/**
 * POST /api/simulate/playoffs
 * Admin only. Simulates all active playoff series to completion.
 * Requires playoffs to already be started (POST /playoffs/season/:id/start).
 * Processes round by round; each series goes to game 3 (2-1) so players
 * accumulate playoff stats that show up in their history.
 */
router.post('/playoffs', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const { recalcSeries } = require('./playoffs');

  const season = db.prepare("SELECT * FROM seasons WHERE status = 'playoffs'").get();
  if (!season) return res.status(400).json({ error: 'Aucune saison en séries éliminatoires. Démarrez les séries d\'abord.' });

  const playersByTeam = {};
  db.prepare('SELECT id FROM teams').all().forEach(t => {
    playersByTeam[t.id] = db.prepare(
      "SELECT id FROM players WHERE team_id = ? AND status = 'active' ORDER BY id"
    ).all(t.id).map(p => p.id);
  });

  const addGoals = (db, matchId, count, teamId, roster) => {
    if (!roster.length) return;
    for (let g = 0; g < count; g++) {
      const scorer  = roster[g % roster.length];
      const assist1 = roster.length > 1 ? roster[(g + 1) % roster.length] : null;
      db.prepare('INSERT INTO goals (match_id, team_id, scorer_id, assist1_id, period) VALUES (?, ?, ?, ?, ?)')
        .run(matchId, teamId, scorer, assist1, (g % 3) + 1);
    }
  };

  let gameCounter = 0;
  let totalGames  = 0;

  // Process all rounds in order (1 → 2 → 3 → 4)
  for (let round = 1; round <= 4; round++) {
    // Re-fetch series each round so bracket progression is picked up
    const allSeries = db.prepare(
      "SELECT * FROM playoff_series WHERE season_id = ? AND round = ? ORDER BY series_number"
    ).all(season.id, round);

    for (const series of allSeries) {
      if (!series.team1_id || !series.team2_id) continue;
      if (series.status === 'completed') continue;

      // Activate series if needed (may have been set to active by previous round winner)
      const current = db.prepare('SELECT * FROM playoff_series WHERE id=?').get(series.id);
      if (current.status === 'pending') continue;

      const need = Math.ceil(current.best_of / 2); // 2 for best-of-3

      // Game results: team1 wins G1(3-1), team2 wins G2(3-2), team1 wins G3(2-1) → 2-1
      const gameScripts = [
        { home: current.team1_id, away: current.team2_id, hs: 3, as_: 1 },
        { home: current.team2_id, away: current.team1_id, hs: 3, as_: 2 },
        { home: current.team1_id, away: current.team2_id, hs: 2, as_: 1 },
      ];

      for (const game of gameScripts.slice(0, current.best_of)) {
        // Check series status before each game
        const s = db.prepare('SELECT * FROM playoff_series WHERE id=?').get(current.id);
        if (s.status === 'completed') break;

        const baseDate = new Date('2026-05-15');
        baseDate.setDate(baseDate.getDate() + gameCounter * 2);
        const dateStr = baseDate.toISOString().slice(0, 10) + ' 21:00';

        const matchRow = db.prepare(`
          INSERT INTO matches (home_team_id, away_team_id, date, status, validated,
                               home_score, away_score, season_id, is_playoff, playoff_series_id, location)
          VALUES (?, ?, ?, 'completed', 1, ?, ?, ?, 1, ?, 'Aréna Municipal')
        `).run(game.home, game.away, dateStr, game.hs, game.as_, season.id, current.id);

        addGoals(db, matchRow.lastInsertRowid, game.hs,  game.home, playersByTeam[game.home] || []);
        addGoals(db, matchRow.lastInsertRowid, game.as_, game.away, playersByTeam[game.away] || []);

        recalcSeries(db, current.id);
        gameCounter++;
        totalGames++;
      }
    }
  }

  const finalSeason = db.prepare(`
    SELECT s.*, t.name as champion_name, t.color as champion_color
    FROM seasons s LEFT JOIN teams t ON s.champion_team_id = t.id
    WHERE s.id = ?
  `).get(season.id);

  res.json({
    message: `✅ Séries éliminatoires simulées (${totalGames} matchs)`,
    games: totalGames,
    champion: finalSeason.champion_name || 'Non déterminé',
    season_status: finalSeason.status,
  });
});

module.exports = router;
