import { useState } from 'react'
import { Pencil, X } from 'lucide-react'

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <span className="text-primary/50">{label}</span>
      <span className="text-right font-medium text-primary">{value || '—'}</span>
    </div>
  )
}

function PatientInfoPanel({ patient, onSave }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(null)

  function startEdit() {
    setForm({
      date_of_birth: patient.date_of_birth || '',
      gender: patient.gender || '',
      phone: patient.phone || '',
      address: patient.address || '',
      pin_code: patient.pin_code || '',
      emergency_contact_name: patient.emergency_contact_name || '',
      emergency_contact_phone: patient.emergency_contact_phone || '',
      emergency_contact_relation: patient.emergency_contact_relation || '',
    })
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(form)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-primary">Patient Information</p>
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
          <Row label="Date of Birth" value={patient.date_of_birth} />
          <Row label="Gender" value={patient.gender} />
          <Row label="Phone" value={patient.phone} />
          <Row label="Email" value={patient.email} />
          <Row label="Address" value={patient.address} />
          <Row label="Emergency Contact" value={patient.emergency_contact_name} />
          <Row label="Emergency Phone" value={patient.emergency_contact_phone} />
          <Row label="Relationship" value={patient.emergency_contact_relation} />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-primary/60">Date of Birth</label>
            <input
              type="date"
              value={form.date_of_birth}
              onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))}
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary/60">Gender</label>
            <select
              value={form.gender}
              onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            >
              <option value="">Select</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-primary/60">Phone</label>
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary/60">Address</label>
            <textarea
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary/60">PIN Code</label>
            <input
              value={form.pin_code}
              onChange={(e) => setForm((f) => ({ ...f, pin_code: e.target.value }))}
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary/60">Emergency Contact Name</label>
            <input
              value={form.emergency_contact_name}
              onChange={(e) => setForm((f) => ({ ...f, emergency_contact_name: e.target.value }))}
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary/60">Emergency Phone</label>
            <input
              value={form.emergency_contact_phone}
              onChange={(e) => setForm((f) => ({ ...f, emergency_contact_phone: e.target.value }))}
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

export default PatientInfoPanel
