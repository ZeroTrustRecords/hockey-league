const test = require('node:test');
const assert = require('node:assert/strict');

const statsRouter = require('../routes/stats');

test('resolveSeasonContext prefers requested historical season phase', () => {
  const fakeDb = {
    prepare() {
      return {
        all() {
          return [
            { id: 3, status: 'playoffs', name: 'Saison 2026-2027', champion_team_id: null, total_matches: 50, playoff_matches: 8 },
            { id: 2, status: 'completed', name: 'Saison 2025-2026', champion_team_id: null, total_matches: 45, playoff_matches: 0 },
          ];
        },
      };
    },
  };

  const context = statsRouter.resolveSeasonContext(fakeDb, 2, null);
  assert.equal(context.seasonId, 2);
  assert.equal(context.type, 'regular');
});

test('resolveSeasonContext keeps explicit requested type', () => {
  const fakeDb = {
    prepare() {
      return {
        all() {
          return [
            { id: 5, status: 'completed', name: 'Saison 2024-2025', champion_team_id: 1, total_matches: 55, playoff_matches: 10 },
          ];
        },
      };
    },
  };

  const context = statsRouter.resolveSeasonContext(fakeDb, 5, 'playoffs');
  assert.equal(context.seasonId, 5);
  assert.equal(context.type, 'playoffs');
});
