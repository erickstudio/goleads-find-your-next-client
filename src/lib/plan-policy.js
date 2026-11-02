import { isPayPalSubscriptionAllowanceActive, isProAccessGrantActive } from "@/lib/subscription-access";

export const PLAN_SPEC = Object.freeze({
  free: { name: "Gratis", dailySearches: 3, maxResults: 5 },
  pro: { name: "Pro", cycleSearches: 500, maxResults: 20 },
});

export function planAccessForSubscriptions(subscriptions = [], nowMs = Date.now(), { isOwner = false, complimentaryGrants = [] } = {}) {
  const hasPaidSub = subscriptions.some((sub) => isPayPalSubscriptionAllowanceActive(sub, nowMs));
  const hasComplimentary = (complimentaryGrants || []).some((g) => isProAccessGrantActive(g, nowMs));
  const isPro = isOwner || hasPaidSub || hasComplimentary;
  return { plan: isPro ? "pro" : "free", isPro, isOwner, hasComplimentaryPro: hasComplimentary, unlimitedSearches: isOwner, entitlementSource: isOwner ? "owner" : hasPaidSub ? "subscription" : hasComplimentary ? "complimentary" : "free", maxResultsPerSearch: isPro ? PLAN_SPEC.pro.maxResults : PLAN_SPEC.free.maxResults,
    canExportSheets: true, canExportCsv: isPro, canWorkspace: isPro, canMcp: isPro };
}

export function assertProAccess(access) {
  if (!access?.isPro) throw Object.assign(new Error("Esta función requiere un plan Pro vigente. / An active Pro plan is required."), { status: 403, code: "PRO_REQUIRED" });
}

export function assertAdministrator(user) {
  if (user?.role !== "admin") throw Object.assign(new Error("Forbidden"), { status: 403, code: "ADMIN_REQUIRED" });
}

export function customerBillingSummary({ config, verification, subscriptions = [], complimentaryGrants = [], quota, nowMs = Date.now(), isOwner = false }) {
  const access = planAccessForSubscriptions(subscriptions, nowMs, { isOwner, complimentaryGrants });
  const remote = verification?.ok ? verification.plan : null;
  const ready = Boolean(config.canAuthenticateWithPayPal && config.hasWebhookId && config.planId && remote?.status === "ACTIVE" && config.hasConfiguredAllowance);
  const subscription = subscriptions.find((s) => isPayPalSubscriptionAllowanceActive(s, nowMs)) || subscriptions[0];
  const activeGrant = (complimentaryGrants || []).find((g) => isProAccessGrantActive(g, nowMs)) || null;
  return {
    access, quota,
    offer: { name: "GoLeads Pro", extraSearches: PLAN_SPEC.pro.cycleSearches, maxResults: PLAN_SPEC.pro.maxResults,
      price: remote?.amount && remote?.currency ? { amount: remote.amount, currency: remote.currency, intervalUnit: remote.intervalUnit, intervalCount: remote.intervalCount } : null,
      checkout: ready ? { ready: true, clientId: config.clientId, planId: config.planId, testMode: config.env === "sandbox" } : { ready: false } },
    subscription: subscription ? { id: subscription.id, subscriptionId: subscription.paypal_subscription_id, status: subscription.status,
      periodEnd: subscription.current_period_end_iso || null, cancelled: Boolean(subscription.cancel_at_period_end) } : null,
    complimentaryGrant: activeGrant ? { id: activeGrant.id, reason: activeGrant.reason, expiresAt: activeGrant.expires_at_iso || null,
      grantedSearches: Number(activeGrant.granted_search_allowance) || 0, usedSearches: Number(activeGrant.used_searches) || 0 } : undefined,
  };
}