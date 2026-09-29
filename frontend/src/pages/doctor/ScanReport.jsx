import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Lock, ShieldCheck } from 'lucide-react'
import DoctorLayout from '../../components/doctor/DoctorLayout'
import ReportStepper from '../../components/doctor/report/ReportStepper'
import ReportPatientContextCard from '../../components/doctor/report/ReportPatientContextCard'
import ReportSectionsNav from '../../components/doctor/report/ReportSectionsNav'
import ReportPreview from '../../components/doctor/report/ReportPreview'
import ReportEditSectionPanel from '../../components/doctor/report/ReportEditSectionPanel'
import SignReportModal from '../../components/doctor/report/SignReportModal'
import ScheduleFollowupModal from '../../components/doctor/scan-results/ScheduleFollowupModal'
import ScanResultsSkeleton from '../../components/doctor/scan-results/ScanResultsSkeleton'
import {
  fetchReportForScan,
  generateReportPdf,
  saveReportDraft,
  signReport,
} from '../../services/reportService'
import { getScanResults } from '../../services/scanService'
import { triggerPdfDownload } from '../../utils/downloadPdf'

function ScanReport() {
  const params = useParams()
  const module = params.module || 'breast'
  const scanId = params.scanId || params.id
  const navigate = useNavigate()


  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [report, setReport] = useState(null)
  const [content, setContent] = useState(null)
  const [activeSection, setActiveSection] = useState('patient_info')

  const [signModalOpen, setSignModalOpen] = useState(false)
  const [signing, setSigning] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // Section Refs for live auto-scrolling
  const sectionRefs = {
    patient_info: useRef(null),
    clinical_summary: useRef(null),
    imaging_findings: useRef(null),
    ai_assessment: useRef(null),
    rotterdam_criteria: useRef(null),
    risk_assessment: useRef(null),
    recommendations: useRef(null),
  }

  useEffect(() => {
    if (!scanId) return
    setLoading(true)
    setError(null)
    fetchReportForScan(scanId)
      .then(async (res) => {
        let repData = res.data
        // If report doesn't have the blended grad_cam_base64 overlay yet, retrieve from scan results
        if (!repData?.grad_cam_base64) {
          try {
            const scanRes = await getScanResults(scanId)
            const blended = scanRes.data?.grad_cam_base64
            if (blended) {
              repData = {
                ...repData,
                grad_cam_base64: blended,
              }
            }
          } catch {
            // non-fatal, fallback to repData
          }
        }
        setReport(repData)
        setContent(repData.content)
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'Failed to initialize or fetch report.')
      })
      .finally(() => setLoading(false))
  }, [scanId])

  const handleSelectSection = (secId) => {
    setActiveSection(secId)
    const ref = sectionRefs[secId]
    if (ref && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const handleContentChange = (newContent) => {
    setContent(newContent)
  }

  const handleOptionsChange = (newOptions) => {
    setContent((prev) => ({
      ...prev,
      options: newOptions,
    }))
  }

  const handleTemplateChange = (newTemplate) => {
    setContent((prev) => ({
      ...prev,
      template: newTemplate,
    }))
  }

  const handleSaveDraft = async () => {
    if (!report?.id || !content) return
    setSavingDraft(true)
    try {
      const res = await saveReportDraft(report.id, content)
      setReport(res.data)
      setToastMessage('Report draft successfully saved.')
      setTimeout(() => setToastMessage(''), 3000)
    } catch (err) {
      setToastMessage('Failed to save draft.')
    } finally {
      setSavingDraft(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!report?.id) return
    setDownloadingPdf(true)
    try {
      const response = await generateReportPdf(report.id)
      const patientName = (report.patient_name || 'Patient').replace(/\s+/g, '_')
      const mod = module.toUpperCase()
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const filename = `AuraMed_${patientName}_${mod}_${dateStr}.pdf`
      triggerPdfDownload(response.data, filename)
      setToastMessage('PDF downloaded successfully.')
      setTimeout(() => setToastMessage(''), 3000)
    } catch (err) {
      setToastMessage('Failed to generate PDF.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleSignConfirm = async () => {
    if (!report?.id) return
    setSigning(true)
    try {
      // Only save draft if report is not already signed
      if (report.status !== 'signed' && report.status !== 'addendum') {
        await saveReportDraft(report.id, content)
      }
      const signedRes = await signReport(report.id)
      setSignModalOpen(false)
      const reportId = signedRes.data?.id || signedRes.data?.report_id || signedRes.data?.report?.id || report.id
      if (reportId && reportId !== 'undefined') {
        navigate(`/doctor/reports/${reportId}`)
      } else {
        console.error('Report ID is undefined, cannot navigate')
        setToastMessage('Report was signed, but report ID could not be determined.')
      }
    } catch (err) {
      setToastMessage(err.response?.data?.detail || 'Failed to digitally sign report.')
    } finally {
      setSigning(false)
    }
  }

  const isSigned = report?.status === 'signed' || report?.status === 'addendum'

  const handleSharePatient = () => {
    if (!isSigned) {
      setToastMessage('This report must be signed before proceeding to Share & Follow-up. Please sign the report first.')
      setSignModalOpen(true)
      return
    }
    navigate(`/doctor/scan/${module}/share/${scanId}`)
  }

  const handleReferSpecialist = () => {
    navigate(`/doctor/referrals?patientId=${report?.patient_id}&scanId=${scanId}`)
  }

  return (
    <DoctorLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 pb-20">
        {/* Stepper at top */}
        <ReportStepper currentStep={3} isSigned={isSigned} />

        {/* Patient Context Card */}
        <ReportPatientContextCard report={report} />

        {toastMessage && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-300 p-3 text-xs font-bold text-emerald-800 shadow-sm">
            {toastMessage}
          </div>
        )}

        {loading ? (
          <ScanResultsSkeleton />
        ) : error ? (
          <div className="rounded-xl border border-danger/30 bg-danger/10 p-8 text-center">
            <p className="text-base font-bold text-danger">Error Loading Report</p>
            <p className="mt-1 text-xs text-primary/70">{error}</p>
            <button
              type="button"
              onClick={() => navigate(`/doctor/scan/${module}/results/${scanId}`)}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white"
            >
              Return to Analysis Results
            </button>
          </div>
        ) : content ? (
          <>
            {/* Three Column Layout */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
              {/* Left Column: Sections Navigator (col-span-3) */}
              <div className="lg:col-span-3 sticky top-4">
                <ReportSectionsNav
                  activeSection={activeSection}
                  onSelectSection={handleSelectSection}
                  options={content.options || {}}
                  onOptionsChange={handleOptionsChange}
                  template={content.template || 'Standard Clinical Report'}
                  onTemplateChange={handleTemplateChange}
                  isPcos={module === 'pcos' || report?.module === 'pcos'}
                  module={module}
                />
              </div>

              {/* Center Column: Live Report Preview (col-span-6) */}
              <div className="lg:col-span-6">
                <ReportPreview
                  content={content}
                  reportNumber={report?.report_number}
                  status={report?.status}
                  sectionRefs={sectionRefs}
                  report={report}
                />
              </div>

              {/* Right Column: Edit Section Panel (col-span-3) */}
              <div className="lg:col-span-3 sticky top-4">
                <ReportEditSectionPanel
                  activeSection={activeSection}
                  content={content}
                  isSigned={isSigned}
                  onSignReport={() => setSignModalOpen(true)}
                  onViewSignedReport={() => {
                    const rId = report?.id || report?.report_id
                    if (rId && rId !== 'undefined') {
                      navigate(`/doctor/reports/${rId}`)
                    }
                  }}
                  onContentChange={handleContentChange}
                  onDownloadPdf={handleDownloadPdf}
                  onSaveDraft={handleSaveDraft}
                  onSharePatient={handleSharePatient}
                  onScheduleFollowup={() => setScheduleModalOpen(true)}
                  onReferSpecialist={handleReferSpecialist}
                  savingDraft={savingDraft}
                  downloadingPdf={downloadingPdf}
                />
              </div>
            </div>

            {/* Sign Report Button / View Signed Report (Prominent Bottom Banner) */}
            <div className="mt-8 rounded-2xl border-2 border-accent bg-surface p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-primary">
                  {report?.status === 'signed' || report?.status === 'addendum'
                    ? 'Report Digitally Signed & Locked'
                    : 'Finalize & Digitally Sign Report'}
                </h3>
                <p className="text-xs text-primary/60">
                  {report?.status === 'signed' || report?.status === 'addendum'
                    ? 'This report is permanently sealed with physician credentials and available in the clinical repository.'
                    : 'Digitally lock this report with physician registration credentials and produce an official auditable record.'}
                </p>
              </div>
              {report?.status === 'signed' || report?.status === 'addendum' ? (
                <button
                  type="button"
                  onClick={() => {
                    const rId = report?.id || report?.report_id
                    if (rId && rId !== 'undefined') {
                      navigate(`/doctor/reports/${rId}`)
                    } else {
                      console.error('Report ID is undefined, cannot navigate')
                    }
                  }}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-emerald-700"
                >
                  <ShieldCheck size={18} /> View Signed Report
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSignModalOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-accent/90"
                >
                  <ShieldCheck size={18} /> Sign Report
                </button>
              )}
            </div>
          </>
        ) : null}

        {/* Sign Report Modal */}
        {signModalOpen && (
          <SignReportModal
            reportNumber={report?.report_number}
            doctorName={report?.content?.patient_info?.referring_physician || 'Dr. Mehta'}
            registrationNumber="TNMC123456"
            onClose={() => setSignModalOpen(false)}
            onConfirm={handleSignConfirm}
            signing={signing}
          />
        )}

        {/* Schedule Followup Modal */}
        {scheduleModalOpen && (
          <ScheduleFollowupModal
            scanId={scanId}
            interval={report?.risk_level === 'high' ? 'within 1 month' : 'within 2-3 months'}
            patientName={report?.patient_name}
            onClose={() => setScheduleModalOpen(false)}
            onSuccess={() => setToastMessage('Follow-up scheduled successfully.')}
          />
        )}
      </div>
    </DoctorLayout>
  )
}

export default ScanReport
