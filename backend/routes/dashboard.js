const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

router.get('/', (req, res) => {
  const db = getDB();
  const isRegularSeasonReadyForPlayoffs = require('./playoffs').isRegularSeasonReadyForPlayoffs;
  const seasons = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM matches m WHERE m.season_id = s.id) AS total_matches,
      (SELECT COUNT(*) FROM matches m WHERE m.season_id = s.id AND m.validated = 1) AS validated_matches,
      (SELECT COUNT(*) FROM matches m WHERE m.season_id = s.id AND m.is_playoff = 1) AS playoff_matches,
      t.name as champion_name,
      t.color as champion_color
    FROM seasons s
    LEFT JOIN teams t ON s.champion_team_id = t.id
    ORDER BY s.id DESC
  `).all();
  const visibleSeason =
    seasons.find(s => s.status === 'playoffs') ||
    seasons.find(s => s.status === 'completed' && (s.playoff_matches > 0 || s.champion_team_id)) ||
    seasons.find(s => s.status === 'active' && s.total_matches > 0) ||
    seasons.find(s => s.status === 'active') ||
    seasons.find(s => s.status === 'completed') ||
    null;

  // Upcoming matches
  const upcoming = db.prepare(`
    SELECT m.*, ht.name as home_team_name, ht.color as home_color,
      at2.name as away_team_name, at2.color as away_color
    FROM matches m
    INNER JOIN teams ht ON m.home_team_id = ht.id
    INNER JOIN teams at2 ON m.away_team_id = at2.id
    WHERE m.status = 'scheduled' AND m.date >= datetime('now', '-1 hour')
    ORDER BY m.date ASC LIMIT 3
  `).all();

  // Recent results
  const recentResults = db.prepare(`
    SELECT m.*, ht.name as home_team_name, ht.color as home_color,
      at2.name as away_team_name, at2.color as away_color
    FROM matches m
    INNER JOIN teams ht ON m.home_team_id = ht.id
    INNER JOIN teams at2 ON m.away_team_id = at2.id
    WHERE m.validated = 1
    ORDER BY m.date DESC LIMIT 5
  `).all();

  // Determine active season to scope leaderboard stats
  const activeSeasonForStats = visibleSeason;

  // During playoffs or after a playoff run, show playoff stats for that visible season.
  const isPlayoffs  = activeSeasonForStats?.status === 'playoffs' || activeSeasonForStats?.playoff_matches > 0;
  const playoffFlag = isPlayoffs ? 1 : 0;
  const seasonId    = activeSeasonForStats?.id ?? 0;

  const playerStatsQuery = `
    SELECT p.id, p.first_name, p.last_name, p.number,
      t.name as team_name, t.color as team_color,
      SUM(CASE WHEN m.id IS NOT NULL AND g.scorer_id = p.id THEN 1 ELSE 0 END) as goals,
      SUM(CASE WHEN m.id IS NOT NULL AND (g.assist1_id = p.id OR g.assist2_id = p.id) THEN 1 ELSE 0 END) as assists,
      SUM(CASE WHEN m.id IS NOT NULL AND g.scorer_id = p.id THEN 1 ELSE 0 END) +
      SUM(CASE WHEN m.id IS NOT NULL AND (g.assist1_id = p.id OR g.assist2_id = p.id) THEN 1 ELSE 0 END) as points
    FROM players p
    LEFT JOIN teams t ON p.team_id = t.id
    LEFT JOIN goals g ON (g.scorer_id = p.id OR g.assist1_id = p.id OR g.assist2_id = p.id)
    LEFT JOIN matches m ON g.match_id = m.id AND m.validated = 1
                       AND m.season_id = ${seasonId} AND m.is_playoff = ${playoffFlag}
    WHERE p.status = 'active'
    GROUP BY p.id
  `;
  const topScorers  = db.prepare(playerStatsQuery + ' ORDER BY points DESC, goals DESC, assists DESC LIMIT 5').all();
  const topGoals    = db.prepare(playerStatsQuery + ' ORDER BY goals DESC, assists DESC, points DESC LIMIT 5').all();
  const topAssists  = db.prepare(playerStatsQuery + ' ORDER BY assists DESC, goals DESC, points DESC LIMIT 5').all();

  // Quick standings (single query)
  const standingsRaw = db.prepare(`
    SELECT t.id as team_id, t.name as team_name, t.color as team_color,
      COUNT(m.id) as gp,
      SUM(CASE WHEN (m.home_team_id=t.id AND m.home_score>m.away_score) OR (m.away_team_id=t.id AND m.away_score>m.home_score) THEN 1 ELSE 0 END) as w,
      SUM(CASE WHEN (m.home_team_id=t.id AND m.home_score<m.away_score) OR (m.away_team_id=t.id AND m.away_score<m.home_score) THEN 1 ELSE 0 END) as l,
      SUM(CASE WHEN (m.home_team_id=t.id AND m.home_score>m.away_score) OR (m.away_team_id=t.id AND m.away_score>m.home_score) THEN 2 ELSE 0 END) as pts,
      SUM(CASE WHEN m.home_team_id=t.id THEN m.home_score ELSE m.away_score END) as gf,
      SUM(CASE WHEN m.home_team_id=t.id THEN m.away_score ELSE m.home_score END) as ga
    FROM teams t
    LEFT JOIN matches m ON (m.home_team_id=t.id OR m.away_team_id=t.id) AND m.validated=1
                       AND m.season_id = ${seasonId} AND m.is_playoff=${playoffFlag}
    GROUP BY t.id
    ORDER BY pts DESC
  `).all();
  const standings = standingsRaw.map(s => ({ ...s, diff: s.gf - s.ga }));

  // Announcements
  const announcements = db.prepare(`
    SELECT m.*, u.username as sender_name
    FROM messages m
    INNER JOIN users u ON m.sender_id = u.id
    WHERE m.is_announcement = 1
    ORDER BY m.created_at DESC LIMIT 3
  `).all();

  // Counts
  const counts = {
    players: db.prepare("SELECT COUNT(*) as c FROM players WHERE status='active'").get().c,
    teams: db.prepare('SELECT COUNT(*) as c FROM teams').get().c,
    matches_played: db.prepare(
      `SELECT COUNT(*) as c FROM matches WHERE validated=1 AND season_id=${seasonId} AND is_playoff=${playoffFlag}`
    ).get().c,
    goals_total: db.prepare(
      `SELECT COUNT(*) as c FROM goals g INNER JOIN matches m ON g.match_id=m.id WHERE m.validated=1 AND m.season_id=${seasonId} AND m.is_playoff=${playoffFlag}`
    ).get().c,
  };

  const activeSeason = visibleSeason;

  let playoffsComingSoon = null;
  if (activeSeason?.status === 'active') {
    const regularSeasonCounts = db.prepare(`
      SELECT
        COUNT(*) AS total_games,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) AS scheduled_games,
        SUM(CASE WHEN status = 'completed' AND validated = 0 THEN 1 ELSE 0 END) AS pending_validation_games
      FROM matches
      WHERE season_id = ? AND is_playoff = 0
    `).get(activeSeason.id);

    const hasPlayoffSeries = db.prepare('SELECT COUNT(*) as c FROM playoff_series WHERE season_id = ?').get(activeSeason.id).c > 0;
    if (!hasPlayoffSeries && isRegularSeasonReadyForPlayoffs(regularSeasonCounts)) {
      playoffsComingSoon = {
        season_id: activeSeason.id,
        season_name: activeSeason.name,
        message: 'Le classement final est connu. Les éliminatoires arrivent bientôt.',
      };
    }
  }

  const activeSeasonWithContext = activeSeason ? { ...activeSeason, playoffs_coming_soon: Boolean(playoffsComingSoon) } : activeSeason;

  res.json({
    upcoming,
    recentResults,
    topScorers,
    topGoals,
    topAssists,
    standings,
    announcements,
    counts,
    activeSeason: activeSeasonWithContext,
    playoffsComingSoon,
  });
});

module.exports = router;
