import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, Filter, MapPin } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

function MatchRow({ match, canOpenGameSheet }) {
  const date = parseISO(match.date);
  const isDone = match.status === 'completed';
  const isPlayoff = Boolean(match.is_playoff);
  const content = (
    <div className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-800/30 transition-colors border-b last:border-0 group ${isPlayoff ? 'border-yellow-500/15 bg-yellow-500/3' : 'border-gray-800/40'}`}>
      <div className="w-20 sm:w-28 flex-shrink-0">
        <div className="text-xs text-gray-500">{format(date, 'EEE', { locale: fr })}</div>
        <div className="text-sm font-semibold text-gray-300">{format(date, 'd MMM', { locale: fr })}</div>
        <div className="inline-flex items-center mt-2 px-2.5 py-1 rounded-full bg-blue-500/12 border border-blue-500/20 text-sm font-black text-blue-300 tracking-wide">
          {format(date, 'HH:mm')}
        </div>
      </div>

      <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
        <span className={`text-sm font-medium truncate text-right ${isDone && match.home_score > match.away_score ? 'text-white' : 'text-gray-400'}`}>
          {match.home_team_name}
        </span>
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: match.home_color }} />
      </div>

      {isDone ? (
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-3 py-1.5 flex-shrink-0 min-w-[78px] justify-center">
          <span className={`text-base font-black w-5 text-center ${match.home_score > match.away_score ? 'text-white' : 'text-gray-500'}`}>{match.home_score}</span>
          <span className="text-gray-700 text-xs mx-0.5">-</span>
          <span className={`text-base font-black w-5 text-center ${match.away_score > match.home_score ? 'text-white' : 'text-gray-500'}`}>{match.away_score}</span>
        </div>
      ) : (
        <div className="bg-gray-800/50 rounded-lg px-3 py-1.5 flex-shrink-0 min-w-[78px] text-center">
          <span className="text-xs text-gray-600 font-medium">vs</span>
        </div>
      )}

      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: match.away_color }} />
        <span className={`text-sm font-medium truncate ${isDone && match.away_score > match.home_score ? 'text-white' : 'text-gray-400'}`}>
          {match.away_team_name}
        </span>
      </div>

      <div className="hidden lg:flex flex-col items-end gap-1 min-w-[170px]">
        {isPlayoff && <span className="text-xs font-bold text-yellow-400">Éliminatoires</span>}
        {match.location && (
          <span className="text-sm text-gray-400 flex items-center gap-1.5 text-right">
            <MapPin size={11} />
            {match.location}
          </span>
        )}
      </div>

      <div className="hidden sm:block text-xs font-medium flex-shrink-0 min-w-[70px] text-right">
        {isDone ? <span className="text-gray-600">Terminé</span> : <span className="text-blue-400">À venir</span>}
      </div>
    </div>
  );

  if (!canOpenGameSheet) return content;

  return (
    <Link to={`/gamesheet/${match.id}`} className="block">
      {content}
    </Link>
  );
}

export default function Schedule() {
  const { isAdmin, isMarqueur } = useAuth();
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTeam, setFilterTeam] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const teamParam = searchParams.get('team');
    if (teamParam) setFilterTeam(teamParam);
  }, [searchParams]);

  useEffect(() => {
    api.get('/teams').then((response) => setTeams(response.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (filterTeam) params.team_id = filterTeam;
    if (filterStatus) params.status = filterStatus;

    api.get('/matches', { params }).then((response) => {
      const sorted = [...response.data].sort((a, b) => {
        if (a.status === 'scheduled' && b.status !== 'scheduled') return -1;
        if (b.status === 'scheduled' && a.status !== 'scheduled') return 1;
        if (a.status === 'scheduled') return new Date(a.date) - new Date(b.date);
        return new Date(b.date) - new Date(a.date);
      });
      setMatches(sorted);
    }).finally(() => setLoading(false));
  }, [filterTeam, filterStatus]);

  const grouped = useMemo(() => matches.reduce((accumulator, match) => {
    const key = format(parseISO(match.date), 'MMMM yyyy', { locale: fr });
    if (!accumulator[key]) accumulator[key] = [];
    accumulator[key].push(match);
    return accumulator;
  }, {}), [matches]);

  const selectedTeam = teams.find((team) => String(team.id) === filterTeam);
  const upcomingCount = matches.filter((match) => match.status === 'scheduled').length;
  const completedCount = matches.filter((match) => match.status === 'completed').length;

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Rythme de la ligue</p>
        <h1 className="text-3xl sm:text-5xl font-black text-white">Calendrier</h1>
        <p className="text-gray-400 text-sm sm:text-base mt-2 max-w-2xl">
          Tous les rendez-vous de la saison, les résultats déjà tombés et les prochaines affiches à surveiller.
        </p>
        {selectedTeam && (
          <div className="flex items-center gap-2 mt-3">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedTeam.color }} />
            <span className="text-sm text-gray-400">{selectedTeam.name}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gray-600 mb-2">Total</div>
          <div className="text-2xl font-black text-white">{matches.length}</div>
          <div className="text-xs text-gray-500 mt-1">Matchs affichés après filtres</div>
        </div>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gray-600 mb-2">À venir</div>
          <div className="text-2xl font-black text-white">{upcomingCount}</div>
          <div className="text-xs text-gray-500 mt-1">Rencontres encore à jouer</div>
        </div>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gray-600 mb-2">Terminés</div>
          <div className="text-2xl font-black text-white">{completedCount}</div>
          <div className="text-xs text-gray-500 mt-1">Résultats déjà validés</div>
        </div>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gray-600 mb-2">Accès feuille</div>
          <div className="text-lg font-black text-white">{isAdmin || isMarqueur ? 'Ouvert' : 'Public'}</div>
          <div className="text-xs text-gray-500 mt-1">{isAdmin || isMarqueur ? 'Les matchs ouvrent la feuille de match' : 'Affichage lecture seule pour le public'}</div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center flex-wrap">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Filter size={13} />
            <span>Filtrer</span>
          </div>
          <select className="select w-full sm:w-48" value={filterTeam} onChange={(event) => setFilterTeam(event.target.value)}>
            <option value="">Toutes les équipes</option>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
          <select className="select w-full sm:w-40" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
            <option value="">Tous les matchs</option>
            <option value="scheduled">À venir</option>
            <option value="completed">Terminés</option>
          </select>
          {(filterTeam || filterStatus) && (
            <button onClick={() => { setFilterTeam(''); setFilterStatus(''); }} className="text-xs text-gray-500 hover:text-white transition-colors underline">
              Effacer les filtres
            </button>
          )}
        </div>

        {!loading && <span className="text-xs text-gray-600">{matches.length} match{matches.length !== 1 ? 's' : ''} trouvé{matches.length !== 1 ? 's' : ''}</span>}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-600 text-sm">Chargement...</div>
      ) : matches.length === 0 ? (
        <div className="text-center py-12 text-gray-600 text-sm">Aucun match trouvé avec ces filtres.</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([month, monthMatches]) => (
            <div key={month} className="bg-gray-900 rounded-3xl border border-gray-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
                <Calendar size={13} className="text-gray-600" />
                <span className="text-xs text-gray-500 font-medium uppercase tracking-widest capitalize">{month}</span>
                <span className="text-xs text-gray-700 ml-auto">{monthMatches.length} match{monthMatches.length !== 1 ? 's' : ''}</span>
              </div>
              {monthMatches.map((match) => (
                <MatchRow key={match.id} match={match} canOpenGameSheet={isAdmin || isMarqueur} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
