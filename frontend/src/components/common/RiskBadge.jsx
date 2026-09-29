const STYLES = {
  low: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  normal: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  moderate: 'bg-amber-50 text-amber-700 border border-amber-200',
  high: 'bg-rose-50 text-rose-700 border border-rose-200',
  critical: 'bg-rose-600 text-white border border-rose-600',
}

function RiskBadge({ level }) {
  if (!level) return <span className="text-xs text-primary/40">&mdash;</span>
  const lvl = String(level).toLowerCase()
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide border ${
        STYLES[lvl] || 'bg-slate-100 text-primary border-slate-200'
      }`}
    >
      {level}
    </span>
  )
}

export default RiskBadge

