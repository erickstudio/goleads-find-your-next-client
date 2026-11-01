import { useState, useEffect } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  RefreshCw,
  ShieldAlert,
  ExternalLink,
  Webhook,
} from "lucide-react";
import {
  getPayPalPlansWorkspaceData,
  confirmPayPalSubscriptionOnServer,
  cancelUserPayPalSubscription,
} from "@/lib/paypal-server-fns";
import PayPalSubscriptionButton from "@/components/billing/PayPalSubscriptionButton";
import { usePreferences } from "@/lib/PreferencesContext";

export const Route = createFileRoute("/_authed/plans")({
  ssr: false,
  loader: () => getPayPalPlansWorkspaceData(),
  head: () => ({
    meta: [
      { title: "Planes y suscripción — goleads.app" },
      {
        name: "description",
        content:
          "Gestiona tu suscripción de PayPal, revisa tu cupo de búsquedas disponible y consulta fechas confirmadas.",
      },
    ],
  }),
  component: PlansAndSubscriptionScreen,
});

function formatIsoDate(iso, isEs = true) {
  if (!iso) return isEs ? "No registrada" : "Not recorded";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function getStatusBadgeMeta(status, isEs = true) {
  switch (status) {
    case "active":
      return {
        label: isEs ? "Activa (Verificada en servidor)" : "Active (Server verified)",
        tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35",
      };
    case "trialing":
      return {
        label: isEs ? "En prueba activa (Verificada)" : "Trial active (Verified)",
        tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35",
      };
    case "cancelled":
      return {
        label: isEs ? "Cancelada (Sin cobros futuros)" : "Cancelled (No future charges)",
        tone: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35",
      };
    case "approval_pending_verification":
    case "pending_approval":
      return {
        label: isEs ? "Aprobación pendiente" : "Pending approval",
        tone: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35",
      };
    case "suspended":
      return {
        label: isEs ? "Suspendida" : "Suspended",
        tone: "bg-destructive/15 text-destructive border-destructive/35",
      };
    case "payment_failed":
      return {
        label: isEs ? "Pago fallido" : "Payment failed",
        tone: "bg-destructive/15 text-destructive border-destructive/35",
      };
    case "expired":
      return {
        label: isEs ? "Expirada" : "Expired",
        tone: "bg-secondary text-muted-foreground border-border",
      };
    default:
      return {
        label: status || (isEs ? "Sin suscripción" : "No subscription"),
        tone: "bg-secondary text-muted-foreground border-border",
      };
  }
}

function PlansAndSubscriptionScreen() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const { lang, syncFromProfile } = usePreferences();
  const isEs = lang === "es";

  const confirmSubFn = useServerFn(confirmPayPalSubscriptionOnServer);
  const cancelSubFn = useServerFn(cancelUserPayPalSubscription);

  const paypalConfig = data?.paypalConfig || {};
  const planVerification = data?.planVerification || {};
  const remotePlan = planVerification?.plan || null;
  const activeSub = data?.activeSubscription || null;
  const mySubscriptions = data?.mySubscriptions || [];
  const quota = data?.quota || {};
  const webhookUrl = data?.webhookEndpointUrl || "";

  const [isBusy, setIsBusy] = useState(false);
  const [banner, setBanner] = useState(null); // { tone: "success" | "warning" | "error", text: string }

  useEffect(() => {
    if (data?.profile) {
      syncFromProfile(data.profile);
    }
  }, [data?.profile?.id]);

  useEffect(() => {
    document.title = isEs
      ? "Planes y suscripción — goleads.app"
      : "Plans & Subscription — goleads.app";
  }, [isEs]);

  const hasActiveOrTrialSub =
    activeSub && ["active", "trialing"].includes(activeSub.status);

  const isCancelledButInPaidPeriod =
    activeSub?.status === "cancelled" &&
    activeSub?.current_period_end_iso &&
    new Date(activeSub.current_period_end_iso).getTime() > Date.now();

  const handleRefreshSubscriptionStatus = async (sub) => {
    if (!sub?.paypal_subscription_id) return;
    setIsBusy(true);
    setBanner(null);
    try {
      const res = await confirmSubFn({
        data: {
          subscription_id: sub.paypal_subscription_id,
          enrollment_id: sub.id,
        },
      });
      await router.invalidate();
      setBanner({
        tone: res?.verified ? "success" : "warning",
        text:
          res?.message ||
          (isEs
            ? "Estado de suscripción sincronizado con PayPal."
            : "Subscription status synced with PayPal."),
      });
    } catch (err) {
      setBanner({
        tone: "error",
        text:
          err?.message ||
          (isEs
            ? "No se pudo sincronizar la suscripción con PayPal."
            : "Could not sync subscription with PayPal."),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleCancelSubscription = async (sub) => {
    if (!sub?.id) return;
    setIsBusy(true);
    setBanner(null);
    try {
      const res = await cancelSubFn({
        data: {
          id: sub.id,
          reason: isEs
            ? "Cancelada por el usuario desde Planes y suscripción en GoLeads"
            : "Cancelled by user from GoLeads Plans & Subscription",
        },
      });
      await router.invalidate();
      setBanner({
        tone: "warning",
        text:
          res?.message ||
          (isEs
            ? "Suscripción cancelada. Conservas el acceso hasta el final del periodo ya pagado."
            : "Subscription cancelled. Your access remains active until the end of the already-paid period."),
      });
    } catch (err) {
      setBanner({
        tone: "error",
        text:
          err?.message ||
          (isEs
            ? "No se pudo cancelar la suscripción."
            : "Could not cancel the subscription."),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const payPalManageUrl =
    paypalConfig.env === "live"
      ? "https://www.paypal.com/myaccount/autopay/"
      : "https://www.sandbox.paypal.com/myaccount/autopay/";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-primary/15 text-primary border border-primary/30">
              <CreditCard className="h-3.5 w-3.5" />
              PayPal Subscriptions ({paypalConfig.env === "live" ? "Live" : "Sandbox"})
            </span>
            {paypalConfig.commercialLimitsStatus === "pending_owner_config" && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/35">
                {isEs
                  ? "Límites comerciales definitivos pendientes de configurar"
                  : "Final commercial limits pending configuration"}
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {isEs ? "Planes y suscripción" : "Plans & Subscription"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEs
              ? "Consulta el estado de tu suscripción, tu consumo disponible, las fechas confirmadas por PayPal y gestiona tu plan."
              : "View your subscription status, available search allowance, PayPal-confirmed dates, and manage your plan."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/dashboard"
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-secondary text-foreground border border-border hover:bg-secondary/80"
          >
            {isEs ? "Panel de uso" : "Usage Dashboard"}
          </Link>
          <Link
            to="/app"
            className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isEs ? "Buscar leads" : "Find leads"}
          </Link>
        </div>
      </div>

      {/* Feedback Banner */}
      {banner && (
        <div
          role={banner.tone === "error" ? "alert" : "status"}
          className={`px-4 py-3 rounded-lg border text-xs flex items-center justify-between gap-3 ${
            banner.tone === "success"
              ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-800 dark:text-emerald-200"
              : banner.tone === "error"
              ? "bg-destructive/15 border-destructive/35 text-destructive"
              : "bg-amber-500/15 border-amber-500/35 text-amber-900 dark:text-amber-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.tone === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : banner.tone === "error" ? (
              <XCircle className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{banner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="underline font-medium shrink-0"
          >
            {isEs ? "Cerrar" : "Dismiss"}
          </button>
        </div>
      )}

      {/* Quota & Available Consumption Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-5 space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">
            {isEs ? "Cupo base diario gratuito" : "Daily free search allowance"}
          </div>
          <div className="text-2xl font-bold font-mono text-primary">
            {quota.baseRemainingToday ?? 3} / {quota.maxDaily ?? 3}
          </div>
          <p className="text-xs text-muted-foreground">
            {isEs
              ? `Usadas en las últimas 24 h: ${quota.usedToday ?? 0}. Las búsquedas repetidas en 24 h usan caché privada sin consumir cupo.`
              : `Used in last 24h: ${quota.usedToday ?? 0}. Identical queries within 24h use private cache without consuming quota.`}
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">
            {isEs
              ? "Búsquedas adicionales por suscripción / piloto"
              : "Subscription / pilot bonus searches"}
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {quota.subscriptionRemaining ?? 0}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              / {quota.subscriptionGrantedTotal ?? 0}{" "}
              {isEs ? "(Suscripción)" : "(Subscription)"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {isEs
              ? `Consumidas en el periodo actual: ${quota.subscriptionUsedTotal ?? 0}. Piloto único adicional: ${quota.stripePilotRemaining ?? 0}.`
              : `Consumed in current period: ${quota.subscriptionUsedTotal ?? 0}. One-time pilot remaining: ${quota.stripePilotRemaining ?? 0}.`}
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">
            {isEs ? "Capacidad total disponible hoy" : "Total searches available today"}
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {quota.remainingToday ?? 3}
          </div>
          <p className="text-xs text-muted-foreground">
            {isEs
              ? `Hasta ${quota.maxResultsPerSearch ?? 5} oportunidades verificadas por búsqueda.`
              : `Up to ${quota.maxResultsPerSearch ?? 5} verified opportunities per search.`}
          </p>
        </div>
      </section>

      {/* Main Grid: Active User Subscription Status + PayPal Plan Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Current User Subscription State & Confirmed Dates */}
        <section className="lg:col-span-7 bg-card text-card-foreground rounded-xl border border-border p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {isEs ? "Tu estado de suscripción actual" : "Your current subscription status"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isEs
                  ? "Solo se otorgan permisos cuando el servidor verifica la suscripción directamente en PayPal."
                  : "Permissions are only granted when the server verifies the subscription directly on PayPal."}
              </p>
            </div>
            {activeSub && (
              <span
                className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                  getStatusBadgeMeta(activeSub.status, isEs).tone
                }`}
              >
                {getStatusBadgeMeta(activeSub.status, isEs).label}
              </span>
            )}
          </div>

          {!activeSub ? (
            <div className="rounded-lg border border-border bg-secondary/40 p-4 text-xs text-muted-foreground space-y-1.5">
              <p className="font-medium text-foreground">
                {isEs
                  ? "Aún no tienes una suscripción vinculada a tu cuenta."
                  : "You do not have a subscription linked to your account yet."}
              </p>
              <p>
                {isEs
                  ? "Tu cuenta incluye 3 búsquedas diarias gratuitas. Puedes suscribirte con el botón de PayPal para ampliar tu cupo por ciclo de facturación."
                  : "Your account includes 3 daily free searches. You can subscribe with the PayPal button to expand your search allowance per billing cycle."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {isCancelledButInPaidPeriod && (
                <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                  <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">
                      {isEs
                        ? "Suscripción cancelada — Periodo pagado vigente"
                        : "Subscription cancelled — Paid period still active"}
                    </div>
                    <p className="mt-0.5">
                      {isEs
                        ? `No se realizarán cobros futuros, pero conservas tus búsquedas restantes hasta el ${formatIsoDate(
                            activeSub.current_period_end_iso,
                            isEs
                          )}.`
                        : `No future charges will occur, and you keep your remaining search allowance until ${formatIsoDate(
                            activeSub.current_period_end_iso,
                            isEs
                          )}.`}
                    </p>
                  </div>
                </div>
              )}

              {activeSub.status === "payment_failed" && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">
                      {isEs
                        ? "Pago fallido reportado por PayPal"
                        : "Failed payment reported by PayPal"}
                    </div>
                    <p className="mt-0.5">{activeSub.status_note}</p>
                  </div>
                </div>
              )}

              {(activeSub.status === "pending_approval" ||
                activeSub.status === "approval_pending_verification") && (
                <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                  <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">
                      {isEs
                        ? "Aprobación o confirmación de pago pendiente"
                        : "Approval or payment confirmation pending"}
                    </div>
                    <p className="mt-0.5">{activeSub.status_note}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <div className="text-muted-foreground">
                    {isEs ? "Plan y entorno" : "Plan & environment"}
                  </div>
                  <div className="font-semibold text-foreground mt-0.5">
                    {activeSub.plan_name || activeSub.paypal_plan_id} (
                    {activeSub.paypal_environment})
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
                    Plan ID: {activeSub.paypal_plan_id}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <div className="text-muted-foreground">
                    {isEs ? "ID de suscripción PayPal" : "PayPal Subscription ID"}
                  </div>
                  <div className="font-mono font-semibold text-foreground mt-0.5">
                    {activeSub.paypal_subscription_id || (isEs ? "Pendiente" : "Pending")}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground mt-0.5 truncate">
                    Ref: {activeSub.enrollment_reference}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <div className="text-muted-foreground">
                    {isEs ? "Inicio del periodo confirmado" : "Confirmed period start"}
                  </div>
                  <div className="font-mono font-medium text-foreground mt-0.5">
                    {formatIsoDate(activeSub.current_period_start_iso, isEs)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <div className="text-muted-foreground">
                    {activeSub.cancel_at_period_end
                      ? isEs
                        ? "Acceso vigente hasta"
                        : "Access valid until"
                      : isEs
                      ? "Fin de periodo / Próxima renovación"
                      : "Period end / Next renewal"}
                  </div>
                  <div className="font-mono font-medium text-foreground mt-0.5">
                    {formatIsoDate(activeSub.current_period_end_iso, isEs)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <div className="text-muted-foreground">
                    {isEs ? "Último pago confirmado" : "Last confirmed payment"}
                  </div>
                  <div className="font-mono font-medium text-foreground mt-0.5">
                    {activeSub.last_payment_at_iso
                      ? `${formatIsoDate(activeSub.last_payment_at_iso, isEs)}${
                          activeSub.last_payment_amount
                            ? ` (${activeSub.last_payment_amount} ${
                                activeSub.billing_currency || "USD"
                              })`
                            : ""
                        }`
                      : isEs
                      ? "Sin cobro registrado aún"
                      : "No payment recorded yet"}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <div className="text-muted-foreground">
                    {isEs ? "Consumo del ciclo actual" : "Current cycle usage"}
                  </div>
                  <div className="font-mono font-semibold text-foreground mt-0.5">
                    {activeSub.used_subscription_searches ?? 0} /{" "}
                    {activeSub.granted_search_allowance ?? 0}{" "}
                    {isEs ? "búsquedas usadas" : "searches used"}
                  </div>
                </div>
              </div>

              {activeSub.status_note && (
                <p className="text-xs text-muted-foreground bg-secondary/30 border border-border rounded-lg p-3">
                  {activeSub.status_note}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-border">
                {activeSub.paypal_subscription_id && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleRefreshSubscriptionStatus(activeSub)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-secondary text-foreground border border-border hover:bg-secondary/80 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${isBusy ? "animate-spin" : ""}`}
                    />
                    {isEs
                      ? "Verificar estado en PayPal"
                      : "Verify status with PayPal"}
                  </button>
                )}

                {hasActiveOrTrialSub && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleCancelSubscription(activeSub)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-destructive/15 text-destructive border border-destructive/35 hover:bg-destructive/25 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    {isEs ? "Cancelar suscripción" : "Cancel subscription"}
                  </button>
                )}

                <a
                  href={payPalManageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-card text-primary border border-primary/30 hover:bg-primary/10"
                >
                  <span>
                    {isEs ? "Gestionar en PayPal" : "Manage on PayPal"}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Plan Details from PayPal + Official PayPal Subscribe Button */}
        <section className="lg:col-span-5 bg-card text-card-foreground rounded-xl border border-primary/30 p-5 sm:p-6 space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                {isEs ? "Suscripción con PayPal" : "PayPal Subscription"}
              </span>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                {paypalConfig.planId}
              </span>
            </div>
            <h2 className="text-lg font-bold text-foreground">
              {remotePlan?.name ||
                (isEs ? "Plan de Prospección GoLeads" : "GoLeads Prospecting Plan")}
            </h2>
          </div>

          {/* Authoritative Plan Metadata from PayPal API (Never deduced from client button code) */}
          {planVerification.ok && remotePlan ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs space-y-1.5">
              <div className="flex items-center justify-between font-semibold text-emerald-800 dark:text-emerald-200">
                <span>
                  {isEs
                    ? "Plan verificado en PayPal API"
                    : "Plan verified via PayPal API"}
                </span>
                <span>{remotePlan.status}</span>
              </div>
              <div className="text-sm font-bold text-foreground">
                {remotePlan.amount
                  ? `${remotePlan.amount} ${remotePlan.currency || "USD"} / ${
                      remotePlan.intervalCount > 1
                        ? `${remotePlan.intervalCount} `
                        : ""
                    }${remotePlan.intervalUnit || "MONTH"}`
                  : isEs
                  ? "Precio definido en el plan de PayPal"
                  : "Pricing defined on PayPal plan"}
              </div>
              {remotePlan.description && (
                <p className="text-muted-foreground">{remotePlan.description}</p>
              )}
              <div className="text-[11px] text-muted-foreground pt-1">
                {isEs
                  ? `Cupo asignado por ciclo verificado: ${paypalConfig.effectiveCycleAllowance} búsquedas en vivo (${
                      paypalConfig.commercialLimitsStatus === "configured"
                        ? "configurado"
                        : "valor Sandbox temporal mientras defines PAYPAL_PLAN_SEARCH_ALLOWANCE"
                    }).`
                  : `Search allowance per verified cycle: ${paypalConfig.effectiveCycleAllowance} live searches.`}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs space-y-2 text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>
                  {isEs
                    ? "Verificación de servidor pendiente de credenciales"
                    : "Server verification awaiting credentials"}
                </span>
              </div>
              <p className="leading-relaxed">{planVerification.message}</p>
              <p className="text-[11px] opacity-90">
                {isEs
                  ? "No se deduce precio, moneda ni frecuencia del código del botón: el servidor los consulta directamente en PayPal una vez configures PAYPAL_CLIENT_SECRET."
                  : "Price, currency, and billing interval are never deduced from button code: the server queries them directly from PayPal once PAYPAL_CLIENT_SECRET is set."}
              </p>
            </div>
          )}

          {/* PayPal Subscription Button */}
          {hasActiveOrTrialSub ? (
            <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 p-4 text-xs text-emerald-800 dark:text-emerald-200 space-y-1">
              <div className="font-semibold">
                {isEs
                  ? "Tu suscripción ya está activa"
                  : "Your subscription is already active"}
              </div>
              <p>
                {isEs
                  ? "El botón de contratación se oculta mientras tengas una suscripción activa para evitar cobros o suscripciones duplicadas."
                  : "The subscribe button is hidden while you have an active subscription to prevent duplicate charges."}
              </p>
            </div>
          ) : (
            <PayPalSubscriptionButton
              clientId={paypalConfig.clientId}
              planId={paypalConfig.planId}
              disabled={!paypalConfig.canAuthenticateWithPayPal || isBusy}
              isEs={isEs}
              onPendingChange={setIsBusy}
              onVerified={async (res) => {
                await router.invalidate();
                setBanner({
                  tone: res?.verified ? "success" : "warning",
                  text:
                    res?.message ||
                    (isEs
                      ? "Suscripción verificada en el servidor."
                      : "Subscription verified on the server."),
                });
              }}
              onCancelled={async (msg) => {
                await router.invalidate();
                setBanner({
                  tone: "warning",
                  text: msg,
                });
              }}
              onErrorMessage={(msg) => {
                if (!msg) return;
                setBanner({
                  tone: "error",
                  text: msg,
                });
              }}
            />
          )}
        </section>
      </div>

      {/* Configuration & Webhook Status Panel */}
      <section className="bg-card text-card-foreground rounded-xl border border-border p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Webhook className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              {isEs
                ? "Estado de configuración del servidor y Webhook de PayPal"
                : "Server configuration & PayPal Webhook status"}
            </h2>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {webhookUrl}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <div className="text-muted-foreground">PAYPAL_ENV</div>
            <div className="font-mono font-semibold text-foreground mt-0.5">
              {paypalConfig.env}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <div className="text-muted-foreground">PAYPAL_CLIENT_ID</div>
            <div className="font-mono font-semibold text-foreground mt-0.5 truncate" title={paypalConfig.clientId}>
              {paypalConfig.clientId?.slice(0, 16)}…
            </div>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <div className="text-muted-foreground">PAYPAL_CLIENT_SECRET</div>
            <div
              className={`font-semibold mt-0.5 ${
                paypalConfig.hasClientSecret
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-700 dark:text-amber-300"
              }`}
            >
              {paypalConfig.hasClientSecret
                ? isEs
                  ? "Configurado (en servidor)"
                  : "Configured (server-only)"
                : isEs
                ? "Pendiente en Secretos"
                : "Pending in Secrets"}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <div className="text-muted-foreground">PAYPAL_WEBHOOK_ID</div>
            <div
              className={`font-semibold mt-0.5 ${
                paypalConfig.hasWebhookId
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-700 dark:text-amber-300"
              }`}
            >
              {paypalConfig.hasWebhookId
                ? isEs
                  ? "Configurado"
                  : "Configured"
                : isEs
                ? "Pendiente en Secretos"
                : "Pending in Secrets"}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <div className="text-muted-foreground">PAYPAL_PLAN_SEARCH_ALLOWANCE</div>
            <div
              className={`font-semibold mt-0.5 ${
                paypalConfig.hasConfiguredAllowance
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-700 dark:text-amber-300"
              }`}
            >
              {paypalConfig.hasConfiguredAllowance
                ? `${paypalConfig.configuredAllowance} / ciclo`
                : isEs
                ? `Pendiente (Sandbox: ${paypalConfig.effectiveCycleAllowance})`
                : `Pending (Sandbox: ${paypalConfig.effectiveCycleAllowance})`}
            </div>
          </div>
        </div>

        {(paypalConfig.missingSecrets || []).length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <h3 className="text-xs font-semibold text-foreground">
              {isEs
                ? "Variables en Secretos para completar la puesta en marcha:"
                : "Secrets variables to complete setup:"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
              {paypalConfig.missingSecrets.map((sec) => (
                <div
                  key={sec.name}
                  className="p-3 rounded-lg bg-secondary/40 border border-border space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-foreground">
                      {sec.name}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        sec.required
                          ? "bg-amber-500/20 text-amber-800 dark:text-amber-300"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {sec.required
                        ? isEs
                          ? "Obligatorio"
                          : "Required"
                        : isEs
                        ? "Opcional / Predeterminado"
                        : "Optional / Defaulted"}
                    </span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {sec.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User Subscription Records History */}
        {mySubscriptions.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-border">
            <h3 className="text-xs font-semibold text-foreground">
              {isEs
                ? `Historial de registros de suscripción en tu cuenta (${mySubscriptions.length})`
                : `Subscription records in your account (${mySubscriptions.length})`}
            </h3>
            <div className="space-y-2">
              {mySubscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="p-3 rounded-lg bg-secondary/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {getStatusBadgeMeta(sub.status, isEs).label}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        PayPal ID: {sub.paypal_subscription_id || "—"}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        custom_id: {sub.enrollment_reference}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{sub.status_note}</p>
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground shrink-0">
                    {sub.used_subscription_searches ?? 0}/
                    {sub.granted_search_allowance ?? 0}{" "}
                    {isEs ? "búsquedas" : "searches"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}