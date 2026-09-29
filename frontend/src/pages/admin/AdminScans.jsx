import React, { useState, useEffect, useMemo } from 'react'
import {
  ScanLine,
  Search,
  Filter,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  FileText,
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import RiskBadge from '../../components/common/RiskBadge'
import RotterdamBadge from '../../components/common/RotterdamBadge'
import { fetchAdminScans } from '../../services/adminService'

export default function AdminScans() {
  const [loading, setLoading] = useState(true)
  const [scans, setScans] = useState([])
  const [moduleFilter, setModuleFilter] = useState('all')
  const [riskFilter, setRiskFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [toastMessage, setToastMessage] = useState(null)

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 3500)
  }

  const loadScans = async () => {
    try {
      setLoading(true)
      const res = await fetchAdminScans({
        module: moduleFilter !== 'all' ? moduleFilter : undefined,
        risk_level: riskFilter !== 'all' ? riskFilter : undefined,
      })
      setScans(res.data.items || [])
    } catch (err) {
      console.error('Error fetching admin scans:', err)
      showToast('Failed to load scan records', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadScans()
  }, [moduleFilter, riskFilter])

  const filteredScans = useMemo(() => {
    if (!searchQuery.trim()) return scans
    const q = searchQuery.toLowerCase()
    return scans.filter(
      (s) =>
        s.patient_name?.toLowerCase().includes(q) ||
        s.patient_code?.toLowerCase().includes(q) ||
        s.doctor_name?.toLowerCase().includes(q) ||
        s.id?.toLowerCase().includes(q),
    )
  }, [scans, searchQuery])

  const stats = useMemo(() => {
    const total = scans.length
    const breast = scans.filter((s) => s.module === 'breast').length
    const cervical = scans.filter((s) => s.module === 'cervical').length
    const pcos = scans.filter((s) => s.module === 'pcos').length
    return { total, breast, cervical, pcos }
  }, [scans])

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
              <ScanLine className="w-8 h-8 text-teal-600" />
              All Diagnostic Scans
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Global clinical repository of AI inference scans across Breast, Cervical, and PCOS modalities
            </p>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-xs font-semibold text-slate-500">Total Scans</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{stats.total}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-xs font-semibold text-pink-600">Breast Cancer</p>
            <p className="text-2xl font-black text-pink-700 mt-1">{stats.breast}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-xs font-semibold text-purple-600">Cervical Cytology</p>
            <p className="text-2xl font-black text-purple-700 mt-1">{stats.cervical}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <p className="text-xs font-semibold text-teal-600">PCOS Ultrasound</p>
            <p className="text-2xl font-black text-teal-700 mt-1">{stats.pcos}</p>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by patient name, code, doctor, or scan ID..."
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500/30"
            >
              <option value="all">All Modules</option>
              <option value="breast">Breast Cancer</option>
              <option value="cervical">Cervical Cancer</option>
              <option value="pcos">PCOS</option>
            </select>

            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500/30"
            >
              <option value="all">All Risk Levels</option>
              <option value="low">Low Risk</option>
              <option value="moderate">Moderate Risk</option>
              <option value="high">High Risk</option>
              <option value="critical">Critical Risk</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Loading scan registry...</p>
            </div>
          ) : filteredScans.length === 0 ? (
            <div className="p-12 text-center">
              <ScanLine className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No scans found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No scans match the current filter selection.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Scan Date</th>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Attending Doctor</th>
                    <th className="py-3 px-4">Module</th>
                    <th className="py-3 px-4">Risk Level</th>
                    <th className="py-3 px-4">AI Confidence</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredScans.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-600">
                        {s.scan_date || '—'}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <p>{s.patient_name}</p>
                        <p className="text-[11px] font-mono text-slate-500 font-normal">{s.patient_code}</p>
                      </td>
                      <td className="py-3.5 px-4 text-slate-800">{s.doctor_name}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              s.module === 'breast'
                                ? 'bg-pink-100 text-pink-800 border border-pink-200'
                                : s.module === 'cervical'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : 'bg-teal-100 text-teal-800 border border-teal-200'
                            }`}
                          >
                            {s.module}
                          </span>
                          {s.module === 'pcos' && (
                            <RotterdamBadge
                              positive={s.rotterdam_positive}
                              pending={s.rotterdam_positive === null || s.rotterdam_positive === undefined}
                            />
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <RiskBadge risk={s.risk_level} />
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {s.confidence_score != null ? `${(s.confidence_score * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {s.status}
                        </span>
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
