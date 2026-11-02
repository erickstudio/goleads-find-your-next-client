import { useState, useRef, useEffect } from "react";
import { Sun, Moon, Monitor, Globe } from "lucide-react";
import { usePreferences } from "@/lib/PreferencesContext";

export default function PreferenceControls({ compact = false }) {
  const { lang, setLang, theme, setTheme, t } = usePreferences();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef(null);

  useEffect(() => {
    if (!langOpen) return;
    const handleOutside = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setLangOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [langOpen]);

  const themeOptions = [
    { id: "light", label: t("nav.themeLight"), icon: Sun },
    { id: "dark", label: t("nav.themeDark"), icon: Moon },
    { id: "system", label: t("nav.themeSystem"), icon: Monitor },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div
        ref={langRef}
        role="group"
        aria-label={t("nav.languageLabel")}
        onMouseEnter={() => setLangOpen(true)}
        onMouseLeave={() => setLangOpen(false)}
        className="group inline-flex items-center rounded-md border border-border bg-secondary/70 p-0.5 text-xs"
      >
        <button
          type="button"
          onClick={() => setLangOpen((prev) => !prev)}
          aria-expanded={langOpen}
          aria-label={t("nav.languageLabel")}
          title={t("nav.languageLabel")}
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </button>
        <div
          className={`inline-flex items-center overflow-hidden transition-all duration-200 ease-out ${
            langOpen ? "ml-0.5 max-w-28 opacity-100" : "max-w-0 opacity-0 pointer-events-none"
          }`}
        >
          {[
            { code: "en", label: "EN", full: "English" },
            { code: "es", label: "ES", full: "Español" },
          ].map((item) => {
            const active = lang === item.code;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  setLang(item.code);
                  setLangOpen(false);
                }}
                aria-pressed={active}
                title={item.full}
                className={`px-2 py-1 rounded-sm font-mono text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                  active
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="group"
        aria-label={t("nav.themeLabel")}
        className="inline-flex items-center rounded-md border border-border bg-secondary/70 p-0.5 text-xs"
      >
        {themeOptions.map((opt) => {
          const Icon = opt.icon;
          const active = theme === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id)}
              aria-pressed={active}
              title={`${t("nav.themeLabel")}: ${opt.label}`}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[11px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                active
                  ? "bg-card text-foreground shadow-2xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {!compact && <span className="hidden lg:inline">{opt.label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}