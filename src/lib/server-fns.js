import { isOwnerAccount } from "@/lib/owner-access.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { getPayPalServerConfig } from "@/lib/paypal-billing.server";
import { planAccessForSubscriptions } from "@/lib/plan-policy";
import {
  searchGoogleLocalBusinesses,
  correlateAndEnrichWithGooglePlaces,
} from "@/lib/google-local.server";
import {
  isPayPalSubscriptionAllowanceActive,
  isProAccessGrantActive,
  loadActiveUserProGrants,
} from "@/lib/subscription-access";
import {
  SEARCH_LIMITS,
  buildQueryCacheKey,
  normalizeServicesList,
  buildServiceFitHypothesis,
} from "@/lib/leads-constants";
import {
  queryBuiltInWebSearchWithRetry,
  verifyAndStructureCandidates,
} from "@/lib/discovery.server";

const CustomServiceSchema = z
  .string()
  .trim()
  .min(1, "Service name cannot be empty")
  .max(80, "Keep service names under 80 characters");

// Per-isolate in-flight deduplication and concurrency guard keyed by userId
const activeUserSearches = new Map();

export function computeQuotaUsage(
  searches = [],
  nowMs = Date.now(),
  pilotEnrollments = [],
  paypalSubscriptions = [],
  ownerAccess = false,
  complimentaryGrants = []
) {
  const windowStartMs = nowMs - SEARCH_LIMITS.cacheTtlMs;
  const quotaSearches = searches.filter((s) => {
    if (s.status === "not_configured" || s.status === "failed") return false;
    if (s.counts_toward_quota === false) return false;
    if (s.cached_from_search_id) return false;
    const ts = new Date(s.executed_at || s.created_date || 0).getTime();
    return !Number.isNaN(ts) && ts >= windowStartMs;
  });

  // 1. Server-verified Stripe one-time pilot enrollments that have not expired
  const activeVerifiedEnrollments = (pilotEnrollments || []).filter((e) => {
    if (e.payment_status !== "paid_verified") return false;
    if (e.expires_at_iso) {
      const expMs = new Date(e.expires_at_iso).getTime();
      if (!Number.isNaN(expMs) && expMs <= nowMs) return false;
    }
    return true;
  });

  const pilotGrantedTotal = activeVerifiedEnrollments.reduce(
    (sum, e) => sum + Math.max(0, Number(e.granted_search_allowance) || 0),
    0
  );
  const pilotUsedTotal = activeVerifiedEnrollments.reduce(
    (sum, e) => sum + Math.max(0, Number(e.used_pilot_searches) || 0),
    0
  );
  const pilotRemaining = Math.max(0, pilotGrantedTotal - pilotUsedTotal);

  // 2. Server-verified PayPal subscriptions (active, trialing, or cancelled with paid period still active)
  const activeVerifiedSubscriptions = (paypalSubscriptions || []).filter((sub) =>
    isPayPalSubscriptionAllowanceActive(sub, nowMs)
  );

  const activeComplimentaryGrants = (complimentaryGrants || []).filter((g) =>
    isProAccessGrantActive(g, nowMs)
  );
  const compGrantedTotal = activeComplimentaryGrants.reduce(
    (sum, g) => sum + Math.max(0, Number(g.granted_search_allowance) || 0),
    0
  );
  const compUsedTotal = activeComplimentaryGrants.reduce(
    (sum, g) => sum + Math.max(0, Number(g.used_searches) || 0),
    0
  );
  const compRemaining = Math.max(0, compGrantedTotal - compUsedTotal);

  const subscriptionGrantedTotal =
    activeVerifiedSubscriptions.reduce(
      (sum, s) => sum + Math.max(0, Number(s.granted_search_allowance) || 0),
      0
    ) + compGrantedTotal;
  const subscriptionUsedTotal =
    activeVerifiedSubscriptions.reduce(
      (sum, s) => sum + Math.max(0, Number(s.used_subscription_searches) || 0),
      0
    ) + compUsedTotal;
  const subscriptionRemaining = Math.max(
    0,
    subscriptionGrantedTotal - subscriptionUsedTotal
  );

  const used = quotaSearches.length;
  const baseRemainingToday = Math.max(0, SEARCH_LIMITS.maxDailyNewSearches - used);

  return {
    usedToday: used,
    maxDaily: SEARCH_LIMITS.maxDailyNewSearches,
    baseRemainingToday,
    pilotGrantedTotal: pilotGrantedTotal + subscriptionGrantedTotal,
    pilotUsedTotal: pilotUsedTotal + subscriptionUsedTotal,
    pilotRemaining: pilotRemaining + subscriptionRemaining,
    stripePilotRemaining: pilotRemaining,
    complimentaryRemaining: compRemaining,
    subscriptionGrantedTotal,
    subscriptionUsedTotal,
    subscriptionRemaining,
    remainingToday: ownerAccess ? Number.MAX_SAFE_INTEGER : baseRemainingToday + pilotRemaining + subscriptionRemaining,
    ...planAccessForSubscriptions(paypalSubscriptions, nowMs, {
      isOwner: ownerAccess,
      complimentaryGrants: activeComplimentaryGrants,
    }),
    maxConcurrentSearches: SEARCH_LIMITS.maxConcurrentSearches,
    cacheTtlHours: SEARCH_LIMITS.cacheTtlHours,
  };
}

