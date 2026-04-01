const { getDB } = require('../db');

function stringifyDetails(details) {
  if (!details) return null;
  try {
    return JSON.stringify(details);
  } catch {
    return null;
  }
}

function logAudit(dbOrPayload, maybePayload) {
  const db = typeof dbOrPayload?.prepare === 'function' ? dbOrPayload : getDB();
  const payload = maybePayload || dbOrPayload || {};

  db.prepare(`
    INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    payload.user_id || null,
    payload.username || null,
    payload.action,
    payload.entity_type || null,
    payload.entity_id == null ? null : String(payload.entity_id),
    stringifyDetails(payload.details)
  );
}

module.exports = { logAudit };
