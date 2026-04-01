function resetState(db) {
  console.log('Resetting app to fresh startup state...');

  db.transaction(() => {
    db.prepare('DELETE FROM attendance').run();
    db.prepare('DELETE FROM message_reads').run();
    db.prepare('DELETE FROM messages').run();
    db.prepare('DELETE FROM goals').run();
    db.prepare('DELETE FROM matches').run();
    db.prepare('DELETE FROM playoff_series').run();
    db.prepare('DELETE FROM draft_picks').run();
    db.prepare('DELETE FROM draft_settings').run();
    db.prepare('DELETE FROM player_season_stats').run();
    db.prepare('DELETE FROM team_staff').run();
    db.prepare("UPDATE users SET role = CASE username WHEN 'admin' THEN 'admin' WHEN 'marqueur' THEN 'marqueur' ELSE role END, player_id = NULL, team_id = NULL WHERE username IN ('admin', 'marqueur')").run();
    db.prepare("DELETE FROM users WHERE username NOT IN ('admin', 'marqueur')").run();
    db.prepare('DELETE FROM players').run();
    db.prepare('DELETE FROM teams').run();
    db.prepare('DELETE FROM seasons').run();
  })();

  console.log('Fresh startup state restored.');
}

function shouldResetOnStartup() {
  const mode = (process.env.APP_STARTUP_MODE || process.env.LEAGUE_STARTUP_MODE || 'persistent')
    .trim()
    .toLowerCase();

  if (process.env.RESET_ON_STARTUP != null) {
    return ['1', 'true', 'yes', 'on'].includes(
      String(process.env.RESET_ON_STARTUP).trim().toLowerCase()
    );
  }

  return mode !== 'persistent';
}

module.exports = { resetState, shouldResetOnStartup };
