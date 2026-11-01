// Centralized deterministic bilingual formatters and non-generic service-fit builder.
// Keeps UI language consistent across cards, detail pages, saved leads, evidence library,
// search history, and feedback summaries without runtime LLM calls.

const SIGNAL_TYPE_MAP = {
  "new opening": { en: "New opening", es: "Nueva apertura" },
  opening: { en: "Opening", es: "Apertura" },
  "new location opening": { en: "New location opening", es: "Apertura de nuevo local" },
  "new location announcement": { en: "New location announcement", es: "Anuncio de nueva sede" },
  "new location": { en: "New location", es: "Nuevo local" },
  relocation: { en: "Relocation", es: "Traslado" },
  expansion: { en: "Expansion", es: "Expansión" },
  reopening: { en: "Reopening", es: "Reapertura" },
  "grand opening": { en: "Grand opening", es: "Gran inauguración" },
  "second clinic expansion": { en: "Second clinic expansion", es: "Expansión de segunda clínica" },
  "new flagship roastery & retail launch": {
    en: "New flagship roastery & retail launch",
    es: "Lanzamiento de tostaduría y tienda",
  },
  "opening / expansion signal": {
    en: "Opening / expansion signal",
    es: "Señal de apertura o expansión",
  },
  "expansion signal": { en: "Expansion signal", es: "Señal de expansión" },
};

const CATEGORY_MAP = {
  restaurants: { en: "Restaurants", es: "Restaurantes" },
  restaurant: { en: "Restaurant", es: "Restaurante" },
  "italian restaurant": { en: "Italian restaurant", es: "Restaurante italiano" },
  "ecuadorian restaurant": { en: "Ecuadorian restaurant", es: "Restaurante ecuatoriano" },
  "dental clinic": { en: "Dental clinic", es: "Clínica dental" },
  "dental clinics": { en: "Dental clinics", es: "Clínicas dentales" },
  "business consulting": { en: "Business consulting", es: "Consultoría empresarial" },
  consilting: { en: "Consulting", es: "Consultoría" },
  consulting: { en: "Consulting", es: "Consultoría" },
  "healthcare & outpatient clinics": {
    en: "Healthcare & Outpatient Clinics",
    es: "Salud y clínicas ambulatorias",
  },
  "food & beverage / specialty retail": {
    en: "Food & Beverage / Specialty Retail",
    es: "Alimentos y bebidas / Comercio especializado",
  },
  uncategorized: { en: "Uncategorized", es: "Sin categoría" },
};

const FEEDBACK_REASON_MAP = {
  "strong expansion signal": {
    en: "Strong expansion signal",
    es: "Señal clara de expansión",
  },
  "matches my service & territory": {
    en: "Matches my service & territory",
    es: "Encaja con mi servicio y territorio",
  },
  "good timing for outreach": {
    en: "Good timing for outreach",
    es: "Buen momento para contactar",
  },
  "not a fit for my services": {
    en: "Not a fit for my services",
    es: "No encaja con mis servicios",
  },
  "weak or unclear evidence": {
    en: "Weak or unclear evidence",
    es: "Evidencia débil o poco clara",
  },
  "outside my territory": {
    en: "Outside my territory",
    es: "Fuera de mi territorio",
  },
  "already a client / known": {
    en: "Already a client / known",
    es: "Ya es cliente / conocido",
  },
};

export function formatSignalTypeLabel(rawSignal, lang = "en") {
  const isEs = lang === "es";
  const clean = String(rawSignal || "").trim();
  if (!clean) return isEs ? "Señal de apertura o expansión" : "Opening / expansion signal";
  const key = clean.toLowerCase().replace(/\s+/g, " ");
  if (SIGNAL_TYPE_MAP[key]) {
    return isEs ? SIGNAL_TYPE_MAP[key].es : SIGNAL_TYPE_MAP[key].en;
  }
  return clean;
}

