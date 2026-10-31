import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import OpportunityCard from "@/components/OpportunityCard";
import {
  EXAMPLE_OPPORTUNITIES,
  normalizeServicesList,
  buildServiceFitHypothesis,
} from "@/lib/leads-constants";
import {
  getWorkspaceBootstrap,
  runLeadDiscoverySearch,
  saveOpportunityForUser,
  recordOpportunityFeedback,
} from "@/lib/server-fns";

export const Route = createFileRoute("/_authed/")({
  ssr: false,
  loader: () => getWorkspaceBootstrap(),
  head: () => ({
    meta: [
      { title: "Find leads — Leads AI" },
      { name: "description", content: "Find growing businesses with verified opening or expansion signals." },
    ],
  }),
  component: DiscoverScreen,
});

function DiscoverScreen() {
  const loaderData = Route.useLoaderData();
  const router = useRouter();

  const runSearchFn = useServerFn(runLeadDiscoverySearch);
  const saveOppFn = useServerFn(saveOpportunityForUser);
  const feedbackFn = useServerFn(recordOpportunityFeedback);

  const profile = loaderData?.profile;
  const selectedServices = normalizeServicesList(profile?.selected_services || []);
  const serviceDescription = profile?.service_description || "";
  const latestSearchFromLoader = loaderData?.latestLiveSearch || null;

  // Use existing search filters if present; otherwise default to the explicitly labeled test query (Restaurants in Miami, 90 days)
  const [businessCategory, setBusinessCategory] = useState(
    latestSearchFromLoader?.business_category || "Restaurants"
  );
  const [locationQuery, setLocationQuery] = useState(
    latestSearchFromLoader?.location_query || "Miami, FL, USA"
  );
  const [timeWindowDays, setTimeWindowDays] = useState(
    latestSearchFromLoader?.time_window_days || profile?.default_time_window_days || 90
  );

  const [activeSearch, setActiveSearch] = useState(latestSearchFromLoader);
  const [liveOpportunities, setLiveOpportunities] = useState(
    loaderData?.latestOpportunities || []
  );
  const [quota, setQuota] = useState(
    loaderData?.quota || {
      usedToday: 0,
      maxDaily: 3,
      remainingToday: 3,
      maxResultsPerSearch: 5,
      cacheTtlHours: 24,
    }
  );
  const [fromCacheInfo, setFromCacheInfo] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [actionBanner, setActionBanner] = useState("");
  const [busyOppId, setBusyOppId] = useState(null);

  // Separately labeled Example results toggle (never counted in live usage metrics)
  const [showExamples, setShowExamples] = useState(false);
  const [dismissedExampleIds, setDismissedExampleIds] = useState([]);

  const savedOppIds = new Set(
    (loaderData?.savedOpportunities || []).map((s) => s.opportunity_id)
  );
  const dismissedOppIds = new Set(
    (loaderData?.feedbackRecords || [])
      .filter((f) => f.verdict === "not_relevant")
      .map((f) => f.opportunity_id)
  );

  const executeDiscoverySearch = async (forceRetry = false) => {
    if (isSearching) return;
    const cat = businessCategory.trim();
    const loc = locationQuery.trim();
    if (!cat || !loc) {
      setRequestError("Please enter both a business category and a city/country.");
      return;
    }

    setIsSearching(true);
    setRequestError("");
    setActionBanner("");
    setShowExamples(false);

    try {
      const res = await runSearchFn({
        data: {
          business_category: cat,
          location_query: loc,
          time_window_days: timeWindowDays,
          force_retry: Boolean(forceRetry),
        },
      });

      if (res?.search) {
        setActiveSearch(res.search);
      }
      setLiveOpportunities(res?.opportunities || []);
      if (res?.quota) {
        setQuota(res.quota);
      }
      if (res?.fromCache) {
        setFromCacheInfo(res.cachedAt || res?.search?.completed_at || res?.search?.executed_at);
      } else {
        setFromCacheInfo(null);
      }
      await router.invalidate();
    } catch (err) {
      setRequestError(
        err?.message || "Could not run live search. Please check your parameters and retry."
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveOpportunity = async (opp) => {
    setBusyOppId(opp.id);
    setActionBanner("");
    try {
      const fitText = buildServiceFitHypothesis(opp, selectedServices, serviceDescription);
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
          recency_basis: opp.recency_basis || "unverified_date",
          verification_status: opp.verification_status || "needs_review",
          verification_notes: opp.verification_notes || "",
          evidence_status: opp.evidence_status || "unverified",
          service_fit_inference: fitText,
          inferred_service_categories: selectedServices,
        },
      });
      await router.invalidate();
      setActionBanner(`Saved "${opp.business_name}" to your Saved leads.`);
    } catch (err) {
      setActionBanner(err?.message || "Could not save lead.");
    } finally {
      setBusyOppId(null);
    }
  };

  const handleDismissOpportunity = async (opp) => {
    setBusyOppId(opp.id);
    setActionBanner("");
    try {
      await feedbackFn({
        data: {
          opportunity_id: opp.id,
          business_name: opp.business_name,
          verdict: "not_relevant",
          reason_note: "Marked not relevant from Find leads",
        },
      });
      await router.invalidate();
      setActionBanner(`Marked "${opp.business_name}" as not relevant.`);
    } catch (err) {
      setActionBanner(err?.message || "Could not record feedback.");
    } finally {
      setBusyOppId(null);
    }
  };

  // Filter out dismissed opportunities from active view
  const visibleLiveOpps = liveOpportunities.filter((o) => !dismissedOppIds.has(o.id));
  const verifiedOpps = visibleLiveOpps.filter((o) => o.verification_status === "verified");
  const needsReviewOpps = visibleLiveOpps.filter((o) => o.verification_status !== "verified");

  const visibleExamples = showExamples
    ? EXAMPLE_OPPORTUNITIES.filter((item) => !dismissedExampleIds.includes(item.id)).slice(0, 5)
    : [];

  // Derive current explicit UI state: not_configured, searching, failed, empty, partial, complete
  const currentSearchStatus = isSearching
    ? "searching"
    : requestError || activeSearch?.status === "failed"
    ? "failed"
    : activeSearch?.status || (selectedServices.length === 0 ? "not_configured" : "ready");

  const isDefaultTestQuery =
    businessCategory.trim().toLowerCase() === "restaurants" &&
    locationQuery.trim().toLowerCase().includes("miami") &&
    timeWindowDays === 90;

  return (
    <div className="space-y-6">
      {/* Workspace Heading & Custom Services Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Find your next opportunity
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Discover businesses with public opening or expansion announcements and verify their sources.
          </p>
        </div>

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
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-900 border border-amber-200">
              Not configured yet
            </span>
          )}
          <Link
            to="/onboarding"
            className="px-2.5 py-1 rounded text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors"
          >
            {selectedServices.length > 0 ? "Edit" : "Add services"}
          </Link>
        </div>
      </div>

      {/* Not Configured Service Profile Notice */}
      {selectedServices.length === 0 && (
        <div
          role="status"
          className="bg-amber-50/80 border border-amber-200 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-950"
        >
          <div>
            <strong className="font-semibold">Service profile not configured:</strong> You can run a live search now, or add the custom services you sell so service-fit hypotheses are tailored to your business.
          </div>
          <Link
            to="/onboarding"
            className="px-3 py-1.5 rounded-md font-medium bg-amber-900 text-white hover:bg-amber-800 shrink-0 text-center"
          >
            Configure services
          </Link>
        </div>
      )}

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

      {/* Search Form */}
      <section aria-label="Search criteria" className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            executeDiscoverySearch(false);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5">
              <label htmlFor="business-category" className="block text-xs font-medium text-slate-700 mb-1">
                Business category / sector
              </label>
              <input
                id="business-category"
                type="text"
                disabled={isSearching}
                value={businessCategory}
                onChange={(e) => setBusinessCategory(e.target.value)}
                placeholder="e.g., Restaurants, Physical therapy, Dental clinics, Retail"
                className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-50"
              />
            </div>

            <div className="md:col-span-4">
              <label htmlFor="city-country" className="block text-xs font-medium text-slate-700 mb-1">
                City / country
              </label>
              <input
                id="city-country"
                type="text"
                disabled={isSearching}
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="e.g., Miami, FL, USA"
                className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-50"
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
                    disabled={isSearching}
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

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                Live web search & source check active
              </span>
              <span>
                {quota.remainingToday} of {quota.maxDaily} new daily searches left
              </span>
              <span>·</span>
              <span>Up to {quota.maxResultsPerSearch} results/search</span>
              {isDefaultTestQuery && (
                <>
                  <span>·</span>
                  <span className="text-slate-500">
                    Starter test query (editable to any market)
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowExamples((prev) => !prev)}
                className="px-3.5 py-2 rounded-md text-xs font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {showExamples ? "Hide example results" : "View example results"}
              </button>

              <button
                type="submit"
                disabled={isSearching}
                className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {isSearching ? "Searching & verifying…" : "Find leads"}
              </button>
            </div>
          </div>
        </form>
      </section>

      {actionBanner && (
        <div
          role="status"
          className="px-4 py-2.5 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center justify-between"
        >
          <span>{actionBanner}</span>
          <button
            type="button"
            onClick={() => setActionBanner("")}
            className="text-blue-700 hover:underline font-medium ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* STATE 1: SEARCHING */}
      {currentSearchStatus === "searching" && (
        <section
          aria-live="polite"
          className="bg-white rounded-lg border border-blue-200 p-6 text-center space-y-2"
        >
          <div className="inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <h2 className="text-sm font-semibold text-slate-900">
            Searching live announcements and verifying source pages…
          </h2>
          <p className="text-xs text-slate-600 max-w-lg mx-auto">
            Looking for up to 5 unique businesses in <strong>{businessCategory}</strong> ({locationQuery}) within the last {timeWindowDays} days and checking recovered source content for business identity, location, event, and date.
          </p>
        </section>
      )}

      {/* STATE 2: FAILED (distinct from empty, with explicit Retry action) */}
      {currentSearchStatus === "failed" && !showExamples && (
        <section
          role="alert"
          className="bg-red-50/70 rounded-lg border border-red-200 p-5 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-900 border border-red-300">
                  Search failed
                </span>
                <h2 className="text-sm font-semibold text-red-950">
                  Live retrieval did not complete
                </h2>
              </div>
              <p className="text-xs text-red-900 leading-relaxed">
                {requestError ||
                  activeSearch?.honest_status_reason ||
                  "The search provider encountered an error. An error is not an empty search, and no results were fabricated."}
              </p>
            </div>

            <button
              type="button"
              disabled={isSearching}
              onClick={() => executeDiscoverySearch(true)}
              className="px-3.5 py-2 rounded-md text-xs font-medium bg-red-800 text-white hover:bg-red-900 shrink-0"
            >
              Retry search
            </button>
          </div>
        </section>
      )}

      {/* STATE 3: EMPTY (successful search with 0 substantiated results) */}
      {currentSearchStatus === "empty" && !showExamples && (
        <section className="bg-white rounded-lg border border-slate-200 p-6 text-center space-y-2">
          <span className="inline-block px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            Empty result — 0 verified matches
          </span>
          <h2 className="text-sm font-semibold text-slate-900">
            No substantiated opening or expansion events found
          </h2>
          <p className="text-xs text-slate-600 max-w-lg mx-auto leading-relaxed">
            {activeSearch?.honest_status_reason ||
              `No public announcements with verifiable source evidence were found for "${activeSearch?.business_category}" in "${activeSearch?.location_query}" within the last ${activeSearch?.time_window_days} days. Results are never padded with unverified directories.`}
          </p>
        </section>
      )}

      {/* STATE 4 & 5: COMPLETED OR PARTIAL LIVE RESULTS */}
      {(currentSearchStatus === "completed" || currentSearchStatus === "partial") &&
        !showExamples &&
        activeSearch && (
          <section aria-label="Live search results" className="space-y-5">
            {/* Search Status Summary Bar */}
            <div className="bg-white rounded-lg border border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded font-semibold border ${
                      currentSearchStatus === "completed"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-amber-50 text-amber-900 border-amber-300"
                    }`}
                  >
                    {currentSearchStatus === "completed"
                      ? "Complete — Verified sources"
                      : "Partial — Includes candidates needing review"}
                  </span>
                  <span className="font-medium text-slate-900">
                    {activeSearch.business_category} · {activeSearch.location_query} · Last{" "}
                    {activeSearch.time_window_days} days
                  </span>
                </div>
                <p className="text-slate-600">{activeSearch.honest_status_reason}</p>
              </div>

              <div className="text-[11px] text-slate-500 shrink-0 flex flex-col sm:items-end">
                {fromCacheInfo ? (
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                    24h private cache · Retrieved{" "}
                    {String(fromCacheInfo).replace("T", " ").slice(0, 16)} UTC
                  </span>
                ) : (
                  <span>
                    Retrieved{" "}
                    {String(activeSearch.completed_at || activeSearch.executed_at || "")
                      .replace("T", " ")
                      .slice(0, 16)}{" "}
                    UTC
                    {activeSearch.duration_ms
                      ? ` · ${(activeSearch.duration_ms / 1000).toFixed(1)}s`
                      : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Verified Opportunities Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">
                  Verified opportunities ({verifiedOpps.length})
                </h2>
                <span className="text-xs text-slate-500">
                  Identity, location, event, and recency confirmed against recovered page content
                </span>
              </div>

              {verifiedOpps.length === 0 ? (
                <div className="bg-white rounded-lg border border-slate-200 p-4 text-xs text-slate-600">
                  No candidates in this run passed full automated page verification. Review the candidates below manually.
                </div>
              ) : (
                verifiedOpps.map((opp) => (
                  <OpportunityCard
                    key={opp.id}
                    opp={opp}
                    selectedServices={selectedServices}
                    serviceDescription={serviceDescription}
                    isSaved={savedOppIds.has(opp.id)}
                    isDismissed={dismissedOppIds.has(opp.id)}
                    isBusy={busyOppId === opp.id}
                    onSave={handleSaveOpportunity}
                    onDismiss={handleDismissOpportunity}
                  />
                ))
              )}
            </div>

            {/* Needs Review Section (kept strictly separate from Verified) */}
            {needsReviewOpps.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h2 className="text-sm font-semibold text-amber-950">
                    Needs review ({needsReviewOpps.length})
                  </h2>
                  <span className="text-xs text-amber-900">
                    Excluded from verified results — source blocked automated page recovery or recency date requires manual check
                  </span>
                </div>

                {needsReviewOpps.map((opp) => (
                  <OpportunityCard
                    key={opp.id}
                    opp={opp}
                    selectedServices={selectedServices}
                    serviceDescription={serviceDescription}
                    isSaved={savedOppIds.has(opp.id)}
                    isDismissed={dismissedOppIds.has(opp.id)}
                    isBusy={busyOppId === opp.id}
                    onSave={handleSaveOpportunity}
                    onDismiss={handleDismissOpportunity}
                  />
                ))}
              </div>
            )}
          </section>
        )}

      {/* INITIAL READY STATE (when no live search has been run yet) */}
      {!activeSearch && !isSearching && !requestError && !showExamples && (
        <section className="bg-white rounded-lg border border-slate-200 p-6 text-center space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Ready to search live opening and expansion announcements
          </h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            Click <strong>Find leads</strong> above to run a live search for{" "}
            <strong>{businessCategory}</strong> in <strong>{locationQuery}</strong> ({timeWindowDays}-day window), or change the filters to any sector and location.
          </p>
        </section>
      )}

      {/* SEPARATELY LABELED EXAMPLE RESULTS VIEW */}
      {showExamples && (
        <section aria-label="Example results" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-100 border border-slate-200 rounded-md px-4 py-2.5">
            <div className="text-xs text-slate-700">
              <strong className="font-semibold text-slate-900">Example results</strong> — Sample demonstration records shown to preview how sources and service-fit hypotheses appear. Excluded from live usage metrics and saved leads.
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
            {visibleExamples.map((opp) => (
              <OpportunityCard
                key={opp.id}
                opp={opp}
                selectedServices={selectedServices}
                serviceDescription={serviceDescription}
                isExample={true}
                onDismiss={(item) =>
                  setDismissedExampleIds((prev) => [...prev, item.id])
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}