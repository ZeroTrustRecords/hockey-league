import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronUp, Plus, Save, Shield, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

function goalieOptions(players, teamId) {
  return players
    .filter(
      (player) =>
        String(player.team_id) === String(teamId) &&
        player.position === 'G' &&
        player.status === 'active'
    )
    .sort(
      (a, b) =>
        (a.number || 999) - (b.number || 999) ||
        `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
    );
}

function teamActivePlayers(players, teamId) {
  return players
    .filter((player) => String(player.team_id) === String(teamId) && player.status === 'active')
    .sort(
      (a, b) =>
        (a.position === 'G' ? 1 : 0) - (b.position === 'G' ? 1 : 0) ||
        (a.number || 999) - (b.number || 999) ||
        `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
    );
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

function buildTeamStatLookup(players, teamId, goals, penalties) {
  const lookup = new Map();
  const teamPlayers = players.filter((player) => String(player.team_id) === String(teamId));

  for (const player of teamPlayers) {
    lookup.set(String(player.id), {
      player,
      goals: 0,
      assists: 0,
      pim: 0,
    });
  }

  lookup.set('sub', {
    player: null,
    goals: 0,
    assists: 0,
    pim: 0,
  });

  for (const goal of goals || []) {
    if (String(goal.team_id) !== String(teamId)) continue;

    const scorerKey = goal.scorer_id ? String(goal.scorer_id) : 'sub';
    if (!lookup.has(scorerKey)) {
      lookup.set(scorerKey, { player: null, goals: 0, assists: 0, pim: 0 });
    }
    lookup.get(scorerKey).goals += 1;

    if (goal.assist1_id) {
      const assistKey = String(goal.assist1_id);
      if (!lookup.has(assistKey)) {
        lookup.set(assistKey, { player: null, goals: 0, assists: 0, pim: 0 });
      }
      lookup.get(assistKey).assists += 1;
    }

    if (goal.assist2_id) {
      const assistKey = String(goal.assist2_id);
      if (!lookup.has(assistKey)) {
        lookup.set(assistKey, { player: null, goals: 0, assists: 0, pim: 0 });
      }
      lookup.get(assistKey).assists += 1;
    }
  }

  for (const penalty of penalties || []) {
    if (String(penalty.team_id) !== String(teamId)) continue;
    const key = penalty.player_id ? String(penalty.player_id) : 'sub';
    if (!lookup.has(key)) {
      lookup.set(key, { player: null, goals: 0, assists: 0, pim: 0 });
    }
    lookup.get(key).pim += Number(penalty.minutes || 0);
  }

  return lookup;
}

function buildSkaterRows(players, teamId, lookup) {
  const skaters = teamActivePlayers(players, teamId).filter((player) => player.position !== 'G');
  const rows = skaters.map((player) => {
    const stats = lookup.get(String(player.id)) || { goals: 0, assists: 0, pim: 0 };
    return {
      player_id: String(player.id),
      label: `${player.first_name} ${player.last_name}`,
      jersey: player.number || '—',
      goals: stats.goals || 0,
      assists: stats.assists || 0,
      pim: stats.pim || 0,
      replacement: false,
    };
  });

  const replacementStats = lookup.get('sub') || { goals: 0, assists: 0, pim: 0 };
  rows.push({
    player_id: null,
    label: 'Remplaçant',
    jersey: '—',
    goals: replacementStats.goals || 0,
    assists: replacementStats.assists || 0,
    pim: replacementStats.pim || 0,
    replacement: true,
  });

  return rows;
}

function buildGoalieStats(goalieValue, lookup) {
  if (!goalieValue || goalieValue === 'sub') {
    return { goals: 0, assists: 0, pim: 0 };
  }

  const stats = lookup.get(String(goalieValue));
  return {
    goals: stats?.goals || 0,
    assists: stats?.assists || 0,
    pim: stats?.pim || 0,
  };
}

function toInt(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function StatInput({ value, onChange, disabled = false }) {
  return (
    <input
      type="number"
      min="0"
      step="1"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Math.max(0, Number(event.target.value || 0)))}
      className="w-16 rounded-lg border border-gray-700 bg-gray-800 px-2 py-2 text-center text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

function TeamSheet({
  title,
  team,
  goalieValue,
  goalieChoices,
  goalieStats,
  goalsAgainst,
  rows,
  readOnly,
  onGoalieChange,
  onGoalieStatsChange,
  onRowChange,
}) {
  const headerStyle = {
    backgroundColor: team?.color || '#111827',
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-700 bg-gray-900">
      <div className="bg-black px-5 py-4 text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-400">{title}</div>
        <div className="mt-2 text-2xl font-black uppercase text-white">{team?.name || 'Équipe'}</div>
      </div>

      <div className="border-t border-gray-700">
        <div className="grid grid-cols-[minmax(0,1fr)_80px_80px_80px_80px] bg-gray-100/95 text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600">
          <div className="border-r border-gray-300 px-4 py-3 text-left text-gray-900">Gardien</div>
          <div className="border-r border-gray-300 px-2 py-3 text-center">BC</div>
          <div className="border-r border-gray-300 px-2 py-3 text-center">B</div>
          <div className="border-r border-gray-300 px-2 py-3 text-center">P</div>
          <div className="px-2 py-3 text-center">PU</div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_80px_80px_80px_80px] border-t border-gray-300 bg-white">
          <div className="border-r border-gray-300 px-4 py-3">
            {readOnly ? (
              <div className="min-h-[44px] rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-semibold text-sky-600">
                {goalieValue === 'sub'
                  ? 'Remplaçant'
                  : goalieChoices.find((goalie) => String(goalie.id) === String(goalieValue))
                    ? `${goalieChoices.find((goalie) => String(goalie.id) === String(goalieValue)).first_name} ${goalieChoices.find((goalie) => String(goalie.id) === String(goalieValue)).last_name}`
                    : '—'}
              </div>
            ) : (
              <select
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-sky-600"
                value={goalieValue}
                onChange={(event) => onGoalieChange(event.target.value)}
              >
                <option value="">—</option>
                <option value="sub">Remplaçant</option>
                {goalieChoices.map((goalie) => (
                  <option key={goalie.id} value={goalie.id}>
                    #{goalie.number || '—'} {goalie.first_name} {goalie.last_name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center justify-center border-r border-gray-300 bg-gray-50 px-2 py-3 text-lg font-black text-gray-900">
            {goalsAgainst}
          </div>
          <div className="flex items-center justify-center border-r border-gray-300 px-2 py-3">
            {readOnly ? (
              <span className="text-sm font-semibold text-gray-900">{goalieStats.goals || '-'}</span>
            ) : (
              <StatInput
                value={goalieStats.goals}
                onChange={(value) => onGoalieStatsChange({ ...goalieStats, goals: value })}
                disabled={goalieValue === 'sub' || !goalieValue}
              />
            )}
          </div>
          <div className="flex items-center justify-center border-r border-gray-300 px-2 py-3">
            {readOnly ? (
              <span className="text-sm font-semibold text-gray-900">{goalieStats.assists || '-'}</span>
            ) : (
              <StatInput
                value={goalieStats.assists}
                onChange={(value) => onGoalieStatsChange({ ...goalieStats, assists: value })}
                disabled={goalieValue === 'sub' || !goalieValue}
              />
            )}
          </div>
          <div className="flex items-center justify-center px-2 py-3">
            {readOnly ? (
              <span className="text-sm font-semibold text-gray-900">{goalieStats.pim || '-'}</span>
            ) : (
              <StatInput
                value={goalieStats.pim}
                onChange={(value) => onGoalieStatsChange({ ...goalieStats, pim: value })}
                disabled={goalieValue === 'sub' || !goalieValue}
              />
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-700">
        <div className="grid grid-cols-[minmax(0,1fr)_80px_80px_80px_80px] bg-gray-100/95 text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600">
          <div className="border-r border-gray-300 px-4 py-3 text-left text-gray-900">Joueurs</div>
          <div className="border-r border-gray-300 px-2 py-3 text-center">B</div>
          <div className="border-r border-gray-300 px-2 py-3 text-center">P</div>
          <div className="border-r border-gray-300 px-2 py-3 text-center">PTS</div>
          <div className="px-2 py-3 text-center">PU</div>
        </div>

        {rows.map((row, index) => (
          <div
            key={`${row.player_id || 'sub'}-${index}`}
            className="grid grid-cols-[minmax(0,1fr)_80px_80px_80px_80px] border-t border-gray-300 bg-white"
          >
            <div className={`border-r border-gray-300 px-4 py-3 ${row.replacement ? 'bg-gray-50' : ''}`}>
              <div className={`text-sm font-semibold ${row.replacement ? 'text-gray-700' : 'text-sky-600'}`}>
                {row.label}
              </div>
              {!row.replacement && <div className="text-xs text-gray-400">#{row.jersey}</div>}
            </div>
            <div className="flex items-center justify-center border-r border-gray-300 px-2 py-3">
              {readOnly ? (
                <span className="text-sm font-semibold text-gray-900">{row.goals || '-'}</span>
              ) : (
                <StatInput value={row.goals} onChange={(value) => onRowChange(index, { ...row, goals: value })} />
              )}
            </div>
            <div className="flex items-center justify-center border-r border-gray-300 px-2 py-3">
              {readOnly ? (
                <span className="text-sm font-semibold text-gray-900">{row.assists || '-'}</span>
              ) : (
                <StatInput value={row.assists} onChange={(value) => onRowChange(index, { ...row, assists: value })} />
              )}
            </div>
            <div className="flex items-center justify-center border-r border-gray-300 bg-amber-50 px-2 py-3 text-base font-black text-gray-900">
              {row.goals + row.assists || '-'}
            </div>
            <div className="flex items-center justify-center px-2 py-3">
              {readOnly ? (
                <span className="text-sm font-semibold text-gray-900">{row.pim || '-'}</span>
              ) : (
                <StatInput value={row.pim} onChange={(value) => onRowChange(index, { ...row, pim: value })} />
              )}
            </div>
          </div>
        ))}
      </div>
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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState({
    home_team_id: '',
    away_team_id: '',
    date: '',
    location: "Aréna de l'Assomption",
    season_id: '',
    home_goalie_id: '',
    away_goalie_id: '',
  });
  const [homeRows, setHomeRows] = useState([]);
  const [awayRows, setAwayRows] = useState([]);
  const [homeGoalieStats, setHomeGoalieStats] = useState({ goals: 0, assists: 0, pim: 0 });
  const [awayGoalieStats, setAwayGoalieStats] = useState({ goals: 0, assists: 0, pim: 0 });
  const [notes, setNotes] = useState('');
  const [sourceGoals, setSourceGoals] = useState([]);
  const [sourcePenalties, setSourcePenalties] = useState([]);

  useEffect(() => {
    Promise.all([api.get('/teams'), api.get('/players'), api.get('/matches'), api.get('/seasons/active')])
      .then(([teamsResponse, playersResponse, matchesResponse, seasonResponse]) => {
        setTeams(teamsResponse.data);
        setAllPlayers(playersResponse.data);

        const pool = matchesResponse.data;
        const filtered = isAdmin
          ? sortMatchesByDate(pool)
          : isMarqueur
            ? nextMatch(pool)
            : sortMatchesByDate(pool.filter((match) => !match.validated));

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
    if (!selectedMatch || allPlayers.length === 0) return;

    api.get(`/matches/${selectedMatch}`).then((response) => {
      const match = response.data;
      const homeGoalieValue = match.home_goalie_is_sub
        ? 'sub'
        : match.home_goalie_id
          ? String(match.home_goalie_id)
          : getDefaultGoalieValue(allPlayers, match.home_team_id);
      const awayGoalieValue = match.away_goalie_is_sub
        ? 'sub'
        : match.away_goalie_id
          ? String(match.away_goalie_id)
          : getDefaultGoalieValue(allPlayers, match.away_team_id);

      const loadedGoals = match.goals || [];
      const loadedPenalties = match.penalties || [];
      const homeLookup = buildTeamStatLookup(allPlayers, match.home_team_id, loadedGoals, loadedPenalties);
      const awayLookup = buildTeamStatLookup(allPlayers, match.away_team_id, loadedGoals, loadedPenalties);

      setForm({
        home_team_id: match.home_team_id,
        away_team_id: match.away_team_id,
        date: match.date?.slice(0, 16),
        location: match.location || "Aréna de l'Assomption",
        season_id: match.season_id,
        home_goalie_id: homeGoalieValue,
        away_goalie_id: awayGoalieValue,
      });
      setHomeRows(buildSkaterRows(allPlayers, match.home_team_id, homeLookup));
      setAwayRows(buildSkaterRows(allPlayers, match.away_team_id, awayLookup));
      setHomeGoalieStats(buildGoalieStats(homeGoalieValue, homeLookup));
      setAwayGoalieStats(buildGoalieStats(awayGoalieValue, awayLookup));
      setSourceGoals(loadedGoals);
      setSourcePenalties(loadedPenalties);
      setNotes(match.notes || '');
      setShowCreateForm(false);
    });
  }, [selectedMatch, allPlayers]);

  const homeTeam = useMemo(
    () => teams.find((team) => String(team.id) === String(form.home_team_id)),
    [teams, form.home_team_id]
  );
  const awayTeam = useMemo(
    () => teams.find((team) => String(team.id) === String(form.away_team_id)),
    [teams, form.away_team_id]
  );
  const homeGoalies = useMemo(() => goalieOptions(allPlayers, form.home_team_id), [allPlayers, form.home_team_id]);
  const awayGoalies = useMemo(() => goalieOptions(allPlayers, form.away_team_id), [allPlayers, form.away_team_id]);
  const matchData = useMemo(
    () => matches.find((match) => String(match.id) === String(selectedMatch)),
    [matches, selectedMatch]
  );
  const isMatchLocked =
    isMarqueur &&
    !!selectedMatch &&
    (matches.length === 0 || String(matches[0]?.id) !== String(selectedMatch));

  const homeScore = homeRows.reduce((sum, row) => sum + toInt(row.goals), 0) + toInt(homeGoalieStats.goals);
  const awayScore = awayRows.reduce((sum, row) => sum + toInt(row.goals), 0) + toInt(awayGoalieStats.goals);

  const resetGoalieStatsFromLoadedMatch = (teamId, goalieValue) => {
    const lookup = buildTeamStatLookup(allPlayers, teamId, sourceGoals, sourcePenalties);
    return buildGoalieStats(goalieValue, lookup);
  };

  const handleGoalieChange = (side, value) => {
    if (side === 'home') {
      setForm((current) => ({ ...current, home_goalie_id: value }));
      setHomeGoalieStats(resetGoalieStatsFromLoadedMatch(form.home_team_id, value));
      return;
    }

    setForm((current) => ({ ...current, away_goalie_id: value }));
    setAwayGoalieStats(resetGoalieStatsFromLoadedMatch(form.away_team_id, value));
  };

  const createMatch = async (event) => {
    event.preventDefault();

    try {
      const response = await api.post('/matches', form);
      const newId = String(response.data.id);
      const matchesResponse = await api.get('/matches');
      const pool = matchesResponse.data;
      const filtered = isAdmin
        ? sortMatchesByDate(pool)
        : isMarqueur
          ? nextMatch(pool)
          : sortMatchesByDate(pool.filter((match) => !match.validated));

      setMatches(filtered);
      setSelectedMatch(newId);
      toast.success('Match créé');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur');
    }
  };

  const buildPlayerStatsPayload = () => {
    const rows = [];

    const pushTeamRows = (teamId, teamRows, goalieValue, goalieStats) => {
      for (const row of teamRows) {
        const goals = toInt(row.goals);
        const assists = toInt(row.assists);
        const pim = toInt(row.pim);

        if (!goals && !assists && !pim) continue;

        rows.push({
          team_id: Number(teamId),
          player_id: row.player_id ? Number(row.player_id) : null,
          goals,
          assists,
          pim,
        });
      }

      if (goalieValue && goalieValue !== 'sub') {
        const goals = toInt(goalieStats.goals);
        const assists = toInt(goalieStats.assists);
        const pim = toInt(goalieStats.pim);

        if (goals || assists || pim) {
          rows.push({
            team_id: Number(teamId),
            player_id: Number(goalieValue),
            goals,
            assists,
            pim,
          });
        }
      }
    };

    pushTeamRows(form.home_team_id, homeRows, form.home_goalie_id, homeGoalieStats);
    pushTeamRows(form.away_team_id, awayRows, form.away_goalie_id, awayGoalieStats);

    return rows;
  };

  const buildGamesheetPayload = () => {
    const homeGoalie = normalizeGoalieSelection(form.home_goalie_id);
    const awayGoalie = normalizeGoalieSelection(form.away_goalie_id);

    return {
      player_stats: buildPlayerStatsPayload(),
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

    setSaving(true);
    try {
      await api.post(`/matches/${selectedMatch}/gamesheet`, buildGamesheetPayload());
      toast.success('Feuille sauvegardée');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const validateMatch = async () => {
    if (homeScore === awayScore) {
      toast.error('Un match ne peut pas se terminer à égalité.');
      return;
    }

    if (!confirm('Valider ce match et publier les statistiques ?')) return;

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

  if (loading) {
    return <div className="py-12 text-center text-gray-500 animate-pulse">Chargement...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="space-y-1">
        <h1 className="page-title">Feuille de match</h1>
        <p className="text-sm text-gray-500">
          Version simplifiée par équipe : buts, passes, minutes de punition et gardien.
        </p>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            className="select flex-1"
            value={selectedMatch}
            onChange={(event) => setSelectedMatch(event.target.value)}
          >
            <option value="">— Sélectionner un match —</option>
            {matches.map((match) => (
              <option key={match.id} value={match.id}>
                {match.home_team_name} vs {match.away_team_name} · {match.date?.slice(0, 10)}{' '}
                {match.validated ? '✓' : ''}
              </option>
            ))}
          </select>

          {isAdmin && (
            <button
              onClick={() => setShowCreateForm((current) => !current)}
              className="btn-secondary py-2 sm:w-auto"
            >
              {showCreateForm ? <ChevronUp size={16} /> : <Plus size={16} />}
              <span>Nouveau match</span>
            </button>
          )}
        </div>

        {showCreateForm && (
          <form onSubmit={createMatch} className="grid grid-cols-1 gap-3 border-t border-gray-700 pt-3 md:grid-cols-2">
            <div>
              <label className="label">Équipe locale *</label>
              <select
                className="select"
                value={form.home_team_id}
                onChange={(event) => setForm((current) => ({ ...current, home_team_id: event.target.value }))}
                required
              >
                <option value="">—</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Équipe visiteuse *</label>
              <select
                className="select"
                value={form.away_team_id}
                onChange={(event) => setForm((current) => ({ ...current, away_team_id: event.target.value }))}
                required
              >
                <option value="">—</option>
                {teams
                  .filter((team) => String(team.id) !== String(form.home_team_id))
                  .map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="label">Date et heure *</label>
              <input
                type="datetime-local"
                className="input"
                value={form.date}
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                required
              />
            </div>

            <button type="submit" className="btn-primary justify-center md:col-span-2">
              Créer le match
            </button>
          </form>
        )}
      </div>

      {selectedMatch && (
        <>
          {isMatchLocked && (
            <div className="card space-y-2 py-8 text-center">
              <div className="text-3xl">🔒</div>
              <div className="font-semibold text-white">Feuille verrouillée</div>
              <div className="text-sm text-gray-500">
                {matchData?.validated
                  ? 'Ce match a déjà été validé.'
                  : 'Ce match n’est accessible que pour la rencontre en cours.'}
              </div>
            </div>
          )}

          <div className="card">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-gray-500">Match sélectionné</div>
                <div className="mt-2 text-lg font-bold text-white">
                  {homeTeam?.name || '—'} vs {awayTeam?.name || '—'}
                </div>
                <div className="mt-1 text-sm text-gray-400">
                  {form.date?.replace('T', ' · ')} · {form.location}
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-gray-700 bg-gray-800/70 px-4 py-3">
                <div className="text-center">
                  <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Local</div>
                  <div className="mt-1 text-4xl font-black text-white">{homeScore}</div>
                </div>
                <div className="text-2xl text-gray-700">—</div>
                <div className="text-center">
                  <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Visiteur</div>
                  <div className="mt-1 text-4xl font-black text-white">{awayScore}</div>
                </div>
              </div>
            </div>

            {matchData?.validated && (
              <div className="mt-4">
                <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-400">
                  Match validé
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <TeamSheet
              title="Locaux"
              team={homeTeam}
              goalieValue={form.home_goalie_id}
              goalieChoices={homeGoalies}
              goalieStats={homeGoalieStats}
              goalsAgainst={awayScore}
              rows={homeRows}
              readOnly={isMatchLocked}
              onGoalieChange={(value) => handleGoalieChange('home', value)}
              onGoalieStatsChange={setHomeGoalieStats}
              onRowChange={(index, row) =>
                setHomeRows((current) => current.map((item, currentIndex) => (currentIndex === index ? row : item)))
              }
            />

            <TeamSheet
              title="Visiteurs"
              team={awayTeam}
              goalieValue={form.away_goalie_id}
              goalieChoices={awayGoalies}
              goalieStats={awayGoalieStats}
              goalsAgainst={homeScore}
              rows={awayRows}
              readOnly={isMatchLocked}
              onGoalieChange={(value) => handleGoalieChange('away', value)}
              onGoalieStatsChange={setAwayGoalieStats}
              onRowChange={(index, row) =>
                setAwayRows((current) => current.map((item, currentIndex) => (currentIndex === index ? row : item)))
              }
            />
          </div>

          <div className="card space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Users size={16} />
              Résumé rapide
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-gray-700 bg-gray-800/70 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Buts</div>
                <div className="mt-1 text-2xl font-black text-white">{homeScore + awayScore}</div>
              </div>
              <div className="rounded-xl border border-gray-700 bg-gray-800/70 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Punition locale</div>
                <div className="mt-1 text-2xl font-black text-white">
                  {homeRows.reduce((sum, row) => sum + toInt(row.pim), 0) + toInt(homeGoalieStats.pim)}
                </div>
              </div>
              <div className="rounded-xl border border-gray-700 bg-gray-800/70 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Punition visiteur</div>
                <div className="mt-1 text-2xl font-black text-white">
                  {awayRows.reduce((sum, row) => sum + toInt(row.pim), 0) + toInt(awayGoalieStats.pim)}
                </div>
              </div>
            </div>
          </div>

          {!isMatchLocked && (
            <div className="space-y-2">
              <label className="label">Notes (optionnel)</label>
              <textarea
                className="input min-h-[88px] resize-none"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Notes sur le match..."
              />
            </div>
          )}

          {!isMatchLocked && (
            <div className="flex flex-col justify-end gap-3 pb-6 sm:flex-row">
              <button onClick={saveSheet} disabled={saving} className="btn-secondary">
                <Save size={15} />
                <span>{saving ? 'Sauvegarde...' : 'Sauvegarder'}</span>
              </button>
              {canEditGamesheet && (
                <button onClick={validateMatch} disabled={saving} className="btn-success">
                  <Check size={15} />
                  <span>Valider et publier</span>
                </button>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-gray-300">
            <div className="flex items-center gap-2 font-semibold text-white">
              <Shield size={15} />
              Logique de remplacement conservée
            </div>
            <p className="mt-2">
              La ligne <span className="font-semibold text-white">Remplaçant</span> reste disponible dans chaque équipe.
              Le gardien peut aussi être défini sur <span className="font-semibold text-white">Remplaçant</span>.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
