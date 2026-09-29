import { Calendar, Plus } from 'lucide-react'

const STATUS_STYLES = {
  scheduled: 'bg-accent/10 text-accent',
  completed: 'bg-success/10 text-success',
  cancelled: 'bg-border text-primary/50',
  rescheduled: 'bg-warning/10 text-warning',
}

function AppointmentsList({ appointments, onScheduleNew }) {
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = appointments.filter((a) => a.scheduled_date >= today)
  const past = appointments.filter((a) => a.scheduled_date < today)

  function renderRow(a) {
    return (
      <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Calendar size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold text-primary">{a.appointment_type || 'Appointment'}</p>
            <p className="text-xs text-primary/50">
              {a.scheduled_date} {a.scheduled_time ? `at ${a.scheduled_time}` : ''} {a.location ? `· ${a.location}` : ''}
            </p>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[a.status] || 'bg-border text-primary'}`}>
          {a.status}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onScheduleNew}
          className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus size={16} /> Schedule New
        </button>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-primary">Upcoming</p>
        {upcoming.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-4 text-center text-sm text-primary/50">
            No upcoming appointments.
          </p>
        ) : (
          <div className="space-y-2">{upcoming.map(renderRow)}</div>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-primary">Past</p>
        {past.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-4 text-center text-sm text-primary/50">
            No past appointments.
          </p>
        ) : (
          <div className="space-y-2">{past.map(renderRow)}</div>
        )}
      </div>
    </div>
  )
}

export default AppointmentsList
