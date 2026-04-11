import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Zap, RefreshCw, Settings, X, Play, Search, ChevronDown, ChevronRight, GripVertical, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeft } from 'lucide-react';

// ─── RATING HELPERS ───────────────────────────────────────────────────────────

const RATING_ORDER = { 'A+': 0, 'A': 1, 'B+': 2, 'B': 3, 'C': 4, 'D': 5 };

const RATING_STYLE = {
  'A+': { bg: 'bg-yellow-400/20', text: 'text-yellow-300', border: 'border-yellow-400/50' },
  'A':  { bg: 'bg-green-500/20',  text: 'text-green-300',  border: 'border-green-500/50'  },
  'B+': { bg: 'bg-sky-500/20',    text: 'text-sky-300',    border: 'border-sky-500/50'    },
  'B':  { bg: 'bg-blue-500/20',   text: 'text-blue-300',   border: 'border-blue-500/50'   },
  'C':  { bg: 'bg-gray-500/20',   text: 'text-gray-400',   border: 'border-gray-500/50'   },
  'D':  { bg: 'bg-red-900/20',    text: 'text-red-400',    border: 'border-red-800/50'    },
};

// ─── LINEUP STRUCTURE ────────────────────────────────────────────────────────

const OFFENSE_LINES = [
  [
    { id: 'lw1', pos: 'LW', section: 'offense', label: 'AG' },
    { id: 'c1',  pos: 'C',  section: 'offense', label: 'C'  },
    { id: 'rw1', pos: 'RW', section: 'offense', label: 'AD' },
  ],
  [
    { id: 'lw2', pos: 'LW', section: 'offense', label: 'AG' },
    { id: 'c2',  pos: 'C',  section: 'offense', label: 'C'  },
    { id: 'rw2', pos: 'RW', section: 'offense', label: 'AD' },
  ],
];

const DEFENSE_PAIRS = [
  [
    { id: 'd1l', pos: 'D', section: 'defense', label: 'D' },
    { id: 'd1r', pos: 'D', section: 'defense', label: 'D' },
  ],
  [
    { id: 'd2l', pos: 'D', section: 'defense', label: 'D' },
    { id: 'd2r', pos: 'D', section: 'defense', label: 'D' },
  ],
];

const GOALIE_SLOT = { id: 'g', pos: 'G', section: 'goalie', label: 'G' };

const ALL_SLOTS = [...OFFENSE_LINES.flat(), ...DEFENSE_PAIRS.flat(), GOALIE_SLOT];

function positionFits(playerPos, section) {
  if (section === 'goalie') return playerPos === 'G';  // only goalies in net
  return playerPos !== 'G';                            // skaters anywhere else
}

// ─── PLAYER CARD (draggable) ──────────────────────────────────────────────────

const POS_COLORS = {
  A:  { bg: 'bg-sky-500/20',   text: 'text-sky-300',   border: 'border-sky-500/40'  },
  D:  { bg: 'bg-rose-500/20',  text: 'text-rose-300',  border: 'border-rose-500/40' },
  G:  { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/40'},
};

function PlayerCard({ player, beingDragged, onDragStart, onDragEnd }) {
  const pc = POS_COLORS[player.position] || { bg: 'bg-gray-700', text: 'text-gray-300', border: 'border-gray-600' };

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('application/json', JSON.stringify(player));
        e.dataTransfer.effectAllowed = 'copy';
        onDragStart(player);
      }}
      onDragEnd={onDragEnd}
      className={`
        group flex items-center gap-2.5 p-2.5 rounded-xl border transition-all duration-100
        cursor-grab active:cursor-grabbing select-none
        ${beingDragged
          ? 'opacity-30 scale-95 border-gray-700 bg-gray-800/30'
          : 'border-gray-700/60 bg-gray-800/50 hover:bg-gray-800 hover:border-gray-600'
        }
      `}
    >
      <GripVertical size={12} className="text-gray-600 flex-shrink-0" />
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        style={{ backgroundColor: player.team_color || '#374151' }}
      >
        {player.first_name?.[0]}{player.last_name?.[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white leading-tight">
          {player.first_name} {player.last_name}
        </div>
        <div className="text-[10px] text-gray-500">{player.number ? `#${player.number}` : <span className="italic">sans numéro</span>}</div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className={`badge border text-[10px] font-bold ${pc.bg} ${pc.text} ${pc.border}`}>
          {player.position}
        </span>
        {player.status === 'inactive' && (
          <span className="badge border text-[10px] font-black bg-amber-500/15 text-amber-300 border-amber-500/30">
            Ancien
          </span>
        )}
        {player.rating && (() => {
          const rs = RATING_STYLE[player.rating] || RATING_STYLE['C'];
          return (
            <span className={`badge border text-[10px] font-black ${rs.bg} ${rs.text} ${rs.border}`}>
              {player.rating}
            </span>
          );
        })()}
      </div>
    </div>
  );
}

