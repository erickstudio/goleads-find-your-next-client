import crypto from "node:crypto";
import { Buffer } from "node:buffer";

// Honest pilot offer specification: separates agreed product terms from undecided commercial terms
export const PILOT_OFFER_SPEC = {
  offerCode: "leads-ai-one-time-pilot-v1",
  offerType: "One-time paid pilot (no recurring subscription)",
  liveBillingEnabled: false,
  targetCustomer:
    "Freelancers and small agencies selling B2B services (such as web design & SEO, e-commerce, automation & CRM, commercial photography, bookkeeping, recruiting, or local operational services) to newly opening or expanding businesses.",
  agreedDeliverables: [
    "Access to live opening and expansion discovery (up to 5 unique businesses per search)",
    "Direct source-page recovery with verbatim supporting excerpts and HTTP verification notes",
    "Explicit separation between Verified opportunities and candidates marked Needs review",
    "Distinct publication date, event/opening date, and retrieval timestamp on every record",
    "Tailored service-fit hypotheses mapped to your custom services (clearly labeled as hypotheses)",
    "Private workspace for saving leads, tracking qualification stages, and recording relevance feedback",
  ],
  explicitDisclaimers: [
    "No guarantee of prospect budget, technical website defects, or active buying intent",
    "No guarantee of booked meetings, closed clients, or revenue",
    "Test-mode sandbox transactions never count as production revenue earned",
  ],
  creditsDistinction: {
    inProductResearchAllowance:
      "In-product research allowance: The number of live discovery searches available to a customer inside Leads AI. Identical queries within 24 hours are served from private cache without using allowance, and failed searches never consume allowance.",
    base44PlatformCredits:
      "Base44 platform credits: Workspace-level infrastructure credits owned by the app builder on Base44 (Builder plan: 6 of 10,000 Integration credits used and 222.47 of 250 Message credits remaining this period, resetting 2026-11-30 UTC). End users never purchase or see Base44 platform credits.",
  },
  undecidedTerms: {
    price: {
      status: "UNDECIDED",
      label: "One-time pilot price",
      detail: "Requires owner decision before enabling live checkout (no live price invented).",
    },
    currency: {
      status: "UNDECIDED",
      label: "Billing currency",
      detail: "Requires owner decision (e.g., USD).",
    },
    durationDays: {
      status: "UNDECIDED",
      label: "Pilot access duration",
      detail: "Requires owner decision (e.g., 14 days or 30 days from verification).",
    },
    includedResearchAllowance: {
      status: "UNDECIDED",
      label: "Included live discovery searches",
      detail: "Requires owner decision on how many live searches the one-time pilot grants.",
    },
    refundTerms: {
      status: "UNDECIDED",
      label: "Refund policy",
      detail: "Requires owner decision on refund window and unused search allowance conditions.",
    },
  },
  // Used strictly for test-mode sandbox verification while commercial terms remain undecided
  testSandboxConfig: {
    mode: "test",
    testAllowanceSearches: 10,
    testDurationDays: 30,
  },
};

export function getStripeServerConfig() {
  return {
    hasStripeSecretKey: false,
    hasWebhookSecret: false,
    hasTestPriceId: false,
    keyMode: "not_connected",
    allowTestCheckoutInitiation: false,
    secretKey: "",
    webhookSecret: "",
    testPriceId: "",
  };
}

/**
 * Verifies Stripe webhook signature (t=...,v1=...) using HMAC-SHA256 and constant-time comparison.
 */
export function verifyStripeWebhookSignature(rawPayload, signatureHeader, webhookSecret, toleranceSec = 300) {
  if (!rawPayload || !signatureHeader || !webhookSecret) {
    return { valid: false, reason: "Missing payload, Stripe-Signature header, or webhook secret" };
  }

  const parts = String(signatureHeader).split(",");
  let timestamp = null;
  const signatures = [];

  for (const part of parts) {
    const [k, v] = part.trim().split("=");
    if (k === "t") timestamp = Number(v);
    if (k === "v1" && v) signatures.push(v);
  }

  if (!timestamp || Number.isNaN(timestamp) || signatures.length === 0) {
    return { valid: false, reason: "Malformed Stripe-Signature header" };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestamp) > toleranceSec) {
    return { valid: false, reason: "Webhook timestamp outside tolerance window" };
  }

  const signedPayload = `${timestamp}.${rawPayload}`;
  const expectedHex = crypto
    .createHmac("sha256", webhookSecret)
    .update(signedPayload, "utf8")
    .digest("hex");
  const expectedBuf = Buffer.from(expectedHex, "hex");

  for (const sigHex of signatures) {
    try {
      const sigBuf = Buffer.from(sigHex, "hex");
      if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        return { valid: true, timestamp };
      }
    } catch {
      // Ignore malformed hex candidate
    }
  }

  return { valid: false, reason: "Signature mismatch" };
}

