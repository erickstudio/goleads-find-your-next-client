import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";

export default function McpClientGuides({ mcpEndpoint, es }) {
  const [activeClientTab, setActiveClientTab] = useState("claude");
  const [copiedJson, setCopiedJson] = useState(false);

  const claudeConnectUrl = `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodeURIComponent(
    "GoLeads"
  )}&connectorUrl=${encodeURIComponent(mcpEndpoint)}`;

  const cursorConfigJson = JSON.stringify(
    {
      mcpServers: {
        goleads: {
          url: mcpEndpoint,
        },
      },
    },
    null,
    2
  );

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(cursorConfigJson);
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      setCopiedJson(false);
    }
  };

  const clientTabs = [
    { id: "claude", label: "Claude" },
    { id: "chatgpt", label: "ChatGPT" },
    { id: "cursor", label: "Cursor" },
    { id: "others", label: es ? "Otros clientes MCP" : "Other MCP clients" },
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-5 shadow-xs">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">
          {es
            ? "2. Cómo agregar GoLeads MCP en cada app de IA (Requiere Pro)"
            : "2. How to add GoLeads MCP in each AI app (Pro required)"}
        </h2>
        <p className="text-xs text-muted-foreground">
          {es
            ? "Selecciona tu asistente para ver los pasos de conexión y autorización OAuth con tu cuenta GoLeads Pro."
            : "Select your assistant below for step-by-step connection and OAuth authorization instructions with your GoLeads Pro account."}
        </p>
      </div>

      <div
        role="tablist"
        aria-label={es ? "Asistentes compatibles" : "Compatible assistants"}
        className="flex flex-wrap gap-2 border-b border-border pb-3"
      >
        {clientTabs.map((tab) => {
          const active = activeClientTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveClientTab(tab.id)}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/70 text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeClientTab === "claude" && (
        <div className="space-y-4 text-xs sm:text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3.5">
            <div className="space-y-0.5">
              <p className="font-semibold text-foreground">
                {es ? "Conectar en Claude con 1 clic" : "1-click connect in Claude"}
              </p>
              <p className="text-xs text-muted-foreground">
                {es
                  ? "Abre el formulario de conectores personalizados de Claude con el nombre y la URL de GoLeads prellenados."
                  : "Opens Claude's custom connector form pre-filled with GoLeads name and URL."}
              </p>
            </div>
            <a
              href={claudeConnectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shrink-0"
            >
              {es ? "Conectar asistente en Claude" : "Connect assistant in Claude"}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <ol className="list-decimal space-y-2.5 pl-5 text-xs sm:text-sm text-foreground/90 leading-relaxed">
            <li>
              {es
                ? "Haz clic en «Conectar asistente en Claude» arriba (o entra en Claude → Settings → Connectors → Add custom connector)."
                : "Click 'Connect assistant in Claude' above (or open Claude → Settings → Connectors → Add custom connector)."}
            </li>
            <li>
              {es
                ? "Confirma que el nombre sea «GoLeads» y que la URL sea la dirección MCP del paso 1 (pégalo si estuviera vacío), y pulsa «Add»."
                : "Confirm the name is 'GoLeads' and the URL matches the MCP address from Step 1 (paste it if empty), then click 'Add'."}
            </li>
            <li>
              {es
                ? "Claude abrirá la pantalla de consentimiento de GoLeads (/oauth/consent). Inicia sesión con tu cuenta GoLeads Pro y pulsa «Aprobar»."
                : "Claude will open the GoLeads consent page (/oauth/consent). Sign in with your GoLeads Pro account and click 'Approve'."}
            </li>
            <li>
              {es
                ? "En Claude, pide: «Usa GoLeads para mostrarme mis últimos 10 leads guardados y sus correos públicos»."
                : "In Claude, ask: 'Use GoLeads to show my latest 10 saved leads and their public emails'."}
            </li>
          </ol>
        </div>
      )}

      {activeClientTab === "chatgpt" && (
        <div className="space-y-3 text-xs sm:text-sm">
          <ol className="list-decimal space-y-2.5 pl-5 text-foreground/90 leading-relaxed">
            <li>
              {es
                ? "En la app de escritorio de ChatGPT, abre Settings → Plugins → pestaña MCPs y haz clic en «Add server» (en la web, usa Developer mode en Settings → Connectors)."
                : "In the ChatGPT desktop app, open Settings → Plugins → MCPs tab and click 'Add server' (on the web, use Developer mode in Settings → Connectors)."}
            </li>
            <li>
              {es
                ? "Escribe «GoLeads» como nombre, elige Type «Streamable HTTP», pega la URL del servidor MCP del paso 1 y pulsa «Save»."
                : "Name it 'GoLeads', set Type to 'Streamable HTTP', paste the MCP Server URL from Step 1, and click 'Save'."}
            </li>
            <li>
              {es
                ? "Reinicia la app, activa el servidor GoLeads y completa la autorización OAuth iniciando sesión con tu cuenta GoLeads Pro."
                : "Restart the app, enable the GoLeads server, and complete OAuth authorization by signing in with your GoLeads Pro account."}
            </li>
            <li>
              {es
                ? "Pide en el chat: «Consulta mis leads guardados en GoLeads y resúmelos por ciudad»."
                : "Ask in chat: 'Query my saved leads in GoLeads and summarize them by city'."}
            </li>
          </ol>
        </div>
      )}

      {activeClientTab === "cursor" && (
        <div className="space-y-3 text-xs sm:text-sm">
          <ol className="list-decimal space-y-2.5 pl-5 text-foreground/90 leading-relaxed">
            <li>
              {es
                ? "En Cursor, abre Customize → pestaña MCPs → «New MCP Server», lo que abrirá tu archivo mcp.json."
                : "In Cursor, open Customize → MCPs tab → 'New MCP Server', which opens your mcp.json file."}
            </li>
            <li>
              {es
                ? "Añade una entrada cuya propiedad url sea la URL del paso 1, guarda el archivo y activa el interruptor:"
                : "Add an entry whose url is the URL from Step 1, save the file, and toggle it on:"}
            </li>
          </ol>

          <div className="rounded-lg border border-border bg-secondary/60 p-3.5">
            <pre className="overflow-x-auto font-mono text-xs text-foreground">
              {cursorConfigJson}
            </pre>
            <button
              type="button"
              onClick={handleCopyJson}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary"
            >
              {copiedJson ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  {es ? "JSON copiado" : "JSON copied"}
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  {es ? "Copiar mcp.json" : "Copy mcp.json"}
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            {es
              ? "3. Al activarlo, Cursor abrirá la página de consentimiento de GoLeads donde inicias sesión con tu cuenta Pro y apruebas el acceso."
              : "3. Once enabled, Cursor opens the GoLeads consent page where you sign in with your Pro account and approve access."}
          </p>
        </div>
      )}

      {activeClientTab === "others" && (
        <div className="space-y-3 text-xs sm:text-sm">
          <ol className="list-decimal space-y-2.5 pl-5 text-foreground/90 leading-relaxed">
            <li>
              {es
                ? "Copia la URL del paso 1 y agrégala como servidor MCP «Streamable HTTP» en tu cliente compatible con OAuth."
                : "Copy the URL from Step 1 and add it as a 'Streamable HTTP' MCP server in your OAuth-compatible client."}
            </li>
            <li>
              {es
                ? "El nombre («GoLeads») y la URL es todo lo que la mayoría de clientes necesitan. Luego recarga el cliente."
                : "Name ('GoLeads') + URL is all most clients need. Then reload the client."}
            </li>
            <li>
              {es
                ? "Completa el paso final en la página de consentimiento de GoLeads iniciando sesión con tu propia cuenta Pro y aprobando."
                : "Complete the final step on GoLeads' consent page by signing in with your own Pro account and approving."}
            </li>
          </ol>
        </div>
      )}
    </section>
  );
}