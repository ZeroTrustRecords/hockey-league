import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle,
  MessageSquare,
  Shield,
  Star,
  Target,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react';
import api from '../api/client';
import { getTeamAbbreviation } from '../lib/teamAbbreviations';

function MatchRow({ match, showResult }) {
  const date = parseISO(match.date);
  const isPlayoff = Boolean(match.is_playoff);

  return (
    <div className={`py-3 border-b last:border-0 ${isPlayoff ? 'border-yellow-500/20' : 'border-gray-800/60'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] sm:text-xs text-gray-500 truncate">
          {format(date, "EEE d MMM '·' HH:mm", { locale: fr })}
        </span>
        {isPlayoff && (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-yellow-500/15 text-yellow-400 leading-none">
            Éliminatoires
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5 justify-end min-w-0">
          <span className={`text-sm font-medium truncate text-right ${isPlayoff ? 'text-yellow-100' : 'text-white'}`}>
            {match.home_team_name}
          </span>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: match.home_color }} />
        </div>

        {showResult ? (
          <div className={`flex items-center gap-1 flex-shrink-0 rounded-lg px-3 py-1 ${isPlayoff ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-gray-800'}`}>
            <span className="text-sm font-black text-white w-4 text-center">{match.home_score}</span>
            <span className="text-gray-600 text-xs">-</span>
            <span className="text-sm font-black text-white w-4 text-center">{match.away_score}</span>
          </div>
        ) : (
          <div className="flex-shrink-0 text-xs text-gray-600 font-medium w-8 text-center">vs</div>
        )}

        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: match.away_color }} />
          <span className={`text-sm truncate ${isPlayoff ? 'text-yellow-100/80' : 'text-gray-400'}`}>
            {match.away_team_name}
          </span>
        </div>
      </div>
    </div>
  );
}

