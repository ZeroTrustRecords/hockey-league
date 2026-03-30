import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { RefreshCw } from 'lucide-react';

const PLAYOFF_CUTOFF = 4;

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
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden border border-gray-700/50"
        style={{ background: 'linear-gradient(135deg, #1a2e1a 0%, #111827 50%, #1a1a2e 100%)' }}>
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 12px, white 12px, white 13px)' }} />
        <div className="relative p-6 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-yellow-400 uppercase tracking-widest mb-1">🏆 Classement</div>
            <h1 className="text-3xl font-black text-white">Saison en cours</h1>
            <p className="text-gray-400 text-sm mt-1">{standings.length} équipes · Saison régulière</p>
          </div>
          <button onClick={load} className="btn-secondary"><RefreshCw size={15} /> Actualiser</button>
        </div>
      </div>

      {/* Leader banner */}
      {top && top.gp > 0 && (
        <div className="rounded-xl border border-yellow-500/20 overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${top.team_color}25 0%, #111827 60%)` }}>
          <div className="flex items-center gap-4 p-4">
            <div className="text-3xl">🥇</div>
            <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: top.team_color }} />
            <div className="flex-1">
              <Link to={`/teams/${top.team_id}`} className="text-xl font-black text-white hover:text-yellow-400 transition-colors">{top.team_name}</Link>
              <p className="text-sm text-gray-400 mt-0.5">
                <span className="text-yellow-400 font-bold">{top.pts} pts</span>
                {' · '}{top.w}V {top.l}D
                {' · '}Diff: <span className={top.diff >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>{top.diff > 0 ? '+' : ''}{top.diff}</span>
              </p>
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-3xl font-black text-yellow-400">{top.pts}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">points</div>
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
                <>
                  <tr key={s.team_id}
                    className={`border-t border-gray-800/50 hover:bg-gray-800/30 transition-colors ${i === 0 && s.gp > 0 ? 'bg-yellow-500/5' : ''}`}
                    style={{ borderLeft: `4px solid ${s.team_color}` }}>
                    <td className="pl-2">
                      {i === 0 && s.gp > 0
                        ? <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black" style={{ background: '#EAB308', color: '#000' }}>1</div>
                        : <div className="flex items-center justify-center w-6 h-6 text-xs font-bold text-gray-500">{i + 1}</div>}
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.team_color }} />
                        <Link to={`/teams/${s.team_id}`} className="font-semibold text-white hover:text-blue-400 transition-colors">{s.team_name}</Link>
                      </div>
                    </td>
                    <td className="text-center text-gray-400">{s.gp}</td>
                    <td className="text-center font-bold text-emerald-400">{s.w}</td>
                    <td className="text-center font-bold text-red-400">{s.l}</td>
                    <td className="text-center text-gray-300 hidden sm:table-cell">{s.gf}</td>
                    <td className="text-center text-gray-300 hidden sm:table-cell">{s.ga}</td>
                    <td className="text-center hidden md:table-cell">
                      <span className={s.diff > 0 ? 'text-emerald-400 font-semibold' : s.diff < 0 ? 'text-red-400 font-semibold' : 'text-gray-400'}>
                        {s.diff > 0 ? '+' : ''}{s.diff}
                      </span>
                    </td>
                    <td className="text-center text-gray-400 hidden md:table-cell">{s.pct}%</td>
                    <td className="text-center">
                      <span className="font-black text-yellow-400 text-base">{s.pts}</span>
                    </td>
                    <td className="hidden lg:table-cell">
                      <div className="flex items-center justify-center gap-1">
                        {(s.last5 || []).map((r, j) => (
                          <span key={j} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${r === 'W' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                            {r === 'W' ? 'V' : 'D'}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                  {i === PLAYOFF_CUTOFF - 1 && standings.length > PLAYOFF_CUTOFF && (
                    <tr key="cutoff-line">
                      <td colSpan={11} className="p-0">
                        <div className="flex items-center gap-2 px-3 py-1">
                          <div className="flex-1 h-px bg-blue-500/40" />
                          <span className="text-xs text-blue-400/80 font-semibold uppercase tracking-wide whitespace-nowrap">Séries éliminatoires — top {PLAYOFF_CUTOFF}</span>
                          <div className="flex-1 h-px bg-blue-500/40" />
                        </div>
                      </td>
                    </tr>
                  )}
                </>
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
