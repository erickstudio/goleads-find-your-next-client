import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/lib/PreferencesContext";

export function NotFound({ children }) {
  const { t } = usePreferences();
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-24 text-center px-4">
      <p className="text-6xl font-mono font-semibold tracking-tight text-foreground">404</p>
      <p className="text-muted-foreground">{children ?? t("auth.notFoundBody")}</p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => window.history.back()}>
          {t("auth.goBackBtn")}
        </Button>
        <Button asChild>
          <Link to="/">{t("auth.startOverBtn")}</Link>
        </Button>
      </div>
    </div>
  );
}