import { useState, useEffect } from "react";
import { getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { EXAMPLE_OPPORTUNITIES, normalizeServicesList, buildServiceFitHypothesis } from "@/lib/leads-constants";
import { runLeadDiscoverySearch, saveOpportunityForUser, unsaveOpportunityForUser, recordOpportunityFeedback, clearOpportunityFeedback } from "@/lib/server-fns";
import { usePreferences } from "@/lib/PreferencesContext";
import { trackLeadsEvent } from "@/lib/telemetry";

const workspaceRoute = getRouteApi("/_authed/app");
export default function useDiscoveryWorkspace() {
  const loaderData = workspaceRoute.useLoaderData();
  const searchParams = workspaceRoute.useSearch();
  const navigate = useNavigate({ from: "/app" });
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

  useEffect(() => { if (profile) syncFromProfile(profile); }, [profile?.id]);
  useEffect(() => { document.title = t("discover.pageTitle"); }, [lang, t]);

  const matchedSearchFromUrl = searchParams.searchId ? recentSearches.find((s) => s.id === searchParams.searchId) : null;
  const initialSearch = matchedSearchFromUrl || loaderData?.latestLiveSearch || null;
  const resolveOpportunitiesForSearch = (searchObj) => {
    if (!searchObj) return [];
    const matches = allUserOpportunities.filter((o) => o.search_id === (searchObj.cached_from_search_id || searchObj.id));
    if (matches.length > 0) return matches;
    return searchObj.id === loaderData?.latestLiveSearch?.id ? loaderData?.latestOpportunities || [] : [];
  };
  const [businessCategory, setBusinessCategory] = useState(searchParams.category || initialSearch?.business_category || "Restaurants");
  const [locationQuery, setLocationQuery] = useState(searchParams.location || initialSearch?.location_query || "Miami, FL, USA");
  const [timeWindowDays, setTimeWindowDays] = useState(searchParams.window || initialSearch?.time_window_days || profile?.default_time_window_days || 90);
  const [activeSearch, setActiveSearch] = useState(initialSearch);
  const [liveOpportunities, setLiveOpportunities] = useState(() => resolveOpportunitiesForSearch(initialSearch));
  const [quota, setQuota] = useState(loaderData?.quota || { usedToday: 0, maxDaily: 3, remainingToday: 3, maxResultsPerSearch: 5, cacheTtlHours: 24 });
  const [fromCacheInfo, setFromCacheInfo] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [actionBanner, setActionBanner] = useState("");
  const [busyOppId, setBusyOppId] = useState(null);
  const [showExamples, setShowExamples] = useState(searchParams.examples === "1");
  const [showDismissed, setShowDismissed] = useState(searchParams.showDismissed === "1");
  const [dismissedExampleIds, setDismissedExampleIds] = useState([]);

  useEffect(() => {
    if (!activeSearch) return;
    const targetId = activeSearch.cached_from_search_id || activeSearch.id;
    const freshMatches = (loaderData?.allUserOpportunities || []).filter((o) => o.search_id === targetId);
    if (freshMatches.length > 0) setLiveOpportunities(freshMatches);
  }, [loaderData?.allUserOpportunities, activeSearch?.id]);

  const syncFilterUrlParams = (overrides = {}) => {
    const nextCat = overrides.category !== undefined ? overrides.category : businessCategory;
    const nextLoc = overrides.location !== undefined ? overrides.location : locationQuery;
    const nextWin = overrides.window !== undefined ? overrides.window : timeWindowDays;
    const nextSearchId = overrides.searchId !== undefined ? overrides.searchId : activeSearch?.id;
    const nextExamples = overrides.examples !== undefined ? overrides.examples : showExamples;
    const nextShowDismissed = overrides.showDismissed !== undefined ? overrides.showDismissed : showDismissed;
    navigate({ search: { category: nextCat?.trim() || undefined, location: nextLoc?.trim() || undefined, window: nextWin || undefined, searchId: nextSearchId || undefined, examples: nextExamples ? "1" : undefined, showDismissed: nextShowDismissed ? "1" : undefined }, replace: true });
  };
  const savedOppIds = new Set((loaderData?.savedOpportunities || []).map((s) => s.opportunity_id));
  const feedbackByOppId = new Map((loaderData?.feedbackRecords || []).map((f) => [f.opportunity_id, f]));
  const dismissedOppIds = new Set((loaderData?.feedbackRecords || []).filter((f) => f.verdict && f.verdict !== "relevant").map((f) => f.opportunity_id));
  const detailSearchParams = { from: "discover", category: businessCategory.trim() || undefined, location: locationQuery.trim() || undefined, window: timeWindowDays, searchId: activeSearch?.id || undefined, examples: showExamples ? "1" : undefined, showDismissed: showDismissed ? "1" : undefined };

  const executeDiscoverySearch = async (forceRetry = false) => {
    if (isSearching) return;
    const cat = businessCategory.trim();
    const loc = locationQuery.trim();
    if (!cat || !loc) { setRequestError(t("discover.validationMissingFields")); return; }
    setIsSearching(true); setRequestError(""); setActionBanner(""); setShowExamples(false);
    trackLeadsEvent("search_started", { time_window_days: timeWindowDays, surface: "discover" });
    try {
      const res = await runSearchFn({ data: { business_category: cat, location_query: loc, time_window_days: timeWindowDays, force_retry: Boolean(forceRetry) } });
      const returnedSearch = res?.search || null;
      const returnedOpps = res?.opportunities || [];
      if (returnedSearch) setActiveSearch(returnedSearch);
      setLiveOpportunities(returnedOpps);
      if (res?.quota) setQuota(res.quota);
      setFromCacheInfo(res?.fromCache ? res.cachedAt || returnedSearch?.completed_at || returnedSearch?.executed_at : null);
      if (returnedSearch?.status === "failed") trackLeadsEvent("search_failed", { time_window_days: timeWindowDays, surface: "discover" });
      else trackLeadsEvent("search_completed", { time_window_days: timeWindowDays, results_count: returnedOpps.length, verified_count: returnedSearch?.verified_count ?? 0, needs_review_count: returnedSearch?.needs_review_count ?? 0, from_cache: Boolean(res?.fromCache), surface: "discover" });
      syncFilterUrlParams({ category: cat, location: loc, window: timeWindowDays, searchId: returnedSearch?.id, examples: false });
      await router.invalidate();
    } catch (err) {
      trackLeadsEvent("search_failed", { time_window_days: timeWindowDays, surface: "discover" });
      setRequestError(err?.message || t("discover.failedFallbackBody"));
    } finally { setIsSearching(false); }
  };
  const handleSaveOpportunity = async (opp) => {
    setBusyOppId(opp.id); setActionBanner("");
    try {
      await saveOppFn({ data: { opportunity_id: opp.id, service_fit_inference: buildServiceFitHypothesis(opp, selectedServices, serviceDescription, lang), inferred_service_categories: selectedServices } });
      trackLeadsEvent("opportunity_saved", { verification_status: opp.verification_status || "needs_review", action: "saved", surface: "discover_card" }, { opportunityId: opp.id });
      await router.invalidate(); setActionBanner(t("discover.savedBanner", { name: opp.business_name }));
    } catch (err) { setActionBanner(err?.message || "Could not save lead."); } finally { setBusyOppId(null); }
  };
  const handleUnsaveOpportunity = async (opp) => {
    setBusyOppId(opp.id); setActionBanner("");
    try {
      await unsaveOppFn({ data: { opportunity_id: opp.id } }); await router.invalidate();
      setActionBanner(t("discover.unsavedBanner", { name: opp.business_name }));
    } catch (err) { setActionBanner(err?.message || "Could not remove saved lead."); } finally { setBusyOppId(null); }
  };
  const handleDismissOpportunity = async (opp) => {
    setBusyOppId(opp.id); setActionBanner("");
    try {
      await feedbackFn({ data: { opportunity_id: opp.id, business_name: opp.business_name, verdict: "not_relevant", reason_category: "Not a fit for my services", reason_note: "Dismissed from Find leads" } });
      trackLeadsEvent("relevance_feedback_recorded", { verdict: "not_relevant", verification_status: opp.verification_status || "needs_review", has_reason_note: true, surface: "discover_card" }, { opportunityId: opp.id });
      await router.invalidate(); setActionBanner(t("discover.dismissedBanner", { name: opp.business_name }));
    } catch (err) { setActionBanner(err?.message || "Could not record feedback."); } finally { setBusyOppId(null); }
  };
  const handleRestoreOpportunity = async (opp) => {
    setBusyOppId(opp.id); setActionBanner("");
    try {
      await clearFeedbackFn({ data: { opportunity_id: opp.id } }); await router.invalidate();
      setActionBanner(t("discover.restoredBanner", { name: opp.business_name }));
    } catch (err) { setActionBanner(err?.message || "Could not restore lead."); } finally { setBusyOppId(null); }
  };
  const dismissedLiveOpps = liveOpportunities.filter((o) => dismissedOppIds.has(o.id));
  const activeLiveOpps = liveOpportunities.filter((o) => !dismissedOppIds.has(o.id));
  const verifiedOpps = activeLiveOpps.filter((o) => o.verification_status === "verified");
  const needsReviewOpps = activeLiveOpps.filter((o) => o.verification_status !== "verified");
  const visibleExamples = showExamples ? EXAMPLE_OPPORTUNITIES.filter((item) => !dismissedExampleIds.includes(item.id)).slice(0, 5) : [];
  const currentSearchStatus = isSearching ? "searching" : requestError || activeSearch?.status === "failed" ? "failed" : activeSearch?.status || (selectedServices.length === 0 ? "not_configured" : "ready");
  const toggleExamples = () => { const next = !showExamples; setShowExamples(next); syncFilterUrlParams({ examples: next }); };
  const toggleDismissed = () => { const next = !showDismissed; setShowDismissed(next); syncFilterUrlParams({ showDismissed: next }); };
  const isDefaultTestQuery = businessCategory.trim().toLowerCase() === "restaurants" && locationQuery.trim().toLowerCase().includes("miami") && timeWindowDays === 90;
  return { lang, outreachLang, t, profile, selectedServices, serviceDescription, businessCategory, setBusinessCategory, locationQuery, setLocationQuery, timeWindowDays, setTimeWindowDays, activeSearch, quota, fromCacheInfo, isSearching, requestError, actionBanner, setActionBanner, busyOppId, showExamples, showDismissed, setDismissedExampleIds, syncFilterUrlParams, savedOppIds, feedbackByOppId, detailSearchParams, executeDiscoverySearch, handleSaveOpportunity, handleUnsaveOpportunity, handleDismissOpportunity, handleRestoreOpportunity, dismissedLiveOpps, verifiedOpps, needsReviewOpps, visibleExamples, currentSearchStatus, toggleExamples, toggleDismissed, isDefaultTestQuery };
}