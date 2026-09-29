import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ScrollText,
  Download,
  Filter,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Search,
  CheckCircle2,
  Clock,
  ShieldAlert,
  FileSpreadsheet,
  Info
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import { fetchAdminAuditLogs } from '../../services/adminService'

export default function AdminAuditLogs() {
  const [searchParams] = useSearchParams()

  // State
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({
    total_logs: 0,
    doctor_actions: 0,
    admin_actions: 0,
    patient_access: 0,
    security_events: 0
  })

  // Filters
  const [dateRange, setDateRange] = useState('30days')
  const [userTypeFilter, setUserTypeFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [resourceFilter, setResourceFilter] = useState('all')
  const [securityOnly, setSecurityOnly] = useState(() => {
    return searchParams.get('filter') === 'security'
  })

  // Pagination & Sorting
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortDesc, setSortDesc] = useState(true)

  // Load audit logs
  const loadLogs = async () => {
    try {
      setLoading(true)
      const res = await fetchAdminAuditLogs({
        page,
        page_size: pageSize,
        user_type: userTypeFilter !== 'all' ? userTypeFilter : undefined,
        action_type: actionFilter !== 'all' ? actionFilter : undefined,
        resource_type: resourceFilter !== 'all' ? resourceFilter : undefined,
        filter: securityOnly ? 'security' : undefined,
        date_range: dateRange
      })
      const data = res.data || {}
      setLogs(data.items || [])
      setTotal(data.total || 0)
      if (data.stats) setStats(data.stats)
    } catch (err) {
      console.error('Failed to load audit logs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [page, pageSize, userTypeFilter, actionFilter, resourceFilter, securityOnly, dateRange])

  const handleApplyFilters = () => {
    setPage(1)
    loadLogs()
  }

  const handleClearFilters = () => {
    setDateRange('30days')
    setUserTypeFilter('all')
    setActionFilter('all')
    setResourceFilter('all')
    setSecurityOnly(false)
    setPage(1)
    setTimeout(() => loadLogs(), 50)
  }

  // Export to CSV
  const handleExportCsv = () => {
    if (logs.length === 0) return
    const headers = ['Timestamp', 'User Name', 'User Email', 'User Type', 'Action', 'Resource', 'Details', 'IP Address']
    const rows = logs.map(l => [
      `"${l.timestamp}"`,
      `"${l.user_name}"`,
      `"${l.user_email}"`,
      l.user_type,
      `"${l.action}"`,
      l.resource_type,
      `"${(l.details || '').replace(/"/g, '""')}"`,
      l.ip_address
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `AuraMed_Audit_Logs_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // User type badge colors: Doctor: blue, Admin: purple, Patient: green, System: gray
  const getUserTypeBadge = type => {
    const t = (type || 'system').toLowerCase()
    if (t === 'doctor') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">Doctor</span>
    }
    if (t === 'admin') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">Admin</span>
    }
    if (t === 'patient') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Patient</span>
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">System</span>
  }

  // Action badge colors:
  // Login: blue, Verify: green, View: gray, Generate: purple, Update: amber, Request: orange, Approve: green, Logout: gray, Alert: red, Share: teal
  const getActionBadge = action => {
    const a = (action || '').toLowerCase()
    if (a.includes('login')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">Login</span>
    }
    if (a.includes('verify')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Verify</span>
    }
    if (a.includes('view')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">View</span>
    }
    if (a.includes('generate') || a.includes('report')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">Generate</span>
    }
    if (a.includes('update')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Update</span>
    }
    if (a.includes('request')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200">Request</span>
    }
    if (a.includes('approve')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Approve</span>
    }
    if (a.includes('logout')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Logout</span>
    }
    if (a.includes('alert') || a.includes('unauthorized') || a.includes('fail')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">Alert</span>
    }
    if (a.includes('share')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">Share</span>
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">{action}</span>
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* TOP HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ScrollText className="w-7 h-7 text-teal-600" />
              Audit Logs
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Track system activity, ensure transparency, and maintain compliance
            </p>
          </div>

          {/* Export Logs button (downloads CSV) */}
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl shadow-2xs text-xs font-bold transition-all"
          >
            <Download className="w-4 h-4 text-teal-600" />
            <span>Export Logs (CSV)</span>
          </button>
        </div>

        {/* FIVE SUMMARY STAT PILLS: Total Logs, Doctor Actions, Admin Actions, Patient Data Access, Security Events (red if > 0) */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Total Logs */}
          <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-2">
            <span className="text-slate-500 text-xs font-medium">Total Logs:</span>
            <span className="text-xs font-black text-slate-900">{stats.total_logs}</span>
          </div>

          {/* Doctor Actions */}
          <div className="bg-white px-4 py-2 rounded-xl border border-blue-200/80 shadow-2xs flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-slate-600 text-xs font-medium">Doctor Actions:</span>
            <span className="text-xs font-black text-blue-700">{stats.doctor_actions}</span>
          </div>

          {/* Admin Actions */}
          <div className="bg-white px-4 py-2 rounded-xl border border-purple-200/80 shadow-2xs flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-slate-600 text-xs font-medium">Admin Actions:</span>
            <span className="text-xs font-black text-purple-700">{stats.admin_actions}</span>
          </div>

          {/* Patient Data Access */}
          <div className="bg-white px-4 py-2 rounded-xl border border-emerald-200/80 shadow-2xs flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-600 text-xs font-medium">Patient Data Access:</span>
            <span className="text-xs font-black text-emerald-700">{stats.patient_access}</span>
          </div>

          {/* Security Events (red if > 0) */}
          <div className={`px-4 py-2 rounded-xl border shadow-2xs flex items-center space-x-2 cursor-pointer transition-all ${
            stats.security_events > 0
              ? 'bg-rose-50 border-rose-300 text-rose-800'
              : 'bg-white border-slate-200 text-slate-600'
          }`}
          onClick={() => setSecurityOnly(!securityOnly)}
          title="Click to toggle security events filter"
          >
            <ShieldAlert className={`w-3.5 h-3.5 ${stats.security_events > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
            <span className="text-xs font-medium">Security Events:</span>
            <span className={`text-xs font-black ${stats.security_events > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
              {stats.security_events}
            </span>
          </div>
        </div>

        {/* FILTER BAR: Date Range, User Type, Action Type, Resource Type, Apply Filters, Clear Filters */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Date Range Picker */}
            <div className="flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={dateRange}
                onChange={e => setDateRange(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="today">Today</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days (Default)</option>
                <option value="90days">Last 90 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>

            {/* User Type dropdown */}
            <select
              value={userTypeFilter}
              onChange={e => setUserTypeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="all">All Users</option>
              <option value="Doctor">Doctor</option>
              <option value="Admin">Admin</option>
              <option value="Patient">Patient</option>
              <option value="System">System</option>
            </select>

            {/* Action Type dropdown */}
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="all">All Actions</option>
              <option value="Login">Login</option>
              <option value="View">View</option>
              <option value="Update">Update</option>
              <option value="Generate">Generate</option>
              <option value="Share">Share</option>
              <option value="Delete">Delete</option>
              <option value="Verify">Verify</option>
              <option value="Export">Export</option>
              <option value="Alert">Alert</option>
            </select>

            {/* Resource Type dropdown */}
            <select
              value={resourceFilter}
              onChange={e => setResourceFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="all">All Resources</option>
              <option value="Patient">Patient Record</option>
              <option value="Report">Report</option>
              <option value="Scan">Scan</option>
              <option value="Doctor Account">Doctor Account</option>
              <option value="System">System</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleApplyFilters}
              className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold shadow-2xs transition-colors"
            >
              Apply Filters
            </button>
            <button
              onClick={handleClearFilters}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-800 font-semibold underline"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* AUDIT LOGS TABLE */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Top table control: Show N entries */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center space-x-2">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-800"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>entries per page</span>
            </div>

            {securityOnly && (
              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Filtering Security Events Only
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th
                    onClick={() => setSortDesc(!sortDesc)}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Timestamp</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">User Type</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Resource</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4 font-mono">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Loading immutable audit logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No audit events matching criteria
                    </td>
                  </tr>
                ) : (
                  logs.map(log => {
                    const isSecurity = log.is_security_event || (log.action || '').toLowerCase().includes('alert')
                    return (
                      <tr
                        key={log.id}
                        className={`transition-colors group relative ${
                          isSecurity
                            ? 'bg-rose-50/60 hover:bg-rose-50 border-l-4 border-l-rose-500'
                            : 'hover:bg-slate-50/80'
                        }`}
                        title={`Full Details: ${log.details}`}
                      >
                        {/* Timestamp */}
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {log.timestamp}
                        </td>

                        {/* User */}
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{log.user_name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{log.user_email}</p>
                        </td>

                        {/* User Type badge */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {getUserTypeBadge(log.user_type)}
                        </td>

                        {/* Action badge */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {getActionBadge(log.action)}
                        </td>

                        {/* Resource */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-semibold text-slate-800">{log.resource_type}</span>
                          {log.resource_id && log.resource_id !== 'N/A' && (
                            <span className="block text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                              {log.resource_id}
                            </span>
                          )}
                        </td>

                        {/* Details with hover tooltip */}
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={log.details}>
                          {log.details}
                        </td>

                        {/* IP Address */}
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {log.ip_address}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION (Prompt: showing 1-10 of N logs, page numbers) */}
          <div className="p-4 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Showing <span className="font-semibold text-slate-900">{logs.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to{' '}
              <span className="font-semibold text-slate-900">{Math.min(page * pageSize, total)}</span> of{' '}
              <span className="font-semibold text-slate-900">{total}</span> logs
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
    </AdminLayout>
  )
}
