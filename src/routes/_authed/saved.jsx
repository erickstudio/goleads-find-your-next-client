import { useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { formatRecencyBasisLabel } from "@/lib/leads-constants";
import {
  getWorkspaceBootstrap,
  updateSavedOpportunityItem,
  deleteSavedOpportunityItem,
} from "@/lib/server-fns";
import { trackLeadsEvent } from "@/lib/telemetry";

const STAGES = [
  { id: "all", label: "All saved" },
  { id: "saved", label: "Saved" },
  { id: "researching", label: "Researching" },
  { id: "qualified", label: "Qualified" },
  { id: "archived", label: "Archived" },
];

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
      { title: "Saved leads — Leads AI" },
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

  const updateSavedFn = useServerFn(updateSavedOpportunityItem);
  const deleteSavedFn = useServerFn(deleteSavedOpportunityItem);

  const savedList = data?.savedOpportunities || [];
  const feedbackByOppId = new Map(
    (data?.feedbackRecords || []).map((f) => [f.opportunity_id, f])
  );

  const stageFilter = searchParams.stage || "all";
  const [busyId, setBusyId] = useState(null);
  const [editingNotesById, setEditingNotesById] = useState({});
  const [banner, setBanner] = useState("");

  const filteredList =
    stageFilter === "all"
      ? savedList
      : savedList.filter((item) => (item.review_stage || "saved") === stageFilter);

  const handleSelectStageFilter = (nextStage) => {
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
      setBanner("Updated lead review stage.");
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
      setBanner(`Saved notes for "${item.business_name}".`);
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
      setBanner(`Removed "${item.business_name}" from Saved leads.`);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Saved leads ({savedList.length})
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Businesses you have bookmarked with their original evidence, dates, verification status, and private notes.
          </p>
        </div>

        <Link
          to="/"
          className="px-3.5 py-2 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 shrink-0 text-center"
        >
          Find leads
        </Link>
      </div>

      {/* Stage Filter Bar */}
      {savedList.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {STAGES.map((st) => {
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
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
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
          className="px-4 py-2.5 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center justify-between"
        >
          <span>{banner}</span>
          <button
            type="button"
            onClick={() => setBanner("")}
            className="text-blue-700 hover:underline font-medium ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {filteredList.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">
            {savedList.length === 0
              ? "No saved leads yet"
              : `No saved leads in "${stageFilter}" stage`}
          </h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            {savedList.length === 0
              ? "When you save opportunities from your search results, they appear here with their original sources, dates, verification status, and private notes."
              : "Switch stage filters above to view your other saved opportunities."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredList.map((item) => {
            const isVerified = item.verification_status === "verified";
            const recencyLabel = formatRecencyBasisLabel(item.recency_basis);
            const fb = feedbackByOppId.get(item.opportunity_id);
            const noteVal =
              editingNotesById[item.id] !== undefined
                ? editingNotesById[item.id]
                : item.qualification_notes || "";

            return (
              <article
                key={item.id}
                className="bg-white rounded-lg border border-slate-200 p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
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
                        {item.signal_type}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 border border-slate-200">
                        {recencyLabel}
                      </span>
                      {fb?.verdict && (
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium border ${
                            fb.verdict === "relevant"
                              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                              : "bg-red-50 text-red-900 border-red-200"
                          }`}
                        >
                          {fb.verdict === "relevant" ? "Rated relevant" : "Rated not relevant"}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-semibold text-slate-900">
                      {item.business_name}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                      <span>{item.location}</span>
                      {item.business_category && <span>· {item.business_category}</span>}
                      <span>·</span>
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => handleSourceOpen(item)}
                        className="text-blue-700 hover:underline font-medium"
                      >
                        {item.source_title || "Open original source"}
                      </a>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                      search={{
                        from: "saved",
                        stage: stageFilter !== "all" ? stageFilter : undefined,
                      }}
                      className="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-900 text-white hover:bg-slate-800"
                    >
                      View evidence & details
                    </Link>

                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => handleDelete(item)}
                      className="px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-500 hover:text-red-700 hover:bg-red-50"
                    >
                      Unsave
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div className="bg-slate-50 rounded-md p-3 border border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">Original evidence & dates</span>
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => handleSourceOpen(item)}
                        className="text-blue-700 hover:underline font-medium"
                      >
                        Source link ↗
                      </a>
                    </div>
                    {item.signal_summary && (
                      <p className="text-xs text-slate-700">{item.signal_summary}</p>
                    )}
                    <blockquote className="text-xs italic text-slate-600 border-l-2 border-slate-300 pl-2.5">
                      {item.supporting_excerpt}
                    </blockquote>
                    <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 pt-1">
                      <span>Published: {item.publication_date || "Not stated"}</span>
                      <span>Event date: {item.event_date || "Not stated"}</span>
                      <span>
                        Retrieved:{" "}
                        {item.retrieval_date
                          ? String(item.retrieval_date).replace("T", " ").slice(0, 16) + " UTC"
                          : "Not stated"}
                      </span>
                    </div>
                    {item.verification_notes && (
                      <p
                        className={`text-[11px] pt-0.5 ${
                          isVerified ? "text-emerald-800" : "text-amber-900 font-medium"
                        }`}
                      >
                        {item.verification_notes}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="bg-blue-50/40 rounded-md p-3 border border-blue-200/70 space-y-1">
                      <div className="text-xs font-medium text-blue-950">
                        Possible service fit (Hypothesis)
                      </div>
                      <p className="text-xs text-slate-700">{item.service_fit_inference}</p>
                    </div>

                    <div className="bg-slate-50 rounded-md p-3 border border-slate-200/80 space-y-1.5">
                      <label
                        htmlFor={`notes-${item.id}`}
                        className="block text-xs font-medium text-slate-800"
                      >
                        Private qualification notes
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
                          placeholder="Add private research notes…"
                          className="flex-1 h-8 px-2.5 rounded border border-slate-300 bg-white text-xs text-slate-900"
                        />
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => handleSaveNotes(item)}
                          className="px-3 py-1 rounded text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 shrink-0"
                        >
                          Save note
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