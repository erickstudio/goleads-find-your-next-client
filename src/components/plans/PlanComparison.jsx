import { getPlanComparison } from "@/lib/plan-comparison";

export default function PlanComparison({ lang }) {
  const copy = getPlanComparison(lang);
  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full table-fixed text-left text-xs sm:text-sm">
          <caption className="sr-only">{copy.title}</caption>
          <thead className="border-b border-border bg-secondary/50">
            <tr>
              <th scope="col" className="w-2/5 p-3 sm:p-5 font-semibold">{copy.feature}</th>
              <th scope="col" className="p-3 sm:p-5 font-semibold">{copy.free}</th>
              <th scope="col" className="p-3 sm:p-5 font-semibold text-primary">Pro<span className="mt-1 block text-[10px] sm:text-xs font-normal text-muted-foreground">{copy.pending}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {copy.rows.map(([label, free, pro]) => (
              <tr key={label}>
                <th scope="row" className="break-words p-3 sm:p-5 font-medium leading-relaxed">{label}</th>
                <td className="break-words p-3 sm:p-5 leading-relaxed text-muted-foreground">{free}</td>
                <td className="break-words p-3 sm:p-5 leading-relaxed text-muted-foreground">{pro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-6 text-muted-foreground">{copy.note}</p>
    </div>
  );
}