import { useState } from 'react'
import { AlertCircle, FilePlus, X } from 'lucide-react'

function AddAddendumModal({ onClose, onConfirm, adding = false }) {
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!note.trim()) {
      setError('Please provide addendum observations or notes.')
      return
    }
    onConfirm(note)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <FilePlus className="text-accent" size={18} />
            <h3 className="text-base font-bold text-primary">Add Report Addendum</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-primary/40 hover:bg-slate-100 hover:text-primary"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertCircle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <span>This addendum will be permanently attached to the report.</span>
          </div>

          {error && <p className="text-xs text-danger font-semibold">{error}</p>}

          <div>
            <div className="flex justify-between text-xs text-primary/60 mb-1">
              <label className="font-semibold text-primary">Add your addendum note</label>
              <span className="font-mono text-[11px]">{note.length} / 500</span>
            </div>
            <textarea
              rows={4}
              maxLength={500}
              required
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
                setError('')
              }}
              placeholder="Record supplemental histological findings, post-biopsy updates, or specialist notes..."
              className="w-full rounded-lg border border-border bg-background p-3 text-xs text-primary focus:border-accent focus:bg-surface focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-semibold text-primary hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adding}
              className="rounded-lg bg-accent px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-accent/90 disabled:opacity-50"
            >
              {adding ? 'Attaching...' : 'Confirm Addendum'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddAddendumModal
