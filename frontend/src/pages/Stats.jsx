import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Download, Shield, Target, TrendingUp } from 'lucide-react';
import api from '../api/client';

const positionLabel = {
  C: 'Centre',
  LW: 'Ailier G',
  RW: 'Ailier D',
  D: 'Défenseur',
  G: 'Gardien',
};

function SortIcon({ field, current, dir }) {
  if (current !== field) return <span className="opacity-20 text-xs">↕</span>;
  return <span className="text-xs">{dir === 'asc' ? '↑' : '↓'}</span>;
}

function Bar({ value, max }) {
  return (
    <div className="h-0.5 bg-gray-800 rounded-full overflow-hidden mt-1">
      <div className="h-full bg-gray-500 rounded-full" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
    </div>
  );
}

function LeaderCard({ title, subtitle, icon: Icon, players = [], statKey, unit }) {
  const max = players[0]?.[statKey] || 1;

  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className="text-gray-500" />
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">{subtitle}</p>

      <div className="space-y-3">
        {players.map((player, index) => (
          <div key={player.id}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-700 w-3">{index + 1}</span>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: player.team_color }} />
              <Link to={`/players/${player.id}`} className={`flex-1 min-w-0 text-sm truncate transition-colors hover:text-white ${index === 0 ? 'text-white font-semibold' : 'text-gray-400'}`}>
                {player.first_name} {player.last_name}
              </Link>
              <span className={`font-black text-sm ${index === 0 ? 'text-white' : 'text-gray-500'}`}>
                {player[statKey]} <span className="text-xs font-normal">{unit}</span>
              </span>
            </div>
            <div className="ml-5 h-0.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-gray-500 rounded-full" style={{ width: `${(player[statKey] / max) * 100}%` }} />
            </div>
          </div>
        ))}

        {players.length === 0 && <p className="text-sm text-gray-600 text-center py-4">Aucune donnée disponible</p>}
      </div>
    </div>
  );
}

