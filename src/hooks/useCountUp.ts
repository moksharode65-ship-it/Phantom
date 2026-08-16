import { useEffect, useRef, useState } from 'react'
import { easeOutCubic } from '@/lib/utils'

interface UseCountUpOptions {
  duration?: number
  delay?: number
  easing?: (t: number) => number
  onComplete?: () => void
}

export function useCountUp(
  end: number,
  { duration = 2200, delay = 0, easing = easeOutCubic, onComplete }: UseCountUpOptions = {}
) {
  const [count, setCount] = useState(0)
  const frameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    let started = false

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp
      const elapsed = timestamp - startTimeRef.current

      if (elapsed < delay) {
        frameRef.current = window.requestAnimationFrame(animate)
        return
      }

      if (!started) {
        started = true
        startTimeRef.current = timestamp
      }

      const progress = Math.min((elapsed - delay) / duration, 1)
      const eased = easing(progress)
      const current = Math.round(eased * end)

      setCount(current)

      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(animate)
      } else {
        setCount(end)
        onComplete?.()
      }
    }

    frameRef.current = window.requestAnimationFrame(animate)
    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
    }
  }, [end, duration, delay, easing, onComplete])

  return count
}