const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db');
const { authenticate, requireAdmin, JWT_SECRET } = require('../middleware/auth');
const { logAudit } = require('../lib/auditLog');

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Champs requis' });

  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Identifiants invalides' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Identifiants invalides' });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, player_id: user.player_id, team_id: user.team_id },
    JWT_SECRET,
    { expiresIn: '7d' },
  );

  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, player_id: user.player_id, team_id: user.team_id },
  });
});

// Get current user
router.get('/me', authenticate, (req, res) => {
  const db = getDB();
  const user = db.prepare('SELECT id, username, email, role, player_id, team_id, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  let player = null;
  if (user.player_id) {
    player = db.prepare('SELECT * FROM players WHERE id = ?').get(user.player_id);
  }
  res.json({ ...user, player });
});

// List all users (admin only)
router.get('/users', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const users = db.prepare(
    'SELECT id, username, role, player_id, team_id, created_at FROM users ORDER BY role, username',
  ).all();
  res.json(users);
});

// Delete user (admin only, cannot delete self)
router.delete('/users/:id', authenticate, requireAdmin, (req, res) => {
  if (String(req.params.id) === String(req.user.id)) {
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
  }
  const db = getDB();
  const id = req.params.id;
  const targetUser = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(id);
  db.transaction(() => {
    db.prepare('DELETE FROM message_reads WHERE user_id = ?').run(id);
    db.prepare('UPDATE messages SET sender_id = ? WHERE sender_id = ?').run(req.user.id, id);
    db.prepare('DELETE FROM messages WHERE recipient_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    if (targetUser) {
      logAudit(db, {
        user_id: req.user.id,
        username: req.user.username,
        action: 'user.deleted',
        entity_type: 'user',
        entity_id: targetUser.id,
        details: { username: targetUser.username, role: targetUser.role },
      });
    }
  })();
  res.json({ message: 'Compte supprime' });
});

// Register (admin only)
router.post('/register', authenticate, requireAdmin, (req, res) => {
  const { username, email, password, role = 'player', player_id, team_id } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username et mot de passe requis' });

  const db = getDB();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: "Nom d'utilisateur deja pris" });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, email, password_hash, role, player_id, team_id) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(username, email || null, hash, role, player_id || null, team_id || null);

  logAudit(db, {
    user_id: req.user.id,
    username: req.user.username,
    action: 'user.created',
    entity_type: 'user',
    entity_id: result.lastInsertRowid,
    details: { username, role, player_id: player_id || null, team_id: team_id || null },
  });

  res.status(201).json({ id: result.lastInsertRowid, username, role });
});

// Change password
router.put('/password', authenticate, (req, res) => {
  const { current_password, new_password } = req.body;
  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis' });
  }

  if (typeof new_password !== 'string' || new_password.trim().length < 8) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caracteres' });
  }

  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
  }

  const hash = bcrypt.hashSync(new_password.trim(), 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ message: 'Mot de passe mis a jour' });
});

module.exports = router;
