import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  FilePlus,
  FileSignature,
  FileText,
  Filter,
  Info,
  Layers,
  Microscope,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UploadCloud,
  User,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import InitialsAvatar from '../../components/common/InitialsAvatar'
import { fetchDoctorActivity, exportActivityCSV } from '../../services/activityService'

// Action icon and styling mapping according to prompt specifications
function getActionConfig(actionType, actionTitle) {
  const norm = (actionType || '').toLowerCase()
  if (norm.includes('sign')) {
    return {
      icon: Pencil,
      label: 'Signed Report',
      colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      iconColor: 'text-emerald-600',
    }
  }
  if (norm.includes('modified') || norm.includes('clinical_value')) {
    return {
      icon: Edit3,
      label: 'Modified Clinical Value',
      colorClass: 'text-amber-700 bg-amber-50 border-amber-200',
      iconColor: 'text-amber-600',
    }
  }
  if (norm.includes('analysis') || norm.includes('ai')) {
    return {
      icon: ShieldCheck,
      label: 'Analysis Generated',
      colorClass: 'text-blue-700 bg-blue-50 border-blue-200',
      iconColor: 'text-blue-600',
    }
  }
  if (norm.includes('scan_uploaded') || norm.includes('upload')) {
    return {
      icon: Download,
      label: 'Scan Uploaded',
      colorClass: 'text-teal-700 bg-teal-50 border-teal-200',
      iconColor: 'text-teal-600',
    }
  }
  if (norm.includes('referred') || norm.includes('referral')) {
    return {
      icon: UserCheck,
      label: 'Referred to Specialist',
      colorClass: 'text-purple-700 bg-purple-50 border-purple-200',
      iconColor: 'text-purple-600',
    }
  }
  if (norm.includes('generated_report')) {
    return {
      icon: FileText,
      label: 'Generated Report',
      colorClass: 'text-slate-700 bg-slate-100 border-slate-200',
      iconColor: 'text-slate-600',
    }
  }
  if (norm.includes('patient_registered') || norm.includes('new_patient')) {
    return {
      icon: UserPlus,
      label: 'New Patient Registered',
      colorClass: 'text-sky-700 bg-sky-50 border-sky-200',
      iconColor: 'text-sky-600',
    }
  }
  if (norm.includes('addendum')) {
    return {
      icon: FilePlus,
      label: 'Added Addendum',
      colorClass: 'text-blue-700 bg-blue-50 border-blue-200',
      iconColor: 'text-blue-600',
    }
  }
  if (norm.includes('delete') || norm.includes('archived')) {
    return {
      icon: Trash2,
      label: 'Archived Scan',
      colorClass: 'text-rose-700 bg-rose-50 border-rose-200',
      iconColor: 'text-rose-600',
    }
  }
  if (norm.includes('followup') || norm.includes('appointment')) {
    return {
      icon: Calendar,
      label: 'Scheduled Follow-up',
      colorClass: 'text-teal-700 bg-teal-50 border-teal-200',
      iconColor: 'text-teal-600',
    }
  }
  if (norm.includes('share')) {
    return {
      icon: Share2,
      label: 'Shared Report',
      colorClass: 'text-blue-700 bg-blue-50 border-blue-200',
      iconColor: 'text-blue-600',
    }
  }
  return {
    icon: Activity,
    label: actionTitle || 'Clinical Action',
    colorClass: 'text-slate-700 bg-slate-50 border-slate-200',
    iconColor: 'text-slate-600',
  }
}

function getModuleBadge(module) {
  const norm = (module || '').toLowerCase()
  if (norm === 'breast') {
    return { label: 'Breast Cancer', color: 'bg-pink-50 text-pink-700 border-pink-200' }
  }
  if (norm === 'cervical') {
    return { label: 'Cervical Cancer', color: 'bg-purple-50 text-purple-700 border-purple-200' }
  }
  if (norm === 'pcos') {
    return { label: 'PCOS', color: 'bg-teal-50 text-teal-700 border-teal-200' }
  }
  return { label: module || 'General', color: 'bg-slate-50 text-slate-700 border-slate-200' }
}

function getStatusBadge(status) {
  const norm = (status || '').toLowerCase()
  if (norm === 'failed') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Failed</span>
  }
  if (norm === 'pending') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Pending</span>
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Success</span>
}

