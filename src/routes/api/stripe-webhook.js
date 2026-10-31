import { createFileRoute } from "@tanstack/react-router";
import {
  getStripeServerConfig,
  verifyStripeWebhookSignature,
  processVerifiedStripeEvent,
} from "@/lib/pilot-billing.server";

export const Route = createFileRoute("/api/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request, context }) => {
        const stripeConfig = getStripeServerConfig();
        if (!stripeConfig.hasWebhookSecret) {
          return Response.json(
            {
              ok: false,
              error: "Stripe webhook secret is not configured in this workspace yet.",
            },
            { status: 503 }
          );
        }

        const signature = request.headers.get("stripe-signature") || "";
        const rawBody = await request.text();

        const verification = verifyStripeWebhookSignature(
          rawBody,
          signature,
          stripeConfig.webhookSecret
        );

        if (!verification.valid) {
          return Response.json(
            {
              ok: false,
              error: `Webhook signature verification failed: ${verification.reason}`,
            },
            { status: 400 }
          );
        }

        let event;
        try {
          event = JSON.parse(rawBody);
        } catch {
          return Response.json(
            { ok: false, error: "Invalid JSON webhook payload" },
            { status: 400 }
          );
        }

        const serviceRoleBase44 = context.getBase44().asServiceRole;
        const result = await processVerifiedStripeEvent(serviceRoleBase44, event);

        return Response.json({
          ok: true,
          ...result,
        });
      },
    },
  },
});