'use client'
import { cn } from '@/lib/utils'
import { BlockHeaders } from './block-headers'

interface SplitModeProps {
  eyebrow?: string
  heading?: string
  blockDescription?: string
  left: React.ReactNode
  right: React.ReactNode
  className?: string
}

export function SplitMode({ eyebrow, heading, blockDescription, left, right, className }: SplitModeProps) {
  return (
    <div data-mode="split" className={cn('px-10 py-9', className)}>
      <BlockHeaders eyebrow={eyebrow} heading={heading} blockDescription={blockDescription} />
      <div className="grid grid-cols-2 gap-10 items-center">
        <div>{left}</div>
        <div>{right}</div>
      </div>
    </div>
  )
}
