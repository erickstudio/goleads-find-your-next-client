import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";

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