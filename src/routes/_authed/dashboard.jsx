import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getExtendedWorkspaceData } from "@/lib/workspace-pages-fns";
import { usePreferences } from "@/lib/PreferencesContext";

export const Route = createFileRoute("/_authed/dashboard")({
  ssr: false,
  loader: () => getExtendedWorkspaceData(),
  head: () => ({
    meta: [
      { title: "Usage Dashboard — goleads.app" },
      {
        name: "description",
        content:
          "View your daily search quota usage, pilot access status, and recent prospecting activity.",
      },
    ],
  }),
  component: UsageDashboardPage,
});

function UsageDashboardPage() {
  const data = Route.useLoaderData();
  const { lang, syncFromProfile, t } = usePreferences();
  const isEs = lang === "es";

  const quota = data?.quota || {};
  const searches = data?.recentSearches || [];
  const opportunities = data?.opportunities || [];
  const saved = data?.savedOpportunities || [];
  const feedback = data?.feedbackRecords || [];
  const enrollments = data?.pilotEnrollments || [];

  useEffect(() => {
    if (data?.profile) {
      syncFromProfile(data.profile);
    }
  }, [data?.profile?.id]);

  useEffect(() => {
    document.title = isEs
      ? "Panel de uso — goleads.app"
      : "Usage Dashboard — goleads.app";
  }, [isEs]);

  const verifiedOppsCount = opportunities.filter(
    (o) => o.verification_status === "verified"
  ).length;
  const activePilotEnrollments = enrollments.filter(
    (e) => e.payment_status === "paid_verified"
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {isEs ? "Panel de uso y actividad" : "Usage Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEs
              ? "Consulta el uso de tu cupo diario de búsquedas, el estado de tu piloto y la actividad reciente de tu cuenta."
              : "View your daily search quota usage, pilot access status, and recent prospecting activity."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/pilot"
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-secondary text-foreground border border-border hover:bg-secondary/80"
          >
            {t("nav.pilotOffer")}
          </Link>
          <Link
            to="/"
            className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {t("nav.findLeads")}
          </Link>
        </div>
      </div>

      {/* Quota & Pilot Allowance Overview */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border border-border p-5 space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">
            {isEs ? "Búsquedas diarias disponibles hoy" : "Daily searches remaining today"}
          </div>
          <div className="text-2xl font-bold font-mono text-primary">
            {quota.baseRemainingToday ?? 3} / {quota.maxDaily ?? 3}
          </div>
          <p className="text-xs text-muted-foreground">
            {isEs
              ? `Usadas en las últimas 24 h: ${quota.usedToday ?? 0}. Caché privada: ${quota.cacheTtlHours ?? 24} h.`
              : `Used in the last 24h: ${quota.usedToday ?? 0}. Private query cache: ${quota.cacheTtlHours ?? 24}h.`}
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border p-5 space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">
            {isEs ? "Estado de acceso piloto" : "Pilot access status"}
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {activePilotEnrollments.length > 0
              ? isEs
                ? "Activo (Verificado)"
                : "Active (Verified)"
              : isEs
              ? "Modo preparación"
              : "Preparation mode"}
          </div>
          <p className="text-xs text-muted-foreground">
            {isEs
              ? `Cupo piloto restante: ${quota.pilotRemaining ?? 0} de ${quota.pilotGrantedTotal ?? 0} búsquedas.`
              : `Pilot allowance remaining: ${quota.pilotRemaining ?? 0} of ${quota.pilotGrantedTotal ?? 0} searches.`}
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border p-5 space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">
            {isEs ? "Total disponible para buscar hoy" : "Total search capacity today"}
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {quota.remainingToday ?? 3}
          </div>
          <p className="text-xs text-muted-foreground">
            {isEs
              ? `Hasta ${quota.maxResultsPerSearch ?? 5} oportunidades únicas por búsqueda.`
              : `Up to ${quota.maxResultsPerSearch ?? 5} unique businesses per search.`}
          </p>
        </div>
      </section>

      {/* Workspace Activity Metrics */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          to="/search-history"
          className="bg-card rounded-lg border border-border p-4 hover:border-primary/40 transition-colors"
        >
          <div className="text-xs text-muted-foreground">
            {isEs ? "Búsquedas registradas" : "Recorded searches"}
          </div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">
            {searches.length}
          </div>
        </Link>

        <Link
          to="/evidence-library"
          className="bg-card rounded-lg border border-border p-4 hover:border-primary/40 transition-colors"
        >
          <div className="text-xs text-muted-foreground">
            {isEs ? "Oportunidades descubiertas" : "Discovered opportunities"}
          </div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">
            {opportunities.length}{" "}
            <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
              ({verifiedOppsCount} {t("common.verified")})
            </span>
          </div>
        </Link>

        <Link
          to="/saved"
          className="bg-card rounded-lg border border-border p-4 hover:border-primary/40 transition-colors"
        >
          <div className="text-xs text-muted-foreground">
            {isEs ? "Leads guardados" : "Saved leads"}
          </div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">
            {saved.length}
          </div>
        </Link>

        <Link
          to="/feedback-summary"
          className="bg-card rounded-lg border border-border p-4 hover:border-primary/40 transition-colors"
        >
          <div className="text-xs text-muted-foreground">
            {isEs ? "Evaluaciones de calidad" : "Relevance evaluations"}
          </div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">
            {feedback.length}
          </div>
        </Link>
      </section>

      {/* Recent Searches & Saved Pipeline Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-card rounded-lg border border-border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              {isEs ? "Búsquedas recientes" : "Recent searches"}
            </h2>
            <Link
              to="/search-history"
              className="text-xs font-medium text-primary hover:underline"
            >
              {isEs ? "Ver historial completo" : "View all history"}
            </Link>
          </div>

          {searches.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {isEs
                ? "Aún no se han ejecutado búsquedas en esta cuenta."
                : "No searches executed yet in this account."}
            </p>
          ) : (
            <div className="space-y-2">
              {searches.slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  className="p-3 rounded-md bg-secondary/40 border border-border flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-medium text-foreground">
                      {s.business_category} · {s.location_query}
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground">
                      {s.results_count ?? 0} {isEs ? "resultados" : "results"} (
                      {s.verified_count ?? 0} {t("common.verified")})
                    </div>
                  </div>
                  <Link
                    to="/"
                    search={{
                      category: s.business_category,
                      location: s.location_query,
                      window: s.time_window_days || 90,
                      searchId: s.id,
                    }}
                    className="text-primary hover:underline font-medium shrink-0"
                  >
                    {isEs ? "Abrir" : "Open"}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-card rounded-lg border border-border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              {isEs ? "Pipeline de leads guardados" : "Saved leads pipeline"}
            </h2>
            <Link
              to="/outreach-planner"
              className="text-xs font-medium text-primary hover:underline"
            >
              {isEs ? "Abrir planificador de contacto" : "Open Outreach Planner"}
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            {["saved", "researching", "qualified", "archived"].map((stage) => {
              const count = saved.filter(
                (item) => (item.review_stage || "saved") === stage
              ).length;
              return (
                <Link
                  key={stage}
                  to="/saved"
                  search={{ stage }}
                  className="p-3 rounded-md bg-secondary/40 border border-border flex items-center justify-between hover:border-primary/40"
                >
                  <span className="font-medium text-foreground">
                    {t(`saved.stages.${stage}`)}
                  </span>
                  <span className="font-mono font-semibold text-primary">
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}