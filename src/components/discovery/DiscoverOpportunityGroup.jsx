import OpportunityCard from "@/components/OpportunityCard";

export default function DiscoverOpportunityGroup({ d, type, items }) {
  const { t } = d;
  const titleKey =
    type === "verified"
      ? "verifiedSectionTitle"
      : type === "review"
      ? "needsReviewSectionTitle"
      : "dismissedSectionTitle";
  const subtitleKey =
    type === "verified"
      ? "verifiedSectionSub"
      : type === "review"
      ? "needsReviewSectionSub"
      : "dismissedSectionSub";

  if (type !== "verified" && !items.length) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">
          {t(`discover.${titleKey}`, { count: items.length })}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t(`discover.${subtitleKey}`)}
        </p>
      </div>
      {!items.length && (
        <p className="rounded-xl border border-border bg-card p-5 text-xs text-muted-foreground">
          {t("discover.noVerifiedInView")}
        </p>
      )}
      {items.map((opp) => {
        const fb = d.feedbackByOppId.get(opp.id);
        const isItemBusy =
          d.busyOppId === opp.id ||
          (Array.isArray(d.busyOppIds) && d.busyOppIds.includes(opp.id));
        return (
          <OpportunityCard
            key={opp.id}
            opp={opp}
            selectedServices={d.selectedServices}
            serviceDescription={d.serviceDescription}
            isSaved={d.savedOppIds.has(opp.id)}
            isDismissed={type === "dismissed"}
            isSelected={d.selectedOppIds.includes(opp.id)}
            feedbackVerdict={fb?.verdict || null}
            feedbackRecordedAt={fb?.recorded_at || null}
            isBusy={isItemBusy}
            detailSearchParams={d.detailSearchParams}
            onToggleSelect={d.toggleSelectOpportunity}
            onSave={d.handleSaveOpportunity}
            onUnsave={d.handleUnsaveOpportunity}
            onDismiss={type !== "dismissed" ? d.handleDismissOpportunity : undefined}
            onRestore={type === "dismissed" ? d.handleRestoreOpportunity : undefined}
          />
        );
      })}
    </section>
  );
}