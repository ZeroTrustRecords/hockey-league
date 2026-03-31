/**
 * reset-state.js
 * Resets the app to a clean baseline state on every server startup.
 *
 * PRESERVED:  teams, players (with team assignments), users,
 *             completed seasons with ALL their goals/matches (historical record)
 * RESET:      active season — goals cleared, matches → scheduled,
 *             playoff series, draft picks, messages, attendance
 */

function resetState(db) {
  console.log('🔄  Resetting app to clean state...');

  db.transaction(() => {
    // Find the current active/playoff season (most recently created)
    const activeSeason = db.prepare(`
      SELECT id FROM seasons
      WHERE status IN ('active', 'playoffs')
      ORDER BY created_at DESC LIMIT 1
    `).get();

    if (activeSeason) {
      // Clear goals only for the active season's matches
      db.prepare(`
        DELETE FROM goals
        WHERE match_id IN (SELECT id FROM matches WHERE season_id = ?)
      `).run(activeSeason.id);

      // Reset active season matches to scheduled
      db.prepare(`
        UPDATE matches
        SET status     = 'scheduled',
            home_score = 0,
            away_score = 0,
            validated  = 0,
            mvp_id     = NULL,
            notes      = NULL
        WHERE season_id = ?
      `).run(activeSeason.id);

      // Reset season back to active (not playoffs) with no champion
      db.prepare(`
        UPDATE seasons SET status = 'active', champion_team_id = NULL WHERE id = ?
      `).run(activeSeason.id);

      // Clear playoff series for active season only
      db.prepare('DELETE FROM playoff_series WHERE season_id = ?').run(activeSeason.id);
    }

    // Clear draft picks and reset settings (team assignments on players are kept)
    db.prepare('DELETE FROM draft_picks').run();
    db.prepare(`
      UPDATE draft_settings SET current_round = 1, current_pick = 1, status = 'completed'
    `).run();

    // Clear attendance and messages (not season-specific)
    db.prepare('DELETE FROM attendance').run();
    db.prepare('DELETE FROM message_reads').run();
    db.prepare('DELETE FROM messages').run();

  })();

  console.log('✅  Clean state restored.');
}

module.exports = { resetState };
