import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Plus, X, Check, Target, ChevronUp, Shield } from 'lucide-react';

const PERIODS = [
  { value: '1', label: '1re' },
  { value: '2', label: '2e' },
  { value: '3', label: '3e' },
  { value: '5', label: 'Fusil.' },
];

function goalieOptions(players, teamId) {
  return players
    .filter((player) => String(player.team_id) === String(teamId) && player.position === 'G' && player.status === 'active')
    .sort((a, b) => (a.number || 999) - (b.number || 999) || `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`));
}

function getDefaultGoalieValue(players, teamId) {
  const [goalie] = goalieOptions(players, teamId);
  return goalie ? String(goalie.id) : '';
}

function normalizeGoalieSelection(value) {
  return {
    goalie_id: value && value !== 'sub' ? value : null,
    goalie_is_sub: value === 'sub',
  };
}

function GoalieSelect({ label, team, value, options, onChange }) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team?.color || '#6b7280' }} />
        <span className="text-sm font-semibold text-white">{label}</span>
      </div>
      <select className="select text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">—</option>
        <option value="sub">Remplaçant</option>
        {options.map((player) => (
          <option key={player.id} value={player.id}>
            #{player.number || '—'} {player.first_name} {player.last_name}
          </option>
        ))}
      </select>
    </div>
  );
}

