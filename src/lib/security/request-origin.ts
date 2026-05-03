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
  if (!origin) return false;

  try {
    const originHost = new URL(origin).host.toLowerCase();
    return allowedHosts.some((allowedHost) =>
      hostMatchesPattern(originHost, allowedHost.toLowerCase())
    );
  } catch {
    return false;
  }
}

export function hasCredentialedApiAuth(headers: Headers): boolean {
  const authorization = headers.get("authorization") ?? "";
  return (
    headers.has("x-internal-key") ||
    /^Bearer\s+\S+$/i.test(authorization)
  );
}

export function hasStandardWebhookSignature(headers: Headers): boolean {
  return (
    headers.has("webhook-id") &&
    headers.has("webhook-timestamp") &&
    headers.has("webhook-signature")
  );
}

export function hasSameSiteFetchMetadata(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site")?.toLowerCase();
  return site === "same-origin" || site === "same-site" || site === "none";
}

export function isAllowedMutationOrigin(
  headers: Headers,
  allowedHosts: readonly string[]
): boolean {
  return (
    isAllowedOriginHost(headers.get("origin"), allowedHosts) ||
    hasSameSiteFetchMetadata(headers)
  );
}
