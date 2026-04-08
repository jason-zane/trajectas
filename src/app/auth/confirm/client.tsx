'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser'

export function AuthConfirmClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'processing' | 'error'>('processing')

  useEffect(() => {
    const hash = window.location.hash.slice(1)
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
