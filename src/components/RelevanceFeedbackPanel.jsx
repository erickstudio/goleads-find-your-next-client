import { useState, useEffect } from "react";
import { usePreferences } from "@/lib/PreferencesContext";

export default function RelevanceFeedbackPanel({
  feedbackRecord,
  isExample = false,
  isBusy = false,
  onSubmitFeedback,
  onClearFeedback,
}) {
  const { t } = usePreferences();

  const relevantReasons = [
    { value: "Strong expansion signal", label: t("feedback.reasonsRelevant.strongSignal") },
    { value: "Matches my service & territory", label: t("feedback.reasonsRelevant.matchesTerritory") },
    { value: "Good timing for outreach", label: t("feedback.reasonsRelevant.goodTiming") },
  ];

  const notRelevantReasons = [
    {
      value: "Not a fit for my services",
      label: t("feedback.reasonsNotRelevant.notAFit"),
      verdict: "not_relevant",
    },
    {
      value: "Weak or unclear evidence",
      label: t("feedback.reasonsNotRelevant.weakEvidence"),
      verdict: "weak_evidence",
    },
    {
      value: "Outside my territory",
      label: t("feedback.reasonsNotRelevant.outsideTerritory"),
      verdict: "out_of_territory",
    },
    {
      value: "Already a client / known",
      label: t("feedback.reasonsNotRelevant.alreadyClient"),
      verdict: "already_client",
    },
  ];

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

  const relevantValues = relevantReasons.map((r) => r.value);

  const handleSelectPolarity = (polarity) => {
    setSelectedPolarity(polarity);
    if (polarity === "relevant" && selectedPolarity !== "relevant") {
      setSelectedSubVerdict("relevant");
      if (!relevantValues.includes(selectedReasonCategory)) {
        setSelectedReasonCategory("");
      }
    } else if (polarity === "not_relevant" && selectedPolarity !== "not_relevant") {
      setSelectedSubVerdict("not_relevant");
      if (relevantValues.includes(selectedReasonCategory)) {
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
    <section className="space-y-3 pt-4 border-t border-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t("feedback.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("feedback.subtitle")}</p>
        </div>
        {feedbackRecord?.recorded_at && (
          <span className="text-[11px] font-mono text-muted-foreground">
            {t("feedback.savedTimestamp", {
              time: String(feedbackRecord.recorded_at).replace("T", " ").slice(0, 16),
            })}
          </span>
        )}
      </div>

      <form
        onSubmit={handleSaveRating}
        className="bg-secondary/50 rounded-md border border-border p-4 space-y-3"
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => handleSelectPolarity("relevant")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
              selectedPolarity === "relevant"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-card text-foreground border-border hover:bg-secondary"
            }`}
          >
            {t("feedback.relevantBtn")}
          </button>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => handleSelectPolarity("not_relevant")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
              selectedPolarity === "not_relevant"
                ? "bg-destructive text-destructive-foreground border-destructive"
                : "bg-card text-foreground border-border hover:bg-secondary"
            }`}
          >
            {t("feedback.notRelevantBtn")}
          </button>

          {feedbackRecord && onClearFeedback && !isExample && (
            <button
              type="button"
              disabled={isBusy}
              onClick={onClearFeedback}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary ml-auto focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {t("feedback.clearRatingBtn")}
            </button>
          )}
        </div>

        {selectedPolarity === "relevant" && (
          <div className="space-y-2 pt-1">
            <span className="block text-xs font-medium text-foreground">
              {t("feedback.optionalReasonTag")}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {relevantReasons.map((item) => {
                const active = selectedReasonCategory === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setSelectedReasonCategory(active ? "" : item.value)}
                    className={`px-2.5 py-1 rounded text-xs border transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                      active
                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-medium"
                        : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedPolarity === "not_relevant" && (
          <div className="space-y-2 pt-1">
            <span className="block text-xs font-medium text-foreground">
              {t("feedback.optionalReasonTag")}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {notRelevantReasons.map((item) => {
                const active = selectedReasonCategory === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      if (active) {
                        setSelectedReasonCategory("");
                        setSelectedSubVerdict("not_relevant");
                      } else {
                        setSelectedReasonCategory(item.value);
                        setSelectedSubVerdict(item.verdict);
                      }
                    }}
                    className={`px-2.5 py-1 rounded text-xs border transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                      active
                        ? "bg-destructive/15 text-destructive border-destructive/40 font-medium"
                        : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-secondary"
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
              className="block text-xs font-medium text-foreground"
            >
              {t("feedback.optionalNoteLabel")}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="feedback-reason-note"
                type="text"
                maxLength={500}
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                placeholder={t("feedback.optionalNotePlaceholder")}
                className="flex-1 h-9 px-3 rounded-md border border-input bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={isBusy}
                className="px-3.5 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 shrink-0 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {feedbackRecord ? t("feedback.updateRatingBtn") : t("feedback.saveRatingBtn")}
              </button>
            </div>
          </div>
        )}
      </form>
    </section>
  );
}