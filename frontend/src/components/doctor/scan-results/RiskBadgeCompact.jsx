const STYLES = {
  low: { backgroundColor: '#dcfce7', color: '#15803d' },
  normal: { backgroundColor: '#dcfce7', color: '#15803d' },
  moderate: { backgroundColor: '#fef3c7', color: '#b45309' },
  high: { backgroundColor: '#fee2e2', color: '#dc2626' },
  critical: { backgroundColor: '#7f1d1d', color: '#ffffff' },
}

const LABELS = {
  low: 'LOW RISK',
  normal: 'NORMAL',
  moderate: 'MODERATE RISK',
  high: 'HIGH RISK',
  critical: 'CRITICAL',
}

function RiskBadgeCompact({ level, suffix }) {
  if (!level) return null
  return (
    <span
      className="inline-block rounded-full px-4 py-1.5 text-sm font-semibold uppercase tracking-wide"
      style={STYLES[level] || STYLES.moderate}
    >
      {LABELS[level] || level.toUpperCase()}
      {suffix ? ` (${suffix})` : ''}
    </span>
  )
}

export default RiskBadgeCompact
