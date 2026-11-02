import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { preparePayPalSubscriptionOrder } from "@/lib/paypal-server-fns";

// The server creates the subscription and chooses the trusted PayPal approval URL.
// A browser redirect never grants Pro; return handling and signed webhooks verify it.
export default function PayPalSubscriptionButton({ disabled = false, isEs = true, onPendingChange, onErrorMessage }) {
  const prepare = useServerFn(preparePayPalSubscriptionOrder);
  const [busy, setBusy] = useState(false);
  async function openPayPal() {
    if (disabled || busy) return;
    setBusy(true); onPendingChange?.(true); onErrorMessage?.("");
    try {
      const result = await prepare({ data: { returnOrigin: window.location.origin } });
      if (!result?.ok || !result.approvalUrl) throw new Error("Checkout unavailable");
      // Defense in depth; the server checks the exact environment-specific origin.
      const destination = new URL(result.approvalUrl);
      if (destination.protocol !== "https:" || !["www.sandbox.paypal.com", "www.paypal.com"].includes(destination.hostname) || destination.username || destination.password || destination.port) throw new Error("Invalid checkout destination");
      window.location.assign(destination.href);
    } catch {
      onErrorMessage?.(isEs ? "No se pudo abrir PayPal. Inténtalo de nuevo más tarde." : "Unable to open PayPal. Please try again later.");
      setBusy(false); onPendingChange?.(false);
    }
  }
  return <div className="space-y-3"><button type="button" disabled={disabled || busy} onClick={openPayPal} className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#FFC439] px-6 py-3 text-sm font-semibold text-[#003087] hover:bg-[#F2BA36] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{busy ? (isEs ? "Abriendo PayPal…" : "Opening PayPal…") : (isEs ? "Continuar con PayPal" : "Continue with PayPal")}</button><p className="text-xs leading-6 text-muted-foreground">{isEs ? "Revisa y aprueba la suscripción en el sitio seguro de PayPal. Al volver, confirmaremos el estado de tu pago." : "Review and approve your subscription on PayPal’s secure website. We confirm your payment status when you return."}</p></div>;
}
