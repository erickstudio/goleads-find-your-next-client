import { useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, ArrowRight, ShieldAlert, Building2, Clock, CheckCircle2 } from "lucide-react";
import { SERVICE_CATEGORIES } from "@/lib/leads-constants";
import { getWorkspaceBootstrap, saveUserProfile } from "@/lib/server-fns";

export const Route = createFileRoute("/_authed/onboarding")({
  ssr: false,
  loader: () => getWorkspaceBootstrap(),
  head: () => ({
    meta: [
      { title: "Select Services Offered — Leads AI" },
      { name: "description", content: "Select the digital services you offer to tailor opportunity inferences." },
    ],
  }),
  component: OnboardingScreen,
});

function OnboardingScreen() {
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const saveProfileFn = useServerFn(saveUserProfile);

  const initialServices = data?.profile?.selected_services?.length
    ? data.profile.selected_services
    : ["web_design_seo", "automation_crm"];

  const [selected, setSelected] = useState(initialServices);
  const [practiceName, setPracticeName] = useState(data?.profile?.agency_or_freelancer_name || "");
  const [defaultWindow, setDefaultWindow] = useState(data?.profile?.default_time_window_days || 90);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);

  const toggleCategory = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    setSavedSuccess(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (selected.length === 0) return;
    setIsSaving(true);
    setErrorMsg("");
    try {
      await saveProfileFn({
        data: {
          selected_services: selected,
          agency_or_freelancer_name: practiceName,
          default_time_window_days: defaultWindow,
        },
      });
      await router.invalidate();
      setSavedSuccess(true);
      navigate({ to: "/" });
    } catch (err) {
      setErrorMsg(err?.message || "Failed to save your service preferences.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md">
          Step 1 · Service Onboarding
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Select the services you offer
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          You may select one or several service categories. Your profile is stored privately under your authenticated account (<span className="font-medium text-slate-800">{data?.user?.email}</span>) and determines which service-fit hypotheses are evaluated alongside verified opening/expansion facts.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 gap-4">
          {SERVICE_CATEGORIES.map((cat) => {
            const isSelected = selected.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className={`w-full text-left p-5 rounded-xl border transition-all flex items-start gap-4 ${
                  isSelected
                    ? "bg-white border-blue-600 ring-2 ring-blue-600/15 shadow-xs"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center mt-0.5 shrink-0 border transition-colors ${
                    isSelected
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-slate-50 border-slate-300 text-transparent"
                  }`}
                >
                  <Check className="w-4 h-4" />
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-base text-slate-900">{cat.label}</span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                        isSelected
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {isSelected ? "Selected" : "Optional"}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{cat.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Optional Agency Name & Default Time Window */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="practice-name" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              Freelancer / Agency Name (Optional)
            </label>
            <input
              id="practice-name"
              type="text"
              value={practiceName}
              onChange={(e) => setPracticeName(e.target.value)}
              placeholder="e.g., Northstar Digital Studio"
              className="w-full h-10 px-3.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Default Search Window
            </label>
            <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
              {[30, 90, 180].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setDefaultWindow(days)}
                  className={`h-8 rounded-md text-xs font-semibold transition-all ${
                    defaultWindow === days
                      ? "bg-white text-blue-700 shadow-2xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {days} days
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-slate-100/90 border border-slate-200 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-600">
          <ShieldAlert className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
          <div>
            <strong className="text-slate-900">Separation of Facts & Hypotheses:</strong> Selecting a service category never alters verified public evidence. Service fit is always labeled as a commercial inference because opening or expanding does not prove budget, technical issues, or purchase intent.
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 font-medium">
            {errorMsg}
          </div>
        )}

        {savedSuccess && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Service preferences saved to your private profile.
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <span className="text-xs text-slate-500">
            {selected.length} of 3 service {selected.length === 1 ? "category" : "categories"} active
          </span>
          <button
            type="submit"
            disabled={selected.length === 0 || isSaving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? "Saving Profile…" : "Save Services & Go to Discover"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}