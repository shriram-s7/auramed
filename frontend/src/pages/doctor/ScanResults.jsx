import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  FileCheck,
  Layers,
  Sparkles,
  User,
} from 'lucide-react'
import DoctorLayout from '../../components/doctor/DoctorLayout'
import InitialsAvatar from '../../components/common/InitialsAvatar'
import ImageAnalysisSection from '../../components/doctor/scan-results/ImageAnalysisSection'
import ClinicalAnalysisSection from '../../components/doctor/scan-results/ClinicalAnalysisSection'
import RotterdamCriteriaSection from '../../components/doctor/scan-results/RotterdamCriteriaSection'
import FusionFinalResultSection from '../../components/doctor/scan-results/FusionFinalResultSection'
import AiVisualIntelligenceSection from '../../components/doctor/scan-results/AiVisualIntelligenceSection'
import ReferenceImagesSection from '../../components/doctor/scan-results/ReferenceImagesSection'
import DoctorReviewSection from '../../components/doctor/scan-results/DoctorReviewSection'
import NextStepsSection from '../../components/doctor/scan-results/NextStepsSection'
import RiskBadgeLarge from '../../components/doctor/scan-results/RiskBadgeLarge'
import ScanResultsSkeleton from '../../components/doctor/scan-results/ScanResultsSkeleton'
import {
  fetchScanResults,
  togglePatientUrgent,
  updateDoctorReview,
} from '../../services/scanResultsService'

const MODULE_TITLES = {
  breast: 'Breast Cancer Detection',
  cervical: 'Cervical Cancer Screening',
  pcos: 'PCOS Ultrasound Analysis',
}

const TABS = [
  { id: 'ai-analysis', label: 'AI Analysis' },
  { id: 'clinical-analysis', label: 'Clinical Analysis' },
  { id: 'fusion-score', label: 'Fusion and Risk Score' },
  { id: 'visual-intelligence', label: 'AI Visual Intelligence' },
  { id: 'reference-images', label: 'Reference Images' },
  { id: 'doctor-review', label: 'Doctor Review' },
  { id: 'report-preview', label: 'Report Preview' },
]

