import { X, Download, Upload, CalendarDays, Check } from 'lucide-react';

export function AdminSetupModal({
  needsSetup,
  currentUser,
  bootstrap,
  activeSeason,
  downloadRosterTemplate,
  downloadScheduleTemplate,
  handleRosterImportFile,
  handleScheduleImportFile,
}) {
  if (!needsSetup || currentUser?.role !== 'admin') return null;

  return (
    <div className="modal-overlay">
      <div className="modal max-w-2xl w-full">
        <div className="modal-header">
          <h3 className="text-lg font-bold text-white">Configuration initiale requise</h3>
        </div>
        <div className="modal-body space-y-4">
          <p className="text-sm text-gray-300">
            {bootstrap?.startupMode === 'persistent'
              ? "Cette instance conserve les données entre les redémarrages. Commencez par importer un roster, puis le calendrier de la saison."
              : "Cette instance repart à zéro à chaque démarrage. Pour tester l'application, importez d'abord un roster, puis le calendrier de la saison."}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4 space-y-2">
              <div className="text-sm font-semibold text-white">1. Roster</div>
              <div className="text-xs text-gray-400">Crée les équipes, les joueurs et la saison active vide.</div>
              <button onClick={downloadRosterTemplate} className="btn-secondary w-full justify-center">
                <Download size={15} /> Télécharger le modèle roster
              </button>
              <label className="btn-primary w-full justify-center cursor-pointer">
                <Upload size={15} /> Importer le roster (CSV/XLSX)
                <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleRosterImportFile} />
              </label>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4 space-y-2">
              <div className="text-sm font-semibold text-white">2. Calendrier</div>
              <div className="text-xs text-gray-400">Disponible après le roster, quand la saison active existe.</div>
              <button onClick={downloadScheduleTemplate} className="btn-secondary w-full justify-center">
                <CalendarDays size={15} /> Télécharger le modèle calendrier
              </button>
              <label className={`w-full justify-center cursor-pointer ${activeSeason ? 'btn-primary' : 'btn-secondary opacity-60 pointer-events-none'}`}>
                <CalendarDays size={15} /> Importer le calendrier (CSV/XLSX)
                <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleScheduleImportFile} disabled={!activeSeason} />
              </label>
            </div>
          </div>
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-200">
            État actuel : {bootstrap?.hasRoster ? 'roster importé' : 'roster manquant'} / {bootstrap?.hasSchedule ? 'calendrier importé' : 'calendrier manquant'}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CsvPreviewModal({ csvPreview, setCsvPreview, applyCSVImport }) {
  if (!csvPreview) return null;

  return (
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
  );
}

export function SchedulePreviewModal({ schedulePreview, setSchedulePreview, activeSeason, applyScheduleImport }) {
  if (!schedulePreview) return null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSchedulePreview(null)}>
      <div className="modal max-w-3xl w-full">
        <div className="modal-header">
          <h3 className="text-lg font-bold text-white">Confirmer l'importation du calendrier</h3>
          <button onClick={() => setSchedulePreview(null)} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <div className="modal-body max-h-[60vh] overflow-y-auto space-y-4">
          <p className="text-sm text-gray-400">
            <span className="font-semibold text-white">{schedulePreview.matches.length} matchs</span> détectés pour {activeSeason?.name || 'la saison active'}.
          </p>
          {schedulePreview.errors.length > 0 && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-300">
              {schedulePreview.errors.slice(0, 5).map((error, index) => (
                <div key={index}>{error}</div>
              ))}
            </div>
          )}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Local</th>
                  <th>Visiteur</th>
                  <th className="hidden sm:table-cell">Endroit</th>
                </tr>
              </thead>
              <tbody>
                {schedulePreview.matches.slice(0, 30).map((match, index) => (
                  <tr key={`${match.date}-${index}`}>
                    <td className="text-sm text-gray-300">{match.date}</td>
                    <td className="text-sm text-white">{match.home_team_name}</td>
                    <td className="text-sm text-gray-300">{match.away_team_name}</td>
                    <td className="hidden sm:table-cell text-sm text-gray-500">{match.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={() => setSchedulePreview(null)} className="btn-secondary">Annuler</button>
          <button onClick={applyScheduleImport} className="btn-primary" disabled={schedulePreview.errors.length > 0}>
            <Upload size={15} /> Importer
          </button>
        </div>
      </div>
    </div>
  );
}
