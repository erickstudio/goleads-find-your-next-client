import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import PublicMetadata from "@/components/launch/PublicMetadata";
import SupportContactForm from "@/components/launch/SupportContactForm";
import { usePublicLocale } from "@/lib/PublicLocaleContext";

export default function PublicInfoPage({ page }) {
  const { lang, copy } = usePublicLocale();
  const content = copy[page];
  return (
    <article className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <PublicMetadata page={page} />
      <Link to="/" search={{ lang }} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" />
        {copy.back}
      </Link>
      <p className="mt-12 text-[10px] font-semibold tracking-widest text-primary">{copy.legalLabel}</p>
      <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{content.title}</h1>
      <p className="mt-6 rounded-xl border border-primary/25 bg-primary/5 p-5 text-sm leading-7 text-muted-foreground">{content.intro}</p>
      <div className="mt-10 space-y-9">
        {content.sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </div>
      {page === "supportPage" && (
        <>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/login" search={{ returnTo: "/app" }} className="rounded-lg border border-border px-4 py-2.5 text-sm hover:border-primary">
              {content.login}
            </Link>
            <Link to="/forgot-password" search={{ returnTo: "/app" }} className="rounded-lg border border-border px-4 py-2.5 text-sm hover:border-primary">
              {content.reset}
            </Link>
            <Link to="/" search={{ lang }} hash="faq" className="rounded-lg border border-border px-4 py-2.5 text-sm hover:border-primary">
              {content.faq}
            </Link>
          </div>
          <SupportContactForm />
        </>
      )}
      {page !== "supportPage" && (
        <Link to="/support" search={{ lang }} className="mt-10 inline-block text-sm text-primary underline underline-offset-4">
          {copy.support}
        </Link>
      )}
    </article>
  );
}