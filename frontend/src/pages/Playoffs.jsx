import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronRight, Plus, Trophy, X } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

function SeriesCard({ series, label, isAdmin, onAddGame }) {
  const isDone = series.status === 'completed';
  const isPending = series.status === 'pending';
  const isPreview = series.status === 'preview';

  const TeamRow = ({ name, color, wins, isWinner }) => (
    <div className={`flex items-center justify-between gap-2 ${isDone && !isWinner ? 'opacity-35' : ''}`}>
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color || '#6b7280' }} />
        <span className={`text-sm font-semibold truncate ${isWinner ? 'text-yellow-400' : 'text-white'}`}>
          {name || 'A determiner'}
        </span>
        {isWinner && <Trophy size={11} className="text-yellow-400 flex-shrink-0" />}
      </div>
      <span className={`text-xl font-black tabular-nums ${isWinner ? 'text-yellow-400' : 'text-gray-300'}`}>
        {isPreview ? '-' : wins}
      </span>
    </div>
  );

  return (
    <div className={`rounded-2xl p-4 border space-y-3 ${
      isDone
        ? 'border-yellow-500/30 bg-yellow-500/5'
        : isPreview
          ? 'border-blue-500/20 bg-blue-500/5'
          : isPending
            ? 'border-gray-800 bg-gray-900/50 opacity-60'
            : 'border-gray-700 bg-gray-900'
    }`}>
      {label && <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{label}</div>}

      <TeamRow
        name={series.team1_name}
        color={series.team1_color}
        wins={series.wins1}
        isWinner={isDone && series.winner_id === series.team1_id}
      />

      {series.best_of > 1 && (
        <div className="text-center text-[10px] text-gray-700 font-bold uppercase tracking-widest">
          Meilleur des {series.best_of}
        </div>
      )}

      <TeamRow
        name={series.team2_name}
        color={series.team2_color}
        wins={series.wins2}
        isWinner={isDone && series.winner_id === series.team2_id}
      />

      {series.games && series.games.length > 0 && (
        <div className="border-t border-gray-800/60 pt-2 space-y-1">
          {series.games.map((game, index) => (
            <Link
              key={game.id}
              to={`/gamesheet/${game.id}`}
              className="flex items-center justify-between text-xs text-gray-500 hover:text-white transition-colors px-1 py-1 rounded hover:bg-gray-800"
            >
              <span>Partie {index + 1}</span>
              {game.validated ? (
                <span className="font-bold text-gray-300">{game.home_score}-{game.away_score}</span>
              ) : (
                <span className="text-gray-700 italic">Planifiee</span>
              )}
            </Link>
          ))}
        </div>
      )}

      {isPreview && (
        <div className="text-center text-xs text-blue-300/80 border border-blue-500/20 bg-blue-500/5 rounded-lg py-2">
          Apercu public du tableau avant le lancement officiel
        </div>
      )}

      {isAdmin && series.status === 'active' && series.best_of > 1 && (
        <button
          onClick={() => onAddGame(series)}
          className="w-full text-xs text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded-lg py-1.5 transition-colors flex items-center justify-center gap-1"
        >
          <Plus size={11} /> Ajouter une partie
        </button>
      )}

      {isPending && !series.team1_id && !series.team2_id && (
        <div className="text-center text-xs text-gray-700 italic">En attente du tour precedent</div>
      )}
    </div>
  );
}

function Arrow() {
  return <ChevronRight size={16} className="text-gray-700 flex-shrink-0" />;
}

