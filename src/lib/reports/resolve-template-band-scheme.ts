// =============================================================================
// src/lib/reports/resolve-template-band-scheme.ts
// Shared band-scheme resolution used by the runner pipeline and preview pages.
// Cascade: template → partner → platform_settings → default.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveBandScheme, DEFAULT_3_BAND_SCHEME, type BandScheme } from './band-scheme'

interface TemplateSchemeInput {
  bandScheme: BandScheme | null
  partnerId: string | null
}

export async function resolveTemplateBandScheme(
  db: SupabaseClient,
  template: TemplateSchemeInput,
): Promise<BandScheme> {
  let partnerScheme: BandScheme | null = null
  if (template.partnerId) {
    const { data: partnerRow } = await db
      .from('partners')
      .select('band_scheme')
      .eq('id', template.partnerId)
      .maybeSingle()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    partnerScheme = ((partnerRow as any)?.band_scheme as BandScheme | null) ?? null
  }

  const { data: platformRow } = await db
    .from('platform_settings')
    .select('band_scheme')
    .limit(1)
    .maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const platformScheme = ((platformRow as any)?.band_scheme as BandScheme | null) ?? null

  return (
    resolveBandScheme(
      { bandScheme: template.bandScheme },
      { bandScheme: partnerScheme },
      { bandScheme: platformScheme },
    ) ?? DEFAULT_3_BAND_SCHEME
  )
}
