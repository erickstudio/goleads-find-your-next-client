import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import OpportunityCard from "@/components/OpportunityCard";
import AgentChatPanel from "@/components/AgentChatPanel";
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
import { usePreferences } from "@/lib/PreferencesContext";
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
      { title: "Find leads — goleads.app" },
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
  const { lang, outreachLang, syncFromProfile, t } = usePreferences();

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

  useEffect(() => {
    if (profile) {
      syncFromProfile(profile);
    }
  }, [profile?.id]);

  useEffect(() => {
    document.title = t("discover.pageTitle");
  }, [lang, t]);

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
      setRequestError(t("discover.validationMissingFields"));
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
        err?.message || t("discover.failedFallbackBody")
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveOpportunity = async (opp) => {
    setBusyOppId(opp.id);
    setActionBanner("");
    try {
      const fitText = buildServiceFitHypothesis(opp, selectedServices, serviceDescription, lang);
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
      setActionBanner(t("discover.savedBanner", { name: opp.business_name }));
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
      setActionBanner(t("discover.unsavedBanner", { name: opp.business_name }));
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
      setActionBanner(t("discover.dismissedBanner", { name: opp.business_name }));
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
      setActionBanner(t("discover.restoredBanner", { name: opp.business_name }));
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {t("discover.heading")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("discover.subheading")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">{t("discover.yourServicesLabel")}</span>
          {selectedServices.length > 0 ? (
            selectedServices.map((service) => (
              <span
                key={service}
                className="px-2.5 py-1 rounded text-xs font-medium bg-card border border-border text-foreground"
              >
                {service}
              </span>
            ))
          ) : (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/35">
              {t("discover.notConfiguredYet")}
            </span>
          )}
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-secondary text-muted-foreground border border-border">
            {t("discover.outreachLanguageIndicator")} {outreachLang.toUpperCase()}
          </span>
          <Link
            to="/onboarding"
            className="px-2.5 py-1 rounded text-xs font-medium text-primary hover:bg-primary/10 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {selectedServices.length > 0 ? t("discover.editServices") : t("discover.addServices")}
          </Link>
        </div>
      </div>

      {/* Not Configured Service Profile Notice */}
      {selectedServices.length === 0 && (
        <div
          role="status"
          className="bg-amber-500/10 border border-amber-500/35 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-foreground"
        >
          <div>
            <strong className="font-semibold text-amber-800 dark:text-amber-300">
              {t("discover.unconfiguredBannerTitle")}
            </strong>{" "}
            {t("discover.unconfiguredBannerBody")}
          </div>
          <Link
            to="/onboarding"
            className="px-3 py-1.5 rounded-md font-medium bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 text-center focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {t("discover.configureServicesBtn")}
          </Link>
        </div>
      )}

      {/* Optional service description summary if set */}
      {serviceDescription && (
        <div className="text-xs text-muted-foreground bg-card border border-border rounded-md px-3.5 py-2 flex items-center justify-between gap-2">
          <span className="truncate">
            <strong className="font-medium text-foreground">{t("discover.offerSummaryLabel")}</strong>{" "}
            {serviceDescription}
          </span>
          <Link to="/onboarding" className="text-primary hover:underline shrink-0 font-medium">
            {t("discover.editServices")}
          </Link>
        </div>
      )}

      {/* LeadSearch Parameter Strategy Agent */}
      <AgentChatPanel
        agentName="search_strategist"
        badgeLabel={t("discover.agentBadge")}
        title={t("discover.agentTitle")}
        subtitle={t("discover.agentSubtitle")}
        conversationTitle={t("discover.agentConvTitle")}
        contextPreamble={`Preferred response language: ${lang === "es" ? "Spanish (Español)" : "English"}. Current user services: ${
          selectedServices.length > 0 ? selectedServices.join(", ") : "None configured yet"
        }. Service description: ${serviceDescription || "Not set"}. Current form inputs: Business category="${businessCategory}", Location="${locationQuery}", Time window=${timeWindowDays} days.`}
        starterPrompts={[
          {
            label: t("discover.agentPrompt1Label"),
            prompt: t("discover.agentPrompt1Text"),
          },
          {
            label: t("discover.agentPrompt2Label", {
              category: businessCategory,
              location: locationQuery,
            }),
            prompt: t("discover.agentPrompt2Text", {
              category: businessCategory,
              location: locationQuery,
              days: timeWindowDays,
            }),
          },
          {
            label: t("discover.agentPrompt3Label"),
            prompt: t("discover.agentPrompt3Text"),
          },
        ]}
        placeholder={t("discover.agentPlaceholder")}
      />

      {/* Search Form */}
      <section
        aria-label={t("discover.searchCriteriaAria")}
        className="bg-card text-card-foreground rounded-lg border border-border p-5 space-y-4"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            executeDiscoverySearch(false);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5">
              <label htmlFor="business-category" className="block text-xs font-medium text-foreground mb-1">
                {t("discover.categoryLabel")}
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
                placeholder={t("discover.categoryPlaceholder")}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
            </div>

            <div className="md:col-span-4">
              <label htmlFor="city-country" className="block text-xs font-medium text-foreground mb-1">
                {t("discover.locationLabel")}
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
                placeholder={t("discover.locationPlaceholder")}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-foreground mb-1">
                {t("discover.timeWindowLabel")}
              </label>
              <div className="grid grid-cols-3 gap-1 bg-secondary p-1 rounded-md border border-border">
                {[30, 90, 180].map((days) => (
                  <button
                    key={days}
                    type="button"
                    disabled={isSearching}
                    onClick={() => {
                      setTimeWindowDays(days);
                      syncFilterUrlParams({ window: days });
                    }}
                    className={`h-8 rounded text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                      timeWindowDays === days
                        ? "bg-card text-primary shadow-2xs border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t("discover.daysOption", { days })}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/70">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {t("discover.liveSearchBadge")}
              </span>
              <span>
                {t("discover.quotaRemaining", {
                  remaining: quota.remainingToday,
                  max: quota.maxDaily,
                })}
              </span>
              <span>·</span>
              <span>{t("discover.maxResultsNote", { max: quota.maxResultsPerSearch })}</span>
              {isDefaultTestQuery && (
                <>
                  <span>·</span>
                  <span className="text-muted-foreground/80">
                    {t("discover.starterQueryNote")}
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
                className="px-3.5 py-2 rounded-md text-xs font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {showExamples ? t("discover.hideExamplesBtn") : t("discover.viewExamplesBtn")}
              </button>

              <button
                type="submit"
                disabled={isSearching}
                className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {isSearching ? t("discover.searchingBtn") : t("discover.findLeadsBtn")}
              </button>
            </div>
          </div>
        </form>
      </section>

      {actionBanner && (
        <div
          role="status"
          className="px-4 py-2.5 rounded-md bg-primary/15 border border-primary/30 text-xs text-foreground flex items-center justify-between"
        >
          <span>{actionBanner}</span>
          <button
            type="button"
            onClick={() => setActionBanner("")}
            className="text-primary hover:underline font-medium ml-4"
          >
            {t("common.dismiss")}
          </button>
        </div>
      )}

      {/* STATE 1: SEARCHING */}
      {currentSearchStatus === "searching" && (
        <section
          aria-live="polite"
          className="bg-card rounded-lg border border-primary/40 p-6 text-center space-y-2"
        >
          <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <h2 className="text-sm font-semibold text-foreground">
            {t("discover.searchingTitle")}
          </h2>
          <p className="text-xs text-muted-foreground max-w-lg mx-auto">
            {t("discover.searchingBody", {
              category: businessCategory,
              location: locationQuery,
              days: timeWindowDays,
            })}
          </p>
        </section>
      )}

      {/* STATE 2: FAILED */}
      {currentSearchStatus === "failed" && !showExamples && (
        <section
          role="alert"
          className="bg-destructive/10 rounded-lg border border-destructive/35 p-5 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-destructive/20 text-destructive border border-destructive/40">
                  {t("discover.failedBadge")}
                </span>
                <h2 className="text-sm font-semibold text-foreground">
                  {t("discover.failedTitle")}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {requestError ||
                  activeSearch?.honest_status_reason ||
                  t("discover.failedFallbackBody")}
              </p>
            </div>

            <button
              type="button"
              disabled={isSearching}
              onClick={() => executeDiscoverySearch(true)}
              className="px-3.5 py-2 rounded-md text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 shrink-0 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {t("discover.retrySearchBtn")}
            </button>
          </div>
        </section>
      )}

      {/* STATE 3: EMPTY */}
      {currentSearchStatus === "empty" && !showExamples && (
        <section className="bg-card rounded-lg border border-border p-6 text-center space-y-2">
          <span className="inline-block px-2.5 py-0.5 rounded text-xs font-medium bg-secondary text-muted-foreground border border-border">
            {t("discover.emptyBadge")}
          </span>
          <h2 className="text-sm font-semibold text-foreground">
            {t("discover.emptyTitle")}
          </h2>
          <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
            {activeSearch?.honest_status_reason ||
              t("discover.emptyFallbackBody", {
                category: activeSearch?.business_category || businessCategory,
                location: activeSearch?.location_query || locationQuery,
                days: activeSearch?.time_window_days || timeWindowDays,
              })}
          </p>
        </section>
      )}

      {/* STATE 4 & 5: COMPLETED OR PARTIAL LIVE RESULTS */}
      {(currentSearchStatus === "completed" || currentSearchStatus === "partial") &&
        !showExamples &&
        activeSearch && (
          <section aria-label="Live search results" className="space-y-5">
            <div className="bg-card rounded-lg border border-border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded font-semibold border ${
                      currentSearchStatus === "completed"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35"
                    }`}
                  >
                    {currentSearchStatus === "completed"
                      ? t("discover.completeBadge")
                      : t("discover.partialBadge")}
                  </span>
                  <span className="font-medium text-foreground">
                    {activeSearch.business_category} · {activeSearch.location_query} ·{" "}
                    {t("discover.lastDaysLabel", { days: activeSearch.time_window_days })}
                  </span>
                </div>
                <p className="text-muted-foreground">{activeSearch.honest_status_reason}</p>
              </div>

              <div className="text-[11px] font-mono text-muted-foreground shrink-0 flex flex-col sm:items-end gap-1">
                {fromCacheInfo ? (
                  <span className="px-2 py-0.5 rounded bg-secondary text-foreground border border-border font-medium">
                    {t("discover.cacheBadge", {
                      time: String(fromCacheInfo).replace("T", " ").slice(0, 16),
                    })}
                  </span>
                ) : (
                  <span>
                    {t("discover.retrievedAtLabel", {
                      time: String(
                        activeSearch.completed_at || activeSearch.executed_at || ""
                      )
                        .replace("T", " ")
                        .slice(0, 16),
                    })}
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
                    className="text-primary hover:underline font-sans font-medium"
                  >
                    {showDismissed
                      ? t("discover.hideDismissedBtn", { count: dismissedLiveOpps.length })
                      : t("discover.showDismissedBtn", { count: dismissedLiveOpps.length })}
                  </button>
                )}
              </div>
            </div>

            {/* Verified Opportunities Section */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h2 className="text-sm font-semibold text-foreground">
                  {t("discover.verifiedSectionTitle", { count: verifiedOpps.length })}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {t("discover.verifiedSectionSub")}
                </span>
              </div>

              {verifiedOpps.length === 0 ? (
                <div className="bg-card rounded-lg border border-border p-4 text-xs text-muted-foreground">
                  {t("discover.noVerifiedInView")}
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

            {/* Needs Review Section */}
            {needsReviewOpps.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    {t("discover.needsReviewSectionTitle", { count: needsReviewOpps.length })}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {t("discover.needsReviewSectionSub")}
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

            {/* Dismissed Section */}
            {showDismissed && dismissedLiveOpps.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h2 className="text-sm font-semibold text-muted-foreground">
                    {t("discover.dismissedSectionTitle", { count: dismissedLiveOpps.length })}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {t("discover.dismissedSectionSub")}
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

      {/* INITIAL READY STATE */}
      {!activeSearch && !isSearching && !requestError && !showExamples && (
        <section className="bg-card rounded-lg border border-border p-6 text-center space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            {t("discover.readyTitle")}
          </h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            {t("discover.readyBody", {
              category: businessCategory,
              location: locationQuery,
              days: timeWindowDays,
            })}
          </p>
        </section>
      )}

      {/* SEPARATELY LABELED EXAMPLE RESULTS VIEW */}
      {showExamples && (
        <section aria-label="Example results" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-secondary border border-border rounded-md px-4 py-2.5">
            <div className="text-xs text-muted-foreground">
              <strong className="font-semibold text-foreground">
                {t("discover.examplesBannerTitle")}
              </strong>{" "}
              — {t("discover.examplesBannerBody")}
            </div>
            <button
              type="button"
              onClick={() => {
                setShowExamples(false);
                syncFilterUrlParams({ examples: false });
              }}
              className="text-xs font-medium text-primary hover:underline shrink-0"
            >
              {t("discover.closeExamplesBtn")}
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