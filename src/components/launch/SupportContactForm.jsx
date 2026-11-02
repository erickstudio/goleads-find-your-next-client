import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send, CheckCircle2, Mail, MapPin } from "lucide-react";
import { submitSupportEnquiry } from "@/lib/support-fns";
import { useAuth } from "@/lib/AuthContext";
import { usePublicLocale } from "@/lib/PublicLocaleContext";

export default function SupportContactForm() {
  const { lang } = usePublicLocale();
  const { user } = useAuth();
  const isEs = lang === "es";
  const submitFn = useServerFn(submitSupportEnquiry);

  const [name, setName] = useState(user?.full_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [topic, setTopic] = useState("other");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [preferredLang, setPreferredLang] = useState(isEs ? "es" : "en");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setPreferredLang(isEs ? "es" : "en");
  }, [isEs]);

  useEffect(() => {
    if (user?.full_name && !name) setName(user.full_name);
    if (user?.email && !email) setEmail(user.email);
  }, [user?.full_name, user?.email]);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setErrorMsg("");
    setStatus(null);
    try {
      const res = await submitFn({
        data: {
          name,
          email,
          topic,
          subject,
          message,
          preferred_language: preferredLang,
        },
      });
      setStatus(res);
      setSubject("");
      setMessage("");
    } catch (err) {
      setErrorMsg(
        err?.message ||
          (isEs
            ? "No se pudo enviar tu mensaje. Inténtalo de nuevo o escribe a info@goleads.space."
            : "Could not send your message. Please try again or email info@goleads.space.")
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="contact-form"
      className="mt-12 rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
            {isEs ? "CONTACTO DIRECTO" : "DIRECT CONTACT"}
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-foreground">
            {isEs ? "Envíanos un mensaje" : "Send us a message"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEs
              ? "Completa el formulario y nuestro equipo recibirá tu consulta directamente por correo. También recibirás confirmación en tu idioma preferido."
              : "Complete the form and our team will receive your inquiry directly by email. You will also receive a confirmation in your preferred language."}
          </p>
        </div>
        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground shrink-0">
          <a
            href="mailto:info@goleads.space"
            className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
          >
            <Mail className="h-3.5 w-3.5" />
            info@goleads.space
          </a>
          <span className="inline-flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            Panamá, Panamá
          </span>
        </div>
      </div>

      {status?.ok ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-3"
        >
          <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300 font-semibold text-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>
              {isEs
                ? "¡Mensaje enviado! Hemos recibido tu consulta."
                : "Message sent! We have received your inquiry."}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isEs
              ? "Nuestro equipo revisará tu solicitud y te responderá a tu correo desde info@goleads.space."
              : "Our team will review your request and reply to your email from info@goleads.space."}
          </p>
          <button
            type="button"
            onClick={() => setStatus(null)}
            className="rounded-lg border border-border bg-background px-3.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
          >
            {isEs ? "Enviar otra consulta" : "Send another inquiry"}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="support-name"
                className="block text-xs font-medium text-foreground"
              >
                {isEs ? "Tu nombre" : "Your name"}
              </label>
              <input
                id="support-name"
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isEs ? "Ej. Ana Gómez" : "e.g. Alex Morgan"}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="support-email"
                className="block text-xs font-medium text-foreground"
              >
                {isEs ? "Tu correo electrónico" : "Your email address"}
              </label>
              <input
                id="support-email"
                type="email"
                required
                maxLength={160}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isEs ? "tu@empresa.com" : "you@company.com"}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="support-topic"
                className="block text-xs font-medium text-foreground"
              >
                {isEs ? "Motivo de consulta" : "Topic"}
              </label>
              <select
                id="support-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="access">
                  {isEs ? "Acceso e inicio de sesión" : "Sign-in & account access"}
                </option>
                <option value="billing">
                  {isEs ? "Planes y suscripción Pro" : "Plans & Pro subscription"}
                </option>
                <option value="search">
                  {isEs ? "Búsqueda de leads y fuentes" : "Lead discovery & sources"}
                </option>
                <option value="privacy">
                  {isEs ? "Privacidad y datos" : "Privacy & data request"}
                </option>
                <option value="other">
                  {isEs ? "Otra consulta" : "Other inquiry"}
                </option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="support-lang"
                className="block text-xs font-medium text-foreground"
              >
                {isEs
                  ? "Idioma preferido para nuestra respuesta"
                  : "Preferred language for our reply"}
              </label>
              <select
                id="support-lang"
                value={preferredLang}
                onChange={(e) => setPreferredLang(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="es">Español (ES)</option>
                <option value="en">English (EN)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="support-subject"
              className="block text-xs font-medium text-foreground"
            >
              {isEs ? "Asunto" : "Subject"}
            </label>
            <input
              id="support-subject"
              type="text"
              required
              minLength={3}
              maxLength={160}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={
                isEs
                  ? "¿En qué podemos ayudarte?"
                  : "How can we help you?"
              }
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="support-message"
              className="block text-xs font-medium text-foreground"
            >
              {isEs ? "Mensaje" : "Message"}
            </label>
            <textarea
              id="support-message"
              rows={4}
              required
              minLength={10}
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                isEs
                  ? "Describe tu consulta o comentario con el mayor detalle posible..."
                  : "Describe your question or feedback in detail..."
              }
              className="w-full p-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive"
            >
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <p className="text-xs text-muted-foreground">
              {isEs
                ? "No incluyas contraseñas ni datos de tarjetas en este mensaje."
                : "Please do not include passwords or payment card details."}
            </p>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {busy
                ? isEs
                  ? "Enviando mensaje…"
                  : "Sending message…"
                : isEs
                ? "Enviar mensaje a soporte"
                : "Send message to support"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}