export function formatBusinessCategoryLabel(rawCategory, lang = "en") {
  const isEs = lang === "es";
  const clean = String(rawCategory || "").trim();
  if (!clean) return "";
  const key = clean.toLowerCase().replace(/\s+/g, " ");
  if (CATEGORY_MAP[key]) {
    return isEs ? CATEGORY_MAP[key].es : CATEGORY_MAP[key].en;
  }
  return clean;
}

export function formatFeedbackReasonCategory(rawReason, lang = "en") {
  const isEs = lang === "es";
  const clean = String(rawReason || "").trim();
  if (!clean) return "";
  const key = clean.toLowerCase();
  if (FEEDBACK_REASON_MAP[key]) {
    return isEs ? FEEDBACK_REASON_MAP[key].es : FEEDBACK_REASON_MAP[key].en;
  }
  return clean;
}

export function formatFeedbackNote(rawNote, lang = "en") {
  const isEs = lang === "es";
  const clean = String(rawNote || "").trim();
  if (!clean) return "";
  if (clean === "Dismissed from Find leads") {
    return isEs ? "Descartado desde Buscar leads" : "Dismissed from Find leads";
  }
  return clean;
}

export function formatDateValue(rawDate, lang = "en") {
  const isEs = lang === "es";
  const unconfirmedLabel = isEs ? "Fecha no confirmada" : "Date not confirmed";
  if (!rawDate || typeof rawDate !== "string") return unconfirmedLabel;
  const trimmed = rawDate.trim();
  if (!trimmed) return unconfirmedLabel;
  const lower = trimmed.toLowerCase();
  if (
    lower === "null" ||
    lower === "not stated" ||
    lower === "no especificado" ||
    lower === "unverified" ||
    lower === "date not confirmed" ||
    lower === "fecha no confirmada" ||
    lower.includes("year not stated") ||
    lower.includes("año no indicado")
  ) {
    return unconfirmedLabel;
  }

  // Must contain a 4-digit year to be considered a confirmed date value
  if (!/\b(19|20)\d{2}\b/.test(trimmed)) {
    return unconfirmedLabel;
  }

  if (isEs) {
    return trimmed
      .replace(/^First half of (\d{4})\s*\(Planned\)$/i, "Primer semestre de $1 (Previsto)")
      .replace(/^First half of (\d{4})$/i, "Primer semestre de $1")
      .replace(/\(Planned opening\)/gi, "(Apertura prevista)")
      .replace(/\(Planned\)/gi, "(Previsto)")
      .replace(/\(Target launch\)/gi, "(Lanzamiento previsto)");
  }

  return trimmed
    .replace(/^Primer semestre de (\d{4})\s*\(Previsto\)$/i, "First half of $1 (Planned)")
    .replace(/^Primer semestre de (\d{4})$/i, "First half of $1")
    .replace(/\(Apertura prevista\)/gi, "(Planned opening)")
    .replace(/\(Previsto\)/gi, "(Planned)")
    .replace(/\(Lanzamiento previsto\)/gi, "(Target launch)");
}

export function detectTextLanguage(text) {
  const sample = String(text || "").toLowerCase();
  if (!sample.trim()) return "en";
  const esMatches = sample.match(
    /\b(el|la|los|las|de|del|en|para|con|por|una|un|que|se|su|nuevo|nueva|apertura|barrio|segundo|café)\b|[áéíóúñ«»]/g
  );
  const enMatches = sample.match(
    /\b(the|and|for|with|from|into|opening|opens|opened|new|location|restaurant|announced|expanding|expansion|second|street|road|will)\b/g
  );
  const esScore = esMatches ? esMatches.length : 0;
  const enScore = enMatches ? enMatches.length : 0;
  return esScore > enScore ? "es" : "en";
}

export function formatOriginalExcerptBadge(excerpt, uiLang = "en") {
  const excerptLang = detectTextLanguage(excerpt);
  if (uiLang === "es") {
    return excerptLang === "es"
      ? "Extracto original de la fuente · Idioma: Español (ES)"
      : "Extracto original de la fuente · Idioma: Inglés (EN)";
  }
  return excerptLang === "es"
    ? "Original source excerpt · Language: Spanish (ES)"
    : "Original source excerpt · Language: English (EN)";
}

