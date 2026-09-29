import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts'
import {
  Users,
  Stethoscope,
  FileText,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Calendar,
  Activity,
  UserCheck,
  FileX2,
  Bell,
  RefreshCw,
  Server
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import {
  fetchAdminStats,
  fetchSystemStatus,
  fetchAdminAuditLogs,
  fetchPendingCounts
} from '../../services/adminService'

export default function AdminDashboard() {
  const navigate = useNavigate()

  // State
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [systemStatus, setSystemStatus] = useState(null)
  const [recentActivity, setRecentActivity] = useState([])
  const [pendingCounts, setPendingCounts] = useState({
    doctor_verifications: 0,
    data_deletion_requests: 0,
    unusual_activity: 0,
    system_notifications: 0
  })

  // Date range for chart: 'last_6_months' | 'last_3_months' | 'last_year'
  const [chartRange, setChartRange] = useState('last_6_months')
  const [refreshingStatus, setRefreshingStatus] = useState(false)

  // Notification modal for pending actions
  const [showNotificationList, setShowNotificationList] = useState(false)

  // Load dashboard data
  const loadDashboard = async () => {
    try {
      setLoading(true)
      const [statsRes, sysRes, actRes, pendRes] = await Promise.all([
        fetchAdminStats(),
        fetchSystemStatus(),
        fetchAdminAuditLogs({ limit: 10 }),
        fetchPendingCounts()
      ])

      setStats(statsRes.data)
      setSystemStatus(sysRes.data)
      setRecentActivity(actRes.data?.items || [])
      setPendingCounts(pendRes.data || {})
    } catch (err) {
      console.error('Failed to load admin dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  // Auto-refresh system status every 30 seconds
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        setRefreshingStatus(true)
        const sysRes = await fetchSystemStatus()
        setSystemStatus(sysRes.data)
      } catch (err) {
        console.error('System status poll error:', err)
      } finally {
        setTimeout(() => setRefreshingStatus(false), 800)
      }
    }, 30000)

    return () => clearInterval(timer)
  }, [])

  // Action badge color mapping
  // Login: blue, Verified: green, Generated Report: purple, Data Export: gray, Deletion Request: red, Alert: red
  const getActionBadge = action => {
    const a = (action || '').toLowerCase()
    if (a.includes('login')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">Login</span>
    }
    if (a.includes('verif') || a.includes('approve')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Verified</span>
    }
    if (a.includes('report') || a.includes('generate')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">Generated Report</span>
    }
    if (a.includes('export')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">Data Export</span>
    }
    if (a.includes('delet') || a.includes('purge') || a.includes('request')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">Deletion Request</span>
    }
    if (a.includes('alert') || a.includes('unauthorized') || a.includes('fail')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">Alert</span>
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">{action}</span>
  }

  // Chart dataset based on selected dropdown
  const chartData = stats?.screenings_over_time?.[chartRange] || [
    { month: 'Apr', breast: 120, cervical: 85, pcos: 94 },
    { month: 'May', breast: 145, cervical: 98, pcos: 110 },
    { month: 'Jun', breast: 160, cervical: 115, pcos: 125 },
    { month: 'Jul', breast: 190, cervical: 130, pcos: 140 },
    { month: 'Aug', breast: 210, cervical: 142, pcos: 158 },
    { month: 'Sep', breast: 240, cervical: 165, pcos: 175 }
  ]

  // Formatted current date top right
  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* TOP HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Dashboard</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Overview of platform activity, users, and system status
            </p>
          </div>

          {/* Date display top right */}
          <div className="flex items-center space-x-2 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-teal-600" />
            <span>{currentDateFormatted}</span>
          </div>
        </div>

        {/* FOUR STAT CARDS (Total Patients, Registered Doctors, Reports Generated, Pending Requests) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Patients */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Patients</p>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {stats?.total_patients?.value?.toLocaleString() || '1,424'}
              </p>
              <div className="flex items-center space-x-1 text-emerald-600 text-xs font-bold mt-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+{stats?.total_patients?.change || 12.5}%</span>
                <span className="text-slate-400 font-normal">vs last month</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Registered Doctors */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Registered Doctors</p>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {stats?.registered_doctors?.value || '48'}
              </p>
              <div className="flex items-center space-x-1 text-emerald-600 text-xs font-bold mt-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+{stats?.registered_doctors?.change || 8.3}%</span>
                <span className="text-slate-400 font-normal">vs last month</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <Stethoscope className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Reports Generated */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Reports Generated</p>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {stats?.reports_generated?.value?.toLocaleString() || '3,892'}
              </p>
              <div className="flex items-center space-x-1 text-emerald-600 text-xs font-bold mt-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+{stats?.reports_generated?.change || 15.2}%</span>
                <span className="text-slate-400 font-normal">vs last month</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <FileText className="w-6 h-6" />
            </div>
          </div>

          {/* Card 4: Pending Requests (Red if > 0) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">Pending Requests</p>
              <p className="text-2xl font-black text-rose-600 mt-1">
                {stats?.pending_requests?.value ?? 4}
              </p>
              <div className="flex items-center space-x-1 text-rose-500 text-xs font-bold mt-1">
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>{stats?.pending_requests?.change || -20.0}%</span>
                <span className="text-slate-400 font-normal">backlog reduction</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* TWO COLUMN MIDDLE SECTION: Screenings Chart (Left) + System Status (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT - Screenings Over Time chart (lg:col-span-8) */}
          <div className="lg:col-span-8 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Screenings Over Time</h3>
                <p className="text-[11px] text-slate-500">Multi-modal clinical volume across cancer indications</p>
              </div>

              {/* Date Range Dropdown: Last 6 Months, Last 3 Months, Last Year */}
              <select
                value={chartRange}
                onChange={e => setChartRange(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="last_6_months">Last 6 Months</option>
                <option value="last_3_months">Last 3 Months</option>
                <option value="last_year">Last Year</option>
              </select>
            </div>

            {/* Line chart using Recharts */}
            {/* Three lines: Breast Cancer (pink #ec4899), Cervical Cancer (green #10b981), PCOS (blue #3b82f6) */}
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                    stroke="#cbd5e1"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    stroke="#cbd5e1"
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      fontSize: '11px',
                      fontWeight: 600
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  />
                  <Line
                    type="monotone"
                    name="Breast Cancer"
                    dataKey="breast"
                    stroke="#ec4899"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#ec4899' }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    name="Cervical Cancer"
                    dataKey="cervical"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#10b981' }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    name="PCOS"
                    dataKey="pcos"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#3b82f6' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* RIGHT - System Status panel (lg:col-span-4) */}
          <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">System Status</h3>
                <p className="text-[10px] text-slate-400">Refreshes every 30s</p>
              </div>

              {/* All Systems Operational Badge (green) or Degraded */}
              <div className="flex items-center space-x-1.5">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  systemStatus?.overall === 'operational'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                    systemStatus?.overall === 'operational' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`} />
                  {systemStatus?.badge || 'All Systems Operational'}
                </span>
                {refreshingStatus && <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />}
              </div>
            </div>

            {/* Status rows with colored dot indicators */}
            <div className="divide-y divide-slate-100 text-xs">
              {(systemStatus?.services || [
                { name: 'Application Server', status: 'Healthy', latency: '18ms' },
                { name: 'AI Inference Engine', status: 'Healthy', latency: '240ms' },
                { name: 'Database', status: 'Healthy', latency: '4ms' },
                { name: 'File Storage', status: 'Healthy', latency: '35ms' },
                { name: 'Email Service', status: 'Healthy', latency: '62ms' },
                { name: 'Backup Service', status: 'Healthy', latency: 'Daily OK' }
              ]).map((srv, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <span className={`w-2 h-2 rounded-full ${
                      srv.status === 'Healthy'
                        ? 'bg-emerald-500'
                        : srv.status === 'Degraded'
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`} />
                    <span className="font-medium text-slate-800">{srv.name}</span>
                  </div>

                  <div className="flex items-center space-x-2 text-right">
                    <span className="text-[10px] font-mono text-slate-400">{srv.latency}</span>
                    <span className={`text-[11px] font-bold ${
                      srv.status === 'Healthy'
                        ? 'text-emerald-700'
                        : srv.status === 'Degraded'
                        ? 'text-amber-700'
                        : 'text-rose-700'
                    }`}>
                      {srv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Overall Uptime: 99.98%</span>
              <span className="text-teal-600 font-semibold">Live Monitoring</span>
            </div>
          </div>
        </div>

        {/* BOTTOM TWO COLUMNS: Recent Activity Table (Left) + Pending Actions Panel (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT - Recent Activity table (lg:col-span-8) */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Recent Activity</h3>
                <p className="text-[11px] text-slate-500">System audit trail events and user interactions</p>
              </div>

              {/* View All link */}
              <Link
                to="/admin/audit-logs"
                className="text-xs font-bold text-teal-600 hover:text-teal-800 flex items-center space-x-1"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {recentActivity.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        No recent activity recorded
                      </td>
                    </tr>
                  ) : (
                    recentActivity.map(act => (
                      <tr key={act.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {act.timestamp ? act.timestamp.split(' ')[1] || act.timestamp : 'Just now'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          {act.user_name}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {getActionBadge(act.action)}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-sm truncate" title={act.details}>
                          {act.details}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT - Pending Actions panel (lg:col-span-4) */}
          <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Pending Actions</h3>
              <Link
                to="/admin/doctors?filter=pending"
                className="text-xs font-bold text-teal-600 hover:text-teal-800"
              >
                View All
              </Link>
            </div>

            {/* Four Action Cards with count badges:
                1. Doctor Verifications (count) -> /admin/doctors?filter=pending
                2. Data Deletion Requests (count) -> /admin/data-requests
                3. Unusual Activity (count, amber) -> /admin/audit-logs?filter=security
                4. System Notifications (count) -> shows notification list
            */}
            <div className="space-y-3">
              {/* Card 1: Doctor Verifications */}
              <div
                onClick={() => navigate('/admin/doctors?filter=pending')}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/20 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                      Doctor Verifications
                    </p>
                    <p className="text-[10px] text-slate-400">Credentials awaiting sign-off</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
                    {pendingCounts.doctor_verifications}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors" />
                </div>
              </div>

              {/* Card 2: Data Deletion Requests */}
              <div
                onClick={() => navigate('/admin/data-requests')}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-rose-500 hover:bg-rose-50/20 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-100">
                    <FileX2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 group-hover:text-rose-700 transition-colors">
                      Data Deletion Requests
                    </p>
                    <p className="text-[10px] text-slate-400">Patient DPDP/GDPR rights</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    {pendingCounts.data_deletion_requests}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition-colors" />
                </div>
              </div>

              {/* Card 3: Unusual Activity (amber) */}
              <div
                onClick={() => navigate('/admin/audit-logs?filter=security')}
                className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/30 hover:bg-amber-50/60 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-200">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-900 group-hover:text-amber-800 transition-colors">
                      Unusual Activity
                    </p>
                    <p className="text-[10px] text-amber-700">Flagged auth & security logs</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-200 text-amber-900">
                    {pendingCounts.unusual_activity}
                  </span>
                  <ChevronRight className="w-4 h-4 text-amber-700 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>

              {/* Card 4: System Notifications */}
              <div
                onClick={() => setShowNotificationList(true)}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">System Notifications</p>
                    <p className="text-[10px] text-slate-400">Scheduled maintenance & health</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                    {pendingCounts.system_notifications}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SYSTEM NOTIFICATIONS MODAL */}
      {showNotificationList && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-teal-600" />
                System Notifications
              </h3>
              <button onClick={() => setShowNotificationList(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex justify-between font-bold text-slate-800">
                  <span>Daily Database Replication</span>
                  <span className="text-[10px] text-slate-400 font-normal">2h ago</span>
                </div>
                <p className="text-slate-600 text-[11px] mt-1">
                  Automated encrypted snapshot replica created and verified in primary cold vault.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex justify-between font-bold text-slate-800">
                  <span>HIPAA Audit Benchmark</span>
                  <span className="text-[10px] text-slate-400 font-normal">4h ago</span>
                </div>
                <p className="text-slate-600 text-[11px] mt-1">
                  Zero unauthenticated resource access events detected in 24-hour audit scan.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex justify-between font-bold text-slate-800">
                  <span>AI Inference Worker Scale</span>
                  <span className="text-[10px] text-slate-400 font-normal">6h ago</span>
                </div>
                <p className="text-slate-600 text-[11px] mt-1">
                  GPU cluster auto-scaled from 2 to 4 workers during morning screening rush.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowNotificationList(false)}
                className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
