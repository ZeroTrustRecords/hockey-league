const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authenticate, requireAdmin, requireAdminPassword } = require('../middleware/auth');
const { seedPastSeasonStats } = require('../lib/pastSeasonStats');
const { logAudit } = require('../lib/auditLog');

function getLatestActiveSeason(db) {
  return db.prepare("SELECT * FROM seasons WHERE status = 'active' ORDER BY id DESC LIMIT 1").get();
}

function getLatestPlayoffSeason(db) {
  return db.prepare("SELECT * FROM seasons WHERE status = 'playoffs' ORDER BY id DESC LIMIT 1").get();
}

function getLatestCompletedSeason(db) {
  return db.prepare("SELECT * FROM seasons WHERE status = 'completed' ORDER BY id DESC LIMIT 1").get();
}

function buildPlayersByTeam(db, teamIds) {
  const playersByTeam = {};
  for (const teamId of teamIds) {
    playersByTeam[teamId] = db.prepare(
      "SELECT id FROM players WHERE team_id = ? AND status = 'active' ORDER BY id"
    ).all(teamId).map(player => player.id);
  }
  return playersByTeam;
}

function getMissingTeamNames(db, teamIds, playersByTeam) {
  return teamIds
    .filter(teamId => !playersByTeam[teamId]?.length)
    .map(teamId => db.prepare('SELECT name FROM teams WHERE id = ?').get(teamId)?.name || `Equipe ${teamId}`);
}

function ensureAssignedPlayers(res, db, teamIds, playersByTeam) {
  const missingTeams = getMissingTeamNames(db, teamIds, playersByTeam);
  if (missingTeams.length === 0) return false;
  res.status(400).json({
    error: `Des joueurs doivent etre assignes a chaque equipe avant la simulation: ${missingTeams.join(', ')}`,
  });
  return true;
}

