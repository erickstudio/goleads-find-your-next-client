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
                ? "Plan Gratis (consulta básica): hasta 5 leads guardados con nombre, categoría, ubicación, tipo de señal, estado de verificación, fuente y etapa."
                : "Free Plan (basic query): up to 5 saved leads with business name, category, location, signal type, verification status, source URL, and stage."}
            </li>
            <li>
              {es
                ? "Plan Pro (consulta completa): hasta 50 leads guardados incluyendo web, email/teléfono público, dirección y enlace de Google Maps, notas y borrador de contacto."
                : "Pro Plan (full query): up to 50 saved leads including website, public email/phone, Google Maps address & URL, notes, and outreach draft."}
            </li>
            <li>
              {es
                ? "100% solo lectura: no puede crear, modificar ni eliminar ningún dato, ni expone pagos ni datos administrativos."
                : "100% read-only: cannot create, modify, or delete any data, and never exposes payments or administrative data."}
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
              {es ? "Si estás en Gratis o vence tu Pro" : "If on Free plan or Pro expires"}
            </p>
            <p>
              {es
                ? "Tu conexión MCP sigue funcionando automáticamente en modo de consulta básica de solo lectura (hasta 5 leads con campos básicos) y sin poder modificar nada."
                : "Your MCP connection continues working automatically in basic read-only query mode (up to 5 leads with basic fields) and cannot modify anything."}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}