import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
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
  unsaveOpportunityForUser,
  recordOpportunityFeedback,
  clearOpportunityFeedback,
} from "@/lib/server-fns";
import { trackLeadsEvent } from "@/lib/telemetry";

export const Route = createFileRoute("/_authed/")({
  ssr: false,
  validateSearch: (search) => {
    const out = {};
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
    if (search?.examples === "1" || search?.examples === true) {
      out.examples = "1";
    }
    if (search?.showDismissed === "1" || search?.showDismissed === true) {
      out.showDismissed = "1";
    }
    return out;
  },
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
  const searchParams = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const router = useRouter();

  const runSearchFn = useServerFn(runLeadDiscoverySearch);
  const saveOppFn = useServerFn(saveOpportunityForUser);
  const unsaveOppFn = useServerFn(unsaveOpportunityForUser);
  const feedbackFn = useServerFn(recordOpportunityFeedback);
  const clearFeedbackFn = useServerFn(clearOpportunityFeedback);

  const profile = loaderData?.profile;
  const selectedServices = normalizeServicesList(profile?.selected_services || []);
  const serviceDescription = profile?.service_description || "";
  const recentSearches = loaderData?.recentSearches || [];
  const allUserOpportunities = loaderData?.allUserOpportunities || [];

  // Resolve requested searchId from URL params or fall back to latest live search
  const matchedSearchFromUrl = searchParams.searchId
    ? recentSearches.find((s) => s.id === searchParams.searchId)
    : null;
  const initialSearch = matchedSearchFromUrl || loaderData?.latestLiveSearch || null;

  const resolveOpportunitiesForSearch = (searchObj) => {
    if (!searchObj) return [];
    const targetId = searchObj.cached_from_search_id || searchObj.id;
    const matches = allUserOpportunities.filter((o) => o.search_id === targetId);
    if (matches.length > 0) return matches;
    if (searchObj.id === loaderData?.latestLiveSearch?.id) {
      return loaderData?.latestOpportunities || [];
    }
    return [];
  };

  const [businessCategory, setBusinessCategory] = useState(
    searchParams.category || initialSearch?.business_category || "Restaurants"
  );
  const [locationQuery, setLocationQuery] = useState(
    searchParams.location || initialSearch?.location_query || "Miami, FL, USA"
  );
  const [timeWindowDays, setTimeWindowDays] = useState(
    searchParams.window ||
      initialSearch?.time_window_days ||
      profile?.default_time_window_days ||
      90
  );

  const [activeSearch, setActiveSearch] = useState(initialSearch);
  const [liveOpportunities, setLiveOpportunities] = useState(() =>
    resolveOpportunitiesForSearch(initialSearch)
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

  const [showExamples, setShowExamples] = useState(searchParams.examples === "1");
  const [showDismissed, setShowDismissed] = useState(searchParams.showDismissed === "1");
  const [dismissedExampleIds, setDismissedExampleIds] = useState([]);

  // Keep local opportunities in sync when loaderData refreshes after save/feedback actions
  useEffect(() => {
    if (activeSearch) {
      const targetId = activeSearch.cached_from_search_id || activeSearch.id;
      const freshMatches = (loaderData?.allUserOpportunities || []).filter(
        (o) => o.search_id === targetId
      );
      if (freshMatches.length > 0) {
        setLiveOpportunities(freshMatches);
      }
    }
  }, [loaderData?.allUserOpportunities, activeSearch?.id]);

  // Persist current filter and view state in URL search params so round-trips to details survive
  const syncFilterUrlParams = (overrides = {}) => {
    const nextCat = overrides.category !== undefined ? overrides.category : businessCategory;
    const nextLoc = overrides.location !== undefined ? overrides.location : locationQuery;
    const nextWin = overrides.window !== undefined ? overrides.window : timeWindowDays;
    const nextSearchId =
      overrides.searchId !== undefined ? overrides.searchId : activeSearch?.id;
    const nextExamples =
      overrides.examples !== undefined ? overrides.examples : showExamples;
    const nextShowDismissed =
      overrides.showDismissed !== undefined ? overrides.showDismissed : showDismissed;

    navigate({
      search: {
        category: nextCat?.trim() || undefined,
        location: nextLoc?.trim() || undefined,
        window: nextWin || undefined,
        searchId: nextSearchId || undefined,
        examples: nextExamples ? "1" : undefined,
        showDismissed: nextShowDismissed ? "1" : undefined,
      },
      replace: true,
    });
  };

  const savedOppIds = new Set(
    (loaderData?.savedOpportunities || []).map((s) => s.opportunity_id)
  );
  const feedbackByOppId = new Map(
    (loaderData?.feedbackRecords || []).map((f) => [f.opportunity_id, f])
  );
  const dismissedOppIds = new Set(
    (loaderData?.feedbackRecords || [])
      .filter((f) => f.verdict && f.verdict !== "relevant")
      .map((f) => f.opportunity_id)
  );

  const detailSearchParams = {
    from: "discover",
    category: businessCategory.trim() || undefined,
    location: locationQuery.trim() || undefined,
    window: timeWindowDays,
    searchId: activeSearch?.id || undefined,
    examples: showExamples ? "1" : undefined,
    showDismissed: showDismissed ? "1" : undefined,
  };

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

    trackLeadsEvent("search_started", {
      time_window_days: timeWindowDays,
      surface: "discover",
    });

    try {
      const res = await runSearchFn({
        data: {
          business_category: cat,
          location_query: loc,
          time_window_days: timeWindowDays,
          force_retry: Boolean(forceRetry),
        },
      });

      const returnedSearch = res?.search || null;
      const returnedOpps = res?.opportunities || [];

      if (returnedSearch) {
        setActiveSearch(returnedSearch);
      }
      setLiveOpportunities(returnedOpps);
      if (res?.quota) {
        setQuota(res.quota);
      }
      if (res?.fromCache) {
        setFromCacheInfo(
          res.cachedAt || returnedSearch?.completed_at || returnedSearch?.executed_at
        );
      } else {
        setFromCacheInfo(null);
      }

      if (returnedSearch?.status === "failed") {
        trackLeadsEvent("search_failed", {
          time_window_days: timeWindowDays,
          surface: "discover",
        });
      } else {
        trackLeadsEvent("search_completed", {
          time_window_days: timeWindowDays,
          results_count: returnedOpps.length,
          verified_count: returnedSearch?.verified_count ?? 0,
          needs_review_count: returnedSearch?.needs_review_count ?? 0,
          from_cache: Boolean(res?.fromCache),
          surface: "discover",
        });
      }

      syncFilterUrlParams({
        category: cat,
        location: loc,
        window: timeWindowDays,
        searchId: returnedSearch?.id,
        examples: false,
      });

      await router.invalidate();
    } catch (err) {
      trackLeadsEvent("search_failed", {
        time_window_days: timeWindowDays,
        surface: "discover",
      });
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
          service_fit_inference: fitText,
          inferred_service_categories: selectedServices,
        },
      });
      trackLeadsEvent(
        "opportunity_saved",
        {
          verification_status: opp.verification_status || "needs_review",
          action: "saved",
          surface: "discover_card",
        },
        { opportunityId: opp.id }
      );
      await router.invalidate();
      setActionBanner(`Saved "${opp.business_name}" to Saved leads.`);
    } catch (err) {
      setActionBanner(err?.message || "Could not save lead.");
    } finally {
      setBusyOppId(null);
    }
  };

  const handleUnsaveOpportunity = async (opp) => {
    setBusyOppId(opp.id);
    setActionBanner("");
    try {
      await unsaveOppFn({
        data: { opportunity_id: opp.id },
      });
      await router.invalidate();
      setActionBanner(`Removed "${opp.business_name}" from Saved leads.`);
    } catch (err) {
      setActionBanner(err?.message || "Could not remove saved lead.");
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
          reason_category: "Not a fit for my services",
          reason_note: "Dismissed from Find leads",
        },
      });
      trackLeadsEvent(
        "relevance_feedback_recorded",
        {
          verdict: "not_relevant",
          verification_status: opp.verification_status || "needs_review",
          has_reason_note: true,
          surface: "discover_card",
        },
        { opportunityId: opp.id }
      );
      await router.invalidate();
      setActionBanner(`Marked "${opp.business_name}" as not relevant.`);
    } catch (err) {
      setActionBanner(err?.message || "Could not record feedback.");
    } finally {
      setBusyOppId(null);
    }
  };

  const handleRestoreOpportunity = async (opp) => {
    setBusyOppId(opp.id);
    setActionBanner("");
    try {
      await clearFeedbackFn({
        data: { opportunity_id: opp.id },
      });
      await router.invalidate();
      setActionBanner(`Restored "${opp.business_name}" to active results.`);
    } catch (err) {
      setActionBanner(err?.message || "Could not restore lead.");
    } finally {
      setBusyOppId(null);
    }
  };

  const dismissedLiveOpps = liveOpportunities.filter((o) => dismissedOppIds.has(o.id));
  const activeLiveOpps = liveOpportunities.filter((o) => !dismissedOppIds.has(o.id));
  const verifiedOpps = activeLiveOpps.filter((o) => o.verification_status === "verified");
  const needsReviewOpps = activeLiveOpps.filter((o) => o.verification_status !== "verified");

  const visibleExamples = showExamples
    ? EXAMPLE_OPPORTUNITIES.filter((item) => !dismissedExampleIds.includes(item.id)).slice(0, 5)
    : [];

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
                onChange={(e) => {
                  const val = e.target.value;
                  setBusinessCategory(val);
                  syncFilterUrlParams({ category: val });
                }}
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
                onChange={(e) => {
                  const val = e.target.value;
                  setLocationQuery(val);
                  syncFilterUrlParams({ location: val });
                }}
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
                    onClick={() => {
                      setTimeWindowDays(days);
                      syncFilterUrlParams({ window: days });
                    }}
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
                onClick={() => {
                  const next = !showExamples;
                  setShowExamples(next);
                  syncFilterUrlParams({ examples: next });
                }}
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

              <div className="text-[11px] text-slate-500 shrink-0 flex flex-col sm:items-end gap-1">
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

                {dismissedLiveOpps.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = !showDismissed;
                      setShowDismissed(next);
                      syncFilterUrlParams({ showDismissed: next });
                    }}
                    className="text-blue-700 hover:underline font-medium"
                  >
                    {showDismissed
                      ? `Hide dismissed (${dismissedLiveOpps.length})`
                      : `Show dismissed (${dismissedLiveOpps.length})`}
                  </button>
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
                  No active candidates in this view are marked Verified.
                </div>
              ) : (
                verifiedOpps.map((opp) => (
                  <OpportunityCard
                    key={opp.id}
                    opp={opp}
                    selectedServices={selectedServices}
                    serviceDescription={serviceDescription}
                    isSaved={savedOppIds.has(opp.id)}
                    isDismissed={false}
                    feedbackVerdict={feedbackByOppId.get(opp.id)?.verdict || null}
                    isBusy={busyOppId === opp.id}
                    detailSearchParams={detailSearchParams}
                    onSave={handleSaveOpportunity}
                    onUnsave={handleUnsaveOpportunity}
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
                    isDismissed={false}
                    feedbackVerdict={feedbackByOppId.get(opp.id)?.verdict || null}
                    isBusy={busyOppId === opp.id}
                    detailSearchParams={detailSearchParams}
                    onSave={handleSaveOpportunity}
                    onUnsave={handleUnsaveOpportunity}
                    onDismiss={handleDismissOpportunity}
                  />
                ))}
              </div>
            )}

            {/* Optional Dismissed Section so users can inspect or restore dismissed items */}
            {showDismissed && dismissedLiveOpps.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-700">
                    Dismissed opportunities ({dismissedLiveOpps.length})
                  </h2>
                  <span className="text-xs text-slate-500">
                    Marked as not relevant — click Restore or open details to update your rating
                  </span>
                </div>

                {dismissedLiveOpps.map((opp) => (
                  <OpportunityCard
                    key={opp.id}
                    opp={opp}
                    selectedServices={selectedServices}
                    serviceDescription={serviceDescription}
                    isSaved={savedOppIds.has(opp.id)}
                    isDismissed={true}
                    feedbackVerdict={feedbackByOppId.get(opp.id)?.verdict || "not_relevant"}
                    isBusy={busyOppId === opp.id}
                    detailSearchParams={detailSearchParams}
                    onSave={handleSaveOpportunity}
                    onUnsave={handleUnsaveOpportunity}
                    onRestore={handleRestoreOpportunity}
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
              onClick={() => {
                setShowExamples(false);
                syncFilterUrlParams({ examples: false });
              }}
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
                detailSearchParams={detailSearchParams}
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