const test = require('node:test');
const assert = require('node:assert/strict');

const seasonsRouter = require('../routes/seasons');
const simulateRouter = require('../routes/simulate');

test('teamColorByName returns the expected named team colors', () => {
  assert.equal(seasonsRouter.teamColorByName('Bruins', 0), '#FFB81C');
  assert.equal(seasonsRouter.teamColorByName('Rangers', 1), '#7DD3FC');
  assert.equal(seasonsRouter.teamColorByName('Stars', 2), '#16A34A');
  assert.equal(seasonsRouter.teamColorByName('Blues', 3), '#1D4ED8');
  assert.equal(seasonsRouter.teamColorByName('Flyers', 4), '#F97316');
  assert.equal(seasonsRouter.teamColorByName('Canadiens', 5), '#DC2626');
});

test('assignRosterNumbers keeps numbers unique within a team and allows cross-team reuse', () => {
  const input = [
    { team_name: 'Rangers', number: 9 },
    { team_name: 'Rangers', number: 9 },
    { team_name: 'Rangers', number: null },
    { team_name: 'Canadiens', number: 9 },
    { team_name: 'Canadiens', number: null },
  ];

  const assigned = seasonsRouter.assignRosterNumbers(input.map(player => ({ ...player })));
  const rangersNumbers = assigned.filter(player => player.team_name === 'Rangers').map(player => player.number);
  const canadiensNumbers = assigned.filter(player => player.team_name === 'Canadiens').map(player => player.number);

  assert.equal(new Set(rangersNumbers).size, rangersNumbers.length);
  assert.ok(canadiensNumbers.includes(9));
  assert.ok(rangersNumbers.every(number => number >= 1 && number <= 99));
  assert.ok(canadiensNumbers.every(number => number >= 1 && number <= 99));
});

test('getNextSeasonName increments a parsed season label', () => {
  assert.equal(simulateRouter.getNextSeasonName('Saison 2026-2027'), 'Saison 2027-2028');
});
