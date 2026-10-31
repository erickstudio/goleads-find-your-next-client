import { BriefcaseBusiness, Search, BookOpenCheck } from "lucide-react";
import { usePublicLocale } from "@/lib/PublicLocaleContext";

export default function HowItWorks() {
  const { copy } = usePublicLocale();
  const icons = [BriefcaseBusiness, Search, BookOpenCheck];
  return (
    <section id="how-it-works" className="scroll-mt-8 border-y border-border bg-card/40 px-5 py-20 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-6xl"><p className="text-[10px] font-semibold uppercase tracking-widest text-primary sm:text-xs">{copy.stepsEyebrow}</p><h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">{copy.stepsTitle}</h2><div className="mt-12 grid gap-10 md:grid-cols-3">{copy.steps.map((step, i) => { const Icon = icons[i]; return <article key={step.title} className="border-t border-border pt-6"><div className="flex items-center justify-between"><Icon className="h-5 w-5 text-primary" aria-hidden="true" /><span className="font-mono text-xs text-muted-foreground">0{i + 1}</span></div><h3 className="mt-6 text-lg font-semibold">{step.title}</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">{step.body}</p></article>; })}</div></div>
    </section>
  );
}