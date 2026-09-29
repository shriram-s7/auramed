import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronRight,
  MoreVertical,
  Pencil,
  UserX,
} from 'lucide-react'
import DoctorLayout from '../../components/doctor/DoctorLayout'
import InitialsAvatar from '../../components/common/InitialsAvatar'
import Skeleton from '../../components/common/Skeleton'
import Toast from '../../components/common/Toast'
import ScanModulePickerModal from '../../components/doctor/ScanModulePickerModal'
import ModuleStatusCard from '../../components/doctor/patient/ModuleStatusCard'
import PatientTimeline from '../../components/doctor/patient/PatientTimeline'
import RecentScansGrid from '../../components/doctor/patient/RecentScansGrid'
import RiskTrendChart from '../../components/doctor/patient/RiskTrendChart'
import PatientInfoPanel from '../../components/doctor/patient/PatientInfoPanel'
import ClinicalSummaryPanel from '../../components/doctor/patient/ClinicalSummaryPanel'
import ScanHistoryTable from '../../components/doctor/patient/ScanHistoryTable'
import ReportsList from '../../components/doctor/patient/ReportsList'
import AppointmentsList from '../../components/doctor/patient/AppointmentsList'
import FollowUpPlanList from '../../components/doctor/patient/FollowUpPlanList'
import NotesPanel from '../../components/doctor/patient/NotesPanel'
import ReferralsList from '../../components/doctor/patient/ReferralsList'
import QuickActionBar from '../../components/doctor/patient/QuickActionBar'
import EditPatientModal from '../../components/doctor/patient/EditPatientModal'
import {
  addPatientNote,
  fetchPatientDetail,
  toggleUrgentFlag,
  updateOverallNotes,
  updatePatient,
} from '../../services/patientDetailService'
import { deletePatient, updatePatientStatus } from '../../services/patientService'

const TABS = [
  'Overview',
  'Scan History',
  'Clinical History',
  'Reports',
  'Appointments',
  'Follow-up Plan',
  'Notes',
  'Referrals',
]

