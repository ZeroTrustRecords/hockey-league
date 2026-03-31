import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Trophy, Users, Zap, FileText, Target, TrendingUp, Calendar, MessageSquare, CheckCircle, Star, ArrowRight, CalendarDays } from 'lucide-react';

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color = 'blue' }) {
  const colors = { blue: 'text-blue-400', green: 'text-emerald-400', yellow: 'text-yellow-400', purple: 'text-purple-400' };
  return (
    <div className="bg-gray-900 rounded-2xl p-3 sm:p-5 border border-gray-800">
      <Icon size={18} className={`${colors[color]} mb-2 sm:mb-3`} />
      <div className="text-2xl sm:text-3xl font-black text-white">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

// ─── Match row (results + upcoming) ───────────────────────────────────────────
function MatchRow({ match, showResult }) {
  const date = parseISO(match.date);
  const isPlayoff = !!match.is_playoff;
  return (
    <div className={`py-2.5 border-b last:border-0 ${isPlayoff ? 'border-yellow-500/20' : 'border-gray-800/60'}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[10px] sm:text-xs text-gray-600 truncate">{format(date, 'EEE d MMM · HH:mm', { locale: fr })}</span>
        {isPlayoff && (
          <span className="text-xs px-1.5 py-0.5 rounded font-bold bg-yellow-500/15 text-yellow-400 leading-none">🏆 Éliminatoires</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5 justify-end min-w-0">
          <span className={`text-xs sm:text-sm font-medium truncate text-right ${isPlayoff ? 'text-yellow-100' : 'text-white'}`}>{match.home_team_name}</span>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: match.home_color }} />
        </div>
        {showResult ? (
          <div className={`flex items-center gap-1 flex-shrink-0 rounded-lg px-2.5 py-1 ${isPlayoff ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-gray-800'}`}>
            <span className="text-sm font-black text-white w-4 text-center">{match.home_score}</span>
            <span className="text-gray-600 text-xs">—</span>
            <span className="text-sm font-black text-white w-4 text-center">{match.away_score}</span>
          </div>
        ) : (
          <div className="flex-shrink-0 text-xs text-gray-600 font-medium w-8 text-center">vs</div>
        )}
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: match.away_color }} />
          <span className={`text-xs sm:text-sm truncate ${isPlayoff ? 'text-yellow-100/70' : 'text-gray-400'}`}>{match.away_team_name}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Leader list column ────────────────────────────────────────────────────────
function LeaderList({ title, players, valueKey, valueLabel, icon: Icon }) {
  const max = players[0]?.[valueKey] || 1;
  return (
    <div className="bg-gray-900 rounded-2xl p-4 sm:p-5 border border-gray-800">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <Icon size={15} className="text-gray-500" />
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <div className="space-y-3">
        {players.slice(0, 5).map((p, i) => (
          <Link to={`/players/${p.id}`} key={p.id} className="block group">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-600 w-4 text-right">{i + 1}</span>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.team_color }} />
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors flex-1 truncate">
                {p.first_name} {p.last_name}
              </span>
              <span className="text-sm font-bold text-white">
                {p[valueKey]} <span className="text-gray-600 font-normal text-xs">{valueLabel}</span>
              </span>
            </div>
            <div className="ml-6 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-gray-500 rounded-full group-hover:bg-gray-400 transition-colors"
                style={{ width: `${(p[valueKey] / max) * 100}%` }} />
            </div>
          </Link>
        ))}
        {players.length === 0 && (
          <p className="text-gray-600 text-sm text-center py-3">Aucune statistique</p>
        )}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { isAdmin, isMarqueur } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-600 text-sm">Chargement...</div>
    </div>
  );

  const {
    upcoming = [], recentResults = [],
    topScorers = [], topGoals = [], topAssists = [],
    standings = [], announcements = [],
    counts = {}, activeSeason,
  } = data || {};

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Ligue de Hockey</p>
          <h1 className="text-2xl sm:text-4xl font-black text-white">Tableau de bord</h1>
          <p className="text-gray-500 text-sm mt-2">{activeSeason?.name || 'Saison 2024-2025'}</p>
        </div>
        {(isAdmin || isMarqueur) && (
          <Link to="/gamesheet" className="btn-primary hidden sm:flex mt-1">
            <FileText size={15} /> Feuille de match
          </Link>
        )}
      </div>

      {/* Champion banner */}
      {activeSeason?.status === 'completed' && activeSeason?.champion_name && (
        <Link to="/playoffs"
          className="flex items-center gap-4 p-5 rounded-2xl border hover:opacity-90 transition-opacity"
          style={{ borderColor: activeSeason.champion_color + '40', background: activeSeason.champion_color + '10' }}>
          <span className="text-2xl">🏆</span>
          <div>
            <div className="font-black text-white text-lg">{activeSeason.champion_name}</div>
            <div className="text-sm text-gray-400">Champions {activeSeason.name}</div>
          </div>
          <ArrowRight size={16} className="text-gray-500 ml-auto" />
        </Link>
      )}

      {/* Playoffs banner */}
      {activeSeason?.status === 'playoffs' && (
        <Link to="/playoffs" className="flex items-center gap-3 p-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/8 transition-colors">
          <Star size={16} className="text-yellow-500 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-white">Séries éliminatoires en cours</span>
            <span className="text-gray-500 ml-2">· {activeSeason.name}</span>
          </div>
          <ArrowRight size={15} className="text-gray-500" />
        </Link>
      )}

      {/* ── ROW 1: Classement + Derniers résultats + Prochains matchs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr] gap-3 sm:gap-5">

        {/* Classement */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Trophy size={15} className="text-gray-500" />
              <span className="text-sm font-semibold text-white">Classement</span>
            </div>
            <Link to="/standings" className="text-xs text-gray-500 hover:text-white transition-colors">Voir complet →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[320px]">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2.5 px-5 text-xs text-gray-600 font-medium w-7">#</th>
                  <th className="text-left py-2.5 text-xs text-gray-600 font-medium">Équipe</th>
                  <th className="text-center py-2.5 text-xs text-gray-600 font-medium w-9">PJ</th>
                  <th className="hidden sm:table-cell text-center py-2.5 text-xs text-gray-600 font-medium w-9">V</th>
                  <th className="hidden sm:table-cell text-center py-2.5 text-xs text-gray-600 font-medium w-9">D</th>
                  <th className="text-center py-2.5 pr-5 text-xs text-gray-500 font-semibold w-11">PTS</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr key={s.team_id} className="border-b border-gray-800/40 hover:bg-gray-800/30 transition-colors last:border-0">
                    <td className="py-2.5 px-5 text-gray-600 text-xs">{i + 1}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.team_color }} />
                        <Link to={`/teams/${s.team_id}`} className="text-gray-300 hover:text-white transition-colors font-medium text-sm">{s.team_name}</Link>
                      </div>
                    </td>
                    <td className="py-2.5 text-center text-gray-600 text-xs">{s.gp}</td>
                    <td className="hidden sm:table-cell py-2.5 text-center text-gray-300 text-sm">{s.w}</td>
                    <td className="hidden sm:table-cell py-2.5 text-center text-gray-500 text-sm">{s.l}</td>
                    <td className="py-2.5 pr-5 text-center font-black text-white">{s.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Derniers résultats */}
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle size={15} className="text-gray-500" />
              <span className="text-sm font-semibold text-white">Derniers résultats</span>
            </div>
            <Link to="/schedule?status=completed" className="text-xs text-gray-500 hover:text-white transition-colors">Tous →</Link>
          </div>
          {recentResults.length === 0
            ? <p className="text-gray-600 text-sm py-4 text-center">Aucun résultat</p>
            : recentResults.map(m => <MatchRow key={m.id} match={m} showResult={true} />)}
        </div>

        {/* Prochains matchs */}
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarDays size={15} className="text-gray-500" />
              <span className="text-sm font-semibold text-white">Match à venir</span>
            </div>
            <Link to="/schedule" className="text-xs text-gray-500 hover:text-white transition-colors">Calendrier →</Link>
          </div>
          {upcoming.length === 0
            ? <p className="text-gray-600 text-sm py-4 text-center">Aucun match à venir</p>
            : upcoming.map(m => <MatchRow key={m.id} match={m} showResult={false} />)}
        </div>
      </div>

      {/* ── ROW 2: Leaders PTS + Buts + Passes ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <LeaderList title="Leaders PTS"   players={topScorers} valueKey="points"  valueLabel="pts"  icon={TrendingUp} />
        <LeaderList title="Leaders Buts"  players={topGoals}   valueKey="goals"   valueLabel="B"    icon={Target} />
        <LeaderList title="Leaders Passes" players={topAssists} valueKey="assists" valueLabel="A"    icon={Star} />
      </div>

      {/* ── ROW 3: Messages ── */}
      <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare size={15} className="text-gray-500" />
            <span className="text-sm font-semibold text-white">Messages</span>
          </div>
          <Link to="/messages" className="text-xs text-gray-500 hover:text-white transition-colors">Voir tout →</Link>
        </div>
        {announcements.length === 0 ? (
          <p className="text-gray-600 text-sm py-3 text-center">Aucun message</p>
        ) : (
          <div className="divide-y divide-gray-800/60">
            {announcements.slice(0, 4).map(ann => (
              <div key={ann.id} className="py-3 first:pt-0 last:pb-0">
                {ann.title && <div className="text-sm font-semibold text-white mb-0.5">{ann.title}</div>}
                <div className="text-xs text-gray-500">{ann.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ROW 4: Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}   label="Joueurs actifs"  value={counts.players || 0}       color="blue" />
        <StatCard icon={Trophy}  label="Matchs joués"    value={counts.matches_played || 0} color="green" />
        <StatCard icon={Target}  label="Buts marqués"    value={counts.goals_total || 0}    color="yellow" />
        <StatCard icon={Zap}     label="Équipes"          value={counts.teams || 0}           color="purple" />
      </div>

    </div>
  );
}
