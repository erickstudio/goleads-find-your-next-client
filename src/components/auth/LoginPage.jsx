import { Lock, LogIn, Mail } from "lucide-react";
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthError, AuthLink, GoogleButton, OrDivider, SubmitButton } from "@/components/auth/parts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeReturnTo } from "@/lib/authReturnTo";
import { usePreferences } from "@/lib/PreferencesContext";

export function LoginPage() {
  const { t } = usePreferences();
  const returnTo = safeReturnTo();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = `${t("auth.loginBtn")} — goleads.app`;
  }, [t]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = returnTo;
    } catch (err) {
      setError(err.message || t("auth.invalidCredentials"));
      setBusy(false);
    }
  }

  return (
    <AuthLayout icon={LogIn} title={t("auth.loginTitle")} subtitle={t("auth.loginSubtitle")}>
      <GoogleButton returnTo={returnTo} />
      <OrDivider />
      <AuthError>{error}</AuthError>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="login-email">{t("auth.emailLabel")}</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="login-email"
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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">{t("auth.passwordLabel")}</Label>
            <AuthLink to="/forgot-password" returnTo={returnTo} className="text-xs text-primary hover:underline">
              {t("auth.forgotPasswordLink")}
            </AuthLink>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 pl-10"
              required
            />
          </div>
        </div>
        <SubmitButton busy={busy} busyLabel={t("auth.loggingInBtn")}>
          {t("auth.loginBtn")}
        </SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.noAccountPrompt")}{" "}
        <AuthLink to="/register" returnTo={returnTo}>
          {t("auth.createOneLink")}
        </AuthLink>
      </p>
    </AuthLayout>
  );
}