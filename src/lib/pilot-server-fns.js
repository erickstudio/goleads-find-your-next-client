import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import {
  PILOT_OFFER_SPEC,
  getStripeServerConfig,
  summarizePilotTransactions,
  classifyPaymentTransaction,
} from "@/lib/pilot-billing.server";
import { computeQuotaUsage } from "@/lib/server-fns";

export const getPilotWorkspaceData = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;
    const userEmail = context.user.email || "";

    const [enrollmentsPage, searchesPage, feedbackPage] = await Promise.all([
      base44.entities.PilotEnrollment.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 25 }
      ),
      base44.entities.LeadSearch.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 25 }
      ),
      base44.entities.OpportunityFeedback.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 50 }
      ),
    ]);

    const myEnrollments = (enrollmentsPage?.items || []).filter(
      (e) => e.created_by_id === userId && (!e.owner_id || e.owner_id === userId)
    );
    const recentSearches = (searchesPage?.items || []).filter(
      (s) => s.created_by_id === userId && (!s.owner_id || s.owner_id === userId)
    );
    const feedbackRecords = (feedbackPage?.items || []).filter(
      (f) => f.created_by_id === userId && (!f.owner_id || f.owner_id === userId)
    );

    const stripeConfig = getStripeServerConfig();
    const quota = computeQuotaUsage(recentSearches, Date.now(), myEnrollments);
    const transactionSummary = summarizePilotTransactions(myEnrollments);

    return {
      user: {
        id: userId,
        email: userEmail,
      },
      offerSpec: PILOT_OFFER_SPEC,
      stripeStatus: {
        hasStripeSecretKey: stripeConfig.hasStripeSecretKey,
        hasWebhookSecret: stripeConfig.hasWebhookSecret,
        hasTestPriceId: stripeConfig.hasTestPriceId,
        keyMode: stripeConfig.keyMode,
        allowTestCheckoutInitiation: stripeConfig.allowTestCheckoutInitiation,
        liveBillingEnabled: false,
      },
      myEnrollments,
      transactionSummary,
      quota,
      feedbackRecords,
      documentedImprovements: [
        {
          id: "imp-source-year-verification",
          triggerFeedback:
            "Feedback on Delicias de Espana Sunset ('Weak or unclear evidence — Tracker page lacks year metadata')",
          resultingChange:
            "Updated server-side source verification (discovery.server.js) so regional tracker listings without HTML publication-date metadata or an explicit 4-digit year in recovered text are automatically held in 'Needs review' with recency_basis = 'unverified_date' instead of being marked Verified.",
          independentOfPayment: true,
        },
        {
          id: "imp-roundtrip-and-dismiss-restore",
          triggerFeedback:
            "Workflow review feedback while inspecting and dismissing leads across Find leads, Opportunity details, and Saved leads",
          resultingChange:
            "Added URL search-parameter persistence across detail round-trips, a 'Show dismissed' restore toggle on Find leads, and a Relevance rating panel supporting updates to earlier ratings without altering factual source verification status.",
          independentOfPayment: true,
        },
      ],
    };
  });

export const initiateTestPilotCheckout = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      returnOrigin: z.string().url().max(250).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const userId = context.user.id;
    const userEmail = context.user.email || "";
    const stripeConfig = getStripeServerConfig();

    // Never allow live billing during this preparation step
    if (stripeConfig.keyMode === "live") {
      return {
        ok: false,
        checkoutUrl: null,
        reason:
          "Live billing is disabled during pilot preparation. Only Stripe test-mode keys (sk_test_) may be used while commercial terms are under review.",
      };
    }

    if (!stripeConfig.hasStripeSecretKey || !stripeConfig.hasTestPriceId) {
      return {
        ok: false,
        checkoutUrl: null,
        reason:
          "Stripe test sandbox or test pilot price is not connected yet, and commercial terms (price, currency, duration, allowance, refund terms) are awaiting owner decision.",
      };
    }

    const origin = data.returnOrigin || "http://localhost:5173";
    const successUrl = `${origin}/pilot?checkout=return&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/pilot?checkout=canceled&session_id={CHECKOUT_SESSION_ID}`;

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", successUrl);
    params.set("cancel_url", cancelUrl);
    params.set("line_items[0][price]", stripeConfig.testPriceId);
    params.set("line_items[0][quantity]", "1");
    params.set("client_reference_id", userId);
    if (userEmail) params.set("customer_email", userEmail);
    params.set("metadata[owner_id]", userId);
    params.set("metadata[offer_code]", PILOT_OFFER_SPEC.offerCode);

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeConfig.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!stripeRes.ok) {
      const errJson = await stripeRes.json().catch(() => ({}));
      return {
        ok: false,
        checkoutUrl: null,
        reason:
          errJson?.error?.message || `Stripe test checkout creation failed (HTTP ${stripeRes.status}).`,
      };
    }

    const session = await stripeRes.json();
    const base44 = context.getBase44();
    const enrollment = await base44.entities.PilotEnrollment.create({
      owner_id: userId,
      owner_email: userEmail,
      offer_code: PILOT_OFFER_SPEC.offerCode,
      payment_mode: "test",
      payment_classification: "test_transaction",
      payment_status: "pending_checkout",
      stripe_checkout_session_id: session.id,
      amount_cents: typeof session.amount_total === "number" ? session.amount_total : 0,
      currency: String(session.currency || "usd"),
      granted_search_allowance: 0,
      used_pilot_searches: 0,
      counts_as_production_revenue: false,
      status_note: "Checkout session initiated in test mode; awaiting server-side payment verification.",
      created_at_iso: new Date().toISOString(),
    });

    return {
      ok: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      enrollmentId: enrollment.id,
    };
  });

