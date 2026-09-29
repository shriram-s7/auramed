import React from 'react'

// Pure SVG Icons for Cancer Modules (strictly no photos or stock images)
export function BreastRibbonIcon({ className = "w-5 h-5 text-pink-600" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C9 2 7 4 7 7c0 4 5 11 5 15 0-4 5-11 5-15 0-3-2-5-5-5z" />
      <circle cx="12" cy="7" r="2" />
    </svg>
  )
}

export function CervicalHealthIcon({ className = "w-5 h-5 text-purple-600" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21a6 6 0 0 0 6-6V8a6 6 0 0 0-12 0v7a6 6 0 0 0 6 6z" />
      <path d="M6 10h12" />
      <circle cx="12" cy="15" r="2" />
    </svg>
  )
}

export function PcosFollicleIcon({ className = "w-5 h-5 text-teal-600" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="2" />
      <circle cx="15" cy="11" r="1.5" />
      <circle cx="11" cy="15" r="2" />
    </svg>
  )
}

export function getModuleSvgIcon(module, className) {
  const m = (module || '').toLowerCase()
  if (m === 'breast') return <BreastRibbonIcon className={className || "w-5 h-5 text-pink-600"} />
  if (m === 'cervical') return <CervicalHealthIcon className={className || "w-5 h-5 text-purple-600"} />
  return <PcosFollicleIcon className={className || "w-5 h-5 text-teal-600"} />
}
