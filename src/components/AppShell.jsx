import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/AuthContext";
import { usePreferences } from "@/lib/PreferencesContext";
import BrandWordmark from "@/components/BrandWordmark";
import PreferenceControls from "@/components/PreferenceControls";

export default function AppShell({ children, user }) {
  const location = useLocation();
  const { logout } = useAuth();
  const { lang, t } = usePreferences();
  const isEs = lang === "es";
  const pathname = location.pathname;

  const primaryNavItems = [
    { to: "/", label: t("nav.findLeads"), active: pathname === "/" },
    { to: "/saved", label: t("nav.savedLeads"), active: pathname.startsWith("/saved") },
    {
      to: "/outreach-planner",
      label: isEs ? "Contacto" : "Outreach",
      active: pathname.startsWith("/outreach-planner"),
    },
    {
      to: "/dashboard",
      label: isEs ? "Panel" : "Dashboard",
      active: pathname.startsWith("/dashboard"),
    },
    {
      to: "/onboarding",
      label: t("nav.yourServices"),
      active: pathname.startsWith("/onboarding"),
    },
    {
      to: "/pilot",
      label: t("nav.pilotOffer"),
      active: pathname.startsWith("/pilot"),
    },
  ];

  const secondaryNavItems = [
    {
      to: "/search-history",
      label: isEs ? "Historial de búsquedas" : "Search History",
      active: pathname.startsWith("/search-history"),
    },
    {
      to: "/evidence-library",
      label: isEs ? "Biblioteca de evidencia" : "Evidence Library",
      active: pathname.startsWith("/evidence-library"),
    },
    {
      to: "/market-insights",
      label: isEs ? "Tendencias de mercado" : "Market Insights",
      active: pathname.startsWith("/market-insights"),
    },
    {
      to: "/feedback-summary",
      label: isEs ? "Calificaciones" : "Feedback Summary",
      active: pathname.startsWith("/feedback-summary"),
    },
    {
      to: "/agent-settings",
      label: isEs ? "Agentes IA" : "Agent Settings",
      active: pathname.startsWith("/agent-settings"),
    },
    {
      to: "/settings",
      label: isEs ? "Ajustes" : "Account Settings",
      active: pathname.startsWith("/settings"),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              to="/"
              className="inline-flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-ring rounded px-1 py-0.5 shrink-0"
            >
              <BrandWordmark size="md" />
            </Link>

            <nav
              aria-label={t("nav.mainAria")}
              className="hidden md:flex items-center gap-1 overflow-x-auto"
            >
              {primaryNavItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring whitespace-nowrap ${
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
              <span className="hidden lg:inline text-xs font-mono text-muted-foreground truncate max-w-[160px]">
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

        {/* Secondary workspace sub-navigation bar */}
        <div className="border-t border-border/70 bg-secondary/40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-1.5 flex items-center gap-1 overflow-x-auto">
            {secondaryNavItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                  item.active
                    ? "bg-card text-primary border border-border shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/60"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Mobile primary navigation */}
        <nav
          aria-label={t("nav.mobileAria")}
          className="md:hidden border-t border-border bg-card px-4 py-1.5 flex items-center gap-1 overflow-x-auto"
        >
          {primaryNavItems.map((item) => (
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