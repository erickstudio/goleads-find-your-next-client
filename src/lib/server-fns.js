import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";

const ServiceCategoryEnum = z.enum(["web_design_seo", "ecommerce", "automation_crm"]);

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
        { sort: "-created_date", limit: 10 }
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

    const profile = profilesPage?.items?.[0] || null;
    const recentSearches = searchesPage?.items || [];
    const savedOpportunities = savedPage?.items || [];
    const feedbackRecords = feedbackPage?.items || [];

    return {
      user: {
        id: userId,
        email: userEmail,
        full_name: context.user.full_name || "",
      },
      profile,
      recentSearches,
      savedOpportunities,
      feedbackRecords,
      integrationStatus: {
        liveSearchConfigured: false,
        state: "not_configured",
        checkedProvider: "Base44 Core.InvokeLLM (add_context_from_internet=true, model='gemini_3_flash')",
        summary:
          "Built-in InvokeLLM web search is available and verified capable of returning real business expansion articles with HTTP 200 URLs and publication dates, but live search execution is held in 'not_configured' state until post-retrieval URL/excerpt verification is explicitly enabled for a live test search.",
      },
    };
  });

export const saveUserProfile = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      selected_services: z.array(ServiceCategoryEnum).min(1).max(3),
      agency_or_freelancer_name: z.string().max(120).optional(),
      default_time_window_days: z.union([z.literal(30), z.literal(90), z.literal(180)]).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;
    const userEmail = context.user.email || "";

    const existingPage = await base44.entities.UserProfile.filter(
      { created_by_id: userId },
      { sort: "-created_date", limit: 1 }
    );
    const existing = existingPage?.items?.[0];

    const payload = {
      owner_id: userId,
      owner_email: userEmail,
      selected_services: data.selected_services,
      agency_or_freelancer_name: data.agency_or_freelancer_name?.trim() || "",
      default_time_window_days: data.default_time_window_days || 90,
      onboarding_completed: true,
    };

    if (existing) {
      return await base44.entities.UserProfile.update(existing.id, payload);
    }
    return await base44.entities.UserProfile.create(payload);
  });

export const recordSearchAttempt = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      business_category: z.string().min(1).max(160),
      location_query: z.string().min(1).max(160),
      time_window_days: z.union([z.literal(30), z.literal(90), z.literal(180)]),
      selected_services_snapshot: z.array(z.string()).max(5).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;

    // Until the live web discovery integration + URL verifier is wired and enabled,
    // record the search honestly as "not_configured" with 0 live results.
    const searchRecord = await base44.entities.LeadSearch.create({
      owner_id: userId,
      business_category: data.business_category.trim(),
      location_query: data.location_query.trim(),
      time_window_days: data.time_window_days,
      selected_services_snapshot: data.selected_services_snapshot || [],
      status: "not_configured",
      honest_status_reason:
        "Live discovery pipeline is not yet enabled. Search parameters were logged under your account with status 'not_configured' and 0 fabricated results.",
      results_count: 0,
      executed_at: new Date().toISOString(),
    });

    return {
      searchRecord,
      opportunities: [],
    };
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

    // If it's a demo fixture ID, return null for live DB and let the UI render the isolated demo fixture
    if (data.opportunityId.startsWith("demo-")) {
      const [savedPage, feedbackPage] = await Promise.all([
        base44.entities.SavedOpportunity.filter(
          { created_by_id: userId, opportunity_id: data.opportunityId },
          { limit: 1 }
        ),
        base44.entities.OpportunityFeedback.filter(
          { created_by_id: userId, opportunity_id: data.opportunityId },
          { limit: 1 }
        ),
      ]);
      return {
        isDemo: true,
        opportunity: null,
        evidenceItems: [],
        savedRecord: savedPage?.items?.[0] || null,
        feedbackRecord: feedbackPage?.items?.[0] || null,
      };
    }

    const oppPage = await base44.entities.Opportunity.filter(
      { id: data.opportunityId, created_by_id: userId },
      { limit: 1 }
    );
    const opportunity = oppPage?.items?.[0] || null;
    if (!opportunity) {
      return {
        isDemo: false,
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
      isDemo: false,
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
      evidence_status: z.string().max(80),
      service_fit_inference: z.string().max(1500),
      inferred_service_categories: z.array(z.string()).max(5).optional(),
      qualification_notes: z.string().max(1000).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;

    // Prevent saving demo fixtures into live database records
    if (data.opportunity_id.startsWith("demo-")) {
      throw new Error(
        "Demo fixtures are isolated for visual inspection and cannot be saved into live database records."
      );
    }

    // Verify the caller actually owns the underlying Opportunity record
    const ownedOpp = await base44.entities.Opportunity.filter(
      { id: data.opportunity_id, created_by_id: userId },
      { limit: 1 }
    );
    if (!ownedOpp?.items?.[0]) {
      throw new Error("Opportunity not found in your authenticated workspace.");
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
      evidence_status: data.evidence_status,
      service_fit_inference: data.service_fit_inference,
      inferred_service_categories: data.inferred_service_categories || [],
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
      throw new Error("Saved opportunity not found or not owned by current user.");
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
      throw new Error("Saved opportunity not found or not owned by current user.");
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
      throw new Error(
        "Demo fixtures are isolated and do not write feedback into live database records."
      );
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