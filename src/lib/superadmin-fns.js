import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import {
  resolveAdminPanelAccess,
  hashAccessCode,
  maskAccessCodeLabel,
  redeemComplimentaryProCode,
} from "@/lib/superadmin.server";
import {
  DEFAULT_BILINGUAL_CAMPAIGNS,
  mergeCampaignContentWithDefaults,
  normalizePreferredEmailLanguage,
  sendCommunicationEmailByProfileLanguage,
} from "@/lib/email-communications.server";

export const getMyAdminAccessStatus = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const base44 = context.getBase44();
    return await resolveAdminPanelAccess(base44, context.user);
  });

export const getSuperAdminDashboardData = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const base44 = context.getBase44();
    const serviceRole = base44.asServiceRole;
    const access = await resolveAdminPanelAccess(base44, context.user);

    if (!access.hasPanelAccess) {
      return {
        authorized: false,
        access,
        collaborators: [],
        proGrants: [],
        usersList: [],
        campaigns: {},
      };
    }

    const [collabsPage, grantsPage, profilesPage, campaignsPage, usersRaw] =
      await Promise.all([
        access.canManageCollaborators
          ? serviceRole.entities.AdminCollaborator.filter(
              {},
              { sort: "-created_date", limit: 50 }
            ).catch(() => ({ items: [] }))
          : Promise.resolve({ items: [] }),
        access.canManageProGrants
          ? serviceRole.entities.ProAccessGrant.filter(
              {},
              { sort: "-created_date", limit: 100 }
            ).catch(() => ({ items: [] }))
          : Promise.resolve({ items: [] }),
        serviceRole.entities.UserProfile.filter(
          {},
          { sort: "-created_date", limit: 100 }
        ).catch(() => ({ items: [] })),
        access.canSendCommunications
          ? serviceRole.entities.EmailCampaignContent.filter(
              {},
              { sort: "-created_date", limit: 20 }
            ).catch(() => ({ items: [] }))
          : Promise.resolve({ items: [] }),
        serviceRole.entities.User.list("-created_date", 100).catch(() => []),
      ]);

    const profilesByUserId = new Map();
    const profilesByEmail = new Map();
    for (const p of profilesPage?.items || []) {
      const uid = p.owner_id || p.created_by_id;
      if (uid && !profilesByUserId.has(uid)) profilesByUserId.set(uid, p);
      const em = String(p.owner_email || "").trim().toLowerCase();
      if (em && !profilesByEmail.has(em)) profilesByEmail.set(em, p);
    }

    const rawUserItems = Array.isArray(usersRaw)
      ? usersRaw
      : usersRaw?.items || [];
    const seenEmails = new Set();
    const usersList = [];

    for (const u of rawUserItems) {
      const email = String(u.email || "").trim().toLowerCase();
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);
      const prof = profilesByUserId.get(u.id) || profilesByEmail.get(email) || null;
      usersList.push({
        id: u.id,
        email: u.email,
        full_name: u.full_name || prof?.agency_or_freelancer_name || "",
        role: u.role || "user",
        ui_language: normalizePreferredEmailLanguage(prof),
      });
    }

    for (const p of profilesPage?.items || []) {
      const email = String(p.owner_email || "").trim().toLowerCase();
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);
      usersList.push({
        id: p.owner_id || p.created_by_id || "",
        email: p.owner_email,
        full_name: p.agency_or_freelancer_name || "",
        role: "user",
        ui_language: normalizePreferredEmailLanguage(p),
      });
    }

    const savedByKey = new Map();
    for (const c of campaignsPage?.items || []) {
      if (c.email_key && !savedByKey.has(c.email_key)) {
        savedByKey.set(c.email_key, c);
      }
    }

    const campaigns = {
      product_update: mergeCampaignContentWithDefaults(
        "product_update",
        savedByKey.get("product_update")
      ),
      promotion: mergeCampaignContentWithDefaults(
        "promotion",
        savedByKey.get("promotion")
      ),
      newsletter: mergeCampaignContentWithDefaults(
        "newsletter",
        savedByKey.get("newsletter")
      ),
    };

    const sanitizedGrants = (grantsPage?.items || []).map(
      ({ access_code_hash: _hash, ...rest }) => rest
    );

    return {
      authorized: true,
      access,
      collaborators: collabsPage?.items || [],
      proGrants: sanitizedGrants,
      usersList,
      campaigns,
    };
  });

