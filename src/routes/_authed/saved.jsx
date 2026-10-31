import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
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
      { title: "Saved leads — Leads AI" },
      { name: "description", content: "Review your saved leads and notes." },
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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Saved leads
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Businesses you have bookmarked to review and qualify.
          </p>
        </div>

        <Link
          to="/"
          className="px-3.5 py-2 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 shrink-0"
        >
          Find leads
        </Link>
      </div>

      {savedList.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">No saved leads yet</h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            When you save opportunities from your search results, they will appear here with their sources and notes.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {savedList.map((item) => (
            <article
              key={item.id}
              className="bg-white rounded-lg border border-slate-200 p-5 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">
                      {item.signal_type}
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">
                      {item.evidence_status || "Verified excerpt"}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {item.business_name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <span>{item.location}</span>
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-700 hover:underline font-medium"
                    >
                      {item.source_title || "View source"}
                    </a>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Review stage"
                    value={item.review_stage || "saved"}
                    disabled={busyId === item.id}
                    onChange={(e) => handleStageChange(item.id, e.target.value)}
                    className="h-8 px-2.5 rounded-md border border-slate-300 text-xs font-medium text-slate-800 bg-white"
                  >
                    <option value="saved">Saved</option>
                    <option value="researching">Researching</option>
                    <option value="qualified">Qualified</option>
                    <option value="archived">Archived</option>
                  </select>

                  <Link
                    to="/opportunities/$opportunityId"
                    params={{ opportunityId: item.opportunity_id }}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-900 text-white hover:bg-slate-800"
                  >
                    Details
                  </Link>

                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => handleDelete(item.id)}
                    className="px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-500 hover:text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div className="bg-slate-50 rounded-md p-3 border border-slate-200/80 space-y-1">
                  <div className="text-xs font-medium text-slate-800">Supporting excerpt</div>
                  <blockquote className="text-xs italic text-slate-600 border-l-2 border-slate-300 pl-2.5">
                    {item.supporting_excerpt}
                  </blockquote>
                </div>
                <div className="bg-blue-50/40 rounded-md p-3 border border-blue-200/70 space-y-1">
                  <div className="text-xs font-medium text-blue-950">Possible service fit (Inference)</div>
                  <p className="text-xs text-slate-700">{item.service_fit_inference}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}