/**
 * Verifies a returning checkout session exclusively using server-side Stripe status or
 * already-verified webhook state. Never trusts a client-side flag or URL parameter alone.
 */
export const verifyPilotCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      session_id: z.string().min(1).max(160),
      return_state: z.enum(["return", "canceled"]).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const serviceRole = base44.asServiceRole;
    const userId = context.user.id;
    const userEmail = context.user.email || "";

    const enrollPage = await base44.entities.PilotEnrollment.filter(
      { created_by_id: userId, stripe_checkout_session_id: data.session_id },
      { limit: 1 }
    );
    const enrollment = enrollPage?.items?.[0] || null;
    if (!enrollment || enrollment.created_by_id !== userId) {
      throw new Error("Pilot enrollment session not found in your account.");
    }

    // If webhook already verified payment, return the authoritative record immediately
    if (enrollment.payment_status === "paid_verified") {
      return {
        verified: true,
        payment_status: "paid_verified",
        granted_search_allowance: enrollment.granted_search_allowance,
        enrollment,
        note: "Payment already verified server-side. No duplicate allowance granted.",
      };
    }

    // If user explicitly returned via cancel_url and session is still pending, mark canceled (0 allowance)
    if (data.return_state === "canceled" && enrollment.payment_status === "pending_checkout") {
      const updated = await serviceRole.entities.PilotEnrollment.update(enrollment.id, {
        payment_status: "canceled",
        granted_search_allowance: 0,
        counts_as_production_revenue: false,
        status_note: "Checkout canceled by user before payment completion. 0 allowance granted.",
      });
      return {
        verified: false,
        payment_status: "canceled",
        granted_search_allowance: 0,
        enrollment: updated,
        note: "Checkout was canceled. No allowance was granted.",
      };
    }

    // Never trust return_state === "return" without server-side Stripe verification
    const stripeConfig = getStripeServerConfig();
    if (!stripeConfig.hasStripeSecretKey) {
      return {
        verified: false,
        payment_status: enrollment.payment_status,
        granted_search_allowance: 0,
        enrollment,
        note:
          "Cannot grant pilot allowance from a browser redirect alone: Stripe server verification key is not configured.",
      };
    }

    const stripeRes = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(data.session_id)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${stripeConfig.secretKey}`,
        },
      }
    );

    if (!stripeRes.ok) {
      return {
        verified: false,
        payment_status: enrollment.payment_status,
        granted_search_allowance: 0,
        enrollment,
        note: `Stripe session lookup did not confirm payment (HTTP ${stripeRes.status}). Allowance remains 0.`,
      };
    }

    const session = await stripeRes.json();
    if (session.payment_status === "paid") {
      const classification = classifyPaymentTransaction({
        livemode: Boolean(session.livemode),
        buyerEmail: userEmail,
        teammateEmails: [userEmail],
      });
      const allowanceToGrant = PILOT_OFFER_SPEC.testSandboxConfig.testAllowanceSearches;
      const nowIso = new Date().toISOString();
      const expiresAtIso = new Date(
        Date.now() + PILOT_OFFER_SPEC.testSandboxConfig.testDurationDays * 24 * 60 * 60 * 1000
      ).toISOString();

      const updated = await serviceRole.entities.PilotEnrollment.update(enrollment.id, {
        payment_mode: classification.paymentMode,
        payment_classification: classification.paymentClassification,
        payment_status: "paid_verified",
        stripe_payment_intent_id: String(session.payment_intent || ""),
        amount_cents: typeof session.amount_total === "number" ? session.amount_total : 0,
        currency: String(session.currency || "usd"),
        granted_search_allowance: allowanceToGrant,
        counts_as_production_revenue: classification.countsAsProductionRevenue,
        status_note: `Verified directly against Stripe Checkout Session API (${classification.paymentClassification}). Granted ${allowanceToGrant} searches.`,
        verified_at_iso: nowIso,
        expires_at_iso: expiresAtIso,
      });

      return {
        verified: true,
        payment_status: "paid_verified",
        granted_search_allowance: allowanceToGrant,
        enrollment: updated,
        note: "Payment verified with Stripe on the server. Pilot research allowance granted.",
      };
    }

    return {
      verified: false,
      payment_status: enrollment.payment_status,
      granted_search_allowance: 0,
      enrollment,
      note: `Stripe reports session payment_status = "${session.payment_status}". Allowance is only granted when payment_status is "paid".`,
    };
  });