const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getDB } = require('../db');
const { getConfig } = require('../config');

const JWT_SECRET = getConfig().jwtSecret;

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requis' });

  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch {
    return res.status(403).json({ error: 'Token invalide' });
  }
}

function authenticateOptional(req, _res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    req.user = null;
  }

  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Accès administrateur requis' });
  }
  next();
}

function requireCaptainOrAdmin(req, res, next) {
  if (!['admin', 'captain'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Accès capitaine ou admin requis' });
  }
  next();
}

function requireAdminPassword(req, res, next) {
  const providedPassword = req.body?.admin_password;
  if (!providedPassword) {
    return res.status(400).json({ error: 'Mot de passe administrateur requis' });
  }

  const db = getDB();
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!user || !bcrypt.compareSync(providedPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Mot de passe administrateur incorrect' });
  }

  next();
}

// Marqueur (scorekeeper) + captain + admin can submit/validate game sheets
function requireGamesheetAccess(req, res, next) {
  if (!['admin', 'captain', 'marqueur'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  next();
}

module.exports = { authenticate, authenticateOptional, requireAdmin, requireCaptainOrAdmin, requireGamesheetAccess, requireAdminPassword, JWT_SECRET };
