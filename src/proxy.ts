import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  buildSurfaceUrl,
  getRoutePrefixForSurface,
  getAllowedOriginPatterns,
  getConfiguredSurfaceHosts,
  inferSurfaceFromRequest,
  isLocalDevelopmentHost,
} from "@/lib/hosts";
import { checkRequestRateLimit } from "@/lib/security/rate-limit";
import {
  hasCredentialedApiAuth,
  hasStandardWebhookSignature,
  isAllowedMutationOrigin,
} from "@/lib/security/request-origin";
import type { Surface } from "@/lib/surfaces";
import { createMiddlewareSupabaseClient } from "@/lib/supabase/middleware";
import { getVerifiedUserId } from "@/lib/auth/claims";
import {
  COOKIE_NAME as ACTIVITY_COOKIE,
  decodeLastActivity,
  encodeLastActivity,
  isSessionExpired,
  buildLastActivityCookieOptions,
} from "@/lib/auth/session-activity";

const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const publicHostedExactPaths = new Set([
  "/",
  "/login",
  "/logout",
  "/unauthorized",
  "/surface-coming-soon",
]);

function isAssessPath(pathname: string) {
  return pathname === "/assess" || pathname.startsWith("/assess/");
}

function isPartnerPath(pathname: string) {
  return pathname === "/partner" || pathname.startsWith("/partner/");
}

function isClientPath(pathname: string) {
  return pathname === "/client" || pathname.startsWith("/client/");
}

function isPublicHostedPath(pathname: string) {
  return (
    publicHostedExactPaths.has(pathname) ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/")
  );
}

function isSharedAuthPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/logout" ||
    pathname === "/unauthorized" ||
    pathname === "/surface-coming-soon" ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/")
  );
}

// Preview routes (/preview/*) are reached via window.open from the editor and
// must load on the same origin that set the preview data in localStorage. They
// render the same bundle everywhere — don't rewrite them into /client or
// /partner prefixes.
function isSharedPreviewPath(pathname: string) {
  return pathname === "/preview" || pathname.startsWith("/preview/");
}

function redirectToSurface(
  request: NextRequest,
  surface: Surface,
  pathname: string,
  search: string,
  fallbackPath = "/"
) {
  return (
    buildSurfaceUrl(surface, pathname, search) ??
    new URL(fallbackPath, request.url)
  );
}

