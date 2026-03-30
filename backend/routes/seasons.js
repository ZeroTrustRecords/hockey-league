const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', (req, res) => {
  const db = getDB();
  const seasons = db.prepare('SELECT * FROM seasons ORDER BY created_at DESC').all();
  res.json(seasons);
});

router.get('/active', (req, res) => {
  const db = getDB();
  const season = db.prepare("SELECT * FROM seasons WHERE status = 'active' ORDER BY created_at DESC LIMIT 1").get();
  res.json(season || null);
});

router.post('/', authenticate, requireAdmin, (req, res) => {
  const { name, start_date, end_date } = req.body;
  const db = getDB();
  const result = db.prepare(
    'INSERT INTO seasons (name, start_date, end_date, status) VALUES (?, ?, ?, ?)'
  ).run(name, start_date || null, end_date || null, 'active');
  res.status(201).json({ id: result.lastInsertRowid, name, status: 'active' });
});

router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const { name, start_date, end_date, status } = req.body;
  const db = getDB();
  db.prepare('UPDATE seasons SET name=?, start_date=?, end_date=?, status=? WHERE id=?')
    .run(name, start_date, end_date, status, req.params.id);
  res.json({ message: 'Saison mise à jour' });
});

// Full reset: clear matches, goals, draft, playoff series, unassign players from teams
router.post('/reset', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    db.prepare('DELETE FROM goals WHERE match_id IN (SELECT id FROM matches WHERE status = \'completed\')').run();
    db.prepare('DELETE FROM matches WHERE status = \'completed\'').run();
    db.prepare('DELETE FROM playoff_series').run();
    db.prepare('DELETE FROM draft_picks').run();
    db.prepare("UPDATE draft_settings SET status='pending', current_round=1, current_pick=1").run();
    db.prepare('DELETE FROM player_season_stats').run();
    db.prepare('UPDATE players SET team_id = NULL').run();
    db.prepare('DELETE FROM team_staff').run();
    db.prepare("UPDATE seasons SET status = 'active', champion_team_id = NULL WHERE status IN ('playoffs','completed')").run();
  })();
  db.pragma('foreign_keys = ON');
  res.json({ message: 'Réinitialisation complète effectuée' });
});

// One-time: assign players to teams by name from CSV data
router.post('/assign-teams', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const assignments = [
    // [first_name, last_name, team_name]
    ['Marc Antoine','Aylwin','Canadiens'],['Jocelyn','Comtois','Canadiens'],['Éric','De Sousa','Canadiens'],
    ['Patrick','Desmeules','Canadiens'],['Karl','Gravel','Canadiens'],['Benoit','Laplante','Canadiens'],
    ['Stéphane','Martin','Canadiens'],['Marc','Quesnel','Canadiens'],['Gabriel','Richer','Canadiens'],
    ['Philippe','Thibault','Canadiens'],['Martin','Verville','Canadiens'],
    ['Sébastien','Cool','Stars'],['Yannick','Lapointe','Stars'],['Richard','Larouche','Stars'],
    ['Marc-André','Lebel','Stars'],['Patrick','Marcil','Stars'],['François','Noël','Stars'],
    ['Charles','Noël','Stars'],['Marc Alexandre','Paradis','Stars'],['Maxime','Perreault','Stars'],
    ['Mathieu','Pilon','Stars'],['Shawn','Whaley','Stars'],
    ['Roxanne','Beliveau','Flyers'],['Éric','Bertrand','Flyers'],['Jean Marc','Le Bouthillier','Flyers'],
    ['Alexy','Le Bouthillier','Flyers'],['Benoit','Lefebvre','Flyers'],['Ghislain','Mathieu','Flyers'],
    ['Julien','Meunier','Flyers'],['Guillaume','Parent','Flyers'],['Malick','Plante-Girard','Flyers'],
    ['Fils','Poulin','Flyers'],['Bruno','Poulin','Flyers'],
    ['Nicolas','Fortin','Rangers'],['Bruno','Labrecque','Rangers'],['Julien','Lacerte','Rangers'],
    ['Keven','Messier','Rangers'],['Yannick','Peccia','Rangers'],['Renaud','Petitclerc','Rangers'],
    ['Alexandre','Plante','Rangers'],['Julien','Prescott','Rangers'],['Daomi','Rousseau','Rangers'],
    ['Martin','Tousignant','Rangers'],['Benoit','Tremblay','Rangers'],
    ['Alex','Barbusci','Bruins'],['Sébastien','Belhumeur','Bruins'],['Robert','Blanchette','Bruins'],
    ['Steve','Caney','Bruins'],['Frédéric','Charest','Bruins'],['Jean Christophe','Dubé','Bruins'],
    ['Olivier','Duchesne','Bruins'],['Simon','Gaudreault','Bruins'],['Jocelyn','Mathieu','Bruins'],
    ['Jean Philippe','Perreault','Bruins'],['Jean-Philippe','Savard','Bruins'],
    ['Guillaume','Beaudoin','Blues'],['Patrick','Binet','Blues'],['Juan','Bolivar','Blues'],
    ['Maxime','Duchesneau','Blues'],['Jasmin','Landry','Blues'],['Pierre-Olivier','Lauzon','Blues'],
    ['Serge','Lauzon','Blues'],['Michael','Mc lean','Blues'],['Bruno','Mercure','Blues'],
    ['Nicolas','Teasdale','Blues'],['Fred','Yergeau','Blues'],
  ];
  let updated = 0, skipped = 0;
  const update = db.prepare('UPDATE players SET team_id = (SELECT id FROM teams WHERE name = ? LIMIT 1) WHERE first_name = ? AND last_name = ?');
  db.transaction(() => {
    for (const [fn, ln, team] of assignments) {
      const r = update.run(team, fn, ln);
      if (r.changes > 0) updated++; else skipped++;
    }
  })();
  res.json({ message: `${updated} joueurs assignés, ${skipped} non trouvés` });
});

module.exports = router;
