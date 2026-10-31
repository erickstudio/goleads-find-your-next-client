import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { normalizeServicesList } from "@/lib/leads-constants";

const CustomServiceSchema = z
  .string()
  .trim()
  .min(1, "Service name cannot be empty")
  .max(80, "Keep service names under 80 characters");

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

    const rawProfile = profilesPage?.items?.[0] || null;
    let profile = null;

    if (rawProfile) {
      const migratedServices = normalizeServicesList(rawProfile.selected_services || []);
      // Automatically persist migration if legacy IDs were stored
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

    return {
      user: {
        id: userId,
        email: userEmail,
        full_name: context.user.full_name || "",
      },
      profile,
      recentSearches: searchesPage?.items || [],
      savedOpportunities: savedPage?.items || [],
      feedbackRecords: feedbackPage?.items || [],
      liveSearchConnected: false,
    };
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
      // Strictly verify ownership before updating
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