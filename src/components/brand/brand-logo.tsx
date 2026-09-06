import { isTrajectasLogoUrl, isTrajectasName } from '@/lib/brand/identity'
import { TrajectasLogo, type TrajectasLogoVariant } from './trajectas-logo'

/** Shared fallback for configurable brand slots. Uploaded partner/client logos stay intact. */
export function BrandLogo({
  name, logoUrl, height = 28, light = false, runner = false, variant = 'horizontal',
}: {
  name?: string | null
  logoUrl?: string | null
  height?: number
  light?: boolean
  runner?: boolean
  variant?: TrajectasLogoVariant
}) {
  if (logoUrl && !isTrajectasLogoUrl(logoUrl)) {
    // eslint-disable-next-line @next/next/no-img-element -- runtime tenant branding may use any approved uploaded URL
    return <img src={logoUrl} alt={name ?? 'Logo'} height={height} style={{ height, width: 'auto', maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
  }
  if (isTrajectasName(name) || isTrajectasLogoUrl(logoUrl)) {
    return <TrajectasLogo variant={variant} height={height} light={light} runner={runner} />
  }
  return <span className="text-sm font-semibold" style={{ color: runner ? 'var(--runner-text)' : light ? '#ffffff' : 'inherit' }}>{name}</span>
}

/** Render the platform attribution as a signature, while preserving custom footer copy. */
export function BrandFooter({ text, runner = false, light = false }: { text?: string | null; runner?: boolean; light?: boolean }) {
  if (text == null || text === '') return null
  const platformAttribution = /^(powered by\s+)?trajectas\.?$/i.exec(text.trim())
  if (!platformAttribution) return <>{text}</>
  return <span className="inline-flex items-center gap-1.5 align-middle normal-case tracking-normal">
    {platformAttribution[1] && <span>Powered by</span>}
    <TrajectasLogo variant="wordmark" height={16} runner={runner} light={light} />
  </span>
}
