import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronRight, Edit2, Plus, Shield, Star, Users, X } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

function TeamModal({ team, onClose, onSave }) {
  const [form, setForm] = useState({ name: team?.name || '', color: team?.color || '#3B82F6' });
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      if (team) {
        await api.put(`/teams/${team.id}`, form);
        toast.success('Équipe mise à jour');
      } else {
        await api.post('/teams', form);
        toast.success('Équipe créée');
      }
      onSave();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur');
    }
  };

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal max-w-sm">
        <div className="modal-header">
          <h3 className="text-lg font-bold text-white">{team ? 'Modifier l’équipe' : 'Nouvelle équipe'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div>
              <label className="label">Nom de l’équipe *</label>
              <input className="input" value={form.name} onChange={(event) => set('name', event.target.value)} required />
            </div>
            <div>
              <label className="label">Couleur</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.color}
                  onChange={(event) => set('color', event.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border border-gray-700 p-0.5"
                />
                <input className="input flex-1" value={form.color} onChange={(event) => set('color', event.target.value)} placeholder="#3B82F6" />
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
    api.get('/teams').then((response) => setTeams(response.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditTeam(null);
    setShowModal(true);
  };

  const openEdit = (team) => {
    setEditTeam(team);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditTeam(null);
  };

  const handleSaved = () => {
    closeModal();
    load();
  };

  const totalPlayers = useMemo(() => teams.reduce((sum, team) => sum + (team.player_count || 0), 0), [teams]);
  const strongestTeam = useMemo(() => teams.reduce((best, team) => (!best || (team.strength_score || 0) > (best.strength_score || 0) ? team : best), null), [teams]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Clubs de la ligue</p>
          <h1 className="text-3xl sm:text-5xl font-black text-white">Équipes</h1>
          <p className="text-gray-400 text-sm sm:text-base mt-2 max-w-2xl">
            L’identité, l’effectif et la force de chaque club actuellement engagé dans la saison.
          </p>
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="btn-primary">
            <Plus size={16} /> Nouvelle équipe
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gray-600 mb-2">Équipes</div>
          <div className="text-2xl font-black text-white">{teams.length}</div>
          <div className="text-xs text-gray-500 mt-1">Clubs visibles sur la page</div>
        </div>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gray-600 mb-2">Joueurs</div>
          <div className="text-2xl font-black text-white">{totalPlayers}</div>
          <div className="text-xs text-gray-500 mt-1">Effectif total connu</div>
        </div>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gray-600 mb-2">Club repère</div>
          <div className="text-lg font-black text-white truncate">{strongestTeam?.name || '—'}</div>
          <div className="text-xs text-gray-500 mt-1">
            {strongestTeam?.strength_score ? `Force ${strongestTeam.strength_score}` : 'Disponible après import'}
          </div>
        </div>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gray-600 mb-2">Vue</div>
          <div className="text-lg font-black text-white">Annuaire</div>
          <div className="text-xs text-gray-500 mt-1">Accès rapide aux fiches d’équipe</div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 animate-pulse">Chargement...</div>
      ) : teams.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Aucune équipe à afficher</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {teams.map((team) => (
            <div key={team.id} className="rounded-3xl border border-gray-800 bg-gray-900 overflow-hidden group">
              <div className="p-5 border-l-4" style={{ borderLeftColor: team.color }}>
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${team.color}22`, border: `2px solid ${team.color}` }}
                    >
                      <Shield size={24} style={{ color: team.color }} />
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-black text-white text-xl truncate">{team.name}</h2>
                      {team.captain ? (
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          Capitaine : {team.captain.first_name} {team.captain.last_name}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-600 mt-1">Capitaine non assigné</p>
                      )}
                    </div>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => openEdit(team)}
                      className="text-gray-600 hover:text-yellow-400 transition-colors opacity-0 group-hover:opacity-100 p-1"
                    >
                      <Edit2 size={15} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="rounded-2xl bg-gray-800/60 p-4">
                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                      <Users size={14} />
                      <span className="text-xs uppercase tracking-wide">Effectif</span>
                    </div>
                    <div className="text-2xl font-black text-white">{team.player_count || 0}</div>
                    <div className="text-xs text-gray-500 mt-1">Joueurs assignés</div>
                  </div>

                  <div className="rounded-2xl bg-gray-800/60 p-4">
                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                      <Star size={14} />
                      <span className="text-xs uppercase tracking-wide">Force</span>
                    </div>
                    <div className="text-2xl font-black text-white">{team.strength_score || 0}</div>
                    <div className="text-xs text-gray-500 mt-1">Indice du club</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                    <span>Couleur d’équipe</span>
                  </div>
                  <span className="font-mono text-xs">{team.color}</span>
                </div>

                <Link
                  to={`/teams/${team.id}`}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium transition-colors text-gray-300 hover:text-white"
                  style={{ backgroundColor: `${team.color}20`, border: `1px solid ${team.color}40` }}
                >
                  Voir la fiche d’équipe <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && <TeamModal team={editTeam} onClose={closeModal} onSave={handleSaved} />}
    </div>
  );
}
