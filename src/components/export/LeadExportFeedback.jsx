export default function LeadExportFeedback({ error, result, csvDone, es }) {
  return (
    <div className="space-y-2 text-xs leading-6">
      {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive">{error.text}</p>}
      {csvDone && <p role="status" className="text-primary">{es ? "Se inició la descarga CSV de la selección actual." : "CSV download started for the current selection."}</p>}
      {result?.spreadsheetUrl && (
        <div role="status" className="rounded-lg border border-primary/30 bg-primary/10 p-3 space-y-1">
          <p>{es ? `Google confirmó la exportación de ${result.exportedCount} de ${result.requestedCount} leads solicitados.` : `Google confirmed export of ${result.exportedCount} of ${result.requestedCount} requested leads.`}</p>
          {result.exportedCount !== result.requestedCount && <p>{es ? "Exportación parcial: faltan leads. La consulta actual del servidor está limitada a los 100 registros más recientes; conserva la selección y descarga CSV." : "Partial export: some leads are missing. The current server query is limited to the 100 latest records; keep your selection and download CSV."}</p>}
          <a href={result.spreadsheetUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center font-semibold text-primary underline">{es ? "Abrir hoja de cálculo" : "Open spreadsheet"}</a>
        </div>
      )}
    </div>
  );
}