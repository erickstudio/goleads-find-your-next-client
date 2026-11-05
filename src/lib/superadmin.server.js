import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import { isOwnerAccount } from "@/lib/owner-access.server";
import { isProAccessGrantActive } from "@/lib/subscription-access";

export function hashAccessCode(rawCode) {
  const normalized = String(rawCode || "").trim();
  if (!normalized) return "";
  return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function verifyAccessCodeHash(rawCode, expectedHex) {
  if (!rawCode || !expectedHex) return false;
  const candidateHex = hashAccessCode(rawCode);
  try {
    const a = Buffer.from(candidateHex, "hex");
    const b = Buffer.from(String(expectedHex), "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function maskAccessCodeLabel(rawCode) {
  const clean = String(rawCode || "").trim();
  if (clean.length <= 4) return "****";
  return `${clean.slice(0, 3)}***${clean.slice(-2)}`;
}

/**
 * Resolves whether the current authenticated user is the Superuser (Owner / Admin)
 * or a delegated Collaborator with specific permissions.
 */
export async function resolveAdminPanelAccess(base44, user) {
  if (!user?.id) {
    return {
      hasPanelAccess: false,
      isSuperUser: false,
      isCollaborator: false,
      canManageCollaborators: false,
      canManageProGrants: false,
      canSendCommunications: false,
      canViewDiagnostics: false,
    };
  }

  const email = String(user.email || "").trim().toLowerCase();
  const ownerMatch = isOwnerAccount(user);

  // Check if this user is registered as a delegated collaborator
  let collabRecord = null;
  if (email && base44?.asServiceRole?.entities?.AdminCollaborator?.filter) {
    const collabPage = await base44.asServiceRole.entities.AdminCollaborator.filter(
      { status: "active" },
      { sort: "-created_date", limit: 50 }
    ).catch(() => ({ items: [] }));
    collabRecord =
      (collabPage?.items || []).find(
        (c) =>
          c.status === "active" &&
          String(c.collaborator_email || "").trim().toLowerCase() === email
      ) || null;
  }

  // Superuser is the owner account, or an admin who is not a restricted collaborator entry
  const isSuperUser = ownerMatch || (user.role === "admin" && !collabRecord);

  if (isSuperUser) {
    return {
      hasPanelAccess: true,
      isSuperUser: true,
      isCollaborator: false,
      roleLabel: ownerMatch ? "Superusuario (Propietario)" : "Superusuario (Admin)",
      canManageCollaborators: true,
      canManageProGrants: true,
      canSendCommunications: true,
      canViewDiagnostics: true,
    };
  }

  if (collabRecord) {
    const canManageProGrants = Boolean(collabRecord.can_manage_pro_grants);
    const canSendCommunications = Boolean(collabRecord.can_send_communications);
    const canViewDiagnostics = Boolean(collabRecord.can_view_diagnostics);
    const hasAny = canManageProGrants || canSendCommunications || canViewDiagnostics;

    return {
      hasPanelAccess: hasAny,
      isSuperUser: false,
      isCollaborator: true,
      collaboratorId: collabRecord.id,
      roleLabel: collabRecord.collaborator_name || "Colaborador delegado",
      canManageCollaborators: false,
      canManageProGrants,
      canSendCommunications,
      canViewDiagnostics,
    };
  }

  return {
    hasPanelAccess: false,
    isSuperUser: false,
    isCollaborator: false,
    canManageCollaborators: false,
    canManageProGrants: false,
    canSendCommunications: false,
    canViewDiagnostics: false,
  };
}

export const MIN_PRO_ACCESS_CODE_LENGTH = 12;
const REDEEM_WINDOW_MS = 15 * 60 * 1000;
const MAX_USER_FAILED_ATTEMPTS = 5;
const MAX_GLOBAL_FAILED_ATTEMPTS = 25;
const BASE_LOCKOUT_MS = 15 * 60 * 1000;

const userRedeemAttempts = new Map();
let globalFailedAttempts = [];

function checkRedeemRateLimit(userId, nowMs) {
  globalFailedAttempts = globalFailedAttempts.filter(
    (ts) => nowMs - ts < REDEEM_WINDOW_MS
  );
  if (globalFailedAttempts.length >= MAX_GLOBAL_FAILED_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil(REDEEM_WINDOW_MS / 1000),
    };
  }

  const entry = userRedeemAttempts.get(userId);
  if (!entry) return { allowed: true, retryAfterSec: 0 };

  if (entry.lockedUntilMs && entry.lockedUntilMs > nowMs) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((entry.lockedUntilMs - nowMs) / 1000)),
    };
  }

  const recentFailures = (entry.failures || []).filter(
    (ts) => nowMs - ts < REDEEM_WINDOW_MS
  );
  entry.failures = recentFailures;
  if (recentFailures.length >= MAX_USER_FAILED_ATTEMPTS) {
    const lockDuration =
      BASE_LOCKOUT_MS * Math.pow(2, Math.max(0, (entry.lockoutCount || 0)));
    entry.lockedUntilMs = nowMs + Math.min(lockDuration, 24 * 60 * 60 * 1000);
    entry.lockoutCount = (entry.lockoutCount || 0) + 1;
    userRedeemAttempts.set(userId, entry);
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((entry.lockedUntilMs - nowMs) / 1000)),
    };
  }

  return { allowed: true, retryAfterSec: 0 };
}

