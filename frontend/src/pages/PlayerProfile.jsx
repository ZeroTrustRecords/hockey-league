import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, Target, TrendingUp, Award, Mail, Phone, Hash } from 'lucide-react';

const positionLabel = { C: 'Centre', LW: 'Ailier G', RW: 'Ailier D', D: 'Défenseur', G: 'Gardien' };

export default function PlayerProfile() {
  const { id } = useParams();
  const [player, setPlayer] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/players/${id}`),
      api.get(`/players/${id}/history`),
    ]).then(([pr, hr]) => {
      setPlayer(pr.data);
      setHistory(hr.data);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-12 text-gray-500 animate-pulse">Chargement...</div>;
  if (!player) return <div className="text-center py-12 text-gray-500">Joueur introuvable</div>;

  const { stats = {}, recentGoals = [] } = player;
  const pts = (stats.goals || 0) + (stats.assists || 0);
  const ppg = stats.matches_played > 0 ? (pts / stats.matches_played).toFixed(2) : '0.00';

  // Career totals from history
  const careerGoals   = history.reduce((s, r) => s + r.goals, 0);
  const careerAssists = history.reduce((s, r) => s + r.assists, 0);
  const careerPoints  = careerGoals + careerAssists;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/players" className="btn-ghost p-2"><ArrowLeft size={18} /></Link>
        <h1 className="page-title">Profil du joueur</h1>
      </div>

      {/* Profile header */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
            style={{ backgroundColor: player.team_color || '#374151' }}>
            {player.first_name[0]}{player.last_name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-bold text-white">{player.first_name} {player.last_name}</h2>
              {player.nickname && <span className="text-gray-400 italic">"{player.nickname}"</span>}
              <span className={player.status === 'active' ? 'status-active' : 'status-inactive'}>
                {player.status === 'active' ? 'Actif' : 'Inactif'}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-2 flex-wrap text-sm text-gray-400">
              {player.number && <span className="flex items-center gap-1"><Hash size={14} /> #{player.number}</span>}
              <span className="position-badge">{positionLabel[player.position] || player.position}</span>
              {player.team_name && (
                <Link to={`/teams/${player.team_id}`} className="flex items-center gap-1.5 hover:text-blue-400 transition-colors">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: player.team_color }} />
                  {player.team_name}
                </Link>
              )}
              {player.age && <span>{player.age} ans</span>}
            </div>
            <div className="flex items-center gap-4 mt-2 flex-wrap text-sm">
              {player.email && <a href={`mailto:${player.email}`} className="flex items-center gap-1 text-gray-500 hover:text-blue-400 transition-colors"><Mail size={13} />{player.email}</a>}
              {player.phone && <span className="flex items-center gap-1 text-gray-500"><Phone size={13} />{player.phone}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Current season stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { icon: Target,    label: 'Buts',      value: stats.goals || 0,       color: 'text-red-400' },
          { icon: TrendingUp,label: 'Passes',     value: stats.assists || 0,     color: 'text-blue-400' },
          { icon: Award,     label: 'Points',     value: pts,                    color: 'text-yellow-400' },
          { icon: Hash,      label: 'Matchs',     value: stats.matches_played || 0, color: 'text-gray-300' },
          { icon: TrendingUp,label: 'Pts/match',  value: ppg,                    color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="card text-center">
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Season history */}
      {history.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Historique par saison</h3>
            {history.length > 1 && (
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>Carrière :</span>
                <span className="text-red-400 font-bold">{careerGoals}B</span>
                <span className="text-blue-400 font-bold">{careerAssists}P</span>
                <span className="text-yellow-400 font-bold">{careerPoints}PTS</span>
              </div>
            )}
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Saison</th>
                  <th>Équipe</th>
                  <th className="text-center">PJ</th>
                  <th className="text-center">B</th>
                  <th className="text-center">P</th>
                  <th className="text-center font-bold text-yellow-400">PTS</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row, i) => (
                  <tr key={i}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">{row.season_name}</span>
                        {row.is_playoff === 1
                          ? <span className="text-xs px-1.5 py-0.5 rounded font-bold bg-yellow-500/15 text-yellow-400">Éliminatoires</span>
                          : <span className="text-xs px-1.5 py-0.5 rounded font-bold bg-blue-500/15 text-blue-400">Régulière</span>
                        }
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: row.team_color }} />
                        <span className="text-gray-300 text-sm">{row.team_name}</span>
                      </div>
                    </td>
                    <td className="text-center text-gray-400">{row.matches_played}</td>
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

      {/* Recent goals */}
      <div className="card">
        <h3 className="section-title mb-4">Historique récent</h3>
        {recentGoals.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-6">Aucun but/passe enregistré</p>
        ) : (
          <div className="space-y-2">
            {recentGoals.map((g, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 text-sm">
                <div className="text-gray-500 text-xs min-w-[70px]">
                  {g.date ? format(parseISO(g.date), 'd MMM yyyy', { locale: fr }) : '—'}
                </div>
                <div className="flex-1">
                  <span className="text-white">{g.home_team} {g.home_score} – {g.away_score} {g.away_team}</span>
                </div>
                <div className="text-xs">
                  {g.scorer_id === parseInt(id)
                    ? <span className="badge bg-red-500/20 text-red-400">But</span>
                    : <span className="badge bg-blue-500/20 text-blue-400">Passe</span>
                  }
                </div>
                <div className="text-xs text-gray-500">Pér. {g.period}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
