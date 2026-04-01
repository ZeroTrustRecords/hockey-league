import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, Shield, Star, Target, Users } from 'lucide-react';
import api from '../api/client';

export default function TeamDetail() {
  const { id } = useParams();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/teams/${id}`).then((response) => setTeam(response.data)).finally(() => setLoading(false));
  }, [id]);

  const captain = team?.staff?.find((staff) => staff.role === 'captain');
  const assistants = team?.staff?.filter((staff) => staff.role === 'assistant') || [];

  const record = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;

    for (const match of team?.recentMatches || []) {
      const isHome = match.home_team_id === parseInt(id, 10);
      const teamScore = isHome ? match.home_score : match.away_score;
      const opponentScore = isHome ? match.away_score : match.home_score;
      goalsFor += teamScore;
      goalsAgainst += opponentScore;
      if (teamScore > opponentScore) wins += 1;
      else losses += 1;
    }

    return { wins, losses, goalsFor, goalsAgainst };
  }, [id, team?.recentMatches]);

  if (loading) return <div className="text-center py-12 text-gray-500 animate-pulse">Chargement...</div>;
  if (!team) return <div className="text-center py-12 text-gray-500">Équipe introuvable</div>;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Link to="/teams" className="btn-ghost p-2"><ArrowLeft size={18} /></Link>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Fiche d’équipe</p>
          <h1 className="text-3xl sm:text-5xl font-black text-white">{team.name}</h1>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="p-6 sm:p-7 border-l-4" style={{ borderLeftColor: team.color }}>
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${team.color}22`, border: `2px solid ${team.color}` }}
            >
              <Shield size={42} style={{ color: team.color }} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                <span className="text-sm text-gray-400">Identité du club</span>
              </div>
              <p className="text-sm text-gray-400 max-w-2xl">
                Effectif, meneurs et derniers résultats du club dans la saison actuelle.
              </p>

              <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-400">
                {captain && (
                  <span className="flex items-center gap-1.5">
                    <Star size={13} className="text-yellow-400" />
                    <span>
                      Capitaine :
                      {' '}
                      <Link to={`/players/${captain.id}`} className="text-white hover:text-blue-400">
                        {captain.first_name} {captain.last_name}
                      </Link>
                    </span>
                  </span>
                )}

                {assistants.map((assistant) => (
                  <span key={assistant.id} className="flex items-center gap-1.5">
                    <Star size={13} className="text-gray-500" />
                    <span>
                      Assistant :
                      {' '}
                      <Link to={`/players/${assistant.id}`} className="text-white hover:text-blue-400">
                        {assistant.first_name} {assistant.last_name}
                      </Link>
                    </span>
                  </span>
                ))}

                <span className="flex items-center gap-1.5">
                  <Users size={13} />
                  {team.players?.length || 0} joueurs
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 w-full lg:w-auto">
              <div className="bg-gray-800/70 rounded-2xl p-4 text-center min-w-[90px]">
                <div className="text-2xl font-black text-emerald-400">{record.wins}</div>
                <div className="text-xs text-gray-500 mt-1">Victoires</div>
              </div>
              <div className="bg-gray-800/70 rounded-2xl p-4 text-center min-w-[90px]">
                <div className="text-2xl font-black text-red-400">{record.losses}</div>
                <div className="text-xs text-gray-500 mt-1">Défaites</div>
              </div>
              <div className="bg-gray-800/70 rounded-2xl p-4 text-center min-w-[90px]">
                <div className="text-2xl font-black text-blue-400">{record.goalsFor}</div>
                <div className="text-xs text-gray-500 mt-1">Buts pour</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Alignement</h3>
            <span className="text-xs text-gray-500">{team.players?.length || 0} joueur{(team.players?.length || 0) > 1 ? 's' : ''}</span>
          </div>
          {(!team.players || team.players.length === 0) ? (
            <p className="text-gray-500 text-sm text-center py-4">Aucun joueur assigné</p>
          ) : (
            <div className="space-y-1.5">
              {team.players.map((player) => (
                <Link to={`/players/${player.id}`} key={player.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 transition-colors">
                  <span className="text-gray-500 font-mono text-xs w-8 text-right">{player.number ? `#${player.number}` : '—'}</span>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: team.color }}>
                    {player.first_name[0]}{player.last_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">
                      {player.first_name} {player.last_name}
                      {player.staff_role === 'captain' && <Star size={11} className="inline ml-1.5 text-yellow-400" />}
                      {player.staff_role === 'assistant' && <Star size={11} className="inline ml-1.5 text-gray-500" />}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{player.position}</div>
                  </div>
                  <span className="position-badge text-xs">{player.position}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Derniers matchs</h3>
            <span className="text-xs text-gray-500">Forme récente</span>
          </div>
          {(!team.recentMatches || team.recentMatches.length === 0) ? (
            <p className="text-gray-500 text-sm text-center py-4">Aucun match joué</p>
          ) : (
            <div className="space-y-2">
              {team.recentMatches.map((match) => {
                const isHome = match.home_team_id === parseInt(id, 10);
                const teamScore = isHome ? match.home_score : match.away_score;
                const opponentScore = isHome ? match.away_score : match.home_score;
                const opponentName = isHome ? match.away_team_name : match.home_team_name;
                const opponentColor = isHome ? match.away_color : match.home_color;
                const won = teamScore > opponentScore;

                return (
                  <div key={match.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/50">
                    <span className={`badge ${won ? 'result-w' : 'result-l'} font-bold`}>{won ? 'V' : 'D'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-white font-bold">{teamScore}</span>
                        <span className="text-gray-500">-</span>
                        <span className="text-gray-400">{opponentScore}</span>
                        <span className="text-gray-500">vs</span>
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: opponentColor }} />
                        <span className="text-gray-300 truncate">{opponentName}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Target size={11} />
                        {won ? 'Victoire' : 'Défaite'}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {format(parseISO(match.date), 'd MMM', { locale: fr })}
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
