import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";

/**
 * Adapted from the pre-made "Stat Card" (sc4-section) library component:
 * - Preserves structure (top row with label + chip group + sublabel, bottom row with animated tabular value),
 *   grain texture overlay, hover lift + dark overlay shift, count-up animation with easeOut(t) = 1 - (1 - t)^4,
 *   and sequenced chip/sublabel reveal.
 * - Restyled to GoLeads' brand palette (violet #4e2bff -> lavender #8870ff -> deep navy #111827) and Inter font.
 */
export default function SurveyStatCard({
  label,
  targetValue = 0,
  decimals = 0,
  prefix = "",
  suffix = "",
  chipText = "",
  subLabel = "",
  variant = "violet",
}) {
  const [displayNumber, setDisplayNumber] = useState(0);

  useEffect(() => {
    const target = Number(targetValue) || 0;
    if (target === 0) {
      setDisplayNumber(0);
      return;
    }

    const duration = 1400;
    const delay = 180;
    let rafId = null;
    const timer = setTimeout(() => {
      const start = performance.now();
      function easeOut(t) {
        return 1 - Math.pow(1 - t, 4);
      }
      function tick(now) {
        const p = Math.min((now - start) / duration, 1);
        const current = easeOut(p) * target;
        setDisplayNumber(p < 1 ? current : target);
        if (p < 1) {
          rafId = requestAnimationFrame(tick);
        }
      }
      rafId = requestAnimationFrame(tick);
    }, delay);

    return () => {
      clearTimeout(timer);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [targetValue]);

  const formattedValue =
    decimals > 0
      ? Number(displayNumber).toFixed(decimals)
      : Math.round(Number(displayNumber)).toLocaleString("en-US");

  const gradientClass =
    variant === "emerald"
      ? "bg-[linear-gradient(to_bottom,#a7f3d0_6%,#6ee7b7_28%,#3b82f6_48%,#111827_88%)]"
      : variant === "amber"
      ? "bg-[linear-gradient(to_bottom,#fde68a_8%,#c4b5fd_34%,#7c3aed_52%,#111827_88%)]"
      : "bg-[linear-gradient(to_bottom,#ddd6fe_8%,#a78bfa_31%,#4e2bff_50%,#111827_88%)]";

  return (
    <section
      data-sc4
      className={`group relative w-full min-h-[172px] rounded-2xl overflow-hidden p-5 flex flex-col justify-between font-body transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border border-primary/25 ${gradientClass}`}
    >
      {/* Hover dark gradient shift over bottom half */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(to_bottom,transparent_30%,rgba(10,14,28,0.55)_100%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100 z-0"
      />

      {/* Top row: Label + Sequenced Chip & Sublabel */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="text-sm sm:text-base font-semibold tracking-tight text-slate-950 leading-snug">
          {label}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          {chipText && (
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950/90 px-3 py-1 text-xs sm:text-sm font-semibold text-primary-foreground shadow-xs transition-transform duration-200 group-hover:scale-105">
              <TrendingUp className="h-3.5 w-3.5 text-violet-300 shrink-0" />
              <span className="text-violet-200">{chipText}</span>
            </div>
          )}
          {subLabel && (
            <div className="text-[11px] font-medium tracking-tight text-slate-900/90 whitespace-nowrap">
              {subLabel}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: Count-up value */}
      <div className="relative z-10 flex items-end pt-4">
        <div
          data-sc4-value
          className="text-4xl sm:text-5xl font-bold tracking-tight text-white tabular-nums leading-none transition-transform duration-300 group-hover:scale-[1.03]"
        >
          {prefix}
          {formattedValue}
          {suffix}
        </div>
      </div>
    </section>
  );
}