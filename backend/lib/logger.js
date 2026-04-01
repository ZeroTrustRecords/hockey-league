const fs = require('fs');
const path = require('path');
const { getConfig } = require('../config');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getLogFilePath() {
  const { logDir } = getConfig();
  ensureDir(logDir);
  const day = new Date().toISOString().slice(0, 10);
  return path.join(logDir, `app-${day}.log`);
}

function serializeMeta(meta) {
  if (!meta) return '';
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return ' {"meta":"unserializable"}';
  }
}

function write(level, message, meta) {
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}${serializeMeta(meta)}`;
  console.log(line);
  fs.appendFileSync(getLogFilePath(), `${line}\n`, 'utf8');
}

const logger = {
  info(message, meta) {
    write('info', message, meta);
  },
  warn(message, meta) {
    write('warn', message, meta);
  },
  error(message, meta) {
    write('error', message, meta);
  },
};

function requestLogger(req, res, next) {
  const { requestLogEnabled } = getConfig();
  if (!requestLogEnabled) return next();

  const start = Date.now();
  res.on('finish', () => {
    logger.info('http_request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: Date.now() - start,
      ip: req.ip,
      user_id: req.user?.id || null,
    });
  });
  next();
}

function errorLogger(err, req, res, next) {
  logger.error('http_error', {
    method: req.method,
    path: req.originalUrl,
    status: err.status || 500,
    message: err.message,
    stack: err.stack,
    user_id: req.user?.id || null,
  });

  if (res.headersSent) return next(err);
  return res.status(err.status || 500).json({ error: 'Erreur interne du serveur' });
}

module.exports = { logger, requestLogger, errorLogger, ensureDir };
