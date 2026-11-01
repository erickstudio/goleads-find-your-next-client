import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowDown } from "lucide-react";
import { usePublicLocale } from "@/lib/PublicLocaleContext";

export default function LaunchHero() {
  const { copy } = usePublicLocale();
  return (
    <section className="border-b border-border bg-background px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">{copy.beta}</p>
        <div className="mt-7 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-16">
          <h1 className="max-w-2xl font-display text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
            <span className="block">{copy.headline}</span>
            <span className="mt-3 block text-primary">{copy.headlineAccent}</span>
          </h1>
          <div className="max-w-lg pb-1">
            <p className="text-base leading-8 text-muted-foreground sm:text-lg">{copy.intro}</p>
            <div className="mt-7 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
              <Link to="/app" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{copy.cta}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              <a href="#product-preview" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">{copy.previewLink}<ArrowDown className="h-3.5 w-3.5" aria-hidden="true" /></a>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{copy.ctaNote}</p>
            <p className="mt-7 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">{copy.audience}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