export const upsertDelegatedCollaborator = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      collaborator_email: z.string().trim().email().max(160),
      collaborator_name: z.string().trim().max(120).optional(),
      can_manage_pro_grants: z.boolean(),
      can_send_communications: z.boolean(),
      can_view_diagnostics: z.boolean().optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const serviceRole = base44.asServiceRole;
    const access = await resolveAdminPanelAccess(base44, context.user);
    if (!access.isSuperUser || !access.canManageCollaborators) {
      throw Object.assign(
        new Error("Solo el superusuario puede delegar o modificar colaboradores."),
        { status: 403 }
      );
    }

    const targetEmail = data.collaborator_email.trim().toLowerCase();
    const existingPage = await serviceRole.entities.AdminCollaborator.filter(
      {},
      { sort: "-created_date", limit: 50 }
    );
    const existing = (existingPage?.items || []).find(
      (c) => String(c.collaborator_email || "").trim().toLowerCase() === targetEmail
    );

    const payload = {
      collaborator_email: targetEmail,
      collaborator_name: data.collaborator_name?.trim() || targetEmail,
      description: `Colaborador delegado por ${context.user.email || "superusuario"}`,
      status: "active",
      can_manage_pro_grants: data.can_manage_pro_grants,
      can_send_communications: data.can_send_communications,
      can_view_diagnostics: Boolean(data.can_view_diagnostics),
      granted_by_email: context.user.email || "",
      created_at_iso: new Date().toISOString(),
    };

    if (existing) {
      return await serviceRole.entities.AdminCollaborator.update(existing.id, payload);
    }
    return await serviceRole.entities.AdminCollaborator.create(payload);
  });

export const revokeDelegatedCollaborator = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string().min(1).max(120) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const serviceRole = base44.asServiceRole;
    const access = await resolveAdminPanelAccess(base44, context.user);
    if (!access.isSuperUser || !access.canManageCollaborators) {
      throw Object.assign(
        new Error("Solo el superusuario puede revocar colaboradores."),
        { status: 403 }
      );
    }
    return await serviceRole.entities.AdminCollaborator.update(data.id, {
      status: "revoked",
    });
  });

