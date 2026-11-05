import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Star, MessageSquareHeart, Workflow, Filter } from "lucide-react";
import SurveyStatCard from "@/components/admin/SurveyStatCard";
import { updateSurveyFeedbackAdminStatus } from "@/lib/survey-server-fns";

const AREA_LABELS = {
  lead_quality: { es: "Calidad de leads", en: "Lead quality" },
  search_speed: { es: "Velocidad de búsqueda", en: "Search speed" },
  integrations_mcp: { es: "Integraciones / MCP", en: "Integrations / MCP" },
  pricing_plans: { es: "Planes y precios", en: "Plans & pricing" },
  ui_experience: { es: "Diseño y usabilidad", en: "Design & usability" },
  other: { es: "Otro / Nueva función", en: "Other / New feature" },
};

const STATUS_LABELS = {
  new: { es: "Nuevo", en: "New" },
  reviewed: { es: "Revisado", en: "Reviewed" },
  planned: { es: "En hoja de ruta", en: "Planned" },
  resolved: { es: "Implementado", en: "Implemented" },
};

export default function SurveyFeedbackDashboardSection({
  surveyFeedback = [],
  recoveryEvents = [],
  isEs = true,
  onRefresh,
}) {
  const updateStatusFn = useServerFn(updateSurveyFeedbackAdminStatus);
  const [areaFilter, setAreaFilter] = useState("all");
  const [langFilter, setLangFilter] = useState("all");
  const [busyId, setBusyId] = useState("");

  const metrics = useMemo(() => {
    const total = surveyFeedback.length;
    if (total === 0) {
      return {
        total: 0,
        avgRating: 0,
        avgNps: 0,
        promotersPct: 0,
        esCount: 0,
        enCount: 0,
        starCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        areaCounts: {},
      };
    }

    let ratingSum = 0;
    let npsSum = 0;
    let promoters = 0;
    let esCount = 0;
    let enCount = 0;
    const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    const areaCounts = {};

    for (const item of surveyFeedback) {
      const r = Math.min(5, Math.max(1, Number(item.rating) || 5));
      const nps = Math.min(10, Math.max(0, Number(item.nps_score ?? 8)));
      ratingSum += r;
      npsSum += nps;
      if (nps >= 9) promoters += 1;
      if (item.ui_language === "en") enCount += 1;
      else esCount += 1;
      starCounts[r] = (starCounts[r] || 0) + 1;
      const area = item.improvement_area || "other";
      areaCounts[area] = (areaCounts[area] || 0) + 1;
    }

    return {
      total,
      avgRating: ratingSum / total,
      avgNps: npsSum / total,
      promotersPct: Math.round((promoters / total) * 100),
      esCount,
      enCount,
      starCounts,
      areaCounts,
    };
  }, [surveyFeedback]);

  const filteredItems = useMemo(() => {
    return surveyFeedback.filter((item) => {
      if (areaFilter !== "all" && item.improvement_area !== areaFilter) return false;
      if (langFilter !== "all" && (item.ui_language || "es") !== langFilter)
        return false;
      return true;
    });
  }, [surveyFeedback, areaFilter, langFilter]);

  async function handleStatusChange(id, nextStatus) {
    setBusyId(id);
    try {
      await updateStatusFn({ data: { id, admin_status: nextStatus } });
      if (onRefresh) await onRefresh();
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <MessageSquareHeart className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-bold text-foreground">
              {isEs
                ? "Dashboard de Encuestas, Puntuaciones y Flujos Bilingües"
                : "Survey Ratings, Improvement Feedback & Bilingual Workflows Dashboard"}
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            {isEs
              ? "Resultados en tiempo real de la página privada /survey y estado de los 3 flujos automáticos en español e inglés."
              : "Real-time results from the private /survey page and status of the 3 automated bilingual workflows."}
          </p>
        </div>

        <a
          href="/survey"
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary hover:bg-primary/20 shrink-0"
        >
          {isEs ? "Abrir página de encuesta (/survey) →" : "Open survey page (/survey) →"}
        </a>
      </div>

      {/* 3 Designed Stat Cards (sc4-section) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SurveyStatCard
          label={isEs ? "Puntuación Media" : "Average Rating"}
          targetValue={metrics.avgRating}
          decimals={1}
          suffix=" ★"
          chipText="/ 5.0 ★"
          subLabel={
            isEs
              ? `Basado en ${metrics.total} encuesta(s)`
              : `Based on ${metrics.total} survey(s)`
          }
          variant="violet"
        />
        <SurveyStatCard
          label={isEs ? "Respuestas Totales" : "Total Survey Responses"}
          targetValue={metrics.total}
          decimals={0}
          chipText={`${metrics.esCount} ES · ${metrics.enCount} EN`}
          subLabel={isEs ? "Por idioma seleccionado" : "By selected language"}
          variant="emerald"
        />
        <SurveyStatCard
          label={isEs ? "Recomendación (NPS)" : "Recommendation (NPS)"}
          targetValue={metrics.avgNps}
          decimals={1}
          suffix=" / 10"
          chipText={`${metrics.promotersPct}%`}
          subLabel={isEs ? "Promotores (9–10)" : "Promoters (9–10)"}
          variant="amber"
        />
      </div>

      {/* Summary of the 3 Active Bilingual Workflows */}
      <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Workflow className="h-4 w-4 text-primary" />
            <span>
              {isEs
                ? "3 Flujos Automáticos Activos (Español e Inglés según perfil del usuario)"
                : "3 Active Automated Workflows (Spanish & English by user profile)"}
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
            {isEs
              ? `${recoveryEvents.length} evento(s) de recuperación registrados`
              : `${recoveryEvents.length} recovery event(s) logged`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="rounded-lg border border-border bg-card p-3 space-y-1">
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/15 text-primary">
              {isEs ? "Flujo 1 · ES / EN" : "Flow 1 · ES / EN"}
            </span>
            <p className="font-semibold text-foreground">
              {isEs
                ? "Promoción de GoLeads Pro tras el registro"
                : "GoLeads Pro Promotion after Signup"}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {isEs
                ? "Si tras registrarse pasan 24h y no tiene suscripción Pro activa, envía los beneficios de Pro en su idioma con enlace a /plans."
                : "If 24h after signup the user is still not on Pro, sends Pro benefits in their language with a direct link to /plans."}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-3 space-y-1">
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/15 text-primary">
              {isEs ? "Flujo 2 · ES / EN" : "Flow 2 · ES / EN"}
            </span>
            <p className="font-semibold text-foreground">
              {isEs
                ? "Recuperación de intento o espera en Suscripción"
                : "Subscription Page Linger or Failed Attempt Recovery"}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {isEs
                ? "Se dispara si permanece mucho tiempo en /plans o si un intento de pago falla/se cancela, invitándole a volver a /plans?recover=1."
                : "Fires if a user lingers on /plans or a payment attempt fails/cancels, inviting them back to /plans?recover=1."}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-3 space-y-1">
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/15 text-primary">
              {isEs ? "Flujo 3 · ES / EN" : "Flow 3 · ES / EN"}
            </span>
            <p className="font-semibold text-foreground">
              {isEs
                ? "Solicitud de Feedback y Encuesta (/survey)"
                : "Feedback & Improvement Survey Request (/survey)"}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {isEs
                ? "Invita en el idioma del usuario a puntuar GoLeads (1–5★) y dejar sugerencias en la caja de comentarios de /survey."
                : "Invites the user in their language to rate GoLeads (1–5★) and share ideas in the /survey comment box."}
            </p>
          </div>
        </div>
      </div>

      {/* Distribution breakdown: Stars + Improvement categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isEs ? "Distribución de Puntuaciones (1 a 5 ★)" : "Star Rating Distribution (1 to 5 ★)"}
          </h3>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = metrics.starCounts[star] || 0;
            const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
            return (
              <div key={star} className="flex items-center gap-3 text-xs">
                <span className="w-12 font-mono font-semibold text-foreground">
                  {star} ★
                </span>
                <div className="flex-1 h-2.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-16 text-right font-mono text-muted-foreground">
                  {count} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isEs ? "Áreas más solicitadas para mejorar" : "Most Requested Improvement Areas"}
          </h3>
          {Object.entries(AREA_LABELS).map(([key, labelObj]) => {
            const count = metrics.areaCounts[key] || 0;
            const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
            return (
              <div key={key} className="flex items-center gap-3 text-xs">
                <span className="w-40 truncate text-foreground">
                  {isEs ? labelObj.es : labelObj.en}
                </span>
                <div className="flex-1 h-2.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary/80 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-12 text-right font-mono text-muted-foreground">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filterable list of improvement comments */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Filter className="h-4 w-4 text-primary" />
            <span>
              {isEs
                ? `Caja de comentarios de qué mejorar (${filteredItems.length})`
                : `Improvement comments feed (${filteredItems.length})`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              aria-label={isEs ? "Filtrar por área" : "Filter by area"}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground"
            >
              <option value="all">
                {isEs ? "Todas las áreas" : "All areas"}
              </option>
              {Object.entries(AREA_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {isEs ? v.es : v.en}
                </option>
              ))}
            </select>

            <select
              value={langFilter}
              onChange={(e) => setLangFilter(e.target.value)}
              aria-label={isEs ? "Filtrar por idioma" : "Filter by language"}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground"
            >
              <option value="all">{isEs ? "Idioma: Todos" : "Language: All"}</option>
              <option value="es">Español (ES)</option>
              <option value="en">English (EN)</option>
            </select>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="rounded-lg border border-border bg-secondary/20 p-6 text-center text-xs text-muted-foreground">
            {isEs
              ? "Aún no hay comentarios registrados con este filtro. Puedes probar la encuesta en /survey."
              : "No survey comments match this filter yet. You can test the survey at /survey."}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const areaLabel =
                AREA_LABELS[item.improvement_area]?.[isEs ? "es" : "en"] ||
                item.improvement_area;
              return (
                <article
                  key={item.id}
                  className="rounded-xl border border-border bg-secondary/25 p-4 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-300">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {item.rating} / 5
                      </span>
                      <span className="rounded bg-primary/15 border border-primary/30 px-2 py-0.5 text-xs font-medium text-primary">
                        NPS: {item.nps_score ?? "—"}/10
                      </span>
                      <span className="rounded bg-secondary border border-border px-2 py-0.5 text-xs font-medium text-foreground">
                        {areaLabel}
                      </span>
                      <span className="rounded bg-secondary border border-border px-2 py-0.5 text-[11px] font-mono uppercase text-muted-foreground">
                        {item.ui_language || "es"} · {item.plan_at_submission || "free"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        disabled={busyId === item.id}
                        value={item.admin_status || "new"}
                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                        className="h-7 rounded border border-input bg-background px-2 text-xs text-foreground"
                      >
                        {Object.entries(STATUS_LABELS).map(([stKey, stLabel]) => (
                          <option key={stKey} value={stKey}>
                            {isEs ? stLabel.es : stLabel.en}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {item.improvement_comment}
                  </p>

                  {item.favorite_feature && (
                    <p className="text-xs text-muted-foreground">
                      <strong className="text-foreground">
                        {isEs ? "Lo más útil:" : "Most useful:"}
                      </strong>{" "}
                      {item.favorite_feature}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground font-mono">
                    <span>
                      {item.user_name || item.owner_email || "Usuario"} (
                      {item.owner_email || "—"})
                    </span>
                    <span>
                      {String(item.submitted_at_iso || item.created_date || "")
                        .replace("T", " ")
                        .slice(0, 16)}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}