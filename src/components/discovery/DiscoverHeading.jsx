import { Link } from "@tanstack/react-router";

export default function DiscoverHeading({ d }) {
  const { t, lang, selectedServices, serviceDescription, outreachLang } = d;
  const isEs = lang === "es";
  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            {t("workspace.prospecting")} · GoLeads
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("discover.heading")}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t("discover.subheading")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            to="/saved"
            className="rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:bg-secondary"
          >
            {isEs ? "Leads guardados" : "Saved leads"}
          </Link>
          <Link
            to="/connect"
            className="rounded-lg border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary hover:bg-primary/20"
          >
            {isEs ? "Conectar asistente" : "Connect assistant"}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
        <span className="text-xs font-medium text-muted-foreground">
          {t("discover.yourServicesLabel")}
        </span>
        {selectedServices.map((service) => (
          <span
            key={service}
            className="rounded-md bg-primary/10 border border-primary/25 px-2.5 py-0.5 text-xs font-medium text-foreground"
          >
            {service}
          </span>
        ))}
        {selectedServices.length === 0 && (
          <span className="text-xs text-muted-foreground">{t("discover.notConfiguredYet")}</span>
        )}
        <Link to="/onboarding" className="text-xs font-semibold text-primary hover:underline">
          {selectedServices.length > 0 ? t("discover.editServices") : t("discover.addServices")}
        </Link>
        <span className="text-[11px] text-muted-foreground sm:ml-auto">
          {t("discover.outreachLanguageIndicator")} <strong>{outreachLang.toUpperCase()}</strong>
        </span>
      </div>

      {selectedServices.length === 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-xs leading-relaxed"
        >
          <p className="max-w-2xl">
            <strong>{t("discover.unconfiguredBannerTitle")}</strong>{" "}
            {t("discover.unconfiguredBannerBody")}
          </p>
          <Link
            to="/onboarding"
            className="rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {t("discover.configureServicesBtn")}
          </Link>
        </div>
      )}

      {serviceDescription && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          <strong>{t("discover.offerSummaryLabel")}</strong> {serviceDescription}{" "}
          <Link to="/onboarding" className="text-primary hover:underline">
            {t("discover.editServices")}
          </Link>
        </p>
      )}
    </section>
  );
}