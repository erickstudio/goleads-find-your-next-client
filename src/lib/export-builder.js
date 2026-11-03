function normalizeNameKey(name = "") {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function formatPlaceStatus(rawStatus = "", es = true) {
  const s = String(rawStatus || "").toUpperCase();
  if (!s) return "";
  if (s === "OPERATIONAL") return es ? "Operativo" : "Operational";
  if (s === "CLOSED_TEMPORARILY") return es ? "Cerrado temporalmente" : "Temporarily closed";
  if (s === "CLOSED_PERMANENTLY") return es ? "Cerrado permanentemente" : "Permanently closed";
  return rawStatus;
}

function formatVerificationStatus(rawStatus = "", isLocalOnly = false, es = true) {
  if (isLocalOnly) {
    return es ? "Ficha local en vivo (Google Places)" : "Live local listing (Google Places)";
  }
  if (rawStatus === "verified") {
    return es ? "Verificado en fuente web" : "Verified against web source";
  }
  return es ? "Requiere revisión manual" : "Needs manual review";
}

function formatCommercialStage(rawStage = "", es = true) {
  const mapEs = {
    saved: "Guardado",
    researching: "En investigación",
    qualified: "Calificado",
    archived: "Archivado",
    unsaved: "Sin guardar",
  };
  const mapEn = {
    saved: "Saved",
    researching: "Researching",
    qualified: "Qualified",
    archived: "Archived",
    unsaved: "Unsaved",
  };
  const key = String(rawStage || "unsaved").toLowerCase();
  return (es ? mapEs[key] : mapEn[key]) || rawStage || "";
}

function formatRelevanceVerdict(rawVerdict = "", es = true) {
  const mapEs = {
    relevant: "Relevante",
    not_relevant: "No relevante",
    weak_evidence: "Evidencia débil",
    already_client: "Ya es cliente",
    out_of_territory: "Fuera de territorio",
    unrated: "Sin evaluar",
  };
  const mapEn = {
    relevant: "Relevant",
    not_relevant: "Not relevant",
    weak_evidence: "Weak evidence",
    already_client: "Already client",
    out_of_territory: "Out of territory",
    unrated: "Unrated",
  };
  const key = String(rawVerdict || "unrated").toLowerCase();
  return (es ? mapEs[key] : mapEn[key]) || rawVerdict || "";
}

/**
 * Merges AI opportunities (with their matched Google Places venue details) and
 * standalone Google Places local results into a unified, deduplicated, structured dataset.
 */
export function buildUnifiedExportItems({
  records = [],
  localPlaces = [],
  savedByOppId = new Map(),
  feedbackByOppId = new Map(),
  lang = "es",
}) {
  const es = lang !== "en";
  const seenPlaceIds = new Set();
  const seenNameKeys = new Set();
  const items = [];

  // 1. Add AI opportunities (enriched with matched Google Places data if available)
  for (const rec of records || []) {
    const oppId = rec.opportunity_id || rec.id || "";
    const savedMatch = savedByOppId.get(oppId);
    const fbMatch = feedbackByOppId.get(oppId);

    const bizName = String(rec.business_name || savedMatch?.business_name || "").trim();
    const nameKey = normalizeNameKey(bizName);

    // Check if any passed localPlace matches this AI opportunity to enrich it on the fly
    const matchedLocal = (localPlaces || []).find(
      (lp) =>
        (rec.place_id && lp.placeId && rec.place_id === lp.placeId) ||
        (nameKey && normalizeNameKey(lp.name) === nameKey)
    );

    const placeId = String(rec.place_id || savedMatch?.place_id || matchedLocal?.placeId || "");
    const placeName = String(rec.place_name || savedMatch?.place_name || matchedLocal?.name || "");
    const placeAddress = String(rec.place_address || savedMatch?.place_address || matchedLocal?.address || "");
    const placeUrl = String(rec.place_url || savedMatch?.place_url || matchedLocal?.url || "");
    const placeStatusRaw = String(
      rec.place_business_status || savedMatch?.place_business_status || matchedLocal?.businessStatus || ""
    );

    if (placeId) seenPlaceIds.add(placeId);
    if (nameKey) seenNameKeys.add(nameKey);

    const hasPlacesInfo = Boolean(placeAddress || placeUrl || placeId);
    const dataSourceLabel = hasPlacesInfo
      ? es
        ? "IA Web + Google Places (Mismo local)"
        : "AI Web + Google Places (Same venue)"
      : es
      ? "Anuncio Web (IA)"
      : "Web Announcement (AI)";

    const servicesArr = Array.isArray(rec.inferred_service_categories) && rec.inferred_service_categories.length > 0
      ? rec.inferred_service_categories
      : Array.isArray(savedMatch?.inferred_service_categories)
      ? savedMatch.inferred_service_categories
      : [];

    items.push({
      index: items.length + 1,
      id: String(oppId),
      dataSource: dataSourceLabel,
      businessName: bizName,
      category: String(rec.business_category || savedMatch?.business_category || ""),
      location: String(rec.location || savedMatch?.location || ""),
      publicEmail: String(rec.public_email || savedMatch?.public_email || matchedLocal?.public_email || ""),
      publicPhone: String(rec.public_phone || savedMatch?.public_phone || matchedLocal?.public_phone || ""),
      websiteUrl: String(rec.website_url || savedMatch?.website_url || matchedLocal?.website_url || ""),
      placeName: placeName || (hasPlacesInfo ? bizName : ""),
      placeAddress,
      placeStatus: formatPlaceStatus(placeStatusRaw, es),
      placeUrl,
      placeId,
      signalType: String(rec.signal_type || savedMatch?.signal_type || ""),
      signalSummary: String(rec.signal_summary || savedMatch?.signal_summary || ""),
      verificationStatus: formatVerificationStatus(
        rec.verification_status || savedMatch?.verification_status || "needs_review",
        false,
        es
      ),
      publicationDate: String(rec.publication_date || savedMatch?.publication_date || ""),
      eventDate: String(rec.event_date || savedMatch?.event_date || ""),
      sourceTitle: String(rec.source_title || savedMatch?.source_title || ""),
      sourceUrl: String(rec.source_url || savedMatch?.source_url || ""),
      supportingExcerpt: String(rec.supporting_excerpt || savedMatch?.supporting_excerpt || ""),
      targetServices: servicesArr.join(", "),
      serviceFitHypothesis: String(rec.service_fit_inference || savedMatch?.service_fit_inference || ""),
      commercialStage: formatCommercialStage(savedMatch?.review_stage || rec.review_stage || "unsaved", es),
      relevanceVerdict: formatRelevanceVerdict(fbMatch?.verdict || "unrated", es),
      outreachDraft: String(savedMatch?.outreach_draft || rec.outreach_draft || ""),
      qualificationNotes: String(savedMatch?.qualification_notes || rec.qualification_notes || ""),
      retrievedAt: String(rec.retrieval_date || savedMatch?.retrieval_date || ""),
    });
  }

  // 2. Add remaining Google Places results from the search that weren't already merged above
  const nowIso = new Date().toISOString();
  for (const lp of localPlaces || []) {
    if (!lp?.name) continue;
    const pId = String(lp.placeId || "");
    const nKey = normalizeNameKey(lp.name);
    if ((pId && seenPlaceIds.has(pId)) || (nKey && seenNameKeys.has(nKey))) {
      continue;
    }
    if (pId) seenPlaceIds.add(pId);
    if (nKey) seenNameKeys.add(nKey);

    items.push({
      index: items.length + 1,
      id: pId ? `place:${pId}` : `place:${items.length + 1}`,
      dataSource: es ? "Google Places (Negocio local)" : "Google Places (Local business)",
      businessName: String(lp.name || ""),
      category: String(lp.category || ""),
      location: String(lp.location || lp.address || ""),
      publicEmail: String(lp.public_email || ""),
      publicPhone: String(lp.public_phone || ""),
      websiteUrl: String(lp.website_url || ""),
      placeName: String(lp.name || ""),
      placeAddress: String(lp.address || ""),
      placeStatus: formatPlaceStatus(lp.businessStatus || "OPERATIONAL", es),
      placeUrl: String(lp.url || ""),
      placeId: pId,
      signalType: String(
        lp.signal_type || (es ? "Ficha comercial en Google Places" : "Google Places business listing")
      ),
      signalSummary: String(
        lp.signal_summary ||
          (es
            ? `Negocio local activo en Google Maps (${lp.address || "ubicación verificada"}).`
            : `Active local business on Google Maps (${lp.address || "verified location"}).`)
      ),
      verificationStatus: formatVerificationStatus("", true, es),
      publicationDate: "",
      eventDate: "",
      sourceTitle: "Google Maps / Places",
      sourceUrl: String(lp.url || ""),
      supportingExcerpt: String(lp.address || ""),
      targetServices: "",
      serviceFitHypothesis: es
        ? "Negocio local identificado en Google Maps; verifica necesidades actuales de servicios antes de contactar."
        : "Local business identified on Google Maps; confirm current service needs before reaching out.",
      commercialStage: formatCommercialStage("unsaved", es),
      relevanceVerdict: formatRelevanceVerdict("unrated", es),
      outreachDraft: "",
      qualificationNotes: "",
      retrievedAt: nowIso,
    });
  }

  return items;
}

export function buildStructuredExportTable(options) {
  const es = options?.lang !== "en";
  const items = buildUnifiedExportItems(options);

  const headers = es
    ? [
        "N.º",
        "Origen de datos",
        "Nombre del negocio",
        "Categoría / Sector",
        "Ciudad / Ubicación",
        "Email público",
        "Teléfono público",
        "Sitio web oficial",
        "Nombre en Google Places",
        "Dirección en Google Places",
        "Estado en Google Places",
        "Enlace Google Maps",
        "Señal detectada",
        "Resumen del anuncio / actividad",
        "Estado de verificación",
        "Fecha de publicación",
        "Fecha de apertura / evento",
        "Fuente web (Título)",
        "URL de fuente web",
        "Extracto de evidencia",
        "Servicios recomendados",
        "Hipótesis de encaje comercial",
        "Etapa comercial",
        "Calificación de relevancia",
        "Borrador de contacto",
        "Notas privadas",
        "ID de referencia",
        "Fecha de consulta (UTC)",
      ]
    : [
        "#",
        "Data Source",
        "Business Name",
        "Category / Sector",
        "City / Location",
        "Public Email",
        "Public Phone",
        "Official Website",
        "Google Places Name",
        "Google Places Address",
        "Google Places Status",
        "Google Maps URL",
        "Detected Signal",
        "Announcement / Activity Summary",
        "Verification Status",
        "Publication Date",
        "Opening / Event Date",
        "Web Source (Title)",
        "Web Source URL",
        "Evidence Excerpt",
        "Recommended Services",
        "Service Fit Hypothesis",
        "Pipeline Stage",
        "Relevance Rating",
        "Outreach Draft",
        "Private Notes",
        "Reference ID",
        "Retrieved At (UTC)",
      ];

  const rows = items.map((item) => [
    String(item.index),
    item.dataSource,
    item.businessName,
    item.category,
    item.location,
    item.publicEmail,
    item.publicPhone,
    item.websiteUrl,
    item.placeName,
    item.placeAddress,
    item.placeStatus,
    item.placeUrl,
    item.signalType,
    item.signalSummary,
    item.verificationStatus,
    item.publicationDate,
    item.eventDate,
    item.sourceTitle,
    item.sourceUrl,
    item.supportingExcerpt,
    item.targetServices,
    item.serviceFitHypothesis,
    item.commercialStage,
    item.relevanceVerdict,
    item.outreachDraft,
    item.qualificationNotes,
    item.id,
    item.retrievedAt,
  ]);

  return { headers, rows, items };
}

export function buildStructuredWorkspaceReport(options) {
  const es = options?.lang !== "en";
  const items = buildUnifiedExportItems(options);
  const dateStr = new Date().toISOString().slice(0, 10);
  const reportTitle =
    options?.title ||
    (es
      ? `GoLeads — Reporte Estructurado de Leads (${dateStr}) — ${items.length} registros`
      : `GoLeads — Structured Leads Report (${dateStr}) — ${items.length} records`);

  const na = es ? "No disponible públicamente" : "Not publicly available";

  const blocks = items.map((item) => {
    if (es) {
      return [
        `================================================================================`,
        `[${item.index}] ${item.businessName.toUpperCase()} (${item.dataSource})`,
        `================================================================================`,
        ``,
        `1. IDENTIFICACIÓN Y CLASIFICACIÓN`,
        `   • Nombre comercial: ${item.businessName}`,
        `   • Categoría / Sector: ${item.category || "—"}`,
        `   • Ciudad / Ubicación: ${item.location || "—"}`,
        `   • Etapa / Relevancia: ${item.commercialStage} · ${item.relevanceVerdict}`,
        ``,
        `2. INFORMACIÓN PÚBLICA DE CONTACTO`,
        `   • Correo electrónico público: ${item.publicEmail || na}`,
        `   • Teléfono público: ${item.publicPhone || na}`,
        `   • Sitio web oficial: ${item.websiteUrl || na}`,
        ``,
        `3. FICHA DE GOOGLE PLACES (MISMO LOCAL)`,
        `   • Nombre en Google Places: ${item.placeName || "—"}`,
        `   • Dirección física (Places): ${item.placeAddress || "—"}`,
        `   • Estado operativo: ${item.placeStatus || "—"}`,
        `   • Enlace Google Maps: ${item.placeUrl || "—"}`,
        ``,
        `4. SEÑAL DETECTADA Y EVIDENCIA WEB (IA)`,
        `   • Tipo de señal: ${item.signalType || "—"}`,
        `   • Estado de verificación: ${item.verificationStatus}`,
        `   • Resumen: ${item.signalSummary || "—"}`,
        `   • Fecha de publicación: ${item.publicationDate || "No indicada"} | Fecha del evento: ${item.eventDate || "No indicada"}`,
        `   • Fuente original: ${item.sourceTitle || "—"} (${item.sourceUrl || "—"})`,
        item.supportingExcerpt ? `   • Extracto citado: "${item.supportingExcerpt}"` : null,
        ``,
        `5. ENCAJE DE SERVICIOS Y BORRADOR DE CONTACTO`,
        item.targetServices ? `   • Servicios recomendados: ${item.targetServices}` : null,
        `   • Hipótesis de encaje comercial: ${item.serviceFitHypothesis || "—"}`,
        item.qualificationNotes ? `   • Notas privadas: ${item.qualificationNotes}` : null,
        item.outreachDraft ? `   • Borrador de mensaje:\n     ${item.outreachDraft.replace(/\n/g, "\n     ")}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    }

    return [
      `================================================================================`,
      `[${item.index}] ${item.businessName.toUpperCase()} (${item.dataSource})`,
      `================================================================================`,
      ``,
      `1. BUSINESS IDENTITY & CLASSIFICATION`,
      `   • Business Name: ${item.businessName}`,
      `   • Category / Sector: ${item.category || "—"}`,
      `   • City / Location: ${item.location || "—"}`,
      `   • Stage / Relevance: ${item.commercialStage} · ${item.relevanceVerdict}`,
      ``,
      `2. PUBLIC CONTACT INFORMATION`,
      `   • Public Email: ${item.publicEmail || na}`,
      `   • Public Phone: ${item.publicPhone || na}`,
      `   • Official Website: ${item.websiteUrl || na}`,
      ``,
      `3. GOOGLE PLACES LISTING (SAME VENUE)`,
      `   • Google Places Name: ${item.placeName || "—"}`,
      `   • Street Address (Places): ${item.placeAddress || "—"}`,
      `   • Operational Status: ${item.placeStatus || "—"}`,
      `   • Google Maps Link: ${item.placeUrl || "—"}`,
      ``,
      `4. DETECTED SIGNAL & WEB EVIDENCE (AI)`,
      `   • Signal Type: ${item.signalType || "—"}`,
      `   • Verification Status: ${item.verificationStatus}`,
      `   • Summary: ${item.signalSummary || "—"}`,
      `   • Publication Date: ${item.publicationDate || "Not stated"} | Event Date: ${item.eventDate || "Not stated"}`,
      `   • Original Source: ${item.sourceTitle || "—"} (${item.sourceUrl || "—"})`,
      item.supportingExcerpt ? `   • Supporting Excerpt: "${item.supportingExcerpt}"` : null,
      ``,
      `5. SERVICE FIT & OUTREACH DRAFT`,
      item.targetServices ? `   • Recommended Services: ${item.targetServices}` : null,
      `   • Service Fit Hypothesis: ${item.serviceFitHypothesis || "—"}`,
      item.qualificationNotes ? `   • Private Notes: ${item.qualificationNotes}` : null,
      item.outreachDraft ? `   • Outreach Draft:\n     ${item.outreachDraft.replace(/\n/g, "\n     ")}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  const headerIntro = es
    ? `${reportTitle}\nGenerado desde GoLeads (IA + Google Places)\nTotal de registros exportados: ${items.length}\n\n`
    : `${reportTitle}\nGenerated by GoLeads (AI + Google Places)\nTotal exported records: ${items.length}\n\n`;

  return {
    name: reportTitle,
    content: headerIntro + blocks.join("\n\n"),
    count: items.length,
  };
}