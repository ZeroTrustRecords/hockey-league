const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

function getVisibleSeason(db) {
  const season =
    db.prepare(`
      SELECT s.*,
        EXISTS(SELECT 1 FROM matches m WHERE m.season_id = s.id AND m.is_playoff = 1) AS has_playoff_games
      FROM seasons s
      WHERE s.status IN ('active', 'playoffs')
      ORDER BY s.id DESC
      LIMIT 1
    `).get() ||
    db.prepare(`
      SELECT s.*,
        EXISTS(SELECT 1 FROM matches m WHERE m.season_id = s.id AND m.is_playoff = 1) AS has_playoff_games
      FROM seasons s
      WHERE s.status = 'completed'
      ORDER BY s.id DESC
      LIMIT 1
    `).get();

  return season || null;
}

router.get('/', (req, res) => {
  const db = getDB();
  const { season_id, type } = req.query;
  const visibleSeason = getVisibleSeason(db);
  const resolvedSeasonId = season_id || visibleSeason?.id || null;
  const resolvedType = type || ((visibleSeason?.status === 'playoffs' || visibleSeason?.has_playoff_games) ? 'playoffs' : 'regular');
  const playoffFlag = resolvedType === 'playoffs' ? 1 : 0;

  const teams = db.prepare('SELECT * FROM teams ORDER BY name').all();

  let matchQuery = `
    SELECT home_team_id, away_team_id, home_score, away_score
    FROM matches
    WHERE validated = 1 AND is_playoff = ?
  `;
  const params = [playoffFlag];
  if (resolvedSeasonId) { matchQuery += ' AND season_id = ?'; params.push(resolvedSeasonId); }
  matchQuery += ' ORDER BY date ASC';

  const matches = db.prepare(matchQuery).all(...params);

  const map = {};
  for (const t of teams) {
    map[t.id] = { team_id: t.id, team_name: t.name, team_color: t.color, gp: 0, w: 0, l: 0, otl: 0, gf: 0, ga: 0, results: [] };
  }

  for (const m of matches) {
    const home = map[m.home_team_id];
    const away = map[m.away_team_id];
    if (!home || !away) continue;

    home.gp++; away.gp++;
    home.gf += m.home_score; home.ga += m.away_score;
    away.gf += m.away_score; away.ga += m.home_score;

    if (m.home_score > m.away_score) {
      home.w++; home.results.push('W');
      away.l++; away.results.push('L');
    } else {
      home.l++; home.results.push('L');
      away.w++; away.results.push('W');
    }
  }

  const standings = Object.values(map).map(s => {
    const pts = s.w * 2 + s.otl;
    const diff = s.gf - s.ga;
    const pct = s.gp > 0 ? parseFloat(((s.w / s.gp) * 100).toFixed(1)) : 0.0;
    const streak = s.results.slice(-5).reverse().join('');
    const last5 = s.results.slice(-5);
    return { team_id: s.team_id, team_name: s.team_name, team_color: s.team_color, gp: s.gp, w: s.w, l: s.l, otl: s.otl, pts, gf: s.gf, ga: s.ga, diff, pct, streak, last5 };
  });

  standings.sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.gf - a.gf);
  res.json(standings);
});

module.exports = router;
