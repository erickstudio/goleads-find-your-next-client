import { isOwnerAccount } from "@/lib/owner-access.server";
import { loadActiveUserProGrants } from "@/lib/plan-access.server";
import crypto from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { computeQuotaUsage } from "@/lib/server-fns";
import {
  getPayPalServerConfig,
  safePayPalApprovalUrl,
  fetchPayPalAccessToken,
  fetchPayPalPlanDetails,
  fetchPayPalSubscriptionDetails,
  reconcilePayPalSubscriptionForUser,
} from "@/lib/paypal-billing.server";

import { customerBillingSummary } from "@/lib/plan-policy";

function filterOwned(items = [], userId) {
  return (items || []).filter(
    (item) =>
      (item.owner_id ? item.owner_id === userId : item.created_by_id === userId)
  );
}

/**
 * Loads the authenticated user's PayPal subscription status, quota usage,
 * and live plan metadata from PayPal (if credentials are configured on the server).
 */
export const getPayPalPlansWorkspaceData = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;

    const [searchesPage, enrollmentsPage, subsPage, profilesPage] =
      await Promise.all([
        base44.entities.LeadSearch.filter(
          { created_by_id: userId },
          { sort: "-created_date", limit: 30 }
        ),
        base44.entities.PilotEnrollment.filter(
          { created_by_id: userId },
          { sort: "-created_date", limit: 20 }
        ),
        base44.entities.PayPalSubscription.filter(
          { owner_id: userId },
          { sort: "-created_date", limit: 20 }
        ),
        base44.entities.UserProfile.filter(
          { created_by_id: userId },
          { sort: "-created_date", limit: 1 }
        ),
      ]);

    const recentSearches = filterOwned(searchesPage?.items, userId);
    const pilotEnrollments = filterOwned(enrollmentsPage?.items, userId);
    const config = getPayPalServerConfig();
    const mySubscriptions = filterOwned(subsPage?.items, userId).filter((s) => s.paypal_environment === config.env && s.paypal_plan_id === config.planId);
    const profile = filterOwned(profilesPage?.items, userId)[0] || null;

    // Query plan directly from PayPal when server credentials are present
    let planVerification = {
      ok: false,
      code: "MISSING_CREDENTIALS",
      message:
        "Configura las credenciales de PayPal en Secretos para que el servidor verifique el plan y obtenga su precio, moneda y frecuencia directamente desde PayPal.",
      plan: null,
    };

    if (config.canAuthenticateWithPayPal) {
      planVerification = await fetchPayPalPlanDetails(config);
    }

    const complimentaryGrants = await loadActiveUserProGrants(base44, context.user);
    const quota = computeQuotaUsage(
      recentSearches,
      Date.now(),
      pilotEnrollments,
      mySubscriptions,
      isOwnerAccount(context.user),
      complimentaryGrants
    );

    return {
      profile,
      ...customerBillingSummary({
        config,
        verification: planVerification,
        subscriptions: mySubscriptions,
        complimentaryGrants,
        quota,
        isOwner: isOwnerAccount(context.user),
      }),
    };
  });

/**
 * Step 2: Before opening PayPal or completing subscription creation, creates an enrollment
 * record in Base44 linked to the authenticated user with a server-generated custom_id
 * and creates the subscription on PayPal using the server-selected plan_id.
 */
