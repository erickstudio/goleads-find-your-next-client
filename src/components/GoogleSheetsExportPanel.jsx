import { useState, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  FileSpreadsheet,
  ExternalLink,
  Download,
  Plug,
  CheckCircle2,
  LoaderCircle,
  Unplug,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  getGoogleSheetsConnectionStatus,
  exportLeadsToGoogleSheets,
} from "@/lib/server-fns";
import { usePreferences } from "@/lib/PreferencesContext";

const GOOGLE_SHEETS_CONNECTOR_ID = "6ae79347cd3d8383bd8d098a";

function buildClientCsv(records = [], feedbackByOppId = new Map()) {
  const headers = [
    "lead_id",
    "business_name",
    "business_category",
    "location",
    "website_url",
    "signal_type",
    "signal_summary",
    "source_verification_status",
    "user_commercial_stage",
    "user_relevance_verdict",
    "publication_date",
    "event_date",
    "source_title",
    "source_url",
    "supporting_excerpt",
    "service_fit_hypothesis",
    "target_services",
    "outreach_draft",
    "qualification_notes",
    "retrieved_at_utc",
  ];

  const escapeCell = (val) => {
    const s = String(val ?? "").replace(/\r?\n/g, " ").trim();
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = records.map((rec) => {
    const oppId = rec.opportunity_id || rec.id || "";
    const fb = feedbackByOppId?.get ? feedbackByOppId.get(oppId) : null;
    const services = Array.isArray(rec.inferred_service_categories)
      ? rec.inferred_service_categories.join("; ")
      : "";
    return [
      oppId,
      rec.business_name || "",
      rec.business_category || "",
      rec.location || "",
      rec.website_url || "",
      rec.signal_type || "",
      rec.signal_summary || "",
      rec.verification_status || "needs_review",
      rec.review_stage || "saved",
      fb?.verdict || "unrated",
      rec.publication_date || "",
      rec.event_date || "",
      rec.source_title || "",
      rec.source_url || "",
      rec.supporting_excerpt || "",
      rec.service_fit_inference || "",
      services,
      rec.outreach_draft || "",
      rec.qualification_notes || "",
      rec.retrieval_date || "",
    ];
  });

  return [headers, ...rows]
    .map((r) => r.map(escapeCell).join(","))
    .join("\r\n");
}

export default function GoogleSheetsExportPanel({
  source = "saved",
  records = [],
  selectedIds = [],
  stageFilter = "all",
  feedbackByOppId = new Map(),
}) {
  const { lang } = usePreferences();
  const isEs = lang === "es";

  const checkStatusFn = useServerFn(getGoogleSheetsConnectionStatus);
  const exportSheetsFn = useServerFn(exportLeadsToGoogleSheets);

  const [user, setUser] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);
  const [exportResult, setExportResult] = useState(null);

  // Rule 2: reusable fetch — doubles as connection check AND data loader
  const fetchData = useCallback(async () => {
    try {
      const res = await checkStatusFn();
      setConnected(Boolean(res?.connected));
      setError(null);
    } catch (e) {
      setError(
        e?.message ||
          (isEs
            ? "No se pudo verificar el estado de Google Sheets."
            : "Could not verify Google Sheets status.")
      );
    }
  }, [checkStatusFn, isEs]);

  // Rule 1+2: check auth first, then fetch to detect connection status
  useEffect(() => {
    let active = true;
    base44.auth.isAuthenticated().then(async (authed) => {
      if (!active) return;
      if (authed) {
        const me = await base44.auth.me().catch(() => null);
        if (!active) return;
        setUser(me);
        await fetchData();
      }
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [fetchData]);

  // Rule 3: open OAuth popup, poll for close, then re-fetch
  const handleConnect = async () => {
    setError(null);
    try {
      const url = await base44.connectors.connectAppUser(GOOGLE_SHEETS_CONNECTOR_ID);
      const popup = window.open(url, "_blank");
      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          fetchData();
        }
      }, 500);
    } catch (e) {
      setError(
        e?.message ||
          (isEs
            ? "No se pudo abrir la ventana de conexión con Google Sheets."
            : "Could not open Google Sheets connection window.")
      );
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    try {
      await base44.connectors.disconnectAppUser(GOOGLE_SHEETS_CONNECTOR_ID);
      setConnected(false);
      setExportResult(null);
    } catch (e) {
      setError(
        e?.message ||
          (isEs
            ? "No se pudo desconectar Google Sheets."
            : "Could not disconnect Google Sheets.")
      );
    }
  };

  const exportableRecords = records.filter((r) => {
    const id = r.opportunity_id || r.id || "";
    if (String(id).startsWith("demo-")) return false;
    if (selectedIds.length > 0) return selectedIds.includes(id);
    return true;
  });

  const handleExportToGoogleSheets = async () => {
    if (exportableRecords.length === 0) return;
    setIsExporting(true);
    setError(null);
    setExportResult(null);
    try {
      const targetIds =
        selectedIds.length > 0
          ? selectedIds.filter((id) => !String(id).startsWith("demo-"))
          : exportableRecords.map((r) => r.opportunity_id || r.id);

      const res = await exportSheetsFn({
        data: {
          source,
          opportunity_ids: targetIds,
          stage_filter: stageFilter,
        },
      });

      if (!res?.connected) {
        setConnected(false);
        return;
      }

      setExportResult(res);
    } catch (e) {
      setError(
        e?.message ||
          (isEs
            ? "No se pudo exportar los leads a Google Sheets."
            : "Could not export leads to Google Sheets.")
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadCsv = () => {
    if (exportableRecords.length === 0) return;
    const csv = buildClientCsv(exportableRecords, feedbackByOppId);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `goleads-crm-mcp-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground flex items-center gap-2">
        <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
        <span>
          {isEs
            ? "Verificando conexión con Google Sheets…"
            : "Checking Google Sheets connection…"}
        </span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">
          {isEs
            ? "Inicia sesión para conectar tu cuenta de Google Sheets y exportar tus leads."
            : "Sign in to connect your Google Sheets account and export your leads."}
        </span>
        <button
          type="button"
          onClick={() => base44.auth.redirectToLogin()}
          className="rounded-lg bg-primary px-3.5 py-2 font-semibold text-primary-foreground"
        >
          {isEs ? "Iniciar sesión" : "Sign in"}
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label={isEs ? "Exportación a Google Sheets, CRM y MCP" : "Google Sheets, CRM & MCP Export"}
      className="rounded-xl border border-primary/25 bg-card p-4 sm:p-5 space-y-3"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Google Sheets · CRM · MCP
            </span>
            <span className="text-xs text-muted-foreground">
              {selectedIds.length > 0
                ? isEs
                  ? `${exportableRecords.length} lead(s) seleccionado(s) listo(s) para exportar`
                  : `${exportableRecords.length} selected lead(s) ready to export`
                : isEs
                ? `${exportableRecords.length} lead(s) en esta vista listo(s) para exportar`
                : `${exportableRecords.length} lead(s) in this view ready to export`}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isEs
              ? "Exporta tus leads con columnas estructuradas (ID del lead, verificación de fuente, etapa comercial, fechas, extracto y borrador) listas para Google Sheets, tu CRM o asistentes IA conectados por MCP."
              : "Export your leads with structured columns (lead ID, source verification, commercial stage, dates, excerpt, and outreach draft) ready for Google Sheets, your CRM, or MCP-connected AI assistants."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!connected ? (
            <button
              type="button"
              onClick={handleConnect}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {isEs
                ? "Conectar mi cuenta de Google Sheets"
                : "Connect my Google Sheets account"}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={isExporting || exportableRecords.length === 0}
                onClick={handleExportToGoogleSheets}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {isExporting ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                )}
                {isExporting
                  ? isEs
                    ? "Exportando a Google Sheets…"
                    : "Exporting to Google Sheets…"
                  : isEs
                  ? `Exportar a Google Sheets (${exportableRecords.length})`
                  : `Export to Google Sheets (${exportableRecords.length})`}
              </button>

              <button
                type="button"
                onClick={handleDisconnect}
                title={
                  isEs
                    ? "Desconectar cuenta de Google Sheets"
                    : "Disconnect Google Sheets account"
                }
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/60 px-2.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <Unplug className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {isEs ? "Desconectar" : "Disconnect"}
                </span>
              </button>
            </>
          )}

          <button
            type="button"
            disabled={exportableRecords.length === 0}
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5 text-primary" />
            {isEs ? "CSV (CRM / Sheets)" : "CSV (CRM / Sheets)"}
          </button>

          <Link
            to="/connect"
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20"
          >
            <Plug className="h-3.5 w-3.5" />
            {isEs ? "Guía MCP" : "MCP Guide"}
          </Link>
        </div>
      </div>

      {exportResult?.spreadsheetUrl && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-800 dark:text-emerald-200"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              {isEs
                ? `Se exportaron ${exportResult.exportedCount} lead(s) a «${exportResult.spreadsheetTitle}» en tu Google Sheets.`
                : `Exported ${exportResult.exportedCount} lead(s) to "${exportResult.spreadsheetTitle}" in your Google Sheets.`}
            </span>
          </div>
          <a
            href={exportResult.spreadsheetUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold underline hover:opacity-90"
          >
            <span>
              {isEs ? "Abrir hoja de cálculo" : "Open spreadsheet"}
            </span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-2 text-xs text-destructive"
        >
          {error}
        </div>
      )}
    </section>
  );
}