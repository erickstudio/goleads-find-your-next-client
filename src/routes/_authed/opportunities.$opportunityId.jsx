import { useState, useEffect } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import RelevanceFeedbackPanel from "@/components/RelevanceFeedbackPanel";
import {
  EXAMPLE_OPPORTUNITIES,
  normalizeServicesList,
  buildServiceFitHypothesis,
  formatRecencyBasisLabel,
} from "@/lib/leads-constants";
import {
  getOpportunityDetail,
  saveOpportunityForUser,
  unsaveOpportunityForUser,
  updateSavedOpportunityItem,
  recordOpportunityFeedback,
  clearOpportunityFeedback,
} from "@/lib/server-fns";
import { trackLeadsEvent } from "@/lib/telemetry";

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
      { title: "Opportunity details — Leads AI" },
      { name: "description", content: "Inspect verified expansion sources and service-fit hypotheses." },
    ],
  }),
  component: OpportunityDetailScreen,
});

function OpportunityDetailScreen() {
  const { opportunityId } = Route.useParams();
  const navSearch = Route.useSearch();
  const detailData = Route.useLoaderData();
  const router = useRouter();

  const saveOppFn = useServerFn(saveOpportunityForUser);
  const unsaveOppFn = useServerFn(unsaveOpportunityForUser);
  const updateSavedFn = useServerFn(updateSavedOpportunityItem);
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
  const [isBusy, setIsBusy] = useState(false);
  const [notesDraft, setNotesDraft] = useState(savedRecord?.qualification_notes || "");
  const [reviewStage, setReviewStage] = useState(savedRecord?.review_stage || "saved");

  useEffect(() => {
    setNotesDraft(savedRecord?.qualification_notes || "");
    setReviewStage(savedRecord?.review_stage || "saved");
  }, [savedRecord?.id, savedRecord?.qualification_notes, savedRecord?.review_stage]);

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
      <div className="max-w-2xl mx-auto bg-white rounded-lg border border-slate-200 p-6 text-center space-y-3">
        <h1 className="text-lg font-semibold text-slate-900">Opportunity not found</h1>
        <p className="text-xs text-slate-600">
          This record does not exist or belongs to another account.
        </p>
        <Link
          to={backToSaved ? "/saved" : "/"}
          search={backToSaved ? savedBackSearch : discoverBackSearch}
          className="inline-block px-3.5 py-2 rounded-md text-xs font-medium bg-blue-600 text-white"
        >
          {backToSaved ? "Back to Saved leads" : "Back to Find leads"}
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
  const dynamicFitText = buildServiceFitHypothesis(opp, selectedServices, serviceDescription);
  const recencyLabel = formatRecencyBasisLabel(opp.recency_basis);

  const handleSave = async () => {
    if (isExample) {
      setStatusMessage("Example results are for preview only and are not saved to your live list.");
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
      setStatusMessage("Saved to your leads list.");
    } catch (err) {
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
      setStatusMessage("Removed from Saved leads.");
    } catch (err) {
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
      setStatusMessage("Saved your qualification notes and stage.");
    } catch (err) {
      setStatusMessage(err?.message || "Could not update saved notes.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleSubmitFeedback = async ({ verdict, reason_category, reason_note }) => {
    if (isExample) {
      setStatusMessage("Example result rated for this preview only.");
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
      setStatusMessage(
        verdict === "relevant"
          ? "Saved your rating: Relevant to your services."
          : "Saved your rating: Not relevant."
      );
    } catch (err) {
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
      setStatusMessage("Cleared relevance rating.");
    } catch (err) {
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
          to={backToSaved ? "/saved" : "/"}
          search={backToSaved ? savedBackSearch : discoverBackSearch}
          className="text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          {backToSaved ? "← Back to Saved leads" : "← Back to Find leads"}
        </Link>
        {isExample && (
          <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            Example result — Not live data
          </span>
        )}
      </div>

      {statusMessage && (
        <div
          role="status"
          className="p-3 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center justify-between"
        >
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage("")}
            className="text-blue-700 hover:underline font-medium ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                  isVerified
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-amber-50 text-amber-900 border-amber-300"
                }`}
              >
                {isVerified ? "Verified" : "Needs review"}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">
                {opp.signal_type}
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 border border-slate-200">
                {recencyLabel}
              </span>
              {feedbackRecord?.verdict && (
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium border ${
                    feedbackRecord.verdict === "relevant"
                      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                      : "bg-red-50 text-red-900 border-red-200"
                  }`}
                >
                  {feedbackRecord.verdict === "relevant"
                    ? "Rated: Relevant"
                    : "Rated: Not relevant"}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              {opp.business_name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
              <span>{opp.location}</span>
              {opp.business_category && <span>· {opp.business_category}</span>}
              {opp.website_url ? (
                <a
                  href={opp.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 hover:underline font-medium"
                >
                  {opp.website_url}
                </a>
              ) : (
                <span className="text-slate-500">Website unknown</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isSavedLive ? (
              <>
                <span className="px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Saved
                </span>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={handleUnsave}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-white text-slate-700 border border-slate-300 hover:bg-red-50 hover:text-red-800 hover:border-red-200 transition-colors"
                >
                  Unsave
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={isBusy}
                onClick={handleSave}
                className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Save lead
              </button>
            )}
          </div>
        </div>

        {/* Verified Facts & Sources */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Opening / expansion evidence ({evidenceList.length})
          </h2>
          <p className="text-sm text-slate-700">{opp.signal_summary}</p>

          {opp.verification_notes && (
            <div
              className={`p-3 rounded-md border text-xs ${
                isVerified
                  ? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
                  : "bg-amber-50/70 border-amber-200 text-amber-950"
              }`}
            >
              <strong>Verification status:</strong> {opp.verification_notes}
            </div>
          )}

          <div className="space-y-3">
            {evidenceList.map((ev, idx) => (
              <div
                key={ev.id || idx}
                className="bg-slate-50 rounded-md border border-slate-200 p-4 space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                  <span className="font-medium text-slate-900">{ev.source_title}</span>
                  <a
                    href={ev.source_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={handleSourceOpen}
                    className="text-blue-700 hover:underline font-medium"
                  >
                    Open source link
                  </a>
                </div>
                <blockquote className="text-xs italic text-slate-700 border-l-2 border-slate-300 pl-3 py-0.5">
                  {ev.supporting_excerpt}
                </blockquote>
                <div className="flex flex-wrap gap-4 text-[11px] text-slate-500 pt-1">
                  <span>Published: {ev.publication_date || "Not stated"}</span>
                  <span>Event/opening date: {ev.event_date || "Not stated"}</span>
                  <span>
                    Retrieved:{" "}
                    {ev.retrieval_date
                      ? String(ev.retrieval_date).replace("T", " ").slice(0, 16) + " UTC"
                      : "Not stated"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Possible Service Fit (Hypothesis) */}
        <section className="space-y-2 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Possible service fit
            </h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
              Hypothesis
            </span>
          </div>

          <div className="bg-blue-50/50 border border-blue-200 rounded-md p-4 space-y-2">
            {selectedServices.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-600">Matched against your services:</span>
                {selectedServices.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 rounded bg-white border border-blue-200 text-slate-800 font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
              {dynamicFitText}
            </p>
          </div>
        </section>

        {/* Private Qualification Notes (when saved) */}
        {!isExample && isSavedLive && (
          <section className="space-y-2 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Saved lead stage & private notes
              </h2>
              <Link
                to="/saved"
                className="text-xs font-medium text-blue-700 hover:underline"
              >
                View all saved leads
              </Link>
            </div>

            <form
              onSubmit={handleUpdateSavedDetails}
              className="bg-slate-50 rounded-md border border-slate-200 p-4 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="detail-review-stage"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Review stage
                  </label>
                  <select
                    id="detail-review-stage"
                    value={reviewStage}
                    disabled={isBusy}
                    onChange={(e) => setReviewStage(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-md border border-slate-300 text-xs font-medium text-slate-800 bg-white"
                  >
                    <option value="saved">Saved</option>
                    <option value="researching">Researching</option>
                    <option value="qualified">Qualified</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="detail-qualification-notes"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Private research notes
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="detail-qualification-notes"
                      type="text"
                      maxLength={1000}
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      placeholder="Add private qualification notes for this lead…"
                      className="flex-1 h-9 px-3 rounded-md border border-slate-300 bg-white text-xs text-slate-900"
                    />
                    <button
                      type="submit"
                      disabled={isBusy}
                      className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 shrink-0"
                    >
                      Save notes
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </section>
        )}

        {/* Relevance Feedback Panel (Relevant / Not relevant + optional reason + update earlier rating) */}
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