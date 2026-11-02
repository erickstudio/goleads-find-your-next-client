import { Search, Sparkles, ShieldCheck, UserCheck, ArrowRight, ArrowDown } from "lucide-react";
import { usePublicLocale } from "@/lib/PublicLocaleContext";

export default function HowItWorks() {
  const { copy } = usePublicLocale();
  const flowIcons = [Search, Sparkles, ShieldCheck, UserCheck];
  const flow = copy.diagramFlow || [];

  return (
    <section id="how-it-works" className="scroll-mt-8 border-y border-border bg-card/40 px-5 py-20 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary sm:text-xs">{copy.stepsEyebrow}</p>
        <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">{copy.stepsTitle}</h2>

        <div className="mt-10 rounded-2xl border border-border bg-background/80 p-5 sm:p-7">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{copy.diagramLabel}</p>
          <div className="mt-5 grid gap-3 lg:grid-cols-4 lg:gap-4">
            {flow.map((node, i) => {
              const NodeIcon = flowIcons[i] || Search;
              return (
                <div key={node.step} className="relative flex flex-col">
                  <div className="flex flex-1 flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-2xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
                        <NodeIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        {node.tag}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{node.step}</span>
                    </div>
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-foreground">{node.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{node.detail}</p>
                    </div>
                  </div>
                  {i < flow.length - 1 && (
                    <>
                      <ArrowRight className="pointer-events-none absolute -right-3 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-primary lg:block" aria-hidden="true" />
                      <ArrowDown className="mx-auto my-1 h-4 w-4 text-primary lg:hidden" aria-hidden="true" />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}