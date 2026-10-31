// Legacy ID map so earlier profiles stored with enum IDs migrate seamlessly to readable service names
export const LEGACY_SERVICE_LABELS = {
  web_design_seo: "Web design & SEO",
  ecommerce: "E-commerce",
  automation_crm: "Automation & CRM",
};

// Optional starter examples — never a closed taxonomy
export const SERVICE_EXAMPLES = [
  "Accounting",
  "Photography",
  "Recruiting",
  "Cleaning",
  "Web design",
  "Automation",
];

// Initial configurable usage and execution limits enforced on the server
export const SEARCH_LIMITS = {
  maxDailyNewSearches: 3,
  maxResultsPerSearch: 5,
  maxConcurrentSearches: 1,
  cacheTtlHours: 24,
  cacheTtlMs: 24 * 60 * 60 * 1000,
  providerTimeoutMs: 25000,
  sourceFetchTimeoutMs: 6500,
  maxTransientRetries: 1,
};

/**
 * Normalizes a search query into a deterministic per-user cache key.
 */
export function buildQueryCacheKey(businessCategory, locationQuery, timeWindowDays) {
  const cat = String(businessCategory || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const loc = String(locationQuery || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const days = Number(timeWindowDays) || 90;
  return `${cat}::${loc}::${days}`;
}

/**
 * Normalizes, migrates legacy IDs, trims whitespace, and deduplicates service names
 * case-insensitively while preserving the user's preferred casing.
 */
export function normalizeServicesList(rawList) {
  if (!Array.isArray(rawList)) return [];
  const seen = new Set();
  const result = [];

  for (const item of rawList) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const migrated = LEGACY_SERVICE_LABELS[trimmed] || trimmed;
    const key = migrated.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(migrated);
    }
  }
  return result;
}

/**
 * Human-readable label for recency basis (bilingual: en / es).
 */
export function formatRecencyBasisLabel(recencyBasis, lang = "en") {
  if (lang === "es") {
    if (recencyBasis === "announcement_date") {
      return "Vigencia basada en fecha del anuncio";
    }
    if (recencyBasis === "event_date") {
      return "Vigencia basada en fecha del evento";
    }
    return "Fecha de vigencia sin verificar";
  }
  if (recencyBasis === "announcement_date") {
    return "Recency based on announcement date";
  }
  if (recencyBasis === "event_date") {
    return "Recency based on event date";
  }
  return "Recency date unverified";
}

/**
 * Builds a plain-language, clearly labeled service-fit inference based on the user's
 * actual custom services and optional description, without overclaiming verified need,
 * contacts, technical defects, budgets, or buying intent.
 */
export function buildServiceFitHypothesis(
  opportunity,
  selectedServices = [],
  serviceDescription = "",
  lang = "en"
) {
  const cleanServices = normalizeServicesList(selectedServices);
  const desc = (serviceDescription || "").trim();

  if (lang === "es") {
    if (cleanServices.length > 0) {
      const servicesText = cleanServices.join(", ");
      const signalContext = opportunity?.signal_type
        ? `durante un evento de "${opportunity.signal_type}"`
        : "al abrir o expandir operaciones";
      const descClause = desc
        ? ` Según la descripción de tu oferta (${desc}), este momento puede ser relevante para evaluar.`
        : "";
      return `Hipótesis para ${servicesText}: Los negocios ${signalContext} suelen evaluar proveedores externos y soporte operativo al habilitar una nueva sede o ampliar capacidad.${descClause} La evidencia pública de apertura o expansión no confirma presupuesto, defectos técnicos ni intención activa de compra.`;
    }
    if (opportunity?.service_fit_inference) {
      return opportunity.service_fit_inference.replace(
        /^INFERENCE \(Not a verified fact\):\s*/i,
        "Hipótesis: "
      );
    }
    return "Hipótesis: Los negocios en apertura o expansión suelen evaluar servicios profesionales externos durante su lanzamiento o crecimiento, aunque los anuncios públicos no confirman presupuesto ni intención activa de compra.";
  }

  if (cleanServices.length > 0) {
    const servicesText = cleanServices.join(", ");
    const signalContext = opportunity?.signal_type
      ? `during a ${opportunity.signal_type.toLowerCase()}`
      : "when opening or expanding";

    const descClause = desc
      ? ` Based on your offer description (${desc}), this timing may be relevant to review.`
      : "";

    return `Hypothesis for ${servicesText}: Businesses ${signalContext} often evaluate external providers and operational support while setting up a new site or expanding capacity.${descClause} Public opening or expansion evidence does not confirm budget, technical defects, or active buying intent.`;
  }

  if (opportunity?.service_fit_inference) {
    return opportunity.service_fit_inference.replace(
      /^INFERENCE \(Not a verified fact\):\s*/i,
      "Hypothesis: "
    );
  }

  return "Hypothesis: Opening or expanding locations may evaluate external business services during launch or growth, though public announcements do not confirm budget or active buying intent.";
}

