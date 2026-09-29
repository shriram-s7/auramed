import { Send } from 'lucide-react'

const PRIORITY_STYLES = {
  routine: 'bg-border text-primary/60',
  urgent: 'bg-warning/10 text-warning',
  emergency: 'bg-danger/10 text-danger',
}

function ReferralsList({ referrals }) {
  if (referrals.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-primary/50">
        No referrals made for this patient yet.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {referrals.map((r) => (
        <div key={r.id} className="rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                <Send size={16} />
              </span>
              <div>
                <p className="text-sm font-semibold text-primary">{r.to_specialist || r.specialty || 'Specialist'}</p>
                <p className="text-xs text-primary/50">{r.specialty}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${PRIORITY_STYLES[r.priority] || 'bg-border text-primary'}`}>
                {r.priority}
              </span>
              <span className="rounded-full bg-border px-2.5 py-0.5 text-xs font-semibold capitalize text-primary/60">
                {r.status}
              </span>
            </div>
          </div>
          {r.reason && <p className="mt-2 text-sm text-primary/70">{r.reason}</p>}
          <p className="mt-1 text-xs text-primary/40">{new Date(r.created_at).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  )
}

export default ReferralsList
