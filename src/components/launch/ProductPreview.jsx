import { Search, MapPin, Clock3, FileText, Bookmark } from "lucide-react";
import { usePublicLocale } from "@/lib/PublicLocaleContext";

export default function ProductPreview() {
  const { copy } = usePublicLocale();
  const p = copy.preview;
  return (
    <section id="product-preview" className="mx-auto max-w-6xl scroll-mt-8 px-5 pb-20 sm:px-8">
      <figure className="overflow-hidden rounded-2xl border border-primary/25 bg-card shadow-2xl shadow-brand/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/50 px-5 py-4"><span className="text-[10px] font-semibold tracking-widest text-primary sm:text-xs">{p.label}</span><span className="font-mono text-xs text-muted-foreground">GoLeads / Discover</span></div>
        <div className="p-5 sm:p-9"><h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{p.title}</h2><p className="mt-2 text-sm text-muted-foreground">{p.subtitle}</p>
          <div className="my-7 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-3">{[[Search, p.category, p.categoryValue], [MapPin, p.location, p.locationValue], [Clock3, p.window, p.windowValue]].map(([Icon, label, value]) => <div key={label} className="rounded-lg bg-background/60 p-3"><div className="mb-2 text-xs text-muted-foreground">{label}</div><div className="flex items-center gap-2 text-sm"><Icon className="h-4 w-4 text-primary" aria-hidden="true" />{value}</div></div>)}</div>
          <div className="mb-3 text-xs font-medium text-muted-foreground">{p.results}</div>
          <article className="rounded-xl border border-border bg-background/40 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><div className="mb-3 flex flex-wrap gap-2 text-[11px]"><span className="rounded-md border border-border bg-secondary px-2 py-1 text-muted-foreground">{p.review}</span><span className="rounded-md bg-primary/10 px-2 py-1 text-primary">{p.signal}</span></div><h3 className="text-lg font-semibold">{p.business}</h3><p className="mt-1 text-xs text-muted-foreground">{p.place}</p></div><Bookmark className="h-4 w-4 text-muted-foreground" aria-hidden="true" /></div>
            <div className="my-5 rounded-lg border border-border bg-secondary/40 p-4"><p className="flex items-center gap-2 text-xs font-medium"><FileText className="h-3.5 w-3.5 text-primary" />{p.source}</p><p className="mt-3 text-xs text-muted-foreground">{p.sourceName}</p><blockquote className="mt-2 border-l-2 border-primary/40 pl-3 text-sm italic leading-relaxed">{p.excerpt}</blockquote><div className="mt-4 flex flex-wrap gap-4 font-mono text-[10px] text-muted-foreground">{p.dates.map((date) => <span key={date}>{date}</span>)}</div></div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4"><p className="text-xs font-semibold text-primary">{p.fit}</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.fitText}</p></div>
          </article>
        </div><figcaption className="border-t border-border px-5 py-4 text-center text-xs leading-relaxed text-muted-foreground sm:px-9">{p.note}</figcaption>
      </figure>
      <p className="mt-8 text-center text-sm text-muted-foreground">{copy.principle}</p>
    </section>
  );
}