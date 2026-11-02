import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  upsertDelegatedCollaborator,
  revokeDelegatedCollaborator,
} from "@/lib/superadmin-fns";

export default function CollaboratorsSection({
  collaborators = [],
  isEs = true,
  onRefresh,
}) {
  const upsertFn = useServerFn(upsertDelegatedCollaborator);
  const revokeFn = useServerFn(revokeDelegatedCollaborator);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [canPro, setCanPro] = useState(true);
  const [canEmails, setCanEmails] = useState(true);
  const [canDiag, setCanDiag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      await upsertFn({
        data: {
          collaborator_email: email.trim(),
          collaborator_name: name.trim() || undefined,
          can_manage_pro_grants: canPro,
          can_send_communications: canEmails,
          can_view_diagnostics: canDiag,
        },
      });
      setEmail("");
      setName("");
      setMsg(
        isEs
          ? "Permisos delegados de colaborador actualizados."
          : "Collaborator delegated permissions updated."
      );
      await onRefresh?.();
    } catch (error) {
      setErr(
        error?.message ||
          (isEs
            ? "No se pudo guardar el colaborador."
            : "Could not save collaborator.")
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
        isEs ? "Acceso de colaborador revocado." : "Collaborator access revoked."
      );
      await onRefresh?.();
    } catch (error) {
      setErr(error?.message || (isEs ? "Error al revocar." : "Failed to revoke."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {isEs
            ? "Delegar acceso limitado a colaboradores (Exclusivo Superusuario)"
            : "Delegate limited access to collaborators (Superuser Only)"}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {isEs
            ? "Autoriza a colaboradores específicos para gestionar accesos Pro de prueba o enviar correos bilingües sin darles control de superusuario."
            : "Authorize specific collaborators to manage test Pro grants or send bilingual emails without granting full superuser control."}
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4 border-t border-border pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium">
              {isEs ? "Correo del colaborador" : "Collaborator email"}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colaborador@ejemplo.com"
              className="w-full h-9 px-3 rounded border border-input bg-background text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium">
              {isEs ? "Nombre o rol (opcional)" : "Name or role (optional)"}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isEs ? "Ej. Equipo Marketing / QA" : "e.g. Marketing / QA"}
              className="w-full h-9 px-3 rounded border border-input bg-background text-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-xs">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={canPro}
              onChange={(e) => setCanPro(e.target.checked)}
            />
            <span>
              {isEs
                ? "Dar/revocar Pro a usuarios de prueba"
                : "Grant/revoke test Pro access"}
            </span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={canEmails}
              onChange={(e) => setCanEmails(e.target.checked)}
            />
            <span>
              {isEs
                ? "Editar y enviar correos (Newsletter, Product Update, Promotion)"
                : "Edit & send emails (Newsletter, Product Update, Promotion)"}
            </span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={canDiag}
              onChange={(e) => setCanDiag(e.target.checked)}
            />
            <span>
              {isEs
                ? "Ver diagnóstico de pagos"
                : "View payment diagnostics"}
            </span>
          </label>
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
            : isEs
            ? "Guardar permisos de colaborador"
            : "Save collaborator permissions"}
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
            ? `Colaboradores delegados (${collaborators.length})`
            : `Delegated collaborators (${collaborators.length})`}
        </h3>
        {collaborators.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {isEs
              ? "No hay colaboradores con acceso delegado actualmente."
              : "No collaborators with delegated access currently."}
          </p>
        ) : (
          <div className="space-y-2">
            {collaborators.map((c) => (
              <div
                key={c.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border bg-secondary/30 p-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {c.collaborator_email}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                        c.status === "active"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                          : "bg-secondary text-muted-foreground border-border"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    {[
                      c.can_manage_pro_grants
                        ? isEs
                          ? "Accesos Pro"
                          : "Pro Grants"
                        : null,
                      c.can_send_communications
                        ? isEs
                          ? "Correos bilingües"
                          : "Bilingual Emails"
                        : null,
                      c.can_view_diagnostics
                        ? isEs
                          ? "Diagnóstico"
                          : "Diagnostics"
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || (isEs ? "Sin permisos" : "No permissions")}
                  </div>
                </div>
                {c.status === "active" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleRevoke(c.id)}
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