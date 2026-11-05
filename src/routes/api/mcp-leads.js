import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireUserRoute } from "@/lib/auth-middleware";
import { requireProContext } from "@/lib/plan-access.server";

const McpLeadsInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  stage: z.enum(["all", "saved", "researching", "qualified", "archived"]).optional().default("all"),
});

async function handleMcpLeadsRequest(rawParams, context) {
  try {
    const access = await requireProContext(context);
    const parsed = McpLeadsInputSchema.safeParse(rawParams || {});
    if (!parsed.success) {
      return Response.json(
        {
          ok: false,
          code: "INVALID_INPUT",
          error: "Invalid parameters: limit must be an integer between 1 and 50.",
        },
        { status: 400, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const { limit, stage } = parsed.data;
    const userId = context.user.id;
    const page = await context
      .getBase44()
      .entities.SavedOpportunity.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 100 }
      );

    const ownedItems = (page?.items || []).filter(
      (r) =>
        r.created_by_id === userId &&
        (!r.owner_id || r.owner_id === userId) &&
        (stage === "all" || (r.review_stage || "saved") === stage)
    );

    const seenOppIds = new Set();
    const leads = [];
    for (const r of ownedItems) {
      const oppKey = r.opportunity_id || r.id;
      if (!oppKey || seenOppIds.has(oppKey)) continue;
      seenOppIds.add(oppKey);
      leads.push({
        id: r.opportunity_id,
        business: r.business_name,
        category: r.business_category || "",
        location: r.location,
        website: r.website_url || "",
        publicEmail: r.public_email || "",
        publicPhone: r.public_phone || "",
        placeName: r.place_name || "",
        placeAddress: r.place_address || "",
        placeStatus: r.place_business_status || "",
        googleMapsUrl: r.place_url || "",
        signalType: r.signal_type || "",
        signalSummary: r.signal_summary || "",
        verificationStatus: r.verification_status || "needs_review",
        sourceTitle: r.source_title || "",
        source: r.source_url,
        stage: r.review_stage || "saved",
        notes: r.qualification_notes || "",
        emailDraft: r.outreach_draft || "",
      });
      if (leads.length >= limit) break;
    }

    const message =
      leads.length === 0
        ? stage !== "all"
          ? `You do not have any saved leads in the "${stage}" stage yet. Save leads from GoLeads or query with stage="all".`
          : "You do not have any saved leads in your GoLeads account yet. Run a search in GoLeads and click 'Save lead' to query them here."
        : `Returned ${leads.length} saved lead(s) from your GoLeads account.`;

    return Response.json(
      {
        ok: true,
        plan: access.plan,
        readOnly: true,
        count: leads.length,
        leads,
        message,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (e) {
    if (e?.code === "PRO_REQUIRED" || e?.status === 403) {
      return Response.json(
        {
          ok: false,
          code: "PRO_REQUIRED",
          error:
            "GoLeads MCP requires an active GoLeads Pro plan (subscription or administrator Pro grant). Upgrade or activate your Pro plan at /plans to query your saved leads from an AI assistant. / El acceso MCP requiere un plan GoLeads Pro activo.",
        },
        { status: 403, headers: { "Cache-Control": "private, no-store" } }
      );
    }
    if (e?.status === 401) {
      return Response.json(
        {
          ok: false,
          code: "UNAUTHORIZED",
          error:
            "Your GoLeads authorization has expired or is missing. Please reconnect your GoLeads account from your AI assistant.",
        },
        { status: 401, headers: { "Cache-Control": "private, no-store" } }
      );
    }
    return Response.json(
      {
        ok: false,
        code: "SERVICE_UNAVAILABLE",
        error: "Unable to load saved leads right now. Please try again in a moment.",
      },
      { status: 503, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}

export const Route = createFileRoute("/api/mcp-leads")({
  server: {
    middleware: [requireUserRoute],
    handlers: {
      GET: async ({ request, context }) => {
        const url = new URL(request.url);
        const raw = {};
        if (url.searchParams.has("limit")) raw.limit = url.searchParams.get("limit");
        if (url.searchParams.has("stage")) raw.stage = url.searchParams.get("stage");
        return handleMcpLeadsRequest(raw, context);
      },
      POST: async ({ request, context }) => {
        const body = await request.json().catch(() => ({}));
        return handleMcpLeadsRequest(body && typeof body === "object" ? body : {}, context);
      },
    },
  },
});