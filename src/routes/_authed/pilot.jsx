import { useState, useEffect } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  getPilotWorkspaceData,
  initiateTestPilotCheckout,
  verifyPilotCheckoutSession,
} from "@/lib/pilot-server-fns";

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
      { title: "One-time pilot (Test mode) — Leads AI" },
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

  // Handle return from Stripe checkout by verifying on the server (never trusting URL flag alone)
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-300">
              Preparation & Review — Live billing disabled
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
              One-time pilot only (no subscription)
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            One-time paid pilot offer & test-mode access
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Review agreed pilot deliverables, undecided commercial terms, and server-verified test payment status before enabling live billing.
          </p>
        </div>

        <Link
          to="/"
          className="px-3.5 py-2 rounded-md text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 shrink-0 text-center"
        >
          Back to Find leads
        </Link>
      </div>

      {statusBanner && (
        <div
          role="status"
          className={`px-4 py-3 rounded-md border text-xs flex items-center justify-between gap-3 ${
            bannerTone === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-950"
              : "bg-amber-50 border-amber-200 text-amber-950"
          }`}
        >
          <span>{statusBanner}</span>
          <button
            type="button"
            onClick={() => setStatusBanner("")}
            className="underline font-medium shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Section 1: Pilot Offer Draft (Agreed vs Undecided Terms) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">
              Agreed pilot scope & deliverables
            </h2>
            <p className="text-xs text-slate-600">{offer?.targetCustomer}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Included deliverables
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-800 list-disc pl-4">
              {(offer?.agreedDeliverables || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="bg-slate-50 rounded-md border border-slate-200 p-3.5 space-y-1.5">
            <h3 className="text-xs font-semibold text-slate-900">
              Honest commercial boundaries (What is not guaranteed)
            </h3>
            <ul className="space-y-1 text-xs text-slate-600 list-disc pl-4">
              {(offer?.explicitDisclaimers || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Undecided Commercial Terms */}
        <div className="lg:col-span-5 bg-white rounded-lg border border-amber-300 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">
              Undecided commercial terms
            </h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-950 border border-amber-300">
              Decision required
            </span>
          </div>
          <p className="text-xs text-slate-600">
            These 5 commercial decisions are explicitly left open for owner approval and are never invented or charged in live mode:
          </p>

          <div className="space-y-2.5">
            {Object.entries(offer?.undecidedTerms || {}).map(([key, term]) => (
              <div
                key={key}
                className="p-3 rounded-md bg-amber-50/50 border border-amber-200 space-y-0.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900">{term.label}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-900">
                    {term.status}
                  </span>
                </div>
                <p className="text-xs text-slate-700">{term.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 2: In-Product Research Allowance vs Base44 Platform Credits */}
      <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          In-product research allowance vs. Base44 platform credits
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-md bg-blue-50/40 border border-blue-200 space-y-1">
            <div className="font-semibold text-blue-950">
              1. In-product research allowance (Customer-facing)
            </div>
            <p className="text-slate-700 leading-relaxed">
              {offer?.creditsDistinction?.inProductResearchAllowance}
            </p>
            <div className="pt-1 text-slate-800 font-medium">
              Your current allowance: {quota.baseRemainingToday ?? 0} of {quota.maxDaily ?? 3} daily free searches left +{" "}
              {quota.pilotRemaining ?? 0} verified pilot searches ({quota.pilotGrantedTotal ?? 0} granted,{" "}
              {quota.pilotUsedTotal ?? 0} used).
            </div>
          </div>

          <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200 space-y-1">
            <div className="font-semibold text-slate-900">
              2. Base44 platform credits (Workspace infrastructure)
            </div>
            <p className="text-slate-600 leading-relaxed">
              {offer?.creditsDistinction?.base44PlatformCredits}
            </p>
          </div>
        </div>
      </section>

      {/* Section 3: Test-Mode Payment Integration Status & Server-Verified Access */}
      <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Stripe test-mode checkout & server-side verification
            </h2>
            <p className="text-xs text-slate-600">
              Pilot search allowance is granted only after server-side Stripe verification or a signature-verified webhook event (`POST /api/stripe-webhook`). Browser redirects alone never unlock access.
            </p>
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={handleStartTestCheckout}
            className="px-4 py-2 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 shrink-0"
          >
            {isBusy ? "Checking…" : "Start test-mode pilot checkout"}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
            <div className="text-slate-500">Provider in region (PA)</div>
            <div className="font-semibold text-slate-900 mt-0.5">Stripe (Test Sandbox)</div>
          </div>
          <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
            <div className="text-slate-500">Stripe secret key</div>
            <div className="font-semibold text-slate-900 mt-0.5">
              {stripeStatus?.hasStripeSecretKey
                ? `Configured (${stripeStatus.keyMode})`
                : "Not connected yet"}
            </div>
          </div>
          <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
            <div className="text-slate-500">Webhook signature secret</div>
            <div className="font-semibold text-slate-900 mt-0.5">
              {stripeStatus?.hasWebhookSecret ? "Configured" : "Not connected yet"}
            </div>
          </div>
          <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
            <div className="text-slate-500">Live billing status</div>
            <div className="font-semibold text-amber-900 mt-0.5">Disabled for review</div>
          </div>
        </div>

        {/* Separated Reporting Counters */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <h3 className="text-xs font-semibold text-slate-800">
            Payment & revenue reporting (Strict separation of test vs. production)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
              <div className="text-slate-500">Test-mode transactions</div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5">
                {txSummary.testTransactionCount ?? 0} total ({txSummary.testPaidVerifiedCount ?? 0} verified)
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Counts as $0.00 production revenue
              </div>
            </div>

            <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
              <div className="text-slate-500">Teammate / owner purchases</div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5">
                {txSummary.teammatePurchaseCount ?? 0}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Excluded from external customer metrics
              </div>
            </div>

            <div className="p-3 rounded-md bg-emerald-50/40 border border-emerald-200">
              <div className="text-emerald-950 font-medium">
                External customer production payments
              </div>
              <div className="text-sm font-semibold text-emerald-950 mt-0.5">
                {txSummary.externalCustomerProductionCount ?? 0} ($
                {((txSummary.externalProductionRevenueCents || 0) / 100).toFixed(2)})
              </div>
              <div className="text-[11px] text-emerald-800 mt-0.5">
                Only verified live external customer payments count here
              </div>
            </div>
          </div>
        </div>

        {myEnrollments.length > 0 && (
          <div className="pt-2 space-y-2">
            <h3 className="text-xs font-semibold text-slate-800">
              Your pilot checkout records ({myEnrollments.length})
            </h3>
            <div className="space-y-2">
              {myEnrollments.map((enr) => (
                <div
                  key={enr.id}
                  className="p-3 rounded-md bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        Status: {enr.payment_status}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                        {enr.payment_classification} ({enr.payment_mode})
                      </span>
                      <span className="text-slate-600">
                        Granted allowance: {enr.granted_search_allowance} searches
                      </span>
                    </div>
                    <p className="text-slate-600">{enr.status_note}</p>
                  </div>
                  <div className="text-[11px] text-slate-500 shrink-0">
                    Session: {enr.stripe_checkout_session_id || "n/a"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Section 4: Real User Feedback & Resulting Product Improvements (Independent of Payment Status) */}
      <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Recorded user feedback & resulting product improvements
            </h2>
            <p className="text-xs text-slate-600">
              Feedback and product improvements are tracked and shipped for all users independently of payment status.
            </p>
          </div>
          <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">
            {feedbackRecords.length} opportunity feedback record{feedbackRecords.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-800">
              Recent recorded relevance feedback
            </h3>
            {feedbackRecords.length === 0 ? (
              <p className="text-xs text-slate-500">No feedback recorded yet.</p>
            ) : (
              feedbackRecords.slice(0, 5).map((fb) => (
                <div
                  key={fb.id}
                  className="p-3 rounded-md bg-slate-50 border border-slate-200 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{fb.business_name}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                        fb.verdict === "relevant"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-red-50 text-red-800 border border-red-200"
                      }`}
                    >
                      {fb.verdict}
                    </span>
                  </div>
                  {fb.reason_category && (
                    <div className="text-slate-700 font-medium">
                      Reason: {fb.reason_category}
                    </div>
                  )}
                  {fb.reason_note && <p className="text-slate-600">{fb.reason_note}</p>}
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-800">
              Shipped improvements driven by feedback
            </h3>
            {documentedImprovements.map((imp) => (
              <div
                key={imp.id}
                className="p-3 rounded-md bg-emerald-50/40 border border-emerald-200 text-xs space-y-1"
              >
                <div className="font-semibold text-emerald-950">{imp.triggerFeedback}</div>
                <p className="text-slate-700 leading-relaxed">{imp.resultingChange}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}