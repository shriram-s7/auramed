const PALETTE = [
  { bg: 'bg-teal-100', text: 'text-teal-700' },
  { bg: 'bg-pink-100', text: 'text-pink-700' },
  { bg: 'bg-purple-100', text: 'text-purple-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-sky-100', text: 'text-sky-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
]

function colorFor(name) {
  const sum = Array.from(name || '').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return PALETTE[sum % PALETTE.length]
}

function initialsOf(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] || ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

function InitialsAvatar({ name, size = 36 }) {
  const { bg, text } = colorFor(name || '')
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${bg} ${text}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </div>
  )
}

export default InitialsAvatar
