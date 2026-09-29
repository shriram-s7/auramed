import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  Search,
  Filter,
  Calendar,
  ChevronRight,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown
} from 'lucide-react'
import PatientLayout from '../../components/patient/PatientLayout'
import { getModuleSvgIcon } from '../../components/patient/ModuleIcons'
import RotterdamBadge from '../../components/common/RotterdamBadge'
import { fetchPatientReports } from '../../services/patientPortalService'

export default function PatientReports() {
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState([])
  const [moduleFilter, setModuleFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    setLoading(true)
    fetchPatientReports({ module: moduleFilter !== 'all' ? moduleFilter : undefined })
      .then(res => setReports(res.data || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [moduleFilter])

  const filtered = reports.filter(r => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      r.report_type.toLowerCase().includes(q) ||
      r.doctor_name.toLowerCase().includes(q) ||
      r.date.includes(q)
    )
  })

  const renderBadge = (label, color) => {
    if (color === 'red' || label === 'Needs Follow-up') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
          Needs Follow-up
        </span>
      )
    }
    if (color === 'amber' || label === 'Monitor') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
          Monitor
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        Normal
      </span>
    )
  }

  return (
    <PatientLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">My Health Reports</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              All your certified diagnostic summaries translated into plain language
            </p>
          </div>
        </div>

        {/* Filter Bar: Filter by module and date */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Filter Screening:</span>
            <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-2xl">
              {['all', 'breast', 'cervical', 'pcos'].map(m => (
                <button
                  key={m}
                  onClick={() => setModuleFilter(m)}
                  className={`px-3 py-1 rounded-xl font-bold capitalize transition-all ${
                    moduleFilter === m
                      ? 'bg-white text-teal-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {m === 'all' ? 'All Screenings' : `${m} Health`}
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search reports or doctors..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-8 pr-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Reports List Cards / Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              Loading your certified reports...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No reports matching your criteria
            </div>
          ) : (
            filtered.map(r => (
              <div
                key={r.id}
                className="p-5 hover:bg-teal-50/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start sm:items-center space-x-4">
                  {/* Module icon */}
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
                    {getModuleSvgIcon(r.module, "w-6 h-6")}
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">{r.report_type}</h3>
                    <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5" />
                        {r.date}
                      </span>
                      <span>•</span>
                      <span>Reviewing Doctor: <strong className="text-slate-700">{r.doctor_name}</strong></span>
                      <span>•</span>
                      <span className="text-slate-500">{r.hospital}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 self-end sm:self-center">
                  {r.module === 'pcos' && (
                    <RotterdamBadge
                      positive={r.rotterdam_positive}
                      pending={r.rotterdam_positive === null || r.rotterdam_positive === undefined}
                    />
                  )}
                  {renderBadge(r.result_badge, r.result_color)}
                  <Link
                    to={`/patient/reports/${r.id}`}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-xs shadow-2xs transition-colors flex items-center space-x-1"
                  >
                    <span>View Report</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PatientLayout>
  )
}
