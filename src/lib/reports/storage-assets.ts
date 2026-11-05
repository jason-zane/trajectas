import type { ResolvedBlockData } from './types'

// Historical origin embedded in delivered report snapshots. Only public
// branding images move to the active project; stored snapshot data stays intact.
const LEGACY_STORAGE_ORIGIN = 'https://rwpfwfcaxoevnvtkdmkx.supabase.co'
const PUBLIC_BRAND_PATHS = [
  '/storage/v1/object/public/brand-assets/',
  '/storage/v1/render/image/public/brand-assets/',
]
const LOGO_FIELDS = new Set(['primaryLogoUrl', 'secondaryLogoUrl'])

/** Resolve historical branding addresses for display without changing snapshots. */
export function resolveReportStorageAssets(
  blocks: ResolvedBlockData[],
  activeProjectUrl: string | undefined,
): ResolvedBlockData[] {
  if (!activeProjectUrl) return blocks

  let target: URL
  try {
    target = new URL(activeProjectUrl)
  } catch {
    return blocks
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
  if (
    (target.protocol !== 'https:' && !(local && target.protocol === 'http:')) ||
    target.username || target.password || target.search || target.hash ||
    target.pathname !== '/' || target.origin === LEGACY_STORAGE_ORIGIN
  ) return blocks

  function resolveLogo(value: string): string {
    try {
      const url = new URL(value)
      if (
        url.origin !== LEGACY_STORAGE_ORIGIN || url.username || url.password ||
        !PUBLIC_BRAND_PATHS.some((prefix) => url.pathname.startsWith(prefix) && url.pathname.length > prefix.length)
      ) return value
      return `${target.origin}${url.pathname}${url.search}${url.hash}`
    } catch {
      return value
    }
  }

  function visit(value: unknown, field?: string): unknown {
    if (typeof value === 'string' && field && LOGO_FIELDS.has(field)) return resolveLogo(value)
    if (Array.isArray(value)) {
      const resolved = value.map((child) => visit(child))
      return resolved.some((child, i) => child !== value[i]) ? resolved : value
    }
    if (value && typeof value === 'object') {
      const entries = Object.entries(value)
      const resolved = entries.map(([key, child]) => [key, visit(child, key)] as const)
      return resolved.some(([, child], i) => child !== entries[i][1])
        ? Object.fromEntries(resolved)
        : value
    }
    return value
  }

  return visit(blocks) as ResolvedBlockData[]
}
