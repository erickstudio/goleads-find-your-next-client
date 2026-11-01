// Pure entitlement check shared by server quota calculations and isolated tests.
// Only server-verified records may reach this check; entity rules protect writes.
export function isPayPalSubscriptionAllowanceActive(sub, nowMs = Date.now()) {
  if (!sub || !["active", "trialing", "cancelled"].includes(sub.status)) return false;
  if (!sub.verified_at_iso || !sub.paypal_subscription_id) return false;
  const endMs = Date.parse(sub.current_period_end_iso || "");
  if (!Number.isFinite(endMs) || endMs <= nowMs) return false;
  return (Number(sub.granted_search_allowance) || 0) > 0;
}

