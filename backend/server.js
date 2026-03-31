const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const { initDB, getDB } = require('./db');
const { resetState, shouldResetOnStartup } = require('./reset-state');

const app = express();
const PORT = process.env.PORT || 3001;

const isProduction = process.env.NODE_ENV === 'production';

app.use(cors({
  origin: isProduction ? false : 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
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

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve React frontend in production
if (isProduction) {
  const frontendDist = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
}

// Ensure permanent system accounts always exist (admin + marqueur)
function ensureSystemAccounts(db) {
  const defaultPassword = process.env.DEFAULT_SYSTEM_PASSWORD || 'password123';
  const defaultHash = bcrypt.hashSync(defaultPassword, 10);
  db.prepare(`INSERT OR IGNORE INTO users (username, email, password_hash, role) VALUES ('admin', 'admin@lhma.ca', ?, 'admin')`).run(defaultHash);
  db.prepare(`INSERT OR IGNORE INTO users (username, password_hash, role) VALUES ('marqueur', ?, 'marqueur')`).run(defaultHash);
}

// Initialize DB and optionally reset state for local demos/testing
initDB();
const _db = getDB();
if (shouldResetOnStartup()) {
  resetState(_db);
}
ensureSystemAccounts(_db);

app.listen(PORT, () => {
  console.log(`\n🏒  Ligue de hockey — Serveur démarré sur http://localhost:${PORT}\n`);
});
