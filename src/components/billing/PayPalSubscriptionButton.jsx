import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import {
  preparePayPalSubscriptionOrder,
  confirmPayPalSubscriptionOnServer,
  recordPayPalCheckoutCancelOrError,
} from "@/lib/paypal-server-fns";

let paypalSdkPromise = null;
let loadedSdkUrl = null;

/**
 * Loads the PayPal JS SDK (vault=true & intent=subscription) at most once per client_id.
 */
function loadPayPalSdkSingleton(clientId) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("PayPal SDK requires a browser environment."));
  }

  const targetUrl = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
    clientId
  )}&vault=true&intent=subscription`;

  if (window.paypal?.Buttons && loadedSdkUrl === targetUrl) {
    return Promise.resolve(window.paypal);
  }

  if (paypalSdkPromise && loadedSdkUrl === targetUrl) {
    return paypalSdkPromise;
  }

  // Remove any stale script with a different client-id
  const existingScripts = document.querySelectorAll(
    'script[data-goleads-paypal-sdk="true"]'
  );
  existingScripts.forEach((scriptEl) => {
    if (scriptEl.getAttribute("src") !== targetUrl) {
      scriptEl.remove();
    }
  });

  loadedSdkUrl = targetUrl;
  paypalSdkPromise = new Promise((resolve, reject) => {
    const existingMatching = document.querySelector(
      `script[data-goleads-paypal-sdk="true"][src="${targetUrl}"]`
    );
    if (existingMatching && window.paypal?.Buttons) {
      resolve(window.paypal);
      return;
    }

    const script = document.createElement("script");
    script.src = targetUrl;
    script.async = true;
    script.setAttribute("data-goleads-paypal-sdk", "true");
    script.setAttribute("data-sdk-integration-source", "button-factory");

    script.onload = () => {
      if (window.paypal?.Buttons) {
        resolve(window.paypal);
      } else {
        paypalSdkPromise = null;
        reject(new Error("PayPal SDK loaded without Buttons interface."));
      }
    };

    script.onerror = () => {
      paypalSdkPromise = null;
      reject(
        new Error(
          "No se pudo cargar el SDK de PayPal (verifica que el Client ID sea válido para el entorno activo)."
        )
      );
    };

    document.head.appendChild(script);
  });

  return paypalSdkPromise;
}

export default function PayPalSubscriptionButton({
  clientId,
  planId,
  disabled = false,
  isEs = true,
  onPendingChange,
  onVerified,
  onCancelled,
  onErrorMessage,
}) {
  const containerRef = useRef(null);
  const currentEnrollmentIdRef = useRef(null);

  const prepareOrderFn = useServerFn(preparePayPalSubscriptionOrder);
  const confirmSubFn = useServerFn(confirmPayPalSubscriptionOnServer);
  const cancelOrErrorFn = useServerFn(recordPayPalCheckoutCancelOrError);

  const [sdkState, setSdkState] = useState("loading"); // "loading" | "ready" | "error"
  const [sdkError, setSdkError] = useState("");
  const [verifyingOnServer, setVerifyingOnServer] = useState(false);

  useEffect(() => {
    if (disabled || !clientId) {
      setSdkState("ready");
      return;
    }

    let cancelled = false;
    let buttonsInstance = null;

    setSdkState("loading");
    setSdkError("");

    loadPayPalSdkSingleton(clientId)
      .then((paypal) => {
        if (cancelled || !containerRef.current) return;

        // Clear container before rendering to prevent duplicate buttons on route navigation
        containerRef.current.innerHTML = "";

        buttonsInstance = paypal.Buttons({
          style: {
            shape: "rect",
            color: "gold",
            layout: "vertical",
            label: "subscribe",
          },
          createSubscription: async () => {
            onErrorMessage?.("");
            onPendingChange?.(true);
            try {
              const origin =
                typeof window !== "undefined" ? window.location.origin : undefined;
              const prepared = await prepareOrderFn({
                data: { returnOrigin: origin },
              });

              if (!prepared?.ok || !prepared?.subscriptionId) {
                const msg =
                  prepared?.message ||
                  (isEs
                    ? "El servidor rechazó iniciar la suscripción. Verifica la configuración de PayPal."
                    : "Server refused to initiate subscription. Check PayPal configuration.");
                onErrorMessage?.(msg);
                throw new Error(msg);
              }

              currentEnrollmentIdRef.current = prepared.enrollmentId || null;
              return prepared.subscriptionId;
            } finally {
              onPendingChange?.(false);
            }
          },
          onApprove: async (data) => {
            // Never use alert() or grant access on the client; verify on the server
            setVerifyingOnServer(true);
            onPendingChange?.(true);
            try {
              const res = await confirmSubFn({
                data: {
                  subscription_id: data.subscriptionID,
                  enrollment_id: currentEnrollmentIdRef.current || undefined,
                },
              });

              if (!res?.ok) {
                onErrorMessage?.(
                  res?.message ||
                    (isEs
                      ? "La verificación en el servidor no pudo confirmar la suscripción."
                      : "Server verification could not confirm the subscription.")
                );
              } else {
                onVerified?.(res);
              }
            } catch (err) {
              onErrorMessage?.(
                err?.message ||
                  (isEs
                    ? "Error al verificar la suscripción con el servidor."
                    : "Error verifying subscription with the server.")
              );
            } finally {
              setVerifyingOnServer(false);
              onPendingChange?.(false);
            }
          },
          onCancel: async (data) => {
            onPendingChange?.(false);
            try {
              const res = await cancelOrErrorFn({
                data: {
                  enrollment_id: currentEnrollmentIdRef.current || undefined,
                  subscription_id: data?.subscriptionID || undefined,
                  outcome: "cancelled",
                },
              });
              onCancelled?.(
                res?.message ||
                  (isEs
                    ? "Cancelaste el proceso en PayPal antes de aprobar la suscripción. No se realizaron cargos."
                    : "You cancelled the PayPal flow before approving the subscription. No charges were made.")
              );
            } catch {
              onCancelled?.(
                isEs
                  ? "Proceso cancelado en PayPal. No se otorgó acceso."
                  : "Checkout cancelled in PayPal. No access granted."
              );
            }
          },
          onError: async (err) => {
            onPendingChange?.(false);
            const reason = err?.message || "PayPal checkout error";
            await cancelOrErrorFn({
              data: {
                enrollment_id: currentEnrollmentIdRef.current || undefined,
                outcome: "error",
                reason: String(reason).slice(0, 350),
              },
            }).catch(() => {});
            onErrorMessage?.(
              isEs
                ? `No se pudo completar la operación con PayPal: ${reason}`
                : `Could not complete PayPal operation: ${reason}`
            );
          },
        });

        if (buttonsInstance.isEligible && !buttonsInstance.isEligible()) {
          setSdkState("error");
          setSdkError(
            isEs
              ? "El botón de suscripción de PayPal no es elegible para este navegador o configuración."
              : "PayPal subscription button is not eligible for this browser or configuration."
          );
          return;
        }

        buttonsInstance
          .render(containerRef.current)
          .then(() => {
            if (!cancelled) setSdkState("ready");
          })
          .catch((err) => {
            if (!cancelled) {
              setSdkState("error");
              setSdkError(err?.message || "Error rendering PayPal button.");
            }
          });
      })
      .catch((err) => {
        if (!cancelled) {
          setSdkState("error");
          setSdkError(err?.message || "Error loading PayPal SDK.");
        }
      });

    return () => {
      cancelled = true;
      if (buttonsInstance && typeof buttonsInstance.close === "function") {
        buttonsInstance.close().catch(() => {});
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [clientId, planId, disabled, isEs]);

  return (
    <div className="space-y-3">
      {sdkState === "loading" && !disabled && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
          <span>
            {isEs
              ? "Cargando botón oficial de suscripción de PayPal…"
              : "Loading official PayPal subscription button…"}
          </span>
        </div>
      )}

      {verifyingOnServer && (
        <div className="rounded-lg border border-primary/35 bg-primary/10 px-3.5 py-2.5 text-xs text-foreground flex items-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin text-primary shrink-0" />
          <span>
            {isEs
              ? "Confirmando tu suscripción con PayPal…"
              : "Confirming your subscription with PayPal…"}
          </span>
        </div>
      )}

      {sdkState === "error" && sdkError && (
        <div
          role="alert"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200"
        >
          {isEs ? "El pago no está disponible ahora. Inténtalo de nuevo más tarde." : "Checkout is unavailable right now. Please try again later."}
        </div>
      )}

      <div
        id={`paypal-button-container-${planId}`}
        ref={containerRef}
        className={disabled ? "opacity-50 pointer-events-none" : "min-h-[48px]"}
      />

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
        <span>
          {isEs
            ? "Pago seguro con PayPal. Activamos tu plan al confirmar la suscripción."
            : "Secure checkout with PayPal. Your plan starts when your subscription is confirmed."}
        </span>
      </div>
    </div>
  );
}