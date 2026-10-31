import { useEffect } from "react";
import { usePublicLocale } from "@/lib/PublicLocaleContext";

export default function PublicMetadata({ page }) {
  const { lang, copy } = usePublicLocale();
  const title = page ? `${copy[page].title} — GoLeads` : copy.title;
  const description = page ? copy[page].intro : copy.description;
  useEffect(() => {
    document.title = title;
    document.documentElement.lang = lang;
    for (const [attribute, key, value] of [["name", "description", description], ["property", "og:title", title], ["property", "og:description", description], ["property", "og:locale", lang === "es" ? "es_ES" : "en_US"]]) {
      let meta = document.head.querySelector(`meta[${attribute}="${key}"]`);
      if (!meta) { meta = document.createElement("meta"); meta.setAttribute(attribute, key); document.head.appendChild(meta); }
      meta.setAttribute("content", value);
    }
  }, [lang, title, description]);
  return null;
}