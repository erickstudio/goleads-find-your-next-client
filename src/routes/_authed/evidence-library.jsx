import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { formatRecencyBasisLabel } from "@/lib/leads-constants";
import {
  formatSignalTypeLabel,
  formatDateValue,
  formatOriginalExcerptBadge,
  getExcerptSupportTranslation,
  formatVerificationNotes,
} from "@/lib/opportunity-copy";
import { getExtendedWorkspaceData } from "@/lib/workspace-pages-fns";
import { usePreferences } from "@/lib/PreferencesContext";
import { safePublicUrl } from "@/lib/public-url";

export const Route = createFileRoute("/_authed/evidence-library")({
  ssr: false,
  loader: () => getExtendedWorkspaceData(),
  head: () => ({
    meta: [
      { title: "Evidence Library — goleads.app" },
      {
        name: "description",
        content:
          "Browse and filter all recovered public web evidence items by source, verification status, or signal type.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: EvidenceLibraryPage,
});

function EvidenceLibraryPage() {
  const data = Route.useLoaderData();
  const { lang, syncFromProfile, t } = usePreferences();
  const isEs = lang === "es";

  const opportunities = data?.opportunities || [];
  const oppMap = new Map(opportunities.map((o) => [o.id, o]));

  // Combine EvidenceItems with their parent Opportunity metadata
  const rawEvidence = data?.evidenceItems || [];
  const enrichedEvidence = rawEvidence.map((ev) => {
    const parent = oppMap.get(ev.opportunity_id);
    return {
      ...ev,
      business_name: parent?.business_name || "Business record",
      business_category: parent?.business_category || "",
      location: parent?.location || "",
      signal_type: parent?.signal_type || "Expansion signal",
    };
  });

  const [verificationFilter, setVerificationFilter] = useState("all");
  const [signalFilter, setSignalFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (data?.profile) {
      syncFromProfile(data.profile);
    }
  }, [data?.profile?.id]);

  useEffect(() => {
    document.title = isEs
      ? "Biblioteca de evidencia — goleads.app"
      : "Evidence Library — goleads.app";
  }, [isEs]);

  const distinctSignals = Array.from(
    new Set(enrichedEvidence.map((e) => e.signal_type).filter(Boolean))
  );

  const filteredEvidence = enrichedEvidence.filter((ev) => {
    if (
      verificationFilter !== "all" &&
      ev.verification_status !== verificationFilter
    ) {
      return false;
    }
    if (signalFilter !== "all" && ev.signal_type !== signalFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const hay = `${ev.business_name} ${ev.source_title} ${ev.source_url} ${ev.supporting_excerpt} ${ev.location}`.toLowerCase();
      return hay.includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {isEs ? "Biblioteca de evidencia" : "Evidence Library"} (
            {enrichedEvidence.length})
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEs
              ? "Repositorio central de todos los elementos de evidencia recuperados; filtra por fuente, estado de verificación o tipo de señal."
              : "Central repository of all discovered EvidenceItems — filter and browse by source, verification status, or signal type."}
          </p>
        </div>

        <Link
          to="/app"
          className="px-3.5 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 text-center"
        >
          {t("nav.findLeads")}
        </Link>
      </div>

      {/* Filter Controls */}
      <div className="bg-card rounded-lg border border-border p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        <div className="md:col-span-4 flex items-center gap-1.5">
          {[
            { id: "all", label: isEs ? "Todas" : "All" },
            { id: "verified", label: t("common.verified") },
            { id: "needs_review", label: t("common.needsReview") },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setVerificationFilter(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                verificationFilter === tab.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="md:col-span-4">
          <select
            aria-label={isEs ? "Filtrar por tipo de señal" : "Filter by signal type"}
            value={signalFilter}
            onChange={(e) => setSignalFilter(e.target.value)}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs text-foreground"
          >
            <option value="all">
              {isEs ? "Todos los tipos de señal" : "All signal types"}
            </option>
            {distinctSignals.map((sig) => (
              <option key={sig} value={sig}>
                {formatSignalTypeLabel(sig, lang)}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isEs
                ? "Buscar por fuente, negocio o extracto..."
                : "Search by source, business, or excerpt..."
            }
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {filteredEvidence.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-8 text-center space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            {isEs
              ? "No se encontraron elementos de evidencia"
              : "No evidence items match your filters"}
          </h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {isEs
              ? "Ejecuta búsquedas en Buscar leads para poblar tu biblioteca de evidencia verificada."
              : "Run discovery searches in Find leads to populate your evidence repository."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvidence.map((ev) => {
            const isVerified = ev.verification_status === "verified";
            const recencyLabel = formatRecencyBasisLabel(ev.recency_basis, lang);
            const signalLabel = formatSignalTypeLabel(ev.signal_type, lang);
            const supportTranslation = getExcerptSupportTranslation(ev, lang);
            const verificationNotesText = formatVerificationNotes(ev, lang);

            return (
              <article
                key={ev.id}
                className="bg-card text-card-foreground rounded-lg border border-border p-5 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                          isVerified
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                            : "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35"
                        }`}
                      >
                        {isVerified ? t("common.verified") : t("common.needsReview")}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/15 text-primary border border-primary/30">
                        {signalLabel}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs bg-secondary text-muted-foreground border border-border">
                        {recencyLabel}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-foreground break-words">
                      {ev.business_name}{" "}
                      {ev.location && (
                        <span className="font-normal text-muted-foreground">
                          · {ev.location}
                        </span>
                      )}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={safePublicUrl(ev.source_url)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-md text-xs font-medium bg-secondary text-foreground border border-border hover:bg-secondary/80"
                    >
                      {t("detail.openSourceLink")}
                    </a>
                    {ev.opportunity_id && (
                      <Link
                        to="/opportunities/$opportunityId"
                        params={{ opportunityId: ev.opportunity_id }}
                        className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {t("card.viewDetailsBtn")}
                      </Link>
                    )}
                  </div>
                </div>

                <div className="bg-secondary/50 rounded-md p-3.5 border border-border space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-foreground break-words">{ev.source_title}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {formatOriginalExcerptBadge(ev.supporting_excerpt, lang)}
                    </span>
                  </div>
                  <blockquote className="text-xs italic text-muted-foreground border-l-2 border-primary/50 pl-2.5 break-words">
                    {ev.supporting_excerpt}
                  </blockquote>
                  {supportTranslation && (
                    <div className="rounded bg-card/70 border border-border/70 px-2.5 py-1.5 space-y-0.5">
                      <span className="block text-[10px] font-mono text-primary">
                        {t("common.optionalTranslationBadge")}
                      </span>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {supportTranslation}
                      </p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-4 text-[11px] font-mono text-muted-foreground pt-1">
                    <span>
                      {t("common.published")}:{" "}
                      {formatDateValue(ev.publication_date, lang)}
                    </span>
                    <span>
                      {t("common.eventDate")}: {formatDateValue(ev.event_date, lang)}
                    </span>
                    <span>
                      {t("common.retrieved")}:{" "}
                      {ev.retrieval_date
                        ? String(ev.retrieval_date).replace("T", " ").slice(0, 16) +
                          " UTC"
                        : t("common.notStated")}
                    </span>
                  </div>
                  {verificationNotesText && (
                    <p
                      className={`text-[11px] pt-1 ${
                        isVerified
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-amber-800 dark:text-amber-300 font-medium"
                      }`}
                    >
                      {verificationNotesText}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}