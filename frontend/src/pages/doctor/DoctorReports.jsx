import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  Edit3,
  MoreVertical,
  Plus,
  Share2,
  FilePlus2,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
  Calendar,
  User,
  Activity,
  Layers,
  Check,
  FileSpreadsheet,
  History,
  Lock
} from 'lucide-react'
import {
  fetchReportsList,
  deleteDraftReport,
  generateReportPdf,
  addReportAddendum
} from '../../services/reportService'
import { triggerPdfDownload } from '../../utils/downloadPdf'

export default function DoctorReports() {
  const navigate = useNavigate()

  // State
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState([])
  const [stats, setStats] = useState({
    total_reports: 0,
    signed_count: 0,
    signed_pct: 0,
    draft_count: 0,
    draft_pct: 0,
    high_risk_count: 0,
    high_risk_pct: 0
  })

  // Tab filter: 'all' | 'draft' | 'signed' | 'addendum'
  const [activeTab, setActiveTab] = useState('all')

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  // Filter sidebar state
  const [moduleFilter, setModuleFilter] = useState('all')
  const [riskFilter, setRiskFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [physicianFilter, setPhysicianFilter] = useState('all')

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)

  // Selection
  const [selectedIds, setSelectedIds] = useState([])

  // Modals & Menu dropdowns
  const [openMenuId, setOpenMenuId] = useState(null)
  const [addendumReport, setAddendumReport] = useState(null)
  const [addendumText, setAddendumText] = useState('')
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const showToast = (msg, type = 'success') => {
    setToastMessage({ text: msg, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Load reports from API
  const loadReports = async () => {
    try {
      setLoading(true)
      const st = activeTab !== 'all' ? activeTab : (statusFilter !== 'all' ? statusFilter : undefined)
      const res = await fetchReportsList({
        search: searchQuery || undefined,
        module: moduleFilter !== 'all' ? moduleFilter : undefined,
        risk_level: riskFilter !== 'all' ? riskFilter : undefined,
        status: st,
        referring_physician: physicianFilter !== 'all' ? physicianFilter : undefined,
        page,
        page_size: pageSize
      })
      const data = res.data || {}
      setReports(data.items || [])
      setTotalCount(data.total || (data.items || []).length)
      if (data.stats) {
        setStats(data.stats)
      }
    } catch (err) {
      console.error('Failed to load reports:', err)
      showToast('Failed to load reports from server', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [activeTab, page, pageSize])

  // Apply filters manually
  const handleApplyFilters = () => {
    setPage(1)
    loadReports()
  }

  const handleResetFilters = () => {
    setModuleFilter('all')
    setRiskFilter('all')
    setStatusFilter('all')
    setDateRange('all')
    setPhysicianFilter('all')
    setSearchQuery('')
    setPage(1)
    setTimeout(() => loadReports(), 50)
  }

  // Selection toggles
  const handleSelectAll = e => {
    if (e.target.checked) {
      setSelectedIds(reports.map(r => r.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectRow = id => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // Row actions
  const handleDownloadPdf = async report => {
    try {
      showToast(`Generating PDF for ${report.report_number}...`, 'info')
      const res = await generateReportPdf(report.id)
      const filename = `${report.report_number}_AuraMed.pdf`
      triggerPdfDownload(res.data, filename)
      showToast('PDF downloaded successfully!')
    } catch (err) {
      console.error('PDF download error:', err)
      showToast('Failed to generate PDF download', 'error')
    }
  }

  const handleDeleteDraft = async report => {
    if (report.status !== 'draft') {
      showToast('Signed reports cannot be deleted', 'error')
      return
    }
    if (!window.confirm(`Are you sure you want to delete draft ${report.report_number}?`)) {
      return
    }
    try {
      await deleteDraftReport(report.id)
      showToast(`Draft ${report.report_number} deleted`)
      loadReports()
    } catch (err) {
      console.error(err)
      showToast('Failed to delete draft', 'error')
    }
  }

  const handleOpenAddendum = report => {
    setAddendumReport(report)
    setAddendumText('')
    setOpenMenuId(null)
  }

  const submitAddendum = async e => {
    e.preventDefault()
    if (!addendumReport || !addendumText.trim()) return
    try {
      setActionLoading(true)
      await addReportAddendum(addendumReport.id, {
        content: addendumText.trim(),
        doctor_name: 'Dr. Mehta',
        doctor_reg: 'TNMC123456'
      })
      showToast(`Addendum appended to ${addendumReport.report_number}`)
      setAddendumReport(null)
      loadReports()
    } catch (err) {
      console.error(err)
      showToast('Failed to append addendum', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Export to CSV
  const handleExportCsv = () => {
    if (reports.length === 0) {
      showToast('No reports to export', 'error')
      return
    }
    const headers = ['Report ID', 'Patient Name', 'Patient ID', 'Module', 'Risk Level', 'Status', 'Date']
    const rows = reports.map(r => [
      r.report_number,
      `"${r.patient_name}"`,
      r.patient_code,
      r.module,
      r.risk_level,
      r.status,
      r.created_at ? r.created_at.split('T')[0] : ''
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `AuraMed_Clinical_Reports_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('Exported filtered reports to CSV!')
  }

  // Helper styles for module and status pills
  const getModuleBadge = mod => {
    const m = (mod || '').toLowerCase()
    if (m === 'breast') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-pink-50 text-pink-700 border border-pink-200">Breast Cancer</span>
    }
    if (m === 'cervical') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">Cervical Cancer</span>
    }
    if (m === 'pcos') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">PCOS Screening</span>
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">General</span>
  }

  const getRiskBadge = risk => {
    const r = (risk || 'low').toLowerCase()
    if (r === 'high' || r === 'critical') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">High Risk</span>
    }
    if (r === 'moderate') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">Moderate</span>
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Low Risk</span>
  }

  const getStatusBadge = status => {
    const s = (status || 'draft').toLowerCase()
    if (s === 'signed') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" />
          <span>Signed</span>
        </span>
      )
    }
    if (s === 'addendum') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
          <ShieldCheck className="w-3 h-3" />
          <span>Addendum</span>
        </span>
      )
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
        <Clock className="w-3 h-3" />
        <span>Draft</span>
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center space-x-2 transition-all ${
          toastMessage.type === 'error'
            ? 'bg-rose-50 text-rose-800 border-rose-200'
            : toastMessage.type === 'info'
            ? 'bg-sky-50 text-sky-800 border-sky-200'
            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
        }`}>
          {toastMessage.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium mb-1">
            <span>Doctor Portal</span>
            <span>/</span>
            <span className="text-teal-700">Clinical Reports</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-7 h-7 text-teal-600" />
            Clinical Reports Management
          </h1>
          <p className="text-sm text-slate-500">
            Certified diagnostic reports, digital audit records, and addendum histories
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigate('/doctor/patients')}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl shadow-sm text-sm font-semibold transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Generate New Report</span>
          </button>
        </div>
      </div>

      {/* STATS ROW (Prompt Spec: Total, Signed %, Draft %, High Risk %) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Reports */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Reports</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total_reports ?? 0}</p>
            <p className="text-xs text-slate-400 mt-0.5">All clinical records</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Signed Reports */}
        <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Signed Reports</p>
            <div className="flex items-baseline space-x-2 mt-1">
              <p className="text-2xl font-bold text-emerald-700">{stats.signed_count ?? 0}</p>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {stats.signed_pct ?? 0}%
              </span>
            </div>
            <p className="text-xs text-emerald-600 mt-0.5">Digitally locked</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-200">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Draft Reports */}
        <div className="bg-white rounded-2xl p-4 border border-amber-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Draft Reports</p>
            <div className="flex items-baseline space-x-2 mt-1">
              <p className="text-2xl font-bold text-amber-700">{stats.draft_count ?? 0}</p>
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                {stats.draft_pct ?? 0}%
              </span>
            </div>
            <p className="text-xs text-amber-600 mt-0.5">Pending physician sign-off</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-200">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* High Risk Reports */}
        <div className="bg-white rounded-2xl p-4 border border-rose-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">High Risk Reports</p>
            <div className="flex items-baseline space-x-2 mt-1">
              <p className="text-2xl font-bold text-rose-600">{stats.high_risk_count ?? 0}</p>
              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                {stats.high_risk_pct ?? 0}%
              </span>
            </div>
            <p className="text-xs text-rose-500 mt-0.5">Critical attention needed</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-200">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN LAYOUT: Reports Content (Left) + Filter & Quick Actions Sidebar (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT / CENTER COLUMN (lg:col-span-8 or 9) */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {/* Tab Bar & Search Header */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Tab bar (Prompt spec: All Reports, Drafts, Signed, Addendums) */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto">
              {[
                { key: 'all', label: 'All Reports' },
                { key: 'draft', label: 'Drafts' },
                { key: 'signed', label: 'Signed' },
                { key: 'addendum', label: 'Addendums' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key)
                    setPage(1)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === tab.key
                      ? 'bg-white text-teal-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Bar (Prompt spec: by patient name, patient ID, or report ID) */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search patient, ID, or report #..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadReports()}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* REPORTS TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.length > 0 && selectedIds.length === reports.length}
                        onChange={handleSelectAll}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                    </th>
                    <th className="py-3 px-3">Report ID</th>
                    <th className="py-3 px-4">Patient Name</th>
                    <th className="py-3 px-3">Patient ID</th>
                    <th className="py-3 px-3">Module</th>
                    <th className="py-3 px-3">Risk Level</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Report Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        Loading clinical reports...
                      </td>
                    </tr>
                  ) : reports.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        No clinical reports match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    reports.map(report => {
                      const isSelected = selectedIds.includes(report.id)
                      const isDraft = report.status === 'draft'
                      const isSigned = report.status === 'signed' || report.status === 'addendum'

                      return (
                        <tr
                          key={report.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isSelected ? 'bg-teal-50/30' : ''
                          }`}
                        >
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectRow(report.id)}
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            />
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">
                            {report.report_number}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {report.patient_name}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-500">
                            {report.patient_code}
                          </td>
                          <td className="py-3 px-3">
                            {getModuleBadge(report.module)}
                          </td>
                          <td className="py-3 px-3">
                            {getRiskBadge(report.risk_level)}
                          </td>
                          <td className="py-3 px-3">
                            {getStatusBadge(report.status)}
                          </td>
                          <td className="py-3 px-3 text-slate-500">
                            {report.created_at ? report.created_at.split('T')[0] : 'Today'}
                          </td>

                          {/* Action icons per prompt spec: Eye, Download, Pencil, Three-dot */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1 relative">
                              {/* Eye icon: view report */}
                              <Link
                                to={report.id || report.report_id ? `/doctor/reports/${report.id || report.report_id}` : '#'}
                                onClick={(e) => {
                                  const rId = report.id || report.report_id
                                  if (!rId || rId === 'undefined') {
                                    e.preventDefault()
                                    console.error('Report ID is undefined, cannot navigate')
                                  }
                                }}
                                title="View Report"
                                className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-slate-100 rounded-lg transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </Link>

                              {/* Download icon: PDF download (signed only) */}
                              {isSigned ? (
                                <button
                                  onClick={() => handleDownloadPdf(report)}
                                  title="Download Signed PDF"
                                  className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              ) : (
                                <span
                                  title="Download available once signed"
                                  className="p-1.5 text-slate-200 cursor-not-allowed"
                                >
                                  <Download className="w-4 h-4" />
                                </span>
                              )}

                              {/* Pencil icon: edit (draft only) */}
                              {isDraft ? (
                                <Link
                                  to={`/doctor/scan/${report.module || 'breast'}/report/${report.scan_id || report.id}`}
                                  title="Edit Draft"
                                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </Link>
                              ) : (
                                <span
                                  title="Signed report is locked"
                                  className="p-1.5 text-slate-200 cursor-not-allowed"
                                >
                                  <Lock className="w-4 h-4" />
                                </span>
                              )}

                              {/* Three-dot menu: Share, Add Addendum, Delete Draft */}
                              <div className="relative">
                                <button
                                  onClick={e => {
                                    e.stopPropagation()
                                    setOpenMenuId(openMenuId === report.id ? null : report.id)
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>

                                {openMenuId === report.id && (
                                  <div
                                    onMouseLeave={() => setOpenMenuId(null)}
                                    className="absolute right-0 top-8 z-30 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 text-xs text-left"
                                  >
                                    <button
                                      onClick={() => {
                                        setOpenMenuId(null)
                                        navigate(`/doctor/scan/${report.module || 'breast'}/share/${report.scan_id || report.id}`)
                                      }}
                                      className="w-full px-3 py-2 text-slate-700 hover:bg-teal-50 hover:text-teal-700 flex items-center space-x-2"
                                    >
                                      <Share2 className="w-3.5 h-3.5" />
                                      <span>Share Report</span>
                                    </button>

                                    {isSigned && (
                                      <button
                                        onClick={() => handleOpenAddendum(report)}
                                        className="w-full px-3 py-2 text-slate-700 hover:bg-sky-50 hover:text-sky-700 flex items-center space-x-2"
                                      >
                                        <FilePlus2 className="w-3.5 h-3.5" />
                                        <span>Add Addendum</span>
                                      </button>
                                    )}

                                    {isDraft && (
                                      <button
                                        onClick={() => {
                                          setOpenMenuId(null)
                                          handleDeleteDraft(report)
                                        }}
                                        className="w-full px-3 py-2 text-rose-600 hover:bg-rose-50 flex items-center space-x-2"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Delete Draft</span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINATION BAR */}
            <div className="p-4 bg-slate-50/60 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <div>
                Showing <span className="font-semibold text-slate-900">{reports.length}</span> of{' '}
                <span className="font-semibold text-slate-900">{totalCount}</span> reports
              </div>

              <div className="flex items-center space-x-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold flex items-center space-x-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <span className="px-3 py-1 font-semibold text-slate-800">Page {page}</span>
                <button
                  disabled={reports.length < pageSize}
                  onClick={() => setPage(p => p + 1)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold flex items-center space-x-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR: Filter Sidebar + Quick Actions + Guidelines Note */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-6">
          {/* FILTER SIDEBAR (Prompt Spec: Module, Risk Level, Status, Date Range, Referring Physician, Apply Filters button) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-teal-600" />
                Filter Reports
              </h3>
              <button
                onClick={handleResetFilters}
                className="text-xs text-teal-600 hover:text-teal-700 font-semibold"
              >
                Reset
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Module dropdown */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Module</label>
                <select
                  value={moduleFilter}
                  onChange={e => setModuleFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:ring-1 focus:ring-teal-500"
                >
                  <option value="all">All Modules</option>
                  <option value="breast">Breast Cancer</option>
                  <option value="cervical">Cervical Cancer</option>
                  <option value="pcos">PCOS Screening</option>
                </select>
              </div>

              {/* Risk Level dropdown */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Risk Level</label>
                <select
                  value={riskFilter}
                  onChange={e => setRiskFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:ring-1 focus:ring-teal-500"
                >
                  <option value="all">All Risk Levels</option>
                  <option value="low">Low Risk</option>
                  <option value="moderate">Moderate Risk</option>
                  <option value="high">High Risk</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              {/* Status dropdown */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:ring-1 focus:ring-teal-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft (Unsigned)</option>
                  <option value="signed">Signed & Locked</option>
                  <option value="addendum">With Addendum</option>
                </select>
              </div>

              {/* Date Range Picker */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Date Range</label>
                <select
                  value={dateRange}
                  onChange={e => setDateRange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:ring-1 focus:ring-teal-500"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="quarter">This Quarter</option>
                </select>
              </div>

              {/* Referring Physician dropdown */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Referring Physician</label>
                <select
                  value={physicianFilter}
                  onChange={e => setPhysicianFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:ring-1 focus:ring-teal-500"
                >
                  <option value="all">All Physicians</option>
                  <option value="Dr. Mehta">Dr. Mehta (You)</option>
                  <option value="Dr. Suresh">Dr. Suresh</option>
                  <option value="Dr. Sen">Dr. Sen</option>
                </select>
              </div>

              <button
                onClick={handleApplyFilters}
                className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl font-semibold shadow-xs transition-all mt-2"
              >
                Apply Filters
              </button>
            </div>
          </div>

          {/* QUICK ACTIONS PANEL (Prompt Spec: Generate New Report, Export Reports CSV, View Audit Log) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Quick Actions</h3>

            <div className="space-y-2 text-xs">
              <button
                onClick={() => navigate('/doctor/patients')}
                className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/50 text-slate-700 font-semibold flex items-center space-x-2.5 transition-all text-left"
              >
                <FilePlus2 className="w-4 h-4 text-teal-600 flex-shrink-0" />
                <span>Generate New Report</span>
              </button>

              <button
                onClick={handleExportCsv}
                className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/50 text-slate-700 font-semibold flex items-center space-x-2.5 transition-all text-left"
              >
                <FileSpreadsheet className="w-4 h-4 text-teal-600 flex-shrink-0" />
                <span>Export Reports CSV</span>
              </button>

              <button
                onClick={() => setShowAuditModal(true)}
                className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/50 text-slate-700 font-semibold flex items-center space-x-2.5 transition-all text-left"
              >
                <History className="w-4 h-4 text-teal-600 flex-shrink-0" />
                <span>View Audit Log</span>
              </button>
            </div>
          </div>

          {/* REPORT GUIDELINES NOTE (Prompt Spec: "Once signed a report is locked. Addendums can be added. All actions are logged for audit purposes.") */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-sm space-y-2">
            <div className="flex items-center space-x-2 text-teal-400">
              <ShieldCheck className="w-5 h-5" />
              <h4 className="text-xs font-bold uppercase tracking-wider">Report Guidelines</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Once signed, a clinical report is locked and cryptographically sealed. Addendums can be added by authorized clinicians. All access and actions are permanently logged for audit compliance.
            </p>
          </div>
        </div>
      </div>

      {/* ADD ADDENDUM MODAL */}
      {addendumReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FilePlus2 className="w-5 h-5 text-teal-600" />
                Append Clinical Addendum
              </h3>
              <button onClick={() => setAddendumReport(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitAddendum} className="space-y-3.5 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="text-slate-600">
                  Appending addendum to <span className="font-bold text-slate-900">{addendumReport.report_number}</span> for patient{' '}
                  <span className="font-bold text-slate-900">{addendumReport.patient_name}</span>.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Signed reports cannot be edited directly. This note will be permanently appended with your signature and timestamp.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Addendum Clinical Findings & Rationale *</label>
                <textarea
                  rows={4}
                  required
                  value={addendumText}
                  onChange={e => setAddendumText(e.target.value)}
                  placeholder="State additional pathology, post-biopsy findings, or clinical clarification..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddendumReport(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !addendumText.trim()}
                  className="px-5 py-2 rounded-xl text-white bg-teal-600 hover:bg-teal-700 font-semibold shadow-xs"
                >
                  Append Addendum
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUDIT LOG MODAL */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-600" />
                Regulatory Clinical Audit Trail
              </h3>
              <button onClick={() => setShowAuditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start space-x-3">
                <div className="w-2 h-2 rounded-full bg-teal-500 mt-1.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-bold text-slate-900">Digital Signature Applied</p>
                  <p className="text-slate-600 text-[11px]">Dr. Mehta verified and cryptographically locked report REP-2026-0001</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Today • Hash: SHA256-4c9f1a... • IP: 127.0.0.1</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start space-x-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-bold text-slate-900">PDF Export Generated</p>
                  <p className="text-slate-600 text-[11px]">Certified report downloaded for patient record filing</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Today • TNMC123456 authorized</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start space-x-3">
                <div className="w-2 h-2 rounded-full bg-sky-500 mt-1.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-bold text-slate-900">Report Shared via Patient Portal</p>
                  <p className="text-slate-600 text-[11px]">Patient notified via secure SMS and In-App Portal</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Yesterday • Delivery: Confirmed</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowAuditModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold text-xs"
              >
                Close Audit Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
