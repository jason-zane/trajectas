'use client'
import { cn } from '@/lib/utils'
import { BlockHeaders } from './block-headers'

interface InsetModeProps {
  eyebrow?: string
  heading?: string
  blockDescription?: string
  children: React.ReactNode
  accentColor?: string
  className?: string
}

export function InsetMode({ eyebrow, heading, blockDescription, children, accentColor, className }: InsetModeProps) {
  return (
    <div data-mode="inset" className={cn('mx-10 my-4 print:mt-[15mm] print:mb-[2mm]', className)}>
      <div
        className="rounded-xl p-7"
        style={{
          background: 'var(--report-inset-bg)',
          borderLeft: `3px solid ${accentColor || 'var(--report-inset-border)'}`,
        }}
      >
        <BlockHeaders eyebrow={eyebrow} heading={heading} blockDescription={blockDescription} />
        {children}
      </div>
    </div>
  )
}
