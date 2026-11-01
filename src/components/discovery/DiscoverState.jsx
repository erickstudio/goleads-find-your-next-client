import { LoaderCircle, Compass, SearchX, AlertTriangle, Sparkles } from "lucide-react";
import { formatSearchStatusReason } from "@/lib/opportunity-copy";

export default function DiscoverState({ d }) {
  const {
    t,
    lang,
    currentSearchStatus: status,
    showExamples,
    activeSearch,
    isSearching,
    requestError,
    businessCategory,
    locationQuery,
    timeWindowDays,
  } = d;
  const isEs = lang === "es";

  // State 2: Búsqueda en curso
  if (isSearching) {
    return (
      <section
        aria-live="polite"
        className="space-y-3 rounded-xl border border-primary/40 bg-card p-8 text-center"
      >
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
          {isEs ? "Estado: Búsqueda en curso" : "Status: Search in progress"}
        </div>
        <h2 className="text-sm font-semibold">
          {t("discover.searchingTitle")}
        </h2>
        <p className="mx-auto max-w-lg text-xs leading-relaxed text-muted-foreground">
          {t("discover.searchingBody", {
            category: businessCategory,
            location: locationQuery,
            days: timeWindowDays,
          })}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {isEs
            ? "Qué hacer ahora: espera unos segundos mientras verificamos las fuentes encontradas y corroboramos los datos del negocio."
            : "What to do next: please wait a few seconds while we verify the discovered sources and corroborate business details."}
        </p>
      </section>
    );
  }

  // State 4: Búsqueda fallida
  if (status === "failed") {
    return (
      <section
        role="alert"
        className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-6"
      >
        <div className="inline-flex items-center gap-1.5 rounded-md bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {t("discover.failedBadge")}
        </div>
        <h2 className="text-sm font-semibold">{t("discover.failedTitle")}</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {requestError ||
            (activeSearch ? formatSearchStatusReason(activeSearch, lang) : "") ||
            t("discover.failedFallbackBody")}
        </p>
        <p className="text-xs text-foreground/90">
          {isEs
            ? "Qué puedes hacer después: esta búsqueda fallida no descontó tu cupo diario. Puedes reintentarla ahora, cambiar los filtros arriba o revisar la demostración preparada."
            : "What you can do next: this failed search did not deduct from your daily quota. You can retry now, adjust the filters above, or open the prepared demonstration."}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => d.executeDiscoverySearch(true)}
            className="min-h-10 rounded-lg border border-destructive/40 bg-card px-4 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            {t("discover.retrySearchBtn")}
          </button>
          {!showExamples && (
            <button
              type="button"
              onClick={d.toggleExamples}
              className="min-h-10 rounded-lg border border-border bg-card px-4 text-xs font-medium text-foreground hover:bg-secondary"
            >
              {t("discover.viewExamplesBtn")}
            </button>
          )}
        </div>
      </section>
    );
  }

  if (showExamples) return null;

  // State 3: Búsqueda sin coincidencias
  if (status === "empty") {
    return (
      <section className="space-y-3 rounded-xl border border-border bg-card p-8 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          <SearchX className="h-3.5 w-3.5" />
          {t("discover.emptyBadge")}
        </div>
        <h2 className="text-sm font-semibold">{t("discover.emptyTitle")}</h2>
        <p className="mx-auto max-w-lg text-xs leading-relaxed text-muted-foreground">
          {(activeSearch ? formatSearchStatusReason(activeSearch, lang) : "") ||
            t("discover.emptyFallbackBody", {
              category: activeSearch?.business_category || businessCategory,
              location: activeSearch?.location_query || locationQuery,
              days: activeSearch?.time_window_days || timeWindowDays,
            })}
        </p>
        <p className="mx-auto max-w-lg text-xs text-foreground/90">
          {isEs
            ? "Qué puedes hacer después: amplía el periodo a 90 o 180 días, usa una categoría más general (por ejemplo «Restaurantes» o «Clínicas») o prueba una ciudad cercana."
            : "What you can do next: broaden the period to 90 or 180 days, try a wider business category (e.g., 'Restaurants' or 'Clinics'), or test a nearby city."}
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {timeWindowDays !== 180 && (
            <button
              type="button"
              onClick={() => {
                d.setTimeWindowDays(180);
                d.syncFilterUrlParams({ window: 180 });
              }}
              className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {isEs ? "Cambiar periodo a 180 días" : "Switch period to 180 days"}
            </button>
          )}
          <button
            type="button"
            onClick={d.toggleExamples}
            className="rounded-lg border border-border bg-secondary/60 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-secondary"
          >
            {t("discover.viewExamplesBtn")}
          </button>
        </div>
      </section>
    );
  }

  // State 1: Aún no has buscado
  if (!activeSearch) {
    return (
      <section className="space-y-3 rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          <Compass className="h-3.5 w-3.5" />
          {isEs ? "Estado: Aún no has buscado" : "Status: You haven't searched yet"}
        </div>
        <h2 className="text-sm font-semibold">{t("discover.readyTitle")}</h2>
        <p className="mx-auto max-w-lg text-xs leading-relaxed text-muted-foreground">
          {t("discover.readyBody", {
            category: businessCategory,
            location: locationQuery,
            days: timeWindowDays,
          })}
        </p>
        <p className="mx-auto max-w-lg text-xs text-foreground/90">
          {isEs
            ? "Qué puedes hacer ahora: edita el sector y la ciudad arriba y pulsa «Buscar leads», o abre la demostración preparada con 3 ejemplos ficticios sin gastar búsquedas."
            : "What you can do next: edit the business category and city above and click 'Find leads', or open the prepared demonstration with 3 fictional examples without using search quota."}
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={d.toggleExamples}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isEs ? "Ver demostración preparada (3 ejemplos)" : "Open prepared demo (3 examples)"}
          </button>
        </div>
      </section>
    );
  }

  return null;
}