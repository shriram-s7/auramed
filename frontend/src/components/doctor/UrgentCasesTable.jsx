import { CheckCircle2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import InitialsAvatar from '../common/InitialsAvatar'
import RiskBadge from '../common/RiskBadge'

function UrgentCasesTable({ cases }) {
  const navigate = useNavigate()

  if (cases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface py-10 text-center">
        <CheckCircle2 size={32} className="text-success" />
        <p className="mt-3 text-sm font-semibold text-primary">No urgent cases right now</p>
        <p className="text-xs text-primary/50">All high and critical risk scans have been reported.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase text-primary/40">
          <tr>
            <th className="px-4 py-3 font-medium">Patient</th>
            <th className="px-4 py-3 font-medium">Module</th>
            <th className="px-4 py-3 font-medium">Risk</th>
            <th className="px-4 py-3 font-medium">Reason</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr key={c.scan_id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <InitialsAvatar name={c.patient_name} size={28} />
                  <span className="font-medium text-primary">{c.patient_name}</span>
                </div>
              </td>
              <td className="px-4 py-3 capitalize text-primary/70">{c.module}</td>
              <td className="px-4 py-3">
                <RiskBadge level={c.risk_level} />
              </td>
              <td className="max-w-xs truncate px-4 py-3 text-primary/60">{c.reason || '—'}</td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => navigate(`/doctor/scan/${c.module}/results/${c.scan_id}`)}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
                >
                  Review
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default UrgentCasesTable
