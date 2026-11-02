import { ensureSandboxProPlan } from "@/lib/sandbox-plan.server";
import { inspectPendingPayPalSetting } from "@/lib/pending-setting.server";
import { createServerFn } from "@tanstack/react-start";
import { requireUser } from "@/lib/auth-middleware";
import { assertAdministrator } from "@/lib/plan-policy";
import { getPayPalServerConfig, fetchPayPalPlanDetails, toPublicPayPalConfigStatus } from "@/lib/paypal-billing.server";

export const prepareSandboxProPlan = createServerFn({ method: "POST" }).middleware([requireUser]).handler(async ({ context }) => { assertAdministrator(context.user); return ensureSandboxProPlan(); });

export const getPaymentAdminDiagnostics = createServerFn({ method: "GET" }).middleware([requireUser])
  .handler(async ({ context }) => {
    assertAdministrator(context.user); // Before config access or provider calls.
    const config = getPayPalServerConfig();
    const status = toPublicPayPalConfigStatus(config);
    // No credential values, even for administrators.
    const { clientId: _clientId, sdkUrl: _sdkUrl, ...safeStatus } = status;
    const [verification, pendingSetting] = await Promise.all([
      config.canAuthenticateWithPayPal
        ? fetchPayPalPlanDetails(config).catch((err) => ({
            ok: false,
            message: err?.message || "No se pudo verificar el plan con PayPal.",
          }))
        : Promise.resolve({ ok: false, message: "Faltan credenciales del servidor." }),
      inspectPendingPayPalSetting().catch(() => null),
    ]);
    return {
      configuration: safeStatus,
      verification,
      administrator: { id: context.user.id, email: context.user.email },
      pendingSetting,
      webhookUrl: "https://goleads.space/api/paypal-webhook",
    };
  });