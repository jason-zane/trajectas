import { BlockList, isIP } from 'node:net'

const LOCAL_HOSTNAMES = new Set(['localhost', 'localhost.localdomain'])
const METADATA_HOSTNAMES = new Set(['metadata.google.internal'])
const GLOBAL_IPV6 = new BlockList()
GLOBAL_IPV6.addSubnet('2000::', 3, 'ipv6')
const SPECIAL_IPV6 = new BlockList()
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]] as const) {
  SPECIAL_IPV6.addSubnet(address, prefix, 'ipv6')
}

type WebhookUrlSafetyOptions = {
  allowLocalUrls?: boolean
}

function normalizeHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, '')
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    return normalized.slice(1, -1)
  }

  return normalized
}

function isLocalHostname(hostname: string) {
  return LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost')
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split('.').map((part) => Number.parseInt(part, 10))
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false
  }

  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a === 169 && b === 254 ||
    a === 172 && b >= 16 && b <= 31 ||
    a === 192 && b === 168 ||
    a === 100 && b >= 64 && b <= 127 ||
    a === 192 && (b === 0 && (parts[2] === 0 || parts[2] === 2) || b === 88 && parts[2] === 99) ||
    a === 198 && (b === 18 || b === 19 || b === 51 && parts[2] === 100) ||
    a === 203 && b === 0 && parts[2] === 113 ||
    a >= 224
  )
}

function isLoopbackIpv4(hostname: string) {
  return hostname.startsWith('127.')
}

function ipv4FromMappedIpv6(hostname: string) {
  if (!hostname.startsWith('::ffff:')) {
    return null
  }

  const segments = hostname.slice('::ffff:'.length).split(':')
  if (segments.length !== 2) {
    return null
  }

  const high = Number.parseInt(segments[0], 16)
  const low = Number.parseInt(segments[1], 16)
  if (
    Number.isNaN(high) ||
    Number.isNaN(low) ||
    high < 0 ||
    high > 0xffff ||
    low < 0 ||
    low > 0xffff
  ) {
    return null
  }

  return [
    (high >> 8) & 0xff,
    high & 0xff,
    (low >> 8) & 0xff,
    low & 0xff,
  ].join('.')
}

function isPrivateIpv6(hostname: string) {
  if (hostname === '::' || hostname === '::1') {
    return true
  }

  const mappedIpv4 = ipv4FromMappedIpv6(hostname)
  if (mappedIpv4) {
    return isPrivateIpv4(mappedIpv4)
  }

  // Only globally routed unicast, excluding documentation/transition ranges.
  return !GLOBAL_IPV6.check(hostname, 'ipv6') || SPECIAL_IPV6.check(hostname, 'ipv6')
}

function isLocalOrPrivateHost(hostname: string) {
  if (isLocalHostname(hostname) || METADATA_HOSTNAMES.has(hostname)) {
    return true
  }

  const ipVersion = isIP(hostname)
  if (ipVersion === 4) {
    return isPrivateIpv4(hostname)
  }
  if (ipVersion === 6) {
    return isPrivateIpv6(hostname)
  }

  return false
}

export function isLoopbackWebhookHost(value: string) {
  const hostname = normalizeHostname(value)
  if (isLocalHostname(hostname)) {
    return true
  }

  const ipVersion = isIP(hostname)
  if (ipVersion === 4) {
    return isLoopbackIpv4(hostname)
  }
  if (ipVersion === 6) {
    return hostname === '::1' || Boolean(ipv4FromMappedIpv6(hostname)?.startsWith('127.'))
  }

  return false
}

export function getWebhookUrlSafetyError(
  rawUrl: string,
  options: WebhookUrlSafetyOptions = {}
) {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return 'Webhook URL must be a valid URL.'
  }

  if (parsed.username || parsed.password) {
    return 'Webhook URL must not include embedded credentials.'
  }

  const hostname = normalizeHostname(parsed.hostname)
  const localAllowed = Boolean(options.allowLocalUrls) && isLoopbackWebhookHost(hostname)

  if (isLocalOrPrivateHost(hostname) && !localAllowed) {
    return 'Webhook URL must not target localhost, private network, or cloud metadata hosts.'
  }

  if (parsed.protocol === 'https:') {
    return null
  }

  if (parsed.protocol === 'http:' && localAllowed) {
    return null
  }

  return 'Webhook URL must use HTTPS.'
}

export function isWebhookUrlAllowed(rawUrl: string, options?: WebhookUrlSafetyOptions) {
  return getWebhookUrlSafetyError(rawUrl, options) === null
}

export function shouldAllowLocalWebhookUrls() {
  return process.env.NODE_ENV !== 'production'
}
