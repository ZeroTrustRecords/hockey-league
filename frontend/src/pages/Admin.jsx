import { useState, useEffect } from 'react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Settings, Plus, X, Users, Shield, Calendar, CalendarDays, RefreshCw, Check, Trash2, UserCheck, Trophy, Zap, AlertTriangle, Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { UserModal, ScheduleMatchModal, AdminPasswordModal, ConfirmActionModal } from '../components/admin/AdminModals';
import AdminActivityPanel from '../components/admin/AdminActivityPanel';
import { AdminSetupModal, CsvPreviewModal, SchedulePreviewModal } from '../components/admin/AdminImportModals';

export default function Admin() {
  const { user: currentUser, bootstrap, refreshBootstrap } = useAuth();
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
  const [csvPreview, setCsvPreview] = useState(null); // { players, grouped }
  const [schedulePreview, setSchedulePreview] = useState(null); // { matches, errors }
  const [standings, setStandings] = useState([]);
  const [scheduleForm, setScheduleForm] = useState({ start_date: '', rounds: 3 });
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [jerseyNumbers, setJerseyNumbers] = useState({});
  const [savingJerseyId, setSavingJerseyId] = useState(null);
  const [protectedAction, setProtectedAction] = useState(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [submittingProtectedAction, setSubmittingProtectedAction] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [submittingConfirmAction, setSubmittingConfirmAction] = useState(false);
  const [activityLogs, setActivityLogs] = useState([]);
  const [importSummary, setImportSummary] = useState(null);
  const [pendingRestoreSnapshot, setPendingRestoreSnapshot] = useState(null);
  const [pendingRestoreFilename, setPendingRestoreFilename] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/dashboard'),
      api.get('/teams'),
      api.get('/players'),
      api.get('/seasons'),
      api.get('/matches'),
      api.get('/standings'),
      api.get('/admin/activity?limit=12'),
    ]).then(([dr, tr, pr, sr, mr, stdr, ar]) => {
      setStats(dr.data.counts);
      setTeams(tr.data);
      setPlayers(pr.data);
      setJerseyNumbers(Object.fromEntries(pr.data.map(player => [player.id, player.number ?? ''])));
      setSeasons(sr.data);
      setMatches(mr.data);
      setStandings(stdr.data);
      setActivityLogs(ar.data || []);
      const current = sr.data.find(s => s.status === 'active' || s.status === 'playoffs') || sr.data[0] || null;
      setActiveSeason(current);
    }).catch(() => {
      setActivityLogs([]);
    }).finally(() => setLoading(false));
  };

  const openProtectedAction = action => {
    setAdminPassword('');
    setProtectedAction(action);
  };

  const closeProtectedAction = () => {
    setAdminPassword('');
    setProtectedAction(null);
    setSubmittingProtectedAction(false);
  };

  const openConfirmAction = config => {
    setSubmittingConfirmAction(false);
    setConfirmAction(config);
  };

  const closeConfirmAction = () => {
    setSubmittingConfirmAction(false);
    setConfirmAction(null);
  };

  const runConfirmAction = async () => {
    if (!confirmAction?.onConfirm) return;
    setSubmittingConfirmAction(true);
    try {
      await confirmAction.onConfirm();
      closeConfirmAction();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Erreur');
      setSubmittingConfirmAction(false);
    }
  };

  const executeProtectedAction = async e => {
    e.preventDefault();
    if (!protectedAction) return;
    setSubmittingProtectedAction(true);

    try {
      if (protectedAction.key === 'reset-league') {
        await api.post('/seasons/reset', { admin_password: adminPassword });
        toast.success('Réinitialisation effectuée');
        load();
      }

      if (protectedAction.key === 'next-season') {
        const res = await api.post('/simulate/next-season', { admin_password: adminPassword });
        toast.success(res.data.message);
        await refreshBootstrap();
        load();
      }

      if (protectedAction.key === 'create-server-backup') {
        const res = await api.post('/admin/backup', { admin_password: adminPassword });
        toast.success(res.data.message || 'Sauvegarde serveur créée');
        load();
      }

      if (protectedAction.key === 'restore-backup') {
        await api.post('/admin/restore', {
          admin_password: adminPassword,
          snapshot: pendingRestoreSnapshot,
        });
        toast.success('Restauration effectuée');
        setPendingRestoreSnapshot(null);
        setPendingRestoreFilename('');
        await refreshBootstrap();
        load();
      }

      closeProtectedAction();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur');
      setSubmittingProtectedAction(false);
    }
  };

  const updateJerseyDraft = (playerId, value) => {
    if (value === '') {
      setJerseyNumbers(prev => ({ ...prev, [playerId]: '' }));
      return;
    }

    const sanitized = value.replace(/[^0-9]/g, '').slice(0, 2);
    setJerseyNumbers(prev => ({ ...prev, [playerId]: sanitized }));
  };

  const saveJerseyNumber = async player => {
    const rawValue = jerseyNumbers[player.id];
    if (rawValue !== '' && (!Number.isInteger(Number(rawValue)) || Number(rawValue) < 1 || Number(rawValue) > 99)) {
      toast.error('Le numéro doit être entre 1 et 99');
      setJerseyNumbers(prev => ({ ...prev, [player.id]: player.number ?? '' }));
      return;
    }

    setSavingJerseyId(player.id);
    try {
      await api.patch(`/players/${player.id}/jersey-number`, { number: rawValue });
      setPlayers(prev => prev.map(current => current.id === player.id ? { ...current, number: rawValue === '' ? null : Number(rawValue) } : current));
      toast.success('Numéro mis à jour');
    } catch (err) {
      setJerseyNumbers(prev => ({ ...prev, [player.id]: player.number ?? '' }));
      toast.error(err.response?.data?.error || 'Erreur');
    } finally {
      setSavingJerseyId(null);
    }
  };

  const startPlayoffs = async () => {
    if (!activeSeason) return;
    openConfirmAction({
      title: 'Démarrer les éliminatoires',
      confirmLabel: 'Démarrer',
      message: 'Les statistiques de saison régulière seront archivées et le tableau éliminatoire sera généré.',
      details: [
        `Saison ciblée : ${activeSeason.name}`,
        `Matchs validés : ${validatedRegularMatches}`,
      ],
      onConfirm: async () => {
        setPlayoffStarting(true);
        try {
          await api.post(`/playoffs/season/${activeSeason.id}/start`);
          toast.success('Séries éliminatoires démarrées');
          load();
        } finally {
          setPlayoffStarting(false);
        }
      },
    });
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

  const normalizeHeader = value => (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const readSpreadsheetRows = async file => {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      return XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' })
        .map(row => row.map(cell => (cell ?? '').toString().trim()));
    }

    const text = await file.text();
    return text
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(parseCSVLine);
  };

  const normalizeTimeValue = (timeValue = '21:00') => {
    const raw = (timeValue || '21:00').trim().toLowerCase().replace(/\s+/g, '');
    const match = raw.match(/^(\d{1,2})(?:h|:)?(\d{2})?$/);
    if (!match) return '21:00';
    return `${match[1].padStart(2, '0')}:${(match[2] || '00').padStart(2, '0')}`;
  };

  // Strip "(Captain Name)" from team names like "Canadiens (Martin Verville)"
  const cleanTeamName = name => name.replace(/\s*\(.*\)$/, '').trim();

  const normalizeDateValue = (dateValue, timeValue = '21:00') => {
    const rawDate = (dateValue || '').trim();
    const rawTime = normalizeTimeValue(timeValue);
    if (!rawDate) return null;

    const normalizedDate = normalizeHeader(rawDate);
    const frenchMonthMatch = normalizedDate.match(/^(\d{1,2}) ([a-z0-9»]+) (\d{4})$/);
    if (frenchMonthMatch) {
      const monthToken = frenchMonthMatch[2];
      const monthEntries = [
        ['jan', '01'],
        ['fev', '02'],
        ['mar', '03'],
        ['avr', '04'],
        ['mai', '05'],
        ['jui', monthToken.includes('l') ? '07' : '06'],
        ['aou', '08'],
        ['ao', '08'],
        ['sep', '09'],
        ['oct', '10'],
        ['nov', '11'],
        ['dec', '12'],
      ];
      const month = monthEntries.find(([prefix]) => monthToken.startsWith(prefix) || monthToken.includes(prefix))?.[1];
      if (month) {
        return `${frenchMonthMatch[3]}-${month}-${frenchMonthMatch[1].padStart(2, '0')} ${rawTime}`;
      }
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      return `${rawDate} ${rawTime}`;
    }

    const slashMatch = rawDate.match(/^(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})$/);
    if (!slashMatch) return null;

    let year;
    let month;
    let day;

    if (slashMatch[1].length === 4) {
      year = slashMatch[1];
      month = slashMatch[2];
      day = slashMatch[3];
    } else {
      day = slashMatch[1];
      month = slashMatch[2];
      year = slashMatch[3];
    }

    return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${rawTime}`;
  };

  // Apply the previewed assignments
  const applyCSVImport = async () => {
    if (!csvPreview) return;
    if (csvPreview.players) {
      await applyRosterImport();
      return;
    }
    try {
      const r = await api.post('/seasons/import-csv', { assignments: csvPreview.assignments });
      const { updated, not_found_players, not_found_teams } = r.data;
      toast.success(`${updated} joueur(s) assigné(s) avec succès`);
      setImportSummary({
        type: 'roster-assignment',
        title: 'Assignations mises à jour',
        stats: [
          { label: 'Joueurs mis à jour', value: updated },
          { label: 'Joueurs introuvables', value: not_found_players.length },
          { label: 'Équipes introuvables', value: [...new Set(not_found_teams)].length },
        ],
      });
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

  const downloadRosterTemplate = () => {
    const comment = '# Modèle d importation roster - format LHMA_Equipe2026\n';
    const header = 'Prénom,Nom,Position,Cote,Rating,Équipe,PJ,B,P,PTS,GPG,MOY,PUN,capitain,Numéro\n';
    const rows = [
      '"Jean","Tremblay","A","B","4","Rangers","","","","","","","","","91"',
      '"Marc","Gagnon","D","A","5","Canadiens","","","","","","","","","4"',
    ].join('\n');
    const blob = new Blob(['\uFEFF' + comment + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modele_roster_lhma.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadScheduleTemplate = () => {
    const comment = '# Modele d importation calendrier - format Schedule 2026\n';
    const header = 'Jour,Date,Heure,Local,Visiteur,Endroit\n';
    const rows = [
      '"Lundi","2026-06-01","21:00","Rangers","Canadiens","Arena Municipal"',
      '"Mercredi","2026-06-03","21:00","Bruins","Blues","Arena Municipal"',
    ].join('\n');
    const blob = new Blob(['\uFEFF' + comment + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modele_calendrier.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRosterImportFile = async e => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    try {
      const rows = await readSpreadsheetRows(file);
      const headerIdx = rows.findIndex(row => {
        const headers = row.map(normalizeHeader);
        return headers.includes('prenom') && headers.includes('nom') && headers.includes('equipe');
      });
      if (headerIdx === -1) {
        toast.error('Colonnes requises : Prénom, Nom, Équipe');
        return;
      }

      const headers = rows[headerIdx].map(normalizeHeader);
      const fnIdx = headers.findIndex(h => h === 'prenom' || h === 'first name');
      const lnIdx = headers.findIndex(h => h === 'nom' || h === 'last name');
      const teamIdx = headers.findIndex(h => h === 'equipe' || h === 'team');
      const positionIdx = headers.findIndex(h => h === 'position' || h === 'pos');
      const numberIdx = headers.findIndex(h => h === 'numero' || h === 'numéro' || h === 'number');
      const ratingIdx = headers.findIndex(h => h === 'cote');
      const ratingScoreIdx = headers.findIndex(h => h === 'rating');

      const players = rows.slice(headerIdx + 1)
        .filter(cols => cols.some(value => `${value}`.trim()))
        .map(cols => ({
          first_name: (cols[fnIdx] || '').trim(),
          last_name: (cols[lnIdx] || '').trim(),
          team_name: cleanTeamName(cols[teamIdx] || ''),
          position: positionIdx >= 0 ? (cols[positionIdx] || '').trim() : 'A',
          number: numberIdx >= 0 ? (cols[numberIdx] || '').trim() : '',
          rating: ratingIdx >= 0 ? (cols[ratingIdx] || '').trim() : 'C',
          rating_score: ratingScoreIdx >= 0 ? (cols[ratingScoreIdx] || '').trim() : '',
        }))
        .filter(player => player.first_name && player.last_name && player.team_name);

      if (players.length === 0) {
        toast.error('Aucun joueur trouvé dans le fichier');
        return;
      }

      const grouped = players.reduce((acc, player) => {
        if (!acc[player.team_name]) acc[player.team_name] = [];
        acc[player.team_name].push(player);
        return acc;
      }, {});

      setCsvPreview({ assignments: players, players, grouped });
    } catch (err) {
      toast.error('Erreur lors de la lecture du roster');
    }
  };

  const applyRosterImport = async () => {
    if (!csvPreview?.players) return;
    try {
      const response = await api.post('/seasons/import-roster', { players: csvPreview.players });
      toast.success(response.data.message);
      setImportSummary({
        type: 'roster',
        title: 'Import du roster terminé',
        stats: [
          { label: 'Joueurs importés', value: response.data.players || csvPreview.players.length },
          { label: 'Équipes créées', value: response.data.teams || Object.keys(csvPreview.grouped || {}).length },
          { label: 'Saison active', value: '1' },
        ],
      });
      setCsvPreview(null);
      await refreshBootstrap();
      load();
    } catch (err) {
      const details = err.response?.data?.details;
      if (Array.isArray(details) && details.length > 0) {
        toast.error(details.slice(0, 3).join('\n'), { duration: 8000 });
      } else {
        toast.error(err.response?.data?.error || 'Erreur lors de l\'importation du roster');
      }
    }
  };

  const handleScheduleImportFile = async e => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    try {
      const rows = await readSpreadsheetRows(file);
      const headerIdx = rows.findIndex(row => {
        const headers = row.map(normalizeHeader);
        return headers.includes('date') && headers.includes('local') && headers.includes('visiteur');
      });
      if (headerIdx === -1) {
        toast.error('Colonnes requises: Jour, Date, Heure, Local, Visiteur');
        return;
      }

      const headers = rows[headerIdx].map(normalizeHeader);
      const dateIdx = headers.findIndex(h => h === 'date');
      const timeIdx = headers.findIndex(h => h === 'heure' || h === 'time');
      const homeIdx = headers.findIndex(h => h === 'local' || h === 'home');
      const awayIdx = headers.findIndex(h => h === 'visiteur' || h === 'away');
      const locationIdx = headers.findIndex(h => ['endroit', 'arena', 'location', 'lieu'].includes(h));

      const parsedMatches = [];
      const errors = [];

      rows.slice(headerIdx + 1).forEach((cols, index) => {
        if (!cols.some(value => `${value}`.trim())) return;
        const rawDate = cols[dateIdx] || '';
        const rawTime = timeIdx >= 0 ? cols[timeIdx] || '21:00' : '21:00';
        const normalizedDate = normalizeDateValue(rawDate, rawTime);
        const homeTeamName = cleanTeamName(cols[homeIdx] || '');
        const awayTeamName = cleanTeamName(cols[awayIdx] || '');
        const location = (locationIdx >= 0 ? cols[locationIdx] : '') || 'Arena Municipal';

        if (!normalizedDate || !homeTeamName || !awayTeamName) {
          errors.push(`Ligne ${headerIdx + index + 2}: information manquante ou date invalide`);
          return;
        }

        parsedMatches.push({
          date: normalizedDate,
          home_team_name: homeTeamName,
          away_team_name: awayTeamName,
          location: location.toString().trim(),
        });
      });

      if (parsedMatches.length === 0) {
        toast.error('Aucun match valide trouvé dans le fichier');
        return;
      }

      setSchedulePreview({ matches: parsedMatches, errors });
    } catch (err) {
      toast.error('Erreur lors de la lecture du calendrier');
    }
  };

  const applyScheduleImport = async () => {
    if (!schedulePreview || !activeSeason) return;
    try {
      const response = await api.post(`/seasons/${activeSeason.id}/import-schedule`, {
        matches: schedulePreview.matches,
      });
      toast.success(response.data.message);
      setImportSummary({
        type: 'schedule',
        title: 'Import du calendrier terminé',
        stats: [
          { label: 'Matchs importés', value: response.data.matches || schedulePreview.matches.length },
          { label: 'Erreurs bloquantes', value: 0 },
          { label: 'Saison', value: activeSeason.name },
        ],
      });
      setSchedulePreview(null);
      setShowScheduleForm(false);
      await refreshBootstrap();
      load();
    } catch (err) {
      const details = err.response?.data?.details;
      if (Array.isArray(details) && details.length > 0) {
        toast.error(details.slice(0, 3).join('\n'), { duration: 8000 });
      } else {
        toast.error(err.response?.data?.error || 'Erreur lors de l\'importation du calendrier');
      }
    }
  };

  const exportLeagueBackup = async () => {
    try {
      const response = await api.get('/admin/export', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lhma-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Sauvegarde exportée');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de l’export');
    }
  };

  const createServerBackup = () => {
    openProtectedAction({
      key: 'create-server-backup',
      title: 'Créer une sauvegarde serveur',
      message: 'Une sauvegarde complète sera écrite sur le serveur. Confirmez avec votre mot de passe administrateur.',
      confirmLabel: 'Créer la sauvegarde',
      danger: false,
    });
  };

  const handleRestoreBackupFile = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const snapshot = JSON.parse(await file.text());
      setPendingRestoreSnapshot(snapshot);
      setPendingRestoreFilename(file.name);
      openProtectedAction({
        key: 'restore-backup',
        title: 'Restaurer une sauvegarde',
        message: `La sauvegarde ${file.name} remplacera l'état actuel de la ligue. Confirmez avec votre mot de passe administrateur.`,
        confirmLabel: 'Restaurer',
        danger: true,
      });
    } catch {
      setPendingRestoreSnapshot(null);
      setPendingRestoreFilename('');
      toast.error('Fichier de sauvegarde invalide');
    }
  };

  const generateSchedule = async e => {
    e.preventDefault();
    if (!activeSeason) return;
    try {
      const res = await api.post(`/seasons/${activeSeason.id}/generate-schedule`, {
        start_date: scheduleForm.start_date,
        rounds: parseInt(scheduleForm.rounds),
      });
      toast.success(res.data.message);
      setImportSummary({
        type: 'generated-schedule',
        title: 'Calendrier généré',
        stats: [
          { label: 'Matchs générés', value: res.data.matches || 0 },
          { label: 'Rondes', value: parseInt(scheduleForm.rounds, 10) },
          { label: 'Début', value: scheduleForm.start_date },
        ],
      });
      setShowScheduleForm(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  const simulatePlayoffs = async () => {
    openConfirmAction({
      title: 'Simuler les éliminatoires',
      confirmLabel: 'Lancer la simulation',
      message: 'Tous les matchs restants des éliminatoires seront simulés jusqu’au champion.',
      details: ['Les séries doivent déjà être démarrées.'],
      onConfirm: async () => {
        const res = await api.post('/simulate/playoffs');
        toast.success(`${res.data.message} — Champion : ${res.data.champion}`);
        load();
      },
    });
  };

  const simulateSeasonFlow = async () => {
    openConfirmAction({
      title: 'Simuler la saison active',
      confirmLabel: 'Simuler',
      message: 'Tous les matchs réguliers planifiés de la saison active seront validés avec des scores simulés.',
      details: [activeSeason ? `Saison ciblée : ${activeSeason.name}` : 'Aucune saison active'],
      onConfirm: async () => {
        const res = await api.post('/simulate/season');
        toast.success(res.data.message);
        load();
      },
    });
  };

  const advanceToNextSeason = async () => {
    openProtectedAction({
      key: 'next-season',
      title: 'Créer la prochaine saison',
      message: 'Cette action prépare une nouvelle saison active et retire les assignations actuelles pour permettre un nouveau roster. Confirmez avec votre mot de passe administrateur.',
      confirmLabel: 'Créer la saison',
      danger: false,
    });
  };

  const handleReset = async () => {
    openProtectedAction({
      key: 'reset-league',
      title: "Réinitialiser l'état de la ligue",
      message: 'Cette action supprime les matchs, buts, séries, repêchage et assignations en conservant les joueurs et les équipes. Elle est irréversible.',
      confirmLabel: 'Réinitialiser',
      danger: true,
    });
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
    const targetUser = users.find(entry => entry.id === id);
    openConfirmAction({
      title: 'Supprimer le compte',
      confirmLabel: 'Supprimer',
      danger: true,
      message: 'Ce compte utilisateur sera supprimé définitivement.',
      details: targetUser ? [`Utilisateur : ${targetUser.username}`, `Rôle : ${targetUser.role}`] : [],
      onConfirm: async () => {
        await api.delete(`/auth/users/${id}`);
        toast.success('Compte supprimé');
        setUsers(u => u.filter(x => x.id !== id));
      },
    });
  };

  const handleDeleteMatch = async id => {
    const targetMatch = matches.find(match => match.id === id);
    openConfirmAction({
      title: 'Supprimer le match',
      confirmLabel: 'Supprimer',
      danger: true,
      message: 'Ce match et sa feuille associée seront supprimés.',
      details: targetMatch ? [`${targetMatch.home_team_name} vs ${targetMatch.away_team_name}`, `${targetMatch.date?.slice(0, 16).replace('T', ' ') || 'Date inconnue'}`] : [],
      onConfirm: async () => {
        await api.delete(`/matches/${id}`);
        toast.success('Match supprimé');
        load();
      },
    });
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

  const needsSetup = Boolean(bootstrap) && !bootstrap.setupComplete;
  const previewCount = csvPreview?.players?.length || csvPreview?.assignments?.length || 0;
  const activeSeasonRegularMatches = activeSeason
    ? matches.filter(m => m.season_id === activeSeason.id && !m.is_playoff)
    : [];
  const scheduledRegularMatches = activeSeasonRegularMatches.filter(m => m.status === 'scheduled').length;
  const pendingValidationMatches = activeSeasonRegularMatches.filter(m => m.status === 'completed' && !m.validated).length;
  const validatedRegularMatches = activeSeasonRegularMatches.filter(m => m.validated).length;
  const canStartPlayoffs = Boolean(
    activeSeason &&
    activeSeason.status === 'active' &&
    activeSeasonRegularMatches.length > 0 &&
    scheduledRegularMatches === 0 &&
    pendingValidationMatches === 0
  );
  const playoffReadinessLabel = !activeSeason || activeSeason.status !== 'active'
    ? 'Les séries sont disponibles seulement pendant une saison régulière active.'
    : activeSeasonRegularMatches.length === 0
      ? 'Importez ou générez le calendrier avant de démarrer les éliminatoires.'
      : scheduledRegularMatches > 0
        ? `${scheduledRegularMatches} match(s) de saison régulière restent à jouer.`
        : pendingValidationMatches > 0
          ? `${pendingValidationMatches} match(s) terminés doivent encore être validés.`
          : 'La saison régulière est complète. Les éliminatoires peuvent démarrer.';
  const canSimulatePlayoffs = activeSeason?.status === 'playoffs';
  const startupModeLabel = bootstrap?.startupMode === 'persistent' ? 'Mode persistant' : 'Mode test réinitialisé';

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
            <h3 className="section-title mb-1">Centre d'administration</h3>
            <p className="text-sm text-gray-400 mb-3">Pilotez les opérations clés, les importations et les actions sensibles depuis un espace plus structuré.</p>
            <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2 text-sm text-gray-300 mb-3 flex items-center justify-between gap-3">
              <span>État de l'instance</span>
              <span className="text-xs font-semibold rounded-full px-2 py-1 bg-blue-500/10 text-blue-300 border border-blue-500/20">{startupModeLabel}</span>
            </div>
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
              <button onClick={exportLeagueBackup} className="btn-secondary w-full justify-start">
                <Download size={16} /> Exporter la sauvegarde JSON
              </button>
              <button onClick={createServerBackup} className="btn-secondary w-full justify-start">
                <Download size={16} /> Créer une sauvegarde serveur
              </button>
              <label className="btn-secondary w-full justify-start cursor-pointer">
                <Upload size={16} /> Restaurer une sauvegarde JSON
                <input type="file" accept=".json,application/json" className="hidden" onChange={handleRestoreBackupFile} />
              </label>
              {pendingRestoreFilename && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  Sauvegarde sélectionnée : {pendingRestoreFilename}
                </div>
              )}
              <div className="pt-2 border-t border-gray-800 space-y-2">
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide px-1 pt-1">Modèles & importation</div>
                <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-3 space-y-2 text-sm text-gray-300">
                  <div className="font-medium text-white">Modèle roster attendu</div>
                      <div className="text-xs text-gray-400">Colonnes minimales : <span className="text-gray-200">Prénom, Nom, Équipe</span>. Colonnes reconnues en plus : <span className="text-gray-200">Position, Cote, Rating, Numéro</span>.</div>
                  <div className="font-medium text-white pt-1">Modèle calendrier attendu</div>
                  <div className="text-xs text-gray-400">Colonnes minimales : <span className="text-gray-200">Jour, Date, Heure, Local, Visiteur</span>. Colonne optionnelle : <span className="text-gray-200">Endroit</span>.</div>
                </div>
                <button onClick={downloadRosterTemplate} className="w-full flex items-center gap-2 justify-start px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 border border-gray-700 transition-colors">
                  <Download size={16} /> Télécharger le modèle roster
                </button>
                <button onClick={downloadScheduleTemplate} className="w-full flex items-center gap-2 justify-start px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 border border-gray-700 transition-colors">
                  <CalendarDays size={16} /> Télécharger le modèle calendrier
                </button>
                <label className="w-full flex items-center gap-2 justify-start px-3 py-2 rounded-lg text-sm font-medium text-blue-400 hover:bg-blue-500/10 border border-blue-500/20 transition-colors cursor-pointer">
                  <Upload size={16} /> Importer le roster (CSV/XLSX)
                  <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleRosterImportFile} />
                </label>
                <label className="w-full flex items-center gap-2 justify-start px-3 py-2 rounded-lg text-sm font-medium text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20 transition-colors cursor-pointer">
                  <CalendarDays size={16} /> Importer le calendrier (CSV/XLSX)
                  <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleScheduleImportFile} />
                </label>
                {importSummary && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                    <div className="text-sm font-semibold text-white">{importSummary.title}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                      {importSummary.stats.map(stat => (
                        <div key={stat.label} className="rounded-md bg-gray-950/40 px-3 py-2">
                          <div className="text-xs text-gray-400">{stat.label}</div>
                          <div className="text-sm font-semibold text-white">{stat.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="pt-2 border-t border-gray-800 space-y-1">
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide px-1 pt-1">Cycle de saison</div>
                <button onClick={simulateSeasonFlow} className="w-full flex items-center gap-2 justify-start px-3 py-2 rounded-lg text-sm font-medium text-purple-400 hover:bg-purple-500/10 border border-purple-500/20 transition-colors">
                  <Zap size={16} /> 1. Simuler la saison active
                </button>
                <button onClick={advanceToNextSeason} className="w-full flex items-center gap-2 justify-start px-3 py-2 rounded-lg text-sm font-medium text-cyan-400 hover:bg-cyan-500/10 border border-cyan-500/20 transition-colors">
                  <RefreshCw size={16} /> 2. Créer la prochaine saison
                </button>
                <button onClick={simulatePlayoffs} disabled={!canSimulatePlayoffs} className={`w-full flex items-center gap-2 justify-start px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${canSimulatePlayoffs ? 'text-yellow-400 hover:bg-yellow-500/10 border-yellow-500/20' : 'text-gray-600 border-gray-800 cursor-not-allowed opacity-70'}`}>
                  <Trophy size={16} /> 3. Simuler les éliminatoires
                </button>
              </div>
              <div className="pt-2 border-t border-gray-800 space-y-2">
                <div className="text-xs text-red-300/80 font-medium uppercase tracking-wide px-1 pt-1">Actions sensibles</div>
                <button onClick={handleReset} className="w-full flex items-center gap-2 justify-start px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors">
                  <AlertTriangle size={16} /> Réinitialiser la ligue
                </button>
              </div>
            </div>
          </div>
          <AdminActivityPanel activityLogs={activityLogs} />
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

                {activeSeason.status === 'active' && (() => {
                  const seasonMatchCount = matches.filter(m => m.season_id === activeSeason.id && !m.is_playoff).length;
                  return seasonMatchCount === 0 ? (
                    <div className="border border-blue-500/30 rounded-lg p-3 bg-blue-500/5 space-y-2">
                      <div className="text-xs text-blue-400 font-medium flex items-center gap-1.5">
                        <CalendarDays size={13} /> Aucun match planifié — générer le calendrier
                      </div>
                      {!showScheduleForm ? (
                        <button onClick={() => setShowScheduleForm(true)} className="btn-primary w-full justify-center text-sm">
                          <CalendarDays size={14} /> Générer le calendrier
                        </button>
                      ) : (
                        <form onSubmit={generateSchedule} className="space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="label text-xs">Date de début *</label>
                              <input type="date" className="input text-sm" required
                                value={scheduleForm.start_date}
                                onChange={e => setScheduleForm(f => ({ ...f, start_date: e.target.value }))} />
                            </div>
                            <div>
                              <label className="label text-xs">Rondes</label>
                              <select className="select text-sm" value={scheduleForm.rounds}
                                onChange={e => setScheduleForm(f => ({ ...f, rounds: e.target.value }))}>
                                <option value={1}>1 (15 matchs)</option>
                                <option value={2}>2 (30 matchs)</option>
                                <option value={3}>3 (45 matchs)</option>
                                <option value={4}>4 (60 matchs)</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setShowScheduleForm(false)} className="btn-secondary flex-1 text-sm">Annuler</button>
                            <button type="submit" className="btn-primary flex-1 text-sm">Générer</button>
                          </div>
                        </form>
                      )}
                    </div>
                  ) : null;
                })()}

                {activeSeason.status === 'active' && matches.filter(m => m.season_id === activeSeason.id && !m.is_playoff).length === 0 && (
                  <label className="btn-secondary w-full justify-center cursor-pointer">
                    <Upload size={15} /> Importer un calendrier CSV
                    <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleScheduleImportFile} />
                  </label>
                )}

                {activeSeason.status === 'active' && (
                  <div className="space-y-2">
                    <div className={`rounded-lg border px-3 py-2 text-sm ${canStartPlayoffs ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-yellow-500/20 bg-yellow-500/10 text-yellow-200'}`}>
                      {playoffReadinessLabel}
                    </div>
                    <button onClick={startPlayoffs} disabled={playoffStarting || !canStartPlayoffs} className={`w-full justify-center ${canStartPlayoffs ? 'btn-primary' : 'btn-secondary opacity-60 cursor-not-allowed'}`}>
                      <Trophy size={15} /> {playoffStarting ? 'Démarrage...' : 'Démarrer les séries éliminatoires'}
                    </button>
                  </div>
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
                  <th className="hidden sm:table-cell">Date</th>
                  <th className="hidden sm:table-cell text-center">Score</th>
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
                        {m.status !== 'scheduled' && (
                          <div className="sm:hidden text-xs text-gray-500 mt-0.5">{m.home_score} – {m.away_score}</div>
                        )}
                      </div>
                    </td>
                    <td className="hidden sm:table-cell text-xs text-gray-400">{m.date?.slice(0, 16).replace('T', ' ')}</td>
                    <td className="hidden sm:table-cell text-center">
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
                  <th className="hidden sm:table-cell">Joueur associé</th>
                  <th className="hidden md:table-cell">Créé le</th>
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
                      <td className="hidden sm:table-cell text-gray-400 text-sm">
                        {linked ? `${linked.first_name} ${linked.last_name}` : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="hidden md:table-cell text-gray-500 text-sm">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('fr-CA') : '—'}
                      </td>
                      <td className="text-right">
                        {!isSelf && (
                          <button onClick={() => deleteUser(u.id)} className="text-gray-600 hover:text-red-400 transition-colors p-2" title="Supprimer">
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

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {teams.map(t => {
              const teamPlayers = players
                .filter(p => p.team_id === t.id && p.status === 'active')
                .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));

              return (
                <div key={`jersey-${t.id}`} className="card space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                    <h3 className="section-title !mb-0">{t.name}</h3>
                  </div>
                  <div className="space-y-2">
                    {teamPlayers.length === 0 && (
                      <div className="text-sm text-gray-500">Aucun joueur assigné</div>
                    )}
                    {teamPlayers.map(player => (
                      <div key={player.id} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-white truncate">{player.first_name} {player.last_name}</div>
                          <div className="text-xs text-gray-500">{player.position || 'Joueur'}</div>
                        </div>
                        <input
                          className="input w-20 text-center"
                          inputMode="numeric"
                          placeholder="1-99"
                          value={jerseyNumbers[player.id] ?? ''}
                          onChange={e => updateJerseyDraft(player.id, e.target.value)}
                          onBlur={() => saveJerseyNumber(player)}
                        />
                        <button
                          type="button"
                          onClick={() => saveJerseyNumber(player)}
                          disabled={savingJerseyId === player.id}
                          className="btn-secondary py-2 px-3"
                        >
                          {savingJerseyId === player.id ? '...' : 'OK'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AdminPasswordModal
        config={protectedAction}
        password={adminPassword}
        setPassword={setAdminPassword}
        submitting={submittingProtectedAction}
        onClose={closeProtectedAction}
        onConfirm={executeProtectedAction}
      />
      <ConfirmActionModal
        config={confirmAction}
        submitting={submittingConfirmAction}
        onClose={closeConfirmAction}
        onConfirm={runConfirmAction}
      />

      {showUserModal && <UserModal players={players} teams={teams} onClose={() => setShowUserModal(false)} onSave={() => { setShowUserModal(false); api.get('/auth/users').then(res => setUsers(res.data)).catch(() => {}); }} />}
      {showMatchModal && <ScheduleMatchModal teams={teams} seasons={seasons} onClose={() => setShowMatchModal(false)} onSave={() => { setShowMatchModal(false); load(); }} />}
      <AdminSetupModal
        needsSetup={needsSetup}
        currentUser={currentUser}
        bootstrap={bootstrap}
        activeSeason={activeSeason}
        downloadRosterTemplate={downloadRosterTemplate}
        downloadScheduleTemplate={downloadScheduleTemplate}
        handleRosterImportFile={handleRosterImportFile}
        handleScheduleImportFile={handleScheduleImportFile}
      />
      <CsvPreviewModal
        csvPreview={csvPreview}
        setCsvPreview={setCsvPreview}
        applyCSVImport={applyCSVImport}
      />
      <SchedulePreviewModal
        schedulePreview={schedulePreview}
        setSchedulePreview={setSchedulePreview}
        activeSeason={activeSeason}
        applyScheduleImport={applyScheduleImport}
      />
    </div>
  );
}
