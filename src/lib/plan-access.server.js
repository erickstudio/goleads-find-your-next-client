import { isOwnerAccount } from "@/lib/owner-access.server";
import { getPayPalServerConfig } from "@/lib/paypal-billing.server";
import { planAccessForSubscriptions, assertProAccess } from "@/lib/plan-policy";
import { isProAccessGrantActive } from "@/lib/subscription-access";

export async function loadActiveUserProGrants(base44, user, nowMs = Date.now()) {
  if (!user?.id || !base44?.asServiceRole?.entities?.ProAccessGrant?.filter) return [];
  const email = String(user.email || "").trim().toLowerCase();
  const page = await base44.asServiceRole.entities.ProAccessGrant.filter(
    { status: "active" },
    { limit: 50, sort: "-created_date" }
  ).catch(() => ({ items: [] }));
  return (page?.items || []).filter((g) => {
    if (!isProAccessGrantActive(g, nowMs)) return false;
    if (g.target_user_id && g.target_user_id === user.id) return true;
    if (email && g.target_email && String(g.target_email).trim().toLowerCase() === email) return true;
    return false;
  });
}

export async function loadPlanAccess(context) {
  if (!context.user?.id) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const config = getPayPalServerConfig();
  const base44 = context.getBase44();
  const [page, complimentaryGrants] = await Promise.all([
    base44.entities.PayPalSubscription.filter({ owner_id: context.user.id }, { limit: 30, sort: "-created_date" }),
    loadActiveUserProGrants(base44, context.user),
  ]);
  const owned = (page?.items || []).filter((s) => s.owner_id === context.user.id && s.paypal_environment === config.env && s.paypal_plan_id === config.planId);
  return planAccessForSubscriptions(owned, Date.now(), {
    isOwner: isOwnerAccount(context.user),
    complimentaryGrants,
  });
}

export async function requireProContext(context) {
  const access = await loadPlanAccess(context);
  assertProAccess(access);
  return access;
}