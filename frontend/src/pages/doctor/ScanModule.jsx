import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { ChevronRight, RefreshCcw, Save, ShieldCheck, Trash2 } from 'lucide-react'
import DoctorLayout from '../../components/doctor/DoctorLayout'
import ScanStepIndicator from '../../components/doctor/scan/ScanStepIndicator'
import PatientSelectorCard from '../../components/doctor/scan/PatientSelectorCard'
import ImageUploadPanel from '../../components/doctor/scan/ImageUploadPanel'
import ClinicalInputForm from '../../components/doctor/scan/ClinicalInputForm'
import ReferenceImagesPanel from '../../components/doctor/scan/ReferenceImagesPanel'
import ReferenceRangesPanel from '../../components/doctor/scan/ReferenceRangesPanel'
import ValidationPanel from '../../components/doctor/scan/ValidationPanel'
import Toast from '../../components/common/Toast'
import { SCAN_MODULES, getReferenceRanges } from '../../config/scanModules'
import { SCAN_TEST_CASES } from '../../config/scanTestCases'
import { validateClinicalInputs } from '../../utils/scanValidation'
import { fetchPatientDetail } from '../../services/patientDetailService'
import { analyzeScan, saveScanDraft } from '../../services/scanService'

const OTHER_MODULES = {
  breast: [
    { key: 'cervical', label: 'Cervical Cancer' },
    { key: 'pcos', label: 'PCOS' },
  ],
  cervical: [
    { key: 'breast', label: 'Breast Cancer' },
    { key: 'pcos', label: 'PCOS' },
  ],
  pcos: [
    { key: 'breast', label: 'Breast Cancer' },
    { key: 'cervical', label: 'Cervical Cancer' },
  ],
}

function draftKey(moduleKey, patientId) {
  return `auramed_scan_draft_${moduleKey}_${patientId || 'none'}`
}

const PCOS_ALIASES = {
  amh_ng_ml: 'amh_ng_mL',
  amh_ng_mL: 'amh_ng_ml',
  lh_miu_ml: 'lh_mIU_mL',
  lh_mIU_mL: 'lh_miu_ml',
  fsh_miu_ml: 'fsh_mIU_mL',
  fsh_mIU_mL: 'fsh_miu_ml',
  total_testosterone_ng_dl: 'testosterone_ng_dL',
  testosterone_ng_dL: 'total_testosterone_ng_dl',
  prolactin_ng_ml: 'prolactin_ng_mL',
  prolactin_ng_mL: 'prolactin_ng_ml',
  left_ovary_volume_ml: 'left_ovarian_volume_mL',
  left_ovarian_volume_mL: 'left_ovary_volume_ml',
  right_ovary_volume_ml: 'right_ovarian_volume_mL',
  right_ovarian_volume_mL: 'right_ovary_volume_ml',
  menstrual_regularity: 'menstrual_cycle_regularity',
  menstrual_cycle_regularity: 'menstrual_regularity',
}

function syncAliases(vals, mod) {
  if (!vals) return {}
  const res = { ...vals }
  if (mod === 'pcos') {
    for (const [k, alt] of Object.entries(PCOS_ALIASES)) {
      if (res[k] !== undefined && res[alt] === undefined) {
        res[alt] = res[k]
      }
    }
  }
  return res
}

