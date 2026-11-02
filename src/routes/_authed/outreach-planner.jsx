import { useState, useEffect } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Check, AlertTriangle } from "lucide-react";
import { normalizeServicesList } from "@/lib/leads-constants";
import { buildOutreachDraft } from "@/lib/i18n";
import {
  formatSignalTypeLabel,
  formatOriginalExcerptBadge,
  formatSignalSummary,
  getExcerptSupportTranslation,
  formatDateValue,
} from "@/lib/opportunity-copy";
import {
  getExtendedWorkspaceData,
  saveSavedOpportunityOutreach,
} from "@/lib/workspace-pages-fns";
import { usePreferences } from "@/lib/PreferencesContext";

export const Route = createFileRoute("/_authed/outreach-planner")({
  ssr: false,
  loader: () => getExtendedWorkspaceData(),
  head: () => ({
    meta: [
      { title: "Outreach drafts — GoLeads" },
      {
        name: "description",
        content:
          "Prepare, edit and save an introduction for a business you want to approach.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OutreachPlannerPage,
});

function detectServiceInDraft(draftText, servicesList = []) {
  if (!draftText || !Array.isArray(servicesList) || servicesList.length === 0) {
    return servicesList[0] || "";
  }
  const lowerDraft = String(draftText).toLowerCase();
  for (const svc of servicesList) {
    if (svc && lowerDraft.includes(svc.toLowerCase())) {
      return svc;
    }
  }
  return servicesList[0] || "";
}

function OutreachPlannerPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const saveOutreachFn = useServerFn(saveSavedOpportunityOutreach);
  const { lang, outreachLang, setOutreachLang, syncFromProfile, t } = usePreferences();
  const isEs = lang === "es";

  const savedLeads = data?.savedOpportunities || [];
  const profile = data?.profile;
  const selectedServices = normalizeServicesList(profile?.selected_services || []);
  const serviceDescription = profile?.service_description || "";

  const [selectedId, setSelectedId] = useState(savedLeads[0]?.id || "");
  const selectedLead =
    savedLeads.find((item) => item.id === selectedId) || savedLeads[0] || null;

  const [draftService, setDraftService] = useState(() =>
    detectServiceInDraft(selectedLead?.outreach_draft, selectedServices)
  );
  const [draftLang, setDraftLang] = useState(
    () => selectedLead?.outreach_draft_language || outreachLang || "en"
  );
  const [draftText, setDraftText] = useState("");
  const [baselineTemplate, setBaselineTemplate] = useState("");
  const [notesText, setNotesText] = useState("");
  const [reviewStage, setReviewStage] = useState("saved");
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusBanner, setStatusBanner] = useState("");
  const [bannerTone, setBannerTone] = useState("info");
  const [pendingReplace, setPendingReplace] = useState(null);

  useEffect(() => {
    if (profile) {
      syncFromProfile(profile);
    }
  }, [profile?.id]);

  useEffect(() => {
    document.title = isEs
      ? "Borradores de contacto — GoLeads"
      : "Outreach drafts — GoLeads";
  }, [isEs]);

  // Synchronize editor state ONLY when switching to a different saved lead
  useEffect(() => {
    setPendingReplace(null);
    setStatusBanner("");
    if (!selectedLead) {
      setDraftText("");
      setBaselineTemplate("");
      setNotesText("");
      return;
    }
    const initialLang =
      selectedLead.outreach_draft_language || outreachLang || "en";
    const matchedService = detectServiceInDraft(
      selectedLead.outreach_draft,
      selectedServices
    );
    const defaultGenerated = buildOutreachDraft(
      selectedLead,
      matchedService ? [matchedService] : selectedServices.slice(0, 1),
      serviceDescription,
      initialLang
    );
    const savedDraft =
      typeof selectedLead.outreach_draft === "string" &&
      selectedLead.outreach_draft.trim()
        ? selectedLead.outreach_draft
        : "";

    setDraftLang(initialLang);
    setDraftService(matchedService);
    setBaselineTemplate(defaultGenerated);
    setDraftText(savedDraft || defaultGenerated);
    setNotesText(selectedLead.qualification_notes || "");
    setReviewStage(selectedLead.review_stage || "saved");
  }, [selectedLead?.id]);

  const isDraftEdited =
    Boolean(draftText.trim()) &&
    draftText.trim() !== baselineTemplate.trim();

  const applyTemplateReplacement = (nextService, nextLang) => {
    if (!selectedLead) return;
    const svc = nextService !== undefined ? nextService : draftService;
    const lng = nextLang || draftLang;
    setDraftService(svc);
    setDraftLang(lng);
    setOutreachLang(lng);
    const fresh = buildOutreachDraft(
      selectedLead,
      svc ? [svc] : selectedServices.slice(0, 1),
      serviceDescription,
      lng
    );
    setBaselineTemplate(fresh);
    setDraftText(fresh);
    setPendingReplace(null);
  };

  const handleServiceChange = (e) => {
    const nextService = e.target.value;
    setDraftService(nextService);
    if (!selectedLead) return;

    if (!isDraftEdited) {
      const fresh = buildOutreachDraft(
        selectedLead,
        nextService ? [nextService] : selectedServices.slice(0, 1),
        serviceDescription,
        draftLang
      );
      setBaselineTemplate(fresh);
      setDraftText(fresh);
      setPendingReplace(null);
    } else {
      setPendingReplace({
        reason: "service",
        nextService,
        nextLang: draftLang,
      });
    }
  };

  const handleRequestTemplateUpdate = (targetLang) => {
    if (!selectedLead) return;
    const nextLang = targetLang || draftLang;
    if (isDraftEdited) {
      setPendingReplace({
        reason: nextLang !== draftLang ? "language" : "template",
        nextService: draftService,
        nextLang,
      });
      return;
    }
    applyTemplateReplacement(draftService, nextLang);
  };

  const handleSaveDraft = async (e) => {
    e.preventDefault();
    if (!selectedLead) return;
    setIsSaving(true);
    setStatusBanner("");
    setPendingReplace(null);
    try {
      if (!draftText.trim()) {
        throw new Error(
          isEs
            ? "El mensaje no puede estar vacío."
            : "The outreach message cannot be empty."
        );
      }
      await saveOutreachFn({
        data: {
          id: selectedLead.id,
          outreach_draft: draftText,
          outreach_draft_language: draftLang,
          qualification_notes: notesText,
          review_stage: reviewStage,
        },
      });
      await router.invalidate();
      setBannerTone("success");
      setStatusBanner(
        isEs
          ? `Borrador de contacto guardado para ${selectedLead.business_name} (${draftLang.toUpperCase()}).`
          : `Saved outreach draft for ${selectedLead.business_name} (${draftLang.toUpperCase()}).`
      );
    } catch (err) {
      setBannerTone("error");
      const detail = err?.message ? ` (${err.message})` : "";
      setStatusBanner(
        isEs
          ? `No pudimos guardar el borrador${detail}. Tu texto sigue en el editor; vuelve a intentarlo.`
          : `We could not save your draft${detail}. Your text is still in the editor; please try again.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!draftText.trim()) {
      setCopied(false);
      setBannerTone("error");
      setStatusBanner(
        isEs
          ? "No hay texto para copiar en el borrador."
          : "There is no draft text to copy."
      );
      return;
    }
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(draftText);
      setCopied(true);
      setBannerTone("success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setBannerTone("error");
      setStatusBanner(
        isEs
          ? "No pudimos copiar el mensaje automáticamente. Selecciona el texto del recuadro y cópialo manualmente."
          : "We could not copy the message automatically. Please select the text in the box and copy it manually."
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {isEs ? "Borradores de contacto" : "Outreach drafts"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEs
              ? "Elige un negocio y el servicio que quieres presentar. Edita esta plantilla de primer contacto y guárdala para cuando decidas escribirles."
              : "Choose a business and the service you want to introduce. Edit this first-contact template and save it for when you are ready to reach out."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/saved"
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-secondary text-foreground border border-border hover:bg-secondary/80"
          >
            {t("nav.savedLeads")} ({savedLeads.length})
          </Link>
          <Link
            to="/app"
            className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {t("nav.findLeads")}
          </Link>
        </div>
      </div>

      {statusBanner && (
        <div
          role={bannerTone === "error" ? "alert" : "status"}
          className={`px-4 py-2.5 rounded-md border text-xs flex items-center justify-between gap-3 ${
            bannerTone === "error"
              ? "bg-destructive/15 border-destructive/35 text-destructive"
              : "bg-primary/15 border-primary/30 text-foreground"
          }`}
        >
          <span>{statusBanner}</span>
          <button
            type="button"
            onClick={() => setStatusBanner("")}
            className="underline font-medium shrink-0"
          >
            {t("common.dismiss")}
          </button>
        </div>
      )}

      {savedLeads.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-8 text-center space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            {isEs
              ? "Guarda un negocio para preparar tu primer contacto"
              : "Save a business to prepare your first introduction"}
          </h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {isEs
              ? "Busca oportunidades y guarda un negocio que te interese. Aquí podrás preparar una plantilla editable y conservar tus notas."
              : "Find opportunities and save a business that interests you. Then come here to prepare an editable template and keep your notes."}
          </p>
          <Link
            to="/app"
            className="inline-block px-4 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground"
          >
            {t("nav.findLeads")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Saved Leads Selector */}
          <aside className="lg:col-span-4 space-y-2 min-w-0">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              {isEs ? "Oportunidades guardadas" : "Saved opportunities"} (
              {savedLeads.length})
            </div>
            <div className="space-y-2">
              {savedLeads.map((lead) => {
                const active = selectedLead?.id === lead.id;
                const hasSavedDraft = Boolean(lead.outreach_draft?.trim());
                const sigLabel = formatSignalTypeLabel(lead.signal_type, lang);
                return (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => setSelectedId(lead.id)}
                    className={`w-full text-left p-3.5 rounded-lg border transition-colors space-y-1 min-w-0 ${
                      active
                        ? "bg-primary/15 border-primary text-foreground"
                        : "bg-card border-border text-foreground hover:bg-secondary/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold truncate">
                        {lead.business_name}
                      </span>
                      {hasSavedDraft && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                          {isEs ? "Guardado" : "Saved draft"}
                          {lead.outreach_draft_language
                            ? ` (${lead.outreach_draft_language.toUpperCase()})`
                            : ""}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {lead.location} · {sigLabel}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right Column: Outreach Editor & Grounding Evidence */}
          {selectedLead && (
            <section className="lg:col-span-8 bg-card rounded-lg border border-border p-4 sm:p-5 space-y-5 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-primary/15 text-primary border border-primary/30">
                      {isEs
                        ? "Plantilla editable de primer contacto"
                        : "Editable first-contact template"}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-secondary text-muted-foreground border border-border">
                      {formatSignalTypeLabel(selectedLead.signal_type, lang)}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-foreground break-words">
                    {selectedLead.business_name}
                  </h2>
                  <p className="text-xs text-muted-foreground break-words">
                    {selectedLead.location}
                  </p>
                </div>
                <Link
                  to="/opportunities/$opportunityId"
                  params={{ opportunityId: selectedLead.opportunity_id }}
                  className="text-xs font-medium text-primary hover:underline shrink-0"
                >
                  {t("card.viewDetailsBtn")}
                </Link>
              </div>

              {/* Grounding Evidence Excerpt */}
              <div className="bg-secondary/50 rounded-md border border-border p-3.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-foreground">
                    {t("card.recoveredEvidenceTitle")}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {formatOriginalExcerptBadge(selectedLead.supporting_excerpt, lang)}
                  </span>
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed">
                  {formatSignalSummary(selectedLead, lang)}
                </p>
                <blockquote className="text-xs italic text-muted-foreground border-l-2 border-primary/50 pl-2.5 break-words">
                  {selectedLead.supporting_excerpt}
                </blockquote>
                {getExcerptSupportTranslation(selectedLead, lang) && (
                  <div className="rounded bg-card/70 border border-border/70 px-2.5 py-1.5 space-y-0.5">
                    <span className="block text-[10px] font-mono text-primary">
                      {t("common.optionalTranslationBadge")}
                    </span>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {getExcerptSupportTranslation(selectedLead, lang)}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap gap-3 text-[11px] font-mono text-muted-foreground pt-1">
                  <span>
                    {t("common.published")}:{" "}
                    {formatDateValue(selectedLead.publication_date, lang)}
                  </span>
                  <span>
                    {t("common.eventDate")}:{" "}
                    {formatDateValue(selectedLead.event_date, lang)}
                  </span>
                </div>
              </div>

              {/* Outreach Template Form */}
              <form onSubmit={handleSaveDraft} className="space-y-4">
                {selectedServices.length > 0 && (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="outreach-service"
                      className="block text-xs font-semibold text-foreground"
                    >
                      {isEs ? "Servicio que quieres ofrecer" : "Service to introduce"}
                    </label>
                    <select
                      id="outreach-service"
                      value={draftService}
                      onChange={handleServiceChange}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {selectedServices.map((service) => (
                        <option key={service} value={service}>
                          {service}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {isEs
                        ? "El mensaje incluye únicamente el servicio elegido (sin añadir otros automáticamente). Esta función prepara una plantilla breve editable, no una propuesta comercial completa."
                        : "The message uses only your selected service (without adding others automatically). This feature prepares a short editable template, not a full commercial proposal."}
                    </p>
                  </div>
                )}

                {pendingReplace && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-xs space-y-2.5"
                  >
                    <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-semibold">
                          {isEs
                            ? "Has editado el texto de este borrador"
                            : "You have edited this draft's text"}
                        </p>
                        <p className="text-muted-foreground">
                          {isEs
                            ? `¿Quieres reemplazar tu texto actual con una plantilla nueva en ${pendingReplace.nextLang.toUpperCase()}${
                                pendingReplace.nextService
                                  ? ` para "${pendingReplace.nextService}"`
                                  : ""
                              }, o prefieres conservar lo que escribiste?`
                            : `Do you want to replace your current text with a new ${pendingReplace.nextLang.toUpperCase()} template${
                                pendingReplace.nextService
                                  ? ` for "${pendingReplace.nextService}"`
                                  : ""
                              }, or keep what you wrote?`}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pl-6">
                      <button
                        type="button"
                        onClick={() =>
                          applyTemplateReplacement(
                            pendingReplace.nextService,
                            pendingReplace.nextLang
                          )
                        }
                        className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {isEs ? "Reemplazar mi texto" : "Replace my text"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (pendingReplace.nextLang !== draftLang) {
                            setDraftLang(pendingReplace.nextLang);
                            setOutreachLang(pendingReplace.nextLang);
                          }
                          setPendingReplace(null);
                        }}
                        className="px-3 py-1.5 rounded-md text-xs font-medium bg-card text-foreground border border-border hover:bg-secondary"
                      >
                        {isEs ? "Conservar mi texto" : "Keep my text"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label
                    htmlFor="outreach-draft-textarea"
                    className="text-xs font-semibold text-foreground"
                  >
                    {isEs ? "Tu mensaje" : "Your message"}
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {t("common.outreachLangLabel")}:
                    </span>
                    <div
                      role="group"
                      aria-label={t("common.outreachLangLabel")}
                      className="inline-flex rounded-md border border-border bg-secondary p-0.5 text-xs"
                    >
                      {[
                        { code: "en", label: "EN" },
                        { code: "es", label: "ES" },
                      ].map((opt) => (
                        <button
                          key={opt.code}
                          type="button"
                          aria-pressed={draftLang === opt.code}
                          onClick={() => handleRequestTemplateUpdate(opt.code)}
                          className={`px-2.5 py-1 rounded-sm font-mono text-[11px] font-medium ${
                            draftLang === opt.code
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRequestTemplateUpdate(draftLang)}
                      className="px-2.5 py-1 rounded text-xs font-medium text-primary hover:bg-primary/10 border border-primary/25"
                    >
                      {isEs ? "Actualizar plantilla" : "Update template"}
                    </button>
                  </div>
                </div>

                <textarea
                  id="outreach-draft-textarea"
                  rows={7}
                  maxLength={4000}
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  className="w-full p-3.5 rounded-md border border-input bg-background text-xs sm:text-sm text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="outreach-review-stage"
                      className="block text-xs font-medium text-foreground mb-1"
                    >
                      {t("detail.reviewStageLabel")}
                    </label>
                    <select
                      id="outreach-review-stage"
                      value={reviewStage}
                      onChange={(e) => setReviewStage(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-md border border-input bg-background text-xs text-foreground"
                    >
                      <option value="saved">{t("saved.stages.saved")}</option>
                      <option value="researching">
                        {t("saved.stages.researching")}
                      </option>
                      <option value="qualified">{t("saved.stages.qualified")}</option>
                      <option value="archived">{t("saved.stages.archived")}</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="outreach-private-notes"
                      className="block text-xs font-medium text-foreground mb-1"
                    >
                      {t("saved.privateNotesLabel")}
                    </label>
                    <input
                      id="outreach-private-notes"
                      type="text"
                      maxLength={1000}
                      value={notesText}
                      onChange={(e) => setNotesText(e.target.value)}
                      placeholder={t("saved.privateNotesPlaceholder")}
                      className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs text-foreground"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium bg-secondary text-foreground border border-border hover:bg-secondary/80"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        {t("detail.copiedOutreachMsg")}
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        {t("detail.copyOutreachBtn")}
                      </>
                    )}
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isSaving
                      ? t("common.saving")
                      : isEs
                      ? "Guardar borrador de contacto"
                      : "Save outreach draft"}
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      )}
    </div>
  );
}