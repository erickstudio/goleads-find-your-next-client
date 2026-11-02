export const COMMUNICATION_EMAIL_TEMPLATES = Object.freeze({
  welcome: {
    en: "Welcome",
    es: "WelcomeEs",
    labelEn: "Welcome email",
    labelEs: "Correo de bienvenida",
  },
  newsletter: {
    en: "Newsletter",
    es: "NewsletterEs",
    labelEn: "Newsletter",
    labelEs: "Boletín informativo",
  },
  promotion: {
    en: "Promotion",
    es: "PromotionEs",
    labelEn: "Promotional offer",
    labelEs: "Promoción",
  },
  product_update: {
    en: "ProductUpdate",
    es: "ProductUpdateEs",
    labelEn: "Product update",
    labelEs: "Novedades del producto",
  },
  enquiry_reply: {
    en: "EnquiryReply",
    es: "EnquiryReplyEs",
    labelEn: "Enquiry & support reply",
    labelEs: "Respuesta de soporte y consulta",
  },
});

export const DEFAULT_BILINGUAL_CAMPAIGNS = Object.freeze({
  enquiry_reply: {
    email_key: "enquiry_reply",
    subject_es: "Recibimos tu consulta en GoLeads",
    subject_en: "We received your inquiry at GoLeads",
    eyebrow_es: "Soporte y atención · GoLeads",
    eyebrow_en: "Support & inquiries · GoLeads",
    headline_es: "Hola, hemos recibido tu mensaje",
    headline_en: "Hi there, we received your message",
    subheadline_es:
      "Nuestro equipo revisará tu solicitud y te responderá a la brevedad desde info@goleads.space.",
    subheadline_en:
      "Our team is reviewing your request and will get back to you shortly from info@goleads.space.",
    section_title_es: "Deja de adivinar qué empresas están listas para contratarte",
    section_title_en: "Stop guessing which companies are ready to buy",
    body_es:
      "GoLeads detecta señales verificadas de apertura y expansión para que contactes a empresas en crecimiento justo en el momento oportuno.",
    body_en:
      "GoLeads surfaces verified expansion signals so you reach out at exactly the right moment.",
    card1_title_es: "Atención directa",
    card1_body_es:
      "Responde a este correo o escríbenos a info@goleads.space y una persona real de nuestro equipo te ayudará.",
    card1_title_en: "Direct human help",
    card1_body_en:
      "Reply to this email or write to info@goleads.space and a real person from our team will help.",
    card2_title_es: "Señales actualizadas",
    card2_body_es:
      "Las señales se actualizan continuamente para que tu lista de prospectos nunca quede desactualizada.",
    card2_title_en: "Fresh signals",
    card2_body_en:
      "Signals update weekly, so your prospect list is never stale.",
    cta_label_es: "Abrir GoLeads",
    cta_label_en: "Open GoLeads",
    cta_url: "https://goleads.space/app",
  },
  product_update: {
    email_key: "product_update",
    subject_es: "Novedades en GoLeads: encuentra a tu próximo cliente",
    subject_en: "New in GoLeads: find your next client before your competitors do",
    eyebrow_es: "Novedades de GoLeads",
    eyebrow_en: "New from GoLeads",
    headline_es: "Encuentra a tu próximo cliente antes que tu competencia",
    headline_en: "Find your next client before your competitors do",
    subheadline_es:
      "Nuevas herramientas de búsqueda local, verificación de fuentes y exportación para tu flujo comercial.",
    subheadline_en:
      "New local discovery tools, source verification, and export options for your prospecting workflow.",
    section_title_es: "Qué hay de nuevo en tu espacio de trabajo",
    section_title_en: "What is new in your workspace",
    body_es:
      "GoLeads rastrea señales verificadas de expansión para que contactes a empresas en crecimiento justo cuando necesitan tus servicios.",
    body_en:
      "GoLeads tracks verified expansion signals so you can reach growing companies right when they need what you sell.",
    card1_title_es: "Señales verificadas",
    card1_body_es:
      "Detectamos señales reales de crecimiento, desde nuevas sedes hasta aperturas locales, para que sepas qué negocios se están expandiendo.",
    card1_title_en: "Verified signals",
    card1_body_en:
      "We surface real signals of growth, from hiring sprees to new locations, so you know a company is actually expanding.",
    card2_title_es: "Momento oportuno",
    card2_body_es:
      "Contacta a quienes toman decisiones mientras su necesidad es reciente y su proyecto está en marcha.",
    card2_title_en: "Perfect timing",
    card2_body_en:
      "Reach decision makers while their need is fresh, not months after the budget is spent.",
    cta_label_es: "Explorar novedades",
    cta_label_en: "Find your next client",
    cta_url: "https://goleads.space/app",
  },
  promotion: {
    email_key: "promotion",
    subject_es: "20% de descuento en tu primer mes de GoLeads Pro",
    subject_en: "20% off your first month of GoLeads Pro",
    eyebrow_es: "Oferta por tiempo limitado",
    eyebrow_en: "Limited time offer",
    headline_es: "20% de descuento en tu primer mes",
    headline_en: "20% off your first month",
    subheadline_es:
      "Empieza a descubrir negocios en crecimiento con señales verificadas de expansión.",
    subheadline_en:
      "Start discovering growing businesses with verified expansion signals.",
    section_title_es: "Encuentra a tu próximo cliente antes que tu competencia",
    section_title_en: "Find your next client before your competitors do",
    body_es:
      "GoLeads detecta señales verificadas de apertura y expansión para que llegues a empresas en crecimiento justo cuando necesitan lo que vendes.",
    body_en:
      "GoLeads tracks verified expansion signals so you can reach growing companies right when they need what you sell.",
    card1_title_es: "Señales verificadas",
    card1_body_es:
      "Mostramos señales reales de crecimiento, desde aperturas hasta nuevas sedes, con respaldo documental.",
    card1_title_en: "Verified signals",
    card1_body_en:
      "We surface real signals of growth, from hiring sprees to new locations, so you know a company is actually expanding.",
    card2_title_es: "Momento oportuno",
    card2_body_es:
      "Llega a los responsables de decisión mientras su necesidad está activa, no meses después.",
    card2_title_en: "Perfect timing",
    card2_body_en:
      "Reach decision makers while their need is fresh, not months after the budget is spent.",
    cta_label_es: "Activar oferta en GoLeads",
    cta_label_en: "Find your next client",
    cta_url: "https://goleads.space/plans",
  },
  newsletter: {
    email_key: "newsletter",
    subject_es: "Boletín GoLeads: oportunidades y señales de expansión",
    subject_en: "GoLeads Newsletter: find your next client before your competitors do",
    eyebrow_es: "Edición mensual",
    eyebrow_en: "Monthly edition",
    headline_es: "Encuentra a tu próximo cliente antes que tu competencia",
    headline_en: "Find your next client before your competitors do",
    subheadline_es:
      "Resumen de oportunidades comerciales, señales de expansión y consejos de prospección.",
    subheadline_en:
      "Verified expansion signals show you exactly which businesses are growing right now.",
    section_title_es: "Nuevas señales de expansión activas",
    section_title_en: "New expansion signals live",
    body_es:
      "Hemos incorporado nuevos indicadores de crecimiento en GoLeads, combinando negocios locales en Google Maps y anuncios verificados para mantener tu cartera de prospectos al día.",
    body_en:
      "We have added new growth indicators to GoLeads, including hiring momentum and local expansion events, so your prospect lists stay sharp.",
    card1_title_es: "Guía práctica de prospección",
    card1_body_es:
      "Descubre cómo transformar señales de apertura y expansión en una lista constante de oportunidades calificadas.",
    card1_title_en: "Monthly prospecting walkthrough",
    card1_body_en:
      "See how to turn expansion signals into a steady pipeline of qualified prospects.",
    card2_title_es: "Renueva tu lista de prospectos",
    card2_body_es:
      "Los freelancers y agencias en GoLeads priorizan fuentes verificables en lugar de directorios desactualizados.",
    card2_title_en: "Rethinking your prospect list",
    card2_body_en:
      "Teams using GoLeads are building lists around verified expansion signals instead of stale contact databases.",
    cta_label_es: "Encontrar mi próximo cliente",
    cta_label_en: "Find your next client",
    cta_url: "https://goleads.space/app",
  },
});

