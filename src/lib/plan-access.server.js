import { isOwnerAccount } from "@/lib/owner-access.server";
import { getPayPalServerConfig } from "@/lib/paypal-billing.server";
import { planAccessForSubscriptions, assertProAccess } from "@/lib/plan-policy";

export async function loadPlanAccess(context) {
  if (!context.user?.id) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const config = getPayPalServerConfig();
  const page = await context.getBase44().entities.PayPalSubscription.filter({ owner_id: context.user.id }, { limit: 30, sort: "-created_date" });
  const owned = (page?.items || []).filter((s) => s.owner_id === context.user.id && s.paypal_environment === config.env && s.paypal_plan_id === config.planId);
  return planAccessForSubscriptions(owned, Date.now(), { isOwner: isOwnerAccount(context.user) });
}

export async function requireProContext(context) {
  const access = await loadPlanAccess(context);
  assertProAccess(access);
  return access;
}