/**
 * Returns a localized announcement summary so cards, details, and saved leads never mix
 * English summaries into the Spanish interface (or vice versa).
 */
export function formatSignalSummary(item, lang = "en") {
  if (!item) return "";
  const isEs = lang === "es";
  const rawSummary = String(item.signal_summary || "").trim();
  const biz = item.business_name || (isEs ? "El negocio" : "The business");
  const loc = item.location || "";
  const notes = String(item.verification_notes || "").toLowerCase();

  // Known demonstration and stored records with exact bilingual summaries
  const lowerBiz = String(item.business_name || "").toLowerCase();

  if (lowerBiz.includes("glint dental")) {
    return isEs
      ? "Glint Dental Studio aparece como clínica dental estética en South Austin (1600 S 1st St, Suite 160). La página principal recuperada no incluye un anuncio fechado de apertura."
      : "Glint Dental Studio is listed as a cosmetic dental studio in South Austin (1600 S 1st St, Suite 160). The recovered homepage does not include a dated opening announcement.";
  }

  if (lowerBiz.includes("cotoa")) {
    return isEs
      ? "El restaurante ecuatoriano COTOA (distinguido con Bib Gourmand de Michelin y dirigido por la chef Alejandra Espinoza) anunció su traslado a un local más amplio de 80 plazas en North Miami, con apertura el 22 de octubre de 2026."
      : "The Michelin Bib Gourmand Ecuadorian restaurant COTOA, led by chef Alejandra Espinoza, announced its relocation to a larger 80-seat venue in North Miami, opening October 22, 2026.";
  }

  if (lowerBiz.includes("sanguich")) {
    return isEs
      ? "El restaurante de sándwiches cubanos Sanguich anunció planes para abrir un nuevo local en Doral como parte de su expansión en el sur de Florida."
      : "The Cuban sandwich restaurant Sanguich announced plans to open a new location in Doral as part of its South Florida expansion.";
  }

  if (lowerBiz.includes("katsuya")) {
    return isEs
      ? "La marca de restaurantes japoneses Katsuya anunció la apertura de una nueva sede dentro de Thesis Hotel Miami en Coral Gables, prevista para el primer semestre de 2027."
      : "Japanese restaurant brand Katsuya announced it will open a new location inside Thesis Hotel Miami in Coral Gables, planned for the first half of 2027.";
  }

  if (lowerBiz.includes("delicias de espana")) {
    return isEs
      ? "Delicias de Espana Sunset figura en un listado de aperturas por código postal en South Miami (5600 Sunset Dr), sin fecha de publicación de artículo ni año confirmado fuera del aviso de copyright."
      : "Delicias de Espana Sunset is listed on a South Miami ZIP-code openings tracker (5600 Sunset Dr), without an article publication date or a confirmed year outside the site copyright.";
  }

  if (lowerBiz.includes("a pasta bar")) {
    return isEs
      ? "El restaurante italiano A Pasta Bar (originario de Nueva York) fue mencionado en prensa local por la apertura de su primer local en Miami Beach; la fuente original requiere revisión manual."
      : "New York-based Italian restaurant A Pasta Bar was mentioned in local press for opening its first Florida location in Miami Beach; the source page requires manual review.";
  }

  if (lowerBiz.includes("chefmarv")) {
    return isEs
      ? "Chefmarv Cuisine fue sugerido en resultados de búsqueda para Miami Gardens, pero el listado público recuperado no permitió confirmar el nombre del negocio ni una fecha con año verificable."
      : "Chefmarv Cuisine was surfaced for Miami Gardens, but the recovered public tracker page did not confirm the business name or a verifiable year.";
  }

  if (lowerBiz.includes("shoreline silicon")) {
    return isEs
      ? "Shoreline Silicon LLC publicó una nota sobre la ampliación de sus servicios de consultoría empresarial en el área de San Francisco; la página de origen bloqueó la lectura automática."
      : "Shoreline Silicon LLC announced the expansion of its business consulting services in the San Francisco Bay Area; the source page blocked automated retrieval.";
  }

  if (lowerBiz.includes("harborview physical therapy")) {
    return isEs
      ? "Firmó un contrato de arrendamiento comercial de 4.200 pies cuadrados en North Shoal Creek para abrir una segunda clínica ambulatoria de rehabilitación ortopédica."
      : "Signed a 4,200 sq. ft. commercial lease in North Shoal Creek to open a second outpatient orthopedic rehabilitation clinic.";
  }

  if (lowerBiz.includes("loma linda specialty roasters")) {
    return isEs
      ? "Pasa de la venta mayorista de café tostado a abrir su primera cafetería al público y tienda de grano empacado en East Austin."
      : "Transitioning from wholesale-only coffee roasting to a public retail cafe and packaged bean storefront in East Austin.";
  }

  // Generic deterministic localization when summary language differs from UI language
  const summaryLang = detectTextLanguage(rawSummary);
  if (!rawSummary) {
    const sigLabel = formatSignalTypeLabel(item.signal_type, lang).toLowerCase();
    return isEs
      ? `Registro de ${sigLabel} para ${biz}${loc ? ` en ${loc}` : ""}.`
      : `${formatSignalTypeLabel(item.signal_type, "en")} record for ${biz}${loc ? ` in ${loc}` : ""}.`;
  }

  if (isEs && summaryLang === "en") {
    const sigLabel = formatSignalTypeLabel(item.signal_type, "es").toLowerCase();
    if (notes.includes("could not fully verify opening/expansion")) {
      return `La fuente recuperada identifica a ${biz}${loc ? ` (${loc})` : ""}, pero no confirma un anuncio fechado de ${sigLabel}.`;
    }
    return `La fuente reporta una señal de ${sigLabel} relacionada con ${biz}${loc ? ` en ${loc}` : ""}.`;
  }

  if (!isEs && summaryLang === "es") {
    const sigLabel = formatSignalTypeLabel(item.signal_type, "en").toLowerCase();
    return `The source reports a ${sigLabel} signal related to ${biz}${loc ? ` in ${loc}` : ""}.`;
  }

  return rawSummary;
}

