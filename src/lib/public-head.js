import { LAUNCH_COPY } from "@/lib/launch-copy";

export function publicHead(lang, page) {
  const copy = LAUNCH_COPY[lang === "es" ? "es" : "en"];
  const title = page ? `${copy[page].title} — GoLeads` : copy.title;
  const description = page ? copy[page].intro : copy.description;
  return { meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { property: "og:locale", content: lang === "es" ? "es_ES" : "en_US" }] };
}