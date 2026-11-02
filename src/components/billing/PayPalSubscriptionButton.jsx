import { useMemo, useRef, useState } from "react";
import { PayPalScriptProvider, PayPalButtons, usePayPalScriptReducer } from "@paypal/react-paypal-js";
import { useServerFn } from "@tanstack/react-start";
import { preparePayPalSubscriptionOrder, confirmPayPalSubscriptionOnServer, recordPayPalCheckoutCancelOrError } from "@/lib/paypal-server-fns";

export default function PayPalSubscriptionButton({ clientId, planId, testMode = false, ...props }) {
  const options = useMemo(() => ({ clientId, components: "buttons", intent: "subscription", vault: true, currency: "USD",
    enableFunding: "card", dataSdkIntegrationSource: "button-factory", debug: testMode,
    ...(testMode ? { buyerCountry: "US" } : {}),
  }), [clientId, testMode]);
  if (!clientId || !planId) return null;
  return <PayPalScriptProvider key={clientId} options={options}><SubscriptionMethods {...props} /></PayPalScriptProvider>;
}

function SubscriptionMethods({ disabled = false, isEs = true, onPendingChange, onErrorMessage, onVerified, onCancelled }) {
  const [{ isPending, isRejected }, dispatch] = usePayPalScriptReducer();
  const [busy, setBusy] = useState(false);
  const enrollment = useRef(null);
  const prepare = useServerFn(preparePayPalSubscriptionOrder);
  const confirm = useServerFn(confirmPayPalSubscriptionOnServer);
  const cancel = useServerFn(recordPayPalCheckoutCancelOrError);
  function pending(value) { setBusy(value); onPendingChange?.(value); }
  async function createSubscription() {
    pending(true); onErrorMessage?.("");
    try {
      const result = await prepare({ data: { returnOrigin: window.location.origin } });
      if (!result?.ok || !result.subscriptionId) throw new Error("Unable to start subscription");
      enrollment.current = result.enrollmentId;
      return result.subscriptionId;
    } catch (e) {
      pending(false); onErrorMessage?.(isEs ? "No se pudo iniciar la suscripción. Inténtalo de nuevo." : "Unable to start the subscription. Please try again."); throw e;
    }
  }
  async function onApprove(data) {
    pending(true);
    try {
      const result = await confirm({ data: { subscription_id: data.subscriptionID, enrollment_id: enrollment.current || undefined } });
      if (result?.ok && result?.verified) await onVerified?.(result);
      else onErrorMessage?.(isEs ? "El pago aún no está confirmado. Actualiza el estado de tu suscripción." : "Payment is not confirmed yet. Refresh your subscription status.");
    } catch { onErrorMessage?.(isEs ? "No pudimos confirmar la suscripción. Inténtalo más tarde." : "Unable to confirm the subscription. Please try later."); }
    finally { pending(false); }
  }
  async function onCancel(data) {
    try { if (enrollment.current) await cancel({ data: { enrollment_id: enrollment.current, subscription_id: data?.subscriptionID || undefined, outcome: "cancelled" } }); }
    finally { pending(false); onCancelled?.(); }
  }
  function onError() { pending(false); onErrorMessage?.(isEs ? "No se pudo completar el pago. Puedes volver a intentarlo." : "Unable to complete checkout. Please try again."); }
  const callbacks = { createSubscription, onApprove, onCancel, onError };
  return <div className="space-y-4">
    {isPending && <p role="status" className="text-xs text-muted-foreground">{isEs ? "Cargando métodos de pago…" : "Loading payment methods…"}</p>}
    {isRejected ? <div role="alert" className="space-y-3 text-sm"><p>{isEs ? "No se pudieron cargar los métodos de pago." : "Unable to load payment methods."}</p><button type="button" onClick={() => dispatch({ type: "setLoadingStatus", value: "pending" })} className="text-primary underline">{isEs ? "Reintentar" : "Try again"}</button></div> : <>
      <div aria-label="PayPal"><PayPalButtons fundingSource="paypal" disabled={disabled || busy} style={{ shape: "pill", color: "gold", layout: "vertical", label: "subscribe", height: 45 }} {...callbacks}><p className="text-xs text-muted-foreground">{isEs ? "PayPal no está disponible para esta sesión." : "PayPal is unavailable for this session."}</p></PayPalButtons></div>
      <div aria-label={isEs ? "Tarjeta de débito o crédito" : "Debit or credit card"}><PayPalButtons fundingSource="card" disabled={disabled || busy} style={{ shape: "pill", color: "black", layout: "vertical", label: "subscribe", height: 45 }} {...callbacks}><p className="text-xs text-muted-foreground">{isEs ? "PayPal no ofrece el pago con tarjeta para esta suscripción o sesión." : "PayPal does not offer card checkout for this subscription or session."}</p></PayPalButtons></div>
    </>}
    {busy && <p role="status" className="text-xs text-muted-foreground">{isEs ? "Procesando tu suscripción…" : "Processing your subscription…"}</p>}
    <p className="text-xs leading-6 text-muted-foreground">{isEs ? "Selecciona PayPal o tarjeta. PayPal protege los datos del pago; GoLeads verifica la suscripción antes de activar Pro." : "Choose PayPal or card. PayPal protects your payment details; GoLeads verifies the subscription before activating Pro."}</p>
  </div>;
}