function AddGameModal({ series, onClose, onSave }) {
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post(`/playoffs/series/${series.id}/game`, { date });
      toast.success('Partie planifiee');
      onSave();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="text-base font-bold text-white">Planifier une partie</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: series.team1_color }} />
              <span className="text-sm text-white font-medium">{series.team1_name}</span>
              <span className="text-gray-500 text-sm mx-auto">vs</span>
              <span className="text-sm text-white font-medium">{series.team2_name}</span>
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: series.team2_color }} />
            </div>
            <div>
              <label className="label">Date et heure *</label>
              <input type="datetime-local" className="input" value={date} onChange={(event) => setDate(event.target.value)} required />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? '...' : 'Creer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Playoffs() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addGameSeries, setAddGameSeries] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const season = (await api.get('/seasons/active')).data;
      if (!season) {
        setData(null);
        setLoading(false);
        return;
      }
      const response = await api.get(`/playoffs/season/${season.id}`);
      setData(response.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div className="text-center py-12 text-gray-500 animate-pulse">Chargement...</div>;

  if (!data || !data.series?.length) {
    return (
      <div className="space-y-4 max-w-5xl">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Grande course de fin de saison</p>
          <h1 className="text-3xl sm:text-5xl font-black text-white">Eliminatoires</h1>
        </div>
        <div className="card text-center py-16 text-gray-500">
          <Trophy size={40} className="mx-auto mb-3 opacity-20" />
          <p>Le tableau eliminatoire n'est pas encore disponible.</p>
          {isAdmin && <p className="text-xs mt-2">Le lancement officiel se fait depuis la page Administration.</p>}
        </div>
      </div>
    );
  }

  const { season, series, is_preview, playoffs_coming_soon } = data;
  const byRound = {};
  for (const currentSeries of series) {
    if (!byRound[currentSeries.round]) byRound[currentSeries.round] = {};
    byRound[currentSeries.round][currentSeries.series_number] = currentSeries;
  }

  const m1 = byRound[1]?.[1];
  const m2 = byRound[1]?.[2];
  const m3 = byRound[1]?.[3];
  const m4 = byRound[2]?.[1];
  const m5 = byRound[2]?.[2];
  const m6 = byRound[3]?.[1];
  const m7 = byRound[3]?.[2];
  const finale = byRound[4]?.[1];

  const champion = season.champion_team_id ? { name: season.champion_name, color: season.champion_color } : null;
  const completedSeries = series.filter((currentSeries) => currentSeries.status === 'completed').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Le tournoi de la ligue</p>
          <h1 className="text-3xl sm:text-5xl font-black text-white">Eliminatoires</h1>
          <p className="text-gray-400 text-sm sm:text-base mt-2">
            {season.name} · {completedSeries} serie{completedSeries > 1 ? 's' : ''} completee{completedSeries > 1 ? 's' : ''}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 px-4 py-3 min-w-[120px]">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-600">Series</div>
            <div className="text-2xl font-black text-white">{series.length}</div>
          </div>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 px-4 py-3 min-w-[120px]">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-600">Champion</div>
            <div className="text-lg font-black text-white truncate">{champion?.name || 'A venir'}</div>
          </div>
        </div>
      </div>

      {is_preview && playoffs_coming_soon && (
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 px-5 py-4">
          <div className="text-sm font-semibold text-white mb-1">Les eliminatoires arrivent bientot</div>
          <p className="text-sm text-gray-400">
            Le classement final est connu. Le tableau ci-dessous montre l'affiche des series avant le lancement officiel.
          </p>
        </div>
      )}

      {champion && (
        <div
          className="rounded-3xl border-2 text-center py-8 sm:py-10 space-y-2"
          style={{ borderColor: `${champion.color}80`, background: `${champion.color}18` }}
        >
          <div className="text-5xl">🏆</div>
          <div className="text-3xl font-black text-white">{champion.name}</div>
          <div className="text-gray-400 text-sm font-medium">Champions {season.name}</div>
        </div>
      )}

      <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-5 sm:p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Tableau eliminatoire</h2>
            <p className="text-sm text-gray-500 mt-1">Le chemin complet vers la finale, de semaine en semaine.</p>
          </div>
          <div className="text-xs text-gray-500">G = gagnant · P = perdant</div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-4 xl:gap-2 items-start">
          <div className="space-y-3">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center mb-1">Semaine 1</div>
            {m1 && <SeriesCard series={m1} label="Match 1 · 1er vs 2e" isAdmin={isAdmin && !is_preview} onAddGame={setAddGameSeries} />}
            {m2 && <SeriesCard series={m2} label="Match 2 · 3e vs 6e" isAdmin={isAdmin && !is_preview} onAddGame={setAddGameSeries} />}
            {m3 && <SeriesCard series={m3} label="Match 3 · 4e vs 5e" isAdmin={isAdmin && !is_preview} onAddGame={setAddGameSeries} />}
          </div>

          <div className="hidden xl:flex flex-col justify-around items-center h-full pt-10 gap-6">
            <Arrow /><Arrow /><Arrow />
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center mb-1">Semaine 2</div>
            {m4 && <SeriesCard series={m4} label="Match 4 · G2 vs P3" isAdmin={isAdmin && !is_preview} onAddGame={setAddGameSeries} />}
            {m5 && <SeriesCard series={m5} label="Match 5 · P2 vs G3" isAdmin={isAdmin && !is_preview} onAddGame={setAddGameSeries} />}
          </div>

          <div className="hidden xl:flex flex-col justify-around items-center h-full pt-10 gap-6">
            <Arrow /><Arrow />
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center mb-1">Demi-finales</div>
            {m6 && <SeriesCard series={m6} label="Match 6 · G1 vs G5" isAdmin={isAdmin && !is_preview} onAddGame={setAddGameSeries} />}
            {m7 && <SeriesCard series={m7} label="Match 7 · P1 vs G4" isAdmin={isAdmin && !is_preview} onAddGame={setAddGameSeries} />}
          </div>

          <div className="hidden xl:flex items-center justify-center pt-10">
            <Arrow />
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-black text-yellow-600 uppercase tracking-widest text-center mb-1">Finale</div>
            {finale && <SeriesCard series={finale} label="Finale · G6 vs G7" isAdmin={isAdmin && !is_preview} onAddGame={setAddGameSeries} />}
          </div>
        </div>
      </div>

      {addGameSeries && !is_preview && (
        <AddGameModal series={addGameSeries} onClose={() => setAddGameSeries(null)} onSave={load} />
      )}
    </div>
  );
}
