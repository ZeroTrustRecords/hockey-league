import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Trophy, Users, Zap, FileText, Target, TrendingUp, Calendar, MessageSquare, CheckCircle, Star } from 'lucide-react';

function StatCard({ icon: Icon, label, value, color = 'blue' }) {
  const colors = { blue: 'bg-blue-600/20 text-blue-400', green: 'bg-emerald-600/20 text-emerald-400', yellow: 'bg-yellow-600/20 text-yellow-400', purple: 'bg-purple-600/20 text-purple-400' };
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]}`}>
        <Icon size={22} />
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-xs text-gray-400">{label}</div>
      </div>
    </div>
  );
}

function MatchCard({ match, showResult }) {
  const date = parseISO(match.date);
  const isHome = true;
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-colors">
      <div className="text-center min-w-[48px]">
        <div className="text-xs text-gray-500 uppercase">{format(date, 'EEE', { locale: fr })}</div>
        <div className="text-base font-bold text-white">{format(date, 'd MMM', { locale: fr })}</div>
        <div className="text-xs text-gray-500">{format(date, 'HH:mm')}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: match.home_color }} />
            <span className="text-sm text-white font-medium truncate">{match.home_team_name}</span>
          </div>
          {showResult ? (
            <span className="text-sm font-bold text-white px-2">{match.home_score}</span>
          ) : <span className="text-xs text-gray-500">vs</span>}
        </div>
        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: match.away_color }} />
            <span className="text-sm text-gray-300 truncate">{match.away_team_name}</span>
          </div>
          {showResult && <span className="text-sm font-bold text-white px-2">{match.away_score}</span>}
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
      <div className="text-gray-500 animate-pulse">Chargement du tableau de bord...</div>
    </div>
  );

  const { upcoming = [], recentResults = [], topScorers = [], standings = [], announcements = [], counts = {}, activeSeason } = data || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="text-gray-400 text-sm mt-0.5">Saison 2024-2025</p>
        </div>
        <div className="flex gap-2">
          <Link to="/gamesheet" className="btn-primary hidden sm:flex">
            <FileText size={16} /> Feuille de match
          </Link>
        </div>
      </div>

      {/* Champion banner */}
      {activeSeason?.status === 'completed' && activeSeason?.champion_name && (
        <Link to="/playoffs" className="block rounded-2xl border-2 text-center py-6 transition-opacity hover:opacity-90"
          style={{ borderColor: activeSeason.champion_color + '80', background: activeSeason.champion_color + '15' }}>
          <div className="text-3xl mb-1">🏆</div>
          <div className="text-xl font-black text-white">{activeSeason.champion_name}</div>
          <div className="text-sm text-gray-400">Champions {activeSeason.name}</div>
        </Link>
      )}

      {/* Playoffs in progress banner */}
      {activeSeason?.status === 'playoffs' && (
        <Link to="/playoffs" className="flex items-center gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/15 transition-colors">
          <Star size={20} className="text-yellow-400 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-semibold text-white text-sm">Séries éliminatoires en cours</div>
            <div className="text-xs text-gray-400">{activeSeason.name} · Cliquez pour voir le bracket</div>
          </div>
          <span className="text-yellow-400 text-xs font-bold">Voir →</span>
        </Link>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="space-y-2">
          {announcements.map(ann => (
            <div key={ann.id} className="flex items-start gap-3 p-4 bg-blue-600/10 border border-blue-500/20 rounded-xl">
              <MessageSquare size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                {ann.title && <div className="font-semibold text-white text-sm">{ann.title}</div>}
                <div className="text-sm text-gray-300 mt-0.5">{ann.content}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming matches */}
        <div className="card">
          <div className="card-header">
            <h2 className="section-title flex items-center gap-2"><Calendar size={16} className="text-blue-400" /> Prochains matchs</h2>
            <Link to="/gamesheet" className="text-xs text-blue-400 hover:text-blue-300">Feuille</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">Aucun match à venir</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map(m => <MatchCard key={m.id} match={m} showResult={false} />)}
            </div>
          )}
        </div>

        {/* Recent results */}
        <div className="card">
          <div className="card-header">
            <h2 className="section-title flex items-center gap-2"><CheckCircle size={16} className="text-emerald-400" /> Derniers résultats</h2>
            <Link to="/standings" className="text-xs text-blue-400 hover:text-blue-300">Classement</Link>
          </div>
          {recentResults.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">Aucun résultat</p>
          ) : (
            <div className="space-y-2">
              {recentResults.map(m => <MatchCard key={m.id} match={m} showResult={true} />)}
            </div>
          )}
        </div>

        {/* Leaders */}
        <div className="card">
          <div className="card-header">
            <h2 className="section-title flex items-center gap-2"><TrendingUp size={16} className="text-yellow-400" /> Leaders</h2>
            <Link to="/stats" className="text-xs text-blue-400 hover:text-blue-300">Stats complètes</Link>
          </div>
          <div className="space-y-2">
            {topScorers.slice(0, 5).map((p, i) => (
              <Link to={`/players/${p.id}`} key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 transition-colors">
                <span className="text-xs font-bold text-gray-500 w-4 text-center">{i + 1}</span>
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.team_color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white font-medium truncate">{p.first_name} {p.last_name}</div>
                  <div className="text-xs text-gray-500">{p.team_name}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-yellow-400">{p.points} pts</div>
                  <div className="text-xs text-gray-500">{p.goals}B {p.assists}A</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Quick standings */}
      <div className="card">
        <div className="card-header">
          <h2 className="section-title flex items-center gap-2"><Trophy size={16} className="text-yellow-400" /> Classement rapide</h2>
          <Link to="/standings" className="text-xs text-blue-400 hover:text-blue-300">Voir complet</Link>
        </div>
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="text-xs text-gray-500 uppercase">
                <th className="text-left py-2 font-medium">#</th>
                <th className="text-left py-2 font-medium">Équipe</th>
                <th className="text-center py-2 font-medium">PJ</th>
                <th className="text-center py-2 font-medium">V</th>
                <th className="text-center py-2 font-medium">D</th>
                <th className="text-center py-2 font-medium">BF</th>
                <th className="text-center py-2 font-medium">BC</th>
                <th className="text-center py-2 font-medium text-yellow-400">PTS</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.team_id} className="border-t border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="py-2.5 text-gray-500 font-medium">{i + 1}</td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.team_color }} />
                      <Link to={`/teams/${s.team_id}`} className="text-white hover:text-blue-400 font-medium transition-colors">{s.team_name}</Link>
                    </div>
                  </td>
                  <td className="py-2.5 text-center text-gray-400">{s.gp}</td>
                  <td className="py-2.5 text-center text-emerald-400">{s.w}</td>
                  <td className="py-2.5 text-center text-red-400">{s.l}</td>
                  <td className="py-2.5 text-center text-gray-300">{s.gf}</td>
                  <td className="py-2.5 text-center text-gray-300">{s.ga}</td>
                  <td className="py-2.5 text-center font-bold text-yellow-400">{s.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Joueurs actifs" value={counts.players || 0} color="blue" />
        <StatCard icon={Trophy} label="Matchs joués" value={counts.matches_played || 0} color="green" />
        <StatCard icon={Target} label="Buts marqués" value={counts.goals_total || 0} color="yellow" />
        <StatCard icon={Zap} label="Équipes" value={counts.teams || 0} color="purple" />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/gamesheet', icon: '📋', label: 'Nouvelle feuille', color: 'from-blue-600/20 to-blue-800/20 border-blue-700/30' },
          { to: '/draft', icon: '⚡', label: 'Repêchage', color: 'from-purple-600/20 to-purple-800/20 border-purple-700/30' },
          { to: '/players', icon: '👥', label: 'Joueurs', color: 'from-emerald-600/20 to-emerald-800/20 border-emerald-700/30' },
          { to: '/messages', icon: '💬', label: 'Messages', color: 'from-yellow-600/20 to-yellow-800/20 border-yellow-700/30' },
        ].map(item => (
          <Link key={item.to} to={item.to}
            className={`card bg-gradient-to-br ${item.color} hover:scale-[1.02] transition-transform text-center py-6`}>
            <div className="text-3xl mb-2">{item.icon}</div>
            <div className="text-sm font-medium text-white">{item.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
