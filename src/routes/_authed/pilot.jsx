import { useState, useEffect } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  getPilotWorkspaceData,
  initiateTestPilotCheckout,
  verifyPilotCheckoutSession,
} from "@/lib/pilot-server-fns";
import { usePreferences } from "@/lib/PreferencesContext";

export const Route = createFileRoute("/_authed/pilot")({
  ssr: false,
  validateSearch: (search) => {
    const out = {};
    if (search?.checkout === "return" || search?.checkout === "canceled") {
      out.checkout = search.checkout;
    }
    if (typeof search?.session_id === "string" && search.session_id.trim()) {
      out.session_id = search.session_id.trim().slice(0, 160);
    }
    return out;
  },
  loader: () => getPilotWorkspaceData(),
  head: () => ({
    meta: [
      { title: "One-time pilot (Test mode) — goleads.app" },
      {
        name: "description",
        content:
          "Review the one-time paid pilot offer, undecided commercial terms, and test-mode payment verification.",
      },
    ],
  }),
  component: PilotOfferScreen,
});

function PilotOfferScreen() {
  const data = Route.useLoaderData();
  const searchParams = Route.useSearch();
  const router = useRouter();
  const { lang, t } = usePreferences();

  const startCheckoutFn = useServerFn(initiateTestPilotCheckout);
  const verifySessionFn = useServerFn(verifyPilotCheckoutSession);

  const offer = data?.offerSpec;
  const stripeStatus = data?.stripeStatus;
  const quota = data?.quota || {};
  const myEnrollments = data?.myEnrollments || [];
  const txSummary = data?.transactionSummary || {};
  const feedbackRecords = data?.feedbackRecords || [];
  const documentedImprovements = data?.documentedImprovements || [];

  const [isBusy, setIsBusy] = useState(false);
  const [statusBanner, setStatusBanner] = useState("");
  const [bannerTone, setBannerTone] = useState("info");

  useEffect(() => {
    document.title = t("pilot.pageTitle");
  }, [lang, t]);

  useEffect(() => {
    if (!searchParams.checkout || !searchParams.session_id) return;
    let cancelled = false;

    (async () => {
      setIsBusy(true);
      try {
        const res = await verifySessionFn({
          data: {
            session_id: searchParams.session_id,
            return_state: searchParams.checkout,
          },
        });
        if (cancelled) return;
        setBannerTone(res?.verified ? "success" : "warning");
        setStatusBanner(
          res?.note ||
            "Checked payment session status on the server. Allowance is only granted after server verification."
        );
        await router.invalidate();
      } catch (err) {
        if (cancelled) return;
        setBannerTone("warning");
        setStatusBanner(err?.message || "Could not verify checkout session.");
      } finally {
        if (!cancelled) setIsBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams.checkout, searchParams.session_id]);

  const handleStartTestCheckout = async () => {
    setIsBusy(true);
    setStatusBanner("");
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : undefined;
      const res = await startCheckoutFn({
        data: { returnOrigin: origin },
      });
      if (res?.ok && res?.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      setBannerTone("warning");
      setStatusBanner(
        res?.reason ||
          "Test checkout is not active yet: Stripe sandbox credentials and commercial terms are still pending."
      );
      await router.invalidate();
    } catch (err) {
      setBannerTone("warning");
      setStatusBanner(err?.message || "Could not start test checkout.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Preparation Mode Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/35">
              {t("pilot.prepBadge")}
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-secondary text-muted-foreground border border-border">
              {t("pilot.oneTimeBadge")}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {t("pilot.heading")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("pilot.subheading")}
          </p>
        </div>

        <Link
          to="/"
          className="px-3.5 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 text-center focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {t("pilot.backToDiscover")}
        </Link>
      </div>

      {statusBanner && (
        <div
          role="status"
          className={`px-4 py-3 rounded-md border text-xs flex items-center justify-between gap-3 ${
            bannerTone === "success"
              ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-800 dark:text-emerald-200"
              : "bg-amber-500/15 border-amber-500/35 text-amber-900 dark:text-amber-200"
          }`}
        >
          <span>{statusBanner}</span>
          <button
            type="button"
            onClick={() => setStatusBanner("")}
            className="underline font-medium shrink-0"
          >
            {t("common.dismiss")}
          </button>
        </div>
      )}

      {/* Section 1: Pilot Offer Draft (Agreed vs Undecided Terms) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-card text-card-foreground rounded-lg border border-border p-5 space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">
              {t("pilot.agreedScopeTitle")}
            </h2>
            <p className="text-xs text-muted-foreground">{offer?.targetCustomer}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("pilot.includedDeliverablesTitle")}
            </h3>
            <ul className="space-y-1.5 text-xs text-foreground list-disc pl-4">
              {(offer?.agreedDeliverables || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="bg-secondary/50 rounded-md border border-border p-3.5 space-y-1.5">
            <h3 className="text-xs font-semibold text-foreground">
              {t("pilot.honestBoundariesTitle")}
            </h3>
            <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-4">
              {(offer?.explicitDisclaimers || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Undecided Commercial Terms */}
        <div className="lg:col-span-5 bg-card text-card-foreground rounded-lg border border-amber-500/40 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">
              {t("pilot.undecidedTitle")}
            </h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/35">
              {t("pilot.decisionRequiredBadge")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("pilot.undecidedIntro")}
          </p>

          <div className="space-y-2.5">
            {Object.entries(offer?.undecidedTerms || {}).map(([key, term]) => (
              <div
                key={key}
                className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 space-y-0.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{term.label}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-800 dark:text-amber-300">
                    {term.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{term.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 2: In-Product Research Allowance vs Base44 Platform Credits */}
      <section className="bg-card text-card-foreground rounded-lg border border-border p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("pilot.allowanceVsCreditsTitle")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-md bg-accent/60 border border-primary/25 space-y-1">
            <div className="font-semibold text-foreground">
              {t("pilot.inProductTitle")}
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {offer?.creditsDistinction?.inProductResearchAllowance}
            </p>
            <div className="pt-1 text-foreground font-medium">
              {t("pilot.currentAllowanceSummary", {
                baseRemaining: quota.baseRemainingToday ?? 0,
                maxDaily: quota.maxDaily ?? 3,
                pilotRemaining: quota.pilotRemaining ?? 0,
                pilotGranted: quota.pilotGrantedTotal ?? 0,
                pilotUsed: quota.pilotUsedTotal ?? 0,
              })}
            </div>
          </div>

          <div className="p-3.5 rounded-md bg-secondary/50 border border-border space-y-1">
            <div className="font-semibold text-foreground">
              {t("pilot.platformCreditsTitle")}
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {offer?.creditsDistinction?.base44PlatformCredits}
            </p>
          </div>
        </div>
      </section>

      {/* Section 3: Test-Mode Payment Integration Status & Server-Verified Access */}
      <section className="bg-card text-card-foreground rounded-lg border border-border p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {t("pilot.stripeSectionTitle")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("pilot.stripeSectionSub")}
            </p>
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={handleStartTestCheckout}
            className="px-4 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 shrink-0 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {isBusy ? t("pilot.checkingBtn") : t("pilot.startTestCheckoutBtn")}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-md bg-secondary/50 border border-border">
            <div className="text-muted-foreground">{t("pilot.providerLabel")}</div>
            <div className="font-semibold text-foreground mt-0.5">
              {t("pilot.providerValue")}
            </div>
          </div>
          <div className="p-3 rounded-md bg-secondary/50 border border-border">
            <div className="text-muted-foreground">{t("pilot.secretKeyLabel")}</div>
            <div className="font-semibold text-foreground mt-0.5">
              {stripeStatus?.hasStripeSecretKey
                ? t("pilot.configuredLabel", { mode: stripeStatus.keyMode })
                : t("pilot.notConnectedYet")}
            </div>
          </div>
          <div className="p-3 rounded-md bg-secondary/50 border border-border">
            <div className="text-muted-foreground">{t("pilot.webhookSecretLabel")}</div>
            <div className="font-semibold text-foreground mt-0.5">
              {stripeStatus?.hasWebhookSecret
                ? t("pilot.configuredSimple")
                : t("pilot.notConnectedYet")}
            </div>
          </div>
          <div className="p-3 rounded-md bg-secondary/50 border border-border">
            <div className="text-muted-foreground">{t("pilot.liveBillingStatusLabel")}</div>
            <div className="font-semibold text-amber-800 dark:text-amber-300 mt-0.5">
              {t("pilot.disabledForReview")}
            </div>
          </div>
        </div>

        {/* Separated Reporting Counters */}
        <div className="pt-3 border-t border-border space-y-2">
          <h3 className="text-xs font-semibold text-foreground">
            {t("pilot.reportingTitle")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-md bg-secondary/50 border border-border">
              <div className="text-muted-foreground">{t("pilot.testTxLabel")}</div>
              <div className="text-sm font-mono font-semibold text-foreground mt-0.5">
                {t("pilot.testTxValue", {
                  total: txSummary.testTransactionCount ?? 0,
                  verified: txSummary.testPaidVerifiedCount ?? 0,
                })}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {t("pilot.testTxSub")}
              </div>
            </div>

            <div className="p-3 rounded-md bg-secondary/50 border border-border">
              <div className="text-muted-foreground">{t("pilot.teammateTxLabel")}</div>
              <div className="text-sm font-mono font-semibold text-foreground mt-0.5">
                {txSummary.teammatePurchaseCount ?? 0}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {t("pilot.teammateTxSub")}
              </div>
            </div>

            <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30">
              <div className="text-emerald-800 dark:text-emerald-300 font-medium">
                {t("pilot.externalTxLabel")}
              </div>
              <div className="text-sm font-mono font-semibold text-foreground mt-0.5">
                {txSummary.externalCustomerProductionCount ?? 0} ($
                {((txSummary.externalProductionRevenueCents || 0) / 100).toFixed(2)})
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {t("pilot.externalTxSub")}
              </div>
            </div>
          </div>
        </div>

        {myEnrollments.length > 0 && (
          <div className="pt-2 space-y-2">
            <h3 className="text-xs font-semibold text-foreground">
              {t("pilot.enrollmentRecordsTitle", { count: myEnrollments.length })}
            </h3>
            <div className="space-y-2">
              {myEnrollments.map((enr) => (
                <div
                  key={enr.id}
                  className="p-3 rounded-md bg-secondary/50 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {t("pilot.statusPrefix")} {enr.payment_status}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-card border border-border text-muted-foreground">
                        {enr.payment_classification} ({enr.payment_mode})
                      </span>
                      <span className="text-muted-foreground">
                        {t("pilot.grantedAllowancePrefix")} {enr.granted_search_allowance}{" "}
                        {t("pilot.searchesUnit")}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{enr.status_note}</p>
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground shrink-0">
                    {t("pilot.sessionPrefix")} {enr.stripe_checkout_session_id || "n/a"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Section 4: Real User Feedback & Resulting Product Improvements */}
      <section className="bg-card text-card-foreground rounded-lg border border-border p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {t("pilot.feedbackSectionTitle")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("pilot.feedbackSectionSub")}
            </p>
          </div>
          <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-primary/15 text-primary border border-primary/30">
            {t("pilot.feedbackRecordsBadge", { count: feedbackRecords.length })}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-foreground">
              {t("pilot.recentFeedbackTitle")}
            </h3>
            {feedbackRecords.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("pilot.noFeedbackYet")}</p>
            ) : (
              feedbackRecords.slice(0, 5).map((fb) => (
                <div
                  key={fb.id}
                  className="p-3 rounded-md bg-secondary/50 border border-border text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{fb.business_name}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[11px] font-medium border ${
                        fb.verdict === "relevant"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                          : "bg-destructive/15 text-destructive border-destructive/30"
                      }`}
                    >
                      {fb.verdict}
                    </span>
                  </div>
                  {fb.reason_category && (
                    <div className="text-foreground font-medium">
                      {t("pilot.reasonPrefix")} {fb.reason_category}
                    </div>
                  )}
                  {fb.reason_note && <p className="text-muted-foreground">{fb.reason_note}</p>}
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-foreground">
              {t("pilot.shippedImprovementsTitle")}
            </h3>
            {documentedImprovements.map((imp) => (
              <div
                key={imp.id}
                className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1"
              >
                <div className="font-semibold text-emerald-800 dark:text-emerald-300">
                  {imp.triggerFeedback}
                </div>
                <p className="text-muted-foreground leading-relaxed">{imp.resultingChange}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}