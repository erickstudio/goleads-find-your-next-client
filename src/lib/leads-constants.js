export const SERVICE_CATEGORIES = [
  {
    id: "web_design_seo",
    label: "Web Design & SEO",
    shortLabel: "Web & SEO",
    description:
      "Site builds, redesigns, local search visibility, Google Business Profile optimization, and location landing pages for newly opening or expanding locations.",
  },
  {
    id: "ecommerce",
    label: "E-commerce Services",
    shortLabel: "E-commerce",
    description:
      "Online storefront launches, catalog migration, omnichannel checkout, and direct-to-consumer expansion for physical retailers or growing brands.",
  },
  {
    id: "automation_crm",
    label: "Automation & CRM Services",
    shortLabel: "Automation & CRM",
    description:
      "Lead routing, booking workflows, client intake pipelines, and multi-location CRM architecture for growing service businesses.",
  },
];

export const SEARCH_STATES = {
  not_configured: {
    id: "not_configured",
    label: "Not Configured",
    badgeClass: "bg-amber-50 text-amber-900 border-amber-300",
    dotClass: "bg-amber-500",
    title: "Live Web Discovery Integration Not Yet Configured",
    description:
      "Live search cannot pretend to run until a verified grounded web-search pipeline is connected and tested. No fake leads are seeded into your live workspace.",
  },
  ready: {
    id: "ready",
    label: "Ready",
    badgeClass: "bg-slate-100 text-slate-800 border-slate-300",
    dotClass: "bg-slate-500",
    title: "Ready to Search",
    description:
      "Enter a business category, target city/country, and signal window (30, 90, or 180 days) to inspect verified opening or expansion signals.",
  },
  searching: {
    id: "searching",
    label: "Searching",
    badgeClass: "bg-blue-50 text-blue-800 border-blue-300",
    dotClass: "bg-blue-600 animate-pulse",
    title: "Inspecting Grounded Public Sources…",
    description:
      "Querying public municipal records, local press announcements, and commercial expansion filings for verifiable signals.",
  },
  partial: {
    id: "partial",
    label: "Partial Evidence",
    badgeClass: "bg-amber-50 text-amber-900 border-amber-300",
    dotClass: "bg-amber-500",
    title: "Partial Results Returned",
    description:
      "Some candidate businesses were found, but one or more records lack complete publication dates or independent secondary corroboration.",
  },
  empty: {
    id: "empty",
    label: "Empty",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
    dotClass: "bg-slate-400",
    title: "No Verifiable Opening or Expansion Signals Found",
    description:
      "No businesses matched your criteria with verifiable public source citations inside the selected time window.",
  },
  failed: {
    id: "failed",
    label: "Failed",
    badgeClass: "bg-red-50 text-red-900 border-red-300",
    dotClass: "bg-red-600",
    title: "Discovery Request Failed",
    description:
      "The discovery provider encountered an error or failed grounding verification. No unverified records were saved.",
  },
  completed: {
    id: "completed",
    label: "Completed",
    badgeClass: "bg-emerald-50 text-emerald-900 border-emerald-300",
    dotClass: "bg-emerald-600",
    title: "Discovery Completed",
    description:
      "Showing up to 5 opportunities with dated supporting source excerpts and clearly separated service-fit inferences.",
  },
};

