import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Search,
  AlertTriangle,
  ExternalLink,
  Calendar,
  MapPin,
  Globe,
  Bookmark,
  XCircle,
  SlidersHorizontal,
  Info,
  Sparkles,
  CheckCircle2,
  Eye,
  FileText,
  History,
  Cpu,
} from "lucide-react";
import { SERVICE_CATEGORIES, SEARCH_STATES, DEMO_FIXTURE_OPPORTUNITIES } from "@/lib/leads-constants";
import { getWorkspaceBootstrap, recordSearchAttempt } from "@/lib/server-fns";

export const Route = createFileRoute("/_authed/")({
  ssr: false,
  loader: () => getWorkspaceBootstrap(),
  head: () => ({
    meta: [
      { title: "Discover — Leads AI" },
      { name: "description", content: "Find growing businesses. Discover your next client." },
    ],
  }),
  component: DiscoverScreen,
});

function DiscoverScreen() {
  const loaderData = Route.useLoaderData();
  const router = useRouter();
  const recordSearchFn = useServerFn(recordSearchAttempt);

  const profile = loaderData?.profile;
  const activeServices = profile?.selected_services?.length
    ? profile.selected_services
    : ["web_design_seo", "ecommerce", "automation_crm"];

  const [businessCategory, setBusinessCategory] = useState("Healthcare & Outpatient Clinics");
  const [locationQuery, setLocationQuery] = useState("Austin, TX, USA");
  const [timeWindowDays, setTimeWindowDays] = useState(profile?.default_time_window_days || 90);
  const [searchStatus, setSearchStatus] = useState("not_configured");
  const [statusNotice, setStatusNotice] = useState("");
  const [isSubmittingSearch, setIsSubmittingSearch] = useState(false);

  // Isolated Demo Fixture state (strictly client-side, never persisted into live usage metrics)
  const [demoMode, setDemoMode] = useState(false);
  const [dismissedDemoIds, setDismissedDemoIds] = useState([]);
  const [savedDemoIds, setSavedDemoIds] = useState([]);

  const handleRunLiveSearch = async (e) => {
    e.preventDefault();
    setDemoMode(false);
    setIsSubmittingSearch(true);
    try {
      const res = await recordSearchFn({
        data: {
          business_category: businessCategory,
          location_query: locationQuery,
          time_window_days: timeWindowDays,
          selected_services_snapshot: activeServices,
        },
      });
      setSearchStatus(res?.searchRecord?.status || "not_configured");
      setStatusNotice(
        res?.searchRecord?.honest_status_reason ||
          "Search logged with status 'not_configured'. Live discovery will not pretend to run until verified."
      );
      await router.invalidate();
    } catch (err) {
      setSearchStatus("failed");
      setStatusNotice(err?.message || "Failed to record search attempt.");
    } finally {
      setIsSubmittingSearch(false);
    }
  };

  const stateMeta = SEARCH_STATES[searchStatus] || SEARCH_STATES.not_configured;

  const visibleDemoOpportunities = demoMode
    ? DEMO_FIXTURE_OPPORTUNITIES.filter((o) => !dismissedDemoIds.includes(o.id)).slice(0, 5)
    : [];

  const recentSearches = loaderData?.recentSearches || [];

  return (
    <div className="space-y-8">
      {/* Onboarding Prompt Banner if user hasn't explicitly saved a profile yet */}
      {!profile && (
        <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-900">
              Step 1 Recommended · Complete Service Onboarding
            </div>
            <p className="text-xs text-blue-800">
              Select the digital services you sell (Web Design/SEO, E-commerce, Automation/CRM) so service-fit inferences match your practice.
            </p>
          </div>
          <Link
            to="/onboarding"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Configure Services Offered
          </Link>
        </div>
      )}

      {/* Top Header & Active Service Lens */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200/80 px-2.5 py-1 rounded-md mb-2.5">
            <span>Leads AI · Evidence-First Client Discovery</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Find growing businesses. Discover your next client.
          </h1>
          <p className="text-sm text-slate-600 mt-1.5 max-w-2xl">
            Search by business category, city/country, and recent time window (30, 90, or 180 days) to review up to five opening or expanding businesses with verifiable source excerpts.
          </p>
        </div>

        <div className="flex flex-col sm:items-end gap-2">
          <div className="text-xs font-medium text-slate-500">
            {profile?.agency_or_freelancer_name
              ? `${profile.agency_or_freelancer_name} · Services Offered`
              : "Services Offered Lens"}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {SERVICE_CATEGORIES.filter((s) => activeServices.includes(s.id)).map((service) => (
              <span
                key={service.id}
                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-slate-200 text-slate-800 shadow-2xs"
              >
                {service.shortLabel}
              </span>
            ))}
            <Link
              to="/onboarding"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors"
            >
              <SlidersHorizontal className="w-3 h-3" />
              Edit Services
            </Link>
          </div>
        </div>
      </div>

      {/* Search Form Card */}
      <section className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 sm:p-6">
        <form onSubmit={handleRunLiveSearch} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5">
              <label
                htmlFor="business-category"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Business Category
              </label>
              <input
                id="business-category"
                type="text"
                value={businessCategory}
                onChange={(e) => setBusinessCategory(e.target.value)}
                placeholder="e.g., Physical therapy, specialty retail, veterinary"
                required
                className="w-full h-10 px-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-4">
              <label
                htmlFor="city-country"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                City / Country
              </label>
              <input
                id="city-country"
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="e.g., Austin, TX, USA or Panama City, Panama"
                required
                className="w-full h-10 px-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Time Window (Default 90d)
              </label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
                {[30, 90, 180].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setTimeWindowDays(days)}
                    className={`h-8 rounded-md text-xs font-semibold transition-all ${
                      timeWindowDays === days
                        ? "bg-white text-blue-700 shadow-2xs border border-slate-200/80"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {days} days
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Current State:</span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${stateMeta.badgeClass}`}
              >
                <span className={`w-2 h-2 rounded-full ${stateMeta.dotClass}`} />
                {stateMeta.label}
              </span>
              {demoMode && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-900 border border-purple-300">
                  Isolated Demo Fixtures (Excluded from Live Metrics)
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const next = !demoMode;
                  setDemoMode(next);
                  setSearchStatus(next ? "completed" : "not_configured");
                  setStatusNotice("");
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  demoMode
                    ? "bg-purple-50 text-purple-900 border-purple-300 hover:bg-purple-100"
                    : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                {demoMode ? "Exit Demo Fixture Mode" : "Inspect Isolated Demo Fixtures (5)"}
              </button>

              <button
                type="submit"
                disabled={isSubmittingSearch}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 shadow-xs transition-colors"
              >
                <Search className="w-4 h-4" />
                {isSubmittingSearch ? "Checking Integration…" : "Search Opening & Expanding Businesses"}
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* Honest State Banner & All 7 States Inspector */}
      <section className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Honest System States (not_configured · ready · searching · partial · empty · failed · completed)
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {Object.values(SEARCH_STATES).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  setSearchStatus(st.id);
                  setStatusNotice("");
                  if (st.id === "not_configured" || st.id === "empty" || st.id === "failed") {
                    setDemoMode(false);
                  }
                }}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  searchStatus === st.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {st.id}
              </button>
            ))}
          </div>
        </div>

        <div className={`rounded-lg border p-4 ${stateMeta.badgeClass}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-sm">{stateMeta.title}</div>
              <p className="text-xs leading-relaxed opacity-90">
                {statusNotice || stateMeta.description}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Fixture Opportunities (Up to 5) */}
      {demoMode && visibleDemoOpportunities.length > 0 && (
        <section className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-bold uppercase tracking-wider text-purple-900">
                Isolated Demo Fixture Mode — Excluded from Live Usage Metrics & Database
              </div>
              <p className="text-xs text-purple-800">
                Inspecting 5 sample opportunities with dated source excerpts and separated service-fit inferences. Actions in Demo Mode stay local to this browser view.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white text-purple-900 border border-purple-200 shrink-0">
              Showing {visibleDemoOpportunities.length} of 5 Max Opportunities
            </span>
          </div>

          <div className="space-y-4">
            {visibleDemoOpportunities.map((opp, idx) => {
              const isSaved = savedDemoIds.includes(opp.id);
              return (
                <article
                  key={opp.id}
                  className="bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all p-5 sm:p-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                          {opp.signal_type}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Evidence: {opp.evidence_status}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-800 border border-purple-200">
                          Demo Fixture
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                        {opp.business_name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {opp.location}
                        </span>
                        <span>Category: {opp.business_category}</span>
                        {opp.website_url ? (
                          <a
                            href={opp.website_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            Known Website
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-amber-700 font-medium">Website: None cited in source</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Link
                        to="/opportunities/$opportunityId"
                        params={{ opportunityId: opp.id }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Inspect Sources
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          setSavedDemoIds((prev) =>
                            prev.includes(opp.id) ? prev.filter((id) => id !== opp.id) : [...prev, opp.id]
                          )
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          isSaved
                            ? "bg-blue-50 text-blue-700 border-blue-300"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        {isSaved ? "Saved (Demo)" : "Save (Demo)"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDismissedDemoIds((prev) => [...prev, opp.id])}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Not Relevant
                      </button>
                    </div>
                  </div>

                  {/* Verified Signal & Supporting Excerpt */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 border-t border-slate-100">
                    <div className="lg:col-span-7 bg-slate-50/90 rounded-lg p-3.5 border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Verified Signal & Supporting Source Excerpt
                        </span>
                        <a
                          href={opp.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"
                        >
                          {opp.source_title}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <p className="text-xs text-slate-800 font-medium">{opp.signal_summary}</p>
                      <blockquote className="text-xs italic text-slate-600 border-l-2 border-blue-600 pl-3 py-0.5">
                        {opp.supporting_excerpt}
                      </blockquote>
                      <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <strong>Published:</strong> {opp.publication_date || "Not stated"}
                        </span>
                        <span>
                          <strong>Opening/Event Date:</strong> {opp.event_date || "Not stated"}
                        </span>
                        <span>
                          <strong>Retrieved:</strong> {opp.retrieval_date} (Discovery ≠ Opening)
                        </span>
                      </div>
                    </div>

                    {/* Commercial Inference Box */}
                    <div className="lg:col-span-5 bg-blue-50/50 rounded-lg p-3.5 border border-blue-200/70 space-y-2 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                            Possible Service Fit (Inference)
                          </span>
                          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                            Hypothesis
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">
                          {opp.service_fit_inference}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-blue-200/60 text-[11px] text-slate-500">
                        Note: Expansion does not prove purchase intent, available budget, or technical problems.
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Built-in Web Search Technical Inspection & Recent Search Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white rounded-xl border border-slate-200/90 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-blue-600" />
              Base44 Built-In Web Search Inspection Report
            </h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
              Evaluated before paid providers
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            We inspected <code className="px-1 py-0.5 bg-slate-100 rounded text-slate-800">Core.InvokeLLM</code> with{" "}
            <code className="px-1 py-0.5 bg-slate-100 rounded text-slate-800">add_context_from_internet=true</code> and{" "}
            <code className="px-1 py-0.5 bg-slate-100 rounded text-slate-800">model="gemini_3_flash"</code>:
          </p>
          <ul className="space-y-2 text-xs text-slate-700">
            <li className="flex items-start gap-2">
              <span className="font-bold text-emerald-700">✓ Grounded Sources:</span>
              <span>
                Returns real local business opening/expansion articles with direct URLs (verified HTTP 200 status and matching HTML titles/dates on CultureMap and local news outlets) plus verbatim supporting excerpts.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-amber-700">! Remaining Limitations:</span>
              <span>
                Grounding metadata is synthesized through the LLM JSON response rather than a raw search-engine citation array. A server-side HTTP URL &amp; excerpt verifier must run on each candidate before saving it to <code className="px-1 py-0.5 bg-slate-100 rounded">Opportunity</code> so broken or hallucinated links are rejected or downgraded to <code className="px-1 py-0.5 bg-slate-100 rounded">partial</code>.
              </span>
            </li>
          </ul>
        </section>

        <section className="lg:col-span-5 bg-white rounded-xl border border-slate-200/90 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-500" />
              Your Private Search Log ({recentSearches.length})
            </h2>
            <span className="text-[11px] text-slate-400">Excludes Demo Mode</span>
          </div>

          {recentSearches.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">
              No live search attempts recorded yet. Clicking &ldquo;Search Opening &amp; Expanding Businesses&rdquo; logs your query honestly with status <code className="px-1 py-0.5 bg-slate-100 rounded">not_configured</code>.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {recentSearches.map((s) => (
                <div
                  key={s.id}
                  className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="truncate">
                    <div className="font-semibold text-slate-800 truncate">
                      {s.business_category} · {s.location_query}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Window: {s.time_window_days}d · Results: {s.results_count ?? 0}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200 shrink-0">
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}