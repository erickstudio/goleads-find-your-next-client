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

export function buildDefaultTemplateVariables({
  language = "en",
  user = {},
  profile = {},
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

  return {
    first_name: firstName,
    cta_url: "https://goleads.space/app",
    issue_date: issueDate,
    end_date: endDate,
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
}) {
  const cleanEmail = String(recipientEmail || user?.email || "").trim();
  if (!cleanEmail) {
    throw new Error("Recipient email is required.");
  }

  let resolvedProfile = profile;
  if (!resolvedProfile && recipientUserId) {
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

  const targetLang = overrideLanguage
    ? normalizePreferredEmailLanguage(overrideLanguage)
    : normalizePreferredEmailLanguage(resolvedProfile);

  const { language, templateName, label } = resolveTemplateForLanguage(
    emailKey,
    targetLang
  );

  const variables = buildDefaultTemplateVariables({
    language,
    user,
    profile: resolvedProfile || {},
  });

  const sendResult = await serviceRoleBase44.integrations.Core.SendEmail({
    to: cleanEmail,
    template_name: templateName,
    category: "marketing",
    variables,
  });

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