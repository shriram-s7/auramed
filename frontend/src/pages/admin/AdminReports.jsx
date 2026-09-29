import React, { useState, useEffect, useMemo } from 'react'
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Share2,
  ShieldCheck,
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import { fetchAdminReports } from '../../services/adminService'

export default function AdminReports() {
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [toastMessage, setToastMessage] = useState(null)

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 3500)
  }

  const loadReports = async () => {
    try {
      setLoading(true)
      const res = await fetchAdminReports({
        status: statusFilter !== 'all' ? statusFilter : undefined,
      })
      setReports(res.data.items || [])
    } catch (err) {
      console.error('Error loading admin reports:', err)
      showToast('Failed to load reports', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [statusFilter])

  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) return reports
    const q = searchQuery.toLowerCase()
    return reports.filter(
      (r) =>
        r.report_number?.toLowerCase().includes(q) ||
        r.patient_name?.toLowerCase().includes(q) ||
        r.patient_code?.toLowerCase().includes(q) ||
        r.doctor_name?.toLowerCase().includes(q),
    )
  }, [reports, searchQuery])

  const stats = useMemo(() => {
    const total = reports.length
    const approved = reports.filter((r) => r.status === 'approved').length
    const shared = reports.filter((r) => r.shared_with_patient).length
    const pending = reports.filter((r) => r.status === 'draft' || r.status === 'reviewed').length
    return { total, approved, shared, pending }
  }, [reports])

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
              <FileText className="w-8 h-8 text-teal-600" />
              Clinical Diagnostic Reports
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Audit clinician-signed diagnostic reports, patient disclosure statuses, and cryptographic seals
            </p>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-xs font-semibold text-slate-500">Total Reports</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{stats.total}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-xs font-semibold text-emerald-600">Approved / Signed</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">{stats.approved}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-xs font-semibold text-teal-600">Shared with Patient</p>
            <p className="text-2xl font-black text-teal-700 mt-1">{stats.shared}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-xs font-semibold text-amber-600">In Review / Draft</p>
            <p className="text-2xl font-black text-amber-700 mt-1">{stats.pending}</p>
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
              placeholder="Search by report #, patient name, code, doctor..."
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
              <option value="approved">Approved / Signed</option>
              <option value="reviewed">Reviewed</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        {/* Reports Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Loading diagnostic reports...</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No reports found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No reports match the current criteria.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Report Number</th>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Signing Doctor</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Patient Shared</th>
                    <th className="py-3 px-4">Signed Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredReports.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                        {r.report_number}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900">{r.patient_name}</p>
                        <p className="text-[11px] font-mono text-slate-500">{r.patient_code}</p>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">{r.doctor_name}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : r.status === 'reviewed'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {r.shared_with_patient ? (
                          <span className="inline-flex items-center gap-1 text-teal-700 font-semibold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                            Shared
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Not Shared</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {r.signed_at ? r.signed_at.substring(0, 10) : '—'}
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
