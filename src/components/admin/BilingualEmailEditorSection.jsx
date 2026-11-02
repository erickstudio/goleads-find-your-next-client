import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  saveEmailCampaignBilingualContent,
  dispatchBilingualCampaignEmail,
} from "@/lib/superadmin-fns";

const EMAIL_TYPES = [
  {
    key: "product_update",
    labelEs: "Product Update (Novedades)",
    labelEn: "Product Update",
    tplEs: "ProductUpdateEs",
    tplEn: "ProductUpdate",
  },
  {
    key: "promotion",
    labelEs: "Promotion (Promoción)",
    labelEn: "Promotion",
    tplEs: "PromotionEs",
    tplEn: "Promotion",
  },
  {
    key: "newsletter",
    labelEs: "Newsletter (Boletín)",
    labelEn: "Newsletter",
    tplEs: "NewsletterEs",
    tplEn: "Newsletter",
  },
  {
    key: "enquiry_reply",
    labelEs: "EnquiryReply (Respuesta Soporte)",
    labelEn: "EnquiryReply (Support Reply)",
    tplEs: "EnquiryReplyEs",
    tplEn: "EnquiryReply",
  },
];

export default function BilingualEmailEditorSection({
  campaigns = {},
  usersList = [],
  isEs = true,
  onRefresh,
}) {
  const saveContentFn = useServerFn(saveEmailCampaignBilingualContent);
  const dispatchFn = useServerFn(dispatchBilingualCampaignEmail);

  const [selectedKey, setSelectedKey] = useState("product_update");
  const [form, setForm] = useState(() => campaigns.product_update || {});
  const [previewLang, setPreviewLang] = useState("es");
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (campaigns[selectedKey]) {
      setForm({ ...campaigns[selectedKey], email_key: selectedKey });
    }
  }, [selectedKey, campaigns]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleRecipient(email) {
    setSelectedEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  }

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      await saveContentFn({ data: { ...form, email_key: selectedKey } });
      setMsg(
        isEs
          ? "Contenido bilingüe (ES / EN) guardado correctamente."
          : "Bilingual content (ES / EN) saved."
      );
      await onRefresh?.();
    } catch (error) {
      setErr(
        error?.message ||
          (isEs ? "No se pudo guardar el contenido." : "Could not save content.")
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSend(mode) {
    if (mode === "selected_users" && selectedEmails.length === 0) {
      setErr(
        isEs
          ? "Selecciona al menos un usuario destinatario."
          : "Select at least one recipient user."
      );
      return;
    }
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      const res = await dispatchFn({
        data: {
          email_key: selectedKey,
          mode,
          recipient_emails:
            mode === "selected_users" ? selectedEmails : undefined,
          campaign_override: { ...form, email_key: selectedKey },
        },
      });
      setMsg(
        isEs
          ? `Envío completado: ${res.sentCount} correo(s) enviados (${res.esCount} en español · ${res.enCount} en inglés según el idioma del perfil).`
          : `Send complete: ${res.sentCount} email(s) sent (${res.esCount} in Spanish · ${res.enCount} in English based on profile language).`
      );
      await onRefresh?.();
    } catch (error) {
      setErr(
        error?.message ||
          (isEs ? "Error al enviar los correos." : "Failed to send emails.")
      );
    } finally {
      setBusy(false);
    }
  }

  const esUsersCount = usersList.filter((u) => u.ui_language === "es").length;
  const enUsersCount = usersList.filter((u) => u.ui_language !== "es").length;

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {isEs
              ? "Editor y Envío Bilingüe de Correos (Product Update, Promotion y Newsletter)"
              : "Bilingual Email Editor & Sender (Product Update, Promotion & Newsletter)"}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {isEs
              ? "Edita el contenido en español e inglés. Al enviar, cada cliente recibe automáticamente la versión en el idioma seleccionado en su perfil."
              : "Edit content in Spanish and English. When sent, each client automatically receives the version matching their profile language."}
          </p>
        </div>
        <div className="text-xs text-muted-foreground shrink-0">
          {isEs
            ? `Usuarios por idioma: ${esUsersCount} ES · ${enUsersCount} EN`
            : `Users by language: ${esUsersCount} ES · ${enUsersCount} EN`}
        </div>
      </div>

      {/* Selector of the 4 communication emails */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {EMAIL_TYPES.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setSelectedKey(item.key);
              setMsg("");
              setErr("");
            }}
            className={`p-3 rounded-lg border text-left transition-colors ${
              selectedKey === item.key
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
            }`}
          >
            <div className="text-xs font-semibold">
              {isEs ? item.labelEs : item.labelEn}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
              ES: {item.tplEs} · EN: {item.tplEn}
            </div>
          </button>
        ))}
      </div>

      {/* Dual-language form: Español (ES) & English (EN) side by side */}
      <form onSubmit={handleSave} className="space-y-4 border-t border-border pt-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Spanish Column */}
          <div className="space-y-3 rounded-lg border border-border bg-secondary/20 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Contenido en Español (Plantilla *Es)
              </span>
              <span className="text-[11px] text-muted-foreground">
                Perfil: Español (es)
              </span>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium">Asunto (ES)</label>
              <input
                type="text"
                required
                value={form.subject_es || ""}
                onChange={(e) => updateField("subject_es", e.target.value)}
                className="w-full h-9 px-3 rounded border border-input bg-background text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium">
                Etiqueta superior / Fecha (ES)
              </label>
              <input
                type="text"
                value={form.eyebrow_es || ""}
                onChange={(e) => updateField("eyebrow_es", e.target.value)}
                className="w-full h-9 px-3 rounded border border-input bg-background text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium">
                Titular principal (ES)
              </label>
              <input
                type="text"
                required
                value={form.headline_es || ""}
                onChange={(e) => updateField("headline_es", e.target.value)}
                className="w-full h-9 px-3 rounded border border-input bg-background text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium">Subtítulo (ES)</label>
              <textarea
                rows={2}
                value={form.subheadline_es || ""}
                onChange={(e) => updateField("subheadline_es", e.target.value)}
                className="w-full p-2 rounded border border-input bg-background text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium">
                Título de sección (ES)
              </label>
              <input
                type="text"
                value={form.section_title_es || ""}
                onChange={(e) => updateField("section_title_es", e.target.value)}
                className="w-full h-9 px-3 rounded border border-input bg-background text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium">
                Mensaje principal (ES)
              </label>
              <textarea
                rows={3}
                value={form.body_es || ""}
                onChange={(e) => updateField("body_es", e.target.value)}
                className="w-full p-2 rounded border border-input bg-background text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-[11px] font-medium">
                  Bloque 01 · Título (ES)
                </label>
                <input
                  type="text"
                  value={form.card1_title_es || ""}
                  onChange={(e) => updateField("card1_title_es", e.target.value)}
                  className="w-full h-8 px-2.5 rounded border border-input bg-background text-xs"
                />
                <textarea
                  rows={2}
                  value={form.card1_body_es || ""}
                  onChange={(e) => updateField("card1_body_es", e.target.value)}
                  className="w-full p-2 rounded border border-input bg-background text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-medium">
                  Bloque 02 · Título (ES)
                </label>
                <input
                  type="text"
                  value={form.card2_title_es || ""}
                  onChange={(e) => updateField("card2_title_es", e.target.value)}
                  className="w-full h-8 px-2.5 rounded border border-input bg-background text-xs"
                />
                <textarea
                  rows={2}
                  value={form.card2_body_es || ""}
                  onChange={(e) => updateField("card2_body_es", e.target.value)}
                  className="w-full p-2 rounded border border-input bg-background text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium">
                Texto del botón (ES)
              </label>
              <input
                type="text"
                required
                value={form.cta_label_es || ""}
                onChange={(e) => updateField("cta_label_es", e.target.value)}
                className="w-full h-9 px-3 rounded border border-input bg-background text-xs"
              />
            </div>
          </div>

          {/* English Column */}
          <div className="space-y-3 rounded-lg border border-border bg-secondary/20 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                English Content (English Template)
              </span>
              <span className="text-[11px] text-muted-foreground">
                Profile: English (en)
              </span>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium">Subject (EN)</label>
              <input
                type="text"
                required
                value={form.subject_en || ""}
                onChange={(e) => updateField("subject_en", e.target.value)}
                className="w-full h-9 px-3 rounded border border-input bg-background text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium">
                Top badge / Date (EN)
              </label>
              <input
                type="text"
                value={form.eyebrow_en || ""}
                onChange={(e) => updateField("eyebrow_en", e.target.value)}
                className="w-full h-9 px-3 rounded border border-input bg-background text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium">
                Main headline (EN)
              </label>
              <input
                type="text"
                required
                value={form.headline_en || ""}
                onChange={(e) => updateField("headline_en", e.target.value)}
                className="w-full h-9 px-3 rounded border border-input bg-background text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium">Subheadline (EN)</label>
              <textarea
                rows={2}
                value={form.subheadline_en || ""}
                onChange={(e) => updateField("subheadline_en", e.target.value)}
                className="w-full p-2 rounded border border-input bg-background text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium">
                Section title (EN)
              </label>
              <input
                type="text"
                value={form.section_title_en || ""}
                onChange={(e) => updateField("section_title_en", e.target.value)}
                className="w-full h-9 px-3 rounded border border-input bg-background text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium">Main body (EN)</label>
              <textarea
                rows={3}
                value={form.body_en || ""}
                onChange={(e) => updateField("body_en", e.target.value)}
                className="w-full p-2 rounded border border-input bg-background text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-[11px] font-medium">
                  Highlight 01 · Title (EN)
                </label>
                <input
                  type="text"
                  value={form.card1_title_en || ""}
                  onChange={(e) => updateField("card1_title_en", e.target.value)}
                  className="w-full h-8 px-2.5 rounded border border-input bg-background text-xs"
                />
                <textarea
                  rows={2}
                  value={form.card1_body_en || ""}
                  onChange={(e) => updateField("card1_body_en", e.target.value)}
                  className="w-full p-2 rounded border border-input bg-background text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-medium">
                  Highlight 02 · Title (EN)
                </label>
                <input
                  type="text"
                  value={form.card2_title_en || ""}
                  onChange={(e) => updateField("card2_title_en", e.target.value)}
                  className="w-full h-8 px-2.5 rounded border border-input bg-background text-xs"
                />
                <textarea
                  rows={2}
                  value={form.card2_body_en || ""}
                  onChange={(e) => updateField("card2_body_en", e.target.value)}
                  className="w-full p-2 rounded border border-input bg-background text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium">
                Button label (EN)
              </label>
              <input
                type="text"
                required
                value={form.cta_label_en || ""}
                onChange={(e) => updateField("cta_label_en", e.target.value)}
                className="w-full h-9 px-3 rounded border border-input bg-background text-xs"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-1 flex-1">
            <label className="block text-xs font-medium">
              {isEs ? "Enlace del botón (CTA URL)" : "Button link (CTA URL)"}
            </label>
            <input
              type="url"
              required
              value={form.cta_url || "https://goleads.space/app"}
              onChange={(e) => updateField("cta_url", e.target.value)}
              className="w-full h-9 px-3 rounded border border-input bg-background text-xs font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-md text-xs font-semibold bg-secondary text-foreground border border-border hover:bg-secondary/80 disabled:opacity-50"
          >
            {busy
              ? isEs
                ? "Guardando..."
                : "Saving..."
              : isEs
              ? "Guardar contenido bilingüe"
              : "Save bilingual content"}
          </button>
        </div>
      </form>

      {/* Live Preview */}
      <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">
            {isEs ? "Vista previa del correo" : "Email preview"}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPreviewLang("es")}
              className={`px-2.5 py-1 rounded text-xs font-medium ${
                previewLang === "es"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground border border-border"
              }`}
            >
              Español (ES)
            </button>
            <button
              type="button"
              onClick={() => setPreviewLang("en")}
              className={`px-2.5 py-1 rounded text-xs font-medium ${
                previewLang === "en"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground border border-border"
              }`}
            >
              English (EN)
            </button>
          </div>
        </div>

        <div className="rounded-md border border-border bg-card p-4 space-y-2 text-xs">
          <div className="text-muted-foreground">
            <strong>{isEs ? "Asunto:" : "Subject:"}</strong>{" "}
            {previewLang === "es" ? form.subject_es : form.subject_en}
          </div>
          <div className="text-[11px] uppercase tracking-wider text-primary font-semibold">
            {previewLang === "es" ? form.eyebrow_es : form.eyebrow_en}
          </div>
          <div className="text-base font-bold text-foreground">
            {previewLang === "es" ? form.headline_es : form.headline_en}
          </div>
          <div className="text-muted-foreground">
            {previewLang === "es" ? form.subheadline_es : form.subheadline_en}
          </div>
          <div className="pt-2 border-t border-border">
            <div className="font-semibold text-foreground">
              {previewLang === "es"
                ? form.section_title_es
                : form.section_title_en}
            </div>
            <p className="text-muted-foreground mt-1">
              {previewLang === "es" ? form.body_es : form.body_en}
            </p>
          </div>
        </div>
      </div>

      {/* Recipient selection & Send controls */}
      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => handleSend("test_es")}
            className="px-3 py-2 rounded-md text-xs font-medium bg-secondary text-foreground border border-border hover:bg-secondary/80 disabled:opacity-50"
          >
            {isEs ? "Enviarme prueba en Español" : "Send me Spanish test"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handleSend("test_en")}
            className="px-3 py-2 rounded-md text-xs font-medium bg-secondary text-foreground border border-border hover:bg-secondary/80 disabled:opacity-50"
          >
            {isEs ? "Enviarme prueba en Inglés" : "Send me English test"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handleSend("all_users")}
            className="px-4 py-2 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isEs
              ? `Enviar a todos los clientes según su idioma (${usersList.length})`
              : `Send to all clients in their profile language (${usersList.length})`}
          </button>
          {selectedEmails.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleSend("selected_users")}
              className="px-3 py-2 rounded-md text-xs font-semibold bg-accent text-accent-foreground border border-primary/30"
            >
              {isEs
                ? `Enviar a seleccionados (${selectedEmails.length})`
                : `Send to selected (${selectedEmails.length})`}
            </button>
          )}
        </div>

        {usersList.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">
              {isEs
                ? "O selecciona clientes específicos (se enviará en el idioma preferente de cada perfil):"
                : "Or select specific clients (sent in each profile's preferred language):"}
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded border border-border bg-secondary/20">
              {usersList.map((u) => {
                const checked = selectedEmails.includes(u.email);
                return (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => toggleRecipient(u.email)}
                    className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                      checked
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border"
                    }`}
                  >
                    {u.email} ({u.ui_language.toUpperCase()})
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

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
    </section>
  );
}