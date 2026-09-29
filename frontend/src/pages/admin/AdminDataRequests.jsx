import React, { useState, useEffect, useMemo } from 'react'
import {
  FileX2,
  ShieldCheck,
  CheckCircle2,
  Check,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  MoreVertical,
  X,
  User,
  Trash2,
  FileText,
  Lock,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  HelpCircle,
  ShieldAlert,
  Database
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import InitialsAvatar from '../../components/common/InitialsAvatar'
import {
  fetchDataDeletionRequests,
  approveDataDeletionRequest,
  rejectDataDeletionRequest
} from '../../services/adminService'

export default function AdminDataRequests() {
  // State
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({
    total_requests: 0,
    pending_review: 0,
    approved: 0,
    rejected: 0
  })

  // Selected request for right panel
  const [selectedRequest, setSelectedRequest] = useState(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [requestTypeFilter, setRequestTypeFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Modals
  const [showPolicyModal, setShowPolicyModal] = useState(false)
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToastMessage({ text: msg, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Load requests
  const loadRequests = async () => {
    try {
      setLoading(true)
      const res = await fetchDataDeletionRequests({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        request_type: requestTypeFilter !== 'all' ? requestTypeFilter : undefined,
        search: searchQuery || undefined,
        page,
        page_size: pageSize
      })
      const data = res.data || {}
      const items = data.items || []
      setRequests(items)
      setTotal(data.total || items.length)
      if (data.stats) setStats(data.stats)

      if (items.length > 0 && !selectedRequest) {
        setSelectedRequest(items[0])
      } else if (selectedRequest) {
        const found = items.find(x => x.id === selectedRequest.id)
        if (found) setSelectedRequest(found)
      }
    } catch (err) {
      console.error('Failed to load data deletion requests:', err)
      showToast('Failed to load deletion requests', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [page, statusFilter, requestTypeFilter])

  const handleClearFilters = () => {
    setStatusFilter('all')
    setDateRange('all')
    setRequestTypeFilter('all')
    setSearchQuery('')
    setPage(1)
    setTimeout(() => loadRequests(), 50)
  }

  // Approve action
  const handleConfirmApprove = async () => {
    if (!selectedRequest) return
    try {
      setActionLoading(true)
      await approveDataDeletionRequest(selectedRequest.db_id || selectedRequest.id)
      showToast(`Data deletion request for ${selectedRequest.patient_name} APPROVED. Async purge job triggered.`)
      // Update local state in real time
      setRequests(prev =>
        prev.map(r => (r.id === selectedRequest.id ? { ...r, status: 'approved' } : r))
      )
      setSelectedRequest(prev => ({ ...prev, status: 'approved' }))
      setStats(prev => ({
        ...prev,
        approved: prev.approved + 1,
        pending_review: Math.max(0, prev.pending_review - 1)
      }))
      setShowApproveConfirm(false)
    } catch (err) {
      console.error('Approval error:', err)
      showToast('Failed to approve request', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Reject action
  const handleConfirmReject = async e => {
    e.preventDefault()
    if (!selectedRequest || !rejectionReason.trim()) return
    try {
      setActionLoading(true)
      await rejectDataDeletionRequest(selectedRequest.db_id || selectedRequest.id, rejectionReason.trim())
      showToast(`Data deletion request rejected for ${selectedRequest.patient_name}`)
      // Update local state in real time
      setRequests(prev =>
        prev.map(r =>
          r.id === selectedRequest.id
            ? { ...r, status: 'rejected', rejection_reason: rejectionReason.trim() }
            : r
        )
      )
      setSelectedRequest(prev => ({
        ...prev,
        status: 'rejected',
        rejection_reason: rejectionReason.trim()
      }))
      setStats(prev => ({
        ...prev,
        rejected: prev.rejected + 1,
        pending_review: Math.max(0, prev.pending_review - 1)
      }))
      setShowRejectModal(false)
      setRejectionReason('')
    } catch (err) {
      console.error('Rejection error:', err)
      showToast('Failed to reject request', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Status badges: Pending (amber), Approved (green), Rejected (red)
  const getStatusBadge = status => {
    const s = (status || 'pending').toLowerCase()
    if (s === 'approved') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Approved
        </span>
      )
    }
    if (s === 'rejected') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Rejected
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
              <FileX2 className="w-7 h-7 text-teal-600" />
              Patient Data Deletion Requests
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and manage patient data deletion requests in compliance with GDPR & DPDP Right to be Forgotten
            </p>
          </div>

          {/* Data Deletion Policy button (opens policy modal) */}
          <button
            onClick={() => setShowPolicyModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl shadow-2xs text-xs font-bold transition-all"
          >
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>Data Deletion Policy</span>
          </button>
        </div>

        {/* FOUR STAT CARDS: Total Requests, Pending Review (amber), Approved (green), Rejected (red) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Requests */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Requests</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{stats.total_requests}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Erasure submissions</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200">
              <FileX2 className="w-5 h-5" />
            </div>
          </div>

          {/* Pending Review (amber) */}
          <div className="bg-white rounded-2xl p-4 border border-amber-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Pending Review</p>
              <p className="text-2xl font-black text-amber-700 mt-1">{stats.pending_review}</p>
              <p className="text-[11px] text-amber-600 mt-0.5">Action required</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-200">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          {/* Approved (green) */}
          <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Approved</p>
              <p className="text-2xl font-black text-emerald-700 mt-1">{stats.approved}</p>
              <p className="text-[11px] text-emerald-600 mt-0.5">Purge job triggered</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          {/* Rejected (red) */}
          <div className="bg-white rounded-2xl p-4 border border-rose-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">Rejected</p>
              <p className="text-2xl font-black text-rose-600 mt-1">{stats.rejected}</p>
              <p className="text-[11px] text-rose-500 mt-0.5">Statutory hold applied</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-200">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* FILTER BAR: Status dropdown, Date Range, Request Type, Search, Clear Filters */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search patient, ID, request #..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadRequests()}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status dropdown (All, Pending, Approved, Rejected) */}
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            {/* Request Type dropdown */}
            <select
              value={requestTypeFilter}
              onChange={e => {
                setRequestTypeFilter(e.target.value)
                setPage(1)
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="all">All Request Types</option>
              <option value="Full Account Deletion">Full Account Deletion</option>
              <option value="Medical Records Purge">Medical Records Purge</option>
            </select>

            {/* Clear Filters link */}
            <button
              onClick={handleClearFilters}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-800 font-semibold underline"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* TWO COLUMN LAYOUT: LEFT Requests Table + RIGHT Request Details Panel */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* LEFT - Requests table (xl:col-span-7) */}
          <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 w-10">#</th>
                    <th className="py-3 px-3">Request ID</th>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Loading deletion requests...
                      </td>
                    </tr>
                  ) : requests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No deletion requests matching filters
                      </td>
                    </tr>
                  ) : (
                    requests.map((req, idx) => {
                      const isSelected = selectedRequest?.id === req.id
                      return (
                        <tr
                          key={req.id}
                          onClick={() => setSelectedRequest(req)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-teal-50/50' : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="py-3.5 px-3 text-slate-400 font-mono text-[11px]">
                            {(page - 1) * pageSize + idx + 1}
                          </td>

                          {/* Request ID */}
                          <td className="py-3.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {req.id}
                          </td>

                          {/* Patient (ID + name) */}
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-slate-900">{req.patient_name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{req.patient_id}</p>
                          </td>

                          {/* Request Date */}
                          <td className="py-3.5 px-3 text-slate-500 font-mono whitespace-nowrap">
                            {req.request_date}
                          </td>

                          {/* Reason */}
                          <td className="py-3.5 px-4 text-slate-600 max-w-[160px] truncate" title={req.reason}>
                            {req.reason}
                          </td>

                          {/* Status badge */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {getStatusBadge(req.status)}
                          </td>

                          {/* Actions three-dot menu */}
                          <td className="py-3.5 px-3 text-right">
                            <div className="relative inline-block">
                              <button
                                onClick={e => {
                                  e.stopPropagation()
                                  setOpenMenuId(openMenuId === req.id ? null : req.id)
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>

                              {openMenuId === req.id && (
                                <div
                                  onMouseLeave={() => setOpenMenuId(null)}
                                  className="absolute right-0 top-7 z-30 w-40 bg-white border border-slate-200 rounded-xl shadow-lg py-1 text-xs text-left"
                                >
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null)
                                      setSelectedRequest(req)
                                    }}
                                    className="w-full px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                                  >
                                    View Full Detail
                                  </button>
                                  {req.status === 'pending' && (
                                    <>
                                      <button
                                        onClick={() => {
                                          setOpenMenuId(null)
                                          setSelectedRequest(req)
                                          setShowApproveConfirm(true)
                                        }}
                                        className="w-full px-3 py-1.5 text-blue-600 hover:bg-blue-50 font-semibold"
                                      >
                                        Approve Erasure
                                      </button>
                                      <button
                                        onClick={() => {
                                          setOpenMenuId(null)
                                          setSelectedRequest(req)
                                          setShowRejectModal(true)
                                        }}
                                        className="w-full px-3 py-1.5 text-rose-600 hover:bg-rose-50 font-semibold"
                                      >
                                        Reject Request
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-3 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <div>
                Showing <span className="font-semibold text-slate-900">{requests.length}</span> of{' '}
                <span className="font-semibold text-slate-900">{total}</span> requests
              </div>

              <div className="flex items-center space-x-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold flex items-center space-x-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>
                <span className="font-semibold text-slate-800">Page {page}</span>
                <button
                  disabled={page * pageSize >= total}
                  onClick={() => setPage(p => p + 1)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold flex items-center space-x-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT - Request Details panel (xl:col-span-5) */}
          <div className="xl:col-span-5 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4 sticky top-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <FileX2 className="w-4 h-4 text-teal-600" />
                Request Details
              </h3>
              {selectedRequest && (
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                  title="Close details"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {selectedRequest ? (
              <div className="space-y-4 text-xs">
                {/* Detail rows: Request ID, Patient ID, Patient Name, Request Date, Current Status, Request Type, Reason/Notes */}
                <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                    <span className="text-slate-500">Request ID:</span>
                    <span className="font-mono font-bold text-slate-900">{selectedRequest.id}</span>
                  </div>

                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                    <span className="text-slate-500">Patient:</span>
                    <span className="font-bold text-slate-900">
                      {selectedRequest.patient_name}{' '}
                      <span className="font-mono font-normal text-slate-400">({selectedRequest.patient_id})</span>
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                    <span className="text-slate-500">Request Date:</span>
                    <span className="font-mono text-slate-800">{selectedRequest.request_date}</span>
                  </div>

                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                    <span className="text-slate-500">Request Type:</span>
                    <span className="font-semibold text-slate-900">{selectedRequest.request_type}</span>
                  </div>

                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                    <span className="text-slate-500">Current Status:</span>
                    {getStatusBadge(selectedRequest.status)}
                  </div>

                  <div>
                    <span className="text-slate-500 block font-semibold mb-1">Reason / Clinical Notes:</span>
                    <p className="text-slate-700 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200/80">
                      {selectedRequest.reason}
                    </p>
                  </div>

                  {selectedRequest.rejection_reason && (
                    <div className="bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                      <span className="text-rose-800 font-bold block">Rejection Reason:</span>
                      <p className="text-rose-700 mt-0.5 leading-relaxed">{selectedRequest.rejection_reason}</p>
                    </div>
                  )}
                </div>

                {/* DATA TO BE DELETED SECTION:
                    Three cards showing what will be deleted:
                    1. Personal Information (name, contact, date of birth)
                    2. Medical Records (all clinical data, reports, images)
                    3. Account Data (login credentials, preferences)
                */}
                <div className="space-y-2">
                  <p className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    Data Scope Subject to Erasure
                  </p>

                  <div className="space-y-2">
                    {/* Card 1: Personal Information */}
                    <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-start space-x-3">
                      <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-[11px]">Personal Information</p>
                        <p className="text-[10px] text-slate-500">Name, mobile, emergency contacts, date of birth</p>
                      </div>
                    </div>

                    {/* Card 2: Medical Records */}
                    <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-start space-x-3">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-[11px]">Medical Records</p>
                        <p className="text-[10px] text-slate-500">All DICOM scans, AI inference heatmaps, signed clinical reports</p>
                      </div>
                    </div>

                    {/* Card 3: Account Data */}
                    <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-start space-x-3">
                      <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-[11px]">Account Data</p>
                        <p className="text-[10px] text-slate-500">Portal credentials, biometric tokens, session preferences</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Warning: "This action will be logged in the audit trail and cannot be undone" */}
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center space-x-2 text-amber-800 text-[11px]">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>This action will be permanently logged in the audit trail and cannot be undone.</span>
                </div>

                {/* Two Action Buttons at bottom (Reject Request in red outline, Approve Request in blue filled) */}
                {selectedRequest.status === 'pending' ? (
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowRejectModal(true)}
                      className="py-2.5 px-3 border border-rose-300 hover:bg-rose-50 text-rose-700 rounded-xl font-bold text-xs transition-colors flex items-center justify-center space-x-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject Request</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowApproveConfirm(true)}
                      className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold text-xs shadow-xs transition-colors flex items-center justify-center space-x-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve Request</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center text-slate-500">
                    This request has been <span className="font-bold capitalize">{selectedRequest.status}</span>.
                  </div>
                )}
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400 text-xs">
                Select a data deletion request row to inspect full clinical scope
              </div>
            )}
          </div>
        </div>

      {/* APPROVE CONFIRMATION MODAL */}
      {showApproveConfirm && selectedRequest && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mx-auto">
              <Database className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-bold text-slate-900">Confirm Irreversible Data Erasure</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to approve data deletion for{' '}
                <span className="font-bold text-slate-900">{selectedRequest.patient_name}</span> ({selectedRequest.patient_id})?
              </p>
              <p className="text-[11px] text-rose-600 font-semibold bg-rose-50 p-2 rounded-lg border border-rose-200">
                Warning: This will permanently queue all scans, AI inference artifacts, and portal profile credentials for cryptographically secure shredding.
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowApproveConfirm(false)}
                className="flex-1 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApprove}
                disabled={actionLoading}
                className="flex-1 py-2 rounded-xl text-white bg-blue-600 hover:bg-blue-700 text-xs font-bold shadow-xs flex items-center justify-center space-x-1"
              >
                <Check className="w-4 h-4" />
                <span>Confirm & Trigger Purge</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL (Prompt: Modal asking for rejection reason) */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                Reject Deletion Request
              </h3>
              <button onClick={() => setShowRejectModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="space-y-3 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Specify legal, medical, or compliance justification for denying data erasure for{' '}
                <span className="font-bold text-slate-900">{selectedRequest.patient_name}</span>.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Rejection Reason / Statutory Hold Policy *
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="e.g. Active clinical oncology treatment requires mandatory 3-year record retention per NABH guidelines..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !rejectionReason.trim()}
                  className="px-5 py-2 rounded-xl text-white bg-rose-600 hover:bg-rose-700 font-semibold shadow-xs"
                >
                  Submit Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DATA DELETION POLICY MODAL */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-600" />
                AuraMed Clinical Data Deletion Policy
              </h3>
              <button onClick={() => setShowPolicyModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 max-h-96 overflow-y-auto leading-relaxed">
              <p>
                <strong className="text-slate-900">1. Statutory Retention Standards:</strong> Clinical diagnostic imaging and biopsy correlations are subject to NABH and Medical Council guidelines requiring minimum 3-year archival for active oncology regimens.
              </p>
              <p>
                <strong className="text-slate-900">2. Right to be Forgotten:</strong> Under DPDP Act 2023 and GDPR Article 17, patients not undergoing active acute treatment may request full demographic and biometric credential erasure.
              </p>
              <p>
                <strong className="text-slate-900">3. Cryptographic Shredding:</strong> Once approved, data files stored in S3/MinIO cold vaults are overwritten using DoD 5220.22-M multi-pass sanitization.
              </p>
              <p>
                <strong className="text-slate-900">4. Audit Trail Preservation:</strong> Deletion transactions generate immutable hash receipts preserved in the administrative audit log for compliance inspection.
              </p>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPolicyModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold text-xs"
              >
                Close Policy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
