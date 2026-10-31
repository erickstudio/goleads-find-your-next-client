import { Globe2, Unplug, CreditCard } from "lucide-react";
import { usePublicLocale } from "@/lib/PublicLocaleContext";

export default function IntegrationStatus() {
  const { copy } = usePublicLocale();
  const icons = [Globe2, Unplug, CreditCard];
  return (
    <section className="border-y border-border bg-card/40 px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl"><p className="text-[10px] font-semibold tracking-widest text-primary sm:text-xs">{copy.statusEyebrow}</p><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{copy.statusTitle}</h2><div className="mt-10 grid gap-4 md:grid-cols-3">{copy.statuses.map((item, i) => { const Icon = icons[i]; return <article key={item.name} className="rounded-xl border border-border bg-background/50 p-6"><Icon className="mb-5 h-5 w-5 text-muted-foreground" aria-hidden="true" /><h3 className="text-base font-semibold">{item.name}</h3><p className="mt-3 inline-block rounded-md border border-border px-2 py-1 text-[11px] font-medium text-primary">{item.badge}</p><p className="mt-4 text-sm leading-7 text-muted-foreground">{item.body}</p></article>; })}</div><p className="mt-6 text-xs leading-relaxed text-muted-foreground">{copy.statusNote}</p></div>
    </section>
  );
}