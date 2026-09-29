import { useState } from 'react'
import { Plus } from 'lucide-react'

function NotesPanel({ notes, onAddNote }) {
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!draft.trim()) return
    setSaving(true)
    try {
      await onAddNote(draft.trim())
      setDraft('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          placeholder="Add a clinical note about this patient…"
          className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled={saving || !draft.trim()}
            onClick={handleAdd}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus size={16} /> {saving ? 'Saving…' : 'Add Note'}
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-primary/50">
          No notes recorded yet.
        </p>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="rounded-xl border border-border bg-surface p-4">
              <p className="text-sm text-primary">{n.text}</p>
              <p className="mt-1 text-xs text-primary/40">{new Date(n.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default NotesPanel
