import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FileSpreadsheet,
  FileText,
  Plug,
  CheckCircle2,
  Lock,
  RefreshCw,
} from "lucide-react";
import { usePreferences } from "@/lib/PreferencesContext";
import useGoogleIntegration from "@/hooks/useGoogleIntegration";

export const Route = createFileRoute("/_authed/integrations")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Integrations — GoLeads" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Integrations,
});

function Integrations() {
  const { lang } = usePreferences();
  const es = lang === "es";
  const google = useGoogleIntegration();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(fn) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch {
      setMessage(
        es
          ? "No pudimos actualizar tu conexión. Inténtalo de nuevo."
          : "Unable to update your connection. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  const pro = Boolean(google.data?.access?.isPro);
  const connected = Boolean(google.data?.connected);

  return (
    <div className="max-w-4xl space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {es ? "Integraciones y exportación" : "Integrations & export"}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {es ? "Tus leads, en tus herramientas" : "Your leads, in your tools"}
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            {es
              ? "Conecta tu propia cuenta de Google para exportar leads o conecta tu asistente de IA mediante MCP."
              : "Connect your own Google account to export leads, or connect your AI assistant via MCP."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            to="/saved"
            className="rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:bg-secondary"
          >
            {es ? "Ver leads guardados" : "View saved leads"}
          </Link>
          <Link
            to="/connect"
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            MCP
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {/* Google Sheets Card */}
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-foreground">Google Sheets</h2>
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                    {es ? "Incluido en Gratis y Pro" : "Included in Free & Pro"}
                  </span>
                </div>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  {es
                    ? "Exporta tus leads seleccionados con email, teléfono, Google Maps y señales verificadas a una hoja de cálculo en tu cuenta de Google."
                    : "Export selected leads with email, phone, Google Maps, and verified signals to a spreadsheet in your Google account."}
                </p>
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                connected
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  : "bg-secondary text-muted-foreground border-border"
              }`}
            >
              {google.isPending
                ? es
                  ? "Comprobando conexión…"
                  : "Checking connection…"
                : google.isError
                ? es
                  ? "Error al comprobar"
                  : "Check failed"
                : connected
                ? es
                  ? "Google conectado"
                  : "Google connected"
                : es
                ? "Sin conectar"
                : "Not connected"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-border/70">
            <button
              type="button"
              disabled={busy || !google.data}
              onClick={() => act(connected ? google.disconnect : google.connect)}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {connected
                ? es
                  ? "Desconectar Google"
                  : "Disconnect Google"
                : es
                ? "Conectar mi Google"
                : "Connect my Google"}
            </button>
            <button
              type="button"
              onClick={() => google.refetch()}
              disabled={google.isFetching}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${google.isFetching ? "animate-spin" : ""}`} />
              {es ? "Comprobar estado" : "Check status"}
            </button>
          </div>
        </section>

        {/* Workspace Docs + CSV Card */}
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-foreground">
                    Google Docs + Drive & CSV
                  </h2>
                  <span className="rounded-full bg-primary/15 border border-primary/30 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                    GoLeads Pro
                  </span>
                </div>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {es
                    ? "Genera un documento estructurado en tu Google Drive con los leads seleccionados y sus borradores de contacto, o descarga un archivo CSV listo para tu CRM."
                    : "Create a structured document in your Google Drive with selected leads and their outreach drafts, or download a CSV file ready for your CRM."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-border/70">
            <Link
              to={pro ? "/saved" : "/plans"}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {pro
                ? es
                  ? "Exportar desde Leads guardados"
                  : "Export from Saved leads"
                : es
                ? "Activar GoLeads Pro"
                : "Upgrade to GoLeads Pro"}
            </Link>
          </div>
        </section>

        {/* MCP Card */}
        <section className="rounded-xl border border-primary/30 bg-card p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Plug className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-foreground">MCP</h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    {es
                      ? "Gratis (básico) y Pro (completo) · Solo lectura"
                      : "Free (basic) & Pro (full) · Read-only"}
                  </span>
                </div>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {es
                    ? "Conecta Claude, ChatGPT, Cursor u otros clientes MCP en modo de solo lectura (sin permisos para modificar nada). Gratis permite consultas básicas (hasta 5 leads); Pro desbloquea hasta 50 leads con email, teléfono, Google Maps y borradores."
                    : "Connect Claude, ChatGPT, Cursor, or other MCP clients in read-only mode (cannot modify anything). Free includes basic queries (up to 5 leads); Pro unlocks up to 50 leads with email, phone, Google Maps, and drafts."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-border/70">
            <Link
              to="/connect"
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {es ? "Abrir MCP" : "Open MCP"}
            </Link>
            {!pro && (
              <Link
                to="/plans"
                className="rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:bg-secondary"
              >
                {es ? "Ampliar a MCP Pro" : "Upgrade to MCP Pro"}
              </Link>
            )}
          </div>
        </section>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {es
          ? "Nota: El envío directo por Gmail, Google Calendar y la sincronización directa con CRM aún no están disponibles. Puedes preparar tus borradores y exportar tus leads a Google Sheets, Google Docs o CSV."
          : "Note: Direct Gmail sending, Google Calendar, and direct CRM sync are not available yet. You can prepare outreach drafts and export your leads to Google Sheets, Google Docs, or CSV."}
      </p>

      {message && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}