import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import InitialsAvatar from '../../common/InitialsAvatar'
import { fetchPatients } from '../../../services/patientService'

function PatientSelectorCard({ patient, onSelect }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (patient || !search.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    const t = setTimeout(() => {
      fetchPatients({ search, status: 'all', page: 1, page_size: 6 })
        .then((res) => setResults(res.data.items))
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [search, patient])

  if (patient) {
    return (
      <div className="rounded-xl border border-border bg-surface p-3">
        <div className="flex items-center gap-3">
          <InitialsAvatar name={patient.full_name} size={40} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-primary">{patient.full_name}</p>
              <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                Active
              </span>
            </div>
            <p className="text-xs text-primary/50">
              {patient.patient_code} · {patient.age ?? '—'} yrs · {patient.gender || '—'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/doctor/patients/${patient.id}`)}
          className="mt-2 text-xs font-medium text-accent hover:underline"
        >
          View Full Patient Profile
        </button>
      </div>
    )
  }

  return (
    <div className="w-72 rounded-xl border border-border bg-surface p-3">
      <p className="text-xs font-semibold text-primary">Select a patient to begin</p>
      <div className="relative mt-2">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-primary/40" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or patient ID"
          className="w-full rounded-md border border-border py-1.5 pl-8 pr-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>
      {searching && <p className="mt-2 text-xs text-primary/40">Searching…</p>}
      {results.length > 0 && (
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect(p)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-background"
              >
                <InitialsAvatar name={p.full_name} size={26} />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-primary">{p.full_name}</span>
                  <span className="block text-xs text-primary/40">{p.patient_code}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default PatientSelectorCard
