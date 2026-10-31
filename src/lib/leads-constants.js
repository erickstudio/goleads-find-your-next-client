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
 * Builds a plain-language, clearly labeled service-fit inference based on the user's
 * actual custom services and optional description, without overclaiming verified need.
 */
export function buildServiceFitHypothesis(opportunity, selectedServices = [], serviceDescription = "") {
  const cleanServices = normalizeServicesList(selectedServices);
  const desc = (serviceDescription || "").trim();

  if (cleanServices.length > 0) {
    const servicesText = cleanServices.join(", ");
    const signalContext = opportunity?.signal_type
      ? `during a ${opportunity.signal_type.toLowerCase()}`
      : "when opening or expanding";

    const descClause = desc
      ? ` Based on what you offer (${desc}), this timing may be worth reviewing.`
      : "";

    return `Possible fit for ${servicesText}: Businesses ${signalContext} often review outside vendors and operational support as they set up a new site or expand capacity.${descClause} Opening or expansion does not confirm budget or an active need.`;
  }

  if (opportunity?.service_fit_inference) {
    return opportunity.service_fit_inference.replace(/^INFERENCE \(Not a verified fact\):\s*/i, "Possible fit: ");
  }

  return "Possible fit: Opening or expanding locations can create demand for external business services, though expansion alone does not confirm budget or active buying intent.";
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
    evidence_status: "Verified excerpt",
    service_fit_inference:
      "Possible fit: Expanding from one clinic to a second physical location often involves new vendor onboarding, staffing, local marketing, and operational setup.",
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
        evidence_status: "Verified excerpt",
      },
      {
        id: "demo-ev-1b",
        source_title: "City of Austin Commercial Remodel Permit #2026-098412",
        source_url: "https://example.com/permits/2026-098412",
        supporting_excerpt:
          "\"Tenant finish-out for outpatient medical office at 7800 Burnet Rd Ste 120. Applicant: Harborview Physical Therapy LLC.\"",
        publication_date: "2026-09-24",
        event_date: null,
        retrieval_date: "2026-10-31",
        evidence_status: "Corroborated permit",
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
    evidence_status: "Verified excerpt",
    service_fit_inference:
      "Possible fit: Moving from wholesale into retail and packaged goods commonly requires product photography, retail bookkeeping, storefront upkeep, and online ordering setup.",
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
        evidence_status: "Verified excerpt",
      },
    ],
  },
  {
    id: "demo-opp-3",
    is_example: true,
    business_name: "Bluebonnet Veterinary Urgent Care",
    business_category: "Veterinary & Pet Care",
    location: "Round Rock / Austin Metro, TX, USA",
    website_url: null,
    signal_type: "New clinic opening",
    signal_summary:
      "Newly formed veterinary urgent care clinic preparing to open evening and weekend walk-in services in Round Rock.",
    source_title: "Community Impact — Round Rock / Pflugerville Edition",
    source_url: "https://example.com/community-impact/bluebonnet-vet-opening",
    supporting_excerpt:
      "\"Dr. Elena Vance announced that Bluebonnet Veterinary Urgent Care will begin serving patients at 1401 E. Palm Valley Blvd in early December. A clinic website has not yet been published.\"",
    publication_date: "2026-10-12",
    event_date: "2026-12-05 (Planned opening)",
    retrieval_date: "2026-10-31",
    evidence_status: "Verified excerpt",
    service_fit_inference:
      "Possible fit: A newly launching clinic with no published website yet may evaluate web design, staff recruiting, medical facility cleaning, and local launch support.",
    evidence_items: [
      {
        id: "demo-ev-3a",
        source_title: "Community Impact — Round Rock / Pflugerville Edition",
        source_url: "https://example.com/community-impact/bluebonnet-vet-opening",
        supporting_excerpt:
          "\"Dr. Elena Vance announced that Bluebonnet Veterinary Urgent Care will begin serving patients at 1401 E. Palm Valley Blvd in early December. A clinic website has not yet been published.\"",
        publication_date: "2026-10-12",
        event_date: "2026-12-05",
        retrieval_date: "2026-10-31",
        evidence_status: "Verified excerpt",
      },
    ],
  },
];