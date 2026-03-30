function wildcardToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
    .replace(/\*/g, ".*");

  return new RegExp(`^${escaped}$`, "i");
}

export function hostMatchesPattern(
  host: string,
  allowedPattern: string
): boolean {
  return wildcardToRegex(allowedPattern).test(host);
}

export function isAllowedOriginHost(
  origin: string | null | undefined,
  allowedHosts: readonly string[]
): boolean {
  if (!origin) return true;

  try {
    const originHost = new URL(origin).host.toLowerCase();
    return allowedHosts.some((allowedHost) =>
      hostMatchesPattern(originHost, allowedHost.toLowerCase())
    );
  } catch {
    return false;
  }
}
