import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  formatRecencyBasisLabel,
  normalizeServicesList,
  buildServiceFitHypothesis,
} from "@/lib/leads-constants";
import {
  formatSignalTypeLabel,
  formatBusinessCategoryLabel,
  formatDateValue,
  formatOriginalExcerptBadge,
  formatSignalSummary,
  getExcerptSupportTranslation,
  formatVerificationNotes,
  buildSourceVerificationDetails,
} from "@/lib/opportunity-copy";
import {
  getWorkspaceBootstrap,
  updateSavedOpportunityItem,
  deleteSavedOpportunityItem,
} from "@/lib/server-fns";
import GoogleSheetsExportPanel from "@/components/GoogleSheetsExportPanel";
import ExportSelectionToolbar from "@/components/export/ExportSelectionToolbar";
import { usePreferences } from "@/lib/PreferencesContext";
import { trackLeadsEvent } from "@/lib/telemetry";
import { safePublicUrl } from "@/lib/public-url";

export const Route = createFileRoute("/_authed/saved")({
  ssr: false,
  validateSearch: (search) => {
    const out = {};
    if (
      typeof search?.stage === "string" &&
      ["saved", "researching", "qualified", "archived"].includes(search.stage)
    ) {
      out.stage = search.stage;
    }
    return out;
  },
  loader: () => getWorkspaceBootstrap(),
  head: () => ({
    meta: [
      { title: "Saved leads — goleads.app" },
      { name: "description", content: "Review your saved leads, original evidence, dates, and notes." },
    ],
  }),
  component: SavedOpportunitiesScreen,
});

