import { useState, useEffect } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Check, AlertTriangle } from "lucide-react";
import RelevanceFeedbackPanel from "@/components/RelevanceFeedbackPanel";
import AgentChatPanel from "@/components/AgentChatPanel";
import {
  EXAMPLE_OPPORTUNITIES,
  normalizeServicesList,
  buildServiceFitHypothesis,
  formatRecencyBasisLabel,
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
  getOpportunityDetail,
  saveOpportunityForUser,
  unsaveOpportunityForUser,
  updateSavedOpportunityItem,
  recordOpportunityFeedback,
  clearOpportunityFeedback,
} from "@/lib/server-fns";
import { saveSavedOpportunityOutreach } from "@/lib/workspace-pages-fns";
import { buildOutreachDraft } from "@/lib/i18n";
import { usePreferences } from "@/lib/PreferencesContext";
import { trackLeadsEvent } from "@/lib/telemetry";
import { safePublicUrl } from "@/lib/public-url";

export const Route = createFileRoute("/_authed/opportunities/$opportunityId")({
  ssr: false,
  validateSearch: (search) => {
    const out = {};
    if (search?.from === "saved" || search?.from === "discover") {
      out.from = search.from;
    }
    if (typeof search?.category === "string" && search.category.trim()) {
      out.category = search.category.trim().slice(0, 120);
    }
    if (typeof search?.location === "string" && search.location.trim()) {
      out.location = search.location.trim().slice(0, 120);
    }
    const winNum = Number(search?.window);
    if (winNum === 30 || winNum === 90 || winNum === 180) {
      out.window = winNum;
    }
    if (typeof search?.searchId === "string" && search.searchId.trim()) {
      out.searchId = search.searchId.trim().slice(0, 120);
    }
    if (search?.examples === "1") out.examples = "1";
    if (search?.showDismissed === "1") out.showDismissed = "1";
    if (typeof search?.stage === "string" && search.stage.trim()) {
      out.stage = search.stage.trim().slice(0, 40);
    }
    return out;
  },
  loader: ({ params }) => getOpportunityDetail({ data: { opportunityId: params.opportunityId } }),
  head: () => ({
    meta: [
      { title: "Opportunity details — goleads.app" },
      { name: "description", content: "Inspect verified expansion sources and service-fit hypotheses." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OpportunityDetailScreen,
});

function detectServiceInDraft(draftText, servicesList = []) {
  if (!draftText || !Array.isArray(servicesList) || servicesList.length === 0) {
    return servicesList[0] || "";
  }
  const lowerDraft = String(draftText).toLowerCase();
  for (const svc of servicesList) {
    if (svc && lowerDraft.includes(svc.toLowerCase())) {
      return svc;
    }
  }
  return servicesList[0] || "";
}

function OpportunityDetailScreen() {
  const { opportunityId } = Route.useParams();
  const navSearch = Route.useSearch();
  const detailData = Route.useLoaderData();
  const router = useRouter();
  const { lang, outreachLang, setOutreachLang, syncFromProfile, t } = usePreferences();
  const isEs = lang === "es";

  const saveOppFn = useServerFn(saveOpportunityForUser);
  const unsaveOppFn = useServerFn(unsaveOpportunityForUser);
  const updateSavedFn = useServerFn(updateSavedOpportunityItem);
  const saveOutreachFn = useServerFn(saveSavedOpportunityOutreach);
  const feedbackFn = useServerFn(recordOpportunityFeedback);
  const clearFeedbackFn = useServerFn(clearOpportunityFeedback);

  const exampleOpp = EXAMPLE_OPPORTUNITIES.find((item) => item.id === opportunityId);
  const isExample = Boolean(detailData?.isExample || exampleOpp);
  const opp = detailData?.opportunity || exampleOpp;

  const profile = detailData?.profile;
  const selectedServices = normalizeServicesList(profile?.selected_services || []);
  const serviceDescription = profile?.service_description || "";

  const savedRecord = detailData?.savedRecord || null;
  const feedbackRecord = detailData?.feedbackRecord || null;

  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState("info");
  const [isBusy, setIsBusy] = useState(false);
  const [notesDraft, setNotesDraft] = useState(savedRecord?.qualification_notes || "");
  const [reviewStage, setReviewStage] = useState(savedRecord?.review_stage || "saved");
  const [copiedOutreach, setCopiedOutreach] = useState(false);

  const [draftService, setDraftService] = useState(() =>
    detectServiceInDraft(savedRecord?.outreach_draft, selectedServices)
  );
  const [draftLang, setDraftLang] = useState(
    () => savedRecord?.outreach_draft_language || outreachLang || "en"
  );
  const [draftText, setDraftText] = useState("");
  const [baselineTemplate, setBaselineTemplate] = useState("");
  const [pendingReplace, setPendingReplace] = useState(null);

  useEffect(() => {
    if (profile) {
      syncFromProfile(profile);
    }
  }, [profile?.id]);

  useEffect(() => {
    document.title = opp?.business_name
      ? `${opp.business_name} — ${t("detail.pageTitle")}`
      : t("detail.pageTitle");
  }, [lang, opp?.business_name, t]);

  useEffect(() => {
    setNotesDraft(savedRecord?.qualification_notes || "");
    setReviewStage(savedRecord?.review_stage || "saved");
  }, [savedRecord?.id, savedRecord?.qualification_notes, savedRecord?.review_stage]);

  useEffect(() => {
    if (!opp) return;
    const initLang = savedRecord?.outreach_draft_language || outreachLang || "en";
    const matchedSvc = detectServiceInDraft(
      savedRecord?.outreach_draft,
      selectedServices
    );
    const defaultGenerated = buildOutreachDraft(
      opp,
      matchedSvc ? [matchedSvc] : selectedServices.slice(0, 1),
      serviceDescription,
      initLang
    );
    const existingSavedDraft =
      typeof savedRecord?.outreach_draft === "string" &&
      savedRecord.outreach_draft.trim()
        ? savedRecord.outreach_draft
        : "";
    setDraftLang(initLang);
    setDraftService(matchedSvc);
    setBaselineTemplate(defaultGenerated);
    setDraftText(existingSavedDraft || defaultGenerated);
    setPendingReplace(null);
  }, [opp?.id, savedRecord?.id]);

  const backToSaved = navSearch.from === "saved";
  const discoverBackSearch = {
    category: navSearch.category,
    location: navSearch.location,
    window: navSearch.window,
    searchId: navSearch.searchId,
    examples: navSearch.examples,
    showDismissed: navSearch.showDismissed,
  };
  const savedBackSearch = navSearch.stage ? { stage: navSearch.stage } : {};

  if (!opp) {
    return (
      <div className="max-w-2xl mx-auto bg-card rounded-lg border border-border p-6 text-center space-y-3">
        <h1 className="text-lg font-semibold text-foreground">{t("detail.notFoundTitle")}</h1>
        <p className="text-xs text-muted-foreground">{t("detail.notFoundBody")}</p>
        <Link
          to={backToSaved ? "/saved" : "/app"}
          search={backToSaved ? savedBackSearch : discoverBackSearch}
          className="inline-block px-3.5 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground"
        >
          {backToSaved ? t("detail.backToSaved") : t("detail.backToDiscover")}
        </Link>
      </div>
    );
  }

  const evidenceList =
    detailData?.evidenceItems?.length > 0
      ? detailData.evidenceItems
      : opp.evidence_items || [
          {
            id: "primary-ev",
            source_title: opp.source_title,
            source_url: opp.source_url,
            supporting_excerpt: opp.supporting_excerpt,
            publication_date: opp.publication_date,
            event_date: opp.event_date,
            retrieval_date: opp.retrieval_date,
            recency_basis: opp.recency_basis,
            verification_status: opp.verification_status,
            verification_notes: opp.verification_notes,
            evidence_status: opp.evidence_status,
          },
        ];

  const isSavedLive = Boolean(savedRecord);
  const isVerified = opp.verification_status === "verified";
  const dynamicFitText = buildServiceFitHypothesis(opp, selectedServices, serviceDescription, lang);
  const recencyLabel = formatRecencyBasisLabel(opp.recency_basis, lang);
  const signalLabel = formatSignalTypeLabel(opp.signal_type, lang);
  const categoryLabel = formatBusinessCategoryLabel(opp.business_category, lang);
  const summaryText = formatSignalSummary(opp, lang);
  const verificationNotesText = formatVerificationNotes(opp, lang);
  const sourceDetails = buildSourceVerificationDetails(opp, evidenceList, lang);

  const isDraftEdited =
    Boolean(draftText.trim()) &&
    draftText.trim() !== baselineTemplate.trim();

  const applyTemplateReplacement = (nextService, nextLang) => {
    const svc = nextService !== undefined ? nextService : draftService;
    const lng = nextLang || draftLang;
    setDraftService(svc);
    setDraftLang(lng);
    setOutreachLang(lng);
    const fresh = buildOutreachDraft(
      opp,
      svc ? [svc] : selectedServices.slice(0, 1),
      serviceDescription,
      lng
    );
    setBaselineTemplate(fresh);
    setDraftText(fresh);
    setPendingReplace(null);
  };

  const handleServiceChange = (e) => {
    const nextService = e.target.value;
    setDraftService(nextService);
    if (!isDraftEdited) {
      const fresh = buildOutreachDraft(
        opp,
        nextService ? [nextService] : selectedServices.slice(0, 1),
        serviceDescription,
        draftLang
      );
      setBaselineTemplate(fresh);
      setDraftText(fresh);
      setPendingReplace(null);
    } else {
      setPendingReplace({
        nextService,
        nextLang: draftLang,
      });
    }
  };

  const handleRequestTemplateUpdate = (targetLang) => {
    const nextLang = targetLang || draftLang;
    if (isDraftEdited) {
      setPendingReplace({
        nextService: draftService,
        nextLang,
      });
      return;
    }
    applyTemplateReplacement(draftService, nextLang);
  };

  const handleCopyOutreach = async () => {
    if (!draftText.trim()) {
      setCopiedOutreach(false);
      setStatusTone("error");
      setStatusMessage(
        isEs
          ? "No hay texto para copiar en el borrador."
          : "There is no draft text to copy."
      );
      return;
    }
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(draftText);
      setCopiedOutreach(true);
      setTimeout(() => setCopiedOutreach(false), 2000);
    } catch {
      setCopiedOutreach(false);
      setStatusTone("error");
      setStatusMessage(
        isEs
          ? "No pudimos copiar el mensaje automáticamente. Selecciona el texto del recuadro y cópialo manualmente."
          : "We could not copy the message automatically. Please select the text in the box and copy it manually."
      );
    }
  };

  const handleSaveOutreachDraft = async () => {
    if (isExample) {
      setStatusTone("info");
      setStatusMessage(t("detail.exampleSaveNotice"));
      return;
    }
    if (!draftText.trim()) {
      setStatusTone("error");
      setStatusMessage(
        isEs
          ? "El borrador de contacto no puede estar vacío."
          : "The outreach draft cannot be empty."
      );
      return;
    }
    setIsBusy(true);
    setStatusMessage("");
    try {
      let targetSavedId = savedRecord?.id;
      if (!targetSavedId) {
        const createdSaved = await saveOppFn({
          data: {
            opportunity_id: opp.id,
            service_fit_inference: dynamicFitText,
            inferred_service_categories: selectedServices,
            qualification_notes: notesDraft,
            review_stage: reviewStage,
          },
        });
        targetSavedId = createdSaved?.id;
      }
      if (targetSavedId) {
        await saveOutreachFn({
          data: {
            id: targetSavedId,
            outreach_draft: draftText,
            outreach_draft_language: draftLang,
            qualification_notes: notesDraft,
            review_stage: reviewStage,
          },
        });
      }
      await router.invalidate();
      setStatusTone("info");
      setStatusMessage(
        isEs
          ? `Borrador de contacto guardado (${draftLang.toUpperCase()}).`
          : `Saved outreach draft (${draftLang.toUpperCase()}).`
      );
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(
        isEs
          ? `No pudimos guardar el borrador (${err?.message || "error"}). Tu texto se mantiene en pantalla.`
          : `Could not save outreach draft (${err?.message || "error"}). Your text remains in the editor.`
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleSave = async () => {
    if (isExample) {
      setStatusTone("info");
      setStatusMessage(t("detail.exampleSaveNotice"));
      return;
    }
    setIsBusy(true);
    setStatusMessage("");
    try {
      await saveOppFn({
        data: {
          opportunity_id: opp.id,
          service_fit_inference: dynamicFitText,
          inferred_service_categories: selectedServices,
          qualification_notes: notesDraft,
          review_stage: reviewStage,
        },
      });
      trackLeadsEvent(
        "opportunity_saved",
        {
          verification_status: opp.verification_status || "needs_review",
          action: "saved",
          surface: "opportunity_detail",
        },
        { isExample, opportunityId: opp.id }
      );
      await router.invalidate();
      setStatusTone("info");
      setStatusMessage(t("detail.savedSuccessMsg"));
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(err?.message || "Could not save lead.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleUnsave = async () => {
    if (isExample) return;
    setIsBusy(true);
    setStatusMessage("");
    try {
      await unsaveOppFn({
        data: { opportunity_id: opp.id },
      });
      await router.invalidate();
      setStatusTone("info");
      setStatusMessage(t("detail.unsavedSuccessMsg"));
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(err?.message || "Could not remove saved lead.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleUpdateSavedDetails = async (e) => {
    e.preventDefault();
    if (!savedRecord) return;
    setIsBusy(true);
    setStatusMessage("");
    try {
      await updateSavedFn({
        data: {
          id: savedRecord.id,
          review_stage: reviewStage,
          qualification_notes: notesDraft,
        },
      });
      await router.invalidate();
      setStatusTone("info");
      setStatusMessage(t("detail.notesSavedMsg"));
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(err?.message || "Could not update saved notes.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleSubmitFeedback = async ({ verdict, reason_category, reason_note }) => {
    if (isExample) {
      setStatusTone("info");
      setStatusMessage(t("detail.exampleFeedbackNotice"));
      return;
    }
    setIsBusy(true);
    setStatusMessage("");
    try {
      await feedbackFn({
        data: {
          opportunity_id: opp.id,
          business_name: opp.business_name,
          verdict,
          reason_category,
          reason_note,
        },
      });
      trackLeadsEvent(
        "relevance_feedback_recorded",
        {
          verdict,
          reason_category: reason_category || null,
          has_reason_note: Boolean(reason_note),
          verification_status: opp.verification_status || "needs_review",
          surface: "opportunity_detail",
        },
        { isExample, opportunityId: opp.id }
      );
      await router.invalidate();
      setStatusTone("info");
      setStatusMessage(
        verdict === "relevant"
          ? t("detail.feedbackRelevantMsg")
          : t("detail.feedbackNotRelevantMsg")
      );
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(err?.message || "Could not record feedback.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleClearFeedback = async () => {
    if (isExample) return;
    setIsBusy(true);
    setStatusMessage("");
    try {
      await clearFeedbackFn({
        data: { opportunity_id: opp.id },
      });
      await router.invalidate();
      setStatusTone("info");
      setStatusMessage(t("detail.feedbackClearedMsg"));
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(err?.message || "Could not clear feedback.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleSourceOpen = () => {
    trackLeadsEvent(
      "source_opened",
      {
        verification_status: opp.verification_status || "needs_review",
        recency_basis: opp.recency_basis || "unverified_date",
        surface: "opportunity_detail",
      },
      { isExample, opportunityId: opp.id }
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={backToSaved ? "/saved" : "/app"}
          search={backToSaved ? savedBackSearch : discoverBackSearch}
          className="text-xs font-medium text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring rounded px-1"
        >
          {backToSaved ? t("detail.backToSaved") : t("detail.backToDiscover")}
        </Link>
        {isExample && (
          <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-secondary text-muted-foreground border border-border">
            {t("common.exampleBadge")}
          </span>
        )}
      </div>

      {statusMessage && (
        <div
          role={statusTone === "error" ? "alert" : "status"}
          className={`p-3 rounded-md border text-xs flex items-center justify-between ${
            statusTone === "error"
              ? "bg-destructive/15 border-destructive/35 text-destructive"
              : "bg-primary/15 border-primary/30 text-foreground"
          }`}
        >
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage("")}
            className="underline font-medium ml-4 shrink-0"
          >
            {t("common.dismiss")}
          </button>
        </div>
      )}

      <div className="bg-card text-card-foreground rounded-lg border border-border p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-border pb-5">
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
              {feedbackRecord?.verdict && (
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium border ${
                    feedbackRecord.verdict === "relevant"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      : "bg-destructive/15 text-destructive border-destructive/30"
                  }`}
                >
                  {feedbackRecord.verdict === "relevant"
                    ? t("card.ratedRelevant")
                    : t("card.RatedNotRelevant")}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground break-words">
              {opp.business_name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{opp.location}</span>
              {categoryLabel && <span>· {categoryLabel}</span>}
              {opp.website_url ? (
                <a
                  href={safePublicUrl(opp.website_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline font-medium break-all"
                >
                  {opp.website_url}
                </a>
              ) : (
                <span className="text-muted-foreground/80">{t("common.websiteUnknown")}</span>
              )}
              {opp.public_email && (
                <a
                  href={`mailto:${opp.public_email}`}
                  className="text-primary hover:underline font-medium break-all"
                >
                  {opp.public_email}
                </a>
              )}
              {opp.public_phone && (
                <a
                  href={`tel:${opp.public_phone}`}
                  className="text-primary hover:underline font-medium"
                >
                  {opp.public_phone}
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isSavedLive ? (
              <>
                <span className="px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  {t("detail.savedBadge")}
                </span>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={handleUnsave}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-card text-foreground border border-border hover:bg-destructive/15 hover:text-destructive hover:border-destructive/30 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {t("detail.unsaveBtn")}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={isBusy}
                onClick={handleSave}
                className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {t("detail.saveLeadBtn")}
              </button>
            )}
          </div>
        </div>

        {/* Verified Facts & Sources — preserves original excerpt language */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            {t("detail.evidenceSectionTitle", { count: evidenceList.length })}
          </h2>
          <p className="text-sm text-foreground/90 leading-relaxed">{summaryText}</p>

          {verificationNotesText && (
            <div
              className={`p-3 rounded-md border text-xs space-y-1.5 ${
                isVerified
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
                  : "bg-amber-500/10 border-amber-500/35 text-amber-900 dark:text-amber-200"
              }`}
            >
              <div>
                <strong>{t("detail.verificationStatusLabel")}</strong> {verificationNotesText}
              </div>
              <div className="font-mono text-[11px] opacity-90">
                {sourceDetails.lastCheckedLabel}
              </div>
              {sourceDetails.alternativeSummary && (
                <div className="pt-1 border-t border-emerald-500/30 text-[11px]">
                  {sourceDetails.alternativeSummary}
                </div>
              )}
              {sourceDetails.localSummary && (
                <div className="pt-1 border-t border-border/60 text-[11px]">
                  {sourceDetails.localSummary}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            {evidenceList.map((ev, idx) => {
              const supportTranslation = getExcerptSupportTranslation(
                { ...opp, supporting_excerpt: ev.supporting_excerpt },
                lang
              );
              return (
                <div
                  key={ev.id || idx}
                  className="bg-secondary/50 rounded-md border border-border p-4 space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <span className="font-medium text-foreground break-words">
                      {ev.source_title}
                    </span>
                    <a
                      href={safePublicUrl(ev.source_url)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={handleSourceOpen}
                      className="text-primary hover:underline font-medium shrink-0"
                    >
                      {t("detail.openSourceLink")}
                    </a>
                  </div>
                  <div className="space-y-1.5">
                    <span className="inline-block text-[10px] font-mono text-muted-foreground">
                      {formatOriginalExcerptBadge(ev.supporting_excerpt, lang)}
                    </span>
                    <blockquote className="text-xs italic text-muted-foreground border-l-2 border-primary/50 pl-3 py-0.5 break-words">
                      {ev.supporting_excerpt}
                    </blockquote>
                    {supportTranslation && (
                      <div className="rounded bg-card/70 border border-border/70 px-2.5 py-1.5 space-y-0.5">
                        <span className="block text-[10px] font-mono text-primary">
                          {t("common.optionalTranslationBadge")}
                        </span>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {supportTranslation}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 text-[11px] font-mono text-muted-foreground pt-1">
                    <span>
                      {t("common.published")}: {formatDateValue(ev.publication_date, lang)}
                    </span>
                    <span>
                      {t("common.eventDate")}: {formatDateValue(ev.event_date, lang)}
                    </span>
                    <span>
                      {t("common.retrieved")}:{" "}
                      {ev.retrieval_date
                        ? String(ev.retrieval_date).replace("T", " ").slice(0, 16) + " UTC"
                        : t("common.notStated")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Evidence & Relevance Analyst Agent */}
        <div className="pt-4 border-t border-border">
          {profile?.enable_evidence_analyst !== false ? (
            <AgentChatPanel
              agentName="evidence_analyst"
              badgeLabel={t("detail.agentBadge")}
              title={t("detail.agentTitle")}
              subtitle={t("detail.agentSubtitle")}
              conversationTitle={`Evidence Analysis: ${opp.business_name}`}
              contextPreamble={`Preferred UI response language: ${lang === "es" ? "Spanish (Español)" : "English"}. Preferred outreach draft language (kept separate from UI): ${outreachLang === "es" ? "Spanish (Español)" : "English"}. Opportunity ID: ${opp.id}. Business: ${opp.business_name} (${opp.business_category || "Uncategorized"}) in ${opp.location}. Signal: ${opp.signal_type} — ${opp.signal_summary}. Verification status: ${opp.verification_status} (${opp.verification_notes || "no notes"}). Recency basis: ${opp.recency_basis}. User services: ${
                selectedServices.length > 0 ? selectedServices.join(", ") : "Not configured"
              }. Evidence items: ${JSON.stringify(
                evidenceList.map((e) => ({
                  source_title: e.source_title,
                  source_url: e.source_url,
                  supporting_excerpt: e.supporting_excerpt,
                  publication_date: e.publication_date,
                  event_date: e.event_date,
                  retrieval_date: e.retrieval_date,
                  verification_status: e.verification_status,
                  evidence_status: e.evidence_status,
                }))
              )}`}
              starterPrompts={[
                {
                  label: t("detail.agentPrompt1Label"),
                  prompt: `Interpret the EvidenceItem data for ${opp.business_name} and summarize why this opportunity is relevant to my services, separating verified facts from hypotheses.`,
                },
                {
                  label: t("detail.agentPrompt2Label"),
                  prompt: `Break down the publication_date, event_date, retrieval_date, and verification_status for ${opp.business_name}. What is confirmed and what still needs manual verification?`,
                },
                {
                  label: t("detail.agentPrompt3Label"),
                  prompt: `Based strictly on the verified EvidenceItem excerpt for ${opp.business_name}, suggest a concise, factual outreach angle in ${outreachLang === "es" ? "Spanish" : "English"} tailored to my services without overclaiming.`,
                },
              ]}
              placeholder={t("detail.agentPlaceholder", { name: opp.business_name })}
            />
          ) : (
            <div className="bg-secondary/40 rounded-lg border border-border px-4 py-2.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {lang === "es"
                  ? "El Analista de Evidencia y Relevancia está desactivado."
                  : "Evidence & Relevance Analyst AI agent is currently disabled."}
              </span>
              <Link to="/agent-settings" className="text-primary hover:underline font-medium">
                {lang === "es" ? "Activar en Ajustes de agentes" : "Enable in Agent Settings"}
              </Link>
            </div>
          )}
        </div>

        {/* Possible Service Fit (Hypothesis) */}
        <section className="space-y-2 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              {t("detail.possibleServiceFitTitle")}
            </h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-primary/15 text-primary border border-primary/30">
              {t("common.hypothesisBadge")}
            </span>
          </div>

          <div className="bg-accent/60 border border-primary/25 rounded-md p-4 space-y-2">
            {selectedServices.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">{t("detail.matchedAgainstServices")}</span>
                {selectedServices.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 rounded bg-card border border-border text-foreground font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
              {dynamicFitText}
            </p>
          </div>
        </section>

        {/* Evidence-Grounded Outreach Draft (Outreach Language Separate from UI Language) */}
        <section className="space-y-3 pt-4 border-t border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {t("detail.outreachSectionTitle")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("detail.outreachSectionSub")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">{t("common.outreachLangLabel")}:</span>
              <div
                role="group"
                aria-label={t("common.outreachLangLabel")}
                className="inline-flex rounded-md border border-border bg-secondary p-0.5 text-xs"
              >
                {[
                  { code: "en", label: "EN · English" },
                  { code: "es", label: "ES · Español" },
                ].map((opt) => {
                  const active = draftLang === opt.code;
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => handleRequestTemplateUpdate(opt.code)}
                      aria-pressed={active}
                      className={`px-2.5 py-1 rounded-sm font-mono text-[11px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {selectedServices.length > 0 && (
            <div className="space-y-1.5">
              <label
                htmlFor="detail-outreach-service"
                className="block text-xs font-semibold text-foreground"
              >
                {isEs ? "Servicio que quieres ofrecer" : "Service to introduce"}
              </label>
              <select
                id="detail-outreach-service"
                value={draftService}
                onChange={handleServiceChange}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {selectedServices.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </div>
          )}

          {pendingReplace && (
            <div
              role="alert"
              className="p-3 rounded-md bg-amber-500/15 border border-amber-500/40 text-xs space-y-2"
            >
              <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  {isEs
                    ? `Has editado este borrador. ¿Quieres reemplazar tu texto con una plantilla nueva en ${pendingReplace.nextLang.toUpperCase()}${
                        pendingReplace.nextService ? ` para "${pendingReplace.nextService}"` : ""
                      }?`
                    : `You have edited this draft. Replace your text with a new ${pendingReplace.nextLang.toUpperCase()} template${
                        pendingReplace.nextService ? ` for "${pendingReplace.nextService}"` : ""
                      }?`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 pl-6">
                <button
                  type="button"
                  onClick={() =>
                    applyTemplateReplacement(
                      pendingReplace.nextService,
                      pendingReplace.nextLang
                    )
                  }
                  className="px-2.5 py-1 rounded text-xs font-medium bg-primary text-primary-foreground"
                >
                  {isEs ? "Reemplazar mi texto" : "Replace my text"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (pendingReplace.nextLang !== draftLang) {
                      setDraftLang(pendingReplace.nextLang);
                      setOutreachLang(pendingReplace.nextLang);
                    }
                    setPendingReplace(null);
                  }}
                  className="px-2.5 py-1 rounded text-xs font-medium bg-card text-foreground border border-border"
                >
                  {isEs ? "Conservar mi texto" : "Keep my text"}
                </button>
              </div>
            </div>
          )}

          <div className="bg-secondary/50 border border-border rounded-md p-3.5 space-y-2.5">
            <textarea
              aria-label={t("detail.outreachSectionTitle")}
              rows={6}
              maxLength={4000}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              className="w-full p-3 rounded-md border border-input bg-card font-body text-xs text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleRequestTemplateUpdate(draftLang)}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium text-primary hover:bg-primary/10 border border-primary/25"
              >
                {isEs ? "Actualizar plantilla" : "Update template"}
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyOutreach}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-card border border-border text-foreground hover:bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {copiedOutreach ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      {t("detail.copiedOutreachMsg")}
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      {t("detail.copyOutreachBtn")}
                    </>
                  )}
                </button>
                {!isExample && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={handleSaveOutreachDraft}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isEs ? "Guardar borrador" : "Save draft"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Private Qualification Notes (when saved) */}
        {!isExample && isSavedLive && (
          <section className="space-y-2 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                {t("detail.savedStageNotesTitle")}
              </h2>
              <Link
                to="/saved"
                className="text-xs font-medium text-primary hover:underline"
              >
                {t("detail.viewAllSavedLink")}
              </Link>
            </div>

            <form
              onSubmit={handleUpdateSavedDetails}
              className="bg-secondary/50 rounded-md border border-border p-4 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="detail-review-stage"
                    className="block text-xs font-medium text-foreground mb-1"
                  >
                    {t("detail.reviewStageLabel")}
                  </label>
                  <select
                    id="detail-review-stage"
                    value={reviewStage}
                    disabled={isBusy}
                    onChange={(e) => setReviewStage(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-md border border-input text-xs font-medium text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="saved">{t("saved.stages.saved")}</option>
                    <option value="researching">{t("saved.stages.researching")}</option>
                    <option value="qualified">{t("saved.stages.qualified")}</option>
                    <option value="archived">{t("saved.stages.archived")}</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="detail-qualification-notes"
                    className="block text-xs font-medium text-foreground mb-1"
                  >
                    {t("detail.privateNotesLabel")}
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="detail-qualification-notes"
                      type="text"
                      maxLength={1000}
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      placeholder={t("detail.privateNotesPlaceholder")}
                      className="flex-1 h-9 px-3 rounded-md border border-input bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="submit"
                      disabled={isBusy}
                      className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {t("detail.saveNotesBtn")}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </section>
        )}

        {/* Relevance Feedback Panel */}
        <RelevanceFeedbackPanel
          feedbackRecord={feedbackRecord}
          isExample={isExample}
          isBusy={isBusy}
          onSubmitFeedback={handleSubmitFeedback}
          onClearFeedback={handleClearFeedback}
        />
      </div>
    </div>
  );
}