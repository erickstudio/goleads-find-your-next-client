import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getPayPalPlansWorkspaceData, cancelUserPayPalSubscription, confirmPayPalSubscriptionOnServer } from "@/lib/paypal-server-fns";
import PayPalSubscriptionButton from "@/components/billing/PayPalSubscriptionButton";
import { usePreferences } from "@/lib/PreferencesContext";

export const Route = createFileRoute("/_authed/plans")({ ssr: false, loader: () => getPayPalPlansWorkspaceData(), head: () => ({ meta: [{ title: "Plans — GoLeads" }, { name: "robots", content: "noindex, nofollow" }] }), component: Plans });
function Plans() {
  const { access, quota, offer, subscription } = Route.useLoaderData();
  const { lang } = usePreferences(); const es = lang === "es";
  const router = useRouter();
  const cancel = useServerFn(cancelUserPayPalSubscription); const verify = useServerFn(confirmPayPalSubscriptionOnServer);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function manage(action) {
    setBusy(true); setMessage("");
    try {
      const result = action === "cancel" ? await cancel({ data: { id: subscription.id } }) : await verify({ data: { subscription_id: subscription.subscriptionId, enrollment_id: subscription.id } });
      setMessage(result.ok ? (es ? "Tu suscripción se actualizó." : "Your subscription was updated.") : (es ? "No pudimos actualizar tu suscripción. Inténtalo más tarde." : "We could not update your subscription. Try again later."));
      await router.invalidate();
    } catch { setMessage(es ? "No pudimos completar el cambio. Inténtalo más tarde." : "We could not complete this change. Try again later."); }
    finally { setBusy(false); }
  }
  const features = [
    [es ? "Búsquedas diarias" : "Daily searches", "3", "3"],
    [es ? "Búsquedas adicionales por ciclo" : "Extra searches per billing cycle", "—", "500"],
    [es ? "Resultados por búsqueda, hasta" : "Results per search, up to", "5", "20"],
    [es ? "IA + negocios locales de Google Maps" : "AI + local businesses from Google Maps", "✓", "✓"],
    [es ? "Guardar leads y redactar mensajes" : "Save leads and draft messages", "✓", "✓"],
    ["Google Sheets", "✓", "✓"],
    ["CSV", "—", "✓"],
    ["Workspace · Google Docs + Drive", "—", "✓"],
    [es ? "MCP para tus asistentes de IA" : "MCP for your AI assistants", "—", "✓"],
  ];
  return <div className="space-y-7"><header><p className="text-xs font-semibold uppercase tracking-widest text-primary">{es ? "Planes y pagos" : "Plans and payments"}</p><h1 className="mt-2 text-3xl font-semibold">{es ? "Más clientes potenciales. Más tiempo para vender." : "More prospects. More time to sell."}</h1><p className="mt-3 text-sm text-muted-foreground">{es ? "Empieza gratis y conecta tus herramientas cuando necesites más." : "Start free and connect more tools as you grow."}</p></header>
    <section className="grid gap-4 sm:grid-cols-3" aria-label={es ? "Tu plan y consumo" : "Your plan and usage"}>{[[es ? "Tu plan" : "Your plan", access.isOwner ? (es ? "Pro · Propietario" : "Pro · Owner") : access.isPro ? "Pro" : (es ? "Gratis" : "Free")], [es ? "Disponibles hoy · gratis" : "Free searches left today", access.isOwner ? (es ? "Sin límite" : "Unlimited") : quota.baseRemainingToday], [es ? "Adicionales disponibles" : "Extra searches remaining", access.isOwner ? (es ? "Sin límite" : "Unlimited") : quota.subscriptionRemaining]].map(([label,value]) => <div key={label} className="rounded-xl border border-border bg-card p-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>)}</section>
    <div className="overflow-x-auto rounded-xl border border-border bg-card"><table className="w-full min-w-[420px] text-left text-sm"><thead className="bg-secondary/50"><tr><th className="p-4">{es ? "Incluye" : "Included"}</th><th className="p-4">{es ? "Gratis" : "Free"}</th><th className="p-4 text-primary">Pro</th></tr></thead><tbody>{features.map(([label,free,pro]) => <tr key={label} className="border-t border-border"><th scope="row" className="p-4 font-normal">{label}</th><td className="p-4">{free}</td><td className="p-4 font-semibold">{pro}</td></tr>)}</tbody></table></div>
    <p className="text-xs leading-6 text-muted-foreground">{es ? "Cada búsqueda puede devolver menos resultados según las fuentes disponibles. Las fichas de Google Maps se consultan en vivo y no confirman aperturas. El cupo adicional se utiliza después de las búsquedas gratis; no se acumula al siguiente ciclo." : "Searches may return fewer results depending on available sources. Google Maps listings are live and do not confirm openings. Extra searches are used after free searches and do not roll over to the next cycle."}</p>
    <section className="rounded-xl border border-primary/30 bg-card p-6"><h2 className="text-xl font-semibold">GoLeads Pro</h2>
      {offer.price && <p className="mt-3 text-lg font-semibold">{offer.price.amount} {offer.price.currency} / {offer.price.intervalCount || 1} {offer.price.intervalUnit === "MONTH" ? (es ? "mes(es)" : "month(s)") : offer.price.intervalUnit}</p>}
      {access.isOwner ? <div className="mt-4 space-y-3"><p className="font-semibold text-primary">{es ? "Pro de propietario activo" : "Owner Pro is active"}</p><p className="text-sm text-muted-foreground">{es ? "Tienes acceso completo sin contratar una suscripción. Este permiso pertenece solo a tu cuenta y no depende de un pago." : "You have full access without a paid subscription. This permission belongs only to your account and does not depend on a payment."}</p></div> : access.isPro ? <div className="mt-4 space-y-3"><p>{subscription?.cancelled ? (es ? "Renovación cancelada. Conservas Pro hasta el final del periodo pagado." : "Renewal cancelled. You keep Pro until your paid period ends.") : (es ? "Tu plan Pro está activo." : "Your Pro plan is active.")}</p>{subscription?.periodEnd && <p className="text-sm text-muted-foreground">{es ? "Fin del periodo: " : "Period ends: "}{new Date(subscription.periodEnd).toLocaleDateString(es ? "es" : "en")}</p>}{subscription?.id && !subscription.cancelled && <button disabled={busy} onClick={() => manage("cancel")} className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50">{es ? "Cancelar renovación" : "Cancel renewal"}</button>}</div> : null}
      {offer.checkout.testMode && <p role="status" className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">{es ? "Pago de prueba: no se cobra dinero real. Usa una cuenta de comprador de pruebas de PayPal." : "Test checkout: no real money is charged. Use a PayPal test buyer account."}</p>}
      {offer.checkout.ready && (!access.isPro || access.isOwner && offer.checkout.testMode) ? <div className="mt-5 max-w-sm"><PayPalSubscriptionButton clientId={offer.checkout.clientId} planId={offer.checkout.planId} isEs={es} onPendingChange={setBusy} onVerified={async () => {setMessage(es ? "Suscripción confirmada. Ya puedes usar Pro." : "Subscription confirmed. You can now use Pro."); await router.invalidate();}} onCancelled={() => setMessage(es ? "No completaste la suscripción." : "Subscription not completed.")} onErrorMessage={() => setMessage(es ? "No se pudo completar la suscripción. Inténtalo más tarde." : "Unable to complete the subscription. Please try later.")} /></div> : !access.isPro ? <p className="mt-3 text-sm text-muted-foreground">{es ? "Las suscripciones no están disponibles en este momento. Puedes seguir usando Gratis." : "Subscriptions are currently unavailable. You can keep using Free."}</p> : null}
      {subscription?.subscriptionId && <button disabled={busy} onClick={() => manage("refresh")} className="mt-4 block text-sm text-primary hover:underline disabled:opacity-50">{es ? "Actualizar estado de mi suscripción" : "Refresh my subscription status"}</button>}
    </section>{message && <p role="status" className="rounded-lg border border-border bg-card p-4 text-sm">{message}</p>}<Link to="/integrations" className="inline-flex text-sm font-medium text-primary hover:underline">{es ? "Ver mis integraciones →" : "View my integrations →"}</Link>
  </div>;
}