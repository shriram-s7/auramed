import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarClock,
  Eye,
  MoreVertical,
  Pencil,
  Plus,
  SlidersHorizontal,
  Upload,
  UserX,
  Users,
} from 'lucide-react'
import DoctorLayout from '../../components/doctor/DoctorLayout'
import StatCard from '../../components/doctor/StatCard'
import InitialsAvatar from '../../components/common/InitialsAvatar'
import RiskBadge from '../../components/common/RiskBadge'
import ModulePill from '../../components/common/ModulePill'
import Skeleton from '../../components/common/Skeleton'
import Toast from '../../components/common/Toast'
import { deletePatient, fetchPatientStats, fetchPatients, updatePatientStatus } from '../../services/patientService'

const PAGE_SIZE = 10

const STATUS_STYLES = {
  active: 'bg-success/10 text-success',
  inactive: 'bg-border text-primary/50',
}

function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function DoctorPatients() {
  const navigate = useNavigate()

  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [module, setModule] = useState('all')
  const [riskLevel, setRiskLevel] = useState('all')
  const [status, setStatus] = useState('active')
  const [sort, setSort] = useState('last_scan_newest')
  const [page, setPage] = useState(1)

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [listLoading, setListLoading] = useState(true)

  const [selected, setSelected] = useState(() => new Set())
  const [openMenuId, setOpenMenuId] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    fetchPatientStats()
      .then((res) => setStats(res.data))
      .finally(() => setStatsLoading(false))
  }, [])

  const loadList = useCallback(async () => {
    setListLoading(true)
    try {
      const res = await fetchPatients({
        search: debouncedSearch || undefined,
        module,
        risk_level: riskLevel,
        status,
        sort,
        page,
        page_size: PAGE_SIZE,
      })
      setItems(res.data.items)
      setTotal(res.data.total)
    } finally {
      setListLoading(false)
    }
  }, [debouncedSearch, module, riskLevel, status, sort, page])

  useEffect(() => {
    loadList()
  }, [loadList])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, module, riskLevel, status, sort])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  function toggleSelectAll() {
    if (selected.size === items.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(items.map((i) => i.id)))
    }
  }

  function toggleSelectOne(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleMarkInactive(patient) {
    setOpenMenuId(null)
    await updatePatientStatus(patient.id, patient.status === 'active' ? 'inactive' : 'active')
    setToast(patient.status === 'active' ? 'Patient marked inactive' : 'Patient marked active')
    loadList()
  }

  async function handleDelete(patient) {
    setOpenMenuId(null)
    if (!window.confirm(`Delete ${patient.full_name}? This cannot be undone.`)) return
    try {
      await deletePatient(patient.id)
      setToast('Patient deleted')
      loadList()
    } catch (err) {
      setToast(err.response?.data?.detail || 'Could not delete this patient')
    }
  }

  const statCards = useMemo(() => {
    if (!stats) return null
    return [
      {
        icon: Users,
        label: 'Total Patients',
        value: stats.total_patients.value,
        changePct: stats.total_patients.change_pct,
      },
      {
        icon: SlidersHorizontal,
        label: 'Total Scans',
        value: stats.total_scans.value,
        changePct: stats.total_scans.change_pct,
      },
      {
        icon: AlertTriangle,
        label: 'High Risk Cases',
        value: stats.high_risk.value,
        highlight: stats.high_risk.value > 0,
        subtext: `${stats.high_risk.pct_of_total}% of total`,
      },
      {
        icon: CalendarClock,
        label: 'Follow-ups Due (7 days)',
        value: stats.followups_due.value,
        highlight: stats.followups_due.value > 0,
      },
    ]
  }, [stats])

  return (
    <DoctorLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Patients</h1>
          <p className="text-sm text-primary/50">
            Manage your patients, view their scan history, and take action.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setToast('Bulk import is coming soon.')}
            className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-primary/60 hover:border-accent hover:text-accent"
          >
            <Upload size={16} /> Import Patients
          </button>
          <button
            type="button"
            onClick={() => navigate('/doctor/patients/new')}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <Plus size={16} /> New Patient
          </button>
        </div>
      </div>

      {statsLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((c) => (
            <StatCard key={c.label} {...c} />
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, ID, phone or email"
          className="min-w-[220px] flex-1 rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
        />
        <select
          value={module}
          onChange={(e) => setModule(e.target.value)}
          className="rounded-md border border-border px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="all">All Modules</option>
          <option value="breast">Breast Cancer</option>
          <option value="cervical">Cervical Cancer</option>
          <option value="pcos">PCOS</option>
        </select>
        <select
          value={riskLevel}
          onChange={(e) => setRiskLevel(e.target.value)}
          className="rounded-md border border-border px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="all">All Risk Levels</option>
          <option value="high">High</option>
          <option value="moderate">Moderate</option>
          <option value="low">Low</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-border px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-md border border-border px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="last_scan_newest">Last Scan Newest</option>
          <option value="last_scan_oldest">Last Scan Oldest</option>
          <option value="name_asc">Name A-Z</option>
          <option value="risk_level">Risk Level</option>
        </select>
        <button
          type="button"
          onClick={() => setToast('More filters are coming soon.')}
          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-primary/60 hover:border-accent hover:text-accent"
        >
          <SlidersHorizontal size={14} /> More Filters
        </button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface">
        {listLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-background text-primary/30">
              <Users size={28} />
            </div>
            <p className="mt-4 text-sm font-semibold text-primary">No patients found</p>
            <p className="mt-1 text-xs text-primary/50">
              Try adjusting your filters, or register a new patient.
            </p>
            <button
              type="button"
              onClick={() => navigate('/doctor/patients/new')}
              className="mt-4 flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
            >
              <Plus size={16} /> New Patient
            </button>
          </div>
        ) : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-primary/40">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selected.size === items.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Patient</th>
                <th className="px-4 py-3 font-medium">Patient ID</th>
                <th className="px-4 py-3 font-medium">Age/Gender</th>
                <th className="px-4 py-3 font-medium">Modules</th>
                <th className="px-4 py-3 font-medium">Last Scan</th>
                <th className="px-4 py-3 font-medium">Risk</th>
                <th className="px-4 py-3 font-medium">Next Follow-up</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-background/60">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelectOne(p.id)}
                      className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/doctor/patients/${p.id}`)}
                      className="flex items-center gap-2 text-left"
                    >
                      <InitialsAvatar name={p.full_name} size={28} />
                      <span className="font-medium text-primary hover:text-accent">{p.full_name}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-primary/60">{p.patient_code}</td>
                  <td className="px-4 py-3 text-primary/60">
                    {p.age ?? '—'}
                    {p.gender ? ` / ${p.gender}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.modules.length === 0 ? (
                        <span className="text-xs text-primary/30">—</span>
                      ) : (
                        p.modules.map((m) => <ModulePill key={m} module={m} />)
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-primary/60">{p.last_scan_date || '—'}</td>
                  <td className="px-4 py-3">
                    <RiskBadge level={p.risk_level} />
                  </td>
                  <td className="px-4 py-3 text-primary/60">{p.next_followup_date || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[p.status]}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => navigate(`/doctor/patients/${p.id}`)}
                        className="rounded-md p-1.5 text-primary/50 hover:bg-background hover:text-accent"
                        aria-label="View patient"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/doctor/patients/${p.id}`)}
                        className="rounded-md p-1.5 text-primary/50 hover:bg-background hover:text-accent"
                        aria-label="Edit patient"
                      >
                        <Pencil size={16} />
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
                          className="rounded-md p-1.5 text-primary/50 hover:bg-background hover:text-accent"
                          aria-label="More actions"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {openMenuId === p.id && (
                          <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-border bg-surface py-1 shadow-lg">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null)
                                navigate(`/doctor/scan/${p.modules[0] || 'breast'}`)
                              }}
                              className="block w-full px-3 py-2 text-left text-sm text-primary hover:bg-background"
                            >
                              New Scan
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null)
                                navigate('/doctor/appointments')
                              }}
                              className="block w-full px-3 py-2 text-left text-sm text-primary hover:bg-background"
                            >
                              Schedule Follow-up
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null)
                                navigate('/doctor/reports')
                              }}
                              className="block w-full px-3 py-2 text-left text-sm text-primary hover:bg-background"
                            >
                              Generate Report
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMarkInactive(p)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary hover:bg-background"
                            >
                              <UserX size={14} />
                              {p.status === 'active' ? 'Mark Inactive' : 'Mark Active'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(p)}
                              className="block w-full px-3 py-2 text-left text-sm text-danger hover:bg-danger/10"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-primary/50">
            Showing {rangeStart} to {rangeEnd} of {total} patients
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-primary disabled:opacity-40"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={`h-8 w-8 rounded-md text-xs font-medium ${
                  n === page ? 'bg-primary text-white' : 'border border-border text-primary hover:border-accent'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-primary disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
    </DoctorLayout>
  )
}

export default DoctorPatients
