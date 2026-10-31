import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import {
  SUPPORTED_LANGUAGES,
  SUPPORTED_THEMES,
  normalizeLanguage,
  detectBrowserLanguage,
  translate,
} from "@/lib/i18n";
import { updateUserPreferences } from "@/lib/server-fns";
import { useAuth } from "@/lib/AuthContext";

const UI_LANG_STORAGE_KEY = "goleads_ui_language";
const OUTREACH_LANG_STORAGE_KEY = "goleads_outreach_language";
const THEME_STORAGE_KEY = "goleads_theme_preference";

const PreferencesContext = createContext(null);

function resolveSystemTheme() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeToDom(themeChoice) {
  if (typeof document === "undefined") return "light";
  const resolved = themeChoice === "system" ? resolveSystemTheme() : themeChoice;
  const isDark = resolved === "dark";
  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
  root.dataset.theme = resolved;
  root.dataset.themeMode = themeChoice;
  root.style.colorScheme = resolved;
  return resolved;
}

export function PreferencesProvider({ children }) {
  // Server-safe defaults for SSR match; hydrated immediately on client
  const [lang, setLangState] = useState("en");
  const [outreachLang, setOutreachLangState] = useState("en");
  const [theme, setThemeState] = useState("dark");
  const [resolvedTheme, setResolvedTheme] = useState("dark");
  const { isAuthenticated } = useAuth();
  const [hydrated, setHydrated] = useState(false);

  // Hydrate visitor/saved preferences from localStorage or browser language on mount
  useEffect(() => {
    let initialLang = "en";
    try {
      const savedLang = normalizeLanguage(window.localStorage.getItem(UI_LANG_STORAGE_KEY));
      initialLang = savedLang || detectBrowserLanguage() || "en";
    } catch {
      initialLang = detectBrowserLanguage() || "en";
    }

    let initialOutreachLang = initialLang;
    try {
      const savedOutreach = normalizeLanguage(
        window.localStorage.getItem(OUTREACH_LANG_STORAGE_KEY)
      );
      if (savedOutreach) initialOutreachLang = savedOutreach;
    } catch {
      // keep initialLang
    }

    let initialTheme = "dark";
    try {
      const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && SUPPORTED_THEMES.includes(savedTheme)) {
        initialTheme = savedTheme;
      }
    } catch {
      initialTheme = "dark";
    }

    setLangState(initialLang);
    setOutreachLangState(initialOutreachLang);
    setThemeState(initialTheme);
    const applied = applyThemeToDom(initialTheme);
    setResolvedTheme(applied);
    if (typeof document !== "undefined") {
      document.documentElement.lang = initialLang;
    }
    setHydrated(true);
  }, []);

  // Listen for OS dark/light changes when in "system" mode
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        const applied = applyThemeToDom("system");
        setResolvedTheme(applied);
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const persistToProfileSilently = useCallback(async (patch) => {
    if (!isAuthenticated) return;
    try {
      await updateUserPreferences({ data: patch });
    } catch {
      // Local preferences remain available if a profile save fails.
    }
  }, [isAuthenticated]);

  const setLang = useCallback(
    (nextLang, options = { syncServer: true }) => {
      const normalized = normalizeLanguage(nextLang) || "en";
      setLangState(normalized);
      if (typeof document !== "undefined") {
        document.documentElement.lang = normalized;
      }
      try {
        window.localStorage.setItem(UI_LANG_STORAGE_KEY, normalized);
      } catch {
        // ignore storage errors
      }
      if (options.syncServer) {
        persistToProfileSilently({ ui_language: normalized });
      }
    },
    [persistToProfileSilently]
  );

  const setOutreachLang = useCallback(
    (nextOutreachLang, options = { syncServer: true }) => {
      const normalized = normalizeLanguage(nextOutreachLang) || "en";
      setOutreachLangState(normalized);
      try {
        window.localStorage.setItem(OUTREACH_LANG_STORAGE_KEY, normalized);
      } catch {
        // ignore storage errors
      }
      if (options.syncServer) {
        persistToProfileSilently({ outreach_language: normalized });
      }
    },
    [persistToProfileSilently]
  );

  const setTheme = useCallback(
    (nextTheme, options = { syncServer: true }) => {
      const validTheme = SUPPORTED_THEMES.includes(nextTheme) ? nextTheme : "system";
      setThemeState(validTheme);
      const applied = applyThemeToDom(validTheme);
      setResolvedTheme(applied);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, validTheme);
      } catch {
        // ignore storage errors
      }
      if (options.syncServer) {
        persistToProfileSilently({ theme_preference: validTheme });
      }
    },
    [persistToProfileSilently]
  );

  // Sync from authenticated user's profile when no explicit local override was set yet
  const syncFromProfile = useCallback((profile) => {
    if (!profile || typeof window === "undefined") return;
    try {
      const hasLocalUiLang = normalizeLanguage(window.localStorage.getItem(UI_LANG_STORAGE_KEY));
      if (!hasLocalUiLang && profile.ui_language && SUPPORTED_LANGUAGES.includes(profile.ui_language)) {
        setLangState(profile.ui_language);
        document.documentElement.lang = profile.ui_language;
        window.localStorage.setItem(UI_LANG_STORAGE_KEY, profile.ui_language);
      }
      const hasLocalOutreach = normalizeLanguage(
        window.localStorage.getItem(OUTREACH_LANG_STORAGE_KEY)
      );
      if (
        !hasLocalOutreach &&
        profile.outreach_language &&
        SUPPORTED_LANGUAGES.includes(profile.outreach_language)
      ) {
        setOutreachLangState(profile.outreach_language);
        window.localStorage.setItem(OUTREACH_LANG_STORAGE_KEY, profile.outreach_language);
      }
      const hasLocalTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (
        !hasLocalTheme &&
        profile.theme_preference &&
        SUPPORTED_THEMES.includes(profile.theme_preference)
      ) {
        setThemeState(profile.theme_preference);
        const applied = applyThemeToDom(profile.theme_preference);
        setResolvedTheme(applied);
        window.localStorage.setItem(THEME_STORAGE_KEY, profile.theme_preference);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const t = useCallback(
    (keyPath, vars) => translate(lang, keyPath, vars),
    [lang]
  );

  const value = useMemo(
    () => ({
      lang,
      setLang,
      outreachLang,
      setOutreachLang,
      theme,
      setTheme,
      resolvedTheme,
      hydrated,
      syncFromProfile,
      t,
    }),
    [lang, setLang, outreachLang, setOutreachLang, theme, setTheme, resolvedTheme, hydrated, syncFromProfile, t]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    return {
      lang: "en",
      setLang: () => {},
      outreachLang: "en",
      setOutreachLang: () => {},
      theme: "system",
      setTheme: () => {},
      resolvedTheme: "light",
      hydrated: false,
      syncFromProfile: () => {},
      t: (keyPath, vars) => translate("en", keyPath, vars),
    };
  }
  return ctx;
}