// Isolated strictly for visual inspection in Demo Fixture Mode — never written to live DB or counted in usage metrics
export const DEMO_FIXTURE_OPPORTUNITIES = [
  {
    id: "demo-opp-1",
    is_demo_fixture: true,
    business_name: "Harborview Physical Therapy & Sports Rehab",
    business_category: "Healthcare & Outpatient Clinics",
    location: "Austin, TX, USA",
    website_url: "https://example.com/harborview-pt-demo",
    signal_type: "Second Clinic Expansion",
    signal_summary:
      "Signed a 4,200 sq. ft. commercial lease in North Shoal Creek to open a second outpatient orthopedic rehabilitation clinic.",
    source_title: "[DEMO FIXTURE] Austin Business Journal — Commercial Real Estate Deals",
    source_url: "https://example.com/news/harborview-lease-north-shoal",
    supporting_excerpt:
      "\"Harborview Physical Therapy LLC has leased 4,200 square feet at 7800 Burnet Road, marking the practice's second Austin-area clinic following its South Lamar location.\"",
    publication_date: "2026-09-18",
    event_date: "2026-11-15 (Planned Opening)",
    retrieval_date: "2026-10-31",
    evidence_status: "verified_excerpt",
    inferred_service_categories: ["web_design_seo", "automation_crm"],
    service_fit_inference:
      "INFERENCE (Not a verified fact): Moving from one clinic to two locations commonly requires multi-location local SEO pages, separate Google Business Profile structures, and centralized patient intake/appointment routing.",
    evidence_items: [
      {
        id: "demo-ev-1a",
        source_title: "[DEMO FIXTURE] Austin Business Journal — Commercial Real Estate Deals",
        source_url: "https://example.com/news/harborview-lease-north-shoal",
        supporting_excerpt:
          "\"Harborview Physical Therapy LLC has leased 4,200 square feet at 7800 Burnet Road, marking the practice's second Austin-area clinic.\"",
        publication_date: "2026-09-18",
        event_date: "2026-11-15",
        retrieval_date: "2026-10-31",
        evidence_status: "verified_excerpt",
      },
      {
        id: "demo-ev-1b",
        source_title: "[DEMO FIXTURE] City of Austin Commercial Remodel Permit #2026-098412",
        source_url: "https://example.com/permits/2026-098412",
        supporting_excerpt:
          "\"Tenant finish-out for outpatient medical office at 7800 Burnet Rd Ste 120. Applicant: Harborview Physical Therapy LLC.\"",
        publication_date: "2026-09-24",
        event_date: null,
        retrieval_date: "2026-10-31",
        evidence_status: "corroborated_permit",
      },
    ],
  },
  {
    id: "demo-opp-2",
    is_demo_fixture: true,
    business_name: "Loma Linda Specialty Roasters & Bakery",
    business_category: "Food & Beverage / Specialty Retail",
    location: "Austin, TX, USA",
    website_url: "https://example.com/lomalinda-roasters-demo",
    signal_type: "New Flagship Roastery & Retail Launch",
    signal_summary:
      "Announced transition from wholesale-only coffee roasting to a public retail cafe and packaged bean storefront in East Austin.",
    source_title: "[DEMO FIXTURE] Eater Austin — Fall Openings Tracker",
    source_url: "https://example.com/eater/loma-linda-roastery-opening",
    supporting_excerpt:
      "\"Wholesale coffee supplier Loma Linda Roasters is opening its first public-facing cafe and retail bean shop on East Cesar Chavez this November, complete with nationwide bag shipping.\"",
    publication_date: "2026-10-04",
    event_date: "2026-11-20 (Target Launch)",
    retrieval_date: "2026-10-31",
    evidence_status: "verified_excerpt",
    inferred_service_categories: ["ecommerce", "web_design_seo"],
    service_fit_inference:
      "INFERENCE (Not a verified fact): Launching packaged retail coffee with nationwide shipping alongside a first physical storefront may create an opportunity for subscription e-commerce setup and local search discovery.",
    evidence_items: [
      {
        id: "demo-ev-2a",
        source_title: "[DEMO FIXTURE] Eater Austin — Fall Openings Tracker",
        source_url: "https://example.com/eater/loma-linda-roastery-opening",
        supporting_excerpt:
          "\"Wholesale coffee supplier Loma Linda Roasters is opening its first public-facing cafe and retail bean shop on East Cesar Chavez this November, complete with nationwide bag shipping.\"",
        publication_date: "2026-10-04",
        event_date: "2026-11-20",
        retrieval_date: "2026-10-31",
        evidence_status: "verified_excerpt",
      },
    ],
  },
  {
    id: "demo-opp-3",
    is_demo_fixture: true,
    business_name: "Bluebonnet Veterinary Urgent Care",
    business_category: "Veterinary & Pet Care",
    location: "Round Rock / Austin Metro, TX, USA",
    website_url: null,
    signal_type: "New Business Opening",
    signal_summary:
      "Newly formed veterinary urgent care clinic preparing to open evening and weekend walk-in services in Round Rock.",
    source_title: "[DEMO FIXTURE] Community Impact — Round Rock / Pflugerville Edition",
    source_url: "https://example.com/community-impact/bluebonnet-vet-opening",
    supporting_excerpt:
      "\"Dr. Elena Vance announced that Bluebonnet Veterinary Urgent Care will begin serving patients at 1401 E. Palm Valley Blvd in early December. A clinic website has not yet been published.\"",
    publication_date: "2026-10-12",
    event_date: "2026-12-05 (Planned Opening)",
    retrieval_date: "2026-10-31",
    evidence_status: "verified_excerpt",
    inferred_service_categories: ["web_design_seo", "automation_crm"],
    service_fit_inference:
      "INFERENCE (Not a verified fact): No known public website was cited at publication time; an urgent-care veterinary clinic often benefits from an initial web presence, local urgent-care search indexing, and digital check-in/waitlist forms.",
    evidence_items: [
      {
        id: "demo-ev-3a",
        source_title: "[DEMO FIXTURE] Community Impact — Round Rock / Pflugerville Edition",
        source_url: "https://example.com/community-impact/bluebonnet-vet-opening",
        supporting_excerpt:
          "\"Dr. Elena Vance announced that Bluebonnet Veterinary Urgent Care will begin serving patients at 1401 E. Palm Valley Blvd in early December. A clinic website has not yet been published.\"",
        publication_date: "2026-10-12",
        event_date: "2026-12-05",
        retrieval_date: "2026-10-31",
        evidence_status: "verified_excerpt",
      },
    ],
  },
  {
    id: "demo-opp-4",
    is_demo_fixture: true,
    business_name: "Vanguard Precision HVAC & Mechanical",
    business_category: "Home & Commercial Services",
    location: "Austin, TX, USA",
    website_url: "https://example.com/vanguard-hvac-demo",
    signal_type: "Service Fleet & Territory Expansion",
    signal_summary:
      "Added a new commercial dispatch warehouse in South Austin and announced expansion into residential maintenance memberships.",
    source_title: "[DEMO FIXTURE] PR Newswire / Regional Contractor Bulletin",
    source_url: "https://example.com/pr/vanguard-hvac-south-austin",
    supporting_excerpt:
      "\"Vanguard Precision Mechanical has opened a 12-bay dispatch facility near St. Elmo and launched its new residential service division covering Travis and Hays counties.\"",
    publication_date: "2026-08-29",
    event_date: "2026-09-01",
    retrieval_date: "2026-10-31",
    evidence_status: "partial_date_verification",
    inferred_service_categories: ["automation_crm", "web_design_seo"],
    service_fit_inference:
      "INFERENCE (Not a verified fact): Expanding from commercial-only work into residential service memberships could involve CRM pipeline segmentation, automated recurring maintenance reminders, and residential service-area SEO pages.",
    evidence_items: [
      {
        id: "demo-ev-4a",
        source_title: "[DEMO FIXTURE] PR Newswire / Regional Contractor Bulletin",
        source_url: "https://example.com/pr/vanguard-hvac-south-austin",
        supporting_excerpt:
          "\"Vanguard Precision Mechanical has opened a 12-bay dispatch facility near St. Elmo and launched its new residential service division covering Travis and Hays counties.\"",
        publication_date: "2026-08-29",
        event_date: "2026-09-01",
        retrieval_date: "2026-10-31",
        evidence_status: "partial_date_verification",
      },
    ],
  },
  {
    id: "demo-opp-5",
    is_demo_fixture: true,
    business_name: "Atelier Solis Home & Botanical Goods",
    business_category: "Boutique Retail & Home Goods",
    location: "Austin, TX, USA",
    website_url: "https://example.com/atelier-solis-demo",
    signal_type: "Brick-and-Mortar Annex & Online Catalog Expansion",
    signal_summary:
      "Expanded existing South Congress studio into an adjacent storefront to house custom ceramics and an online registry line.",
    source_title: "[DEMO FIXTURE] Austin Monthly — Retail & Design Notes",
    source_url: "https://example.com/austin-monthly/atelier-solis-expansion",
    supporting_excerpt:
      "\"Atelier Solis has doubled its retail footprint by taking over the adjoining suite on South Congress, preparing to debut a 150-piece housewares line for in-store and online orders.\"",
    publication_date: "2026-10-19",
    event_date: "2026-11-10",
    retrieval_date: "2026-10-31",
    evidence_status: "verified_excerpt",
    inferred_service_categories: ["ecommerce", "web_design_seo"],
    service_fit_inference:
      "INFERENCE (Not a verified fact): Debuting a 150-piece housewares catalog for both in-store and online orders may create demand for Shopify/e-commerce catalog structuring, inventory sync, and product schema SEO.",
    evidence_items: [
      {
        id: "demo-ev-5a",
        source_title: "[DEMO FIXTURE] Austin Monthly — Retail & Design Notes",
        source_url: "https://example.com/austin-monthly/atelier-solis-expansion",
        supporting_excerpt:
          "\"Atelier Solis has doubled its retail footprint by taking over the adjoining suite on South Congress, preparing to debut a 150-piece housewares line for in-store and online orders.\"",
        publication_date: "2026-10-19",
        event_date: "2026-11-10",
        retrieval_date: "2026-10-31",
        evidence_status: "verified_excerpt",
      },
    ],
  },
];