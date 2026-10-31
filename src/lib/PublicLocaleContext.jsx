import { createContext, useContext, useEffect, useState } from "react";
import { usePreferences } from "@/lib/PreferencesContext";
import { TRANSLATIONS } from "@/lib/i18n";

const PublicLocaleContext = createContext(null);
export function PublicLocaleProvider({ initialLang, children }) {
  const { lang, setLang, hydrated } = usePreferences();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!hydrated || ready) return;
    if (initialLang) setLang(initialLang, { syncServer: false });
    setReady(true);
  }, [hydrated, ready, initialLang, setLang]);
  const locale = ready ? lang : initialLang || lang;
  return <PublicLocaleContext.Provider value={{ lang: locale, copy: TRANSLATIONS[locale].launch }}>{children}</PublicLocaleContext.Provider>;
}
export function usePublicLocale() { return useContext(PublicLocaleContext); }