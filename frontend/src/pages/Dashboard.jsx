import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Trophy, Users, Zap, FileText, Target, TrendingUp, Calendar, MessageSquare, CheckCircle, Star, ArrowRight } from 'lucide-react';

function StatCard({ icon: Icon, label, value, color = 'blue' }) {
  const colors = {
    blue:   'text-blue-400',
    green:  'text-emerald-400',
    yellow: 'text-yellow-400',
    purple: 'text-purple-400',
  };
  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
      <Icon size={20} className={`${colors[color]} mb-3`} />
      <div className="text-3xl font-black text-white">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function MatchCard({ match, showResult }) {
  const date = parseISO(match.date);
  return (
    <div className="py-3 border-b border-gray-800/60 last:border-0">
      <div className="text-xs text-gray-600 mb-2">{format(date, 'EEE d MMM · HH:mm', { locale: fr })}</div>
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
          <span className="text-sm font-medium text-white truncate text-right">{match.home_team_name}</span>
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: match.home_color }} />
        </div>
        {showResult ? (
          <div className="flex items-center gap-1 flex-shrink-0 bg-gray-800 rounded-lg px-3 py-1">
            <span className="text-base font-black text-white w-5 text-center">{match.home_score}</span>
            <span className="text-gray-600 text-xs mx-0.5">—</span>
            <span className="text-base font-black text-white w-5 text-center">{match.away_score}</span>
          </div>
        ) : (
          <div className="flex-shrink-0 text-xs text-gray-600 font-medium w-10 text-center">vs</div>
        )}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: match.away_color }} />
          <span className="text-sm text-gray-400 truncate">{match.away_team_name}</span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
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

  const { upcoming = [], recentResults = [], topScorers = [], standings = [], announcements = [], counts = {}, activeSeason } = data || {};
  const maxPoints = topScorers[0]?.points || 1;

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Ligue de Hockey</p>
          <h1 className="text-4xl font-black text-white">Tableau de bord</h1>
          <p className="text-gray-500 text-sm mt-2">{activeSeason?.name || 'Saison 2024-2025'}</p>
        </div>
        <Link to="/gamesheet" className="btn-primary hidden sm:flex mt-1">
          <FileText size={15} /> Feuille de match
        </Link>
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

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="space-y-2">
          {announcements.map(ann => (
            <div key={ann.id} className="flex items-start gap-3 p-4 rounded-2xl border border-gray-800 bg-gray-900">
              <MessageSquare size={16} className="text-gray-500 flex-shrink-0 mt-0.5" />
              <div>
                {ann.title && <div className="font-semibold text-white text-sm mb-0.5">{ann.title}</div>}
                <div className="text-sm text-gray-400">{ann.content}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Three columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Upcoming */}
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-gray-500" />
              <span className="text-sm font-semibold text-white">Prochains matchs</span>
            </div>
            <Link to="/gamesheet" className="text-xs text-gray-500 hover:text-white transition-colors">Feuille →</Link>
          </div>
          {upcoming.length === 0
            ? <p className="text-gray-600 text-sm py-4 text-center">Aucun match à venir</p>
            : upcoming.map(m => <MatchCard key={m.id} match={m} showResult={false} />)}
        </div>

        {/* Results */}
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle size={15} className="text-gray-500" />
              <span className="text-sm font-semibold text-white">Derniers résultats</span>
            </div>
            <Link to="/standings" className="text-xs text-gray-500 hover:text-white transition-colors">Classement →</Link>
          </div>
          {recentResults.length === 0
            ? <p className="text-gray-600 text-sm py-4 text-center">Aucun résultat</p>
            : recentResults.map(m => <MatchCard key={m.id} match={m} showResult={true} />)}
        </div>

        {/* Leaders */}
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-gray-500" />
              <span className="text-sm font-semibold text-white">Leaders</span>
            </div>
            <Link to="/stats" className="text-xs text-gray-500 hover:text-white transition-colors">Voir tout →</Link>
          </div>
          <div className="space-y-3">
            {topScorers.slice(0, 5).map((p, i) => (
              <Link to={`/players/${p.id}`} key={p.id} className="block group">
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="text-xs text-gray-600 w-4 text-right">{i + 1}</span>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.team_color }} />
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors flex-1 truncate">{p.first_name} {p.last_name}</span>
                  <span className="text-sm font-bold text-white">{p.points} <span className="text-gray-600 font-normal text-xs">pts</span></span>
                </div>
                <div className="ml-6 h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gray-500 rounded-full group-hover:bg-gray-400 transition-colors"
                    style={{ width: `${(p.points / maxPoints) * 100}%` }} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Standings */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Trophy size={15} className="text-gray-500" />
            <span className="text-sm font-semibold text-white">Classement</span>
          </div>
          <Link to="/standings" className="text-xs text-gray-500 hover:text-white transition-colors">Voir complet →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 px-5 text-xs text-gray-600 font-medium w-8">#</th>
                <th className="text-left py-3 text-xs text-gray-600 font-medium">Équipe</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-12">PJ</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-12">V</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-12">D</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-12">BF</th>
                <th className="text-center py-3 text-xs text-gray-600 font-medium w-12">BC</th>
                <th className="text-center py-3 pr-5 text-xs text-gray-500 font-semibold w-12">PTS</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.team_id} className="border-b border-gray-800/40 hover:bg-gray-800/30 transition-colors last:border-0">
                  <td className="py-3 px-5 text-gray-600 text-xs">{i + 1}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.team_color }} />
                      <Link to={`/teams/${s.team_id}`} className="text-gray-300 hover:text-white transition-colors font-medium">{s.team_name}</Link>
                    </div>
                  </td>
                  <td className="py-3 text-center text-gray-600 text-xs">{s.gp}</td>
                  <td className="py-3 text-center text-gray-300">{s.w}</td>
                  <td className="py-3 text-center text-gray-500">{s.l}</td>
                  <td className="py-3 text-center text-gray-500 text-xs">{s.gf}</td>
                  <td className="py-3 text-center text-gray-500 text-xs">{s.ga}</td>
                  <td className="py-3 pr-5 text-center font-black text-white">{s.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stat numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}   label="Joueurs actifs"  value={counts.players || 0}        color="blue" />
        <StatCard icon={Trophy}  label="Matchs joués"   value={counts.matches_played || 0}  color="green" />
        <StatCard icon={Target}  label="Buts marqués"   value={counts.goals_total || 0}     color="yellow" />
        <StatCard icon={Zap}     label="Équipes"         value={counts.teams || 0}            color="purple" />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/gamesheet', label: 'Feuille de match' },
          { to: '/draft',     label: 'Repêchage' },
          { to: '/players',   label: 'Joueurs' },
          { to: '/messages',  label: 'Messages' },
        ].map(item => (
          <Link key={item.to} to={item.to}
            className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-4 text-center text-sm font-medium text-gray-400 hover:text-white transition-all">
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
