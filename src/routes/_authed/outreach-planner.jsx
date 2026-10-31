import { useState, useEffect } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Check } from "lucide-react";
import { normalizeServicesList } from "@/lib/leads-constants";
import { buildOutreachDraft } from "@/lib/i18n";
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
      { title: "Lead Outreach Planner — goleads.app" },
      {
        name: "description",
        content:
          "Draft and save personalized, evidence-grounded outreach messages for your saved leads.",
      },
    ],
  }),
  component: OutreachPlannerPage,
});

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

  const [draftText, setDraftText] = useState("");
  const [notesText, setNotesText] = useState("");
  const [reviewStage, setReviewStage] = useState("saved");
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusBanner, setStatusBanner] = useState("");

  useEffect(() => {
    if (profile) {
      syncFromProfile(profile);
    }
  }, [profile?.id]);

  useEffect(() => {
    document.title = isEs
      ? "Planificador de contacto — goleads.app"
      : "Lead Outreach Planner — goleads.app";
  }, [isEs]);

  useEffect(() => {
    if (!selectedLead) {
      setDraftText("");
      setNotesText("");
      return;
    }
    const defaultGenerated = buildOutreachDraft(
      selectedLead,
      selectedServices,
      serviceDescription,
      selectedLead.outreach_draft_language || outreachLang
    );
    setDraftText(selectedLead.outreach_draft || defaultGenerated);
    setNotesText(selectedLead.qualification_notes || "");
    setReviewStage(selectedLead.review_stage || "saved");
  }, [selectedLead?.id]);

  const handleRegenerateTemplate = (targetLang) => {
    if (!selectedLead) return;
    const nextLang = targetLang || outreachLang;
    setOutreachLang(nextLang);
    const fresh = buildOutreachDraft(
      selectedLead,
      selectedServices,
      serviceDescription,
      nextLang
    );
    setDraftText(fresh);
  };

  const handleSaveDraft = async (e) => {
    e.preventDefault();
    if (!selectedLead) return;
    setIsSaving(true);
    setStatusBanner("");
    try {
      await saveOutreachFn({
        data: {
          id: selectedLead.id,
          outreach_draft: draftText,
          outreach_draft_language: outreachLang,
          qualification_notes: notesText,
          review_stage: reviewStage,
        },
      });
      await router.invalidate();
      setStatusBanner(
        isEs
          ? `Borrador de contacto guardado para ${selectedLead.business_name}.`
          : `Saved personalized outreach draft for ${selectedLead.business_name}.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!draftText) return;
    try {
      await navigator.clipboard.writeText(draftText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setStatusBanner(t("detail.copiedOutreachMsg"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {isEs ? "Planificador de contacto" : "Lead Outreach Planner"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEs
              ? "Redacta y guarda plantillas de contacto personalizadas basadas en evidencia para tus oportunidades guardadas."
              : "Draft and save personalized, evidence-grounded outreach messages for your saved opportunities."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/saved"
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-secondary text-foreground border border-border hover:bg-secondary/80"
          >
            {t("nav.savedLeads")} ({savedLeads.length})
          </Link>
          <Link
            to="/"
            className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {t("nav.findLeads")}
          </Link>
        </div>
      </div>

      {statusBanner && (
        <div
          role="status"
          className="px-4 py-2.5 rounded-md bg-primary/15 border border-primary/30 text-xs text-foreground flex items-center justify-between"
        >
          <span>{statusBanner}</span>
          <button
            type="button"
            onClick={() => setStatusBanner("")}
            className="text-primary hover:underline font-medium"
          >
            {t("common.dismiss")}
          </button>
        </div>
      )}

      {savedLeads.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-8 text-center space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            {isEs
              ? "Aún no tienes oportunidades guardadas para planificar contacto"
              : "No saved opportunities to plan outreach for yet"}
          </h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {isEs
              ? "Guarda al menos un prospecto desde Buscar leads para redactar y almacenar mensajes personalizados aquí."
              : "Save at least one prospect from Find leads to draft and store personalized outreach templates here."}
          </p>
          <Link
            to="/"
            className="inline-block px-4 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground"
          >
            {t("nav.findLeads")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Saved Leads Selector */}
          <aside className="lg:col-span-4 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              {isEs ? "Oportunidades guardadas" : "Saved opportunities"} (
              {savedLeads.length})
            </div>
            <div className="space-y-2">
              {savedLeads.map((lead) => {
                const active = selectedLead?.id === lead.id;
                const hasSavedDraft = Boolean(lead.outreach_draft?.trim());
                return (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => setSelectedId(lead.id)}
                    className={`w-full text-left p-3.5 rounded-lg border transition-colors space-y-1 ${
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
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {lead.location} · {lead.signal_type}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right Column: Outreach Editor & Grounding Evidence */}
          {selectedLead && (
            <section className="lg:col-span-8 bg-card rounded-lg border border-border p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {selectedLead.business_name}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedLead.location} · {selectedLead.signal_type}
                  </p>
                </div>
                <Link
                  to="/opportunities/$opportunityId"
                  params={{ opportunityId: selectedLead.opportunity_id }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t("card.viewDetailsBtn")}
                </Link>
              </div>

              {/* Grounding Evidence Excerpt */}
              <div className="bg-secondary/50 rounded-md border border-border p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    {t("card.recoveredEvidenceTitle")}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {t("common.originalLanguageBadge")}
                  </span>
                </div>
                <blockquote className="text-xs italic text-muted-foreground border-l-2 border-primary/50 pl-2.5">
                  {selectedLead.supporting_excerpt}
                </blockquote>
              </div>

              {/* Outreach Template Form */}
              <form onSubmit={handleSaveDraft} className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label
                    htmlFor="outreach-draft-textarea"
                    className="text-xs font-semibold text-foreground"
                  >
                    {isEs
                      ? "Plantilla de contacto personalizada"
                      : "Personalized outreach draft"}
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {t("common.outreachLangLabel")}:
                    </span>
                    <div className="inline-flex rounded-md border border-border bg-secondary p-0.5 text-xs">
                      {[
                        { code: "en", label: "EN" },
                        { code: "es", label: "ES" },
                      ].map((opt) => (
                        <button
                          key={opt.code}
                          type="button"
                          onClick={() => handleRegenerateTemplate(opt.code)}
                          className={`px-2.5 py-1 rounded-sm font-mono text-[11px] font-medium ${
                            outreachLang === opt.code
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
                      onClick={() => handleRegenerateTemplate(outreachLang)}
                      className="px-2.5 py-1 rounded text-xs font-medium text-primary hover:bg-primary/10"
                    >
                      {isEs ? "Restaurar plantilla base" : "Reset to base template"}
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
                    <label className="block text-xs font-medium text-foreground mb-1">
                      {t("detail.reviewStageLabel")}
                    </label>
                    <select
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
                    <label className="block text-xs font-medium text-foreground mb-1">
                      {t("saved.privateNotesLabel")}
                    </label>
                    <input
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