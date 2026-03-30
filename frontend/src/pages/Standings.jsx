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
    <div className="space-y-8 max-w-4xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Saison régulière</p>
          <h1 className="text-4xl font-black text-white">Classement</h1>
          <p className="text-gray-500 text-sm mt-2">{standings.length} équipes</p>
        </div>
        <button onClick={load} className="btn-secondary mt-1"><RefreshCw size={14} /> Actualiser</button>
      </div>

      {/* Leader */}
      {top && top.gp > 0 && (
        <div className="flex items-center gap-4 p-5 rounded-2xl border border-gray-800 bg-gray-900">
          <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: top.team_color + '30', border: `2px solid ${top.team_color}` }}>
            <div className="w-full h-full flex items-center justify-center text-xs font-black" style={{ color: top.team_color }}>1</div>
          </div>
          <div className="flex-1">
            <Link to={`/teams/${top.team_id}`} className="font-black text-white text-lg hover:text-gray-300 transition-colors">{top.team_name}</Link>
            <p className="text-sm text-gray-500 mt-0.5">{top.w}V · {top.l}D · Diff {top.diff > 0 ? '+' : ''}{top.diff}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-white">{top.pts}</div>
            <div className="text-xs text-gray-600 uppercase tracking-wide">points</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-600 text-sm">Chargement...</div>
      ) : (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 px-5 text-xs text-gray-600 font-medium w-8">#</th>
                <th className="text-left py-3 text-xs text-gray-600 font-medium">Équipe</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-12">PJ</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-12">V</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-12">D</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-12 hidden sm:table-cell">BP</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-12 hidden sm:table-cell">BC</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-14 hidden md:table-cell">DIFF</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-14 hidden md:table-cell">%V</th>
                <th className="text-center py-3 pr-5 text-xs text-gray-500 font-semibold w-12">PTS</th>
                <th className="text-center py-3 pr-5 text-xs text-gray-600 font-medium hidden lg:table-cell">Séquence</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <>
                  <tr key={s.team_id} className="border-b border-gray-800/40 hover:bg-gray-800/30 transition-colors last:border-0">
                    <td className="py-3.5 px-5 text-gray-600 text-xs">{i + 1}</td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.team_color }} />
                        <Link to={`/teams/${s.team_id}`} className="font-medium text-gray-300 hover:text-white transition-colors">{s.team_name}</Link>
                      </div>
                    </td>
                    <td className="py-3.5 text-center text-gray-600 text-xs">{s.gp}</td>
                    <td className="py-3.5 text-center text-gray-300 font-medium">{s.w}</td>
                    <td className="py-3.5 text-center text-gray-500">{s.l}</td>
                    <td className="py-3.5 text-center text-gray-500 text-xs hidden sm:table-cell">{s.gf}</td>
                    <td className="py-3.5 text-center text-gray-500 text-xs hidden sm:table-cell">{s.ga}</td>
                    <td className="py-3.5 text-center hidden md:table-cell">
                      <span className={s.diff > 0 ? 'text-gray-300' : s.diff < 0 ? 'text-gray-500' : 'text-gray-600'}>
                        {s.diff > 0 ? '+' : ''}{s.diff}
                      </span>
                    </td>
                    <td className="py-3.5 text-center text-gray-600 text-xs hidden md:table-cell">{s.pct}%</td>
                    <td className="py-3.5 pr-5 text-center font-black text-white">{s.pts}</td>
                    <td className="hidden lg:table-cell py-3.5 pr-5">
                      <div className="flex items-center justify-center gap-1">
                        {(s.last5 || []).map((r, j) => (
                          <span key={j} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${r === 'W' ? 'bg-gray-700 text-gray-300' : 'bg-gray-800 text-gray-600'}`}>
                            {r === 'W' ? 'V' : 'D'}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                  {i === PLAYOFF_CUTOFF - 1 && standings.length > PLAYOFF_CUTOFF && (
                    <tr key="cutoff">
                      <td colSpan={11}>
                        <div className="flex items-center gap-3 px-5 py-2">
                          <div className="flex-1 h-px bg-gray-800" />
                          <span className="text-xs text-gray-600 whitespace-nowrap">séries éliminatoires · top {PLAYOFF_CUTOFF}</span>
                          <div className="flex-1 h-px bg-gray-800" />
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
      <div className="flex flex-wrap gap-4 text-xs text-gray-600">
        <span>PJ = Parties jouées</span>
        <span>V = Victoires</span>
        <span>D = Défaites</span>
        <span>BP = Buts pour</span>
        <span>BC = Buts contre</span>
        <span>DIFF = Différentiel</span>
        <span>%V = % victoires</span>
        <span className="text-gray-400 font-medium">PTS = Points</span>
      </div>
    </div>
  );
}
