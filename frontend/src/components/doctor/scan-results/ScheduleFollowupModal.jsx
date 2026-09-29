import { useState } from 'react'
import { Calendar, CheckCircle2, Clock, X } from 'lucide-react'
import { scheduleFollowup } from '../../../services/scanResultsService'

function calculateDefaultDate(intervalStr = '') {
  const d = new Date()
  const lower = intervalStr.toLowerCase()
  if (lower.includes('1 week') || lower.includes('week')) {
    d.setDate(d.getDate() + 7)
  } else if (lower.includes('1 month') || lower.includes('month')) {
    d.setDate(d.getDate() + 30)
  } else if (lower.includes('2-3 months') || lower.includes('3 months')) {
    d.setDate(d.getDate() + 75)
  } else if (lower.includes('annual') || lower.includes('year')) {
    d.setFullYear(d.getFullYear() + 1)
  } else {
    d.setDate(d.getDate() + 14)
  }
  return d.toISOString().split('T')[0]
}

function ScheduleFollowupModal({ scanId, interval, patientName, onClose, onSuccess }) {
  const [scheduledDate, setScheduledDate] = useState(calculateDefaultDate(interval))
  const [notes, setNotes] = useState(`Follow-up examination recommended: ${interval}`)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!scheduledDate) return
    setLoading(true)
    setError(null)
    try {
      await scheduleFollowup(scanId, scheduledDate, notes)
      setSuccess(true)
      setTimeout(() => {
        if (onSuccess) onSuccess()
        onClose()
      }, 1500)
    } catch (err) {
      setError('Failed to book follow-up appointment. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="text-accent" size={18} />
            <h3 className="text-base font-bold text-primary">Schedule Clinical Follow-Up</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-primary/40 hover:bg-slate-100 hover:text-primary"
          >
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center">
            <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
            <p className="mt-3 text-sm font-bold text-primary">Follow-up appointment scheduled!</p>
            <p className="mt-1 text-xs text-primary/60">
              The date has been added to patient calendar and clinic registry.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {error && (
              <div className="rounded-lg bg-danger/10 p-2.5 text-xs text-danger font-medium">
                {error}
              </div>
            )}

            <div>
              <p className="text-xs text-primary/60">
                Patient: <strong className="text-primary">{patientName}</strong>
              </p>
              <div className="mt-1 flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent">
                <Clock size={13} />
                <span>AI Recommended Interval: {interval}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-primary">
                Select Follow-up Date *
              </label>
              <input
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-primary focus:border-accent focus:bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-primary">
                Clinical Notes / Objective for Next Visit
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background p-2.5 text-xs text-primary focus:border-accent focus:bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-primary/70 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-accent px-4 py-1.5 text-xs font-bold text-white hover:bg-accent/90 disabled:opacity-50"
              >
                {loading ? 'Confirming...' : 'Confirm Appointment'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default ScheduleFollowupModal
