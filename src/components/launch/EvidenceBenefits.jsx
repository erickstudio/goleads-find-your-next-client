import { FileSearch, CalendarDays, ScanLine, LockKeyhole } from "lucide-react";
import { usePublicLocale } from "@/lib/PublicLocaleContext";

export default function EvidenceBenefits() {
  const { copy } = usePublicLocale();
  const icons = [FileSearch, CalendarDays, ScanLine, LockKeyhole];
  return (
    <section id="evidence-first" className="mx-auto grid max-w-6xl scroll-mt-8 gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-5">
      <div className="lg:col-span-2"><p className="text-[10px] font-semibold tracking-widest text-primary sm:text-xs">{copy.benefitsEyebrow}</p><h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{copy.benefitsTitle}</h2><div aria-hidden="true" className="signal-mark mt-10 hidden h-40 w-40 rounded-full border border-primary/20 lg:block" /></div>
      <div className="grid gap-7 sm:grid-cols-2 lg:col-span-3">{copy.benefits.map((item, i) => { const Icon = icons[i]; return <article key={item.title} className="rounded-xl border border-border bg-card/50 p-6"><Icon className="mb-5 h-5 w-5 text-primary" aria-hidden="true" /><h3 className="text-base font-semibold leading-snug">{item.title}</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">{item.body}</p></article>; })}</div>
    </section>
  );
}