'use client'
import { cn } from '@/lib/utils'
import { BlockHeaders } from './block-headers'

interface CardedModeProps {
  eyebrow?: string
  heading?: string
  blockDescription?: string
  children: React.ReactNode
  columns?: 1 | 2 | 3
  className?: string
}

export function CardedMode({ eyebrow, heading, blockDescription, children, columns = 1, className }: CardedModeProps) {
  const gridClass = columns === 3 ? 'grid-cols-3' : columns === 2 ? 'grid-cols-2' : 'grid-cols-1'

  return (
    <div data-mode="carded" className={cn('px-10 py-9', className)}>
      <BlockHeaders eyebrow={eyebrow} heading={heading} blockDescription={blockDescription} />
      <div className={cn('grid gap-4', gridClass)}>
        {children}
      </div>
    </div>
  )
}
