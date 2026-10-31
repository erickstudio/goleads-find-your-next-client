import { Link } from "@tanstack/react-router";
import WorkspaceSidebar from "@/components/workspace/WorkspaceSidebar";
import WorkspaceHeader from "@/components/workspace/WorkspaceHeader";
import { usePreferences } from "@/lib/PreferencesContext";

export default function AppShell({ children, user }) {
  const { t } = usePreferences();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#workspace-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:p-3 focus:text-primary-foreground">{t("launch.skip")}</a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border lg:block"><WorkspaceSidebar user={user} /></aside>
      <div className="min-w-0 lg:pl-64">
        <WorkspaceHeader user={user} />
        <main id="workspace-content" className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-8 sm:py-9" tabIndex={-1}>{children}</main>
        <footer className="mx-4 flex flex-wrap justify-between gap-3 border-t border-border py-5 text-[11px] text-muted-foreground sm:mx-8"><span>GoLeads · {t("workspace.beta")}</span><Link to="/privacy">{t("launch.privacy")}</Link></footer>
      </div>
    </div>
  );
}