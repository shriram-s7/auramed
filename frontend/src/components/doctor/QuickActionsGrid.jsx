import { Calendar, FileText, ScanLine, UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function QuickActionsGrid({ onAnalyzeScan }) {
  const navigate = useNavigate()

  const actions = [
    { label: 'Register New Patient', icon: UserPlus, onClick: () => navigate('/doctor/patients/new') },
    { label: 'Analyze New Scan', icon: ScanLine, onClick: onAnalyzeScan },
    { label: 'View Appointments', icon: Calendar, onClick: () => navigate('/doctor/appointments') },
    { label: 'Generate Report', icon: FileText, onClick: () => navigate('/doctor/reports') },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-4 text-center hover:border-accent hover:bg-accent/5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Icon size={18} />
            </div>
            <span className="text-xs font-semibold text-primary">{action.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default QuickActionsGrid
