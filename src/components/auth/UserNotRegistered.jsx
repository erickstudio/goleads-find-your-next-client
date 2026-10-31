import { UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { usePreferences } from "@/lib/PreferencesContext";
import { AuthLayout } from "./AuthLayout";

export function UserNotRegistered() {
  const { logout } = useAuth();
  const { t } = usePreferences();
  return (
    <AuthLayout
      icon={UserX}
      title={t("auth.notRegisteredTitle")}
      subtitle={t("auth.notRegisteredSubtitle")}
    >
      <p className="mb-6 text-center text-sm text-foreground">{t("auth.notRegisteredBody")}</p>
      <Button variant="outline" className="h-11 w-full font-medium" onClick={logout}>
        {t("nav.signOut")}
      </Button>
    </AuthLayout>
  );
}