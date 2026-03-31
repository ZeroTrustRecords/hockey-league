import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Send, Plus, X, Megaphone, Users, Globe, CheckCheck, Lock } from 'lucide-react';

const typeLabels = { global: 'Général', team: 'Équipe', private: 'Privé' };
const typeIcons = { global: Globe, team: Users, private: Send };

function NewMessageModal({ teams, onClose, onSend }) {
  const { isAdmin, isCaptain, isAdminOrCaptain, user } = useAuth();
  const [form, setForm] = useState({ type: 'global', team_id: user?.team_id || '', title: '', content: '', is_announcement: false });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await api.post('/messages', { ...form, is_announcement: form.is_announcement ? 1 : 0 });
      toast.success('Message envoyé');
      onSend();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="text-lg font-bold text-white">Nouveau message</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div>
              <label className="label">Type</label>
              <select className="select" value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="global">Global (tous)</option>
                {isAdminOrCaptain && <option value="team">Équipe</option>}
                <option value="private">Privé</option>
              </select>
            </div>
            {form.type === 'team' && (
              <div>
                <label className="label">Équipe</label>
                <select className="select" value={form.team_id} onChange={e => set('team_id', e.target.value)}>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            {isAdmin && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_announcement} onChange={e => set('is_announcement', e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-500" />
                <span className="text-sm text-gray-300">Annonce officielle (avec titre)</span>
              </label>
            )}
            {(form.is_announcement || form.title) && (
              <div><label className="label">Titre</label><input className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Titre du message..." /></div>
            )}
            <div>
              <label className="label">Message *</label>
              <textarea className="input min-h-[100px] resize-y" value={form.content} onChange={e => set('content', e.target.value)} placeholder="Votre message..." required />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary"><Send size={15} /> Envoyer</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Messages() {
  const { user, isAdminOrCaptain } = useAuth();

  // Messages are only available to logged-in users
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto">
          <Lock size={28} className="text-gray-600" />
        </div>
        <div>
          <p className="text-white font-semibold">Messagerie réservée aux membres</p>
          <p className="text-gray-500 text-sm mt-1">Connectez-vous pour accéder aux messages.</p>
        </div>
      </div>
    );
  }
  const outletContext = useOutletContext();
  const [messages, setMessages] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [showModal, setShowModal] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/messages', { params: { type: filterType || undefined } }),
      api.get('/teams'),
    ]).then(([mr, tr]) => {
      setMessages(mr.data);
      setTeams(tr.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterType]);

  const handleMarkAllRead = async () => {
    try {
      await api.post('/messages/read-all');
      load();
      outletContext?.refreshUnread?.();
      toast.success('Tous marqués comme lus');
    } catch { toast.error('Erreur'); }
  };

  const handleMarkRead = async id => {
    await api.post(`/messages/${id}/read`).catch(() => {});
    setMessages(msgs => msgs.map(m => m.id === id ? { ...m, is_read: 1 } : m));
    outletContext?.refreshUnread?.();
  };

  const handleDelete = async id => {
    try {
      await api.delete(`/messages/${id}`);
      setMessages(msgs => msgs.filter(m => m.id !== id));
      toast.success('Message supprimé');
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  const unreadCount = messages.filter(m => !m.is_read).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Messagerie</h1>
          {unreadCount > 0 && <p className="text-sm text-blue-400">{unreadCount} message{unreadCount > 1 ? 's' : ''} non lu{unreadCount > 1 ? 's' : ''}</p>}
        </div>
        <div className="flex gap-2 flex-wrap">
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="btn-secondary"><CheckCheck size={15} /> Tout lire</button>
          )}
          <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={16} /> Nouveau message</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['', 'global', 'team', 'private'].map(t => (
          <button key={t} onClick={() => setFilterType(t)} className={filterType === t ? 'tab-active' : 'tab-inactive'}>
            {t === '' ? 'Tous' : typeLabels[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 animate-pulse">Chargement...</div>
      ) : messages.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Aucun message</div>
      ) : (
        <div className="space-y-2">
          {messages.map(msg => {
            const Icon = typeIcons[msg.type] || Globe;
            const isUnread = !msg.is_read;
            const canDelete = msg.sender_id === user?.id || user?.role === 'admin';
            return (
              <div key={msg.id}
                className={`card transition-all cursor-pointer ${isUnread ? 'border-blue-500/30 bg-blue-600/5' : 'hover:border-gray-700'}`}
                onClick={() => isUnread && handleMarkRead(msg.id)}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    msg.is_announcement ? 'bg-yellow-500/20' : msg.type === 'global' ? 'bg-blue-500/20' : msg.type === 'team' ? 'bg-emerald-500/20' : 'bg-purple-500/20'
                  }`}>
                    {msg.is_announcement ? <Megaphone size={16} className="text-yellow-400" /> : <Icon size={16} className={
                      msg.type === 'global' ? 'text-blue-400' : msg.type === 'team' ? 'text-emerald-400' : 'text-purple-400'
                    } />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {msg.is_announcement && <span className="badge bg-yellow-500/20 text-yellow-400">Annonce</span>}
                      <span className={`badge ${
                        msg.type === 'global' ? 'bg-blue-500/20 text-blue-400' :
                        msg.type === 'team' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-purple-500/20 text-purple-400'
                      }`}>{typeLabels[msg.type]}</span>
                      {msg.team_name && <span className="text-xs text-gray-500">{msg.team_name}</span>}
                      {isUnread && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                    </div>
                    {msg.title && <h3 className={`font-semibold mb-0.5 ${isUnread ? 'text-white' : 'text-gray-200'}`}>{msg.title}</h3>}
                    <p className={`text-sm leading-relaxed ${isUnread ? 'text-gray-200' : 'text-gray-400'}`}>{msg.content}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                      <span>Par <span className="text-gray-500">{msg.sender_name}</span></span>
                      <span>{format(parseISO(msg.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}</span>
                    </div>
                  </div>
                  {canDelete && (
                    <button onClick={e => { e.stopPropagation(); handleDelete(msg.id); }}
                      className="text-gray-600 hover:text-red-400 transition-colors p-1 flex-shrink-0">
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && <NewMessageModal teams={teams} onClose={() => setShowModal(false)} onSend={() => { setShowModal(false); load(); outletContext?.refreshUnread?.(); }} />}
    </div>
  );
}