/**
 * Provides a separate support translation when the original excerpt language differs from UI language.
 * Returns null if the excerpt is already in the active UI language.
 */
export function getExcerptSupportTranslation(item, uiLang = "en") {
  const excerpt = String(item?.supporting_excerpt || "").trim();
  if (!excerpt) return null;
  const excerptLang = detectTextLanguage(excerpt);
  if (excerptLang === uiLang) return null;
  return formatSignalSummary(item, uiLang);
}

/**
 * Formats verification_notes deterministically in the active UI language.
 */
export function formatVerificationNotes(item, lang = "en") {
  if (!item) return "";
  const isEs = lang === "es";
  const raw = String(item.verification_notes || "").trim();
  const lower = raw.toLowerCase();
  const isVerified = item.verification_status === "verified";
  const pubDate = formatDateValue(item.publication_date, lang);
  const evDate = formatDateValue(item.event_date, lang);

  if (item.is_example || lower === "sample demonstration record.") {
    return isEs
      ? "Registro de demostración de ejemplo (no proviene de una búsqueda en vivo)."
      : "Sample demonstration record (not from a live search).";
  }

  if (isVerified) {
    const basisText =
      item.recency_basis === "event_date"
        ? isEs
          ? `fecha del evento (${evDate})`
          : `event date (${evDate})`
        : isEs
        ? `fecha de publicación (${pubDate})`
        : `publication date (${pubDate})`;
    return isEs
      ? `Verificado frente a la página de origen recuperada (HTTP 200). Se confirmaron identidad del negocio, ubicación, anuncio de apertura o expansión y ${basisText}.`
      : `Verified against recovered source page (HTTP 200). Confirmed business identity, location, opening/expansion announcement, and ${basisText}.`;
  }

  if (lower.includes("glint") || lower.includes("copyright") || lower.includes("opening/expansion terms in page body")) {
    return isEs
      ? "Pendiente de revisión: La página principal respondió (HTTP 200) y confirma el nombre y dirección en Austin, pero no contiene un anuncio de apertura ni una fecha de publicación confirmada (el año de copyright del sitio no justifica una fecha de apertura)."
      : "Needs review: The homepage responded (HTTP 200) and confirms the Austin name and address, but does not contain an opening announcement or confirmed publication date (website copyright year does not substantiate an opening date).";
  }

  if (lower.includes("zip-code") || lower.includes("tracker") || lower.includes("oct 26")) {
    return isEs
      ? "Pendiente de revisión: El listado recuperado (HTTP 200) menciona el negocio, pero es un rastreador por código postal sin fecha de publicación de artículo ni año de 4 dígitos confirmado fuera del copyright."
      : "Needs review: Recovered tracker page (HTTP 200) lists the business, but is a ZIP-code tracker without an article publication date or confirmed 4-digit year outside the site copyright.";
  }

  if (lower.includes("business name in page body")) {
    return isEs
      ? "Pendiente de revisión: La página de origen respondió (HTTP 200), pero el nombre específico del negocio y el año del evento no pudieron confirmarse en el contenido recuperado."
      : "Needs review: Source page responded (HTTP 200), but the specific business name and event year could not be confirmed in the recovered page body.";
  }

  if (lower.includes("http 403") || lower.includes("anti-bot") || lower.includes("paywall")) {
    return isEs
      ? "Pendiente de revisión: La fuente devolvió HTTP 403 (bloqueo automatizado) y no pudo leerse directamente para confirmar la fecha de publicación ni el detalle del anuncio."
      : "Needs review: Source URL returned HTTP 403 (automated access blocked) and could not be read directly to confirm the publication date or announcement details.";
  }

  if (lower.includes("http 520") || lower.includes("timed out") || lower.includes("timeout")) {
    return isEs
      ? "Pendiente de revisión: La fuente original no respondió a tiempo o devolvió error del servidor (HTTP 520 / tiempo agotado) durante la verificación automática; revisa el enlace manualmente para confirmar la fecha."
      : "Needs review: The source page timed out or returned a server error (HTTP 520 / timeout) during automated verification; open the link manually to confirm the date.";
  }

  if (!isEs) return raw;

  return "Pendiente de revisión: Algunos datos del anuncio o su fecha no pudieron confirmarse automáticamente en la página de origen.";
}

