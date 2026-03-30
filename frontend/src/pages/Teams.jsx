import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Shield, Users, Plus, Edit2, X, ChevronRight } from 'lucide-react';

function TeamModal({ team, onClose, onSave }) {
  const [form, setForm] = useState({ name: team?.name || '', color: team?.color || '#3B82F6' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      if (team) { await api.put(`/teams/${team.id}`, form); toast.success('Équipe mise à jour'); }
      else { await api.post('/teams', form); toast.success('Équipe créée'); }
      onSave();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal max-w-sm">
        <div className="modal-header">
          <h3 className="text-lg font-bold text-white">{team ? 'Modifier' : 'Nouvelle équipe'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div><label className="label">Nom de l'équipe *</label><input className="input" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
            <div>
              <label className="label">Couleur</label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.color} onChange={e => set('color', e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border border-gray-700 p-0.5" />
                <input className="input flex-1" value={form.color} onChange={e => set('color', e.target.value)} placeholder="#3B82F6" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary">{team ? 'Enregistrer' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Teams() {
  const { isAdmin } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editTeam, setEditTeam] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/teams').then(r => setTeams(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditTeam(null); setShowModal(true); };
  const openEdit = t => { setEditTeam(t); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditTeam(null); };
  const handleSaved = () => { closeModal(); load(); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Équipes</h1>
          <p className="text-sm text-gray-400">{teams.length} équipe{teams.length !== 1 ? 's' : ''}</p>
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="btn-primary"><Plus size={16} /> Nouvelle équipe</button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 animate-pulse">Chargement...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map(team => (
            <div key={team.id} className="card hover:border-gray-700 transition-colors group" style={{ borderLeftColor: team.color, borderLeftWidth: '3px' }}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                    style={{ backgroundColor: team.color + '30', border: `2px solid ${team.color}` }}>
                    <Shield size={22} style={{ color: team.color }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg leading-tight">{team.name}</h3>
                    {team.captain && (
                      <p className="text-xs text-gray-500">Cap: {team.captain.first_name} {team.captain.last_name}</p>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <button onClick={() => openEdit(team)} className="text-gray-600 hover:text-yellow-400 transition-colors opacity-0 group-hover:opacity-100 p-1">
                    <Edit2 size={15} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Users size={14} />
                  <span>{team.player_count} joueur{team.player_count !== 1 ? 's' : ''}</span>
                </div>
                <div className="w-4 h-4 rounded-full border-2 border-gray-700" style={{ backgroundColor: team.color }} title={team.color} />
              </div>

              <Link to={`/teams/${team.id}`}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-medium transition-colors text-gray-300 hover:text-white"
                style={{ backgroundColor: team.color + '20', border: `1px solid ${team.color}40` }}>
                Voir l'équipe <ChevronRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      )}

      {showModal && <TeamModal team={editTeam} onClose={closeModal} onSave={handleSaved} />}
    </div>
  );
}
