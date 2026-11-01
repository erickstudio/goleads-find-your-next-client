import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { usePreferences } from "@/lib/PreferencesContext";
import { TRANSLATIONS } from "@/lib/i18n";

const PublicLocaleContext = createContext(null);

export function PublicLocaleProvider({ initialLang, children }) {
  const { lang, setLang, hydrated } = usePreferences();
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!hydrated || ready) return;
    if (initialLang === "en" || initialLang === "es") {
      setLang(initialLang, { syncServer: false });
    }
    setReady(true);
  }, [hydrated, ready, initialLang, setLang]);

  useEffect(() => {
    // Only update ?lang= in the URL if the URL already had an explicit ?lang= param
    // and the user switched language via the header controls. Never redirect "/" on mount.
    if (ready && (initialLang === "en" || initialLang === "es") && initialLang !== lang) {
      navigate({
        search: (previous) => ({ ...previous, lang }),
        replace: true,
        resetScroll: false,
      });
    }
  }, [ready, lang, initialLang, navigate]);

  const rawLocale = ready ? lang : initialLang || lang;
  const locale = rawLocale === "es" ? "es" : "en";
  return (
    <PublicLocaleContext.Provider
      value={{ lang: locale, copy: TRANSLATIONS[locale].launch }}
    >
      {children}
    </PublicLocaleContext.Provider>
  );
}

export function usePublicLocale() {
  const ctx = useContext(PublicLocaleContext);
  const { lang } = usePreferences();
  if (ctx) return ctx;
  const fallbackLocale = lang === "es" ? "es" : "en";
  return {
    lang: fallbackLocale,
    copy: TRANSLATIONS[fallbackLocale].launch,
  };
}