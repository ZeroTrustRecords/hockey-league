import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { Target, TrendingUp, Award, Download } from 'lucide-react';

const positionLabel = { C: 'Centre', LW: 'Ailier G', RW: 'Ailier D', D: 'Défenseur', G: 'Gardien' };

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
  const [statType, setStatType] = useState(null); // null = not yet determined
  const [activeSeason, setActiveSeason] = useState(null);

  // On mount: load season to determine default stat type
  useEffect(() => {
    api.get('/seasons/active').then(r => {
      const s = r.data;
      setActiveSeason(s);
      // Auto-select playoffs stats if season is in playoffs phase
      setStatType(s?.status === 'playoffs' ? 'playoffs' : 'regular');
    }).catch(() => setStatType('regular'));
  }, []);

  useEffect(() => {
    if (statType === null) return; // wait for season detection
    setLoading(true);
    const params = { limit: 100, type: statType };
    if (activeSeason?.id) params.season_id = activeSeason.id;
    Promise.all([
      api.get('/stats/players', { params }),
      api.get('/stats/teams'),
      api.get('/stats/leaders'),
      api.get('/teams'),
    ]).then(([pr, tr, lr, at]) => {
      setPlayers(pr.data);
      setTeams(tr.data);
      setLeaders(lr.data);
      setAllTeams(at.data);
    }).finally(() => setLoading(false));
  }, [statType, activeSeason]);

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

  const maxGoals   = Math.max(...filteredPlayers.map(p => p.goals   || 0), 1);
  const maxAssists = Math.max(...filteredPlayers.map(p => p.assists || 0), 1);
  const maxPoints  = Math.max(...filteredPlayers.map(p => p.points  || 0), 1);

  const exportCSV = () => {
    const headers = 'Joueur,Équipe,Position,Matchs,Buts,Passes,Points\n';
    const rows = filteredPlayers.map(p =>
      `"${p.first_name} ${p.last_name}","${p.team_name || ''}","${p.position}",${p.matches_played},${p.goals},${p.assists},${p.points}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'stats_joueurs.csv'; a.click();
  };

  if (loading) return <div className="text-center py-12 text-gray-600 text-sm">Chargement...</div>;

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-4xl font-black text-white">Statistiques</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type selector */}
          <div className="flex rounded-lg overflow-hidden border border-gray-700 text-sm">
            {[
              { key: 'regular',  label: 'Saison régulière' },
              { key: 'playoffs', label: '🏆 Éliminatoires' },
              { key: 'all',      label: 'Tout' },
            ].map(opt => (
              <button key={opt.key} onClick={() => setStatType(opt.key)}
                className={`px-3 py-1.5 font-medium transition-colors ${statType === opt.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                {opt.label}
              </button>
            ))}
          </div>
          {tab === 'players' && (
            <button onClick={exportCSV} className="btn-secondary"><Download size={14} /> Exporter</button>
          )}
        </div>
      </div>

      {/* Leaders */}
      {leaders && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { key: 'goals',   icon: Target,    label: 'Buteurs',  statKey: 'goals',   unit: 'B' },
            { key: 'assists', icon: TrendingUp, label: 'Passeurs', statKey: 'assists', unit: 'A' },
            { key: 'points',  icon: Award,      label: 'Points',   statKey: 'points',  unit: 'pts' },
          ].map(cat => {
            const list = leaders[cat.key] || [];
            const catMax = list[0]?.[cat.statKey] || 1;
            return (
              <div key={cat.key} className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
                <div className="flex items-center gap-2 mb-4">
                  <cat.icon size={14} className="text-gray-500" />
                  <span className="text-xs text-gray-500 uppercase tracking-widest font-medium">{cat.label}</span>
                </div>
                <div className="space-y-3">
                  {list.map((p, i) => (
                    <div key={p.id}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-700 w-3">{i + 1}</span>
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.team_color }} />
                        <Link to={`/players/${p.id}`} className={`flex-1 min-w-0 text-sm truncate transition-colors hover:text-white ${i === 0 ? 'text-white font-semibold' : 'text-gray-400'}`}>
                          {p.first_name} {p.last_name}
                        </Link>
                        <span className={`font-black text-sm ${i === 0 ? 'text-white' : 'text-gray-500'}`}>{p[cat.statKey]}</span>
                      </div>
                      <div className="ml-5 h-0.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-500 rounded-full" style={{ width: `${(p[cat.statKey] / catMax) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800 w-fit">
        <button onClick={() => setTab('players')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'players' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          Joueurs
        </button>
        <button onClick={() => setTab('teams')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'teams' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          Équipes
        </button>
      </div>

      {/* Players */}
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
            <span className="text-xs text-gray-600 self-center">{filteredPlayers.length} joueur{filteredPlayers.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-5 text-xs text-gray-600 font-medium w-8">#</th>
                  <th className="text-left py-3 text-xs text-gray-600 font-medium">Joueur</th>
                  <th className="text-left py-3 text-xs text-gray-600 font-medium">Pos</th>
                  <th className="text-left py-3 text-xs text-gray-600 font-medium hidden sm:table-cell">Équipe</th>
                  <th className="text-center py-3 text-xs text-gray-600 font-medium w-12 cursor-pointer hover:text-gray-400" onClick={() => handleSort('matches_played')}>MJ <SortIcon field="matches_played" current={sortField} dir={sortDir} /></th>
                  <th className="text-center py-3 text-xs text-gray-600 font-medium w-14 cursor-pointer hover:text-gray-400" onClick={() => handleSort('goals')}>B <SortIcon field="goals" current={sortField} dir={sortDir} /></th>
                  <th className="text-center py-3 text-xs text-gray-600 font-medium w-14 cursor-pointer hover:text-gray-400" onClick={() => handleSort('assists')}>A <SortIcon field="assists" current={sortField} dir={sortDir} /></th>
                  <th className="text-center py-3 pr-5 text-xs text-gray-500 font-semibold w-14 cursor-pointer hover:text-gray-400" onClick={() => handleSort('points')}>PTS <SortIcon field="points" current={sortField} dir={sortDir} /></th>
                  <th className="text-center py-3 pr-5 text-xs text-gray-600 font-medium hidden md:table-cell">Pts/MJ</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((p, i) => {
                  const ppg = p.matches_played > 0 ? (p.points / p.matches_played).toFixed(2) : '—';
                  return (
                    <tr key={p.id} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors last:border-0">
                      <td className="py-3.5 px-5 text-gray-600 text-xs">{i + 1}</td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: p.team_color ? p.team_color + '40' : '#374151', border: `1px solid ${p.team_color || '#374151'}` }}>
                            <span style={{ color: p.team_color || '#9ca3af' }}>{p.first_name?.[0]}{p.last_name?.[0]}</span>
                          </div>
                          <Link to={`/players/${p.id}`} className="text-gray-300 hover:text-white transition-colors font-medium">
                            {p.first_name} {p.last_name}
                          </Link>
                        </div>
                      </td>
                      <td className="py-3.5"><span className="position-badge">{p.position}</span></td>
                      <td className="py-3.5 hidden sm:table-cell">
                        {p.team_name
                          ? <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.team_color }} />
                              <span className="text-xs text-gray-500">{p.team_name}</span>
                            </div>
                          : <span className="text-gray-700">—</span>}
                      </td>
                      <td className="py-3.5 text-center text-gray-600 text-xs">{p.matches_played || 0}</td>
                      <td className="py-3.5 text-center">
                        <div className="text-gray-300 font-medium">{p.goals || 0}</div>
                        <Bar value={p.goals || 0} max={maxGoals} />
                      </td>
                      <td className="py-3.5 text-center">
                        <div className="text-gray-300 font-medium">{p.assists || 0}</div>
                        <Bar value={p.assists || 0} max={maxAssists} />
                      </td>
                      <td className="py-3.5 pr-5 text-center">
                        <div className="font-black text-white">{p.points || 0}</div>
                        <Bar value={p.points || 0} max={maxPoints} />
                      </td>
                      <td className="py-3.5 pr-5 text-center text-gray-600 text-xs hidden md:table-cell">{ppg}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Teams */}
      {tab === 'teams' && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 px-5 text-xs text-gray-600 font-medium">Équipe</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-12">PJ</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-12">V</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-12">D</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-12">BP</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-12">BC</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-14">DIFF</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-16 hidden sm:table-cell">Moy BP</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-16 hidden sm:table-cell">Moy BC</th>
                <th className="text-center py-3 pr-5 text-xs text-gray-600 font-medium hidden md:table-cell">5 derniers</th>
              </tr>
            </thead>
            <tbody>
              {teams.map(t => (
                <tr key={t.team_id} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors last:border-0">
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.team_color }} />
                      <Link to={`/teams/${t.team_id}`} className="text-gray-300 hover:text-white font-medium">{t.team_name}</Link>
                    </div>
                  </td>
                  <td className="py-3.5 text-center text-gray-600 text-xs">{t.gp}</td>
                  <td className="py-3.5 text-center text-gray-300 font-medium">{t.w}</td>
                  <td className="py-3.5 text-center text-gray-500">{t.l}</td>
                  <td className="py-3.5 text-center text-gray-500 text-xs">{t.gf}</td>
                  <td className="py-3.5 text-center text-gray-500 text-xs">{t.ga}</td>
                  <td className="py-3.5 text-center text-xs">
                    <span className={t.diff > 0 ? 'text-gray-300' : t.diff < 0 ? 'text-gray-600' : 'text-gray-600'}>
                      {t.diff > 0 ? '+' : ''}{t.diff}
                    </span>
                  </td>
                  <td className="py-3.5 text-center text-gray-600 text-xs hidden sm:table-cell">{t.avg_gf}</td>
                  <td className="py-3.5 text-center text-gray-600 text-xs hidden sm:table-cell">{t.avg_ga}</td>
                  <td className="hidden md:table-cell py-3.5 pr-5">
                    <div className="flex items-center justify-center gap-1">
                      {(t.last5 || []).map((r, j) => (
                        <span key={j} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${r === 'W' ? 'bg-gray-700 text-gray-300' : 'bg-gray-800 text-gray-600'}`}>
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
