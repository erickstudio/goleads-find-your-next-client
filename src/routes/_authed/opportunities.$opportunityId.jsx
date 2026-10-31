import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ExternalLink,
  Calendar,
  MapPin,
  Globe,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Bookmark,
  XCircle,
  ShieldCheck,
} from "lucide-react";
import { DEMO_FIXTURE_OPPORTUNITIES, SERVICE_CATEGORIES } from "@/lib/leads-constants";
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
      { title: "Opportunity Details — Leads AI" },
      { name: "description", content: "Inspect verified expansion sources and commercial hypotheses." },
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

  const demoOpp = DEMO_FIXTURE_OPPORTUNITIES.find((item) => item.id === opportunityId);
  const isDemo = Boolean(detailData?.isDemo || demoOpp);
  const opp = detailData?.opportunity || demoOpp;

  const [demoSaved, setDemoSaved] = useState(false);
  const [demoDismissed, setDemoDismissed] = useState(false);
  const [actionStatus, setActionStatus] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  if (!opp) {
    return (
      <div className="max-w-3xl mx-auto bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4">
        <h1 className="text-xl font-bold text-slate-900">Opportunity Not Found</h1>
        <p className="text-xs text-slate-600">
          This opportunity either does not exist or belongs to another account. All private opportunity reads enforce server-side session ownership.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Return to Discover
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

  const handleSave = async () => {
    if (isDemo) {
      setDemoSaved((prev) => !prev);
      setActionStatus(
        "Demo Fixture toggled locally. Isolated demo fixtures are never written to your live Saved Opportunities database."
      );
      return;
    }
    setIsBusy(true);
    setActionStatus("");
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
          service_fit_inference: opp.service_fit_inference,
          inferred_service_categories: opp.inferred_service_categories || [],
        },
      });
      await router.invalidate();
      setActionStatus("Opportunity saved to your private workspace.");
    } catch (err) {
      setActionStatus(err?.message || "Could not save opportunity.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleMarkNotRelevant = async () => {
    if (isDemo) {
      setDemoDismissed(true);
      setActionStatus(
        "Marked Not Relevant in Demo Mode (local only — excluded from live feedback metrics)."
      );
      return;
    }
    setIsBusy(true);
    setActionStatus("");
    try {
      await feedbackFn({
        data: {
          opportunity_id: opp.id,
          business_name: opp.business_name,
          verdict: "not_relevant",
          reason_note: "Marked not relevant from Opportunity Details",
        },
      });
      await router.invalidate();
      setActionStatus("Recorded feedback: Marked as Not Relevant.");
    } catch (err) {
      setActionStatus(err?.message || "Could not record feedback.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Discover
        </Link>

        {isDemo && (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-900 border border-purple-300">
            Isolated Demo Fixture · Excluded from Live Metrics
          </span>
        )}
      </div>

      {actionStatus && (
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 font-medium">
          {actionStatus}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 space-y-8 shadow-2xs">
        {/* Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                {opp.signal_type}
              </span>
              <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                Evidence Status: {opp.evidence_status}
              </span>
              {opp.business_category && (
                <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                  {opp.business_category}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {opp.business_name}
            </h1>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-slate-400" />
                {opp.location}
              </span>
              {opp.website_url ? (
                <a
                  href={opp.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
                >
                  <Globe className="w-4 h-4" />
                  {opp.website_url}
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="text-amber-700 font-medium">
                  Website: Unknown / Not cited in public sources
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              disabled={isBusy}
              onClick={handleSave}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                isSavedLive || demoSaved
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              {isSavedLive || demoSaved ? "Saved" : "Save Opportunity"}
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={handleMarkNotRelevant}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                isFeedbackLive || demoDismissed
                  ? "bg-red-50 text-red-800 border-red-300"
                  : "bg-white text-slate-600 border-slate-200 hover:text-red-700 hover:bg-red-50"
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              {isFeedbackLive || demoDismissed ? "Marked Not Relevant" : "Not Relevant"}
            </button>
          </div>
        </div>

        {/* Section 1: Verified Facts & Supporting Sources */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              1. Verified Opening / Expansion Facts & Supporting Sources ({evidenceList.length})
            </h2>
            <span className="text-[11px] text-slate-500">Discovery date ≠ opening date</span>
          </div>

          <p className="text-sm text-slate-800 font-medium leading-relaxed">{opp.signal_summary}</p>

          <div className="space-y-3">
            {evidenceList.map((ev, i) => (
              <div
                key={ev.id || i}
                className="bg-slate-50/90 rounded-xl border border-slate-200 p-4 sm:p-5 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="font-semibold text-sm text-slate-900">{ev.source_title}</div>
                  <a
                    href={ev.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline shrink-0"
                  >
                    Inspect Source URL
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <blockquote className="text-xs sm:text-sm italic text-slate-700 border-l-2 border-blue-600 pl-3.5 py-1 bg-white/80 rounded-r-md">
                  {ev.supporting_excerpt}
                </blockquote>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/70 text-xs text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Publication Date
                    </span>
                    <span className="font-medium text-slate-800">
                      {ev.publication_date || "Not stated in source"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Opening / Event Date
                    </span>
                    <span className="font-medium text-slate-800">
                      {ev.event_date || "Not stated in source"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Retrieval Date
                    </span>
                    <span className="font-medium text-slate-800">{ev.retrieval_date}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Evidence Status
                    </span>
                    <span className="font-semibold text-emerald-800">{ev.evidence_status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Clearly Labeled Service Fit Inference */}
        <section className="space-y-4 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-blue-950 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              2. Possible Service Fit (Commercial Hypothesis — Not a Verified Fact)
            </h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase bg-blue-100 text-blue-900">
              Inference Only
            </span>
          </div>

          <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-5 space-y-4">
            {opp.inferred_service_categories?.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-blue-900">Relevant Service Categories:</span>
                {opp.inferred_service_categories.map((catId) => {
                  const found = SERVICE_CATEGORIES.find((c) => c.id === catId);
                  return (
                    <span
                      key={catId}
                      className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-white text-blue-800 border border-blue-200"
                    >
                      {found ? found.label : catId}
                    </span>
                  );
                })}
              </div>
            )}

            <p className="text-sm text-slate-800 leading-relaxed">{opp.service_fit_inference}</p>

            <div className="bg-white/90 rounded-lg border border-blue-200/80 p-3.5 flex items-start gap-2.5 text-xs text-slate-600">
              <AlertCircle className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-slate-900">
                  Required Epistemic Boundary
                </div>
                <p>
                  Opening or expanding a business does <strong>not</strong> prove purchase intent, available budget, technical problems, or an active need for web design/SEO, e-commerce, or automation/CRM services.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}