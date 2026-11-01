import { useState, useEffect } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import {
  getExtendedWorkspaceData,
  updateAgentSettings,
} from "@/lib/workspace-pages-fns";
import { usePreferences } from "@/lib/PreferencesContext";

export const Route = createFileRoute("/_authed/agent-settings")({
  ssr: false,
  loader: () => getExtendedWorkspaceData(),
  head: () => ({
    meta: [
      { title: "Agent Settings — goleads.app" },
      {
        name: "description",
        content:
          "Toggle your AI Evidence Analyst and Search Strategist agents on or off and inspect their configuration settings.",
      },
    ],
  }),
  component: AgentSettingsPage,
});

function AgentSettingsPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const updateAgentsFn = useServerFn(updateAgentSettings);
  const { lang, syncFromProfile, t } = usePreferences();
  const isEs = lang === "es";

  const profile = data?.profile;
  const [searchStrategistOn, setSearchStrategistOn] = useState(
    profile?.enable_search_strategist !== false
  );
  const [evidenceAnalystOn, setEvidenceAnalystOn] = useState(
    profile?.enable_evidence_analyst !== false
  );
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    if (profile) {
      syncFromProfile(profile);
      setSearchStrategistOn(profile.enable_search_strategist !== false);
      setEvidenceAnalystOn(profile.enable_evidence_analyst !== false);
    }
  }, [profile?.id, profile?.enable_search_strategist, profile?.enable_evidence_analyst]);

  useEffect(() => {
    document.title = isEs
      ? "Ajustes de agentes IA — goleads.app"
      : "Agent Settings — goleads.app";
  }, [isEs]);

  const handleToggle = async (nextStrategist, nextAnalyst) => {
    setSearchStrategistOn(nextStrategist);
    setEvidenceAnalystOn(nextAnalyst);
    setIsSaving(true);
    setStatusMsg("");
    try {
      await updateAgentsFn({
        data: {
          enable_search_strategist: nextStrategist,
          enable_evidence_analyst: nextAnalyst,
        },
      });
      await router.invalidate();
      setStatusMsg(
        isEs
          ? "Preferencias de agentes IA actualizadas."
          : "AI agent settings updated."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const agentSpecs = [
    {
      id: "search_strategist",
      enabled: searchStrategistOn,
      onToggle: () => handleToggle(!searchStrategistOn, evidenceAnalystOn),
      name: isEs ? "Estratega de Búsqueda" : "Search Strategist",
      surface: isEs ? "Pantalla: Buscar leads (/)" : "Surface: Find leads (/)",
      description: isEs
        ? "Guía al usuario en la elección de parámetros de LeadSearch (categoría comercial, ciudad/país y ventana de 30, 90 o 180 días) según sus servicios e historial."
        : "Guides users through high-signal LeadSearch parameters (business_category, location_query, and 30/90/180-day windows) tailored to their custom services and history.",
      model: isEs ? "automático (temperatura: 0.3)" : "automatic (temperature: 0.3)",
      memoryMode: isEs ? "automática (máx. 6 mensajes)" : "auto (max 6 messages)",
      permissions: isEs
        ? [
            "UserProfile (lectura)",
            "LeadSearch (lectura)",
            "Opportunity (lectura)",
            "SavedOpportunity (lectura)",
          ]
        : [
            "UserProfile (read)",
            "LeadSearch (read)",
            "Opportunity (read)",
            "SavedOpportunity (read)",
          ],
    },
    {
      id: "evidence_analyst",
      enabled: evidenceAnalystOn,
      onToggle: () => handleToggle(searchStrategistOn, !evidenceAnalystOn),
      name: isEs
        ? "Analista de Evidencia y Relevancia"
        : "Evidence & Relevance Analyst",
      surface: isEs
        ? "Pantalla: Detalles de la oportunidad (/opportunities/:id)"
        : "Surface: Opportunity details (/opportunities/:id)",
      description: isEs
        ? "Interpreta los registros de EvidenceItem (extractos literales, fechas de publicación/evento/recuperación y estado de verificación) frente a tus servicios sin inventar datos."
        : "Interprets EvidenceItem records (verbatim excerpts, publication/event/retrieval dates, and verification status) against your services without fabricating facts.",
      model: isEs ? "automático (temperatura: 0.2)" : "automatic (temperature: 0.2)",
      memoryMode: isEs ? "automática (máx. 6 mensajes)" : "auto (max 6 messages)",
      permissions: isEs
        ? [
            "EvidenceItem (lectura)",
            "Opportunity (lectura)",
            "UserProfile (lectura)",
            "OpportunityFeedback (lectura)",
          ]
        : [
            "EvidenceItem (read)",
            "Opportunity (read)",
            "UserProfile (read)",
            "OpportunityFeedback (read)",
          ],
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {isEs ? "Ajustes de agentes IA" : "Agent Settings"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEs
              ? "Activa o desactiva tus asistentes IA (Analista de Evidencia y Estratega de Búsqueda) y consulta su configuración actual."
              : "Toggle your AI Evidence Analyst and Search Strategist agents on or off and view their current configuration settings."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            to="/connect"
            className="px-3.5 py-2 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 text-center"
          >
            {isEs ? "Conectar asistentes IA (MCP)" : "Connect AI Assistants (MCP)"}
          </Link>
          <Link
            to="/settings"
            className="px-3.5 py-2 rounded-md text-xs font-medium bg-secondary text-foreground border border-border hover:bg-secondary/80 text-center"
          >
            {isEs ? "Configuración de cuenta" : "Account Settings"}
          </Link>
        </div>
      </div>

      {statusMsg && (
        <div
          role="status"
          className="px-4 py-2.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between"
        >
          <span>{statusMsg}</span>
          <button
            type="button"
            onClick={() => setStatusMsg("")}
            className="underline font-medium"
          >
            {t("common.dismiss")}
          </button>
        </div>
      )}

      <div className="space-y-4">
        {agentSpecs.map((agent) => (
          <section
            key={agent.id}
            className="bg-card text-card-foreground rounded-lg border border-border p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold bg-primary/15 text-primary border border-primary/30">
                    <Sparkles className="h-3 w-3" />
                    {agent.id}
                  </span>
                  <h2 className="text-base font-bold text-foreground">
                    {agent.name}
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground">{agent.surface}</p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={agent.enabled}
                disabled={isSaving}
                onClick={agent.onToggle}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                  agent.enabled
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35"
                    : "bg-secondary text-muted-foreground border-border"
                }`}
              >
                {agent.enabled
                  ? isEs
                    ? "Activado (ON)"
                    : "Enabled (ON)"
                  : isEs
                  ? "Desactivado (OFF)"
                  : "Disabled (OFF)"}
              </button>
            </div>

            <p className="text-xs text-foreground/90 leading-relaxed">
              {agent.description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-secondary/40 rounded-md p-3.5 border border-border">
              <div>
                <div className="text-muted-foreground">
                  {isEs ? "Modelo y temperatura" : "Model & temperature"}
                </div>
                <div className="font-mono font-medium text-foreground mt-0.5">
                  {agent.model}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">
                  {isEs ? "Memoria contextual" : "Contextual memory"}
                </div>
                <div className="font-mono font-medium text-foreground mt-0.5">
                  {agent.memoryMode}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">
                  {isEs ? "Permisos de herramientas (RLS)" : "Entity permissions (RLS)"}
                </div>
                <div className="font-mono font-medium text-foreground mt-0.5">
                  {agent.permissions.join(", ")}
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}