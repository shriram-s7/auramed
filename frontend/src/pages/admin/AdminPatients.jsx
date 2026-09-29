import React, { useState, useEffect, useMemo } from 'react'
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  Phone,
  Mail,
  Calendar,
  User,
  Activity,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import InitialsAvatar from '../../components/common/InitialsAvatar'
import { fetchAdminPatients, deleteAdminPatient } from '../../services/adminService'

export default function AdminPatients() {
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 3500)
  }

  const loadPatients = async () => {
    try {
      setLoading(true)
      const res = await fetchAdminPatients({
        search: searchQuery || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      })
      setPatients(res.data.items || [])
    } catch (err) {
      console.error('Error fetching admin patients:', err)
      showToast('Failed to fetch patients list', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPatients()
  }, [statusFilter])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    loadPatients()
  }

  const handleDeactivate = async () => {
    if (!selectedPatient) return
    try {
      setActionLoading(true)
      await deleteAdminPatient(selectedPatient.id)
      showToast(`Patient ${selectedPatient.full_name} (${selectedPatient.patient_code}) deactivated successfully`)
      setShowDeleteModal(false)
      setSelectedPatient(null)
      loadPatients()
    } catch (err) {
      console.error(err)
      showToast('Failed to deactivate patient', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const stats = useMemo(() => {
    const total = patients.length
    const active = patients.filter((p) => p.status === 'active').length
    const urgent = patients.filter((p) => p.is_urgent).length
    const inactive = patients.filter((p) => p.status === 'inactive').length
    return { total, active, urgent, inactive }
  }, [patients])

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Toast */}
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

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Users className="w-8 h-8 text-teal-600" />
              Patient Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Oversee registered platform patients, assigned clinicians, and profile statuses
            </p>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-xs font-semibold text-slate-500">Total Patients</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{stats.total}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-xs font-semibold text-emerald-600">Active Profiles</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">{stats.active}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-xs font-semibold text-amber-600">Urgent Flags</p>
            <p className="text-2xl font-black text-amber-700 mt-1">{stats.urgent}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-xs font-semibold text-slate-400">Inactive / Archived</p>
            <p className="text-2xl font-black text-slate-500 mt-1">{stats.inactive}</p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by patient name, code, or email..."
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-colors"
            />
          </form>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500/30"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Patients Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Loading patients from registry...</p>
            </div>
          ) : patients.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No patients found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No patient records match the current search criteria or status filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Assigned Doctor</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {patients.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900 flex items-center space-x-2.5">
                        <InitialsAvatar name={p.full_name} size="sm" />
                        <div>
                          <p className="font-bold text-slate-900">{p.full_name}</p>
                          <p className="text-[11px] text-slate-500 font-normal">
                            {p.gender || 'Female'} {p.date_of_birth ? `• DOB: ${p.date_of_birth}` : ''}
                          </p>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-600">
                        {p.patient_code}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-slate-800">{p.email || '—'}</p>
                        <p className="text-[11px] text-slate-500">{p.phone || '—'}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        {p.assigned_doctor?.name ? (
                          <div>
                            <p className="font-semibold text-slate-900">{p.assigned_doctor.name}</p>
                            <p className="text-[11px] text-slate-500">{p.assigned_doctor.specialty || 'General'}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {p.status}
                          </span>
                          {p.is_urgent && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              Urgent
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {p.status === 'active' ? (
                          <button
                            onClick={() => {
                              setSelectedPatient(p)
                              setShowDeleteModal(true)
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Deactivate Patient"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Deactivated</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Deactivation Modal */}
        {showDeleteModal && selectedPatient && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h3 className="text-base font-bold text-slate-900">Deactivate Patient Account?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to deactivate{' '}
                  <span className="font-semibold text-slate-800">{selectedPatient.full_name}</span> (
                  {selectedPatient.patient_code})? The patient will no longer be able to log in.
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeactivate}
                  disabled={actionLoading}
                  className="flex-1 py-2 rounded-xl text-white bg-rose-600 hover:bg-rose-700 text-xs font-semibold shadow-xs"
                >
                  {actionLoading ? 'Deactivating...' : 'Confirm Deactivation'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
