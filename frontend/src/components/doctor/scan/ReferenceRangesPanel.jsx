function ReferenceRangesPanel({ ranges }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-primary">Reference Ranges</p>
      <table className="mt-2 w-full text-left text-xs">
        <thead className="text-primary/40">
          <tr>
            <th className="pb-1.5 font-medium">Parameter</th>
            <th className="pb-1.5 font-medium">Normal Range</th>
          </tr>
        </thead>
        <tbody>
          {ranges.map((r) => (
            <tr key={r.key} className="border-t border-border">
              <td className="py-1.5 text-primary/70">{r.label}</td>
              <td className="py-1.5 font-medium text-primary">{r.range}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="mt-2 text-xs font-medium text-accent hover:underline">
        View detailed guidelines
      </button>
    </div>
  )
}

export default ReferenceRangesPanel
