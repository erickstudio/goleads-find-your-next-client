import { secrets } from "base44:runtime";

// The authenticated immutable user ID must match an owner setting held only on the server.
// Neither a profile flag, a browser value nor the administrator role grants this exemption.
export function isOwnerAccount(user) {
  const ownerId = String(secrets.get("GOLEADS_OWNER_USER_ID") || "").trim();
  return Boolean(ownerId && user?.id && user.id === ownerId);
}
