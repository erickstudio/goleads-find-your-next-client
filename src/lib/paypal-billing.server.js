import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import { secrets } from "base44:runtime";
import { PILOT_OFFER_SPEC } from "@/lib/pilot-billing.server";

export const DEFAULT_PAYPAL_PUBLIC_CLIENT_ID =
  "BAAjPq8ShjwUsg-zT-d8XZ2T21qIDYvltuYTaDvaGU42zys0xukFCxej3yE3Vh2qBuOIno1S-ZLKF_ufU8";
export const DEFAULT_PAYPAL_PLAN_ID = "P-45W768000B945962BNLT2VZY";
export const PAYPAL_SDK_BASE_URL = "https://www.paypal.com/sdk/js";

export const REQUIRED_PAYPAL_WEBHOOK_EVENTS = [
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.UPDATED",
  "BILLING.SUBSCRIPTION.RE-ACTIVATED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.EXPIRED",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
  "PAYMENT.SALE.COMPLETED",
  "PAYMENT.SALE.DENIED",
];

export function getPayPalApiBaseUrl(env = "sandbox") {
  return env === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

/**
 * Reads PayPal configuration from server-side secrets.
 * Client Secret, Webhook ID, and OAuth tokens remain strictly on the server.
 */
export function getPayPalServerConfig(overrides = {}) {
  const rawEnv = String(
    overrides.env ?? secrets.get("PAYPAL_ENV") ?? "sandbox"
  )
    .trim()
    .toLowerCase();
  const env = rawEnv === "live" ? "live" : "sandbox";

  const secretClientId = String(
    overrides.clientId ?? secrets.get("PAYPAL_CLIENT_ID") ?? ""
  ).trim();
  const clientId = secretClientId || DEFAULT_PAYPAL_PUBLIC_CLIENT_ID;

  const clientSecret = String(
    overrides.clientSecret ?? secrets.get("PAYPAL_CLIENT_SECRET") ?? ""
  ).trim();

  const secretPlanId = String(
    overrides.planId ?? secrets.get("PAYPAL_PLAN_ID") ?? ""
  ).trim();
  const planId = secretPlanId || DEFAULT_PAYPAL_PLAN_ID;

  const webhookId = String(
    overrides.webhookId ?? secrets.get("PAYPAL_WEBHOOK_ID") ?? ""
  ).trim();

  const rawAllowance = String(
    overrides.planSearchAllowance ??
      secrets.get("PAYPAL_PLAN_SEARCH_ALLOWANCE") ??
      ""
  ).trim();
  const parsedAllowance = rawAllowance ? Number(rawAllowance) : NaN;
  const hasConfiguredAllowance =
    Number.isFinite(parsedAllowance) && parsedAllowance > 0;

  const missingSecrets = [];
  if (!secretClientId) {
    missingSecrets.push({
      name: "PAYPAL_CLIENT_ID",
      required: false,
      status: "using_default_button_client_id",
      description:
        "Client ID público de la app REST de PayPal (actualmente usando el Client ID del botón proporcionado; configúralo en Secretos si usas una app Sandbox distinta).",
    });
  }
  if (!clientSecret) {
    missingSecrets.push({
      name: "PAYPAL_CLIENT_SECRET",
      required: true,
      status: "missing",
      description:
        "Client Secret de tu app REST de PayPal (obligatorio en el servidor para obtener tokens OAuth2, consultar el plan, crear suscripciones y verificar estados).",
    });
  }
  if (!secretPlanId) {
    missingSecrets.push({
      name: "PAYPAL_PLAN_ID",
      required: false,
      status: "using_default_button_plan_id",
      description: `ID del plan de suscripción en PayPal (actualmente usando ${DEFAULT_PAYPAL_PLAN_ID}).`,
    });
  }
  if (!webhookId) {
    missingSecrets.push({
      name: "PAYPAL_WEBHOOK_ID",
      required: true,
      status: "missing",
      description:
        "Webhook ID generado por PayPal al registrar el endpoint /api/paypal-webhook (obligatorio para verificar la firma criptográfica de los webhooks).",
    });
  }
  if (!secrets.get("PAYPAL_ENV") && !overrides.env) {
    missingSecrets.push({
      name: "PAYPAL_ENV",
      required: false,
      status: "defaulting_to_sandbox",
      description:
        "Entorno de PayPal ('sandbox' o 'live'). Por seguridad predeterminado en 'sandbox' para evitar cobros reales.",
    });
  }
  if (!hasConfiguredAllowance) {
    missingSecrets.push({
      name: "PAYPAL_PLAN_SEARCH_ALLOWANCE",
      required: false,
      status: "pending_commercial_limit",
      description:
        "Cantidad de búsquedas en vivo que otorga cada ciclo del plan en GoLeads (ej. 30). En Sandbox se aplican 10 búsquedas de prueba mientras este límite comercial siga pendiente.",
    });
  }

  const effectiveCycleAllowance = hasConfiguredAllowance
    ? Math.floor(parsedAllowance)
    : env === "sandbox"
    ? PILOT_OFFER_SPEC.testSandboxConfig.testAllowanceSearches
    : 0;

  return {
    env,
    apiBaseUrl: getPayPalApiBaseUrl(env),
    clientId,
    hasCustomClientIdSecret: Boolean(secretClientId),
    clientSecret,
    hasClientSecret: Boolean(clientSecret),
    planId,
    hasCustomPlanIdSecret: Boolean(secretPlanId),
    webhookId,
    hasWebhookId: Boolean(webhookId),
    hasConfiguredAllowance,
    configuredAllowance: hasConfiguredAllowance ? Math.floor(parsedAllowance) : null,
    effectiveCycleAllowance,
    commercialLimitsStatus: hasConfiguredAllowance
      ? "configured"
      : "pending_owner_config",
    canAuthenticateWithPayPal: Boolean(clientId && clientSecret),
    missingSecrets,
  };
}

export function toPublicPayPalConfigStatus(config) {
  return {
    env: config.env,
    apiBaseUrl: config.apiBaseUrl,
    clientId: config.clientId,
    planId: config.planId,
    sdkUrl: `${PAYPAL_SDK_BASE_URL}?client-id=${encodeURIComponent(
      config.clientId
    )}&vault=true&intent=subscription`,
    hasClientSecret: config.hasClientSecret,
    hasWebhookId: config.hasWebhookId,
    hasConfiguredAllowance: config.hasConfiguredAllowance,
    configuredAllowance: config.configuredAllowance,
    effectiveCycleAllowance: config.effectiveCycleAllowance,
    commercialLimitsStatus: config.commercialLimitsStatus,
    canAuthenticateWithPayPal: config.canAuthenticateWithPayPal,
    missingSecrets: config.missingSecrets,
    requiredWebhookEvents: REQUIRED_PAYPAL_WEBHOOK_EVENTS,
  };
}

/**
 * Obtains an OAuth2 access token from PayPal using client_credentials.
 * Never simulates a connection when PAYPAL_CLIENT_SECRET is missing.
 */
export async function fetchPayPalAccessToken(config, fetchImpl = fetch) {
  if (!config.clientId || !config.clientSecret) {
    return {
      ok: false,
      code: "MISSING_CREDENTIALS",
      message:
        "Falta PAYPAL_CLIENT_SECRET en los Secretos de la app. Configura PAYPAL_CLIENT_SECRET (y verifica que PAYPAL_CLIENT_ID y PAYPAL_PLAN_ID correspondan al mismo entorno Sandbox/Live) para autenticar el servidor con PayPal.",
    };
  }

  const basicAuth = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
    "utf8"
  ).toString("base64");

  try {
    const res = await fetchImpl(`${config.apiBaseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: "grant_type=client_credentials",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.access_token) {
      return {
        ok: false,
        code: "AUTH_FAILED",
        httpStatus: res.status,
        message:
          data?.error_description ||
          data?.message ||
          `PayPal rechazó las credenciales en el entorno '${config.env}' (HTTP ${res.status}). Verifica que PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET pertenezcan al mismo entorno (${config.env}) y cuenta comercial.`,
      };
    }

    return {
      ok: true,
      accessToken: data.access_token,
      appId: data.app_id || null,
      scope: data.scope || "",
    };
  } catch (err) {
    return {
      ok: false,
      code: "NETWORK_ERROR",
      message: err?.message || "No se pudo conectar con la API OAuth2 de PayPal.",
    };
  }
}

/**
 * Queries the plan directly from PayPal's REST API (/v1/billing/plans/{plan_id})
 * to verify it belongs to the same environment and merchant account and to read
 * authoritative pricing, currency, and billing frequency (never deduced from client button code).
 */
export async function fetchPayPalPlanDetails(
  config,
  accessToken = null,
  fetchImpl = fetch
) {
  let token = accessToken;
  if (!token) {
    const tokenRes = await fetchPayPalAccessToken(config, fetchImpl);
    if (!tokenRes.ok) {
      return {
        ok: false,
        code: tokenRes.code,
        message: tokenRes.message,
        plan: null,
      };
    }
    token = tokenRes.accessToken;
  }

  try {
    const res = await fetchImpl(
      `${config.apiBaseUrl}/v1/billing/plans/${encodeURIComponent(config.planId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    const rawPlan = await res.json().catch(() => ({}));
    if (!res.ok || !rawPlan?.id) {
      return {
        ok: false,
        code: res.status === 404 ? "PLAN_NOT_FOUND_IN_ENV" : "PLAN_LOOKUP_FAILED",
        httpStatus: res.status,
        message:
          res.status === 404
            ? `El plan ${config.planId} no existe en el entorno '${config.env}' o no pertenece a la cuenta comercial de las credenciales configuradas.`
            : rawPlan?.message ||
              `No se pudo consultar el plan ${config.planId} en PayPal (${config.env}, HTTP ${res.status}).`,
        plan: null,
      };
    }

    const cycles = Array.isArray(rawPlan.billing_cycles)
      ? rawPlan.billing_cycles
      : [];
    const regularCycle =
      cycles.find((c) => c.tenure_type === "REGULAR") || cycles[0] || null;
    const trialCycle = cycles.find((c) => c.tenure_type === "TRIAL") || null;

    const fixedPrice = regularCycle?.pricing_scheme?.fixed_price || null;
    const frequency = regularCycle?.frequency || null;

    return {
      ok: true,
      code: "VERIFIED",
      message: `Plan ${rawPlan.id} verificado directamente en PayPal (${config.env}).`,
      plan: {
        id: rawPlan.id,
        productId: rawPlan.product_id || "",
        name: rawPlan.name || rawPlan.id,
        description: rawPlan.description || "",
        status: rawPlan.status || "UNKNOWN",
        amount: fixedPrice?.value ? String(fixedPrice.value) : null,
        currency: fixedPrice?.currency_code
          ? String(fixedPrice.currency_code)
          : null,
        intervalUnit: frequency?.interval_unit
          ? String(frequency.interval_unit)
          : null,
        intervalCount: Number(frequency?.interval_count) || 1,
        hasTrial: Boolean(trialCycle),
        trialIntervalUnit: trialCycle?.frequency?.interval_unit || null,
        trialIntervalCount: Number(trialCycle?.frequency?.interval_count) || 0,
        trialTotalCycles: Number(trialCycle?.total_cycles) || 0,
      },
    };
  } catch (err) {
    return {
      ok: false,
      code: "PLAN_NETWORK_ERROR",
      message:
        err?.message || "Error de red al consultar los detalles del plan en PayPal.",
      plan: null,
    };
  }
}

/**
 * Fetches a subscription directly from PayPal's REST API (/v1/billing/subscriptions/{id}).
 */
export async function fetchPayPalSubscriptionDetails(
  config,
  subscriptionId,
  accessToken = null,
  fetchImpl = fetch
) {
  if (!subscriptionId) {
    return {
      ok: false,
      code: "MISSING_SUBSCRIPTION_ID",
      message: "Falta el ID de la suscripción de PayPal.",
      subscription: null,
    };
  }

  let token = accessToken;
  if (!token) {
    const tokenRes = await fetchPayPalAccessToken(config, fetchImpl);
    if (!tokenRes.ok) {
      return {
        ok: false,
        code: tokenRes.code,
        message: tokenRes.message,
        subscription: null,
      };
    }
    token = tokenRes.accessToken;
  }

  const res = await fetchImpl(
    `${config.apiBaseUrl}/v1/billing/subscriptions/${encodeURIComponent(
      subscriptionId
    )}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );

  const rawSub = await res.json().catch(() => ({}));
  if (!res.ok || !rawSub?.id) {
    return {
      ok: false,
      code:
        res.status === 404
          ? "SUBSCRIPTION_NOT_FOUND_IN_ENV"
          : "SUBSCRIPTION_LOOKUP_FAILED",
      httpStatus: res.status,
      message:
        res.status === 404
          ? `La suscripción ${subscriptionId} no existe en la cuenta comercial/entorno '${config.env}'.`
          : rawSub?.message ||
            `No se pudo verificar la suscripción ${subscriptionId} en PayPal (HTTP ${res.status}).`,
      subscription: null,
    };
  }

  return {
    ok: true,
    code: "FOUND",
    subscription: rawSub,
  };
}

/**
 * Computes period end timestamp when PayPal does not explicitly provide next_billing_time
 * (e.g., on initial activation or single cycle).
 */
export function computeFallbackPeriodEndIso(
  startIso,
  intervalUnit = "MONTH",
  intervalCount = 1
) {
  const baseDate = startIso ? new Date(startIso) : new Date();
  const baseMs = Number.isNaN(baseDate.getTime())
    ? Date.now()
    : baseDate.getTime();
  const count = Math.max(1, Number(intervalCount) || 1);
  const unit = String(intervalUnit || "MONTH").toUpperCase();
  const dayMs = 24 * 60 * 60 * 1000;
  if (unit === "DAY") return new Date(baseMs + count * dayMs).toISOString();
  if (unit === "WEEK") return new Date(baseMs + count * 7 * dayMs).toISOString();
  if (unit === "YEAR")
    return new Date(baseMs + count * 365 * dayMs).toISOString();
  return new Date(baseMs + count * 30 * dayMs).toISOString();
}

/**
 * Determines whether a PayPalSubscription record currently grants active search allowance.
 * A cancelled subscription continues to grant its already-paid allowance until current_period_end_iso.
 */
export function isPayPalSubscriptionAllowanceActive(
  sub,
  nowMs = Date.now()
) {
  if (!sub) return false;
  const allowedStatuses = new Set(["active", "trialing", "cancelled"]);
  if (!allowedStatuses.has(sub.status)) return false;

  if (sub.current_period_end_iso) {
    const endMs = new Date(sub.current_period_end_iso).getTime();
    if (!Number.isNaN(endMs) && endMs <= nowMs) {
      return false;
    }
  } else if (sub.status === "cancelled") {
    // If cancelled without a confirmed future period end, do not grant active access
    return false;
  }

  return (Number(sub.granted_search_allowance) || 0) > 0;
}

/**
 * Reconciles and verifies a PayPal subscription against PayPal's authoritative server data:
 * 1. Verifies plan_id matches the server-configured plan.
 * 2. Verifies custom_id matches the user's server-created enrollment_reference.
 * 3. Verifies no other GoLeads user owns this paypal_subscription_id.
 * 4. Applies status, trial/paid dates, and cycle allowance idempotently.
 */
export async function reconcilePayPalSubscriptionForUser({
  serviceRoleBase44,
  userId,
  enrollmentRecord,
  remoteSubscription,
  planDetails,
  config,
  nowIso = new Date().toISOString(),
}) {
  const remoteId = String(remoteSubscription?.id || "").trim();
  const remotePlanId = String(remoteSubscription?.plan_id || "").trim();
  const remoteCustomId = String(remoteSubscription?.custom_id || "").trim();
  const remoteStatus = String(remoteSubscription?.status || "").toUpperCase();

  if (!remoteId) {
    throw new Error("PayPal subscription payload is missing id.");
  }

  // 1. Check cross-account ownership across all PayPalSubscription records
  const bySubIdPage = await serviceRoleBase44.entities.PayPalSubscription.filter(
    { paypal_subscription_id: remoteId },
    { limit: 10 }
  );
  const existingWithSubId = bySubIdPage?.items || [];
  const foreignRecord = existingWithSubId.find(
    (rec) =>
      (rec.owner_id && rec.owner_id !== userId) ||
      (rec.created_by_id && rec.created_by_id !== userId)
  );
  if (foreignRecord) {
    return {
      ok: false,
      verified: false,
      code: "CROSS_ACCOUNT_CONFLICT",
      message:
        "No se puede vincular esta suscripción de PayPal porque ya pertenece a otra cuenta de usuario en GoLeads.",
      subscriptionRecord: null,
    };
  }

  // 2. Verify enrollmentRecord ownership
  if (
    !enrollmentRecord ||
    enrollmentRecord.owner_id !== userId ||
    (enrollmentRecord.created_by_id &&
      enrollmentRecord.created_by_id !== userId)
  ) {
    return {
      ok: false,
      verified: false,
      code: "ENROLLMENT_OWNERSHIP_MISMATCH",
      message:
        "El registro de contratación interno no pertenece al usuario autenticado.",
      subscriptionRecord: null,
    };
  }

  // 3. Verify custom_id matches the server-created enrollment_reference
  if (
    !remoteCustomId ||
    remoteCustomId !== enrollmentRecord.enrollment_reference
  ) {
    const failedUpdate =
      await serviceRoleBase44.entities.PayPalSubscription.update(
        enrollmentRecord.id,
        {
          status: "verification_failed",
          paypal_raw_status: remoteStatus || "UNKNOWN",
          granted_search_allowance: 0,
          status_note: `Verificación rechazada: custom_id de PayPal (${
            remoteCustomId || "vacío"
          }) no coincide con la referencia interna del usuario (${
            enrollmentRecord.enrollment_reference
          }).`,
        }
      );
    return {
      ok: false,
      verified: false,
      code: "CUSTOM_ID_MISMATCH",
      message:
        "La suscripción devuelta por PayPal no coincide con la referencia interna de contratación (custom_id) de tu cuenta.",
      subscriptionRecord: failedUpdate,
    };
  }

  // 4. Verify plan_id matches the server-selected planId
  if (remotePlanId !== config.planId) {
    const failedUpdate =
      await serviceRoleBase44.entities.PayPalSubscription.update(
        enrollmentRecord.id,
        {
          paypal_subscription_id: remoteId,
          status: "verification_failed",
          paypal_raw_status: remoteStatus || "UNKNOWN",
          granted_search_allowance: 0,
          status_note: `Verificación rechazada: el plan en PayPal (${remotePlanId}) no coincide con el plan configurado en el servidor (${config.planId}).`,
        }
      );
    return {
      ok: false,
      verified: false,
      code: "PLAN_ID_MISMATCH",
      message: `El plan de la suscripción (${remotePlanId}) no coincide con el plan permitido por GoLeads (${config.planId}).`,
      subscriptionRecord: failedUpdate,
    };
  }

  const billingInfo = remoteSubscription?.billing_info || {};
  const lastPayment = billingInfo?.last_payment || null;
  const nextBillingTime = billingInfo?.next_billing_time || "";
  const startTime =
    remoteSubscription?.start_time ||
    enrollmentRecord.current_period_start_iso ||
    nowIso;

  const cycleExecutions = Array.isArray(billingInfo?.cycle_executions)
    ? billingInfo.cycle_executions
    : [];
  const activeTrialExec = cycleExecutions.find(
    (c) =>
      c.tenure_type === "TRIAL" &&
      (Number(c.cycles_completed) || 0) < (Number(c.total_cycles) || 1)
  );
  const isTrialPeriod = Boolean(activeTrialExec);

  const subscriberEmail =
    remoteSubscription?.subscriber?.email_address ||
    enrollmentRecord.subscriber_email ||
    "";
  const subscriberPayerId =
    remoteSubscription?.subscriber?.payer_id ||
    enrollmentRecord.subscriber_payer_id ||
    "";

  const planName =
    planDetails?.name || enrollmentRecord.plan_name || `PayPal Plan ${config.planId}`;
  const billingAmount =
    lastPayment?.amount?.value ||
    planDetails?.amount ||
    enrollmentRecord.billing_amount ||
    "";
  const billingCurrency =
    lastPayment?.amount?.currency_code ||
    planDetails?.currency ||
    enrollmentRecord.billing_currency ||
    "USD";
  const intervalUnit =
    planDetails?.intervalUnit ||
    enrollmentRecord.billing_interval_unit ||
    "MONTH";
  const intervalCount =
    planDetails?.intervalCount ||
    enrollmentRecord.billing_interval_count ||
    1;

  const periodEndIso =
    nextBillingTime ||
    enrollmentRecord.current_period_end_iso ||
    computeFallbackPeriodEndIso(startTime, intervalUnit, intervalCount);

  const cycleKey = `${remoteId}:${
    lastPayment?.time || startTime
  }:${periodEndIso}`;

  let internalStatus = "pending_approval";
  let grantedAllowance = Number(enrollmentRecord.granted_search_allowance) || 0;
  let usedSearches = Number(enrollmentRecord.used_subscription_searches) || 0;
  let cancelAtPeriodEnd = Boolean(enrollmentRecord.cancel_at_period_end);
  let statusNote = "";

  if (remoteStatus === "ACTIVE") {
    internalStatus = isTrialPeriod ? "trialing" : "active";
    cancelAtPeriodEnd = false;
    // Grant or refresh cycle allowance only if this cycle has not been credited yet
    if (
      enrollmentRecord.current_cycle_id !== cycleKey ||
      grantedAllowance === 0
    ) {
      grantedAllowance = config.effectiveCycleAllowance;
      if (
        enrollmentRecord.current_cycle_id &&
        enrollmentRecord.current_cycle_id !== cycleKey
      ) {
        usedSearches = 0;
      }
    }
    statusNote =
      config.commercialLimitsStatus === "configured"
        ? `Suscripción verificada en PayPal (${remoteStatus}). Acceso activo con ${grantedAllowance} búsquedas en el ciclo actual.`
        : `Suscripción verificada en PayPal (${remoteStatus}, entorno ${config.env}). Cuota comercial definitiva pendiente de configurar en PAYPAL_PLAN_SEARCH_ALLOWANCE (usando ${grantedAllowance} búsquedas de ciclo).`;
  } else if (remoteStatus === "APPROVED" || remoteStatus === "APPROVAL_PENDING") {
    internalStatus = "approval_pending_verification";
    grantedAllowance = 0;
    statusNote = `La suscripción está en estado ${remoteStatus} en PayPal. Los permisos se activarán automáticamente cuando PayPal confirme el estado ACTIVE o el pago inicial.`;
  } else if (remoteStatus === "CANCELLED") {
    internalStatus = "cancelled";
    cancelAtPeriodEnd = true;
    const stillInPaidPeriod =
      periodEndIso && new Date(periodEndIso).getTime() > Date.now();
    statusNote = stillInPaidPeriod
      ? `Suscripción cancelada en PayPal. Conservas tu acceso y búsquedas restantes hasta el final del periodo ya pagado (${periodEndIso.slice(
          0,
          10
        )}).`
      : "Suscripción cancelada y periodo pagado finalizado.";
  } else if (remoteStatus === "SUSPENDED") {
    internalStatus = "suspended";
    grantedAllowance = 0;
    statusNote =
      "Suscripción suspendida en PayPal. Reactívala o actualiza tu método de pago para restaurar el acceso.";
  } else if (remoteStatus === "EXPIRED") {
    internalStatus = "expired";
    grantedAllowance = 0;
    statusNote = "La suscripción ha expirado en PayPal.";
  } else {
    internalStatus = "verification_failed";
    grantedAllowance = 0;
    statusNote = `Estado no activo reportado por PayPal: ${
      remoteStatus || "DESCONOCIDO"
    }.`;
  }

  const updated = await serviceRoleBase44.entities.PayPalSubscription.update(
    enrollmentRecord.id,
    {
      paypal_subscription_id: remoteId,
      subscriber_email: subscriberEmail,
      subscriber_payer_id: subscriberPayerId,
      status: internalStatus,
      paypal_raw_status: remoteStatus,
      plan_name: planName,
      billing_amount: String(billingAmount || ""),
      billing_currency: String(billingCurrency || "USD"),
      billing_interval_unit: intervalUnit,
      billing_interval_count: intervalCount,
      is_trial_period: isTrialPeriod,
      commercial_limits_status: config.commercialLimitsStatus,
      granted_search_allowance: grantedAllowance,
      used_subscription_searches: usedSearches,
      current_cycle_id:
        internalStatus === "active" || internalStatus === "trialing"
          ? cycleKey
          : enrollmentRecord.current_cycle_id || "",
      current_period_start_iso: startTime,
      current_period_end_iso: periodEndIso,
      cancel_at_period_end: cancelAtPeriodEnd,
      last_payment_at_iso:
        lastPayment?.time || enrollmentRecord.last_payment_at_iso || "",
      last_payment_amount:
        lastPayment?.amount?.value ||
        enrollmentRecord.last_payment_amount ||
        "",
      verified_at_iso:
        internalStatus === "active" || internalStatus === "trialing"
          ? enrollmentRecord.verified_at_iso || nowIso
          : enrollmentRecord.verified_at_iso || "",
      status_note: statusNote,
    }
  );

  const isGranted =
    internalStatus === "active" || internalStatus === "trialing";

  return {
    ok: true,
    verified: isGranted,
    code: isGranted ? "ACTIVE_VERIFIED" : `STATUS_${remoteStatus}`,
    message: statusNote,
    subscriptionRecord: updated,
  };
}

/**
 * Verifies a PayPal Webhook notification using PayPal's official
 * POST /v1/notifications/verify-webhook-signature endpoint.
 */
export async function verifyPayPalWebhookSignature({
  headers,
  parsedEvent,
  config,
  fetchImpl = fetch,
}) {
  const getHeader = (name) => {
    if (!headers) return "";
    if (typeof headers.get === "function") {
      return headers.get(name) || headers.get(name.toLowerCase()) || "";
    }
    return headers[name] || headers[name.toLowerCase()] || "";
  };

  const authAlgo = String(getHeader("paypal-auth-algo")).trim();
  const certUrl = String(getHeader("paypal-cert-url")).trim();
  const transmissionId = String(getHeader("paypal-transmission-id")).trim();
  const transmissionSig = String(getHeader("paypal-transmission-sig")).trim();
  const transmissionTime = String(getHeader("paypal-transmission-time")).trim();

  if (
    !authAlgo ||
    !certUrl ||
    !transmissionId ||
    !transmissionSig ||
    !transmissionTime
  ) {
    return {
      valid: false,
      reason:
        "Missing required PayPal signature headers (paypal-auth-algo, paypal-cert-url, paypal-transmission-id, paypal-transmission-sig, paypal-transmission-time).",
    };
  }

  // Validate certUrl host is an official *.paypal.com HTTPS endpoint
  try {
    const parsedCert = new URL(certUrl);
    if (
      parsedCert.protocol !== "https:" ||
      (!parsedCert.hostname.endsWith(".paypal.com") &&
        parsedCert.hostname !== "paypal.com")
    ) {
      return {
        valid: false,
        reason: "Untrusted paypal-cert-url hostname.",
      };
    }
  } catch {
    return {
      valid: false,
      reason: "Malformed paypal-cert-url header.",
    };
  }

  if (!config.webhookId) {
    return {
      valid: false,
      reason: "PAYPAL_WEBHOOK_ID is not configured in server secrets.",
    };
  }

  const tokenRes = await fetchPayPalAccessToken(config, fetchImpl);
  if (!tokenRes.ok) {
    return {
      valid: false,
      reason: tokenRes.message,
    };
  }

  const verifyRes = await fetchImpl(
    `${config.apiBaseUrl}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenRes.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: config.webhookId,
        webhook_event: parsedEvent,
      }),
    }
  );

  const verifyData = await verifyRes.json().catch(() => ({}));
  if (!verifyRes.ok || verifyData?.verification_status !== "SUCCESS") {
    return {
      valid: false,
      reason:
        verifyData?.message ||
        `PayPal verify-webhook-signature returned '${
          verifyData?.verification_status || verifyRes.status
        }'.`,
    };
  }

  return {
    valid: true,
    verificationStatus: "SUCCESS",
  };
}