function assertRecordOwnedByUser(record, userId, entityLabel = "Record") {
  if (!record) {
    throw new Error(`${entityLabel} not found in your account.`);
  }
  const matchesCreator = record.created_by_id === userId;
  const matchesOwner = !record.owner_id || record.owner_id === userId;
  if (!matchesCreator || !matchesOwner) {
    throw new Error(`Forbidden: You do not have access to this ${entityLabel.toLowerCase()}.`);
  }
}

function deduplicateByOpportunityId(records = []) {
  const seen = new Set();
  const unique = [];
  for (const rec of records) {
    const key = rec?.opportunity_id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(rec);
  }
  return unique;
}

export const getWorkspaceBootstrap = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;
    const userEmail = context.user.email || "";

    const [profilesPage, searchesPage, savedPage, feedbackPage, enrollmentsPage, subsPage] = await Promise.all([
      base44.entities.UserProfile.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 1 }
      ),
      base44.entities.LeadSearch.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 25 }
      ),
      base44.entities.SavedOpportunity.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 50 }
      ),
      base44.entities.OpportunityFeedback.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 100 }
      ),
      base44.entities.PilotEnrollment.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 20 }
      ),
      base44.entities.PayPalSubscription.filter(
        { owner_id: userId },
        { sort: "-created_date", limit: 20 }
      ),
    ]);

    const rawProfile = (profilesPage?.items || []).find(
      (p) => p.created_by_id === userId && (!p.owner_id || p.owner_id === userId)
    ) || null;
    let profile = null;

    if (rawProfile) {
      const migratedServices = normalizeServicesList(rawProfile.selected_services || []);
      const needsMigration =
        JSON.stringify(migratedServices) !== JSON.stringify(rawProfile.selected_services || []);
      if (needsMigration && migratedServices.length > 0) {
        profile = await base44.entities.UserProfile.update(rawProfile.id, {
          selected_services: migratedServices,
        });
      } else {
        profile = {
          ...rawProfile,
          selected_services: migratedServices,
        };
      }
    }

    const recentSearches = (searchesPage?.items || []).filter(
      (s) => s.created_by_id === userId && (!s.owner_id || s.owner_id === userId)
    );
    const latestLiveSearch =
      recentSearches.find((s) => s.status !== "not_configured") || null;

    const [oppsPage, evidencePage] = await Promise.all([
      base44.entities.Opportunity.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 50 }
      ),
      base44.entities.EvidenceItem.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 100 }
      ),
    ]);
    const ownedEvidence = (evidencePage?.items || []).filter(
      (e) => e.created_by_id === userId && (!e.owner_id || e.owner_id === userId)
    );
    const evidenceByOppId = new Map();
    for (const ev of ownedEvidence) {
      if (!ev.opportunity_id) continue;
      if (!evidenceByOppId.has(ev.opportunity_id)) {
        evidenceByOppId.set(ev.opportunity_id, []);
      }
      evidenceByOppId.get(ev.opportunity_id).push(ev);
    }

    const allUserOpportunities = (oppsPage?.items || [])
      .filter((o) => o.created_by_id === userId && (!o.owner_id || o.owner_id === userId))
      .map((o) => ({
        ...o,
        evidence_items: evidenceByOppId.get(o.id) || [],
      }));

    let latestOpportunities = [];
    if (latestLiveSearch) {
      const targetSearchId = latestLiveSearch.cached_from_search_id || latestLiveSearch.id;
      latestOpportunities = allUserOpportunities
        .filter((o) => o.search_id === targetSearchId)
        .slice(0, 20);
    }

    const ownedSaved = deduplicateByOpportunityId(
      (savedPage?.items || []).filter(
        (s) => s.created_by_id === userId && (!s.owner_id || s.owner_id === userId)
      )
    );

    const ownedFeedback = deduplicateByOpportunityId(
      (feedbackPage?.items || []).filter(
        (f) => f.created_by_id === userId && (!f.owner_id || f.owner_id === userId)
      )
    );

    const ownedEnrollments = (enrollmentsPage?.items || []).filter(
      (e) => e.created_by_id === userId && (!e.owner_id || e.owner_id === userId)
    );
    const paymentConfig = getPayPalServerConfig();
    const ownedSubscriptions = (subsPage?.items || []).filter(
      (s) => s.owner_id === userId && s.paypal_environment === paymentConfig.env && s.paypal_plan_id === paymentConfig.planId
    );
    const complimentaryGrants = await loadActiveUserProGrants(base44, context.user);
    const quota = computeQuotaUsage(
      recentSearches,
      Date.now(),
      ownedEnrollments,
      ownedSubscriptions,
      isOwnerAccount(context.user),
      complimentaryGrants
    );

    return {
      user: {
        id: userId,
        email: userEmail,
        full_name: context.user.full_name || "",
        role: context.user.role || "user",
      },
      profile,
      recentSearches,
      latestLiveSearch,
      latestOpportunities: latestOpportunities.slice(0, quota.maxResultsPerSearch),
      allUserOpportunities,
      savedOpportunities: ownedSaved,
      feedbackRecords: ownedFeedback,
      quota,
      liveSearchConnected: true,
    };
  });

