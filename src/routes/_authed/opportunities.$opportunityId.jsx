import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  EXAMPLE_OPPORTUNITIES,
  normalizeServicesList,
  buildServiceFitHypothesis,
} from "@/lib/leads-constants";
import {
  getOpportunityDetail,
  saveOpportunityForUser,
  recordOpportunityFeedback,
} from "@/lib/server-fns";

export const Route = createFileRoute("/_authed/opportunities/$opportunityId")({
  ssr: false,
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
  const detailData = Route.useLoaderData();
  const router = useRouter();

  const saveOppFn = useServerFn(saveOpportunityForUser);
  const feedbackFn = useServerFn(recordOpportunityFeedback);

  const exampleOpp = EXAMPLE_OPPORTUNITIES.find((item) => item.id === opportunityId);
  const isExample = Boolean(detailData?.isExample || exampleOpp);
  const opp = detailData?.opportunity || exampleOpp;

  const profile = detailData?.profile;
  const selectedServices = normalizeServicesList(profile?.selected_services || []);
  const serviceDescription = profile?.service_description || "";

  const [statusMessage, setStatusMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  if (!opp) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-lg border border-slate-200 p-6 text-center space-y-3">
        <h1 className="text-lg font-semibold text-slate-900">Opportunity not found</h1>
        <p className="text-xs text-slate-600">
          This record does not exist or belongs to another account.
        </p>
        <Link
          to="/"
          className="inline-block px-3.5 py-2 rounded-md text-xs font-medium bg-blue-600 text-white"
        >
          Back to Find leads
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
            evidence_status: opp.evidence_status,
          },
        ];

  const isSavedLive = Boolean(detailData?.savedRecord);
  const isFeedbackLive = Boolean(detailData?.feedbackRecord);
  const dynamicFitText = buildServiceFitHypothesis(opp, selectedServices, serviceDescription);

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
          business_name: opp.business_name,
          business_category: opp.business_category || "",
          location: opp.location,
          website_url: opp.website_url || null,
          signal_type: opp.signal_type,
          signal_summary: opp.signal_summary || "",
          source_title: opp.source_title,
          source_url: opp.source_url,
          supporting_excerpt: opp.supporting_excerpt,
          publication_date: opp.publication_date || null,
          event_date: opp.event_date || null,
          retrieval_date: opp.retrieval_date,
          evidence_status: opp.evidence_status,
          service_fit_inference: dynamicFitText,
          inferred_service_categories: selectedServices,
        },
      });
      await router.invalidate();
      setStatusMessage("Saved to your leads list.");
    } catch (err) {
      setStatusMessage(err?.message || "Could not save lead.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleMarkNotRelevant = async () => {
    if (isExample) {
      setStatusMessage("Example result dismissed for this preview.");
      return;
    }
    setIsBusy(true);
    setStatusMessage("");
    try {
      await feedbackFn({
        data: {
          opportunity_id: opp.id,
          business_name: opp.business_name,
          verdict: "not_relevant",
          reason_note: "Marked not relevant from details view",
        },
      });
      await router.invalidate();
      setStatusMessage("Marked as not relevant.");
    } catch (err) {
      setStatusMessage(err?.message || "Could not record feedback.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/"
          className="text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          ← Back to Find leads
        </Link>
        {isExample && (
          <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            Example result
          </span>
        )}
      </div>

      {statusMessage && (
        <div className="p-3 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-900">
          {statusMessage}
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">
                {opp.signal_type}
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">
                {opp.evidence_status}
              </span>
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
                <span className="text-slate-500">Website not listed in source</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isBusy}
              onClick={handleSave}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                isSavedLive
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
              }`}
            >
              {isSavedLive ? "Saved" : "Save lead"}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={handleMarkNotRelevant}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                isFeedbackLive
                  ? "bg-red-50 text-red-800 border-red-200"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {isFeedbackLive ? "Not relevant" : "Mark not relevant"}
            </button>
          </div>
        </div>

        {/* Verified Facts & Sources */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Verified opening / expansion sources ({evidenceList.length})
          </h2>
          <p className="text-sm text-slate-700">{opp.signal_summary}</p>

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
                  <span>Retrieved: {ev.retrieval_date}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Possible Service Fit (Inference) */}
        <section className="space-y-2 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Possible service fit
            </h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200">
              Inference
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
      </div>
    </div>
  );
}