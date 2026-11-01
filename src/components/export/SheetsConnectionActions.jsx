import { LoaderCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function SheetsConnectionActions({ connection: c, es, reconnect, exporting }) {
  const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-3 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
  if (c.loading) return <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />{es ? "Comprobando autorización…" : "Checking authorization…"}</p>;
  if (!c.user) return <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={() => base44.auth.redirectToLogin()}>{es ? "Iniciar sesión" : "Sign in"}</button>{c.error && <button type="button" className={button} onClick={c.refresh}>{es ? "Reintentar" : "Retry"}</button>}</div>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {c.connected === true && <span className="text-xs text-muted-foreground">{es ? "Autorización de Google guardada" : "Google authorization saved"}</span>}
      {(c.connected === false || reconnect) && <button type="button" disabled={c.busy || exporting} onClick={c.connect} className={button}>{c.busy ? es ? "Esperando autorización…" : "Waiting for authorization…" : reconnect ? es ? "Reautorizar Google Sheets" : "Reauthorize Google Sheets" : es ? "Conectar mi Google Sheets" : "Connect my Google Sheets"}</button>}
      {c.connected === true && <button type="button" disabled={c.busy || exporting} onClick={c.disconnect} className={button}>{c.busy ? es ? "Procesando…" : "Processing…" : es ? "Desconectar Sheets" : "Disconnect Sheets"}</button>}
      <button type="button" disabled={c.busy || exporting} onClick={c.refresh} className={button}>{es ? "Actualizar conexión" : "Refresh connection"}</button>
    </div>
  );
}