export default function Stats() {
  const [tab, setTab] = useState('players');
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [leaders, setLeaders] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState('points');
  const [sortDir, setSortDir] = useState('desc');
  const [filterTeam, setFilterTeam] = useState('');
  const [filterPos, setFilterPos] = useState('');
  const [allTeams, setAllTeams] = useState([]);
  const [statType, setStatType] = useState(null);
  const [activeSeason, setActiveSeason] = useState(null);

  useEffect(() => {
    api.get('/seasons/active').then((response) => {
      const season = response.data;
      setActiveSeason(season);
      setStatType(season?.status === 'playoffs' || season?.status === 'completed' ? 'playoffs' : 'regular');
    }).catch(() => setStatType('regular'));
  }, []);

  useEffect(() => {
    if (statType === null) return;

    setLoading(true);
    const params = { limit: 100, type: statType };
    if (activeSeason?.id) params.season_id = activeSeason.id;

    Promise.all([
      api.get('/stats/players', { params }),
      api.get('/stats/teams', { params }),
      api.get('/stats/leaders', { params }),
      api.get('/teams'),
    ]).then(([playersResponse, teamsResponse, leadersResponse, allTeamsResponse]) => {
      setPlayers(playersResponse.data);
      setTeams(teamsResponse.data);
      setLeaders(leadersResponse.data);
      setAllTeams(allTeamsResponse.data);
    }).finally(() => setLoading(false));
  }, [statType, activeSeason]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const filteredPlayers = players
    .filter((player) => (!filterTeam || String(player.team_id) === filterTeam) && (!filterPos || player.position === filterPos))
    .sort((a, b) => {
      const aValue = a[sortField] ?? 0;
      const bValue = b[sortField] ?? 0;
      return sortDir === 'asc' ? aValue - bValue : bValue - aValue;
    });

  const maxGoals = Math.max(...filteredPlayers.map((player) => player.goals || 0), 1);
  const maxAssists = Math.max(...filteredPlayers.map((player) => player.assists || 0), 1);
  const maxPoints = Math.max(...filteredPlayers.map((player) => player.points || 0), 1);

  const summary = useMemo(() => {
    const phaseLabel = statType === 'playoffs' ? 'Éliminatoires' : statType === 'all' ? 'Toutes les compétitions' : 'Saison régulière';
    return {
      phaseLabel,
      playerCount: filteredPlayers.length,
      teamCount: teams.length,
    };
  }, [filteredPlayers.length, statType, teams.length]);

  const exportCSV = () => {
    const headers = 'Joueur,Équipe,Position,Matchs,Buts,Passes,Points\n';
    const rows = filteredPlayers.map((player) =>
      `"${player.first_name} ${player.last_name}","${player.team_name || ''}","${player.position}",${player.matches_played},${player.goals},${player.assists},${player.points}`,
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'stats_joueurs.csv';
    link.click();
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-600 text-sm">Chargement...</div>;
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Centre statistique</p>
          <h1 className="text-3xl sm:text-5xl font-black text-white">Statistiques</h1>
          <p className="text-gray-400 text-sm sm:text-base mt-2 max-w-2xl">
            Meneurs offensifs, rendement collectif et lecture rapide des tendances de la ligue.
          </p>
          <p className="text-xs text-gray-500 mt-3">
            {activeSeason?.name || 'Saison en cours'} · {summary.phaseLabel}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
          <div className="flex rounded-xl overflow-hidden border border-gray-700 text-sm w-full sm:w-auto">
            {[
              { key: 'regular', label: 'Saison régulière' },
              { key: 'playoffs', label: 'Éliminatoires' },
              { key: 'all', label: 'Tout' },
            ].map((option) => (
              <button
                key={option.key}
                onClick={() => setStatType(option.key)}
                className={`px-3 py-2 font-medium transition-colors text-xs sm:text-sm ${statType === option.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {tab === 'players' && (
            <button onClick={exportCSV} className="btn-secondary">
              <Download size={14} /> Exporter
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gray-600 mb-2">Phase</div>
          <div className="text-lg font-black text-white">{summary.phaseLabel}</div>
          <div className="text-xs text-gray-500 mt-1">Lecture active des statistiques</div>
        </div>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gray-600 mb-2">Joueurs</div>
          <div className="text-2xl font-black text-white">{summary.playerCount}</div>
          <div className="text-xs text-gray-500 mt-1">Joueurs visibles après filtres</div>
        </div>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gray-600 mb-2">Équipes</div>
          <div className="text-2xl font-black text-white">{summary.teamCount}</div>
          <div className="text-xs text-gray-500 mt-1">Clubs inclus dans le tableau</div>
        </div>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gray-600 mb-2">Contexte</div>
          <div className="text-lg font-black text-white truncate">{activeSeason?.name || 'Aucune saison'}</div>
          <div className="text-xs text-gray-500 mt-1">Saison actuellement affichée</div>
        </div>
      </div>

      {leaders && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <LeaderCard title="Buteurs" subtitle="Les meilleurs finisseurs du moment." icon={Target} players={leaders.goals || []} statKey="goals" unit="B" />
          <LeaderCard title="Passeurs" subtitle="Les joueurs qui distribuent le plus." icon={TrendingUp} players={leaders.assists || []} statKey="assists" unit="A" />
          <LeaderCard title="Total de points" subtitle="Les meneurs offensifs de la ligue." icon={Award} players={leaders.points || []} statKey="points" unit="PTS" />
        </div>
      )}

      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800 w-fit">
        <button onClick={() => setTab('players')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'players' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          Joueurs
        </button>
        <button onClick={() => setTab('teams')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'teams' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          Équipes
        </button>
      </div>

      {tab === 'players' && (
        <div className="space-y-4">
          <div className="flex flex-col xl:flex-row gap-3 items-start xl:items-center justify-between">
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              <select className="select w-full sm:w-48" value={filterTeam} onChange={(event) => setFilterTeam(event.target.value)}>
                <option value="">Toutes les équipes</option>
                {allTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
              <select className="select w-full sm:w-40" value={filterPos} onChange={(event) => setFilterPos(event.target.value)}>
                <option value="">Toutes positions</option>
                {['C', 'LW', 'RW', 'D', 'G'].map((position) => <option key={position} value={position}>{positionLabel[position]}</option>)}
              </select>
            </div>
            <span className="text-xs text-gray-500">{filteredPlayers.length} joueur{filteredPlayers.length !== 1 ? 's' : ''} affiché{filteredPlayers.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="bg-gray-900 rounded-3xl border border-gray-800 overflow-x-auto">
            <div className="px-5 py-4 border-b border-gray-800">
              <h2 className="text-lg font-bold text-white">Classement des joueurs</h2>
              <p className="text-sm text-gray-500 mt-1">Trie les colonnes pour comparer la production offensive sous tous les angles.</p>
            </div>

            <table className="w-full text-sm min-w-[980px]">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-5 text-xs text-gray-600 font-medium w-8">#</th>
                  <th className="text-left py-3 text-xs text-gray-600 font-medium">Joueur</th>
                  <th className="text-left py-3 text-xs text-gray-600 font-medium">Pos.</th>
                  <th className="text-left py-3 text-xs text-gray-600 font-medium">Équipe</th>
                  <th className="text-center py-3 text-xs text-gray-600 font-medium w-12 cursor-pointer hover:text-gray-400" onClick={() => handleSort('matches_played')}>MJ <SortIcon field="matches_played" current={sortField} dir={sortDir} /></th>
                  <th className="text-center py-3 text-xs text-gray-600 font-medium w-14 cursor-pointer hover:text-gray-400" onClick={() => handleSort('goals')}>B <SortIcon field="goals" current={sortField} dir={sortDir} /></th>
                  <th className="text-center py-3 text-xs text-gray-600 font-medium w-14 cursor-pointer hover:text-gray-400" onClick={() => handleSort('assists')}>A <SortIcon field="assists" current={sortField} dir={sortDir} /></th>
                  <th className="text-center py-3 pr-5 text-xs text-gray-500 font-semibold w-14 cursor-pointer hover:text-gray-400" onClick={() => handleSort('points')}>PTS <SortIcon field="points" current={sortField} dir={sortDir} /></th>
                  <th className="text-center py-3 pr-5 text-xs text-gray-600 font-medium w-16">Pts/MJ</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((player, index) => {
                  const ppg = player.matches_played > 0 ? (player.points / player.matches_played).toFixed(2) : '—';

                  return (
                    <tr key={player.id} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors last:border-0">
                      <td className="py-3.5 px-5 text-gray-600 text-xs">{index + 1}</td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: player.team_color ? `${player.team_color}40` : '#374151', border: `1px solid ${player.team_color || '#374151'}` }}
                          >
                            <span style={{ color: player.team_color || '#9ca3af' }}>{player.first_name?.[0]}{player.last_name?.[0]}</span>
                          </div>
                          <Link to={`/players/${player.id}`} className="text-gray-300 hover:text-white transition-colors font-medium">
                            {player.first_name} {player.last_name}
                          </Link>
                        </div>
                      </td>
                      <td className="py-3.5"><span className="position-badge">{player.position}</span></td>
                      <td className="py-3.5">
                        {player.team_name ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: player.team_color }} />
                            <span className="text-xs text-gray-500">{player.team_name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-700">—</span>
                        )}
                      </td>
                      <td className="py-3.5 text-center text-gray-600 text-xs">{player.matches_played || 0}</td>
                      <td className="py-3.5 text-center">
                        <div className="text-gray-300 font-medium">{player.goals || 0}</div>
                        <Bar value={player.goals || 0} max={maxGoals} />
                      </td>
                      <td className="py-3.5 text-center">
                        <div className="text-gray-300 font-medium">{player.assists || 0}</div>
                        <Bar value={player.assists || 0} max={maxAssists} />
                      </td>
                      <td className="py-3.5 pr-5 text-center">
                        <div className="font-black text-white">{player.points || 0}</div>
                        <Bar value={player.points || 0} max={maxPoints} />
                      </td>
                      <td className="py-3.5 pr-5 text-center text-gray-600 text-xs">{ppg}</td>
                    </tr>
                  );
                })}

                {filteredPlayers.length === 0 && (
                  <tr>
                    <td colSpan="9" className="py-10 text-center text-sm text-gray-600">
                      Aucun joueur ne correspond aux filtres choisis.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'teams' && (
        <div className="bg-gray-900 rounded-3xl border border-gray-800 overflow-x-auto">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-lg font-bold text-white">Portrait des équipes</h2>
            <p className="text-sm text-gray-500 mt-1">Production, rendement défensif et tendances récentes de chaque club.</p>
          </div>

          <table className="w-full text-sm min-w-[920px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 px-5 text-xs text-gray-600 font-medium">Équipe</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-12">PJ</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-12">V</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-12">D</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-12">BP</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-12">BC</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-14">Diff</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-16">Moy BP</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-16">Moy BC</th>
                <th className="text-center py-3 pr-5 text-xs text-gray-600 font-medium">5 derniers</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.team_id} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors last:border-0">
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team.team_color }} />
                      <Link to={`/teams/${team.team_id}`} className="text-gray-300 hover:text-white font-medium flex items-center gap-2">
                        <Shield size={14} className="text-gray-600" />
                        {team.team_name}
                      </Link>
                    </div>
                  </td>
                  <td className="py-3.5 text-center text-gray-600 text-xs">{team.gp}</td>
                  <td className="py-3.5 text-center text-gray-300 font-medium">{team.w}</td>
                  <td className="py-3.5 text-center text-gray-500">{team.l}</td>
                  <td className="py-3.5 text-center text-gray-500 text-xs">{team.gf}</td>
                  <td className="py-3.5 text-center text-gray-500 text-xs">{team.ga}</td>
                  <td className="py-3.5 text-center text-xs">
                    <span className={team.diff > 0 ? 'text-gray-300' : team.diff < 0 ? 'text-gray-600' : 'text-gray-600'}>
                      {team.diff > 0 ? '+' : ''}{team.diff}
                    </span>
                  </td>
                  <td className="py-3.5 text-center text-gray-600 text-xs">{team.avg_gf}</td>
                  <td className="py-3.5 text-center text-gray-600 text-xs">{team.avg_ga}</td>
                  <td className="py-3.5 pr-5">
                    <div className="flex items-center justify-center gap-1">
                      {(team.last5 || []).map((result, index) => (
                        <span key={index} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${result === 'W' ? 'bg-gray-700 text-gray-300' : 'bg-gray-800 text-gray-600'}`}>
                          {result === 'W' ? 'V' : 'D'}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}

              {teams.length === 0 && (
                <tr>
                  <td colSpan="10" className="py-10 text-center text-sm text-gray-600">
                    Aucune équipe n’a encore de statistiques à afficher.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
