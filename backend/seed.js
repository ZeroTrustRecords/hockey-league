const bcrypt = require('bcryptjs');
const { getDB, initDB } = require('./db');

function seed() {
  initDB();
  const db = getDB();

  console.log('🌱 Seeding demo data...\n');

  // Clear existing data
  db.exec(`
    DELETE FROM goals; DELETE FROM attendance; DELETE FROM message_reads;
    DELETE FROM messages; DELETE FROM draft_picks; DELETE FROM draft_settings;
    DELETE FROM team_staff; DELETE FROM users;
    DELETE FROM matches; DELETE FROM player_season_stats; DELETE FROM players;
    DELETE FROM teams; DELETE FROM seasons;
  `);

  // --- SEASONS ---
  // Historical season (completed — stats imported from CSV export)
  const histSeason = db.prepare("INSERT INTO seasons (name, start_date, end_date, status) VALUES (?, ?, ?, ?)").run('Saison 2024-2025', '2024-09-01', '2025-04-30', 'completed');
  const histSeasonId = histSeason.lastInsertRowid;

  // Active season
  const season = db.prepare("INSERT INTO seasons (name, start_date, end_date, status) VALUES (?, ?, ?, ?)").run('Saison 2025-2026', '2026-04-13', '2026-08-31', 'active');
  const seasonId = season.lastInsertRowid;

  // --- TEAMS ---
  const teamsData = [
    { name: 'Rangers',   color: '#0033A0' },
    { name: 'Canadiens', color: '#AF1E2D' },
    { name: 'Flyers',    color: '#F74902' },
    { name: 'Blues',     color: '#002F87' },
    { name: 'Stars',     color: '#006847' },
    { name: 'Bruins',    color: '#FFB81C' },
  ];

  const teams = teamsData.map(t => {
    const r = db.prepare("INSERT INTO teams (name, color) VALUES (?, ?)").run(t.name, t.color);
    return { id: r.lastInsertRowid, ...t };
  });

  // --- PLAYERS (real LHMA roster from CSV export) ---
  // All start with NULL team_id — assigned during the 2025-2026 draft
  // score→rating: 6=A+, 5=A, 4=B+, 3=B, 2=C, 1=D
  // Columns: [first, last, pos, rating, score, histTeamIdx, pj, goals, assists, pim]
  // histTeamIdx: 0=Rangers 1=Canadiens 2=Flyers 3=Blues 4=Stars 5=Bruins
  const playersData = [
    // ── Canadiens ──────────────────────────────────────────────────────────────
    ['Marc Antoine', 'Aylwin',          'A', 'B+', 4, 1, 15,  8, 16, 10],
    ['Jocelyn',      'Comtois',         'A', 'B+', 4, 1, 14, 14, 16,  6],
    ['Éric',         'De Sousa',        'G', 'B+', 4, 1, 13,  0,  0,  0],
    ['Patrick',      'Desmeules',       'A', 'B+', 4, 1, 11,  2,  5, 16],
    ['Karl',         'Gravel',          'A', 'C',  2, 1, 12,  0,  5, 16],
    ['Benoit',       'Laplante',        'D', 'B+', 4, 1, 13,  1,  4,  6],
    ['Stéphane',     'Martin',          'D', 'B+', 4, 1, 14,  3,  8,  2],
    ['Marc',         'Quesnel',         'A', 'A',  5, 1, 10, 10, 12,  0],
    ['Gabriel',      'Richer',          'D', 'A+', 6, 1, 11, 12, 10,  0],
    ['Philippe',     'Thibault',        'D', 'B',  3, 1,  0,  0,  0,  0],
    ['Martin',       'Verville',        'A', 'A',  5, 1, 15, 11, 26,  2],
    // ── Stars ──────────────────────────────────────────────────────────────────
    ['Sébastien',    'Cool',            'A', 'B',  3, 4, 11,  6,  1,  4],
    ['Yannick',      'Lapointe',        'A', 'A+', 6, 4, 13, 27, 16,  4],
    ['Richard',      'Larouche',        'A', 'C',  2, 4,  7,  0,  0,  2],
    ['Marc-André',   'Lebel',           'D', 'A',  5, 4, 12,  3,  3, 10],
    ['Patrick',      'Marcil',          'G', 'B+', 4, 4, 11,  0,  1,  0],
    ['François',     'Noël',            'D', 'B+', 4, 4, 10,  2,  4, 10],
    ['Charles',      'Noël',            'D', 'B+', 4, 4, 12,  1,  1,  2],
    ['Marc Alexandre','Paradis',        'A', 'B',  3, 4,  0,  0,  0,  0],
    ['Maxime',       'Perreault',       'A', 'A',  5, 4, 10,  4,  9,  2],
    ['Mathieu',      'Pilon',           'D', 'B',  3, 4,  7,  0,  3,  8],
    ['Shawn',        'Whaley',          'A', 'A',  5, 4,  6,  6,  9,  4],
    // ── Flyers ─────────────────────────────────────────────────────────────────
    ['Roxanne',      'Beliveau',        'D', 'B',  3, 2,  4,  0,  4,  4],
    ['Éric',         'Bertrand',        'A', 'B+', 4, 2, 12, 11,  7,  4],
    ['Jean Marc',    'Le Bouthillier',  'A', 'A',  5, 2, 14, 11, 27,  2],
    ['Alexy',        'Le Bouthillier',  'A', 'A+', 6, 2, 15, 25, 24,  2],
    ['Benoit',       'Lefebvre',        'A', 'B',  3, 2, 15,  2,  6,  4],
    ['Ghislain',     'Mathieu',         'G', 'B',  3, 2, 13,  0,  1,  0],
    ['Julien',       'Meunier',         'D', 'A',  5, 2, 12,  2,  8, 10],
    ['Guillaume',    'Parent',          'D', 'B+', 4, 2,  6,  4,  4,  2],
    ['Malick',       'Plante-Girard',   'A', 'B+', 4, 2, 14,  3,  6, 11],
    ['Fils',         'Poulin',          'A', 'A+', 6, 2, 12, 15, 19,  6],
    ['Bruno',        'Poulin',          'D', 'D',  1, 2, 11,  0,  5,  8],
    // ── Rangers ────────────────────────────────────────────────────────────────
    ['Nicolas',      'Fortin',          'A', 'B+', 4, 0,  9,  9,  3,  4],
    ['Bruno',        'Labrecque',       'A', 'B',  3, 0,  0,  0,  0,  0],
    ['Julien',       'Lacerte',         'D', 'B+', 4, 0,  9,  2,  6, 10],
    ['Keven',        'Messier',         'A', 'A',  5, 0, 13,  6, 16, 14],
    ['Yannick',      'Peccia',          'A', 'B',  3, 0, 12,  2,  5,  2],
    ['Renaud',       'Petitclerc',      'A', 'B+', 4, 0, 12,  8, 19,  6],
    ['Alexandre',    'Plante',          'A', 'A+', 6, 0, 14, 18, 18,  4],
    ['Julien',       'Prescott',        'D', 'B+', 4, 0, 11,  3,  7,  4],
    ['Daomi',        'Rousseau',        'D', 'A+', 6, 0,  7,  2,  2,  2],
    ['Martin',       'Tousignant',      'D', 'B+', 4, 0,  0,  0,  0,  0],
    ['Benoit',       'Tremblay',        'G', 'C',  2, 0, 15,  0,  0,  0],
    // ── Bruins ─────────────────────────────────────────────────────────────────
    ['Alex',         'Barbusci',        'A', 'B+', 4, 5, 13,  7,  7,  0],
    ['Sébastien',    'Belhumeur',       'D', 'B+', 4, 5, 13,  4,  9,  2],
    ['Robert',       'Blanchette',      'A', 'B+', 4, 5,  7,  4, 12,  6],
    ['Steve',        'Caney',           'D', 'A',  5, 5, 15,  6, 12,  6],
    ['Frédéric',     'Charest',         'A', 'A',  5, 5, 10, 12,  8,  4],
    ['Jean Christophe','Dubé',          'A', 'B',  3, 5,  0,  0,  0,  0],
    ['Olivier',      'Duchesne',        'A', 'B',  3, 5, 10,  6,  8,  4],
    ['Simon',        'Gaudreault',      'D', 'B+', 4, 5,  8,  3,  4,  4],
    ['Jocelyn',      'Mathieu',         'D', 'D',  1, 5, 12,  1,  3,  0],
    ['Jean Philippe','Perreault',       'G', 'A+', 6, 5, 12,  0,  0,  0],
    ['Jean-Philippe','Savard',          'A', 'A',  5, 5,  8,  7,  9,  2],
    // ── Blues ──────────────────────────────────────────────────────────────────
    ['Guillaume',    'Beaudoin',        'A', 'A',  5, 3, 12, 13, 14,  8],
    ['Patrick',      'Binet',           'A', 'B+', 4, 3, 14,  8, 14,  8],
    ['Juan',         'Bolivar',         'D', 'A',  5, 3, 11,  5,  8, 10],
    ['Maxime',       'Duchesneau',      'D', 'B+', 4, 3, 10,  3,  6,  4],
    ['Jasmin',       'Landry',          'A', 'A',  5, 3, 11,  9, 12,  0],
    ['Pierre-Olivier','Lauzon',         'A', 'A',  5, 3, 13, 15, 15,  3],
    ['Serge',        'Lauzon',          'A', 'D',  1, 3, 13,  4,  4,  0],
    ['Michael',      'Mc lean',         'G', 'A+', 6, 3, 14,  0,  1,  0],
    ['Bruno',        'Mercure',         'D', 'B',  3, 3, 13,  1,  6,  6],
    ['Nicolas',      'Teasdale',        'A', 'B+', 4, 3,  9,  5, 15,  4],
    ['Fred',         'Yergeau',         'D', 'C',  2, 3, 13,  0,  4,  8],
  ];

  const insertPlayer = db.prepare(
    "INSERT INTO players (first_name, last_name, position, team_id, status, rating, rating_score) VALUES (?, ?, ?, NULL, 'active', ?, ?)"
  );
  const insertHistStat = db.prepare(
    "INSERT INTO player_season_stats (player_id, season_id, team_id, games_played, goals, assists, points, pim) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );

  const allPlayers = [];
  for (const [fn, ln, pos, rating, score, histTeamIdx, pj, goals, assists, pim] of playersData) {
    const r = insertPlayer.run(fn, ln, pos, rating, score);
    const playerId = r.lastInsertRowid;
    allPlayers.push({ id: playerId, fn, ln, histTeamIdx });

    // Historical stats for 2024-2025 season
    if (pj > 0) {
      insertHistStat.run(playerId, histSeasonId, teams[histTeamIdx].id, pj, goals, assists, goals + assists, pim);
    }
  }

  // Helper: find player by last name (unique enough for setup)
  const findPlayer = (ln) => allPlayers.find(p => p.ln === ln);

  // --- TEAM STAFF (real captains from CSV) ---
  const captainNames = {
    0: 'Messier',       // Rangers
    1: 'Verville',      // Canadiens
    2: 'Lefebvre',      // Flyers
    3: 'Bolivar',       // Blues
    4: 'Lapointe',      // Stars
    5: 'Barbusci',      // Bruins
  };
  for (const [tIdx, ln] of Object.entries(captainNames)) {
    const t = teams[parseInt(tIdx)];
    const cap = findPlayer(ln);
    if (cap) db.prepare("INSERT OR IGNORE INTO team_staff (team_id, player_id, role) VALUES (?, ?, 'captain')").run(t.id, cap.id);
  }

  // --- USERS ---
  const hash = bcrypt.hashSync('password123', 10);
  db.prepare("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'admin')").run('admin', 'admin@lhma.ca', hash);

  for (const [tIdx, ln] of Object.entries(captainNames)) {
    const t = teams[parseInt(tIdx)];
    const cap = findPlayer(ln);
    if (cap) {
      db.prepare("INSERT INTO users (username, password_hash, role, player_id, team_id) VALUES (?, ?, 'captain', ?, ?)").run(
        `cap_${t.name.toLowerCase()}`, hash, cap.id, t.id
      );
    }
  }

  // One regular player account per team (first non-captain A player)
  for (let tIdx = 0; tIdx < teams.length; tIdx++) {
    const t = teams[tIdx];
    const capLn = captainNames[tIdx];
    const player = allPlayers.find(p => p.histTeamIdx === tIdx && p.ln !== capLn);
    if (player) {
      db.prepare("INSERT INTO users (username, password_hash, role, player_id, team_id) VALUES (?, ?, 'player', ?, ?)").run(
        `joueur_${t.name.toLowerCase()}`, hash, player.id, t.id
      );
    }
  }

  // --- MATCHES (calendrier officiel LHMA 2025-2026 — tous à venir) ---
  // Index: 0=Rangers 1=Canadiens 2=Flyers 3=Blues 4=Stars 5=Bruins
  const schedule = [
    ['2026-04-13 21:00', 0, 1], ['2026-04-15 21:00', 2, 3], ['2026-04-16 20:00', 4, 5],
    ['2026-04-20 21:00', 2, 4], ['2026-04-22 21:00', 1, 5], ['2026-04-23 19:30', 0, 3],
    ['2026-04-27 21:00', 0, 5], ['2026-04-29 21:00', 3, 4], ['2026-04-30 21:30', 1, 2],
    ['2026-05-04 21:00', 3, 1], ['2026-05-06 21:00', 0, 4], ['2026-05-07 21:30', 5, 2],
    ['2026-05-11 21:00', 5, 3], ['2026-05-13 21:00', 0, 2], ['2026-05-14 21:30', 4, 1],
    ['2026-05-18 21:00', 0, 1], ['2026-05-20 21:00', 2, 3], ['2026-05-21 21:30', 4, 5],
    ['2026-05-25 21:00', 2, 4], ['2026-05-27 21:00', 1, 5], ['2026-05-28 21:30', 0, 3],
    ['2026-06-01 21:00', 0, 5], ['2026-06-03 21:00', 3, 4], ['2026-06-04 21:30', 1, 2],
    ['2026-06-08 21:00', 3, 1], ['2026-06-10 21:00', 0, 4], ['2026-06-11 21:30', 5, 2],
    ['2026-06-15 21:00', 5, 3], ['2026-06-17 21:00', 0, 2], ['2026-06-18 21:00', 4, 1],
    ['2026-06-21 20:45', 2, 3], ['2026-06-22 21:00', 0, 1], ['2026-06-25 21:00', 4, 5],
    ['2026-06-28 20:45', 1, 5], ['2026-06-29 21:00', 2, 4], ['2026-07-02 21:00', 0, 3],
    ['2026-07-06 21:00', 0, 5], ['2026-07-08 21:00', 3, 4], ['2026-07-09 21:00', 1, 2],
    ['2026-07-13 21:00', 3, 1], ['2026-07-15 21:00', 0, 4], ['2026-07-16 21:00', 5, 2],
    ['2026-08-03 21:00', 5, 3], ['2026-08-05 21:00', 0, 2], ['2026-08-06 21:00', 4, 1],
  ];

  const matchIds = [];
  for (const [date, h, a] of schedule) {
    const r = db.prepare(`
      INSERT INTO matches (home_team_id, away_team_id, home_score, away_score, date, status, validated, season_id)
      VALUES (?, ?, 0, 0, ?, 'scheduled', 0, ?)
    `).run(teams[h].id, teams[a].id, date, seasonId);
    matchIds.push({ id: r.lastInsertRowid });
  }

  // --- MESSAGES ---
  const adminUser = db.prepare("SELECT id FROM users WHERE role='admin'").get();

  const announcements = [
    { title: '🏒 Bienvenue à la saison 2025-2026!', content: 'La LHMA est officiellement lancée. Bonne saison à toutes les équipes!' },
    { title: '📋 Rappel: Présences obligatoires', content: 'Tous les joueurs doivent confirmer leur présence 48h avant chaque match. Utilisez la section Présences.' },
    { title: '📅 Calendrier disponible', content: 'Le calendrier complet des 45 parties de la saison 2025-2026 est maintenant disponible. Première partie le 13 avril 2026!' },
  ];

  for (const ann of announcements) {
    db.prepare("INSERT INTO messages (sender_id, type, title, content, is_announcement) VALUES (?, 'global', ?, ?, 1)").run(adminUser.id, ann.title, ann.content);
  }

  // Team messages from captains
  const captainUsers = db.prepare("SELECT * FROM users WHERE role='captain'").all();
  const teamMessages = [
    'Excellent match la semaine dernière! On continue comme ça.',
    'Pratique de passes ce samedi à 8h. Présence recommandée!',
    'Rappel: amenez votre équipement complet pour le prochain match.',
  ];

  for (let i = 0; i < Math.min(captainUsers.length, teamMessages.length); i++) {
    const cap = captainUsers[i];
    db.prepare("INSERT INTO messages (sender_id, type, team_id, content) VALUES (?, 'team', ?, ?)").run(
      cap.id, cap.team_id, teamMessages[i]
    );
  }

  console.log('✅ Données insérées!\n');
  console.log('📊 Résumé:');
  console.log(`   - 2 saisons (2024-2025 historique + 2025-2026 active)`);
  console.log(`   - 6 équipes`);
  console.log(`   - ${allPlayers.length} joueurs réels`);
  console.log(`   - ${db.prepare('SELECT COUNT(*) as c FROM player_season_stats').get().c} stats historiques importées`);
  console.log(`   - ${matchIds.length} matchs (saison à venir)`);
  console.log(`\n🔑 Comptes de connexion (mot de passe: password123):`);
  console.log(`   admin           → Admin complet`);
  console.log(`   cap_rangers     → Capitaine des Rangers`);
  console.log(`   cap_canadiens   → Capitaine des Canadiens`);
  console.log(`   cap_flyers      → Capitaine des Flyers`);
  console.log(`   cap_blues       → Capitaine des Blues`);
  console.log(`   cap_stars       → Capitaine des Stars`);
  console.log(`   cap_bruins      → Capitaine des Bruins`);
  console.log(`   joueur_rangers   → Joueur régulier\n`);
}

seed();
