const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authenticate, requireAdmin, requireAdminPassword } = require('../middleware/auth');
const { seedPastSeasonStats } = require('../lib/pastSeasonStats');
const { logAudit } = require('../lib/auditLog');

function normalizeName(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*\(.*\)$/, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function buildSeasonName() {
  const today = new Date();
  const year = today.getFullYear();
  return `Saison ${year}-${year + 1}`;
}

function normalizePosition(value) {
  const normalized = normalizeName(value).replace(/\s+/g, '');
  if (['a', 'att', 'attaquant', 'forward', 'offense', 'offenceman', 'ailier', 'centre', 'center'].includes(normalized)) return 'A';
  if (['d', 'def', 'defenseur', 'defense', 'defenceman'].includes(normalized)) return 'D';
  if (['g', 'gardien', 'goalie', 'goal'].includes(normalized)) return 'G';
  return 'A';
}

function teamColor(index) {
  const palette = ['#7C3AED', '#0F766E', '#0033A0', '#AF1E2D', '#F74902', '#FFB81C'];
  return palette[index % palette.length];
}

function teamColorByName(teamName, index) {
  const normalized = normalizeName(teamName);
  const namedColors = {
    bruins: '#FFB81C',
    rangers: '#7DD3FC',
    stars: '#16A34A',
    blues: '#1D4ED8',
    flyers: '#F97316',
    canadiens: '#DC2626',
  };

  return namedColors[normalized] || teamColor(index);
}

function isValidJerseyNumber(value) {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 99;
}

const DEFAULT_ARENA_NAME = "Aréna de l'Assomption";

function assignRosterNumbers(players) {
  const playersByTeam = new Map();
  players.forEach(player => {
    const list = playersByTeam.get(player.team_name) || [];
    list.push(player);
    playersByTeam.set(player.team_name, list);
  });

  const allNumbers = Array.from({ length: 99 }, (_, index) => index + 1);

  playersByTeam.forEach(teamPlayers => {
    const usedNumbers = new Set();
    const playersNeedingNumber = [];

    teamPlayers.forEach(player => {
      if (isValidJerseyNumber(player.number) && !usedNumbers.has(Number(player.number))) {
        player.number = Number(player.number);
        usedNumbers.add(player.number);
      } else {
        player.number = null;
        playersNeedingNumber.push(player);
      }
    });

    const availableNumbers = allNumbers.filter(number => !usedNumbers.has(number));
    for (let index = availableNumbers.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [availableNumbers[index], availableNumbers[swapIndex]] = [availableNumbers[swapIndex], availableNumbers[index]];
    }

    playersNeedingNumber.forEach((player, index) => {
      player.number = availableNumbers[index] || null;
    });
  });

  return players;
}

router.get('/', (req, res) => {
  const db = getDB();
  const seasons = db.prepare('SELECT * FROM seasons ORDER BY created_at DESC').all();
  res.json(seasons);
});

router.get('/active', (req, res) => {
  const db = getDB();
  const seasons = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM matches m WHERE m.season_id = s.id) AS total_matches,
      (SELECT COUNT(*) FROM matches m WHERE m.season_id = s.id AND m.validated = 1) AS validated_matches,
      (SELECT COUNT(*) FROM matches m WHERE m.season_id = s.id AND m.is_playoff = 1) AS playoff_matches
    FROM seasons s
    ORDER BY s.id DESC
  `).all();

  const season =
    seasons.find(s => s.status === 'playoffs') ||
    seasons.find(s => s.status === 'completed' && (s.playoff_matches > 0 || s.champion_team_id)) ||
    seasons.find(s => s.status === 'active' && s.total_matches > 0) ||
    seasons.find(s => s.status === 'active') ||
    seasons.find(s => s.status === 'completed') ||
    null;
  res.json(season || null);
});

router.post('/', authenticate, requireAdmin, (req, res) => {
  const { name, start_date, end_date } = req.body;
  const db = getDB();
  const result = db.prepare(
    'INSERT INTO seasons (name, start_date, end_date, status) VALUES (?, ?, ?, ?)'
  ).run(name, start_date || null, end_date || null, 'active');
  res.status(201).json({ id: result.lastInsertRowid, name, status: 'active' });
});

router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const { name, start_date, end_date, status } = req.body;
  const db = getDB();
  db.prepare('UPDATE seasons SET name=?, start_date=?, end_date=?, status=? WHERE id=?')
    .run(name, start_date, end_date, status, req.params.id);
  res.json({ message: 'Saison mise à jour' });
});

// Full reset: clear matches, goals, draft, playoff series, unassign players from teams
router.post('/reset', authenticate, requireAdmin, requireAdminPassword, (req, res) => {
  const db = getDB();
  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    db.prepare('DELETE FROM attendance').run();
    db.prepare('DELETE FROM goals').run();
    db.prepare('DELETE FROM matches').run();
    db.prepare('DELETE FROM playoff_series').run();
    db.prepare('DELETE FROM draft_picks').run();
    db.prepare("UPDATE draft_settings SET status='pending', current_round=1, current_pick=1").run();
    db.prepare('DELETE FROM player_season_stats').run();
    db.prepare('UPDATE players SET team_id = NULL').run();
    db.prepare('DELETE FROM team_staff').run();
    db.prepare("UPDATE seasons SET status = 'active', champion_team_id = NULL WHERE status IN ('playoffs','completed')").run();
    logAudit(db, {
      user_id: req.user.id,
      username: req.user.username,
      action: 'league.reset',
      entity_type: 'league',
      entity_id: 'global',
    });
  })();
  db.pragma('foreign_keys = ON');
  res.json({ message: 'Réinitialisation complète effectuée' });
});

// Generate a round-robin schedule for a season
router.post('/:id/generate-schedule', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const seasonId = parseInt(req.params.id);

  const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(seasonId);
  if (!season) return res.status(404).json({ error: 'Saison introuvable' });

  const existing = db.prepare(
    'SELECT COUNT(*) as c FROM matches WHERE season_id = ? AND is_playoff = 0'
  ).get(seasonId).c;
  if (existing > 0)
    return res.status(400).json({ error: `Cette saison a déjà ${existing} match(s) planifié(s)` });

  const teams = db.prepare('SELECT id FROM teams ORDER BY id').all();
  if (teams.length < 2)
    return res.status(400).json({ error: 'Au moins 2 équipes requises' });

  const {
    start_date,
    rounds = 3,
    days_between = 7,
    times = ['21:00', '21:00', '20:00'],
  } = req.body;

  if (!start_date) return res.status(400).json({ error: 'start_date requis' });

  // Build all unique pairs then repeat for each round (alternating home/away)
  const pairs = [];
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++)
      pairs.push([teams[i].id, teams[j].id]);

  const allGames = [];
  for (let r = 0; r < rounds; r++)
    pairs.forEach(([t1, t2]) => allGames.push(r % 2 === 0 ? [t1, t2] : [t2, t1]));

  // Group into game days: floor(teams/2) games per day, spaced days_between apart
  const gamesPerDay = Math.floor(teams.length / 2);
  const base = new Date(start_date);

  const insert = db.prepare(`
    INSERT INTO matches (home_team_id, away_team_id, date, location, status, season_id)
    VALUES (?, ?, ?, ?, 'scheduled', ?)
  `);

  db.transaction(() => {
    allGames.forEach(([home, away], idx) => {
      const dayNum  = Math.floor(idx / gamesPerDay);
      const slotNum = idx % gamesPerDay;
      const d = new Date(base);
      d.setDate(d.getDate() + dayNum * days_between);
      const dateStr = d.toISOString().slice(0, 10) + ' ' + (times[slotNum % times.length]);
      insert.run(home, away, dateStr, DEFAULT_ARENA_NAME, seasonId);
    });
    logAudit(db, {
      user_id: req.user.id,
      username: req.user.username,
      action: 'schedule.generated',
      entity_type: 'season',
      entity_id: seasonId,
      details: { rounds, matches: allGames.length, start_date },
    });
  })();

  res.json({ message: `${allGames.length} matchs générés`, matches: allGames.length });
});

router.post('/:id/import-schedule', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const seasonId = parseInt(req.params.id, 10);
  const { matches } = req.body;

  if (!Array.isArray(matches) || matches.length === 0) {
    return res.status(400).json({ error: 'Aucun match a importer' });
  }

  const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(seasonId);
  if (!season) return res.status(404).json({ error: 'Saison introuvable' });

  const existing = db.prepare(
    'SELECT COUNT(*) as c FROM matches WHERE season_id = ? AND is_playoff = 0'
  ).get(seasonId).c;
  if (existing > 0) {
    return res.status(400).json({ error: `Cette saison a deja ${existing} match(s) planifie(s)` });
  }

  const teams = db.prepare('SELECT id, name FROM teams').all();
  const teamMap = new Map(teams.map(team => [normalizeName(team.name), team]));
  const cleanedMatches = [];
  const details = [];

  matches.forEach((match, index) => {
    const rowNumber = index + 2;
    const homeName = (match.home_team_name || '').trim();
    const awayName = (match.away_team_name || '').trim();
    const date = (match.date || '').trim();
    const location = (match.location || '').trim() || DEFAULT_ARENA_NAME;

    if (!homeName || !awayName || !date) {
      details.push(`Ligne ${rowNumber}: date/equipe locale/equipe visiteur manquante`);
      return;
    }

    const homeTeam = teamMap.get(normalizeName(homeName));
    const awayTeam = teamMap.get(normalizeName(awayName));

    if (!homeTeam) details.push(`Ligne ${rowNumber}: equipe locale introuvable (${homeName})`);
    if (!awayTeam) details.push(`Ligne ${rowNumber}: equipe visiteur introuvable (${awayName})`);
    if (!homeTeam || !awayTeam) return;

    if (homeTeam.id === awayTeam.id) {
      details.push(`Ligne ${rowNumber}: les deux equipes sont identiques (${homeName})`);
      return;
    }

    cleanedMatches.push({
      home_team_id: homeTeam.id,
      away_team_id: awayTeam.id,
      date,
      location,
    });
  });

  if (details.length > 0) {
    return res.status(400).json({ error: 'Importation invalide', details });
  }

  const insert = db.prepare(`
    INSERT INTO matches (home_team_id, away_team_id, date, location, status, season_id)
    VALUES (?, ?, ?, ?, 'scheduled', ?)
  `);

  db.transaction(() => {
    cleanedMatches.forEach(match => {
      insert.run(match.home_team_id, match.away_team_id, match.date, match.location, seasonId);
    });
    logAudit(db, {
      user_id: req.user.id,
      username: req.user.username,
      action: 'schedule.imported',
      entity_type: 'season',
      entity_id: seasonId,
      details: { matches: cleanedMatches.length },
    });
  })();

  res.json({ message: `${cleanedMatches.length} match(s) importes`, matches: cleanedMatches.length });
});

router.post('/import-roster', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const { players, season_name, start_date, end_date } = req.body;

  if (!Array.isArray(players) || players.length === 0) {
    return res.status(400).json({ error: 'Aucun joueur a importer' });
  }

  const cleanedPlayers = [];
  const teamNames = [];
  const details = [];

  players.forEach((player, index) => {
    const rowNumber = index + 2;
    const firstName = (player.first_name || '').trim();
    const lastName = (player.last_name || '').trim();
    const teamName = (player.team_name || '').trim();

    if (!firstName || !lastName || !teamName) {
      details.push(`Ligne ${rowNumber}: prenom/nom/equipe manquants`);
      return;
    }

    cleanedPlayers.push({
      first_name: firstName,
      last_name: lastName,
      team_name: teamName,
      number: player.number ? parseInt(player.number, 10) || null : null,
      position: normalizePosition(player.position),
      rating: player.rating || 'C',
      rating_score: player.rating_score ? parseInt(player.rating_score, 10) || 0 : 0,
      email: player.email || null,
      phone: player.phone || null,
    });
    teamNames.push(teamName);
  });

  if (details.length > 0) {
    return res.status(400).json({ error: 'Importation invalide', details });
  }

  const uniqueTeamNames = [...new Set(teamNames.map(name => name.trim()))].sort((a, b) => a.localeCompare(b));
  assignRosterNumbers(cleanedPlayers);

  db.transaction(() => {
    db.prepare('DELETE FROM attendance').run();
    db.prepare('DELETE FROM message_reads').run();
    db.prepare('DELETE FROM messages').run();
    db.prepare('DELETE FROM goals').run();
    db.prepare('DELETE FROM matches').run();
    db.prepare('DELETE FROM playoff_series').run();
    db.prepare('DELETE FROM draft_picks').run();
    db.prepare('DELETE FROM draft_settings').run();
    db.prepare('DELETE FROM player_season_stats').run();
    db.prepare('DELETE FROM team_staff').run();
    db.prepare("UPDATE users SET player_id = NULL, team_id = NULL, role = CASE username WHEN 'admin' THEN 'admin' WHEN 'marqueur' THEN 'marqueur' ELSE role END").run();
    db.prepare('DELETE FROM players').run();
    db.prepare('DELETE FROM teams').run();
    db.prepare('DELETE FROM seasons').run();

    const seasonRow = db.prepare(
      'INSERT INTO seasons (name, start_date, end_date, status) VALUES (?, ?, ?, ?)'
    ).run(season_name || buildSeasonName(), start_date || null, end_date || null, 'active');
    const seasonId = seasonRow.lastInsertRowid;
    const activeSeason = db.prepare('SELECT * FROM seasons WHERE id = ?').get(seasonId);

    const insertTeam = db.prepare('INSERT INTO teams (name, color, season_id) VALUES (?, ?, ?)');
    const insertPlayer = db.prepare(`
      INSERT INTO players (first_name, last_name, number, position, team_id, email, phone, rating, rating_score, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `);

    const teamIdByName = new Map();
    uniqueTeamNames.forEach((teamName, index) => {
      const result = insertTeam.run(teamName, teamColorByName(teamName, index), seasonId);
      teamIdByName.set(teamName, result.lastInsertRowid);
    });

    cleanedPlayers.forEach(player => {
      insertPlayer.run(
        player.first_name,
        player.last_name,
        player.number,
        player.position,
        teamIdByName.get(player.team_name),
        player.email,
        player.phone,
        player.rating,
        player.rating_score
      );
    });

    seedPastSeasonStats(db, activeSeason);

    logAudit(db, {
      user_id: req.user.id,
      username: req.user.username,
      action: 'roster.imported',
      entity_type: 'season',
      entity_id: seasonId,
      details: {
        players: cleanedPlayers.length,
        teams: uniqueTeamNames.length,
        season_name: activeSeason.name,
      },
    });
  })();

  res.json({
    message: `${cleanedPlayers.length} joueur(s) importes dans ${uniqueTeamNames.length} equipe(s)`,
    players: cleanedPlayers.length,
    teams: uniqueTeamNames.length,
  });
});

// Import player-team assignments from CSV data (parsed on frontend)
router.post('/import-csv', authenticate, requireAdmin, (req, res) => {
  const { assignments } = req.body;
  if (!Array.isArray(assignments) || assignments.length === 0)
    return res.status(400).json({ error: 'Aucune donnée reçue' });

  const db = getDB();
  const getTeam   = db.prepare('SELECT id FROM teams WHERE LOWER(name) = LOWER(?) LIMIT 1');
  const getPlayer = db.prepare('SELECT id FROM players WHERE LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?) LIMIT 1');
  const updatePlayer = db.prepare('UPDATE players SET team_id = ? WHERE id = ?');
  const clearPlayer  = db.prepare('UPDATE players SET team_id = NULL WHERE id = ?');

  let updated = 0;
  const notFoundPlayers = [];
  const notFoundTeams = [];

  db.transaction(() => {
    for (const { first_name, last_name, team_name } of assignments) {
      const fn = (first_name || '').trim();
      const ln = (last_name  || '').trim();
      const tn = (team_name  || '').trim();
      if (!fn || !ln) continue;

      const player = getPlayer.get(fn, ln);
      if (!player) { notFoundPlayers.push(`${fn} ${ln}`); continue; }

      if (!tn) { clearPlayer.run(player.id); updated++; continue; }

      const team = getTeam.get(tn);
      if (!team) { notFoundTeams.push(tn); continue; }

      updatePlayer.run(team.id, player.id);
      updated++;
    }
  })();

  res.json({
    message: `${updated} joueur(s) mis à jour`,
    updated,
    not_found_players: [...new Set(notFoundPlayers)],
    not_found_teams:   [...new Set(notFoundTeams)],
  });
});

module.exports = router;
module.exports.teamColorByName = teamColorByName;
module.exports.assignRosterNumbers = assignRosterNumbers;
