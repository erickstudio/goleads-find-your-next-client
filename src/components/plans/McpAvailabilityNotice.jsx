import { Link } from "@tanstack/react-router";

export default function McpAvailabilityNotice({ es }) {
  return (
    <aside className="rounded-xl border border-primary/30 bg-accent/40 p-5 space-y-2" role="note">
      <h2 className="font-semibold text-foreground">MCP · Pro · {es ? "En preparación" : "In preparation"}</h2>
      <p className="text-sm leading-7 text-muted-foreground">{es ? "Esta guía es informativa y no activa permisos. Las operaciones MCP se reservan para Pro, pero la comprobación de suscripción vigente y propiedad en el servidor aún está pendiente. Pro no está a la venta." : "This guide is informational and does not activate permissions. MCP operations are reserved for Pro, but server-side subscription and ownership checks are still pending. Pro is not for sale."}</p>
      <Link to="/subscription" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">{es ? "Ver planes y disponibilidad" : "View plans and availability"}</Link>
    </aside>
  );
}