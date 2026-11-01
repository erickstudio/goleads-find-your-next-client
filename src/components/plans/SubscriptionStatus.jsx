import { Link } from "@tanstack/react-router";

export default function SubscriptionStatus({ quota, lang }) {
  const es = lang === "es";
  return (
    <section aria-label={es ? "Uso y estado de suscripción" : "Usage and subscription status"} className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="font-semibold">{es ? "Cupo gratuito actual" : "Current free allowance"}</h2>
        <p className="text-3xl font-semibold text-primary">{quota?.baseRemainingToday ?? "—"} <span className="text-sm font-normal text-muted-foreground">/ {quota?.maxDaily ?? "—"} {es ? "disponibles" : "remaining"}</span></p>
        <p className="text-sm leading-6 text-muted-foreground">{es ? `Usadas en la ventana móvil de 24 h: ${quota?.usedToday ?? "—"}. Hasta ${quota?.maxResultsPerSearch ?? "—"} negocios por búsqueda.` : `Used over the rolling 24-hour window: ${quota?.usedToday ?? "—"}. Up to ${quota?.maxResultsPerSearch ?? "—"} businesses per search.`}</p>
        <Link to="/dashboard" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">{es ? "Ver consumo y cupos adicionales existentes" : "View usage and existing additional allowances"}</Link>
      </div>
      <div className="rounded-xl border border-primary/30 bg-accent/40 p-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Pro · {es ? "En preparación" : "In preparation"}</p>
        <h2 className="font-semibold">{es ? "PayPal todavía no está conectado" : "PayPal is not connected yet"}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{es ? "Faltan la validación del plan, las credenciales, la cuota Pro y el servicio de confirmación y webhooks. No hay estado ni fechas de suscripción PayPal verificados que mostrar. No se puede contratar Pro desde esta pantalla." : "Plan validation, credentials, the Pro allowance and the confirmation and webhook service are still pending. There is no verified PayPal subscription status or dates to display. Pro cannot be purchased from this screen."}</p>
        <p className="text-xs leading-6 text-muted-foreground">{es ? "No se inicia ningún cobro. Un cupo de piloto existente no es una suscripción Pro. La gestión y cancelación aquí estarán disponibles cuando funcione la conexión de PayPal." : "No charge is initiated. An existing pilot allowance is not a Pro subscription. Management and cancellation here will be available once PayPal is connected."}</p>
        <Link to="/connect" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">{es ? "Leer la guía informativa de MCP" : "Read the informational MCP guide"}</Link>
      </div>
    </section>
  );
}