export function normalizePreferredEmailLanguage(profileOrLang) {
  const raw =
    typeof profileOrLang === "string"
      ? profileOrLang
      : profileOrLang?.ui_language || "";
  return String(raw).trim().toLowerCase() === "es" ? "es" : "en";
}

export function resolveTemplateForLanguage(emailKey, profileOrLang) {
  const entry = COMMUNICATION_EMAIL_TEMPLATES[emailKey];
  if (!entry) {
    throw new Error(`Unsupported communication email key: ${emailKey}`);
  }
  const lang = normalizePreferredEmailLanguage(profileOrLang);
  return {
    language: lang,
    templateName: lang === "es" ? entry.es : entry.en,
    label: lang === "es" ? entry.labelEs : entry.labelEn,
  };
}

export function mergeCampaignContentWithDefaults(emailKey, savedRecord = null) {
  const base = DEFAULT_BILINGUAL_CAMPAIGNS[emailKey];
  if (!base) return null;
  if (!savedRecord) return { ...base };
  const merged = { ...base };
  for (const key of Object.keys(base)) {
    if (
      savedRecord[key] !== undefined &&
      savedRecord[key] !== null &&
      String(savedRecord[key]).trim() !== ""
    ) {
      merged[key] = String(savedRecord[key]).trim();
    }
  }
  if (savedRecord.id) merged.id = savedRecord.id;
  if (savedRecord.updated_at_iso) merged.updated_at_iso = savedRecord.updated_at_iso;
  if (savedRecord.last_sent_at_iso) merged.last_sent_at_iso = savedRecord.last_sent_at_iso;
  if (savedRecord.last_sent_count !== undefined) {
    merged.last_sent_count = savedRecord.last_sent_count;
  }
  return merged;
}