function PatientDetail() {
  const params = useParams()
  const patientId = params.patientId || params.id
  const navigate = useNavigate()

  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Overview')
  const [toast, setToast] = useState(null)
  const [scanPickerOpen, setScanPickerOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notesEditing, setNotesEditing] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')

  const load = useCallback(async () => {
    const res = await fetchPatientDetail(patientId)

    setDetail(res.data)
    setNotesDraft(res.data.patient.overall_notes || '')
  }, [patientId])

  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load])

  async function handleSavePatient(payload) {
    await updatePatient(patientId, payload)
    await load()
    setToast('Patient details updated.')
  }

  async function handleSaveOverallNotes() {
    await updateOverallNotes(patientId, notesDraft)
    await load()
    setNotesEditing(false)
    setToast('Notes updated.')
  }

  async function handleAddNote(text) {
    await addPatientNote(patientId, text)
    await load()
    setToast('Note added.')
  }

  async function handleToggleUrgent() {
    await toggleUrgentFlag(patientId)
    await load()
    setToast(detail.patient.is_urgent ? 'Urgent flag removed.' : 'Patient flagged as urgent.')
  }

  async function handleMarkInactive() {
    setMenuOpen(false)
    await updatePatientStatus(patientId, detail.patient.status === 'active' ? 'inactive' : 'active')
    await load()
    setToast('Status updated.')
  }

  async function handleDelete() {
    setMenuOpen(false)
    if (!window.confirm(`Delete ${detail.patient.full_name}? This cannot be undone.`)) return
    try {
      await deletePatient(patientId)
      navigate('/doctor/patients')
    } catch (err) {
      setToast(err.response?.data?.detail || 'Could not delete this patient.')
    }
  }

  function openLatestScan(moduleStatus) {
    if (moduleStatus.last_scan_id) {
      navigate(`/doctor/scan/${moduleStatus.module}/results/${moduleStatus.last_scan_id}`)
    }
  }

  function startScreening(module) {
    navigate(`/doctor/scan/${module}?patientId=${patientId}`)
  }

  if (loading || !detail) {
    return (
      <DoctorLayout>
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40" />
          <Skeleton className="h-96" />
        </div>
      </DoctorLayout>
    )
  }

  const { patient, quick_info: quickInfo, modules, timeline, recent_scans: recentScans, risk_trend: riskTrend } = detail

  return (
    <DoctorLayout>
      <div className="p-4 sm:p-6 lg:p-8 pb-28 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-1 text-xs text-primary/50">
          <button type="button" onClick={() => navigate('/doctor/patients')} className="hover:text-accent">
            Patients
          </button>
          <ChevronRight size={12} />
          <span className="text-primary">{patient.full_name}</span>
        </div>

        <div className="mt-3 flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold text-primary">{patient.full_name}</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditModalOpen(true)}
              className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-primary hover:border-accent hover:text-accent"
            >
              <Pencil size={14} /> Edit Patient Details
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded-md border border-border bg-surface p-2 text-primary/60 hover:border-accent hover:text-accent"
                aria-label="More actions"
              >
                <MoreVertical size={16} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-border bg-surface py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={handleMarkInactive}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary hover:bg-background"
                  >
                    <UserX size={14} />
                    {patient.status === 'active' ? 'Mark Inactive' : 'Mark Active'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="block w-full px-3 py-2 text-left text-sm text-danger hover:bg-danger/10"
                  >
                    Delete Patient
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <InitialsAvatar name={patient.full_name} size={64} />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-primary">{patient.full_name}</p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                      patient.status === 'active' ? 'bg-success/10 text-success' : 'bg-border text-primary/50'
                    }`}
                  >
                    {patient.status}
                  </span>
                  {patient.is_urgent && (
                    <span className="rounded-full bg-danger px-2.5 py-0.5 text-xs font-semibold text-white">
                      Urgent
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-primary/60">
                  {patient.patient_code} · {patient.age ?? '—'} yrs · {patient.gender || '—'}
                </p>
                <p className="text-sm text-primary/60">
                  {patient.phone || '—'} · {patient.email || '—'}
                </p>
                <p className="text-sm text-primary/60">{patient.address || 'No address on file'}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <InfoPill label="Blood Group" value={quickInfo.blood_group} />
              <InfoPill label="Known Allergies" value={quickInfo.allergies_summary} />
              <InfoPill label="Relevant History" value={quickInfo.relevant_history_summary} />
              <InfoPill label="Last Visit" value={quickInfo.last_visit_date} />
              <InfoPill
                label="Next Follow-up"
                value={quickInfo.next_followup_date}
                highlight={quickInfo.next_followup_overdue || quickInfo.next_followup_soon}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-1 overflow-x-auto border-b border-border">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${
                tab === t ? 'border-accent text-accent' : 'border-transparent text-primary/50 hover:text-primary'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === 'Overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {modules.map((m) => (
                  <ModuleStatusCard
                    key={m.module}
                    moduleStatus={m}
                    onOpenScan={openLatestScan}
                    onStartScreening={startScreening}
                  />
                ))}
              </div>

              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-primary">Overall Notes</p>
                  {!notesEditing ? (
                    <button
                      type="button"
                      onClick={() => setNotesEditing(true)}
                      className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                    >
                      <Pencil size={12} /> Edit
                    </button>
                  ) : null}
                </div>
                {!notesEditing ? (
                  <p className="mt-2 text-sm text-primary/70">
                    {patient.overall_notes || 'No general notes recorded for this patient yet.'}
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNotesEditing(false)
                          setNotesDraft(patient.overall_notes || '')
                        }}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-primary"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveOverallNotes}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <PatientTimeline
                  events={timeline}
                  limit={8}
                  onViewAll={() => setTab('Scan History')}
                />
                <div className="space-y-6 lg:col-span-2">
                  <RecentScansGrid
                    scans={recentScans}
                    onSelect={(s) => navigate(`/doctor/scan/${s.module}/results/${s.scan_id}`)}
                    onViewAll={() => setTab('Scan History')}
                  />
                  <RiskTrendChart riskTrend={riskTrend} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <PatientInfoPanel patient={patient} onSave={handleSavePatient} />
                <ClinicalSummaryPanel patient={patient} onSave={handleSavePatient} />
              </div>
            </div>
          )}

          {tab === 'Scan History' && <ScanHistoryTable scans={detail.scans} />}

          {tab === 'Clinical History' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <PatientInfoPanel patient={patient} onSave={handleSavePatient} />
              <ClinicalSummaryPanel patient={patient} onSave={handleSavePatient} />
            </div>
          )}

          {tab === 'Reports' && (
            <ReportsList
              reports={detail.reports}
              onView={(r) => {
                const rId = r?.id || r?.report_id
                if (rId && rId !== 'undefined') {
                  navigate(`/doctor/reports/${rId}`)
                } else {
                  console.error('Report ID is undefined, cannot navigate')
                }
              }}
            />
          )}

          {tab === 'Appointments' && (
            <AppointmentsList
              appointments={detail.appointments}
              onScheduleNew={() => navigate('/doctor/appointments')}
            />
          )}

          {tab === 'Follow-up Plan' && <FollowUpPlanList plan={detail.follow_up_plan} />}

          {tab === 'Notes' && <NotesPanel notes={detail.notes} onAddNote={handleAddNote} />}

          {tab === 'Referrals' && <ReferralsList referrals={detail.referrals} />}
        </div>
      </div>

      <QuickActionBar
        isUrgent={patient.is_urgent}
        onNewScan={() => setScanPickerOpen(true)}
        onScheduleFollowup={() => navigate('/doctor/appointments')}
        onGenerateReport={() => navigate('/doctor/reports')}
        onAddNote={() => setTab('Notes')}
        onRefer={() => setTab('Referrals')}
        onToggleUrgent={handleToggleUrgent}
      />

      {scanPickerOpen && <ScanModulePickerModal onClose={() => setScanPickerOpen(false)} />}
      {editModalOpen && (
        <EditPatientModal
          patient={patient}
          onClose={() => setEditModalOpen(false)}
          onSave={handleSavePatient}
        />
      )}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </DoctorLayout>
  )
}

function InfoPill({ label, value, highlight }) {
  return (
    <div
      className={`min-w-[110px] rounded-lg border px-3 py-2 text-center ${
        highlight ? 'border-danger/40 bg-danger/5' : 'border-border bg-background'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase text-primary/40">{label}</p>
      <p className={`mt-0.5 text-xs font-semibold ${highlight ? 'text-danger' : 'text-primary'}`}>
        {value || '—'}
      </p>
    </div>
  )
}

export default PatientDetail
