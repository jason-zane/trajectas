'use client'
import type { PresentationMode } from '@/lib/reports/presentation'
import { FeaturedMode } from './featured-mode'
import { OpenMode } from './open-mode'
import { CardedMode } from './carded-mode'
import { SplitMode } from './split-mode'
import { InsetMode } from './inset-mode'

interface ModeWrapperProps {
  mode: PresentationMode
  columns?: 1 | 2 | 3
  insetAccent?: string
  children: React.ReactNode
  splitLeft?: React.ReactNode
  splitRight?: React.ReactNode
  className?: string
}

export function ModeWrapper({ mode, columns, insetAccent, children, splitLeft, splitRight, className }: ModeWrapperProps) {
  switch (mode) {
    case 'featured':
      return <FeaturedMode className={className}>{children}</FeaturedMode>
    case 'open':
      return <OpenMode className={className}>{children}</OpenMode>
    case 'carded':
      return <CardedMode columns={columns} className={className}>{children}</CardedMode>
    case 'split':
      return <SplitMode left={splitLeft ?? children} right={splitRight ?? null} className={className} />
    case 'inset':
      return <InsetMode accentColor={insetAccent} className={className}>{children}</InsetMode>
    default:
      return <OpenMode className={className}>{children}</OpenMode>
  }
}
