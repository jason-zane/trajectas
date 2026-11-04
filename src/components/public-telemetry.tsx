'use client'

import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { filterPublicTelemetryEvent } from '@/lib/observability/public-telemetry'

export function PublicTelemetry() {
  return <>
    <Analytics beforeSend={event => filterPublicTelemetryEvent(event, document.referrer)} />
    <SpeedInsights beforeSend={event => filterPublicTelemetryEvent(event, document.referrer)} />
  </>
}
