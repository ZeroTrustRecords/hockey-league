import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, Filter } from 'lucide-react';

function MatchRow({ match }) {
  const date = parseISO(match.date);
  const isDone = match.status === 'completed';
  const isPlayoff = !!match.is_playoff;

  return (
    <Link to={`/gamesheet/${match.id}`}
      className={`flex items-center gap-4 px-5 py-3.5 hover:bg-gray-800/30 transition-colors border-b last:border-0 group ${isPlayoff ? 'border-yellow-500/15 bg-yellow-500/3' : 'border-gray-800/40'}`}>
      {/* Date */}
      <div className="w-14 sm:w-20 flex-shrink-0">
        <div className="text-xs text-gray-500">{format(date, 'EEE', { locale: fr })}</div>
        <div className="text-sm font-semibold text-gray-300">{format(date, 'd MMM', { locale: fr })}</div>
        <div className="text-xs text-gray-600">{format(date, 'HH:mm')}</div>
      </div>

      {/* Home team */}
      <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
        <span className={`text-sm font-medium truncate text-right ${isDone && match.home_score > match.away_score ? 'text-white' : 'text-gray-400'}`}>
          {match.home_team_name}
        </span>
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: match.home_color }} />
      </div>

      {/* Score / VS */}
      {isDone ? (
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-3 py-1.5 flex-shrink-0 min-w-[72px] justify-center">
          <span className={`text-base font-black w-5 text-center ${match.home_score > match.away_score ? 'text-white' : 'text-gray-500'}`}>{match.home_score}</span>
          <span className="text-gray-700 text-xs mx-0.5">—</span>
          <span className={`text-base font-black w-5 text-center ${match.away_score > match.home_score ? 'text-white' : 'text-gray-500'}`}>{match.away_score}</span>
        </div>
      ) : (
        <div className="bg-gray-800/50 rounded-lg px-3 py-1.5 flex-shrink-0 min-w-[72px] text-center">
          <span className="text-xs text-gray-600 font-medium">vs</span>
        </div>
      )}

      {/* Away team */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: match.away_color }} />
        <span className={`text-sm font-medium truncate ${isDone && match.away_score > match.home_score ? 'text-white' : 'text-gray-400'}`}>
          {match.away_team_name}
        </span>
      </div>

      {/* Status badge */}
      <div className="flex-shrink-0 w-5 sm:w-24 text-right flex flex-col items-end gap-0.5">
        {isPlayoff && <span className="hidden sm:inline text-xs font-bold text-yellow-400">🏆 Éliminatoires</span>}
        {isDone
          ? <span className="hidden sm:inline text-xs text-gray-600">Terminé</span>
          : <span className="hidden sm:inline text-xs text-blue-500">À venir</span>}
      </div>
    </Link>
  );
}

export default function Schedule() {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTeam, setFilterTeam] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Pre-select team from URL param (e.g. /schedule?team=3)
    const teamParam = searchParams.get('team');
    if (teamParam) setFilterTeam(teamParam);
  }, []);

  useEffect(() => {
    api.get('/teams').then(r => setTeams(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (filterTeam) params.team_id = filterTeam;
    if (filterStatus) params.status = filterStatus;
    api.get('/matches', { params })
      .then(r => {
        // Sort: upcoming first (asc), then completed (desc)
        const sorted = [...r.data].sort((a, b) => {
          if (a.status === 'scheduled' && b.status !== 'scheduled') return -1;
          if (b.status === 'scheduled' && a.status !== 'scheduled') return 1;
          if (a.status === 'scheduled') return new Date(a.date) - new Date(b.date);
          return new Date(b.date) - new Date(a.date);
        });
        setMatches(sorted);
      })
      .finally(() => setLoading(false));
  }, [filterTeam, filterStatus]);

  // Group by month
  const grouped = matches.reduce((acc, m) => {
    const key = format(parseISO(m.date), 'MMMM yyyy', { locale: fr });
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  const selectedTeam = teams.find(t => String(t.id) === filterTeam);

  return (
    <div className="space-y-8 max-w-4xl">

      {/* Header */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Ligue de Hockey</p>
        <h1 className="text-2xl sm:text-4xl font-black text-white">Calendrier</h1>
        {selectedTeam && (
          <div className="flex items-center gap-2 mt-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedTeam.color }} />
            <span className="text-gray-400 text-sm">{selectedTeam.name}</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center flex-wrap">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Filter size={13} />
          <span>Filtrer par</span>
        </div>
        <select className="select w-full sm:w-48" value={filterTeam} onChange={e => setFilterTeam(e.target.value)}>
          <option value="">Toutes les équipes</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="select w-full sm:w-40" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Tous les matchs</option>
          <option value="scheduled">À venir</option>
          <option value="completed">Terminés</option>
        </select>
        {(filterTeam || filterStatus) && (
          <button onClick={() => { setFilterTeam(''); setFilterStatus(''); }}
            className="text-xs text-gray-500 hover:text-white transition-colors underline">
            Effacer
          </button>
        )}
        {!loading && (
          <span className="text-xs text-gray-600 sm:ml-auto">{matches.length} match{matches.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Matches grouped by month */}
      {loading ? (
        <div className="text-center py-12 text-gray-600 text-sm">Chargement...</div>
      ) : matches.length === 0 ? (
        <div className="text-center py-12 text-gray-600 text-sm">Aucun match trouvé</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([month, monthMatches]) => (
            <div key={month} className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
                <Calendar size={13} className="text-gray-600" />
                <span className="text-xs text-gray-500 font-medium uppercase tracking-widest capitalize">{month}</span>
                <span className="text-xs text-gray-700 ml-auto">{monthMatches.length} match{monthMatches.length !== 1 ? 's' : ''}</span>
              </div>
              {monthMatches.map(m => <MatchRow key={m.id} match={m} />)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
