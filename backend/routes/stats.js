const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

function resolveSeasonContext(db, seasonId, requestedType = null) {
  const seasons = db.prepare(`
    SELECT s.id, s.status, s.name, s.champion_team_id,
      (SELECT COUNT(*) FROM matches m WHERE m.season_id = s.id) AS total_matches,
      (SELECT COUNT(*) FROM matches m WHERE m.season_id = s.id AND m.is_playoff = 1) AS playoff_matches
    FROM seasons s
    ORDER BY s.id DESC
  `).all();
  const activeSeason =
    seasons.find(s => s.status === 'playoffs') ||
    seasons.find(s => s.status === 'completed' && (s.playoff_matches > 0 || s.champion_team_id)) ||
    seasons.find(s => s.status === 'active' && s.total_matches > 0) ||
    seasons.find(s => s.status === 'active') ||
    seasons.find(s => s.status === 'completed');
  const requestedSeason = seasonId ? seasons.find(season => String(season.id) === String(seasonId)) : null;
  const resolvedSeason = requestedSeason || activeSeason || null;
  return {
    seasonId: resolvedSeason?.id || null,
    type: requestedType || ((resolvedSeason?.status === 'playoffs' || resolvedSeason?.playoff_matches > 0) ? 'playoffs' : 'regular'),
  };
}

// Individual stats leaderboard
router.get('/players', (req, res) => {
  const db = getDB();
  // type: 'regular' (default) | 'playoffs' | 'all'
  const { season_id, limit = 50, sort = 'points', type } = req.query;
  const context = resolveSeasonContext(db, season_id, type);

  const goalFilters = [];
  const goalParams = [];
  const teamFilters = [];
  const teamParams = [];

  if (context.seasonId) {
    goalFilters.push('m.season_id = ?');
    teamFilters.push('tm.season_id = ?');
    goalParams.push(context.seasonId);
    teamParams.push(context.seasonId);
  }
  if (context.type === 'regular') {
    goalFilters.push('m.is_playoff = 0');
    teamFilters.push('tm.is_playoff = 0');
  }
  if (context.type === 'playoffs') {
    goalFilters.push('m.is_playoff = 1');
    teamFilters.push('tm.is_playoff = 1');
  }

  const goalFilter = goalFilters.length ? ` AND ${goalFilters.join(' AND ')}` : '';
  const teamFilter = teamFilters.length ? ` AND ${teamFilters.join(' AND ')}` : '';

  const rows = db.prepare(`
    SELECT
      p.id, p.first_name, p.last_name, p.nickname, p.number, p.position,
      p.team_id, t.name as team_name, t.color as team_color,
      (
        SELECT COUNT(DISTINCT tm.id)
        FROM matches tm
        WHERE tm.validated = 1
          AND p.team_id IS NOT NULL
          AND (tm.home_team_id = p.team_id OR tm.away_team_id = p.team_id)
          ${teamFilter}
      ) as matches_played,
      COALESCE(SUM(CASE WHEN g.scorer_id = p.id AND m.validated = 1 ${goalFilter} THEN 1 ELSE 0 END), 0) as goals,
      COALESCE(SUM(CASE WHEN (g.assist1_id = p.id OR g.assist2_id = p.id) AND m.validated = 1 ${goalFilter} THEN 1 ELSE 0 END), 0) as assists,
      COALESCE(SUM(CASE WHEN g.scorer_id = p.id AND m.validated = 1 ${goalFilter} THEN 1 ELSE 0 END), 0) +
      COALESCE(SUM(CASE WHEN (g.assist1_id = p.id OR g.assist2_id = p.id) AND m.validated = 1 ${goalFilter} THEN 1 ELSE 0 END), 0) as points
    FROM players p
    LEFT JOIN teams t ON p.team_id = t.id
    LEFT JOIN goals g ON (g.scorer_id = p.id OR g.assist1_id = p.id OR g.assist2_id = p.id)
    LEFT JOIN matches m ON g.match_id = m.id AND m.validated = 1
    WHERE p.status = 'active' AND p.position != 'G'
    GROUP BY p.id
    ORDER BY points DESC, goals DESC, assists DESC
    LIMIT ?
  `).all(
    ...teamParams,
    ...goalParams,
    ...goalParams,
    ...goalParams,
    ...goalParams,
    parseInt(limit)
  );

  res.json(rows);
});

