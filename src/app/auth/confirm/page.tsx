'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser'

/**
 * Handles implicit-flow magic link sign-in.
 *
 * Supabase's admin.auth.admin.generateLink() produces OTP verification URLs
 * that redirect with tokens as hash fragments (#access_token=...&refresh_token=...).
 * Hash fragments never reach the server, so the PKCE /auth/callback route can't
 * handle them. This client page reads the hash, exchanges it for a session via
 * the Supabase browser client, then hands off to /auth/callback which handles
 * workspace resolution and cookie stamping.
 */
export default function AuthConfirmPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'processing' | 'error'>('processing')

  useEffect(() => {
    const hash = window.location.hash.slice(1) // strip leading '#'
    const params = new URLSearchParams(hash)

    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const errorCode = params.get('error')

    if (errorCode) {
      const description = params.get('error_description') ?? errorCode
      setStatus('error')
      router.replace(`/login?error=${encodeURIComponent(description)}`)
      return
    }

    if (!accessToken || !refreshToken) {
      setStatus('error')
      router.replace('/login?error=missing_code')
      return
    }

    const supabase = createBrowserSupabaseClient()
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          setStatus('error')
          router.replace('/login?error=callback_failed')
          return
        }

        // Session is now established in cookies. Hand off to the server callback
        // which resolves workspace context, stamps activity, and redirects.
        const next = searchParams.get('next') ?? ''
        const invite = searchParams.get('invite') ?? ''
        const callbackParams = new URLSearchParams()
        if (invite) callbackParams.set('invite', invite)
        if (next && next.startsWith('/') && !next.startsWith('//')) {
          callbackParams.set('next', next)
        }
        const callbackQuery = callbackParams.toString()
        router.replace(callbackQuery ? `/auth/callback?${callbackQuery}` : '/auth/callback')
      })
      .catch(() => {
        setStatus('error')
        router.replace('/login?error=callback_failed')
      })
  }, [router, searchParams])

  if (status === 'error') return null

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
        Signing you in…
      </p>
    </div>
  )
}
