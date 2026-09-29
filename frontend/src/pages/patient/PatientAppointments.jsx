import React, { useState, useEffect } from 'react'
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Download,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Info,
  MapPin,
  ExternalLink,
  PhoneCall,
  X
} from 'lucide-react'
import PatientLayout from '../../components/patient/PatientLayout'
import {
  fetchPatientAppointments,
  reschedulePatientAppointment,
  cancelPatientAppointment
} from '../../services/patientPortalService'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function PatientAppointments() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date(2026, 8, 1)) // Sep 2026

  // Modals
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showSpecialistModal, setShowSpecialistModal] = useState(false)
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

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await fetchPatientAppointments()
      setData(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleReschedule = async e => {
    e.preventDefault()
    if (!data?.upcoming?.id) return
    try {
      setActionLoading(true)
      await reschedulePatientAppointment(data.upcoming.id, {
        preferred_date: rescheduleDate,
        preferred_time: rescheduleTime
      })
      showToast(`Reschedule request submitted for ${rescheduleDate} at ${rescheduleTime}. Submitted to doctor for confirmation.`)
      setShowRescheduleModal(false)
      loadData()
    } catch (err) {
      console.error(err)
      showToast('Failed to request reschedule', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!data?.upcoming?.id) return
    try {
      setActionLoading(true)
      await cancelPatientAppointment(data.upcoming.id, { reason: cancelReason })
      showToast('Appointment cancelled. Care team notified.')
      setShowCancelModal(false)
      loadData()
    } catch (err) {
      console.error(err)
      showToast('Failed to cancel appointment', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Generates .ics file download for Add to Calendar button
  const handleAddToCalendar = () => {
    const up = data?.upcoming
    if (!up) return
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//AuraMed Healthcare//Patient Portal//EN
BEGIN:VEVENT
SUMMARY:${up.type} - ${up.doctor_name}
DESCRIPTION:${up.notes || 'Clinical consultation'} at ${up.hospital}
LOCATION:${up.location}
DTSTART:20260918T103000Z
DTEND:20260918T110000Z
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `AuraMed_Appointment_${up.date_iso || '20260918'}.ics`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Calendar invite (.ics) downloaded successfully!')
  }

  // Mini calendar calculation for month
  const calYear = currentMonthDate.getFullYear()
  const calMonth = currentMonthDate.getMonth()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const firstDay = new Date(calYear, calMonth, 1).getDay()

  const appointmentDays = [18] // Sep 18 appointment day

  const up = data?.upcoming
  const stats = data?.stats || { upcoming_count: 1, completed_count: 3, rescheduled_count: 0, cancelled_count: 0 }

  return (
    <PatientLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Toast */}
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

        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Appointments & Visits</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review confirmed doctor consults, reschedule, or synchronize with your calendar
          </p>
        </div>

        {/* FOUR STAT CARDS: Upcoming count, Completed count, Rescheduled count, Cancelled count */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-teal-600">Upcoming</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{stats.upcoming_count}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Confirmed visit</p>
          </div>

          <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Completed</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{stats.completed_count}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Past checkups</p>
          </div>

          <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Rescheduled</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{stats.rescheduled_count}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Adjusted visits</p>
          </div>

          <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Cancelled</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{stats.cancelled_count}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Withdrawn visits</p>
          </div>
        </div>

        {/* MAIN SECTION: Left Featured Card & Past Table, Right Mini-Calendar & Specialist finder */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Featured Upcoming Appointment Card + Past Appointments Table (lg:col-span-8) */}
          <div className="lg:col-span-8 space-y-6">
            {/* UPCOMING APPOINTMENT (Featured card) */}
            {up && (
              <div className="bg-gradient-to-br from-white via-teal-50/20 to-emerald-50/30 rounded-3xl p-6 sm:p-7 border border-teal-200/80 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-teal-100 pb-3">
                  <div className="flex items-center space-x-2 text-teal-800">
                    <CalendarIcon className="w-5 h-5 text-teal-600" />
                    <h2 className="font-bold text-sm uppercase tracking-wider">Next Confirmed Appointment</h2>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {up.status_badge}
                  </span>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {up.type}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700 bg-white/80 p-4 rounded-2xl border border-teal-100/60">
                    <div className="space-y-1">
                      <span className="text-slate-400 font-semibold block">Physician</span>
                      <p className="font-bold text-slate-900 text-sm">{up.doctor_name}</p>
                      <p className="text-slate-500">{up.specialty} • Reg: {up.registration_number}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-400 font-semibold block">Date & Time</span>
                      <p className="font-bold text-slate-900 text-sm">{up.date}</p>
                      <p className="text-slate-500">{up.time_slot}</p>
                    </div>

                    <div className="sm:col-span-2 space-y-1 pt-1 border-t border-slate-100">
                      <span className="text-slate-400 font-semibold block">Location</span>
                      <p className="font-medium text-slate-800">{up.location} ({up.hospital})</p>
                    </div>

                    {up.notes && (
                      <div className="sm:col-span-2 space-y-1 pt-1 border-t border-slate-100">
                        <span className="text-slate-400 font-semibold block">Preparation Notes</span>
                        <p className="text-slate-600 leading-snug">{up.notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Three Action Buttons: Reschedule, Cancel, Add to Calendar */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowRescheduleModal(true)}
                    className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-xs shadow-2xs transition-colors flex items-center space-x-1.5"
                  >
                    <span>Reschedule Appointment</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddToCalendar}
                    className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-2xl text-xs shadow-2xs transition-colors flex items-center space-x-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-teal-600" />
                    <span>Add to Calendar (.ics)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCancelModal(true)}
                    className="px-4 py-2.5 border border-rose-200 hover:bg-rose-50 text-rose-700 font-bold rounded-2xl text-xs transition-colors"
                  >
                    Cancel Visit
                  </button>
                </div>
              </div>
            )}

            {/* PAST APPOINTMENTS TABLE: Date, Doctor, Type, Status badge, View Details */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Past Appointments History</h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-4">Doctor</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {(data?.past || []).map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-3 font-mono font-medium text-slate-800 whitespace-nowrap">
                          {p.date}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900">{p.doctor}</p>
                          <p className="text-[10px] text-slate-400">{p.specialty}</p>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {p.type}
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => showToast(`Consultation record filed on ${p.date}. No follow-up pending.`)}
                            className="px-2.5 py-1 text-teal-600 hover:text-teal-800 font-bold"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Mini Calendar + Find a Specialist (lg:col-span-4) */}
          <div className="lg:col-span-4 space-y-6">
            {/* MINI CALENDAR: Current month with appointment dates highlighted, Color dot */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  {MONTH_NAMES[calMonth]} {calYear}
                </h3>
                <span className="text-[11px] font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                  1 Scheduled
                </span>
              </div>

              {/* Calendar Grid */}
              <div className="space-y-2">
                <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <div key={i}>{d}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 text-center text-xs gap-1">
                  {/* Padding */}
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`pad-${i}`} className="p-1 text-slate-300" />
                  ))}

                  {/* Month Days */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1
                    const hasAppt = appointmentDays.includes(dayNum)
                    return (
                      <div
                        key={dayNum}
                        className={`p-1.5 rounded-xl font-medium relative flex flex-col items-center justify-center transition-all ${
                          hasAppt
                            ? 'bg-teal-600 text-white font-bold shadow-xs'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{dayNum}</span>
                        {hasAppt && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 mt-0.5" />
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center space-x-2 text-[11px] text-slate-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                  <span>Sep 18: Confirmed Doctor Visit</span>
                </div>
              </div>
            </div>

            {/* FIND A SPECIALIST SECTION: Browse Specialists button (informational only) */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Need a Specialist?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                If your report suggests oncology or surgical correlation, your primary doctor can refer you directly to our verified specialist network.
              </p>
              <button
                type="button"
                onClick={() => setShowSpecialistModal(true)}
                className="w-full py-2.5 px-3 border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold rounded-2xl text-xs transition-colors flex items-center justify-center space-x-1.5"
              >
                <span>Browse Specialists Directory</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <p className="text-[10px] text-slate-400 text-center italic">
                Direct booking is coordinated through your physician for insurance validation.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SPECIALISTS BROWSE MODAL (Informational only) */}
      {showSpecialistModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 text-slate-800">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">AuraMed Specialist Directory</h3>
              <button onClick={() => setShowSpecialistModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs max-h-80 overflow-y-auto no-scrollbar">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <p className="font-bold text-slate-900 text-sm">Dr. Kavitha Suresh, FRCS</p>
                <p className="text-teal-700 font-medium">Surgical Oncology • AuraMed Regional Cancer Center</p>
                <p className="text-slate-500 mt-1">Specialized in oncoplastic breast preservation and sentinel node biopsy.</p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <p className="font-bold text-slate-900 text-sm">Dr. Rajesh Raman, MD</p>
                <p className="text-teal-700 font-medium">Gynecologic Oncology • Apollo Speciality Hospital</p>
                <p className="text-slate-500 mt-1">16+ years experience in cervical colposcopy and LEEP excisions.</p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <p className="font-bold text-slate-900 text-sm">Dr. Arvind Menon, DM</p>
                <p className="text-teal-700 font-medium">Reproductive Endocrinology • Metro Endocrine Institute</p>
                <p className="text-slate-500 mt-1">Expert in metabolic PCOS management and insulin resistance protocols.</p>
              </div>
            </div>

            <div className="p-3 bg-teal-50 rounded-2xl border border-teal-100 text-[11px] text-teal-800">
              To request a referral to one of these specialists, please discuss with your doctor during your consultation or message your care coordinator.
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowSpecialistModal(false)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-xs shadow-2xs"
              >
                Close Directory
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESCHEDULE MODAL */}
      {showRescheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 text-slate-800">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-teal-600" />
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
    </PatientLayout>
  )
}
