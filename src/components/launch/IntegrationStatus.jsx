import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { usePublicLocale } from "@/lib/PublicLocaleContext";

export default function IntegrationStatus() {
  const { copy } = usePublicLocale();
  return (
    <section id="integrations" className="border-y border-border bg-card/30 px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div>
          <p className="text-[11px] font-semibold tracking-widest text-primary">{copy.statusEyebrow}</p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{copy.statusTitle}</h2>
          <p className="mt-6 text-sm leading-7 text-muted-foreground">{copy.statusNote}</p>
          <Link to="/app" className="mt-7 inline-flex min-h-11 items-center gap-3 text-sm font-semibold text-primary hover:underline">{copy.cta}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
        <div className="divide-y divide-border border-y border-border">
          {copy.statuses.map((item, i) => (
            <article key={item.name} className="grid grid-cols-[2rem_1fr] gap-4 py-7">
              <span className="pt-1 font-mono text-xs text-muted-foreground" aria-hidden="true">0{i + 1}</span>
              <div>
                <p className="text-xs text-primary">{item.badge}</p>
                <h3 className="mt-2 text-lg font-semibold">{item.name}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
