import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { scoreIpipNeo120Session } from '@/lib/dal/ipip-neo-120'

export async function scoreSessionIpipNeo120(sessionId: string) {
  return scoreIpipNeo120Session(createAdminClient(), sessionId)
}
