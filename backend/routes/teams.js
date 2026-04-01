const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authenticate, authenticateOptional, requireAdmin, requireCaptainOrAdmin } = require('../middleware/auth');

function sanitizePlayerForRole(player, role) {
  if (!player) return player;
  if (role === 'admin') return player;
  const { rating, rating_score, ...safePlayer } = player;
  return safePlayer;
}

router.get('/', authenticateOptional, (req, res) => {
  const db = getDB();
  const teams = db.prepare('SELECT * FROM teams ORDER BY name').all();

  const playerCounts = db.prepare("SELECT team_id, COUNT(*) as c FROM players WHERE status = 'active' GROUP BY team_id").all();
  const captains = db.prepare(`
    SELECT ts.team_id, p.id, p.first_name, p.last_name, p.nickname
    FROM team_staff ts JOIN players p ON ts.player_id = p.id
    WHERE ts.role = 'captain'
  `).all();
  const strengthScores = db.prepare(`
    SELECT team_id, SUM(COALESCE(rating_score, 0)) as strength
    FROM players WHERE status = 'active' AND team_id IS NOT NULL GROUP BY team_id
  `).all();

  const countMap    = Object.fromEntries(playerCounts.map(r => [r.team_id, r.c]));
  const captainMap  = Object.fromEntries(captains.map(r => [r.team_id, r]));
  const strengthMap = Object.fromEntries(strengthScores.map(r => [r.team_id, r.strength]));

  const result = teams.map(team => ({
    ...team,
    player_count:   countMap[team.id]    || 0,
    captain:        captainMap[team.id]  || null,
    strength_score: strengthMap[team.id] || 0,
  }));

  res.json(result);
});

router.get('/:id', authenticateOptional, (req, res) => {
  const db = getDB();
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
  if (!team) return res.status(404).json({ error: 'Équipe introuvable' });

  const players = db.prepare(`
    SELECT p.*, ts.role as staff_role
    FROM players p
    LEFT JOIN team_staff ts ON ts.player_id = p.id AND ts.team_id = ?
    WHERE p.team_id = ? AND p.status = 'active'
    ORDER BY p.last_name
  `).all(team.id, team.id).map((player) => sanitizePlayerForRole(player, req.user?.role));

  const staff = db.prepare(`
    SELECT ts.role, p.id, p.first_name, p.last_name
    FROM team_staff ts JOIN players p ON ts.player_id = p.id
    WHERE ts.team_id = ?
  `).all(team.id);

  // Last 5 matches
  const recentMatches = db.prepare(`
    SELECT m.*, ht.name as home_team_name, ht.color as home_color,
           at2.name as away_team_name, at2.color as away_color
    FROM matches m
    INNER JOIN teams ht ON m.home_team_id = ht.id
    INNER JOIN teams at2 ON m.away_team_id = at2.id
    WHERE (m.home_team_id = ? OR m.away_team_id = ?) AND m.validated = 1
    ORDER BY m.date DESC LIMIT 5
  `).all(team.id, team.id);

  res.json({ ...team, players, staff, recentMatches });
});

router.post('/', authenticate, requireAdmin, (req, res) => {
  const { name, color, logo } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  const db = getDB();
  const result = db.prepare('INSERT INTO teams (name, color, logo) VALUES (?, ?, ?)').run(name, color || '#3B82F6', logo || null);
  res.status(201).json({ id: result.lastInsertRowid, name, color });
});

router.put('/:id', authenticate, requireCaptainOrAdmin, (req, res) => {
  const { name, color, logo } = req.body;
  const db = getDB();

  // Captains can only update their own team
  if (req.user.role === 'captain' && req.user.team_id !== parseInt(req.params.id)) {
    return res.status(403).json({ error: 'Vous ne pouvez modifier que votre équipe' });
  }

  db.prepare('UPDATE teams SET name=?, color=?, logo=? WHERE id=?').run(name, color, logo || null, req.params.id);
  res.json({ message: 'Équipe mise à jour' });
});

// Set captain / assistant
router.post('/:id/staff', authenticate, requireCaptainOrAdmin, (req, res) => {
  const { player_id, role } = req.body;
  const db = getDB();

  if (role === 'captain') {
    // Remove existing captain
    db.prepare("DELETE FROM team_staff WHERE team_id = ? AND role = 'captain'").run(req.params.id);
  }

  db.prepare('INSERT OR REPLACE INTO team_staff (team_id, player_id, role) VALUES (?, ?, ?)').run(req.params.id, player_id, role);

  // Update user team_id if captain
  if (role === 'captain') {
    db.prepare("UPDATE users SET role = 'captain', team_id = ? WHERE player_id = ?").run(req.params.id, player_id);
  }

  res.json({ message: 'Rôle assigné' });
});

router.delete('/:id/staff/:player_id', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM team_staff WHERE team_id = ? AND player_id = ?').run(req.params.id, req.params.player_id);
  res.json({ message: 'Rôle retiré' });
});

module.exports = router;
