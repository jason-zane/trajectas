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
import { isAllowedOriginHost } from "@/lib/security/request-origin";
import type { Surface } from "@/lib/surfaces";

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

function buildContentSecurityPolicy(surface: Surface) {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const sharedDirectives = [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];

  if (surface === "admin") {
    return [
      ...sharedDirectives,
      `script-src 'self' 'unsafe-inline'${
        isDevelopment ? " 'unsafe-eval'" : ""
      }`,
      "connect-src 'self' https: wss:",
      "worker-src 'self' blob:",
    ].join("; ");
  }

  if (surface === "partner" || surface === "client") {
    return [
      ...sharedDirectives,
      `script-src 'self' 'unsafe-inline'${
        isDevelopment ? " 'unsafe-eval'" : ""
      }`,
      "connect-src 'self' https:",
      "worker-src 'self'",
    ].join("; ");
  }

  return [
    ...sharedDirectives,
    `script-src 'self' 'unsafe-inline'${
      isDevelopment ? " 'unsafe-eval'" : ""
    }`,
    "connect-src 'self' https:",
  ].join("; ");
}

function applySecurityHeaders(
  response: NextResponse,
  surface: Surface,
  pathname: string
) {
  response.headers.set("x-trajectas-surface", surface);
  response.headers.set(
    "Content-Security-Policy",
    buildContentSecurityPolicy(surface)
  );
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
  routePrefix: string
) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-trajectas-surface", surface);
  requestHeaders.set("x-trajectas-route-prefix", routePrefix);

  if (isLocalDev) {
    requestHeaders.set("x-trajectas-local-dev", "true");
  }

  return requestHeaders;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get("host");
  const configuredHosts = getConfiguredSurfaceHosts();
  const configuredSurface = inferSurfaceFromRequest({ host, pathname });
  const isLocalDev = isLocalDevelopmentHost(host);
  const routePrefix = getRoutePrefixForSurface(configuredSurface, isLocalDev);
  const forwardedHeaders = withSurfaceHeaders(
    request,
    configuredSurface,
    isLocalDev,
    routePrefix
  );
  const rateLimit = checkRequestRateLimit(request);

  if (rateLimit && !rateLimit.allowed) {
    const response = NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 }
    );
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    response.headers.set("X-RateLimit-Limit", String(rateLimit.limit));
    response.headers.set("X-RateLimit-Remaining", "0");
    return applySecurityHeaders(response, configuredSurface, pathname);
  }

  if (
    mutationMethods.has(request.method) &&
    pathname.startsWith("/api") &&
    !isAllowedOriginHost(request.headers.get("origin"), getAllowedOriginPatterns())
  ) {
    const response = NextResponse.json(
      { error: "Origin not allowed for protected mutation route." },
      { status: 403 }
    );
    return applySecurityHeaders(response, configuredSurface, pathname);
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
    return applySecurityHeaders(response, "assess", pathname);
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
    return applySecurityHeaders(response, "partner", pathname);
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
    return applySecurityHeaders(response, "client", pathname);
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
      return applySecurityHeaders(response, "admin", pathname);
    }
  }

  if (configuredSurface === "assess" && !pathname.startsWith("/assess")) {
    const assessPath = pathname === "/" ? "/assess" : `/assess${pathname}`;
    const target = buildSurfaceUrl("assess", assessPath, search) ?? new URL(assessPath, request.url);
    const response = NextResponse.redirect(target);
    return applySecurityHeaders(response, "assess", assessPath);
  }

  if (!isLocalDev && configuredSurface === "admin" && pathname === "/") {
    const response = NextResponse.redirect(
      redirectToSurface(request, "admin", "/dashboard", "", "/dashboard")
    );
    return applySecurityHeaders(response, "admin", "/dashboard");
  }

  if (
    !pathname.startsWith("/api") &&
    (configuredSurface === "partner" || configuredSurface === "client") &&
    !isLocalDev
  ) {
    const internalPrefix = `/${configuredSurface}`;

    if (pathname === internalPrefix || pathname.startsWith(`${internalPrefix}/`)) {
      const target = request.nextUrl.clone();
      target.pathname = pathname.slice(internalPrefix.length) || "/";
      const response = NextResponse.redirect(target);
      return applySecurityHeaders(response, configuredSurface, target.pathname);
    }

    const target = request.nextUrl.clone();
    target.pathname = pathname === "/" ? internalPrefix : `${internalPrefix}${pathname}`;
    const response = NextResponse.rewrite(target, {
      request: {
        headers: forwardedHeaders,
      },
    });
    return applySecurityHeaders(response, configuredSurface, target.pathname);
  }

  const response = NextResponse.next({
    request: {
      headers: forwardedHeaders,
    },
  });

  return applySecurityHeaders(response, configuredSurface, pathname);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|site.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|css|js|map)$).*)",
  ],
};
