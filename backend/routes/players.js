const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authenticate, requireAdmin, requireCaptainOrAdmin } = require('../middleware/auth');

// Get all players with optional filters
router.get('/', (req, res) => {
  const db = getDB();
  const { team_id, position, status, search } = req.query;

  let query = `
    SELECT p.*, t.name as team_name, t.color as team_color
    FROM players p
    LEFT JOIN teams t ON p.team_id = t.id
    WHERE 1=1
  `;
  const params = [];

  if (team_id) { query += ' AND p.team_id = ?'; params.push(team_id); }
  if (position) { query += ' AND p.position = ?'; params.push(position); }
  if (status) { query += ' AND p.status = ?'; params.push(status); }
  if (search) {
    query += ' AND (p.first_name LIKE ? OR p.last_name LIKE ? OR p.nickname LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY p.last_name, p.first_name';
  const players = db.prepare(query).all(...params);
  res.json(players);
});

// Get single player with stats
router.get('/:id', (req, res) => {
  const db = getDB();
  const player = db.prepare(`
    SELECT p.*, t.name as team_name, t.color as team_color
    FROM players p
    LEFT JOIN teams t ON p.team_id = t.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!player) return res.status(404).json({ error: 'Joueur introuvable' });

  // Stats from goals
  const stats = db.prepare(`
    SELECT
      COUNT(DISTINCT g.match_id) as matches_played,
      SUM(CASE WHEN g.scorer_id = ? THEN 1 ELSE 0 END) as goals,
      SUM(CASE WHEN g.assist1_id = ? OR g.assist2_id = ? THEN 1 ELSE 0 END) as assists,
      SUM(CASE WHEN g.scorer_id = ? THEN 1 ELSE 0 END) +
      SUM(CASE WHEN g.assist1_id = ? OR g.assist2_id = ? THEN 1 ELSE 0 END) as points
    FROM goals g
    INNER JOIN matches m ON g.match_id = m.id
    WHERE m.validated = 1 AND (g.scorer_id = ? OR g.assist1_id = ? OR g.assist2_id = ?)
  `).get(player.id, player.id, player.id, player.id, player.id, player.id, player.id, player.id, player.id);

  // Actual matches played
  const matchesPlayed = db.prepare(`
    SELECT COUNT(DISTINCT m.id) as count
    FROM matches m
    WHERE m.validated = 1 AND (m.home_team_id = ? OR m.away_team_id = ?)
  `).get(player.team_id || 0, player.team_id || 0);

  // Recent goals
  const recentGoals = db.prepare(`
    SELECT g.*, m.date, m.home_score, m.away_score,
           ht.name as home_team, at2.name as away_team,
           s.first_name || ' ' || s.last_name as scorer_name
    FROM goals g
    INNER JOIN matches m ON g.match_id = m.id
    INNER JOIN teams ht ON m.home_team_id = ht.id
    INNER JOIN teams at2 ON m.away_team_id = at2.id
    INNER JOIN players s ON g.scorer_id = s.id
    WHERE m.validated = 1 AND (g.scorer_id = ? OR g.assist1_id = ? OR g.assist2_id = ?)
    ORDER BY m.date DESC
    LIMIT 10
  `).all(player.id, player.id, player.id);

  res.json({ ...player, stats, recentGoals });
});

// Create player
router.post('/', authenticate, requireCaptainOrAdmin, (req, res) => {
  const { first_name, last_name, nickname, number, position, team_id, age, email, phone, status = 'active' } = req.body;
  if (!first_name || !last_name) return res.status(400).json({ error: 'Prénom et nom requis' });

  const db = getDB();
  const result = db.prepare(`
    INSERT INTO players (first_name, last_name, nickname, number, position, team_id, age, email, phone, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(first_name, last_name, nickname || null, number || null, position || 'C',
         team_id || null, age || null, email || null, phone || null, status);

  res.status(201).json({ id: result.lastInsertRowid, first_name, last_name });
});

// Update player
router.put('/:id', authenticate, requireCaptainOrAdmin, (req, res) => {
  const { first_name, last_name, nickname, number, position, team_id, age, email, phone, status } = req.body;
  const db = getDB();
  db.prepare(`
    UPDATE players SET first_name=?, last_name=?, nickname=?, number=?, position=?,
    team_id=?, age=?, email=?, phone=?, status=? WHERE id=?
  `).run(first_name, last_name, nickname || null, number || null, position || 'C',
         team_id || null, age || null, email || null, phone || null, status || 'active', req.params.id);
  res.json({ message: 'Joueur mis à jour' });
});

// Delete player
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  db.prepare('UPDATE players SET status = ? WHERE id = ?').run('inactive', req.params.id);
  res.json({ message: 'Joueur désactivé' });
});

// Hard delete
router.delete('/:id/hard', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM players WHERE id = ?').run(req.params.id);
  res.json({ message: 'Joueur supprimé' });
});

module.exports = router;
