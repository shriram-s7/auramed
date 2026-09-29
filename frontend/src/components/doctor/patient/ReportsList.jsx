import { Download, Eye, Share2 } from 'lucide-react'

const STATUS_STYLES = {
  draft: 'bg-border text-primary/60',
  signed: 'bg-success/10 text-success',
  addendum: 'bg-warning/10 text-warning',
}

function ReportsList({ reports, onView }) {
  if (reports.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-primary/50">
        No reports generated yet.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {reports.map((r) => (
        <div
          key={r.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4"
        >
          <div>
            <p className="text-sm font-semibold text-primary">{r.report_number}</p>
            <p className="text-xs text-primary/50">
              {r.signed_at ? `Signed ${new Date(r.signed_at).toLocaleDateString()}` : 'Not yet signed'}
              {r.shared_with_patient ? ' · Shared with patient' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[r.status] || 'bg-border text-primary'}`}>
              {r.status}
            </span>
            <button
              type="button"
              onClick={() => onView(r)}
              className="rounded-md p-1.5 text-primary/50 hover:bg-background hover:text-accent"
              aria-label="View report"
            >
              <Eye size={16} />
            </button>
            <button
              type="button"
              className="rounded-md p-1.5 text-primary/50 hover:bg-background hover:text-accent"
              aria-label="Download PDF"
            >
              <Download size={16} />
            </button>
            <button
              type="button"
              className="rounded-md p-1.5 text-primary/50 hover:bg-background hover:text-accent"
              aria-label="Share report"
            >
              <Share2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default ReportsList
