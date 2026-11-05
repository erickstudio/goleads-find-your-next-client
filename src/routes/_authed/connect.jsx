import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Copy,
  Check,
  Sparkles,
  ShieldCheck,
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
      { title: "MCP — GoLeads" },
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
      ? "MCP Completo · Propietario (Solo lectura)"
      : "Full MCP · Owner (Read-only)"
    : access?.entitlementSource === "complimentary"
    ? es
      ? "MCP Completo · Pro otorgado por admin (Solo lectura)"
      : "Full MCP · Admin Pro grant (Read-only)"
    : isPro
    ? es
      ? "MCP Completo · Suscripción Pro (Solo lectura)"
      : "Full MCP · Pro Subscription (Read-only)"
    : es
    ? "MCP Básico · Plan Gratis (Solo lectura · máx. 5 leads)"
    : "Basic MCP · Free Plan (Read-only · max 5 leads)";

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
              ? "No se pudo verificar tu sesión MCP."
              : "Could not verify your MCP session."),
        });
        return;
      }
      const count = Number(payload?.count) || 0;
      const tierText =
        payload?.accessTier === "full"
          ? es
            ? "modo Pro completo (hasta 50 leads con contacto, Google Maps y borradores)"
            : "full Pro mode (up to 50 leads with contact info, Google Maps, and drafts)"
          : es
          ? "modo Gratis básico (hasta 5 leads con datos básicos)"
          : "basic Free mode (up to 5 leads with basic fields)";
      setTestState({
        loading: false,
        checked: true,
        ok: true,
        count,
        message:
          count === 0
            ? es
              ? `Conexión verificada en ${tierText} (solo lectura, sin permisos para modificar nada), pero aún tienes 0 leads guardados. Ve a «Encuentra clientes» y pulsa «Guardar lead» para poder consultarlos.`
              : `Connection verified in ${tierText} (read-only, cannot modify anything), but you have 0 saved leads so far. Go to 'Find clients' and click 'Save lead' to query them.`
            : es
            ? `Conexión verificada en ${tierText} (solo lectura): responde con ${count} lead(s) guardado(s).`
            : `Connection verified in ${tierText} (read-only): returned ${count} saved lead(s).`,
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
              <ShieldCheck className="h-3.5 w-3.5" />
              {es
                ? "Solo lectura · No puede modificar ni borrar nada"
                : "Read-only · Cannot modify or delete anything"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 px-3 py-1 text-xs font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {entitlementLabel}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            MCP
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            {es
              ? "Conecta Claude, ChatGPT, Cursor u otros clientes MCP para consultar tus propios leads guardados en modo estricto de solo lectura. Disponible en Plan Gratis para consultas básicas y en Plan Pro para consultas completas."
              : "Connect Claude, ChatGPT, Cursor, or other MCP clients to query your own saved leads in strict read-only mode. Available on the Free plan for basic queries and on the Pro plan for full queries."}
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
              {es ? "Ampliar a Pro" : "Upgrade to Pro"}
            </Link>
          )}
        </div>
      </header>

      {/* Free Basic vs Pro Full Comparison */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          className={`rounded-xl border p-4 space-y-2 ${
            !isPro ? "border-primary/40 bg-primary/5" : "border-border bg-card"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              {es ? "Plan Gratis · Consultas básicas" : "Free Plan · Basic queries"}
            </h2>
            {!isPro && (
              <span className="rounded bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {es ? "Tu plan actual" : "Your current plan"}
              </span>
            )}
          </div>
          <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-4 leading-relaxed">
            <li>
              {es
                ? "Hasta 5 leads guardados por consulta."
                : "Up to 5 saved leads per query."}
            </li>
            <li>
              {es
                ? "Datos básicos: nombre del negocio, categoría, ubicación, tipo de señal, estado de verificación, URL de la fuente y etapa."
                : "Basic fields: business name, category, location, signal type, verification status, source URL, and stage."}
            </li>
            <li>
              {es
                ? "100% solo lectura: no puede crear, editar ni borrar nada."
                : "100% read-only: cannot create, edit, or delete anything."}
            </li>
          </ul>
        </div>

        <div
          className={`rounded-xl border p-4 space-y-2 ${
            isPro ? "border-primary/40 bg-primary/5" : "border-border bg-card"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {es ? "Plan Pro · Consultas completas" : "Pro Plan · Full queries"}
            </h2>
            {isPro && (
              <span className="rounded bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {es ? "Tu plan actual" : "Your current plan"}
              </span>
            )}
          </div>
          <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-4 leading-relaxed">
            <li>
              {es
                ? "Hasta 50 leads guardados por consulta."
                : "Up to 50 saved leads per query."}
            </li>
            <li>
              {es
                ? "Incluye correo y teléfono público, sitio web, dirección y enlace de Google Maps, resumen de señal, notas y borrador de contacto."
                : "Includes public email & phone, website, Google Maps address & URL, signal summary, notes, and outreach draft."}
            </li>
            <li>
              {es
                ? "100% solo lectura: no puede crear, editar ni borrar nada."
                : "100% read-only: cannot create, edit, or delete anything."}
            </li>
          </ul>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {es ? "1. URL del servidor MCP de GoLeads" : "1. GoLeads MCP Server URL"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {es
                ? "Usa esta URL en tu asistente de IA. Al conectar, iniciarás sesión con tu cuenta GoLeads (Gratis o Pro) y aprobarás el acceso de solo lectura."
                : "Use this URL in your AI assistant. When connecting, you will sign in with your GoLeads account (Free or Pro) and approve read-only access."}
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
              ? "Probar consulta MCP"
              : "Test MCP query"}
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
                  {es ? "Ir a Encuentra clientes →" : "Go to Find clients →"}
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