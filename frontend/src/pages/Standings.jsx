import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Shield, Trophy, TrendingUp } from 'lucide-react';
import api from '../api/client';

function SummaryCard({ label, value, helper }) {
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-gray-600 mb-2">{label}</div>
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{helper}</div>
    </div>
  );
}

export default function Standings() {
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/standings').then((response) => setStandings(response.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const top = standings[0];
  const totalGames = useMemo(() => standings.reduce((sum, team) => sum + (team.gp || 0), 0) / 2, [standings]);
  const bestAttack = useMemo(() => standings.reduce((best, team) => (!best || team.gf > best.gf ? team : best), null), [standings]);
  const bestDefense = useMemo(() => standings.reduce((best, team) => (!best || team.ga < best.ga ? team : best), null), [standings]);

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Lecture de la saison</p>
          <h1 className="text-3xl sm:text-5xl font-black text-white">Classement</h1>
          <p className="text-gray-400 text-sm sm:text-base mt-2 max-w-2xl">
            Le portrait complet de la course au sommet, avec l’ordre actuel, la forme récente et les écarts.
          </p>
        </div>
        <button onClick={load} className="btn-secondary mt-1">
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr_1fr_1fr] gap-4">
        <div className="rounded-3xl border border-gray-800 bg-gradient-to-br from-gray-900 via-gray-900 to-yellow-950/30 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-yellow-400" />
            <span className="text-xs uppercase tracking-[0.2em] text-yellow-300/80 font-semibold">Équipe en tête</span>
          </div>

          {top ? (
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                style={{ backgroundColor: `${top.team_color}22`, border: `2px solid ${top.team_color}`, color: top.team_color }}
              >
                1
              </div>
              <div className="flex-1 min-w-0">
                <Link to={`/teams/${top.team_id}`} className="text-2xl sm:text-3xl font-black text-white hover:text-gray-300 transition-colors">
                  {top.team_name}
                </Link>
                <p className="text-sm text-gray-400 mt-2">
                  {top.w} V · {top.l} D · Diff {top.diff > 0 ? '+' : ''}{top.diff}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {top.gf} buts pour · {top.ga} buts contre · {top.pct}% d’efficacité
                </p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-black text-white">{top.pts}</div>
                <div className="text-xs text-gray-600 uppercase tracking-wide">PTS</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Le classement apparaîtra ici dès que des matchs seront validés.</p>
          )}
        </div>

        <SummaryCard label="Équipes" value={standings.length} helper="Clubs actuellement classés" />
        <SummaryCard label="Matchs" value={totalGames || 0} helper="Rencontres validées au total" />
        <SummaryCard
          label="Tendance"
          value={bestAttack ? bestAttack.team_name : '-'}
          helper={bestAttack ? `Meilleure attaque · ${bestAttack.gf} buts` : 'À venir'}
        />
      </div>

      {(bestAttack || bestDefense) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bestAttack && (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={15} className="text-emerald-400" />
                <span className="text-sm font-semibold text-white">Meilleure attaque</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: bestAttack.team_color }} />
                <Link to={`/teams/${bestAttack.team_id}`} className="font-semibold text-white hover:text-gray-300">
                  {bestAttack.team_name}
                </Link>
              </div>
              <p className="text-xs text-gray-500 mt-1">{bestAttack.gf} buts marqués jusqu’ici</p>
            </div>
          )}

          {bestDefense && (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield size={15} className="text-blue-400" />
                <span className="text-sm font-semibold text-white">Meilleure défense</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: bestDefense.team_color }} />
                <Link to={`/teams/${bestDefense.team_id}`} className="font-semibold text-white hover:text-gray-300">
                  {bestDefense.team_name}
                </Link>
              </div>
              <p className="text-xs text-gray-500 mt-1">{bestDefense.ga} buts accordés jusqu’ici</p>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-600 text-sm">Chargement...</div>
      ) : (
        <div className="bg-gray-900 rounded-3xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-lg font-bold text-white">Tableau complet</h2>
            <p className="text-sm text-gray-500 mt-1">Toutes les équipes, leur rythme et leur forme récente.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-5 text-xs text-gray-600 font-medium w-8">#</th>
                  <th className="text-left py-3 text-xs text-gray-600 font-medium">Équipe</th>
                  <th className="text-center py-3 text-xs text-gray-600 font-medium w-12">PJ</th>
                  <th className="text-center py-3 text-xs text-gray-600 font-medium w-12">V</th>
                  <th className="text-center py-3 text-xs text-gray-600 font-medium w-12">D</th>
                  <th className="text-center py-3 text-xs text-gray-600 font-medium w-12">BP</th>
                  <th className="text-center py-3 text-xs text-gray-600 font-medium w-12">BC</th>
                  <th className="text-center py-3 text-xs text-gray-600 font-medium w-14">Diff</th>
                  <th className="text-center py-3 text-xs text-gray-600 font-medium w-14">%V</th>
                  <th className="text-center py-3 pr-5 text-xs text-gray-500 font-semibold w-12">PTS</th>
                  <th className="text-center py-3 pr-5 text-xs text-gray-600 font-medium">Forme récente</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((standing, index) => (
                  <tr key={standing.team_id} className="border-b border-gray-800/40 hover:bg-gray-800/30 transition-colors last:border-0">
                    <td className="py-3.5 px-5 text-gray-600 text-xs">{index + 1}</td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: standing.team_color }} />
                        <Link to={`/teams/${standing.team_id}`} className="font-medium text-gray-300 hover:text-white transition-colors">
                          {standing.team_name}
                        </Link>
                      </div>
                    </td>
                    <td className="py-3.5 text-center text-gray-600 text-xs">{standing.gp}</td>
                    <td className="py-3.5 text-center text-gray-300 font-medium">{standing.w}</td>
                    <td className="py-3.5 text-center text-gray-500">{standing.l}</td>
                    <td className="py-3.5 text-center text-gray-500 text-xs">{standing.gf}</td>
                    <td className="py-3.5 text-center text-gray-500 text-xs">{standing.ga}</td>
                    <td className="py-3.5 text-center">
                      <span className={standing.diff > 0 ? 'text-gray-300' : standing.diff < 0 ? 'text-gray-500' : 'text-gray-600'}>
                        {standing.diff > 0 ? '+' : ''}{standing.diff}
                      </span>
                    </td>
                    <td className="py-3.5 text-center text-gray-600 text-xs">{standing.pct}%</td>
                    <td className="py-3.5 pr-5 text-center font-black text-white">{standing.pts}</td>
                    <td className="py-3.5 pr-5">
                      <div className="flex items-center justify-center gap-1">
                        {(standing.last5 || []).map((result, i) => (
                          <span
                            key={i}
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${result === 'W' ? 'bg-gray-700 text-gray-300' : 'bg-gray-800 text-gray-600'}`}
                          >
                            {result === 'W' ? 'V' : 'D'}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}

                {standings.length === 0 && (
                  <tr>
                    <td colSpan="11" className="py-10 text-center text-sm text-gray-600">
                      Aucun classement à afficher pour le moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-gray-600">
        <span>PJ = parties jouées</span>
        <span>V = victoires</span>
        <span>D = défaites</span>
        <span>BP = buts pour</span>
        <span>BC = buts contre</span>
        <span>Diff = différentiel</span>
        <span>%V = pourcentage de victoires</span>
        <span className="text-gray-400 font-medium">PTS = total de points</span>
      </div>
    </div>
  );
}
