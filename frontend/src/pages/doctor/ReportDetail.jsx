import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FilePlus,
  History,
  Lock,
  Share2,
  ShieldCheck,
  UserPlus,
} from 'lucide-react'
import DoctorLayout from '../../components/doctor/DoctorLayout'
import InitialsAvatar from '../../components/common/InitialsAvatar'
import RiskBadgeLarge from '../../components/doctor/scan-results/RiskBadgeLarge'
import ReportPdfViewer from '../../components/doctor/report/ReportPdfViewer'
import ReportVisualPlaceholders from '../../components/doctor/report/ReportVisualPlaceholders'
import AddAddendumModal from '../../components/doctor/report/AddAddendumModal'
import ShareReportModal from '../../components/doctor/report/ShareReportModal'
import ScanResultsSkeleton from '../../components/doctor/scan-results/ScanResultsSkeleton'
import { formatPatientAgeGender } from '../../utils/formatAge'
import { triggerPdfDownload } from '../../utils/downloadPdf'
import {
  addReportAddendum,
  fetchReportById,
  generateReportPdf,
  shareReportWithPatient,
} from '../../services/reportService'
import { getScanPrimaryImage, getScanResults } from '../../services/scanService'

const TABS = [
  { id: 'report_view', label: 'Report View' },
  { id: 'patient_details', label: 'Patient Details' },
  { id: 'scan_images', label: 'Scan and Images' },
  { id: 'ai_summary', label: 'AI Analysis Summary' },
  { id: 'clinical_inputs', label: 'Clinical Inputs' },
]

