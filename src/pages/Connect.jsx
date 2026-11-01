import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Copy,
  Check,
  ExternalLink,
  Plug,
  ShieldCheck,
  RefreshCw,
  Terminal,
  Sparkles,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import McpAvailabilityNotice from "@/components/plans/McpAvailabilityNotice";
import PublicHeader from "@/components/launch/PublicHeader";
import PublicFooter from "@/components/launch/PublicFooter";
import { PublicLocaleProvider } from "@/lib/PublicLocaleContext";
import { useAuth } from "@/lib/AuthContext";
import { usePreferences } from "@/lib/PreferencesContext";

const CLIENT_TABS = ["claude", "chatgpt", "cursor", "others"];

export default function Connect() {
  const { user, isAuthenticated } = useAuth();
  const { lang } = usePreferences();
  const isEs = lang === "es";

  const [serverUrl, setServerUrl] = useState("");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [activeTab, setActiveTab] = useState("claude");

  useEffect(() => {
    try {
      const resolved = new URL("/api/mcp", window.location.origin).toString();
      setServerUrl(resolved);
    } catch {
      setServerUrl("");
    }
  }, []);

  const handleCopyUrl = async () => {
    if (!serverUrl || !navigator?.clipboard) return;
    await navigator.clipboard.writeText(serverUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const cursorSnippet = JSON.stringify(
    {
      mcpServers: {
        goleads: {
          url: serverUrl || "/api/mcp",
        },
      },
    },
    null,
    2
  );

  const handleCopyJson = async () => {
    if (!navigator?.clipboard) return;
    await navigator.clipboard.writeText(cursorSnippet);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const claudeConnectUrl = serverUrl
    ? `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodeURIComponent(
        "GoLeads"
      )}&connectorUrl=${encodeURIComponent(serverUrl)}`
    : "https://claude.ai/customize/connectors";

  const content = (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 border border-primary/30 px-2.5 py-1 text-xs font-semibold text-primary">
            <Plug className="h-3.5 w-3.5" />
            {isEs ? "Conexión de asistentes IA · MCP" : "AI Assistant Connection · MCP"}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {isEs
              ? "Conecta tu asistente de IA a GoLeads"
              : "Connect your AI assistant to GoLeads"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEs
              ? "Aprende a configurar un cliente MCP. Las operaciones para consultar tus búsquedas y leads con Pro siguen en preparación."
              : "Learn how to configure an MCP client. Pro operations for querying your searches and leads are still in preparation."}
          </p>
        </div>

        <Link
          to="/agent-settings"
          className="px-3.5 py-2 rounded-md text-xs font-medium bg-secondary text-foreground border border-border hover:bg-secondary/80 shrink-0 text-center"
        >
          {isEs ? "Ajustes de agentes" : "Agent settings"}
        </Link>
      </div>

      <McpAvailabilityNotice es={isEs} />

      {/* Runtime-resolved MCP server URL */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor="mcp-server-url"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {isEs ? "URL del servidor MCP de GoLeads" : "GoLeads MCP Server URL"}
          </label>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded px-2 py-0.5">
            <ShieldCheck className="h-3 w-3" />
            {isEs ? "Inicio de sesión requerido · OAuth" : "Sign in required · OAuth"}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="mcp-server-url"
            type="text"
            readOnly
            value={serverUrl}
            aria-label={isEs ? "URL del servidor MCP" : "MCP server URL"}
            className="h-11 flex-1 rounded-lg border border-input bg-background px-3.5 font-mono text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={handleCopyUrl}
            disabled={!serverUrl}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shrink-0"
          >
            {copiedUrl ? (
              <>
                <Check className="h-4 w-4" />
                {isEs ? "URL copiada" : "Copied URL"}
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                {isEs ? "Copiar URL" : "Copy URL"}
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {isEs
            ? "Usa esta dirección exacta en tu cliente de IA. Al conectar, se abrirá la pantalla de autorización de GoLeads para que inicies sesión con tu propia cuenta."
            : "Use this exact address in your AI client. When connecting, GoLeads will open its authorization screen so you sign in with your own account."}
        </p>
      </section>

      {/* Four Client Tabs: Claude, ChatGPT, Cursor, Others */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div
          role="tablist"
          aria-label={isEs ? "Clientes de IA compatibles" : "Supported AI clients"}
          className="grid grid-cols-2 sm:grid-cols-4 border-b border-border bg-secondary/40 p-1.5 gap-1"
        >
          {[
            { id: "claude", label: "Claude" },
            { id: "chatgpt", label: "ChatGPT" },
            { id: "cursor", label: "Cursor" },
            { id: "others", label: isEs ? "Otros" : "Others" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg py-2 px-3 text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {activeTab === "claude" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {isEs ? "Conectar con Claude" : "Connect with Claude"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isEs
                      ? "Abre el formulario de conector personalizado de Claude con los datos de GoLeads prellenados."
                      : "Open Claude's custom connector form pre-filled with GoLeads."}
                  </p>
                </div>
                <a
                  href={claudeConnectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shrink-0"
                >
                  <span>{isEs ? "Añadir conector en Claude" : "Add connector"}</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              <ol className="list-decimal list-inside space-y-2 text-xs text-foreground/90 leading-relaxed bg-secondary/40 rounded-lg p-4 border border-border">
                <li>
                  {isEs
                    ? "Haz clic en «Añadir conector en Claude» arriba para abrir el formulario de conector personalizado prellenado (o pega la URL del servidor si falta)."
                    : "Click 'Add connector' above to open Claude's custom-connector form pre-filled (paste the server URL if it is missing)."}
                </li>
                <li>
                  {isEs
                    ? "Haz clic en «Add» para registrar el servidor MCP de GoLeads."
                    : "Click 'Add' to register the GoLeads MCP server."}
                </li>
                <li>
                  {isEs
                    ? "Completa el paso final de OAuth: se abrirá la página de consentimiento de GoLeads, donde inicias sesión con tu propia cuenta y apruebas el acceso."
                    : "Complete the OAuth step: GoLeads will open its consent page where you sign in with your own account and approve access."}
                </li>
              </ol>
            </div>
          )}

          {activeTab === "chatgpt" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {isEs ? "Conectar con ChatGPT" : "Connect with ChatGPT"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isEs
                    ? "Configura GoLeads como servidor Streamable HTTP en la app de escritorio o web de ChatGPT."
                    : "Configure GoLeads as a Streamable HTTP server in the ChatGPT desktop app or web."}
                </p>
              </div>

              <ol className="list-decimal list-inside space-y-2 text-xs text-foreground/90 leading-relaxed bg-secondary/40 rounded-lg p-4 border border-border">
                <li>
                  {isEs
                    ? "En la aplicación de escritorio de ChatGPT, abre Configuración (Settings) y elige Plugins."
                    : "In the ChatGPT desktop app, open Settings and choose Plugins."}
                </li>
                <li>
                  {isEs
                    ? "Abre la pestaña MCPs y haz clic en «Add server»."
                    : "Open the MCPs tab and click 'Add server'."}
                </li>
                <li>
                  {isEs
                    ? "Asígnale el nombre «GoLeads», selecciona el tipo «Streamable HTTP», pega la URL del servidor de arriba y haz clic en «Save»."
                    : "Name it 'GoLeads', set Type to 'Streamable HTTP', paste the server URL above, and click 'Save'."}
                </li>
                <li>
                  {isEs
                    ? "Reinicia la aplicación (Restart) y activa el servidor. (En la versión web de ChatGPT, los servidores MCP personalizados se configuran desde Developer mode)."
                    : "Restart and enable the server. (On the web, custom MCP servers go through Developer mode instead.)"}
                </li>
                <li>
                  {isEs
                    ? "Inicia sesión en la pantalla de consentimiento de GoLeads cuando se abra y aprueba el acceso."
                    : "Sign in on the GoLeads consent screen when prompted and approve access."}
                </li>
              </ol>
            </div>
          )}

          {activeTab === "cursor" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {isEs ? "Conectar con Cursor" : "Connect with Cursor"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isEs
                      ? "Añade GoLeads a tu archivo mcp.json en Cursor."
                      : "Add GoLeads to your mcp.json configuration in Cursor."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/80 self-start"
                >
                  {copiedJson ? <Check className="h-3.5 w-3.5" /> : <Terminal className="h-3.5 w-3.5" />}
                  {copiedJson
                    ? isEs
                      ? "JSON copiado"
                      : "Copied JSON"
                    : isEs
                    ? "Copiar bloque mcp.json"
                    : "Copy mcp.json snippet"}
                </button>
              </div>

              <ol className="list-decimal list-inside space-y-2 text-xs text-foreground/90 leading-relaxed bg-secondary/40 rounded-lg p-4 border border-border">
                <li>
                  {isEs
                    ? "En Cursor, abre Customize → pestaña MCPs → «New MCP Server», lo cual abrirá tu archivo mcp.json."
                    : "In Cursor, open Customize → MCPs tab → 'New MCP Server', which opens mcp.json."}
                </li>
                <li>
                  {isEs
                    ? "Añade una entrada cuyo campo url sea la URL del servidor de arriba, guarda el archivo y activa el interruptor (toggle on)."
                    : "Add an entry whose url is the server URL above, save mcp.json, and toggle the server on."}
                </li>
                <li>
                  {isEs
                    ? "Completa el inicio de sesión y aprueba el acceso cuando se abra la página de consentimiento de GoLeads."
                    : "Complete sign-in and approve access when the GoLeads consent page opens."}
                </li>
              </ol>

              <pre className="rounded-lg border border-border bg-background p-3.5 font-mono text-xs text-foreground overflow-x-auto">
                {cursorSnippet}
              </pre>
            </div>
          )}

          {activeTab === "others" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {isEs ? "Otros clientes MCP compatibles" : "Other MCP-compatible clients"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isEs
                    ? "Conecta cualquier asistente o herramienta compatible con servidores Streamable HTTP MCP."
                    : "Connect any assistant or client that supports Streamable HTTP MCP servers."}
                </p>
              </div>

              <ol className="list-decimal list-inside space-y-2 text-xs text-foreground/90 leading-relaxed bg-secondary/40 rounded-lg p-4 border border-border">
                <li>
                  {isEs
                    ? "Copia la URL del servidor MCP de GoLeads que aparece arriba."
                    : "Copy the GoLeads MCP server URL shown above."}
                </li>
                <li>
                  {isEs
                    ? "Añádela en tu cliente como un servidor MCP de tipo «Streamable HTTP» (el nombre y la URL es todo lo que la mayoría de los clientes necesitan) y luego recarga el cliente."
                    : "Add it as a Streamable HTTP MCP server in your client — a name and this URL are all most clients need — then reload the client."}
                </li>
                <li>
                  {isEs
                    ? "Cuando tu cliente abra la ventana de consentimiento de GoLeads, inicia sesión con tu cuenta de GoLeads y aprueba el acceso."
                    : "When your client opens the GoLeads consent page, sign in with your GoLeads account and approve access."}
                </li>
              </ol>
            </div>
          )}
        </div>
      </section>

      {/* OAuth & Refresh Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            <span>
              {isEs
                ? "Autorización OAuth con tu propia cuenta"
                : "OAuth authorization with your own account"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isEs
              ? "OAuth identifica tu cuenta de GoLeads, no el email de PayPal. El consentimiento por sí solo no acredita una suscripción Pro. Antes de habilitar operaciones, el servidor deberá comprobar la suscripción vigente y la propiedad de cada registro."
              : "OAuth identifies your GoLeads account, not your PayPal email. Consent alone does not prove a Pro subscription. Before enabling operations, the server must check subscription validity and ownership of each record."}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <RefreshCw className="h-4 w-4 text-primary shrink-0" />
            <span>
              {isEs
                ? "Actualiza el conector tras nuevos cambios"
                : "Refresh the connector after we ship changes"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isEs
              ? "Los asistentes guardan en caché la lista de herramientas. Cuando publiquemos mejoras o nuevas herramientas en GoLeads, actualiza o reconecta el conector en tu asistente para cargar las novedades."
              : "AI assistants cache the tool list. After we ship changes or new tools in GoLeads, refresh or reconnect the connector in your assistant to pick up the latest tools."}
          </p>
        </div>
      </div>
    </div>
  );

  if (isAuthenticated && user) {
    return <AppShell user={user}>{content}</AppShell>;
  }

  return (
    <PublicLocaleProvider initialLang={lang}>
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <PublicHeader />
        <main id="public-content" className="flex-1 py-10 px-5 sm:px-8">
          {content}
        </main>
        <PublicFooter />
      </div>
    </PublicLocaleProvider>
  );
}