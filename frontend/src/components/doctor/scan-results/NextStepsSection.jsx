import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertOctagon,
  ArrowRight,
  Calendar,
  Clock,
  FileText,
  Flame,
  Stethoscope,
  UserPlus,
} from 'lucide-react'
import ScheduleFollowupModal from './ScheduleFollowupModal'

function NextStepsSection({ result, onToggleUrgent, sectionRef }) {
  const navigate = useNavigate()
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [togglingUrgent, setTogglingUrgent] = useState(false)

  const module = result?.module || 'breast'
  const scanId = result?.scan_id
  const patient = result?.patient
  const interval = result?.follow_up_interval || 'within 1 month'
  const isUrgent = Boolean(result?.is_urgent)

  const handleGenerateReport = () => {
    navigate(`/doctor/scan/${module}/report/${scanId}`)
  }

  const handleReferSpecialist = () => {
    navigate(`/doctor/referrals?patientId=${patient?.id}&scanId=${scanId}`)
  }

  const handleToggleUrgentClick = async () => {
    if (!onToggleUrgent || togglingUrgent) return
    setTogglingUrgent(true)
    try {
      await onToggleUrgent()
    } finally {
      setTogglingUrgent(false)
    }
  }

  return (
    <div ref={sectionRef} className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
          6
        </span>
        <h2 className="text-sm font-bold text-primary">Next Steps & Clinical Actions</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Generate Report */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4 shadow-sm transition hover:border-accent/40 hover:shadow-md">
          <div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-accent">
              <FileText size={18} />
            </div>
            <h3 className="mt-3 text-sm font-bold text-primary">Generate Report</h3>
            <p className="mt-1 text-xs leading-relaxed text-primary/60">
              Create and review clinical report
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerateReport}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-white transition hover:bg-primary/90"
          >
            Open Report Builder <ArrowRight size={13} />
          </button>
        </div>

        {/* Card 2: Schedule Follow-up */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4 shadow-sm transition hover:border-accent/40 hover:shadow-md">
          <div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Calendar size={18} />
            </div>
            <h3 className="mt-3 text-sm font-bold text-primary">Schedule Follow-up</h3>
            <div className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-primary/80">
              <Clock size={12} className="text-accent" />
              <span>Interval: <strong className="text-accent capitalize">{interval}</strong></span>
            </div>
            <p className="mt-1 text-[11px] text-primary/50">
              AI recommended cadence based on risk stratification.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setScheduleModalOpen(true)}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2 text-xs font-semibold text-primary transition hover:bg-slate-100 hover:text-accent"
          >
            Quick Schedule <Calendar size={13} />
          </button>
        </div>

        {/* Card 3: Refer to Specialist */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4 shadow-sm transition hover:border-accent/40 hover:shadow-md">
          <div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <Stethoscope size={18} />
            </div>
            <h3 className="mt-3 text-sm font-bold text-primary">Refer to Specialist</h3>
            <p className="mt-1 text-xs leading-relaxed text-primary/60">
              Send to surgical oncologist / radiologist
            </p>
          </div>
          <button
            type="button"
            onClick={handleReferSpecialist}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2 text-xs font-semibold text-primary transition hover:bg-slate-100 hover:text-purple-600"
          >
            Initiate Referral <UserPlus size={13} />
          </button>
        </div>

        {/* Card 4: Flag as Urgent (red card) */}
        <div
          className={`flex flex-col justify-between rounded-xl border p-4 shadow-sm transition ${
            isUrgent
              ? 'border-danger bg-danger/5 shadow-danger/10'
              : 'border-rose-200 bg-rose-50/30 hover:border-danger/60'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  isUrgent ? 'bg-danger text-white' : 'bg-danger/10 text-danger'
                }`}
              >
                <AlertOctagon size={18} />
              </div>
              {isUrgent && (
                <span className="rounded-full bg-danger px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                  URGENT ACTIVE
                </span>
              )}
            </div>
            <h3 className="mt-3 text-sm font-bold text-danger">Flag as Urgent</h3>
            <p className="mt-1 text-xs leading-relaxed text-primary/70">
              Mark for immediate attention
            </p>
          </div>
          <button
            type="button"
            disabled={togglingUrgent}
            onClick={handleToggleUrgentClick}
            className={`mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition shadow-sm ${
              isUrgent
                ? 'bg-slate-800 text-white hover:bg-slate-900'
                : 'bg-danger text-white hover:bg-danger/90'
            }`}
          >
            <Flame size={13} />
            {togglingUrgent
              ? 'Updating...'
              : isUrgent
              ? 'Remove Urgent Flag'
              : 'Mark as Urgent'}
          </button>
        </div>
      </div>

      {scheduleModalOpen && (
        <ScheduleFollowupModal
          scanId={scanId}
          interval={interval}
          patientName={patient?.full_name}
          onClose={() => setScheduleModalOpen(false)}
        />
      )}
    </div>
  )
}

export default NextStepsSection
