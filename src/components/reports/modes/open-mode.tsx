'use client'
import { cn } from '@/lib/utils'
import { BlockHeaders } from './block-headers'

interface OpenModeProps {
  eyebrow?: string
  heading?: string
  blockDescription?: string
  children: React.ReactNode
  className?: string
}

export function OpenMode({ eyebrow, heading, blockDescription, children, className }: OpenModeProps) {
  return (
    <div data-mode="open" className={cn('px-10 py-4 print:px-0 print:py-3', className)}>
      <BlockHeaders eyebrow={eyebrow} heading={heading} blockDescription={blockDescription} />
      {children}
    </div>
  )
}
