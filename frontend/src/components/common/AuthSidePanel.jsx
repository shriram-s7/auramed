import { CheckCircle2 } from 'lucide-react'

const GRADIENTS = {
  navy: 'from-primary via-[#0F2137] to-[#0A1628]',
  light: 'from-[#0F2137] via-primary to-[#123049]',
  serious: 'from-[#050B14] via-[#0A1628] to-[#050B14]',
}

function AbstractShapes() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-40"
      viewBox="0 0 400 800"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="340" cy="80" r="120" stroke="white" strokeOpacity="0.12" strokeWidth="1.5" />
      <circle cx="340" cy="80" r="80" stroke="white" strokeOpacity="0.12" strokeWidth="1.5" />
      <circle cx="40" cy="700" r="140" stroke="#0D9488" strokeOpacity="0.25" strokeWidth="1.5" />
      <path d="M0 620 Q 120 560 240 620 T 400 600" stroke="white" strokeOpacity="0.08" strokeWidth="1.5" />
      <path d="M0 660 Q 120 600 240 660 T 400 640" stroke="white" strokeOpacity="0.08" strokeWidth="1.5" />
      <line x1="20" y1="20" x2="380" y2="20" stroke="white" strokeOpacity="0.06" />
    </svg>
  )
}

function AuthSidePanel({ variant = 'navy', headline, bullets = [], quote, badge }) {
  return (
    <div
      className={`relative hidden w-1/2 overflow-hidden bg-gradient-to-br ${GRADIENTS[variant]} p-12 text-white lg:flex lg:flex-col lg:justify-between`}
    >
      <AbstractShapes />

      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 font-bold">A</div>
          <p className="text-sm font-bold">AuraMed</p>
        </div>
        {badge && (
          <p className="mt-8 inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
            {badge}
          </p>
        )}
        <h2 className="mt-6 max-w-sm text-3xl font-bold leading-tight">{headline}</h2>

        {bullets.length > 0 && (
          <ul className="mt-8 space-y-4">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-3 text-sm text-white/80">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-accent" />
                {bullet}
              </li>
            ))}
          </ul>
        )}
      </div>

      {quote && (
        <blockquote className="relative border-l-2 border-accent pl-4 text-sm italic text-white/60">
          {quote}
        </blockquote>
      )}
    </div>
  )
}

export default AuthSidePanel
