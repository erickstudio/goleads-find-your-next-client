import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getExtendedWorkspaceData } from "@/lib/workspace-pages-fns";
import { usePreferences } from "@/lib/PreferencesContext";

export const Route = createFileRoute("/_authed/search-history")({
  ssr: false,
  loader: () => getExtendedWorkspaceData(),
  head: () => ({
    meta: [
      { title: "Search History — goleads.app" },
      {
        name: "description",
        content: "Review and rerun your previous prospect discovery queries.",
      },
    ],
  }),
  component: SearchHistoryPage,
});

function SearchHistoryPage() {
  const data = Route.useLoaderData();
  const { lang, syncFromProfile, t } = usePreferences();
  const isEs = lang === "es";

  const searches = data?.recentSearches || [];
  const quota = data?.quota || {};
  const [statusFilter, setStatusFilter] = useState("all");
  const [queryText, setQueryText] = useState("");

  useEffect(() => {
    if (data?.profile) {
      syncFromProfile(data.profile);
    }
  }, [data?.profile?.id]);

  useEffect(() => {
    document.title = isEs
      ? "Historial de búsquedas — goleads.app"
      : "Search History — goleads.app";
  }, [isEs]);

  const filteredSearches = searches.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (queryText.trim()) {
      const q = queryText.trim().toLowerCase();
      const cat = String(s.business_category || "").toLowerCase();
      const loc = String(s.location_query || "").toLowerCase();
      return cat.includes(q) || loc.includes(q);
    }
    return true;
  });

  const statusBadge = (status) => {
    if (status === "completed") {
      return {
        label: isEs ? "Completada" : "Completed",
        cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      };
    }
    if (status === "partial") {
      return {
        label: isEs ? "Parcial" : "Partial",
        cls: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35",
      };
    }
    if (status === "empty") {
      return {
        label: isEs ? "Sin resultados" : "No results",
        cls: "bg-secondary text-muted-foreground border-border",
      };
    }
    if (status === "failed") {
      return {
        label: isEs ? "Fallida" : "Failed",
        cls: "bg-destructive/15 text-destructive border-destructive/30",
      };
    }
    return {
      label: status || "ready",
      cls: "bg-secondary text-muted-foreground border-border",
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {isEs ? "Historial de búsquedas" : "Search History"} ({searches.length})
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEs
              ? "Revisa tus búsquedas anteriores de aperturas y expansiones o vuelve a ejecutarlas con un clic."
              : "Review your previous prospect discovery queries or rerun them with one click."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded text-xs font-mono bg-secondary text-muted-foreground border border-border">
            {t("discover.quotaRemaining", {
              remaining: quota.remainingToday ?? 3,
              max: quota.maxDaily ?? 3,
            })}
          </span>
          <Link
            to="/app"
            className="px-3.5 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isEs ? "Nueva búsqueda" : "New search"}
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg border border-border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "all", label: isEs ? "Todas" : "All" },
            { id: "completed", label: isEs ? "Completadas" : "Completed" },
            { id: "partial", label: isEs ? "Parciales" : "Partial" },
            { id: "empty", label: isEs ? "Sin resultados" : "Empty" },
            { id: "failed", label: isEs ? "Fallidas" : "Failed" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                statusFilter === tab.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder={
            isEs
              ? "Filtrar por categoría o ciudad..."
              : "Filter by category or city..."
          }
          className="h-9 px-3 rounded-md border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground sm:w-64 focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {filteredSearches.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-8 text-center space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            {isEs ? "No se encontraron búsquedas" : "No searches found"}
          </h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {isEs
              ? "Ejecuta una búsqueda en Buscar leads para registrar tu historial de prospección."
              : "Run a discovery search in Find leads to build your search history."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSearches.map((s) => {
            const badge = statusBadge(s.status);
            const executedAt = String(
              s.completed_at || s.executed_at || s.created_date || ""
            )
              .replace("T", " ")
              .slice(0, 16);

            return (
              <article
                key={s.id}
                className="bg-card text-card-foreground rounded-lg border border-border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold border ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {s.business_category} · {s.location_query}
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-mono bg-secondary text-muted-foreground border border-border">
                      {t("discover.daysOption", { days: s.time_window_days || 90 })}
                    </span>
                  </div>

                  {s.honest_status_reason && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {s.honest_status_reason}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-muted-foreground">
                    <span>
                      {isEs ? "Resultados:" : "Results:"} {s.results_count ?? 0} (
                      {s.verified_count ?? 0} {t("common.verified")} /{" "}
                      {s.needs_review_count ?? 0} {t("common.needsReview")})
                    </span>
                    {executedAt && (
                      <span>
                        {isEs ? "Ejecutada:" : "Executed:"} {executedAt} UTC
                      </span>
                    )}
                    {s.duration_ms ? (
                      <span>{(s.duration_ms / 1000).toFixed(1)}s</span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Link
                    to="/app"
                    search={{
                      category: s.business_category,
                      location: s.location_query,
                      window: s.time_window_days || 90,
                      searchId: s.id,
                    }}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isEs ? "Ver / Re-ejecutar" : "Review / Rerun"}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}