import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { UserPlus, Search, X, Edit2, Trash2, Eye, Filter } from 'lucide-react';

const POSITIONS = ['C', 'LW', 'RW', 'D', 'G'];
const positionLabel = { C: 'Centre', LW: 'Ailier G', RW: 'Ailier D', D: 'Défenseur', G: 'Gardien' };

function PlayerModal({ player, teams, onClose, onSave }) {
  const [form, setForm] = useState({
    first_name: player?.first_name || '', last_name: player?.last_name || '',
    nickname: player?.nickname || '', number: player?.number || '',
    position: player?.position || 'C', team_id: player?.team_id || '',
    age: player?.age || '', email: player?.email || '',
    phone: player?.phone || '', status: player?.status || 'active',
  });

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      if (player) {
        await api.put(`/players/${player.id}`, form);
        toast.success('Joueur mis à jour');
      } else {
        await api.post('/players', form);
        toast.success('Joueur ajouté');
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur');
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="text-lg font-bold text-white">{player ? 'Modifier le joueur' : 'Ajouter un joueur'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Prénom *</label><input className="input" value={form.first_name} onChange={e => set('first_name', e.target.value)} required /></div>
              <div><label className="label">Nom *</label><input className="input" value={form.last_name} onChange={e => set('last_name', e.target.value)} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Surnom</label><input className="input" value={form.nickname} onChange={e => set('nickname', e.target.value)} /></div>
              <div><label className="label">Numéro</label><input className="input" type="number" value={form.number} onChange={e => set('number', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Position</label>
                <select className="select" value={form.position} onChange={e => set('position', e.target.value)}>
                  {POSITIONS.map(p => <option key={p} value={p}>{positionLabel[p]}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Équipe</label>
                <select className="select" value={form.team_id} onChange={e => set('team_id', e.target.value)}>
                  <option value="">Aucune équipe</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Âge</label><input className="input" type="number" value={form.age} onChange={e => set('age', e.target.value)} /></div>
              <div>
                <label className="label">Statut</label>
                <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </div>
            </div>
            <div><label className="label">Courriel</label><input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
            <div><label className="label">Téléphone</label><input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
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
    const params = { status: filterStatus || undefined, team_id: filterTeam || undefined, position: filterPos || undefined, search: search || undefined };
    Promise.all([
      api.get('/players', { params }),
      api.get('/teams'),
    ]).then(([pr, tr]) => {
      setPlayers(pr.data);
      setTeams(tr.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterTeam, filterPos, filterStatus]);

  const handleSearch = e => { e.preventDefault(); load(); };

  const handleDelete = async (id, name) => {
    if (!confirm(`Désactiver ${name} ?`)) return;
    try {
      await api.delete(`/players/${id}`);
      toast.success('Joueur désactivé');
      load();
    } catch { toast.error('Erreur'); }
  };

  const openAdd = () => { setEditPlayer(null); setShowModal(true); };
  const openEdit = p => { setEditPlayer(p); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditPlayer(null); };
  const handleSaved = () => { closeModal(); load(); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Joueurs</h1>
          <p className="text-sm text-gray-400">{players.length} joueur{players.length !== 1 ? 's' : ''}</p>
        </div>
        {isAdminOrCaptain && (
          <button onClick={openAdd} className="btn-primary">
            <UserPlus size={16} /> Ajouter un joueur
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-3">
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px] flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input className="input pl-9" placeholder="Rechercher un joueur..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button type="submit" className="btn-secondary"><Search size={15} /></button>
          </form>
          <select className="select w-40" value={filterTeam} onChange={e => setFilterTeam(e.target.value)}>
            <option value="">Toutes les équipes</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className="select w-36" value={filterPos} onChange={e => setFilterPos(e.target.value)}>
            <option value="">Toutes positions</option>
            {POSITIONS.map(p => <option key={p} value={p}>{positionLabel[p]}</option>)}
          </select>
          <select className="select w-32" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Tous statuts</option>
            <option value="active">Actif</option>
            <option value="inactive">Inactif</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 animate-pulse">Chargement...</div>
      ) : players.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Aucun joueur trouvé</div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Joueur</th>
                <th>Position</th>
                <th>Équipe</th>
                <th>Âge</th>
                <th>Statut</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {players.map(p => (
                <tr key={p.id}>
                  <td>
                    <span className="font-mono text-gray-400">{p.number || '—'}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: p.team_color || '#374151' }}>
                        {p.first_name[0]}{p.last_name[0]}
                      </div>
                      <div>
                        <Link to={`/players/${p.id}`} className="text-white font-medium hover:text-blue-400 transition-colors">
                          {p.first_name} {p.last_name}
                        </Link>
                        {p.nickname && <span className="text-gray-500 text-xs ml-1">"{p.nickname}"</span>}
                      </div>
                    </div>
                  </td>
                  <td><span className="position-badge">{positionLabel[p.position] || p.position}</span></td>
                  <td>
                    {p.team_name ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.team_color }} />
                        <Link to={`/teams/${p.team_id}`} className="text-gray-300 hover:text-blue-400 transition-colors text-sm">
                          {p.team_name}
                        </Link>
                      </div>
                    ) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="text-gray-400">{p.age || '—'}</td>
                  <td>
                    <span className={p.status === 'active' ? 'status-active' : 'status-inactive'}>
                      {p.status === 'active' ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <Link to={`/players/${p.id}`} className="p-1.5 text-gray-500 hover:text-blue-400 transition-colors rounded-lg hover:bg-gray-800">
                        <Eye size={15} />
                      </Link>
                      {isAdminOrCaptain && (
                        <button onClick={() => openEdit(p)} className="p-1.5 text-gray-500 hover:text-yellow-400 transition-colors rounded-lg hover:bg-gray-800">
                          <Edit2 size={15} />
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => handleDelete(p.id, `${p.first_name} ${p.last_name}`)}
                          className="p-1.5 text-gray-500 hover:text-red-400 transition-colors rounded-lg hover:bg-gray-800">
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
