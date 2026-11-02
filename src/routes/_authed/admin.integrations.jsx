import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  getPaymentAdminDiagnostics,
  prepareSandboxProPlan,
} from "@/lib/payment-admin-fns";
import { usePreferences } from "@/lib/PreferencesContext";

export const Route = createFileRoute("/_authed/admin/integrations")({
  ssr: false,
  loader: async () => {
    try {
      const res = await getPaymentAdminDiagnostics();
      return { ok: true, forbidden: false, ...res };
    } catch (err) {
      const isForbidden =
        err?.status === 403 ||
        err?.code === "ADMIN_REQUIRED" ||
        String(err?.message || "").includes("Forbidden");
      return {
        ok: false,
        forbidden: isForbidden,
        errorMessage:
          err?.message ||
          "No se pudo cargar el diagnóstico administrativo de pagos.",
      };
    }
  },
  head: () => ({
    meta: [
      { title: "Payment Administration — GoLeads" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "googlebot", content: "noindex, nofollow" },
    ],
  }),
  component: AdminIntegrations,
});

function AdminIntegrations() {
  const data = Route.useLoaderData();
  const prepare = useServerFn(prepareSandboxProPlan);
  const [setup, setSetup] = useState(null);
  const [busy, setBusy] = useState(false);
  const { lang } = usePreferences();
  const isEs = lang === "es";

  async function prepareTest() {
    setBusy(true);
    setSetup(null);
    try {
      const res = await prepare();
      setSetup({ ok: true, ...res });
    } catch (err) {
      setSetup({
        ok: false,
        error:
          err?.message ||
          (isEs
            ? "No se pudo preparar el plan de pruebas."
            : "Could not prepare the sandbox test plan."),
      });
    } finally {
      setBusy(false);
    }
  }

  if (data?.forbidden) {
    return (
      <section className="max-w-xl mx-auto rounded-xl border border-border bg-card p-6 space-y-4">
        <span className="inline-flex px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/35">
          {isEs
            ? "Acceso exclusivo para administradores"
            : "Administrators only"}
        </span>
        <h1 className="text-xl font-semibold text-foreground">
          {isEs
            ? "Esta sección requiere permisos de administrador"
            : "This section requires administrator permissions"}
        </h1>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {isEs
            ? "La configuración técnica de PayPal es exclusiva para administradores del espacio de trabajo. Los clientes pueden gestionar su suscripción desde Planes."
            : "Technical PayPal configuration is restricted to workspace administrators. Customers can manage their subscription from Plans."}
        </p>
        <Link
          to="/plans"
          className="inline-flex rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          {isEs ? "Ir a Planes" : "Go to Plans"}
        </Link>
      </section>
    );
  }

  if (!data?.ok) {
    return (
      <section className="max-w-xl mx-auto rounded-xl border border-border bg-card p-6 space-y-4">
        <h1 className="text-xl font-semibold text-foreground">
          {isEs
            ? "Configuración de pagos · Administración"
            : "Payment setup · Administration"}
        </h1>
        <p className="text-xs text-destructive">
          {data?.errorMessage ||
            (isEs
              ? "Ocurrió un problema temporal al consultar el estado de PayPal."
              : "A temporary issue occurred while checking PayPal status.")}
        </p>
      </section>
    );
  }

  const cfg = data.configuration || {};
  const ver = data.verification || {};
  const plan = ver.plan || null;

  return (
    <section className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-primary/15 text-primary border border-primary/30 uppercase">
              {cfg.env === "live" ? "PayPal Live" : "PayPal Sandbox"}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded text-xs font-semibold border ${
                ver.ok
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  : "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35"
              }`}
            >
              {ver.ok
                ? isEs
                  ? "Plan verificado y activo"
                  : "Plan verified & active"
                : isEs
                ? "Revisión requerida"
                : "Review required"}
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">
            {isEs
              ? "Configuración de pagos · Administración"
              : "Payment setup · Administration"}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {isEs
              ? "Acceso exclusivo para administradores. Los clientes solo ven su plan y su uso."
              : "Administrators only. Customers see their plan and usage."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/panel"
            className="rounded-lg border border-border bg-secondary px-3.5 py-2 text-xs font-medium text-foreground hover:bg-secondary/80"
          >
            {isEs ? "← Panel de Superusuario" : "← Superuser Panel"}
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={prepareTest}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy
              ? isEs
                ? "Verificando Sandbox…"
                : "Checking Sandbox…"
              : isEs
              ? "Preparar / Verificar plan de pruebas · 9,99 USD/mes"
              : "Prepare / Verify Sandbox plan · 9.99 USD/mo"}
          </button>
        </div>
      </div>

      {setup && (
        <div
          role="status"
          className={`rounded-xl border p-4 text-xs space-y-1 ${
            setup.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {setup.ok ? (
            <p className="font-semibold">
              {isEs
                ? `Plan de pruebas Sandbox activo (${setup.planId} · ${setup.amount} ${setup.currency} / ${setup.intervalUnit}).`
                : `Sandbox test plan active (${setup.planId} · ${setup.amount} ${setup.currency} / ${setup.intervalUnit}).`}
            </p>
          ) : (
            <p className="font-semibold">{setup.error}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <span className="text-muted-foreground">
            {isEs ? "Entorno activo" : "Active environment"}
          </span>
          <p className="text-sm font-semibold text-foreground uppercase">
            {cfg.env || "sandbox"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {cfg.canAuthenticateWithPayPal
              ? isEs
                ? "Credenciales OAuth2 conectadas"
                : "OAuth2 credentials connected"
              : isEs
              ? "Faltan credenciales"
              : "Credentials missing"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <span className="text-muted-foreground">
            {isEs ? "Estado del Plan PayPal" : "PayPal Plan status"}
          </span>
          <p className="text-sm font-semibold text-foreground">
            {plan
              ? `${plan.amount} ${plan.currency} / ${plan.intervalUnit} (${plan.status})`
              : ver.ok
              ? "ACTIVE"
              : isEs
              ? "No verificado"
              : "Unverified"}
          </p>
          <p className="text-[11px] text-muted-foreground font-mono">
            {cfg.planId || "—"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <span className="text-muted-foreground">
            {isEs ? "Firma de Webhook" : "Webhook signature"}
          </span>
          <p className="text-sm font-semibold text-foreground">
            {cfg.hasWebhookId
              ? isEs
                ? "Configurado"
                : "Configured"
              : isEs
              ? "Pendiente"
              : "Pending"}
          </p>
          <p className="text-[11px] text-muted-foreground break-all">
            {data.webhookUrl}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <span className="text-muted-foreground">
            {isEs ? "Búsquedas por ciclo Pro" : "Searches per Pro cycle"}
          </span>
          <p className="text-sm font-semibold text-foreground">
            {cfg.effectiveCycleAllowance ?? 500}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {cfg.hasConfiguredAllowance
              ? isEs
                ? "Límite comercial activo"
                : "Commercial allowance active"
              : isEs
              ? "Valor de prueba por defecto"
              : "Default sandbox allowance"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 text-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm text-foreground">
            {isEs
              ? "Verificación en vivo con PayPal"
              : "Live PayPal verification"}
          </span>
          <span className="text-muted-foreground">
            {data.administrator?.email}
          </span>
        </div>
        <p className="text-muted-foreground">
          {ver.ok
            ? isEs
              ? `Plan verificado correctamente en PayPal (${cfg.env}).`
              : `Plan verified with PayPal (${cfg.env}).`
            : ver.message}
        </p>
        <details className="pt-2 border-t border-border">
          <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
            {isEs
              ? "Ver diagnóstico técnico detallado (JSON)"
              : "View detailed technical diagnostics (JSON)"}
          </summary>
          <pre className="mt-3 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-secondary/40 p-3 text-[11px] leading-5">
            {JSON.stringify(
              {
                configuration: cfg,
                administrator: data.administrator,
                pendingSetting: data.pendingSetting,
              },
              null,
              2
            )}
          </pre>
        </details>
      </div>
    </section>
  );
}