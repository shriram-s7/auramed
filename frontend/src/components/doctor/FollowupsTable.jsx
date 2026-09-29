import { useNavigate } from 'react-router-dom'
import InitialsAvatar from '../common/InitialsAvatar'

const STATUS_STYLES = {
  scheduled: 'bg-accent/10 text-accent',
  completed: 'bg-success/10 text-success',
  cancelled: 'bg-border text-primary/50',
  rescheduled: 'bg-warning/10 text-warning',
}

function FollowupsTable({ followups }) {
  const navigate = useNavigate()

  if (followups.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-primary/50">
        No upcoming follow-ups scheduled.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[600px] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase text-primary/40">
          <tr>
            <th className="px-4 py-3 font-medium">Patient</th>
            <th className="px-4 py-3 font-medium">Module</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Days Until</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          {followups.map((f) => (
            <tr
              key={f.appointment_id}
              className={`border-b border-border last:border-0 ${f.days_until <= 2 ? 'bg-warning/5' : ''}`}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <InitialsAvatar name={f.patient_name} size={28} />
                  <span className="font-medium text-primary">{f.patient_name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-primary/70">{f.module || '—'}</td>
              <td className="px-4 py-3 text-primary/70">{f.scheduled_date}</td>
              <td className="px-4 py-3 font-medium text-primary">
                {f.days_until === 0 ? 'Today' : `${f.days_until}d`}
              </td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[f.status] || 'bg-border text-primary'}`}>
                  {f.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => navigate('/doctor/appointments')}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-primary hover:border-accent hover:text-accent"
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default FollowupsTable
