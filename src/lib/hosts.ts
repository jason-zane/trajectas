import { coerceSurface, type Surface } from "@/lib/surfaces";

const surfaceEnvKeys: Record<Surface, string> = {
  public: "PUBLIC_APP_URL",
  assess: "ASSESS_APP_URL",
  admin: "ADMIN_APP_URL",
  partner: "PARTNER_APP_URL",
  client: "CLIENT_APP_URL",
};

export function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;
  return host.trim().toLowerCase();
}

export function normalizeUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function getConfiguredSurfaceUrls(): Partial<Record<Surface, string>> {
  const entries = Object.entries(surfaceEnvKeys).map(([surface, key]) => [
    surface,
    normalizeUrl(process.env[key]),
  ]);

  return Object.fromEntries(
    entries.filter(([, value]) => Boolean(value))
  ) as Partial<Record<Surface, string>>;
}

export function getConfiguredSurfaceHosts(): Partial<Record<Surface, string>> {
  const urls = getConfiguredSurfaceUrls();
  const entries = Object.entries(urls).map(([surface, value]) => {
    const host = value ? new URL(value).host.toLowerCase() : null;
    return [surface, host];
  });

  return Object.fromEntries(
    entries.filter(([, value]) => Boolean(value))
  ) as Partial<Record<Surface, string>>;
}

export function getConfiguredSurfaceUrl(surface: Surface): string | null {
  return getConfiguredSurfaceUrls()[surface] ?? null;
}

export function getSurfaceForHost(host: string | null | undefined): Surface | null {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) return null;

  const configuredHosts = getConfiguredSurfaceHosts();
  for (const surface of Object.keys(configuredHosts) as Surface[]) {
    if (configuredHosts[surface] === normalizedHost) {
      return surface;
    }
  }

  return null;
}

export function isLocalDevelopmentHost(host: string | null | undefined): boolean {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) return false;

  const hostname = normalizedHost.split(":")[0];
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0"
  );
}

export function inferSurfaceFromRequest(input: {
  host?: string | null;
  pathname?: string;
}): Surface {
  const hostSurface = getSurfaceForHost(input.host);
  if (hostSurface) return hostSurface;

  if (input.pathname?.startsWith("/partner")) {
    return "partner";
  }

  if (input.pathname?.startsWith("/client")) {
    return "client";
  }

  if (input.pathname?.startsWith("/assess")) {
    return "assess";
  }

  return isLocalDevelopmentHost(input.host) ? "admin" : "public";
}

export function buildSurfaceUrl(
  surface: Surface,
  pathname = "/",
  search = ""
): URL | null {
  const base = getConfiguredSurfaceUrl(surface);
  if (!base) return null;

  const url = new URL(base);
  url.pathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  url.search = search;
  return url;
}

export function getAllowedOriginPatterns(): string[] {
  const configuredHosts = Object.values(getConfiguredSurfaceHosts());
  const configured = configuredHosts.filter(Boolean) as string[];
  const extra =
    process.env.SERVER_ACTION_ALLOWED_ORIGINS?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];

  return Array.from(new Set([...configured, ...extra]));
}

export function resolveSurfaceHeader(
  value: string | null | undefined,
  pathname?: string
): Surface {
  return coerceSurface(value, pathname?.startsWith("/assess") ? "assess" : "admin");
}

export function getRoutePrefixForSurface(
  surface: Surface,
  isLocalDev: boolean
): string {
  if (!isLocalDev) {
    return "";
  }

  if (surface === "partner" || surface === "client" || surface === "assess") {
    return `/${surface}`;
  }

  return "";
}
