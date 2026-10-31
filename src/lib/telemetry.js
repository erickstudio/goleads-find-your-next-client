import { base44 } from "@/api/base44Client";

const ALLOWED_EVENTS = new Set([
  "search_started",
  "search_completed",
  "search_failed",
  "source_opened",
  "opportunity_saved",
  "relevance_feedback_recorded",
]);

const ALLOWED_PROPERTY_KEYS = new Set([
  "time_window_days",
  "results_count",
  "verified_count",
  "needs_review_count",
  "from_cache",
  "verification_status",
  "recency_basis",
  "verdict",
  "reason_category",
  "has_reason_note",
  "action",
  "surface",
  "review_stage",
]);

// Ring buffer of sanitized client events in the current session (never contains PII or drafts)
const recentTrackedEvents = [];

export function sanitizeTelemetryProperties(rawProps = {}) {
  const clean = {};
  if (!rawProps || typeof rawProps !== "object") return clean;

  for (const [key, value] of Object.entries(rawProps)) {
    if (!ALLOWED_PROPERTY_KEYS.has(key)) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      clean[key] = typeof value === "string" ? value.slice(0, 64) : value;
    }
  }
  return clean;
}

/**
 * Tracks a minimal product event while excluding demo/example items and internal tests
 * from real-user adoption counts, and stripping any secrets, URLs, excerpts, or private drafts.
 */
export function trackLeadsEvent(eventName, rawProps = {}, options = {}) {
  if (!ALLOWED_EVENTS.has(eventName)) {
    return { tracked: false, reason: "unsupported_event" };
  }

  const isDemo = Boolean(
    options.isExample ||
      options.isDemo ||
      (typeof options.opportunityId === "string" && options.opportunityId.startsWith("demo-"))
  );
  const isInternalTest = Boolean(options.isInternalTest);

  if (isDemo || isInternalTest) {
    return {
      tracked: false,
      reason: isDemo ? "excluded_demo" : "excluded_internal_test",
    };
  }

  const properties = sanitizeTelemetryProperties(rawProps);
  const entry = {
    eventName,
    properties,
    recordedAt: new Date().toISOString(),
  };

  recentTrackedEvents.push(entry);
  if (recentTrackedEvents.length > 50) {
    recentTrackedEvents.shift();
  }

  try {
    if (typeof window !== "undefined" && base44?.analytics?.track) {
      base44.analytics.track({
        eventName,
        properties,
      });
    }
  } catch {
    // Analytics failure should never block user workflow
  }

  return { tracked: true, entry };
}

export function getRecentTrackedEvents() {
  return [...recentTrackedEvents];
}