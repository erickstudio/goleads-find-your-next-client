import { ErrorComponent, Link, rootRouteId, useMatch, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/lib/PreferencesContext";

export function DefaultCatchBoundary({ error }) {
  const router = useRouter();
  const { t } = usePreferences();
  const isRoot = useMatch({ strict: false, select: (state) => state.id === rootRouteId });

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 py-24 px-4">
      <ErrorComponent error={error} />
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.invalidate()}>
          {t("auth.tryAgainBtn")}
        </Button>
        <Button asChild>
          {isRoot ? (
            <Link to="/">{t("auth.homeBtn")}</Link>
          ) : (
            <Link
              to="/"
              onClick={(e) => {
                e.preventDefault();
                window.history.back();
              }}
            >
              {t("auth.goBackBtn")}
            </Link>
          )}
        </Button>
      </div>
    </div>
  );
}