/**
 * Formats LeadSearch.honest_status_reason deterministically in the active UI language.
 */
export function formatSearchStatusReason(search, lang = "en") {
  if (!search) return "";
  const isEs = lang === "es";
  const status = search.status;
  const total = Number(search.results_count) || 0;
  const verified = Number(search.verified_count) || 0;
  const review = Number(search.needs_review_count) || 0;
  const cat = search.business_category || "";
  const loc = search.location_query || "";
  const days = search.time_window_days || 90;

  if (status === "empty" || (total === 0 && status !== "failed" && status !== "searching")) {
    return isEs
      ? `No se pudieron confirmar anuncios públicos de apertura o expansión para "${cat}" en "${loc}" dentro de los últimos ${days} días.`
      : `No public opening or expansion announcements could be substantiated for "${cat}" in "${loc}" within the last ${days} days.`;
  }

  if (status === "failed") {
    return isEs
      ? "La búsqueda web en vivo no pudo completarse tras el reintento automático. No se inventaron resultados."
      : "Live web search did not complete after automatic retry. No results were fabricated.";
  }

  if (status === "searching") {
    return isEs
      ? "Buscando anuncios públicos en la web y verificando el contenido de las páginas de origen…"
      : "Searching public web announcements and verifying source page content…";
  }

  if (total > 0) {
    if (isEs) {
      if (review > 0) {
        return `Se encontraron ${total} ${total === 1 ? "resultado" : "resultados"}: ${verified} ${
          verified === 1 ? "verificado" : "verificados"
        } directamente frente al contenido de la fuente original y ${review} ${
          review === 1 ? "pendiente de revisión" : "pendientes de revisión"
        } (donde la fuente bloqueó la lectura automática o falta confirmar una fecha o dato).`;
      }
      return `Se encontraron ${verified} ${
        verified === 1 ? "negocio verificado" : "negocios verificados"
      } con evidencia de apertura o expansión confirmada en las páginas de origen.`;
    }
    if (review > 0) {
      return `Found ${total} candidate${total === 1 ? "" : "s"}: ${verified} verified directly against recovered source content, and ${review} marked "Needs review" where the source blocked automated recovery or a date/detail requires manual check.`;
    }
    return `Found ${verified} verified business${
      verified === 1 ? "" : "es"
    } with opening or expansion evidence confirmed from recovered source pages.`;
  }

  return String(search.honest_status_reason || "");
}

