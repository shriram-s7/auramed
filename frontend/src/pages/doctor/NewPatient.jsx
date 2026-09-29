import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronRight, Copy, Printer, X } from 'lucide-react'
import DoctorLayout from '../../components/doctor/DoctorLayout'
import Toast from '../../components/common/Toast'
import { createPatient } from '../../services/patientService'

const DRAFT_KEY = 'auramed_new_patient_draft'

const STEPS = ['Basic Information', 'Medical History', 'Consent', 'Review and Save']

const RELATIONSHIPS = ['Spouse', 'Parent', 'Sibling', 'Child', 'Friend', 'Other']

const FAMILY_HISTORY_OPTIONS = [
  { key: 'breast_cancer', label: 'Breast cancer' },
  { key: 'ovarian_cancer', label: 'Ovarian cancer' },
  { key: 'cervical_cancer', label: 'Cervical cancer' },
  { key: 'pcos', label: 'PCOS' },
]

const PERSONAL_HISTORY_OPTIONS = [
  { key: 'previous_biopsy', label: 'Previous biopsy' },
  { key: 'hormonal_treatment', label: 'Hormonal treatment' },
  { key: 'fertility_treatment', label: 'Fertility treatment' },
  { key: 'menstrual_irregularities', label: 'Menstrual irregularities' },
]

const MODULES = [
  { key: 'breast', label: 'Breast Cancer' },
  { key: 'cervical', label: 'Cervical Cancer' },
  { key: 'pcos', label: 'PCOS' },
]

const REQUIRED_CONSENTS = [
  { key: 'data_storage_and_ai_analysis', label: 'I have obtained informed consent from the patient for data storage and AI analysis' },
  { key: 'share_with_referring_physicians', label: 'Patient allows sharing reports with referring physicians' },
  { key: 'appointment_reminders', label: 'Patient may receive appointment reminders via SMS/Email' },
]

const OPTIONAL_CONSENTS = [
  { key: 'research_contact', label: 'Patient agrees to be contacted for research studies' },
  { key: 'delete_on_account_closure', label: 'Patient requests data deletion upon account closure' },
]

function defaultForm() {
  return {
    fullName: '',
    dob: '',
    gender: '',
    phone: '',
    email: '',
    address: '',
    pinCode: '',
    emergencyName: '',
    emergencyRelation: '',
    emergencyPhone: '',
    familyHistory: { breast_cancer: false, ovarian_cancer: false, cervical_cancer: false, pcos: false, other: false, other_details: '' },
    personalHistory: { previous_biopsy: false, hormonal_treatment: false, fertility_treatment: false, menstrual_irregularities: false, other: false, other_details: '' },
    additionalNotes: '',
    consent: {
      data_storage_and_ai_analysis: false,
      share_with_referring_physicians: false,
      appointment_reminders: false,
      research_contact: false,
      delete_on_account_closure: false,
    },
    preferredModules: [],
  }
}

