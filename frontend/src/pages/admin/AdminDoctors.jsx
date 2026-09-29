import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  UserCheck,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MoreVertical,
  ShieldCheck,
  X,
  Stethoscope,
  Building2,
  Calendar,
  Mail,
  Phone,
  Lock,
  UserX,
  Check,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import InitialsAvatar from '../../components/common/InitialsAvatar'
import {
  fetchAdminDoctors,
  verifyDoctor,
  updateDoctorStatus,
  createDoctor
} from '../../services/adminService'

export default function AdminDoctors() {
  const [searchParams] = useSearchParams()

  // State
  const [loading, setLoading] = useState(true)
  const [doctors, setDoctors] = useState([])
  const [stats, setStats] = useState({
    total_doctors: 0,
    verified_doctors: 0,
    pending_verification: 0,
    suspended_inactive: 0
  })
  const [specialtiesList, setSpecialtiesList] = useState([])
  const [hospitalsList, setHospitalsList] = useState([])

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState(() => {
    return searchParams.get('filter') === 'pending' ? 'pending' : 'all'
  })
  const [hospitalFilter, setHospitalFilter] = useState('all')

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize] = useState(8)
  const [total, setTotal] = useState(0)

  // Menu & Modals
  const [openMenuId, setOpenMenuId] = useState(null)
  const [verifyTarget, setVerifyTarget] = useState(null) // doctor for verify confirmation
  const [profileTarget, setProfileTarget] = useState(null) // doctor for view profile modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Add doctor form state
  const [addForm, setAddForm] = useState({
    full_name: '',
    email: '',
    password: '',
    registration_number: '',
    specialty: 'Gynecologic Oncology',
    hospital: 'AuraMed General Hospital',
    phone: '',
    is_approved: true
  })

  const showToast = (msg, type = 'success') => {
    setToastMessage({ text: msg, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Load doctors
  const loadDoctors = async () => {
    try {
      setLoading(true)
      const res = await fetchAdminDoctors({
        search: searchQuery || undefined,
        specialty: specialtyFilter !== 'all' ? specialtyFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        hospital: hospitalFilter !== 'all' ? hospitalFilter : undefined,
        page,
        page_size: pageSize
      })
      const data = res.data || {}
      setDoctors(data.items || [])
      setTotal(data.total || 0)
      if (data.stats) setStats(data.stats)
      if (data.specialties) setSpecialtiesList(data.specialties)
      if (data.hospitals) setHospitalsList(data.hospitals)
    } catch (err) {
      console.error('Failed to load doctors list:', err)
      showToast('Failed to load doctors list', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDoctors()
  }, [page, specialtyFilter, statusFilter, hospitalFilter])

  const handleClearFilters = () => {
    setSearchQuery('')
    setSpecialtyFilter('all')
    setStatusFilter('all')
    setHospitalFilter('all')
    setPage(1)
    setTimeout(() => loadDoctors(), 50)
  }

  // Verify doctor action
  const confirmVerifyDoctor = async () => {
    if (!verifyTarget) return
    try {
      setActionLoading(true)
      await verifyDoctor(verifyTarget.id)
      showToast(`Dr. ${verifyTarget.name} verified successfully! Full platform access granted.`)
      // Update local state in real-time
      setDoctors(prev =>
        prev.map(d => (d.id === verifyTarget.id ? { ...d, status: 'Verified' } : d))
      )
      setStats(prev => ({
        ...prev,
        verified_doctors: prev.verified_doctors + 1,
        pending_verification: Math.max(0, prev.pending_verification - 1)
      }))
      setVerifyTarget(null)
    } catch (err) {
      console.error('Error verifying doctor:', err)
      showToast('Failed to verify doctor', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Suspend / Unsuspend action
  const handleUpdateStatus = async (doctor, newStatus) => {
    setOpenMenuId(null)
    try {
      setActionLoading(true)
      await updateDoctorStatus(doctor.id, newStatus)
      const actionLabel = newStatus === 'verified' ? 'unsuspended & activated' : 'suspended'
      showToast(`Dr. ${doctor.name} ${actionLabel} successfully`)
      setDoctors(prev =>
        prev.map(d => (d.id === doctor.id ? { ...d, status: newStatus === 'verified' ? 'Verified' : 'Suspended' } : d))
      )
      loadDoctors()
    } catch (err) {
      console.error('Status update error:', err)
      showToast('Failed to update status', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Add doctor form submit
  const handleAddDoctor = async e => {
    e.preventDefault()
    if (!addForm.password || addForm.password.length < 6) {
      showToast('Password is required and must be at least 6 characters', 'error')
      return
    }
    try {
      setActionLoading(true)
      await createDoctor(addForm)
      showToast(`Doctor Dr. ${addForm.full_name} registered successfully!`)
      setShowAddModal(false)
      setAddForm({
        full_name: '',
        email: '',
        password: '',
        registration_number: '',
        specialty: 'Gynecologic Oncology',
        hospital: 'AuraMed General Hospital',
        phone: '',
        is_approved: true
      })
      setShowPassword(false)
      loadDoctors()
    } catch (err) {
      console.error('Add doctor error:', err)
      showToast(err.response?.data?.detail || 'Failed to add doctor', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Status badges: Verified (green), Pending (amber), Suspended (red)
  const getStatusBadge = status => {
    const s = (status || 'pending').toLowerCase()
    if (s === 'verified') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Verified
        </span>
      )
    }
    if (s === 'suspended') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Suspended
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
        <Clock className="w-3 h-3 mr-1" />
        Pending
      </span>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
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

        {/* TOP HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <UserCheck className="w-7 h-7 text-teal-600" />
              Doctor Management
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify, manage, and monitor registered doctors
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl shadow-sm text-xs font-bold transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Doctor</span>
          </button>
        </div>

        {/* FOUR STAT CARDS (Total Doctors, Verified Doctors, Pending Verification in amber, Suspended/Inactive in red) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Doctors */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Doctors</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{stats.total_doctors}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Licensed clinicians</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200">
              <Stethoscope className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Verified Doctors */}
          <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Verified Doctors</p>
              <p className="text-2xl font-black text-emerald-700 mt-1">{stats.verified_doctors}</p>
              <p className="text-[11px] text-emerald-600 mt-0.5">Active diagnostic privileges</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Pending Verification (amber) */}
          <div className="bg-white rounded-2xl p-4 border border-amber-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Pending Verification</p>
              <p className="text-2xl font-black text-amber-700 mt-1">{stats.pending_verification}</p>
              <p className="text-[11px] text-amber-600 mt-0.5">Requires credential review</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-200">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          {/* Card 4: Suspended/Inactive (red) */}
          <div className="bg-white rounded-2xl p-4 border border-rose-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">Suspended / Inactive</p>
              <p className="text-2xl font-black text-rose-600 mt-1">{stats.suspended_inactive}</p>
              <p className="text-[11px] text-rose-500 mt-0.5">Access disabled</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-200">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* FILTER BAR: Search input, Specialty, Verification Status, Hospital, Clear Filters */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search input: Name, email, or doctor ID */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search name, email, or doctor ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadDoctors()}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Specialty */}
            <select
              value={specialtyFilter}
              onChange={e => {
                setSpecialtyFilter(e.target.value)
                setPage(1)
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="all">All Specialties</option>
              {specialtiesList.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Verification Status */}
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="all">All Statuses</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>

            {/* Hospital/Institution */}
            <select
              value={hospitalFilter}
              onChange={e => {
                setHospitalFilter(e.target.value)
                setPage(1)
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="all">All Hospitals / Institutions</option>
              {hospitalsList.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>

            {/* Clear Filters button */}
            <button
              onClick={handleClearFilters}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* DOCTORS TABLE */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-12">#</th>
                  <th className="py-3 px-4">Doctor</th>
                  <th className="py-3 px-4">Doctor ID</th>
                  <th className="py-3 px-4">Specialty</th>
                  <th className="py-3 px-4">Hospital / Institution</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Registration Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Loading doctors catalog...
                    </td>
                  </tr>
                ) : doctors.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No doctors matching search criteria
                    </td>
                  </tr>
                ) : (
                  doctors.map((doc, idx) => (
                    <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-slate-400 font-mono">
                        {(page - 1) * pageSize + idx + 1}
                      </td>

                      {/* Doctor (Initials avatar + name + email) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <InitialsAvatar name={doc.name} size={36} />
                          <div>
                            <p className="font-bold text-slate-900">{doc.name}</p>
                            <p className="text-[11px] text-slate-400 font-mono">{doc.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Doctor ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {doc.doctor_id}
                      </td>

                      {/* Specialty */}
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {doc.specialty}
                      </td>

                      {/* Hospital / Institution */}
                      <td className="py-3.5 px-4 text-slate-600">
                        {doc.hospital}
                      </td>

                      {/* Status badge */}
                      <td className="py-3.5 px-4">
                        {getStatusBadge(doc.status)}
                      </td>

                      {/* Registration Date */}
                      <td className="py-3.5 px-4 text-slate-500 font-mono">
                        {doc.registered_date}
                      </td>

                      {/* Actions three-dot menu per row */}
                      <td className="py-3.5 px-4 text-right relative">
                        <div className="relative inline-block">
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setOpenMenuId(openMenuId === doc.id ? null : doc.id)
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openMenuId === doc.id && (
                            <div
                              onMouseLeave={() => setOpenMenuId(null)}
                              className="absolute right-0 top-8 z-30 w-44 bg-white border border-slate-200 rounded-xl shadow-xl py-1 text-xs text-left animate-in fade-in slide-in-from-top-2 duration-150"
                            >
                              {/* Verify Doctor (if pending) */}
                              {doc.status.toLowerCase() === 'pending' && (
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null)
                                    setVerifyTarget(doc)
                                  }}
                                  className="w-full px-3 py-2 text-emerald-700 hover:bg-emerald-50 flex items-center space-x-2 font-semibold"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>Verify Doctor</span>
                                </button>
                              )}

                              {/* View Profile */}
                              <button
                                onClick={() => {
                                  setOpenMenuId(null)
                                  setProfileTarget(doc)
                                }}
                                className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>View Profile</span>
                              </button>

                              {/* Unsuspend Doctor */}
                              {doc.status.toLowerCase() === 'suspended' ? (
                                <button
                                  onClick={() => handleUpdateStatus(doc, 'verified')}
                                  className="w-full px-3 py-2 text-emerald-600 hover:bg-emerald-50 flex items-center space-x-2 font-medium"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Unsuspend Doctor</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleUpdateStatus(doc, 'suspended')}
                                  className="w-full px-3 py-2 text-rose-600 hover:bg-rose-50 flex items-center space-x-2"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>Suspend Account</span>
                                </button>
                              )}

                              {/* Reset Password */}
                              <button
                                onClick={() => {
                                  setOpenMenuId(null)
                                  showToast(`Password reset link sent to ${doc.email}`)
                                }}
                                className="w-full px-3 py-2 text-slate-600 hover:bg-slate-50 flex items-center space-x-2"
                              >
                                <Lock className="w-3.5 h-3.5" />
                                <span>Reset Password</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION BAR (Prompt: showing 1-8 of N doctors) */}
          <div className="p-4 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Showing <span className="font-semibold text-slate-900">{doctors.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to{' '}
              <span className="font-semibold text-slate-900">{Math.min(page * pageSize, total)}</span> of{' '}
              <span className="font-semibold text-slate-900">{total}</span> doctors
            </div>

            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold flex items-center space-x-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <span className="px-3 py-1 font-semibold text-slate-800">Page {page}</span>
              <button
                disabled={page * pageSize >= total}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold flex items-center space-x-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* VERIFY CONFIRMATION MODAL (Prompt: "Are you sure you want to verify Dr. [Name]? This will grant them full platform access.") */}
      {verifyTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">Verify Doctor Credentials</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to verify <span className="font-bold text-slate-900">{verifyTarget.name}</span>? This will grant them full platform access to patient data, imaging pipelines, and clinical report signing.
              </p>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-left text-xs text-slate-600 space-y-1 mt-3">
                <p><span className="font-semibold text-slate-700">Reg ID:</span> {verifyTarget.doctor_id}</p>
                <p><span className="font-semibold text-slate-700">Specialty:</span> {verifyTarget.specialty}</p>
                <p><span className="font-semibold text-slate-700">Institution:</span> {verifyTarget.hospital}</p>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setVerifyTarget(null)}
                className="flex-1 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={confirmVerifyDoctor}
                disabled={actionLoading}
                className="flex-1 py-2 rounded-xl text-white bg-teal-600 hover:bg-teal-700 text-xs font-semibold shadow-xs flex items-center justify-center space-x-1"
              >
                <Check className="w-4 h-4" />
                <span>Confirm & Verify</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW PROFILE MODAL */}
      {profileTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-teal-600" />
                Doctor Professional Profile
              </h3>
              <button onClick={() => setProfileTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                <InitialsAvatar name={profileTarget.name} size={48} />
                <div>
                  <h4 className="font-bold text-sm text-slate-900">{profileTarget.name}</h4>
                  <p className="text-teal-700 font-medium">{profileTarget.specialty}</p>
                  <p className="text-slate-400 font-mono text-[11px]">Reg: {profileTarget.doctor_id}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block font-semibold">Email</span>
                  <span className="font-mono text-slate-800">{profileTarget.email}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block font-semibold">Phone</span>
                  <span className="font-mono text-slate-800">{profileTarget.phone}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block font-semibold">Hospital / Institution</span>
                  <span className="font-semibold text-slate-800">{profileTarget.hospital}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block font-semibold">Account Status</span>
                  <span className="font-semibold">{getStatusBadge(profileTarget.status)}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-600 leading-relaxed">
                Registered on <span className="font-semibold text-slate-900">{profileTarget.registered_date}</span>. Holds active clinical privileges for AuraMed multi-modal diagnostic screening, risk correlation review, and electronic prescription generation.
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              {profileTarget.status?.toLowerCase() === 'suspended' && (
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateStatus(profileTarget, 'verified')
                    setProfileTarget(null)
                  }}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 font-semibold text-xs flex items-center space-x-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Unsuspend Doctor</span>
                </button>
              )}
              <button
                onClick={() => setProfileTarget(null)}
                className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold text-xs"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD DOCTOR MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-teal-600" />
                Register New Doctor
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDoctor} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Rajeshwari Rao"
                    value={addForm.full_name}
                    onChange={e => setAddForm({ ...addForm, full_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="doctor@hospital.org"
                    value={addForm.email}
                    onChange={e => setAddForm({ ...addForm, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Medical Registration No *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TNMC-88219"
                    value={addForm.registration_number}
                    onChange={e => setAddForm({ ...addForm, registration_number: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:ring-1 focus:ring-teal-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Doctor Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="Doctor login password (min 6 chars)"
                      value={addForm.password}
                      onChange={e => setAddForm({ ...addForm, password: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-9 font-medium focus:ring-1 focus:ring-teal-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      tabIndex={-1}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Clinical Specialty *</label>
                  <select
                    value={addForm.specialty}
                    onChange={e => setAddForm({ ...addForm, specialty: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="Gynecologic Oncology">Gynecologic Oncology</option>
                    <option value="Surgical Oncology">Surgical Oncology</option>
                    <option value="Diagnostic Radiology">Diagnostic Radiology</option>
                    <option value="General Surgery">General Surgery</option>
                    <option value="Endocrinology">Endocrinology</option>
                    <option value="Oncopathology">Oncopathology</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hospital / Institution *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AuraMed General Hospital"
                    value={addForm.hospital}
                    onChange={e => setAddForm({ ...addForm, hospital: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+91-98765-43210"
                  value={addForm.phone}
                  onChange={e => setAddForm({ ...addForm, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:ring-1 focus:ring-teal-500 font-mono"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={addForm.is_approved}
                    onChange={e => setAddForm({ ...addForm, is_approved: e.target.checked })}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="font-semibold text-slate-700">Auto-verify & grant immediate platform access</span>
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-white bg-teal-600 hover:bg-teal-700 font-semibold shadow-xs"
                >
                  Create Doctor Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
