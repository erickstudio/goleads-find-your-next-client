import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PublicLocaleProvider } from "@/lib/PublicLocaleContext";
import PublicHeader from "@/components/launch/PublicHeader";
import PublicFooter from "@/components/launch/PublicFooter";
import CookieConsentBanner from "@/components/launch/CookieConsentBanner";

export const Route = createFileRoute("/_site")({
  validateSearch: (search) => search.lang === "es" || search.lang === "en" ? { lang: search.lang } : {},
  component: PublicSiteLayout,
});
function PublicSiteLayout() {
  const { lang } = Route.useSearch();
  return (
    <PublicLocaleProvider initialLang={lang}>
      <div className="min-h-screen bg-background text-foreground">
        <PublicHeader />
        <main id="public-content">
          <Outlet />
        </main>
        <PublicFooter />
        <CookieConsentBanner />
      </div>
    </PublicLocaleProvider>
  );
}