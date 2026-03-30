const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authenticate, requireAdmin, requireCaptainOrAdmin } = require('../middleware/auth');

const matchQuery = `
  SELECT m.*,
    ht.name as home_team_name, ht.color as home_color,
    at2.name as away_team_name, at2.color as away_color,
    mvp.first_name || ' ' || mvp.last_name as mvp_name
  FROM matches m
  INNER JOIN teams ht ON m.home_team_id = ht.id
  INNER JOIN teams at2 ON m.away_team_id = at2.id
  LEFT JOIN players mvp ON m.mvp_id = mvp.id
`;

router.get('/', (req, res) => {
  const db = getDB();
  const { status, team_id, season_id, limit } = req.query;
  let query = matchQuery + ' WHERE 1=1';
  const params = [];

  if (status) { query += ' AND m.status = ?'; params.push(status); }
  if (team_id) { query += ' AND (m.home_team_id = ? OR m.away_team_id = ?)'; params.push(team_id, team_id); }
  if (season_id) { query += ' AND m.season_id = ?'; params.push(season_id); }
  query += ' ORDER BY m.date DESC';
  if (limit) { query += ' LIMIT ?'; params.push(parseInt(limit)); }

  res.json(db.prepare(query).all(...params));
});

router.get('/upcoming', (req, res) => {
  const db = getDB();
  const matches = db.prepare(matchQuery + ` WHERE m.status = 'scheduled' AND m.date >= datetime('now') ORDER BY m.date ASC LIMIT 5`).all();
  res.json(matches);
});

router.get('/:id', (req, res) => {
  const db = getDB();
  const match = db.prepare(matchQuery + ' WHERE m.id = ?').get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match introuvable' });

  const goals = db.prepare(`
    SELECT g.*,
      COALESCE(p.first_name || ' ' || p.last_name, 'Remplaçant') as scorer_name,
      a1.first_name || ' ' || a1.last_name as assist1_name,
      a2.first_name || ' ' || a2.last_name as assist2_name,
      t.name as team_name, t.color as team_color
    FROM goals g
    LEFT JOIN players p ON g.scorer_id = p.id
    LEFT JOIN players a1 ON g.assist1_id = a1.id
    LEFT JOIN players a2 ON g.assist2_id = a2.id
    INNER JOIN teams t ON g.team_id = t.id
    WHERE g.match_id = ?
    ORDER BY g.period, g.time_in_period
  `).all(req.params.id);

  res.json({ ...match, goals });
});

router.post('/', authenticate, requireCaptainOrAdmin, (req, res) => {
  const { home_team_id, away_team_id, date, location, season_id } = req.body;
  if (!home_team_id || !away_team_id || !date) return res.status(400).json({ error: 'Champs requis manquants' });

  const db = getDB();
  const result = db.prepare(`
    INSERT INTO matches (home_team_id, away_team_id, date, location, season_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(home_team_id, away_team_id, date, location || 'Aréna Municipal', season_id || null);

  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', authenticate, requireCaptainOrAdmin, (req, res) => {
  const { home_team_id, away_team_id, date, location, status, season_id } = req.body;
  const db = getDB();
  db.prepare(`
    UPDATE matches SET home_team_id=?, away_team_id=?, date=?, location=?, status=?, season_id=? WHERE id=?
  `).run(home_team_id, away_team_id, date, location, status, season_id, req.params.id);
  res.json({ message: 'Match mis à jour' });
});

// Submit game sheet (goals + scores)
router.post('/:id/gamesheet', authenticate, requireCaptainOrAdmin, (req, res) => {
  const db = getDB();
  const { goals, home_score, away_score, notes } = req.body;
  const matchId = req.params.id;

  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!match) return res.status(404).json({ error: 'Match introuvable' });

  const submitSheet = db.transaction(() => {
    // Clear existing goals
    db.prepare('DELETE FROM goals WHERE match_id = ?').run(matchId);

    // Insert goals
    if (goals && goals.length > 0) {
      const insertGoal = db.prepare(`
        INSERT INTO goals (match_id, team_id, scorer_id, assist1_id, assist2_id, period, time_in_period)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const g of goals) {
        insertGoal.run(matchId, g.team_id, g.scorer_id || null, g.assist1_id || null, g.assist2_id || null, g.period || 1, g.time_in_period || null);
      }
    }

    // Update match
    db.prepare(`
      UPDATE matches SET home_score=?, away_score=?, status='completed', notes=? WHERE id=?
    `).run(home_score || 0, away_score || 0, notes || null, matchId);
  });

  submitSheet();
  res.json({ message: 'Feuille de match sauvegardée' });
});

// Validate match (updates stats)
router.post('/:id/validate', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const matchId = req.params.id;

  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!match) return res.status(404).json({ error: 'Match introuvable' });

  db.prepare("UPDATE matches SET validated=1, status='completed' WHERE id=?").run(matchId);

  // Recalculate playoff series if this is a playoff game
  if (match.is_playoff && match.playoff_series_id) {
    const playoffsRouter = require('./playoffs');
    playoffsRouter.recalcSeries(db, match.playoff_series_id);
  }

  res.json({ message: 'Match validé' });
});

// Unvalidate match
router.post('/:id/unvalidate', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  db.prepare("UPDATE matches SET validated=0 WHERE id=?").run(req.params.id);
  res.json({ message: 'Validation annulée' });
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM matches WHERE id = ?').run(req.params.id);
  res.json({ message: 'Match supprimé' });
});

module.exports = router;
