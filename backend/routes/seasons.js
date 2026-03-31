const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', (req, res) => {
  const db = getDB();
  const seasons = db.prepare('SELECT * FROM seasons ORDER BY created_at DESC').all();
  res.json(seasons);
});

router.get('/active', (req, res) => {
  const db = getDB();
  // Prefer an in-progress season (active / playoffs); fall back to the most
  // recently created completed season so the bracket stays visible after playoffs end.
  const season =
    db.prepare("SELECT * FROM seasons WHERE status IN ('active','playoffs') ORDER BY id DESC LIMIT 1").get() ||
    db.prepare("SELECT * FROM seasons WHERE status = 'completed' ORDER BY id DESC LIMIT 1").get();
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
router.post('/reset', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    db.prepare('DELETE FROM goals WHERE match_id IN (SELECT id FROM matches WHERE status = \'completed\')').run();
    db.prepare('DELETE FROM matches WHERE status = \'completed\'').run();
    db.prepare('DELETE FROM playoff_series').run();
    db.prepare('DELETE FROM draft_picks').run();
    db.prepare("UPDATE draft_settings SET status='pending', current_round=1, current_pick=1").run();
    db.prepare('DELETE FROM player_season_stats').run();
    db.prepare('UPDATE players SET team_id = NULL').run();
    db.prepare('DELETE FROM team_staff').run();
    db.prepare("UPDATE seasons SET status = 'active', champion_team_id = NULL WHERE status IN ('playoffs','completed')").run();
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
    VALUES (?, ?, ?, 'Aréna Municipal', 'scheduled', ?)
  `);

  db.transaction(() => {
    allGames.forEach(([home, away], idx) => {
      const dayNum  = Math.floor(idx / gamesPerDay);
      const slotNum = idx % gamesPerDay;
      const d = new Date(base);
      d.setDate(d.getDate() + dayNum * days_between);
      const dateStr = d.toISOString().slice(0, 10) + ' ' + (times[slotNum % times.length]);
      insert.run(home, away, dateStr, seasonId);
    });
  })();

  res.json({ message: `${allGames.length} matchs générés`, matches: allGames.length });
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
