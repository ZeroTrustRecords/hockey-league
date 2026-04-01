import { useState } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { X, Plus } from 'lucide-react';

export function UserModal({ players, teams, onClose, onSave }) {
  const [form, setForm] = useState({ username: '', password: '', role: 'player', player_id: '', team_id: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await api.post('/auth/register', form);
      toast.success('Compte créé');
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur');
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="text-lg font-bold text-white">Créer un compte</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="label">Nom d'utilisateur *</label><input className="input" value={form.username} onChange={e => set('username', e.target.value)} required /></div>
              <div><label className="label">Mot de passe *</label><input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} required /></div>
            </div>
            <div>
              <label className="label">Rôle</label>
              <select className="select" value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="player">Joueur</option>
                <option value="captain">Capitaine</option>
                <option value="marqueur">Marqueur (feuille de match)</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>
            <div>
              <label className="label">Joueur associé</label>
              <select className="select" value={form.player_id} onChange={e => set('player_id', e.target.value)}>
                <option value="">Aucun</option>
                {players.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
              </select>
            </div>
            {form.role === 'captain' && (
              <div>
                <label className="label">Équipe</label>
                <select className="select" value={form.team_id} onChange={e => set('team_id', e.target.value)}>
                  <option value="">Aucune</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary">Créer</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ScheduleMatchModal({ teams, seasons, onClose, onSave }) {
  const [form, setForm] = useState({ home_team_id: '', away_team_id: '', date: '', location: 'Aréna Municipal', season_id: seasons[0]?.id || '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await api.post('/matches', form);
      toast.success('Match planifié');
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur');
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="text-lg font-bold text-white">Planifier un match</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Équipe locale *</label>
                <select className="select" value={form.home_team_id} onChange={e => set('home_team_id', e.target.value)} required>
                  <option value="">Sélectionner...</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Équipe visiteur *</label>
                <select className="select" value={form.away_team_id} onChange={e => set('away_team_id', e.target.value)} required>
                  <option value="">Sélectionner...</option>
                  {teams.filter(t => String(t.id) !== String(form.home_team_id)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div><label className="label">Date et heure *</label><input type="datetime-local" className="input" value={form.date} onChange={e => set('date', e.target.value)} required /></div>
            <div><label className="label">Endroit</label><input className="input" value={form.location} onChange={e => set('location', e.target.value)} /></div>
            <div>
              <label className="label">Saison</label>
              <select className="select" value={form.season_id} onChange={e => set('season_id', e.target.value)}>
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary"><Plus size={15} /> Planifier</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminPasswordModal({ config, password, setPassword, submitting, onClose, onConfirm }) {
  if (!config) return null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal max-w-lg w-full">
        <div className="modal-header">
          <h3 className="text-lg font-bold text-white">{config.title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={onConfirm}>
          <div className="modal-body space-y-4">
            <div className={`rounded-lg border p-3 text-sm ${config.danger ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200'}`}>
              {config.message}
            </div>
            <div>
              <label className="label">Mot de passe administrateur</label>
              <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} placeholder="Confirmer avec votre mot de passe" autoFocus required />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={submitting} className={config.danger ? 'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/20 transition-colors disabled:opacity-60' : 'btn-primary'}>
              {submitting ? '...' : config.confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ConfirmActionModal({ config, submitting, onClose, onConfirm }) {
  if (!config) return null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal max-w-lg w-full">
        <div className="modal-header">
          <h3 className="text-lg font-bold text-white">{config.title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <div className="modal-body space-y-4">
          <div className={`rounded-lg border p-3 text-sm ${config.danger ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-blue-500/30 bg-blue-500/10 text-blue-200'}`}>
            {config.message}
          </div>
          {config.details?.length > 0 && (
            <div className="space-y-2">
              {config.details.map(detail => (
                <div key={detail} className="text-sm text-gray-300">{detail}</div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="button" onClick={onConfirm} disabled={submitting} className={config.danger ? 'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/20 transition-colors disabled:opacity-60' : 'btn-primary'}>
            {submitting ? '...' : config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
