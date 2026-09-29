import { Bell } from 'lucide-react'

function NotificationsPanel({ notifications }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <Bell size={16} className="text-accent" />
        <h3 className="text-sm font-semibold text-primary">System Notifications</h3>
      </div>
      {notifications.length === 0 ? (
        <p className="mt-4 text-center text-xs text-primary/40">No notifications yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {notifications.map((n) => (
            <li key={n.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
              <p className="text-sm text-primary">{n.message}</p>
              <p className="mt-0.5 text-xs text-primary/40">{new Date(n.created_at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default NotificationsPanel
