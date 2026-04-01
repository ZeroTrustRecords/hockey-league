const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authenticate, requireAdmin, requireCaptainOrAdmin } = require('../middleware/auth');
const { logAudit } = require('../lib/auditLog');

function getVisibleSeason(db) {
  const seasons = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM matches m WHERE m.season_id = s.id) AS total_matches,
      (SELECT COUNT(*) FROM matches m WHERE m.season_id = s.id AND m.is_playoff = 1) AS playoff_matches
    FROM seasons s
    ORDER BY s.id DESC
  `).all();
  const season =
    seasons.find(s => s.status === 'playoffs') ||
    seasons.find(s => s.status === 'completed' && (s.playoff_matches > 0 || s.champion_team_id)) ||
    seasons.find(s => s.status === 'active' && s.total_matches > 0) ||
    seasons.find(s => s.status === 'active') ||
    seasons.find(s => s.status === 'completed');

  return season || null;
}

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

  const currentSeason = getVisibleSeason(db);
  const currentPhase = currentSeason && (currentSeason.status === 'playoffs' || currentSeason.playoff_matches > 0) ? 1 : 0;

  const emptyStats = { matches_played: 0, goals: 0, assists: 0, points: 0 };
  const stats = currentSeason ? db.prepare(`
    SELECT
      COUNT(DISTINCT g.match_id) as matches_played,
      COALESCE(SUM(CASE WHEN g.scorer_id = ? THEN 1 ELSE 0 END), 0) as goals,
      COALESCE(SUM(CASE WHEN g.assist1_id = ? OR g.assist2_id = ? THEN 1 ELSE 0 END), 0) as assists,
      COALESCE(SUM(CASE WHEN g.scorer_id = ? THEN 1 ELSE 0 END), 0) +
      COALESCE(SUM(CASE WHEN g.assist1_id = ? OR g.assist2_id = ? THEN 1 ELSE 0 END), 0) as points
    FROM goals g
    INNER JOIN matches m ON g.match_id = m.id
    WHERE m.validated = 1 AND m.season_id = ? AND m.is_playoff = ?
      AND (g.scorer_id = ? OR g.assist1_id = ? OR g.assist2_id = ?)
  `).get(
    player.id, player.id, player.id,
    player.id, player.id, player.id,
    currentSeason.id,
    currentPhase,
    player.id, player.id, player.id
  ) : emptyStats;

  // Actual matches played
  const matchesPlayed = currentSeason ? db.prepare(`
    SELECT COUNT(DISTINCT m.id) as count
    FROM matches m
    WHERE m.validated = 1 AND m.season_id = ? AND m.is_playoff = ? AND (m.home_team_id = ? OR m.away_team_id = ?)
  `).get(currentSeason.id, currentPhase, player.team_id || 0, player.team_id || 0) : { count: 0 };

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

  res.json({
    ...player,
    stats: {
      ...stats,
      matches_played: matchesPlayed.count || 0,
    },
    recentGoals,
  });
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

// Quick team assignment (just update team_id)
router.patch('/:id/team', authenticate, requireAdmin, (req, res) => {
  const { team_id } = req.body;
  const db = getDB();
  db.prepare('UPDATE players SET team_id = ? WHERE id = ?').run(team_id || null, req.params.id);
  res.json({ message: 'Équipe mise à jour' });
});

router.patch('/:id/jersey-number', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const playerId = parseInt(req.params.id, 10);
  const rawNumber = req.body?.number;
  const player = db.prepare('SELECT id, team_id FROM players WHERE id = ?').get(playerId);

  if (!player) return res.status(404).json({ error: 'Joueur introuvable' });

  if (rawNumber === '' || rawNumber == null) {
    db.prepare('UPDATE players SET number = NULL WHERE id = ?').run(playerId);
    return res.json({ message: 'Numero retire', number: null });
  }

  const number = parseInt(rawNumber, 10);
  if (!Number.isInteger(number) || number < 1 || number > 99) {
    return res.status(400).json({ error: 'Le numero doit etre entre 1 et 99' });
  }

  if (player.team_id) {
    const duplicate = db.prepare(`
      SELECT id FROM players
      WHERE team_id = ? AND number = ? AND id != ? AND status = 'active'
      LIMIT 1
    `).get(player.team_id, number, playerId);

    if (duplicate) {
      return res.status(400).json({ error: 'Ce numero est deja utilise dans cette equipe' });
    }
  }

  db.prepare('UPDATE players SET number = ? WHERE id = ?').run(number, playerId);
  logAudit(db, {
    user_id: req.user.id,
    username: req.user.username,
    action: 'player.jersey-number.updated',
    entity_type: 'player',
    entity_id: playerId,
    details: { number, team_id: player.team_id || null },
  });
  res.json({ message: 'Numero mis a jour', number });
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

// Career stats per season (history) — regular season and playoffs separated
router.get('/:id/history', (req, res) => {
  const db = getDB();
  const playerId = parseInt(req.params.id);
  const player = db.prepare('SELECT id, team_id FROM players WHERE id = ?').get(playerId);
  if (!player) return res.status(404).json({ error: 'Joueur introuvable' });

  const rowsFromGoals = db.prepare(`
    SELECT
      s.id        AS season_id,
      s.name      AS season_name,
      m.is_playoff,
      g.team_id,
      t.name      AS team_name,
      t.color     AS team_color,
      COUNT(DISTINCT m.id) AS matches_played,
      COALESCE(SUM(CASE WHEN g.scorer_id = ? THEN 1 ELSE 0 END), 0)                      AS goals,
      COALESCE(SUM(CASE WHEN g.assist1_id = ? OR g.assist2_id = ? THEN 1 ELSE 0 END), 0) AS assists
    FROM goals g
    JOIN matches m ON g.match_id  = m.id
    JOIN seasons s ON m.season_id = s.id
    JOIN teams   t ON g.team_id   = t.id
    WHERE m.validated = 1
      AND (g.scorer_id = ? OR g.assist1_id = ? OR g.assist2_id = ?)
    GROUP BY s.id, s.name, m.is_playoff, g.team_id, t.name, t.color
    ORDER BY s.start_date DESC, s.id DESC, m.is_playoff ASC, t.name ASC
  `).all(playerId, playerId, playerId, playerId, playerId, playerId);

  const teamSeasonRows = player.team_id ? db.prepare(`
    SELECT
      s.id        AS season_id,
      s.name      AS season_name,
      m.is_playoff,
      COALESCE(pss.team_id, ?) AS team_id,
      t.name      AS team_name,
      t.color     AS team_color,
      COUNT(DISTINCT m.id) AS matches_played,
      COALESCE(SUM(CASE WHEN g.scorer_id = ? THEN 1 ELSE 0 END), 0)                      AS goals,
      COALESCE(SUM(CASE WHEN g.assist1_id = ? OR g.assist2_id = ? THEN 1 ELSE 0 END), 0) AS assists
    FROM matches m
    JOIN seasons s ON m.season_id = s.id
    LEFT JOIN player_season_stats pss ON pss.player_id = ? AND pss.season_id = s.id AND m.is_playoff = 0
    LEFT JOIN teams t ON t.id = COALESCE(pss.team_id, ?)
    LEFT JOIN goals g ON g.match_id = m.id
    WHERE m.validated = 1
      AND (
        m.home_team_id = COALESCE(pss.team_id, ?)
        OR m.away_team_id = COALESCE(pss.team_id, ?)
      )
    GROUP BY s.id, s.name, m.is_playoff, COALESCE(pss.team_id, ?), t.name, t.color
  `).all(
    player.team_id,
    playerId,
    playerId,
    playerId,
    playerId,
    player.team_id,
    player.team_id,
    player.team_id,
    player.team_id
  ) : [];

  const archivedRows = db.prepare(`
    SELECT
      s.id        AS season_id,
      s.name      AS season_name,
      0           AS is_playoff,
      pss.team_id,
      t.name      AS team_name,
      t.color     AS team_color,
      pss.games_played AS matches_played,
      pss.goals,
      pss.assists,
      pss.points
    FROM player_season_stats pss
    JOIN seasons s ON pss.season_id = s.id
    LEFT JOIN teams t ON pss.team_id = t.id
    WHERE pss.player_id = ?
      AND NOT EXISTS (
        SELECT 1 FROM matches m
        WHERE m.season_id = pss.season_id AND m.validated = 1 AND m.is_playoff = 0
      )
  `).all(playerId);

  const deduped = new Map();
  [...rowsFromGoals.map(r => ({ ...r, points: r.goals + r.assists })), ...teamSeasonRows.map(r => ({ ...r, points: r.goals + r.assists })), ...archivedRows]
    .forEach(row => {
      const key = `${row.season_id}|${row.is_playoff}|${row.team_id || 'none'}`;
      const existing = deduped.get(key);
      if (!existing || (existing.goals + existing.assists) < (row.goals + row.assists) || existing.matches_played < row.matches_played) {
        deduped.set(key, row);
      }
    });

  const rows = [...deduped.values()]
    .sort((a, b) => {
      const aYearMatch = (a.season_name || '').match(/(\d{4})/);
      const bYearMatch = (b.season_name || '').match(/(\d{4})/);
      const aYear = aYearMatch ? parseInt(aYearMatch[1], 10) : 0;
      const bYear = bYearMatch ? parseInt(bYearMatch[1], 10) : 0;
      if (aYear !== bYear) return bYear - aYear;
      if (a.season_id !== b.season_id) return b.season_id - a.season_id;
      if (a.is_playoff !== b.is_playoff) return b.is_playoff - a.is_playoff;
      return (a.team_name || '').localeCompare(b.team_name || '');
    });

  res.json(rows);
});

module.exports = router;
