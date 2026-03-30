import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { Target, TrendingUp, Award, BarChart3, Download } from 'lucide-react';

const positionLabel = { C: 'Centre', LW: 'Ailier G', RW: 'Ailier D', D: 'Défenseur', G: 'Gardien' };
const leaderColorClass = { red: 'text-red-400', blue: 'text-blue-400', yellow: 'text-yellow-400' };

function SortIcon({ field, current, dir }) {
  if (current !== field) return <span className="opacity-30">↕</span>;
  return dir === 'asc' ? <span>↑</span> : <span>↓</span>;
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

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/stats/players', { params: { limit: 100 } }),
      api.get('/stats/teams'),
      api.get('/stats/leaders'),
      api.get('/teams'),
    ]).then(([pr, tr, lr, at]) => {
      setPlayers(pr.data);
      setTeams(tr.data);
      setLeaders(lr.data);
      setAllTeams(at.data);
    }).finally(() => setLoading(false));
  }, []);

  const handleSort = field => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const filteredPlayers = players
    .filter(p => (!filterTeam || String(p.team_id) === filterTeam) && (!filterPos || p.position === filterPos))
    .sort((a, b) => {
      const av = a[sortField] ?? 0, bv = b[sortField] ?? 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });

  const exportCSV = () => {
    const headers = 'Joueur,Équipe,Position,Matchs,Buts,Passes,Points\n';
    const rows = filteredPlayers.map(p =>
      `"${p.first_name} ${p.last_name}","${p.team_name || ''}","${p.position}",${p.matches_played},${p.goals},${p.assists},${p.points}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'stats_joueurs.csv'; a.click();
  };

  if (loading) return <div className="text-center py-12 text-gray-500 animate-pulse">Chargement...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="page-title">Statistiques</h1>
        {tab === 'players' && (
          <button onClick={exportCSV} className="btn-secondary"><Download size={15} /> Exporter CSV</button>
        )}
      </div>

      {/* Leaders */}
      {leaders && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { key: 'goals', icon: Target, label: 'Meilleurs buteurs', color: 'red', statKey: 'goals', unit: 'B' },
            { key: 'assists', icon: TrendingUp, label: 'Meilleurs passeurs', color: 'blue', statKey: 'assists', unit: 'A' },
            { key: 'points', icon: Award, label: 'Leaders en points', color: 'yellow', statKey: 'points', unit: 'pts' },
          ].map(cat => (
            <div key={cat.key} className="card">
              <h3 className={`section-title mb-3 flex items-center gap-2 ${leaderColorClass[cat.color]}`}>
                <cat.icon size={16} />{cat.label}
              </h3>
              <div className="space-y-2">
                {(leaders[cat.key] || []).map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-4 font-bold">{i + 1}</span>
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.team_color }} />
                    <Link to={`/players/${p.id}`} className="flex-1 min-w-0 text-sm text-white hover:text-blue-400 truncate">
                      {p.first_name} {p.last_name}
                    </Link>
                    <span className={`font-bold ${leaderColorClass[cat.color]} text-sm`}>{p[cat.statKey]} {cat.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-0">
        <button onClick={() => setTab('players')} className={tab === 'players' ? 'tab-active' : 'tab-inactive'}>
          Joueurs
        </button>
        <button onClick={() => setTab('teams')} className={tab === 'teams' ? 'tab-active' : 'tab-inactive'}>
          Équipes
        </button>
      </div>

      {/* Players table */}
      {tab === 'players' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select className="select w-44" value={filterTeam} onChange={e => setFilterTeam(e.target.value)}>
              <option value="">Toutes les équipes</option>
              {allTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select className="select w-36" value={filterPos} onChange={e => setFilterPos(e.target.value)}>
              <option value="">Toutes positions</option>
              {['C','LW','RW','D','G'].map(p => <option key={p} value={p}>{positionLabel[p]}</option>)}
            </select>
            <span className="text-sm text-gray-500 self-center">{filteredPlayers.length} joueur{filteredPlayers.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th>Joueur</th>
                  <th>Pos</th>
                  <th>Équipe</th>
                  <th className="text-center cursor-pointer hover:text-white" onClick={() => handleSort('matches_played')}>
                    MJ <SortIcon field="matches_played" current={sortField} dir={sortDir} />
                  </th>
                  <th className="text-center cursor-pointer hover:text-white" onClick={() => handleSort('goals')}>
                    B <SortIcon field="goals" current={sortField} dir={sortDir} />
                  </th>
                  <th className="text-center cursor-pointer hover:text-white" onClick={() => handleSort('assists')}>
                    A <SortIcon field="assists" current={sortField} dir={sortDir} />
                  </th>
                  <th className="text-center cursor-pointer hover:text-white text-yellow-400" onClick={() => handleSort('points')}>
                    PTS <SortIcon field="points" current={sortField} dir={sortDir} />
                  </th>
                  <th className="text-center hidden md:table-cell">Pts/MJ</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((p, i) => {
                  const ppg = p.matches_played > 0 ? (p.points / p.matches_played).toFixed(2) : '—';
                  return (
                    <tr key={p.id}>
                      <td className="text-gray-500 font-medium">{i + 1}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: p.team_color || '#374151' }}>
                            {p.first_name?.[0]}{p.last_name?.[0]}
                          </div>
                          <Link to={`/players/${p.id}`} className="text-white hover:text-blue-400 transition-colors font-medium text-sm">
                            {p.first_name} {p.last_name}
                          </Link>
                        </div>
                      </td>
                      <td><span className="position-badge">{p.position}</span></td>
                      <td>
                        {p.team_name ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.team_color }} />
                            <span className="text-sm text-gray-400">{p.team_name}</span>
                          </div>
                        ) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="text-center text-gray-400">{p.matches_played || 0}</td>
                      <td className="text-center font-semibold text-red-400">{p.goals || 0}</td>
                      <td className="text-center font-semibold text-blue-400">{p.assists || 0}</td>
                      <td className="text-center font-bold text-yellow-400 text-base">{p.points || 0}</td>
                      <td className="text-center text-gray-500 hidden md:table-cell">{ppg}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Teams table */}
      {tab === 'teams' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Équipe</th>
                <th className="text-center">PJ</th>
                <th className="text-center">V</th>
                <th className="text-center">D</th>
                <th className="text-center">BF</th>
                <th className="text-center">BC</th>
                <th className="text-center">DIFF</th>
                <th className="text-center hidden sm:table-cell">Moy BF</th>
                <th className="text-center hidden sm:table-cell">Moy BC</th>
                <th className="text-center hidden md:table-cell">5 derniers</th>
              </tr>
            </thead>
            <tbody>
              {teams.map(t => (
                <tr key={t.team_id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.team_color }} />
                      <Link to={`/teams/${t.team_id}`} className="text-white hover:text-blue-400 font-medium">{t.team_name}</Link>
                    </div>
                  </td>
                  <td className="text-center text-gray-400">{t.gp}</td>
                  <td className="text-center text-emerald-400 font-semibold">{t.w}</td>
                  <td className="text-center text-red-400 font-semibold">{t.l}</td>
                  <td className="text-center text-gray-300">{t.gf}</td>
                  <td className="text-center text-gray-300">{t.ga}</td>
                  <td className="text-center">
                    <span className={t.diff > 0 ? 'text-emerald-400' : t.diff < 0 ? 'text-red-400' : 'text-gray-400'}>
                      {t.diff > 0 ? '+' : ''}{t.diff}
                    </span>
                  </td>
                  <td className="text-center text-gray-400 hidden sm:table-cell">{t.avg_gf}</td>
                  <td className="text-center text-gray-400 hidden sm:table-cell">{t.avg_ga}</td>
                  <td className="hidden md:table-cell">
                    <div className="flex items-center justify-center gap-1">
                      {(t.last5 || []).map((r, j) => (
                        <span key={j} className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${r === 'W' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {r === 'W' ? 'V' : 'D'}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
