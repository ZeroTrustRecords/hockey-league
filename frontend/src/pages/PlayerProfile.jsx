import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, Award, Hash, Mail, Phone, Target, TrendingUp } from 'lucide-react';
import api from '../api/client';

const positionLabel = {
  C: 'Centre',
  LW: 'Ailier G',
  RW: 'Ailier D',
  D: 'Défenseur',
  G: 'Gardien',
};

export default function PlayerProfile() {
  const { id } = useParams();
  const [player, setPlayer] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    Promise.allSettled([
      api.get(`/players/${id}`),
      api.get(`/players/${id}/history`),
    ]).then(([playerResult, historyResult]) => {
      if (!mounted) return;

      if (playerResult.status === 'fulfilled') setPlayer(playerResult.value.data);
      else setPlayer(null);

      if (historyResult.status === 'fulfilled') setHistory(historyResult.value.data);
      else setHistory([]);
    }).finally(() => {
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [id]);

  const stats = player?.stats || {};
  const recentGoals = player?.recentGoals || [];
  const points = (stats.goals || 0) + (stats.assists || 0);
  const pointsPerGame = stats.matches_played > 0 ? (points / stats.matches_played).toFixed(2) : '0.00';

  const careerTotals = useMemo(() => {
    const goals = history.reduce((sum, row) => sum + row.goals, 0);
    const assists = history.reduce((sum, row) => sum + row.assists, 0);
    return { goals, assists, points: goals + assists };
  }, [history]);

  if (loading) return <div className="text-center py-12 text-gray-500 animate-pulse">Chargement...</div>;
  if (!player) return <div className="text-center py-12 text-gray-500">Joueur introuvable</div>;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Link to="/players" className="btn-ghost p-2"><ArrowLeft size={18} /></Link>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Fiche joueur</p>
          <h1 className="text-3xl sm:text-5xl font-black text-white">Profil du joueur</h1>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center text-3xl font-bold text-white flex-shrink-0"
              style={{ backgroundColor: player.team_color || '#374151' }}
            >
              {player.first_name[0]}{player.last_name[0]}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl sm:text-4xl font-black text-white">{player.first_name} {player.last_name}</h2>
                {player.nickname && <span className="text-gray-400 italic">"{player.nickname}"</span>}
                <span className={player.status === 'active' ? 'status-active' : 'status-inactive'}>
                  {player.status === 'active' ? 'Actif' : 'Inactif'}
                </span>
              </div>

              <div className="flex items-center gap-4 mt-3 flex-wrap text-sm text-gray-400">
                {player.number && <span className="flex items-center gap-1"><Hash size={14} /> {player.number}</span>}
                <span className="position-badge">{positionLabel[player.position] || player.position}</span>
                {player.team_name && (
                  <Link to={`/teams/${player.team_id}`} className="flex items-center gap-1.5 hover:text-blue-400 transition-colors">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: player.team_color }} />
                    {player.team_name}
                  </Link>
                )}
                {player.age && <span>{player.age} ans</span>}
              </div>

              <div className="flex items-center gap-4 mt-3 flex-wrap text-sm">
                {player.email && (
                  <a href={`mailto:${player.email}`} className="flex items-center gap-1 text-gray-500 hover:text-blue-400 transition-colors">
                    <Mail size={13} /> {player.email}
                  </a>
                )}
                {player.phone && <span className="flex items-center gap-1 text-gray-500"><Phone size={13} /> {player.phone}</span>}
              </div>
            </div>

            <div className="bg-gray-800/70 rounded-2xl px-5 py-4 min-w-[180px]">
              <div className="text-xs uppercase tracking-[0.2em] text-gray-600 mb-1">Carrière</div>
              <div className="text-lg font-black text-white">{careerTotals.points} points</div>
              <div className="text-xs text-gray-500 mt-1">{careerTotals.goals} buts · {careerTotals.assists} passes</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { icon: Target, label: 'Buts', value: stats.goals || 0, color: 'text-red-400' },
          { icon: TrendingUp, label: 'Passes', value: stats.assists || 0, color: 'text-blue-400' },
          { icon: Award, label: 'Points', value: points, color: 'text-yellow-400' },
          { icon: Hash, label: 'Matchs', value: stats.matches_played || 0, color: 'text-gray-300' },
          { icon: TrendingUp, label: 'Pts/match', value: pointsPerGame, color: 'text-emerald-400' },
        ].map((item) => (
          <div key={item.label} className="card text-center p-4">
            <div className={`text-3xl font-bold ${item.color}`}>{item.value}</div>
            <div className="text-xs text-gray-500 mt-1">{item.label}</div>
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h3 className="section-title">Historique par saison</h3>
              <p className="text-sm text-gray-500 mt-1">La saison la plus récente est toujours affichée en premier.</p>
            </div>
            {history.length > 1 && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span className="text-red-400 font-bold">{careerTotals.goals}B</span>
                <span className="text-blue-400 font-bold">{careerTotals.assists}P</span>
                <span className="text-yellow-400 font-bold">{careerTotals.points}PTS</span>
              </div>
            )}
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Saison</th>
                  <th>Équipe</th>
                  <th className="hidden sm:table-cell text-center">PJ</th>
                  <th className="text-center">B</th>
                  <th className="text-center">P</th>
                  <th className="text-center font-bold text-yellow-400">PTS</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row, index) => (
                  <tr key={`${row.season_name}-${row.team_name}-${index}`}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">{row.season_name}</span>
                        {row.is_playoff === 1 ? (
                          <span className="text-xs px-1.5 py-0.5 rounded font-bold bg-yellow-500/15 text-yellow-400">Éliminatoires</span>
                        ) : (
                          <span className="text-xs px-1.5 py-0.5 rounded font-bold bg-blue-500/15 text-blue-400">Régulière</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: row.team_color }} />
                        <span className="text-gray-300 text-sm">{row.team_name}</span>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell text-center text-gray-400">{row.matches_played}</td>
                    <td className="text-center text-red-400 font-semibold">{row.goals}</td>
                    <td className="text-center text-blue-400 font-semibold">{row.assists}</td>
                    <td className="text-center font-black text-yellow-400">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="section-title">Historique récent</h3>
            <p className="text-sm text-gray-500 mt-1">Les derniers faits de match enregistrés pour ce joueur.</p>
          </div>
        </div>

        {recentGoals.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-6">Aucun but ou passe enregistrés récemment</p>
        ) : (
          <div className="space-y-2">
            {recentGoals.map((goal, index) => (
              <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/50 text-sm">
                <div className="text-gray-500 text-xs min-w-[90px]">
                  {goal.date ? format(parseISO(goal.date), 'd MMM yyyy', { locale: fr }) : '—'}
                </div>
                <div className="flex-1">
                  <span className="text-white">{goal.home_team} {goal.home_score} - {goal.away_score} {goal.away_team}</span>
                </div>
                <div className="text-xs">
                  {goal.scorer_id === parseInt(id, 10) ? (
                    <span className="badge bg-red-500/20 text-red-400">But</span>
                  ) : (
                    <span className="badge bg-blue-500/20 text-blue-400">Passe</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">Pér. {goal.period}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
