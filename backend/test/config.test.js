const test = require('node:test');
const assert = require('node:assert/strict');

const { getConfig, resetConfigCache } = require('../config');

test('production config rejects fresh startup mode', () => {
  const previousEnv = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'secret';
    process.env.DEFAULT_SYSTEM_PASSWORD = 'strong-password';
    process.env.FRONTEND_URL = 'https://example.com';
    process.env.APP_STARTUP_MODE = 'fresh';
    resetConfigCache();

    assert.throws(() => getConfig(), /not allowed in production/i);
  } finally {
    process.env = previousEnv;
    resetConfigCache();
  }
});

test('production config requires frontend url and non-default passwords', () => {
  const previousEnv = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'secret';
    process.env.DEFAULT_SYSTEM_PASSWORD = 'password123';
    process.env.FRONTEND_URL = 'https://example.com';
    resetConfigCache();

    assert.throws(() => getConfig(), /DEFAULT_SYSTEM_PASSWORD/i);
  } finally {
    process.env = previousEnv;
    resetConfigCache();
  }
});
