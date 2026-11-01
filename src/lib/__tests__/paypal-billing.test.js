import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";

// Loads the real server modules while replacing only the platform's virtual secret store.
// No request in this suite reaches PayPal or reads production credentials.
async function load(relativePath, secretValues = {}, globals = {}) {
  const context = vm.createContext({ URL, URLSearchParams, Request, Response, Headers, TextDecoder, Uint8Array,
    AbortSignal, setTimeout, clearTimeout, console, ...globals });
  const cache = new Map();
  async function moduleFor(specifier, parent = process.cwd() + "/") {
    let key = specifier;
    if (!specifier.startsWith("node:") && specifier !== "base44:runtime") {
      key = specifier.startsWith("@/") ? path.resolve("src", specifier.slice(2)) : path.resolve(path.dirname(parent), specifier);
      if (!key.endsWith(".js") && !key.endsWith(".jsx")) key += ".js";
    }
    if (cache.has(key)) return cache.get(key);
    let mod;
    if (key === "base44:runtime") {
      mod = new vm.SyntheticModule(["secrets"], function () {
        this.setExport("secrets", { get: (name) => secretValues[name] });
      }, { context });
    } else if (key.startsWith("node:")) {
      const native = await import(key);
      mod = new vm.SyntheticModule(Object.keys(native), function () {
        for (const name of Object.keys(native)) this.setExport(name, native[name]);
      }, { context });
    } else {
      mod = new vm.SourceTextModule(await readFile(key, "utf8"), { context, identifier: key });
    }
    cache.set(key, mod);
    await mod.link((child) => moduleFor(child, key));
    return mod;
  }
  const mod = await moduleFor(path.resolve(relativePath));
  await mod.evaluate();
  return mod.namespace;
}

const testSecrets = { PAYPAL_ID: "live-id", PAYPAL_SECRET: "live-secret", PAYPAL_ID_TEST: "test-id", PAYPAL_SECRET_TEST: "test-secret", PAYPAL_PLAN_ID_TEST: "P-TEST", PAYPAL_WEBHOOK_ID_TEST: "WH-TEST" };
const nowIso = "2026-11-10T00:00:00.000Z";
const baseRecord = { id: "record-1", owner_id: "user-1", created_by_id: "service-account", enrollment_reference: "ref-1", paypal_environment: "sandbox", paypal_plan_id: "P-TEST", paypal_subscription_id: "I-TEST", status: "active", verified_at_iso: nowIso, current_period_end_iso: "2026-12-01T00:00:00.000Z", granted_search_allowance: 20, used_subscription_searches: 5 };
function memoryDatabase(record = baseRecord) {
  const subscriptions = new Map(record ? [[record.id, { ...record }]] : []);
  const events = new Map();
  const entity = (store) => ({
    filter: async (query) => ({ items: [...store.values()].filter((item) => Object.entries(query).every(([key, value]) => item[key] === value)) }),
    create: async (data) => { const item = { id: `id-${store.size}`, ...data }; store.set(item.id, item); return item; },
    update: async (id, patch) => { const item = { ...store.get(id), ...patch }; store.set(id, item); return item; },
  });
  return { entities: { PayPalSubscription: entity(subscriptions), PayPalWebhookEvent: entity(events) }, subscriptions, events };
}
function subscription(status = "ACTIVE", end = "2026-12-01T00:00:00.000Z") {
  return { id: "I-TEST", plan_id: "P-TEST", custom_id: "ref-1", status, start_time: "2026-11-01T00:00:00Z", billing_info: { next_billing_time: end, last_payment: { time: "2026-11-01T00:00:00Z", amount: { value: "10", currency_code: "USD" } } } };
}
function payPalFetch(remote) {
  return async (url) => {
    if (url.endsWith("/v1/oauth2/token")) return Response.json({ access_token: "fake-test-token" });
    if (url.includes("/v1/billing/subscriptions/")) return Response.json(remote);
    throw new Error("Unexpected external request");
  };
}

test("Auth defaults to /app, preserves internal return targets and removes bootstrap credentials", async () => {
  const auth = await load("src/lib/authReturnTo.js", {}, { window: { location: { origin: "https://goleads.space", pathname: "/login", search: "" } } });
  assert.equal(auth.safeReturnTo(), "/app");
  assert.equal(auth.sanitizeReturnTo("https://attacker.example/path"), "/app");
  assert.equal(auth.sanitizeReturnTo("//attacker.example/path"), "/app");
  assert.equal(auth.sanitizeReturnTo("/login?returnTo=/login"), "/app");
  assert.equal(auth.sanitizeReturnTo("/reset-password?token=private"), "/app");
  assert.equal(auth.sanitizeReturnTo("/dashboard?access_token=private&returnTo=/login&filter=recent"), "/dashboard?filter=recent");
  assert.equal(auth.sanitizeReturnTo("/oauth/consent?ctx=example"), "/oauth/consent?ctx=example");
});