function addGoals(db, matchId, count, teamId, roster, startOffset = 0) {
  if (!roster.length) return;
  for (let index = 0; index < count; index++) {
    const scorer = roster[(startOffset + index) % roster.length];
    const assist1 = roster.length > 1 ? roster[(startOffset + index + 1) % roster.length] : null;
    const assist2 = roster.length > 2 && index % 2 === 0 ? roster[(startOffset + index + 2) % roster.length] : null;
    db.prepare(`
      INSERT INTO goals (match_id, team_id, scorer_id, assist1_id, assist2_id, period)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(matchId, teamId, scorer, assist1, assist2, (index % 3) + 1);
  }
}

function getUniquePairCount(teamIds) {
  return (teamIds.length * (teamIds.length - 1)) / 2;
}

function inferRoundCount(db, seasonId, teamIds, fallbackRounds = 3) {
  const pairCount = getUniquePairCount(teamIds);
  if (!pairCount) return fallbackRounds;
  const matchCount = db.prepare(
    'SELECT COUNT(*) AS count FROM matches WHERE season_id = ? AND is_playoff = 0'
  ).get(seasonId).count;
  if (matchCount >= pairCount && matchCount % pairCount === 0) {
    return matchCount / pairCount;
  }
  return fallbackRounds;
}

function buildRoundRobinGames(teamIds, rounds, startDate, daysBetween = 7, times = ['21:00', '21:00', '20:00']) {
  const pairs = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      pairs.push([teamIds[i], teamIds[j]]);
    }
  }

  const games = [];
  for (let round = 0; round < rounds; round++) {
    pairs.forEach(([team1, team2], pairIndex) => {
      const home = round % 2 === 0 ? team1 : team2;
      const away = round % 2 === 0 ? team2 : team1;
      const gamesPerDay = Math.max(1, Math.floor(teamIds.length / 2));
      const overallIndex = round * pairs.length + pairIndex;
      const dayOffset = Math.floor(overallIndex / gamesPerDay) * daysBetween;
      const slot = overallIndex % gamesPerDay;
      const date = new Date(startDate);
      date.setDate(date.getDate() + dayOffset);
      games.push({
        home,
        away,
        date: `${date.toISOString().slice(0, 10)} ${times[slot % times.length]}`,
      });
    });
  }

  return games;
}

function getRegularSeasonScore(index) {
  const patterns = [
    [5, 3], [4, 2], [6, 4], [3, 1], [5, 2],
    [4, 1], [6, 3], [3, 2], [5, 4], [4, 3],
    [7, 4], [2, 1], [6, 2], [5, 1], [4, 0],
  ];
  return patterns[index % patterns.length];
}

function getNextSeasonName(lastSeasonName) {
  const match = (lastSeasonName || '').match(/(\d{4})-(\d{4})/);
  if (match) {
    const startYear = parseInt(match[1], 10) + 1;
    return `Saison ${startYear}-${startYear + 1}`;
  }

  const year = new Date().getFullYear();
  return `Saison ${year}-${year + 1}`;
}

function simulateRegularSeason(req, res) {
  const db = getDB();
  const season = getLatestActiveSeason(db);
  if (!season) return res.status(400).json({ error: 'Aucune saison active trouvee' });

  const teams = db.prepare('SELECT id FROM teams ORDER BY id').all();
  const teamIds = teams.map(team => team.id);
  const matches = db.prepare(
    "SELECT * FROM matches WHERE season_id = ? AND status = 'scheduled' AND is_playoff = 0 ORDER BY date"
  ).all(season.id);

  if (matches.length === 0) {
    return res.status(400).json({ error: 'Aucun match de saison reguliere a simuler. Importez ou planifiez le calendrier.' });
  }

  const playersByTeam = buildPlayersByTeam(db, teamIds);
  if (ensureAssignedPlayers(res, db, teamIds, playersByTeam)) return;

  let count = 0;
  db.transaction(() => {
    matches.forEach((match, index) => {
      const [homeScore, awayScore] = getRegularSeasonScore(index);
      db.prepare('DELETE FROM goals WHERE match_id = ?').run(match.id);
      db.prepare("UPDATE matches SET status = 'completed', validated = 1, home_score = ?, away_score = ? WHERE id = ?")
        .run(homeScore, awayScore, match.id);
      addGoals(db, match.id, homeScore, match.home_team_id, playersByTeam[match.home_team_id] || [], index);
      addGoals(db, match.id, awayScore, match.away_team_id, playersByTeam[match.away_team_id] || [], index + 3);
      count++;
    });
    logAudit(db, {
      user_id: req.user.id,
      username: req.user.username,
      action: 'season.simulated',
      entity_type: 'season',
      entity_id: season.id,
      details: { matches: count, type: 'regular' },
    });
  })();

  res.json({ message: `Simulation terminee pour ${season.name}`, matches: count });
}

router.post('/season', authenticate, requireAdmin, simulateRegularSeason);
router.post('/current-season', authenticate, requireAdmin, simulateRegularSeason);

router.post('/past-season', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const season = getLatestActiveSeason(db);
  if (!season) {
    return res.status(400).json({ error: 'Aucune saison active trouvee pour rattacher la saison precedente' });
  }

  try {
    const result = db.transaction(() => seedPastSeasonStats(db, season))();
    logAudit(db, {
      user_id: req.user.id,
      username: req.user.username,
      action: 'season.history-seeded',
      entity_type: 'season',
      entity_id: result.season.id,
      details: { inserted: result.inserted },
    });
    res.json({
      message: `Stats historiques importees pour ${result.season.name}`,
      season_id: result.season.id,
      inserted: result.inserted,
      missing_players: result.missingPlayers,
      missing_teams: result.missingTeams,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erreur lors de l import des stats historiques' });
  }
});

router.post('/playoffs', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const { recalcSeries } = require('./playoffs');

  const season = getLatestPlayoffSeason(db);
  if (!season) {
    return res.status(400).json({ error: 'Aucune saison en series eliminatoires. Demarrez les series d abord.' });
  }

  const playoffTeamIds = db.prepare(`
    SELECT DISTINCT team_id FROM (
      SELECT team1_id as team_id FROM playoff_series WHERE season_id = ? AND team1_id IS NOT NULL
      UNION ALL
      SELECT team2_id as team_id FROM playoff_series WHERE season_id = ? AND team2_id IS NOT NULL
    )
  `).all(season.id, season.id).map(row => row.team_id);
  const playersByTeam = buildPlayersByTeam(db, playoffTeamIds);
  if (ensureAssignedPlayers(res, db, playoffTeamIds, playersByTeam)) return;

  let gameCounter = 0;
  let totalGames = 0;

  for (let round = 1; round <= 4; round++) {
    const seriesList = db.prepare(
      'SELECT * FROM playoff_series WHERE season_id = ? AND round = ? ORDER BY series_number'
    ).all(season.id, round);

    for (const series of seriesList) {
      if (!series.team1_id || !series.team2_id) continue;
      if (series.status === 'completed') continue;

      const current = db.prepare('SELECT * FROM playoff_series WHERE id = ?').get(series.id);
      if (current.status === 'pending') continue;

      const gameScripts = [
        { home: current.team1_id, away: current.team2_id, homeScore: 3, awayScore: 1 },
        { home: current.team2_id, away: current.team1_id, homeScore: 3, awayScore: 2 },
        { home: current.team1_id, away: current.team2_id, homeScore: 2, awayScore: 1 },
      ];

      const existingValidatedGames = db.prepare(
        'SELECT id FROM matches WHERE playoff_series_id = ? AND validated = 1 ORDER BY date, id'
      ).all(current.id);

      for (const game of gameScripts.slice(existingValidatedGames.length, current.best_of)) {
        const liveSeries = db.prepare('SELECT * FROM playoff_series WHERE id = ?').get(current.id);
        if (liveSeries.status === 'completed') break;

        const scheduledGame = db.prepare(
          "SELECT * FROM matches WHERE playoff_series_id = ? AND status = 'scheduled' ORDER BY date, id LIMIT 1"
        ).get(current.id);

        let matchId;
        if (scheduledGame) {
          matchId = scheduledGame.id;
          db.prepare('DELETE FROM goals WHERE match_id = ?').run(matchId);
          db.prepare(`
            UPDATE matches
            SET home_team_id = ?, away_team_id = ?, status = 'completed', validated = 1,
                home_score = ?, away_score = ?, location = 'Arena Municipal'
            WHERE id = ?
          `).run(game.home, game.away, game.homeScore, game.awayScore, matchId);
        } else {
          const baseDate = new Date('2026-05-15');
          baseDate.setDate(baseDate.getDate() + gameCounter * 2);
          const dateStr = baseDate.toISOString().slice(0, 10) + ' 21:00';
          const matchRow = db.prepare(`
            INSERT INTO matches (home_team_id, away_team_id, date, status, validated,
                                 home_score, away_score, season_id, is_playoff, playoff_series_id, location)
            VALUES (?, ?, ?, 'completed', 1, ?, ?, ?, 1, ?, 'Arena Municipal')
          `).run(game.home, game.away, dateStr, game.homeScore, game.awayScore, season.id, current.id);
          matchId = matchRow.lastInsertRowid;
        }

        addGoals(db, matchId, game.homeScore, game.home, playersByTeam[game.home] || [], gameCounter);
        addGoals(db, matchId, game.awayScore, game.away, playersByTeam[game.away] || [], gameCounter + 2);
        recalcSeries(db, current.id);
        gameCounter++;
        totalGames++;
      }
    }
  }

  const finalSeason = db.prepare(`
    SELECT s.*, t.name as champion_name
    FROM seasons s
    LEFT JOIN teams t ON s.champion_team_id = t.id
    WHERE s.id = ?
  `).get(season.id);

  res.json({
    message: `Simulation des series terminee (${totalGames} matchs)`,
    games: totalGames,
    champion: finalSeason.champion_name || 'Non determine',
    season_status: finalSeason.status,
  });
  logAudit(db, {
    user_id: req.user.id,
    username: req.user.username,
    action: 'playoffs.simulated',
    entity_type: 'season',
    entity_id: season.id,
    details: { games: totalGames, champion: finalSeason.champion_name || null },
  });
});

router.post('/next-season', authenticate, requireAdmin, requireAdminPassword, (req, res) => {
  const db = getDB();
  const lastCompletedSeason = getLatestCompletedSeason(db);
  if (!lastCompletedSeason) {
    return res.status(400).json({ error: 'Aucune saison terminee pour preparer la suivante' });
  }

  const existingActive = getLatestActiveSeason(db);
  if (existingActive) {
    return res.status(400).json({ error: 'Une saison active existe deja' });
  }

  const nextSeasonName = getNextSeasonName(lastCompletedSeason.name);
  const nextStartDate = lastCompletedSeason.end_date || null;

  const result = db.transaction(() => {
    db.prepare("UPDATE users SET role = CASE WHEN role = 'captain' THEN 'player' ELSE role END, team_id = NULL WHERE username NOT IN ('admin', 'marqueur')").run();
    db.prepare('UPDATE players SET team_id = NULL').run();
    db.prepare('DELETE FROM team_staff').run();
    const insertResult = db.prepare(
      'INSERT INTO seasons (name, start_date, end_date, status) VALUES (?, ?, ?, ?)'
    ).run(nextSeasonName, nextStartDate, null, 'active');
    logAudit(db, {
      user_id: req.user.id,
      username: req.user.username,
      action: 'season.created-next',
      entity_type: 'season',
      entity_id: insertResult.lastInsertRowid,
      details: { season_name: nextSeasonName, based_on: lastCompletedSeason.name },
    });
    return insertResult;
  })();

  res.json({
    message: `${nextSeasonName} est prete pour les nouvelles importations`,
    season_id: result.lastInsertRowid,
    season_name: nextSeasonName,
  });
});

module.exports = router;
module.exports.getNextSeasonName = getNextSeasonName;