function calculateAge(dobString) {
  if (!dobString) return null
  const dob = new Date(dobString)
  if (Number.isNaN(dob.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--
  return age
}

function validatePhone(phone) {
  return /^[0-9+\-\s()]{7,15}$/.test(phone.trim())
}

function validateEmail(email) {
  return /^\S+@\S+\.\S+$/.test(email)
}

function NewPatient() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) return { ...defaultForm(), ...JSON.parse(raw) }
    } catch {
      // ignore corrupt draft
    }
    return defaultForm()
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [successInfo, setSuccessInfo] = useState(null)
  const [addAnotherFlow, setAddAnotherFlow] = useState(false)

  const draftToastShownRef = useRef(false)

  useEffect(() => {
    if (draftToastShownRef.current) return
    draftToastShownRef.current = true
    if (localStorage.getItem(DRAFT_KEY)) {
      setToast('Restored your saved draft.')
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form))
    }, 500)
    return () => clearTimeout(t)
  }, [form])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function updateNested(group, key, value) {
    setForm((f) => ({ ...f, [group]: { ...f[group], [key]: value } }))
  }

  function toggleModule(key) {
    setForm((f) => ({
      ...f,
      preferredModules: f.preferredModules.includes(key)
        ? f.preferredModules.filter((m) => m !== key)
        : [...f.preferredModules, key],
    }))
  }

  const age = useMemo(() => calculateAge(form.dob), [form.dob])

  function validateStep1() {
    const e = {}
    if (!form.fullName.trim()) e.fullName = 'Full name is required'
    if (!form.dob) e.dob = 'Date of birth is required'
    if (!form.gender) e.gender = 'Gender is required'
    if (!form.phone.trim()) e.phone = 'Phone number is required'
    else if (!validatePhone(form.phone)) e.phone = 'Enter a valid phone number'
    if (form.email && !validateEmail(form.email)) e.email = 'Enter a valid email address'
    if (!form.address.trim()) e.address = 'Address is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateStep2() {
    const e = {}
    if (form.familyHistory.other && !form.familyHistory.other_details.trim()) {
      e.familyOther = 'Please specify the other family history'
    }
    if (form.personalHistory.other && !form.personalHistory.other_details.trim()) {
      e.personalOther = 'Please specify the other medical history'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateStep3() {
    const e = {}
    for (const { key, label } of REQUIRED_CONSENTS) {
      if (!form.consent[key]) e[key] = `Required: ${label}`
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function goNext() {
    let valid = true
    if (step === 1) valid = validateStep1()
    if (step === 2) valid = validateStep2()
    if (step === 3) valid = validateStep3()
    if (valid) setStep((s) => Math.min(4, s + 1))
  }

  function goToStep(target) {
    if (target < step) {
      setStep(target)
      return
    }
    let valid = true
    for (let s = step; s < target; s++) {
      if (s === 1) valid = validateStep1()
      else if (s === 2) valid = validateStep2()
      else if (s === 3) valid = validateStep3()
      if (!valid) {
        setStep(s)
        return
      }
    }
    setStep(target)
  }

  function saveDraftNow() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form))
    setToast('Draft saved.')
  }

  function buildPayload() {
    return {
      full_name: form.fullName.trim(),
      date_of_birth: form.dob || null,
      gender: form.gender || null,
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      address: form.address.trim(),
      pin_code: form.pinCode.trim() || null,
      emergency_contact_name: form.emergencyName.trim() || null,
      emergency_contact_phone: form.emergencyPhone.trim() || null,
      emergency_contact_relation: form.emergencyRelation || null,
      family_history: form.familyHistory,
      personal_medical_history: form.personalHistory,
      additional_notes: form.additionalNotes.trim() || null,
      consent: form.consent,
      preferred_modules: form.preferredModules,
    }
  }

  async function handleSave(addAnother) {
    if (!validateStep1() || !validateStep2() || !validateStep3()) {
      setToast('Please complete all required fields before saving.')
      return
    }
    setSaving(true)
    setAddAnotherFlow(addAnother)
    try {
      const res = await createPatient(buildPayload())
      localStorage.removeItem(DRAFT_KEY)
      setSuccessInfo(res.data)
    } catch (err) {
      setToast(err.response?.data?.detail || 'Could not save this patient. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function dismissSuccess() {
    const patientId = successInfo?.patient_id
    setSuccessInfo(null)
    if (addAnotherFlow) {
      setForm(defaultForm())
      setStep(1)
      setToast('Patient saved. Ready for the next one.')
    } else if (patientId) {
      navigate(`/doctor/patients/${patientId}`)
    } else {
      navigate('/doctor/patients')
    }
  }

  return (
    <DoctorLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-primary">Register New Patient</h1>

      <div className="mt-6 flex items-center gap-2">
        {STEPS.map((label, idx) => {
          const n = idx + 1
          const active = n === step
          const done = n < step
          return (
            <button
              key={label}
              type="button"
              onClick={() => goToStep(n)}
              className="flex flex-1 items-center gap-2"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  done ? 'bg-accent text-white' : active ? 'bg-primary text-white' : 'bg-border text-primary/50'
                }`}
              >
                {done ? <Check size={14} /> : n}
              </span>
              <span className={`hidden text-xs font-medium sm:block ${active ? 'text-primary' : 'text-primary/40'}`}>
                {label}
              </span>
              {n < STEPS.length && <span className="hidden h-px flex-1 bg-border sm:block" />}
            </button>
          )
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-border bg-surface p-6">
          {step === 1 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-sm font-semibold text-primary">Personal Information</h2>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-primary">Full Name *</label>
                    <input
                      value={form.fullName}
                      onChange={(e) => update('fullName', e.target.value)}
                      className={`mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40 ${errors.fullName ? 'border-danger' : 'border-border'}`}
                    />
                    {errors.fullName && <p className="mt-1 text-xs text-danger">{errors.fullName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary">
                      Date of Birth * {age !== null && <span className="text-primary/40">({age} yrs)</span>}
                    </label>
                    <input
                      type="date"
                      value={form.dob}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => update('dob', e.target.value)}
                      className={`mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40 ${errors.dob ? 'border-danger' : 'border-border'}`}
                    />
                    {errors.dob && <p className="mt-1 text-xs text-danger">{errors.dob}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary">Gender *</label>
                    <select
                      value={form.gender}
                      onChange={(e) => update('gender', e.target.value)}
                      className={`mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40 ${errors.gender ? 'border-danger' : 'border-border'}`}
                    >
                      <option value="">Select gender</option>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="other">Other</option>
                    </select>
                    {errors.gender && <p className="mt-1 text-xs text-danger">{errors.gender}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary">Phone Number *</label>
                    <input
                      value={form.phone}
                      onChange={(e) => update('phone', e.target.value)}
                      placeholder="+91-9000000000"
                      className={`mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40 ${errors.phone ? 'border-danger' : 'border-border'}`}
                    />
                    {errors.phone && <p className="mt-1 text-xs text-danger">{errors.phone}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary">Email (optional)</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                      className={`mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40 ${errors.email ? 'border-danger' : 'border-border'}`}
                    />
                    {errors.email && <p className="mt-1 text-xs text-danger">{errors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary">PIN Code</label>
                    <input
                      value={form.pinCode}
                      onChange={(e) => update('pinCode', e.target.value)}
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-primary">Address *</label>
                    <textarea
                      value={form.address}
                      onChange={(e) => update('address', e.target.value)}
                      rows={2}
                      className={`mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40 ${errors.address ? 'border-danger' : 'border-border'}`}
                    />
                    {errors.address && <p className="mt-1 text-xs text-danger">{errors.address}</p>}
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-primary">Emergency Contact</h2>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-primary">Contact Name</label>
                    <input
                      value={form.emergencyName}
                      onChange={(e) => update('emergencyName', e.target.value)}
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary">Relationship</label>
                    <select
                      value={form.emergencyRelation}
                      onChange={(e) => update('emergencyRelation', e.target.value)}
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                    >
                      <option value="">Select</option>
                      {RELATIONSHIPS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary">Phone Number</label>
                    <input
                      value={form.emergencyPhone}
                      onChange={(e) => update('emergencyPhone', e.target.value)}
                      className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-sm font-semibold text-primary">Family History</h2>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {FAMILY_HISTORY_OPTIONS.map((opt) => (
                    <label key={opt.key} className="flex items-center gap-2 text-sm text-primary/80">
                      <input
                        type="checkbox"
                        checked={form.familyHistory[opt.key]}
                        onChange={(e) => updateNested('familyHistory', opt.key, e.target.checked)}
                        className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                      />
                      {opt.label}
                    </label>
                  ))}
                  <label className="flex items-center gap-2 text-sm text-primary/80">
                    <input
                      type="checkbox"
                      checked={form.familyHistory.other}
                      onChange={(e) => updateNested('familyHistory', 'other', e.target.checked)}
                      className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                    />
                    Other
                  </label>
                </div>
                {form.familyHistory.other && (
                  <div className="mt-2">
                    <input
                      value={form.familyHistory.other_details}
                      onChange={(e) => updateNested('familyHistory', 'other_details', e.target.value)}
                      placeholder="Please specify"
                      className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40 ${errors.familyOther ? 'border-danger' : 'border-border'}`}
                    />
                    {errors.familyOther && <p className="mt-1 text-xs text-danger">{errors.familyOther}</p>}
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-sm font-semibold text-primary">Personal Medical History</h2>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {PERSONAL_HISTORY_OPTIONS.map((opt) => (
                    <label key={opt.key} className="flex items-center gap-2 text-sm text-primary/80">
                      <input
                        type="checkbox"
                        checked={form.personalHistory[opt.key]}
                        onChange={(e) => updateNested('personalHistory', opt.key, e.target.checked)}
                        className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                      />
                      {opt.label}
                    </label>
                  ))}
                  <label className="flex items-center gap-2 text-sm text-primary/80">
                    <input
                      type="checkbox"
                      checked={form.personalHistory.other}
                      onChange={(e) => updateNested('personalHistory', 'other', e.target.checked)}
                      className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                    />
                    Other
                  </label>
                </div>
                {form.personalHistory.other && (
                  <div className="mt-2">
                    <input
                      value={form.personalHistory.other_details}
                      onChange={(e) => updateNested('personalHistory', 'other_details', e.target.value)}
                      placeholder="Please specify"
                      className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40 ${errors.personalOther ? 'border-danger' : 'border-border'}`}
                    />
                    {errors.personalOther && <p className="mt-1 text-xs text-danger">{errors.personalOther}</p>}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-primary">Additional Notes</label>
                <textarea
                  value={form.additionalNotes}
                  onChange={(e) => update('additionalNotes', e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-primary">Required Consent</h2>
                <div className="mt-3 space-y-3">
                  {REQUIRED_CONSENTS.map((c) => (
                    <div key={c.key}>
                      <label className="flex items-start gap-2 text-sm text-primary/80">
                        <input
                          type="checkbox"
                          checked={form.consent[c.key]}
                          onChange={(e) => updateNested('consent', c.key, e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-border text-accent focus:ring-accent"
                        />
                        {c.label}
                      </label>
                      {errors[c.key] && <p className="ml-6 mt-1 text-xs text-danger">{errors[c.key]}</p>}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-primary">Optional</h2>
                <div className="mt-3 space-y-3">
                  {OPTIONAL_CONSENTS.map((c) => (
                    <label key={c.key} className="flex items-start gap-2 text-sm text-primary/80">
                      <input
                        type="checkbox"
                        checked={form.consent[c.key]}
                        onChange={(e) => updateNested('consent', c.key, e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-border text-accent focus:ring-accent"
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>

              <p className="rounded-md bg-background p-3 text-xs text-primary/50">
                Patient data is stored securely and used only for clinical screening, reporting, and
                the purposes the patient has consented to above. Consent can be withdrawn at any time
                by contacting the clinic.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-sm font-semibold text-primary">Review</h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-md border border-border p-3 text-sm">
                  <p className="font-semibold text-primary">Personal Information</p>
                  <p className="mt-1 text-primary/60">{form.fullName || '—'}</p>
                  <p className="text-primary/60">
                    {form.dob || '—'} {age !== null && `(${age} yrs)`} · {form.gender || '—'}
                  </p>
                  <p className="text-primary/60">{form.phone || '—'}</p>
                  <p className="text-primary/60">{form.email || 'No email provided'}</p>
                  <p className="text-primary/60">{form.address || '—'}</p>
                </div>
                <div className="rounded-md border border-border p-3 text-sm">
                  <p className="font-semibold text-primary">Emergency Contact</p>
                  <p className="mt-1 text-primary/60">{form.emergencyName || 'Not provided'}</p>
                  <p className="text-primary/60">{form.emergencyRelation || '—'}</p>
                  <p className="text-primary/60">{form.emergencyPhone || '—'}</p>
                </div>
                <div className="rounded-md border border-border p-3 text-sm sm:col-span-2">
                  <p className="font-semibold text-primary">Medical History</p>
                  <p className="mt-1 text-primary/60">
                    Family:{' '}
                    {[...FAMILY_HISTORY_OPTIONS.filter((o) => form.familyHistory[o.key]).map((o) => o.label), form.familyHistory.other ? form.familyHistory.other_details : null]
                      .filter(Boolean)
                      .join(', ') || 'None reported'}
                  </p>
                  <p className="text-primary/60">
                    Personal:{' '}
                    {[...PERSONAL_HISTORY_OPTIONS.filter((o) => form.personalHistory[o.key]).map((o) => o.label), form.personalHistory.other ? form.personalHistory.other_details : null]
                      .filter(Boolean)
                      .join(', ') || 'None reported'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-primary">Preferred Modules</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {form.preferredModules.length === 0 && (
                    <span className="text-xs text-primary/40">
                      None selected — choose modules in the panel on the right.
                    </span>
                  )}
                  {form.preferredModules.map((m) => (
                    <span key={m} className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                      {MODULES.find((mod) => mod.key === m)?.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave(false)}
                  className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                >
                  {saving && !addAnotherFlow ? 'Saving…' : 'Save Patient'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave(true)}
                  className="rounded-md border border-border px-4 py-2.5 text-sm font-semibold text-primary hover:border-accent hover:text-accent disabled:opacity-60"
                >
                  {saving && addAnotherFlow ? 'Saving…' : 'Save and Add Another'}
                </button>
              </div>
            </div>
          )}

          {step < 4 && (
            <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
              <button
                type="button"
                onClick={saveDraftNow}
                className="text-sm font-medium text-primary/50 hover:text-primary"
              >
                Save Draft
              </button>
              <div className="flex gap-2">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s - 1)}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium text-primary hover:border-accent"
                  >
                    Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={goNext}
                  className="flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold text-primary">Progress</p>
            <ul className="mt-3 space-y-2">
              {STEPS.map((label, idx) => (
                <li key={label} className="flex items-center gap-2 text-xs">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      idx + 1 < step ? 'bg-accent text-white' : idx + 1 === step ? 'bg-primary text-white' : 'bg-border text-primary/40'
                    }`}
                  >
                    {idx + 1 < step ? <Check size={12} /> : idx + 1}
                  </span>
                  <span className={idx + 1 === step ? 'font-medium text-primary' : 'text-primary/50'}>{label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold text-primary">Preferred Modules</p>
            <div className="mt-3 space-y-2">
              {MODULES.map((m) => (
                <label key={m.key} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  {m.label}
                  <input
                    type="checkbox"
                    checked={form.preferredModules.includes(m.key)}
                    onChange={() => toggleModule(m.key)}
                    className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold text-primary">Consent Summary</p>
            <ul className="mt-3 space-y-1.5 text-xs text-primary/60">
              {[...REQUIRED_CONSENTS, ...OPTIONAL_CONSENTS].map((c) => (
                <li key={c.key} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${form.consent[c.key] ? 'bg-success' : 'bg-border'}`} />
                  {c.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-dashed border-accent/40 bg-accent/5 p-4">
            <p className="text-sm font-semibold text-primary">Patient ID Preview</p>
            <p className="mt-1 font-mono text-lg text-accent">P-{new Date().getFullYear()}-XXXX</p>
            <p className="mt-1 text-xs text-primary/50">The exact ID is assigned when you save.</p>
          </div>
        </div>
      </div>

      {successInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-primary">Patient Registered</h3>
              <button type="button" onClick={dismissSuccess} className="text-primary/40 hover:text-primary">
                <X size={18} />
              </button>
            </div>
            <p className="mt-2 text-sm text-primary/60">
              Share these credentials with the patient so they can log in and view their reports.
            </p>

            <div className="mt-4 space-y-2 rounded-md bg-background p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-primary/50">Patient ID</span>
                <span className="font-mono font-semibold text-primary">{successInfo.patient_code}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-primary/50">Login Email</span>
                <span className="font-mono text-primary">{successInfo.email || successInfo.patient_code.toLowerCase() + '@patients.auramed.local'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-primary/50">Temporary Password</span>
                <span className="font-mono font-semibold text-primary">{successInfo.temporary_password}</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `Patient ID: ${successInfo.patient_code}\nPassword: ${successInfo.temporary_password}`,
                  )
                  setToast('Credentials copied to clipboard.')
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border py-2 text-sm font-medium text-primary hover:border-accent"
              >
                <Copy size={14} /> Copy
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border py-2 text-sm font-medium text-primary hover:border-accent"
              >
                <Printer size={14} /> Print
              </button>
            </div>
            <button
              type="button"
              onClick={() => setToast('Sending credentials via SMS is coming soon.')}
              className="mt-2 w-full rounded-md border border-border py-2 text-sm font-medium text-primary/60 hover:border-accent"
            >
              Send via SMS
            </button>

            <button
              type="button"
              onClick={dismissSuccess}
              className="mt-4 w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
    </DoctorLayout>
  )
}

export default NewPatient
