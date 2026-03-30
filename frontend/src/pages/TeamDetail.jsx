import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, Users, Star, Shield } from 'lucide-react';

const positionLabel = { C: 'Centre', LW: 'Ailier G', RW: 'Ailier D', D: 'Défenseur', G: 'Gardien' };

export default function TeamDetail() {
  const { id } = useParams();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/teams/${id}`).then(r => setTeam(r.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-12 text-gray-500 animate-pulse">Chargement...</div>;
  if (!team) return <div className="text-center py-12 text-gray-500">Équipe introuvable</div>;

  const captain = team.staff?.find(s => s.role === 'captain');
  const assistants = team.staff?.filter(s => s.role === 'assistant') || [];

  const getRecord = () => {
    let w = 0, l = 0, gf = 0, ga = 0;
    for (const m of team.recentMatches || []) {
      const isHome = m.home_team_id === parseInt(id);
      const ts = isHome ? m.home_score : m.away_score;
      const os = isHome ? m.away_score : m.home_score;
      gf += ts; ga += os;
      if (ts > os) w++; else l++;
    }
    return { w, l, gf, ga };
  };
  const record = getRecord();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/teams" className="btn-ghost p-2"><ArrowLeft size={18} /></Link>
        <h1 className="page-title">{team.name}</h1>
      </div>

      {/* Header */}
      <div className="card" style={{ borderLeftColor: team.color, borderLeftWidth: '4px' }}>
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: team.color + '25', border: `2px solid ${team.color}` }}>
            <Shield size={36} style={{ color: team.color }} />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white">{team.name}</h2>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-400">
              {captain && (
                <span className="flex items-center gap-1.5">
                  <Star size={13} className="text-yellow-400" />
                  <span>Cap: <Link to={`/players/${captain.id}`} className="text-white hover:text-blue-400">{captain.first_name} {captain.last_name}</Link></span>
                </span>
              )}
              {assistants.map(a => (
                <span key={a.id} className="flex items-center gap-1.5">
                  <Star size={13} className="text-gray-500" />
                  <span>Adj: <Link to={`/players/${a.id}`} className="text-white hover:text-blue-400">{a.first_name} {a.last_name}</Link></span>
                </span>
              ))}
              <span className="flex items-center gap-1.5"><Users size={13} /> {team.players?.length || 0} joueurs</span>
            </div>
          </div>
          <div className="flex gap-4 text-center">
            <div><div className="text-2xl font-bold text-emerald-400">{record.w}</div><div className="text-xs text-gray-500">Victoires</div></div>
            <div><div className="text-2xl font-bold text-red-400">{record.l}</div><div className="text-xs text-gray-500">Défaites</div></div>
            <div><div className="text-2xl font-bold text-blue-400">{record.gf}</div><div className="text-xs text-gray-500">Buts</div></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Roster */}
        <div className="card">
          <h3 className="section-title mb-4">Alignement ({team.players?.length || 0})</h3>
          {(!team.players || team.players.length === 0) ? (
            <p className="text-gray-500 text-sm text-center py-4">Aucun joueur</p>
          ) : (
            <div className="space-y-1.5">
              {team.players.map(p => (
                <Link to={`/players/${p.id}`} key={p.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-800 transition-colors">
                  <span className="text-gray-500 font-mono text-xs w-6 text-right">{p.number || '—'}</span>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: team.color }}>
                    {p.first_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-white text-sm font-medium">{p.first_name} {p.last_name}</span>
                    {p.staff_role === 'captain' && <Star size={11} className="inline ml-1.5 text-yellow-400" />}
                    {p.staff_role === 'assistant' && <Star size={11} className="inline ml-1.5 text-gray-500" />}
                  </div>
                  <span className="position-badge text-xs">{p.position}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent matches */}
        <div className="card">
          <h3 className="section-title mb-4">Matchs récents</h3>
          {(!team.recentMatches || team.recentMatches.length === 0) ? (
            <p className="text-gray-500 text-sm text-center py-4">Aucun match joué</p>
          ) : (
            <div className="space-y-2">
              {team.recentMatches.map(m => {
                const isHome = m.home_team_id === parseInt(id);
                const teamScore = isHome ? m.home_score : m.away_score;
                const oppScore = isHome ? m.away_score : m.home_score;
                const oppName = isHome ? m.away_team_name : m.home_team_name;
                const oppColor = isHome ? m.away_color : m.home_color;
                const won = teamScore > oppScore;
                return (
                  <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50">
                    <span className={`badge ${won ? 'result-w' : 'result-l'} font-bold`}>{won ? 'V' : 'D'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-white font-bold">{teamScore}</span>
                        <span className="text-gray-500">–</span>
                        <span className="text-gray-400">{oppScore}</span>
                        <span className="text-gray-500">vs</span>
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: oppColor }} />
                        <span className="text-gray-300 truncate">{oppName}</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {format(parseISO(m.date), 'd MMM', { locale: fr })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
