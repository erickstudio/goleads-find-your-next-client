export default function ExportSelectionToolbar({ records, selectedIds, onChange, es }) {
  if (!records.length) return null;
  const ids = records.map((record) => record.opportunity_id || record.id);
  const allSelected = ids.every((id) => selectedIds.includes(id));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-xs">
      <label className="inline-flex min-h-9 cursor-pointer items-center gap-2">
        <input type="checkbox" checked={allSelected} onChange={() => onChange(allSelected ? [] : ids)} className="h-4 w-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring" />
        {es ? "Seleccionar los leads de esta vista para exportar" : "Select leads in this view for export"}
      </label>
      <span className="text-muted-foreground">{selectedIds.length} {es ? "seleccionados" : "selected"}</span>
      {selectedIds.length > 0 && <button type="button" onClick={() => onChange([])} className="min-h-9 font-medium text-primary hover:underline">{es ? "Limpiar selección" : "Clear selection"}</button>}
    </div>
  );
}