export function buildDefaultTemplateVariables({
  language = "en",
  emailKey = "welcome",
  user = {},
  profile = {},
  campaignContent = null,
  now = new Date(),
} = {}) {
  const isEs = language === "es";
  const rawName =
    String(profile?.agency_or_freelancer_name || user?.full_name || "").trim() ||
    (isEs ? "equipo" : "there");
  const firstName = rawName.split(/\s+/)[0] || rawName;

  const issueDate = now.toLocaleDateString(isEs ? "es-ES" : "en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const endDateObj = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const endDate = endDateObj.toLocaleDateString(isEs ? "es-ES" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  const merged = mergeCampaignContentWithDefaults(emailKey, campaignContent);
  if (!merged) {
    return {
      first_name: firstName,
      cta_url: "https://goleads.space/app",
      issue_date: issueDate,
      end_date: endDate,
    };
  }

  const eyebrowValue = isEs ? merged.eyebrow_es : merged.eyebrow_en;

  return {
    first_name: firstName,
    subject_line: isEs ? merged.subject_es : merged.subject_en,
    eyebrow: eyebrowValue,
    issue_date: eyebrowValue || issueDate,
    end_date: eyebrowValue || endDate,
    headline: isEs ? merged.headline_es : merged.headline_en,
    subheadline: isEs ? merged.subheadline_es : merged.subheadline_en,
    section_title: isEs ? merged.section_title_es : merged.section_title_en,
    body_text: isEs ? merged.body_es : merged.body_en,
    card1_title: isEs ? merged.card1_title_es : merged.card1_title_en,
    card1_body: isEs ? merged.card1_body_es : merged.card1_body_en,
    card2_title: isEs ? merged.card2_title_es : merged.card2_title_en,
    card2_body: isEs ? merged.card2_body_es : merged.card2_body_en,
    cta_label: isEs ? merged.cta_label_es : merged.cta_label_en,
    cta_url: merged.cta_url || "https://goleads.space/app",
  };
}

/**
 * Sends a communication email to a registered user in the preferred language
 * selected in their UserProfile (ui_language: 'es' -> *Es template, 'en' -> English template).
 */
export async function sendCommunicationEmailByProfileLanguage({
  serviceRoleBase44,
  recipientEmail,
  recipientUserId,
  emailKey,
  overrideLanguage,
  user = {},
  profile = null,
  campaignContent = null,
}) {
  const cleanEmail = String(recipientEmail || user?.email || "").trim();
  if (!cleanEmail) {
    throw new Error("Recipient email is required.");
  }

  let resolvedProfile = profile;
  if (!resolvedProfile && recipientUserId && serviceRoleBase44?.entities?.UserProfile?.filter) {
    const profilePage = await serviceRoleBase44.entities.UserProfile.filter(
      { created_by_id: recipientUserId },
      { sort: "-created_date", limit: 1 }
    );
    resolvedProfile = (profilePage?.items || []).find(
      (p) =>
        p.created_by_id === recipientUserId &&
        (!p.owner_id || p.owner_id === recipientUserId)
    ) || null;
  }

  let resolvedCampaign = campaignContent;
  if (
    !resolvedCampaign &&
    DEFAULT_BILINGUAL_CAMPAIGNS[emailKey] &&
    serviceRoleBase44?.entities?.EmailCampaignContent?.filter
  ) {
    const campPage = await serviceRoleBase44.entities.EmailCampaignContent.filter(
      { email_key: emailKey },
      { sort: "-created_date", limit: 1 }
    ).catch(() => ({ items: [] }));
    resolvedCampaign = campPage?.items?.[0] || null;
  }

  const targetLang = overrideLanguage
    ? normalizePreferredEmailLanguage(overrideLanguage)
    : normalizePreferredEmailLanguage(resolvedProfile);

  const { language, templateName, label } = resolveTemplateForLanguage(
    emailKey,
    targetLang
  );

  const variables = buildDefaultTemplateVariables({
    language,
    emailKey,
    user,
    profile: resolvedProfile || {},
    campaignContent: resolvedCampaign,
  });

  const sendPayload = {
    to: cleanEmail,
    template_name: templateName,
    category: "marketing",
    variables,
  };
  if (variables.subject_line) {
    sendPayload.subject = variables.subject_line;
  }

  const sendResult = await serviceRoleBase44.integrations.Core.SendEmail(sendPayload);

  return {
    ok: sendResult?.success !== false,
    language,
    templateName,
    label,
    to: cleanEmail,
    variables,
    sendResult,
  };
}