export const runLeadDiscoverySearch = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      business_category: z
        .string()
        .trim()
        .min(2, "Enter a business category or sector")
        .max(120, "Keep business category under 120 characters"),
      location_query: z
        .string()
        .trim()
        .min(2, "Enter a city or country")
        .max(120, "Keep location under 120 characters"),
      time_window_days: z.union([z.literal(30), z.literal(90), z.literal(180)]),
      force_retry: z.boolean().optional(),
      mode: z.enum(["hybrid", "web", "local"]).default("hybrid"),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;
    const now = new Date();
    const nowMs = now.getTime();
    const nowIso = now.toISOString();

    const businessCategory = data.business_category.trim();
    const locationQuery = data.location_query.trim();
    const timeWindowDays = data.time_window_days;
    const mode = data.mode;
    let queryCacheKey = `${mode}:` + buildQueryCacheKey(
      businessCategory,
      locationQuery,
      timeWindowDays
    );

    // 1. Check in-memory active search lock for this user
    const inFlight = activeUserSearches.get(userId);
    if (inFlight) {
      if (inFlight.queryCacheKey === queryCacheKey) {
        return await inFlight.promise;
      }
      throw new Error(
        "You already have a search in progress (limit: 1 concurrent search). Please wait for it to finish."
      );
    }

    // 2. Load user profile, recent searches, pilot enrollments, and PayPal subscriptions for cache, concurrency, and quota checks
    const [profilesPage, searchesPage, enrollmentsPage, subsPage] = await Promise.all([
      base44.entities.UserProfile.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 1 }
      ),
      base44.entities.LeadSearch.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 30 }
      ),
      base44.entities.PilotEnrollment.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 20 }
      ),
      base44.entities.PayPalSubscription.filter(
        { owner_id: userId },
        { sort: "-created_date", limit: 20 }
      ),
    ]);

    const rawProfile = (profilesPage?.items || []).find(
      (p) => p.created_by_id === userId && (!p.owner_id || p.owner_id === userId)
    ) || null;
    const selectedServices = normalizeServicesList(rawProfile?.selected_services || []);
    const serviceDescription = rawProfile?.service_description || "";
    const recentSearches = (searchesPage?.items || []).filter(
      (s) => s.created_by_id === userId && (!s.owner_id || s.owner_id === userId)
    );
    const ownedEnrollments = (enrollmentsPage?.items || []).filter(
      (e) => e.created_by_id === userId && (!e.owner_id || e.owner_id === userId)
    );
    const paymentConfig = getPayPalServerConfig();
    const ownedSubscriptions = (subsPage?.items || []).filter(
      (s) => s.owner_id === userId && s.paypal_environment === paymentConfig.env && s.paypal_plan_id === paymentConfig.planId
    );
    const complimentaryGrants = await loadActiveUserProGrants(base44, context.user, nowMs);

    const planAccess = planAccessForSubscriptions(ownedSubscriptions, nowMs, {
      isOwner: isOwnerAccount(context.user),
      complimentaryGrants,
    });
    queryCacheKey += `:${planAccess.maxResultsPerSearch}`;

    // Check DB-level concurrent search within last 35 seconds
    const activeDbSearch = recentSearches.find((s) => {
      if (s.status !== "searching") return false;
      const age = nowMs - new Date(s.executed_at || s.created_date || 0).getTime();
      return age >= 0 && age < 35000;
    });
    if (activeDbSearch && activeDbSearch.query_cache_key !== queryCacheKey) {
      throw new Error(
        "You already have a search in progress (limit: 1 concurrent search). Please wait for it to finish."
      );
    }

    // 3. Check 24-hour private per-user query cache
    const cacheCutoffMs = nowMs - SEARCH_LIMITS.cacheTtlMs;
    const cachedSearch = recentSearches.find((s) => {
      if (mode !== "web" || s.query_cache_key !== queryCacheKey) return false;
      if (!["completed", "partial", "empty"].includes(s.status)) return false;
      if (s.cached_from_search_id) return false;
      const ts = new Date(s.completed_at || s.executed_at || s.created_date || 0).getTime();
      return !Number.isNaN(ts) && ts >= cacheCutoffMs;
    });

    if (cachedSearch) {
      const cachedOppsPage = await base44.entities.Opportunity.filter(
        { created_by_id: userId, search_id: cachedSearch.id },
        { sort: "-created_date", limit: planAccess.maxResultsPerSearch }
      );
      const cachedOpportunities = (cachedOppsPage?.items || []).filter(
        (o) => o.created_by_id === userId && (!o.owner_id || o.owner_id === userId)
      );
      const quota = computeQuotaUsage(
        recentSearches,
        nowMs,
        ownedEnrollments,
        ownedSubscriptions,
        isOwnerAccount(context.user),
        complimentaryGrants
      );

      return {
        search: cachedSearch,
        opportunities: cachedOpportunities,
        fromCache: true,
        cachedAt: cachedSearch.completed_at || cachedSearch.executed_at,
        quota,
      };
    }

    // 4. Enforce daily limit + verified pilot/subscription research allowance
    const quotaBefore = computeQuotaUsage(
      recentSearches,
      nowMs,
      ownedEnrollments,
      ownedSubscriptions,
      isOwnerAccount(context.user),
      complimentaryGrants
    );
    if (!quotaBefore.unlimitedSearches && quotaBefore.remainingToday <= 0) {
      throw new Error(
        `Search allowance reached (${quotaBefore.usedToday} of ${quotaBefore.maxDaily} daily searches used${
          quotaBefore.pilotGrantedTotal > 0
            ? `, and ${quotaBefore.pilotUsedTotal} of ${quotaBefore.pilotGrantedTotal} pilot searches used`
            : ""
        }). Identical queries run in the last 24 hours remain available from your private cache.`
      );
    }

    // 5. Execute live search under per-user concurrency lock
    const runPromise = (async () => {
      const startTime = Date.now();
      const searchRecord = await base44.entities.LeadSearch.create({
        owner_id: userId,
        business_category: businessCategory,
        location_query: locationQuery,
        time_window_days: timeWindowDays,
        query_cache_key: queryCacheKey,
        search_mode: mode,
        selected_services_snapshot: selectedServices,
        service_description_snapshot: serviceDescription,
        status: "searching",
        honest_status_reason:
          "Searching public web announcements and verifying source content...",
        results_count: 0,
        verified_count: 0,
        needs_review_count: 0,
        counts_toward_quota: true,
        executed_at: nowIso,
      });

      try {
        // One Places request per explicit search; no Places content is persisted in lead entities.
        const [web, local] = await Promise.allSettled([
          mode === "local" ? Promise.resolve({ candidates: [], attemptsUsed: 0 }) : queryBuiltInWebSearchWithRetry(base44, {
            businessCategory, locationQuery, timeWindowDays, nowIso, maxResults: mode === "hybrid" ? Math.ceil(planAccess.maxResultsPerSearch / 2) : planAccess.maxResultsPerSearch,
          }),
          mode === "web" ? Promise.resolve({ status: "not_requested", places: [] }) : searchGoogleLocalBusinesses(base44, {
            businessCategory, locationQuery, maxResults: mode === "hybrid" ? Math.floor(planAccess.maxResultsPerSearch / 2) : planAccess.maxResultsPerSearch,
          }),
        ]);
        const localResult = local.status === "fulfilled" ? local.value : { status: "unavailable", places: [] };
        if ((mode === "local" && localResult.status === "unavailable") || (web.status === "rejected" && localResult.status !== "ok")) {
          throw new Error("La búsqueda no está disponible en este momento. Inténtalo de nuevo. / Search is temporarily unavailable. Please try again.");
        }
        const { candidates, attemptsUsed } = web.status === "fulfilled" ? web.value : { candidates: [], attemptsUsed: 0 };
        const { allOpportunities, verifiedCount, needsReviewCount } = await verifyAndStructureCandidates({
          rawCandidates: candidates, businessCategory, locationQuery, timeWindowDays, selectedServices,
          serviceDescription, nowDate: now, maxResults: mode === "hybrid" ? Math.ceil(planAccess.maxResultsPerSearch / 2) : planAccess.maxResultsPerSearch,
        });

        const correlated = await correlateAndEnrichWithGooglePlaces(base44, {
          opportunities: allOpportunities,
          localPlaces: localResult.places || [],
          businessCategory,
          locationQuery,
        });
        const enrichedOpportunities = correlated.opportunities;
        const enrichedLocalPlaces = correlated.localPlaces;

        const savedOpportunityRecords = [];
        for (const oppDraft of enrichedOpportunities) {
          const createdOpp = await base44.entities.Opportunity.create({
            owner_id: userId,
            search_id: searchRecord.id,
            business_name: oppDraft.business_name,
            business_category: oppDraft.business_category,
            location: oppDraft.location,
            website_url: oppDraft.website_url,
            public_email: oppDraft.public_email || "",
            public_phone: oppDraft.public_phone || "",
            place_id: oppDraft.place_id || "",
            place_name: oppDraft.place_name || "",
            place_address: oppDraft.place_address || "",
            place_url: oppDraft.place_url || "",
            place_business_status: oppDraft.place_business_status || "",
            signal_type: oppDraft.signal_type,
            signal_summary: oppDraft.signal_summary,
            source_title: oppDraft.source_title,
            source_url: oppDraft.source_url,
            supporting_excerpt: oppDraft.supporting_excerpt,
            publication_date: oppDraft.publication_date,
            event_date: oppDraft.event_date,
            retrieval_date: oppDraft.retrieval_date,
            recency_basis: oppDraft.recency_basis,
            verification_status: oppDraft.verification_status,
            verification_notes: oppDraft.verification_notes,
            evidence_status: oppDraft.evidence_status,
            inferred_service_categories: oppDraft.inferred_service_categories,
            service_fit_inference: oppDraft.service_fit_inference,
          });

          const createdEvList = [];
          const primaryEv = await base44.entities.EvidenceItem.create({
            owner_id: userId,
            opportunity_id: createdOpp.id,
            source_title: oppDraft.source_title,
            source_url: oppDraft.source_url,
            supporting_excerpt: oppDraft.supporting_excerpt,
            publication_date: oppDraft.publication_date,
            event_date: oppDraft.event_date,
            retrieval_date: oppDraft.retrieval_date,
            recency_basis: oppDraft.recency_basis,
            verification_status: oppDraft.verification_status,
            verification_notes: oppDraft.verification_notes,
            http_status: oppDraft.http_status || 0,
            evidence_status: oppDraft.evidence_status,
          });
          createdEvList.push(primaryEv);

          for (const extraEv of oppDraft.extra_evidence_items || []) {
            const savedExtra = await base44.entities.EvidenceItem.create({
              owner_id: userId,
              opportunity_id: createdOpp.id,
              source_title: extraEv.source_title,
              source_url: extraEv.source_url,
              supporting_excerpt: extraEv.supporting_excerpt,
              publication_date: extraEv.publication_date || "",
              event_date: extraEv.event_date || "",
              retrieval_date: extraEv.retrieval_date || oppDraft.retrieval_date,
              recency_basis: extraEv.recency_basis || oppDraft.recency_basis,
              verification_status: extraEv.verification_status || oppDraft.verification_status,
              verification_notes: extraEv.verification_notes || "",
              http_status: extraEv.http_status || 200,
              evidence_status: extraEv.evidence_status || "corroborated_permit",
            });
            createdEvList.push(savedExtra);
          }

          savedOpportunityRecords.push({
            ...createdOpp,
            evidence_items: createdEvList,
          });
        }

        const durationMs = Date.now() - startTime;
        const completedIso = new Date().toISOString();

        let finalStatus = "completed";
        let statusReason = "";

        if (savedOpportunityRecords.length === 0) {
          finalStatus = "empty";
          statusReason = `No public opening or expansion announcements could be substantiated for "${businessCategory}" in "${locationQuery}" within the last ${timeWindowDays} days.`;
        } else if (needsReviewCount > 0) {
          finalStatus = "partial";
          statusReason = `Found ${savedOpportunityRecords.length} candidate${
            savedOpportunityRecords.length === 1 ? "" : "s"
          }: ${verifiedCount} verified directly against recovered source content, and ${needsReviewCount} marked "Needs review" where the publisher blocked automated page recovery or a date/detail required manual check.`;
        } else {
          finalStatus = "completed";
          statusReason = `Found ${verifiedCount} verified business${
            verifiedCount === 1 ? "" : "es"
          } with opening or expansion evidence confirmed from recovered source pages.`;
        }

        if (mode === "local") {
          finalStatus = localResult.places.length ? "completed" : "empty";
          statusReason = "Local business search complete. Google Maps listings do not confirm an opening or expansion. Local listings are shown live and are not stored in search history.";
        } else if (localResult.places.length && savedOpportunityRecords.length === 0) {
          finalStatus = "partial";
          statusReason = "Local businesses found. No recent opening or expansion announcements were verified.";
        }
        if (mode === "hybrid" && (web.status === "rejected" || localResult.status !== "ok")) {
          finalStatus = "partial";
          statusReason += " One search source is temporarily unavailable; available results are shown.";
        }
        const updatedSearch = await base44.entities.LeadSearch.update(searchRecord.id, {
          status: finalStatus,
          honest_status_reason: statusReason,
          results_count: savedOpportunityRecords.length,
          verified_count: verifiedCount,
          needs_review_count: needsReviewCount,
          counts_toward_quota: true,
          duration_ms: durationMs,
          completed_at: completedIso,
        });

        // If base daily searches were already exhausted, deduct 1 search from active PayPal subscription or Stripe pilot
        if (!quotaBefore.unlimitedSearches && quotaBefore.baseRemainingToday <= 0 && quotaBefore.pilotRemaining > 0) {
          const nowCheckMs = Date.now();
          const activeSub = ownedSubscriptions.find((s) => isPayPalSubscriptionAllowanceActive(s, nowCheckMs) &&
            Number(s.granted_search_allowance) > Number(s.used_subscription_searches || 0));

          if (activeSub) {
            const updatedSub = await base44.asServiceRole.entities.PayPalSubscription.update(
              activeSub.id,
              {
                used_subscription_searches:
                  (Number(activeSub.used_subscription_searches) || 0) + 1,
              }
            );
            activeSub.used_subscription_searches = updatedSub.used_subscription_searches;
          } else {
            const activePilot = ownedEnrollments.find(
              (e) =>
                e.payment_status === "paid_verified" &&
                (Number(e.granted_search_allowance) || 0) > (Number(e.used_pilot_searches) || 0)
            );
            if (activePilot) {
              const updatedEnroll = await base44.asServiceRole.entities.PilotEnrollment.update(
                activePilot.id,
                {
                  used_pilot_searches: (Number(activePilot.used_pilot_searches) || 0) + 1,
                }
              );
              activePilot.used_pilot_searches = updatedEnroll.used_pilot_searches;
            } else {
              const activeComp = complimentaryGrants.find(
                (g) =>
                  isProAccessGrantActive(g, nowCheckMs) &&
                  (Number(g.granted_search_allowance) || 0) > (Number(g.used_searches) || 0)
              );
              if (activeComp && base44?.asServiceRole?.entities?.ProAccessGrant?.update) {
                const updatedGrant = await base44.asServiceRole.entities.ProAccessGrant.update(
                  activeComp.id,
                  {
                    used_searches: (Number(activeComp.used_searches) || 0) + 1,
                  }
                );
                activeComp.used_searches = updatedGrant.used_searches;
              }
            }
          }
        }

        const updatedQuota = computeQuotaUsage(
          [updatedSearch, ...recentSearches],
          Date.now(),
          ownedEnrollments,
          ownedSubscriptions,
          isOwnerAccount(context.user),
          complimentaryGrants
        );

        return {
          search: updatedSearch,
          opportunities: savedOpportunityRecords,
          localPlaces: enrichedLocalPlaces,
          localSearchStatus: localResult.status,
          searchMode: mode,
          fromCache: false,
          cachedAt: null,
          attemptsUsed,
          durationMs,
          quota: updatedQuota,
        };
      } catch (err) {
        const durationMs = Date.now() - startTime;
        const failReason =
          err?.message ||
          "Live web search provider failed after automatic retry. No results were fabricated.";

        const failedSearch = await base44.entities.LeadSearch.update(searchRecord.id, {
          status: "failed",
          honest_status_reason: failReason,
          results_count: 0,
          verified_count: 0,
          needs_review_count: 0,
          counts_toward_quota: false,
          duration_ms: durationMs,
          completed_at: new Date().toISOString(),
        });

        return {
          search: failedSearch,
          opportunities: [],
          fromCache: false,
          cachedAt: null,
          durationMs,
          quota: quotaBefore,
        };
      }
    })();

    activeUserSearches.set(userId, {
      queryCacheKey,
      promise: runPromise,
    });

    try {
      return await runPromise;
    } finally {
      activeUserSearches.delete(userId);
    }
  });