test("Sandbox reads only test aliases; Live reads live aliases and the existing typo alias", async () => {
  const billing = await load("src/lib/paypal-billing.server.js", testSecrets);
  const sandbox = billing.getPayPalServerConfig();
  assert.equal(sandbox.env, "sandbox");
  assert.equal(sandbox.clientId, "test-id");
  assert.equal(sandbox.clientSecret, "test-secret");
  assert.equal(sandbox.planId, "P-TEST");
  assert.equal(sandbox.webhookId, "WH-TEST");
  const live = billing.getPayPalServerConfig({ env: "live" });
  assert.equal(live.clientId, "live-id");
  assert.equal(live.clientSecret, "live-secret");
  const typo = await load("src/lib/paypal-billing.server.js", { PAYPAL_ENV: "live", PAYPAL_ID: "live-id", PAYPAYL_SECRET: "legacy-live-secret" });
  assert.equal(typo.getPayPalServerConfig().clientSecret, "legacy-live-secret");
  const liveOnly = await load("src/lib/paypal-billing.server.js", { PAYPAL_ID: "live-id", PAYPAL_SECRET: "live-secret" });
  assert.equal(liveOnly.getPayPalServerConfig().canAuthenticateWithPayPal, false);
  assert.equal(billing.getPayPalServerConfig({ planSearchAllowance: "0.5" }).hasConfiguredAllowance, false);
});

test("Paid allowance requires verified, unexpired dates and survives cancellation until expiry", async () => {
  const billing = await load("src/lib/paypal-billing.server.js", testSecrets);
  const active = (patch) => billing.isPayPalSubscriptionAllowanceActive({ ...baseRecord, ...patch }, Date.parse(nowIso));
  assert.equal(active({}), true);
  assert.equal(active({ status: "cancelled" }), true);
  assert.equal(active({ verified_at_iso: "" }), false);
  assert.equal(active({ current_period_end_iso: "invalid" }), false);
  assert.equal(active({ current_period_end_iso: "2026-11-01T00:00:00Z" }), false);
  assert.equal(active({ status: "suspended" }), false);
});

const signature = { "content-type": "application/json", "paypal-auth-algo": "SHA256withRSA", "paypal-cert-url": "https://api.sandbox.paypal.com/cert", "paypal-transmission-id": "tx-test", "paypal-transmission-sig": "test-signature", "paypal-transmission-time": nowIso };
function notification(headers = signature, body = { id: "WH-1", event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "I-TEST" } }) {
  return new Request("https://goleads.space/api/paypal-webhook", { method: "POST", headers, body: JSON.stringify(body) });
}
test("Unsigned and invalid notifications never acquire privileged access or write records", async () => {
  const handler = await load("src/lib/paypal-webhook-handler.server.js", testSecrets);
  const context = { getBase44() { throw new Error("Privileged access must not be reached"); } };
  const unsigned = await handler.handlePayPalWebhookRequest({ request: notification({ "content-type": "application/json" }), context });
  assert.equal(unsigned.status, 401);
  const invalid = await handler.handlePayPalWebhookRequest({ request: notification(), context }, { verify: async () => ({ valid: false }) });
  assert.equal(invalid.status, 401);
  const unavailable = await handler.handlePayPalWebhookRequest({ request: notification(), context }, { verify: async () => { throw new Error("Network failed"); } });
  assert.equal(unavailable.status, 503);
});

test("Webhook rejects oversized, malformed or unsupported requests", async () => {
  const handler = await load("src/lib/paypal-webhook-handler.server.js", testSecrets);
  const oversized = notification({ ...signature, "content-length": String(300 * 1024) });
  assert.equal((await handler.handlePayPalWebhookRequest({ request: oversized })).status, 413);
  const malformed = new Request("https://goleads.space/api/paypal-webhook", { method: "POST", headers: signature, body: "{" });
  assert.equal((await handler.handlePayPalWebhookRequest({ request: malformed })).status, 400);
  assert.equal((await handler.handlePayPalWebhookRequest({ request: notification({ "content-type": "text/plain" }) })).status, 415);
});

test("Verified webhook processes once and does not expose private subscription data in its response", async () => {
  const handler = await load("src/lib/paypal-webhook-handler.server.js", testSecrets);
  let calls = 0;
  const result = await handler.handlePayPalWebhookRequest({ request: notification(), context: { getBase44: () => ({ asServiceRole: {} }) } }, {
    verify: async () => ({ valid: true }),
    process: async () => { calls++; return { outcome: "processed_activated", subscription: { owner_email: "private@example.com" } }; },
  });
  assert.equal(result.status, 200);
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(await result.json()).includes("private@example.com"), false);
});

