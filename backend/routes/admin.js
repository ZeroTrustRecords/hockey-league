const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { getDB } = require('../db');
const { authenticate, requireAdmin, requireAdminPassword } = require('../middleware/auth');
const { buildBackupSnapshot, restoreBackupSnapshot, writeBackupFile, listBackupFiles, readBackupFile } = require('../lib/backup');
const { logAudit } = require('../lib/auditLog');
const { getConfig } = require('../config');
const { logger } = require('../lib/logger');

router.get('/activity', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const rows = db.prepare(`
    SELECT id, user_id, username, action, entity_type, entity_id, details, created_at
    FROM audit_logs
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT ?
  `).all(limit).map(row => ({
    ...row,
    details: row.details ? JSON.parse(row.details) : null,
  }));

  res.json(rows);
});

router.get('/export', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const snapshot = buildBackupSnapshot(db);
  const fileName = `lhma-backup-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(JSON.stringify(snapshot, null, 2));
});

router.post('/backup', authenticate, requireAdmin, requireAdminPassword, (req, res) => {
  const db = getDB();
  const snapshot = buildBackupSnapshot(db);
  const saved = writeBackupFile(snapshot);

  logAudit(db, {
    user_id: req.user.id,
    username: req.user.username,
    action: 'backup.created',
    entity_type: 'backup',
    entity_id: saved.filename,
  });

  res.json({
    message: 'Sauvegarde serveur créée',
    filename: saved.filename,
  });
});

router.get('/backups', authenticate, requireAdmin, (req, res) => {
  res.json(listBackupFiles());
});

router.get('/backups/:filename', authenticate, requireAdmin, (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.join(getConfig().backupDir, safeName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Sauvegarde introuvable' });
  }
  return res.download(filePath, safeName);
});

router.post('/restore', authenticate, requireAdmin, requireAdminPassword, (req, res) => {
  const db = getDB();
  const snapshot = req.body?.snapshot || (req.body?.filename ? readBackupFile(req.body.filename) : null);

  if (!snapshot) {
    return res.status(400).json({ error: 'Snapshot ou nom de sauvegarde requis' });
  }

  try {
    restoreBackupSnapshot(db, snapshot);
    logAudit(db, {
      user_id: req.user.id,
      username: req.user.username,
      action: 'backup.restored',
      entity_type: 'backup',
      entity_id: req.body?.filename || 'uploaded-snapshot',
    });
    logger.warn('backup_restored', {
      username: req.user.username,
      source: req.body?.filename || 'uploaded-snapshot',
    });
    return res.json({ message: 'Restauration effectuée' });
  } catch (error) {
    logger.error('backup_restore_failed', {
      username: req.user.username,
      message: error.message,
    });
    return res.status(400).json({ error: error.message || 'Restauration impossible' });
  }
});

module.exports = router;
