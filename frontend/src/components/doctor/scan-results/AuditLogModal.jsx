import { useEffect, useState } from 'react'
import { Clock, History, X } from 'lucide-react'
import { fetchScanAuditLog } from '../../../services/scanResultsService'

function AuditLogModal({ scanId, onClose }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!scanId) return
    setLoading(true)
    fetchScanAuditLog(scanId)
      .then((res) => {
        setLogs(res.data || [])
      })
      .catch(() => {
        setError('Failed to load audit history.')
      })
      .finally(() => setLoading(false))
  }, [scanId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <History className="text-accent" size={18} />
            <h3 className="text-base font-bold text-primary">Doctor Review Audit Trail</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-primary/40 hover:bg-slate-100 hover:text-primary"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-12 text-center text-xs text-primary/40">Loading audit trail...</div>
          ) : error ? (
            <div className="py-8 text-center text-xs text-danger">{error}</div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-xs text-primary/50">
              No audit logs recorded for this scan yet. Any parameter overrides or physician notes
              will be permanently logged here.
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => {
                const dateStr = new Date(log.created_at).toLocaleString()
                const details = log.details || {}
                return (
                  <div
                    key={log.id}
                    className="rounded-xl border border-border bg-background p-4 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-primary capitalize">
                        {log.action?.replace(/_/g, ' ')}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-[11px] text-primary/50">
                        <Clock size={11} /> {dateStr}
                      </span>
                    </div>

                    {details.fields && (
                      <div className="mt-2 text-primary/70">
                        <span className="font-medium text-primary/80">Modified fields: </span>
                        <span className="font-mono text-accent">{details.fields.join(', ')}</span>
                      </div>
                    )}

                    {details.values && (
                      <div className="mt-2 rounded-lg bg-surface p-2.5 font-mono text-[11px] text-primary/80 border border-border/70">
                        {Object.entries(details.values).map(([k, v]) => (
                          <div key={k} className="flex justify-between py-0.5">
                            <span className="text-primary/60">{k}:</span>
                            <span className="font-bold text-accent">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end border-t border-border px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default AuditLogModal