export const preparePayPalSubscriptionOrder = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      returnOrigin: z.string().url().max(250).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const serviceRole = base44.asServiceRole;
    const userId = context.user.id;
    const userEmail = context.user.email || "";
    const nowIso = new Date().toISOString();

    const config = getPayPalServerConfig();

    if (!config.canAuthenticateWithPayPal) {
      return {
        ok: false,
        code: "MISSING_SERVER_CREDENTIALS",
        message:
          "No se puede crear la suscripción desde el servidor porque falta PAYPAL_CLIENT_SECRET en los Secretos de la app.",
      };
    }

    if (config.env === "live" && config.commercialLimitsStatus !== "configured") {
      return {
        ok: false,
        code: "MISSING_COMMERCIAL_LIMITS",
        message:
          "El modo Live está bloqueado hasta que configures PAYPAL_PLAN_SEARCH_ALLOWANCE con el límite comercial de búsquedas por ciclo.",
      };
    }

    if (!config.hasWebhookId) {
      return { ok: false, code: "MISSING_WEBHOOK_CONFIGURATION", message: "Configura PAYPAL_WEBHOOK_ID antes de abrir el pago. El webhook debe poder verificar las notificaciones de PayPal." };
    }

    // Prevent duplicate active subscriptions for the same user
    const existingSubsPage = await base44.entities.PayPalSubscription.filter(
      { owner_id: userId },
      { sort: "-created_date", limit: 15 }
    );
    const ownedSubs = filterOwned(existingSubsPage?.items, userId);
    const alreadyActive = ownedSubs.find(
      (s) => s.status === "active" || s.status === "trialing"
    );
    if (alreadyActive) {
      return {
        ok: false,
        code: "ALREADY_ACTIVE",
        message: `Ya tienes una suscripción activa (${
          alreadyActive.paypal_subscription_id || alreadyActive.id
        }).`,
      };
    }

    // Verify credentials and plan belong to the same environment & merchant account
    const tokenRes = await fetchPayPalAccessToken(config);
    if (!tokenRes.ok) {
      return {
        ok: false,
        code: tokenRes.code,
        message: tokenRes.message,
      };
    }

    const planRes = await fetchPayPalPlanDetails(config, tokenRes.accessToken);
    if (!planRes.ok || !planRes.plan) {
      return {
        ok: false,
        code: planRes.code || "PLAN_MISMATCH",
        message: planRes.message,
      };
    }

    if (planRes.plan.status && planRes.plan.status !== "ACTIVE") {
      return {
        ok: false,
        code: "PLAN_NOT_ACTIVE",
        message: `El plan ${config.planId} existe en PayPal (${config.env}), pero su estado es '${planRes.plan.status}' en lugar de 'ACTIVE'.`,
      };
    }

    const enrollmentReference = `glsub_${userId.slice(0, 8)}_${crypto.randomUUID()}`;

    // 1. Create enrollment record linked to the authenticated user BEFORE opening PayPal
    const enrollmentRecord = await serviceRole.entities.PayPalSubscription.create({
      owner_id: userId,
      owner_email: userEmail,
      enrollment_reference: enrollmentReference,
      paypal_plan_id: config.planId,
      paypal_environment: config.env,
      status: "pending_approval",
      paypal_raw_status: "APPROVAL_PENDING",
      plan_name: planRes.plan.name || config.planId,
      billing_amount: String(planRes.plan.amount || ""),
      billing_currency: String(planRes.plan.currency || "USD"),
      billing_interval_unit: String(planRes.plan.intervalUnit || "MONTH"),
      billing_interval_count: Number(planRes.plan.intervalCount) || 1,
      commercial_limits_status: config.commercialLimitsStatus,
      granted_search_allowance: 0,
      used_subscription_searches: 0,
      created_at_iso: nowIso,
      status_note:
        "Registro de contratación creado en el servidor. Esperando aprobación del usuario en PayPal.",
    });

    const appOrigin = "https://goleads.space";
    const allowedOrigins = new Set([appOrigin, "https://go-leads-magic-flow.base44.app", "https://preview-sandbox--6ae63656edc313a907ad5680.base44.app"]);
    const safeOrigin = allowedOrigins.has(data?.returnOrigin) ? data.returnOrigin : appOrigin;

    // 2. Create the subscription on PayPal from the server with custom_id = enrollmentReference
    const createSubBody = {
      plan_id: config.planId,
      custom_id: enrollmentReference,
      application_context: {
        brand_name: "GoLeads",
        user_action: "SUBSCRIBE_NOW",
        return_url: `${safeOrigin}/plans?paypal=approved&enrollment_id=${encodeURIComponent(enrollmentRecord.id)}`,
        cancel_url: `${safeOrigin}/plans?paypal=cancelled&enrollment_id=${encodeURIComponent(enrollmentRecord.id)}`,
      },
    };
    // Let PayPal collect the buyer details. Pre-filling the app account email can force a wallet login instead of card checkout.

    const createRes = await fetch(
      `${config.apiBaseUrl}/v1/billing/subscriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenRes.accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "PayPal-Request-Id": enrollmentReference,
        },
        body: JSON.stringify(createSubBody),
      }
    );

    const createdSub = await createRes.json().catch(() => ({}));
    if (!createRes.ok || !createdSub?.id) {
      await serviceRole.entities.PayPalSubscription.update(enrollmentRecord.id, {
        status: "verification_failed",
        status_note:
          createdSub?.message ||
          `PayPal rechazó la creación de la suscripción (HTTP ${createRes.status}).`,
      });
      return {
        ok: false,
        code: "PAYPAL_CREATE_SUBSCRIPTION_FAILED",
        message:
          createdSub?.message ||
          `No se pudo crear la suscripción en PayPal (${createRes.status}).`,
      };
    }

    const approvalUrl = safePayPalApprovalUrl((createdSub.links || []).find((link) => link.rel === "approve")?.href, config.env);
    if (!approvalUrl) {
      await serviceRole.entities.PayPalSubscription.update(enrollmentRecord.id, { status: "verification_failed", status_note: "PayPal did not return a trusted approval URL." });
      return { ok: false, code: "INVALID_APPROVAL_URL", message: "No se pudo abrir el pago con PayPal." };
    }

    await serviceRole.entities.PayPalSubscription.update(enrollmentRecord.id, {
      paypal_subscription_id: createdSub.id,
      paypal_raw_status: String(createdSub.status || "APPROVAL_PENDING"),
    });

    return {
      ok: true,
      subscriptionId: createdSub.id,
      approvalUrl,
      enrollmentId: enrollmentRecord.id,
      customId: enrollmentReference,
    };
  });

/**
 * Step 3: Replaces browser onApprove alert with server-side verification against PayPal API.
 * Never grants access from browser approval alone.
 */
export const confirmPayPalSubscriptionOnServer = createServerFn({
  method: "POST",
})
  .middleware([requireUser])
  .validator(
    z.object({
      subscription_id: z.string().trim().min(3).max(140),
      enrollment_id: z.string().trim().max(140).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const serviceRole = base44.asServiceRole;
    const userId = context.user.id;

    const config = getPayPalServerConfig();
    if (!config.canAuthenticateWithPayPal) {
      return {
        ok: false,
        verified: false,
        code: "MISSING_SERVER_CREDENTIALS",
        message:
          "No se puede confirmar la suscripción ni conceder acceso porque falta PAYPAL_CLIENT_SECRET en el servidor.",
      };
    }

    // 1. Check if this subscription_id is already linked to another GoLeads user
    const allMatchingSubPage =
      await serviceRole.entities.PayPalSubscription.filter(
        { paypal_subscription_id: data.subscription_id },
        { limit: 10 }
      );
    const matchingSubRecords = allMatchingSubPage?.items || [];
    const otherUserRecord = matchingSubRecords.find(
      (rec) =>
        rec.owner_id !== userId
    );
    if (otherUserRecord) {
      return {
        ok: false,
        verified: false,
        code: "CROSS_ACCOUNT_CONFLICT",
        message:
          "Esta suscripción de PayPal ya está vinculada a otra cuenta de GoLeads. No se concedió acceso.",
      };
    }

    // 2. Locate the current user's enrollment record
    let enrollmentRecord = null;
    if (data.enrollment_id) {
      const byIdPage = await base44.entities.PayPalSubscription.filter(
        { id: data.enrollment_id, owner_id: userId },
        { limit: 1 }
      );
      enrollmentRecord = filterOwned(byIdPage?.items, userId)[0] || null;
    }
    if (!enrollmentRecord) {
      enrollmentRecord =
        matchingSubRecords.find(
          (rec) =>
            rec.owner_id === userId
        ) || null;
    }

    if (!enrollmentRecord) {
      return {
        ok: false,
        verified: false,
        code: "ENROLLMENT_NOT_FOUND",
        message:
          "No se encontró un registro de contratación iniciado por tu cuenta para esta suscripción.",
      };
    }

    // 3. Query PayPal directly for both the subscription and plan details
    const tokenRes = await fetchPayPalAccessToken(config);
    if (!tokenRes.ok) {
      return {
        ok: false,
        verified: false,
        code: tokenRes.code,
        message: tokenRes.message,
      };
    }

    const [subRes, planRes] = await Promise.all([
      fetchPayPalSubscriptionDetails(
        config,
        data.subscription_id,
        tokenRes.accessToken
      ),
      fetchPayPalPlanDetails(config, tokenRes.accessToken),
    ]);

    if (!subRes.ok || !subRes.subscription) {
      return {
        ok: false,
        verified: false,
        code: subRes.code,
        message: subRes.message,
      };
    }

    return await reconcilePayPalSubscriptionForUser({
      serviceRoleBase44: serviceRole,
      userId,
      enrollmentRecord,
      remoteSubscription: subRes.subscription,
      planDetails: planRes.plan,
      config,
    });
  });

/**
 * Records checkout cancellation or error when the user closes/cancels the PayPal window.
 */
export const recordPayPalCheckoutCancelOrError = createServerFn({
  method: "POST",
})
  .middleware([requireUser])
  .validator(
    z.object({
      enrollment_id: z.string().trim().max(140).optional(),
      subscription_id: z.string().trim().max(140).optional(),
      outcome: z.enum(["cancelled", "error"]),
      reason: z.string().max(400).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const serviceRole = base44.asServiceRole;
    const userId = context.user.id;

    const subsPage = await base44.entities.PayPalSubscription.filter(
      { owner_id: userId },
      { sort: "-created_date", limit: 10 }
    );
    const owned = filterOwned(subsPage?.items, userId);
    const target =
      owned.find(
        (s) =>
          (data.enrollment_id && s.id === data.enrollment_id) ||
          (data.subscription_id &&
            s.paypal_subscription_id === data.subscription_id)
      ) ||
      owned.find((s) => s.status === "pending_approval") ||
      null;

    if (!target || target.status === "active" || target.status === "trialing") {
      return { updated: false };
    }

    const nextStatus =
      data.outcome === "cancelled" ? "cancelled" : "verification_failed";
    const note =
      data.outcome === "cancelled"
        ? "Proceso de suscripción cancelado por el usuario antes de completar la aprobación en PayPal. No se otorgó acceso ni se realizaron cargos."
        : `Error durante el proceso con PayPal: ${
            data.reason || "No se completó la aprobación."
          }`;

    const updated = await serviceRole.entities.PayPalSubscription.update(
      target.id,
      {
        status: nextStatus,
        paypal_raw_status:
          data.outcome === "cancelled" ? "CANCELLED_BY_USER" : "CHECKOUT_ERROR",
        granted_search_allowance: 0,
        cancelled_at_iso:
          data.outcome === "cancelled"
            ? new Date().toISOString()
            : target.cancelled_at_iso || "",
        status_note: note,
      }
    );

    return {
      updated: true,
      subscriptionRecord: updated,
      message: note,
    };
  });

/**
 * Cancels the user's active PayPal subscription on PayPal's server and updates local state
 * while preserving the user's already-paid period until current_period_end_iso.
 */
export const cancelUserPayPalSubscription = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string().trim().min(1).max(140),
      reason: z.string().trim().max(240).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const serviceRole = base44.asServiceRole;
    const userId = context.user.id;

    const subPage = await base44.entities.PayPalSubscription.filter(
      { id: data.id, owner_id: userId },
      { limit: 1 }
    );
    const subRecord = filterOwned(subPage?.items, userId)[0] || null;
    if (!subRecord) {
      throw new Error("No se encontró la suscripción en tu cuenta.");
    }

    const config = getPayPalServerConfig();
    const nowIso = new Date().toISOString();

    if (
      subRecord.paypal_subscription_id &&
      config.canAuthenticateWithPayPal &&
      subRecord.paypal_raw_status !== "CANCELLED"
    ) {
      const tokenRes = await fetchPayPalAccessToken(config);
      if (!tokenRes.ok) {
        throw new Error(tokenRes.message);
      }

      const cancelRes = await fetch(
        `${config.apiBaseUrl}/v1/billing/subscriptions/${encodeURIComponent(
          subRecord.paypal_subscription_id
        )}/cancel`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenRes.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason:
              data.reason || "Cancelled by user from GoLeads subscription settings",
          }),
        }
      );

      if (!cancelRes.ok && cancelRes.status !== 204) {
        const errBody = await cancelRes.json().catch(() => ({}));
        throw new Error(
          errBody?.message ||
            `PayPal no pudo cancelar la suscripción (HTTP ${cancelRes.status}).`
        );
      }
    }

    const periodEnd = subRecord.current_period_end_iso || "";
    const hasPaidPeriodLeft =
      periodEnd && new Date(periodEnd).getTime() > Date.now();

    const updated = await serviceRole.entities.PayPalSubscription.update(
      subRecord.id,
      {
        status: "cancelled",
        paypal_raw_status: "CANCELLED",
        cancel_at_period_end: true,
        cancelled_at_iso: nowIso,
        status_note: hasPaidPeriodLeft
          ? `Suscripción cancelada. Conservas tus ${Math.max(
              0,
              (Number(subRecord.granted_search_allowance) || 0) -
                (Number(subRecord.used_subscription_searches) || 0)
            )} búsquedas disponibles hasta el fin del periodo pagado (${periodEnd.slice(
              0,
              10
            )}).`
          : "Suscripción cancelada. No se realizarán cobros futuros.",
      }
    );

    return {
      ok: true,
      subscriptionRecord: updated,
      message: updated.status_note,
    };
  });