// ─── POSITION SLOT (droppable) ────────────────────────────────────────────────

function PositionSlot({ slot, player, isActive, dragging, isOver, onDragOver, onDrop, onDragLeave, onRemove }) {
  const fits   = dragging ? positionFits(dragging.position, slot.section) : false;
  const filled = !!player;

  const sectionStyle = {
    offense: { label: 'text-sky-400',    glow: 'shadow-sky-500/20'  },
    defense: { label: 'text-rose-400',   glow: 'shadow-rose-500/20' },
    goalie:  { label: 'text-amber-400',  glow: 'shadow-amber-500/20'},
  }[slot.section] || { label: 'text-gray-400', glow: '' };

  let borderCls, bgCls, scaleCls = '';

  if (filled) {
    borderCls = 'border-gray-600';
    bgCls = 'bg-gray-800/90';
  } else if (!isActive) {
    borderCls = 'border-dashed border-gray-800/50';
    bgCls = 'bg-transparent';
  } else if (isOver) {
    scaleCls = 'scale-[1.07]';
    borderCls = 'border-emerald-400';
    bgCls = `bg-emerald-500/15 shadow-lg ${sectionStyle.glow}`;
  } else if (dragging && fits) {
    borderCls = 'border-dashed border-emerald-500/60';
    bgCls = 'bg-emerald-500/5';
  } else if (dragging && !fits) {
    borderCls = 'border-dashed border-red-900/30';
    bgCls = 'bg-transparent opacity-40';
  } else {
    borderCls = 'border-dashed border-gray-600/50 hover:border-gray-500';
    bgCls = 'bg-gray-800/20';
  }

  return (
    <div
      onDragOver={e => {
        if (isActive && !filled && dragging && positionFits(dragging.position, slot.section)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          onDragOver();
        }
      }}
      onDrop={e => {
        if (!isActive || filled) return;
        e.preventDefault();
        try {
          const player = JSON.parse(e.dataTransfer.getData('application/json'));
          if (!positionFits(player.position, slot.section)) return;
          onDrop(player);
        } catch {}
      }}
      onDragLeave={onDragLeave}
      className={`
        relative flex w-full min-h-[96px] flex-col items-center justify-center rounded-2xl border-2
        px-2 py-3 transition-all duration-150 select-none sm:min-h-[108px]
        ${borderCls} ${bgCls} ${scaleCls}
        ${isActive && !filled ? 'cursor-copy' : ''}
      `}
    >
      {/* Position label */}
      <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${sectionStyle.label}`}>
        {slot.label}
      </span>

      {filled ? (
        <div className="group/slot w-full px-1 text-center">
          <div className="truncate text-[11px] font-bold leading-tight text-white sm:text-xs">{player.first_name}</div>
          <div className="truncate text-[11px] font-bold leading-tight text-white sm:text-xs">{player.last_name}</div>
          {player.number != null && (
            <div className="mt-1 text-[9px] text-gray-500">#{player.number}</div>
          )}
          {/* Remove button */}
          {isActive && (
            <button
              onClick={e => { e.stopPropagation(); onRemove(slot.id); }}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity hover:bg-red-400"
            >
              <X size={8} className="text-white" />
            </button>
          )}
        </div>
      ) : isOver ? (
        <div className="text-[10px] font-bold text-emerald-300">✓ Déposer</div>
      ) : isActive ? (
        <div className="mt-0.5 text-center text-[10px] text-gray-700">glisser ici</div>
      ) : null}
    </div>
  );
}

// ─── HOCKEY ALIGNMENT ────────────────────────────────────────────────────────

function HockeyAlignment({ team, lineup, isActive, dragging, dragOverSlot, onDragOver, onDrop, onDragLeave, onRemove, strength }) {
  if (!team) return (
    <div className="card text-center py-16 text-gray-600">Aucune équipe active</div>
  );

  const slotProps = slot => ({
    slot,
    player: lineup?.[slot.id] || null,
    isActive,
    dragging,
    isOver: dragOverSlot === slot.id,
    onDragOver: () => onDragOver(slot.id),
    onDrop: player => onDrop(slot.id, player),
    onDragLeave,
    onRemove,
  });

  const filledCount = ALL_SLOTS.filter(s => lineup?.[s.id]).length;

  return (
    <div
      className={`rounded-2xl border-2 transition-all duration-200 p-5 ${
        isActive ? 'shadow-xl' : 'border-gray-800'
      }`}
      style={isActive ? { borderColor: team.color + '70', boxShadow: `0 0 30px ${team.color}15` } : {}}
    >
      {/* Team header */}
      <div className="mb-5 flex flex-wrap items-start gap-3 xl:items-center">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: team.color + '25', border: `2px solid ${team.color}60` }}
        >
          <div className="w-5 h-5 rounded-full" style={{ backgroundColor: team.color }} />
        </div>
        <div>
          <h3 className="font-bold text-white text-lg leading-tight">{team.name}</h3>
          <p className="text-xs text-gray-500">{filledCount}/11 joueurs placés</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:ml-auto sm:justify-end">
          <span className={`badge border font-bold text-sm px-3 py-1 ${
            strength > 0
              ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
              : 'bg-gray-800 text-gray-600 border-gray-700'
          }`}>
            ⚡ {strength} pts
          </span>
          {isActive && (
            <span className="badge bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold animate-pulse">
              Tour actif
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-gray-800 rounded-full mb-5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${(filledCount / 11) * 100}%`, backgroundColor: team.color }}
        />
      </div>

      {/* ── OFFENSE ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-sky-400" />
          <span className="text-xs font-black text-sky-400 uppercase tracking-widest">Attaque</span>
        </div>
        <div className="space-y-3">
          {OFFENSE_LINES.map((line, li) => (
            <div key={li} className="grid gap-2 md:grid-cols-[64px_minmax(0,1fr)] md:items-center">
              <span className="text-[10px] font-medium text-gray-600 md:w-11 md:shrink-0">Trio {li + 1}</span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {line.map(slot => <PositionSlot key={slot.id} {...slotProps(slot)} />)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── DEFENSE ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-rose-400" />
          <span className="text-xs font-black text-rose-400 uppercase tracking-widest">Défense</span>
        </div>
        <div className="space-y-3">
          {DEFENSE_PAIRS.map((pair, pi) => (
            <div key={pi} className="grid gap-2 md:grid-cols-[64px_minmax(0,1fr)] md:items-center">
              <span className="text-[10px] font-medium text-gray-600 md:w-11 md:shrink-0">Paire {pi + 1}</span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:max-w-[420px]">
                {pair.map(slot => <PositionSlot key={slot.id} {...slotProps(slot)} />)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── GOALIE ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-xs font-black text-amber-400 uppercase tracking-widest">Gardien</span>
        </div>
        <div className="grid gap-2 md:grid-cols-[64px_minmax(0,1fr)] md:items-center">
          <span className="text-[10px] font-medium text-gray-600 md:w-11 md:shrink-0">Titulaire</span>
          <div className="max-w-[220px]">
            <PositionSlot {...slotProps(GOALIE_SLOT)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MINI ALIGNMENT (read-only overview) ─────────────────────────────────────

function MiniAlignment({ team, lineup, isActive, strength }) {
  const filledCount = ALL_SLOTS.filter(s => lineup?.[s.id]).length;

  return (
    <div
      className={`rounded-xl border-2 p-3 transition-all ${isActive ? 'shadow-md' : 'border-gray-800'}`}
      style={isActive ? { borderColor: team.color + '60' } : {}}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
        <span className="text-sm font-bold text-white truncate flex-1">{team.name}</span>
        {isActive && <span className="text-[9px] text-yellow-400 font-bold">⚡ ACTIF</span>}
        <span className="text-[10px] text-gray-500">{filledCount}/11</span>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
          strength > 0
            ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
            : 'bg-gray-800 text-gray-600 border-gray-700'
        }`}>
          ⚡{strength}
        </span>
      </div>
      <div className="w-full h-1 bg-gray-800 rounded-full mb-2">
        <div className="h-full rounded-full" style={{ width: `${(filledCount / 11) * 100}%`, backgroundColor: team.color }} />
      </div>
      {/* Mini slots grid */}
      <div className="space-y-1">
        {[
          { label: 'T1', slots: OFFENSE_LINES[0] },
          { label: 'T2', slots: OFFENSE_LINES[1] },
          { label: 'P1', slots: DEFENSE_PAIRS[0] },
          { label: 'P2', slots: DEFENSE_PAIRS[1] },
          { label: 'G',  slots: [GOALIE_SLOT] },
        ].map(({ label, slots }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="text-[8px] text-gray-700 w-4 font-medium">{label}</span>
            {slots.map(slot => {
              const player = lineup?.[slot.id];
              return (
                <div
                  key={slot.id}
                  className={`flex-1 h-5 rounded flex items-center justify-center text-[8px] font-bold transition-all ${
                    player ? 'bg-gray-700 text-gray-300' : 'bg-gray-800/50 text-gray-700 border border-dashed border-gray-800'
                  }`}
                  title={player ? `${player.first_name} ${player.last_name}` : slot.label}
                >
                  {player ? player.last_name.slice(0, 5) : slot.label}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── INIT MODAL ──────────────────────────────────────────────────────────────

function InitDraftModal({ teams, seasonId, onClose, onInit }) {
  const [form, setForm] = useState({
    total_rounds: 5,
    snake_mode: true,
    team_order: teams.map(t => t.id),
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const moveTeam = (i, dir) => {
    const arr = [...form.team_order];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    set('team_order', arr);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await api.post(`/draft/season/${seasonId}/init`, form);
      toast.success('Repêchage initialisé !');
      onInit();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="text-lg font-bold text-white">Configurer le repêchage</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Nombre de rondes</label>
                <input type="number" className="input" min="1" max="20"
                  value={form.total_rounds} onChange={e => set('total_rounds', parseInt(e.target.value))} />
              </div>
              <div>
                <label className="label">Mode</label>
                <select className="select" value={form.snake_mode ? '1' : '0'}
                  onChange={e => set('snake_mode', e.target.value === '1')}>
                  <option value="1">🐍 Serpent (recommandé)</option>
                  <option value="0">Standard</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Ordre de repêchage</label>
              <p className="text-xs text-gray-600 mb-2">Utilisez les flèches pour réordonner les équipes</p>
              <div className="space-y-1.5">
                {form.team_order.map((tid, i) => {
                  const team = teams.find(t => t.id === tid);
                  return (
                    <div key={tid} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-800 border border-gray-700">
                      <span className="text-gray-600 text-xs font-bold w-5 text-center">{i + 1}</span>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team?.color }} />
                      <span className="flex-1 text-white text-sm font-medium">{team?.name}</span>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => moveTeam(i, -1)}
                          className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors">↑</button>
                        <button type="button" onClick={() => moveTeam(i, 1)}
                          className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors">↓</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary"><Play size={15} /> Démarrer le repêchage</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function Draft() {
  const navigate = useNavigate();
  const { isAdmin, isCaptain, user } = useAuth();
  const [seasonId, setSeasonId]   = useState(null);
  const [data, setData]           = useState(null);
  const [teams, setTeams]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showInit, setShowInit]   = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Drag state
  const [draggedPlayer, setDraggedPlayer]   = useState(null);
  const [dragOverSlot, setDragOverSlot]     = useState(null);

  // Prevent double-picks during async API call
  const [picking, setPicking] = useState(false);

  // Lineups: { [teamId]: { [slotId]: playerObj } }
  const [lineups, setLineups] = useState({});
  const [allPlayers, setAllPlayers] = useState([]);

  // Build lineup slots from player team_id assignments
  const buildLineupsFromPlayers = (players) => {
    const byTeam = {};
    for (const p of players) {
      if (!p.team_id || p.status !== 'active') continue;
      if (!byTeam[p.team_id]) byTeam[p.team_id] = { A: [], D: [], G: [] };
      const grp = p.position === 'G' ? 'G' : p.position === 'D' ? 'D' : 'A';
      byTeam[p.team_id][grp].push(p);
    }
    const offSlots = OFFENSE_LINES.flat().map(s => s.id);
    const defSlots = DEFENSE_PAIRS.flat().map(s => s.id);
    const result = {};
    for (const [teamId, groups] of Object.entries(byTeam)) {
      const lineup = {};
      groups.A.forEach((p, i) => { if (offSlots[i]) lineup[offSlots[i]] = p; });
      groups.D.forEach((p, i) => { if (defSlots[i]) lineup[defSlots[i]] = p; });
      if (groups.G[0]) lineup[GOALIE_SLOT.id] = groups.G[0];
      result[parseInt(teamId)] = lineup;
    }
    return result;
  };

  // Player bank filters & sort
  const [search, setSearch]       = useState('');
  const [posFilter, setPosFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bankSort, setBankSort]   = useState({ field: 'rating', dir: 'asc' });

  // Draft history sort
  const [histSort, setHistSort] = useState({ field: 'pick_number', dir: 'asc' });

  // Which team to view (null = active drafting team)
  const [viewTeamId, setViewTeamId] = useState(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadData = async () => {
    try {
      const sr = await api.get('/seasons/active');
      if (!sr.data) { setLoading(false); return; }
      const sid = sr.data.id;
      setSeasonId(sid);

      const [dr, tr, pr] = await Promise.all([
        api.get(`/draft/season/${sid}`),
        api.get('/teams'),
        api.get('/players'),
      ]);
      setData(dr.data);
      setTeams(tr.data);
      setAllPlayers(pr.data);
      setLineups(buildLineupsFromPlayers(pr.data));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Clear drag state when switching team tabs
  useEffect(() => {
    setDraggedPlayer(null);
    setDragOverSlot(null);
  }, [viewTeamId]);

  // ── Derived values ────────────────────────────────────────────────────────

  const settings   = data?.settings;
  const allPicks   = data?.picks || [];
  // Available = unassigned players; admins can also browse inactive former players
  const available  = allPlayers.filter((p) => !p.team_id && (p.status === 'active' || (isAdmin && p.status === 'inactive')));
  const nextPick   = allPicks.find(p => !p.player_id && !p.picked_at);
  const activeTeam = nextPick ? teams.find(t => t.id === nextPick.team_id) : null;

  const isMyTurn = isCaptain && nextPick?.team_id === user?.team_id;
  // Admins can always interact; captains only on their formal draft turn
  const canInteract = isAdmin || (isCaptain && isMyTurn && settings?.status === 'active' && !viewTeamId);

  const displayTeam = viewTeamId
    ? teams.find(t => t.id === viewTeamId)
    : activeTeam;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDrop = async (slotId, player) => {
    setDragOverSlot(null);
    setDraggedPlayer(null);
    if (picking) return;

    const targetTeam = displayTeam || teams[0];
    if (!targetTeam) return;
    if (!isAdmin && !isMyTurn) { toast.error('Accès refusé'); return; }

    setPicking(true);
    try {
      // Formal draft pick: active draft, active team's turn, not in view mode
      if (settings?.status === 'active' && targetTeam.id === activeTeam?.id && !viewTeamId) {
        await api.post(`/draft/season/${seasonId}/pick`, { player_id: player.id });
        toast.success(`${player.first_name} ${player.last_name} → ${targetTeam.name}`, { icon: '🏒' });
      } else if (isAdmin) {
        // Direct assignment outside formal draft
        await api.patch(`/players/${player.id}/team`, { team_id: targetTeam.id });
        toast.success(`${player.first_name} ${player.last_name} → ${targetTeam.name}`);
      }
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors du placement');
    } finally {
      setPicking(false);
    }
  };

  const handleRemoveFromSlot = async (teamId, slotId) => {
    const player = lineups[teamId]?.[slotId];
    if (!player || !isAdmin) return;
    try {
      await api.patch(`/players/${player.id}/team`, { team_id: null });
      toast.success(`${player.first_name} ${player.last_name} retiré de l'équipe`);
      await loadData();
    } catch { toast.error('Erreur lors du retrait'); }
  };

  const handleReset = async () => {
    if (!confirm('Réinitialiser le repêchage complet ? Les joueurs seront désassignés des équipes.')) return;
    try {
      await api.post(`/draft/season/${seasonId}/reset`);
      toast.success('Repêchage réinitialisé');
      await loadData();
    } catch { toast.error('Erreur'); }
  };

  // ── Filtered + sorted player bank ─────────────────────────────────────────

  const toggleBankSort = field => setBankSort(s =>
    s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' }
  );
  const toggleHistSort = field => setHistSort(s =>
    s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' }
  );

  const sortPlayers = list => {
    const { field, dir } = bankSort;
    return [...list].sort((a, b) => {
      let av, bv;
      if (field === 'rating') { av = RATING_ORDER[a.rating] ?? 99; bv = RATING_ORDER[b.rating] ?? 99; }
      else if (field === 'name') { av = `${a.last_name} ${a.first_name}`; bv = `${b.last_name} ${b.first_name}`; }
      else if (field === 'position') { av = a.position; bv = b.position; }
      else if (field === 'number') { av = a.number ?? 999; bv = b.number ?? 999; }
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const filteredPlayers = available.filter(p => {
    const s = `${p.first_name} ${p.last_name}`.toLowerCase();
    return (!search || s.includes(search.toLowerCase()))
      && (!posFilter || p.position === posFilter)
      && (statusFilter === 'all' || p.status === statusFilter);
  });

  const groupedPlayers = {
    offense: sortPlayers(filteredPlayers.filter(p => p.position === 'A')),
    defense: sortPlayers(filteredPlayers.filter(p => p.position === 'D')),
    goalie:  sortPlayers(filteredPlayers.filter(p => p.position === 'G')),
  };

  // Team strength: sum of rating_score from the visual lineup (updates immediately on drop)
  const teamStrength = teams.reduce((acc, t) => {
    acc[t.id] = Object.values(lineups[t.id] || {})
      .filter(Boolean)
      .reduce((sum, p) => sum + (p.rating_score || 0), 0);
    return acc;
  }, {});

  const sortedHistory = [...allPicks].sort((a, b) => {
    const { field, dir } = histSort;
    let av, bv;
    if (field === 'round')        { av = a.round;        bv = b.round; }
    else if (field === 'pick_number') { av = a.pick_number; bv = b.pick_number; }
    else if (field === 'team')    { av = a.team_name;    bv = b.team_name; }
    else if (field === 'player')  { av = a.last_name || ''; bv = b.last_name || ''; }
    else if (field === 'position'){ av = a.position || ''; bv = b.position || ''; }
    else if (field === 'time')    { av = a.picked_at || ''; bv = b.picked_at || ''; }
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="fixed inset-0 bg-gray-950 flex items-center justify-center z-50">
      <div className="text-gray-500 animate-pulse text-sm">Chargement du repêchage...</div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col overflow-hidden">

      {/* ── Header bar ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="font-bold text-white text-base flex items-center gap-2">
              <span className="text-yellow-400">⚡</span> Repêchage
            </h1>
            <p className="text-xs text-gray-500">Glissez les joueurs dans l'alignement</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && settings && (
            <button onClick={handleReset} className="btn-danger py-1.5 text-sm"><RefreshCw size={14} /> Réinitialiser</button>
          )}
          {isAdmin && !settings && (
            <button onClick={() => setShowInit(true)} className="btn-primary"><Settings size={15} /> Configurer</button>
          )}
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">
      <div className="p-4 space-y-4">

      {/* ── No draft ── */}
      {!settings && !teams.some(t => lineups[t.id] && Object.values(lineups[t.id]).some(Boolean)) ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">⚡</div>
          <p className="text-xl font-bold text-gray-300 mb-2">Alignements vides</p>
          <p className="text-gray-600 text-sm mb-6">Importez un CSV dans Administration pour assigner les joueurs, ou configurez un repêchage formel</p>
          {isAdmin && (
            <button onClick={() => setShowInit(true)} className="btn-primary mx-auto">
              <Settings size={15} /> Configurer le repêchage
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── No formal draft / team management mode ── */}
          {!settings && isAdmin && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-center gap-3">
              <Settings size={16} className="text-blue-400 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">Mode gestion des équipes</div>
                <div className="text-xs text-gray-500">Glissez les joueurs de la banque vers un alignement pour les assigner. Cliquez × pour retirer un joueur.</div>
              </div>
              <button onClick={() => setShowInit(true)} className="btn-secondary py-1 text-xs flex-shrink-0">
                <Zap size={12} /> Repêchage formel
              </button>
            </div>
          )}

          {/* ── Status banner ── */}
          {settings?.status === 'active' && nextPick ? (
            <div
              className="rounded-xl border p-4 flex items-center gap-4 flex-wrap"
              style={{ borderColor: activeTeam?.color + '50', backgroundColor: activeTeam?.color + '08' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: activeTeam?.color + '25' }}>
                  <Zap size={20} style={{ color: activeTeam?.color }} />
                </div>
                <div>
                  <div className="text-base font-bold text-white">
                    Ronde {nextPick.round} · Choix #{nextPick.pick_number}
                  </div>
                  <div className="text-sm text-gray-400">
                    C'est au tour de <span className="font-bold text-white">{nextPick.team_name}</span> de choisir
                  </div>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-3 flex-wrap">
                {isMyTurn && (
                  <span className="badge bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 font-bold text-sm px-3 py-1 animate-pulse">
                    ⚡ C'est votre tour !
                  </span>
                )}
                <div className="text-xs text-gray-500">
                  {allPicks.filter(p => p.player_id).length} / {allPicks.length} choix effectués
                </div>
              </div>
            </div>
          ) : settings?.status === 'completed' ? (
            <div className="card border-emerald-500/20 bg-emerald-500/5 flex items-center gap-3 py-4">
              <span className="text-2xl">🏆</span>
              <div>
                <div className="font-bold text-emerald-400">Repêchage terminé !</div>
                <div className="text-xs text-gray-500">Tous les joueurs ont été repêchés</div>
              </div>
            </div>
          ) : null}

          {/* ── Main area ── */}
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">

            {/* ── Player Bank ── */}
            <div className="card xl:sticky xl:top-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="section-title">Banque de joueurs</h3>
                <span className="badge bg-gray-700 text-gray-400 text-xs">{filteredPlayers.length}</span>
              </div>

              {/* Filters */}
              <div className="space-y-2 mb-3">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    className="input pl-7 text-sm py-1.5"
                    placeholder="Rechercher un joueur..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex gap-1 flex-wrap">
                  {[['', 'Tous'], ['A', 'Att.'], ['D', 'Déf.'], ['G', 'Gard.']].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setPosFilter(val)}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                        posFilter === val ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {isAdmin && (
                  <div className="flex gap-1 flex-wrap">
                    {[['all', 'Tous'], ['active', 'Actifs'], ['inactive', 'Anciens']].map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setStatusFilter(val)}
                        className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                          statusFilter === val ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                {/* Sort controls */}
                <div className="flex items-center gap-1 pt-1 border-t border-gray-800">
                  <span className="text-[9px] text-gray-600 font-bold uppercase tracking-wider mr-1">Trier</span>
                  {[['rating', 'Cote'], ['name', 'Nom'], ['position', 'Pos'], ['number', '#']].map(([f, label]) => {
                    const active = bankSort.field === f;
                    const Icon = active ? (bankSort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                    return (
                      <button key={f} onClick={() => toggleBankSort(f)}
                        className={`flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                          active ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40' : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                        }`}>
                        {label}<Icon size={9} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Player list grouped by section */}
              <div className="max-h-[40vh] space-y-3 overflow-y-auto pr-1 xl:max-h-[65vh]">
                {filteredPlayers.length === 0 ? (
                  <div className="text-center py-8 text-gray-600 text-sm">
                    {available.length === 0
                      ? '✅ Tous les joueurs sont assignés à une équipe'
                      : 'Aucun joueur trouvé'}
                  </div>
                ) : (
                  <>
                    {[
                      { key: 'offense', label: 'Attaquants', color: 'text-sky-400' },
                      { key: 'defense', label: 'Défenseurs', color: 'text-rose-400' },
                      { key: 'goalie',  label: 'Gardiens',   color: 'text-amber-400' },
                    ].map(({ key, label, color }) =>
                      groupedPlayers[key].length > 0 ? (
                        <div key={key}>
                          <div className={`text-[9px] font-black uppercase tracking-widest mb-1.5 ${color}`}>
                            {label} ({groupedPlayers[key].length})
                          </div>
                          <div className="space-y-1">
                            {groupedPlayers[key].map(p => (
                              <PlayerCard
                                key={p.id}
                                player={p}
                                beingDragged={draggedPlayer?.id === p.id}
                                onDragStart={setDraggedPlayer}
                                onDragEnd={() => { setDraggedPlayer(null); setDragOverSlot(null); }}
                              />
                            ))}
                          </div>
                        </div>
                      ) : null
                    )}
                  </>
                )}
              </div>

              {/* Hint */}
              {(canInteract || isAdmin) && filteredPlayers.length > 0 && (
                <p className="text-[10px] text-gray-700 text-center mt-3 border-t border-gray-800 pt-3">
                  Glissez un joueur vers un poste dans l'alignement →
                </p>
              )}
            </div>

            {/* ── Right: alignment + team tabs ── */}
            <div className="min-w-0 space-y-4">
              {/* Team view tabs */}
              <div className="flex flex-wrap gap-1.5 xl:flex-nowrap xl:overflow-x-auto xl:pb-1">
                <button
                  onClick={() => setViewTeamId(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    !viewTeamId
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                      : 'bg-gray-800 text-gray-500 hover:text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Équipe active
                </button>
                {teams.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setViewTeamId(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      viewTeamId === t.id
                        ? 'text-white border'
                        : 'bg-gray-800 text-gray-500 hover:text-gray-300 hover:bg-gray-700'
                    }`}
                    style={viewTeamId === t.id
                      ? { backgroundColor: t.color + '25', borderColor: t.color + '60', color: '#fff' }
                      : {}
                    }
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                    {t.name.replace('Les ', '')}
                  </button>
                ))}
              </div>

              {/* Main alignment */}
              <div className="min-w-0">
                <HockeyAlignment
                  team={displayTeam || teams[0]}
                  lineup={lineups[(displayTeam || teams[0])?.id] || {}}
                  isActive={canInteract}
                  dragging={draggedPlayer}
                  dragOverSlot={dragOverSlot}
                  onDragOver={slotId => setDragOverSlot(slotId)}
                  onDrop={(slotId, player) => handleDrop(slotId, player)}
                  onDragLeave={() => setDragOverSlot(null)}
                  onRemove={slotId => handleRemoveFromSlot((displayTeam || teams[0])?.id, slotId)}
                  strength={teamStrength[(displayTeam || teams[0])?.id] || 0}
                />
              </div>

              {/* All teams overview */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-2 mt-1">Vue d'ensemble — Tous les alignements</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {teams.map(team => (
                    <MiniAlignment
                      key={team.id}
                      team={team}
                      lineup={lineups[team.id] || {}}
                      isActive={team.id === activeTeam?.id && settings?.status === 'active'}
                      strength={teamStrength[team.id] || 0}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Draft history (collapsible, only when formal draft exists) ── */}
          {settings && <div className="card">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center justify-between w-full text-left"
            >
              <h3 className="section-title flex items-center gap-2">
                Historique du repêchage
                <span className="badge bg-gray-700 text-gray-400 text-xs font-normal">
                  {allPicks.filter(p => p.player_id).length} choix
                </span>
              </h3>
              {showHistory
                ? <ChevronDown size={16} className="text-gray-400" />
                : <ChevronRight size={16} className="text-gray-400" />}
            </button>

            {showHistory && (
              <div className="mt-4 table-container">
                <table className="table">
                  <thead>
                    <tr>
                      {[
                        { field: 'round',       label: 'Ronde', cls: '' },
                        { field: 'pick_number', label: '#',     cls: '' },
                        { field: 'team',        label: 'Équipe',cls: '' },
                        { field: 'player',      label: 'Joueur',cls: '' },
                        { field: 'position',    label: 'Pos',   cls: 'hidden sm:table-cell' },
                        { field: 'time',        label: 'Heure', cls: 'hidden sm:table-cell' },
                      ].map(({ field, label, cls }) => {
                        const active = histSort.field === field;
                        const Icon = active ? (histSort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                        return (
                          <th key={field} className={`cursor-pointer select-none hover:text-white transition-colors ${cls}`}
                            onClick={() => toggleHistSort(field)}>
                            <span className="flex items-center gap-1">
                              {label}<Icon size={11} className={active ? 'text-blue-400' : 'text-gray-700'} />
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHistory.map(pick => (
                      <tr key={pick.id} className={nextPick?.id === pick.id ? 'bg-yellow-500/5' : ''}>
                        <td className="text-gray-500 font-medium">R{pick.round}</td>
                        <td className="text-gray-500">#{pick.pick_number}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: pick.team_color }} />
                            <span className="text-sm text-white">{pick.team_name}</span>
                          </div>
                        </td>
                        <td>
                          {pick.first_name ? (
                            <span className="font-semibold text-white">{pick.first_name} {pick.last_name}</span>
                          ) : nextPick?.id === pick.id ? (
                            <span className="text-yellow-400 text-sm animate-pulse font-medium">⚡ En cours...</span>
                          ) : (
                            <span className="text-gray-700">—</span>
                          )}
                        </td>
                        <td className="hidden sm:table-cell">
                          {pick.position ? <span className="position-badge">{pick.position}</span> : '—'}
                        </td>
                        <td className="text-gray-600 text-xs hidden sm:table-cell">
                          {pick.picked_at
                            ? new Date(pick.picked_at).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>}

        </div>
      )}

      {showInit && (
        <InitDraftModal
          teams={teams}
          seasonId={seasonId}
          onClose={() => setShowInit(false)}
          onInit={() => { setShowInit(false); loadData(); }}
        />
      )}

      </div>{/* /p-4 space-y-4 */}
      </div>{/* /flex-1 overflow-y-auto */}
    </div>
  );
}