test("Signature verification rejects untrusted certificates before making any API request", async () => {
  const billing = await load("src/lib/paypal-billing.server.js", testSecrets);
  const result = await billing.verifyPayPalWebhookSignature({ headers: new Headers({ ...signature, "paypal-cert-url": "https://attacker.example/cert" }), parsedEvent: {}, config: billing.getPayPalServerConfig(), fetchImpl: () => { throw new Error("Must not fetch"); } });
  assert.equal(result.valid, false);
});

test("Subscription ownership uses the authenticated owner, not the service account creator", async () => {
  const billing = await load("src/lib/paypal-billing.server.js", testSecrets);
  const db = memoryDatabase();
  const args = { serviceRoleBase44: db, userId: "user-1", enrollmentRecord: baseRecord, remoteSubscription: subscription(), planDetails: null, config: billing.getPayPalServerConfig({ planSearchAllowance: "20" }), nowIso };
  assert.equal((await billing.reconcilePayPalSubscriptionForUser(args)).verified, true);
  assert.equal((await billing.reconcilePayPalSubscriptionForUser({ ...args, userId: "other-user" })).verified, false);
});

test("Activation, sale and repeated event IDs cannot reset usage twice for the same billing period", async () => {
  const billing = await load("src/lib/paypal-billing.server.js", testSecrets);
  const db = memoryDatabase();
  const args = { serviceRoleBase44: db, config: billing.getPayPalServerConfig({ planSearchAllowance: "20" }), nowIso, fetchImpl: payPalFetch(subscription()) };
  await billing.processVerifiedPayPalWebhookEvent({ ...args, event: { id: "WH-A", event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "I-TEST" } } });
  assert.equal(db.subscriptions.get("record-1").used_subscription_searches, 5);
  await billing.processVerifiedPayPalWebhookEvent({ ...args, event: { id: "WH-B", event_type: "PAYMENT.SALE.COMPLETED", resource: { id: "SALE-1", billing_agreement_id: "I-TEST" } } });
  assert.equal(db.subscriptions.get("record-1").used_subscription_searches, 5);
  const duplicate = await billing.processVerifiedPayPalWebhookEvent({ ...args, fetchImpl: () => { throw new Error("Duplicate must not fetch"); }, event: { id: "WH-B", event_type: "PAYMENT.SALE.COMPLETED", resource: {} } });
  assert.equal(duplicate.duplicate, true);
  const renewal = { ...args, fetchImpl: payPalFetch(subscription("ACTIVE", "2027-01-01T00:00:00Z")) };
  await billing.processVerifiedPayPalWebhookEvent({ ...renewal, event: { id: "WH-C", event_type: "PAYMENT.SALE.COMPLETED", resource: { id: "SALE-2", billing_agreement_id: "I-TEST" } } });
  assert.equal(db.subscriptions.get("record-1").used_subscription_searches, 0);
});

test("An UPDATED event uses current PayPal state instead of incorrectly activating a suspended subscription", async () => {
  const billing = await load("src/lib/paypal-billing.server.js", testSecrets);
  const db = memoryDatabase();
  await billing.processVerifiedPayPalWebhookEvent({ serviceRoleBase44: db, config: billing.getPayPalServerConfig(), nowIso, fetchImpl: payPalFetch(subscription("SUSPENDED")), event: { id: "WH-UP", event_type: "BILLING.SUBSCRIPTION.UPDATED", resource: { id: "I-TEST" } } });
  assert.equal(db.subscriptions.get("record-1").status, "suspended");
  assert.equal(db.subscriptions.get("record-1").granted_search_allowance, 0);
});

test("Missing enrollment remains retryable and a subscription without a confirmed period gains no quota", async () => {
  const billing = await load("src/lib/paypal-billing.server.js", testSecrets);
  const db = memoryDatabase(null);
  await assert.rejects(billing.processVerifiedPayPalWebhookEvent({ serviceRoleBase44: db, config: billing.getPayPalServerConfig(), nowIso, event: { id: "WH-N", event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "I-TEST" } }, fetchImpl: () => { throw new Error("Must not fetch"); } }));
  assert.equal(db.events.size, 0);
  const noPeriod = { ...baseRecord, current_period_end_iso: "" };
  const db2 = memoryDatabase(noPeriod);
  const result = await billing.reconcilePayPalSubscriptionForUser({ serviceRoleBase44: db2, userId: "user-1", enrollmentRecord: noPeriod, remoteSubscription: subscription("ACTIVE", ""), config: billing.getPayPalServerConfig(), nowIso });
  assert.equal(result.verified, false);
  assert.equal(result.subscriptionRecord.granted_search_allowance, 0);
});

test("Subscription entity prevents direct writes by ordinary users and permits owner reads", async () => {
  const schema = JSON.parse(await readFile("base44/entities/PayPalSubscription.jsonc", "utf8"));
  assert.deepEqual(schema.rls.create, { user_condition: { role: "admin" } });
  assert.deepEqual(schema.rls.update, { user_condition: { role: "admin" } });
  assert.ok(schema.rls.read.$or.some((rule) => rule.owner_id === "{{user.id}}"));
});
