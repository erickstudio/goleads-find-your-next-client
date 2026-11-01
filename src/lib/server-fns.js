import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
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

export function computeQuotaUsage(searches = [], nowMs = Date.now(), pilotEnrollments = []) {
  const windowStartMs = nowMs - SEARCH_LIMITS.cacheTtlMs;
  const quotaSearches = searches.filter((s) => {
    if (s.status === "not_configured" || s.status === "failed") return false;
    if (s.counts_toward_quota === false) return false;
    if (s.cached_from_search_id) return false;
    const ts = new Date(s.executed_at || s.created_date || 0).getTime();
    return !Number.isNaN(ts) && ts >= windowStartMs;
  });

  // Only server-verified paid_verified enrollments that have not expired grant pilot search allowance
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

  const used = quotaSearches.length;
  const baseRemainingToday = Math.max(0, SEARCH_LIMITS.maxDailyNewSearches - used);

  return {
    usedToday: used,
    maxDaily: SEARCH_LIMITS.maxDailyNewSearches,
    baseRemainingToday,
    pilotGrantedTotal,
    pilotUsedTotal,
    pilotRemaining,
    remainingToday: baseRemainingToday + pilotRemaining,
    maxResultsPerSearch: SEARCH_LIMITS.maxResultsPerSearch,
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

    const [profilesPage, searchesPage, savedPage, feedbackPage, enrollmentsPage] = await Promise.all([
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
        .slice(0, SEARCH_LIMITS.maxResultsPerSearch);
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
    const quota = computeQuotaUsage(recentSearches, Date.now(), ownedEnrollments);

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
      latestOpportunities,
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
    const queryCacheKey = buildQueryCacheKey(
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

    // 2. Load user profile, recent searches, and pilot enrollments for cache, concurrency, and quota checks
    const [profilesPage, searchesPage, enrollmentsPage] = await Promise.all([
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
      if (s.query_cache_key !== queryCacheKey) return false;
      if (!["completed", "partial", "empty"].includes(s.status)) return false;
      if (s.cached_from_search_id) return false;
      const ts = new Date(s.completed_at || s.executed_at || s.created_date || 0).getTime();
      return !Number.isNaN(ts) && ts >= cacheCutoffMs;
    });

    if (cachedSearch) {
      const cachedOppsPage = await base44.entities.Opportunity.filter(
        { created_by_id: userId, search_id: cachedSearch.id },
        { sort: "-created_date", limit: SEARCH_LIMITS.maxResultsPerSearch }
      );
      const cachedOpportunities = (cachedOppsPage?.items || []).filter(
        (o) => o.created_by_id === userId && (!o.owner_id || o.owner_id === userId)
      );
      const quota = computeQuotaUsage(recentSearches, nowMs, ownedEnrollments);

      return {
        search: cachedSearch,
        opportunities: cachedOpportunities,
        fromCache: true,
        cachedAt: cachedSearch.completed_at || cachedSearch.executed_at,
        quota,
      };
    }

    // 4. Enforce daily limit + verified pilot research allowance
    const quotaBefore = computeQuotaUsage(recentSearches, nowMs, ownedEnrollments);
    if (quotaBefore.remainingToday <= 0) {
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
        const { candidates, attemptsUsed } = await queryBuiltInWebSearchWithRetry(base44, {
          businessCategory,
          locationQuery,
          timeWindowDays,
          nowIso,
        });

        const { allOpportunities, verifiedCount, needsReviewCount } =
          await verifyAndStructureCandidates({
            base44,
            rawCandidates: candidates,
            businessCategory,
            locationQuery,
            timeWindowDays,
            selectedServices,
            serviceDescription,
            nowDate: now,
          });

        const savedOpportunityRecords = [];
        for (const oppDraft of allOpportunities) {
          const createdOpp = await base44.entities.Opportunity.create({
            owner_id: userId,
            search_id: searchRecord.id,
            business_name: oppDraft.business_name,
            business_category: oppDraft.business_category,
            location: oppDraft.location,
            website_url: oppDraft.website_url,
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

        // If base daily searches were already exhausted, deduct 1 search from the active verified pilot enrollment
        if (quotaBefore.baseRemainingToday <= 0 && quotaBefore.pilotRemaining > 0) {
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
          }
        }

        const updatedQuota = computeQuotaUsage(
          [updatedSearch, ...recentSearches],
          Date.now(),
          ownedEnrollments
        );

        return {
          search: updatedSearch,
          opportunities: savedOpportunityRecords,
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

export const recordOpportunityFeedback = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      opportunity_id: z.string().min(1).max(120),
      business_name: z.string().min(1).max(200).optional(),
      verdict: z.enum([
        "relevant",
        "not_relevant",
        "weak_evidence",
        "already_client",
        "out_of_territory",
      ]),
      reason_category: z.string().max(120).optional(),
      reason_note: z.string().max(500).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;

    if (data.opportunity_id.startsWith("demo-")) {
      throw new Error("Example results are for preview only and do not write live feedback.");
    }

    // Verify ownership of the underlying Opportunity before allowing feedback read/write
    const [oppPage, existingPage] = await Promise.all([
      base44.entities.Opportunity.filter(
        { id: data.opportunity_id, created_by_id: userId },
        { limit: 1 }
      ),
      base44.entities.OpportunityFeedback.filter(
        { created_by_id: userId, opportunity_id: data.opportunity_id },
        { sort: "-created_date", limit: 10 }
      ),
    ]);

    const canonicalOpp = oppPage?.items?.[0];
    assertRecordOwnedByUser(canonicalOpp, userId, "Opportunity");

    const existingList = (existingPage?.items || []).filter(
      (f) => f.created_by_id === userId && (!f.owner_id || f.owner_id === userId)
    );
    const primaryExisting = existingList[0] || null;
    const extraDuplicates = existingList.slice(1);

    for (const dup of extraDuplicates) {
      await base44.entities.OpportunityFeedback.delete(dup.id);
    }

    // Relevance feedback NEVER modifies Opportunity.verification_status or EvidenceItem.verification_status
    const payload = {
      owner_id: userId,
      opportunity_id: canonicalOpp.id,
      business_name: canonicalOpp.business_name,
      verdict: data.verdict,
      reason_category: data.reason_category?.trim() || "",
      reason_note: data.reason_note?.trim() || "",
      recorded_at: new Date().toISOString(),
    };

    if (primaryExisting) {
      assertRecordOwnedByUser(primaryExisting, userId, "Feedback");
      return await base44.entities.OpportunityFeedback.update(primaryExisting.id, payload);
    }
    return await base44.entities.OpportunityFeedback.create(payload);
  });

export const clearOpportunityFeedback = createServerFn({ method: "POST" })
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
      return { cleared: false };
    }

    const existingPage = await base44.entities.OpportunityFeedback.filter(
      { created_by_id: userId, opportunity_id: data.opportunity_id },
      { limit: 10 }
    );
    const ownedList = (existingPage?.items || []).filter(
      (f) => f.created_by_id === userId && (!f.owner_id || f.owner_id === userId)
    );

    for (const item of ownedList) {
      await base44.entities.OpportunityFeedback.delete(item.id);
    }

    return { cleared: ownedList.length > 0, opportunity_id: data.opportunity_id };
  });

const activeUserBatchOps = new Map();

export const batchDismissOpportunities = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      opportunity_ids: z
        .array(z.string().trim().min(1, "ID required").max(120, "ID too long"))
        .min(1, "Select at least one opportunity")
        .max(25, "Batch size cannot exceed 25 opportunities"),
      reason_category: z.string().max(120).optional(),
      reason_note: z.string().max(500).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;

    const uniqueIds = Array.from(
      new Set(data.opportunity_ids.map((id) => id.trim()).filter(Boolean))
    );
    const lockKey = `${userId}:dismiss:${uniqueIds.slice().sort().join(",")}`;
    if (activeUserBatchOps.has(lockKey)) {
      return await activeUserBatchOps.get(lockKey);
    }

    const opPromise = (async () => {
      const updatedIds = [];
      const failedIds = [];
      const nowIso = new Date().toISOString();

      for (const oppId of uniqueIds) {
        if (oppId.startsWith("demo-")) {
          failedIds.push({ id: oppId, reason: "example_record" });
          continue;
        }
        try {
          const [oppPage, existingPage] = await Promise.all([
            base44.entities.Opportunity.filter(
              { id: oppId, created_by_id: userId },
              { limit: 1 }
            ),
            base44.entities.OpportunityFeedback.filter(
              { created_by_id: userId, opportunity_id: oppId },
              { sort: "-created_date", limit: 10 }
            ),
          ]);

          const canonicalOpp = oppPage?.items?.[0];
          if (
            !canonicalOpp ||
            canonicalOpp.created_by_id !== userId ||
            (canonicalOpp.owner_id && canonicalOpp.owner_id !== userId)
          ) {
            failedIds.push({ id: oppId, reason: "not_found_or_forbidden" });
            continue;
          }

          const existingList = (existingPage?.items || []).filter(
            (f) => f.created_by_id === userId && (!f.owner_id || f.owner_id === userId)
          );
          const primaryExisting = existingList[0] || null;
          for (const dup of existingList.slice(1)) {
            await base44.entities.OpportunityFeedback.delete(dup.id);
          }

          const payload = {
            owner_id: userId,
            opportunity_id: canonicalOpp.id,
            business_name: canonicalOpp.business_name,
            verdict: "not_relevant",
            reason_category: data.reason_category?.trim() || "Not a fit for my services",
            reason_note: data.reason_note?.trim() || "Dismissed from Find leads",
            recorded_at: nowIso,
          };

          if (primaryExisting) {
            await base44.entities.OpportunityFeedback.update(primaryExisting.id, payload);
          } else {
            await base44.entities.OpportunityFeedback.create(payload);
          }
          updatedIds.push(canonicalOpp.id);
        } catch (err) {
          failedIds.push({ id: oppId, reason: err?.message || "update_error" });
        }
      }

      return {
        updatedCount: updatedIds.length,
        updatedIds,
        failedCount: failedIds.length,
        failedIds,
      };
    })();

    activeUserBatchOps.set(lockKey, opPromise);
    try {
      return await opPromise;
    } finally {
      activeUserBatchOps.delete(lockKey);
    }
  });

export const batchRestoreOpportunities = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      opportunity_ids: z
        .array(z.string().trim().min(1, "ID required").max(120, "ID too long"))
        .min(1, "Select at least one opportunity")
        .max(25, "Batch size cannot exceed 25 opportunities"),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;

    const uniqueIds = Array.from(
      new Set(data.opportunity_ids.map((id) => id.trim()).filter(Boolean))
    );
    const lockKey = `${userId}:restore:${uniqueIds.slice().sort().join(",")}`;
    if (activeUserBatchOps.has(lockKey)) {
      return await activeUserBatchOps.get(lockKey);
    }

    const opPromise = (async () => {
      const restoredIds = [];
      const failedIds = [];

      for (const oppId of uniqueIds) {
        if (oppId.startsWith("demo-")) {
          failedIds.push({ id: oppId, reason: "example_record" });
          continue;
        }
        try {
          const [oppPage, existingPage] = await Promise.all([
            base44.entities.Opportunity.filter(
              { id: oppId, created_by_id: userId },
              { limit: 1 }
            ),
            base44.entities.OpportunityFeedback.filter(
              { created_by_id: userId, opportunity_id: oppId },
              { limit: 10 }
            ),
          ]);

          const canonicalOpp = oppPage?.items?.[0];
          if (
            !canonicalOpp ||
            canonicalOpp.created_by_id !== userId ||
            (canonicalOpp.owner_id && canonicalOpp.owner_id !== userId)
          ) {
            failedIds.push({ id: oppId, reason: "not_found_or_forbidden" });
            continue;
          }

          const ownedList = (existingPage?.items || []).filter(
            (f) => f.created_by_id === userId && (!f.owner_id || f.owner_id === userId)
          );
          for (const item of ownedList) {
            await base44.entities.OpportunityFeedback.delete(item.id);
          }
          restoredIds.push(canonicalOpp.id);
        } catch (err) {
          failedIds.push({ id: oppId, reason: err?.message || "restore_error" });
        }
      }

      return {
        restoredCount: restoredIds.length,
        restoredIds,
        failedCount: failedIds.length,
        failedIds,
      };
    })();

    activeUserBatchOps.set(lockKey, opPromise);
    try {
      return await opPromise;
    } finally {
      activeUserBatchOps.delete(lockKey);
    }
  });

