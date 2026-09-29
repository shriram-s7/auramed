import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertOctagon,
  AlertTriangle,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileCheck,
  Lock,
  Mail,
  MessageSquare,
  Printer,
  Send,
  Share2,
  ShieldAlert,
  Smartphone,
  Sparkles,
  UserPlus,
} from 'lucide-react'
import DoctorLayout from '../../components/doctor/DoctorLayout'
import InitialsAvatar from '../../components/common/InitialsAvatar'
import RiskBadgeLarge from '../../components/doctor/scan-results/RiskBadgeLarge'
import ScanResultsSkeleton from '../../components/doctor/scan-results/ScanResultsSkeleton'
import ReportStepper from '../../components/doctor/report/ReportStepper'
import {
  fetchReportForScan,
  generateReportPdf,
  shareReportWithPatient,
} from '../../services/reportService'
import { getScanPrimaryImage } from '../../services/scanService'
import { scheduleAppointment } from '../../services/appointmentService'
import { triggerPdfDownload } from '../../utils/downloadPdf'

function ScanShare() {
  const { module = 'breast', scanId } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [report, setReport] = useState(null)
  const [primaryImage, setPrimaryImage] = useState(null)
  const [imageLoading, setImageLoading] = useState(true)

  // Section 2: Selected contents
  const [contents, setContents] = useState({
    patient_info: true,
    clinical_summary: true,
    imaging_findings: true,
    ai_results: true,
    risk_assessment: true,
    recommendations: true,
    reference_ranges: true,
  })

  // Section 3: Delivery Options
  const [sharePatient, setSharePatient] = useState(true)
  const [deliveryChannel, setDeliveryChannel] = useState('portal') // portal, email, sms
  const [sharePhysician, setSharePhysician] = useState(true)
  const [selectedPhysician, setSelectedPhysician] = useState('Dr. Mehta (Current Doctor)')
  const [patientMessage, setPatientMessage] = useState(
    'Your clinical screening analysis is complete. Please review the attached findings and follow-up plan.'
  )
  const [sharing, setSharing] = useState(false)
  const [sharedSuccess, setSharedSuccess] = useState(false)

  // Section 4: Schedule Follow-up
  const [followupType, setFollowupType] = useState('Biopsy recommended')
  const [followupDate, setFollowupDate] = useState('')
  const [followupNotes, setFollowupNotes] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const [scheduleSuccess, setScheduleSuccess] = useState(false)

  const [toastMsg, setToastMsg] = useState('')

  useEffect(() => {
    if (!scanId) return
    setLoading(true)
    setError(null)
    getScanPrimaryImage(scanId)
      .then((res) => {
        const img = res.data?.image_b64 || res.data?.image_url
        if (img) setPrimaryImage(img)
      })
      .catch((err) => {
        console.warn('Could not fetch primary scan image:', err)
      })
      .finally(() => setImageLoading(false))

    fetchReportForScan(scanId)
      .then((res) => {
        setReport(res.data)
        // Default follow-up date calculation
        const d = new Date()
        const risk = (res.data.risk_level || 'low').toLowerCase()
        if (risk === 'critical' || risk === 'high') {
          d.setDate(d.getDate() + 14)
          setFollowupType('Biopsy recommended')
        } else if (risk === 'moderate') {
          d.setDate(d.getDate() + 60)
          setFollowupType('Repeat diagnostic scan')
        } else {
          d.setDate(d.getDate() + 365)
          setFollowupType('Routine annual follow-up')
        }
        setFollowupDate(d.toISOString().slice(0, 10))
        setFollowupNotes(`Recommended interval follow-up for ${res.data.patient_name}`)
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'Failed to load report data.')
      })
      .finally(() => setLoading(false))
  }, [scanId])

  const handleToggleContent = (key) => {
    setContents((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSendReport = async () => {
    if (!report?.id || !isSigned) return
    setSharing(true)
    try {
      await shareReportWithPatient(report.id)
      setSharedSuccess(true)
      setToastMsg('Patient has been notified via patient portal!')
      setTimeout(() => setToastMsg(''), 4000)
    } catch (err) {
      setToastMsg('Failed to share report.')
    } finally {
      setSharing(false)
    }
  }

  const handleScheduleFollowup = async (e) => {
    e.preventDefault()
    if (!report?.patient_id || !followupDate) return
    setScheduling(true)
    try {
      await scheduleAppointment({
        patient_id: report.patient_id,
        scan_id: scanId,
        appointment_type: followupType,
        scheduled_date: followupDate,
        scheduled_time: '10:30',
        location: 'AuraMed Specialty Diagnostic Center - Suite 4',
        notes: followupNotes,
      })
      setScheduleSuccess(true)
      setToastMsg(`Follow-up appointment booked for ${followupDate}!`)
      setTimeout(() => setToastMsg(''), 4000)
    } catch (err) {
      setToastMsg('Failed to book follow-up appointment.')
    } finally {
      setScheduling(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!report?.id) return
    try {
      const response = await generateReportPdf(report.id)
      const filename = `AuraMed_${report.patient_name || 'Patient'}_${module.toUpperCase()}.pdf`
      triggerPdfDownload(response.data, filename)
      setToastMsg('PDF downloaded successfully.')
      setTimeout(() => setToastMsg(''), 3000)
    } catch (err) {
      setToastMsg('Failed to download PDF.')
    }
  }

  const patientName = report?.patient_name || 'Patient'
  const patientCode = report?.patient_code || '—'
  const patientId = report?.patient_id
  const riskLevel = report?.risk_level || 'high'
  const isSigned = report?.status === 'signed' || report?.status === 'addendum'
  const displayImage = primaryImage || report?.content?.imaging_findings?.primary_image || report?.content?.imaging_findings?.source_image

  return (
    <DoctorLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 pb-20">
        {/* Stepper with locked Step 4 if unsigned */}
        <ReportStepper currentStep={4} isSigned={isSigned} />

        {toastMsg && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-300 p-3 text-xs font-bold text-emerald-800 shadow-sm">
            ✓ {toastMsg}
          </div>
        )}

        {loading ? (
          <ScanResultsSkeleton />
        ) : error ? (
          <div className="rounded-xl border border-danger/30 bg-danger/10 p-8 text-center">
            <p className="text-base font-bold text-danger">Error Loading Share Data</p>
            <p className="mt-1 text-xs text-primary/70">{error}</p>
          </div>
        ) : report ? (
          <>
            {/* Top Three Column Layout */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* SECTION 1: Report Summary (Left) */}
              <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                    1. Report Summary
                  </h3>
                  <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                    REPORT READY
                  </span>
                </div>

                {/* Primary Scan Image Thumbnail */}
                <div className="relative h-36 w-full rounded-lg overflow-hidden border border-border bg-slate-900 flex items-center justify-center">
                  {imageLoading ? (
                    <div className="h-full w-full bg-slate-200 flex items-center justify-center">
                      <span className="text-xs text-slate-400 font-medium">Loading scan image...</span>
                    </div>
                  ) : displayImage ? (
                    <img
                      src={displayImage.startsWith('data:') || displayImage.startsWith('http') ? displayImage : `data:image/png;base64,${displayImage}`}
                      alt="Diagnostic Scan"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="h-full w-full bg-slate-100 flex items-center justify-center text-primary/40 text-xs">
                      Scan image unavailable
                    </div>
                  )}
                  <div className="absolute bottom-1.5 left-2 rounded bg-black/70 px-2 py-0.5 font-mono text-[10px] text-white">
                    SCAN REF: {report.report_number || `SCN-${scanId?.slice(0, 8)?.toUpperCase()}`}
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-primary/50">Report Type</span>
                    <span className="font-semibold text-primary">{report.content?.template || 'Standard Clinical'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-primary/50">Patient Name</span>
                    <span className="font-bold text-primary">{patientName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-primary/50">Patient ID</span>
                    <span className="font-mono text-primary">{patientCode}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-primary/50">Scan Date</span>
                    <span className="text-primary">{report.content?.patient_info?.date_of_scan || 'Today'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-primary/50">Indication</span>
                    <span className="text-primary truncate max-w-[150px]">{report.content?.patient_info?.indication}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50 items-center">
                    <span className="text-primary/50">Final Risk Level</span>
                    <RiskBadgeLarge level={riskLevel} size="md" />
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-primary/50">AI Confidence</span>
                    <span className="font-mono font-bold text-accent">88% (High)</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-primary/50">Referring Physician</span>
                    <span className="text-primary">{report.content?.patient_info?.referring_physician || 'Dr. Mehta'}</span>
                  </div>
                </div>

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
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2 text-xs font-semibold text-primary hover:bg-slate-100"
                >
                  <Eye size={13} className="text-accent" /> Preview Full Report
                </button>
              </div>

              {/* SECTION 2: Select Report Contents (Center) */}
              <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
                <div className="border-b border-border pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                    2. Select Report Contents
                  </h3>
                  <p className="text-[11px] text-primary/50 mt-0.5">Customize what data sections to include</p>
                </div>

                <div className="space-y-3 text-xs">
                  {[
                    { key: 'patient_info', label: 'Patient information', desc: 'Demographics, ID, referring doctor' },
                    { key: 'clinical_summary', label: 'Clinical summary', desc: 'Clinical factor analysis and patient history' },
                    { key: 'imaging_findings', label: 'Imaging findings with key images', desc: 'Diagnostic views and AI bounding focus area' },
                    { key: 'ai_results', label: 'AI analysis results', desc: 'Neural network scores and model interpretations' },
                    { key: 'risk_assessment', label: 'Risk assessment & interpretation', desc: 'Final stratified risk level category' },
                    { key: 'recommendations', label: 'Recommendations', desc: 'Clinical follow-up interval and treatment guidance' },
                    { key: 'reference_ranges', label: 'Reference ranges & methodology', desc: 'Model confidence parameters and formulas' },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex items-start justify-between p-2 rounded-lg border border-border/70 hover:bg-slate-50 cursor-pointer select-none"
                    >
                      <div className="pr-2">
                        <p className="font-semibold text-primary">{item.label}</p>
                        <p className="text-[10px] text-primary/50">{item.desc}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={contents[item.key]}
                        onChange={() => handleToggleContent(item.key)}
                        className="h-4 w-4 mt-0.5 rounded border-border text-accent focus:ring-accent"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* SECTION 3: Share Report (Right) */}
              <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
                <div className="border-b border-border pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                    3. Share Report
                  </h3>
                  <p className="text-[11px] text-primary/50 mt-0.5">Delivery channel and physician routing</p>
                </div>

                {/* Workflow Gate: Unsigned Warning */}
                {!isSigned && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 shadow-sm flex items-start gap-2.5">
                    <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2 flex-1">
                      <p className="font-bold text-amber-950">Signing Required Before Sharing</p>
                      <p className="text-amber-800 leading-relaxed">
                        This report must be signed before it can be shared with the patient or referring physician. Please go back to Sign &amp; Lock the report first.
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate(`/doctor/scan/${module}/report/${scanId}`)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-800 transition"
                      >
                        Go to Sign &amp; Lock Report
                      </button>
                    </div>
                  </div>
                )}

                {/* Patient toggle & Delivery Options */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-primary">Share with patient</label>
                    <input
                      type="checkbox"
                      checked={sharePatient}
                      onChange={(e) => setSharePatient(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                    />
                  </div>

                  {sharePatient && (
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setDeliveryChannel('portal')}
                        className={`flex flex-col items-center gap-1 rounded-lg border py-2 text-[10px] font-bold transition ${
                          deliveryChannel === 'portal'
                            ? 'border-accent bg-accent/10 text-accent ring-1 ring-accent'
                            : 'border-border bg-background text-primary/70 hover:bg-slate-100'
                        }`}
                      >
                        <Share2 size={13} />
                        <span>Patient Portal</span>
                      </button>

                      <button
                        type="button"
                        disabled
                        title="Email delivery coming soon"
                        className="flex flex-col items-center gap-1 rounded-lg border border-border/60 bg-slate-50 py-2 text-[10px] font-medium text-primary/40 cursor-not-allowed"
                      >
                        <Mail size={13} />
                        <span>Email</span>
                        <span className="text-[9px] px-1.5 py-0.2 bg-slate-200 text-slate-600 rounded-full font-semibold">Coming soon</span>
                      </button>

                      <button
                        type="button"
                        disabled
                        title="SMS delivery coming soon"
                        className="flex flex-col items-center gap-1 rounded-lg border border-border/60 bg-slate-50 py-2 text-[10px] font-medium text-primary/40 cursor-not-allowed"
                      >
                        <Smartphone size={13} />
                        <span>SMS Link</span>
                        <span className="text-[9px] px-1.5 py-0.2 bg-slate-200 text-slate-600 rounded-full font-semibold">Coming soon</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Share with Referring Physician */}
                <div className="space-y-1.5 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-primary">Share with referring physician</label>
                    <input
                      type="checkbox"
                      checked={sharePhysician}
                      onChange={(e) => setSharePhysician(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                    />
                  </div>
                  {sharePhysician && (
                    <select
                      value={selectedPhysician}
                      onChange={(e) => setSelectedPhysician(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-primary focus:border-accent focus:bg-surface focus:outline-none"
                    >
                      <option value="Dr. Mehta (Current Doctor)">Dr. Mehta (Current Doctor)</option>
                      <option value="Dr. Kavitha Suresh (Oncologist)">Dr. Kavitha Suresh (Oncologist)</option>
                      <option value="Dr. Rajesh Raman (Gynecologist)">Dr. Rajesh Raman (Gynecologist)</option>
                      <option value="+ Add another physician...">+ Add another physician...</option>
                    </select>
                  )}
                </div>

                {/* Optional message textarea */}
                <div className="space-y-1 pt-2 border-t border-border">
                  <div className="flex justify-between text-xs text-primary/60">
                    <label className="font-semibold text-primary">Optional Message to Patient</label>
                    <span className="font-mono text-[10px]">{patientMessage.length}/500</span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={patientMessage}
                    onChange={(e) => setPatientMessage(e.target.value)}
                    className="w-full rounded-md border border-border bg-background p-2.5 text-xs text-primary focus:border-accent focus:bg-surface focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  disabled={sharing || !isSigned}
                  onClick={handleSendReport}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-xs font-bold text-white shadow transition hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send size={14} />
                  {sharing ? 'Sending Delivery...' : !isSigned ? 'Report Must Be Signed First' : 'Send Report'}
                </button>

                {sharedSuccess && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-300 p-2.5 text-center text-xs font-bold text-emerald-800">
                    ✓ Patient has been notified via patient portal
                  </div>
                )}
              </div>
            </div>


            {/* Bottom Three Sections Layout */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
              {/* SECTION 4: Schedule Follow-up (Bottom Left) */}
              <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
                <div className="border-b border-border pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                    4. Schedule Follow-up
                  </h3>
                  <p className="text-[11px] text-primary/50 mt-0.5">Recommended based on AI risk stratification</p>
                </div>

                <form onSubmit={handleScheduleFollowup} className="space-y-3 text-xs">
                  <div>
                    <label className="font-semibold text-primary/70">Follow-up Type</label>
                    <select
                      value={followupType}
                      onChange={(e) => setFollowupType(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-primary focus:border-accent focus:bg-surface focus:outline-none"
                    >
                      <option value="Biopsy recommended">Biopsy recommended (High Risk)</option>
                      <option value="Repeat diagnostic scan">Repeat scan (Moderate Risk)</option>
                      <option value="Routine annual follow-up">Routine follow-up (Low Risk)</option>
                      <option value="Specialist consultation">Specialist consultation</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-primary/70">Preferred Date</label>
                    <input
                      type="date"
                      required
                      value={followupDate}
                      onChange={(e) => setFollowupDate(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-primary focus:border-accent focus:bg-surface focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-primary/70">Clinical Notes</label>
                    <textarea
                      rows={2}
                      value={followupNotes}
                      onChange={(e) => setFollowupNotes(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border bg-background p-2 text-xs text-primary focus:border-accent focus:bg-surface focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={scheduling}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-bold text-white transition hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Calendar size={13} />
                    {scheduling ? 'Scheduling...' : 'Schedule Follow-up'}
                  </button>

                  {scheduleSuccess && (
                    <p className="text-center font-bold text-emerald-600 text-xs">
                      ✓ Appointment successfully created!
                    </p>
                  )}
                </form>
              </div>

              {/* SECTION 5: Additional Actions (Bottom Center) */}
              <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
                <div className="border-b border-border pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                    5. Additional Actions
                  </h3>
                  <p className="text-[11px] text-primary/50 mt-0.5">Clinical workflow shortcuts</p>
                </div>

                <div className="space-y-2 text-xs">
                  <button
                    type="button"
                    onClick={() => navigate(`/doctor/referrals/new/${patientId}`)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:bg-slate-100 transition"
                  >
                    <span className="font-semibold text-primary flex items-center gap-2">
                      <UserPlus size={14} className="text-purple-600" /> Refer to Specialist
                    </span>
                    <ChevronRight size={14} className="text-primary/40" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setToastMsg('Record automatically synchronized with EHR.')}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:bg-slate-100 transition"
                  >
                    <span className="font-semibold text-primary flex items-center gap-2">
                      <FileCheck size={14} className="text-emerald-600" /> Add to Patient Records (auto)
                    </span>
                    <ChevronRight size={14} className="text-primary/40" />
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:bg-slate-100 transition"
                  >
                    <span className="font-semibold text-primary flex items-center gap-2">
                      <Printer size={14} className="text-primary/60" /> Print Report
                    </span>
                    <ChevronRight size={14} className="text-primary/40" />
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:bg-slate-100 transition"
                  >
                    <span className="font-semibold text-primary flex items-center gap-2">
                      <Download size={14} className="text-accent" /> Download Report PDF
                    </span>
                    <ChevronRight size={14} className="text-primary/40" />
                  </button>

                  {riskLevel === 'CRITICAL' && (
                    <button
                      type="button"
                      onClick={() => setToastMsg('Case flagged for Multidisciplinary Tumor Board.')}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-danger/30 bg-danger/5 hover:bg-danger/10 transition"
                    >
                      <span className="font-bold text-danger flex items-center gap-2">
                        <AlertOctagon size={14} /> Mark Case for Tumor Board
                      </span>
                      <ChevronRight size={14} className="text-danger" />
                    </button>
                  )}
                </div>
              </div>

              {/* FOLLOW-UP TIMELINE (Bottom Right) */}
              <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
                <div className="border-b border-border pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                    Follow-up Timeline
                  </h3>
                  <p className="text-[11px] text-primary/50 mt-0.5">Clinical workflow progression</p>
                </div>

                <div className="space-y-4 text-xs pl-2">
                  <div className="flex items-start gap-3">
                    <span className="h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-primary">Today: Scan & Analysis Completed</p>
                      <p className="text-[11px] text-primary/50">Multimodal AI and clinical risk calculated</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="h-3 w-3 rounded-full bg-blue-500 ring-4 ring-blue-100 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-primary">Today: Report Generated</p>
                      <p className="text-[11px] text-primary/50">Clinical findings documented by physician</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="h-3 w-3 rounded-full bg-slate-300 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-primary/70">
                        {followupDate || 'Target Date'}: Scheduled Follow-up
                      </p>
                      <p className="text-[11px] text-primary/40">{followupType}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="h-3 w-3 rounded-full bg-slate-300 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-primary/70">Pending: Specialist Consultation</p>
                      <p className="text-[11px] text-primary/40">Clinical correlation & histopathology</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center text-xs font-bold text-emerald-800">
                  ✓ Report shared successfully
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </DoctorLayout>
  )
}

export default ScanShare