/**
 * Classifies a payment so test transactions and teammate purchases are never mixed with
 * genuine external-customer production payments.
 */
export function classifyPaymentTransaction({ livemode, buyerEmail, teammateEmails = [] }) {
  if (!livemode) {
    return {
      paymentMode: "test",
      paymentClassification: "test_transaction",
      countsAsProductionRevenue: false,
    };
  }

  const normalizedBuyer = String(buyerEmail || "").trim().toLowerCase();
  const normalizedTeam = teammateEmails.map((e) => String(e || "").trim().toLowerCase());

  if (normalizedBuyer && normalizedTeam.includes(normalizedBuyer)) {
    return {
      paymentMode: "live",
      paymentClassification: "teammate_purchase",
      countsAsProductionRevenue: false,
    };
  }

  return {
    paymentMode: "live",
    paymentClassification: "external_customer_production",
    countsAsProductionRevenue: true,
  };
}

/**
 * Processes a verified Stripe webhook event idempotently using service-role entity access.
 * Handles successful, canceled, failed, and duplicate notifications without double-granting allowance.
 */
export async function processVerifiedStripeEvent(serviceRoleBase44, event, teammateEmails = []) {
  const eventId = String(event?.id || "").trim();
  const eventType = String(event?.type || "").trim();
  const livemode = Boolean(event?.livemode);
  const nowIso = new Date().toISOString();

  if (!eventId || !eventType) {
    throw new Error("Invalid Stripe event payload: missing id or type");
  }

  // 1. Idempotency check against PaymentWebhookEvent
  const existingEventsPage = await serviceRoleBase44.entities.PaymentWebhookEvent.filter(
    { stripe_event_id: eventId },
    { limit: 1 }
  );
  const existingEvent = existingEventsPage?.items?.[0];
  if (existingEvent) {
    return {
      received: true,
      duplicate: true,
      stripe_event_id: eventId,
      previous_outcome: existingEvent.processing_outcome,
    };
  }

  const obj = event?.data?.object || {};
  const sessionId =
    obj.object === "checkout.session"
      ? obj.id
      : obj.checkout_session_id || obj.metadata?.checkout_session_id || "";

  let enrollment = null;
  if (sessionId) {
    const enrollPage = await serviceRoleBase44.entities.PilotEnrollment.filter(
      { stripe_checkout_session_id: sessionId },
      { limit: 1 }
    );
    enrollment = enrollPage?.items?.[0] || null;
  }

  // Case A: Successful payment verified by provider
  if (
    (eventType === "checkout.session.completed" ||
      eventType === "checkout.session.async_payment_succeeded") &&
    obj.payment_status === "paid"
  ) {
    if (enrollment) {
      // Second idempotency guard: if already paid_verified, do not double-grant allowance
      if (enrollment.payment_status === "paid_verified") {
        await serviceRoleBase44.entities.PaymentWebhookEvent.create({
          stripe_event_id: eventId,
          event_type: eventType,
          stripe_session_id: sessionId,
          livemode,
          processing_outcome: "ignored_duplicate",
          processed_at_iso: nowIso,
        });
        return {
          received: true,
          duplicate: true,
          stripe_event_id: eventId,
          enrollment_id: enrollment.id,
        };
      }

      const classification = classifyPaymentTransaction({
        livemode,
        buyerEmail: enrollment.owner_email || obj.customer_details?.email,
        teammateEmails,
      });

      const allowanceToGrant = PILOT_OFFER_SPEC.testSandboxConfig.testAllowanceSearches;
      const expiresAtIso = new Date(
        Date.now() + PILOT_OFFER_SPEC.testSandboxConfig.testDurationDays * 24 * 60 * 60 * 1000
      ).toISOString();

      enrollment = await serviceRoleBase44.entities.PilotEnrollment.update(enrollment.id, {
        payment_mode: classification.paymentMode,
        payment_classification: classification.paymentClassification,
        payment_status: "paid_verified",
        stripe_payment_intent_id: String(obj.payment_intent || ""),
        last_webhook_event_id: eventId,
        amount_cents: typeof obj.amount_total === "number" ? obj.amount_total : enrollment.amount_cents || 0,
        currency: String(obj.currency || enrollment.currency || "usd"),
        granted_search_allowance: allowanceToGrant,
        counts_as_production_revenue: classification.countsAsProductionRevenue,
        status_note: `Verified via Stripe event ${eventId} (${classification.paymentClassification}). Granted ${allowanceToGrant} pilot research searches.`,
        verified_at_iso: nowIso,
        expires_at_iso: expiresAtIso,
      });
    }

    await serviceRoleBase44.entities.PaymentWebhookEvent.create({
      stripe_event_id: eventId,
      event_type: eventType,
      stripe_session_id: sessionId || "unmatched",
      livemode,
      processing_outcome: "processed_paid",
      processed_at_iso: nowIso,
    });

    return {
      received: true,
      duplicate: false,
      outcome: "processed_paid",
      enrollment,
    };
  }

  // Case B: Canceled / expired checkout session
  if (eventType === "checkout.session.expired") {
    if (enrollment && enrollment.payment_status !== "paid_verified") {
      enrollment = await serviceRoleBase44.entities.PilotEnrollment.update(enrollment.id, {
        payment_status: "canceled",
        granted_search_allowance: 0,
        counts_as_production_revenue: false,
        last_webhook_event_id: eventId,
        status_note: `Checkout session expired or canceled (${eventId}). 0 allowance granted.`,
      });
    }

    await serviceRoleBase44.entities.PaymentWebhookEvent.create({
      stripe_event_id: eventId,
      event_type: eventType,
      stripe_session_id: sessionId || "unmatched",
      livemode,
      processing_outcome: "processed_canceled",
      processed_at_iso: nowIso,
    });

    return {
      received: true,
      duplicate: false,
      outcome: "processed_canceled",
      enrollment,
    };
  }

  // Case C: Failed payment
  if (
    eventType === "checkout.session.async_payment_failed" ||
    eventType === "payment_intent.payment_failed"
  ) {
    if (enrollment && enrollment.payment_status !== "paid_verified") {
      enrollment = await serviceRoleBase44.entities.PilotEnrollment.update(enrollment.id, {
        payment_status: "failed",
        granted_search_allowance: 0,
        counts_as_production_revenue: false,
        last_webhook_event_id: eventId,
        status_note: `Payment failed according to Stripe event ${eventId}. 0 allowance granted.`,
      });
    }

    await serviceRoleBase44.entities.PaymentWebhookEvent.create({
      stripe_event_id: eventId,
      event_type: eventType,
      stripe_session_id: sessionId || "unmatched",
      livemode,
      processing_outcome: "processed_failed",
      processed_at_iso: nowIso,
    });

    return {
      received: true,
      duplicate: false,
      outcome: "processed_failed",
      enrollment,
    };
  }

  // Unhandled event type
  await serviceRoleBase44.entities.PaymentWebhookEvent.create({
    stripe_event_id: eventId,
    event_type: eventType,
    stripe_session_id: sessionId || "unmatched",
    livemode,
    processing_outcome: "ignored_unhandled",
    processed_at_iso: nowIso,
  });

  return {
    received: true,
    duplicate: false,
    outcome: "ignored_unhandled",
  };
}

/**
 * Summarizes pilot enrollments by strictly separating test transactions, teammate purchases,
 * and genuine external-customer production payments.
 */
export function summarizePilotTransactions(enrollments = []) {
  const testTransactions = enrollments.filter(
    (e) => e.payment_classification === "test_transaction" || e.payment_mode === "test"
  );
  const teammatePurchases = enrollments.filter(
    (e) => e.payment_classification === "teammate_purchase" && e.payment_mode === "live"
  );
  const externalCustomerPayments = enrollments.filter(
    (e) =>
      e.payment_classification === "external_customer_production" &&
      e.payment_mode === "live" &&
      e.payment_status === "paid_verified" &&
      e.counts_as_production_revenue === true
  );

  const externalProductionRevenueCents = externalCustomerPayments.reduce(
    (sum, e) => sum + (Number(e.amount_cents) || 0),
    0
  );

  return {
    testTransactionCount: testTransactions.length,
    testPaidVerifiedCount: testTransactions.filter((e) => e.payment_status === "paid_verified").length,
    teammatePurchaseCount: teammatePurchases.length,
    externalCustomerProductionCount: externalCustomerPayments.length,
    externalProductionRevenueCents,
  };
}