const GOOGLE_SHEETS_CONNECTOR_ID = "6ae79347cd3d8383bd8d098a";

function escapeCsvCell(val) {
  const s = String(val ?? "").replace(/\r?\n/g, " ").trim();
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export const getGoogleSheetsConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const base44 = context.getBase44();
    const connection = await base44.asServiceRole.connectors
      .getCurrentAppUserConnection(GOOGLE_SHEETS_CONNECTOR_ID)
      .catch((error) => {
        if (error?.status === 404) return null;
        throw error;
      });

    if (!connection || !connection.accessToken) {
      return {
        connected: false,
        connectorId: GOOGLE_SHEETS_CONNECTOR_ID,
      };
    }

    return {
      connected: true,
      connectorId: GOOGLE_SHEETS_CONNECTOR_ID,
    };
  });

export const exportLeadsToGoogleSheets = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      source: z.enum(["saved", "discover"]).default("saved"),
      opportunity_ids: z.array(z.string().trim().min(1).max(120)).max(100).optional(),
      stage_filter: z.string().max(40).optional(),
      spreadsheet_title: z.string().trim().max(120).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;

    const connection = await base44.asServiceRole.connectors
      .getCurrentAppUserConnection(GOOGLE_SHEETS_CONNECTOR_ID)
      .catch((error) => {
        if (error?.status === 404) return null;
        throw error;
      });

    if (!connection || !connection.accessToken) {
      return {
        connected: false,
        connectorId: GOOGLE_SHEETS_CONNECTOR_ID,
      };
    }

    const [savedPage, oppsPage, feedbackPage] = await Promise.all([
      base44.entities.SavedOpportunity.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 100 }
      ),
      base44.entities.Opportunity.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 100 }
      ),
      base44.entities.OpportunityFeedback.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 100 }
      ),
    ]);

    const ownedSaved = deduplicateByOpportunityId(
      (savedPage?.items || []).filter(
        (s) => s.created_by_id === userId && (!s.owner_id || s.owner_id === userId)
      )
    );
    const ownedOpps = (oppsPage?.items || []).filter(
      (o) => o.created_by_id === userId && (!o.owner_id || o.owner_id === userId)
    );
    const ownedFeedback = deduplicateByOpportunityId(
      (feedbackPage?.items || []).filter(
        (f) => f.created_by_id === userId && (!f.owner_id || f.owner_id === userId)
      )
    );

    const savedByOppId = new Map(ownedSaved.map((s) => [s.opportunity_id, s]));
    const feedbackByOppId = new Map(ownedFeedback.map((f) => [f.opportunity_id, f]));

    let targetRecords = [];
    const requestedIds = Array.isArray(data.opportunity_ids)
      ? new Set(data.opportunity_ids.filter((id) => !id.startsWith("demo-")))
      : null;

    if (data.source === "saved") {
      targetRecords = ownedSaved.filter((item) => {
        if (requestedIds && requestedIds.size > 0 && !requestedIds.has(item.opportunity_id)) {
          return false;
        }
        if (data.stage_filter && data.stage_filter !== "all") {
          return (item.review_stage || "saved") === data.stage_filter;
        }
        return true;
      });
    } else {
      targetRecords = ownedOpps.filter((opp) => {
        if (requestedIds && requestedIds.size > 0) {
          return requestedIds.has(opp.id);
        }
        return true;
      });
    }

    if (targetRecords.length === 0) {
      throw new Error("No leads matched the current selection to export.");
    }

    const headers = [
      "lead_id",
      "business_name",
      "business_category",
      "location",
      "website_url",
      "signal_type",
      "signal_summary",
      "source_verification_status",
      "user_commercial_stage",
      "user_relevance_verdict",
      "publication_date",
      "event_date",
      "source_title",
      "source_url",
      "supporting_excerpt",
      "service_fit_hypothesis",
      "target_services",
      "outreach_draft",
      "qualification_notes",
      "retrieved_at_utc",
    ];

    const rows = targetRecords.map((rec) => {
      const oppId = rec.opportunity_id || rec.id;
      const savedMatch = savedByOppId.get(oppId);
      const fbMatch = feedbackByOppId.get(oppId);
      const servicesArr = Array.isArray(rec.inferred_service_categories)
        ? rec.inferred_service_categories
        : Array.isArray(savedMatch?.inferred_service_categories)
        ? savedMatch.inferred_service_categories
        : [];

      return [
        String(oppId || ""),
        String(rec.business_name || ""),
        String(rec.business_category || ""),
        String(rec.location || ""),
        String(rec.website_url || savedMatch?.website_url || ""),
        String(rec.signal_type || ""),
        String(rec.signal_summary || ""),
        String(rec.verification_status || "needs_review"),
        String(savedMatch?.review_stage || rec.review_stage || "unsaved"),
        String(fbMatch?.verdict || "unrated"),
        String(rec.publication_date || ""),
        String(rec.event_date || ""),
        String(rec.source_title || ""),
        String(rec.source_url || ""),
        String(rec.supporting_excerpt || ""),
        String(rec.service_fit_inference || ""),
        servicesArr.join("; "),
        String(savedMatch?.outreach_draft || rec.outreach_draft || ""),
        String(savedMatch?.qualification_notes || rec.qualification_notes || ""),
        String(rec.retrieval_date || ""),
      ];
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const title =
      data.spreadsheet_title ||
      `GoLeads CRM & MCP Export (${todayStr}) — ${rows.length} leads`;

    const allValues = [headers, ...rows];

    // 1. Try creating via Google Sheets API v4 first
    const sheetsBody = {
      properties: { title },
      sheets: [
        {
          properties: {
            title: "Leads",
            gridProperties: { frozenRowCount: 1 },
          },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: allValues.map((row, rowIndex) => ({
                values: row.map((cell) => ({
                  userEnteredValue: { stringValue: String(cell ?? "") },
                  userEnteredFormat:
                    rowIndex === 0
                      ? { textFormat: { bold: true } }
                      : undefined,
                })),
              })),
            },
          ],
        },
      ],
    };

    const sheetsRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sheetsBody),
    });

    if (sheetsRes.ok) {
      const created = await sheetsRes.json();
      return {
        connected: true,
        exportedCount: rows.length,
        spreadsheetId: created.spreadsheetId,
        spreadsheetTitle: title,
        spreadsheetUrl:
          created.spreadsheetUrl ||
          `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
      };
    }

    // 2. Fallback to Google Drive v3 multipart upload with application/vnd.google-apps.spreadsheet
    const csvContent = allValues
      .map((r) => r.map((cell) => escapeCsvCell(cell)).join(","))
      .join("\r\n");

    const boundary = "goleads_sheets_boundary_" + Date.now();
    const metadata = {
      name: title,
      mimeType: "application/vnd.google-apps.spreadsheet",
    };

    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/csv; charset=UTF-8\r\n\r\n` +
      `${csvContent}\r\n` +
      `--${boundary}--`;

    const driveRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    if (!driveRes.ok) {
      const errText = await driveRes.text().catch(() => "");
      throw new Error(
        `Google Sheets export failed (${driveRes.status}): ${errText.slice(0, 180)}`
      );
    }

    const driveFile = await driveRes.json();
    return {
      connected: true,
      exportedCount: rows.length,
      spreadsheetId: driveFile.id,
      spreadsheetTitle: driveFile.name || title,
      spreadsheetUrl:
        driveFile.webViewLink ||
        `https://docs.google.com/spreadsheets/d/${driveFile.id}/edit`,
    };
  });