const Database = require('better-sqlite3');
const path = require('path');

let db;

function resolveDbPath() {
  return process.env.HOCKEY_DB_PATH || process.env.DB_PATH || path.join(__dirname, 'hockey_league.db');
}

function getDB() {
  if (!db) {
    db = new Database(resolveDbPath());
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function closeDB() {
  if (db) {
    db.close();
    db = null;
  }
}

function initDB() {
  const db = getDB();

  db.exec(`
    CREATE TABLE IF NOT EXISTS seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_date DATE,
      end_date DATE,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      logo TEXT,
      color TEXT DEFAULT '#3B82F6',
      season_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (season_id) REFERENCES seasons(id)
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      nickname TEXT,
      number INTEGER,
      position TEXT DEFAULT 'C',
      team_id INTEGER,
      photo TEXT,
      age INTEGER,
      email TEXT,
      phone TEXT,
      status TEXT DEFAULT 'active',
      rating TEXT DEFAULT 'C',
      rating_score INTEGER DEFAULT 0,
      registered_at DATE DEFAULT CURRENT_DATE,
      FOREIGN KEY (team_id) REFERENCES teams(id)
    );

    CREATE TABLE IF NOT EXISTS player_season_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      season_id INTEGER NOT NULL,
      team_id INTEGER,
      games_played INTEGER DEFAULT 0,
      goals INTEGER DEFAULT 0,
      assists INTEGER DEFAULT 0,
      points INTEGER DEFAULT 0,
      pim INTEGER DEFAULT 0,
      UNIQUE(player_id, season_id),
      FOREIGN KEY (player_id) REFERENCES players(id),
      FOREIGN KEY (season_id) REFERENCES seasons(id),
      FOREIGN KEY (team_id) REFERENCES teams(id)
    );

    CREATE TABLE IF NOT EXISTS team_staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      UNIQUE(team_id, player_id),
      FOREIGN KEY (team_id) REFERENCES teams(id),
      FOREIGN KEY (player_id) REFERENCES players(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'player',
      player_id INTEGER,
      team_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (player_id) REFERENCES players(id),
      FOREIGN KEY (team_id) REFERENCES teams(id)
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      home_team_id INTEGER NOT NULL,
      away_team_id INTEGER NOT NULL,
      home_score INTEGER DEFAULT 0,
      away_score INTEGER DEFAULT 0,
      date DATETIME NOT NULL,
      location TEXT DEFAULT 'Aréna Municipal',
      status TEXT DEFAULT 'scheduled',
      validated INTEGER DEFAULT 0,
      season_id INTEGER,
      mvp_id INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (home_team_id) REFERENCES teams(id),
      FOREIGN KEY (away_team_id) REFERENCES teams(id),
      FOREIGN KEY (season_id) REFERENCES seasons(id),
      FOREIGN KEY (mvp_id) REFERENCES players(id)
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      scorer_id INTEGER,
      assist1_id INTEGER,
      assist2_id INTEGER,
      period INTEGER DEFAULT 1,
      time_in_period TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
      FOREIGN KEY (team_id) REFERENCES teams(id),
      FOREIGN KEY (scorer_id) REFERENCES players(id),
      FOREIGN KEY (assist1_id) REFERENCES players(id),
      FOREIGN KEY (assist2_id) REFERENCES players(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      type TEXT DEFAULT 'global',
      team_id INTEGER,
      recipient_id INTEGER,
      title TEXT,
      content TEXT NOT NULL,
      is_announcement INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (team_id) REFERENCES teams(id),
      FOREIGN KEY (recipient_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS message_reads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, user_id),
      FOREIGN KEY (message_id) REFERENCES messages(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      status TEXT DEFAULT 'present',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(match_id, player_id),
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS draft_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_id INTEGER NOT NULL UNIQUE,
      total_rounds INTEGER DEFAULT 5,
      snake_mode INTEGER DEFAULT 1,
      current_round INTEGER DEFAULT 1,
      current_pick INTEGER DEFAULT 1,
      status TEXT DEFAULT 'pending',
      team_order TEXT DEFAULT '[]',
      FOREIGN KEY (season_id) REFERENCES seasons(id)
    );

    CREATE TABLE IF NOT EXISTS draft_picks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_id INTEGER NOT NULL,
      round INTEGER NOT NULL,
      pick_number INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      player_id INTEGER,
      picked_at DATETIME,
      UNIQUE(season_id, round, pick_number),
      FOREIGN KEY (season_id) REFERENCES seasons(id),
      FOREIGN KEY (team_id) REFERENCES teams(id),
      FOREIGN KEY (player_id) REFERENCES players(id)
    );

    CREATE TABLE IF NOT EXISTS playoff_series (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_id INTEGER NOT NULL,
      round INTEGER NOT NULL,
      series_number INTEGER NOT NULL,
      team1_id INTEGER,
      team2_id INTEGER,
      wins1 INTEGER DEFAULT 0,
      wins2 INTEGER DEFAULT 0,
      winner_id INTEGER,
      status TEXT DEFAULT 'pending',
      best_of INTEGER DEFAULT 3,
      next_series_id INTEGER,
      next_series_slot INTEGER,
      FOREIGN KEY (season_id) REFERENCES seasons(id),
      FOREIGN KEY (team1_id) REFERENCES teams(id),
      FOREIGN KEY (team2_id) REFERENCES teams(id),
      FOREIGN KEY (winner_id) REFERENCES teams(id)
    );
  `);

  const goalsColumns = db.prepare(`PRAGMA table_info(goals)`).all();
  const scorerColumn = goalsColumns.find(column => column.name === 'scorer_id');
  if (scorerColumn?.notnull) {
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
      db.exec(`
        ALTER TABLE goals RENAME TO goals_old;

        CREATE TABLE goals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          match_id INTEGER NOT NULL,
          team_id INTEGER NOT NULL,
          scorer_id INTEGER,
          assist1_id INTEGER,
          assist2_id INTEGER,
          period INTEGER DEFAULT 1,
          time_in_period TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
          FOREIGN KEY (team_id) REFERENCES teams(id),
          FOREIGN KEY (scorer_id) REFERENCES players(id),
          FOREIGN KEY (assist1_id) REFERENCES players(id),
          FOREIGN KEY (assist2_id) REFERENCES players(id)
        );

        INSERT INTO goals (id, match_id, team_id, scorer_id, assist1_id, assist2_id, period, time_in_period, created_at)
        SELECT id, match_id, team_id, scorer_id, assist1_id, assist2_id, period, time_in_period, created_at
        FROM goals_old;

        DROP TABLE goals_old;
      `);
    })();
    db.pragma('foreign_keys = ON');
  }

  // Indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
    CREATE INDEX IF NOT EXISTS idx_matches_validated ON matches(validated);
    CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date);
    CREATE INDEX IF NOT EXISTS idx_matches_home_team ON matches(home_team_id);
    CREATE INDEX IF NOT EXISTS idx_matches_away_team ON matches(away_team_id);
    CREATE INDEX IF NOT EXISTS idx_matches_season ON matches(season_id);
    CREATE INDEX IF NOT EXISTS idx_goals_match ON goals(match_id);
    CREATE INDEX IF NOT EXISTS idx_goals_scorer ON goals(scorer_id);
    CREATE INDEX IF NOT EXISTS idx_goals_assist1 ON goals(assist1_id);
    CREATE INDEX IF NOT EXISTS idx_goals_assist2 ON goals(assist2_id);
    CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);
    CREATE INDEX IF NOT EXISTS idx_players_status ON players(status);
    CREATE INDEX IF NOT EXISTS idx_attendance_match ON attendance(match_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_player ON attendance(player_id);
    CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type);
    CREATE INDEX IF NOT EXISTS idx_messages_announcement ON messages(is_announcement);
    CREATE INDEX IF NOT EXISTS idx_draft_picks_season ON draft_picks(season_id);
    CREATE INDEX IF NOT EXISTS idx_draft_picks_team ON draft_picks(team_id);
    CREATE INDEX IF NOT EXISTS idx_draft_picks_player ON draft_picks(player_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
  `);

  // Migrations — safe to re-run, silently ignored if column already exists
  try { db.exec(`ALTER TABLE players ADD COLUMN rating TEXT DEFAULT 'C'`); } catch {}
  try { db.exec(`ALTER TABLE players ADD COLUMN rating_score INTEGER DEFAULT 0`); } catch {}
  try { db.exec(`ALTER TABLE matches ADD COLUMN is_playoff INTEGER DEFAULT 0`); } catch {}
  try { db.exec(`ALTER TABLE matches ADD COLUMN playoff_series_id INTEGER`); } catch {}
  try { db.exec(`ALTER TABLE seasons ADD COLUMN champion_team_id INTEGER`); } catch {}
  // New format: loser routing in bracket (safe to re-run)
  try { db.exec(`ALTER TABLE playoff_series ADD COLUMN next_loser_series_id INTEGER`); } catch {}
  try { db.exec(`ALTER TABLE playoff_series ADD COLUMN next_loser_slot INTEGER`); } catch {}

  console.log('Database initialized');
  return db;
}

module.exports = { getDB, initDB, closeDB };
