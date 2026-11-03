import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { usePublicLocale } from "@/lib/PublicLocaleContext";

const CONSENT_STORAGE_KEY = "goleads_cookie_consent_v1";
const OPEN_CONSENT_EVENT = "goleads:open-cookie-settings";

function pushConsentUpdate(analyticsGranted, adsGranted = false) {
  window.dataLayer = window.dataLayer || [];
  const gtag =
    window.gtag ||
    function () {
      window.dataLayer.push(arguments);
    };
  gtag("consent", "update", {
    analytics_storage: analyticsGranted ? "granted" : "denied",
    ad_storage: adsGranted ? "granted" : "denied",
    ad_user_data: adsGranted ? "granted" : "denied",
    ad_personalization: adsGranted ? "granted" : "denied",
  });
}

export function openCookieSettings() {
  window.dispatchEvent(new CustomEvent(OPEN_CONSENT_EVENT));
}

export default function CookieConsentBanner() {
  const { lang } = usePublicLocale();
  const isEs = lang === "es";

  const [visible, setVisible] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [marketingEnabled, setMarketingEnabled] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const analytics = Boolean(parsed?.analytics);
        const marketing = Boolean(parsed?.marketing);
        setAnalyticsEnabled(analytics);
        setMarketingEnabled(marketing);
        pushConsentUpdate(analytics, marketing);
        setVisible(false);
      } else {
        setAnalyticsEnabled(false);
        setMarketingEnabled(false);
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }

    const handleReopen = () => {
      try {
        const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setAnalyticsEnabled(Boolean(parsed?.analytics));
          setMarketingEnabled(Boolean(parsed?.marketing));
        } else {
          setAnalyticsEnabled(false);
          setMarketingEnabled(false);
        }
      } catch {
        setAnalyticsEnabled(false);
        setMarketingEnabled(false);
      }
      setVisible(true);
    };

    window.addEventListener(OPEN_CONSENT_EVENT, handleReopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, handleReopen);
  }, []);

  const saveConsentChoice = (analytics, marketing) => {
    setAnalyticsEnabled(analytics);
    setMarketingEnabled(marketing);
    try {
      localStorage.setItem(
        CONSENT_STORAGE_KEY,
        JSON.stringify({
          analytics,
          marketing,
          updatedAt: new Date().toISOString(),
        })
      );
    } catch {
      // ignore storage write errors
    }
    pushConsentUpdate(analytics, marketing);
    setCustomizeOpen(false);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={isEs ? "Preferencias de cookies" : "Cookie preferences"}
      className="fixed inset-x-0 bottom-0 z-[9999] p-4 sm:p-6 pointer-events-none"
    >
      <div className="mx-auto max-w-3xl pointer-events-auto rounded-lg border border-border bg-card text-card-foreground shadow-2xl p-4 sm:p-5 space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              {isEs ? "Preferencias de cookies y privacidad" : "Cookie & privacy preferences"}
            </h2>
            <button
              type="button"
              onClick={() => setCustomizeOpen((prev) => !prev)}
              className="text-xs font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded px-1"
            >
              {customizeOpen
                ? isEs
                  ? "Ocultar opciones"
                  : "Hide options"
                : isEs
                ? "Personalizar"
                : "Customize"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isEs
              ? "Usamos cookies esenciales para el funcionamiento del sitio y, con tu permiso, Google Analytics para entender cómo se usa GoLeads y mejorar la plataforma. Puedes aceptar todas, rechazar las opcionales o elegir tus preferencias."
              : "We use essential cookies to keep the site working and, with your permission, Google Analytics to understand how GoLeads is used and improve the platform. You can accept all, decline optional cookies, or customize your choice."}{" "}
            <Link
              to="/privacy"
              search={{ lang }}
              className="text-primary hover:underline underline-offset-4 font-medium"
            >
              {isEs ? "Política de privacidad" : "Privacy policy"}
            </Link>
          </p>
        </div>

        {customizeOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-border text-xs">
            <div className="rounded-md border border-border bg-secondary/40 p-2.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">
                  {isEs ? "Esenciales" : "Essential"}
                </span>
                <input
                  type="checkbox"
                  checked
                  disabled
                  aria-label={isEs ? "Cookies esenciales" : "Essential cookies"}
                  className="h-4 w-4 accent-primary"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isEs
                  ? "Necesarias para sesión, idioma y seguridad."
                  : "Required for session, language, and security."}
              </p>
            </div>

            <label className="rounded-md border border-border bg-secondary/40 p-2.5 space-y-1 cursor-pointer">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">
                  {isEs ? "Analítica" : "Analytics"}
                </span>
                <input
                  type="checkbox"
                  checked={analyticsEnabled}
                  onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isEs
                  ? "Mide visitas y uso general mediante Google Analytics."
                  : "Measures visits and usage via Google Analytics."}
              </p>
            </label>

            <label className="rounded-md border border-border bg-secondary/40 p-2.5 space-y-1 cursor-pointer">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">
                  {isEs ? "Marketing" : "Marketing"}
                </span>
                <input
                  type="checkbox"
                  checked={marketingEnabled}
                  onChange={(e) => setMarketingEnabled(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isEs
                  ? "Medición de campañas y atribución publicitaria."
                  : "Campaign measurement and ad attribution."}
              </p>
            </label>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2.5">
          {customizeOpen && (
            <button
              type="button"
              onClick={() => saveConsentChoice(analyticsEnabled, marketingEnabled)}
              className="px-3.5 py-2 rounded-md text-xs font-semibold border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {isEs ? "Guardar selección" : "Save preferences"}
            </button>
          )}
          <button
            type="button"
            onClick={() => saveConsentChoice(false, false)}
            className="px-4 py-2 rounded-md text-xs font-semibold border border-border bg-secondary text-foreground hover:bg-secondary/80 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {isEs ? "Rechazar" : "Decline"}
          </button>
          <button
            type="button"
            onClick={() => saveConsentChoice(true, true)}
            className="px-4 py-2 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {isEs ? "Aceptar" : "Accept"}
          </button>
        </div>
      </div>
    </div>
  );
}