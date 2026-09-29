import { useEffect, useState } from 'react'
import { Check, History, Save } from 'lucide-react'
import AuditLogModal from './AuditLogModal'

function DoctorReviewSection({ result, onUpdateSuccess, sectionRef }) {
  const [fields, setFields] = useState([])
  const [formValues, setFormValues] = useState({})
  const [notes, setNotes] = useState('')
  const [auditModalOpen, setAuditModalOpen] = useState(false)
  const [savingRow, setSavingRow] = useState(null)
  const [savedRowSuccess, setSavedRowSuccess] = useState(null)
  const [savingAll, setSavingAll] = useState(false)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!result) return
    const reviewFields = result.doctor_review_fields || []
    setFields(reviewFields)

    const initialValues = {}
    reviewFields.forEach((f) => {
      initialValues[f.key] = f.doctor_value !== undefined ? f.doctor_value : f.ai_value
    })
    setFormValues(initialValues)
    setNotes(result.doctor_review_notes || '')
  }, [result])

  const handleFieldChange = (key, value) => {
    setFormValues((prev) => ({
      ...prev,
      [key]: value,
    }))
    setSaveSuccessMsg('')
    setErrorMsg('')
  }

  const handleSaveRow = async (fieldKey) => {
    setSavingRow(fieldKey)
    setErrorMsg('')
    try {
      const payload = {
        [fieldKey]: formValues[fieldKey],
      }
      await onUpdateSuccess(payload, notes)
      setSavedRowSuccess(fieldKey)
      setTimeout(() => setSavedRowSuccess(null), 2500)
    } catch (err) {
      setErrorMsg('Failed to save override. Please try again.')
    } finally {
      setSavingRow(null)
    }
  }

  const handleSaveAll = async () => {
    setSavingAll(true)
    setErrorMsg('')
    try {
      await onUpdateSuccess(formValues, notes)
      setSaveSuccessMsg('Doctor overrides and notes successfully updated & audited.')
      setTimeout(() => setSaveSuccessMsg(''), 3500)
    } catch (err) {
      setErrorMsg('Failed to save overrides.')
    } finally {
      setSavingAll(false)
    }
  }

  const formatAiValue = (val, type) => {
    if (val === null || val === undefined) return '—'
    if (type === 'checkbox') return val ? 'Yes' : 'No'
    if (typeof val === 'string') return val.replace(/_/g, ' ')
    return String(val)
  }

  return (
    <div ref={sectionRef} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            5
          </span>
          <div>
            <h2 className="text-sm font-bold text-primary">Doctor Review & Clinical Override</h2>
            <p className="text-xs text-primary/60">
              Verify or adjust AI inferences. All overrides and timestamped notes are immutably audited.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAuditModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-slate-100 hover:text-accent shadow-sm"
        >
          <History size={13} className="text-accent" /> View Audit Log
        </button>
      </div>

      {saveSuccessMsg && (
        <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs font-semibold text-emerald-800">
          ✓ {saveSuccessMsg}
        </div>
      )}

      {errorMsg && (
        <div className="mt-3 rounded-lg bg-danger/10 border border-danger/20 p-2.5 text-xs font-semibold text-danger">
          ⚠ {errorMsg}
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-slate-50/70 text-xs uppercase text-primary/50">
            <tr>
              <th className="py-2.5 pl-3 font-semibold">Parameter</th>
              <th className="py-2.5 px-3 font-semibold">AI Suggested Value</th>
              <th className="py-2.5 px-3 font-semibold">Doctor's Value (Editable)</th>
              <th className="py-2.5 pr-3 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {fields.map((f) => {
              const currentValue = formValues[f.key]
              const isModified = currentValue !== f.ai_value && currentValue !== undefined && f.ai_value !== undefined
              const isSaving = savingRow === f.key
              const isSaved = savedRowSuccess === f.key

              return (
                <tr key={f.key} className={`transition-colors ${isModified ? 'bg-amber-50/30' : 'hover:bg-slate-50/50'}`}>
                  <td className="py-3 pl-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-primary/90">{f.label}</span>
                      {isModified && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                          Modified
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-3 text-xs text-primary/60 font-medium">
                    <span className="inline-block rounded bg-slate-100 px-2 py-1 text-primary/70">
                      {formatAiValue(f.ai_value, f.type)}
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    {f.type === 'number' && (
                      <input
                        type="number"
                        step="0.1"
                        value={currentValue ?? ''}
                        onChange={(e) => handleFieldChange(f.key, parseFloat(e.target.value) || 0)}
                        className="w-32 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    )}

                    {f.type === 'select' && (
                      <select
                        value={currentValue ?? ''}
                        onChange={(e) => handleFieldChange(f.key, e.target.value)}
                        className="w-48 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      >
                        {(f.options || []).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    )}

                    {f.type === 'checkbox' && (
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(currentValue)}
                          onChange={(e) => handleFieldChange(f.key, e.target.checked)}
                          className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                        />
                        <span className="text-xs font-medium text-primary/80">
                          {currentValue ? 'Criteria Met (Yes)' : 'Not Met (No)'}
                        </span>
                      </label>
                    )}

                    {f.type === 'text' && (
                      <input
                        type="text"
                        value={currentValue ?? ''}
                        onChange={(e) => handleFieldChange(f.key, e.target.value)}
                        className="w-full max-w-xs rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    )}
                  </td>

                  <td className="py-3 pr-3 text-right">
                    <button
                      type="button"
                      title="Save this parameter override"
                      disabled={isSaving}
                      onClick={() => handleSaveRow(f.key)}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                        isSaved
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-primary hover:bg-accent hover:text-white'
                      }`}
                    >
                      {isSaved ? (
                        <>
                          <Check size={12} /> Saved
                        </>
                      ) : isSaving ? (
                        'Saving...'
                      ) : (
                        <>
                          <Save size={12} /> Save
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-primary">
            Physician Clinical Notes & Observations
          </label>
          <span className="font-mono text-[11px] text-primary/50">
            {notes.length} / 500 characters
          </span>
        </div>
        <textarea
          rows={3}
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Record differential diagnoses, patient-specific risk mitigations, or correlative clinical findings..."
          className="mt-1.5 w-full rounded-lg border border-border bg-background p-3 text-xs leading-relaxed text-primary focus:border-accent focus:bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <div className="mt-3 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={savingAll}
            onClick={handleSaveAll}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-accent/90 disabled:opacity-50"
          >
            <Save size={13} /> {savingAll ? 'Saving All...' : 'Save All Review Changes'}
          </button>
        </div>
      </div>

      {auditModalOpen && (
        <AuditLogModal
          scanId={result?.scan_id}
          onClose={() => setAuditModalOpen(false)}
        />
      )}
    </div>
  )
}

export default DoctorReviewSection
