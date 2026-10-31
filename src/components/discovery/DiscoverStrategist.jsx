import { Link } from "@tanstack/react-router";
import AgentChatPanel from "@/components/AgentChatPanel";

export default function DiscoverStrategist({ d }) {
  const { t, lang, profile, selectedServices, serviceDescription, businessCategory, locationQuery, timeWindowDays } = d;
  if (profile?.enable_search_strategist === false) return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-xs text-muted-foreground"><span>{lang === "es" ? "El asistente Estratega de Búsqueda está desactivado." : "Search Strategist AI agent is currently disabled."}</span><Link to="/agent-settings" className="text-primary hover:underline">{t("workspace.agents")}</Link></div>;
  return (
    <AgentChatPanel agentName="search_strategist" badgeLabel={t("discover.agentBadge")} title={t("discover.agentTitle")} subtitle={t("discover.agentSubtitle")} conversationTitle={t("discover.agentConvTitle")}
      contextPreamble={`Preferred response language: ${lang === "es" ? "Spanish (Español)" : "English"}. Current user services: ${selectedServices.length > 0 ? selectedServices.join(", ") : "None configured yet"}. Service description: ${serviceDescription || "Not set"}. Current form inputs: Business category="${businessCategory}", Location="${locationQuery}", Time window=${timeWindowDays} days.`}
      starterPrompts={[
        { label: t("discover.agentPrompt1Label"), prompt: t("discover.agentPrompt1Text") },
        { label: t("discover.agentPrompt2Label", { category: businessCategory, location: locationQuery }), prompt: t("discover.agentPrompt2Text", { category: businessCategory, location: locationQuery, days: timeWindowDays }) },
        { label: t("discover.agentPrompt3Label"), prompt: t("discover.agentPrompt3Text") },
      ]} placeholder={t("discover.agentPlaceholder")} />
  );
}