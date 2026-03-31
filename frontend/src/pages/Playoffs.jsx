import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Trophy, Plus, X, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Series Card ──────────────────────────────────────────────────────────────

function SeriesCard({ series, label, isAdmin, onAddGame }) {
  const isDone    = series.status === 'completed';
  const isPending = series.status === 'pending';

  const TeamRow = ({ name, color, wins, isWinner }) => (
    <div className={`flex items-center justify-between gap-2 ${isDone && !isWinner ? 'opacity-35' : ''}`}>
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color || '#6b7280' }} />
        <span className={`text-xs font-semibold truncate ${isWinner ? 'text-yellow-400' : 'text-white'}`}>
          {name || 'À déterminer'}
        </span>
        {isWinner && <Trophy size={10} className="text-yellow-400 flex-shrink-0" />}
      </div>
      <span className={`text-lg font-black tabular-nums ${isWinner ? 'text-yellow-400' : 'text-gray-300'}`}>{wins}</span>
    </div>
  );

  return (
    <div className={`rounded-xl p-3 border space-y-2 ${
      isDone  ? 'border-yellow-500/30 bg-yellow-500/5' :
      isPending ? 'border-gray-800 bg-gray-900/50 opacity-60' :
                  'border-gray-700 bg-gray-900'
    }`}>
      {label && (
        <div className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{label}</div>
      )}
      <TeamRow
        name={series.team1_name} color={series.team1_color} wins={series.wins1}
        isWinner={isDone && series.winner_id === series.team1_id}
      />
      {series.best_of > 1 && (
        <div className="text-center text-[9px] text-gray-700 font-bold uppercase tracking-widest">
          meilleur des {series.best_of}
        </div>
      )}
      <TeamRow
        name={series.team2_name} color={series.team2_color} wins={series.wins2}
        isWinner={isDone && series.winner_id === series.team2_id}
      />

      {/* Games list */}
      {series.games && series.games.length > 0 && (
        <div className="border-t border-gray-800/60 pt-1.5 space-y-0.5">
          {series.games.map((g, i) => (
            <Link key={g.id} to={`/gamesheet/${g.id}`}
              className="flex items-center justify-between text-[10px] text-gray-600 hover:text-white transition-colors px-1 py-0.5 rounded hover:bg-gray-800">
              <span>Partie {i + 1}</span>
              {g.validated
                ? <span className="font-bold text-gray-300">{g.home_score}–{g.away_score}</span>
                : <span className="text-gray-700 italic">Planifié</span>}
            </Link>
          ))}
        </div>
      )}

      {/* Admin: add game (only for multi-game series like the Final) */}
      {isAdmin && series.status === 'active' && series.best_of > 1 && (
        <button onClick={() => onAddGame(series)}
          className="w-full text-[10px] text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded-lg py-1 transition-colors flex items-center justify-center gap-1">
          <Plus size={10} /> Planifier une partie
        </button>
      )}

      {isPending && !series.team1_id && !series.team2_id && (
        <div className="text-center text-[10px] text-gray-700 italic">En attente</div>
      )}
    </div>
  );
}

// ─── Connector Arrow ──────────────────────────────────────────────────────────