export const saveUserProfile = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      selected_services: z.array(CustomServiceSchema).min(1, "Add at least one service").max(20),
      service_description: z.string().max(600).optional(),
      agency_or_freelancer_name: z.string().max(120).optional(),
      default_time_window_days: z.union([z.literal(30), z.literal(90), z.literal(180)]).optional(),
      ui_language: z.enum(["en", "es"]).optional(),
      outreach_language: z.enum(["en", "es"]).optional(),
      theme_preference: z.enum(["light", "dark", "system"]).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;
    const userEmail = context.user.email || "";

    const normalizedServices = normalizeServicesList(data.selected_services);
    if (normalizedServices.length === 0) {
      throw new Error("Please enter at least one valid service name.");
    }

    const existingPage = await base44.entities.UserProfile.filter(
      { created_by_id: userId },
      { sort: "-created_date", limit: 5 }
    );
    const existing = (existingPage?.items || []).find(
      (p) => p.created_by_id === userId && (!p.owner_id || p.owner_id === userId)
    );

    const payload = {
      owner_id: userId,
      owner_email: userEmail,
      selected_services: normalizedServices,
      service_description: data.service_description?.trim() || "",
      agency_or_freelancer_name: data.agency_or_freelancer_name?.trim() || "",
      default_time_window_days: data.default_time_window_days || 90,
      ui_language: data.ui_language || existing?.ui_language || "en",
      outreach_language:
        data.outreach_language || existing?.outreach_language || data.ui_language || "en",
      theme_preference: data.theme_preference || existing?.theme_preference || "system",
      onboarding_completed: true,
    };

    if (existing) {
      assertRecordOwnedByUser(existing, userId, "Profile");
      return await base44.entities.UserProfile.update(existing.id, payload);
    }
    return await base44.entities.UserProfile.create(payload);
  });

