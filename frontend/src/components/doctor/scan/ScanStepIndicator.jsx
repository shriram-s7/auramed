import { Check } from 'lucide-react'

const STEPS = [
  { n: 1, title: 'Input Data', desc: 'Upload scan and enter clinical details' },
  { n: 2, title: 'AI Analysis', desc: 'Processing images and clinical data' },
  { n: 3, title: 'Results', desc: 'View detailed analysis and recommendations' },
]

function ScanStepIndicator({ currentStep }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, idx) => {
        const done = step.n < currentStep
        const active = step.n === currentStep
        return (
          <div key={step.n} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  done ? 'bg-accent text-white' : active ? 'bg-primary text-white' : 'bg-border text-primary/50'
                }`}
              >
                {done ? <Check size={14} /> : step.n}
              </span>
              <div className="hidden sm:block">
                <p className={`text-xs font-semibold ${active ? 'text-primary' : 'text-primary/40'}`}>{step.title}</p>
                <p className="text-[10px] text-primary/40">{step.desc}</p>
              </div>
            </div>
            {idx < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
          </div>
        )
      })}
    </div>
  )
}

export default ScanStepIndicator
