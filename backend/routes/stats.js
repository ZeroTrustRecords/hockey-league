const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// Individual stats leaderboard
router.get('/players', (req, res) => {
  const db = getDB();
  // type: 'regular' (default) | 'playoffs' | 'all'
  const { season_id, limit = 50, sort = 'points', type = 'regular' } = req.query;

  const filters = [];
  const params  = [];

  if (season_id) {
    filters.push('m.season_id = ?');
    params.push(season_id, season_id, season_id, season_id);
  }
  if (type === 'regular')  { filters.push('m.is_playoff = 0'); }
  if (type === 'playoffs') { filters.push('m.is_playoff = 1'); }

  const seasonFilter = filters.length ? 'AND ' + filters.join(' AND ') : '';

  const rows = db.prepare(`
    SELECT
      p.id, p.first_name, p.last_name, p.nickname, p.number, p.position,
      p.team_id, t.name as team_name, t.color as team_color,
      COUNT(DISTINCT CASE WHEN (g.scorer_id = p.id OR g.assist1_id = p.id OR g.assist2_id = p.id) THEN m.id END) as matches_played,
      SUM(CASE WHEN g.scorer_id = p.id AND m.validated = 1 ${seasonFilter} THEN 1 ELSE 0 END) as goals,
      SUM(CASE WHEN (g.assist1_id = p.id OR g.assist2_id = p.id) AND m.validated = 1 ${seasonFilter} THEN 1 ELSE 0 END) as assists,
      SUM(CASE WHEN g.scorer_id = p.id AND m.validated = 1 ${seasonFilter} THEN 1 ELSE 0 END) +
      SUM(CASE WHEN (g.assist1_id = p.id OR g.assist2_id = p.id) AND m.validated = 1 ${seasonFilter} THEN 1 ELSE 0 END) as points
    FROM players p
    LEFT JOIN teams t ON p.team_id = t.id
    LEFT JOIN goals g ON (g.scorer_id = p.id OR g.assist1_id = p.id OR g.assist2_id = p.id)
    LEFT JOIN matches m ON g.match_id = m.id AND m.validated = 1
    WHERE p.status = 'active'
    GROUP BY p.id
    ORDER BY points DESC, goals DESC, assists DESC
    LIMIT ?
  `).all(...(params.length ? params : []), parseInt(limit));

  res.json(rows);
});

// Team stats
router.get('/teams', (req, res) => {
  const db = getDB();
  const { season_id } = req.query;

  const teams = db.prepare('SELECT * FROM teams ORDER BY name').all();

  let matchQuery = `
    SELECT home_team_id, away_team_id, home_score, away_score
    FROM matches
    WHERE validated = 1 AND is_playoff = 0
  `;
  const params = [];
  if (season_id) { matchQuery += ' AND season_id = ?'; params.push(season_id); }
  matchQuery += ' ORDER BY date ASC';

  const matches = db.prepare(matchQuery).all(...params);

  const map = {};
  for (const t of teams) {
    map[t.id] = { team_id: t.id, team_name: t.name, team_color: t.color, gp: 0, w: 0, l: 0, gf: 0, ga: 0, last5: [] };
  }

  for (const m of matches) {
    const home = map[m.home_team_id];
    const away = map[m.away_team_id];
    if (!home || !away) continue;

    home.gp++; away.gp++;
    home.gf += m.home_score; home.ga += m.away_score;
    away.gf += m.away_score; away.ga += m.home_score;

    if (m.home_score > m.away_score) {
      home.w++; home.last5.push('W');
      away.l++; away.last5.push('L');
    } else {
      home.l++; home.last5.push('L');
      away.w++; away.last5.push('W');
    }
  }

  const result = Object.values(map).map(s => ({
    team_id: s.team_id, team_name: s.team_name, team_color: s.team_color,
    gp: s.gp, w: s.w, l: s.l, gf: s.gf, ga: s.ga, diff: s.gf - s.ga,
    avg_gf: s.gp > 0 ? parseFloat((s.gf / s.gp).toFixed(2)) : 0,
    avg_ga: s.gp > 0 ? parseFloat((s.ga / s.gp).toFixed(2)) : 0,
    last5: s.last5.slice(-5)
  }));

  result.sort((a, b) => b.w - a.w || b.diff - a.diff);
  res.json(result);
});

// Leaders (top 5 in each category)
router.get('/leaders', (req, res) => {
  const db = getDB();

  const query = (order) => db.prepare(`
    SELECT p.id, p.first_name, p.last_name, p.number, t.name as team_name, t.color as team_color,
      SUM(CASE WHEN g.scorer_id = p.id THEN 1 ELSE 0 END) as goals,
      SUM(CASE WHEN g.assist1_id = p.id OR g.assist2_id = p.id THEN 1 ELSE 0 END) as assists,
      SUM(CASE WHEN g.scorer_id = p.id THEN 1 ELSE 0 END) +
      SUM(CASE WHEN g.assist1_id = p.id OR g.assist2_id = p.id THEN 1 ELSE 0 END) as points
    FROM players p
    LEFT JOIN teams t ON p.team_id = t.id
    LEFT JOIN goals g ON (g.scorer_id = p.id OR g.assist1_id = p.id OR g.assist2_id = p.id)
    LEFT JOIN matches m ON g.match_id = m.id AND m.validated = 1
    WHERE p.status = 'active'
    GROUP BY p.id
    ORDER BY ${order} DESC, points DESC
    LIMIT 5
  `).all();

  res.json({
    goals: query('goals'),
    assists: query('assists'),
    points: query('points')
  });
});

module.exports = router;
