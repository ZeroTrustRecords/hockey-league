const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const { initDB, getDB } = require('./db');
const { resetState, shouldResetOnStartup } = require('./reset-state');
const { getConfig } = require('./config');
const { logger, requestLogger, errorLogger } = require('./lib/logger');

function ensureSystemAccounts(db) {
  const defaultPassword = getConfig().defaultSystemPassword;
  const defaultHash = bcrypt.hashSync(defaultPassword, 10);
  db.prepare(`INSERT OR IGNORE INTO users (username, email, password_hash, role) VALUES ('admin', 'admin@lhma.ca', ?, 'admin')`).run(defaultHash);
  db.prepare(`INSERT OR IGNORE INTO users (username, password_hash, role) VALUES ('marqueur', ?, 'marqueur')`).run(defaultHash);
}

function normalizeLegacyArenaNames(db) {
  db.prepare(`
    UPDATE matches
    SET location = ?
    WHERE location IN ('Arena Municipal', 'Aréna Municipal')
  `).run("Aréna de l'Assomption");
}

function initializeApp(app) {
  initDB();
  const db = getDB();
  app.locals.startupId = `${Date.now()}`;
  app.locals.startupMode = shouldResetOnStartup() ? 'fresh' : 'persistent';

  if (app.locals.startupMode === 'fresh') {
    resetState(db);
  } else {
    logger.info('persistent_startup_mode_enabled');
  }

  ensureSystemAccounts(db);
  normalizeLegacyArenaNames(db);
  return db;
}

function createApp() {
  const app = express();
  const config = getConfig();

  app.use(cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (config.frontendOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed: ${origin}`));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(requestLogger);
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/players', require('./routes/players'));
  app.use('/api/teams', require('./routes/teams'));
  app.use('/api/matches', require('./routes/matches'));
  app.use('/api/standings', require('./routes/standings'));
  app.use('/api/stats', require('./routes/stats'));
  app.use('/api/messages', require('./routes/messages'));
  app.use('/api/draft', require('./routes/draft'));
  app.use('/api/playoffs', require('./routes/playoffs'));
  app.use('/api/seasons', require('./routes/seasons'));
  app.use('/api/dashboard', require('./routes/dashboard'));
  app.use('/api/simulate', require('./routes/simulate'));
  app.use('/api/admin', require('./routes/admin'));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/api/bootstrap/status', (req, res) => {
    const db = getDB();
    const activeSeason = db.prepare("SELECT * FROM seasons WHERE status = 'active' ORDER BY id DESC LIMIT 1").get();
    const totalScheduledMatches = db.prepare('SELECT COUNT(*) as c FROM matches WHERE is_playoff = 0').get().c;
    const counts = {
      seasons: db.prepare('SELECT COUNT(*) as c FROM seasons').get().c,
      teams: db.prepare('SELECT COUNT(*) as c FROM teams').get().c,
      players: db.prepare("SELECT COUNT(*) as c FROM players WHERE status = 'active'").get().c,
      matches: activeSeason
        ? db.prepare('SELECT COUNT(*) as c FROM matches WHERE season_id = ? AND is_playoff = 0').get(activeSeason.id).c
        : 0,
      imported_matches: totalScheduledMatches,
    };

    res.json({
      startupId: req.app.locals.startupId,
      startupMode: req.app.locals.startupMode,
      systemAccounts: ['admin', 'marqueur'],
      activeSeason,
      counts,
      hasRoster: counts.teams > 0 && counts.players > 0,
      hasSchedule: counts.imported_matches > 0,
      setupComplete: counts.teams > 0 && counts.players > 0 && counts.imported_matches > 0,
      nodeEnv: config.nodeEnv,
    });
  });

  if (config.isProduction) {
    const frontendDist = path.join(__dirname, '../frontend/dist');
    app.use(express.static(frontendDist));
    app.get('*', (req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
  }

  app.use(errorLogger);

  return app;
}

function startServer(port = getConfig().port) {
  const app = createApp();
  initializeApp(app);

  return app.listen(port, () => {
    logger.info('server_started', {
      port,
      node_env: getConfig().nodeEnv,
      startup_mode: app.locals.startupMode,
      frontend_origins: getConfig().frontendOrigins,
    });
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { createApp, initializeApp, startServer };
