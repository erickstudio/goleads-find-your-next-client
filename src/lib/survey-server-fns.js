import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { loadPlanAccess } from "@/lib/plan-access.server";
import { resolveAdminPanelAccess } from "@/lib/superadmin.server";

export async function createRecoverySignalIfEligible({
  base44,
  user,
  triggerReason = "lingered_on_plans",
  errorDetail = "",
  uiLanguage = "es",
}) {
  if (!user?.id || !user?.email) return { recorded: false, reason: "no_user" };

  const recentPage = await base44.entities.SubscriptionRecoveryEvent.filter(
    { created_by_id: user.id },
    { sort: "-created_date", limit: 10 }
  ).catch(() => ({ items: [] }));

  const nowMs = Date.now();
  const twelveHoursMs = 12 * 60 * 60 * 1000;
  const recentDuplicate = (recentPage?.items || []).find((ev) => {
    if (ev.created_by_id !== user.id && ev.owner_id !== user.id) return false;
    const ts = new Date(ev.created_at_iso || ev.created_date || 0).getTime();
    return !Number.isNaN(ts) && nowMs - ts < twelveHoursMs;
  });

  if (recentDuplicate) {
    return {
      recorded: false,
      deduplicated: true,
      event: recentDuplicate,
    };
  }

  const profilePage = await base44.entities.UserProfile.filter(
    { created_by_id: user.id },
    { sort: "-created_date", limit: 1 }
  ).catch(() => ({ items: [] }));
  const profile = profilePage?.items?.[0] || null;
  const resolvedLang =
    profile?.ui_language === "en" || profile?.ui_language === "es"
      ? profile.ui_language
      : uiLanguage === "en"
      ? "en"
      : "es";

  const created = await base44.entities.SubscriptionRecoveryEvent.create({
    owner_id: user.id,
    owner_email: user.email,
    user_name:
      profile?.agency_or_freelancer_name ||
      user.full_name ||
      user.email.split("@")[0] ||
      "",
    ui_language: resolvedLang,
    trigger_reason: triggerReason,
    error_detail: String(errorDetail || "").slice(0, 600),
    return_url: "https://goleads.space/plans?recover=1",
    recovery_status: "pending",
    created_at_iso: new Date(nowMs).toISOString(),
  });

  return {
    recorded: true,
    deduplicated: false,
    event: created,
  };
}

export const recordSubscriptionRecoverySignal = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      trigger_reason: z.enum([
        "lingered_on_plans",
        "checkout_failed",
        "checkout_cancelled",
      ]),
      error_detail: z.string().max(500).optional(),
      ui_language: z.enum(["en", "es"]).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const access = await loadPlanAccess(context);
    if (access.isPro) {
      return { recorded: false, reason: "already_pro" };
    }

    return await createRecoverySignalIfEligible({
      base44,
      user: context.user,
      triggerReason: data.trigger_reason,
      errorDetail: data.error_detail || "",
      uiLanguage: data.ui_language || "es",
    });
  });

export const getMyProductSurveyData = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;

    const [profilePage, surveyPage, access] = await Promise.all([
      base44.entities.UserProfile.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 1 }
      ).catch(() => ({ items: [] })),
      base44.entities.ProductSurveyFeedback.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 5 }
      ).catch(() => ({ items: [] })),
      loadPlanAccess(context),
    ]);

    const profile =
      (profilePage?.items || []).find(
        (p) => p.created_by_id === userId && (!p.owner_id || p.owner_id === userId)
      ) || null;

    const existingSurvey =
      (surveyPage?.items || []).find(
        (s) => s.created_by_id === userId && (!s.owner_id || s.owner_id === userId)
      ) || null;

    return {
      user: {
        id: userId,
        email: context.user.email || "",
        full_name:
          profile?.agency_or_freelancer_name || context.user.full_name || "",
      },
      profile,
      access,
      existingSurvey,
    };
  });

export const submitProductSurveyFeedback = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      rating: z.number().int().min(1).max(5),
      nps_score: z.number().int().min(0).max(10),
      improvement_area: z.enum([
        "lead_quality",
        "search_speed",
        "integrations_mcp",
        "pricing_plans",
        "ui_experience",
        "other",
      ]),
      improvement_comment: z
        .string()
        .trim()
        .min(3, "Por favor escribe qué podemos mejorar / Please share what we can improve")
        .max(2000),
      favorite_feature: z.string().trim().max(1000).optional(),
      ui_language: z.enum(["en", "es"]).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;
    const nowIso = new Date().toISOString();

    const [profilePage, existingPage, access] = await Promise.all([
      base44.entities.UserProfile.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 1 }
      ).catch(() => ({ items: [] })),
      base44.entities.ProductSurveyFeedback.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 5 }
      ).catch(() => ({ items: [] })),
      loadPlanAccess(context),
    ]);

    const profile =
      (profilePage?.items || []).find(
        (p) => p.created_by_id === userId && (!p.owner_id || p.owner_id === userId)
      ) || null;
    const existing =
      (existingPage?.items || []).find(
        (s) => s.created_by_id === userId && (!s.owner_id || s.owner_id === userId)
      ) || null;

    const resolvedLang =
      data.ui_language ||
      (profile?.ui_language === "en" ? "en" : "es");

    const payload = {
      owner_id: userId,
      owner_email: context.user.email || profile?.owner_email || "",
      user_name:
        profile?.agency_or_freelancer_name ||
        context.user.full_name ||
        (context.user.email || "").split("@")[0] ||
        "",
      ui_language: resolvedLang,
      rating: data.rating,
      nps_score: data.nps_score,
      improvement_area: data.improvement_area,
      improvement_comment: data.improvement_comment.trim(),
      favorite_feature: (data.favorite_feature || "").trim(),
      plan_at_submission: access.isPro ? "pro" : "free",
      admin_status: existing?.admin_status || "new",
      submitted_at_iso: nowIso,
    };

    if (existing) {
      return await base44.entities.ProductSurveyFeedback.update(
        existing.id,
        payload
      );
    }

    return await base44.entities.ProductSurveyFeedback.create(payload);
  });

export const updateSurveyFeedbackAdminStatus = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string().min(1).max(120),
      admin_status: z.enum(["new", "reviewed", "planned", "resolved"]),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const access = await resolveAdminPanelAccess(base44, context.user);
    if (!access.hasPanelAccess) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    return await base44.asServiceRole.entities.ProductSurveyFeedback.update(
      data.id,
      { admin_status: data.admin_status }
    );
  });