import { Link } from "@tanstack/react-router";
import { safePublicUrl } from "@/lib/public-url";
import {
  buildServiceFitHypothesis,
  formatRecencyBasisLabel,
} from "@/lib/leads-constants";
import {
  formatSignalTypeLabel,
  formatBusinessCategoryLabel,
  formatDateValue,
  formatOriginalExcerptBadge,
  formatSignalSummary,
  getExcerptSupportTranslation,
  formatVerificationNotes,
  buildSourceVerificationDetails,
} from "@/lib/opportunity-copy";
import { usePreferences } from "@/lib/PreferencesContext";
import { trackLeadsEvent } from "@/lib/telemetry";

export default function OpportunityCard({
  opp,
  selectedServices = [],
  serviceDescription = "",
  isExample = false,
  isSaved = false,
  isDismissed = false,
  isSelected = false,
  feedbackVerdict = null,
  feedbackRecordedAt = null,
  isBusy = false,
  detailSearchParams = {},
  onToggleSelect,
  onSave,
  onUnsave,
  onDismiss,
  onRestore,
}) {
  const { lang, t } = usePreferences();
  const isEs = lang === "es";
  const isVerified = opp.verification_status === "verified";
  const fitText = buildServiceFitHypothesis(opp, selectedServices, serviceDescription, lang);
  const recencyLabel = formatRecencyBasisLabel(opp.recency_basis, lang);
  const signalLabel = formatSignalTypeLabel(opp.signal_type, lang);
  const categoryLabel = formatBusinessCategoryLabel(opp.business_category, lang);
  const summaryText = formatSignalSummary(opp, lang);
  const excerptSupportTranslation = getExcerptSupportTranslation(opp, lang);
  const verificationNotesText = formatVerificationNotes(opp, lang);
  const sourceDetails = buildSourceVerificationDetails(
    opp,
    opp.evidence_items || [],
    lang
  );

  const formattedRetrieval = opp.retrieval_date
    ? String(opp.retrieval_date).replace("T", " ").slice(0, 16) +
      (String(opp.retrieval_date).includes("T") ? " UTC" : "")
    : t("common.notStated");

  const handleSourceClick = (e) => {
    e.stopPropagation();
    trackLeadsEvent(
      "source_opened",
      {
        verification_status: opp.verification_status || "needs_review",
        recency_basis: opp.recency_basis || "unverified_date",
        surface: "discover_card",
      },
      { isExample, opportunityId: opp.id }
    );
  };

  return (
    <article
      data-opportunity-id={opp.id}
      className={`bg-card text-card-foreground rounded-lg border p-5 space-y-3.5 transition-colors ${
        isSelected
          ? "border-primary ring-1 ring-primary/40 bg-primary/5"
          : isVerified
          ? "border-border hover:border-primary/40"
          : "border-amber-500/40 bg-amber-500/5"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {onToggleSelect && (
            <div className="pt-0.5 shrink-0">
              <input
                type="checkbox"
                id={`select-opp-${opp.id}`}
                checked={Boolean(isSelected)}
                disabled={isBusy}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggleSelect(opp.id);
                }}
                aria-label={t("card.selectLeadAria", { name: opp.business_name })}
                className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring cursor-pointer disabled:opacity-50"
              />
            </div>
          )}

          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {/* 1. Factual Source Verification Status (Never modified by user commercial rating) */}
              <span
                className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                  isVerified
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35"
                }`}
                title={
                  isEs
                    ? "Estado de verificación factual de la fuente (independiente de tu calificación comercial)"
                    : "Factual source verification status (independent of your commercial rating)"
                }
              >
                {isVerified ? t("common.verified") : t("common.needsReview")}
              </span>

              <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/15 text-primary border border-primary/30">
                {signalLabel}
              </span>

              <span className="px-2 py-0.5 rounded text-xs text-muted-foreground bg-secondary border border-border">
                {recencyLabel}
              </span>

              {/* 2. User Commercial Evaluation (Explicitly attributed to the user) */}
              {feedbackVerdict === "relevant" && (
                <span
                  className="px-2 py-0.5 rounded text-xs font-medium bg-primary/15 text-primary border border-primary/35"
                  title={
                    feedbackRecordedAt
                      ? `${isEs ? "Evaluación comercial guardada por ti:" : "Commercial rating saved by you:"} ${String(feedbackRecordedAt).slice(0, 16).replace("T", " ")} UTC`
                      : isEs
                      ? "Evaluación comercial elegida manualmente por ti (no cambia la verificación de la fuente)"
                      : "Commercial rating chosen manually by you (does not change source verification)"
                  }
                >
                  {t("card.ratedRelevant")}
                </span>
              )}

              {isDismissed && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-secondary text-muted-foreground border border-border">
                  {t("card.dismissedBadge")}
                </span>
              )}

              {isExample && (
                <span className="px-2 py-0.5 rounded text-xs font-semibold text-primary bg-primary/10 border border-primary/30">
                  {t("common.exampleBadge")}
                </span>
              )}
            </div>

            <h3 className="text-base font-semibold text-foreground break-words">
              {opp.business_name}
            </h3>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{opp.location}</span>
              {categoryLabel && (
                <>
                  <span>·</span>
                  <span>{categoryLabel}</span>
                </>
              )}
              <span>·</span>
              {opp.website_url ? (
                <a
                  href={safePublicUrl(opp.website_url)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-primary hover:underline font-medium"
                >
                  {t("common.website")}
                </a>
              ) : (
                <span className="text-muted-foreground/80">{t("common.websiteUnknown")}</span>
              )}
              {opp.public_email && (
                <>
                  <span>·</span>
                  <a
                    href={`mailto:${opp.public_email}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-primary hover:underline font-medium break-all"
                    title={isEs ? "Correo público disponible" : "Public email available"}
                  >
                    {opp.public_email}
                  </a>
                </>
              )}
              {opp.public_phone && (
                <>
                  <span>·</span>
                  <a
                    href={`tel:${opp.public_phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-primary hover:underline font-medium"
                    title={isEs ? "Teléfono público disponible" : "Public phone available"}
                  >
                    {opp.public_phone}
                  </a>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {(onSave || onUnsave) && (
            <button
              type="button"
              disabled={isBusy}
              onClick={(e) => {
                e.stopPropagation();
                if (isSaved && onUnsave) {
                  onUnsave(opp);
                } else if (onSave) {
                  onSave(opp);
                }
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 ${
                isSaved
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25"
                  : "bg-card text-foreground border-border hover:bg-secondary"
              }`}
              title={isSaved ? t("card.unsaveTitle") : t("card.saveTitle")}
            >
              {isSaved ? t("card.savedUnsaveBtn") : t("card.saveLeadBtn")}
            </button>
          )}

          <Link
            to="/opportunities/$opportunityId"
            params={{ opportunityId: opp.id }}
            search={detailSearchParams}
            onClick={(e) => e.stopPropagation()}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {t("card.viewDetailsBtn")}
          </Link>

          {isDismissed && onRestore ? (
            <button
              type="button"
              disabled={isBusy}
              onClick={(e) => {
                e.stopPropagation();
                onRestore(opp);
              }}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium text-primary hover:bg-primary/10 border border-primary/30 transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              {t("card.restoreLeadBtn")}
            </button>
          ) : (
            onDismiss && (
              <button
                type="button"
                disabled={isBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(opp);
                }}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/70 transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                {t("card.notRelevantBtn")}
              </button>
            )
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-border/70">
        {/* Source Evidence Column — keeps supporting_excerpt in original language */}
        <div className="md:col-span-7 bg-secondary/50 rounded-md p-3 border border-border space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium text-foreground">{t("card.recoveredEvidenceTitle")}</span>
            <a
              href={safePublicUrl(opp.source_url)}
              target="_blank"
              rel="noreferrer"
              onClick={handleSourceClick}
              className="text-primary hover:underline font-medium truncate max-w-[260px]"
              title={opp.source_title}
            >
              {opp.source_title}
            </a>
          </div>

          <p className="text-xs text-foreground/90 leading-relaxed">{summaryText}</p>

          {opp.supporting_excerpt && (
            <div className="space-y-1.5">
              <span className="inline-block text-[10px] font-mono text-muted-foreground">
                {sourceDetails.isBlockedWithoutFullBackup
                  ? isEs
                    ? "Extracto sugerido en búsqueda (página bloqueada — sin lectura directa)"
                    : "Search snippet excerpt (page blocked — not read directly)"
                  : formatOriginalExcerptBadge(opp.supporting_excerpt, lang)}
              </span>
              <blockquote className="text-xs italic text-muted-foreground border-l-2 border-primary/50 pl-2.5 py-0.5 break-words">
                {opp.supporting_excerpt}
              </blockquote>
              {excerptSupportTranslation && (
                <div className="rounded bg-card/70 border border-border/70 px-2.5 py-1.5 space-y-0.5">
                  <span className="block text-[10px] font-mono text-primary">
                    {t("common.optionalTranslationBadge")}
                  </span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {excerptSupportTranslation}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono text-muted-foreground pt-1">
            <span>
              {t("common.published")}: {formatDateValue(opp.publication_date, lang)}
            </span>
            <span>
              {t("common.eventDate")}: {formatDateValue(opp.event_date, lang)}
            </span>
            <span>
              {t("common.retrieved")}: {formattedRetrieval}
            </span>
          </div>

          <div className="text-[11px] font-mono text-muted-foreground pt-0.5">
            {sourceDetails.lastCheckedLabel}
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

          {sourceDetails.alternativeSummary && (
            <div className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1.5 text-[11px] text-emerald-800 dark:text-emerald-200 leading-relaxed">
              {sourceDetails.alternativeSummary}
            </div>
          )}

          {sourceDetails.localSummary && (
            <div className="rounded bg-card/80 border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground leading-relaxed">
              {sourceDetails.localSummary}
            </div>
          )}
        </div>

        {/* Service Fit Hypothesis + Matched Google Places Venue Column */}
        <div className="md:col-span-5 space-y-2.5">
          {(opp.place_address || opp.place_url || opp.place_name) && (
            <div className="bg-secondary/60 rounded-md p-3 border border-border space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-foreground">
                  {isEs ? "Google Places (mismo local)" : "Google Places (same venue)"}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  {opp.place_business_status === "CLOSED_TEMPORARILY"
                    ? isEs
                      ? "Cerrado temp."
                      : "Temp. closed"
                    : opp.place_business_status === "CLOSED_PERMANENTLY"
                    ? isEs
                      ? "Cerrado"
                      : "Closed"
                    : isEs
                    ? "Local activo"
                    : "Active venue"}
                </span>
              </div>
              {opp.place_name && opp.place_name !== opp.business_name && (
                <p className="text-xs font-medium text-foreground">{opp.place_name}</p>
              )}
              {opp.place_address && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {opp.place_address}
                </p>
              )}
              {opp.place_url && (
                <a
                  href={safePublicUrl(opp.place_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                >
                  {isEs ? "Ver ficha del local en Google Maps ↗" : "View venue on Google Maps ↗"}
                </a>
              )}
            </div>
          )}

          <div className="bg-accent/60 rounded-md p-3 border border-primary/25 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{t("card.possibleServiceFitTitle")}</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-primary/15 text-primary border border-primary/30">
                {t("common.hypothesisBadge")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{fitText}</p>
          </div>
        </div>
      </div>
    </article>
  );
}