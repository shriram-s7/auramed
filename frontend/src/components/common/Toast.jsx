import { useEffect } from 'react'
import { Info } from 'lucide-react'

function Toast({ message, onDismiss, duration = 2500 }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration)
    return () => clearTimeout(t)
  }, [onDismiss, duration])

  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-lg">
      <Info size={16} className="text-accent" />
      {message}
    </div>
  )
}

export default Toast
