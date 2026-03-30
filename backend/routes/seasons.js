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
    db.prepare('DELETE FROM goals').run();
    db.prepare('DELETE FROM matches').run();
    db.prepare('DELETE FROM playoff_series').run();
    db.prepare('DELETE FROM draft_picks').run();
    db.prepare("UPDATE draft_settings SET status='pending', current_round=1, current_pick=1").run();
    db.prepare('DELETE FROM player_season_stats').run();
    db.prepare('UPDATE players SET team_id = NULL').run();
    db.prepare('DELETE FROM team_staff').run();
    db.prepare("UPDATE seasons SET status = 'completed' WHERE status IN ('active','playoffs')").run();
  })();
  db.pragma('foreign_keys = ON');
  res.json({ message: 'Réinitialisation complète effectuée' });
});

module.exports = router;
