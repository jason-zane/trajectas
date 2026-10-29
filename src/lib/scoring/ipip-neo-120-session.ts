import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { scoreIpipNeo120Session } from '@/lib/dal/ipip-neo-120'
import { persistSessionResponseQuality } from '@/lib/dal/response-quality'

export async function scoreSessionIpipNeo120(sessionId: string) {
  const db = createAdminClient()
  const scored = await scoreIpipNeo120Session(db, sessionId)
  if ('error' in scored) return scored
  try { await persistSessionResponseQuality(db, sessionId) }
  catch { return { error: 'Unable to finish response-quality processing. The saved personality scores are retained; please retry.' } }
  return scored
}
