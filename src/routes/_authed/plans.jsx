import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link, useRouter, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getPayPalPlansWorkspaceData, cancelUserPayPalSubscription, confirmPayPalSubscriptionOnServer, recordPayPalCheckoutCancelOrError } from "@/lib/paypal-server-fns";
import { redeemProInvitePassword } from "@/lib/superadmin-fns";
import { recordSubscriptionRecoverySignal } from "@/lib/survey-server-fns";
import PayPalSubscriptionButton from "@/components/billing/PayPalSubscriptionButton";
import { usePreferences } from "@/lib/PreferencesContext";

export const Route = createFileRoute("/_authed/plans")({ ssr: false, validateSearch: (raw) => ({
  paypal: ["approved", "cancelled"].includes(raw.paypal) ? raw.paypal : undefined,
  subscription_id: /^I-[A-Z0-9-]{2,138}$/i.test(String(raw.subscription_id || "")) ? String(raw.subscription_id) : undefined,
  enrollment_id: typeof raw.enrollment_id === "string" && raw.enrollment_id.length <= 140 ? raw.enrollment_id : undefined,
  recover: raw.recover === "1" || raw.recover === 1 ? "1" : undefined,
}), loader: () => getPayPalPlansWorkspaceData(), head: () => ({ meta: [{ title: "Plans — GoLeads" }, { name: "robots", content: "noindex, nofollow" }] }), component: Plans });
function Plans() {
  const { access, quota, offer, subscription, complimentaryGrant } = Route.useLoaderData();
  const { lang } = usePreferences(); const es = lang === "es";
  const router = useRouter();
  const cancel = useServerFn(cancelUserPayPalSubscription); const verify = useServerFn(confirmPayPalSubscriptionOnServer);
  const redeemCode = useServerFn(redeemProInvitePassword);
  const triggerRecovery = useServerFn(recordSubscriptionRecoverySignal);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [inviteCode, setInviteCode] = useState("");
  const [recoveryPrompt, setRecoveryPrompt] = useState(null);
  const lingerSentRef = useRef(false);
  async function handleRedeemCode(e) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setBusy(true); setMessage("");
    try {
      const res = await redeemCode({ data: { password_or_code: inviteCode.trim() } });
      setMessage(res?.message || (res?.ok ? (es ? "Acceso Pro activado." : "Pro access activated.") : (es ? "Código no válido." : "Invalid code.")));
      if (res?.ok) { setInviteCode(""); await router.invalidate(); }
    } catch (err) { setMessage(err?.message || (es ? "No se pudo verificar el código." : "Could not verify code.")); }
    finally { setBusy(false); }
  }
  const receipt = Route.useSearch(); const navigate = useNavigate(); const processed = useRef(""); const mounted = useRef(false);
  const recordCancel = useServerFn(recordPayPalCheckoutCancelOrError);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (access.isPro || lingerSentRef.current) return;
    const timer = setTimeout(() => {
      if (access.isPro || lingerSentRef.current) return;
      lingerSentRef.current = true;
      setRecoveryPrompt("lingered");
      triggerRecovery({ data: { trigger_reason: "lingered_on_plans", ui_language: es ? "es" : "en" } }).catch(() => null);
    }, 60000);
    return () => clearTimeout(timer);
  }, [access.isPro, es]);
  useEffect(() => {
    const key = `${receipt.paypal || ""}:${receipt.subscription_id || ""}:${receipt.enrollment_id || ""}`;
    if (!receipt.paypal || processed.current === key) return;
    processed.current = key;
    const isCurrent = () => mounted.current && processed.current === key;
    async function finishReturn() {
      setBusy(true);
      try {
        if (receipt.paypal === "approved" && receipt.subscription_id) {
          const result = await verify({ data: { subscription_id: receipt.subscription_id, enrollment_id: receipt.enrollment_id } });
          if (isCurrent()) setMessage(result?.ok ? (es ? "Suscripción confirmada con PayPal." : "Subscription confirmed with PayPal.") : (es ? "Tu suscripción todavía no está confirmada. Actualiza su estado dentro de unos momentos." : "Your subscription is not confirmed yet. Refresh its status in a moment."));
        } else if (receipt.paypal === "cancelled") {
          if (receipt.enrollment_id) await recordCancel({ data: { enrollment_id: receipt.enrollment_id, outcome: "cancelled" } });
          triggerRecovery({ data: { trigger_reason: "checkout_cancelled", ui_language: es ? "es" : "en" } }).catch(() => null);
          if (isCurrent()) { setRecoveryPrompt("cancelled"); setMessage(es ? "No completaste la suscripción en PayPal. Puedes volver a intentarlo cuando quieras." : "You did not complete the PayPal subscription. You can try again anytime."); }
        } else if (isCurrent()) setMessage(es ? "Actualiza el estado de tu suscripción para comprobar el pago." : "Refresh your subscription status to check the payment.");
      } catch {
        triggerRecovery({ data: { trigger_reason: "checkout_failed", ui_language: es ? "es" : "en" } }).catch(() => null);
        if (isCurrent()) { setRecoveryPrompt("failed"); setMessage(es ? "No pudimos confirmar el pago. Puedes volver a intentar o actualizar el estado de la suscripción." : "We could not confirm payment. You can retry or refresh subscription status."); }
      }
      finally {
        if (isCurrent()) { setBusy(false); await navigate({ to: "/plans", search: {}, replace: true }); await router.invalidate(); }
      }
    }
    finishReturn();

  }, [receipt.paypal, receipt.subscription_id, receipt.enrollment_id]);
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
    ["MCP (Solo lectura / Read-only)", es ? "Básico (5 leads)" : "Basic (5 leads)", es ? "Completo (50 leads)" : "Full (50 leads)"],
  ];
  return <div className="space-y-7"><header><p className="text-xs font-semibold uppercase tracking-widest text-primary">{es ? "Planes y pagos" : "Plans and payments"}</p><h1 className="mt-2 text-3xl font-semibold">{es ? "Más clientes potenciales. Más tiempo para vender." : "More prospects. More time to sell."}</h1><p className="mt-3 text-sm text-muted-foreground">{es ? "Empieza gratis y conecta tus herramientas cuando necesites más." : "Start free and connect more tools as you grow."}</p></header>
    <section className="grid gap-4 sm:grid-cols-3" aria-label={es ? "Tu plan y consumo" : "Your plan and usage"}>{[[es ? "Tu plan" : "Your plan", access.isOwner ? (es ? "Pro · Propietario" : "Pro · Owner") : access.isPro ? "Pro" : (es ? "Gratis" : "Free")], [es ? "Disponibles hoy · gratis" : "Free searches left today", access.isOwner ? (es ? "Sin límite" : "Unlimited") : quota.baseRemainingToday], [es ? "Adicionales disponibles" : "Extra searches remaining", access.isOwner ? (es ? "Sin límite" : "Unlimited") : quota.subscriptionRemaining]].map(([label,value]) => <div key={label} className="rounded-xl border border-border bg-card p-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>)}</section>
    <div className="overflow-x-auto rounded-xl border border-border bg-card"><table className="w-full min-w-[420px] text-left text-sm"><thead className="bg-secondary/50"><tr><th className="p-4">{es ? "Incluye" : "Included"}</th><th className="p-4">{es ? "Gratis" : "Free"}</th><th className="p-4 text-primary">Pro</th></tr></thead><tbody>{features.map(([label,free,pro]) => <tr key={label} className="border-t border-border"><th scope="row" className="p-4 font-normal">{label}</th><td className="p-4">{free}</td><td className="p-4 font-semibold">{pro}</td></tr>)}</tbody></table></div>
    <p className="text-xs leading-6 text-muted-foreground">{es ? "Cada búsqueda puede devolver menos resultados según las fuentes disponibles. Las fichas de Google Maps se consultan en vivo y no confirman aperturas. El cupo adicional se utiliza después de las búsquedas gratis; no se acumula al siguiente ciclo." : "Searches may return fewer results depending on available sources. Google Maps listings are live and do not confirm openings. Extra searches are used after free searches and do not roll over to the next cycle."}</p>
    {(!access.isPro && (recoveryPrompt || receipt.recover === "1")) && (
      <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {recoveryPrompt === "failed"
              ? es
                ? "¿Algo falló en tu intento de suscripción? Tu cuenta está intacta y puedes reintentar ahora."
                : "Did something go wrong during your subscription attempt? Your account is safe and you can retry now."
              : recoveryPrompt === "cancelled"
              ? es
                ? "Tu suscripción quedó pendiente de confirmación. Puedes retomarla en cualquier momento."
                : "Your subscription was left pending confirmation. You can resume it anytime."
              : es
              ? "¿Tienes dudas o necesitas retomar tu suscripción a GoLeads Pro?"
              : "Have questions or ready to resume your GoLeads Pro subscription?"}
          </p>
          <p className="text-xs text-muted-foreground">
            {es
              ? "También te enviaremos un enlace de recuperación en tu idioma por si prefieres completarlo más tarde."
              : "We will also send a recovery link in your selected language in case you prefer to complete it later."}
          </p>
        </div>
        <a
          href="#pro-checkout-card"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shrink-0"
        >
          {es ? "Ir a activar GoLeads Pro ↓" : "Jump to GoLeads Pro checkout ↓"}
        </a>
      </div>
    )}
    <section id="pro-checkout-card" className="rounded-xl border border-primary/30 bg-card p-6"><h2 className="text-xl font-semibold">GoLeads Pro</h2>
      {offer.price && <p className="mt-3 text-lg font-semibold">{offer.price.amount} {offer.price.currency} / {offer.price.intervalCount || 1} {offer.price.intervalUnit === "MONTH" ? (es ? "mes" : "month") : offer.price.intervalUnit}</p>}
      {access.isOwner ? <div className="mt-4 space-y-3"><p className="font-semibold text-primary">{es ? "Pro de propietario activo" : "Owner Pro is active"}</p><p className="text-sm text-muted-foreground">{es ? "Tienes acceso completo sin contratar una suscripción. Este permiso pertenece solo a tu cuenta y no depende de un pago." : "You have full access without a paid subscription. This permission belongs only to your account and does not depend on a payment."}</p></div> : access.isPro ? <div className="mt-4 space-y-3"><p>{subscription?.cancelled ? (es ? "Renovación cancelada. Conservas Pro hasta el final del periodo pagado." : "Renewal cancelled. You keep Pro until your paid period ends.") : (es ? "Tu plan Pro está activo." : "Your Pro plan is active.")}</p>{subscription?.periodEnd && <p className="text-sm text-muted-foreground">{es ? "Fin del periodo: " : "Period ends: "}{new Date(subscription.periodEnd).toLocaleDateString(es ? "es" : "en")}</p>}{subscription?.id && !subscription.cancelled && <button disabled={busy} onClick={() => manage("cancel")} className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50">{es ? "Cancelar renovación" : "Cancel renewal"}</button>}</div> : null}
      {offer.checkout.testMode && <p role="status" className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">{access.isPro && !access.isOwner ? (es ? "Suscripción de prueba activa. No se realizan cargos reales." : "Test subscription active. No real money is charged.") : (es ? "Pago de prueba: no se cobra dinero real. Prueba con una tarjeta demo desde el botón de tarjeta." : "Test checkout: no real money is charged. Use a demo card through the card button.")}</p>}
      {offer.checkout.ready && (!access.isPro || access.isOwner && offer.checkout.testMode) ? <div className="mt-5 max-w-sm"><PayPalSubscriptionButton clientId={offer.checkout.clientId} planId={offer.checkout.planId} testMode={offer.checkout.testMode} isEs={es} disabled={busy} onPendingChange={setBusy} onErrorMessage={(errMsg) => { setMessage(errMsg); setRecoveryPrompt("failed"); triggerRecovery({ data: { trigger_reason: "checkout_failed", error_detail: String(errMsg || ""), ui_language: es ? "es" : "en" } }).catch(() => null); }} onVerified={async () => { setRecoveryPrompt(null); setMessage(es ? "Suscripción confirmada con PayPal." : "Subscription confirmed with PayPal."); await router.invalidate(); }} onCancelled={() => { setRecoveryPrompt("cancelled"); setMessage(es ? "No completaste la suscripción." : "Subscription not completed."); triggerRecovery({ data: { trigger_reason: "checkout_cancelled", ui_language: es ? "es" : "en" } }).catch(() => null); }} /></div> : !access.isPro ? <p className="mt-3 text-sm text-muted-foreground">{es ? "Las suscripciones no están disponibles en este momento. Puedes seguir usando Gratis." : "Subscriptions are currently unavailable. You can keep using Free."}</p> : null}
      {complimentaryGrant && <p className="mt-3 text-xs text-muted-foreground">{es ? `Acceso Pro de invitación activo (${complimentaryGrant.usedSearches}/${complimentaryGrant.grantedSearches} búsquedas usadas${complimentaryGrant.expiresAt ? ` · vence ${complimentaryGrant.expiresAt.slice(0, 10)}` : ""}).` : `Complimentary Pro invite active (${complimentaryGrant.usedSearches}/${complimentaryGrant.grantedSearches} searches used${complimentaryGrant.expiresAt ? ` · expires ${complimentaryGrant.expiresAt.slice(0, 10)}` : ""}).`}</p>}
      {subscription?.subscriptionId && <button disabled={busy} onClick={() => manage("refresh")} className="mt-4 block text-sm text-primary hover:underline disabled:opacity-50">{es ? "Actualizar estado de mi suscripción" : "Refresh my subscription status"}</button>}
      {!access.isPro && <form onSubmit={handleRedeemCode} className="mt-5 pt-4 border-t border-border flex flex-col sm:flex-row gap-2 max-w-md"><input type="password" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder={es ? "Contraseña o código de invitación Pro (Beta)" : "Pro invite password or code (Beta)"} className="flex-1 h-9 px-3 rounded-lg border border-input bg-background text-xs" /><button type="submit" disabled={busy || !inviteCode.trim()} className="px-3.5 h-9 rounded-lg bg-secondary text-foreground border border-border text-xs font-medium hover:bg-secondary/80 disabled:opacity-50">{es ? "Activar código" : "Redeem code"}</button></form>}
    </section>{message && <p role="status" className="rounded-lg border border-border bg-card p-4 text-sm">{message}</p>}<Link to="/integrations" className="inline-flex text-sm font-medium text-primary hover:underline">{es ? "Ver mis integraciones →" : "View my integrations →"}</Link>
  </div>;
}