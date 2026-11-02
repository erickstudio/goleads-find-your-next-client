import { getPayPalServerConfig, fetchPayPalAccessToken, fetchPayPalPlanDetails } from "@/lib/paypal-billing.server";

export async function ensureSandboxProPlan(fetchImpl = fetch) {
  // This setup action cannot select Live, even if the app's default environment changes.
  const config = getPayPalServerConfig({ env: "sandbox" });
  const token = await fetchPayPalAccessToken(config, fetchImpl);
  if (!token.ok) throw new Error("No se pudo verificar la cuenta de pruebas de PayPal.");
  async function request(path, method = "GET", body, requestId) {
    const response = await fetchImpl(`${config.apiBaseUrl}${path}`, {
      method, signal: AbortSignal.timeout(15000), headers: {
        Authorization: `Bearer ${token.accessToken}`, "Content-Type": "application/json", Accept: "application/json",
        ...(requestId ? { "PayPal-Request-Id": requestId, Prefer: "return=representation" } : {}),
      }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`PayPal no pudo preparar el plan de pruebas (HTTP ${response.status}).`);
    return response.json();
  }
  const name = "GoLeads Pro Sandbox 9.99 monthly";
  const existing = await request("/v1/billing/plans?page_size=20&total_required=true");
  let id = existing.plans?.find((p) => p.name === name && p.status === "ACTIVE")?.id;
  let created = false;
  if (!id) {
    const product = await request("/v1/catalogs/products", "POST", {
      name: "GoLeads Pro Sandbox", description: "Test membership for GoLeads Pro", type: "SERVICE", category: "SOFTWARE", home_url: "https://goleads.space",
    }, "goleads-sb-product-v1");
    const plan = await request("/v1/billing/plans", "POST", {
      product_id: product.id, name, description: "Sandbox only: 500 extra searches per monthly billing cycle", status: "ACTIVE",
      billing_cycles: [{ frequency: { interval_unit: "MONTH", interval_count: 1 }, tenure_type: "REGULAR", sequence: 1, total_cycles: 0,
        pricing_scheme: { fixed_price: { value: "9.99", currency_code: "USD" } } }],
      payment_preferences: { auto_bill_outstanding: true, setup_fee: { value: "0", currency_code: "USD" }, setup_fee_failure_action: "CONTINUE", payment_failure_threshold: 1 },
    }, "goleads-sb-plan-999-v1");
    id = plan.id; created = true;
  }
  const verified = await fetchPayPalPlanDetails({ ...config, planId: id }, token.accessToken, fetchImpl);
  const plan = verified.plan;
  if (!verified.ok || !plan || plan.status !== "ACTIVE" || Number(plan.amount) !== 9.99 || plan.currency !== "USD" || plan.intervalUnit !== "MONTH" || plan.intervalCount !== 1) {
    throw new Error("El plan de pruebas no coincide con 9,99 USD al mes. No se habilitó el pago.");
  }
  return { planId: plan.id, amount: plan.amount, currency: plan.currency, intervalUnit: plan.intervalUnit, intervalCount: plan.intervalCount, status: plan.status, created, environment: "sandbox" };
}

