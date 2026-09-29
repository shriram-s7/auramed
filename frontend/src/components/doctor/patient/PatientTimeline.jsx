import { Calendar, ChevronRight, FileText, ScanLine, Send, UserPlus } from 'lucide-react'

const TYPE_META = {
  scan: { icon: ScanLine, color: 'text-accent bg-accent/10' },
  report: { icon: FileText, color: 'text-primary bg-primary/10' },
  appointment: { icon: Calendar, color: 'text-warning bg-warning/10' },
  referral: { icon: Send, color: 'text-purple-600 bg-purple-50' },
  registration: { icon: UserPlus, color: 'text-success bg-success/10' },
}

function PatientTimeline({ events, limit, onViewAll, onSelect }) {
  const shown = limit ? events.slice(0, limit) : events

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-primary">Patient Timeline</p>
        {onViewAll && (
          <button type="button" onClick={onViewAll} className="text-xs font-medium text-accent hover:underline">
            View All
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 text-center text-xs text-primary/40">No activity recorded yet.</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {shown.map((event) => {
            const meta = TYPE_META[event.type] || TYPE_META.registration
            const Icon = meta.icon
            return (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => onSelect?.(event)}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-background"
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.color}`}>
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-primary">{event.title}</span>
                    <span className="block text-xs text-primary/40">
                      {new Date(event.date).toLocaleDateString()}
                    </span>
                  </span>
                  {event.badge && (
                    <span className="shrink-0 rounded-full bg-border px-2 py-0.5 text-[10px] font-semibold capitalize text-primary/60">
                      {event.badge}
                    </span>
                  )}
                  <ChevronRight size={14} className="shrink-0 text-primary/30" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default PatientTimeline