/**
 * Selects the single most relevant user service for a specific opportunity and explains why,
 * or returns null when there is not enough context to recommend one.
 */
function selectRelevantServiceForOpportunity(opportunity, cleanServices = []) {
  if (!Array.isArray(cleanServices) || cleanServices.length === 0) return null;

  const notesLower = String(opportunity?.verification_notes || "").toLowerCase();
  const lowerBiz = String(opportunity?.business_name || "").toLowerCase();

  // If the source page did not confirm an opening/expansion event or business identity, do not force a recommendation
  if (
    lowerBiz.includes("glint dental") ||
    lowerBiz.includes("chefmarv") ||
    notesLower.includes("opening/expansion terms in page body") ||
    notesLower.includes("business name in page body") ||
    notesLower.includes("does not contain an opening announcement")
  ) {
    return { insufficientContext: true, service: null };
  }

  const hay = `${opportunity?.signal_type || ""} ${opportunity?.business_category || ""} ${
    opportunity?.signal_summary || ""
  } ${opportunity?.supporting_excerpt || ""}`.toLowerCase();

  const isMultiSiteOrLease =
    hay.includes("second") ||
    hay.includes("multi-site") ||
    hay.includes("expansion") ||
    hay.includes("expansión") ||
    hay.includes("lease") ||
    hay.includes("planning new location") ||
    hay.includes("another location");
  const isRelocation = hay.includes("relocat") || hay.includes("traslado") || hay.includes("larger");
  const isFoodOrRetailOrVenue =
    hay.includes("restaurant") ||
    hay.includes("cafe") ||
    hay.includes("café") ||
    hay.includes("roaster") ||
    hay.includes("bakery") ||
    hay.includes("hotel") ||
    hay.includes("retail") ||
    hay.includes("cuban") ||
    hay.includes("japanese") ||
    hay.includes("italian") ||
    hay.includes("ecuadorian");
  const isConsultingOrB2B =
    hay.includes("consulting") ||
    hay.includes("digital systems") ||
    hay.includes("operations") ||
    hay.includes("governance") ||
    hay.includes("clinic");

  // Score each user service for this specific opportunity
  let bestService = cleanServices[0];
  let bestReasonType = "general";
  let bestScore = -1;

  for (const svc of cleanServices) {
    const sLower = svc.toLowerCase();
    let score = 0;
    let reasonType = "general";

    if (/photo|fotograf|video|visual|content|contenido/.test(sLower)) {
      reasonType = "photography";
      if (isFoodOrRetailOrVenue) score += 8;
      if (isRelocation) score += 6; // new 80-seat dining room / new venue visuals
      if (!isMultiSiteOrLease) score += 3;
    } else if (/bookkeep|contab|account|finanz|tax|impuesto|nómina|payroll/.test(sLower)) {
      reasonType = "bookkeeping";
      if (isMultiSiteOrLease) score += 10; // opening a 2nd location / Doral expansion / 4200 sqft lease
      if (isConsultingOrB2B) score += 5;
    } else if (/web|seo|diseño|design|sitio|digital|landing|ecommerce|e-commerce/.test(sLower)) {
      reasonType = "web";
      if (isRelocation) score += 7; // updating address, local search & reservations
      if (hay.includes("online") || hay.includes("shipping") || hay.includes("first florida")) score += 9;
      if (isMultiSiteOrLease) score += 6;
    } else if (/automat|crm|software|sistem|it|tech|datos/.test(sLower)) {
      reasonType = "automation";
      if (isConsultingOrB2B) score += 10;
      if (isMultiSiteOrLease) score += 7;
    } else if (/recruit|reclut|personal|staff|hr|rrhh|talento/.test(sLower)) {
      reasonType = "recruiting";
      if (isMultiSiteOrLease || isRelocation || isFoodOrRetailOrVenue) score += 7;
    } else if (/clean|limpieza|mantenim|signage|rotul|equip/.test(sLower)) {
      reasonType = "operations";
      if (isFoodOrRetailOrVenue || isRelocation) score += 7;
    }

    if (score > bestScore) {
      bestScore = score;
      bestService = svc;
      bestReasonType = reasonType;
    }
  }

  return {
    insufficientContext: false,
    service: bestService,
    reasonType: bestReasonType,
  };
}