// Sample opportunities kept strictly for the optional "Example results" view (excluded from live metrics)
export const EXAMPLE_OPPORTUNITIES = [
  {
    id: "demo-opp-1",
    is_example: true,
    business_name: "Harborview Physical Therapy & Sports Rehab",
    business_category: "Healthcare & Outpatient Clinics",
    location: "Austin, TX, USA",
    website_url: "https://example.com/harborview-pt",
    signal_type: "Second clinic expansion",
    signal_summary:
      "Signed a 4,200 sq. ft. commercial lease in North Shoal Creek to open a second outpatient orthopedic rehabilitation clinic.",
    source_title: "Austin Business Journal — Commercial Real Estate Deals",
    source_url: "https://example.com/news/harborview-lease-north-shoal",
    supporting_excerpt:
      "\"Harborview Physical Therapy LLC has leased 4,200 square feet at 7800 Burnet Road, marking the practice's second Austin-area clinic following its South Lamar location.\"",
    publication_date: "2026-09-18",
    event_date: "2026-11-15 (Planned opening)",
    retrieval_date: "2026-10-31",
    recency_basis: "announcement_date",
    verification_status: "verified",
    verification_notes: "Sample demonstration record.",
    evidence_status: "verified_excerpt",
    service_fit_inference:
      "Hypothesis: Expanding from one clinic to a second physical location often involves new vendor onboarding, staffing, local marketing, and operational setup.",
    evidence_items: [
      {
        id: "demo-ev-1a",
        source_title: "Austin Business Journal — Commercial Real Estate Deals",
        source_url: "https://example.com/news/harborview-lease-north-shoal",
        supporting_excerpt:
          "\"Harborview Physical Therapy LLC has leased 4,200 square feet at 7800 Burnet Road, marking the practice's second Austin-area clinic.\"",
        publication_date: "2026-09-18",
        event_date: "2026-11-15",
        retrieval_date: "2026-10-31",
        recency_basis: "announcement_date",
        verification_status: "verified",
        evidence_status: "verified_excerpt",
      },
    ],
  },
  {
    id: "demo-opp-2",
    is_example: true,
    business_name: "Loma Linda Specialty Roasters & Bakery",
    business_category: "Food & Beverage / Specialty Retail",
    location: "Austin, TX, USA",
    website_url: "https://example.com/lomalinda-roasters",
    signal_type: "New flagship roastery & retail launch",
    signal_summary:
      "Transitioning from wholesale-only coffee roasting to a public retail cafe and packaged bean storefront in East Austin.",
    source_title: "Eater Austin — Fall Openings Tracker",
    source_url: "https://example.com/eater/loma-linda-roastery-opening",
    supporting_excerpt:
      "\"Wholesale coffee supplier Loma Linda Roasters is opening its first public-facing cafe and retail bean shop on East Cesar Chavez this November, complete with nationwide bag shipping.\"",
    publication_date: "2026-10-04",
    event_date: "2026-11-20 (Target launch)",
    retrieval_date: "2026-10-31",
    recency_basis: "announcement_date",
    verification_status: "verified",
    verification_notes: "Sample demonstration record.",
    evidence_status: "verified_excerpt",
    service_fit_inference:
      "Hypothesis: Moving from wholesale into retail and packaged goods commonly requires product photography, retail bookkeeping, storefront upkeep, and online ordering setup.",
    evidence_items: [
      {
        id: "demo-ev-2a",
        source_title: "Eater Austin — Fall Openings Tracker",
        source_url: "https://example.com/eater/loma-linda-roastery-opening",
        supporting_excerpt:
          "\"Wholesale coffee supplier Loma Linda Roasters is opening its first public-facing cafe and retail bean shop on East Cesar Chavez this November, complete with nationwide bag shipping.\"",
        publication_date: "2026-10-04",
        event_date: "2026-11-20",
        retrieval_date: "2026-10-31",
        recency_basis: "announcement_date",
        verification_status: "verified",
        evidence_status: "verified_excerpt",
      },
    ],
  },
];