function Arrow() {
  return <ChevronRight size={14} className="text-gray-700 flex-shrink-0" />;
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
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [addGameSeries, setAddGameSeries] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const season = (await api.get('/seasons/active')).data;
      if (!season) { setLoading(false); return; }
      const r = await api.get(`/playoffs/season/${season.id}`);
      setData(r.data);
    } catch { } finally { setLoading(false); }
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

  // Map series by round + series_number for easy lookup
  const byRound = {};
  for (const s of series) {
    if (!byRound[s.round]) byRound[s.round] = {};
    byRound[s.round][s.series_number] = s;
  }

  const m1 = byRound[1]?.[1]; // 1er vs 2e
  const m2 = byRound[1]?.[2]; // 3e vs 6e
  const m3 = byRound[1]?.[3]; // 4e vs 5e
  const m4 = byRound[2]?.[1]; // G2 vs P3
  const m5 = byRound[2]?.[2]; // P2 vs G3
  const m6 = byRound[3]?.[1]; // SF-A: G1 vs G5
  const m7 = byRound[3]?.[2]; // SF-B: P1 vs G4
  const mf = byRound[4]?.[1]; // Finale

  const champion = season.champion_team_id
    ? { name: season.champion_name, color: season.champion_color }
    : null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="page-title">Séries éliminatoires</h1>
        <p className="text-sm text-gray-400 mt-0.5">{season.name}</p>
      </div>

      {/* Champion banner */}
      {champion && (
        <div className="rounded-2xl border-2 text-center py-6 sm:py-10 space-y-2"
          style={{ borderColor: champion.color + '80', background: champion.color + '18' }}>
          <div className="text-5xl">🏆</div>
          <div className="text-3xl font-black text-white">{champion.name}</div>
          <div className="text-gray-400 text-sm font-medium">Champions {season.name}</div>
        </div>
      )}

      {/*
        ┌─────────────┐   ┌──────────────┐   ┌───────────────┐   ┌────────┐
        │  Semaine 1  │   │  Semaine 2   │   │   Demi-fin.   │   │ FINALE │
        │  M1: 1v2    │──►│              │──►│ M6: G1 vs G5  │──►│        │
        │  M2: 3v6    │──►│ M4: G2 vs P3 │──►│ M7: P1 vs G4  │──►│        │
        │  M3: 4v5    │──►│ M5: P2 vs G3 │   │               │   │        │
        └─────────────┘   └──────────────┘   └───────────────┘   └────────┘
      */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-4 xl:gap-2 items-start">

        {/* ── Col 1: Semaine 1 ── */}
        <div className="space-y-2">
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center mb-3 border-b border-gray-800 pb-2 xl:border-0 xl:pb-0">
            Semaine 1
          </div>
          {m1 && <SeriesCard series={m1} label="Match 1 · 1er vs 2e"  isAdmin={isAdmin} onAddGame={setAddGameSeries} />}
          {m2 && <SeriesCard series={m2} label="Match 2 · 3e vs 6e"  isAdmin={isAdmin} onAddGame={setAddGameSeries} />}
          {m3 && <SeriesCard series={m3} label="Match 3 · 4e vs 5e"  isAdmin={isAdmin} onAddGame={setAddGameSeries} />}
        </div>

        {/* Arrow */}
        <div className="hidden xl:flex flex-col justify-around items-center h-full pt-10 gap-6">
          <Arrow /><Arrow /><Arrow />
        </div>

        {/* ── Col 2: Semaine 2 — croisements ── */}
        <div className="space-y-2">
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center mb-3 border-b border-gray-800 pb-2 xl:border-0 xl:pb-0">
            Semaine 2
          </div>
          {m4 && <SeriesCard series={m4} label="Match 4 · G2 vs P3"  isAdmin={isAdmin} onAddGame={setAddGameSeries} />}
          {m5 && <SeriesCard series={m5} label="Match 5 · P2 vs G3"  isAdmin={isAdmin} onAddGame={setAddGameSeries} />}
        </div>

        {/* Arrow */}
        <div className="hidden xl:flex flex-col justify-around items-center h-full pt-10 gap-6">
          <Arrow /><Arrow />
        </div>

        {/* ── Col 3: Demi-finales ── */}
        <div className="space-y-2">
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center mb-3 border-b border-gray-800 pb-2 xl:border-0 xl:pb-0">
            Demi-finales
          </div>
          {m6 && <SeriesCard series={m6} label="Match 6 · G1 vs G5"  isAdmin={isAdmin} onAddGame={setAddGameSeries} />}
          {m7 && <SeriesCard series={m7} label="Match 7 · P1 vs G4"  isAdmin={isAdmin} onAddGame={setAddGameSeries} />}
        </div>

        {/* Arrow */}
        <div className="hidden xl:flex items-center justify-center pt-10">
          <Arrow />
        </div>

        {/* ── Col 4: Finale ── */}
        <div className="space-y-2">
          <div className="text-[10px] font-black text-yellow-600 uppercase tracking-widest text-center mb-3 border-b border-yellow-600/30 pb-2 xl:border-0 xl:pb-0">
            🏆 Finale
          </div>
          {mf && (
            <SeriesCard
              series={mf}
              label={`Finale · G6 vs G7`}
              isAdmin={isAdmin}
              onAddGame={setAddGameSeries}
            />
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="text-xs text-gray-700 space-y-0.5">
        <p>G = Gagnant · P = Perdant · Les losers de M4 et M5 sont éliminés</p>
      </div>

      {addGameSeries && (
        <AddGameModal series={addGameSeries} onClose={() => setAddGameSeries(null)} onSave={load} />
      )}
    </div>
  );
}
