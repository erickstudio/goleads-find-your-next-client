import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Copy,
  Check,
  Sparkles,
  Lock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { getCurrentPlanAccess } from "@/lib/pro-integrations-fns";
import { usePreferences } from "@/lib/PreferencesContext";
import McpClientGuides from "@/components/mcp/McpClientGuides";
import McpTroubleshooting from "@/components/mcp/McpTroubleshooting";

export const Route = createFileRoute("/_authed/connect")({
  ssr: false,
  loader: () => getCurrentPlanAccess(),
  head: () => ({
    meta: [
      { title: "Conectar asistente (MCP) — GoLeads" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Connect,
});

const DEFAULT_FALLBACK_ENDPOINT = "https://goleads.space/api/mcp";

function Connect() {
  const access = Route.useLoaderData();
  const { lang } = usePreferences();
  const es = lang === "es";

  const [mcpEndpoint, setMcpEndpoint] = useState(DEFAULT_FALLBACK_ENDPOINT);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [testState, setTestState] = useState({
    loading: false,
    checked: false,
    ok: false,
    count: 0,
    message: "",
  });

  useEffect(() => {
    try {
      setMcpEndpoint(new URL("/api/mcp", window.location.origin).toString());
    } catch {
      setMcpEndpoint(DEFAULT_FALLBACK_ENDPOINT);
    }
  }, []);

  const isPro = Boolean(access?.isPro);
  const entitlementLabel = access?.isOwner
    ? es
      ? "Pro activo · Propietario"
      : "Pro active · Owner"
    : access?.entitlementSource === "complimentary"
    ? es
      ? "Pro activo · Otorgado por administrador"
      : "Pro active · Administrator grant"
    : isPro
    ? es
      ? "Pro activo · Suscripción"
      : "Pro active · Subscription"
    : es
    ? "Plan Gratis · Requiere Pro para MCP"
    : "Free Plan · Pro required for MCP";

  const handleCopyEndpoint = async () => {
    try {
      await navigator.clipboard.writeText(mcpEndpoint);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      setCopiedUrl(false);
    }
  };

  const handleVerifySavedLeadsAccess = async () => {
    setTestState({ loading: true, checked: false, ok: false, count: 0, message: "" });
    try {
      const res = await fetch("/api/mcp-leads", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTestState({
          loading: false,
          checked: true,
          ok: false,
          count: 0,
          message:
            payload?.error ||
            (es
              ? "Tu cuenta actual no tiene acceso Pro para usar MCP."
              : "Your current account does not have Pro access to use MCP."),
        });
        return;
      }
      const count = Number(payload?.count) || 0;
      setTestState({
        loading: false,
        checked: true,
        ok: true,
        count,
        message:
          count === 0
            ? es
              ? "Conexión verificada. Tu cuenta Pro está lista para MCP, pero aún no tienes leads guardados. Ve a «Encuentra clientes» y pulsa «Guardar lead» para poder consultarlos desde tu asistente."
              : "Connection verified. Your Pro account is ready for MCP, but you have 0 saved leads so far. Go to 'Find leads' and click 'Save lead' so your assistant can read them."
            : es
            ? `Conexión verificada: tu herramienta MCP responde correctamente y tiene acceso de lectura a ${count} lead(s) guardado(s).`
            : `Connection verified: your MCP tool responds properly with read-only access to ${count} saved lead(s).`,
      });
    } catch {
      setTestState({
        loading: false,
        checked: true,
        ok: false,
        count: 0,
        message: es
          ? "No pudimos comprobar el servicio en este momento. Inténtalo de nuevo."
          : "Could not verify the service right now. Please try again.",
      });
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 border border-primary/30 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              {es ? "Requiere GoLeads Pro · OAuth 2.0" : "Requires GoLeads Pro · OAuth 2.0"}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                isPro
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  : "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35"
              }`}
            >
              {isPro ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              {entitlementLabel}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {es ? "Conectar asistente (MCP)" : "Connect assistant (MCP)"}
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            {es
              ? "Conecta Claude, ChatGPT, Cursor u otros clientes MCP para consultar tus propios leads guardados en modo de solo lectura. Disponible exclusivamente con GoLeads Pro activo."
              : "Connect Claude, ChatGPT, Cursor, or other MCP clients to query your own saved leads in read-only mode. Available exclusively with an active GoLeads Pro plan."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            to="/saved"
            className="rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:bg-secondary"
          >
            {es ? "Leads guardados" : "Saved leads"}
          </Link>
          {!isPro && (
            <Link
              to="/plans"
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {es ? "Pasar a Pro" : "Upgrade to Pro"}
            </Link>
          )}
        </div>
      </header>

      {!isPro && (
        <section
          role="status"
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 space-y-3"
        >
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <h2 className="text-sm font-semibold text-foreground">
                {es
                  ? "El servidor MCP requiere una cuenta GoLeads Pro"
                  : "The MCP server requires a GoLeads Pro account"}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {es
                  ? "Tu cuenta actual es Gratis (incluye búsquedas diarias y exportación a Google Sheets). Para usar el servidor MCP con tu asistente de IA necesitas activar GoLeads Pro por suscripción o mediante un acceso Pro otorgado por el administrador. Si conectas una cuenta gratuita, las consultas MCP te indicarán que necesitas activar Pro."
                  : "Your account is currently on the Free plan (which includes daily searches and Google Sheets export). To use the MCP server with your AI assistant, activate GoLeads Pro via subscription or an administrator Pro grant. If you connect a Free account, MCP queries will explain that Pro is required."}
              </p>
              <div className="pt-1 flex flex-wrap gap-2">
                <Link
                  to="/plans"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  {es ? "Ver planes y activar Pro" : "View plans & activate Pro"}
                </Link>
                <Link
                  to="/integrations"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:bg-secondary"
                >
                  {es ? "Exportar a Google Sheets (Gratis)" : "Export to Google Sheets (Free)"}
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {es ? "1. URL del servidor MCP de GoLeads" : "1. GoLeads MCP Server URL"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {es
                ? "Usa esta URL en tu asistente de IA. Al conectar, iniciarás sesión con tu cuenta GoLeads Pro y aprobarás el acceso."
                : "Use this URL in your AI assistant. When connecting, you will sign in with your GoLeads Pro account and approve access."}
            </p>
          </div>
          <button
            type="button"
            disabled={testState.loading}
            onClick={handleVerifySavedLeadsAccess}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${testState.loading ? "animate-spin" : ""}`} />
            {testState.loading
              ? es
                ? "Comprobando…"
                : "Checking…"
              : es
              ? "Probar estado de mi cuenta MCP"
              : "Test my MCP account status"}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="text"
            readOnly
            aria-label={es ? "URL del servidor MCP" : "MCP Server URL"}
            value={mcpEndpoint}
            className="flex-1 h-10 rounded-lg border border-input bg-secondary/60 px-3.5 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={handleCopyEndpoint}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring shrink-0"
          >
            {copiedUrl ? (
              <>
                <Check className="h-4 w-4" />
                {es ? "URL copiada" : "URL copied"}
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                {es ? "Copiar URL MCP" : "Copy MCP URL"}
              </>
            )}
          </button>
        </div>

        {testState.checked && (
          <div
            role="status"
            className={`rounded-lg border p-3.5 text-xs flex items-start gap-2.5 ${
              testState.ok
                ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
            }`}
          >
            {testState.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-300" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-300" />
            )}
            <div className="space-y-1">
              <p className="leading-relaxed">{testState.message}</p>
              {testState.ok && testState.count === 0 && (
                <Link
                  to="/app"
                  className="inline-block font-semibold underline underline-offset-2"
                >
                  {es ? "Ir a Encuentra clientes →" : "Go to Find leads →"}
                </Link>
              )}
            </div>
          </div>
        )}
      </section>

      <McpClientGuides mcpEndpoint={mcpEndpoint} es={es} />
      <McpTroubleshooting es={es} />
    </div>
  );
}