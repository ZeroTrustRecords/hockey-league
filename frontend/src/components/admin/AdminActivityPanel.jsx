import { useMemo, useState } from 'react';

const activityActionLabels = {
  'league.reset': 'Réinitialisation de la ligue',
  'schedule.generated': 'Calendrier généré',
  'schedule.imported': 'Calendrier importé',
  'roster.imported': 'Roster importé',
  'season.simulated': 'Saison simulée',
  'season.history-seeded': 'Historique alimenté',
  'playoffs.started': 'Éliminatoires démarrées',
  'playoffs.simulated': 'Éliminatoires simulées',
  'season.created-next': 'Prochaine saison créée',
  'user.created': 'Compte créé',
  'user.deleted': 'Compte supprimé',
  'match.created': 'Match créé',
  'match.deleted': 'Match supprimé',
  'match.validated': 'Match validé',
  'player.jersey-number.updated': 'Numéro de chandail mis à jour',
};

function formatActivityDetails(details) {
  if (!details) return '';
  if (details.season_name) return `Saison: ${details.season_name}`;
  if (details.matches != null && details.rounds != null) return `${details.matches} matchs · ${details.rounds} rondes`;
  if (details.games != null && details.champion) return `${details.games} matchs · Champion: ${details.champion}`;
  if (details.players != null && details.teams != null) return `${details.players} joueurs · ${details.teams} équipes`;
  if (details.username && details.role) return `${details.username} · ${details.role}`;
  if (details.number != null) return `Nouveau numéro: ${details.number}`;
  if (details.home_team_id && details.away_team_id) return `Équipes: ${details.home_team_id} vs ${details.away_team_id}`;
  return Object.entries(details).slice(0, 2).map(([key, value]) => `${key}: ${value}`).join(' · ');
}

export default function AdminActivityPanel({ activityLogs }) {
  const [filter, setFilter] = useState('all');
  const filteredLogs = useMemo(() => (
    filter === 'all'
      ? activityLogs
      : activityLogs.filter(log => log.action.startsWith(filter))
  ), [activityLogs, filter]);

  const formatTimestamp = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat('fr-CA', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(date);
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="section-title !mb-0">Journal d'activité</h3>
        <select className="select !w-auto text-sm" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">Tout</option>
          <option value="roster">Rosters</option>
          <option value="schedule">Calendriers</option>
          <option value="season">Saisons</option>
          <option value="playoffs">Éliminatoires</option>
          <option value="user">Comptes</option>
          <option value="match">Matchs</option>
          <option value="player">Joueurs</option>
          <option value="league">Ligue</option>
        </select>
      </div>
      {filteredLogs.length === 0 ? (
        <div className="text-sm text-gray-500">Aucune action récente enregistrée.</div>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map(log => (
            <div key={log.id} className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-white font-medium">{activityActionLabels[log.action] || log.action}</div>
                <div className="text-xs text-gray-500">{formatTimestamp(log.created_at)}</div>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {log.username || 'Système'}
                {log.entity_type ? ` · ${log.entity_type}` : ''}
                {log.entity_id ? ` #${log.entity_id}` : ''}
              </div>
              {log.details && <div className="text-xs text-gray-500 mt-1">{formatActivityDetails(log.details)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
