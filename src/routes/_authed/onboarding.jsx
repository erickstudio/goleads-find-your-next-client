import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { SERVICE_EXAMPLES, normalizeServicesList } from "@/lib/leads-constants";
import { getWorkspaceBootstrap, saveUserProfile } from "@/lib/server-fns";
import { usePreferences } from "@/lib/PreferencesContext";

export const Route = createFileRoute("/_authed/onboarding")({
  ssr: false,
  loader: () => getWorkspaceBootstrap(),
  head: () => ({
    meta: [
      { title: "Your services — goleads.app" },
      { name: "description", content: "Add and edit the business services you offer." },
    ],
  }),
  component: ServicesScreen,
});

function ServicesScreen() {
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const saveProfileFn = useServerFn(saveUserProfile);
  const {
    lang,
    setLang,
    outreachLang,
    setOutreachLang,
    theme,
    setTheme,
    syncFromProfile,
    t,
  } = usePreferences();

  const initialServices = normalizeServicesList(data?.profile?.selected_services || []);

  const [services, setServices] = useState(initialServices);
  const [newServiceInput, setNewServiceInput] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [serviceDescription, setServiceDescription] = useState(
    data?.profile?.service_description || ""
  );
  const [defaultWindow, setDefaultWindow] = useState(
    data?.profile?.default_time_window_days || 90
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    if (data?.profile) {
      syncFromProfile(data.profile);
    }
  }, [data?.profile?.id]);

  useEffect(() => {
    document.title = t("onboarding.pageTitle");
  }, [lang, t]);

  const addServiceName = (rawName) => {
    const trimmed = (rawName || "").trim();
    if (!trimmed) return;
    const next = normalizeServicesList([...services, trimmed]);
    if (next.length === services.length) {
      setStatusMsg(t("onboarding.alreadyInListMsg", { service: trimmed }));
      return;
    }
    setServices(next);
    setNewServiceInput("");
    setErrorMsg("");
    setStatusMsg("");
  };

  const handleAddInputKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addServiceName(newServiceInput);
    }
  };

  const startEditing = (idx) => {
    setEditingIndex(idx);
    setEditingValue(services[idx] || "");
    setErrorMsg("");
    setStatusMsg("");
  };

  const commitEdit = (idx) => {
    const trimmed = editingValue.trim();
    if (!trimmed) {
      setServices((prev) => prev.filter((_, i) => i !== idx));
      setEditingIndex(null);
      setEditingValue("");
      return;
    }
    const updated = services.map((item, i) => (i === idx ? trimmed : item));
    setServices(normalizeServicesList(updated));
    setEditingIndex(null);
    setEditingValue("");
  };

  const removeService = (idx) => {
    setServices((prev) => prev.filter((_, i) => i !== idx));
    if (editingIndex === idx) {
      setEditingIndex(null);
      setEditingValue("");
    }
    setErrorMsg("");
    setStatusMsg("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const pendingList = newServiceInput.trim()
      ? normalizeServicesList([...services, newServiceInput.trim()])
      : normalizeServicesList(services);

    if (pendingList.length === 0) {
      setErrorMsg(t("onboarding.validationMinOne"));
      return;
    }

    setIsSaving(true);
    setErrorMsg("");
    setStatusMsg("");
    try {
      await saveProfileFn({
        data: {
          selected_services: pendingList,
          service_description: serviceDescription.trim(),
          default_time_window_days: defaultWindow,
          ui_language: lang,
          outreach_language: outreachLang,
          theme_preference: theme,
        },
      });
      setServices(pendingList);
      setNewServiceInput("");
      await router.invalidate();
      setStatusMsg(t("onboarding.savedSuccessMsg"));
    } catch (err) {
      setErrorMsg(err?.message || t("onboarding.saveErrorFallback"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("onboarding.heading")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("onboarding.subheading")}
          </p>
        </div>
        <Link
          to="/"
          className="text-xs font-medium text-primary hover:underline shrink-0"
        >
          {t("onboarding.backToDiscover")}
        </Link>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-card text-card-foreground rounded-lg border border-border p-5 sm:p-6 space-y-6"
      >
        {/* Add custom service input */}
        <div className="space-y-2">
          <label
            htmlFor="custom-service-input"
            className="block text-sm font-medium text-foreground"
          >
            {t("onboarding.servicesOfferedLabel")}
          </label>
          <div className="flex gap-2">
            <input
              id="custom-service-input"
              type="text"
              value={newServiceInput}
              onChange={(e) => setNewServiceInput(e.target.value)}
              onKeyDown={handleAddInputKeyDown}
              placeholder={t("onboarding.serviceInputPlaceholder")}
              className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => addServiceName(newServiceInput)}
              className="px-4 h-10 rounded-md text-sm font-medium bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors focus:outline-none focus:ring-2 focus:ring-ring shrink-0"
            >
              {t("onboarding.addServiceBtn")}
            </button>
          </div>

          {/* Optional examples */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-muted-foreground mr-1">
              {t("onboarding.examplesLabel")}
            </span>
            {SERVICE_EXAMPLES.map((example) => {
              const isAdded = services.some(
                (s) => s.toLowerCase() === example.toLowerCase()
              );
              return (
                <button
                  key={example}
                  type="button"
                  disabled={isAdded}
                  onClick={() => addServiceName(example)}
                  className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                    isAdded
                      ? "bg-secondary/50 text-muted-foreground/50 border-border cursor-default"
                      : "bg-background text-foreground border-border hover:bg-secondary"
                  }`}
                >
                  + {example}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active services list with inline edit & remove */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            {t("onboarding.activeServicesCount", { count: services.length })}
          </div>
          {services.length === 0 ? (
            <div className="p-4 rounded-md bg-secondary/40 border border-border text-xs text-muted-foreground">
              {t("onboarding.noServicesYet")}
            </div>
          ) : (
            <ul className="divide-y divide-border border border-border rounded-md bg-secondary/30">
              {services.map((service, idx) => (
                <li
                  key={`${service}-${idx}`}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-sm"
                >
                  {editingIndex === idx ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        aria-label={`${t("common.edit")} ${service}`}
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitEdit(idx);
                          }
                        }}
                        className="flex-1 h-8 px-2.5 rounded border border-input bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={() => commitEdit(idx)}
                        className="px-2.5 py-1 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {t("common.done")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingIndex(null)}
                        className="px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground"
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium text-foreground">{service}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditing(idx)}
                          className="text-xs font-medium text-primary hover:underline px-1.5 py-0.5"
                        >
                          {t("common.edit")}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeService(idx)}
                          className="text-xs font-medium text-muted-foreground hover:text-destructive px-1.5 py-0.5"
                        >
                          {t("common.remove")}
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Optional plain-language description */}
        <div className="space-y-1.5">
          <label
            htmlFor="service-description"
            className="block text-sm font-medium text-foreground"
          >
            {t("onboarding.whatDoYouSellLabel")}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              {t("onboarding.optionalLabel")}
            </span>
          </label>
          <textarea
            id="service-description"
            rows={3}
            value={serviceDescription}
            onChange={(e) => setServiceDescription(e.target.value)}
            placeholder={t("onboarding.whatDoYouSellPlaceholder")}
            className="w-full p-3 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            {t("onboarding.whatDoYouSellHint")}
          </p>
        </div>

        {/* Default time window */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            {t("onboarding.defaultWindowLabel")}
          </label>
          <div className="inline-grid grid-cols-3 gap-1 bg-secondary p-1 rounded-md border border-border">
            {[30, 90, 180].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setDefaultWindow(days)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                  defaultWindow === days
                    ? "bg-card text-primary shadow-2xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("discover.daysOption", { days })}
              </button>
            ))}
          </div>
        </div>

        {/* Language & Appearance Preferences (Preserves Unsaved Form State on Switch) */}
        <div className="space-y-4 pt-4 border-t border-border">
          <h2 className="text-sm font-semibold text-foreground">
            {t("onboarding.preferencesSectionTitle")}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Interface Language */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">
                {t("onboarding.uiLanguageLabel")}
              </label>
              <div className="grid grid-cols-2 gap-1 bg-secondary p-1 rounded-md border border-border">
                {[
                  { code: "en", label: "English" },
                  { code: "es", label: "Español" },
                ].map((opt) => (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => setLang(opt.code)}
                    aria-pressed={lang === opt.code}
                    className={`py-1.5 rounded text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                      lang === opt.code
                        ? "bg-card text-primary border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("onboarding.uiLanguageHint")}
              </p>
            </div>

            {/* Outreach Draft Language (Kept separate from UI language) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">
                {t("onboarding.outreachLanguageLabel")}
              </label>
              <div className="grid grid-cols-2 gap-1 bg-secondary p-1 rounded-md border border-border">
                {[
                  { code: "en", label: "English" },
                  { code: "es", label: "Español" },
                ].map((opt) => (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => setOutreachLang(opt.code)}
                    aria-pressed={outreachLang === opt.code}
                    className={`py-1.5 rounded text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                      outreachLang === opt.code
                        ? "bg-card text-primary border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("onboarding.outreachLanguageHint")}
              </p>
            </div>

            {/* Theme Mode */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">
                {t("onboarding.themeModeLabel")}
              </label>
              <div className="grid grid-cols-3 gap-1 bg-secondary p-1 rounded-md border border-border">
                {[
                  { id: "light", label: t("nav.themeLight") },
                  { id: "dark", label: t("nav.themeDark") },
                  { id: "system", label: t("nav.themeSystem") },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTheme(opt.id)}
                    aria-pressed={theme === opt.id}
                    className={`py-1.5 rounded text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                      theme === opt.id
                        ? "bg-card text-primary border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("onboarding.themeModeHint")}
              </p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="p-3 rounded-md bg-destructive/15 border border-destructive/30 text-xs text-destructive"
          >
            {errorMsg}
          </div>
        )}

        {statusMsg && (
          <div
            role="status"
            className="p-3 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300"
          >
            {statusMsg}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {isSaving ? t("common.saving") : t("onboarding.saveServicesBtn")}
          </button>

          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {t("onboarding.goToFindLeadsBtn")}
          </button>
        </div>
      </form>
    </div>
  );
}