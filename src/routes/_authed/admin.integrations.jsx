import { createFileRoute } from "@tanstack/react-router";
import { getPaymentAdminDiagnostics } from "@/lib/payment-admin-fns";
import { usePreferences } from "@/lib/PreferencesContext";

export const Route = createFileRoute("/_authed/admin/integrations")({ ssr: false, loader: () => getPaymentAdminDiagnostics(), component: AdminIntegrations });
function AdminIntegrations() {
  const data = Route.useLoaderData();
  const { lang } = usePreferences();
  return <section className="space-y-5"><h1 className="text-2xl font-semibold">{lang === "es" ? "Configuración de pagos · Administración" : "Payment setup · Administration"}</h1><p className="text-sm text-muted-foreground">{lang === "es" ? "Acceso exclusivo para administradores. Los clientes solo ven su plan y su uso." : "Administrators only. Customers see their plan and usage."}</p><div className="rounded-xl border border-border bg-card p-5 text-sm"><p className="font-semibold">PayPal</p><p className="mt-3 break-all">Webhook: {data.webhookUrl}</p><pre className="mt-4 overflow-auto whitespace-pre-wrap break-all text-xs leading-6">{JSON.stringify(data.configuration, null, 2)}</pre><p className="mt-4">{data.verification?.ok ? "Plan verificado / Plan verified" : data.verification?.message}</p></div></section>;
}

