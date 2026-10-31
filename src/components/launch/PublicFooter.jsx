import { Link } from "@tanstack/react-router";
import BrandWordmark from "@/components/BrandWordmark";
import { usePublicLocale } from "@/lib/PublicLocaleContext";

export default function PublicFooter() {
  const { lang, copy } = usePublicLocale();
  return (
    <footer className="border-t border-border bg-card/30">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-center"><div><Link to="/" search={{ lang }}><BrandWordmark /></Link><p className="mt-3 text-sm text-muted-foreground">{copy.footer}</p></div><nav aria-label={copy.legalLabel} className="flex gap-6 text-sm text-muted-foreground">{[["/privacy", "privacy"], ["/terms", "terms"], ["/support", "support"]].map(([to, key]) => <Link key={to} to={to} search={{ lang }} className="hover:text-foreground">{copy[key]}</Link>)}</nav></div>
        <p className="mt-10 border-t border-border/60 pt-5 text-xs text-muted-foreground">GoLeads · {copy.previewNotice}</p>
      </div>
    </footer>
  );
}