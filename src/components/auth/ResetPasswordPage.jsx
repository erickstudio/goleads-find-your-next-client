import { Link } from "@tanstack/react-router";
import { AlertTriangle, Lock } from "lucide-react";
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthError, SubmitButton } from "@/components/auth/parts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePreferences } from "@/lib/PreferencesContext";

export function ResetPasswordPage() {
  const { t } = usePreferences();
  const token = new URLSearchParams(window.location.search).get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = `${t("auth.resetTitle")} — goleads.app`;
  }, [t]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(t("auth.passwordsDoNotMatch"));
      return;
    }
    setBusy(true);
    try {
      await base44.auth.resetPassword({ resetToken: token, newPassword: password });
      window.location.href = "/login";
    } catch (err) {
      setError(err.message || "Failed to reset password");
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title={t("auth.invalidResetTitle")}
        subtitle={t("auth.invalidResetSubtitle")}
        footer={
          <Link to="/forgot-password" className="font-medium text-primary hover:underline">
            {t("auth.requestNewLink")}
          </Link>
        }
      >
        <p className="text-center text-sm text-foreground">{t("auth.invalidResetBody")}</p>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout icon={Lock} title={t("auth.resetTitle")} subtitle={t("auth.resetSubtitle")}>
      <AuthError>{error}</AuthError>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reset-password">{t("auth.newPasswordLabel")}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 pl-10"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reset-confirm">{t("auth.confirmPasswordLabel")}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="reset-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-11 pl-10"
              required
            />
          </div>
        </div>
        <SubmitButton busy={busy} busyLabel={t("auth.resettingBtn")}>
          {t("auth.resetPasswordBtn")}
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}