export const updateUserPreferences = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      ui_language: z.enum(["en", "es"]).optional(),
      outreach_language: z.enum(["en", "es"]).optional(),
      theme_preference: z.enum(["light", "dark", "system"]).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;
    const userEmail = context.user.email || "";

    const existingPage = await base44.entities.UserProfile.filter(
      { created_by_id: userId },
      { sort: "-created_date", limit: 5 }
    );
    const existing = (existingPage?.items || []).find(
      (p) => p.created_by_id === userId && (!p.owner_id || p.owner_id === userId)
    );

    if (existing) {
      assertRecordOwnedByUser(existing, userId, "Profile");
      const patch = {};
      if (data.ui_language) patch.ui_language = data.ui_language;
      if (data.outreach_language) patch.outreach_language = data.outreach_language;
      if (data.theme_preference) patch.theme_preference = data.theme_preference;
      return await base44.entities.UserProfile.update(existing.id, patch);
    }

    // Create a minimal profile record if none exists yet so preferences persist server-side
    return await base44.entities.UserProfile.create({
      owner_id: userId,
      owner_email: userEmail,
      selected_services: [],
      ui_language: data.ui_language || "en",
      outreach_language: data.outreach_language || data.ui_language || "en",
      theme_preference: data.theme_preference || "system",
      onboarding_completed: false,
    });
  });