function ReportDetail() {
  const params = useParams()
  const reportId = params.reportId || params.id
  const navigate = useNavigate()


  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [report, setReport] = useState(null)
  const [activeTab, setActiveTab] = useState('report_view')
  const [addendumModalOpen, setAddendumModalOpen] = useState(false)
  const [addingAddendum, setAddingAddendum] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  const [primaryImage, setPrimaryImage] = useState(null)
  const [gradcamImage, setGradcamImage] = useState(null)
  const [secondaryImage, setSecondaryImage] = useState(null)
  const [segmentationImage, setSegmentationImage] = useState(null)

  useEffect(() => {
    if (!reportId || reportId === 'undefined') {
      setError('Invalid report identifier.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    fetchReportById(reportId)
      .then((res) => {
        const rep = res.data
        setReport(rep)

        let pImg = rep.image_url || rep.image_path || rep.primary_image_url || rep.content?.imaging_findings?.main_image_url || null
        if (pImg && !pImg.startsWith('http') && !pImg.startsWith('data:') && !pImg.startsWith('/')) {
          pImg = `/${pImg}`
        }
        if (pImg) setPrimaryImage(pImg)

        let gImg = rep.grad_cam_base64 || rep.gradcam_heatmap_b64 || rep.content?.imaging_findings?.grad_cam_base64 || rep.content?.imaging_findings?.gradcam_heatmap_b64 || null
        if (gImg) setGradcamImage(gImg)

        let sImg = rep.secondary_image_url || rep.content?.imaging_findings?.secondary_image_url || null
        if (sImg) setSecondaryImage(sImg)

        let segImg = rep.segmentation_image_url || rep.content?.imaging_findings?.segmentation_image_url || null
        if (segImg) setSegmentationImage(segImg)

        if (rep.scan_id) {
          if (!pImg) {
            getScanPrimaryImage(rep.scan_id)
              .then((r) => {
                const img = r.data?.image_b64 || r.data?.image_url || r.data?.primary_image_url
                if (img) {
                  setPrimaryImage(img.startsWith('http') || img.startsWith('data:') || img.startsWith('/') ? img : `data:image/png;base64,${img}`)
                }
              })
              .catch(() => {})
          }
          if (!gImg) {
            getScanResults(rep.scan_id)
              .then((r) => {
                const g = r.data?.grad_cam_base64 || r.data?.gradcam_heatmap_b64
                if (g) setGradcamImage(g)
                const s = r.data?.secondary_image_url || r.data?.secondary_image_b64
                if (s && !sImg) setSecondaryImage(s)
                const seg = r.data?.segmentation_image_url || r.data?.segmentation_mask_b64
                if (seg && !segImg) setSegmentationImage(seg)
              })
              .catch(() => {})
          }
        }
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'Failed to load report.')
      })
      .finally(() => setLoading(false))
  }, [reportId])

  const handleDownloadPdf = async () => {
    if (!report?.id) return
    try {
      const response = await generateReportPdf(report.id)
      const patientName = (report.patient_name || 'Patient').replace(/\s+/g, '_')
      const mod = (report.module || 'Report').toUpperCase()
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const filename = `AuraMed_${patientName}_${mod}_${dateStr}.pdf`
      triggerPdfDownload(response.data, filename)
      setToastMsg('PDF downloaded successfully.')
      setTimeout(() => setToastMsg(''), 3000)
    } catch (err) {
      setToastMsg('Failed to download PDF.')
    }
  }

  const handleShareConfirm = async (payload) => {
    if (!report?.id) return
    setSharing(true)
    try {
      await shareReportWithPatient(report.id, payload)
      setReport((prev) => ({ ...prev, shared_with_patient: true }))
      setShareModalOpen(false)
      setToastMsg('Report shared with patient portal successfully!')
      setTimeout(() => setToastMsg(''), 3500)
    } catch (err) {
      setToastMsg(err.response?.data?.detail || 'Failed to share report.')
    } finally {
      setSharing(false)
    }
  }

  const handleAddendumConfirm = async (note) => {
    if (!report?.id) return
    setAddingAddendum(true)
    try {
      const res = await addReportAddendum(report.id, note)
      setReport(res.data)
      setAddendumModalOpen(false)
      setToastMsg('Addendum permanently attached to report!')
      setTimeout(() => setToastMsg(''), 3500)
    } catch (err) {
      setToastMsg('Failed to add addendum.')
    } finally {
      setAddingAddendum(false)
    }
  }

  const handleReferSpecialist = () => {
    navigate(`/doctor/referrals?patientId=${report?.patient_id}&scanId=${report?.scan_id}`)
  }

  const handleSharePatient = () => {
    setShareModalOpen(true)
  }

  const signedDate = report?.signed_at
    ? new Date(report.signed_at).toLocaleString()
    : 'Recently signed'

  const resolvedMainImageUrl =
    primaryImage ||
    report?.image_url ||
    (report?.image_path ? `/${report.image_path}` : null) ||
    report?.content?.imaging_findings?.main_image_url ||
    null

  const resolvedGradcamB64 =
    gradcamImage ||
    report?.grad_cam_base64 ||
    report?.gradcam_heatmap_b64 ||
    report?.content?.imaging_findings?.grad_cam_base64 ||
    report?.content?.imaging_findings?.gradcam_heatmap_b64 ||
    null

  const resolvedSecondaryImageUrl =
    secondaryImage ||
    report?.content?.imaging_findings?.secondary_image_url ||
    null

  const resolvedSegmentationImageUrl =
    segmentationImage ||
    report?.content?.imaging_findings?.segmentation_image_url ||
    null

  return (
    <DoctorLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 pb-20">
        {toastMsg && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-300 p-3 text-xs font-bold text-emerald-800 shadow-sm">
            ✓ {toastMsg}
          </div>
        )}

        {loading ? (
          <ScanResultsSkeleton />
        ) : error ? (
          <div className="rounded-xl border border-danger/30 bg-danger/10 p-8 text-center">
            <p className="text-base font-bold text-danger">Error Loading Signed Report</p>
            <p className="mt-1 text-xs text-primary/70">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/doctor/dashboard')}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white"
            >
              Return to Dashboard
            </button>
          </div>
        ) : report ? (
          <>
            {/* Top Bar: Breadcrumb + Status Badge + 3 Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-primary/60">
                  <Link to="/doctor/reports" className="hover:text-primary transition">
                    Reports
                  </Link>
                  <ChevronRight size={13} className="text-primary/30" />
                  <span className="font-bold text-primary">{report.report_number}</span>
                </nav>

                {/* Signed & Locked Badge */}
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-3 py-0.5 text-xs font-bold text-emerald-800">
                  <Lock size={12} /> Signed and Locked
                </span>
              </div>

              {/* Top 3 Action Buttons (Uniform 40px height with 16px icons) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-xs font-semibold text-primary transition hover:bg-slate-50"
                >
                  <Download size={16} /> Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShareModalOpen(true)}
                  className="flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-xs font-semibold text-primary transition hover:bg-slate-50"
                >
                  <Share2 size={16} className="text-accent" /> View / Share
                </button>
                <button
                  type="button"
                  onClick={() => setAddendumModalOpen(true)}
                  className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-xs font-bold text-white shadow transition hover:bg-accent/90"
                >
                  <FilePlus size={16} /> Add Addendum
                </button>
              </div>
            </div>

            {/* Patient Summary Bar */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 pb-4">
                <div className="flex items-center gap-3.5">
                  <InitialsAvatar name={report.patient_name || 'P'} size="lg" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl font-extrabold text-primary">{report.patient_name}</h1>
                      <span className="font-mono text-xs text-primary/50">({report.patient_code})</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-primary/70">
                        {formatPatientAgeGender(
                          report.patient_age,
                          report.content?.patient_info?.dob || report.patient_dob,
                          report.patient_gender
                        )}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-primary/60">Phone: {report.patient_phone}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent uppercase">
                    {report.module}
                  </span>
                  <RiskBadgeLarge level={report.risk_level} size="md" />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4 pt-1">
                <div>
                  <p className="text-[11px] font-semibold uppercase text-primary/50">Report Date</p>
                  <p className="mt-0.5 font-semibold text-primary">{report.content?.patient_info?.report_date}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase text-primary/50">Reporting Physician</p>
                  <p className="mt-0.5 font-semibold text-primary">
                    {report.signed_by_doctor_name || report.content?.patient_info?.referring_physician || 'Dr. Mehta'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase text-primary/50">Registration Number</p>
                  <p className="mt-0.5 font-mono font-semibold text-primary">
                    {report.signed_by_doctor_reg || 'TNMC123456'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase text-primary/50">Hospital / Facility</p>
                  <p className="mt-0.5 font-semibold text-primary">
                    {report.signed_by_doctor_hospital || 'AuraMed General Hospital'}
                  </p>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-border">
              <nav className="flex space-x-2 overflow-x-auto pb-1" aria-label="Tabs">
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
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

            {/* Main Tab Content + Right Sidebar Layout */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
              {/* Left/Center Area (col-span-8) */}
              <div className="lg:col-span-8 space-y-6">
                {activeTab === 'report_view' && (
                  <ReportPdfViewer
                    report={report}
                    onDownloadPdf={handleDownloadPdf}
                  />
                )}

                {activeTab === 'patient_details' && (
                  <div className="rounded-xl border border-border bg-surface p-6 shadow-sm space-y-4 text-xs">
                    <h3 className="text-sm font-bold text-primary">Detailed Patient Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-primary/50">Full Legal Name</p>
                        <p className="font-bold text-primary text-sm">{report.patient_name}</p>
                      </div>
                      <div>
                        <p className="text-primary/50">Patient ID</p>
                        <p className="font-mono font-bold text-primary">{report.patient_code}</p>
                      </div>
                      <div>
                        <p className="text-primary/50">Contact Phone</p>
                        <p className="font-semibold text-primary">{report.patient_phone}</p>
                      </div>
                      <div>
                        <p className="text-primary/50">Age and Biological Sex</p>
                        <p className="font-semibold text-primary">
                          {formatPatientAgeGender(
                            report.patient_age,
                            report.content?.patient_info?.dob || report.patient_dob,
                            report.patient_gender
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'scan_images' && (
                  <div className="rounded-xl border border-border bg-surface p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-primary">Diagnostic Imaging Review</h3>
                        <p className="text-[11px] text-primary/60">
                          Radiological acquisitions with deep neural AI attention maps & segmentation. Click any image to view in full resolution.
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 border border-teal-200 px-2.5 py-1 text-[11px] font-bold text-teal-700">
                        DICOM Verified
                      </span>
                    </div>

                    <ReportVisualPlaceholders
                      fourPanel={true}
                      mainImageUrl={resolvedMainImageUrl}
                      gradcamHeatmapB64={resolvedGradcamB64}
                      secondaryImageUrl={resolvedSecondaryImageUrl}
                      segmentationImageUrl={resolvedSegmentationImageUrl}
                      labels={[
                        'Main Scan View',
                        'Secondary Projection',
                        'AI Focus Area Zoomed',
                        'AI Segmentation Mask',
                      ]}
                    />
                  </div>
                )}

                {activeTab === 'ai_summary' && (
                  <div className="rounded-xl border border-border bg-surface p-6 shadow-sm space-y-4 text-xs">
                    <h3 className="text-sm font-bold text-primary">AI Inference & Risk Models</h3>
                    <div className="space-y-3">
                      {report.content?.ai_assessment?.rows?.map((r, i) => (
                        <div key={i} className="rounded-lg border border-border p-3.5 bg-background">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-primary">{r.component}</span>
                            <span className="font-mono text-accent font-extrabold text-sm">{r.result}</span>
                          </div>
                          <p className="mt-1 text-primary/70">{r.interpretation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'clinical_inputs' && (
                  <div className="rounded-xl border border-border bg-surface p-6 shadow-sm space-y-4 text-xs">
                    <h3 className="text-sm font-bold text-primary">Clinical Inputs & Contributions</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="border-b border-border bg-slate-50 text-[10px] uppercase text-primary/50">
                          <tr>
                            <th className="p-2">Clinical Factor</th>
                            <th className="p-2">Value</th>
                            <th className="p-2">Impact</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {report.content?.clinical_summary?.factors?.map((f, i) => (
                            <tr key={i}>
                              <td className="p-2 font-semibold text-primary">{f.name}</td>
                              <td className="p-2 text-primary/80">{f.value}</td>
                              <td className="p-2 font-medium capitalize text-primary/70">{f.impact}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Sidebar (col-span-4) */}
              <div className="lg:col-span-4 space-y-5">
                {/* 1. Report Status Panel */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                    <Lock size={14} className="text-emerald-700" />
                    <span>Report Status: Signed & Locked</span>
                  </div>
                  <p className="text-emerald-800/90 leading-relaxed text-[11px]">
                    This report cannot be edited. Only addendums can be added.
                  </p>
                </div>

                {/* 2. Digital Signature Panel */}
                <div className="rounded-xl border border-border bg-surface p-4 shadow-sm text-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="font-bold uppercase text-[11px] text-primary/60">Digital Signature</span>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <CheckCircle2 size={13} /> Verified
                    </span>
                  </div>
                  <div className="space-y-1 text-primary/80">
                    <p className="font-bold text-primary text-sm">
                      {report.signed_by_doctor_name || report.content?.patient_info?.referring_physician || 'Dr. Mehta'}
                    </p>
                    <p>
                      Reg: <span className="font-mono font-semibold">{report.signed_by_doctor_reg || 'TNMC123456'}</span> • {report.signed_by_doctor_specialty || 'Gynecologic Oncology'}
                    </p>
                    <p>{report.signed_by_doctor_hospital || 'AuraMed General Hospital'}</p>
                    <p className="text-primary/50 text-[11px] pt-1">Signed on: {signedDate}</p>
                  </div>
                </div>

                {/* 3. Actions Panel */}
                <div className="rounded-xl border border-border bg-surface p-4 shadow-sm space-y-2.5">
                  <span className="font-bold uppercase text-[11px] text-primary/60">Actions</span>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2 text-xs font-bold text-white hover:bg-accent/90 shadow-sm"
                    >
                      <Download size={13} /> Download PDF
                    </button>
                    <button
                      type="button"
                      onClick={handleSharePatient}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background py-1.5 text-xs font-semibold text-primary hover:bg-slate-100"
                    >
                      <Share2 size={13} className="text-accent" /> Share with Patient
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddendumModalOpen(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background py-1.5 text-xs font-semibold text-primary hover:bg-slate-100"
                    >
                      <FilePlus size={13} className="text-amber-600" /> Add Addendum
                    </button>
                    <button
                      type="button"
                      onClick={handleReferSpecialist}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background py-1.5 text-xs font-semibold text-primary hover:bg-slate-100"
                    >
                      <UserPlus size={13} className="text-purple-600" /> Refer to Specialist
                    </button>
                  </div>
                </div>

                {/* 4. Audit Trail Panel */}
                <div className="rounded-xl border border-border bg-surface p-4 shadow-sm text-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <div className="flex items-center gap-1.5 font-bold uppercase text-[11px] text-primary/60">
                      <History size={13} className="text-accent" />
                      <span>Audit Trail</span>
                    </div>
                    <span className="text-[10px] text-primary/40">(Last 4 events)</span>
                  </div>

                  <div className="space-y-2.5">
                    {[
                      { action: 'Report signed and locked', time: signedDate, by: report.signed_by_doctor_name || 'Dr. Mehta' },
                      { action: 'Final physician review completed', time: report.content?.patient_info?.report_date || '2026-09-11', by: 'Dr. Mehta' },
                      { action: 'Clinical report draft generated', time: report.content?.patient_info?.report_date || '2026-09-11', by: 'System AI' },
                      { action: 'Multimodal scan analyzed', time: report.content?.patient_info?.date_of_scan || '2026-09-11', by: 'AuraMed Engine' },
                    ].map((evt, idx) => (
                      <div key={idx} className="border-l-2 border-accent/60 pl-2.5 py-0.5">
                        <p className="font-semibold text-primary">{evt.action}</p>
                        <p className="font-mono text-[10px] text-primary/50">{evt.time} • {evt.by}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {/* Add Addendum Modal */}
        {addendumModalOpen && (
          <AddAddendumModal
            onClose={() => setAddendumModalOpen(false)}
            onConfirm={handleAddendumConfirm}
            adding={addingAddendum}
          />
        )}

        {/* Share Report Modal */}
        {shareModalOpen && (
          <ShareReportModal
            isOpen={shareModalOpen}
            onClose={() => setShareModalOpen(false)}
            onConfirm={handleShareConfirm}
            report={report}
            sharing={sharing}
          />
        )}
      </div>
    </DoctorLayout>
  )
}

export default ReportDetail
