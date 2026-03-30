"use client"

import { useEffect, useRef, useState } from "react"

interface AnimatedNumberProps {
  value: number
  duration?: number
  className?: string
}

export function AnimatedNumber({
  value,
  duration = 800,
  className,
}: AnimatedNumberProps) {
  const [displayed, setDisplayed] = useState(value)
  const rafRef = useRef<number>(0)
  const displayedRef = useRef(value)

  useEffect(() => {
    displayedRef.current = displayed
  }, [displayed])

  useEffect(() => {
    const startValue = displayedRef.current
    const start = performance.now()

    function animate(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const nextValue = Math.round(startValue + (value - startValue) * eased)
      setDisplayed(nextValue)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (startValue === value) return

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [duration, value])

  return <span className={className}>{displayed}</span>
}
