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
    <div className="space-y-1.5 mb-6">
      {eyebrow && (
        <p
          className="text-[10px] uppercase tracking-[2px]"
          style={{ color: isFeatured ? 'var(--report-featured-accent)' : 'var(--report-cover-accent)' }}
        >
          {eyebrow}
        </p>
      )}
      {heading && (
        <h2
          className="text-xl font-semibold"
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
