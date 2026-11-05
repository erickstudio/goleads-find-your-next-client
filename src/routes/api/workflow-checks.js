import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireUserRoute } from "@/lib/auth-middleware";
import { isOwnerAccount } from "@/lib/owner-access.server";
import {
  isPayPalSubscriptionAllowanceActive,
  isProAccessGrantActive,
} from "@/lib/subscription-access";

const WorkflowCheckSchema = z.object({
  action: z.enum([
    "check_pro_promo",
    "check_subscription_recovery",
    "check_feedback_survey",
  ]),
  user_id: z.string().max(140).optional().default(""),
  email: z.string().max(200).optional().default(""),
  event_id: z.string().max(140).optional().default(""),
  trigger_reason: z.string().max(100).optional().default(""),
  ui_language: z.string().max(10).optional().default(""),
});

async function resolveUserContext(serviceRole, userId, rawEmail, fallbackLang) {
  const cleanEmail = String(rawEmail || "").trim().toLowerCase();
  const [profilesPage, subsPage, grantsPage] = await Promise.all([
    serviceRole.entities.UserProfile.filter(
      userId ? { created_by_id: userId } : {},
      { sort: "-created_date", limit: 30 }
    ).catch(() => ({ items: [] })),
    userId
      ? serviceRole.entities.PayPalSubscription.filter(
          { owner_id: userId },
          { sort: "-created_date", limit: 15 }
        ).catch(() => ({ items: [] }))
      : Promise.resolve({ items: [] }),
    serviceRole.entities.ProAccessGrant.filter(
      { status: "active" },
      { sort: "-created_date", limit: 50 }
    ).catch(() => ({ items: [] })),
  ]);

  const profile =
    (profilesPage?.items || []).find(
      (p) =>
        (userId && (p.owner_id === userId || p.created_by_id === userId)) ||
        (cleanEmail && String(p.owner_email || "").trim().toLowerCase() === cleanEmail)
    ) || null;

  const recipientEmail = String(
    cleanEmail || profile?.owner_email || ""
  ).trim();
  const language =
    profile?.ui_language === "es" || profile?.ui_language === "en"
      ? profile.ui_language
      : fallbackLang === "es"
      ? "es"
      : "en";

  const firstName =
    String(profile?.agency_or_freelancer_name || "").trim() ||
    (language === "es" ? "equipo" : "there");

  const nowMs = Date.now();
  const hasActiveSub = (subsPage?.items || []).some((s) =>
    isPayPalSubscriptionAllowanceActive(s, nowMs)
  );
  const hasActiveGrant = (grantsPage?.items || []).some(
    (g) =>
      isProAccessGrantActive(g, nowMs) &&
      ((userId && g.target_user_id === userId) ||
        (recipientEmail &&
          String(g.target_email || "").trim().toLowerCase() ===
            recipientEmail.toLowerCase()))
  );
  const isOwner = userId ? isOwnerAccount({ id: userId }) : false;
  const isPro = Boolean(hasActiveSub || hasActiveGrant || isOwner);

  return {
    profile,
    recipientEmail,
    language,
    firstName,
    isPro,
  };
}

export const Route = createFileRoute("/api/workflow-checks")({
  server: {
    middleware: [requireUserRoute],
    handlers: {
      POST: async ({ request, context }) => {
        if (context.user?.role !== "admin" && !isOwnerAccount(context.user)) {
          return Response.json(
            { ok: false, error: "Forbidden: Admin workflow execution only." },
            { status: 403 }
          );
        }

        const rawBody = await request.json().catch(() => ({}));
        const parsed = WorkflowCheckSchema.safeParse(rawBody || {});
        if (!parsed.success) {
          return Response.json(
            { ok: false, should_send: false, error: "Invalid workflow check payload" },
            { status: 400 }
          );
        }

        const { action, user_id, email, event_id, trigger_reason, ui_language } =
          parsed.data;
        const serviceRole = context.getBase44().asServiceRole;

        const userCtx = await resolveUserContext(
          serviceRole,
          user_id,
          email,
          ui_language
        );

        if (!userCtx.recipientEmail) {
          return Response.json({
            ok: true,
            should_send: false,
            language: userCtx.language,
            email: "",
            first_name: userCtx.firstName,
          });
        }

        if (action === "check_pro_promo") {
          return Response.json({
            ok: true,
            should_send: !userCtx.isPro,
            language: userCtx.language,
            email: userCtx.recipientEmail,
            first_name: userCtx.firstName,
            cta_url: "https://goleads.space/plans",
          });
        }

        if (action === "check_subscription_recovery") {
          if (userCtx.isPro) {
            if (event_id) {
              await serviceRole.entities.SubscriptionRecoveryEvent.update(
                event_id,
                { recovery_status: "converted_to_pro" }
              ).catch(() => null);
            }
            return Response.json({
              ok: true,
              should_send: false,
              language: userCtx.language,
              email: userCtx.recipientEmail,
              first_name: userCtx.firstName,
              recovery_note: "",
              cta_url: "https://goleads.space/plans?recover=1",
            });
          }

          if (event_id) {
            await serviceRole.entities.SubscriptionRecoveryEvent.update(
              event_id,
              { recovery_status: "email_sent" }
            ).catch(() => null);
          }

          const isEs = userCtx.language === "es";
          const recoveryNote =
            trigger_reason === "checkout_failed"
              ? isEs
                ? "Detectamos que intentaste activar GoLeads Pro pero ocurrió un fallo técnico durante la conexión con el proveedor de pago."
                : "We noticed you tried to activate GoLeads Pro, but a technical issue interrupted the payment step."
              : trigger_reason === "checkout_cancelled"
              ? isEs
                ? "Vimos que iniciaste el proceso de suscripción a GoLeads Pro pero se cerró antes de confirmarse."
                : "We saw that you started your GoLeads Pro subscription checkout, but the window closed before completion."
              : isEs
              ? "Notamos que estuviste revisando GoLeads Pro en la página de suscripción sin llegar a completar el paso final."
              : "We noticed you were reviewing GoLeads Pro on the subscription page without completing the final step.";

          return Response.json({
            ok: true,
            should_send: true,
            language: userCtx.language,
            email: userCtx.recipientEmail,
            first_name: userCtx.firstName,
            recovery_note: recoveryNote,
            cta_url: "https://goleads.space/plans?recover=1",
          });
        }

        if (action === "check_feedback_survey") {
          const existingSurveys = await serviceRole.entities.ProductSurveyFeedback.filter(
            user_id ? { owner_id: user_id } : {},
            { sort: "-created_date", limit: 10 }
          ).catch(() => ({ items: [] }));

          const alreadySubmitted = (existingSurveys?.items || []).some(
            (s) =>
              (user_id && (s.owner_id === user_id || s.created_by_id === user_id)) ||
              String(s.owner_email || "").trim().toLowerCase() ===
                userCtx.recipientEmail.toLowerCase()
          );

          return Response.json({
            ok: true,
            should_send: !alreadySubmitted,
            language: userCtx.language,
            email: userCtx.recipientEmail,
            first_name: userCtx.firstName,
            cta_url: "https://goleads.space/survey",
          });
        }

        return Response.json({ ok: true, should_send: false });
      },
    },
  },
});