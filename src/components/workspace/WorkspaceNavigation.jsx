import { Link, useLocation } from "@tanstack/react-router";
import { usePreferences } from "@/lib/PreferencesContext";
import { workspaceGroups } from "@/lib/workspace-navigation";

export default function WorkspaceNavigation({ onNavigate }) {
  const { t } = usePreferences();
  const { pathname } = useLocation();
  return (
    <nav aria-label={t("nav.mainAria")} className="space-y-6">
      {workspaceGroups.map((group) => (
        <div key={group.key}>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{t(`workspace.${group.key}`)}</p>
          <div className="space-y-1">
            {group.items.map(({ to, key, icon: Icon }) => {
              const active = pathname === to || (to === "/app" && pathname.startsWith("/opportunities/"));
              return (
                <Link key={to} to={to} onClick={onNavigate} aria-current={active ? "page" : undefined}
                  className={`flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{t(`workspace.${key}`)}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}