function recordFailedRedeemAttempt(userId, nowMs) {
  globalFailedAttempts.push(nowMs);
  const entry = userRedeemAttempts.get(userId) || {
    failures: [],
    lockedUntilMs: 0,
    lockoutCount: 0,
  };
  const recentFailures = (entry.failures || []).filter(
    (ts) => nowMs - ts < REDEEM_WINDOW_MS
  );
  recentFailures.push(nowMs);
  entry.failures = recentFailures;

  if (recentFailures.length >= MAX_USER_FAILED_ATTEMPTS) {
    const lockDuration =
      BASE_LOCKOUT_MS * Math.pow(2, Math.max(0, entry.lockoutCount || 0));
    entry.lockedUntilMs = nowMs + Math.min(lockDuration, 24 * 60 * 60 * 1000);
    entry.lockoutCount = (entry.lockoutCount || 0) + 1;
  }
  userRedeemAttempts.set(userId, entry);
}

function clearRedeemAttempts(userId) {
  userRedeemAttempts.delete(userId);
}

export async function redeemComplimentaryProCode({
  serviceRoleBase44,
  user,
  rawCode,
  nowMs = Date.now(),
}) {
  if (!user?.id) {
    throw new Error("Debes iniciar sesión para activar un código Pro.");
  }

  const rateCheck = checkRedeemRateLimit(user.id, nowMs);
  if (!rateCheck.allowed) {
    return {
      ok: false,
      code: "TOO_MANY_ATTEMPTS",
      retryAfterSec: rateCheck.retryAfterSec,
      message:
        "Demasiados intentos fallidos al canjear códigos. Por seguridad, espera unos minutos antes de volver a intentarlo.",
    };
  }

  const cleanCode = String(rawCode || "").trim();
  if (
    cleanCode.length < MIN_PRO_ACCESS_CODE_LENGTH ||
    cleanCode.length > 80
  ) {
    recordFailedRedeemAttempt(user.id, nowMs);
    return {
      ok: false,
      code: "INVALID_CODE",
      message:
        "La contraseña o código de invitación no es válido (mínimo 12 caracteres).",
    };
  }

  const userEmail = String(user.email || "").trim().toLowerCase();
  const grantsPage = await serviceRoleBase44.entities.ProAccessGrant.filter(
    { status: "active" },
    { sort: "-created_date", limit: 100 }
  );
  const allActive = grantsPage?.items || [];

  // Check if user already has an active direct grant
  const existingUserGrant = allActive.find(
    (g) =>
      isProAccessGrantActive(g, nowMs) &&
      (g.target_user_id === user.id ||
        (userEmail &&
          g.target_email &&
          String(g.target_email).trim().toLowerCase() === userEmail))
  );
  if (existingUserGrant) {
    return {
      ok: true,
      alreadyActive: true,
      grant: existingUserGrant,
      message: "Tu cuenta ya tiene un acceso Pro de prueba/cortesía activo.",
    };
  }

  // Locate matching access_code record
  const matchingCodeGrant = allActive.find((g) => {
    if (g.grant_type !== "access_code" || g.status !== "active") return false;
    if (g.expires_at_iso && Date.parse(g.expires_at_iso) <= nowMs) return false;
    const maxRedemptions = Math.max(1, Number(g.max_redemptions) || 1);
    const redeemed = Math.max(0, Number(g.redemption_count) || 0);
    if (redeemed >= maxRedemptions) return false;
    if (
      g.target_email &&
      String(g.target_email).trim().toLowerCase() !== userEmail
    ) {
      return false;
    }
    return verifyAccessCodeHash(cleanCode, g.access_code_hash);
  });

  if (!matchingCodeGrant) {
    recordFailedRedeemAttempt(user.id, nowMs);
    return {
      ok: false,
      code: "CODE_NOT_FOUND_OR_EXPIRED",
      message:
        "La contraseña o código de acceso no es válido, ya fue utilizado o expiró.",
    };
  }

  clearRedeemAttempts(user.id);

  const nowIso = new Date(nowMs).toISOString();
  const nextCount = (Number(matchingCodeGrant.redemption_count) || 0) + 1;
  const maxRedemptions = Math.max(1, Number(matchingCodeGrant.max_redemptions) || 1);

  await serviceRoleBase44.entities.ProAccessGrant.update(matchingCodeGrant.id, {
    redemption_count: nextCount,
    status: nextCount >= maxRedemptions ? "expired" : "active",
  });

  const userGrant = await serviceRoleBase44.entities.ProAccessGrant.create({
    grant_type: "direct_user",
    target_email: userEmail,
    target_user_id: user.id,
    access_code_label: matchingCodeGrant.access_code_label || "Código canjeado",
    reason: matchingCodeGrant.reason || "password_access",
    description:
      matchingCodeGrant.description ||
      "Acceso Pro activado mediante contraseña/código de invitación",
    status: "active",
    granted_search_allowance:
      Number(matchingCodeGrant.granted_search_allowance) || 100,
    used_searches: 0,
    max_redemptions: 1,
    redemption_count: 1,
    expires_at_iso: matchingCodeGrant.expires_at_iso || "",
    granted_by_email: matchingCodeGrant.granted_by_email || "admin",
    created_at_iso: nowIso,
  });

  return {
    ok: true,
    alreadyActive: false,
    grant: userGrant,
    message: `Acceso Pro activado correctamente (${userGrant.granted_search_allowance} búsquedas incluidas).`,
  };
}