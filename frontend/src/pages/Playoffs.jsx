import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Trophy, Plus, X, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Series Card ──────────────────────────────────────────────────────────────

function SeriesCard({ series, isAdmin, onAddGame }) {
  const isDone = series.status === 'completed';
  const isPending = series.status === 'pending' && !series.team1_id && !series.team2_id;

  const TeamRow = ({ name, color, wins, isWinner }) => (
    <div className={`flex items-center justify-between gap-2 transition-opacity ${isDone && !isWinner ? 'opacity-35' : ''}`}>
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color || '#6b7280' }} />
        <span className={`text-sm font-semibold truncate ${isWinner ? 'text-yellow-400' : 'text-white'}`}>
          {name || 'À déterminer'}
        </span>
        {isWinner && <Trophy size={11} className="text-yellow-400 flex-shrink-0" />}
      </div>
      <span className={`text-2xl font-black tabular-nums ${isWinner ? 'text-yellow-400' : 'text-gray-200'}`}>{wins}</span>
    </div>
  );

  return (
    <div className={`card space-y-3 ${isDone ? 'border border-yellow-500/25 bg-yellow-500/5' : ''}`}>
      <TeamRow
        name={series.team1_name} color={series.team1_color} wins={series.wins1}
        isWinner={isDone && series.winner_id === series.team1_id}
      />
      <div className="text-center text-[10px] text-gray-600 font-bold uppercase tracking-widest">
        meilleur des {series.best_of}
      </div>
      <TeamRow
        name={series.team2_name} color={series.team2_color} wins={series.wins2}
        isWinner={isDone && series.winner_id === series.team2_id}
      />

      {/* Games */}
      {series.games && series.games.length > 0 && (
        <div className="border-t border-gray-800 pt-2 space-y-1">
          {series.games.map((g, i) => (
            <Link key={g.id} to={`/gamesheet/${g.id}`}
              className="flex items-center justify-between text-xs text-gray-500 hover:text-white transition-colors px-1 py-0.5 rounded hover:bg-gray-800">
              <span>Partie {i + 1}</span>
              {g.validated
                ? <span className="font-bold text-white">{g.home_score}–{g.away_score}</span>
                : <span className="text-gray-600 italic">Planifié</span>}
            </Link>
          ))}
        </div>
      )}

      {/* Admin: add game */}
      {isAdmin && series.status === 'active' && (
        <button onClick={() => onAddGame(series)}
          className="w-full text-xs text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-500/60 rounded-lg py-1.5 transition-colors flex items-center justify-center gap-1">
          <Plus size={11} /> Planifier une partie
        </button>
      )}

      {isPending && (
        <div className="text-center text-xs text-gray-600 italic py-1">En attente</div>
      )}
    </div>
  );
}

// ─── Add Game Modal ───────────────────────────────────────────────────────────

function AddGameModal({ series, onClose, onSave }) {
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/playoffs/series/${series.id}/game`, { date });
      toast.success('Partie planifiée');
      onSave();
      onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
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
            <div className="text-xs text-gray-500 text-center">Série : {series.wins1} – {series.wins2}</div>
            <div>
              <label className="label">Date et heure *</label>
              <input type="datetime-local" className="input" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? '...' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Playoffs() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addGameSeries, setAddGameSeries] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      // /seasons/active returns the most relevant season:
      //   1. active/playoffs (in-progress), 2. most recently completed
      const season = (await api.get('/seasons/active')).data;
      if (!season) { setLoading(false); return; }
      const r = await api.get(`/playoffs/season/${season.id}`);
      setData(r.data);
    } catch (err) {
      // No playoff data yet
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-center py-12 text-gray-500 animate-pulse">Chargement...</div>;

  if (!data || !data.series?.length) {
    return (
      <div className="space-y-4">
        <h1 className="page-title">Séries éliminatoires</h1>
        <div className="card text-center py-16 text-gray-500">
          <Trophy size={40} className="mx-auto mb-3 opacity-20" />
          <p>Les séries éliminatoires n'ont pas encore commencé.</p>
          {isAdmin && <p className="text-xs mt-2">Démarrez-les depuis la page Administration.</p>}
        </div>
      </div>
    );
  }

  const { season, series } = data;
  const round1 = series.filter(s => s.round === 1);
  const round2 = series.filter(s => s.round === 2);
  const round3 = series.filter(s => s.round === 3);
  const champion = season.champion_team_id
    ? { id: season.champion_team_id, name: season.champion_name, color: season.champion_color }
    : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="page-title">Séries éliminatoires</h1>
        <p className="text-sm text-gray-400 mt-0.5">{season.name} · Meilleur des 3</p>
      </div>

      {/* Champion banner */}
      {champion && (
        <div className="rounded-2xl border-2 text-center py-10 space-y-2"
          style={{ borderColor: champion.color + '80', background: champion.color + '18' }}>
          <div className="text-5xl">🏆</div>
          <div className="text-3xl font-black text-white">{champion.name}</div>
          <div className="text-gray-400 text-sm font-medium">Champions {season.name}</div>
        </div>
      )}

      {/* Bracket */}
      <div className="grid grid-cols-1 lg:grid-cols-11 gap-3 items-center">

        {/* Round 1 — QF */}
        <div className="lg:col-span-3 space-y-3">
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Quarts de finale</div>
          {round1.map(s => (
            <SeriesCard key={s.id} series={s} isAdmin={isAdmin} onAddGame={setAddGameSeries} />
          ))}
        </div>

        {/* Arrow */}
        <div className="hidden lg:flex flex-col justify-around items-center h-full py-8 gap-4 text-gray-700">
          <ChevronRight size={18} />
          <ChevronRight size={18} />
        </div>

        {/* Round 2 — SF + bye */}
        <div className="lg:col-span-3 space-y-3">
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Demi-finale</div>

          {/* Bye card for seed 1 winner */}
          <div className="card border-dashed bg-transparent">
            <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2 text-center">Avance directement</div>
            {round1[0]?.winner_id ? (
              <div className="flex items-center gap-2 justify-center">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: round1[0].winner_color }} />
                <span className="text-sm font-semibold text-white">{round1[0].winner_name}</span>
              </div>
            ) : (
              <div className="text-center text-xs text-gray-600 italic">
                {round1[0]?.team1_name ? `Vainqueur: ${round1[0].team1_name} vs ${round1[0].team2_name}` : 'À déterminer'}
              </div>
            )}
          </div>

          {round2.map(s => (
            <SeriesCard key={s.id} series={s} isAdmin={isAdmin} onAddGame={setAddGameSeries} />
          ))}
        </div>

        {/* Arrow */}
        <div className="hidden lg:flex items-center justify-center text-gray-700">
          <ChevronRight size={18} />
        </div>

        {/* Round 3 — Final */}
        <div className="lg:col-span-3 space-y-3">
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Finale</div>
          {round3.map(s => (
            <SeriesCard key={s.id} series={s} isAdmin={isAdmin} onAddGame={setAddGameSeries} />
          ))}
        </div>
      </div>

      {addGameSeries && (
        <AddGameModal series={addGameSeries} onClose={() => setAddGameSeries(null)} onSave={load} />
      )}
    </div>
  );
}