function getSupabaseHost(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function buildContentSecurityPolicy(surface: Surface, nonce: string) {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const supabaseHost = getSupabaseHost();
  const supabaseHttps = supabaseHost ? `https://${supabaseHost}` : "";
  const supabaseWss = supabaseHost ? `wss://${supabaseHost}` : "";

  // `'strict-dynamic'` lets the initial nonce'd script load the Next.js chunk
  // graph without re-noncing each one. `'unsafe-inline'` inside a nonce
  // directive is ignored by CSP3-compliant browsers and acts as a fallback
  // for older ones. `'unsafe-eval'` is required only in dev for React's
  // server-error-stack rewriter.
  const scriptSrc = [
    "script-src",
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    isDevelopment ? "'unsafe-eval'" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Style-src still allows 'unsafe-inline' — several server components render
  // brand CSS via inline <style> tags that haven't yet been plumbed with a
  // nonce. Scripts are the higher-impact XSS vector and are now strict.
  const shared = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    `img-src 'self' data: blob: ${supabaseHttps} https://cal.com https://app.cal.com`.trim(),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
    "report-uri /api/csp-report",
  ];

  if (surface === "admin") {
    return [
      ...shared,
      "frame-src 'none'",
      `connect-src 'self' ${supabaseHttps} ${supabaseWss}`.trim(),
      "worker-src 'self' blob:",
    ].join("; ");
  }

  if (surface === "partner" || surface === "client") {
    return [
      ...shared,
      "frame-src 'none'",
      `connect-src 'self' ${supabaseHttps} ${supabaseWss}`.trim(),
      "worker-src 'self'",
    ].join("; ");
  }

  if (surface === "public") {
    // Marketing pages only — allow the Cal.com inline booking embed.
    return [
      ...shared,
      "frame-src https://app.cal.com https://cal.com",
      `connect-src 'self' ${supabaseHttps} ${supabaseWss} https://app.cal.com https://cal.com`.trim(),
    ].join("; ");
  }

  // Every other surface (assess, etc.) — no third-party iframes allowed.
  return [
    ...shared,
    "frame-src 'none'",
    `connect-src 'self' ${supabaseHttps} ${supabaseWss}`.trim(),
  ].join("; ");
}

interface CspContext {
  headerName: "Content-Security-Policy" | "Content-Security-Policy-Report-Only";
  policy: string;
}

function resolveCspContext(surface: Surface, nonce: string): CspContext {
  // Default to report-only mode for safe rollout. CSP_ENFORCE=1 flips this to
  // enforcing, but enforcement is gated on PR 0's nonce-attachment verification
  // landing first — see docs/audit/2026-05-22-cross-environment-reliability-plan.md.
  const headerName =
    process.env.CSP_ENFORCE === "1"
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only";
  return {
    headerName,
    policy: buildContentSecurityPolicy(surface, nonce),
  };
}

function applySecurityHeaders(
  response: NextResponse,
  surface: Surface,
  pathname: string,
  csp: CspContext,
) {
  response.headers.set("x-trajectas-surface", surface);
  response.headers.set(csp.headerName, csp.policy);
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-site");

  const isProtectedSurface =
    surface === "admin" || surface === "partner" || surface === "client" || surface === "assess";
  const shouldHideFromRobots = isProtectedSurface || pathname === "/surface-coming-soon";

  if (isProtectedSurface) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
  }

  if (shouldHideFromRobots) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

function withSurfaceHeaders(
  request: NextRequest,
  surface: Surface,
  isLocalDev: boolean,
  routePrefix: string,
  nonce: string,
  csp: CspContext,
) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-trajectas-surface", surface);
  requestHeaders.set("x-trajectas-route-prefix", routePrefix);
  // Next.js reads `x-nonce` to propagate the nonce to framework scripts,
  // page JS bundles, and <Script nonce={...}> components. It also reads the
  // matching CSP header from request headers during SSR to know which scripts
  // need a nonce attached — without the policy on the request, the nonce on
  // its own is insufficient.
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(csp.headerName, csp.policy);

  if (isLocalDev) {
    requestHeaders.set("x-trajectas-local-dev", "true");
  }

  return requestHeaders;
}

function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

/** Paths that should never have the inactivity timeout applied. */
function shouldSkipActivityCheck(pathname: string): boolean {
  return (
    isAssessPath(pathname) ||
    isPublicHostedPath(pathname) ||
    pathname.startsWith("/api/auth/send-email") ||
    isAuthBoundaryPath(pathname)
  );
}

/**
 * Auth-boundary paths are part of the sign-in/sign-out chain itself, not real
 * user activity. Applying the inactivity check on these creates a loop where a
 * stale activity cookie from a previous session (e.g. set with a different
 * domain scope than the fresh one) trips the expiry redirect during the
 * verify → callback hand-off. /dashboard is intentionally NOT in this list:
 * the main protected entry route must keep enforcing inactivity. The real
 * fix is /auth/expire clearing the stale cookie under both domain scopes
 * (see that route's cookies.set rows below).
 */
function isAuthBoundaryPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/logout" ||
    pathname.startsWith("/auth/")
  );
}

function shouldSkipMutationOriginCheck(
  pathname: string,
  headers: Headers
): boolean {
  if (hasCredentialedApiAuth(headers)) return true;
  if (pathname === "/api/csp-report") return true;
  if (pathname === "/api/auth/send-email") {
    return hasStandardWebhookSignature(headers);
  }
  return false;
}

