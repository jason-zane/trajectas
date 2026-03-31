'use client'
import { cn } from '@/lib/utils'

interface FeaturedModeProps {
  children: React.ReactNode
  className?: string
}

export function FeaturedMode({ children, className }: FeaturedModeProps) {
  return (
    <div
      data-mode="featured"
      className={cn('px-10 py-12', className)}
      style={{
        background: 'var(--report-featured-bg)',
        color: 'var(--report-featured-text)',
      }}
    >
      {children}
    </div>
  )
}
