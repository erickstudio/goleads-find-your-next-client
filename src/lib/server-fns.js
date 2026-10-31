import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import {
  SEARCH_LIMITS,
  buildQueryCacheKey,
  normalizeServicesList,
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

function computeQuotaUsage(searches = [], nowMs = Date.now()) {
  const windowStartMs = nowMs - SEARCH_LIMITS.cacheTtlMs;
  const quotaSearches = searches.filter((s) => {
    if (s.status === "not_configured" || s.status === "failed") return false;
    if (s.counts_toward_quota === false) return false;
    if (s.cached_from_search_id) return false;
    const ts = new Date(s.executed_at || s.created_date || 0).getTime();
    return !Number.isNaN(ts) && ts >= windowStartMs;
  });

  const used = quotaSearches.length;
  return {
    usedToday: used,
    maxDaily: SEARCH_LIMITS.maxDailyNewSearches,
    remainingToday: Math.max(0, SEARCH_LIMITS.maxDailyNewSearches - used),
    maxResultsPerSearch: SEARCH_LIMITS.maxResultsPerSearch,
    maxConcurrentSearches: SEARCH_LIMITS.maxConcurrentSearches,
    cacheTtlHours: SEARCH_LIMITS.cacheTtlHours,
  };
}

export const getWorkspaceBootstrap = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;
    const userEmail = context.user.email || "";

    const [profilesPage, searchesPage, savedPage, feedbackPage] = await Promise.all([
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
        { sort: "-created_date", limit: 50 }
      ),
    ]);

    const rawProfile = profilesPage?.items?.[0] || null;
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

    const recentSearches = searchesPage?.items || [];
    // Find most recent real search (excluding legacy not_configured placeholders)
    const latestLiveSearch =
      recentSearches.find((s) => s.status !== "not_configured") || null;

    let latestOpportunities = [];
    if (latestLiveSearch) {
      const targetSearchId = latestLiveSearch.cached_from_search_id || latestLiveSearch.id;
      const oppPage = await base44.entities.Opportunity.filter(
        { created_by_id: userId, search_id: targetSearchId },
        { sort: "-created_date", limit: SEARCH_LIMITS.maxResultsPerSearch }
      );
      latestOpportunities = oppPage?.items || [];
    }

    const quota = computeQuotaUsage(recentSearches);

    return {
      user: {
        id: userId,
        email: userEmail,
        full_name: context.user.full_name || "",
      },
      profile,
      recentSearches,
      latestLiveSearch,
      latestOpportunities,
      savedOpportunities: savedPage?.items || [],
      feedbackRecords: feedbackPage?.items || [],
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
        // Duplicate submission of the exact same in-flight query: await existing run
        return await inFlight.promise;
      }
      throw new Error(
        "You already have a search in progress (limit: 1 concurrent search). Please wait for it to finish."
      );
    }

    // 2. Load user profile & recent searches for cache, concurrency, and quota checks
    const [profilesPage, searchesPage] = await Promise.all([
      base44.entities.UserProfile.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 1 }
      ),
      base44.entities.LeadSearch.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 30 }
      ),
    ]);

    const rawProfile = profilesPage?.items?.[0] || null;
    const selectedServices = normalizeServicesList(rawProfile?.selected_services || []);
    const serviceDescription = rawProfile?.service_description || "";
    const recentSearches = searchesPage?.items || [];

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

    // 3. Check 24-hour private per-user query cache (unless force_retry on a failed search)
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
      const cachedOpportunities = cachedOppsPage?.items || [];
      const quota = computeQuotaUsage(recentSearches, nowMs);

      return {
        search: cachedSearch,
        opportunities: cachedOpportunities,
        fromCache: true,
        cachedAt: cachedSearch.completed_at || cachedSearch.executed_at,
        quota,
      };
    }

    // 4. Enforce daily limit of 3 new searches per user/day
    const quotaBefore = computeQuotaUsage(recentSearches, nowMs);
    if (quotaBefore.remainingToday <= 0) {
      throw new Error(
        `Daily search limit reached (${quotaBefore.usedToday} of ${quotaBefore.maxDaily} new searches used in the last 24 hours). Identical queries run in the last 24 hours remain available from your private cache.`
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
            rawCandidates: candidates,
            businessCategory,
            locationQuery,
            timeWindowDays,
            selectedServices,
            serviceDescription,
            nowDate: now,
          });

        // Persist Opportunities and EvidenceItems scoped to authenticated owner
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

          await base44.entities.EvidenceItem.create({
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

          savedOpportunityRecords.push(createdOpp);
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

        const updatedQuota = computeQuotaUsage(
          [updatedSearch, ...recentSearches],
          Date.now()
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
      { sort: "-created_date", limit: 1 }
    );
    const existing = existingPage?.items?.[0];

    const payload = {
      owner_id: userId,
      owner_email: userEmail,
      selected_services: normalizedServices,
      service_description: data.service_description?.trim() || "",
      agency_or_freelancer_name: data.agency_or_freelancer_name?.trim() || "",
      default_time_window_days: data.default_time_window_days || 90,
      onboarding_completed: true,
    };

    if (existing) {
      if (existing.created_by_id !== userId && existing.owner_id !== userId) {
        throw new Error("Forbidden: You do not own this profile record.");
      }
      return await base44.entities.UserProfile.update(existing.id, payload);
    }
    return await base44.entities.UserProfile.create(payload);
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
    const rawProfile = profilesPage?.items?.[0] || null;
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
    const opportunity = oppPage?.items?.[0] || null;
    if (!opportunity) {
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
        { created_by_id: userId, opportunity_id: opportunity.id },
        { sort: "-created_date", limit: 20 }
      ),
      base44.entities.SavedOpportunity.filter(
        { created_by_id: userId, opportunity_id: opportunity.id },
        { limit: 1 }
      ),
      base44.entities.OpportunityFeedback.filter(
        { created_by_id: userId, opportunity_id: opportunity.id },
        { limit: 1 }
      ),
    ]);

    return {
      isExample: false,
      profile,
      opportunity,
      evidenceItems: evidencePage?.items || [],
      savedRecord: savedPage?.items?.[0] || null,
      feedbackRecord: feedbackPage?.items?.[0] || null,
    };
  });

