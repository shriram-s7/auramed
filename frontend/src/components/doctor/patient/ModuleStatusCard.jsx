import { Activity, ArrowRight, Microscope, ScanLine } from 'lucide-react'
import RiskBadge from '../../common/RiskBadge'

const MODULE_META = {
  breast: {
    label: 'Breast Cancer',
    icon: ScanLine,
    border: 'border-pink-200',
    iconBg: 'bg-pink-50',
    iconColor: 'text-pink-600',
  },
  cervical: {
    label: 'Cervical Cancer',
    icon: Microscope,
    border: 'border-purple-200',
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
  pcos: {
    label: 'PCOS',
    icon: Activity,
    border: 'border-teal-200',
    iconBg: 'bg-teal-50',
    iconColor: 'text-accent',
  },
}

function ModuleStatusCard({ moduleStatus, onOpenScan, onStartScreening }) {
  const meta = MODULE_META[moduleStatus.module]
  const Icon = meta.icon

  return (
    <div className={`rounded-xl border ${meta.border} bg-surface p-4`}>
      <div className="flex items-center justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${meta.iconBg}`}>
          <Icon size={18} className={meta.iconColor} />
        </div>
        {moduleStatus.has_scans && <RiskBadge level={moduleStatus.risk_level} />}
      </div>
      <p className="mt-3 text-sm font-semibold text-primary">{meta.label}</p>

      {moduleStatus.has_scans ? (
        <>
          <p className="mt-1 text-xs text-primary/50">Last scan: {moduleStatus.last_scan_date || '—'}</p>
          <p className="text-xs text-primary/50">
            Next follow-up: {moduleStatus.next_followup_date || 'Not scheduled'}
          </p>
          <button
            type="button"
            onClick={() => onOpenScan(moduleStatus)}
            className="mt-3 flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            View latest result <ArrowRight size={12} />
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-primary/50">No scans yet</p>
          <button
            type="button"
            onClick={() => onStartScreening(moduleStatus.module)}
            className="mt-3 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
          >
            Start Screening
          </button>
        </>
      )}
    </div>
  )
}

export default ModuleStatusCard
