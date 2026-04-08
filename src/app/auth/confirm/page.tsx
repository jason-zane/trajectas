import { Suspense } from 'react'
import { AuthConfirmClient } from './client'

function AuthConfirmFallback() {
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

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={<AuthConfirmFallback />}>
      <AuthConfirmClient />
    </Suspense>
  )
}
