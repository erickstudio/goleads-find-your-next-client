import { Lock, Mail, UserPlus } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthError, AuthLink, GoogleButton, OrDivider, SubmitButton } from "@/components/auth/parts";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { safeReturnTo } from "@/lib/authReturnTo";
import { usePreferences } from "@/lib/PreferencesContext";

const isAlreadyVerified = (err) => err?.status === 400 && /already verified/i.test(err?.message ?? "");

export function RegisterPage() {
  const { t } = usePreferences();
  const returnTo = safeReturnTo();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState("form");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = `${t("auth.createAccountBtn")} — goleads.app`;
  }, [t]);

  async function register(e) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(t("auth.passwordsDoNotMatch"));
      return;
    }
    setBusy(true);
    try {
      await base44.auth.register({ email, password });
      setStep("otp");
    } catch (err) {
      setError(err.message || t("auth.registrationFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) base44.auth.setToken(result.access_token);
      window.location.href = returnTo;
    } catch (err) {
      if (isAlreadyVerified(err)) setStep("already_verified");
      else setError(err.message || "Invalid verification code");
      setBusy(false);
    }
  }

  async function resend() {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      toast(t("auth.codeSentToast"), { description: t("auth.codeSentDesc") });
    } catch (err) {
      if (isAlreadyVerified(err)) setStep("already_verified");
      else setError(err.message || "Failed to resend code");
    }
  }

  if (step === "already_verified") {
    return (
      <AuthLayout icon={UserPlus} title={t("auth.registerTitle")} subtitle={t("auth.registerSubtitle")}>
        <p className="mb-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{email}</span> {t("auth.alreadyVerifiedSuffix")}
        </p>
        <AuthLink
          to="/login"
          returnTo={returnTo}
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("auth.logInLink")}
        </AuthLink>
      </AuthLayout>
    );
  }

  if (step === "otp") {
    return (
      <AuthLayout icon={UserPlus} title={t("auth.registerTitle")} subtitle={t("auth.registerSubtitle")}>
        <form onSubmit={verify}>
          <p className="mb-4 text-sm text-muted-foreground">
            {t("auth.otpSentPrefix")} <span className="font-medium text-foreground">{email}</span>.
          </p>
          <AuthError>{error}</AuthError>
          <div className="mb-6 flex justify-center">
            <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <SubmitButton busy={busy} busyLabel={t("auth.verifyingBtn")} disabled={busy || otpCode.length < 6}>
            {t("auth.verifyBtn")}
          </SubmitButton>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("auth.didntReceiveCode")}{" "}
            <button type="button" onClick={resend} className="font-medium text-primary hover:underline">
              {t("auth.resendBtn")}
            </button>
          </p>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout icon={UserPlus} title={t("auth.registerTitle")} subtitle={t("auth.registerSubtitle")}>
      <GoogleButton returnTo={returnTo} />
      <OrDivider />
      <AuthError>{error}</AuthError>
      <form onSubmit={register} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="register-email">{t("auth.emailLabel")}</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="register-email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder={t("auth.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 pl-10"
              disabled={busy}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-password">{t("auth.passwordLabel")}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="register-password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 pl-10"
              disabled={busy}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-confirm">{t("auth.confirmPasswordLabel")}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="register-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-11 pl-10"
              disabled={busy}
              required
            />
          </div>
        </div>
        <SubmitButton busy={busy} busyLabel={t("auth.creatingAccountBtn")}>
          {t("auth.createAccountBtn")}
        </SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.alreadyHaveAccountPrompt")}{" "}
        <AuthLink to="/login" returnTo={returnTo}>
          {t("auth.logInLink")}
        </AuthLink>
      </p>
    </AuthLayout>
  );
}