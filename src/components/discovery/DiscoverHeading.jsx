import { Link } from "@tanstack/react-router";

export default function DiscoverHeading({ d }) {
  const { t, selectedServices, serviceDescription, outreachLang } = d;
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-primary">{t("workspace.prospecting")} / GoLeads</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("discover.heading")}</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{t("discover.subheading")}</p></div><span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[11px] text-primary">{t("workspace.beta")}</span></div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3"><span className="text-xs text-muted-foreground">{t("discover.yourServicesLabel")}</span>{selectedServices.map((service) => <span key={service} className="rounded-md bg-secondary px-2.5 py-1 text-xs">{service}</span>)}{selectedServices.length === 0 && <span className="text-xs text-muted-foreground">{t("discover.notConfiguredYet")}</span>}<Link to="/onboarding" className="text-xs font-medium text-primary hover:underline">{selectedServices.length > 0 ? t("discover.editServices") : t("discover.addServices")}</Link><span className="text-[11px] text-muted-foreground sm:ml-auto">{t("discover.outreachLanguageIndicator")} {outreachLang.toUpperCase()}</span></div>
      {selectedServices.length === 0 && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-4 py-3 text-xs leading-relaxed"><p className="max-w-2xl"><strong>{t("discover.unconfiguredBannerTitle")}</strong> {t("discover.unconfiguredBannerBody")}</p><Link to="/onboarding" className="font-medium text-primary hover:underline">{t("discover.configureServicesBtn")}</Link></div>}
      {serviceDescription && <p className="text-xs leading-relaxed text-muted-foreground"><strong>{t("discover.offerSummaryLabel")}</strong> {serviceDescription} <Link to="/onboarding" className="text-primary hover:underline">{t("discover.editServices")}</Link></p>}
    </section>
  );
}