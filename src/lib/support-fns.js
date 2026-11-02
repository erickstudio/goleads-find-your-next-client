import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  normalizePreferredEmailLanguage,
  sendCommunicationEmailByProfileLanguage,
} from "@/lib/email-communications.server";

const recentSupportSubmissions = new Map();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 4;

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const TOPIC_LABELS = {
  es: {
    access: "Acceso e inicio de sesión",
    billing: "Planes y facturación",
    search: "Búsqueda de leads y fuentes",
    privacy: "Privacidad y datos",
    other: "Consulta general",
  },
  en: {
    access: "Sign-in & account access",
    billing: "Plans & billing",
    search: "Lead discovery & sources",
    privacy: "Privacy & data request",
    other: "General inquiry",
  },
};

export const submitSupportEnquiry = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().trim().min(2).max(100),
      email: z.string().trim().email().max(160),
      topic: z
        .enum(["access", "billing", "search", "privacy", "other"])
        .default("other"),
      subject: z.string().trim().min(3).max(160),
      message: z.string().trim().min(10).max(2000),
      preferred_language: z.enum(["es", "en"]).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const now = Date.now();
    const senderEmail = data.email.trim().toLowerCase();

    const prevTimestamps = (recentSupportSubmissions.get(senderEmail) || []).filter(
      (ts) => now - ts < RATE_WINDOW_MS
    );
    if (prevTimestamps.length >= MAX_PER_WINDOW) {
      throw new Error(
        data.preferred_language === "es"
          ? "Has enviado demasiadas solicitudes recientemente. Por favor espera unos minutos o escribe a info@goleads.space."
          : "Too many requests sent recently. Please wait a few minutes or email info@goleads.space."
      );
    }
    prevTimestamps.push(now);
    recentSupportSubmissions.set(senderEmail, prevTimestamps);

    const base44 = context.getBase44();
    const serviceRole = base44.asServiceRole;

    // 1. Resolve sender's UserProfile if they are a registered user so we respect their preferred language
    let senderProfile = null;
    if (serviceRole?.entities?.UserProfile?.filter) {
      const profPage = await serviceRole.entities.UserProfile.filter(
        {},
        { sort: "-created_date", limit: 100 }
      ).catch(() => ({ items: [] }));
      senderProfile =
        (profPage?.items || []).find(
          (p) => String(p.owner_email || "").trim().toLowerCase() === senderEmail
        ) || null;
    }

    const userLang = senderProfile?.ui_language
      ? normalizePreferredEmailLanguage(senderProfile)
      : normalizePreferredEmailLanguage(data.preferred_language || "es");

    // 2. Collect owner/admin recipient emails + info@goleads.space
    const adminEmails = new Set(["info@goleads.space"]);
    if (serviceRole?.entities?.User?.list) {
      const usersRaw = await serviceRole.entities.User.list(
        "-created_date",
        50
      ).catch(() => []);
      const users = Array.isArray(usersRaw) ? usersRaw : usersRaw?.items || [];
      for (const u of users) {
        if (u?.role === "admin" && u?.email) {
          adminEmails.add(String(u.email).trim().toLowerCase());
        }
      }
    }

    const topicLabelEs = TOPIC_LABELS.es[data.topic] || TOPIC_LABELS.es.other;
    const topicLabelEn = TOPIC_LABELS.en[data.topic] || TOPIC_LABELS.en.other;
    const nowIso = new Date(now).toISOString();

    const safeName = escapeHtml(data.name);
    const safeEmail = escapeHtml(data.email);
    const safeSubject = escapeHtml(data.subject);
    const safeMessage = escapeHtml(data.message).replace(/\n/g, "<br/>");

    const ownerHtml = `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #111827; color: #ffffff; border-radius: 6px; overflow: hidden; border: 1px solid #1f2937;">
        <div style="background: #4e2bff; padding: 20px 28px;">
          <p style="margin: 0; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; font-weight: 700; color: #ffffff;">GoLeads · Support Form / Formulario de Soporte</p>
          <h1 style="margin: 8px 0 0; font-size: 20px; color: #ffffff;">${safeSubject}</h1>
        </div>
        <div style="padding: 24px 28px; font-size: 14px; line-height: 1.6;">
          <p style="margin: 0 0 8px;"><strong>Nombre / Name:</strong> ${safeName}</p>
          <p style="margin: 0 0 8px;"><strong>Correo / Email:</strong> <a href="mailto:${safeEmail}" style="color: #8870ff;">${safeEmail}</a></p>
          <p style="margin: 0 0 8px;"><strong>Categoría / Topic:</strong> ${escapeHtml(topicLabelEs)} (${escapeHtml(topicLabelEn)})</p>
          <p style="margin: 0 0 16px;"><strong>Idioma preferido / Preferred language:</strong> ${userLang.toUpperCase()}</p>
          <div style="background: #161a38; border-left: 3px solid #4e2bff; padding: 16px; border-radius: 4px; margin-top: 12px;">
            <p style="margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #8870ff; font-weight: 700;">Mensaje / Message</p>
            <div style="color: #ffffff; font-size: 14px; line-height: 1.65;">${safeMessage}</div>
          </div>
          <p style="margin: 20px 0 0; font-size: 12px; color: #8870ff;">Enviado desde goleads.space/support · ${nowIso} · Panamá, Panamá</p>
        </div>
      </div>
    `;

    const ownerText = [
      `Nueva consulta de soporte en GoLeads / New GoLeads support inquiry`,
      `Nombre / Name: ${data.name}`,
      `Correo / Email: ${data.email}`,
      `Categoría / Topic: ${topicLabelEs} (${topicLabelEn})`,
      `Idioma / Language: ${userLang.toUpperCase()}`,
      `Asunto / Subject: ${data.subject}`,
      ``,
      `Mensaje / Message:`,
      data.message,
      ``,
      `Fecha: ${nowIso}`,
    ].join("\n");

    let deliveredToOwner = false;
    for (const targetAdminEmail of adminEmails) {
      const res = await serviceRole.integrations.Core.SendEmail({
        to: targetAdminEmail,
        subject: `[Soporte GoLeads] ${data.subject} — ${data.name}`,
        html: ownerHtml,
        text: ownerText,
        category: "transactional",
      }).catch(() => null);
      if (res && res.success !== false) {
        deliveredToOwner = true;
      }
    }

    // 3. Send multilingual EnquiryReply / EnquiryReplyEs confirmation to the user in their preferred language
    const autoReply = await sendCommunicationEmailByProfileLanguage({
      serviceRoleBase44: serviceRole,
      recipientEmail: data.email,
      emailKey: "enquiry_reply",
      overrideLanguage: userLang,
      user: { full_name: data.name, email: data.email },
      profile: senderProfile,
    }).catch(() => null);

    return {
      ok: true,
      deliveredToOwner,
      autoReplySent: Boolean(autoReply?.ok),
      language: userLang,
      templateUsed: autoReply?.templateName || (userLang === "es" ? "EnquiryReplyEs" : "EnquiryReply"),
    };
  });