export const grantComplimentaryProAccess = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      grant_type: z.enum(["direct_user", "access_code"]),
      target_email: z.string().trim().max(160).optional(),
      access_password: z.string().trim().max(80).optional(),
      reason: z.enum([
        "beta_feedback",
        "invite_tester",
        "password_access",
        "partner",
      ]),
      description: z.string().trim().max(500).optional(),
      granted_search_allowance: z.number().int().min(1).max(5000),
      duration_days: z.number().int().min(1).max(365),
      max_redemptions: z.number().int().min(1).max(500).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const serviceRole = base44.asServiceRole;
    const access = await resolveAdminPanelAccess(base44, context.user);
    if (!access.hasPanelAccess || !access.canManageProGrants) {
      throw Object.assign(
        new Error("No tienes permisos para otorgar accesos Pro."),
        { status: 403 }
      );
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const expiresIso = new Date(
      now + data.duration_days * 24 * 60 * 60 * 1000
    ).toISOString();

    if (data.grant_type === "direct_user") {
      const cleanEmail = String(data.target_email || "").trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes("@")) {
        throw new Error("Ingresa un correo electrónico válido para el usuario.");
      }

      // Check if we can link target_user_id from UserProfile
      const profPage = await serviceRole.entities.UserProfile.filter(
        {},
        { sort: "-created_date", limit: 100 }
      ).catch(() => ({ items: [] }));
      const matchingProf = (profPage?.items || []).find(
        (p) => String(p.owner_email || "").trim().toLowerCase() === cleanEmail
      );

      const created = await serviceRole.entities.ProAccessGrant.create({
        grant_type: "direct_user",
        target_email: cleanEmail,
        target_user_id: matchingProf?.owner_id || matchingProf?.created_by_id || "",
        access_code_label: "Asignación directa",
        reason: data.reason,
        description:
          data.description ||
          "Acceso Pro otorgado sin suscripción de PayPal (Beta / Feedback)",
        status: "active",
        granted_search_allowance: data.granted_search_allowance,
        used_searches: 0,
        max_redemptions: 1,
        redemption_count: 1,
        expires_at_iso: expiresIso,
        granted_by_email: context.user.email || "",
        created_at_iso: nowIso,
      });

      const { access_code_hash: _h, ...safeGrant } = created;
      return safeGrant;
    }

    // access_code (password/code for invited testers)
    const rawPassword = String(data.access_password || "").trim();
    if (rawPassword.length < 4) {
      throw new Error(
        "La contraseña o código de invitación debe tener al menos 4 caracteres."
      );
    }

    const optionalTargetEmail = String(data.target_email || "")
      .trim()
      .toLowerCase();

    const created = await serviceRole.entities.ProAccessGrant.create({
      grant_type: "access_code",
      target_email: optionalTargetEmail,
      target_user_id: "",
      access_code_hash: hashAccessCode(rawPassword),
      access_code_label: maskAccessCodeLabel(rawPassword),
      reason: data.reason,
      description:
        data.description ||
        "Contraseña de acceso Pro para testers invitados a cambio de feedback",
      status: "active",
      granted_search_allowance: data.granted_search_allowance,
      used_searches: 0,
      max_redemptions: data.max_redemptions || 1,
      redemption_count: 0,
      expires_at_iso: expiresIso,
      granted_by_email: context.user.email || "",
      created_at_iso: nowIso,
    });

    const { access_code_hash: _h, ...safeGrant } = created;
    return safeGrant;
  });

export const revokeComplimentaryProGrant = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string().min(1).max(120) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const serviceRole = base44.asServiceRole;
    const access = await resolveAdminPanelAccess(base44, context.user);
    if (!access.hasPanelAccess || !access.canManageProGrants) {
      throw Object.assign(
        new Error("No tienes permisos para revocar accesos Pro."),
        { status: 403 }
      );
    }
    const updated = await serviceRole.entities.ProAccessGrant.update(data.id, {
      status: "revoked",
    });
    const { access_code_hash: _h, ...safeGrant } = updated;
    return safeGrant;
  });

export const redeemProInvitePassword = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      password_or_code: z.string().trim().min(4).max(80),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    return await redeemComplimentaryProCode({
      serviceRoleBase44: base44.asServiceRole,
      user: context.user,
      rawCode: data.password_or_code,
    });
  });

const BilingualCampaignSchema = z.object({
  email_key: z.enum(["product_update", "promotion", "newsletter"]),
  subject_es: z.string().trim().min(2).max(200),
  subject_en: z.string().trim().min(2).max(200),
  eyebrow_es: z.string().trim().max(120),
  eyebrow_en: z.string().trim().max(120),
  headline_es: z.string().trim().min(2).max(200),
  headline_en: z.string().trim().min(2).max(200),
  subheadline_es: z.string().trim().max(400),
  subheadline_en: z.string().trim().max(400),
  section_title_es: z.string().trim().max(200),
  section_title_en: z.string().trim().max(200),
  body_es: z.string().trim().max(1000),
  body_en: z.string().trim().max(1000),
  card1_title_es: z.string().trim().max(160),
  card1_body_es: z.string().trim().max(500),
  card1_title_en: z.string().trim().max(160),
  card1_body_en: z.string().trim().max(500),
  card2_title_es: z.string().trim().max(160),
  card2_body_es: z.string().trim().max(500),
  card2_title_en: z.string().trim().max(160),
  card2_body_en: z.string().trim().max(500),
  cta_label_es: z.string().trim().min(2).max(80),
  cta_label_en: z.string().trim().min(2).max(80),
  cta_url: z.string().trim().url().max(300),
});

