import { useState, useEffect } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { clearOpportunityFeedback } from "@/lib/server-fns";
import { getExtendedWorkspaceData } from "@/lib/workspace-pages-fns";
import {
  formatFeedbackReasonCategory,
  formatFeedbackNote,
} from "@/lib/opportunity-copy";
import { usePreferences } from "@/lib/PreferencesContext";

export const Route = createFileRoute("/_authed/feedback-summary")({
  ssr: false,
  loader: () => getExtendedWorkspaceData(),
  head: () => ({
    meta: [
      { title: "Feedback Summary — goleads.app" },
      {
        name: "description",
        content:
          "Track your lead relevance ratings, categorizations, and evaluation notes.",
      },
    ],
  }),
  component: FeedbackSummaryPage,
});

function FeedbackSummaryPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const clearFeedbackFn = useServerFn(clearOpportunityFeedback);
  const { lang, syncFromProfile, t } = usePreferences();
  const isEs = lang === "es";

  const feedbackRecords = data?.feedbackRecords || [];
  const oppMap = new Map((data?.opportunities || []).map((o) => [o.id, o]));

  const [verdictFilter, setVerdictFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);
  const [banner, setBanner] = useState("");

  useEffect(() => {
    if (data?.profile) {
      syncFromProfile(data.profile);
    }
  }, [data?.profile?.id]);

  useEffect(() => {
    document.title = isEs
      ? "Resumen de calificaciones — goleads.app"
      : "Feedback Summary — goleads.app";
  }, [isEs]);

  const counts = {
    all: feedbackRecords.length,
    relevant: feedbackRecords.filter((f) => f.verdict === "relevant").length,
    not_relevant: feedbackRecords.filter((f) => f.verdict === "not_relevant").length,
    weak_evidence: feedbackRecords.filter((f) => f.verdict === "weak_evidence").length,
    out_of_territory: feedbackRecords.filter((f) => f.verdict === "out_of_territory")
      .length,
    already_client: feedbackRecords.filter((f) => f.verdict === "already_client").length,
  };

  const filtered =
    verdictFilter === "all"
      ? feedbackRecords
      : feedbackRecords.filter((f) => f.verdict === verdictFilter);

  const formatVerdictLabel = (verdict) => {
    if (verdict === "relevant") return isEs ? "Relevante" : "Relevant";
    if (verdict === "weak_evidence")
      return isEs ? "Evidencia débil" : "Weak evidence";
    if (verdict === "out_of_territory")
      return isEs ? "Fuera de territorio" : "Out of territory";
    if (verdict === "already_client")
      return isEs ? "Ya es cliente" : "Already client";
    return isEs ? "No relevante" : "Not relevant";
  };

  const handleClear = async (fb) => {
    setBusyId(fb.id);
    setBanner("");
    try {
      await clearFeedbackFn({ data: { opportunity_id: fb.opportunity_id } });
      await router.invalidate();
      setBanner(
        isEs
          ? `Calificación eliminada para ${fb.business_name || "el lead"}.`
          : `Cleared rating for ${fb.business_name || "lead"}.`
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {isEs ? "Resumen de calificaciones" : "Feedback Summary"} (
            {feedbackRecords.length})
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEs
              ? "Revisa todas tus evaluaciones de relevancia, motivos y notas de calidad de prospectos."
              : "Review all your relevance evaluations, reason tags, and lead quality notes."}
          </p>
        </div>

        <Link
          to="/app"
          className="px-3.5 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 text-center"
        >
          {t("nav.findLeads")}
        </Link>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="text-xs text-muted-foreground">
            {isEs ? "Total evaluados" : "Total evaluated"}
          </div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">
            {counts.all}
          </div>
        </div>
        <div className="bg-card rounded-lg border border-emerald-500/30 p-4">
          <div className="text-xs text-emerald-700 dark:text-emerald-300">
            {isEs ? "Relevantes" : "Relevant"}
          </div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">
            {counts.relevant}
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="text-xs text-muted-foreground">
            {isEs ? "No relevantes / Otros" : "Not relevant / Other"}
          </div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">
            {counts.all - counts.relevant}
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="text-xs text-muted-foreground">
            {isEs ? "Con nota explicativa" : "With written note"}
          </div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">
            {feedbackRecords.filter((f) => Boolean(f.reason_note?.trim())).length}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {[
          { id: "all", label: `${isEs ? "Todas" : "All"} (${counts.all})` },
          {
            id: "relevant",
            label: `${isEs ? "Relevantes" : "Relevant"} (${counts.relevant})`,
          },
          {
            id: "not_relevant",
            label: `${isEs ? "No relevantes" : "Not relevant"} (${counts.not_relevant})`,
          },
          {
            id: "weak_evidence",
            label: `${isEs ? "Evidencia débil" : "Weak evidence"} (${counts.weak_evidence})`,
          },
          {
            id: "out_of_territory",
            label: `${isEs ? "Fuera de territorio" : "Out of territory"} (${counts.out_of_territory})`,
          },
          {
            id: "already_client",
            label: `${isEs ? "Ya es cliente" : "Already client"} (${counts.already_client})`,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setVerdictFilter(tab.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              verdictFilter === tab.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {banner && (
        <div
          role="status"
          className="px-4 py-2.5 rounded-md bg-primary/15 border border-primary/30 text-xs text-foreground flex items-center justify-between"
        >
          <span>{banner}</span>
          <button
            type="button"
            onClick={() => setBanner("")}
            className="text-primary hover:underline font-medium"
          >
            {t("common.dismiss")}
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-8 text-center space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            {isEs
              ? "No hay calificaciones en esta vista"
              : "No feedback records in this view"}
          </h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {isEs
              ? "Califica prospectos como Relevante o No relevante desde los detalles de cualquier oportunidad."
              : "Rate prospects as Relevant or Not relevant from any opportunity detail view."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((fb) => {
            const linkedOpp = oppMap.get(fb.opportunity_id);
            const isRel = fb.verdict === "relevant";

            return (
              <article
                key={fb.id}
                className="bg-card text-card-foreground rounded-lg border border-border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                        isRel
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                          : "bg-destructive/15 text-destructive border-destructive/30"
                      }`}
                    >
                      {formatVerdictLabel(fb.verdict)}
                    </span>
                    <h3 className="text-sm font-semibold text-foreground">
                      {fb.business_name || linkedOpp?.business_name || fb.opportunity_id}
                    </h3>
                    {linkedOpp?.location && (
                      <span className="text-xs text-muted-foreground">
                        · {linkedOpp.location}
                      </span>
                    )}
                  </div>

                  {fb.reason_category && (
                    <div className="text-xs font-medium text-foreground">
                      {isEs ? "Categoría:" : "Reason tag:"}{" "}
                      {formatFeedbackReasonCategory(fb.reason_category, lang)}
                    </div>
                  )}

                  {fb.reason_note && (
                    <p className="text-xs text-muted-foreground italic">
                      "{formatFeedbackNote(fb.reason_note, lang)}"
                    </p>
                  )}

                  {fb.recorded_at && (
                    <div className="text-[11px] font-mono text-muted-foreground">
                      {String(fb.recorded_at).replace("T", " ").slice(0, 16)} UTC
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    to="/opportunities/$opportunityId"
                    params={{ opportunityId: fb.opportunity_id }}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {t("card.viewDetailsBtn")}
                  </Link>
                  <button
                    type="button"
                    disabled={busyId === fb.id}
                    onClick={() => handleClear(fb)}
                    className="px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    {t("feedback.clearRatingBtn")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}