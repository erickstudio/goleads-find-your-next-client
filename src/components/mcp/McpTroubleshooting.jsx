import { ShieldCheck, Terminal, HelpCircle } from "lucide-react";

export default function McpTroubleshooting({ es }) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2>{es ? "Privacidad y permisos incluidos" : "Privacy & included permissions"}</h2>
          </div>
          <ul className="space-y-2 text-xs text-muted-foreground leading-relaxed list-disc pl-4">
            <li>
              {es
                ? "Solo lectura de tus propios leads guardados (hasta 50 por consulta, filtrables por etapa: saved, researching, qualified, archived)."
                : "Read-only access to your own saved leads (up to 50 per request, filterable by stage: saved, researching, qualified, archived)."}
            </li>
            <li>
              {es
                ? "Incluye nombre del negocio, ubicación, web, email/teléfono público, dirección y enlace de Google Maps, señal verificada y borrador de contacto."
                : "Includes business name, location, website, public email/phone, Google Maps address & URL, verified signal, and outreach draft."}
            </li>
            <li>
              {es
                ? "No expone pagos, suscripciones, datos administrativos, otros usuarios ni operaciones de creación, edición o borrado."
                : "Never exposes payments, subscriptions, administrative data, other users, or any create/update/delete operations."}
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Terminal className="h-4 w-4 text-primary" />
            <h2>
              {es ? "Ejemplos para pedirle a tu asistente" : "Example prompts for your assistant"}
            </h2>
          </div>
          <ul className="space-y-2 text-xs text-muted-foreground leading-relaxed">
            <li className="rounded-md bg-secondary/60 border border-border px-3 py-2 font-mono text-[11px] text-foreground">
              {es
                ? "«Muéstrame mis últimos 10 leads guardados en GoLeads con su correo, teléfono y dirección de Google Maps.»"
                : "\"Show me my latest 10 saved leads in GoLeads with their email, phone, and Google Maps address.\""}
            </li>
            <li className="rounded-md bg-secondary/60 border border-border px-3 py-2 font-mono text-[11px] text-foreground">
              {es
                ? "«Consulta mis leads guardados en etapa 'qualified' y prepara una tabla de seguimiento.»"
                : "\"Fetch my saved leads in the 'qualified' stage and build a follow-up table.\""}
            </li>
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-3 shadow-xs">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <HelpCircle className="h-4 w-4 text-primary" />
          <h2>
            {es
              ? "¿Qué hacer si falla la conexión o cambia tu cuenta?"
              : "What to do if connection fails or your account changes"}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground leading-relaxed">
          <div className="rounded-lg bg-secondary/40 border border-border p-3 space-y-1">
            <p className="font-semibold text-foreground">
              {es
                ? "Actualización del conector o sesión expirada"
                : "Connector updates or expired session"}
            </p>
            <p>
              {es
                ? "Los asistentes guardan en caché la lista de herramientas. Cuando publicamos mejoras o tu sesión expira, actualiza o vuelve a conectar el conector en tu asistente para autorizar de nuevo."
                : "Assistants cache the tool list. After we ship changes or if your session expires, refresh or reconnect the connector in your assistant to authorize again."}
            </p>
          </div>
          <div className="rounded-lg bg-secondary/40 border border-border p-3 space-y-1">
            <p className="font-semibold text-foreground">
              {es ? "Si aún no tienes leads guardados" : "If you have no saved leads yet"}
            </p>
            <p>
              {es
                ? "El asistente conectará sin errores pero recibirá 0 leads. Primero entra en «Encuentra clientes» y pulsa «Guardar lead» en al menos un negocio."
                : "Your assistant will connect without errors but receive 0 leads. First go to 'Find leads' and click 'Save lead' on at least one business."}
            </p>
          </div>
          <div className="rounded-lg bg-secondary/40 border border-border p-3 space-y-1">
            <p className="font-semibold text-foreground">
              {es ? "Si cancelas la autorización OAuth" : "If you cancel OAuth authorization"}
            </p>
            <p>
              {es
                ? "No se concede acceso ni se comparten datos. Puedes volver a iniciar la conexión desde tu asistente cuando lo desees."
                : "No access is granted and no data is shared. You can initiate the connection again from your assistant anytime."}
            </p>
          </div>
          <div className="rounded-lg bg-secondary/40 border border-border p-3 space-y-1">
            <p className="font-semibold text-foreground">
              {es ? "Si pasas a Gratis o vence tu Pro" : "If on Free plan or Pro expires"}
            </p>
            <p>
              {es
                ? "El servidor MCP rechazará la consulta con un mensaje claro indicando que se requiere un plan GoLeads Pro activo."
                : "The MCP server will decline the query with a clear message stating that an active GoLeads Pro plan is required."}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}