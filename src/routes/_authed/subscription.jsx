import { createFileRoute, useRouter, useRouterState } from "@tanstack/react-router";
import { getWorkspaceBootstrap } from "@/lib/server-fns";
import { usePreferences } from "@/lib/PreferencesContext";
import PlanComparison from "@/components/plans/PlanComparison";
import SubscriptionStatus from "@/components/plans/SubscriptionStatus";

export const Route = createFileRoute("/_authed/subscription")({
  ssr: false,
  loader: () => getWorkspaceBootstrap(),
  head: () => ({ meta: [{ title: "Planes · Plans — GoLeads" }, { name: "description", content: "Your GoLeads allowance, free plan and Pro configuration status." }] }),
  component: SubscriptionPage,
});
function SubscriptionPage() {
  const data = Route.useLoaderData();
  const { lang } = usePreferences();
  const router = useRouter();
  const es = lang === "es";
  const refreshing = useRouterState({ select: (state) => state.isLoading });
  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{es ? "Planes y suscripción" : "Plans & subscription"}</h1>
          <p className="text-sm text-muted-foreground">{es ? "Tu consumo procede del servidor. Pro sigue en preparación, sin cobros habilitados." : "Your usage comes from the server. Pro is still in preparation, with no charges enabled."}</p>
        </div>
        <button type="button" disabled={refreshing} onClick={() => router.invalidate()} className="min-h-11 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-secondary disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring">{refreshing ? es ? "Actualizando…" : "Refreshing…" : es ? "Actualizar consumo" : "Refresh usage"}</button>
      </header>
      <SubscriptionStatus quota={data?.quota} lang={lang} />
      <PlanComparison lang={lang} />
    </div>
  );
}