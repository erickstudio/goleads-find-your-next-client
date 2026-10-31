import { Link } from "@tanstack/react-router";
import {
  buildServiceFitHypothesis,
  formatRecencyBasisLabel,
} from "@/lib/leads-constants";
import { trackLeadsEvent } from "@/lib/telemetry";

export default function OpportunityCard({
  opp,
  selectedServices = [],
  serviceDescription = "",
  isExample = false,
  isSaved = false,
  isDismissed = false,
  feedbackVerdict = null,
  isBusy = false,
  detailSearchParams = {},
  onSave,
  onUnsave,
  onDismiss,
  onRestore,
}) {
  const isVerified = opp.verification_status === "verified";
  const fitText = buildServiceFitHypothesis(opp, selectedServices, serviceDescription);
  const recencyLabel = formatRecencyBasisLabel(opp.recency_basis);

  const formattedRetrieval = opp.retrieval_date
    ? opp.retrieval_date.replace("T", " ").slice(0, 16) +
      (opp.retrieval_date.includes("T") ? " UTC" : "")
    : "Not stated";

  const handleSourceClick = () => {
    trackLeadsEvent(
      "source_opened",
      {
        verification_status: opp.verification_status || "needs_review",
        recency_basis: opp.recency_basis || "unverified_date",
        surface: "discover_card",
      },
      { isExample, opportunityId: opp.id }
    );
  };

  return (
    <article
      className={`bg-white rounded-lg border p-5 space-y-3.5 transition-colors ${
        isVerified ? "border-slate-200" : "border-amber-200 bg-amber-50/10"
      }`}
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
              {opp.signal_type}
            </span>

            <span className="px-2 py-0.5 rounded text-xs text-slate-600 bg-slate-100 border border-slate-200">
              {recencyLabel}
            </span>

            {feedbackVerdict === "relevant" && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-900 border border-emerald-200">
                Rated relevant
              </span>
            )}

            {isDismissed && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300">
                Dismissed (Not relevant)
              </span>
            )}

            {isExample && (
              <span className="px-2 py-0.5 rounded text-xs font-medium text-slate-600 bg-slate-100 border border-slate-300">
                Example result — Not live data
              </span>
            )}
          </div>

          <h3 className="text-base font-semibold text-slate-900">{opp.business_name}</h3>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
            <span>{opp.location}</span>
            {opp.business_category && (
              <>
                <span>·</span>
                <span>{opp.business_category}</span>
              </>
            )}
            <span>·</span>
            {opp.website_url ? (
              <a
                href={opp.website_url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-700 hover:underline font-medium"
              >
                Website
              </a>
            ) : (
              <span className="text-slate-500">Website unknown</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!isExample && (onSave || onUnsave) && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => (isSaved && onUnsave ? onUnsave(opp) : onSave?.(opp))}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                isSaved
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                  : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
              }`}
              title={isSaved ? "Click to remove from Saved leads" : "Save to your leads list"}
            >
              {isSaved ? "Saved · Unsave" : "Save lead"}
            </button>
          )}

          <Link
            to="/opportunities/$opportunityId"
            params={{ opportunityId: opp.id }}
            search={detailSearchParams}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            View details
          </Link>

          {isDismissed && onRestore ? (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onRestore(opp)}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium text-blue-700 hover:bg-blue-50 border border-blue-200 transition-colors"
            >
              Restore
            </button>
          ) : (
            onDismiss && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onDismiss(opp)}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                Not relevant
              </button>
            )
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-100">
        {/* Source Evidence Column */}
        <div className="md:col-span-7 bg-slate-50 rounded-md p-3 border border-slate-200/80 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-slate-800">Recovered source evidence</span>
            <a
              href={opp.source_url}
              target="_blank"
              rel="noreferrer"
              onClick={handleSourceClick}
              className="text-blue-700 hover:underline font-medium truncate max-w-[260px]"
              title={opp.source_title}
            >
              {opp.source_title}
            </a>
          </div>

          <p className="text-xs text-slate-800 leading-relaxed">{opp.signal_summary}</p>

          {opp.supporting_excerpt && (
            <blockquote className="text-xs italic text-slate-600 border-l-2 border-slate-300 pl-2.5 py-0.5">
              {opp.supporting_excerpt}
            </blockquote>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 pt-1">
            <span>Published: {opp.publication_date || "Not stated"}</span>
            <span>Event date: {opp.event_date || "Not stated"}</span>
            <span>Retrieved: {formattedRetrieval}</span>
          </div>

          {opp.verification_notes && (
            <p
              className={`text-[11px] pt-1 ${
                isVerified ? "text-emerald-800" : "text-amber-900 font-medium"
              }`}
            >
              {opp.verification_notes}
            </p>
          )}
        </div>

        {/* Service Fit Hypothesis Column */}
        <div className="md:col-span-5 bg-blue-50/40 rounded-md p-3 border border-blue-200/70 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-blue-950">Possible service fit</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-900">
              Hypothesis
            </span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">{fitText}</p>
        </div>
      </div>
    </article>
  );
}