import OpportunityCard from "@/components/OpportunityCard";

export default function DiscoverExamples({ d }) {
  if (!d.showExamples) return null;
  return (
    <section aria-label={d.t("discover.examplesBannerTitle")} className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary p-4 text-xs text-muted-foreground"><p className="max-w-2xl leading-relaxed"><strong className="text-foreground">{d.t("discover.examplesBannerTitle")}</strong> · {d.t("discover.examplesBannerBody")}</p><button type="button" onClick={d.toggleExamples} className="text-primary hover:underline">{d.t("discover.closeExamplesBtn")}</button></div>{d.visibleExamples.map((opp) => <OpportunityCard key={opp.id} opp={opp} selectedServices={d.selectedServices} serviceDescription={d.serviceDescription} isExample detailSearchParams={d.detailSearchParams} onDismiss={(item) => d.setDismissedExampleIds((prev) => [...prev, item.id])} />)}</section>
  );
}