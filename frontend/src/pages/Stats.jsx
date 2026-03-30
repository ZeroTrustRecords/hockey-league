import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { Target, TrendingUp, Award, Download } from 'lucide-react';

const positionLabel = { C: 'Centre', LW: 'Ailier G', RW: 'Ailier D', D: 'Défenseur', G: 'Gardien' };

function SortIcon({ field, current, dir }) {
  if (current !== field) return <span className="opacity-30">↕</span>;
  return dir === 'asc' ? <span>↑</span> : <span>↓</span>;
}

function MiniBar({ value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-1 bg-gray-700 rounded-full overflow-hidden mt-0.5">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
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

  const maxGoals = Math.max(...filteredPlayers.map(p => p.goals || 0), 1);
  const maxAssists = Math.max(...filteredPlayers.map(p => p.assists || 0), 1);
  const maxPoints = Math.max(...filteredPlayers.map(p => p.points || 0), 1);

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
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden border border-gray-700/50"
        style={{ background: 'linear-gradient(135deg, #2d1a1a 0%, #111827 50%, #1a2030 100%)' }}>
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 12px, white 12px, white 13px)' }} />
        <div className="relative p-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">📊 Statistiques</div>
            <h1 className="text-3xl font-black text-white">Leaders & Stats</h1>
            <p className="text-gray-400 text-sm mt-1">Saison régulière en cours</p>
          </div>
          {tab === 'players' && (
            <button onClick={exportCSV} className="btn-secondary"><Download size={15} /> Exporter CSV</button>
          )}
        </div>
      </div>

      {/* Leaders */}
      {leaders && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { key: 'goals',   icon: Target,    label: 'Meilleurs buteurs', color: '#ef4444', bg: 'from-red-900/30 to-gray-900',    border: 'border-red-500/20',    statKey: 'goals',   unit: 'B' },
            { key: 'assists', icon: TrendingUp, label: 'Meilleurs passeurs', color: '#3b82f6', bg: 'from-blue-900/30 to-gray-900',  border: 'border-blue-500/20',   statKey: 'assists', unit: 'A' },
            { key: 'points',  icon: Award,      label: 'Leaders en points', color: '#eab308', bg: 'from-yellow-900/30 to-gray-900', border: 'border-yellow-500/20', statKey: 'points',  unit: 'pts' },
          ].map(cat => {
            const list = leaders[cat.key] || [];
            const catMax = list[0]?.[cat.statKey] || 1;
            return (
              <div key={cat.key} className={`card bg-gradient-to-br ${cat.bg} border ${cat.border}`}>
                <h3 className="section-title mb-3 flex items-center gap-2 font-bold" style={{ color: cat.color }}>
                  <cat.icon size={16} />{cat.label}
                </h3>
                <div className="space-y-2">
                  {list.map((p, i) => (
                    <div key={p.id} className={`rounded-lg p-2 ${i === 0 ? 'bg-white/5 border border-white/10' : ''}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black w-4 text-center" style={{ color: i === 0 ? cat.color : '#6b7280' }}>{i + 1}</span>
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.team_color }} />
                        <Link to={`/players/${p.id}`} className="flex-1 min-w-0 text-sm text-white hover:text-blue-400 truncate font-medium">
                          {p.first_name} {p.last_name}
                        </Link>
                        <span className="font-black text-sm" style={{ color: cat.color }}>{p[cat.statKey]} {cat.unit}</span>
                      </div>
                      <div className="ml-6 mt-1">
                        <MiniBar value={p[cat.statKey]} max={catMax} color={cat.color} />
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
      <div className="flex gap-2 border-b border-gray-800 pb-0">
        <button onClick={() => setTab('players')} className={tab === 'players' ? 'tab-active' : 'tab-inactive'}>Joueurs</button>
        <button onClick={() => setTab('teams')} className={tab === 'teams' ? 'tab-active' : 'tab-inactive'}>Équipes</button>
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
                  <th className="text-center cursor-pointer hover:text-white" onClick={() => handleSort('matches_played')}>MJ <SortIcon field="matches_played" current={sortField} dir={sortDir} /></th>
                  <th className="text-center cursor-pointer hover:text-white" onClick={() => handleSort('goals')}>B <SortIcon field="goals" current={sortField} dir={sortDir} /></th>
                  <th className="text-center cursor-pointer hover:text-white" onClick={() => handleSort('assists')}>A <SortIcon field="assists" current={sortField} dir={sortDir} /></th>
                  <th className="text-center cursor-pointer hover:text-white text-yellow-400" onClick={() => handleSort('points')}>PTS <SortIcon field="points" current={sortField} dir={sortDir} /></th>
                  <th className="text-center hidden md:table-cell">Pts/MJ</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((p, i) => {
                  const ppg = p.matches_played > 0 ? (p.points / p.matches_played).toFixed(2) : '—';
                  return (
                    <tr key={p.id} style={{ borderLeft: `3px solid ${p.team_color || '#374151'}` }}>
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
                      <td className="text-center">
                        <div className="font-semibold text-red-400">{p.goals || 0}</div>
                        <MiniBar value={p.goals || 0} max={maxGoals} color="#ef4444" />
                      </td>
                      <td className="text-center">
                        <div className="font-semibold text-blue-400">{p.assists || 0}</div>
                        <MiniBar value={p.assists || 0} max={maxAssists} color="#3b82f6" />
                      </td>
                      <td className="text-center">
                        <div className="font-black text-yellow-400 text-base">{p.points || 0}</div>
                        <MiniBar value={p.points || 0} max={maxPoints} color="#eab308" />
                      </td>
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
                <tr key={t.team_id} style={{ borderLeft: `4px solid ${t.team_color}` }}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.team_color }} />
                      <Link to={`/teams/${t.team_id}`} className="text-white hover:text-blue-400 font-semibold">{t.team_name}</Link>
                    </div>
                  </td>
                  <td className="text-center text-gray-400">{t.gp}</td>
                  <td className="text-center text-emerald-400 font-bold">{t.w}</td>
                  <td className="text-center text-red-400 font-bold">{t.l}</td>
                  <td className="text-center text-gray-300">{t.gf}</td>
                  <td className="text-center text-gray-300">{t.ga}</td>
                  <td className="text-center">
                    <span className={t.diff > 0 ? 'text-emerald-400 font-semibold' : t.diff < 0 ? 'text-red-400 font-semibold' : 'text-gray-400'}>
                      {t.diff > 0 ? '+' : ''}{t.diff}
                    </span>
                  </td>
                  <td className="text-center text-gray-400 hidden sm:table-cell">{t.avg_gf}</td>
                  <td className="text-center text-gray-400 hidden sm:table-cell">{t.avg_ga}</td>
                  <td className="hidden md:table-cell">
                    <div className="flex items-center justify-center gap-1">
                      {(t.last5 || []).map((r, j) => (
                        <span key={j} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${r === 'W' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
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
