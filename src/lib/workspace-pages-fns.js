import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { normalizeServicesList } from "@/lib/leads-constants";
import { computeQuotaUsage } from "@/lib/server-fns";

function filterOwned(items = [], userId) {
  return (items || []).filter(
    (item) => item.created_by_id === userId && (!item.owner_id || item.owner_id === userId)
  );
}

export const getExtendedWorkspaceData = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;
    const userEmail = context.user.email || "";

    const [
      profilesPage,
      searchesPage,
      oppsPage,
      evidencePage,
      savedPage,
      feedbackPage,
      enrollmentsPage,
      subsPage,
    ] = await Promise.all([
      base44.entities.UserProfile.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 1 }
      ),
      base44.entities.LeadSearch.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 50 }
      ),
      base44.entities.Opportunity.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 100 }
      ),
      base44.entities.EvidenceItem.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 100 }
      ),
      base44.entities.SavedOpportunity.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 100 }
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
        { created_by_id: userId },
        { sort: "-created_date", limit: 20 }
      ),
    ]);

    const rawProfile = filterOwned(profilesPage?.items, userId)[0] || null;
    const profile = rawProfile
      ? {
          ...rawProfile,
          selected_services: normalizeServicesList(rawProfile.selected_services || []),
          enable_search_strategist: rawProfile.enable_search_strategist !== false,
          enable_evidence_analyst: rawProfile.enable_evidence_analyst !== false,
        }
      : null;

    const recentSearches = filterOwned(searchesPage?.items, userId);
    const opportunities = filterOwned(oppsPage?.items, userId);
    const evidenceItems = filterOwned(evidencePage?.items, userId);
    const savedOpportunities = filterOwned(savedPage?.items, userId);
    const feedbackRecords = filterOwned(feedbackPage?.items, userId);
    const pilotEnrollments = filterOwned(enrollmentsPage?.items, userId);
    const paypalSubscriptions = filterOwned(subsPage?.items, userId);

    const quota = computeQuotaUsage(
      recentSearches,
      Date.now(),
      pilotEnrollments,
      paypalSubscriptions
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
      opportunities,
      evidenceItems,
      savedOpportunities,
      feedbackRecords,
      pilotEnrollments,
      paypalSubscriptions,
      quota,
    };
  });

export const saveSavedOpportunityOutreach = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string().min(1).max(120),
      outreach_draft: z.string().max(4000),
      outreach_draft_language: z.enum(["en", "es"]).optional(),
      qualification_notes: z.string().max(1000).optional(),
      review_stage: z.enum(["saved", "researching", "qualified", "archived"]).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;

    const existingPage = await base44.entities.SavedOpportunity.filter(
      { id: data.id, created_by_id: userId },
      { limit: 1 }
    );
    const existing = filterOwned(existingPage?.items, userId)[0];
    if (!existing) {
      throw new Error("Saved lead not found in your account.");
    }

    const patch = {
      outreach_draft: data.outreach_draft.trim(),
    };
    if (data.outreach_draft_language) {
      patch.outreach_draft_language = data.outreach_draft_language;
    }
    if (data.qualification_notes !== undefined) {
      patch.qualification_notes = data.qualification_notes.trim();
    }
    if (data.review_stage !== undefined) {
      patch.review_stage = data.review_stage;
    }

    return await base44.entities.SavedOpportunity.update(existing.id, patch);
  });

export const updateAgentSettings = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      enable_search_strategist: z.boolean(),
      enable_evidence_analyst: z.boolean(),
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
    const existing = filterOwned(existingPage?.items, userId)[0];

    if (existing) {
      return await base44.entities.UserProfile.update(existing.id, {
        enable_search_strategist: data.enable_search_strategist,
        enable_evidence_analyst: data.enable_evidence_analyst,
      });
    }

    return await base44.entities.UserProfile.create({
      owner_id: userId,
      owner_email: userEmail,
      selected_services: [],
      enable_search_strategist: data.enable_search_strategist,
      enable_evidence_analyst: data.enable_evidence_analyst,
      onboarding_completed: false,
    });
  });