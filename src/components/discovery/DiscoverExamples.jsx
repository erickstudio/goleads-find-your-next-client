import OpportunityCard from "@/components/OpportunityCard";
import { Sparkles, Search, FileCheck2, Briefcase, MessageSquareText } from "lucide-react";

export default function DiscoverExamples({ d }) {
  if (!d.showExamples) return null;
  const isEs = d.lang === "es";

  const visibleDemoIds = d.visibleExamples.map((o) => o.id);
  const allDemoSelected =
    visibleDemoIds.length > 0 &&
    visibleDemoIds.every((id) => d.selectedExampleIds.includes(id));

  const toggleSelectExample = (id) => {
    d.setSelectedExampleIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllDemo = () => {
    if (allDemoSelected) {
      d.setSelectedExampleIds([]);
    } else {
      d.setSelectedExampleIds(visibleDemoIds);
    }
  };

  const handleBatchDismissDemo = () => {
    if (d.selectedExampleIds.length === 0) return;
    const count = d.selectedExampleIds.length;
    d.setDismissedExampleIds((prev) =>
      Array.from(new Set([...prev, ...d.selectedExampleIds]))
    );
    d.setSelectedExampleIds([]);
    d.setActionBanner(
      isEs
        ? `Demostración: descartaste ${count} lead(s) de ejemplo. Puedes restaurarlos abajo sin afectar datos reales.`
        : `Demo: dismissed ${count} example lead(s). You can restore them below without affecting live data.`
    );
  };

  const guideSteps = isEs
    ? [
        {
          icon: Search,
          title: "1. Qué contiene un lead",
          body: "Nombre del negocio, ubicación y el cambio detectado: una apertura, una expansión o un traslado.",
        },
        {
          icon: FileCheck2,
          title: "2. Cómo se revisa un anuncio",
          body: "Extracto en su idioma original, enlace a la fuente, fecha de publicación separada de la fecha del evento y estado de verificación.",
        },
        {
          icon: Briefcase,
          title: "3. Cómo se relaciona con tu servicio",
          body: "Explicación en 3 puntos conectada con un servicio específico y qué confirmar antes de escribir.",
        },
        {
          icon: MessageSquareText,
          title: "4. Cómo se prepara un mensaje",
          body: "Abre «Ver detalles» en cualquier ejemplo para probar el selector de servicio y editar el borrador de contacto.",
        },
      ]
    : [
        {
          icon: Search,
          title: "1. What a lead contains",
          body: "Business name, location, and the detected signal: a new opening, an expansion, or a relocation.",
        },
        {
          icon: FileCheck2,
          title: "2. How to review an announcement",
          body: "Original-language excerpt, source link, publication date kept separate from event date, and verification status.",
        },
        {
          icon: Briefcase,
          title: "3. How it relates to your service",
          body: "3-part explanation linked to one specific service and what to confirm before reaching out.",
        },
        {
          icon: MessageSquareText,
          title: "4. How to prepare a message",
          body: "Click 'View details' on any example to test the service selector and edit the outreach draft.",
        },
      ];

  return (
    <section
      aria-label={d.t("discover.examplesBannerTitle")}
      className="space-y-5 rounded-2xl border border-primary/30 bg-card/60 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 border border-primary/35 px-2.5 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              {isEs ? "Datos de ejemplo · Demostración preparada" : "Example data · Prepared demonstration"}
            </span>
            <span className="rounded-md bg-secondary border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
              {isEs
                ? "No consume búsquedas ni altera tus leads guardados"
                : "Uses 0 search quota and never alters your saved leads"}
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-foreground">
            {isEs
              ? "Explora 3 escenarios de ejemplo (apertura, expansión y traslado) antes de buscar"
              : "Explore 3 fictional example scenarios (opening, expansion, and relocation) before searching"}
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {d.t("discover.examplesBannerBody")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={d.startOwnSearch}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <Search className="h-3.5 w-3.5" />
            {isEs ? "Buscar mis propios clientes" : "Find my own clients"}
          </button>
          <button
            type="button"
            onClick={d.toggleExamples}
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            {d.t("discover.closeExamplesBtn")}
          </button>
        </div>
      </div>

      {/* 4-step walkthrough of what a lead contains and how to use it */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {guideSteps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className="rounded-xl border border-border bg-background/70 p-3.5 space-y-1.5"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Icon className="h-4 w-4 text-primary shrink-0" />
                <span>{step.title}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
          );
        })}
      </div>

      {/* Multi-select demo bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {visibleDemoIds.length > 0 && (
            <label className="inline-flex items-center gap-2 font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={allDemoSelected}
                onChange={toggleSelectAllDemo}
                className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring cursor-pointer"
              />
              <span>
                {isEs
                  ? `Seleccionar todos los ejemplos visibles (${visibleDemoIds.length})`
                  : `Select all visible examples (${visibleDemoIds.length})`}
              </span>
            </label>
          )}
          {d.selectedExampleIds.length > 0 && (
            <span className="px-2 py-0.5 rounded bg-primary text-primary-foreground font-semibold">
              {isEs
                ? `${d.selectedExampleIds.length} ejemplo(s) seleccionado(s)`
                : `${d.selectedExampleIds.length} example(s) selected`}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {d.selectedExampleIds.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleBatchDismissDemo}
                className="px-3 py-1 rounded-md text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isEs
                  ? `Descartar seleccionados (${d.selectedExampleIds.length})`
                  : `Dismiss selected (${d.selectedExampleIds.length})`}
              </button>
              <button
                type="button"
                onClick={() => d.setSelectedExampleIds([])}
                className="px-2.5 py-1 rounded-md text-xs font-medium bg-card text-foreground border border-border"
              >
                {isEs ? "Limpiar selección" : "Clear selection"}
              </button>
            </>
          )}
          {d.dismissedExampleIds.length > 0 && (
            <button
              type="button"
              onClick={() => d.setDismissedExampleIds([])}
              className="px-2.5 py-1 rounded-md text-xs font-medium text-primary border border-primary/30 bg-primary/10 hover:bg-primary/20"
            >
              {isEs
                ? `Restaurar ejemplos descartados (${d.dismissedExampleIds.length})`
                : `Restore dismissed examples (${d.dismissedExampleIds.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Active Demo Cards */}
      <div className="space-y-4">
        {d.visibleExamples.map((opp) => (
          <OpportunityCard
            key={opp.id}
            opp={opp}
            selectedServices={d.selectedServices}
            serviceDescription={d.serviceDescription}
            isExample
            isSaved={d.savedExampleIds.includes(opp.id)}
            isSelected={d.selectedExampleIds.includes(opp.id)}
            detailSearchParams={d.detailSearchParams}
            onToggleSelect={toggleSelectExample}
            onSave={d.handleSaveOpportunity}
            onUnsave={d.handleUnsaveOpportunity}
            onDismiss={d.handleDismissOpportunity}
          />
        ))}
      </div>

      {/* Dismissed Demo Cards */}
      {d.dismissedExamples?.length > 0 && (
        <div className="space-y-3 pt-3 border-t border-border">
          <h3 className="text-xs font-semibold text-muted-foreground">
            {isEs
              ? `Ejemplos descartados en esta demostración (${d.dismissedExamples.length})`
              : `Dismissed examples in this demo (${d.dismissedExamples.length})`}
          </h3>
          {d.dismissedExamples.map((opp) => (
            <OpportunityCard
              key={opp.id}
              opp={opp}
              selectedServices={d.selectedServices}
              serviceDescription={d.serviceDescription}
              isExample
              isDismissed
              isSaved={d.savedExampleIds.includes(opp.id)}
              detailSearchParams={d.detailSearchParams}
              onRestore={d.handleRestoreOpportunity}
            />
          ))}
        </div>
      )}
    </section>
  );
}