function SavedOpportunitiesScreen() {
  const data = Route.useLoaderData();
  const searchParams = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const router = useRouter();
  const { lang, syncFromProfile, t } = usePreferences();

  const updateSavedFn = useServerFn(updateSavedOpportunityItem);
  const deleteSavedFn = useServerFn(deleteSavedOpportunityItem);

  const savedList = data?.savedOpportunities || [];
  const profileServices = normalizeServicesList(data?.profile?.selected_services || []);
  const profileDescription = data?.profile?.service_description || "";
  const feedbackByOppId = new Map(
    (data?.feedbackRecords || []).map((f) => [f.opportunity_id, f])
  );

  useEffect(() => {
    if (data?.profile) {
      syncFromProfile(data.profile);
    }
  }, [data?.profile?.id]);

  useEffect(() => {
    document.title = t("saved.pageTitle");
  }, [lang, t]);

  const stages = [
    { id: "all", label: t("saved.stages.all") },
    { id: "saved", label: t("saved.stages.saved") },
    { id: "researching", label: t("saved.stages.researching") },
    { id: "qualified", label: t("saved.stages.qualified") },
    { id: "archived", label: t("saved.stages.archived") },
  ];

  const stageFilter = searchParams.stage || "all";
  const [busyId, setBusyId] = useState(null);
  const [editingNotesById, setEditingNotesById] = useState({});
  const [banner, setBanner] = useState("");
  const [exportSelection, setExportSelection] = useState([]);

  const filteredList =
    stageFilter === "all"
      ? savedList
      : savedList.filter((item) => (item.review_stage || "saved") === stageFilter);

  const visibleExportSelection = exportSelection.filter((id) =>
    filteredList.some((item) => (item.opportunity_id || item.id) === id)
  );
  const handleSelectStageFilter = (nextStage) => {
    setExportSelection([]);
    navigate({
      search: nextStage === "all" ? {} : { stage: nextStage },
      replace: true,
    });
  };

  const handleStageChange = async (id, review_stage) => {
    setBusyId(id);
    setBanner("");
    try {
      await updateSavedFn({ data: { id, review_stage } });
      await router.invalidate();
      setBanner(t("saved.stageUpdatedBanner"));
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveNotes = async (item) => {
    const draft =
      editingNotesById[item.id] !== undefined
        ? editingNotesById[item.id]
        : item.qualification_notes || "";
    setBusyId(item.id);
    setBanner("");
    try {
      await updateSavedFn({
        data: { id: item.id, qualification_notes: draft },
      });
      await router.invalidate();
      setBanner(t("saved.notesSavedBanner", { name: item.business_name }));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item) => {
    setBusyId(item.id);
    setBanner("");
    try {
      await deleteSavedFn({ data: { id: item.id } });
      await router.invalidate();
      setBanner(t("saved.removedBanner", { name: item.business_name }));
    } finally {
      setBusyId(null);
    }
  };

  const handleSourceOpen = (item) => {
    trackLeadsEvent(
      "source_opened",
      {
        verification_status: item.verification_status || "needs_review",
        recency_basis: item.recency_basis || "unverified_date",
        surface: "saved_leads",
      },
      { opportunityId: item.opportunity_id }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {t("saved.heading", { count: savedList.length })}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("saved.subheading")}
          </p>
        </div>

        <Link
          to="/app"
          className="px-3.5 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 text-center focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {t("saved.findLeadsBtn")}
        </Link>
      </div>

      {/* Google Sheets, CRM & MCP Export Bar */}
      <GoogleSheetsExportPanel
        source="saved"
        records={filteredList}
        selectedIds={visibleExportSelection}
        stageFilter={stageFilter}
        feedbackByOppId={feedbackByOppId}
      />

      <ExportSelectionToolbar records={filteredList} selectedIds={visibleExportSelection} onChange={setExportSelection} es={lang === "es"} />

      {/* Stage Filter Bar */}
      {savedList.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {stages.map((st) => {
            const count =
              st.id === "all"
                ? savedList.length
                : savedList.filter((i) => (i.review_stage || "saved") === st.id).length;
            const active = stageFilter === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => handleSelectStageFilter(st.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-secondary"
                }`}
              >
                {st.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {banner && (
        <div
          role="status"
          className="px-4 py-2.5 rounded-md bg-primary/15 border border-primary/30 text-xs text-foreground flex items-center justify-between"
        >
          <span>{banner}</span>
          <button
            type="button"
            onClick={() => setBanner("")}
            className="text-primary hover:underline font-medium ml-4"
          >
            {t("common.dismiss")}
          </button>
        </div>
      )}

      {filteredList.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-8 text-center space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            {savedList.length === 0
              ? t("saved.emptyAllTitle")
              : t("saved.emptyStageTitle", {
                  stage: t(`saved.stages.${stageFilter}`),
                })}
          </h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {savedList.length === 0 ? t("saved.emptyAllBody") : t("saved.emptyStageBody")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredList.map((item) => {
            const isVerified = item.verification_status === "verified";
            const recencyLabel = formatRecencyBasisLabel(item.recency_basis, lang);
            const signalLabel = formatSignalTypeLabel(item.signal_type, lang);
            const categoryLabel = formatBusinessCategoryLabel(item.business_category, lang);
            const summaryText = formatSignalSummary(item, lang);
            const excerptSupportTranslation = getExcerptSupportTranslation(item, lang);
            const verificationNotesText = formatVerificationNotes(item, lang);
            const sourceDetails = buildSourceVerificationDetails(item, [], lang);
            const effectiveServices =
              profileServices.length > 0
                ? profileServices
                : normalizeServicesList(item.inferred_service_categories || []);
            const fitText = buildServiceFitHypothesis(
              item,
              effectiveServices,
              profileDescription,
              lang
            );
            const fb = feedbackByOppId.get(item.opportunity_id);
            const noteVal =
              editingNotesById[item.id] !== undefined
                ? editingNotesById[item.id]
                : item.qualification_notes || "";

            return (
              <article
                key={item.id}
                className="bg-card text-card-foreground rounded-lg border border-border p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                          isVerified
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                            : "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35"
                        }`}
                      >
                        {isVerified ? t("common.verified") : t("common.needsReview")}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/15 text-primary border border-primary/30">
                        {signalLabel}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs bg-secondary text-muted-foreground border border-border">
                        {recencyLabel}
                      </span>
                      {fb?.verdict && (
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium border ${
                            fb.verdict === "relevant"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                              : "bg-destructive/15 text-destructive border-destructive/30"
                          }`}
                        >
                          {fb.verdict === "relevant"
                            ? t("card.ratedRelevant")
                            : t("card.RatedNotRelevant")}
                        </span>
                      )}
                    </div>

                    <label className="flex min-h-10 items-start gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={visibleExportSelection.includes(item.opportunity_id || item.id)} onChange={() => {
                        const id = item.opportunity_id || item.id;
                        setExportSelection((previous) => previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]);
                      }} aria-label={lang === "es" ? `Seleccionar ${item.business_name} para exportar` : `Select ${item.business_name} for export`} className="mt-1 h-4 w-4 shrink-0 accent-primary focus-visible:ring-2 focus-visible:ring-ring" />
                      <h3 className="text-base font-semibold text-foreground break-words">{item.business_name}</h3>
                    </label>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{item.location}</span>
                      {categoryLabel && <span>· {categoryLabel}</span>}
                      <span>·</span>
                      <a
                        href={safePublicUrl(item.source_url)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => handleSourceOpen(item)}
                        className="text-primary hover:underline font-medium break-words"
                      >
                        {item.source_title || t("saved.sourceLink")}
                      </a>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <select
                      aria-label={t("detail.reviewStageLabel")}
                      value={item.review_stage || "saved"}
                      disabled={busyId === item.id}
                      onChange={(e) => handleStageChange(item.id, e.target.value)}
                      className="h-8 px-2.5 rounded-md border border-input text-xs font-medium text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="saved">{t("saved.stages.saved")}</option>
                      <option value="researching">{t("saved.stages.researching")}</option>
                      <option value="qualified">{t("saved.stages.qualified")}</option>
                      <option value="archived">{t("saved.stages.archived")}</option>
                    </select>

                    <Link
                      to="/opportunities/$opportunityId"
                      params={{ opportunityId: item.opportunity_id }}
                      search={{
                        from: "saved",
                        stage: stageFilter !== "all" ? stageFilter : undefined,
                      }}
                      className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {t("saved.viewEvidenceBtn")}
                    </Link>

                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => handleDelete(item)}
                      className="px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {t("saved.unsaveBtn")}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border/70">
                  <div className="bg-secondary/50 rounded-md p-3 border border-border space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">
                        {t("saved.originalEvidenceTitle")}
                      </span>
                      <a
                        href={safePublicUrl(item.source_url)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => handleSourceOpen(item)}
                        className="text-primary hover:underline font-medium"
                      >
                        {t("saved.sourceLink")}
                      </a>
                    </div>
                    {summaryText && (
                      <p className="text-xs text-foreground/90 leading-relaxed">{summaryText}</p>
                    )}
                    <div className="space-y-1.5">
                      <span className="inline-block text-[10px] font-mono text-muted-foreground">
                        {formatOriginalExcerptBadge(item.supporting_excerpt, lang)}
                      </span>
                      <blockquote className="text-xs italic text-muted-foreground border-l-2 border-primary/50 pl-2.5 break-words">
                        {item.supporting_excerpt}
                      </blockquote>
                      {excerptSupportTranslation && (
                        <div className="rounded bg-card/70 border border-border/70 px-2.5 py-1.5 space-y-0.5">
                          <span className="block text-[10px] font-mono text-primary">
                            {t("common.optionalTranslationBadge")}
                          </span>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            {excerptSupportTranslation}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-[11px] font-mono text-muted-foreground pt-1">
                      <span>
                        {t("common.published")}: {formatDateValue(item.publication_date, lang)}
                      </span>
                      <span>
                        {t("common.eventDate")}: {formatDateValue(item.event_date, lang)}
                      </span>
                      <span>
                        {t("common.retrieved")}:{" "}
                        {item.retrieval_date
                          ? String(item.retrieval_date).replace("T", " ").slice(0, 16) + " UTC"
                          : t("common.notStated")}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground pt-0.5">
                      {sourceDetails.lastCheckedLabel}
                    </div>
                    {verificationNotesText && (
                      <p
                        className={`text-[11px] pt-0.5 ${
                          isVerified
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-amber-800 dark:text-amber-300 font-medium"
                        }`}
                      >
                        {verificationNotesText}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="bg-accent/60 rounded-md p-3 border border-primary/25 space-y-1">
                      <div className="text-xs font-medium text-foreground">
                        {t("card.possibleServiceFitTitle")}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{fitText}</p>
                    </div>

                    <div className="bg-secondary/50 rounded-md p-3 border border-border space-y-1.5">
                      <label
                        htmlFor={`notes-${item.id}`}
                        className="block text-xs font-medium text-foreground"
                      >
                        {t("saved.privateNotesLabel")}
                      </label>
                      <div className="flex gap-2">
                        <input
                          id={`notes-${item.id}`}
                          type="text"
                          maxLength={1000}
                          value={noteVal}
                          onChange={(e) =>
                            setEditingNotesById((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          placeholder={t("saved.privateNotesPlaceholder")}
                          className="flex-1 h-8 px-2.5 rounded border border-input bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => handleSaveNotes(item)}
                          className="px-3 py-1 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {t("saved.saveNoteBtn")}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}