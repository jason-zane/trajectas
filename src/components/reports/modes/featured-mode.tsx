'use client'
import { cn } from '@/lib/utils'
import { BlockHeaders } from './block-headers'

interface FeaturedModeProps {
  eyebrow?: string
  heading?: string
  blockDescription?: string
  children: React.ReactNode
  className?: string
}

export function FeaturedMode({ eyebrow, heading, blockDescription, children, className }: FeaturedModeProps) {
  return (
    <div
      data-mode="featured"
      className={cn('px-10 py-6 print:pt-[15mm] print:pb-[2mm]', className)}
      style={{
        background: 'var(--report-featured-bg)',
        color: 'var(--report-featured-text)',
      }}
    >
      <BlockHeaders eyebrow={eyebrow} heading={heading} blockDescription={blockDescription} variant="featured" />
      {children}
    </div>
  )
}
