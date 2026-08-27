// =============================================================================
// src/lib/dal/chat-band-scheme.ts
//
// The band scheme a chat score card reads scores against.
//
// A POMP score only means something against a scheme — "62.4" is not a claim,
// "62.4, Effective" is. So the card must use the same scheme the rest of the
// platform does rather than inventing one, or chat and the report page would
// label the same score differently.
//
// This resolves the platform-level cascade (partner → platform → default).
// A specific report TEMPLATE can still override it, which is why the card
// links to the report rather than claiming to be one.
// =============================================================================

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveTemplateBandScheme } from '@/lib/reports/resolve-template-band-scheme'
import { DEFAULT_3_BAND_SCHEME } from '@/lib/reports/band-scheme'
import { logActionError } from '@/lib/security/action-errors'

export interface ChatBandScheme {
  palette: string
  bands: Array<{ key: string; label: string; min: number; max: number }>
}

/**
 * Fail-soft by design: a card that cannot read platform settings should still
 * render against the documented default rather than failing the whole answer.
 */
export async function getChatBandScheme(
  db: SupabaseClient,
  partnerId: string | null = null,
): Promise<ChatBandScheme> {
  let scheme = DEFAULT_3_BAND_SCHEME
  try {
    scheme = await resolveTemplateBandScheme(db, { bandScheme: null, partnerId })
  } catch (error) {
    logActionError('chat.band_scheme.resolve', error)
  }

  return {
    palette: scheme.palette,
    bands: scheme.bands.map((b) => ({
      key: b.key,
      label: b.label,
      min: b.min,
      max: b.max,
    })),
  }
}
