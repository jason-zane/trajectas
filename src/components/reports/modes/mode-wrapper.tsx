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
  eyebrow?: string
  heading?: string
  blockDescription?: string
  children: React.ReactNode
  splitLeft?: React.ReactNode
  splitRight?: React.ReactNode
  className?: string
}

export function ModeWrapper({
  mode,
  columns,
  insetAccent,
  eyebrow,
  heading,
  blockDescription,
  children,
  splitLeft,
  splitRight,
  className,
}: ModeWrapperProps) {
  const headerProps = { eyebrow, heading, blockDescription }

  switch (mode) {
    case 'featured':
      return <FeaturedMode {...headerProps} className={className}>{children}</FeaturedMode>
    case 'open':
      return <OpenMode {...headerProps} className={className}>{children}</OpenMode>
    case 'carded':
      return <CardedMode {...headerProps} columns={columns} className={className}>{children}</CardedMode>
    case 'split':
      return <SplitMode {...headerProps} left={splitLeft ?? children} right={splitRight ?? null} className={className} />
    case 'inset':
      return <InsetMode {...headerProps} accentColor={insetAccent} className={className}>{children}</InsetMode>
    default:
      return <OpenMode {...headerProps} className={className}>{children}</OpenMode>
  }
}
