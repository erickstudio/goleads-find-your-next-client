import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AuthGateError, requireSignedIn } from "@/components/auth/AuthGate";
import AppShell from "@/components/AppShell";
import { usePreferences } from "@/lib/PreferencesContext";

function PendingWorkspace() {
  const { t } = usePreferences();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm font-mono">
      {t("nav.loadingWorkspace")}
    </div>
  );
}

export const Route = createFileRoute("/_authed")({
  ssr: false,
  beforeLoad: requireSignedIn,
  headers: () => ({
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Cache-Control": "private, no-store, max-age=0",
  }),
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { name: "googlebot", content: "noindex, nofollow, noarchive" },
    ],
  }),
  errorComponent: AuthGateError,
  pendingComponent: PendingWorkspace,
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  return (
    <AppShell user={user}>
      <Outlet />
    </AppShell>
  );
}