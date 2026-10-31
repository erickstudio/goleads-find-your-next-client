import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BookmarkCheck,
  Compass,
  ExternalLink,
  MapPin,
  Calendar,
  Trash2,
  FileText,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import {
  getWorkspaceBootstrap,
  updateSavedOpportunityItem,
  deleteSavedOpportunityItem,
} from "@/lib/server-fns";

export const Route = createFileRoute("/_authed/saved")({
  ssr: false,
  loader: () => getWorkspaceBootstrap(),
  head: () => ({
    meta: [
      { title: "Saved Opportunities — Leads AI" },
      { name: "description", content: "Review your saved client opportunities and source evidence." },
    ],
  }),
  component: SavedOpportunitiesScreen,
});

function SavedOpportunitiesScreen() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const updateSavedFn = useServerFn(updateSavedOpportunityItem);
  const deleteSavedFn = useServerFn(deleteSavedOpportunityItem);

  const savedList = data?.savedOpportunities || [];
  const feedbackList = data?.feedbackRecords || [];
  const [busyId, setBusyId] = useState(null);

  const handleStageChange = async (id, review_stage) => {
    setBusyId(id);
    try {
      await updateSavedFn({ data: { id, review_stage } });
      await router.invalidate();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id) => {
    setBusyId(id);
    try {
      await deleteSavedFn({ data: { id } });
      await router.invalidate();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Session-Owned Private Records
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Saved Opportunities
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Review growing businesses you have saved for qualification. Isolated demo fixtures are excluded from this live list.
          </p>
        </div>

        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shrink-0"
        >
          <Compass className="w-3.5 h-3.5" />
          Back to Discover
        </Link>
      </div>

      {savedList.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 sm:p-10 text-center space-y-3">
          <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <BookmarkCheck className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900">No Live Saved Opportunities Yet</h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            No fake leads are seeded into your live workspace. Once live discovery is enabled and you bookmark verified opportunities, they will appear here with full source evidence and qualification stages.
          </p>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
            >
              <Compass className="w-3.5 h-3.5" />
              Open Discover Screen
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {savedList.map((item) => (
            <article
              key={item.id}
              className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-2xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                      {item.signal_type}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Evidence: {item.evidence_status || "verified_excerpt"}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{item.business_name}</h3>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {item.location}
                    </span>
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
                    >
                      {item.source_title || "Primary Source"}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Review Stage"
                    value={item.review_stage || "saved"}
                    disabled={busyId === item.id}
                    onChange={(e) => handleStageChange(item.id, e.target.value)}
                    className="h-8 px-2.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
                  >
                    <option value="saved">Stage: Saved</option>
                    <option value="researching">Stage: Researching</option>
                    <option value="qualified">Stage: Qualified</option>
                    <option value="archived">Stage: Archived</option>
                  </select>

                  <Link
                    to="/opportunities/$opportunityId"
                    params={{ opportunityId: item.opportunity_id }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Details
                  </Link>

                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => handleDelete(item.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-red-700 hover:bg-red-50"
                    title="Remove from Saved"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/80 space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    Supporting Excerpt (Verified Fact)
                  </div>
                  <blockquote className="text-xs italic text-slate-700 border-l-2 border-blue-600 pl-2.5">
                    {item.supporting_excerpt}
                  </blockquote>
                  <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 pt-1">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Published: {item.publication_date || "Not stated"}
                    </span>
                    <span>Retrieved: {item.retrieval_date}</span>
                  </div>
                </div>

                <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-200/70 space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-600" />
                    Service Fit (Inference)
                  </div>
                  <p className="text-xs text-slate-700">{item.service_fit_inference}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Dismissed / Feedback Log */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Dismissed / Not Relevant Feedback Log ({feedbackList.length})
        </h2>
        {feedbackList.length === 0 ? (
          <p className="text-xs text-slate-500">
            No opportunities have been marked as Not Relevant in your live workspace yet.
          </p>
        ) : (
          <div className="space-y-2">
            {feedbackList.map((fb) => (
              <div
                key={fb.id}
                className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-200"
              >
                <div>
                  <span className="font-semibold text-slate-800">{fb.business_name}</span>
                  {fb.reason_note && <span className="text-slate-500"> — {fb.reason_note}</span>}
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-medium text-[11px]">
                  {fb.verdict}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}