function GoalRow({ goal, index, homeTeam, awayTeam, allPlayers, onChange, onRemove }) {
  const team = [homeTeam, awayTeam].find((candidate) => candidate && String(candidate.id) === String(goal.team_id));
  const teamPlayers = allPlayers.filter((player) => String(player.team_id) === String(goal.team_id));
  const set = (key, value) => onChange(index, { ...goal, [key]: value });

  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-gray-800/60 border border-gray-700">
      <div className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: team?.color || '#6b7280' }} />

      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: team?.color }} />
          <span className="text-xs text-white font-semibold flex-1">{team?.name}</span>
          <div className="flex gap-1">
            {PERIODS.map((period) => (
              <button
                key={period.value}
                type="button"
                onClick={() => set('period', period.value)}
                className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                  String(goal.period) === period.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wide">Buteur *</label>
            <select className="select mt-0.5 text-sm" value={goal.scorer_id} onChange={(event) => set('scorer_id', event.target.value)}>
              <option value="">—</option>
              <option value="sub">Remplaçant</option>
              {teamPlayers.map((player) => (
                <option key={player.id} value={player.id}>#{player.number} {player.last_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wide">Passeur 1</label>
            <select className="select mt-0.5 text-sm" value={goal.assist1_id} onChange={(event) => set('assist1_id', event.target.value)}>
              <option value="">—</option>
              <option value="sub">Remplaçant</option>
              {teamPlayers
                .filter((player) => String(player.id) !== String(goal.scorer_id))
                .map((player) => (
                  <option key={player.id} value={player.id}>#{player.number} {player.last_name}</option>
                ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wide">Passeur 2</label>
            <select className="select mt-0.5 text-sm" value={goal.assist2_id} onChange={(event) => set('assist2_id', event.target.value)}>
              <option value="">—</option>
              <option value="sub">Remplaçant</option>
              {teamPlayers
                .filter((player) => String(player.id) !== String(goal.scorer_id) && String(player.id) !== String(goal.assist1_id))
                .map((player) => (
                  <option key={player.id} value={player.id}>#{player.number} {player.last_name}</option>
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
  const { isAdmin, isMarqueur, canEditGamesheet } = useAuth();

  const sortMatchesByDate = (list) => [...list].sort((a, b) => new Date(a.date) - new Date(b.date));
  const nextMatch = (list) => sortMatchesByDate(list.filter((match) => !match.validated)).slice(0, 1);

  const [teams, setTeams] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(id || '');
  const [form, setForm] = useState({
    home_team_id: '',
    away_team_id: '',
    date: '',
    location: "Aréna de l'Assomption",
    season_id: '',
    home_goalie_id: '',
    away_goalie_id: '',
  });
  const [goals, setGoals] = useState([]);
  const [notes, setNotes] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/teams'), api.get('/players'), api.get('/matches'), api.get('/seasons/active')])
      .then(([teamsResponse, playersResponse, matchesResponse, seasonResponse]) => {
        setTeams(teamsResponse.data);
        setAllPlayers(playersResponse.data);
        const pool = matchesResponse.data;
        const filtered = isAdmin ? sortMatchesByDate(pool) : isMarqueur ? nextMatch(pool) : sortMatchesByDate(pool.filter((match) => !match.validated));
        setMatches(filtered);

        if (isMarqueur && filtered.length === 1 && !id) {
          setSelectedMatch(String(filtered[0].id));
        }

        if (seasonResponse.data) {
          setForm((current) => ({ ...current, season_id: seasonResponse.data.id }));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedMatch) return;
    api.get(`/matches/${selectedMatch}`).then((response) => {
      const match = response.data;
      setForm({
        home_team_id: match.home_team_id,
        away_team_id: match.away_team_id,
        date: match.date?.slice(0, 16),
        location: match.location || "Aréna de l'Assomption",
        season_id: match.season_id,
        home_goalie_id: match.home_goalie_is_sub ? 'sub' : (match.home_goalie_id ? String(match.home_goalie_id) : getDefaultGoalieValue(allPlayers, match.home_team_id)),
        away_goalie_id: match.away_goalie_is_sub ? 'sub' : (match.away_goalie_id ? String(match.away_goalie_id) : getDefaultGoalieValue(allPlayers, match.away_team_id)),
      });
      setGoals(match.goals || []);
      setNotes(match.notes || '');
      setShowCreateForm(false);
    });
  }, [selectedMatch, allPlayers]);

  const createMatch = async (event) => {
    event.preventDefault();
    try {
      const response = await api.post('/matches', form);
      const newId = String(response.data.id);
      const matchesResponse = await api.get('/matches');
      const pool = matchesResponse.data;
      const filtered = isAdmin ? sortMatchesByDate(pool) : isMarqueur ? nextMatch(pool) : sortMatchesByDate(pool.filter((match) => !match.validated));
      setMatches(filtered);
      setSelectedMatch(newId);
      toast.success('Match créé');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur');
    }
  };

  const addGoalForTeam = (teamId) => {
    setGoals((current) => [
      ...current,
      {
        team_id: String(teamId),
        scorer_id: '',
        assist1_id: '',
        assist2_id: '',
        period: '1',
        time_in_period: '',
      },
    ]);
  };

  const updateGoal = (index, goal) => setGoals((current) => current.map((item, currentIndex) => (currentIndex === index ? goal : item)));
  const removeGoal = (index) => setGoals((current) => current.filter((_, currentIndex) => currentIndex !== index));

  const normalizeGoals = (items) => items.map((goal) => ({
    ...goal,
    scorer_id: goal.scorer_id === 'sub' || !goal.scorer_id ? null : goal.scorer_id,
    assist1_id: goal.assist1_id === 'sub' || !goal.assist1_id ? null : goal.assist1_id,
    assist2_id: goal.assist2_id === 'sub' || !goal.assist2_id ? null : goal.assist2_id,
  }));

  const buildGamesheetPayload = () => {
    const homeGoalie = normalizeGoalieSelection(form.home_goalie_id);
    const awayGoalie = normalizeGoalieSelection(form.away_goalie_id);
    return {
      goals: normalizeGoals(goals),
      home_score: homeScore,
      away_score: awayScore,
      notes,
      home_goalie_id: homeGoalie.goalie_id,
      away_goalie_id: awayGoalie.goalie_id,
      home_goalie_is_sub: homeGoalie.goalie_is_sub,
      away_goalie_is_sub: awayGoalie.goalie_is_sub,
    };
  };

  const saveSheet = async () => {
    if (!selectedMatch) {
      toast.error('Sélectionnez un match');
      return;
    }
    const invalids = goals.filter((goal) => !goal.team_id);
    if (invalids.length > 0) {
      toast.error('Chaque but doit avoir une équipe');
      return;
    }

    setSaving(true);
    try {
      await api.post(`/matches/${selectedMatch}/gamesheet`, buildGamesheetPayload());
      toast.success('Sauvegardé');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const validateMatch = async () => {
    if (homeScore === awayScore) {
      toast.error('Un match ne peut pas se terminer à égalité. Ajoutez un but en fusillade.');
      return;
    }
    if (!confirm('Valider ce match ? Les statistiques seront mises à jour.')) return;

    setSaving(true);
    try {
      await api.post(`/matches/${selectedMatch}/gamesheet`, buildGamesheetPayload());
      await api.post(`/matches/${selectedMatch}/validate`);
      toast.success('Match validé');
      navigate('/standings');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const homeTeam = teams.find((team) => String(team.id) === String(form.home_team_id));
  const awayTeam = teams.find((team) => String(team.id) === String(form.away_team_id));
  const homeGoalies = goalieOptions(allPlayers, form.home_team_id);
  const awayGoalies = goalieOptions(allPlayers, form.away_team_id);
  const matchData = matches.find((match) => String(match.id) === String(selectedMatch));
  const homeScore = goals.filter((goal) => String(goal.team_id) === String(form.home_team_id)).length;
  const awayScore = goals.filter((goal) => String(goal.team_id) === String(form.away_team_id)).length;
  const isMatchLocked = isMarqueur && !!selectedMatch && (matches.length === 0 || String(matches[0]?.id) !== String(selectedMatch));

  if (loading) return <div className="text-center py-12 text-gray-500 animate-pulse">Chargement...</div>;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="page-title">Feuille de match</h1>

      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <select className="select flex-1" value={selectedMatch} onChange={(event) => setSelectedMatch(event.target.value)}>
            <option value="">— Sélectionner un match —</option>
            {matches.map((match) => (
              <option key={match.id} value={match.id}>
                {match.home_team_name} vs {match.away_team_name} · {match.date?.slice(0, 10)} {match.validated ? '✓' : ''}
              </option>
            ))}
          </select>
          {isAdmin && (
            <button onClick={() => setShowCreateForm((current) => !current)} className="btn-secondary py-2 flex-shrink-0">
              {showCreateForm ? <ChevronUp size={16} /> : <Plus size={16} />}
              <span className="hidden sm:inline">Nouveau</span>
            </button>
          )}
        </div>

        {showCreateForm && (
          <form onSubmit={createMatch} className="border-t border-gray-700 pt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="label">Équipe locale *</label>
              <select className="select" value={form.home_team_id} onChange={(event) => setForm((current) => ({ ...current, home_team_id: event.target.value }))} required>
                <option value="">—</option>
                {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Équipe visiteur *</label>
              <select className="select" value={form.away_team_id} onChange={(event) => setForm((current) => ({ ...current, away_team_id: event.target.value }))} required>
                <option value="">—</option>
                {teams.filter((team) => String(team.id) !== String(form.home_team_id)).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Date et heure *</label>
              <input type="datetime-local" className="input" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} required />
            </div>
            <button type="submit" className="col-span-2 btn-primary justify-center">Créer le match</button>
          </form>
        )}
      </div>

      {selectedMatch && (
        <>
          {isMatchLocked && (
            <div className="card text-center py-8 space-y-2">
              <div className="text-3xl">🔒</div>
              <div className="font-semibold text-white">Feuille verrouillée</div>
              <div className="text-sm text-gray-500">
                {matchData?.validated
                  ? 'Ce match a déjà été validé par l’administrateur.'
                  : 'Ce match n’est accessible que le jour de la partie.'}
              </div>
            </div>
          )}

          <div className="card">
            {matchData?.validated && (
              <div className="text-center mb-3">
                <span className="text-xs bg-green-500/20 text-green-400 px-3 py-1 rounded-full">Match validé</span>
              </div>
            )}
            <div className="flex items-center justify-center gap-6">
              <div className="flex-1 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  {homeTeam && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: homeTeam.color }} />}
                  <span className="font-bold text-white text-sm">{homeTeam?.name || '—'}</span>
                </div>
                <div className="text-xs text-gray-500 mb-2">Local</div>
                <span className="text-5xl font-black text-white tabular-nums">{homeScore}</span>
              </div>
              <span className="text-2xl text-gray-700">–</span>
              <div className="flex-1 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  {awayTeam && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: awayTeam.color }} />}
                  <span className="font-bold text-white text-sm">{awayTeam?.name || '—'}</span>
                </div>
                <div className="text-xs text-gray-500 mb-2">Visiteur</div>
                <span className="text-5xl font-black text-white tabular-nums">{awayScore}</span>
              </div>
            </div>
            {homeScore === awayScore && homeScore > 0 ? (
              <p className="text-center text-xs text-yellow-500 mt-3 font-medium">⚠️ Égalité — ajoutez un but en fusillade</p>
            ) : (
              <p className="text-center text-xs text-gray-600 mt-3">Score calculé automatiquement depuis les buts enregistrés</p>
            )}
          </div>

          {!isMatchLocked && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-white text-sm">Gardiens enregistrés</span>
                <span className="text-xs text-gray-500 flex items-center gap-1"><Shield size={12} /> Utilisé pour la moyenne de buts contre</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <GoalieSelect
                  label={`Gardien — ${homeTeam?.name || 'Local'}`}
                  team={homeTeam}
                  value={form.home_goalie_id}
                  options={homeGoalies}
                  onChange={(value) => setForm((current) => ({ ...current, home_goalie_id: value }))}
                />
                <GoalieSelect
                  label={`Gardien — ${awayTeam?.name || 'Visiteur'}`}
                  team={awayTeam}
                  value={form.away_goalie_id}
                  options={awayGoalies}
                  onChange={(value) => setForm((current) => ({ ...current, away_goalie_id: value }))}
                />
              </div>
            </div>
          )}

          {!isMatchLocked && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white text-sm">Buts enregistrés <span className="text-gray-500 font-normal">(pour les statistiques)</span></span>
              </div>

              {homeTeam && awayTeam && (
                <div className="flex gap-2">
                  <button
                    onClick={() => addGoalForTeam(homeTeam.id)}
                    className="flex-1 py-3 rounded-xl border-2 font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
                    style={{ backgroundColor: `${homeTeam.color}25`, borderColor: `${homeTeam.color}70` }}
                  >
                    <Plus size={15} /> But — {homeTeam.name}
                  </button>
                  <button
                    onClick={() => addGoalForTeam(awayTeam.id)}
                    className="flex-1 py-3 rounded-xl border-2 font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
                    style={{ backgroundColor: `${awayTeam.color}25`, borderColor: `${awayTeam.color}70` }}
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
                  {goals.map((goal, index) => (
                    <GoalRow
                      key={index}
                      goal={goal}
                      index={index}
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
          )}

          {!isMatchLocked && (
            <div>
              <label className="label">Notes (optionnel)</label>
              <textarea className="input min-h-[60px] resize-none" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes sur le match..." />
            </div>
          )}

          {!isMatchLocked && (
            <div className="flex gap-3 justify-end pt-1 pb-6">
              <button onClick={saveSheet} disabled={saving} className="btn-secondary">
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
              {canEditGamesheet && (
                <button onClick={validateMatch} disabled={saving} className="btn-success">
                  <Check size={15} /> Valider et publier
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
