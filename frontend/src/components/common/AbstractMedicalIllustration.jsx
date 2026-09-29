const TONES = {
  pink: ['#FBCFE8', '#EC4899', '#831843'],
  purple: ['#E9D5FF', '#9333EA', '#4C1D95'],
  teal: ['#99F6E4', '#0D9488', '#134E4A'],
  slate: ['#E2E8F0', '#64748B', '#1E293B'],
}

function AbstractMedicalIllustration({ tone = 'slate', pattern = 0, className = '' }) {
  const [light, mid, dark] = TONES[tone] || TONES.slate

  return (
    <svg
      viewBox="0 0 160 120"
      className={className}
      role="img"
      aria-label="Placeholder medical illustration"
    >
      <rect width="160" height="120" fill={light} opacity="0.5" />
      {pattern === 0 ? (
        <>
          <ellipse cx="80" cy="60" rx="42" ry="34" fill={light} stroke={mid} strokeWidth="2" />
          <circle cx="65" cy="52" r="8" fill={mid} opacity="0.7" />
          <circle cx="92" cy="66" r="5" fill={dark} opacity="0.6" />
          <circle cx="78" cy="75" r="4" fill={mid} opacity="0.5" />
          <path d="M40 60 Q80 30 120 60" stroke={dark} strokeWidth="1.5" fill="none" opacity="0.4" />
        </>
      ) : (
        <>
          <path
            d="M40 80 C40 40 70 30 80 30 C90 30 120 40 120 80 C120 100 100 100 80 90 C60 100 40 100 40 80Z"
            fill={light}
            stroke={mid}
            strokeWidth="2"
          />
          <circle cx="70" cy="60" r="6" fill={dark} opacity="0.6" />
          <circle cx="90" cy="70" r="4" fill={mid} opacity="0.7" />
          <circle cx="80" cy="50" r="3" fill={dark} opacity="0.5" />
          <circle cx="60" cy="75" r="3" fill={mid} opacity="0.5" />
        </>
      )}
    </svg>
  )
}

export default AbstractMedicalIllustration
