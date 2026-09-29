import { FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import InitialsAvatar from '../common/InitialsAvatar'
import RiskBadge from '../common/RiskBadge'
import RotterdamBadge from '../common/RotterdamBadge'

function RecentScansTable({ scans }) {
  const navigate = useNavigate()

  if (scans.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-primary/50">
        No scans recorded yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[600px] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase text-primary/40">
          <tr>
            <th className="px-4 py-3 font-medium">Patient</th>
            <th className="px-4 py-3 font-medium">Scan Type</th>
            <th className="px-4 py-3 font-medium">Result</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          {scans.map((s) => (
            <tr key={s.scan_id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <InitialsAvatar name={s.patient_name} size={28} />
                  <span className="font-medium text-primary">{s.patient_name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-primary/70">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="capitalize">{s.module}</span>
                  {s.module === 'pcos' && (
                    <RotterdamBadge
                      positive={s.rotterdam_positive}
                      pending={s.rotterdam_positive === null || s.rotterdam_positive === undefined}
                    />
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <RiskBadge level={s.risk_level} />
              </td>
              <td className="px-4 py-3 text-primary/70">{s.scan_date || '—'}</td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() =>
                    s.report_id && s.report_id !== 'undefined'
                      ? navigate(`/doctor/reports/${s.report_id}`)
                      : navigate(`/doctor/scan/${s.module}/results/${s.scan_id}`)
                  }
                  className="rounded-md p-1.5 text-primary/50 hover:bg-background hover:text-accent"
                  aria-label="Open report"
                >
                  <FileText size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default RecentScansTable
