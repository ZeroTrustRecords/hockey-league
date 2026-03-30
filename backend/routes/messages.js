const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authenticate, requireAdmin, requireCaptainOrAdmin } = require('../middleware/auth');

// Get messages for current user
router.get('/', authenticate, (req, res) => {
  const db = getDB();
  const { type } = req.query;
  const user = req.user;

  let query = `
    SELECT m.*, u.username as sender_name,
      CASE WHEN mr.id IS NOT NULL THEN 1 ELSE 0 END as is_read,
      t.name as team_name
    FROM messages m
    INNER JOIN users u ON m.sender_id = u.id
    LEFT JOIN message_reads mr ON mr.message_id = m.id AND mr.user_id = ?
    LEFT JOIN teams t ON m.team_id = t.id
    WHERE (
      m.type = 'global'
      OR (m.type = 'team' AND m.team_id = ?)
      OR (m.type = 'private' AND (m.sender_id = ? OR m.recipient_id = ?))
    )
  `;
  const params = [user.id, user.team_id || 0, user.id, user.id];

  if (type) { query += ' AND m.type = ?'; params.push(type); }
  query += ' ORDER BY m.created_at DESC LIMIT 50';

  res.json(db.prepare(query).all(...params));
});

// Count unread
router.get('/unread-count', authenticate, (req, res) => {
  const db = getDB();
  const user = req.user;
  const count = db.prepare(`
    SELECT COUNT(*) as count FROM messages m
    LEFT JOIN message_reads mr ON mr.message_id = m.id AND mr.user_id = ?
    WHERE mr.id IS NULL
    AND (
      m.type = 'global'
      OR (m.type = 'team' AND m.team_id = ?)
      OR (m.type = 'private' AND (m.sender_id = ? OR m.recipient_id = ?))
    )
  `).get(user.id, user.team_id || 0, user.id, user.id);
  res.json(count);
});

// Send message
router.post('/', authenticate, (req, res) => {
  const { type = 'global', team_id, recipient_id, title, content, is_announcement = 0 } = req.body;
  if (!content) return res.status(400).json({ error: 'Contenu requis' });

  // Only admin can send global announcements
  if (is_announcement && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Seul un admin peut créer des annonces' });
  }

  // Only captain/admin can send team messages
  if (type === 'team' && !['admin', 'captain'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const db = getDB();
  const result = db.prepare(`
    INSERT INTO messages (sender_id, type, team_id, recipient_id, title, content, is_announcement)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, type, team_id || null, recipient_id || null, title || null, content, is_announcement ? 1 : 0);

  res.status(201).json({ id: result.lastInsertRowid });
});

// Mark as read
router.post('/:id/read', authenticate, (req, res) => {
  const db = getDB();
  db.prepare('INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)').run(req.params.id, req.user.id);
  res.json({ message: 'Marqué comme lu' });
});

// Mark all as read
router.post('/read-all', authenticate, (req, res) => {
  const db = getDB();
  const user = req.user;
  const messages = db.prepare(`
    SELECT id FROM messages m
    LEFT JOIN message_reads mr ON mr.message_id = m.id AND mr.user_id = ?
    WHERE mr.id IS NULL AND (
      m.type = 'global'
      OR (m.type = 'team' AND m.team_id = ?)
      OR (m.type = 'private' AND (m.sender_id = ? OR m.recipient_id = ?))
    )
  `).all(user.id, user.team_id || 0, user.id, user.id);

  const insert = db.prepare('INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)');
  for (const m of messages) insert.run(m.id, user.id);

  res.json({ message: 'Tous marqués comme lus' });
});

router.delete('/:id', authenticate, (req, res) => {
  const db = getDB();
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
  if (!msg) return res.status(404).json({ error: 'Message introuvable' });
  if (msg.sender_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
  res.json({ message: 'Message supprimé' });
});

module.exports = router;