function LeaderList({ title, subtitle, players, valueKey, valueLabel, icon: Icon }) {
  const max = players[0]?.[valueKey] || 1;

  return (
    <div className="ice-panel-soft rounded-[1.75rem] p-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={15} className="text-gray-500" />
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">{subtitle}</p>

      <div className="space-y-3">
        {players.slice(0, 5).map((player, index) => (
          <Link to={`/players/${player.id}`} key={player.id} className="block group">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-600 w-4 text-right">{index + 1}</span>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: player.team_color }} />
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors flex-1 truncate">
                {player.first_name} {player.last_name}
              </span>
              <span className="text-sm font-bold text-white">
                {player[valueKey]} <span className="text-gray-600 font-normal text-xs">{valueLabel}</span>
              </span>
            </div>
            <div className="ml-6 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-500 rounded-full group-hover:bg-gray-400 transition-colors"
                style={{ width: `${(player[valueKey] / max) * 100}%` }}
              />
            </div>
          </Link>
        ))}

        {players.length === 0 && <p className="text-gray-600 text-sm text-center py-3">Aucune statistique disponible</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then((response) => setData(response.data)).finally(() => setLoading(false));
  }, []);

  const {
    upcoming = [],
    recentResults = [],
    topScorers = [],
    topGoals = [],
    topAssists = [],
    standings = [],
    announcements = [],
    counts = {},
    activeSeason,
    playoffsComingSoon,
  } = data || {};

  const featuredMatch = upcoming[0] || null;
  const podium = standings.slice(0, 3);
  const playoffPreviewSeeds = standings.slice(0, 6);
  const featuredAnnouncement = announcements[0] || null;

  const seasonLabel = useMemo(() => {
    if (!activeSeason?.name) return 'Saison en cours';
    if (activeSeason.status === 'playoffs') return `${activeSeason.name} · Éliminatoires en cours`;
    if (activeSeason.status === 'completed') return `${activeSeason.name} · Saison terminée`;
    return `${activeSeason.name} · Saison régulière`;
  }, [activeSeason]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 text-sm">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="public-shell space-y-6 max-w-6xl">
      {featuredAnnouncement && (
        <button
          type="button"
          onClick={() => setSelectedAnnouncement(featuredAnnouncement)}
          className="w-full rounded-[1.5rem] border border-amber-500/25 bg-amber-500/8 px-5 py-4 text-left hover:bg-amber-500/12 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300 flex-shrink-0">
              <Bell size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-[0.22em] font-semibold text-amber-300">Message de la ligue</span>
                <span className="text-xs text-gray-500">
                  {featuredAnnouncement.created_at
                    ? format(parseISO(featuredAnnouncement.created_at), 'd MMM yyyy', { locale: fr })
                    : ''}
                </span>
              </div>
              <div className="mt-1 text-lg font-bold text-white">
                {featuredAnnouncement.title || 'Nouvelle annonce'}
              </div>
              <div className="mt-1 text-sm text-gray-300 line-clamp-2">
                {featuredAnnouncement.content}
              </div>
            </div>
            <ArrowRight size={16} className="text-amber-300 flex-shrink-0 mt-1" />
          </div>
        </button>
      )}

      <div className="ice-panel-soft rounded-[1.75rem] px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="public-eyebrow">Site officiel de la ligue</p>
            <h1 className="public-title text-3xl sm:text-5xl">LHMA</h1>
            <p className="public-subtitle max-w-4xl mt-2">
              {'Résultats, prochain rendez-vous, meneurs offensifs et état de la saison au même endroit.'}
            </p>
          </div>
          <div className="score-chip shrink-0">{seasonLabel}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-5">
        <div className="ice-panel rounded-[2rem] overflow-hidden">
          <div className="p-6 sm:p-7">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays size={16} className="text-blue-400" />
              <span className="text-xs uppercase tracking-[0.25em] text-blue-300/80 font-semibold">Prochain rendez-vous</span>
            </div>

            {featuredMatch ? (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-sm text-gray-400">
                      {format(parseISO(featuredMatch.date), "EEEE d MMMM yyyy '\u00E0' HH:mm", { locale: fr })}
                    </div>
                    {featuredMatch.location && (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-300">
                        {featuredMatch.location}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <Link to="/schedule" className="btn-primary">
                      Voir le calendrier
                    </Link>
                    <Link to="/standings" className="btn-secondary">
                      Voir le classement
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)] gap-4 items-stretch">
                  <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5 text-center xl:text-right min-w-0 flex flex-col justify-center">
                    <div className="flex items-center justify-center xl:justify-end gap-2 mb-3 min-w-0">
                      <span className="text-2xl sm:text-3xl font-black text-white truncate">{getTeamAbbreviation(featuredMatch.home_team_name)}</span>
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: featuredMatch.home_color }} />
                    </div>
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Équipe locale</p>
                  </div>

                  <div className="rounded-[1.75rem] border border-white/10 bg-gradient-to-b from-white/10 to-white/5 px-5 py-5 text-center flex flex-col justify-center">
                    <div className="text-xs text-gray-500 uppercase tracking-[0.26em] mb-2">Match à venir</div>
                    <div className="text-xl sm:text-2xl font-black text-white leading-none">VS</div>
                  </div>

                  <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5 text-center xl:text-left min-w-0 flex flex-col justify-center">
                    <div className="flex items-center justify-center xl:justify-start gap-2 mb-3 min-w-0">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: featuredMatch.away_color }} />
                      <span className="text-2xl sm:text-3xl font-black text-white truncate">{getTeamAbbreviation(featuredMatch.away_team_name)}</span>
                    </div>
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Équipe visiteuse</p>
                  </div>
                </div>

                <div className="rounded-[1.35rem] border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-sm font-semibold text-white">Le prochain match approche</div>
                  <div className="mt-1 text-sm text-gray-400">
                    Retrouve le calendrier complet et le classement actuel pour suivre l'évolution de la saison.
                  </div>
                </div>
              </div>
            ) : playoffsComingSoon ? (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-sm text-gray-400">
                      Le classement final est connu. Voici l'affiche initiale des eliminatoires a venir.
                    </div>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                      Tableau preliminaire
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <Link to="/playoffs" className="btn-primary">
                      Voir le tableau
                    </Link>
                    <Link to="/standings" className="btn-secondary">
                      Voir le classement final
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {[
                    [playoffPreviewSeeds[0], playoffPreviewSeeds[1], 'Match 1', 1, 2],
                    [playoffPreviewSeeds[2], playoffPreviewSeeds[5], 'Match 2', 3, 6],
                    [playoffPreviewSeeds[3], playoffPreviewSeeds[4], 'Match 3', 4, 5],
                  ].filter(([home, away]) => home && away).map(([home, away, label, homeSeed, awaySeed]) => (
                    <Link
                      key={label}
                      to="/playoffs"
                      className="rounded-[1.6rem] border border-blue-500/20 bg-blue-500/5 p-5 hover:bg-blue-500/10 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-blue-300/80 font-semibold">{label}</div>
                        <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                          Serie
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: home.team_color }} />
                            <span className="text-base font-bold text-white truncate">{getTeamAbbreviation(home.team_name)}</span>
                          </div>
                          <span className="rounded-full bg-white/5 px-2 py-1 text-xs text-gray-400">#{homeSeed}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-px flex-1 bg-white/10" />
                          <div className="text-xs text-gray-600 uppercase tracking-[0.35em]">vs</div>
                          <div className="h-px flex-1 bg-white/10" />
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: away.team_color }} />
                            <span className="text-base font-bold text-white truncate">{getTeamAbbreviation(away.team_name)}</span>
                          </div>
                          <span className="rounded-full bg-white/5 px-2 py-1 text-xs text-gray-400">#{awaySeed}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="rounded-[1.35rem] border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-sm font-semibold text-white">Les series debutent bientot</div>
                  <div className="mt-1 text-sm text-gray-400">
                    Les positions 1 a 6 sont verrouillees. Le tableau complet apparaitra ici et dans l'onglet Eliminatoires.
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8">
                <div className="text-lg font-bold text-white mb-2">Aucun match à l’horaire pour le moment</div>
                <p className="text-sm text-gray-500">Le prochain rendez-vous apparaîtra ici dès qu’une rencontre sera planifiée.</p>
              </div>
            )}
          </div>
        </div>

        <div className="ice-panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={16} className="text-yellow-400" />
            <h2 className="text-lg font-bold text-white">Portrait de saison</h2>
          </div>
          <p className="text-sm text-gray-500 mb-5">Le haut du classement et le contexte actuel de la ligue.</p>

          {activeSeason?.status === 'completed' && activeSeason?.champion_name && (
            <Link
              to="/playoffs"
              className="flex items-center gap-3 p-4 rounded-2xl border mb-4 hover:opacity-90 transition-opacity"
              style={{ borderColor: `${activeSeason.champion_color}40`, background: `${activeSeason.champion_color}12` }}
            >
              <Trophy size={18} className="text-yellow-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-black text-white truncate">{activeSeason.champion_name}</div>
                <div className="text-xs text-gray-400">Champions {activeSeason.name}</div>
              </div>
              <ArrowRight size={16} className="text-gray-500 ml-auto" />
            </Link>
          )}

          {activeSeason?.status === 'playoffs' && (
            <Link to="/playoffs" className="flex items-center gap-3 p-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 mb-4 hover:bg-yellow-500/10 transition-colors">
              <Star size={16} className="text-yellow-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold text-white">Les éliminatoires sont en cours</div>
                <div className="text-xs text-gray-400">{activeSeason.name}</div>
              </div>
              <ArrowRight size={16} className="text-gray-500 ml-auto" />
            </Link>
          )}

          {playoffsComingSoon && (
            <Link to="/playoffs" className="flex items-center gap-3 p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 mb-4 hover:bg-blue-500/10 transition-colors">
              <Trophy size={16} className="text-blue-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold text-white">Les eliminatoires arrivent bientot</div>
                <div className="text-xs text-gray-400">{playoffsComingSoon.message}</div>
              </div>
              <ArrowRight size={16} className="text-gray-500 ml-auto" />
            </Link>
          )}

          <div className="space-y-3">
            {podium.length === 0 ? (
              <p className="text-sm text-gray-600 py-6 text-center">Le classement apparaîtra ici après les premiers matchs.</p>
            ) : (
              podium.map((team, index) => (
                <Link
                  to={`/teams/${team.team_id}`}
                  key={team.team_id}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-gray-800/60 hover:bg-gray-800 transition-colors"
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm"
                    style={{ color: team.team_color, backgroundColor: `${team.team_color}22`, border: `1px solid ${team.team_color}` }}
                  >
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team.team_color }} />
                      <span className="font-semibold text-white truncate">{team.team_name}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {team.w} V · {team.l} D · Diff {team.diff > 0 ? '+' : ''}{team.diff}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-white">{team.pts}</div>
                    <div className="text-[10px] text-gray-600 uppercase tracking-wider">PTS</div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr_1fr] gap-5">
        <div className="ice-panel rounded-[1.75rem] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <div>
              <div className="flex items-center gap-2">
                <Shield size={15} className="text-gray-500" />
                <span className="text-sm font-semibold text-white">Classement complet</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Une lecture rapide de la course au sommet.</p>
            </div>
            <Link to="/standings" className="text-xs text-gray-500 hover:text-white transition-colors">
              Voir la page
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[320px]">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-5 text-xs text-gray-600 font-medium w-7">#</th>
                  <th className="text-left py-3 text-xs text-gray-600 font-medium">Équipe</th>
                  <th className="text-center py-3 text-xs text-gray-600 font-medium w-9">PJ</th>
                  <th className="hidden sm:table-cell text-center py-3 text-xs text-gray-600 font-medium w-9">V</th>
                  <th className="hidden sm:table-cell text-center py-3 text-xs text-gray-600 font-medium w-9">D</th>
                  <th className="text-center py-3 pr-5 text-xs text-gray-500 font-semibold w-11">PTS</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((standing, index) => (
                  <tr key={standing.team_id} className="border-b border-gray-800/40 hover:bg-gray-800/30 transition-colors last:border-0">
                    <td className="py-3 px-5 text-gray-600 text-xs">{index + 1}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: standing.team_color }} />
                        <Link to={`/teams/${standing.team_id}`} className="text-gray-300 hover:text-white transition-colors font-medium text-sm">
                          {standing.team_name}
                        </Link>
                      </div>
                    </td>
                    <td className="py-3 text-center text-gray-600 text-xs">{standing.gp}</td>
                    <td className="hidden sm:table-cell py-3 text-center text-gray-300 text-sm">{standing.w}</td>
                    <td className="hidden sm:table-cell py-3 text-center text-gray-500 text-sm">{standing.l}</td>
                    <td className="py-3 pr-5 text-center font-black text-white">{standing.pts}</td>
                  </tr>
                ))}

                {standings.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-sm text-gray-600">
                      Le classement sera visible dès que des matchs seront validés.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ice-panel-soft rounded-[1.75rem] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle size={15} className="text-gray-500" />
                <span className="text-sm font-semibold text-white">Derniers résultats</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Ce qui vient de tomber.</p>
            </div>
            <Link to="/schedule?status=completed" className="text-xs text-gray-500 hover:text-white transition-colors">
              Tout voir
            </Link>
          </div>
          {recentResults.length === 0 ? (
            <p className="text-gray-600 text-sm py-4 text-center">Aucun résultat pour le moment</p>
          ) : (
            recentResults.map((match) => <MatchRow key={match.id} match={match} showResult />)
          )}
        </div>

        <div className="ice-panel-soft rounded-[1.75rem] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays size={15} className="text-gray-500" />
                <span className="text-sm font-semibold text-white">À l’horaire</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Les prochains rendez-vous à ne pas manquer.</p>
            </div>
            <Link to="/schedule" className="text-xs text-gray-500 hover:text-white transition-colors">
              Calendrier
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-gray-600 text-sm py-4 text-center">Aucun match à venir</p>
          ) : (
            upcoming.map((match) => <MatchRow key={match.id} match={match} showResult={false} />)
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <LeaderList title="Meneurs au total" subtitle="Les meilleurs pointeurs du moment." players={topScorers} valueKey="points" valueLabel="pts" icon={TrendingUp} />
        <LeaderList title="Meneurs au but" subtitle="Les meilleurs finisseurs." players={topGoals} valueKey="goals" valueLabel="B" icon={Target} />
        <LeaderList title="Meneurs à la passe" subtitle="Les créateurs de jeu en tête." players={topAssists} valueKey="assists" valueLabel="A" icon={Star} />
      </div>

      <div className="ice-panel-soft rounded-[1.75rem] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare size={15} className="text-gray-500" />
              <span className="text-sm font-semibold text-white">Vie de ligue</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Les annonces et messages importants.</p>
          </div>
          <Link to="/messages" className="text-xs text-gray-500 hover:text-white transition-colors">
            Voir tout
          </Link>
        </div>

        {announcements.length === 0 ? (
          <p className="text-gray-600 text-sm py-3 text-center">Aucun message publié.</p>
        ) : (
          <div className="divide-y divide-gray-800/60">
            {announcements.slice(0, 4).map((announcement) => (
              <div key={announcement.id} className="py-3 first:pt-0 last:pb-0">
                {announcement.title && <div className="text-sm font-semibold text-white mb-1">{announcement.title}</div>}
                <div className="text-sm text-gray-400">{announcement.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedAnnouncement && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedAnnouncement(null);
          }}
        >
          <div className="w-full max-w-2xl rounded-[1.75rem] border border-amber-500/20 bg-[#111827] overflow-hidden shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] font-semibold text-amber-300">Message de la ligue</div>
                <h3 className="mt-2 text-2xl font-black text-white">
                  {selectedAnnouncement.title || 'Nouvelle annonce'}
                </h3>
                <div className="mt-2 text-xs text-gray-500">
                  {selectedAnnouncement.created_at
                    ? format(parseISO(selectedAnnouncement.created_at), "d MMMM yyyy 'a' HH:mm", { locale: fr })
                    : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAnnouncement(null)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm leading-7 text-gray-200 whitespace-pre-wrap">
                {selectedAnnouncement.content}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
