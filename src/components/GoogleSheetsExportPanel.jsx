import { usePreferences } from "@/lib/PreferencesContext";
import useGoogleSheetsConnection from "@/hooks/useGoogleSheetsConnection";
import useLeadExport from "@/hooks/useLeadExport";
import { sheetsError } from "@/lib/sheets-errors";
import SheetsConnectionActions from "@/components/export/SheetsConnectionActions";
import LeadExportActions from "@/components/export/LeadExportActions";
import LeadExportFeedback from "@/components/export/LeadExportFeedback";

export default function GoogleSheetsExportPanel({ source = "saved", records = [], selectedIds = [], savedRecords = [], stageFilter = "all", feedbackByOppId = new Map() }) {
  const { lang } = usePreferences();
  const es = lang === "es";
  const connection = useGoogleSheetsConnection();
  const exporter = useLeadExport({ source, records, selectedIds, savedRecords, stageFilter, feedbackByOppId, connection });
  const error = exporter.error || connection.error;
  const readableError = error ? sheetsError(error, es) : null;
  return (
    <section aria-label={es ? "Exportar leads a Google Sheets o CSV" : "Export leads to Google Sheets or CSV"} className="rounded-xl border border-primary/25 bg-card p-4 sm:p-5 space-y-4">
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Google Sheets · CSV</h2>
        <p className="text-xs leading-6 text-muted-foreground">{es ? "Exporta negocio, ubicación, fuente, verificación, etapa comercial, fechas y borrador guardado cuando exista. Sin selección se exporta esta vista; con selección, solo los leads marcados que siguen visibles. La demo no se exporta." : "Export business, location, source, verification, commercial stage, dates and a saved draft when available. With no selection, export this view; otherwise, only selected leads still visible. Demo data is excluded."}</p>
        <p className="text-xs leading-6 text-muted-foreground">{es ? "Iniciar sesión con Google no autoriza Sheets. Conecta aquí tu cuenta por separado. Esto crea una hoja nueva, no envía emails ni sincroniza un CRM. CSV funciona sin conectar Google." : "Signing in with Google does not authorize Sheets. Connect your account separately here. This creates a new spreadsheet; it does not send emails or sync a CRM. CSV works without connecting Google."}</p>
      </div>
      <SheetsConnectionActions connection={connection} es={es} reconnect={readableError?.reconnect} exporting={exporter.busy} />
      <LeadExportActions connection={connection} exporter={exporter} es={es} />
      <LeadExportFeedback error={readableError} result={exporter.result} csvDone={exporter.csvDone} es={es} />
    </section>
  );
}