// Pure entitlement check shared by server quota calculations and isolated tests.
// Only server-verified records may reach this check; entity rules protect writes.
export function isPayPalSubscriptionAllowanceActive(sub, nowMs = Date.now()) {
  if (!sub || !["active", "trialing", "cancelled"].includes(sub.status)) return false;
  if (!sub.verified_at_iso || !sub.paypal_subscription_id) return false;
  const endMs = Date.parse(sub.current_period_end_iso || "");
  if (!Number.isFinite(endMs) || endMs <= nowMs) return false;
  return (Number(sub.granted_search_allowance) || 0) > 0;
}

export function isProAccessGrantActive(grant, nowMs = Date.now()) {
  if (!grant || grant.status !== "active") return false;
  if (grant.grant_type === "access_code" && !grant.target_user_id && !grant.target_email) return false;
  if (grant.expires_at_iso) {
    const endMs = Date.parse(grant.expires_at_iso);
    if (!Number.isFinite(endMs) || endMs <= nowMs) return false;
  }
  return (Number(grant.granted_search_allowance) || 0) > 0;
}