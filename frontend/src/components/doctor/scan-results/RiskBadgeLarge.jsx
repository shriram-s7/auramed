const STYLES = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  normal: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  moderate: 'bg-amber-50 text-amber-700 border-amber-300',
  high: 'bg-rose-50 text-rose-700 border-rose-300',
  critical: 'bg-rose-600 text-white border-rose-700',
}

const LABELS = {
  low: 'LOW RISK',
  normal: 'NORMAL',
  moderate: 'MODERATE RISK',
  high: 'HIGH RISK',
  critical: 'CRITICAL RISK',
}

function RiskBadgeLarge({ level, size = 'md' }) {
  if (!level) return null
  const lvl = String(level).toLowerCase()
  const sizing = size === 'lg' ? 'px-4 py-1.5 text-sm' : 'px-3 py-1 text-xs'
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border font-bold uppercase tracking-wide leading-none ${sizing} ${
        STYLES[lvl] || STYLES.moderate
      }`}
    >
      {LABELS[lvl] || lvl.toUpperCase()}
    </span>
  )
}

export default RiskBadgeLarge