/**
 * Processes a verified PayPal webhook event idempotently, handling out-of-order delivery,
 * renewals without duplicate credits, and cancellations without wiping paid periods.
 */
export async function processVerifiedPayPalWebhookEvent({
  serviceRoleBase44,
  event,
  config,
  nowIso = new Date().toISOString(),
}) {
  const eventId = String(event?.id || "").trim();
  const eventType = String(event?.event_type || "").trim();
  const eventCreateTime = String(event?.create_time || nowIso).trim();
  const resource = event?.resource || {};

  if (!eventId || !eventType) {
    throw new Error("Invalid PayPal webhook payload: missing id or event_type.");
  }

  // 1. Idempotency check against PayPalWebhookEvent
  const existingEventsPage =
    await serviceRoleBase44.entities.PayPalWebhookEvent.filter(
      { paypal_event_id: eventId },
      { limit: 1 }
    );
  const existingEvent = existingEventsPage?.items?.[0];
  if (existingEvent) {
    return {
      received: true,
      duplicate: true,
      paypal_event_id: eventId,
      previous_outcome: existingEvent.processing_outcome,
    };
  }

  // Extract subscription ID and custom_id from either subscription or sale resource
  const isSaleEvent = eventType.startsWith("PAYMENT.SALE.");
  const subscriptionId = String(
    isSaleEvent
      ? resource.billing_agreement_id || ""
      : resource.id || ""
  ).trim();
  const customId = String(
    resource.custom_id || resource.custom || ""
  ).trim();

  // Locate matching PayPalSubscription record
  let subRecord = null;
  if (subscriptionId) {
    const bySubPage =
      await serviceRoleBase44.entities.PayPalSubscription.filter(
        { paypal_subscription_id: subscriptionId },
        { limit: 5 }
      );
    subRecord = bySubPage?.items?.[0] || null;
  }
  if (!subRecord && customId) {
    const byCustomPage =
      await serviceRoleBase44.entities.PayPalSubscription.filter(
        { enrollment_reference: customId },
        { limit: 5 }
      );
    subRecord = byCustomPage?.items?.[0] || null;
  }

  // Out-of-order guard: if subscription record already processed a newer lifecycle event,
  // do not allow an older event timestamp to overwrite current state
  if (subRecord?.last_event_time_iso && eventCreateTime) {
    const prevEventMs = new Date(subRecord.last_event_time_iso).getTime();
    const currEventMs = new Date(eventCreateTime).getTime();
    if (
      !Number.isNaN(prevEventMs) &&
      !Number.isNaN(currEventMs) &&
      currEventMs < prevEventMs
    ) {
      await serviceRoleBase44.entities.PayPalWebhookEvent.create({
        paypal_event_id: eventId,
        event_type: eventType,
        paypal_subscription_id: subscriptionId || "unmatched",
        resource_id: String(resource.id || ""),
        environment: config.env,
        event_create_time_iso: eventCreateTime,
        verification_status: "SUCCESS",
        processing_outcome: "ignored_out_of_order",
        processed_at_iso: nowIso,
        notes: `Ignored out-of-order event (${eventCreateTime} < ${subRecord.last_event_time_iso}).`,
      });
      return {
        received: true,
        duplicate: false,
        outOfOrder: true,
        outcome: "ignored_out_of_order",
        paypal_event_id: eventId,
      };
    }
  }

  const recordWebhookOutcome = async (outcome, notes = "") => {
    await serviceRoleBase44.entities.PayPalWebhookEvent.create({
      paypal_event_id: eventId,
      event_type: eventType,
      paypal_subscription_id: subscriptionId || "unmatched",
      resource_id: String(resource.id || ""),
      environment: config.env,
      event_create_time_iso: eventCreateTime,
      verification_status: "SUCCESS",
      processing_outcome: outcome,
      processed_at_iso: nowIso,
      notes,
    });
  };

  if (!subRecord) {
    await recordWebhookOutcome(
      "ignored_unhandled",
      "No matching PayPalSubscription record found for subscriptionId/customId."
    );
    return {
      received: true,
      duplicate: false,
      outcome: "ignored_unhandled",
      reason: "subscription_not_found",
    };
  }

  // Verify plan_id if present in event resource
  if (resource.plan_id && resource.plan_id !== config.planId) {
    await recordWebhookOutcome(
      "ignored_unhandled",
      `Event plan_id (${resource.plan_id}) does not match configured plan (${config.planId}).`
    );
    return {
      received: true,
      duplicate: false,
      outcome: "ignored_unhandled",
      reason: "plan_mismatch",
    };
  }

  // Case 1: Activation / Re-activation / Update
  if (
    eventType === "BILLING.SUBSCRIPTION.ACTIVATED" ||
    eventType === "BILLING.SUBSCRIPTION.RE-ACTIVATED" ||
    eventType === "BILLING.SUBSCRIPTION.UPDATED"
  ) {
    const startTime =
      resource.start_time || subRecord.current_period_start_iso || eventCreateTime;
    const nextBillingTime =
      resource.billing_info?.next_billing_time ||
      subRecord.current_period_end_iso ||
      computeFallbackPeriodEndIso(
        startTime,
        subRecord.billing_interval_unit || "MONTH",
        subRecord.billing_interval_count || 1
      );
    const lastPaymentTime =
      resource.billing_info?.last_payment?.time || startTime;
    const cycleId = `cycle:${subscriptionId || subRecord.paypal_subscription_id}:${nextBillingTime}`;

    const isNewCycle = subRecord.current_cycle_id !== cycleId;
    const nextAllowance =
      isNewCycle || (Number(subRecord.granted_search_allowance) || 0) === 0
        ? config.effectiveCycleAllowance
        : subRecord.granted_search_allowance;
    const nextUsed = isNewCycle && subRecord.current_cycle_id
      ? 0
      : Number(subRecord.used_subscription_searches) || 0;

    subRecord = await serviceRoleBase44.entities.PayPalSubscription.update(
      subRecord.id,
      {
        paypal_subscription_id:
          subscriptionId || subRecord.paypal_subscription_id,
        status: "active",
        paypal_raw_status: String(resource.status || "ACTIVE"),
        cancel_at_period_end: false,
        commercial_limits_status: config.commercialLimitsStatus,
        granted_search_allowance: nextAllowance,
        used_subscription_searches: nextUsed,
        current_cycle_id: cycleId,
        current_period_start_iso: startTime,
        current_period_end_iso: nextBillingTime,
        last_payment_at_iso:
          lastPaymentTime || subRecord.last_payment_at_iso || "",
        last_webhook_event_id: eventId,
        last_event_time_iso: eventCreateTime,
        verified_at_iso: subRecord.verified_at_iso || nowIso,
        status_note: `Suscripción activa confirmada por webhook ${eventType} (${eventId}).`,
      }
    );

    await recordWebhookOutcome(
      "processed_activated",
      `Activated subscription ${subRecord.id} with allowance ${nextAllowance}.`
    );

    return {
      received: true,
      duplicate: false,
      outcome: "processed_activated",
      subscription: subRecord,
    };
  }

  // Case 2: Completed Payment / Renewal (PAYMENT.SALE.COMPLETED)
  if (eventType === "PAYMENT.SALE.COMPLETED") {
    const saleId = String(resource.id || eventId).trim();
    const saleAmount =
      resource.amount?.total || resource.amount?.value || subRecord.billing_amount || "";
    const saleCurrency =
      resource.amount?.currency ||
      resource.amount?.currency_code ||
      subRecord.billing_currency ||
      "USD";

    // Prevent duplicate renewal credits if the same sale or initial activation cycle already credited
    const saleCycleKey = `sale:${saleId}`;
    if (subRecord.current_cycle_id === saleCycleKey) {
      await recordWebhookOutcome(
        "ignored_duplicate",
        `Sale ${saleId} already credited on subscription ${subRecord.id}.`
      );
      return {
        received: true,
        duplicate: true,
        outcome: "ignored_duplicate",
        subscription: subRecord,
      };
    }

    const nextPeriodEndIso = computeFallbackPeriodEndIso(
      eventCreateTime,
      subRecord.billing_interval_unit || "MONTH",
      subRecord.billing_interval_count || 1
    );

    subRecord = await serviceRoleBase44.entities.PayPalSubscription.update(
      subRecord.id,
      {
        status: "active",
        paypal_raw_status: "ACTIVE",
        cancel_at_period_end: false,
        billing_amount: String(saleAmount || subRecord.billing_amount || ""),
        billing_currency: String(saleCurrency),
        commercial_limits_status: config.commercialLimitsStatus,
        granted_search_allowance: config.effectiveCycleAllowance,
        used_subscription_searches: 0,
        current_cycle_id: saleCycleKey,
        current_period_start_iso: eventCreateTime,
        current_period_end_iso: nextPeriodEndIso,
        last_payment_at_iso: eventCreateTime,
        last_payment_amount: String(saleAmount),
        last_webhook_event_id: eventId,
        last_event_time_iso: eventCreateTime,
        verified_at_iso: subRecord.verified_at_iso || nowIso,
        status_note: `Pago/renovación confirmado (${saleId}). Cupo del nuevo periodo renovado a ${config.effectiveCycleAllowance} búsquedas hasta ${nextPeriodEndIso.slice(
          0,
          10
        )}.`,
      }
    );

    await recordWebhookOutcome(
      "processed_payment",
      `Processed renewal sale ${saleId} for subscription ${subRecord.id}.`
    );

    return {
      received: true,
      duplicate: false,
      outcome: "processed_payment",
      subscription: subRecord,
    };
  }

  // Case 3: Cancellation (BILLING.SUBSCRIPTION.CANCELLED)
  // Does NOT wipe out an already-paid period; keeps current_period_end_iso and remaining allowance intact!
  if (eventType === "BILLING.SUBSCRIPTION.CANCELLED") {
    const periodEnd = subRecord.current_period_end_iso || "";
    const hasRemainingPaidWindow =
      periodEnd && new Date(periodEnd).getTime() > Date.now();

    subRecord = await serviceRoleBase44.entities.PayPalSubscription.update(
      subRecord.id,
      {
        status: "cancelled",
        paypal_raw_status: "CANCELLED",
        cancel_at_period_end: true,
        cancelled_at_iso: eventCreateTime,
        last_webhook_event_id: eventId,
        last_event_time_iso: eventCreateTime,
        status_note: hasRemainingPaidWindow
          ? `Suscripción cancelada (${eventId}). Tu periodo ya pagado sigue activo hasta ${periodEnd.slice(
              0,
              10
            )} sin cargos futuros.`
          : `Suscripción cancelada (${eventId}).`,
      }
    );

    await recordWebhookOutcome(
      "processed_cancelled",
      `Marked subscription ${subRecord.id} cancelled while preserving paid period until ${periodEnd || "n/a"}.`
    );

    return {
      received: true,
      duplicate: false,
      outcome: "processed_cancelled",
      subscription: subRecord,
    };
  }

  // Case 4: Suspension (BILLING.SUBSCRIPTION.SUSPENDED)
  if (eventType === "BILLING.SUBSCRIPTION.SUSPENDED") {
    subRecord = await serviceRoleBase44.entities.PayPalSubscription.update(
      subRecord.id,
      {
        status: "suspended",
        paypal_raw_status: "SUSPENDED",
        last_webhook_event_id: eventId,
        last_event_time_iso: eventCreateTime,
        status_note: `Suscripción suspendida en PayPal (${eventId}).`,
      }
    );

    await recordWebhookOutcome(
      "processed_suspended",
      `Suspended subscription ${subRecord.id}.`
    );

    return {
      received: true,
      duplicate: false,
      outcome: "processed_suspended",
      subscription: subRecord,
    };
  }

  // Case 5: Expiration (BILLING.SUBSCRIPTION.EXPIRED)
  if (eventType === "BILLING.SUBSCRIPTION.EXPIRED") {
    subRecord = await serviceRoleBase44.entities.PayPalSubscription.update(
      subRecord.id,
      {
        status: "expired",
        paypal_raw_status: "EXPIRED",
        granted_search_allowance: 0,
        last_webhook_event_id: eventId,
        last_event_time_iso: eventCreateTime,
        status_note: `Suscripción expirada en PayPal (${eventId}).`,
      }
    );

    await recordWebhookOutcome(
      "processed_expired",
      `Expired subscription ${subRecord.id}.`
    );

    return {
      received: true,
      duplicate: false,
      outcome: "processed_expired",
      subscription: subRecord,
    };
  }

  // Case 6: Payment Failed (BILLING.SUBSCRIPTION.PAYMENT.FAILED / PAYMENT.SALE.DENIED)
  if (
    eventType === "BILLING.SUBSCRIPTION.PAYMENT.FAILED" ||
    eventType === "PAYMENT.SALE.DENIED"
  ) {
    subRecord = await serviceRoleBase44.entities.PayPalSubscription.update(
      subRecord.id,
      {
        status: "payment_failed",
        paypal_raw_status: "PAYMENT_FAILED",
        granted_search_allowance: 0,
        last_webhook_event_id: eventId,
        last_event_time_iso: eventCreateTime,
        status_note: `Pago de suscripción fallido en PayPal (${eventId}). Revisa tu método de pago para reactivar tu plan.`,
      }
    );

    await recordWebhookOutcome(
      "processed_payment_failed",
      `Recorded failed payment on subscription ${subRecord.id}.`
    );

    return {
      received: true,
      duplicate: false,
      outcome: "processed_payment_failed",
      subscription: subRecord,
    };
  }

  await recordWebhookOutcome(
    "ignored_unhandled",
    `Unhandled event type ${eventType}.`
  );
  return {
    received: true,
    duplicate: false,
    outcome: "ignored_unhandled",
  };
}