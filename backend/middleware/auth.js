const jwt = require('jsonwebtoken');

function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  return 'dev-hockey-league-secret';
}

const JWT_SECRET = getJwtSecret();

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

// Marqueur (scorekeeper) + captain + admin can submit/validate game sheets
function requireGamesheetAccess(req, res, next) {
  if (!['admin', 'captain', 'marqueur'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  next();
}

module.exports = { authenticate, requireAdmin, requireCaptainOrAdmin, requireGamesheetAccess, JWT_SECRET };