// Team stats
router.get('/teams', (req, res) => {
  const db = getDB();
  const { season_id, type } = req.query;
  const context = resolveSeasonContext(db, season_id, type);
  const playoffFlag = context.type === 'playoffs' ? 1 : 0;

  const teams = db.prepare('SELECT * FROM teams ORDER BY name').all();

  let matchQuery = `
    SELECT home_team_id, away_team_id, home_score, away_score
    FROM matches
    WHERE validated = 1 AND is_playoff = ?
  `;
  const params = [playoffFlag];
  if (context.seasonId) { matchQuery += ' AND season_id = ?'; params.push(context.seasonId); }
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
  const { season_id, type } = req.query;
  const context = resolveSeasonContext(db, season_id, type);

  const filters = [];
  if (context.seasonId) filters.push(`m.season_id = ${Number(context.seasonId)}`);
  if (context.type === 'regular') filters.push('m.is_playoff = 0');
  if (context.type === 'playoffs') filters.push('m.is_playoff = 1');
  const whereClause = filters.length ? ` AND ${filters.join(' AND ')}` : '';

  const query = (order) => db.prepare(`
    SELECT p.id, p.first_name, p.last_name, p.number, t.name as team_name, t.color as team_color,
      SUM(CASE WHEN m.validated = 1 ${whereClause} AND g.scorer_id = p.id THEN 1 ELSE 0 END) as goals,
      SUM(CASE WHEN m.validated = 1 ${whereClause} AND (g.assist1_id = p.id OR g.assist2_id = p.id) THEN 1 ELSE 0 END) as assists,
      SUM(CASE WHEN m.validated = 1 ${whereClause} AND g.scorer_id = p.id THEN 1 ELSE 0 END) +
      SUM(CASE WHEN m.validated = 1 ${whereClause} AND (g.assist1_id = p.id OR g.assist2_id = p.id) THEN 1 ELSE 0 END) as points
    FROM players p
    LEFT JOIN teams t ON p.team_id = t.id
    LEFT JOIN goals g ON (g.scorer_id = p.id OR g.assist1_id = p.id OR g.assist2_id = p.id)
    LEFT JOIN matches m ON g.match_id = m.id AND m.validated = 1
    WHERE p.status = 'active' AND p.position != 'G'
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

router.get('/goalies', (req, res) => {
  const db = getDB();
  const { season_id, type } = req.query;
  const context = resolveSeasonContext(db, season_id, type);

  const filters = [`m.validated = 1`];
  const params = [];
  if (context.seasonId) {
    filters.push('m.season_id = ?');
    params.push(context.seasonId);
  }
  if (context.type === 'regular') filters.push('m.is_playoff = 0');
  if (context.type === 'playoffs') filters.push('m.is_playoff = 1');
  const filterSql = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const rows = db.prepare(`
    SELECT
      p.id,
      p.first_name,
      p.last_name,
      p.nickname,
      p.number,
      p.position,
      p.team_id,
      t.name AS team_name,
      t.color AS team_color,
      COALESCE(SUM(
        CASE
          WHEN m.home_goalie_id = p.id AND COALESCE(m.home_goalie_is_sub, 0) = 0 THEN 1
          WHEN m.away_goalie_id = p.id AND COALESCE(m.away_goalie_is_sub, 0) = 0 THEN 1
          ELSE 0
        END
      ), 0) AS matches_played,
      COALESCE(SUM(
        CASE
          WHEN m.home_goalie_id = p.id AND COALESCE(m.home_goalie_is_sub, 0) = 0 THEN m.away_score
          WHEN m.away_goalie_id = p.id AND COALESCE(m.away_goalie_is_sub, 0) = 0 THEN m.home_score
          ELSE 0
        END
      ), 0) AS goals_against
    FROM players p
    LEFT JOIN teams t ON p.team_id = t.id
    LEFT JOIN matches m ON (m.home_goalie_id = p.id OR m.away_goalie_id = p.id) ${filterSql ? `AND ${filters.join(' AND ')}` : ''}
    WHERE p.status = 'active' AND p.position = 'G'
    GROUP BY p.id
    ORDER BY
      CASE
        WHEN COALESCE(SUM(
          CASE
            WHEN m.home_goalie_id = p.id AND COALESCE(m.home_goalie_is_sub, 0) = 0 THEN 1
            WHEN m.away_goalie_id = p.id AND COALESCE(m.away_goalie_is_sub, 0) = 0 THEN 1
            ELSE 0
          END
        ), 0) > 0
        THEN (
          CAST(COALESCE(SUM(
            CASE
              WHEN m.home_goalie_id = p.id AND COALESCE(m.home_goalie_is_sub, 0) = 0 THEN m.away_score
              WHEN m.away_goalie_id = p.id AND COALESCE(m.away_goalie_is_sub, 0) = 0 THEN m.home_score
              ELSE 0
            END
          ), 0) AS FLOAT) /
          COALESCE(SUM(
            CASE
              WHEN m.home_goalie_id = p.id AND COALESCE(m.home_goalie_is_sub, 0) = 0 THEN 1
              WHEN m.away_goalie_id = p.id AND COALESCE(m.away_goalie_is_sub, 0) = 0 THEN 1
              ELSE 0
            END
          ), 1)
        )
        ELSE 9999
      END ASC,
      goals_against ASC,
      p.last_name ASC,
      p.first_name ASC
  `).all(...params);

  res.json(rows.map((row) => ({
    ...row,
    gaa: row.matches_played > 0 ? Number((row.goals_against / row.matches_played).toFixed(2)) : null,
  })));
});

module.exports = router;
module.exports.resolveSeasonContext = resolveSeasonContext;