export const saveOpportunityForUser = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      opportunity_id: z.string().min(1).max(120),
      business_name: z.string().min(1).max(200),
      business_category: z.string().max(160).optional(),
      location: z.string().min(1).max(200),
      website_url: z.string().max(500).nullable().optional(),
      signal_type: z.string().max(160),
      signal_summary: z.string().max(1000).optional(),
      source_title: z.string().max(300),
      source_url: z.string().min(1).max(500),
      supporting_excerpt: z.string().max(1200),
      publication_date: z.string().max(80).nullable().optional(),
      event_date: z.string().max(120).nullable().optional(),
      retrieval_date: z.string().max(80),
      recency_basis: z.string().max(80).optional(),
      verification_status: z.string().max(80).optional(),
      verification_notes: z.string().max(600).optional(),
      evidence_status: z.string().max(80),
      service_fit_inference: z.string().max(1500),
      inferred_service_categories: z.array(z.string()).max(20).optional(),
      qualification_notes: z.string().max(1000).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;

    if (data.opportunity_id.startsWith("demo-")) {
      throw new Error("Example results are for preview only and are not saved to live records.");
    }

    const ownedOpp = await base44.entities.Opportunity.filter(
      { id: data.opportunity_id, created_by_id: userId },
      { limit: 1 }
    );
    if (!ownedOpp?.items?.[0]) {
      throw new Error("Opportunity not found in your account.");
    }

    const existingPage = await base44.entities.SavedOpportunity.filter(
      { created_by_id: userId, opportunity_id: data.opportunity_id },
      { limit: 1 }
    );
    const existing = existingPage?.items?.[0];

    const payload = {
      owner_id: userId,
      opportunity_id: data.opportunity_id,
      business_name: data.business_name,
      business_category: data.business_category || "",
      location: data.location,
      website_url: data.website_url || "",
      signal_type: data.signal_type,
      signal_summary: data.signal_summary || "",
      source_title: data.source_title,
      source_url: data.source_url,
      supporting_excerpt: data.supporting_excerpt,
      publication_date: data.publication_date || "",
      event_date: data.event_date || "",
      retrieval_date: data.retrieval_date,
      recency_basis: data.recency_basis || "unverified_date",
      verification_status: data.verification_status || "needs_review",
      verification_notes: data.verification_notes || "",
      evidence_status: data.evidence_status,
      service_fit_inference: data.service_fit_inference,
      inferred_service_categories: normalizeServicesList(data.inferred_service_categories || []),
      qualification_notes: data.qualification_notes || "",
      review_stage: "saved",
    };

    if (existing) {
      return await base44.entities.SavedOpportunity.update(existing.id, payload);
    }
    return await base44.entities.SavedOpportunity.create(payload);
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
    if (!existing) {
      throw new Error("Saved lead not found or not owned by current user.");
    }

    const patch = {};
    if (data.review_stage !== undefined) patch.review_stage = data.review_stage;
    if (data.qualification_notes !== undefined) patch.qualification_notes = data.qualification_notes;

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
      throw new Error("Saved lead not found or not owned by current user.");
    }

    await base44.entities.SavedOpportunity.delete(existing.id);
    return { deleted: true, id: existing.id };
  });

export const recordOpportunityFeedback = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      opportunity_id: z.string().min(1).max(120),
      business_name: z.string().min(1).max(200),
      verdict: z.enum(["not_relevant", "weak_evidence", "already_client", "out_of_territory"]),
      reason_note: z.string().max(500).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;

    if (data.opportunity_id.startsWith("demo-")) {
      throw new Error("Example results are for preview only and do not write live feedback.");
    }

    const existingPage = await base44.entities.OpportunityFeedback.filter(
      { created_by_id: userId, opportunity_id: data.opportunity_id },
      { limit: 1 }
    );
    const existing = existingPage?.items?.[0];

    const payload = {
      owner_id: userId,
      opportunity_id: data.opportunity_id,
      business_name: data.business_name,
      verdict: data.verdict,
      reason_note: data.reason_note?.trim() || "",
      recorded_at: new Date().toISOString(),
    };

    if (existing) {
      return await base44.entities.OpportunityFeedback.update(existing.id, payload);
    }
    return await base44.entities.OpportunityFeedback.create(payload);
  });