import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getExtendedWorkspaceData } from "@/lib/workspace-pages-fns";
import {
  formatSignalTypeLabel,
  formatBusinessCategoryLabel,
} from "@/lib/opportunity-copy";
import { usePreferences } from "@/lib/PreferencesContext";

export const Route = createFileRoute("/_authed/market-insights")({
  ssr: false,
  loader: () => getExtendedWorkspaceData(),
  head: () => ({
    meta: [
      { title: "Market Insights — goleads.app" },
      {
        name: "description",
        content:
          "High-level summary trends about the businesses discovered in your workspace, including categories, regions, and signal types.",
      },
    ],
  }),
  component: MarketInsightsPage,
});

function tallyGroup(items = [], getter) {
  const counts = new Map();
  for (const item of items) {
    const key = String(getter(item) || "").trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function MarketInsightsPage() {
  const data = Route.useLoaderData();
  const { lang, syncFromProfile, t } = usePreferences();
  const isEs = lang === "es";

  const opportunities = data?.opportunities || [];
  const searches = data?.recentSearches || [];

  useEffect(() => {
    if (data?.profile) {
      syncFromProfile(data.profile);
    }
  }, [data?.profile?.id]);

  useEffect(() => {
    document.title = isEs
      ? "Tendencias de mercado — goleads.app"
      : "Market Insights — goleads.app";
  }, [isEs]);

  const topCategories = tallyGroup(
    opportunities,
    (o) => formatBusinessCategoryLabel(o.business_category || "Uncategorized", lang)
  );
  const topRegions = tallyGroup(opportunities, (o) => o.location);
  const topSignals = tallyGroup(opportunities, (o) =>
    formatSignalTypeLabel(o.signal_type, lang)
  );
  const searchedMarkets = tallyGroup(
    searches,
    (s) => `${formatBusinessCategoryLabel(s.business_category, lang)} — ${s.location_query}`
  );

  const verifiedCount = opportunities.filter(
    (o) => o.verification_status === "verified"
  ).length;
  const needsReviewCount = opportunities.length - verifiedCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {isEs ? "Tendencias de mercado" : "Market Insights"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEs
              ? "Resumen de las tendencias observadas en los negocios descubiertos en tu cuenta: categorías, regiones geográficas y tipos de señal."
              : "Summary trends across the businesses discovered in your workspace: categories, geographic regions, and expansion signals."}
          </p>
        </div>

        <Link
          to="/app"
          className="px-3.5 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 text-center"
        >
          {t("nav.findLeads")}
        </Link>
      </div>

      {/* Overview Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="text-xs text-muted-foreground">
            {isEs ? "Negocios descubiertos" : "Businesses discovered"}
          </div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">
            {opportunities.length}
          </div>
        </div>
        <div className="bg-card rounded-lg border border-emerald-500/30 p-4">
          <div className="text-xs text-emerald-700 dark:text-emerald-300">
            {t("common.verified")}
          </div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">
            {verifiedCount}
          </div>
        </div>
        <div className="bg-card rounded-lg border border-amber-500/35 p-4">
          <div className="text-xs text-amber-800 dark:text-amber-300">
            {t("common.needsReview")}
          </div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">
            {needsReviewCount}
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="text-xs text-muted-foreground">
            {isEs ? "Regiones únicas" : "Unique regions"}
          </div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">
            {topRegions.length}
          </div>
        </div>
      </div>

      {opportunities.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-8 text-center space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            {isEs
              ? "Aún no hay datos de tendencias descubiertos"
              : "No discovered market trends yet"}
          </h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {isEs
              ? "Ejecuta búsquedas en Buscar leads para analizar las categorías y regiones más frecuentes en tus hallazgos."
              : "Run searches in Find leads to see category, region, and signal breakdowns from your discovered businesses."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Most Common Categories */}
          <section className="bg-card rounded-lg border border-border p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              {isEs ? "Categorías más frecuentes" : "Most common categories"}
            </h2>
            <div className="space-y-2">
              {topCategories.slice(0, 8).map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between p-2.5 rounded bg-secondary/40 border border-border text-xs"
                >
                  <span className="font-medium text-foreground">{row.label}</span>
                  <span className="font-mono font-semibold text-primary">
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Geographic Regions */}
          <section className="bg-card rounded-lg border border-border p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              {isEs ? "Regiones geográficas" : "Geographic regions"}
            </h2>
            <div className="space-y-2">
              {topRegions.slice(0, 8).map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between p-2.5 rounded bg-secondary/40 border border-border text-xs"
                >
                  <span className="font-medium text-foreground">{row.label}</span>
                  <span className="font-mono font-semibold text-primary">
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Signal Types */}
          <section className="bg-card rounded-lg border border-border p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              {isEs
                ? "Tipos de señal de apertura o expansión"
                : "Opening & expansion signal types"}
            </h2>
            <div className="space-y-2">
              {topSignals.slice(0, 8).map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between p-2.5 rounded bg-secondary/40 border border-border text-xs"
                >
                  <span className="font-medium text-foreground">{row.label}</span>
                  <span className="font-mono font-semibold text-primary">
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Top Searched Markets */}
          <section className="bg-card rounded-lg border border-border p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              {isEs ? "Mercados consultados" : "Queried markets"}
            </h2>
            <div className="space-y-2">
              {searchedMarkets.slice(0, 8).map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between p-2.5 rounded bg-secondary/40 border border-border text-xs"
                >
                  <span className="font-medium text-foreground">{row.label}</span>
                  <span className="font-mono text-muted-foreground">
                    {row.count} {isEs ? "búsquedas" : "searches"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}