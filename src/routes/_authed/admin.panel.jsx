import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { getSuperAdminDashboardData } from "@/lib/superadmin-fns";
import { usePreferences } from "@/lib/PreferencesContext";
import ProGrantsSection from "@/components/admin/ProGrantsSection";
import BilingualEmailEditorSection from "@/components/admin/BilingualEmailEditorSection";
import CollaboratorsSection from "@/components/admin/CollaboratorsSection";
import SurveyFeedbackDashboardSection from "@/components/admin/SurveyFeedbackDashboardSection";

export const Route = createFileRoute("/_authed/admin/panel")({
  ssr: false,
  loader: () => getSuperAdminDashboardData(),
  head: () => ({
    meta: [
      { title: "Superuser Panel — GoLeads" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SuperAdminPanelPage,
});

function SuperAdminPanelPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const { lang } = usePreferences();
  const isEs = lang === "es";
  const access = data?.access || {};

  if (!data?.authorized || !access.hasPanelAccess) {
    return (
      <div className="max-w-xl mx-auto rounded-xl border border-border bg-card p-6 space-y-4">
        <span className="inline-flex px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/35">
          {isEs
            ? "Acceso exclusivo (Superusuario y Colaboradores delegados)"
            : "Restricted access (Superuser & Delegated Collaborators)"}
        </span>
        <h1 className="text-xl font-bold text-foreground">
          {isEs
            ? "No tienes permisos para acceder a este panel de administración"
            : "You do not have permission to access this administration panel"}
        </h1>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {isEs
            ? "Este panel está reservado exclusivamente para el superusuario propietario de GoLeads y los colaboradores a quienes haya delegado acceso específico."
            : "This panel is reserved exclusively for the GoLeads superuser owner and collaborators granted delegated access."}
        </p>
        <Link
          to="/app"
          className="inline-flex px-4 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground"
        >
          {isEs ? "Volver al espacio de trabajo" : "Back to workspace"}
        </Link>
      </div>
    );
  }

  const refresh = () => router.invalidate();

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-primary/15 text-primary border border-primary/30">
              {access.roleLabel || (isEs ? "Superusuario" : "Superuser")}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {isEs
              ? "Panel de Superusuario y Administración"
              : "Superuser & Administration Panel"}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {isEs
              ? "Gestiona accesos Pro sin pasar por PayPal, edita y envía correos de comunicación en español e inglés, y delega permisos a colaboradores."
              : "Manage Pro access without PayPal, edit and send communication emails in Spanish and English, and delegate permissions to collaborators."}
          </p>
        </div>
        {access.canViewDiagnostics && (
          <Link
            to="/admin/integrations"
            className="px-3 py-2 rounded-lg border border-border bg-secondary text-xs font-medium text-foreground hover:bg-secondary/80 shrink-0"
          >
            {isEs ? "Diagnóstico PayPal →" : "PayPal Diagnostics →"}
          </Link>
        )}
      </header>

      <SurveyFeedbackDashboardSection
        surveyFeedback={data.surveyFeedback}
        recoveryEvents={data.recoveryEvents}
        isEs={isEs}
        onRefresh={refresh}
      />

      {access.canManageProGrants && (
        <ProGrantsSection
          proGrants={data.proGrants}
          usersList={data.usersList}
          isEs={isEs}
          onRefresh={refresh}
        />
      )}

      {access.canSendCommunications && (
        <BilingualEmailEditorSection
          campaigns={data.campaigns}
          usersList={data.usersList}
          isEs={isEs}
          onRefresh={refresh}
        />
      )}

      {access.canManageCollaborators && (
        <CollaboratorsSection
          collaborators={data.collaborators}
          isEs={isEs}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}