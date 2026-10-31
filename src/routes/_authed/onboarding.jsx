import { useState } from "react";
import { createFileRoute, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { SERVICE_EXAMPLES, normalizeServicesList } from "@/lib/leads-constants";
import { getWorkspaceBootstrap, saveUserProfile } from "@/lib/server-fns";

export const Route = createFileRoute("/_authed/onboarding")({
  ssr: false,
  loader: () => getWorkspaceBootstrap(),
  head: () => ({
    meta: [
      { title: "Your services — Leads AI" },
      { name: "description", content: "Add and edit the business services you offer." },
    ],
  }),
  component: ServicesScreen,
});

function ServicesScreen() {
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const saveProfileFn = useServerFn(saveUserProfile);

  const initialServices = normalizeServicesList(data?.profile?.selected_services || []);

  const [services, setServices] = useState(initialServices);
  const [newServiceInput, setNewServiceInput] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [serviceDescription, setServiceDescription] = useState(
    data?.profile?.service_description || ""
  );
  const [defaultWindow, setDefaultWindow] = useState(
    data?.profile?.default_time_window_days || 90
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const addServiceName = (rawName) => {
    const trimmed = (rawName || "").trim();
    if (!trimmed) return;
    const next = normalizeServicesList([...services, trimmed]);
    if (next.length === services.length) {
      setStatusMsg(`"${trimmed}" is already in your list.`);
      return;
    }
    setServices(next);
    setNewServiceInput("");
    setErrorMsg("");
    setStatusMsg("");
  };

  const handleAddInputKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addServiceName(newServiceInput);
    }
  };

  const startEditing = (idx) => {
    setEditingIndex(idx);
    setEditingValue(services[idx] || "");
    setErrorMsg("");
    setStatusMsg("");
  };

  const commitEdit = (idx) => {
    const trimmed = editingValue.trim();
    if (!trimmed) {
      // If emptied during edit, remove the item
      setServices((prev) => prev.filter((_, i) => i !== idx));
      setEditingIndex(null);
      setEditingValue("");
      return;
    }
    const updated = services.map((item, i) => (i === idx ? trimmed : item));
    setServices(normalizeServicesList(updated));
    setEditingIndex(null);
    setEditingValue("");
  };

  const removeService = (idx) => {
    setServices((prev) => prev.filter((_, i) => i !== idx));
    if (editingIndex === idx) {
      setEditingIndex(null);
      setEditingValue("");
    }
    setErrorMsg("");
    setStatusMsg("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    // Include any pending text typed into the add box if the user hasn't clicked Add yet
    const pendingList = newServiceInput.trim()
      ? normalizeServicesList([...services, newServiceInput.trim()])
      : normalizeServicesList(services);

    if (pendingList.length === 0) {
      setErrorMsg("Please add at least one service you offer.");
      return;
    }

    setIsSaving(true);
    setErrorMsg("");
    setStatusMsg("");
    try {
      await saveProfileFn({
        data: {
          selected_services: pendingList,
          service_description: serviceDescription.trim(),
          default_time_window_days: defaultWindow,
        },
      });
      setServices(pendingList);
      setNewServiceInput("");
      await router.invalidate();
      setStatusMsg("Your services have been saved.");
    } catch (err) {
      setErrorMsg(err?.message || "Could not save your services.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Your services</h1>
          <p className="text-sm text-slate-600 mt-1">
            Add one or more services you sell and describe your work in plain language.
          </p>
        </div>
        <Link
          to="/"
          className="text-xs font-medium text-blue-700 hover:underline shrink-0"
        >
          Back to Find leads
        </Link>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-lg border border-slate-200 p-5 sm:p-6 space-y-6">
        {/* Add custom service input */}
        <div className="space-y-2">
          <label htmlFor="custom-service-input" className="block text-sm font-medium text-slate-800">
            Services you offer
          </label>
          <div className="flex gap-2">
            <input
              id="custom-service-input"
              type="text"
              value={newServiceInput}
              onChange={(e) => setNewServiceInput(e.target.value)}
              onKeyDown={handleAddInputKeyDown}
              placeholder="e.g., Commercial photography, Bookkeeping, Recruiting"
              className="flex-1 h-10 px-3 rounded-md border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              type="button"
              onClick={() => addServiceName(newServiceInput)}
              className="px-4 h-10 rounded-md text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              Add service
            </button>
          </div>

          {/* Optional examples */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-slate-500 mr-1">Examples:</span>
            {SERVICE_EXAMPLES.map((example) => {
              const isAdded = services.some(
                (s) => s.toLowerCase() === example.toLowerCase()
              );
              return (
                <button
                  key={example}
                  type="button"
                  disabled={isAdded}
                  onClick={() => addServiceName(example)}
                  className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                    isAdded
                      ? "bg-slate-100 text-slate-400 border-slate-200 cursor-default"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  + {example}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active services list with inline edit & remove */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-600">
            Active services ({services.length})
          </div>
          {services.length === 0 ? (
            <div className="p-4 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-500">
              No services added yet. Enter any service above or pick an example.
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 border border-slate-200 rounded-md bg-slate-50/50">
              {services.map((service, idx) => (
                <li
                  key={`${service}-${idx}`}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-sm"
                >
                  {editingIndex === idx ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        aria-label={`Edit service ${service}`}
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitEdit(idx);
                          }
                        }}
                        className="flex-1 h-8 px-2.5 rounded border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => commitEdit(idx)}
                        className="px-2.5 py-1 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Done
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingIndex(null)}
                        className="px-2 py-1 rounded text-xs text-slate-600 hover:text-slate-900"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium text-slate-900">{service}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditing(idx)}
                          className="text-xs font-medium text-blue-700 hover:underline px-1.5 py-0.5"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeService(idx)}
                          className="text-xs font-medium text-slate-500 hover:text-red-700 px-1.5 py-0.5"
                        >
                          Remove
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Optional plain-language description */}
        <div className="space-y-1.5">
          <label htmlFor="service-description" className="block text-sm font-medium text-slate-800">
            What do you sell? <span className="text-xs font-normal text-slate-500">(Optional)</span>
          </label>
          <textarea
            id="service-description"
            rows={3}
            value={serviceDescription}
            onChange={(e) => setServiceDescription(e.target.value)}
            placeholder="Describe what you offer and the types of opening or expanding businesses you work best with..."
            className="w-full p-3 rounded-md border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <p className="text-xs text-slate-500">
            Used to explain how a newly opening or expanding business might fit your offer.
          </p>
        </div>

        {/* Default time window */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-800">
            Default search time window
          </label>
          <div className="inline-grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-md border border-slate-200">
            {[30, 90, 180].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setDefaultWindow(days)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
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

        {errorMsg && (
          <div role="alert" className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-800">
            {errorMsg}
          </div>
        )}

        {statusMsg && (
          <div role="status" className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
            {statusMsg}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {isSaving ? "Saving…" : "Save services"}
          </button>

          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="px-3 py-2 rounded-md text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            Go to Find leads
          </button>
        </div>
      </form>
    </div>
  );
}