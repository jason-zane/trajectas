/** Company names in prose remain normally capitalised; only the logo is lowercase. */
export function isTrajectasName(name?: string | null): boolean {
  return !name || /^trajectas\.?$/i.test(name.trim())
}

/** Recognise our exported assets so old report snapshots get the current treatment. */
export function isTrajectasLogoUrl(src?: string | null): boolean {
  if (!src) return false
  let path = src
  if (!src.startsWith('/')) {
    try {
      const url = new URL(src)
      if (url.hostname !== 'trajectas.com' && !url.hostname.endsWith('.trajectas.com')) return false
      path = url.pathname
    } catch { return false }
  }
  return /^\/brand\/span-(lockup-(horizontal|stacked)|wordmark|mark)(-(light-gold|light|mono|sage|ink))?\.(svg|png)([?#].*)?$/.test(path)
    || /^\/reports\/5brains\/assets\/trajectas-lockup(-light)?\.svg([?#].*)?$/.test(path)
}

export const TRAJECTAS_EMAIL_LOGO = 'https://trajectas.com/brand/span-lockup-horizontal.png'
