import React, { useState, useEffect, useMemo } from 'react'
import {
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Stethoscope,
  User,
  Ban,
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import { fetchAdminAppointments, cancelAdminAppointment } from '../../services/adminService'

export default function AdminAppointments() {
  const [loading, setLoading] = useState(true)
  const [appointments, setAppointments] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [toastMessage, setToastMessage] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 3500)
  }

  const loadAppointments = async () => {
    try {
      setLoading(true)
      const res = await fetchAdminAppointments({
        status: statusFilter !== 'all' ? statusFilter : undefined,
      })
      setAppointments(res.data.items || [])
    } catch (err) {
      console.error('Error loading admin appointments:', err)
      showToast('Failed to load appointments', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelAppointment = async (id, patientName) => {
    if (!window.confirm(`Are you sure you want to cancel the appointment for ${patientName || 'this patient'}?`)) {
      return
    }
    try {
      setCancellingId(id)
      await cancelAdminAppointment(id, 'Cancelled via Administrative Portal')
      showToast(`Appointment for ${patientName || 'patient'} cancelled successfully`)
      await loadAppointments()
    } catch (err) {
      console.error('Failed to cancel appointment:', err)
      showToast('Failed to cancel appointment', 'error')
    } finally {
      setCancellingId(null)
    }
  }

  useEffect(() => {
    loadAppointments()
  }, [statusFilter])

  const filteredAppointments = useMemo(() => {
    if (!searchQuery.trim()) return appointments
    const q = searchQuery.toLowerCase()
    return appointments.filter(
      (a) =>
        a.patient_name?.toLowerCase().includes(q) ||
        a.patient_code?.toLowerCase().includes(q) ||
        a.doctor_name?.toLowerCase().includes(q) ||
        a.appointment_type?.toLowerCase().includes(q) ||
        a.location?.toLowerCase().includes(q),
    )
  }, [appointments, searchQuery])

  const stats = useMemo(() => {
    const total = appointments.length
    const scheduled = appointments.filter((a) => a.status === 'scheduled').length
    const completed = appointments.filter((a) => a.status === 'completed').length
    const cancelled = appointments.filter((a) => a.status === 'cancelled').length
    return { total, scheduled, completed, cancelled }
  }, [appointments])

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {toastMessage && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-lg border text-sm font-medium flex items-center space-x-2 transition-all ${
              toastMessage.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            {toastMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Calendar className="w-8 h-8 text-teal-600" />
              Clinical Appointments
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Platform-wide appointment schedule, clinical attendance status, and consultations
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-xs font-semibold text-slate-500">Total Consultations</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{stats.total}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-xs font-semibold text-teal-600">Upcoming / Scheduled</p>
            <p className="text-2xl font-black text-teal-700 mt-1">{stats.scheduled}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-xs font-semibold text-emerald-600">Completed</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">{stats.completed}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-xs font-semibold text-rose-600">Cancelled</p>
            <p className="text-2xl font-black text-rose-700 mt-1">{stats.cancelled}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by patient, doctor, type, location..."
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500/30"
            >
              <option value="all">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Loading appointment schedules...</p>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No appointments found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No appointments match the selected filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Consultant Doctor</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Facility</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredAppointments.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono">
                        <p className="font-semibold text-slate-900">{a.scheduled_date}</p>
                        <p className="text-[11px] text-slate-500">{a.scheduled_time || '10:00 AM'}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900">{a.patient_name}</p>
                        <p className="text-[11px] font-mono text-slate-500">{a.patient_code}</p>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">{a.doctor_name}</td>
                      <td className="py-3.5 px-4 text-slate-700">{a.appointment_type || 'Follow-up'}</td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <p className="truncate max-w-xs">{a.location || 'AuraMed Facility'}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            a.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : a.status === 'scheduled'
                              ? 'bg-teal-100 text-teal-800 border border-teal-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {a.status === 'scheduled' ? (
                          <button
                            onClick={() => handleCancelAppointment(a.id, a.patient_name)}
                            disabled={cancellingId === a.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            title="Cancel appointment"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>{cancellingId === a.id ? 'Cancelling...' : 'Cancel'}</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
