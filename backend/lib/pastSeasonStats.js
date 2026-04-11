const fs = require('fs');
const path = require('path');

const FIXTURE_PATH = path.join(__dirname, '..', 'data', 'historical-season-stats.json');

function normalizeText(value) {
  return (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*\(.*\)\s*$/, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function parseSeasonYear(seasonName) {
  const match = String(seasonName || '').match(/(20\d{2})/);
  return match ? parseInt(match[1], 10) : 0;
}

function canonicalSeasonName(seasonName) {
  const year = parseSeasonYear(seasonName);
  return year > 0 ? `ÉTÉ - ${year}` : seasonName;
}

function loadHistoricalFixture() {
  if (!fs.existsSync(FIXTURE_PATH)) {
    throw new Error(`Fichier de stats historique introuvable: ${FIXTURE_PATH}`);
  }

  const raw = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const seasonMap = new Map();

  Object.entries(raw).forEach(([seasonName, rows]) => {
    if (!Array.isArray(rows)) return;
    const canonicalName = canonicalSeasonName(seasonName);
    const year = parseSeasonYear(canonicalName);
    if (year <= 0 || rows.length === 0) return;

    const bucket = seasonMap.get(canonicalName) || { seasonName: canonicalName, year, rows: [] };
    bucket.rows.push(...rows);
    seasonMap.set(canonicalName, bucket);
  });

  return [...seasonMap.values()].sort((a, b) => a.year - b.year);
}

function ensureHistoricalPlayer(db, playerMap, row) {
  const key = `${normalizeText(row.first_name)}|${normalizeText(row.last_name)}`;
  const existing = playerMap.get(key);
  if (existing) {
    if (row.position && existing.position !== row.position) {
      db.prepare(`UPDATE players SET position = ? WHERE id = ?`).run(row.position, existing.id);
      existing.position = row.position;
    }
    return existing;
  }

  const inserted = db.prepare(`
    INSERT INTO players (first_name, last_name, position, status)
    VALUES (?, ?, ?, 'inactive')
  `).run(row.first_name, row.last_name, row.position || 'A');

  const player = db.prepare(`
    SELECT id, first_name, last_name, status, position
    FROM players
    WHERE id = ?
  `).get(inserted.lastInsertRowid);

  playerMap.set(key, player);
  return player;
}

function seedPastSeasonStats(db, activeSeason) {
  const seasons = loadHistoricalFixture();
  if (!seasons.length) {
    return { seasons: [], inserted: 0, missingTeams: [] };
  }

  const allPlayers = db.prepare(`
    SELECT id, first_name, last_name, status, position
    FROM players
    ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, id ASC
  `).all();
  const playerMap = new Map();
  allPlayers.forEach((player) => {
    const key = `${normalizeText(player.first_name)}|${normalizeText(player.last_name)}`;
    if (!playerMap.has(key) || player.status === 'active') {
      playerMap.set(key, player);
    }
  });

  const teams = db.prepare('SELECT id, name FROM teams').all();
  const teamMap = new Map(teams.map((team) => [normalizeText(team.name), team]));

  const existingSeasonRows = db.prepare(`
    SELECT id, name
    FROM seasons
    WHERE name != ?
  `).all(activeSeason?.name || '');
  const existingSeasonMap = new Map(existingSeasonRows.map((season) => [season.name, season]));

  const insertSeason = db.prepare(`
    INSERT INTO seasons (name, start_date, end_date, status)
    VALUES (?, ?, ?, 'completed')
  `);
  const insertStats = db.prepare(`
    INSERT OR REPLACE INTO player_season_stats
      (player_id, season_id, stat_type, team_id, team_name, games_played, goals, assists, points, pim)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  const missingTeams = new Set();
  const seededSeasons = [];

  seasons.forEach((season) => {
    let seasonRow = existingSeasonMap.get(season.seasonName);
    if (!seasonRow) {
      const insertResult = insertSeason.run(season.seasonName, null, null);
      seasonRow = db.prepare('SELECT id, name FROM seasons WHERE id = ?').get(insertResult.lastInsertRowid);
      existingSeasonMap.set(seasonRow.name, seasonRow);
    } else {
      db.prepare(`UPDATE seasons SET status = 'completed', champion_team_id = NULL WHERE id = ?`).run(seasonRow.id);
    }

    db.prepare('DELETE FROM goals WHERE match_id IN (SELECT id FROM matches WHERE season_id = ?)').run(seasonRow.id);
    db.prepare('DELETE FROM matches WHERE season_id = ?').run(seasonRow.id);
    db.prepare('DELETE FROM playoff_series WHERE season_id = ?').run(seasonRow.id);
    db.prepare('DELETE FROM player_season_stats WHERE season_id = ?').run(seasonRow.id);

    season.rows.forEach((row) => {
      const player = ensureHistoricalPlayer(db, playerMap, row);
      const team = row.team_name ? teamMap.get(normalizeText(row.team_name)) : null;
      if (row.team_name && !team) missingTeams.add(row.team_name);

      insertStats.run(
        player.id,
        seasonRow.id,
        row.stat_type || 'regular',
        team?.id || null,
        row.team_name || null,
        row.games_played || 0,
        row.goals || 0,
        row.assists || 0,
        row.points || ((row.goals || 0) + (row.assists || 0)),
        row.pim || 0
      );
      inserted++;
    });

    seededSeasons.push({ id: seasonRow.id, name: seasonRow.name, rows: season.rows.length });
  });

  return {
    seasons: seededSeasons,
    inserted,
    missingTeams: [...missingTeams].sort((a, b) => a.localeCompare(b)),
  };
}

module.exports = {
  seedPastSeasonStats,
  loadHistoricalFixture,
};
