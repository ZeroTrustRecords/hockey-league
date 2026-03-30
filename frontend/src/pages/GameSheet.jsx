import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Plus, X, Check, Target, ChevronUp, Minus } from 'lucide-react';

const PERIODS = [
  { value: '1', label: '1re' },
  { value: '2', label: '2e' },
  { value: '3', label: '3e' },
  { value: '4', label: 'Prol.' },
];

function GoalRow({ goal, index, homeTeam, awayTeam, allPlayers, onChange, onRemove }) {
  const team = [homeTeam, awayTeam].find(t => t && String(t.id) === String(goal.team_id));
  const teamPlayers = allPlayers.filter(p => String(p.team_id) === String(goal.team_id));
  const set = (k, v) => onChange(index, { ...goal, [k]: v });

  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-gray-800/60 border border-gray-700">
      {/* Team color bar */}
      <div className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: team?.color || '#6b7280' }} />

      <div className="flex-1 space-y-2">
        {/* Period + team label row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: team?.color }} />
          <span className="text-xs text-white font-semibold flex-1">{team?.name}</span>
          <div className="flex gap-1">
            {PERIODS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => set('period', p.value)}
                className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                  String(goal.period) === p.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scorer + assists */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wide">Buteur *</label>
            <select className="select mt-0.5 text-sm" value={goal.scorer_id} onChange={e => set('scorer_id', e.target.value)}>
              <option value="">Remplaçant</option>
              {teamPlayers.map(p => (
                <option key={p.id} value={p.id}>#{p.number} {p.last_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wide">Passeur 1</label>
            <select className="select mt-0.5 text-sm" value={goal.assist1_id} onChange={e => set('assist1_id', e.target.value)}>
              <option value="">—</option>
              <option value="sub">Remplaçant</option>
              {teamPlayers.filter(p => String(p.id) !== String(goal.scorer_id)).map(p => (
                <option key={p.id} value={p.id}>#{p.number} {p.last_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wide">Passeur 2</label>
            <select className="select mt-0.5 text-sm" value={goal.assist2_id} onChange={e => set('assist2_id', e.target.value)}>
              <option value="">—</option>
              <option value="sub">Remplaçant</option>
              {teamPlayers.filter(p => String(p.id) !== String(goal.scorer_id) && String(p.id) !== String(goal.assist1_id)).map(p => (
                <option key={p.id} value={p.id}>#{p.number} {p.last_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <button onClick={() => onRemove(index)} className="text-gray-600 hover:text-red-400 transition-colors p-1 flex-shrink-0 mt-0.5">
        <X size={14} />
      </button>
    </div>
  );
}

export default function GameSheet() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [teams, setTeams] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(id || '');
  const [form, setForm] = useState({ home_team_id: '', away_team_id: '', date: '', location: 'Aréna Municipal', season_id: '' });
  const [goals, setGoals] = useState([]);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [notes, setNotes] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/teams'), api.get('/players'), api.get('/matches'), api.get('/seasons/active')])
      .then(([tr, pr, mr, sr]) => {
        setTeams(tr.data);
        setAllPlayers(pr.data);
        setMatches(isAdmin ? mr.data : mr.data.filter(m => !m.validated));
        if (sr.data) setForm(f => ({ ...f, season_id: sr.data.id }));
      }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedMatch) return;
    api.get(`/matches/${selectedMatch}`).then(r => {
      const m = r.data;
      setForm({ home_team_id: m.home_team_id, away_team_id: m.away_team_id, date: m.date?.slice(0, 16), location: m.location, season_id: m.season_id });
      setGoals(r.data.goals || []);
      setHomeScore(m.home_score || 0);
      setAwayScore(m.away_score || 0);
      setNotes(m.notes || '');
      setShowCreateForm(false);
    });
  }, [selectedMatch]);

  const createMatch = async e => {
    e.preventDefault();
    try {
      const r = await api.post('/matches', form);
      const newId = String(r.data.id);
      const mr = await api.get('/matches');
      setMatches(isAdmin ? mr.data : mr.data.filter(m => !m.validated));
      setSelectedMatch(newId);
      toast.success('Match créé');
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  const addGoalForTeam = (teamId) => {
    setGoals(prev => [...prev, {
      team_id: String(teamId), scorer_id: '', assist1_id: '', assist2_id: '', period: '1', time_in_period: ''
    }]);
    // Also increment the score
    if (String(teamId) === String(form.home_team_id)) setHomeScore(s => s + 1);
    else setAwayScore(s => s + 1);
  };

  const updateGoal = (i, g) => setGoals(prev => prev.map((og, idx) => idx === i ? g : og));

  const removeGoal = i => {
    const g = goals[i];
    if (String(g.team_id) === String(form.home_team_id)) setHomeScore(s => Math.max(0, s - 1));
    else setAwayScore(s => Math.max(0, s - 1));
    setGoals(prev => prev.filter((_, idx) => idx !== i));
  };

  const adjustScore = (team, delta) => {
    if (team === 'home') setHomeScore(s => Math.max(0, s + delta));
    else setAwayScore(s => Math.max(0, s + delta));
  };

  // Normalize goals before sending: empty string → null, 'sub' (replacement assist) → null
  const normalizeGoals = (gs) => gs.map(g => ({
    ...g,
    scorer_id:  g.scorer_id  || null,
    assist1_id: (g.assist1_id === 'sub' || !g.assist1_id) ? null : g.assist1_id,
    assist2_id: (g.assist2_id === 'sub' || !g.assist2_id) ? null : g.assist2_id,
  }));

  const saveSheet = async () => {
    if (!selectedMatch) { toast.error('Sélectionnez un match'); return; }
    const invalids = goals.filter(g => !g.team_id);
    if (invalids.length > 0) { toast.error('Chaque but doit avoir une équipe'); return; }
    setSaving(true);
    try {
      await api.post(`/matches/${selectedMatch}/gamesheet`, { goals: normalizeGoals(goals), home_score: homeScore, away_score: awayScore, notes });
      toast.success('Sauvegardé!');
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
    finally { setSaving(false); }
  };

  const validateMatch = async () => {
    if (!confirm('Valider ce match ? Les statistiques seront mises à jour.')) return;
    setSaving(true);
    try {
      await api.post(`/matches/${selectedMatch}/gamesheet`, { goals: normalizeGoals(goals), home_score: homeScore, away_score: awayScore, notes });
      await api.post(`/matches/${selectedMatch}/validate`);
      toast.success('Match validé !');
      navigate('/standings');
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
    finally { setSaving(false); }
  };

  const homeTeam = teams.find(t => String(t.id) === String(form.home_team_id));
  const awayTeam = teams.find(t => String(t.id) === String(form.away_team_id));
  const matchData = matches.find(m => String(m.id) === String(selectedMatch));

  if (loading) return <div className="text-center py-12 text-gray-500 animate-pulse">Chargement...</div>;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">

      <h1 className="page-title">Feuille de match</h1>

      {/* Match selector */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <select
            className="select flex-1"
            value={selectedMatch}
            onChange={e => setSelectedMatch(e.target.value)}
          >
            <option value="">— Sélectionner un match —</option>
            {matches.map(m => (
              <option key={m.id} value={m.id}>
                {m.home_team_name} vs {m.away_team_name} · {m.date?.slice(0, 10)} {m.validated ? '✓' : ''}
              </option>
            ))}
          </select>
          <button onClick={() => setShowCreateForm(v => !v)} className="btn-secondary py-2 flex-shrink-0">
            {showCreateForm ? <ChevronUp size={16} /> : <Plus size={16} />}
            <span className="hidden sm:inline">Nouveau</span>
          </button>
        </div>

        {showCreateForm && (
          <form onSubmit={createMatch} className="border-t border-gray-700 pt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="label">Équipe locale *</label>
              <select className="select" value={form.home_team_id} onChange={e => setForm(f => ({ ...f, home_team_id: e.target.value }))} required>
                <option value="">—</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Équipe visiteur *</label>
              <select className="select" value={form.away_team_id} onChange={e => setForm(f => ({ ...f, away_team_id: e.target.value }))} required>
                <option value="">—</option>
                {teams.filter(t => String(t.id) !== String(form.home_team_id)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Date et heure *</label>
              <input type="datetime-local" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
            <button type="submit" className="col-span-2 btn-primary justify-center">Créer le match</button>
          </form>
        )}
      </div>

      {selectedMatch && (
        <>
          {/* Scoreboard with +/- controls */}
          <div className="card">
            {matchData?.validated && (
              <div className="text-center mb-3">
                <span className="text-xs bg-green-500/20 text-green-400 px-3 py-1 rounded-full">Match validé</span>
              </div>
            )}
            <div className="flex items-center justify-center gap-2">

              {/* Home team */}
              <div className="flex-1 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  {homeTeam && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: homeTeam.color }} />}
                  <span className="font-bold text-white text-sm">{homeTeam?.name || '—'}</span>
                </div>
                <div className="text-xs text-gray-500 mb-2">Local</div>
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => adjustScore('home', -1)} className="w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-300 transition-colors">
                    <Minus size={14} />
                  </button>
                  <span className="text-5xl font-black text-white tabular-nums w-14 text-center">{homeScore}</span>
                  <button onClick={() => adjustScore('home', +1)} className="w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-300 transition-colors">
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <span className="text-2xl text-gray-700 pb-2">–</span>

              {/* Away team */}
              <div className="flex-1 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  {awayTeam && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: awayTeam.color }} />}
                  <span className="font-bold text-white text-sm">{awayTeam?.name || '—'}</span>
                </div>
                <div className="text-xs text-gray-500 mb-2">Visiteur</div>
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => adjustScore('away', -1)} className="w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-300 transition-colors">
                    <Minus size={14} />
                  </button>
                  <span className="text-5xl font-black text-white tabular-nums w-14 text-center">{awayScore}</span>
                  <button onClick={() => adjustScore('away', +1)} className="w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-300 transition-colors">
                    <Plus size={14} />
                  </button>
                </div>
              </div>

            </div>
            <p className="text-center text-xs text-gray-600 mt-3">Utilisez +/− pour les buts de remplaçants (pas comptés dans les stats)</p>
          </div>

          {/* Goals for stats */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white text-sm">Buts enregistrés <span className="text-gray-500 font-normal">(pour les statistiques)</span></span>
            </div>

            {/* Team buttons */}
            {homeTeam && awayTeam && (
              <div className="flex gap-2">
                <button
                  onClick={() => addGoalForTeam(homeTeam.id)}
                  className="flex-1 py-3 rounded-xl border-2 font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
                  style={{ backgroundColor: homeTeam.color + '25', borderColor: homeTeam.color + '70' }}
                >
                  <Plus size={15} /> But — {homeTeam.name}
                </button>
                <button
                  onClick={() => addGoalForTeam(awayTeam.id)}
                  className="flex-1 py-3 rounded-xl border-2 font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
                  style={{ backgroundColor: awayTeam.color + '25', borderColor: awayTeam.color + '70' }}
                >
                  <Plus size={15} /> But — {awayTeam.name}
                </button>
              </div>
            )}

            {goals.length === 0 ? (
              <div className="text-center py-6 text-gray-600 text-sm">
                <Target size={24} className="mx-auto mb-2 opacity-30" />
                Aucun but enregistré
              </div>
            ) : (
              <div className="space-y-2">
                {goals.map((g, i) => (
                  <GoalRow
                    key={i}
                    goal={g}
                    index={i}
                    homeTeam={homeTeam}
                    awayTeam={awayTeam}
                    allPlayers={allPlayers}
                    onChange={updateGoal}
                    onRemove={removeGoal}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes (optionnel)</label>
            <textarea
              className="input min-h-[60px] resize-none"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes sur le match..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-1 pb-6">
            <button onClick={saveSheet} disabled={saving} className="btn-secondary">
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
            {isAdmin && (
              <button onClick={validateMatch} disabled={saving} className="btn-success">
                <Check size={15} /> Valider et publier
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
