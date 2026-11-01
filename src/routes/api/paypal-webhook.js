import { createFileRoute } from "@tanstack/react-router";
import { handlePayPalWebhookRequest } from "@/lib/paypal-webhook-handler.server";

export const Route = createFileRoute("/api/paypal-webhook")({
  server: {
    handlers: {
      GET: async () => Response.json(
        { service: "GoLeads PayPal webhook", method: "POST" },
        { headers: { "Cache-Control": "no-store" } },
      ),
      POST: handlePayPalWebhookRequest,
    },
  },
});
