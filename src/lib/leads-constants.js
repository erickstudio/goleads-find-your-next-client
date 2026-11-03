import { buildStructuredServiceFit } from "@/lib/opportunity-copy";

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
  return buildStructuredServiceFit(opportunity, cleanServices, serviceDescription, lang);
}

// Sample opportunities kept strictly for the prepared demonstration view (excluded from live metrics, quotas, and saved leads)
export const EXAMPLE_OPPORTUNITIES = [
  {
    id: "demo-opp-1",
    is_example: true,
    demo_scenario: "opening",
    business_name: "Loma Linda Specialty Roasters & Bakery",
    business_category: "Food & Beverage / Specialty Retail",
    location: "Austin, TX, USA",
    website_url: "https://example.com/lomalinda-roasters",
    public_email: "hello@lomalindaroasters.demo",
    public_phone: "+1 (512) 840-2910",
    signal_type: "New opening",
    signal_summary:
      "Transitioning from wholesale-only coffee roasting to a public retail cafe and packaged bean storefront in East Austin.",
    source_title: "Ejemplo ficticio: Eater Austin — Fall Openings",
    source_url: "https://example.com/demo/loma-linda-roastery-opening",
    supporting_excerpt:
      "\"Wholesale coffee supplier Loma Linda Roasters is opening its first public-facing cafe and retail bean shop on East Cesar Chavez on November 20, 2026, complete with nationwide bag shipping.\"",
    publication_date: "2026-10-04",
    event_date: "2026-11-20 (Planned opening)",
    retrieval_date: "2026-10-31T14:00:00Z",
    recency_basis: "announcement_date",
    verification_status: "verified",
    verification_notes: "Sample demonstration record.",
    evidence_status: "verified_excerpt",
    service_fit_inference:
      "Hypothesis: Moving from wholesale into retail and packaged goods commonly requires product photography, retail bookkeeping, storefront upkeep, and online ordering setup.",
    evidence_items: [
      {
        id: "demo-ev-1a",
        source_title: "Ejemplo ficticio: Eater Austin — Fall Openings",
        source_url: "https://example.com/demo/loma-linda-roastery-opening",
        supporting_excerpt:
          "\"Wholesale coffee supplier Loma Linda Roasters is opening its first public-facing cafe and retail bean shop on East Cesar Chavez on November 20, 2026, complete with nationwide bag shipping.\"",
        publication_date: "2026-10-04",
        event_date: "2026-11-20",
        retrieval_date: "2026-10-31T14:00:00Z",
        recency_basis: "announcement_date",
        verification_status: "verified",
        evidence_status: "verified_excerpt",
      },
    ],
  },
  {
    id: "demo-opp-2",
    is_example: true,
    demo_scenario: "expansion",
    business_name: "Harborview Physical Therapy & Sports Rehab",
    business_category: "Healthcare & Outpatient Clinics",
    location: "Austin, TX, USA",
    website_url: "https://example.com/harborview-pt",
    signal_type: "Expansion",
    signal_summary:
      "Signed a 4,200 sq. ft. commercial lease in North Shoal Creek to open a second outpatient orthopedic rehabilitation clinic.",
    source_title: "Ejemplo ficticio: Austin Business Report — Commercial Leases",
    source_url: "https://example.com/demo/harborview-lease-north-shoal",
    supporting_excerpt:
      "\"Harborview Physical Therapy LLC has leased 4,200 square feet at 7800 Burnet Road, marking the practice's second Austin-area clinic following its South Lamar location.\"",
    publication_date: "2026-09-18",
    event_date: "2026-11-15 (Planned opening)",
    retrieval_date: "2026-10-31T14:00:00Z",
    recency_basis: "announcement_date",
    verification_status: "verified",
    verification_notes: "Sample demonstration record.",
    evidence_status: "verified_excerpt",
    service_fit_inference:
      "Hypothesis: Expanding from one clinic to a second physical location often involves new vendor onboarding, staffing, local marketing, and operational setup.",
    evidence_items: [
      {
        id: "demo-ev-2a",
        source_title: "Ejemplo ficticio: Austin Business Report — Commercial Leases",
        source_url: "https://example.com/demo/harborview-lease-north-shoal",
        supporting_excerpt:
          "\"Harborview Physical Therapy LLC has leased 4,200 square feet at 7800 Burnet Road, marking the practice's second Austin-area clinic.\"",
        publication_date: "2026-09-18",
        event_date: "2026-11-15",
        retrieval_date: "2026-10-31T14:00:00Z",
        recency_basis: "announcement_date",
        verification_status: "verified",
        evidence_status: "verified_excerpt",
      },
    ],
  },
  {
    id: "demo-opp-3",
    is_example: true,
    demo_scenario: "relocation",
    business_name: "Atelier Nueve Design & Print Studio",
    business_category: "Commercial Print & Creative Studio",
    location: "Miami, FL, USA",
    website_url: "https://example.com/atelier-nueve",
    signal_type: "Relocation",
    signal_summary:
      "Graphic design and commercial print studio relocating to a larger 3,500 sq. ft. production space and showroom in Miami's Wynwood district.",
    source_title: "Ejemplo ficticio: South Florida Business Notices",
    source_url: "https://example.com/demo/atelier-nueve-wynwood-relocation",
    supporting_excerpt:
      "\"El estudio de diseño e impresión Atelier Nueve se traslada este trimestre a un nuevo espacio de 3.500 pies cuadrados en Wynwood para ampliar su sala de muestras y capacidad de producción.\"",
    publication_date: "2026-10-12",
    event_date: "",
    retrieval_date: "2026-10-31T14:00:00Z",
    recency_basis: "announcement_date",
    verification_status: "needs_review",
    verification_notes:
      "Sample demonstration record showing a candidate with confirmed publication date (2026-10-12) where the exact moving day is not stated yet.",
    evidence_status: "partial_date_verification",
    service_fit_inference:
      "Hypothesis: Relocating to a larger production studio and client showroom often involves updating local search profiles, signage, interior photography, and vendor contracts.",
    evidence_items: [
      {
        id: "demo-ev-3a",
        source_title: "Ejemplo ficticio: South Florida Business Notices",
        source_url: "https://example.com/demo/atelier-nueve-wynwood-relocation",
        supporting_excerpt:
          "\"El estudio de diseño e impresión Atelier Nueve se traslada este trimestre a un nuevo espacio de 3.500 pies cuadrados en Wynwood para ampliar su sala de muestras y capacidad de producción.\"",
        publication_date: "2026-10-12",
        event_date: "",
        retrieval_date: "2026-10-31T14:00:00Z",
        recency_basis: "announcement_date",
        verification_status: "needs_review",
        evidence_status: "partial_date_verification",
      },
    ],
  },
];