/**
 * Builds a concise, non-generic 3-part explanation:
 * 1. What the business announced according to the source.
 * 2. Which single user service could relate to that change and why (or honest note if context is insufficient).
 * 3. What the user needs to confirm before reaching out.
 */
export function buildStructuredServiceFit(
  opportunity,
  selectedServices = [],
  _serviceDescription = "",
  lang = "en"
) {
  const isEs = lang === "es";
  const biz = opportunity?.business_name || (isEs ? "el negocio" : "the business");
  const loc = opportunity?.location || "";
  const isVerified = opportunity?.verification_status === "verified";
  const pubDate = formatDateValue(opportunity?.publication_date, lang);
  const evDate = formatDateValue(opportunity?.event_date, lang);
  const hasConfirmedDate =
    pubDate !== (isEs ? "Fecha no confirmada" : "Date not confirmed") ||
    evDate !== (isEs ? "Fecha no confirmada" : "Date not confirmed");

  const summarySentence = formatSignalSummary(opportunity, lang);
  const cleanServices = Array.isArray(selectedServices)
    ? selectedServices.filter((s) => typeof s === "string" && s.trim())
    : [];

  const match = selectRelevantServiceForOpportunity(opportunity, cleanServices);

  // Case 1: Source does not substantiate an opening or expansion announcement
  if (match?.insufficientContext) {
    if (isEs) {
      return `1. Qué dice la fuente: ${summarySentence} 2. Relación con tus servicios: No hay contexto suficiente en la fuente para recomendar un servicio específico, ya que la página recuperada no confirma un evento concreto de apertura o expansión. 3. Qué confirmar antes de contactar: Verifica en una fuente independiente si existe una apertura reciente o planeada, su fecha real y quién está a cargo antes de proponer cualquier servicio.`;
    }
    return `1. What the source states: ${summarySentence} 2. Relation to your services: There is not enough context in the recovered source to recommend a specific service because an opening or expansion event is not confirmed on the page. 3. What to confirm before reaching out: Check an independent source to verify whether an actual opening or expansion is taking place, its real date, and who leads the business before offering any service.`;
  }

  // Case 2: User has not configured services yet
  if (!match || !match.service) {
    if (isEs) {
      const confirmDates = !isVerified || !hasConfirmedDate
        ? "la fuente original y la fecha exacta del cambio, además de "
        : "";
      return `1. Qué anunció el negocio: ${summarySentence} 2. Relación con tus servicios: Aún no has añadido tus servicios en el perfil, por lo que no hay contexto suficiente para sugerir un servicio concreto. 3. Qué confirmar antes de contactar: Añade tus servicios en «Mis servicios» y confirma ${confirmDates}si ${biz} gestiona esta etapa internamente o si busca apoyo externo (el anuncio no confirma necesidad ni presupuesto).`;
    }
    const confirmDatesEn = !isVerified || !hasConfirmedDate
      ? "the original source and exact timeline, as well as "
      : "";
    return `1. What the business announced: ${summarySentence} 2. Relation to your services: You have not added your services to your profile yet, so there is not enough context to recommend a specific service. 3. What to confirm before reaching out: Add your services in "My services" and confirm ${confirmDatesEn}whether ${biz} handles this transition in-house or is open to external support (the announcement does not confirm need or budget).`;
  }

  const svc = match.service;
  const reasonType = match.reasonType;

  // Build specific reason linking the single chosen service to the specific announcement
  let serviceWhyEs = `Tu servicio de ${svc} podría relacionarse con esta etapa de ${biz}${loc ? ` en ${loc}` : ""} si están organizando la puesta en marcha del cambio anunciado.`;
  let serviceWhyEn = `Your ${svc} service could relate to ${biz}'s transition${loc ? ` in ${loc}` : ""} if they are organizing support for the announced change.`;

  if (reasonType === "photography") {
    serviceWhyEs = `Tu servicio de ${svc} podría encajar porque preparar un nuevo espacio, traslado o lanzamiento al público suele requerir fotografías actualizadas del local, producto o carta para su comunicación de apertura.`;
    serviceWhyEn = `Your ${svc} service could relate because preparing a new venue, relocation, or public launch can create a concrete moment to photograph the new space, menu, or storefront.`;
  } else if (reasonType === "bookkeeping") {
    serviceWhyEs = `Tu servicio de ${svc} podría relacionarse con este cambio porque abrir una sede adicional o firmar un nuevo arrendamiento implica organizar el control de costos, proveedores y registros contables de la nueva operación.`;
    serviceWhyEn = `Your ${svc} service could relate to this change because opening an additional branch or signing a new lease involves setting up expense tracking, vendor billing, and accounting for the new site.`;
  } else if (reasonType === "web") {
    serviceWhyEs = `Tu servicio de ${svc} podría relacionarse porque al abrir una nueva ubicación o trasladarse en ${loc || "la ciudad"} suele ser útil actualizar la información de la sede, horarios y presencia local de búsqueda.`;
    serviceWhyEn = `Your ${svc} service could relate because opening a new location or relocating in ${loc || "the area"} often involves updating location pages, hours, and local search visibility.`;
  } else if (reasonType === "automation") {
    serviceWhyEs = `Tu servicio de ${svc} podría relacionarse si la ampliación de operaciones en ${loc || "su mercado"} requiere organizar el flujo de consultas, reservas o seguimiento de clientes entre equipos.`;
    serviceWhyEn = `Your ${svc} service could relate if expanding operations in ${loc || "their market"} involves coordinating client inquiries, bookings, or follow-up workflows.`;
  } else if (reasonType === "recruiting") {
    serviceWhyEs = `Tu servicio de ${svc} podría relacionarse porque habilitar un nuevo local o ampliar capacidad suele requerir incorporar personal operativo antes de la apertura.`;
    serviceWhyEn = `Your ${svc} service could relate because opening a new site or expanding capacity often requires hiring operational staff ahead of launch.`;
  }

  const verifyClauseEs = !isVerified || !hasConfirmedDate
    ? `revisa manualmente el enlace de la fuente para confirmar la fecha exacta y los detalles pendientes; además, verifica quién coordina el proyecto en ${biz} y si ya tienen cubierto ${svc} (el anuncio público no confirma necesidad activa, problemas técnicos ni presupuesto).`
    : `confirma quién lidera la apertura o expansión en ${biz}, en qué fase del calendario se encuentran y si ya tienen resuelto ${svc} internamente (el anuncio público no confirma necesidad activa ni presupuesto).`;

  const verifyClauseEn = !isVerified || !hasConfirmedDate
    ? `manually check the source link to confirm the exact date and pending details; also verify who coordinates the project at ${biz} and whether ${svc} is already covered (the public announcement does not confirm active need, technical issues, or budget).`
    : `confirm who leads the opening or expansion at ${biz}, where they are in their schedule, and whether ${svc} is already handled in-house (the public announcement does not confirm active need or budget).`;

  if (isEs) {
    return `1. Qué anunció el negocio: ${summarySentence} 2. Servicio relacionado (${svc}): ${serviceWhyEs} 3. Qué confirmar antes de contactar: Antes de escribirles, ${verifyClauseEs}`;
  }

  return `1. What the business announced: ${summarySentence} 2. Related service (${svc}): ${serviceWhyEn} 3. What to confirm before reaching out: Before contacting them, ${verifyClauseEn}`;
}