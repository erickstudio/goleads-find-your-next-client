import { createFileRoute } from "@tanstack/react-router";
import {
  getPayPalServerConfig,
  verifyPayPalWebhookSignature,
  processVerifiedPayPalWebhookEvent,
  REQUIRED_PAYPAL_WEBHOOK_EVENTS,
} from "@/lib/paypal-billing.server";

export const Route = createFileRoute("/api/paypal-webhook")({
  server: {
    handlers: {
      GET: async () => {
        const config = getPayPalServerConfig();
        return Response.json({
          ok: true,
          endpoint: "/api/paypal-webhook",
          environment: config.env,
          hasClientSecret: config.hasClientSecret,
          hasWebhookId: config.hasWebhookId,
          requiredEvents: REQUIRED_PAYPAL_WEBHOOK_EVENTS,
        });
      },

      POST: async ({ request, context }) => {
        const rawBody = await request.text();
        if (!rawBody) {
          return Response.json(
            { ok: false, error: "Empty request body" },
            { status: 400 }
          );
        }

        let parsedEvent;
        try {
          parsedEvent = JSON.parse(rawBody);
        } catch {
          return Response.json(
            { ok: false, error: "Malformed JSON webhook body" },
            { status: 400 }
          );
        }

        const config = getPayPalServerConfig();
        const verification = await verifyPayPalWebhookSignature({
          headers: request.headers,
          parsedEvent,
          config,
        });

        const base44 = context.getBase44();
        const serviceRole = base44.asServiceRole;

        if (!verification.valid) {
          const eventId = String(parsedEvent?.id || "").trim();
          const eventType = String(parsedEvent?.event_type || "UNKNOWN").trim();
          if (eventId) {
            await serviceRole.entities.PayPalWebhookEvent.create({
              paypal_event_id: `rejected_${eventId}_${Date.now()}`,
              event_type: eventType,
              paypal_subscription_id: String(
                parsedEvent?.resource?.billing_agreement_id ||
                  parsedEvent?.resource?.id ||
                  "unmatched"
              ),
              resource_id: String(parsedEvent?.resource?.id || ""),
              environment: config.env,
              event_create_time_iso: String(
                parsedEvent?.create_time || new Date().toISOString()
              ),
              verification_status: "FAILURE",
              processing_outcome: "rejected_signature",
              processed_at_iso: new Date().toISOString(),
              notes: verification.reason,
            }).catch(() => {});
          }

          return Response.json(
            {
              ok: false,
              verified: false,
              error: verification.reason,
            },
            { status: 401 }
          );
        }

        try {
          const result = await processVerifiedPayPalWebhookEvent({
            serviceRoleBase44: serviceRole,
            event: parsedEvent,
            config,
          });
          return Response.json({
            ok: true,
            verified: true,
            ...result,
          });
        } catch (err) {
          return Response.json(
            {
              ok: false,
              error: err?.message || "Webhook processing failed",
            },
            { status: 500 }
          );
        }
      },
    },
  },
});