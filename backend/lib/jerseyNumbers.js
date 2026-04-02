function isValidJerseyNumber(value) {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 99;
}

function shuffle(array) {
  const copy = [...array];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function assignMissingRosterNumbers(db) {
  const players = db.prepare(`
    SELECT id, team_id, number
    FROM players
    WHERE status = 'active' AND team_id IS NOT NULL
    ORDER BY team_id, id
  `).all();

  const byTeam = new Map();
  players.forEach((player) => {
    const list = byTeam.get(player.team_id) || [];
    list.push(player);
    byTeam.set(player.team_id, list);
  });

  const updateNumber = db.prepare('UPDATE players SET number = ? WHERE id = ?');
  let updated = 0;

  byTeam.forEach((teamPlayers) => {
    const used = new Set();
    const missing = [];

    teamPlayers.forEach((player) => {
      if (isValidJerseyNumber(player.number) && !used.has(Number(player.number))) {
        used.add(Number(player.number));
      } else if (player.number == null || player.number === '') {
        missing.push(player);
      }
    });

    if (missing.length === 0) return;

    const available = shuffle(Array.from({ length: 99 }, (_, index) => index + 1).filter((number) => !used.has(number)));
    missing.forEach((player, index) => {
      const assigned = available[index];
      if (!assigned) return;
      updateNumber.run(assigned, player.id);
      updated += 1;
    });
  });

  return updated;
}

module.exports = {
  isValidJerseyNumber,
  assignMissingRosterNumbers,
};
