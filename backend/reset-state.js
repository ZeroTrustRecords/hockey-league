/**
 * reset-state.js
 * Resets the app to a clean baseline state on every server startup.
 *
 * PRESERVED:  teams, players (with team assignments), seasons, users
 * RESET:      goals, match results, player stats, draft picks,
 *             playoff series, messages, attendance
 */

function resetState(db) {
  console.log('🔄  Resetting app to clean state...');

  db.transaction(() => {
    // Clear all goals
    db.prepare('DELETE FROM goals').run();

    // Reset all matches to scheduled with no score and not validated
    db.prepare(`
      UPDATE matches
      SET status     = 'scheduled',
          home_score = 0,
          away_score = 0,
          validated  = 0,
          mvp_id     = NULL,
          notes      = NULL
    `).run();

    // Clear player season stats
    db.prepare('DELETE FROM player_season_stats').run();

    // Clear draft picks (team assignments on players are kept)
    db.prepare('DELETE FROM draft_picks').run();

    // Reset draft settings to beginning (teams are already assigned manually)
    db.prepare(`
      UPDATE draft_settings
      SET current_round = 1,
          current_pick  = 1,
          status        = 'completed'
    `).run();

    // Clear playoff series
    db.prepare('DELETE FROM playoff_series').run();

    // Clear attendance
    db.prepare('DELETE FROM attendance').run();

    // Clear messages and reads
    db.prepare('DELETE FROM message_reads').run();
    db.prepare('DELETE FROM messages').run();

    // Remove any non-admin users that may have been added during testing
    // (keeps admin account intact)
    const admin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
    if (admin) {
      db.prepare('DELETE FROM users WHERE id != ?').run(admin.id);
    }

    // Reset completed season flag on active season (no champion yet)
    db.prepare(`
      UPDATE seasons
      SET champion_team_id = NULL
      WHERE status IN ('active', 'playoffs')
    `).run();

    // Ensure previous season stays completed, active season stays active
    db.prepare(`
      UPDATE seasons SET status = 'completed'
      WHERE name = 'Saison 2024-2025'
    `).run();

    db.prepare(`
      UPDATE seasons SET status = 'active'
      WHERE name = 'Saison 2025-2026'
    `).run();

  })();

  console.log('✅  Clean state restored.');
}

module.exports = { resetState };
