import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, ArrowUpRight } from "lucide-react";
import BrandWordmark from "@/components/BrandWordmark";
import PreferenceControls from "@/components/PreferenceControls";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { usePublicLocale } from "@/lib/PublicLocaleContext";

export default function PublicHeader() {
  const { lang, copy } = usePublicLocale();
  const [open, setOpen] = useState(false);
  const isEs = lang === "es";
  const hashes = ["how-it-works", "evidence-first", "integrations", "faq"];

  return (
    <header className="relative z-20 border-b border-border/60 bg-background/90">
      <a
        href="#public-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:p-3 focus:text-primary-foreground"
      >
        {copy.skip}
      </a>
      <div className="mx-auto flex h-24 max-w-7xl items-center justify-between gap-5 px-5 sm:px-8">
        <Link to="/" search={{ lang }} aria-label="GoLeads">
          <BrandWordmark size="lg" />
        </Link>
        <nav
          className="hidden items-center gap-5 text-sm text-muted-foreground lg:flex"
          aria-label={copy.menu}
        >
          {copy.nav.map((label, i) => (
            <Link
              key={label}
              to="/"
              search={{ lang }}
              hash={hashes[i]}
              className="hover:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-4 lg:flex">
          <PreferenceControls compact />
          <Link
            to="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {copy.signIn}
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {isEs ? "Crear cuenta" : "Create account"}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="rounded-lg border border-border p-2.5 lg:hidden"
              aria-label={copy.menu}
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80 bg-background p-6">
            <SheetTitle className="sr-only">GoLeads</SheetTitle>
            <div className="mt-6 flex flex-col gap-5">
              {copy.nav.map((label, i) => (
                <Link
                  key={label}
                  to="/"
                  search={{ lang }}
                  hash={hashes[i]}
                  onClick={() => setOpen(false)}
                  className="text-base font-medium"
                >
                  {label}
                </Link>
              ))}
              <div className="border-t border-border pt-5">
                <PreferenceControls />
              </div>
              <div className="flex flex-col gap-2.5 pt-2">
                <Link
                  to="/register"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-5 text-sm font-semibold text-brand-foreground"
                >
                  {isEs ? "Crear cuenta" : "Create account"}
                </Link>
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-5 text-sm font-medium text-foreground"
                >
                  {copy.signIn}
                </Link>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}