export default function DoctorActivity() {
  const navigate = useNavigate()

  // Filter States
  const [dateRange, setDateRange] = useState('30days')
  const [actionType, setActionType] = useState('All')
  const [module, setModule] = useState('All')
  const [patientId, setPatientId] = useState('All')
  const [page, setPage] = useState(1)
  const limit = 10

  // Data States
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState(null)

  // Compute dates based on dateRange
  const queryDates = useMemo(() => {
    const now = new Date()
    if (dateRange === '7days') {
      const d = new Date()
      d.setDate(now.getDate() - 7)
      return { start_date: d.toISOString() }
    }
    if (dateRange === '30days') {
      const d = new Date()
      d.setDate(now.getDate() - 30)
      return { start_date: d.toISOString() }
    }
    if (dateRange === '90days') {
      const d = new Date()
      d.setDate(now.getDate() - 90)
      return { start_date: d.toISOString() }
    }
    return {}
  }, [dateRange])

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true)
    else setLoading(true)

    try {
      const params = {
        page,
        limit,
        action_type: actionType !== 'All' ? actionType : undefined,
        module: module !== 'All' ? module : undefined,
        patient_id: patientId !== 'All' ? patientId : undefined,
        ...queryDates,
      }
      const res = await fetchDoctorActivity(params)
      setData(res.data)
      if (res.data.items?.length > 0) {
        // Select first row if nothing selected or previous selection not in list
        if (!selectedActivity || !res.data.items.find(i => i.id === selectedActivity.id)) {
          setSelectedActivity(res.data.items[0])
        }
      } else {
        setSelectedActivity(null)
      }
    } catch (err) {
      console.error('Error fetching doctor activity:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [page, actionType, module, patientId, dateRange])

  // Handle Export CSV
  const handleExportCSV = async () => {
    setExporting(true)
    try {
      const params = {
        action_type: actionType !== 'All' ? actionType : undefined,
        module: module !== 'All' ? module : undefined,
        patient_id: patientId !== 'All' ? patientId : undefined,
      }
      const res = await exportActivityCSV(params)
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `auramed_doctor_activity_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      console.error('CSV export failed:', err)
      alert('Unable to export CSV. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const stats = data?.stats || {
    total_actions: 0,
    total_actions_change: '+0% vs last week',
    scans_analyzed: 0,
    reports_generated: 0,
    reports_signed: 0,
    referrals_made: 0,
  }

  const insights = data?.insights || {
    top_module: 'breast',
    reports_signed_this_month: 0,
    avg_time_scan_to_report_minutes: 14,
  }

  const items = data?.items || []
  const pagination = data?.pagination || { page: 1, total: 0, total_pages: 1 }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">My Activity</h1>
          <p className="mt-1 text-sm text-primary/60 max-w-2xl">
            Track your actions, review past activities, and ensure transparency in patient care.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="self-start sm:self-auto flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-primary hover:border-accent hover:text-accent disabled:opacity-50 transition shadow-xs"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* FIVE STAT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Card 1: Total Actions */}
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary/60">Total Actions</span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
              <Activity size={16} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-primary">{stats.total_actions}</p>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
            <TrendingUp size={12} />
            <span>{stats.total_actions_change}</span>
          </div>
        </div>

        {/* Card 2: Scans Analyzed */}
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary/60">Scans Analyzed</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Microscope size={16} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-primary">{stats.scans_analyzed}</p>
          <p className="mt-1 text-[11px] text-primary/40 font-medium">Multimodal AI reviews</p>
        </div>

        {/* Card 3: Reports Generated */}
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary/60">Reports Generated</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <FileText size={16} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-primary">{stats.reports_generated}</p>
          <p className="mt-1 text-[11px] text-primary/40 font-medium">Screening evaluations</p>
        </div>

        {/* Card 4: Reports Signed */}
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary/60">Reports Signed</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <FileSignature size={16} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-primary">{stats.reports_signed}</p>
          <p className="mt-1 text-[11px] text-emerald-600 font-semibold">Clinically locked</p>
        </div>

        {/* Card 5: Referrals Made */}
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary/60">Referrals Made</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Send size={16} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-primary">{stats.referrals_made}</p>
          <p className="mt-1 text-[11px] text-primary/40 font-medium">Specialist transfers</p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1">
            {/* Date range picker */}
            <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs text-primary">
              <Calendar size={14} className="text-primary/40" />
              <select
                value={dateRange}
                onChange={(e) => { setDateRange(e.target.value); setPage(1) }}
                className="bg-transparent border-none text-xs font-medium focus:outline-none cursor-pointer"
              >
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>

            {/* Action Type dropdown */}
            <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs text-primary">
              <Filter size={14} className="text-primary/40" />
              <select
                value={actionType}
                onChange={(e) => { setActionType(e.target.value); setPage(1) }}
                className="bg-transparent border-none text-xs font-medium focus:outline-none cursor-pointer"
              >
                <option value="All">All Action Types</option>
                <option value="signed_report">Signed Report</option>
                <option value="modified_clinical_value">Modified Clinical Value</option>
                <option value="analysis_generated">Analysis Generated</option>
                <option value="scan_uploaded">Scan Uploaded</option>
                <option value="referred_specialist">Referred to Specialist</option>
                <option value="generated_report">Generated Report</option>
                <option value="new_patient_registered">New Patient Registered</option>
                <option value="added_addendum">Added Addendum</option>
                <option value="deleted_scan">Archived Scan (Deleted)</option>
                <option value="scheduled_followup">Scheduled Follow-up</option>
                <option value="shared_report">Shared Report</option>
              </select>
            </div>

            {/* Module dropdown */}
            <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs text-primary">
              <Layers size={14} className="text-primary/40" />
              <select
                value={module}
                onChange={(e) => { setModule(e.target.value); setPage(1) }}
                className="bg-transparent border-none text-xs font-medium focus:outline-none cursor-pointer"
              >
                <option value="All">All Modules</option>
                <option value="breast">Breast Cancer</option>
                <option value="cervical">Cervical Cancer</option>
                <option value="pcos">PCOS</option>
              </select>
            </div>

            {/* Patient dropdown */}
            <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs text-primary max-w-xs">
              <User size={14} className="text-primary/40" />
              <select
                value={patientId}
                onChange={(e) => { setPatientId(e.target.value); setPage(1) }}
                className="bg-transparent border-none text-xs font-medium focus:outline-none cursor-pointer truncate"
              >
                <option value="All">All Patients</option>
                {data?.patients_filter?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Export Log CSV button */}
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={exporting}
            className="flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-50 transition shadow-xs shrink-0"
          >
            <Download size={14} />
            <span>{exporting ? 'Exporting...' : 'Export Log CSV'}</span>
          </button>
        </div>
      </div>

      {/* MAIN TWO COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT - Activity Table (8 Cols) */}
        <div className="lg:col-span-8 rounded-2xl border border-border bg-surface shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-bold text-primary">Activity Records</h2>
            <span className="text-xs text-primary/50 font-medium">
              Showing {items.length > 0 ? (page - 1) * limit + 1 : 0}-{Math.min(page * limit, pagination.total)} of {pagination.total} activities
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-primary/40 space-y-3">
              <RefreshCw size={24} className="animate-spin mx-auto text-accent" />
              <p className="text-sm">Loading activity logs...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-primary/50 space-y-2">
              <Activity size={32} className="mx-auto text-primary/30" />
              <p className="text-sm font-semibold text-primary">No activities found</p>
              <p className="text-xs text-primary/50">Try adjusting your filters or date range.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border/80 bg-background/50 text-primary/60 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Module</th>
                    <th className="py-3 px-4">Details</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {items.map((row) => {
                    const actionCfg = getActionConfig(row.action_type, row.action_title)
                    const ActionIcon = actionCfg.icon
                    const modCfg = getModuleBadge(row.module)
                    const isSelected = selectedActivity?.id === row.id

                    const dateObj = new Date(row.created_at)
                    const dateFormatted = dateObj.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                    const timeFormatted = dateObj.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })

                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedActivity(row)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-accent/10 font-medium'
                            : 'hover:bg-background/80'
                        }`}
                      >
                        {/* Date and Time */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <p className="font-semibold text-primary">{dateFormatted}</p>
                          <p className="text-[10px] text-primary/40">{timeFormatted}</p>
                        </td>

                        {/* Action with colored icon */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg border ${actionCfg.colorClass}`}>
                              <ActionIcon size={14} className={actionCfg.iconColor} />
                            </div>
                            <span className="font-semibold text-primary">{actionCfg.label}</span>
                          </div>
                        </td>

                        {/* Patient (Initials Avatar + name + patient ID) */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <InitialsAvatar name={row.patient_name || 'Patient'} size={24} />
                            <div className="min-w-0">
                              <p className="font-semibold text-primary leading-tight truncate">
                                {row.patient_name || 'Anonymous'}
                              </p>
                              <p className="text-[10px] text-primary/40 leading-tight">
                                {row.patient_code || ''}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Module Pill */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${modCfg.color}`}>
                            {modCfg.label}
                          </span>
                        </td>

                        {/* Details */}
                        <td className="py-3 px-4 max-w-xs">
                          <p className="truncate text-primary/80" title={row.details}>
                            {row.details}
                          </p>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {getStatusBadge(row.status)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <div className="p-3.5 border-t border-border bg-background/30 flex items-center justify-between text-xs text-primary/60">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-background disabled:opacity-40 transition font-medium"
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>

              <div className="flex items-center gap-1 font-medium">
                {Array.from({ length: pagination.total_pages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`h-7 w-7 rounded-lg text-xs flex items-center justify-center transition font-semibold ${
                      p === page
                        ? 'bg-accent text-white shadow-xs'
                        : 'hover:bg-border/60 text-primary/70'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                disabled={page === pagination.total_pages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-background disabled:opacity-40 transition font-medium"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* RIGHT - Activity Details Panel (4 Cols) */}
        <div className="lg:col-span-4 rounded-2xl border border-border bg-surface shadow-xs p-5 space-y-4">
          {!selectedActivity ? (
            <div className="py-16 text-center text-primary/40 space-y-2">
              <Activity size={36} className="mx-auto text-primary/20" />
              <p className="text-sm font-semibold text-primary">Select an activity to view details</p>
              <p className="text-xs text-primary/40">Click any row in the table to inspect full metadata.</p>
            </div>
          ) : (
            <>
              {/* Header with action icon */}
              {(() => {
                const actionCfg = getActionConfig(selectedActivity.action_type, selectedActivity.action_title)
                const ActionIcon = actionCfg.icon
                const modCfg = getModuleBadge(selectedActivity.module)
                const dateObj = new Date(selectedActivity.created_at)

                return (
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-border">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl border ${actionCfg.colorClass}`}>
                          <ActionIcon size={18} className={actionCfg.iconColor} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-primary">{actionCfg.label}</h3>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border mt-0.5 ${modCfg.color}`}>
                            {modCfg.label}
                          </span>
                        </div>
                      </div>
                      {getStatusBadge(selectedActivity.status)}
                    </div>

                    <p className="text-[11px] text-primary/50 mt-2 flex items-center gap-1">
                      <Clock size={12} />
                      <span>
                        {dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at{' '}
                        {dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </p>
                  </div>
                )
              })()}

              {/* Detail Rows */}
              <div className="space-y-3 pt-2 text-xs">
                {/* Patient */}
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <span className="text-primary/50 font-medium">Patient</span>
                  {selectedActivity.patient_id ? (
                    <Link
                      to={`/doctor/patients/${selectedActivity.patient_id}`}
                      className="font-bold text-accent hover:underline flex items-center gap-1"
                    >
                      <span>{selectedActivity.patient_name}</span>
                      <ExternalLink size={12} />
                    </Link>
                  ) : (
                    <span className="font-semibold text-primary">{selectedActivity.patient_name || 'N/A'}</span>
                  )}
                </div>

                {/* Module */}
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <span className="text-primary/50 font-medium">Screening Module</span>
                  <span className="font-semibold text-primary uppercase text-[11px] tracking-wider">
                    {selectedActivity.module}
                  </span>
                </div>

                {/* Report ID if applicable */}
                {selectedActivity.related_resource_type === 'report' && (
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <span className="text-primary/50 font-medium">Report Reference</span>
                    <Link
                      to={`/doctor/reports/${selectedActivity.related_resource_id || 'rep-demo-01'}`}
                      className="font-mono font-bold text-accent hover:underline flex items-center gap-1"
                    >
                      <span>{selectedActivity.related_resource_id || 'RPT-2026-0001'}</span>
                      <ExternalLink size={12} />
                    </Link>
                  </div>
                )}

                {/* Action Performed */}
                <div className="border-b border-border/50 pb-2">
                  <span className="text-primary/50 font-medium block mb-1">Action Performed</span>
                  <p className="font-medium text-primary bg-background p-2.5 rounded-xl border border-border/60 text-xs leading-relaxed">
                    {selectedActivity.details}
                  </p>
                </div>

                {/* Performed By */}
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <span className="text-primary/50 font-medium">Performed By</span>
                  <span className="font-semibold text-primary text-right">
                    {selectedActivity.doctor_name} ({selectedActivity.doctor_reg})
                  </span>
                </div>

                {/* IP Address */}
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <span className="text-primary/50 font-medium">IP Address</span>
                  <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                    {selectedActivity.ip_address || '192.168.1.45'}
                  </code>
                </div>

                {/* Device & Browser */}
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <span className="text-primary/50 font-medium">Client Environment</span>
                  <span className="text-primary/80 font-medium text-right text-[11px]">
                    {selectedActivity.device_info || 'Chrome 128 • Windows 11'}
                  </span>
                </div>

                {/* Additional Notes */}
                {selectedActivity.additional_notes && (
                  <div className="border-b border-border/50 pb-2">
                    <span className="text-primary/50 font-medium block mb-0.5">Clinical Audit Note</span>
                    <p className="text-[11px] text-primary/70 italic">
                      {selectedActivity.additional_notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Contextual Note based on action type */}
              {selectedActivity.action_type === 'signed_report' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 flex items-start gap-2 text-xs text-emerald-900">
                  <Info size={16} className="text-emerald-700 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>Notice:</strong> Signed reports cannot be edited. Only addendums can be added to append clinical information.
                  </p>
                </div>
              )}

              {selectedActivity.action_type === 'deleted_scan' && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 flex items-start gap-2 text-xs text-rose-900">
                  <Info size={16} className="text-rose-700 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>Archival Policy:</strong> Scan data has been archived and can be retrieved by platform administrator upon regulatory requisition.
                  </p>
                </div>
              )}

              {/* Action Button Relevant to Record */}
              <div className="pt-2">
                {selectedActivity.related_resource_type === 'report' ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/doctor/reports/${selectedActivity.related_resource_id || 'rep-demo-01'}`)}
                    className="w-full py-2.5 rounded-xl bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <FileText size={14} />
                    <span>View Report</span>
                  </button>
                ) : selectedActivity.related_resource_type === 'scan' ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/doctor/scan/${selectedActivity.module || 'breast'}/results/${selectedActivity.related_resource_id || 'scan-demo-01'}`)}
                    className="w-full py-2.5 rounded-xl bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <Microscope size={14} />
                    <span>View Scan Analysis</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate(`/doctor/patients/${selectedActivity.patient_id || 'pat-demo-01'}`)}
                    className="w-full py-2.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <User size={14} />
                    <span>View Patient Profile</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* BOTTOM - Activity Insights panel */}
      <div className="rounded-2xl border border-border bg-gradient-to-r from-teal-50/70 via-cyan-50/50 to-blue-50/70 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={18} className="text-accent" />
          <h3 className="text-sm font-bold text-primary">Activity Insights</h3>
          <span className="text-[10px] font-semibold text-accent uppercase tracking-wider bg-white/80 px-2 py-0.5 rounded-full border border-teal-200">
            Real-Time Analysis
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Chip 1: Top Module */}
          <div className="bg-white/80 rounded-xl p-3.5 border border-teal-100 flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-xs text-primary/60 font-medium">Most active module:</p>
              <p className="text-sm font-bold text-primary capitalize mt-0.5">
                {insights.top_module === 'breast' ? 'Breast Cancer' : insights.top_module === 'cervical' ? 'Cervical Cancer' : 'PCOS'}
              </p>
            </div>
            {(() => {
              const modCfg = getModuleBadge(insights.top_module)
              return (
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${modCfg.color}`}>
                  {modCfg.label}
                </span>
              )
            })()}
          </div>

          {/* Chip 2: Signed Reports This Month */}
          <div className="bg-white/80 rounded-xl p-3.5 border border-teal-100 flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-xs text-primary/60 font-medium">Signed reports this month:</p>
              <p className="text-sm font-bold text-emerald-700 mt-0.5">
                {insights.reports_signed_this_month} Reports
              </p>
            </div>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <FileSignature size={18} />
            </div>
          </div>

          {/* Chip 3: Average Time from Scan to Report */}
          <div className="bg-white/80 rounded-xl p-3.5 border border-teal-100 flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-xs text-primary/60 font-medium">Average turnaround time:</p>
              <p className="text-sm font-bold text-blue-700 mt-0.5">
                {insights.avg_time_scan_to_report_minutes} minutes from scan to report
              </p>
            </div>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Clock size={18} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
