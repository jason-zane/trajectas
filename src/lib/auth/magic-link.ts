interface MagicLinkRedirectInput {
  origin?: string | null;
  referer?: string | null;
  redirectPath: string;
  publicAppUrl?: string | null;
  adminAppUrl?: string | null;
  fallbackUrl?: string | null;
}

function resolveMagicLinkBaseUrl(input: Omit<MagicLinkRedirectInput, "redirectPath">) {
  const candidates = [
    input.origin,
    input.referer,
    input.publicAppUrl,
    input.adminAppUrl,
    input.fallbackUrl,
    "http://localhost:3002",
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    try {
      return new URL(candidate).origin;
    } catch {
      continue;
    }
  }

  return "http://localhost:3002";
}

export function buildMagicLinkRedirectUrl(input: MagicLinkRedirectInput) {
  return new URL(
    input.redirectPath,
    resolveMagicLinkBaseUrl({
      origin: input.origin,
      referer: input.referer,
      publicAppUrl: input.publicAppUrl,
      adminAppUrl: input.adminAppUrl,
      fallbackUrl: input.fallbackUrl,
    })
  ).toString();
}
