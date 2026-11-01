import { Link } from "@tanstack/react-router";
import { usePublicLocale } from "@/lib/PublicLocaleContext";
import { getPlanComparison } from "@/lib/plan-comparison";
import PlanComparison from "@/components/plans/PlanComparison";

export default function LaunchPlans() {
  const { lang } = usePublicLocale();
  const copy = getPlanComparison(lang);
  const es = lang === "es";
  return (
    <section id="plans" className="scroll-mt-8 border-b border-border bg-background px-5 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="max-w-3xl space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">{es ? "PLANES" : "PLANS"}</p>
          <h2 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{copy.title}</h2>
          <p className="text-sm leading-7 text-muted-foreground">{copy.intro}</p>
        </div>
        <PlanComparison lang={lang} />
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/register" className="inline-flex min-h-11 items-center rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground focus-visible:ring-2 focus-visible:ring-ring">{es ? "Crear cuenta gratis" : "Create a free account"}</Link>
          <Link to="/subscription" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">{es ? "Ya tengo cuenta · Ver mi plan" : "Already registered · View my plan"}</Link>
          <span className="text-xs text-muted-foreground">{es ? "Pro aún no está a la venta." : "Pro is not for sale yet."}</span>
        </div>
      </div>
    </section>
  );
}