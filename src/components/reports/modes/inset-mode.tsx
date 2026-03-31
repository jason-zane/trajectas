'use client'
import { cn } from '@/lib/utils'

interface InsetModeProps {
  children: React.ReactNode
  accentColor?: string
  className?: string
}

export function InsetMode({ children, accentColor, className }: InsetModeProps) {
  return (
    <div data-mode="inset" className={cn('mx-10 my-9', className)}>
      <div
        className="rounded-xl p-7"
        style={{
          background: 'var(--report-inset-bg)',
          borderLeft: `3px solid ${accentColor || 'var(--report-inset-border)'}`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
