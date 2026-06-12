'use client'

interface BlockHeadersProps {
  eyebrow?: string
  heading?: string
  blockDescription?: string
  variant?: 'default' | 'featured'
}

export function BlockHeaders({
  eyebrow,
  heading,
  blockDescription,
  variant = 'default',
}: BlockHeadersProps) {
  if (!eyebrow && !heading && !blockDescription) return null
  const isFeatured = variant === 'featured'

  return (
    <div className="report-block-headers space-y-1.5 mb-6 print:mb-4">
      {eyebrow && (
        <p
          className="font-mono text-[10px] font-medium uppercase tracking-[0.22em]"
          style={{ color: 'var(--report-featured-accent)' }}
        >
          {eyebrow}
        </p>
      )}
      {heading && (
        <h2
          className="text-xl font-bold tracking-tight"
          style={{ color: isFeatured ? 'currentColor' : 'var(--report-heading-colour)' }}
        >
          {heading}
        </h2>
      )}
      {blockDescription && (
        <p
          className="text-sm"
          style={{ color: isFeatured ? 'rgba(255,255,255,0.7)' : 'var(--report-muted-colour)' }}
        >
          {blockDescription}
        </p>
      )}
    </div>
  )
}
