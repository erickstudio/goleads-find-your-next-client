import {
  getPayPalServerConfig,
  verifyPayPalWebhookSignature,
  processVerifiedPayPalWebhookEvent,
} from "@/lib/paypal-billing.server";

const MAX_WEBHOOK_BYTES = 256 * 1024;
const SIGNATURE_HEADERS = ["paypal-auth-algo", "paypal-cert-url", "paypal-transmission-id", "paypal-transmission-sig", "paypal-transmission-time"];

async function readEvent(request) {
  if (Number(request.headers.get("content-length")) > MAX_WEBHOOK_BYTES) {
    throw Object.assign(new Error("Payload too large"), { status: 413 });
  }
  const reader = request.body?.getReader();
  if (!reader) throw Object.assign(new Error("Empty request body"), { status: 400 });
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_WEBHOOK_BYTES) {
        await reader.cancel();
        throw Object.assign(new Error("Payload too large"), { status: 413 });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let event;
  try { event = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw Object.assign(new Error("Malformed JSON"), { status: 400 }); }
  if (!event || Array.isArray(event) || typeof event.id !== "string" || event.id.length > 200 || !event.id.trim() ||
      typeof event.event_type !== "string" || event.event_type.length > 160 || !event.event_type.trim()) {
    throw Object.assign(new Error("Invalid webhook event"), { status: 400 });
  }
  return event;
}

// PayPal calls this without a GoLeads login. Signature verification is its authorization.
// Dependency injection is only used by server tests; the route never takes it from input.
export async function handlePayPalWebhookRequest({ request, context }, dependencies = {}) {
  const reply = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return reply({ ok: false, error: "Expected application/json" }, 415);
  }
  let event;
  try { event = await readEvent(request); }
  catch (error) { return reply({ ok: false, error: error.message }, error.status || 400); }
  if (SIGNATURE_HEADERS.some((name) => !request.headers.get(name))) {
    return reply({ ok: false, error: "Missing PayPal signature" }, 401);
  }
  const config = (dependencies.getConfig || getPayPalServerConfig)();
  if (!config.canAuthenticateWithPayPal || !config.hasWebhookId) {
    return reply({ ok: false, error: "Webhook configuration is incomplete" }, 503);
  }
  let verification;
  try {
    verification = await (dependencies.verify || verifyPayPalWebhookSignature)({ headers: request.headers, parsedEvent: event, config });
  } catch {
    return reply({ ok: false, error: "PayPal verification is temporarily unavailable" }, 503);
  }
  if (!verification.valid) return reply({ ok: false, error: "PayPal signature was not verified" }, verification.retryable ? 503 : 401);
  try {
    // Obtain privileged access only after the event has been verified.
    const serviceRoleBase44 = context.getBase44().asServiceRole;
    const result = await (dependencies.process || processVerifiedPayPalWebhookEvent)({ serviceRoleBase44, event, config });
    return reply({ ok: true, received: true, duplicate: Boolean(result.duplicate), outcome: result.outcome });
  } catch {
    // A failure remains retryable; it is never acknowledged as processed.
    return reply({ ok: false, error: "Webhook processing incomplete; retry delivery" }, 500);
  }
}

