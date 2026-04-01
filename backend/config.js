const path = require('path');

let cachedConfig = null;

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function getStartupMode() {
  if (process.env.RESET_ON_STARTUP === 'true') return 'fresh';
  if (process.env.RESET_ON_STARTUP === 'false') return 'persistent';
  return process.env.APP_STARTUP_MODE || 'persistent';
}

function buildConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const startupMode = getStartupMode();
  const port = parseInt(process.env.PORT || '3001', 10);
  const jwtSecret = process.env.JWT_SECRET || (isProduction ? null : 'dev-hockey-league-secret');
  const defaultSystemPassword = process.env.DEFAULT_SYSTEM_PASSWORD || 'password123';
  const frontendOrigins = isProduction
    ? splitCsv(process.env.FRONTEND_URLS || process.env.FRONTEND_URL || process.env.CORS_ORIGIN)
    : ['http://localhost:5173'];
  const logDir = process.env.LOG_DIR || path.join(__dirname, 'logs');
  const backupDir = process.env.BACKUP_DIR || path.join(__dirname, 'backups');
  const requestLogEnabled = process.env.REQUEST_LOGS !== 'false';

  if (isProduction && !jwtSecret) {
    throw new Error('JWT_SECRET must be set in production');
  }
  if (isProduction && startupMode === 'fresh') {
    throw new Error('APP_STARTUP_MODE=fresh is not allowed in production');
  }
  if (isProduction && frontendOrigins.length === 0) {
    throw new Error('FRONTEND_URL or FRONTEND_URLS must be set in production');
  }
  if (isProduction && defaultSystemPassword === 'password123') {
    throw new Error('DEFAULT_SYSTEM_PASSWORD must be changed in production');
  }

  return {
    nodeEnv,
    isProduction,
    port,
    startupMode,
    jwtSecret,
    defaultSystemPassword,
    frontendOrigins,
    logDir,
    backupDir,
    requestLogEnabled,
  };
}

function getConfig() {
  if (!cachedConfig) {
    cachedConfig = buildConfig();
  }
  return cachedConfig;
}

function resetConfigCache() {
  cachedConfig = null;
}

module.exports = { getConfig, resetConfigCache, getStartupMode };
