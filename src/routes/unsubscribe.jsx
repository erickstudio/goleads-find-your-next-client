import { useState, useEffect, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, AlertTriangle, RefreshCw, MailX } from "lucide-react";
import BrandWordmark from "@/components/BrandWordmark";
import { usePreferences } from "@/lib/PreferencesContext";

export const Route = createFileRoute("/unsubscribe")({
  headers: () => ({ "X-Robots-Tag": "noindex, nofollow" }),
  head: () => ({
    meta: [
      { title: "Unsubscribe — GoLeads" },
      {
        name: "description",
        content: "Manage your GoLeads marketing email preferences.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { lang } = usePreferences();
  const isEs = lang === "es";

  const [status, setStatus] = useState("loading"); // "loading" | "success" | "invalid" | "error"
  const [token, setToken] = useState(null);

  const submitUnsubscribe = useCallback(async (rawToken) => {
    if (!rawToken) {
      setStatus("invalid");
      return;
    }
    setStatus("loading");
    try {
      const response = await fetch("/api/app-emails/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: rawToken }),
      });

      if (response.ok) {
        setStatus("success");
      } else if (response.status === 400) {
        setStatus("invalid");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    const parsedToken = new URLSearchParams(hash).get("token");
    setToken(parsedToken);
    submitUnsubscribe(parsedToken);
  }, [submitUnsubscribe]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-6">
      <header className="max-w-lg w-full mx-auto pt-6 flex items-center justify-center">
        <Link to="/" aria-label="GoLeads">
          <BrandWordmark size="md" />
        </Link>
      </header>

      <main className="max-w-lg w-full mx-auto my-auto py-10">
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-5 text-center">
          {status === "loading" && (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </div>
              <h1 className="text-xl font-bold text-foreground">
                {isEs
                  ? "Procesando tu baja de correos…"
                  : "Processing your unsubscribe request…"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isEs
                  ? "Estamos actualizando tus preferencias de correo en GoLeads."
                  : "We are updating your email preferences for GoLeads."}
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-bold text-foreground">
                {isEs
                  ? "Has cancelado tu suscripción a correos promocionales"
                  : "You have been unsubscribed"}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isEs
                  ? "Ya no recibirás correos de marketing o boletines de GoLeads. Los correos transaccionales (como recibos, verificaciones y restablecimiento de contraseña) seguirán llegando normalmente."
                  : "You will no longer receive marketing or newsletter emails from GoLeads. Transactional emails (such as receipts, verification codes, and password resets) will still arrive."}
              </p>
            </>
          )}

          {status === "invalid" && (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <MailX className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-bold text-foreground">
                {isEs ? "Enlace de baja no válido" : "Invalid unsubscribe link"}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isEs
                  ? "Este enlace para cancelar la suscripción no es válido, está incompleto o ya expiró. Abre el enlace directamente desde el pie del correo que recibiste."
                  : "This unsubscribe link is missing, invalid, or expired. Please open the unsubscribe link directly from the footer of the email you received."}
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-bold text-foreground">
                {isEs
                  ? "No pudimos completar la solicitud"
                  : "Could not complete your request"}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isEs
                  ? "Ocurrió un problema temporal al procesar tu baja. Por favor, inténtalo de nuevo."
                  : "A temporary issue occurred while processing your unsubscribe request. Please try again."}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => submitUnsubscribe(token)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {isEs ? "Reintentar" : "Retry"}
                </button>
              </div>
            </>
          )}

          <div className="pt-3 border-t border-border">
            <Link
              to="/"
              className="text-xs font-medium text-primary hover:underline"
            >
              {isEs ? "← Volver a GoLeads" : "← Back to GoLeads"}
            </Link>
          </div>
        </div>
      </main>

      <footer className="max-w-lg w-full mx-auto pb-4 text-center text-xs text-muted-foreground">
        GoLeads · goleads.space
      </footer>
    </div>
  );
}