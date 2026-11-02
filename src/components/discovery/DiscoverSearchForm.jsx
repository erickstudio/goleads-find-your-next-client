import { Search, SlidersHorizontal, Sparkles } from "lucide-react";

const STARTER_PRESETS = [
  {
    category: "Restaurants",
    labelEs: "Restaurantes · Miami (90d)",
    labelEn: "Restaurants · Miami (90d)",
    location: "Miami, FL, USA",
    window: 90,
  },
  {
    category: "Dental clinics",
    labelEs: "Clínicas dentales · Austin (90d)",
    labelEn: "Dental clinics · Austin (90d)",
    location: "Austin, TX, USA",
    window: 90,
  },
  {
    category: "Physical therapy clinics",
    labelEs: "Fisioterapia · Madrid (180d)",
    labelEn: "Physical therapy · Madrid (180d)",
    location: "Madrid, España",
    window: 180,
  },
];

export default function DiscoverSearchForm({ d }) {
  const { t, lang, businessCategory, locationQuery, timeWindowDays, isSearching, quota } = d;
  const isEs = lang === "es";

  const applyPreset = (preset) => {
    if (isSearching) return;
    d.setBusinessCategory(preset.category);
    d.setLocationQuery(preset.location);
    d.setTimeWindowDays(preset.window);
    d.syncFilterUrlParams({
      category: preset.category,
      location: preset.location,
      window: preset.window,
    });
  };

  return (
    <section
      aria-label={t("discover.searchCriteriaAria")}
      className="rounded-2xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          {t("discover.searchCriteriaAria")}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {isEs
            ? "Edita libremente el sector, la ciudad y el periodo antes de pulsar «Buscar leads»."
            : "Freely edit the business category, city, and period before clicking 'Find leads'."}
        </p>
      </div>

      {/* Editable Starter Presets (Never auto-executes a search) */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-[11px] font-medium text-muted-foreground mr-1">
          {isEs ? "Filtros de ejemplo editables:" : "Editable example filters:"}
        </span>
        {STARTER_PRESETS.map((preset) => (
          <button
            key={preset.labelEn}
            type="button"
            disabled={isSearching}
            onClick={() => applyPreset(preset)}
            className="rounded-md border border-border bg-secondary/60 px-2.5 py-1 text-[11px] text-foreground hover:bg-secondary hover:border-primary/40 transition-colors disabled:opacity-50"
          >
            {isEs ? preset.labelEs : preset.labelEn}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          d.executeDiscoverySearch(false);
        }}
        className="space-y-5"
      >
        <fieldset><legend className="mb-2 text-xs font-medium">{isEs ? "¿Dónde quieres buscar?" : "Where do you want to search?"}</legend><div className="flex flex-wrap gap-2">{[["hybrid", isEs ? "IA + negocios locales" : "AI + local businesses"], ["web", isEs ? "Aperturas y expansión · IA" : "Openings and expansion · AI"], ["local", isEs ? "Negocios locales · Google Maps" : "Local businesses · Google Maps"]].map(([value,label]) => <button key={value} type="button" disabled={isSearching} aria-pressed={d.searchMode === value} onClick={() => d.setSearchMode(value)} className={`rounded-lg border px-3 py-2 text-xs focus-visible:ring-2 focus-visible:ring-ring ${d.searchMode === value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{label}</button>)}</div><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{isEs ? "El periodo solo filtra los anuncios web. Las fichas de Google Maps muestran negocios locales y no confirman aperturas." : "The time window filters web announcements only. Google Maps listings show local businesses and do not confirm openings."}</p></fieldset>
        <div className="grid gap-4 md:grid-cols-12">
          <div className="md:col-span-5">
            <label htmlFor="business-category" className="mb-2 block text-xs font-medium">
              {t("discover.categoryLabel")}
            </label>
            <input
              id="business-category"
              type="text"
              disabled={isSearching}
              value={businessCategory}
              onChange={(e) => {
                d.setBusinessCategory(e.target.value);
                d.syncFilterUrlParams({ category: e.target.value });
              }}
              placeholder={t("discover.categoryPlaceholder")}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
          </div>

          <div className="md:col-span-4">
            <label htmlFor="city-country" className="mb-2 block text-xs font-medium">
              {t("discover.locationLabel")}
            </label>
            <input
              id="city-country"
              type="text"
              disabled={isSearching}
              value={locationQuery}
              onChange={(e) => {
                d.setLocationQuery(e.target.value);
                d.syncFilterUrlParams({ location: e.target.value });
              }}
              placeholder={t("discover.locationPlaceholder")}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
          </div>

          <fieldset className="md:col-span-3">
            <legend className="mb-2 text-xs font-medium">
              {t("discover.timeWindowLabel")}
            </legend>
            <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-secondary p-1">
              {[30, 90, 180].map((days) => (
                <button
                  key={days}
                  type="button"
                  disabled={isSearching}
                  aria-pressed={timeWindowDays === days}
                  onClick={() => {
                    d.setTimeWindowDays(days);
                    d.syncFilterUrlParams({ window: days });
                  }}
                  className={`min-h-9 rounded-md text-xs focus-visible:ring-2 focus-visible:ring-ring ${
                    timeWindowDays === days
                      ? "bg-card font-medium text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("discover.daysOption", { days })}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
          <div className="space-y-1 text-[11px] text-muted-foreground">
            <p className="font-medium text-primary">{t("discover.liveSearchBadge")}</p>
            <p>
              {t("discover.quotaRemaining", {
                remaining: quota.isOwner ? (isEs ? "Sin límite" : "Unlimited") : quota.remainingToday,
                max: quota.maxDaily,
              })}{" "}
              · {t("discover.maxResultsNote", { max: quota.maxResultsPerSearch })}
            </p>
            {d.isDefaultTestQuery && <p>{t("discover.starterQueryNote")}</p>}
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <button
              type="button"
              onClick={d.toggleExamples}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-4 text-xs font-medium hover:bg-secondary"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {d.showExamples
                ? t("discover.hideExamplesBtn")
                : t("discover.viewExamplesBtn")}
            </button>
            <button
              type="submit"
              disabled={isSearching}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Search className="h-4 w-4" />
              {isSearching ? t("discover.searchingBtn") : t("discover.findLeadsBtn")}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}