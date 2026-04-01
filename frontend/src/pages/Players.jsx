import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Edit2, Eye, Filter, Search, Trash2, UserPlus, X } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const POSITIONS = ['C', 'LW', 'RW', 'D', 'G'];
const positionLabel = {
  C: 'Centre',
  LW: 'Ailier G',
  RW: 'Ailier D',
  D: 'Défenseur',
  G: 'Gardien',
};

function PlayerModal({ player, teams, onClose, onSave }) {
  const [form, setForm] = useState({
    first_name: player?.first_name || '',
    last_name: player?.last_name || '',
    nickname: player?.nickname || '',
    number: player?.number || '',
    position: player?.position || 'C',
    team_id: player?.team_id || '',
    age: player?.age || '',
    email: player?.email || '',
    phone: player?.phone || '',
    status: player?.status || 'active',
  });

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      if (player) {
        await api.put(`/players/${player.id}`, form);
        toast.success('Joueur mis à jour');
      } else {
        await api.post('/players', form);
        toast.success('Joueur ajouté');
      }
      onSave();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur');
    }
  };

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="text-lg font-bold text-white">{player ? 'Modifier le joueur' : 'Ajouter un joueur'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Prénom *</label>
                <input className="input" value={form.first_name} onChange={(event) => set('first_name', event.target.value)} required />
              </div>
              <div>
                <label className="label">Nom *</label>
                <input className="input" value={form.last_name} onChange={(event) => set('last_name', event.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Surnom</label>
                <input className="input" value={form.nickname} onChange={(event) => set('nickname', event.target.value)} />
              </div>
              <div>
                <label className="label">Numéro</label>
                <input className="input" type="number" value={form.number} onChange={(event) => set('number', event.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Position</label>
                <select className="select" value={form.position} onChange={(event) => set('position', event.target.value)}>
                  {POSITIONS.map((position) => <option key={position} value={position}>{positionLabel[position]}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Équipe</label>
                <select className="select" value={form.team_id} onChange={(event) => set('team_id', event.target.value)}>
                  <option value="">Aucune équipe</option>
                  {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Âge</label>
                <input className="input" type="number" value={form.age} onChange={(event) => set('age', event.target.value)} />
              </div>
              <div>
                <label className="label">Statut</label>
                <select className="select" value={form.status} onChange={(event) => set('status', event.target.value)}>
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Courriel</label>
              <input className="input" type="email" value={form.email} onChange={(event) => set('email', event.target.value)} />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input className="input" value={form.phone} onChange={(event) => set('phone', event.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary">{player ? 'Enregistrer' : 'Ajouter'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Players() {
  const { isAdminOrCaptain, isAdmin } = useAuth();
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [filterPos, setFilterPos] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [editPlayer, setEditPlayer] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const load = () => {
    setLoading(true);
    const params = {
      status: filterStatus || undefined,
      team_id: filterTeam || undefined,
      position: filterPos || undefined,
      search: search || undefined,
    };

    Promise.all([
      api.get('/players', { params }),
      api.get('/teams'),
    ]).then(([playersResponse, teamsResponse]) => {
      setPlayers(playersResponse.data);
      setTeams(teamsResponse.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [filterTeam, filterPos, filterStatus]);

  const handleSearch = (event) => {
    event.preventDefault();
    load();
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Désactiver ${name} ?`)) return;
    try {
      await api.delete(`/players/${id}`);
      toast.success('Joueur désactivé');
      load();
    } catch {
      toast.error('Erreur');
    }
  };

  const openAdd = () => {
    setEditPlayer(null);
    setShowModal(true);
  };

  const openEdit = (player) => {
    setEditPlayer(player);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditPlayer(null);
  };

  const handleSaved = () => {
    closeModal();
    load();
  };

  const activePlayers = useMemo(() => players.filter((player) => player.status === 'active').length, [players]);
  const withTeam = useMemo(() => players.filter((player) => player.team_id).length, [players]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Répertoire des joueurs</p>
          <h1 className="text-3xl sm:text-5xl font-black text-white">Joueurs</h1>
          <p className="text-gray-400 text-sm sm:text-base mt-2 max-w-2xl">
            Explore les effectifs, les profils individuels et les attributions d’équipe à travers toute la ligue.
          </p>
        </div>
        {isAdminOrCaptain && (
          <button onClick={openAdd} className="btn-primary">
            <UserPlus size={16} /> Ajouter un joueur
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gray-600 mb-2">Joueurs</div>
          <div className="text-2xl font-black text-white">{players.length}</div>
          <div className="text-xs text-gray-500 mt-1">Résultats affichés</div>
        </div>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gray-600 mb-2">Actifs</div>
          <div className="text-2xl font-black text-white">{activePlayers}</div>
          <div className="text-xs text-gray-500 mt-1">Statut actif dans la liste</div>
        </div>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gray-600 mb-2">Assignés</div>
          <div className="text-2xl font-black text-white">{withTeam}</div>
          <div className="text-xs text-gray-500 mt-1">Joueurs associés à une équipe</div>
        </div>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gray-600 mb-2">Vue</div>
          <div className="text-lg font-black text-white">Annuaire public</div>
          <div className="text-xs text-gray-500 mt-1">Fiches individuelles accessibles</div>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col xl:flex-row gap-3">
          <form onSubmit={handleSearch} className="flex-1 min-w-[220px] flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                className="input pl-9"
                placeholder="Rechercher un joueur..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <button type="submit" className="btn-secondary"><Search size={15} /></button>
          </form>

          <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-gray-500 mr-1">
              <Filter size={13} />
              <span>Filtres</span>
            </div>
            <select className="select w-full sm:w-44" value={filterTeam} onChange={(event) => setFilterTeam(event.target.value)}>
              <option value="">Toutes les équipes</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
            <select className="select w-full sm:w-36" value={filterPos} onChange={(event) => setFilterPos(event.target.value)}>
              <option value="">Toutes positions</option>
              {POSITIONS.map((position) => <option key={position} value={position}>{positionLabel[position]}</option>)}
            </select>
            <select className="select w-full sm:w-32" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
              <option value="">Tous statuts</option>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 animate-pulse">Chargement...</div>
      ) : players.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Aucun joueur trouvé</div>
      ) : (
        <div className="bg-gray-900 rounded-3xl border border-gray-800 overflow-x-auto">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-lg font-bold text-white">Annuaire des joueurs</h2>
            <p className="text-sm text-gray-500 mt-1">Recherche, filtres et accès rapide à chaque fiche individuelle.</p>
          </div>

          <table className="w-full text-sm min-w-[980px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 px-5 text-xs text-gray-600 font-medium">#</th>
                <th className="text-left py-3 text-xs text-gray-600 font-medium">Joueur</th>
                <th className="text-left py-3 text-xs text-gray-600 font-medium">Position</th>
                <th className="text-left py-3 text-xs text-gray-600 font-medium">Équipe</th>
                <th className="text-left py-3 text-xs text-gray-600 font-medium">Âge</th>
                <th className="text-left py-3 text-xs text-gray-600 font-medium">Statut</th>
                <th className="text-right py-3 pr-5 text-xs text-gray-600 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors last:border-0">
                  <td className="py-3.5 px-5">
                    <span className="font-mono text-gray-400">{player.number ? `#${player.number}` : '—'}</span>
                  </td>
                  <td className="py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: player.team_color || '#374151' }}
                      >
                        {player.first_name[0]}{player.last_name[0]}
                      </div>
                      <div>
                        <Link to={`/players/${player.id}`} className="text-white font-medium hover:text-blue-400 transition-colors">
                          {player.first_name} {player.last_name}
                        </Link>
                        {player.nickname && <span className="text-gray-500 text-xs ml-1">"{player.nickname}"</span>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5"><span className="position-badge">{positionLabel[player.position] || player.position}</span></td>
                  <td className="py-3.5">
                    {player.team_name ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: player.team_color }} />
                        <Link to={`/teams/${player.team_id}`} className="text-gray-300 hover:text-blue-400 transition-colors text-sm">
                          {player.team_name}
                        </Link>
                      </div>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="py-3.5 text-gray-400">{player.age || '—'}</td>
                  <td className="py-3.5">
                    <span className={player.status === 'active' ? 'status-active' : 'status-inactive'}>
                      {player.status === 'active' ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="py-3.5 pr-5">
                    <div className="flex items-center justify-end gap-1">
                      <Link to={`/players/${player.id}`} className="p-1.5 text-gray-500 hover:text-blue-400 transition-colors rounded-lg hover:bg-gray-800">
                        <Eye size={15} />
                      </Link>
                      {isAdminOrCaptain && (
                        <button onClick={() => openEdit(player)} className="p-1.5 text-gray-500 hover:text-yellow-400 transition-colors rounded-lg hover:bg-gray-800">
                          <Edit2 size={15} />
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(player.id, `${player.first_name} ${player.last_name}`)}
                          className="p-1.5 text-gray-500 hover:text-red-400 transition-colors rounded-lg hover:bg-gray-800"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <PlayerModal player={editPlayer} teams={teams} onClose={closeModal} onSave={handleSaved} />}
    </div>
  );
}
