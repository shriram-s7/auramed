import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  UserCheck,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Send,
  Building2,
  Calendar,
  User,
  ArrowUpRight
} from 'lucide-react'
import { fetchDoctorReferrals } from '../../services/referralService'

export default function DoctorReferrals() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [referrals, setReferrals] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetchDoctorReferrals()
      .then(res => {
        setReferrals(res.data || [])
      })
      .catch(err => console.error('Failed to load referrals:', err))
      .finally(() => setLoading(false))
  }, [])

  const filteredReferrals = referrals.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      r.patient_name?.toLowerCase().includes(q) ||
      r.to_specialist?.toLowerCase().includes(q) ||
      r.specialty?.toLowerCase().includes(q) ||
      r.patient_code?.toLowerCase().includes(q)
    )
  })

  const getPriorityBadge = prio => {
    const p = (prio || 'urgent').toLowerCase()
    if (p === 'emergency') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">Emergency (24-48h)</span>
    }
    if (p === 'urgent') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Urgent (1-2 wks)</span>
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">Routine</span>
  }

  const getStatusBadge = status => {
    const s = (status || 'sent').toLowerCase()
    if (s === 'completed') {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</span>
    }
    if (s === 'scheduled') {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200"><Calendar className="w-3 h-3 mr-1" />Scheduled</span>
    }
    if (s === 'accepted') {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200"><Clock className="w-3 h-3 mr-1" />Accepted</span>
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200"><Send className="w-3 h-3 mr-1" />Sent</span>
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium mb-1">
            <span>Doctor Portal</span>
            <span>/</span>
            <span className="text-teal-700">Specialist Referrals</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCheck className="w-7 h-7 text-teal-600" />
            Specialist Clinical Referrals
          </h1>
          <p className="text-sm text-slate-500">
            Track multi-disciplinary consultations, surgical oncology handoffs, and specialist feedback
          </p>
        </div>

        <Link
          to="/doctor/referrals/new"
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl shadow-sm text-sm font-semibold transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Referral to Specialist</span>
        </Link>
      </div>

      {/* STATS OVERVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Referrals</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{referrals.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">Dispatched to date</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 border border-teal-100">
            <Send className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-amber-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Urgent & Emergency</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">
              {referrals.filter(r => r.priority === 'urgent' || r.priority === 'emergency').length}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">High priority handoffs</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-200">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Active Consultations</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              {referrals.filter(r => r.status !== 'completed').length}
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">In specialist review</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-200">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-500">Status:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="all">All Statuses</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search patient, specialist, specialty..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* REFERRALS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Patient</th>
                <th className="py-3 px-4">Target Specialist</th>
                <th className="py-3 px-4">Specialty</th>
                <th className="py-3 px-4">Reason for Referral</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date Sent</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Loading specialist referrals...
                  </td>
                </tr>
              ) : filteredReferrals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No specialist referrals recorded.{' '}
                    <Link to="/doctor/referrals/new" className="text-teal-600 font-bold underline ml-1">
                      Create your first referral
                    </Link>
                  </td>
                </tr>
              ) : (
                filteredReferrals.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center">
                          {(r.patient_name || 'PT').split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{r.patient_name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{r.patient_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {r.to_specialist}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {r.specialty}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={r.reason}>
                      {r.reason}
                    </td>
                    <td className="py-3 px-4">
                      {getPriorityBadge(r.priority)}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(r.status)}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {r.created_at ? r.created_at.split('T')[0] : 'Recent'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/doctor/patients/${r.patient_id}`}
                        className="inline-flex items-center space-x-1 text-teal-600 hover:text-teal-800 font-semibold"
                      >
                        <span>Patient</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
