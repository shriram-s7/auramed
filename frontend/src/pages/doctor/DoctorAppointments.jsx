import React, { useState, useEffect, useMemo } from 'react'
import {
  Calendar as CalendarIcon,
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Plus,
  User,
  MapPin,
  Stethoscope,
  X,
  FileText,
  Phone,
  AlertTriangle,
  RefreshCw,
  Check,
  CalendarDays,
  ListFilter
} from 'lucide-react'
import {
  fetchAppointments,
  scheduleAppointment,
  updateAppointmentStatus
} from '../../services/appointmentService'
import { fetchPatients } from '../../services/patientService'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function DoctorAppointments() {
  const [loading, setLoading] = useState(true)
  const [appointments, setAppointments] = useState([])
  const [stats, setStats] = useState({
    upcoming_7_days: 0,
    high_priority: 0,
    overdue: 0,
    completed_this_month: 0
  })

  // View mode: 'calendar' or 'list'
  const [viewMode, setViewMode] = useState('calendar')
  // Calendar sub-view: 'month' | 'week' | 'day'
  const [calendarScope, setCalendarScope] = useState('month')

  // Date navigation
  const [currentDate, setCurrentDate] = useState(new Date())

  // Selected appointment for right panel
  const [selectedAppt, setSelectedAppt] = useState(null)

  // Filters
  const [moduleFilter, setModuleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)

  // Form states for schedule
  const [patientList, setPatientList] = useState([])
  const [scheduleForm, setScheduleForm] = useState({
    patient_id: '',
    appointment_type: 'Follow-up Consultation',
    scheduled_date: new Date().toISOString().split('T')[0],
    scheduled_time: '10:00',
    location: 'AuraMed Oncology Clinic - Room 302',
    notes: ''
  })
  const [rescheduleData, setRescheduleData] = useState({
    scheduled_date: '',
    scheduled_time: '10:00',
    notes: ''
  })
  const [actionLoading, setActionLoading] = useState(false)

  const showToast = (msg, type = 'success') => {
    setToastMessage({ text: msg, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Load appointments
  const loadAppointmentsData = async () => {
    try {
      setLoading(true)
      const res = await fetchAppointments({
        module: moduleFilter !== 'all' ? moduleFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined
      })
      const data = res.data || {}
      const items = data.items || []
      setAppointments(items)
      if (data.stats) {
        setStats(data.stats)
      }
      if (items.length > 0 && !selectedAppt) {
        setSelectedAppt(items[0])
      } else if (selectedAppt) {
        const updated = items.find(a => a.id === selectedAppt.id)
        if (updated) setSelectedAppt(updated)
      }
    } catch (err) {
      console.error('Failed to load appointments:', err)
      showToast('Failed to load appointments from server', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAppointmentsData()
  }, [moduleFilter, statusFilter])

  // Load patients for modal
  useEffect(() => {
    fetchPatients({ page_size: 100 })
      .then(res => {
        const pts = res.data?.items || []
        setPatientList(pts)
        if (pts.length > 0 && !scheduleForm.patient_id) {
          setScheduleForm(prev => ({ ...prev, patient_id: pts[0].id }))
        }
      })
      .catch(err => console.error('Failed to load patients for appointment form', err))
  }, [])

  // Month navigation helpers
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const handlePrev = () => {
    if (calendarScope === 'month') {
      setCurrentDate(new Date(year, month - 1, 1))
    } else if (calendarScope === 'week') {
      const d = new Date(currentDate)
      d.setDate(d.getDate() - 7)
      setCurrentDate(d)
    } else {
      const d = new Date(currentDate)
      d.setDate(d.getDate() - 1)
      setCurrentDate(d)
    }
  }

  const handleNext = () => {
    if (calendarScope === 'month') {
      setCurrentDate(new Date(year, month + 1, 1))
    } else if (calendarScope === 'week') {
      const d = new Date(currentDate)
      d.setDate(d.getDate() + 7)
      setCurrentDate(d)
    } else {
      const d = new Date(currentDate)
      d.setDate(d.getDate() + 1)
      setCurrentDate(d)
    }
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  // Filtered appointments by search
  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        a.patient_name?.toLowerCase().includes(q) ||
        a.patient_code?.toLowerCase().includes(q) ||
        a.appointment_type?.toLowerCase().includes(q) ||
        a.notes?.toLowerCase().includes(q)
      )
    })
  }, [appointments, searchQuery])

  // Calendar grid computation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const prevMonthDays = new Date(year, month, 0).getDate()

    const days = []

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(prevMonthDays - i).padStart(2, '0')}`
      days.push({
        dayNumber: prevMonthDays - i,
        dateStr,
        isCurrentMonth: false,
        isToday: false
      })
    }

    // Current month days
    const todayStr = new Date().toISOString().split('T')[0]
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr
      })
    }

    // Next month padding to round up to 35 or 42
    const totalSlots = days.length <= 35 ? 35 : 42
    const nextPadding = totalSlots - days.length
    for (let i = 1; i <= nextPadding; i++) {
      const dateStr = `${year}-${String(month + 2).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      days.push({
        dayNumber: i,
        dateStr,
        isCurrentMonth: false,
        isToday: false
      })
    }

    return days
  }, [year, month])

  // Map appointments to date string for fast lookup
  const apptsByDate = useMemo(() => {
    const map = {}
    filteredAppointments.forEach(appt => {
      const d = appt.scheduled_date
      if (!map[d]) map[d] = []
      map[d].push(appt)
    })
    return map
  }, [filteredAppointments])

  // Top 5 upcoming appointments for sidebar
  const upcomingFive = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return [...appointments]
      .filter(a => a.status === 'scheduled' && a.scheduled_date >= today)
      .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date) || a.scheduled_time.localeCompare(b.scheduled_time))
      .slice(0, 5)
  }, [appointments])

  // Actions on appointment
  const handleMarkCompleted = async () => {
    if (!selectedAppt) return
    try {
      setActionLoading(true)
      await updateAppointmentStatus(selectedAppt.id, { status: 'completed' })
      showToast(`Appointment with ${selectedAppt.patient_name} marked as Completed!`)
      loadAppointmentsData()
    } catch (err) {
      console.error(err)
      showToast('Failed to update status', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleOpenReschedule = () => {
    if (!selectedAppt) return
    setRescheduleData({
      scheduled_date: selectedAppt.scheduled_date,
      scheduled_time: selectedAppt.scheduled_time || '10:00',
      notes: selectedAppt.notes || ''
    })
    setShowRescheduleModal(true)
  }

  const submitReschedule = async e => {
    e.preventDefault()
    if (!selectedAppt) return
    try {
      setActionLoading(true)
      await updateAppointmentStatus(selectedAppt.id, {
        status: 'scheduled',
        scheduled_date: rescheduleData.scheduled_date,
        scheduled_time: rescheduleData.scheduled_time,
        notes: rescheduleData.notes
      })
      showToast(`Appointment rescheduled to ${rescheduleData.scheduled_date} at ${rescheduleData.scheduled_time}`)
      setShowRescheduleModal(false)
      loadAppointmentsData()
    } catch (err) {
      console.error(err)
      showToast('Failed to reschedule appointment', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const submitCancel = async () => {
    if (!selectedAppt) return
    try {
      setActionLoading(true)
      await updateAppointmentStatus(selectedAppt.id, { status: 'cancelled' })
      showToast(`Appointment cancelled for ${selectedAppt.patient_name}`)
      setShowCancelModal(false)
      loadAppointmentsData()
    } catch (err) {
      console.error(err)
      showToast('Failed to cancel appointment', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateAppointment = async e => {
    e.preventDefault()
    try {
      setActionLoading(true)
      await scheduleAppointment(scheduleForm)
      showToast('New clinical appointment scheduled successfully!')
      setShowScheduleModal(false)
      loadAppointmentsData()
    } catch (err) {
      console.error(err)
      showToast('Failed to schedule appointment', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleEmptyDayClick = dateStr => {
    setScheduleForm(prev => ({
      ...prev,
      scheduled_date: dateStr
    }))
    setShowScheduleModal(true)
  }

  // Pill styling helper according to prompt specs
  // Breast: Pink, Cervical: Purple, PCOS: Teal, High Priority: Red
  const getPillStyle = appt => {
    const isHighPriority =
      appt.risk_level === 'high' ||
      appt.risk_level === 'critical' ||
      (appt.notes && appt.notes.toLowerCase().includes('biopsy'))

    if (isHighPriority) {
      return {
        bg: 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100',
        dot: 'bg-rose-500',
        badge: 'bg-rose-500 text-white'
      }
    }

    const mod = (appt.module || '').toLowerCase()
    if (mod === 'breast') {
      return {
        bg: 'bg-pink-50 border-pink-200 text-pink-800 hover:bg-pink-100',
        dot: 'bg-pink-500',
        badge: 'bg-pink-500 text-white'
      }
    } else if (mod === 'cervical') {
      return {
        bg: 'bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100',
        dot: 'bg-purple-500',
        badge: 'bg-purple-500 text-white'
      }
    } else if (mod === 'pcos') {
      return {
        bg: 'bg-teal-50 border-teal-200 text-teal-800 hover:bg-teal-100',
        dot: 'bg-teal-500',
        badge: 'bg-teal-500 text-white'
      }
    }

    return {
      bg: 'bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100',
      dot: 'bg-sky-500',
      badge: 'bg-sky-500 text-white'
    }
  }

  const getRiskBadge = risk => {
    const r = (risk || 'low').toLowerCase()
    if (r === 'high' || r === 'critical') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">High Risk</span>
    }
    if (r === 'moderate') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Moderate Risk</span>
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Low Risk</span>
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

      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium mb-1">
            <span>Doctor Portal</span>
            <span>/</span>
            <span className="text-teal-700">Clinical Scheduling</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-teal-600" />
            Patient Appointments & Follow-ups
          </h1>
          <p className="text-sm text-slate-500">
            Manage multi-modal oncology follow-ups, biopsy consults, and recurring evaluations
          </p>
        </div>

        <button
          onClick={() => setShowScheduleModal(true)}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl shadow-sm text-sm font-semibold transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Appointment</span>
        </button>
      </div>

      {/* TOP STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Upcoming 7 days */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Upcoming (7 Days)</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.upcoming_7_days ?? 0}</p>
            <p className="text-xs text-teal-600 mt-0.5">Active consultations</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 border border-teal-100">
            <CalendarIcon className="w-5 h-5" />
          </div>
        </div>

        {/* High Priority Follow-ups */}
        <div className="bg-white rounded-2xl p-4 border border-rose-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">High Priority Follow-ups</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{stats.high_priority ?? 0}</p>
            <p className="text-xs text-rose-500 mt-0.5">Biopsies & critical cases</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-200">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Overdue appointments */}
        <div className="bg-white rounded-2xl p-4 border border-amber-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Overdue Appointments</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{stats.overdue ?? 0}</p>
            <p className="text-xs text-amber-600 mt-0.5">Action required</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-200">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Completed this month */}
        <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Completed This Month</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{stats.completed_this_month ?? 0}</p>
            <p className="text-xs text-emerald-600 mt-0.5">Evaluations concluded</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-200">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* FILTER & TAB CONTROLS BAR */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Left: View Mode Tabs */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              viewMode === 'calendar'
                ? 'bg-white text-teal-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Calendar View</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              viewMode === 'list'
                ? 'bg-white text-teal-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>List View</span>
          </button>
        </div>

        {/* Center/Right: Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Module Filter */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
            <span>Module:</span>
            <select
              value={moduleFilter}
              onChange={e => setModuleFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="all">All Modules</option>
              <option value="breast">Breast Cancer</option>
              <option value="cervical">Cervical Cancer</option>
              <option value="pcos">PCOS Screening</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="all">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Doctor Filter (Mocked to Dr. Mehta) */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
            <span>Doctor:</span>
            <select className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500">
              <option value="current">Current Doctor (You)</option>
              <option value="all">All Doctors</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search patient or notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 w-48"
            />
          </div>
        </div>
      </div>

      {/* MAIN VIEW CONTENT */}
      {viewMode === 'calendar' ? (
        /* CALENDAR LAYOUT (Grid + Right Panel) */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Calendar Grid Section (xl:col-span-8) */}
          <div className="xl:col-span-8 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            {/* Calendar Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <h2 className="text-lg font-bold text-slate-900">
                  {MONTH_NAMES[month]} {year}
                </h2>
                <button
                  onClick={handleToday}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors"
                >
                  Today
                </button>
              </div>

              <div className="flex items-center space-x-2">
                {/* Month/Week/Day toggle */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium text-slate-600">
                  <button
                    onClick={() => setCalendarScope('month')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      calendarScope === 'month' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'hover:text-slate-900'
                    }`}
                  >
                    Month
                  </button>
                  <button
                    onClick={() => setCalendarScope('week')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      calendarScope === 'week' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'hover:text-slate-900'
                    }`}
                  >
                    Week
                  </button>
                  <button
                    onClick={() => setCalendarScope('day')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      calendarScope === 'day' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'hover:text-slate-900'
                    }`}
                  >
                    Day
                  </button>
                </div>

                {/* Prev / Next buttons */}
                <div className="flex items-center space-x-1">
                  <button
                    onClick={handlePrev}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                    title="Previous"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNext}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                    title="Next"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* MONTH VIEW GRID */}
            {calendarScope === 'month' && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {/* Day Header Row */}
                <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-center text-xs font-bold text-slate-600 py-2.5">
                  {DAYS_OF_WEEK.map(d => (
                    <div key={d}>{d}</div>
                  ))}
                </div>

                {/* Day Cells */}
                <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 bg-white">
                  {calendarDays.map((item, idx) => {
                    const dayAppts = apptsByDate[item.dateStr] || []
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          if (dayAppts.length === 0 && item.isCurrentMonth) {
                            handleEmptyDayClick(item.dateStr)
                          }
                        }}
                        className={`min-h-[105px] p-2 transition-all cursor-pointer relative group ${
                          !item.isCurrentMonth ? 'bg-slate-50/50 text-slate-300' : 'hover:bg-teal-50/20'
                        } ${item.isToday ? 'bg-teal-50/30 ring-1 ring-inset ring-teal-300' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center ${
                              item.isToday
                                ? 'bg-teal-600 text-white font-bold'
                                : item.isCurrentMonth
                                ? 'text-slate-700'
                                : 'text-slate-300'
                            }`}
                          >
                            {item.dayNumber}
                          </span>
                          {dayAppts.length > 0 && (
                            <span className="text-[10px] font-bold text-slate-400">
                              {dayAppts.length} {dayAppts.length === 1 ? 'appt' : 'appts'}
                            </span>
                          )}
                        </div>

                        {/* Appointment Pills */}
                        <div className="space-y-1 overflow-y-auto max-h-[85px] no-scrollbar">
                          {dayAppts.slice(0, 3).map(appt => {
                            const style = getPillStyle(appt)
                            const isSelected = selectedAppt?.id === appt.id
                            return (
                              <button
                                key={appt.id}
                                onClick={e => {
                                  e.stopPropagation()
                                  setSelectedAppt(appt)
                                }}
                                className={`w-full text-left px-2 py-1 rounded-md text-[11px] font-medium border transition-all truncate flex items-center space-x-1.5 shadow-2xs ${
                                  style.bg
                                } ${isSelected ? 'ring-2 ring-teal-500 font-bold' : ''}`}
                                title={`${appt.patient_name} - ${appt.appointment_type}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
                                <span className="truncate">{appt.patient_name}</span>
                              </button>
                            )
                          })}
                          {dayAppts.length > 3 && (
                            <div className="text-[10px] text-slate-400 font-semibold pl-1">
                              +{dayAppts.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* WEEK VIEW */}
            {calendarScope === 'week' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 italic">Showing 7-day schedule window starting from {currentDate.toLocaleDateString()}</p>
                <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
                  {Array.from({ length: 7 }).map((_, i) => {
                    const d = new Date(currentDate)
                    d.setDate(d.getDate() - d.getDay() + i)
                    const dateStr = d.toISOString().split('T')[0]
                    const dayAppts = apptsByDate[dateStr] || []
                    return (
                      <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <div className="text-center pb-2 border-b border-slate-200 mb-2">
                          <p className="text-xs font-bold text-slate-600">{DAYS_OF_WEEK[i]}</p>
                          <p className="text-sm font-extrabold text-slate-800">{d.getDate()}</p>
                        </div>
                        <div className="space-y-1.5">
                          {dayAppts.length === 0 ? (
                            <p className="text-[11px] text-slate-400 text-center py-2">None</p>
                          ) : (
                            dayAppts.map(appt => (
                              <div
                                key={appt.id}
                                onClick={() => setSelectedAppt(appt)}
                                className={`p-1.5 rounded-lg border text-xs cursor-pointer ${getPillStyle(appt).bg}`}
                              >
                                <p className="font-semibold truncate">{appt.patient_name}</p>
                                <p className="text-[10px] text-slate-500">{appt.scheduled_time}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* DAY VIEW */}
            {calendarScope === 'day' && (
              <div className="space-y-3">
                <div className="bg-teal-50/50 p-3 rounded-xl border border-teal-200/60 flex items-center justify-between">
                  <span className="text-xs font-semibold text-teal-800">
                    Day Schedule: {currentDate.toDateString()}
                  </span>
                  <span className="text-xs text-slate-500">
                    {(apptsByDate[currentDate.toISOString().split('T')[0]] || []).length} scheduled
                  </span>
                </div>
                <div className="space-y-2">
                  {(apptsByDate[currentDate.toISOString().split('T')[0]] || []).length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">
                      No appointments scheduled for this day.{' '}
                      <button
                        onClick={() => handleEmptyDayClick(currentDate.toISOString().split('T')[0])}
                        className="text-teal-600 font-semibold underline ml-1"
                      >
                        Schedule now
                      </button>
                    </div>
                  ) : (
                    (apptsByDate[currentDate.toISOString().split('T')[0]] || []).map(appt => (
                      <div
                        key={appt.id}
                        onClick={() => setSelectedAppt(appt)}
                        className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between ${getPillStyle(appt).bg}`}
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-900">{appt.patient_name}</p>
                          <p className="text-xs text-slate-600">{appt.appointment_type} • {appt.location}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-extrabold text-slate-800">{appt.scheduled_time}</p>
                          {getRiskBadge(appt.risk_level)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* LEGEND AT BOTTOM (Required by prompt) */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs">
              <span className="font-semibold text-slate-600">Legend:</span>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-md bg-pink-500" />
                <span className="text-slate-600">Breast Cancer</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-md bg-purple-500" />
                <span className="text-slate-600">Cervical Cancer</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-md bg-teal-500" />
                <span className="text-slate-600">PCOS Screening</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-md bg-rose-500" />
                <span className="text-rose-600 font-semibold">High Priority / Biopsy</span>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL - Selected Appointment & Upcoming List (xl:col-span-4) */}
          <div className="xl:col-span-4 space-y-6">
            {/* SELECTED APPOINTMENT CARD */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                  <User className="w-4 h-4 text-teal-600" />
                  Appointment Details
                </h3>
                {selectedAppt && (
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${
                    selectedAppt.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedAppt.status === 'cancelled'
                      ? 'bg-slate-200 text-slate-600'
                      : 'bg-teal-100 text-teal-800'
                  }`}>
                    {selectedAppt.status}
                  </span>
                )}
              </div>

              {selectedAppt ? (
                <div className="space-y-4">
                  {/* Patient Initials Avatar & Name & Risk Badge */}
                  <div className="flex items-start space-x-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-teal-600 to-cyan-500 text-white font-bold flex items-center justify-center text-base shadow-xs flex-shrink-0">
                      {(selectedAppt.patient_name || 'PT')
                        .split(' ')
                        .map(n => n[0])
                        .slice(0, 2)
                        .join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-bold text-slate-900 truncate">
                          {selectedAppt.patient_name}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-400 font-mono">ID: {selectedAppt.patient_code || 'P-001'}</p>
                      <div className="mt-1">
                        {getRiskBadge(selectedAppt.risk_level)}
                      </div>
                    </div>
                  </div>

                  {/* Detail items */}
                  <div className="space-y-2.5 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60 text-xs">
                    <div className="flex items-center space-x-2 text-slate-700">
                      <CalendarIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="font-semibold text-slate-900">{selectedAppt.scheduled_date}</span>
                      <span className="text-slate-400">•</span>
                      <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="font-semibold text-slate-900">{selectedAppt.scheduled_time}</span>
                    </div>

                    <div className="flex items-center space-x-2 text-slate-700">
                      <Stethoscope className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span>{selectedAppt.appointment_type}</span>
                    </div>

                    <div className="flex items-center space-x-2 text-slate-700">
                      <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{selectedAppt.location}</span>
                    </div>

                    <div className="flex items-center space-x-2 text-slate-700">
                      <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span>Doctor: {selectedAppt.doctor_name || 'Dr. Mehta'}</span>
                    </div>

                    {selectedAppt.notes && (
                      <div className="pt-2 border-t border-slate-200">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase">Clinical Notes</p>
                        <p className="text-slate-700 mt-0.5 leading-relaxed">{selectedAppt.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Three Action Buttons (prompt spec) */}
                  <div className="space-y-2 pt-1">
                    <button
                      onClick={handleMarkCompleted}
                      disabled={actionLoading || selectedAppt.status === 'completed'}
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center space-x-2 transition-all"
                    >
                      <Check className="w-4 h-4" />
                      <span>Mark as Completed</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleOpenReschedule}
                        disabled={actionLoading || selectedAppt.status === 'cancelled'}
                        className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Reschedule</span>
                      </button>

                      <button
                        onClick={() => setShowCancelModal(true)}
                        disabled={actionLoading || selectedAppt.status === 'cancelled'}
                        className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Select an appointment pill to inspect details
                </div>
              )}
            </div>

            {/* UPCOMING APPOINTMENTS LIST (Next 5) */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center justify-between">
                <span>Upcoming Appointments</span>
                <span className="text-xs font-medium text-slate-400">Next 5</span>
              </h3>

              <div className="divide-y divide-slate-100">
                {upcomingFive.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No upcoming appointments</p>
                ) : (
                  upcomingFive.map(appt => (
                    <div
                      key={appt.id}
                      onClick={() => setSelectedAppt(appt)}
                      className={`py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 px-2 rounded-xl transition-all ${
                        selectedAppt?.id === appt.id ? 'bg-teal-50/40' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                          {(appt.patient_name || 'PT').split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{appt.patient_name}</p>
                          <p className="text-[11px] text-slate-500 capitalize">{appt.module} • {appt.scheduled_date}</p>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {getRiskBadge(appt.risk_level)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* LIST VIEW (Table with all appointments) */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Module</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No appointments matching current criteria
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map(appt => (
                    <tr
                      key={appt.id}
                      onClick={() => setSelectedAppt(appt)}
                      className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                        selectedAppt?.id === appt.id ? 'bg-teal-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center flex-shrink-0">
                            {(appt.patient_name || 'PT').split(' ').map(n => n[0]).slice(0, 2).join('')}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{appt.patient_name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{appt.patient_code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize font-medium">{appt.module} Cancer</span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {appt.scheduled_date} <span className="text-slate-400 font-normal">at {appt.scheduled_time}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{appt.appointment_type}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          appt.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : appt.status === 'cancelled'
                            ? 'bg-slate-200 text-slate-600'
                            : 'bg-teal-100 text-teal-800'
                        }`}>
                          {appt.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-[180px] truncate">{appt.location}</td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setSelectedAppt(appt)
                            handleOpenReschedule()
                          }}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-medium"
                        >
                          Reschedule
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setSelectedAppt(appt)
                            handleMarkCompleted()
                          }}
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md text-[11px] font-medium"
                        >
                          Complete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SCHEDULE APPOINTMENT MODAL */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-teal-600" />
                Schedule New Clinical Appointment
              </h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Patient *</label>
                <select
                  value={scheduleForm.patient_id}
                  onChange={e => setScheduleForm({ ...scheduleForm, patient_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-teal-500"
                  required
                >
                  {patientList.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.patient_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Appointment Type</label>
                <select
                  value={scheduleForm.appointment_type}
                  onChange={e => setScheduleForm({ ...scheduleForm, appointment_type: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-teal-500"
                >
                  <option value="Biopsy Consultation">Biopsy Consultation (High Risk)</option>
                  <option value="Repeat Ultrasound">Repeat Ultrasound (30 Days)</option>
                  <option value="Routine Follow-up">Routine Follow-up (6 Months)</option>
                  <option value="Tumor Board Review">Tumor Board Multi-Disciplinary Review</option>
                  <option value="General Consultation">General Clinical Consultation</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Preferred Date *</label>
                  <input
                    type="date"
                    value={scheduleForm.scheduled_date}
                    onChange={e => setScheduleForm({ ...scheduleForm, scheduled_date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Scheduled Time</label>
                  <input
                    type="time"
                    value={scheduleForm.scheduled_time}
                    onChange={e => setScheduleForm({ ...scheduleForm, scheduled_time: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Location / Room</label>
                <input
                  type="text"
                  value={scheduleForm.location}
                  onChange={e => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-teal-500"
                  placeholder="e.g. AuraMed Oncology Clinic - Room 302"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Clinical Notes</label>
                <textarea
                  rows={2}
                  value={scheduleForm.notes}
                  onChange={e => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                  placeholder="Add notes for patient prep, biopsy instructions, or medical records..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-white bg-teal-600 hover:bg-teal-700 font-semibold shadow-xs"
                >
                  Confirm Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESCHEDULE MODAL */}
      {showRescheduleModal && selectedAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-teal-600" />
                Reschedule Appointment
              </h3>
              <button onClick={() => setShowRescheduleModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitReschedule} className="space-y-3 text-xs">
              <p className="text-slate-600">
                Rescheduling consultation for <span className="font-bold text-slate-900">{selectedAppt.patient_name}</span>.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Date</label>
                <input
                  type="date"
                  value={rescheduleData.scheduled_date}
                  onChange={e => setRescheduleData({ ...rescheduleData, scheduled_date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Time</label>
                <input
                  type="time"
                  value={rescheduleData.scheduled_time}
                  onChange={e => setRescheduleData({ ...rescheduleData, scheduled_time: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reschedule Reason / Notes</label>
                <textarea
                  rows={2}
                  value={rescheduleData.notes}
                  onChange={e => setRescheduleData({ ...rescheduleData, notes: e.target.value })}
                  placeholder="Reason for reschedule..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-white bg-teal-600 hover:bg-teal-700 font-semibold shadow-xs"
                >
                  Save Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL CONFIRMATION MODAL */}
      {showCancelModal && selectedAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Cancel Appointment?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to cancel the appointment for{' '}
                <span className="font-semibold text-slate-800">{selectedAppt.patient_name}</span> on{' '}
                <span className="font-semibold text-slate-800">{selectedAppt.scheduled_date}</span>?
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 text-xs font-semibold"
              >
                No, Keep
              </button>
              <button
                onClick={submitCancel}
                disabled={actionLoading}
                className="flex-1 py-2 rounded-xl text-white bg-rose-600 hover:bg-rose-700 text-xs font-semibold shadow-xs"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
