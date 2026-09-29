import { useState } from 'react'
import { Pencil, X } from 'lucide-react'

function summarizeChecklist(obj) {
  if (!obj) return 'None reported'
  const parts = []
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'other_details' || key === 'menstrual_history' || key === 'obstetric_history' || key === 'additional_notes') continue
    if (value) parts.push(key.replace(/_/g, ' '))
  }
  if (obj.other_details) parts.push(obj.other_details)
  return parts.length > 0 ? parts.join(', ') : 'None reported'
}

function Field({ label, value }) {
  return (
    <div className="py-1.5">
      <p className="text-xs font-medium text-primary/50">{label}</p>
      <p className="text-sm text-primary">{value || 'Not recorded'}</p>
    </div>
  )
}

function ClinicalSummaryPanel({ patient, onSave }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(null)

  const personal = patient.personal_medical_history || {}

  function startEdit() {
    setForm({
      allergies: patient.allergies || '',
      current_medications: patient.current_medications || '',
      menstrual_history: personal.menstrual_history || '',
      obstetric_history: personal.obstetric_history || '',
    })
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({
        allergies: form.allergies,
        current_medications: form.current_medications,
        personal_medical_history: {
          ...personal,
          menstrual_history: form.menstrual_history,
          obstetric_history: form.obstetric_history,
        },
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-primary">Clinical Summary</p>
        {!editing ? (
          <button
            type="button"
            onClick={startEdit}
            className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            <Pencil size={12} /> Edit
          </button>
        ) : (
          <button type="button" onClick={() => setEditing(false)} className="text-primary/40 hover:text-primary">
            <X size={16} />
          </button>
        )}
      </div>

      {!editing ? (
        <div className="mt-2 divide-y divide-border">
          <Field label="Medical History" value={summarizeChecklist(personal)} />
          <Field label="Family History" value={summarizeChecklist(patient.family_history)} />
          <Field label="Menstrual History" value={personal.menstrual_history} />
          <Field label="Obstetric History" value={personal.obstetric_history} />
          <Field label="Current Medications" value={patient.current_medications} />
          <Field label="Allergies" value={patient.allergies} />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-primary/60">Menstrual History</label>
            <textarea
              value={form.menstrual_history}
              onChange={(e) => setForm((f) => ({ ...f, menstrual_history: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary/60">Obstetric History</label>
            <textarea
              value={form.obstetric_history}
              onChange={(e) => setForm((f) => ({ ...f, obstetric_history: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary/60">Current Medications</label>
            <textarea
              value={form.current_medications}
              onChange={(e) => setForm((f) => ({ ...f, current_medications: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary/60">Allergies</label>
            <textarea
              value={form.allergies}
              onChange={(e) => setForm((f) => ({ ...f, allergies: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="w-full rounded-md bg-primary py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  )
}

export default ClinicalSummaryPanel
