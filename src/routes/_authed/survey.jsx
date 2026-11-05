import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Star, MessageSquarePlus, CheckCircle2, Sparkles } from "lucide-react";
import {
  getMyProductSurveyData,
  submitProductSurveyFeedback,
} from "@/lib/survey-server-fns";
import { usePreferences } from "@/lib/PreferencesContext";

export const Route = createFileRoute("/_authed/survey")({
  ssr: false,
  loader: () => getMyProductSurveyData(),
  head: () => ({
    meta: [
      { title: "Survey & Feedback — GoLeads" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ProductSurveyPage,
});

const IMPROVEMENT_AREAS = [
  {
    key: "lead_quality",
    es: "Calidad y relevancia de los leads",
    en: "Lead quality & relevance",
  },
  {
    key: "search_speed",
    es: "Velocidad y cobertura de búsqueda",
    en: "Search speed & coverage",
  },
  {
    key: "integrations_mcp",
    es: "Integraciones (Sheets, Docs, CSV, MCP)",
    en: "Integrations (Sheets, Docs, CSV, MCP)",
  },
  {
    key: "pricing_plans",
    es: "Planes, cuotas y suscripción Pro",
    en: "Plans, quotas & Pro subscription",
  },
  {
    key: "ui_experience",
    es: "Diseño y facilidad de uso",
    en: "Design & ease of use",
  },
  {
    key: "other",
    es: "Otra sugerencia o función nueva",
    en: "Other suggestion or new feature",
  },
];

const STAR_LABELS = {
  1: { es: "1 · Necesita mejorar mucho", en: "1 · Needs major improvement" },
  2: { es: "2 · Regular", en: "2 · Fair" },
  3: { es: "3 · Bien", en: "3 · Good" },
  4: { es: "4 · Muy bien", en: "4 · Very good" },
  5: { es: "5 · Excelente", en: "5 · Excellent" },
};

function ProductSurveyPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const { lang } = usePreferences();
  const es = lang === "es";

  const existing = data?.existingSurvey || null;
  const submitFn = useServerFn(submitProductSurveyFeedback);

  const [rating, setRating] = useState(existing?.rating || 5);
  const [hoverRating, setHoverRating] = useState(0);
  const [npsScore, setNpsScore] = useState(
    typeof existing?.nps_score === "number" ? existing.nps_score : 9
  );
  const [improvementArea, setImprovementArea] = useState(
    existing?.improvement_area || "lead_quality"
  );
  const [improvementComment, setImprovementComment] = useState(
    existing?.improvement_comment || ""
  );
  const [favoriteFeature, setFavoriteFeature] = useState(
    existing?.favorite_feature || ""
  );
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const activeStars = hoverRating || rating;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!improvementComment.trim() || improvementComment.trim().length < 3) {
      setStatusMsg({
        ok: false,
        text: es
          ? "Por favor cuéntanos en la caja de comentarios qué te gustaría mejorar."
          : "Please share in the comment box what you would like us to improve.",
      });
      return;
    }

    setBusy(true);
    setStatusMsg(null);
    try {
      await submitFn({
        data: {
          rating,
          nps_score: npsScore,
          improvement_area: improvementArea,
          improvement_comment: improvementComment.trim(),
          favorite_feature: favoriteFeature.trim(),
          ui_language: es ? "es" : "en",
        },
      });
      setStatusMsg({
        ok: true,
        text: es
          ? "¡Gracias por tu puntuación y tus comentarios! Tu respuesta ya está registrada en el panel de mejoras."
          : "Thank you for your rating and feedback! Your response has been recorded in our product improvement dashboard.",
      });
      await router.invalidate();
    } catch (err) {
      setStatusMsg({
        ok: false,
        text:
          err?.message ||
          (es
            ? "No se pudo guardar tu encuesta. Inténtalo de nuevo."
            : "Could not save your survey. Please try again."),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 border border-primary/30 px-3 py-1 text-xs font-semibold text-primary">
              <MessageSquarePlus className="h-3.5 w-3.5" />
              {es ? "Encuesta privada de mejora" : "Private improvement survey"}
            </span>
            {existing && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {es
                  ? `Última respuesta enviada (${String(existing.submitted_at_iso || "").slice(0, 10)})`
                  : `Last response submitted (${String(existing.submitted_at_iso || "").slice(0, 10)})`}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {es
              ? "¿Cómo calificarías GoLeads y qué podemos mejorar?"
              : "How would you rate GoLeads & what should we improve?"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {es
              ? "Tu puntuación y tus sugerencias llegan directamente a nuestro panel de producto para priorizar las próximas mejoras."
              : "Your rating and suggestions go directly to our product dashboard to prioritize upcoming improvements."}
          </p>
        </div>

        <Link
          to="/app"
          className="rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:bg-secondary shrink-0"
        >
          {es ? "Volver a buscar clientes" : "Back to Find clients"}
        </Link>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-6 shadow-xs"
      >
        {/* 1. Star Rating (1 to 5) */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-foreground">
            {es
              ? "1. Puntuación general de tu experiencia (1 a 5 estrellas)"
              : "1. Overall rating of your experience (1 to 5 stars)"}
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = star <= activeStars;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    aria-label={`${star} ${es ? "estrellas" : "stars"}`}
                    className={`p-2 rounded-lg border transition-all ${
                      filled
                        ? "border-amber-500/40 bg-amber-500/15 text-amber-400 scale-105"
                        : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Star
                      className={`h-6 w-6 ${
                        filled ? "fill-amber-400 text-amber-400" : ""
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            <span className="text-xs font-semibold text-primary bg-primary/10 border border-primary/25 px-3 py-1.5 rounded-md">
              {STAR_LABELS[activeStars]?.[es ? "es" : "en"]}
            </span>
          </div>
        </div>

        {/* 2. NPS Score (0 to 10) */}
        <div className="space-y-3 pt-2 border-t border-border/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <label className="block text-sm font-semibold text-foreground">
              {es
                ? "2. ¿Qué tan probable es que recomiendes GoLeads a otro freelancer o agencia? (0 a 10)"
                : "2. How likely are you to recommend GoLeads to another freelancer or agency? (0 to 10)"}
            </label>
            <span className="text-xs text-muted-foreground">
              {es ? "0 = Nada probable · 10 = Muy probable" : "0 = Not likely · 10 = Very likely"}
            </span>
          </div>
          <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
              const selected = npsScore === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => setNpsScore(num)}
                  className={`h-10 rounded-lg text-xs font-semibold border transition-colors ${
                    selected
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-secondary/50 text-foreground border-border hover:bg-secondary"
                  }`}
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Main Area to Improve */}
        <div className="space-y-3 pt-2 border-t border-border/70">
          <label className="block text-sm font-semibold text-foreground">
            {es
              ? "3. ¿Qué área principal te gustaría que mejoremos primero?"
              : "3. Which primary area should we improve first?"}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {IMPROVEMENT_AREAS.map((area) => {
              const active = improvementArea === area.key;
              return (
                <button
                  key={area.key}
                  type="button"
                  onClick={() => setImprovementArea(area.key)}
                  className={`text-left px-3.5 py-2.5 rounded-lg border text-xs font-medium transition-colors ${
                    active
                      ? "border-primary bg-primary/15 text-primary font-semibold"
                      : "border-border bg-secondary/40 text-foreground hover:bg-secondary"
                  }`}
                >
                  {es ? area.es : area.en}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Improvement Comment Box */}
        <div className="space-y-2 pt-2 border-t border-border/70">
          <label
            htmlFor="survey-improvement-comment"
            className="block text-sm font-semibold text-foreground"
          >
            {es
              ? "4. Caja de comentarios: ¿Qué mejorarías o qué función te gustaría ver?"
              : "4. Comment box: What would you improve or what feature would you like to see?"}
          </label>
          <p className="text-xs text-muted-foreground">
            {es
              ? "Cuéntanos con detalle qué cambiarías, si tuviste algún inconveniente o qué haría GoLeads más útil para tu negocio."
              : "Tell us in detail what you would change, any friction you ran into, or what would make GoLeads more useful for your business."}
          </p>
          <textarea
            id="survey-improvement-comment"
            rows={4}
            required
            value={improvementComment}
            onChange={(e) => setImprovementComment(e.target.value)}
            placeholder={
              es
                ? "Escribe aquí tus sugerencias de mejora, ideas o comentarios..."
                : "Write your improvement suggestions, ideas, or comments here..."
            }
            className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* 5. Optional Favorite Feature */}
        <div className="space-y-2">
          <label
            htmlFor="survey-favorite-feature"
            className="block text-xs font-semibold text-foreground"
          >
            {es
              ? "5. ¿Qué es lo que más te ha gustado o servido hasta ahora? (Opcional)"
              : "5. What have you found most useful so far? (Optional)"}
          </label>
          <input
            id="survey-favorite-feature"
            type="text"
            value={favoriteFeature}
            onChange={(e) => setFavoriteFeature(e.target.value)}
            placeholder={
              es
                ? "Ej. La verificación de fuentes, los borradores bilingües, la exportación a Sheets..."
                : "E.g. Source verification, bilingual outreach drafts, Google Sheets export..."
            }
            className="w-full h-10 rounded-lg border border-input bg-background px-3.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {statusMsg && (
          <div
            role="status"
            className={`rounded-lg border p-3.5 text-xs flex items-start gap-2.5 ${
              statusMsg.ok
                ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
            }`}
          >
            <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <span className="text-xs text-muted-foreground">
            {es
              ? `Se enviará en tu idioma actual (Español) · Cuenta ${
                  data?.access?.isPro ? "Pro" : "Gratis"
                }`
              : `Submitted in your selected language (English) · ${
                  data?.access?.isPro ? "Pro" : "Free"
                } account`}
          </span>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy
              ? es
                ? "Guardando encuesta…"
                : "Saving survey…"
              : existing
              ? es
                ? "Actualizar mi puntuación y comentario"
                : "Update my rating & comment"
              : es
              ? "Enviar puntuación y comentario"
              : "Submit rating & comment"}
          </button>
        </div>
      </form>
    </div>
  );
}