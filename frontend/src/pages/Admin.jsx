import { useState, useEffect } from 'react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Settings, Plus, X, Users, Shield, Calendar, RefreshCw, Check, Trash2, UserCheck, Trophy, Zap, AlertTriangle, Upload, Download } from 'lucide-react';

function UserModal({ players, teams, onClose, onSave }) {
  const [form, setForm] = useState({ username: '', password: '', role: 'player', player_id: '', team_id: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await api.post('/auth/register', form);
      toast.success('Compte créé');
      onSave();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
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
            <div className="grid grid-cols-2 gap-3">
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

function ScheduleMatchModal({ teams, seasons, onClose, onSave }) {
  const [form, setForm] = useState({ home_team_id: '', away_team_id: '', date: '', location: 'Aréna Municipal', season_id: seasons[0]?.id || '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await api.post('/matches', form);
      toast.success('Match planifié');
      onSave();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
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
            <div className="grid grid-cols-2 gap-3">
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

export default function Admin() {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [activeSeason, setActiveSeason] = useState(null);
  const [playoffStarting, setPlayoffStarting] = useState(false);
  const [newSeasonForm, setNewSeasonForm] = useState({ name: '', start_date: '' });
  const [showNewSeasonForm, setShowNewSeasonForm] = useState(false);
  const [csvPreview, setCsvPreview] = useState(null); // { assignments, grouped }
  const [standings, setStandings] = useState([]);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/dashboard'),
      api.get('/teams'),
      api.get('/players'),
      api.get('/seasons'),
      api.get('/matches'),
      api.get('/standings'),
    ]).then(([dr, tr, pr, sr, mr, stdr]) => {
      setStats(dr.data.counts);
      setTeams(tr.data);
      setPlayers(pr.data);
      setSeasons(sr.data);
      setMatches(mr.data);
      setStandings(stdr.data);
      const current = sr.data.find(s => s.status === 'active' || s.status === 'playoffs') || sr.data[0] || null;
      setActiveSeason(current);
    }).finally(() => setLoading(false));
  };

  const startPlayoffs = async () => {
    if (!activeSeason) return;
    if (!confirm('Démarrer les séries éliminatoires ? Les statistiques de saison régulière seront archivées.')) return;
    setPlayoffStarting(true);
    try {
      await api.post(`/playoffs/season/${activeSeason.id}/start`);
      toast.success('Séries éliminatoires démarrées !');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
    finally { setPlayoffStarting(false); }
  };

  // Download CSV template with current player list
  const downloadTemplate = async () => {
    // Fetch fresh player data with team assignments
    const res = await api.get('/players');
    const allPlayers = res.data;
    const teamNames = teams.map(t => t.name).join(' / ');
    const comment = `# Modèle d'assignation — Équipes disponibles: ${teamNames}\n`;
    const header  = 'Prénom,Nom,Équipe\n';
    const rows = allPlayers
      .sort((a, b) => a.last_name.localeCompare(b.last_name))
      .map(p => `"${p.first_name}","${p.last_name}","${p.team_name || ''}"`)
      .join('\n');
    const blob = new Blob(['\uFEFF' + comment + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'modele_assignation_joueurs.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Parse CSV row into columns (handles quoted fields)
  const parseCSVLine = line => {
    const cols = [];
    let cur = '', inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  };

  // Strip "(Captain Name)" from team names like "Canadiens (Martin Verville)"
  const cleanTeamName = name => name.replace(/\s*\(.*\)$/, '').trim();

  // Read CSV file and show preview modal
  const handleCSVImport = async e => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    try {
      const text = await file.text();
      const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => !l.startsWith('#'));
      const headerIdx = lines.findIndex(l => /prénom|prenom|first.name/i.test(l));
      if (headerIdx === -1) { toast.error('Format CSV invalide — colonne Prénom introuvable'); return; }
      const headers = parseCSVLine(lines[headerIdx]).map(h => h.toLowerCase());
      const fnIdx   = headers.findIndex(h => /prénom|prenom|first.name/i.test(h));
      const lnIdx   = headers.findIndex(h => /^nom$|last.name/i.test(h));
      const teamIdx = headers.findIndex(h => /équipe|equipe|team/i.test(h));
      if (fnIdx === -1 || lnIdx === -1 || teamIdx === -1) {
        toast.error('Colonnes requises: Prénom, Nom, Équipe'); return;
      }
      const assignments = lines.slice(headerIdx + 1)
        .filter(l => l.trim())
        .map(l => {
          const cols = parseCSVLine(l);
          return {
            first_name: (cols[fnIdx]   || '').trim(),
            last_name:  (cols[lnIdx]   || '').trim(),
            team_name:  cleanTeamName(cols[teamIdx] || ''),
          };
        })
        .filter(r => r.first_name && r.last_name);

      if (assignments.length === 0) { toast.error('Aucun joueur trouvé dans le fichier'); return; }

      // Group by team for preview
      const grouped = assignments.reduce((acc, a) => {
        const key = a.team_name || '— Sans équipe';
        if (!acc[key]) acc[key] = [];
        acc[key].push(a);
        return acc;
      }, {});

      setCsvPreview({ assignments, grouped });
    } catch (err) {
      toast.error('Erreur lors de la lecture du fichier');
    }
  };

  // Apply the previewed assignments
  const applyCSVImport = async () => {
    if (!csvPreview) return;
    try {
      const r = await api.post('/seasons/import-csv', { assignments: csvPreview.assignments });
      const { updated, not_found_players, not_found_teams } = r.data;
      toast.success(`${updated} joueur(s) assigné(s) avec succès`);
      if (not_found_players.length > 0)
        toast.error(`Joueurs introuvables:\n${not_found_players.join(', ')}`, { duration: 8000 });
      if (not_found_teams.length > 0)
        toast.error(`Équipes introuvables:\n${[...new Set(not_found_teams)].join(', ')}`, { duration: 8000 });
      setCsvPreview(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de l\'importation');
    }
  };

  const simulateSeason = async () => {
    if (!confirm('Générer des données simulées pour la Saison 2024-2025 ? Cela permettra de tester l\'historique des joueurs.')) return;
    try {
      const res = await api.post('/simulate/season');
      toast.success(res.data.message);
      console.log('Transferts simulés:', res.data.transferred);
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur de simulation'); }
  };

  const simulatePrevSeason = async () => {
    if (!confirm('Générer des données simulées pour la Saison 2024-2025 ?\nPermet de tester l\'historique des joueurs avec transferts.')) return;
    try {
      const res = await api.post('/simulate/season');
      toast.success(res.data.message);
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  const simulateCurrentSeason = async () => {
    if (!confirm('Valider tous les matchs restants de la saison en cours avec des scores simulés ?')) return;
    try {
      const res = await api.post('/simulate/current-season');
      toast.success(res.data.message);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  const simulatePlayoffs = async () => {
    if (!confirm('Simuler toutes les séries éliminatoires jusqu\'au champion ?\nLes séries doivent déjà être démarrées.')) return;
    try {
      const res = await api.post('/simulate/playoffs');
      toast.success(`${res.data.message} — Champion : ${res.data.champion}`);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  const handleReset = async () => {
    if (!confirm('⚠️ RÉINITIALISATION COMPLÈTE\n\nCeci va effacer:\n- Tous les matchs et buts\n- Le repêchage\n- Les séries éliminatoires\n- Les assignations de joueurs aux équipes\n\nLes joueurs et équipes seront conservés.\n\nÊtes-vous certain?')) return;
    if (!confirm('Dernière confirmation — cette action est irréversible. Continuer?')) return;
    try {
      await api.post('/seasons/reset');
      toast.success('Réinitialisation effectuée');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  const createNewSeason = async e => {
    e.preventDefault();
    try {
      await api.post('/seasons', newSeasonForm);
      toast.success('Nouvelle saison créée');
      setShowNewSeasonForm(false);
      setNewSeasonForm({ name: '', start_date: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  useEffect(() => { load(); }, []);

  // Load users when tab is active
  useEffect(() => {
    if (tab === 'users') {
      api.get('/auth/users').then(res => setUsers(res.data)).catch(() => {});
    }
  }, [tab]);

  const deleteUser = async (id) => {
    if (!confirm('Supprimer ce compte ?')) return;
    try {
      await api.delete(`/auth/users/${id}`);
      toast.success('Compte supprimé');
      setUsers(u => u.filter(x => x.id !== id));
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  const handleDeleteMatch = async id => {
    if (!confirm('Supprimer ce match?')) return;
    try {
      await api.delete(`/matches/${id}`);
      toast.success('Match supprimé');
      load();
    } catch { toast.error('Erreur'); }
  };

  const handleValidateMatch = async id => {
    try {
      await api.post(`/matches/${id}/validate`);
      toast.success('Match validé');
      load();
    } catch { toast.error('Erreur'); }
  };

  const handleUnvalidateMatch = async id => {
    try {
      await api.post(`/matches/${id}/unvalidate`);
      toast.success('Validation annulée');
      load();
    } catch { toast.error('Erreur'); }
  };

  if (loading) return <div className="text-center py-12 text-gray-500 animate-pulse">Chargement...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
          <Settings size={20} className="text-yellow-400" />
        </div>
        <div>
          <h1 className="page-title">Administration</h1>
          <p className="text-sm text-gray-400">Gestion complète de la ligue</p>
        </div>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Joueurs', value: stats?.players, icon: '👥', color: 'blue' },
          { label: 'Équipes', value: stats?.teams, icon: '🛡️', color: 'green' },
          { label: 'Matchs joués', value: stats?.matches_played, icon: '🏒', color: 'yellow' },
          { label: 'Buts totaux', value: stats?.goals_total, icon: '🎯', color: 'red' },
        ].map(s => (
          <div key={s.label} className="card text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-2xl font-bold text-white">{s.value || 0}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap border-b border-gray-800 pb-0">
        {[
          { key: 'overview', label: 'Aperçu' },
          { key: 'matches', label: 'Matchs' },
          { key: 'users', label: 'Comptes' },
          { key: 'teams', label: 'Équipes' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={tab === t.key ? 'tab-active' : 'tab-inactive'}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="section-title mb-3">Actions rapides</h3>
            <div className="space-y-2">
              <button onClick={() => setShowMatchModal(true)} className="btn-primary w-full justify-start">
                <Calendar size={16} /> Planifier un match
              </button>
              <button onClick={() => setShowUserModal(true)} className="btn-secondary w-full justify-start">
                <UserCheck size={16} /> Créer un compte utilisateur
              </button>
              <button onClick={load} className="btn-secondary w-full justify-start">
                <RefreshCw size={16} /> Actualiser les données
              </button>
              <div className="pt-2 border-t border-gray-800 space-y-2">
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide px-1 pt-1">Importation CSV</div>
                <button onClick={downloadTemplate} className="w-full flex items-center gap-2 justify-start px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 border border-gray-700 transition-colors">
                  <Download size={16} /> Télécharger le modèle
                </button>
                <label className="w-full flex items-center gap-2 justify-start px-3 py-2 rounded-lg text-sm font-medium text-blue-400 hover:bg-blue-500/10 border border-blue-500/20 transition-colors cursor-pointer">
                  <Upload size={16} /> Importer CSV (équipes)
                  <input type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
                </label>
              </div>
              <div className="pt-2 border-t border-gray-800 space-y-1">
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide px-1 pt-1">🧪 Simulation & Tests</div>
                <button onClick={simulatePrevSeason} className="w-full flex items-center gap-2 justify-start px-3 py-2 rounded-lg text-sm font-medium text-purple-400 hover:bg-purple-500/10 border border-purple-500/20 transition-colors">
                  <Zap size={16} /> 1. Simuler saison précédente
                </button>
                <button onClick={simulateCurrentSeason} className="w-full flex items-center gap-2 justify-start px-3 py-2 rounded-lg text-sm font-medium text-purple-400 hover:bg-purple-500/10 border border-purple-500/20 transition-colors">
                  <Zap size={16} /> 2. Simuler saison en cours
                </button>
                <button onClick={simulatePlayoffs} className="w-full flex items-center gap-2 justify-start px-3 py-2 rounded-lg text-sm font-medium text-yellow-400 hover:bg-yellow-500/10 border border-yellow-500/20 transition-colors">
                  <Trophy size={16} /> 3. Simuler les éliminatoires
                </button>
              </div>
              <div className="pt-1 border-t border-gray-800">
                <button onClick={handleReset} className="w-full flex items-center gap-2 justify-start px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors">
                  <AlertTriangle size={16} /> Réinitialiser la ligue
                </button>
              </div>
            </div>
          </div>
          {/* Season lifecycle */}
          <div className="card col-span-1 sm:col-span-2">
            <h3 className="section-title mb-3 flex items-center gap-2"><Trophy size={15} className="text-yellow-400" /> Saison & Éliminatoires</h3>
            {activeSeason ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800">
                  <div>
                    <div className="text-sm font-semibold text-white">{activeSeason.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {activeSeason.status === 'active' && 'Saison régulière en cours'}
                      {activeSeason.status === 'playoffs' && 'Séries éliminatoires en cours'}
                      {activeSeason.status === 'completed' && 'Saison terminée'}
                    </div>
                  </div>
                  <span className={`badge text-xs font-bold ${
                    activeSeason.status === 'active' ? 'bg-blue-500/20 text-blue-400' :
                    activeSeason.status === 'playoffs' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {activeSeason.status === 'active' ? 'Saison régulière' :
                     activeSeason.status === 'playoffs' ? 'Éliminatoires' : 'Terminée'}
                  </span>
                </div>

                {activeSeason.status === 'active' && (
                  <button onClick={startPlayoffs} disabled={playoffStarting} className="btn-primary w-full justify-center">
                    <Trophy size={15} /> {playoffStarting ? 'Démarrage...' : 'Démarrer les séries éliminatoires'}
                  </button>
                )}

                {activeSeason.status === 'playoffs' && (
                  <div className="text-sm text-yellow-400/80 text-center py-1 flex items-center justify-center gap-2">
                    <Trophy size={14} /> Les séries se terminent automatiquement quand le champion est déterminé.
                  </div>
                )}

                {(activeSeason.status === 'completed' || activeSeason.status === 'playoffs') && !showNewSeasonForm && (
                  <button onClick={() => setShowNewSeasonForm(true)} className="btn-secondary w-full justify-center">
                    <Zap size={15} /> Créer une nouvelle saison
                  </button>
                )}

                {showNewSeasonForm && (
                  <form onSubmit={createNewSeason} className="space-y-2 border-t border-gray-700 pt-3">
                    <div>
                      <label className="label">Nom de la saison *</label>
                      <input className="input" placeholder="ex: 2026-2027" value={newSeasonForm.name}
                        onChange={e => setNewSeasonForm(f => ({ ...f, name: e.target.value }))} required />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setShowNewSeasonForm(false)} className="btn-secondary flex-1">Annuler</button>
                      <button type="submit" className="btn-primary flex-1">Créer</button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-500 text-center py-2">Aucune saison active.</p>
                <button onClick={() => setShowNewSeasonForm(true)} className="btn-primary w-full justify-center">
                  <Plus size={15} /> Créer une saison
                </button>
                {showNewSeasonForm && (
                  <form onSubmit={createNewSeason} className="space-y-2 border-t border-gray-700 pt-3">
                    <div>
                      <label className="label">Nom de la saison *</label>
                      <input className="input" placeholder="ex: 2026-2027" value={newSeasonForm.name}
                        onChange={e => setNewSeasonForm(f => ({ ...f, name: e.target.value }))} required />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setShowNewSeasonForm(false)} className="btn-secondary flex-1">Annuler</button>
                      <button type="submit" className="btn-primary flex-1">Créer</button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="section-title mb-3">Informations système</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5 border-b border-gray-800">
                <span className="text-gray-500">Saison active</span>
                <span className="text-white">{seasons.find(s => s.status === 'active')?.name || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-800">
                <span className="text-gray-500">Matchs non validés</span>
                <span className={`font-semibold ${matches.filter(m => !m.validated && m.status === 'completed').length > 0 ? 'text-yellow-400' : 'text-gray-400'}`}>
                  {matches.filter(m => !m.validated && m.status === 'completed').length}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-gray-500">Matchs planifiés</span>
                <span className="text-blue-400">{matches.filter(m => m.status === 'scheduled').length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Matches management */}
      {tab === 'matches' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">{matches.length} matchs total</span>
            <button onClick={() => setShowMatchModal(true)} className="btn-primary py-1.5"><Plus size={15} /> Planifier</button>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Date</th>
                  <th className="text-center">Score</th>
                  <th className="text-center">Statut</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {matches.slice(0, 30).map(m => (
                  <tr key={m.id}>
                    <td>
                      <div className="text-sm">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.home_color }} />
                          <span className="text-white">{m.home_team_name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.away_color }} />
                          <span className="text-gray-400">{m.away_team_name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="text-xs text-gray-400">{m.date?.slice(0, 16).replace('T', ' ')}</td>
                    <td className="text-center">
                      {m.status !== 'scheduled' ? (
                        <span className="font-bold text-white">{m.home_score} – {m.away_score}</span>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="text-center">
                      <span className={`badge ${
                        m.validated ? 'bg-emerald-500/20 text-emerald-400' :
                        m.status === 'completed' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {m.validated ? 'Validé' : m.status === 'completed' ? 'Non validé' : 'Planifié'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {!m.validated && m.status === 'completed' && (
                          <button onClick={() => handleValidateMatch(m.id)} className="p-1.5 text-gray-500 hover:text-emerald-400 transition-colors" title="Valider">
                            <Check size={15} />
                          </button>
                        )}
                        {m.validated && (
                          <button onClick={() => handleUnvalidateMatch(m.id)} className="p-1.5 text-gray-500 hover:text-yellow-400 transition-colors" title="Annuler validation">
                            <RefreshCw size={15} />
                          </button>
                        )}
                        <button onClick={() => handleDeleteMatch(m.id)} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors" title="Supprimer">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users management */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-400">Gérer les accès utilisateurs</p>
            <button onClick={() => setShowUserModal(true)} className="btn-primary py-1.5"><Plus size={15} /> Créer un compte</button>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Rôle</th>
                  <th>Joueur associé</th>
                  <th>Créé le</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-gray-500 py-6">Aucun compte</td></tr>
                )}
                {users.map(u => {
                  const roleLabel = { admin: 'Administrateur', captain: 'Capitaine', marqueur: 'Marqueur', player: 'Joueur' };
                  const roleColor = { admin: 'text-yellow-400', captain: 'text-blue-400', marqueur: 'text-emerald-400', player: 'text-gray-400' };
                  const linked = players.find(p => p.id === u.player_id);
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)' }}>
                            {u.username[0]?.toUpperCase()}
                          </div>
                          <span className="font-mono text-white text-sm">{u.username}</span>
                          {isSelf && <span className="text-xs text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">vous</span>}
                        </div>
                      </td>
                      <td><span className={`text-sm font-medium ${roleColor[u.role] || 'text-gray-400'}`}>{roleLabel[u.role] || u.role}</span></td>
                      <td className="text-gray-400 text-sm">
                        {linked ? `${linked.first_name} ${linked.last_name}` : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="text-gray-500 text-sm">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('fr-CA') : '—'}
                      </td>
                      <td className="text-right">
                        {!isSelf && (
                          <button onClick={() => deleteUser(u.id)} className="text-gray-600 hover:text-red-400 transition-colors p-1" title="Supprimer">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Teams management */}
      {tab === 'teams' && (
        <div className="space-y-3">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Équipe</th>
                  <th className="text-center">Joueurs</th>
                  <th>Capitaine</th>
                  <th className="text-center font-bold text-yellow-400">⚡ Force</th>
                  <th className="text-center">PJ</th>
                  <th className="text-center">V</th>
                  <th className="text-center">D</th>
                  <th className="text-center">PTS</th>
                </tr>
              </thead>
              <tbody>
                {teams.map(t => {
                  const s = standings.find(st => st.team_id === t.id) || {};
                  const strength = players
                    .filter(p => p.team_id === t.id && p.status === 'active')
                    .reduce((sum, p) => sum + (p.rating_score || 0), 0);
                  return (
                    <tr key={t.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                          <span className="text-white font-medium">{t.name}</span>
                        </div>
                      </td>
                      <td className="text-center text-gray-400">{t.player_count ?? '—'}</td>
                      <td className="text-gray-300 text-sm">
                        {t.captain ? `${t.captain.first_name} ${t.captain.last_name}` : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="text-center">
                        <span className={`font-black text-base ${strength > 0 ? 'text-yellow-400' : 'text-gray-600'}`}>
                          {strength > 0 ? strength : '—'}
                        </span>
                      </td>
                      <td className="text-center text-gray-400">{s.gp ?? '—'}</td>
                      <td className="text-center text-emerald-400 font-semibold">{s.w ?? '—'}</td>
                      <td className="text-center text-red-400 font-semibold">{s.l ?? '—'}</td>
                      <td className="text-center font-black text-white">{s.pts ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showUserModal && <UserModal players={players} teams={teams} onClose={() => setShowUserModal(false)} onSave={() => { setShowUserModal(false); api.get('/auth/users').then(res => setUsers(res.data)).catch(() => {}); }} />}
      {showMatchModal && <ScheduleMatchModal teams={teams} seasons={seasons} onClose={() => setShowMatchModal(false)} onSave={() => { setShowMatchModal(false); load(); }} />}

      {/* CSV Preview Modal */}
      {csvPreview && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setCsvPreview(null)}>
          <div className="modal max-w-2xl w-full">
            <div className="modal-header">
              <h3 className="text-lg font-bold text-white">Confirmer l'importation CSV</h3>
              <button onClick={() => setCsvPreview(null)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="modal-body max-h-[60vh] overflow-y-auto space-y-4">
              <p className="text-sm text-gray-400">
                <span className="font-semibold text-white">{csvPreview.assignments.length} joueurs</span> détectés dans le fichier.
                Vérifiez les assignations ci-dessous avant d'appliquer.
              </p>
              {Object.entries(csvPreview.grouped).map(([team, players]) => (
                <div key={team}>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{team} — {players.length} joueurs</div>
                  <div className="grid grid-cols-2 gap-1">
                    {players.map((p, i) => (
                      <div key={i} className="text-sm text-gray-300 bg-gray-800/50 rounded px-2 py-1">
                        {p.first_name} {p.last_name}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button onClick={() => setCsvPreview(null)} className="btn-secondary">Annuler</button>
              <button onClick={applyCSVImport} className="btn-primary">
                <Check size={15} /> Appliquer les assignations
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