export const getOpportunityDetail = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .validator(
    z.object({
      opportunityId: z.string().min(1).max(120),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;

    const profilesPage = await base44.entities.UserProfile.filter(
      { created_by_id: userId },
      { sort: "-created_date", limit: 1 }
    );
    const rawProfile = (profilesPage?.items || []).find(
      (p) => p.created_by_id === userId && (!p.owner_id || p.owner_id === userId)
    ) || null;
    const profile = rawProfile
      ? {
          ...rawProfile,
          selected_services: normalizeServicesList(rawProfile.selected_services || []),
        }
      : null;

    if (data.opportunityId.startsWith("demo-")) {
      return {
        isExample: true,
        profile,
        opportunity: null,
        evidenceItems: [],
        savedRecord: null,
        feedbackRecord: null,
      };
    }

    const oppPage = await base44.entities.Opportunity.filter(
      { id: data.opportunityId, created_by_id: userId },
      { limit: 1 }
    );
    const rawOpp = oppPage?.items?.[0] || null;
    if (!rawOpp || rawOpp.created_by_id !== userId || (rawOpp.owner_id && rawOpp.owner_id !== userId)) {
      return {
        isExample: false,
        profile,
        opportunity: null,
        evidenceItems: [],
        savedRecord: null,
        feedbackRecord: null,
      };
    }

    const [evidencePage, savedPage, feedbackPage] = await Promise.all([
      base44.entities.EvidenceItem.filter(
        { created_by_id: userId, opportunity_id: rawOpp.id },
        { sort: "-created_date", limit: 20 }
      ),
      base44.entities.SavedOpportunity.filter(
        { created_by_id: userId, opportunity_id: rawOpp.id },
        { sort: "-created_date", limit: 5 }
      ),
      base44.entities.OpportunityFeedback.filter(
        { created_by_id: userId, opportunity_id: rawOpp.id },
        { sort: "-created_date", limit: 5 }
      ),
    ]);

    const evidenceItems = (evidencePage?.items || []).filter(
      (e) => e.created_by_id === userId && (!e.owner_id || e.owner_id === userId)
    );
    const savedRecord =
      (savedPage?.items || []).find(
        (s) => s.created_by_id === userId && (!s.owner_id || s.owner_id === userId)
      ) || null;
    const feedbackRecord =
      (feedbackPage?.items || []).find(
        (f) => f.created_by_id === userId && (!f.owner_id || f.owner_id === userId)
      ) || null;

    return {
      isExample: false,
      profile,
      opportunity: rawOpp,
      evidenceItems,
      savedRecord,
      feedbackRecord,
    };
  });

export const saveOpportunityForUser = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      opportunity_id: z.string().min(1).max(120),
      qualification_notes: z.string().max(1000).optional(),
      review_stage: z.enum(["saved", "researching", "qualified", "archived"]).optional(),
      // Optional legacy fields ignored in favor of authoritative Opportunity record
      business_name: z.string().max(200).optional(),
      business_category: z.string().max(160).optional(),
      location: z.string().max(200).optional(),
      website_url: z.string().max(500).nullable().optional(),
      public_email: z.string().max(160).nullable().optional(),
      public_phone: z.string().max(60).nullable().optional(),
      signal_type: z.string().max(160).optional(),
      signal_summary: z.string().max(1000).optional(),
      source_title: z.string().max(300).optional(),
      source_url: z.string().max(500).optional(),
      supporting_excerpt: z.string().max(1200).optional(),
      publication_date: z.string().max(80).nullable().optional(),
      event_date: z.string().max(120).nullable().optional(),
      retrieval_date: z.string().max(80).optional(),
      recency_basis: z.string().max(80).optional(),
      verification_status: z.string().max(80).optional(),
      verification_notes: z.string().max(600).optional(),
      evidence_status: z.string().max(80).optional(),
      service_fit_inference: z.string().max(1500).optional(),
      inferred_service_categories: z.array(z.string()).max(20).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;

    if (data.opportunity_id.startsWith("demo-")) {
      throw new Error("Example results are for preview only and are not saved to live records.");
    }

    const [ownedOppPage, profilePage, existingSavedPage] = await Promise.all([
      base44.entities.Opportunity.filter(
        { id: data.opportunity_id, created_by_id: userId },
        { limit: 1 }
      ),
      base44.entities.UserProfile.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 1 }
      ),
      base44.entities.SavedOpportunity.filter(
        { created_by_id: userId, opportunity_id: data.opportunity_id },
        { sort: "-created_date", limit: 10 }
      ),
    ]);

    const canonicalOpp = ownedOppPage?.items?.[0];
    assertRecordOwnedByUser(canonicalOpp, userId, "Opportunity");

    const rawProfile = (profilePage?.items || []).find(
      (p) => p.created_by_id === userId && (!p.owner_id || p.owner_id === userId)
    );
    const selectedServices = normalizeServicesList(rawProfile?.selected_services || []);
    const serviceDescription = rawProfile?.service_description || "";

    const existingList = (existingSavedPage?.items || []).filter(
      (s) => s.created_by_id === userId && (!s.owner_id || s.owner_id === userId)
    );
    const primaryExisting = existingList[0] || null;
    const extraDuplicates = existingList.slice(1);

    // Clean up any accidental duplicates if present
    for (const dup of extraDuplicates) {
      await base44.entities.SavedOpportunity.delete(dup.id);
    }

    // Factual fields and verification_status ALWAYS come from the canonical server Opportunity record
    const payload = {
      owner_id: userId,
      opportunity_id: canonicalOpp.id,
      business_name: canonicalOpp.business_name,
      business_category: canonicalOpp.business_category || "",
      location: canonicalOpp.location,
      website_url: canonicalOpp.website_url || "",
      public_email: canonicalOpp.public_email || primaryExisting?.public_email || "",
      public_phone: canonicalOpp.public_phone || primaryExisting?.public_phone || "",
      place_id: canonicalOpp.place_id || primaryExisting?.place_id || "",
      place_name: canonicalOpp.place_name || primaryExisting?.place_name || "",
      place_address: canonicalOpp.place_address || primaryExisting?.place_address || "",
      place_url: canonicalOpp.place_url || primaryExisting?.place_url || "",
      place_business_status: canonicalOpp.place_business_status || primaryExisting?.place_business_status || "",
      signal_type: canonicalOpp.signal_type,
      signal_summary: canonicalOpp.signal_summary || "",
      source_title: canonicalOpp.source_title,
      source_url: canonicalOpp.source_url,
      supporting_excerpt: canonicalOpp.supporting_excerpt,
      publication_date: canonicalOpp.publication_date || "",
      event_date: canonicalOpp.event_date || "",
      retrieval_date: canonicalOpp.retrieval_date,
      recency_basis: canonicalOpp.recency_basis || "unverified_date",
      verification_status: canonicalOpp.verification_status || "needs_review",
      verification_notes: canonicalOpp.verification_notes || "",
      evidence_status: canonicalOpp.evidence_status || "unverified",
      service_fit_inference:
        data.service_fit_inference ||
        buildServiceFitHypothesis(canonicalOpp, selectedServices, serviceDescription) ||
        canonicalOpp.service_fit_inference,
      inferred_service_categories:
        selectedServices.length > 0
          ? selectedServices
          : normalizeServicesList(canonicalOpp.inferred_service_categories || []),
      qualification_notes:
        data.qualification_notes !== undefined
          ? data.qualification_notes.trim()
          : primaryExisting?.qualification_notes || "",
      outreach_draft: primaryExisting?.outreach_draft || "",
      outreach_draft_language: primaryExisting?.outreach_draft_language || undefined,
      review_stage: data.review_stage || primaryExisting?.review_stage || "saved",
    };

    if (primaryExisting) {
      assertRecordOwnedByUser(primaryExisting, userId, "Saved lead");
      return await base44.entities.SavedOpportunity.update(primaryExisting.id, payload);
    }
    return await base44.entities.SavedOpportunity.create(payload);
  });

