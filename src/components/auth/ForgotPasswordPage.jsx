import { ArrowLeft, Mail } from "lucide-react";
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLink, SubmitButton } from "@/components/auth/parts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeReturnTo } from "@/lib/authReturnTo";
import { usePreferences } from "@/lib/PreferencesContext";

export function ForgotPasswordPage() {
  const { t } = usePreferences();
  const returnTo = safeReturnTo();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    document.title = `${t("auth.forgotTitle")} — goleads.app`;
  }, [t]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await base44.auth.resetPasswordRequest(email);
    } catch {
      // Same outcome either way.
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  return (
    <AuthLayout icon={Mail} title={t("auth.forgotTitle")} subtitle={t("auth.forgotSubtitle")}>
      {sent ? (
        <p className="text-center text-sm text-foreground">{t("auth.resetSentGeneric")}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="forgot-email">{t("auth.emailAddressLabel")}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 pl-10"
                required
              />
            </div>
          </div>
          <SubmitButton busy={busy} busyLabel={t("auth.sendingBtn")}>
            {t("auth.sendResetLinkBtn")}
          </SubmitButton>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <AuthLink to="/login" returnTo={returnTo}>
          <ArrowLeft className="mr-1 inline h-3 w-3" aria-hidden="true" />
          {t("auth.backToLoginLink")}
        </AuthLink>
      </p>
    </AuthLayout>
  );
}