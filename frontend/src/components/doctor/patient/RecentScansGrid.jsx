import { Activity, Microscope, ScanLine } from 'lucide-react'
import RiskBadge from '../../common/RiskBadge'

const MODULE_META = {
  breast: { icon: ScanLine, gradient: 'from-pink-100 to-pink-50', iconColor: 'text-pink-500', label: 'Breast' },
  cervical: { icon: Microscope, gradient: 'from-purple-100 to-purple-50', iconColor: 'text-purple-500', label: 'Cervical' },
  pcos: { icon: Activity, gradient: 'from-teal-100 to-teal-50', iconColor: 'text-accent', label: 'PCOS' },
}

function RecentScansGrid({ scans, onSelect, onViewAll }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-primary">Recent Scans</p>
        {onViewAll && (
          <button type="button" onClick={onViewAll} className="text-xs font-medium text-accent hover:underline">
            View All
          </button>
        )}
      </div>

      {scans.length === 0 ? (
        <p className="mt-6 text-center text-xs text-primary/40">No scans recorded yet.</p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {scans.map((scan) => {
            const meta = MODULE_META[scan.module]
            const Icon = meta.icon
            return (
              <button
                key={scan.scan_id}
                type="button"
                onClick={() => onSelect(scan)}
                className="flex flex-col items-center gap-2 text-center"
              >
                <span
                  className={`flex h-20 w-full items-center justify-center rounded-lg bg-gradient-to-br ${meta.gradient}`}
                  aria-hidden="true"
                >
                  <Icon size={26} className={meta.iconColor} />
                </span>
                <span className="text-xs font-medium text-primary">{meta.label}</span>
                <RiskBadge level={scan.risk_level} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default RecentScansGrid
