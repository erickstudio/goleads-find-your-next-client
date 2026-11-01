export const leadId = (record) => record.opportunity_id || record.id || "";
export const EXPORT_HEADERS = ["lead_id", "business_name", "business_category", "location", "website_url", "signal_type", "signal_summary", "source_verification_status", "user_commercial_stage", "user_relevance_verdict", "publication_date", "event_date", "source_title", "source_url", "supporting_excerpt", "service_fit_hypothesis", "target_services", "outreach_draft", "qualification_notes", "retrieved_at_utc"];

export function selectExportRecords(records, selectedIds, savedRecords, userId) {
  const saved = new Map(savedRecords.map((record) => [leadId(record), record]));
  const selected = new Set(selectedIds);
  const seen = new Set();
  return records.filter((record) => {
    const id = leadId(record);
    if (!id || id.startsWith("demo-") || record.is_example || seen.has(id)) return false;
    if (record.created_by_id !== userId || (record.owner_id && record.owner_id !== userId)) return false;
    if (selected.size && !selected.has(id)) return false;
    seen.add(id);
    return true;
  }).map((record) => {
    const match = saved.get(leadId(record));
    const ownMatch = match?.created_by_id === userId && (!match.owner_id || match.owner_id === userId) ? match : null;
    return { ...record, review_stage: ownMatch?.review_stage || record.review_stage || "unsaved", outreach_draft: ownMatch?.outreach_draft || record.outreach_draft || "", qualification_notes: ownMatch?.qualification_notes || record.qualification_notes || "" };
  });
}

export function buildLeadCsv(records, feedbackByOppId = new Map()) {
  const rows = records.map((r) => [leadId(r), r.business_name, r.business_category, r.location, r.website_url, r.signal_type, r.signal_summary, r.verification_status || "needs_review", r.review_stage || "unsaved", feedbackByOppId.get(leadId(r))?.verdict || "unrated", r.publication_date, r.event_date, r.source_title, r.source_url, r.supporting_excerpt, r.service_fit_inference, (r.inferred_service_categories || []).join("; "), r.outreach_draft, r.qualification_notes, r.retrieval_date]);
  const cell = (value) => {
    let text = String(value ?? "");
    // CSV quoting alone does not prevent spreadsheet formula execution.
    if (/^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  return [EXPORT_HEADERS, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}

export function downloadLeadCsv(records, feedbackByOppId) {
  const blob = new Blob(["\uFEFF", buildLeadCsv(records, feedbackByOppId)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `goleads-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}