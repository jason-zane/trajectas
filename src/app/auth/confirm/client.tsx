'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser'

export function AuthConfirmClient() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'processing' | 'error'>('processing')

  useEffect(() => {
    // The @supabase/ssr browser client has detectSessionInUrl enabled by
    // default. When created on a page whose URL contains #access_token=...,
    // it automatically processes the hash, sets the session in cookies, and
    // fires onAuthStateChange. We just need to wait for that event.
    const supabase = createBrowserSupabaseClient()
    let settled = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (settled) return

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          settled = true
          const next = searchParams.get('next') ?? ''
          const invite = searchParams.get('invite') ?? ''
          const callbackParams = new URLSearchParams()
          if (invite) callbackParams.set('invite', invite)
          if (next && next.startsWith('/') && !next.startsWith('//')) {
            callbackParams.set('next', next)
          }
          const query = callbackParams.toString()
          window.location.replace(query ? `/auth/callback?${query}` : '/auth/callback')
        }
      },
    )

    // Fallback: if no auth event fires within 10 seconds, redirect to login.
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      setStatus('error')
      window.location.replace('/login?error=callback_failed')
    }, 10_000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [searchParams])

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
