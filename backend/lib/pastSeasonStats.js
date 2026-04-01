const fs = require('fs');
const path = require('path');

const FIXTURE_PATH = path.join(__dirname, '..', 'data', 'past-season-stats.csv');
const FIXTURE_SEASON_NAME = 'Saison 2024-2025';

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

function parseCSVLine(line) {
  const cols = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cols.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cols.push(current.trim());
  return cols;
}

function toInt(value) {
  const raw = (value || '').toString().trim();
  if (!raw || raw === '-') return 0;
  const parsed = parseInt(raw.replace(',', '.'), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPreviousSeasonName(activeSeasonName) {
  return FIXTURE_SEASON_NAME;
}

function loadPastSeasonFixture() {
  if (!fs.existsSync(FIXTURE_PATH)) {
    throw new Error(`Fichier de stats introuvable: ${FIXTURE_PATH}`);
  }

  const text = fs.readFileSync(FIXTURE_PATH, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    throw new Error('Fichier de stats vide');
  }

  const headers = parseCSVLine(lines[0]).map(normalizeText);
  const idx = {
    firstName: headers.findIndex(header => header === 'prenom'),
    lastName: headers.findIndex(header => header === 'nom'),
    teamName: headers.findIndex(header => header === 'equipe'),
    gamesPlayed: headers.findIndex(header => header === 'pj'),
    goals: headers.findIndex(header => header === 'b'),
    assists: headers.findIndex(header => header === 'p'),
    points: headers.findIndex(header => header === 'pts'),
    pim: headers.findIndex(header => header === 'pun'),
  };

  if (idx.firstName === -1 || idx.lastName === -1 || idx.teamName === -1) {
    throw new Error('Le fichier de stats ne contient pas les colonnes attendues');
  }

  return lines.slice(1).map(line => {
    const cols = parseCSVLine(line);
    return {
      firstName: cols[idx.firstName] || '',
      lastName: cols[idx.lastName] || '',
      teamName: cols[idx.teamName] || '',
      gamesPlayed: idx.gamesPlayed >= 0 ? toInt(cols[idx.gamesPlayed]) : 0,
      goals: idx.goals >= 0 ? toInt(cols[idx.goals]) : 0,
      assists: idx.assists >= 0 ? toInt(cols[idx.assists]) : 0,
      points: idx.points >= 0 ? toInt(cols[idx.points]) : 0,
      pim: idx.pim >= 0 ? toInt(cols[idx.pim]) : 0,
    };
  }).filter(row => row.firstName && row.lastName && row.teamName);
}

function seedPastSeasonStats(db, activeSeason) {
  const rows = loadPastSeasonFixture();
  const previousSeasonName = getPreviousSeasonName(activeSeason.name);

  let previousSeason = db.prepare('SELECT * FROM seasons WHERE name = ?').get(previousSeasonName);
  if (!previousSeason) {
    const seasonInsert = db.prepare(
      'INSERT INTO seasons (name, start_date, end_date, status) VALUES (?, ?, ?, ?)'
    ).run(previousSeasonName, null, activeSeason.start_date || null, 'completed');
    previousSeason = db.prepare('SELECT * FROM seasons WHERE id = ?').get(seasonInsert.lastInsertRowid);
  } else {
    db.prepare("UPDATE seasons SET status = 'completed' WHERE id = ?").run(previousSeason.id);
  }

  db.prepare('DELETE FROM goals WHERE match_id IN (SELECT id FROM matches WHERE season_id = ?)').run(previousSeason.id);
  db.prepare('DELETE FROM matches WHERE season_id = ?').run(previousSeason.id);
  db.prepare('DELETE FROM playoff_series WHERE season_id = ?').run(previousSeason.id);
  db.prepare('DELETE FROM player_season_stats WHERE season_id = ?').run(previousSeason.id);

  const players = db.prepare('SELECT id, first_name, last_name FROM players').all();
  const teams = db.prepare('SELECT id, name FROM teams').all();
  const playerMap = new Map(players.map(player => [`${normalizeText(player.first_name)}|${normalizeText(player.last_name)}`, player]));
  const teamMap = new Map(teams.map(team => [normalizeText(team.name), team]));

  const insert = db.prepare(`
    INSERT OR REPLACE INTO player_season_stats
      (player_id, season_id, team_id, games_played, goals, assists, points, pim)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  const missingPlayers = [];
  const missingTeams = [];

  rows.forEach(row => {
    const player = playerMap.get(`${normalizeText(row.firstName)}|${normalizeText(row.lastName)}`);
    const team = teamMap.get(normalizeText(row.teamName));

    if (!player) {
      missingPlayers.push(`${row.firstName} ${row.lastName}`);
      return;
    }

    if (!team) {
      missingTeams.push(row.teamName);
      return;
    }

    insert.run(
      player.id,
      previousSeason.id,
      team.id,
      row.gamesPlayed,
      row.goals,
      row.assists,
      row.points || (row.goals + row.assists),
      row.pim
    );
    inserted++;
  });

  return {
    season: previousSeason,
    inserted,
    missingPlayers: [...new Set(missingPlayers)],
    missingTeams: [...new Set(missingTeams)],
  };
}

module.exports = {
  seedPastSeasonStats,
  getPreviousSeasonName,
};
