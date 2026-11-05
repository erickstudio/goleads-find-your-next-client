import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  grantComplimentaryProAccess,
  revokeComplimentaryProGrant,
} from "@/lib/superadmin-fns";

export default function ProGrantsSection({
  proGrants = [],
  usersList = [],
  isEs = true,
  onRefresh,
}) {
  const grantFn = useServerFn(grantComplimentaryProAccess);
  const revokeFn = useServerFn(revokeComplimentaryProGrant);

  const [grantType, setGrantType] = useState("direct_user");
  const [targetEmail, setTargetEmail] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  const [reason, setReason] = useState("beta_feedback");
  const [description, setDescription] = useState("");
  const [allowance, setAllowance] = useState(100);
  const [durationDays, setDurationDays] = useState(30);
  const [maxRedemptions, setMaxRedemptions] = useState(5);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function handleGrant(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      const created = await grantFn({
        data: {
          grant_type: grantType,
          target_email: targetEmail.trim() || undefined,
          access_password:
            grantType === "access_code" ? accessPassword.trim() : undefined,
          reason,
          description: description.trim() || undefined,
          granted_search_allowance: Number(allowance) || 100,
          duration_days: Number(durationDays) || 30,
          max_redemptions:
            grantType === "access_code" ? Number(maxRedemptions) || 1 : 1,
        },
      });
      setTargetEmail("");
      setAccessPassword("");
      setDescription("");
      setMsg(
        grantType === "direct_user"
          ? isEs
            ? `Acceso Pro activado para ${created.target_email} sin pasar por PayPal.`
            : `Pro access activated for ${created.target_email} without PayPal.`
          : isEs
          ? `Contraseña/código de invitación Pro creado (${created.access_code_label}).`
          : `Pro invite password/code created (${created.access_code_label}).`
      );
      await onRefresh?.();
    } catch (error) {
      setErr(
        error?.message ||
          (isEs ? "No se pudo otorgar el acceso Pro." : "Could not grant Pro access.")
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(id) {
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      await revokeFn({ data: { id } });
      setMsg(
        isEs ? "Acceso Pro de cortesía revocado." : "Complimentary Pro access revoked."
      );
      await onRefresh?.();
    } catch (error) {
      setErr(error?.message || (isEs ? "No se pudo revocar." : "Could not revoke."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {isEs
            ? "Accesos Pro sin PayPal (Testers, Feedback o Contraseña)"
            : "Pro Access without PayPal (Testers, Feedback, or Password)"}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {isEs
            ? "Otorga Pro directamente por correo o crea una contraseña/código de activación para usuarios invitados a testear a cambio de feedback. No modifica ni interfiere con las suscripciones de PayPal."
            : "Grant Pro directly by email or create an activation password/code for users invited to test in exchange for feedback. Completely isolated from PayPal subscriptions."}
        </p>
      </div>

      <form onSubmit={handleGrant} className="space-y-4 border-t border-border pt-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setGrantType("direct_user")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
              grantType === "direct_user"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary text-foreground border-border"
            }`}
          >
            {isEs
              ? "1. Dar Pro directo a un correo"
              : "1. Grant Pro directly to email"}
          </button>
          <button
            type="button"
            onClick={() => setGrantType("access_code")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
              grantType === "access_code"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary text-foreground border-border"
            }`}
          >
            {isEs
              ? "2. Crear contraseña / código para testers"
              : "2. Create password / code for testers"}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {grantType === "direct_user" ? (
            <div className="space-y-1 sm:col-span-2">
              <label className="block text-xs font-medium text-foreground">
                {isEs ? "Correo del usuario" : "User email"}
              </label>
              <input
                type="email"
                required
                list="registered-users-emails"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                placeholder="tester@ejemplo.com"
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs text-foreground"
              />
              <datalist id="registered-users-emails">
                {usersList.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.full_name ? `${u.full_name} (${u.ui_language})` : u.email}
                  </option>
                ))}
              </datalist>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-foreground">
                  {isEs
                    ? "Contraseña / código de activación"
                    : "Activation password / code"}
                </label>
                <input
                  type="text"
                  required
                  minLength={12}
                  maxLength={80}
                  value={accessPassword}
                  onChange={(e) => setAccessPassword(e.target.value)}
                  placeholder={isEs ? "Ej. FEEDBACK-PRO-2026 (mín. 12)" : "e.g. FEEDBACK-PRO-2026 (min 12)"}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-mono text-foreground"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-foreground">
                  {isEs
                    ? "Máximo de usuarios que pueden usarla"
                    : "Max users who can redeem"}
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={maxRedemptions}
                  onChange={(e) => setMaxRedemptions(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs text-foreground"
                />
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-medium text-foreground">
              {isEs ? "Motivo" : "Reason"}
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs text-foreground"
            >
              <option value="beta_feedback">
                {isEs ? "Testeo a cambio de feedback" : "Testing for feedback"}
              </option>
              <option value="invite_tester">
                {isEs ? "Invitación de prueba" : "Invited tester"}
              </option>
              <option value="password_access">
                {isEs ? "Acceso por contraseña" : "Password access"}
              </option>
              <option value="partner">
                {isEs ? "Colaborador / Aliado" : "Partner / Collaborator"}
              </option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-foreground">
              {isEs ? "Búsquedas Pro incluidas" : "Included Pro searches"}
            </label>
            <input
              type="number"
              min={1}
              max={5000}
              value={allowance}
              onChange={(e) => setAllowance(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs text-foreground"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-foreground">
              {isEs ? "Duración (días)" : "Duration (days)"}
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs text-foreground"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-foreground">
              {isEs ? "Nota interna (opcional)" : "Internal note (optional)"}
            </label>
            <input
              type="text"
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                isEs
                  ? "Ej. Invitado beta semana 1"
                  : "e.g. Week 1 beta feedback tester"
              }
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs text-foreground"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy
            ? isEs
              ? "Guardando..."
              : "Saving..."
            : grantType === "direct_user"
            ? isEs
              ? "Otorgar Pro al usuario"
              : "Grant Pro to user"
            : isEs
            ? "Crear contraseña Pro"
            : "Create Pro password"}
        </button>
      </form>

      {msg && (
        <p
          role="status"
          className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300"
        >
          {msg}
        </p>
      )}
      {err && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {err}
        </p>
      )}

      <div className="space-y-2 border-t border-border pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {isEs
            ? `Accesos y contraseñas Pro registrados (${proGrants.length})`
            : `Registered Pro grants & passwords (${proGrants.length})`}
        </h3>
        {proGrants.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {isEs
              ? "Aún no hay accesos Pro manuales o por contraseña."
              : "No manual or password Pro grants yet."}
          </p>
        ) : (
          <div className="space-y-2">
            {proGrants.map((g) => (
              <div
                key={g.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border bg-secondary/30 p-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {g.grant_type === "access_code"
                        ? `${isEs ? "Contraseña" : "Password"}: ${
                            g.access_code_label || "****"
                          }`
                        : g.target_email}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                        g.status === "active"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                          : "bg-secondary text-muted-foreground border-border"
                      }`}
                    >
                      {g.status}
                    </span>
                    <span className="text-muted-foreground">
                      {g.grant_type === "access_code"
                        ? `${isEs ? "Canjes" : "Redemptions"}: ${
                            g.redemption_count || 0
                          }/${g.max_redemptions || 1}`
                        : `${isEs ? "Búsquedas" : "Searches"}: ${
                            g.used_searches || 0
                          }/${g.granted_search_allowance || 0}`}
                    </span>
                    {g.expires_at_iso && (
                      <span className="text-muted-foreground">
                        {isEs ? "Expira: " : "Expires: "}
                        {g.expires_at_iso.slice(0, 10)}
                      </span>
                    )}
                  </div>
                  {g.description && (
                    <p className="text-muted-foreground">{g.description}</p>
                  )}
                </div>
                {g.status === "active" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleRevoke(g.id)}
                    className="px-2.5 py-1 rounded border border-border bg-card text-xs text-destructive hover:bg-destructive/10 shrink-0"
                  >
                    {isEs ? "Revocar" : "Revoke"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}