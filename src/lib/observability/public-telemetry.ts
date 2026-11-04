/** Only static public pages are eligible for third-party telemetry. */
const PUBLIC_HOSTS = new Set(['trajectas.com', 'www.trajectas.com'])
const PUBLIC_PATHS = new Set([
  '/', '/classic', '/contact', '/how-it-works', '/for-teams',
  '/capability-model', '/capability-assessment', '/psychometric-assessment',
  '/performance-and-outcomes',
])

function publicUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && PUBLIC_HOSTS.has(url.hostname)
      && !url.username && !url.password && !url.port && PUBLIC_PATHS.has(url.pathname)
      ? url : null
  } catch { return null }
}

/**
 * An SDK can remain loaded after client navigation. Check each event, rather
 * than assuming that the layout where it was mounted is still public.
 */
export function filterPublicTelemetryEvent<T extends { type: string; url: string; route?: string }>(
  event: T,
  referrer = '',
): T | null {
  if (event.type !== 'pageview' && event.type !== 'vital') return null
  const url = publicUrl(event.url)
  if (!url) return null
  // The SDK also collects referrers outside this callback. Suppress the event
  // when an old document or external link could contribute a sensitive URL.
  if (referrer) {
    const previous = publicUrl(referrer)
    if (!previous || previous.search || previous.hash) return null
  }
  url.search = ''
  url.hash = ''
  return { ...event, url: url.toString(), ...('route' in event ? { route: url.pathname } : {}) }
}
