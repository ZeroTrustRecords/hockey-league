const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'hockey_league_secret_2024';

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

module.exports = { authenticate, requireAdmin, requireCaptainOrAdmin, JWT_SECRET };
