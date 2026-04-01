const test = require('node:test');
const assert = require('node:assert/strict');

const { shouldResetOnStartup } = require('../reset-state');

test('persistent is now the default startup mode', () => {
  const previousAppMode = process.env.APP_STARTUP_MODE;
  const previousLeagueMode = process.env.LEAGUE_STARTUP_MODE;
  const previousReset = process.env.RESET_ON_STARTUP;

  delete process.env.APP_STARTUP_MODE;
  delete process.env.LEAGUE_STARTUP_MODE;
  delete process.env.RESET_ON_STARTUP;

  assert.equal(shouldResetOnStartup(), false);

  process.env.APP_STARTUP_MODE = previousAppMode;
  process.env.LEAGUE_STARTUP_MODE = previousLeagueMode;
  process.env.RESET_ON_STARTUP = previousReset;
});

test('RESET_ON_STARTUP still overrides persistent mode', () => {
  const previousAppMode = process.env.APP_STARTUP_MODE;
  const previousReset = process.env.RESET_ON_STARTUP;

  process.env.APP_STARTUP_MODE = 'persistent';
  process.env.RESET_ON_STARTUP = 'true';

  assert.equal(shouldResetOnStartup(), true);

  process.env.APP_STARTUP_MODE = previousAppMode;
  process.env.RESET_ON_STARTUP = previousReset;
});