function ScanResults() {
  const params = useParams()
  const module = params.module || 'breast'
  const scanId = params.scanId || params.id
  const navigate = useNavigate()


  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [activeTab, setActiveTab] = useState('ai-analysis')

  const sec1Ref = useRef(null)
  const sec2Ref = useRef(null)
  const rotterdamRef = useRef(null)
  const sec3Ref = useRef(null)
  const aiVisualRef = useRef(null)
  const sec4Ref = useRef(null)
  const sec5Ref = useRef(null)

  const tabs =
    module === 'pcos'
      ? [
          { id: 'ai-analysis', label: 'AI Analysis' },
          { id: 'clinical-analysis', label: 'Clinical Analysis' },
          { id: 'rotterdam-criteria', label: 'Rotterdam Criteria' },
          { id: 'fusion-score', label: 'Fusion & Risk Score' },
          { id: 'visual-intelligence', label: 'AI Visual Intelligence' },
          { id: 'reference-images', label: 'Reference Images' },
          { id: 'doctor-review', label: 'Doctor Review' },
          { id: 'report-preview', label: 'Report Preview' },
        ]
      : TABS

  useEffect(() => {
    if (!scanId) return
    setLoading(true)
    setError(null)
    fetchScanResults(scanId)
      .then((res) => {
        setResult(res.data)
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'Failed to load scan analysis results.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [scanId])

  const handleTabClick = (tabId) => {
    setActiveTab(tabId)
    if (tabId === 'report-preview') {
      navigate('/doctor/scan/' + module + '/report/' + scanId)
      return
    }
    const refMap = {
      'ai-analysis': sec1Ref,
      'clinical-analysis': sec2Ref,
      'rotterdam-criteria': rotterdamRef,
      'fusion-score': sec3Ref,
      'visual-intelligence': aiVisualRef,
      'reference-images': sec4Ref,
      'doctor-review': sec5Ref,
    }
    const targetRef = refMap[tabId]
    if (targetRef && targetRef.current) {
      targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handleUpdateDoctorReview = async (values, notes) => {
    const res = await updateDoctorReview(scanId, values, notes)
    setResult(res.data)
    return res.data
  }

  const handleToggleUrgent = async () => {
    if (!result?.patient?.id) return
    const res = await togglePatientUrgent(result.patient.id)
    setResult((prev) => ({
      ...prev,
      is_urgent: res.data.is_urgent,
    }))
  }

  const patient = result?.patient
  const moduleLabel = MODULE_TITLES[module] || module.toUpperCase()

  const formattedScanDate = result?.scan_date
    ? new Date(result.scan_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Not specified'

  const formattedAnalysisTime = result?.analysis_datetime
    ? new Date(result.analysis_datetime).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Just now'

  return (
    <DoctorLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 pb-16">
        {loading ? (
          <ScanResultsSkeleton />
        ) : error ? (
          <div className="rounded-xl border border-danger/30 bg-danger/10 p-8 text-center">
            <p className="text-base font-bold text-danger">Error Loading Analysis Results</p>
            <p className="mt-1 text-xs text-primary/70">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/doctor/scan/' + module)}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white"
            >
              Return to Workbench
            </button>
          </div>
        ) : result ? (
          <>
            {/* TOP SECTION: Breadcrumb & Workbench Button */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-primary/60">
                <Link to="/doctor/patients" className="hover:text-primary transition">
                  Patients
                </Link>
                <ChevronRight size={13} className="text-primary/30" />
                <Link
                  to={'/doctor/patients/' + (patient?.id || '')}
                  className="font-medium hover:text-primary transition"
                >
                  {patient?.full_name || 'Patient'}
                </Link>
                <ChevronRight size={13} className="text-primary/30" />
                <Link to={'/doctor/scan/' + module} className="hover:text-primary transition">
                  {moduleLabel}
                </Link>
                <ChevronRight size={13} className="text-primary/30" />
                <span className="font-bold text-primary">Analysis Results</span>
              </nav>

              <button
                type="button"
                onClick={() => navigate('/doctor/scan/' + module)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-slate-50 shadow-sm"
              >
                <ArrowLeft size={13} /> Back to Workbench
              </button>
            </div>

            {/* PATIENT SUMMARY BAR */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 pb-4">
                <div className="flex items-center gap-3.5">
                  <InitialsAvatar name={patient?.full_name || 'P'} size="lg" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl font-extrabold text-primary">
                        {patient?.full_name}
                      </h1>
                      <span className="font-mono text-xs text-primary/50">
                        ({patient?.patient_code})
                      </span>
                      {patient?.age && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-primary/70">
                          {patient.age} yrs • {patient.gender || 'F'}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-accent">
                      AuraMed Multimodal Clinical Decision Support
                    </p>
                  </div>
                </div>

                {/* Risk badge (large, color coded) */}
                <div>
                  <RiskBadgeLarge level={result.risk_level} size="md" />
                </div>
              </div>

              {/* Patient metadata fields grid */}
              <div className="mt-4 grid grid-cols-2 gap-4 text-xs sm:grid-cols-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/50">
                    Last Scan Date
                  </p>
                  <p className="mt-1 font-semibold text-primary">{formattedScanDate}</p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/50">
                    Scan Type
                  </p>
                  <p className="mt-1 font-semibold text-primary">{result.scan_type_label}</p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/50">
                    Clinical Indication
                  </p>
                  <p className="mt-1 font-semibold text-primary truncate" title={result.clinical_indication}>
                    {result.clinical_indication}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/50">
                    Referring Physician
                  </p>
                  <p className="mt-1 font-semibold text-primary">{result.referring_physician}</p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/50">
                    Analysis Date & Time
                  </p>
                  <p className="mt-1 font-semibold text-primary">{formattedAnalysisTime}</p>
                </div>
              </div>
            </div>

            {/* TAB NAVIGATION */}
            <div className="border-b border-border">
              <nav className="flex space-x-2 overflow-x-auto pb-1" aria-label="Tabs">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleTabClick(tab.id)}
                      className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                        isActive
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-primary/70 hover:bg-slate-100 hover:text-primary'
                      }`}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </nav>
            </div>

            {/* MAIN CONTENT */}
            {module === 'pcos' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* LEFT COLUMN - Section 1: Image Analysis */}
                  <ImageAnalysisSection result={result} sectionRef={sec1Ref} />

                  {/* RIGHT COLUMN - Section 2: Clinical Analysis */}
                  <ClinicalAnalysisSection result={result} sectionRef={sec2Ref} />
                </div>

                {/* DEDICATED ROTTERDAM CRITERIA ASSESSMENT SECTION (Between Clinical Analysis and Fusion) */}
                <RotterdamCriteriaSection result={result} sectionRef={rotterdamRef} />

                {/* Section 3: Fusion and Final Result */}
                <FusionFinalResultSection result={result} sectionRef={sec3Ref} />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* LEFT COLUMN - Section 1: Image Analysis */}
                <ImageAnalysisSection result={result} sectionRef={sec1Ref} />

                {/* CENTER COLUMN - Section 2: Clinical Analysis */}
                <ClinicalAnalysisSection result={result} sectionRef={sec2Ref} />

                {/* RIGHT COLUMN - Section 3: Fusion and Final Result */}
                <FusionFinalResultSection result={result} sectionRef={sec3Ref} />
              </div>
            )}

            {/* BELOW MAIN COLUMNS */}
            <div className="space-y-6 pt-2">
              {/* DEDICATED AI VISUAL INTELLIGENCE SECTION (Grad-CAM Neural Activation Map Showcase) */}
              <AiVisualIntelligenceSection
                module={module}
                result={result}
                scanId={scanId}
                sectionRef={aiVisualRef}
              />

              {/* Section 4: Reference Images from Dataset */}
              <ReferenceImagesSection result={result} sectionRef={sec4Ref} />

              {/* Section 5: Doctor Review and Modify */}
              <DoctorReviewSection
                result={result}
                onUpdateSuccess={handleUpdateDoctorReview}
                sectionRef={sec5Ref}
              />

              {/* Section 6: Next Steps */}
              <NextStepsSection
                result={result}
                onToggleUrgent={handleToggleUrgent}
              />
            </div>
          </>
        ) : null}
      </div>
    </DoctorLayout>
  )
}

export default ScanResults
