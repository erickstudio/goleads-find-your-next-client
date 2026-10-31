import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  EXAMPLE_OPPORTUNITIES,
  normalizeServicesList,
  buildServiceFitHypothesis,
} from "@/lib/leads-constants";
import { getWorkspaceBootstrap } from "@/lib/server-fns";

export const Route = createFileRoute("/_authed/")({
  ssr: false,
  loader: () => getWorkspaceBootstrap(),
  head: () => ({
    meta: [
      { title: "Find leads — Leads AI" },
      { name: "description", content: "Find growing businesses. Discover your next client." },
    ],
  }),
  component: DiscoverScreen,
});

function DiscoverScreen() {
  const loaderData = Route.useLoaderData();
  const profile = loaderData?.profile;
  const selectedServices = normalizeServicesList(profile?.selected_services || []);
  const serviceDescription = profile?.service_description || "";

  const [businessCategory, setBusinessCategory] = useState("Healthcare clinics");
  const [locationQuery, setLocationQuery] = useState("Austin, TX, USA");
  const [timeWindowDays, setTimeWindowDays] = useState(profile?.default_time_window_days || 90);

  // Separately labeled Example results view (never counted in live usage metrics)
  const [showExamples, setShowExamples] = useState(false);
  const [dismissedExampleIds, setDismissedExampleIds] = useState([]);

  const visibleExamples = showExamples
    ? EXAMPLE_OPPORTUNITIES.filter((item) => !dismissedExampleIds.includes(item.id)).slice(0, 5)
    : [];

  return (
    <div className="space-y-6">
      {/* Calm Workspace Heading & Compact Services Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Find your next opportunity
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Search for businesses that are opening or expanding and review their public sources.
          </p>
        </div>

        {/* User's actual selected services shown compactly with Edit */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500 mr-1">Your services:</span>
          {selectedServices.length > 0 ? (
            selectedServices.map((service) => (
              <span
                key={service}
                className="px-2.5 py-1 rounded text-xs font-medium bg-white border border-slate-200 text-slate-800"
              >
                {service}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-500 italic">None selected yet</span>
          )}
          <Link
            to="/onboarding"
            className="px-2.5 py-1 rounded text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            Edit
          </Link>
        </div>
      </div>

      {/* Optional service description summary if set */}
      {serviceDescription && (
        <div className="text-xs text-slate-600 bg-white border border-slate-200 rounded-md px-3.5 py-2 flex items-center justify-between gap-2">
          <span className="truncate">
            <strong className="font-medium text-slate-800">Offer summary:</strong> {serviceDescription}
          </span>
          <Link to="/onboarding" className="text-blue-700 hover:underline shrink-0 font-medium">
            Edit
          </Link>
        </div>
      )}

      {/* Readable Search Form */}
      <section aria-label="Search criteria" className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5">
              <label htmlFor="business-category" className="block text-xs font-medium text-slate-700 mb-1">
                Business category
              </label>
              <input
                id="business-category"
                type="text"
                value={businessCategory}
                onChange={(e) => setBusinessCategory(e.target.value)}
                placeholder="e.g., Physical therapy, retail, veterinary, hospitality"
                className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="md:col-span-4">
              <label htmlFor="city-country" className="block text-xs font-medium text-slate-700 mb-1">
                City / country
              </label>
              <input
                id="city-country"
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="e.g., Austin, TX, USA"
                className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Time window
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-md border border-slate-200">
                {[30, 90, 180].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setTimeWindowDays(days)}
                    className={`h-8 rounded text-xs font-medium transition-colors ${
                      timeWindowDays === days
                        ? "bg-white text-blue-700 shadow-2xs border border-slate-200"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {days} days
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Honest unconnected live search state + disabled Find leads button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-md">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span>Live search is not connected yet.</span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowExamples((prev) => !prev)}
                className="px-3.5 py-2 rounded-md text-xs font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {showExamples ? "Hide example results" : "View example results"}
              </button>

              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Live search is not connected yet"
                className="px-4 py-2 rounded-md text-sm font-medium bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300"
              >
                Find leads
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* Results Area */}
      {!showExamples ? (
        <section className="bg-white rounded-lg border border-slate-200 p-6 text-center space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">
            No live opportunities loaded yet
          </h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            Live search is not connected yet, so no searches are run or logged. You can configure your services now or preview the layout using example results.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowExamples(true)}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              View example results
            </button>
          </div>
        </section>
      ) : (
        <section aria-label="Example results" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-100 border border-slate-200 rounded-md px-4 py-2.5">
            <div className="text-xs text-slate-700">
              <strong className="font-semibold text-slate-900">Example results</strong> — Sample opening and expansion records shown to preview how sources and service fit appear. Not live data.
            </div>
            <button
              type="button"
              onClick={() => setShowExamples(false)}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 shrink-0 underline"
            >
              Close examples
            </button>
          </div>

          <div className="space-y-3">
            {visibleExamples.map((opp) => {
              const fitText = buildServiceFitHypothesis(
                opp,
                selectedServices,
                serviceDescription
              );
              return (
                <article
                  key={opp.id}
                  className="bg-white rounded-lg border border-slate-200 p-5 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">
                          {opp.signal_type}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs text-slate-600 bg-slate-100">
                          {opp.evidence_status}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs text-slate-500 border border-slate-200">
                          Example result
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-slate-900">
                        {opp.business_name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span>{opp.location}</span>
                        <span>·</span>
                        <span>{opp.business_category}</span>
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
                          <span className="text-slate-500">No website listed in source</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        to="/opportunities/$opportunityId"
                        params={{ opportunityId: opp.id }}
                        className="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                      >
                        View details
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          setDismissedExampleIds((prev) => [...prev, opp.id])
                        }
                        className="px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                      >
                        Not relevant
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-100">
                    <div className="md:col-span-7 bg-slate-50 rounded-md p-3 border border-slate-200/80 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-slate-800">Source evidence</span>
                        <a
                          href={opp.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 hover:underline font-medium truncate max-w-[240px]"
                        >
                          {opp.source_title}
                        </a>
                      </div>
                      <p className="text-xs text-slate-800">{opp.signal_summary}</p>
                      <blockquote className="text-xs italic text-slate-600 border-l-2 border-slate-300 pl-2.5">
                        {opp.supporting_excerpt}
                      </blockquote>
                      <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 pt-0.5">
                        <span>Published: {opp.publication_date || "Not stated"}</span>
                        <span>Event date: {opp.event_date || "Not stated"}</span>
                        <span>Retrieved: {opp.retrieval_date}</span>
                      </div>
                    </div>

                    <div className="md:col-span-5 bg-blue-50/40 rounded-md p-3 border border-blue-200/70 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-blue-950">Possible service fit</span>
                        <span className="text-[11px] text-blue-800">Inference</span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">{fitText}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}