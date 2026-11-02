import DiscoverOpportunityGroup from "@/components/discovery/DiscoverOpportunityGroup";
import GoogleSheetsExportPanel from "@/components/GoogleSheetsExportPanel";
import {
  formatSearchStatusReason,
  formatBusinessCategoryLabel,
} from "@/lib/opportunity-copy";

export default function DiscoverResults({ d }) {
  const { t, lang, activeSearch, currentSearchStatus: status } = d;
  const isEs = lang === "es";

  if (d.showExamples || activeSearch?.search_mode === "local" || (d.localSearchStatus && !d.activeLiveOpps.length && !d.dismissedLiveOpps.length) || !activeSearch || !["completed", "partial"].includes(status)) {
    return null;
  }

  const timestamp = String(
    d.fromCacheInfo || activeSearch.completed_at || activeSearch.executed_at || ""
  )
    .replace("T", " ")
    .slice(0, 16);
  const statusReasonText = formatSearchStatusReason(activeSearch, lang);
  const categoryLabel = formatBusinessCategoryLabel(activeSearch.business_category, lang);

  const visibleActiveCount = d.visibleActiveIds.length;
  const allVisibleActiveSelected =
    visibleActiveCount > 0 &&
    d.visibleActiveIds.every((id) => d.selectedOppIds.includes(id));

  const selectedActiveCount = d.selectedOppIds.filter(
    (id) => !d.dismissedOppIds.has(id)
  ).length;
  const selectedDismissedCount = d.selectedOppIds.filter((id) =>
    d.dismissedOppIds.has(id)
  ).length;
  const totalSelectedCount = d.selectedOppIds.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-primary">
            {status === "completed"
              ? t("discover.completeBadge")
              : t("discover.partialBadge")}
          </p>
          <p className="text-sm font-medium">
            {categoryLabel} · {activeSearch.location_query} ·{" "}
            {t("discover.lastDaysLabel", { days: activeSearch.time_window_days })}
          </p>
          <p className="text-xs text-muted-foreground">{statusReasonText}</p>
        </div>

        <div className="space-y-2 text-[11px] text-muted-foreground">
          <p>
            {t(
              d.fromCacheInfo ? "discover.cacheBadge" : "discover.retrievedAtLabel",
              { time: timestamp }
            )}
            {activeSearch.duration_ms
              ? ` · ${(activeSearch.duration_ms / 1000).toFixed(1)}s`
              : ""}
          </p>
          {d.dismissedLiveOpps.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={d.toggleDismissed}
                aria-pressed={d.showDismissed}
                className="min-h-9 px-2.5 py-1 rounded-md border border-border bg-secondary/60 text-primary hover:bg-secondary font-medium"
              >
                {t(
                  d.showDismissed
                    ? "discover.hideDismissedBtn"
                    : "discover.showDismissedBtn",
                  { count: d.dismissedLiveOpps.length }
                )}
              </button>
              <span className="text-[10px] text-muted-foreground">
                {isEs ? "(Solo cambia la vista)" : "(Changes view only)"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Google Sheets, CRM & MCP Export Bar */}
      <GoogleSheetsExportPanel
        source="discover"
        records={d.activeLiveOpps}
        selectedIds={d.selectedOppIds}
        feedbackByOppId={d.feedbackByOppId}
      />

      {/* Multi-Select Controls & Action Bar */}
      {(visibleActiveCount > 0 || totalSelectedCount > 0) && (
        <div
          role="region"
          aria-label={
            isEs ? "Selección múltiple de resultados" : "Bulk selection controls"
          }
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs transition-colors ${
            totalSelectedCount > 0
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border bg-card/80 text-muted-foreground"
          }`}
        >
          <div className="flex flex-wrap items-center gap-3">
            {visibleActiveCount > 0 && (
              <label className="inline-flex items-center gap-2 font-medium text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={allVisibleActiveSelected}
                  disabled={d.isBatchBusy}
                  onChange={d.selectAllVisibleActive}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring cursor-pointer"
                />
                <span>
                  {isEs
                    ? `Seleccionar todos los resultados visibles (${visibleActiveCount} activos en esta vista)`
                    : `Select all visible results (${visibleActiveCount} active in this view)`}
                </span>
              </label>
            )}

            {totalSelectedCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-primary text-primary-foreground font-semibold">
                {isEs
                  ? `${totalSelectedCount} seleccionado(s)`
                  : `${totalSelectedCount} selected`}
              </span>
            )}
          </div>

          {totalSelectedCount > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {selectedActiveCount > 0 && (
                <button
                  type="button"
                  disabled={d.isBatchBusy}
                  onClick={d.handleBatchDismissSelected}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                >
                  {d.isBatchBusy
                    ? isEs
                      ? "Procesando…"
                      : "Processing…"
                    : isEs
                    ? `Descartar seleccionados (${selectedActiveCount})`
                    : `Dismiss selected (${selectedActiveCount})`}
                </button>
              )}

              {selectedDismissedCount > 0 && (
                <button
                  type="button"
                  disabled={d.isBatchBusy}
                  onClick={d.handleBatchRestoreSelected}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {d.isBatchBusy
                    ? isEs
                      ? "Procesando…"
                      : "Processing…"
                    : isEs
                    ? `Restaurar seleccionados (${selectedDismissedCount})`
                    : `Restore selected (${selectedDismissedCount})`}
                </button>
              )}

              <button
                type="button"
                disabled={d.isBatchBusy}
                onClick={d.clearSelection}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-card text-foreground border border-border hover:bg-secondary disabled:opacity-50"
              >
                {isEs ? "Limpiar selección" : "Clear selection"}
              </button>
            </div>
          )}
        </div>
      )}

      <DiscoverOpportunityGroup d={d} type="verified" items={d.verifiedOpps} />
      <DiscoverOpportunityGroup d={d} type="review" items={d.needsReviewOpps} />
      {d.showDismissed && (
        <DiscoverOpportunityGroup
          d={d}
          type="dismissed"
          items={d.dismissedLiveOpps}
        />
      )}
    </div>
  );
}