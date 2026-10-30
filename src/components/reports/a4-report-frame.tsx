'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** Screen-only viewport for a fixed A4 report. Print retains its native size. */
export function A4ReportFrame({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ scale: 1, height: 0 })
  useLayoutEffect(() => {
    const outer = viewport.current, inner = content.current
    if (!outer || !inner) return
    const measure = () => {
      const scale = Math.min(1, outer.clientWidth / 794)
      setSize({ scale, height: inner.scrollHeight * scale })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(outer); observer.observe(inner)
    measure()
    return () => observer.disconnect()
  }, [])
  return <div ref={viewport} className="mx-auto w-full max-w-[794px] overflow-hidden" style={{ height: size.height || undefined }} data-a4-preview>
    <style>{'@media print{[data-a4-preview]{height:auto!important;max-width:none!important;overflow:visible!important}[data-a4-preview]>div{transform:none!important}}'}</style>
    <div ref={content} style={{ width: 794, transform: `scale(${size.scale})`, transformOrigin: 'top left' }}>{children}</div>
  </div>
}
