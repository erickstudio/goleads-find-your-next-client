import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/AuthContext";
import { usePreferences } from "@/lib/PreferencesContext";
import BrandWordmark from "@/components/BrandWordmark";
import PreferenceControls from "@/components/PreferenceControls";

export default function AppShell({ children, user }) {
  const location = useLocation();
  const { logout } = useAuth();
  const { t } = usePreferences();
  const pathname = location.pathname;

  const navItems = [
    { to: "/", label: t("nav.findLeads"), active: pathname === "/" },
    { to: "/saved", label: t("nav.savedLeads"), active: pathname.startsWith("/saved") },
    { to: "/onboarding", label: t("nav.yourServices"), active: pathname.startsWith("/onboarding") },
    { to: "/pilot", label: t("nav.pilotOffer"), active: pathname.startsWith("/pilot") },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-5 min-w-0">
            <Link
              to="/"
              className="inline-flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-ring rounded px-1 py-0.5 shrink-0"
            >
              <BrandWordmark size="md" />
            </Link>

            <nav aria-label={t("nav.mainAria")} className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring whitespace-nowrap ${
                    item.active
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <PreferenceControls compact />
            {user?.email && (
              <span className="hidden lg:inline text-xs font-mono text-muted-foreground truncate max-w-[180px]">
                {user.email}
              </span>
            )}
            <button
              type="button"
              onClick={() => logout()}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent hover:border-border transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {t("nav.signOut")}
            </button>
          </div>
        </div>

        {/* Mobile navigation */}
        <nav
          aria-label={t("nav.mobileAria")}
          className="md:hidden border-t border-border bg-card px-4 py-1.5 flex items-center gap-1 overflow-x-auto"
        >
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                item.active
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-border bg-card mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-muted-foreground">
          <BrandWordmark size="sm" />
          <span>{t("brand.footerTagline")}</span>
        </div>
      </footer>
    </div>
  );
}