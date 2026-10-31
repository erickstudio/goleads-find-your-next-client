import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowDown, ScanLine } from "lucide-react";
import { usePublicLocale } from "@/lib/PublicLocaleContext";

export default function LaunchHero() {
  const { copy } = usePublicLocale();
  return (
    <section className="signal-hero relative isolate overflow-hidden px-5 pb-16 pt-20 sm:px-8 sm:pb-20 sm:pt-28">
      <div aria-hidden="true" className="signal-orbit pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto max-w-5xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/8 px-4 py-2 text-[10px] font-semibold tracking-widest text-primary sm:text-xs"><ScanLine className="h-3.5 w-3.5" />{copy.beta}</span>
        <h1 className="mx-auto mt-8 max-w-5xl font-display text-5xl font-semibold leading-[1.08] tracking-tight sm:text-7xl lg:text-8xl"><span className="block">{copy.headline}</span><span className="mt-1 block text-primary">{copy.headlineAccent}</span></h1>
        <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">{copy.intro}</p>
        <div className="mt-9 flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-8"><Link to="/app" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-brand px-7 py-3.5 text-sm font-semibold text-brand-foreground shadow-lg shadow-brand/20 transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{copy.cta}<ArrowRight className="h-4 w-4" /></Link><a href="#product-preview" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">{copy.previewLink}<ArrowDown className="h-3.5 w-3.5" /></a></div>
        <p className="mx-auto mt-5 max-w-lg text-xs leading-relaxed text-muted-foreground">{copy.ctaNote}</p>
        <p className="mt-12 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{copy.audience}</p>
      </div>
    </section>
  );
}