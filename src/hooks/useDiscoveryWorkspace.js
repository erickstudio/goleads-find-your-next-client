import { useState, useEffect, useMemo } from "react";
import { getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  EXAMPLE_OPPORTUNITIES,
  normalizeServicesList,
  buildServiceFitHypothesis,
} from "@/lib/leads-constants";
import {
  runLeadDiscoverySearch,
  saveOpportunityForUser,
  unsaveOpportunityForUser,
  recordOpportunityFeedback,
  clearOpportunityFeedback,
  batchDismissOpportunities,
  batchRestoreOpportunities,
} from "@/lib/server-fns";
import { usePreferences } from "@/lib/PreferencesContext";
import { trackLeadsEvent } from "@/lib/telemetry";

const workspaceRoute = getRouteApi("/_authed/app");

export default function useDiscoveryWorkspace() {
  const loaderData = workspaceRoute.useLoaderData();
  const searchParams = workspaceRoute.useSearch();
  const navigate = useNavigate({ from: "/app" });
  const router = useRouter();
  const { lang, outreachLang, syncFromProfile, t } = usePreferences();
  const isEs = lang === "es";

  const runSearchFn = useServerFn(runLeadDiscoverySearch);
  const saveOppFn = useServerFn(saveOpportunityForUser);
  const unsaveOppFn = useServerFn(unsaveOpportunityForUser);
  const feedbackFn = useServerFn(recordOpportunityFeedback);
  const clearFeedbackFn = useServerFn(clearOpportunityFeedback);
  const batchDismissFn = useServerFn(batchDismissOpportunities);
  const batchRestoreFn = useServerFn(batchRestoreOpportunities);

  const profile = loaderData?.profile;
  const selectedServices = normalizeServicesList(profile?.selected_services || []);
  const serviceDescription = profile?.service_description || "";
  const recentSearches = loaderData?.recentSearches || [];
  const allUserOpportunities = loaderData?.allUserOpportunities || [];

  useEffect(() => {
    if (profile) syncFromProfile(profile);
  }, [profile?.id]);

  useEffect(() => {
    document.title = t("discover.pageTitle");
  }, [lang, t]);

  const matchedSearchFromUrl = searchParams.searchId
    ? recentSearches.find((s) => s.id === searchParams.searchId)
    : null;
  const initialSearch = matchedSearchFromUrl || loaderData?.latestLiveSearch || null;
  const isBrandNewUser = !initialSearch && recentSearches.length === 0;

  const resolveOpportunitiesForSearch = (searchObj, oppsPool = allUserOpportunities) => {
    if (!searchObj) return [];
    const targetId = searchObj.cached_from_search_id || searchObj.id;
    const matches = oppsPool.filter((o) => o.search_id === targetId);
    if (matches.length > 0) return matches;
    return searchObj.id === loaderData?.latestLiveSearch?.id
      ? loaderData?.latestOpportunities || []
      : [];
  };

  const [businessCategory, setBusinessCategory] = useState(
    searchParams.category || initialSearch?.business_category || "Restaurants"
  );
  const [locationQuery, setLocationQuery] = useState(
    searchParams.location || initialSearch?.location_query || "Miami, FL, USA"
  );
  const [timeWindowDays, setTimeWindowDays] = useState(
    searchParams.window || initialSearch?.time_window_days || profile?.default_time_window_days || 90
  );
  const [searchMode, setSearchMode] = useState(initialSearch?.search_mode || "hybrid");
  const [localPlaces, setLocalPlaces] = useState([]);
  const [localSearchStatus, setLocalSearchStatus] = useState(null);
  const [activeSearch, setActiveSearch] = useState(initialSearch);
  const [liveOpportunities, setLiveOpportunities] = useState(() =>
    resolveOpportunitiesForSearch(initialSearch, allUserOpportunities)
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
  const [busyOppIds, setBusyOppIds] = useState([]);
  const [isBatchBusy, setIsBatchBusy] = useState(false);

  // Prepared demonstration defaults to visible for brand-new users with 0 searches so the screen is never empty
  const [showExamples, setShowExamples] = useState(() => {
    if (searchParams.examples === "1") return true;
    if (searchParams.examples === "0") return false;
    return isBrandNewUser;
  });
  const [showDismissed, setShowDismissed] = useState(searchParams.showDismissed === "1");

  // Multi-select state (strictly scoped to stable record IDs, reset whenever search changes)
  const [selectedOppIds, setSelectedOppIds] = useState([]);

  // Isolated demo state for the 3 fictional example records
  const [dismissedExampleIds, setDismissedExampleIds] = useState([]);
  const [savedExampleIds, setSavedExampleIds] = useState([]);
  const [selectedExampleIds, setSelectedExampleIds] = useState([]);

  // Optimistic overrides keyed by opportunity_id so single/batch operations only touch targeted IDs
  const [optimisticDismissedMap, setOptimisticDismissedMap] = useState({});
  const [optimisticSavedMap, setOptimisticSavedMap] = useState({});

  // Sync activeSearch when searchParams.searchId changes
  useEffect(() => {
    if (searchParams.searchId) {
      const found = (loaderData?.recentSearches || []).find(
        (s) => s.id === searchParams.searchId
      );
      if (found && found.id !== activeSearch?.id) {
        setActiveSearch(found);
        setLiveOpportunities(
          resolveOpportunitiesForSearch(found, loaderData?.allUserOpportunities || [])
        );
        setBusinessCategory(found.business_category || "Restaurants");
        setLocationQuery(found.location_query || "Miami, FL, USA");
        setTimeWindowDays(found.time_window_days || 90);
      }
    }
  }, [searchParams.searchId, loaderData?.recentSearches]);

  useEffect(() => {
    if (!activeSearch) return;
    const targetId = activeSearch.cached_from_search_id || activeSearch.id;
    const freshMatches = (loaderData?.allUserOpportunities || []).filter(
      (o) => o.search_id === targetId
    );
    if (freshMatches.length > 0) setLiveOpportunities(freshMatches);
  }, [loaderData?.allUserOpportunities, activeSearch?.id]);

  // Clear selection whenever the active search or demo mode changes
  useEffect(() => {
    setSelectedOppIds([]);
    setSelectedExampleIds([]);
  }, [activeSearch?.id, searchParams.searchId, showExamples]);

  const syncFilterUrlParams = (overrides = {}) => {
    const nextCat = overrides.category !== undefined ? overrides.category : businessCategory;
    const nextLoc = overrides.location !== undefined ? overrides.location : locationQuery;
    const nextWin = overrides.window !== undefined ? overrides.window : timeWindowDays;
    const nextSearchId = overrides.searchId !== undefined ? overrides.searchId : activeSearch?.id;
    const nextExamples = overrides.examples !== undefined ? overrides.examples : showExamples;
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

  const savedOppIds = useMemo(() => {
    const set = new Set((loaderData?.savedOpportunities || []).map((s) => s.opportunity_id));
    for (const [oppId, isSaved] of Object.entries(optimisticSavedMap)) {
      if (isSaved) set.add(oppId);
      else set.delete(oppId);
    }
    return set;
  }, [loaderData?.savedOpportunities, optimisticSavedMap]);

  const feedbackByOppId = useMemo(
    () => new Map((loaderData?.feedbackRecords || []).map((f) => [f.opportunity_id, f])),
    [loaderData?.feedbackRecords]
  );

  const dismissedOppIds = useMemo(() => {
    const set = new Set(
      (loaderData?.feedbackRecords || [])
        .filter((f) => f.verdict && f.verdict !== "relevant")
        .map((f) => f.opportunity_id)
    );
    for (const [oppId, isDismissed] of Object.entries(optimisticDismissedMap)) {
      if (isDismissed) set.add(oppId);
      else set.delete(oppId);
    }
    return set;
  }, [loaderData?.feedbackRecords, optimisticDismissedMap]);

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
    setLocalPlaces([]);
    setLocalSearchStatus(null);
    setIsSearching(true);
    setRequestError("");
    setActionBanner("");
    setShowExamples(false);
    setSelectedOppIds([]);
    setSelectedExampleIds([]);
    trackLeadsEvent("search_started", { time_window_days: timeWindowDays, surface: "discover" });
    try {
      const res = await runSearchFn({
        data: {
          business_category: cat,
          location_query: loc,
          time_window_days: timeWindowDays,
          force_retry: Boolean(forceRetry),
          mode: searchMode,
        },
      });
      const returnedSearch = res?.search || null;
      const returnedOpps = res?.opportunities || [];
      if (returnedSearch) setActiveSearch(returnedSearch);
      setLiveOpportunities(returnedOpps);
      setLocalPlaces(res?.localPlaces || []);
      setLocalSearchStatus(res?.localSearchStatus || "not_requested");
      if (res?.quota) setQuota(res.quota);
      setFromCacheInfo(
        res?.fromCache
          ? res.cachedAt || returnedSearch?.completed_at || returnedSearch?.executed_at
          : null
      );
      if (returnedSearch?.status === "failed") {
        trackLeadsEvent("search_failed", { time_window_days: timeWindowDays, surface: "discover" });
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
      trackLeadsEvent("search_failed", { time_window_days: timeWindowDays, surface: "discover" });
      setRequestError(err?.message || t("discover.failedFallbackBody"));
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveOpportunity = async (opp) => {
    if (!opp?.id || busyOppId === opp.id) return;
    if (opp.is_example || String(opp.id).startsWith("demo-")) {
      setSavedExampleIds((prev) => (prev.includes(opp.id) ? prev : [...prev, opp.id]));
      setActionBanner(
        isEs
          ? `Demostración: marcaste «${opp.business_name}» como guardado en esta vista de ejemplo (no altera tus leads reales).`
          : `Demo: marked "${opp.business_name}" as saved in this example view (does not alter your live leads).`
      );
      return;
    }
    setBusyOppId(opp.id);
    setActionBanner("");
    setOptimisticSavedMap((prev) => ({ ...prev, [opp.id]: true }));
    try {
      await saveOppFn({
        data: {
          opportunity_id: opp.id,
          service_fit_inference: buildServiceFitHypothesis(
            opp,
            selectedServices,
            serviceDescription,
            lang
          ),
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
      setOptimisticSavedMap((prev) => {
        const next = { ...prev };
        delete next[opp.id];
        return next;
      });
      setActionBanner(err?.message || "Could not save lead.");
    } finally {
      setBusyOppId(null);
    }
  };

  const handleUnsaveOpportunity = async (opp) => {
    if (!opp?.id || busyOppId === opp.id) return;
    if (opp.is_example || String(opp.id).startsWith("demo-")) {
      setSavedExampleIds((prev) => prev.filter((id) => id !== opp.id));
      setActionBanner(
        isEs
          ? `Demostración: quitaste «${opp.business_name}» de guardados en esta vista de ejemplo.`
          : `Demo: removed "${opp.business_name}" from saved in this example view.`
      );
      return;
    }
    setBusyOppId(opp.id);
    setActionBanner("");
    setOptimisticSavedMap((prev) => ({ ...prev, [opp.id]: false }));
    try {
      await unsaveOppFn({ data: { opportunity_id: opp.id } });
      await router.invalidate();
      setActionBanner(t("discover.unsavedBanner", { name: opp.business_name }));
    } catch (err) {
      setOptimisticSavedMap((prev) => {
        const next = { ...prev };
        delete next[opp.id];
        return next;
      });
      setActionBanner(err?.message || "Could not remove saved lead.");
    } finally {
      setBusyOppId(null);
    }
  };

  const handleDismissOpportunity = async (opp) => {
    if (!opp?.id || busyOppId === opp.id || isBatchBusy) return;
    if (opp.is_example || String(opp.id).startsWith("demo-")) {
      setDismissedExampleIds((prev) => (prev.includes(opp.id) ? prev : [...prev, opp.id]));
      setSelectedExampleIds((prev) => prev.filter((id) => id !== opp.id));
      setActionBanner(
        isEs
          ? `Demostración: se descartó «${opp.business_name}» (puedes restaurarlo en esta demostración).`
          : `Demo: dismissed "${opp.business_name}" (you can restore it in this demo).`
      );
      return;
    }
    setBusyOppId(opp.id);
    setActionBanner("");
    setOptimisticDismissedMap((prev) => ({ ...prev, [opp.id]: true }));
    setSelectedOppIds((prev) => prev.filter((id) => id !== opp.id));
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
      setOptimisticDismissedMap((prev) => {
        const next = { ...prev };
        delete next[opp.id];
        return next;
      });
      setActionBanner(err?.message || "Could not record feedback.");
    } finally {
      setBusyOppId(null);
    }
  };

  const handleRestoreOpportunity = async (opp) => {
    if (!opp?.id || busyOppId === opp.id || isBatchBusy) return;
    if (opp.is_example || String(opp.id).startsWith("demo-")) {
      setDismissedExampleIds((prev) => prev.filter((id) => id !== opp.id));
      setSelectedExampleIds((prev) => prev.filter((id) => id !== opp.id));
      setActionBanner(
        isEs
          ? `Demostración: se restauró «${opp.business_name}» a los ejemplos activos.`
          : `Demo: restored "${opp.business_name}" to active examples.`
      );
      return;
    }
    setBusyOppId(opp.id);
    setActionBanner("");
    setOptimisticDismissedMap((prev) => ({ ...prev, [opp.id]: false }));
    setSelectedOppIds((prev) => prev.filter((id) => id !== opp.id));
    try {
      await clearFeedbackFn({ data: { opportunity_id: opp.id } });
      await router.invalidate();
      setActionBanner(t("discover.restoredBanner", { name: opp.business_name }));
    } catch (err) {
      setOptimisticDismissedMap((prev) => {
        const next = { ...prev };
        delete next[opp.id];
        return next;
      });
      setActionBanner(err?.message || "Could not restore lead.");
    } finally {
      setBusyOppId(null);
    }
  };

  const dismissedLiveOpps = liveOpportunities.filter((o) => dismissedOppIds.has(o.id));
  const activeLiveOpps = liveOpportunities.filter((o) => !dismissedOppIds.has(o.id));
  const verifiedOpps = activeLiveOpps.filter((o) => o.verification_status === "verified");
  const needsReviewOpps = activeLiveOpps.filter((o) => o.verification_status !== "verified");

  const visibleActiveIds = useMemo(
    () => activeLiveOpps.map((o) => o.id),
    [activeLiveOpps]
  );

  const toggleSelectOpportunity = (oppId) => {
    if (!oppId) return;
    setSelectedOppIds((prev) =>
      prev.includes(oppId) ? prev.filter((id) => id !== oppId) : [...prev, oppId]
    );
  };

  const selectAllVisibleActive = () => {
    const allSelected =
      visibleActiveIds.length > 0 &&
      visibleActiveIds.every((id) => selectedOppIds.includes(id));
    if (allSelected) {
      setSelectedOppIds((prev) => prev.filter((id) => !visibleActiveIds.includes(id)));
    } else {
      setSelectedOppIds((prev) => Array.from(new Set([...prev, ...visibleActiveIds])));
    }
  };

  const clearSelection = () => {
    setSelectedOppIds([]);
  };

  const handleBatchDismissSelected = async () => {
    const targetIds = selectedOppIds.filter((id) => !dismissedOppIds.has(id));
    if (targetIds.length === 0 || isBatchBusy) return;

    setIsBatchBusy(true);
    setBusyOppIds(targetIds);
    setActionBanner("");
    setOptimisticDismissedMap((prev) => {
      const next = { ...prev };
      for (const id of targetIds) next[id] = true;
      return next;
    });

    try {
      const res = await batchDismissFn({
        data: {
          opportunity_ids: targetIds,
          reason_category: "Not a fit for my services",
          reason_note: "Batch dismissed from Find leads",
        },
      });
      const updatedCount = res?.updatedCount ?? 0;
      const failedCount = res?.failedCount ?? 0;
      const failedSet = new Set((res?.failedIds || []).map((f) => f.id));

      if (failedSet.size > 0) {
        setOptimisticDismissedMap((prev) => {
          const next = { ...prev };
          for (const fId of failedSet) delete next[fId];
          return next;
        });
      }

      setSelectedOppIds((prev) => prev.filter((id) => failedSet.has(id)));
      await router.invalidate();

      if (failedCount > 0) {
        setActionBanner(
          isEs
            ? `Se descartaron ${updatedCount} lead(s); ${failedCount} no pudieron procesarse.`
            : `Dismissed ${updatedCount} lead(s); ${failedCount} could not be processed.`
        );
      } else {
        setActionBanner(
          isEs
            ? `Se descartaron ${updatedCount} lead(s) seleccionado(s). Puedes verlos o restaurarlos con «Mostrar descartados».`
            : `Dismissed ${updatedCount} selected lead(s). You can view or restore them using "Show dismissed".`
        );
      }
    } catch (err) {
      setOptimisticDismissedMap((prev) => {
        const next = { ...prev };
        for (const id of targetIds) delete next[id];
        return next;
      });
      setActionBanner(err?.message || "Could not dismiss selected leads.");
    } finally {
      setIsBatchBusy(false);
      setBusyOppIds([]);
    }
  };

  const handleBatchRestoreSelected = async () => {
    const targetIds = selectedOppIds.filter((id) => dismissedOppIds.has(id));
    if (targetIds.length === 0 || isBatchBusy) return;

    setIsBatchBusy(true);
    setBusyOppIds(targetIds);
    setActionBanner("");
    setOptimisticDismissedMap((prev) => {
      const next = { ...prev };
      for (const id of targetIds) next[id] = false;
      return next;
    });

    try {
      const res = await batchRestoreFn({
        data: { opportunity_ids: targetIds },
      });
      const restoredCount = res?.restoredCount ?? 0;
      const failedCount = res?.failedCount ?? 0;
      const failedSet = new Set((res?.failedIds || []).map((f) => f.id));

      if (failedSet.size > 0) {
        setOptimisticDismissedMap((prev) => {
          const next = { ...prev };
          for (const fId of failedSet) delete next[fId];
          return next;
        });
      }

      setSelectedOppIds((prev) => prev.filter((id) => failedSet.has(id)));
      await router.invalidate();

      if (failedCount > 0) {
        setActionBanner(
          isEs
            ? `Se restauraron ${restoredCount} lead(s); ${failedCount} no pudieron procesarse.`
            : `Restored ${restoredCount} lead(s); ${failedCount} could not be processed.`
        );
      } else {
        setActionBanner(
          isEs
            ? `Se restauraron ${restoredCount} lead(s) a los resultados activos.`
            : `Restored ${restoredCount} lead(s) to active results.`
        );
      }
    } catch (err) {
      setOptimisticDismissedMap((prev) => {
        const next = { ...prev };
        for (const id of targetIds) delete next[id];
        return next;
      });
      setActionBanner(err?.message || "Could not restore selected leads.");
    } finally {
      setIsBatchBusy(false);
      setBusyOppIds([]);
    }
  };

  const visibleExamples = showExamples
    ? EXAMPLE_OPPORTUNITIES.filter((item) => !dismissedExampleIds.includes(item.id))
    : [];
  const dismissedExamples = showExamples
    ? EXAMPLE_OPPORTUNITIES.filter((item) => dismissedExampleIds.includes(item.id))
    : [];

  const currentSearchStatus = isSearching
    ? "searching"
    : requestError || activeSearch?.status === "failed"
    ? "failed"
    : activeSearch?.status || (selectedServices.length === 0 ? "not_configured" : "ready");

  const toggleExamples = () => {
    const next = !showExamples;
    setShowExamples(next);
    syncFilterUrlParams({ examples: next });
  };

  const startOwnSearch = () => {
    setShowExamples(false);
    syncFilterUrlParams({ examples: false });
    if (typeof document !== "undefined") {
      setTimeout(() => {
        const inputEl = document.getElementById("business-category");
        if (inputEl) {
          inputEl.focus();
          inputEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 60);
    }
  };

  const toggleDismissed = () => {
    const next = !showDismissed;
    setShowDismissed(next);
    syncFilterUrlParams({ showDismissed: next });
  };

  const isDefaultTestQuery =
    businessCategory.trim().toLowerCase() === "restaurants" &&
    locationQuery.trim().toLowerCase().includes("miami") &&
    timeWindowDays === 90;

  return {
    lang,
    searchMode, setSearchMode, localPlaces, localSearchStatus,
    outreachLang,
    t,
    profile,
    selectedServices,
    serviceDescription,
    businessCategory,
    setBusinessCategory,
    locationQuery,
    setLocationQuery,
    timeWindowDays,
    setTimeWindowDays,
    activeSearch,
    quota,
    fromCacheInfo,
    isSearching,
    requestError,
    actionBanner,
    setActionBanner,
    busyOppId,
    busyOppIds,
    isBatchBusy,
    showExamples,
    showDismissed,
    selectedOppIds,
    toggleSelectOpportunity,
    selectAllVisibleActive,
    clearSelection,
    handleBatchDismissSelected,
    handleBatchRestoreSelected,
    visibleActiveIds,
    dismissedExampleIds,
    setDismissedExampleIds,
    savedExampleIds,
    selectedExampleIds,
    setSelectedExampleIds,
    syncFilterUrlParams,
    savedOppIds,
    dismissedOppIds,
    feedbackByOppId,
    detailSearchParams,
    executeDiscoverySearch,
    handleSaveOpportunity,
    handleUnsaveOpportunity,
    handleDismissOpportunity,
    handleRestoreOpportunity,
    dismissedLiveOpps,
    activeLiveOpps,
    verifiedOpps,
    needsReviewOpps,
    visibleExamples,
    dismissedExamples,
    currentSearchStatus,
    toggleExamples,
    startOwnSearch,
    toggleDismissed,
    isDefaultTestQuery,
  };
}