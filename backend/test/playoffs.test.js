const test = require('node:test');
const assert = require('node:assert/strict');

const playoffsRouter = require('../routes/playoffs');

test('playoffs readiness requires completed and validated regular season', () => {
  assert.equal(
    playoffsRouter.isRegularSeasonReadyForPlayoffs({
      total_games: 45,
      scheduled_games: 0,
      pending_validation_games: 0,
    }),
    true
  );

  assert.equal(
    playoffsRouter.isRegularSeasonReadyForPlayoffs({
      total_games: 45,
      scheduled_games: 1,
      pending_validation_games: 0,
    }),
    false
  );

  assert.equal(
    playoffsRouter.isRegularSeasonReadyForPlayoffs({
      total_games: 45,
      scheduled_games: 0,
      pending_validation_games: 2,
    }),
    false
  );
});
