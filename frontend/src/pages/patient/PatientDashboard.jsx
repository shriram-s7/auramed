import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Heart,
  Calendar,
  FileText,
  Clock,
  ChevronRight,
  ShieldCheck,
  PhoneCall,
  Info,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  X,
  Share2,
  Sparkles,
  Layers
} from 'lucide-react'
import PatientLayout from '../../components/patient/PatientLayout'
import { getModuleSvgIcon } from '../../components/patient/ModuleIcons'
import {
  fetchPatientDashboard,
  reschedulePatientAppointment,
  cancelPatientAppointment
} from '../../services/patientPortalService'

export default function PatientDashboard() {
  const navigate = useNavigate()

  // State
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [tipIndex, setTipIndex] = useState(0)

  // Modals
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showReportGuideModal, setShowReportGuideModal] = useState(false)
  const [showResourceModal, setShowResourceModal] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Reschedule form
  const [rescheduleDate, setRescheduleDate] = useState('2026-09-24')
  const [rescheduleTime, setRescheduleTime] = useState('11:00 AM')
  const [cancelReason, setCancelReason] = useState('Personal scheduling conflict')

  const showToast = (msg, type = 'success') => {
    setToastMessage({ text: msg, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Load dashboard
  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const res = await fetchPatientDashboard()
      setData(res.data)
    } catch (err) {
      console.error('Error loading patient dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  // Auto rotate educational tips
  useEffect(() => {
    if (!data?.health_tips?.length) return
    const interval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % data.health_tips.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [data])

  const handleReschedule = async e => {
    e.preventDefault()
    if (!data?.next_appointment?.id) return
    try {
      setActionLoading(true)
      await reschedulePatientAppointment(data.next_appointment.id, {
        preferred_date: rescheduleDate,
        preferred_time: rescheduleTime
      })
      showToast(`Reschedule request submitted for ${rescheduleDate} at ${rescheduleTime}.`)
      setShowRescheduleModal(false)
      loadDashboardData()
    } catch (err) {
      console.error(err)
      showToast('Failed to reschedule', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!data?.next_appointment?.id) return
    try {
      setActionLoading(true)
      await cancelPatientAppointment(data.next_appointment.id, {
        reason: cancelReason
      })
      showToast('Appointment cancelled. Your care team has been notified.')
      setShowCancelModal(false)
      loadDashboardData()
    } catch (err) {
      console.error(err)
      showToast('Failed to cancel appointment', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Plain language result badge styling
  // High Risk -> "Needs Follow-up" in red
  // Moderate -> "Monitor" in amber
  // Low/Normal -> "Normal" in green
  const renderResultBadge = (label, color) => {
    if (color === 'red' || label === 'Needs Follow-up') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
          Needs Follow-up
        </span>
      )
    }
    if (color === 'amber' || label === 'Monitor') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
          Monitor
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        Normal
      </span>
    )
  }

  const firstName = data?.patient?.first_name || 'Anita'
  const nextAppt = data?.next_appointment

  return (
    <PatientLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Toast Notification */}
        {toastMessage && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-lg border text-sm font-medium flex items-center space-x-2 transition-all ${
            toastMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}>
            {toastMessage.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* TOP SECTION: Greeting + Motivational Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Welcome back, {firstName}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Here is an overview of your health, reports, and upcoming appointments.
            </p>
          </div>

          {/* Motivational Card Top Right (Heart icon, "Your health matters", "Regular screening...") */}
          <div className="bg-gradient-to-r from-rose-50 via-pink-50 to-teal-50 border border-pink-200/60 rounded-3xl p-4 shadow-2xs flex items-center space-x-3.5 max-w-md">
            <div className="w-10 h-10 rounded-2xl bg-white text-rose-500 flex items-center justify-center shadow-xs flex-shrink-0">
              <Heart className="w-5 h-5 fill-rose-500 text-rose-500" />
            </div>
            <div>
              <p className="font-bold text-xs text-slate-900">Your health matters</p>
              <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
                Regular screening helps in early detection and better outcomes.
              </p>
            </div>
          </div>
        </div>

        {/* FOUR STAT CARDS:
            1. Total Reports (links to /patient/reports)
            2. Upcoming Appointments count (links to appointments)
            3. Last Scan date (links to that report)
            4. Health Modules count: "Breast • Cervical • PCOS"
        */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Reports */}
          <Link
            to="/patient/reports"
            className="bg-white hover:bg-teal-50/20 rounded-3xl p-5 border border-slate-200/80 shadow-xs transition-all group flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Reports</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{data?.stats?.total_reports ?? 3}</p>
              <p className="text-xs text-teal-600 font-semibold mt-1 group-hover:underline flex items-center gap-1">
                <span>View all reports</span>
                <ChevronRight className="w-3 h-3" />
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
              <FileText className="w-6 h-6" />
            </div>
          </Link>

          {/* Card 2: Upcoming Appointments */}
          <Link
            to="/patient/appointments"
            className="bg-white hover:bg-purple-50/20 rounded-3xl p-5 border border-slate-200/80 shadow-xs transition-all group flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Upcoming Appointments</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{data?.stats?.upcoming_appointments ?? 1}</p>
              <p className="text-xs text-purple-600 font-semibold mt-1 group-hover:underline flex items-center gap-1">
                <span>Manage visit</span>
                <ChevronRight className="w-3 h-3" />
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <Calendar className="w-6 h-6" />
            </div>
          </Link>

          {/* Card 3: Last Scan Date */}
          <Link
            to={`/patient/reports/${data?.stats?.last_report_id || 'rep-demo-01'}`}
            className="bg-white hover:bg-pink-50/20 rounded-3xl p-5 border border-slate-200/80 shadow-xs transition-all group flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Last Scan Date</p>
              <p className="text-lg font-black text-slate-900 mt-2">{data?.stats?.last_scan_date || 'Sep 08, 2026'}</p>
              <p className="text-xs text-pink-600 font-semibold mt-1 group-hover:underline flex items-center gap-1">
                <span>Review scan findings</span>
                <ChevronRight className="w-3 h-3" />
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-pink-50 border border-pink-100 flex items-center justify-center text-pink-600">
              <Clock className="w-6 h-6" />
            </div>
          </Link>

          {/* Card 4: Health Modules Count */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Screenings</p>
              <p className="text-xs font-bold text-slate-800 mt-2 tracking-tight">
                {data?.stats?.health_modules || 'Breast • Cervical • PCOS'}
              </p>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Multi-modal coverage</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Layers className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* TWO COLUMN MAIN SECTION:
            LEFT: Recent Reports + Health Timeline preview + Health Tips
            RIGHT: Next Appointment panel + Support & Resources + Your Privacy Matters
        */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN (lg:col-span-8) */}
          <div className="lg:col-span-8 space-y-6">
            {/* RECENT REPORTS SECTION */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">Recent Reports</h3>
                  <p className="text-xs text-slate-500">Your latest certified diagnostic health examinations</p>
                </div>
                <Link
                  to="/patient/reports"
                  className="text-xs font-bold text-teal-600 hover:text-teal-800 flex items-center space-x-1"
                >
                  <span>View All</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Three most recent reports */}
              <div className="divide-y divide-slate-100">
                {(data?.recent_reports || []).map(r => (
                  <div key={r.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-3.5">
                      {/* SVG Module icon */}
                      <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
                        {getModuleSvgIcon(r.module)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-xs sm:text-sm">{r.report_type}</p>
                        <p className="text-[11px] text-slate-400">
                          {r.date} • Checked by {r.doctor_name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 self-end sm:self-center">
                      {renderResultBadge(r.result_badge, r.result_color)}
                      <Link
                        to={`/patient/reports/${r.id}`}
                        className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded-xl text-xs transition-colors shadow-2xs"
                      >
                        View Report
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* HEALTH TIMELINE PREVIEW (Horizontal dotted timeline with 4 dots) */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">Health Journey Preview</h3>
                  <p className="text-xs text-slate-500">Key milestones in your preventative wellness journey</p>
                </div>
                <Link
                  to="/patient/timeline"
                  className="text-xs font-bold text-teal-600 hover:text-teal-800 flex items-center space-x-1"
                >
                  <span>View Full Timeline</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Horizontal dotted timeline */}
              <div className="pt-4 pb-2 px-2">
                <div className="relative flex items-center justify-between">
                  {/* Dotted connecting line */}
                  <div className="absolute left-6 right-6 top-3 h-0.5 border-t-2 border-dashed border-teal-200 z-0" />

                  {(data?.timeline_preview || []).map((dot, idx) => (
                    <div key={idx} className="relative z-10 flex flex-col items-center text-center max-w-[85px]">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                        idx === 3
                          ? 'bg-teal-600 text-white ring-4 ring-teal-100'
                          : 'bg-white border-2 border-teal-500 text-teal-700'
                      }`}>
                        {idx + 1}
                      </div>
                      <span className="text-[10px] font-bold text-slate-700 mt-2">{dot.date}</span>
                      <span className="text-[10px] text-slate-500 font-medium truncate w-full">{dot.event}</span>
                      <span className={`text-[9px] font-semibold mt-0.5 ${
                        idx === 3 ? 'text-teal-600 font-bold' : 'text-slate-400'
                      }`}>
                        {dot.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* HEALTH TIPS SECTION (Carousel dots for multiple tips) */}
            <div className="bg-gradient-to-br from-teal-600 to-emerald-700 text-white rounded-3xl p-6 shadow-sm space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-teal-200">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Health Insights & Guidance</span>
                </div>
                {/* Carousel dots */}
                <div className="flex items-center space-x-1.5">
                  {(data?.health_tips || []).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setTipIndex(idx)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        tipIndex === idx ? 'bg-white w-4' : 'bg-white/40 hover:bg-white/60'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {data?.health_tips?.[tipIndex] && (
                <div className="space-y-1 animate-in fade-in duration-200">
                  <h4 className="text-base font-bold text-white">
                    {data.health_tips[tipIndex].title}
                  </h4>
                  <p className="text-xs text-teal-50 leading-relaxed max-w-2xl">
                    {data.health_tips[tipIndex].description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN (lg:col-span-4) */}
          <div className="lg:col-span-4 space-y-6">
            {/* NEXT APPOINTMENT PANEL */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Next Scheduled Appointment</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Confirmed
                </span>
              </div>

              {nextAppt ? (
                <div className="space-y-4 text-xs">
                  {/* Date Display (Large month abbreviation + date number) */}
                  <div className="flex items-center space-x-3.5 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div className="w-14 h-14 rounded-2xl bg-teal-600 text-white flex flex-col items-center justify-center font-black shadow-xs flex-shrink-0">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-teal-200">
                        {nextAppt.month_abbr}
                      </span>
                      <span className="text-xl leading-none font-black">{nextAppt.day_num}</span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{nextAppt.type}</p>
                      <p className="text-[11px] text-slate-500">{nextAppt.time}</p>
                    </div>
                  </div>

                  {/* Doctor & Location */}
                  <div className="space-y-2 text-slate-600 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                    <p>
                      <span className="text-slate-400 font-semibold block">Clinician:</span>
                      <strong className="text-slate-900">{nextAppt.doctor_name}</strong> • {nextAppt.specialty}
                    </p>
                    <p>
                      <span className="text-slate-400 font-semibold block">Location:</span>
                      {nextAppt.location}
                    </p>
                  </div>

                  {/* Three Buttons: View Appointment Details, Reschedule, Cancel */}
                  <div className="space-y-2 pt-1">
                    <Link
                      to="/patient/appointments"
                      className="w-full py-2.5 px-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-xs text-center block shadow-2xs transition-colors"
                    >
                      View Appointment Details
                    </Link>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setShowRescheduleModal(true)}
                        className="py-2 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-colors text-center"
                      >
                        Reschedule
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowCancelModal(true)}
                        className="py-2 px-2 border border-rose-200 hover:bg-rose-50 text-rose-700 font-bold rounded-2xl text-xs transition-colors text-center"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No upcoming appointments scheduled
                </div>
              )}
            </div>

            {/* SUPPORT AND RESOURCES PANEL */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Support & Resources</h3>

              <div className="space-y-2 text-xs">
                {/* 1. Understanding Your Report */}
                <button
                  type="button"
                  onClick={() => setShowReportGuideModal(true)}
                  className="w-full p-3 rounded-2xl border border-slate-100 hover:border-teal-300 hover:bg-teal-50/30 text-left flex items-center justify-between transition-colors group"
                >
                  <div className="flex items-center space-x-2.5">
                    <Info className="w-4 h-4 text-teal-600" />
                    <span className="font-bold text-slate-800 group-hover:text-teal-700">Understanding Your Report</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* 2. Women's Health Resources */}
                <button
                  type="button"
                  onClick={() => setShowResourceModal(true)}
                  className="w-full p-3 rounded-2xl border border-slate-100 hover:border-teal-300 hover:bg-teal-50/30 text-left flex items-center justify-between transition-colors group"
                >
                  <div className="flex items-center space-x-2.5">
                    <BookOpen className="w-4 h-4 text-teal-600" />
                    <span className="font-bold text-slate-800 group-hover:text-teal-700">Women's Health Resources</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* 3. Contact Support */}
                <button
                  type="button"
                  onClick={() => setShowSupportModal(true)}
                  className="w-full p-3 rounded-2xl border border-slate-100 hover:border-teal-300 hover:bg-teal-50/30 text-left flex items-center justify-between transition-colors group"
                >
                  <div className="flex items-center space-x-2.5">
                    <PhoneCall className="w-4 h-4 text-teal-600" />
                    <span className="font-bold text-slate-800 group-hover:text-teal-700">Contact Support Team</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            {/* YOUR PRIVACY MATTERS CARD */}
            <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-xs space-y-2">
              <div className="flex items-center space-x-2 text-teal-400">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Your Privacy Matters</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                All imaging data and reports are strictly encrypted under HIPAA and Indian DPDP guidelines. Only your assigned doctors can view your medical records.
              </p>
              <Link
                to="/patient/profile"
                className="text-xs text-teal-400 hover:text-teal-300 font-bold underline inline-block pt-1"
              >
                Learn more & manage privacy settings →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* RESCHEDULE MODAL */}
      {showRescheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 text-slate-800">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-600" />
                Reschedule Appointment
              </h3>
              <button onClick={() => setShowRescheduleModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleReschedule} className="space-y-3 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Choose your preferred date and time. Your care coordinator will verify doctor availability and confirm with you.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Preferred Date *</label>
                <input
                  type="date"
                  required
                  value={rescheduleDate}
                  onChange={e => setRescheduleDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Preferred Time Window *</label>
                <select
                  value={rescheduleTime}
                  onChange={e => setRescheduleTime(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 font-medium"
                >
                  <option value="09:30 AM">Morning (09:30 AM - 11:00 AM)</option>
                  <option value="11:30 AM">Midday (11:30 AM - 01:00 PM)</option>
                  <option value="02:30 PM">Afternoon (02:30 PM - 04:00 PM)</option>
                  <option value="04:30 PM">Evening (04:30 PM - 06:00 PM)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="px-4 py-2 rounded-2xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold"
                >
                  Keep Current Time
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-2xl text-white bg-teal-600 hover:bg-teal-700 font-bold shadow-2xs"
                >
                  Request Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 text-slate-800">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Cancel Appointment?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Cancelling this visit will notify Dr. Mehta's office. You can book a new appointment anytime.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 text-xs mb-1">Reason for cancellation</label>
              <input
                type="text"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-medium"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2 rounded-2xl text-slate-600 bg-slate-100 hover:bg-slate-200 text-xs font-semibold"
              >
                No, Keep Visit
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={actionLoading}
                className="flex-1 py-2 rounded-2xl text-white bg-rose-600 hover:bg-rose-700 text-xs font-bold shadow-2xs"
              >
                Yes, Cancel Visit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UNDERSTANDING YOUR REPORT MODAL */}
      {showReportGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 text-slate-800">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Info className="w-5 h-5 text-teal-600" />
                How to Read Your AuraMed Report
              </h3>
              <button onClick={() => setShowReportGuideModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                AuraMed reports are written in plain language to help you have informed conversations with your doctor.
              </p>
              <div className="space-y-2">
                <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                  <strong>Normal:</strong> Your screening tissue appears healthy and matches expected reference guidelines. Continue standard routine screening.
                </div>
                <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
                  <strong>Monitor:</strong> A benign or mild variation was observed that warrants a routine check in 30–60 days to verify stability.
                </div>
                <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900">
                  <strong>Needs Follow-up:</strong> An area was noted that requires closer in-person examination or a simple biopsy. This is not a cancer diagnosis; it ensures complete medical certainty.
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowReportGuideModal(false)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-xs shadow-2xs"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESOURCES MODAL */}
      {showResourceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 text-slate-800">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-teal-600" />
                Women's Health Educational Library
              </h3>
              <button onClick={() => setShowResourceModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <h4 className="font-bold text-slate-900 text-xs">Breast Health & Self-Exam Guide</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Step-by-step guidance on monthly checks and recognizing normal cyclic changes.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <h4 className="font-bold text-slate-900 text-xs">Cervical Wellness & HPV Prevention</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Understanding Pap cytology, HPV screening intervals, and vaccination benefits.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <h4 className="font-bold text-slate-900 text-xs">PCOS Lifestyle & Metabolic Balance</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Nutrition strategies, low-glycemic foods, and exercise routines tailored for hormone health.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowResourceModal(false)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-xs shadow-2xs"
              >
                Close Library
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUPPORT FORM MODAL */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 text-slate-800">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-teal-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-9 h-9 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">AuraMed Care Coordinator</h3>
                  <p className="text-xs text-slate-500">Dedicated Patient Support</p>
                </div>
              </div>
              <button onClick={() => setShowSupportModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                Need help understanding your doctor's notes or setting up transportation for a biopsy? Contact us:
              </p>
              <div className="bg-teal-50/60 p-3 rounded-2xl border border-teal-100 space-y-1.5 font-medium">
                <p><span className="text-slate-500">Helpline:</span> <strong className="text-slate-900">+91 800-AURA-MED (Toll Free)</strong></p>
                <p><span className="text-slate-500">Email:</span> <strong className="text-slate-900 font-mono">support@auramed.health</strong></p>
                <p><span className="text-slate-500">Operating Hours:</span> 24 Hours • 7 Days a Week</p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSupportModal(false)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-xs shadow-2xs"
              >
                Close Support
              </button>
            </div>
          </div>
        </div>
      )}
    </PatientLayout>
  )
}
