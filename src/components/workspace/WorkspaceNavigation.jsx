import { useAuth } from "@/lib/AuthContext";
import { Link, useLocation } from "@tanstack/react-router";
import { ShieldAlert, CreditCard } from "lucide-react";
import { usePreferences } from "@/lib/PreferencesContext";
import { workspaceGroups } from "@/lib/workspace-navigation";

export default function WorkspaceNavigation({ onNavigate }) {
  const { t, lang } = usePreferences();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isEs = lang === "es";

  return (
    <nav aria-label={t("nav.mainAria")} className="space-y-6">
      {workspaceGroups.map((group) => (
        <div key={group.key}>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t(`workspace.${group.key}`)}
          </p>
          <div className="space-y-1">
            {group.items.map(({ to, key, icon: Icon, badge }) => {
              const active =
                pathname === to ||
                (to === "/app" && pathname.startsWith("/opportunities/"));
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-10 items-center justify-between gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active
                      ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{t(`workspace.${key}`)}</span>
                  </span>
                  {badge && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        active
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-primary/15 text-primary"
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}

            {group.key === "account" && user?.role === "admin" && (
              <div className="pt-2 mt-2 border-t border-border/70 space-y-1">
                <Link
                  to="/admin/panel"
                  onClick={onNavigate}
                  className={`flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                    pathname === "/admin/panel"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-primary hover:bg-secondary"
                  }`}
                >
                  <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {isEs ? "Panel de Superusuario" : "Superuser Panel"}
                  </span>
                </Link>
                <Link
                  to="/admin/integrations"
                  onClick={onNavigate}
                  className={`flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                    pathname === "/admin/integrations"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <CreditCard className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {isEs ? "Administración de pagos" : "Payment administration"}
                  </span>
                </Link>
              </div>
            )}
          </div>
        </div>
      ))}
    </nav>
  );
}