export const unsaveOpportunityForUser = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      opportunity_id: z.string().min(1).max(120),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;

    if (data.opportunity_id.startsWith("demo-")) {
      return { deleted: false, alreadyUnsaved: true };
    }

    const existingPage = await base44.entities.SavedOpportunity.filter(
      { created_by_id: userId, opportunity_id: data.opportunity_id },
      { limit: 10 }
    );
    const ownedMatches = (existingPage?.items || []).filter(
      (s) => s.created_by_id === userId && (!s.owner_id || s.owner_id === userId)
    );

    if (ownedMatches.length === 0) {
      return { deleted: false, alreadyUnsaved: true, opportunity_id: data.opportunity_id };
    }

    for (const item of ownedMatches) {
      await base44.entities.SavedOpportunity.delete(item.id);
    }

    return {
      deleted: true,
      alreadyUnsaved: false,
      opportunity_id: data.opportunity_id,
      removedCount: ownedMatches.length,
    };
  });

export const updateSavedOpportunityItem = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string().min(1).max(120),
      review_stage: z.enum(["saved", "researching", "qualified", "archived"]).optional(),
      qualification_notes: z.string().max(1000).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;

    const existingPage = await base44.entities.SavedOpportunity.filter(
      { id: data.id, created_by_id: userId },
      { limit: 1 }
    );
    const existing = existingPage?.items?.[0];
    assertRecordOwnedByUser(existing, userId, "Saved lead");

    const patch = {};
    if (data.review_stage !== undefined) patch.review_stage = data.review_stage;
    if (data.qualification_notes !== undefined) {
      patch.qualification_notes = data.qualification_notes.trim();
    }

    return await base44.entities.SavedOpportunity.update(existing.id, patch);
  });

export const deleteSavedOpportunityItem = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string().min(1).max(120) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;

    const existingPage = await base44.entities.SavedOpportunity.filter(
      { id: data.id, created_by_id: userId },
      { limit: 1 }
    );
    const existing = existingPage?.items?.[0];
    if (!existing) {
      return { deleted: false, alreadyUnsaved: true, id: data.id };
    }
    assertRecordOwnedByUser(existing, userId, "Saved lead");

    await base44.entities.SavedOpportunity.delete(existing.id);
    return { deleted: true, id: existing.id };
  });

export {
  recordOpportunityFeedback,
  clearOpportunityFeedback,
  batchDismissOpportunities,
  batchRestoreOpportunities,
} from "@/lib/feedback-server-fns";

export {
  getGoogleSheetsConnectionStatus,
  exportLeadsToGoogleSheets,
} from "@/lib/sheets-server-fns";