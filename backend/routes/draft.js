const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authenticate, requireAdmin, requireCaptainOrAdmin } = require('../middleware/auth');

// Get draft status for a season
router.get('/season/:seasonId', (req, res) => {
  const db = getDB();
  const settings = db.prepare('SELECT * FROM draft_settings WHERE season_id = ?').get(req.params.seasonId);

  const picks = db.prepare(`
    SELECT dp.*, t.name as team_name, t.color as team_color,
      p.first_name, p.last_name, p.nickname, p.position, p.number, p.rating, p.rating_score
    FROM draft_picks dp
    INNER JOIN teams t ON dp.team_id = t.id
    LEFT JOIN players p ON dp.player_id = p.id
    WHERE dp.season_id = ?
    ORDER BY dp.round, dp.pick_number
  `).all(req.params.seasonId);

  const availablePlayers = db.prepare(`
    SELECT p.* FROM players p
    WHERE p.status = 'active'
    AND p.id NOT IN (
      SELECT player_id FROM draft_picks WHERE season_id = ? AND player_id IS NOT NULL
    )
    ORDER BY p.last_name
  `).all(req.params.seasonId);

  res.json({ settings, picks, availablePlayers });
});

// Initialize draft
router.post('/season/:seasonId/init', authenticate, requireAdmin, (req, res) => {
  const { total_rounds = 5, snake_mode = 1, team_order } = req.body;
  const db = getDB();
  const seasonId = parseInt(req.params.seasonId);

  const teams = db.prepare('SELECT id FROM teams ORDER BY name').all();
  const order = team_order || teams.map(t => t.id);
  const orderJson = JSON.stringify(order);

  // Reset
  db.prepare('DELETE FROM draft_picks WHERE season_id = ?').run(seasonId);
  db.prepare('INSERT OR REPLACE INTO draft_settings (season_id, total_rounds, snake_mode, current_round, current_pick, status, team_order) VALUES (?, ?, ?, 1, 1, ?, ?)').run(
    seasonId, total_rounds, snake_mode ? 1 : 0, 'active', orderJson
  );

  // Generate pick slots
  const insertPick = db.prepare('INSERT INTO draft_picks (season_id, round, pick_number, team_id) VALUES (?, ?, ?, ?)');
  let pickNum = 1;

  for (let r = 1; r <= total_rounds; r++) {
    const roundOrder = (snake_mode && r % 2 === 0) ? [...order].reverse() : order;
    for (let i = 0; i < roundOrder.length; i++) {
      insertPick.run(seasonId, r, pickNum++, roundOrder[i]);
    }
  }

  res.json({ message: 'Repêchage initialisé' });
});

// Make a pick
router.post('/season/:seasonId/pick', authenticate, requireCaptainOrAdmin, (req, res) => {
  const { player_id } = req.body;
  const db = getDB();
  const seasonId = parseInt(req.params.seasonId);

  const settings = db.prepare('SELECT * FROM draft_settings WHERE season_id = ?').get(seasonId);
  if (!settings || settings.status !== 'active') {
    return res.status(400).json({ error: 'Repêchage non actif' });
  }

  // Find next empty pick (exclude skipped picks where picked_at is set but player_id is null)
  const nextPick = db.prepare(`
    SELECT * FROM draft_picks
    WHERE season_id = ? AND player_id IS NULL AND picked_at IS NULL
    ORDER BY round, pick_number
    LIMIT 1
  `).get(seasonId);

  if (!nextPick) {
    db.prepare("UPDATE draft_settings SET status='completed' WHERE season_id=?").run(seasonId);
    return res.status(400).json({ error: 'Repêchage terminé' });
  }

  // Verify captain is picking for their team
  if (req.user.role === 'captain' && req.user.team_id !== nextPick.team_id) {
    return res.status(403).json({ error: 'Ce n\'est pas votre tour' });
  }

  // Check player not already picked
  const alreadyPicked = db.prepare('SELECT id FROM draft_picks WHERE season_id = ? AND player_id = ?').get(seasonId, player_id);
  if (alreadyPicked) return res.status(400).json({ error: 'Joueur déjà repêché' });

  // Make pick & assign player to team
  const makePick = db.transaction(() => {
    db.prepare('UPDATE draft_picks SET player_id=?, picked_at=CURRENT_TIMESTAMP WHERE id=?').run(player_id, nextPick.id);
    db.prepare('UPDATE players SET team_id=? WHERE id=?').run(nextPick.team_id, player_id);
  });

  makePick();

  // Check if draft complete
  const remaining = db.prepare('SELECT COUNT(*) as c FROM draft_picks WHERE season_id = ? AND player_id IS NULL AND picked_at IS NULL').get(seasonId);
  if (remaining.c === 0) {
    db.prepare("UPDATE draft_settings SET status='completed' WHERE season_id=?").run(seasonId);
  }

  res.json({ message: 'Choix effectué', pick: nextPick });
});

// Reset draft
router.post('/season/:seasonId/reset', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const seasonId = req.params.seasonId;

  const reset = db.transaction(() => {
    // Get all players who were drafted this season
    const picks = db.prepare('SELECT player_id FROM draft_picks WHERE season_id = ? AND player_id IS NOT NULL').all(seasonId);
    for (const p of picks) {
      db.prepare('UPDATE players SET team_id = NULL WHERE id = ?').run(p.player_id);
    }
    db.prepare('DELETE FROM draft_picks WHERE season_id = ?').run(seasonId);
    db.prepare('DELETE FROM draft_settings WHERE season_id = ?').run(seasonId);
  });

  reset();
  res.json({ message: 'Repêchage réinitialisé' });
});

// Skip current pick
router.post('/season/:seasonId/skip', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const seasonId = parseInt(req.params.seasonId);

  const nextPick = db.prepare(`
    SELECT * FROM draft_picks
    WHERE season_id = ? AND player_id IS NULL AND picked_at IS NULL
    ORDER BY round, pick_number LIMIT 1
  `).get(seasonId);

  if (!nextPick) return res.status(400).json({ error: 'Aucun choix restant' });

  // Mark as skipped with a special value (keep null but mark picked_at)
  db.prepare('UPDATE draft_picks SET picked_at=CURRENT_TIMESTAMP WHERE id=?').run(nextPick.id);
  res.json({ message: 'Choix passé' });
});

module.exports = router;
