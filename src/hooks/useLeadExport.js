import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { exportLeadsToGoogleSheets } from "@/lib/server-fns";
import { selectExportRecords, downloadLeadCsv, leadId } from "@/lib/lead-export";

export default function useLeadExport({ source, records, selectedIds, savedRecords, feedbackByOppId, stageFilter, connection }) {
  const exportFn = useServerFn(exportLeadsToGoogleSheets);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [csvScope, setCsvScope] = useState(null);
  const lock = useRef(false);
  const exportable = selectExportRecords(records, selectedIds, savedRecords, connection.user?.id);
  const scope = [source, stageFilter, ...exportable.map(leadId)].join("|");
  const exportSheets = async () => {
    if (lock.current || !exportable.length || connection.connected !== true) return;
    lock.current = true; setBusy(true); setError(null); setResult(null); setCsvScope(null);
    try {
      // Always send the exact nonempty visible selection, never the raw selection or an empty array.
      const ids = exportable.map(leadId);
      const response = await exportFn({ data: { source, opportunity_ids: ids, stage_filter: stageFilter } });
      if (!response?.connected) {
        connection.setConnected(false);
        setError(new Error("authorization_expired"));
        return;
      }
      setResult({ ...response, requestedCount: ids.length, scope });
    } catch (cause) { setError(cause); }
    finally { lock.current = false; setBusy(false); }
  };
  const downloadCsv = () => {
    if (!exportable.length) return;
    downloadLeadCsv(exportable, feedbackByOppId); setCsvScope(scope);
  };
  return { count: exportable.length, busy, error, result: result?.scope === scope && connection.connected === true ? result : null, csvDone: csvScope === scope, exportSheets, downloadCsv };
}