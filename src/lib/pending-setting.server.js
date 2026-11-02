import { secrets } from "base44:runtime";
import { getPayPalServerConfig, fetchPayPalAccessToken, fetchPayPalPlanDetails, REQUIRED_PAYPAL_WEBHOOK_EVENTS } from "@/lib/paypal-billing.server";

// Administrator-only caller. Return classifications and verified commercial metadata, never values or tokens.
export async function inspectPendingPayPalSetting(fetchImpl = fetch) {
  const candidate = String(secrets.get("PAYPAL_SUSCRIPTION_ID") || "").trim();
  const kind = /^P-[A-Z0-9]+$/i.test(candidate) ? "plan" : /^I-[A-Z0-9]+$/i.test(candidate) ? "customer_subscription" : /^[A-Z0-9-]{6,100}$/i.test(candidate) ? "possible_webhook" : candidate ? "unrecognized" : "missing";
  if (["missing", "unrecognized"].includes(kind)) return { setting: "PAYPAL_SUSCRIPTION_ID", kind, environments: [] };
  const environments = await Promise.all(["sandbox", "live"].map(async (env) => {
    const config = getPayPalServerConfig({ env, ...(kind === "plan" ? { planId: candidate } : {}) });
    const auth = await fetchPayPalAccessToken(config, fetchImpl);
    if (!auth.ok) return { environment: env, credentialsVerified: false, plan: null, webhook: null };
    let plan = null;
    if (kind === "plan") {
      const result = await fetchPayPalPlanDetails(config, auth.accessToken, fetchImpl);
      if (result.ok) {
        const p = result.plan;
        plan = { verified: true, status: p.status, amount: p.amount, currency: p.currency, intervalUnit: p.intervalUnit, intervalCount: p.intervalCount };
      }
    }
    const response = await fetchImpl(`${config.apiBaseUrl}/v1/notifications/webhooks`, {
      method: "GET", signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${auth.accessToken}`, Accept: "application/json" },
    }).catch(() => null);
    const payload = response?.ok ? await response.json().catch(() => ({})) : null;
    const matches = (payload?.webhooks || []).filter((h) => h.url === "https://goleads.space/api/paypal-webhook");
    const registered = matches.find((h) => h.id === candidate) || matches[0];
    const eventNames = new Set((registered?.event_types || []).map((e) => e.name));
    return { environment: env, credentialsVerified: true, plan,
      webhook: { lookupSucceeded: Boolean(payload), targetFound: Boolean(registered), candidateIsTargetWebhook: Boolean(registered && registered.id === candidate),
        missingEvents: registered ? REQUIRED_PAYPAL_WEBHOOK_EVENTS.filter((e) => !eventNames.has(e) && !eventNames.has("*")) : REQUIRED_PAYPAL_WEBHOOK_EVENTS } };
  }));
  return { setting: "PAYPAL_SUSCRIPTION_ID", kind, environments };
}

