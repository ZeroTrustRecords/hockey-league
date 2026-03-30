import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { Trophy, RefreshCw } from 'lucide-react';

export default function Standings() {
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/standings').then(r => setStandings(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const top = standings[0];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Classement</h1>
          <p className="text-sm text-gray-400">Saison 2024-2025</p>
        </div>
        <button onClick={load} className="btn-secondary"><RefreshCw size={15} /> Actualiser</button>
      </div>

      {/* Leader banner */}
      {top && top.gp > 0 && (
        <div className="card border-yellow-500/20 bg-gradient-to-r from-yellow-600/10 to-transparent">
          <div className="flex items-center gap-4">
            <div className="text-3xl">🏆</div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: top.team_color }} />
              <div>
                <Link to={`/teams/${top.team_id}`} className="text-xl font-bold text-white hover:text-yellow-400 transition-colors">{top.team_name}</Link>
                <p className="text-sm text-gray-400">Leader — {top.pts} pts • {top.w}V {top.l}D • Diff: {top.diff > 0 ? '+' : ''}{top.diff}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500 animate-pulse">Chargement...</div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th className="w-8">#</th>
                <th>Équipe</th>
                <th className="text-center">PJ</th>
                <th className="text-center">V</th>
                <th className="text-center">D</th>
                <th className="text-center hidden sm:table-cell">BF</th>
                <th className="text-center hidden sm:table-cell">BC</th>
                <th className="text-center hidden md:table-cell">DIFF</th>
                <th className="text-center hidden md:table-cell">%V</th>
                <th className="text-center text-yellow-400">PTS</th>
                <th className="text-center hidden lg:table-cell">Séquence</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.team_id} className={i === 0 && s.gp > 0 ? 'bg-yellow-500/5' : ''}>
                  <td>
                    <div className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                      style={i === 0 && s.gp > 0 ? { backgroundColor: '#EAB308', color: '#000' } : { color: '#6b7280' }}>
                      {i + 1}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.team_color }} />
                      <Link to={`/teams/${s.team_id}`} className="font-medium text-white hover:text-blue-400 transition-colors">{s.team_name}</Link>
                    </div>
                  </td>
                  <td className="text-center text-gray-400">{s.gp}</td>
                  <td className="text-center font-semibold text-emerald-400">{s.w}</td>
                  <td className="text-center font-semibold text-red-400">{s.l}</td>
                  <td className="text-center text-gray-300 hidden sm:table-cell">{s.gf}</td>
                  <td className="text-center text-gray-300 hidden sm:table-cell">{s.ga}</td>
                  <td className="text-center hidden md:table-cell">
                    <span className={s.diff > 0 ? 'text-emerald-400' : s.diff < 0 ? 'text-red-400' : 'text-gray-400'}>
                      {s.diff > 0 ? '+' : ''}{s.diff}
                    </span>
                  </td>
                  <td className="text-center text-gray-400 hidden md:table-cell">{s.pct}%</td>
                  <td className="text-center">
                    <span className="font-bold text-yellow-400 text-base">{s.pts}</span>
                  </td>
                  <td className="hidden lg:table-cell">
                    <div className="flex items-center justify-center gap-1">
                      {(s.last5 || []).map((r, j) => (
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

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <span>PJ = Parties jouées</span>
        <span>V = Victoires</span>
        <span>D = Défaites</span>
        <span>BF = Buts pour</span>
        <span>BC = Buts contre</span>
        <span>DIFF = Différentiel</span>
        <span>%V = % victoires</span>
        <span className="text-yellow-400 font-semibold">PTS = Points</span>
      </div>
    </div>
  );
}