export const saveEmailCampaignBilingualContent = createServerFn({
  method: "POST",
})
  .middleware([requireUser])
  .validator(BilingualCampaignSchema)
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const serviceRole = base44.asServiceRole;
    const access = await resolveAdminPanelAccess(base44, context.user);
    if (!access.hasPanelAccess || !access.canSendCommunications) {
      throw Object.assign(
        new Error("No tienes permisos para editar las plantillas de correo."),
        { status: 403 }
      );
    }

    const existingPage =
      await serviceRole.entities.EmailCampaignContent.filter(
        { email_key: data.email_key },
        { sort: "-created_date", limit: 5 }
      );
    const existing = existingPage?.items?.[0] || null;
    const nowIso = new Date().toISOString();

    const payload = {
      ...data,
      description: `Contenido bilingüe ES/EN para ${data.email_key}`,
      updated_by_email: context.user.email || "",
      updated_at_iso: nowIso,
    };

    const saved = existing
      ? await serviceRole.entities.EmailCampaignContent.update(
          existing.id,
          payload
        )
      : await serviceRole.entities.EmailCampaignContent.create(payload);

    return mergeCampaignContentWithDefaults(data.email_key, saved);
  });

export const dispatchBilingualCampaignEmail = createServerFn({
  method: "POST",
})
  .middleware([requireUser])
  .validator(
    z.object({
      email_key: z.enum(["product_update", "promotion", "newsletter"]),
      mode: z.enum(["test_es", "test_en", "all_users", "selected_users"]),
      recipient_emails: z.array(z.string().trim().email()).max(50).optional(),
      campaign_override: BilingualCampaignSchema.optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const serviceRole = base44.asServiceRole;
    const access = await resolveAdminPanelAccess(base44, context.user);
    if (!access.hasPanelAccess || !access.canSendCommunications) {
      throw Object.assign(
        new Error("No tienes permisos para enviar correos de comunicación."),
        { status: 403 }
      );
    }

    // Persist latest editor content if provided
    let campaignContent = data.campaign_override || null;
    if (campaignContent) {
      const existingPage =
        await serviceRole.entities.EmailCampaignContent.filter(
          { email_key: data.email_key },
          { sort: "-created_date", limit: 5 }
        );
      const existing = existingPage?.items?.[0] || null;
      const nowIso = new Date().toISOString();
      const payload = {
        ...campaignContent,
        description: `Contenido bilingüe ES/EN para ${data.email_key}`,
        updated_by_email: context.user.email || "",
        updated_at_iso: nowIso,
      };
      campaignContent = existing
        ? await serviceRole.entities.EmailCampaignContent.update(
            existing.id,
            payload
          )
        : await serviceRole.entities.EmailCampaignContent.create(payload);
    } else {
      const existingPage =
        await serviceRole.entities.EmailCampaignContent.filter(
          { email_key: data.email_key },
          { sort: "-created_date", limit: 1 }
        );
      campaignContent =
        existingPage?.items?.[0] || DEFAULT_BILINGUAL_CAMPAIGNS[data.email_key];
    }

    if (data.mode === "test_es" || data.mode === "test_en") {
      const res = await sendCommunicationEmailByProfileLanguage({
        serviceRoleBase44: serviceRole,
        recipientEmail: context.user.email,
        recipientUserId: context.user.id,
        emailKey: data.email_key,
        overrideLanguage: data.mode === "test_es" ? "es" : "en",
        user: context.user,
        campaignContent,
      });
      return {
        ok: res.ok,
        sentCount: res.ok ? 1 : 0,
        esCount: data.mode === "test_es" && res.ok ? 1 : 0,
        enCount: data.mode === "test_en" && res.ok ? 1 : 0,
        recipients: [
          {
            email: res.to,
            language: res.language,
            templateName: res.templateName,
            ok: res.ok,
          },
        ],
      };
    }

    // Load user profiles to match each recipient's preferred language
    const [profilesPage, usersRaw] = await Promise.all([
      serviceRole.entities.UserProfile.filter(
        {},
        { sort: "-created_date", limit: 100 }
      ).catch(() => ({ items: [] })),
      serviceRole.entities.User.list("-created_date", 100).catch(() => []),
    ]);

    const profileByEmail = new Map();
    const profileByUserId = new Map();
    for (const p of profilesPage?.items || []) {
      const em = String(p.owner_email || "").trim().toLowerCase();
      if (em && !profileByEmail.has(em)) profileByEmail.set(em, p);
      const uid = p.owner_id || p.created_by_id;
      if (uid && !profileByUserId.has(uid)) profileByUserId.set(uid, p);
    }

    const rawUsers = Array.isArray(usersRaw) ? usersRaw : usersRaw?.items || [];
    const targetMap = new Map();

    if (data.mode === "selected_users" && data.recipient_emails?.length) {
      for (const rawEm of data.recipient_emails) {
        const em = rawEm.trim().toLowerCase();
        const u = rawUsers.find(
          (item) => String(item.email || "").trim().toLowerCase() === em
        );
        const prof =
          (u && profileByUserId.get(u.id)) || profileByEmail.get(em) || null;
        targetMap.set(em, {
          email: rawEm.trim(),
          userId: u?.id || prof?.owner_id || prof?.created_by_id || "",
          user: u || { email: rawEm.trim() },
          profile: prof,
        });
      }
    } else {
      for (const u of rawUsers) {
        const em = String(u.email || "").trim().toLowerCase();
        if (!em || targetMap.has(em)) continue;
        const prof = profileByUserId.get(u.id) || profileByEmail.get(em) || null;
        targetMap.set(em, {
          email: u.email,
          userId: u.id,
          user: u,
          profile: prof,
        });
      }
      for (const p of profilesPage?.items || []) {
        const em = String(p.owner_email || "").trim().toLowerCase();
        if (!em || targetMap.has(em)) continue;
        targetMap.set(em, {
          email: p.owner_email,
          userId: p.owner_id || p.created_by_id || "",
          user: { email: p.owner_email, full_name: p.agency_or_freelancer_name || "" },
          profile: p,
        });
      }
    }

    const targets = Array.from(targetMap.values()).slice(0, 50);
    const recipients = [];
    let sentCount = 0;
    let esCount = 0;
    let enCount = 0;

    for (const target of targets) {
      const res = await sendCommunicationEmailByProfileLanguage({
        serviceRoleBase44: serviceRole,
        recipientEmail: target.email,
        recipientUserId: target.userId,
        emailKey: data.email_key,
        user: target.user,
        profile: target.profile,
        campaignContent,
      });
      if (res.ok) {
        sentCount++;
        if (res.language === "es") esCount++;
        else enCount++;
      }
      recipients.push({
        email: target.email,
        language: res.language,
        templateName: res.templateName,
        ok: res.ok,
      });
    }

    if (campaignContent?.id) {
      await serviceRole.entities.EmailCampaignContent.update(
        campaignContent.id,
        {
          last_sent_at_iso: new Date().toISOString(),
          last_sent_count: sentCount,
        }
      ).catch(() => null);
    }

    return {
      ok: sentCount > 0,
      sentCount,
      esCount,
      enCount,
      recipients,
    };
  });