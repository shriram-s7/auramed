import { Check, ChevronRight, Lock } from 'lucide-react'

function ReportStepper({ currentStep = 3, isSigned = false }) {
  const steps = [
    { id: 1, label: 'Input and Analysis' },
    { id: 2, label: 'Results Review' },
    { id: 3, label: 'Generate Report' },
    { id: 4, label: 'Share and Follow-up' },
  ]

  return (
    <div className="rounded-xl border border-border bg-surface px-6 py-3.5 shadow-sm">
      <div className="flex items-center justify-between overflow-x-auto">
        {steps.map((step, idx) => {
          const isCompleted = step.id < currentStep || (step.id === 3 && isSigned)
          const isCurrent = step.id === currentStep
          const isLocked = step.id === 4 && !isSigned && currentStep <= 3

          return (
            <div key={step.id} className="flex items-center gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                    isCurrent
                      ? 'bg-accent text-white ring-4 ring-accent/20'
                      : isCompleted
                      ? 'bg-emerald-500 text-white'
                      : isLocked
                      ? 'bg-slate-100 text-slate-400 border border-slate-200'
                      : 'bg-slate-100 text-primary/40'
                  }`}
                >
                  {isLocked ? (
                    <Lock size={12} className="text-slate-400" />
                  ) : isCompleted ? (
                    <Check size={14} />
                  ) : (
                    step.id
                  )}
                </span>
                <span
                  className={`text-xs whitespace-nowrap ${
                    isCurrent
                      ? 'font-extrabold text-primary'
                      : isCompleted
                      ? 'font-semibold text-primary/80'
                      : isLocked
                      ? 'text-slate-400 font-medium flex items-center gap-1'
                      : 'text-primary/40 font-medium'
                  }`}
                >
                  {step.label}
                  {isLocked && <span className="text-[10px] text-slate-400 font-normal">(Locked)</span>}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <ChevronRight size={14} className="mx-2 text-primary/20 flex-shrink-0" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ReportStepper

