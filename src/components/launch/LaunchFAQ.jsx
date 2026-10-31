import { Plus } from "lucide-react";
import { usePublicLocale } from "@/lib/PublicLocaleContext";

export default function LaunchFAQ() {
  const { copy } = usePublicLocale();
  return (
    <section id="faq" className="mx-auto max-w-4xl scroll-mt-8 px-5 py-20 sm:px-8 sm:py-24"><h2 className="mb-10 text-3xl font-semibold tracking-tight sm:text-4xl">{copy.faqTitle}</h2><div className="divide-y divide-border border-y border-border">{copy.faqs.map((item) => <details key={item.q} className="group py-6"><summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-base font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">{item.q}<Plus className="mt-1 h-4 w-4 shrink-0 text-muted-foreground group-open:rotate-45" aria-hidden="true" /></summary><p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">{item.a}</p></details>)}</div></section>
  );
}