export async function proxy(request: NextRequest) {
  const proxyStartedAt = performance.now();
  // Server-Timing phases (visible in browser DevTools → Network → Timing):
  // rl = rate-limit check, auth = local JWT verification + activity check,
  // proxy = total middleware time. Durations only — no sensitive data.
  const serverTimings: Array<{ name: string; durationMs: number }> = [];
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get("host");
  const configuredHosts = getConfiguredSurfaceHosts();
  const configuredSurface = inferSurfaceFromRequest({ host, pathname });
  const isLocalDev = isLocalDevelopmentHost(host);
  const routePrefix = getRoutePrefixForSurface(configuredSurface, isLocalDev);
  const nonce = generateNonce();
  const csp = resolveCspContext(configuredSurface, nonce);
  const forwardedHeaders = withSurfaceHeaders(
    request,
    configuredSurface,
    isLocalDev,
    routePrefix,
    nonce,
    csp,
  );
  const applyHeaders = (response: NextResponse, surface: Surface, p: string) => {
    const applied = applySecurityHeaders(
      response,
      surface,
      p,
      // Recompute the CSP per-surface when the response surface differs from
      // the inferred surface (cross-surface redirects), so the policy emitted
      // on the response matches what the destination expects.
      surface === configuredSurface ? csp : resolveCspContext(surface, nonce),
    );
    const parts = [
      ...serverTimings.map(
        ({ name, durationMs }) => `${name};dur=${durationMs.toFixed(1)}`
      ),
      `proxy;dur=${(performance.now() - proxyStartedAt).toFixed(1)}`,
    ];
    applied.headers.set("Server-Timing", parts.join(", "));
    return applied;
  };
  const rateLimitStartedAt = performance.now();
  const rateLimit = await checkRequestRateLimit(request);
  serverTimings.push({ name: "rl", durationMs: performance.now() - rateLimitStartedAt });

  if (rateLimit && !rateLimit.allowed) {
    const response = NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 }
    );
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    response.headers.set("X-RateLimit-Limit", String(rateLimit.limit));
    response.headers.set("X-RateLimit-Remaining", "0");
    return applyHeaders(response, configuredSurface, pathname);
  }

  if (
    mutationMethods.has(request.method) &&
    pathname.startsWith("/api") &&
    !shouldSkipMutationOriginCheck(pathname, request.headers) &&
    !isAllowedMutationOrigin(request.headers, getAllowedOriginPatterns())
  ) {
    const response = NextResponse.json(
      { error: "Origin not allowed for protected mutation route." },
      { status: 403 }
    );
    return applyHeaders(response, configuredSurface, pathname);
  }

  // ─── Session activity check ────────────────────────────────────────────────
  // Uses a placeholder response so Supabase can refresh its session cookies,
  // which we then copy onto the final routing response below.
  const sessionCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

  if (!shouldSkipActivityCheck(pathname)) {
    const sessionResponse = NextResponse.next();
    const supabase = createMiddlewareSupabaseClient(request, sessionResponse);
    // Verifies the session JWT locally against the cached JWKS; refreshes
    // expired tokens through the SSR client (cookies land on sessionResponse).
    const authStartedAt = performance.now();
    const userId = await getVerifiedUserId(supabase);
    serverTimings.push({ name: "auth", durationMs: performance.now() - authStartedAt });

    if (userId) {
      const now = Math.floor(Date.now() / 1000);
      const raw = request.cookies.get(ACTIVITY_COOKIE)?.value;
      const lastActivity = decodeLastActivity(raw);

      if (lastActivity !== null && isSessionExpired(lastActivity)) {
        return NextResponse.redirect(new URL("/auth/expire", request.url));
      }

      // Slide the activity window
      sessionResponse.cookies.set(
        ACTIVITY_COOKIE,
        encodeLastActivity(now),
        buildLastActivityCookieOptions()
      );
    }

    // Collect all cookies (Supabase auth + activity) for the final response
    for (const { name, value, ...options } of sessionResponse.cookies.getAll()) {
      sessionCookies.push({ name, value, options });
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  /** Apply collected session cookies to any routing response before returning. */
  function withSessionCookies(response: NextResponse): NextResponse {
    for (const { name, value, options } of sessionCookies) {
      response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
    }
    return response;
  }

  if (
    configuredHosts.assess &&
    isAssessPath(pathname) &&
    host !== configuredHosts.assess &&
    !isLocalDev
  ) {
    const response = NextResponse.redirect(
      redirectToSurface(request, "assess", pathname, search, "/assess")
    );
    return withSessionCookies(applyHeaders(response, "assess", pathname));
  }

  if (
    configuredHosts.partner &&
    isPartnerPath(pathname) &&
    host !== configuredHosts.partner &&
    !isLocalDev
  ) {
    const response = NextResponse.redirect(
      redirectToSurface(request, "partner", pathname, search, "/")
    );
    return withSessionCookies(applyHeaders(response, "partner", pathname));
  }

  if (
    configuredHosts.client &&
    isClientPath(pathname) &&
    host !== configuredHosts.client &&
    !isLocalDev
  ) {
    const response = NextResponse.redirect(
      redirectToSurface(request, "client", pathname, search, "/")
    );
    return withSessionCookies(applyHeaders(response, "client", pathname));
  }

  if (
    !isLocalDev &&
    configuredSurface === "public" &&
    !pathname.startsWith("/api") &&
    !isPublicHostedPath(pathname)
  ) {
    const target = buildSurfaceUrl("admin", pathname, search);
    if (target) {
      const response = NextResponse.redirect(target);
      return withSessionCookies(applyHeaders(response, "admin", pathname));
    }
  }

  if (
    configuredSurface === "assess" &&
    !pathname.startsWith("/assess") &&
    !pathname.startsWith("/api")
  ) {
    // Canonicalise page routes to /assess/<path> on the assess subdomain.
    // API routes (`/api/...`) MUST be excluded — they live at the app root in
    // the route tree, not under /app/assess/. Without this guard a fetch to
    // `/api/assess/save-batch` from assess.trajectas.com gets 307'd to
    // `/assess/api/assess/save-batch` (404), silently breaking every save
    // queue and progress sendBeacon issued from the runner.
    const assessPath = pathname === "/" ? "/assess" : `/assess${pathname}`;
    const target = buildSurfaceUrl("assess", assessPath, search) ?? new URL(assessPath, request.url);
    const response = NextResponse.redirect(target);
    return withSessionCookies(applyHeaders(response, "assess", assessPath));
  }

  if (!isLocalDev && configuredSurface === "admin" && pathname === "/") {
    const response = NextResponse.redirect(
      redirectToSurface(request, "admin", "/dashboard", "", "/dashboard")
    );
    return withSessionCookies(applyHeaders(response, "admin", "/dashboard"));
  }

  if (
    !pathname.startsWith("/api") &&
    (configuredSurface === "partner" || configuredSurface === "client") &&
    !isLocalDev
  ) {
    if (isSharedAuthPath(pathname) || isSharedPreviewPath(pathname)) {
      const response = NextResponse.next({
        request: {
          headers: forwardedHeaders,
        },
      });
      return withSessionCookies(
        applyHeaders(response, configuredSurface, pathname)
      );
    }

    const internalPrefix = `/${configuredSurface}`;

    if (pathname === internalPrefix || pathname.startsWith(`${internalPrefix}/`)) {
      const target = request.nextUrl.clone();
      target.pathname = pathname.slice(internalPrefix.length) || "/";
      const response = NextResponse.redirect(target);
      return withSessionCookies(applyHeaders(response, configuredSurface, target.pathname));
    }

    const target = request.nextUrl.clone();
    target.pathname = pathname === "/" ? internalPrefix : `${internalPrefix}${pathname}`;
    const response = NextResponse.rewrite(target, {
      request: {
        headers: forwardedHeaders,
      },
    });
    return withSessionCookies(applyHeaders(response, configuredSurface, target.pathname));
  }

  const response = NextResponse.next({
    request: {
      headers: forwardedHeaders,
    },
  });

  return withSessionCookies(applyHeaders(response, configuredSurface, pathname));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|site.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|css|js|map)$).*)",
  ],
};
