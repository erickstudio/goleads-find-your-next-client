import { SEARCH_LIMITS } from "@/lib/leads-constants";

// Presentation of the existing server-enforced free limits, not an entitlement source.
// Pro remains unavailable: no commercial quota or verified PayPal configuration exists.
export function getPlanComparison(lang) {
  const es = lang === "es";
  const included = es ? "Incluido" : "Included";
  const planned = es ? "Previsto, no activo" : "Planned, not active";
  return {
    title: es ? "Empieza gratis. Pro está en preparación." : "Start free. Pro is in preparation.",
    intro: es ? "Investiga prospectos antes de contactar. Sin promesas de compradores ni envíos automáticos." : "Research prospects before reaching out. No promises of buyers or automatic sending.",
    feature: es ? "Función" : "Feature",
    free: es ? "Gratis" : "Free",
    pending: es ? "En preparación" : "In preparation",
    rows: [
      [es ? "Búsquedas nuevas" : "New searches", `${SEARCH_LIMITS.maxDailyNewSearches} / ${SEARCH_LIMITS.cacheTtlHours} h`, es ? "Cuota mayor por definir" : "Higher quota to be defined"],
      [es ? "Negocios por búsqueda" : "Businesses per search", `${es ? "Hasta" : "Up to"} ${SEARCH_LIMITS.maxResultsPerSearch}`, es ? "Límite por definir" : "Limit to be defined"],
      [es ? "Revisar fuentes y guardar leads" : "Review sources and save leads", included, planned],
      [es ? "Preparar y copiar emails" : "Prepare and copy emails", included, planned],
      [es ? "Exportar CSV" : "CSV export", included, planned],
      [es ? "Exportar a Google Sheets" : "Google Sheets export", es ? "Con autorización de Google" : "With Google authorization", planned],
      [es ? "Operaciones MCP" : "MCP operations", es ? "No incluido" : "Not included", es ? "Previstas con Pro vigente" : "Planned with current Pro access"],
      [es ? "Envío automático / sincronización CRM" : "Automatic sending / CRM sync", es ? "No disponible" : "Unavailable", es ? "No disponible" : "Unavailable"],
      [es ? "Precio" : "Price", es ? "Sin coste" : "No charge", es ? "Pendiente de verificar en PayPal" : "Pending PayPal verification"],
    ],
    note: es ? "Los límites Gratis se comprueban en el servidor en una ventana móvil de 24 horas. La caché privada no consume búsquedas nuevas. Las prestaciones Pro son previstas: no se vende ni se activa Pro hasta verificar PayPal y definir sus cuotas, precio, moneda y frecuencia." : "Free limits are checked on the server over a rolling 24-hour window. Private cached results do not use new searches. Pro features are planned: Pro is not sold or activated until PayPal is verified and quotas, price, currency and billing frequency are defined.",
  };
}