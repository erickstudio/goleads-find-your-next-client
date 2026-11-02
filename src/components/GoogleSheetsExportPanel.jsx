import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { exportLeadsToGoogleSheets } from "@/lib/sheets-server-fns";
import { exportLeadsToCsv, exportLeadsToWorkspaceDocument } from "@/lib/pro-integrations-fns";
import { usePreferences } from "@/lib/PreferencesContext";
import useGoogleIntegration from "@/hooks/useGoogleIntegration";

export default function GoogleSheetsExportPanel({ source = "saved", records = [], selectedIds = [], stageFilter = "all" }) {
  const { lang } = usePreferences(); const es = lang === "es"; const google = useGoogleIntegration();
  const sheets = useServerFn(exportLeadsToGoogleSheets); const csv = useServerFn(exportLeadsToCsv); const doc = useServerFn(exportLeadsToWorkspaceDocument);
  const [busy,setBusy] = useState(false); const [error,setError] = useState(""); const [result,setResult] = useState(null);
  const ids = records.filter((r) => !r.is_example && !String(r.opportunity_id || r.id).startsWith("demo-")).map((r) => r.opportunity_id || r.id).filter((id) => !selectedIds.length || selectedIds.includes(id)).slice(0,100);
  async function exportTo(kind) {
    if (busy || !ids.length) return;
    setBusy(true); setError(""); setResult(null);
    try {
      if (kind === "sheets") {
        const value = await sheets({ data: { source, opportunity_ids: ids, stage_filter: stageFilter } });
        if (!value?.connected && !value?.spreadsheetUrl && !value?.spreadsheet_url) throw new Error("Connect Google");
        setResult({ url: value.spreadsheetUrl || value.spreadsheet_url || value.url, name: "Google Sheets" });
      } else if (kind === "doc") setResult(await doc({ data: { opportunity_ids: ids } }));
      else {
        const value = await csv({ data: { opportunity_ids: ids } });
        const url = URL.createObjectURL(new Blob(["\uFEFF", value.csv], { type: "text/csv;charset=utf-8" }));
        const a = document.createElement("a"); a.href = url; a.download = `goleads-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
        setResult({ name: es ? "CSV descargado" : "CSV downloaded" });
      }
    } catch { setError(es ? "No pudimos exportar. Comprueba tu conexión y tu plan, e inténtalo de nuevo." : "Unable to export. Check your connection and plan, then try again."); }
    finally { setBusy(false); }
  }
  const pro = google.data?.access?.isPro;
  return <section className="space-y-3 rounded-xl border border-border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">{es ? "Exportar leads" : "Export leads"}</h3><p className="mt-1 text-xs text-muted-foreground">{ids.length} {es ? "leads · Sheets incluido en Gratis" : "leads · Sheets included in Free"}</p></div><div className="flex flex-wrap gap-2">{google.data?.connected ? <button disabled={busy || !ids.length} onClick={() => exportTo("sheets")} className="rounded-lg border border-border px-3 py-2 text-xs font-medium disabled:opacity-50">{busy ? "…" : "Google Sheets"}</button> : <Link to="/integrations" className="rounded-lg border border-border px-3 py-2 text-xs font-medium">{es ? "Conectar Google" : "Connect Google"}</Link>}{pro ? <><button disabled={busy || !ids.length} onClick={() => exportTo("csv")} className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-50">CSV · Pro</button><button disabled={busy || !ids.length || !google.data?.connected} onClick={() => exportTo("doc")} className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-50">Docs + Drive · Pro</button></> : <Link to="/plans" className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary">{es ? "CSV y Workspace con Pro" : "CSV and Workspace with Pro"}</Link>}</div></div>{google.isError && <p role="alert" className="text-xs text-destructive">{es ? "No se pudo comprobar la conexión." : "Could not check connection."}</p>}{error && <p role="alert" className="text-xs text-destructive">{error}</p>}{result && <p role="status" className="text-xs text-primary">{result.url ? <a href={result.url} target="_blank" rel="noopener noreferrer" className="underline">{es ? "Abrir: " : "Open: "}{result.name} ↗</a> : result.name}</p>}</section>;
}
