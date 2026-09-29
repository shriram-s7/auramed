import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  UserCheck,
  Send,
  Building2,
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronRight,
  Search,
  Filter,
  ShieldCheck,
  User,
  Phone,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  Info,
  Check,
  ArrowLeft,
  X,
  Stethoscope,
  Share2
} from 'lucide-react'
import {
  fetchSpecialists,
  fetchPatientReferralContext,
  createReferral
} from '../../services/referralService'
import { fetchPatients } from '../../services/patientService'

export default function DoctorReferralNew() {
  const { patientId } = useParams()
  const navigate = useNavigate()

  // State
  const [loading, setLoading] = useState(true)
  const [patientContext, setPatientContext] = useState(null)
  const [allPatients, setAllPatients] = useState([])
  const [specialists, setSpecialists] = useState([])

  // Section 1: Referral Details
  const [specialty, setSpecialty] = useState('Surgical Oncology')
  const [reason, setReason] = useState('')
  const [priority, setPriority] = useState('urgent') // 'routine' | 'urgent' | 'emergency'

  // Section 2: Attachments & Notes
  const [attachScans, setAttachScans] = useState(true)
  const [attachAiSummary, setAttachAiSummary] = useState(true)
  const [attachReport, setAttachReport] = useState(true)
  const [clinicalNotes, setClinicalNotes] = useState('')

  // Section 3: Select Specialist
  const [specialistTab, setSpecialistTab] = useState('internal') // 'internal' | 'external'
  const [selectedSpecialist, setSelectedSpecialist] = useState(null)
  const [specialistSearch, setSpecialistSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState('all')

  // External specialist fields
  const [externalSpecialist, setExternalSpecialist] = useState({
    name: '',
    hospital: '',
    department: '',
    email: '',
    phone: ''
  })

  // Specialist Profile Modal
  const [profileSpecialist, setProfileSpecialist] = useState(null)

  // Status & Feedback
  const [actionLoading, setActionLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)
  const [referralSent, setReferralSent] = useState(false)
  const [sentReferralId, setSentReferralId] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToastMessage({ text: msg, type })
    setTimeout(() => setToastMessage(null), 4500)
  }

  // Load specialists catalog
  useEffect(() => {
    fetchSpecialists()
      .then(res => {
        const specs = res.data || []
        setSpecialists(specs)
        if (specs.length > 0 && !selectedSpecialist) {
          setSelectedSpecialist(specs[0])
        }
      })
      .catch(err => console.error('Failed to load specialists:', err))
  }, [])

  // Load patient context
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        if (patientId) {
          const res = await fetchPatientReferralContext(patientId)
          const data = res.data
          setPatientContext(data)
          if (data.suggested_reason) {
            setReason(data.suggested_reason)
          }
          if (data.risk_level === 'high' || data.risk_level === 'critical') {
            setPriority('urgent')
          }
        } else {
          // If no patientId is in URL, fetch list and pick first
          const pRes = await fetchPatients({ page_size: 20 })
          const pts = pRes.data?.items || []
          setAllPatients(pts)
          if (pts.length > 0) {
            const firstId = pts[0].id
            const ctxRes = await fetchPatientReferralContext(firstId)
            setPatientContext(ctxRes.data)
            if (ctxRes.data.suggested_reason) {
              setReason(ctxRes.data.suggested_reason)
            }
          }
        }
      } catch (err) {
        console.error('Error loading patient context:', err)
        showToast('Could not load patient referral context', 'error')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [patientId])

  // If user changes patient from dropdown
  const handleSelectDifferentPatient = async newPid => {
    try {
      setLoading(true)
      const res = await fetchPatientReferralContext(newPid)
      setPatientContext(res.data)
      if (res.data.suggested_reason) {
        setReason(res.data.suggested_reason)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Filtered specialists
  const filteredSpecialists = useMemo(() => {
    return specialists.filter(s => {
      const matchSearch =
        s.name.toLowerCase().includes(specialistSearch.toLowerCase()) ||
        s.specialty.toLowerCase().includes(specialistSearch.toLowerCase()) ||
        s.hospital.toLowerCase().includes(specialistSearch.toLowerCase())
      const matchLoc =
        locationFilter === 'all' || s.hospital.toLowerCase().includes(locationFilter.toLowerCase())
      return matchSearch && matchLoc
    })
  }, [specialists, specialistSearch, locationFilter])

  // Handle selecting a specialist
  const handleSelectSpecialist = spec => {
    setSelectedSpecialist(spec)
    if (spec.specialty) {
      setSpecialty(spec.specialty)
    }
  }

  // Submit referral
  const handleSendReferral = async (isDraft = false) => {
    if (!patientContext) return
    if (!reason.trim()) {
      showToast('Please enter the clinical reason for referral', 'error')
      return
    }

    const targetSpecName =
      specialistTab === 'internal'
        ? (selectedSpecialist?.name || 'Assigned Specialist')
        : (externalSpecialist.name || 'External Specialist')

    try {
      setActionLoading(true)
      const payload = {
        patient_id: patientContext.patient_id,
        to_specialist: targetSpecName,
        specialty,
        reason: reason.trim(),
        priority,
        attachments: {
          scans_and_images: attachScans,
          ai_analysis_summary: attachAiSummary,
          clinical_report: attachReport,
          report_id: patientContext.report_id,
          report_number: patientContext.report_number
        },
        notes: clinicalNotes.trim() || undefined
      }

      const res = await createReferral(payload)
      setSentReferralId(res.data?.id || 'REF-NEW')
      setReferralSent(true)
      showToast(isDraft ? 'Referral saved as draft' : 'Referral sent to specialist successfully!')
    } catch (err) {
      console.error('Failed to create referral:', err)
      showToast('Failed to dispatch referral to specialist', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const getRiskBadge = risk => {
    const r = (risk || 'low').toLowerCase()
    if (r === 'high' || r === 'critical') {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">High Risk</span>
    }
    if (r === 'moderate') {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">Moderate Risk</span>
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Low Risk</span>
  }

  if (loading && !patientContext) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Loading patient clinical context & specialist catalog...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center space-x-2 transition-all ${
          toastMessage.type === 'error'
            ? 'bg-rose-50 text-rose-800 border-rose-200'
            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
        }`}>
          {toastMessage.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium mb-1">
            <Link to="/doctor/referrals" className="hover:text-teal-700 flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Specialist Referrals</span>
            </Link>
            <span>/</span>
            <span className="text-teal-700">New Specialist Referral</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCheck className="w-7 h-7 text-teal-600" />
            Referral to Specialist
          </h1>
          <p className="text-sm text-slate-500">
            Dispatch diagnostic imaging, multi-modal AI findings, and clinical reports to oncology and surgical specialists
          </p>
        </div>

        <Link
          to="/doctor/referrals"
          className="inline-flex items-center space-x-2 px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all shadow-2xs"
        >
          <span>View All Referrals</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* PATIENT CONTEXT BAR (Prompt Spec: Initials, name, patient ID, age, gender, phone, module, risk level, last scan date, report ID with link) */}
      {patientContext && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-teal-600 to-cyan-600 text-white font-bold flex items-center justify-center text-base shadow-xs">
              {(patientContext.name || 'PT')
                .split(' ')
                .map(n => n[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">{patientContext.name}</h3>
                <span className="text-xs font-mono font-medium text-slate-400">({patientContext.patient_code})</span>
                {allPatients.length > 0 && (
                  <select
                    onChange={e => handleSelectDifferentPatient(e.target.value)}
                    value={patientContext.patient_id}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-0.5 bg-slate-50 text-slate-700 font-medium"
                  >
                    {allPatients.map(p => (
                      <option key={p.id} value={p.id}>
                        Switch: {p.full_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                <span>{patientContext.age ? `${patientContext.age} yrs` : '42 yrs'}</span>
                <span>•</span>
                <span>{patientContext.gender}</span>
                <span>•</span>
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3 h-3 text-slate-400" />
                  {patientContext.phone}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            {/* Module pill */}
            <div className="text-right sm:text-left">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Active Module</span>
              <span className="font-bold text-slate-900 capitalize">{patientContext.module} Cancer</span>
            </div>

            {/* Risk badge */}
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-0.5">Risk Level</span>
              {getRiskBadge(patientContext.risk_level)}
            </div>

            {/* Last Scan Date */}
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Last Scan</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {patientContext.last_scan_date}
              </span>
            </div>

            {/* Report ID with link */}
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Clinical Report</span>
              {patientContext.report_id ? (
                <Link
                  to={`/doctor/reports/${patientContext.report_id}`}
                  className="font-mono font-bold text-teal-600 hover:text-teal-800 underline flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {patientContext.report_number || 'REP-VIEW'}
                </Link>
              ) : (
                <span className="font-mono text-slate-400 italic">No report filed</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS CONFIRMATION BANNER IF SENT */}
      {referralSent && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-5 flex items-start space-x-3 shadow-xs">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm">Specialist Referral Dispatched Successfully</h4>
            <p className="text-xs text-emerald-800 leading-relaxed">
              Target specialist <span className="font-bold">{specialistTab === 'internal' ? selectedSpecialist?.name : externalSpecialist.name}</span> has been securely notified via clinical email with full diagnostic imaging attachments and AI risk assessments.
            </p>
            <div className="pt-2 flex items-center space-x-3">
              <Link
                to="/doctor/referrals"
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline"
              >
                Go to Referrals Dashboard →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* FOUR SECTIONS GRID:
          Left Column (xl:col-span-8): Section 1 (Referral Details), Section 2 (Attach Info), Section 3 (Select Specialist)
          Right Sidebar (xl:col-span-4): Section 4 (Review and Send)
      */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Sections 1, 2, 3 */}
        <div className="xl:col-span-8 space-y-6">
          {/* SECTION 1: REFERRAL DETAILS */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center">
                1
              </span>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Referral Details</h2>
            </div>

            <div className="space-y-4 text-xs">
              {/* Specialty dropdown */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Target Specialty *
                </label>
                <select
                  value={specialty}
                  onChange={e => setSpecialty(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
                >
                  <option value="Surgical Oncology">Surgical Oncology</option>
                  <option value="Gynecologic Oncology">Gynecologic Oncology</option>
                  <option value="Radiology">Diagnostic Radiology & Interventional</option>
                  <option value="General Surgery">General Surgery</option>
                  <option value="Endocrinology">Endocrinology & Reproductive Medicine</option>
                  <option value="Other">Other Specialty</option>
                </select>
              </div>

              {/* Reason for Referral textarea (required, pre-filled from AI recommendation) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-700">
                    Clinical Reason for Referral *
                  </label>
                  <span className="text-[11px] text-teal-600 font-medium">Pre-filled from AI Clinical Findings</span>
                </div>
                <textarea
                  rows={4}
                  required
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Detail primary clinical concern, suspicion of malignancy, tumor margins, or biopsy request..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 leading-relaxed"
                />
              </div>

              {/* Priority radio buttons with descriptions */}
              <div>
                <label className="block font-semibold text-slate-700 mb-2">
                  Referral Priority Level *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Routine */}
                  <label
                    onClick={() => setPriority('routine')}
                    className={`p-3 rounded-xl border cursor-pointer flex flex-col justify-between transition-all ${
                      priority === 'routine'
                        ? 'bg-teal-50/50 border-teal-500 ring-1 ring-teal-500'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Routine</span>
                      <input
                        type="radio"
                        name="priority"
                        checked={priority === 'routine'}
                        onChange={() => setPriority('routine')}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Within 4-6 weeks</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Elective evaluations</p>
                  </label>

                  {/* Urgent */}
                  <label
                    onClick={() => setPriority('urgent')}
                    className={`p-3 rounded-xl border cursor-pointer flex flex-col justify-between transition-all ${
                      priority === 'urgent'
                        ? 'bg-amber-50/50 border-amber-500 ring-1 ring-amber-500'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-900">Urgent</span>
                      <input
                        type="radio"
                        name="priority"
                        checked={priority === 'urgent'}
                        onChange={() => setPriority('urgent')}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                    </div>
                    <p className="text-[11px] text-amber-700 mt-1 font-semibold">Within 1-2 weeks</p>
                    <p className="text-[10px] text-amber-600 mt-0.5">High risk & suspicious lesions</p>
                  </label>

                  {/* Emergency */}
                  <label
                    onClick={() => setPriority('emergency')}
                    className={`p-3 rounded-xl border cursor-pointer flex flex-col justify-between transition-all ${
                      priority === 'emergency'
                        ? 'bg-rose-50/60 border-rose-500 ring-1 ring-rose-500'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-900">Emergency</span>
                      <input
                        type="radio"
                        name="priority"
                        checked={priority === 'emergency'}
                        onChange={() => setPriority('emergency')}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                    </div>
                    <p className="text-[11px] text-rose-700 mt-1 font-semibold">Within 24-48 hours</p>
                    <p className="text-[10px] text-rose-600 mt-0.5">Critical acute conditions</p>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: ATTACH RELEVANT INFORMATION */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center">
                2
              </span>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Attach Relevant Information</h2>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Scans & Images */}
                <label className="flex items-start space-x-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={attachScans}
                    onChange={e => setAttachScans(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">Scans and Images</span>
                    <span className="text-[10px] text-slate-500">DICOM & processed heatmaps</span>
                  </div>
                </label>

                {/* AI Analysis Summary */}
                <label className="flex items-start space-x-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={attachAiSummary}
                    onChange={e => setAttachAiSummary(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">AI Analysis Summary</span>
                    <span className="text-[10px] text-slate-500">Confidence scores & biomarkers</span>
                  </div>
                </label>

                {/* Clinical Report */}
                <label className="flex items-start space-x-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={attachReport}
                    onChange={e => setAttachReport(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">Clinical Report</span>
                    <span className="text-[10px] font-mono text-teal-700 font-semibold">
                      {patientContext?.report_number || 'REP-ATTACHED'}
                    </span>
                  </div>
                </label>
              </div>

              {/* Clinical Notes textarea (optional) & Character counter */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-700">
                    Additional Clinical Notes (Optional)
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {clinicalNotes.length} / 500 characters
                  </span>
                </div>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={clinicalNotes}
                  onChange={e => setClinicalNotes(e.target.value)}
                  placeholder="Provide clinical observations, family history, patient comorbidities, or specific questions for the specialist..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: SELECT SPECIALIST / HOSPITAL */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center">
                  3
                </span>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">Select Specialist / Hospital</h2>
              </div>

              {/* Tab Bar: Internal Specialists vs External Referral */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setSpecialistTab('internal')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                    specialistTab === 'internal'
                      ? 'bg-white text-teal-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Internal Specialists
                </button>
                <button
                  type="button"
                  onClick={() => setSpecialistTab('external')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                    specialistTab === 'external'
                      ? 'bg-white text-teal-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  External Referral
                </button>
              </div>
            </div>

            {/* INTERNAL TAB CONTENT */}
            {specialistTab === 'internal' ? (
              <div className="space-y-3.5 text-xs">
                {/* Search & Location Filter */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search specialist name, specialty, or hospital..."
                      value={specialistSearch}
                      onChange={e => setSpecialistSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  <div className="w-full sm:w-56">
                    <select
                      value={locationFilter}
                      onChange={e => setLocationFilter(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    >
                      <option value="all">All Locations / Centers</option>
                      <option value="Cancer Institute">AuraMed Cancer Institute</option>
                      <option value="Apollo">Apollo Speciality</option>
                      <option value="Imaging Center">Advanced Imaging Center</option>
                      <option value="General Hospital">AuraMed General</option>
                    </select>
                  </div>
                </div>

                {/* Results Table (Prompt spec: Name, Specialty, Hospital/Department, Next Available date, View Profile button, Radio select button) */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-8">Select</th>
                        <th className="py-2.5 px-3">Specialist Name</th>
                        <th className="py-2.5 px-3">Specialty</th>
                        <th className="py-2.5 px-3">Hospital / Department</th>
                        <th className="py-2.5 px-3">Next Available</th>
                        <th className="py-2.5 px-3 text-right">Profile</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSpecialists.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            No specialists found matching your search.
                          </td>
                        </tr>
                      ) : (
                        filteredSpecialists.map(spec => {
                          const isSelected = selectedSpecialist?.id === spec.id
                          return (
                            <tr
                              key={spec.id}
                              onClick={() => handleSelectSpecialist(spec)}
                              className={`cursor-pointer transition-colors ${
                                isSelected ? 'bg-teal-50/50' : 'hover:bg-slate-50/80'
                              }`}
                            >
                              <td className="py-3 px-3">
                                <input
                                  type="radio"
                                  name="selected_specialist"
                                  checked={isSelected}
                                  onChange={() => handleSelectSpecialist(spec)}
                                  className="text-teal-600 focus:ring-teal-500"
                                />
                              </td>
                              <td className="py-3 px-3 font-bold text-slate-900">
                                <div className="flex items-center space-x-2">
                                  <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold flex items-center justify-center">
                                    {spec.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                  </div>
                                  <span>{spec.name}</span>
                                </div>
                              </td>
                              <td className="py-3 px-3 font-medium text-slate-700">
                                {spec.specialty}
                              </td>
                              <td className="py-3 px-3 text-slate-600">
                                <p className="font-medium text-slate-800">{spec.hospital}</p>
                                <p className="text-[10px] text-slate-400">{spec.department}</p>
                              </td>
                              <td className="py-3 px-3">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {spec.next_available}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={e => {
                                    e.stopPropagation()
                                    setProfileSpecialist(spec)
                                  }}
                                  className="px-2.5 py-1 text-teal-700 hover:text-teal-800 hover:bg-teal-50 border border-teal-200 rounded-lg text-[11px] font-semibold"
                                >
                                  View Profile
                                </button>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* EXTERNAL REFERRAL TAB CONTENT */
              <div className="space-y-3 text-xs bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                <p className="text-slate-600 leading-relaxed">
                  Refer to an outside oncology center, tertiary hospital, or private specialist. Secure referral documentation will be transmitted to the provided email.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">External Specialist Name *</label>
                    <input
                      type="text"
                      value={externalSpecialist.name}
                      onChange={e => setExternalSpecialist({ ...externalSpecialist, name: e.target.value })}
                      placeholder="e.g. Dr. Robert Vance, MD"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Hospital / Clinic Name *</label>
                    <input
                      type="text"
                      value={externalSpecialist.hospital}
                      onChange={e => setExternalSpecialist({ ...externalSpecialist, hospital: e.target.value })}
                      placeholder="e.g. Memorial Sloan Oncology Partner"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Direct Secure Email *</label>
                    <input
                      type="email"
                      value={externalSpecialist.email}
                      onChange={e => setExternalSpecialist({ ...externalSpecialist, email: e.target.value })}
                      placeholder="specialist@partnerhospital.org"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                    <input
                      type="tel"
                      value={externalSpecialist.phone}
                      onChange={e => setExternalSpecialist({ ...externalSpecialist, phone: e.target.value })}
                      placeholder="+91-98765-43210"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR: SECTION 4: REVIEW AND SEND */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4 sticky top-6">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center">
                4
              </span>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Review and Send Referral</h2>
            </div>

            {/* Summary of referral (Prompt spec: Patient, Specialty, Priority badge, Attachments list, Referring Doctor with reg number) */}
            <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Patient</span>
                <span className="font-bold text-slate-900">{patientContext?.name}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Recipient Specialist</span>
                <span className="font-bold text-teal-700 text-right">
                  {specialistTab === 'internal'
                    ? (selectedSpecialist?.name || 'Please select specialist')
                    : (externalSpecialist.name || 'External Specialist')}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Target Specialty</span>
                <span className="font-semibold text-slate-800">{specialty}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Priority</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                  priority === 'emergency'
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : priority === 'urgent'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-teal-100 text-teal-800 border border-teal-200'
                }`}>
                  {priority}
                </span>
              </div>

              {/* Attachments List */}
              <div className="pb-2 border-b border-slate-200 space-y-1">
                <span className="text-slate-500 font-medium block">Included Attachments:</span>
                <div className="space-y-0.5 pl-1">
                  {attachScans && (
                    <div className="flex items-center space-x-1.5 text-slate-700">
                      <Check className="w-3.5 h-3.5 text-teal-600" />
                      <span>Full DICOM Scans & Heatmaps</span>
                    </div>
                  )}
                  {attachAiSummary && (
                    <div className="flex items-center space-x-1.5 text-slate-700">
                      <Check className="w-3.5 h-3.5 text-teal-600" />
                      <span>Multi-modal AI Risk Summary</span>
                    </div>
                  )}
                  {attachReport && (
                    <div className="flex items-center space-x-1.5 text-slate-700">
                      <Check className="w-3.5 h-3.5 text-teal-600" />
                      <span>Clinical Report ({patientContext?.report_number || 'REP-CERT'})</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Referring Doctor with registration number */}
              <div className="pt-1">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Referring Doctor</span>
                <p className="font-bold text-slate-900 mt-0.5">{patientContext?.referring_doctor || 'Dr. Mehta'}</p>
                <p className="text-[11px] font-mono text-slate-500">
                  Reg No: {patientContext?.registration_number || 'TNMC123456'}
                </p>
              </div>
            </div>

            {/* Buttons (Prompt spec: Send Referral primary, Save as Draft) */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => handleSendReferral(false)}
                disabled={actionLoading || referralSent}
                className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-2 transition-all"
              >
                <Send className="w-4 h-4" />
                <span>{referralSent ? 'Referral Sent' : 'Send Referral to Specialist'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendReferral(true)}
                disabled={actionLoading || referralSent}
                className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all"
              >
                <span>Save as Draft</span>
              </button>
            </div>

            {/* REFERRAL STATUS TIMELINE (Prompt Spec: Referral Created, Sent to Specialist, Specialist Response, Appointment Scheduled, Consultation Completed) */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Referral Status Timeline</p>
              <div className="space-y-2.5 text-xs pl-1">
                {/* 1. Referral Created */}
                <div className="flex items-center space-x-2.5 text-slate-900">
                  <div className="w-2.5 h-2.5 rounded-full bg-teal-600 ring-4 ring-teal-100" />
                  <span className="font-bold">1. Referral Created</span>
                </div>

                {/* 2. Sent to Specialist */}
                <div className="flex items-center space-x-2.5 text-slate-600">
                  <div className={`w-2.5 h-2.5 rounded-full ${referralSent ? 'bg-teal-600 ring-4 ring-teal-100' : 'bg-slate-300'}`} />
                  <span className={referralSent ? 'font-bold text-slate-900' : 'text-slate-400'}>
                    2. Sent to Specialist {referralSent ? '(Transmitted)' : '(Pending)'}
                  </span>
                </div>

                {/* 3. Specialist Response */}
                <div className="flex items-center space-x-2.5 text-slate-400">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span>3. Specialist Response (Pending)</span>
                </div>

                {/* 4. Appointment Scheduled */}
                <div className="flex items-center space-x-2.5 text-slate-400">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span>4. Appointment Scheduled (Pending)</span>
                </div>

                {/* 5. Consultation Completed */}
                <div className="flex items-center space-x-2.5 text-slate-400">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span>5. Consultation Completed (Pending)</span>
                </div>
              </div>
            </div>

            {/* Info note (Prompt spec: "The specialist will receive an email notification with all attached information.") */}
            <div className="bg-sky-50 border border-sky-200/80 rounded-xl p-3 text-sky-800 text-[11px] flex items-start space-x-2">
              <Info className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                The specialist will receive an email notification with all attached clinical information, raw DICOM data, and direct viewer links.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SPECIALIST PROFILE MODAL */}
      {profileSpecialist && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-teal-600" />
                Specialist Clinical Profile
              </h3>
              <button onClick={() => setProfileSpecialist(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-800 font-bold text-base flex items-center justify-center flex-shrink-0">
                  {profileSpecialist.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">{profileSpecialist.name}</h4>
                  <p className="text-teal-700 font-medium">{profileSpecialist.specialty}</p>
                  <p className="text-slate-400 text-[11px]">{profileSpecialist.rating}</p>
                </div>
              </div>

              <div>
                <p className="font-bold text-slate-800">Hospital & Center</p>
                <p className="text-slate-600">{profileSpecialist.hospital} • {profileSpecialist.department}</p>
              </div>

              <div>
                <p className="font-bold text-slate-800">Biography & Expertise</p>
                <p className="text-slate-600 leading-relaxed mt-0.5">{profileSpecialist.bio}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block font-semibold">Direct Email</span>
                  <span className="font-mono text-slate-700">{profileSpecialist.email}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block font-semibold">Next Available</span>
                  <span className="font-semibold text-emerald-700">{profileSpecialist.next_available}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setProfileSpecialist(null)}
                className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold text-xs"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSelectSpecialist(profileSpecialist)
                  setProfileSpecialist(null)
                  showToast(`Selected ${profileSpecialist.name}`)
                }}
                className="px-4 py-2 rounded-xl text-white bg-teal-600 hover:bg-teal-700 font-semibold text-xs shadow-xs"
              >
                Select this Specialist
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
