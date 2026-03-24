import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Next.js Proxy (formerly Middleware) that refreshes the Supabase auth session
 * on every matched request and protects dashboard routes.
 *
 * This runs on the Node.js runtime before route rendering. It reads the
 * Supabase auth cookies, calls `getUser()` to refresh the session if needed,
 * and writes any updated tokens back to the response cookies.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Update cookies on the request so downstream server components
          // can read the refreshed session immediately.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )

          // Clone the response with updated request headers and set the
          // refreshed cookies on the outgoing response.
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not use `getSession()` here. `getUser()` sends a request
  // to the Supabase Auth server every time to revalidate the token, whereas
  // `getSession()` only reads from local storage and can return stale data.
  // See: https://supabase.com/docs/guides/auth/server-side/nextjs
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect routes under the (dashboard) route group.
  // If the user is not authenticated and is trying to access a protected
  // route, redirect them to the login page.
  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard')
    || request.nextUrl.pathname.match(/^\/(settings|assessments|diagnostics|reports|admin)/)

  if (!user && isDashboardRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - Public assets with common image extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
