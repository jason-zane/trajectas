'use client'
import { cn } from '@/lib/utils'

interface SplitModeProps {
  left: React.ReactNode
  right: React.ReactNode
  className?: string
}

export function SplitMode({ left, right, className }: SplitModeProps) {
  return (
    <div data-mode="split" className={cn('px-10 py-9 grid grid-cols-2 gap-10 items-center', className)}>
      <div>{left}</div>
      <div>{right}</div>
    </div>
  )
}