function ScanModule({ defaultModule }) {
  const { module: paramModule } = useParams()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const module = useMemo(() => {
    if (paramModule && SCAN_MODULES[paramModule]) return paramModule
    if (defaultModule && SCAN_MODULES[defaultModule]) return defaultModule
    const p = location.pathname.toLowerCase()
    if (p.includes('/scan/cervical')) return 'cervical'
    if (p.includes('/scan/pcos')) return 'pcos'
    if (p.includes('/scan/breast')) return 'breast'
    return 'breast'
  }, [paramModule, defaultModule, location.pathname])

  const moduleConfig = SCAN_MODULES[module] || SCAN_MODULES.breast

  const [patient, setPatient] = useState(null)
  const [images, setImages] = useState([])
  const [values, setValues] = useState({})
  const [showErrors, setShowErrors] = useState(false)
  const [step, setStep] = useState(1)
  const [analyzing, setAnalyzing] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [clearModalOpen, setClearModalOpen] = useState(false)
  const [moduleMenuOpen, setModuleMenuOpen] = useState(false)
  const [toast, setToast] = useState(null)

  const patientId = searchParams.get('patientId')

  useEffect(() => {
    if (!patientId) {
      setPatient(null)
      return
    }
    fetchPatientDetail(patientId).then((res) => {
      const p = res.data.patient
      setPatient({ id: p.id, full_name: p.full_name, patient_code: p.patient_code, age: p.age, gender: p.gender })
    })
  }, [patientId])

  useEffect(() => {
    const raw = localStorage.getItem(draftKey(module, patientId))
    if (raw) {
      try {
        setValues(syncAliases(JSON.parse(raw), module))
      } catch {
        // ignore corrupt draft
      }
    } else {
      setValues({})
    }
    setImages([])
    setShowErrors(false)
    setStep(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module])

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(draftKey(module, patientId), JSON.stringify(values))
    }, 500)
    return () => clearTimeout(t)
  }, [values, module, patientId])

  const handleChange = useCallback((key, value) => {
    setValues((v) => {
      const next = { ...v, [key]: value }
      const alt = PCOS_ALIASES[key]
      if (alt) next[alt] = value
      return next
    })
  }, [])

  function handleSelectPatient(p) {
    setPatient({ id: p.id, full_name: p.full_name, patient_code: p.patient_code, age: p.age, gender: p.gender })
    const next = new URLSearchParams(searchParams)
    next.set('patientId', p.id)
    setSearchParams(next)
  }

  const validation = useMemo(() => validateClinicalInputs(module, values), [module, values])
  const imageUploaded = images.length > 0
  const canRun = validation.valid && imageUploaded && Boolean(patient)

  async function handleSaveDraft() {
    if (!patient) {
      setToast('Select a patient before saving a draft.')
      return
    }
    setSavingDraft(true)
    try {
      const draftInputs = syncAliases(values, module)
      localStorage.setItem(draftKey(module, patientId), JSON.stringify(draftInputs))
      await saveScanDraft({ module, patientId: patient.id, clinicalInputs: draftInputs })
      setToast('Draft saved.')
    } catch (err) {
      setToast(err.response?.data?.detail || 'Could not save draft.')
    } finally {
      setSavingDraft(false)
    }
  }

  function handleLoadTestCase(tier) {
    const testCase = SCAN_TEST_CASES[module]?.[tier]
    if (!testCase) return
    setValues((v) => syncAliases({ ...v, ...testCase }, module))
    setToast(`${tier.charAt(0).toUpperCase()}${tier.slice(1)} risk test case loaded.`)
  }

  function handleClearAll() {
    setValues({})
    setImages([])
    localStorage.removeItem(draftKey(module, patientId))
    setClearModalOpen(false)
    setShowErrors(false)
    setToast('All inputs cleared.')
  }

  async function handleRunAnalysis() {
    setShowErrors(true)
    if (!patient) {
      setToast('Select a patient before running analysis.')
      return
    }
    if (!canRun) {
      setToast('Please resolve the validation issues before running analysis.')
      return
    }
    setAnalyzing(true)
    setStep(2)
    try {
      const submissionInputs = syncAliases(values, module)
      const res = await analyzeScan({
        module,
        patientId: patient.id,
        clinicalInputs: submissionInputs,
        imageQuality: values.image_quality || values.sample_adequacy,
        image: images[0].file,
        additionalImages: images.slice(1).map((i) => i.file),
      })
      localStorage.removeItem(draftKey(module, patientId))
      navigate(`/doctor/scan/${module}/results/${res.data.scan_id}`)
    } catch (err) {
      setStep(1)
      setToast(err.response?.data?.detail || 'Analysis failed. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  if (!moduleConfig) {
    return (
      <DoctorLayout>
        <div className="p-6">
          <p className="text-sm text-danger">Unknown screening module.</p>
        </div>
      </DoctorLayout>
    )
  }

  return (
    <DoctorLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1 text-xs text-primary/50">
            <span>Scan Workbench</span>
            <ChevronRight size={12} />
            <span className="text-primary">{moduleConfig.label}</span>
          </div>
          <h1 className="mt-1 text-xl font-bold text-primary">{moduleConfig.label} - Scan Workbench</h1>
          <p className="mt-1 max-w-2xl text-sm text-primary/50">{moduleConfig.subtitle}</p>
        </div>

        <div className="flex items-start gap-2">
          <PatientSelectorCard patient={patient} onSelect={handleSelectPatient} />
          <div className="relative">
            <button
              type="button"
              onClick={() => setModuleMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-primary hover:border-accent hover:text-accent"
            >
              <RefreshCcw size={14} /> Switch Module
            </button>
            {moduleMenuOpen && (
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-border bg-surface py-1 shadow-lg">
                {(OTHER_MODULES[module] || OTHER_MODULES.breast).map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => {
                      setModuleMenuOpen(false)
                      const qs = patientId ? `?patientId=${patientId}` : ''
                      navigate(`/doctor/scan/${m.key}${qs}`)
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-primary hover:bg-background"
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-4">
        <ScanStepIndicator currentStep={step} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1.3fr_0.9fr]">
        <ImageUploadPanel moduleConfig={moduleConfig} images={images} onImagesChange={setImages} />

        <div className="rounded-xl border border-border bg-surface p-4">
          <ClinicalInputForm moduleKey={module} values={values} onChange={handleChange} showErrors={showErrors} onLoadTestCase={handleLoadTestCase} />
        </div>

        <div className="space-y-6">
          <ReferenceImagesPanel moduleConfig={moduleConfig} />
          <ReferenceRangesPanel ranges={getReferenceRanges(module)} />
          <ValidationPanel errors={validation.errors} imageUploaded={imageUploaded} />
        </div>
      </div>

      <div className="sticky bottom-0 mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface/95 py-4 backdrop-blur">
        <button
          type="button"
          onClick={() => setClearModalOpen(true)}
          className="flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-primary hover:border-danger hover:text-danger"
        >
          <Trash2 size={16} /> Clear All
        </button>
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={savingDraft}
          className="flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-primary hover:border-accent hover:text-accent disabled:opacity-60"
        >
          <Save size={16} /> {savingDraft ? 'Saving…' : 'Save Draft'}
        </button>
        <button
          type="button"
          onClick={handleRunAnalysis}
          disabled={!canRun || analyzing}
          className="flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {analyzing ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Analyzing…
            </>
          ) : (
            <>
              <ShieldCheck size={16} /> Run Analysis
            </>
          )}
        </button>
      </div>

      {clearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setClearModalOpen(false)}>
          <div className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-primary">Clear all inputs?</h3>
            <p className="mt-2 text-sm text-primary/60">
              This will remove the uploaded image and all clinical inputs entered for this scan.
              This cannot be undone.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setClearModalOpen(false)}
                className="flex-1 rounded-md border border-border py-2 text-sm font-medium text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="flex-1 rounded-md bg-danger py-2 text-sm font-semibold text-white hover:bg-danger/90"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
    </DoctorLayout>
  )
}

export default ScanModule
