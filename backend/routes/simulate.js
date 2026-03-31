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

module.exports = router;
