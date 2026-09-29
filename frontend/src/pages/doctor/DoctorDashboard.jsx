import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CalendarClock, RefreshCw, ScanLine, Users } from 'lucide-react'
import StatCard from '../../components/doctor/StatCard'
import ActivityChart from '../../components/doctor/ActivityChart'
import UrgentCasesTable from '../../components/doctor/UrgentCasesTable'
import FollowupsTable from '../../components/doctor/FollowupsTable'
import RecentScansTable from '../../components/doctor/RecentScansTable'
import QuickActionsGrid from '../../components/doctor/QuickActionsGrid'
import NotificationsPanel from '../../components/doctor/NotificationsPanel'
import ScanModulePickerModal from '../../components/doctor/ScanModulePickerModal'
import Skeleton from '../../components/common/Skeleton'
import { fetchCurrentUser } from '../../services/authService'
import { fetchDashboardSummary, fetchNotifications, fetchUrgentCases } from '../../services/dashboardService'

const URGENT_REFRESH_MS = 60 * 1000

function greetingForHour(hour) {
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

function DoctorDashboard() {
  const [doctor, setDoctor] = useState(null)
  const [summary, setSummary] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [now, setNow] = useState(new Date())
  const [search, setSearch] = useState('')
  const [scanPickerOpen, setScanPickerOpen] = useState(false)

  const urgentIntervalRef = useRef(null)

  const loadAll = useCallback(async () => {
    const [meRes, summaryRes, notifRes] = await Promise.all([
      fetchCurrentUser(),
      fetchDashboardSummary(),
      fetchNotifications(),
    ])
    setDoctor(meRes.data.profile)
    setSummary(summaryRes.data)
    setNotifications(notifRes.data)
  }, [])

  useEffect(() => {
    setLoading(true)
    loadAll().finally(() => setLoading(false))
  }, [loadAll])

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(tick)
  }, [])

  const refreshUrgent = useCallback(async () => {
    try {
      const res = await fetchUrgentCases()
      setSummary((prev) => (prev ? { ...prev, urgent_cases: res.data } : prev))
    } catch {
      // silent: background refresh, keep last known urgent cases
    }
  }, [])

  useEffect(() => {
    urgentIntervalRef.current = setInterval(refreshUrgent, URGENT_REFRESH_MS)
    return () => clearInterval(urgentIntervalRef.current)
  }, [refreshUrgent])

  async function handleManualRefresh() {
    setRefreshing(true)
    try {
      await loadAll()
    } finally {
      setRefreshing(false)
    }
  }

  const greeting = useMemo(() => greetingForHour(now.getHours()), [now])
  const dateTimeLabel = useMemo(
    () =>
      now.toLocaleString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [now],
  )

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-primary">
                {greeting}, Dr. {doctor?.full_name?.split(' ').slice(-1)[0] || ''}
              </h1>
              <p className="text-sm text-primary/50">{dateTimeLabel}</p>
            </div>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-primary hover:border-accent hover:text-accent disabled:opacity-60"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={Users}
                label="Total Patients"
                value={summary.stats.total_patients.value}
                changePct={summary.stats.total_patients.change_pct}
              />
              <StatCard
                icon={ScanLine}
                label="Scans Analyzed"
                value={summary.stats.scans_analyzed.value}
                changePct={summary.stats.scans_analyzed.change_pct}
              />
              <StatCard
                icon={CalendarClock}
                label="Upcoming Follow-ups"
                value={summary.stats.upcoming_followups.value}
                highlight={summary.stats.upcoming_followups.within_7_days > 0}
                subtext={
                  summary.stats.upcoming_followups.within_7_days > 0
                    ? `${summary.stats.upcoming_followups.within_7_days} within 7 days`
                    : null
                }
              />
              <StatCard
                icon={AlertTriangle}
                label="Critical Cases"
                value={summary.stats.critical_cases.value}
                highlight={summary.stats.critical_cases.value > 0}
              />
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <h2 className="mb-3 text-sm font-semibold text-primary">Urgent Cases</h2>
              {loading ? <Skeleton className="h-40" /> : <UrgentCasesTable cases={summary.urgent_cases} />}
            </div>
            <div>
              <h2 className="mb-3 text-sm font-semibold text-primary">Activity (Last 30 Days)</h2>
              {loading ? <Skeleton className="h-72" /> : <ActivityChart data={summary.activity} />}
            </div>
          </div>

          <div className="mt-6">
            <h2 className="mb-3 text-sm font-semibold text-primary">Upcoming Follow-ups</h2>
            {loading ? <Skeleton className="h-40" /> : <FollowupsTable followups={summary.upcoming_followups} />}
          </div>

          <div className="mt-6">
            <h2 className="mb-3 text-sm font-semibold text-primary">Recent Scans and Results</h2>
            {loading ? <Skeleton className="h-40" /> : <RecentScansTable scans={summary.recent_scans} />}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <h2 className="mb-3 text-sm font-semibold text-primary">Quick Actions</h2>
              <QuickActionsGrid onAnalyzeScan={() => setScanPickerOpen(true)} />
            </div>
            <div>
              <h2 className="mb-3 text-sm font-semibold text-primary">Notifications</h2>
              {loading ? <Skeleton className="h-40" /> : <NotificationsPanel notifications={notifications} />}
            </div>
          </div>
      {scanPickerOpen && <ScanModulePickerModal onClose={() => setScanPickerOpen(false)} />}
    </div>
  )
}

export default DoctorDashboard
