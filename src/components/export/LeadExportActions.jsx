import { Link } from "@tanstack/react-router";
import { Download, FileSpreadsheet, LoaderCircle } from "lucide-react";

export default function LeadExportActions({ connection: c, exporter: e, es }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={!e.count || e.busy || c.busy || c.loading || c.connected !== true} onClick={e.exportSheets} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring">
        {e.busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
        {e.busy ? es ? "Exportando…" : "Exporting…" : `${es ? "Exportar a Sheets" : "Export to Sheets"} (${e.count})`}
      </button>
      <button type="button" disabled={!e.count} onClick={e.downloadCsv} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-xs font-medium hover:bg-secondary disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring"><Download className="h-4 w-4 text-primary" />{es ? "Descargar CSV" : "Download CSV"} ({e.count})</button>
      <Link to="/connect" className="inline-flex min-h-11 items-center px-2 text-xs font-medium text-primary hover:underline">{es ? "Guía MCP · Pro en preparación" : "MCP guide · Pro in preparation"}</Link>
    </div>
  );
}