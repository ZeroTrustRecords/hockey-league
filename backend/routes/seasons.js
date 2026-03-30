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
  const season = db.prepare("SELECT * FROM seasons WHERE status = 'active' ORDER BY created_at DESC LIMIT 1").get();
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
