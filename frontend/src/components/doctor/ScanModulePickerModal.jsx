import { Activity, Microscope, ScanLine, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const MODULES = [
  { key: 'breast', label: 'Breast Cancer', icon: ScanLine },
  { key: 'cervical', label: 'Cervical Cancer', icon: Microscope },
  { key: 'pcos', label: 'PCOS', icon: Activity },
]

function ScanModulePickerModal({ onClose }) {
  const navigate = useNavigate()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-primary">Select a screening module</h3>
          <button type="button" onClick={onClose} className="text-primary/40 hover:text-primary">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {MODULES.map((mod) => {
            const Icon = mod.icon
            return (
              <button
                key={mod.key}
                type="button"
                onClick={() => navigate(`/doctor/scan/${mod.key}`)}
                className="flex w-full items-center gap-3 rounded-md border border-border px-3 py-2.5 text-sm font-medium text-primary hover:border-accent hover:bg-accent/5"
              >
                <Icon size={18} className="text-accent" />
                {mod.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ScanModulePickerModal
