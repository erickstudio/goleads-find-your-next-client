import { useState, useEffect } from "react";

const RELEVANT_REASONS = [
  "Strong expansion signal",
  "Matches my service & territory",
  "Good timing for outreach",
];

const NOT_RELEVANT_REASONS = [
  { label: "Not a fit for my services", verdict: "not_relevant" },
  { label: "Weak or unclear evidence", verdict: "weak_evidence" },
  { label: "Outside my territory", verdict: "out_of_territory" },
  { label: "Already a client / known", verdict: "already_client" },
];

export default function RelevanceFeedbackPanel({
  feedbackRecord,
  isExample = false,
  isBusy = false,
  onSubmitFeedback,
  onClearFeedback,
}) {
  const existingVerdict = feedbackRecord?.verdict || "";
  const isExistingRelevant = existingVerdict === "relevant";
  const isExistingNotRelevant = Boolean(existingVerdict && existingVerdict !== "relevant");

  const [selectedPolarity, setSelectedPolarity] = useState(
    isExistingRelevant ? "relevant" : isExistingNotRelevant ? "not_relevant" : ""
  );
  const [selectedReasonCategory, setSelectedReasonCategory] = useState(
    feedbackRecord?.reason_category || ""
  );
  const [selectedSubVerdict, setSelectedSubVerdict] = useState(
    isExistingNotRelevant ? existingVerdict : "not_relevant"
  );
  const [reasonNote, setReasonNote] = useState(feedbackRecord?.reason_note || "");

  useEffect(() => {
    const v = feedbackRecord?.verdict || "";
    setSelectedPolarity(v === "relevant" ? "relevant" : v ? "not_relevant" : "");
    setSelectedReasonCategory(feedbackRecord?.reason_category || "");
    setSelectedSubVerdict(v && v !== "relevant" ? v : "not_relevant");
    setReasonNote(feedbackRecord?.reason_note || "");
  }, [
    feedbackRecord?.id,
    feedbackRecord?.verdict,
    feedbackRecord?.reason_category,
    feedbackRecord?.reason_note,
    feedbackRecord?.recorded_at,
  ]);

  const handleSelectPolarity = (polarity) => {
    setSelectedPolarity(polarity);
    if (polarity === "relevant" && selectedPolarity !== "relevant") {
      setSelectedSubVerdict("relevant");
      if (!RELEVANT_REASONS.includes(selectedReasonCategory)) {
        setSelectedReasonCategory("");
      }
    } else if (polarity === "not_relevant" && selectedPolarity !== "not_relevant") {
      setSelectedSubVerdict("not_relevant");
      if (RELEVANT_REASONS.includes(selectedReasonCategory)) {
        setSelectedReasonCategory("");
      }
    }
  };

  const handleSaveRating = (e) => {
    e.preventDefault();
    if (!selectedPolarity || !onSubmitFeedback) return;
    const finalVerdict =
      selectedPolarity === "relevant" ? "relevant" : selectedSubVerdict || "not_relevant";

    onSubmitFeedback({
      verdict: finalVerdict,
      reason_category: selectedReasonCategory,
      reason_note: reasonNote.trim(),
    });
  };

  return (
    <section className="space-y-3 pt-4 border-t border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Your relevance rating</h2>
          <p className="text-xs text-slate-500">
            Rate whether this lead fits your services. Your rating never changes factual source verification status.
          </p>
        </div>
        {feedbackRecord?.recorded_at && (
          <span className="text-[11px] text-slate-500">
            Saved {String(feedbackRecord.recorded_at).replace("T", " ").slice(0, 16)} UTC
          </span>
        )}
      </div>

      <form
        onSubmit={handleSaveRating}
        className="bg-slate-50 rounded-md border border-slate-200 p-4 space-y-3"
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => handleSelectPolarity("relevant")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              selectedPolarity === "relevant"
                ? "bg-emerald-700 text-white border-emerald-700"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
            }`}
          >
            Relevant to my services
          </button>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => handleSelectPolarity("not_relevant")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              selectedPolarity === "not_relevant"
                ? "bg-red-700 text-white border-red-700"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
            }`}
          >
            Not relevant
          </button>

          {feedbackRecord && onClearFeedback && !isExample && (
            <button
              type="button"
              disabled={isBusy}
              onClick={onClearFeedback}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 ml-auto"
            >
              Clear rating
            </button>
          )}
        </div>

        {selectedPolarity === "relevant" && (
          <div className="space-y-2 pt-1">
            <span className="block text-xs font-medium text-slate-700">
              Optional reason tag:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {RELEVANT_REASONS.map((label) => {
                const active = selectedReasonCategory === label;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setSelectedReasonCategory(active ? "" : label)}
                    className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                      active
                        ? "bg-emerald-50 text-emerald-900 border-emerald-300 font-medium"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedPolarity === "not_relevant" && (
          <div className="space-y-2 pt-1">
            <span className="block text-xs font-medium text-slate-700">
              Optional reason tag:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {NOT_RELEVANT_REASONS.map((item) => {
                const active = selectedReasonCategory === item.label;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      if (active) {
                        setSelectedReasonCategory("");
                        setSelectedSubVerdict("not_relevant");
                      } else {
                        setSelectedReasonCategory(item.label);
                        setSelectedSubVerdict(item.verdict);
                      }
                    }}
                    className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                      active
                        ? "bg-red-50 text-red-900 border-red-300 font-medium"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedPolarity && (
          <div className="space-y-2 pt-1">
            <label
              htmlFor="feedback-reason-note"
              className="block text-xs font-medium text-slate-700"
            >
              Optional note (why this is or isn’t a fit)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="feedback-reason-note"
                type="text"
                maxLength={500}
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                placeholder="e.g., Expanding to 80 seats; good candidate for launch photography"
                className="flex-1 h-9 px-3 rounded-md border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="submit"
                disabled={isBusy}
                className="px-3.5 py-2 rounded-md text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 shrink-0"
              >
                {feedbackRecord ? "Update rating" : "Save rating"}
              </button>
            </div>
          </div>
        )}
      </form>
    </section>
  );
}