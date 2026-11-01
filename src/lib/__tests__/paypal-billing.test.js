import { describe, it, expect } from "vitest";
import {
  getPayPalServerConfig,
  reconcilePayPalSubscriptionForUser,
  verifyPayPalWebhookSignature,
  processVerifiedPayPalWebhookEvent,
} from "@/lib/paypal-billing.server";
import { computeQuotaUsage } from "@/lib/server-fns";

function createInMemoryBase44() {
  const subs = new Map();
  const events = new Map();
  let idCounter = 1;

  const matchesFilter = (item, query = {}) => {
    return Object.entries(query).every(([k, v]) => item[k] === v);
  };

  return {
    _subs: subs,
    _events: events,
    entities: {
      PayPalSubscription: {
        create: async (data) => {
          const id = `sub_rec_${idCounter++}`;
          const rec = {
            id,
            created_by_id: data.owner_id,
            created_date: new Date().toISOString(),
            ...data,
          };
          subs.set(id, rec);
          return rec;
        },
        update: async (id, patch) => {
          const existing = subs.get(id);
          if (!existing) throw new Error("Not found");
          const updated = { ...existing, ...patch };
          subs.set(id, updated);
          return updated;
        },
        filter: async (query = {}) => {
          const items = Array.from(subs.values()).filter((item) =>
            matchesFilter(item, query)
          );
          return { items };
        },
      },
      PayPalWebhookEvent: {
        create: async (data) => {
          const id = `wh_rec_${idCounter++}`;
          const rec = { id, ...data };
          events.set(id, rec);
          return rec;
        },
        filter: async (query = {}) => {
          const items = Array.from(events.values()).filter((item) =>
            matchesFilter(item, query)
          );
          return { items };
        },
      },
    },
  };
}

