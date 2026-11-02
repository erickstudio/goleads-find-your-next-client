import { useState, useEffect } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { SERVICE_EXAMPLES, normalizeServicesList } from "@/lib/leads-constants";
import { saveUserProfile, updateUserPreferences } from "@/lib/server-fns";
import {
  getExtendedWorkspaceData,
  sendProfileLanguageCommunicationEmail,
} from "@/lib/workspace-pages-fns";
import { usePreferences } from "@/lib/PreferencesContext";

export const Route = createFileRoute("/_authed/settings")({
  ssr: false,
  loader: () => getExtendedWorkspaceData(),
  head: () => ({
    meta: [
      { title: "Account Settings — goleads.app" },
      {
        name: "description",
        content:
          "Update your profile information, selected services, and default search preferences.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AccountSettingsPage,
});

function AccountSettingsPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const saveProfileFn = useServerFn(saveUserProfile);
  const updatePrefsFn = useServerFn(updateUserPreferences);
  const sendCommEmailFn = useServerFn(sendProfileLanguageCommunicationEmail);
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

  const isEs = lang === "es";
  const profile = data?.profile;
  const user = data?.user;

  const [agencyName, setAgencyName] = useState(profile?.agency_or_freelancer_name || "");
  const [services, setServices] = useState(
    normalizeServicesList(profile?.selected_services || [])
  );
  const [newServiceInput, setNewServiceInput] = useState("");
  const [serviceDescription, setServiceDescription] = useState(
    profile?.service_description || ""
  );
  const [defaultWindow, setDefaultWindow] = useState(
    profile?.default_time_window_days || 90
  );
  const [isSaving, setIsSaving] = useState(false);
  const [sendingEmailKey, setSendingEmailKey] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const handleSendCommunicationEmail = async (emailKey) => {
    setSendingEmailKey(emailKey);
    setErrorMsg("");
    setStatusMsg("");
    try {
      await updatePrefsFn({
        data: {
          ui_language: lang,
          outreach_language: outreachLang,
          theme_preference: theme,
        },
      });
      const res = await sendCommEmailFn({ data: { emailKey } });
      await router.invalidate();
      if (res?.ok) {
        setStatusMsg(
          isEs
            ? `Correo enviado a ${res.to} en ${res.language === "es" ? "español" : "inglés"} (plantilla ${res.templateName}).`
            : `Email sent to ${res.to} in ${res.language === "es" ? "Spanish" : "English"} (template ${res.templateName}).`
        );
      } else {
        setErrorMsg(
          isEs
            ? "No se pudo enviar el correo a esta dirección."
            : "Could not deliver the email to this address."
        );
      }
    } catch (err) {
      setErrorMsg(
        err?.message ||
          (isEs ? "Error al enviar el correo." : "Failed to send email.")
      );
    } finally {
      setSendingEmailKey("");
    }
  };

  useEffect(() => {
    if (profile) {
      syncFromProfile(profile);
    }
  }, [profile?.id]);

  useEffect(() => {
    document.title = isEs
      ? "Configuración de cuenta — goleads.app"
      : "Account Settings — goleads.app";
  }, [isEs]);

  const addServiceName = (rawName) => {
    const trimmed = (rawName || "").trim();
    if (!trimmed) return;
    const next = normalizeServicesList([...services, trimmed]);
    setServices(next);
    setNewServiceInput("");
    setErrorMsg("");
    setStatusMsg("");
  };

  const removeService = (idx) => {
    setServices((prev) => prev.filter((_, i) => i !== idx));
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
          agency_or_freelancer_name: agencyName.trim(),
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
      setStatusMsg(
        isEs
          ? "Configuración de cuenta actualizada correctamente."
          : "Account settings saved."
      );
    } catch (err) {
      setErrorMsg(err?.message || t("onboarding.saveErrorFallback"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {isEs ? "Configuración de cuenta" : "Account Settings"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEs
              ? "Actualiza la información de tu perfil, tus servicios seleccionados y tus preferencias de búsqueda predeterminadas."
              : "Update your profile information, selected services, and default search preferences."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/agent-settings"
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-secondary text-foreground border border-border hover:bg-secondary/80"
          >
            {isEs ? "Ajustes de agentes IA" : "Agent Settings"}
          </Link>
          <Link
            to="/app"
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {t("nav.findLeads")}
          </Link>
        </div>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-card text-card-foreground rounded-lg border border-border p-5 sm:p-6 space-y-6"
      >
        {/* Account Identity */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">
            {isEs ? "Información de perfil" : "Profile information"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">
                {isEs ? "Correo electrónico autenticado" : "Authenticated email"}
              </label>
              <input
                type="email"
                disabled
                value={user?.email || ""}
                className="w-full h-10 px-3 rounded-md border border-border bg-secondary/50 text-sm font-mono text-muted-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="agency-name-input"
                className="block text-xs font-medium text-foreground"
              >
                {isEs
                  ? "Nombre de agencia o consultor (opcional)"
                  : "Agency or freelancer name (optional)"}
              </label>
              <input
                id="agency-name-input"
                type="text"
                maxLength={120}
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder={
                  isEs ? "Ej. Estudio Digital Norte" : "e.g., Northshore Digital Studio"
                }
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </section>

        {/* Selected Services */}
        <section className="space-y-3 pt-4 border-t border-border">
          <h2 className="text-sm font-semibold text-foreground">
            {t("onboarding.servicesOfferedLabel")}
          </h2>

          <div className="flex gap-2">
            <input
              type="text"
              value={newServiceInput}
              onChange={(e) => setNewServiceInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addServiceName(newServiceInput);
                }
              }}
              placeholder={t("onboarding.serviceInputPlaceholder")}
              className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => addServiceName(newServiceInput)}
              className="px-4 h-10 rounded-md text-sm font-medium bg-secondary text-foreground border border-border hover:bg-secondary/80 shrink-0"
            >
              {t("onboarding.addServiceBtn")}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
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
                  className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
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

          <div className="flex flex-wrap gap-2 pt-1">
            {services.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                {t("onboarding.noServicesYet")}
              </span>
            ) : (
              services.map((service, idx) => (
                <span
                  key={`${service}-${idx}`}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium bg-secondary text-foreground border border-border"
                >
                  {service}
                  <button
                    type="button"
                    onClick={() => removeService(idx)}
                    className="text-muted-foreground hover:text-destructive font-bold"
                    aria-label={`${t("common.remove")} ${service}`}
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>

          <div className="space-y-1.5 pt-2">
            <label
              htmlFor="settings-service-description"
              className="block text-xs font-medium text-foreground"
            >
              {t("onboarding.whatDoYouSellLabel")}{" "}
              <span className="text-muted-foreground">{t("onboarding.optionalLabel")}</span>
            </label>
            <textarea
              id="settings-service-description"
              rows={3}
              maxLength={600}
              value={serviceDescription}
              onChange={(e) => setServiceDescription(e.target.value)}
              placeholder={t("onboarding.whatDoYouSellPlaceholder")}
              className="w-full p-3 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </section>

        {/* Search & Workspace Preferences */}
        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="text-sm font-semibold text-foreground">
            {isEs
              ? "Preferencias de búsqueda, idioma y tema"
              : "Default search, language & theme preferences"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">
                {t("onboarding.defaultWindowLabel")}
              </label>
              <div className="grid grid-cols-3 gap-1 bg-secondary p-1 rounded-md border border-border">
                {[30, 90, 180].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setDefaultWindow(days)}
                    className={`py-1.5 rounded text-xs font-medium transition-colors ${
                      defaultWindow === days
                        ? "bg-card text-primary border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t("discover.daysOption", { days })}
                  </button>
                ))}
              </div>
            </div>

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
                    className={`py-1.5 rounded text-xs font-medium transition-colors ${
                      theme === opt.id
                        ? "bg-card text-primary border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

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
                    className={`py-1.5 rounded text-xs font-medium transition-colors ${
                      lang === opt.code
                        ? "bg-card text-primary border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

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
                    className={`py-1.5 rounded text-xs font-medium transition-colors ${
                      outreachLang === opt.code
                        ? "bg-card text-primary border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border bg-secondary/40 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-foreground">
                  {isEs
                    ? "Idioma de correos de comunicación"
                    : "Communication emails language"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isEs
                    ? "Recibirás los correos de bienvenida, boletín, novedades y promociones en el idioma preferente seleccionado en tu perfil."
                    : "You will receive welcome, newsletter, product update, and promotional emails in the preferred language selected in your profile."}
                </p>
              </div>
              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-primary/15 text-primary border border-primary/30 shrink-0">
                {lang === "es"
                  ? "Idioma activo: Español (ES)"
                  : "Active language: English (EN)"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {[
                {
                  key: "welcome",
                  titleEs: "Bienvenida",
                  titleEn: "Welcome",
                  tplEs: "WelcomeEs",
                  tplEn: "Welcome",
                },
                {
                  key: "newsletter",
                  titleEs: "Boletín informativo",
                  titleEn: "Newsletter",
                  tplEs: "NewsletterEs",
                  tplEn: "Newsletter",
                },
                {
                  key: "product_update",
                  titleEs: "Novedades del producto",
                  titleEn: "Product update",
                  tplEs: "ProductUpdateEs",
                  tplEn: "ProductUpdate",
                },
                {
                  key: "promotion",
                  titleEs: "Promoción",
                  titleEn: "Promotion",
                  tplEs: "PromotionEs",
                  tplEn: "Promotion",
                },
                {
                  key: "enquiry_reply",
                  titleEs: "Respuesta a consulta (EnquiryReply)",
                  titleEn: "Enquiry reply (EnquiryReply)",
                  tplEs: "EnquiryReplyEs",
                  tplEn: "EnquiryReply",
                },
              ].map((item) => {
                const activeTpl = lang === "es" ? item.tplEs : item.tplEn;
                const isSendingThis = sendingEmailKey === item.key;
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-2 rounded border border-border bg-card px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">
                        {isEs ? item.titleEs : item.titleEn}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        {activeTpl}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={Boolean(sendingEmailKey)}
                      onClick={() => handleSendCommunicationEmail(item.key)}
                      className="px-2.5 py-1 rounded text-xs font-medium bg-secondary text-foreground border border-border hover:bg-secondary/80 disabled:opacity-50 shrink-0"
                    >
                      {isSendingThis
                        ? isEs
                          ? "Enviando..."
                          : "Sending..."
                        : isEs
                        ? "Enviar prueba"
                        : "Send test"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

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

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving
              ? t("common.saving")
              : isEs
              ? "Guardar configuración"
              : "Save settings"}
          </button>
        </div>
      </form>
    </div>
  );
}