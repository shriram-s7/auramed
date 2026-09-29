import { useEffect, useRef, useState } from 'react'

export function useCountUp(target, { duration = 1600, decimals = 0 } = {}) {
  const [value, setValue] = useState(0)
  const frameRef = useRef()

  useEffect(() => {
    const start = performance.now()

    function tick(now) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(target * eased)
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration])

  return decimals > 0 ? Number(value.toFixed(decimals)) : Math.round(value)
}

export default useCountUp
