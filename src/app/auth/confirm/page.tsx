import { Suspense } from 'react'
import { AuthConfirmClient } from './client'

export default function AuthConfirmPage() {
  return (
    <Suspense>
      <AuthConfirmClient />
    </Suspense>
  )
}