describe("PayPal Sandbox Subscription & Webhook Verification Suite", () => {
  const sandboxConfig = getPayPalServerConfig({
    env: "sandbox",
    clientId: "BAAjPq8ShjwUsg-zT-d8XZ2T21qIDYvltuYTaDvaGU42zys0xukFCxej3yE3Vh2qBuOIno1S-ZLKF_ufU8",
    clientSecret: "sandbox_secret_for_tests",
    planId: "P-45W768000B945962BNLT2VZY",
    webhookId: "WH-SANDBOX-TEST-ID",
    planSearchAllowance: "20",
  });

  it("1. Suscripción aprobada: verifies plan_id, custom_id, and ACTIVE state before granting quota", async () => {
    const db = createInMemoryBase44();
    const enrollment = await db.entities.PayPalSubscription.create({
      owner_id: "user_1",
      owner_email: "user1@example.com",
      enrollment_reference: "glsub_user_1_ref123",
      paypal_plan_id: sandboxConfig.planId,
      paypal_environment: "sandbox",
      status: "pending_approval",
      granted_search_allowance: 0,
      used_subscription_searches: 0,
    });

    const remoteSub = {
      id: "I-SANDBOX-SUB-001",
      plan_id: sandboxConfig.planId,
      custom_id: "glsub_user_1_ref123",
      status: "ACTIVE",
      start_time: "2026-11-01T10:00:00Z",
      subscriber: {
        email_address: "buyer1@sandbox.paypal.com",
        payer_id: "PAYER123",
      },
      billing_info: {
        next_billing_time: "2026-12-01T10:00:00Z",
        last_payment: {
          time: "2026-11-01T10:00:05Z",
          amount: { value: "29.00", currency_code: "USD" },
        },
      },
    };

    const res = await reconcilePayPalSubscriptionForUser({
      serviceRoleBase44: db,
      userId: "user_1",
      enrollmentRecord: enrollment,
      remoteSubscription: remoteSub,
      planDetails: {
        id: sandboxConfig.planId,
        name: "GoLeads Pro Sandbox",
        amount: "29.00",
        currency: "USD",
        intervalUnit: "MONTH",
        intervalCount: 1,
      },
      config: sandboxConfig,
      nowIso: "2026-11-01T10:01:00Z",
    });

    expect(res.ok).toBe(true);
    expect(res.verified).toBe(true);
    expect(res.subscriptionRecord.status).toBe("active");
    expect(res.subscriptionRecord.granted_search_allowance).toBe(20);

    const quota = computeQuotaUsage(
      [],
      new Date("2026-11-02T00:00:00Z").getTime(),
      [],
      [res.subscriptionRecord]
    );
    expect(quota.subscriptionRemaining).toBe(20);
    expect(quota.remainingToday).toBe(23); // 3 base + 20 subscription
  });

  it("2. Abandono o cancelación del checkout: keeps allowance at 0", async () => {
    const db = createInMemoryBase44();
    const enrollment = await db.entities.PayPalSubscription.create({
      owner_id: "user_1",
      enrollment_reference: "glsub_user_1_cancel",
      paypal_plan_id: sandboxConfig.planId,
      paypal_environment: "sandbox",
      status: "cancelled",
      paypal_raw_status: "CANCELLED_BY_USER",
      granted_search_allowance: 0,
      used_subscription_searches: 0,
    });

    const quota = computeQuotaUsage([], Date.now(), [], [enrollment]);
    expect(quota.subscriptionRemaining).toBe(0);
    expect(quota.remainingToday).toBe(3);
  });

  it("3. Pago fallido: BILLING.SUBSCRIPTION.PAYMENT.FAILED sets payment_failed and revokes cycle allowance", async () => {
    const db = createInMemoryBase44();
    await db.entities.PayPalSubscription.create({
      owner_id: "user_1",
      enrollment_reference: "glsub_user_1_fail",
      paypal_plan_id: sandboxConfig.planId,
      paypal_environment: "sandbox",
      paypal_subscription_id: "I-SUB-FAIL-01",
      status: "active",
      granted_search_allowance: 20,
      used_subscription_searches: 2,
      current_period_end_iso: "2026-12-01T00:00:00Z",
    });

    const failRes = await processVerifiedPayPalWebhookEvent({
      serviceRoleBase44: db,
      config: sandboxConfig,
      event: {
        id: "WH-EVT-FAIL-1",
        event_type: "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
        create_time: "2026-11-02T12:00:00Z",
        resource: {
          id: "I-SUB-FAIL-01",
          custom_id: "glsub_user_1_fail",
          plan_id: sandboxConfig.planId,
        },
      },
    });

    expect(failRes.outcome).toBe("processed_payment_failed");
    expect(failRes.subscription.status).toBe("payment_failed");
    expect(failRes.subscription.granted_search_allowance).toBe(0);

    const quota = computeQuotaUsage([], Date.now(), [], [failRes.subscription]);
    expect(quota.subscriptionRemaining).toBe(0);
  });

  it("4. Renovación: PAYMENT.SALE.COMPLETED resets cycle usage and does NOT duplicate credits on repeat", async () => {
    const db = createInMemoryBase44();
    await db.entities.PayPalSubscription.create({
      owner_id: "user_1",
      enrollment_reference: "glsub_user_1_renew",
      paypal_plan_id: sandboxConfig.planId,
      paypal_environment: "sandbox",
      paypal_subscription_id: "I-SUB-RENEW-01",
      status: "active",
      granted_search_allowance: 20,
      used_subscription_searches: 15,
      current_cycle_id: "cycle:initial",
      current_period_end_iso: "2026-11-01T00:00:00Z",
    });

    const saleEvent = {
      id: "WH-EVT-SALE-100",
      event_type: "PAYMENT.SALE.COMPLETED",
      create_time: "2026-12-01T10:00:00Z",
      resource: {
        id: "SALE-DEC-2026",
        billing_agreement_id: "I-SUB-RENEW-01",
        custom: "glsub_user_1_renew",
        amount: { total: "29.00", currency: "USD" },
      },
    };

    const firstRenewal = await processVerifiedPayPalWebhookEvent({
      serviceRoleBase44: db,
      config: sandboxConfig,
      event: saleEvent,
    });

    expect(firstRenewal.outcome).toBe("processed_payment");
    expect(firstRenewal.subscription.granted_search_allowance).toBe(20);
    expect(firstRenewal.subscription.used_subscription_searches).toBe(0);

    // Repeat webhook with a different event ID but the same SALE-DEC-2026 must NOT double-grant credits
    const duplicateSaleDiffEvent = await processVerifiedPayPalWebhookEvent({
      serviceRoleBase44: db,
      config: sandboxConfig,
      event: {
        ...saleEvent,
        id: "WH-EVT-SALE-101-RETRY",
      },
    });
    expect(duplicateSaleDiffEvent.duplicate).toBe(true);
    expect(duplicateSaleDiffEvent.subscription.granted_search_allowance).toBe(20);
  });

  it("5. Cancelación de la suscripción: preserves already-paid period until current_period_end_iso", async () => {
    const db = createInMemoryBase44();
    await db.entities.PayPalSubscription.create({
      owner_id: "user_1",
      enrollment_reference: "glsub_user_1_keep_paid",
      paypal_plan_id: sandboxConfig.planId,
      paypal_environment: "sandbox",
      paypal_subscription_id: "I-SUB-CANCEL-01",
      status: "active",
      granted_search_allowance: 20,
      used_subscription_searches: 5,
      current_period_start_iso: "2026-11-01T00:00:00Z",
      current_period_end_iso: "2026-12-01T00:00:00Z",
    });

    const cancelRes = await processVerifiedPayPalWebhookEvent({
      serviceRoleBase44: db,
      config: sandboxConfig,
      event: {
        id: "WH-EVT-CANCEL-1",
        event_type: "BILLING.SUBSCRIPTION.CANCELLED",
        create_time: "2026-11-10T10:00:00Z",
        resource: {
          id: "I-SUB-CANCEL-01",
          custom_id: "glsub_user_1_keep_paid",
          plan_id: sandboxConfig.planId,
          status: "CANCELLED",
        },
      },
    });

    expect(cancelRes.outcome).toBe("processed_cancelled");
    expect(cancelRes.subscription.status).toBe("cancelled");
    expect(cancelRes.subscription.cancel_at_period_end).toBe(true);

    // During November (before 2026-12-01), user still has 15 remaining searches from their paid period
    const quotaDuringPaidPeriod = computeQuotaUsage(
      [],
      new Date("2026-11-15T00:00:00Z").getTime(),
      [],
      [cancelRes.subscription]
    );
    expect(quotaDuringPaidPeriod.subscriptionRemaining).toBe(15);

    // After 2026-12-01, paid period expires and subscriptionRemaining drops to 0
    const quotaAfterPaidPeriod = computeQuotaUsage(
      [],
      new Date("2026-12-02T00:00:00Z").getTime(),
      [],
      [cancelRes.subscription]
    );
    expect(quotaAfterPaidPeriod.subscriptionRemaining).toBe(0);
  });

  it("6. Webhook duplicado, fuera de orden o con firma inválida", async () => {
    const db = createInMemoryBase44();
    await db.entities.PayPalSubscription.create({
      owner_id: "user_1",
      enrollment_reference: "glsub_user_1_order",
      paypal_plan_id: sandboxConfig.planId,
      paypal_environment: "sandbox",
      paypal_subscription_id: "I-SUB-ORDER-01",
      status: "cancelled",
      last_event_time_iso: "2026-11-15T12:00:00Z",
    });

    // 6a. Invalid signature header / cert URL rejected
    const badSig = await verifyPayPalWebhookSignature({
      headers: {
        "paypal-auth-algo": "SHA256withRSA",
        "paypal-cert-url": "https://evil.example.com/cert.pem",
        "paypal-transmission-id": "tx-1",
        "paypal-transmission-sig": "sig-1",
        "paypal-transmission-time": "2026-11-15T12:00:00Z",
      },
      parsedEvent: { id: "WH-BAD-1" },
      config: sandboxConfig,
    });
    expect(badSig.valid).toBe(false);

    // 6b. Out-of-order older event (2026-11-01 < 2026-11-15) is ignored and does not overwrite cancelled state
    const outOfOrder = await processVerifiedPayPalWebhookEvent({
      serviceRoleBase44: db,
      config: sandboxConfig,
      event: {
        id: "WH-EVT-OLDER-1",
        event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
        create_time: "2026-11-01T08:00:00Z",
        resource: {
          id: "I-SUB-ORDER-01",
          custom_id: "glsub_user_1_order",
          plan_id: sandboxConfig.planId,
          status: "ACTIVE",
        },
      },
    });
    expect(outOfOrder.outcome).toBe("ignored_out_of_order");

    // 6c. Exact duplicate event ID is ignored
    const duplicateCall = await processVerifiedPayPalWebhookEvent({
      serviceRoleBase44: db,
      config: sandboxConfig,
      event: {
        id: "WH-EVT-OLDER-1",
        event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
        create_time: "2026-11-01T08:00:00Z",
        resource: {
          id: "I-SUB-ORDER-01",
        },
      },
    });
    expect(duplicateCall.duplicate).toBe(true);
  });

  it("7. Intento de vincular una suscripción de otro usuario: rejected with CROSS_ACCOUNT_CONFLICT / CUSTOM_ID_MISMATCH", async () => {
    const db = createInMemoryBase44();
    // User A owns I-SUB-USER-A
    await db.entities.PayPalSubscription.create({
      owner_id: "user_A",
      enrollment_reference: "glsub_user_A_ref",
      paypal_plan_id: sandboxConfig.planId,
      paypal_environment: "sandbox",
      paypal_subscription_id: "I-SUB-USER-A",
      status: "active",
      granted_search_allowance: 20,
    });

    // User B creates their own pending enrollment and tries to claim User A's subscription ID
    const userBEnrollment = await db.entities.PayPalSubscription.create({
      owner_id: "user_B",
      enrollment_reference: "glsub_user_B_ref",
      paypal_plan_id: sandboxConfig.planId,
      paypal_environment: "sandbox",
      status: "pending_approval",
      granted_search_allowance: 0,
    });

    const hijackAttempt = await reconcilePayPalSubscriptionForUser({
      serviceRoleBase44: db,
      userId: "user_B",
      enrollmentRecord: userBEnrollment,
      remoteSubscription: {
        id: "I-SUB-USER-A",
        plan_id: sandboxConfig.planId,
        custom_id: "glsub_user_A_ref",
        status: "ACTIVE",
      },
      planDetails: null,
      config: sandboxConfig,
    });

    expect(hijackAttempt.ok).toBe(false);
    expect(hijackAttempt.verified).toBe(false);
    expect(hijackAttempt.code).toBe("CROSS_ACCOUNT_CONFLICT");
  });
});