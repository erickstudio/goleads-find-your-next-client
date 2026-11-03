import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireUserRoute } from "@/lib/auth-middleware";
import { requireProContext } from "@/lib/plan-access.server";

export const Route = createFileRoute("/api/mcp-leads")({
  server: { middleware: [requireUserRoute], handlers: {
    POST: async ({ request, context }) => {
      try {
        await requireProContext(context);
        const input = z.object({ limit: z.number().int().min(1).max(50).default(20) }).strict().safeParse(await request.json().catch(() => ({})));
        if (!input.success) return Response.json({ error: "Invalid limit: use 1–50." }, { status: 400 });
        const page = await context.getBase44().entities.SavedOpportunity.filter({ created_by_id: context.user.id }, { sort: "-created_date", limit: input.data.limit });
        const leads = (page?.items || []).filter((r) => r.created_by_id === context.user.id && (!r.owner_id || r.owner_id === context.user.id))
          .map((r) => ({ id: r.opportunity_id, business: r.business_name, location: r.location, website: r.website_url, publicEmail: r.public_email || "", publicPhone: r.public_phone || "", source: r.source_url, stage: r.review_stage, emailDraft: r.outreach_draft || "" }));
        return Response.json({ leads, count: leads.length }, { headers: { "Cache-Control": "private, no-store" } });
      } catch (e) { return Response.json({ error: e?.code === "PRO_REQUIRED" ? "An active GoLeads Pro plan is required." : "Unable to load leads." }, { status: e?.status === 403 ? 403 : 503 }); }
    },
  } },
});