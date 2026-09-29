import { Link } from 'react-router-dom'
import { ArrowUpRight, Calendar, User } from 'lucide-react'
import InitialsAvatar from '../../common/InitialsAvatar'
import RiskBadgeLarge from '../scan-results/RiskBadgeLarge'

function ReportPatientContextCard({ report }) {
  if (!report) return null

  const patientName = report.patient_name || 'Patient'
  const patientCode = report.patient_code || '—'
  const patientId = report.patient_id
  const riskLevel = report.risk_level || 'low'
  const scanDate = report.content?.patient_info?.date_of_scan || report.content?.patient_info?.report_date || '—'

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <InitialsAvatar name={patientName} size="md" />
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-primary">{patientName}</h3>
            <span className="font-mono text-[11px] text-primary/50">({patientCode})</span>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-primary/60">
            <Calendar size={12} className="text-primary/40" /> Last scan: {scanDate}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <RiskBadgeLarge level={riskLevel} size="md" />
        <Link
          to={`/doctor/patients/${patientId}`}
          className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
        >
          View Details <ArrowUpRight size={13} />
        </Link>
      </div>
    </div>
  )
}

export default ReportPatientContextCard
