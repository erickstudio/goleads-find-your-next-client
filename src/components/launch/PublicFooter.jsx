import { Link } from "@tanstack/react-router";
import BrandWordmark from "@/components/BrandWordmark";
import { usePublicLocale } from "@/lib/PublicLocaleContext";
import { openCookieSettings } from "@/components/launch/CookieConsentBanner";

export default function PublicFooter() {
  const { lang, copy } = usePublicLocale();
  return (
    <footer className="border-t border-border bg-card/30">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-center">
          <div>
            <Link to="/" search={{ lang }}><BrandWordmark /></Link>
            <p className="mt-3 text-sm text-muted-foreground">{copy.footer}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Panamá, Panamá ·{" "}
              <a
                href="mailto:info@goleads.space"
                className="text-primary hover:underline underline-offset-4"
              >
                info@goleads.space
              </a>
            </p>
          </div>
          <nav aria-label={copy.legalLabel} className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            {[["/privacy", "privacy"], ["/terms", "terms"], ["/support", "support"]].map(([to, key]) => (
              <Link key={to} to={to} search={{ lang }} className="hover:text-foreground">
                {copy[key]}
              </Link>
            ))}
            <button
              type="button"
              onClick={openCookieSettings}
              className="hover:text-foreground text-left focus:outline-none focus:ring-2 focus:ring-ring rounded"
            >
              {lang === "es" ? "Configuración de cookies" : "Cookie settings"}
            </button>
          </nav>
        </div>
        <div className="mt-10 border-t border-border/60 pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>GoLeads · {copy.previewNotice}</p>
          <p>
            Panamá, Panamá ·{" "}
            <a href="mailto:info@goleads.space" className="hover:text-foreground underline underline-offset-4">
              info@goleads.space
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}