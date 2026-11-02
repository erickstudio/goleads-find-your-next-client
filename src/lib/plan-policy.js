import { isPayPalSubscriptionAllowanceActive } from "@/lib/subscription-access";

export const PLAN_SPEC = Object.freeze({
  free: { name: "Gratis", dailySearches: 3, maxResults: 5 },
  pro: { name: "Pro", cycleSearches: 500, maxResults: 20 },
});

export function planAccessForSubscriptions(subscriptions = [], nowMs = Date.now()) {
  const isPro = subscriptions.some((sub) => isPayPalSubscriptionAllowanceActive(sub, nowMs));
  return { plan: isPro ? "pro" : "free", isPro, maxResultsPerSearch: isPro ? PLAN_SPEC.pro.maxResults : PLAN_SPEC.free.maxResults,
    canExportSheets: true, canExportCsv: isPro, canWorkspace: isPro, canMcp: isPro };
}

export function assertProAccess(access) {
  if (!access?.isPro) throw Object.assign(new Error("Esta función requiere un plan Pro vigente. / An active Pro plan is required."), { status: 403, code: "PRO_REQUIRED" });
}

export function assertAdministrator(user) {
  if (user?.role !== "admin") throw Object.assign(new Error("Forbidden"), { status: 403, code: "ADMIN_REQUIRED" });
}

export function customerBillingSummary({ config, verification, subscriptions = [], quota, nowMs = Date.now() }) {
  const access = planAccessForSubscriptions(subscriptions, nowMs);
  const remote = verification?.ok ? verification.plan : null;
  const ready = Boolean(config.canAuthenticateWithPayPal && config.hasWebhookId && config.planId && remote?.status === "ACTIVE" && config.hasConfiguredAllowance);
  const subscription = subscriptions.find((s) => isPayPalSubscriptionAllowanceActive(s, nowMs)) || subscriptions[0];
  return {
    access, quota,
    offer: { name: "GoLeads Pro", extraSearches: PLAN_SPEC.pro.cycleSearches, maxResults: PLAN_SPEC.pro.maxResults,
      price: remote?.amount && remote?.currency ? { amount: remote.amount, currency: remote.currency, intervalUnit: remote.intervalUnit, intervalCount: remote.intervalCount } : null,
      checkout: ready ? { ready: true, clientId: config.clientId, planId: config.planId } : { ready: false } },
    subscription: subscription ? { id: subscription.id, subscriptionId: subscription.paypal_subscription_id, status: subscription.status,
      periodEnd: subscription.current_period_end_iso || null, cancelled: Boolean(subscription.cancel_at_period_end) } : null,
  };
}

